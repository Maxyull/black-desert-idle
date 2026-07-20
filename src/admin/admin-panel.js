// vérification anti-auto-ban (2026-07-18, demande explicite : "l'admin ne doit jamais pouvoir se
// bannir lui-même par erreur") — fonction PURE, réutilisable telle quelle par un test unitaire
// (pas de dépendance à sb/currentUser à l'intérieur, ceux-ci sont passés en paramètres par
// l'appelant). Retourne false si l'UUID cible est vide OU identique à l'UUID de l'admin connecté.
/** @param {string} targetUuid @param {string} myUuid. @returns {boolean} false si vide ou identique à l'UUID de l'admin connecté (empêche l'auto-ban). Fonction pure, testable isolément. */
function canBanUuid(targetUuid, myUuid) {
  return !!targetUuid && targetUuid !== myUuid;
}

// ---------- palette du panneau admin (2026-07-19, demande explicite : "garde toute les couleurs
// et qu'on poura modifier avec un slider") ----------
// ordre = position sur le slider (index). "gold" = thème actuel du jeu (par défaut). Les
// définitions de couleurs vivent dans styles.css (.admThemeRoot[data-adm-theme="..."]) -- ce
// tableau ne sert qu'à peupler le slider et son libellé, jamais les couleurs elles-mêmes.
// "color" = teinte fixe utilisée UNIQUEMENT pour dessiner la pastille du sélecteur lui-même
// (2026-07-20, palette déplacée en haut à gauche, voir renderAdminThemeSwatchesHtml) -- ne
// remplace pas .admThemeRoot[data-adm-theme] dans styles.css (source de vérité pour le reste du
// panneau), juste une copie inerte de ces mêmes --gold pour pouvoir montrer les 5 couleurs à la
// fois quel que soit le thème actuellement actif.
const ADMIN_THEMES = [
  { id:'gold',    label:{fr:'Or (jeu)',en:'Gold (game)'}, color:'#c9a55a' },
  { id:'emerald', label:{fr:'Émeraude',en:'Emerald'}, color:'#34D399' },
  { id:'ruby',    label:{fr:'Rubis',en:'Ruby'}, color:'#e05a6e' },
  { id:'royal',   label:{fr:'Bleu royal',en:'Royal blue'}, color:'#5a8fc8' },
  { id:'violet',  label:{fr:'Violet',en:'Violet'}, color:'#a578d8' },
];
const ADMIN_THEME_STORAGE_KEY = 'bdiAdminTheme';

// ---------- période globale du panneau (2026-07-20, bdi-admin-ux.md §4) ----------
// Avant : chaque section avait SA fenêtre codée en dur (48 h pour le silver, 30 j pour les
// inscriptions, 14 j pour les erreurs...). Impossible de zoomer sur un incident d'hier soir, et
// deux graphes côte à côte ne parlaient pas de la même période sans qu'on le sache.
// Un seul contrôle en haut du panneau pilote désormais TOUTES les sections temporelles.
// Persisté comme le thème (préférence locale à l'admin, jamais dans la sauvegarde de jeu).
const ADMIN_PERIODS = [
  { id:'24h', hours:24,   days:1,  label:{fr:'24 h',en:'24h'} },
  { id:'7d',  hours:168,  days:7,  label:{fr:'7 j', en:'7d'}  },
  { id:'30d', hours:720,  days:30, label:{fr:'30 j',en:'30d'} },
  { id:'90d', hours:2160, days:90, label:{fr:'90 j',en:'90d'} },
];
const ADMIN_PERIOD_STORAGE_KEY = 'bdiAdminPeriod';
/** @returns {object} période active de ADMIN_PERIODS (repli sur 30 j : l'ancienne fenêtre la plus courante). */
function getAdminPeriod() {
  let saved = null;
  try { saved = localStorage.getItem(ADMIN_PERIOD_STORAGE_KEY); } catch (e) {}
  return ADMIN_PERIODS.find(p => p.id === saved) || ADMIN_PERIODS[2];
}
/** @returns {number} nombre de JOURS de la période active (pour les RPC en p_days). */
function adminPeriodDays() { return getAdminPeriod().days; }
/** @returns {number} nombre d'HEURES de la période active (pour les RPC en p_hours). */
function adminPeriodHours() { return getAdminPeriod().hours; }
/** @returns {string} libellé court de la période active, à injecter dans les titres de section. */
function adminPeriodLabel() { return getAdminPeriod().label[LANG]; }
/** @param {string} id - id de ADMIN_PERIODS. Persiste la période et RE-REND la section courante (les données affichées doivent suivre immédiatement). */
function setAdminPeriod(id) {
  if (!ADMIN_PERIODS.some(p => p.id === id)) return;
  try { localStorage.setItem(ADMIN_PERIOD_STORAGE_KEY, id); } catch (e) {}
  renderAdminPeriodPicker();
  if (currentAdminSection) openAdminSection(currentAdminSection.cat, currentAdminSection.id);
}
// section actuellement affichée : nécessaire pour re-rendre au changement de période
let currentAdminSection = null;
/** Redessine le sélecteur de période dans l'en-tête du panneau et recâble ses boutons. */
function renderAdminPeriodPicker() {
  const host = $a('adminPeriodPicker'); if (!host) return;
  const active = getAdminPeriod().id;
  host.innerHTML = ADMIN_PERIODS.map(p =>
    `<button class="admPeriodBtn${p.id === active ? ' on' : ''}" data-period="${p.id}">${p.label[LANG]}</button>`).join('');
  host.querySelectorAll('.admPeriodBtn').forEach(b => { b.onclick = () => setAdminPeriod(b.dataset.period); });
}
// ---------- deep-linking par hash (2026-07-20, bdi-admin-ux.md §7) ----------
// Le panneau était une overlay SANS état dans l'URL : impossible de mettre une section en favori,
// de coller un lien dans ses notes, ou de revenir en arrière avec le navigateur.
//   #admin                        -> dashboard
//   #admin/economy/silver         -> section directe
//   #admin/players/u/<uuid>       -> fiche joueur
//   #admin/economy/silver?p=7d    -> avec période
// L'espace de noms `#admin/` est DISTINCT de ceux déjà utilisés dans le projet (`#patch-<version>`
// des notes de version, `#type=recovery` de Supabase) -- et on n'efface JAMAIS un hash qui n'est
// pas le nôtre (voir closeAdminPanel), sinon fermer le panneau casserait un lien de récupération.
const ADMIN_HASH_PREFIX = '#admin';
// évite la boucle : écrire le hash déclenche 'hashchange', qui re-rendrait la section qu'on vient
// d'ouvrir (double rendu, et perte de la sélection en cours dans la page Joueurs).
let admHashGuard = false;
// UUID demandé par l'URL, consommé au montage par la page Joueurs (admin-players-react.js)
let admPendingPlayerUuid = null;

