-- A canonical link is the one handed back to anyone who shortens the same URL
-- without an alias or expiry. At most one canonical row may exist per URL.
ALTER TABLE links ADD COLUMN is_canonical BOOLEAN NOT NULL DEFAULT false;

-- Backfill: for each URL, the oldest generated, non-expiring link becomes canonical.
-- Existing rows have no alias marker, so generated codes are recognised by shape
-- (exactly 7 base62 chars). Other duplicates are left alone: they may already be shared.
UPDATE links SET is_canonical = true
WHERE id IN (
  SELECT DISTINCT ON (long_url) id
  FROM links
  WHERE expires_at IS NULL AND code ~ '^[0-9A-Za-z]{7}$'
  ORDER BY long_url, id
);

-- Hash the URL rather than indexing it directly: index entries are capped at ~2.7KB.
CREATE UNIQUE INDEX links_canonical_url_idx
  ON links (sha256(long_url::bytea))
  WHERE is_canonical;
