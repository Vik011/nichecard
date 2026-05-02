import type { CopyKeys } from '@/components/landing/copy'

interface ChannelVideoGridProps {
  channelId: string
  copy: CopyKeys
}

export function ChannelVideoGrid(_: ChannelVideoGridProps) {
  return <section data-testid="channel-video-grid" />
}
