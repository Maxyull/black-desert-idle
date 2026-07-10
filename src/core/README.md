# core/

Le noyau du jeu : état global, boucle principale, rendu HUD, FSM de combat, sauvegarde.

- `game-core.js` — `S` (état persistant), `EQUIP`/`INV` (équipement/inventaire), la FSM de
  combat (`fsm`, `combatTick`, `wolvesTick`), le HUD, la boucle (`loop`/`advanceSim`), et la
  sérialisation de sauvegarde (`getSaveState`/`applySaveState`).

C'est le fichier central duquel dépendent presque tous les autres — il doit charger après
les fichiers de données pures (`world/zones-data.js`, `world/gear-tiers-data.js`,
`classes/sorcier/skills-data.js`...) car son code s'exécute en partie immédiatement au
chargement (`resetWorld()`, `DEFAULT_SAVE`, la construction de la barre de sorts). Voir
`CLAUDE.md` à la racine pour le détail de ces pièges.

Fortement découpé cette session (4045 → ~1700 lignes) ; ce qui reste est volontairement
resté ensemble car trop imbriqué (état lu/écrit à chaque frame) pour être séparé sans risque.

**Résumé du loot au retour (2026-07-10, demande explicite : "Afficher un résumé du loot, au
retour")** : `addSilver()`/`trackLoot()` accumulent `awaySilverGained`/`awayLootCounts` tant que
`document.hidden` est vrai (le jeu continue de simuler en arrière-plan, décision V317/2026-07-15) ;
`showAwayLootSummaryIfAny()` (déclenchée par `visibilitychange` → visible) affiche le total puis
remet les compteurs à 0. Signal `document.hidden`, pas `isOffline` (`backend/game-supabase.js`) :
la simulation ne s'arrête jamais avec le réseau, "au retour" = retour sur l'onglet.
**Bug corrigé (2026-07-10, rapporté explicitement : "je vois pas le message de retour" puis "le
message de retour se met dans un modal en plein ecran")** : d'abord corrigé avec un toast
(`#achToastStack`), puis passé en vraie modale plein écran sur demande explicite — réutilise
`showResetNotice()`/`#resetNoticeOverlay` (`progression/notifications-quests.js`), déjà en place
pour les annonces importantes (ex: reset de compte) plutôt que dupliquer une nouvelle modale.
Test : `testAwayLootSummaryAccumulatesOnlyWhileHiddenAndResets` (`tests/tests.js`).

**`MAX_STACK` relevé 9999 → 999999 (2026-07-10, rapporté explicitement : "pourquoi on peut se
retrouver avec plusieurs stack d'une meme ressources")** : `invAdd()` ne fusionne dans un stack
existant que si `qty < MAX_STACK` — un stack plein forçait la création d'un nouveau stack séparé
pour le même nom, consommant des cases du sac (192 max) sans raison sur une session de farm
longue. Contrairement au Trésor de Velia (`TREASURE_STACK_CAP`/`enforceTreasureStackCap`,
`progression/treasure-craft.js`, qui auto-vend l'excédent), les matériaux/craft normaux n'ont pas
de filet équivalent — relever le plafond plutôt qu'ajouter un mécanisme de vente auto (décision
explicite). Test : `testInvAddMergesPastOldMaxStackThreshold` (`tests/tests.js`).
