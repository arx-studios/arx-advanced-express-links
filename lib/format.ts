const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 60 * 60],
  ['month', 30 * 24 * 60 * 60],
  ['week', 7 * 24 * 60 * 60],
  ['day', 24 * 60 * 60],
  ['hour', 60 * 60],
  ['minute', 60],
];

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

// "3 days ago", "in 2 hours", "just now"
export function relativeTime(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.trunc(seconds / size), unit);
  }
  return 'just now';
}

export function isExpired(expiresAt: string | null, now = Date.now()): boolean {
  return expiresAt !== null && new Date(expiresAt).getTime() <= now;
}

// "axl.arxstudios.pro/abc1234": the short URL without the protocol, for display.
export function displayShortUrl(shortUrl: string): string {
  const url = new URL(shortUrl);
  return `${url.host}${url.pathname}`;
}
