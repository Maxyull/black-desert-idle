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
  **`startTutorial()` — garde ajoutée (2026-07-20, rapporté explicitement : "l'onboarding ne dois
  pas s'enclencher si on ne s'est pas inscrit/connecté")** : `if (!currentUser) return;` en tout
  premier — défense en profondeur, le vrai correctif vit dans `maybeQueueTutorialById()`
  (`progression/notifications-quests.js`, voir son README pour le détail complet : le jeu tourne
  déjà en arrière-plan avant authentification via `requestAnimationFrame(loop)`, sans garde un
  tutoriel pouvait être marqué "vu" avant même que le vrai joueur ne l'ait vu).
  **Écran de connexion — Discord/Google/GitHub/Twitter (2026-07-20, demande explicite : "enlever
  les emoji laisser discord en gros et mettre dessous divisé en 3 les 3 autre")** : `I18N.btnSignInDiscord`
  reste le texte complet ("Se connecter avec Discord", sans emoji), Google/GitHub/Twitter réduits
  au seul nom de marque — regroupés dans `#authSocialRow` (`index.dev.html`, flex 3 colonnes
  égales, `styles.css`), sous le bouton Discord qui reste seul en pleine largeur (CTA principal).
  **`showPlayerInventoryWindow()` — bug corrigé (2026-07-20, rapporté explicitement : "quand je
  reste longtemps dans compagnon le dashboard s'affiche")** : cette fonction ouvre une popup
  "Inventaire joueur" (bouton 🎒 de la liste des joueurs, panneau admin) et sondait toutes les
  400ms (`setInterval`) si `win.closed` pour rappeler `openAdminPanel()` à la fermeture. Ce
  sondage survit tant que la popup reste ouverte, MÊME si l'admin a depuis navigué ailleurs (ex:
  fermé le panneau admin pour aller tester le module Compagnon) — si la popup traînait longtemps
  en arrière-plan avant d'être fermée, `openAdminPanel()` se déclenchait sans prévenir, en pleine
  autre session. Corrigé : ne rappelle `openAdminPanel()` que si `$a('adminOverlay')` a encore la
  classe `open` au moment de la fermeture (l'admin n'a pas explicitement quitté le panneau entre-
  temps via `closeAdminPanel()`, qui retire cette classe). Garde-fou statique :
  `testPopupCloseOnlyReopensAdminPanelIfStillOpen` (`tests/tests.js`).
