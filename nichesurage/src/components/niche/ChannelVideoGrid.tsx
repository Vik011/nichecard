'use client'

import { useEffect, useState } from 'react'
import type { ChannelVideo } from '@/lib/types'
import type { CopyKeys } from '@/components/landing/copy'
import { formatViews, timeAgo } from '@/lib/format'

interface ChannelVideoGridProps {
  channelId: string
  copy: CopyKeys
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; videos: ChannelVideo[] }

const eyebrow = 'text-[10px] font-semibold tracking-[0.22em] uppercase text-glow-violet'

export function ChannelVideoGrid({ channelId, copy }: ChannelVideoGridProps) {
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
            setState({ kind: 'error', message: body?.error ?? `Request failed (${res.status})` })
          }
          return
        }
        const data = (await res.json()) as { videos: ChannelVideo[] }
        if (!cancelled) setState({ kind: 'ready', videos: data.videos ?? [] })
      } catch (err) {
        if (!cancelled) setState({ kind: 'error', message: (err as Error).message })
      }
    }
    run()
    return () => { cancelled = true }
  }, [channelId])

  return (
    <section className="glass rounded-2xl p-6 mb-6">
      <div className={eyebrow + ' mb-4'}>{copy.videosTitle}</div>

      {state.kind === 'loading' && <VideoGridSkeleton />}

      {state.kind === 'error' && (
        <div className="flex flex-col gap-3 items-start">
          <p className="text-red-400 text-sm">{copy.videosError}</p>
          <button
            type="button"
            onClick={() => setState({ kind: 'loading' })}
            className="text-[13px] font-semibold px-4 py-2 rounded-lg gborder bg-charcoal-800/60 text-slate-200 hover:bg-charcoal-700/60 transition-colors"
          >
            {copy.videosRetry}
          </button>
        </div>
      )}

      {state.kind === 'ready' && state.videos.length === 0 && (
        <p className="text-slate-500 text-sm py-6 text-center">{copy.videosEmpty}</p>
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
      <div className="aspect-video w-full rounded-lg overflow-hidden bg-charcoal-800">
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
      <div className="text-slate-200 text-sm font-medium line-clamp-2 mt-2 group-hover:text-violet-300 transition-colors">
        {video.title}
      </div>
      <div className="text-slate-500 text-xs mt-1 tabular-nums">
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
          <div className="aspect-video w-full rounded-lg bg-charcoal-800/60 animate-pulse" />
          <div className="h-3 w-3/4 bg-charcoal-800/60 rounded mt-2 animate-pulse" />
          <div className="h-3 w-1/2 bg-charcoal-800/60 rounded mt-1 animate-pulse" />
        </div>
      ))}
    </div>
  )
}
