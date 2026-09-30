import { timingSafeEqual } from 'node:crypto';
import type { Redis } from 'ioredis';
import { NextResponse } from 'next/server';
import { env } from '@/server/env';
import { getPool } from '@/server/db';
import { getLinkRepository } from '@/server/links';
import { flushClicks } from '@/server/links/clickFlush';
import { getRedis } from '@/server/redis';

export const dynamic = 'force-dynamic';

// Called once a day by Vercel Cron (see vercel.json). Free Supabase projects
// pause after a week without *database* activity, and axl depends on two:
// - Queries axl's own Postgres (arxExpressLinks).
// - Calls the keepalive() function in the ARX Studios auth project, which
//   writes a one-row heartbeat. It goes through that project's public API with
//   the publishable key, so axl needs no credentials for its database.
// - Flushes click counts still buffered in Redis. Normally a later redirect
//   flushes them; on a quiet day nothing would, and a Redis restart would lose them.
// - Pings Redis as a daily health check.
export async function GET(request: Request) {
  if (!isAuthorized(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result: Record<string, unknown> = {};
  const timingsMs: Record<string, number> = {};

  // Runs a step, records how long it took, and reports failure instead of throwing.
  async function step(name: string, fn: () => Promise<void>): Promise<boolean> {
    const start = performance.now();
    try {
      await fn();
      result[name] = 'ok';
      return true;
    } catch (err) {
      console.error(`keepalive: ${name} failed`, err);
      result[name] = 'error';
      return false;
    } finally {
      timingsMs[name] = Math.round(performance.now() - start);
    }
  }

  const postgresOk = await step('postgres', async () => {
    const { rows } = await getPool().query<{ links: number }>('SELECT count(*)::int AS links FROM links');
    result.links = rows[0].links;
  });

  const authOk = await step('authProject', async () => {
    result.authProjectPingedAt = await pingAuthProject();
  });

  // Redis is only a cache: a failure is reported but doesn't fail the run.
  // A cron run usually lands on a fresh instance, so give the TLS connection
  // time to open instead of hitting the 500ms per-command limit meant for redirects.
  await step('redis', async () => {
    const redis = getRedis();
    await waitUntilReady(redis, 5_000);
    await redis.ping();
    await flushClicks(redis, getLinkRepository());
  });

  const failed = !postgresOk || !authOk;
  result.timingsMs = timingsMs;
  // Shows up in Vercel's runtime logs, since cron responses aren't displayed there.
  console.log('keepalive', JSON.stringify(result));

  // A failed Supabase ping shows up as a failed run in Vercel's cron logs.
  return NextResponse.json(result, { status: failed ? 500 : 200 });
}

function waitUntilReady(redis: Redis, timeoutMs: number): Promise<void> {
  if (redis.status === 'ready') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      redis.off('ready', onReady);
      reject(new Error(`Redis not ready after ${timeoutMs}ms (status: ${redis.status})`));
    }, timeoutMs);
    const onReady = () => {
      clearTimeout(timer);
      resolve();
    };
    redis.once('ready', onReady);
  });
}

async function pingAuthProject(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY not set');

  const res = await fetch(`${url}/rest/v1/rpc/keepalive`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`keepalive rpc returned ${res.status}: ${await res.text()}`);
  return res.json();
}

// Vercel sends "Authorization: Bearer <CRON_SECRET>". Without a configured
// secret the endpoint stays closed.
function isAuthorized(header: string | null): boolean {
  const secret = env().CRON_SECRET;
  if (!secret || !header) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