/** @param {string} hash. @returns {?{cat:string,id:string,uuid:?string,period:?string}} route admin, ou null si le hash n'est pas un lien admin. Fonction PURE, testable sans DOM. */
function parseAdminHash(hash) {
  hash = String(hash || '');
  if (hash !== ADMIN_HASH_PREFIX && hash.indexOf(ADMIN_HASH_PREFIX + '/') !== 0
      && hash.indexOf(ADMIN_HASH_PREFIX + '?') !== 0) return null;
  const rest = hash.slice(ADMIN_HASH_PREFIX.length);
  const qi = rest.indexOf('?');
  // classe de caracteres [/] et non \/ : scripts/build.py retire les commentaires sans connaitre
  // les litteraux regex, donc la sequence \/ y est lue comme un debut de commentaire // et TRONQUE
  // la ligne dans le bundle (bug reel rencontre ici). [/] evite toute paire // dans la source.
  const path = (qi === -1 ? rest : rest.slice(0, qi)).replace(/^[/]/, '');
  const query = qi === -1 ? '' : rest.slice(qi + 1);
  const parts = path ? path.split('/').filter(Boolean) : [];
  const out = { cat: parts[0] || 'overview', id: parts[1] || 'dashboard', uuid: null, period: null };
  // Sous-route de fiche joueur, DEUX formes acceptees :
  //   #admin/players/all/u/<uuid>  forme canonique produite par buildAdminHash
  //   #admin/players/u/<uuid>      forme courte du doc (bdi-admin-ux.md §7), celle qu'un humain
  //                                tape ou colle -- elle doit marcher, sinon le lien documente
  //                                ouvrirait silencieusement une section inexistante ("u").
  if (parts[1] === 'u' && parts[2]) { out.id = 'all'; out.uuid = decodeURIComponent(parts[2]); }
  else if (parts[2] === 'u' && parts[3]) out.uuid = decodeURIComponent(parts[3]);
  const m = query.match(/(?:^|&)p=([^&]*)/);
  if (m && m[1]) out.period = decodeURIComponent(m[1]);
  return out;
}
/** @param {string} cat @param {string} id @param {?string} uuid. @returns {string} hash canonique pour cette vue (période incluse). Fonction PURE. */
function buildAdminHash(cat, id, uuid) {
  let h = ADMIN_HASH_PREFIX + '/' + cat + '/' + id;
  if (uuid) h += '/u/' + encodeURIComponent(uuid);
  return h + '?p=' + getAdminPeriod().id;
}
/** @param {string} cat @param {string} id @param {?string} uuid. Écrit le hash sans redéclencher l'ouverture (garde anti-boucle). */
function writeAdminHash(cat, id, uuid) {
  const next = buildAdminHash(cat, id, uuid);
  if (location.hash === next) return;
  admHashGuard = true;
  try { location.hash = next; } catch (e) {} // location.hash pousse une entrée -> retour arrière OK
  setTimeout(() => { admHashGuard = false; }, 0);
}
/** @param {string} id. Applique une période SANS re-render ni réécriture du hash (l'appelant rend juste après). */
function setAdminPeriodSilently(id) {
  if (!ADMIN_PERIODS.some(p => p.id === id)) return;
  try { localStorage.setItem(ADMIN_PERIOD_STORAGE_KEY, id); } catch (e) {}
}
/** Ouvre le panneau et la section décrits par le hash courant. No-op si le hash n'est pas admin ou si l'utilisateur n'est pas admin. */
async function applyAdminHash() {
  if (admHashGuard) return;
  const route = parseAdminHash(location.hash);
  if (!route || !isAdmin()) return;
  if (route.period) setAdminPeriodSilently(route.period);
  admPendingPlayerUuid = route.uuid;      // consommé par la page Joueurs à son montage
  const overlay = $a('adminOverlay');
  if (!overlay || !overlay.classList.contains('open')) await openAdminPanel();
  openAdminSection(route.cat, route.id);
}
window.addEventListener('hashchange', () => { applyAdminHash(); });

// lit la préférence de palette persistée -- purement locale à ce navigateur/admin, ne touche
// jamais S/le compte (pas une donnée de jeu, pas besoin de sync/migration)
/** @returns {string} id de thème du panneau admin persisté (localStorage), 'gold' par défaut/invalide. */
function getAdminTheme() {
  let saved = null;
  try { saved = localStorage.getItem(ADMIN_THEME_STORAGE_KEY); } catch (e) {}
  return ADMIN_THEMES.some(t => t.id === saved) ? saved : 'gold';
}
/** @param {string} id - id de ADMIN_THEMES. Persiste le thème choisi du panneau admin (localStorage). */
function setAdminTheme(id) {
  try { localStorage.setItem(ADMIN_THEME_STORAGE_KEY, id); } catch (e) {}
}

// ============================================================
// REFONTE 2026-07-19 : panneau admin plein écran avec sidebar (voir CLAUDE.md pour le contexte).
// Remplace l'ancienne modale à 4 onglets plats par une navigation par sections/catégories,
// pilotée par le registre ADMIN_SECTIONS ci-dessous -- chaque item a soit un render(container)
// (charge ses propres données au clic, jamais tout d'un coup), soit planned:true (emplacement
// réservé Guildes/PvP/Donations -- roadmap confirmée mais aucun code jeu derrière aujourd'hui,
// voir docs/ADMIN_MENU_PLAN.md §0bis). AUCUNE RPC n'est réécrite ici -- uniquement réorganisées.
//
// `render:(el)=>renderX(el)` et non `render:renderX` (2026-07-19, découpe du fichier) : la flèche
// résout renderX à l'APPEL, pas à la construction du tableau. Les render vivent désormais dans
// admin-players.js / admin-content.js / admin-economy.js / admin-monitoring.js, qui chargent APRÈS
// ce fichier -- une référence directe vaudrait `undefined` ici et casserait tout le registre.
// ============================================================
const ADMIN_SECTIONS = [
  { cat:'overview', label:{fr:'Vue d\'ensemble',en:'Overview'}, items:[
    { id:'dashboard', icon:'🏠', label:{fr:'Dashboard',en:'Dashboard'}, render:(el)=>renderAdminDashboardV2(el) },
  ]},
  { cat:'players', label:{fr:'Joueurs',en:'Players'}, items:[
    // Les 5 anciennes entrées (Liste / Joueur précis / Sanctions / Rôles / Reconnexion) sont
    // fusionnées en UNE page depuis le 2026-07-19 (bdi-admin-ux.md §2) : c'était cinq endroits
    // pour un seul objet mental, et les actions y étaient séparées des données. Sanctions et
    // Rôles sont devenus des FILTRES de la liste ; Reconnexion (un agrégat, pas du par-joueur)
    // est un bloc dépliable sous la liste. Voir admin-players-react.js.
    { id:'all', icon:'👥', label:{fr:'Joueurs',en:'Players'}, render:(el)=>renderAdminPlayersUnified(el) },
    { id:'guilds', icon:'👑', label:{fr:'Guildes',en:'Guilds'}, planned:true },
    { id:'pvp', icon:'⚔️', label:{fr:'PvP',en:'PvP'}, planned:true },
  ]},
  { cat:'content', label:{fr:'Contenu',en:'Content'}, items:[
    { id:'boss', icon:'🌍', label:{fr:'Boss mondiaux',en:'World bosses'}, render:(el)=>renderAdminBoss(el) },
    { id:'zones', icon:'🗾', label:{fr:'Progression par zone',en:'Zone progression'}, render:(el)=>renderAdminZoneProgression(el) },
    { id:'compendium', icon:'📖', label:{fr:'Compendium',en:'Compendium'}, render:(el)=>renderAdminCompendium(el) },
    { id:'items', icon:'📦', label:{fr:'Ressources farmées',en:'Farmed resources'}, render:(el)=>renderAdminItems(el) },
    { id:'cron', icon:'⏳', label:{fr:'Pierres de Cron',en:'Cron Stones'}, render:(el)=>renderAdminCron(el) },
    { id:'treasure', icon:'🗺️', label:{fr:'Trésor de Velia',en:'Velia Treasure'}, render:(el)=>renderAdminTreasure(el) },
    { id:'loot', icon:'🎲', label:{fr:'Table de loot',en:'Loot table'}, render:(el)=>renderAdminLoot(el) },
    { id:'tutorials', icon:'🎓', label:{fr:'Tutoriels d\'objets',en:'Item tutorials'}, render:(el)=>renderAdminItemTutorials(el) },
    { id:'onboarding', icon:'🧭', label:{fr:'Onboarding',en:'Onboarding'}, render:(el)=>renderAdminOnboarding(el) },
    { id:'companions', icon:'🐾', label:{fr:'Compagnons',en:'Companions'}, render:(el)=>renderAdminCompanions(el) },
    { id:'patchnotesmod', icon:'🚩', label:{fr:'Notes de version : modération',en:'Patch notes: moderation'}, render:(el)=>renderAdminPatchNotesModeration(el) },
  ]},
  { cat:'me', label:{fr:'Compte (Moi)',en:'Account (Me)'}, items:[
    { id:'tests', icon:'🧪', label:{fr:'Tests perso',en:'Personal tests'}, render:(el)=>renderAdminMyTests(el) },
  ]},
  { cat:'system', label:{fr:'Système',en:'System'}, items:[
    { id:'danger', icon:'⚙️', label:{fr:'Zone danger',en:'Danger zone'}, render:(el)=>renderAdminServerDanger(el) },
  ]},
];

