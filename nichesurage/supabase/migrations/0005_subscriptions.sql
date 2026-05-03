-- Subscription lifecycle columns on users table.
-- The `tier` column already exists (free / basic / premium); these columns
-- track *how* the paid tier was acquired and when it lapses.

create type billing_interval as enum ('monthly', 'yearly');
create type subscription_status as enum ('active', 'trialing', 'past_due', 'canceled', 'incomplete');

alter table public.users
  add column billing_interval billing_interval,
  add column subscription_status subscription_status,
  add column stripe_subscription_id text unique,
  add column subscription_current_period_end timestamptz;

create index users_stripe_subscription_id_idx on public.users(stripe_subscription_id);
create index users_subscription_status_idx on public.users(subscription_status);
