-- 0056_faceless_verdict_watchlist_DOWN.sql
--
-- Rollback for 0056_faceless_verdict_watchlist.sql.
--
-- Drops the faceless_verdict column from channels_watchlist. Safe with no
-- ordering concerns: channels_watchlist is not referenced by any view
-- (scan_results_latest / channel_spike_history_30d both read scan_results,
-- not channels_watchlist), so there is no view dependency or CASCADE risk.
--
-- DEPLOY: apply manually in the Supabase SQL editor.

ALTER TABLE public.channels_watchlist DROP COLUMN IF EXISTS faceless_verdict;

-- Verify after applying:
--   SELECT count(*) FROM information_schema.columns
--    WHERE table_name = 'channels_watchlist' AND column_name = 'faceless_verdict';
--   -> 0.
