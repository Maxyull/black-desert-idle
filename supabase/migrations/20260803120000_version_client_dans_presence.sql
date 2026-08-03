-- La présence porte désormais la version du bundle que le client fait tourner.
--
-- POURQUOI. Le 2026-08-03, une joueuse est restée 11 h 30 sur la V497 alors que la V498 était
-- déployée depuis 9 heures, et sa progression a fini dans la base du cloud que le jeu ne lit plus
-- depuis la bascule VPS. Le correctif client est parti (PR #105, V499), mais quand il a fallu
-- VÉRIFIER qu'elle était bien repassée sur une version à jour, la réponse a été : impossible.
--
-- Rien n'enregistrait la version d'un client connecté. La seule colonne qui portait une version de
-- bundle était `client_errors.game_version`, écrite uniquement quand un client lève une erreur JS
-- -- un journal d'incidents, pas un signal de présence -- et dont le `user_id` est TOUJOURS null
-- (le client ne l'envoie pas, c'est ce qui permet à un client sans session valide d'y écrire).
-- Autrement dit : ni « qui », ni « quand », ni « pendant qu'il jouait ».
--
-- `presence` est le bon endroit : le client y écrit déjà toutes les 20 s, la ligne est par joueur,
-- et toutes les lectures existantes filtrent déjà sur `last_seen`. Une version périmée devient
-- donc visible en moins d'une minute, au lieu d'être signalée à la main 11 heures plus tard.
--
-- ⚠️ COMPATIBILITÉ DES CLIENTS DÉJÀ CHARGÉS -- la leçon de 20260803010000, qui vaut à nouveau ici.
-- PostgREST résout une RPC par les NOMS des clés du corps JSON. Tous les onglets ouverts sur la
-- V499 continuent d'envoyer `{p_zone_idx}` seul : la signature à un paramètre est donc CONSERVÉE
-- telle quelle. La nouvelle signature prend `(p_zone_idx, p_version)`, et ses deux paramètres sont
-- volontairement SANS valeur par défaut -- sinon un appel `{p_zone_idx}` deviendrait ambigu entre
-- les deux surcharges, exactement le piège de 20260706030000 (heartbeat en échec en boucle, joueur
-- qui disparaît du compteur « en ligne »).
--
-- ORDRE DE DÉPLOIEMENT, IMPÉRATIF : cette migration part sur le VPS *et* sur le cloud AVANT que le
-- client qui envoie `p_version` ne soit publié. Le cloud n'est pas facultatif : c'est la cible de
-- retour arrière (`DATA_API_URL = ''`, voir game-supabase.js), et un rollback vers un cloud sans
-- cette fonction casserait la présence de tout le monde. Le client garde malgré tout un repli sur
-- l'appel à un paramètre (heartbeatPresence, presence.js) : une base en retard doit dégrader la
-- télémétrie, jamais la présence elle-même.

begin;

-- ---------------------------------------------------------------- la colonne
-- Nullable et sans défaut : NULL veut dire « ce client est trop ancien pour se déclarer », ce qui
-- est en soi l'information intéressante (c'est le profil exact de la joueuse restée bloquée).
alter table public.presence add column if not exists game_version text;

comment on column public.presence.game_version is
  'Version du bundle que ce client fait tourner (PATCH_NOTES[0].v). NULL = client antérieur à la V500, qui ne se déclare pas. Toujours lire avec un filtre sur last_seen : la ligne survit à la déconnexion.';

-- ---------------------------------------------------------------- heartbeat_presence
-- Nouvelle signature. Le corps est celui de la version à un paramètre, plus la version.
create or replace function public.heartbeat_presence(p_zone_idx integer, p_version text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;
  insert into public.presence (user_id, last_seen, zone_idx, game_version)
  values (auth.uid(), now(), p_zone_idx, nullif(left(coalesce(p_version, ''), 16), ''))
  on conflict (user_id) do update
    set last_seen    = now(),
        zone_idx     = excluded.zone_idx,
        -- coalesce : un heartbeat sans version (client V499 encore ouvert) ne doit pas EFFACER
        -- une version déjà connue. `left(...,16)` borne ce que le client peut écrire : c'est une
        -- chaîne qu'il fournit librement, elle n'a aucune raison de dépasser « V1234 ».
        game_version = coalesce(excluded.game_version, presence.game_version);
end;
$$;

-- La signature à un paramètre est CONSERVÉE (clients V499 déjà chargés). Elle délègue, pour qu'il
-- n'y ait qu'un seul corps à maintenir, et n'écrit donc jamais de version.
create or replace function public.heartbeat_presence(p_zone_idx integer default null)
returns void
language sql
security definer
set search_path = public
as $$
  select public.heartbeat_presence(p_zone_idx, null::text);
$$;

-- La surcharge de compatibilité `(boolean, integer)` de 20260803010000 reste en place, inchangée :
-- elle est datée du 2026-08-10 et n'est pas concernée ici.

-- ---------------------------------------------------------------- lecture admin
-- Patron des RPC admin déjà en place (cf. admin_client_errors_summary) : SECURITY DEFINER,
-- search_path figé, garde e-mail staff faite À L'INTÉRIEUR de la fonction, lecture seule.
create or replace function public.admin_client_versions(p_window_seconds integer default 300)
returns table(game_version text, joueurs bigint, plus_ancien_vu timestamptz)
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  return query
    select coalesce(p.game_version, '?')::text,
           count(*)::bigint,
           min(p.last_seen)
    from presence p
    where p.last_seen > now() - (least(greatest(coalesce(p_window_seconds, 300), 30), 86400) || ' seconds')::interval
    group by 1
    order by 2 desc, 1 desc;
end; $$;

-- ---------------------------------------------------------------- droits
-- `create or replace` conserve les GRANT existants, mais heartbeat_presence(integer, text) et
-- admin_client_versions sont neuves : elles n'en ont aucun. Le grant sur la 1re suit à l'identique
-- celui de la signature à un paramètre (20260803010000). Pour l'admin, revoke public+anon PUIS
-- grant authenticated : Supabase accorde anon par défaut, et un `revoke from public` seul
-- laisserait anon=true (piège relevé dans 20260724230000).
grant execute on function public.heartbeat_presence(integer, text) to anon, authenticated, service_role;

revoke all on function public.admin_client_versions(integer) from public, anon;
grant execute on function public.admin_client_versions(integer) to authenticated;

-- `bdi_app` est le rôle en lecture des dashboards de supervision (bdi-infra), absent du projet
-- cloud : le grant y est donc conditionnel, comme dans 20260803010000.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'bdi_app') then
    grant execute on function public.heartbeat_presence(integer, text) to bdi_app;
  end if;
end $$;

commit;

-- PostgREST garde un cache du schéma et ne verrait pas la nouvelle signature : sans ce NOTIFY,
-- l'appel `{p_zone_idx, p_version}` répond « PGRST202 : Could not find the function
-- public.heartbeat_presence(p_version, p_zone_idx) in the schema cache » alors que la fonction
-- existe bel et bien. Constaté sur le VPS le 2026-08-03 après la migration précédente.
-- Hors transaction : un NOTIFY émis dans un bloc annulé ne partirait jamais.
notify pgrst, 'reload schema';
