// supabase/functions/discover-ingest/index.ts
//
// Apify Discovery Engine Phase 4: coverage-driven discovery ingester.
//
// Runs on a cron. Polls apify_runs rows with status='triggered', checks the
// Apify run state, and when a run has SUCCEEDED, processes its scraped video
// results into new channels_watchlist rows. Failed/aborted Apify runs flip
// the row to status='failed'.
//
// All pure decision logic lives in _shared/discoveryIngest.ts (unit-tested).
// This file is IO orchestration only. Each triggered run is processed inside
// its own try/catch so one bad run never aborts the others.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  getApifyRunStatus,
  getApifyDatasetItems,
  type ApifyVideoItem,
} from '../_shared/apify.ts'
import { getChannelStats, getYoutubeKeys } from '../_shared/youtube.ts'
import { buildNicheLabel } from '../_shared/labeling.ts'
import { classifyFaceless } from '../_shared/faceless.ts'
import { DISCOVERED_CHANNEL_LANGUAGE } from '../_shared/constants.ts'
import { dedupCandidates, inferContentType } from '../_shared/discoveryIngest.ts'

// Discover gates - the subscriber and per-video outlier thresholds an
// Apify-discovered channel must clear to enter channels_watchlist.
//
// NO AGE GATE (unlike discover/index.ts): discovery targets small channels
// whose video outperforms their subscriber count - a high views-per-
// subscriber outlier. Channel age is irrelevant to that signal: a long-lived
// small channel with a breakout video is just as valid a niche signal as a
// brand-new one. Two proof runs rejected ~25% of candidates as `tooOld`
// purely on age, before the VPS outlier gate could even see them, so the age
// gate was removed. MAX_SUBS stays low on purpose: large channels get views
// on anything they post, proving nothing about a niche.
const MIN_SUBS_SHORTS = 5_000
const MIN_SUBS_LONGFORM = 2_000
const MAX_SUBS_SHORTS = 400_000
const MAX_SUBS_LONGFORM = 400_000
const DISCOVER_MIN_VIEWS_SHORTS = 15_000
const DISCOVER_MIN_VIEWS_LONGFORM = 3_000
const DISCOVER_MIN_VPS_SHORTS = 200
const DISCOVER_MIN_VPS_LONGFORM = 2
const MAX_VIDEO_COUNT_LONGFORM = 200
const MAX_VIDEO_COUNT_SHORTS = 500

// Apify run states that mean the run is still in progress - leave the row
// untouched and re-poll on the next cron tick.
const IN_PROGRESS = new Set(['RUNNING', 'READY', 'ABORTING'])
// Apify run states that mean the run will never produce a dataset.
const TERMINAL_FAILURE = new Set(['FAILED', 'TIMED-OUT', 'ABORTED'])

interface ApifyRunRow {
  id: string
  apify_run_id: string
  dataset_id: string
}

