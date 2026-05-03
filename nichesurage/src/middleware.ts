import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/signup')
  // Auth-only routes. /discover is included by rule: anonymous visitors
  // should land on the marketing page (and the Try Free CTA), not on a
  // half-rendered app shell with blurred premium teasers. Keeping nav and
  // session state consistent depends on this — the TopNav, paywall CTAs,
  // and tier badges all assume a logged-in user is present.
  const protectedPrefixes = ['/dashboard', '/discover']
  const isProtectedRoute = protectedPrefixes.some(p => request.nextUrl.pathname.startsWith(p))

  if (!user && isProtectedRoute) {
    const loginUrl = new URL('/login', request.url)
    // Preserve the destination so we can return the user there post-auth.
    const dest = request.nextUrl.pathname + request.nextUrl.search
    if (dest && dest !== '/') {
      loginUrl.searchParams.set('next', dest)
    }
    return NextResponse.redirect(loginUrl)
  }

  if (user && isAuthRoute) {
    const plan = request.nextUrl.searchParams.get('plan')
    const billing = request.nextUrl.searchParams.get('billing')
    const hasCheckoutIntent =
      (plan === 'basic' || plan === 'premium') &&
      (billing === 'monthly' || billing === 'yearly')
    if (!hasCheckoutIntent) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
