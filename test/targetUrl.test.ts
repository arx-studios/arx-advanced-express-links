import { describe, expect, it } from 'vitest';
import { parseTargetUrl } from '../src/lib/targetUrl.js';

const OWN_HOST = 'localhost';

describe('parseTargetUrl', () => {
  it('accepts http and https URLs', () => {
    expect(parseTargetUrl('https://example.com/a?b=1', OWN_HOST)).toEqual({
      ok: true,
      url: 'https://example.com/a?b=1',
    });
    expect(parseTargetUrl('http://example.com', OWN_HOST).ok).toBe(true);
  });

  it('rejects garbage', () => {
    expect(parseTargetUrl('not a url', OWN_HOST).ok).toBe(false);
  });

  it('rejects dangerous schemes', () => {
    expect(parseTargetUrl('javascript:alert(1)', OWN_HOST).ok).toBe(false);
    expect(parseTargetUrl('file:///etc/passwd', OWN_HOST).ok).toBe(false);
  });

  it('rejects links back to ourselves', () => {
    expect(parseTargetUrl('http://localhost:3000/abc', OWN_HOST).ok).toBe(false);
  });
});
