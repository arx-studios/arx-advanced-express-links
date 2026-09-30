import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { GET as keepalive } from '@/app/api/cron/keepalive/route';
import { getPool } from '@/server/db';
import { getLinkRepository } from '@/server/links';
import { getRedis } from '@/server/redis';
import { UserRepository } from '@/server/users/userRepository';

const SECRET = 'Bearer test-cron-secret-0123456789';

const call = (authorization?: string) =>
  keepalive(
    new Request('http://localhost:3000/api/cron/keepalive', {
      headers: authorization ? { Authorization: authorization } : {},
    }),
  );

// Stands in for the auth project's REST API (no network in tests).
function mockAuthProject(status: number, body: unknown) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await getPool().end();
  getRedis().disconnect();
});

describe('keepalive cron', () => {
  it('rejects calls without the right secret', async () => {
    const fetchSpy = mockAuthProject(200, '2026-10-01T03:00:00Z');
    expect((await call()).status).toBe(401);
    expect((await call('Bearer wrong-secret')).status).toBe(401);
    expect((await call('test-cron-secret-0123456789')).status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('touches both Supabase projects and Redis, and flushes buffered clicks', async () => {
    const fetchSpy = mockAuthProject(200, '2026-10-01T03:00:00Z');
    const ownerId = randomUUID();
    await new UserRepository(getPool()).upsert({ id: ownerId, email: null });
    const code = `ka${Date.now()}`;
    await getLinkRepository().insert({ code, longUrl: 'https://example.com', ownerId, expiresAt: null });
    await getRedis().set(`clicks:${code}`, '4');

    const res = await call(SECRET);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      postgres: 'ok',
      authProject: 'ok',
      authProjectPingedAt: '2026-10-01T03:00:00Z',
      redis: 'ok',
    });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://auth-project.test/rest/v1/rpc/keepalive');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>).apikey).toBe('sb_publishable_test');

    expect((await getLinkRepository().findByCode(code))?.clickCount).toBe(4);
    expect(await getRedis().get(`clicks:${code}`)).toBeNull();
  });

  it('fails the run when the auth project ping fails, so it shows in cron logs', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockAuthProject(404, { message: 'Could not find the function public.keepalive' });

    const res = await call(SECRET);
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ postgres: 'ok', authProject: 'error' });
  });
});
