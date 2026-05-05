-- 0030: Extend next_unembedded_video_ids() to take an explicit exclude list.
--
-- WHY:
-- Diagnostic SQL (run 2026-05-05) proved the RPC works correctly at the
-- PostgreSQL level — INSERT a flag, then call the function, and the flagged
-- row is correctly excluded.
--
-- BUT: when the embeddings/build cron does the same INSERT through the
-- Supabase JS client (PostgREST → connection pool), the next supabase.rpc()
-- call inside the same Vercel function invocation does NOT see the prior
-- upsert. Hypothesis: PostgREST pool connection state isn't refreshed
-- between two HTTP calls within the same client tick, so the second call
-- reads from a stale snapshot.
--
-- We could move to direct pg connections to fix the layer cleanly, but
-- that's a sizeable refactor. The simpler fix: pass the list of video_ids
-- we've already processed in this invocation as an explicit RPC parameter.
-- The function then excludes them server-side regardless of write
-- visibility. The route accumulates the exclusion list across iterations.

CREATE OR REPLACE FUNCTION public.next_unembedded_video_ids(
  batch_size int DEFAULT 100,
  exclude_ids text[] DEFAULT ARRAY[]::text[]
)
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
  AND vm.video_id <> ALL(exclude_ids)
  ORDER BY vm.computed_at DESC NULLS LAST
  LIMIT batch_size;
$$;

REVOKE ALL ON FUNCTION public.next_unembedded_video_ids(int, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_unembedded_video_ids(int, text[]) TO service_role;

-- The single-arg overload defined in 0029 is still callable for backward
-- compat (default empty array applies). Tests / SQL editor calls without
-- the second arg keep working.
