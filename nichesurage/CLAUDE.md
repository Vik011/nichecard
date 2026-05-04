# SurgeNiche — Project Notes for Claude

Production: `https://surgeniche.com` · Repo: `Vik011/nichecard` · Stack: Next.js 14 (App Router), Supabase, TypeScript, Tailwind, Jest.

This file documents gotchas, conventions, and lessons learned. Read before making changes.

---

## Workflow conventions (user preferences)

- **Jezik:** Korisnik komunicira na srpskom/bosanskom. Odgovaraj na istom jeziku, sem za tehničke termine.
- **Phase-by-phase:** Posle svake faze: `tsc --noEmit` → `jest` → focused `git add` (NIKAD `git add -A`) → commit → push → tek onda sledeća faza. Ne nakupljati promene.
- **Subagent-driven dev** je default za implementacijske taskove (opcija 1 u writing-plans skill).
- **Iskrena ekspert preporuka:** ako korisnik predloži loš pristup, reci jasno + zašto + šta jeste bolje. Pre velikih arhitektonskih odluka postavi 2-4 ključna pitanja.
- **Verifikacija pre claim-a "deployed":** uvek end-to-end (UI screenshot ili HTTP probe), ne samo exit code od `db push` ili `vercel deploy`.

---

## Build / TypeScript gotchas

### `--downlevelIteration` u tsconfig je OFF
Spread operator NAD iteratorima (Map.values(), URLSearchParams.keys(), Set, itd.) **puca u Vercel build-u** iako lokalno radi sa novijim Node-om.

❌ `[...map.values()]`, `[...searchParams.keys()]`
✅ `Array.from(map.values())`, `Array.from(searchParams.keys())`

Stradali fajlovi do sada: `sentry.shared.ts:20`, `src/lib/admin/queries.ts`. Uvek koristi `Array.from()` za iteratore.

### `tsconfig.json` exclude
`"supabase"` MORA biti u `exclude` array (Deno edge functions koriste različit TS config). Ako se obriše, lokalni `tsc --noEmit` puca.

---

## Supabase patterns

### Tri klijenta — koji kad
- **`src/lib/supabase/server.ts`** — RSC, čita `cookies()`, poštuje RLS. Default izbor u Server Componentima.
- **`src/lib/supabase/client.ts`** — browser/client komponente.
- **`src/lib/supabase/service.ts`** — service-role, **bypassuje RLS**. Koristi za:
  - Stripe webhook handler (piše u `users` table)
  - Admin queries (`src/lib/admin/queries.ts`)
  - Bilo šta što treba videti rows preko više usera

**Pravilo:** ako handler piše u tabelu sa RLS i radi cross-user posao, **mora** koristiti service client. Anon klijent + RLS će tiho odbacivati write-ove (HTTP 500 sa praznim body-jem na webhook-u — bilo nas u Sprint A.5).

### Vercel env vars za service-role
`SUPABASE_SERVICE_ROLE_KEY` mora biti u **Production + Preview** env varovima (Sensitive ON). Provera pre deploy-a:
```
grep -r "createServiceClient\|SUPABASE_SERVICE_ROLE_KEY" src/
```
Sva mesta moraju imati key dostupan u runtime-u.

### Migrations: posle ALTER TABLE / RLS izmene MORAŠ verifikovati
- Probaj REST query istog selekta sa **anon key**, ne samo service_role
- View-ovi koji rely-uju na promenjene kolone često treba DROP + CREATE (Postgres ekspanduje `select *` u eksplicitne kolone)
- Pre `TRUNCATE CASCADE` proveri `pg_depend` query — Sprint A bug: cascade obrisao 4 dodatne tabele preko FK-ova
- End-to-end UI screenshot pre claim-a "live"

### Migration numbering
Najnoviji: `0023_stripe_webhook_idempotency.sql`. Numerisi sledeću kao `0024_*.sql`. Migration se primenjuje **manuelno** preko Supabase SQL editora — `db push` se NE koristi u ovom projektu (CI nije setup).

---

## Vercel deployment gotchas

