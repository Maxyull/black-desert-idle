
// ============================================================
// SUPABASE — comptes joueurs + sauvegarde cloud
// ============================================================
// 🔧 À REMPLIR : dans ton projet Supabase > Project Settings > API
const SUPABASE_URL = 'https://mkwwvzbjtyawpcyrnybk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_c7HLxbeBLe01rirZVg-XPA_TClYulIJ';

let sb = null, currentUser = null;
// verrou multi-session (2026-07-10, demande explicite : "Interdire multionglet, multi navigateur
// and multidevice") -- identifiant unique généré UNE FOIS par chargement de page (jamais persisté
// en localStorage : deux onglets du même navigateur doivent avoir 2 ID différents). sessionLocked
// est lu par advanceSim() (game-core.js, gate le farm) et saveToCloud() (gate la sauvegarde, pour
// qu'une session évincée n'écrase jamais la progression de la session active).
let mySessionId = null;
try { mySessionId = crypto.randomUUID(); } catch(e) { mySessionId = 'sess-' + Date.now() + '-' + Math.random().toString(36).slice(2); }
let sessionLocked = false;
// mode hors ligne (2026-07-10, demande explicite) -- navigator.onLine + events 'online'/'offline'
// détectent la coupure réseau ; isOffline gate saveToCloud() vers le fallback localStorage
// (saveToLocalOfflineCache) plutôt que de laisser échouer silencieusement l'upsert Supabase.
let isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
let pendingOfflineSync = false;
try {
  if (window.supabase && SUPABASE_URL.startsWith('https://') && !SUPABASE_URL.includes('TON-PROJET')) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) { console.warn('Supabase non initialisé :', e); }

// ---------- API interne du bot Discord (ajout auto au serveur après connexion OAuth) ----------
// 🔧 À REMPLIR : URL publique du service Render + même valeur que INTERNAL_API_SECRET côté bot.
// Comme ce fichier est public sur GitHub, BOT_API_SECRET n'est PAS un vrai secret — c'est
// juste un filtre anti-spam basique, la vraie protection vient de Discord (voir bot README).
const BOT_API_URL = 'https://black-desert-idle-discord-bot.onrender.com';
const BOT_API_SECRET = 'TON-SECRET-PARTAGE';
let myPseudo = null; // pseudo effectif du joueur courant, mis en cache après connexion
let myIsMod = false; // le joueur courant est-il modérateur (table chat_mods) ? — pour afficher les ✕ de suppression
let myIsTester = false; // le joueur courant est-il testeur (table testers) ? — accès au panneau Tester
/** Vérifie si le joueur courant est testeur (table testers) et bascule la visibilité du bouton Tester. */
async function refreshMyTesterStatus() {
  myIsTester = false;
  if (sb && currentUser && !isGuest()) {
    try { const { data } = await sb.from('testers').select('user_id').eq('user_id', currentUser.id).maybeSingle(); myIsTester = !!data; } catch (e) {}
  }
  const b = $a('btnTester'); if (b) b.style.display = myIsTester ? '' : 'none';
}
/** Vérifie si le joueur courant est modérateur (table chat_mods) et re-render les onglets du chat (le statut mod peut débloquer le canal "modéré"). */
async function refreshMyModStatus() {
  myIsMod = false;
  if (!sb || !currentUser || isGuest()) { if (typeof renderChatTabs==='function') renderChatTabs(); return; }
  try {
    const { data } = await sb.from('chat_mods').select('user_id').eq('user_id', currentUser.id).maybeSingle();
    myIsMod = !!data;
  } catch (e) {}
  // le statut mod peut débloquer le canal "modéré" → on re-render les onglets du chat
  if (typeof renderChatTabs === 'function') renderChatTabs();
}
// override admin des taux de la table de loot V2 (2026-07-19, éditeur admin-economy.js) --
// fusionne PAR-DESSUS LOOT_RATES_LIVE (jamais l'inverse, jamais sur LOOT_RATES_V2 qui reste la
// référence par défaut) ; lecture publique (RLS select-all sur game_config), pas besoin de RPC.
// Repli silencieux si la ligne n'existe pas encore ou si hors-ligne -- LOOT_RATES_LIVE garde alors
// simplement sa valeur par défaut (copie de LOOT_RATES_V2), aucun risque de casser le loot normal.
/** Charge l'override admin des taux de loot V2 (game_config) et le fusionne par-dessus LOOT_RATES_LIVE (partiel, jamais écraser un palier non couvert par l'override). No-op silencieux si absent/hors-ligne. */
async function refreshLiveLootRates() {
  if (!sb || typeof LOOT_RATES_LIVE === 'undefined') return;
  try {
    const { data } = await sb.from('game_config').select('value').eq('key', 'loot_rates_v2').maybeSingle();
    if (!data || !data.value) return;
    // fusion PARTIELLE : un override qui ne couvre qu'un palier ne doit jamais écraser les autres
    for (const grade of Object.keys(LOOT_RATES_LIVE)) {
      if (data.value[grade]) LOOT_RATES_LIVE[grade] = { ...LOOT_RATES_LIVE[grade], ...data.value[grade] };
    }
  } catch (e) {}
}

// ---------- admin (accès réservé à ce compte précis) ----------
const ADMIN_EMAIL = 'maxime.lacoste@icloud.com';
function isAdmin() { return !!(currentUser && currentUser.email === ADMIN_EMAIL); }
// système de sanctions (2026-07-18, voir docs/ADMIN_MENU_PLAN.md §3.1) : banStatus = { banned_until, ban_reason } ou null
/** @param {?{banned_until:string, ban_reason:string}} banStatus. @returns {boolean} vrai si le bannissement est encore actif (banned_until dans le futur). */
function isBanned(banStatus) {
  if (!banStatus || !banStatus.banned_until) return false;
  const t = new Date(banStatus.banned_until).getTime();
  return !isNaN(t) && t > Date.now();
}
// invité = session anonyme Supabase (pas d'email/mot de passe) — jeu jouable et sauvegardé,
// mais aucun accès au marché/classement (surfaces les plus exposées à la triche multi-comptes)
function isGuest() { return !!(currentUser && currentUser.is_anonymous); }

// bug corrigé (2026-07-20, "toujours aucunes stats declosion... verifie si tout est connecté a
// supabase") : `sb`/`currentUser` sont déclarés en `let` top-level -- contrairement à `var` ou à
// une déclaration `function`, `let` au top-level d'un script classique NE devient PAS une
// propriété de `window`. sync.js (module Compagnon, iframe same-origin) lisait
// `window.parent.sb`/`window.parent.currentUser`, qui étaient donc TOUJOURS `undefined` -- le
// sync ne s'est jamais déclenché, pour aucun compte (invité ou non). Ces deux accesseurs sont des
// déclarations `function`, qui elles SONT attachées à `window` automatiquement -- toujours à jour
// car elles lisent `sb`/`currentUser` au moment de l'appel, pas une copie figée.
/** @returns {?object} client Supabase — accesseur `function` (attaché à window, contrairement à `let sb`) utilisé par les iframes same-origin (module Compagnons). */
function getSbClient() { return sb; }
/** @returns {?object} utilisateur courant — même raison que getSbClient(). */
function getCurrentUserForSync() { return currentUser; }
// même besoin que ci-dessus, pour le Marché Compagnon (2026-07-10) : les offres/contre-offres
// affichent un pseudo lisible, `myPseudo` (let top-level) n'était pas accessible depuis l'iframe.
/** @returns {string} pseudo affiché du joueur courant, accessible depuis les iframes same-origin (marché Compagnons). */
function getMyPseudoForSync() { return myPseudo || (currentUser && (currentUser.email || '?').split('@')[0]) || 'Joueur'; }

// ---------- journal de farm (pour les stats admin) : queue légère, envoyée par lots ----------
// Agrégée en mémoire (clé = objet+zone) plutôt qu'une ligne par ramassage individuel : le combat
// automatique loot plusieurs fois par seconde, une ligne par pickup faisait exploser farm_events
// (~250k lignes/jour, 250 Mo en moins d'une semaine sur un quota de 500 Mo -- constaté le
// 2026-07-08). Les totaux par objet/zone restent exacts, seule la granularité "un pickup = une
// ligne" est perdue (jamais utilisée : admin_farm_by_item ne fait que sommer qty/silver_value).
let farmEventQueue = new Map();
/** @param {string} kind @param {string} name @param {number} qty @param {number} silverVal. Agrège un événement de farm dans farmEventQueue (clé objet+zone) pour un envoi groupé par flushFarmEvents(), no-op si invité/déconnecté. */
function queueFarmEvent(kind, name, qty, silverVal) {
  if (!sb || !currentUser || isGuest()) return; // pas de compte vérifié → pas de journalisation
  const zone = Z().name;
  const key = kind + '|' + name + '|' + zone;
  const cur = farmEventQueue.get(key);
  if (cur) { cur.qty += qty; cur.silver_value += silverVal; }
  else farmEventQueue.set(key, { user_id: currentUser.id, item_name: name, item_kind: kind, qty, silver_value: silverVal, zone_name: zone });
}
/** Envoie farmEventQueue en un seul lot (insert batch) puis vide la queue. Appelé toutes les 25s + à la fermeture de page. */
async function flushFarmEvents() {
  if (!sb || !currentUser || isGuest() || farmEventQueue.size === 0) return;
  const batch = Array.from(farmEventQueue.values());
  farmEventQueue.clear();
  try { await sb.from('farm_events').insert(batch); } catch(e) { /* pas grave, prochain lot rattrapera */ }
}
setInterval(flushFarmEvents, 25000);
window.addEventListener('beforeunload', flushFarmEvents);

// ---------- registre de silver (2026-07-10, demande explicite : "je dois pouvoir traquer le
// moindre silver") : même principe que le journal de farm ci-dessus -- queue légère envoyée par
// lots, jamais bloquante. Appelée par addSilver() (game-core.js) à CHAQUE variation de silver côté
// client (loot, potions, ventes, quêtes, succès...) ; les mouvements côté marché (SECURITY
// DEFINER, silver déplacé directement en base sans jamais repasser par le client) sont journalisés
// séparément, directement dans les fonctions SQL market_place_order/market_match_item — voir la
// migration silver_ledger.
// Agrégée en mémoire (clé = catégorie+note) pour la même raison que farmEventQueue ci-dessus --
// silver_ledger grossissait d'environ 480k lignes/jour (une ligne par variation de silver, y
// compris chaque petit loot de trash). Les totaux par catégorie (admin_silver_ledger_by_category)
// restent exacts, seul l'horodatage individuel de chaque micro-variation est perdu.
let silverLedgerQueue = new Map();
/** @param {number} delta - variation de silver. @param {string} category @param {string} note. Agrège dans silverLedgerQueue (clé catégorie+note) pour un envoi groupé par flushSilverLedger(). */
function queueSilverLedger(delta, category, note) {
  if (!sb || !currentUser || isGuest() || !delta) return; // pas de compte vérifié → pas de journalisation
  const key = category + '|' + (note || '');
  const cur = silverLedgerQueue.get(key);
  if (cur) cur.delta += Math.round(delta);
  else silverLedgerQueue.set(key, { user_id: currentUser.id, delta: Math.round(delta), category, note: note || null });
}
/** Envoie silverLedgerQueue en un seul lot (filtre les deltas nuls) puis vide la queue. */
async function flushSilverLedger() {
  if (!sb || !currentUser || isGuest() || silverLedgerQueue.size === 0) return;
  const batch = Array.from(silverLedgerQueue.values()).filter(r => r.delta !== 0);
  silverLedgerQueue.clear();
  if (batch.length === 0) return;
  try { await sb.from('silver_ledger').insert(batch); } catch(e) { /* pas grave, prochain lot rattrapera */ }
}
setInterval(flushSilverLedger, 25000);
window.addEventListener('beforeunload', flushSilverLedger);

// $a est desormais declare dans game-core.js (evite un piege de zone morte temporelle une fois
// le jeu regroupe en un seul fichier -- voir le commentaire a cote de sa declaration)

