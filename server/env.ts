import 'server-only';
import { z } from 'zod';

const EnvSchema = z.object({
  BASE_URL: z.url(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  CREATE_LINKS_PER_MINUTE: z.coerce.number().int().positive().default(10),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

// Parsed on first use rather than at import: `next build` imports route modules,
// and runtime secrets aren't necessarily present at build time.
export function env(): Env {
  cached ??= EnvSchema.parse(process.env);
  return cached;
}
