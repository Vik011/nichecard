// supabase/functions/_shared/categories.test.ts
//
// Deno test runner (Jest ignores supabase/functions per jest.config.ts).
// Run locally: `deno test supabase/functions/_shared/categories.test.ts --allow-net=api.anthropic.com`
// (no real net hits — every test injects a fake fetch.)
import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  CATEGORIES,
  CATEGORY_DESCRIPTIONS,
  classifyChannelCategory,
  type FetchLike,
} from './categories.ts'

function makeFetch(response: {
  ok?: boolean
  status?: number
  body: unknown
}): FetchLike {
  return ((_input: string | URL | Request, _init?: RequestInit) => {
    return Promise.resolve({
      ok: response.ok ?? true,
      status: response.status ?? 200,
      json: () => Promise.resolve(response.body),
      text: () => Promise.resolve(JSON.stringify(response.body)),
    } as unknown as Response)
  }) as FetchLike
}

function anthropicResponse(text: string) {
  return { content: [{ text, type: 'text' }] }
}

Deno.test('CATEGORIES has all 12 canonical entries', () => {
  assertEquals(CATEGORIES.length, 12)
  // Spot-check a few that downstream code depends on.
  assertEquals(CATEGORIES.includes('ai_tools'), true)
  assertEquals(CATEGORIES.includes('education_howto'), true)
  assertEquals(CATEGORIES.includes('crypto'), true)
})

Deno.test('CATEGORY_DESCRIPTIONS covers every category', () => {
  for (const c of CATEGORIES) {
    assertEquals(typeof CATEGORY_DESCRIPTIONS[c], 'string')
    assertEquals(CATEGORY_DESCRIPTIONS[c].length > 0, true)
  }
})

Deno.test('classifyChannelCategory: happy path returns parsed category', async () => {
  const fakeFetch = makeFetch({
    body: anthropicResponse('{"category": "ai_tools"}'),
  })
  const result = await classifyChannelCategory(
    'AI Hustle Daily',
    'Make money with ChatGPT and Claude',
    ['I made $10k with ChatGPT', 'Claude vs GPT-5 showdown'],
    'sk-ant-fake',
    fakeFetch,
  )
  assertEquals(result, 'ai_tools')
})

Deno.test('classifyChannelCategory: bogus category falls back to education_howto', async () => {
  const fakeFetch = makeFetch({
    body: anthropicResponse('{"category": "underwater_basket_weaving"}'),
  })
  const result = await classifyChannelCategory(
    'Random Channel', '', [], 'sk-ant-fake', fakeFetch,
  )
  assertEquals(result, 'education_howto')
})

Deno.test('classifyChannelCategory: malformed JSON falls back to education_howto', async () => {
  const fakeFetch = makeFetch({
    body: anthropicResponse('this is not json {{{'),
  })
  const result = await classifyChannelCategory(
    'Random Channel', '', [], 'sk-ant-fake', fakeFetch,
  )
  assertEquals(result, 'education_howto')
})

Deno.test('classifyChannelCategory: empty Claude response falls back', async () => {
  const fakeFetch = makeFetch({
    body: { content: [] },
  })
  const result = await classifyChannelCategory(
    'Random Channel', '', [], 'sk-ant-fake', fakeFetch,
  )
  assertEquals(result, 'education_howto')
})

Deno.test('classifyChannelCategory: network error falls back to education_howto', async () => {
  const failingFetch: FetchLike = (() => {
    return Promise.reject(new Error('network down'))
  }) as FetchLike
  const result = await classifyChannelCategory(
    'Anything', '', [], 'sk-ant-fake', failingFetch,
  )
  assertEquals(result, 'education_howto')
})

Deno.test('classifyChannelCategory: non-2xx HTTP falls back to education_howto', async () => {
  const fakeFetch = makeFetch({
    ok: false,
    status: 500,
    body: { error: 'overloaded' },
  })
  const result = await classifyChannelCategory(
    'Anything', '', [], 'sk-ant-fake', fakeFetch,
  )
  assertEquals(result, 'education_howto')
})

Deno.test('classifyChannelCategory: empty channel data still returns valid CategoryEnum', async () => {
  const fakeFetch = makeFetch({
    body: anthropicResponse('{"category": "education_howto"}'),
  })
  const result = await classifyChannelCategory('', '', [], 'sk-ant-fake', fakeFetch)
  assertEquals((CATEGORIES as readonly string[]).includes(result), true)
})

Deno.test('classifyChannelCategory: tolerates JSON wrapped in prose / backticks', async () => {
  const fakeFetch = makeFetch({
    body: anthropicResponse('Sure! Here is the result:\n```json\n{"category": "crypto"}\n```'),
  })
  const result = await classifyChannelCategory(
    'Bitcoin Daily', '', ['BTC to 200k'], 'sk-ant-fake', fakeFetch,
  )
  assertEquals(result, 'crypto')
})

Deno.test('classifyChannelCategory: missing apiKey throws', async () => {
  await assertRejects(
    () => classifyChannelCategory('X', '', [], '', makeFetch({ body: {} })),
    Error,
    'apiKey is required',
  )
})
