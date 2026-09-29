export type ParseResult = { ok: true; url: string } | { ok: false; error: string };

export function parseTargetUrl(input: string, ownHost: string): ParseResult {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, error: 'Not a valid URL' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: 'Only http and https URLs are allowed' };
  }
  if (url.hostname === ownHost) {
    return { ok: false, error: 'Cannot shorten a link that points to this service' };
  }

  return { ok: true, url: url.toString() };
}
