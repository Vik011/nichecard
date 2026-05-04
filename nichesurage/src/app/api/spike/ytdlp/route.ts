/**
 * THROWAWAY SPIKE — Sprint B Phase 0 feasibility test for yt-dlp on Vercel.
 *
 * Verifies that the yt-dlp standalone Linux binary (PyInstaller-packaged,
 * NO python dependency) can be downloaded and invoked from a Next.js
 * Node-runtime serverless function on Vercel.
 *
 * Iteration history:
 *   1. youtube-dl-exec → spawn faila (binary not bundled)
 *   2. + experimental.serverComponentsExternalPackages → binary reachable,
 *      but ships as Python script needing python3 (Vercel has none)
 *   3. yt-dlp-wrap → deprecated package, downloads SOURCE distribution
 *      (also Python script). Same python3 missing error.
 *   4. THIS: native fetch + child_process.spawn. Explicit URL pulls the
 *      yt-dlp_linux PyInstaller standalone binary, no wrapper, no python.
 *
 * IMPORTANT FINDING (carried from previous iterations):
 * yt-dlp 2026.x NO LONGER returns a `related_videos` field for plain
 * watch-page URLs. Modern equivalent is YouTube Mix playlist URL pattern
 * `watch?v=VID&list=RDVID` with `--flat-playlist --dump-single-json`.
 *
 * NOTE on path: The folder is `spike` (NOT `_spike`). Next.js App Router
 * treats any folder prefixed with `_` as a private folder.
 *
 * DELETE this route + the `spike` folder once Sprint B Phase 0 decision is
 * made.
 */
import { NextResponse } from 'next/server'
import fs from 'fs'
import { spawn } from 'child_process'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Cold start: ~10-15s download from GitHub + 5-10s yt-dlp run + headroom.
export const maxDuration = 60

// Pin a specific release for reproducibility. Update in production.
const YT_DLP_VERSION = '2025.10.22'
const RELEASE_URL = `https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VERSION}/yt-dlp_linux`
// /tmp is the only writable filesystem on Vercel (~512MB). Persists across
// warm invocations on the same container instance.
const BIN_PATH = '/tmp/yt-dlp'

const DEFAULT_VIDEO_ID = 'dQw4w9WgXcQ'
const TIMEOUT_MS = 30_000
const DOWNLOAD_TIMEOUT_MS = 30_000
const MAX_RELATED = 25

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
  binaryDownloaded?: boolean
  binaryBytes?: number
  ytDlpVersion?: string
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
    binSize: number | null
    targetVersion: string
  }
}

let downloadPromise: Promise<{ downloaded: boolean; size: number }> | null = null

async function ensureBinary(): Promise<{ downloaded: boolean; size: number }> {
  // Already-downloaded path. Defensive: require non-trivial size (a half-
  // finished download from a prior crash leaves a small or zero file).
  if (fs.existsSync(BIN_PATH)) {
    const stat = fs.statSync(BIN_PATH)
    if (stat.size > 1_000_000) {
      return { downloaded: false, size: stat.size }
    }
    fs.unlinkSync(BIN_PATH)
  }
  if (!downloadPromise) {
    downloadPromise = (async () => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS)
      try {
        const res = await fetch(RELEASE_URL, { signal: controller.signal })
        if (!res.ok) {
          throw new Error(`GitHub release fetch failed: ${res.status} ${res.statusText}`)
        }
        const buf = Buffer.from(await res.arrayBuffer())
        fs.writeFileSync(BIN_PATH, buf)
        fs.chmodSync(BIN_PATH, 0o755)
        return { downloaded: true, size: buf.byteLength }
      } finally {
        clearTimeout(timer)
      }
    })()
  }
  return downloadPromise
}

function runYtDlp(args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(BIN_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      const e = new Error(`yt-dlp timed out after ${timeoutMs}ms`)
      ;(e as Error & { stderr?: string; stdout?: string }).stderr = stderr.slice(0, 500)
      ;(e as Error & { stderr?: string; stdout?: string }).stdout = stdout.slice(0, 200)
      reject(e)
    }, timeoutMs)
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      ;(err as Error & { stderr?: string }).stderr = stderr.slice(0, 500)
      reject(err)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) {
        resolve(stdout)
      } else {
        const e = new Error(`yt-dlp exited with code ${code}`)
        ;(e as Error & { stderr?: string; stdout?: string; code?: number | null }).stderr = stderr.slice(0, 500)
        ;(e as Error & { stderr?: string; stdout?: string; code?: number | null }).stdout = stdout.slice(0, 200)
        reject(e)
      }
    })
  })
}

async function getYtDlpVersion(): Promise<string | null> {
  try {
    const out = await runYtDlp(['--version'], 5_000)
    return out.trim().slice(0, 64)
  } catch {
    return null
  }
}

async function fetchRelated(videoId: string): Promise<unknown[]> {
  const mixUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&list=RD${encodeURIComponent(videoId)}`
  const stdout = await runYtDlp(
    [
      mixUrl,
      '--skip-download',
      '--dump-single-json',
      '--flat-playlist',
      '--no-warnings',
      '--playlist-end',
      String(MAX_RELATED),
    ],
    TIMEOUT_MS,
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
  }

  try {
    if (!/^[A-Za-z0-9_-]{6,15}$/.test(videoId)) {
      throw new Error(`invalid videoId: ${videoId.slice(0, 32)}`)
    }

    const { downloaded, size } = await ensureBinary()
    const ytDlpVersion = await getYtDlpVersion()
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
      binaryBytes: size,
      ytDlpVersion: ytDlpVersion ?? undefined,
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
    let binSize: number | null = null
    try {
      if (fs.existsSync(BIN_PATH)) binSize = fs.statSync(BIN_PATH).size
    } catch {
      /* ignore */
    }
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
          binSize,
          targetVersion: YT_DLP_VERSION,
        },
      } satisfies SpikeResponse,
      { status: 200 },
    )
  }
}
