/**
 * yt-dlp wrapper for Vercel/Node runtime.
 *
 * Phase 0 verdict (CLAUDE.md): the only reliable way to run yt-dlp on Vercel
 * is the standalone PyInstaller-packaged Linux binary fetched from GitHub
 * releases at runtime. We download once per cold start to /tmp, chmod +x,
 * then invoke via child_process.spawn directly. No npm wrappers — every
 * one we tried (`youtube-dl-exec`, `yt-dlp-wrap`) ships a Python script and
 * Vercel's Node runtime has no python3.
 *
 * This module exposes:
 *   - ensureYtDlpBinary()    — idempotent, coalesced cold-start download
 *   - fetchRelatedVideos()   — Mix-playlist trick for related videos
 *   - fetchTranscript()      — auto-subs as plain text (English only)
 */

import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

// Pin to a known-good release. Don't use 'latest' — reproducibility + we
// want to control upgrades because YouTube extractors break occasionally.
export const YT_DLP_VERSION = '2025.10.22'
const RELEASE_URL = `https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VERSION}/yt-dlp_linux`
const BIN_PATH = '/tmp/yt-dlp'
const DEFAULT_TIMEOUT_MS = 25_000

export interface RelatedItem {
  id: string
  title: string | null
  channel: string | null
  channelId: string | null
  durationSeconds: number | null
}

// Shared promise so concurrent invocations on the same warm container
// only download once. Reset to null on failure so the next call retries.
let downloadPromise: Promise<void> | null = null

/** Idempotent. Cold start: ~3-5s. Warm: returns instantly. */
export async function ensureYtDlpBinary(): Promise<void> {
  // Already downloaded and looks valid?
  try {
    if (fs.existsSync(BIN_PATH) && fs.statSync(BIN_PATH).size > 1_000_000) {
      return
    }
  } catch {
    // fall through to download
  }

  if (!downloadPromise) {
    downloadPromise = (async () => {
      const res = await fetch(RELEASE_URL)
      if (!res.ok) {
        throw new Error(`yt-dlp download failed: ${res.status} ${res.statusText}`)
      }
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.byteLength < 1_000_000) {
        throw new Error(`yt-dlp download too small: ${buf.byteLength} bytes`)
      }
      fs.writeFileSync(BIN_PATH, buf)
      fs.chmodSync(BIN_PATH, 0o755)
    })().catch((err) => {
      // Clear so the next caller retries
      downloadPromise = null
      throw err
    })
  }

  await downloadPromise
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`))
    }, ms)
    promise.then(
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
 * Run yt-dlp with the given args; returns stdout as a string.
 * Throws on non-zero exit, timeout, or spawn error.
 */
async function runYtDlp(args: string[], timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<string> {
  await ensureYtDlpBinary()

  const exec = new Promise<string>((resolve, reject) => {
    const child = spawn(BIN_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => {
      stdout += d.toString()
    })
    child.stderr.on('data', (d) => {
      stderr += d.toString()
    })
    child.on('error', (err) => reject(err))
    child.on('close', (code) => {
      if (code === 0) resolve(stdout)
      else reject(new Error(`yt-dlp exited ${code}: ${stderr.slice(0, 500)}`))
    })
  })

  return withTimeout(exec, timeoutMs, 'yt-dlp')
}

interface FlatPlaylistEntry {
  id?: string
  title?: string | null
  channel?: string | null
  channel_id?: string | null
  uploader?: string | null
  uploader_id?: string | null
  duration?: number | null
}

interface FlatPlaylistJson {
  entries?: FlatPlaylistEntry[]
}

/**
 * Fetch related videos via the YouTube Mix playlist trick (Phase 0 finding).
 * URL pattern: watch?v=VID&list=RDVID. Some videos (very old, niche,
 * age-restricted) have no Mix and return [] — handle gracefully.
 *
 * Never throws. Returns [] on any error after logging to console.error.
 */
export async function fetchRelatedVideos(
  videoId: string,
  max: number = 25,
): Promise<RelatedItem[]> {
  const url = `https://www.youtube.com/watch?v=${videoId}&list=RD${videoId}`
  try {
    const stdout = await runYtDlp([
      url,
      '--flat-playlist',
      '--dump-single-json',
      '--no-warnings',
      '--playlist-end',
      String(max),
    ])
    const json = JSON.parse(stdout) as FlatPlaylistJson
    const entries = Array.isArray(json.entries) ? json.entries : []
    const items: RelatedItem[] = []
    for (const e of entries) {
      if (!e?.id) continue
      // Skip the seed itself
      if (e.id === videoId) continue
      items.push({
        id: e.id,
        title: e.title ?? null,
        channel: e.channel ?? e.uploader ?? null,
        channelId: e.channel_id ?? e.uploader_id ?? null,
        durationSeconds: typeof e.duration === 'number' ? e.duration : null,
      })
      if (items.length >= max) break
    }
    return items
  } catch (err) {
    console.error('[ytdlp] fetchRelatedVideos failed', videoId, err)
    return []
  }
}

