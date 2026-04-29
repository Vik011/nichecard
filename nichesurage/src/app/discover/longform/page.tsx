import { redirect } from 'next/navigation'

export default function LongformRedirect() {
  redirect('/discover?type=longform')
}
