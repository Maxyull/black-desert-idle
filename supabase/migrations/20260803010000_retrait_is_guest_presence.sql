-- Retrait de `is_guest` de la présence (suite de l'issue #18).
--
-- Le mode invité a été entièrement supprimé le 2026-08-03 : code retiré (PR #94) et 127 comptes
-- anonymes purgés des deux côtés. Il restait la trace côté base : un paramètre `p_is_guest` que
-- le client envoyait toujours à `false`, une colonne `presence.is_guest` uniformément fausse sur
-- les 24 lignes vivantes, et trois fonctions qui exposaient encore un décompte d'invités
-- structurellement nul.
--
-- Cette migration retire tout ça. Elle touche cinq fonctions et une colonne, dans cet ordre :
-- les fonctions d'abord, la colonne ensuite, sinon le DROP COLUMN échoue sur les dépendances.
--
-- ⚠️ COMPATIBILITÉ DES CLIENTS DÉJÀ CHARGÉS. PostgREST résout une RPC par les NOMS des clés du
-- corps JSON. Un onglet ouvert avant ce déploiement continue d'envoyer `{p_is_guest, p_zone_idx}` :
-- sans surcharge de compatibilité il recevrait un PGRST202 et perdrait sa présence jusqu'au
-- rechargement. On garde donc une surcharge à deux paramètres qui ignore le premier et délègue.
-- Elle est datée : à supprimer après le 2026-08-10, quand plus aucun client de la V498 ne tourne.
--
-- Ses deux paramètres sont volontairement SANS valeur par défaut, contrairement à la fonction
-- d'origine : sinon un appel sans argument deviendrait ambigu entre les deux surcharges. Aucun
-- appelant ne fait ça, mais autant que la base refuse par construction plutôt qu'à l'exécution.

begin;

-- ---------------------------------------------------------------- heartbeat_presence
drop function if exists public.heartbeat_presence(boolean, integer);

create function public.heartbeat_presence(p_zone_idx integer default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;
  insert into public.presence (user_id, last_seen, zone_idx)
  values (auth.uid(), now(), p_zone_idx)
  on conflict (user_id) do update set last_seen = now(), zone_idx = excluded.zone_idx;
end;
$$;

-- Surcharge de compatibilité, temporaire. Voir l'avertissement en tête de fichier.
create function public.heartbeat_presence(p_is_guest boolean, p_zone_idx integer)
returns void
language sql
security definer
set search_path = public
as $$
  select public.heartbeat_presence(p_zone_idx);
$$;

-- ---------------------------------------------------------------- get_online_counts
-- Le type de retour change (la colonne `guests` disparaît), d'où le DROP obligatoire.
-- Ses deux appelants, admin-panel.js et presence.js, ne lisaient déjà que `total`.
drop function if exists public.get_online_counts(integer);

create function public.get_online_counts(p_window_seconds integer default 90)
returns table(total integer, verified integer)
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int as total,
         count(*)::int as verified
  from public.presence
  where last_seen > now() - (least(coalesce(p_window_seconds, 90), 300) || ' seconds')::interval;
$$;

-- `verified` est conservée et vaut désormais `total` : tous les comptes présents sont vérifiés,
-- puisqu'il n'existe plus d'autre sorte de compte. La garder évite de casser un éventuel
-- consommateur externe, et elle dit toujours la vérité.

-- ---------------------------------------------------------------- get_online_players
-- Le filtre `and not p.is_guest` devient sans objet.
create or replace function public.get_online_players(p_window_seconds integer default 90)
returns table(pseudo text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct coalesce(pr.pseudo, ps.display_name) as pseudo
  from public.presence p
  left join public.profiles pr on pr.user_id = p.user_id
  left join public.player_stats ps on ps.user_id = p.user_id
  where p.last_seen > now() - (least(coalesce(p_window_seconds, 90), 300) || ' seconds')::interval
    and coalesce(pr.pseudo, ps.display_name) is not null;
$$;

-- ---------------------------------------------------------------- get_velia_players
-- Le type de retour change (la colonne `is_guest` disparaît), d'où le DROP.
-- Le repli de pseudo passe de « Invité-xxxxxx » à « Joueur-xxxxxx » : il ne servait pas qu'aux
-- invités, il couvre tout compte sans pseudo ni display_name, ce qui reste possible juste après
-- une inscription tant que set_pseudo n'a pas été appelée.
drop function if exists public.get_velia_players(integer);

create function public.get_velia_players(p_window_seconds integer default 90)
returns table(pseudo text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct
    coalesce(pr.pseudo, ps.display_name, 'Joueur-' || left(p.user_id::text, 6)) as pseudo
  from public.presence p
  left join public.profiles pr on pr.user_id = p.user_id
  left join public.player_stats ps on ps.user_id = p.user_id
  where p.last_seen > now() - (least(coalesce(p_window_seconds, 90), 300) || ' seconds')::interval
    and p.zone_idx = -1
  order by pseudo;
$$;

-- ---------------------------------------------------------------- get_presence_snapshot
-- Renvoie du jsonb, donc la forme change sans que le type de retour bouge : pas de DROP.
-- Deux champs disparaissent du document, `online.guests` et `velia[].is_guest`.
create or replace function public.get_presence_snapshot(p_window_seconds integer default 90)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with win as (
    select now() - (least(coalesce(p_window_seconds, 90), 300) || ' seconds')::interval as since
  ),
  live as (
    select p.user_id, p.zone_idx
    from public.presence p, win
    where p.last_seen > win.since
  )
  select jsonb_build_object(
    'online', (
      select jsonb_build_object(
        'total',    count(*)::int,
        'verified', count(*)::int
      ) from live
    ),
    'zones', (
      select coalesce(jsonb_agg(jsonb_build_object('zone_idx', z.zone_idx, 'cnt', z.cnt)), '[]'::jsonb)
      from (
        select zone_idx, count(*)::int as cnt
        from live
        where zone_idx is not null
        group by zone_idx
      ) z
    ),
    'admin_zone', (
      select l.zone_idx
      from live l
      join auth.users u on u.id = l.user_id
      where u.email = 'maxime.lacoste@icloud.com'
        and l.zone_idx is not null
      limit 1
    ),
    'velia', (
      select coalesce(jsonb_agg(jsonb_build_object('pseudo', v.pseudo) order by v.pseudo), '[]'::jsonb)
      from (
        select distinct
          coalesce(pr.pseudo, ps.display_name, 'Joueur-' || left(l.user_id::text, 6)) as pseudo
        from live l
        left join public.profiles pr on pr.user_id = l.user_id
        left join public.player_stats ps on ps.user_id = l.user_id
        where l.zone_idx = -1
      ) v
    )
  );
$$;

-- ---------------------------------------------------------------- la colonne
-- En dernier : tant qu'une fonction la lit, ce DROP échouerait.
alter table public.presence drop column if exists is_guest;

-- ---------------------------------------------------------------- droits
-- Les fonctions recréées par DROP + CREATE ont perdu leurs GRANT, ceux relevés avant migration
-- sont réappliqués à l'identique. `bdi_app` est le rôle en lecture des dashboards de supervision
-- (bdi-infra), absent du projet cloud : le grant y est donc conditionnel.
grant execute on function public.heartbeat_presence(integer)          to anon, authenticated, service_role;
grant execute on function public.heartbeat_presence(boolean, integer) to anon, authenticated, service_role;
grant execute on function public.get_online_counts(integer)           to anon, authenticated, service_role;
grant execute on function public.get_velia_players(integer)           to anon, authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'bdi_app') then
    grant execute on function public.heartbeat_presence(integer)          to bdi_app;
    grant execute on function public.heartbeat_presence(boolean, integer) to bdi_app;
    grant execute on function public.get_online_counts(integer)           to bdi_app;
    grant execute on function public.get_velia_players(integer)           to bdi_app;
  end if;
end $$;

commit;

-- PostgREST garde un cache du schéma et ne voit pas les nouvelles signatures tant qu'on ne le
-- lui dit pas. Sans cette notification, l'appel à un seul paramètre répond
-- « PGRST202 : Could not find the function public.heartbeat_presence(p_zone_idx) in the schema
-- cache » alors que la fonction existe bel et bien en base. Constaté sur le VPS le 2026-08-03,
-- juste après cette migration. Hors transaction, un NOTIFY émis dans un bloc annulé ne partirait
-- jamais.
notify pgrst, 'reload schema';
