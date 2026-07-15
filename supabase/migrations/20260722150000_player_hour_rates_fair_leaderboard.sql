-- Classement silver/h + kills/min recalculés CÔTÉ SERVEUR (V454, 2026-07-16, demande explicite :
-- "revoir comment est calculé silver/h kpm et faire qqch de mieux et juste pour tout le monde").
--
-- Avant : chaque client mesurait lui-même son record À VIE sur une fenêtre glissante de 3 min
-- EXTRAPOLÉE en taux horaire (×20 entre un pic de 3 min et une vraie heure), puis le poussait dans
-- player_stats. Trois problèmes d'équité : ça récompense un pic chanceux plutôt qu'un vrai rythme,
-- les records posés sous d'anciennes économies plus généreuses restaient gravés à jamais (resets
-- manuels V436/V439/V440 déjà nécessaires), et la mesure était entièrement côté client.
--
-- Après : agrégats horaires par joueur (table player_hour_rates ci-dessous) calculés toutes les
-- heures par pg_cron depuis les journaux BRUTS déjà en place -- silver_ledger (gains catégorie
-- 'loot' uniquement, même définition que le HUD) et farm_events (le trash droppe EXACTEMENT une
-- fois par kill, ch=1 dans rollDrops : qty de trash = kills, aucun nouveau tracking client
-- nécessaire). Le classement affiche DEUX colonnes (choix explicite de l'utilisateur) :
--   * silver_per_hour_week / best_kpm_week : meilleure heure PLEINE des 7 derniers jours --
--     redescend naturellement si on arrête de farmer, insensible aux vieilles économies ;
--   * silver_per_hour / best_kpm (colonnes existantes, REMISES À ZÉRO ici) : record à vie, même
--     formule "heure pleine", ratchet serveur (ne fait que monter).
-- La matière première (ledger/farm_events) est purgée à 3 jours (quota) ; les agrégats par
-- joueur-heure sont minuscules (1 ligne/joueur/heure active) et gardés 7 jours.

-- ---------- table d'agrégats horaires ----------
create table if not exists public.player_hour_rates (
  user_id uuid not null references auth.users(id) on delete cascade,
  hour timestamptz not null,
  loot_silver bigint not null default 0,
  kills integer not null default 0,
  primary key (user_id, hour)
);
create index if not exists player_hour_rates_hour_idx on public.player_hour_rates (hour);

alter table public.player_hour_rates enable row level security;
-- lecture : chacun ses propres lignes (affichage perso éventuel) + admin ; écriture : PERSONNE
-- côté client -- seule compute_player_hour_rates() (security definer, cron) remplit cette table.
drop policy if exists "Joueur lit ses propres taux horaires" on public.player_hour_rates;
create policy "Joueur lit ses propres taux horaires" on public.player_hour_rates
  for select using ((select auth.uid()) = user_id
    or coalesce((select auth.jwt() ->> 'email'), '') = 'maxime.lacoste@icloud.com');

-- ---------- deux nouvelles colonnes "meilleure heure des 7 derniers jours" ----------
alter table public.player_stats
  add column if not exists silver_per_hour_week numeric not null default 0,
  add column if not exists best_kpm_week numeric not null default 0;

-- ---------- remise à zéro des colonnes à vie (nouvelle sémantique "heure pleine") ----------
-- Les valeurs existantes sont des pics de 3 min extrapolés (jusqu'à ~20× une vraie heure) : les
-- mélanger avec la nouvelle formule serait précisément l'injustice qu'on corrige. Même décision
-- explicite que les resets V436/V439 -- le classement se rebâtit dès la prochaine heure de farm
-- (backfill immédiat sur les 3 jours de journaux encore en base, voir l'appel tout en bas).
update public.player_stats set silver_per_hour = 0, best_kpm = 0;

-- ---------- calcul horaire ----------
-- p_hours : fenêtre de recalcul des agrégats (26h par défaut pour le cron horaire -- large marge
-- sur les passages manqués ; 72h au backfill initial ci-dessous, la rétention des journaux bruts).
create or replace function public.compute_player_hour_rates(p_hours int default 26)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- gains de farm (catégorie 'loot' uniquement -- même définition que le HUD silver/min : le
  -- revenu du trash, pas les quêtes/succès/boss/marché). Plafonné au clamp silver_per_hour déjà
  -- en place (5e9) : des lignes de ledger forgées ne peuvent pas gonfler l'agrégat au-delà.
  insert into player_hour_rates (user_id, hour, loot_silver, kills)
  select user_id, date_trunc('hour', created_at),
         least(sum(delta), 5000000000), 0
  from silver_ledger
  where category = 'loot' and delta > 0
    and created_at >= now() - make_interval(hours => least(greatest(coalesce(p_hours, 26), 1), 96))
  group by 1, 2
  on conflict (user_id, hour) do update set loot_silver = excluded.loot_silver;

  -- kills : qty de trash ramassé (farm_events, item_kind='trash') = nombre de kills (le trash
  -- droppe exactement 1 fois par kill, jamais bloqué par un sac plein). Plafonné à 30 000/h
  -- (= 500 kills/min, le clamp best_kpm existant).
  insert into player_hour_rates (user_id, hour, loot_silver, kills)
  select user_id, date_trunc('hour', created_at),
         0, least(sum(qty), 30000)::int
  from farm_events
  where item_kind = 'trash'
    and created_at >= now() - make_interval(hours => least(greatest(coalesce(p_hours, 26), 1), 96))
  group by 1, 2
  on conflict (user_id, hour) do update set kills = excluded.kills;

  -- rétention 7 jours des agrégats (fenêtre du classement "semaine")
  delete from player_hour_rates where hour < now() - interval '7 days';

  -- pousse les deux colonnes dans player_stats : meilleure heure pleine des 7 derniers jours
  -- (redescend naturellement) + record à vie en ratchet (ne fait que monter). Le trigger
  -- clamp_player_stats s'applique comme à n'importe quelle écriture.
  update player_stats ps set
    silver_per_hour_week = coalesce(w.max_silver, 0),
    best_kpm_week        = round(coalesce(w.max_kills, 0) / 60.0, 1),
    silver_per_hour      = greatest(coalesce(ps.silver_per_hour, 0), coalesce(w.max_silver, 0)),
    best_kpm             = greatest(coalesce(ps.best_kpm, 0), round(coalesce(w.max_kills, 0) / 60.0, 1))
  from (
    select user_id, max(loot_silver) as max_silver, max(kills) as max_kills
    from player_hour_rates
    group by user_id
  ) w
  where w.user_id = ps.user_id;

  -- joueurs sans AUCUNE heure de farm sur 7 jours : leur colonne "semaine" retombe à 0
  update player_stats ps set silver_per_hour_week = 0, best_kpm_week = 0
  where (ps.silver_per_hour_week <> 0 or ps.best_kpm_week <> 0)
    and not exists (select 1 from player_hour_rates r where r.user_id = ps.user_id);
end;
$$;

revoke all on function public.compute_player_hour_rates(int) from public, anon, authenticated;

-- ---------- cron horaire + backfill immédiat ----------
-- cron.schedule() fait un upsert par jobname (documenté pg_cron) -- ré-exécutable sans doublon.
-- Minute 7 : après la purge de rétention et le cron hors-ligne déjà planifiés, jamais en même temps.
select cron.schedule(
  'player-hour-rates-hourly',
  '7 * * * *',
  $$select public.compute_player_hour_rates()$$
);

-- backfill immédiat sur les ~3 jours de journaux encore en base (rétention 3 jours), pour ne pas
-- laisser le classement à zéro jusqu'au prochain passage du cron.
select public.compute_player_hour_rates(72);