- **Env vars promene zahtevaju Redeploy** — Vercel ne pickuje nove env vars na sledećem requestu. Settings → Environment Variables → dodaj → Deployments → najnoviji → ⋯ → **Redeploy**. Bez ovog koraka, app će videti stari env (i.e. 404 na `/admin` jer `ADMIN_EMAILS` undefined).
- **`NEXT_PUBLIC_*` ne sme biti Sensitive** — Vercel će ti dati žuti warning. Po definiciji su public (bundlovani u client JS).
- **Sensitive flag = nema Development env** — kad uključiš Sensitive ON, ne možeš dodati u Development environment. Production + Preview only. Za dev stavi u `.env.local`.
- **Build cache invalidation:** kad se nešto čudno dešava (stari shape vraća, npm package promenjen), redeploy bez build cache.

---

## Stripe integration

- **Test mode:** `sk_test_...` / `pk_test_...`. Test card `4242 4242 4242 4242`.
- **Webhook idempotency:** `stripe_webhook_events` table sa `event_id` PRIMARY KEY. Handler radi INSERT-then-process; PG_UNIQUE_VIOLATION (23505) → 200 duplicate bez rerun. Na processing failure → DELETE claim row da Stripe retry može da prođe.
- **Webhook URL:** `https://surgeniche.com/api/stripe/webhook` (production) — Stripe Dashboard → Webhooks
- **Event types:** `customer.subscription.created/updated/deleted`. `subscription.deleted` flipuje tier nazad na FREE kad pretplata istekne na period end.
- **Live mode aktivacija:** zahteva business info + bank. Nije aktivirano (sredinom maja 2026).

### Stripe price env mapping
- `STRIPE_PRICE_BASIC_MONTHLY` (€9), `STRIPE_PRICE_BASIC_YEARLY` (€90)
- `STRIPE_PRICE_PREMIUM_MONTHLY` (€19), `STRIPE_PRICE_PREMIUM_YEARLY` (€190)
- MRR computation: `monthly = price; yearly = price/12` (vidi `src/lib/admin/mrr.ts`)

---

## Admin dashboard

- **Route:** `/admin` (server components, `dynamic = 'force-dynamic'`, `revalidate = 0`)
- **Auth:** `requireAdmin()` u `src/lib/admin/auth.ts` — email allowlist preko `ADMIN_EMAILS` env var (comma-separated, case-insensitive). Non-admin → `notFound()` (404, ne leak-uje da ruta postoji).
- **Sve queries** koriste `createServiceClient()` jer admin po dizajnu treba da vidi rows drugih usera.
- **Sign-in:** Magic link na već postojeći user account; admin = običan user kome je email u allowlist.

---

## Cloudflare Turnstile (login bot defense)

- **Site key:** `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (public). **Secret:** `TURNSTILE_SECRET_KEY` (NIKAD `NEXT_PUBLIC_*`).
- **Bez env vars:** widget se ne renderuje, login radi (dev/local). Za eksplicitan dev bypass: `TURNSTILE_DEV_BYPASS=1`.
- **CSP:** `https://challenges.cloudflare.com` mora biti u `script-src` i `frame-src` (vidi `next.config.mjs`).
- **Verify endpoint:** `POST /api/auth/turnstile/verify` validira token + caller IP, vraća 403 na failure.
- **LoginForm:** explicit-render widget; Google sign-in dugme je gated dok ne držimo verified token.

---

## Sentry / PostHog

- Oba su **optional** — ako `NEXT_PUBLIC_SENTRY_DSN` / `NEXT_PUBLIC_POSTHOG_KEY` nije set, init je no-op (lokalni dev neće gađati prod).
- Sentry `beforeSend` hook scrub-uje URL search params (PII). NIKAD ne spread-uj iteratore tamo (vidi downlevelIteration gotcha gore).
- Source maps upload pri build-u zahteva `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` u env (build time only).

---

## Security headers (CSP)

`next.config.mjs` setuje strict CSP. Svaki put kad dodaš novu external dependency (Cloudflare, Stripe, PostHog…), proveri:
- `script-src` — JS koji se učitava sa eksternog hosta
- `frame-src` — iframe-ovi (Turnstile, Stripe Checkout)
- `connect-src` — fetch / XHR (PostHog, Sentry)
- `img-src` — slike iz CDN-a

Posle promene: production smoke test sa DevTools Console otvorenim, traži CSP violations.

A grade na securityheaders.com je baseline — ne sme ispod toga.

---

## Sensitive credentials policy

Korisnik **nikad** ne sme da zalepi API key u chat. Ako se desi:
1. Reci da NE smeš da ga koristiš.
2. Traži da ga revoke u dashboardu provider-a.
3. Pomozi step-by-step da napravi novi i sam ga doda u Vercel/Supabase env (nikad ne ti).

