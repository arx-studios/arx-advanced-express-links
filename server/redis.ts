import 'server-only';
import { Redis } from 'ioredis';
import { env } from './env';

const globalForRedis = globalThis as typeof globalThis & { axlRedis?: Redis };

export function getRedis(): Redis {
  globalForRedis.axlRedis ??= new Redis(env().REDIS_URL, {
    // Fail a request quickly when Redis is unreachable instead of hanging it.
    maxRetriesPerRequest: 2,
  });
  return globalForRedis.axlRedis;
}
