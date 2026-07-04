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
-- ============================================================

create or replace view public.admin_wealth as
select
  user_id,
  ((save_data->'S'->>'silver')::bigint) as silver,
  ((save_data->'S'->>'lvl')::integer) as lvl,
  (save_data->>'savedAt')::timestamptz as last_saved,
  ((save_data->'S'->>'silverEarned')::bigint) as silver_earned
from game_saves
order by ((save_data->'S'->>'silver')::bigint) desc nulls last;
