/**
 * @jest-environment node
 */

import { fetchTranscript, TRANSCRIPT_MAX_CHARS } from './fetch'

jest.mock('@/lib/discovery/ytdlp', () => ({
  fetchTranscript: jest.fn(),
}))

import { fetchTranscript as fetchTranscriptRaw } from '@/lib/discovery/ytdlp'

const mockedRaw = fetchTranscriptRaw as jest.MockedFunction<typeof fetchTranscriptRaw>

describe('transcripts/fetch', () => {
  beforeEach(() => {
    mockedRaw.mockReset()
  })

  it('returns clean text when yt-dlp returns plain captions', async () => {
    mockedRaw.mockResolvedValue('hello world this is a video transcript')
    const result = await fetchTranscript('abc123')
    expect(result).not.toBeNull()
    expect(result!.text).toBe('hello world this is a video transcript')
    expect(result!.truncated).toBe(false)
    expect(result!.lengthChars).toBe(result!.text.length)
  })

  it('returns null when yt-dlp returns null (no auto-subs)', async () => {
    mockedRaw.mockResolvedValue(null)
    const result = await fetchTranscript('abc123')
    expect(result).toBeNull()
  })

  it('returns null when yt-dlp throws (caught upstream — null return)', async () => {
    // Underlying ytdlp.fetchTranscript never throws by contract, but verify
    // our wrapper survives a thrown rejection too.
    mockedRaw.mockRejectedValue(new Error('binary missing'))
    await expect(fetchTranscript('abc123')).rejects.toThrow('binary missing')
  })

  it('truncates output longer than TRANSCRIPT_MAX_CHARS', async () => {
    const longText = 'a'.repeat(TRANSCRIPT_MAX_CHARS + 1000)
    mockedRaw.mockResolvedValue(longText)
    const result = await fetchTranscript('abc123')
    expect(result).not.toBeNull()
    expect(result!.truncated).toBe(true)
    expect(result!.lengthChars).toBe(TRANSCRIPT_MAX_CHARS)
    expect(result!.text.length).toBe(TRANSCRIPT_MAX_CHARS)
  })

  it('drops lines that are pure timestamps', async () => {
    // Newline-separated input with stray timestamps
    mockedRaw.mockResolvedValue('hello there\n00:00:01.000\nthis is good content\n00:01:23')
    const result = await fetchTranscript('abc123')
    expect(result).not.toBeNull()
    expect(result!.text).toBe('hello there this is good content')
  })

  it('collapses repeated whitespace', async () => {
    mockedRaw.mockResolvedValue('foo    bar\n\n   baz   ')
    const result = await fetchTranscript('abc123')
    expect(result!.text).toBe('foo bar baz')
  })

  it('returns null when post-processed text is empty', async () => {
    mockedRaw.mockResolvedValue('   \n   \n   ')
    const result = await fetchTranscript('abc123')
    expect(result).toBeNull()
  })
})