Plaintext chat log = security risk čak i kad je ephemeral.

---

## Common test patterns

- `*.test.ts` ide pored fajla (`src/lib/admin/mrr.ts` ↔ `src/lib/admin/mrr.test.ts`)
- Server-side testovi sa env mocking: `@jest-environment node` + `process.env = { ...ORIGINAL_ENV }` u `afterEach`
- Mock `console.warn`/`console.error` sa `jest.spyOn().mockImplementation(() => {})` da test output ostane čist
- 324/324 tests prolazi po stanju 2026-05-04. Ne mergeuj bez green test sweep-a.

---

## Sprint history (high-level)

| Sprint | What | Status |
|---|---|---|
| A.5 | Stripe checkout + webhook + paywall + production deploy | ✅ live |
| A.6 (planned) | Premium spike scanner (`premiumSpike.ts`, `0021` migration) | plan postoji, NIJE implementiran |
| A.7 | Security headers + Stripe webhook idempotency + Turnstile + Admin dashboard MVP | ✅ live (commit 73caad6) |
| Next | Premium UI surface (badge, premium-only filter, mixed Basic feed) | TODO |
| After | Pro email (support@surgeniche.com), Stripe live mode | TODO |

Worktree branch: `claude/infallible-germain-89d9e5` (PR #6). Master nije merged još — squash merge tek kad se završe svi pre-launch sprintevi.

---

## yt-dlp on Vercel — Sprint B Phase 0 verdict (2026-05-04)

**Status:** ✅ **GREEN** — works on Vercel preview after 4 iterations. Spike commit chain `cbf6d0b → bd605f2 → 431b71b → 0907af4 → e804d88`. Throwaway spike route deleted post-decision; the lessons live here.

### Final working approach

**No npm wrapper.** Native `fetch` to GitHub releases + native `child_process.spawn`. We own every line of the integration.

```ts
// 1. Pin a yt-dlp release version (NOT 'latest' — reproducibility)
const YT_DLP_VERSION = '2025.10.22'
const RELEASE_URL = `https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VERSION}/yt-dlp_linux`
const BIN_PATH = '/tmp/yt-dlp'  // /tmp is the only writable FS on Vercel

// 2. On cold start, fetch + write + chmod +x. Coalesce concurrent calls.
let downloadPromise: Promise<...> | null = null
async function ensureBinary() {
  if (fs.existsSync(BIN_PATH) && fs.statSync(BIN_PATH).size > 1_000_000) return
  if (!downloadPromise) {
    downloadPromise = fetch(RELEASE_URL).then(async (res) => {
      const buf = Buffer.from(await res.arrayBuffer())
      fs.writeFileSync(BIN_PATH, buf)
      fs.chmodSync(BIN_PATH, 0o755)
    })
  }
  await downloadPromise
}

// 3. Spawn directly with full stdio capture
spawn(BIN_PATH, ['<url>', '--skip-download', '--dump-single-json', ...])
```

### Phase 0 measured numbers
- Cold start: **~4.8s** total (≈3s GitHub fetch + 1s yt-dlp run + overhead)
- Warm: **<1s** typical (skips download)
- Binary size: **37.6 MB** (`yt-dlp_linux`, PyInstaller standalone, zero python dependency)
- Returned related count: **24** for `dQw4w9WgXcQ` (Rick Astley) — high-quality '80s music cluster
- Vercel function timeout: declared `export const maxDuration = 60` (Pro tier)

### Critical gotchas (from 4 spike iterations)

**1. `related_videos` field is dead.** Modern yt-dlp (2024+) does NOT return `related_videos` for plain watch-page URLs. **Workaround:** fetch the YouTube Mix playlist (`watch?v=VID&list=RDVID`) with `--flat-playlist --dump-single-json`. Each playlist entry IS a related video populated by YouTube's recommendation algorithm. Some videos (very old, niche, age-restricted) have no Mix and return 0 entries — handle gracefully.

**2. `youtube-dl-exec` package fails on Vercel.** Two reasons:
  - Webpack rewrites `__dirname` so binary path resolution breaks. Even with `experimental.serverComponentsExternalPackages: ['youtube-dl-exec']` (which fixes path), the bundled binary is a **Python script** needing `python3`. Vercel's Node runtime has no python.
  - `yt-dlp-wrap` (deprecated) downloads the source distribution (also Python script). Same failure.
  - **The only thing that works** is fetching `yt-dlp_linux` directly — the PyInstaller-packaged standalone Linux binary. We control the URL, no wrapper.

