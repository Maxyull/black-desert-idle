-- ============================================================
-- Correctifs M2 et L3 de l'issue GitHub #4 (2026-07-14).
--
-- M2 : silver_ledger acceptait n'importe quel delta/category tant que user_id correspondait
-- (registre purement déclaratif, jamais recoupé avec un vrai calcul serveur). N'enrichit pas
-- directement le joueur (le ledger ne redonne jamais de silver), mais rendait le journal
-- anti-triche contournable/maquillable. Ajoute une contrainte CHECK sur category (whitelist des
-- catégories réellement utilisées côté client, voir addSilver()) et une borne sur |delta|.
--
-- L3 : get_online_players/get_zone_player_counts acceptaient un p_window_seconds client sans
-- plafond. Impact réel très faible (données déjà publiques), mais autant fermer la porte.
-- ============================================================

alter table public.silver_ledger drop constraint if exists silver_ledger_category_check;
alter table public.silver_ledger add constraint silver_ledger_category_check
  check (category in ('loot','potion','sell','quest','achievement','welcome','admin_test','boss','undo_sell','market_buy','market_sell','market_refund'));

alter table public.silver_ledger drop constraint if exists silver_ledger_delta_check;
alter table public.silver_ledger add constraint silver_ledger_delta_check
  check (delta between -1000000000000 and 1000000000000);

create or replace function public.get_online_players(p_window_seconds integer default 90)
returns table(pseudo text)
language sql
security definer
set search_path to 'public'
as $$
  select distinct coalesce(pr.pseudo, ps.display_name) as pseudo
  from public.presence p
  left join public.profiles pr on pr.user_id = p.user_id
  left join public.player_stats ps on ps.user_id = p.user_id
  where p.last_seen > now() - (least(coalesce(p_window_seconds, 90), 300) || ' seconds')::interval
    and not p.is_guest
    and coalesce(pr.pseudo, ps.display_name) is not null;
$$;

create or replace function public.get_zone_player_counts(p_window_seconds integer default 90)
returns table(zone_idx integer, cnt integer)
language sql security definer
set search_path to 'public'
as $$
  select p.zone_idx, count(*)::int as cnt
  from public.presence p
  where p.last_seen > now() - (least(coalesce(p_window_seconds, 90), 300) || ' seconds')::interval
    and p.zone_idx is not null
  group by p.zone_idx;
$$;