// ---------- réinitialisation de la démo (réservée à l'admin, à tout moment) ----------
/** Réinitialise entièrement la démo de l'admin (état local + cloud) au DEFAULT_SAVE, après confirmation. */
async function resetDemo() {
  if (!isAdmin()) return; // double protection : même si le bouton est masqué, la fonction refuse
  const msg = i18next.t('admin:admin.reset.confirm_demo');
  if (!confirm(msg)) return;
  applySaveState(JSON.parse(JSON.stringify(DEFAULT_SAVE)));
  suppressLoyaltyGrantForToday();
  if (sb && currentUser) await saveToCloud(); // écrase aussi la sauvegarde cloud avec l'état neuf
  try { localStorage.setItem('velia-idle-save', JSON.stringify(getSaveState())); } catch(e) {}
  floatTxt(P.x, P.y, 100, i18next.t('admin:admin.reset.toast_demo_reset'), { gold:true });
}

// ---------- reset des quêtes (admin) : juste pour soi, ou pour tout le monde ----------
// "pour soi" ne touche que l'état local + sa propre sauvegarde cloud (aucun risque).
/** Réinitialise les quêtes journalières/hebdo de l'admin lui-même (aucun risque, ne touche que son propre état). */
function resetMyQuests() {
  if (!isAdmin()) return;
  S.dq = null; S.wq = null;
  ensureQuests('daily'); ensureQuests('weekly');
  hud();
  if ($a('infoOverlay').classList.contains('open')) openDailyQuests();
  if (sb && currentUser) saveToCloud();
  try { localStorage.setItem('velia-idle-save', JSON.stringify(getSaveState())); } catch(e) {}
  floatTxt(P.x, P.y, 100, i18next.t('admin:admin.reset.toast_my_quests_reset'), { gold:true });
}
// "pour tout le monde" appelle une fonction SECURITY DEFINER côté Supabase qui remet à null
// dq/wq dans TOUTES les sauvegardes cloud — celle-ci vérifie elle-même l'email admin côté
// serveur (voir supabase-quest-reset-schema.sql), le bouton masqué côté client n'étant
// qu'une protection de confort, pas la vraie barrière de sécurité.
/** Réinitialise les quêtes de TOUS les joueurs (RPC admin_reset_all_quests, SECURITY DEFINER — la vraie barrière est côté serveur), après confirmation. */
async function resetAllQuests() {
  if (!isAdmin() || !sb) return;
  const msg = i18next.t('admin:admin.reset.confirm_all_quests');
  if (!confirm(msg)) return;
  const { error } = await sb.rpc('admin_reset_all_quests');
  if (!error) logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a réinitialisé les quêtes de tous les joueurs`, 0x9cc9e8);
  if (error) {
    floatTxt(P.x, P.y, 100, i18next.t('admin:admin.common.failed_prefix') + error.message, { hurt:true });
    return;
  }
  resetMyQuests(); // applique aussi l'effet immédiatement à l'admin lui-même
  floatTxt(P.x, P.y, 100, i18next.t('admin:admin.reset.toast_all_quests_reset'), { gold:true });
}
// remise à zéro COMPLÈTE de TOUS les comptes (silver/équipement/niveau/sac), avec diffusion d'un
// message d'explication livré à chaque joueur (bannière stylée + notification) à sa prochaine
// connexion — demande explicite du 2026-07-06, deux confirmations vu la gravité de l'action
/** Remet à zéro TOUS les comptes (silver/équipement/niveau/sac) via RPC admin_reset_all_accounts, diffuse une bannière d'explication à chaque joueur à sa prochaine connexion. Double confirmation vu la gravité. */
async function resetAllAccounts() {
  if (!isAdmin() || !sb) return;
  const msg1 = i18next.t('admin:admin.reset.confirm_all_accounts_1');
  if (!confirm(msg1)) return;
  const msg2 = i18next.t('admin:admin.reset.confirm_all_accounts_2');
  if (!confirm(msg2)) return;
  const title_fr = '🔄 Remise à zéro de tous les comptes';
  const title_en = '🔄 All accounts have been reset';
  const body_fr = 'Merci beaucoup pour votre aide pendant la phase de test précédente ! 🙏<br><br>' +
    'Suite à un <b>gros changement d\'économie, de stuff et d\'équilibrage</b>, nous avons dû remettre TOUS les comptes à zéro pour repartir sur des tests propres et mieux calibrer le jeu.<br><br>' +
    'Pour info : le jeu est en <b>développement constant</b>, d\'autres resets peuvent survenir à tout moment tant qu\'on est en phase de test.';
  const body_en = 'Thank you so much for your help during the previous testing phase! 🙏<br><br>' +
    'Following a <b>major economy, gear and balance overhaul</b>, we had to reset ALL accounts to zero to start fresh testing and better calibrate the game.<br><br>' +
    'Note: the game is in <b>constant development</b>, more resets may happen at any time while we\'re in testing.';
  const { data, error } = await sb.rpc('admin_reset_all_accounts', { p_title_fr: title_fr, p_title_en: title_en, p_body_fr: body_fr, p_body_en: body_en });
  if (error) {
    floatTxt(P.x, P.y, 100, i18next.t('admin:admin.common.failed_prefix') + error.message, { hurt:true });
    return;
  }
  logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a réinitialisé TOUS les comptes (${data} comptes)`, 0xc05545);
  floatTxt(P.x, P.y, 100, i18next.t('admin:admin.reset.toast_all_accounts_reset', { data }), { gold:true });
  // applique aussi l'effet immédiatement à l'admin lui-même + montre la même bannière que les joueurs
  applySaveState(JSON.parse(JSON.stringify(DEFAULT_SAVE)));
  suppressLoyaltyGrantForToday();
  await saveToCloud();
  showResetNotice('🔄', title_fr, body_fr);
}
// "Screenshot" admin d'un joueur par UUID (demande explicite du 2026-07-06 : "coté admin pouvoir
// voir un screen jeu des joueurs en plus de l'uuid l'inventaire") -- lecture SEULE de sa
// sauvegarde brute (admin_get_player_save), affichée dans le panneau info générique. N'équipe/ne
// modifie jamais rien : c'est un snapshot en texte, pas une vraie capture d'écran de son navigateur
// (impossible côté web), mais montre exactement l'équivalent (équipement + sac + état).


// ---------- section "Vue d'ensemble" — dashboard synthétique (NOUVEAU, 2026-07-19, alertes
// ajoutées le 2026-07-20, consolidé avec TOUS les graphiques du panneau + voyants 🟢/🔴 le
// 2026-07-20 -- demande explicite : "ajoute dans le dashboard tout, et surtout des alerte sil y a
// trop de quelque chose" puis "ajoute toutes les graphique de tout les panel dans dashboard avec
// des voyant vert rouge pour plus dinfos") ----------

// voyant vert/rouge -- fonction PURE (juste une projection booléen -> {dot,label}), testable isolément
/** @param {boolean} healthy. @returns {{dot:string, label:string}} voyant 🟢/🔴 + libellé. Fonction pure. */
function dashboardLight(healthy) {
  return healthy
    ? { dot:'🟢', label: i18next.t('admin:admin.dashboard.light_ok') }
    : { dot:'🔴', label: i18next.t('admin:admin.dashboard.light_needs_attention') };
}

