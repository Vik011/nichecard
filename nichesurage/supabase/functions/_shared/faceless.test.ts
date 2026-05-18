// supabase/functions/_shared/faceless.test.ts
//
// Deno test runner (Jest ignores supabase/functions per jest.config.ts).
// Run locally: `deno test supabase/functions/_shared/faceless.test.ts`
// (no real net hits - every test injects a fake fetch.)
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { classifyFaceless, type FetchLike } from './faceless.ts'

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

function anthropicResponse(text: string) {
  return { content: [{ text, type: 'text' }] }
}

const API_KEY = 'sk-ant-fake'
const TITLES = ['Top 10 AI tools of 2026', 'How ChatGPT actually works']

Deno.test('classifyFaceless: faceless verdict reply -> faceless', async () => {
  const { fetch } = makeFetch({ body: anthropicResponse('{"verdict": "faceless"}') })
  const result = await classifyFaceless('AI Tool Vault', TITLES, API_KEY, fetch)
  assertEquals(result, 'faceless')
})

Deno.test('classifyFaceless: face verdict reply -> face', async () => {
  const { fetch } = makeFetch({ body: anthropicResponse('{"verdict": "face"}') })
  const result = await classifyFaceless('Marques Brownlee', TITLES, API_KEY, fetch)
  assertEquals(result, 'face')
})

Deno.test('classifyFaceless: uncertain verdict reply -> uncertain', async () => {
  const { fetch } = makeFetch({ body: anthropicResponse('{"verdict": "uncertain"}') })
  const result = await classifyFaceless('Some Channel', TITLES, API_KEY, fetch)
  assertEquals(result, 'uncertain')
})

Deno.test('classifyFaceless: tolerates JSON wrapped in prose / backticks', async () => {
  const { fetch } = makeFetch({
    body: anthropicResponse('Sure!\n```json\n{"verdict": "faceless"}\n```'),
  })
  const result = await classifyFaceless('Compilation Central', TITLES, API_KEY, fetch)
  assertEquals(result, 'faceless')
})

Deno.test('classifyFaceless: malformed / non-JSON reply -> uncertain', async () => {
  const { fetch } = makeFetch({ body: anthropicResponse('this is not json {{{') })
  const result = await classifyFaceless('Random Channel', TITLES, API_KEY, fetch)
  assertEquals(result, 'uncertain')
})

Deno.test('classifyFaceless: unknown verdict value -> uncertain', async () => {
  const { fetch } = makeFetch({ body: anthropicResponse('{"verdict": "robot"}') })
  const result = await classifyFaceless('Random Channel', TITLES, API_KEY, fetch)
  assertEquals(result, 'uncertain')
})

Deno.test('classifyFaceless: empty Claude response -> uncertain', async () => {
  const { fetch } = makeFetch({ body: { content: [] } })
  const result = await classifyFaceless('Random Channel', TITLES, API_KEY, fetch)
  assertEquals(result, 'uncertain')
})

Deno.test('classifyFaceless: non-2xx HTTP response -> uncertain', async () => {
  const { fetch } = makeFetch({ ok: false, status: 500, body: { error: 'overloaded' } })
  const result = await classifyFaceless('Random Channel', TITLES, API_KEY, fetch)
  assertEquals(result, 'uncertain')
})

Deno.test('classifyFaceless: network error / rejected fetch -> uncertain', async () => {
  const failingFetch: FetchLike = (() => {
    return Promise.reject(new Error('network down'))
  }) as FetchLike
  const result = await classifyFaceless('Random Channel', TITLES, API_KEY, failingFetch)
  assertEquals(result, 'uncertain')
})

Deno.test('classifyFaceless: missing apiKey -> uncertain without calling fetch', async () => {
  const { fetch, calls } = makeFetch({ body: anthropicResponse('{"verdict": "faceless"}') })
  const result = await classifyFaceless('Random Channel', TITLES, '', fetch)
  assertEquals(result, 'uncertain')
  assertEquals(calls.length, 0)
})

Deno.test('classifyFaceless: request hits the Anthropic endpoint with the api key', async () => {
  const { fetch, calls } = makeFetch({ body: anthropicResponse('{"verdict": "faceless"}') })
  await classifyFaceless('AI Tool Vault', TITLES, API_KEY, fetch)
  assertEquals(calls.length, 1)
  assertEquals(calls[0].url, 'https://api.anthropic.com/v1/messages')
  const headers = calls[0].init?.headers as Record<string, string>
  assertEquals(headers['x-api-key'], API_KEY)
  assertEquals(calls[0].init?.method, 'POST')
})
