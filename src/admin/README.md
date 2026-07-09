# admin/

Outils réservés au compte admin — jamais visibles/actifs pour un joueur normal (chaque
fonction vérifie `isAdmin()` avant d'agir).

- `admin-panel.js` — shell du panneau admin plein écran (`#adminOverlay`, refonte 2026-07-19) :
  registre `ADMIN_SECTIONS` (nav sidebar), ouverture/fermeture, sections Joueurs (liste/cible/
  sanctions/rôles + emplacements réservés Guildes/PvP), Contenu (boss mondiaux, ressources
  farmées, cron, trésor, table de loot), Compte (tests perso), Système (palette, reset serveur).
- `admin-economy.js` — section Économie (charge APRÈS `admin-panel.js`, s'insère dans
  `ADMIN_SECTIONS` au chargement immédiat) : santé économique, silver (registre + graphique SVG
  `buildSilverChartSvg`), activité horaire, richesse, loyalties, marché, volume du marché (top
  objets échangés, `admin_market_top_items`), éditeur de la table de loot en %
  (`admin_set_loot_rates`, table `game_config`), inscriptions par jour (`admin_signups_by_day`,
  pousse dans le groupe "Vue d'ensemble"), emplacement réservé Donations.
- `enh-debug-tools.js` — boutons de debug pour forcer l'enchantement de tout le stuff équipé
  (max/reset/±1 rang). Charge après `inventory/inventory-ui.js` (réutilise
  `refreshEquipSlot`/`renderOptimization`/`drawPreviewChar`). Reste intégré à l'inventaire, PAS
  dans `ADMIN_SECTIONS`.

**Utilisation des Pierres de Cron (2026-07-19)** : jusqu'ici seul le ramassage était tracké côté
serveur (`farm_events`, `kind='material'`) — la consommation pour protéger un enchantement
(`invRemoveAt`, `src/inventory/inventory-ui.js`) ne touchait que l'inventaire local, invisible
côté admin. Corrigé en journalisant aussi la consommation via le même `queueFarmEvent()`/
`farm_events` (kind `'cron_used'`, distinct du ramassage — `admin_farm_by_item` groupe par
`item_name` ET `item_kind`, jamais mélangés). `Contenu → Pierres de Cron` affiche désormais
farmé vs utilisé (camembert) sur 30 jours, même logique que le registre de silver.

**Bug corrigé (2026-07-19)** : le bouton fermer (`#closeAdmin`) vivait dans `#adminMainHead`,
réécrit intégralement par `openAdminSection()` à chaque changement de section — comme
`openAdminPanel()` appelle `openAdminSection()` juste après avoir posé le bouton, celui-ci
disparaissait dès l'ouverture du panneau (inutilisable sans recharger la page). Déplacé dans la
sidebar (`.admNavHead`, jamais réécrit par un changement de section) ; `openAdminSection()` ne
touche plus que `#adminMainTitle` (span dédié dans le header). Test de régression :
`testCloseAdminButtonSurvivesSectionSwitch`.

**Graphiques compacts (2026-07-19)** : `buildPieWithLegendHtml`/`buildPieChartSvg`/`mergeSmallSlices`
(camemberts, fusionnent automatiquement les tranches sous 4% dans "Autres") et `buildBarSeriesSvg`
(séries temporelles compactes) dans `admin-economy.js` — remplacent les anciennes piles de
`.admBarRow` qui s'étiraient sur toute la largeur du panneau (`flex:1` dans un conteneur plein
écran). Utilisés par Santé économique (sources/puits), Progression par zone + Gearscore, Activité
horaire, Richesse, Volume du marché, Inscriptions. `.admBars`/nouvelles classes plafonnées à
420px en CSS pour ne plus jamais s'étirer bord à bord.

**Panneau plein écran (2026-07-19)** : remplace l'ancienne modale à 4 onglets plats
(`openInfo()`/`#infoOverlay`, toujours utilisée par Wiki/Compendium/Succès/Patch notes, non
affectés). Nouveau conteneur `#adminOverlay` (sidebar + zone de contenu), voir `index.dev.html`.
Chaque item de `ADMIN_SECTIONS` a soit `render(container)` (charge ses propres données au clic),
soit `planned:true` (Guildes/PvP/Donations — roadmap confirmée, pas encore de code jeu derrière,
voir `ADMIN_MENU_PLAN.md` §0bis). Repli mobile : sidebar → barre horizontale scrollable
(`max-width:1024px`, même convention que `.catTabs` ailleurs dans le jeu).

**Taux de loot en direct (2026-07-19)** : `LOOT_RATES_LIVE` (`src/world/gear-tiers-data.js`) est
une copie mutable de `LOOT_RATES_V2`, éventuellement écrasée par un override chargé depuis
`game_config` (`refreshLiveLootRates()`, `src/backend/game-supabase.js`, appelé après connexion).
`gearDropChance()`/`jewelDropChance()` lisent toujours `LOOT_RATES_LIVE`, jamais `LOOT_RATES_V2`
directement — `LOOT_RATES_V2` reste la référence "valeurs par défaut du jeu". Si un taux est
réellement changé un jour via l'éditeur admin, penser à l'audit Wiki/Codex (CLAUDE.md §21).

Sanctions (2026-07-18) : `admin_ban_player`/`admin_unban_player`/`admin_list_bans` (RPC,
`supabase/migrations/20260718140000_sanctions_ban_system.sql`), `isBanned()`
(`src/backend/game-supabase.js`, check bloquant au login via `get_my_ban_status`),
`canBanUuid()` (`admin-panel.js`, empêche l'admin de se bannir lui-même).

Palette du panneau admin (2026-07-19) : `ADMIN_THEMES`/`getAdminTheme()`/`setAdminTheme()`
(`admin-panel.js`) + `.admThemeRoot[data-adm-theme="..."]` (`src/styles/styles.css`) — un slider
redéfinit localement `--gold`/`--panel`/`--ink`/`--danger` etc. sur `#adminOverlay` pour retheme
tout le contenu admin existant sans toucher une seule règle CSS (`.adm*` lit déjà ces variables
via la cascade). Préférence purement locale à l'admin, persistée en `localStorage`
(`bdiAdminTheme`), jamais dans `S`/le compte joueur. Aucun effet joueur, pas de patch note.

Voir `ADMIN_MENU_PLAN.md` (racine du repo) pour l'état des lieux du panneau admin et pourquoi le
reste d'un plan initial plus large (React, Sentry, i18n editor, staging, équipe multi-rôles...) a
été volontairement écarté à l'échelle actuelle du projet.
