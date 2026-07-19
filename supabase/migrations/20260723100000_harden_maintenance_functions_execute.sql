-- Durcissement (2026-07-19) : retire le droit d'EXÉCUTION des fonctions de MAINTENANCE/CRON aux
-- rôles anon et authenticated (issu de l'audit des advisors Supabase, lint
-- `anon_security_definer_function_executable`).
--
-- Contexte : ces 5 fonctions sont SECURITY DEFINER, mutent l'état du jeu, et n'ont AUCUN garde
-- d'autorisation interne -- elles ne sont PAS censées être appelées par un client. Grâce au grant
-- EXECUTE par défaut à PUBLIC (Postgres), un utilisateur anonyme pouvait pourtant les déclencher
-- hors bande (ex. forcer une ré-évaluation du marché, attribuer des récompenses PvP, purger des
-- logs). Aucune de ces fonctions n'est appelée via `.rpc(...)` côté client (vérifié dans src/) :
--   - market_match_item(text)      -> appelée UNIQUEMENT en interne par market_place_order (DEFINER)
--   - pvp_award_rewards(date)       -> appelée UNIQUEMENT en interne par resolve_pvp_tournament_if_due (DEFINER)
--   - reevaluate_market(int)        -> planifiée via pg_cron
--   - expire_pet_trade_offers()     -> planifiée via pg_cron
--   - purge_old_client_errors()     -> planifiée via pg_cron
--
-- Sécurité du changement : les appels internes se font depuis des fonctions SECURITY DEFINER
-- (l'appel utilise les droits du PROPRIÉTAIRE, pas ceux d'anon/authenticated) et pg_cron s'exécute
-- en tant que superutilisateur (contourne les grants) -- donc RIEN n'est cassé. On REVOKE du PUBLIC
-- (la vraie source du droit d'anon), d'anon et authenticated (au cas où un grant explicite existe),
-- et on RÉ-ACCORDE explicitement à service_role pour préserver un éventuel appel via Edge Function
-- / clé service.

revoke execute on function public.market_match_item(text)       from public, anon, authenticated;
revoke execute on function public.pvp_award_rewards(date)         from public, anon, authenticated;
revoke execute on function public.reevaluate_market(integer)      from public, anon, authenticated;
revoke execute on function public.expire_pet_trade_offers()       from public, anon, authenticated;
revoke execute on function public.purge_old_client_errors()       from public, anon, authenticated;

grant execute on function public.market_match_item(text)          to service_role;
grant execute on function public.pvp_award_rewards(date)           to service_role;
grant execute on function public.reevaluate_market(integer)        to service_role;
grant execute on function public.expire_pet_trade_offers()         to service_role;
grant execute on function public.purge_old_client_errors()         to service_role;
