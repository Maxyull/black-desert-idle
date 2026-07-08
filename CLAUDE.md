# Velia Idle — CLAUDE.md

Jeu idle inspiré de Black Desert Online. Un seul HTML servi statiquement par GitHub Pages
(pas de bundler, pas de build step), backend Supabase (auth, sauvegarde cloud, marché,
classement, chat). Repo `Maxyull/black-desert-idle`.

## Contrainte fondamentale : pas de modules ES, pas de bundler

Tout le JS est chargé via des balises `<script>` classiques dans `index.html`, en un seul
scope global partagé. **Il n'y a pas d'`import`/`export`.** Toutes les variables `let`/`const`/
`function` déclarées au niveau supérieur d'un fichier sont visibles par tous les fichiers
suivants (et uniquement les suivants).

Conséquence directe : **l'ordre des balises `<script>` dans `index.html` remplace le système
de dépendances.** Un fichier qui lit une variable au chargement immédiat (pas à l'intérieur
d'une fonction) doit être précédé par le fichier qui la définit — sinon `ReferenceError` et le
jeu ne démarre plus du tout.

### Les deux types de dépendance

- **Référence en exécution** (99% des cas) : une fonction lit `ZONES`/`S`/`INV`/... dans son
  corps. Ça ne s'exécute qu'au moment de l'appel (pendant la partie), donc l'ordre entre le
  fichier qui définit et celui qui utilise n'a **aucune importance** tant que les deux sont
  chargés avant que le joueur commence à jouer.
- **Référence au chargement immédiat** (rare mais critique) : du code qui s'exécute dès que le
  `<script>` est lu, PAS dans une fonction — un `for`/`forEach` en dehors de toute fonction, un
  appel de fonction au premier niveau, une valeur de propriété calculée immédiatement dans un
  littéral (`target: ZONES.length` dans un tableau `const`). Ici l'ordre est obligatoire.

Pièges déjà rencontrés et corrigés dans ce sens :
- `resetWorld()` (appelé au top-level de `core/game-core.js`) lit `ZONES` → `world/zones-data.js`
  doit charger avant.
- `let DEFAULT_SAVE = JSON.parse(JSON.stringify(getSaveState()))` (top-level de
  `core/game-core.js`) appelle `getSaveState()`, qui doit donc être définie dans le même
  fichier ou avant.
- `GEAR_TIERS` (tableau `const`) lit `ICO_MAT_*` immédiatement dans son littéral →
  `inventory/gear-icons.js` doit charger avant `world/gear-tiers-data.js`.
- `ACHIEVEMENTS` lit `ZONES.length`/`PRI_IDX`/`ENH_NAMES.length-1` immédiatement →
  `progression/achievements-data.js` doit charger après `core/game-core.js`.
- `const cds = {}; SKILLS.forEach(s => cds[s.id] = 0)` et la boucle qui construit la barre de
  sorts (`for (const s of SKILLS)` dans `core/game-core.js`) → `classes/sorcier/skills-data.js`
  doit charger avant `core/game-core.js`.

**Avant de déplacer une déclaration entre fichiers : grep le nom de la variable/fonction pour
voir si elle est utilisée hors d'un corps de fonction (`grep -nE "^[A-Za-z_$].*NOM"`). Si oui,
c'est un chargement immédiat — respecter l'ordre.**

Chaque `<script>` dans `index.html` a un commentaire juste au-dessus expliquant pourquoi il
doit être à cet endroit précis. Ne jamais réordonner sans lire ces commentaires.

## Architecture (organisation par domaine)

```
index.html                      ← reste à la racine (déploiement statique GitHub Pages)

core/
  game-core.js                  ← état global (S, EQUIP, INV, P), FSM de combat, HUD, boucle, sauvegarde
                                   (le vrai noyau — dense, tout le reste en a été extrait)

classes/
  sorcier/
    skills-data.js              ← SKILLS, mana (charge AVANT game-core.js)
    sorcier-render.js           ← dessin du personnage (charge APRÈS render.js)
                                   (dossier prêt à accueillir d'autres classes jouables)

world/
  zones-data.js                 ← ZONES[]
  gear-tiers-data.js            ← GEAR_TIERS, GEAR_ROLE, paliers de stuff
  region-tiers-data.js          ← paliers de régions (Velia/Heidel/Calpheon...)
  render.js                     ← rendu canvas de la scène (sol, sprites, particules)

combat/
  boss.js                       ← World Boss (lobby, combat, planning)
  boss-render.js                ← rendu canvas de la salle de boss
  loot-rolls.js                 ← tirage du loot, gain d'XP
  potions-data.js / potions-logic.js  ← potions de vie (données / usage)
  ai-mode.js                    ← modes IA combat (défensif/équilibré/overgeared) + farm (loot/xp)
  vfx.js                        ← particules de sorts

inventory/
  inventory-ui.js               ← paperdoll, grille, enchantement, auto-opti
  gear-icons.js                 ← génération d'icônes SVG (équipement/matériaux)
  gear-migrations.js            ← migrations rétroactives du stuff (rééquilibrages historiques)

progression/
  notifications-quests.js       ← notifications, succès (UI), courrier, compendium, quêtes
  achievements-data.js          ← définitions des succès
  treasure-craft.js             ← Trésor de Velia (craft)
  level-xp-data.js              ← table d'XP par niveau

market/
  market.js                     ← Marché commun (carnet d'ordres)

social/
  chat.js

admin/
  admin-panel.js                ← panneau admin (reset, analytics, screenshot joueur)
  enh-debug-tools.js            ← outils debug admin d'enchantement

backend/
  game-supabase.js              ← auth, cloud-save, RPC, classement

meta/
  patch-notes-data.js           ← historique des patch notes (pure donnée, croît avec le jeu)

tests/
  tests.js                      ← runner + assert(), 578+ tests de régression

styles/
  styles.css

supabase/
  migrations/                   ← SQL horodaté, jamais modifier une migration existante
  README.md
```

### Ordre de chargement actuel (référence — voir index.html pour la version à jour)

```
inventory/gear-icons.js          (autonome, charge en premier)
world/zones-data.js
world/gear-tiers-data.js         (après gear-icons.js : lit ICO_MAT_*)
progression/level-xp-data.js
world/region-tiers-data.js
combat/potions-data.js
classes/sorcier/skills-data.js
core/game-core.js                ← le noyau
progression/achievements-data.js (après game-core.js)
progression/treasure-craft.js
progression/notifications-quests.js
combat/ai-mode.js
combat/loot-rolls.js
combat/vfx.js
combat/potions-logic.js
combat/boss.js
combat/boss-render.js
inventory/inventory-ui.js
inventory/gear-migrations.js
admin/enh-debug-tools.js
world/render.js                  ← démarre la boucle de jeu (requestAnimationFrame) en tout dernier
classes/sorcier/sorcier-render.js
meta/patch-notes-data.js
backend/game-supabase.js
admin/admin-panel.js
social/chat.js
market/market.js
tests/tests.js                   ← jamais lancé automatiquement, voir window.runRegressionTests()
```

Chaque fichier ajouté doit être inséré dans `index.html` avec un commentaire expliquant sa
contrainte d'ordre (voir modèle des commentaires existants).

## Taille des fichiers

Pas de règle de découpe automatique à un seuil de lignes — ce qui compte, c'est la cohérence
du domaine et la sécurité du découpage (voir section chargement ci-dessus). Repères observés
sur ce projet :

| Lignes | Situation |
|--------|-----------|
| < 150 | Module ciblé (une feature précise : `combat/vfx.js`, `combat/ai-mode.js`) |
| 150–500 | Taille normale pour un module de domaine |
| 500–1000 | Encore gérable si le contenu est cohérent (un seul vrai sujet) |
| > 1000 | Envisager la découpe SI le contenu est un mélange de sujets séparables (voir `core/game-core.js`, historique de découpage) |

**Exception : la donnée pure append-only ne suit pas cette règle.**
`meta/patch-notes-data.js` (historique des patch notes) grossit avec le jeu par nature — ne
jamais forcer sa découpe.

## Nommage

```
feature-data.js       → constantes / tables pures (ZONES, GEAR_TIERS, SKILLS...)
feature-ui.js          → rendu DOM / panneaux
feature-logic.js       → calculs / logique métier
feature.js              → module cohérent quand data+logique+UI sont trop imbriqués pour séparer sans risque
```

Pas de `.jsx`/`service.js` (pas de React, pas de convention service layer — scripts globaux
classiques).

## Avant de déplacer du code entre fichiers

1. `grep -n "^[A-Za-z_$].*NOM_DE_LA_VARIABLE"` pour repérer tout usage hors corps de fonction
   (chargement immédiat).
2. Si trouvé : le fichier de destination doit charger dans le bon ordre relatif — documenter
   pourquoi en commentaire au-dessus du `<script>`.
3. Bump `?v=` dans **toutes** les balises `<script>`/`<link>` de `index.html` (sed global).
4. Reload preview, `window.runRegressionTests()` (578+ tests), **et** un test de comportement
   réel en direct via `preview_eval` quand l'extraction touche du code exécuté à chaque frame
   (FSM, HUD, boucle) — les tests automatisés ne couvrent pas tout, un chargement propre n'est
   pas une preuve de comportement correct.
5. Commit + push seulement après ces vérifications.

## Supabase

- `supabase/migrations/` : SQL horodaté (format `YYYYMMDDHHMMSS_description.sql`), jamais
  modifier une migration déjà appliquée.
- Toujours `DROP` l'ancienne signature d'une RPC avant de la recréer (sinon ambiguïté de
  surcharge = déconnexions silencieuses).
- Tables/fonctions/policies gérées en partie directement via les outils MCP Supabase, en
  partie via les migrations versionnées — voir `supabase/README.md` pour le détail historique.

## Workflow standard (déjà en mémoire, rappelé ici pour la cohérence du repo)

implémenter → bump `?v=` dans `index.html` → reload preview → `window.runRegressionTests()`
→ vérification visuelle/comportementale → commit → push direct (pas de confirmation
nécessaire, sauf changement à fort impact/risque — architecture, migration de données,
réorganisation large) → patch note si changement visible par les joueurs.
