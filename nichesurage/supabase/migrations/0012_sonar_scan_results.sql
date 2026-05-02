-- Sonar: extend scan_results with outlier signal + cluster + embedding columns.
-- Existing columns (subscriber_count, views_48h, spike_multiplier, niche_label, ...) are preserved
-- for backward compat with the legacy UI; new Sonar UI prefers cluster_id.label.
alter table public.scan_results
  add column if not exists outlier_ratio numeric(10, 2),
  add column if not exists is_spike boolean not null default false,
  add column if not exists outlier_video_id text,
  add column if not exists outlier_video_title text,
  add column if not exists outlier_video_views bigint,
  add column if not exists window_hours int not null default 48,
  add column if not exists seed_keyword text,
  add column if not exists cluster_id uuid,
  add column if not exists embedding extensions.vector(1536);

-- Hot path: list spiking niches sorted by outlier ratio.
create index if not exists scan_results_spike_ratio_idx
  on public.scan_results (is_spike desc, outlier_ratio desc, scanned_at desc);

-- Cluster filter: list rows in a given cluster.
create index if not exists scan_results_cluster_idx
  on public.scan_results (cluster_id)
  where cluster_id is not null;

-- Embedding ANN search (used by cluster-outliers to find nearest cluster centroid).
-- IVFFlat with cosine ops; lists tuned for ~10k rows.
create index if not exists scan_results_embedding_idx
  on public.scan_results
  using ivfflat (embedding extensions.vector_cosine_ops)
  with (lists = 100)
  where embedding is not null;
