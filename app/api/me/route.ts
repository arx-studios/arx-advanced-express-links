import { NextResponse } from 'next/server';
import { getUser, unauthorized } from '@/server/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getUser();
  if (!user) return unauthorized();

  return NextResponse.json(user);
}
