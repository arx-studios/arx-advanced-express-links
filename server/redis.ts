import 'server-only';
import { Redis } from 'ioredis';
import { env } from './env';

const globalForRedis = globalThis as typeof globalThis & { axlRedis?: Redis };

export function getRedis(): Redis {
  if (!globalForRedis.axlRedis) {
    const redis = new Redis(env().REDIS_URL, {
      // Deliberately no commandTimeout: ioredis applies it to the AUTH it sends
      // on connect, and Render's external endpoint takes 2-5s to accept AUTH,
      // so every connection attempt would time out and reconnect forever.
      // Callers that need to be fast bound their own waits (lib/timeout.ts).
      maxRetriesPerRequest: 2,
      connectTimeout: 10_000,
    });
    // Without a listener ioredis prints every connection error as an
    // "Unhandled error event" stack trace. Callers already fall back to Postgres.
    redis.on('error', (err) => console.warn(`redis: ${err.message}`));
    globalForRedis.axlRedis = redis;
  }
  return globalForRedis.axlRedis;
}
