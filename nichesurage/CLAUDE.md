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

## yt-dlp on Vercel — feasibility result

**Status:** WORKS locally (Windows + Node v24). Vercel verification pending — manual hit on preview required.
**Date:** 2026-05-04
**Spike route:** `src/app/api/spike/ytdlp/route.ts` (THROWAWAY — delete after Sprint B Phase 0 decision)

### Verdict
- `youtube-dl-exec@3.1.5` works as a Next.js Node-runtime dependency.
- yt-dlp binary version: **2026.03.17** (shipped inside the npm package — no vendoring).
- Latency on the dev server (Windows): **~3-4.5s** per call for a video that has a Mix playlist; well within Vercel's 60s function ceiling, comfortable headroom under our 25s timeout.
- `next build` succeeds; `next start` (production server) also works → not a dev-only artifact.

### Critical gotcha #1 — `related_videos` is gone
Modern yt-dlp does **NOT** return a `related_videos` field for plain watch-page URLs. That field existed in old `youtube-dl` forks but was removed.

**Workaround:** fetch the YouTube Mix playlist for the video — URL pattern `watch?v=VID&list=RDVID` — with `--flat-playlist --dump-single-json`. Each playlist entry IS a related video, populated by YouTube's recommendation algorithm. Returned ~24 related items consistently for popular videos. Some videos (e.g. very old / niche, like `jNQXAC9IVRw` "Me at the zoo") have NO Mix playlist and return 0 — Sprint B universe-expansion logic must handle this gracefully.

### Critical gotcha #2 — webpack rewrites the binary path
Without intervention, the route fails with `ENOENT spawn .next/server/bin/yt-dlp.exe`. The package's `constants.js` derives the binary path from `__dirname`, which webpack rewrites to the bundled chunk dir (where there is no binary).

**Workarounds, in order of preference:**
1. **Production fix (preferred):** add `experimental.serverComponentsExternalPackages: ['youtube-dl-exec']` to `next.config.mjs`. Tells Next.js to leave it as an external CommonJS require, preserving `__dirname`. **Spike does NOT do this** because the spec forbids touching `next.config.mjs`.
2. **In-route fix (what the spike uses):** set `process.env.YOUTUBE_DL_DIR = path.join(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin')` BEFORE `require('youtube-dl-exec')`. The constants module checks this env var first. Works in dev + production server locally. Should work on Vercel too because `process.cwd()` is the project root in serverless functions.

### Caveats / unknowns for Vercel
- **Binary tracing:** Vercel uses Next.js's nft (Output File Tracing) to decide which `node_modules/` files to include in the deployment bundle. The `youtube-dl-exec/bin/yt-dlp` (Linux build) needs to be traced. Because the package's source still references `__dirname/../bin`, nft *should* pick it up. **MUST verify on the actual Vercel preview deploy** — if 404 or ENOENT on Vercel, fall back to Plan B/C.
- **Cold start cost:** binary spawn was not measured (dev server keeps warm). On Vercel cold start, expect +200-500ms.
- **YouTube anti-bot:** for pure metadata extraction (Mix playlist via `--flat-playlist`) the spike worked clean. If Sprint B ever needs format/stream URLs it will hit signature-solving failures — stay in metadata-only territory.
- **YouTube IP rate limits:** Vercel functions go out via shared IPs. Heavy fan-out (many videoIDs in parallel) may get throttled or temp-blocked by YouTube. Sprint B's universe expansion should be sequential or low-concurrency, with backoff.
- **`related_videos` API stability:** the YouTube Mix playlist is a public surface but undocumented. yt-dlp may break extractor logic on a future YouTube change; keep `youtube-dl-exec` updateable.

### Smoke test
- `GET /api/spike/ytdlp?videoId=dQw4w9WgXcQ` → `{ ok: true, relatedCount: 24, durationMs: ~3000, version: "3.1.5" }`
- `GET /api/spike/ytdlp?videoId=9bZkp7q19f0` (Gangnam Style) → `relatedCount: 24`
- `GET /api/spike/ytdlp?videoId=jNQXAC9IVRw` (Me at the zoo) → `relatedCount: 0` (no Mix → graceful zero)

### Next step
Hit the preview URL once the push lands:
`https://nichecard-git-claude-infallible-germain-89d9e5-vik011s-projects.vercel.app/api/spike/ytdlp?videoId=dQw4w9WgXcQ`

If Vercel returns `ok: true`: GREEN — proceed with Phase 5b as planned. Then add `serverComponentsExternalPackages: ['youtube-dl-exec']` to `next.config.mjs` and remove the in-route env-var workaround when productionizing.

If Vercel returns `ok: false` with ENOENT: switch to Plan B (Supabase Edge Function) or Plan D (YouTube Data API search.list). Plan C (separate Railway/Render Node worker) is most robust but adds infra overhead.

### NOTE on folder name
The route is at `src/app/api/spike/ytdlp/` (NOT `_spike` as originally specified). Next.js App Router treats any folder prefixed with `_` as a **private folder** and excludes it from routing — `_spike/ytdlp` would 404. Renamed to `spike` for routability. The "experimental, throwaway" intent is preserved by the folder being literally named `spike`.
