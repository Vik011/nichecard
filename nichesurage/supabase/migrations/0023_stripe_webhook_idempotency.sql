-- 0023_stripe_webhook_idempotency.sql
-- Stripe webhook idempotency log. Stripe retries failed webhooks up to ~3 days,
-- and can also resend the same event_id more than once after network glitches.
-- Without an idempotency check, a duplicate event would re-run the handler
-- (e.g. double-emit `subscription_started` to PostHog, or rerun the Supabase
-- UPDATE — usually harmless but not guaranteed).
--
-- Strategy: PRIMARY KEY on event_id. Handler does INSERT first; if it raises
-- 23505 (unique violation), we know it's a duplicate and return 200 without
-- reprocessing. After successful handling we set processed_at. On processing
-- failure we DELETE the row so Stripe's retry isn't blocked by the
-- idempotency gate — transient failures (Supabase blip, etc.) should still
-- get retried. The processing_error column is reserved for future ops use.

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id          text         PRIMARY KEY,
  event_type        text         NOT NULL,
  received_at       timestamptz  NOT NULL DEFAULT now(),
  processed_at      timestamptz,
  processing_error  text
);

-- Used to find recent failures during incident triage.
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_received_at
  ON stripe_webhook_events (received_at DESC);

-- RLS on. No public policies — service role only (webhook handler).
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
