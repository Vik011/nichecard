ALTER TABLE public.scan_results
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'shorts'
    CHECK (content_type IN ('shorts', 'longform')),
  ADD COLUMN IF NOT EXISTS hook_score float,
  ADD COLUMN IF NOT EXISTS avg_view_duration_pct float,
  ADD COLUMN IF NOT EXISTS search_volume int,
  ADD COLUMN IF NOT EXISTS competition_score int;
