-- 0063_channels_watchlist_catalog_columns.sql
--
-- WHY:
-- The /discover surfaces (All / Just Added / Similar / Search) render cards from
-- scan_results_latest, which only holds rows for channels with a CURRENT OUTLIER
-- result (ratio >= OUTLIER_DB_FLOOR). channels_watchlist is the real faceless
-- membership + lifecycle source of truth (youtube_channel_id UNIQUE,
-- faceless_verdict, is_active, evicted_at, category, content_type, language,
-- last_scanned_at, discovered_via, ...). To let those surfaces EVENTUALLY build a
-- broader faceless catalog over channels_watchlist (not just the outlier pool),
-- the table needs the few card / lifecycle fields it is missing.
--
-- Prod schema check (2026-06-06): channels_watchlist already has membership +
-- lifecycle + provenance (discovered_via) columns. The catalog gap is purely
-- channel size + upload recency. Sizing: 1231 rows total, 248 faceless,
-- 238 faceless + is_active + not-evicted (the catalog target, vs ~45 surfaced
-- today via the outlier pool).
--
-- SCOPE (deliberately minimal, additive, reversible):
--   * subscriber_count : channel size -- card stat + size filtering
--   * video_count      : channel size -- card stat
--   * last_upload_at   : channel upload recency -- to LATER derive a "dormant"
--                        lifecycle state. (active/dead already derive from
--                        is_active + evicted_at; dormant needs upload recency.)
--
-- All THREE are NULLABLE with no default => metadata-only ALTER (no table
-- rewrite, no backfill), and the deployed app is unaffected (nothing reads them
-- yet). Population (ingest/scan write) is a LATER PR; surface wiring is a LATER
-- PR. No separate inventory table; no provenance column (discovered_via already
-- exists); no stored lifecycle enum (lifecycle stays derived for now).
--
-- DEPLOY: apply manually in the Supabase SQL editor (no db push / CI in this
-- project). Idempotent via IF NOT EXISTS. Rollback:
-- 0063_channels_watchlist_catalog_columns_DOWN.sql.

ALTER TABLE public.channels_watchlist
  ADD COLUMN IF NOT EXISTS subscriber_count bigint,
  ADD COLUMN IF NOT EXISTS video_count      integer,
  ADD COLUMN IF NOT EXISTS last_upload_at   timestamptz;

COMMENT ON COLUMN public.channels_watchlist.subscriber_count IS
  'Channel subscriber count (catalog card stat / size filter). NULL until populated by ingest/scan. Added 0063.';
COMMENT ON COLUMN public.channels_watchlist.video_count IS
  'Channel total video count (catalog card stat). NULL until populated by ingest/scan. Added 0063.';
COMMENT ON COLUMN public.channels_watchlist.last_upload_at IS
  'Timestamp of the channel''s most recent upload; used to derive a dormant lifecycle state. NULL until populated by scan. Added 0063.';

-- PostgREST re-introspect so the new columns are exposed via the REST API.
-- (Supabase's DDL event trigger usually auto-reloads; this is belt-and-braces.)
NOTIFY pgrst, 'reload schema';

-- Verify after applying:
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'channels_watchlist'
--      AND column_name IN ('subscriber_count','video_count','last_upload_at')
--    ORDER BY column_name;
--   -> three rows, all is_nullable = YES (bigint / integer / timestamp with time zone).
