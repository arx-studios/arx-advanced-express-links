import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@/server/auth';

// Outside a real Next request there is no `after()` context, and no Supabase
// session. Collect after() tasks so tests can await them, and let each test
// pick who is "signed in".
const state = vi.hoisted(() => ({
  pendingAfter: [] as Promise<unknown>[],
  user: null as AuthUser | null,
}));

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (task: Promise<unknown> | (() => unknown)) => {
    state.pendingAfter.push(Promise.resolve(typeof task === 'function' ? task() : task));
  },
}));

vi.mock('@/server/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/auth')>()),
  getUser: async () => state.user,
}));

import { GET as redirect } from '@/app/[code]/route';
import { DELETE as deleteLink, GET as getLink } from '@/app/api/links/[code]/route';
import { GET as listLinks, POST } from '@/app/api/links/route';
import { GET as me } from '@/app/api/me/route';
import { getPool } from '@/server/db';
import { getLinkRepository } from '@/server/links';
import { flushClicks } from '@/server/links/clickFlush';
import { getRedis } from '@/server/redis';

const alice: AuthUser = { id: randomUUID(), email: 'alice@example.com' };
const bob: AuthUser = { id: randomUUID(), email: 'bob@example.com' };

const uniqueUrl = (path: string) => `https://example.com/${path}/${Date.now()}-${Math.random()}`;
const params = (code: string) => ({ params: Promise.resolve({ code }) });

function signIn(user: AuthUser | null) {
  state.user = user;
}

function createLink(payload: unknown) {
  return POST(
    new Request('http://localhost:3000/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof payload === 'string' ? payload : JSON.stringify(payload),
    }),
  );
}

async function createCode(payload: unknown): Promise<string> {
  const res = await createLink(payload);
  expect(res.status).toBe(201);
  return (await res.json()).code;
}

const visit = (code: string) => redirect(new Request(`http://localhost:3000/${code}`), params(code));
const list = (cursor?: string) =>
  listLinks(new Request(`http://localhost:3000/api/links${cursor ? `?cursor=${cursor}` : ''}`));
const details = (code: string) => getLink(new Request('http://localhost:3000'), params(code));
const remove = (code: string) => deleteLink(new Request('http://localhost:3000'), params(code));

beforeAll(async () => {
  await getRedis().flushdb();
});

beforeEach(() => {
  signIn(alice);
});

afterAll(async () => {
  await Promise.all(state.pendingAfter);
  await getPool().end();
  getRedis().disconnect();
});

describe('authentication', () => {
  it('rejects every API call when signed out', async () => {
    signIn(null);
    expect((await createLink({ url: 'https://example.com' })).status).toBe(401);
    expect((await list()).status).toBe(401);
    expect((await details('anything')).status).toBe(401);
    expect((await remove('anything')).status).toBe(401);
    expect((await me()).status).toBe(401);
  });

  it('returns the signed-in user', async () => {
    expect(await (await me()).json()).toEqual(alice);
  });

  it('lets anyone follow a short link without signing in', async () => {
    const url = uniqueUrl('public');
    const code = await createCode({ url });

    signIn(null);
    const res = await visit(code);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(url);
  });
});

describe('creating links', () => {
  it('returns the same code when a user shortens the same URL twice', async () => {
    const url = uniqueUrl('dedupe');
    const first = await createLink({ url });
    const second = await createLink({ url });

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect((await second.json()).code).toBe((await first.json()).code);
  });

  it('gives different users their own code for the same URL', async () => {
    const url = uniqueUrl('per-user');
    const aliceCode = await createCode({ url });
    signIn(bob);
    const bobCode = await createCode({ url });

    expect(bobCode).not.toBe(aliceCode);
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
    const plain = await createCode({ url });
    const aliased = await createCode({ url, alias: `a-${Date.now()}` });
    const expiring = await createCode({
      url,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    });

    expect(new Set([plain, aliased, expiring]).size).toBe(3);
  });

  it('returns 409 when an alias is taken, even by another user', async () => {
    const alias = `test-${Date.now()}`;
    await createCode({ url: 'https://example.com', alias });
    signIn(bob);
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
});

describe('listing and details', () => {
  it("lists only the signed-in user's links, newest first, with pagination", async () => {
    const user: AuthUser = { id: randomUUID(), email: null };
    signIn(user);
    const codes = [];
    for (let i = 0; i < 25; i++) codes.push(await createCode({ url: uniqueUrl(`list-${i}`) }));

    const page1 = await (await list()).json();
    expect(page1.links).toHaveLength(20);
    expect(page1.links[0].code).toBe(codes[24]);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await (await list(page1.nextCursor)).json();
    expect(page2.links.map((l: { code: string }) => l.code)).toEqual(codes.slice(0, 5).reverse());
    expect(page2.nextCursor).toBeNull();

    signIn(bob);
    const bobsLinks = (await (await list()).json()).links.map((l: { code: string }) => l.code);
    expect(bobsLinks).not.toContain(codes[0]);
  });

  it('rejects a malformed cursor', async () => {
    expect((await list('1; DROP TABLE links')).status).toBe(400);
  });

  it("hides another user's link details", async () => {
    const code = await createCode({ url: uniqueUrl('private') });
    signIn(bob);
    expect((await details(code)).status).toBe(404);
  });

  it('counts clicks, including ones still buffered in Redis', async () => {
    const code = await createCode({ url: uniqueUrl('clicks') });

    await visit(code);
    await visit(code);
    await Promise.all(state.pendingAfter);
    expect((await (await details(code)).json()).clickCount).toBe(2);

    await flushClicks(getRedis(), getLinkRepository());
    expect((await (await details(code)).json()).clickCount).toBe(2);
  });
});

describe('deleting links', () => {
  it('stops the short link working immediately, even when cached', async () => {
    const code = await createCode({ url: uniqueUrl('delete') });
    expect((await visit(code)).status).toBe(302); // warms the cache

    expect((await remove(code)).status).toBe(204);
    expect((await visit(code)).status).toBe(404);
    expect((await details(code)).status).toBe(404);
  });

  it("does not let a user delete someone else's link", async () => {
    const code = await createCode({ url: uniqueUrl('not-yours') });
    signIn(bob);
    expect((await remove(code)).status).toBe(404);

    signIn(alice);
    expect((await visit(code)).status).toBe(302);
  });

  it('never frees a deleted code for reuse', async () => {
    const alias = `gone-${Date.now()}`;
    await createCode({ url: 'https://example.com', alias });
    await remove(alias);

    signIn(bob);
    expect((await createLink({ url: 'https://evil.example', alias })).status).toBe(409);
  });

  it('gives a fresh code when the same URL is shortened after deleting it', async () => {
    const url = uniqueUrl('recreate');
    const first = await createCode({ url });
    await remove(first);

    const second = await createCode({ url });
    expect(second).not.toBe(first);
  });
});
