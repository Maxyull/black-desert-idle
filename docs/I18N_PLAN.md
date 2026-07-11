# Black Desert Idle — Plan Multilingue v1 (adapté au projet réel)

Adapté depuis le plan v1 fourni par l'utilisateur (`i18n-plan-v1.md`, stack React/TS/i18next
générique) au **vrai** projet : vanilla JS, un seul scope global partagé, pas de bundler pour le
runtime, pas de React sauf 4 exceptions explicites (CLAUDE.md §7). Les sections suivent le plan
d'origine un-à-un ; chaque écart est justifié par une contrainte réelle du repo, pas une préférence.

## 0. État actuel (avant ce plan) — à lire avant tout le reste

Le jeu a **déjà** un système bilingue FR/EN, ad hoc, en place depuis longtemps :

* Un global `let LANG = 'fr'` (`src/core/game-core.js:31-32`), persisté dans
  `localStorage['velia-idle-lang']`.
* Des **milliers** de ternaires inline dispersés dans quasiment tous les fichiers de `src/` :
  `LANG === 'fr' ? 'Texte français' : 'English text'`. Rien qu'un seul fichier (`game-core.js`)
  en contient des dizaines par écran (zones, inventaire, HUD...).
* Un pattern déjà aligné avec la section 6bis du plan d'origine pour les **données de jeu** :
  `label[LANG]` / `name[LANG]` / `desc[LANG]` sur des objets `{ fr: '...', en: '...' }` (zones,
  potions, items, patch notes...). Cette partie n'a **pas besoin d'être migrée**, elle correspond
  déjà au format cible.
* Un toggle binaire `#langToggle` (`src/backend/game-supabase.js:1351-1355`) qui inverse
  `LANG` et appelle `applyI18n()` (re-render partiel : `refreshInvUI()`, `hudFast()`, classes CSS
  `.langOpt`/`.authLangBtn`, `document.documentElement.lang`). Pas de rechargement de page — la
  plupart des écrans se redessinent à chaque frame/tick HUD et relisent `LANG` directement.

Conséquence directe pour ce plan : ce n'est **pas** une mise en place i18n sur un projet propre.
C'est une migration d'un système ad hoc pervasif vers un système à clés, sur un jeu en prod avec
des joueurs réels. Le risque de régression est réel et diffus (aucune frontière de module, voir
CLAUDE.md §7/§24) — la migration doit être incrémentale, jamais un big-bang sur tout `src/` d'un
coup.

## 1. Objectif

Même objectif que le plan d'origine : un système i18n propre basé sur des fichiers JSON par
langue et par domaine, pour remplacer progressivement les ternaires `LANG === 'fr' ? … : …` par
des clés de traduction. Pas de backend, pas de vote pour l'instant — base compatible avec le futur
système communautaire (proposition + vote + intégration Supabase, voir section 9).

## 2. Stack (adapté)

**Pas de React, pas de TypeScript, pas de bundler npm côté runtime** — contrainte du projet
(CLAUDE.md §7 : scope global partagé, React réservé à 4 fichiers approuvés explicitement, aucune
extension implicite).

* **i18next** (cœur seulement, **pas** `react-i18next`) — chargé en UMD depuis un CDN figé par
  SRI, exactement comme Supabase et React le sont déjà dans `index.dev.html` (`<head>`, même
  convention). `i18next` s'utilise très bien en vanilla JS via son API globale
  (`window.i18next.t(...)`), aucun besoin de binding React — et sur les 4 fichiers React
  existants, `i18next.t()` s'appelle exactement pareil, pas besoin de `react-i18next` là non plus.
* Pas de `i18next-http-backend` / pas de `i18next-browser-languagedetector` **en v1** — voir
  section 4 pour la justification (boot synchrone du jeu, seulement 2 langues au départ).
* Un seul niveau de séparation par domaine fonctionnel, comme prévu.

## 3. Structure des fichiers

Pas de `/src/locales/` (pas de bundler qui les embarquerait) ni de `/public/` (le repo entier est
servi statiquement par GitHub Pages, comme `meta/`). Les JSON de traduction vivent à la racine,
à côté de `meta/`, sur le même principe ("donnée hors bundle principal") :

```
/locales/
  fr/
    common.json          (boutons, labels génériques, HUD)
    combat.json          (combat/ai-mode.js, boss.js, boss-render.js, potions-*)
    inventory.json       (inventory-ui.js, gear-icons.js, gear-migrations.js)
    world.json           (zones-data.js, region-tiers-data.js, render.js)
    progression.json     (achievements, quêtes, XP, trésor Velia)
    market.json           (market.js)
    social.json           (chat.js)
    admin.json             (admin-panel.js, admin-economy.js, enh-debug-tools.js)
    wiki.json               (wiki-panel.js, WIKI_SECTIONS)
    patchnotes.json         (patch-notes-engage-react.js — repli HTML compris)
    auth.json               (connexion/inscription, game-supabase.js)
  en/
    (mêmes fichiers)
```

