-- Users are authenticated by the ARX Studios Supabase project (a different
-- project), so this is a local copy of their id, not a foreign key to auth.users.
CREATE TABLE users (
  id         UUID PRIMARY KEY,
  email      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE links (
  id           BIGSERIAL PRIMARY KEY,
  code         VARCHAR(32) NOT NULL UNIQUE,
  long_url     TEXT        NOT NULL,
  owner_id     UUID        NOT NULL REFERENCES users (id),
  -- The link handed back when this owner shortens the same URL again
  -- (no alias, no expiry). At most one per owner and URL.
  is_canonical BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ,
  -- Soft delete: the row, and so its code, is kept forever so a deleted
  -- code can never be claimed by someone else.
  deleted_at   TIMESTAMPTZ,
  click_count  BIGINT      NOT NULL DEFAULT 0
);

-- Hash the URL rather than indexing it directly: index entries are capped at ~2.7KB.
CREATE UNIQUE INDEX links_canonical_idx
  ON links (owner_id, sha256(long_url::bytea))
  WHERE is_canonical;

-- Dashboard listing: a user's live links, newest first.
CREATE INDEX links_owner_idx
  ON links (owner_id, id DESC)
  WHERE deleted_at IS NULL;

-- Supabase exposes the public schema through its Data API using the public
-- anon/publishable key. RLS with no policies denies that API everything;
-- the app connects as the table owner, which RLS doesn't apply to.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE links ENABLE ROW LEVEL SECURITY;
