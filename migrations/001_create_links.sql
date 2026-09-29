CREATE TABLE links (
  id          BIGSERIAL PRIMARY KEY,
  code        VARCHAR(32) NOT NULL UNIQUE,
  long_url    TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ,
  click_count BIGINT      NOT NULL DEFAULT 0
);
