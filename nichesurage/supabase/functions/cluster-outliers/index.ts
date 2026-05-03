// supabase/functions/cluster-outliers/index.ts
// Sonar clustering pipeline. Runs daily after scan:
//   1. Embed all is_spike rows whose embedding is null (OpenAI text-embedding-3-small).
//   2. For each newly embedded row, look up nearest existing cluster centroid;
//      if cosine ≥ CLUSTERING_SIMILARITY, attach + bump centroid.
//   3. Any orphans get batch-clustered via mini-batch KMeans, each new cluster
//      sent to Claude for a single premium label.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { embedTexts } from '../_shared/openai.ts'
import { cosine, kmeans, meanVector, updateCentroid } from '../_shared/clustering.ts'
import { getClusterLabel } from '../_shared/anthropic.ts'

const SIMILARITY_THRESHOLD = parseFloat(Deno.env.get('CLUSTERING_SIMILARITY') ?? '0.78')
const ORPHAN_BATCH_MIN = parseInt(Deno.env.get('ORPHAN_BATCH_MIN') ?? '5', 10)
const EMBED_BATCH = parseInt(Deno.env.get('EMBED_BATCH') ?? '50', 10)

interface UnembeddedRow {
  id: string
  outlier_video_title: string | null
  outlier_video_id: string | null
  language: 'en' | 'de'
  content_type: 'shorts' | 'longform'
}

interface ClusterRow {
  id: string
  label: string
  centroid: number[]
  member_count: number
}

