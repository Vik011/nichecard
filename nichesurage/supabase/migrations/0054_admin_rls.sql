-- 0054_admin_rls.sql
--
-- Defense-in-depth SELECT policies on every admin_* table. service_role
-- bypasses RLS unconditionally so admin queries (which all use the service
-- client per CLAUDE.md) continue to work. The policies protect against a
-- future bug where someone uses the anon/auth client by mistake on these
-- tables — only users with is_admin=true could read them, and we have
-- exactly one such user (vikmartin.online@gmail.com).

CREATE POLICY admin_audit_log_admin_select
  ON public.admin_audit_log
  FOR SELECT
  USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.users WHERE is_admin = true
    )
  );

CREATE POLICY admin_totp_secrets_admin_select
  ON public.admin_totp_secrets
  FOR SELECT
  USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.users WHERE is_admin = true
    )
  );

CREATE POLICY admin_totp_backup_codes_admin_select
  ON public.admin_totp_backup_codes
  FOR SELECT
  USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.users WHERE is_admin = true
    )
  );

CREATE POLICY admin_sessions_admin_select
  ON public.admin_sessions
  FOR SELECT
  USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.users WHERE is_admin = true
    )
  );

-- INSERT/UPDATE/DELETE intentionally have NO policy. Only service_role
-- (which bypasses RLS) can write. This locks anon and auth roles out of
-- admin_* writes even if they spoof an admin email JWT claim.
