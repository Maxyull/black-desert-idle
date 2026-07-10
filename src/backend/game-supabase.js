
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
async function refreshMyTesterStatus() {
  myIsTester = false;
  if (sb && currentUser && !isGuest()) {
    try { const { data } = await sb.from('testers').select('user_id').eq('user_id', currentUser.id).maybeSingle(); myIsTester = !!data; } catch (e) {}
  }
  const b = $a('btnTester'); if (b) b.style.display = myIsTester ? '' : 'none';
}
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
// système de sanctions (2026-07-18, voir ADMIN_MENU_PLAN.md §3.1) : banStatus = { banned_until, ban_reason } ou null
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
// propriété de `window`. companions.sync.js (module Compagnon, iframe same-origin) lisait
// `window.parent.sb`/`window.parent.currentUser`, qui étaient donc TOUJOURS `undefined` -- le
// sync ne s'est jamais déclenché, pour aucun compte (invité ou non). Ces deux accesseurs sont des
// déclarations `function`, qui elles SONT attachées à `window` automatiquement -- toujours à jour
// car elles lisent `sb`/`currentUser` au moment de l'appel, pas une copie figée.
function getSbClient() { return sb; }
function getCurrentUserForSync() { return currentUser; }

// ---------- journal de farm (pour les stats admin) : queue légère, envoyée par lots ----------
// Agrégée en mémoire (clé = objet+zone) plutôt qu'une ligne par ramassage individuel : le combat
// automatique loot plusieurs fois par seconde, une ligne par pickup faisait exploser farm_events
// (~250k lignes/jour, 250 Mo en moins d'une semaine sur un quota de 500 Mo -- constaté le
// 2026-07-08). Les totaux par objet/zone restent exacts, seule la granularité "un pickup = une
// ligne" est perdue (jamais utilisée : admin_farm_by_item ne fait que sommer qty/silver_value).
let farmEventQueue = new Map();
function queueFarmEvent(kind, name, qty, silverVal) {
  if (!sb || !currentUser || isGuest()) return; // pas de compte vérifié → pas de journalisation
  const zone = Z().name;
  const key = kind + '|' + name + '|' + zone;
  const cur = farmEventQueue.get(key);
  if (cur) { cur.qty += qty; cur.silver_value += silverVal; }
  else farmEventQueue.set(key, { user_id: currentUser.id, item_name: name, item_kind: kind, qty, silver_value: silverVal, zone_name: zone });
}
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
function queueSilverLedger(delta, category, note) {
  if (!sb || !currentUser || isGuest() || !delta) return; // pas de compte vérifié → pas de journalisation
  const key = category + '|' + (note || '');
  const cur = silverLedgerQueue.get(key);
  if (cur) cur.delta += Math.round(delta);
  else silverLedgerQueue.set(key, { user_id: currentUser.id, delta: Math.round(delta), category, note: note || null });
}
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

function authShow(msg, isError) {
  $a('authError').textContent = isError ? msg : '';
  $a('authStatus').textContent = isError ? '' : (msg || '');
}
function showAuthOverlay(show) { $a('authOverlay').classList.toggle('hidden', !show); }
function updateUserBar() {
  $a('userBar').classList.toggle('show', !!currentUser);
  $a('userEmail').textContent = ''; // email retiré de l'affichage (demande du 2026-07-04)
  $a('btnLinkAccount').style.display = isGuest() ? '' : 'none';
  $a('btnLogout').style.display = isGuest() ? 'none' : '';
  $a('adminBox').style.display = isAdmin() ? '' : 'none';
  const adminMaxEnhBtn = $a('btnAdminMaxEnh'); if (adminMaxEnhBtn) adminMaxEnhBtn.style.display = isAdmin() ? '' : 'none';
  const adminResetEnhBtn = $a('btnAdminResetEnh'); if (adminResetEnhBtn) adminResetEnhBtn.style.display = isAdmin() ? '' : 'none';
  const adminEnhStepRow = $a('adminEnhStepRow'); if (adminEnhStepRow) adminEnhStepRow.style.display = isAdmin() ? '' : 'none';
  const adminTierRow = $a('adminTierRow'); if (adminTierRow) adminTierRow.style.display = isAdmin() ? '' : 'none';
  // UUID copiable (utile pour l'ajout de modérateurs) — affiché pour tout compte connecté
  const uuidRow = $a('uuidRow');
  if (uuidRow) uuidRow.style.display = currentUser ? 'flex' : 'none';
  updatePseudoDisplay();
  if (typeof updateChatInputVisibility === 'function') { updateChatInputVisibility(); fetchChatMessages(); }
}
// affiche le pseudo (ou "🎭 Invité") à côté du tag DÉMO — l'email n'est plus jamais affiché
function updatePseudoDisplay() {
  const el = $a('userPseudo');
  if (!el) return;
  if (isGuest()) el.textContent = LANG==='fr'?'🎭 Invité':'🎭 Guest';
  else el.textContent = (currentUser && myPseudo) ? myPseudo : '';
}

// upgrade d'une session invité en compte réel (garde le même user_id → la sauvegarde suit),
// ou création classique si jamais aucune session n'existe encore
// clé locale : mémorise le pseudo choisi à la création de compte le temps de confirmer l'email
// (aucune session active à ce moment-là pour appeler set_pseudo tout de suite) -- appliqué au
// prochain onAuthed() réussi, voir refreshMyPseudo()
const PENDING_PSEUDO_KEY = 'velia-idle-pending-pseudo';
async function doSignUp() {
  if (!sb) { authShow('Supabase non configuré — voir SUPABASE_URL en haut du script.', true); return; }
  const email = $a('authEmail').value.trim(), pass = $a('authPass').value;
  const pseudo = $a('authPseudo').value.trim();
  if (!email || pass.length < 6) { authShow('Email requis + mot de passe 6 caractères min.', true); return; }
  authShow('Création du compte...');
  if (pseudo) { try { localStorage.setItem(PENDING_PSEUDO_KEY, pseudo); } catch(e) {} }
  if (isGuest()) {
    // sans emailRedirectTo (2026-07-10, bug trouvé en vérification : "verifie que les redirection
    // vers le jeu se font bien après inscription"), le lien de confirmation d'email utilisait le
    // "Site URL" par défaut configuré côté dashboard Supabase au lieu de la page réellement visitée
    // — source probable de l'erreur 404 signalée après inscription si ce réglage était périmé.
    // Même correctif que doForgotPassword/doSignInDiscord, qui passaient déjà redirectTo.
    const { data, error } = await sb.auth.updateUser({ email, password: pass }, { emailRedirectTo: location.href });
    if (error) { authShow(error.message, true); return; }
    onAuthed(data.user);
    authShow('Compte lié ! Ta progression est conservée.');
    return;
  }
  const { data, error } = await sb.auth.signUp({ email, password: pass, options: { emailRedirectTo: location.href } });
  if (error) { authShow(error.message, true); return; }
  if (data.session) { onAuthed(data.session.user); }
  else authShow('Compte créé ! Vérifie ta boîte mail pour confirmer, puis connecte-toi.');
}
async function doSignIn() {
  if (!sb) { authShow('Supabase non configuré — voir SUPABASE_URL en haut du script.', true); return; }
  const email = $a('authEmail').value.trim(), pass = $a('authPass').value;
  if (!email || !pass) { authShow('Email et mot de passe requis.', true); return; }
  authShow('Connexion...');
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) { authShow(error.message, true); return; }
  onAuthed(data.user);
}
// envoie un email de réinitialisation de mot de passe — demande explicite du 2026-07-05
async function doForgotPassword() {
  if (!sb) { authShow('Supabase non configuré — voir SUPABASE_URL en haut du script.', true); return; }
  const email = $a('authEmail').value.trim();
  if (!email) { authShow(LANG==='fr' ? 'Entre ton email d\'abord, puis clique à nouveau.' : 'Enter your email first, then click again.', true); return; }
  authShow(LANG==='fr' ? 'Envoi en cours…' : 'Sending…');
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.href });
  if (error) { authShow(error.message, true); return; }
  authShow(LANG==='fr' ? 'Email envoyé — vérifie ta boîte mail pour réinitialiser ton mot de passe.' : 'Email sent — check your inbox to reset your password.');
}
async function doLogout() {
  if (sb) await sb.auth.signOut();
  currentUser = null;
  await startGuestOrShowAuth(); // jamais de mur bloquant : on repart direct sur une session invité
}

// connexion (ou liaison, si déjà invité/connecté) via Discord — demande le scope
// guilds.join pour pouvoir ajouter automatiquement le joueur au serveur Discord ensuite
async function doSignInDiscord() {
  if (!sb) { authShow('Supabase non configuré — voir SUPABASE_URL en haut du script.', true); return; }
  await sb.auth.signInWithOAuth({
    provider: 'discord',
    options: { scopes: 'identify guilds.join', redirectTo: location.href },
  });
}
// lie Discord à un compte email déjà existant (depuis le panneau "Mon compte"), sans
// perdre la session courante — nécessite "Manual Linking" activé côté Supabase
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
async function doSignInGoogle() {
  if (!sb) { authShow('Supabase non configuré — voir SUPABASE_URL en haut du script.', true); return; }
  await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href } });
}
async function doSignInGithub() {
  if (!sb) { authShow('Supabase non configuré — voir SUPABASE_URL en haut du script.', true); return; }
  await sb.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: location.href } });
}
// Twitter/X (2026-07-20, demande explicite : "peux tu ajouter twitter aussi") — même pattern,
// 'twitter' est le nom de provider attendu par Supabase Auth (OAuth 2.0, malgré le rebranding "X").
async function doSignInTwitter() {
  if (!sb) { authShow('Supabase non configuré — voir SUPABASE_URL en haut du script.', true); return; }
  await sb.auth.signInWithOAuth({ provider: 'twitter', options: { redirectTo: location.href } });
}
// lie Google/GitHub/Twitter à un compte déjà existant (panneau "Mon compte") — même pattern que
// linkDiscordAccount ci-dessus.
async function linkGoogleAccount() {
  if (!sb || !currentUser) return;
  const { error } = await sb.auth.linkIdentity({ provider: 'google', options: { redirectTo: location.href } });
  if (error) alert('Erreur : ' + error.message);
}
async function linkGithubAccount() {
  if (!sb || !currentUser) return;
  const { error } = await sb.auth.linkIdentity({ provider: 'github', options: { redirectTo: location.href } });
  if (error) alert('Erreur : ' + error.message);
}
async function linkTwitterAccount() {
  if (!sb || !currentUser) return;
  const { error } = await sb.auth.linkIdentity({ provider: 'twitter', options: { redirectTo: location.href } });
  if (error) alert('Erreur : ' + error.message);
}
function providerIdentity(user, provider) {
  return user?.identities?.find(i => i.provider === provider) || null;
}

function discordIdentity(user) {
  return user?.identities?.find(i => i.provider === 'discord') || null;
}
function discordUsername(user) {
  const id = discordIdentity(user);
  const d = id?.identity_data || {};
  return d.custom_claims?.global_name || d.full_name || d.name || d.user_name || null;
}

// ajoute automatiquement le joueur au serveur Discord communautaire via le bot, en
// utilisant le token OAuth (scope guilds.join) obtenu à l'instant de la connexion —
// ce token n'est disponible qu'à ce moment précis, jamais après un rechargement de page
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
async function onAuthed(user) {
  if (onAuthedRunning) return; // évite un double appel concurrent (course entre le flux normal et le relais onAuthStateChange ci-dessus)
  onAuthedRunning = true;
  try {
    await onAuthedInner(user);
  } finally {
    onAuthedRunning = false;
  }
}
async function onAuthedInner(user) {
  currentUser = user;
  // check de bannissement (2026-07-18) : bloque l'accès avant tout autre effet de la connexion
  // (chargement de sauvegarde, présence en ligne...) si le compte est banni.
  if (!isGuest()) {
    try {
      const { data: banStatus } = await sb.rpc('get_my_ban_status');
      const row = Array.isArray(banStatus) ? banStatus[0] : banStatus;
      if (isBanned(row)) {
        const until = new Date(row.banned_until).toLocaleString(LANG === 'fr' ? 'fr-FR' : 'en-US');
        const reason = row.ban_reason || (LANG === 'fr' ? 'non précisé' : 'unspecified');
        authShow(LANG === 'fr'
          ? `Compte suspendu jusqu'au ${until} — Motif : ${reason}`
          : `Account suspended until ${until} — Reason: ${reason}`, true);
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
  startAutoCloudSave();
  heartbeatPresence();
  refreshOnlineCounter();
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
      pushNotif('🎭', LANG==='fr'?'Tu joues en mode invité':'You\'re playing as a guest',
        LANG==='fr'
          ? 'Ta progression n\'est sauvegardée que sur cet appareil/navigateur — elle serait perdue en cas de changement ou de nettoyage du cache. Clique sur "🔗 Lier un compte" pour créer un compte (ta progression actuelle sera conservée) ou te reconnecter à un compte existant.'
          : 'Your progress is only saved on this device/browser — it would be lost if you switch or clear your cache. Click "🔗 Link account" to create an account (your current progress is kept) or sign back into an existing one.',
        'info');
    }, 3000);
  }
}

// détermine le pseudo effectif : pseudo choisi > pseudo Discord > partie locale de l'email
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
async function startGuestOrShowAuth() {
  if (!sb) { showAuthOverlay(false); updateUserBar(); return; } // Supabase pas configuré → mode local, inchangé
  showAuthOverlay(true);
  authShow('');
}