**Découpage aligné sur la feature map de CLAUDE.md §1**, pas sur les composants — mêmes domaines
que ceux déjà utilisés pour paralléliser des agents (§24), pour que "un agent = un domaine i18n =
un domaine de code" reste vrai partout.

**Cas à part : module Compagnons** (`src/companions/`). C'est un module **isolé** (iframe séparée,
`companions.html`, jamais bundlé par `scripts/build.py`, sauvegarde 100% `localStorage`, voir
CLAUDE.md §28). Il a besoin de sa **propre** instance i18next et de son propre namespace
(`/locales/{lang}/companions.json`), chargée indépendamment dans `companions.html` — ne pas
supposer qu'il partage l'instance i18next du jeu principal, ils ne partagent déjà rien d'autre.

## 4. Convention de clés

Identique au plan d'origine : `domaine.sous_contexte.element`, snake_case, une clé = une phrase
complète (jamais de concaténation `t('a') + t('b')`), EN comme source de référence, FR qui suit.

```json
// combat.json
{
  "combat.dodge": "Esquivé !",
  "combat.damage_dealt": "{{player}} inflige {{amount}} dégâts à {{target}}"
}

// world.json
{
  "world.zone_peaceful_badge": "ZONE PAISIBLE",
  "world.zone_no_monsters": "Aucun monstre"
}
```

Ne PAS créer de nouvelles clés pour les données déjà bilingues via `label[LANG]`/`name[LANG]`/
`desc[LANG]` (zones, items, potions, patch notes...) — ce format reste tel quel, il n'entre pas
dans i18next (voir section 0 et 8bis-adapté).

## 5. Configuration (chargement, adapté au boot synchrone du jeu)

⚠️ Le plan d'origine préconise `i18next-http-backend` (fetch dynamique) dès le départ pour ne pas
charger toutes les langues au boot. **Adaptation justifiée** : ce jeu n'a que 2 langues au
lancement de ce plan, et surtout, `world/render.js` démarre la boucle de rendu
(`requestAnimationFrame`) de façon synchrone en tout dernier dans l'ordre de chargement (CLAUDE.md
§6) — introduire un `fetch()` asynchrone dans le chemin de boot avant le premier rendu ajoute un
risque réel (écran vide/texte en clé brute le temps du fetch, échec réseau au chargement = jeu
qui ne démarre pas). Pour 2 langues, le coût mémoire de tout charger est négligeable face à ce
risque.

**v1 : ressources statiques embarquées** (comme le plan d'origine le déconseille... pour 3+
langues — ici 2) :

```js
// src/core/i18n-init.js — charge tôt, avant tout code qui appelle t()
i18next.init({
  lng: LANG,                    // réutilise le LANG existant (game-core.js), pas de doublon d'état
  fallbackLng: 'en',
  supportedLngs: SUPPORTED_LANGS, // voir section 7 — pas de binaire codé en dur
  resources: {
    fr: { common: FR_COMMON, combat: FR_COMBAT, /* ... */ },
    en: { common: EN_COMMON, combat: EN_COMBAT, /* ... */ }
  },
  ns: ['common', 'combat', 'inventory', 'world', 'progression', 'market', 'social', 'admin', 'wiki', 'patchnotes', 'auth'],
  defaultNS: 'common',
  interpolation: { escapeValue: false } // pas de sortie HTML échappée, le jeu construit du HTML via template strings partout
});
```

`FR_COMMON`, `EN_COMBAT` etc. sont de simples objets JS générés depuis les fichiers `/locales/`
(voir section suivante) — pas de `fetch()` au runtime en v1.

**Quand un 3e langue est ajoutée** (section "Roadmap" ci-dessous) : c'est le signal explicite pour
basculer sur `i18next-http-backend` + `loadPath: 'locales/{{lng}}/{{ns}}.json'`, exactement comme
le plan d'origine le décrit — pas avant, pour ne pas payer la complexité async avant d'en avoir
besoin.

