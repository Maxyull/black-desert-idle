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
- `achievements-data.js` — les définitions des succès (`ACHIEVEMENTS`). Charge après
  `core/game-core.js` : certains objectifs (`target: ZONES.length`, `PRI_IDX`...) sont
  évalués immédiatement au chargement.
- `treasure-craft.js` — le Trésor de Velia : drop, craft des morceaux, coffret secret.
- `level-xp-data.js` — la table d'XP requise par niveau (pure donnée).

Attention : ce dossier ne contient PAS les modes de comportement de l'IA (combat/farm) —
ils vivent dans `combat/ai-mode.js` malgré une confusion historique (ils avaient atterri ici
par accident lors d'un gros découpage, corrigée depuis).
