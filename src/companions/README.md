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
5. `companions.roster.js` — roster de départ (40 pets), slots d'incubation, filtres de
   collection.
6. `companions.hatch.js` — utilitaires UI partagés (`ST`/`toast`/`OM`/`CM`/`fmtT`) + tout le
   flux d'éclosion (choix d'œuf, tirage, éclosion ×1/×5/×10).
7. `companions.pet-panel.js` — barres de stats, atelier de Caphras, bloc Tier détaillé.
8. `companions.sections.js` — navigation par section, slot terrain + réserve, déploiement.
9. `companions.collection.js` — tri/filtre/recherche, rendu de la grille de collection.
10. `companions.fusion.js` — calcul des odds de fusion, aperçu, exécution, modal résultat.
11. `companions.feed.js` — liste de nourrissage, nourrir un/tous.
12. `companions.ticks.js` — header en direct + la boucle de jeu principale (`setInterval`
    1s : faim, XP de tier, loot en tâche de fond, drops spéciaux, achievements).
13. `companions.save.js` — sauvegarde/chargement localStorage, rattrapage hors-ligne,
    export/import/reset.
14. `companions.sync.js` — pousse un résumé de compteurs vers Supabase toutes les 60s
    (stats admin, voir plus haut) via `window.parent.sb`. Charge après `save.js` par
    lisibilité, aucune contrainte d'ordre réelle (appelée via `setTimeout`/`setInterval`).
15. `companions.index.js` — onglet Index (matrice Rareté×Tier + catalogue complet).
16. `companions.game-view.js` — onglet Jeu (personnage + pets actifs + inventaire + log).
17. `companions.hardinage.js` — champ isométrique animé (canvas) avec drops en direct.
18. `companions.achievements.js` — définitions des achievements, score de prestige.
19. `companions.main.js` — **doit rester en dernier** : `renderAll()` et le bootstrap final
    (`loadGame()` puis `checkDailyStreak()`/`renderAll()`).

Comme pour le jeu principal, tout ce document vit dans un seul scope global partagé entre
scripts (pas de modules ES) — l'ordre ci-dessus n'a d'importance que pour le code exécuté
immédiatement au chargement (déclarations de données, le bootstrap final) ; les fonctions
appelées plus tard (clics, `setInterval`) peuvent référencer n'importe quel fichier de la
liste sans contrainte d'ordre.
