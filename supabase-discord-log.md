# Log Discord — Black Desert Idle

Deux salons Discord reçoivent des logs automatiques du jeu :

- **Log général** (événements de jeu + actions admin) : relayé via l'Edge Function Supabase
  `discord-log` (déployée sur le projet `mkwwvzbjtyawpcyrnybk`). Le webhook Discord est stocké
  **uniquement côté serveur** dans le code de l'Edge Function (jamais dans `index.html`, jamais
  exposé au navigateur). Le client appelle l'Edge Function via son URL publique
  (`/functions/v1/discord-log`) en s'authentifiant avec le token de session Supabase du joueur.

- **Log triche/important** : appelé **directement depuis Postgres** via l'extension `pg_net`,
  dans le trigger anti-triche `clamp_player_stats` (voir `supabase-anticheat-schema.sql`).
  Quand une valeur soumise par un joueur est manifestement impossible et doit être bornée
  (silver, gearscore, niveau, temps de jeu...), une alerte part vers ce salon avec le joueur,
  le champ concerné, la valeur envoyée et la valeur bornée. Le webhook est stocké dans la
  fonction SQL `notify_cheat_discord`, jamais côté client.

Événements actuellement loggés sur le salon général :
- Succès débloqué, boss vaincu, bijou/équipement rare trouvé (déclenchés côté client)
- Actions admin : ajout mod/testeur, remboursement "Vendre mat", lancement boss pour tous,
  réinitialisation des quêtes de tous, réévaluation forcée du marché

Pour ajouter un ping @mention sur les alertes triche (ex: ping le dev), fournir l'ID utilisateur
Discord à ajouter dans `notify_cheat_discord` (format `<@ID>` dans le contenu du message).

## Correctif CORS (2026-07-08)

L'Edge Function `discord-log` ne répondait à aucune requête CORS (pas de gestion d'`OPTIONS`, pas
d'en-tête `Access-Control-Allow-Origin`) — le navigateur bloquait l'appel depuis le site déployé
(`https://maxyull.github.io`) avant même qu'il n'atteigne le webhook Discord, donc plus aucun log
général ne partait. La fonction répond désormais à `OPTIONS` avec les en-têtes CORS nécessaires
(`Access-Control-Allow-Origin: *`) et les ajoute aussi sur toutes ses réponses réelles. Vérifié par
un appel de test réel cross-origin (200, `{"ok":true}`, message bien reçu sur Discord).