**3. Folder naming.** Next.js App Router treats `_*` prefixed folders as **private** (404). For Sprint B production code, do not use `_spike`, `_internal`, etc. as route folder names.

**4. `process.cwd()` on Vercel.** Equals `/var/task/nichesurage` (the project root inside the function), NOT `/var/task` or repo root.

### Sprint B production plan (Phase 4 implementation)

For productionization, replace the runtime fetch with a **vendored binary**:

1. Commit `nichesurage/bin/yt-dlp` (~37MB) to git — eliminates GitHub-releases runtime dependency, faster cold start, fully reproducible.
2. Verify executable bit preserved (`git update-index --chmod=+x bin/yt-dlp`).
3. In wrapper module (`src/lib/discovery/ytdlp.ts`), `BIN_PATH = path.join(process.cwd(), 'bin', 'yt-dlp')`.
4. Vercel Output File Tracing (nft) auto-includes anything `require()`-d or imported. Pure file references via `fs.readFileSync` need a `bundlePagesRouterDependencies` or explicit inclusion. Test on preview before merge.

**Concurrency caveat:** Vercel egress IPs are shared. YouTube will throttle aggressive fan-out. Sprint B universe-expansion (`/api/discovery/expand`) MUST be sequential or low-concurrency (≤3 parallel) with exponential backoff. If we get IP-banned, fall back is residential proxy budget (~$200-500/mo) — not budgeted in v1.

**Mix-playlist API stability:** undocumented YouTube surface. yt-dlp extractor logic may break on future YouTube changes. Pin yt-dlp version per release; don't auto-update. Plan to bump version manually every ~3 months.

### What to use this for in Sprint B

Phase 4 step 4.14 (`src/lib/discovery/ytdlp.ts` wrapper) and Phase 5b discovery loop both rely on this primitive. Two functions to build:
- `fetchRelatedVideos(videoId): Promise<RelatedItem[]>` — Mix playlist trick
- `fetchTranscript(videoId): Promise<string | null>` — `--write-auto-subs --skip-download` then read VTT from /tmp

Both reuse the same `ensureBinary()` + `spawn` plumbing.

---

## Sprint B Phase 5 — Trend signal foundation (2026-05-04)

**Status:** complete. Branch `claude/infallible-germain-89d9e5` ahead of master by 16 commits. 303/303 Jest tests pass, `tsc --noEmit` clean.

### What shipped

| Sub-phase | Module | Purpose |
|---|---|---|
| 5A | `supabase/functions/_shared/baseline.ts` + scan third pass | Channel + niche median VPS baselines, novelty score = `(currentVps − nicheBaseline) / max(nicheBaseline, 1)` |
| 5B | `src/lib/clusters/detect.ts` | Pure replication detection: title/transcript cosine + thumbnail pHash Hamming → DSU union-find → ≥5 members AND ≥3 channels filter |
| 5C | `src/app/api/clusters/detect/route.ts` + 2 helpers | Vercel Node cron route: per-category persistence + Claude Haiku archetype matching + cross-niche mega-cluster flagging |

### Key design decisions (and why)

**1. JS-pairwise edge construction, not SQL self-join.**
Plan suggested pgvector `<=>` self-join + `bit_count(a # b)` for Hamming. Supabase JS chained client cannot express this — would require an RPC migration. Implementer correctly stopped + asked. Decision: **JS-pairwise N² is fine to ~500 videos per (category, 48h-window).** At ≥1000 videos, push to SQL. Documented in `detect.ts` with `// SCALING:` comment.

**2. Cluster idempotency via simpler-fallback (delete fresh + re-insert).**
No natural unique key on `trend_clusters`. Two options: overlap-matching (preserves IDs across runs) or simpler-fallback (loses IDs). Chose simpler-fallback for v1 because cluster IDs aren't user-facing yet. Phase 7 will check whether stable IDs are needed for UI deep-links — if yes, upgrade to overlap-matching.

