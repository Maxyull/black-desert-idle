-- Stats admin Compagnon (2026-07-20, demande explicite : "affichger stats pour oeuf, moyenne
-- doeuf eclos/jour, stats entiere liste des fusion et grph completion index") -- ajoute ce qu'il
-- manquait pour calculer une moyenne d'éclosions/jour (besoin d'un vrai point de départ par
-- joueur, jusqu'ici `updated_at` était réécrit à CHAQUE sync -- donc inutilisable comme référence
-- temporelle) et une complétion d'Index (combien d'espèces DIFFÉRENTES du catalogue possédées,
-- jamais transmis avant -- seuls les compteurs par rareté/tier/section l'étaient).
alter table public.companion_stats add column if not exists created_at timestamptz not null default now();
alter table public.companion_stats add column if not exists unique_species_count int not null default 0;

-- remplace sync_companion_stats (14 params) par une version à 15 params -- DROP obligatoire de
-- l'ancienne signature avant recréation (règle du projet : sinon ambiguïté de surcharge).
drop function if exists public.sync_companion_stats(int, bigint, int, int, int, int, int, int, boolean, jsonb, jsonb, jsonb, int, int);

create or replace function public.sync_companion_stats(
  p_pet_count int, p_silver bigint, p_hatch_count int, p_fusion_count int,
  p_caphras_upgrade_count int, p_breakthrough_count int, p_achievements_count int,
  p_login_streak int, p_pity_triggered boolean,
  p_rarity_breakdown jsonb default '{}'::jsonb, p_tier_breakdown jsonb default '{}'::jsonb,
  p_section_breakdown jsonb default '{}'::jsonb, p_hard_achievements_count int default 0,
  p_fusion_downgrade_count int default 0, p_unique_species_count int default 0
) returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  insert into public.companion_stats(
    user_id, pet_count, silver, hatch_count, fusion_count, caphras_upgrade_count,
    breakthrough_count, achievements_count, login_streak, pity_triggered,
    rarity_breakdown, tier_breakdown, section_breakdown, hard_achievements_count,
    fusion_downgrade_count, unique_species_count, updated_at, created_at
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
    coalesce(p_rarity_breakdown, '{}'::jsonb),
    coalesce(p_tier_breakdown, '{}'::jsonb),
    coalesce(p_section_breakdown, '{}'::jsonb),
    least(greatest(coalesce(p_hard_achievements_count, 0), 0), 100),
    least(greatest(coalesce(p_fusion_downgrade_count, 0), 0), 100000),
    least(greatest(coalesce(p_unique_species_count, 0), 0), 200),
    now(),
    now()
  )
  on conflict (user_id) do update set
    pet_count = excluded.pet_count, silver = excluded.silver, hatch_count = excluded.hatch_count,
    fusion_count = excluded.fusion_count, caphras_upgrade_count = excluded.caphras_upgrade_count,
    breakthrough_count = excluded.breakthrough_count, achievements_count = excluded.achievements_count,
    login_streak = excluded.login_streak, pity_triggered = excluded.pity_triggered,
    rarity_breakdown = excluded.rarity_breakdown, tier_breakdown = excluded.tier_breakdown,
    section_breakdown = excluded.section_breakdown, hard_achievements_count = excluded.hard_achievements_count,
    fusion_downgrade_count = excluded.fusion_downgrade_count, unique_species_count = excluded.unique_species_count,
    updated_at = now();
    -- created_at n'est JAMAIS réécrit lors d'un conflit -- reste la date du tout premier sync de ce
    -- joueur, seule vraie référence temporelle disponible pour "moyenne d'éclosions/jour".
end;
$function$;
grant execute on function public.sync_companion_stats(int, bigint, int, int, int, int, int, int, boolean, jsonb, jsonb, jsonb, int, int, int) to authenticated;

-- admin_companion_stats() enrichi : moyenne d'éclosions/jour (par joueur, PUIS moyennée -- plus
-- juste qu'un total/jours globaux, qui écraserait les joueurs récents) + moyenne de complétion Index.
drop function if exists public.admin_companion_stats();
create or replace function public.admin_companion_stats()
 returns table(
   players_synced bigint, total_pet_count bigint, avg_pet_count numeric,
   total_silver bigint, total_hatch_count bigint, total_fusion_count bigint,
   avg_login_streak numeric, players_with_pity bigint, avg_achievements numeric,
   avg_hard_achievements numeric, total_fusion_downgrade bigint,
   avg_hatch_per_day numeric, avg_unique_species numeric
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
      coalesce(avg(achievements_count), 0)::numeric,
      coalesce(avg(hard_achievements_count), 0)::numeric,
      coalesce(sum(fusion_downgrade_count), 0)::bigint,
      coalesce(avg(hatch_count::numeric / greatest(1, extract(epoch from (now() - created_at)) / 86400)), 0)::numeric,
      coalesce(avg(unique_species_count), 0)::numeric
    from public.companion_stats;
end;
$function$;
grant execute on function public.admin_companion_stats() to authenticated;

-- liste par joueur (2026-07-20) : jusqu'ici admin_companion_breakdown() ne renvoyait QUE les
-- répartitions rareté/tier/section, sans user_id -- impossible d'en faire une "liste des fusions
-- par joueur" nominative. Nouvelle RPC dédiée plutôt que d'élargir admin_companion_breakdown()
-- (garde chaque RPC focalisée, même esprit que admin_list_players/admin_wealth séparés).
create or replace function public.admin_companion_player_list()
 returns table(
   user_id uuid, hatch_count int, fusion_count int, breakthrough_count int,
   fusion_downgrade_count int, unique_species_count int, created_at timestamptz
 )
 language plpgsql security definer set search_path to 'public'
as $function$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Réservé au staff';
  end if;
  return query
    select cs.user_id, cs.hatch_count, cs.fusion_count, cs.breakthrough_count,
           cs.fusion_downgrade_count, cs.unique_species_count, cs.created_at
    from public.companion_stats cs
    order by cs.fusion_count desc;
end;
$function$;
grant execute on function public.admin_companion_player_list() to authenticated;
