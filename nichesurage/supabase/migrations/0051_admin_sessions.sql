-- 0051_admin_sessions.sql
--
-- Sudo-window tracking. One row per sudo grant (issued after successful
-- TOTP verify). sudo_until is the timestamp past which the grant no
-- longer authorizes destructive actions. Reduced from the original spec
-- (no last_active_at column): we dropped server-side idle timeout in the
-- design review, sudo (5-min TTL) is the only gate.

CREATE TABLE public.admin_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email   text NOT NULL,
  sudo_until    timestamptz,   -- NULL = no active grant (or grant was expired and cleaned); set to issue_time+5min at insertion by issueSudo() in src/lib/admin/sudo.ts. App treats NULL as "not authorized" so a row with NULL is harmless.
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_sessions_lookup ON public.admin_sessions (admin_email, sudo_until DESC);

ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
-- Defense-in-depth SELECT policy added in 0054.

REVOKE ALL ON public.admin_sessions FROM PUBLIC;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.admin_sessions TO service_role;
