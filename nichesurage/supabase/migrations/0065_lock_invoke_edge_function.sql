-- 0065: lock down public.invoke_edge_function(text) — security fix C2.
--
-- WHY: invoke_edge_function (0007) is SECURITY DEFINER and reads the Vault
-- service-role JWT, then POSTs it to any Edge Function. Postgres grants EXECUTE
-- to PUBLIC by default and there was never a REVOKE, so ANY caller holding the
-- public anon key (it ships in the client bundle) could do
--   POST /rest/v1/rpc/invoke_edge_function {"fn_name":"scan"}
-- and trigger scan/discover/trending/etc. WITH the privileged Vault JWT —
-- burning the daily YouTube quota and forcing unbounded DB writes (DoS + cost).
--
-- WHAT: remove the implicit PUBLIC grant (and any anon/authenticated grant),
-- keep it callable only by service_role for any future trusted server path.
-- Mirrors the existing hardening pattern in 0029/0030 for other DEFINER RPCs.
--
-- WHY pg_cron IS UNAFFECTED: the hourly-scan job calls this function as its
-- stored role (Supabase pg_cron runs jobs as `postgres`), which is the FUNCTION
-- OWNER. A function owner always retains EXECUTE regardless of REVOKE FROM
-- PUBLIC, so the scheduled scan keeps working. (Verify with the queries below.)
--
-- DEPLOY: apply manually in the Supabase SQL editor (no db push / CI here).
-- Rollback: 0065_lock_invoke_edge_function_DOWN.sql.

REVOKE ALL ON FUNCTION public.invoke_edge_function(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invoke_edge_function(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_edge_function(text) TO service_role;

-- ── Post-apply verification (run manually) ───────────────────────────────────
-- 1) anon / authenticated can NO LONGER execute (both expect: false):
--    SELECT has_function_privilege('anon',
--             'public.invoke_edge_function(text)', 'EXECUTE');
--    SELECT has_function_privilege('authenticated',
--             'public.invoke_edge_function(text)', 'EXECUTE');
-- 2) service_role still can (expect: true):
--    SELECT has_function_privilege('service_role',
--             'public.invoke_edge_function(text)', 'EXECUTE');
-- 3) function owner = the role pg_cron runs as → cron unaffected (expect: postgres):
--    SELECT proowner::regrole AS owner
--      FROM pg_proc WHERE proname = 'invoke_edge_function';
--    SELECT jobname, username FROM cron.job WHERE jobname = 'hourly-scan';
--    -- owner and username should match (postgres). If username is a NON-owner,
--    -- non-superuser role, add: GRANT EXECUTE ... TO <that_role>; before relying.
-- 4) cron job intact (expect: '0 * * * *' + command invoke_edge_function('scan')):
--    SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'hourly-scan';
-- 5) at the next top-of-hour, confirm scan still ran (fresh rows):
--    SELECT max(scanned_at) FROM video_snapshots;          -- within the last hour
--    SELECT max(created_at) FROM scan_results;             -- within the last hour
-- 6) (optional, only AFTER applying — now safe because it is denied) an anon REST
--    call POST /rest/v1/rpc/invoke_edge_function {"fn_name":"scan"} returns a
--    permission-denied error and does NOT trigger a scan.