Deno.serve(async (_req: Request) => {
  try {
    // 1. Env. Required values throw; ANTHROPIC_API_KEY is optional - when
    //    absent, niche labels fall back to the seed query (same as
    //    discover/index.ts).
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const apifyToken = Deno.env.get('APIFY_API_TOKEN')
    if (!supabaseUrl) throw new Error('SUPABASE_URL not set')
    if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')
    if (!apifyToken) throw new Error('APIFY_API_TOKEN not set')
    const youtubeKeys = getYoutubeKeys()
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? null
    if (!anthropicKey) {
      console.warn('ANTHROPIC_API_KEY not set - niche labels will fall back to the seed query')
    }

    // 2. Service-role client (bypasses RLS, same import as discover/index.ts).
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // 3. Pull every triggered run.
    const { data: runRows, error: runsErr } = await supabase
      .from('apify_runs')
      .select('*')
      .eq('status', 'triggered')
    if (runsErr) throw runsErr
    const runs = (runRows ?? []) as ApifyRunRow[]

    let runsProcessed = 0
    let channelsAdded = 0

    // 4. Process each triggered run inside its OWN try/catch so one failing
    //    run never aborts the others.
    for (const run of runs) {
      try {
        const runStatus = await getApifyRunStatus(apifyToken, run.apify_run_id)

        // 4b. Still running - leave the row untouched, re-poll next tick.
        if (IN_PROGRESS.has(runStatus.status)) {
          continue
        }

        // 4c. Terminal failure - flip the row to failed and move on.
        //     A FAILED/TIMED-OUT/ABORTED run still incurred Apify compute
        //     cost, so persist usageTotalUsd into cost_usd (it may be null -
        //     write whatever it is) so discover-plan's monthly budget guard
        //     does not undercount true spend.
        if (TERMINAL_FAILURE.has(runStatus.status)) {
          await supabase
            .from('apify_runs')
            .update({
              status: 'failed',
              apify_status: runStatus.status,
              cost_usd: runStatus.usageTotalUsd,
              error_message: 'Apify run ended in state ' + runStatus.status,
            })
            .eq('id', run.id)
          continue
        }

        // 4d. SUCCEEDED - run the ingest.
        if (runStatus.status === 'SUCCEEDED') {
          const added = await ingestRun(
            supabase,
            run,
            runStatus.usageTotalUsd,
            apifyToken,
            youtubeKeys,
            anthropicKey,
          )
          channelsAdded += added
          runsProcessed++
          continue
        }

        // Unknown Apify status - treat as a failure so the row doesn't loop
        // forever in 'triggered'. Persist usageTotalUsd into cost_usd for the
        // same budget-accuracy reason as the terminal-failure path above.
        await supabase
          .from('apify_runs')
          .update({
            status: 'failed',
            apify_status: runStatus.status,
            cost_usd: runStatus.usageTotalUsd,
            error_message: 'Unrecognized Apify run state ' + runStatus.status,
          })
          .eq('id', run.id)
      } catch (err) {
        // 4e. Anything thrown while processing this run - mark it errored and
        //     continue to the next run.
        console.error('discover-ingest: run ' + run.apify_run_id + ' failed:', err)
        await supabase
          .from('apify_runs')
          .update({ status: 'error', error_message: String(err) })
          .eq('id', run.id)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        runs_processed: runsProcessed,
        channels_added: channelsAdded,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    // Catastrophic failure (e.g. missing env) - 500 with the same error
    // envelope shape as discover/index.ts.
    console.error('discover-ingest fatal error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

/**
 * Ingest a single SUCCEEDED Apify run: read its dataset, dedup into per-channel
 * candidates, gate them through the discover thresholds, niche-label and insert
 * the survivors into channels_watchlist, then mark the apify_runs row ingested.
 *
 * Re-entrancy: a mid-loop throw leaves the run status='triggered', and the next
 * cron tick safely re-ingests because already-inserted channels are deduped via
 * the existing-ids Set and a 23505 unique violation covers any remaining race.
 *
 * @returns the number of channels actually inserted.
 */
async function ingestRun(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  run: ApifyRunRow,
  usageTotalUsd: number | null,
  apifyToken: string,
  youtubeKeys: string[],
  anthropicKey: string | null,
): Promise<number> {
  // a. Read every scraped video item from the run's dataset.
  const items: ApifyVideoItem[] = await getApifyDatasetItems(apifyToken, run.dataset_id)

  // b. Load existing watchlist channel ids so we never re-insert a channel.
  //    This select intentionally does NOT filter evicted_at IS NULL: an evicted
  //    channel still has a row (the youtube_channel_id UNIQUE constraint
  //    persists), so including evicted ids in the Set avoids attempting a
  //    doomed INSERT that would just hit a swallowed 23505. Resurrecting an
  //    evicted channel would require UPDATE logic and is out of scope here -
  //    this discovery path is insert-only by design.
  const { data: existing, error: existingErr } = await supabase
    .from('channels_watchlist')
    .select('youtube_channel_id')
  if (existingErr) throw existingErr
  const existingSet = new Set<string>(
    (existing ?? []).map((c: { youtube_channel_id: string }) => c.youtube_channel_id),
  )

  // True number of distinct channels the Apify dataset contained, computed
  // from the raw items BEFORE dedup and existing-id exclusion. Reported as
  // channels_found so an operator sees the real scrape coverage, not the
  // post-exclusion remainder.
  const distinctChannelsScraped = new Set(
    items.map(it => it.channelId).filter((id): id is string => !!id),
  ).size

  // c. Dedup the flat item list into one candidate per new channel.
  const candidates = dedupCandidates(items, existingSet)

  // d. Build a term -> category map. Category is inherited from the seed
  //    keyword that produced each candidate's best-hit search query, the
  //    same way discover/index.ts inherits category from its seed. Collect
  //    the distinct searchQuery values, look them up in seed_keywords, and
  //    index by term. Candidates whose query is not a known seed get a null
  //    category.
  const distinctQueries = Array.from(
    new Set(candidates.map(c => c.searchQuery).filter(q => !!q)),
  )
  const categoryByTerm = new Map<string, string | null>()
  if (distinctQueries.length > 0) {
    const { data: termRows, error: termErr } = await supabase
      .from('seed_keywords')
      .select('term, category')
      .in('term', distinctQueries)
    if (termErr) throw termErr
    for (const row of (termRows ?? []) as { term: string; category: string | null }[]) {
      categoryByTerm.set(row.term, row.category ?? null)
    }
  }

  // e. Hydrate channel stats from the YouTube API (helper batches by 50).
  //    The candidate count hydrated here is bounded indirectly by
  //    APIFY_MAX_ITEMS_PER_QUERY x QUERIES_PER_RUN (the planner's per-run
  //    scrape ceiling), and this hydration draws on the SAME YouTube Data API
  //    key budget as the scan and discover functions - keep that shared quota
  //    in mind before raising either Apify limit.
  const candidateChannelIds = candidates.map(c => c.channelId)
  const stats = candidateChannelIds.length > 0
    ? await getChannelStats(youtubeKeys, candidateChannelIds)
    : []
  const statsByChannel = new Map(stats.map(s => [s.channelId, s]))

  // f. Gate and insert each candidate. Gate sequencing + comparison style
  //    mirror discover/index.ts. Every gate increments a rejection counter so
  //    the end-of-ingest summary log shows exactly where candidates are lost -
  //    discovery yield tuning needs this breakdown, not a silent drop.
  const rejected = {
    noStats: 0,
    subsTooLow: 0,
    subsTooHigh: 0,
    tooManyVideos: 0,
    viewsTooLow: 0,
    vpsTooLow: 0,
    face: 0,
  }
  let duplicates = 0
  let channelsAdded = 0
  for (const candidate of candidates) {
    const channel = statsByChannel.get(candidate.channelId)
    // No stats means the channel id was not resolvable (deleted/private) -
    // skip it, same as discover/index.ts only iterating resolved stats.
    if (!channel) {
      rejected.noStats++
      continue
    }

    const contentType = inferContentType(candidate.shortsHitRatio)
    const minSubs = contentType === 'shorts' ? MIN_SUBS_SHORTS : MIN_SUBS_LONGFORM
    const maxSubs = contentType === 'shorts' ? MAX_SUBS_SHORTS : MAX_SUBS_LONGFORM
    const minViews = contentType === 'shorts' ? DISCOVER_MIN_VIEWS_SHORTS : DISCOVER_MIN_VIEWS_LONGFORM
    const minVps = contentType === 'shorts' ? DISCOVER_MIN_VPS_SHORTS : DISCOVER_MIN_VPS_LONGFORM
    const maxVideoCount = contentType === 'shorts' ? MAX_VIDEO_COUNT_SHORTS : MAX_VIDEO_COUNT_LONGFORM

    if (channel.subscriberCount < minSubs) {
      rejected.subsTooLow++
      continue
    }
    if (channel.subscriberCount > maxSubs) {
      rejected.subsTooHigh++
      continue
    }
    if (channel.videoCount > maxVideoCount) {
      rejected.tooManyVideos++
      continue
    }

    // Pre-screen: best Apify search-hit must clear both the absolute view
    // floor AND the VPS floor (same dual gate as discover/index.ts).
    const bestHitVps = candidate.bestHitViews / Math.max(channel.subscriberCount, 1)
    if (candidate.bestHitViews < minViews) {
      rejected.viewsTooLow++
      continue
    }
    if (bestHitVps < minVps) {
      rejected.vpsTooLow++
      continue
    }

    // Faceless gate. NicheSurage's audience is faceless-channel creators, so
    // a channel with an on-camera host/personality is hard-rejected here -
    // never inserted. Gated on ANTHROPIC_API_KEY: when absent, the verdict is
    // treated as 'uncertain' (kept) without calling Claude. The stored
    // `faceless` boolean is true only for a confirmed 'faceless' verdict.
    const facelessVerdict = anthropicKey
      ? await classifyFaceless(candidate.channelName, candidate.allTitles, anthropicKey)
      : 'uncertain'
    if (facelessVerdict === 'face') {
      rejected.face++
      continue
    }
    const faceless = facelessVerdict === 'faceless'

    // Niche label from the titles already in the Apify dataset - no
    // getRecentVideos call. Skipped (label = searchQuery) when there is no
    // ANTHROPIC_API_KEY, same key-gating as discover/index.ts.
    let nicheLabel = candidate.searchQuery
    if (anthropicKey) {
      nicheLabel = await buildNicheLabel({
        apiKey: anthropicKey,
        channelName: candidate.channelName,
        recentTitles: candidate.allTitles,
        fallback: candidate.searchQuery,
      })
    }

    const { error: insertErr } = await supabase.from('channels_watchlist').insert({
      youtube_channel_id: candidate.channelId,
      // Authoritative channel name from the YouTube API stats, not the
      // Apify-derived candidate.channelName.
      channel_name: channel.channelName,
      niche_label: nicheLabel,
      content_type: contentType,
      language: DISCOVERED_CHANNEL_LANGUAGE,
      // The search query that produced the best hit, attributed as the seed.
      seed_keyword: candidate.searchQuery,
      // Category inherited from the seed keyword behind the search query;
      // null when the query is not a known seed (consistent with discover).
      category: categoryByTerm.get(candidate.searchQuery) ?? null,
      discovered_via: 'apify_search',
      faceless,
    })
    if (insertErr) {
      // 23505 = unique violation - a concurrent insert won the race. Benign.
      if (insertErr.code !== '23505') {
        console.error('discover-ingest: watchlist insert failed for ' + candidate.channelId + ':', insertErr)
      } else {
        duplicates++
      }
    } else {
      channelsAdded++
      existingSet.add(candidate.channelId)
    }
  }

  // f2. Structured ingest summary. One JSON line per run so discovery yield
  //     can be diagnosed from edge logs: it shows how many candidates each
  //     gate rejected, vs how many were inserted / hit a duplicate.
  console.log('discover-ingest: ingest summary ' + JSON.stringify({
    apifyRunId: run.apify_run_id,
    distinctChannelsScraped,
    candidates: candidates.length,
    channelsAdded,
    duplicates,
    rejected,
  }))

  // g. Mark the run ingested.
  const { error: updateErr } = await supabase
    .from('apify_runs')
    .update({
      status: 'ingested',
      apify_status: 'SUCCEEDED',
      cost_usd: usageTotalUsd,
      channels_found: distinctChannelsScraped,
      channels_added: channelsAdded,
      ingested_at: new Date().toISOString(),
    })
    .eq('id', run.id)
  if (updateErr) throw updateErr

  return channelsAdded
}
