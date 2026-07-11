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
le monde")** : le roster de départ est passé à 0 pet le 2026-07-10 (`roster.js`), mais
les sauvegardes locales déjà existantes gardaient leur roster antérieur — `localStorage` n'est
jamais réécrit tout seul. `petsRosterResetV1` (`economy.js`) est un flag persisté qui
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
ailleurs dans le jeu). Nouveau compteur à vie `totalHatched` (`economy.js`,
incrémenté dans `rollAndCreatePet()`, `hatch.js`) — distinct de
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
  `collection.js`. Badge fusion centré dans le header (`#hdr-fusion-badge`,
  `updateHeaderFusionBadge()`), visible uniquement pendant une sélection de fusion.
- Disclaimer dans l'onglet Éclosion : les boutons ×1/×5/×10 (`bulkHatch`) sont un raccourci de
  TEST, seront retirés d'ici la fin des tests.
- Carte de réserve (`sections.js:renderSecDetail`) resserrée (canvas 24px→18px,
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
  `economy.js`, incrémenté dans `executeFusion`, `companions.fusion.js` — voir
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
erreur visible. `renderGrid()` (`collection.js`) bascule désormais sur `.card-meta-compact`
(pastille de rareté, `T{n}`, icône de section, badge GS) quand `collZoomIdx===0`, garanti de tenir
dans la largeur (vérifié via `scrollWidth<=clientWidth`). `setCollZoom()` re-render la grille au
changement de cran (bug annexe corrigé au passage : il ne changeait avant que la largeur CSS des
colonnes, jamais le contenu des cartes).

**Argent dépensé — compteur à vie (2026-07-20)** : `silverSpent` (`economy.js`), jamais
remis à 0 contrairement à `SILVER`. Seul point d'incrément : `spendSilver(amount)` — TOUJOURS
utiliser cette fonction plutôt que `SILVER -=` directement pour toute future dépense (2 occurrences
actuelles, `hatch.js:doHatch`/`bulkHatch`), sinon le compteur dérive silencieusement.

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
  admin-panel.js ne peut jamais charger `catalog.js`).
- `admin_companion_player_list()` (nouvelle RPC, admin uniquement) — une ligne par joueur
  (fusions/percées/perdantes/œufs/index), affichée en table triée par fusions décroissantes dans
  `Contenu → Compagnons` (panneau admin). Distincte de `admin_companion_breakdown()` (répartitions
  agrégées rareté/tier/section, sans identité de joueur) — RPC dédiée plutôt qu'élargir celle-ci,
  même esprit que `admin_list_players`/`admin_wealth` séparés.
- Migration : `supabase/migrations/20260720130000_companion_stats_egg_and_index.sql`.

**Classement cross-joueurs (2026-07-20, refonte "Classement Public" 2026-07-21)** :
`companion_leaderboard()` — SEULE RPC de ce module SANS garde email (accessible à tout compte
authentifié non-invité, même pattern que `get_online_players()`) — résout le pseudo via
`profiles.pseudo` en priorité puis `player_stats.display_name`. Migration
`supabase/migrations/20260720140000_companion_leaderboard.sql`.
- **Refonte 2026-07-21 (port à l'identique d'un mockup externe `classement-public.html` fourni par
  l'utilisateur, voir CLAUDE.md §30)** : 4 catégories (Prestige/Gearscore/Fusions/Achievements,
  onglets), podium top 3, recherche par pseudo, pagination (15/page), toggle "Ma position"
  (voisinage de rang) — tout re-trié CÔTÉ CLIENT sur les mêmes 100 lignes de `companion_leaderboard()`
  (pas de 2e round-trip par catégorie). Onglet Guildes du mockup RETIRÉ (aucun système de guilde en
  jeu, voir `src/social/chat.js`) ; pas de segmented control saison/all-time (le jeu n'a pas de
  notion de saison) ; pas d'indicateur de mouvement ▲▼ (nécessiterait un rang précédent stocké par
  snapshot, inexistant — un delta inventé serait trompeur).
