import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CODE_PATTERN, isReserved } from '@/lib/codes';
import { parseTargetUrl } from '@/lib/targetUrl';
import { env } from '@/server/env';
import { getLinkService } from '@/server/links';
import { AliasTakenError } from '@/server/links/linkService';
import { clientIp, rateLimit } from '@/server/rateLimit';
import { getRedis } from '@/server/redis';

export const dynamic = 'force-dynamic';

const CreateLinkBody = z.object({
  url: z.string().max(2048),
  alias: z.string().regex(CODE_PATTERN, '3-32 chars: letters, digits, _ or -').optional(),
  expiresAt: z.coerce.date().optional(),
});

export async function POST(request: Request) {
  const { BASE_URL, CREATE_LINKS_PER_MINUTE } = env();

  const limit = await rateLimit(
    getRedis(),
    `create:${clientIp(request)}`,
    CREATE_LINKS_PER_MINUTE,
    60,
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many links created, slow down' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body must be valid JSON' }, { status: 400 });
  }

  const parsed = CreateLinkBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { url, alias, expiresAt } = parsed.data;

  if (alias && isReserved(alias)) {
    return NextResponse.json({ error: `"${alias}" is reserved` }, { status: 400 });
  }
  if (expiresAt && expiresAt <= new Date()) {
    return NextResponse.json({ error: 'expiresAt must be in the future' }, { status: 400 });
  }

  const target = parseTargetUrl(url, new URL(BASE_URL).hostname);
  if (!target.ok) {
    return NextResponse.json({ error: target.error }, { status: 400 });
  }

  try {
    const { link, created } = await getLinkService().create({
      longUrl: target.url,
      alias,
      expiresAt,
    });
    return NextResponse.json(
      {
        code: link.code,
        shortUrl: `${BASE_URL}/${link.code}`,
        longUrl: link.longUrl,
        expiresAt: link.expiresAt,
      },
      { status: created ? 201 : 200 },
    );
  } catch (err) {
    if (err instanceof AliasTakenError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
