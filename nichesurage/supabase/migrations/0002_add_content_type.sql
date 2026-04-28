ALTER TABLE public.scan_results
  ADD COLUMN content_type text NOT NULL DEFAULT 'shorts'
    CHECK (content_type IN ('shorts', 'longform')),
  ADD COLUMN hook_score float,
  ADD COLUMN avg_view_duration_pct float,
  ADD COLUMN search_volume int,
  ADD COLUMN competition_score int;
