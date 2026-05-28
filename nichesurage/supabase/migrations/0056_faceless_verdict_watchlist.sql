-- 0056_faceless_verdict_watchlist.sql
--
-- Adds an explicit tri-state faceless verdict to channels_watchlist.
--
-- WHY:
-- The existing boolean `channels_watchlist.faceless` (migration 0047)
-- conflates two distinct verdicts: it is `true` only for a confirmed
-- 'faceless' classification and `false` for BOTH 'uncertain' and the
-- no-key default. That makes it impossible to distinguish a channel the
-- classifier confirmed as faceless from one it simply could not decide.
-- Day-2 diagnostics showed 72 apify_search channels stored as
-- faceless=false were actually 'uncertain' (kept) rather than rejected,
-- and the downstream premium-feed policy needs to treat 'uncertain'
-- differently from confirmed 'faceless'. A tri-state column captures the
-- real verdict so policy can act on it without guessing.
--
-- SCOPE: this migration touches ONLY channels_watchlist. It does NOT modify
-- scan_results, scan_results_latest, or any view. The column is additive and
-- nullable, so the currently-deployed discover-ingest (which does not yet
-- write it) is unaffected: existing and newly-inserted rows simply carry NULL
-- until the updated function ships. The /discover feed does not read
-- channels_watchlist, so the feed is unaffected.
--
-- VALUES: in practice stored rows only ever hold 'faceless' or 'uncertain' —
-- channels classified 'face' are hard-rejected at ingest and never inserted.
-- The boolean `faceless` column is retained for backward compatibility.
--
-- DEPLOY: apply manually in the Supabase SQL editor (no db push / CI in this
-- project). Rollback SQL lives in 0056_faceless_verdict_watchlist_DOWN.sql.
-- NOTE: the column was applied to production via this SQL on 2026-05-28
-- (originally authored as 0049 on a stale branch; renumbered to 0056 to
-- avoid collision with master's admin-phase migrations 0049-0055).

ALTER TABLE public.channels_watchlist
  ADD COLUMN IF NOT EXISTS faceless_verdict text
  CHECK (faceless_verdict IN ('faceless', 'face', 'uncertain'));

COMMENT ON COLUMN public.channels_watchlist.faceless_verdict IS
  'Tri-state classifyFaceless verdict (faceless|face|uncertain). Stored rows in practice hold only faceless|uncertain; face channels are hard-rejected at ingest and never stored. The boolean `faceless` column is kept for backward compatibility.';

-- Verify after applying:
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'channels_watchlist' AND column_name = 'faceless_verdict';
--   -> one row, data_type 'text', is_nullable 'YES'.
