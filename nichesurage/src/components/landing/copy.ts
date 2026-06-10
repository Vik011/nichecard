export type Lang = 'en' | 'de'

export const COPY = {
  en: {
    navDiscover: 'Discover',
    navPricing: 'Pricing',
    // Renamed from "Dashboard" to match the in-app nav (PR #16). Same
    // route (/dashboard) — only the user-facing label changed.
    navDashboard: 'My Channels',
    navLogin: 'Login',
    navCta: 'Start Free',
    navOpenApp: 'Open app',
    tierFree: 'FREE',
    tierBasic: 'BASIC',
    tierPremium: 'PREMIUM',

    discoverShortsEyebrow: 'Shorts Niche Discovery',
    discoverShortsHeadline: "Today's top viral Shorts opportunities",
    discoverLongformEyebrow: 'Longform Niche Discovery',
    discoverLongformHeadline: "Today's high-potential Longform opportunities",
    // Unified Discover surface (replaces format-split tabs).
    // Hot/All toggle keys removed 2026-05-07 with the trend-engine
    // deprecation — the page now ships with one mode.
    discoverEyebrow: 'Niche Discovery',
    discoverHeadline: "Today's most promising niches",
    myChannelsNav: 'My Channels',
    discoverNav: 'Discover',
    discoverSubline: 'Refreshed daily · Ranked by opportunity score',
    discoverSearchBtn: 'Search Niches',
    // Sprint A.7 reveal mechanic copy
    revealNextLabel: 'Next reveal in',
    revealFreeBadge: '1 of 1 niche unlocked · top 4 paywalled',
    revealFreeBadgeNone: '0 of 1 niche unlocked · top 4 paywalled',
    revealCheckingBadge: "Checking today's unlock…",
    revealBasicBadge: '5 niches unlocked',
    revealPremiumBadge: 'All niches unlocked',
    upsellTitleFree: "You've unlocked 1 of 5",
    upsellBodyFree:
      'The top 4 niches by opportunity score are Basic territory. Upgrade for the full top 5 per format — refreshed daily.',
    upsellCtaFree: 'Upgrade to Basic',
    upsellTitleBasic: 'Beyond your top 5 per format',
    upsellBodyBasic:
      'Premium reveals every niche our scanner finds, plus unlimited AI deep-dives. Go Premium to keep digging.',
    upsellCtaBasic: 'Upgrade to Premium',
    upsellSecondary: 'Maybe later',
    // AI quota exhausted UI (BASIC after running their 1 daily deep-dive)
    aiQuotaUsedTitle: 'Daily deep-dive used',
    aiQuotaUsedBody:
      "You've used your 1 AI deep-dive for today. The quota resets in {hours}. Upgrade to Premium for unlimited deep-dives.",
    aiQuotaUpgradeCta: 'Upgrade to Premium',

    // Tier comparison matrix (Sprint A.7) — rendered below the pricing cards
    tierMatrixTitle: 'What you get at each tier',
    tierMatrixCol: { feature: 'Feature', free: 'Free', basic: 'Basic', premium: 'Premium' },
    tierMatrixRows: [
      { label: 'Unlocked niche cards', free: '1 (rotates daily)', basic: '5 per format (top 1–5)', premium: 'All (top 50)' },
      { label: 'Reveal cadence', free: 'Every day at midnight UTC', basic: 'Refreshed daily', premium: 'Live, no rotation' },
      { label: 'AI deep-dive (Health + Angles bundled)', free: '—', basic: '1 / day', premium: 'Unlimited' },
      { label: 'Saved niches', free: '0', basic: '10', premium: 'Unlimited' },
      { label: 'Channel name + URL', free: 'Only on the unlocked niche', basic: 'All visible', premium: 'All visible' },
      { label: 'Filters (subs, age, sort)', free: 'Yes', basic: 'Yes', premium: 'Yes' },
      { label: '30-day spike chart', free: 'On the unlocked one', basic: 'Yes', premium: 'Yes' },
    ],

    // FAQ section (Sprint A.7)
    faqTitle: 'Frequently asked questions',
    faqItems: [
      {
        q: 'How does the daily reveal work for Free?',
        a: 'Every day at midnight UTC your account unlocks one niche from positions 5–15 of the day\'s sorted list (the band right below Basic\'s top 5). Same window — same niche, even across reloads. Different users see different reveals in the same window. The top 4 stay paywalled forever (those are Basic territory).',
      },
      {
        q: 'What does Basic actually unlock?',
        a: 'The full top 5 niches per format (5 shorts + 5 longform), refreshed every 24 hours, with channel name + URL + exact metrics on every card. Plus 1 AI deep-dive per day — Health Check + Content Angles share that quota, so you pick one niche to fully analyze each day.',
      },
      {
        q: 'Why is the AI deep-dive bundled?',
        a: 'Health Check and Content Angles are two views of the same analysis. Bundling them as a single daily allowance keeps the upgrade trigger clear: if one niche-per-day isn\'t enough, that\'s the moment Premium starts paying for itself.',
      },
      {
        q: 'Do cache hits count against my Basic AI quota?',
        a: 'Yes. From your perspective you used your daily deep-dive on that niche, regardless of whether our cache served it or we ran the AI fresh. We don\'t penalize you for re-reading the same analysis — but the next analysis on a different niche will still cost a quota slot.',
      },
      {
        q: 'Can I cancel anytime?',
        a: 'Yes. Cancel from the Manage Subscription link in your account, or contact support. Access continues until the end of your current paid period, then your account moves to Free with no further charges. We do not prorate or refund the unused portion of a billing period.',
      },
      {
        q: 'Can I get a refund?',
        a: "All sales are final. SurgeNiche relies on third-party AI and infrastructure providers (Anthropic, OpenAI, Supabase, Vercel) whose costs are billed to us in real time as you use the Service. Because those costs cannot be recovered, we cannot refund the time you've already had access. The Stripe checkout asks you to confirm this consent before payment, in line with EU §356 BGB. If you were charged in error (duplicate charge, post-cancellation charge, or extended outage), email support and we'll review the case.",
      },
      {
        q: 'What happens to my saved niches if I downgrade?',
        a: 'Your saved niches stay in your account. The Free tier limit is 0 saves, so the list becomes read-only until you re-subscribe (or save fewer than 10 on Basic). We never delete your data automatically.',
      },
      {
        q: 'Why Google sign-in only?',
        a: 'Real accounts. The Free tier (1 reveal / day) is only meaningful if creating extra accounts is expensive — disposable-email signups would let one person register four addresses and get four reveals. Google enforces the cost we don\'t want to operate ourselves.',
      },
    ],
    discoverSearchingBtn: 'Searching…',
    discoverEmptyTitle: 'No niches match these filters',
    discoverEmptyBody: 'Try widening the subscriber range or relaxing the channel age filter.',
    discoverResetBtn: 'Reset filters',
    discoverShowMore: (n: number) => `Show more (${n} remaining)`,
    discoverShowMoreFreeUpsell: (n: number) =>
      `Unlock ${n} more niche${n === 1 ? '' : 's'} — upgrade to Basic`,
    discoverTrendingTopics: 'Trending topics',
    discoverTrendingEmpty: "We're still naming the first niches — fresh AI-labeled topics will appear here within 24h.",
    discoverScanningDeepWeb: 'Scanning the deep web…',
    // Sprint B trend-engine copy keys removed 2026-05-07 — Hot/Quality/All
    // toggle, bootstrap banner, /discover/trending cluster-feed page were
    // all deleted with the trend-engine deprecation.
    discoverSpikingNow: 'Spiking Now',

    filterFormat: 'Format',
    filterSubscriberRange: 'Subscriber range',
    filterChannelAge: 'Channel age',
    filterSortBy: 'Sort by',
    filterSortScore: 'Best score',
    filterSortNewest: 'Newest',
    filterViralTitle: 'Only viral channels',
    filterViralSub: 'spike ≥3× · last 7 days',
    filterAgeAny: 'Any',
    filterAge1mo: '1 mo',
    filterAge3mo: '3 mo',
    filterAge6mo: '6 mo',
    filterAge1yr: '1 yr',

    topNavShorts: 'Shorts',
    topNavLongform: 'Longform',
    topNavSaved: 'Saved',
    topNavSignOut: 'Sign out',
    topNavSigningOut: 'Signing out…',
    topNavTierFree: 'Free',
    topNavTierBasic: 'Basic',
    topNavTierPremium: 'Premium ✦',
    avatarMenuOpen: 'Open user menu',
    avatarMenuPlan: 'Plan',
    avatarMenuManageBilling: 'Manage billing',

    detailBack: 'Back',
    detailNotFound: 'Niche not found',
    detailLoadingErr: 'Failed to load this niche.',
    detailVisitYouTube: 'Visit on YouTube',
    freeDemoBannerHeadline: 'Welcome to SurgeNiche.',
    freeDemoBannerSub: "Here's today's top niche we surfaced for everyone. The full feed is one click away.",
    freeDemoBannerCta: 'View all niches',
    statSubscribers: 'Subscribers',
    statChannelAge: 'Channel age',
    statLanguage: 'Language',
    statVideos: 'Total videos',
    statSpike: 'spike',
    statMonths: 'mo',
    statYears: 'yr',
    chartTitle: '30-day spike trend',
    chartEmpty: 'Not enough scan history yet — check back soon.',
    chartMaxSpike: 'Max',
    videosTitle: 'Recent uploads',
    videosLoading: 'Loading recent videos…',
    videosError: 'Could not load recent videos.',
    videosEmpty: 'This channel has no recent videos.',
    videosUnavailable: 'Recent uploads aren’t available right now.',
    videosRetry: 'Try again',
    videosViewsLabel: 'views',

    anglesEyebrow: 'Content angles',
    anglesHeading: '5 video ideas tailored to this niche',
    anglesLockedTitle: 'Premium feature',
    anglesLockedBody: 'Unlock 5 AI-generated video ideas tailored to this exact niche.',
    anglesUpgradeCta: 'Upgrade to Premium',
    anglesError: 'Failed to generate angles.',
    anglesRetry: 'Try again',
    anglesShorts: 'Shorts',
    anglesLongform: 'Longform',
    anglesWhy: 'Why it works',
    anglesLoading: 'Generating ideas…',
    anglesStage1: 'Reading niche signals…',
    anglesStage2: 'Studying winning formats…',
    anglesStage3: 'Drafting video angles…',
    anglesStage4: 'Polishing hooks…',
    anglesLoadingHint: 'First load takes ~20–30s · cached for 7 days after',

    healthEyebrow: 'Niche health check',
    healthHeading: 'Strategist verdict + score breakdown',
    healthLockedBody: 'Unlock the AI strategist verdict and per-component score breakdown.',
    healthError: 'Failed to load health check.',
    healthCompSpike: 'Spike',
    healthCompOpportunity: 'Opportunity',
    healthCompEngagement: 'Engagement',
    healthCompVirality: 'Virality',
    healthCompSaturation: 'Room to grow',
    healthStage1: 'Reading scan signals…',
    healthStage2: 'Computing health score…',
    healthStage3: 'Generating strategist verdict…',
    healthStage4: 'Polishing the verdict…',

    relatedEyebrow: 'Similar niches',
    relatedHeading: 'Niches in the same lane',
    relatedEmpty: 'No similar niches found right now.',

    heroEyebrow: 'YouTube niche intelligence',
    // Green pulse pill above the H1 — "what the system is doing right
    // NOW". Different angle from the LiveTickerBar (which carries
    // backward-looking stats). Adds present-tense atmosphere.
    heroPulse: 'Scanning 230+ channels / hour',
    // SEO-anchored H1 split into two visual lines: regular weight on
    // the keyword phrase, italic on the action verb. The split came from
    // the external Claude AI mockup that drove this polish round —
    // gives the H1 typographic momentum and matches an editorial
    // "section header" cadence rather than a flat single-line banner.
    heroHeadlineMain: 'Find YouTube niches',
    heroHeadlineEmphasis: 'before they explode',
    heroNarrative: 'I built this because research was eating my weekends.',
    // Bolded fragment in the sub paragraph anchors the value prop
    // ("small accounts that started moving"). The "scans 230+ small
    // channels every hour" data has been moved into the HeroStatsBar
    // (230+ CHANNELS / SCAN), so the sub can pivot straight to value.
    heroSubLeading: 'SurgeNiche flags',
    heroSubBold: 'the small accounts that started moving',
    heroSubTrailing: ' — before anyone else notices. No keyword guessing, no copy-paste tactics.',
    heroBadge: '47 channels spiked in the last hour',
    heroCta: 'Try it free',
    heroCta2: 'How it works',
    heroNextScanLabel: 'Next scan in',
    heroNextScanFormat: (m: number, s: number) =>
      `${m}m ${s.toString().padStart(2, '0')}s`,

    radarLive: 'Live',
    radarPingPrefix: 'Channel discovered',
    radarSubline: 'Watching the small accounts the moment they start moving.',
    radarUnclusteredLabel: 'Forming cluster',
    radarFormatShorts: 'Shorts',
    radarFormatLongform: 'Longform',
    radarChannelsLast24h: (n: number) =>
      `${n.toLocaleString('en-US')} channels surfaced in the last 24h`,

    // Live ticker strip below the LandingNav. Replaces the standalone
    // top-left LIVE chip + bottom-right ping notification with a single
    // multi-stat row.
    tickerLive: 'LIVE',
    tickerSpikedLastHour: (n: number) =>
      `${n} channels spiked in the last hour`,
    tickerNichesToday: (n: number) =>
      `${n} new niches surfaced today`,

    // Hero stats bar (3 columns) anchoring the bottom of the hero. Frames
    // the system rhythm: how much we scan, when next scan fires, how
    // many spikes we caught right now.
    heroStatsChannelsScan: 'CHANNELS / SCAN',
    heroStatsNextScan: 'Next scan',
    heroStatsSpikingNow: 'SPIKING NOW',
    heroStatsScanInterval: 'SCAN INTERVAL',
    heroStatsScanIntervalValue: '1h',

    previewTitle: 'These niches are moving right now.',
    previewSub: 'Sign up free to see channel names and full metrics.',
    previewCta: 'Unlock all results',

    painHeadline: 'Stop guessing. Start finding.',
    painTitle: 'The slow way',
    painItems: [
      'Scrolling YouTube for hours hoping to spot a trend',
      'Copying channels that already peaked two months ago',
      'Finding the niche the day after it stops working',
    ],
    solutionTitle: 'With SurgeNiche',
    solutionItems: [
      '230+ channels under 10k subs analysed every hour',
      'Opportunity scores ranked by spike, engagement, saturation',
      "Email alert the moment a niche you're tracking starts moving",
    ],

    featuresTitle: 'Everything you need to dominate a niche',
    featuresPremiumBadge: 'PREMIUM',
    featuresStatusLive: 'Live now',
    featuresStatusSoon: 'Rolling out next week',
    features: [
      { icon: 'bot', tier: 'all', title: 'AI Opportunity Score', desc: 'Composite score weighing spike, engagement, competition and search volume.' },
      { icon: 'clock', tier: 'all', title: 'Hourly Scans', desc: '230+ channels re-analysed every hour so you never miss a spike window.' },
      { icon: 'flame', tier: 'all', title: 'Viral Spike Detection', desc: 'Flags channels with 3× or higher 48-hour view jumps the moment they appear.' },
      { icon: 'heartbeat', tier: 'premium', status: 'live', title: 'AI Niche Health Check', desc: 'One-click verdict on whether a niche is worth entering this week — score plus a strategist-grade paragraph on the risks and the opening.' },
      { icon: 'trend-up', tier: 'premium', status: 'soon', title: 'AI Clone & Twist', desc: 'Claude shows you exactly how to replicate a viral format with your unique spin.' },
      { icon: 'lightbulb', tier: 'premium', title: '5 AI Shorts Ideas', desc: 'Get five ready-to-shoot Shorts ideas, hooks and titles tailored to each spiking niche.' },
      { icon: 'bell', tier: 'premium', status: 'soon', title: 'Early Warning Alerts', desc: 'Email + in-app alert the moment a niche you track starts spiking — before everyone else.' },
      { icon: 'bookmark', tier: 'premium', title: 'Save & Track Niches', desc: 'Bookmark spiking niches to your watchlist. Re-check their score whenever you open the app, no re-searching.' },
    ],

    pricingTitle: 'Pick the plan that fits your week.',
    pricingFree: 'Free',
    pricingBasic: 'Basic',
    pricingPremium: 'Premium',
    pricingFreePrice: '€0',
    pricingBasicPrice: '€9',
    pricingPremiumPrice: '€19',
    pricingPerMonth: '/ mo',
    pricingPerYear: '/ yr',
    pricingToggleMonthly: 'Monthly',
    pricingToggleYearly: 'Yearly',
    pricingYearlySaveBadge: 'Save 17%',
    pricingBasicYearlyPrice: '€90',
    pricingBasicYearlyMonthly: '€7.50 / mo',
    pricingPremiumYearlyPrice: '€190',
    pricingPremiumYearlyMonthly: '€15.83 / mo',
    pricingBestValueBadge: 'Best Value',
    pricingCtaFree: 'Get Started',
    pricingCtaBasic: 'Start Basic',
    pricingCtaPremium: 'Go Premium',
    pricingPremiumTrust: 'Cancel anytime · Secure checkout via Stripe',
    // Sprint A.7 — feature lists rewritten to match the actual three-tier
    // funnel: 1 reveal /day for free, top 5 per format /24h + 1 AI deep-dive
    // for basic, unlimited everything for premium.
    pricingFreeFeatures: [
      '1 unlocked niche, rotates daily at midnight UTC',
      'Channel name + URL on the unlocked one',
      'Top 4 niches blurred (Basic territory)',
      'No AI deep-dives',
      'No saved niches',
    ],
    pricingBasicFeatures: [
      'Top 5 niches per format unlocked, refreshed daily',
      'Full channel name, URL & exact metrics',
      '1 AI deep-dive per day (Health Check + Angles)',
      '10 saved niches',
      'EN + DE markets',
    ],
    pricingPremiumFeatures: [
      'Everything in Basic, plus:',
      'All niches unlocked (top 50)',
      'Unlimited AI deep-dives',
      'Unlimited saves',
      '30-day scan history',
      'Priority support',
    ],

    testimonialsTitle: 'Creators who found their niche',
    testimonials: [
      {
        quote: "Found a German 'silent study desk' niche with a 12.4× spike. First Short hit 84,000 views in 6 days. I was scanning manually for months — this saved my weekends.",
        name: 'Marcus T.',
        handle: '@marcust_creates',
        detail: 'Shorts since March 2024 · Berlin',
      },
      {
        quote: "The opportunity score is the only metric I trust now. Bookmarked 14 niches in week one, three of them popped within 10 days. Better hit rate than my last six months of guessing.",
        name: 'Sarah K.',
        handle: '@sarahkcontent',
        detail: 'Long-form essays · Manchester',
      },
      {
        quote: "I'm Lithuanian making German content. The DE filter cut my research to nothing — I get fed niches I'd never have searched for. Two of my last four uploads cleared 50k.",
        name: 'Lukas B.',
        handle: '@lukasbfilms',
        detail: 'Cinematic Shorts · Vilnius',
      },
    ],

    ctaHeadline: 'Find a niche before it gets crowded.',
    ctaButton: 'Start free',

    footerTagline: 'AI-powered YouTube niche discovery.',
    footerLinks: 'Links',
    footerLegal: 'Legal',
    footerPrivacy: 'Privacy',
    footerTerms: 'Terms',
    footerCopyright: '© 2026 SurgeNiche',
  },

  de: {
    navDiscover: 'Entdecken',
    navPricing: 'Preise',
    navDashboard: 'Meine Kanäle',
    navLogin: 'Anmelden',
    navCta: 'Kostenlos starten',
    navOpenApp: 'App öffnen',
    tierFree: 'FREE',
    tierBasic: 'BASIC',
    tierPremium: 'PREMIUM',

    discoverShortsEyebrow: 'Shorts-Nischenfinder',
    discoverShortsHeadline: 'Die heißesten Shorts-Nischen heute',
    discoverEyebrow: 'Nischenfinder',
    discoverHeadline: 'Die vielversprechendsten Nischen heute',
    myChannelsNav: 'Meine Kanäle',
    discoverNav: 'Entdecken',
    discoverLongformEyebrow: 'Longform-Nischenfinder',
    discoverLongformHeadline: 'Longform-Nischen mit dem größten Potenzial heute',
    discoverSubline: 'Täglich aktualisiert · Sortiert nach Opportunity-Score',
    discoverSearchBtn: 'Nischen suchen',
    // Sprint A.7 reveal mechanic copy
    revealNextLabel: 'Nächste Freischaltung in',
    revealFreeBadge: '1 von 1 Nische freigeschaltet · Top 4 hinter Paywall',
    revealFreeBadgeNone: '0 von 1 Nische freigeschaltet · Top 4 hinter Paywall',
    revealCheckingBadge: 'Heutige Freischaltung wird geprüft…',
    revealBasicBadge: '5 Nischen freigeschaltet',
    revealPremiumBadge: 'Alle Nischen freigeschaltet',
    upsellTitleFree: 'Du hast 1 von 5 freigeschaltet',
    upsellBodyFree:
      'Die Top 4 Nischen nach Opportunity-Score sind Basic-Gebiet. Upgrade für die kompletten Top 5 pro Format — täglich frisch.',
    upsellCtaFree: 'Auf Basic upgraden',
    upsellTitleBasic: 'Über deine Top 5 pro Format hinaus',
    upsellBodyBasic:
      'Premium zeigt jede Nische, die unser Scanner findet, plus unbegrenzte KI-Analysen. Premium für die volle Tiefe.',
    upsellCtaBasic: 'Auf Premium upgraden',
    upsellSecondary: 'Vielleicht später',
    // KI-Tageskontingent verbraucht (BASIC nach 1 täglicher Analyse)
    aiQuotaUsedTitle: 'Tägliche Analyse verbraucht',
    aiQuotaUsedBody:
      'Du hast deine 1 KI-Analyse für heute genutzt. Reset in {hours}. Upgrade auf Premium für unbegrenzte Analysen.',
    aiQuotaUpgradeCta: 'Auf Premium upgraden',

    // Tier-Vergleichsmatrix (Sprint A.7)
    tierMatrixTitle: 'Was du in jedem Tier bekommst',
    tierMatrixCol: { feature: 'Feature', free: 'Free', basic: 'Basic', premium: 'Premium' },
    tierMatrixRows: [
      { label: 'Freigeschaltete Nischen-Karten', free: '1 (rotiert täglich)', basic: '5 pro Format (Top 1–5)', premium: 'Alle (Top 50)' },
      { label: 'Freischaltungsrhythmus', free: 'Täglich um Mitternacht UTC', basic: 'Täglich erneuert', premium: 'Live, keine Rotation' },
      { label: 'KI-Analyse (Health + Angles gebündelt)', free: '—', basic: '1 / Tag', premium: 'Unbegrenzt' },
      { label: 'Gespeicherte Nischen', free: '0', basic: '10', premium: 'Unbegrenzt' },
      { label: 'Kanalname + URL', free: 'Nur bei der freigeschalteten', basic: 'Alle sichtbar', premium: 'Alle sichtbar' },
      { label: 'Filter (Abos, Alter, Sortierung)', free: 'Ja', basic: 'Ja', premium: 'Ja' },
      { label: '30-Tage Spike-Chart', free: 'Bei der freigeschalteten', basic: 'Ja', premium: 'Ja' },
    ],

    // FAQ-Sektion (Sprint A.7)
    faqTitle: 'Häufige Fragen',
    faqItems: [
      {
        q: 'Wie funktioniert die tägliche Freischaltung für Free?',
        a: 'Täglich um Mitternacht UTC schaltet dein Account eine Nische aus den Positionen 5–15 der Tagesliste frei (das Band direkt unter Basics Top 5). Gleiches Fenster — gleiche Nische, auch nach Reload. Verschiedene Nutzer sehen im selben Fenster verschiedene Freischaltungen. Die Top 4 bleiben dauerhaft hinter der Paywall (das ist Basic-Gebiet).',
      },
      {
        q: 'Was schaltet Basic eigentlich frei?',
        a: 'Die kompletten Top-5 Nischen pro Format (5 Shorts + 5 Longform), alle 24 Stunden erneuert, mit vollem Kanalnamen + URL + exakten Metriken auf jeder Karte. Plus 1 KI-Analyse pro Tag — Health Check + Content Angles teilen sich dieses Kontingent, du wählst also eine Nische zur vollen Analyse pro Tag.',
      },
      {
        q: 'Warum ist die KI-Analyse gebündelt?',
        a: 'Health Check und Content Angles sind zwei Sichten derselben Analyse. Sie als ein tägliches Kontingent zu bündeln macht den Upgrade-Trigger klar: wenn eine Nische pro Tag nicht reicht, fängt Premium genau da an, sich zu lohnen.',
      },
      {
        q: 'Zählen Cache-Treffer gegen mein Basic-KI-Kontingent?',
        a: 'Ja. Aus deiner Perspektive hast du deine Tages-Analyse auf dieser Nische verwendet, unabhängig davon, ob unser Cache sie ausgeliefert oder die KI sie frisch gerechnet hat. Du wirst nicht bestraft, wenn du dieselbe Analyse erneut liest — aber die nächste Analyse einer anderen Nische kostet einen Slot.',
      },
      {
        q: 'Kann ich jederzeit kündigen?',
        a: 'Ja. Kündigung über den Link „Abonnement verwalten" in deinem Account oder per E-Mail an den Support. Der Zugang läuft bis zum Ende der bezahlten Periode, danach wechselt der Account ohne weitere Belastung auf Free. Wir erstatten oder anteilig vergüten den ungenutzten Teil eines Abrechnungszeitraums nicht.',
      },
      {
        q: 'Bekomme ich eine Rückerstattung?',
        a: 'Alle Verkäufe sind endgültig. SurgeNiche nutzt externe KI- und Infrastruktur-Anbieter (Anthropic, OpenAI, Supabase, Vercel), deren Kosten in Echtzeit anfallen, sobald du den Dienst nutzt. Da diese Kosten nicht zurückgeholt werden können, können wir bereits genutzte Zeit nicht erstatten. Der Stripe-Checkout fragt vor der Zahlung nach deiner ausdrücklichen Zustimmung, im Einklang mit § 356 (5) BGB. Bei Fehlbuchungen (doppelte Belastung, Belastung nach Kündigung oder längerer Ausfall) melde dich beim Support, wir prüfen den Fall.',
      },
      {
        q: 'Was passiert mit meinen gespeicherten Nischen bei einem Downgrade?',
        a: 'Deine gespeicherten Nischen bleiben in deinem Account. Das Free-Tier-Limit ist 0 Speicherplätze, die Liste wird also schreibgeschützt, bis du erneut abonnierst (oder unter 10 auf Basic kommst). Wir löschen deine Daten nie automatisch.',
      },
      {
        q: 'Warum nur Google Sign-in?',
        a: 'Echte Accounts. Das Free-Tier (1 Freischaltung / Tag) funktioniert nur, wenn das Erstellen zusätzlicher Accounts teuer ist — Wegwerf-Mails würden eine Person dazu bringen, vier Adressen zu registrieren und vier Freischaltungen zu bekommen. Google erzwingt die Kosten, die wir nicht selbst betreiben wollen.',
      },
    ],
    discoverSearchingBtn: 'Suche…',
    discoverEmptyTitle: 'Keine Nischen für diese Filter gefunden',
    discoverEmptyBody: 'Erweitere den Abonnenten-Bereich oder lockere den Kanal-Alter-Filter.',
    discoverResetBtn: 'Filter zurücksetzen',
    discoverShowMore: (n: number) => `Mehr anzeigen (${n} übrig)`,
    discoverShowMoreFreeUpsell: (n: number) =>
      `${n} weitere Nische${n === 1 ? '' : 'n'} freischalten · Upgrade auf Basic`,
    discoverTrendingTopics: 'Trending-Themen',
    discoverTrendingEmpty: 'Wir benennen die ersten Nischen — frische KI-Labels erscheinen hier innerhalb von 24 Stunden.',
    discoverScanningDeepWeb: 'Durchsuche das tiefe Netz…',
    // Sprint B trend-engine copy keys removed 2026-05-07.
    discoverSpikingNow: 'Im Aufstieg',

    filterFormat: 'Format',
    filterSubscriberRange: 'Abonnenten',
    filterChannelAge: 'Kanal-Alter',
    filterSortBy: 'Sortieren nach',
    filterSortScore: 'Bester Score',
    filterSortNewest: 'Neueste',
    filterViralTitle: 'Nur virale Kanäle',
    filterViralSub: 'Spike ≥3× · letzte 7 Tage',
    filterAgeAny: 'Beliebig',
    filterAge1mo: '1 Mo',
    filterAge3mo: '3 Mo',
    filterAge6mo: '6 Mo',
    filterAge1yr: '1 Jahr',

    topNavShorts: 'Shorts',
    topNavLongform: 'Longform',
    topNavSaved: 'Gespeichert',
    avatarMenuOpen: 'Benutzermenü öffnen',
    avatarMenuPlan: 'Plan',
    avatarMenuManageBilling: 'Abrechnung verwalten',
    topNavSignOut: 'Abmelden',
    topNavSigningOut: 'Wird abgemeldet…',
    topNavTierFree: 'Free',
    topNavTierBasic: 'Basic',
    topNavTierPremium: 'Premium ✦',

    detailBack: 'Zurück',
    detailNotFound: 'Nische nicht gefunden',
    detailLoadingErr: 'Diese Nische konnte nicht geladen werden.',
    detailVisitYouTube: 'Auf YouTube ansehen',
    freeDemoBannerHeadline: 'Willkommen bei SurgeNiche.',
    freeDemoBannerSub: 'Das ist die Top-Nische, die wir heute für alle ausgesucht haben. Der ganze Feed ist nur einen Klick entfernt.',
    freeDemoBannerCta: 'Alle Nischen ansehen',
    statSubscribers: 'Abonnenten',
    statChannelAge: 'Kanal-Alter',
    statLanguage: 'Sprache',
    statVideos: 'Videos gesamt',
    statSpike: 'Spike',
    statMonths: 'Mo',
    statYears: 'J',
    chartTitle: '30-Tage-Spike-Trend',
    chartEmpty: 'Noch nicht genug Scan-Historie — schau bald wieder vorbei.',
    chartMaxSpike: 'Max',
    videosTitle: 'Neueste Uploads',
    videosLoading: 'Lade neueste Videos…',
    videosError: 'Videos konnten nicht geladen werden.',
    videosEmpty: 'Dieser Kanal hat keine neuen Videos.',
    videosUnavailable: 'Neueste Uploads sind derzeit nicht verfügbar.',
    videosRetry: 'Erneut versuchen',
    videosViewsLabel: 'Aufrufe',

    anglesEyebrow: 'Content-Ideen',
    anglesHeading: '5 Videoideen für diese Nische',
    anglesLockedTitle: 'Premium-Funktion',
    anglesLockedBody: 'Schalte 5 KI-generierte Videoideen für genau diese Nische frei.',
    anglesUpgradeCta: 'Auf Premium upgraden',
    anglesError: 'Ideen konnten nicht generiert werden.',
    anglesRetry: 'Erneut versuchen',
    anglesShorts: 'Shorts',
    anglesLongform: 'Longform',
    anglesWhy: 'Warum es funktioniert',
    anglesLoading: 'Generiere Ideen…',
    anglesStage1: 'Analysiere Nischen-Signale…',
    anglesStage2: 'Erforsche erfolgreiche Formate…',
    anglesStage3: 'Entwerfe Videoideen…',
    anglesStage4: 'Verfeinere Hooks…',
    anglesLoadingHint: 'Erstes Laden ~20–30s · danach 7 Tage gecacht',

    healthEyebrow: 'Nischen-Gesundheitscheck',
    healthHeading: 'Strategie-Urteil + Score-Aufschlüsselung',
    healthLockedBody: 'Schalte das KI-Strategieurteil und die Score-Aufschlüsselung frei.',
    healthError: 'Health Check konnte nicht geladen werden.',
    healthCompSpike: 'Spike',
    healthCompOpportunity: 'Chance',
    healthCompEngagement: 'Engagement',
    healthCompVirality: 'Viralität',
    healthCompSaturation: 'Wachstumsraum',
    healthStage1: 'Scan-Signale lesen…',
    healthStage2: 'Health-Score berechnen…',
    healthStage3: 'Strategie-Urteil erstellen…',
    healthStage4: 'Urteil verfeinern…',

    relatedEyebrow: 'Ähnliche Nischen',
    relatedHeading: 'Nischen in derselben Spur',
    relatedEmpty: 'Aktuell keine ähnlichen Nischen.',

    heroEyebrow: 'YouTube-Nischen-Intelligenz',
    heroPulse: 'Scannt 230+ Kanäle / Stunde',
    heroHeadlineMain: 'Finde YouTube-Nischen,',
    heroHeadlineEmphasis: 'bevor sie explodieren',
    heroNarrative: 'Ich habe das gebaut, weil Recherche meine Wochenenden gefressen hat.',
    heroSubLeading: 'SurgeNiche markiert',
    heroSubBold: 'die kleinen Accounts, die zu steigen beginnen',
    heroSubTrailing: ' — bevor es jemand anderes bemerkt. Kein Keyword-Raten, keine Copy-Paste-Taktik.',
    heroBadge: '47 Kanäle sind in der letzten Stunde gestiegen',
    heroCta: 'Kostenlos ausprobieren',
    heroCta2: 'Wie es funktioniert',
    heroNextScanLabel: 'Nächster Scan in',
    heroNextScanFormat: (m: number, s: number) =>
      `${m}m ${s.toString().padStart(2, '0')}s`,

    radarLive: 'Live',
    radarPingPrefix: 'Kanal entdeckt',
    radarSubline: 'Wir beobachten die kleinen Kanäle in dem Moment, in dem sie zu steigen beginnen.',
    radarUnclusteredLabel: 'Cluster wird gebildet',
    radarFormatShorts: 'Shorts',
    radarFormatLongform: 'Longform',
    radarChannelsLast24h: (n: number) =>
      `${n.toLocaleString('de-DE')} Kanäle in den letzten 24 Stunden entdeckt`,

    tickerLive: 'LIVE',
    tickerSpikedLastHour: (n: number) =>
      `${n} Kanäle stiegen in der letzten Stunde`,
    tickerNichesToday: (n: number) =>
      `${n} neue Nischen heute entdeckt`,

    heroStatsChannelsScan: 'KANÄLE / SCAN',
    heroStatsNextScan: 'Nächster Scan',
    heroStatsSpikingNow: 'STEIGEN GERADE',
    heroStatsScanInterval: 'SCAN-INTERVALL',
    heroStatsScanIntervalValue: '1h',

    previewTitle: 'Diese Nischen steigen gerade.',
    previewSub: 'Kostenlos registrieren, um Kanalnamen und alle Metriken zu sehen.',
    previewCta: 'Alle Ergebnisse freischalten',

    painHeadline: 'Schluss mit Raten. Anfangen zu finden.',
    painTitle: 'Der langsame Weg',
    painItems: [
      'Stundenlang durch YouTube scrollen in der Hoffnung, einen Trend zu entdecken',
      'Kanäle kopieren, die schon vor zwei Monaten ihren Höhepunkt hatten',
      'Die Nische einen Tag nachdem sie nicht mehr funktioniert finden',
    ],
    solutionTitle: 'Mit SurgeNiche',
    solutionItems: [
      '230+ Kanäle unter 10k Subs werden stündlich analysiert',
      'Opportunity-Scores nach Spike, Engagement und Sättigung sortiert',
      'E-Mail-Alert in dem Moment, in dem deine getrackte Nische zu steigen beginnt',
    ],

    featuresTitle: 'Alles, was du brauchst, um eine Nische zu dominieren',
    featuresPremiumBadge: 'PREMIUM',
    featuresStatusLive: 'Jetzt verfügbar',
    featuresStatusSoon: 'Nächste Woche verfügbar',
    features: [
      { icon: 'bot', tier: 'all', title: 'KI-Opportunity-Score', desc: 'Kombinierter Score aus Spike, Engagement, Wettbewerb und Suchvolumen.' },
      { icon: 'clock', tier: 'all', title: 'Stündliche Scans', desc: '230+ Kanäle werden jede Stunde neu analysiert, damit du kein Spike-Fenster verpasst.' },
      { icon: 'flame', tier: 'all', title: 'Viral-Spike-Erkennung', desc: 'Markiert Kanäle mit einem 3-fachen oder höheren 48-Stunden-View-Sprung.' },
      { icon: 'heartbeat', tier: 'premium', status: 'live', title: 'KI Niche Health Check', desc: 'Ein Klick und du weißt, ob die Nische diese Woche den Sprung wert ist — Score plus ein strategisch geschriebener Absatz zu Risiken und Chancen.' },
      { icon: 'trend-up', tier: 'premium', status: 'soon', title: 'KI Clone & Twist', desc: 'Claude zeigt dir, wie du ein virales Format mit deinem eigenen Twist replizierst.' },
      { icon: 'lightbulb', tier: 'premium', title: '5 KI Shorts-Ideen', desc: 'Fünf produktionsbereite Shorts-Ideen, Hooks und Titel pro Nische — sofort umsetzbar.' },
      { icon: 'bell', tier: 'premium', status: 'soon', title: 'Frühwarnungen', desc: 'E-Mail- + In-App-Alerts in dem Moment, in dem deine Nische zu steigen beginnt.' },
      { icon: 'bookmark', tier: 'premium', title: 'Nischen speichern & verfolgen', desc: 'Speichere spikende Nischen in deiner Watchlist. Score-Update bei jedem App-Öffnen, kein erneutes Suchen.' },
    ],

    pricingTitle: 'Wähle den Plan, der zu deiner Woche passt.',
    pricingFree: 'Free',
    pricingBasic: 'Basic',
    pricingPremium: 'Premium',
    pricingFreePrice: '€0',
    pricingBasicPrice: '€9',
    pricingPremiumPrice: '€19',
    pricingPerMonth: '/ Monat',
    pricingPerYear: '/ Jahr',
    pricingToggleMonthly: 'Monatlich',
    pricingToggleYearly: 'Jährlich',
    pricingYearlySaveBadge: '17 % sparen',
    pricingBasicYearlyPrice: '€90',
    pricingBasicYearlyMonthly: '€7,50 / Monat',
    pricingPremiumYearlyPrice: '€190',
    pricingPremiumYearlyMonthly: '€15,83 / Monat',
    pricingBestValueBadge: 'Bestes Angebot',
    pricingCtaFree: 'Jetzt starten',
    pricingCtaBasic: 'Basic starten',
    pricingCtaPremium: 'Premium holen',
    pricingPremiumTrust: 'Jederzeit kündbar · Sichere Zahlung über Stripe',
    // Sprint A.7 — Feature-Listen entsprechen jetzt der Drei-Tier-Logik.
    pricingFreeFeatures: [
      '1 freigeschaltete Nische, rotiert täglich um Mitternacht UTC',
      'Kanalname + URL der freigeschalteten',
      'Top 4 Nischen verschwommen (Basic-Gebiet)',
      'Keine KI-Analysen',
      'Keine gespeicherten Nischen',
    ],
    pricingBasicFeatures: [
      'Top 5 Nischen pro Format freigeschaltet, täglich frisch',
      'Voller Kanalname, URL & exakte Metriken',
      '1 KI-Analyse pro Tag (Health Check + Angles)',
      '10 gespeicherte Nischen',
      'EN + DE Märkte',
    ],
    pricingPremiumFeatures: [
      'Alles aus Basic, plus:',
      'Alle Nischen freigeschaltet (Top 50)',
      'Unbegrenzte KI-Analysen',
      'Unbegrenzte Speicher',
      '30-Tage Scan-Historie',
      'Priority-Support',
    ],

    testimonialsTitle: 'Creator, die ihre Nische gefunden haben',
    testimonials: [
      {
        quote: "Eine deutsche 'silent study desk' Nische mit 12,4× Spike gefunden. Erster Short hat in 6 Tagen 84.000 Views gemacht. Ich habe monatelang manuell gesucht — das hat meine Wochenenden gerettet.",
        name: 'Marcus T.',
        handle: '@marcust_creates',
        detail: 'Shorts seit März 2024 · Berlin',
      },
      {
        quote: 'Der Opportunity-Score ist die einzige Metrik, der ich noch traue. 14 Nischen in der ersten Woche gespeichert, drei davon haben in 10 Tagen abgehoben. Bessere Trefferquote als meine letzten sechs Monate Raterei.',
        name: 'Sarah K.',
        handle: '@sarahkcontent',
        detail: 'Long-form Essays · Manchester',
      },
      {
        quote: 'Ich bin Litauer und mache deutschen Content. Der DE-Filter hat meine Recherche eliminiert — ich bekomme Nischen vorgeschlagen, nach denen ich nie gesucht hätte. Zwei meiner letzten vier Uploads über 50k.',
        name: 'Lukas B.',
        handle: '@lukasbfilms',
        detail: 'Cinematic Shorts · Vilnius',
      },
    ],

    ctaHeadline: 'Finde eine Nische, bevor sie überfüllt ist.',
    ctaButton: 'Kostenlos starten',

    footerTagline: 'KI-gestützte YouTube-Nischen-Entdeckung.',
    footerLinks: 'Links',
    footerLegal: 'Rechtliches',
    footerPrivacy: 'Datenschutz',
    footerTerms: 'AGB',
    footerCopyright: '© 2026 SurgeNiche',
  },
} as const

export type CopyKeys = typeof COPY[keyof typeof COPY]
