-- ============================================================
-- admin_wealth : ajoute silver_earned — Velia Idle
-- Demande explicite du 2026-07-07 : "pour les silver fais un system a la loyalties je veux
-- savoir d'un coup d'oeil ou part les silver et s'il sont stocké".
--
-- silver         = solde ACTUEL (stocké) d'un joueur
-- silver_earned  = compteur À VIE (jamais décrémenté, sauf annulation d'une vente via "Racheter")
-- silver_earned - silver, sommé sur tous les joueurs, donne une approximation du silver DÉPENSÉ
-- (essentiellement les coûts d'optimisation — c'est la seule opération qui décrémente "silver"
-- sans décrémenter "silverEarned" en même temps).
--
-- Supabase > SQL Editor > New query > Run
--
-- FAILLE CORRIGÉE le 2026-07-05 (audit des avertissements Supabase, voir
-- supabase/migrations/20260705080000_fix_admin_views_security.sql) : cette vue est en SECURITY
-- DEFINER (nécessaire pour agréger le silver de TOUS les joueurs en bypassant leur RLS
-- individuelle), mais elle était lisible par N'IMPORTE QUEL compte connecté ou anonyme via l'API
-- REST (/rest/v1/admin_wealth) — n'importe qui pouvait donc lire le silver/niveau de tous les
-- joueurs. La clause WHERE ci-dessous ne renvoie des lignes que pour l'email admin ; ne JAMAIS
-- retirer ce filtre si ce fichier est ré-exécuté.
-- ============================================================

create or replace view public.admin_wealth
with (security_invoker = false) as
select
  user_id,
  ((save_data->'S'->>'silver')::bigint) as silver,
  ((save_data->'S'->>'lvl')::integer) as lvl,
  (save_data->>'savedAt')::timestamptz as last_saved,
  ((save_data->'S'->>'silverEarned')::bigint) as silver_earned
from game_saves
where coalesce((select auth.jwt()->>'email'), '') = 'maxime.lacoste@icloud.com'
order by ((save_data->'S'->>'silver')::bigint) desc nulls last;

revoke all on public.admin_wealth from anon, authenticated;
grant select on public.admin_wealth to authenticated;
