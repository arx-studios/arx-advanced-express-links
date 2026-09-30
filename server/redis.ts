import 'server-only';
import { Redis } from 'ioredis';
import { env } from './env';

const globalForRedis = globalThis as typeof globalThis & { axlRedis?: Redis };

export function getRedis(): Redis {
  globalForRedis.axlRedis ??= new Redis(env().REDIS_URL, {
    // Fail fast when Redis is unreachable so callers can fall back to Postgres
    // instead of a request hanging on reconnects.
    // Commands issued before the first connect wait in the offline queue (cold
    // starts), bounded by commandTimeout. App and Redis share a region, so a
    // healthy command takes milliseconds.
    maxRetriesPerRequest: 2,
    connectTimeout: 3_000,
    commandTimeout: 500,
  });
  return globalForRedis.axlRedis;
}
