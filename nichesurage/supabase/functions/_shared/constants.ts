// supabase/functions/_shared/constants.ts
//
// Cross-function constants that aren't categorical mappings.
// Anything here is shared between discover and trending edge functions.

// Default language tag for newly discovered channels.
// Both discover and trending currently target EN-only seeds/regions:
//   - discover: seed query already filters to EN
//   - trending: pulls from US/DE/GB charts; content is mostly English
// When multi-language support is added (e.g., derive from regionCode in
// trending or from seed.language in discover), update this single source.
export const DISCOVERED_CHANNEL_LANGUAGE = 'en' as const
