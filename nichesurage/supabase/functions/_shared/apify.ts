// supabase/functions/_shared/apify.ts
//
// Apify Discovery Engine Phase 2: thin typed wrapper over 3 Apify REST
// endpoints. Two edge functions (built in later phases) trigger and read
// YouTube scraper runs through this module.
//
// Single API token, no key rotation, no retry (YAGNI). Every function takes
// an injectable fetch so unit tests never hit the network.

import type { FetchLike } from './categories.ts'

export type { FetchLike }

const ACTOR_ID = 'streamers~youtube-scraper'
const API_BASE = 'https://api.apify.com/v2'

// Actor input for the official streamers/youtube-scraper search mode. A live
// proof run verified the minimal working input: `searchQueries` for the
// keyword searches plus the three `maxResults*` caps (each defaults to 0, so
// they MUST be set or the run returns nothing). `sortingOrder` is one of
// relevance|rating|date|views. `dateFilter` (hour|today|week|month|year)
// exists but is deliberately unused for now.
export interface ApifyActorInput {
  searchQueries: string[]
  maxResults?: number
  maxResultsShorts?: number
  maxResultStreams?: number
  sortingOrder?: string
  dateFilter?: string
}

// One real video row returned in the run's default dataset. All fields are
// FLAT: channel info is `channelId` / `channelName` / `numberOfSubscribers`,
// not nested. `viewCount` is a number; `duration` is a STRING "HH:MM:SS" (or
// "MM:SS"); `input` is the search query that produced this item. `type` is
// 'video' for longform and 'shorts' for a Short - both are real results.
// The dataset also contains placeholder items (no channelId) for queries that
// yielded nothing - getApifyDatasetItems filters those out.
export interface ApifyVideoItem {
  id: string
  title: string
  url: string
  duration: string          // video length as "HH:MM:SS" or "MM:SS"
  viewCount: number
  channelId: string
  channelName: string
  numberOfSubscribers: number
  type: string
  input: string             // the search query that produced this item
}

// Run-trigger options forwarded to Apify as URL query params. Used to cap
// spend / volume on a single run.
export interface ApifyRunOptions {
  maxTotalChargeUsd?: number
  maxItems?: number
}

// Authed fetch + non-2xx guard. Mirrors the error-formatting style in
// youtube.ts: `${endpoint} failed ${status}: ${truncatedBody}`.
async function apifyFetch(
  endpoint: string,
  url: string,
  token: string,
  init: RequestInit,
  fetchImpl: FetchLike,
): Promise<Response> {
  const res = await fetchImpl(url, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${endpoint} failed ${res.status}: ${body.slice(0, 500)}`)
  }

  return res
}

/**
 * Trigger a YouTube scraper run. POSTs the actor input; `options`, when
 * present, are appended as URL query params so Apify enforces the spend /
 * volume caps server-side.
 *
 * @returns the new run id and its default dataset id (poll the run, then
 *          read items from the dataset once it succeeds).
 */
export async function startApifyRun(
  token: string,
  input: ApifyActorInput,
  options: ApifyRunOptions = {},
  fetchImpl: FetchLike = fetch,
): Promise<{ runId: string; datasetId: string }> {
  const url = new URL(`${API_BASE}/acts/${ACTOR_ID}/runs`)
  if (options.maxTotalChargeUsd !== undefined) {
    url.searchParams.set('maxTotalChargeUsd', String(options.maxTotalChargeUsd))
  }
  if (options.maxItems !== undefined) {
    url.searchParams.set('maxItems', String(options.maxItems))
  }

  const res = await apifyFetch(
    'startApifyRun',
    url.toString(),
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    fetchImpl,
  )

  const data = await res.json() as {
    data?: { id?: unknown; defaultDatasetId?: unknown }
  }
  const id = data?.data?.id
  const defaultDatasetId = data?.data?.defaultDatasetId
  if (typeof id !== 'string' || id === '' ||
      typeof defaultDatasetId !== 'string' || defaultDatasetId === '') {
    throw new Error('startApifyRun: malformed Apify response')
  }
  return { runId: id, datasetId: defaultDatasetId }
}

/**
 * Read the current status of a run. `usageTotalUsd` and `finishedAt` are
 * absent while a run is still in progress, so both default to null.
 */
export async function getApifyRunStatus(
  token: string,
  runId: string,
  fetchImpl: FetchLike = fetch,
): Promise<{
  status: string
  usageTotalUsd: number | null
  finishedAt: string | null
  datasetId: string
}> {
  const res = await apifyFetch(
    'getApifyRunStatus',
    `${API_BASE}/actor-runs/${encodeURIComponent(runId)}`,
    token,
    { method: 'GET' },
    fetchImpl,
  )

  const data = await res.json() as {
    data?: {
      status?: unknown
      usageTotalUsd?: number | null
      finishedAt?: string | null
      defaultDatasetId?: unknown
    }
  }
  const status = data?.data?.status
  const defaultDatasetId = data?.data?.defaultDatasetId
  if (typeof status !== 'string' || status === '' ||
      typeof defaultDatasetId !== 'string' || defaultDatasetId === '') {
    throw new Error('getApifyRunStatus: malformed Apify response')
  }
  return {
    status,
    usageTotalUsd: data.data?.usageTotalUsd ?? null,
    finishedAt: data.data?.finishedAt ?? null,
    datasetId: defaultDatasetId,
  }
}

/**
 * Read all items from a run's default dataset, projected to the fields the
 * discovery pipeline needs.
 */
export async function getApifyDatasetItems(
  token: string,
  datasetId: string,
  fetchImpl: FetchLike = fetch,
): Promise<ApifyVideoItem[]> {
  const url = new URL(`${API_BASE}/datasets/${encodeURIComponent(datasetId)}/items`)
  url.searchParams.set('format', 'json')
  url.searchParams.set(
    'fields',
    'id,title,url,duration,viewCount,channelId,channelName,numberOfSubscribers,type,input',
  )

  const res = await apifyFetch(
    'getApifyDatasetItems',
    url.toString(),
    token,
    { method: 'GET' },
    fetchImpl,
  )

  const data = await res.json()
  if (!Array.isArray(data)) {
    throw new Error('getApifyDatasetItems: expected array response')
  }
  // Keep real results only. The official actor returns `type: 'video'` for
  // longform and `type: 'shorts'` for a Short - KEEP BOTH (the discovery
  // pipeline targets faceless Shorts channels heavily). The dataset also
  // contains placeholder items (e.g. `{ url, error: 'NO_VIDEOS', input }`)
  // with no channelId, and may include `type: 'channel'` results - drop
  // anything that is not a video/short carrying a channelId.
  return (data as ApifyVideoItem[]).filter(
    it => (it.type === 'video' || it.type === 'shorts') && !!it.channelId,
  )
}
