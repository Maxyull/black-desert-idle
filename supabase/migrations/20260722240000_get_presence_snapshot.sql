-- Snapshot de présence groupé (2026-07-22, audit perf P1) : réunit en UNE lecture ce que 4 RPC
-- séparés (get_online_counts, get_zone_player_counts, get_admin_zone, get_velia_players)
-- renvoyaient en 4 allers-retours réseau, tous appelés toutes les 20 s par CHAQUE joueur actif.
-- Même table (presence), même fenêtre (90 s) -> une seule lecture, agrégée en JSON.
-- Avec N joueurs : on passe de N×4 à N×1 requête de lecture toutes les 20 s.
--
-- FIDÉLITÉ AU COMPORTEMENT EXISTANT (choix délibéré) : reproduit EXACTEMENT ce que les 4 RPC
-- renvoient aujourd'hui, sans "améliorer" au passage.
--   * 'verified' conservé bien qu'aucun appelant ne le lise : la parité est là si on l'utilise.
--   * les zones ne filtrent PAS zone_idx = -1 (Velia), comme get_zone_player_counts : le client
--     range tout dans zonePlayerCounts et ne lit que 0..N, l'entrée -1 est inerte. La filtrer
--     aurait été un changement de contrat pour économiser une ligne.
-- Seule différence assumée : fenêtre bornée à 300 s comme dans 3 des 4 fonctions
-- (get_online_counts ne bornait pas -- incohérence corrigée ici, dans le sens sûr).
--
-- SÉCURITÉ : aucune donnée nouvelle. L'email admin en dur et les pseudos Velia viennent tels quels
-- de get_admin_zone / get_velia_players, déjà accessibles à anon. Les zones restent des COMPTEURS
-- agrégés, sans identité (audit sécurité du 2026-07-14).
--
-- Ne remplace PAS les 4 fonctions d'origine : encore utilisées ponctuellement (get_online_counts
-- par admin-panel.js, get_velia_players à l'entrée en ville).
create or replace function public.get_presence_snapshot(p_window_seconds integer default 90)
returns jsonb
language sql
security definer
set search_path to 'public'
stable
as $fn$
  with win as (
    select now() - (least(coalesce(p_window_seconds, 90), 300) || ' seconds')::interval as since
  ),
  live as (
    select p.user_id, p.is_guest, p.zone_idx
    from public.presence p, win
    where p.last_seen > win.since
  )
  select jsonb_build_object(
    'online', (
      select jsonb_build_object(
        'total',    count(*)::int,
        'guests',   count(*) filter (where is_guest)::int,
        'verified', count(*) filter (where not is_guest)::int
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
      select coalesce(jsonb_agg(jsonb_build_object('pseudo', v.pseudo, 'is_guest', v.is_guest) order by v.pseudo), '[]'::jsonb)
      from (
        select distinct
          coalesce(pr.pseudo, ps.display_name, 'Invité-' || left(l.user_id::text, 6)) as pseudo,
          l.is_guest
        from live l
        left join public.profiles pr on pr.user_id = l.user_id
        left join public.player_stats ps on ps.user_id = l.user_id
        where l.zone_idx = -1
      ) v
    )
  );
$fn$;

grant execute on function public.get_presence_snapshot(integer) to anon, authenticated;
