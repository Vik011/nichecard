import { createClient } from './client'

export async function fetchSavedNicheIds(): Promise<Set<string>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Set()

  const { data } = await supabase
    .from('user_saved_niches')
    .select('scan_result_id')
    .eq('user_id', user.id)

  return new Set((data ?? []).map((r: { scan_result_id: string }) => r.scan_result_id))
}

export async function saveNiche(scanResultId: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('user_saved_niches')
    .insert({ user_id: user.id, scan_result_id: scanResultId })

  if (error) return { error: 'Failed to save niche. Please try again.' }
  return { error: null }
}

export async function unsaveNiche(scanResultId: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('user_saved_niches')
    .delete()
    .eq('user_id', user.id)
    .eq('scan_result_id', scanResultId)

  if (error) return { error: 'Failed to unsave niche. Please try again.' }
  return { error: null }
}
