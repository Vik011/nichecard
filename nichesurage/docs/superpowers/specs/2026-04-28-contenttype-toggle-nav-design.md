# ContentType Toggle Navigation — Design Spec

**Date:** 2026-04-28  
**Task:** 2 — ContentType toggle navigacija  
**Branch:** `claude/nice-wescoff-d89909` → merge into `claude/cool-williamson-3ebbdb`

---

## Problem

Kad korisnik klikne "Shorts" ili "Longform" toggle u `SearchFilters`, mijenja se samo lokalni React state. URL ostaje isti. Korisnik može biti na `/discover/shorts` sa `contentType: 'longform'` u filteru — broken state koji proizvodi pogrešne rezultate.

---

## Rješenje

URL Search Params navigacija sa auto-search-om na mountu.

Kad korisnik promijeni `contentType`:
1. Trenutni filteri (osim `contentType`) se serijalizuju u URL query string
2. `router.push` navigira na destination stranicu sa tim params
3. Destination stranica čita params pri mountu, inicijalizuje filter state, i auto-pokreće search

Rezultat: shareable URL-ovi, browser back/forward funkcioniše, nema gubitka filter state-a pri prelasku.

---

## URL Schema

`contentType` je enkodiran u path segmentu, ne u params.

```
/discover/shorts?subscriberMin=1000&subscriberMax=100000&channelAge=any&viral=false
/discover/longform?subscriberMin=5000&subscriberMax=200000&channelAge=3months&viral=true
```

Params:
| Param | Type | Example |
|-------|------|---------|
| `subscriberMin` | number | `1000` |
| `subscriberMax` | number | `100000` |
| `channelAge` | ChannelAge string | `any`, `3months`, `1year` |
| `viral` | `'true'` \| `'false'` | `false` |

---

## Arhitektura

### Novi fajl: `src/lib/supabase/filterParams.ts`

Dvije čiste funkcije bez side effecta:

**`filtersToParams(filters: SearchFilters): URLSearchParams`**  
Serijalizuje sve filter fieldove osim `contentType` u URLSearchParams. Input je uvijek tipiziran, nema validacije.

**`paramsToFilters(params: ReadonlyURLSearchParams, contentType: ContentType, defaults: Pick<SearchFilters, 'subscriberMin' | 'subscriberMax'>): SearchFilters`**  
Deserijalizuje URL params u `SearchFilters`. Svaki param ima fallback:
- `subscriberMin` → `Number(param)` ili `defaults.subscriberMin`
- `subscriberMax` → `Number(param)` ili `defaults.subscriberMax`
- `channelAge` → validira protiv poznatih literal-a, fallback `'any'`
- `viral` → `param === 'true'`, fallback `false`
- `contentType` → uvijek dolazi kao argument, ne iz params

### Izmjene u page komponentama

Obje stranice dobijaju isti pattern, sa page-specifičnim defaults:

| Default | Shorts | Longform |
|---------|--------|----------|
| `subscriberMin` | 1 000 | 1 000 |
| `subscriberMax` | 100 000 | 500 000 |

**Inicijalizacija state-a:**
```tsx
const searchParams = useSearchParams()
const [filters, setFilters] = useState<SearchFiltersType>(() =>
  paramsToFilters(searchParams, 'shorts', { subscriberMin: 1000, subscriberMax: 100000 })
)
```

**Intercept contentType promjene:**
```tsx
function handleFiltersChange(updated: SearchFiltersType) {
  if (updated.contentType !== 'shorts') {
    router.push(`/discover/longform?${filtersToParams(updated)}`)
    return
  }
  setFilters(updated)
}
```

**Auto-search na mount:**
```tsx
useEffect(() => {
  if (searchParams.size > 0) {
    handleSearch()
  }
}, [])
```

`SearchFilters` komponenta ostaje nepromijenjena.

---

## Error Handling

- **Invalid URL params:** `paramsToFilters` tiho fallback-uje na defaults. Nema crash, nema error message.
- **Auto-search greška:** Koristi postojeći `handleSearch` error handling (prikazuje error message ispod dugmeta).
- **Fresh visit (nema params):** `searchParams.size === 0` → nema auto-search, korisnik vidi prazan state i postavlja filtere ručno.

---

## Testovi

**Novi fajl: `src/lib/supabase/filterParams.test.ts`**

- Roundtrip: `paramsToFilters(filtersToParams(filters), contentType, defaults)` vraća identičan objekat
- `filtersToParams` ne include-uje `contentType` u output
- `paramsToFilters` sa praznim params → vraća defaults
- `paramsToFilters` sa invalid `channelAge` → fallback `'any'`
- `paramsToFilters` sa `viral=false` eksplicitno → vraća `false` (ne "falsy")
- `paramsToFilters` sa `viral=true` → vraća `true`

**Postojeći testovi:** `queries.test.ts` (39 testova) ostaju nepromijenjeni.

---

## Fajlovi koji se mijenjaju

| Fajl | Akcija |
|------|--------|
| `src/lib/supabase/filterParams.ts` | Kreirati |
| `src/lib/supabase/filterParams.test.ts` | Kreirati |
| `src/app/discover/shorts/page.tsx` | Izmijeniti |
| `src/app/discover/longform/page.tsx` | Izmijeniti |

---

## Out of scope

- Unifikacija u jednu `/discover/[type]` stranicu (Task za sebe)
- Task 3: real user tier iz Supabase session-a
