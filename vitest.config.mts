import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: root },
      // `server-only` throws outside Next's server bundle; tests import server code directly.
      { find: 'server-only', replacement: `${root}test/stubs/server-only.ts` },
    ],
  },
  test: {
    // Matches docker-compose.yml. Redis DB 1 keeps test keys away from the dev server's DB 0.
    env: {
      BASE_URL: 'http://localhost:3000',
      DATABASE_URL: 'postgres://axl:axl@localhost:5433/axl',
      REDIS_URL: 'redis://localhost:6379/1',
      CREATE_LINKS_PER_MINUTE: '1000',
    },
  },
});
