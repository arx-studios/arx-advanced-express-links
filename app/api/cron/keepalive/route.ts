import { timingSafeEqual } from 'node:crypto';
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
  let failed = false;

  try {
    const { rows } = await getPool().query<{ links: number }>('SELECT count(*)::int AS links FROM links');
    result.postgres = 'ok';
    result.links = rows[0].links;
  } catch (err) {
    console.error('keepalive: postgres failed', err);
    result.postgres = 'error';
    failed = true;
  }

  try {
    result.authProject = 'ok';
    result.authProjectPingedAt = await pingAuthProject();
  } catch (err) {
    console.error('keepalive: auth project failed', err);
    result.authProject = 'error';
    failed = true;
  }

  try {
    await getRedis().ping();
    await flushClicks(getRedis(), getLinkRepository());
    result.redis = 'ok';
  } catch (err) {
    // Redis is only a cache: report it, but the keep-alive itself succeeded.
    console.error('keepalive: redis failed', err);
    result.redis = 'error';
  }

  // A failed Supabase ping shows up as a failed run in Vercel's cron logs.
  return NextResponse.json(result, { status: failed ? 500 : 200 });
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
