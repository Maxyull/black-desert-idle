// Initialisation i18next -- charge en tout premier (avant gear-icons.js), voir docs/I18N_PLAN.md §5.
// Lecture INDEPENDANTE de la langue (meme cle localStorage que `LANG` dans core/game-core.js,
// mais sans dependance d'ordre de chargement sur ce fichier) : ce script doit pouvoir tourner
// avant que game-core.js n'existe, car des fonctions qui appellent i18next.t() (buildZoneList,
// hud()...) peuvent etre invoquees de facon synchrone tres tot au chargement (CLAUDE.md §8) --
// i18next doit deja etre pret a ce moment-la, pas seulement avant que la boucle RAF ne demarre.
let _i18nBootLang = 'fr';
try { _i18nBootLang = localStorage.getItem('velia-idle-lang') || 'fr'; } catch (e) {}

// Source unique des langues supportees -- ajouter une langue = ajouter une entree ici +
// /locales/<lang>/*.json, voir docs/I18N_PLAN.md §8/§10. Tant qu'on reste a 2 langues, le toggle
// binaire #langToggle (game-supabase.js) reste tel quel ; le remplacer par un menu genere depuis
// ce tableau est necessaire AVANT d'ajouter une 3e langue, pas avant (docs/I18N_PLAN.md §8).
const SUPPORTED_LANGS = ['fr', 'en'];

i18next.init({
  lng: _i18nBootLang,
  fallbackLng: 'en',
  supportedLngs: SUPPORTED_LANGS,
  resources: I18N_RESOURCES,   // src/core/i18n-resources.generated.js, charge juste avant ce fichier
  ns: I18N_NAMESPACES,
  defaultNS: 'common',
  interpolation: { escapeValue: false } // le jeu construit du HTML via template strings partout, ne pas double-echapper
});
