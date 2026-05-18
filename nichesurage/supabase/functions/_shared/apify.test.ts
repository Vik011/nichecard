// supabase/functions/_shared/apify.test.ts
//
// Deno test runner (Jest ignores supabase/functions per jest.config.ts).
// Run locally: `deno test supabase/functions/_shared/apify.test.ts`
// (no real net hits, no env needed: every test injects a fake fetch.)
import { assertEquals, assertRejects, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  startApifyRun,
  getApifyRunStatus,
  getApifyDatasetItems,
  type ApifyActorInput,
  type ApifyVideoItem,
  type FetchLike,
} from './apify.ts'

// Captures the request the function under test made, then returns a
// canned response. Mirrors the makeFetch pattern in categories.test.ts.
function makeFetch(response: {
  ok?: boolean
  status?: number
  body: unknown
}): { fetch: FetchLike; calls: Array<{ url: string; init?: RequestInit }> } {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fetch = ((input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init })
    return Promise.resolve({
      ok: response.ok ?? true,
      status: response.status ?? 200,
      json: () => Promise.resolve(response.body),
      text: () => Promise.resolve(JSON.stringify(response.body)),
    } as unknown as Response)
  }) as FetchLike
  return { fetch, calls }
}

const TOKEN = 'apify_api_faketoken'

const SAMPLE_INPUT: ApifyActorInput = {
  keywords: ['ai tools', 'chatgpt tips'],
  sort: 'r',
  maxItems: 200,
  uploadDate: 'w',
}

// --- startApifyRun ----------------------------------------------------------

Deno.test('startApifyRun: POSTs to the youtube-scraper acts endpoint', async () => {
  const { fetch, calls } = makeFetch({
    body: { data: { id: 'run123', defaultDatasetId: 'ds456' } },
  })
  await startApifyRun(TOKEN, SAMPLE_INPUT, {}, fetch)
  assertEquals(calls.length, 1)
  const url = new URL(calls[0].url)
  assertEquals(url.origin + url.pathname, 'https://api.apify.com/v2/acts/apidojo~youtube-scraper/runs')
  assertEquals(calls[0].init?.method, 'POST')
})

Deno.test('startApifyRun: sets Authorization Bearer and Content-Type headers', async () => {
  const { fetch, calls } = makeFetch({
    body: { data: { id: 'run123', defaultDatasetId: 'ds456' } },
  })
  await startApifyRun(TOKEN, SAMPLE_INPUT, {}, fetch)
  const headers = calls[0].init?.headers as Record<string, string>
  assertEquals(headers['Authorization'], `Bearer ${TOKEN}`)
  assertEquals(headers['Content-Type'], 'application/json')
})

Deno.test('startApifyRun: request body is the JSON-stringified input', async () => {
  const { fetch, calls } = makeFetch({
    body: { data: { id: 'run123', defaultDatasetId: 'ds456' } },
  })
  await startApifyRun(TOKEN, SAMPLE_INPUT, {}, fetch)
  assertEquals(calls[0].init?.body, JSON.stringify(SAMPLE_INPUT))
})

Deno.test('startApifyRun: appends maxTotalChargeUsd / maxItems as query params when given', async () => {
  const { fetch, calls } = makeFetch({
    body: { data: { id: 'run123', defaultDatasetId: 'ds456' } },
  })
  await startApifyRun(TOKEN, SAMPLE_INPUT, { maxTotalChargeUsd: 5, maxItems: 200 }, fetch)
  const url = new URL(calls[0].url)
  assertEquals(url.searchParams.get('maxTotalChargeUsd'), '5')
  assertEquals(url.searchParams.get('maxItems'), '200')
})

Deno.test('startApifyRun: omits query params when options are absent', async () => {
  const { fetch, calls } = makeFetch({
    body: { data: { id: 'run123', defaultDatasetId: 'ds456' } },
  })
  await startApifyRun(TOKEN, SAMPLE_INPUT, {}, fetch)
  const url = new URL(calls[0].url)
  assertEquals(url.searchParams.has('maxTotalChargeUsd'), false)
  assertEquals(url.searchParams.has('maxItems'), false)
})

