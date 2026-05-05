-- 0029: RPC that returns the next batch of video_ids needing a title
-- embedding, with the latest snapshot title pre-joined.
--
-- BACKGROUND:
-- The previous embeddings/build cron ran two PostgREST queries (one for
-- "already embedded", one for "all video_metrics"), then filtered client-
-- side. Even after migration 0028 added a plain timestamp flag, runs still
-- overwrote the same 100 rows on every invocation — likely a read-after-
-- write consistency quirk in the Supabase JS path: the SELECT could not see
-- rows just upserted by a previous run, so the haveTitle Set was stuck at
-- its initial size and the candidate pool kept yielding the same prefix.
--
-- This function moves the entire decision to Postgres in one snapshot:
--   * NOT EXISTS subquery eliminates already-embedded rows
--   * Correlated subquery picks the latest snapshot title per video
--   * ORDER BY video_metrics.computed_at DESC matches existing prioritization
--   * LIMIT batch_size returns at most the requested count
--
-- The route calls supabase.rpc('next_unembedded_video_ids', { batch_size }).
-- Each call sees the latest committed state, so consecutive cron runs
-- naturally pick disjoint batches.

CREATE OR REPLACE FUNCTION public.next_unembedded_video_ids(batch_size int DEFAULT 100)
RETURNS TABLE(video_id text, latest_title text)
LANGUAGE sql
STABLE
AS $$
  SELECT
    vm.video_id::text,
    (
      SELECT vs.title
      FROM video_snapshots vs
      WHERE vs.video_id = vm.video_id
        AND vs.title IS NOT NULL
        AND length(trim(vs.title)) > 0
      ORDER BY vs.scanned_at DESC
      LIMIT 1
    ) AS latest_title
  FROM video_metrics vm
  WHERE NOT EXISTS (
    SELECT 1
    FROM video_embeddings ve
    WHERE ve.video_id = vm.video_id
      AND ve.title_embedded_at IS NOT NULL
  )
  ORDER BY vm.computed_at DESC NULLS LAST
  LIMIT batch_size;
$$;

-- Service role calls this; keep it locked from anon by default.
REVOKE ALL ON FUNCTION public.next_unembedded_video_ids(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_unembedded_video_ids(int) TO service_role;

COMMENT ON FUNCTION public.next_unembedded_video_ids(int) IS
  'Sprint B Phase 4: returns the next batch of video_ids needing a title embedding, with the latest non-empty snapshot title pre-joined. Used by /api/embeddings/build to avoid PostgREST read-after-write inconsistency that was causing the cron to repeatedly overwrite the same 100 rows.';
