import { redirect } from 'next/navigation'

export default function ShortsRedirect() {
  redirect('/discover?type=shorts')
}
