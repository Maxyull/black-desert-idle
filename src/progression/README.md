# progression/

Tout ce qui fait avancer un compte au fil du temps, hors combat/loot brut : succès, quêtes,
courrier, compendium, craft du Trésor de Velia.

- `notifications-quests.js` — le plus gros fichier du dossier (~1000 lignes, seuil de
  surveillance CLAUDE.md §16 dépassé de justesse) : centre de notifications, panneau Succès
  (UI), courrier (mailbox, fidélité), Compendium (progression par zone/boss/PEN), quêtes
  journalières/hebdomadaires, et depuis le 2026-07-19 les tutoriels d'objets/actions au
  premier obtain/usage (`ITEM_TUTORIALS`, `maybeQueueItemTutorial`/`maybeQueueTutorialById`,
  réutilise `startTutorial()` de `backend/game-supabase.js`). Charge après
  `core/game-core.js`, `achievements-data.js` et `treasure-craft.js`. Si ce fichier continue
  de grossir, `item-tutorials.js` est le premier candidat à en être extrait (aucune
  dépendance de chargement immédiat avec le reste du fichier — juste après
  `notifications-quests.js` dans `index.dev.html` si extrait un jour).
  **Extension 2026-07-19** (demande explicite : "info a chaque ptit objet qu'on loot ou
  quand on va faire des nouveau truc") : `ITEM_TUTORIALS.trash` couvre en UN SEUL
  déclenchement (pas 16) le trash de zone (`itemNames` calculé dynamiquement depuis
  `ZONES.map(z => z.loot.trash.name)`, jamais codé en dur) ; `ITEM_TUTORIALS.enchant`/
  `.market`/`.boss` sont des tutoriels d'ACTION (`itemNames` vide, jamais déclenchés par un
  ramassage) branchés manuellement au premier usage réel via `maybeQueueTutorialById(id)` —
  voir `inventory/inventory-ui.js` (renderOptimization), `market/market.js` (btnMarket),
  `combat/boss.js` (openBossLobby). `maybeQueueItemTutorial(itemName)` reste l'entrée
  publique pour les déclenchements par objet, délègue maintenant à `maybeQueueTutorialById`.
  **Bug corrigé (2026-07-10, récupéré le 2026-07-20 depuis la branche
  `claude/onboarding-issue-fix-861c40` — voir aussi `backend/README.md`)** :
  `ITEM_TUTORIALS.market` ciblait `#marketBox` (le panneau entier, `height:80vh`, voir
  `styles.css`), dont le bord bas est déjà proche du bas de l'écran — la bulle
  `placement:'bottom'` se retrouvait poussée hors du viewport, coupée. Cible désormais
  `#marketHead` (petit bandeau de titre fixe en haut du panneau). Test de régression :
  `testMarketTutorialTargetsMarketHeadNotFullPanel` (`tests/tests.js`).
  **Bug corrigé (2026-07-20)** : `markItemTutorialSeen()` appelait
  `sb.rpc('mark_item_tutorial_seen', ...).catch(()=>{})` — le builder Postgrest n'a pas de
  `.catch()` direct (voir `backend/README.md` pour le détail complet, même piège que
  `log_playtime_ping`) — l'exception était avalée silencieusement, la RPC ne partait jamais.
  Remplacé par `.then(null, ()=>{})`, reste fire-and-forget (aucun `await` ajouté).
  **Bug de fond corrigé (2026-07-20, rapporté explicitement : "L'onboarding ne dois pas s'enclencher
  si on ne s'est pas inscrit/connecté = jeu non lance arriere plan")** : `requestAnimationFrame(loop)`
  (`world/render.js`) démarre sans condition dès le chargement du script, AVANT même que le joueur
  ait pu s'authentifier (`#authOverlay` encore ouvert) — le jeu simule déjà combat/loot sur
  `DEFAULT_SAVE` pendant cette fenêtre. `maybeQueueTutorialById()` appelait `markItemTutorialSeen()`
  DÈS la mise en file (pas seulement à l'affichage réel, voir le commentaire au-dessus de
  `ITEM_TUTORIAL_QUEUE_CAP`) — un ramassage simulé pendant la fenêtre pré-auth marquait donc un
  tutoriel "vu" pour de vrai, privant DÉFINITIVEMENT le joueur de ce tutoriel une fois réellement
  connecté. Garde ajoutée : `if (!currentUser) return false;` en tout début de fonction — sans
  effet de bord (ni mise en file, ni flag posé) tant qu'aucune session n'existe ; le même
  événement redéclenchera normalement l'appel une fois authentifié (ex: prochain ramassage du même
  objet). Même garde en défense sur `startTutorial()` (`backend/game-supabase.js`). Tests :
  `testTutorialNeverQueuesOrMarksSeenWithoutAuthenticatedUser` (`tests/tests.js`).
