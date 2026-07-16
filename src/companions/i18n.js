// ═══ I18N DU MODULE COMPAGNONS (2026-07-16, retour utilisateur : "compagnon pas anglais") ═══
// PROPRE instance i18next du module (voir docs/I18N_PLAN.md §3 "Cas à part : module Compagnons"
// et CLAUDE.md §28/§31) : cette iframe ne partage RIEN avec le jeu principal, y compris son
// instance i18next -- le fichier UMD est chargé une 2e fois dans companions.html (même URL/SRI
// jsdelivr qu'index.dev.html, donc déjà en cache navigateur), et le namespace `companions`
// (locales/{fr,en}/companions.json) est embarqué via i18n-resources.generated.js (généré par
// scripts/gen-locales.js, jamais édité à la main) -- pas de fetch() au runtime, même
// justification que le jeu principal (I18N_PLAN.md §5).
//
// La langue vient du jeu principal via localStorage['velia-idle-lang'] (iframe same-origin,
// localStorage partagé) -- lue UNE FOIS au chargement de l'iframe : l'iframe est créée au premier
// clic sur l'onglet Compagnon puis réutilisée (boss.js:openCompanionsModule), un changement de
// langue dans le jeu principal est donc pris en compte au prochain rechargement de la page.
let COMPANIONS_LANG = 'fr';
try { COMPANIONS_LANG = localStorage.getItem('velia-idle-lang') || 'fr'; } catch (e) {}
// locale de formatage des nombres/dates -- remplace les 'fr-FR' codés en dur du module
const NUM_LOCALE = COMPANIONS_LANG === 'fr' ? 'fr-FR' : 'en-US';

i18next.init({
  lng: COMPANIONS_LANG,
  fallbackLng: 'en',
  supportedLngs: ['fr', 'en'],
  resources: COMPANIONS_I18N_RESOURCES, // i18n-resources.generated.js, chargé juste avant ce fichier
  ns: ['companions'],
  defaultNS: 'companions',
  interpolation: { escapeValue: false } // le module construit du HTML via template strings partout
});
document.documentElement.lang = COMPANIONS_LANG;
document.title = i18next.t('companions:companions.shell.page_title');

// ═══ LIBELLÉS DE DONNÉES (catalog.js) ═══
// Les données du catalogue (raretés, sections, compétences, objets, œufs, types) gardent leurs
// libellés FRANÇAIS CANONIQUES dans catalog.js : ce sont aussi des clés de sauvegarde (INVENTORY
// est indexé par nom d'objet dans localStorage['velia_idle_pets_save']) -- les traduire dans les
// données casserait/splitterait les stacks des sauvegardes existantes. Traduction à l'AFFICHAGE
// uniquement, via les helpers ci-dessous -- même esprit que tr()/NAME_EN côté jeu principal
// (noms canoniques dans les données, traduits au rendu). Repli = libellé FR d'origine si la clé
// manque (jamais une clé brute à l'écran).
/** @param {string} s - libellé FR canonique. @returns {string} slug ascii_snake_case aligné sur les clés companions.item.* / companions.type.* des JSON. */
function companionSlug(s) {
  return String(s).toLowerCase().replace(/œ/g, 'oe').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
// préfixe de namespace construit via cette constante pour les CLÉS DYNAMIQUES ci-dessous --
// scripts/check-missing-translations.js ne vérifie que les appels t('companions:clé') littéraux,
// un préfixe littéral tronqué ('companions:companions.rarity.' + r) serait flaggé à tort.
const COMPANIONS_NS_PREFIX = 'companions:';
/** @param {string} group - 'item'|'type'. @param {string} frLabel - libellé FR canonique. @returns {string} traduction si la clé existe, sinon le libellé FR tel quel. */
function companionDataLabel(group, frLabel) {
  const key = COMPANIONS_NS_PREFIX + 'companions.' + group + '.' + companionSlug(frLabel);
  return i18next.exists(key) ? i18next.t(key) : frLabel;
}
/** @param {string} frName - nom d'objet FR canonique (clé INVENTORY). @returns {string} nom affiché. */
function itemLabel(frName) { return companionDataLabel('item', frName); }
/** @param {string} frType - type FR canonique (cat.typ). @returns {string} type affiché. */
function typeLabel(frType) { return companionDataLabel('type', frType); }
/** @param {?object} s - définition SECTIONS. @returns {string} nom de section affiché ('' si absent). */
function secName(s) { return s ? i18next.t(COMPANIONS_NS_PREFIX + 'companions.section.' + s.id) : ''; }
/** @param {?object} s - définition SECTIONS. @param {number} i - index de compétence (0-4). @returns {string} nom de compétence affiché. */
function skillName(s, i) {
  if (!s) return '';
  const key = COMPANIONS_NS_PREFIX + 'companions.skill.' + s.id + '_' + i;
  return i18next.exists(key) ? i18next.t(key) : (s.sk[i] || '');
}
/** @param {object} egg - entrée EGG_TYPES. @returns {string} nom d'œuf affiché (ciblé = "Œuf {rareté}" interpolé). */
function eggName(egg) {
  if (egg.targeted) return i18next.t('companions:companions.egg.targeted_name', { rarity: i18next.t(COMPANIONS_NS_PREFIX + 'companions.rarity.' + egg.targetRar) });
  return i18next.t(COMPANIONS_NS_PREFIX + 'companions.egg.' + egg.id);
}

// ═══ SHELL STATIQUE (companions.html) ═══
// Applique les traductions aux éléments marqués data-i18n / data-i18n-title /
// data-i18n-placeholder. Appliqué aussi en FR (le HTML garde le FR par défaut, mais la clé fait
// foi) -- garantit qu'une clé cassée se voit dès les tests FR. Les scripts sont en fin de <body>,
// le DOM est donc déjà parsé au moment de cet appel.
function applyCompanionsI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = i18next.t('companions:' + el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = i18next.t('companions:' + el.dataset.i18nTitle); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = i18next.t('companions:' + el.dataset.i18nPlaceholder); });
}
applyCompanionsI18n();
