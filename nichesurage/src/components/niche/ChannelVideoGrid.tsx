'use client'

import { useEffect, useState } from 'react'
import type { ChannelVideo } from '@/lib/types'
import type { CopyKeys } from '@/components/landing/copy'
import { formatViews, timeAgo } from '@/lib/format'
import { EmptyMagnifier } from '@/components/ui/illustrations/EmptyMagnifier'

interface ChannelVideoGridProps {
  channelId: string
  copy: CopyKeys
  // PR 4.1: when true, a failed/non-OK fetch renders the neutral empty state
  // instead of the red error + "Try again". Used on catalog-only detail, where
  // channels are always uncached so the live-fetch path commonly fails on
  // tier/quota/rate limits — we never want a red error on every catalog card.
  // Default false keeps outlier-detail behavior byte-for-byte unchanged.
  gracefulFailure?: boolean
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  // PR 4.2: graceful-failure degrade state. Distinct from `ready` with an
  // empty list so we can render an honest "unavailable right now" message
  // instead of "no recent videos" — a genuine 200-with-zero-videos still
  // resolves to `ready` and keeps showing copy.videosEmpty.
  | { kind: 'unavailable' }
  | { kind: 'ready'; videos: ChannelVideo[] }

const eyebrow = 'text-[10px] font-semibold tracking-[0.22em] uppercase text-accent-emerald-bright'

export function ChannelVideoGrid({ channelId, copy, gracefulFailure = false }: ChannelVideoGridProps) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    async function run() {
      setState({ kind: 'loading' })
      try {
        const res = await fetch(`/api/channel-videos/${encodeURIComponent(channelId)}`)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          if (!cancelled) {
            // gracefulFailure: degrade to the neutral "unavailable" state (no red error).
            setState(
              gracefulFailure
                ? { kind: 'unavailable' }
                : { kind: 'error', message: body?.error ?? `Request failed (${res.status})` },
            )
          }
          return
        }
        const data = (await res.json()) as { videos: ChannelVideo[] }
        if (!cancelled) setState({ kind: 'ready', videos: data.videos ?? [] })
      } catch (err) {
        if (!cancelled) {
          setState(
            gracefulFailure
              ? { kind: 'unavailable' }
              : { kind: 'error', message: (err as Error).message },
          )
        }
      }
    }
    run()
    return () => { cancelled = true }
  }, [channelId, gracefulFailure])

  return (
    <section className="glass rounded-2xl p-6 mb-6">
      <div className={eyebrow + ' mb-4'}>{copy.videosTitle}</div>

      {state.kind === 'loading' && <VideoGridSkeleton />}

      {state.kind === 'error' && (
        <div className="flex flex-col gap-3 items-center text-center py-8">
          <p className="text-red-400 text-sm">{copy.videosError}</p>
          <button
            type="button"
            onClick={() => setState({ kind: 'loading' })}
            className="text-[13px] font-semibold px-4 py-2 rounded-lg gborder bg-surface-elevated/60 text-ink hover:bg-surface-overlay/60 transition-colors"
          >
            {copy.videosRetry}
          </button>
        </div>
      )}

      {state.kind === 'unavailable' && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <EmptyMagnifier size={64} />
          <p className="text-ink-subtle text-sm">{copy.videosUnavailable}</p>
        </div>
      )}

      {state.kind === 'ready' && state.videos.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <EmptyMagnifier size={64} />
          <p className="text-ink-subtle text-sm">{copy.videosEmpty}</p>
        </div>
      )}

      {state.kind === 'ready' && state.videos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {state.videos.map(video => (
            <VideoTile key={video.id} video={video} copy={copy} />
          ))}
        </div>
      )}
    </section>
  )
}

function VideoTile({ video, copy }: { video: ChannelVideo; copy: CopyKeys }) {
  return (
    <a
      href={`https://www.youtube.com/watch?v=${video.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="block group"
    >
      <div className="aspect-video w-full rounded-lg overflow-hidden bg-surface-elevated">
        {video.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnail}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        )}
      </div>
      <div className="text-ink text-sm font-medium line-clamp-2 mt-2">
        {video.title}
      </div>
      <div className="text-ink-subtle text-xs mt-1 tabular-nums">
        {formatViews(video.viewCount)} {copy.videosViewsLabel} · {timeAgo(video.publishedAt)}
      </div>
    </a>
  )
}

function VideoGridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i}>
          <div className="aspect-video w-full rounded-lg shimmer" />
          <div className="h-3 w-3/4 shimmer rounded mt-2" />
          <div className="h-3 w-1/2 shimmer rounded mt-1" />
        </div>
      ))}
    </div>
  )
}
