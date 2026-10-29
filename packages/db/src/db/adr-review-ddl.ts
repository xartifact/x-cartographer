/** Shared idempotent migration for existing databases and isolated fresh databases. */
export const ADR_REVIEW_DDL = [
  `ALTER TABLE adr_records ADD COLUMN IF NOT EXISTS revises text REFERENCES adr_records(id) ON DELETE SET NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS adr_records_revises_idx ON adr_records(revises) WHERE revises IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS adr_review_events (
    id text PRIMARY KEY NOT NULL,
    adr_id text NOT NULL REFERENCES adr_records(id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind IN ('comment', 'reply', 'resolve')),
    comment_id text REFERENCES adr_review_events(id) ON DELETE CASCADE,
    target text,
    body text NOT NULL,
    blocking boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    seq bigserial NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS adr_review_events_adr_idx ON adr_review_events(adr_id)`,
];
