import type { Pool } from 'pg';

export interface Link {
  id: string;
  code: string;
  longUrl: string;
  createdAt: Date;
  expiresAt: Date | null;
  clickCount: number;
}

interface LinkRow {
  id: string;
  code: string;
  long_url: string;
  created_at: Date;
  expires_at: Date | null;
  click_count: string;
}

function toLink(row: LinkRow): Link {
  return {
    id: row.id,
    code: row.code,
    longUrl: row.long_url,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    clickCount: Number(row.click_count),
  };
}

export class LinkRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: { code: string; longUrl: string; expiresAt: Date | null }): Promise<Link> {
    const { rows } = await this.pool.query<LinkRow>(
      `INSERT INTO links (code, long_url, expires_at)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [input.code, input.longUrl, input.expiresAt],
    );
    return toLink(rows[0]);
  }

  // Returns null if a canonical link for this URL already exists.
  async insertCanonical(input: { code: string; longUrl: string }): Promise<Link | null> {
    const { rows } = await this.pool.query<LinkRow>(
      `INSERT INTO links (code, long_url, is_canonical)
       VALUES ($1, $2, true)
       ON CONFLICT (sha256(long_url::bytea)) WHERE is_canonical DO NOTHING
       RETURNING *`,
      [input.code, input.longUrl],
    );
    return rows[0] ? toLink(rows[0]) : null;
  }

  async findCanonical(longUrl: string): Promise<Link | null> {
    const { rows } = await this.pool.query<LinkRow>(
      `SELECT * FROM links
       WHERE is_canonical
         AND sha256(long_url::bytea) = sha256($1::text::bytea)
         AND long_url = $1::text`,
      [longUrl],
    );
    return rows[0] ? toLink(rows[0]) : null;
  }

  async findByCode(code: string): Promise<Link | null> {
    const { rows } = await this.pool.query<LinkRow>('SELECT * FROM links WHERE code = $1', [code]);
    return rows[0] ? toLink(rows[0]) : null;
  }

  async incrementClicks(code: string, by: number): Promise<void> {
    await this.pool.query('UPDATE links SET click_count = click_count + $2 WHERE code = $1', [
      code,
      by,
    ]);
  }
}
