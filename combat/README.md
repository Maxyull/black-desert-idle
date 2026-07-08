# combat/

Tout ce qui concerne le déroulement d'un combat et ses à-côtés : boss, loot, potions, VFX,
comportement de l'IA.

- `boss.js` — World Boss (Kzarka/Vell) : horaires, lobby, combat, récompenses.
- `boss-render.js` — rendu canvas de la salle de boss (piliers, créature). Charge après
  `boss.js` (`bossLoop()` l'appelle).
- `loot-rolls.js` — tirage du loot à la mort d'un monstre (`rollGearDrop`, `rollWeaponDrop`,
  `rollDrops`) et gain d'XP (`gainXp`). Charge après `core/game-core.js` ET
  `progression/notifications-quests.js` (`gainXp` appelle `pushNotif`).
- `potions-data.js` / `potions-logic.js` — potions de vie : définitions puis usage
  (coût dynamique basé sur le revenu de la zone, déclenchement automatique en combat).
- `ai-mode.js` — les 2 sélecteurs de comportement IA : mode de combat
  (défensif/équilibré/overgeared) et mode de farm (loot/xp). Charge après `core/game-core.js`.
- `vfx.js` — particules visuelles des sorts (météore, glace, éclair...).
