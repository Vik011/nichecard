-- 0065 DOWN: restore the pre-0065 state of public.invoke_edge_function(text).
--
-- WARNING: this re-opens security finding C2 — it makes the function callable by
-- PUBLIC again (anon/authenticated via PostgREST RPC), which lets any anon-key
-- holder trigger Edge Functions with the privileged Vault JWT. Only roll back if
-- 0065 is shown to break the scheduled scan; prefer fixing forward.
--
-- Restores the exact prior grants: PUBLIC had the implicit EXECUTE, and there
-- was no explicit service_role grant.
--
-- DEPLOY: apply manually in the Supabase SQL editor.

GRANT EXECUTE ON FUNCTION public.invoke_edge_function(text) TO PUBLIC;
REVOKE EXECUTE ON FUNCTION public.invoke_edge_function(text) FROM service_role;

-- Verify (expect: true again for anon/authenticated):
--   SELECT has_function_privilege('anon',
--            'public.invoke_edge_function(text)', 'EXECUTE');
--   SELECT has_function_privilege('authenticated',
--            'public.invoke_edge_function(text)', 'EXECUTE');
