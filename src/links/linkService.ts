import type { Redis } from 'ioredis';
import { generateCode } from '../lib/shortCode.js';
import type { Link, LinkRepository } from './linkRepository.js';

const UNIQUE_VIOLATION = '23505';
const MAX_ATTEMPTS = 5;
const CACHE_TTL_SECONDS = 60 * 60 * 24;
const NEGATIVE_TTL_SECONDS = 60;
const NOT_FOUND = '__none__';

export class AliasTakenError extends Error {}

export interface CreateResult {
  link: Link;
  created: boolean;
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === UNIQUE_VIOLATION;
}

export class LinkService {
  constructor(
    private readonly repo: LinkRepository,
    private readonly redis: Redis,
  ) {}

  async create(input: { longUrl: string; alias?: string; expiresAt?: Date }): Promise<CreateResult> {
    const expiresAt = input.expiresAt ?? null;

    if (input.alias) {
      try {
        const link = await this.repo.insert({ code: input.alias, longUrl: input.longUrl, expiresAt });
        await this.redis.del(`link:${link.code}`);
        return { link, created: true };
      } catch (err) {
        if (isUniqueViolation(err)) throw new AliasTakenError(`Alias "${input.alias}" is taken`);
        throw err;
      }
    }

    // Plain links (no alias, no expiry) are deduplicated: the same URL gets the same code.
    let canonical = expiresAt === null;
    if (canonical) {
      const existing = await this.repo.findCanonical(input.longUrl);
      if (existing) return { link: existing, created: false };
    }

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const code = generateCode();
        const link = canonical
          ? await this.repo.insertCanonical({ code, longUrl: input.longUrl })
          : await this.repo.insert({ code, longUrl: input.longUrl, expiresAt });

        if (!link) {
          // A concurrent request created the canonical link between our lookup and insert.
          const existing = await this.repo.findCanonical(input.longUrl);
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
}
