import { after, NextResponse } from 'next/server';
import { CODE_PATTERN } from '@/lib/codes';
import { getLinkRepository, getLinkService } from '@/server/links';
import { maybeFlushClicks } from '@/server/links/clickFlush';
import { getRedis } from '@/server/redis';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!CODE_PATTERN.test(code)) return notFound();

  const service = getLinkService();
  const longUrl = await service.resolve(code);
  if (!longUrl) return notFound();

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

function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
