import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('users')
          .upsert(
            { id: user.id, email: user.email ?? '', tier: 'free' },
            { onConflict: 'id', ignoreDuplicates: true }
          )
      }
      return NextResponse.redirect(`${origin}/discover`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
