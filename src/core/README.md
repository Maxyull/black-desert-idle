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