let tutorialAutoShown = false; // évite de relancer le tuto auto plusieurs fois si loadCloudSave est rappelé
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
  const { data, error } = await sb.from('game_saves').select('save_data').eq('user_id', currentUser.id).single();
  if (data && data.save_data && Object.keys(data.save_data).length) {
    applySaveState(data.save_data);
    $a('saveStatus').textContent = 'Sauvegarde chargée ✓';
  } else {
    $a('saveStatus').textContent = 'Nouveau personnage';
    // aucune sauvegarde cloud trouvée = personnage tout juste créé : on l'accueille à Velia et on
    // lance le tutoriel (petite pause pour laisser l'UI/le HUD finir de s'initialiser)
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
function offlineSaveKey() { return 'velia-idle-offline-save-' + (currentUser ? currentUser.id : ''); }
function saveToLocalOfflineCache() {
  if (!currentUser) return;
  try { localStorage.setItem(offlineSaveKey(), JSON.stringify({ save_data: getSaveState(), savedAt: Date.now() })); } catch(e) {}
  pendingOfflineSync = true;
}
function clearLocalOfflineCache() {
  if (!currentUser) return;
  try { localStorage.removeItem(offlineSaveKey()); } catch(e) {}
}
// pousse la dernière sauvegarde locale vers le cloud une fois le réseau revenu -- ne réécrit RIEN
// si aucune sauvegarde offline n'était en attente (pendingOfflineSync reste false par défaut).
async function flushOfflineSaveIfNeeded() {
  if (!pendingOfflineSync || !sb || !currentUser) return;
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(offlineSaveKey())); } catch(e) {}
  if (!cached || !cached.save_data) { pendingOfflineSync = false; return; }
  const { error } = await sb.from('game_saves').upsert({ user_id: currentUser.id, save_data: cached.save_data });
  if (!error) { pendingOfflineSync = false; clearLocalOfflineCache(); }
}
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
async function syncPlayerStats() {
  if (!sb || !currentUser || isGuest()) return; // classement réservé aux comptes vérifiés
  // "silver par heure" (2026-07-12, demande explicite : "compté exclusivement par les silver
  // recolté grace au token vendu") -- reflète le rythme de FARM réel, pas un gros coup de chance
  // ponctuel (succès/quête/boss/marché) qui gonflerait artificiellement ce classement.
  // Envoie désormais le RECORD PERSO à vie (S.bestSilverPerHour, voir hud() dans game-core.js) au
  // lieu d'un recalcul à chaque sync (2026-07-18, demande explicite : "le classement... toujours
  // le meilleur affiché... pas de synchro") -- l'ancien calcul reflétait juste le rythme instantané
  // de LA session en cours au moment du sync (pouvait redescendre d'une sync à l'autre, incohérent
  // avec best_kpm/best_zone_index ci-dessous qui sont déjà des records monotones).
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
      lvl: S.lvl,
      best_zone_index: S.maxZoneIdx,
      best_zone_name: ZONES[S.maxZoneIdx] ? ZONES[S.maxZoneIdx].name : '',
      silver_per_hour: Math.round(S.bestSilverPerHour||0),
      playtime_sec: Math.round(S.playtimeSec),
      best_item_name: best ? best.name : '',
      best_item_count: best ? best.count : 0,
      treasure_count: treasureCount,
      loyalty: Math.round(S.loyalty||0),
      best_kpm: Math.round((S.bestKpm||0)*10)/10,
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
// badge "⚠️ possiblement obsolète" retiré (2026-07-08, demande explicite : "Classement public :
// meilleur uniquement pas en temps reel donc oublie la synchro, on veut juste le meilleur") --
// n'avait de sens QUE quand les colonnes reflétaient un état COURANT (solde/équipement pouvant
// changer depuis la dernière synchro). Toutes les colonnes envoyées par syncPlayerStats sont
// désormais des records À VIE qui ne redescendent jamais (voir le commentaire au-dessus de
// syncPlayerStats) : une ligne n'est donc plus jamais "obsolète", juste éventuellement en retard
// d'un record pas encore synchronisé, ce qui ne justifie plus un avertissement.
function rankRows(rows, valueFn, fmtFn) {
  const sorted = [...rows].sort((a,b) => valueFn(b) - valueFn(a)).slice(0,20);
  return sorted.map((r,i) => `
    <tr class="${r.user_id===currentUser?.id ? 'isYou' : ''}">
      <td>#${i+1}</td><td><span class="plNameLink" data-uid="${r.user_id}" data-name="${escapeHtml(r.display_name||'?')}">${escapeHtml(r.display_name||'?')}</span></td><td>${fmtFn(r)}</td>
    </tr>`).join('') || `<tr><td colspan="3" class="admEmpty">${LANG==='fr'?'Pas encore de données':'No data yet'}</td></tr>`;
}
// clic sur un pseudo du classement : ouvre son stuff en lecture seule (demande explicite — voir
// get_player_gear côté serveur, n'expose QUE l'équipement, jamais le silver/inventaire complet)
function wirePlayerNameLinks() {
  $a('infoBody').querySelectorAll('.plNameLink').forEach(el => {
    el.onclick = e => { e.stopPropagation(); showPlayerGear(el.dataset.uid, el.dataset.name); };
  });
}
function readonlyPdSlotsHtml(equip, ids) {
  return ids.map(id => {
    const e = equip ? equip[id] : null;
    return `<div class="pdSlot ${e?'filled':'empty'}" title="${escapeHtml(SLOT_LABEL[id]||'')}${e ? ' — '+escapeHtml(e.name||'')+pdStatSuffix(e) : ' ('+(LANG==='fr'?'vide':'empty')+')'}">${pdSlotInnerHtmlFor(id, e)}</div>`;
  }).join('');
}
// liste TEXTE (nom + PA/PD/PV) de chaque pièce équipée — demande explicite : voir le nom de
// l'objet et son PA/PD directement quand on regarde le stuff d'un autre joueur, pas juste au survol
function readonlyGearListHtml(equip) {
  const allSlots = [...PD_BOTTOM, ...PD_LEFT, ...PD_RIGHT];
  const rows = allSlots.map(id => {
    const e = equip ? equip[id] : null;
    if (!e) return '';
    return `<tr><td>${escapeHtml(SLOT_LABEL[id]||id)}</td><td>${escapeHtml(e.name||'?')}</td><td>${pdStatSuffix(e).replace(/^ \(|\)$/g,'') || '—'}</td></tr>`;
  }).filter(Boolean).join('');
  if (!rows) return `<div class="admEmpty">${LANG==='fr'?'Aucun équipement':'No gear equipped'}</div>`;
  return `<table class="admTable"><thead><tr><th>${LANG==='fr'?'Emplacement':'Slot'}</th><th>${LANG==='fr'?'Objet':'Item'}</th><th>PA/PD/PV</th></tr></thead><tbody>${rows}</tbody></table>`;
}
async function showPlayerGear(userId, displayName) {
  if (!sb) return;
  openInfo((LANG==='fr'?'⚔️ Stuff de ':'⚔️ Gear of ')+displayName,
    `<div class="admEmpty">${LANG==='fr'?'Chargement…':'Loading…'}</div>`);
  const { data, error } = await sb.rpc('get_player_gear', { p_user_id: userId });
  if (error) { $a('infoBody').innerHTML = `<div class="admEmpty">${escapeHtml(error.message)}</div>`; return; }
  // bouton "Copier UUID" réservé à l'admin — demande explicite du 2026-07-05
  const copyBtn = isAdmin() ? `<button id="btnCopyGearUuid" style="margin-bottom:8px">📋 ${LANG==='fr'?'Copier UUID':'Copy UUID'}</button>` : '';
  $a('infoBody').innerHTML = copyBtn +
    `<div id="pdWeapons">${readonlyPdSlotsHtml(data, PD_BOTTOM)}</div>` +
    `<div id="paperdoll"><div class="pdCol">${readonlyPdSlotsHtml(data, PD_LEFT)}</div>` +
    `<div class="pdCenter"></div><div class="pdCol">${readonlyPdSlotsHtml(data, PD_RIGHT)}</div></div>` +
    readonlyGearListHtml(data);
  if (isAdmin()) {
    $a('btnCopyGearUuid').onclick = async () => {
      try { await navigator.clipboard.writeText(userId); } catch(e) {}
      floatTxt(P.x, P.y, 100, LANG==='fr'?'UUID copié ✓':'UUID copied ✓', { gold:true });
    };
  }
}
// inventaire complet (192 cases) d'un joueur, en lecture seule — réservé au staff. Ouvre dans une
// VRAIE fenêtre séparée du navigateur (pas dans le panneau admin) et revient automatiquement sur
// le panneau admin (dans la fenêtre principale) quand cette fenêtre popup se ferme — demande
// explicite du 2026-07-06
async function showPlayerInventoryWindow(userId, displayName) {
  if (!isAdmin() || !sb) return;
  const win = window.open('', '_blank', 'width=620,height=760');
  if (!win) { floatTxt(P.x, P.y, 100, LANG==='fr'?'Popup bloquée par le navigateur':'Popup blocked by browser', { hurt:true }); return; }
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
    `${c.locked?' disabled title="'+(LANG==='fr'?'Bientôt disponible':'Coming soon')+'"':''} data-cat="${c.id}">${c.locked?'🔒 ':''}${c.icon} ${c.label[LANG]}</button>`).join('');
  bodyEl.innerHTML =
    `<h3>${LANG==='fr'?'Équipement':'Gear'}</h3>` +
    `<div id="pdWeapons">${readonlyPdSlotsHtml(gear, PD_BOTTOM)}</div>` +
    `<div class="paperdollBox"><div class="pdCol">${readonlyPdSlotsHtml(gear, PD_LEFT)}</div>` +
    `<div class="pdCol" id="pdRight">${readonlyPdSlotsHtml(gear, PD_RIGHT)}</div></div>` +
    readonlyGearListHtml(gear) +
    `<h3>${LANG==='fr'?'Sac':'Bag'}</h3>` +
    `<div class="admSummary">${used} / ${inv.length || INV_SIZE} ${LANG==='fr'?'cases utilisées':'slots used'}</div>` +
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
// bascule entre onglets de catégorie repliés dans un même panneau (openInfo) — n'affiche
// qu'une seule catégorie à la fois, les autres restent en mémoire (display:none)
function wireCatTabs() {
  $a('infoBody').querySelectorAll('.catTab').forEach(btn => {
    btn.onclick = () => {
      $a('infoBody').querySelectorAll('.catTab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $a('infoBody').querySelectorAll('.catPane').forEach(p => p.style.display = p.dataset.cat === btn.dataset.cat ? '' : 'none');
    };
  });
}

// Chat (mondial/trade/annonce + mentions @joueur) -> voir chat.js (charge APRES ce fichier, voir index.html)
async function openLeaderboard() {
  if (!marketRequireAuth()) return;
  const { data, error } = await sb.from('player_stats').select('*').limit(500);
  const rows = data || [];

  const cats = [
    { id:'silver', icon:'💰', label:{fr:'Silver',en:'Silver'}, col:{fr:'Silver (total à vie)',en:'Silver (lifetime total)'},
      rows: rankRows(rows, r => Number(r.silver||0), r => fmt(r.silver||0)) },
    { id:'gs', icon:'⚔️', label:{fr:'Gearscore',en:'Gearscore'}, col:{fr:'Record GS (PA/PD)',en:'Record GS (AP/DP)'},
      rows: rankRows(rows, r => Number(r.gearscore||0), r => `${Math.round(r.gearscore||0)} (${(r.ap||0).toFixed(1)}/${(r.dp||0).toFixed(1)})`) },
    { id:'zone', icon:'🗺️', label:{fr:'Meilleure zone',en:'Best zone'}, col:{fr:'Zone',en:'Zone'},
      rows: rankRows(rows, r => Number(r.best_zone_index||0), r => tr(r.best_zone_name||'—')) },
    { id:'sh', icon:'⏱️', label:{fr:'Silver/heure',en:'Silver/hour'}, col:{fr:'Taux (zone)',en:'Rate (zone)'},
      rows: rankRows(rows, r => Number(r.silver_per_hour||0), r => `${fmt(r.silver_per_hour||0)}/h · ${tr(r.best_zone_name||'—')}`) },
    { id:'kpm', icon:'🏹', label:{fr:'Record kills/min',en:'Kills/min record'}, col:{fr:'Kills/min',en:'Kills/min'},
      rows: rankRows(rows, r => Number(r.best_kpm||0), r => `${(r.best_kpm||0).toFixed(1)}/min · ${tr(r.best_zone_name||'—')}`) },
    { id:'item', icon:'🎯', label:{fr:'Meilleur objet',en:'Best item'}, col:{fr:'Objet (qté)',en:'Item (qty)'},
      rows: rankRows(rows.filter(r => r.best_item_name), r => Number(r.best_item_count||0), r => `${tr(r.best_item_name)} (${fmt(r.best_item_count||0)})`) },
    { id:'treasure', icon:'🗺️', label:{fr:'Trésors',en:'Treasures'}, col:{fr:'Morceaux',en:'Pieces'},
      rows: rankRows(rows, r => Number(r.treasure_count||0), r => fmt(r.treasure_count||0)) },
  ];
  const tabsHtml = cats.map((c,i) => `<button class="catTab${i===0?' active':''}" data-cat="${c.id}">${c.icon} ${c.label[LANG]}</button>`).join('');
  const panesHtml = cats.map((c,i) => `
    <div class="catPane" data-cat="${c.id}"${i===0?'':' style="display:none"'}>
      <table class="admTable"><thead><tr><th>#</th><th>${LANG==='fr'?'Joueur':'Player'}</th><th>${c.col[LANG]}</th></tr></thead><tbody>${c.rows}</tbody></table>
    </div>`).join('');
  const html = `<div class="catTabs">${tabsHtml}</div>${panesHtml}` +
    `<div class="admSummary">${LANG==='fr'?'Classement des records personnels À VIE — jamais un instantané, ces valeurs ne redescendent jamais.':'Lifetime personal record leaderboard — never a live snapshot, these values never go down.'}</div>`;
  openInfo(LANG==='fr' ? '🏆 Classement' : '🏆 Leaderboard', html);
  wireCatTabs();
  wirePlayerNameLinks();
}
$a('btnLeaderboard').onclick = openLeaderboard;
$a('btnNotifCenter').onclick = openNotifCenter;
updateNotifBadge();
$a('btnAchievements').onclick = openAchievements;
// 2026-07-10 : remplace l'ancienne modale texte (openCompendium(), progression/notifications-quests.js,
// toujours utilisée comme repli si React est indisponible) par le nouveau Compendium React (3e
// exception React du projet, voir src/progression/compendium-react.js et CLAUDE.md §7).
$a('btnCompendium').onclick = openCompendiumReact;
$a('ztCompendium').onclick = openCompendiumReact;
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

// clic sur un objet au sol : déplace le perso jusque là. Prioritaire sur l'IA — tant qu'il n'est
// pas arrivé à l'endroit cliqué, l'IA ne reprend pas la main (voir P.manualTarget dans fsm())
cv.addEventListener('click', e => {
  const rect = cv.getBoundingClientRect();
  const sx = (e.clientX - rect.left) * (W / rect.width);
  const sy = (e.clientY - rect.top) * (H / rect.height);
  const candidates = drops.filter(l => !l.taken).map(l => {
    const s = toScreen(l.x, l.y);
    return { l, d: Math.hypot(sx - s.sx, sy - s.sy) };
  }).sort((a, b) => a.d - b.d);
  if (candidates.length && candidates[0].d < 34) {
    P.manualTarget = { x: candidates[0].l.x, y: candidates[0].l.y };
  }
});
$a('bossLobbyClose').onclick = () => showActivityPage('zone');
window.addEventListener('resize', () => { if (bossState.active) resizeBossCanvas(); });
updateNextBossMini();
setInterval(updateNextBossMini, 1000);

// ---------- présence : compteur "joueurs en ligne" (invités inclus) ----------
// zone_idx = -1 pour Velia (2026-07-16, demande explicite : liste des joueurs en ville) -- avant,
// NULL (aucune zone) ; -1 sert de sentinelle dédiée pour get_velia_players() côté serveur, sans
// jamais entrer en collision avec un vrai index de zone (toujours >= 0).
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
// Modal de reconnexion (2026-07-10) : enregistre une session AFK/hors-ligne terminée (fire-and-
// forget, l'affichage du modal ne doit jamais dépendre du succès de cet appel) + lit l'historique
// perso pour l'onglet "Historique des sessions" (voir src/core/reconnect-modal-react.js).
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
async function fetchAfkHistory() {
  if (!sb || !currentUser) return [];
  const { data, error } = await sb.rpc('get_afk_history', { p_limit: 12 });
  if (error) throw error;
  return data || [];
}
async function refreshOnlineCounter() {
  if (!sb) return;
  try {
    const { data, error } = await sb.rpc('get_online_counts', { p_window_seconds: 90 });
    if (error || !data || !data[0]) return;
    const { total, guests } = data[0];
    $a('onlineTotal').textContent = total;
    $a('onlineGuests').textContent = guests > 0 ? ` (${guests} ${LANG==='fr'?'invités':'guests'})` : '';
  } catch(e) {}
}
// nombre total de comptes inscrits (2026-07-05, demande explicite) : change rarement, pas besoin
// de le rafraîchir aussi souvent que le compteur "en ligne"
async function refreshRegisteredCounter() {
  if (!sb) return;
  try {
    const { data, error } = await sb.rpc('get_registered_count');
    if (error || data == null) return;
    $a('registeredTotal').textContent = data;
  } catch(e) {}
}
setInterval(heartbeatPresence, 20000);
setInterval(refreshOnlineCounter, 20000);
setInterval(refreshZonePlayerCounts, 20000);
setInterval(refreshAdminZone, 20000);
refreshAdminZone();
setInterval(refreshVeliaPlayers, 20000);
setInterval(refreshLiveBoss, 20000);
refreshRegisteredCounter();
setInterval(refreshRegisteredCounter, 5 * 60000);

// ---------- panneau "Mon compte" : identité + parrainage (comptes vérifiés uniquement) ----------
async function openAccountPanel() {
  if (!sb || !currentUser) return;
  if (isGuest()) {
    openInfo(LANG==='fr' ? '👤 Mon compte' : '👤 My account', `
      <p>${LANG==='fr'
        ? 'Tu joues en mode invité. Lie un compte vérifié (bouton "🔗 Lier un compte") pour accéder au parrainage, au marché et au classement — ta progression actuelle sera conservée.'
        : 'You\'re playing as a guest. Link a verified account (the "🔗 Link account" button) to access referrals, the market and the leaderboard — your current progress will be kept.'}</p>
      <h3>🧹 ${LANG==='fr'?'Cache du jeu':'Game cache'}</h3>
      <p class="mHint">${LANG==='fr'
        ? 'En cas d\'affichage étrange après une mise à jour, ce bouton vide le cache du navigateur pour les fichiers du jeu puis recharge la page. Ta progression n\'est jamais touchée.'
        : 'If something looks wrong after an update, this button clears the browser\'s cache for the game\'s files then reloads the page. Your progress is never affected.'}</p>
      <button id="btnClearCache">🧹 ${LANG==='fr'?'Vider le cache et recharger':'Clear cache and reload'}</button>
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
  `).join('') || `<tr><td colspan="4" class="admEmpty">${LANG==='fr'?'Aucun filleul pour l\'instant':'No referrals yet'}</td></tr>`;

  const rules = LANG==='fr' ? [
    'Un compte ne peut être parrainé qu\'une seule fois.',
    'Le parrainage doit se faire dans les 3 jours suivant la création du compte du filleul — impossible passé ce délai.',
    'Impossible d\'utiliser ton propre code.',
    'Impossible de parrainer ton propre parrain.',
    'Pas de récompense pour l\'instant — juste un suivi de qui tu as parrainé.',
  ] : [
    'An account can only be referred once.',
    'Referring must happen within 3 days of the referred account\'s creation — impossible afterward.',
    'You cannot use your own code.',
    'You cannot refer your own referrer.',
    'No reward for now — this is just a tracker of who you\'ve referred.',
  ];

  const hasDiscord = !!discordIdentity(currentUser);
  const hasGoogle = !!providerIdentity(currentUser, 'google');
  const hasGithub = !!providerIdentity(currentUser, 'github');
  const hasTwitter = !!providerIdentity(currentUser, 'twitter');

  const html = `
    <div class="admSummary">${LANG==='fr'?'Compte':'Account'} : <b>${currentUser.email || '—'}</b></div>

    <h3>${LANG==='fr'?'📛 Pseudo':'📛 Nickname'}</h3>
    <p class="mHint">${LANG==='fr'
      ? 'Visible partout dans le classement. Le changer met à jour la même ligne, ça n\'en recrée jamais une nouvelle.'
      : 'Shown everywhere in the leaderboard. Changing it updates the same row, it never creates a new one.'}</p>
    <input type="text" id="pseudoInput" value="${myPseudo || ''}" maxlength="20">
    <button id="btnSavePseudo">${LANG==='fr'?'Enregistrer':'Save'}</button>
    <div id="pseudoMsg"></div>

    <h3>💬 Discord</h3>
    ${hasDiscord
      ? `<p class="mHint">${LANG==='fr'?'✅ Compte Discord connecté.':'✅ Discord account connected.'}</p>`
      : `<button id="btnLinkDiscord" class="discordBtn">🎮 ${LANG==='fr'?'Connecter Discord':'Connect Discord'}</button>`}

    <h3>🔵 Google</h3>
    ${hasGoogle
      ? `<p class="mHint">${LANG==='fr'?'✅ Compte Google connecté.':'✅ Google account connected.'}</p>`
      : `<button id="btnLinkGoogle" class="googleBtn">🔵 ${LANG==='fr'?'Connecter Google':'Connect Google'}</button>`}

    <h3>🐙 GitHub</h3>
    ${hasGithub
      ? `<p class="mHint">${LANG==='fr'?'✅ Compte GitHub connecté.':'✅ GitHub account connected.'}</p>`
      : `<button id="btnLinkGithub" class="githubBtn">🐙 ${LANG==='fr'?'Connecter GitHub':'Connect GitHub'}</button>`}

    <h3>🐦 Twitter/X</h3>
    ${hasTwitter
      ? `<p class="mHint">${LANG==='fr'?'✅ Compte Twitter/X connecté.':'✅ Twitter/X account connected.'}</p>`
      : `<button id="btnLinkTwitter" class="twitterBtn">🐦 ${LANG==='fr'?'Connecter Twitter/X':'Connect Twitter/X'}</button>`}

    <h3>${LANG==='fr'?'🎁 Parrainage':'🎁 Referrals'}</h3>
    <div id="refCodeBox">${code}</div>
    <button id="btnCopyRefCode">${LANG==='fr'?'📋 Copier le code':'📋 Copy code'}</button>
    <div class="admSummary" style="margin-top:14px">${LANG==='fr'?'Tu as un code d\'un autre joueur ?':'Got someone else\'s code?'}</div>
    <input type="text" id="refCodeInput" placeholder="${LANG==='fr'?'Code de parrainage':'Referral code'}" maxlength="12">
    <button id="btnApplyRefCode">${LANG==='fr'?'Valider':'Apply'}</button>
    <div id="refMsg"></div>
    <ul class="refRules">${rules.map(r => `<li>${r}</li>`).join('')}</ul>

    <h3>${LANG==='fr'?'👥 Tes filleuls':'👥 Your referrals'} (<span style="color:var(--gold)">${count}</span>)</h3>
    <table class="admTable">
      <thead><tr><th>${LANG==='fr'?'Joueur':'Player'}</th><th>${LANG==='fr'?'Niv.':'Lvl'}</th><th>GS</th><th>Silver</th></tr></thead>
      <tbody>${refRows}</tbody>
    </table>

    <h3>🧹 ${LANG==='fr'?'Cache du jeu':'Game cache'}</h3>
    <p class="mHint">${LANG==='fr'
      ? 'En cas d\'affichage étrange après une mise à jour, ce bouton vide le cache du navigateur pour les fichiers du jeu puis recharge la page. Ta progression n\'est jamais touchée.'
      : 'If something looks wrong after an update, this button clears the browser\'s cache for the game\'s files then reloads the page. Your progress is never affected.'}</p>
    <button id="btnClearCache">🧹 ${LANG==='fr'?'Vider le cache et recharger':'Clear cache and reload'}</button>

  `;
  openInfo(LANG==='fr' ? '👤 Mon compte' : '👤 My account', html);
  $a('btnClearCache').onclick = clearGameCache;
  $a('btnSavePseudo').onclick = async () => {
    const val = $a('pseudoInput').value.trim();
    const msg = $a('pseudoMsg');
    const { error } = await sb.rpc('set_pseudo', { p_pseudo: val });
    if (error) { msg.textContent = error.message; msg.className = 'fail'; return; }
    myPseudo = val;
    updatePseudoDisplay();
    msg.textContent = LANG==='fr'?'Pseudo enregistré !':'Nickname saved!'; msg.className = 'ok';
    syncPlayerStats(); // propage immédiatement au classement, sans attendre la prochaine synchro
  };
  if (!hasDiscord) $a('btnLinkDiscord').onclick = linkDiscordAccount;
  if (!hasGoogle) $a('btnLinkGoogle').onclick = linkGoogleAccount;
  if (!hasGithub) $a('btnLinkGithub').onclick = linkGithubAccount;
  if (!hasTwitter) $a('btnLinkTwitter').onclick = linkTwitterAccount;
  $a('btnCopyRefCode').onclick = async () => {
    try { await navigator.clipboard.writeText(code); } catch(e) {}
    $a('btnCopyRefCode').textContent = LANG==='fr' ? '✓ Copié !' : '✓ Copied!';
  };
  $a('btnApplyRefCode').onclick = async () => {
    const val = $a('refCodeInput').value.trim();
    const msg = $a('refMsg');
    if (!val) { msg.textContent = LANG==='fr'?'Entre un code.':'Enter a code.'; msg.className = 'fail'; return; }
    const { error } = await sb.rpc('apply_referral_code', { p_code: val });
    if (error) { msg.textContent = error.message; msg.className = 'fail'; return; }
    msg.textContent = LANG==='fr'?'Code appliqué !':'Code applied!'; msg.className = 'ok';
  };
}
$a('btnAccount').onclick = openAccountPanel;

let cloudSaveInterval = null;
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

$a('btnSignIn').onclick = doSignIn;
$a('btnSignUp').onclick = doSignUp;
$a('btnForgotPass').onclick = doForgotPassword;
document.querySelectorAll('.authLangBtn').forEach(b => {
  b.onclick = () => {
    LANG = b.dataset.lang;
    try { localStorage.setItem('velia-idle-lang', LANG); } catch(e) {}
    applyI18n();
  };
});
$a('btnSignInDiscord').onclick = doSignInDiscord;
$a('btnSignInGoogle').onclick = doSignInGoogle;
$a('btnSignInGithub').onclick = doSignInGithub;
$a('btnSignInTwitter').onclick = doSignInTwitter;
$a('btnClearCacheAuth').onclick = clearGameCache;
$a('btnLogout').onclick = doLogout;
$a('btnCopyUuid').onclick = async () => {
  if (!currentUser) return;
  try { await navigator.clipboard.writeText(currentUser.id); } catch(e) {}
  const hint = $a('uuidCopyHint'); if (!hint) return;
  hint.innerHTML = LANG==='fr' ? '✓ UUID copié !' : '✓ UUID copied!';
  setTimeout(() => { hint.innerHTML = '📋 ' + (LANG==='fr'?'Copier':'Copy') + ' UUID'; }, 1200);
};
$a('btnLinkAccount').onclick = () => {
  // précise que "Se connecter" reprend un compte EXISTANT (contrairement à "Créer un
  // compte" qui démarre une nouvelle progression) — source de confusion signalée en test
  $a('authSub').textContent = LANG==='fr'
    ? 'Compte existant ? clique "Se connecter". Sinon "Créer un compte" (remplace ta progression invité).'
    : 'Existing account? click "Sign in". Otherwise "Create account" (replaces your guest progress).';
  showAuthOverlay(true);
};
$a('closeAuth').onclick = () => showAuthOverlay(false);
let authMouseDownOnBackdrop = false;
$a('authOverlay').addEventListener('mousedown', e => { authMouseDownOnBackdrop = (e.target.id === 'authOverlay'); });
$a('authOverlay').addEventListener('click', e => { if (e.target.id === 'authOverlay' && authMouseDownOnBackdrop && currentUser) showAuthOverlay(false); });
$a('authPass').addEventListener('keydown', e => { if (e.key === 'Enter') doSignIn(); });

// au chargement : session déjà active ? sinon on démarre en invité (jamais de mur bloquant)
(async () => {
  if (!sb) { showAuthOverlay(false); updateUserBar(); authShow(''); saveReady = true; return; } // Supabase pas configuré → jeu jouable directement (mode local)
  const { data } = await sb.auth.getSession();
  if (data.session) onAuthed(data.session.user);
  else await startGuestOrShowAuth();
})();

// Marche (Hotel des ventes + Marche commun v2, carnet d'ordres) -> voir market.js (charge APRES ce fichier, voir index.html)
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
  btnNotifCenter: { fr:'🔔 Notifications', en:'🔔 Notifications' },
  btnPatch: { fr:'📜 Notes de version', en:'📜 Patch Notes' },
  btnMarketLbl: { fr:'🏛️ Marché commun', en:'🏛️ Common Market' },
  marketConstructionBanner: { fr:'🚧 BETA — Marché en construction, encore peu fonctionnel : bugs et changements à prévoir', en:'🚧 BETA — Market under construction, still not very functional: expect bugs and changes' },
  btnLogout: { fr:'🚪 Déconnexion', en:'🚪 Log out' },
  authMobileBadge: { fr:'📱 BETA — Compatible mobile & tablette', en:'📱 BETA — Mobile & tablet compatible' },
  authSub: { fr:'Connecte-toi avec un vrai compte pour accéder au Marché et au Classement', en:'Sign in with a real account to access the Market and Leaderboard' },
  btnLinkAccount: { fr:'🔗 Lier un compte', en:'🔗 Link account' },
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
  footerText: { fr:"Projet de fan gratuit, non officiel et fourni tel quel, sans garantie ni responsabilité (bugs, pertes de progression, interruptions...) — utilisation à tes risques. Noms/styles inspirés de Black Desert (propriété de Pearl Abyss le cas échéant) ; visuels 100% originaux, aucune affiliation.", en:"Free, unofficial fan project provided as-is, with no warranty or liability (bugs, progress loss, downtime...) — use at your own risk. Names/styles inspired by Black Desert (Pearl Abyss's property where applicable); visuals are 100% original, no affiliation." },
  authPassPh: { fr:'Mot de passe', en:'Password' },
  authPseudoPh: { fr:'Pseudo (pour la création de compte)', en:'Nickname (for account creation)' },
  btnSignIn: { fr:'Se connecter', en:'Sign in' },
  btnSignUp: { fr:'Créer un compte', en:'Create account' },
  btnForgotPass: { fr:'Mot de passe oublié ?', en:'Forgot password?' },
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
};
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (I18N[key]) el.textContent = I18N[key][LANG];
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const key = el.getAttribute('data-i18n-ph');
    if (I18N[key]) el.setAttribute('placeholder', I18N[key][LANG]);
  });
  $a('langThumb').classList.toggle('en', LANG === 'en');
  document.querySelectorAll('.langOpt').forEach(el => el.classList.toggle('active', el.dataset.lang === LANG));
  document.querySelectorAll('.authLangBtn').forEach(el => el.classList.toggle('active', el.dataset.lang === LANG));
  document.documentElement.lang = LANG;
  refreshInvUI(); // redessine loot table / stats mode / badges avec les noms traduits
  hudFast();
}
$a('langToggle').onclick = () => {
  LANG = LANG === 'fr' ? 'en' : 'fr';
  try { localStorage.setItem('velia-idle-lang', LANG); } catch(e) {}
  applyI18n();
};

