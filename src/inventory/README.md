# inventory/

Équipement, sac, enchantement et tout ce qui touche à la gestion du stuff du joueur.

- `inventory-ui.js` — paperdoll (poupée d'équipement), grille du sac, panneau
  d'optimisation/enchantement, auto-équipement du meilleur stuff, table de loot affichée.
  Le plus gros fichier du dossier — cœur de l'UI inventaire.
- `gear-icons.js` — génération procédurale des icônes SVG (armes, armure, bijoux,
  matériaux, Pierre de Cron). Module autonome, **charge en tout premier** (avant même
  `world/zones-data.js`) : plusieurs constantes ailleurs lisent ses icônes immédiatement.
- `gear-migrations.js` — migrations rétroactives appliquées au stuff déjà possédé quand un
  rééquilibrage change les formules de stats (voir `S.migratedXxx` dans
  `applySaveState()`). Charge après `inventory-ui.js`.
