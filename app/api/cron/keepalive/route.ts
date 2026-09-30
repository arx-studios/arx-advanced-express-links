import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { env } from '@/server/env';
import { getPool } from '@/server/db';
import { getLinkRepository } from '@/server/links';
import { flushClicks } from '@/server/links/clickFlush';
import { getRedis } from '@/server/redis';

export const dynamic = 'force-dynamic';

// Called once a day by Vercel Cron (see vercel.json).
// - Queries Postgres so the free Supabase project never counts as inactive
//   (free projects pause after a week without activity).
// - Flushes click counts still buffered in Redis. Normally a later redirect
//   flushes them; on a quiet day nothing would, and a Redis restart would lose them.
// - Pings Redis as a daily health check.
export async function GET(request: Request) {
  if (!isAuthorized(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result: Record<string, unknown> = {};

  try {
    const { rows } = await getPool().query<{ links: number }>('SELECT count(*)::int AS links FROM links');
    result.postgres = 'ok';
    result.links = rows[0].links;
  } catch (err) {
    console.error('keepalive: postgres failed', err);
    return NextResponse.json({ postgres: 'error' }, { status: 500 });
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

  return NextResponse.json(result);
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
