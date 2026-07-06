-- Bug trouvé le 2026-07-11 (demande explicite : "verifie que ma liste connecté inscrit admin est
-- bien lié avec la réalité") : syncPlayerStats() (game-supabase.js) n'écrit JAMAIS dans
-- player_stats pour un compte invité ("classement réservé aux comptes vérifiés", volontaire pour
-- le classement PUBLIC) -- mais admin_list_players() se basait uniquement sur player_stats, donc
-- tout invité actif (avec une vraie sauvegarde/progression) était totalement invisible côté admin.
-- Vérifié en base : 19 comptes (auth.users), seulement 11 lignes player_stats, 6 invités avec une
-- vraie sauvegarde (silver/niveau) totalement absents de la liste admin.
-- Ce correctif récupère ces comptes directement depuis game_saves (+ profiles pour le pseudo s'il
-- existe, + presence pour le statut en ligne), sans toucher au classement public (toujours basé
-- uniquement sur player_stats côté client, voir openLeaderboard).
create or replace function public.admin_list_players()
returns table(user_id uuid, display_name text, silver bigint, gearscore integer, lvl integer, online boolean, last_seen timestamp with time zone, best_kpm numeric, ap numeric, dp numeric)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if coalesce(auth.jwt()->>'email', '') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Réservé au staff';
  end if;
  return query
    with verified as (
      select ps.user_id, coalesce(ps.display_name,'?') as display_name, coalesce(ps.silver,0)::bigint as silver,
        coalesce(ps.gearscore,0)::int as gearscore, coalesce(ps.lvl,1)::int as lvl,
        pr.last_seen, coalesce(ps.best_kpm,0) as best_kpm, coalesce(ps.ap,0) as ap, coalesce(ps.dp,0) as dp
      from public.player_stats ps
      left join public.presence pr on pr.user_id = ps.user_id
    ),
    guests as (
      select gs.user_id,
        '🎭 ' || coalesce(prof.pseudo, 'Invité-' || left(gs.user_id::text, 6)) as display_name,
        coalesce((gs.save_data->'S'->>'silver')::numeric, 0)::bigint as silver,
        0 as gearscore,
        coalesce((gs.save_data->'S'->>'lvl')::int, 1) as lvl,
        pr.last_seen, 0::numeric as best_kpm, 0::numeric as ap, 0::numeric as dp
      from public.game_saves gs
      left join public.presence pr on pr.user_id = gs.user_id
      left join public.profiles prof on prof.user_id = gs.user_id
      where not exists (select 1 from public.player_stats ps where ps.user_id = gs.user_id)
    )
    select v.user_id, v.display_name, v.silver, v.gearscore, v.lvl,
      (v.last_seen is not null and v.last_seen > now() - interval '90 seconds') as online,
      v.last_seen, v.best_kpm, v.ap, v.dp
    from verified v
    union all
    select g.user_id, g.display_name, g.silver, g.gearscore, g.lvl,
      (g.last_seen is not null and g.last_seen > now() - interval '90 seconds') as online,
      g.last_seen, g.best_kpm, g.ap, g.dp
    from guests g
    order by online desc, last_seen desc nulls last;
end;
$function$;
