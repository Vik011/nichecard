// supabase/functions/_shared/labeling.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { buildNicheLabel } from './labeling.ts'

type FetchInput = Parameters<typeof fetch>[0]

function withMockedFetch(
  resolveBody: (url: string) => unknown | Error,
  fn: () => Promise<void>,
): () => Promise<void> {
  return async () => {
    const original = globalThis.fetch
    globalThis.fetch = ((input: FetchInput): Promise<Response> => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url
      const result = resolveBody(url)
      if (result instanceof Error) return Promise.reject(result)
      return Promise.resolve(
        new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }) as typeof fetch
    try {
      await fn()
    } finally {
      globalThis.fetch = original
    }
  }
}

Deno.test('buildNicheLabel: returns label from Anthropic response',
  withMockedFetch(
    () => ({ content: [{ text: 'AI prompt engineering' }] }),
    async () => {
      const label = await buildNicheLabel({
        apiKey: 'test',
        channelName: 'PromptCraft',
        recentTitles: ['How to write great prompts', 'GPT-4 prompt tips'],
        fallback: 'fallback-label',
      })
      assertEquals(label, 'ai prompt engineering')
    },
  ),
)

Deno.test('buildNicheLabel: trims whitespace from response',
  withMockedFetch(
    () => ({ content: [{ text: '  Body Recomp For Women   \n' }] }),
    async () => {
      const label = await buildNicheLabel({
        apiKey: 'test',
        channelName: 'FitJourney',
        recentTitles: ['Day 30 of body recomp'],
        fallback: 'fallback',
      })
      assertEquals(label, 'body recomp for women')
    },
  ),
)

Deno.test('buildNicheLabel: caps label at 40 chars',
  withMockedFetch(
    () => ({ content: [{ text: 'this is a very long label that exceeds forty characters easily' }] }),
    async () => {
      const label = await buildNicheLabel({
        apiKey: 'test',
        channelName: 'X',
        recentTitles: ['Y'],
        fallback: 'fallback',
      })
      assertEquals(label.length <= 40, true)
    },
  ),
)

Deno.test('buildNicheLabel: returns fallback on Anthropic 500',
  async () => {
    const original = globalThis.fetch
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response('upstream error', { status: 500 }),
      )) as typeof fetch
    try {
      const label = await buildNicheLabel({
        apiKey: 'test',
        channelName: 'X',
        recentTitles: ['Y'],
        fallback: 'side-hustle',
      })
      assertEquals(label, 'side-hustle')
    } finally {
      globalThis.fetch = original
    }
  },
)

Deno.test('buildNicheLabel: returns fallback on network error',
  withMockedFetch(
    () => new Error('network'),
    async () => {
      const label = await buildNicheLabel({
        apiKey: 'test',
        channelName: 'X',
        recentTitles: ['Y'],
        fallback: 'side-hustle',
      })
      assertEquals(label, 'side-hustle')
    },
  ),
)

Deno.test('buildNicheLabel: returns fallback on empty content',
  withMockedFetch(
    () => ({ content: [] }),
    async () => {
      const label = await buildNicheLabel({
        apiKey: 'test',
        channelName: 'X',
        recentTitles: ['Y'],
        fallback: 'fallback',
      })
      assertEquals(label, 'fallback')
    },
  ),
)

Deno.test('buildNicheLabel: returns fallback when no titles given',
  async () => {
    const label = await buildNicheLabel({
      apiKey: 'test',
      channelName: 'X',
      recentTitles: [],
      fallback: 'no-titles',
    })
    assertEquals(label, 'no-titles')
  },
)
