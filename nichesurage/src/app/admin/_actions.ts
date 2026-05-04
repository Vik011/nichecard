'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/admin/auth'

/**
 * Approve a pending narrative archetype: status = 'canonical',
 * promoted_at = now(). Idempotent — only updates rows that are still in
 * 'candidate' status, so a double-click is harmless.
 *
 * Re-asserts admin auth (defense in depth — Server Actions can be called
 * from the client without going through the page render).
 */
export async function approveArchetype(id: string): Promise<void> {
  await requireAdmin()
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('narrative_archetypes')
    .update({ status: 'canonical', promoted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'candidate')
  if (error) {
    console.error('[admin/_actions] approveArchetype:', error)
    throw new Error('approve failed')
  }
  revalidatePath('/admin')
}

/**
 * Reject a pending narrative archetype: status = 'rejected'. Idempotent
 * — only flips rows currently in 'candidate' status.
 */
export async function rejectArchetype(id: string): Promise<void> {
  await requireAdmin()
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('narrative_archetypes')
    .update({ status: 'rejected' })
    .eq('id', id)
    .eq('status', 'candidate')
  if (error) {
    console.error('[admin/_actions] rejectArchetype:', error)
    throw new Error('reject failed')
  }
  revalidatePath('/admin')
}