// ---------- position du menu latéral (gauche/droite), persistée ----------
let menuSide = 'left';
try { menuSide = localStorage.getItem('velia-idle-menuside') || 'left'; } catch(e) {}
function applyMenuSide() {
  $a('sideMenu').classList.toggle('onRight', menuSide === 'right');
  $a('menuSideThumb').classList.toggle('right', menuSide === 'right');
  document.querySelectorAll('.menuSideOpt').forEach(el => el.classList.toggle('active', el.dataset.side === menuSide));
}
$a('menuSideToggle').onclick = () => {
  menuSide = menuSide === 'left' ? 'right' : 'left';
  try { localStorage.setItem('velia-idle-menuside', menuSide); } catch(e) {}
  applyMenuSide();
};
applyMenuSide();

// ---------- replier/déplier le menu latéral, persisté ----------
let sideMenuCollapsed = isMobileViewport();
try {
  const saved = localStorage.getItem('velia-idle-menu-collapsed');
  if (saved !== null) sideMenuCollapsed = saved === '1'; // préférence explicite du joueur > défaut auto
} catch(e) {}
function applyMenuCollapse() {
  $a('sideMenu').classList.toggle('collapsed', sideMenuCollapsed);
  $a('btnCollapseMenu').textContent = sideMenuCollapsed ? '▶' : '◀';
}
$a('btnCollapseMenu').onclick = () => {
  sideMenuCollapsed = !sideMenuCollapsed;
  try { localStorage.setItem('velia-idle-menu-collapsed', sideMenuCollapsed ? '1' : '0'); } catch(e) {}
  applyMenuCollapse();
};
applyMenuCollapse();

