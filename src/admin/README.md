# admin/

Outils réservés au compte admin — jamais visibles/actifs pour un joueur normal (chaque
fonction vérifie `isAdmin()` avant d'agir).

- `admin-panel.js` — panneau principal : reset de comptes/quêtes, registre de silver
  détaillé, liste des joueurs en ligne, sauvegarde d'un joueur ciblé, analytics.
- `enh-debug-tools.js` — boutons de debug pour forcer l'enchantement de tout le stuff équipé
  (max/reset/±1 rang). Charge après `inventory/inventory-ui.js` (réutilise
  `refreshEquipSlot`/`renderOptimization`/`drawPreviewChar`).
