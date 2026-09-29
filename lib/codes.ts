export const CODE_PATTERN = /^[A-Za-z0-9_-]{3,32}$/;

// Paths the app serves itself. Next matches these before /[code], so an alias
// with one of these names could never be reached.
const RESERVED = new Set([
  'api',
  'auth',
  'signin',
  'signout',
  'login',
  'logout',
  'welcome',
  'privacy',
  'dashboard',
  'settings',
  'health',
  'admin',
  'static',
  '_next',
]);

export function isReserved(code: string): boolean {
  return RESERVED.has(code.toLowerCase());
}