// (NAME_EN et tr() sont maintenant déclarés en haut du script)

// PATCH_NOTES est desormais defini dans patch-notes-data.js (charge AVANT ce fichier, voir index.html)

// ============================================================
// DÉTECTION DE NOUVELLE VERSION — prévient le joueur qu'une maj a été déployée
// (on refetch périodiquement index.html et on compare la première version du tableau)
// ============================================================
const CURRENT_VERSION = PATCH_NOTES[0].v;
$a('clientVersionNum').textContent = CURRENT_VERSION;
let updateToastShown = false;
async function checkForUpdate() {
  if (updateToastShown) return;
  try {
    // PATCH_NOTES vit dans meta/patch-notes-data.js depuis le 2026-07-14 (découpage de
    // game-supabase.js), déplacé dans meta/ le 2026-07-08 (réorganisation par dossiers) -- ce
    // check doit fetch CE fichier, pas game-supabase.js (qui ne contient plus le tableau), sinon
    // la regex ne matche plus jamais et le toast ne s'affiche plus
    const res = await fetch('./meta/patch-notes-data.js?_=' + Date.now(), { cache: 'no-store' });
    const text = await res.text();
    const m = text.match(/const PATCH_NOTES = \[\s*\{\s*v:\s*'([^']+)'/);
    if (m && m[1] !== CURRENT_VERSION) {
      updateToastShown = true;
      $a('updToastVer').textContent = '(' + m[1] + ')';
      $a('updateToast').classList.add('show');
    }
  } catch (e) {}
}
$a('btnReloadUpdate').onclick = () => location.reload();
// vide le cache du navigateur pour les fichiers du jeu (utile si une maj ne s'affiche pas
// correctement) -- ne touche jamais la sauvegarde (Supabase ni le fallback localStorage)
async function clearGameCache() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
  } catch (e) {}
  location.href = location.pathname + '?nocache=' + Date.now();
}
setInterval(checkForUpdate, 60 * 1000); // toutes les 60s (déploiement GitHub Pages ~1-2 min)
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate(); });
window.addEventListener('focus', checkForUpdate);
setTimeout(checkForUpdate, 15000); // premier check peu après le chargement

// ============================================================
// WIKI — règles maison qui diffèrent du vrai BDO
// ============================================================
// Wiki organisé en catégories (comme Admin / Classement / Quêtes) — chaque section a son onglet
const WIKI_SECTIONS = [
  { id:'combat', icon:'⚔️', label:{fr:'Combat & Zones',en:'Combat & Zones'},
    fr:`<h3>PA / PD par zone (comme dans le vrai jeu)</h3>
      <p>Chaque zone a un <b>PA requis</b> et un <b>PD requis</b> affichés directement. Les deux stats jouent des rôles séparés :</p>
      <ul>
        <li><b>Pas assez de PA</b> → tes sorts infligent moins de dégâts (jusqu'à -75% si très sous-PA)</li>
        <li><b>Pas assez de PD</b> → tu encaisses beaucoup plus de dégâts (jusqu'à 4,5×), risque de K.O. élevé</li>
        <li>Au-dessus des deux → dégâts et réduction bonus, plafonnés pour éviter le farm abusif</li>
        <li>Le loot suit le pire des deux ratios : ta pénalité de loot est calculée sur <b>le plus faible</b> de tes 2 ratios (PA effectif / PA requis, PD effectif / PD requis), jamais la moyenne ni le meilleur. Exemple : un PA parfait (ratio 1.5) mais un PD à moitié du requis (ratio 0.5) → ton loot est pénalisé <b>comme si tu étais à 0.5 partout</b>, le PA excédentaire ne compense rien. En dessous de <b>90%</b> du requis → loot réduit (jusqu'à -70%) ; dès <b>90%</b> du requis (pas besoin d'atteindre 100%) OU overstuff → loot toujours normal (100%), plus aucun bonus ni malus au-delà</li>
        <li><b>ZONE DANGEREUSE</b> (très sous-PA/PD) → tu es ralenti, et les monstres qui t'ont repéré deviennent plus rapides pour te rattraper</li>
      </ul>
      <h3>Mana</h3>
      <p>Chaque sort coûte de la mana, qui se régénère passivement même hors combat. Une potion de mana (auto-bue sous 30%) complète la potion de PV si tu es à court.</p>
      <h3>Loot progressif</h3>
      <p>Les taux de drop sont <b>volontairement décroissants</b> zone par zone : le matériau d'optimisation passe d'environ 55% en toute première zone à environ 5-7% en fin de jeu, les composants de craft endgame (Fragment de mémoire, Marbre du Dieu déchu...) descendent eux sous 1%.</p>
      <h3>Sac plein (192/192)</h3>
      <p>Le silver n'occupe jamais de place (toujours ramassé). Un matériau/bijou déjà en stack dans ton sac continue lui aussi d'être ramassé tant que ce stack n'est pas à son maximum, même sac plein. Seuls les <b>nouveaux</b> objets qui auraient besoin d'une case libre restent au sol — un bandeau rouge ⚠ t'en avertit, sans jamais t'empêcher de continuer à farmer.</p>
      <h3>Zones groupées par palier de stuff</h3>
      <p>Les 16 zones de Velia sont regroupées par palier d'équipement (Naru/gris, Tuvala/blanc, Yuria/vert, Grunil/bleu — 4 zones chacun) — la couleur de l'en-tête et de la bordure correspond à la couleur du stuff qu'on y trouve, la même que dans l'inventaire.</p>
      <p>Chaque zone garantit une seule pièce d'armure précise (casque/plastron/gants sur les 3 premières zones du palier, bottes sur la 4e) ; côté arme, 3 des 4 zones du palier garantissent chacune un type différent (arme principale/secondaire/éveil, jamais deux fois le même), seule la 2<sup>e</sup> zone du palier n'a aucune arme garantie. Clique l'icône 👁 d'une zone pour voir exactement laquelle.</p>
      <h3>Trésor de Velia</h3>
      <p>Toutes les zones de Velia peuvent aussi looter des morceaux du <b>Trésor de Velia</b> — 2 objets collectibles très rares (0,17% et 0,0005% par kill), rangés dans leur propre onglet d'inventaire 🗺️. 100 "Bout du trésor de Velia" se combinent (onglet Assemblage) en 1 "Trésor de Velia" complet, revendable à très haute valeur. Une recette secrète existe aussi (1 Trésor de Velia + 1 de Heidel + 1 de Calpheon → coffret bonus), mais reste hors de portée tant que Heidel/Calpheon ne sont pas débloqués.</p>
      <h3>Boss mondiaux partagés</h3>
      <p>Le <b>Kzarka</b> du planning horaire (12h45/19h45/23h45 tous les jours, 15h45 le week-end) a des <b>PV réellement partagés entre tous les joueurs</b>, exactement comme un boss lancé par l'admin : tout le monde tape le même pool de PV et se voit dans l'arène. Le <b>Vell</b>, boss hebdomadaire bien plus rare et plus coriace (jeudi 12h00 et dimanche 16h45 — horaires in-game, soit -15 min par rapport aux horaires réels garmoth.com de 12h15/17h00), fonctionne sur le même principe.</p>
      <h3>Où farmer un socle vide ?</h3>
      <p>Clique un socle d'équipement <b>vide</b> sur la poupée : la ou les zones qui lootent cet objet s'illuminent d'un halo doré dans la liste des zones, et un bouton te téléporte directement dessus. Une zone dangereuse pour ton stuff actuel n'est jamais proposée tant qu'une alternative plus sûre existe.</p>`,
    en:`<h3>AP / DP per zone (like the real game)</h3>
      <p>Every zone has a <b>required AP</b> and <b>required DP</b>. The two stats play separate roles:</p>
      <ul>
        <li><b>Not enough AP</b> → your spells deal less damage (up to -75%)</li>
        <li><b>Not enough DP</b> → you take a lot more damage (up to 4.5×), high KO risk</li>
        <li>Above both → bonus damage and reduction, capped to prevent overfarming</li>
        <li>Loot follows the worse of the two ratios: your loot penalty is calculated on <b>whichever is lowest</b> of your 2 ratios (effective AP / required AP, effective DP / required DP), never the average or the best one. Example: perfect AP (ratio 1.5) but DP at half the requirement (ratio 0.5) → your loot is penalized <b>as if you were at 0.5 everywhere</b>, the excess AP compensates for nothing. Below <b>90%</b> of the requirement → reduced loot (up to -70%); from <b>90%</b> of the requirement onward (no need to reach 100%) OR overgeared → loot always normal (100%), no bonus or penalty beyond that</li>
        <li><b>DANGEROUS ZONE</b> (very under-AP/DP) → you are slowed down, and monsters that spotted you become faster to catch up</li>
      </ul>
      <h3>Mana</h3>
      <p>Every skill costs mana, which regenerates passively even out of combat. A mana potion (auto-drunk under 30%) joins the HP potion if you run low.</p>
      <h3>Progressive loot</h3>
      <p>Drop rates are <b>intentionally decreasing</b> zone by zone: the enhancement material goes from about 55% in the very first zone down to about 5-7% at endgame, while endgame crafting components (Memory Fragment, Fallen God's Marble...) drop under 1%.</p>
      <h3>Full bag (192/192)</h3>
      <p>Silver never takes up space (always picked up). A material/jewelry already stacked in your bag keeps getting picked up as long as that stack isn't full, even with a full bag. Only <b>new</b> items that would need a free slot stay on the ground — a red ⚠ banner warns you, without ever stopping you from farming.</p>
      <h3>Zones grouped by gear tier</h3>
      <p>The 16 Velia zones are grouped by gear tier (Naru/grey, Tuvala/white, Yuria/green, Grunil/blue — 4 zones each) — the header and border color match the gear color found there, same as in the inventory.</p>
      <p>Every zone guarantees exactly one specific armor piece (helmet/armor/gloves on the tier's first 3 zones, boots on the 4th); for weapons, 3 of the tier's 4 zones each guarantee a different type (main/secondary/awakening, never the same type twice) — only the tier's 2<sup>nd</sup> zone has no guaranteed weapon. Click a zone's 👁 icon to see exactly which one.</p>
      <h3>Velia Treasure</h3>
      <p>All Velia zones can also drop pieces of the <b>Velia Treasure</b> — 2 very rare collectibles (0.17% and 0.0005% per kill), stored in their own 🗺️ inventory tab. 100 "Velia Treasure Piece" combine (Assembly tab) into 1 complete "Velia Treasure", sellable for a very high value. A secret recipe also exists (1 Velia Treasure + 1 Heidel Treasure + 1 Calpheon Treasure → bonus chest), but stays out of reach until Heidel/Calpheon are unlocked.</p>
      <h3>Shared world bosses</h3>
      <p>The scheduled <b>Kzarka</b> (12:45pm/7:45pm/11:45pm daily, 3:45pm on weekends) has <b>truly shared HP across all players</b>, exactly like an admin-spawned boss: everyone hits the same HP pool and is visible in the arena. The <b>Vell</b>, a much rarer and tougher weekly boss (Thursday 12:00pm and Sunday 4:45pm in-game — 15 minutes earlier than the real garmoth.com schedule of 12:15pm/5:00pm), works the same way.</p>
      <h3>Where to farm an empty slot?</h3>
      <p>Click an <b>empty</b> equipment slot on the paperdoll: the zone(s) that drop that item light up with a gold halo in the zone list, plus a button teleports you there directly. A zone too dangerous for your current gear is never suggested while a safer alternative exists.</p>` },
  { id:'enh', icon:'✦', label:{fr:'Optimisation',en:'Enhancement'},
    fr:`<h3>Enchantement</h3>
      <p>+1 à +7 toujours réussi. <b>+8 à +15</b> sont probabilistes (45% → 5%) et peuvent rétrograder en cas d'échec, mais jamais sous +7.</p>
      <p>Puis <b>PRI/DUO/TRI/TET/PEN</b> suivent des chances fixes (12%/9%/6%/3%/1,2%). À partir de PRI, un échec fait <b>rétrograder d'un palier</b> (ex : DUO → PRI) — mais <b>jamais sous PRI</b> : tu ne retombes plus jamais à +15.</p>
      <p>Pas de failstack caché : ce que tu vois à l'écran est la chance réelle. Chaque pièce a son propre niveau, indépendant.</p>
      <p>La <b>Poussière d'esprit ancien</b> ne sert pas à optimiser directement : c'est un composant pour fabriquer des Pierres de Caphras.</p>
      <p>La <b>Pierre de Cron</b> (1% de drop, 1 à 3 unités, toutes zones) protège d'une rétrogradation en cas d'échec — à toi de décider si tu veux l'utiliser via la case à cocher à côté du matériau chargé, elle n'est plus consommée automatiquement. Son coût dépend du palier de la pièce protégée : 1 (gris), 2 (blanc), 3 (vert), 4 (bleu).</p>
      <p>Astuce : clique le petit 🔧 sur une pièce équipée pour charger directement CETTE pièce dans le panneau d'optimisation.</p>`,
    en:`<h3>Enhancement</h3>
      <p>+1 to +7 always succeed. <b>+8 to +15</b> are probabilistic (45% → 5%) and can downgrade on failure, but never below +7.</p>
      <p>Then <b>PRI/DUO/TRI/TET/PEN</b> follow fixed chances (12%/9%/6%/3%/1.2%). From PRI, a failure <b>downgrades one tier</b> (e.g. DUO → PRI) — but <b>never below PRI</b>: you never drop back to +15.</p>
      <p>No hidden failstack: what you see is the real chance. Each piece has its own independent level.</p>
      <p><b>Ancient Spirit Dust</b> isn't used to enhance directly: it's a component to craft Caphras Stones.</p>
      <p>The <b>Cron Stone</b> (1% drop rate, 1 to 3 units, every zone) protects against a downgrade on failure — you decide whether to use it via the checkbox next to the loaded material, it's no longer consumed automatically. Its cost depends on the protected piece's tier: 1 (grey), 2 (white), 3 (green), 4 (blue).</p>
      <p>Tip: click the small 🔧 on an equipped piece to load THAT piece directly into the enhancement panel.</p>` },
  { id:'market', icon:'🏛️', label:{fr:'Marché',en:'Market'},
    fr:`<h3>🚧 BETA — en construction</h3>
      <p>Le Marché est encore <b>peu fonctionnel</b> : attends-toi à des bugs, des changements et des remises à zéro pendant son développement. Ne t'y fie pas encore pour ta progression.</p>
      <h3>Marché commun</h3>
      <p>Vrai carnet d'ordres : place un ordre d'achat ou de vente à ton prix, apparié automatiquement avec un ordre en face dès que les prix se croisent (pas de prix fixe imposé).</p>
      <p><b>Taxe de vente : 35%</b> — prélevée uniquement sur le vendeur, qui touche 65% du prix de vente ; l'acheteur paie toujours le prix affiché.</p>`,
    en:`<h3>🚧 BETA — under construction</h3>
      <p>The Market is still <b>not very functional</b>: expect bugs, changes and resets while it's being developed. Don't rely on it for your progress yet.</p>
      <h3>Common market</h3>
      <p>A real order book: place a buy or sell order at your own price, automatically matched with an opposing order once prices cross (no fixed price imposed).</p>
      <p><b>Sales tax: 35%</b> — charged only to the seller, who receives 65% of the sale price; the buyer always pays the listed price.</p>` },
  { id:'account', icon:'💾', label:{fr:'Compte & Sauvegarde',en:'Account & Save'},
    fr:`<h3>Sauvegarde</h3>
      <p>Sauvegarde cloud automatique toutes les 30 s, plus une sauvegarde locale de secours. En cas de déconnexion brutale, jusqu'à 30 s de progression peuvent être perdues.</p>
      <h3>Loyalties & Courrier</h3>
      <p>Tu reçois 200 Loyalties par jour dans ton 📬 Courrier — elles s'y empilent en permanence et ne se perdent jamais.</p>`,
    en:`<h3>Save system</h3>
      <p>Automatic cloud save every 30 s, plus a local backup. On an abrupt disconnect, up to 30 s of progress may be lost.</p>
      <h3>Loyalties & Mailbox</h3>
      <p>You get 200 Loyalties per day in your 📬 Mailbox — they stack there permanently and never get lost.</p>` },
  { id:'about', icon:'ℹ️', label:{fr:'À propos',en:'About'},
    // section relue et remise à jour le 2026-07-08 (demande explicite : "wiki = a propos a relire
    // et modifier selon ce qu'on fait") -- l'ancienne version ne contenait que la mention légale/
    // crédits, sans jamais décrire ce qu'est devenu le jeu depuis (marché, loyalty, boss Vell,
    // Trésor de Velia, Compendium...). À maintenir à jour au même titre que les autres sections
    // Wiki à chaque fonctionnalité majeure (voir mémoire "Mettre à jour Wiki/Succès/Compendium").
    fr:`<h3>Le jeu en un coup d'œil</h3>
      <p>Velia Idle est un jeu idle de farm automatique : ton personnage combat, loote et progresse seul dans des zones classées par palier de stuff (Naru/gris → Tuvala/blanc → Yuria/vert → Grunil/bleu), avec enchantement (+1 à PEN), un Compendium de collection à vie, 2 World Bosses partagés (Kzarka quotidien, Vell hebdomadaire), un Marché commun entre joueurs (taxe de vente 35%), un système de Loyalty (200/jour), un Trésor de Velia à assembler, une sauvegarde cloud, un classement et un chat — le tout géré par un backend Supabase.</p>
      <h3>Noms & identité visuelle</h3>
      <p>Les noms de zones, monstres et objets sont inspirés de Black Desert Online pour l'ambiance, tout comme certains styles de jeu et mécaniques — ils restent, le cas échéant, la propriété de Pearl Abyss. Les icônes et visuels, eux, sont des créations originales de style fan : ils s'inspirent visuellement du jeu mais ne réutilisent aucun asset réel.</p>
      <p>Black Desert ainsi que toutes les images, illustrations, icônes, noms et données du jeu sont la propriété de Pearl Abyss. Projet de fan non officiel et gratuit, sans aucune affiliation ni partenariat avec Pearl Abyss.</p>`,
    en:`<h3>The game at a glance</h3>
      <p>Velia Idle is an automatic idle-farming game: your character fights, loots and progresses on its own through zones ranked by gear tier (Naru/grey → Tuvala/white → Yuria/green → Grunil/blue), with enhancement (+1 to PEN), a lifetime-collection Compendium, 2 shared World Bosses (daily Kzarka, weekly Vell), a player-to-player Common Market (35% sales tax), a Loyalty system (200/day), an assemblable Velia Treasure, cloud saves, a leaderboard and chat — all backed by Supabase.</p>
      <h3>Names & visual identity</h3>
      <p>Zone, monster and item names are inspired by Black Desert Online for atmosphere, as are some game styles and mechanics — these remain, where applicable, the property of Pearl Abyss. Icons and visuals, on the other hand, are original fan-style creations: visually inspired by the game but reusing no real assets.</p>
      <p>Black Desert, along with all in-game images, illustrations, icons, names and data, is the property of Pearl Abyss. Unofficial, free fan project, with no affiliation or partnership with Pearl Abyss.</p>` },
  { id:'tuto', icon:'🔰', label:{fr:'Tutoriel',en:'Tutorial'}, tuto:true },
];
// génère le codex des objets à partir des données du jeu (matériaux, bijoux, trash, sets)
function renderCodexHtml() {
  const seen = new Set();
  const section = (title, items) => {
    if (!items.length) return '';
    return `<h3>${title}</h3>` + items.map(it =>
      `<div class="codexRow"><div class="codexIcon">${it.icon}</div>` +
      `<div class="codexInfo"><div class="codexName">${it.name}</div>` +
      `<div class="codexDesc">${it.desc}</div></div></div>`).join('');
  };
  // bijoux rares (jackpot) — icône selon le palier de stuff de la zone (voir jewelGemCluster)
  const jewels = ZONES.map((z,i) => {
    const t = gearTierForZone(i), slot = accSlotFor(z.loot.jackpot), tIdx = JEWEL_TIER_IDX[t.grade] ?? 0;
    const iconFn = { ring:ringIconForTier, necklace:necklaceIconForTier, earring:earringIconForTier, belt:beltIconForTier }[slot] || ringIconForTier;
    return { icon: iconFn(tIdx, t.color), name:tr(z.loot.jackpot.name),
      desc:`+${z.loot.jackpot.ap} PA · ${LANG==='fr'?'zone':'zone'} ${i+1} (${tr(z.name)})` };
  });
  // matériaux d'optimisation
  const matSet = new Map();
  ZONES.forEach(z => { const m = z.loot.mat; if (!matSet.has(m.name)) matSet.set(m.name, m); });
  const MAT_ICON_BY_NAME = { 'Pierre de Novice':ICO_MAT_NOVICE, 'Pierre du Temps':ICO_MAT_TEMPS,
    'Pierre Noire':ICO_MAT_NOIRE, 'Pierre noire':ICO_MAT_NOIRE, 'Pierre concentrée':ICO_MAT_CONCENTREE,
    'Pierre de Caphras':ICO_MAT_CAPHRAS };
  const mats = [...matSet.values()].map(m => ({ icon:MAT_ICON_BY_NAME[m.name]||ICO_MAT_NOVICE, name:tr(m.name), desc:LANG==='fr'?'Matériau d\'optimisation':'Enhancement material' }));
  // composants de craft
  const craftSet = new Map();
  ZONES.forEach(z => { const c = z.loot.craft; if (!craftSet.has(c.name)) craftSet.set(c.name, c); });
  const crafts = [...craftSet.values()].map(c => ({ icon:'✦', name:tr(c.name), desc:LANG==='fr'?'Composant de craft endgame':'Endgame crafting component' }));
  // butin de base (trash → silver)
  const trash = ZONES.map((z,i) => ({ icon:'▬', name:tr(z.loot.trash.name), desc:`${fmt(z.loot.trash.val)} silver · ${tr(z.mob)}` }));
  // Trésor de Velia (2026-07-13, sorti du statut expérimental "TEST", demande explicite)
  const treasures = VELIA_TREASURE.map(t =>
    ({ icon:t.icon, name:tr(t.name), desc:`${LANG==='fr'?'Toutes zones':'All zones'} · ${fmtTinyPct(t.ch)}` }));
  return `<div class="admSummary">${LANG==='fr'?'Tous les objets actuellement présents dans le jeu.':'All items currently in the game.'}</div>` +
    section(LANG==='fr'?'💎 Bijoux rares':'💎 Rare jewelry', jewels) +
    section(LANG==='fr'?'◈ Matériaux d\'optimisation':'◈ Enhancement materials', mats) +
    section(LANG==='fr'?'✦ Composants de craft':'✦ Crafting components', crafts) +
    section(LANG==='fr'?'🗺️ Trésor de Velia':'🗺️ Velia Treasure', treasures) +
    section(LANG==='fr'?'▬ Butin de base':'▬ Base loot', trash);
}
// page Wiki "Tutoriel" : résumé + bouton pour relancer le tutoriel d'arrivée à Velia à tout moment
function renderTutoPageHtml() {
  return `<div class="admSummary">${LANG==='fr'
    ? 'Le tutoriel te fait visiter Velia, la ville paisible, et t\'explique les bases du jeu (zones, sorts automatiques, statistiques, quêtes, chat). Tu peux le relancer ici quand tu veux.'
    : 'The tutorial walks you through Velia, the peaceful town, and explains the basics of the game (zones, automatic skills, stats, quests, chat). You can replay it here anytime.'}</div>
    <button id="btnStartTutoWiki" style="width:auto;margin-top:10px;padding:8px 18px;">${LANG==='fr'?'▶ Relancer le tutoriel':'▶ Replay the tutorial'}</button>`;
}
let wikiSection = 'combat';
function renderWikiHtml() {
  const tabsHtml = WIKI_SECTIONS.map(s =>
    `<button class="catTab wikiTab${s.id===wikiSection?' active':''}" data-sec="${s.id}">${s.icon} ${s.label[LANG]}</button>`).join('');
  const sec = WIKI_SECTIONS.find(s => s.id === wikiSection) || WIKI_SECTIONS[0];
  const body = sec.codex ? renderCodexHtml() : sec.tuto ? renderTutoPageHtml() : sec[LANG];
  return `<div class="catTabs">${tabsHtml}</div><div class="wikiBody">${body}</div>`;
}

