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
(rétention 7 jours ; la matière première, elle, est purgée à 14 jours, voir la section
suivante). Sémantique : meilleure
heure PLEINE des 7 derniers jours (`*_week`, redescend naturellement) + record à vie en ratchet
(mêmes colonnes historiques, remises à zéro à la migration). Le trigger
`protect_server_rate_columns_trg` ignore toute écriture client (auth.uid() non nul) sur ces 4
colonnes — même un vieux client jamais rechargé ne peut plus les pousser. Voir
`migrations/20260722150000_player_hour_rates_fair_leaderboard.sql` et `20260722150500_*.sql`.

## Rétention des journaux bruts (2026-08-02)

`silver_ledger` et `farm_events` sont les deux seules tables qui grossissent vite : de
250 000 à 480 000 lignes par jour à elles deux, puisqu'elles journalisent CHAQUE
ramassage de silver et CHAQUE kill.

**Le paragraphe ci-dessus a longtemps annoncé une purge à 3 jours qui n'a jamais eu
lieu.** La migration `20260708102350_silver_ledger_archive_and_purge_retention.sql` est
un script à un coup : elle archive puis supprime une fois, et ne crée ni fonction
réutilisable ni `cron.schedule`. Pire, le jour où elle a tourné (08/07/2026) les deux
tables n'avaient que 2 jours d'existence, donc « plus vieux que 3 jours » ne matchait
rien. Elle s'est exécutée à vide, sans que rien ne le signale.

Constat au 02/08/2026, un mois plus tard : 1 668 352 lignes dans `farm_events` (293 Mo) et
1 209 878 dans `silver_ledger` (198 Mo), soit **490 Mo sur une base de 521 Mo** alors que
le quota est de 500 Mo.

Corrigé par `20260802094000_purge_recurrente_journaux_bruts.sql` :

* `public.purge_journaux_bruts(p_jours default 14, p_appliquer default true)` archive puis
  purge, **dans la même transaction**. L'ordre n'est pas optionnel :
  `admin_silver_ledger_by_category` additionne `silver_ledger_archive_totals` et ce qui
  reste en base pour afficher les totaux « depuis toujours ». Purger sans archiver perdrait
  définitivement l'historique par catégorie depuis le lancement du jeu.
* Job pg_cron `purge-journaux-bruts`, quotidien à 04:20, soit 20 minutes avant
  `integrity-cleanup` pour ne pas superposer deux suppressions de masse.
* Essai à blanc : `select * from public.purge_journaux_bruts(14, p_appliquer => false);`

**Rétention portée de 3 à 14 jours.** Vérifié avant de trancher, rien ne lit au-delà :
`my_silver_history()` a un défaut de 24 h (panneau « graphique 24 h »,
`src/backend/silver-history-panel.js`) et `compute_player_hour_rates()` lit 26 h. Les
14 jours servent uniquement de marge pour enquêter sur un cas de triche ou un bug remonté
tardivement.

Purge initiale passée le 02/08/2026 : 2 676 513 lignes supprimées, historique par catégorie
archivé et vérifié intact.

⚠️ **Un `delete` ne rend pas l'espace disque.** Après la purge, `pg_database_size` affichait
toujours 521 Mo : Postgres garde les tuples morts jusqu'à un `VACUUM FULL`, qui pose un
verrou exclusif sur la table. Sans conséquence pour un `pg_dump` (il ne copie que les lignes
vivantes), mais à faire pendant une heure creuse si l'objectif est de repasser sous le quota.
