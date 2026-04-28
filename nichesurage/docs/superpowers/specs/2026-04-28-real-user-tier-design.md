# Real User Tier — Design Spec

**Date:** 2026-04-28  
**Task:** 3 — Real user tier  
**Branch:** new worktree → merge into `claude/cool-williamson-3ebbdb`

---

## Problem

`NicheCard` u discover stranicama prima hardcoded `userTier="basic"`. Svi korisnici vide isti sadržaj bez obzira na stvarni tier. Ulogovani premium korisnici ne dobijaju ono za šta su platili; neulogovani posjetioci ne vide zaključan sadržaj koji bi ih motivirao da se registruju.

---

## Rješenje

React Context pattern: `UserProvider` dohvata Supabase session i tier jednom na nivou cijelog appa, expose-uje `useUser()` hook. Discover stranice konzumiraju hook i proslijeđuju stvarni tier u `NicheCard`.

---

## Pristup: `/discover` je javno dostupan

`/discover` stranice **nisu** auth-gated. Neulogovani korisnici vide discover stranicu sa `free` tierom — zaključan sadržaj fungira kao teaser koji potiče registraciju (FOMO pattern: korisnik vidi da postoji vrijedna informacija, ali ne može je pročitati dok se ne prijavi). Middleware ostaje nepromijenjen.

---

## Arhitektura

### Novi fajl: `src/lib/context/UserContext.tsx`

Client component koji:
1. Na mountu poziva `supabase.auth.getUser()` da dobije auth usera
2. Ako postoji user, query-uje `public.users` tabelu po `user.id` da dobije `tier`
3. Expose-uje `useUser(): { tier: UserTier; loading: boolean }` hook

Sve operacije su fire-and-forget pri mountu — nema retry logike.

### Izmjene u `src/app/layout.tsx`

`UserProvider` wrapa `{children}` u root layoutu. Time je tier dostupan na svakoj stranici appa bez dodatnog setup-a.

### Izmjene u discover stranicama

Obje stranice pozivaju `useUser()`. Dok je `loading: true`, prikazuju skeleton (3 × `NicheCardSkeleton`). Kad se učita, proslijeđuju `tier` u `NicheCard`.

---

## Data Flow

```
layout.tsx
  └─ UserProvider (mount → getUser → query tier)
       └─ shorts/page.tsx ili longform/page.tsx
            └─ useUser() → { tier, loading }
                 └─ NicheCard userTier={tier}
```

---

## State & Fallbacks

| Situacija | `tier` | `loading` |
|-----------|--------|-----------|
| Inicijalno učitavanje | `'free'` | `true` |
| Neulogovan korisnik | `'free'` | `false` |
| Ulogovan, tier dohvaćen | stvarni tier | `false` |
| Supabase greška | `'free'` | `false` |

Tihi fallback na `'free'` u svim error slučajevima — korisnik ne vidi broken UI.

---

## Loading State u Discover Stranicama

Dok je `loading: true` od `useUser()`, discover stranice prikazuju skeleton grid (3 × `NicheCardSkeleton`) umjesto rezultata. Ovo sprječava momentalni prikaz pogrešnog tiera.

**Napomena:** Loading state od `useUser()` i loading state od `handleSearch` su odvojeni. Search može početi tek kad je `userTier` poznat (tj. `!userLoading`).

---

## Error Handling

- **`getUser()` greška** → tretira se kao neulogovan, tier = `'free'`
- **`public.users` query greška** → tier = `'free'`, bez error message-a
- Nema vidljivog error state-a za user fetch — sve je tiho i bezbjedno

---

## Testovi

**`src/lib/context/UserContext.test.tsx`**

Testira `UserProvider` + `useUser()` integraciju sa mock Supabase klijentom:

- Ulogovan korisnik sa `basic` tierom → `useUser()` vraća `{ tier: 'basic', loading: false }`
- Ulogovan korisnik sa `premium` tierom → `useUser()` vraća `{ tier: 'premium', loading: false }`
- Neulogovan korisnik (null user) → `useUser()` vraća `{ tier: 'free', loading: false }`
- Supabase `getUser()` greška → `useUser()` vraća `{ tier: 'free', loading: false }`

---

## Fajlovi koji se mijenjaju

| Fajl | Akcija |
|------|--------|
| `src/lib/context/UserContext.tsx` | Kreirati |
| `src/lib/context/UserContext.test.tsx` | Kreirati |
| `src/app/layout.tsx` | Modificirati — dodati `UserProvider` |
| `src/app/discover/shorts/page.tsx` | Modificirati — `useUser()` |
| `src/app/discover/longform/page.tsx` | Modificirati — `useUser()` |

---

## Out of Scope

- Login/signup stranice
- Dashboard i billing stranice
- Promjena logike u `NicheCard` — prima `userTier` prop, ostaje nepromijenjen
- Realtime tier subscription (WebSocket na tier promjenu)
