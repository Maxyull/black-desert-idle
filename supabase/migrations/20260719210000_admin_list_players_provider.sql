-- Plateforme d'inscription dans le panneau admin (2026-07-20, demande explicite : "montre avec
-- quoi les joueur se sont inscrit comme plateforme a cité de leurs pseudo et tu peux créer un
-- graph aussi") -- auth.users.raw_app_meta_data->>'provider' est déjà rempli par Supabase Auth
-- pour chaque méthode (email/discord/google/github), 'anonymous' pour les invités -- aucune
-- nouvelle colonne à maintenir, juste un join en lecture sur auth.users.

-- admin_list_players() change de type de retour (colonne provider ajoutée) -- DROP obligatoire
-- avant recréation (règle du projet, voir CLAUDE.md : sinon ambiguïté de surcharge).
drop function if exists public.admin_list_players();

create or replace function public.admin_list_players()
returns table(user_id uuid, display_name text, silver bigint, gearscore integer, lvl integer, online boolean, last_seen timestamp with time zone, best_kpm numeric, ap numeric, dp numeric, provider text)
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
      v.last_seen, v.best_kpm, v.ap, v.dp,
      coalesce(au.raw_app_meta_data->>'provider', 'email') as provider
    from verified v
    left join auth.users au on au.id = v.user_id
    union all
    select g.user_id, g.display_name, g.silver, g.gearscore, g.lvl,
      (g.last_seen is not null and g.last_seen > now() - interval '90 seconds') as online,
      g.last_seen, g.best_kpm, g.ap, g.dp,
      coalesce(au.raw_app_meta_data->>'provider', 'anonymous') as provider
    from guests g
    left join auth.users au on au.id = g.user_id
    order by online desc, last_seen desc nulls last;
end;
$function$;
grant execute on function public.admin_list_players() to authenticated;

-- répartition des inscriptions par plateforme (tous comptes, invités inclus sous 'anonymous') --
-- alimente le camembert de la section "Inscriptions".
create or replace function public.admin_signups_by_provider()
 returns table(provider text, signups bigint)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  return query
    select coalesce(u.raw_app_meta_data->>'provider', 'email') as provider, count(*)::bigint as signups
    from auth.users u
    group by 1
    order by 2 desc;
end;
$function$;
grant execute on function public.admin_signups_by_provider() to authenticated;