/** @param {string} msg @param {boolean} isError - affiche en erreur (authError) ou en statut neutre (authStatus). */
function authShow(msg, isError) {
  $a('authError').textContent = isError ? msg : '';
  $a('authStatus').textContent = isError ? '' : (msg || '');
}
// "Dernière fois" (2026-07-16, demande explicite) : mémorise la méthode de connexion réellement
// utilisée (provider Supabase : email/discord/google/github/twitter) et affiche un petit badge
// "Last used" sur le bouton correspondant à l'ouverture de l'écran de connexion — repère visuel
// à la Google. Purement local (localStorage), aucune donnée serveur.
const LAST_LOGIN_KEY = 'velia-idle-last-login-method';
const LAST_LOGIN_BTN = { email:'btnSignIn', discord:'btnSignInDiscord', google:'btnSignInGoogle', github:'btnSignInGithub', twitter:'btnSignInTwitter' };
/** Mémorise la méthode de connexion utilisée (provider Supabase). */
function rememberLastLoginMethod(provider) {
  if (!provider || !LAST_LOGIN_BTN[provider]) return;
  try { localStorage.setItem(LAST_LOGIN_KEY, provider); } catch (e) {}
}
/** Ajoute (ou retire) le badge "Dernière fois" sur le bouton de la dernière méthode utilisée. */
function renderLastUsedBadge() {
  document.querySelectorAll('.lastUsedBadge').forEach(b => b.remove());
  let method = null;
  try { method = localStorage.getItem(LAST_LOGIN_KEY); } catch (e) {}
  const btnId = method && LAST_LOGIN_BTN[method];
  const btn = btnId && $a(btnId);
  if (!btn) return;
  const badge = document.createElement('span');
  badge.className = 'lastUsedBadge';
  badge.textContent = (typeof i18next !== 'undefined' ? i18next.t('backend:backend.auth.last_used') : 'Last used');
  btn.appendChild(badge);
}
// ==================== ÉCRAN D'AUTH À MODES ====================
// (2026-07-22, demande explicite : "page de connexion aucun champ / se co/créer compte/mdp perdu /
// puis ouvrir les champs selon le choix"). L'écran s'ouvre SANS aucun champ : on choisit d'abord
// une intention (#authChoice), et seuls les champs de cette intention s'affichent (#authForm).
//
// AUTH_MODES est la SEULE source de vérité de "quels champs pour quelle intention" : ajouter un
// flux = ajouter une entrée ici, pas du display:none disséminé (c'est ce que faisait l'ancien
// showPasswordRecoveryUI, qui masquait 7 ids à la main -- il passe par 'recovery' ci-dessous).
// - fields : champs visibles, dans l'ordre du DOM (les autres sont masqués)
// - idPh   : placeholder de #authEmail -- 'identifier' (pseudo OU email) sauf à l'inscription qui
//            exige un VRAI email (on ne peut pas créer de compte à partir d'un pseudo seul)
// - submit : clé i18n du bouton principal + handler
const AUTH_MODES = {
  signin:   { fields:['authEmail','authPass'],              idPh:'authIdentifierPh', submitKey:'btnSignIn',       run:() => doSignIn() },
  signup:   { fields:['authEmail','authPseudo','authPass'], idPh:'authEmailPh',      submitKey:'btnSignUp',       run:() => doSignUp() },
  forgot:   { fields:['authEmail'],                         idPh:'authIdentifierPh', submitKey:'btnForgotSubmit', run:() => doForgotPassword() },
  magic:    { fields:['authEmail'],                         idPh:'authIdentifierPh', submitKey:'btnMagicSubmit',  run:() => doMagicLink() },
  recovery: { fields:['authPass'],                          idPh:'authIdentifierPh', submitKey:'btnSaveNewPass',  run:() => doSaveNewPassword() },
};
let authMode = 'choice';
/** @param {string} mode - 'choice' | clé de AUTH_MODES. Ouvre l'écran d'auth sur cette intention : 'choice' n'affiche AUCUN champ (juste les intentions + providers), les autres n'ouvrent que leurs propres champs. Seule fonction autorisée à afficher/masquer les champs d'auth. */
function setAuthMode(mode) {
  authMode = AUTH_MODES[mode] ? mode : 'choice';
  const cfg = AUTH_MODES[authMode];
  const choice = $a('authChoice'), form = $a('authForm');
  if (choice) choice.classList.toggle('hidden', authMode !== 'choice');
  if (form) form.classList.toggle('hidden', authMode === 'choice');
  authShow(''); // repart d'un écran propre : pas d'erreur du mode précédent qui traîne
  if (authMode === 'choice') { renderLastUsedBadge(); return; }
  ['authEmail','authPseudo','authPass'].forEach(id => {
    const el = $a(id); if (!el) return;
    const on = cfg.fields.includes(id);
    el.style.display = on ? '' : 'none';
    if (on) el.value = ''; // jamais de valeur héritée d'un autre flux (ex: mdp saisi puis retour)
  });
  const email = $a('authEmail');
  if (email) email.placeholder = (I18N[cfg.idPh] && I18N[cfg.idPh][LANG]) || email.placeholder;
  // mot de passe : "nouveau" en création/récupération, "courant" à la connexion (autofill correct)
  const pass = $a('authPass');
  if (pass) {
    pass.autocomplete = (authMode === 'signin') ? 'current-password' : 'new-password';
    pass.placeholder = (authMode === 'recovery')
      ? _authT('set_new_password')
      : ((I18N.authPassPh && I18N.authPassPh[LANG]) || pass.placeholder);
  }
  const submit = $a('btnAuthSubmit');
  if (submit) {
    submit.textContent = (I18N[cfg.submitKey] && I18N[cfg.submitKey][LANG]) || submit.textContent;
    submit.setAttribute('data-i18n', cfg.submitKey); // suit le slider FR/EN comme tout le reste
  }
  // le retour n'a pas de sens en récupération (session de reset active, pas d'autre flux possible)
  const back = $a('btnAuthBack'); if (back) back.style.display = (authMode === 'recovery') ? 'none' : '';
  const first = $a(cfg.fields[0]); if (first) try { first.focus(); } catch (e) {}
}
function showAuthOverlay(show) {
  $a('authOverlay').classList.toggle('hidden', !show);
  // rouvre TOUJOURS sur l'écran de choix (sauf récupération de mot de passe, pilotée à part) :
  // sinon on retomberait sur les champs du flux précédent, à contre-emploi du "aucun champ".
  if (show) { if (!inPasswordRecovery) setAuthMode('choice'); renderLastUsedBadge(); }
  // Croix de fermeture CONDITIONNELLE (2026-07-22) : uniquement quand une session existe déjà,
  // c.-à-d. un invité qui a ouvert cet écran volontairement ("Lier un compte" ou le bandeau de fin
  // de vie du mode invité) et qui change d'avis -- sa partie tourne derrière, il doit pouvoir y
  // revenir. Sans elle, un simple clic sur le bandeau (en haut, cliquable, non masquable) coupait
  // l'invité de son propre jeu, sans autre issue que créer un compte ou recharger la page.
  // Sans session, l'écran reste un mur sans échappatoire : c'est la raison du retrait du
  // 2026-07-16 (fermer laissait le joueur devant un jeu vide sans retour possible), et elle reste
  // valable. Jamais pendant une récupération de mot de passe : la session existe, mais le joueur
  // DOIT aller au bout du choix de son nouveau mot de passe.
  const close = $a('closeAuth');
  if (close) close.classList.toggle('hidden', !(show && currentUser && !inPasswordRecovery));
}
/** Affiche/masque la barre utilisateur et ses boutons (lier compte/déconnexion/admin) selon l'état de connexion. */
function updateUserBar() {
  $a('userBar').classList.toggle('show', !!currentUser);
  $a('userEmail').textContent = ''; // email retiré de l'affichage (demande du 2026-07-04)
  $a('btnLinkAccount').style.display = isGuest() ? '' : 'none';
  showGuestSunsetBannerIfGuest(); // bandeau de fin de vie du mode invité (à retirer le GUEST_SUNSET_DATE)
  // 2026-07-13 : #btnLogout/#adminBox (sidebar) retirés, doublons du header -- #btnLogoutTopbar/
  // #btnAdminTopbar sont désormais les SEULS éléments à afficher/masquer.
  $a('btnLogoutTopbar').style.display = isGuest() ? 'none' : '';
  const adminTopbarBtn = $a('btnAdminTopbar'); if (adminTopbarBtn) adminTopbarBtn.style.display = isAdmin() ? '' : 'none';
  // carte Admin (2026-07-13, regroupe btnAdminMaxEnh/btnAdminResetEnh/adminEnhStepRow/adminTierRow,
  // auparavant 4 toggles séparés dans la carte Inventaire) -- un seul toggle sur la carte entière,
  // via une CLASSE (pas l'inline style : card-layout.js réinitialise style="" de chaque carte à
  // chaque rendu, un inline display:none se ferait écraser à la prochaine réorganisation).
  const adminCard = $a('adminCard'); if (adminCard) adminCard.classList.toggle('isAdminVisible', isAdmin());
  // UUID copiable (utile pour l'ajout de modérateurs) — affiché pour tout compte connecté
  const uuidRow = $a('uuidRow');
  if (uuidRow) uuidRow.style.display = currentUser ? 'flex' : 'none';
  updatePseudoDisplay();
  if (typeof updateChatInputVisibility === 'function') { updateChatInputVisibility(); fetchChatMessages(); }
}
// affiche le pseudo (ou "🎭 Invité") à côté du tag DÉMO — l'email n'est plus jamais affiché
/** Affiche le pseudo (ou "Invité") à côté du tag DÉMO — l'email n'est jamais affiché. */
function updatePseudoDisplay() {
  const el = $a('userPseudo');
  if (!el) return;
  if (isGuest()) el.textContent = i18next.t('backend:backend.auth.guest_badge');
  else el.textContent = (currentUser && myPseudo) ? myPseudo : '';
  // raccourci header (2026-07-13) : même texte, à côté de l'icône compte du header
  const topbarEl = $a('userPseudoTopbar');
  if (topbarEl) topbarEl.textContent = el.textContent;
}

// upgrade d'une session invité en compte réel (garde le même user_id → la sauvegarde suit),
// ou création classique si jamais aucune session n'existe encore
// clé locale : mémorise le pseudo choisi à la création de compte le temps de confirmer l'email
// (aucune session active à ce moment-là pour appeler set_pseudo tout de suite) -- appliqué au
// prochain onAuthed() réussi, voir refreshMyPseudo()
const PENDING_PSEUDO_KEY = 'velia-idle-pending-pseudo';
// préfixe de namespace construit via une constante (pas de littéral dans le t()) pour ne pas être
// flaggé à tort par scripts/check-missing-translations.js -- même convention que COMPANIONS_NS_PREFIX.
const _AUTH_NS = 'backend:' + 'backend.auth.';
const _authT = (k, o) => i18next.t(_AUTH_NS + k, o);
// Connexion / réinitialisation par pseudo OU email SANS jamais exposer l'email au client
// (2026-07-16, version "zéro fuite") : tout passe par l'Edge Function auth-by-identifier
// (verify_jwt=false, résout pseudo->email côté serveur avec service_role, voir
// supabase/functions/auth-by-identifier/index.ts). Le client ne reçoit jamais d'email en clair.
/** Crée un compte email/mot de passe (email + pseudo + mot de passe TOUS requis), ou upgrade la session invité courante en compte réel (garde le même user_id, la sauvegarde suit). Mémorise le pseudo choisi (PENDING_PSEUDO_KEY) le temps de confirmer l'email. */
async function doSignUp() {
  if (!sb) { authShow(_authT('err_config'), true); return; }
  const email = $a('authEmail').value.trim(), pass = $a('authPass').value;
  const pseudo = $a('authPseudo').value.trim();
  // inscription = les 3 infos requises (2026-07-16, demande explicite)
  if (!email || pass.length < 8 || !pseudo) { authShow(_authT('err_signup_fields'), true); return; }
  if (!email.includes('@')) { authShow(_authT('err_signup_needs_email'), true); return; }
  authShow(_authT('creating_account'));
  try { localStorage.setItem(PENDING_PSEUDO_KEY, pseudo); } catch(e) {}
  if (isGuest()) {
    // sans emailRedirectTo (2026-07-10, bug trouvé en vérification : "verifie que les redirection
    // vers le jeu se font bien après inscription"), le lien de confirmation d'email utilisait le
    // "Site URL" par défaut configuré côté dashboard Supabase au lieu de la page réellement visitée
    // — source probable de l'erreur 404 signalée après inscription si ce réglage était périmé.
    const { data, error } = await sb.auth.updateUser({ email, password: pass }, { emailRedirectTo: location.href });
    if (error) { authShow(error.message, true); return; }
    onAuthed(data.user);
    authShow(_authT('account_linked'));
    return;
  }
  const { data, error } = await sb.auth.signUp({ email, password: pass, options: { emailRedirectTo: location.href } });
  if (error) { authShow(error.message, true); return; }
  if (data.session) { onAuthed(data.session.user); }
  else authShow(_authT('account_created_confirm'));
}
/** Connexion par pseudo OU email + mot de passe, via l'Edge Function (email jamais exposé). */
async function doSignIn() {
  if (!sb) { authShow(_authT('err_config'), true); return; }
  const identifier = $a('authEmail').value.trim(), pass = $a('authPass').value;
  if (!identifier || !pass) { authShow(_authT('err_login_fields'), true); return; }
  authShow(_authT('signing_in'));
  let res;
  try { res = await sb.functions.invoke('auth-by-identifier', { body: { action: 'login', identifier, password: pass } }); }
  catch (e) { authShow(_authT('err_invalid_credentials'), true); return; }
  const data = res && res.data;
  if (data && data.error === 'rate_limited') { authShow(_authT('err_rate_limited'), true); return; }
  if (!data || data.error || !data.access_token) { authShow(_authT('err_invalid_credentials'), true); return; }
  // pose la session à partir des tokens ; SIGNED_IN (onAuthStateChange) déclenchera onAuthed()
  const { error } = await sb.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
  if (error) { authShow(error.message, true); return; }
}
// réinitialisation de mot de passe (identifiant = pseudo OU email) via l'Edge Function : l'email
// n'est jamais renvoyé au client, et la réponse est toujours "envoyé" (ne révèle pas l'existence).
/** Envoie un email de réinitialisation de mot de passe (identifiant = pseudo OU email). */
async function doForgotPassword() {
  if (!sb) { authShow(_authT('err_config'), true); return; }
  const identifier = $a('authEmail').value.trim();
  if (!identifier) { authShow(_authT('email_first'), true); return; }
  authShow(_authT('sending'));
  try { await sb.functions.invoke('auth-by-identifier', { body: { action: 'reset', identifier, redirect_to: location.href } }); }
  catch (e) { /* on affiche quand même le message générique ci-dessous (ne révèle pas l'existence) */ }
  authShow(_authT('reset_email_sent'));
}
// Lien magique (2026-07-22, demande explicite : "magic link = mail ou pseudo") : connexion sans
// mot de passe. Même Edge Function que login/reset -- la résolution pseudo -> email reste côté
// serveur (l'email n'est JAMAIS renvoyé au client) et la réponse est toujours générique, pour ne
// pas transformer ce flux en oracle "ce pseudo existe-t-il ?". Ne crée jamais de compte
// (create_user:false côté fonction) : un lien magique sur un pseudo inconnu ne doit pas inscrire.
/** Envoie un lien de connexion sans mot de passe (identifiant = pseudo OU email). */
async function doMagicLink() {
  if (!sb) { authShow(_authT('err_config'), true); return; }
  const identifier = $a('authEmail').value.trim();
  if (!identifier) { authShow(_authT('email_first'), true); return; }
  authShow(_authT('sending'));
  try { await sb.functions.invoke('auth-by-identifier', { body: { action: 'magic', identifier, redirect_to: location.href } }); }
  catch (e) { /* message générique quand même : ne révèle pas l'existence du compte */ }
  authShow(_authT('magic_link_sent'));
}
// 2e moitié du flux "mot de passe oublié" (2026-07-16) : après le clic sur le lien du mail, on
// affiche l'écran de connexion en mode "nouveau mot de passe" -- seul le champ mot de passe reste,
// et le bouton principal enregistre le nouveau mot de passe (sb.auth.updateUser) avant de connecter.
let inPasswordRecovery = false;
function showPasswordRecoveryUI() {
  showAuthOverlay(true);
  // 'recovery' est un mode comme les autres depuis la refonte à modes (2026-07-22) : plus besoin de
  // masquer 7 ids à la main ici, AUTH_MODES.recovery décrit déjà "seul le champ mot de passe".
  setAuthMode('recovery');
  authShow(_authT('set_new_password'));
  document.querySelectorAll('.lastUsedBadge').forEach(b => b.remove());
}
/** Enregistre le nouveau mot de passe (session de récupération active) puis connecte le joueur. */
async function doSaveNewPassword() {
  if (!sb) { authShow(_authT('err_config'), true); return; }
  const pass = $a('authPass').value;
  if (pass.length < 8) { authShow(_authT('err_signup_fields'), true); return; }
  authShow(_authT('sending'));
  const { data, error } = await sb.auth.updateUser({ password: pass });
  if (error) { authShow(error.message, true); return; }
  inPasswordRecovery = false;
  authShow(_authT('password_updated'));
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} // retire #type=recovery
  if (data && data.user) onAuthed(data.user);
}
/** Déconnecte puis revient à l'écran de connexion sur un état vierge (voir le reload ci-dessous). */
async function doLogout() {
  if (sb) await sb.auth.signOut();
  currentUser = null;
  saveReady = false; // stoppe la simulation tout de suite (voir la garde dans advanceSim)
  // Recharge la page plutôt que de seulement réafficher l'écran de connexion (2026-07-22, trouvé
  // en corrigeant "on arrive avec un lvl déjà établi") : S est un `const` mutable jamais remis à
  // zéro, et loadCloudSave() n'appelle applySaveState() QUE si une sauvegarde EXISTE. Sans ce
  // rechargement, créer un NOUVEAU compte juste après une déconnexion faisait hériter le compte
  // neuf de toute la progression du précédent -- rien ne venait écraser S. Le reload garantit un
  // état vierge sans réinitialiser S champ par champ (~150 clés), et l'écran de connexion revient
  // de toute façon au démarrage via startGuestOrShowAuth() : comportement identique pour le joueur.
  if (sb) { location.reload(); return; }
  await startGuestOrShowAuth(); // mode local sans Supabase : pas de reload possible/utile
}

