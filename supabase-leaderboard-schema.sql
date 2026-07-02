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
  updated_at timestamptz not null default now()
);

alter table player_stats enable row level security;

-- tout joueur connecté peut lire les stats de tout le monde (nécessaire pour le classement)
drop policy if exists "player_stats_select_all" on player_stats;
create policy "player_stats_select_all" on player_stats
  for select using (auth.role() = 'authenticated');

-- chaque joueur ne peut créer/modifier QUE sa propre ligne
drop policy if exists "player_stats_insert_own" on player_stats;
create policy "player_stats_insert_own" on player_stats
  for insert with check (auth.uid() = user_id);

drop policy if exists "player_stats_update_own" on player_stats;
create policy "player_stats_update_own" on player_stats
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
