-- 0057_video_snapshots_anon_read.sql
--
-- WHY:
-- video_snapshots has RLS enabled (0024) but no anon SELECT policy, which
-- blocks the browser anon client from reading the table. The future
-- channel_current_momentum VIEW (Part B) will use security_invoker=on
-- following the 0048 pattern, so the anon caller's privileges propagate to
-- base tables. Without this policy the VIEW returns 0 rows silently.
--
-- video_snapshots contains only public YouTube metadata:
-- view_count, like_count, comment_count, duration_seconds, thumbnail_url,
-- title, published_at — no user PII. Matches the pattern of
-- anon_read_video_metrics (0024) and niche_clusters (0019).
--
-- DEPLOY: apply manually in the Supabase SQL editor (no db push / CI in
-- this project). Idempotent (EXCEPTION guard no-ops on re-run).
-- Rollback SQL lives in 0057_video_snapshots_anon_read_DOWN.sql.

DO $$
BEGIN
  CREATE POLICY "anon_read_video_snapshots"
    ON public.video_snapshots
    FOR SELECT
    TO anon
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Post-check (run after applying to confirm both policies exist):
--   SELECT schemaname, tablename, policyname, roles, cmd
--     FROM pg_policies
--    WHERE schemaname = 'public'
--      AND tablename IN ('video_snapshots', 'video_metrics');
--   -> expect 2 rows: anon_read_video_snapshots + anon_read_video_metrics
