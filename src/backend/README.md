# backend/

Tout ce qui parle à Supabase : authentification, sauvegarde cloud, classement, détection de
nouvelle version.

**Verrou multi-session + mode hors ligne (2026-07-10, demande explicite : "Interdire multionglet,
multi navigateur and multidevice" + "Mode hors ligne")** :
- Un seul onglet/navigateur/appareil actif par compte. `mySessionId` (UUID généré une fois par
  chargement de page, jamais persisté) est envoyé à `claim_player_session()` (RPC, appelée à la
  connexion) — insère/écrase la ligne `player_sessions.session_id` de ce compte, la dernière
  session à claim gagne. `checkPlayerSession()` (appelée à chaque `heartbeatPresence()`, 20s) lit
  `check_player_session()` : si le `session_id` en base a changé, `sessionLocked = true` et
  `#sessionLockOverlay` s'affiche (bloquant, bouton "Reprendre ici" rappelle `claimPlayerSession()`
  pour reprendre la main depuis cet onglet). `advanceSim()` (`game-core.js`) et `saveToCloud()`
  (ce fichier) sont gatés sur `sessionLocked` — la session évincée ne farm plus ET n'écrase jamais
  la sauvegarde de la session active. Migration : `supabase/migrations/20260710075021_single_session_lock.sql`.
- Mode hors ligne : `isOffline` (`navigator.onLine` + events `online`/`offline`) fait basculer
  `saveToCloud()` sur `saveToLocalOfflineCache()` (localStorage, clé par `currentUser.id` via
  `offlineSaveKey()`) plutôt que d'échouer silencieusement. `pendingOfflineSync` suit s'il reste une
  sauvegarde locale à pousser ; `flushOfflineSaveIfNeeded()` la pousse au retour réseau (event
  `online`). `loadCloudSave()` retombe aussi sur ce cache si la page charge déjà hors ligne (rejoue
  une session déjà jouée en ligne au moins une fois sur cet appareil — ne couvre pas un tout premier
  chargement jamais authentifié en ligne, hors périmètre). `#offlineBanner` (non bloquant) informe le
  joueur. `checkPlayerSession()` ignore l'appel tant qu'`isOffline` est vrai — jamais de faux verrou
  posé sur une simple coupure réseau (seul un vrai `data === false` renvoyé par le serveur verrouille).
- **Bug corrigé (2026-07-10, trouvé par `tests/companions.spec.js`)** : `signInForTest()` fabrique
  `currentUser` localement sans vraie session Supabase (voir ce fichier de test) — `auth.uid()`
  était donc NULL côté serveur, faisant échouer `claim_player_session()` silencieusement puis
  `check_player_session()` renvoyait `false` par sécurité, verrouillant à tort TOUTE l'UI de test
  (`#sessionLockOverlay` intercepte tous les clics). Corrigé par `sessionClaimOk` : `checkPlayerSession()`
  ne peut plus poser `sessionLocked=true` tant qu'un `claim_player_session()` n'a pas d'abord
  réussi sans erreur. Test : `testCheckPlayerSessionRequiresSuccessfulClaimFirst` (`tests/tests.js`).
- Politique de test : voir CLAUDE.md §11 "Politique tests en ligne + hors ligne" — tout nouveau test
  réseau doit désormais couvrir les deux scénarios, rétroactivement aussi pour le code réseau déjà
  existant. Tests : `testAdvanceSimSkipsAllEffectsWhenSessionLocked`,
  `testOfflineCacheRoundTripsPerUserAndTracksPendingSync`, `testSaveToCloudGuardsSessionLockAndOffline`,
  `testCheckPlayerSessionNeverLocksOnNetworkFailure` (`tests/tests.js`).

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
  `reportTutorialProgress`) et `companions/sync.js`. Toujours utiliser `await`
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

**Wiki — panneau plein écran (2026-07-11, demande explicite : port à l'identique d'un mockup
externe fourni, sidebar/breadcrumb/article/infobox/sommaire/recherche — voir CLAUDE.md §30
"Maquettes externes")** :
- `wiki-panel.js` (même dossier) remplace l'ancienne modale à onglets plats (`openInfo()` +
  ex-`renderWikiHtml()`, supprimée) par `openWikiPanel()`/`#wikiOverlay` — charge APRÈS ce fichier,
  câblé sur `$a('btnWiki').onclick`. `WIKI_SECTIONS`/`renderCodexHtml()`/`renderTutoPageHtml()`
  restent définis ICI et sont réutilisés tels quels par le nouveau panneau (aucune duplication de
  contenu) ; `startTutorial(TUTORIAL_STEPS, {trackId:'onboarding'})` reste le seul point d'entrée
  du tutoriel d'arrivée, préservé dans `wiki-panel.js`.
- Le mockup fourni mélangeait des sujets qui vivent réellement dans des panneaux séparés
  (Compagnons = iframe isolée §28, Compendium Zones/Boss/PEN = `compendium-react.js`) : la sidebar
  du nouveau Wiki les référence comme des raccourcis (`openCompanionsModule()`/
  `openCompendiumReact()`/`openPatchNotesReact()`), jamais comme du contenu Wiki dupliqué/inventé.
- Palette : couleurs du mockup reprises à l'identique (demande explicite), pas la palette
  officielle §29 — scopées sous `#wikiOverlay` uniquement (CSS injectée en JS à la première
  ouverture), même logique que le `:root` propre au module Compagnons.
