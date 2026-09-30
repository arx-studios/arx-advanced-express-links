import type { PoolConfig } from 'pg';

const SSL_PARAMS = ['sslmode', 'ssl', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat'];

// With a CA certificate (Supabase), the connection is encrypted and the
// server's certificate verified against it. pg lets SSL settings inside the
// URL override the `ssl` option, so they're stripped when a CA is given.
// Without one (local docker), the URL is used as-is.
//
// Shared by the app (server/db.ts) and the migration script.
export function connectionConfig(databaseUrl: string, caCert?: string): PoolConfig {
  if (!caCert) return { connectionString: databaseUrl };

  const url = new URL(databaseUrl);
  for (const param of SSL_PARAMS) url.searchParams.delete(param);

  return {
    connectionString: url.toString(),
    // Env var UIs sometimes store the PEM with literal "\n" sequences.
    ssl: { ca: caCert.replace(/\\n/g, '\n'), rejectUnauthorized: true },
  };
}