- **`prestige_score`/`gs_max` calculés côté serveur (migration
  `supabase/migrations/20260721100000_companion_leaderboard_prestige.sql`)** : `companion_stats`
  gagne 2 colonnes agrégées, `gs_sum_with_tier` (Σ `normGS(p) + tier×20` sur tout le roster,
  poussée par `computeCompanionGsAggregates()` dans `companions.sync.js`) et `gs_max` (le plus haut
  `normGS` du roster). `companion_leaderboard()` calcule `prestige_score` à partir de ces agrégats
  EXACTEMENT comme `prestigeScore()` (`companions.achievements.js`) — même formule, deux endroits,
  à garder synchronisés si la formule change un jour. `sync_companion_stats()` passe de 15 à 17
  paramètres (DROP obligatoire de l'ancienne signature, règle du projet section 12).
  ⚠️ **Migration écrite mais pas encore appliquée en base au moment de ce commit** (pas d'accès
  Supabase authentifié dans cette session) — `companion_leaderboard()` échouera (colonnes/paramètres
  manquants) tant qu'elle n'est pas exécutée sur le vrai projet Supabase.

**Bug corrigé — le panneau admin réapparaissait pendant une session Compagnon (2026-07-20,
rapporté explicitement : "quand je reste longtemps dans compagnon le dashboard s'affiche")** :
sans rapport avec ce module lui-même — `showPlayerInventoryWindow()` (`game-supabase.js`, panneau
admin) ouvre une popup "Inventaire joueur" et sondait toutes les 400ms si elle était fermée pour
rappeler `openAdminPanel()`. Si cette popup restait ouverte en arrière-plan longtemps (l'admin
quitte le panneau admin pour aller tester Compagnon sans la fermer), puis finissait par se fermer,
le panneau admin réapparaissait de force en pleine session Compagnon. Corrigé : ne rouvre plus que
si `#adminOverlay` a encore la classe `open` au moment de la fermeture de la popup. Voir
`backend/README.md` pour le détail technique complet.

**Achat des slots d'œuf corrigé (2026-07-20, rapporté explicitement : "impossible d'acheter les
slots d'oeuf")** : `hatch.js` avait DEUX impasses — le slot verrouillé de départ
(`incubSlots[2].locked`, voir `roster.js`) n'avait AUCUN `onclick`, et le bouton "➕ slot
premium" ne faisait qu'un `toast()` factice sans jamais rien acheter. `unlockIncubSlot(i)`/
`buyExtraIncubSlot()` (nouveau, `hatch.js`) appellent réellement `spendSilver()` puis
mettent à jour l'état réel des slots (`incubSlots[i]`/`.push(...)`) — le slot débloqué/acheté
démarre `ready:true` (gratification immédiate, pas un nouveau minuteur à attendre).

**Breadcrumb du header (2026-07-20, demande explicite : "supprime familier")** : le fil d'Ariane
"Black Desert Idle Compagnon › FAMILIERS" affichait encore l'ancien mot "Familiers" — remplacé par
"COMPAGNON" (même style inline conservé, `companions.html`).

**Palette officielle DA appliquée (2026-07-20, demande explicite : "regarde claude.md et change la
palette de couleurs")** : `companions.css` (`:root`) suit désormais exactement CLAUDE.md §29
(fonds `#0b0f1a`/`#0e1422`/`#131a29`, bordures `#263049`/`#3a4665`, texte `#c7d0e6`/`#8a95b3`/
`#5c6785`, accents `#d4a955` or/`#7ea6ff` bleu/`#6fdc6f` vert/`#c0503c`+`#e08070` rouge) — remplace
l'ancien thème doré fantasy ad hoc (`#c8a96e`, fond `#080810`) qui n'avait jamais été aligné sur
cette DA. `--r0..--r5` (couleurs de rareté Commun→Ancestral) et les palettes pixel-art
(`pixelart.js`)/scène isométrique (`companions.hardinage.js`) sont volontairement PAS
touchées — elles codent un sens (rareté=couleur) ou sont du contenu artistique, hors périmètre
d'une DA structurelle (fonds/bordures/texte/accents). Les couleurs médaille 🥈/🥉 (argent `#b8bcc4`/
bronze `#cd7f32`, badges TOP2/TOP3 de fusion) restent aussi inchangées, distinctes de l'accent or
par nature (médailles, pas identité de marque). Comparatif avant/après vu par l'utilisateur avant
implémentation (Artifact, 3 propositions présentées, celle-ci — "officielle CLAUDE.md" — retenue
directement une fois trouvée dans le fichier).

**Bug de fond corrigé — tutoriels perdus avant même la connexion (2026-07-20, rapporté
explicitement : "L'onboarding ne dois pas s'enclencher si on ne s'est pas inscrit/connecté = jeu
non lancé arriere plan")** : `requestAnimationFrame(loop)` (`world/render.js`, jeu PRINCIPAL, pas
ce module) démarre sans condition dès le chargement du script, avant même que le joueur ait pu
s'authentifier (`#authOverlay` encore ouvert) — le jeu simule déjà combat/loot sur `DEFAULT_SAVE`
pendant cette fenêtre. `maybeQueueTutorialById()` (`progression/notifications-quests.js`) marquait
un tutoriel "vu" DÈS sa mise en file (pas après affichage réel) — un ramassage simulé pendant cette
fenêtre pré-auth privait donc DÉFINITIVEMENT le vrai joueur de ce tutoriel une fois connecté.
Corrigé par une garde `if (!currentUser) return false` (+ même garde en défense sur `startTutorial()`,
`backend/game-supabase.js`) — sans effet de bord tant qu'aucune session n'existe, le même événement
redéclenche normalement l'appel une fois authentifié. Sans rapport direct avec ce module (le bug
vit dans le jeu principal), documenté ici car explicitement rapporté depuis une session de test du
module Compagnon.

