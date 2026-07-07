-- ============================================================
-- Avertit l'admin si le joueur ciblé par "Réinitialiser ce joueur" est actuellement en ligne
-- (2026-07-16, demande explicite : "oui averti le joueurs pour le reset" -- suite à la vérification
-- du flux de reset par UUID : si le joueur est connecté au moment du reset, son propre client garde
-- son ancien état en mémoire et le RÉÉCRIT dans game_saves à la prochaine sauvegarde automatique
-- (30s ou quasi chaque action), annulant silencieusement le reset en quelques secondes -- rien
-- n'avertissait l'admin de ce risque avant de confirmer).
--
-- Réutilise la même fenêtre de présence (90s) que get_zone_player_counts/get_online_players,
-- réservé au staff comme les autres fonctions admin_*.
--
-- Supabase > SQL Editor > New query > Run
-- ============================================================

create or replace function public.admin_is_player_online(p_user_id uuid, p_window_seconds integer default 90)
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.presence p
    where p.user_id = p_user_id
      and p.last_seen > now() - (least(coalesce(p_window_seconds, 90), 300) || ' seconds')::interval
  )
  where coalesce((select auth.jwt()->>'email'), '') = 'maxime.lacoste@icloud.com';
$$;
grant execute on function public.admin_is_player_online(uuid, integer) to authenticated;
