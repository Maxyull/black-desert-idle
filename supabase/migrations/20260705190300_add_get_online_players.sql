-- ============================================================
-- Liste des pseudos actuellement en ligne -- demande explicite du 2026-07-05 (mentions @joueur
-- dans le chat). Meme fenetre que get_online_counts (90s). Exclut les invites (pas de pseudo fiable
-- a mentionner) et les entrees sans pseudo resolu.
--
-- Supabase > SQL Editor > New query > Run (deja applique en prod le 2026-07-05)
-- ============================================================

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
  where p.last_seen > now() - (p_window_seconds || ' seconds')::interval
    and not p.is_guest
    and coalesce(pr.pseudo, ps.display_name) is not null;
$$;
grant execute on function public.get_online_players(integer) to authenticated;