Deno.test('startApifyRun: returns runId and datasetId parsed from data', async () => {
  const { fetch } = makeFetch({
    body: { data: { id: 'run123', defaultDatasetId: 'ds456' } },
  })
  const result = await startApifyRun(TOKEN, SAMPLE_INPUT, {}, fetch)
  assertEquals(result, { runId: 'run123', datasetId: 'ds456' })
})

Deno.test('startApifyRun: non-2xx response throws Error with status', async () => {
  const { fetch } = makeFetch({
    ok: false,
    status: 401,
    body: { error: { message: 'token invalid' } },
  })
  const err = await assertRejects(
    () => startApifyRun(TOKEN, SAMPLE_INPUT, {}, fetch),
    Error,
  )
  assertStringIncludes(err.message, '401')
})

Deno.test('startApifyRun: malformed 2xx body ({data: null}) throws a clear Error', async () => {
  const { fetch } = makeFetch({ body: { data: null } })
  const err = await assertRejects(
    () => startApifyRun(TOKEN, SAMPLE_INPUT, {}, fetch),
    Error,
  )
  assertStringIncludes(err.message, 'startApifyRun: malformed Apify response')
})

Deno.test('startApifyRun: malformed 2xx body ({}) throws a clear Error', async () => {
  const { fetch } = makeFetch({ body: {} })
  const err = await assertRejects(
    () => startApifyRun(TOKEN, SAMPLE_INPUT, {}, fetch),
    Error,
  )
  assertStringIncludes(err.message, 'startApifyRun: malformed Apify response')
})

Deno.test('startApifyRun: non-2xx error body over 500 chars is truncated in the message', async () => {
  const { fetch } = makeFetch({
    ok: false,
    status: 502,
    body: 'x'.repeat(2000),
  })
  const err = await assertRejects(
    () => startApifyRun(TOKEN, SAMPLE_INPUT, {}, fetch),
    Error,
  )
  // body is JSON-stringified then sliced to 500 chars; the prefix
  // 'startApifyRun failed 502: ' plus the slice bounds total length.
  assertEquals(err.message.length < 600, true)
  assertEquals(err.message.includes('x'.repeat(600)), false)
})

// --- getApifyRunStatus ------------------------------------------------------

Deno.test('getApifyRunStatus: GETs the actor-runs endpoint with the runId', async () => {
  const { fetch, calls } = makeFetch({
    body: {
      data: {
        status: 'RUNNING',
        usageTotalUsd: null,
        finishedAt: null,
        defaultDatasetId: 'ds456',
      },
    },
  })
  await getApifyRunStatus(TOKEN, 'run123', fetch)
  assertEquals(calls.length, 1)
  assertEquals(calls[0].url, 'https://api.apify.com/v2/actor-runs/run123')
  assertEquals(calls[0].init?.method, 'GET')
  const headers = calls[0].init?.headers as Record<string, string>
  assertEquals(headers['Authorization'], `Bearer ${TOKEN}`)
})

Deno.test('getApifyRunStatus: parses a finished run', async () => {
  const { fetch } = makeFetch({
    body: {
      data: {
        status: 'SUCCEEDED',
        usageTotalUsd: 0.42,
        finishedAt: '2026-05-18T10:00:00.000Z',
        defaultDatasetId: 'ds456',
      },
    },
  })
  const result = await getApifyRunStatus(TOKEN, 'run123', fetch)
  assertEquals(result, {
    status: 'SUCCEEDED',
    usageTotalUsd: 0.42,
    finishedAt: '2026-05-18T10:00:00.000Z',
    datasetId: 'ds456',
  })
})

Deno.test('getApifyRunStatus: defaults missing usageTotalUsd / finishedAt to null', async () => {
  const { fetch } = makeFetch({
    body: { data: { status: 'RUNNING', defaultDatasetId: 'ds456' } },
  })
  const result = await getApifyRunStatus(TOKEN, 'run123', fetch)
  assertEquals(result.status, 'RUNNING')
  assertEquals(result.usageTotalUsd, null)
  assertEquals(result.finishedAt, null)
  assertEquals(result.datasetId, 'ds456')
})

