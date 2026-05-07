-- 0034: Daily-deterministic free demo niche.
--
-- BACKGROUND:
-- After 0033 introduced `users.first_login_at`, the auth callback redirects
-- a brand-new free user's very first authenticated visit to a single
-- fully-unlocked niche detail page (the "WOW first 30s" experience).
--
-- HARD REQUIREMENT (per user 2026-05-07):
-- ALL free users who sign up on the SAME calendar day (UTC) must see the
-- EXACT SAME demo niche. No "spin the wheel by spinning up 20 Google
-- accounts" exploit. Doing the pick at query-time with `dayOfYear % count`
-- against scan_results_latest is NOT enough — the underlying view churns
-- (a niche can drop out of `is_spike=true` mid-day), giving different
-- accounts different reveals depending on the second they signed up.
--
-- STRATEGY:
-- A `daily_demo_niche` table with `date` as PK pins one scan_result_id per
-- UTC day. The first sign-in of the day inserts the row (idempotent via
-- ON CONFLICT). Every subsequent sign-in that day reads back the same row.
--
-- Race resilience: if two callbacks race the INSERT, the unique-by-PK
-- guarantees only one row is created; the loser sees the winner's pick on
-- a follow-up SELECT.
--
-- RLS:
-- Anon + authenticated SELECT (every browser must be able to read the
-- pinned pick to render the demo niche detail page even when not yet
-- logged in, e.g. a redirect on the first paint while session warms).
-- Writes go through the service-role client only (auth callback path).
--
-- LIFECYCLE:
-- Rows are append-only; we keep the full history (analytics, "what was
-- yesterday's WOW niche?"). No retention policy needed at this scale —
-- 365 rows/year, negligible.
--
-- IDEMPOTENCY:
-- CREATE TABLE IF NOT EXISTS + idempotent policy creation so re-running is safe.

CREATE TABLE IF NOT EXISTS public.daily_demo_niche (
  date              date PRIMARY KEY,
  scan_result_id    uuid NOT NULL REFERENCES public.scan_results(id) ON DELETE RESTRICT,
  youtube_channel_id text NOT NULL,
  picked_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.daily_demo_niche IS
  'Pinned WOW demo niche per UTC date. First auth/callback of the day inserts; subsequent reads see the same row. Cannot be replayed by spinning up multiple accounts.';

ALTER TABLE public.daily_demo_niche ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_demo_niche read all" ON public.daily_demo_niche;
CREATE POLICY "daily_demo_niche read all"
  ON public.daily_demo_niche
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policy. Service-role bypasses RLS, all writes go
-- through the auth callback's service client.