// connexion (ou liaison, si déjà invité/connecté) via Discord — demande le scope
// guilds.join pour pouvoir ajouter automatiquement le joueur au serveur Discord ensuite
/** Connexion/liaison via Discord OAuth (scope guilds.join pour l'ajout auto au serveur communautaire). */
async function doSignInDiscord() {
  if (!sb) { authShow('Supabase non configuré — voir SUPABASE_URL en haut du script.', true); return; }
  await sb.auth.signInWithOAuth({
    provider: 'discord',
    options: { scopes: 'identify guilds.join', redirectTo: location.href },
  });
}
// lie Discord à un compte email déjà existant (depuis le panneau "Mon compte"), sans
// perdre la session courante — nécessite "Manual Linking" activé côté Supabase
/** Lie Discord à un compte déjà existant sans perdre la session courante (nécessite Manual Linking côté Supabase). */
async function linkDiscordAccount() {
  if (!sb || !currentUser) return;
  const { error } = await sb.auth.linkIdentity({
    provider: 'discord',
    options: { scopes: 'identify guilds.join', redirectTo: location.href },
  });
  if (error) alert('Erreur : ' + error.message);
}

// connexion via Google/GitHub (2026-07-20, demande explicite : "ajoute inscription google,
// github") — même pattern que Discord ci-dessus, sans scope additionnel (pas de bot à rejoindre
// pour ces deux-là). ⚠️ Ces deux providers doivent être activés avec un Client ID/Secret OAuth
// côté Dashboard Supabase (Authentication > Providers) avant de fonctionner — action externe,
// impossible à faire depuis ce fichier.
/** Connexion via Google OAuth. */
async function doSignInGoogle() {
  if (!sb) { authShow('Supabase non configuré — voir SUPABASE_URL en haut du script.', true); return; }
  await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href } });
}
/** Connexion via GitHub OAuth. */
async function doSignInGithub() {
  if (!sb) { authShow('Supabase non configuré — voir SUPABASE_URL en haut du script.', true); return; }
  await sb.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: location.href } });
}
// Twitter/X (2026-07-20, demande explicite : "peux tu ajouter twitter aussi") — même pattern,
// 'twitter' est le nom de provider attendu par Supabase Auth (OAuth 2.0, malgré le rebranding "X").
/** Connexion via Twitter/X OAuth (provider 'twitter' côté Supabase Auth). */
async function doSignInTwitter() {
  if (!sb) { authShow('Supabase non configuré — voir SUPABASE_URL en haut du script.', true); return; }
  await sb.auth.signInWithOAuth({ provider: 'twitter', options: { redirectTo: location.href } });
}
// lie Google/GitHub/Twitter à un compte déjà existant (panneau "Mon compte") — même pattern que
// linkDiscordAccount ci-dessus.
/** Lie Google à un compte déjà existant. */
async function linkGoogleAccount() {
  if (!sb || !currentUser) return;
  const { error } = await sb.auth.linkIdentity({ provider: 'google', options: { redirectTo: location.href } });
  if (error) alert('Erreur : ' + error.message);
}
/** Lie GitHub à un compte déjà existant. */
async function linkGithubAccount() {
  if (!sb || !currentUser) return;
  const { error } = await sb.auth.linkIdentity({ provider: 'github', options: { redirectTo: location.href } });
  if (error) alert('Erreur : ' + error.message);
}
/** Lie Twitter/X à un compte déjà existant. */
async function linkTwitterAccount() {
  if (!sb || !currentUser) return;
  const { error } = await sb.auth.linkIdentity({ provider: 'twitter', options: { redirectTo: location.href } });
  if (error) alert('Erreur : ' + error.message);
}
/** @param {object} user - utilisateur Supabase. @param {string} provider. @returns {?object} identité liée à ce provider, null si absente. */
function providerIdentity(user, provider) {
  return user?.identities?.find(i => i.provider === provider) || null;
}

/** @param {object} user - utilisateur Supabase. @returns {?object} identité Discord liée, null si absente. */
function discordIdentity(user) {
  return user?.identities?.find(i => i.provider === 'discord') || null;
}
/** @param {object} user - utilisateur Supabase. @returns {?string} pseudo Discord (global_name/full_name/name/user_name, dans cet ordre), null si pas lié. */
function discordUsername(user) {
  const id = discordIdentity(user);
  const d = id?.identity_data || {};
  return d.custom_claims?.global_name || d.full_name || d.name || d.user_name || null;
}

// ajoute automatiquement le joueur au serveur Discord communautaire via le bot, en
// utilisant le token OAuth (scope guilds.join) obtenu à l'instant de la connexion —
// ce token n'est disponible qu'à ce moment précis, jamais après un rechargement de page
/** @param {string} providerToken - token OAuth Discord (scope guilds.join), disponible seulement à l'instant de la connexion. @param {object} user - utilisateur Supabase. Ajoute le joueur au serveur Discord communautaire via le bot. Échec silencieux (rejoindre reste possible via le bouton Discord du menu). */
async function joinDiscordGuild(providerToken, user) {
  const id = discordIdentity(user);
  if (!providerToken || !id || !BOT_API_URL || BOT_API_URL.includes('TON-')) return;
  try {
    await fetch(BOT_API_URL + '/join-guild', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': BOT_API_SECRET },
      body: JSON.stringify({ discordUserId: id.id, accessToken: providerToken }),
    });
  } catch (e) { /* pas grave, le joueur peut toujours rejoindre via le bouton Discord du menu */ }
}
if (sb) {
  sb.auth.onAuthStateChange((event, session) => {
    // flux "mot de passe oublié" complet (2026-07-16) : quand le joueur clique le lien du mail de
    // réinitialisation, Supabase revient sur la page et émet PASSWORD_RECOVERY (une session
    // temporaire est établie -> SIGNED_IN peut aussi se déclencher). Sans ce garde, on le
    // connectait direct sans jamais lui demander de nouveau mot de passe. On affiche donc l'écran
    // "choisis un nouveau mot de passe" et on BLOQUE le onAuthed automatique tant qu'il n'a pas
    // enregistré (inPasswordRecovery). Détection aussi via le hash de l'URL (type=recovery) au cas
    // où l'event arrive avant l'abonnement.
    if (event === 'PASSWORD_RECOVERY' || (typeof location !== 'undefined' && location.hash.includes('type=recovery'))) {
      inPasswordRecovery = true;
      showPasswordRecoveryUI();
      return;
    }
    if (inPasswordRecovery) return; // ne pas connecter automatiquement pendant la récupération
    if (event === 'SIGNED_IN' && session?.provider_token) {
      joinDiscordGuild(session.provider_token, session.user);
    }
    // après une redirection OAuth (Discord) ou un lien de confirmation d'email, le SDK peut
    // établir la session APRÈS notre vérification initiale (sb.auth.getSession() au chargement,
    // voir plus bas) -- sans ce relais, l'écran de connexion restait affiché malgré une connexion
    // réussie (bug remonté en jeu le 2026-07-05 : "on se connecte mais la page reste au premier plan").
    // Exclu les sessions anonymes : signInAnonymously() déclenche aussi 'SIGNED_IN', mais ce cas
    // est déjà géré de façon synchrone par startGuestOrShowAuth() -- appeler onAuthed() une 2e fois
    // en parallèle dédoublait certains effets (ex: +80 silver de bienvenue compté deux fois)
    if (event === 'SIGNED_IN' && session?.user && !session.user.is_anonymous
        && (!currentUser || currentUser.id !== session.user.id)) {
      onAuthed(session.user);
    }
  });
}

let onAuthedRunning = false;
/** @param {object} user - utilisateur Supabase authentifié. Point d'entrée post-connexion, protégé contre un double appel concurrent (course entre le flux normal et le relais onAuthStateChange). Délègue à onAuthedInner(). */
async function onAuthed(user) {
  if (onAuthedRunning) return; // évite un double appel concurrent (course entre le flux normal et le relais onAuthStateChange ci-dessus)
  onAuthedRunning = true;
  try {
    await onAuthedInner(user);
  } finally {
    onAuthedRunning = false;
  }
}
/**
 * Traite une connexion réussie : vérifie le bannissement (déconnecte si banni), initialise l'UI,
 * réclame la session (claimPlayerSession, évince toute autre session active), charge pseudo/rôles/
 * overrides loot/sauvegarde cloud, démarre l'autosave/heartbeat/compteurs, affiche un rappel
 * proactif de connexion pour un invité.
 * @param {object} user - utilisateur Supabase authentifié.
 */
async function onAuthedInner(user) {
  currentUser = user;
  // mémorise la méthode de connexion réellement utilisée (badge "Dernière fois" au prochain écran)
  rememberLastLoginMethod((user && user.app_metadata && user.app_metadata.provider) || 'email');
  // check de bannissement (2026-07-18) : bloque l'accès avant tout autre effet de la connexion
  // (chargement de sauvegarde, présence en ligne...) si le compte est banni.
  if (!isGuest()) {
    try {
      const { data: banStatus } = await sb.rpc('get_my_ban_status');
      const row = Array.isArray(banStatus) ? banStatus[0] : banStatus;
      if (isBanned(row)) {
        const until = new Date(row.banned_until).toLocaleString(i18next.t('backend:backend.common.date_locale'));
        const reason = row.ban_reason || i18next.t('backend:backend.auth.ban_reason_unspecified');
        authShow(i18next.t('backend:backend.auth.ban_suspended', { until, reason }), true);
        await sb.auth.signOut();
        currentUser = null;
        showAuthOverlay(true);
        return;
      }
    } catch (e) {}
  }
  showAuthOverlay(false);
  updateUserBar();
  claimPlayerSession(); // fire-and-forget : cette session prend la main, évince toute autre session active
  if (isOffline) showOfflineBanner();
  await refreshMyPseudo();
  refreshMyModStatus();
  refreshMyTesterStatus();
  refreshLiveLootRates(); // charge un éventuel override admin des taux de loot (game_config)
  await loadCloudSave();
  if (typeof updateLoginStreak === 'function') updateLoginStreak(); // S.lastActiveDay/S.loginStreak (game-core.js) — APRÈS le chargement de la sauvegarde, pas avant
  startAutoCloudSave();
  heartbeatPresence();
  // P1 (2026-07-22) : le snapshot ramène online + zones + admin + velia en une requête -- avant, ce
  // n'était que refreshOnlineCounter() ici, les 3 autres attendaient leur premier tick (20 s).
  // L'affichage initial est donc plus complet ET moins coûteux qu'avant.
  refreshPresenceSnapshot();
  refreshLiveBoss(); // affiche tout de suite un éventuel boss global déjà en cours
  // rappel proactif pour un invité (2026-07-10, demande explicite : "verifie que l'invité a bien
  // des notifications qui l'invitent à se connecter pour ne pas perdre son avancée") -- jusqu'ici
  // le seul rappel était RÉACTIF (en tentant le Marché/Classement/parrainage) : rien n'avertissait
  // un invité qui ne touche jamais à ces fonctionnalités, alors qu'une session anonyme est perdue
  // dès qu'il change d'appareil ou vide son navigateur (voir doc Supabase Anonymous Sign-Ins).
  // Poussée dans le centre de notifications (🔔), pas un toast intrusif — une seule fois par
  // session, avec un léger délai pour ne pas se mélanger aux autres popups de démarrage.
  if (isGuest()) {
    setTimeout(() => {
      pushNotif('🎭', i18next.t('backend:backend.auth.guest_mode_title'),
        i18next.t('backend:backend.auth.guest_mode_body'),
        'info');
    }, 3000);
  }
}

// détermine le pseudo effectif : pseudo choisi > pseudo Discord > partie locale de l'email
/** Détermine le pseudo effectif (choisi > Discord > partie locale de l'email), applique un pseudo en attente (PENDING_PSEUDO_KEY) posé par doSignUp() faute de session active à ce moment. */
async function refreshMyPseudo() {
  myPseudo = null;
  if (!sb || !currentUser || isGuest()) return;
  try {
    const { data } = await sb.from('profiles').select('pseudo').eq('user_id', currentUser.id).maybeSingle();
    myPseudo = data?.pseudo || discordUsername(currentUser) || (currentUser.email || '?').split('@')[0];
  } catch (e) { myPseudo = discordUsername(currentUser) || (currentUser.email || '?').split('@')[0]; }
  // applique le pseudo choisi à la création de compte (demande explicite du 2026-07-05), en
  // attente depuis doSignUp() faute de session active à ce moment-là -- appliqué une seule fois
  let pending = null;
  try { pending = localStorage.getItem(PENDING_PSEUDO_KEY); } catch(e) {}
  if (pending) {
    try { localStorage.removeItem(PENDING_PSEUDO_KEY); } catch(e) {}
    try {
      const { error } = await sb.rpc('set_pseudo', { p_pseudo: pending });
      if (!error) myPseudo = pending;
    } catch (e) {}
  }
  updatePseudoDisplay();
}

// point d'entrée unique au chargement (et après déconnexion) — DÉSACTIVÉ le 2026-07-20 (demande
// explicite : "Désactive les invité") : n'ouvre plus de session anonyme automatique pour un
// nouveau visiteur, affiche directement le formulaire de connexion/inscription. Le nom de la
// fonction reste inchangé (appelée depuis doLogout()/l'IIFE de démarrage plus bas) pour limiter le
// diff — seul son comportement change. Les sessions invité créées AVANT ce changement continuent
// de fonctionner normalement (isGuest() reste vrai pour elles, rien n'est supprimé côté serveur) ;
// seule la création de NOUVELLES sessions anonymes est coupée.
/** Affiche l'écran de connexion (les sessions invité automatiques sont désactivées depuis le 2026-07-20 ; les sessions invité déjà créées restent fonctionnelles). No-op si Supabase pas configuré. */
async function startGuestOrShowAuth() {
  if (!sb) { showAuthOverlay(false); updateUserBar(); return; } // Supabase pas configuré → mode local, inchangé
  showAuthOverlay(true);
  authShow('');
}

