-- 0007: Schedule daily discover + scan via pg_cron + pg_net
--
-- PREREQUISITES (run once before applying this migration):
--   1. Get the legacy JWT service-role key:
--      Supabase Dashboard → Settings → API → "Legacy JWT keys" section
--      Click "Reveal" on service_role key (eyJhbGc... format, NOT sb_secret_*).
--
--   2. Store it in Vault via Dashboard → SQL Editor:
--        select vault.create_secret(
--          'eyJ...PASTE_LEGACY_SERVICE_ROLE_JWT_HERE...',
--          'edge_function_jwt'
--        );
--
--   3. Then apply this migration. The cron jobs read the secret from Vault at
--      runtime, so the JWT never appears in this file or in git history.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- Helper: invoke an Edge Function by name using the JWT stored in Vault.
create or replace function public.invoke_edge_function(fn_name text)
returns bigint
language plpgsql
security definer
set search_path = public, vault, extensions
as $$
declare
  jwt text;
  request_id bigint;
begin
  select decrypted_secret into jwt
    from vault.decrypted_secrets
    where name = 'edge_function_jwt'
    limit 1;

  if jwt is null then
    raise exception 'Vault secret "edge_function_jwt" not found. See migration 0007 prereqs.';
  end if;

  select net.http_post(
    url := 'https://qwedflkklenqbijheasx.supabase.co/functions/v1/' || fn_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || jwt
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 600000
  ) into request_id;

  return request_id;
end;
$$;

-- Schedule: discover daily at 03:00 UTC (low YouTube API contention window).
select cron.schedule(
  'daily-discover',
  '0 3 * * *',
  $$ select public.invoke_edge_function('discover'); $$
);

-- Schedule: scan daily at 03:30 UTC (30 min after discover so newly added
-- channels in channels_watchlist get their first metrics row immediately).
select cron.schedule(
  'daily-scan',
  '30 3 * * *',
  $$ select public.invoke_edge_function('scan'); $$
);