**Refonte visuelle (2026-07-20, demande explicite)** :
- Titre du header : "Black Desert Idle Compagnon" → "Black Desert Idle" (le mot "Compagnon" ne
  reste que dans le fil d'Ariane à droite, `COMPAGNON`, jamais dupliqué).
- Filtres de la Collection (section/rareté/tier) déplacés dans `.coll-controls`, directement à
  droite de la barre de recherche — auparavant sur leur propre rangée au-dessus.
- `zoom:1.25` sur `body` (`companions.css`) — agrandit tout le module (police, paddings, cartes,
  icônes) d'un coup, sans retoucher chaque mesure en dur. `zoom` plutôt que `transform:scale`
  (qui ne recalcule pas layout/scrollbars) — support universel sur Chromium, cible de ce jeu.

**Viewer 3D GLB — écran de test (2026-07-10, demande explicite : "on va integrer des model gbl" +
"a terme on va utiliser l'entièreté de ces fichier")** :
- Contexte : `output/loot/tiers/` (32 fichiers, 900 Mo) et `output/combat/tiers/` (30 fichiers,
  922 Mo) contiennent un `.glb` + textures par palier (T1→T5) pour chaque compagnon `sec:'loot'`
  (chats/oiseaux) et `sec:'combat'` (chiens/dragons) de `catalog.js` — noms de fichiers
  déjà alignés sur `art`/le nom des espèces. `output/` n'est pas suivi par git (~1,8 Go au total,
  bien au-dessus de la limite GitHub de 100 Mo/fichier de toute façon pour les plus gros T5).
- Hébergement : bucket Supabase Storage public **`companion-models`** (lecture publique, écriture
  réservée à l'admin — `auth.jwt()->>'email' = 'maxime.lacoste@icloud.com'`, même convention que
  les RPC `admin_*` du jeu principal), voir
  `supabase/migrations/20260710072116_companion_models_bucket.sql`. Convention de chemin :
  `{section}/{artKey}_{tier}.glb` (ex: `loot/black_mask_cat_T5.glb`), reprend directement la
  structure de `output/`. Upload fait manuellement via le Dashboard Supabase (pas d'accès à la clé
  `service_role` depuis les outils MCP disponibles ici — volontairement masquée) ; seul
  `loot/black_mask_cat_T5.glb` (31 Mo) est uploadé pour l'instant, comme fichier de test.
