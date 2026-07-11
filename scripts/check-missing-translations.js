#!/usr/bin/env node
/*
 * Valide les traductions i18next du jeu (voir I18N_PLAN.md §8bis, CLAUDE.md §31).
 *
 * Trois choses verifiees :
 *   1. Toute cle presente dans locales/en/<domaine>.json existe dans locales/fr/<domaine>.json
 *      (et inversement).
 *   2. Les variables d'interpolation ({{var}}) sont identiques entre fr et en pour une meme cle.
 *   3. Tout appel `i18next.t('domaine:cle', ...)` trouve dans src/**\/*.js reference une cle qui
 *      existe reellement dans les DEUX JSON de ce domaine -- une cle utilisee mais jamais definie
 *      afficherait la cle brute au joueur (voir I18N_PLAN.md §7, "Clé manquante").
 *
 * Exit code non-zero si divergence -- destine a bloquer un commit/CI.
 *
 * Usage : node scripts/check-missing-translations.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'locales');
const SRC_DIR = path.join(ROOT, 'src');
const LANGS = ['fr', 'en'];

let errors = 0;

function err(msg) {
  console.error(`ERREUR: ${msg}`);
  errors++;
}

function interpVars(str) {
  const out = new Set();
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let m;
  while ((m = re.exec(str))) out.add(m[1]);
  return out;
}

function sameSet(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function loadDomains() {
  const byLang = {};
  for (const lang of LANGS) {
    const dir = path.join(LOCALES_DIR, lang);
    byLang[lang] = {};
    for (const file of fs.readdirSync(dir).sort()) {
      if (!file.endsWith('.json')) continue;
      const domain = file.slice(0, -'.json'.length);
      byLang[lang][domain] = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    }
  }
  return byLang;
}

function checkKeyParityAndInterpolation(byLang) {
  const domains = new Set([...Object.keys(byLang.fr), ...Object.keys(byLang.en)]);
  for (const domain of domains) {
    const fr = byLang.fr[domain] || {};
    const en = byLang.en[domain] || {};
    const frKeys = new Set(Object.keys(fr));
    const enKeys = new Set(Object.keys(en));
    for (const k of frKeys) if (!enKeys.has(k)) err(`locales/en/${domain}.json : clé manquante "${k}" (présente en fr)`);
    for (const k of enKeys) if (!frKeys.has(k)) err(`locales/fr/${domain}.json : clé manquante "${k}" (présente en en)`);
    for (const k of frKeys) {
      if (!enKeys.has(k)) continue;
      const vFr = interpVars(fr[k]);
      const vEn = interpVars(en[k]);
      if (!sameSet(vFr, vEn)) {
        err(`${domain}.json / "${k}" : variables d'interpolation différentes entre fr (${[...vFr].join(',') || '—'}) et en (${[...vEn].join(',') || '—'})`);
      }
    }
  }
}

function walkJsFiles(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJsFiles(full, out);
    else if (entry.name.endsWith('.js') && entry.name !== 'i18n-resources.generated.js') out.push(full);
  }
}

// formes plurielles CLDR gerees par i18next (fr/en n'utilisent que one/other, mais une langue
// future -- polonais, russe, arabe -- peut activer les autres, voir I18N_PLAN.md §6/§10) : une
// cle passee a t() avec `count` est stockee sous cle_one/cle_other (etc.), jamais la cle nue.
const PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other'];

function keyExistsInDict(dict, key) {
  if (key in dict) return true;
  return PLURAL_SUFFIXES.some(suf => (key + suf) in dict);
}

function checkUsagesExist(byLang) {
  const files = [];
  walkJsFiles(SRC_DIR, files);
  const usageRe = /i18next\.t\(\s*['"]([a-zA-Z0-9_]+):([a-zA-Z0-9_.]+)['"]/g;
  const seen = new Set();
  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = usageRe.exec(code))) {
      const [, domain, key] = m;
      const id = `${domain}:${key}`;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const lang of LANGS) {
        const dict = (byLang[lang][domain] || {});
        if (!keyExistsInDict(dict, key)) {
          err(`${path.relative(ROOT, file)} : i18next.t('${id}') référencé mais absent de locales/${lang}/${domain}.json (ni la clé nue, ni une variante plurielle _one/_other...)`);
        }
      }
    }
  }
  return seen.size;
}

function main() {
  const byLang = loadDomains();
  checkKeyParityAndInterpolation(byLang);
  const usageCount = checkUsagesExist(byLang);

  if (errors > 0) {
    console.error(`\n${errors} problème(s) de traduction trouvé(s).`);
    process.exit(1);
  }
  const totalKeys = LANGS.reduce((sum, l) => sum + Object.values(byLang[l]).reduce((s, d) => s + Object.keys(d).length, 0), 0) / LANGS.length;
  console.log(`OK : ${Math.round(totalKeys)} clés, ${usageCount} usages i18next.t() vérifiés, fr/en cohérents.`);
}

main();
