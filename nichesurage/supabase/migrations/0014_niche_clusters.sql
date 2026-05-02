-- Sonar: AI-named niche clusters. Each cluster groups outlier videos by embedding
-- similarity and carries a single Claude-generated premium label
-- (e.g. "Minimalist Survival Cooking").
create table if not exists public.niche_clusters (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  centroid extensions.vector(1536) not null,
  member_count int not null default 0,
  language content_language,
  content_type text check (content_type in ('shorts', 'longform', 'both')),
  label_locked boolean not null default false,    -- admin override: skip auto-relabel
  last_labeled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ANN search: find nearest cluster for a new outlier embedding.
create index if not exists niche_clusters_centroid_idx
  on public.niche_clusters
  using ivfflat (centroid extensions.vector_cosine_ops)
  with (lists = 50);

create index if not exists niche_clusters_member_count_idx
  on public.niche_clusters (member_count desc);

-- FK from scan_results.cluster_id (added in 0012).
alter table public.scan_results
  drop constraint if exists scan_results_cluster_id_fkey;
alter table public.scan_results
  add constraint scan_results_cluster_id_fkey
  foreign key (cluster_id) references public.niche_clusters(id) on delete set null;

alter table public.niche_clusters enable row level security;

create policy "niche clusters readable by all authenticated"
  on public.niche_clusters for select
  using (auth.role() = 'authenticated');

-- Touch updated_at on member_count or label changes.
create or replace function public.touch_niche_cluster_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger niche_clusters_touch_updated_at
  before update on public.niche_clusters
  for each row execute function public.touch_niche_cluster_updated_at();
