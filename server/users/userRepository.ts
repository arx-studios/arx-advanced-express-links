import type { Pool } from 'pg';

export class UserRepository {
  constructor(private readonly pool: Pool) {}

  // Records a signed-in user the first time we see them, and keeps the email current.
  async upsert(user: { id: string; email: string | null }): Promise<void> {
    await this.pool.query(
      `INSERT INTO users (id, email)
       VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
       WHERE users.email IS DISTINCT FROM EXCLUDED.email`,
      [user.id, user.email],
    );
  }
}