**3. Hybrid archetypes (15 canonical + Claude-proposed candidates).**
Pure-canonical list misses emerging narratives. Pure-LLM-discovered drifts. Hybrid: canonical seeds in migration `0024`, Claude either matches one or proposes new (`status='candidate'`). Candidate promotion to canonical requires manual admin approval (Phase 7 admin tile).

**4. Defensive Claude parsing.**
`_archetype.ts` strips markdown fences, validates slug regex `^[a-z][a-z0-9_]{2,40}$`, validates label length 1–60, validates `is_new` boolean. Any failure → fallback to `education_howto`. Hallucinated canonical slugs (Claude returns `is_new=false` with non-existent slug) get rejected by `incrementCanonicalArchetype` returning false → fallback path.

**5. Cost cap: top 20 clusters per category get Claude calls.**
Worst case: 12 cats × 20 calls × 4 runs/day × ~$0.001/call ≈ **$30/mo**. Acceptable. Empty-titles short-circuit avoids burning calls on data-incomplete clusters.

### Patterns established (copy these later)

- **Cron route auth:** `const expected = process.env.CRON_SECRET; if (expected && req.headers.get('authorization') !== \`Bearer ${expected}\`) return 401`. Match `embeddings/build/route.ts` exactly when adding new cron routes.
- **Claude direct fetch (no SDK):** see `_archetype.ts` callClaude function. Model: `claude-haiku-4-5`. temp=0, max_tokens=100 for structured JSON outputs. Fallback on every parse failure path.
- **Per-category try/catch in cron loops:** one bad category doesn't abort the run. Each catches → `summary.push({categoryFailed:true, error: msg})` → continue.
- **Cache niche-level computations outside per-channel loops:** scan/index.ts third pass uses `Map<CategoryEnum, number>` for niche baselines. Pattern: declare cache OUTSIDE iteration, populate lazily per category encounter.

### Open follow-ups (deferred to Phase 6+)

| Item | Where | Why deferred |
|---|---|---|
| Bulk-upsert `novelty_score` instead of N per-video UPDATEs | scan/index.ts third pass | Phase 6 rewrites scoring pipeline anyway |
| `video_snapshots` query category-scoped (currently fetches all) | clusters/detect.ts edge fetch | Premature optimization; ≤500 videos/category is fine |
| Test coverage: partial-category-failure, hallucinated-canonical-slug, prompt structure | clusters/detect/route.test.ts | 8/8 spec required cases shipped; gaps are hardening, not correctness |
| Recategorize backfill (49 channels with NULL category) | one-shot Edge Function | Defer to before first production cron run; clusters skip NULL-category channels gracefully |
| Stable cluster IDs across runs (overlap-matching idempotency) | _persistence.ts | Phase 7 will tell us if UI needs deep-linkable cluster IDs |

### What Phase 6 inherits

`video_metrics` now has these populated columns ready for the trend score formula:
- `views_per_hour`, `comments_per_hour`, `likes_per_hour` (Phase 3)
- `velocity_delta`, `view_acceleration` (Phase 3)
- `breakout_ratio` (Phase 3 — likely to be REPLACED by `performance_ratio` per A5 amendment)
- `lifecycle_status` (Phase 3 — multiplier in formula per A3)
- `novelty_score` (Phase 5A — niche-relative outperformance)
- Cluster membership via `trend_cluster_members` (Phase 5C — `+ inReplicationCluster ? min(clusterSize, 20) × 2 : 0` term)

`trend_score` is still NULL everywhere. Phase 6 populates it via the weighted 5+ factor formula in `_shared/trendScore.ts`.

### Production verification before Phase 7 UI

After Phase 6 deploy + 24h of cron:
- `SELECT count(*) FROM video_metrics WHERE trend_score > 50` should be > 0
- `SELECT count(*) FROM trend_clusters WHERE video_count >= 5` should be > 0
- `SELECT count(*) FROM trend_clusters WHERE narrative_archetype_id IS NOT NULL` should be > 0
- `SELECT count(*) FROM narrative_archetypes WHERE status='candidate' AND detection_count >= 3` may be 0–N (will surface in Phase 7 admin tile for human approval)

If any of those return 0 after 24h, something is wired wrong — don't proceed to UI.

---

## Sprint B Phase 6 — Trend score formula (2026-05-04)

Phases 6.1–6.9 + amendments A3 (lifecycle multiplier) and A5 (performanceRatio replaces breakoutRatio) shipped in commits `9d10b0d` + `c900528`.

### Shipped

