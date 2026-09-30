import 'server-only';
import { Redis } from 'ioredis';
import { env } from './env';

const globalForRedis = globalThis as typeof globalThis & { axlRedis?: Redis };

export function getRedis(): Redis {
  if (!globalForRedis.axlRedis) {
    const redis = new Redis(env().REDIS_URL, {
      // Commands issued before the first connect wait in the offline queue (cold
      // starts), bounded by commandTimeout. App and Redis share a region, so a
      // healthy command takes milliseconds.
      maxRetriesPerRequest: 2,
      connectTimeout: 3_000,
      commandTimeout: 500,
    });
    // Without a listener ioredis prints every connection or timeout error as an
    // "Unhandled error event" stack trace. Callers already fall back to Postgres.
    redis.on('error', (err) => console.warn(`redis: ${err.message}`));
    globalForRedis.axlRedis = redis;
  }
  return globalForRedis.axlRedis;
}