let tutorialAutoShown = false; // évite de relancer le tuto auto plusieurs fois si loadCloudSave est rappelé
/** Charge la sauvegarde (cache local offline en priorité si hors-ligne, sinon Supabase game_saves), lance le tutoriel pour un nouveau personnage et marque les patch notes antérieures comme déjà lues. */
// Cadeau de bienvenue (2026-07-22) : était un `setTimeout(() => addSilver(80,'welcome'), 1200)` au
// chargement de la page (render.js) -- donc crédité à tout VISITEUR, avant même qu'il ait un compte
// ("pas de jeu qui tourne en arrière alors qu'on n'a pas créé de compte"). Pire : pour un joueur
// existant, il n'était neutralisé que par le hasard du timing -- applySaveState() l'écrasait s'il
// arrivait après les 1,2 s, mais sur un chargement rapide (cache/réseau court) il pouvait passer
// APRÈS et offrir 80 silver à CHAQUE connexion. Désormais accordé une seule fois, à la création du
// personnage (branche "aucune sauvegarde cloud" de loadCloudSave) ou en mode local sans Supabase.
const WELCOME_SILVER = 80;
let welcomeSilverGranted = false;
/** Accorde le cadeau de bienvenue une seule fois par session (garde-fou : onAuthed a déjà été appelé 2x par le passé, ce qui doublait ce gain — voir onAuthStateChange). */
function grantWelcomeSilver() {
  if (welcomeSilverGranted) return;
  welcomeSilverGranted = true;
  addSilver(WELCOME_SILVER, 'welcome');
  if (typeof hud === 'function') hud();
}
async function loadCloudSave() {
  if (!sb || !currentUser) return;
  $a('saveStatus').textContent = 'Chargement...';
  // hors ligne dès le chargement (2026-07-10) : si une sauvegarde locale existe (rechargement de
  // page pendant une coupure réseau, après avoir déjà joué en ligne au moins une fois sur cet
  // appareil), on la charge directement plutôt que d'attendre l'échec réseau du fetch Supabase.
  if (isOffline) {
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(offlineSaveKey())); } catch(e) {}
    if (cached && cached.save_data && Object.keys(cached.save_data).length) {
      applySaveState(cached.save_data);
      $a('saveStatus').textContent = '🔌 Sauvegarde locale chargée (hors ligne)';
      showOfflineBanner();
      saveReady = true;
      return;
    }
  }
  // last_server_credit_at (2026-07-14, Phase 2 du rattrapage hors-ligne -- voir
  // supabase/migrations/20260722120000_offline_progress_hourly_cron.sql et le commentaire au-dessus
  // de computeOfflineElapsedHours(), core/game-core.js) : colonne séparée de save_data, écrite par
  // le cron serveur horaire, jamais par le client. Attachée à l'objet transmis à applySaveState()
  // (pas dans save_data lui-même, qui reste tel quel) pour que Phase 1 sache jusqu'où le serveur a
  // déjà crédité et ne recompte jamais ce même intervalle.
  const { data, error } = await sb.from('game_saves').select('save_data, last_server_credit_at').eq('user_id', currentUser.id).single();
  // serverRates (2026-07-16, V455) : taux ÉQUITABLES calculés côté serveur (meilleure heure PLEINE,
  // colonnes player_stats possédées par le serveur depuis V454 -- voir compute_player_hour_rates(),
  // supabase/migrations/20260722150000). Attachés à l'objet transmis à applySaveState() (comme
  // lastServerCreditAt ci-dessus) pour que le rattrapage hors-ligne Phase 1
  // (computeOfflineCatchupSilver/Loot, core/game-core.js) paie au taux serveur plutôt qu'au record
  // local S.bestSilverPerHour/bestKpm (remis à 0 par V454, et historiquement gonflé -- pics de
  // 3 min extrapolés). Best-effort : si cette lecture échoue (réseau), serverRates reste absent et
  // Phase 1 retombe sur le record local comme avant -- jamais bloquant.
  let serverRates = null;
  try {
    const { data: ps } = await sb.from('player_stats').select('silver_per_hour, best_kpm').eq('user_id', currentUser.id).single();
    if (ps) serverRates = { silverPerHour: Number(ps.silver_per_hour) || 0, kpm: Number(ps.best_kpm) || 0 };
  } catch (e) { /* lecture best-effort, repli sur le record local */ }
  if (data && data.save_data && Object.keys(data.save_data).length) {
    applySaveState({ ...data.save_data, lastServerCreditAt: data.last_server_credit_at, serverRates });
    $a('saveStatus').textContent = 'Sauvegarde chargée ✓';
  } else {
    $a('saveStatus').textContent = 'Nouveau personnage';
    // aucune sauvegarde cloud trouvée = personnage tout juste créé : on l'accueille à Velia et on
    // lance le tutoriel (petite pause pour laisser l'UI/le HUD finir de s'initialiser)
    grantWelcomeSilver(); // cadeau de bienvenue : ICI, et seulement ici (voir la fonction)
    if (!tutorialAutoShown) { tutorialAutoShown = true; setTimeout(startTutorial, 500); }
    // un nouveau joueur n'a pas à voir de notification sur les notes de version D'AVANT sa
    // création de compte (demande explicite du 2026-07-08) -- sans ça, unreadPatchCount()
    // comptait TOUT l'historique jamais publié (ex: "201 non lues"), un chiffre absurde pour
    // quelqu'un qui vient de commencer. On marque tout SAUF la toute dernière version comme déjà
    // lu : sa page de notes de version s'ouvre donc directement sur la dernière (1 seule pastille
    // NEW, en haut), pas besoin de scroller dans un historique qu'il n'a pas vécu.
    if (typeof PATCH_NOTES !== 'undefined' && PATCH_NOTES.length) {
      PATCH_NOTES.slice(1).forEach(p => readPatches.add(p.v));
      try { localStorage.setItem('velia-patch-read', JSON.stringify([...readPatches])); } catch(e) {}
      if (typeof updatePatchBadge === 'function') updatePatchBadge();
    }
  }
  setTimeout(() => { if ($a('saveStatus')) $a('saveStatus').textContent = ''; }, 3000);
  checkPendingNotice(); // annonce importante en attente (ex: reset de compte) — livrée une seule fois
  saveReady = true; // la vraie sauvegarde (ou l'absence confirmée de sauvegarde) est connue désormais
}

// ---------- mode hors ligne : fallback localStorage + resync au retour réseau ----------
// clé par currentUser.id (2026-07-10) : évite qu'une sauvegarde offline d'un compte fuite vers un
// autre compte sur un navigateur/appareil partagé.
/** @returns {string} clé localStorage de la sauvegarde hors-ligne, scopée par currentUser.id (évite qu'elle fuite vers un autre compte partageant l'appareil). */
function offlineSaveKey() { return 'velia-idle-offline-save-' + (currentUser ? currentUser.id : ''); }
/** Sauvegarde l'état courant dans localStorage (clé offlineSaveKey) et marque pendingOfflineSync pour un renvoi vers le cloud au retour réseau. */
function saveToLocalOfflineCache() {
  if (!currentUser) return;
  try { localStorage.setItem(offlineSaveKey(), JSON.stringify({ save_data: getSaveState(), savedAt: Date.now() })); } catch(e) {}
  pendingOfflineSync = true;
}
/** Supprime la sauvegarde hors-ligne locale (offlineSaveKey). */
function clearLocalOfflineCache() {
  if (!currentUser) return;
  try { localStorage.removeItem(offlineSaveKey()); } catch(e) {}
}
// pousse la dernière sauvegarde locale vers le cloud une fois le réseau revenu -- ne réécrit RIEN
// si aucune sauvegarde offline n'était en attente (pendingOfflineSync reste false par défaut).
/** Renvoie la dernière sauvegarde locale (offline) vers le cloud une fois le réseau revenu. No-op si aucune sauvegarde offline en attente. */
async function flushOfflineSaveIfNeeded() {
  if (!pendingOfflineSync || !sb || !currentUser) return;
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(offlineSaveKey())); } catch(e) {}
  if (!cached || !cached.save_data) { pendingOfflineSync = false; return; }
  const { error } = await sb.from('game_saves').upsert({ user_id: currentUser.id, save_data: cached.save_data });
  if (!error) { pendingOfflineSync = false; clearLocalOfflineCache(); }
}
// ============ DÉPRÉCIATION DU MODE INVITÉ — tout ce bloc est à supprimer le GUEST_SUNSET_DATE ============
// Constat du 2026-07-22 : plus AUCUN invité n'est créé depuis le 2026-07-10 (startGuestOrShowAuth
// n'appelle plus signInAnonymously) -- le mode invité est déjà mort côté création. Mais 127 sessions
// anonymes subsistent en base, dont 43 avec sauvegarde et UNE à 30 h de jeu / niveau 32 / 10,3M
// silver (plus aucune activité depuis le 2026-07-11).
//
// Ces comptes n'ont ni email ni pseudo : impossible de prévenir qui que ce soit. Leur session vit
// dans le localStorage de LEUR navigateur, donc la seule fenêtre pour les avertir est leur retour
// sur le jeu -- d'où ce bandeau. Sans lui, retirer le code invité leur supprimerait silencieusement
// leur unique porte de sortie (bouton "Lier un compte" + conversion invité->compte réel, doSignUp).
//
// À FAIRE À CETTE DATE : supprimer tout le code invité (isGuest, btnLinkAccount, la branche
// isGuest() de doSignUp, les clés backend.auth.guest_*, ce bandeau + son HTML/CSS) puis purger les
// comptes anonymes restants. Voir l'issue de suivi GitHub.
const GUEST_SUNSET_DATE = '2026-08-15'; // 4 semaines de sursis à compter du 2026-07-17
/** Affiche le bandeau de dernière chance aux comptes invités (mode invité en fin de vie) — cliquer ouvre la liaison de compte. No-op pour un compte réel. */
function showGuestSunsetBannerIfGuest() {
  const el = $a('guestSunsetBanner');
  if (!el) return;
  el.classList.toggle('hidden', !isGuest());
  el.onclick = () => { const b = $a('btnLinkAccount'); if (b) b.click(); };
}
// ============ fin du bloc à supprimer ============
function showOfflineBanner() { const el = $a('offlineBanner'); if (el) el.classList.remove('hidden'); }
function hideOfflineBanner() { const el = $a('offlineBanner'); if (el) el.classList.add('hidden'); }
window.addEventListener('offline', () => { isOffline = true; showOfflineBanner(); });
window.addEventListener('online', () => { isOffline = false; hideOfflineBanner(); flushOfflineSaveIfNeeded(); });

// ---------- verrou multi-session : un seul onglet/navigateur/appareil actif par compte ----------
function showSessionLockOverlay() { const el = $a('sessionLockOverlay'); if (el) el.classList.remove('hidden'); }
function hideSessionLockOverlay() { const el = $a('sessionLockOverlay'); if (el) el.classList.add('hidden'); }
// vrai seulement après un claim_player_session() réussi (pas d'erreur réseau/auth) -- garde le
// verrou de checkPlayerSession() désarmé tant qu'on n'a pas nous-mêmes établi une vraie session
// serveur. Sans ça, check_player_session() renvoie `false` par sécurité dès que auth.uid() est
// NULL côté serveur (pas de vraie session Supabase active), et le client l'interprétait à tort
// comme "évincé par une autre session" -- bug trouvé via testFait dans tests/companions.spec.js
// (currentUser y est fabriqué localement, sans vrai JWT Supabase, voir signInForTest()).
let sessionClaimOk = false;
// prend la main sur ce compte (appelé à la connexion, et par le bouton "Reprendre ici" de
// sessionLockOverlay) -- toute AUTRE session active sur ce compte se fera évincer à son prochain
// checkPlayerSession() (20s max, même cadence que heartbeatPresence).
/** Réclame la session serveur pour cet onglet (RPC claim_player_session) — toute autre session active sur ce compte se fait évincer à son prochain checkPlayerSession(). Appelé à la connexion et par le bouton "Reprendre ici". */
async function claimPlayerSession() {
  if (!sb || !currentUser) return;
  try {
    const { error } = await sb.rpc('claim_player_session', { p_session_id: mySessionId });
    sessionClaimOk = !error;
  } catch(e) { sessionClaimOk = false; }
  sessionLocked = false;
  hideSessionLockOverlay();
}
// vérifie que CETTE session est toujours celle active côté serveur -- si une autre session a pris
// le relais depuis (claim_player_session appelé ailleurs), passe en pause locale sans jamais
// forcer de déconnexion (le joueur peut reprendre la main via le bouton, pas de perte de contexte).
/** Vérifie que cette session est toujours celle active côté serveur (RPC check_player_session) ; affiche/masque l'overlay de verrou en conséquence, jamais de déconnexion forcée. No-op hors-ligne ou sans claim préalable réussi. */
async function checkPlayerSession() {
  if (!sb || !currentUser || isOffline || !sessionClaimOk) return; // pas de faux-positif pendant une coupure réseau, ou sans vrai claim préalable
  try {
    const { data, error } = await sb.rpc('check_player_session', { p_session_id: mySessionId });
    if (error) return;
    if (data === false && !sessionLocked) { sessionLocked = true; showSessionLockOverlay(); }
    else if (data === true && sessionLocked) { sessionLocked = false; hideSessionLockOverlay(); }
  } catch(e) {}
}
document.addEventListener('DOMContentLoaded', () => {
  const btn = $a('sessionLockResumeBtn');
  if (btn) btn.onclick = claimPlayerSession;
});

/** Sauvegarde l'état courant vers Supabase (game_saves), bascule sur le cache local si hors-ligne ou en cas d'échec réseau. No-op si la session a été évincée (sessionLocked). */
async function saveToCloud() {
  if (!sb || !currentUser || sessionLocked) return; // une session évincée n'écrase jamais la sauvegarde de la session active
  if (isOffline) { saveToLocalOfflineCache(); $a('saveStatus').textContent = '🔌 hors ligne (local)'; setTimeout(() => { if ($a('saveStatus')) $a('saveStatus').textContent = ''; }, 2000); return; }
  const { error } = await sb.from('game_saves').upsert({ user_id: currentUser.id, save_data: getSaveState() });
  if (error) { saveToLocalOfflineCache(); } else { pendingOfflineSync = false; clearLocalOfflineCache(); }
  $a('saveStatus').textContent = error ? '✗ échec sauvegarde (local)' : '✓ sauvegardé';
  setTimeout(() => { if ($a('saveStatus')) $a('saveStatus').textContent = ''; }, 2000);
  if (!error) syncPlayerStats();
}

// ---------- classement : snapshot périodique des stats publiques dans player_stats ----------
/** Pousse les records À VIE du joueur (silver/GS/AP/DP/zone/trésors/loyalty/compendium) dans player_stats — jamais l'état courant/instantané, pour un classement qui ne régresse jamais. silver_per_hour/best_kpm (et leurs variantes _week) ne sont PLUS envoyés : colonnes calculées et possédées par le SERVEUR depuis V454. Réservé aux comptes vérifiés. */
async function syncPlayerStats() {
  if (!sb || !currentUser || isGuest()) return; // classement réservé aux comptes vérifiés
  // silver_per_hour / best_kpm / silver_per_hour_week / best_kpm_week : RETIRÉS du payload le
  // 2026-07-16 (V454, demande explicite : "revoir comment est calculé silver/h kpm et faire qqch
  // de mieux et juste pour tout le monde") -- ces colonnes sont désormais calculées CÔTÉ SERVEUR
  // par compute_player_hour_rates() (cron horaire pg_cron) depuis silver_ledger (gains 'loot') et
  // farm_events (qty de trash = kills, le trash droppant exactement 1× par kill) : la MÊME formule
  // "meilleure heure PLEINE" pour tout le monde, plus jamais un pic client de 3 min extrapolé. Un
  // trigger (protect_server_rate_columns) ignore de toute façon toute écriture client sur ces 4
  // colonnes -- même un vieux client jamais rechargé ne peut plus les pousser. Voir
  // supabase/migrations/20260722150000_player_hour_rates_fair_leaderboard.sql (+ 20260722150500).
  const best = bestFarmedItem();
  // total de morceaux du "Trésor de Velia" ramassés À VIE — sert au classement dédié "🗺️ Trésors"
  const treasureCount = treasureTotal(S);
  // colonnes silver/gearscore/ap/dp : envoient désormais des valeurs À VIE (S.silverEarned déjà
  // monotone, toutes sources cumulées ; S.bestGearscore/bestAp/bestDp voir hud() dans
  // core/game-core.js), pas l'état COURANT (2026-07-08, demande explicite : "Classement public :
  // meilleur uniquement pas en temps reel donc oublie la synchro, on veut juste le meilleur") --
  // S.silver (solde dépensable) redescend quand on dépense, GS()/apEff()/totalDP() redescendent si
  // on rééquipe un stuff inférieur (test, outil admin...) : plus aucune de ces 4 colonnes ne doit
  // pouvoir régresser d'une synchro à l'autre, même principe que best_kpm/best_zone_index déjà en
  // place. Pas besoin de sync "temps réel" pour un record qui ne fait que monter.
  try {
    await sb.from('player_stats').upsert({
      user_id: currentUser.id,
      display_name: myPseudo || (currentUser.email||'?').split('@')[0],
      silver: Math.round(S.silverEarned||0),
      gearscore: Math.round(S.bestGearscore||0),
      ap: Math.round((S.bestAp||0)*10)/10,
      dp: Math.round((S.bestDp||0)*10)/10,
      // estampille l'équilibrage sous lequel ces records à vie ont été calculés : le classement GS
      // écarte les lignes d'une version antérieure (record d'avant-nerf figé par un joueur parti
      // avant la migration de recalcul). Voir BALANCE_VERSION, core/game-core.js.
      balance_version: typeof BALANCE_VERSION === 'number' ? BALANCE_VERSION : 0,
      lvl: S.lvl,
      best_zone_index: S.maxZoneIdx,
      best_zone_name: ZONES[S.maxZoneIdx] ? ZONES[S.maxZoneIdx].name : '',
      playtime_sec: Math.round(S.playtimeSec),
      best_item_name: best ? best.name : '',
      best_item_count: best ? best.count : 0,
      treasure_count: treasureCount,
      loyalty: Math.round(S.loyalty||0),
      // % de complétion GLOBALE du Compendium -- zones+boss+PEN (2026-07-10, demande explicite :
      // "ajoute au panneau admin ce qui manque"), voir compendiumOverallPct() (core/game-core.js).
      // Jamais recalculé côté serveur : zones/boss/PEN ne font QUE monter (jamais de retrait), donc
      // pas besoin d'un record séparé comme best_kpm -- la valeur courante EST déjà monotone.
      compendium_pct: typeof compendiumOverallPct === 'function' ? compendiumOverallPct() : 0,
      updated_at: new Date().toISOString(),
    });
  } catch(e) { /* pas grave, prochaine synchro rattrapera */ }
}

