# Auth & Discover Refactor — Design Spec

**Date:** 2026-04-28
**Task:** Auth (Google OAuth) + Discover page URL refactor

---

## Problem

1. App nema auth — korisnici ne mogu da se registruju ni prijave.
2. `/discover/shorts` i `/discover/longform` su odvojene stranice sa URL-ovima koji zbunjuju klijente i nisu premium iskustvo. Treba jedan čist `/discover` URL.

---

## Auth: Google OAuth Only

Jedina metoda prijave je Google OAuth. Nema email/password opcije — Google nalozi sprječavaju zlouporabu putem disposable emailova i pružaju premium iskustvo (jedan klik).

### Flow

```
Landing page → /login → Google OAuth (Supabase) → /auth/callback → /discover
```

1. Korisnik klikne bilo koji CTA na landing page-u → ide na `/login`
2. `/login` prikazuje NicheSurge logo + "Continue with Google" dugme
3. Klik → `supabase.auth.signInWithOAuth({ provider: 'google', redirectTo: /auth/callback })`
4. Google auth → redirect na `/auth/callback`
5. `/auth/callback` (server route):
   - Razmijeni code za session (`supabase.auth.exchangeCodeForSession`)
   - Provjeri postoji li user u `public.users` po `id`
   - Ako ne postoji → INSERT sa `tier: 'free'`
   - Redirect na `/discover`
6. Middleware (već postoji) štiti rute i preusmjerava logovanog korisnika sa `/login` na `/discover`

### Novi user pri prvom loginu

```sql
INSERT INTO public.users (id, email, tier)
VALUES (auth.uid(), auth.email(), 'free')
ON CONFLICT (id) DO NOTHING
```

Upsert sa `ON CONFLICT DO NOTHING` — bezbjedno ako se callback pozove više puta.

---

## Discover Page Refactor

### Prije

- `/discover/shorts` — zasebna stranica
- `/discover/longform` — zasebna stranica
- ContentType toggle navigira između dva URL-a

### Poslije

- `/discover` — jedna stranica
- ContentType toggle mijenja `?type=shorts` ↔ `?type=longform` u URL-u (bez reload-a)
- `/discover/shorts` i `/discover/longform` postaju server redirecti na `/discover?type=shorts` i `/discover?type=longform`
- Default (bez query param): `shorts`

### Shareable URL-ovi

Svi filter parametri ostaju u URL-u kao query params (`type`, `subscriberMin`, `subscriberMax`, `channelAge`, `onlyRecentlyViral`). Postojeći `filterParams.ts` se koristi bez izmjena — samo se dodaje `type` param.

---

## Tier Behavior (nije se mijenjalo)

Free korisnici vide discover stranicu sa zamagljenim fieldovima:
- Vidljivo: spike multiplier, opportunity score, virality rating, subscriber range
- Zamagljeno/locked: channel name, niche label, channel URL, views48h, engagement rate

Ovo je već implementirano u `NicheCard`. Nema izmjena u tier logici.

---

## UserContext Proširenje

`UserContext` trenutno expose-uje `{ tier, loading }`. Dodati `user` objekat (`{ id, email } | null`) kako bi komponente mogle znati je li korisnik ulogovan bez dodatnih Supabase poziva.

```typescript
interface UserContextValue {
  user: { id: string; email: string } | null
  tier: UserTier
  loading: boolean
}
```

---

## Dizajn `/login` Stranice

- Tamna pozadina (`bg-slate-950`), centrirana kartica
- NicheSurge logo na vrhu
- Naslov: "Welcome to NicheSurge"
- Podnaslov: "Sign in to discover viral YouTube niches"
- Jedno dugme: "Continue with Google" (Google ikona + bijeli tekst na indigo pozadini)
- Ispod: "No credit card required"

---

## Middleware Izmjene

Trenutni middleware radi ispravno ali redirectuje na `/dashboard` (koji ne postoji). Mijenja se redirect post-login na `/discover`.

---

## Fajlovi

| Akcija | Fajl |
|--------|------|
| Kreirati | `src/app/login/page.tsx` |
| Kreirati | `src/app/auth/callback/route.ts` |
| Kreirati | `src/app/discover/page.tsx` |
| Kreirati | `src/app/discover/shorts/page.tsx` → server redirect |
| Kreirati | `src/app/discover/longform/page.tsx` → server redirect |
| Modificirati | `src/middleware.ts` — redirect na `/discover` |
| Modificirati | `src/app/page.tsx` — svi CTA linkovi na `/login` ili `/discover` |
| Modificirati | `src/lib/context/UserContext.tsx` — dodati `user` u context |
| Modificirati | `src/lib/context/UserContext.test.tsx` — testovi za `user` field |

---

## Out of Scope

- Email/password auth
- Dashboard stranica
- Stripe billing
- Realtime tier promjene
- Account settings / profil stranica
