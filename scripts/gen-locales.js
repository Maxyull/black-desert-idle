#!/usr/bin/env node
/*
 * Compile /locales/{lang}/{domaine}.json en src/core/i18n-resources.generated.js.
 * Voir docs/I18N_PLAN.md §5 et CLAUDE.md §31.
 *
 * Editer les JSON sources dans /locales/, jamais le fichier genere directement (meme regle que
 * build/source.js, CLAUDE.md §0 regle 5). Appele automatiquement par scripts/build.py.
 *
 * Usage : node scripts/gen-locales.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'locales');
const OUT_PATH = path.join(ROOT, 'src', 'core', 'i18n-resources.generated.js');
// Module Compagnons (CLAUDE.md §28/§31, I18N_PLAN.md §3) : iframe isolee, jamais bundlee --
// son namespace `companions` est genere dans un fichier SEPARE charge par companions.html
// (propre instance i18next), et EXCLU des ressources du jeu principal pour ne pas gonfler le
// bundle avec des cles que le jeu principal n'utilise jamais.
const COMPANIONS_NS = 'companions';
const COMPANIONS_OUT_PATH = path.join(ROOT, 'src', 'companions', 'i18n-resources.generated.js');

const LANGS = ['fr', 'en'];

function readDomainsForLang(lang) {
  const dir = path.join(LOCALES_DIR, lang);
  if (!fs.existsSync(dir)) {
    console.error(`ERREUR: ${dir} introuvable`);
    process.exit(1);
  }
  const domains = {};
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith('.json')) continue;
    const domain = file.slice(0, -'.json'.length);
    const full = path.join(dir, file);
    try {
      domains[domain] = JSON.parse(fs.readFileSync(full, 'utf8'));
    } catch (e) {
      console.error(`ERREUR: JSON invalide dans ${full}: ${e.message}`);
      process.exit(1);
    }
  }
  return domains;
}

function main() {
  const resources = {};
  const domainSets = {};
  for (const lang of LANGS) {
    resources[lang] = readDomainsForLang(lang);
    domainSets[lang] = Object.keys(resources[lang]).sort();
  }

  // garde-fou : les deux langues doivent exposer exactement les memes fichiers de domaine --
  // sinon un domaine present seulement cote FR (ou EN) planterait silencieusement au changement
  // de langue plutot que de tomber sur fallbackLng.
  const [a, b] = LANGS;
  const onlyInA = domainSets[a].filter(d => !domainSets[b].includes(d));
  const onlyInB = domainSets[b].filter(d => !domainSets[a].includes(d));
  if (onlyInA.length || onlyInB.length) {
    console.error(`ERREUR: domaines desynchronises entre locales/${a}/ et locales/${b}/`);
    if (onlyInA.length) console.error(`  seulement dans ${a}: ${onlyInA.join(', ')}`);
    if (onlyInB.length) console.error(`  seulement dans ${b}: ${onlyInB.join(', ')}`);
    process.exit(1);
  }

  // separe le namespace du module Compagnons (voir COMPANIONS_OUT_PATH plus haut)
  const companionsResources = {};
  for (const lang of LANGS) {
    if (resources[lang][COMPANIONS_NS]) {
      companionsResources[lang] = { [COMPANIONS_NS]: resources[lang][COMPANIONS_NS] };
      delete resources[lang][COMPANIONS_NS];
    }
  }

  const ns = domainSets[LANGS[0]].filter(d => d !== COMPANIONS_NS);
  const header = [
    '// FICHIER GENERE -- ne pas editer a la main.',
    '// Source : /locales/{fr,en}/*.json -- editer ces JSON puis relancer `node scripts/gen-locales.js`',
    '// (appele automatiquement par `python scripts/build.py`). Voir docs/I18N_PLAN.md §5, CLAUDE.md §31.',
    "const I18N_NAMESPACES = " + JSON.stringify(ns) + ';',
    'const I18N_RESOURCES = ' + JSON.stringify(resources, null, 2) + ';',
    ''
  ].join('\n');

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, header, 'utf8');
  if (Object.keys(companionsResources).length === LANGS.length) {
    const companionsHeader = [
      '// FICHIER GENERE -- ne pas editer a la main.',
      '// Source : /locales/{fr,en}/companions.json -- editer ces JSON puis relancer',
      '// `node scripts/gen-locales.js` (appele automatiquement par `python scripts/build.py`).',
      '// Charge par companions.html AVANT i18n.js (propre instance i18next du module, jamais',
      '// partagee avec le jeu principal -- voir CLAUDE.md §28/§31, I18N_PLAN.md §3).',
      'const COMPANIONS_I18N_RESOURCES = ' + JSON.stringify(companionsResources, null, 2) + ';',
      ''
    ].join('\n');
    fs.writeFileSync(COMPANIONS_OUT_PATH, companionsHeader, 'utf8');
  }
  const totalKeys = LANGS.reduce((sum, lang) => sum + Object.values(resources[lang]).reduce((s, d) => s + Object.keys(d).length, 0), 0);
  const companionsKeys = LANGS.reduce((sum, lang) => sum + Object.keys((companionsResources[lang] || {})[COMPANIONS_NS] || {}).length, 0);
  console.log(`i18n-resources.generated.js genere : ${ns.length} domaines, ${totalKeys} cles au total (${LANGS.join('/')}).`);
  console.log(`src/companions/i18n-resources.generated.js genere : ${companionsKeys} cles (${LANGS.join('/')}).`);
}

main();
