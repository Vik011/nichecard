// supabase/functions/recategorize/index.ts
//
// One-time bulk reclassifier: walks channels_watchlist where category IS NULL,
// pulls the latest 5 video titles from scan_results, asks Claude Haiku to
// classify, and UPDATEs the row.
//
// - Idempotent: rows that already have a non-null category are skipped.
// - Throttled: 2 channels/sec (500ms sleep between calls) — Claude rate-limit
//   headroom + so we don't burn the YouTube API budget on a re-run.
// - Defensive: classifier itself never throws (returns 'education_howto'
//   fallback), so one bad row can't abort the loop.
//
// Invoke once after migration 0024_trend_engine_schema.sql is applied:
//   supabase functions invoke recategorize
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { classifyChannelCategory } from '../_shared/categories.ts'

const SLEEP_MS = 500 // 2 req/sec

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

Deno.serve(async (_req: Request) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!supabaseUrl) throw new Error('SUPABASE_URL not set')
    if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not set')

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Pull every channel that hasn't been categorised yet. We don't bound the
    // query size — channels_watchlist is small (low thousands at most) and the
    // throttle ensures we won't melt anything even on a full sweep.
    const { data: channels, error: fetchError } = await supabase
      .from('channels_watchlist')
      .select('id, youtube_channel_id, channel_name, niche_label, category')
      .is('category', null)

    if (fetchError) throw fetchError
    if (!channels || channels.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, updated: 0, skipped: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let processed = 0
    let updated = 0
    let skipped = 0

    for (const channel of channels) {
      processed++

      // Defensive re-check (race protection if multiple invocations overlap).
      if (channel.category) {
        skipped++
        continue
      }

      try {
        // Latest 5 outlier titles from scan_results — strongest niche signal.
        const { data: recent } = await supabase
          .from('scan_results')
          .select('outlier_video_title, scanned_at')
          .eq('youtube_channel_id', channel.youtube_channel_id)
          .order('scanned_at', { ascending: false })
          .limit(5)

        const titles = (recent ?? [])
          .map((r: { outlier_video_title: string | null }) => r.outlier_video_title)
          .filter((t): t is string => typeof t === 'string' && t.length > 0)

        const category = await classifyChannelCategory(
          channel.channel_name ?? '',
          channel.niche_label ?? '',
          titles,
          anthropicKey,
        )

        const { error: updateError } = await supabase
          .from('channels_watchlist')
          .update({ category })
          .eq('id', channel.id)

        if (updateError) {
          console.error(`recategorize: update failed for ${channel.youtube_channel_id}:`, updateError)
          continue
        }
        updated++
      } catch (err) {
        // classifier itself never throws, but a Supabase blip might. Log + continue.
        console.error(`recategorize: failed for ${channel.youtube_channel_id}:`, err)
      }

      await sleep(SLEEP_MS)
    }

    return new Response(JSON.stringify({ success: true, processed, updated, skipped }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('recategorize fatal error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
