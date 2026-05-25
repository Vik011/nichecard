# Free-Tier Paywall Fix — Plan

**Branch:** `fix/free-tier-paywall` (worktree off `origin/master` @ `06d1dbe`)
**Detailed task-by-task plan will be written to:** `docs/superpowers/plans/2026-05-22-free-tier-paywall.md` (post-approval, next session)

---

## Context

**Problem (revenue-affecting):** FREE korisnik može trenutno da vidi **3 različita otključana niche-a po danu** (po jedan u svakom `/discover` tabu: `all`, `spiking-now`, `just-added`), umesto 1 niche/dan kako je spec definisao. Plus, reveal rotira svakih 6h umesto 24h, što znači do **12 unique unlocked niche-a/dan** za jednog free user-a. Originalni plan je bio "1 niche/dan, isti za sve free-ove" — što kreira jasan paywall i konverzionu presiju.

**Root cause** (potvrđeno paralelnom Explore analizom):
- `/discover` ima 3 surface taba, svaki sa SVOJOM DB query funkcijom u [`fetchDiscoverFeed.ts:106-124`](nichesurage/src/lib/discover/fetchDiscoverFeed.ts) — vraćaju DRUGAČIJE sortirane nizove
- [`getRevealedIds()` u `src/lib/tier/reveal.ts:62-76`](nichesurage/src/lib/tier/reveal.ts) bira INDEX iz range `[4, 14]` preko `hash(userId + 6h-window)` — index je isti, ali svaki tab vraća drugačiji niz → različit niche na istoj poziciji
- `daily_demo_niche` tabela (Sprint A.9 — već postoji, race-safe globalno pinning po UTC danu) se trenutno koristi SAMO za first-login WOW modal, NE za regularni `/discover` paywall

**Intended outcome:** 
- FREE user vidi **1 globalno-pinned niche/dan** (isti za sve free-ove, anon i logged-in)
- Returning FREE user dobija **daily login modal** sa današnjim niche-em (read-only, bez AI)
- Modal se dismiss-uje → cookie se setuje → ne iskače opet do sledeće UTC ponoći
- **First-login WOW** (potpuno novi user) i dalje dobija punu pre-warmed AI demo (zadržano za sign-up konverziju)
- **6h reveal rotation gone** za FREE tier — samo 24h globalni cycle

---

## Approach: B + Hybrid C (potvrđen sa user-om)

### Tier model po novom

