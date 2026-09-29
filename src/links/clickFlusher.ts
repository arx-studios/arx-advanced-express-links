import type { FastifyBaseLogger } from 'fastify';
import type { Redis } from 'ioredis';
import type { LinkRepository } from './linkRepository.js';

const PREFIX = 'clicks:';

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

export function startClickFlusher(
  redis: Redis,
  repo: LinkRepository,
  log: FastifyBaseLogger,
  intervalMs = 10_000,
): () => void {
  let running = false;

  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await flushClicks(redis, repo);
    } catch (err) {
      log.error({ err }, 'click flush failed');
    } finally {
      running = false;
    }
  }, intervalMs);

  return () => clearInterval(timer);
}
