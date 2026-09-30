import 'server-only';
import { attachDatabasePool } from '@vercel/functions';
import pg from 'pg';
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

const SSL_PARAMS = ['sslmode', 'ssl', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat'];

// With a CA certificate (Supabase), the connection is encrypted and the
// server's certificate verified against it. pg lets SSL settings inside the
// URL override the `ssl` option, so they're stripped when a CA is given.
// Without one (local docker), the URL is used as-is.
export function connectionConfig(databaseUrl: string, caCert?: string): pg.PoolConfig {
  if (!caCert) return { connectionString: databaseUrl };

  const url = new URL(databaseUrl);
  for (const param of SSL_PARAMS) url.searchParams.delete(param);

  return {
    connectionString: url.toString(),
    // Env var UIs sometimes store the PEM with literal "\n" sequences.
    ssl: { ca: caCert.replace(/\\n/g, '\n'), rejectUnauthorized: true },
  };
}