**Comment les objets `FR_COMMON`/... arrivent en JS sans bundler** : un script `scripts/gen-locales.js`
(Node, exécuté par `scripts/build.py` juste avant la concaténation, même famille que Terser déjà
appelé par ce script) lit `/locales/**/*.json` et génère `src/core/i18n-resources.generated.js`
(un seul fichier, littéraux `const FR_COMMON = {...}`) — ce fichier généré est ensuite bundlé
normalement comme n'importe quel autre fichier `src/`. Ne jamais éditer ce fichier généré à la
main (même règle que `build/source.js`, CLAUDE.md §0 règle 5) ; éditer les JSON sources dans
`/locales/`, puis relancer `python scripts/build.py`.

Ordre de chargement (à insérer dans `index.dev.html`, voir CLAUDE.md §6) :
`src/core/i18n-resources.generated.js` → `src/core/i18n-init.js` → avant tout fichier qui appelle
`i18next.t()` au chargement immédiat (rare) ; en pratique, avant `game-core.js` suffit puisque
`LANG` y est déjà défini et que la quasi-totalité des appels `t()` se feront à l'intérieur de
fonctions de rendu (référence en exécution, pas en chargement immédiat — CLAUDE.md §7).

## 6. Usage dans le code (adapté, pas de composants React génériques)

```js
// avant (game-core.js, ternaire inline)
floatTxt(P.x, P.y, 80, LANG==='fr' ? 'Esquivé !' : 'Dodged!', { blue: true });

// après
floatTxt(P.x, P.y, 80, i18next.t('combat:combat.dodge'), { blue: true });
```

Avec interpolation :

```js
i18next.t('loot:loot.item_count', { count: 5 });
```

Dans les 4 fichiers React existants (CLAUDE.md §7), même appel, pas de `useTranslation` /
`react-i18next` :

```js
pneH('span', {}, i18next.t('patchnotes:patchnotes.karma_score'));
```

Ne PAS créer de wrapper `tr()`/`t()` maison en plus de `i18next.t()` — le projet a déjà une
fonction `tr(s)` (game-core.js:82) qui fait une traduction FR→EN via un dictionnaire `NAME_EN` ;
elle sert un cas différent (noms d'objets déjà en anglais canonique dans les données, traduits à
l'affichage) et n'est pas remplacée par ce plan — les deux coexistent, ne pas les confondre ni les
fusionner sans l'avoir vérifié au cas par cas.

## 7. Cas spécifiques au jeu

| Cas | Traitement |
|---|---|
| Pluriels | Syntaxe i18next v23+ (`_one`/`_other`), jamais de suffixe `_plural` maison |
| Genre grammatical FR | Formulations neutres, comme le plan d'origine |
| Données de jeu (zones, items, potions, patch notes) | **Déjà** au format `{fr,en}`/`label[LANG]` — ne pas migrer vers i18next, ce n'est pas son rôle (voir section 0) |
| Nombres (silver, XP, dégâts) | `Intl.NumberFormat(LANG==='fr'?'fr-FR':'en-US')` — un point d'attention : `awaySilverGained.toLocaleString(...)` (game-core.js:231) le fait déjà correctement pour ce cas précis, généraliser ce pattern partout où un nombre est actuellement formaté à la main |
| Dates/durées | `Intl.DateTimeFormat`/`Intl.RelativeTimeFormat`, comme le plan d'origine |
| Clé manquante | `fallbackLng: 'en'` — jamais de clé brute affichée ; ajouter un test de régression qui échoue si une clé utilisée dans `src/` n'existe pas dans `en/*.json` (voir section 8bis) |

## 8. Sélecteur de langue (adapté)

Le sélecteur existe déjà (`#langToggle`, `.langOpt`, `.authLangBtn`) — **pas besoin d'en créer
un**, seulement de le faire piloter `i18next.changeLanguage()` en plus de `LANG` :

```js
$a('langToggle').onclick = () => {
  LANG = LANG === 'fr' ? 'en' : 'fr';
  i18next.changeLanguage(LANG);   // ajouté : garde i18next synchronisé avec LANG
  try { localStorage.setItem('velia-idle-lang', LANG); } catch(e) {}
  applyI18n();
};
```

**Dette identifiée, pas corrigée par ce plan** : `#langToggle` est un toggle binaire FR/EN codé en
dur (`LANG === 'fr' ? 'en' : 'fr'`), exactement ce que le plan d'origine (section 7) déconseille
pour l'évolutivité. Le remplacer par une liste générée depuis `SUPPORTED_LANGS` (menu déroulant
plutôt qu'un toggle) est nécessaire **avant** d'ajouter une 3e langue, mais pas avant — le
documenter dans la checklist (section 10) plutôt que de le faire maintenant sans besoin réel
(cohérent avec la culture anti-sur-ingénierie du projet, CLAUDE.md §16/§25).

```js
const SUPPORTED_LANGS = ['fr', 'en']; // source unique — étendre ici quand une langue est ajoutée
```

## 9. Process de migration (v1, manuel, incrémental)

Contrairement à un projet neuf, il n'y a pas de "tout texte nouveau passe par une clé" à partir
d'une base vide — il y a des **milliers** de ternaires existants à migrer par-dessus un jeu en
prod. Process :

1. **Tout nouveau texte ajouté en dev** passe par une clé i18next dès l'écriture (jamais un
   nouveau ternaire `LANG === 'fr' ? … : …` à partir de maintenant — dette qu'on arrête de créer
   avant de rembourser l'existant).
2. **Migration de l'existant, par domaine, incrémentale** — voir section 11 (stratégie
   multi-agents) pour l'ordre et le découpage. Ne jamais migrer `game-core.js` en une seule passe
   (fichier le plus dense et le plus partagé, CLAUDE.md §24) — le découper en sous-lots (HUD,
   zones, inventaire résumé...) migrés un par un, testés entre chaque lot.
