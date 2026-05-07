-- 0033: Track when each user first completed sign-in so we can route their
-- very first authenticated visit to a single fully-unlocked "WOW" niche
-- detail page instead of /discover (where free users see mostly locked
-- cards, a poor first impression).
--
-- BACKGROUND:
-- Per the 2026-05-06 polish-round handoff memo (Issue 2 follow-up), new
-- free users currently land on /discover after Google OAuth. They see five
-- niche cards with the FREE tier reveal mechanic (top 4 paywalled FOMO,
-- one rotating unlocked). That reads as "you are locked out" rather than
-- "look what we found".
--
-- Strategy: redirect the first sign-in to /discover/niche/<id>?freeDemo=true
-- with a daily-rotating top niche, rendered without paywall. After the
-- demo is dismissed, all subsequent navigation behaves normally.
--
--   * Column starts NULL (existing rows + new sign-ups).
--   * Auth callback: if NULL → set to now() + redirect to demo niche.
--   * If callback runs again on same user (rare race), the NOT NULL guard
--     prevents the demo from re-firing.
--
-- IDEMPOTENCY: ADD COLUMN IF NOT EXISTS so re-running is safe.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS first_login_at timestamptz;

COMMENT ON COLUMN public.users.first_login_at IS
  'Timestamp of the user''s first authenticated callback hit. NULL = never logged in yet (next callback will fire the freeDemo redirect).';
