import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export function proxy(request: NextRequest) {
  return updateSession(request)
}

// Only paths that care who's signed in. Short-link redirects (/<code>) are
// intentionally excluded so they never pay for a session check.
export const config = {
  matcher: ['/', '/dashboard/:path*', '/api/:path*', '/auth/:path*', '/signin'],
}
