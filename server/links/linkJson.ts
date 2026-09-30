import type { Link } from './linkRepository';

export interface LinkJson {
  code: string;
  shortUrl: string;
  longUrl: string;
  createdAt: string;
  expiresAt: string | null;
  clickCount: number;
}

// The shape the API returns for a link. Internal fields (owner, row id) stay out.
export function toLinkJson(link: Link, baseUrl: string): LinkJson {
  return {
    code: link.code,
    shortUrl: `${baseUrl}/${link.code}`,
    longUrl: link.longUrl,
    createdAt: link.createdAt.toISOString(),
    expiresAt: link.expiresAt?.toISOString() ?? null,
    clickCount: link.clickCount,
  };
}