3. Script de vérification des clés manquantes (section 8bis suivante), lancé en CI/hook git dès
   que le premier domaine est migré — pas besoin d'attendre que tout soit migré pour l'activer.

## 8bis. Validation automatique des clés

```bash
node scripts/check-missing-translations.js
```

Vérifie, comme dans le plan d'origine :

1. Toute clé présente dans `en/*.json` existe dans `fr/*.json` (et inversement).
2. Les variables d'interpolation (`{{count}}`, `{{player}}`...) sont identiques entre `en` et
   `fr` pour une même clé.

Adaptation : vérifie **en plus** qu'aucune clé référencée par un appel `i18next.t('domaine:clé')`
dans `src/**/*.js` n'est absente des JSON — sinon un `git grep -oP "i18next\.t\('[^']+'\)"` simple
suffit à lister les usages et les comparer aux clés déclarées. Exit code non-zero bloque le commit
(hook git, à ajouter avec les autres garde-fous du projet, cohérent avec CLAUDE.md §11 politique
de tests).

Bonus : trier les clés JSON alphabétiquement pour éviter les conflits Git — pertinent ici en
particulier puisque plusieurs agents vont éditer des fichiers de domaines différents en parallèle
(section 11).

## 8ter. Contenu hors du bundle JS

* **`index.html`/`index.dev.html`** : `<title>`, meta description — actuellement statiques en
  français ; à traduire au chargement selon `LANG` détecté (lecture `localStorage` avant même
  `i18next.init()`, un petit script inline en tête de `<head>`).
* **Disclaimer Pearl Abyss** (footer/README) : doit exister en FR et EN dès la mise en place,
  cohérent avec le plan d'origine.
* **Aria-labels** : le jeu n'en a probablement presque aucun aujourd'hui (à vérifier par grep
  `aria-label` dans `src/` avant de commencer la migration d'un domaine — les ajouter en clé i18n
  directement, ne pas les laisser en dur si on les ajoute).
* **Messages d'erreur Supabase** (auth, RLS, réseau, `src/backend/game-supabase.js`) : mapping
  erreur → clé `auth.error.*`/`common.error.*`, plutôt que d'afficher le message brut Supabase
  (souvent en anglais technique, jamais adapté au joueur).

## 8quater. Tests avant de valider un domaine migré

* **Pseudo-localisation** ciblée sur le domaine migré (pas tout le jeu à la fois) : remplacer
  temporairement les clés du domaine par un texte factice étendu pour repérer un ternaire oublié
  dans ce domaine.
* **Test visuel FR** sur les écrans du domaine migré (boutons, tooltips, modales) — le français
  reste ~15-20% plus long, troncatures à vérifier notamment en mobile (`isMobileViewport()`,
  CLAUDE.md §14).
* **Test de régression dans `tests/tests.js`** (CLAUDE.md §11, politique déjà en place, pas une
  exception pour ce chantier) : au minimum, un test qui vérifie que `i18next.t()` ne renvoie
  jamais une clé brute (`t(...) !== 'domaine:clé'`) pour un échantillon de clés du domaine migré,
  et un test de non-régression sur l'ordre de chargement de `i18n-init.js` (même famille que
  `testSorcierRenderLoadsBeforeSyncStartupCallers`, CLAUDE.md §11).
* **Tester `index.dev.html` ET `index.html`** après chaque domaine migré — le fichier généré
  `i18n-resources.generated.js` passe par le même pipeline TDZ/bundle que le reste (CLAUDE.md §8).

## 10. Roadmap vers le système communautaire (v2, inchangé)

Identique au plan d'origine : les clés JSON restent la source de vérité, le futur système de
proposition/vote Supabase écrira dans ces mêmes clés (`translation_proposals` → export JSON
validé), pas de refonte de la structure de clés nécessaire à la migration v2.

