import { redirect } from 'next/navigation'

// Legacy route kept for backwards-compatible bookmarks. The unified
// Discover surface no longer splits by content_type tab; both shorts
// and longform appear in the same grid with a per-card badge.
export default function ShortsRedirect() {
  redirect('/discover')
}
