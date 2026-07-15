# Dossier Supabase (intégration GitHub)

Ce dossier a été ajouté le 2026-07-08 pour activer l'intégration GitHub de Supabase
(Project Settings > Integrations > GitHub Integration, working directory = `supabase/`).

## Pourquoi `migrations/` démarre vide

Tout le schéma actuel (tables, vues, fonctions RPC, policies RLS) a été construit **avant**
la mise en place de cette intégration, directement via le SQL Editor du dashboard Supabase
puis via les outils MCP Supabase. Ces changements sont donc déjà appliqués en production,
mais n'existaient jusqu'ici que sous forme de fichiers de documentation à la racine du dépôt
(`supabase-*-schema.sql`) — jamais comme de vraies migrations horodatées.

Démarrer `migrations/` vide est volontairement sans risque : l'intégration GitHub ne pousse
que les migrations dont le numéro de version n'est PAS déjà dans l'historique distant
(`supabase_migrations.schema_migrations`), qui contient déjà 31 versions appliquées entre le
04/07/2026 et le 05/07/2026. Un dossier vide ne rejoue donc rien.

## À partir de maintenant

Tout nouveau changement de schéma doit être ajouté ici sous forme de migration horodatée
(`YYYYMMDDHHMMSS_nom_descriptif.sql`), en plus d'être appliqué en direct via les outils MCP
Supabase — pour que l'intégration GitHub les prenne en charge automatiquement au prochain
merge sur `main`, et que l'historique reste lisible pour l'équipe.

Les fichiers `supabase-*-schema.sql` à la racine du dépôt restent en place comme
documentation de référence du schéma existant (ce qu'ils ont toujours été).

## Colonnes de classement possédées par le serveur (V454, 2026-07-16)

`player_stats.silver_per_hour`, `best_kpm`, `silver_per_hour_week` et `best_kpm_week` ne sont
**plus jamais écrites par le client** : elles sont calculées toutes les heures par
`compute_player_hour_rates()` (pg_cron, job `player-hour-rates-hourly`, minute 7) depuis les
journaux bruts `silver_ledger` (gains catégorie `'loot'`) et `farm_events` (qty de trash = kills,
le trash droppant exactement 1× par kill) — agrégats par joueur-heure dans `player_hour_rates`
(rétention 7 jours ; la matière première, elle, est purgée à 3 jours). Sémantique : meilleure
heure PLEINE des 7 derniers jours (`*_week`, redescend naturellement) + record à vie en ratchet
(mêmes colonnes historiques, remises à zéro à la migration). Le trigger
`protect_server_rate_columns_trg` ignore toute écriture client (auth.uid() non nul) sur ces 4
colonnes — même un vieux client jamais rechargé ne peut plus les pousser. Voir
`migrations/20260722150000_player_hour_rates_fair_leaderboard.sql` et `20260722150500_*.sql`.
