-- 0063_channels_watchlist_catalog_columns_DOWN.sql
--
-- Reverses 0063: drops the three catalog columns added to channels_watchlist.
--
-- Safe: the columns are additive and (until a later populate PR) hold only NULL,
-- so no meaningful data is lost. IF EXISTS makes it idempotent. Does not touch
-- any other column, constraint, index, or RLS policy.
--
-- DEPLOY: apply manually in the Supabase SQL editor.

ALTER TABLE public.channels_watchlist
  DROP COLUMN IF EXISTS subscriber_count,
  DROP COLUMN IF EXISTS video_count,
  DROP COLUMN IF EXISTS last_upload_at;

NOTIFY pgrst, 'reload schema';

-- Verify after applying:
--   SELECT count(*) AS leftover
--     FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'channels_watchlist'
--      AND column_name IN ('subscriber_count','video_count','last_upload_at');
--   -> leftover = 0.
