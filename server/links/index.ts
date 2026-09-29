import 'server-only';
import { getPool } from '../db';
import { getRedis } from '../redis';
import { LinkRepository } from './linkRepository';
import { LinkService } from './linkService';

export function getLinkRepository(): LinkRepository {
  return new LinkRepository(getPool());
}

export function getLinkService(): LinkService {
  return new LinkService(getLinkRepository(), getRedis());
}
