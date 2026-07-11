# Sauvegardes Supabase

Vérifié le 2026-07-21 (audit repo, point 6) via l'organisation Supabase (`get_organization`).

## État actuel

- Projet : `mkwwvzbjtyawpcyrnybk` ("Black Desert Idle"), région `eu-west-1`.
- Organisation sur le plan **Pro** — inclut des sauvegardes automatiques quotidiennes avec
  7 jours de rétention (backups physiques, pas de configuration manuelle nécessaire).
- **Point-in-Time Recovery (PITR)** n'est PAS inclus par défaut sur le plan Pro — c'est un
  add-on payant séparé (facturé au Go/jour de rétention). Non activé aujourd'hui : pas vérifié
  ici s'il vaut le coût pour ce projet, à décider séparément si le besoin se présente (ex:
  restaurer à une minute précise plutôt qu'au dernier backup quotidien).

## Restaurer depuis un backup quotidien

1. Dashboard Supabase → projet → **Database → Backups**.
2. Choisir un backup quotidien dans la liste (jusqu'à 7 jours en arrière).
3. Lancer la restauration — Supabase gère le rollback complet de la base à cet instant.
4. ⚠️ Une restauration remplace TOUTE la base au moment du backup choisi — perd les écritures
   plus récentes que ce backup. Pas de restauration partielle table par table depuis l'UI.

## Si un export manuel devient nécessaire

Pas de `pg_dump` périodique scripté aujourd'hui (pas jugé nécessaire tant que les backups
quotidiens Pro suffisent). Si un jour un export indépendant de Supabase est voulu (ex: copie
froide hors plateforme), possibilité : `pg_dump` via CI (GitHub Actions), stocké ailleurs
(S3/backup externe) — pas mis en place, à faire au moment du besoin réel plutôt que
préventivement.

## À revoir si

- Le volume de données augmente au point où la restauration complète devient trop lente/coûteuse.
- Un incident réel de perte de données montre que 7 jours de rétention ou une granularité
  journalière (pas de PITR) sont insuffisants — réévaluer l'add-on PITR à ce moment-là.