Deno.test('getApifyRunStatus: non-2xx response throws Error with status', async () => {
  const { fetch } = makeFetch({
    ok: false,
    status: 404,
    body: { error: { message: 'run not found' } },
  })
  const err = await assertRejects(
    () => getApifyRunStatus(TOKEN, 'missing', fetch),
    Error,
  )
  assertStringIncludes(err.message, '404')
})

Deno.test('getApifyRunStatus: malformed 2xx body ({data: null}) throws a clear Error', async () => {
  const { fetch } = makeFetch({ body: { data: null } })
  const err = await assertRejects(
    () => getApifyRunStatus(TOKEN, 'run123', fetch),
    Error,
  )
  assertStringIncludes(err.message, 'getApifyRunStatus: malformed Apify response')
})

Deno.test('getApifyRunStatus: malformed 2xx body ({}) throws a clear Error', async () => {
  const { fetch } = makeFetch({ body: {} })
  const err = await assertRejects(
    () => getApifyRunStatus(TOKEN, 'run123', fetch),
    Error,
  )
  assertStringIncludes(err.message, 'getApifyRunStatus: malformed Apify response')
})

// --- getApifyDatasetItems ---------------------------------------------------

const SAMPLE_ITEMS: ApifyVideoItem[] = [
  {
    channelId: 'UC_abc',
    channelName: 'AI Hustle Daily',
    viewCount: 120000,
    title: 'I made $10k with ChatGPT',
    url: 'https://www.youtube.com/watch?v=aaa',
    subscriberCount: '45000',
    isShortsEligible: false,
    searchQuery: 'ai tools',
  },
  {
    channelId: 'UC_def',
    channelName: 'Claude Power Users',
    viewCount: 88000,
    title: 'Claude vs GPT-5 showdown',
    url: 'https://www.youtube.com/watch?v=bbb',
    subscriberCount: '12000',
    isShortsEligible: true,
    searchQuery: 'chatgpt tips',
  },
]

Deno.test('getApifyDatasetItems: GETs the datasets items endpoint with fields query', async () => {
  const { fetch, calls } = makeFetch({ body: SAMPLE_ITEMS })
  await getApifyDatasetItems(TOKEN, 'ds456', fetch)
  assertEquals(calls.length, 1)
  const url = new URL(calls[0].url)
  assertEquals(url.origin + url.pathname, 'https://api.apify.com/v2/datasets/ds456/items')
  assertEquals(url.searchParams.get('format'), 'json')
  assertEquals(
    url.searchParams.get('fields'),
    'channelId,channelName,viewCount,title,url,subscriberCount,isShortsEligible,searchQuery',
  )
  const headers = calls[0].init?.headers as Record<string, string>
  assertEquals(headers['Authorization'], `Bearer ${TOKEN}`)
})

Deno.test('getApifyDatasetItems: returns the parsed item array', async () => {
  const { fetch } = makeFetch({ body: SAMPLE_ITEMS })
  const result = await getApifyDatasetItems(TOKEN, 'ds456', fetch)
  assertEquals(result, SAMPLE_ITEMS)
})

Deno.test('getApifyDatasetItems: non-2xx response throws Error with status', async () => {
  const { fetch } = makeFetch({
    ok: false,
    status: 500,
    body: { error: { message: 'internal error' } },
  })
  const err = await assertRejects(
    () => getApifyDatasetItems(TOKEN, 'ds456', fetch),
    Error,
  )
  assertStringIncludes(err.message, '500')
})

Deno.test('getApifyDatasetItems: returns [] for an empty dataset', async () => {
  const { fetch } = makeFetch({ body: [] })
  const result = await getApifyDatasetItems(TOKEN, 'ds456', fetch)
  assertEquals(result, [])
})

Deno.test('getApifyDatasetItems: non-array 2xx body throws a clear Error', async () => {
  const { fetch } = makeFetch({ body: { data: null } })
  const err = await assertRejects(
    () => getApifyDatasetItems(TOKEN, 'ds456', fetch),
    Error,
  )
  assertStringIncludes(err.message, 'getApifyDatasetItems: expected array response')
})
