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
