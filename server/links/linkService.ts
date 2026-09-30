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
        await this.redis.del(`link:${link.code}`);
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

        await this.redis.del(`link:${link.code}`);
        return { link, created: true };
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
      }
    }
    throw new Error(`Could not generate a unique code after ${MAX_ATTEMPTS} attempts`);
  }

  async resolve(code: string): Promise<string | null> {
    const key = `link:${code}`;

    const cached = await this.redis.get(key);
    if (cached !== null) return cached === NOT_FOUND ? null : cached;

    const link = await this.repo.findByCode(code);
    if (!link || (link.expiresAt && link.expiresAt <= new Date())) {
      await this.redis.set(key, NOT_FOUND, 'EX', NEGATIVE_TTL_SECONDS);
      return null;
    }

    let ttl = CACHE_TTL_SECONDS;
    if (link.expiresAt) {
      const secondsLeft = Math.ceil((link.expiresAt.getTime() - Date.now()) / 1000);
      ttl = Math.min(ttl, secondsLeft);
    }
    await this.redis.set(key, link.longUrl, 'EX', ttl);
    return link.longUrl;
  }

  async recordClick(code: string): Promise<void> {
    await this.redis.incr(`clicks:${code}`);
  }

  async list(ownerId: string, cursor?: string): Promise<LinkPage> {
    // Fetch one extra row to know whether another page exists.
    const rows = await this.repo.listByOwner(ownerId, { before: cursor, limit: PAGE_SIZE + 1 });
    const links = rows.slice(0, PAGE_SIZE);
    return {
      links,
      nextCursor: rows.length > PAGE_SIZE ? links[links.length - 1].id : null,
    };
  }

  // Includes clicks still buffered in Redis, so the count is current rather
  // than up to one flush interval behind.
  async get(ownerId: string, code: string): Promise<Link | null> {
    const link = await this.repo.findOwned(ownerId, code);
    if (!link) return null;

    const buffered = Number(await this.redis.get(`clicks:${code}`)) || 0;
    return { ...link, clickCount: link.clickCount + buffered };
  }

  async delete(ownerId: string, code: string): Promise<boolean> {
    const deleted = await this.repo.softDelete(ownerId, code);
    // Drop the cached target so the short link stops working right away.
    if (deleted) await this.redis.del(`link:${code}`);
    return deleted;
  }
}