// Registre des widgets du dashboard : un par section "à graphique" du panneau. Chaque widget fetch
// SES PROPRES données (indépendamment des autres, voir Promise.allSettled dans renderAdminDashboard
// -- un widget en échec n'empêche jamais les autres de s'afficher) puis calcule
// { light, chart, note } via build(). Réutilise TELS QUELS les mêmes helpers de graphique que les
// sections dédiées (buildPieWithLegendHtml/buildBarSeriesSvg/buildSilverChartSvg, admin-economy.js,
// chargé APRÈS ce fichier) -- ces identifiants ne sont lus qu'à l'INTÉRIEUR des fonctions
// fetch()/build() ci-dessous, jamais au chargement immédiat du tableau lui-même (référence en
// exécution, pas de risque de TDZ -- voir CLAUDE.md §7). Cliquer une carte navigue vers la section
// complète correspondante via openAdminSection(cat, sec).
const DASHBOARD_WIDGETS = [
  { id:'dw-econ', cat:'economy', sec:'health', icon:'💹', title:{fr:'Santé économique',en:'Economic health'},
    fetch: () => sb.from('admin_silver_ledger_by_category').select('category, total_gained, total_spent'),
    build: ({ data }) => {
      const rows = (data||[]).map(r => ({ category:r.category, gained:Number(r.total_gained||0), spent:Number(r.total_spent||0) }));
      const alerts = computeEconAlerts(rows);
      const label = c => CATEGORY_LABEL[c] ? CATEGORY_LABEL[c][LANG] : c;
      const sources = rows.filter(r=>r.gained>0).map(r=>({label:label(r.category), value:r.gained}));
      return {
        light: dashboardLight(alerts.length===0),
        chart: buildHBarsSvg(sources, (typeof currentAdminAccentColors === 'function' ? currentAdminAccentColors().accent : '#c9a55a')),
        note: alerts.length ? alerts[0].text : i18next.t('admin:admin.dashboard.econ_healthy_note'),
      };
    } },
  { id:'dw-silver', cat:'economy', sec:'silver', icon:'🏦', title:{fr:'Flux de silver (48h)',en:'Silver flow (48h)'},
    fetch: () => sb.from('admin_silver_ledger_by_hour').select('hour, net_delta'),
    build: ({ data }) => {
      const rows = data || [];
      const netTotal = rows.reduce((a,r) => a + Number(r.net_delta||0), 0);
      const { accent, danger } = currentAdminAccentColors();
      return {
        light: dashboardLight(netTotal >= 0),
        chart: buildSilverChartSvg(rows, accent, danger),
        note: i18next.t('admin:admin.dashboard.silver_net_48h_prefix') + (netTotal>=0?'+':'') + fmt(Math.round(netTotal)),
      };
    } },
  { id:'dw-wealth', cat:'economy', sec:'wealth', icon:'📈', title:{fr:'Richesse des joueurs',en:'Player wealth'},
    fetch: () => sb.from('admin_wealth').select('silver'),
    build: ({ data }) => {
      const silvers = (data||[]).map(r => Number(r.silver||0)).sort((a,b)=>a-b);
      const total = silvers.reduce((a,b)=>a+b,0);
      const avg = silvers.length ? total/silvers.length : 0;
      const med = silvers.length ? silvers[Math.floor(silvers.length/2)] : 0;
      const brackets = [
        { max:10000, label:'< 10k' }, { max:100000, label:'10k-100k' }, { max:1000000, label:'100k-1M' },
        { max:10000000, label:'1M-10M' }, { max:Infinity, label:'10M+' },
      ];
      const counts = brackets.map(() => 0);
      silvers.forEach(v => { const idx = brackets.findIndex(b=>v<b.max); counts[idx>=0?idx:brackets.length-1]++; });
      // inégalité grossière : moyenne très supérieure à la médiane -> richesse concentrée sur peu de comptes
      const skewed = med > 0 && avg > med * 4;
      return {
        light: dashboardLight(!skewed),
        chart: buildHBarsSvg(brackets.map((b,i)=>({label:b.label, value:counts[i]})), (typeof currentAdminAccentColors === 'function' ? currentAdminAccentColors().accent : '#c9a55a'), { formatValue:v=>String(Math.round(v)) }),
        note: skewed ? i18next.t('admin:admin.dashboard.wealth_skewed_note') : i18next.t('admin:admin.dashboard.wealth_reasonable_note'),
      };
    } },
  { id:'dw-market', cat:'economy', sec:'market', icon:'🏛️', title:{fr:'Marché',en:'Market'},
    fetch: () => Promise.all([sb.rpc('get_market_open'), sb.rpc('admin_market_top_items', { p_days: adminPeriodDays() })]),
    build: ([{ data: openData }, { data: topItems }]) => {
      const open = openData !== false;
      const rows = topItems || [];
      return {
        light: dashboardLight(open && rows.length > 0),
        chart: buildHBarsSvg(rows.map(r => ({ label: tr(r.item_name)||r.item_name, value: Number(r.total_silver_value||0) })), (typeof currentAdminAccentColors === 'function' ? currentAdminAccentColors().accent : '#c9a55a')),
        note: !open ? i18next.t('admin:admin.dashboard.market_closed_note') : (rows.length ? i18next.t('admin:admin.dashboard.market_active_note') : i18next.t('admin:admin.dashboard.market_no_trades_note')),
      };
    } },
  { id:'dw-signups', cat:'overview', sec:'signups', icon:'📈', title:{fr:'Inscriptions (30j)',en:'Signups (30d)'},
    fetch: () => Promise.all([sb.rpc('admin_signups_by_day', { p_days: adminPeriodDays() }), sb.rpc('admin_signups_by_provider')]),
    build: ([{ data: byDay }, { data: byProvider }]) => {
      const rows = byDay || [];
      const { accent } = currentAdminAccentColors();
      const last7 = rows.slice(-7).reduce((a,r) => a + Number(r.signups||0), 0);
      const chart = rows.length
        ? buildBarSeriesSvg(rows.map(r => ({ label:r.day, value:Number(r.signups||0) })), accent)
        : buildHBarsSvg((byProvider||[]).map(r => ({ label: providerInfo(r.provider).icon+' '+providerInfo(r.provider).label[LANG], value: Number(r.signups||0) })), (typeof currentAdminAccentColors === 'function' ? currentAdminAccentColors().accent : '#c9a55a'), { formatValue:v=>String(Math.round(v)) });
      return {
        light: dashboardLight(last7 > 0),
        chart,
        note: i18next.t('admin:admin.dashboard.signups_note', { count: last7 }),
      };
    } },
  { id:'dw-bans', cat:'players', sec:'all', // 'sanctions' fusionné dans la page Joueurs (filtre) le 2026-07-19
     icon:'🚫', title:{fr:'Sanctions actives',en:'Active sanctions'},
    fetch: () => sb.rpc('admin_list_bans'),
    build: ({ data }) => {
      const count = (data||[]).length;
      return {
        light: dashboardLight(count === 0),
        chart: `<div style="text-align:center"><div style="font-size:34px;font-weight:bold;color:${count===0?'var(--gold)':'var(--danger)'}">${count}</div><div class="admHint">${i18next.t('admin:admin.dashboard.active_bans_label')}</div></div>`,
        note: count === 0 ? i18next.t('admin:admin.dashboard.no_active_sanction_note') : i18next.t('admin:admin.dashboard.players_banned_note', { count }),
      };
    } },
  { id:'dw-onboarding', cat:'content', sec:'onboarding', icon:'🧭', title:{fr:'Onboarding',en:'Onboarding'},
    fetch: () => sb.rpc('admin_onboarding_stats'),
    build: ({ data }) => {
      const s = (data && data[0]) || { started:0, completed:0, skipped:0, in_progress:0 };
      const started = Number(s.started||0), completed = Number(s.completed||0), skipped = Number(s.skipped||0), inProgress = Number(s.in_progress||0);
      const pct = started ? Math.round(completed/started*100) : 0;
      return {
        light: dashboardLight(!started || pct >= 40),
        chart: started ? buildPieWithLegendHtml([
          { label: i18next.t('admin:admin.dashboard.onboarding_completed_label'), value: completed },
          { label: i18next.t('admin:admin.dashboard.onboarding_skipped_label'), value: skipped },
          { label: i18next.t('admin:admin.dashboard.onboarding_in_progress_label'), value: inProgress },
        ], { thresholdPct:0 }) : `<div class="admEmpty">${i18next.t('admin:admin.dashboard.onboarding_none_started')}</div>`,
        note: started ? i18next.t('admin:admin.dashboard.completion_pct_note', { pct }) : '',
      };
    } },
  { id:'dw-tutorials', cat:'content', sec:'tutorials', icon:'🎓', title:{fr:'Tutoriels d\'objets',en:'Item tutorials'},
    fetch: () => sb.rpc('admin_item_tutorial_stats'),
    build: ({ data }) => {
      const rows = data || [];
      const completed = rows.reduce((a,r)=>a+Number(r.completed_count||0),0);
      const skipped = rows.reduce((a,r)=>a+Number(r.skipped_count||0),0);
      const total = completed + skipped;
      const skipRate = total ? skipped/total : 0;
      return {
        light: dashboardLight(!total || skipRate < 0.5),
        chart: total ? buildPieWithLegendHtml([
          { label: i18next.t('admin:admin.content.completed_label'), value: completed },
          { label: i18next.t('admin:admin.content.skipped_label'), value: skipped },
        ], { thresholdPct:0 }) : `<div class="admEmpty">${i18next.t('admin:admin.dashboard.tutorials_none_seen')}</div>`,
        note: total ? i18next.t('admin:admin.dashboard.skipped_pct_note', { pct: Math.round(skipRate*100) }) : '',
      };
    } },
  { id:'dw-companions', cat:'content', sec:'companions', icon:'🐾', title:{fr:'Compagnons',en:'Companions'},
    fetch: () => Promise.all([sb.rpc('admin_companion_stats'), sb.rpc('admin_companion_breakdown')]),
    build: ([{ data: statsData }, { data: breakdownData }]) => {
      const s = (statsData && statsData[0]) || {};
      const playersSynced = Number(s.players_synced||0);
      const rows = breakdownData || [];
      const rarityTotals = sumCompanionBreakdown(rows, 'rarity_breakdown');
      const rarityItems = COMPANION_RARITY_LABELS.filter(r => rarityTotals[r.id]).map(r => ({ label:r.name, value:rarityTotals[r.id] }));
      return {
        light: dashboardLight(playersSynced > 0),
        chart: playersSynced ? buildHBarsSvg(rarityItems, (typeof currentAdminAccentColors === 'function' ? currentAdminAccentColors().accent : '#c9a55a')) : `<div class="admEmpty">${i18next.t('admin:admin.dashboard.companions_none_synced')}</div>`,
        note: i18next.t('admin:admin.dashboard.companions_synced_note', { count: playersSynced }),
      };
    } },
  { id:'dw-zones', cat:'content', sec:'zones', icon:'🗾', title:{fr:'Progression par zone',en:'Zone progression'},
    fetch: () => sb.from('player_stats').select('best_zone_index'),
    build: ({ data }) => {
      const zoneCounts = new Map();
      (data||[]).forEach(r => { const zi = Number(r.best_zone_index||0); zoneCounts.set(zi, (zoneCounts.get(zi)||0)+1); });
      const items = [...zoneCounts.entries()].sort((a,b)=>a[0]-b[0]).map(([zi,cnt]) => ({ label: ZONES[zi] ? tr(ZONES[zi].name) : `#${zi}`, value: cnt }));
      return {
        light: dashboardLight(items.length > 0),
        chart: buildHBarsSvg(items, (typeof currentAdminAccentColors === 'function' ? currentAdminAccentColors().accent : '#c9a55a'), { formatValue: v => String(Math.round(v)) }),
        note: i18next.t('admin:admin.dashboard.players_count_note', { count: (data||[]).length }),
      };
    } },
  { id:'dw-cron', cat:'content', sec:'cron', icon:'⏳', title:{fr:'Pierres de Cron',en:'Cron Stones'},
    fetch: () => sb.from('admin_farm_by_item').select('item_name, item_kind, total_qty'),
    build: ({ data }) => {
      const farmedRow = (data||[]).find(r => r.item_name === CRON_STONE.name && r.item_kind === 'material');
      const usedRow = (data||[]).find(r => r.item_name === CRON_STONE.name && r.item_kind === 'cron_used');
      const farmed = farmedRow ? Number(farmedRow.total_qty||0) : 0;
      const used = usedRow ? Number(usedRow.total_qty||0) : 0;
      return {
        light: dashboardLight(farmed >= used),
        chart: buildPieWithLegendHtml([
          { label: i18next.t('admin:admin.dashboard.cron_in_stock_label'), value: Math.max(0, farmed-used) },
          { label: i18next.t('admin:admin.dashboard.cron_used_label'), value: used },
        ], { thresholdPct:0 }),
        note: i18next.t('admin:admin.dashboard.cron_farmed_used_note', { farmed: fmt(farmed), used: fmt(used) }),
      };
    } },
];
/** @param {object} widget - entrée de DASHBOARD_WIDGETS. @param {{light:object, chart:string, note:string}} result - résultat de widget.build(). @returns {string} HTML de la carte dashboard (cliquable, navigue vers la section complète). */
function buildDashboardCard(widget, result) {
  return `<div class="admDashCard" data-cat="${widget.cat}" data-id="${widget.sec}">
      <div class="admDashCardHead">
        <span class="admDashCardTitle">${widget.icon} ${widget.title[LANG]}</span>
        <span class="admDashLight" title="${result.light.label}">${result.light.dot}</span>
      </div>
      <div class="admDashCardBody">${result.chart}</div>
      <div class="admDashCardNote">${escapeHtml(result.note||'')}</div>
    </div>`;
}
/** @param {object} widget - entrée de DASHBOARD_WIDGETS dont le fetch/build a échoué. @returns {string} HTML de repli "Indisponible" pour cette carte seule. */
function buildDashboardCardError(widget) {
  return `<div class="admDashCard" data-cat="${widget.cat}" data-id="${widget.sec}">
      <div class="admDashCardHead"><span class="admDashCardTitle">${widget.icon} ${widget.title[LANG]}</span><span class="admDashLight" title="${i18next.t('admin:admin.dashboard.unavailable')}">⚪</span></div>
      <div class="admDashCardBody"><div class="admEmpty">${i18next.t('admin:admin.dashboard.unavailable')}</div></div>
    </div>`;
}
/** @param {HTMLElement} el. Dashboard "Vue d'ensemble" : tuiles globales + alertes économiques, puis une carte par widget de DASHBOARD_WIDGETS (chacun fetch ses propres données via Promise.allSettled — un widget en échec n'empêche jamais les autres). Clic sur une carte navigue vers sa section complète. */
// Renommée en ...Widgets le 2026-07-19 (refonte bdi-admin-ux.md §1) : ce qui était le dashboard
// entier ne rend plus QUE les graphiques, désormais placés SOUS les 3 questions (Q1 santé /
// Q2 KPI+deltas / Q3 à traiter) rendues par renderAdminDashboardV2 (admin-dashboard-react.js).
// Les tuiles du haut ont disparu d'ici : elles étaient des totaux absolus sans point de
// comparaison ("1,2M silver : bien ou mal ?"), remplacées par les 5 KPI avec delta de Q2.
// Les alertes économiques restent : elles disent autre chose que les checks de santé.
function renderAdminDashboardWidgets(el) {
  el.innerHTML = `<div class="admEmpty">${i18next.t('admin:admin.common.loading')}</div>`;
  const topPromise = Promise.all([
    sb.from('admin_silver_ledger_by_category').select('total_gained, total_spent'),
  ]).then(([{data: ledgerByCat}]) => {
    const alerts = typeof computeEconAlerts === 'function' ? computeEconAlerts(ledgerByCat) : [];
    const alertsHtml = typeof buildEconAlertsHtml === 'function' ? buildEconAlertsHtml(alerts) : '';
    return `${alertsHtml}<div class="admStatTilesLegacyRemoved" style="display:none"></div><div style="display:none">
      </div>`;
  });
  // Promise.allSettled : un widget qui échoue (RPC manquante, réseau...) ne doit jamais empêcher
  // les autres de s'afficher -- carte "Indisponible" en repli pour celui-là seulement.
  const widgetPromises = DASHBOARD_WIDGETS.map(w =>
    Promise.resolve(w.fetch()).then(res => buildDashboardCard(w, w.build(res))).catch(() => buildDashboardCardError(w))
  );
  Promise.all([topPromise, Promise.allSettled(widgetPromises)]).then(([topHtml, settled]) => {
    const cards = settled.map(s => s.status === 'fulfilled' ? s.value : '').join('');
    el.innerHTML = `${topHtml}
      <div class="admHint" style="margin:10px 0 12px">${i18next.t('admin:admin.dashboard.overview_hint')}</div>
      <div class="admDashGrid">${cards}</div>`;
    el.querySelectorAll('.admDashCard').forEach(card => {
      card.onclick = () => openAdminSection(card.dataset.cat, card.dataset.id);
    });
  });
}

