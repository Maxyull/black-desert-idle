# backend/

Tout ce qui parle à Supabase : authentification, sauvegarde cloud, classement, détection de
nouvelle version.

- `game-supabase.js` — client Supabase, auth (email + Discord), chargement/sauvegarde de la
  partie, `syncPlayerStats()` (classement), `checkForUpdate()` (détecte une nouvelle version
  en fetchant `meta/patch-notes-data.js`), dictionnaire i18n (`I18N`). Charge après
  `meta/patch-notes-data.js` (lit `PATCH_NOTES[0].v` immédiatement pour `CURRENT_VERSION`).
  Moteur de tutoriel générique (`startTutorial`/`endTutorial`/`TUTORIAL_STEPS`) : depuis le
  2026-07-19 (demande explicite, stats admin sur l'onboarding), `startTutorial(steps,
  {trackId})` accepte un `trackId` optionnel — seul le tutoriel d'arrivée (21 étapes) le
  passe (`trackId:'onboarding'`), les autres (Compendium/Cron/objets/actions) restent
  inchangés. `reportTutorialProgress()` envoie la progression (étape atteinte, terminé,
  passé) via la RPC `mark_item_tutorial_seen` (généralisée, voir
  `supabase/migrations/20260719180000_onboarding_stats.sql`) — fire-and-forget, jamais
  bloquant, no-op sans compte connecté.
  **Bug corrigé (2026-07-10, récupéré le 2026-07-20 depuis la branche
  `claude/onboarding-issue-fix-861c40`)** : `positionTutorialStep()` clampait la position
  verticale de `#tutorialBox` sur une hauteur SUPPOSÉE fixe (`window.innerHeight-160`) au lieu
  de sa hauteur réelle (`box.offsetHeight`) — un step avec un texte assez long (ex: tutoriel
  Marché commun, voir `progression/README.md`) ET une cible proche du bord bas de l'écran
  produisait une boîte coupée hors du viewport. Test de régression :
  `testTutorialBoxClampsToRealHeightNeverOverflowsBottom` (`tests/tests.js`).
