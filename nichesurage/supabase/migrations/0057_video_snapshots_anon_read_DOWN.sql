-- 0057_video_snapshots_anon_read_DOWN.sql
-- Rollback for 0057_video_snapshots_anon_read.sql

DROP POLICY IF EXISTS "anon_read_video_snapshots"
  ON public.video_snapshots;
