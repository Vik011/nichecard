/**
 * Transcript fetcher: thin wrapper over the yt-dlp primitive that adds
 * post-processing tailored for embedding generation. Strips duplicate
 * whitespace, drops timestamp-only lines, and truncates to 8000 chars
 * (text-embedding-3-small input limit, with safety margin).
 */

import { fetchTranscript as fetchTranscriptRaw } from '@/lib/discovery/ytdlp'

export const TRANSCRIPT_MAX_CHARS = 8000

export interface TranscriptResult {
  text: string
  lengthChars: number
  truncated: boolean
}

// Lines that are JUST a timestamp (HH:MM:SS or MM:SS or with milliseconds).
// We've already stripped VTT cue headers in ytdlp.ts; this is defense-in-depth
// for any lingering numeric-time tokens that survived.
const TIMESTAMP_ONLY = /^(\d{1,2}:)?\d{1,2}:\d{1,2}(\.\d+)?$/

function postProcess(raw: string): string {
  // Split on whitespace to look at "lines"; the source is already a single
  // joined line from vttToPlainText, but a custom upstream might pass actual
  // newlines, so be defensive.
  const tokens = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => !TIMESTAMP_ONLY.test(l))
  // Collapse internal whitespace runs
  return tokens.join(' ').replace(/\s+/g, ' ').trim()
}

/**
 * Fetch transcript for a video. Returns null if no auto-subs available
 * or yt-dlp itself failed (the underlying primitive is no-throw).
 */
export async function fetchTranscript(videoId: string): Promise<TranscriptResult | null> {
  const raw = await fetchTranscriptRaw(videoId)
  if (raw == null) return null
  const cleaned = postProcess(raw)
  if (cleaned.length === 0) return null

  const truncated = cleaned.length > TRANSCRIPT_MAX_CHARS
  const text = truncated ? cleaned.slice(0, TRANSCRIPT_MAX_CHARS) : cleaned
  return {
    text,
    lengthChars: text.length,
    truncated,
  }
}
