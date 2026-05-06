# 2026-05-06 — Handoff before Claude Code restart for Design skill

User is restarting Claude Code to pick up an update. Frontend-design plugin is in their marketplace cache but not active in current session — likely auto-enables after restart.

## Where we are (verified)

### Today's session shipped (master HEAD)

| PR | Title | Status |
|---|---|---|
| #9 | Phase 5b discovery routes (trending/expand/evict/promote + migration 0031) | merged `cde74e5` |
| #10 | Discovery API: search.list+viewCount instead of mostPopular | merged `0722f4f` |
| #12 | Discovery uses seed_keywords (q parameter) instead of videoCategoryId | merged `6b95c07` |
| #13 | Diagnostic: raw YouTube response in trending route | merged `b6905cf` |
| #14 | Live carousel counts + relax cluster filter | merged `fb8901d` |
| #15 | content_type detection in discovery + migration 0032 backfill | merged `44e5c6c` |
| #16 | Unified Discover surface (one grid, no Shorts/Longform tabs) | merged `1bbb979` |
| #17 | Sort by opportunity_score desc instead of recency-first | merged (verified live) |

### Open branch / unmerged work

`fix/discover-sort-by-score` has TWO commits:
1. `55f288b` — sort fix (already merged via #17 squash; the commit above this on the branch was squashed into master)
2. `995a5af` — `polish(detail): YouTube CTA in real brand red with logo + hover lift` — **NOT YET MERGED, no PR opened**

Next session needs to: open PR for the YouTube polish commit, or roll it into a larger polish PR (recommended: roll into the polish PR that comes from the design skill pass).

### Production state

- 200+ active channels in `channels_watchlist` (45 shorts, 106 longform from trending_feed + ~49 legacy)
- Discovery cron registered: `/api/discovery/trending` daily 02:00 UTC; `/api/discovery/expand` 4h; `/api/discovery/evict` 03:00; `/api/discovery/promote` 03:30
- `YOUTUBE_API_KEY` in Vercel: correct `AIzaSy...` from Google Cloud (was set wrong earlier today, fixed)
- `YOUTUBE_API_KEY` in Supabase secrets: hash starts `40283c4b...` (this is the SHA256 digest, NOT the value; actual value is the same `AIzaSy...` and works for legacy Deno discover function)
- Migration 0032 applied (45 trending_feed channels retagged from longform to shorts)
- Manual `scan_results.content_type` sync ran (12 channels surfaced as shorts now appear correctly on shorts surface)

### Unified Discover (new, working)

- Top nav: `Discover · My Channels`
- /discover renders unified grid with two-mode toggle: `Hot Now` (default) / `All Channels`
- Hot Now sort: `opportunity_score desc`, `tier_entered_at desc` tiebreaker, within last 14 days
- All Channels sort: `opportunity_score desc`, no recency window
- Each card has `<ContentTypeBadge>` (SHORTS/LONGFORM pill in fuchsia/indigo)
- /discover/shorts, /discover/longform, /discover/trending all redirect to /discover
- /dashboard renamed heading: "My Channels"
- 397/397 jest tests pass
- 12 cards visible by default, "Show more" pagination → 60 max

## What's queued for next session (in priority)

### Immediate (after restart)

1. **Verify Design skill is now active.** If yes, run it as a polish pass over the unified Discover + landing page.

2. **Open PR for YouTube CTA polish** (commit `995a5af` already pushed to `fix/discover-sort-by-score`). Either as standalone PR or roll into bigger polish PR.

3. **Polish pass with frontend-design skill** — user requested:
   - NicheCard polishing (badges, score visual, hover, density)
   - Landing page sitne stvari (specific items they will point out)
   - Niche detail page beyond YouTube CTA

### Mid-priority (Issues from launch debug memo `2026-05-05-launch-debug.md`)

4. **Welcome email verification** — never confirmed in production. Steps:
   - Open Vercel logs for `/auth/callback` invocations from yesterday/today
   - Look for `[auth/callback] welcome email send failed` lines
   - If error mentions Resend domain — fix API key restriction to allow `noreply@send.surgeniche.com`

5. **Free tier reveal Fix B** — currently free user sees random visible/hidden reveal. Memo recommends rebuilding `visibleResults` for free tier in /discover so the unlocked card always renders at visual position 5. Probably needs minor adjustment now that VISIBLE_STEP=12 (was 5).

6. **First-login UX** (user's deferred vision):
   - Migration: `users.first_login_at` column
   - `pickFreeDemoNiche()` helper (top 1 by score)
   - Auth callback redirect to `/discover/niche/[id]?freeDemo=true` for first login
   - Niche detail page: render fully unlocked when `freeDemo=true`
   - 2nd visit defaults to /discover normally

### Low priority

7. **Counter cosmetic fix** in `insertCandidateChannel` — channels are inserted but route returns `totalInserted: 0` because Supabase upsert with `ignoreDuplicates: true` returns count=0 even on success. Fix: use `.select()` after upsert and check returned data length.

8. **Shorts seed_keywords paralelni discovery** — currently seed_keywords table only has longform seeds; trending route still surfaces shorts because search results are mixed but a dedicated shorts seed pool would broaden coverage.

9. **Remove dormant components** — TrendingTopics.tsx, HotNowFilter.tsx, SearchFilters.tsx still exist but unreferenced after PR #16. Either delete or document as dormant.

## Important context for next session

### User preferences (locked)
- **Avoid em-dashes (—)** in UI copy and chat. User explicitly called this out as AI tell.
- **Communicate in srpski/bosanski**, technical terms in English are fine.
- **Phase-by-phase commits**: tsc → jest → focused git add (NEVER `-A`) → commit → push → next phase.
- **No "možda" / "verovatno"** when guessing — user wants ground truth before iterating.

### Architecture key points
- `/api/discovery/trending` uses `q=<seed>` from seed_keywords (NOT videoCategoryId or mostPopular — those return 0)
- `scan_results_latest.content_type` is a separate column from `channels_watchlist.content_type` — when retagging, BOTH need sync (we did this manually for the 45 mistagged rows; long-term refactor would JOIN live)
- `niche_clusters.member_count` is stale — always derive live counts from `scan_results_latest` JOIN
- `tier_entered_at` lives on `channels_watchlist`, NOT `scan_results_latest` — fetcher must do 2 queries to join

### Branches to be aware of
- `master` HEAD: `1bbb979` (after PR #17 merged it'll advance further)
- Active worktree: `.claude/worktrees/infallible-germain-89d9e5` — currently on `fix/discover-sort-by-score`
- Master worktree: `C:/Users/AURUMPC/Desktop/YT-app` (used by another git operation; can't checkout master here)

### What's been verified live on prod
- /discover loads with proper score-desc sort ✅ (last user screenshot: 57, 55, 51, 50, 49, 42, 36, 36, 35, 34, 34, 32 — clean descending)
- SHORTS/LONGFORM badges render on cards ✅
- Top nav shows Discover · My Channels ✅
- No more Trending Topics carousel ✅
- Old /discover/longform redirects to /discover ✅

### What's NOT yet verified live
- Welcome email actually delivers
- First-login flow for genuinely new free user
- /api/discovery/expand on Vercel with yt-dlp (Phase 5b deferred)

## After polish PR lands

The launch checklist is essentially:
- ☑ Stripe live + €9 smoke
- ☑ Resend domain verified, RESEND_API_KEY in Vercel
- ☑ Welcome email code shipped (delivery unverified)
- ☑ Trend engine working
- ☑ Discovery loop adding ~150 new channels per major run
- ☑ Unified clean Discover UI
- ☐ Welcome email delivery confirmed
- ☐ Free tier reveal logic visible to user
- ☐ Polish pass complete
- ☐ Discord launch share
