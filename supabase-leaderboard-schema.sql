-- Table player_stats : snapshot des stats publiques de chaque joueur, resynchronisé
-- automatiquement toutes les 30s (en même temps que la sauvegarde cloud) et à la fermeture
-- de l'onglet. Alimente le Classement (visible par tous) et la colonne "Temps de jeu"
-- de la Zone Admin.
--
-- Aucune donnée sensible : pas d'email brut (juste le pseudo dérivé avant le @), pas de
-- mot de passe, pas de contenu d'inventaire.

create table if not exists player_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '?',
  silver bigint not null default 0,
  gearscore int not null default 0,
  best_zone_index int not null default 0,
  best_zone_name text not null default '',
  silver_per_hour numeric not null default 0,
  playtime_sec bigint not null default 0,
  best_item_name text not null default '',
  best_item_count bigint not null default 0,
  lvl int not null default 1,
  updated_at timestamptz not null default now()
);

-- migrations idempotentes si la table existait déjà avant ces ajouts
alter table player_stats add column if not exists best_item_name text not null default '';
alter table player_stats add column if not exists best_item_count bigint not null default 0;
alter table player_stats add column if not exists lvl int not null default 1;

alter table player_stats enable row level security;

-- tout joueur connecté (y compris invité) peut LIRE les stats de tout le monde (classement public)
drop policy if exists "player_stats_select_all" on player_stats;
create policy "player_stats_select_all" on player_stats
  for select using (auth.role() = 'authenticated');

-- écrire sa propre ligne : réservé aux comptes vérifiés (pas de session anonyme) — évite
-- le farming du classement via des comptes invités jetables
drop policy if exists "player_stats_insert_own" on player_stats;
create policy "player_stats_insert_own" on player_stats
  for insert with check (auth.uid() = user_id and coalesce((auth.jwt()->>'is_anonymous')::boolean, true) = false);

drop policy if exists "player_stats_update_own" on player_stats;
create policy "player_stats_update_own" on player_stats
  for update using (auth.uid() = user_id and coalesce((auth.jwt()->>'is_anonymous')::boolean, true) = false)
  with check (auth.uid() = user_id and coalesce((auth.jwt()->>'is_anonymous')::boolean, true) = false);
