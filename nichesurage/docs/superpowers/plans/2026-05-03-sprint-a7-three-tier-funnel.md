# Sprint A.7 — Three-Tier Conversion Funnel

**Goal:** Replace the current generous FREE tier (5 niches × 3 searches = 15 unlocked cards/day, effectively a free Basic) with a strict reveal-locked funnel that creates strong upgrade triggers at every tier boundary.

**Strategic intent:** every tier must give a meaningfully better product than the one below it, and FREE must give *just enough* to prove the app works without satisfying the actual job-to-be-done.

---

## Final tier spec

| Capability                  | FREE                                | BASIC                                  | PREMIUM            |
|-----------------------------|-------------------------------------|----------------------------------------|--------------------|
| Unlocked niche cards        | **1** (rotates /6h, position 10–20) | **10** (rotates /24h, top 1–10)        | **all** (top 50)   |
| Blurred FOMO above          | top 1–9 (forever locked)            | positions 11+ (Premium territory)      | —                  |
| AI deep-dive (Health + Angles, **bundled**) | ❌                                  | **1 / 24h** (one niche per day)        | ∞                  |
| Saves                       | 0                                   | 10                                     | ∞                  |
| Filters                     | ✓ (don't change reveal slot)        | ✓                                      | ✓                  |
| Trending Topics chips       | ✓                                   | ✓                                      | ✓                  |
| 30-day spike chart          | ✓ (on the unlocked one)             | ✓                                      | ✓                  |

**Conversion ladder:**
- **FREE → BASIC:** "I see 1 niche per 6h, the top 9 are always blurred → I want them"
- **BASIC → PREMIUM:** "I see 10/day but can only AI-analyze 1 → I want unlimited analysis and the long tail"

**The "AI deep-dive" is bundled** — running Health Check OR Content Angles on a niche consumes the daily allowance for both. This forces Basic users to choose one niche/day to analyze fully → the obvious upgrade trigger is "I want to analyze more than one".

---

## Architecture

### Reveal logic — deterministic, no DB writes

For both FREE and BASIC, which cards are "unlocked" is computed deterministically from `(user_id, current_window)`:

```ts
// FREE: 1 unlocked card from positions 9–19 of full sorted list
function getFreeRevealedIndex(userId: string, now: Date, poolSize: number): number {
  const window = Math.floor(now.getTime() / (6 * 60 * 60 * 1000))
  const seed = hashStringToInt(userId + ':' + window)
  const range = Math.min(11, Math.max(0, poolSize - 9)) // positions 9 to min(19, end)
  return 9 + (seed % Math.max(1, range))
}

// BASIC: top 10 always (positions 0–9), refreshed visually every 24h via cache key
// In practice BASIC just sees positions 0–9 of the current sort.
// The "rotates /24h" framing is implementation-friendly because the underlying
// scan_results_latest view itself rotates as new scans land — no extra logic.
```

**Why deterministic:**
- No new DB tables for reveal tracking
- Same user in same 6h window always sees the same niche (predictable, sharable)
- Different users in same window see different niches (fair distribution)
- Window advances → reveal rotates automatically

**Edge cases:**
- If filter result has < 10 items, BASIC sees all of them, FREE sees the last one
- If filter result has 0 items, FREE sees empty + "next reveal in Xh Ym"

### AI rate limiting — new `ai_usage_daily` table

**Correction from initial plan:** the existing `niche_health_checks` and `content_angles_cache` tables are *shared caches* keyed by `scan_result_id` with a unique constraint — they have no user dimension. We need a small dedicated table.

```sql
-- supabase/migrations/0020_ai_usage_daily.sql
create table if not exists public.ai_usage_daily (
  user_id uuid not null references public.users(id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);

create index if not exists ai_usage_daily_recent_idx
  on public.ai_usage_daily (user_id, day desc);

alter table public.ai_usage_daily enable row level security;

create policy "users see their own ai usage"
  on public.ai_usage_daily for select
  to authenticated
  using (user_id = auth.uid());
-- INSERT/UPDATE go through service_role (the API route runs server-side
-- with the SSR client, which is auth.uid()-aware; we keep service_role
-- as the writer to avoid race surfaces).
```

Server helper:
```ts
// src/lib/tier/aiUsage.ts
async function getAiRunsToday(userId: string, supabase): Promise<number> {
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD UTC
  const { data } = await supabase
    .from('ai_usage_daily')
    .select('count')
    .eq('user_id', userId)
    .eq('day', today)
    .maybeSingle()
  return data?.count ?? 0
}

async function incrementAiRun(userId: string, supabase): Promise<void> {
  const today = new Date().toISOString().slice(0, 10)
  // Upsert with atomic increment via SQL RPC, or two-step (read, write)
  // with optimistic concurrency. Using a tiny RPC is cleanest.
  await supabase.rpc('increment_ai_usage', { p_user_id: userId, p_day: today })
}
```

We add a small SQL function `increment_ai_usage(p_user_id, p_day)` to do `INSERT … ON CONFLICT … DO UPDATE SET count = count + 1` atomically, returning the new count.

Quota semantics: every successful API call increments, even cache hits. From the user's perspective they "used" their daily AI deep-dive regardless of whether we served from cache.

API routes (`/api/health-check/[id]`, `/api/content-angles/[id]`) check this count and:
- `tier === 'free'` → always 403
- `tier === 'basic'` && `count >= 1` → 429 with body `{ error: 'daily_limit', resetAt: ... }`
- `tier === 'premium'` → always allowed

### Frontend tier-aware components

Rewrite `src/lib/tier.ts`:
- Remove old helpers (`getMaxNichesVisible`, `getDailySearchLimit`, `getSubscriberRange` rules)
- Add: `getRevealedIds(tier, sortedNicheIds, userId, now): Set<string>`
- Add: `canRunAiToday(tier, runsToday): { ok: true } | { ok: false; reason: 'tier' | 'limit' }`
- Add: `getNextRevealAt(tier, now): Date | null` (FREE only)
- Add: `getSaveLimit(tier): number` (free=0, basic=10, premium=Infinity) — keep existing

`NicheCard` accepts `revealed: boolean` instead of guessing from tier; the parent (DiscoverPage) decides revealed state via `getRevealedIds`.

DiscoverPage adds:
- For FREE: countdown "Next reveal in 4h 22m" near the cards header
- For BASIC: "1 AI deep-dive available today" or "Used today, resets in Xh"
- For both: clicking blurred card opens an upsell modal instead of the niche detail page

---

## Files affected

**Library:**
- `src/lib/tier.ts` (rewrite)
- `src/lib/tier/aiUsage.ts` (new — server-side count helper)
- `src/lib/tier/reveal.ts` (new — deterministic reveal logic + tests)

**API:**
- `src/app/api/health-check/[id]/route.ts` (add tier + daily quota check)
- `src/app/api/content-angles/[id]/route.ts` (add tier + daily quota check)

**Frontend (Discover):**
- `src/app/discover/page.tsx` (compute revealed set, pass to cards, render countdown)
- `src/components/niche/NicheCard.tsx` (accept `revealed: boolean`)
- `src/components/niche/UpsellModal.tsx` (new — opens on blurred-card click)
- `src/components/niche/RevealCountdown.tsx` (new — for FREE users)

**Frontend (Niche detail):**
- `src/app/discover/niche/[id]/page.tsx` (block FREE entirely, add Basic quota state)
- `src/components/niche/HealthCheckInline.tsx` (handle 429, show "Used today")
- `src/components/niche/AIContentAngles.tsx` (handle 429, show "Used today")

**Marketing copy:**
- `src/components/landing/copy.ts` (rewrite `pricingFreeFeatures`, `pricingBasicFeatures`, `pricingPremiumFeatures` for both EN + DE; add new copy keys for countdown, quota messages, upsell modal)
- `src/components/landing/PricingSection.tsx` (add a comparison table below the cards — the matrix from the spec table at the top of this file)
- `src/components/landing/FaqSection.tsx` (new — "How does the 6h reveal work?", "What does Basic get?", "Why is the top 9 always locked?")
- `src/components/landing/LandingPage.tsx` (mount FaqSection between PricingSection and Footer)

**Tests:**
- `src/lib/tier/reveal.test.ts` (new — deterministic reveal across windows + users)
- `src/lib/tier/aiUsage.test.ts` (new — count logic, mocked supabase)
- Update `src/lib/tier.test.ts` (remove obsolete cases, add new ones)
- Update `src/components/niche/NicheCard.test.tsx` (revealed prop)
- Update existing API route tests for 429 handling

**Estimate:** ~16 files (10 changes + 6 new), ~700 LOC, 6 commits broken by phase (Phase 0 + Phases 1–5).

---

## Phases

### Phase 0 — Google OAuth only (auth hardening) **— PRECONDITION**

**Why first:** the entire freemium model is built on `user_id` being expensive to multiply. Magic-link + password authentication on disposable emails makes `user_id` essentially free to mint, which means a determined user can defeat the 1-reveal-per-6h FREE limit by registering 4 throwaway addresses. Closing this vector is a *precondition* for the rest of Sprint A.7 — without it, the tier limits are theater.

**Scope:**
1. Add a Google OAuth button as the primary CTA on `LoginForm.tsx`
2. Remove the email/password sign-in path entirely (no fallback)
3. Remove the magic-link path entirely (no fallback)
4. Keep `/auth/callback` route as-is — Supabase handles OAuth callback through the same endpoint
5. Update `LoginForm.tsx` copy: "Sign in with Google" — single CTA, no alternatives
6. Manual step (user, Supabase Dashboard): enable Google provider, set authorized redirect URI to `https://surgeniche.com/auth/callback`
7. Manual step (user, Google Cloud Console): create OAuth 2.0 client ID, add `surgeniche.com` to authorized origins, get client ID + secret into Supabase

**Files affected:**
- `src/app/login/LoginForm.tsx` (rewrite — Google-only flow)
- `src/app/login/LoginForm.test.tsx` (update — assert Google CTA, no password/magic UI)
- `src/components/landing/copy.ts` (add `loginGoogleCta`, EN + DE)

**Existing users (email/password):** the app is fresh post-Sprint-A.6, real user count is ~0–single digits. Supabase auto-links by email when a user signs in via Google with the same email as their existing account — no migration code needed. If anyone screams later, we add a one-time backfill script.

**Apple Sign In:** future. Not in this sprint. Google + Apple covers ~99% of relevant audience but Apple alone adds App Store Connect overhead we don't need yet.

**Commit 0:** `feat(auth): Google OAuth only — close fake-email abuse vector`

### Phase 1 — Reveal core (lib only, fully unit-testable)
1. Write `src/lib/tier/reveal.ts` with `getRevealedIds`, `getNextRevealAt`, `hashStringToInt` helpers + comprehensive tests for window math, distribution across users, edge cases (small pools, empty pools).
2. Write `src/lib/tier/aiUsage.ts` server helper + mocked unit tests.
3. Rewrite `src/lib/tier.ts` exporting the new public surface; deprecate old helpers but keep `getSaveLimit` and `canViewChannelDetails`.

**Commit 1:** `feat(tier): deterministic reveal logic + AI quota helpers`

### Phase 2 — API enforcement
1. `/api/health-check/[id]/route.ts`: pull tier from `users` row, count today's runs via `getAiRunsToday`, gate accordingly.
2. `/api/content-angles/[id]/route.ts`: same gating (shared quota).
3. Both return structured 429 with `{ error: 'daily_limit', tier, resetAt }`.

**Commit 2:** `feat(api): tier-aware AI rate limiting`

### Phase 3 — Discover UI
1. `DiscoverPage`: compute `revealedIds` from `useUser().tier` + sorted results, pass `revealed={revealedIds.has(niche.id)}` to each `NicheCard`.
2. `NicheCard`: accept `revealed: boolean`, blur logic driven by that prop, click handler routes to upsell modal when `!revealed`.
3. New `RevealCountdown` component for FREE — reads `getNextRevealAt(tier, now)`, ticks every second.
4. New `UpsellModal` component — minimal: "Top 1–9 are Basic territory. €7.50/mo. Upgrade?" with CTA.

**Commit 3:** `feat(discover): tier-aware reveals + upsell flow`

### Phase 4 — Niche detail enforcement
1. Niche detail page checks if niche is in user's `revealedIds`. If not (e.g., FREE user typed URL directly) → redirect to `/pricing` or show paywall.
2. `HealthCheckInline` and `AIContentAngles` handle the 429 response with a "Used 1/1 today, resets in Xh" UI state distinct from the existing tier-locked state.

**Commit 4:** `feat(niche): enforce reveal access + AI quota UI`

### Phase 5 — Marketing copy + FAQ
1. Rewrite `pricingFreeFeatures` / `pricingBasicFeatures` / `pricingPremiumFeatures` in both EN and DE to match new spec.
2. Add tier comparison table below pricing cards on landing.
3. New `FaqSection` with 6–8 Q&As covering reveal mechanic, AI quota, upgrade path, refund/cancel.
4. Mount in landing page above footer.

**Commit 5:** `feat(landing): tier comparison table + FAQ section`

---

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Users find that 1 unlocked /6h is too restrictive and bounce | Show countdown prominently + tease blurred top 9 with score numbers visible — make the wait *productive*, not punishing |
| AI quota count is racy if user fires two requests at once | Idempotent: count rows for last 24h *after* writing the new row; if > 1, return success but log warning. Two simultaneous requests will both succeed but the third in 24h will fail. Acceptable. |
| Basic users feel cheated when AI deep-dive consumed prematurely | Confirmation modal: "This will use your daily AI run on '<niche name>'. Continue?" — only on first run of the day for that user |
| Filter changes for FREE confuse users (unlocked card disappears) | If unlocked id falls outside filter results, show explicit empty state: "Your reveal '<niche label>' is hidden by current filters. [Reset filters] or wait Xh for a new reveal." |
| Existing users who paid for Basic see capability *reduce* (20→10 niches) | Grandfather: read `subscription.created_at`; users created before Sprint A.7 deploy keep old caps. Out-of-scope for this sprint, defer to a separate compat layer if anyone screams. |

---

## Success criteria

- [ ] Login page only shows "Sign in with Google" — no password, no magic link visible
- [ ] Google OAuth completes round-trip → `/dashboard` → `users` row created with email and tier=free
- [ ] FREE user sees exactly 1 unlocked card; rotation verified in 2 different 6h windows
- [ ] BASIC user sees exactly 10 unlocked cards (top of sorted list)
- [ ] BASIC user can run Health Check OR Content Angles once, second attempt blocked with structured 429
- [ ] PREMIUM user sees all results, no AI quota
- [ ] Pricing page shows the new tier matrix + FAQ section
- [ ] Tests: 100% pass, new reveal/quota logic covered
- [ ] tsc clean, jest green
