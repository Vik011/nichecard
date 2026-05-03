-- Sonar: DB-driven seed keywords. Sonar discover pulls top N by priority each run
-- so the keyword set can be tuned without redeploying the edge function.
create table if not exists public.seed_keywords (
  id uuid primary key default gen_random_uuid(),
  term text not null,
  language content_language not null,
  content_type text not null check (content_type in ('shorts', 'longform', 'both')),
  priority int not null default 50,
  is_active boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists seed_keywords_active_priority_idx
  on public.seed_keywords (is_active, priority desc, last_used_at asc nulls first);

alter table public.seed_keywords enable row level security;

-- Anyone can read; only service role writes (set policies that match scan_results pattern).
create policy "seed keywords readable by all authenticated"
  on public.seed_keywords for select
  using (auth.role() = 'authenticated');

-- Initial 12 seeds: 6 categories x 2 languages. Priority descends in declared order.
insert into public.seed_keywords (term, language, content_type, priority) values
  ('AI Automation Tools',                'en', 'both',     100),
  ('KI-Automatisierungstools',           'de', 'both',     100),
  ('Faceless YouTube Growth',            'en', 'both',      95),
  ('Faceless YouTube Wachstum',          'de', 'both',      95),
  ('Digital Minimalism Productivity',    'en', 'both',      90),
  ('Digitaler Minimalismus',             'de', 'both',      90),
  ('Stoic Philosophy Mental Health',     'en', 'both',      85),
  ('Stoische Philosophie',               'de', 'both',      85),
  ('Personal Finance Crypto Trends',     'en', 'both',      80),
  ('Persönliche Finanzen Krypto',        'de', 'both',      80),
  ('Satisfying Relaxing Content',        'en', 'shorts',    75),
  ('Entspannende Inhalte',               'de', 'shorts',    75)
on conflict do nothing;
