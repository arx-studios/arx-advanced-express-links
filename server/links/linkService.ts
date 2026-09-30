import type { Redis } from 'ioredis';
import { generateCode } from '@/lib/shortCode';
import type { Link, LinkRepository } from './linkRepository';

const UNIQUE_VIOLATION = '23505';
const MAX_ATTEMPTS = 5;
const CACHE_TTL_SECONDS = 60 * 60 * 24;
const NEGATIVE_TTL_SECONDS = 60;
const NOT_FOUND = '__none__';
const PAGE_SIZE = 20;

export class AliasTakenError extends Error {}

export interface CreateResult {
  link: Link;
  created: boolean;
}

export interface LinkPage {
  links: Link[];
  nextCursor: string | null;
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === UNIQUE_VIOLATION;
}

export class LinkService {
  constructor(
    private readonly repo: LinkRepository,
    private readonly redis: Redis,
  ) {}

  async create(input: {
    ownerId: string;
    longUrl: string;
    alias?: string;
    expiresAt?: Date;
  }): Promise<CreateResult> {
    const { ownerId, longUrl } = input;
    const expiresAt = input.expiresAt ?? null;

    if (input.alias) {
      try {
        const link = await this.repo.insert({ code: input.alias, longUrl, ownerId, expiresAt });
        await this.cacheDel(`link:${link.code}`);
        return { link, created: true };
      } catch (err) {
        if (isUniqueViolation(err)) throw new AliasTakenError(`Alias "${input.alias}" is taken`);
        throw err;
      }
    }

    // Plain links (no alias, no expiry) are deduplicated per owner: shortening
    // the same URL again returns the same code.
    let canonical = expiresAt === null;
    if (canonical) {
      const existing = await this.repo.findCanonical(ownerId, longUrl);
      if (existing) return { link: existing, created: false };
    }

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const code = generateCode();
        const link = canonical
          ? await this.repo.insertCanonical({ code, longUrl, ownerId })
          : await this.repo.insert({ code, longUrl, ownerId, expiresAt });

        if (!link) {
          // A concurrent request created the canonical link between our lookup and insert.
          const existing = await this.repo.findCanonical(ownerId, longUrl);
          if (existing) return { link: existing, created: false };
          // Hash matched a different URL (practically impossible): store a regular link.
          canonical = false;
          continue;
        }

        await this.cacheDel(`link:${link.code}`);
        return { link, created: true };
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
      }
    }
    throw new Error(`Could not generate a unique code after ${MAX_ATTEMPTS} attempts`);
  }

  async resolve(code: string): Promise<string | null> {
    const key = `link:${code}`;

    const cached = await this.cacheGet(key);
    if (typeof cached === 'string') return cached === NOT_FOUND ? null : cached;
    // Cache unreachable: serve from Postgres and don't wait on writes that would also fail.
    const cacheUp = cached === null;

    const link = await this.repo.findByCode(code);
    if (!link || (link.expiresAt && link.expiresAt <= new Date())) {
      if (cacheUp) await this.cacheSet(key, NOT_FOUND, NEGATIVE_TTL_SECONDS);
      return null;
    }

    let ttl = CACHE_TTL_SECONDS;
    if (link.expiresAt) {
      const secondsLeft = Math.ceil((link.expiresAt.getTime() - Date.now()) / 1000);
      ttl = Math.min(ttl, secondsLeft);
    }
    if (cacheUp) await this.cacheSet(key, link.longUrl, ttl);
    return link.longUrl;
  }

  async recordClick(code: string): Promise<void> {
    await this.redis.incr(`clicks:${code}`);
  }

  async list(ownerId: string, cursor?: string): Promise<LinkPage> {
    // Fetch one extra row to know whether another page exists.
    const rows = await this.repo.listByOwner(ownerId, { before: cursor, limit: PAGE_SIZE + 1 });
    const page = rows.slice(0, PAGE_SIZE);
    return {
      links: await this.withBufferedClicks(page),
      nextCursor: rows.length > PAGE_SIZE ? page[page.length - 1].id : null,
    };
  }

  // Adds clicks still buffered in Redis, so counts are current rather than up
  // to one flush interval behind. One MGET for the whole page.
  private async withBufferedClicks(links: Link[]): Promise<Link[]> {
    if (links.length === 0) return links;
    const buffered = await this.cacheMget(links.map((link) => `clicks:${link.code}`));
    return links.map((link, i) => ({
      ...link,
      clickCount: link.clickCount + (Number(buffered[i]) || 0),
    }));
  }

  async get(ownerId: string, code: string): Promise<Link | null> {
    const link = await this.repo.findOwned(ownerId, code);
    if (!link) return null;

    const [withClicks] = await this.withBufferedClicks([link]);
    return withClicks;
  }

  async delete(ownerId: string, code: string): Promise<boolean> {
    const deleted = await this.repo.softDelete(ownerId, code);
    // Drop the cached target so the short link stops working right away.
    if (deleted) await this.cacheDel(`link:${code}`);
    return deleted;
  }

  // Redis is a cache in front of Postgres, not a source of truth, so a Redis
  // outage must not take links down: these log and carry on without the cache.
  // null = cache miss, undefined = cache unreachable.
  private async cacheGet(key: string): Promise<string | null | undefined> {
    try {
      return await this.redis.get(key);
    } catch (err) {
      console.warn('cache read failed, falling back to Postgres', err);
      return undefined;
    }
  }

  private async cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, value, 'EX', ttlSeconds);
    } catch (err) {
      console.warn('cache write failed', err);
    }
  }

  private async cacheDel(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (err) {
      console.warn('cache delete failed', err);
    }
  }

  private async cacheMget(keys: string[]): Promise<(string | null)[]> {
    try {
      return await this.redis.mget(keys);
    } catch (err) {
      console.warn('cache read failed, click counts may lag', err);
      return keys.map(() => null);
    }
  }
}
