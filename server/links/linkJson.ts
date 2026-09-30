import type { Link } from './linkRepository';

// The shape the API returns for a link. Internal fields (owner, row id) stay out.
export function toLinkJson(link: Link, baseUrl: string) {
  return {
    code: link.code,
    shortUrl: `${baseUrl}/${link.code}`,
    longUrl: link.longUrl,
    createdAt: link.createdAt,
    expiresAt: link.expiresAt,
    clickCount: link.clickCount,
  };
}
