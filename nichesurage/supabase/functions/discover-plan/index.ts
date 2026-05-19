// supabase/functions/discover-plan/index.ts
//
// Apify Discovery Engine Phase 3: coverage-driven discovery planner.
//
// Analyses which content categories are under-populated in
// channels_watchlist, builds a deficit-weighted set of YouTube search
// queries, triggers ONE Apify scraper run, and records it in apify_runs.
// A later discover-ingest function polls the run and processes results.
//
// All decision logic lives in _shared/discoveryPlan.ts (pure, unit-tested).
// This file is IO orchestration only.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { startApifyRun, type ApifyActorInput } from '../_shared/apify.ts'
import {
  buildQueryPlan,
  computeCoverageDeficit,
  withinMonthlyBudget,
  type SeedRef,
} from '../_shared/discoveryPlan.ts'

Deno.serve(async (_req: Request) => {
  try {
    // 1. Env. Required values throw; optional values use parseInt/parseFloat
    //    with a default, matching discover/index.ts's SEEDS_PER_RUN pattern.
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const apifyToken = Deno.env.get('APIFY_API_TOKEN')
    if (!supabaseUrl) throw new Error('SUPABASE_URL not set')
    if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')
    if (!apifyToken) throw new Error('APIFY_API_TOKEN not set')

    const QUERIES_PER_RUN = parseInt(Deno.env.get('QUERIES_PER_RUN') ?? '8', 10)
    const TARGET_PER_CATEGORY = parseInt(Deno.env.get('TARGET_PER_CATEGORY') ?? '400', 10)
    const APIFY_MAX_CHARGE_USD = parseFloat(Deno.env.get('APIFY_MAX_CHARGE_USD') ?? '0.50')
    const APIFY_MONTHLY_BUDGET_USD = parseFloat(Deno.env.get('APIFY_MONTHLY_BUDGET_USD') ?? '25')
    const APIFY_MAX_RESULTS = parseInt(Deno.env.get('APIFY_MAX_RESULTS') ?? '5', 10)
    const APIFY_MAX_RESULTS_SHORTS = parseInt(Deno.env.get('APIFY_MAX_RESULTS_SHORTS') ?? '5', 10)
    // Search strategy. Tuning measured 'relevance' yielding 2 outliers/run
    // versus 0 for 'date': 'date' surfaces the newest uploads, but those are
    // too fresh to have accumulated views, so they fail the views-per-second
    // gate downstream. 'relevance' returns videos that already have traction,
    // which is what the outlier gates need. 'month' bounds the scrape to the
    // last 30 days of uploads. Both are env vars so the strategy can be
    // retuned without a redeploy.
    const APIFY_SORTING_ORDER = Deno.env.get('APIFY_SORTING_ORDER') ?? 'relevance'
    const APIFY_DATE_FILTER = Deno.env.get('APIFY_DATE_FILTER') ?? 'month'

    // 2. Service-role client (bypasses RLS, same import as discover/index.ts).
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // 3. Idempotency guard: never start a second concurrent run.
    const { data: inFlight, error: inFlightErr } = await supabase
      .from('apify_runs')
      .select('id')
      .eq('status', 'triggered')
      .limit(1)
    if (inFlightErr) throw inFlightErr
    if (inFlight && inFlight.length > 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'run already in flight' }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    }

    // 4. Coverage analysis: the chained Supabase client cannot GROUP BY, so
    //    fetch all live watchlist rows and reduce in JS (same technique as
    //    discover/index.ts). Rows with a null category are ignored.
    const { data: watchlistRows, error: watchlistErr } = await supabase
      .from('channels_watchlist')
      .select('category')
      .is('evicted_at', null)
    if (watchlistErr) throw watchlistErr

    const countsByCategory: Record<string, number> = {}
    for (const row of (watchlistRows ?? []) as { category: string | null }[]) {
      if (!row.category) continue
      countsByCategory[row.category] = (countsByCategory[row.category] ?? 0) + 1
    }

    // 5. Deficit analysis.
    const deficits = computeCoverageDeficit(countsByCategory, TARGET_PER_CATEGORY)
    if (deficits.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'all categories at target' }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    }

    // 6. Load seeds for the deficit categories, least-recently-used first
    //    (same rotation ordering as discover/index.ts).
    const deficitCategories = deficits.map(d => d.category)
    const { data: seedRows, error: seedErr } = await supabase
      .from('seed_keywords')
      .select('id, term, category')
      .eq('is_active', true)
      .eq('language', 'en')
      .in('category', deficitCategories)
      .order('last_used_at', { ascending: true, nullsFirst: true })
    if (seedErr) throw seedErr

    const seedsByCategory: Record<string, SeedRef[]> = {}
    for (const row of (seedRows ?? []) as { id: string; term: string; category: string }[]) {
      ;(seedsByCategory[row.category] ??= []).push({ id: row.id, term: row.term })
    }

    // 7. Build the deficit-weighted query plan.
    const plan = buildQueryPlan(deficits, seedsByCategory, QUERIES_PER_RUN)
    if (plan.keywords.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'no seeds available for deficit categories' }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    }

    // 8. Monthly budget guard: sum cost_usd for runs triggered this calendar
    //    month (UTC). A run is allowed only if its worst-case cost still fits.
    const now = new Date()
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const { data: monthRuns, error: monthErr } = await supabase
      .from('apify_runs')
      .select('cost_usd')
      .gte('triggered_at', startOfMonth.toISOString())
    if (monthErr) throw monthErr

    const monthSpend = ((monthRuns ?? []) as { cost_usd: number | null }[])
      .reduce((sum, r) => sum + (r.cost_usd ?? 0), 0)
    if (!withinMonthlyBudget(monthSpend, APIFY_MAX_CHARGE_USD, APIFY_MONTHLY_BUDGET_USD)) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'monthly budget exceeded' }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    }

    // 9. Trigger ONE Apify scraper run. The official actor caps results
    //    per-query via maxResults / maxResultsShorts; streams are disabled.
    //    sortingOrder + dateFilter bias the scrape toward recent uploads from
    //    small channels (see APIFY_SORTING_ORDER comment above).
    //    No run options are sent - the proven-working manual run used none.
    //    APIFY_MAX_CHARGE_USD still feeds the monthly-budget guard above.
    const input: ApifyActorInput = {
      searchQueries: plan.keywords,
      maxResults: APIFY_MAX_RESULTS,
      maxResultsShorts: APIFY_MAX_RESULTS_SHORTS,
      maxResultStreams: 0,
      sortingOrder: APIFY_SORTING_ORDER,
      dateFilter: APIFY_DATE_FILTER,
    }
    const { runId, datasetId } = await startApifyRun(apifyToken, input, {})

    // 10. Record the run in apify_runs. The Apify run is already live at this
    //     point, so if the insert fails we have an orphaned (paid, untracked)
    //     run. We cannot un-trigger it, so we log its identifiers loudly at
    //     error level for manual reconciliation before re-throwing.
    const { error: insertErr } = await supabase.from('apify_runs').insert({
      apify_run_id: runId,
      dataset_id: datasetId,
      status: 'triggered',
      query_plan: {
        keywords: plan.keywords,
        categoryTargets: plan.categoryTargets,
        seedIds: plan.seedIds,
        queriesPerRun: QUERIES_PER_RUN,
        targetPerCategory: TARGET_PER_CATEGORY,
      },
    })
    if (insertErr) {
      console.error(
        'discover-plan: ORPHANED Apify run - triggered but not recorded. runId=' +
          runId + ' datasetId=' + datasetId +
          '. Manually reconcile apify_runs.',
      )
      throw insertErr
    }

    // 11. Rotate the used seeds (same end-of-run update as discover/index.ts).
    //     The Apify run is already triggered and recorded, so a failure here
    //     must NOT fail the request; log it so a broken LRU rotation (same
    //     seeds re-picked) is visible.
    if (plan.seedIds.length > 0) {
      const { error: rotationErr } = await supabase
        .from('seed_keywords')
        .update({ last_used_at: new Date().toISOString() })
        .in('id', plan.seedIds)
      if (rotationErr) {
        console.error(
          'discover-plan: seed rotation update failed: ' + rotationErr.message,
        )
      }
    }

    // 12. Done.
    return new Response(
      JSON.stringify({ success: true, apify_run_id: runId, keywords: plan.keywords }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('discover-plan fatal error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