// ---------- plateforme d'inscription (2026-07-20, demande explicite : "montre avec quoi les
// joueur se sont inscrit comme plateforme") -- provider vient de admin_list_players()/
// admin_signups_by_provider() (auth.users.raw_app_meta_data->>'provider', migration
// 20260719210000_admin_list_players_provider.sql). Fonction PURE, réutilisée par la liste des
// joueurs (icône) et par le camembert des inscriptions (admin-economy.js, label complet).
const PROVIDER_INFO = {
  email: { icon:'📧', label:{fr:'Email',en:'Email'} },
  discord: { icon:'🎮', label:{fr:'Discord',en:'Discord'} },
  google: { icon:'🔵', label:{fr:'Google',en:'Google'} },
  github: { icon:'🐙', label:{fr:'GitHub',en:'GitHub'} },
  twitter: { icon:'🐦', label:{fr:'Twitter/X',en:'Twitter/X'} },
  anonymous: { icon:'🎭', label:{fr:'Invité',en:'Guest'} },
};

// ---------- section "Contenu → Boss mondiaux" (gestion globale — spawn/despawn pour TOUS) ----------
// spawn un VRAI boss partagé (PV communs, top10, contribution %, joueurs en direct) — utilisé à la
// fois par le test perso admin (Compte→Tests) et par le lancement pour tous, pour que le test admin
// ressemble exactement au vrai boss multijoueurs (demande explicite : "pas un boss solo")
/** @param {string} id - clé BOSS_ROSTER. @param {number} targetMin - durée visée en minutes. @returns {Promise<boolean>} succès. Fait apparaître un vrai boss PARTAGÉ (PV communs dimensionnés sur ~40% des joueurs en ligne × DPS de référence), utilisé pour le lancement global ET le test perso admin. */
async function adminSpawnSharedBoss(id, targetMin) {
  if (!sb) return false;
  let onlineTotal = 1;
  try {
    const { data } = await sb.rpc('get_online_counts', { p_window_seconds: 90 });
    if (data && data[0]) onlineTotal = Math.max(1, data[0].total || 1);
  } catch (e) {}
  const expectedFighters = Math.max(1, Math.round(onlineTotal * 0.4));
  const sharedHp = Math.round(BOSS_REF_DPS * expectedFighters * targetMin * 60);
  const { error } = await sb.rpc('admin_spawn_boss', { p_boss_id: id, p_minutes: 9, p_hp: sharedHp });
  if (!error) await refreshLiveBoss();
  return !error;
}
/** @param {HTMLElement} el. Section admin "Boss mondiaux" : sélection boss/durée + boutons lancer pour tous / faire disparaître. */
function renderAdminBoss(el) {
  const bossOptions = Object.keys(BOSS_ROSTER).map(id => `<option value="${id}">${BOSS_ROSTER[id].icon} ${BOSS_ROSTER[id].short[LANG]}</option>`).join('');
  el.innerHTML = `
    <div class="admSection riskGlobal">
      <div class="admSectionTitle">🌍 ${i18next.t('admin:admin.content.boss_launch_title')}</div>
      <div class="admSectionSub">⚠️ ${i18next.t('admin:admin.content.boss_danger_sub')}</div>
      <div class="admBossSpawn">
        <span>${i18next.t('admin:admin.content.boss_label')}</span>
        <select id="admGlobalBossSelect">${bossOptions}</select>
        <select id="admBossDurationSelect">
          ${[2,3,4,5,6,7].map(m => `<option value="${m}"${m===4?' selected':''}>${i18next.t('admin:admin.content.boss_duration_option', { m })}</option>`).join('')}
        </select>
        <button id="btnAdmSpawnGlobal">${i18next.t('admin:admin.content.boss_launch_btn')}</button>
        <button id="btnAdmDespawnBoss">🛑 ${i18next.t('admin:admin.content.boss_despawn_btn')}</button>
      </div>
      <div class="admHint">${i18next.t('admin:admin.content.boss_hint')}</div>
    </div>`;
  $a('btnAdmSpawnGlobal').onclick = async () => {
    if (!isAdmin() || !sb) return;
    const id = $a('admGlobalBossSelect').value;
    const targetMin = Number($a('admBossDurationSelect').value) || 4;
    const ok = await adminSpawnSharedBoss(id, targetMin);
    if (ok) logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a lancé ${BOSS_ROSTER[id].name.fr} pour tous (~${targetMin} min)`, 0x9cc9e8);
    floatTxt(P.x, P.y, 100, ok ? i18next.t('admin:admin.content.boss_launched_toast') : i18next.t('admin:admin.content.boss_launch_failed_toast'), { gold:ok, hurt:!ok });
  };
  $a('btnAdmDespawnBoss').onclick = async () => {
    if (!isAdmin() || !sb) return;
    if (!confirm(i18next.t('admin:admin.content.boss_despawn_confirm'))) return;
    const { error } = await sb.rpc('admin_despawn_boss');
    if (!error) { await refreshLiveBoss(); logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a fait disparaître le boss mondial`, 0x9cc9e8); }
    floatTxt(P.x, P.y, 100, !error ? i18next.t('admin:admin.content.boss_despawned_toast') : i18next.t('admin:admin.common.failed'), { gold:!error, hurt:!!error });
  };
}

