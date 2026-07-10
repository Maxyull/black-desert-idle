-- Classement Public Compagnons — catégories Prestige/GS (2026-07-21, port à l'identique d'un
-- mockup externe fourni par l'utilisateur, voir CLAUDE.md §30 "Maquettes externes"). L'onglet
-- Guildes du mockup est volontairement absent : aucun système de guilde n'existe en jeu (voir
-- src/social/chat.js) — décision explicite de ne pas l'inventer pour ce classement.
--
-- companion_stats avait déjà pet_count/fusion_count/achievements_count/caphras_upgrade_count/
-- breakthrough_count/silver -- tous les ingrédients de prestigeScore() (companions.achievements.js)
-- SAUF la somme GS+tier par pet (Σ normGS(p) + tier*20) et le GS max, qui nécessitent d'itérer le
-- roster complet -- ajoutés ici comme 2 nouveaux compteurs agrégés, même pattern que les colonnes
-- existantes (agrégat côté client à la sync, jamais le détail nominatif de chaque pet, voir
-- companions/README.md "économie fermée").
alter table public.companion_stats add column if not exists gs_sum_with_tier bigint not null default 0;
alter table public.companion_stats add column if not exists gs_max int not null default 0;

-- remplace sync_companion_stats (15 params) par une version à 17 params -- DROP obligatoire de
-- l'ancienne signature avant recréation (règle du projet : sinon ambiguïté de surcharge).
drop function if exists public.sync_companion_stats(int, bigint, int, int, int, int, int, int, boolean, jsonb, jsonb, jsonb, int, int, int);

create or replace function public.sync_companion_stats(
  p_pet_count int, p_silver bigint, p_hatch_count int, p_fusion_count int,
  p_caphras_upgrade_count int, p_breakthrough_count int, p_achievements_count int,
  p_login_streak int, p_pity_triggered boolean,
  p_rarity_breakdown jsonb default '{}'::jsonb, p_tier_breakdown jsonb default '{}'::jsonb,
  p_section_breakdown jsonb default '{}'::jsonb, p_hard_achievements_count int default 0,
  p_fusion_downgrade_count int default 0, p_unique_species_count int default 0,
  p_gs_sum_with_tier bigint default 0, p_gs_max int default 0
) returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  insert into public.companion_stats(
    user_id, pet_count, silver, hatch_count, fusion_count, caphras_upgrade_count,
    breakthrough_count, achievements_count, login_streak, pity_triggered,
    rarity_breakdown, tier_breakdown, section_breakdown, hard_achievements_count,
    fusion_downgrade_count, unique_species_count, gs_sum_with_tier, gs_max, updated_at, created_at
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
    least(greatest(coalesce(p_gs_sum_with_tier, 0), 0), 500000),
    least(greatest(coalesce(p_gs_max, 0), 0), 2000),
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
    gs_sum_with_tier = excluded.gs_sum_with_tier, gs_max = excluded.gs_max,
    updated_at = now();
    -- created_at n'est JAMAIS réécrit lors d'un conflit (voir migration précédente).
end;
$function$;
grant execute on function public.sync_companion_stats(int, bigint, int, int, int, int, int, int, boolean, jsonb, jsonb, jsonb, int, int, int, bigint, int) to authenticated;

-- companion_leaderboard() enrichi : prestige_score calculé EXACTEMENT comme prestigeScore()
-- (companions.achievements.js) à partir des agrégats stockés -- achievements*250 + Σ(GS+tier*20)
-- + fusions*15 + caphras*10 + percées*100 + silver/100 -- plus gs_max (catégorie GS du mockup).
-- Tri fixe par prestige_score : les 3 autres catégories du mockup (GS/Fusions/Achievements) sont
-- re-triées CÔTÉ CLIENT sur les mêmes 100 lignes (pas de 2e round-trip, pas de SQL dynamique/
-- injection sur un ORDER BY paramétré).
drop function if exists public.companion_leaderboard();
create or replace function public.companion_leaderboard()
returns table(
  user_id uuid, display_name text, pet_count int, fusion_count int,
  hatch_count int, unique_species_count int, achievements_count int,
  gs_max int, prestige_score bigint
)
language sql security definer set search_path to 'public'
as $$
  select cs.user_id, coalesce(pr.pseudo, ps.display_name, '?') as display_name,
    cs.pet_count, cs.fusion_count, cs.hatch_count, cs.unique_species_count, cs.achievements_count,
    cs.gs_max,
    (cs.achievements_count::bigint * 250 + cs.gs_sum_with_tier + cs.fusion_count::bigint * 15
      + cs.caphras_upgrade_count::bigint * 10 + cs.breakthrough_count::bigint * 100
      + (cs.silver / 100)) as prestige_score
  from public.companion_stats cs
  left join public.profiles pr on pr.user_id = cs.user_id
  left join public.player_stats ps on ps.user_id = cs.user_id
  order by prestige_score desc
  limit 100;
$$;
grant execute on function public.companion_leaderboard() to authenticated;
