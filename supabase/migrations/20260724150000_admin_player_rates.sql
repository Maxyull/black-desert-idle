-- ============================================================
-- Surface admin des cadences horaires (2026-07-19, audit "tout ce qui se monitor dans le jeu est
-- dans le panel"). player_hour_rates est alimentée par compute_player_hour_rates() et protégée en
-- écriture par protect_server_rate_columns() : c'est LA table qui sert à repérer une progression
-- impossible (silver/kills par heure). Elle contenait 307 lignes sans qu'aucune vue admin ne la
-- lise -- l'anti-triche existait côté serveur mais restait invisible.
--
-- Le tri par loot_silver décroissant est volontaire : une valeur aberrante remonte d'elle-même en
-- haut de la liste, sans seuil arbitraire à maintenir.
-- player_sessions (registre des verrous de session, un par joueur connecté) est remonté comme
-- simple compteur dans le résumé -- il n'a pas d'historique à explorer.
--
-- Patron de sécurité identique aux autres RPC admin : SECURITY DEFINER + search_path figé + garde
-- e-mail staff côté serveur + revoke public/anon. LECTURE SEULE.
-- ============================================================

create or replace function public.admin_player_rates_summary()
returns table(hours_tracked bigint, players_tracked bigint, max_silver_per_hour bigint,
              avg_silver_per_hour numeric, max_kills_per_hour integer, active_session_locks bigint)
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  return query
    select (select count(*)::bigint from player_hour_rates),
           (select count(distinct r.user_id)::bigint from player_hour_rates r),
           (select coalesce(max(r.loot_silver),0)::bigint from player_hour_rates r),
           (select coalesce(round(avg(r.loot_silver),0),0)::numeric from player_hour_rates r),
           (select coalesce(max(r.kills),0)::integer from player_hour_rates r),
           (select count(*)::bigint from player_sessions);
end; $$;

create or replace function public.admin_player_rates(p_limit integer default 30)
returns table(user_id uuid, display_name text, hour timestamptz, loot_silver bigint, kills integer)
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  return query
    select r.user_id, coalesce(ps.display_name, '?')::text, r.hour, r.loot_silver, r.kills
    from player_hour_rates r
    left join player_stats ps on ps.user_id = r.user_id
    order by r.loot_silver desc nulls last
    limit p_limit;
end; $$;

revoke all on function public.admin_player_rates_summary() from public, anon;
revoke all on function public.admin_player_rates(integer) from public, anon;
grant execute on function public.admin_player_rates_summary() to authenticated;
grant execute on function public.admin_player_rates(integer) to authenticated;
