/**
 * THROWAWAY SPIKE — Sprint B Phase 0 feasibility test for yt-dlp on Vercel.
 *
 * Verifies that the `youtube-dl-exec` package (which ships its own yt-dlp binary)
 * can be invoked from a Next.js Node-runtime serverless function and successfully
 * extract a related-videos list from a YouTube video.
 *
 * IMPORTANT FINDING (spike result, Phase 0.1):
 * yt-dlp 2026.03.17 NO LONGER returns a `related_videos` field for plain
 * watch-page URLs (the field exists in older youtube-dl forks but was removed
 * in modern yt-dlp). The modern equivalent is to fetch the YouTube Mix playlist
 * for the video — URL pattern `watch?v=VID&list=RDVID` — with `--flat-playlist`
 * `--dump-json`. Each line is a related-video entry.
 *
 * NOTE on path: The folder is `spike` (NOT `_spike`). Next.js App Router treats
 * any folder prefixed with `_` as a private folder and excludes it from routing
 * — so `_spike/ytdlp` would 404. Renamed for routability.
 *
 * DELETE this route + the `spike` folder once Sprint B Phase 0 decision is made.
 */
import { NextResponse } from 'next/server'
import path from 'path'

export const runtime = 'nodejs'

// Tell youtube-dl-exec where the yt-dlp binary lives, BEFORE requiring it.
// The package's constants module reads YOUTUBE_DL_DIR up-front and otherwise
// derives the binary path from `__dirname` — which webpack rewrites to the
// `.next/server/...` chunk dir that does NOT contain the binary. Setting the
// env var sidesteps the rewrite and points at the real node_modules copy.
//
// Cleaner alternative for production: add 'youtube-dl-exec' to
// `experimental.serverComponentsExternalPackages` in next.config.mjs. The
// spike spec forbids touching that file, hence this in-route workaround.
process.env.YOUTUBE_DL_DIR =
  process.env.YOUTUBE_DL_DIR || path.join(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin')

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
const youtubedl = require('youtube-dl-exec') as (
  url: string,
  opts?: Record<string, unknown>,
) => Promise<unknown>
const ytdlPkg = require('youtube-dl-exec/package.json') as { version: string }
/* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
// Force dynamic — debug endpoint, never cache.
export const dynamic = 'force-dynamic'

const DEFAULT_VIDEO_ID = 'dQw4w9WgXcQ'
const TIMEOUT_MS = 25_000
const MAX_RELATED = 25 // cap output for spike

type RelatedItem = {
  id: string
  title?: string | null
  channel?: string | null
  channelId?: string | null
  durationSeconds?: number | null
}

type SpikeResponse = {
  ok: boolean
  videoId: string
  relatedCount: number
  durationMs: number
  version?: string
  related?: RelatedItem[]
  error?: string
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

/**
 * Run yt-dlp on the YouTube Mix playlist for `videoId`. Each playlist entry
 * is a related video. Uses `--flat-playlist` so we don't pull individual
 * video metadata (fast). Returns parsed entries.
 *
 * youtube-dl-exec's `flatPlaylist + dumpSingleJson` combo gives us a single
 * JSON object with `entries: [...]` instead of NDJSON.
 */
async function fetchRelated(videoId: string): Promise<unknown[]> {
  const mixUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&list=RD${encodeURIComponent(videoId)}`

  const result = await withTimeout(
    youtubedl(mixUrl, {
      skipDownload: true,
      dumpSingleJson: true,
      flatPlaylist: true,
      noWarnings: true,
      playlistEnd: MAX_RELATED,
    }),
    TIMEOUT_MS,
    'yt-dlp',
  )

  const info: { entries?: unknown[] } =
    typeof result === 'string' ? JSON.parse(result) : (result as { entries?: unknown[] })

  return Array.isArray(info?.entries) ? info.entries : []
}

function shapeEntry(raw: unknown): RelatedItem | null {
  if (!raw || typeof raw !== 'object') return null
  const e = raw as Record<string, unknown>
  const id = typeof e.id === 'string' ? e.id : null
  if (!id) return null
  return {
    id,
    title: typeof e.title === 'string' ? e.title : null,
    channel: typeof e.channel === 'string' ? e.channel : null,
    channelId: typeof e.channel_id === 'string' ? e.channel_id : null,
    durationSeconds: typeof e.duration === 'number' ? e.duration : null,
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const videoId = (url.searchParams.get('videoId') || DEFAULT_VIDEO_ID).trim()
  const startedAt = Date.now()

  const baseResp: SpikeResponse = {
    ok: false,
    videoId,
    relatedCount: 0,
    durationMs: 0,
    version: ytdlPkg.version,
  }

  try {
    if (!/^[A-Za-z0-9_-]{6,15}$/.test(videoId)) {
      throw new Error(`invalid videoId: ${videoId.slice(0, 32)}`)
    }

    const entries = await fetchRelated(videoId)
    const related = entries
      .map(shapeEntry)
      .filter((e): e is RelatedItem => e !== null)
      // Drop the seed video itself, which appears as entry 1 of the Mix.
      .filter((e) => e.id !== videoId)

    const resp: SpikeResponse = {
      ...baseResp,
      ok: true,
      relatedCount: related.length,
      durationMs: Date.now() - startedAt,
      related,
    }
    return NextResponse.json(resp)
  } catch (err) {
    // Build a richly-typed diagnostic. Vercel serverless surface differs from
    // local — `error.code` (ENOENT, EACCES, EPIPE) tells us *why* spawn failed,
    // which is the actual blocker when yt-dlp can't even start.
    const e = err as Record<string, unknown> | null
    const message = err instanceof Error ? err.message : String(err)
    const code = e && typeof e.code === 'string' ? e.code : null
    const errno = e && typeof e.errno === 'number' ? e.errno : null
    const syscall = e && typeof e.syscall === 'string' ? e.syscall : null
    const errPath = e && typeof e.path === 'string' ? e.path : null
    const stderr =
      e && typeof e.stderr === 'string' && e.stderr.length > 0 ? e.stderr.slice(0, 500) : null
    const stdout =
      e && typeof e.stdout === 'string' && e.stdout.length > 0 ? e.stdout.slice(0, 200) : null
    const resp: SpikeResponse & {
      diag?: {
        message: string
        code: string | null
        errno: number | null
        syscall: string | null
        path: string | null
        stderr: string | null
        stdout: string | null
        cwd: string
        ytdlDir: string | null
      }
    } = {
      ...baseResp,
      ok: false,
      durationMs: Date.now() - startedAt,
      error: message.slice(0, 200),
      diag: {
        message: message.slice(0, 500),
        code,
        errno,
        syscall,
        path: errPath,
        stderr,
        stdout,
        cwd: process.cwd(),
        ytdlDir: process.env.YOUTUBE_DL_DIR ?? null,
      },
    }
    return NextResponse.json(resp, { status: 200 }) // 200 — caller inspects `ok`
  }
}
