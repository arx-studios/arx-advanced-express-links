import Fastify from 'fastify';
import type { Redis } from 'ioredis';
import type { Pool } from 'pg';
import { LinkRepository } from './links/linkRepository.js';
import { linkRoutes } from './links/linkRoutes.js';
import { LinkService } from './links/linkService.js';
import rateLimit from '@fastify/rate-limit';
import { readFileSync } from 'node:fs';

const indexHtml = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

export interface AppDeps {
  pool: Pool;
  redis: Redis;
  baseUrl: string;
  logger?: boolean;
  createLinksPerMinute?: number;
}

export function buildApp(deps: AppDeps) {
  const app = Fastify({ logger: deps.logger ?? true });
  const service = new LinkService(new LinkRepository(deps.pool), deps.redis);
  
  app.register(rateLimit, { global: false, redis: deps.redis });
  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/', async (_request, reply) => reply.type('text/html').send(indexHtml));
  app.register(linkRoutes, {
    service,
    baseUrl: deps.baseUrl,
    createLinksPerMinute: deps.createLinksPerMinute ?? 10,
  });

  return app;
}
