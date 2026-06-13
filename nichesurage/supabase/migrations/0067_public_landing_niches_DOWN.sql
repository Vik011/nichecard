-- DOWN for 0067_public_landing_niches.sql
--
-- Removes the safe public landing RPC. This is safe to run ONLY when no
-- deployed code calls it -- i.e. before the landing code that reads the RPC
-- has shipped, or after that landing code has been reverted to the old
-- scan_results_latest path. Dropping the function while the new landing is
-- live in production would break the logged-out landing page.

drop function if exists public.public_landing_niches();
