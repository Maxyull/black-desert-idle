// ============================================================
// I18N HISTORIQUE (dictionnaire I18N + applyI18n + bascule de langue)
// ============================================================
// Extrait de src/backend/game-supabase.js le 2026-07-22 (audit repo P5 : le fichier avait
// atteint 3 124 lignes, trois fois la limite de decoupe obligatoire de CLAUDE.md, et melangeait
// le dictionnaire de traduction avec le client Supabase).
//
// DECOUPAGE PAR TRANSPLANTATION, PAS PAR REECRITURE : les lignes sont sorties telles quelles, et
// ce fichier est charge dans index.dev.html EXACTEMENT a la place qu'occupait ce bloc dans
// l'original. Le projet n'a pas de modules ES -- tous les scripts partagent un seul scope global,
// et un `const`/`let` de haut niveau lu au chargement par un fichier suivant explose si l'ordre
// bouge (CLAUDE.md SS6). Preserver l'ordre a l'octet pres est ce qui rend ce decoupage sur.
//
// A ne pas confondre avec src/core/i18n-init.js + i18n-resources.generated.js (i18next, la
// solution actuelle, alimentee par /locales) : `I18N` est le dictionnaire historique, encore lu
// par applyI18n(). Les deux coexistent -- voir docs/I18N_PLAN.md.