- Rendu : **Three.js**, vendorisé en local dans `vendor/three/`/`vendor/utils/` (jamais de CDN à
  l'exécution, même convention que React figé en SRI pour `boss-wheel-react.js`, voir CLAUDE.md
  §7). `vendor/three/three-bridge.js` est le SEUL fichier `type="module"` de ce dossier — il
  importe `three.module.min.js`/`GLTFLoader.js`/`OrbitControls.js` (imports ES imposés par la lib
  elle-même) et attache `window.THREE`/`window.GLTFLoader`/`window.OrbitControls`, pour que
  `companions.viewer3d.js` (script CLASSIQUE, scope global partagé comme le reste du module) les
  lise normalement — pont documenté dans le fichier lui-même. Un `<script type="importmap">`
  (`companions.html`, dans `<head>`) résout le spécificateur nu `"three"` que `GLTFLoader.js`/
  `OrbitControls.js` importent en interne.
  - **Piège de chemin relatif rencontré** : `GLTFLoader.js` importe `../utils/BufferGeometryUtils.js`
    (chemin relatif à SA PROPRE position). Comme `GLTFLoader.js` vit directement dans
    `vendor/three/` (pas dans un sous-dossier `loaders/` comme dans le paquet npm d'origine,
    `examples/jsm/loaders/GLTFLoader.js`), ce chemin résout vers `vendor/utils/`, PAS
    `vendor/three/utils/` — `BufferGeometryUtils.js` doit donc vivre à `vendor/utils/`, un niveau
    au-dessus de `vendor/three/`. Erreur silencieuse sinon : 404 réseau, `window.THREE` jamais
    posé, aucune exception JS visible sans inspecter la console réseau.
- **Extension aux 11 espèces (2026-07-20, "integre les menu 3D de la phase 1" = output/loot/tiers +
  output/combat/tiers)** : `COMPANION_MODEL_MAP` couvre désormais les 6 espèces `sec:'loot'`
  (Black Mask/Cloaked/Karlstein Cat, Grey Moon Cat, Sky Hawk, Golden Crow Sovereign) et les 6
  espèces `sec:'combat'` (Brown Fighting/Black Cloaked/Snow Wolfdog, Helter-Skelter Ceros, Young
  Black/Newborn Crimson Dragon), T1 à T5 chacune (55 combos). Les 2 fichiers hors convention
  (`sky_hawk_T3_preview_only.glb`, `grey_moon_cat_T5_v2.glb`) restent volontairement exclus. Le
  bouton "🧊 Voir en 3D" apparaît maintenant aussi sur les cartes de la Collection et de la réserve
  (Sections), pas seulement le pet déployé sur le terrain — toujours conditionné à
  `companionModelUrlFor(pet)` (jamais affiché pour un pet/tier sans fichier réellement uploadé).
  **Upload terminé (2026-07-20)** : les 60 fichiers canoniques (11 espèces × 5 tiers, hors les 2
  fichiers hors convention exclus) sont en ligne dans le bucket `companion-models`, vérifiés
  accessibles publiquement et chargeables (test réel : `young_black_dragon_T3.glb` chargé en
  687 ms). Upload fait via script `curl` local (clé `service_role` jamais committée, lue depuis un
  fichier temporaire supprimé immédiatement après usage).
- Écran isolé : nouvel onglet "🧊 Viewer 3D (TEST)" (tab 10, `ST(10)`, panel `#p10`,
  `companions.html`) — contexte WebGL créé/détruit à l'ouverture/fermeture de l'onglet
  (`initViewer3dIfNeeded()`/`disposeViewer3dIfActive()`, `companions.viewer3d.js`) plutôt que
  gardé actif en arrière-plan pendant que le joueur navigue ailleurs dans le module. Portée
  VOLONTAIREMENT limitée à cet écran de test — aucune icône 2D existante (roster/collection/
  incubation/hardinage) n'est remplacée tant que le pipeline n'est pas validé à plus large échelle.
  Tests : `tests/companions.spec.js` (`3D viewer tab loads Three.js locally...`) — vérifie que
  `window.THREE` se pose, qu'un `<canvas>` WebGL apparaît, et qu'un échec réseau du `.glb` (ex:
  404 si le fichier de test n'est pas encore présent dans l'environnement) est un message d'erreur
  géré proprement, jamais une exception JS non attrapée.
