-- 0027: Track when each user has received the welcome email so we send it
-- exactly once on first sign-in.
--
-- BACKGROUND:
-- The auth callback (`/auth/callback`) sends a welcome email via Resend after
-- a successful OAuth exchange. We don't want to spam returning users on every
-- login, so we record `welcome_email_sent_at` once delivery is confirmed.
--
-- Strategy:
--   * Column starts NULL (existing rows + new sign-ups).
--   * Auth callback: if NULL → send email → UPDATE to now().
--   * If Resend send fails, we leave the column NULL so the next sign-in
--     retries (silent retry vs. lost welcome email).
--
-- IDEMPOTENCY: ADD COLUMN IF NOT EXISTS so re-running the migration is safe.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at timestamptz;

COMMENT ON COLUMN public.users.welcome_email_sent_at IS
  'Timestamp the welcome email was successfully delivered via Resend. NULL = not yet sent (will retry on next sign-in).';
