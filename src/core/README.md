# core/

Le noyau du jeu : état global, boucle principale, rendu HUD, FSM de combat, sauvegarde.

- `game-core.js` — `S` (état persistant), `EQUIP`/`INV` (équipement/inventaire), la FSM de
  combat (`fsm`, `combatTick`, `wolvesTick`), le HUD, la boucle (`loop`/`advanceSim`), et la
  sérialisation de sauvegarde (`getSaveState`/`applySaveState`).
- `i18n-resources.generated.js` — FICHIER GÉNÉRÉ (ne pas éditer à la main, même règle que
  `build/source.js`) : compile `/locales/{fr,en}/*.json` en `I18N_RESOURCES`/`I18N_NAMESPACES`.
  Régénéré par `scripts/gen-locales.js` (appelé automatiquement par `scripts/build.py`).
- `i18n-init.js` — initialise i18next (voir `I18N_PLAN.md`, `CLAUDE.md` §31). Charge EN PREMIER,
  avant `gear-icons.js` : `I18N_RESOURCES` doit déjà être là, et des fonctions comme `hud()`
  peuvent appeler `i18next.t()` de façon synchrone très tôt au chargement (même piège que celui
  documenté en section 8 de `CLAUDE.md`).

C'est le fichier central duquel dépendent presque tous les autres — il doit charger après
les fichiers de données pures (`world/zones-data.js`, `world/gear-tiers-data.js`,
`classes/sorcier/skills-data.js`...) car son code s'exécute en partie immédiatement au
chargement (`resetWorld()`, `DEFAULT_SAVE`, la construction de la barre de sorts). Voir
`CLAUDE.md` à la racine pour le détail de ces pièges.

Fortement découpé cette session (4045 → ~1700 lignes) ; ce qui reste est volontairement
resté ensemble car trop imbriqué (état lu/écrit à chaque frame) pour être séparé sans risque.

**Résumé du loot au retour → modal de reconnexion (2026-07-10)** : `addSilver()`/`gainXp()`/
`trackLoot()` accumulent `awaySilverGained`/`awayXpGained`/`awayLootCounts` (avec couleur/valeur
par objet) tant que `document.hidden` est vrai (le jeu continue de simuler en arrière-plan,
décision V317/2026-07-15) ; le niveau/% XP sont aussi capturés au moment où l'onglet passe caché
(`awayLevelBefore`/`awayPercentBefore`). `showAwayLootSummaryIfAny()` (déclenchée par
`visibilitychange` → visible) construit le payload complet et appelle `openReconnectModal()`
(`src/core/reconnect-modal-react.js`, **React**, 2e exception documentée CLAUDE.md §7 — port de
la maquette JSX fournie par l'utilisateur, plafond d'AFK volontairement retiré) qui affiche le
récap + niveau avant/après + historique réel des sessions (Supabase, `get_afk_history`) + record
perso `S.bestAfkSessionSilver` (pattern "record monotone", jamais recalculé). `recordAfkSession()`
(`backend/game-supabase.js`) journalise la session côté serveur (table `player_afk_sessions`,
fire-and-forget). Repli : si React/le point de montage `#reconnectModalRoot` sont indisponibles,
retombe sur l'ancien `showResetNotice()` (texte simple). Signal `document.hidden`, pas `isOffline`
(`backend/game-supabase.js`) : la simulation ne s'arrête jamais avec le réseau, "au retour" =
retour sur l'onglet.
Tests : `testAwayLootSummaryAccumulatesOnlyWhileHiddenAndResets`, `testAwayLevelSnapshotCapturedOnHide`,
`testBestAfkSessionSilverIsMonotone` (`tests/tests.js`).

**`MAX_STACK` relevé 9999 → 999999 (2026-07-10, rapporté explicitement : "pourquoi on peut se
retrouver avec plusieurs stack d'une meme ressources")** : `invAdd()` ne fusionne dans un stack
existant que si `qty < MAX_STACK` — un stack plein forçait la création d'un nouveau stack séparé
pour le même nom, consommant des cases du sac (192 max) sans raison sur une session de farm
longue. Contrairement au Trésor de Velia (`TREASURE_STACK_CAP`/`enforceTreasureStackCap`,
`progression/treasure-craft.js`, qui auto-vend l'excédent), les matériaux/craft normaux n'ont pas
de filet équivalent — relever le plafond plutôt qu'ajouter un mécanisme de vente auto (décision
explicite). Test : `testInvAddMergesPastOldMaxStackThreshold` (`tests/tests.js`).
