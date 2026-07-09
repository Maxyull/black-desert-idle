# combat/

Tout ce qui concerne le déroulement d'un combat et ses à-côtés : boss, loot, potions, VFX,
comportement de l'IA.

- `boss.js` — World Boss (Kzarka/Vell) : horaires, lobby, combat, récompenses. Depuis le
  2026-07-19 : pity du loot rarissime (`BOSS_PITY_THRESHOLD`, `S.bossPity`), pénalité de
  récompense sur mort (`bossDeathPenaltyMult`), bonus "1ère victoire de la semaine PAR boss"
  (`bossFirstKillOfWeek`, `S.bossLastKillWeek`), near-miss sur la roue de loot rare.
- `boss-render.js` — rendu canvas de la salle de boss (piliers, créature). Charge après
  `boss.js` (`bossLoop()` l'appelle).
- `boss-wheel-react.js` (2026-07-19, demande explicite : "je veux une roue react et que tout soit
  aligné") — roue de récompense rare (`BossWheelReact`, `mountBossWheelReact`, `wheelLandingDeg`,
  `wheelSegmentPath`), rendue en SVG via **React** (`React.createElement` pur, aucun JSX/bundler —
  SEULE exception React du projet, voir CLAUDE.md §7). Remplace l'ancienne roue CSS
  conic-gradient/`.bwIcon` (icônes en `translate(0,-70px)` débordant du cercle, cause du rendu
  "tordu" signalé) par une géométrie calculée (`wheelPolarToCartesian`). React/ReactDOM chargés en
  UMD depuis un CDN figé par SRI (`index.dev.html`), même convention que le CDN Supabase. Charge
  après `boss.js` (lit `BOSS_NEAR_MISS_CHANCE`/`BOSS_NEAR_MISS_MARGIN_DEG` au moment de l'appel,
  jamais au chargement — l'ordre n'est donc pas strictement requis, juste plus lisible ainsi).
- `loot-rolls.js` — tirage du loot à la mort d'un monstre (`rollGearDrop`, `rollWeaponDrop`,
  `rollDrops`) et gain d'XP (`gainXp`). Charge après `core/game-core.js` ET
  `progression/notifications-quests.js` (`gainXp` appelle `pushNotif`).
- `potions-data.js` / `potions-logic.js` — potions de vie : définitions puis usage
  (coût dynamique basé sur le revenu de la zone, déclenchement automatique en combat).
- `ai-mode.js` — les 2 sélecteurs de comportement IA : mode de combat
  (défensif/équilibré/overgeared) et mode de farm (loot/xp). Charge après `core/game-core.js`.
- `vfx.js` — particules visuelles des sorts (météore, glace, éclair...).
