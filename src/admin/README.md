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

**Tutoriels d'objets — stats (2026-07-19)** : `renderAdminItemTutorials` (`Contenu → Tutoriels
d'objets`) affiche qui a terminé/passé chaque tutoriel du nouveau système d'onboarding progressif
(`ITEM_TUTORIALS`, `src/progression/notifications-quests.js`), via `admin_item_tutorial_stats()`
(migration `20260719160000_item_tutorials.sql`). Lecture seule (pas d'éditeur, pas de reset).
Exclut désormais `tutorial_id='onboarding'` (voir juste en dessous) — sinon son calcul aurait
compté à tort les tentatives "en cours" comme terminées (migration
`20260719180100_exclude_onboarding_from_item_tutorial_stats.sql`).

**Stats Onboarding (2026-07-19, demande explicite : "ajoute des stats sur l'onboarding")** :
`renderAdminOnboarding` (`Contenu → Onboarding`), distincte de la section ci-dessus — suit
spécifiquement le tutoriel d'arrivée (`TUTORIAL_STEPS`, 21 étapes, `src/backend/game-supabase.js`)
via `admin_onboarding_stats()` (démarré/terminé/passé/en cours) et `admin_onboarding_dropoff()`
(funnel : à quelle étape les joueurs restent bloqués). Migration
`20260719180000_onboarding_stats.sql` : généralise `item_tutorials_seen` (colonnes `last_step`/
`completed` ajoutées) et `mark_item_tutorial_seen` (2 nouveaux paramètres optionnels, DROP de
l'ancienne signature à 2 arguments avant recréation). Le tutoriel d'arrivée n'a AUCUN
déclenchement automatique à la 1ère connexion (seulement un bouton dans le Wiki) — ce panneau
permet justement de mesurer ce taux de démarrage très faible, pas seulement le taux de complétion.

**Nouveaux tutoriels d'objets/actions (2026-07-19)** : `ITEM_TUTORIALS.trash` (1 seul
déclenchement pour toute la partie, au tout premier trash de zone ramassé — 16 objets différents
unifiés) et `ITEM_TUTORIALS.enchant`/`.market`/`.boss` (tutoriels d'ACTION, déclenchés
manuellement au premier usage réel via `maybeQueueTutorialById`, pas au ramassage d'un objet) —
voir `src/progression/README.md` pour le détail.

**Stats Compagnons (2026-07-19, demande explicite)** : `renderAdminCompanions` (`Contenu →
Compagnons`) — le module `src/companions/` (iframe isolée, 100% local jusqu'ici) pousse désormais
un résumé de compteurs (familiers, Silver compagnon, œufs éclos, fusions, streak de connexion,
pity déclenché, succès complétés) via `admin_companion_stats()` (migration
`20260719190000_companion_stats.sql`), alimentée par `src/companions/companions.sync.js` toutes
les 60s. "Joueurs synchronisés" ne compte QUE ceux ayant réellement ouvert l'onglet Compagnon au
moins une fois — jamais les invités (RPC réservée aux comptes connectés, comme partout ailleurs).
Lecture seule, pas d'éditeur.
Enrichi le 2026-07-20 (demande explicite : "remplir le dashboard de tout ce que contient en
graph") : 2 camemberts (rareté, section) + 1 graphique en barres (Tier), alimentés par
`admin_companion_breakdown()` (une ligne JSONB par joueur, agrégée côté client via
`sumCompanionBreakdown()`) — voir migration `20260720100000_companion_stats_breakdowns.sql`.
Libellés rareté/section recopiés en dur (`COMPANION_RARITY_LABELS`/`COMPANION_SECTION_LABELS`,
`admin-panel.js`) car `RARITIES`/`SECTIONS` vivent dans `companions.catalog.js`, jamais chargé
dans le bundle principal — à tenir à jour à la main si le catalogue du module change.

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

**Bug du log d'onboarding corrigé (2026-07-20, demande explicite : "onboarding log a revoir")** :
le tutoriel d'arrivée n'a qu'un point d'entrée (bouton du Wiki), mais rien n'empêchait un joueur
de le relancer après l'avoir déjà terminé -- chaque relance réécrivait `completed=false` et
`last_step=0` par-dessus la ligne déjà terminée, faisant disparaître sa complétion des stats et le
faisant réapparaître à tort dans le funnel d'abandon. `mark_item_tutorial_seen()` ne régresse
plus jamais une ligne `completed=true` (migration `20260719200000_fix_onboarding_replay_regression.sql`).

**Recherche dans la sidebar (2026-07-20)** : `#admNavSearch` (haut de `#adminSidebar`, sous
`.admNavHead`) filtre en direct les items de `ADMIN_SECTIONS` par libellé (fr/en) --
`wireAdminSidebarSearch()` dans `admin-panel.js`.

**Palette déplacée en haut à gauche (2026-07-20, demande explicite)** : les 5 thèmes
(`ADMIN_THEMES`) sont désormais de petites pastilles cliquables directement dans `.admNavHead`
(coin haut-gauche du panneau, toujours visible), plus une page dédiée dans "Système" --
`renderAdminThemeSwatchesHtml()`/`wireAdminThemeSwatches()` remplacent l'ancien item `theme` de
`ADMIN_SECTIONS` (slider) qui obligeait à naviguer jusqu'à Système pour changer de couleur.

**Alerte "puits nécessaire" (2026-07-20, demande explicite : "alerte sil y a trop de quelque
chose et qu'il faut créer un puit")** : `computeEconAlerts()` (admin-economy.js) compare
gagné/dépensé sur `admin_silver_ledger_by_category` -- si moins de 35% du silver gagné est
réellement dépensé (sortie du jeu), une bannière rouge apparaît sur le Dashboard ET sur Santé
économique recommandant d'ajouter un puits. Purement informatif, aucune action automatique.

**Plateforme d'inscription (2026-07-20, demande explicite)** : `admin_list_players()` renvoie
désormais `provider` (email/discord/google/github/anonymous, lu depuis
`auth.users.raw_app_meta_data`) -- affiché en icône à côté du pseudo dans "Liste des joueurs".
`admin_signups_by_provider()` alimente un camembert dans "Inscriptions" (Vue d'ensemble).
Migration `20260719210000_admin_list_players_provider.sql` (DROP obligatoire avant recréation,
le type de retour change).

**Invités désactivés + Google/GitHub (2026-07-20, demande explicite : "Désactive les invités,
ajoute inscription google, github")** : `startGuestOrShowAuth()` ne tente plus
`signInAnonymously()` pour un NOUVEAU visiteur -- affiche directement le formulaire de connexion
(les sessions invité déjà existantes avant ce changement continuent de fonctionner normalement,
rien n'est supprimé côté serveur). `doSignInGoogle()`/`doSignInGithub()` (game-supabase.js) même
pattern que `doSignInDiscord()`. ⚠️ Les providers Google/GitHub doivent être activés avec un
Client ID/Secret OAuth côté Dashboard Supabase (Authentication > Providers) -- action externe,
impossible à faire depuis le code.

**Twitter/X ajouté (2026-07-20, demande explicite : "peux tu ajouter twitter aussi")** :
`doSignInTwitter()`/`linkTwitterAccount()` (game-supabase.js), même pattern que Google/GitHub --
provider Supabase Auth `'twitter'` (nom conservé malgré le rebranding "X"). `PROVIDER_INFO.twitter`
(admin-panel.js) s'affiche automatiquement dans la colonne "Plate-forme" et le camembert
"Inscriptions" -- aucune migration nécessaire, `provider` était déjà lu génériquement depuis
`raw_app_meta_data`. ⚠️ Même limite que Google/GitHub : à activer côté Dashboard Supabase
(Authentication > Providers) avec un Client ID/Secret OAuth.

Voir `ADMIN_MENU_PLAN.md` (racine du repo) pour l'état des lieux du panneau admin et pourquoi le
reste d'un plan initial plus large (React, Sentry, i18n editor, staging, équipe multi-rôles...) a
été volontairement écarté à l'échelle actuelle du projet.