- `achievements-data.js` — les définitions des succès (`ACHIEVEMENTS`). Charge après
  `core/game-core.js` : certains objectifs (`target: ZONES.length`, `PRI_IDX`...) sont
  évalués immédiatement au chargement. **Refonte visuelle du panneau Succès (2026-07-11,
  port fidèle d'un mockup validé, même DA que les écrans Zone/Boss)** : `groupAchievementsIntoChains()`
  regroupe les succès à paliers (même catégorie + même `statFn`, ex. Premier sang → Chasseur →
  Exterminateur → Faucheur) en une seule "chaîne" ; `chainProgress(chain, S)` calcule le palier
  actif (premier non débloqué, ou le DERNIER si la chaîne est 100% terminée — jamais un check vert
  sur un palier intermédiaire) ; `sortChainsForDisplay()` trie par % décroissant, chaînes finies en
  dernier ; `achievementSilverTotals()`/`achCatCompletion()`/`recentlyUnlockedAchievements()`
  alimentent la vue d'ensemble, les tuiles de catégorie et la bande "derniers débloqués". Le rendu
  HTML (`renderAchievementsHtml()` et ses helpers `ach*Html`) reste dans `notifications-quests.js` ;
  CSS dans `styles/styles.css` (section "Reskin visuel panneau Succès", classes `.achOverview*`/
  `.achSpotlight*`/`.achCatCard`/`.achToggle*`/`.achRecent*`/`.achChain*`, nouveau token `--s3`).
- `treasure-craft.js` — le Trésor de Velia : drop, craft des morceaux, coffret secret.
- `level-xp-data.js` — la table d'XP requise par niveau (pure donnée).
- `compendium-react.js` — **NOUVEAU (2026-07-10)**, remplace la modale texte `openCompendium()`
  (toujours présente dans `notifications-quests.js` comme repli si React est indisponible). 3e
  fichier React du projet (exception documentée CLAUDE.md §7), port de la maquette JSX fournie par
  l'utilisateur. Ne lit QUE des données réelles : `ZONE_TIERS` (les "mondes" du jeu, avec leur vrai
  flag `locked`) comme groupement haut niveau, `GEAR_TIERS` en sous-groupe (comme l'ancienne
  modale), `penMasteryItemList()`/`S.penMastery`/`S.enhPeakByName` pour la Maîtrise PEN. **Ne
  reproduit PAS** le bonus de stat par "maîtrise de set" inventé par la maquette (fictif, absent du
  vrai jeu — voir le commentaire en tête de fichier). Clic sur un objet → zones où le farmer → clic
  sur une zone → vraie téléportation (`travelTo`) + confirmation (`floatTxt` + toast temporaire).
  Ouvert via `openCompendiumReact()` (`#btnCompendium`/`#ztCompendium`, `backend/game-supabase.js`),
  monté dans `#compendiumModalRoot` (`index.dev.html`). Alimente aussi `player_stats.compendium_pct`
  (`compendiumOverallPct()`, `core/game-core.js`) pour le suivi admin agrégé.
- `patch-notes-engage-react.js` — 4e fichier React du projet (exception documentée CLAUDE.md §7),
  port de `patch-notes-system.jsx`/`patch-notes-pipeline.md` fournis par l'utilisateur. Panneau
  React COMPLET (`openPatchNotesReact()`/`#patchNotesModalRoot`, même famille que le Compendium/le
  modal de reconnexion) — timeline versionnée, recherche, filtre par catégorie (`PATCH_CATS`), vue
  controverse (admin/mod), karma + commentaires par ligne. Remplace l'affichage de l'ancien panneau
  HTML (`renderPatchNotesPanel`/`renderPatchEntryHtml`, `backend/game-supabase.js`, gardé comme
  repli si React est indisponible) — pagination (`computePatchPages`/`patchPageStart`) et suivi de
  lecture (`readPatches`/`seenThisSession`/`commitPatchRead`/`unreadPatchCount`) restent la SEULE
  source de vérité côté vanilla, React ne fait que les afficher. Tags sévérité/plateforme/nature/
  sous-catégorie/comparateur avant-après tous réintégrés dans les cartes React (aucune donnée
  perdue par rapport à l'ancien panneau). Backend : `patch_note_votes`/`patch_note_comments`/
  `patch_note_comment_reports` (RPC-only, filtre anti-insulte serveur via l'extension `unaccent`,
  jamais contournable comme un filtre client seul) — voir
  `supabase/migrations/20260710140000_patch_notes_votes_comments.sql`. Panneau de modération
  volontairement PAS dupliqué ici (déjà une section admin dédiée,
  `src/admin/admin-panel.js:renderAdminPatchNotesModeration`).

Attention : ce dossier ne contient PAS les modes de comportement de l'IA (combat/farm) —
ils vivent dans `combat/ai-mode.js` malgré une confusion historique (ils avaient atterri ici
par accident lors d'un gros découpage, corrigée depuis).

## `tutorials.js` — moteur de tutoriel + les 3 parcours

Extrait de `backend/game-supabase.js` le 2026-07-22 (audit repo P5) : c'est de l'onboarding
joueur, pas du reseau -- seul `reportTutorialProgress()` parle a Supabase. Le fichier est
declare dans `index.dev.html` juste apres `game-supabase.js`, a la place exacte qu'occupait ce
bloc dans l'original : cet ordre est le contrat (un seul scope global, pas de modules ES --
voir `backend/README.md`).

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
