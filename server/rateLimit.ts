import type { Redis } from 'ioredis';
import { withTimeout } from '@/lib/timeout';

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
  let results;
  try {
    results = await withTimeout(
      redis.multi().incr(bucket).expire(bucket, windowSeconds, 'NX').ttl(bucket).exec(),
      1_000,
      'rate limit check',
    );
  } catch (err) {
    // Fail open: every caller is signed in, and a slow or unreachable Redis
    // shouldn't stop everyone from creating links.
    console.warn(`rate limit check skipped, allowing request: ${err instanceof Error ? err.message : err}`);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const count = Number(results?.[0]?.[1]);
  const ttl = Number(results?.[2]?.[1]);
  return { allowed: count <= limit, retryAfterSeconds: ttl > 0 ? ttl : windowSeconds };
}

// Vercel puts the real client IP first in x-forwarded-for; locally it's absent.
export function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}
