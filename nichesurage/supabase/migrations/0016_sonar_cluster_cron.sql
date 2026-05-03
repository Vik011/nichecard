-- Sonar: schedule the new cluster-outliers edge function 30 min after scan
-- (which runs at 03:30 UTC), so embeddings + cluster labels are ready by 04:00.
select cron.schedule(
  'sonar-cluster-outliers',
  '0 4 * * *',
  $$ select public.invoke_edge_function('cluster-outliers'); $$
);
