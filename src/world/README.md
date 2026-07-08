# world/

Tout ce qui décrit le monde farmable et son rendu visuel : zones, paliers de stuff/région,
scène canvas.

- `zones-data.js` — `ZONES[]`, la liste des zones de farm (mob, difficulté, table de loot).
  **Charge très tôt** : `resetWorld()` (dans `core/game-core.js`) la lit immédiatement.
- `gear-tiers-data.js` — `GEAR_TIERS`, `GEAR_ROLE`, échelle de puissance du stuff par palier de
  couleur (gris/blanc/vert/bleu). Charge après `inventory/gear-icons.js` (lit `ICO_MAT_*`).
- `region-tiers-data.js` — les 5 paliers de région (Velia à Edana), seul Velia est débloqué.
- `render.js` — rendu canvas de la scène : sol, décor, monstres, drops au sol, particules.
  Démarre la boucle de jeu (`requestAnimationFrame(loop)`) tout à la fin de son chargement —
  ne jamais insérer un `<script>` entre lui et la fin du body sans vérifier cette contrainte.
