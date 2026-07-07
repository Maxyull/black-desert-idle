-- ============================================================
-- Étiquette "admin ici" visible par TOUS les joueurs (2026-07-16, demande explicite : "ettiquette
-- admin montré a tout le monde") -- jusqu'ici, purement client-side (isAdmin() + isCurrent, voir
-- le commentaire dans buildZoneList()) : ne pouvait donc s'afficher QUE sur le propre client de
-- l'admin, sur SA propre zone, faute d'un moyen serveur de savoir dans quelle zone il se trouve
-- sans exposer l'identité de TOUS les joueurs par zone (voir l'audit de sécurité du 2026-07-14,
-- get_zone_player_counts ne renvoie que des compteurs agrégés, jamais qui est où).
--
-- Cette fonction ne renvoie QUE l'index de zone où se trouve le SEUL compte admin (ou NULL) --
-- aucune identité, aucun compteur par joueur, même principe de minimisation que
-- get_zone_player_counts/get_online_players.
--
-- Supabase > SQL Editor > New query > Run
-- ============================================================

create or replace function public.get_admin_zone(p_window_seconds integer default 90)
returns integer
language sql
security definer
set search_path to 'public'
as $$
  select p.zone_idx
  from public.presence p
  join auth.users u on u.id = p.user_id
  where u.email = 'maxime.lacoste@icloud.com'
    and p.last_seen > now() - (least(coalesce(p_window_seconds, 90), 300) || ' seconds')::interval
    and p.zone_idx is not null
  limit 1;
$$;
grant execute on function public.get_admin_zone(integer) to anon, authenticated;
