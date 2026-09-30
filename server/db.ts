import 'server-only';
import { attachDatabasePool } from '@vercel/functions';
import pg from 'pg';
import { connectionConfig } from '@/lib/pgConnection';
import { env } from './env';

// Stored on globalThis so Next's dev hot reload reuses the pool instead of
// opening a new one on every file save.
const globalForDb = globalThis as typeof globalThis & { axlPgPool?: pg.Pool };

export function getPool(): pg.Pool {
  if (!globalForDb.axlPgPool) {
    const pool = new pg.Pool({
      ...connectionConfig(env().DATABASE_URL, env().DATABASE_CA_CERT),
      max: 5,
      idleTimeoutMillis: 10_000,
    });
    // On Vercel, closes idle connections before the function instance is suspended.
    attachDatabasePool(pool);
    globalForDb.axlPgPool = pool;
  }
  return globalForDb.axlPgPool;
}
