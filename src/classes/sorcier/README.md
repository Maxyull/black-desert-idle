# classes/sorcier/

La sorcière — seule classe jouable actuellement.

- `skills-data.js` — les 10 sorts (`SKILLS`), le mana (`MANA_REGEN_PER_SEC`, `MANA_POTION`),
  les cooldowns (`cds`). **Charge AVANT `core/game-core.js`** : la barre de sorts est
  construite immédiatement au chargement et lit `SKILLS` à ce moment-là.
- `sorcier-render.js` — dessin du personnage sur le canvas (`drawWitchIso`, palette de
  couleurs par palier de stuff, corps/bâton/robe). **Charge juste après `core/game-core.js`**
  (pas après `world/render.js`) : `witchBodyOn` est lu au chargement synchrone par
  `hud()`/`drawPreviewChar()`, avant même que la boucle de jeu démarre — voir le piège de
  zone morte temporelle (TDZ) documenté dans `CLAUDE.md`.
