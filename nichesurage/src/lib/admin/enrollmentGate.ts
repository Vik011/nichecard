import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Gate every authenticated admin page (except /admin/setup-totp itself) on
 * having an admin_totp_secrets row. Without TOTP the admin cannot pass the
 * sudo step-up, so destructive actions in Phase 1+ would silently fail. Make
 * the absence of enrollment loud — auto-redirect to /admin/setup-totp.
 *
 * Called AFTER requireAdmin(); takes the already-resolved admin email so we
 * don't double-resolve the auth user. Throws via next/navigation's redirect()
 * (which Next handles internally).
 */
export async function requireEnrollment(adminEmail: string): Promise<void> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('admin_totp_secrets')
    .select('admin_email')
    .eq('admin_email', adminEmail)
    .maybeSingle()
  if (!data) {
    redirect('/admin/setup-totp')
  }
}
