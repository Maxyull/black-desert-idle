# classes/sorcier/

La sorcière — seule classe jouable actuellement.

- `skills-data.js` — les 10 sorts (`SKILLS`), le mana (`MANA_REGEN_PER_SEC`, `MANA_POTION`),
  les cooldowns (`cds`). **Charge AVANT `core/game-core.js`** : la barre de sorts est
  construite immédiatement au chargement et lit `SKILLS` à ce moment-là.
- `sorcier-render.js` — dessin du personnage sur le canvas (`drawWitchIso`, palette de
  couleurs par palier de stuff, corps/bâton/robe). Charge après `world/render.js`.