// ============================================================
// Ouverture des modals Wiki / Patch Notes
// ============================================================
function openInfo(title, bodyHtml) {
  questsPanelOpen = false; // tout ouverture de panneau réinitialise le flag ; openDailyQuests le remet
  $a('infoTitle').textContent = title;
  $a('infoBody').innerHTML = bodyHtml;
  $a('infoOverlay').classList.add('open');
  // masque immédiatement la pastille "notes de version non lues" du haut de page tant qu'un
  // panneau est ouvert (2026-07-06, demande explicite, capture à l'appui : elle chevauchait le
  // panneau lui-même) -- ne pas attendre le prochain tick de hud() (jusqu'à 1s de délai visible)
  if (typeof updatePatchBadge === 'function') updatePatchBadge();
}
$a('closeInfo').onclick = () => { questsPanelOpen = false; $a('infoOverlay').classList.remove('open'); updatePatchBadge(); };
// ferme seulement si le clic ET l'appui initial (mousedown) sont bien sur le fond noir —
// sinon, sélectionner du texte dans un champ (ex: le pseudo) et relâcher la souris un peu
// hors du champ pouvait faire remonter le clic jusqu'au fond et fermer tout le panneau
let infoMouseDownOnBackdrop = false;
$a('infoOverlay').addEventListener('mousedown', e => { infoMouseDownOnBackdrop = (e.target.id === 'infoOverlay'); });
$a('infoOverlay').addEventListener('click', e => { if (e.target.id === 'infoOverlay' && infoMouseDownOnBackdrop) { questsPanelOpen = false; $a('infoOverlay').classList.remove('open'); updatePatchBadge(); } });

// Codex des objets (2026-07-05, demande explicite) : sorti du Wiki pour sa propre section,
// plus visible, directement accessible depuis le menu de gauche
$a('btnCodex').onclick = () => {
  const callout = contentChangeCalloutHtml('codex');
  openInfo(LANG === 'fr' ? '📚 Codex des objets' : '📚 Item Codex', callout + renderCodexHtml());
  markContentSeen('codex');
};
$a('btnWiki').onclick = () => {
  const callout = contentChangeCalloutHtml('wiki');
  openInfo(LANG === 'fr' ? '📖 Wiki' : '📖 Wiki', callout + renderWikiHtml());
  markContentSeen('wiki');
  $a('infoBody').querySelectorAll('.wikiTab').forEach(btn => {
    btn.onclick = () => { wikiSection = btn.dataset.sec; $a('btnWiki').onclick(); };
  });
  const tutoBtn = $a('btnStartTutoWiki');
  // trackId:'onboarding' (2026-07-19, demande explicite : stats admin sur l'onboarding) -- SEUL
  // point d'entrée du tutoriel d'arrivée (TUTORIAL_STEPS, 21 étapes) : il n'existe aucun
  // déclenchement automatique à la 1ère connexion, uniquement ce bouton dans le Wiki -- voir
  // reportTutorialProgress plus bas et admin_onboarding_stats/admin_onboarding_dropoff (migration
  // 20260719180000_onboarding_stats.sql) pour voir combien de joueurs le démarrent réellement.
  if (tutoBtn) tutoBtn.onclick = () => { $a('infoOverlay').classList.remove('open'); startTutorial(TUTORIAL_STEPS, { trackId:'onboarding' }); };
};

