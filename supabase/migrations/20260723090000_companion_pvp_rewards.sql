-- Récompenses du tournoi PvP Compagnons quotidien (2026-07-18, demande explicite : "met des
-- récompenses pour le pvp journalier top 1 2 3 puis le reste", barème confirmé via AskUserQuestion :
-- généreux -> top1 5M, top2 2M, top3 1M, reste (tout classé) 250k, en Silver).
--
-- Le tournoi existe déjà (20260722090000_companion_pvp_tournament.sql) : bracket à élimination
-- directe résolu à 21h Paris par pg_cron. Il ne versait aucune récompense. Ici on ajoute :
--   1) une table companion_pvp_rewards (une ligne par joueur récompensé et par jour, à réclamer),
--   2) pvp_award_rewards(day) : calcule le CLASSEMENT du tournoi (par nombre de combats gagnés dans
--      le bracket, départage par puissance d'équipe puis md5 déterministe) et insère les gains,
--   3) le hook dans resolve_pvp_tournament_if_due() pour récompenser juste après chaque résolution,
--   4) claim_pvp_rewards() : le client réclame ses gains non réclamés et crédite le silver DU JEU
--      (pool partagé, voir README companions) côté client -- le SERVEUR ne connaît pas ce silver
--      (économie 100% locale côté pets), il fournit seulement le MONTANT autorisé par joueur/jour.
--
-- Modèle de confiance : identique au reste du module (companion_stats/leaderboard) -- le rang et le
-- montant sont calculés SERVEUR (autoritaires, non falsifiables), le crédit effectif se fait côté
-- client sur S.silver (déjà client-autoritaire dans tout le jeu). Le flag claimed empêche le
-- double versement du MÊME gain (un même (user,day) ne peut être réclamé qu'une fois).

-- ============================================================
-- TABLE : gains à réclamer
-- ============================================================
create table if not exists public.companion_pvp_rewards (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  rank int not null,
  silver bigint not null,
  claimed boolean not null default false,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  primary key (user_id, day)
);
create index if not exists companion_pvp_rewards_unclaimed_idx
  on public.companion_pvp_rewards(user_id) where claimed = false;
alter table public.companion_pvp_rewards enable row level security;
-- lecture de SES propres gains uniquement (montant/rang privés) ; écriture par les fonctions
-- SECURITY DEFINER ci-dessous seulement.
create policy companion_pvp_rewards_own on public.companion_pvp_rewards
  for select using (user_id = (select auth.uid()));

-- ============================================================
-- Calcul + insertion des récompenses d'un jour résolu (idempotent)
-- ============================================================
-- Ne fait rien tant que le tournoi n'est pas 'resolved'. Rang = nombre de combats gagnés dans le
-- bracket stocké (le champion en gagne log2(taille), le finaliste un de moins, etc.), départagé par
-- puissance d'équipe puis un md5 déterministe (rejouable, pas de RNG). Barème : 1->5M, 2->2M, 3->1M,
-- reste->250k. `on conflict do nothing` = idempotent : ré-appeler ne re-verse jamais.
create or replace function public.pvp_award_rewards(p_day date)
returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if not exists (select 1 from public.companion_pvp_tournaments where day = p_day and status = 'resolved') then
    return;
  end if;
  insert into public.companion_pvp_rewards(user_id, day, rank, silver)
  select ranked.uid::uuid, p_day, ranked.rnk,
    (case ranked.rnk when 1 then 5000000 when 2 then 2000000 when 3 then 1000000 else 250000 end)::bigint
  from (
    select r.user_id::text as uid,
      row_number() over (
        order by coalesce(w.wins, 0) desc, r.team_power desc, md5(p_day::text || r.user_id::text)
      ) as rnk
    from public.companion_pvp_registrations r
    left join (
      select m->>'winner_user_id' as uid, count(*) as wins
      from public.companion_pvp_tournaments t,
           jsonb_array_elements(t.bracket->'rounds') rd,
           jsonb_array_elements(rd) m
      where t.day = p_day and (m->>'winner_user_id') is not null
      group by 1
    ) w on w.uid = r.user_id::text
    where r.day = p_day
  ) ranked
  on conflict (user_id, day) do nothing;
end;
$$;
grant execute on function public.pvp_award_rewards(date) to authenticated;

-- ============================================================
-- Hook : récompenser juste après chaque résolution automatique/repli
-- ============================================================
-- Remplace resolve_pvp_tournament_if_due() (migration du tournoi) pour appeler pvp_award_rewards()
-- après chaque run_pvp_tournament(). Idempotent : pg_cron (toutes les 5 min) comme le repli
-- "premier client connecté" passent par ici ; pvp_award_rewards ne double-verse jamais.
create or replace function public.resolve_pvp_tournament_if_due()
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_paris_ts timestamp;
  v_row record;
begin
  v_paris_ts := (now() at time zone 'Europe/Paris');
  for v_row in
    select day from public.companion_pvp_tournaments
    where status = 'open' and (day::timestamp + interval '21 hours') <= v_paris_ts
    order by day
  loop
    perform public.run_pvp_tournament(v_row.day);
    perform public.pvp_award_rewards(v_row.day);
  end loop;
end;
$$;
grant execute on function public.resolve_pvp_tournament_if_due() to authenticated;

-- ============================================================
-- RPC : réclamer ses gains non réclamés
-- ============================================================
-- Marque tous les gains non réclamés de auth.uid() comme réclamés et les renvoie ; le client somme
-- le silver et le crédite sur le pool partagé (S.silver via addSilver côté hôte). Atomique : le
-- UPDATE...RETURNING garantit qu'un gain donné n'est renvoyé qu'une fois même en cas d'appels
-- concurrents (une seule transaction peut faire passer claimed false->true pour une ligne donnée).
drop function if exists public.claim_pvp_rewards();
create or replace function public.claim_pvp_rewards()
returns table(day date, rank int, silver bigint)
language plpgsql security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  return query
  update public.companion_pvp_rewards r
    set claimed = true, claimed_at = now()
    where r.user_id = (select auth.uid()) and r.claimed = false
    returning r.day, r.rank, r.silver;
end;
$$;
grant execute on function public.claim_pvp_rewards() to authenticated;
