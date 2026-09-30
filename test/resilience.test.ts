import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { connectionConfig } from '@/lib/pgConnection';
import { getPool } from '@/server/db';
import { LinkRepository } from '@/server/links/linkRepository';
import { LinkService } from '@/server/links/linkService';
import { rateLimit } from '@/server/rateLimit';
import { UserRepository } from '@/server/users/userRepository';

// A Redis whose every command fails, like an unreachable Render instance.
const fail = () => Promise.reject(new Error('Connection is closed.'));
const deadPipeline = { incr: () => deadPipeline, expire: () => deadPipeline, ttl: () => deadPipeline, exec: fail };
const deadRedis = new Proxy({} as Redis, {
  // multi() returns a chainable pipeline whose exec() fails; every other command fails directly.
  get: (_target, prop) => (prop === 'multi' ? () => deadPipeline : fail),
});

const ownerId = randomUUID();

beforeAll(async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  await new UserRepository(getPool()).upsert({ id: ownerId, email: null });
});

afterAll(async () => {
  await getPool().end();
});

describe('when Redis is down', () => {
  const service = new LinkService(new LinkRepository(getPool()), deadRedis);

  it('still creates, resolves, lists and deletes links from Postgres', async () => {
    const longUrl = `https://example.com/redis-down/${Date.now()}`;
    const { link, created } = await service.create({ ownerId, longUrl });
    expect(created).toBe(true);

    expect(await service.resolve(link.code)).toBe(longUrl);
    expect((await service.list(ownerId)).links.map((l) => l.code)).toContain(link.code);
    expect((await service.get(ownerId, link.code))?.clickCount).toBe(0);

    expect(await service.delete(ownerId, link.code)).toBe(true);
    expect(await service.resolve(link.code)).toBeNull();
  });

  it('does not wait on a Redis that never answers (e.g. still logging in)', async () => {
    const hang = () => new Promise<never>(() => {});
    const hangingPipeline = { incr: () => hangingPipeline, expire: () => hangingPipeline, ttl: () => hangingPipeline, exec: hang };
    const hangingRedis = new Proxy({} as Redis, {
      get: (_target, prop) => (prop === 'multi' ? () => hangingPipeline : hang),
    });
    const slowService = new LinkService(new LinkRepository(getPool()), hangingRedis);

    const longUrl = `https://example.com/redis-slow/${Date.now()}`;
    const { link } = await slowService.create({ ownerId, longUrl });

    const start = performance.now();
    expect(await slowService.resolve(link.code)).toBe(longUrl);
    // One 500ms cache read, then Postgres; the cache write is skipped.
    expect(performance.now() - start).toBeLessThan(1_500);

    expect((await rateLimit(hangingRedis, 'anyone', 10, 60)).allowed).toBe(true);
  });

  it('lets link creation through instead of rate limiting everyone', async () => {
    expect(await rateLimit(deadRedis, 'anyone', 10, 60)).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });
});

describe('connectionConfig', () => {
  const PEM = '-----BEGIN CERTIFICATE-----\\nabc\\n-----END CERTIFICATE-----';

  it('uses the URL as-is without a CA certificate', () => {
    expect(connectionConfig('postgres://u:p@localhost:5433/db')).toEqual({
      connectionString: 'postgres://u:p@localhost:5433/db',
    });
  });

  it('verifies the server certificate and strips URL SSL params that would override it', () => {
    const config = connectionConfig(
      'postgres://u:p@aws-1.pooler.supabase.com:6543/postgres?sslmode=require&application_name=axl',
      PEM,
    );
    expect(config.connectionString).toBe(
      'postgres://u:p@aws-1.pooler.supabase.com:6543/postgres?application_name=axl',
    );
    expect(config.ssl).toEqual({
      ca: '-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----',
      rejectUnauthorized: true,
    });
  });
});
