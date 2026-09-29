import { Redis } from 'ioredis';
import pg from 'pg';
import { buildApp } from './app.js';
import { config } from './config.js';
import { startClickFlusher } from './links/clickFlusher.js';
import { LinkRepository } from './links/linkRepository.js';

const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 10 });
const redis = new Redis(config.REDIS_URL);

const app = buildApp({ pool, redis, baseUrl: config.BASE_URL });
const stopFlusher = startClickFlusher(redis, new LinkRepository(pool), app.log);

async function shutdown(signal: string) {
  app.log.info(`${signal} received, shutting down`);
  stopFlusher();
  await app.close();
  await pool.end();
  redis.disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: config.PORT, host: '0.0.0.0' });
