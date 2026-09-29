import type { Redis } from 'ioredis';

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

// Fixed window: at most `limit` hits per `windowSeconds` for each key. The
// counter and its expiry are set in one MULTI so a key can never be left
// without a TTL (which would block that client forever).
export async function rateLimit(
  redis: Redis,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const bucket = `ratelimit:${key}`;
  const results = await redis
    .multi()
    .incr(bucket)
    .expire(bucket, windowSeconds, 'NX')
    .ttl(bucket)
    .exec();

  const count = Number(results?.[0]?.[1]);
  const ttl = Number(results?.[2]?.[1]);
  return { allowed: count <= limit, retryAfterSeconds: ttl > 0 ? ttl : windowSeconds };
}

// Vercel puts the real client IP first in x-forwarded-for; locally it's absent.
export function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}
