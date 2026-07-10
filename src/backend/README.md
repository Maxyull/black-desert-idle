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
  **`getSbClient()`/`getCurrentUserForSync()` (2026-07-20, bug corrigé)** : `sb`/`currentUser`
  sont des `let` top-level — contrairement à `var` ou à une déclaration `function`, `let` au
  top-level d'un script classique NE devient PAS une propriété de `window`. Le module Compagnon
  (`src/companions/`, iframe same-origin) lisait `window.parent.sb`/`.currentUser`, TOUJOURS
  `undefined` — sa synchro admin ne s'est jamais déclenchée depuis sa création. Ces deux
  accesseurs (déclarations `function`, bien attachées à `window`) exposent la valeur COURANTE de
  `sb`/`currentUser` à tout code cross-window qui en a besoin — à réutiliser pour tout futur
  module en iframe qui doit lire ces globals depuis `window.parent`, plutôt que de les lire
  directement (voir aussi `companions/README.md` pour le 2e bug cumulé de ce correctif :
  `.catch()` direct sur un builder Postgrest).
  **`.catch()` direct sur `sb.rpc(...)` — piège récurrent (2026-07-20)** : le builder Postgrest
  renvoyé par `sb.rpc(...)` n'implémente QUE `.then()` (thenable), jamais `.catch()` directement —
  l'appeler lève silencieusement `TypeError: ...catch is not a function`, AVANT même que la requête
  ne parte (le thenable ne s'exécute qu'au premier `.then()`/`await`). Déjà corrigé une fois pour
  `log_playtime_ping` (2026-07-08, commentaire juste au-dessus de son `setInterval`) mais jamais
  généralisé — retrouvé dans `mark_item_tutorial_seen` (×2, `markItemTutorialSeen`/
  `reportTutorialProgress`) et `companions/companions.sync.js`. Toujours utiliser `await`
  (fonction bloquante OK) ou `.then(null, cb)` (fire-and-forget) — jamais `.then(cb).catch(errCb)`
  n'est le souci (ça, c'est valide : `.catch` est appelé sur le vrai Promise renvoyé PAR `.then()`,
  pas sur le builder brut — voir `boss.js:boss_contribute` pour un exemple correct de ce pattern).
  Garde-fou : `testRpcFireAndForgetCallsNeverUseBareCatch` (`tests/tests.js`).
