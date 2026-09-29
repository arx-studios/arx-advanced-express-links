import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { parseTargetUrl } from '../lib/targetUrl.js';
import { AliasTakenError, type LinkService } from './linkService.js';

const CODE_PATTERN = /^[A-Za-z0-9_-]{3,32}$/;
const RESERVED = new Set(['api', 'health', 'admin', 'static']);

const CreateLinkBody = z.object({
  url: z.string().max(2048),
  alias: z.string().regex(CODE_PATTERN, '3-32 chars: letters, digits, _ or -').optional(),
  expiresAt: z.coerce.date().optional(),
});

interface LinkRoutesOptions {
  service: LinkService;
  baseUrl: string;
  createLinksPerMinute: number;
}

export const linkRoutes: FastifyPluginAsync<LinkRoutesOptions> = async (
  app,
  { service, baseUrl, createLinksPerMinute },
) => {
  const ownHost = new URL(baseUrl).hostname;

  app.post('/api/links',
    { config: { rateLimit: { max: createLinksPerMinute, timeWindow: '1 minute' } } },
    async (request, reply) => {
    const parsed = CreateLinkBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', issues: parsed.error.issues });
    }
    const { url, alias, expiresAt } = parsed.data;

    if (alias && RESERVED.has(alias.toLowerCase())) {
      return reply.code(400).send({ error: `"${alias}" is reserved` });
    }
    if (expiresAt && expiresAt <= new Date()) {
      return reply.code(400).send({ error: 'expiresAt must be in the future' });
    }

    const target = parseTargetUrl(url, ownHost);
    if (!target.ok) {
      return reply.code(400).send({ error: target.error });
    }

    try {
      const { link, created } = await service.create({ longUrl: target.url, alias, expiresAt });
      return reply.code(created ? 201 : 200).send({
        code: link.code,
        shortUrl: `${baseUrl}/${link.code}`,
        longUrl: link.longUrl,
        expiresAt: link.expiresAt,
      });
    } catch (err) {
      if (err instanceof AliasTakenError) return reply.code(409).send({ error: err.message });
      throw err;
    }
  });

  app.get<{ Params: { code: string } }>('/:code', async (request, reply) => {
    const { code } = request.params;
    if (!CODE_PATTERN.test(code)) return reply.code(404).send({ error: 'Not found' });

    const longUrl = await service.resolve(code);
    if (!longUrl) return reply.code(404).send({ error: 'Not found' });

    service.recordClick(code).catch((err) => request.log.warn({ err }, 'failed to record click'));
    return reply.redirect(longUrl, 302);

  });
};