// ============================================================
// I18N — EN / FR (LANG, NAME_EN, tr déplacés en haut du script — voir début du fichier)
// ============================================================
// dictionnaire des textes statiques de l'UI (clé data-i18n → {fr, en})
const I18N = {
  sessionLockTitle: { fr:'Jeu en pause', en:'Game paused' },
  sessionLockMsg: { fr:'Une autre session est active sur ce compte (autre onglet, navigateur ou appareil). Un seul endroit à la fois peut jouer.', en:'Another session is active on this account (another tab, browser or device). Only one place can play at a time.' },
  sessionLockResume: { fr:'Reprendre ici', en:'Resume here' },
  offlineBannerMsg: { fr:'Hors ligne — ta progression est sauvegardée localement, synchronisation dès le retour du réseau.', en:'Offline — your progress is saved locally, syncing as soon as the network is back.' },
  btnWiki: { fr:'📖 Wiki', en:'📖 Wiki' },
  btnTrust: { fr:'🛡️ Confiance & Sécurité', en:'🛡️ Trust & Security' },
  btnNotifCenter: { fr:'🔔 Notifications', en:'🔔 Notifications' },
  btnPatch: { fr:'📜 Notes de version', en:'📜 Patch Notes' },
  btnMarketLbl: { fr:'🏛️ Marché commun', en:'🏛️ Common Market' },
  marketConstructionBanner: { fr:'🚧 BETA — Marché en construction, encore peu fonctionnel : bugs et changements à prévoir', en:'🚧 BETA — Market under construction, still not very functional: expect bugs and changes' },
  btnLogout: { fr:'🚪 Déconnexion', en:'🚪 Log out' },
  authMobileBadge: { fr:'📱 BETA — Compatible mobile & tablette', en:'📱 BETA — Mobile & tablet compatible' },
  authSub: { fr:'Connecte-toi avec un vrai compte pour accéder au Marché et au Classement', en:'Sign in with a real account to access the Market and Leaderboard' },
  btnLinkAccount: { fr:'🔗 Lier un compte', en:'🔗 Link account' },
  // Fin de vie du mode invité (2026-07-22) — à supprimer avec le reste, voir GUEST_SUNSET_DATE.
  // Date explicite plutôt qu'un vague "bientôt" : c'est la seule information qui permet à un invité
  // de savoir combien de temps il lui reste pour sauver sa progression.
  // (pas de ⚠️ ici : il est déjà dans le HTML du bandeau, comme le 🔌 de #offlineBanner)
  guestSunsetMsg: {
    fr: 'Le mode invité disparaît le 15/08/2026 — ta progression sera perdue. Clique ici pour lier un compte et la garder.',
    en: 'Guest mode is going away on 2026-08-15 — your progress will be lost. Click here to link an account and keep it.',
  },
  btnAccount: { fr:'👤 Mon compte', en:'👤 My account' },
  onlineLbl: { fr:'en ligne', en:'online' },
  registeredLbl: { fr:'inscrits', en:'registered' },
  demoNoteAuth: { fr:'🎮 Ceci est une démo de test — ta progression peut être réinitialisée à tout moment.', en:'🎮 This is a test demo — your progress can be reset at any time.' },
  demoTag: { fr:'DÉMO', en:'DEMO' },
  devBannerText: { fr:'Jeu en développement — du contenu et des ajustements arrivent régulièrement', en:'Game in development — content and adjustments arrive regularly' },
  btnResetDemo: { fr:'🔄 Réinitialiser', en:'🔄 Reset' },
  btnResetMyQuests: { fr:'🔄 Réinitialiser mes quêtes', en:'🔄 Reset my quests' },
  btnResetAllQuests: { fr:'⚠️ Réinitialiser les quêtes de tous', en:'⚠️ Reset everyone\'s quests' },
  btnAdmin: { fr:'🛠️ Admin', en:'🛠️ Admin' },
  adminBoxTitle: { fr:'🛠️ Admin', en:'🛠️ Admin' },
  // tooltips des raccourcis header (2026-07-13, mockup validé, voir CLAUDE.md) -- data-i18n-title,
  // texte court sans emoji (contrairement aux clés ci-dessus, réutilisées pour les labels sidebar).
  tbLeaderboard: { fr:'Classement', en:'Leaderboard' },
  tbMarket: { fr:'Marché (BETA)', en:'Market (BETA)' },
  tbPatch: { fr:'Notes de version', en:'Patch notes' },
  tbDiscord: { fr:'Discord', en:'Discord' },
  tbDonation: { fr:'Soutenir', en:'Support' },
  tbAccount: { fr:'Mon compte', en:'My account' },
  tbAdmin: { fr:'Admin', en:'Admin' },
  tbLogout: { fr:'Déconnexion', en:'Log out' },
  // boutons +/- taille UI/jeu sur les bords de #gameFrame (2026-07-13, mockup validé) -- même
  // texte utilisé pour le title natif (data-i18n-title) ET le petit libellé qui apparaît sous le
  // bouton au survol (data-i18n).
  uiScaleDown: { fr:'Réduire', en:'Shrink' },
  uiScaleUp: { fr:'Agrandir', en:'Grow' },
  footerText: { fr:"Projet de fan gratuit, non officiel et fourni tel quel, sans garantie ni responsabilité (bugs, pertes de progression, interruptions...) — utilisation à tes risques. Noms/styles inspirés de Black Desert (propriété de Pearl Abyss le cas échéant) ; visuels 100% originaux, aucune affiliation.", en:"Free, unofficial fan project provided as-is, with no warranty or liability (bugs, progress loss, downtime...) — use at your own risk. Names/styles inspired by Black Desert (Pearl Abyss's property where applicable); visuals are 100% original, no affiliation." },
  authPassPh: { fr:'Mot de passe', en:'Password' },
  authPseudoPh: { fr:'Pseudo', en:'Nickname' },
  authIdentifierPh: { fr:'Pseudo ou email', en:'Username or email' },
  btnSignIn: { fr:'Se connecter', en:'Sign in' },
  btnSignUp: { fr:'Créer un compte', en:'Create account' },
  btnForgotPass: { fr:'Mot de passe oublié ?', en:'Forgot password?' },
  // écran d'auth à modes (2026-07-22) : libellés des intentions + du bouton de validation, qui
  // change selon le flux ouvert (voir AUTH_MODES.submitKey).
  btnMagicLink: { fr:'✨ Lien magique (sans mot de passe)', en:'✨ Magic link (no password)' },
  btnAuthBack: { fr:'← Retour', en:'← Back' },
  btnForgotSubmit: { fr:'Envoyer le lien de réinitialisation', en:'Send reset link' },
  btnMagicSubmit: { fr:'Recevoir le lien de connexion', en:'Send login link' },
  btnSaveNewPass: { fr:'Enregistrer le mot de passe', en:'Save password' },
  authSepOr: { fr:'ou', en:'or' },
  authEmailPh: { fr:'Email', en:'Email' },
  btnSignInDiscord: { fr:'Se connecter avec Discord', en:'Sign in with Discord' },
  btnSignInGoogle: { fr:'Google', en:'Google' },
  btnSignInGithub: { fr:'GitHub', en:'GitHub' },
  btnSignInTwitter: { fr:'Twitter/X', en:'Twitter/X' },
  btnClearCacheAuth: { fr:'🧹 Vider le cache du jeu', en:'🧹 Clear game cache' },
  btnCodex: { fr:'📚 Codex', en:'📚 Codex' },
  tabCommon: { fr:'Marché commun', en:'Common Market' },
  commonHint: { fr:'Vrai carnet d\'ordres entre joueurs : pose un prix d\'achat ou de vente, l\'argent/l\'objet reste bloqué tant que l\'ordre n\'est pas exécuté ou annulé. Si ton prix correspond au meilleur ordre opposé, l\'échange se fait automatiquement (égalité de prix = tirage au sort).',
    en:'Real order book between players: set a buy or sell price, the money/item stays locked until the order is filled or cancelled. If your price matches the best opposite order, the trade happens automatically (tied prices = random draw).' },
  cmMyOrdersTitle: { fr:'📋 Mes ordres', en:'📋 My orders' },
  cmTabBrowse: { fr:'🛒 Parcourir', en:'🛒 Browse' },
  cmTabOrders: { fr:'📋 Mes ordres', en:'📋 My orders' },
  cmSelectItemHint: { fr:'Clique un objet pour voir le détail', en:'Click an item to see the detail' },
  cmWalletLbl: { fr:'💰 Ton solde', en:'💰 Your balance' },
  cardStats: { fr:'Statistiques', en:'Stats' },
  statsTabPerso: { fr:'Perso', en:'Personal' },
  statsTabReco: { fr:'Recommandations', en:'Recommendations' },
  statsTabLevels: { fr:'Niveaux', en:'Levels' },
  cardZoneStats: { fr:'Stats de la zone de farm', en:'Farming zone stats' },
  // stats du haut de #statsPersoPane passées en 3 colonnes le 2026-07-15 (demande explicite :
  // "3 colonnes a gauche le mot au milieu l'abreviation et a droite la stat") -- le mot et
  // l'abréviation sont désormais 2 clés i18n séparées (avant, l'abréviation était parfois
  // incluse entre parenthèses dans le mot, ex: "PA (Attaque) effective")
  lblPS: { fr:'Gearscore', en:'Gearscore' }, lblPSAbbr: { fr:'GS', en:'GS' },
  lblPA: { fr:'Attaque effective', en:'Attack effective' }, lblPAAbbr: { fr:'PA', en:'AP' },
  lblPD: { fr:'Défense', en:'Defense' }, lblPDAbbr: { fr:'PD', en:'DP' },
  lblHpMax: { fr:'Vie max', en:'Max health' }, lblHpMaxAbbr: { fr:'PV', en:'HP' },
  lblMpMax: { fr:'Mana max', en:'Max mana' }, lblMpMaxAbbr: { fr:'MP', en:'MP' },
  lblSpd: { fr:'Vitesse', en:'Speed' }, lblSpdAbbr: { fr:'SPD', en:'SPD' },
  lblDodge: { fr:'Esquive', en:'Dodge' }, lblDodgeAbbr: { fr:'ESQ', en:'EVA' },
  lblApZone: { fr:'PA requis (zone)', en:'AP required (zone)' },
  lblDpZone: { fr:'PD requis (zone)', en:'DP required (zone)' },
  lblWeaponBonus: { fr:'Bonus arme', en:'Weapon bonus' }, lblWeaponBonusAbbr: { fr:'ATK', en:'ATK' },
  lblArmorBonus: { fr:'Bonus armure (moy.)', en:'Armor bonus (avg)' }, lblArmorBonusAbbr: { fr:'DEF', en:'DEF' },
  lblAiMode: { fr:'Mode de combat', en:'Combat mode' }, lblAiModeAbbr: { fr:'IA', en:'AI' },
  lblKpm: { fr:'Kills / min', en:'Kills / min' },
  lblKills: { fr:'Monstres tués', en:'Monsters slain' },
  lblLootCount: { fr:'Objets ramassés', en:'Items looted' },
  cardZones: { fr:'Zones de farm', en:'Farming zones' },
  cardLoot: { fr:'Loot de cette zone', en:'Loot in this zone' },
  cardEquip: { fr:'Équipement', en:'Equipment' },
  // libellés raccourcis le 2026-07-07 (retour utilisateur, capture à l'appui) : les versions
  // longues se tronquaient en plein milieu d'un mot ("soc e", "Ven...") sur des fenêtres pas assez
  // larges — le sens complet reste dans l'attribut title de chaque bouton
  btnEquipBest: { fr:'⚡ Équiper meilleur', en:'⚡ Equip best' },
  btnSellWorse: { fr:'🗑️ Vendre', en:'🗑️ Sell worse' },
  resetNoticeClose: { fr:'OK, compris !', en:'OK, got it!' },
  invFullBanner: { fr:'⚠ Sac plein — les objets restent au sol', en:'⚠ Bag full — items stay on the ground' },
  dangerBanner: { fr:'⚠️ Zone dangereuse — montez votre stuff ou passez par une zone plus facile', en:'⚠️ Dangerous zone — upgrade your gear or move to an easier zone' },
  updateAvailableMsg: { fr:'🔄 Une nouvelle version du jeu est disponible.', en:'🔄 A new version of the game is available.' },
  btnReloadUpdate: { fr:'Recharger', en:'Reload' },
  btnLeaderboard: { fr:'🏆 Classement', en:'🏆 Leaderboard' },
  btnAchievements: { fr:'🏅 Succès', en:'🏅 Achievements' },
  btnCompendium: { fr:'📖 Compendium', en:'📖 Compendium' },
  btnDailyQuests: { fr:'🗒️ Quêtes', en:'🗒️ Quests' },
  btnMailbox: { fr:'📬 Courrier', en:'📬 Mailbox' },
  btnActivities: { fr:'Activités', en:'Activities' },
  copyLabel: { fr:'Copier', en:'Copy' },
  bossTopTitle: { fr:'🏆 Top contributeurs', en:'🏆 Top contributors' },
  bossPageTitle: { fr:'World Boss', en:'World Boss' },
  menuSideLeft: { fr:'◀ Gauche', en:'◀ Left' },
  menuSideRight: { fr:'Droite ▶', en:'Right ▶' },
  cardInv: { fr:'Inventaire', en:'Inventory' },
  lblLevel: { fr:'Niv.', en:'Lvl' },
  btnAutoSellLoot: { fr:'Vente automatique', en:'Auto-sell' },
  btnEquipSellCompendium: { fr:'⚡ Équiper → 🗑️ Vendre → 📖 Compendium', en:'⚡ Equip → 🗑️ Sell → 📖 Compendium' },
  // btnPet/btnSea retirés le 2026-07-17 (rendus dynamiquement depuis ACTIVITY_TABS, combat/boss.js
  // -- déplacés dans #zoneTierTabs puis dans le header le 2026-07-08 -- plus besoin de ces clés i18n)
  btnDonation: { fr:'💖 Soutenir', en:'💖 Support' },
  lootPanelTabLoot: { fr:'🎒 Loot', en:'🎒 Loot' },
  lootPanelTabChest: { fr:'🏛️ Coffre', en:'🏛️ Chest' },
  cmTabMaterials: { fr:'📊 Matériaux', en:'📊 Materials' },
  mktChartHead: { fr:'Graphique chandelier — 20 dernières transactions', en:'Candlestick chart — last 20 trades' },
  mktSideBuy: { fr:'Achat', en:'Buy' },
  mktSideSell: { fr:'Vente', en:'Sell' },
  mktPriceLbl: { fr:'Prix unitaire', en:'Unit price' },
  mktQtyLbl: { fr:'Quantité', en:'Quantity' },
  mktPlaceBuy: { fr:"Placer l'ordre d'achat", en:'Place buy order' },
  mktHistHead: { fr:'📜 Historique des transactions', en:'📜 Transaction history' },
  lblWeight: { fr:'Poids', en:'Weight' },
  cardOpt: { fr:'Optimisation', en:'Enhancement' },
  invModeInv: { fr:'🎒 Inventaire', en:'🎒 Inventory' },
  invModeCraft: { fr:'🔧 Assemblage', en:'🔧 Craft' },
  invModeCompendium: { fr:'📖 Compendium', en:'📖 Compendium' },
  compGridEmpty: { fr:'Aucun objet protégé pour l\'instant', en:'No protected item yet' },
  optChanceEmpty: { fr:'Chargez un matériau depuis le sac', en:'Load a material from your bag' },
  optCronToggleLbl: { fr:'Utiliser la Pierre de Cron si dispo', en:'Use Cron Stone if available' },
  btnOptTry: { fr:"Tenter l'optimisation", en:'Attempt enhancement' },
  btnOptAuto: { fr:"▶ Auto jusqu'à", en:'▶ Auto to' },
  optAutoModeTarget: { fr:"Jusqu'à un palier", en:'Until a target level' },
  optAutoModeNextGain: { fr:"Jusqu'au prochain gain de PA/PD", en:'Until the next AP/DP gain' },
  optAutoModeLoop: { fr:"En boucle (jusqu'à rupture de matériau)", en:'On loop (until out of material)' },
  optAutoModeFail: { fr:"Jusqu'au premier échec", en:'Until the first failure' },
  optAutoModeCron: { fr:"Jusqu'à épuisement des Pierres de Cron", en:'Until out of Cron Stones' },
  btnConvertCaphras: { fr:'Convertir (5:1)', en:'Convert (5:1)' },
  naderrLbl: { fr:'Bandeau de Naderr', en:"Naderr's Band" },
  cardAdmin: { fr:'🛠️ Admin', en:'🛠️ Admin' },
  admGroupEquip: { fr:'Équipement', en:'Equipment' },
  // titres de groupes de la sidebar (2026-07-16) : sans entrée i18n, applyI18n() laissait le texte
  // HTML brut (français) même en anglais -- "Communauté"/"Compte" restaient en FR dans l'UI EN.
  sideGroupProgression: { fr:'Progression', en:'Progression' },
  sideGroupCommunaute: { fr:'Communauté', en:'Community' },
  sideGroupCompte: { fr:'Compte', en:'Account' },
  // recherche + tri du Marché (2026-07-16) : restaient en français en mode EN (placeholder/options).
  cmSearchPh: { fr:'🔎 Rechercher un objet...', en:'🔎 Search for an item...' },
  cmSortPriceAsc: { fr:'Prix ↑', en:'Price ↑' },
  cmSortPriceDesc: { fr:'Prix ↓', en:'Price ↓' },
  cmSortRecent: { fr:'Plus récents', en:'Most recent' },
};
/** Applique le dictionnaire I18N statique (data-i18n/data-i18n-ph) à tout le DOM, synchronise l'UI de langue et redessine inventaire/HUD avec les noms traduits. */
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (I18N[key]) el.textContent = I18N[key][LANG];
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const key = el.getAttribute('data-i18n-ph');
    if (I18N[key]) el.setAttribute('placeholder', I18N[key][LANG]);
  });
  // data-i18n-title (2026-07-13, raccourcis header) -- même dictionnaire I18N, applique le
  // texte traduit à l'attribut title (tooltip natif) plutôt qu'au textContent.
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (I18N[key]) el.setAttribute('title', I18N[key][LANG]);
  });
  $a('langThumb').classList.toggle('en', LANG === 'en');
  document.querySelectorAll('.langOpt').forEach(el => el.classList.toggle('active', el.dataset.lang === LANG));
  document.querySelectorAll('.authLangBtn').forEach(el => el.classList.toggle('active', el.dataset.lang === LANG));
  document.documentElement.lang = LANG;
  refreshInvUI(); // redessine loot table / stats mode / badges avec les noms traduits
  // reconstruit la disposition des cartes (2026-07-16, retour utilisateur : les barres d'onglets
  // des cartes fusionnées -- ex "STATISTIQUES | ÉQUIPEMENT" -- restaient dans l'ancienne langue) :
  // les libellés d'onglets sont des COPIES du texte du h3 prises au moment de la construction
  // (cardLayoutCardTitle, card-layout.js), pas des éléments data-i18n vivants -- le passage
  // data-i18n ci-dessus met à jour les h3 sources, ce re-render recopie ensuite le texte traduit.
  if (typeof renderCardLayout === 'function' && typeof cardLayoutState !== 'undefined') renderCardLayout(cardLayoutState);
  // titre de zone du canvas (2026-07-16, même passe i18n) : tr() y est bien appliqué mais la
  // fonction n'était rappelée qu'au changement de zone -- le titre gardait l'ancienne langue
  // jusqu'au prochain voyage (visible au premier chargement et à chaque bascule FR/EN).
  if (typeof updateZoneTitleText === 'function') updateZoneTitleText();
  // module Compagnon (2026-07-16, retour utilisateur : "lie la traduction compagnon au slider") :
  // l'iframe lit localStorage['velia-idle-lang'] UNE FOIS à sa création (voir src/companions/i18n.js)
  // puis est réutilisée -- une bascule FR/EN en jeu ne se répercutait donc qu'au prochain reload.
  // localStorage est déjà écrit par les handlers de langue AVANT cet appel : on recharge l'iframe
  // pour qu'elle réinitialise son i18next dans la nouvelle langue. Reload seulement si elle existe
  // déjà (jamais de création anticipée -- le module reste chargé à la demande, au 1er clic).
  const companionsFrame = document.getElementById('companionsFrame');
  if (companionsFrame) { try { companionsFrame.contentWindow.location.reload(); } catch (e) { companionsFrame.src = companionsFrame.src; } }
  hudFast();
}
$a('langToggle').onclick = () => {
  LANG = LANG === 'fr' ? 'en' : 'fr';
  if (typeof i18next !== 'undefined') i18next.changeLanguage(LANG); // garde i18next synchronise avec LANG, voir docs/I18N_PLAN.md §8
  try { localStorage.setItem('velia-idle-lang', LANG); } catch(e) {}
  applyI18n();
};
