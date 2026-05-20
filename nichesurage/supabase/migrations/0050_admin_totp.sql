-- 0050_admin_totp.sql
--
-- TOTP step-up for destructive admin actions (sudo).
--
-- admin_totp_secrets: one row per admin holding the encrypted otplib secret.
-- encrypted_secret is a base64-encoded blob = AES-256-GCM(iv ‖ authTag ‖ ct)
-- using ADMIN_TOTP_ENCRYPTION_KEY from env. Storing the ciphertext as text
-- avoids the bytea-to-string ambiguity in the Supabase JS client.
--
-- admin_totp_backup_codes: 10 single-use codes generated at enroll time.
-- code_hash is bcrypt($2a$10$...). used_at NULL = available, set = consumed.

CREATE TABLE public.admin_totp_secrets (
  admin_email       text PRIMARY KEY,
  encrypted_secret  text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  last_used_at      timestamptz
);

CREATE TABLE public.admin_totp_backup_codes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email  text NOT NULL,
  code_hash    text NOT NULL,
  used_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_backup_codes_email ON public.admin_totp_backup_codes (admin_email, used_at);

ALTER TABLE public.admin_totp_secrets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_totp_backup_codes  ENABLE ROW LEVEL SECURITY;
-- Defense-in-depth SELECT policies added in 0054.

REVOKE ALL ON public.admin_totp_secrets      FROM PUBLIC;
REVOKE ALL ON public.admin_totp_backup_codes FROM PUBLIC;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.admin_totp_secrets      TO service_role;
GRANT  SELECT, INSERT, UPDATE         ON public.admin_totp_backup_codes TO service_role;
-- backup_codes UPDATE so we can mark used_at; never DELETE individually.