// ============================================================
// Tutoriel d'arrivée à Velia — encadrés + flèche pointant vers l'élément expliqué. Se lance
// automatiquement à la création d'un compte (aucune sauvegarde cloud trouvée, voir loadCloudSave),
// et peut être relancé à tout moment depuis 🏘️ Velia (haut de la liste des zones) ou le 📖 Wiki.
// ============================================================
// petit état pour le hook before/after du step "suivi de quêtes" (voir plus bas) — permet de
// montrer l'encart même s'il est actuellement masqué, puis de restaurer l'état d'origine en sortant
let tutTrackerWasOn = false, tutTrackerForced = false;
let tutPotWasOpen = false;
const TUTORIAL_STEPS = [
  { title:{fr:'Bienvenue à Velia !',en:'Welcome to Velia!'},
    text:{fr:'Velia est une ville paisible : aucun monstre n\'y rôde. C\'est le meilleur endroit pour découvrir les bases avant de partir à l\'aventure.', en:'Velia is a peaceful town: no monsters roam here. It\'s the best place to learn the basics before heading out to adventure.'} },
  { target:'#activityTabs', placement:'bottom',
    title:{fr:'Les pages du jeu',en:'Game pages'},
    text:{fr:'Cette barre te permet de basculer entre les activités : la Zone (farm) et le Boss mondial. D\'autres activités arriveront plus tard.', en:'This bar lets you switch between activities: the Zone (farming) and the World Boss. More activities will arrive later.'} },
  { target:'#zoneList', placement:'left',
    title:{fr:'Choisis ta zone de farm',en:'Pick your farming zone'},
    text:{fr:'Clique une zone pour t\'y rendre. Ton personnage combat AUTOMATIQUEMENT — pas besoin de cliquer pour attaquer !', en:'Click a zone to travel there. Your character fights AUTOMATICALLY — no need to click to attack!'} },
  { target:'#skillBar', placement:'top',
    title:{fr:'Sorts automatiques',en:'Automatic skills'},
    text:{fr:'Tes sorts se lancent tout seuls selon une IA de combat. Optimise ton équipement pour qu\'ils tapent plus fort.', en:'Your skills cast themselves based on a combat AI. Improve your gear so they hit harder.'} },
  { target:'#potSlot', placement:'right',
    title:{fr:'Potions de vie et de mana',en:'HP and mana potions'},
    text:{fr:'Clique ici pour choisir la taille de potion de vie bue automatiquement (prix fixe et soin différents selon la taille) et régler le seuil "Boire sous X%". La potion de mana se boit toute seule sous 30% mana, aucun réglage nécessaire.', en:'Click here to choose the HP potion size drunk automatically (fixed price and heal that differ by size) and set the "Drink under X%" threshold. The mana potion drinks itself under 30% mana, no setting needed.'},
    before: () => { tutPotWasOpen = $a('potSelect').classList.contains('show'); renderPotSelect(); $a('potSelect').classList.add('show'); },
    after: () => { if (!tutPotWasOpen) $a('potSelect').classList.remove('show'); } },
  { target:'#panel .card', placement:'left',
    title:{fr:'Tes statistiques',en:'Your stats'},
    text:{fr:'Gearscore, PA/PD et progression : tout ce qu\'il faut pour savoir si tu es prêt pour la zone suivante.', en:'Gearscore, AP/DP and progress: everything you need to know if you\'re ready for the next zone.'} },
  { target:'#optCard', placement:'left',
    title:{fr:'Système d\'optimisation',en:'Enhancement system'},
    text:{fr:'Charge un matériau depuis ton sac pour tenter d\'améliorer une pièce d\'équipement. Plus le niveau visé est haut, plus le risque d\'échec est grand. Astuce : le petit 🔧 sur une pièce équipée t\'amène directement ici pour CETTE pièce.', en:'Load a material from your bag to try enhancing a gear piece. The higher the target level, the higher the risk of failure. Tip: the small 🔧 on an equipped piece brings you straight here for THAT piece.'} },
  { target:'#invCard', placement:'left',
    title:{fr:'Ton inventaire',en:'Your inventory'},
    text:{fr:'Tout ce que tu ramasses atterrit ici. Les boutons au-dessus t\'aident à équiper le meilleur stuff, vendre le surplus (trash, matériaux, objets inférieurs) ou trier le sac en un clic.', en:'Everything you loot lands here. The buttons above help you equip your best gear, sell the surplus (trash, materials, lower items) or sort your bag in one click.'} },
  { target:'#btnEquipBest', placement:'bottom',
    title:{fr:'"Équiper le meilleur" = toujours le meilleur SOCLE',en:'"Equip best" = always the best BASE gear'},
    text:{fr:'Ce bouton compare le socle (stats de base) de chaque objet, pas ses stats actuelles à l\'écran. Une pièce de plus haut niveau reste donc TOUJOURS préférée à une pièce plus faible même très enchantée : c\'est ton futur BiS (Best in Slot), et l\'enchanter la rendra encore plus forte.', en:'This button compares each item\'s BASE stats, not what\'s currently shown on screen. A higher-tier piece is therefore ALWAYS preferred over a weaker one even if heavily enhanced: it\'s your future BiS (Best in Slot), and enhancing it will make it even stronger.'} },
  { target:'#lootTicker', placement:'left',
    title:{fr:'Le butin en direct',en:'Live loot'},
    text:{fr:'Ce que ton personnage ramasse défile ici, à droite de la zone de jeu, en temps réel.', en:'What your character loots scrolls here, on the right of the game view, in real time.'} },
  { target:'#btnDailyQuests', placement:'bottom',
    title:{fr:'Quêtes journalières & hebdo',en:'Daily & weekly quests'},
    text:{fr:'Clique ici pour voir tes quêtes. Des objectifs se renouvellent chaque jour et chaque semaine, avec des récompenses en silver à la clé.', en:'Click here to see your quests. Objectives refresh every day and every week, with silver rewards waiting for you.'} },
  { target:'#btnToggleTracker', placement:'bottom',
    title:{fr:'Suis tes quêtes',en:'Track your quests'},
    text:{fr:'Ce bouton ouvre le suivi des quêtes restantes : elles s\'affichent alors en permanence à l\'écran, avec leur progression en direct.', en:'This button opens the remaining quests tracker: they then show permanently on screen, with live progress.'},
    // ouvre le panneau Quêtes tout seul en arrivant sur ce step (pour montrer le bouton "Suivre"
    // DANS le menu qui s'ouvre), puis le referme en le quittant
    before: () => { openDailyQuests(); },
    after: () => { questsPanelOpen = false; $a('infoOverlay').classList.remove('open'); } },
  { target:'#questTrackerWidget', placement:'left',
    title:{fr:'Le suivi de quête',en:'The quest tracker'},
    text:{fr:'Voici où apparaissent les quêtes que tu suis, avec leur progression en direct — pratique pour ne rien oublier.', en:'This is where the quests you track appear, with live progress — handy so you never forget them.'},
    before: () => { tutTrackerWasOn = S.questTrackerOn; if (!S.questTrackerOn) { S.questTrackerOn = true; tutTrackerForced = true; renderQuestTrackerWidget(); } },
    after: () => { if (tutTrackerForced) { S.questTrackerOn = tutTrackerWasOn; tutTrackerForced = false; renderQuestTrackerWidget(); } } },
  { target:'#btnLeaderboard', placement:'bottom',
    title:{fr:'Le classement',en:'The leaderboard'},
    text:{fr:'Compare ton silver, ton gearscore et ta meilleure zone atteinte à celles des autres joueurs.', en:'Compare your silver, gearscore and best zone reached to other players.'} },
  { target:'#btnAchievements', placement:'bottom',
    title:{fr:'Les succès',en:'Achievements'},
    text:{fr:'Des objectifs à long terme avec des récompenses en silver à débloquer au fil de ta progression.', en:'Long-term goals with silver rewards to unlock as you progress.'} },
  { target:'#btnMailbox', placement:'bottom',
    title:{fr:'Le courrier',en:'The mailbox'},
    text:{fr:'200 Loyalties t\'y attendent chaque jour — elles s\'y empilent en permanence et ne se perdent jamais.', en:'200 Loyalties wait for you here every day — they stack up permanently and never get lost.'} },
  { target:'#btnPatch', placement:'bottom',
    title:{fr:'Les notes de version',en:'Patch notes'},
    text:{fr:'Retrouve ici tout ce qui change à chaque mise à jour du jeu.', en:'Find everything that changes with each game update here.'} },
  { target:'#btnMarket', placement:'bottom',
    title:{fr:'Le marché (BETA)',en:'The market (BETA)'},
    text:{fr:'Achète et vends du gear et des matériaux avec les autres joueurs. Cette fonctionnalité est encore en BETA, des ajustements sont à prévoir.', en:'Buy and sell gear and materials with other players. This feature is still in BETA, adjustments are to be expected.'} },
  { target:'#chatWidget', placement:'left',
    title:{fr:'Discute avec les autres joueurs',en:'Chat with other players'},
    text:{fr:'Mondial, Trade, Annonces... échange avec la communauté directement depuis le jeu.', en:'World, Trade, Announcements... chat with the community right from the game.'} },
  { target:'#btnLogout', placement:'bottom',
    title:{fr:'La déconnexion',en:'Logging out'},
    text:{fr:'Ta progression est sauvegardée automatiquement dans le cloud — tu peux te déconnecter puis te reconnecter sans rien perdre.', en:'Your progress is saved automatically in the cloud — you can log out and log back in without losing anything.'} },
  { target:'#uuidRow', placement:'bottom',
    title:{fr:'Ton UUID',en:'Your UUID'},
    text:{fr:'Cet identifiant unique te sera demandé si le staff doit t\'ajouter un rôle (modérateur, testeur...). Il n\'est pas affiché à l\'écran pour rester privé : clique sur ce bouton pour le copier directement.', en:'This unique ID will be asked from you if the staff needs to grant you a role (moderator, tester...). It isn\'t shown on screen to stay private: click this button to copy it directly.'} },
  { target:'#btnWiki', placement:'bottom', final:true,
    title:{fr:'Besoin d\'aide plus tard ?',en:'Need help later?'},
    text:{fr:'Tu peux relancer ce tutoriel à tout moment depuis le 📖 Wiki (onglet 🔰 Tutoriel), ou en cliquant sur 🏘️ Velia en haut de la liste des zones.', en:'You can replay this tutorial anytime from the 📖 Wiki (🔰 Tutorial tab), or by clicking 🏘️ Velia at the top of the zone list.'} },
];
// ============================================================
// Tutoriel du Compendium (2026-07-08, demande explicite) — se lance automatiquement à la toute
// première ouverture du panneau (voir openCompendium/compTutoSeen), et peut être relancé à tout
// moment via le bouton "?" en haut à droite du panneau. Réutilise le même moteur/overlay que le
// tutoriel d'arrivée (voir activeTutorialSteps), avec resetView:false pour laisser le Compendium
// affiché derrière le spotlight au lieu de le fermer.
let tutCompTabSaved = 'zones'; // onglet à restaurer en quittant le tutoriel (celui d'avant son lancement)
const COMPENDIUM_TUTORIAL_STEPS = [
  { title:{fr:'Le Compendium',en:'The Compendium'},
    text:{fr:'Une collection à vie : chaque zone <b>entièrement collectée</b> (ses 4 objets : trash, matériau, bijou, craft — pas juste visitée) et chaque World Boss vaincu (au moins une fois) t\'accorde un bonus PERMANENT et ADDITIF (jamais un multiplicateur).', en:'A lifetime collection: every zone <b>fully collected</b> (its 4 items: trash, material, jewelry, craft — not just visited) and every World Boss defeated (at least once) grants you a PERMANENT, ADDITIVE bonus (never a multiplier).'} },
  { target:'#infoBody .admStatTiles', placement:'bottom',
    title:{fr:'Ta progression globale',en:'Your overall progress'},
    text:{fr:'+1% Vitesse, +1% Dégâts et +1% Esquive pour chaque zone visitée ou boss vaincu — visible ici en un coup d\'œil.', en:'+1% Speed, +1% Damage and +1% Dodge for every zone visited or boss defeated — visible here at a glance.'} },
  { target:'#infoBody .catTabs', placement:'bottom',
    title:{fr:'3 onglets à explorer',en:'3 tabs to explore'},
    // "sac protégé" retiré le 2026-07-16 (demande explicite : "enleve le sac protege du compendium
    // il est maintenant dans l'inventaire") -- vit désormais uniquement dans la carte Inventaire
    // (onglet "Compendium", voir #invModeCompendiumPane)
    text:{fr:'Zones (farm), World Bosses et Maîtrise PEN (suivi pur, sans bonus) — chacun a sa propre logique, voir les étapes suivantes. Le sac protégé vit maintenant dans la carte Inventaire.', en:'Zones (farming), World Bosses and PEN Mastery (pure tracking, no bonus) — each has its own logic, see the next steps. The protected bag now lives in the Inventory card.'},
    before: () => { tutCompTabSaved = compendiumTab; compendiumTab = 'zones'; openCompendium(); } },
  { target:'#infoBody .compZoneRow', placement:'top',
    title:{fr:'Une zone, ses objets',en:'A zone, its items'},
    text:{fr:'✓ = objet déjà obtenu au moins une fois. Il faut les 4 ✓ de la zone (trash, matériau, bijou, craft) pour toucher son bonus. Clique sur un objet pour voir quelles zones le font dropper, puis clique une zone pour y lancer le farm directement (téléportation immédiate, sans confirmation).', en:'✓ = item already obtained at least once. You need all 4 ✓ for that zone (trash, material, jewelry, craft) to earn its bonus. Click an item to see which zones drop it, then click a zone to start farming there right away (instant teleport, no confirmation).'},
    before: () => { compendiumTab = 'zones'; openCompendium(); } },
  { target:'#infoBody .compPenGrid', placement:'top', final:true,
    title:{fr:'Maîtrise PEN',en:'PEN Mastery'},
    text:{fr:'Suivi de complétion pur (aucun bonus de stats) : amène chaque pièce d\'équipement et chaque bijou à PEN (niveau max) au moins une fois dans ton inventaire. Tu peux relancer ce tutoriel à tout moment avec le bouton "?" en haut du panneau.', en:'Pure completion tracker (no stat bonus): bring every gear piece and every jewel to PEN (max level) at least once in your inventory. You can replay this tutorial anytime with the "?" button at the top of the panel.'},
    before: () => { compendiumTab = 'pen'; openCompendium(); },
    after: () => { compendiumTab = tutCompTabSaved; openCompendium(); } },
];
function startCompendiumTutorial() {
  tutCompTabSaved = compendiumTab;
  startTutorial(COMPENDIUM_TUTORIAL_STEPS, { resetView:false });
}
// ============================================================
// Tutoriel de la Pierre de Cron (2026-07-09, demande explicite) — se lance automatiquement au tout
// premier ramassage d'une Pierre de Cron (voir dropsTick/cronTutoSeen dans game-core.js), 1 seule
// étape, même moteur/overlay que les autres tutoriels (resetView:false pour laisser le jeu affiché
// derrière le spotlight au lieu de le fermer).
const CRON_TUTORIAL_STEPS = [
  { target:'#optCronSlot', placement:'top', final:true,
    title:{fr:'Pierre de Cron',en:'Cron Stone'},
    text:{fr:'Cet objet protège ta pièce d\'équipement contre une rétrogradation en cas d\'échec d\'optimisation. Clique dessus pour l\'activer ou la désactiver.', en:'This item protects your gear piece from downgrading if an enhancement attempt fails. Click it to activate or deactivate it.'} },
];
function startCronTutorial() {
  startTutorial(CRON_TUTORIAL_STEPS, { resetView:false });
}
let tutorialStepIdx = -1;
// moteur générique (2026-07-08) : au départ figé sur TUTORIAL_STEPS (le tutoriel d'arrivée), rendu
// générique pour pouvoir aussi jouer d'autres listes d'étapes (ex: COMPENDIUM_TUTORIAL_STEPS) avec
// le même overlay/spotlight — activeTutorialSteps pointe vers la liste actuellement jouée
let activeTutorialSteps = TUTORIAL_STEPS;
// affiche/masque l'indice "il faut défiler" (2026-07-05, demande explicite) : si le RECTANGLE de la
// cible est entièrement au-dessus ou en-dessous de la fenêtre visible, montre une icône souris
// (ordinateur) ou doigt (mobile/tablette, voir la media query CSS) qui rebondit vers le haut/bas,
// à l'opposé du bord hors champ. Se cache dès que la cible redevient visible (ex: le joueur a
// scrollé) — recalculé à chaque frame par tutorialTrackLoop, comme le reste du positionnement.
function updateTutorialScrollHint(r) {
  const hint = $a('tutorialScrollHint');
  if (!r) { hint.classList.remove('show'); return; }
  const below = r.top >= window.innerHeight;
  const above = r.bottom <= 0;
  if (!below && !above) { hint.classList.remove('show'); return; }
  hint.classList.add('show');
  hint.classList.toggle('up', above);
  hint.style.top = above ? '18px' : (window.innerHeight-56)+'px';
}
function positionTutorialStep() {
  const step = activeTutorialSteps[tutorialStepIdx];
  const hi = $a('tutorialHighlight'), box = $a('tutorialBox'), arrow = $a('tutorialArrow');
  const target = step.target ? document.querySelector(step.target) : null;
  if (!target) {
    // pas de cible précise (ex: message de bienvenue) : encadré centré, pas de spotlight ni flèche
    hi.classList.add('center'); hi.style.top='0'; hi.style.left='0'; hi.style.width='0'; hi.style.height='0';
    arrow.style.display = 'none';
    box.style.top = '50%'; box.style.left = '50%'; box.style.transform = 'translate(-50%,-50%)';
    updateTutorialScrollHint(null);
  } else {
    const r = target.getBoundingClientRect();
    updateTutorialScrollHint(r);
    const pad = 6;
    hi.classList.remove('center');
    hi.style.top = (r.top-pad)+'px'; hi.style.left = (r.left-pad)+'px';
    hi.style.width = (r.width+pad*2)+'px'; hi.style.height = (r.height+pad*2)+'px';
    box.style.transform = 'none';
    const boxW = 280, gap = 16, arrowSize = 11;
    let bx, by, arrowCls;
    if (step.placement === 'bottom') { bx = r.left+r.width/2-boxW/2; by = r.bottom+pad+gap; arrowCls='top'; }
    // hauteur RÉELLE de la boîte (2026-07-08, bug corrigé) : une hauteur fixe de 140 supposait un
    // texte court — un step avec un texte plus long (ex: tutoriel du Compendium) rendait une boîte
    // bien plus haute, qui débordait alors SUR l'élément ciblé au lieu de rester au-dessus
    else if (step.placement === 'top') { bx = r.left+r.width/2-boxW/2; by = r.top-pad-gap-box.offsetHeight; arrowCls='bottom'; }
    else if (step.placement === 'right') { bx = r.right+pad+gap; by = r.top+r.height/2-70; arrowCls='left'; }
    else { bx = r.left-pad-gap-boxW; by = r.top+r.height/2-70; arrowCls='right'; } // 'left' par défaut
    bx = Math.max(10, Math.min(window.innerWidth-boxW-10, bx));
    // clamp sur la hauteur RÉELLE de la boîte (2026-07-10, bug corrigé) : l'ancien clamp supposait
    // une hauteur fixe de 160 (comme l'ancien bug de placement 'top' corrigé le 2026-07-08, voir
    // commentaire ci-dessus) -- un step avec un texte long (ex: tutoriel Marché commun) ET une
    // cible proche du bord bas de l'écran produisait alors une boîte coupée hors du viewport.
    by = Math.max(10, Math.min(window.innerHeight-box.offsetHeight-10, by));
    box.style.left = bx+'px'; box.style.top = by+'px';
    arrow.style.display = '';
    arrow.className = arrowCls;
    if (arrowCls==='top' || arrowCls==='bottom') {
      arrow.style.left = (r.left+r.width/2-9)+'px';
      arrow.style.top = arrowCls==='top' ? (r.bottom+pad+2)+'px' : (r.top-pad-13)+'px';
    } else {
      arrow.style.top = (r.top+r.height/2-9)+'px';
      arrow.style.left = arrowCls==='left' ? (r.right+pad+2)+'px' : (r.left-pad-13)+'px';
    }
  }
}
function showTutorialStep() {
  const step = activeTutorialSteps[tutorialStepIdx];
  $a('tutStepLbl').textContent = `${LANG==='fr'?'Étape':'Step'} ${tutorialStepIdx+1} / ${activeTutorialSteps.length}`;
  $a('tutTitle').textContent = step.title[LANG];
  $a('tutText').textContent = step.text[LANG];
  $a('tutSkipBtn').textContent = LANG==='fr'?'Passer':'Skip';
  $a('tutPrevBtn').textContent = LANG==='fr'?'← Précédent':'← Back';
  $a('tutPrevBtn').disabled = tutorialStepIdx <= 0;
  $a('tutNextBtn').textContent = step.final ? (LANG==='fr'?'Terminer':'Finish') : (LANG==='fr'?'Suivant →':'Next →');
  // certains steps ont besoin de forcer temporairement un état pour être visibles (ex: le suivi de
  // quêtes) — voir tutTrackerForced. Le nettoyage correspondant (after) est appelé en quittant le step.
  if (step.before) step.before();
  positionTutorialStep();
}
// referme proprement le step courant avant d'en changer (ou de terminer) : appelle son "after" s'il
// en a un (idempotent par design, voir tutTrackerForced — donc sans risque si appelé deux fois)
function leaveTutorialStep() {
  const step = activeTutorialSteps[tutorialStepIdx];
  if (step && step.after) step.after();
}
// suivi pixel perfect de la cible à CHAQUE frame (donc y compris pendant un scroll, quelle que
// soit sa source : molette, glisser la scrollbar, scroll d'un conteneur interne...) — plus fiable
// qu'un event "scroll" (qui ne remonte pas depuis les conteneurs internes) ou qu'un debounce
let tutorialRafId = 0;
function tutorialTrackLoop() {
  if (tutorialStepIdx < 0) { tutorialRafId = 0; return; }
  positionTutorialStep();
  tutorialRafId = requestAnimationFrame(tutorialTrackLoop);
}
// steps : liste d'étapes à jouer (par défaut le tutoriel d'arrivée) ; resetView : si true (défaut),
// ferme les panneaux ouverts et repart sur la vue Zone — mis à false pour le tutoriel du Compendium
// qui doit au contraire rester affiché derrière le spotlight pour pouvoir en montrer les éléments
// suivi de progression admin (2026-07-19, demande explicite) : optionnel, réservé au tutoriel
// d'arrivée (trackId:'onboarding') -- les autres tutoriels (Compendium/Cron/objets) ont déjà leur
// propre suivi via markItemTutorialSeen (progression/notifications-quests.js) et ne passent jamais
// trackId, donc ce mécanisme reste totalement inerte pour eux (activeTutorialTrackId reste null).
let activeTutorialTrackId = null;
// fire-and-forget, même garde que markItemTutorialSeen (sb && currentUser && !isGuest()) -- réutilise
// la RPC mark_item_tutorial_seen (généralisée le 2026-07-19 avec p_last_step/p_completed, voir
// migration 20260719180000_onboarding_stats.sql) plutôt qu'une RPC dédiée en double.
function reportTutorialProgress(completed, skipped) {
  if (!activeTutorialTrackId) return;
  if (!sb || !currentUser || (typeof isGuest === 'function' && isGuest())) return;
  try {
    // même bug que log_playtime_ping ci-dessus (ligne ~1004) : le builder Postgrest n'a pas de
    // .catch(), seulement .then() -- .then(null, cb) reste fire-and-forget sans planter silencieusement.
    sb.rpc('mark_item_tutorial_seen', {
      p_tutorial_id: activeTutorialTrackId, p_skipped: !!skipped, p_last_step: tutorialStepIdx, p_completed: !!completed,
    }).then(null, ()=>{});
  } catch(e) {}
}
function startTutorial(steps = TUTORIAL_STEPS, { resetView = true, trackId = null } = {}) {
  // défense en profondeur (2026-07-20, voir maybeQueueTutorialById, notifications-quests.js pour
  // le vrai correctif) : jamais de tutoriel avant une authentification réelle, même via un futur
  // appelant qui oublierait cette garde.
  if (!currentUser) return;
  activeTutorialSteps = steps;
  activeTutorialTrackId = trackId;
  if (resetView) { questsPanelOpen = false; $a('infoOverlay').classList.remove('open'); currentActivity = 'zone'; showActivityPage('zone'); }
  tutorialStepIdx = 0;
  $a('tutorialOverlay').classList.add('open');
  showTutorialStep();
  reportTutorialProgress(false, false); // démarré (last_step=0, ni terminé ni passé)
  if (!tutorialRafId) tutorialRafId = requestAnimationFrame(tutorialTrackLoop);
}
function endTutorial(skipped) {
  leaveTutorialStep();
  reportTutorialProgress(!skipped, !!skipped);
  activeTutorialTrackId = null;
  tutorialStepIdx = -1;
  $a('tutorialOverlay').classList.remove('open');
}
$a('tutNextBtn').onclick = () => {
  const step = activeTutorialSteps[tutorialStepIdx];
  leaveTutorialStep();
  if (step.final) { endTutorial(false); return; }
  tutorialStepIdx++; showTutorialStep();
  reportTutorialProgress(false, false); // progression normale (Suivant), pas encore terminé
};
$a('tutSkipBtn').onclick = () => endTutorial(true);
$a('tutPrevBtn').onclick = () => {
  if (tutorialStepIdx <= 0) return;
  leaveTutorialStep();
  tutorialStepIdx--; showTutorialStep();
};

