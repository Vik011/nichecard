import { redirect } from 'next/navigation'

// Legacy route kept for backwards-compatible bookmarks. The unified
// Discover surface no longer splits by content_type tab.
export default function LongformRedirect() {
  redirect('/discover')
}
