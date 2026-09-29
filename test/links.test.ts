import { Redis } from 'ioredis';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://axl:axl@localhost:5433/axl',
});
// Redis DB 1 keeps test cache and rate-limit counters away from the dev server's DB 0.
const redis = new Redis(process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/1');
const app = buildApp({
  pool,
  redis,
  baseUrl: 'http://localhost:3000',
  logger: false,
  createLinksPerMinute: 1000,
});

const uniqueUrl = (path: string) => `https://example.com/${path}/${Date.now()}-${Math.random()}`;

function createLink(payload: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: '/api/links', payload });
}

beforeAll(async () => {
  await redis.flushdb();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await pool.end();
  redis.disconnect();
});

describe('links API', () => {
  it('creates a link and redirects to it', async () => {
    const url = uniqueUrl('hello');
    const create = await createLink({ url });
    expect(create.statusCode).toBe(201);
    const { code } = create.json();

    const redirect = await app.inject({ method: 'GET', url: `/${code}` });
    expect(redirect.statusCode).toBe(302);
    expect(redirect.headers.location).toBe(url);
  });

  it('returns the same code when the same URL is shortened twice', async () => {
    const url = uniqueUrl('dedupe');
    const first = await createLink({ url });
    const second = await createLink({ url });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.json().code).toBe(first.json().code);
  });

  it('gives each concurrent request for a new URL the same code', async () => {
    const url = uniqueUrl('race');
    const results = await Promise.all([createLink({ url }), createLink({ url }), createLink({ url })]);

    expect(new Set(results.map((r) => r.json().code)).size).toBe(1);
    expect(results.filter((r) => r.statusCode === 201)).toHaveLength(1);
  });

  it('does not dedupe links with an alias or an expiry', async () => {
    const url = uniqueUrl('no-dedupe');
    const plain = await createLink({ url });
    const aliased = await createLink({ url, alias: `a-${Date.now()}` });
    const expiring = await createLink({ url, expiresAt: new Date(Date.now() + 3_600_000).toISOString() });

    expect([aliased.statusCode, expiring.statusCode]).toEqual([201, 201]);
    const codes = new Set([plain, aliased, expiring].map((r) => r.json().code));
    expect(codes.size).toBe(3);
  });

  it('rejects an invalid URL', async () => {
    const res = await createLink({ url: 'nope' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 409 when an alias is taken', async () => {
    const alias = `test-${Date.now()}`;
    const first = await createLink({ url: 'https://example.com', alias });
    expect(first.statusCode).toBe(201);

    const second = await createLink({ url: 'https://example.com', alias });
    expect(second.statusCode).toBe(409);
  });

  it('returns 404 for unknown codes', async () => {
    const res = await app.inject({ method: 'GET', url: '/doesNotExist1' });
    expect(res.statusCode).toBe(404);
  });
});
