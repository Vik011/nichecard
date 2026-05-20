-- 0049_admin_audit_log.sql
--
-- Append-only forensics log for every destructive admin action. Two rows per
-- action: phase='intent' written BEFORE the action (so we have a record even
-- if the action crashes), phase='outcome' written AFTER. Both rows share
-- intent_id so we can reconstruct the full attempt.
--
-- Hard append-only: even service_role cannot UPDATE or DELETE rows. Only
-- INSERT and SELECT are granted. If we ever decide we need a retention
-- policy, do it via DROP TABLE + restore from backup, not soft-delete.
--
-- No retention policy v1; revisit at 100k rows (~200 years at 20 actions/mo
-- for a solo admin).

CREATE TABLE public.admin_audit_log (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email        text NOT NULL,
  action             text NOT NULL,
  phase              text NOT NULL CHECK (phase IN ('intent', 'outcome')),
  intent_id          uuid NOT NULL,
  target_type        text NOT NULL,
  target_id          text,
  before_json        jsonb,
  after_json         jsonb,
  outcome            text CHECK (outcome IN ('success', 'failed')),
  error_text         text,
  reason             text,
  ip                 text,
  user_agent         text,
  sudo_verified_at   timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_admin_created ON public.admin_audit_log (admin_email, created_at DESC);
CREATE INDEX idx_audit_intent_id     ON public.admin_audit_log (intent_id);
CREATE INDEX idx_audit_target        ON public.admin_audit_log (target_type, target_id);
CREATE INDEX idx_audit_action_created ON public.admin_audit_log (action, created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
-- No RLS policies here; defense-in-depth SELECT policy is added in 0054.
-- service_role bypasses RLS regardless, but is restricted at the GRANT layer:

REVOKE ALL ON public.admin_audit_log FROM PUBLIC;
GRANT INSERT, SELECT ON public.admin_audit_log TO service_role;
-- Explicit REVOKE so future DEFAULT PRIVILEGES changes don't accidentally
-- re-grant. service_role can write new rows and read existing ones,
-- nothing else.
REVOKE UPDATE, DELETE ON public.admin_audit_log FROM service_role;
