-- Enrichit companion_stats avec des répartitions détaillées (2026-07-20, demande explicite :
-- "ajouter des compteur graphic lié supabase, pet par tier, rareté, catégorie, et tout ce qui se
-- genere dans compagnon") -- pour alimenter de vrais graphiques admin (camemberts rareté/section,
-- barres par tier) sans stocker le détail nominatif de chaque pet (juste des compteurs agrégés
-- par joueur, en JSONB -- {"0":3,"1":5,...} par rareté/tier/section).
alter table public.companion_stats add column if not exists rarity_breakdown jsonb not null default '{}'::jsonb;
alter table public.companion_stats add column if not exists tier_breakdown jsonb not null default '{}'::jsonb;
alter table public.companion_stats add column if not exists section_breakdown jsonb not null default '{}'::jsonb;
alter table public.companion_stats add column if not exists hard_achievements_count int not null default 0;
alter table public.companion_stats add column if not exists fusion_downgrade_count int not null default 0;

-- remplace sync_companion_stats (9 params) par une version à 14 params -- DROP obligatoire de
-- l'ancienne signature avant recréation (règle du projet : sinon ambiguïté de surcharge).
drop function if exists public.sync_companion_stats(int, bigint, int, int, int, int, int, int, boolean);

create or replace function public.sync_companion_stats(
  p_pet_count int, p_silver bigint, p_hatch_count int, p_fusion_count int,
  p_caphras_upgrade_count int, p_breakthrough_count int, p_achievements_count int,
  p_login_streak int, p_pity_triggered boolean,
  p_rarity_breakdown jsonb default '{}'::jsonb, p_tier_breakdown jsonb default '{}'::jsonb,
  p_section_breakdown jsonb default '{}'::jsonb, p_hard_achievements_count int default 0,
  p_fusion_downgrade_count int default 0
) returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  insert into public.companion_stats(
    user_id, pet_count, silver, hatch_count, fusion_count, caphras_upgrade_count,
    breakthrough_count, achievements_count, login_streak, pity_triggered,
    rarity_breakdown, tier_breakdown, section_breakdown, hard_achievements_count,
    fusion_downgrade_count, updated_at
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
    now()
  )
  on conflict (user_id) do update set
    pet_count = excluded.pet_count, silver = excluded.silver, hatch_count = excluded.hatch_count,
    fusion_count = excluded.fusion_count, caphras_upgrade_count = excluded.caphras_upgrade_count,
    breakthrough_count = excluded.breakthrough_count, achievements_count = excluded.achievements_count,
    login_streak = excluded.login_streak, pity_triggered = excluded.pity_triggered,
    rarity_breakdown = excluded.rarity_breakdown, tier_breakdown = excluded.tier_breakdown,
    section_breakdown = excluded.section_breakdown, hard_achievements_count = excluded.hard_achievements_count,
    fusion_downgrade_count = excluded.fusion_downgrade_count, updated_at = now();
end;
$function$;
grant execute on function public.sync_companion_stats(int, bigint, int, int, int, int, int, int, boolean, jsonb, jsonb, jsonb, int, int) to authenticated;

-- admin_companion_stats() enrichi (mêmes agrégats qu'avant + les 2 nouveaux compteurs) -- même
-- si aucun paramètre ne change (donc pas d'ambiguïté de surcharge), Postgres exige quand même un
-- DROP explicite ici car le TYPE DE RETOUR change (colonnes en plus dans le TABLE(...) de sortie) :
-- "cannot change return type of existing function" sinon.
drop function if exists public.admin_companion_stats();
create or replace function public.admin_companion_stats()
 returns table(
   players_synced bigint, total_pet_count bigint, avg_pet_count numeric,
   total_silver bigint, total_hatch_count bigint, total_fusion_count bigint,
   avg_login_streak numeric, players_with_pity bigint, avg_achievements numeric,
   avg_hard_achievements numeric, total_fusion_downgrade bigint
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
      coalesce(sum(fusion_downgrade_count), 0)::bigint
    from public.companion_stats;
end;
$function$;
grant execute on function public.admin_companion_stats() to authenticated;

-- funnel/répartitions brutes (2026-07-20) : une ligne par joueur synchronisé, agrégées CÔTÉ CLIENT
-- (admin-panel.js) en camemberts/barres -- évite une agrégation JSONB complexe en SQL pur pour un
-- besoin d'affichage simple, cohérent avec le reste du panneau admin (buildPieWithLegendHtml etc.
-- reçoivent déjà des listes {label,value} calculées côté JS ailleurs dans admin-economy.js).
create or replace function public.admin_companion_breakdown()
 returns table(rarity_breakdown jsonb, tier_breakdown jsonb, section_breakdown jsonb)
 language plpgsql security definer set search_path to 'public'
as $function$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Réservé au staff';
  end if;
  return query
    select cs.rarity_breakdown, cs.tier_breakdown, cs.section_breakdown
    from public.companion_stats cs;
end;
$function$;
grant execute on function public.admin_companion_breakdown() to authenticated;