// ---------- ex-section "Notes de version → Discord" (2026-07-20) RETIRÉE (2026-07-13, demande
// explicite : "plus aucun chemin manuel, seulement l'annonce automatique du CI") -- l'annonce
// Discord des patch notes passe désormais exclusivement par scripts/announce-patch-note.js
// (lancé par .github/workflows/ci.yml sur push vers main, avec retry sur rate-limit). Le bouton
// admin manuel (formatPatchNoteForDiscord/publishPatchNoteToDiscord/renderAdminPatchNotesDiscord)
// et son entrée ADMIN_SECTIONS ont été supprimés -- voir git blame pour l'implémentation retirée
// si besoin de la retrouver. Clés i18n admin.patchnotes.publish_*/published_toast/version_label
// retirées de locales/{fr,en}/admin.json (n'étaient utilisées que par cette section).

// ---------- section "Contenu → Notes de version : modération" (2026-07-10, demande explicite,
// port de patch-notes-pipeline.md §12-13) -- commentaires retirés (restaurables) + signalements en
// attente sur les commentaires encore visibles. Réservé admin/modérateur côté serveur (même gate
// que remove_patch_note_comment, voir la migration) -- ce panneau n'est de toute façon accessible
// que via le panneau admin lui-même (isAdmin() déjà requis pour l'ouvrir).
/** @param {HTMLElement} el. Section admin "Notes de version : modération" : commentaires signalés en attente + commentaires retirés/auto-masqués restaurables. */
function renderAdminPatchNotesModeration(el) {
  el.innerHTML = `
    <div class="admSection">
      <div class="admSectionTitle">🚩 ${i18next.t('admin:admin.patchnotes.pending_reports_title')}</div>
      <div id="admPatchReports"><div class="admEmpty">${i18next.t('admin:admin.common.loading')}</div></div>
    </div>
    <div class="admSection">
      <div class="admSectionTitle">🗑️ ${i18next.t('admin:admin.patchnotes.removed_comments_title')}</div>
      <div id="admPatchRemoved"><div class="admEmpty">${i18next.t('admin:admin.common.loading')}</div></div>
    </div>`;
  refreshAdminPatchNotesModeration();
}
/** Recharge les signalements en attente et les commentaires retirés/auto-masqués (RPC admin_patch_note_pending_reports/admin_list_removed_patch_note_comments), câble la restauration. */
async function refreshAdminPatchNotesModeration() {
  if (!sb) return;
  const reportsEl = $a('admPatchReports'), removedEl = $a('admPatchRemoved');
  if (!reportsEl || !removedEl) return;

  const { data: reports, error: reportsErr } = await sb.rpc('admin_patch_note_pending_reports');
  reportsEl.innerHTML = reportsErr ? `<div class="admHint">${escapeHtml(reportsErr.message)}</div>`
    : (!reports || reports.length === 0) ? `<div class="admEmpty">${i18next.t('admin:admin.patchnotes.no_pending_reports')}</div>`
    : reports.map(r => `<div class="achRow">
        <div class="achInfo"><div class="achName">${escapeHtml(r.author)} — ${escapeHtml(r.entry_id)}</div>
        <div class="achDesc">${escapeHtml(r.text)}</div></div>
        <div class="achReward">🚩 ${r.report_count}</div>
      </div>`).join('');

  // depuis le 2026-07-11 (audit vs patch-notes-pipeline.md §13, "auto-masquage au-delà d'un seuil
  // de signalements"), cette RPC couvre aussi les commentaires auto-masqués (status='pending_review',
  // ≥5 signalements) en plus des retirés manuellement (status='removed') -- distingués ici par un
  // badge, même file de restauration pour les deux.
  const { data: removed, error: removedErr } = await sb.rpc('admin_list_removed_patch_note_comments');
  removedEl.innerHTML = removedErr ? `<div class="admHint">${escapeHtml(removedErr.message)}</div>`
    : (!removed || removed.length === 0) ? `<div class="admEmpty">${i18next.t('admin:admin.patchnotes.no_removed_comments')}</div>`
    : removed.map(c => `<div class="achRow" data-cid="${c.id}">
        <div class="achInfo"><div class="achName">${escapeHtml(c.author)} — ${escapeHtml(c.entry_id)} ${c.status==='pending_review'?`<span style="color:var(--red2,#e08070)">🚩 ${i18next.t('admin:admin.patchnotes.auto_hidden_label')}</span>`:''}</div>
        <div class="achDesc">${escapeHtml(c.text)}</div></div>
        <div class="achReward"><button class="admPatchRestoreBtn" data-cid="${c.id}">↩️ ${i18next.t('admin:admin.patchnotes.restore_btn')}</button></div>
      </div>`).join('');
  removedEl.querySelectorAll('.admPatchRestoreBtn').forEach(btn => {
    btn.onclick = async () => {
      await sb.rpc('restore_patch_note_comment', { p_comment_id: parseInt(btn.dataset.cid, 10) });
      refreshAdminPatchNotesModeration();
    };
  });
}

