import type { Redis } from 'ioredis';
import type { LinkRepository } from './linkRepository';

const PREFIX = 'clicks:';
const LOCK_KEY = 'lock:click-flush';
const FLUSH_INTERVAL_SECONDS = 10;

export async function flushClicks(redis: Redis, repo: LinkRepository): Promise<void> {
  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', `${PREFIX}*`, 'COUNT', 100);
    cursor = next;

    for (const key of keys) {
      const count = await redis.getdel(key);
      if (count) await repo.incrementClicks(key.slice(PREFIX.length), Number(count));
    }
  } while (cursor !== '0');
}

// Serverless functions have no background timers, so redirects take turns:
// whichever request wins the lock flushes, at most once per interval. The lock
// is left to expire rather than released, which is what spaces the flushes out.
export async function maybeFlushClicks(redis: Redis, repo: LinkRepository): Promise<boolean> {
  const acquired = await redis.set(LOCK_KEY, '1', 'EX', FLUSH_INTERVAL_SECONDS, 'NX');
  if (acquired !== 'OK') return false;

  await flushClicks(redis, repo);
  return true;
}
