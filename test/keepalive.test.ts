import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { GET as keepalive } from '@/app/api/cron/keepalive/route';
import { getPool } from '@/server/db';
import { getLinkRepository } from '@/server/links';
import { getRedis } from '@/server/redis';
import { UserRepository } from '@/server/users/userRepository';

const call = (authorization?: string) =>
  keepalive(
    new Request('http://localhost:3000/api/cron/keepalive', {
      headers: authorization ? { Authorization: authorization } : {},
    }),
  );

afterAll(async () => {
  await getPool().end();
  getRedis().disconnect();
});

describe('keepalive cron', () => {
  it('rejects calls without the right secret', async () => {
    expect((await call()).status).toBe(401);
    expect((await call('Bearer wrong-secret')).status).toBe(401);
    expect((await call('test-cron-secret-0123456789')).status).toBe(401);
  });

  it('touches Postgres and Redis, and flushes buffered clicks', async () => {
    const ownerId = randomUUID();
    await new UserRepository(getPool()).upsert({ id: ownerId, email: null });
    const code = `ka${Date.now()}`;
    await getLinkRepository().insert({ code, longUrl: 'https://example.com', ownerId, expiresAt: null });
    await getRedis().set(`clicks:${code}`, '4');

    const res = await call('Bearer test-cron-secret-0123456789');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.postgres).toBe('ok');
    expect(body.redis).toBe('ok');
    expect(body.links).toBeGreaterThan(0);

    expect((await getLinkRepository().findByCode(code))?.clickCount).toBe(4);
    expect(await getRedis().get(`clicks:${code}`)).toBeNull();
  });
});
