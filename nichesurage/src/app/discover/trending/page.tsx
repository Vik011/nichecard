import { redirect } from 'next/navigation'

// Sprint B's cluster-first surface (`/discover/trending`) is paused while
// the small-channel discovery loop stabilises. The trend_clusters table
// keeps populating via cron — when the universe grows past the point
// where cross-channel narrative clustering is meaningful (Phase 9 of the
// original plan), we'll surface it under a power-user route. For now,
// landing here forwards to the unified Discover.
export default function TrendingRedirect() {
  redirect('/discover')
}
