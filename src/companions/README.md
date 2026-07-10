# companions/

Module Compagnons (onglet 🐾 dans le header, à côté de Boss). Contrairement au reste de
`src/`, ce dossier n'est **jamais** concaténé dans `build/source.js` par `scripts/build.py`
(qui ne lit que les `<script src="src/...">` de `index.dev.html`) : il tourne dans un
**iframe** chargé à la demande (`src/combat/boss.js:openCompanionsModule()`), au premier
clic sur l'onglet Compagnon, jamais avant.

Pourquoi un iframe plutôt qu'une intégration directe au bundle :
- Le module réutilise volontairement des noms génériques hérités du prototype (`SILVER`,
  `PETS`, `S`-like state, `toast`, `ST`, `CM`, `OM`...) qui entreraient en collision avec le
  scope global du jeu principal (tout `src/*.js` du bundle partage un seul `window`).
- Il a son propre système de couleurs (`:root` avec `--gold`, `--bg`...) qui écraserait les
  variables CSS du jeu si elles étaient chargées dans le même document.
- Économie fermée (2026-07-19, demande explicite) : Silver/inventaire de ce module sont
  totalement indépendants de ceux du jeu principal — pas de risque de double-comptage.
- Sauvegarde 100% locale (`localStorage['velia_idle_pets_save']`, clé dédiée) — pas de
  compte Supabase pour ce module en v1.
- Chargement paresseux garanti : tant que le joueur n'a pas cliqué sur l'onglet, aucun de
  ces fichiers n'est téléchargé ni exécuté.

**Migration rétroactive du roster (2026-07-19, demande explicite : "supprime les 48 pet pour tout
le monde")** : le roster de départ est passé à 0 pet le 2026-07-10 (`companions.roster.js`), mais
les sauvegardes locales déjà existantes gardaient leur roster antérieur — `localStorage` n'est
jamais réécrit tout seul. `petsRosterResetV1` (`companions.economy.js`) est un flag persisté qui
vide le roster UNE SEULE FOIS par sauvegarde, au premier `loadGame()` suivant ce changement (et au
premier `importSave()` d'un export antérieur) — silver/inventaire/progression restent intacts.
Même esprit que les migrations rétroactives du jeu principal (`S.migratedXxxVNNN`, CLAUDE.md §13),
adapté ici puisque ce module n'a pas de compte Supabase (sauvegarde 100% locale, pas de
`applySaveState()` central à brancher).

**Sync admin (2026-07-19, demande explicite)** : la sauvegarde reste 100% locale, mais
`companions.sync.js` pousse désormais un RÉSUMÉ de compteurs (jamais le roster/inventaire
complet) vers Supabase toutes les 60s, via la RPC `sync_companion_stats` (voir
`supabase/migrations/20260719190000_companion_stats.sql`) — pour alimenter le panneau admin
`Contenu → Compagnons`. Comme l'iframe est **same-origin** (pas de `sandbox`, voir
`combat/boss.js:openCompanionsModule`), le module réutilise directement le client
`sb`/`currentUser`/`isGuest()` déjà authentifié de la page hôte via `window.parent` — pas de
second SDK Supabase ni d'auth séparée dans l'iframe. Fire-and-forget, jamais bloquant, no-op
silencieux sans compte connecté (même garde que `queueFarmEvent`/`markItemTutorialSeen`
ailleurs dans le jeu). Nouveau compteur à vie `totalHatched` (`companions.economy.js`,
incrémenté dans `rollAndCreatePet()`, `companions.hatch.js`) — distinct de
`hatchCountSincePity` qui se remet à 0 à chaque pity déclenché.

**Passe UI/QoL + bug d'éclosion (2026-07-20, demande explicite)** :
- Bandeau `#wipBanner` (toujours visible, `companions.html`) rappelant que le module est en test
  (`TEST_BALANCE_DIVISOR`, voir CLAUDE.md §28) et que rien n'est relié au jeu principal.
