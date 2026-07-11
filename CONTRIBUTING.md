# Contribuer à Black Desert Idle

Merci de l'intérêt ! Ce projet est un fan-game gratuit maintenu sur le temps libre — toute
contribution (bug, idée, PR) est bienvenue mais lue/mergée au rythme du mainteneur.

Le plus rapide pour un bug ou une suggestion reste le
[Discord](https://discord.gg/fEubtqMjtP) ou une
[issue GitHub](https://github.com/Maxyull/black-desert-idle/issues). Pour une PR, voir ci-dessous.

## Lancer le projet en local

Prérequis : Python 3 (build), Node.js/npm (Terser, Playwright).

```bash
npm install                      # Terser + @playwright/test
npx playwright install chromium  # navigateur pour npm test

npm run serve                    # sert le repo sur http://localhost:8000
```

Ouvrir `http://localhost:8000/index.dev.html` (dev, charge chaque fichier `src/**/*.js`
individuellement + `tests/tests.js`) — c'est le fichier à utiliser pour coder et tester, jamais
`index.html` (généré, prod uniquement).

## Structure du code

Voir la section **Stack technique** du [`README.md`](README.md) pour la vue d'ensemble, et
`CLAUDE.md` (guide agent détaillé, non suivi par git mais présent dans le repo local) pour :

- la feature map complète (quel fichier pour quelle fonctionnalité)
- les règles strictes de ce projet : pas de modules ES (`import`/`export`), tout le JS vit dans
  un seul scope global partagé, l'ordre des `<script>` dans `index.dev.html` **est** le système
  de dépendances
- le piège de zone morte temporelle (TDZ) qui n'apparaît que dans le bundle minifié, pas en dev
- le pattern de migration rétroactive à suivre si un changement affecte des sauvegardes existantes

Chaque dossier de `src/` a son propre `README.md` détaillant son rôle précis — à consulter avant
de modifier un domaine que vous ne connaissez pas encore.

## Avant de committer

1. `python scripts/build.py` après toute modification de `src/` (bump `?v=` dans
   `index.dev.html` d'abord).
2. `npm run check-build` — vérifie que le bundle committé correspond au résultat frais.
3. `npm test` (Playwright) — régression dev + intégrité du bundle prod.
4. En navigateur sur `index.dev.html` : `window.runRegressionTests()`.
5. `npm run check-i18n` si du texte joueur a changé (FR/EN doivent rester synchronisés).

## Conventions

- Pas de `import`/`export` — scripts classiques uniquement.
- Nommage : `feature-data.js` (constantes), `feature-logic.js` (règles), `feature-ui.js` (DOM),
  `feature-render.js` (canvas) — éviter `utils.js`/`helpers.js`/`misc.js`.
- Tout bug corrigé ou feature ajoutée s'accompagne d'un test dans `tests/tests.js` (unitaire +
  régression) — pas une option dans ce projet.
- Les migrations Supabase déjà appliquées ne sont jamais modifiées ; toute correction passe par
  une nouvelle migration (`supabase/migrations/YYYYMMDDHHMMSS_description.sql`).

## Soumettre une PR

- Une PR = un sujet cohérent (pas de mega-PR qui mélange plusieurs domaines sans rapport).
- Décrire le changement et, si c'est un fix, comment le reproduire avant le fix.
- S'assurer que `npm test` passe et que le build est à jour (`npm run check-build`) avant
  d'ouvrir la PR.