- **Collection : colonnes exactes 5-9 + pagination (2026-07-20, demande explicite : "ajout d'un
bouton choix combien par ligne 5 a 9, turn on of pagination")** :
- Remplace l'ancien zoom à 3 crans (largeur mini approximative, `COLL_ZOOM_STEPS`) par un choix
  EXACT du nombre de colonnes (`COLL_COLS_MIN=5`/`COLL_COLS_MAX=9`, `setCollColsPerRow()`,
  `collection.js`) — `repeat(N, minmax(90px,1fr))` (le plancher 90px évite qu'une carte
  devienne trop étroite pour son contenu à 9 colonnes exactes sur un petit écran, corrigé après un
  premier passage en `repeat(N,1fr)` sans plancher qui faisait déborder `.card-meta-compact`).
  Au-delà de 6 colonnes (`COLL_COLS_COMPACT_FROM=7`), bascule sur la variante compacte de carte
  (même logique que l'ancien zoom).
- Pagination on/off (`collPaginationOn`, `toggleCollPagination()`) : OFF par défaut (défilement
  continu, `.pet-grid` a déjà `overflow-y:auto`) ; ON découpe la liste filtrée/triée en pages de
  `collColsPerRow×4` cartes (`#coll-pager`, Précédent/Suivant). La pagination porte sur la liste
  APRÈS filtre/tri, jamais avant. `bestInSec`/le badge de fusion restent calculés sur TOUTE la
  collection, pas seulement la page affichée. Aucun état persisté dans la sauvegarde (préférence
  d'affichage pure).

**Sections : carte réserve encore resserrée + tri GS/Tier (2026-07-20, demande explicite : "Carte
reservce plus petite > trier par GS, Tiers")** : 2e passe de resserrement (canvas 18px→14px,
polices/paddings réduits une nouvelle fois) après un premier resserrement le même jour (voir plus
bas dans ce fichier). Tri ajouté (`setResSort()`/`sortReserveList()`, `sections.js`) :
boutons GS/Tier au-dessus de la liste de réserve, même pattern que `setSort()` de la Collection
(1er clic = décroissant, re-clic = inverse).

**Tri par défaut de la réserve = Tier (2026-07-20, demande explicite : "Tier par Tiers/GS")** :
`resSortMode` démarre sur `'tier'` (au lieu de `'default'`, ordre d'obtention) — Tier décroissant
en priorité, GS décroissant en départage à Tier égal (`sortReserveList()`, `sections.js`).
Test : `reserve defaults to sorting by Tier (GS as tiebreak)...` (`tests/companions.spec.js`).
Confirmé au passage : la modale "Voir en 3D" (`#pet3d-modal`) est un seul élément DOM partagé,
donc DÉJÀ de taille identique qu'elle soit ouverte depuis le terrain ou depuis la réserve — pas de
changement nécessaire pour la 2e demande de cette même série ("Sur terrain et reserve = meme taille
de modal").

**Version affichée bas gauche (2026-07-20, demande explicite : "ajoute version en bas a gauche")** :
`COMPANION_MODULE_VERSION` (`economy.js`) réutilise la MÊME numérotation `VNNN` que le
jeu principal (`meta/patch-notes-data.js`) plutôt qu'un compteur séparé — ce module ne peut pas
charger `meta/patch-notes-data.js` (scope global distinct, iframe isolée), donc pas de lecture
automatique possible : à bumper à la main à chaque patch note qui touche `sub:'compagnon'`. Affiché
via `#companion-version` (position:fixed bas gauche, même esprit que `#clientVersion` du jeu
principal). Test : `module version is displayed bottom-left...` (`tests/companions.spec.js`).

**Réserve à droite du terrain (2026-07-20, demande explicite : "afficher les pet en reserve a
droite du sur le terrain borner la taille de l'interface sur le terrain pour laisser placer a des
nouvelle carte en reserve de loger a coter")** : la carte terrain (`.terrain-slot.occ`) est bornée
à 260px de large, positionnée à gauche ; la réserve occupe l'espace restant à SA DROITE (plus en
dessous), en grille responsive (`repeat(auto-fill,minmax(150px,1fr))`) qui accueille naturellement
plusieurs cartes de réserve par ligne. Cartes de réserve réorganisées en 2 lignes (identité, puis
badges+actions) pour rester lisibles à cette largeur réduite. Test : `terrain card is width-capped
and the reserve sits to its right with room for multiple cards per row` (`tests/companions.spec.js`).

**Bug corrigé — un seul modèle 3D s'affichait vraiment (2026-07-20, rapporté explicitement : "je ne
vois pas mes model que le premier")** : `renderer.dispose()` (Three.js, `createThreeViewer()`,
`companions.viewer3d.js`) libère les ressources GPU mais PAS le contexte WebGL lui-même — repris
seulement au ramassage mémoire du `<canvas>`, sans garantie de timing. Les navigateurs plafonnent
le nombre de contextes WebGL VIVANTS simultanément (souvent ~16) : en ouvrant la modale 3D sur
plusieurs familiers d'affilée, les anciens contextes n'étaient jamais vraiment libérés, jusqu'à ce
que de nouveaux contextes échouent silencieusement (canvas vide). Corrigé en appelant aussi
`renderer.forceContextLoss()` dans `dispose()`. Test : `opening the 3D preview for many companions
in a row never fails to render (WebGL context leak)` (`tests/companions.spec.js`, 22 ouvertures
consécutives, largement au-dessus de la limite typique).

**Purge rétroactive du plafond de collection (2026-07-20, demande explicite : "supprime tout
compagnon au dessus de la limite")** : `trimRosterToCapIfNeeded()` (`companions.save.js`), migration
rétroactive `petsRosterCapV1` (même pattern que `petsRosterResetV1`) — au premier chargement suivant
l'ajout de `PET_ROSTER_CAP` (96), purge l'excédent d'une sauvegarde antérieure au plafond. Garde
TOUJOURS les pets déployés sur le terrain (même mal roulés — jamais casser une configuration
active), complète avec les meilleurs GS parmi le reste. Toast informatif si une purge a eu lieu.

**Sections : carte terrain format "carte à collectionner" (2026-07-20, demande explicite : "met les
pete taille carte pokemon")** : remplace la ligne horizontale compacte par une vraie carte portrait
(`.terrain-slot.occ`, `companions.css`) — grand art (140×140) en haut avec badges Tier/GS incrustés,
bandeau nom/rareté, corps stats/atelier Caphras, actions en bas. Bordure teintée par la couleur de
rareté du pet (`--r0..--r5`, variable CSS `--pcard-color`) — jamais une couleur ad hoc.

**Intégration réelle du 1er modèle (2026-07-10, "envoyer le premier test .glb")** : le pipeline
  Three.js est factorisé en `createThreeViewer(wrap, onStatus)` (renderer/scène/caméra/controls/
  loop/dispose réutilisables), utilisé par l'écran de test ET par une VRAIE modale `#pet3d-modal`
  ouverte depuis le panneau du pet déployé sur le terrain (`sections.js`). Bouton "🧊 Voir
  en 3D" affiché UNIQUEMENT si `companionModelUrlFor(pet)` renvoie une URL — `COMPANION_MODEL_MAP`
  (`companions.viewer3d.js`) liste les paires nom-de-pet/tier réellement uploadées (seul "Black Mask
  Cat" T5 pour l'instant) ; ne jamais deviner une URL non confirmée dans le bucket (404 silencieux
  géré proprement par `loadModel()`, mais autant ne pas afficher un bouton mort). Ajouter une entrée
  à `COMPANION_MODEL_MAP` dès qu'un nouveau `.glb` est uploadé. Test :
  `"Voir en 3D" button only appears for a pet with an uploaded model...` (`tests/companions.spec.js`).
- **Mise à jour de version de three.js** : retélécharger les 4 fichiers vendorisés depuis
  `https://unpkg.com/three@X.Y.Z/...` (`build/three.module.min.js`,
  `examples/jsm/loaders/GLTFLoader.js`, `examples/jsm/controls/OrbitControls.js`,
  `examples/jsm/utils/BufferGeometryUtils.js`), les replacer aux MÊMES chemins relatifs que
  ci-dessus (le piège de chemin relatif décrit plus haut reste valable à chaque mise à jour).

**Plafond de collection 96 (+4 buffer trade), complétion 240, retrait du zoom (2026-07-20)** :
- `PET_ROSTER_CAP = 96` (`roster.js`) : `doHatch()`/`bulkHatch()` refusent tout nouvel
  hatch au-delà (`petRosterRoomLeft()`), AVANT de dépenser le silver. `PET_ROSTER_CAP_WITH_TRADE_BUFFER
  = 100` documente 4 slots réservés à un futur système de trade — aucun code ne les consomme
  encore (pas de feature trade construite), volontairement laissés en headroom.
- Complétion Index 48×5=240 (voir plus haut, `companionIndexProgress()`).
- `zoom:1.25` (ajouté plus tôt le même jour, "zommer 25%+") retiré — entrait en conflit avec le
  contrôle de colonnes plus fin de la Collection (5-9 exactes).
- **Ré-agrandi ensuite via `transform:scale()`, PAS `zoom` (2026-07-20, "agrandi de 25%
  l'inferface pas de zoom compagnon")** : `body{width:80%;height:80vh;transform:scale(1.25);
  transform-origin:top left}` (`companions.css`) — mathématiquement équivalent à `zoom:1.25` pour
  le rendu final (même facteur d'agrandissement), mais SANS toucher la mise en page/la résolution
  des `<canvas>` (`zoom` change la taille effective du pixel CSS utilisée pour la mise en page ET
  la peinture, avec un risque de flou/désalignement des `<canvas>` pixel-art ET des canvas WebGL
  du viewer 3D selon le moteur — `transform` ne touche que la peinture finale). Piège vérifié :
  un ancêtre `transform` devient le containing block des descendants `position:fixed`
  (`.modal-bg`, `.toast-wrap`) — testé explicitement qu'ils couvrent quand même tout le viewport
  de l'iframe (pas seulement le body pré-scale à 80%). Le plancher `minmax(90px,1fr)` de la
  Collection protège contre le même risque de carte trop étroite qui avait justifié le retrait du
  `zoom`. Test : `body is scaled 1.25x via transform (not CSS zoom)...` (`tests/companions.spec.js`).
- `#updateToast` (jeu principal, `src/styles/styles.css`) : z-index relevé de 200 à 960, au-dessus
  de `#companionsOverlay` (950) — la popup de mise à jour restait invisible derrière le module
  Compagnon plein écran.

**Marché d'échange réel entre joueurs (2026-07-10, demande explicite : "vrai backend d'échange...
c'est fini la sauvegarde locale c'est sur supabase déjà")** : premier point de ce module qui fait
vraiment traverser un PET (pas juste des compteurs comme `companions.sync.js`) d'un compte à
l'autre — le reste de la sauvegarde (roster non mis en vente, inventaire, progression) reste
100% `localStorage` comme avant, seuls les pets IMPLIQUÉS dans une offre/contre-offre transitent
par Supabase le temps de la transaction.
- Schéma complet : `supabase/migrations/20260710150000_companion_pet_trade_market.sql` —
  `pet_trade_offers`/`pet_trade_counters`/`pet_trade_history`/`pet_trade_deliveries`/
  `pet_trade_notifications`, RLS par table, RPC `create_pet_trade_offer`/`cancel_pet_trade_offer`/
  `submit_pet_trade_counter`/`withdraw_pet_trade_counter`/`decline_pet_trade_counter`/
  `accept_pet_trade_counter` (transaction atomique : ferme l'offre, enregistre l'historique, crée
  2 livraisons, invalide AVEC notification les autres contre-offres pendantes)/
  `claim_pet_trade_delivery`/`mark_pet_trade_notifications_read`/`expire_pet_trade_offers` (prêt
  pour `pg_cron`, pas encore branché).
- `pet.uid` (UUID stable, `hatch.js:rollAndCreatePet`) — clé serveur, DISTINCTE de
  `pet.id` (compteur local, jamais envoyé). Migration rétroactive `migratePetUidV1()`
  (`companions.save.js`, gatée par `petsUidV1`) attribue un `uid` à tout pet créé avant son ajout.
- `companions.market.js` (nouveau, onglet 🔄 Marché, tab 11) — 3 sous-onglets (Marché/Mes
  contrats/Historique). Accès Supabase EXCLUSIVEMENT via `window.parent.getSbClient()`/
  `getCurrentUserForSync()`/`getMyPseudoForSync()` (ce dernier ajouté dans `game-supabase.js` pour
  ce besoin — même pattern que les deux premiers, `myPseudo` était un `let` top-level jamais
  attaché à `window`) — jamais `window.parent.sb` directement (même piège déjà corrigé dans
  `companions.sync.js`). `claimMarketDeliveries()`/`pollMarketNotifications()` tournent en
  arrière-plan (`setTimeout`/`setInterval`, indépendant de l'onglet ouvert) pour qu'un joueur
  reçoive son pet gagné même s'il ne rouvre pas l'onglet Marché tout de suite.
- Portée volontairement scopée à ce qui bloquait (schéma+RLS, transaction atomique, notification
  de contre-offre invalidée) — anti-abus avancé (wash-trading, cooldown création/annulation, limite
  quotidienne) et édition de contrat NON construits, voir
  `echange-compagnons-todo-backend.md` (fourni par l'utilisateur) pour le reste de la roadmap.
- Tests : `tests/companions.spec.js` (`rollAndCreatePet assigns a stable uid...`,
  `migratePetUidV1 assigns a uid to legacy pets...`, `Marché tab renders its 3 sub-tabs...`).

## Fichiers

- `companions.html` — page hôte de l'iframe : header, tabs, tous les panneaux, les 2
  modals (éclosion/fusion), le conteneur de toasts. Charge `companions.css` puis les
  scripts ci-dessous **dans l'ordre exact listé dans ses balises `<script>`** — cet ordre
  est significatif (voir plus bas).
- `companions.css` — feuille de style complète du module (thème sombre/or, polices
  Cinzel/Inter/JetBrains Mono), scope global à ce document puisqu'il vit dans son propre
  iframe.

### Scripts JS (ordre de chargement = ordre ci-dessous)

1. `pixelart.js` — palettes/formes pixel-art (`PA`) + `drawPixelArt()`.
2. `catalog.js` — `RARITIES`, `STAT_RANGES`, `SECTIONS` (drops par section),
   loot spécial (Caphras/Dopi/items de Boss), `PET_CATALOG` (48 familiers).
3. `economy.js` — types d'œufs + œufs ciblés, `SILVER`, pity counter, compteurs
   de tracking pour achievements, streak de connexion quotidienne, inventaire + journal.
4. `tier.js` — système de Tier (multiplicateur, XP requis), Gearscore
   (`curGS`/`normGS`/`gsPct`...), helpers rareté (`rc`/`rn`/`secById`...).
5. `roster.js` — roster de départ (0 pet depuis le 2026-07-10, voir migration
   `petsRosterResetV1` plus haut), slots d'incubation, filtres de collection.
6. `hatch.js` — utilitaires UI partagés (`ST`/`toast`/`OM`/`CM`/`fmtT`) + tout le
   flux d'éclosion (choix d'œuf, tirage, éclosion ×1/×5/×10).
7. `pet-panel.js` — barres de stats, atelier de Caphras, bloc Tier détaillé.
8. `sections.js` — navigation par section, slot terrain + réserve, déploiement.
9. `collection.js` — tri/filtre/recherche, rendu de la grille de collection.
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
20. `companions.leaderboard.js` (2026-07-20, refonte "Classement Public" 2026-07-21) — onglet "Tes
    stats" + Classement (tab 9, `ST(9)`), distinct du classement PvP LOCAL ci-dessus : "Tes stats"
    (100% local, œufs ouverts/argent dépensé/fusions/index/Score Prestige) + un vrai classement
    CROSS-JOUEURS via la RPC publique `companion_leaderboard()` (voir
    `supabase/migrations/20260721100000_companion_leaderboard_prestige.sql`), même pattern
    `window.parent.getSbClient()` que `companions.sync.js` — 4 catégories, podium, recherche,
    pagination, "Ma position" (voir plus haut pour le détail).
21. `companions.viewer3d.js` (2026-07-10) — écran de test du viewer 3D GLB (voir plus haut). Lit
    `window.THREE`/`window.GLTFLoader`/`window.OrbitControls` posés par
    `vendor/three/three-bridge.js` (module, asynchrone — géré via l'event `three-ready`). Ordre
    non strictement requis vis-à-vis des autres scripts classiques, placé par lisibilité juste
    avant `main.js`.
22. `companions.main.js` — **doit rester en dernier** : `renderAll()` et le bootstrap final
    (`loadGame()` puis `checkDailyStreak()`/`renderAll()`).

### `vendor/three/` — Three.js vendorisé en local (pas de CDN, voir plus haut)

- `three.module.min.js` — build ES module de three.js (v0.160.0).
- `GLTFLoader.js` / `OrbitControls.js` — modules additionnels officiels (`examples/jsm/`).
- `three-bridge.js` — SEUL fichier `type="module"` de ce dossier, pont vers les globals classiques
  (`window.THREE`/`GLTFLoader`/`OrbitControls`, event `three-ready`).
- `vendor/utils/BufferGeometryUtils.js` — dépendance de `GLTFLoader.js` (voir le piège de chemin
  relatif documenté plus haut : doit vivre ICI, pas dans `vendor/three/utils/`).

Comme pour le jeu principal, tout ce document vit dans un seul scope global partagé entre
scripts (pas de modules ES) — l'ordre ci-dessus n'a d'importance que pour le code exécuté
immédiatement au chargement (déclarations de données, le bootstrap final) ; les fonctions
appelées plus tard (clics, `setInterval`) peuvent référencer n'importe quel fichier de la
liste sans contrainte d'ordre.
