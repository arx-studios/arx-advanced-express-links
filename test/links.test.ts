import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Outside a real Next request there is no `after()` context. Collect the tasks
// instead so tests can await them.
const { pendingAfter } = vi.hoisted(() => ({ pendingAfter: [] as Promise<unknown>[] }));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (task: Promise<unknown> | (() => unknown)) => {
    pendingAfter.push(Promise.resolve(typeof task === 'function' ? task() : task));
  },
}));

import { GET as redirect } from '@/app/[code]/route';
import { POST } from '@/app/api/links/route';
import { getPool } from '@/server/db';
import { getLinkRepository } from '@/server/links';
import { flushClicks } from '@/server/links/clickFlush';
import { getRedis } from '@/server/redis';

const uniqueUrl = (path: string) => `https://example.com/${path}/${Date.now()}-${Math.random()}`;

function createLink(payload: unknown) {
  return POST(
    new Request('http://localhost:3000/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof payload === 'string' ? payload : JSON.stringify(payload),
    }),
  );
}

function visit(code: string) {
  return redirect(new Request(`http://localhost:3000/${code}`), {
    params: Promise.resolve({ code }),
  });
}

beforeAll(async () => {
  await getRedis().flushdb();
});

afterAll(async () => {
  await Promise.all(pendingAfter);
  await getPool().end();
  getRedis().disconnect();
});

describe('links API', () => {
  it('creates a link and redirects to it', async () => {
    const url = uniqueUrl('hello');
    const create = await createLink({ url });
    expect(create.status).toBe(201);
    const { code, shortUrl } = await create.json();
    expect(shortUrl).toBe(`http://localhost:3000/${code}`);

    const res = await visit(code);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(url);
  });

  it('returns the same code when the same URL is shortened twice', async () => {
    const url = uniqueUrl('dedupe');
    const first = await createLink({ url });
    const second = await createLink({ url });

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect((await second.json()).code).toBe((await first.json()).code);
  });

  it('gives each concurrent request for a new URL the same code', async () => {
    const url = uniqueUrl('race');
    const results = await Promise.all([createLink({ url }), createLink({ url }), createLink({ url })]);
    const bodies = await Promise.all(results.map((r) => r.json()));

    expect(new Set(bodies.map((b) => b.code)).size).toBe(1);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
  });

  it('does not dedupe links with an alias or an expiry', async () => {
    const url = uniqueUrl('no-dedupe');
    const plain = await createLink({ url });
    const aliased = await createLink({ url, alias: `a-${Date.now()}` });
    const expiring = await createLink({
      url,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    });

    expect([aliased.status, expiring.status]).toEqual([201, 201]);
    const codes = await Promise.all([plain, aliased, expiring].map(async (r) => (await r.json()).code));
    expect(new Set(codes).size).toBe(3);
  });

  it('returns 409 when an alias is taken', async () => {
    const alias = `test-${Date.now()}`;
    expect((await createLink({ url: 'https://example.com', alias })).status).toBe(201);
    expect((await createLink({ url: 'https://example.com', alias })).status).toBe(409);
  });

  it('rejects bad input', async () => {
    expect((await createLink({ url: 'nope' })).status).toBe(400);
    expect((await createLink({ url: 'javascript:alert(1)' })).status).toBe(400);
    expect((await createLink({ url: 'http://localhost:3000/x' })).status).toBe(400);
    expect((await createLink({ url: 'https://a.com', alias: 'dashboard' })).status).toBe(400);
    expect((await createLink({ url: 'https://a.com', expiresAt: '2000-01-01' })).status).toBe(400);
    expect((await createLink('{not json')).status).toBe(400);
  });

  it('returns 404 for unknown or malformed codes', async () => {
    expect((await visit('doesNotExist1')).status).toBe(404);
    expect((await visit('favicon.ico')).status).toBe(404);
  });

  it('counts clicks and flushes them to Postgres', async () => {
    const { code } = await (await createLink({ url: uniqueUrl('clicks') })).json();

    await visit(code);
    await visit(code);
    await Promise.all(pendingAfter);
    await flushClicks(getRedis(), getLinkRepository());

    const link = await getLinkRepository().findByCode(code);
    expect(link?.clickCount).toBe(2);
  });
});
