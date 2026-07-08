# tests/

Suite de tests de régression.

- `tests.js` — `assert()` + des centaines de tests couvrant équilibrage, formules de stat,
  migrations rétroactives, UI, patch notes... **Jamais lancée automatiquement** : appeler
  `window.runRegressionTests()` depuis la console ou via `preview_eval` après toute
  modification. Charge en tout dernier (a besoin de tout le reste).

Convention : après toute extraction de code entre fichiers, relancer la suite complète ET
vérifier au moins un comportement réel en direct (pas seulement l'absence d'erreur au
chargement) — voir `CLAUDE.md` à la racine.
