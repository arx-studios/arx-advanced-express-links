import 'server-only';
import { z } from 'zod';

const EnvSchema = z.object({
  BASE_URL: z.url(),
  DATABASE_URL: z.string().min(1),
  // PEM certificate for verifying the database's TLS certificate (Supabase).
  DATABASE_CA_CERT: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1),
  CREATE_LINKS_PER_MINUTE: z.coerce.number().int().positive().default(10),
  // Shared secret Vercel Cron sends as "Authorization: Bearer <CRON_SECRET>".
  CRON_SECRET: z.string().min(16).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

// Parsed on first use rather than at import: `next build` imports route modules,
// and runtime secrets aren't necessarily present at build time.
export function env(): Env {
  cached ??= EnvSchema.parse(process.env);
  return cached;
}
