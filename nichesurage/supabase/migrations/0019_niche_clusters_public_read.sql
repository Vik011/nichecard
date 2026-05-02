-- Sonar fix: /discover is a public page (anon allowed). The 0014 RLS policy
-- restricted SELECT to authenticated, so unauthenticated visitors saw NicheCard
-- with cluster_id but joined niche_clusters as NULL — which made the UI fall
-- back to "Niche #N" rank labels instead of the AI-generated cluster names.
-- Open SELECT to anon as well; INSERT/UPDATE remain service_role only.
drop policy if exists "niche clusters readable by all authenticated"
  on public.niche_clusters;

create policy "niche clusters readable by all"
  on public.niche_clusters
  for select
  to anon, authenticated
  using (true);