Deno.serve(async (_req: Request) => {
  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!openaiKey) throw new Error('OPENAI_API_KEY not set')
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not set')
    if (!supabaseUrl) throw new Error('SUPABASE_URL not set')
    if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // 1) Pull spike rows that need embedding (limit per run keeps us under
    //    OpenAI rate + cost ceilings).
    const { data: rowsToEmbed, error: pullErr } = await supabase
      .from('scan_results')
      .select('id, outlier_video_title, outlier_video_id, language, content_type')
      .eq('is_spike', true)
      .is('embedding', null)
      .not('outlier_video_title', 'is', null)
      .order('scanned_at', { ascending: false })
      .limit(EMBED_BATCH)
    if (pullErr) throw pullErr
    const unembedded = (rowsToEmbed ?? []) as UnembeddedRow[]
    if (unembedded.length === 0) {
      return new Response(JSON.stringify({ success: true, embedded: 0, attached: 0, new_clusters: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Pull video descriptions for these rows from scan_results (added in 0012);
    // outlier_video_title was set by Phase 2 scan but description is not stored,
    // so embedding text uses just the title for now. (Future: add description column.)
    const texts = unembedded.map(r => r.outlier_video_title ?? '')
    const embeddings = await embedTexts(openaiKey, texts)
    if (embeddings.length !== unembedded.length) {
      throw new Error(`embed count mismatch: ${embeddings.length} vs ${unembedded.length}`)
    }

    // Persist embeddings immediately so a partial failure later doesn't waste tokens.
    for (let i = 0; i < unembedded.length; i++) {
      // pgvector accepts JSON-as-array text via the supabase-js client.
      await supabase
        .from('scan_results')
        .update({ embedding: embeddings[i] as unknown as string })
        .eq('id', unembedded[i].id)
    }

    // 2) Load existing clusters into memory (small set).
    const { data: clusterRows } = await supabase
      .from('niche_clusters')
      .select('id, label, centroid, member_count')
    const clusters: ClusterRow[] = (clusterRows ?? []).map((c: {
      id: string; label: string; centroid: number[] | string; member_count: number
    }) => ({
      id: c.id,
      label: c.label,
      centroid: Array.isArray(c.centroid) ? c.centroid : JSON.parse(c.centroid as string),
      member_count: c.member_count,
    }))

    let attached = 0
    const orphanIdx: number[] = []   // indexes into `unembedded` / `embeddings`

    for (let i = 0; i < unembedded.length; i++) {
      const vec = embeddings[i]
      let bestId: string | null = null
      let bestSim = -Infinity
      let bestIdx = -1
      for (let c = 0; c < clusters.length; c++) {
        const sim = cosine(vec, clusters[c].centroid)
        if (sim > bestSim) { bestSim = sim; bestId = clusters[c].id; bestIdx = c }
      }

      if (bestId && bestSim >= SIMILARITY_THRESHOLD) {
        const cluster = clusters[bestIdx]
        const nextCentroid = updateCentroid(cluster.centroid, cluster.member_count, vec)
        cluster.centroid = nextCentroid
        cluster.member_count += 1
        await supabase.from('scan_results').update({ cluster_id: bestId }).eq('id', unembedded[i].id)
        await supabase.from('niche_clusters').update({
          centroid: nextCentroid as unknown as string,
          member_count: cluster.member_count,
        }).eq('id', bestId)
        attached++
      } else {
        orphanIdx.push(i)
      }
    }

    // 3) Cluster orphans into new niches when there are enough.
    let newClusters = 0
    if (orphanIdx.length >= ORPHAN_BATCH_MIN) {
      const orphanVecs = orphanIdx.map(i => embeddings[i])
      const k = Math.max(2, Math.min(5, Math.floor(Math.sqrt(orphanIdx.length / 2))))
      const { centroids, assignments } = kmeans(orphanVecs, k, 8)

      // Group orphan rows by KMeans cluster.
      const groups: { rowIds: string[]; vecs: number[][] }[] = Array.from({ length: centroids.length }, () => ({ rowIds: [], vecs: [] }))
      for (let j = 0; j < assignments.length; j++) {
        const g = assignments[j]
        groups[g].rowIds.push(unembedded[orphanIdx[j]].id)
        groups[g].vecs.push(orphanVecs[j])
      }

      for (let g = 0; g < groups.length; g++) {
        const grp = groups[g]
        if (grp.rowIds.length === 0) continue

        // Pull titles + descriptions for the group's rows to feed Claude.
        const { data: titleRows } = await supabase
          .from('scan_results')
          .select('id, outlier_video_title')
          .in('id', grp.rowIds)
        const titles = (titleRows ?? [])
          .map((r: { outlier_video_title: string | null }) => ({
            title: r.outlier_video_title ?? '',
            description: '',
          }))
          .filter(v => v.title.length > 0)

        let label = ''
        try {
          label = await getClusterLabel(anthropicKey, titles)
        } catch (err) {
          console.error(`cluster label failed (group ${g}):`, err)
          label = `Niche ${g + 1}`   // fallback so the cluster row still inserts
        }

        // Pick a representative member to seed language + content_type metadata.
        const samples = orphanIdx
          .filter((_, j) => assignments[j] === g)
          .map(i => unembedded[i])
        const sampleLang = samples[0]?.language ?? null
        const sampleType = samples[0]?.content_type ?? null

        const centroid = meanVector(grp.vecs)
        const { data: inserted, error: insertErr } = await supabase
          .from('niche_clusters')
          .insert({
            label,
            centroid: centroid as unknown as string,
            member_count: grp.rowIds.length,
            language: sampleLang,
            content_type: sampleType,
          })
          .select('id')
          .single()
        if (insertErr || !inserted) {
          console.error(`cluster insert failed (group ${g}):`, insertErr)
          continue
        }
        await supabase
          .from('scan_results')
          .update({ cluster_id: inserted.id })
          .in('id', grp.rowIds)
        newClusters++
      }
    }

    return new Response(JSON.stringify({
      success: true,
      embedded: unembedded.length,
      attached,
      orphans_left: orphanIdx.length >= ORPHAN_BATCH_MIN ? 0 : orphanIdx.length,
      new_clusters: newClusters,
    }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('cluster-outliers fatal error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