| Sub-phase | Files | What it adds |
|---|---|---|
| 6.1–6.2 | `_shared/trendScore.ts` + tests | 0–100 weighted formula with exported `TREND_WEIGHTS` + `LIFECYCLE_MULTIPLIER` for no-redeploy tuning |
| 6.7 / A5 | `_shared/expectedPerformance.ts` + tests | `expectedViews(subs, nicheRate, hours)` + `performanceRatio(actual, expected)` — replaces raw `breakoutRatio` (was over-rewarding tiny channels purely on views/subs) |
| 6.3 | `scan/index.ts` fourth pass | Bulk-fetch `trend_cluster_members ⋈ trend_clusters(video_count)`, compute trend_score per video, UPDATE `video_metrics.trend_score`. try/catch wrapped, structured `scan_trend` log emitted. |
| 6.4 | `scan/index.ts` legacy compat | `scan_results.is_premium` column does NOT exist (verified across 0001-0025); `isPremiumByTrend = max≥60` boolean is observable in `scan_trend` structured log instead. TODO(phase-7) to drop the comment when /discover migrates fully. |
| 6.8 / A3 | `trendScore.ts` end-of-formula | `result = min(100, raw × LIFECYCLE_MULTIPLIER[status])` — emerging 1.30 / exploding 1.20 / peak 1.00 / saturated 0.70 / dying 0.40 |

### Design decisions worth remembering

1. **Exported tunable constants** (`TREND_WEIGHTS`, `LIFECYCLE_MULTIPLIER`, `TREND_READINESS_THRESHOLDS`) — Phase 9 production validation can re-tune weights without redeploying logic. The constants ARE the formula.
2. **`expectedViews` units honesty** — the plan named the parameter `nicheMedianVps` ("views-per-subscriber-per-day") but in practice the only upstream value we have is `computeNicheBaseline()` = median views-per-hour across the niche. Formula stays exactly as A5 specifies (spec compliance), but docstring is now honest about the mismatch. The `clamp(log10(1+ratio), 0, 2)` term cap bounds the impact to ≤16 score points so the dimensional weirdness is not load-bearing. Phase 9 may revisit.
3. **`likesPerHour` is in `TrendScoreInput` but unweighted** — forward-compat parameter for future tuning; comments are a stronger leading signal (lower base rate, higher engagement floor) so they get the engagement weight.
4. **Per-video UPDATE loop, not bulk upsert** — matches Phase 5A novelty pass style; constants double per scan but DB cost is still negligible at ~20 channels × 20 videos. Phase 7+ may consolidate novelty + trend into one upsert per video if scale demands.

### What `video_metrics.trend_score` represents (formula, fully expanded)

```
raw =
  log10(1 + viewsPerHour)                       × 12
  + clamp(velocityDelta, 0, 10)                  × 4
  + clamp(viewAcceleration / 1000, 0, 20)        × 1
  + log10(1 + commentsPerHour)                   × 8
  + clamp(log10(1 + performanceRatio), 0, 2)     × 8
  + clamp(noveltyScore, 0, 5)                    × 6
  + (inReplicationCluster ? min(clusterSize, 20) × 2 : 0)
trend_score = min(100, max(0, raw × LIFECYCLE_MULTIPLIER[status]))
```

A "modest" video (vph=50, no other signal) scores <10. A "hot exploding" video (vph=500, delta=5×, cph=50, perf=30, novelty=3, cluster of 8, exploding stage) scores >70 (would be ~95 before lifecycle multiplier; 95 × 1.20 caps at 100 in extreme case). Dying lifecycle suppresses by 0.40× — a hot but cooling video drops below 50 even with strong other signals.

---

## Sprint B Phase 7 — Trend UI surface + admin moderation (2026-05-04)

Phases 7A–7C shipped in commits `cc155b5`, `162127e`, `e4db2aa`, `dc5f459` (cherry-pick from master), `c65bacd`.

### Shipped (split across 3 sub-phases)

