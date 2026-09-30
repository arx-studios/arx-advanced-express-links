import { after, NextResponse } from 'next/server';
import { CODE_PATTERN } from '@/lib/codes';
import { getLinkRepository, getLinkService } from '@/server/links';
import { maybeFlushClicks } from '@/server/links/clickFlush';
import { LINK_NOT_FOUND_HTML } from '@/server/linkNotFoundPage';
import { getRedis } from '@/server/redis';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!CODE_PATTERN.test(code)) return notFound(request);

  const service = getLinkService();
  const longUrl = await service.resolve(code);
  if (!longUrl) return notFound(request);

  // Runs once the redirect has been sent, so click tracking never slows it down
  // and a Redis hiccup can't break it.
  after(async () => {
    try {
      await service.recordClick(code);
      await maybeFlushClicks(getRedis(), getLinkRepository());
    } catch (err) {
      console.error('failed to record click', err);
    }
  });

  return NextResponse.redirect(longUrl, 302);
}

// Browsers get a page; scripts and API clients get JSON.
function notFound(request: Request) {
  if (request.headers.get('accept')?.includes('text/html')) {
    return new NextResponse(LINK_NOT_FOUND_HTML, {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
