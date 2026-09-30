import { describe, expect, it } from 'vitest';
import { displayShortUrl, isExpired, relativeTime } from '@/lib/format';

const NOW = Date.parse('2026-09-30T12:00:00Z');

describe('relativeTime', () => {
  it('describes past and future times', () => {
    expect(relativeTime('2026-09-30T11:59:40Z', NOW)).toBe('just now');
    expect(relativeTime('2026-09-30T11:55:00Z', NOW)).toBe('5 minutes ago');
    expect(relativeTime('2026-09-27T12:00:00Z', NOW)).toBe('3 days ago');
    expect(relativeTime('2026-09-29T12:00:00Z', NOW)).toBe('yesterday');
    expect(relativeTime('2026-09-30T14:00:00Z', NOW)).toBe('in 2 hours');
  });
});

describe('isExpired', () => {
  it('treats null as never expiring', () => {
    expect(isExpired(null, NOW)).toBe(false);
    expect(isExpired('2026-09-30T11:00:00Z', NOW)).toBe(true);
    expect(isExpired('2026-09-30T13:00:00Z', NOW)).toBe(false);
  });
});

describe('displayShortUrl', () => {
  it('drops the protocol', () => {
    expect(displayShortUrl('https://axl.arxstudios.pro/abc1234')).toBe('axl.arxstudios.pro/abc1234');
    expect(displayShortUrl('http://localhost:3000/gh')).toBe('localhost:3000/gh');
  });
});