- Titre du header changé en "Black Desert Idle Compagnon" ; bouton de fermeture `#hdrCloseBtn`
  ajouté DANS le module à côté de "FAMILIERS" (en plus du bouton "Fermer" déjà injecté par
  `combat/boss.js:openCompanionsModule` au-dessus de l'iframe) — appelle
  `window.parent.closeCompanionsModule()`.
- Collection : légende des badges 🥇🥈🥉ᵀᴼᴾ (indicateurs de candidat de fusion, pas un classement
  joueurs), tri par Tier (`sort-tier`), zoom de grille (`setCollZoom`, 3 crans) —
  `companions.collection.js`. Badge fusion centré dans le header (`#hdr-fusion-badge`,
  `updateHeaderFusionBadge()`), visible uniquement pendant une sélection de fusion.
- Disclaimer dans l'onglet Éclosion : les boutons ×1/×5/×10 (`bulkHatch`) sont un raccourci de
  TEST, seront retirés d'ici la fin des tests.
- Carte de réserve (`companions.sections.js:renderSecDetail`) resserrée (canvas 24px→18px,
  paddings réduits) mais avec Rareté+section ajoutées en aperçu (avant, seuls GS/Tier étaient
  visibles sans déplier).
- **Bug corrigé** : le compte à rebours d'incubation ne se mettait jamais à jour à l'écran (le
  tick décrémentait bien `incubSlots[].tl` en mémoire, mais rien ne rappelait `renderHatch()` — ni
  `ST()` au changement d'onglet, ni le tick lui-même) — symptôme rapporté : "le timer ne bouge
  pas, on ne peut pas acheter les œufs" (le bouton "Éclore" n'apparaissait jamais si le slot
  devenait prêt onglet déjà ouvert). Voir CLAUDE.md §28 "Pièges déjà rencontrés".
- Achievement "dur" `fusion_downgrade` (+ champ `hard:true` sur les achievements les plus
  exigeants) : se déclenche en fusionnant un Légendaire/Ancestral avec un pet plus faible ET en
  obtenant un résultat de rareté inférieure au meilleur des deux parents (`fusionLostHighRarityCount`,
  `companions.economy.js`, incrémenté dans `executeFusion`, `companions.fusion.js` — voir
  CLAUDE.md §28 pour le piège `bestRar` vs meilleur parent réel).

**Admin/PvP (2026-07-20, demande explicite : "creer les module d'admin... remplir le dashboard...
categorie pvp")** :
- `companions.sync.js` envoie désormais aussi des répartitions par rareté/tier/section
  (`computeCompanionBreakdowns()`, objets `{clé:compte}`) + `hard_achievements_count`/
  `fusion_downgrade_count` — voir `supabase/migrations/20260720100000_companion_stats_breakdowns.sql`.
  Le panneau admin (`Contenu → Compagnons`, `src/admin/admin-panel.js`) les agrège
  (`sumCompanionBreakdown`) en 2 camemberts (rareté, section) + 1 graphique en barres (Tier).
- `companions.pvp.js` (nouveau) — onglet ⚔️ PvP (9e tab) : bandeau verrouillé (🔒 vrai PvP
  joueur-contre-joueur pas encore livré, nécessite un serveur autoritaire) + un CLASSEMENT réel des
  familiers du joueur par puissance (`computePvpRanking`/`pvpPower`, alias de `normGS`). Base du
  futur matchmaking, fonctionne dès aujourd'hui sans dépendre du serveur PvP à venir.
- Le header du jeu principal (`ACTIVITY_TABS`, `src/combat/boss.js`) a désormais un onglet "PvP"
  verrouillé, même convention que Pêche/Mine/etc. — distinct du classement ci-dessus (celui-là est
  le PvP joueur-contre-joueur du jeu principal, pas les familiers).

**Bugs corrigés — sync admin totalement muette depuis sa création (2026-07-20, "toujours aucunes
stats declosion... verifie si tout est connecté a supabase")** : DEUX bugs cumulés dans
`companions.sync.js` empêchaient TOUTE synchro vers `companion_stats`, pour tous les comptes
(invité ou non), depuis la création du module :
1. `hostWin.sb`/`hostWin.currentUser` (lus via `window.parent`) étaient TOUJOURS `undefined` —
   `sb`/`currentUser` sont des `let` top-level dans `game-supabase.js`, et contrairement à `var` ou
   à une déclaration `function`, `let` au top-level d'un script classique NE devient PAS une
   propriété de `window`. Corrigé en ajoutant `getSbClient()`/`getCurrentUserForSync()` (des
   déclarations `function`, elles bien attachées à `window`) dans `game-supabase.js`, utilisées par
   `companions.sync.js` à la place d'un accès direct.
2. Même une fois (1) corrigé, `sb.rpc(...).catch(()=>{})` levait silencieusement
   `TypeError: ...catch is not a function` — le builder Postgrest renvoyé par `sb.rpc(...)`
   n'implémente QUE `.then()` (thenable), jamais `.catch()` directement (déjà rencontré une fois
   côté jeu principal, `log_playtime_ping`, `game-supabase.js` ~ligne 1004 — mais jamais généralisé
   aux 2 autres occurrences de `mark_item_tutorial_seen`, corrigées dans la même passe). L'exception
   était avalée par le `try/catch` englobant AVANT même que la requête HTTP ne parte. Corrigé en
   passant `await`/`.then(null, cb)` au lieu de `.catch()` direct.
Les deux bugs confirmés en conditions réelles (RPC appelée manuellement en direct, ligne insérée en
base, puis nettoyée) — voir tests `testRpcFireAndForgetCallsNeverUseBareCatch` (`tests/tests.js`)
et `syncCompanionStatsToServer reaches the RPC call and never throws...` (`tests/companions.spec.js`).

**Export/Import de sauvegarde JSON retirés (2026-07-20, demande explicite : "enlever import
export")** : `exportSave()`/`importSave()` (`companions.save.js`) et leurs boutons 💾/📥
(`companions.html`) supprimés — ne restait qu'un filet de sécurité local jamais relié à la
sauvegarde cloud (module 100% `localStorage`), source de confusion vu qu'aucune autre partie du jeu
principal n'expose ce genre de bouton. `resetSave()` (🗑️ Reset) reste seul mécanisme de remise à
zéro locale.

**Carte Collection compacte au zoom le plus dense (2026-07-20, demande explicite : "Colllection si
petite carte alors afficher tiers rareté et section et gs")** : au cran de zoom 120px, la ligne meta
verbeuse (rareté en toutes lettres + tier + section + type) débordait de la carte et se faisait
tronquer silencieusement par `.pet-card{overflow:hidden}` — perdant section/type/parfois GS sans
erreur visible. `renderGrid()` (`companions.collection.js`) bascule désormais sur `.card-meta-compact`
(pastille de rareté, `T{n}`, icône de section, badge GS) quand `collZoomIdx===0`, garanti de tenir
dans la largeur (vérifié via `scrollWidth<=clientWidth`). `setCollZoom()` re-render la grille au
changement de cran (bug annexe corrigé au passage : il ne changeait avant que la largeur CSS des
colonnes, jamais le contenu des cartes).

**Argent dépensé — compteur à vie (2026-07-20)** : `silverSpent` (`companions.economy.js`), jamais
remis à 0 contrairement à `SILVER`. Seul point d'incrément : `spendSilver(amount)` — TOUJOURS
utiliser cette fonction plutôt que `SILVER -=` directement pour toute future dépense (2 occurrences
actuelles, `companions.hatch.js:doHatch`/`bulkHatch`), sinon le compteur dérive silencieusement.

**Stats admin œufs/index/fusions (2026-07-20, demande explicite : "affichger stats pour oeuf,
moyenne doeuf eclos/jour, stats entiere liste des fusion et grph completion index")** :
- `created_at` (nouvelle colonne, jamais réécrite après le tout premier sync d'un joueur —
  contrairement à `updated_at`) sert de référence temporelle pour `avg_hatch_per_day`
  (`admin_companion_stats()`, moyenne PAR joueur puis moyennée, pas un total global/jours qui
  écraserait les joueurs récents).
- `unique_species_count` (nouvelle colonne) = nombre d'ESPÈCES distinctes du catalogue possédées
  (pas le nombre de pets) — calculé côté client (`new Set(PETS.map(p=>p.cat.name)).size`,
  `companions.sync.js`) et transmis à chaque sync. Alimente "Complétion Index" (admin) ET l'onglet
  "Tes stats" (joueur), comparé à `PET_CATALOG.length` (48, recopié en dur côté admin sous
  `COMPANION_CATALOG_SIZE` — même limite que `COMPANION_RARITY_LABELS`/`COMPANION_SECTION_LABELS`,
  admin-panel.js ne peut jamais charger `companions.catalog.js`).
- `admin_companion_player_list()` (nouvelle RPC, admin uniquement) — une ligne par joueur
  (fusions/percées/perdantes/œufs/index), affichée en table triée par fusions décroissantes dans
  `Contenu → Compagnons` (panneau admin). Distincte de `admin_companion_breakdown()` (répartitions
  agrégées rareté/tier/section, sans identité de joueur) — RPC dédiée plutôt qu'élargir celle-ci,
  même esprit que `admin_list_players`/`admin_wealth` séparés.
- Migration : `supabase/migrations/20260720130000_companion_stats_egg_and_index.sql`.

**Classement cross-joueurs (2026-07-20)** : `companion_leaderboard()` — SEULE RPC de ce module SANS
garde email (accessible à tout compte authentifié non-invité, même pattern que
`get_online_players()`) — classe par `pet_count` décroissant, résout le pseudo via
`profiles.pseudo` en priorité puis `player_stats.display_name`. Migration
`supabase/migrations/20260720140000_companion_leaderboard.sql`.

**Bug corrigé — le panneau admin réapparaissait pendant une session Compagnon (2026-07-20,
rapporté explicitement : "quand je reste longtemps dans compagnon le dashboard s'affiche")** :
sans rapport avec ce module lui-même — `showPlayerInventoryWindow()` (`game-supabase.js`, panneau
admin) ouvre une popup "Inventaire joueur" et sondait toutes les 400ms si elle était fermée pour
rappeler `openAdminPanel()`. Si cette popup restait ouverte en arrière-plan longtemps (l'admin
quitte le panneau admin pour aller tester Compagnon sans la fermer), puis finissait par se fermer,
le panneau admin réapparaissait de force en pleine session Compagnon. Corrigé : ne rouvre plus que
si `#adminOverlay` a encore la classe `open` au moment de la fermeture de la popup. Voir
`backend/README.md` pour le détail technique complet.

## Fichiers

- `companions.html` — page hôte de l'iframe : header, tabs, tous les panneaux, les 2
  modals (éclosion/fusion), le conteneur de toasts. Charge `companions.css` puis les
  scripts ci-dessous **dans l'ordre exact listé dans ses balises `<script>`** — cet ordre
  est significatif (voir plus bas).
- `companions.css` — feuille de style complète du module (thème sombre/or, polices
  Cinzel/Inter/JetBrains Mono), scope global à ce document puisqu'il vit dans son propre
  iframe.

### Scripts JS (ordre de chargement = ordre ci-dessous)

1. `companions.pixelart.js` — palettes/formes pixel-art (`PA`) + `drawPixelArt()`.
2. `companions.catalog.js` — `RARITIES`, `STAT_RANGES`, `SECTIONS` (drops par section),
   loot spécial (Caphras/Dopi/items de Boss), `PET_CATALOG` (48 familiers).
3. `companions.economy.js` — types d'œufs + œufs ciblés, `SILVER`, pity counter, compteurs
   de tracking pour achievements, streak de connexion quotidienne, inventaire + journal.
4. `companions.tier.js` — système de Tier (multiplicateur, XP requis), Gearscore
   (`curGS`/`normGS`/`gsPct`...), helpers rareté (`rc`/`rn`/`secById`...).
5. `companions.roster.js` — roster de départ (0 pet depuis le 2026-07-10, voir migration
   `petsRosterResetV1` plus haut), slots d'incubation, filtres de collection.
6. `companions.hatch.js` — utilitaires UI partagés (`ST`/`toast`/`OM`/`CM`/`fmtT`) + tout le
   flux d'éclosion (choix d'œuf, tirage, éclosion ×1/×5/×10).
7. `companions.pet-panel.js` — barres de stats, atelier de Caphras, bloc Tier détaillé.
8. `companions.sections.js` — navigation par section, slot terrain + réserve, déploiement.
9. `companions.collection.js` — tri/filtre/recherche, rendu de la grille de collection.
10. `companions.fusion.js` — calcul des odds de fusion, aperçu, exécution, modal résultat.
11. `companions.feed.js` — liste de nourrissage, nourrir un/tous.
12. `companions.ticks.js` — header en direct + la boucle de jeu principale (`setInterval`
    1s : faim, XP de tier, loot en tâche de fond, drops spéciaux, achievements).
13. `companions.save.js` — sauvegarde/chargement localStorage, rattrapage hors-ligne, reset
    (export/import JSON retirés le 2026-07-20, voir plus haut).
14. `companions.sync.js` — pousse un résumé de compteurs vers Supabase toutes les 60s
    (stats admin, voir plus haut) via `window.parent.sb`. Charge après `save.js` par
    lisibilité, aucune contrainte d'ordre réelle (appelée via `setTimeout`/`setInterval`).
15. `companions.index.js` — onglet Index (matrice Rareté×Tier + catalogue complet).
16. `companions.game-view.js` — onglet Jeu (personnage + pets actifs + inventaire + log).
17. `companions.hardinage.js` — champ isométrique animé (canvas) avec drops en direct.
18. `companions.achievements.js` — définitions des achievements, score de prestige.
19. `companions.pvp.js` — onglet PvP (classement LOCAL par puissance, bandeau verrouillé). Charge
    après `tier.js`/`roster.js` par lisibilité, aucune contrainte d'ordre réelle (appelée via `ST(8)`).
20. `companions.leaderboard.js` (2026-07-20) — onglet "Tes stats" + Classement (tab 9, `ST(9)`),
    distinct du classement PvP LOCAL ci-dessus : "Tes stats" (100% local, œufs ouverts/argent
    dépensé/fusions/index) + un vrai classement CROSS-JOUEURS via la RPC publique
    `companion_leaderboard()` (voir `supabase/migrations/20260720140000_companion_leaderboard.sql`),
    même pattern `window.parent.getSbClient()` que `companions.sync.js`.
21. `companions.main.js` — **doit rester en dernier** : `renderAll()` et le bootstrap final
    (`loadGame()` puis `checkDailyStreak()`/`renderAll()`).

Comme pour le jeu principal, tout ce document vit dans un seul scope global partagé entre
scripts (pas de modules ES) — l'ordre ci-dessus n'a d'importance que pour le code exécuté
immédiatement au chargement (déclarations de données, le bootstrap final) ; les fonctions
appelées plus tard (clics, `setInterval`) peuvent référencer n'importe quel fichier de la
liste sans contrainte d'ordre.
