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

## Parallélisme et durée (2026-07-22, audit repo P7)

La suite complète est passée de **141 s à 82 s** (−42 %). Ce qui a marché, et ce qui n'a pas marché :

| Configuration | Durée | |
|---|--:|---|
| `workers:1` (l'ancien défaut) | 141 s | venait de l'import initial, aucune raison écrite |
| `workers:4` seul | 132 s | quasi rien gagné |
| `mode:'parallel'` + `workers:2` | **82 s** | retenu — 3 runs verts (80/83/83 s) |
| `mode:'parallel'` + `workers:4` | 91 s | **plus lent, et 1 échec** |

Deux choses à comprendre avant de retoucher ces réglages :

1. **Playwright répartit les FICHIERS entre workers, pas les tests d'un même fichier.**
   `companions.spec.js` pèse à lui seul **86 %** du temps (122 s sur 141 s) et restait donc sur un
   worker unique quoi qu'on mette dans `workers`. Le gain vient d'abord du
   `test.describe.configure({ mode: 'parallel' })` dans ce fichier.

2. **Plus de workers est PIRE.** Chaque test charge le jeu complet, qui tourne en
   `requestAnimationFrame` sur un canvas, et attend une vraie connexion anonyme Supabase. Au-delà
   de 2 navigateurs, ils se disputent le CPU et les auth concurrentes se multiplient : plus lent
   **et** instable. La CI (ubuntu-latest, 4 vCPU) est plus serrée que la machine où ces mesures ont
   été prises (16 cœurs). Ne pas monter `workers` sans refaire la mesure.

> Découper `tests.js` n'accélérerait **rien** : ce n'est pas une spec Playwright, c'est un script
> chargé dans la page qui définit `window.runRegressionTests()`, appelé une seule fois par
> `regression.spec.js`. Ses 7 230 lignes s'exécutent en **4,8 s, soit 3,4 %** du temps de la suite.
> La taille d'un fichier de test n'est pas son coût.
