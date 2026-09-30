import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface AuthUser {
  id: string;
  email: string | null;
}

// Verifies the session JWT locally against the auth project's public keys
// (asymmetric signing), so there's no call to Supabase per request.
export async function getUser(): Promise<AuthUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;

  return { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : null };
}

export function unauthorized() {
  return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
}
