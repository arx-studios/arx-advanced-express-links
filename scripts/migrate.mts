import { readdir, readFile } from 'node:fs/promises';
import pg from 'pg';
import { connectionConfig } from '../lib/pgConnection';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

// A CA certificate turns on verified TLS (Supabase). Locally it's easiest to
// point at the downloaded file; on a server the PEM itself can be in the env.
const caFile = process.env.DATABASE_CA_CERT_FILE;
const caCert = caFile ? await readFile(caFile, 'utf8') : process.env.DATABASE_CA_CERT;

const client = new pg.Client(connectionConfig(process.env.DATABASE_URL, caCert));
await client.connect();
console.log(`connected to ${new URL(process.env.DATABASE_URL).host}${caCert ? ' (verified TLS)' : ''}`);

await client.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name       TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);
// Keep Supabase's Data API away from this table too (see 001_init.sql).
await client.query('ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY');

const { rows } = await client.query<{ name: string }>('SELECT name FROM schema_migrations');
const applied = new Set(rows.map((r) => r.name));

const dir = new URL('../migrations/', import.meta.url);
const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

for (const file of files) {
  if (applied.has(file)) continue;

  const sql = await readFile(new URL(file, dir), 'utf8');
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    await client.query('COMMIT');
    console.log(`applied ${file}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

console.log('migrations up to date');
await client.end();
