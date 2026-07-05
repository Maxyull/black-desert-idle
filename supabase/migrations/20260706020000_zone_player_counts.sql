-- ============================================================
-- Affiche combien de joueurs sont actuellement dans chaque zone de farm (demande explicite du
-- 2026-07-06 : "afficher... un nombre et un icone qui explique que c'est les joueurs sur la
-- zone"). Réutilise la table "presence" déjà en place (heartbeat toutes les 20s, voir
-- heartbeat_presence côté client) en lui ajoutant la zone courante du joueur.
--
-- Supabase > SQL Editor > New query > Run
-- ============================================================

alter table public.presence add column if not exists zone_idx integer;

create or replace function public.heartbeat_presence(p_is_guest boolean, p_zone_idx integer default null)
returns void
language plpgsql security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;
  insert into public.presence (user_id, is_guest, last_seen, zone_idx)
  values (auth.uid(), p_is_guest, now(), p_zone_idx)
  on conflict (user_id) do update set is_guest = excluded.is_guest, last_seen = now(), zone_idx = excluded.zone_idx;
end;
$$;

create or replace function public.get_zone_player_counts(p_window_seconds integer default 90)
returns table(zone_idx integer, cnt integer)
language sql security definer
set search_path to 'public'
as $$
  select p.zone_idx, count(*)::int as cnt
  from public.presence p
  where p.last_seen > now() - (p_window_seconds || ' seconds')::interval
    and p.zone_idx is not null
  group by p.zone_idx;
$$;