| Sub-phase | Files | What it adds |
|---|---|---|
| 7A core | `discover/page.tsx`, `HotNowFilter.tsx`, `TrendBadge.tsx`, `NicheCard.tsx`, `fetchTrending.ts`, `queries.ts` (mode='hot' branch), `_/types/trend.ts`, copy.ts | `?mode=hot/quality/all` segmented filter, 🔥 TRENDING + 5-color lifecycle pill + cluster pill / 🚨 Cross-niche on cards, bootstrap calibration banner gated by `NEXT_PUBLIC_TREND_ENGINE_BOOTSTRAPPED` |
| 7A polish | (same) | Dying-dedup race fix in `fetchHotNiches` (channel whose top-scored video is dying gets fallback to non-dying video instead of being dropped); a11y (aria-pressed instead of fake tablist, focus-visible rings, banner role="status") |
| 7B | `discover/trending/page.tsx`, `TrendingClusterCard.tsx`, `fetchClusterFeed.ts`, `SearchFilters.tsx` (hide Sort in hot mode) | `/discover/trending` cluster-first feed; "Cross-niche waves" section above the regular grid for `is_mega_cluster=true`; category chip filter; click cluster → `/discover?cluster=<id>` drill-down |
| 7C | `admin/page.tsx`, `admin/_actions.ts`, `TrendReadinessRow.tsx`, `ArchetypeModerationTable.tsx`, `lib/admin/queries.ts` (3 new exports) | Trend Engine Readiness panel (snapshots / embedding coverage / clusters formed with thresholds 5000 / 0.6 / 1, verdict banner tells admin when to flip the bootstrap flag); 4 new StatCards; Pending Archetypes table with Approve / Reject server actions (`requireAdmin` re-assert + `revalidatePath('/admin')` + idempotent `.eq('status','candidate')` guards) |

### Design decisions worth remembering

1. **Channel-keyed not video-keyed** — `fetchTrendingByChannel` aggregates `Map<youtubeChannelId, TrendData>` because `/discover` is channel-card-centric. Per-channel: `max(trend_score)` becomes the displayed score; `max(cluster_size)` across all the channel's surfaced videos becomes the cluster signal. This bridges the video-centric trend pipeline to the existing channel-centric UI without refactoring NicheCard.
2. **`mode='all'` is the default** in `fetchNiches` — preserves legacy behavior for every existing call site that doesn't pass `mode`. Hot mode is opt-in via URL param.
3. **Bootstrap flag is build-time, not runtime** — `NEXT_PUBLIC_TREND_ENGINE_BOOTSTRAPPED` is read once at module load. Flipping requires Vercel redeploy. Tradeoff: simpler than a feature-flag service, costs one redeploy when the engine warms up. Acceptable because the flip is a once-only event per environment.
4. **`/admin` was missing from sprint-b-spike branch** — cherry-picked commit `73caad6` from master (10 files, 861 LOC). Conflict in `.env.local.example` resolved manually. The lift was clean since the admin commit was purely additive on master.
5. **Archetype moderation is server-action POST forms with bound IDs** — no client-side fetch wrappers, no JSON serialization. Admin clicks button → form submits → server action runs → `revalidatePath('/admin')` → table re-renders with the row gone. Auth re-asserted in each action via `requireAdmin()` (defense-in-depth — never trust the page-level gate alone).

### Production prerequisites BEFORE flipping the bootstrap flag

1. Set `ADMIN_EMAILS=vikmartin.online@gmail.com` on Vercel (admin route fail-closed without it).
2. Run the recategorize edge function once — 49 channels with NULL category, performanceRatio degrades to bounded-but-quirky behavior until each channel has a known category for niche-relative scoring.
3. Wait 24-72h after deploy. Visit `/admin` → Trend Engine Readiness panel must show 3 green checkmarks: ≥5000 video_snapshots, ≥60% embedding coverage, ≥1 cluster formed.
4. ONLY THEN: set `NEXT_PUBLIC_TREND_ENGINE_BOOTSTRAPPED=true` in Vercel env, redeploy. `/discover` will default to Hot mode, banner disappears.

### Open follow-ups (queued, not blockers for ship)

- **Phase 5b** (deferred): dynamic discovery loop — `/api/discovery/expand|promote|evict`. Tier-aware throttling, yt-dlp-driven universe expansion. Adds new candidate channels automatically when a video crosses score>70 or a cluster forms with ≥5 members. Phase 0 already validated yt-dlp on Vercel.
- **Phase 8**: verification sweep + production validation prep (test sweep, admin tile audit, Sprint B summary in CLAUDE.md — partly already in this section).
- **Phase 9** (post-deploy + 14d): Google Trends overlap check, manual sample of 5 random hot videos, tune `TREND_WEIGHTS` constants without redeploy if overlap < 40%.