/**
 * Strip a VTT file's headers/timestamps/markers and return concatenated plain text.
 * Auto-subs come back with a lot of noise: WEBVTT header, NOTE blocks, cue
 * timings, position/align directives, repeated cues from auto-caption rolling
 * window. We collapse to unique non-timestamp lines preserving order.
 */
function vttToPlainText(vtt: string): string {
  const lines = vtt.split(/\r?\n/)
  const out: string[] = []
  const seen = new Set<string>()
  const cueTiming = /-->/
  // VTT cue header (number / id) is usually a numeric line; ignore it
  const numericLine = /^\d+$/
  // Bracketed sound effects: [Music], [Applause], [Laughter], etc.
  const bracketMarker = /\[[^\]]*\]/g

  for (const raw of lines) {
    let line = raw.trim()
    if (!line) continue
    if (line === 'WEBVTT') continue
    if (line.startsWith('NOTE')) continue
    if (line.startsWith('Kind:') || line.startsWith('Language:')) continue
    if (cueTiming.test(line)) continue
    if (numericLine.test(line)) continue
    // Strip inline VTT tags like <c>...</c>, <00:00:01.000> timestamps, and
    // bracketed sound markers
    line = line.replace(/<[^>]+>/g, '').replace(bracketMarker, '').trim()
    if (!line) continue
    // Auto-subs frequently repeat the same line in overlapping cues; dedupe
    if (seen.has(line)) continue
    seen.add(line)
    out.push(line)
  }
  return out.join(' ').replace(/\s+/g, ' ').trim()
}

/**
 * Fetch auto-generated captions and return concatenated plain text.
 * Returns null if no auto-subs available (live videos, captions disabled,
 * paid content, region-locked, etc.). Never throws.
 */
export async function fetchTranscript(videoId: string): Promise<string | null> {
  const url = `https://www.youtube.com/watch?v=${videoId}`
  // yt-dlp output template: write subs to /tmp/<videoId>.<lang>.<ext>
  const outTemplate = path.join('/tmp', `${videoId}.%(ext)s`)
  // The actual filename yt-dlp produces for English auto-subs in vtt format:
  const expectedVtt = path.join('/tmp', `${videoId}.en.vtt`)

  try {
    await runYtDlp([
      url,
      '--skip-download',
      '--write-auto-subs',
      '--sub-format',
      'vtt',
      '--sub-langs',
      'en',
      '--no-warnings',
      '-o',
      outTemplate,
    ])

    if (!fs.existsSync(expectedVtt)) {
      return null
    }
    const vtt = fs.readFileSync(expectedVtt, 'utf-8')
    // Cleanup the temp file regardless of parse result
    try {
      fs.unlinkSync(expectedVtt)
    } catch {
      /* ignore */
    }
    const text = vttToPlainText(vtt)
    return text.length > 0 ? text : null
  } catch (err) {
    // Most common failure: video has no auto-captions. yt-dlp exits 0 but
    // the file is just not written. If we landed here it's a real error
    // (network, binary missing, etc.) — log and return null.
    console.error('[ytdlp] fetchTranscript failed', videoId, err)
    // Best-effort cleanup if a partial file was written
    try {
      if (fs.existsSync(expectedVtt)) fs.unlinkSync(expectedVtt)
    } catch {
      /* ignore */
    }
    return null
  }
}

// Exported for unit tests
export const __test__ = { vttToPlainText, BIN_PATH, RELEASE_URL }
