-- Classement cross-joueurs du module Compagnon (2026-07-20, demande explicite : "ajouter
-- classement... cross-joueurs"). Contrairement aux RPC admin_* (migration précédente), PAS de
-- garde email -- accessible à tout compte authentifié non-invité, même pattern que
-- get_online_players() (public.profiles.pseudo en priorité, repli sur player_stats.display_name,
-- jamais les invités).
create or replace function public.companion_leaderboard()
returns table(
  user_id uuid, display_name text, pet_count int, fusion_count int,
  hatch_count int, unique_species_count int, achievements_count int
)
language sql security definer set search_path to 'public'
as $$
  select cs.user_id, coalesce(pr.pseudo, ps.display_name, '?') as display_name,
    cs.pet_count, cs.fusion_count, cs.hatch_count, cs.unique_species_count, cs.achievements_count
  from public.companion_stats cs
  left join public.profiles pr on pr.user_id = cs.user_id
  left join public.player_stats ps on ps.user_id = cs.user_id
  order by cs.pet_count desc
  limit 100;
$$;
grant execute on function public.companion_leaderboard() to authenticated;
