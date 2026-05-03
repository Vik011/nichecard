/**
 * THROWAWAY SPIKE — Sprint B Phase 0 feasibility test for yt-dlp on Vercel.
 *
 * Verifies that the `yt-dlp-wrap` package (which downloads the standalone
 * yt-dlp binary from GitHub releases) can be invoked from a Next.js
 * Node-runtime serverless function and successfully extract a related-videos
 * list from a YouTube video.
 *
 * Iteration history:
 *   1. youtube-dl-exec → spawn faila instantly (binary not bundled)
 *   2. + experimental.serverComponentsExternalPackages → binary reachable,
 *      but ships as Python script needing python3 (Vercel has none)
 *   3. switched to yt-dlp-wrap → downloads PyInstaller-packaged Linux
 *      standalone binary to /tmp on first invocation, no python needed
 *
 * IMPORTANT FINDING (carried from previous iterations):
 * yt-dlp 2026.x NO LONGER returns a `related_videos` field for plain
 * watch-page URLs. The modern equivalent is to fetch the YouTube Mix
 * playlist for the video — URL pattern `watch?v=VID&list=RDVID` — with
 * `--flat-playlist --dump-single-json`. Each entry IS a related video.
 *
 * NOTE on path: The folder is `spike` (NOT `_spike`). Next.js App Router
 * treats any folder prefixed with `_` as a private folder.
 *
 * DELETE this route + the `spike` folder once Sprint B Phase 0 decision is
 * made.
 */
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Vercel Pro plan default is 60s; we need ~10s for binary download on cold
// start + up to 25s for yt-dlp invocation.
export const maxDuration = 60

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
// yt-dlp-wrap is CJS-style. Require to avoid ESM/CJS interop pain in Next.
const YTDlpWrapModule = require('yt-dlp-wrap')
const YTDlpWrap = YTDlpWrapModule.default || YTDlpWrapModule
const ytdlpWrapPkg = require('yt-dlp-wrap/package.json') as { version: string }
/* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */

const DEFAULT_VIDEO_ID = 'dQw4w9WgXcQ'
const TIMEOUT_MS = 25_000
const MAX_RELATED = 25
// /tmp is the only writable filesystem on Vercel (~512MB). Persists across
// warm invocations on the same container instance.
const BIN_PATH = '/tmp/yt-dlp'

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
  binaryDownloaded?: boolean
  related?: RelatedItem[]
  error?: string
  diag?: {
    message: string
    code: string | null
    errno: number | null
    syscall: string | null
    path: string | null
    stderr: string | null
    stdout: string | null
    cwd: string
    binPath: string
    binExists: boolean
  }
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

let downloadPromise: Promise<void> | null = null
async function ensureBinary(): Promise<{ downloaded: boolean }> {
  if (fs.existsSync(BIN_PATH)) {
    // Verify it has size > 0 (a half-finished download from a prior crash
    // would leave a 0-byte file).
    const stat = fs.statSync(BIN_PATH)
    if (stat.size > 100_000) {
      return { downloaded: false }
    }
    fs.unlinkSync(BIN_PATH)
  }
  // Coalesce concurrent invocations on the same warm container.
  if (!downloadPromise) {
    downloadPromise = withTimeout(
      YTDlpWrap.downloadFromGithub(BIN_PATH),
      40_000,
      'yt-dlp binary download',
    ).then(() => {
      // downloadFromGithub already chmods +x but be defensive.
      try {
        fs.chmodSync(BIN_PATH, 0o755)
      } catch {
        /* ignore */
      }
    })
  }
  await downloadPromise
  return { downloaded: true }
}

async function fetchRelated(videoId: string): Promise<unknown[]> {
  const mixUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&list=RD${encodeURIComponent(videoId)}`
  const wrap = new YTDlpWrap(BIN_PATH)
  const stdout: string = await withTimeout(
    wrap.execPromise([
      mixUrl,
      '--skip-download',
      '--dump-single-json',
      '--flat-playlist',
      '--no-warnings',
      '--playlist-end',
      String(MAX_RELATED),
    ]),
    TIMEOUT_MS,
    'yt-dlp',
  )
  const info: { entries?: unknown[] } = JSON.parse(stdout)
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
    version: ytdlpWrapPkg.version,
  }

  try {
    if (!/^[A-Za-z0-9_-]{6,15}$/.test(videoId)) {
      throw new Error(`invalid videoId: ${videoId.slice(0, 32)}`)
    }

    const { downloaded } = await ensureBinary()
    const entries = await fetchRelated(videoId)
    const related = entries
      .map(shapeEntry)
      .filter((e): e is RelatedItem => e !== null)
      // Drop the seed video itself, which appears as entry 1 of the Mix.
      .filter((e) => e.id !== videoId)

    return NextResponse.json({
      ...baseResp,
      ok: true,
      relatedCount: related.length,
      durationMs: Date.now() - startedAt,
      binaryDownloaded: downloaded,
      related,
    } satisfies SpikeResponse)
  } catch (err) {
    const e = err as Record<string, unknown> | null
    const message = err instanceof Error ? err.message : String(err)
    const code = e && typeof e.code === 'string' ? e.code : null
    const errno = e && typeof e.errno === 'number' ? e.errno : null
    const syscall = e && typeof e.syscall === 'string' ? e.syscall : null
    const errPath = e && typeof e.path === 'string' ? e.path : null
    const stderr =
      e && typeof e.stderr === 'string' && e.stderr.length > 0
        ? e.stderr.slice(0, 500)
        : null
    const stdout =
      e && typeof e.stdout === 'string' && e.stdout.length > 0
        ? e.stdout.slice(0, 200)
        : null
    return NextResponse.json(
      {
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
          binPath: BIN_PATH,
          binExists: fs.existsSync(BIN_PATH),
        },
      } satisfies SpikeResponse,
      { status: 200 },
    )
  }
}
