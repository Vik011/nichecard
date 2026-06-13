-- 0066 DOWN: restore the pre-0066 broad UPDATE on public.users.
--
-- WARNING: this re-opens security finding C3 — it gives anon/authenticated
-- table-level UPDATE on public.users again, allowing a logged-in user to PATCH
-- their own tier='premium', is_admin=true, or stripe_customer_id=<arbitrary>.
-- Only roll back if 0066 is shown to break a legitimate flow; prefer fixing
-- forward. (If you roll back, also revert the checkout companion change, or the
-- moved service-role write simply keeps working — it is harmless either way.)
--
-- DEPLOY: apply manually in the Supabase SQL editor.

GRANT UPDATE ON public.users TO anon, authenticated;
-- The column-level GRANT UPDATE(welcome_email_sent_at) from 0066 is now subsumed
-- by the table-level grant above; left in place (harmless). To scrub it exactly:
--   REVOKE UPDATE (welcome_email_sent_at) ON public.users FROM authenticated;

-- Verify (expect true again):
--   SELECT has_table_privilege('authenticated','public.users','UPDATE');