| Segment | /discover surface | Modal trigger | AI access |
|---|---|---|---|
| Anon visitor | 1 unlocked (today's pin) + ostali blurred sa "Sign up free" CTA | None | None (anon već 401-uje) |
| FREE first-login | Modal sa today's pin + full AI (postojeći) | First-login redirect | Yes (today's pin only, pre-warmed cache) |
| FREE returning (cookie clean) | 1 unlocked (today's pin) + ostali blurred | Auto-otvori modal na page load | No (AI dugmad locked) |
| FREE returning (cookie set) | 1 unlocked (today's pin) + ostali blurred | None (modal već viđen) | No |
| BASIC | First 5 by score | None | 1 AI call/dan (postojeće) |
| PREMIUM | All fetched rows | None | Infinity (postojeće) |

### Key files & functions

**Modify:**
- [`src/lib/tier/reveal.ts`](nichesurage/src/lib/tier/reveal.ts) — `getRevealedIds()` za FREE tier vraća `Set([todayPinId])` umesto hash-based index. Funkcija mora primiti `todayPinId: string | null` kao explicit argument (čista funkcija, no DB read).
- [`src/app/discover/page.tsx`](nichesurage/src/app/discover/page.tsx) — fetch today's pin server-side preko UserContext ili page-level data fetch; prosledi do `getRevealedIds()`. Trigger modal ako returning free + no demo-seen cookie.
- [`src/components/niche/FreeDemoBanner.tsx`](nichesurage/src/components/niche/FreeDemoBanner.tsx) — proširi ili kreiraj novu `DailyFreeModal` komponentu za returning user (bez AI gate-a).
- [`src/lib/demo/useFreeDemoState.ts`](nichesurage/src/lib/demo/useFreeDemoState.ts) — dodaj novi state branch `'daily-modal'` (returning free, today's pin, no AI) pored postojećih `'legitimate'` (first-login) i `'illegitimate'` (URL forgery).
- [`src/app/api/health-check/[id]/route.ts`](nichesurage/src/app/api/health-check/[id]/route.ts) + [`/api/content-angles/[id]/route.ts`](nichesurage/src/app/api/content-angles/[id]/route.ts) — sužiti `isTodaysDemoNiche()` bypass tako da važi SAMO za first-login flow (postojeća validacija URL param + cookie). Returning free user na demo niche dobija 403, ne pre-warmed cache. Cilj: AI bypass se aktivira samo kad je 3-way demo validation prošla (param + cookie + match).

**Create:**
- Cookie helper za `sn_daily_modal_seen` (value = `YYYY-MM-DD`, expires at next UTC midnight) — koristi se i u page.tsx za "treba li modal" i u modal close handler-u za "set seen"

**No DB migration needed** — koristimo postojeću `daily_demo_niche` tabelu + cookie pattern.

### Reuse existing utilities

| Need | Existing | Path |
|---|---|---|
| Today's globally-pinned niche | `getDailyDemoNiche(supabase)` | `src/lib/tier/freeDemo.ts:59-105` |
| Read today's pin without write | `readPinned()` (već exists) | `src/lib/tier/freeDemo.ts:107-122` |
| Existing demo banner pattern | `FreeDemoBanner` | `src/components/niche/FreeDemoBanner` |
| AI demo bypass validation | `isTodaysDemoNiche()` | `src/app/api/health-check/[id]/route.ts:26` + `content-angles:23` |
| First-login modal trigger + cookie | `surgeniche_demo_seen` cookie | `src/app/auth/callback/route.ts:214-220` |
| User tier resolution | `useUser()` context | wherever it's defined; reuse, don't refactor |

### Critical correctness checks

1. **Anon visitor scenario:** /discover bez logovanja → `getDailyDemoNiche` read-only call (može i anon, RLS allows `to anon`), today's pin se renderuje unlocked, ostali blurred. Bez modal-a za anon.
2. **First-login flow ostaje netaknut:** existing `getDailyDemoNiche` call iz `auth/callback` + redirect sa `?freeDemo=true&niche=X` + cookie `surgeniche_demo_seen` + `useFreeDemoState` 3-way validation → `'legitimate'` state → `aiTier='premium'` u `NicheDetailContent` (pre-warmed AI dostupan). Ovaj path se NE menja.
3. **Returning free + already-seen cookie:** /discover renderuje sa 1 unlocked (today's pin) + ostali blurred. Bez modal-a. AI dugmad locked (403).
4. **Returning free + clean cookie:** /discover na page load → check cookie → ako nema seen-key za today → trigger modal (komponenta sa `defaultOpen={true}`). Modal sadrži niche metrics (read-only). Close → set cookie sa today's date → re-render bez modal-a.
5. **No race conditions:** `daily_demo_niche` već ima race-safe insert pattern (date PK, 23505 → re-SELECT). `getDailyDemoNiche()` može da se zove iz svakog request-a; ako today's pin postoji, čita ga; ako ne, atomski insert + re-SELECT.
6. **Cookie expiry:** koristi `Expires` header sa next UTC midnight, NE 24h sliding window. Razlog: dva user-a sa pomerenim time zone-ima trebaju da vide modal istovremeno kad UTC presečemo.

---

## Out of scope (eksplicitno)

- Per-device modal tracking (ako user vidi modal na laptop-u, sutra na telefonu — cookie nije nasleđen, modal opet iskoči; ovo je acceptable za v1)
- Smarter pin selection (trenutno top-1 by opportunity_score; možda kasnije curated rotacija ili priority-by-category)
- A/B testing infrastruktura ("vidi koliko free → basic conversion ide pre vs posle fix-a")
- Tracking analytics (post-launch, koristi PostHog ako treba metrics)
- Phase 1 admin Users page (sledeći sprint posle ovog fix-a)
- Cron rate limit fix (poseban PR posle ovog, kao security baseline)

---

## File list (planned changes)

**Created:**
- `nichesurage/src/lib/demo/dailyModalCookie.ts` — small helper za cookie read/write/expiry (~30 LOC)
- `nichesurage/src/components/niche/DailyFreeModal.tsx` — read-only modal za returning free user (deli stil sa `FreeDemoBanner`, ali bez AI sections)
- `nichesurage/src/lib/demo/dailyModalCookie.test.ts` — unit test cookie helper
- `nichesurage/src/components/niche/DailyFreeModal.test.tsx` — RTL test za modal open/close/cookie set behavior

**Modified:**
- `nichesurage/src/lib/tier/reveal.ts` — `getRevealedIds()` signature gains `todayPinId: string | null` arg; FREE branch returns `todayPinId ? new Set([todayPinId]) : new Set()`; legacy 6h hash code path removed for FREE
- `nichesurage/src/lib/tier/reveal.test.ts` — update postojećih test cases za novi argument, dodaj cases za null pin
- `nichesurage/src/app/discover/page.tsx` — fetch today's pin server-side, prosledi do reveal.ts; modal trigger logic za returning free
- `nichesurage/src/lib/demo/useFreeDemoState.ts` — proširi state machine sa `'daily-modal'` branch
- `nichesurage/src/app/api/health-check/[id]/route.ts` — narrow `isTodaysDemoNiche` bypass tako da bypass aktivira SAMO ako request dolazi sa first-login validation (URL param + cookie + match), inače 403 za free
- `nichesurage/src/app/api/content-angles/[id]/route.ts` — isto kao gore
- Test files za sve modified rute

**Estimated change size:** ~250-350 LOC dodatih, ~50 LOC modifikovanih, 4 nova test file-a sa ~80 testova

---

## Verification (manual smoke + automated)

### Pre-merge (lokalno + Vercel preview)

1. `npm test` — sve postojeće + nove green (~620+ total)
2. `npx tsc --noEmit` — zero errors
3. `npm run build` — webpack compiles, no client/server boundary violations
4. Vercel preview deploy green

### Post-deploy (production smoke — 6 scenarija)

1. **Anon visitor:** otvori `https://surgeniche.com/discover` u incognito (no login). Expect:
   - 1 niche unlocked (today's pin) ✓
   - Ostali card-ovi blurred sa "Sign up free" CTA ✓
   - Nema modal pop-up-a ✓
   - Klik na unlocked niche → vidi detail page, AI dugmad locked sa "Upgrade" CTA ✓

2. **FREE first-login (potpuno nov user):** napravi test gmail nalog, sign up. Expect:
   - Redirect na `/discover?niche=<today-pin>&freeDemo=true` (postojeća logika) ✓
   - Modal sa pre-warmed AI verdict + content angles ✓
   - Today's pin = isti niche kao anon visitor je video ✓
   - `surgeniche_demo_seen` cookie set ✓

3. **FREE returning (isti dan, posle first-login):** sign out + sign in sa istim test gmail-om. Expect:
   - /discover load → daily modal iskoči (jer `sn_daily_modal_seen` cookie nije set za today)
   - Modal pokazuje niche metrics (read-only), bez AI sections ✓
   - Close → cookie `sn_daily_modal_seen=YYYY-MM-DD` set ✓
   - /discover background prikazuje 1 unlocked + ostali blurred ✓

4. **FREE returning (isti dan, posle dismiss):** refresh /discover. Expect:
   - Modal NE iskoči (cookie set) ✓
   - 1 unlocked, ostali blurred ✓

5. **FREE returning sledeći dan (simulate cookie expiry):** manualno obriši `sn_daily_modal_seen` cookie u DevTools → refresh /discover. Expect:
   - Modal opet iskoči (sa novim pin-om ako je danas drugi UTC dan, inače sa istim) ✓

6. **FREE clicks AI dugmad na today's pin (posle first-login expires):** /discover → klikni today's pin → detail page. Klik na "Generate Content Angles" ili "Health Check". Expect:
   - 403 "Upgrade to Basic or Premium" (jer cookie + URL param validation ne prolazi za returning user) ✓

### Cross-tab consistency check

7. Otvori /discover → tabs all / spiking-now / just-added → svaki tab MORA prikazati isti unlocked niche (today's pin). NE više 3 različita. ✓

### DB sanity

```sql
SELECT date, scan_result_id, created_at FROM daily_demo_niche WHERE date = CURRENT_DATE;
-- expect 1 row za današnji datum, isti scan_result_id kao što anon vidi unlocked
```

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| `getDailyDemoNiche` može da fail-uje (npr. spike pool prazan) | Postojeća logika ima fallback na `null` (cold start case). Treba grace handling u `getRevealedIds` (vraća prazan Set ako pin null → vidi se sve blurred, ali bez crash-a). Dokumentuje se kao acceptable degradation. |
| Cookie ne setuje se na iOS Safari ITP | `sn_daily_modal_seen` je 1st-party cookie, SameSite=Lax, ne 3rd party — ITP nije primenjeno na 1st party. Test na iPhone Safari u production smoke-u. |
| Modal pukne kod returning free + first_login pojavi se kasnije (race) | first_login_at se sets samo u auth/callback path. Postavi useFreeDemoState da prvo proverava `'legitimate'` (URL param prisutan), pa tek onda `'daily-modal'` (cookie clean) — prioritet redoslede. |
| Postojeći basic/premium user case-ovi pukne posle reveal.ts refaktora | reveal.ts test suite update OBAVEZAN, sve tier branches moraju da imaju tests (anon, free-w-pin, free-no-pin, basic, premium) |
| Anon visitor traffic raste — `daily_demo_niche` read per request | Read je trivijalan (PK lookup), Supabase keš + table-level cache to OK. Ako postane bottleneck (>1k QPS), dodajemo edge-cache. Nije problem za current scale. |

---

## Self-review checklist (run before opening PR)

- [ ] `getRevealedIds()` za FREE više ne čita `userId + window hash`; čita `todayPinId` arg
- [ ] 6h rotation gone za FREE (legacy code path uklonjen ili commented out sa TODO)
- [ ] Returning free user na svim 3 tabova vidi ISTI unlocked niche
- [ ] Anon visitor vidi isti unlocked niche kao logged-in free
- [ ] Daily modal iskače TAČNO jednom po UTC danu po cookie-set device-u
- [ ] First-login WOW pre-warmed AI flow netaknut (regression test za to)
- [ ] Returning free na today's pin AI buttons → 403 (NE bypass)
- [ ] No DB migration needed (potvrđeno)
- [ ] Cookie expires at next UTC midnight, NE 24h sliding
- [ ] Sve tier branches u reveal.ts imaju test coverage
