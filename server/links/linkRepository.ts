import type { Pool } from 'pg';

export interface Link {
  id: string;
  code: string;
  longUrl: string;
  ownerId: string;
  createdAt: Date;
  expiresAt: Date | null;
  clickCount: number;
}

interface LinkRow {
  id: string;
  code: string;
  long_url: string;
  owner_id: string;
  created_at: Date;
  expires_at: Date | null;
  click_count: string;
}

function toLink(row: LinkRow): Link {
  return {
    id: row.id,
    code: row.code,
    longUrl: row.long_url,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    clickCount: Number(row.click_count),
  };
}

export class LinkRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: {
    code: string;
    longUrl: string;
    ownerId: string;
    expiresAt: Date | null;
  }): Promise<Link> {
    const { rows } = await this.pool.query<LinkRow>(
      `INSERT INTO links (code, long_url, owner_id, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.code, input.longUrl, input.ownerId, input.expiresAt],
    );
    return toLink(rows[0]);
  }

  // Returns null if this owner already has a canonical link for the URL.
  async insertCanonical(input: { code: string; longUrl: string; ownerId: string }): Promise<Link | null> {
    const { rows } = await this.pool.query<LinkRow>(
      `INSERT INTO links (code, long_url, owner_id, is_canonical)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (owner_id, sha256(long_url::bytea)) WHERE is_canonical DO NOTHING
       RETURNING *`,
      [input.code, input.longUrl, input.ownerId],
    );
    return rows[0] ? toLink(rows[0]) : null;
  }

  async findCanonical(ownerId: string, longUrl: string): Promise<Link | null> {
    const { rows } = await this.pool.query<LinkRow>(
      `SELECT * FROM links
       WHERE is_canonical
         AND owner_id = $1
         AND sha256(long_url::bytea) = sha256($2::text::bytea)
         AND long_url = $2::text`,
      [ownerId, longUrl],
    );
    return rows[0] ? toLink(rows[0]) : null;
  }

  // Live links only: this is what redirects resolve against.
  async findByCode(code: string): Promise<Link | null> {
    const { rows } = await this.pool.query<LinkRow>(
      'SELECT * FROM links WHERE code = $1 AND deleted_at IS NULL',
      [code],
    );
    return rows[0] ? toLink(rows[0]) : null;
  }

  async findOwned(ownerId: string, code: string): Promise<Link | null> {
    const { rows } = await this.pool.query<LinkRow>(
      'SELECT * FROM links WHERE code = $1 AND owner_id = $2 AND deleted_at IS NULL',
      [code, ownerId],
    );
    return rows[0] ? toLink(rows[0]) : null;
  }

  // Keyset pagination: `before` is the id of the last link on the previous page.
  async listByOwner(ownerId: string, options: { before?: string; limit: number }): Promise<Link[]> {
    const { rows } = await this.pool.query<LinkRow>(
      `SELECT * FROM links
       WHERE owner_id = $1
         AND deleted_at IS NULL
         AND ($2::bigint IS NULL OR id < $2::bigint)
       ORDER BY id DESC
       LIMIT $3`,
      [ownerId, options.before ?? null, options.limit],
    );
    return rows.map(toLink);
  }

  // Clearing is_canonical lets the owner shorten the same URL again and get a new code.
  async softDelete(ownerId: string, code: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE links
       SET deleted_at = now(), is_canonical = false
       WHERE code = $1 AND owner_id = $2 AND deleted_at IS NULL`,
      [code, ownerId],
    );
    return rowCount === 1;
  }

  async incrementClicks(code: string, by: number): Promise<void> {
    await this.pool.query('UPDATE links SET click_count = click_count + $2 WHERE code = $1', [
      code,
      by,
    ]);
  }
}
