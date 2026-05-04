# 2026-05-05 — Post-launch debug memo

Session 2026-05-04 → 2026-05-05 ended with three open issues uncovered during the first welcome-email smoke test from a fresh Google account (`kitsada2563p@gmail.com`). One was fixed this session; two are queued for the next.

## What shipped this session

* `feat(email): welcome email on first sign-in via Resend` — commit `ad4f084`
  * Migration `0027_welcome_email_flag.sql` adds `welcome_email_sent_at` column on `public.users`.
  * `src/lib/email/resend.ts` (typed wrapper) + `src/lib/email/templates/welcome.ts` (HTML template, no em-dashes).
  * Auth callback hook: `maybeSendWelcome` runs after session exchange; failures leave the flag NULL for retry on next sign-in.
  * 7 unit tests cover greeting fallbacks, HTML escaping, CTA URL, em-dash detection.

* Post-login redirect fix (separate commit, queued for push at end of this session)
  * Was: `/dashboard` (the empty Saved Niches view, catastrophic first impression).
  * Now: `/discover?type=longform` (live niche cards, default to quality mode while trend engine calibrates).

## Issue 1 — Welcome email did not deliver during smoke test

**Symptom:** New Gmail signed in, no email arrived (10+ minutes, not in spam either). User did successfully reach `/dashboard` so the auth flow itself worked.

**Most likely root causes (ranked):**

1. **Resend API key domain restriction mismatch.** When the user created the production API key, they restricted it to `surgeniche.com`. We send `from: noreply@send.surgeniche.com` (subdomain). Resend may treat the restriction as exact-match rather than suffix-match. **Confirm via Vercel logs** — `[auth/callback] welcome email send failed; will retry next login` line will include the Resend error message; "domain not verified" or "you can only send from..." indicates this case.

2. **Vercel deploy timing.** User may have tested before commit `ad4f084` finished deploying. Confirm by checking the deploy timestamp vs. login timestamp in Vercel.

3. **Resend reputation / Gmail spam.** First email from a freshly verified domain occasionally lands in spam folders Gmail does not surface (Promotions tab, Updates tab, All Mail). Less likely after explicit user check.

**Debug recipe for next session:**

1. Open Vercel → SurgeNiche project → Deployments → click commit `ad4f084` → Functions tab → search for `/auth/callback` invocations from yesterday.
2. Check log lines starting with `[auth/callback]`. Three diagnostic outcomes:
   * No `[auth/callback]` lines at all → callback wasn't hit (deploy timing issue, or session restored from cookie without OAuth round-trip).
   * `welcome email send failed... no_api_key` → `RESEND_API_KEY` env var didn't propagate to runtime; verify in Vercel → Settings → Environment Variables that it's marked Production + Preview.
   * `welcome email send failed... <Resend error>` → that's the actual reason. Most likely "from" domain mismatch.

**Fix paths once root cause is confirmed:**

* If domain restriction: simplest fix is to **delete the current Resend key** and create a new one with **no domain restriction** (or with a wildcard if Resend supports it). Replace `RESEND_API_KEY` value in Vercel, redeploy.
* Alternative: change the `FROM` constant in `src/lib/email/resend.ts` to `noreply@surgeniche.com` (apex). This requires adding an SPF record on the apex, which conflicts with the existing apex SPF for Email Forwarding (we removed that, so apex SPF slot is currently empty — adding `v=spf1 include:amazonses.com ~all` on apex would work).
* Recommended: **stay on `noreply@send.surgeniche.com`** and fix the API key. The `send.` subdomain is the standard Resend pattern; its SPF/MX/DKIM is already wired.

## Issue 2 — Post-login lands on empty Saved Niches view (FIXED this session)

Auth callback was redirecting to `/dashboard`, which is the user's saved-niches page. For a new user with no saved niches that's an empty illustration with "No saved niches yet" copy. Worst possible first impression.

Now redirecting to `/discover?type=longform`. Free users see the niche feed in quality mode (because `NEXT_PUBLIC_TREND_ENGINE_BOOTSTRAPPED` is still false during the 48-72h trend warmup). This puts live value in front of them immediately.

The welcome email's CTA still points to `/trending` (cluster view). After `NEXT_PUBLIC_TREND_ENGINE_BOOTSTRAPPED` is flipped to `true`, we may want to switch the post-login redirect to `/trending` as well to fully match the email message.

## Issue 3 — Free tier shows zero unlocked niches in initial 5-card view (P1, NOT YET FIXED)

**Symptom:** Free user lands on `/discover?type=longform` (or shorts), sees 5 niche cards, ALL locked + blurred. Header reads "1 of 1 niche unlocked · top 4 paywalled" but no card actually shows the unlocked state.

**Root cause:** Mismatch between three pieces of code:

* `src/lib/tier/reveal.ts` picks the free reveal index from `[FREE_REVEAL_RANGE_START=4, FREE_REVEAL_RANGE_END=14]` (positions 4-14 of the sorted feed).
* `src/lib/tier.ts` says `getMaxNichesVisible(free) = 5`. But the discover page actually slices `results.slice(0, visibleCount)` with `visibleCount = 5` initially, regardless of tier.
* So: free user sees positions 0-4. Reveal logic picks one position from 4-14. Math: 1/11 chance the picked position falls inside the visible 5; 10/11 chance it's hidden behind the "Show more" button.

The original design intent (per comment in `reveal.ts`): "always-locked top 4 is the FOMO core: FREE users see 4 blurred cards with visible scores RANKED HIGHER than their unlocked one". That implies the unlocked card should be **rendered at visual position 4 (5th card)** even when its underlying rank is 4-14. The current page does NOT reorder for free tier; it shows raw sort order, leaving the unlocked card off-screen most of the time.

**Two candidate fixes:**

* **Fix A (simple, narrows rotation):** Change `FREE_REVEAL_RANGE_END = 4` in `reveal.ts`. Free reveal always picks position 4. Loses the rotation-based "different users see different reveals" marketing surface; keeps the visual design honest.
* **Fix B (preserves rotation, more code):** In `src/app/discover/page.tsx`, when `userTier === 'free'`, build a derived array `[...results.slice(0, 4), results[freeRevealIndex]]` and render that instead of `results.slice(0, visibleCount)`. Hide "Show more" for free users (or have it open the upsell modal). Top 4 stay paywalled (FOMO), the 5th is the rotating reveal. This matches the original design intent.

**Recommendation:** Fix B. It preserves the rotation marketing angle and the "always 1 unlocked" promise. ~30 lines of change in `discover/page.tsx`, adding a `visibleResults` memoized derivation. Tests would assert: free tier renders exactly 5 cards, indices 0-3 are sorted-top-4, index 4 has `revealed=true`.

## Recommended order for next session

1. **Email debug** (5-10 min): pull Vercel logs, identify Resend error, fix API key or `FROM` based on findings. Re-test welcome email with a fresh Gmail.
2. **Fix B for free tier reveal** (20-30 min): rebuild `visibleResults` for free tier in `discover/page.tsx`, add a unit test that verifies the contract.
3. **Smoke test combined**: log in fresh Gmail → see welcome email + see `/discover` with one unlocked niche at position 5.
4. **Top-nav `/trending` link** (#4 polish from earlier todo): 5-min change.
5. **Wait the remaining trend-engine warmup window**, then flip `NEXT_PUBLIC_TREND_ENGINE_BOOTSTRAPPED=true`.

After those: the launch checklist is genuinely complete. Stripe is live, webhook fires, smoke test passed, welcome email works, free tier teases value, trend engine surfaces live signals. Time to share the link.
