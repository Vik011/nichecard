-- 0028: Add a plain-timestamp flag for "this row has a title_embedding".
--
-- BACKGROUND:
-- The embeddings build cron filters out already-embedded videos by querying
-- video_embeddings WHERE title_embedding IS NOT NULL via the Supabase JS
-- client. PostgREST's vector-column NULL filtering is unreliable: depending
-- on the request path the column round-trips as a string, an array, or NULL
-- even when the row clearly has data. The result was a haveTitle Set that
-- looked empty to the route, which then re-picked the same top-100
-- candidates every cron tick and UPSERTed the same rows in place. Coverage
-- never grew past +100 even when the cron logged "embedded: 100" on every
-- run.
--
-- This migration sidesteps the pgvector quirk: a plain timestamptz column
-- that mirrors "title_embedding IS NOT NULL". The cron checks this column
-- (clean Postgres NULL semantics, no vector serialization) instead.
--
-- Backfill is idempotent — if some rows already have a vector populated,
-- we copy embedded_at into title_embedded_at so they're treated as "done".

ALTER TABLE video_embeddings
  ADD COLUMN IF NOT EXISTS title_embedded_at timestamptz;

-- Mark any existing rows that genuinely have a title vector. The
-- IS NOT NULL check works fine here because we're running it server-side in
-- raw SQL, not through PostgREST.
UPDATE video_embeddings
SET title_embedded_at = COALESCE(embedded_at, now())
WHERE title_embedding IS NOT NULL
  AND title_embedded_at IS NULL;

-- Partial index so the cron's "find unembedded" SELECT stays fast even
-- when video_embeddings grows to tens of thousands of rows.
CREATE INDEX IF NOT EXISTS idx_video_embeddings_title_embedded_at
  ON video_embeddings (title_embedded_at)
  WHERE title_embedded_at IS NOT NULL;

COMMENT ON COLUMN video_embeddings.title_embedded_at IS
  'Set when title_embedding is populated. Mirror of "title_embedding IS NOT NULL", maintained because PostgREST cannot reliably filter vector columns by NULL. NULL = not yet embedded (or tombstone from transcripts/fetch).';