// ---------- suivi des patch notes lus ----------
// principe demandé : le tag NEW reste visible pendant TOUTE la session en cours (même après
// avoir défilé dessus), et n'est retiré définitivement qu'à la fermeture de l'onglet — pas avant.
// readPatches/seenThisSession sont déclarés dans game-core.js (évite un piège de zone morte
// temporelle une fois le jeu regroupé en un seul fichier -- unreadPatchCount() les lit dès le
// tout premier hud() synchrone au démarrage, avant que CE fichier n'ait fini de charger -- voir
// le commentaire juste avant buildZoneList() dans game-core.js).
// index (dans PATCH_NOTES, 0 = le plus récent) du début de la page actuellement affichée
// (2026-07-11, demande explicite : "enleve le scroll... met un bouton vers le haut/vers le bas")
// -- persisté par joueur, remplace l'ancien "velia-patch-scroll" (position de pixels).
let patchPageStart = 0;
try { patchPageStart = parseInt(localStorage.getItem('velia-patch-page')||'0', 10) || 0; } catch(e) {}
function commitPatchRead() { // appelé à la fermeture de l'onglet
  try {
    const merged = new Set([...readPatches, ...seenThisSession]);
    localStorage.setItem('velia-patch-read', JSON.stringify([...merged]));
  } catch(e) {}
}
window.addEventListener('beforeunload', commitPatchRead);
window.addEventListener('pagehide', commitPatchRead); // filet de sécurité (mobile / onglets fermés brutalement)

// le badge (pastille numérique sur le bouton + pastille en haut de page) compte ce qui n'a été vu
// ni lors d'une session précédente NI pendant la session en cours. Changement du 2026-07-06
// (demande explicite : "s'il a pas scrollé les pastille restent... le numero reste aussi tant
// qu'il n'a pas scrollé pour lire le patch") -- REMPLACE le comportement du 2026-07-05 où ouvrir le
// panneau suffisait à tout vider d'un coup : désormais, seul le DÉFILEMENT réel jusqu'à une entrée
// (voir patchObserver plus bas) la marque vue, ouvrir le panneau seul ne change plus rien. Le tag
// "NEW" sur chaque entrée reste basé UNIQUEMENT sur les sessions précédentes (readPatches).
function unreadPatchCount() { return PATCH_NOTES.filter(p => !readPatches.has(p.v) && !seenThisSession.has(p.v)).length; }
// découpe PATCH_NOTES en pages de 2 à 7 entrées SELON LA TAILLE (2026-07-11, demande explicite :
// "affiche les 2 a 7 dernier note selon la taille") -- une page s'arrête dès qu'elle atteint 7
// entrées OU que son total de lignes dépasserait le budget (mais jamais moins de 2 entrées, même
// si les 2 premières sont déjà volumineuses). Recalculé à chaque ouverture/navigation (bon marché,
// PATCH_NOTES ne bouge jamais en cours de session).
const PATCH_PAGE_MIN = 2, PATCH_PAGE_MAX = 7, PATCH_PAGE_LINE_BUDGET = 10;
function computePatchPages() {
  const pages = [];
  let i = 0;
  while (i < PATCH_NOTES.length) {
    let count = 0, lines = 0;
    while (count < PATCH_PAGE_MAX && i+count < PATCH_NOTES.length) {
      const entryLines = (PATCH_NOTES[i+count][LANG] || []).length;
      if (count >= PATCH_PAGE_MIN && lines + entryLines > PATCH_PAGE_LINE_BUDGET) break;
      lines += entryLines; count++;
    }
    if (count === 0) count = 1; // filet de sécurité, jamais une page vide
    pages.push({ start: i, count });
    i += count;
  }
  return pages;
}
function updatePatchBadge() {
  const n = unreadPatchCount();
  const badge = $a('patchBadge');
  if (badge) { badge.textContent = n; badge.classList.toggle('show', n > 0); }
  $a('btnPatch').classList.toggle('hasNew', n > 0);
  // bandeau DANS le panneau des notes de version (2026-07-06, demande explicite : "enleve la
  // pastille en haut de l'ecran... mets-la dans notes de version directement pour appel au scroll
  // vers le haut") -- remplace l'ancienne pastille flottante sur toute la page, qui chevauchait le
  // panneau. Ne s'affiche que si CE panneau est ouvert (sinon rien à quoi l'accrocher/scroller).
  const banner = $a('patchUnreadBanner');
  if (banner) {
    const patchPanelOpen = $a('infoOverlay').classList.contains('open') && document.querySelector('.patchEntry');
    $a('patchUnreadBannerNum').textContent = n;
    banner.classList.toggle('show', n > 0 && !!patchPanelOpen);
  }
}