// Panneau Admin (reset demo/quetes/comptes, screenshot joueur, analytics) -> voir admin-panel.js (charge APRES ce fichier, voir index.html)

// ---------- classement public (silver, gearscore, meilleure zone, silver/h, meilleur objet) ----------
// 2026-07-11 : panneau enrichi (podium/onglets/recherche/pagination/"Ma position") déplacé dans
// src/backend/leaderboard-panel.js (openLeaderboard2()) — même traitement que le Classement Public
// Compagnons, sur les mêmes 7 catégories déjà alimentées par syncPlayerStats() ci-dessus (records
// À VIE, jamais un instantané). wirePlayerNameLinks()/showPlayerGear() restent ici, réutilisés par
// le nouveau panneau (clic sur un pseudo -> stuff en lecture seule). L'ancien rankRows()/
// openLeaderboard() (retirés ici) n'avaient été QUE traduits via i18next par la branche i18n,
// jamais fonctionnellement conservés -- leaderboard-panel.js reste à traduire vers i18next dans un
// prochain passage (actuellement LANG==='fr' ternaire, voir CLAUDE.md §31 si applicable).
// clic sur un pseudo du classement : ouvre son stuff en lecture seule (demande explicite — voir
// get_player_gear côté serveur, n'expose QUE l'équipement, jamais le silver/inventaire complet)
/** Câble le clic sur un pseudo du classement pour ouvrir son stuff en lecture seule (showPlayerGear). */
function wirePlayerNameLinks() {
  $a('infoBody').querySelectorAll('.plNameLink').forEach(el => {
    el.onclick = e => { e.stopPropagation(); showPlayerGear(el.dataset.uid, el.dataset.name); };
  });
}
/** @param {?object} equip - équipement du joueur consulté (ou null). @param {string[]} ids - slots à afficher. @returns {string} HTML des emplacements de paperdoll en lecture seule. */
function readonlyPdSlotsHtml(equip, ids) {
  return ids.map(id => {
    const e = equip ? equip[id] : null;
    return `<div class="pdSlot ${e?'filled':'empty'}" title="${escapeHtml(SLOT_LABEL[id]||'')}${e ? ' — '+escapeHtml(e.name||'')+pdStatSuffix(e) : ' ('+i18next.t('backend:backend.gear.slot_empty')+')'}">${pdSlotInnerHtmlFor(id, e)}</div>`;
  }).join('');
}
// liste TEXTE (nom + PA/PD/PV) de chaque pièce équipée — demande explicite : voir le nom de
// l'objet et son PA/PD directement quand on regarde le stuff d'un autre joueur, pas juste au survol
/** @param {?object} equip - équipement du joueur consulté. @returns {string} table texte (nom + PA/PD/PV) de chaque pièce équipée, en lecture seule. */
function readonlyGearListHtml(equip) {
  const allSlots = [...PD_BOTTOM, ...PD_LEFT, ...PD_RIGHT];
  const rows = allSlots.map(id => {
    const e = equip ? equip[id] : null;
    if (!e) return '';
    return `<tr><td>${escapeHtml(SLOT_LABEL[id]||id)}</td><td>${escapeHtml(e.name||'?')}</td><td>${pdStatSuffix(e).replace(/^ \(|\)$/g,'') || '—'}</td></tr>`;
  }).filter(Boolean).join('');
  if (!rows) return `<div class="admEmpty">${i18next.t('backend:backend.gear.no_gear')}</div>`;
  return `<table class="admTable"><thead><tr><th>${i18next.t('backend:backend.gear.slot_header')}</th><th>${i18next.t('backend:backend.gear.item_header')}</th><th>PA/PD/PV</th></tr></thead><tbody>${rows}</tbody></table>`;
}
/** @param {string} userId @param {string} displayName. Ouvre le panneau info avec l'équipement en lecture seule d'un autre joueur (RPC get_player_gear, n'expose jamais le silver/inventaire complet). */
async function showPlayerGear(userId, displayName) {
  if (!sb) return;
  openInfo(i18next.t('backend:backend.gear.panel_title_prefix')+displayName,
    `<div class="admEmpty">${i18next.t('backend:backend.gear.loading')}</div>`);
  const { data, error } = await sb.rpc('get_player_gear', { p_user_id: userId });
  if (error) { $a('infoBody').innerHTML = `<div class="admEmpty">${escapeHtml(error.message)}</div>`; return; }
  // bouton "Copier UUID" réservé à l'admin — demande explicite du 2026-07-05
  const copyBtn = isAdmin() ? `<button id="btnCopyGearUuid" style="margin-bottom:8px">📋 ${i18next.t('backend:backend.gear.copy_uuid_button')}</button>` : '';
  // "Retour au classement" (2026-07-13, demande explicite : "ça ne revient pas au classement du
  // tout") -- showPlayerGear() n'est atteignable QUE depuis le classement (wirePlayerNameLinks(),
  // voir leaderboard-panel.js), qui remplace tout #infoBody sans jamais garder trace de son propre
  // contenu -- avant, seul le ✕ (fermeture complète du panneau générique #infoOverlay, partagé
  // avec Wiki/Compendium/Succès/Patch notes) était disponible, obligeant à rouvrir le classement
  // depuis zéro (perte de la catégorie/recherche/page en cours). Rouvre directement le classement
  // au lieu de fermer, comme un vrai "précédent" plutôt qu'un simple bouton de fermeture.
  const backBtn = `<button id="btnBackToLeaderboard" style="margin-bottom:8px">${i18next.t('backend:backend.gear.back_to_leaderboard_button')}</button>`;
  $a('infoBody').innerHTML = backBtn + copyBtn +
    `<div id="pdWeapons">${readonlyPdSlotsHtml(data, PD_BOTTOM)}</div>` +
    `<div id="paperdoll"><div class="pdCol">${readonlyPdSlotsHtml(data, PD_LEFT)}</div>` +
    `<div class="pdCenter"></div><div class="pdCol">${readonlyPdSlotsHtml(data, PD_RIGHT)}</div></div>` +
    readonlyGearListHtml(data);
  const backBtnEl = $a('btnBackToLeaderboard');
  if (backBtnEl) backBtnEl.onclick = () => { if (typeof openLeaderboard2 === 'function') openLeaderboard2(); };
  if (isAdmin()) {
    $a('btnCopyGearUuid').onclick = async () => {
      try { await navigator.clipboard.writeText(userId); } catch(e) {}
      floatTxt(P.x, P.y, 100, i18next.t('backend:backend.gear.uuid_copied'), { gold:true });
    };
  }
}
// inventaire complet (192 cases) d'un joueur, en lecture seule — réservé au staff. Ouvre dans une
// VRAIE fenêtre séparée du navigateur (pas dans le panneau admin) et revient automatiquement sur
// le panneau admin (dans la fenêtre principale) quand cette fenêtre popup se ferme — demande
// explicite du 2026-07-06
/** @param {string} userId @param {string} displayName. Ouvre l'inventaire complet (192 cases) d'un joueur en lecture seule dans une VRAIE fenêtre popup séparée (staff uniquement) — revient sur le panneau admin à sa fermeture. */
async function showPlayerInventoryWindow(userId, displayName) {
  if (!isAdmin() || !sb) return;
  const win = window.open('', '_blank', 'width=620,height=760');
  if (!win) { floatTxt(P.x, P.y, 100, i18next.t('backend:backend.gear.popup_blocked'), { hurt:true }); return; }
  const safeName = escapeHtml(displayName || '?');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>🎒 ${safeName}</title><style>
    body{background:#141319;color:#e8e3d8;font-family:Georgia,serif;padding:14px;margin:0;}
    h2{font-size:15px;margin:0 0 10px;}
    h3{font-size:12px;margin:14px 0 6px;color:#c9a55a;font-weight:normal;letter-spacing:.5px;}
    .admSummary{font-size:11px;color:#a89f8c;margin-bottom:10px;}
    .admEmpty{color:#a89f8c;font-size:12px;font-style:italic;text-align:center;padding:10px 0;}
    .admInvGrid{display:grid;grid-template-columns:repeat(8,1fr);gap:3px;}
    .cell{aspect-ratio:1;background:#1c1a22;border:1px solid #2c2a33;position:relative;font-size:14px;
      display:flex;align-items:center;justify-content:center;border-radius:3px;}
    .cell.catHidden{display:none;}
    .qty{position:absolute;bottom:1px;right:2px;font-size:8.5px;color:#cfc8ba;}
    .paperdollBox{display:flex;justify-content:center;gap:22px;margin-bottom:8px;}
    .pdCol{display:flex;flex-direction:column;gap:5px;}
    #pdRight{flex-direction:column;flex-wrap:wrap;max-height:153px;gap:5px;}
    .pdSlot{width:42px;height:42px;border:1px solid #3a3742;background:rgba(20,19,26,.9);
      display:flex;align-items:center;justify-content:center;font-size:18px;position:relative;border-radius:3px;}
    .pdSlot.filled{border-color:#c9a55a88;background:#231f16;}
    .pdSlot.empty{opacity:.42;filter:grayscale(1);}
    .gicon{width:1.5em;height:1.5em;vertical-align:middle;flex-shrink:0;}
    #pdWeapons{display:flex;justify-content:center;gap:6px;padding:6px 0 10px;border-bottom:1px solid #2c2a33;margin-bottom:8px;}
    #pdWeapons .pdSlot{width:46px;height:46px;}
    .admTable{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:4px;}
    .admTable th{text-align:left;color:#a89f8c;font-weight:normal;font-size:9.5px;padding:2px 6px;}
    .admTable td{padding:4px 6px;border-bottom:1px solid #201f26;color:#e8e3d8;}
    .catTabs{display:flex;gap:5px;flex-wrap:wrap;margin:0 0 8px;}
    .catTab{width:auto;margin:0;padding:5px 9px;font-size:10.5px;background:transparent;color:#e8e3d8;
      border:1px solid #3a3742;border-radius:3px;cursor:pointer;font-family:inherit;}
    .catTab.active{border-color:#c9a55a;color:#c9a55a;}
    .catTab.locked{opacity:.45;cursor:not-allowed;}
    button{font-family:inherit;}
  </style></head><body><h2>🎒 ${safeName}</h2><div id="body"><div class="admEmpty">Chargement…</div></div></body></html>`);
  win.document.close();
  // à la fermeture de cette fenêtre popup, on revient sur le panneau admin dans la fenêtre principale
  // -- bug corrigé (2026-07-20, "quand je reste longtemps dans compagnon le dashboard s'affiche") :
  // ce setInterval survit tant que le popup n'est pas fermé, MÊME si l'admin a depuis quitté le
  // panneau admin (ex: parti tester le module Compagnon) -- si le popup traîne longtemps en arrière-
  // plan avant d'être fermé (manuellement ou par le navigateur), openAdminPanel() se déclenchait
  // sans prévenir, en pleine session Compagnon. Ne rouvre désormais QUE si le panneau admin était
  // encore affiché au moment de la fermeture du popup (l'admin n'a pas explicitement navigué
  // ailleurs entre-temps via closeAdminPanel(), qui retire la classe 'open').
  const checkClosed = setInterval(() => {
    if (win.closed) {
      clearInterval(checkClosed);
      const overlay = $a('adminOverlay');
      if (overlay && overlay.classList.contains('open')) openAdminPanel();
    }
  }, 400);
  const [{ data: gear, error: gearErr }, { data: inv0, error: invErr }] = await Promise.all([
    sb.rpc('get_player_gear', { p_user_id: userId }),
    sb.rpc('admin_get_player_inventory', { p_user_id: userId }),
  ]);
  if (win.closed) return;
  const bodyEl = win.document.getElementById('body');
  if (gearErr || invErr) { bodyEl.innerHTML = `<div class="admEmpty">${escapeHtml((gearErr||invErr).message)}</div>`; return; }
  const inv = Array.isArray(inv0) ? inv0 : [];
  const used = inv.filter(Boolean).length;
  function cellHtml(s, visible) {
    if (!s) return `<div class="cell"></div>`;
    const apDp = (s.kind === 'gear' || s.kind === 'jackpot') ? effectiveApDp(s) : null;
    const bits = [tr(s.name)];
    if (s.qty > 1) bits.push('×'+s.qty);
    if (apDp && apDp.ap) bits.push('+'+apDp.ap+' PA');
    if (apDp && apDp.dp) bits.push('+'+apDp.dp+' PD');
    if (apDp && apDp.hp) bits.push('+'+apDp.hp+' PV');
    if (apDp && apDp.dodge) bits.push('+'+apDp.dodge+'% Esq.');
    if (s.enhLv) bits.push(ENH_NAMES[s.enhLv]);
    return `<div class="cell${visible?'':' catHidden'}" title="${escapeHtml(bits.join(' · '))}">` +
      `<span style="color:${s.color}">${s.icon}</span>` +
      `${s.qty > 1 ? `<span class="qty">${fmt(s.qty)}</span>` : ''}</div>`;
  }
  let invCat = 'normal';
  function renderInvPane() {
    const cat = INV_CATEGORIES.find(c => c.id === invCat) || INV_CATEGORIES[0];
    const gridEl = win.document.getElementById('admGrid');
    if (!gridEl) return;
    gridEl.innerHTML = inv.map(s => cellHtml(s, !s || cat.kinds.includes(s.kind))).join('');
  }
  const tabsHtml = INV_CATEGORIES.map(c => `<button class="catTab${c.id===invCat?' active':''}${c.locked?' locked':''}"` +
    `${c.locked?' disabled title="'+i18next.t('backend:backend.inventory_window.coming_soon')+'"':''} data-cat="${c.id}">${c.locked?'🔒 ':''}${c.icon} ${c.label[LANG]}</button>`).join('');
  bodyEl.innerHTML =
    `<h3>${i18next.t('backend:backend.inventory_window.gear_title')}</h3>` +
    `<div id="pdWeapons">${readonlyPdSlotsHtml(gear, PD_BOTTOM)}</div>` +
    `<div class="paperdollBox"><div class="pdCol">${readonlyPdSlotsHtml(gear, PD_LEFT)}</div>` +
    `<div class="pdCol" id="pdRight">${readonlyPdSlotsHtml(gear, PD_RIGHT)}</div></div>` +
    readonlyGearListHtml(gear) +
    `<h3>${i18next.t('backend:backend.inventory_window.bag_title')}</h3>` +
    `<div class="admSummary">${used} / ${inv.length || INV_SIZE} ${i18next.t('backend:backend.inventory_window.slots_used')}</div>` +
    `<div class="catTabs">${tabsHtml}</div>` +
    `<div class="admInvGrid" id="admGrid"></div>`;
  win.document.querySelectorAll('.catTab:not(.locked)').forEach(btn => {
    btn.onclick = () => {
      invCat = btn.dataset.cat;
      win.document.querySelectorAll('.catTab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderInvPane();
    };
  });
  renderInvPane();
}

// Chat (mondial/trade/annonce + mentions @joueur) -> voir chat.js (charge APRES ce fichier, voir index.html)
// 2026-07-13 : #btnLeaderboard (sidebar) retiré, doublon du raccourci header -- #btnLeaderboardTopbar
// est désormais le SEUL déclencheur.
$a('btnLeaderboardTopbar').onclick = () => openLeaderboard2();
$a('btnNotifCenter').onclick = openNotifCenter;
updateNotifBadge();
$a('btnAchievements').onclick = openAchievements;
// 2026-07-10 : remplace l'ancienne modale texte (openCompendium(), progression/notifications-quests.js,
// toujours utilisée comme repli si React est indisponible) par le nouveau Compendium React (3e
// exception React du projet, voir src/progression/compendium-react.js et CLAUDE.md §7).
$a('btnCompendium').onclick = openCompendiumReact;
$a('ztCompendium').onclick = openCompendiumReact;
// Donation (2026-07-21, demande explicite : "ouvre soutenir et on y met les page de donation
// dedans") -- déverrouille #btnDonation (jusque-là lockedFeatureBtn) et ouvre donation/index.html
// (page autonome déjà réelle : lien PayPal.me configuré, voir commit bc3a40c) dans un panneau
// iframe, même pattern que openCompanionsModule()/closeCompanionsModule() (combat/boss.js) --
// iframe plutôt que fusion HTML : index.html a son propre :root de couleurs et aucune dépendance
// au scope global du jeu, pas besoin de partager quoi que ce soit avec lui.
// 2026-07-21 (tri de la racine, voir docs/) : donation.html/donation-merci.html/donation-policy.html
// déplacés à la racine du dossier donation/ -- chemin mis à jour ici en conséquence.
// 2026-07-21 (repo-audit-todo.md point 7) : donation.html renommé en index.html pour une URL
// propre (tonsite.com/donation/ au lieu de .../donation/donation.html), chemin mis à jour ici.
// ⚠️ Le total collecté/la barre de progression/le mur de donateurs affichés dans donation/index.html
// sont des VALEURS FIXES (jamais branchées à un vrai suivi des dons) -- pas touché ici, mais à
// garder en tête si un vrai suivi est demandé un jour (voir aussi donation-policy.html, lien déjà
// en place).
/** Ouvre le panneau Don (crée l'overlay+iframe vers donation/index.html au premier appel, le réutilise ensuite). */
function openDonationPanel() {
  let overlay = $a('donationOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'donationOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:953;background:#0A0C14;display:flex;flex-direction:column';
    const bar = document.createElement('div');
    bar.style.cssText = 'flex-shrink:0;display:flex;justify-content:flex-end;padding:6px 10px;background:#12141f;border-bottom:1px solid #232739';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ ' + (LANG==='fr'?'Fermer':'Close');
    closeBtn.style.cssText = 'font-family:Georgia,serif;font-size:12px;background:transparent;border:1px solid #3a2f22;color:#e8e6df;border-radius:5px;padding:5px 12px;cursor:pointer';
    closeBtn.onclick = closeDonationPanel;
    bar.appendChild(closeBtn);
    const frame = document.createElement('iframe');
    frame.id = 'donationFrame';
    frame.style.cssText = 'flex:1;border:0;width:100%';
    frame.src = 'donation/index.html';
    overlay.appendChild(bar);
    overlay.appendChild(frame);
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
}
/** Ferme le panneau Don. */
function closeDonationPanel() {
  const overlay = $a('donationOverlay');
  if (overlay) overlay.style.display = 'none';
}
// 2026-07-13 : #btnDonation (sidebar) retiré, doublon du raccourci header -- #btnDonationTopbar
// est désormais le SEUL déclencheur.
$a('btnDonationTopbar').onclick = openDonationPanel;
// ex-raccourcis header par proxy .click() (2026-07-13, mockup validé, voir CLAUDE.md) RETIRÉS le
// même jour : #btnLeaderboard/#btnMarket/#btnPatch/#btnDonation/#btnAdmin/#btnLogout (sidebar)
// n'existent plus (doublons retirés) -- chaque bouton Topbar est câblé DIRECTEMENT sur sa
// fonction réelle à l'endroit où celle-ci est définie (voir #btnMarketTopbar dans market.js,
// #btnAdminTopbar dans admin-panel.js, #btnPatchTopbar/#btnLeaderboardTopbar/#btnDonationTopbar/
// #btnLogoutTopbar dans ce fichier), plus aucune logique de proxy/délégation.
$a('btnDailyQuests').onclick = openDailyQuests;
$a('btnMailbox').onclick = openMailbox;
// bascule Inventaire/Assemblage dans la carte Inventaire (2026-07-06, demande explicite : "on va
// mettre le craft dans la carte de l'inventaire en haut par un bouton") -- le panneau de craft du
// Trésor de Velia (#treasureCraftPanel) vivait dans la carte Optimisation, déplacé ici
// 3e mode "compendium" ajouté le 2026-07-14 (demande explicite : "met compendium en grand avec
// inventaire et assemblage") -- promu au même niveau qu'Inventaire/Assemblage, plus une simple
// catégorie dans l'onglet Inventaire
document.querySelectorAll('.invModeTab').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.invModeTab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const mode = btn.dataset.mode;
    $a('invModeInvPane').style.display = mode === 'inv' ? '' : 'none';
    $a('invModeCraftPane').style.display = mode === 'craft' ? '' : 'none';
    $a('invModeCompendiumPane').style.display = mode === 'compendium' ? '' : 'none';
    if (mode === 'craft') renderTreasureCraftPanel();
    else if (mode === 'compendium') renderCompendiumPane();
  };
});
renderActivityTabs();
// quitter un combat en cours → retour au lobby Boss ; fermer le lobby → retour à la Zone (farm)
$a('bossLeaveBtn').onclick = () => { if (bossState.active) endBossFight(false); else openBossLobby(); };
$a('potSlot').onclick = togglePotSelect;
// repli de la barre de sorts sur mobile/tablette (2026-07-05, demande explicite) : purement
// indicative (aucun clic requis en jeu, le combat est automatique), repliée par défaut pour ne
// jamais gêner la vue — le bouton ⚡ la déplie/replie à la demande (non persisté : repart repliée
// à chaque rechargement, cohérent avec "toujours replié par défaut sur petit écran")
$a('skillBarToggle').onclick = () => {
  $a('skillBar').classList.toggle('expanded');
  $a('skillBarToggle').classList.toggle('expanded');
};
$a('farmModeSlider').querySelectorAll('.farmModeSeg').forEach(seg => {
  seg.onclick = () => setFarmMode(seg.dataset.mode);
});
renderFarmModeBtn();
// mode de combat IA manuel (2026-07-14, remplace l'ancien calcul auto -- voir aiMode())
$a('aiModeSlider').querySelectorAll('.aiModeSeg').forEach(seg => {
  seg.onclick = () => setAiCombatMode(seg.dataset.mode);
});
renderAiModeBtn();
// bascule Équipement/Cristal (2026-07-15, demande explicite)
$a('equipModeSlider').querySelectorAll('.equipModeSeg').forEach(seg => {
  seg.onclick = () => setEquipMode(seg.dataset.mode);
});
renderEquipModeBtn();

/**
 * Traduit une position écran (clientX/clientY d'un clic) en coordonnées MONDE du canvas #cv, en
 * tenant compte d'un éventuel recadrage CSS `object-fit:cover` (2026-07-12, cadre 4:5 sur mobile,
 * voir @media max-width:600px dans src/styles/styles.css) -- sans ça, le clic reste correctement
 * aligné sur desktop mais devient décalé sur mobile dès que le canvas est recadré/zoomé plutôt
 * que simplement mis à l'échelle uniformément.
 *
 * Formule générale pour "cover" : le canvas est mis à l'échelle par le PLUS GRAND des deux
 * ratios largeur/hauteur (rect vs résolution interne), pour remplir entièrement la boîte CSS —
 * la dimension qui déborde est recadrée (centrée par défaut, object-position:50% 50%). On calcule
 * cette échelle + l'offset de centrage réels, puis on les inverse pour retomber sur la
 * coordonnée source (monde) du point cliqué.
 *
 * Cas desktop (pas de recadrage, rect.width/canvasW === rect.height/canvasH déjà égaux car
 * height:auto préserve le ratio natif) : scale/offset se simplifient exactement à l'ancien calcul
 * `(clientX - rect.left) * (canvasW / rect.width)` -- cette fonction reste donc correcte aussi
 * bien sur desktop que sur mobile, un seul chemin de code pour les deux.
 * @param {{left:number,top:number,width:number,height:number}} rect - cv.getBoundingClientRect()
 * @param {number} canvasW - résolution interne du canvas (cv.width, W) -- jamais modifiée par CSS
 * @param {number} canvasH - résolution interne du canvas (cv.height, H) -- jamais modifiée par CSS
 * @param {number} clientX - e.clientX du clic
 * @param {number} clientY - e.clientY du clic
 * @returns {{sx:number, sy:number}} coordonnées monde correspondant au point cliqué
 */
function mapCanvasClickToWorld(rect, canvasW, canvasH, clientX, clientY) {
  const scale = Math.max(rect.width / canvasW, rect.height / canvasH);
  const dispW = canvasW * scale, dispH = canvasH * scale;
  const offX = (rect.width - dispW) / 2, offY = (rect.height - dispH) / 2;
  return { sx: (clientX - rect.left - offX) / scale, sy: (clientY - rect.top - offY) / scale };
}
// clic sur un objet au sol : déplace le perso jusque là. Prioritaire sur l'IA — tant qu'il n'est
// pas arrivé à l'endroit cliqué, l'IA ne reprend pas la main (voir P.manualTarget dans fsm())
cv.addEventListener('click', e => {
  const rect = cv.getBoundingClientRect();
  const { sx, sy } = mapCanvasClickToWorld(rect, W, H, e.clientX, e.clientY);
  const candidates = drops.filter(l => !l.taken).map(l => {
    const s = toScreen(l.x, l.y);
    return { l, d: Math.hypot(sx - s.sx, sy - s.sy) };
  }).sort((a, b) => a.d - b.d);
  if (candidates.length && candidates[0].d < 34) {
    P.manualTarget = { x: candidates[0].l.x, y: candidates[0].l.y };
  }
});
$a('bossLobbyClose').onclick = () => showActivityPage('zone');
// Mini Boss (2026-07-13, combat/miniboss.js) : mêmes conventions que Boss juste au-dessus --
// quitter un combat en cours = quitte seul (perte du loot, voir minibossSoloLeave) -- affiche
// D'ABORD une confirmation (minibossToggleSoloLeaveConfirm), jamais direct (perte sèche de loot,
// ne doit jamais être accidentelle, voir revue de maquette) ; fermer le lobby = retour à la Zone.
$a('minibossLobbyClose').onclick = () => showActivityPage('zone');
$a('minibossSoloLeaveBtn').onclick = () => { if (minibossState.active) minibossToggleSoloLeaveConfirm(); };
$a('minibossVoteStopBtn').onclick = () => { if (minibossState.active) minibossToggleVoteStop(); };
$a('minibossSoloLeaveConfirmBtn').onclick = () => minibossSoloLeave();
$a('minibossSoloLeaveCancelBtn').onclick = () => minibossToggleSoloLeaveConfirm();
// chat de groupe persistant pendant le combat (2026-07-14, ajout suite à revue de maquette --
// même flux partagé minibossGroupLog que le chat de groupe du lobby, voir renderMinibossGroupChatLog).
$a('minibossArenaGroupSend').onclick = () => minibossSendChat('group', $a('minibossArenaGroupInput'));
$a('minibossArenaGroupInput').onkeydown = e => { if (e.key==='Enter') minibossSendChat('group', $a('minibossArenaGroupInput')); };
window.addEventListener('resize', () => { if (bossState.active) resizeBossCanvas(); if (minibossState.active) resizeMinibossCanvas(); });
updateNextBossMini();
setInterval(updateNextBossMini, 1000);

// ---------- présence : compteur "joueurs en ligne" (invités inclus) ----------
// zone_idx = -1 pour Velia (2026-07-16, demande explicite : liste des joueurs en ville) -- avant,
// NULL (aucune zone) ; -1 sert de sentinelle dédiée pour get_velia_players() côté serveur, sans
// jamais entrer en collision avec un vrai index de zone (toujours >= 0).
/** Signale la présence du joueur (RPC heartbeat_presence, zone -1 pour Velia) et vérifie la session en même cadence (20s). */
async function heartbeatPresence() {
  if (!sb || !currentUser) return;
  try { await sb.rpc('heartbeat_presence', { p_is_guest: isGuest(), p_zone_idx: atVelia ? -1 : zoneIdx }); } catch(e) {}
  checkPlayerSession(); // même cadence (20s, voir setInterval(heartbeatPresence,20000) plus bas)
}
// joueurs actuellement en ville (2026-07-16, demande explicite : "on peut voir la liste des
// joueurs dans la ville a droite a la place du loot ticker") -- pseudos VISIBLES pour cette zone
// sociale précisément (confirmé explicitement par l'utilisateur), contrairement au reste du jeu
// (zonePlayerCounts, agrégé seulement). Affiché par updateVeliaPlayersTicker() (game-core.js).
// veliaPlayers est declare dans game-core.js (evite un piege de zone morte temporelle une fois
// le jeu regroupe en un seul fichier -- voir le commentaire juste avant buildZoneList())
/** Recharge la liste des pseudos actuellement à Velia (RPC get_velia_players) et rafraîchit le ticker. No-op si pas à Velia. */
async function refreshVeliaPlayers() {
  if (!sb || !atVelia) return;
  try {
    const { data, error } = await sb.rpc('get_velia_players', { p_window_seconds: 90 });
    if (error || !data) return;
    veliaPlayers = data;
    if (typeof updateVeliaPlayersTicker === 'function') updateVeliaPlayersTicker();
  } catch(e) {}
}
// combien de joueurs sont actuellement dans chaque zone de farm (demande explicite du 2026-07-06)
// -- affiché dans #zoneList (voir buildZoneList dans game-core.js), rafraîchi au même rythme que
// le heartbeat pour rester à jour sans spammer le serveur
// zonePlayerCounts est declare dans game-core.js (evite un piege de zone morte temporelle une
// fois le jeu regroupe en un seul fichier -- voir le commentaire juste avant buildZoneList())
/** Recharge le nombre de joueurs par zone de farm (RPC get_zone_player_counts) et rafraîchit les badges. */
async function refreshZonePlayerCounts() {
  if (!sb) return;
  try {
    const { data, error } = await sb.rpc('get_zone_player_counts', { p_window_seconds: 90 });
    if (error || !data) return;
    zonePlayerCounts = {};
    data.forEach(r => { zonePlayerCounts[r.zone_idx] = r.cnt; });
    if (typeof updateZonePlayerCountBadges === 'function') updateZonePlayerCountBadges();
  } catch(e) {}
}
// étiquette "admin ici" visible par TOUS les joueurs (2026-07-16, demande explicite : "ettiquette
// admin montré a tout le monde") -- avant, purement client-side (isAdmin() + isCurrent, voir
// buildZoneList) : ne pouvait s'afficher QUE sur le propre client de l'admin. get_admin_zone()
// (nouvelle fonction serveur, voir migration 20260716120000) renvoie l'index de zone où se trouve
// le SEUL compte admin (ou null), sans exposer l'identité d'aucun autre joueur -- même rafraîchi
// que zonePlayerCounts, ne reconstruit la liste de zones QUE si la valeur a changé.
// adminZoneIdx est declare dans game-core.js (evite un piege de zone morte temporelle une fois
// le jeu regroupe en un seul fichier -- voir le commentaire juste avant buildZoneList())
/** Recharge la zone où se trouve le compte admin (RPC get_admin_zone, visible par tous), ne reconstruit la liste de zones que si la valeur a changé. */
async function refreshAdminZone() {
  if (!sb) return;
  try {
    const { data, error } = await sb.rpc('get_admin_zone', { p_window_seconds: 90 });
    if (error) return;
    const next = (data === null || data === undefined) ? null : Number(data);
    if (next !== adminZoneIdx) {
      adminZoneIdx = next;
      if (typeof buildZoneList === 'function') buildZoneList();
    }
  } catch(e) {}
}
// ==================== REFRESH DE PRÉSENCE GROUPÉ (audit perf P1, 2026-07-22) ====================
// Les 4 fonctions ci-dessus (online / zones / admin / velia) tournaient chacune sur son propre
// setInterval de 20 s, alors qu'elles lisent TOUTES la même table `presence` avec la même fenêtre
// (90 s) : 4 allers-retours réseau distincts pour une seule et même donnée. Avec N joueurs actifs,
// ça faisait N × 4 requêtes toutes les 20 s -- le premier poste d'egress Supabase du projet.
//
// get_presence_snapshot (migration 20260722240000) fait la lecture UNE fois côté serveur et renvoie
// les 4 morceaux en un JSON. Cette fonction les redispatche vers exactement les mêmes cibles d'UI :
// la logique d'affichage n'est pas réécrite, juste déplacée. Parité vérifiée sur les données de
// prod avant bascule (snapshot == les 4 RPC, champ par champ).
//
// Ce qui reste séparé, et pourquoi :
//   * heartbeatPresence  -> c'est une ÉCRITURE, rien à grouper avec des lectures.
//   * refreshLiveBoss    -> autre table, et sa logique de reprise lui est propre (boss.js) : la
//                           fusionner fragiliserait son retry pour économiser une requête.
//   * refreshVeliaPlayers -> conservée telle quelle : elle est encore appelée à l'ENTRÉE EN VILLE
//                           (game-core.js), un rafraîchissement ciblé immédiat qui n'a rien à voir
//                           avec le tick périodique. Seul son setInterval disparaît.
// Les 4 RPC serveur restent également en place (get_online_counts sert à admin-panel.js).
/** Refresh de présence groupé (audit P1) : un seul RPC get_presence_snapshot au lieu des 4 appels séparés (online/zones/admin/velia), redispatché vers les mêmes cibles d'UI. */
async function refreshPresenceSnapshot() {
  if (!sb) return;
  try {
    const { data, error } = await sb.rpc('get_presence_snapshot', { p_window_seconds: 90 });
    if (error || !data) return;

    // --- online (ex-refreshOnlineCounter) ---
    if (data.online) {
      const { total, guests } = data.online;
      $a('onlineTotal').textContent = total;
      $a('onlineGuests').textContent = guests > 0
        ? ` (${guests} ${i18next.t('backend:backend.presence.guests_suffix')})` : '';
    }

    // --- zones (ex-refreshZonePlayerCounts) ---
    zonePlayerCounts = {};
    (data.zones || []).forEach(r => { zonePlayerCounts[r.zone_idx] = r.cnt; });
    if (typeof updateZonePlayerCountBadges === 'function') updateZonePlayerCountBadges();

    // --- admin_zone (ex-refreshAdminZone) : ne reconstruit la liste QUE si la valeur change ---
    const next = (data.admin_zone === null || data.admin_zone === undefined) ? null : Number(data.admin_zone);
    if (next !== adminZoneIdx) {
      adminZoneIdx = next;
      if (typeof buildZoneList === 'function') buildZoneList();
    }

    // --- velia (ex-refreshVeliaPlayers) : même garde `atVelia` que l'originale ---
    if (atVelia) {
      veliaPlayers = data.velia || [];
      if (typeof updateVeliaPlayersTicker === 'function') updateVeliaPlayersTicker();
    }
  } catch(e) {}
}
// Modal de reconnexion (2026-07-10) : enregistre une session AFK/hors-ligne terminée (fire-and-
// forget, l'affichage du modal ne doit jamais dépendre du succès de cet appel) + lit l'historique
// perso pour l'onglet "Historique des sessions" (voir src/core/reconnect-modal-react.js).
/** @param {object} payload - session AFK terminée (startedAt/endedAt/silver/xp/levelBefore/levelNow/zoneName/gearGrade/items/bestDrop*). Enregistre la session (RPC record_afk_session), fire-and-forget — l'affichage du modal de reconnexion ne dépend jamais de son succès. */
async function recordAfkSession(payload) {
  if (!sb || !currentUser) return;
  try {
    await sb.rpc('record_afk_session', {
      p_started_at: payload.startedAt,
      p_ended_at: payload.endedAt,
      p_silver_gained: payload.silver,
      p_xp_gained: payload.xp,
      p_level_before: payload.levelBefore,
      p_level_after: payload.levelNow,
      p_zone_name: payload.zoneName,
      p_gear_grade: payload.gearGrade,
      p_items: payload.items,
      p_best_drop_name: payload.bestDropName,
      p_best_drop_color: payload.bestDropColor,
    });
  } catch (e) {}
}
/** @returns {Promise<object[]>} historique des 12 dernières sessions AFK (RPC get_afk_history), lève en cas d'erreur. */
async function fetchAfkHistory() {
  if (!sb || !currentUser) return [];
  const { data, error } = await sb.rpc('get_afk_history', { p_limit: 12 });
  if (error) throw error;
  return data || [];
}
/** Recharge et affiche le compteur "joueurs en ligne" (RPC get_online_counts, invités inclus). */
async function refreshOnlineCounter() {
  if (!sb) return;
  try {
    const { data, error } = await sb.rpc('get_online_counts', { p_window_seconds: 90 });
    if (error || !data || !data[0]) return;
    const { total, guests } = data[0];
    $a('onlineTotal').textContent = total;
    $a('onlineGuests').textContent = guests > 0 ? ` (${guests} ${i18next.t('backend:backend.presence.guests_suffix')})` : '';
  } catch(e) {}
}
// nombre total de comptes inscrits (2026-07-05, demande explicite) : change rarement, pas besoin
// de le rafraîchir aussi souvent que le compteur "en ligne"
/** Recharge et affiche le nombre total de comptes inscrits (RPC get_registered_count) — change rarement, rafraîchi moins souvent que le compteur en ligne. */
async function refreshRegisteredCounter() {
  if (!sb) return;
  try {
    const { data, error } = await sb.rpc('get_registered_count');
    if (error || data == null) return;
    $a('registeredTotal').textContent = data;
  } catch(e) {}
}
// Ticks périodiques (audit perf P1, 2026-07-22) : on est passé de 6 à 3 intervalles. Les 4 lectures
// de présence (online/zones/admin/velia) lisaient la même table avec la même fenêtre en 4 requêtes
// distinctes -> un seul get_presence_snapshot les remplace (voir refreshPresenceSnapshot).
setInterval(heartbeatPresence, 20000);        // ÉCRITURE : rien à grouper avec des lectures
setInterval(refreshPresenceSnapshot, 20000);  // P1 : online + zones + admin + velia en 1 RPC
refreshPresenceSnapshot();                    // 1er rendu immédiat (remplace l'ancien refreshAdminZone())
setInterval(refreshLiveBoss, 20000);          // autre table + retry propre (boss.js) : reste séparé
refreshRegisteredCounter();
setInterval(refreshRegisteredCounter, 5 * 60000);

// ---------- panneau "Mon compte" : identité + parrainage (comptes vérifiés uniquement) ----------
/** @param {string} iso - date ISO. @returns {string} date formatée dans la locale du jeu (backend.common.date_locale), '—' si absente/invalide. */
function acctFmtDate(iso) {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  return new Date(t).toLocaleDateString(i18next.t('backend:backend.common.date_locale'), { year:'numeric', month:'long', day:'numeric' });
}
/** Calcule le rang du joueur courant dans la catégorie Gearscore du classement public (réutilise lb2ComputeYourRankInfo, même fetch que openLeaderboard2()). @returns {?{rank:number,total:number}} null si non classé/erreur réseau. */
async function acctFetchGsRank() {
  try {
    const { data, error } = await sb.from('player_stats').select('*').limit(500);
    if (error || !data) return null;
    return lb2ComputeYourRankInfo(data, 'gs', currentUser.id);
  } catch(e) { return null; }
}
/** Ouvre le panneau "Mon compte" refonte en cartes (identité/palier, progression, rang, connexion+streak, pseudo, sécurité, comptes liés, parrainage, maintenance/suppression). Version simplifiée (cache navigateur uniquement) pour un invité. */
async function openAccountPanel() {
  if (!sb || !currentUser) return;
  if (isGuest()) {
    openInfo(i18next.t('backend:backend.account.panel_title'), `
      <p>${i18next.t('backend:backend.account.guest_intro')}</p>
      <h3>🧹 ${i18next.t('backend:backend.account.cache_title')}</h3>
      <p class="mHint">${i18next.t('backend:backend.account.cache_hint')}</p>
      <button id="btnClearCache">🧹 ${i18next.t('backend:backend.account.cache_clear_button')}</button>
    `);
    $a('btnClearCache').onclick = clearGameCache;
    return;
  }
  let code = '', count = 0, referrals = [];
  try { const { data } = await sb.rpc('ensure_referral_code'); code = data || ''; } catch(e) {}
  try { const { data } = await sb.rpc('get_referral_count'); count = data || 0; } catch(e) {}
  try { const { data } = await sb.rpc('get_my_referrals'); referrals = data || []; } catch(e) {}

  const refRows = referrals.map(r => `
    <tr><td>${escapeHtml(r.display_name||'?')}</td><td>${r.lvl}</td><td>${fmt(r.gearscore)}</td><td>${fmt(r.silver)}</td></tr>
  `).join('') || `<tr><td colspan="4" class="admEmpty">${i18next.t('backend:backend.account.no_referrals')}</td></tr>`;

  const rules = i18next.t('backend:backend.account.referral_rules', { returnObjects: true });

  const hasDiscord = !!discordIdentity(currentUser);
  const hasGoogle = !!providerIdentity(currentUser, 'google');
  const hasGithub = !!providerIdentity(currentUser, 'github');
  const hasTwitter = !!providerIdentity(currentUser, 'twitter');
  const hasEmailAuth = !!providerIdentity(currentUser, 'email'); // §6 du brief : bloc Sécurité (mot de passe) seulement pour un compte email+mdp, pas un compte 100% OAuth

  const tier = (typeof gearTierForZone === 'function') ? gearTierForZone(zoneIdx) : null;
  const tierLabel = tier ? (tier.label[LANG] || tier.label.fr) : '';

  const html = `
    <div class="acctIdentity">
      <div class="acctAvatar">👤</div>
      <div class="acctIdentityInfo">
        <div class="acctNameRow">
          <span class="acctName">${escapeHtml(myPseudo || '?')}</span>
          ${tier ? `<span class="acctTierBadge" style="--tierColor:${tier.color}">⬥ ${escapeHtml(tierLabel)}</span>` : ''}
        </div>
        <div class="acctEmail">${escapeHtml(currentUser.email || '—')}</div>
      </div>
    </div>

    <div class="acctCard">
      <h3>📈 ${i18next.t('backend:backend.account.progression_title')}</h3>
      <div class="acctGrid acctGrid4">
        <div class="acctStat"><span class="acctStatLabel">${i18next.t('backend:backend.account.level_label')}</span><span class="acctStatVal">${S.lvl}</span></div>
        <div class="acctStat"><span class="acctStatLabel">${i18next.t('backend:backend.account.gearscore_label')}</span><span class="acctStatVal">${Math.round(S.bestGearscore||0)}</span></div>
        <div class="acctStat"><span class="acctStatLabel">${i18next.t('backend:backend.account.best_silver_hour_label')}</span><span class="acctStatVal">${fmt(S.bestSilverPerHour||0)}/h</span></div>
        <div class="acctStat"><span class="acctStatLabel">${i18next.t('backend:backend.account.member_since_label')}</span><span class="acctStatVal acctStatValSm">${acctFmtDate(currentUser.created_at)}</span></div>
      </div>
      <div class="acctDivider"></div>
      <div class="acctRankRow" id="acctRankRow">🏆 ${i18next.t('backend:backend.account.rank_gs_label')} <span id="acctRankVal" class="acctRankVal">${i18next.t('backend:backend.account.rank_loading')}</span></div>
    </div>

    <div class="acctCard">
      <h3>🔌 ${i18next.t('backend:backend.account.connection_title')}</h3>
      <div class="acctGrid acctGrid3">
        <div class="acctStat"><span class="acctStatLabel">${i18next.t('backend:backend.account.last_login_label')}</span><span class="acctStatVal acctStatValSm">${acctFmtDate(currentUser.last_sign_in_at)}</span></div>
        <div class="acctStat"><span class="acctStatLabel">${i18next.t('backend:backend.account.playtime_total_label')}</span><span class="acctStatVal">${fmtHours(S.playtimeSec||0)}</span></div>
        <div class="acctStat"><span class="acctStatLabel">${i18next.t('backend:backend.account.streak_label')}</span><span class="acctStatVal">🔥 ${i18next.t('backend:backend.account.streak_days', { count: S.loginStreak||0 })}</span></div>
      </div>
    </div>

    <div class="acctCard">
      <h3>${i18next.t('backend:backend.account.nickname_title')}</h3>
      <p class="mHint">${i18next.t('backend:backend.account.nickname_hint')}</p>
      <input type="text" id="pseudoInput" value="${myPseudo || ''}" maxlength="20">
      <button id="btnSavePseudo">${i18next.t('backend:backend.account.save_button')}</button>
      <div id="pseudoMsg"></div>
    </div>

    ${hasEmailAuth ? `
    <div class="acctCard">
      <h3>🔒 ${i18next.t('backend:backend.account.security_title')}</h3>
      <p class="mHint">${i18next.t('backend:backend.account.change_password_hint')}</p>
      <button id="btnChangePassword">🔒 ${i18next.t('backend:backend.account.change_password_button')}</button>
      <div id="changePasswordMsg"></div>
    </div>` : ''}

    <div class="acctCard">
      <h3>${i18next.t('backend:backend.account.linked_accounts_title')}</h3>
      <div class="acctGrid acctGrid2">
        <div class="acctLinkRow">
          <span>💬 Discord</span>
          ${hasDiscord
            ? `<span class="mHint">${i18next.t('backend:backend.account.discord_connected')}</span>`
            : `<button id="btnLinkDiscord" class="discordBtn">🎮 ${i18next.t('backend:backend.account.discord_connect_button')}</button>`}
        </div>
        <div class="acctLinkRow">
          <span>🔵 Google</span>
          ${hasGoogle
            ? `<span class="mHint">${i18next.t('backend:backend.account.google_connected')}</span>`
            : `<button id="btnLinkGoogle" class="googleBtn">🔵 ${i18next.t('backend:backend.account.google_connect_button')}</button>`}
        </div>
        <div class="acctLinkRow">
          <span>🐙 GitHub</span>
          ${hasGithub
            ? `<span class="mHint">${i18next.t('backend:backend.account.github_connected')}</span>`
            : `<button id="btnLinkGithub" class="githubBtn">🐙 ${i18next.t('backend:backend.account.github_connect_button')}</button>`}
        </div>
        <div class="acctLinkRow">
          <span>🐦 Twitter/X</span>
          ${hasTwitter
            ? `<span class="mHint">${i18next.t('backend:backend.account.twitter_connected')}</span>`
            : `<button id="btnLinkTwitter" class="twitterBtn">🐦 ${i18next.t('backend:backend.account.twitter_connect_button')}</button>`}
        </div>
      </div>
    </div>

    <div class="acctCard">
      <h3>${i18next.t('backend:backend.account.referrals_title')}</h3>
      <div id="refCodeBox">${code}</div>
      <button id="btnCopyRefCode">${i18next.t('backend:backend.account.copy_code_button')}</button>
      <div class="admSummary" style="margin-top:14px">${i18next.t('backend:backend.account.has_code_prompt')}</div>
      <input type="text" id="refCodeInput" placeholder="${i18next.t('backend:backend.account.referral_code_placeholder')}" maxlength="12">
      <button id="btnApplyRefCode">${i18next.t('backend:backend.account.apply_button')}</button>
      <div id="refMsg"></div>
      <ul class="refRules">${rules.map(r => `<li>${r}</li>`).join('')}</ul>

      <h3>${i18next.t('backend:backend.account.your_referrals_title')} (<span style="color:var(--gold)">${count}</span>)</h3>
      <table class="admTable">
        <thead><tr><th>${i18next.t('backend:backend.common.player_label')}</th><th>${i18next.t('backend:backend.account.level_label')}</th><th>GS</th><th>Silver</th></tr></thead>
        <tbody>${refRows}</tbody>
      </table>
    </div>

    <div class="acctCard">
      <h3>🧹 ${i18next.t('backend:backend.account.maintenance_title')}</h3>
      <p class="mHint">${i18next.t('backend:backend.account.cache_hint')}</p>
      <button id="btnClearCache">🧹 ${i18next.t('backend:backend.account.cache_clear_button')}</button>
      <div class="acctDivider"></div>
      <button id="btnDeleteAccount" class="acctDangerBtn">🗑️ ${i18next.t('backend:backend.account.delete_account_button')}</button>
      <div id="acctDeleteConfirmBox" class="acctDangerBox" style="display:none">
        <p class="acctDangerWarning">⚠️ ${i18next.t('backend:backend.account.delete_account_warning')}</p>
        <p class="mHint">${i18next.t('backend:backend.account.delete_account_confirm_prompt', { pseudo: escapeHtml(myPseudo || '') })}</p>
        <input type="text" id="acctDeleteConfirmInput" placeholder="${escapeHtml(i18next.t('backend:backend.account.delete_account_confirm_placeholder'))}">
        <div class="acctDangerBtnRow">
          <button id="btnDeleteAccountCancel">${i18next.t('backend:backend.account.delete_account_cancel_button')}</button>
          <button id="btnDeleteAccountConfirm" class="acctDangerBtn" disabled>${i18next.t('backend:backend.account.delete_account_confirm_button')}</button>
        </div>
        <div id="acctDeleteMsg"></div>
      </div>
    </div>
  `;
  openInfo(i18next.t('backend:backend.account.panel_title'), html);
  $a('btnClearCache').onclick = clearGameCache;
  $a('btnSavePseudo').onclick = async () => {
    const val = $a('pseudoInput').value.trim();
    const msg = $a('pseudoMsg');
    const { error } = await sb.rpc('set_pseudo', { p_pseudo: val });
    if (error) { msg.textContent = error.message; msg.className = 'fail'; return; }
    myPseudo = val;
    updatePseudoDisplay();
    msg.textContent = i18next.t('backend:backend.account.nickname_saved'); msg.className = 'ok';
    syncPlayerStats(); // propage immédiatement au classement, sans attendre la prochaine synchro
  };
  if (!hasDiscord) $a('btnLinkDiscord').onclick = linkDiscordAccount;
  if (!hasGoogle) $a('btnLinkGoogle').onclick = linkGoogleAccount;
  if (!hasGithub) $a('btnLinkGithub').onclick = linkGithubAccount;
  if (!hasTwitter) $a('btnLinkTwitter').onclick = linkTwitterAccount;
  $a('btnCopyRefCode').onclick = async () => {
    try { await navigator.clipboard.writeText(code); } catch(e) {}
    $a('btnCopyRefCode').textContent = i18next.t('backend:backend.account.code_copied');
  };
  $a('btnApplyRefCode').onclick = async () => {
    const val = $a('refCodeInput').value.trim();
    const msg = $a('refMsg');
    if (!val) { msg.textContent = i18next.t('backend:backend.account.enter_code_prompt'); msg.className = 'fail'; return; }
    const { error } = await sb.rpc('apply_referral_code', { p_code: val });
    if (error) { msg.textContent = error.message; msg.className = 'fail'; return; }
    msg.textContent = i18next.t('backend:backend.account.code_applied'); msg.className = 'ok';
  };

  // rang Gearscore (2026-07-13, carte Progression) — requête réseau supplémentaire, chargée après
  // coup pour ne jamais bloquer l'ouverture du panneau ; échec réseau/pas encore de ligne
  // player_stats -> affiche '—' sans planter (même tolérance que le reste de ce panneau).
  $a('acctRankRow').onclick = () => { lb2Cat = 'gs'; openLeaderboard2(); };
  acctFetchGsRank().then(info => {
    const el = $a('acctRankVal');
    if (!el) return; // panneau refermé entre-temps
    el.textContent = info ? i18next.t('backend:backend.account.rank_of', { rank: info.rank, total: info.total }) : i18next.t('backend:backend.account.rank_unranked');
  });

  if (hasEmailAuth) {
    $a('btnChangePassword').onclick = async () => {
      const msg = $a('changePasswordMsg');
      msg.textContent = i18next.t('backend:backend.auth.sending'); msg.className = '';
      const { error } = await sb.auth.resetPasswordForEmail(currentUser.email, { redirectTo: location.href });
      if (error) { msg.textContent = error.message; msg.className = 'fail'; return; }
      msg.textContent = i18next.t('backend:backend.account.change_password_sent'); msg.className = 'ok';
    };
  }

  // suppression de compte (2026-07-13, demande explicite, voir supabase/migrations/*_delete_my_account.sql)
  // — le pseudo retapé doit correspondre EXACTEMENT à myPseudo pour activer le bouton final.
  const delBox = $a('acctDeleteConfirmBox');
  const delInput = $a('acctDeleteConfirmInput');
  const delBtn = $a('btnDeleteAccountConfirm');
  $a('btnDeleteAccount').onclick = () => { delBox.style.display = 'block'; delInput.value = ''; delBtn.disabled = true; delInput.focus(); };
  $a('btnDeleteAccountCancel').onclick = () => { delBox.style.display = 'none'; };
  delInput.addEventListener('input', () => { delBtn.disabled = delInput.value !== (myPseudo || ''); });
  delBtn.onclick = async () => {
    if (delInput.value !== (myPseudo || '')) return;
    const msg = $a('acctDeleteMsg');
    delBtn.disabled = true;
    msg.textContent = i18next.t('backend:backend.account.delete_account_deleting'); msg.className = '';
    const { error } = await sb.rpc('delete_my_account');
    if (error) { msg.textContent = error.message; msg.className = 'fail'; delBtn.disabled = false; return; }
    msg.textContent = i18next.t('backend:backend.account.delete_account_success'); msg.className = 'ok';
    setTimeout(async () => { await sb.auth.signOut(); location.reload(); }, 1500);
  };
}
// 2026-07-13 : #btnAccount (sidebar) retiré, doublon du header -- #btnAccountTopbar est câblé
// directement en HTML (onclick="openAccountPanel()", index.dev.html), pas besoin de le refaire ici.

let cloudSaveInterval = null;
/** Démarre l'autosave cloud périodique (30s) et sur fermeture de page, remplace tout intervalle déjà actif. */
function startAutoCloudSave() {
  if (cloudSaveInterval) clearInterval(cloudSaveInterval);
  cloudSaveInterval = setInterval(saveToCloud, 30000);
  window.addEventListener('beforeunload', saveToCloud);
}
// ping toutes les 60s pendant qu'un onglet actif est ouvert — sert uniquement à alimenter le
// graphique "temps de jeu par heure" de la Zone Admin (voir admin_playtime_by_hour)
// bug confirmé en prod (2026-07-08) : sb.rpc(...) ne renvoie pas toujours un objet exposant
// .catch() directement (thenable, pas une vraie Promise) — l'appeler plantait ("sb.rpc(...).catch
// is not a function"), une exception non interceptée toutes les 60s
setInterval(async () => { if (sb && currentUser && !document.hidden) { try { await sb.rpc('log_playtime_ping'); } catch(e) {} } }, 60000);

// Écran d'auth à modes (2026-07-22) : les boutons de #authChoice n'AGISSENT plus, ils ouvrent le
// flux correspondant (aucun champ tant qu'on n'a pas choisi). C'est #btnAuthSubmit qui exécute,
// en déléguant à AUTH_MODES[authMode].run -- un seul point d'entrée, pas un handler par bouton.
$a('btnSignIn').onclick = () => setAuthMode('signin');
$a('btnSignUp').onclick = () => setAuthMode('signup');
$a('btnForgotPass').onclick = () => setAuthMode('forgot');
$a('btnMagicLink').onclick = () => setAuthMode('magic');
$a('btnAuthBack').onclick = () => setAuthMode('choice');
$a('btnAuthSubmit').onclick = () => { const m = AUTH_MODES[authMode]; if (m) m.run(); };
// Entrée = valider le flux courant (réflexe attendu sur un écran de connexion, et le seul moyen
// de soumettre au clavier depuis un champ).
['authEmail','authPseudo','authPass'].forEach(id => {
  const el = $a(id);
  if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const m = AUTH_MODES[authMode]; if (m) m.run(); } });
});
document.querySelectorAll('.authLangBtn').forEach(b => {
  b.onclick = () => {
    LANG = b.dataset.lang;
    // slider auth lié à i18next comme #langToggle (2026-07-16, "tous les sliders doivent être liés") :
    // sans changeLanguage(), les messages i18next.t() de l'écran de connexion restaient dans l'ancienne
    // langue.
    if (typeof i18next !== 'undefined') i18next.changeLanguage(LANG);
    try { localStorage.setItem('velia-idle-lang', LANG); } catch(e) {}
    applyI18n();
  };
});
$a('btnSignInDiscord').onclick = doSignInDiscord;
$a('btnSignInGoogle').onclick = doSignInGoogle;
$a('btnSignInGithub').onclick = doSignInGithub;
$a('btnSignInTwitter').onclick = doSignInTwitter;
$a('btnClearCacheAuth').onclick = clearGameCache;
// 2026-07-13 : #btnLogout (sidebar) retiré, doublon du header -- #btnLogoutTopbar est désormais
// le SEUL déclencheur.
$a('btnLogoutTopbar').onclick = doLogout;
$a('btnCopyUuid').onclick = async () => {
  if (!currentUser) return;
  try { await navigator.clipboard.writeText(currentUser.id); } catch(e) {}
  const hint = $a('uuidCopyHint'); if (!hint) return;
  hint.innerHTML = i18next.t('backend:backend.account.uuid_copied_msg');
  setTimeout(() => { hint.innerHTML = '📋 ' + i18next.t('backend:backend.account.copy_label') + ' UUID'; }, 1200);
};
$a('btnLinkAccount').onclick = () => {
  // précise que "Se connecter" reprend un compte EXISTANT (contrairement à "Créer un
  // compte" qui démarre une nouvelle progression) — source de confusion signalée en test
  $a('authSub').textContent = i18next.t('backend:backend.account.link_account_prompt');
  showAuthOverlay(true);
};
// #closeAuth retiré le 2026-07-16 (demande explicite) : fermer l'overlay sans session laissait
// le joueur devant un jeu vide sans retour possible. Garde optionnelle si le bouton réapparaît.
{ const _ca = $a('closeAuth'); if (_ca) _ca.onclick = () => showAuthOverlay(false); }
let authMouseDownOnBackdrop = false;
$a('authOverlay').addEventListener('mousedown', e => { authMouseDownOnBackdrop = (e.target.id === 'authOverlay'); });
$a('authOverlay').addEventListener('click', e => { if (e.target.id === 'authOverlay' && authMouseDownOnBackdrop && currentUser) showAuthOverlay(false); });
$a('authPass').addEventListener('keydown', e => { if (e.key === 'Enter') doSignIn(); });

// au chargement : session déjà active ? sinon on démarre en invité (jamais de mur bloquant)
(async () => {
  // Supabase pas configuré → jeu jouable directement (mode local). grantWelcomeSilver() ici aussi :
  // ce mode ne passe jamais par loadCloudSave(), il aurait donc perdu le cadeau de bienvenue en
  // même temps que le setTimeout de render.js (2026-07-22).
  if (!sb) { showAuthOverlay(false); updateUserBar(); authShow(''); saveReady = true; grantWelcomeSilver(); return; }
  const { data } = await sb.auth.getSession();
  if (data.session) onAuthed(data.session.user);
  else await startGuestOrShowAuth();
})();

// Marche (Hotel des ventes + Marche commun v2, carnet d'ordres) -> voir market.js (charge APRES ce fichier, voir index.html)
