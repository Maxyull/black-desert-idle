# tests/

Suite de tests de régression.

- `tests.js` : `assert()` + des centaines de tests couvrant équilibrage, formules de stat,
  migrations rétroactives, UI, patch notes. Charge en tout dernier, car il a besoin de tout le reste.
- `regression.spec.js` : wrapper Playwright. Ouvre `index.dev.html`, attend `window.runRegressionTests()`, puis échoue si la suite retourne une erreur ou si la page lève une exception.
- `prod.spec.js` : ouvre `index.html`, vérifie que la prod charge `build/source.min.js`, que les globals nécessaires survivent à la minification, et que les tests dev ne sont pas embarqués.
- `companions.spec.js` : module Compagnons (`src/companions/`), jamais bundlé et jamais exposé sur `window` du jeu principal (isolé dans un iframe chargé à la demande) — donc invisible pour `runRegressionTests()`. Clique l'onglet Compagnon, vérifie le chargement paresseux (iframe absente avant le clic), inspecte le contenu de l'iframe (`page.frameLocator`), teste Collection/Éclosion, puis la fermeture propre de l'overlay.

Commandes :

```bash
npm test
npm run test:headed
npm run test:ui
```

Préparation locale :

```bash
npm install
npx playwright install chromium
```

Convention : après toute extraction de code entre fichiers ou changement de build/minification, relancer la suite complète et vérifier au moins un comportement réel en direct, pas seulement l'absence d'erreur au chargement. Voir `CLAUDE.md` à la racine.
