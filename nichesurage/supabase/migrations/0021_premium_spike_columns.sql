-- 0021_premium_spike_columns.sql
-- Sprint A.8: Premium spike classifier columns + DE soft-delete.
--
-- Adds the seven `is_premium*` / VPS / spike fields written by the rewritten
-- /scan edge function. Defaults are non-breaking: existing rows read back
-- as is_premium=false / score=0 / reason='', so the legacy /discover UI
-- continues to function unchanged.
--
-- Soft-deletes all DE rows (channels_watchlist, seed_keywords) so the
-- EN-only scanner skips them. The `language` column is kept on both tables
-- — these rows can be reactivated by flipping is_active=true if we ever
-- want to bring DE back.

ALTER TABLE scan_results
  ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS premium_score smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS premium_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS qualifying_video_count smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vps_recent_avg numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vps_older_median numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spike_multiplier_recent numeric(8,2) NOT NULL DEFAULT 0;

-- Partial index — only premium rows are interesting for "Premium spikes only"
-- queries, so this keeps the index tiny vs a full-table index.
CREATE INDEX IF NOT EXISTS idx_scan_results_is_premium
  ON scan_results(is_premium)
  WHERE is_premium = true;

-- DE soft-delete (reversible — `language` column kept).
UPDATE channels_watchlist SET is_active = false WHERE language = 'de' AND is_active = true;
UPDATE seed_keywords      SET is_active = false WHERE language = 'de' AND is_active = true;
