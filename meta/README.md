# meta/

Contenu informatif sur le jeu lui-même plutôt que sur son fonctionnement.

- `patch-notes-data.js` — l'historique complet des patch notes (`PATCH_NOTES[]`), FR/EN,
  paginé en jeu. Pure donnée qui grossit avec chaque version — **pas de règle de découpe**
  malgré sa taille (voir `CLAUDE.md`, exception append-only). Charge avant
  `backend/game-supabase.js`, qui lit `PATCH_NOTES[0].v` immédiatement.

  **Karma/commentaires par ligne (2026-07-10)** : chaque ligne d'un tableau `p.fr`/`p.en` a un
  `entry_id` synthétique STABLE `{version}-{index}` (position dans le tableau, PAS l'ordre
  d'affichage regroupé par catégorie — voir `renderPatchEntryHtml`, `src/backend/game-supabase.js`).
  Ne jamais réordonner/insérer une ligne au milieu d'un `fr:[...]`/`en:[...]` déjà publié : ça
  décalerait les `entry_id` et déconnecterait les votes/commentaires existants de la mauvaise
  ligne. Toujours ajouter une nouvelle ligne à la FIN du tableau de sa version (déjà la convention
  append-only du fichier, désormais aussi une contrainte dure côté backend).