**Roadmap langues** (ajout par rapport au plan d'origine, pour "penser qu'on peut rajouter des
langues") :

* Ajouter une langue = ajouter `/locales/{lang}/*.json` + l'ajouter à `SUPPORTED_LANGS` (section
  8) + régénérer `i18n-resources.generated.js`. Aucune autre modif de code tant qu'on reste sur le
  mode "ressources statiques" (section 5).
* **Dès la 3e langue ajoutée**, deux bascules deviennent nécessaires (pas avant, pour ne pas
  sur-ingénierer une v1 à 2 langues) :
  1. `i18next-http-backend` (fetch dynamique) plutôt que ressources statiques embarquées — évite
     de charger 3+ langues au boot.
  2. Remplacer `#langToggle` (binaire) par un menu déroulant généré depuis `SUPPORTED_LANGS`.

## 11. Stratégie multi-agents pour la migration (nouveau — répond à la demande explicite)

La migration du texte existant touche presque tous les fichiers de `src/`. Elle suit **exactement**
la convention déjà établie en CLAUDE.md §24 ("Agents en parallèle"), pas une nouvelle règle :

* **Un agent par domaine disjoint**, jamais par type de tâche générique. Domaines proposés pour ce
  chantier (alignés sur la structure `/locales/` de la section 3) : combat, inventaire, monde,
  progression, marché, social, admin, wiki/backend, patch notes, compagnons (module isolé, voir
  section 3).
* **Fichiers à un seul agent à la fois, jamais en parallèle** (liste CLAUDE.md §24, inchangée pour
  ce chantier) : `index.dev.html`, `src/core/game-core.js`, `supabase/migrations/`,
  `build/source.js`/`build/source.min.js`, `tests/tests.js`. `game-core.js` étant le fichier le
  plus chargé en ternaires `LANG`, sa migration doit être faite **séquentiellement**, en plusieurs
  petits lots (HUD, zones, inventaire résumé, enchantement...), jamais par deux agents en même
  temps ni même par un agent qui migre tout le fichier en une seule passe géante.
* **Si un agent a besoin d'un fichier déjà pris par un autre** (notamment `game-core.js` ou
  `tests/tests.js`) : il termine son propre domaine d'abord et revient plus tard sur ce fichier
  partagé, plutôt que d'attendre bloqué ou d'y toucher en même temps — cohérent avec la règle de
  fond CLAUDE.md §24 ("découper le travail par les dossiers ci-dessus, jamais par fichier
  partagé").
* **Un seul build + `window.runRegressionTests()` à la fin**, après avoir fusionné le travail de
  tous les agents d'une vague — jamais un build par agent en parallèle (CLAUDE.md §24).
* **Nouvelles clés vs domaines existants** : chaque agent de domaine crée/édite uniquement
  `/locales/{fr,en}/{son-domaine}.json` — jamais le fichier JSON d'un autre domaine, même règle de
  non-collision que pour le code source.

## 12. Checklist de mise en place

- [ ] Créer l'arborescence `/locales/{fr,en}/` avec les 11 domaines (section 3)
- [ ] Charger i18next (core, UMD/CDN, SRI) dans `index.dev.html`, même convention que
      Supabase/React
- [ ] Écrire `scripts/gen-locales.js` (JSON → `src/core/i18n-resources.generated.js`), l'appeler
      depuis `scripts/build.py` avant la concaténation
- [ ] Écrire `src/core/i18n-init.js` (ressources statiques v1, `SUPPORTED_LANGS`, `lng: LANG`)
- [ ] Brancher `i18next.changeLanguage()` dans le handler `#langToggle` existant
      (`game-supabase.js`)
- [ ] `scripts/check-missing-translations.js` (clés manquantes + variables + usages `src/`)
- [ ] Migrer domaine par domaine (section 11), en commençant par un domaine à faible risque et peu
      de fichiers (ex: `social`/chat, ou `market`) avant `game-core.js`
- [ ] Traduire `<title>`/meta description, disclaimer Pearl Abyss, mapping erreurs Supabase
- [ ] Test pseudo-localisation + test visuel FR par domaine migré (pas en un seul passage final)
- [ ] Ajouter les tests de régression i18n dans `tests/tests.js` au fur et à mesure (jamais tout à
      la fin)
- [ ] Documenter la convention dans `CLAUDE.md` (fait — voir section 31, ce document y est
      référencé)
- [ ] Une fois la 3e langue envisagée : bascule `i18next-http-backend` + menu déroulant
      `SUPPORTED_LANGS` (section 10)
