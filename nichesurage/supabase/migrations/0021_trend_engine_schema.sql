-- Sprint B Phase 1: Trend Detection Engine schema.
--
-- Foundational tables, types, and seed data. Idempotent everywhere
-- (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`) so re-running is safe.
--
-- pgvector is already enabled in 0011_pgvector.sql; we re-affirm via
-- CREATE EXTENSION IF NOT EXISTS so this file remains self-sufficient.

-- pgvector extension for cosine similarity over embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── Industry-standard category enum (12 niches) ─────────────────────
DO $$ BEGIN
  CREATE TYPE category_enum AS ENUM (
    'ai_tools', 'finance', 'crypto', 'tech_reviews',
    'gaming_streamers', 'fitness_health', 'self_improvement',
    'true_crime', 'luxury_lifestyle', 'celebrity_drama',
    'geopolitics_news', 'education_howto'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Watchlist tier (3-tier candidate universe) ──────────────────────
DO $$ BEGIN
  CREATE TYPE watchlist_tier_enum AS ENUM ('candidate', 'observed', 'permanent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Lifecycle status of a video ─────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE lifecycle_status_enum AS ENUM (
    'emerging', 'exploding', 'peak', 'saturated', 'dying'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Narrative archetype status ──────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE archetype_status_enum AS ENUM ('canonical', 'candidate', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Extend channels_watchlist with category + tiering ───────────────
ALTER TABLE channels_watchlist
  ADD COLUMN IF NOT EXISTS category category_enum,
  ADD COLUMN IF NOT EXISTS tier watchlist_tier_enum NOT NULL DEFAULT 'permanent',
  ADD COLUMN IF NOT EXISTS tier_entered_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_trend_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_breakout_at timestamptz,
  ADD COLUMN IF NOT EXISTS evicted_at timestamptz,
  ADD COLUMN IF NOT EXISTS discovered_via text;
  -- discovered_via: 'manual' | 'related_video' | 'cluster_member' | 'keyword_replication'

CREATE INDEX IF NOT EXISTS idx_watchlist_tier_score
  ON channels_watchlist (tier, last_trend_score DESC);
CREATE INDEX IF NOT EXISTS idx_watchlist_active_tier
  ON channels_watchlist (is_active, tier) WHERE evicted_at IS NULL;

-- ─── Time-series video snapshots (INSERT-only, never updated) ────────
CREATE TABLE IF NOT EXISTS video_snapshots (
  id bigserial PRIMARY KEY,
  video_id text NOT NULL,
  channel_id text NOT NULL,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  view_count bigint NOT NULL,
  like_count bigint,
  comment_count bigint,
  duration_seconds int,
  thumbnail_url text,
  title text,
  published_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_video_snapshots_video_scanned
  ON video_snapshots (video_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_snapshots_scanned
  ON video_snapshots (scanned_at DESC);

-- ─── Derived video metrics (UPSERT, one row per video) ───────────────
CREATE TABLE IF NOT EXISTS video_metrics (
  video_id text PRIMARY KEY,
  channel_id text,
  category category_enum,
  latest_views bigint,
  views_per_hour numeric,
  comments_per_hour numeric,
  likes_per_hour numeric,
  velocity_delta numeric,
  view_acceleration numeric,
  breakout_ratio numeric,
  novelty_score numeric,
  trend_score numeric,
  lifecycle_status lifecycle_status_enum,
  topic_tags text[],
  computed_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_video_metrics_trend
  ON video_metrics (trend_score DESC);
CREATE INDEX IF NOT EXISTS idx_video_metrics_category_trend
  ON video_metrics (category, trend_score DESC);
CREATE INDEX IF NOT EXISTS idx_video_metrics_channel
  ON video_metrics (channel_id);

-- ─── Title + transcript embeddings (1536-dim, OpenAI text-embedding-3-small)
CREATE TABLE IF NOT EXISTS video_embeddings (
  video_id text PRIMARY KEY REFERENCES video_metrics(video_id) ON DELETE CASCADE,
  title_embedding vector(1536),
  transcript_embedding vector(1536),
  embedded_at timestamptz DEFAULT now()
);
-- ivfflat index speeds cosine queries on >1k vectors. lists=100 for our scale.
CREATE INDEX IF NOT EXISTS idx_video_embeddings_title
  ON video_embeddings USING ivfflat (title_embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_video_embeddings_transcript
  ON video_embeddings USING ivfflat (transcript_embedding vector_cosine_ops) WITH (lists = 100);

-- ─── Thumbnail perceptual hash (64-bit, Hamming distance for similarity) ─
CREATE TABLE IF NOT EXISTS video_thumbnail_phash (
  video_id text PRIMARY KEY REFERENCES video_metrics(video_id) ON DELETE CASCADE,
  phash bigint NOT NULL,
  hashed_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_phash ON video_thumbnail_phash (phash);

-- ─── Trend clusters (replication groups) ─────────────────────────────
CREATE TABLE IF NOT EXISTS trend_clusters (
  id bigserial PRIMARY KEY,
  label text,
  category category_enum,
  narrative_archetype_id text,  -- FK added after narrative_archetypes table
  video_count int NOT NULL,
  channel_count int NOT NULL,
  first_seen_at timestamptz,
  last_updated_at timestamptz DEFAULT now(),
  centroid_title_embedding vector(1536),
  avg_trend_score numeric,
  is_mega_cluster boolean DEFAULT false,
  mega_cluster_categories category_enum[]
);
CREATE INDEX IF NOT EXISTS idx_trend_clusters_score
  ON trend_clusters (avg_trend_score DESC);
CREATE INDEX IF NOT EXISTS idx_trend_clusters_category
  ON trend_clusters (category, avg_trend_score DESC);

CREATE TABLE IF NOT EXISTS trend_cluster_members (
  cluster_id bigint NOT NULL REFERENCES trend_clusters(id) ON DELETE CASCADE,
  video_id text NOT NULL REFERENCES video_metrics(video_id) ON DELETE CASCADE,
  similarity numeric,
  PRIMARY KEY (cluster_id, video_id)
);
CREATE INDEX IF NOT EXISTS idx_cluster_members_video
  ON trend_cluster_members (video_id);

-- ─── Narrative archetypes (15 canonical seeds + emerging candidates) ─
CREATE TABLE IF NOT EXISTS narrative_archetypes (
  id text PRIMARY KEY,           -- snake_case slug
  display_label text NOT NULL,
  status archetype_status_enum NOT NULL DEFAULT 'candidate',
  detection_count int NOT NULL DEFAULT 0,
  first_detected_at timestamptz DEFAULT now(),
  promoted_at timestamptz,
  description text
);
CREATE INDEX IF NOT EXISTS idx_archetypes_status
  ON narrative_archetypes (status, detection_count DESC);

-- Add the FK now that narrative_archetypes exists. Guarded so re-runs no-op.
DO $$ BEGIN
  ALTER TABLE trend_clusters
    ADD CONSTRAINT fk_trend_clusters_archetype
    FOREIGN KEY (narrative_archetype_id) REFERENCES narrative_archetypes(id)
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Video recommendations graph (yt-dlp Mix playlist crawl results) ─
CREATE TABLE IF NOT EXISTS video_recommendations (
  source_video_id text NOT NULL,
  related_video_id text NOT NULL,
  position smallint NOT NULL,
  discovered_at timestamptz DEFAULT now(),
  PRIMARY KEY (source_video_id, related_video_id)
);
CREATE INDEX IF NOT EXISTS idx_video_recs_related
  ON video_recommendations (related_video_id);

-- ─── RLS ─────────────────────────────────────────────────────────────
-- Service role writes everything. Anon reads public surfaces (discover).

ALTER TABLE video_snapshots         ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_metrics           ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_embeddings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_thumbnail_phash   ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_clusters          ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_cluster_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE narrative_archetypes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_recommendations   ENABLE ROW LEVEL SECURITY;

-- Anon read on user-facing surfaces. Guarded so re-runs no-op.
DO $$ BEGIN
  CREATE POLICY "anon_read_video_metrics" ON video_metrics
    FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_read_trend_clusters" ON trend_clusters
    FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_read_cluster_members" ON trend_cluster_members
    FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_read_archetypes" ON narrative_archetypes
    FOR SELECT TO anon USING (status = 'canonical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Service role bypasses RLS by default; no explicit policy needed.

-- ─── Seed: 15 canonical narrative archetypes ─────────────────────────
INSERT INTO narrative_archetypes (id, display_label, status, description) VALUES
  ('ai_money',               'AI Money',                'canonical', 'Get-rich-with-AI hustle videos. "How I made $X using ChatGPT/Claude/etc."'),
  ('outrage_drama',          'Outrage Drama',           'canonical', 'Public conflict, callouts, beef. High emotional engagement, fast spread.'),
  ('transformation',         'Transformation',          'canonical', 'Before/after personal change — fitness, finance, lifestyle, mental health.'),
  ('scam_exposure',          'Scam Exposure',           'canonical', 'Investigative takedown of fake gurus, MLMs, fraud schemes.'),
  ('luxury_flex',            'Luxury Flex',             'canonical', 'Aspirational wealth display — supercars, mansions, private jets.'),
  ('tutorial_exploit',       'Tutorial Exploit',        'canonical', 'How-to videos riding a sudden interest spike (often timed with platform/news event).'),
  ('controversy',            'Controversy',             'canonical', 'Divisive opinion content designed to polarize comment sections.'),
  ('celebrity_collapse',     'Celebrity Collapse',      'canonical', 'Public figure scandal, fall, reputation crisis.'),
  ('impossible_achievement', 'Impossible Achievement',  'canonical', 'Extreme records, "world''s first", challenge-completion stunts.'),
  ('emotional_confession',   'Emotional Confession',    'canonical', 'First-person vulnerable storytelling — addiction, grief, mental health.'),
  ('productivity_obsession', 'Productivity Obsession',  'canonical', 'Optimization culture — routines, systems, life-hacking content.'),
  ('hidden_wealth',          'Hidden Wealth',           'canonical', 'Behind-the-scenes of low-key rich people / underground economies.'),
  ('crime_mystery',          'Crime Mystery',           'canonical', 'True-crime breakdowns, unsolved cases, cold-case revisits.'),
  ('streamer_humiliation',   'Streamer Humiliation',    'canonical', 'Viral livestream meltdowns, public on-stream embarrassment clips.'),
  ('shocking_comparison',    'Shocking Comparison',     'canonical', 'Side-by-side reveal videos — price, quality, reality vs expectation.')
ON CONFLICT (id) DO NOTHING;
