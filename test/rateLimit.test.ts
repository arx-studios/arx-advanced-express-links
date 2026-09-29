import { Redis } from 'ioredis';
import { afterAll, describe, expect, it } from 'vitest';
import { clientIp, rateLimit } from '@/server/rateLimit';

const redis = new Redis('redis://localhost:6379/1');

afterAll(() => {
  redis.disconnect();
});

describe('rateLimit', () => {
  it('allows up to the limit, then blocks with a retry time', async () => {
    const key = `test:${Date.now()}-${Math.random()}`;

    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rateLimit(redis, key, 3, 60));

    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results[3].retryAfterSeconds).toBeGreaterThan(0);
    expect(results[3].retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('always leaves the counter with an expiry', async () => {
    const key = `test:${Date.now()}-${Math.random()}`;
    await rateLimit(redis, key, 3, 60);
    expect(await redis.ttl(`ratelimit:${key}`)).toBeGreaterThan(0);
  });
});

describe('clientIp', () => {
  it('uses the first x-forwarded-for entry', () => {
    const req = new Request('http://x', { headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' } });
    expect(clientIp(req)).toBe('1.2.3.4');
  });

  it('falls back when the header is missing', () => {
    expect(clientIp(new Request('http://x'))).toBe('local');
  });
});
