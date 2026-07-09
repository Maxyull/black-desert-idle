-- Stats admin sur le module Compagnons (2026-07-19, demande explicite : "branche des stats sur
-- toutes les nouvelle fonctionnalité de compagnons dans menu admin").
--
-- Le module (src/companions/, iframe isolée) était jusqu'ici 100% local (localStorage, aucune
-- interaction Supabase) -- rien ne remontait jamais côté serveur, donc AUCUNE stat admin n'était
-- possible. Cette migration ajoute UNIQUEMENT un résumé de compteurs (jamais le roster/inventaire
-- complet, économie fermée propre au module) via une nouvelle table + RPC, poussé périodiquement
-- (60s) par src/companions/companions.sync.js.
create table if not exists public.companion_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pet_count int not null default 0,
  silver bigint not null default 0,
  hatch_count int not null default 0,
  fusion_count int not null default 0,
  caphras_upgrade_count int not null default 0,
  breakthrough_count int not null default 0,
  achievements_count int not null default 0,
  login_streak int not null default 0,
  pity_triggered boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.companion_stats enable row level security;
create policy companion_stats_own on public.companion_stats
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- bornes larges mais réelles (économie fermée, indépendante du Silver/leaderboard du jeu
-- principal -- même esprit que clamp_player_stats/clamp_game_save, pas de sanction, juste éviter
-- qu'une valeur aberrante fausse silencieusement les moyennes admin) :
-- - pet_count : catalogue = 48 familiers, marge à 200 (fusions/évolutions futures possibles)
-- - hatch/fusion/breakthrough/caphras : bornés à 100 000 (largement au-dessus de tout usage réel)
-- - achievements_count : 16 succès définis aujourd'hui, marge à 100
-- - login_streak : marge à 3650 (10 ans)
create or replace function public.sync_companion_stats(
  p_pet_count int, p_silver bigint, p_hatch_count int, p_fusion_count int,
  p_caphras_upgrade_count int, p_breakthrough_count int, p_achievements_count int,
  p_login_streak int, p_pity_triggered boolean
) returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  insert into public.companion_stats(
    user_id, pet_count, silver, hatch_count, fusion_count, caphras_upgrade_count,
    breakthrough_count, achievements_count, login_streak, pity_triggered, updated_at
  ) values (
    auth.uid(),
    least(greatest(coalesce(p_pet_count, 0), 0), 200),
    least(greatest(coalesce(p_silver, 0), 0), 100000000),
    least(greatest(coalesce(p_hatch_count, 0), 0), 100000),
    least(greatest(coalesce(p_fusion_count, 0), 0), 100000),
    least(greatest(coalesce(p_caphras_upgrade_count, 0), 0), 100000),
    least(greatest(coalesce(p_breakthrough_count, 0), 0), 100000),
    least(greatest(coalesce(p_achievements_count, 0), 0), 100),
    least(greatest(coalesce(p_login_streak, 0), 0), 3650),
    coalesce(p_pity_triggered, false),
    now()
  )
  on conflict (user_id) do update set
    pet_count = excluded.pet_count, silver = excluded.silver, hatch_count = excluded.hatch_count,
    fusion_count = excluded.fusion_count, caphras_upgrade_count = excluded.caphras_upgrade_count,
    breakthrough_count = excluded.breakthrough_count, achievements_count = excluded.achievements_count,
    login_streak = excluded.login_streak, pity_triggered = excluded.pity_triggered, updated_at = now();
end;
$function$;
grant execute on function public.sync_companion_stats(int, bigint, int, int, int, int, int, int, boolean) to authenticated;

-- vue d'ensemble admin : nb joueurs synchronisés (= ont ouvert le module au moins 1x) + moyennes/
-- totaux des compteurs clés.
create or replace function public.admin_companion_stats()
 returns table(
   players_synced bigint, total_pet_count bigint, avg_pet_count numeric,
   total_silver bigint, total_hatch_count bigint, total_fusion_count bigint,
   avg_login_streak numeric, players_with_pity bigint, avg_achievements numeric
 )
 language plpgsql security definer set search_path to 'public'
as $function$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Réservé au staff';
  end if;
  return query
    select
      count(*)::bigint,
      coalesce(sum(pet_count), 0)::bigint,
      coalesce(avg(pet_count), 0)::numeric,
      coalesce(sum(silver), 0)::bigint,
      coalesce(sum(hatch_count), 0)::bigint,
      coalesce(sum(fusion_count), 0)::bigint,
      coalesce(avg(login_streak), 0)::numeric,
      count(*) filter (where pity_triggered)::bigint,
      coalesce(avg(achievements_count), 0)::numeric
    from public.companion_stats;
end;
$function$;
grant execute on function public.admin_companion_stats() to authenticated;
