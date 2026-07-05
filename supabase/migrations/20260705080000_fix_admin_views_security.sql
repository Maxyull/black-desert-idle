-- FAILLE CORRIGÉE (2026-07-05, audit des avertissements Supabase) : ces 3 vues sont en
-- SECURITY DEFINER (nécessaire pour agréger les données de TOUS les joueurs en bypassant leur
-- RLS individuelle), mais elles étaient accessibles en SELECT par les rôles anon ET authenticated
-- via l'API REST (/rest/v1/admin_wealth etc.) — n'importe quel compte connecté (ou même anonyme)
-- pouvait donc lire le silver/niveau de TOUS les joueurs, la ping playtime globale, etc., alors que
-- le panneau admin cliente ne fait qu'un contrôle d'affichage côté client (aucune protection réelle
-- côté serveur). Corrigé en ajoutant le même contrôle "réservé au staff" que admin_list_players() /
-- admin_get_player_inventory(), directement dans la clause WHERE de la vue : ne renvoie des lignes
-- que si l'email JWT de l'appelant est celui de l'admin, sinon un résultat vide (le panneau
-- affichera juste "aucune donnée" pour tout le monde sauf l'admin, sans jamais lever d'erreur ni
-- changer le code client qui fait toujours un simple sb.from('admin_wealth').select('*')).
create or replace view public.admin_farm_by_item
with (security_invoker = false) as
select item_name, item_kind, count(*) as pickups, sum(qty) as total_qty, sum(silver_value) as total_silver
from farm_events
where created_at > now() - interval '30 days'
  and coalesce((select auth.jwt()->>'email'), '') = 'maxime.lacoste@icloud.com'
group by item_name, item_kind
order by sum(qty) desc;

create or replace view public.admin_playtime_by_hour
with (security_invoker = false) as
select date_trunc('hour', pinged_at) as hour, count(*) * 60 as total_playtime_sec
from playtime_pings
where pinged_at > now() - interval '48:00:00'
  and coalesce((select auth.jwt()->>'email'), '') = 'maxime.lacoste@icloud.com'
group by date_trunc('hour', pinged_at)
order by date_trunc('hour', pinged_at) desc;

create or replace view public.admin_wealth
with (security_invoker = false) as
select user_id,
  ((save_data->'S')->>'silver')::bigint as silver,
  ((save_data->'S')->>'lvl')::int as lvl,
  (save_data->>'savedAt')::timestamptz as last_saved,
  ((save_data->'S')->>'silverEarned')::bigint as silver_earned
from game_saves
where coalesce((select auth.jwt()->>'email'), '') = 'maxime.lacoste@icloud.com'
order by ((save_data->'S')->>'silver')::bigint desc nulls last;

-- resserre les droits : lecture seule, et seulement pour les comptes connectés (le filtre WHERE
-- ci-dessus fait le vrai travail, mais anon n'a de toute façon aucune raison d'y accéder)
revoke all on public.admin_farm_by_item from anon, authenticated;
revoke all on public.admin_playtime_by_hour from anon, authenticated;
revoke all on public.admin_wealth from anon, authenticated;
grant select on public.admin_farm_by_item to authenticated;
grant select on public.admin_playtime_by_hour to authenticated;
grant select on public.admin_wealth to authenticated;