// catégories principales des notes de version (refonte du 2026-07-05, demande explicite) --
// taxonomie standard adaptée à Black Desert Idle (les catégories sans équivalent dans ce jeu, ex.
// "Boutique"/devise premium, "Classes"/"Montures", ne sont pas utilisées ici)
const PATCH_CATS = {
  new:     { fr:'Nouveautés',           en:'New',            icon:'🆕', color:'#8fc98a',
    desc:{fr:'Nouveau contenu ajouté au jeu', en:'New content added to the game'} },
  change:  { fr:'Équilibrage',          en:'Balancing',      icon:'⚖️', color:'#9cc9e8',
    desc:{fr:'Ajustement de valeurs existantes (stats, taux, difficulté...)', en:'Adjustment of existing values (stats, rates, difficulty...)'} },
  improve: { fr:'Améliorations',        en:'Improvements',   icon:'✨', color:'#7ec9c2',
    desc:{fr:'Amélioration de l\'existant sans changer son fonctionnement de base', en:'Improvement of something existing without changing its core behavior'} },
  fix:     { fr:'Corrections de bugs',  en:'Bug fixes',      icon:'🐛', color:'#e8b84a',
    desc:{fr:'Correction d\'un bug ou d\'un comportement incorrect', en:'Fix for a bug or incorrect behavior'} },
  exploit: { fr:'Sécurité',             en:'Security',       icon:'🔒', color:'#b48ce8',
    desc:{fr:'Faille de sécurité corrigée', en:'Security vulnerability fixed'} },
  admin:   { fr:'Serveur',              en:'Server',         icon:'🌐', color:'#c9a55a',
    desc:{fr:'Changement côté serveur/infrastructure', en:'Server-side/infrastructure change'} },
  event:   { fr:'Événements',           en:'Events',         icon:'🎉', color:'#e89fc4',
    desc:{fr:'Contenu ou bonus temporaire', en:'Temporary content or bonus'} },
  info:    { fr:'Informations',         en:'Information',    icon:'📢', color:'#9aa8c9',
    desc:{fr:'Annonce ou information, sans changement de jeu', en:'Announcement or information, no gameplay change'} },
};
// tag de plateforme (2026-07-05, demande explicite) : en plus de la catégorie, précise quand
// une ligne ne concerne QUE tablette/téléphone — sert à repérer d'un coup d'œil les changements
// qui ne touchent pas la version ordinateur. Optionnel (line.plat) : absent = toutes plateformes.
const PATCH_PLATFORMS = {
  mobile: { fr:'Tab/Mobile', en:'Tab/Mobile', icon:'📱', color:'#e0a840',
    desc:{fr:'Concerne uniquement tablette/téléphone', en:'Only concerns tablet/phone'} },
  firefox: { fr:'Firefox', en:'Firefox', icon:'🦊', color:'#e0824a',
    desc:{fr:'Bug spécifique à Firefox (Chrome non affecté)', en:'Firefox-specific bug (Chrome unaffected)'} },
};
// tag de nature (2026-07-05, demande explicite) : précise si une ligne relève d'une optimisation
// "sous le capot" (code, performance, structure des données) plutôt que du contenu de jeu direct.
// Optionnel (line.nature) : absent = non concerné.
const PATCH_NATURE = {
  opticode:     { fr:'Optim. code',   en:'Code opti',   icon:'🧹', color:'#7aa8c9',
    desc:{fr:'Nettoyage/restructuration du code, sans impact visible', en:'Code cleanup/restructuring, no visible impact'} },
  optimisation: { fr:'Optimisation',  en:'Optimization', icon:'⚡', color:'#c9a55a',
    desc:{fr:'Optimisation de performance ou d\'algorithme', en:'Performance or algorithm optimization'} },
  inventaire:   { fr:'Inventaire',    en:'Inventory',   icon:'🎒', color:'#8fc98a',
    desc:{fr:'Concerne le stockage/la structure des données de sauvegarde', en:'Concerns storage/structure of save data'} },
  backend:      { fr:'Backend',       en:'Backend',     icon:'🗄️', color:'#b48ce8',
    desc:{fr:'Changement côté serveur (Supabase, base de données...)', en:'Server-side change (Supabase, database...)'} },
};
// gravité du changement (2026-07-05, demande explicite) : pastille de couleur indiquant l'impact
// du changement, indépendamment de sa catégorie. Optionnel (line.severity) : absent = pas de
// gravité précisée (la plupart des lignes mineures n'ont pas besoin d'en avoir une).
const PATCH_SEVERITY = {
  critical: { fr:'Critique', en:'Critical', color:'#e85a5a',
    desc:{fr:'Impact majeur : sécurité, perte de données, ou jeu bloqué', en:'Major impact: security, data loss, or game-blocking issue'} },
  major:    { fr:'Important', en:'Major', color:'#e8a840',
    desc:{fr:'Changement notable qui affecte l\'expérience de jeu', en:'Notable change affecting the gameplay experience'} },
  minor:    { fr:'Mineur', en:'Minor', color:'#e8d840',
    desc:{fr:'Petit ajustement, impact limité', en:'Small adjustment, limited impact'} },
  info:     { fr:'Info', en:'Info', color:'#9aa8c9',
    desc:{fr:'Purement informatif, aucun impact sur le jeu', en:'Purely informational, no impact on the game'} },
};
// sous-catégorie libre (2026-07-05, demande explicite) : précise le domaine exact touché à
// l'intérieur d'une catégorie principale (ex: "Boss" dans Nouveautés OU dans Équilibrage) --
// simple étiquette informative, pas de code couleur dédié (contrairement aux tags ci-dessus).
// Optionnel (line.sub) : absent = pas de sous-catégorie précisée.
const PATCH_SUBCATS = {
  boss:'Boss', monstres:'Monstres', zones:'Zones', quetes:'Quêtes', pnj:'PNJ', objets:'Objets',
  equipements:'Équipements', competences:'Compétences', systeme:'Système de jeu',
  pve:'PvE', loot:'Loot', economie:'Économie', craft:'Craft', xp:'Expérience (XP)',
  interface:'Interface (UI)', ux:'Expérience utilisateur (UX)', perf:'Performances',
  optimisation:'Optimisation', graphismes:'Graphismes', audio:'Audio', animations:'Animations',
  accessibilite:'Accessibilité', chargement:'Temps de chargement',
  gameplay:'Gameplay', combat:'Combat', inventaire:'Inventaire', reseau:'Réseau',
  sauvegarde:'Sauvegarde', connexion:'Connexion',
  anticheat:'Anti-triche', authentification:'Authentification', comptes:'Comptes', compte:'Compte',
  serveur:'Serveur', securite:'Correctifs de sécurité', admin:'Administration',
  maintenance:'Maintenance', infrastructure:'Infrastructure', bdd:'Base de données',
  synchro:'Synchronisation',
  eventTemp:'Événements temporaires', bonusXp:'Bonus XP', bonusDrop:'Bonus Drop',
  cadeaux:'Cadeaux', calendrier:'Calendrier',
  annonces:'Annonces', roadmap:'Feuille de route', prochaines:'Prochaines mises à jour',
  connus:'Problèmes connus', tresors:'Trésors', compagnon:'Compagnon',
};
const PATCH_SUBCATS_EN = {
  boss:'Boss', monstres:'Monsters', zones:'Zones', quetes:'Quests', pnj:'NPC', objets:'Items',
  equipements:'Gear', competences:'Skills', systeme:'Game systems',
  pve:'PvE', loot:'Loot', economie:'Economy', craft:'Crafting', xp:'Experience (XP)',
  interface:'Interface (UI)', ux:'User experience (UX)', perf:'Performance',
  optimisation:'Optimization', graphismes:'Graphics', audio:'Audio', animations:'Animations',
  accessibilite:'Accessibility', chargement:'Loading times',
  gameplay:'Gameplay', combat:'Combat', inventaire:'Inventory', reseau:'Network',
  sauvegarde:'Save', connexion:'Login',
  anticheat:'Anti-cheat', authentification:'Authentication', comptes:'Accounts', compte:'Account',
  serveur:'Server', securite:'Security fixes', admin:'Administration',
  maintenance:'Maintenance', infrastructure:'Infrastructure', bdd:'Database',
  synchro:'Synchronization',
  eventTemp:'Time-limited events', bonusXp:'XP bonus', bonusDrop:'Drop bonus',
  cadeaux:'Gifts', calendrier:'Calendar',
  annonces:'Announcements', roadmap:'Roadmap', prochaines:'Upcoming updates',
  connus:'Known issues', tresors:'Treasures', compagnon:'Companion',
};

// construit le HTML d'UNE entrée de patch note -- absIdx = index ABSOLU dans PATCH_NOTES (pas
// juste dans la page affichée), pour que la classe "latest" ne s'applique qu'à la toute dernière
// version du jeu, même quand on navigue vers une page qui ne contient pas l'index 0.
function renderPatchEntryHtml(p, absIdx) {
    const isNew = !readPatches.has(p.v); // basé UNIQUEMENT sur les sessions précédentes, pas sur l'affichage en cours
    return `
    <div class="patchEntry ${absIdx===0?'latest':''}" data-ver="${p.v}">
      <div class="patchEntryHead">
        <span class="patchVer">${p.v}</span>
        ${p.name ? `<span class="patchName">${p.name[LANG]}</span>` : ''}
        ${isNew ? '<span class="patchNewTag">NEW</span>' : ''}
        ${p.d ? `<span class="patchDate">${p.d}</span>` : ''}
      </div>
      ${(() => {
        // groupe les lignes par catégorie principale (2026-07-05, demande explicite) : chaque
        // groupe démarre par un en-tête bordé d'un liseré doré, et toutes les lignes d'un même
        // groupe s'alignent à la même hauteur -- au lieu d'un badge répété sur chaque ligne
        const groups = [];
        for (const line of p[LANG]) {
          const key = line.t || 'change';
          let g = groups.find(g => g.key === key);
          if (!g) { g = { key, lines: [] }; groups.push(g); }
          g.lines.push(line);
        }
        return groups.map(g => {
          const cat = PATCH_CATS[g.key] || PATCH_CATS.change;
          const subMap = LANG === 'fr' ? PATCH_SUBCATS : PATCH_SUBCATS_EN;
          return `
          <div class="patchGroup">
            <div class="patchGroupHead" style="color:${cat.color}" title="${escapeHtml(cat.desc[LANG])}">${cat.icon} ${cat[LANG]}</div>
            <ul>${g.lines.map(line => {
              const sev = line.severity ? PATCH_SEVERITY[line.severity] : null;
              const plat = line.plat ? PATCH_PLATFORMS[line.plat] : null;
              const nature = line.nature ? PATCH_NATURE[line.nature] : null;
              const sub = line.sub ? subMap[line.sub] : null;
              // pastille de gravité (2026-07-05, demande explicite) : déplacée dans la ligne d'infos
              // du bas (comme les autres badges) pour ne plus décaler le texte de la ligne -- garde
              // un petit point coloré devant son libellé, infobulle au survol
              const sevTag = sev ? `<span class="patchCat" style="color:${sev.color};border-color:${sev.color}" title="${escapeHtml(sev.desc[LANG])}"><span class="patchSevDot" style="background:${sev.color}"></span>${sev[LANG]}</span>` : '';
              const platTag = plat ? `<span class="patchCat" style="color:${plat.color};border-color:${plat.color}" title="${escapeHtml(plat.desc[LANG])}">${plat.icon} ${plat[LANG]}</span>` : '';
              const natureTag = nature ? `<span class="patchCat" style="color:${nature.color};border-color:${nature.color}" title="${escapeHtml(nature.desc[LANG])}">${nature.icon} ${nature[LANG]}</span>` : '';
              // sous-catégorie (2026-07-05, demande explicite : "marquer chaque grosse catégorie ET
              // sous-catégorie mais plus finement") -- reprend la couleur de la catégorie parente au
              // lieu d'un gris neutre, pour bien montrer le lien de parenté tout en restant plus discret
              const subTag = sub ? `<span class="patchSub" style="color:${cat.color};border-color:${cat.color}55" title="${LANG==='fr'?'Sous-catégorie':'Subcategory'} : ${escapeHtml(sub)}">${sub}</span>` : '';
              const extraTags = sevTag + subTag + platTag + natureTag;
              const removedTag = line.removed ? `<span class="patchRemoved">${LANG==='fr'?'🗑 Supprimé':'🗑 Removed'}</span>` : '';
              // bouton avant/après (2026-07-05, demande explicite) : ouvre un comparateur d'images
              // quand la ligne référence des captures d'écran (voir line.img.before/after)
              const imgBtn = line.img ? `<button class="patchImgBtn" data-before="${escapeHtml(line.img.before)}" data-after="${escapeHtml(line.img.after)}" title="${LANG==='fr'?'Voir avant/après':'See before/after'}">🖼️</button>` : '';
              return `<li class="${line.removed?'patchLineRemoved':''}">
                <div class="patchLineMain"><span class="patchLineText">${line.tx}${removedTag}</span>${imgBtn}</div>
                ${extraTags ? `<div class="patchLineExtra">${extraTags}</div>` : ''}
              </li>`;
            }).join('')}</ul>
          </div>`;
        }).join('');
      })()}
    </div>`;
}
// affiche la page COURANTE (patchPageStart) des notes de version -- remplace l'ancien système à
// scroll (2026-07-11, demande explicite : "enleve le scroll affiche les 2 a 7 dernier note selon
// la taille et met un bouton vers le haut pour voir les nouveau et vers le bas pour regarder les
// ancien") : plus de mémoire de position de scroll, plus d'IntersectionObserver -- une page ENTIÈRE
// (2 à 7 notes, voir computePatchPages) est toujours affichée en entier, donc marquée "vue" dès son
// rendu, sans avoir besoin de défiler dessus.
function renderPatchNotesPanel() {
  const pages = computePatchPages();
  let pageIdx = pages.findIndex(pg => pg.start === patchPageStart);
  if (pageIdx === -1) { pageIdx = 0; patchPageStart = pages[0].start; } // sécurité si l'historique a changé depuis
  const page = pages[pageIdx];
  const entries = PATCH_NOTES.slice(page.start, page.start + page.count);

  // bandeau "N notes non lues" -- calculé AVANT le reste (qui ne change plus ce compte)
  const unreadNow = unreadPatchCount();
  const unreadBannerHtml = `<div id="patchUnreadBanner" class="${unreadNow>0?'show':''}">` +
    `<span id="patchUnreadBannerNum">${unreadNow}</span> ` +
    `<span>${LANG==='fr'?'note(s) de version non lue(s) — clique pour remonter':'unread patch note(s) — click to jump to newest'}</span></div>`;

  const navHtml = `<div class="patchNavRow">
      <button id="patchNavUp" class="patchNavBtn"${pageIdx===0?' disabled':''} title="${LANG==='fr'?'Notes plus récentes':'Newer notes'}">▲ ${LANG==='fr'?'Plus récent':'Newer'}</button>
      <span class="patchNavPos">${page.start+1}–${page.start+entries.length} / ${PATCH_NOTES.length}</span>
      <button id="patchNavDown" class="patchNavBtn"${pageIdx===pages.length-1?' disabled':''} title="${LANG==='fr'?'Notes plus anciennes':'Older notes'}">${LANG==='fr'?'Plus ancien':'Older'} ▼</button>
    </div>`;

  const entriesHtml = entries.map((p,k) => renderPatchEntryHtml(p, page.start+k)).join('');
  openInfo(LANG === 'fr' ? '📜 Notes de version' : '📜 Patch Notes', unreadBannerHtml + navHtml + entriesHtml);

  // toute la page affichée est immédiatement marquée "vue" (plus besoin de défiler dessus,
  // contrairement à l'ancien système) -- le tag "NEW" par entrée reste basé sur readPatches
  // (sessions précédentes) et ne disparaît qu'à la fermeture de l'onglet, voir commitPatchRead
  let changed = false;
  entries.forEach(p => { if (!seenThisSession.has(p.v)) { seenThisSession.add(p.v); changed = true; } });
  if (changed) updatePatchBadge();

  try { localStorage.setItem('velia-patch-page', String(patchPageStart)); } catch(e) {}

  const unreadBannerEl = $a('patchUnreadBanner');
  if (unreadBannerEl) unreadBannerEl.onclick = () => { patchPageStart = 0; renderPatchNotesPanel(); };
  const upBtn = $a('patchNavUp'), downBtn = $a('patchNavDown');
  if (upBtn) upBtn.onclick = () => { if (pageIdx > 0) { patchPageStart = pages[pageIdx-1].start; renderPatchNotesPanel(); } };
  if (downBtn) downBtn.onclick = () => { if (pageIdx < pages.length-1) { patchPageStart = pages[pageIdx+1].start; renderPatchNotesPanel(); } };

  // comparateur avant/après (2026-07-05, demande explicite) : câblé après insertion du HTML
  $a('infoBody').querySelectorAll('.patchImgBtn').forEach(btn => {
    btn.onclick = () => openPatchImgCompare(btn.dataset.before, btn.dataset.after);
  });
}
$a('btnPatch').onclick = renderPatchNotesPanel;
function openPatchImgCompare(before, after) {
  $a('patchImgLblBefore').textContent = LANG==='fr' ? 'Avant' : 'Before';
  $a('patchImgLblAfter').textContent = LANG==='fr' ? 'Après' : 'After';
  $a('patchImgBefore').src = before;
  $a('patchImgAfter').src = after;
  $a('patchImgOverlay').classList.add('open');
}
$a('closePatchImg').onclick = () => $a('patchImgOverlay').classList.remove('open');
let patchImgMouseDownOnBackdrop = false;
$a('patchImgOverlay').addEventListener('mousedown', e => { patchImgMouseDownOnBackdrop = (e.target.id === 'patchImgOverlay'); });
$a('patchImgOverlay').addEventListener('click', e => { if (e.target.id === 'patchImgOverlay' && patchImgMouseDownOnBackdrop) $a('patchImgOverlay').classList.remove('open'); });

updatePatchBadge();
applyI18n();