// ---------- section "Compte (Moi)" ----------
/** @param {HTMLElement} el. Section admin "Tests perso" : raccourcis (silver/loyalty/succès/reset), combat de boss partagé en solo. */
function renderAdminMyTests(el) {
  const bossOptions = Object.keys(BOSS_ROSTER).map(id => `<option value="${id}">${BOSS_ROSTER[id].icon} ${BOSS_ROSTER[id].short[LANG]}</option>`).join('');
  el.innerHTML = `
    <div class="admSection riskSafe">
      <div class="admSectionTitle">👤 ${i18next.t('admin:admin.tests.title')}</div>
      <div class="admSectionSub">${i18next.t('admin:admin.tests.sub')}</div>
      <div class="admActions">
        <button id="btnTestSilver">💰 +1M silver</button>
        <button id="btnTestLoyalty">📬 +200 Loyalties</button>
        <button id="btnTestAch">🏅 ${i18next.t('admin:admin.tests.unlock_achievements_btn')}</button>
        <button id="btnResetMyQuests">🔄 ${i18next.t('admin:admin.tests.reset_my_quests_btn')}</button>
        <button id="btnResetDemo">🔄 ${i18next.t('admin:admin.tests.reset_demo_btn')}</button>
      </div>
      <div class="admBossSpawn">
        <span>${i18next.t('admin:admin.tests.fight_boss_label')}</span>
        <select id="admBossSelect">${bossOptions}</select>
        <button id="btnAdmSpawnBoss">${i18next.t('admin:admin.tests.fight_now_btn')}</button>
      </div>
      <div class="admHint">${i18next.t('admin:admin.tests.hint')}</div>
    </div>`;
  $a('btnTestSilver').onclick = () => { if(!isAdmin())return; addSilver(1000000, 'admin_test'); refreshStatsOnly(); floatTxt(P.x,P.y,100,'+1M 🪙',{gold:true}); };
  $a('btnTestLoyalty').onclick = () => { if(!isAdmin())return; mailboxAdd('loyalty', 'Loyalties', '🏅', 200); updateMailBadge(); floatTxt(P.x,P.y,100,'+200 🏅 (courrier)',{gold:true}); };
  $a('btnTestAch').onclick = () => { if(!isAdmin())return; ACHIEVEMENTS.forEach(a => { if(!S.achUnlocked[a.id]){ S.achUnlocked[a.id]=Date.now(); addSilver(a.reward, 'admin_test', a.name.fr); } }); refreshStatsOnly(); renderAdminMyTests(el); };
  $a('btnResetMyQuests').onclick = resetMyQuests;
  $a('btnResetDemo').onclick = resetDemo;
  $a('btnAdmSpawnBoss').onclick = async () => {
    if (!isAdmin() || !sb) return;
    const id = $a('admBossSelect').value;
    const ok = await adminSpawnSharedBoss(id, 4);
    if (!ok) { floatTxt(P.x, P.y, 100, i18next.t('admin:admin.content.boss_launch_failed_toast'), { hurt:true }); return; }
    closeAdminPanel();
    startBossFight(id, true); // true = rejoint le boss PARTAGÉ qu'on vient de lancer (PV communs, top10...)
  };
}

// ---------- palette, en haut à gauche du panneau (2026-07-20, demande explicite : "palette de
// couleurs e mettre en haut a gauche") -- remplace l'ancien slider planqué sous Système>Palette
// (il fallait naviguer jusque là juste pour changer de couleur) par des pastilles cliquables
// directement dans .admNavHead, donc visibles en permanence dès l'ouverture du panneau, quelle
// que soit la section affichée. Même storage/effet (setAdminTheme/data-adm-theme) que l'ancien
// slider, juste un contrôle différent. ----------
/** @param {string} currentTheme - id de thème actif. @returns {string} HTML des pastilles de palette (haut de sidebar), toujours visibles quelle que soit la section affichée. */
function renderAdminThemeSwatchesHtml(currentTheme) {
  return `<div class="admThemeSwatches" title="🎨 ${i18next.t('admin:admin.system.palette_label')}">${ADMIN_THEMES.map(t =>
    `<button class="admSwatchBtn${t.id===currentTheme?' active':''}" data-theme="${t.id}" style="background:${t.color}" title="${escapeHtml(t.label[LANG])}"></button>`
  ).join('')}</div>`;
}
/** Câble les pastilles de palette (change data-adm-theme + persiste via setAdminTheme). */
function wireAdminThemeSwatches() {
  $a('adminSidebar').querySelectorAll('.admSwatchBtn').forEach(btn => {
    btn.onclick = () => {
      const t = ADMIN_THEMES.find(x => x.id === btn.dataset.theme) || ADMIN_THEMES[0];
      const root = $a('adminOverlay');
      if (root) root.dataset.admTheme = t.id;
      $a('adminSidebar').querySelectorAll('.admSwatchBtn').forEach(b => b.classList.toggle('active', b === btn));
      setAdminTheme(t.id);
    };
  });
}
/** @param {HTMLElement} el. Section admin "Zone danger" : reset des quêtes de tous / reset complet de tous les comptes. */
function renderAdminServerDanger(el) {
  el.innerHTML = `
    <div class="admSection riskGlobal">
      <div class="admSectionTitle">🌍 ${i18next.t('admin:admin.system.danger_title')}</div>
      <div class="admSectionSub">⚠️ ${i18next.t('admin:admin.content.boss_danger_sub')}</div>
      <div class="admActions">
        <button id="btnResetAllQuests">⚠️ ${i18next.t('admin:admin.system.reset_all_quests_btn')}</button>
        <button id="btnResetAllAccounts" style="border-color:var(--danger);color:#e8a89f">💥 ${i18next.t('admin:admin.system.reset_all_accounts_btn')}</button>
      </div>
      <div class="admHint warn">${i18next.t('admin:admin.system.reset_all_accounts_hint')}</div>
    </div>`;
  $a('btnResetAllQuests').onclick = resetAllQuests;
  $a('btnResetAllAccounts').onclick = resetAllAccounts;
}

