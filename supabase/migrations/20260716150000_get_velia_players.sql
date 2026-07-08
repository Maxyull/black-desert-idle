-- ============================================================
-- Liste des joueurs présents en ville (Velia) — 2026-07-16, demande explicite : "Quand on se
-- trouve dans la ville, on peut voir la liste des joueurs dans la ville a droite a la place du
-- loot ticker". Politique confirmée par l'utilisateur (AskUserQuestion) : pseudos VISIBLES pour
-- cette zone sociale précisément, contrairement au reste du jeu (get_zone_player_counts,
-- comptages agrégés seulement, voir son historique de migration/audit sécurité du 2026-07-14).
--
-- Réutilise la colonne presence.zone_idx existante avec -1 comme sentinelle "Velia" (le client
-- envoyait NULL jusqu'ici pour Velia, voir heartbeat_presence côté client dans game-supabase.js —
-- aucun changement de schéma nécessaire, zone_idx reste un entier nullable classique).
--
-- Supabase > SQL Editor > New query > Run
-- ============================================================

create or replace function public.get_velia_players(p_window_seconds integer default 90)
returns table(pseudo text, is_guest boolean)
language sql
security definer
set search_path to 'public'
as $$
  select distinct
    -- pas d'emoji ici (2026-07-16, bug corrigé) : le client préfixe déjà 🎭/👤 selon is_guest,
    -- un emoji AUSSI côté serveur donnait "🎭 🎭 Invité-xxx" en double pour un invité sans pseudo
    coalesce(pr.pseudo, ps.display_name, 'Invité-' || left(p.user_id::text, 6)) as pseudo,
    p.is_guest
  from public.presence p
  left join public.profiles pr on pr.user_id = p.user_id
  left join public.player_stats ps on ps.user_id = p.user_id
  where p.last_seen > now() - (least(coalesce(p_window_seconds, 90), 300) || ' seconds')::interval
    and p.zone_idx = -1
  order by pseudo;
$$;
grant execute on function public.get_velia_players(integer) to anon, authenticated;
