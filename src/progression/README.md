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
  évalués immédiatement au chargement.
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

Attention : ce dossier ne contient PAS les modes de comportement de l'IA (combat/farm) —
ils vivent dans `combat/ai-mode.js` malgré une confusion historique (ils avaient atterri ici
par accident lors d'un gros découpage, corrigée depuis).
