-- 0053_users_admin_extension.sql
--
-- Extend public.users with admin-controllable fields:
--   tier_source       — distinguishes Stripe-paid tiers from manual admin
--                       grants. NULL for free, 'stripe' for paying, 'manual'
--                       for admin-granted (e.g. partner, comp, refund).
--                       'partner' enum value DROPPED in v1 (YAGNI).
--   tier_expires_at   — only meaningful when tier_source='manual'. Cron in
--                       Phase 1 will downgrade to 'free' past this date.
--                       App-layer resolveUserTier() reads it as safety net.
--   banned_at         — soft-ban marker. App reads users.banned_at to gate
--                       login + active session. NULL = not banned.
--   banned_reason     — admin's typed reason at ban time (audit-friendly).
--   is_admin          — DB-backed admin flag. Defense-in-depth alongside
--                       ADMIN_EMAILS env. RLS in 0054 reads this.
--
-- Backfill rules:
--   1. Every user with stripe_customer_id IS NOT NULL gets
--      tier_source='stripe' (their current tier came from a paid sub).
--   2. The hardcoded primary admin email
--      vikmartin.online@gmail.com gets is_admin=true.

ALTER TABLE public.users
  ADD COLUMN tier_source     text,
  ADD COLUMN tier_expires_at timestamptz,
  ADD COLUMN banned_at       timestamptz,
  ADD COLUMN banned_reason   text,
  ADD COLUMN is_admin        boolean NOT NULL DEFAULT false;

ALTER TABLE public.users
  ADD CONSTRAINT users_tier_source_check
  CHECK (tier_source IS NULL OR tier_source IN ('stripe', 'manual'));

-- Backfill 1: paying users → tier_source='stripe'
UPDATE public.users
  SET tier_source = 'stripe'
  WHERE stripe_customer_id IS NOT NULL
    AND tier_source IS NULL;

-- Backfill 2: primary admin email
UPDATE public.users
  SET is_admin = true
  WHERE lower(email) = 'vikmartin.online@gmail.com';
