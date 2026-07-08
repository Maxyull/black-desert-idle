# meta/

Contenu informatif sur le jeu lui-même plutôt que sur son fonctionnement.

- `patch-notes-data.js` — l'historique complet des patch notes (`PATCH_NOTES[]`), FR/EN,
  paginé en jeu. Pure donnée qui grossit avec chaque version — **pas de règle de découpe**
  malgré sa taille (voir `CLAUDE.md`, exception append-only). Charge avant
  `backend/game-supabase.js`, qui lit `PATCH_NOTES[0].v` immédiatement.
