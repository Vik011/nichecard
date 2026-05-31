DO $$
BEGIN
CREATE POLICY "authenticated_read_video_metrics"
ON public.video_metrics
FOR SELECT
TO authenticated
USING (true);
EXCEPTION
WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
CREATE POLICY "authenticated_read_video_snapshots"
ON public.video_snapshots
FOR SELECT
TO authenticated
USING (true);
EXCEPTION
WHEN duplicate_object THEN NULL;
END
$$;
