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
    const APIFY_MAX_ITEMS_PER_QUERY = parseInt(Deno.env.get('APIFY_MAX_ITEMS_PER_QUERY') ?? '25', 10)

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

    // 9. Trigger ONE Apify scraper run with the worst-case spend cap.
    const input: ApifyActorInput = {
      keywords: plan.keywords,
      sortBy: 'relevance',
      maxItemsPerQuery: APIFY_MAX_ITEMS_PER_QUERY,
      uploadDate: 'month',
      gl: 'us',
      hl: 'en',
    }
    const { runId, datasetId } = await startApifyRun(
      apifyToken,
      input,
      { maxTotalChargeUsd: APIFY_MAX_CHARGE_USD },
    )

    // 10. Record the run in apify_runs.
    const { error: insertErr } = await supabase.from('apify_runs').insert({
      apify_run_id: runId,
      dataset_id: datasetId,
      status: 'triggered',
      query_plan: {
        keywords: plan.keywords,
        categoryTargets: plan.categoryTargets,
        queriesPerRun: QUERIES_PER_RUN,
        targetPerCategory: TARGET_PER_CATEGORY,
      },
    })
    if (insertErr) throw insertErr

    // 11. Rotate the used seeds (same end-of-run update as discover/index.ts).
    if (plan.seedIds.length > 0) {
      await supabase
        .from('seed_keywords')
        .update({ last_used_at: new Date().toISOString() })
        .in('id', plan.seedIds)
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
