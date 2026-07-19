-- ============================================================
-- Correctifs de couverture admin (2026-07-19, demande explicite : "vérifie que toute fonction du
-- dashboard panel admin fonctionne"). L'audit a trouvé DEUX fonctionnalités affichées mais qui
-- n'ont jamais pu marcher, toutes deux dues au même trou : le fournisseur d'inscription n'était
-- jamais exposé côté serveur.
--
-- 1) admin_signups_by_provider() était APPELÉE par la section "Inscriptions"
--    (src/admin/admin-economy.js) mais n'existait pas en base -> le camembert "avec quoi les
--    joueurs se sont inscrits" affichait en permanence "aucune donnée" (l'erreur était avalée par
--    le repli `provError`, donc silencieuse).
-- 2) admin_list_players() ne renvoyait AUCUNE colonne `provider`, alors que le client fait
--    `providerInfo(p.provider)` -> la colonne "plateforme" de la liste des joueurs affichait
--    toujours ❔ / "?" pour tout le monde.
--
-- Convention de valeur : auth.users.raw_app_meta_data->>'provider' vaut NULL pour les comptes
-- anonymes (vérifié : NULL <=> is_anonymous). On le normalise en 'anonymous', qui est déjà la clé
-- attendue par PROVIDER_INFO côté client (🎭 Invité) -- aucun changement client nécessaire.
-- ============================================================

-- ---------- 1) répartition des inscriptions par fournisseur ----------
create or replace function public.admin_signups_by_provider()
returns table(provider text, signups bigint)
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  return query
    select coalesce(u.raw_app_meta_data->>'provider', 'anonymous')::text, count(*)::bigint
    from auth.users u
    group by 1
    order by 2 desc;
end; $$;

revoke all on function public.admin_signups_by_provider() from public, anon;
grant execute on function public.admin_signups_by_provider() to authenticated;

-- ---------- 2) colonne `provider` dans la liste des joueurs ----------
-- DROP + CREATE obligatoire : on ajoute une colonne au RETURNS TABLE, ce que CREATE OR REPLACE
-- refuse. Le corps est repris À L'IDENTIQUE de la version en place, seule la jointure sur
-- auth.users et la colonne `provider` (en dernier, pour ne pas déplacer les colonnes existantes)
-- sont ajoutées.
drop function if exists public.admin_list_players();
create function public.admin_list_players()
returns table(user_id uuid, display_name text, silver bigint, gearscore integer, lvl integer,
              online boolean, last_seen timestamptz, best_kpm numeric, ap numeric, dp numeric,
              provider text)
language plpgsql security definer set search_path to 'public' as $$
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
    ),
    merged as (
      select v.user_id, v.display_name, v.silver, v.gearscore, v.lvl,
        (v.last_seen is not null and v.last_seen > now() - interval '90 seconds') as online,
        v.last_seen, v.best_kpm, v.ap, v.dp
      from verified v
      union all
      select g.user_id, g.display_name, g.silver, g.gearscore, g.lvl,
        (g.last_seen is not null and g.last_seen > now() - interval '90 seconds') as online,
        g.last_seen, g.best_kpm, g.ap, g.dp
      from guests g
    )
    select m.user_id, m.display_name, m.silver, m.gearscore, m.lvl, m.online, m.last_seen,
           m.best_kpm, m.ap, m.dp,
           coalesce(u.raw_app_meta_data->>'provider', 'anonymous')::text as provider
    from merged m
    left join auth.users u on u.id = m.user_id
    order by m.online desc, m.last_seen desc nulls last;
end; $$;

revoke all on function public.admin_list_players() from public, anon;
grant execute on function public.admin_list_players() to authenticated;
