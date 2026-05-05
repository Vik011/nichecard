-- 0031: Discovery expansion log — bookkeeping for /api/discovery/expand.
--
-- WHY:
-- The expand route picks viral seed videos (trend_score > 60 in last 48h)
-- and crawls each via yt-dlp Mix playlist. Without this log, the same seed
-- would be re-expanded every 4h cron tick, wasting yt-dlp time and Vercel
-- function-invocation seconds. ON CONFLICT on channels_watchlist already
-- prevents duplicate channel inserts but doesn't save the crawl cost.
--
-- This table records (seed_video_id, channels_added, expanded_at) per
-- successful Mix crawl. The expand route LEFT-anti-joins against it to
-- skip already-expanded seeds.
--
-- Retention: keep entries for 60 days then prune. After 60d a re-expand
-- of the same viral video is fine — its Mix-playlist neighborhood may
-- have shifted as YouTube's algorithm re-ranks.

CREATE TABLE IF NOT EXISTS public.discovery_expansion_log (
  id bigserial PRIMARY KEY,
  seed_video_id text NOT NULL,
  channels_added int NOT NULL DEFAULT 0,
  expanded_at timestamptz NOT NULL DEFAULT now()
);

-- Look-up by seed; the expand route does an `IN (top-N seed ids)` filter.
CREATE INDEX IF NOT EXISTS idx_discovery_expansion_log_seed
  ON public.discovery_expansion_log (seed_video_id);

CREATE INDEX IF NOT EXISTS idx_discovery_expansion_log_expanded_at
  ON public.discovery_expansion_log (expanded_at DESC);

-- RLS: service role only. No anon read — this is internal bookkeeping.
ALTER TABLE public.discovery_expansion_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role manages expansion log"
    ON public.discovery_expansion_log
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TABLE public.discovery_expansion_log IS
  'Sprint B Phase 5b: dedup ledger for /api/discovery/expand. One row per yt-dlp Mix-playlist crawl of a seed video. Prevents re-expanding the same seed every 4h cron tick.';
