import { NextResponse } from 'next/server';
import { getUser, unauthorized } from '@/server/auth';
import { env } from '@/server/env';
import { getLinkService } from '@/server/links';
import { toLinkJson } from '@/server/links/linkJson';

export const dynamic = 'force-dynamic';

interface Context {
  params: Promise<{ code: string }>;
}

// Someone else's link and a missing link both return 404, so the API doesn't
// reveal which codes exist.
function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function GET(_request: Request, { params }: Context) {
  const user = await getUser();
  if (!user) return unauthorized();

  const { code } = await params;
  const link = await getLinkService().get(user.id, code);
  if (!link) return notFound();

  return NextResponse.json(toLinkJson(link, env().BASE_URL));
}

export async function DELETE(_request: Request, { params }: Context) {
  const user = await getUser();
  if (!user) return unauthorized();

  const { code } = await params;
  const deleted = await getLinkService().delete(user.id, code);
  if (!deleted) return notFound();

  return new NextResponse(null, { status: 204 });
}
