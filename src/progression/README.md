# progression/

Tout ce qui fait avancer un compte au fil du temps, hors combat/loot brut : succès, quêtes,
courrier, compendium, craft du Trésor de Velia.

- `notifications-quests.js` — le plus gros fichier du dossier : centre de notifications,
  panneau Succès (UI), courrier (mailbox, fidélité), Compendium (progression par
  zone/boss/PEN), quêtes journalières/hebdomadaires. Charge après `core/game-core.js`,
  `achievements-data.js` et `treasure-craft.js`.
- `achievements-data.js` — les définitions des succès (`ACHIEVEMENTS`). Charge après
  `core/game-core.js` : certains objectifs (`target: ZONES.length`, `PRI_IDX`...) sont
  évalués immédiatement au chargement.
- `treasure-craft.js` — le Trésor de Velia : drop, craft des morceaux, coffret secret.
- `level-xp-data.js` — la table d'XP requise par niveau (pure donnée).

Attention : ce dossier ne contient PAS les modes de comportement de l'IA (combat/farm) —
ils vivent dans `combat/ai-mode.js` malgré une confusion historique (ils avaient atterri ici
par accident lors d'un gros découpage, corrigée depuis).
