-- 0045: Apify discovery run lifecycle tracking.
--
-- WHY:
-- The discover-plan edge function fires Apify scraper runs to find
-- YouTube channels without consuming YouTube Data API quota. This table
-- is the bookkeeping ledger for every such run, providing two things:
--
--   1. Lifecycle tracking: discover-plan inserts a row (status='triggered')
--      immediately after starting a run. discover-ingest later polls Apify,
--      processes the dataset, and updates the row to 'ingested', 'failed',
--      or 'error'. The partial index on status='triggered' lets discover-ingest
--      quickly find runs that still need polling.
--
--   2. Cost tracking: cost_usd records the Apify actor compute cost for each
--      run, enabling monthly spend aggregation without hitting the Apify API
--      repeatedly.
--
-- Status state machine:
--   triggered -> ingested   (run completed, channels processed)
--   triggered -> failed     (Apify run finished with no usable results)
--   triggered -> error      (Apify API error or polling timeout)
--
-- Columns:
--   id             : internal primary key (UUID)
--   apify_run_id   : Apify run ID, unique per run
--   dataset_id     : Apify dataset ID populated after run completes
--   status         : lifecycle status (triggered, ingested, failed, error)
--   query_plan     : the full query plan JSON sent to the actor
--   apify_status   : raw last-polled Apify run status (RUNNING, SUCCEEDED, etc.)
--   cost_usd       : actor compute cost in USD from Apify usage endpoint
--   channels_found : total channels returned by the actor dataset
--   channels_added : channels actually inserted into channels_watchlist
--   error_message  : populated on failed or error status
--   triggered_at   : when discover-plan fired the run
--   ingested_at    : when discover-ingest finished processing

CREATE TABLE public.apify_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apify_run_id   text NOT NULL UNIQUE,
  dataset_id     text,
  status         text NOT NULL DEFAULT 'triggered',  -- triggered|ingested|failed|error
  query_plan     jsonb NOT NULL,
  apify_status   text,                                -- raw last-polled Apify status
  cost_usd       numeric(10,4),
  channels_found integer,
  channels_added integer,
  error_message  text,
  triggered_at   timestamptz NOT NULL DEFAULT now(),
  ingested_at    timestamptz
);

-- Partial index: discover-ingest scans only rows still pending.
CREATE INDEX idx_apify_runs_status ON public.apify_runs (status) WHERE status='triggered';

-- Chronological index: cost rollups and audit queries ordered by run time.
CREATE INDEX idx_apify_runs_triggered_at ON public.apify_runs (triggered_at DESC);

-- RLS: internal bookkeeping, edge functions (service role) only.
-- Service role bypasses RLS automatically, so no policies are needed.
-- Enabling RLS with no policies locks out anon and authenticated roles.
ALTER TABLE public.apify_runs ENABLE ROW LEVEL SECURITY;
