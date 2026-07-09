# admin/

Outils réservés au compte admin — jamais visibles/actifs pour un joueur normal (chaque
fonction vérifie `isAdmin()` avant d'agir).

- `admin-panel.js` — panneau principal : reset de comptes/quêtes, registre de silver
  détaillé, liste des joueurs en ligne, sauvegarde d'un joueur ciblé, analytics, sanctions
  (ban/unban temporaire, sous-onglet Stats → 🚫 Sanctions).
- `enh-debug-tools.js` — boutons de debug pour forcer l'enchantement de tout le stuff équipé
  (max/reset/±1 rang). Charge après `inventory/inventory-ui.js` (réutilise
  `refreshEquipSlot`/`renderOptimization`/`drawPreviewChar`).

Sanctions (2026-07-18) : `admin_ban_player`/`admin_unban_player`/`admin_list_bans` (RPC,
`supabase/migrations/20260718140000_sanctions_ban_system.sql`), `isBanned()`
(`src/backend/game-supabase.js`, check bloquant au login via `get_my_ban_status`),
`canBanUuid()` (`admin-panel.js`, empêche l'admin de se bannir lui-même).

Palette du panneau admin (2026-07-19) : `ADMIN_THEMES`/`getAdminTheme()`/`setAdminTheme()`
(`admin-panel.js`) + `.admThemeRoot[data-adm-theme="..."]` (`src/styles/styles.css`) — un slider
en haut du panneau redéfinit localement `--gold`/`--panel`/`--ink`/`--danger` etc. pour retheme
tout le contenu admin existant sans toucher une seule règle CSS (`.adm*` lit déjà ces variables
via la cascade). Préférence purement locale à l'admin, persistée en `localStorage`
(`bdiAdminTheme`), jamais dans `S`/le compte joueur. Aucun effet joueur, pas de patch note.

Voir `ADMIN_MENU_PLAN.md` (racine du repo) pour l'état des lieux du panneau admin, les
prochaines évolutions envisagées (mini-éditeur de patch notes) et pourquoi le reste d'un plan
initial plus large (React, Sentry, i18n editor, staging, équipe multi-rôles...) a été
volontairement écarté à l'échelle actuelle du projet.