// ============================================================
// SHELL : ouverture/fermeture du panneau, sidebar pilotée par ADMIN_SECTIONS
// ============================================================
/** Ferme le panneau admin plein écran. */
function closeAdminPanel() {
  const overlay = $a('adminOverlay'); if (overlay) overlay.classList.remove('open');
  // n'efface le hash QUE s'il est le nôtre : `#patch-<version>` (notes de version) et
  // `#type=recovery` (lien de récupération Supabase) doivent survivre à la fermeture du panneau.
  // replaceState et non location.hash='' : on ne veut PAS d'entrée d'historique pour une fermeture.
  if (parseAdminHash(location.hash)) {
    admHashGuard = true;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    setTimeout(() => { admHashGuard = false; }, 0);
  }
}
/** @param {string} activeCat @param {string} activeId - section actuellement affichée. @returns {string} HTML de la sidebar admin (groupes/items de ADMIN_SECTIONS, badge "Prévu" pour les items planned). */
function renderAdminSidebar(activeCat, activeId) {
  return ADMIN_SECTIONS.map(group => `
    <div class="admNavCatLabel">${group.label[LANG]}</div>
    ${group.items.map(item => `
      <div class="admNavItem${activeCat===group.cat&&activeId===item.id?' active':''}${item.planned?' planned':''}" data-cat="${group.cat}" data-id="${item.id}">
        <span class="admNavIcon">${item.icon}</span><span>${item.label[LANG]}</span>
        ${item.planned?`<span class="admNavBadge">${i18next.t('admin:admin.system.planned_badge')}</span>`:''}
      </div>`).join('')}
  `).join('');
}
/** @param {string} cat @param {string} id. @returns {?object} item de ADMIN_SECTIONS correspondant, null si absent. */
function findAdminSection(cat, id) {
  const group = ADMIN_SECTIONS.find(g => g.cat === cat);
  return group ? group.items.find(i => i.id === id) : null;
}
/** @param {string} cat @param {string} id. Bascule la sidebar sur cette section, affiche son pane "Prévu" si planned, sinon appelle son render(body). */
function openAdminSection(cat, id) {
  const item = findAdminSection(cat, id);
  if (!item) return;
  currentAdminSection = { cat, id }; // retenu pour re-rendre au changement de période (§4)
  writeAdminHash(cat, id, null);     // l'URL suit la navigation (§7 : favoris, partage, retour arrière)
  $a('adminSidebar').querySelectorAll('.admNavItem').forEach(el => {
    el.classList.toggle('active', el.dataset.cat === cat && el.dataset.id === id);
  });
  // écrit UNIQUEMENT le titre (pas tout le header) -- corrige un bug réel signalé le 2026-07-19 :
  // le bouton fermer vivait dans #adminMainHead, écrasé dès le premier appel à openAdminSection()
  // (appelé par openAdminPanel() juste après avoir posé le bouton), le rendant inutilisable dès
  // l'ouverture du panneau. Le bouton fermer vit désormais dans la sidebar (#closeAdmin,
  // permanent, jamais réécrit par un changement de section) -- voir openAdminPanel() ci-dessous.
  $a('adminMainTitle').textContent = item.icon + ' ' + item.label[LANG];
  const body = $a('adminMainBody');
  if (item.planned) {
    body.innerHTML = `<div class="admPlannedPane"><div class="admPlannedIcon">🔜</div>
      ${i18next.t('admin:admin.system.planned_pane_text')}</div>`;
    return;
  }
  item.render(body);
}
// ---------- barre de recherche de la sidebar (2026-07-20, demande explicite : "ajoute moi une
// barre de recherceh") -- filtre en direct les items de ADMIN_SECTIONS par libellé (fr/en),
// masque aussi l'en-tête de catégorie d'un groupe devenu entièrement vide. Pure manipulation DOM,
// aucun re-render de renderAdminSidebar() (garde la sélection "active" intacte pendant la frappe).
/** Câble la barre de recherche de la sidebar admin : filtre en direct les items par libellé, masque les en-têtes de catégorie devenus entièrement vides. Pure manipulation DOM, pas de re-render. */
function wireAdminSidebarSearch() {
  const input = $a('admNavSearch'); if (!input) return;
  input.oninput = () => {
    const q = input.value.trim().toLowerCase();
    const rows = [...$a('adminSidebar').children].filter(c => c.classList.contains('admNavCatLabel') || c.classList.contains('admNavItem'));
    let lastCatLabel = null, catHasVisible = false;
    rows.forEach(el => {
      if (el.classList.contains('admNavCatLabel')) {
        if (lastCatLabel) lastCatLabel.style.display = catHasVisible ? '' : 'none';
        lastCatLabel = el; catHasVisible = false;
        return;
      }
      const match = !q || el.textContent.toLowerCase().includes(q);
      el.style.display = match ? '' : 'none';
      if (match) catHasVisible = true;
    });
    if (lastCatLabel) lastCatLabel.style.display = catHasVisible ? '' : 'none';
  };
}
/** Ouvre le panneau admin plein écran : applique le thème persisté, construit la sidebar (ADMIN_SECTIONS + recherche + pastilles de palette), ouvre le Dashboard par défaut. */
async function openAdminPanel() {
  if (!isAdmin() || !sb) return;
  const currentTheme = getAdminTheme();
  const overlay = $a('adminOverlay');
  overlay.classList.add('admThemeRoot');
  overlay.dataset.admTheme = currentTheme;
  // le sélecteur vit dans #adminMainHead à côté du titre : openAdminSection ne réécrit QUE
  // #adminMainTitle (voir son commentaire), donc il survit aux changements de section.
  $a('adminMainHead').innerHTML = `<span id="adminMainTitle" style="flex:1"></span>` +
    `<span id="adminPeriodPicker" class="admPeriodPicker" title="${i18next.t('admin:admin.system.period_title')}"></span>`;
  renderAdminPeriodPicker();
  $a('adminSidebar').innerHTML = `<div class="admNavHead">` +
      `<span class="admNavTitle">🛠️ Admin</span>` +
      renderAdminThemeSwatchesHtml(currentTheme) +
      `<button id="closeAdmin" title="${i18next.t('admin:admin.system.close_btn_title')}">✕</button></div>` +
    `<input type="text" id="admNavSearch" class="admNavSearch" placeholder="🔍 ${i18next.t('admin:admin.system.search_placeholder')}">` +
    renderAdminSidebar('overview', 'dashboard');
  $a('closeAdmin').onclick = closeAdminPanel;
  $a('adminSidebar').querySelectorAll('.admNavItem').forEach(el => {
    el.onclick = () => openAdminSection(el.dataset.cat, el.dataset.id);
  });
  wireAdminThemeSwatches();
  wireAdminSidebarSearch();
  overlay.classList.add('open');
  // si l'URL désigne déjà une section (deep link, §7), on l'ouvre elle -- sinon le dashboard
  const routeAtOpen = parseAdminHash(location.hash);
  openAdminSection(routeAtOpen ? routeAtOpen.cat : 'overview', routeAtOpen ? routeAtOpen.id : 'dashboard');
}
// 2026-07-13 : #btnAdmin (sidebar, dans #adminBox) retiré, doublon du header -- #btnAdminTopbar
// est désormais le SEUL déclencheur.
$a('btnAdminTopbar').onclick = openAdminPanel;

// panneau Testeur : accès aux fonctionnalités en avant-première, sans aucun avantage de jeu.
// Pour l'instant, contenu limité (pêche/mine/etc. pas encore développés) — le panneau existe et
// se remplira au fur et à mesure des nouveautés à tester. Reste sur l'ancienne modale (openInfo) :
// c'est un panneau JOUEUR (myIsTester), pas admin, pas concerné par la refonte de la sidebar.
/** Ouvre le panneau Testeur (fonctionnalités à venir, aucun avantage de jeu) — réservé aux joueurs avec le rôle testeur. Panneau joueur (openInfo), pas admin. */
function openTesterPanel() {
  if (!myIsTester) return;
  const upcoming = [
    { icon:'🎣', name:{fr:'Pêche',en:'Fishing'} },
    { icon:'⛏️', name:{fr:'Mine',en:'Mining'} },
    { icon:'🌲', name:{fr:'Forêt',en:'Forest'} },
    { icon:'🌾', name:{fr:'Champs',en:'Fields'} },
    { icon:'🐑', name:{fr:'Bergerie',en:'Ranch'} },
  ];
  const list = upcoming.map(a => `<div class="achRow inactive"><div class="achIcon">${a.icon}</div>` +
    `<div class="achInfo"><div class="achName">${a.name[LANG]}</div><div class="achDesc">${i18next.t('admin:admin.tests.upcoming_in_dev')}</div></div></div>`).join('');
  openInfo(i18next.t('admin:admin.tests.tester_panel_title'),
    `<div class="admSummary">${i18next.t('admin:admin.tests.tester_panel_intro')}</div>` +
    list);
}
$a('btnTester').onclick = openTesterPanel;
