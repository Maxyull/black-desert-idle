
// ============================================================
// SUPABASE — comptes joueurs + sauvegarde cloud
// ============================================================
// 🔧 À REMPLIR : dans ton projet Supabase > Project Settings > API
const SUPABASE_URL = 'https://mkwwvzbjtyawpcyrnybk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_c7HLxbeBLe01rirZVg-XPA_TClYulIJ';

let sb = null, currentUser = null;
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

// ---------- admin (accès réservé à ce compte précis) ----------
const ADMIN_EMAIL = 'maxime.lacoste@icloud.com';
function isAdmin() { return !!(currentUser && currentUser.email === ADMIN_EMAIL); }
// invité = session anonyme Supabase (pas d'email/mot de passe) — jeu jouable et sauvegardé,
// mais aucun accès au marché/classement (surfaces les plus exposées à la triche multi-comptes)
function isGuest() { return !!(currentUser && currentUser.is_anonymous); }

// ---------- journal de farm (pour les stats admin) : queue légère, envoyée par lots ----------
let farmEventQueue = [];
function queueFarmEvent(kind, name, qty, silverVal) {
  if (!sb || !currentUser || isGuest()) return; // pas de compte vérifié → pas de journalisation
  farmEventQueue.push({ user_id: currentUser.id, item_name: name, item_kind: kind, qty, silver_value: silverVal, zone_name: Z().name });
}
async function flushFarmEvents() {
  if (!sb || !currentUser || isGuest() || farmEventQueue.length === 0) return;
  const batch = farmEventQueue.splice(0, farmEventQueue.length);
  try { await sb.from('farm_events').insert(batch); } catch(e) { /* pas grave, prochain lot rattrapera */ }
}
setInterval(flushFarmEvents, 25000);
window.addEventListener('beforeunload', flushFarmEvents);

const $a = id => document.getElementById(id);

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
    const { data, error } = await sb.auth.updateUser({ email, password: pass });
    if (error) { authShow(error.message, true); return; }
    onAuthed(data.user);
    authShow('Compte lié ! Ta progression est conservée.');
    return;
  }
  const { data, error } = await sb.auth.signUp({ email, password: pass });
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
  showAuthOverlay(false);
  updateUserBar();
  await refreshMyPseudo();
  refreshMyModStatus();
  refreshMyTesterStatus();
  await loadCloudSave();
  startAutoCloudSave();
  heartbeatPresence();
  refreshOnlineCounter();
  refreshLiveBoss(); // affiche tout de suite un éventuel boss global déjà en cours
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

// point d'entrée unique au chargement (et après déconnexion) : tente une session invité automatique.
// si l'anonymat n'est pas activé côté Supabase (ou hors-ligne), on retombe sur le formulaire classique.
async function startGuestOrShowAuth() {
  if (!sb) { showAuthOverlay(false); updateUserBar(); return; }
  try {
    const { data, error } = await sb.auth.signInAnonymously();
    if (error) throw error;
    onAuthed(data.user);
  } catch (e) {
    showAuthOverlay(true);
    authShow('');
  }
}

let tutorialAutoShown = false; // évite de relancer le tuto auto plusieurs fois si loadCloudSave est rappelé
async function loadCloudSave() {
  if (!sb || !currentUser) return;
  $a('saveStatus').textContent = 'Chargement...';
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

async function saveToCloud() {
  if (!sb || !currentUser) return;
  const { error } = await sb.from('game_saves').upsert({ user_id: currentUser.id, save_data: getSaveState() });
  $a('saveStatus').textContent = error ? '✗ échec sauvegarde' : '✓ sauvegardé';
  setTimeout(() => { if ($a('saveStatus')) $a('saveStatus').textContent = ''; }, 2000);
  syncPlayerStats();
}

// ---------- classement : snapshot périodique des stats publiques dans player_stats ----------
async function syncPlayerStats() {
  if (!sb || !currentUser || isGuest()) return; // classement réservé aux comptes vérifiés
  const mins = (performance.now() - S.startTime) / 60000;
  const silverPerHour = mins > .1 ? Math.round((S.silverEarned-(S.silverEarnedAtLoad||0)) / (mins/60)) : 0;
  const best = bestFarmedItem();
  // total de morceaux du "Trésor de Velia" ramassés À VIE — sert au classement dédié "🗺️ Trésors"
  const treasureCount = treasureTotal(S);
  try {
    await sb.from('player_stats').upsert({
      user_id: currentUser.id,
      display_name: myPseudo || (currentUser.email||'?').split('@')[0],
      silver: Math.round(S.silver),
      gearscore: Math.round(GS()),
      ap: Math.round(apEff()*10)/10,
      dp: Math.round(totalDP()*10)/10,
      lvl: S.lvl,
      best_zone_index: S.maxZoneIdx,
      best_zone_name: ZONES[S.maxZoneIdx] ? ZONES[S.maxZoneIdx].name : '',
      silver_per_hour: silverPerHour,
      playtime_sec: Math.round(S.playtimeSec),
      best_item_name: best ? best.name : '',
      best_item_count: best ? best.count : 0,
      treasure_count: treasureCount,
      loyalty: Math.round(S.loyalty||0),
      best_kpm: Math.round((S.bestKpm||0)*10)/10,
      updated_at: new Date().toISOString(),
    });
  } catch(e) { /* pas grave, prochaine synchro rattrapera */ }
}

// ---------- réinitialisation de la démo (réservée à l'admin, à tout moment) ----------
async function resetDemo() {
  if (!isAdmin()) return; // double protection : même si le bouton est masqué, la fonction refuse
  const msg = LANG === 'fr'
    ? "Réinitialiser la démo ? Toute ta progression (silver, équipement, niveau, sac) sera perdue et remise à zéro. Cette action est irréversible."
    : "Reset the demo? All your progress (silver, gear, level, bag) will be lost and set back to zero. This action is irreversible.";
  if (!confirm(msg)) return;
  applySaveState(JSON.parse(JSON.stringify(DEFAULT_SAVE)));
  suppressLoyaltyGrantForToday();
  if (sb && currentUser) await saveToCloud(); // écrase aussi la sauvegarde cloud avec l'état neuf
  try { localStorage.setItem('velia-idle-save', JSON.stringify(getSaveState())); } catch(e) {}
  floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Démo réinitialisée' : 'Demo reset', { gold:true });
}

// ---------- reset des quêtes (admin) : juste pour soi, ou pour tout le monde ----------
// "pour soi" ne touche que l'état local + sa propre sauvegarde cloud (aucun risque).
function resetMyQuests() {
  if (!isAdmin()) return;
  S.dq = null; S.wq = null;
  ensureQuests('daily'); ensureQuests('weekly');
  hud();
  if ($a('infoOverlay').classList.contains('open')) openDailyQuests();
  if (sb && currentUser) saveToCloud();
  try { localStorage.setItem('velia-idle-save', JSON.stringify(getSaveState())); } catch(e) {}
  floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Quêtes réinitialisées' : 'Quests reset', { gold:true });
}
// "pour tout le monde" appelle une fonction SECURITY DEFINER côté Supabase qui remet à null
// dq/wq dans TOUTES les sauvegardes cloud — celle-ci vérifie elle-même l'email admin côté
// serveur (voir supabase-quest-reset-schema.sql), le bouton masqué côté client n'étant
// qu'une protection de confort, pas la vraie barrière de sécurité.
async function resetAllQuests() {
  if (!isAdmin() || !sb) return;
  const msg = LANG === 'fr'
    ? "Réinitialiser les quêtes de TOUS les joueurs ? Chacun se verra retirer sa progression de quêtes en cours (journalières et hebdomadaires) et de nouvelles seront tirées à leur prochaine connexion. Action irréversible."
    : "Reset quests for ALL players? Everyone's in-progress quests (daily and weekly) will be cleared and new ones drawn on their next login. This action is irreversible.";
  if (!confirm(msg)) return;
  const { error } = await sb.rpc('admin_reset_all_quests');
  if (!error) logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a réinitialisé les quêtes de tous les joueurs`, 0x9cc9e8);
  if (error) {
    floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Échec — ' + error.message : 'Failed — ' + error.message, { hurt:true });
    return;
  }
  resetMyQuests(); // applique aussi l'effet immédiatement à l'admin lui-même
  floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Quêtes de tous les joueurs réinitialisées ✓' : "All players' quests reset ✓", { gold:true });
}
// remise à zéro COMPLÈTE de TOUS les comptes (silver/équipement/niveau/sac), avec diffusion d'un
// message d'explication livré à chaque joueur (bannière stylée + notification) à sa prochaine
// connexion — demande explicite du 2026-07-06, deux confirmations vu la gravité de l'action
async function resetAllAccounts() {
  if (!isAdmin() || !sb) return;
  const msg1 = LANG === 'fr'
    ? '💥 Réinitialiser TOUS les comptes de TOUS les joueurs (silver, équipement, niveau, sac) ? Un message d\'explication leur sera montré à leur prochaine connexion. Action IRRÉVERSIBLE.'
    : '💥 Reset ALL accounts of ALL players (silver, gear, level, bag)? An explanation message will be shown to them on their next login. This action is IRREVERSIBLE.';
  if (!confirm(msg1)) return;
  const msg2 = LANG === 'fr'
    ? 'Es-tu VRAIMENT sûr ? Il n\'y a aucun moyen de récupérer la progression perdue.'
    : 'Are you REALLY sure? There is no way to recover the lost progress.';
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
    floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Échec — ' + error.message : 'Failed — ' + error.message, { hurt:true });
    return;
  }
  logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a réinitialisé TOUS les comptes (${data} comptes)`, 0xc05545);
  floatTxt(P.x, P.y, 100, LANG==='fr' ? `${data} comptes réinitialisés ✓` : `${data} accounts reset ✓`, { gold:true });
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
async function adminScreenshotPlayer() {
  if (!isAdmin() || !sb) return;
  const uuid = ($a('admResetUuidInput').value || '').trim();
  if (!uuid) return;
  const { data, error } = await sb.rpc('admin_get_player_save', { p_user_id: uuid });
  if (error) { floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Échec — ' + error.message : 'Failed — ' + error.message, { hurt:true }); return; }
  if (!data) { floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Aucune sauvegarde pour cet UUID' : 'No save found for that UUID', { hurt:true }); return; }
  openInfo((LANG==='fr'?'📸 Screenshot — ':'📸 Screenshot — ') + escapeHtml(data._pseudo||'?'), renderAdminScreenshotHtml(data));
}
function renderAdminScreenshotHtml(save) {
  const s = save.S || {};
  const eq = save.EQUIP || {};
  const inv = (save.INV || []).filter(Boolean);
  const zone = ZONES[save.zoneIdx];
  const zoneName = zone ? tr(zone.name) : (LANG==='fr'?'Velia':'Velia');
  const eqRows = Object.entries(eq).filter(([,v]) => v).map(([slot,it]) => {
    const lvl = it.optimizable ? (ENH_NAMES[it.enhLv||0] || '+0') : '';
    return `<div class="row"><span>${it.icon||'▪'} ${SLOT_LABEL[slot]||slot}</span><span class="v">${escapeHtml(it.name)}${lvl?' ('+lvl+')':''}</span></div>`;
  }).join('') || `<div class="admEmpty">${LANG==='fr'?'Aucun équipement':'No gear'}</div>`;
  const invRows = inv.map(it =>
    `<div class="row"><span>${it.icon||'▪'} ${escapeHtml(it.name)}</span><span class="v">${it.stackable ? 'x'+it.qty : (it.optimizable ? (ENH_NAMES[it.enhLv||0]||'+0') : '')}</span></div>`
  ).join('') || `<div class="admEmpty">${LANG==='fr'?'Sac vide':'Empty bag'}</div>`;
  return `
    <div class="admStatTiles">
      <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'Niveau':'Level'}</div><div class="astVal">${s.lvl||1}</div></div>
      <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'Silver':'Silver'}</div><div class="astVal">${fmt(Math.round(s.silver||0))}</div></div>
      <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'Zone':'Zone'}</div><div class="astVal">${escapeHtml(zoneName)}</div></div>
    </div>
    <div class="admSummary">${LANG==='fr'?'Sauvegardé le':'Saved on'} ${save.savedAt ? new Date(save.savedAt).toLocaleString(LANG==='fr'?'fr-FR':'en-US') : '—'}</div>
    <h3>${LANG==='fr'?'Équipement':'Equipment'}</h3>${eqRows}
    <h3>${LANG==='fr'?'Inventaire':'Inventory'} (${inv.length}/${INV_SIZE})</h3>${invRows}
  `;
}
// remise à zéro CIBLÉE d'UN SEUL joueur par UUID (demande explicite du 2026-07-06 : "ajoute côté
// admin de pouvoir réinitialiser un joueur spécifique par uuid") — même mécanique que
// resetAllAccounts (silver/équipement/niveau/sac effacés + bannière d'explication à la prochaine
// connexion), mais admin_reset_account_by_uuid() ne touche QUE la ligne de CE user_id, et la
// notification n'est insérée que pour lui (pas un broadcast à tout le monde).
async function resetAccountByUuid() {
  if (!isAdmin() || !sb) return;
  const input = $a('admResetUuidInput');
  const uuid = (input.value || '').trim();
  if (!uuid) return;
  const msg = LANG === 'fr'
    ? `🔄 Réinitialiser le compte du joueur ${uuid} (silver, équipement, niveau, sac) ? Un message d'explication lui sera montré à sa prochaine connexion. Action IRRÉVERSIBLE.`
    : `🔄 Reset player ${uuid}'s account (silver, gear, level, bag)? An explanation message will be shown to them on their next login. This action is IRREVERSIBLE.`;
  if (!confirm(msg)) return;
  const title_fr = '🔄 Ton compte a été réinitialisé';
  const title_en = '🔄 Your account has been reset';
  const body_fr = 'Un membre du staff a réinitialisé ton compte (silver, équipement, niveau, sac).<br><br>' +
    'Si tu penses qu\'il s\'agit d\'une erreur, contacte-nous sur Discord.';
  const body_en = 'A staff member has reset your account (silver, gear, level, bag).<br><br>' +
    'If you believe this is a mistake, please reach out to us on Discord.';
  const { data, error } = await sb.rpc('admin_reset_account_by_uuid', {
    p_user_id: uuid, p_title_fr: title_fr, p_title_en: title_en, p_body_fr: body_fr, p_body_en: body_en
  });
  if (error) {
    floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Échec — ' + error.message : 'Failed — ' + error.message, { hurt:true });
    return;
  }
  if (!data) {
    floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Aucun joueur trouvé avec cet UUID' : 'No player found with that UUID', { hurt:true });
    return;
  }
  logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a réinitialisé le compte du joueur \`${uuid}\``, 0xc05545);
  floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Compte réinitialisé ✓' : 'Account reset ✓', { gold:true });
  input.value = '';
}

// ---------- zone admin : stats serveur (réservé au compte admin, via RLS côté base) ----------
// tout tient désormais dans UN SEUL panneau (déclenché par le bouton "🛠️ Admin") : les actions
// (réévaluer marché, resets) en haut, puis les statistiques par catégorie sous forme d'onglets
function fmtAdmPlaytime(sec) {
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60);
  return `${h}h${String(m).padStart(2,'0')}`;
}
// construit le HTML des 3 onglets "lourds" (agrégations sur farm_events/game_saves) une fois que
// leurs données sont arrivées — séparé de openAdminPanel() pour pouvoir les patcher en arrière-plan
// sans bloquer l'ouverture du panneau (voir plus bas, correctif de lenteur du 2026-07-06)
function buildAdminAnalyticsHtml(byHour, byItem, wealth, playtimeByUser, playtimeByHour, nameByUser) {
  const hourMap = new Map();
  (byHour||[]).forEach(r => hourMap.set(r.hour, (hourMap.get(r.hour)||0) + Number(r.total_silver||0)));
  const hours = [...hourMap.entries()].sort((a,b) => new Date(b[0]) - new Date(a[0])).slice(0,24);
  const maxSilver = Math.max(1, ...hours.map(h => h[1]));
  const hourHtml = hours.map(([h,v]) => {
    const label = new Date(h).toLocaleString(LANG==='fr'?'fr-FR':'en-US', { hour:'2-digit', day:'2-digit', month:'2-digit' });
    const pct = Math.round(v/maxSilver*100);
    return `<div class="admBarRow"><span class="admBarLbl">${label}</span><div class="admBarTrack"><div class="admBar" style="width:${pct}%"></div></div><span class="admBarVal">${fmt(v)}</span></div>`;
  }).join('') || `<div class="admEmpty">${LANG==='fr'?'Pas encore de données':'No data yet'}</div>`;

  const ptRows = (playtimeByHour||[]).map(r => ({ hour:r.hour, players:Number(r.players||0), sec:Number(r.playtime_sec||0) }))
    .sort((a,b) => new Date(b.hour) - new Date(a.hour)).slice(0,24);
  const maxPlayers = Math.max(1, ...ptRows.map(r => r.players));
  const ptHourHtml = ptRows.map(r => {
    const label = new Date(r.hour).toLocaleString(LANG==='fr'?'fr-FR':'en-US', { hour:'2-digit', day:'2-digit', month:'2-digit' });
    const pct = Math.round(r.players/maxPlayers*100);
    return `<div class="admBarRow"><span class="admBarLbl">${label}</span><div class="admBarTrack"><div class="admBar" style="width:${pct}%"></div></div><span class="admBarVal">${r.players} · ${fmtAdmPlaytime(r.sec)}</span></div>`;
  }).join('') || `<div class="admEmpty">${LANG==='fr'?'Pas encore de données':'No data yet'}</div>`;

  const itemHtml = (byItem||[]).map((r,i) => `
    <tr class="${i===0?'admTop':''}">
      <td>${i===0?'🔥 ':''}${tr(r.item_name)}</td><td>${r.item_kind}</td>
      <td>${fmt(r.pickups)}</td><td>${fmt(r.total_qty)}</td><td>${fmt(r.total_silver)}</td>
    </tr>`).join('') || `<tr><td colspan="5" class="admEmpty">${LANG==='fr'?'Pas encore de données':'No data yet'}</td></tr>`;

  const silvers = (wealth||[]).map(r => Number(r.silver||0)).sort((a,b) => a-b);
  const totalSilver = silvers.reduce((a,b) => a+b, 0);
  const avgSilver = silvers.length ? Math.round(totalSilver/silvers.length) : 0;
  const medSilver = silvers.length ? silvers[Math.floor(silvers.length/2)] : 0;
  // "où partent les silver" (demande explicite du 2026-07-07, sur le même principe que l'onglet
  // Loyalties) : silver_earned est un compteur À VIE jamais décrémenté (sauf annulation d'une
  // vente via "Racheter", qui décrémente les deux en même temps) — la SEULE opération qui baisse
  // "silver" sans baisser "silver_earned" est le coût d'optimisation. Donc earned-stocké ≈ dépensé.
  const totalEarned = (wealth||[]).reduce((a,r) => a + Number(r.silver_earned||0), 0);
  const totalSpent = Math.max(0, totalEarned - totalSilver);
  const spentPct = totalEarned > 0 ? Math.round(totalSpent/totalEarned*100) : 0;
  const WEALTH_BRACKETS = [
    { max:10000,      label:'< 10k' },
    { max:100000,     label:'10k-100k' },
    { max:1000000,    label:'100k-1M' },
    { max:10000000,   label:'1M-10M' },
    { max:Infinity,   label:'10M+' },
  ];
  const bracketCounts = WEALTH_BRACKETS.map(b => 0);
  for (const v of silvers) {
    const idx = WEALTH_BRACKETS.findIndex(b => v < b.max);
    bracketCounts[idx >= 0 ? idx : WEALTH_BRACKETS.length-1]++;
  }
  const maxBracketCount = Math.max(1, ...bracketCounts);
  const histHtml = WEALTH_BRACKETS.map((b,i) => {
    const pct = Math.max(2, Math.round(bracketCounts[i]/maxBracketCount*100));
    return `<div class="admHistBar"><span class="ahbCount">${bracketCounts[i]}</span><div class="ahbFill" style="height:${pct}%"></div><span class="ahbLbl">${b.label}</span></div>`;
  }).join('');
  const wealthHtml = (wealth||[]).slice(0,20).map((r,i) => `
    <tr><td>#${i+1}</td><td>${escapeHtml((nameByUser&&nameByUser.get(r.user_id)) || (r.user_id||'').slice(0,8)+'…')}</td><td>${fmt(r.silver||0)}</td><td>${r.lvl||1}</td><td>${fmtAdmPlaytime(playtimeByUser.get(r.user_id)||0)}</td></tr>
  `).join('') || `<tr><td colspan="5" class="admEmpty">${LANG==='fr'?'Pas encore de données':'No data yet'}</td></tr>`;
  // "qui a gagné combien en combien de temps" (demande explicite du 2026-07-07) : taux de gain
  // moyen À VIE (silver_earned / temps de jeu total), pour repérer d'un coup d'œil qui monte vite
  // et qui stagne — nécessite au moins 3 min de jeu cumulées pour éviter un taux gonflé par un
  // tout petit échantillon (même précaution que le record kills/min)
  const rateRows = (wealth||[]).map(r => {
    const sec = playtimeByUser.get(r.user_id) || 0;
    const earned = Number(r.silver_earned||0);
    const hrs = sec / 3600;
    return { user_id:r.user_id, earned, sec, rate: hrs > 0.05 ? earned/hrs : 0 };
  }).filter(r => r.sec > 180).sort((a,b) => b.rate - a.rate).slice(0,15);
  const rateHtml = rateRows.map((r,i) => `
    <tr class="${i===0?'admTop':''}"><td>#${i+1}</td><td>${escapeHtml((nameByUser&&nameByUser.get(r.user_id)) || (r.user_id||'').slice(0,8)+'…')}</td>
      <td>${fmt(r.earned)}</td><td>${fmtAdmPlaytime(r.sec)}</td><td>${fmt(Math.round(r.rate))}/h</td></tr>
  `).join('') || `<tr><td colspan="5" class="admEmpty">${LANG==='fr'?'Pas encore de données (au moins 3 min de jeu requises)':'No data yet (at least 3 min playtime required)'}</td></tr>`;

  return {
    hourly: `<h3>${LANG==='fr'?'💰 Silver farmé par heure (48h)':'💰 Silver farmed per hour (48h)'}</h3>
      <div class="admBars">${hourHtml}</div>
      <h3>${LANG==='fr'?'👥 Joueurs actifs par heure (48h)':'👥 Active players per hour (48h)'}</h3>
      <div class="admSummary">${LANG==='fr'?'Nombre de joueurs distincts · temps de jeu cumulé':'Distinct player count · total playtime'}</div>
      <div class="admBars">${ptHourHtml}</div>`,
    items: `<table class="admTable">
        <thead><tr><th>${LANG==='fr'?'Objet':'Item'}</th><th>${LANG==='fr'?'Type':'Kind'}</th><th>${LANG==='fr'?'Ramassages':'Pickups'}</th><th>Qté</th><th>Silver</th></tr></thead>
        <tbody>${itemHtml}</tbody>
      </table>`,
    wealth: `<div class="admStatTiles">
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'💰 Total en jeu':'💰 Total in game'}</div><div class="astVal">${fmt(totalSilver)}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'📊 Moyenne / joueur':'📊 Average / player'}</div><div class="astVal">${fmt(avgSilver)}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'📍 Médiane':'📍 Median'}</div><div class="astVal">${fmt(medSilver)}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'👥 Joueurs':'👥 Players'}</div><div class="astVal">${silvers.length}</div></div>
      </div>
      <h3>${LANG==='fr'?'📈 Répartition des joueurs par richesse':'📈 Players by wealth bracket'}</h3>
      <div class="admHistBars">${histHtml}</div>
      <table class="admTable">
        <thead><tr><th>#</th><th>${LANG==='fr'?'Joueur':'Player'}</th><th>Silver</th><th>Niv.</th><th>${LANG==='fr'?'Temps de jeu':'Playtime'}</th></tr></thead>
        <tbody>${wealthHtml}</tbody>
      </table>`,
    // onglet "Silver" façon Loyalties : voir d'un coup d'œil ce qui est STOCKÉ (chez les joueurs)
    // vs DÉPENSÉ (sorti du jeu) — demande explicite du 2026-07-07
    silver: `<div class="admStatTiles">
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'🏦 Stocké (chez les joueurs)':'🏦 Stored (with players)'}</div><div class="astVal">${fmt(totalSilver)}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'📈 Gagné à vie (tous joueurs)':'📈 Lifetime earned (all players)'}</div><div class="astVal">${fmt(totalEarned)}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'🔻 Dépensé (sorti du jeu)':'🔻 Spent (sunk)'}</div><div class="astVal">${fmt(totalSpent)}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'📊 Moyenne stockée / joueur':'📊 Average stored / player'}</div><div class="astVal">${fmt(avgSilver)}</div></div>
      </div>
      <h3>${LANG==='fr'?'🔍 Où partent les silver ?':'🔍 Where does the silver go?'}</h3>
      <div class="admSilverFlow">
        <div class="asfBar"><div class="asfStored" style="width:${100-spentPct}%"></div><div class="asfSpent" style="width:${spentPct}%"></div></div>
        <div class="asfLegend"><span><i class="asfDotStored"></i>${LANG==='fr'?'Stocké':'Stored'} (${100-spentPct}%)</span><span><i class="asfDotSpent"></i>${LANG==='fr'?'Dépensé':'Spent'} (${spentPct}%)</span></div>
      </div>
      <div class="admHint">${LANG==='fr'
        ? 'Le silver "dépensé" sort du jeu presque exclusivement via les coûts d\'optimisation (enchantement) — le Marché Central n\'est PAS un sink, c\'est un simple transfert de silver entre joueurs (ce qu\'un vendeur reçoit, un acheteur l\'a payé). Pas encore de détail par catégorie de sink, cette vue sert à surveiller la tendance globale (le silver total dépensé devrait progressivement augmenter avec l\'optimisation).'
        : 'Silver "spent" leaves the game almost exclusively via enhancement costs — the Central Market is NOT a sink, it\'s a plain transfer of silver between players (what a seller receives, a buyer paid). No per-category sink breakdown yet, this view tracks the overall trend (total spent silver should gradually grow as players enhance gear).'}</div>
      <h3>${LANG==='fr'?'🏆 Qui gagne le plus vite ? (taux à vie)':'🏆 Who earns fastest? (lifetime rate)'}</h3>
      <div class="admSummary">${LANG==='fr'?'Silver gagné à vie ÷ temps de jeu total — classé par taux, pas par montant. Au moins 3 min de jeu requises.':'Lifetime silver earned ÷ total playtime — ranked by rate, not by amount. At least 3 min playtime required.'}</div>
      <table class="admTable">
        <thead><tr><th>#</th><th>${LANG==='fr'?'Joueur':'Player'}</th><th>${LANG==='fr'?'Gagné à vie':'Lifetime earned'}</th><th>${LANG==='fr'?'Temps de jeu':'Playtime'}</th><th>${LANG==='fr'?'Taux':'Rate'}</th></tr></thead>
        <tbody>${rateHtml}</tbody>
      </table>`,
  };
}
async function openAdminPanel() {
  if (!isAdmin() || !sb) return;
  // Le panneau s'ouvre désormais dès que la liste des joueurs (rapide, tables minuscules) est prête,
  // SANS attendre les 3 requêtes d'agrégation les plus lourdes (silver/heure, ressources farmées sur
  // farm_events qui grossit à chaque ramassage, richesses) — avant ce correctif, TOUT devait finir de
  // charger avant que quoi que ce soit ne s'affiche, d'où la lenteur perçue au clic sur "Zone Admin"
  // (2026-07-06). Ces 3 onglets affichent un "Chargement…" et se remplissent dès que prêts.
  const analyticsPromise = Promise.all([
    sb.from('admin_farm_by_hour').select('*'),
    sb.from('admin_farm_by_item').select('*').limit(20),
    sb.from('admin_wealth').select('*'),
    sb.from('admin_playtime_by_hour').select('*'),
  ]);
  const [{data: stats}, {data: playersList}] = await Promise.all([
    sb.from('player_stats').select('user_id, playtime_sec, loyalty'),
    sb.rpc('admin_list_players'),
  ]);
  const playtimeByUser = new Map((stats||[]).map(r => [r.user_id, Number(r.playtime_sec||0)]));
  // pseudo par joueur (déjà renvoyé par admin_list_players), utilisé pour afficher un nom plutôt
  // qu'un UUID tronqué dans les tableaux Richesses/Silver — demande explicite du 2026-07-07
  const nameByUser = new Map((playersList||[]).map(p => [p.user_id, p.display_name||'?']));
  // Loyalties (ex-"points de fidélité", renommé le 2026-07-07) : total en jeu + moyenne par joueur,
  // demande explicite du 2026-07-07 — pas encore de boutique où les dépenser, donc "utilisées pour"
  // reste à 0 pour l'instant (voir onglet dédié plus bas)
  const loyaltyVals = (stats||[]).map(r => Number(r.loyalty||0));
  const loyaltyTotal = loyaltyVals.reduce((a,b) => a+b, 0);
  const loyaltyAvg = loyaltyVals.length ? Math.round(loyaltyTotal/loyaltyVals.length) : 0;

  // liste des joueurs connectés/inscrits (admin uniquement) : pseudo, GS, silver, statut en
  // ligne, et 2 boutons dédiés (UUID / Inventaire) au lieu du clic-sur-la-ligne — demande explicite
  // du 2026-07-06 (plus clair que "cliquer la ligne copie l'UUID, cliquer l'icône ouvre l'inventaire")
  const playersHtml = (playersList||[]).map(p => `
    <tr>
      <td>${p.online ? '🟢' : '⚪'}</td><td>${escapeHtml(p.display_name||'?')}</td>
      <td>${fmt(p.silver||0)}</td><td>${p.gearscore||0}</td>
      <td title="${LANG==='fr'?'PA (Puissance d\'Attaque)':'AP (Attack Power)'}">${(p.ap||0).toFixed(1)}</td>
      <td title="${LANG==='fr'?'PD (Puissance de Défense)':'DP (Defense Power)'}">${(p.dp||0).toFixed(1)}</td>
      <td>${p.lvl||1}</td>
      <td title="${LANG==='fr'?'Record personnel de kills/min (à vie)':'Personal kills/min record (lifetime)'}">🏹 ${(p.best_kpm||0).toFixed(1)}</td>
      <td><button class="admUuidBtn" data-uuid="${p.user_id}">📋 UUID</button></td>
      <td><button class="admInvBtn" data-uuid="${p.user_id}" data-name="${escapeHtml(p.display_name||'?')}" title="${LANG==='fr'?'Ouvre l\'équipement porté et le sac complet (192 cases) de ce joueur, en lecture seule, dans une nouvelle fenêtre':'Opens this player\'s equipped gear and full bag (192 slots), read-only, in a new window'}">🎒 ${LANG==='fr'?'Inventaire':'Inventory'}</button></td>
    </tr>`).join('') || `<tr><td colspan="10" class="admEmpty">${LANG==='fr'?'Pas encore de données':'No data yet'}</td></tr>`;
  const loadingHtml = `<div class="admEmpty">${LANG==='fr'?'Chargement…':'Loading…'}</div>`;
  const cats = [
    { id:'players', icon:'👥', label:{fr:'Joueurs',en:'Players'},
      body: `<div class="admSummary">${LANG==='fr'?`${(playersList||[]).filter(p=>p.online).length} en ligne · ${(playersList||[]).length} inscrits`:`${(playersList||[]).filter(p=>p.online).length} online · ${(playersList||[]).length} registered`}</div>
      <table class="admTable">
        <thead><tr><th></th><th>${LANG==='fr'?'Joueur':'Player'}</th><th>Silver</th><th>GS</th><th title="${LANG==='fr'?'PA':'AP'}">PA</th><th title="${LANG==='fr'?'PD':'DP'}">PD</th><th>Niv.</th><th title="${LANG==='fr'?'Record kills/min':'Kills/min record'}">🏹</th><th></th><th></th></tr></thead>
        <tbody>${playersHtml}</tbody>
      </table>` },
    { id:'hourly', icon:'💰', label:{fr:'Silver & temps de jeu / heure',en:'Silver & playtime / hour'}, body: loadingHtml },
    { id:'silver', icon:'🏦', label:{fr:'Silver',en:'Silver'}, body: loadingHtml },
    { id:'items', icon:'📦', label:{fr:'Ressources farmées',en:'Farmed resources'}, body: loadingHtml },
    { id:'wealth', icon:'👑', label:{fr:'Richesses',en:'Wealth'}, body: loadingHtml },
    { id:'treasure', icon:'🗺️', label:{fr:'Trésor de Velia',en:'Velia Treasure'},
      // nombre moyen de monstres à tuer pour chaque morceau (1/chance) + estimation de temps à un
      // rythme de référence — demande explicite du 2026-07-06, pour évaluer la rareté en pratique
      body: `<div class="admSummary">${LANG==='fr'
        ? `Estimation à ${ADMIN_TREASURE_KPM_REF} kills/min (compare à ton propre "Kills/min" affiché en jeu)`
        : `Estimate at ${ADMIN_TREASURE_KPM_REF} kills/min (compare to your own in-game "Kills/min")`}</div>
      <table class="admTable">
        <thead><tr><th>${LANG==='fr'?'Objet':'Item'}</th><th>${LANG==='fr'?'Chance/kill':'Chance/kill'}</th>
          <th>${LANG==='fr'?'Kills en moyenne':'Avg kills'}</th><th>${LANG==='fr'?'Temps estimé':'Est. time'}</th></tr></thead>
        <tbody>${VELIA_TREASURE.map(t => {
          const avgKills = Math.round(1/t.ch);
          const avgMin = avgKills / ADMIN_TREASURE_KPM_REF;
          return `<tr><td><span style="color:${t.color}">${t.icon}</span> ${tr(t.name)}</td><td>${fmtTinyPct(t.ch)}</td>` +
            `<td>${fmt(avgKills)}</td><td>${fmtDurationMin(avgMin)}</td></tr>`;
        }).join('')}</tbody>
      </table>` },
    { id:'loyalty', icon:'🏅', label:{fr:'Loyalties',en:'Loyalties'},
      // stats de la monnaie "Loyalties" (ex-points de fidélité, renommée le 2026-07-07) : total en
      // jeu, moyenne par joueur, et "utilisées pour" — demande explicite du 2026-07-07
      body: `<div class="admStatTiles">
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'🏅 Total en jeu':'🏅 Total in game'}</div><div class="astVal">${fmt(loyaltyTotal)}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'📊 Moyenne / joueur':'📊 Average / player'}</div><div class="astVal">${fmt(loyaltyAvg)}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'👥 Joueurs':'👥 Players'}</div><div class="astVal">${loyaltyVals.length}</div></div>
      </div>
      <h3>${LANG==='fr'?'🛍️ Utilisées pour':'🛍️ Used to buy'}</h3>
      <div class="admEmpty">${LANG==='fr'
        ? 'Aucune boutique Loyalties en jeu pour l\'instant — rien à dépenser, ces stats servent à suivre l\'accumulation avant d\'ouvrir une boutique.'
        : 'No Loyalties shop in game yet — nothing to spend it on, these stats track accumulation ahead of opening a shop.'}</div>` },
  ];
  const tabsHtml = cats.map((c,i) => `<button class="catTab${i===0?' active':''}" data-cat="${c.id}">${c.icon} ${c.label[LANG]}</button>`).join('');
  const panesHtml = cats.map((c,i) => `<div class="catPane" data-cat="${c.id}"${i===0?'':' style="display:none"'}>${c.body}</div>`).join('');
  // dès que les 3 agrégations lourdes arrivent, on remplace juste le contenu "Chargement…" de leurs
  // onglets — sans jamais avoir bloqué l'affichage initial du panneau ci-dessus
  analyticsPromise.then(([{data: byHour}, {data: byItem}, {data: wealth}, {data: playtimeByHour}]) => {
    const html = buildAdminAnalyticsHtml(byHour, byItem, wealth, playtimeByUser, playtimeByHour, nameByUser);
    const body = $a('infoBody'); if (!body) return; // panneau déjà refermé entre-temps
    const hourlyPane = body.querySelector('.catPane[data-cat="hourly"]');
    const itemsPane = body.querySelector('.catPane[data-cat="items"]');
    const wealthPane = body.querySelector('.catPane[data-cat="wealth"]');
    const silverPane = body.querySelector('.catPane[data-cat="silver"]');
    if (hourlyPane) hourlyPane.innerHTML = html.hourly;
    if (itemsPane) itemsPane.innerHTML = html.items;
    if (wealthPane) wealthPane.innerHTML = html.wealth;
    if (silverPane) silverPane.innerHTML = html.silver;
  }).catch(()=>{});
  // sélecteur de World Boss : fait apparaître immédiatement le boss choisi (combat local de test),
  // sans toucher au planning horaire normal — réservé à l'admin
  const bossOptions = Object.keys(BOSS_ROSTER).map(id => `<option value="${id}">${BOSS_ROSTER[id].icon} ${BOSS_ROSTER[id].short[LANG]}</option>`).join('');
  // panneau admin scindé en 2 : "Pour moi" (test sur mon propre compte, purement local) et
  // "Pour les joueurs" (actions serveur qui touchent tout le monde)
  const actionsHtml = `
    <div class="admRiskLegend">
      <span><i style="background:#5a8fc8"></i>${LANG==='fr'?'Bleu = sans risque, perso':'Blue = safe, personal'}</span>
      <span><i style="background:var(--danger)"></i>${LANG==='fr'?'Rouge = touche TOUS les joueurs':'Red = affects ALL players'}</span>
      <span><i style="background:#7aa35e"></i>${LANG==='fr'?'Vert = gestion (rôles, boutons verrouillés)':'Green = management (roles, locked buttons)'}</span>
    </div>
    <div class="admSection riskSafe">
      <div class="admSectionTitle">👤 ${LANG==='fr'?'Pour moi — test sur mon compte':'For me — test on my account'}</div>
      <div class="admSectionSub">${LANG==='fr'?'Sans danger : ça ne touche que TON propre personnage.':'Safe: only affects YOUR own character.'}</div>
      <div class="admActions">
        <button id="btnTestSilver">💰 +1M silver</button>
        <button id="btnTestLoyalty">📬 +200 Loyalties</button>
        <button id="btnTestAch">🏅 ${LANG==='fr'?'Débloquer tous les succès':'Unlock all achievements'}</button>
        <button id="btnResetMyQuests" data-i18n="btnResetMyQuests">🔄 Réinitialiser mes quêtes</button>
        <button id="btnResetDemo" data-i18n="btnResetDemo">🔄 Réinitialiser la démo</button>
      </div>
      <div class="admBossSpawn">
        <span>${LANG==='fr'?'⚔️ Combattre un World Boss :':'⚔️ Fight a World Boss:'}</span>
        <select id="admBossSelect">${bossOptions}</select>
        <button id="btnAdmSpawnBoss">${LANG==='fr'?'Combattre maintenant':'Fight now'}</button>
      </div>
      <div class="admHint">${LANG==='fr'?'Lance un vrai boss partagé (PV communs) rien que pour toi, pour tester sans attendre le planning ni prévenir personne.':'Spawns a real shared boss (common HP) just for you, to test without waiting for the schedule or notifying anyone.'}</div>
    </div>
    <div class="admSection riskSingle">
      <div class="admSectionTitle">🎯 ${LANG==='fr'?'Un joueur précis — par UUID':'A specific player — by UUID'}</div>
      <div class="admSectionSub">⚠️ ${LANG==='fr'?'Efface silver/équipement/niveau/sac de CE joueur uniquement.':'Wipes silver/gear/level/bag for THAT player only.'}</div>
      <div class="admActions">
        <input type="text" id="admResetUuidInput" placeholder="${LANG==='fr'?'UUID du joueur':'Player UUID'}" style="width:230px">
        <button id="btnScreenshotPlayer">📸 ${LANG==='fr'?'Screenshot':'Screenshot'}</button>
        <button id="btnResetAccountByUuid" style="border-color:var(--danger);color:#e8a89f">🔄 ${LANG==='fr'?'Réinitialiser ce joueur':'Reset this player'}</button>
      </div>
      <div class="admHint">${LANG==='fr'?'Trouve l\'UUID d\'un joueur via le Classement ou ses messages en jeu (bouton "Copier UUID" dans son propre menu). "Screenshot" affiche son équipement/inventaire en lecture seule (aucune modification). Le reset envoie le même message d\'explication que le reset global, mais montré UNIQUEMENT à ce joueur.':'Find a player\'s UUID via the Leaderboard or their in-game messages (the "Copy UUID" button in their own menu). "Screenshot" shows their gear/inventory read-only (no changes made). The reset sends the same explanation message as the global reset, but shown ONLY to that player.'}</div>
    </div>
    <div class="admSection riskGlobal">
      <div class="admSectionTitle">🌍 ${LANG==='fr'?'Pour les joueurs — actions serveur':'For players — server-wide'}</div>
      <div class="admSectionSub">⚠️ ${LANG==='fr'?'Danger : ces actions touchent TOUS les joueurs connectés.':'Danger: these actions affect ALL connected players.'}</div>
      <div class="admActions">
        <button id="btnResetAllQuests" data-i18n="btnResetAllQuests">⚠️ Réinitialiser les quêtes de tous</button>
        <button id="btnResetAllAccounts" style="border-color:var(--danger);color:#e8a89f">💥 ${LANG==='fr'?'Réinitialiser TOUS les comptes':'Reset ALL accounts'}</button>
      </div>
      <div class="admHint warn">${LANG==='fr'?'"Réinitialiser TOUS les comptes" efface silver/équipement/niveau/sac de TOUT LE MONDE et affiche un message d\'explication à chaque joueur à sa prochaine connexion. Irréversible.':'"Reset ALL accounts" wipes silver/gear/level/bag for EVERYONE and shows an explanation message to each player on their next login. Irreversible.'}</div>
      <div class="admBossSpawn">
        <span>${LANG==='fr'?'🌍 Lancer un boss pour TOUS :':'🌍 Launch a boss for ALL:'}</span>
        <select id="admGlobalBossSelect">${bossOptions}</select>
        <select id="admBossDurationSelect">
          ${[2,3,4,5,6,7].map(m => `<option value="${m}"${m===4?' selected':''}>${LANG==='fr'?`~${m} min à tuer`:`~${m} min to kill`}</option>`).join('')}
        </select>
        <button id="btnAdmSpawnGlobal">${LANG==='fr'?'Lancer (9 min)':'Launch (9 min)'}</button>
        <button id="btnAdmDespawnBoss">🛑 ${LANG==='fr'?'Faire disparaître':'Despawn'}</button>
      </div>
      <div class="admHint">${LANG==='fr'?'Les PV sont calculés selon le nombre de joueurs en ligne pour viser la durée choisie (la durée réelle dépendra du stuff et du nombre de participants réels). Le boss disparaît de toute façon au bout de 9 minutes.':'HP is calculated from current online players to target the chosen duration (actual time will depend on gear and real participation). The boss despawns after 9 minutes regardless.'}</div>
    </div>
    <div class="admSection riskMgmt">
      <div class="admSectionTitle">🎭 ${LANG==='fr'?'Rôles (Modérateur / Testeur)':'Roles (Moderator / Tester)'}</div>
      <div class="admSectionSub">${LANG==='fr'?'🛡️ Modérateur : peut supprimer des messages de chat. 🧪 Testeur : accès en avant-première aux fonctionnalités pas encore publiques. Un joueur peut cumuler les deux.':'🛡️ Moderator: can delete chat messages. 🧪 Tester: early access to not-yet-public features. A player can hold both roles.'}</div>
      <div class="admBossSpawn">
        <input type="text" id="admRoleUuid" placeholder="${LANG==='fr'?'UUID du joueur':'Player UUID'}" style="flex:1;min-width:180px;background:#0d0c11;border:1px solid #333;color:var(--ink);padding:5px 7px;font-family:monospace;font-size:11px;border-radius:3px;">
        <select id="admRoleSelect" style="flex:0 0 auto;width:auto;">
          <option value="mod">🛡️ ${LANG==='fr'?'Modérateur':'Moderator'}</option>
          <option value="tester">🧪 ${LANG==='fr'?'Testeur':'Tester'}</option>
        </select>
        <button id="btnAddRole" style="flex:0 0 auto;width:auto;">${LANG==='fr'?'➕ Ajouter':'➕ Add'}</button>
      </div>
      <div id="admRoleList"><div class="admEmpty">${LANG==='fr'?'Chargement…':'Loading…'}</div></div>
    </div>
`;
  openInfo(LANG==='fr' ? '🛠️ Zone Admin' : '🛠️ Admin Zone', actionsHtml + `<div class="catTabs">${tabsHtml}</div>${panesHtml}`);
  applyI18n();
  wireCatTabs();
  refreshRoleList();
  // bouton dédié "UUID" (onglet Joueurs) : copie l'UUID dans le presse-papiers
  $a('infoBody').querySelectorAll('.admUuidBtn').forEach(btn => {
    btn.onclick = async e => {
      e.stopPropagation();
      try { await navigator.clipboard.writeText(btn.dataset.uuid); } catch(e) {}
      floatTxt(P.x, P.y, 100, LANG==='fr'?'UUID copié ✓':'UUID copied ✓', { gold:true });
    };
  });
  // bouton dédié "Inventaire" : ouvre l'inventaire dans une NOUVELLE FENÊTRE (pas dans le panneau
  // admin lui-même) et revient automatiquement sur le panneau admin quand cette fenêtre se ferme —
  // demande explicite du 2026-07-06
  $a('infoBody').querySelectorAll('.admInvBtn').forEach(btn => {
    btn.onclick = e => { e.stopPropagation(); showPlayerInventoryWindow(btn.dataset.uuid, btn.dataset.name); };
  });
  // --- pour moi ---
  $a('btnTestSilver').onclick = () => { if(!isAdmin())return; S.silver += 1000000; S.silverEarned += 1000000; refreshStatsOnly(); floatTxt(P.x,P.y,100,'+1M 🪙',{gold:true}); };
  $a('btnTestLoyalty').onclick = () => { if(!isAdmin())return; S.loyalty=(S.loyalty||0)+200; mailboxAdd('loyalty', 'Loyalties', '🏅', 200); updateMailBadge(); };
  $a('btnTestAch').onclick = () => { if(!isAdmin())return; ACHIEVEMENTS.forEach(a => { if(!S.achUnlocked[a.id]){ S.achUnlocked[a.id]=Date.now(); S.silver+=a.reward; S.silverEarned+=a.reward; } }); refreshStatsOnly(); openAdminPanel(); };
  $a('btnResetMyQuests').onclick = resetMyQuests;
  $a('btnResetDemo').onclick = resetDemo;
  // spawn un VRAI boss partagé (PV communs, top10, contribution %, joueurs en direct) — utilisé à la
  // fois par le test perso admin et par le lancement pour tous, pour que le test admin ressemble
  // exactement au vrai boss multijoueurs (demande explicite : "pas un boss solo")
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
  $a('btnAdmSpawnBoss').onclick = async () => {
    if (!isAdmin() || !sb) return;
    const id = $a('admBossSelect').value;
    const ok = await adminSpawnSharedBoss(id, 4);
    if (!ok) { floatTxt(P.x, P.y, 100, LANG==='fr'?'Échec du lancement':'Failed to launch', { hurt:true }); return; }
    $a('infoOverlay').classList.remove('open');
    startBossFight(id, true); // true = rejoint le boss PARTAGÉ qu'on vient de lancer (PV communs, top10...)
  };
  // --- pour un joueur précis ---
  $a('btnResetAccountByUuid').onclick = resetAccountByUuid;
  $a('btnScreenshotPlayer').onclick = adminScreenshotPlayer;
  // --- pour les joueurs ---
  $a('btnResetAllQuests').onclick = resetAllQuests;
  $a('btnResetAllAccounts').onclick = resetAllAccounts;
  $a('btnAdmSpawnGlobal').onclick = async () => {
    if (!isAdmin() || !sb) return;
    const id = $a('admGlobalBossSelect').value;
    const targetMin = Number($a('admBossDurationSelect').value) || 4;
    const ok = await adminSpawnSharedBoss(id, targetMin);
    if (ok) logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a lancé ${BOSS_ROSTER[id].name.fr} pour tous (~${targetMin} min)`, 0x9cc9e8);
    floatTxt(P.x, P.y, 100, ok ? (LANG==='fr'?'Boss lancé pour tous ✓':'Boss launched for all ✓') : (LANG==='fr'?'Échec du lancement':'Failed to launch'), { gold:ok, hurt:!ok });
  };
  $a('btnAdmDespawnBoss').onclick = async () => {
    if (!isAdmin() || !sb) return;
    if (!confirm(LANG==='fr'?'Faire disparaître le boss mondial pour TOUS les joueurs ?':'Despawn the world boss for ALL players?')) return;
    const { error } = await sb.rpc('admin_despawn_boss');
    if (!error) { await refreshLiveBoss(); logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a fait disparaître le boss mondial`, 0x9cc9e8); }
    floatTxt(P.x, P.y, 100, !error ? (LANG==='fr'?'Boss disparu ✓':'Boss despawned ✓') : (LANG==='fr'?'Échec':'Failed'), { gold:!error, hurt:!!error });
  };
  // --- modérateurs ---
  $a('btnAddRole').onclick = async () => {
    if (!isAdmin() || !sb) return;
    const uuid = $a('admRoleUuid').value.trim(); if (!uuid) return;
    const role = $a('admRoleSelect').value;
    const rpc = role === 'mod' ? 'admin_add_mod' : 'admin_add_tester';
    const { error } = await sb.rpc(rpc, { p_user_id: uuid });
    if (error) { $a('admRoleList').insertAdjacentHTML('afterbegin', `<div class="admHint">${error.message}</div>`); return; }
    logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a ajouté le rôle ${role==='mod'?'Modérateur':'Testeur'} à \`${uuid}\``, 0x9cc9e8);
    $a('admRoleUuid').value = ''; refreshRoleList();
  };
}
// panneau unique "Rôles" : fusionne les listes Modérateur et Testeur (2 tables distinctes côté
// serveur, chat_mods et testers) pour que l'admin ajoute/retire les deux rôles au même endroit,
// sur une seule ligne par joueur — demande explicite du 2026-07-07 ("lie les 2 systèmes")
async function refreshRoleList() {
  const el = $a('admRoleList'); if (!el || !sb) return;
  const [{ data: mods, error: modErr }, { data: testers, error: testErr }] = await Promise.all([
    sb.rpc('admin_list_mods'), sb.rpc('admin_list_testers'),
  ]);
  if (modErr || testErr) { el.innerHTML = `<div class="admHint">${(modErr||testErr).message}</div>`; return; }
  const byUser = new Map();
  (mods || []).forEach(m => byUser.set(m.user_id, { ...(byUser.get(m.user_id)||{}), user_id:m.user_id, pseudo:m.pseudo, mod:true }));
  (testers || []).forEach(m => byUser.set(m.user_id, { ...(byUser.get(m.user_id)||{}), user_id:m.user_id, pseudo:m.pseudo, tester:true }));
  const rows = [...byUser.values()];
  if (!rows.length) { el.innerHTML = `<div class="admEmpty">${LANG==='fr'?'Aucun rôle attribué':'No roles assigned'}</div>`; return; }
  el.innerHTML = rows.map(r => `<div class="modRow">` +
    `<span class="modPseudo">${escapeHtml(r.pseudo || (LANG==='fr'?'(sans pseudo)':'(no nickname)'))}</span>` +
    `<code class="modUuid">${r.user_id}</code>` +
    `<span class="roleBadges">${r.mod?'🛡️ MOD':''}${r.mod&&r.tester?' · ':''}${r.tester?'🧪 Testeur':''}</span>` +
    `${r.mod?`<button class="modRemBtn" data-uuid="${r.user_id}" data-role="mod">${LANG==='fr'?'Retirer MOD':'Remove MOD'}</button>`:''}` +
    `${r.tester?`<button class="modRemBtn" data-uuid="${r.user_id}" data-role="tester">${LANG==='fr'?'Retirer Testeur':'Remove Tester'}</button>`:''}` +
    `</div>`).join('');
  el.querySelectorAll('.modRemBtn').forEach(btn => {
    btn.onclick = async () => {
      const rpc = btn.dataset.role === 'mod' ? 'admin_remove_mod' : 'admin_remove_tester';
      const { error } = await sb.rpc(rpc, { p_user_id: btn.dataset.uuid });
      if (!error) refreshRoleList();
    };
  });
}
$a('btnAdmin').onclick = openAdminPanel;
// panneau Testeur : accès aux fonctionnalités en avant-première, sans aucun avantage de jeu.
// Pour l'instant, contenu limité (pêche/mine/etc. pas encore développés) — le panneau existe et
// se remplira au fur et à mesure des nouveautés à tester.
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
    `<div class="achInfo"><div class="achName">${a.name[LANG]}</div><div class="achDesc">${LANG==='fr'?'En développement — bientôt en test':'In development — testable soon'}</div></div></div>`).join('');
  openInfo(LANG==='fr'?'🧪 Panneau Testeur':'🧪 Tester Panel',
    `<div class="admSummary">${LANG==='fr'
      ? 'Merci de tester Velia Idle ! Ce panneau te donnera accès aux nouveautés en avant-première (sans aucun avantage en jeu — c\'est du test pur). Rien à tester pour l\'instant, mais voici ce qui arrive :'
      : 'Thanks for testing Velia Idle! This panel gives you early access to new features (no in-game advantage — pure testing). Nothing to test yet, but here\'s what\'s coming:'}</div>` +
    list);
}
$a('btnTester').onclick = openTesterPanel;

// ---------- classement public (silver, gearscore, meilleure zone, silver/h, meilleur objet) ----------
const STALE_MS = 10 * 60 * 1000; // au-delà de 10 min sans synchro, le stuff du joueur a pu changer entre-temps
function isStale(r) { return !r.updated_at || (Date.now() - new Date(r.updated_at).getTime()) > STALE_MS; }
function staleTag(r) {
  return isStale(r) ? `<span class="staleTag" title="${LANG==='fr'?'Peut-être obsolète — pas de synchro récente (équipement possiblement changé depuis)':'Possibly outdated — no recent sync (gear may have changed since)'}">⚠️</span>` : '';
}
function rankRows(rows, valueFn, fmtFn) {
  const sorted = [...rows].sort((a,b) => valueFn(b) - valueFn(a)).slice(0,20);
  return sorted.map((r,i) => `
    <tr class="${r.user_id===currentUser?.id ? 'isYou' : ''}">
      <td>#${i+1}</td><td><span class="plNameLink" data-uid="${r.user_id}" data-name="${escapeHtml(r.display_name||'?')}">${escapeHtml(r.display_name||'?')}</span> ${staleTag(r)}</td><td>${fmtFn(r)}</td>
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
  if (error) { $a('infoBody').innerHTML = `<div class="admEmpty">${error.message}</div>`; return; }
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
  const checkClosed = setInterval(() => {
    if (win.closed) { clearInterval(checkClosed); openAdminPanel(); }
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

// ---------- chat (mondial/trade/annonce) — encart bas-droite, polling toutes les 5s ----------
// "guilde" est volontairement absent : pas encore de système de guilde en jeu, l'onglet sera
// ajouté quand cette fonctionnalité existera (le canal existe déjà côté base, prêt à l'usage)
const CHAT_CHANNELS = [
  { id:'mondial', icon:'🌍', label:{fr:'Mondial',en:'World'} },
  { id:'trade',   icon:'💱', label:{fr:'Trade',en:'Trade'} },
  // canal dédié à l'anglais (2026-07-06, demande explicite : "ajoute un chat anglais") -- même
  // mécanique que les autres canaux publics, juste séparé pour ne pas noyer "Mondial" (surtout FR)
  { id:'english', icon:'🇬🇧', label:{fr:'Anglais',en:'English'} },
  { id:'annonce', icon:'📢', label:{fr:'Annonce',en:'Announcement'} },
  { id:'modéré',  icon:'🛡️', label:{fr:'Modéré',en:'Moderated'}, staff:true }, // journal des messages supprimés (admin/mods)
];
// persistance (2026-07-08, demande explicite) : canal choisi + replié/déplié survivent à un
// rechargement de page, comme le menu de gauche (voir sideMenuCollapsed)
// replié par défaut sur mobile (voir isMobileViewport, adaptation mobile du 2026-07-05) — le chat
// en 440px de large flottant en bas à droite recouvrirait sinon une bonne partie de l'écran
let chatChannel = 'mondial', chatFolded = isMobileViewport(), chatPollTimer = null;
try { chatChannel = localStorage.getItem('velia-idle-chat-channel') || 'mondial'; } catch(e) {}
try { const v = localStorage.getItem('velia-idle-chat-folded'); if (v !== null) chatFolded = v === '1'; } catch(e) {}
let chatLastRead = {}; // channel -> ISO du dernier message vu (sert au halo "non lu")
let chatUnread = {};   // channel -> true si des messages sont arrivés depuis qu'on ne le regarde plus
let chatLastPingedAt = {}; // channel -> ISO du dernier mention @moi déjà signalée (évite de répéter l'alerte à chaque sondage)
function chatVisibleChannels() { return CHAT_CHANNELS.filter(c => !c.staff || isAdmin() || myIsMod); }
function renderChatTabs() {
  const el = $a('chatTabs'); if (!el) return;
  const chans = chatVisibleChannels();
  if (!chans.some(c => c.id === chatChannel)) chatChannel = 'mondial'; // canal caché → repli
  el.innerHTML = chans.map(c => `<button class="catTab chan-${c.id==='modéré'?'annonce':c.id}${c.id===chatChannel?' active':''}${chatUnread[c.id]?' unread':''}" data-chan="${c.id}">${c.icon} ${c.label[LANG]}</button>`).join('');
  el.querySelectorAll('.catTab').forEach(btn => {
    btn.onclick = () => {
      chatChannel = btn.dataset.chan;
      try { localStorage.setItem('velia-idle-chat-channel', chatChannel); } catch(e) {}
      chatUnread[chatChannel] = false;
      el.querySelectorAll('.catTab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      btn.classList.remove('unread');
      updateChatInputVisibility();
      fetchChatMessages();
    };
  });
}
function toggleChatFold() {
  chatFolded = !chatFolded;
  try { localStorage.setItem('velia-idle-chat-folded', chatFolded ? '1' : '0'); } catch(e) {}
  $a('chatBody').style.display = chatFolded ? 'none' : '';
  $a('chatFoldBtn').textContent = chatFolded ? '▸' : '▾';
  // déplier = on considère la mention "lue", l'alerte (couleur/mouvement en boucle) s'arrête
  if (!chatFolded) { fetchChatMessages(); $a('chatWidget').classList.remove('pinged'); }
}
function updateChatInputVisibility() {
  const row = $a('chatInputRow'), note = $a('chatNote');
  if (chatChannel === 'modéré') {
    row.style.display = 'none';
    note.textContent = LANG==='fr' ? '🛡️ Journal des messages supprimés (staff)' : '🛡️ Deleted-message log (staff)';
  } else if (!currentUser || isGuest()) {
    row.style.display = 'none';
    note.textContent = LANG==='fr' ? '🔒 Connecte-toi avec un compte vérifié pour discuter' : '🔒 Sign in with a verified account to chat';
  } else if (chatChannel === 'annonce' && !isAdmin()) {
    row.style.display = 'none';
    note.textContent = LANG==='fr' ? 'Seul le staff peut poster ici' : 'Only staff can post here';
  } else {
    row.style.display = '';
    note.textContent = '';
  }
}
// formatte l'horodatage d'un message : HH:MM si aujourd'hui, sinon JJ/MM HH:MM
function fmtChatTimestamp(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date();
  const hhmm = d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0');
  const sameDay = d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth() && d.getDate()===now.getDate();
  return sameDay ? hhmm : (d.getDate().toString().padStart(2,'0')+'/'+(d.getMonth()+1).toString().padStart(2,'0')+' '+hhmm);
}
// jours passés explicitement dépliés par le joueur pour relire — le jour le plus récent reste
// toujours déplié par défaut. Barre dorée de séparation entre chaque jour — demande explicite du
// 2026-07-07 : "chaque nouveau jour est séparé d'une jolie barre dorée puis le jour précédent est
// replié, dépliable pour relire le chat"
let chatExpandedDays = new Set();
function dayKeyOf(iso) { const d = new Date(iso); return d.getFullYear()+'-'+d.getMonth()+'-'+d.getDate(); }
function fmtDaySeparator(iso) {
  const d = new Date(iso), now = new Date(), yest = new Date(now); yest.setDate(yest.getDate()-1);
  if (dayKeyOf(iso) === dayKeyOf(now.toISOString())) return LANG==='fr' ? "Aujourd'hui" : 'Today';
  if (dayKeyOf(iso) === dayKeyOf(yest.toISOString())) return LANG==='fr' ? 'Hier' : 'Yesterday';
  return d.toLocaleDateString(LANG==='fr'?'fr-FR':'en-US', { weekday:'long', day:'numeric', month:'long' });
}
function renderChatMessages(msgs, sinceTs) {
  const el = $a('chatMessages'); if (!el) return;
  const canDelete = isAdmin() || myIsMod; // admin ET modérateurs peuvent supprimer
  if (!msgs.length) { el.innerHTML = `<div class="chatEmpty">${LANG==='fr'?'Aucun message pour l\'instant':'No messages yet'}</div>`; return; }
  // regroupe les messages par jour, dans l'ordre chronologique — seul le DERNIER groupe (le plus
  // récent) est déplié par défaut, les précédents sont repliés sous leur barre dorée
  const dayGroups = [];
  for (const m of msgs) {
    const key = dayKeyOf(m.created_at);
    let g = dayGroups[dayGroups.length-1];
    if (!g || g.key !== key) { g = { key, msgs: [] }; dayGroups.push(g); }
    g.msgs.push(m);
  }
  const lastKey = dayGroups[dayGroups.length-1].key;
  el.innerHTML = dayGroups.map(g => {
    const isLast = g.key === lastKey;
    const expanded = isLast || chatExpandedDays.has(g.key);
    const bar = `<div class="chatDaySep${isLast?' current':''}" data-day="${g.key}">` +
      `<span class="chatDaySepLine"></span><span class="chatDaySepLabel">${fmtDaySeparator(g.msgs[0].created_at)}` +
      `${isLast?'':` (${g.msgs.length}) ${expanded?'▾':'▸'}`}</span><span class="chatDaySepLine"></span></div>`;
    const rows = !expanded ? '' : g.msgs.map(m => {
      // badge de rôle DEVANT le pseudo : ADMIN (or) / MOD (bleu). Le pseudo affiché vient du
      // serveur (profiles.pseudo, jamais l'email) — voir post_chat_message
      const badge = m.role === 'admin' ? '<span class="chatBadge admin">ADMIN</span> '
        : m.role === 'mod' ? '<span class="chatBadge mod">MOD</span> ' : '';
      const del = (canDelete && m.id != null) ? `<button class="chatDelBtn" data-id="${m.id}" title="Supprimer">✕</button>` : '';
      // canal Annonce : seulement le rôle (badge), pas de pseudo — juste le message en rouge
      const pseudoHtml = chatChannel === 'annonce' ? '' :
        `<span class="chatPseudo">${escapeHtml(m.pseudo || (m.role==='admin'?'Admin':(LANG==='fr'?'Joueur':'Player')))}</span> `;
      // halo temporaire sur les messages arrivés depuis la dernière lecture de CE canal —
      // demande explicite : "un halo sur le message que tu n'as pas encore lu"
      const isNew = sinceTs && new Date(m.created_at) > new Date(sinceTs);
      // mention @moi (2026-07-05, demande explicite) : fond distinct + alerte si le message vient
      // d'arriver pendant que je regarde déjà ce canal (le cas "chat replié" est géré ailleurs, voir
      // pollChatUnread/triggerChatPingAttention, car cette fonction ne tourne pas chat replié)
      const pingedMe = myPseudo && m.message.toLowerCase().includes('@'+myPseudo.toLowerCase());
      if (pingedMe && isNew) triggerChatPingAttention();
      return `<div class="chatMsg chan-${chatChannel}${isNew?' newMsg':''}${pingedMe?' pingedMe':''}">${del}` +
        `${badge}${pseudoHtml}<span class="chatText">${highlightMentions(escapeHtml(m.message))}</span>` +
        `<span class="chatTime">${fmtChatTimestamp(m.created_at)}</span></div>`;
    }).join('');
    return bar + rows;
  }).join('');
  el.querySelectorAll('.chatDaySep:not(.current)').forEach(bar => {
    bar.onclick = () => {
      const key = bar.dataset.day;
      if (chatExpandedDays.has(key)) chatExpandedDays.delete(key); else chatExpandedDays.add(key);
      renderChatMessages(msgs, sinceTs);
    };
  });
  el.scrollTop = el.scrollHeight;
  el.querySelectorAll('.chatDelBtn').forEach(btn => {
    btn.onclick = async () => {
      if (!sb) return;
      const { error } = await sb.rpc('delete_chat_message', { p_id: parseInt(btn.dataset.id,10) });
      // remonte l'erreur au lieu de l'avaler silencieusement (aide à diagnostiquer, ex: schéma
      // SQL pas encore exécuté → "function ... does not exist")
      if (error) { $a('chatNote').textContent = (LANG==='fr'?'Suppression échouée : ':'Delete failed: ') + error.message; return; }
      fetchChatMessages();
    };
  });
}
async function fetchChatMessages() {
  if (!sb || chatFolded) return;
  if (chatChannel === 'modéré') { fetchModeratedLog(); return; }
  const { data, error } = await sb.from('chat_messages').select('id, pseudo, message, role, created_at')
    .eq('channel', chatChannel).order('created_at', { ascending:false }).limit(50);
  if (error) return;
  const msgs = (data||[]).slice().reverse();
  const prevLastRead = chatLastRead[chatChannel]; // avant mise à jour : sert à souligner les nouveaux messages
  renderChatMessages(msgs, prevLastRead);
  if (msgs.length) chatLastRead[chatChannel] = msgs[msgs.length-1].created_at;
  if (chatUnread[chatChannel]) { chatUnread[chatChannel] = false; renderChatTabs(); }
}
// vérifie s'il y a des messages non lus dans les canaux qu'on ne regarde PAS actuellement (ou
// si le chat est replié) : halo sur l'onglet du canal — demande explicite "montrer qu'un message
// n'a pas été lu dans un channel où tu n'es pas"
async function pollChatUnread() {
  if (!sb || !currentUser || isGuest()) return;
  for (const c of chatVisibleChannels()) {
    if (c.id === 'modéré') continue; // pas de notion de "non lu" pour le journal modéré
    if (c.id === chatChannel && !chatFolded) continue; // canal actif et déplié : déjà tenu à jour par fetchChatMessages
    try {
      const { data } = await sb.from('chat_messages').select('message, created_at')
        .eq('channel', c.id).order('created_at', { ascending:false }).limit(1);
      const row = data && data[0];
      const last = row && row.created_at;
      if (!last) continue;
      if (!chatLastRead[c.id]) { chatLastRead[c.id] = last; continue; } // 1ère fois : juste une base, pas un "non lu"
      if (new Date(last) > new Date(chatLastRead[c.id])) {
        chatUnread[c.id] = true;
        // mention @moi arrivée alors que ce canal n'est pas activement suivi (chat replié, ou
        // canal différent) -- demande explicite du 2026-07-05 : alerte visuelle/vibration.
        // chatLastPingedAt évite de rejouer l'alerte à chaque sondage (5s) tant que le joueur
        // n'a pas rouvert le chat (chatLastRead ne bouge pas pendant qu'il reste replié)
        if (myPseudo && row.message && row.message.toLowerCase().includes('@'+myPseudo.toLowerCase())
            && new Date(last) > new Date(chatLastPingedAt[c.id] || 0)) {
          chatLastPingedAt[c.id] = last;
          triggerChatPingAttention();
        }
      }
    } catch (e) {}
  }
  renderChatTabs();
}
// journal "modéré" : messages supprimés (staff uniquement) — on affiche le pseudo, l'UUID de
// l'auteur, le message d'origine et le canal, pour tracer la modération
async function fetchModeratedLog() {
  const el = $a('chatMessages'); if (!el) return;
  const { data, error } = await sb.from('chat_deleted').select('id, channel, author_id, author_pseudo, message, deleted_at')
    .order('deleted_at', { ascending:false }).limit(50);
  if (error) { el.innerHTML = `<div class="chatEmpty">${LANG==='fr'?'Accès refusé ou schéma non exécuté':'Access denied or schema not run'}</div>`; return; }
  if (!data || !data.length) { el.innerHTML = `<div class="chatEmpty">${LANG==='fr'?'Aucun message supprimé':'No deleted messages'}</div>`; return; }
  el.innerHTML = data.map(m =>
    `<div class="chatMsg chan-annonce modMsg">` +
    `<div class="modTop"><span><span class="chatPseudo">${escapeHtml(m.author_pseudo||'?')}</span> <span class="modChan">[${escapeHtml(m.channel||'')}]</span></span>` +
    `<button class="modRestoreBtn" data-id="${m.id}" title="${LANG==='fr'?'Renvoyer ce message dans son canal':'Repost this message to its channel'}">${LANG==='fr'?'↩ Renvoyer':'↩ Restore'}</button></div>` +
    `<code class="modUuidLine">${m.author_id||''}</code>` +
    `<div class="chatText">${escapeHtml(m.message||'')}</div>` +
    `<div class="modDeletedAt">${LANG==='fr'?'Supprimé le':'Deleted on'} ${fmtChatTimestamp(m.deleted_at)}</div></div>`).join('');
  el.scrollTop = 0;
  el.querySelectorAll('.modRestoreBtn').forEach(btn => {
    btn.onclick = async () => {
      if (!sb) return;
      btn.disabled = true;
      const { error } = await sb.rpc('restore_chat_message', { p_deleted_id: parseInt(btn.dataset.id,10) });
      if (error) { $a('chatNote').textContent = (LANG==='fr'?'Renvoi échoué : ':'Restore failed: ') + error.message; btn.disabled = false; return; }
      fetchModeratedLog();
    };
  });
}
async function sendChatMessage() {
  const input = $a('chatInput');
  const val = input.value.trim();
  if (!val || !sb) return;
  input.value = '';
  // on transmet le pseudo affiché dans l'UI (myPseudo) pour que le nom dans le chat corresponde
  // exactement — utile pour les comptes Discord sans pseudo perso défini
  const { error } = await sb.rpc('post_chat_message', { p_channel: chatChannel, p_message: val, p_pseudo: myPseudo || null });
  if (error) { $a('chatNote').textContent = error.message; return; }
  fetchChatMessages();
}
$a('chatSendBtn').onclick = sendChatMessage;

// ---------- mentions @joueur dans le chat (2026-07-05, demande explicite) ----------
// liste des joueurs en ligne, rafraîchie périodiquement — sert à suggérer des mentions et à
// repérer/colorer celles déjà tapées dans un message (voir highlightMentions)
let onlinePlayersCache = [];
async function refreshOnlinePlayersCache() {
  if (!sb || !currentUser || isGuest()) return;
  try {
    const { data } = await sb.rpc('get_online_players');
    onlinePlayersCache = (data||[]).map(r => r.pseudo).filter(Boolean);
  } catch(e) {}
}
setInterval(refreshOnlinePlayersCache, 20000);
refreshOnlinePlayersCache();

let chatMentionActive = false, chatMentionStart = -1;
function updateChatMentionDropdown() {
  const input = $a('chatInput'), list = $a('chatMentionList');
  const val = input.value, pos = input.selectionStart;
  const before = val.slice(0, pos);
  const at = before.lastIndexOf('@');
  // le "@" doit être le début d'un mot (début de message ou précédé d'un espace), et rien entre
  // lui et le curseur ne doit contenir d'espace (sinon on n'est plus en train de taper la mention)
  if (at === -1 || (at > 0 && !/\s/.test(before[at-1])) || /\s/.test(before.slice(at+1))) {
    list.classList.remove('show'); chatMentionActive = false; return;
  }
  const partial = before.slice(at+1).toLowerCase();
  const matches = onlinePlayersCache
    .filter(p => p.toLowerCase() !== (myPseudo||'').toLowerCase() && p.toLowerCase().includes(partial))
    .slice(0, 8);
  if (!matches.length) { list.classList.remove('show'); chatMentionActive = false; return; }
  chatMentionActive = true; chatMentionStart = at;
  list.innerHTML = matches.map((p,i) => `<div class="chatMentionItem${i===0?' active':''}" data-p="${escapeHtml(p)}">${escapeHtml(p)}</div>`).join('');
  list.classList.add('show');
  list.querySelectorAll('.chatMentionItem').forEach(el => { el.onclick = () => applyChatMention(el.dataset.p); });
}
function applyChatMention(pseudo) {
  const input = $a('chatInput');
  const val = input.value, pos = input.selectionStart;
  const before = val.slice(0, chatMentionStart), after = val.slice(pos);
  const inserted = '@' + pseudo + ' ';
  input.value = before + inserted + after;
  const newPos = (before + inserted).length;
  input.focus();
  input.setSelectionRange(newPos, newPos);
  $a('chatMentionList').classList.remove('show');
  chatMentionActive = false;
}
// déplace la surbrillance ↑/↓ dans la liste de suggestions (demande explicite du 2026-07-05)
function moveChatMentionActive(delta) {
  const items = Array.from($a('chatMentionList').querySelectorAll('.chatMentionItem'));
  if (!items.length) return;
  let idx = items.findIndex(el => el.classList.contains('active'));
  items[idx]?.classList.remove('active');
  idx = (idx + delta + items.length) % items.length;
  items[idx].classList.add('active');
  items[idx].scrollIntoView({ block:'nearest' });
}
$a('chatInput').addEventListener('input', updateChatMentionDropdown);
$a('chatInput').addEventListener('keydown', e => {
  if (chatMentionActive && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    e.preventDefault();
    moveChatMentionActive(e.key === 'ArrowDown' ? 1 : -1);
    return;
  }
  if (chatMentionActive && (e.key === 'Enter' || e.key === 'Tab')) {
    e.preventDefault();
    const active = $a('chatMentionList').querySelector('.chatMentionItem.active') || $a('chatMentionList').querySelector('.chatMentionItem');
    if (active) applyChatMention(active.dataset.p);
    return;
  }
  if (chatMentionActive && e.key === 'Escape') { $a('chatMentionList').classList.remove('show'); chatMentionActive = false; return; }
  if (e.key === 'Enter') sendChatMessage();
});
// colore les mentions @pseudo déjà présentes dans un message (envoyé ou reçu) -- fait correspondre
// les pseudos les plus longs d'abord pour ne pas couper un pseudo qui en contient un plus court
// (ex: "Metal" ne doit pas amputer "@Metal Gear")
function highlightMentions(escapedText) {
  // 1) pseudos multi-mots CONNUS (ex: "Maxyull Test") en priorité -- extraits vers des jetons
  // temporaires (pas encore du HTML) pour que la passe générique ci-dessous ne les retraite pas
  // une 2e fois (ce qui produisait un <span> imbriqué en double)
  const placeholders = [];
  let result = escapedText;
  const multiWord = onlinePlayersCache.filter(n => /\s/.test(n)).sort((a,b) => b.length - a.length);
  for (const name of multiWord) {
    const esc = escapeHtml(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!esc) continue;
    result = result.replace(new RegExp('@' + esc + '(?!\\S)', 'gi'), m => {
      placeholders.push(`<span class="chatMention">${m}</span>`);
      return ` \x00${placeholders.length-1}\x00 `;
    });
  }
  // 2) toute mention @mot restante (2026-07-05, demande explicite : "affiche coloré pour tout
  // ceux qui le voient, pas uniquement l'envoyeur et le receveur") -- volontairement PAS limité
  // aux joueurs actuellement en ligne (onlinePlayersCache), pour rester visible même si la
  // personne mentionnée s'est déconnectée depuis, ou juste après le chargement de la page
  result = result.replace(/@(\S+)/g, (m, word) => `<span class="chatMention">@${word}</span>`);
  // 3) réinjecte les mentions multi-mots à leur place
  result = result.replace(/ ?\x00(\d+)\x00 ?/g, (m, i) => placeholders[+i]);
  return result;
}
// alerte visuelle quand JE suis mentionné et que le chat est replié (demande explicite du
// 2026-07-05 : "couleur/vibration/agrandissement du chat pour faire ouvrir") -- se rejoue à
// chaque nouvelle mention détectée, s'arrête toute seule (voir @keyframes chatPingAttention)
function triggerChatPingAttention() {
  const w = $a('chatWidget'); if (!w) return;
  w.classList.remove('pinged'); void w.offsetWidth; // relance l'animation même si déjà en cours
  w.classList.add('pinged');
  if (navigator.vibrate) { try { navigator.vibrate([120,60,120]); } catch(e) {} }
}
renderChatTabs();
updateChatInputVisibility();
// applique l'état replié/déplié restauré depuis localStorage (voir déclaration de chatFolded)
$a('chatBody').style.display = chatFolded ? 'none' : '';
$a('chatFoldBtn').textContent = chatFolded ? '▸' : '▾';
setInterval(fetchChatMessages, 5000);
setInterval(pollChatUnread, 5000);
pollChatUnread();
async function openLeaderboard() {
  if (!marketRequireAuth()) return;
  const { data, error } = await sb.from('player_stats').select('*').limit(500);
  const rows = data || [];

  const cats = [
    { id:'silver', icon:'💰', label:{fr:'Silver',en:'Silver'}, col:{fr:'Silver',en:'Silver'},
      rows: rankRows(rows, r => Number(r.silver||0), r => fmt(r.silver||0)) },
    { id:'gs', icon:'⚔️', label:{fr:'Gearscore',en:'Gearscore'}, col:{fr:'GS (PA/PD)',en:'GS (AP/DP)'},
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
    `<div class="admSummary">${LANG==='fr'?'⚠️ = pas de synchro depuis plus de 10 min, ces stats peuvent être obsolètes (équipement changé depuis)':'⚠️ = no sync for over 10 min, these stats may be outdated (gear may have changed since)'}</div>`;
  openInfo(LANG==='fr' ? '🏆 Classement' : '🏆 Leaderboard', html);
  wireCatTabs();
  wirePlayerNameLinks();
}
$a('btnLeaderboard').onclick = openLeaderboard;
$a('btnNotifCenter').onclick = openNotifCenter;
updateNotifBadge();
$a('btnAchievements').onclick = openAchievements;
$a('btnCompendium').onclick = openCompendium;
$a('ztCompendium').onclick = openCompendium;
$a('btnDailyQuests').onclick = openDailyQuests;
$a('btnMailbox').onclick = openMailbox;
$a('btnLifeskillToggle').onclick = openLifeskillPanel;
// bascule Inventaire/Assemblage dans la carte Inventaire (2026-07-06, demande explicite : "on va
// mettre le craft dans la carte de l'inventaire en haut par un bouton") -- le panneau de craft du
// Trésor de Velia (#treasureCraftPanel) vivait dans la carte Optimisation, déplacé ici
document.querySelectorAll('.invModeTab').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.invModeTab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const isCraft = btn.dataset.mode === 'craft';
    $a('invModeInvPane').style.display = isCraft ? 'none' : '';
    $a('invModeCraftPane').style.display = isCraft ? '' : 'none';
    if (isCraft) renderTreasureCraftPanel();
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
$a('farmModeBtn').onclick = toggleFarmMode;
renderFarmModeBtn();

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
async function heartbeatPresence() {
  if (!sb || !currentUser) return;
  try { await sb.rpc('heartbeat_presence', { p_is_guest: isGuest(), p_zone_idx: atVelia ? null : zoneIdx }); } catch(e) {}
}
// combien de joueurs sont actuellement dans chaque zone de farm (demande explicite du 2026-07-06)
// -- affiché dans #zoneList (voir buildZoneList dans game-core.js), rafraîchi au même rythme que
// le heartbeat pour rester à jour sans spammer le serveur
let zonePlayerCounts = {};
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

// ============================================================
// HÔTEL DES VENTES
// ============================================================
function marketRequireAuth() {
  if (!sb || !currentUser) { alert('Connecte-toi pour accéder au marché.'); return false; }
  if (isGuest()) {
    alert(LANG==='fr'
      ? 'Le Marché et le Classement sont réservés aux comptes vérifiés (protection anti-triche). Clique sur "🔗 Lier un compte" pour en créer un — ta progression actuelle sera conservée.'
      : 'The Market and Leaderboard are restricted to verified accounts (anti-cheat protection). Click "🔗 Link account" to create one — your current progress will be kept.');
    return false;
  }
  return true;
}

$a('btnMarket').onclick = () => {
  if (!marketRequireAuth()) return;
  $a('marketOverlay').classList.add('open');
  refreshMarketBrowse();
  refreshSellTab();
  refreshMarketMine();
};
$a('closeMarket').onclick = () => $a('marketOverlay').classList.remove('open');
let marketMouseDownOnBackdrop = false;
$a('marketOverlay').addEventListener('mousedown', e => { marketMouseDownOnBackdrop = (e.target.id === 'marketOverlay'); });
$a('marketOverlay').addEventListener('click', e => { if (e.target.id === 'marketOverlay' && marketMouseDownOnBackdrop) $a('marketOverlay').classList.remove('open'); });

document.querySelectorAll('.mtab').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.mtab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ['browse','sell','mine','common'].forEach(t => { $a('market'+t[0].toUpperCase()+t.slice(1)).style.display = (t===btn.dataset.tab) ? 'block' : 'none'; });
    if (btn.dataset.tab === 'browse') refreshMarketBrowse();
    if (btn.dataset.tab === 'sell') refreshSellTab();
    if (btn.dataset.tab === 'mine') refreshMarketMine();
    if (btn.dataset.tab === 'common') refreshCommonMarket();
  };
});

async function refreshMarketBrowse() {
  const box = $a('marketList');
  box.innerHTML = '<div class="mEmpty">Chargement...</div>';
  const { data, error } = await sb.from('market_listings')
    .select('id, item, price, seller_id, created_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) { box.innerHTML = '<div class="mEmpty">Erreur de chargement</div>'; return; }
  if (!data || !data.length) { box.innerHTML = '<div class="mEmpty">Aucune annonce pour le moment</div>'; return; }
  box.innerHTML = '';
  for (const l of data) {
    const it = l.item;
    const mine = l.seller_id === currentUser.id;
    const row = document.createElement('div');
    row.className = 'mRow';
    row.innerHTML = `
      <div class="mIcon" style="color:${it.color||'#c9a55a'}">${it.icon||'❔'}</div>
      <div class="mInfo"><div class="mName">${tr(it.name)}${it.qty>1?' ×'+it.qty:''}</div><div class="mSub">${it.kind||''}</div></div>
      <div class="mPrice">${fmt(l.price)} 🪙</div>
      ${mine ? '' : '<button data-id="'+l.id+'">Acheter</button>'}
    `;
    if (!mine) row.querySelector('button').onclick = () => buyListing(l.id);
    box.appendChild(row);
  }
}

async function buyListing(id) {
  const { error } = await sb.rpc('buy_listing', { p_listing_id: id });
  if (error) { alert('Achat impossible : ' + error.message); return; }
  await loadCloudSave();       // resynchronise silver + inventaire depuis le serveur
  await refreshMarketBrowse();
  await refreshMarketMine();
}

function refreshSellTab() {
  const sel = $a('sellItemSelect');
  sel.innerHTML = '<option value="">— Choisir un objet —</option>';
  for (let i = 0; i < INV_SIZE; i++) {
    const s = INV[i];
    if (!s || s.equipped) continue;
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${tr(s.name)}${s.qty>1?' (×'+s.qty+')':''} — ${s.kind}`;
    sel.appendChild(opt);
  }
}
$a('btnListItem').onclick = async () => {
  const idx = $a('sellItemSelect').value;
  const price = parseInt($a('sellPriceInput').value, 10);
  const msg = $a('sellMsg');
  if (idx === '') { msg.textContent = 'Choisis un objet.'; msg.className = 'fail'; return; }
  if (!price || price <= 0) { msg.textContent = 'Prix invalide.'; msg.className = 'fail'; return; }
  const { error } = await sb.rpc('list_item', { p_inv_index: parseInt(idx,10), p_price: price });
  if (error) { msg.textContent = 'Échec : ' + error.message; msg.className = 'fail'; return; }
  msg.textContent = 'Annonce publiée !'; msg.className = 'ok';
  $a('sellPriceInput').value = '';
  await loadCloudSave();
  refreshSellTab();
  refreshMarketMine();
};

async function refreshMarketMine() {
  const box = $a('marketMineList');
  box.innerHTML = '<div class="mEmpty">Chargement...</div>';
  const { data, error } = await sb.from('market_listings')
    .select('id, item, price, status, created_at')
    .eq('seller_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) { box.innerHTML = '<div class="mEmpty">Erreur de chargement</div>'; return; }
  if (!data || !data.length) { box.innerHTML = '<div class="mEmpty">Tu n\'as aucune annonce</div>'; return; }
  box.innerHTML = '';
  for (const l of data) {
    const it = l.item;
    const row = document.createElement('div');
    row.className = 'mRow';
    const statusLabel = l.status === 'active' ? (LANG==='fr'?'en vente':'active') : l.status === 'sold' ? (LANG==='fr'?'vendu ✓':'sold ✓') : (LANG==='fr'?'annulé':'cancelled');
    row.innerHTML = `
      <div class="mIcon" style="color:${it.color||'#c9a55a'}">${it.icon||'❔'}</div>
      <div class="mInfo"><div class="mName">${tr(it.name)}</div><div class="mSub">${statusLabel}</div></div>
      <div class="mPrice">${fmt(l.price)} 🪙</div>
      ${l.status === 'active' ? '<button data-id="'+l.id+'">Annuler</button>' : ''}
    `;
    if (l.status === 'active') row.querySelector('button').onclick = () => cancelListing(l.id);
    box.appendChild(row);
  }
}
async function cancelListing(id) {
  const { error } = await sb.rpc('cancel_listing', { p_listing_id: id });
  if (error) { alert('Annulation impossible : ' + error.message); return; }
  await loadCloudSave();
  refreshMarketMine();
  refreshSellTab();
}

// ============================================================
// MARCHÉ COMMUN v2 — vrai carnet d'ordres entre joueurs (achat ET vente), matériaux + équipement/
// bijoux. Chaque ordre bloque le silver (achat) ou l'objet (vente) jusqu'à exécution/annulation.
// Demande explicite du 2026-07-07.
// ============================================================
// catalogue des matériaux échangeables (clé stable = 'material:<nom>')
const MARKET_MATERIALS = [
  { name:'Pierre de Novice',   icon:ICO_MAT_NOVICE,     color:'#b8b8b8' },
  { name:'Pierre du Temps',    icon:ICO_MAT_TEMPS,      color:'#cfd8dc' },
  { name:'Pierre Noire',       icon:ICO_MAT_NOIRE,      color:'#7aa35e' },
  { name:'Pierre concentrée',  icon:ICO_MAT_CONCENTREE, color:'#6ea3c9' },
  { name:'Pierre de Caphras',  icon:ICO_MAT_CAPHRAS,    color:'#c9a55a' },
];
// clé de marché pour l'équipement/bijoux : regroupée par nom + niveau d'enchantement (comme le
// vrai marché BDO), puisque chaque pièce a par ailleurs des PA/PD quasi identiques pour un même nom
function marketKeyForGear(it) { return 'gear:' + it.name + '+' + (it.enhLv || 0); }

async function refreshCommonMarket() {
  wireCmSubTabs();
  refreshCmBrowse();
  refreshCmMaterialList();
  refreshCmSellPicker();
  refreshMyMarketOrders();
}
// sous-onglets du marché commun : Parcourir (vitrine, façon référence fournie le 2026-07-07) /
// Vendre / Mes ordres
const CM_TAB_PANES = { browse:'cmPaneBrowse', sell:'cmPaneSell', orders:'cmPaneOrders' };
function wireCmSubTabs() {
  document.querySelectorAll('.cmSubTab').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.cmSubTab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Object.entries(CM_TAB_PANES).forEach(([tab, paneId]) => { $a(paneId).style.display = (tab === btn.dataset.cmtab) ? '' : 'none'; });
    };
  });
}
async function refreshCmMaterialList() {
  const box = $a('marketCommonList');
  box.innerHTML = '<div class="mEmpty">Chargement...</div>';
  const rows = await Promise.all(MARKET_MATERIALS.map(async m => {
    const key = 'material:' + m.name;
    const { data } = await sb.rpc('market_order_book', { p_item_key: key });
    return { m, key, book: data || [] };
  }));
  box.innerHTML = '';
  for (const { m, key, book } of rows) {
    const owned = INV.filter(s => s && s.kind === 'material' && s.name === m.name).reduce((n,s) => n + s.qty, 0);
    const buys = book.filter(b => b.side === 'buy').sort((a,b) => b.price - a.price);
    const sells = book.filter(b => b.side === 'sell').sort((a,b) => a.price - b.price);
    const bestBuy = buys[0], bestSell = sells[0];
    const row = document.createElement('div');
    row.className = 'cmRow';
    row.innerHTML = `
      <div class="mIcon" style="color:${m.color}">${m.icon}</div>
      <div class="cmInfo"><div class="mName">${tr(m.name)}</div><div class="cmOwned">${LANG==='fr'?'Possédé':'Owned'} : ${fmt(owned)}</div></div>
      <div class="cmBook">
        <div class="cmBid">${LANG==='fr'?'Meilleur achat':'Best buy'} : ${bestBuy?fmt(bestBuy.price)+' 🪙 (×'+fmt(bestBuy.qty)+')':'—'}</div>
        <div class="cmAsk">${LANG==='fr'?'Meilleure vente':'Best sell'} : ${bestSell?fmt(bestSell.price)+' 🪙 (×'+fmt(bestSell.qty)+')':'—'}</div>
      </div>
      <div class="cmActions">
        <input type="number" class="cmQty" value="1" min="1" title="${LANG==='fr'?'Quantité':'Quantity'}">
        <input type="number" class="cmPriceInput" placeholder="${LANG==='fr'?'Prix':'Price'}" min="1">
        <button class="cmBuy">${LANG==='fr'?'Ordre d\'achat':'Buy order'}</button>
        <button class="cmSell" ${owned<=0?'disabled':''}>${LANG==='fr'?'Ordre de vente':'Sell order'}</button>
      </div>`;
    const qtyEl = row.querySelector('.cmQty'), priceEl = row.querySelector('.cmPriceInput');
    row.querySelector('.cmBuy').onclick = () => placeMarketOrder('buy', key, m.name, 'material', priceEl.value, qtyEl.value);
    row.querySelector('.cmSell').onclick = () => placeMarketOrder('sell', key, m.name, 'material', priceEl.value, qtyEl.value);
    box.appendChild(row);
  }
}

// ---------- vitrine "Parcourir" : arbre de catégories, cartes groupées par objet avec tirage par
// niveau d'enchantement, panneau de détail avec comparaison — inspirée d'une référence visuelle du
// Marché Central de BDO fournie par l'utilisateur le 2026-07-07 ----------
const CM_CATEGORIES = [
  { id:'all',       label:{fr:'★ Tout',en:'★ All'},                          kind:null,      slots:null },
  { id:'weapon',    label:{fr:'⚔️ Arme principale',en:'⚔️ Main weapon'},      kind:'gear',    slots:['weapon'] },
  { id:'secondary', label:{fr:'🗡️ Arme secondaire',en:'🗡️ Secondary weapon'}, kind:'gear',    slots:['secondary'] },
  { id:'awakening', label:{fr:'✨ Arme d\'éveil',en:'✨ Awakening weapon'},     kind:'gear',    slots:['awakening'] },
  { id:'armor',     label:{fr:'🛡️ Armure',en:'🛡️ Armor'},                    kind:'gear',    slots:['helmet','armor','gloves','boots'] },
  { id:'accessory', label:{fr:'💍 Accessoires',en:'💍 Accessories'},          kind:'jackpot', slots:null },
  { id:'artifact',  label:{fr:'🔮 Artéfact / Pierre',en:'🔮 Artifact / Stone'}, kind:'gear',   slots:['artifact1','artifact2','eqStone'] },
  { id:'material',  label:{fr:'◈ Matériaux',en:'◈ Materials'},               kind:'material', slots:null },
];
let cmActiveCat = 'all', cmListings = [], cmSelectedId = null, cmDrilldownName = null;
function renderCmCategoryTree() {
  const el = $a('cmCategoryTree'); if (!el) return;
  el.innerHTML = CM_CATEGORIES.map(c => `<button class="cmCatBtn${c.id===cmActiveCat?' active':''}" data-cat="${c.id}">${c.label[LANG]}</button>`).join('');
  el.querySelectorAll('.cmCatBtn').forEach(btn => {
    btn.onclick = () => { cmActiveCat = btn.dataset.cat; cmDrilldownName = null; cmSelectedId = null; refreshCmBrowse(); };
  });
}
function updateCmWallet() { const el = $a('cmWalletVal'); if (el) el.textContent = fmt(Math.round(S.silver)) + ' 🪙'; }
async function refreshCmBrowse() {
  renderCmCategoryTree();
  updateCmWallet();
  const list = $a('cmListingsList'); if (!list) return;
  list.innerHTML = '<div class="mEmpty">Chargement...</div>';
  const cat = CM_CATEGORIES.find(c => c.id === cmActiveCat) || CM_CATEGORIES[0];
  const { data, error } = await sb.rpc('market_listings', { p_kind: cat.kind });
  let rows = data || [];
  if (cat.slots) rows = rows.filter(l => l.item_snapshot && cat.slots.includes(l.item_snapshot.slot));
  cmListings = rows;
  if (error) { list.innerHTML = `<div class="mEmpty">${LANG==='fr'?'Erreur de chargement':'Loading error'}</div>`; return; }
  renderCmListingsList();
}
function cmListingIcon(l) {
  if (l.item_kind === 'material') { const m = MARKET_MATERIALS.find(x => x.name === l.item_name); return m ? m.icon : '◈'; }
  return l.item_snapshot ? l.item_snapshot.icon : '📦';
}
function cmListingColor(l) {
  if (l.item_kind === 'material') { const m = MARKET_MATERIALS.find(x => x.name === l.item_name); return m ? m.color : '#8fb0c9'; }
  return l.item_snapshot ? l.item_snapshot.color : '#c9a55a';
}
function cmTimeAgo(iso) {
  const sec = Math.max(0, (Date.now() - new Date(iso).getTime())/1000);
  if (sec < 3600) return Math.round(sec/60) + 'm';
  if (sec < 86400) return Math.round(sec/3600) + 'h';
  return Math.round(sec/86400) + 'j';
}
// applique recherche + tri à un tableau d'annonces (utilisé pour les 2 niveaux : vue groupée et
// vue détaillée par niveau d'enchantement)
function cmApplySearchSort(items, priceOf, timeOf) {
  const search = ($a('cmSearch').value || '').toLowerCase().trim();
  const sort = $a('cmSort').value;
  let rows = items.filter(x => !search || tr(x.name || x.item_name).toLowerCase().includes(search));
  if (sort === 'price_asc') rows.sort((a,b) => priceOf(a) - priceOf(b));
  else if (sort === 'price_desc') rows.sort((a,b) => priceOf(b) - priceOf(a));
  else rows.sort((a,b) => new Date(timeOf(b)) - new Date(timeOf(a)));
  return rows;
}
function renderCmListingsList() {
  const list = $a('cmListingsList'); if (!list) return;
  if (cmDrilldownName) { renderCmDrilldown(); return; }
  // vue groupée par NOM d'objet (comme le Marché Central de BDO) : une ligne par objet, prix le
  // plus bas / stock total ; si plusieurs niveaux d'enchantement existent, clic = tiroir détaillé
  const groups = new Map();
  for (const l of cmListings) {
    if (!groups.has(l.item_name)) groups.set(l.item_name, { name: l.item_name, kind: l.item_kind, items: [] });
    groups.get(l.item_name).items.push(l);
  }
  let rows = [...groups.values()].map(g => {
    const best = g.items.reduce((a,b) => a.price < b.price ? a : b);
    const stock = g.items.reduce((n,x) => n + (x.item_kind === 'material' ? x.qty : 1), 0);
    const enhLvs = new Set(g.items.map(x => (x.item_snapshot && x.item_snapshot.enhLv) || 0));
    return { ...g, best, stock, drilldown: enhLvs.size > 1, latest: g.items.reduce((a,b) => new Date(a.created_at)>new Date(b.created_at)?a:b).created_at };
  });
  rows = cmApplySearchSort(rows, r => r.best.price, r => r.latest);
  if (!rows.length) { list.innerHTML = `<div class="mEmpty">${LANG==='fr'?'Aucune vente en cours':'No listings right now'}</div>`; return; }
  list.innerHTML = rows.map(g => {
    const color = cmListingColor(g.best);
    return `<div class="cmListCard" data-name="${escapeHtml(g.name)}">
      <div class="cmListIcon" style="color:${color}">${cmListingIcon(g.best)}</div>
      <div class="cmListInfo">
        <div class="cmListName" style="color:${color}">${tr(g.name)}</div>
        <div class="cmListSub">${LANG==='fr'?'En stock':'In stock'} : ${fmt(g.stock)}${g.drilldown?` · ${g.items.length} ${LANG==='fr'?'niveaux':'levels'}`:''}</div>
      </div>
      <div class="cmListPrice"><div class="price">${LANG==='fr'?'dès':'from'} ${fmt(g.best.price)} 🪙</div></div>
    </div>`;
  }).join('');
  list.querySelectorAll('.cmListCard').forEach(card => {
    const g = rows.find(r => r.name === card.dataset.name);
    card.onclick = () => {
      if (g.drilldown) { cmDrilldownName = g.name; renderCmListingsList(); }
      else { cmSelectedId = g.best.id; renderCmDetailPanel(); }
    };
  });
}
// tiroir détaillé par niveau d'enchantement (façon "+13/+14/+15/PRI/DUO..." du vrai marché BDO) —
// une ligne par niveau présent, avec son propre prix le plus bas et son stock
function renderCmDrilldown() {
  const list = $a('cmListingsList'); if (!list) return;
  const items = cmListings.filter(l => l.item_name === cmDrilldownName);
  const byLv = new Map();
  for (const l of items) {
    const lv = (l.item_snapshot && l.item_snapshot.enhLv) || 0;
    if (!byLv.has(lv)) byLv.set(lv, []);
    byLv.get(lv).push(l);
  }
  let rows = [...byLv.entries()].map(([lv, arr]) => ({
    lv, best: arr.reduce((a,b) => a.price < b.price ? a : b), stock: arr.length,
    latest: arr.reduce((a,b) => new Date(a.created_at)>new Date(b.created_at)?a:b).created_at,
  }));
  rows.sort((a,b) => a.lv - b.lv);
  rows = cmApplySearchSort(rows.map(r => ({...r, name:cmDrilldownName})), r => r.best.price, r => r.latest);
  const backBtn = `<button class="cmBackBtn" id="cmBackBtn">← ${LANG==='fr'?'Retour':'Back'}</button>`;
  list.innerHTML = backBtn + rows.map(r => {
    const color = cmListingColor(r.best);
    return `<div class="cmListCard" data-lv="${r.lv}">
      <div class="cmListIcon" style="color:${color}">${cmListingIcon(r.best)}</div>
      <div class="cmListInfo">
        <div class="cmListName" style="color:${color}">${ENH_NAMES[r.lv]} ${tr(cmDrilldownName)}</div>
        <div class="cmListSub">${LANG==='fr'?'En stock':'In stock'} : ${fmt(r.stock)}</div>
      </div>
      <div class="cmListPrice"><div class="price">${LANG==='fr'?'dès':'from'} ${fmt(r.best.price)} 🪙</div></div>
    </div>`;
  }).join('');
  $a('cmBackBtn').onclick = () => { cmDrilldownName = null; renderCmListingsList(); };
  list.querySelectorAll('.cmListCard').forEach(card => {
    const r = rows.find(x => x.lv === Number(card.dataset.lv));
    card.onclick = () => { cmSelectedId = r.best.id; renderCmDetailPanel(); };
  });
}
// panneau de détail : stats complètes + comparaison face à l'équipement actuel (si gear/bijou)
function renderCmDetailPanel() {
  const panel = $a('cmDetailPanel'); if (!panel) return;
  const l = cmListings.find(x => x.id === cmSelectedId);
  if (!l) { panel.innerHTML = `<div class="mEmpty" data-i18n="cmSelectItemHint">${LANG==='fr'?'Clique un objet pour voir le détail':'Click an item to see the detail'}</div>`; return; }
  const color = cmListingColor(l);
  let statsHtml = '', compareHtml = '';
  if (l.item_kind === 'gear' || l.item_kind === 'jackpot') {
    const snap = l.item_snapshot || {};
    const eff = effectiveApDp(snap);
    const rows = [];
    if (eff.ap) rows.push(['PA', '+'+eff.ap]);
    if (eff.dp) rows.push(['PD', '+'+eff.dp]);
    if (eff.hp) rows.push(['PV', '+'+eff.hp]);
    if (snap.enhLv) rows.push([LANG==='fr'?'Niveau':'Level', ENH_NAMES[snap.enhLv]]);
    statsHtml = `<div class="cmDetailStats">${rows.map(([k,v]) => `<div class="srow"><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
    // comparaison face à ce qui est déjà équipé dans ce slot (ou la meilleure des 2 bagues/boucles)
    const slotId = l.item_kind === 'jackpot' ? accSlotFor(snap) : snap.slot;
    const accSlot = l.item_kind === 'jackpot' ? accSlotFor(snap) : null;
    let equipped = slotId ? EQUIP[slotId] : null;
    if (accSlot === 'ring') equipped = itemScore(EQUIP.ring1) <= itemScore(EQUIP.ring2) ? EQUIP.ring1 : EQUIP.ring2;
    if (accSlot === 'earring') equipped = itemScore(EQUIP.earring1) <= itemScore(EQUIP.earring2) ? EQUIP.earring1 : EQUIP.earring2;
    if (equipped) {
      const effEq = effectiveApDp(equipped);
      const cmpRows = [['PA', effEq.ap||0, eff.ap||0], ['PD', effEq.dp||0, eff.dp||0], ['PV', effEq.hp||0, eff.hp||0]]
        .filter(([,a,b]) => a || b);
      compareHtml = `<div class="cmDetailSub">${LANG==='fr'?'Face à':'Vs'} <b style="color:${equipped.color||'#c9a55a'}">${tr(equipped.name)}</b></div>
        <table class="cmCompareTable"><thead><tr><th></th><th>${LANG==='fr'?'Équipé':'Equipped'}</th><th>${LANG==='fr'?'Celui-ci':'This one'}</th><th>Δ</th></tr></thead>
        <tbody>${cmpRows.map(([k,a,b]) => {
          const delta = b - a; const cls = delta > 0 ? 'up' : delta < 0 ? 'down' : '';
          return `<tr><td>${k}</td><td>${a}</td><td>${b}</td><td class="cmDelta ${cls}">${delta>0?'+':''}${delta}</td></tr>`;
        }).join('')}</tbody></table>`;
    }
  } else {
    statsHtml = `<div class="cmDetailStats"><div class="srow"><span>${LANG==='fr'?'Quantité disponible':'Available qty'}</span><b>${fmt(l.qty)}</b></div></div>`;
  }
  panel.innerHTML = `
    <div class="cmDetailIcon" style="border-color:${color};color:${color}">${cmListingIcon(l)}</div>
    <div class="cmDetailTitle" style="color:${color}">${tr(l.item_name)}</div>
    <div class="cmDetailSub">${LANG==='fr'?'Vendu par':'Sold by'} ${escapeHtml(l.pseudo||'?')} · ${cmTimeAgo(l.created_at)}</div>
    ${statsHtml}${compareHtml}
    <div class="cmDetailSub" style="margin-top:8px">${fmt(l.price)} 🪙${l.item_kind==='material'?(' × '+fmt(l.qty)):''}</div>
    <button class="btnBuyListing">${LANG==='fr'?'Acheter':'Buy'}</button>`;
  panel.querySelector('.btnBuyListing').onclick = () => buyCmListing(l);
}
// achat en un clic : pose un ordre d'achat EXACTEMENT au prix/quantité de l'annonce → correspond
// forcément (le vendeur a déjà posé son ordre à ce prix), donc exécution immédiate garantie
async function buyCmListing(l) {
  const msg = $a('commonMsg');
  const { error } = await sb.rpc('market_place_order', {
    p_side: 'buy', p_item_key: l.item_key, p_item_name: l.item_name, p_item_kind: l.item_kind,
    p_price: l.price, p_qty: l.item_kind === 'material' ? l.qty : 1, p_inv_index: null,
  });
  if (error) { msg.textContent = (LANG==='fr'?'Échec : ':'Failed: ') + error.message; msg.className = 'fail'; return; }
  msg.textContent = LANG==='fr'?'Achat effectué ✓':'Purchase complete ✓'; msg.className = 'ok';
  await loadCloudSave();
  updateCmWallet();
  refreshCmBrowse();
  refreshMyMarketOrders();
}
$a('cmSearch').oninput = () => renderCmListingsList();
$a('cmSort').onchange = () => renderCmListingsList();
// pose un ordre d'achat ou de vente ; p_inv_index n'est nécessaire QUE pour une vente (matériau =
// trouvé automatiquement par nom puisqu'il tient en un seul emplacement empilé ; équipement/bijou =
// passé explicitement par le picker "Vendre un objet de mon sac")
async function placeMarketOrder(side, key, name, kind, priceStr, qtyStr, invIndex) {
  const msg = $a('commonMsg');
  const price = Number(priceStr), qty = parseInt(qtyStr, 10) || 1;
  if (!price || price <= 0) { msg.textContent = LANG==='fr'?'Prix invalide.':'Invalid price.'; msg.className = 'fail'; return; }
  if (side === 'sell' && invIndex == null) {
    invIndex = INV.findIndex(s => s && s.kind === kind && s.name === name);
    if (invIndex === -1) { msg.textContent = LANG==='fr'?'Tu n\'en as pas.':'You don\'t have any.'; msg.className = 'fail'; return; }
  }
  const { error } = await sb.rpc('market_place_order', {
    p_side: side, p_item_key: key, p_item_name: name, p_item_kind: kind,
    p_price: price, p_qty: kind === 'material' ? qty : 1, p_inv_index: side==='sell' ? invIndex : null,
  });
  if (error) { msg.textContent = (LANG==='fr'?'Échec : ':'Failed: ') + error.message; msg.className = 'fail'; return; }
  msg.textContent = LANG==='fr'?'Ordre posé ✓ (exécuté immédiatement si un ordre opposé compatible existait)':'Order placed ✓ (filled immediately if a compatible opposite order existed)';
  msg.className = 'ok';
  await loadCloudSave();
  refreshCommonMarket();
}
// picker "vendre un objet de mon sac" : équipement/bijoux NON équipés uniquement (les matériaux se
// vendent depuis la ligne du catalogue ci-dessus, pas ici)
function refreshCmSellPicker() {
  const sel = $a('cmSellItemSelect'); if (!sel) return;
  const items = INV.map((s,i) => ({ s, i })).filter(x => x.s && (x.s.kind === 'gear' || x.s.kind === 'jackpot') && !x.s.equipped);
  sel.innerHTML = items.length
    ? items.map(x => `<option value="${x.i}">${tr(x.s.name)}${x.s.enhLv?' '+ENH_NAMES[x.s.enhLv]:''}</option>`).join('')
    : `<option value="">${LANG==='fr'?'(Rien à vendre)':'(Nothing to sell)'}</option>`;
}
$a('btnCmListItem').onclick = () => {
  const sel = $a('cmSellItemSelect');
  const idx = Number(sel.value);
  if (Number.isNaN(idx) || sel.value === '') return;
  const it = INV[idx]; if (!it) return;
  const price = $a('cmSellPriceInput').value;
  placeMarketOrder('sell', marketKeyForGear(it), it.name, it.kind, price, 1, idx);
};
// mes ordres ouverts (achat + vente), avec bouton annuler qui rend le silver/objet bloqué
async function refreshMyMarketOrders() {
  const box = $a('cmMyOrders'); if (!box) return;
  const { data, error } = await sb.rpc('market_my_orders');
  if (error || !data || !data.length) { box.innerHTML = `<div class="mEmpty">${LANG==='fr'?'Aucun ordre':'No orders'}</div>`; return; }
  box.innerHTML = data.map(o => `
    <div class="cmRow">
      <div class="cmInfo"><div class="mName">${o.side==='buy'?'🛒':'🏷️'} ${tr(o.item_name)}</div>
        <div class="cmOwned">${o.side==='buy'?(LANG==='fr'?'Achat':'Buy'):(LANG==='fr'?'Vente':'Sell')} · ${fmt(o.price)} 🪙 × ${fmt(o.qty)}/${fmt(o.qty_original)} · ${o.status==='open'?(LANG==='fr'?'ouvert':'open'):(LANG==='fr'?'terminé':'done')}</div></div>
      ${o.status==='open' ? `<button class="cmCancelOrder" data-id="${o.id}">${LANG==='fr'?'Annuler':'Cancel'}</button>` : ''}
    </div>`).join('');
  box.querySelectorAll('.cmCancelOrder').forEach(btn => {
    btn.onclick = async () => {
      const { error } = await sb.rpc('market_cancel_order', { p_order_id: Number(btn.dataset.id) });
      if (!error) { await loadCloudSave(); refreshCommonMarket(); }
    };
  });
}

// ============================================================
// I18N — EN / FR (LANG, NAME_EN, tr déplacés en haut du script — voir début du fichier)
// ============================================================
// dictionnaire des textes statiques de l'UI (clé data-i18n → {fr, en})
const I18N = {
  btnWiki: { fr:'📖 Wiki', en:'📖 Wiki' },
  btnNotifCenter: { fr:'🔔 Notifications', en:'🔔 Notifications' },
  btnPatch: { fr:'📜 Notes de version', en:'📜 Patch Notes' },
  btnMarketLbl: { fr:'🏛️ Marché', en:'🏛️ Market' },
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
  btnSignInDiscord: { fr:'🎮 Se connecter avec Discord', en:'🎮 Sign in with Discord' },
  btnClearCacheAuth: { fr:'🧹 Vider le cache du jeu', en:'🧹 Clear game cache' },
  btnCodex: { fr:'📚 Codex', en:'📚 Codex' },
  marketTitle: { fr:'🏛️ Hôtel des ventes', en:'🏛️ Marketplace' },
  tabBuy: { fr:'Acheter', en:'Buy' },
  tabSell: { fr:'Vendre', en:'Sell' },
  tabMine: { fr:'Mes annonces', en:'My listings' },
  sellHint: { fr:'Choisis un objet de ton sac (non équipé) et fixe un prix.', en:'Pick an item from your bag (not equipped) and set a price.' },
  tabCommon: { fr:'Marché commun', en:'Common Market' },
  commonHint: { fr:'Vrai carnet d\'ordres entre joueurs : pose un prix d\'achat ou de vente, l\'argent/l\'objet reste bloqué tant que l\'ordre n\'est pas exécuté ou annulé. Si ton prix correspond au meilleur ordre opposé, l\'échange se fait automatiquement (égalité de prix = tirage au sort).',
    en:'Real order book between players: set a buy or sell price, the money/item stays locked until the order is filled or cancelled. If your price matches the best opposite order, the trade happens automatically (tied prices = random draw).' },
  priceInputPh: { fr:'Prix en silver', en:'Price in silver' },
  cmSellSectionTitle: { fr:'🎒 Vendre un objet de mon sac', en:'🎒 Sell an item from my bag' },
  btnCmListItem: { fr:'Mettre en vente', en:'List for sale' },
  cmMyOrdersTitle: { fr:'📋 Mes ordres', en:'📋 My orders' },
  cmTabBrowse: { fr:'🛒 Parcourir', en:'🛒 Browse' },
  cmTabSell: { fr:'🏷️ Vendre', en:'🏷️ Sell' },
  cmTabOrders: { fr:'📋 Mes ordres', en:'📋 My orders' },
  cmMaterialSectionTitle: { fr:'◈ Vendre / acheter des matériaux', en:'◈ Sell / buy materials' },
  cmSelectItemHint: { fr:'Clique un objet pour voir le détail', en:'Click an item to see the detail' },
  cmWalletLbl: { fr:'💰 Ton solde', en:'💰 Your balance' },
  btnListItem: { fr:'Mettre en vente', en:'List for sale' },
  cardStats: { fr:'Statistiques', en:'Stats' },
  cardZoneStats: { fr:'Stats de la zone de farm', en:'Farming zone stats' },
  lblPS: { fr:'Gearscore', en:'Gearscore' },
  lblPA: { fr:'PA effective', en:'Effective AP' },
  lblPD: { fr:'PD', en:'DP' },
  lblHpMax: { fr:'PV max', en:'Max HP' },
  lblMpMax: { fr:'Mana max', en:'Max Mana' },
  lblSpd: { fr:'Vitesse (SPD)', en:'Speed (SPD)' },
  lblDodge: { fr:'Esquive', en:'Dodge' },
  lblApZone: { fr:'PA requis (zone)', en:'AP required (zone)' },
  lblDpZone: { fr:'PD requis (zone)', en:'DP required (zone)' },
  lblWeaponBonus: { fr:'Bonus arme', en:'Weapon bonus' },
  lblArmorBonus: { fr:'Bonus armure (moy.)', en:'Armor bonus (avg)' },
  lblAiMode: { fr:'Mode IA', en:'AI mode' },
  lblKpm: { fr:'Kills / min', en:'Kills / min' },
  lblKills: { fr:'Loups abattus', en:'Monsters slain' },
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
  btnSellTrash: { fr:'🔒 Vendre trash', en:'🔒 Sell trash' },
  btnSellMats: { fr:'🔒 Vendre mat.', en:'🔒 Sell mats' },
  btnSort: { fr:'Trier', en:'Sort' },
  lblWeight: { fr:'Poids', en:'Weight' },
  cardAdvice: { fr:'Conseil de stuff', en:'Gear advice' },
  cardOpt: { fr:'Optimisation', en:'Enhancement' },
  invModeInv: { fr:'🎒 Inventaire', en:'🎒 Inventory' },
  invModeCraft: { fr:'🔧 Assemblage', en:'🔧 Craft' },
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

// ============================================================
// PATCH NOTES — condensé de toutes les versions
// ============================================================
// chaque ligne est désormais { t:'new'|'change'|'fix'|'exploit', tx:'texte', plat:'mobile'? }
// plat:'mobile' (2026-07-05) : marque une ligne qui ne concerne QUE tablette/téléphone, affichée
// avec un 2e badge à côté du type — absent = concerne toutes les plateformes.
const PATCH_NOTES = [
  { v:'V213', d:'09/07/2026 10:00', name:{fr:'Cases d\'équipement simplifiées : icônes ⬆️/📍 dédiées, clic = infos seulement', en:'Simplified equipment slots: dedicated ⬆️/📍 icons, click = info only'}, fr:[
      {t:'change', sub:'interface', tx:'Cliquer sur une case équipée n\'affiche plus que le nom et les stats de la pièce ; cliquer sur une case vide n\'affiche plus que le nom du slot et où le farmer (déséquiper reste au double-clic, optimiser reste sur le bouton 🔧)'},
      {t:'new', sub:'interface', tx:'Nouvelle icône ⬆️ en coin sur une case équipée : raccourci direct vers la zone où trouver une meilleure pièce pour ce socle'},
      {t:'new', sub:'interface', tx:'Nouvelle icône 📍 en coin sur une case vide : raccourci direct vers la zone où farmer l\'objet manquant'},
    ], en:[
      {t:'change', sub:'interface', tx:'Clicking an equipped slot now only shows the piece\'s name and stats; clicking an empty slot now only shows the slot name and where to farm it (unequip stays on double-click, enhance stays on the 🔧 button)'},
      {t:'new', sub:'interface', tx:'New ⬆️ corner icon on an equipped slot: direct shortcut to the zone where a better piece for that slot can be found'},
      {t:'new', sub:'interface', tx:'New 📍 corner icon on an empty slot: direct shortcut to the zone where the missing item can be farmed'},
    ] },
  { v:'V212', d:'08/07/2026 16:30', name:{fr:'Mode auto "jusqu\'au prochain gain", prix des potions par zone, trésor à 0.33%', en:'"Until next gain" auto mode, per-zone potion prices, treasure at 0.33%'}, fr:[
      {t:'change', sub:'loot', tx:'Chance du "Bout du trésor de Velia" ajustée à 0.33% (au lieu de 0.5%)'},
      {t:'new', sub:'optimisation', tx:'Nouveau mode d\'auto-optimisation : "Jusqu\'au prochain gain de PA/PD" — s\'arrête automatiquement dès que le PA ou le PD affiché de la pièce augmente réellement, sans avoir à deviner à quel palier précis ça se produit (voir le fix du menu déroulant de la mise à jour précédente)'},
      {t:'change', sub:'economie', severity:'major', tx:'Le prix des potions (vie et mana) suit désormais le revenu de base de la zone actuelle au lieu d\'être fixe partout — les prix affichés/débités restent calibrés sur Camp des Loups en tout début de jeu, puis augmentent avec la zone pour rester un coût cohérent avec le loot d\'or gagné là où on farme'},
    ], en:[
      {t:'change', sub:'loot', tx:'"Bout du trésor de Velia" chance adjusted to 0.33% (from 0.5%)'},
      {t:'new', sub:'optimisation', tx:'New auto-enhance mode: "Until the next AP/DP gain" — automatically stops as soon as the piece\'s displayed AP or DP actually increases, no more guessing which exact level that happens at (see the dropdown fix from the previous update)'},
      {t:'change', sub:'economie', severity:'major', tx:'Potion prices (HP and mana) now follow the current zone\'s base income instead of being flat everywhere — displayed/charged prices stay calibrated on Camp des Loups at the very start, then rise with the zone to remain a cost consistent with the gold looted where you\'re farming'},
    ] },
  { v:'V211', d:'08/07/2026 16:00', name:{fr:'Fix menu d\'optimisation : le gain de PA ne se répète plus sur plusieurs paliers', en:'Fix enhancement menu: the AP gain no longer repeats across several levels'}, fr:[
      {t:'fix', sub:'interface', tx:'Depuis le passage à l\'arrondi vers le bas (voir mise à jour précédente), le menu déroulant d\'optimisation pouvait afficher "(+1 PA)" identique sur 7 paliers d\'affilée (la fraction accumulée n\'avait pas encore franchi le point suivant) — donnait l\'impression d\'un gain figé. Le gain ne s\'affiche désormais qu\'au palier où il change réellement : "+1 PA" apparaît une seule fois, puis rien jusqu\'à "+2 PA" au prochain vrai palier'},
    ], en:[
      {t:'fix', sub:'interface', tx:'Since switching to round-down (see previous update), the enhancement dropdown could show the identical "(+1 AP)" across 7 levels in a row (the accumulated fraction hadn\'t crossed the next point yet) — looked like a frozen/stuck gain. The gain now only shows on the level where it actually changes: "+1 AP" appears once, then nothing until "+2 AP" at the next real milestone'},
    ] },
  { v:'V210', d:'08/07/2026 15:30', name:{fr:'PA/PD sans virgule, zone dangereuse = mort garantie en 100% des cas', en:'AP/DP without decimals, dangerous zone = guaranteed death 100% of the time'}, fr:[
      {t:'change', sub:'interface', tx:'Le PA/PD effectif affiché (stats, résumé équipement, menu d\'optimisation) est désormais un nombre entier, arrondi vers le BAS — jamais de virgule, et jamais plus que ce qui est réellement acquis'},
      {t:'change', sub:'combat', severity:'major', tx:'Zone DANGEREUSE : la mort est maintenant garantie à 100% dès le premier coup qui touche (plus de dégât insuffisant possible), l\'esquive automatique et la téléportation défensive sont désactivées, et TOUS les packs à moins de 400 unités s\'activent d\'un coup (pas seulement celui visé) — le badge représente désormais un risque de mort certaine et immédiate, pas probable'},
      {t:'new', sub:'systeme', tx:'5 tests de régression ajoutés pour ces 2 points (mort garantie sur 20 essais même avec un dégât brut quasi nul, aggro à distance, absence de décimale dans l\'affichage PA/PD)'},
    ], en:[
      {t:'change', sub:'interface', tx:'The displayed effective AP/DP (stats, gear summary, enhancement menu) is now a whole number, rounded DOWN — never a decimal, and never more than what\'s actually earned'},
      {t:'change', sub:'combat', severity:'major', tx:'DANGEROUS zone: death is now guaranteed 100% of the time on the very first hit that lands (no more insufficient-damage rolls), automatic dodge and the defensive teleport are disabled, and ALL packs within 400 units activate at once (not just the targeted one) — the badge now represents a certain, immediate death risk, not just a probable one'},
      {t:'new', sub:'systeme', tx:'5 regression tests added for these 2 points (guaranteed death over 20 trials even with near-zero raw mob damage, ranged aggro, no decimals in AP/DP display)'},
    ] },
  { v:'V209', d:'08/07/2026 15:00', name:{fr:'Le personnage change d\'apparence selon le stuff, potion vie+mana fusionnée', en:'Character appearance changes with gear, merged HP+mana potion'}, fr:[
      {t:'new', sub:'graphismes', tx:'L\'apparence du personnage (robe, chapeau, bâton) change désormais selon la couleur du meilleur palier de stuff équipé (arme ou armure) : gris/blanc restent sobres, vert et bleu ajoutent des cornes au chapeau, le palier bleu ajoute une cape. Si une pièce d\'éveil est équipée, 2 orbes flottent en orbite autour du personnage'},
      {t:'change', sub:'interface', tx:'Les 2 cases séparées de potion (vie / mana) sont fusionnées en une seule icône (fioles entrelacées) — un clic ouvre désormais un panneau unique listant les tailles de potion de vie ET les infos de la potion de mana, au lieu de 2 emplacements distincts'},
    ], en:[
      {t:'new', sub:'graphismes', tx:'The character\'s appearance (robe, hat, staff) now changes based on the color of the best equipped gear tier (weapon or armor): grey/white stay plain, green and blue add horns to the hat, blue adds a cape. If an awakening piece is equipped, 2 orbs float in orbit around the character'},
      {t:'change', sub:'interface', tx:'The 2 separate potion slots (HP / mana) are merged into a single icon (intertwined vials) — one click now opens a single panel listing HP potion sizes AND mana potion info, instead of 2 separate slots'},
    ] },
  { v:'V208', d:'08/07/2026 14:30', name:{fr:'PA des bijoux recalculé, stuff de Camp des Loups vraiment utile', en:'Jewelry AP recalculated, Wolf Camp gear actually useful'}, fr:[
      {t:'fix', sub:'equipements', severity:'major', tx:'Les PA donnés par un bijou (bague/collier/boucle/ceinture) étaient une valeur figée par zone, jamais recalculée depuis les rééquilibrages précédents — complètement désynchronisée du reste du stuff. Recalculés dynamiquement comme tout le reste (rétroactif sur les bijoux déjà en sac/équipés)'},
      {t:'change', sub:'equipements', tx:'Camp des Loups (1ère zone) : le stuff qu\'on y loot (casque, Bâton Naru, bagues) est désormais calibré sur la zone SUIVANTE plutôt que sur sa propre difficulté (volontairement basse pour rester jouable sans arme) — un casque+arme+2 bagues correctement enchantés (+12) donnaient 8.5 PA effectif (ZONE DANGEREUSE face à la zone suivante) ; ils en donnent maintenant 13 (ZONE DIFFICILE, plus DANGEREUSE)'},
      {t:'new', sub:'systeme', tx:'2 tests de régression ajoutés pour ce cas précis (AP des bijoux jamais figé à 0, stuff réaliste de Camp des Loups atteint la difficulté attendue face à la zone suivante)'},
    ], en:[
      {t:'fix', sub:'equipements', severity:'major', tx:'The AP granted by jewelry (ring/necklace/earring/belt) was a value frozen per zone, never recalculated through previous rebalances — completely out of sync with the rest of the gear. Now recalculated dynamically like everything else (retroactive on jewelry already in bag/equipped)'},
      {t:'change', sub:'equipements', tx:'Camp des Loups (1st zone): the gear looted there (helmet, Naru Staff, rings) is now calibrated against the NEXT zone rather than its own difficulty (deliberately low to stay playable weaponless) — a properly enhanced (+12) helmet+weapon+2 rings gave 8.5 effective AP (DANGEROUS ZONE against the next zone); they now give 13 (HARD ZONE, no longer dangerous)'},
      {t:'new', sub:'systeme', tx:'2 regression tests added for this exact case (jewelry AP never frozen at 0, a realistic Camp des Loups loadout reaches the expected difficulty against the next zone)'},
    ] },
  { v:'V207', d:'08/07/2026 14:00', name:{fr:'Suite de tests de régression (coulisses)', en:'Regression test suite (behind the scenes)'}, fr:[
      {t:'new', sub:'systeme', tx:'Ajout d\'une suite de tests de régression pour la progression PA/PD (monotonie des zones, ratios de transition de palier, génération des icônes, plafond de dégâts) — purement un outil de développement, invisible en jeu, sert à repérer automatiquement ce genre de régression avant qu\'un joueur ne la remarque (comme le fix de Camp Rhutum plus tôt aujourd\'hui)'},
    ], en:[
      {t:'new', sub:'systeme', tx:'Added a regression test suite for AP/DP progression (zone monotonicity, tier-transition ratios, icon generation, damage cap) — a pure development tool, invisible in-game, meant to catch this kind of regression automatically before a player notices it (like the Camp Rhutum fix earlier today)'},
    ] },
  { v:'V206', d:'08/07/2026 13:30', name:{fr:'Zone dangereuse = vrai risque de one-shot, ceinture redessinée, bijoux recolorés', en:'Dangerous zone = real one-shot risk, redesigned belt, recolored jewelry'}, fr:[
      {t:'change', sub:'combat', severity:'major', tx:'Marche arrière sur le plafond de dégâts ajouté plus tôt aujourd\'hui : en ZONE DANGEREUSE spécifiquement, les monstres peuvent de nouveau te tuer d\'un seul coup si le stuff est très en dessous du seuil — c\'est le vrai risque que ce badge doit représenter. Les autres zones (DIFFICILE et mieux) gardent le plafond de 30% des PV max cumulé sur 1s, pour ne jamais surprendre avec une mort instantanée quand le stuff n\'est QUE légèrement insuffisant'},
      {t:'new', sub:'graphismes', tx:'Nouvelle icône de ceinture dans le même style que le reste du set (sangle teintée par palier, boucle au contour coloré, rivets/gemmes de rareté)'},
      {t:'change', sub:'graphismes', tx:'Le contour des bagues, colliers et boucles d\'oreille reprend maintenant la couleur du palier (vert/bleu) au lieu d\'un contour sombre neutre'},
    ], en:[
      {t:'change', sub:'combat', severity:'major', tx:'Reverted the damage cap added earlier today: in DANGEROUS ZONES specifically, monsters can once again kill you in one hit if your gear is far below the threshold — that\'s the real risk this badge is meant to represent. Other zones (HARD and above) keep the 30% max-HP cap accumulated over 1s, so a merely slightly-insufficient gear never gets an instant-death surprise'},
      {t:'new', sub:'graphismes', tx:'New belt icon matching the rest of the set\'s style (tier-tinted strap, colored buckle outline, rarity rivets/gems)'},
      {t:'change', sub:'graphismes', tx:'Rings, necklaces, and earrings now show their tier color (green/blue) on their outline instead of a neutral dark outline'},
    ] },
  { v:'V205', d:'08/07/2026 13:00', name:{fr:'Fix one-shot en zone dangereuse, Bâton Naru exclusif à Camp des Loups', en:'Fix dangerous-zone one-shots, Naru Staff exclusive to Wolf Camp'}, fr:[
      {t:'fix', sub:'combat', severity:'major', tx:'En zone dangereuse, plusieurs loups d\'un même pack (ou de plusieurs packs agressifs à la fois) pouvaient chacun toucher au même instant : chaque coup individuel restait plafonné à 30% des PV max, mais l\'ensemble s\'additionnait en une fraction de seconde et équivalait à un one-shot. Le plafond de 30% s\'applique désormais aux dégâts TOTAUX encaissés sur 1 seconde glissante, plus par coup isolé'},
      {t:'change', sub:'equipements', tx:'Le Bâton Naru (arme de départ du palier gris) se loot désormais exclusivement à Camp des Loups (1ère zone du jeu) au lieu de Ruines de Protty — cohérent avec le spawn sans arme : la toute première zone donne directement de quoi se défendre'},
    ], en:[
      {t:'fix', sub:'combat', severity:'major', tx:'In dangerous zones, several wolves from the same pack (or from multiple aggressive packs at once) could each land a hit at the same instant: each individual hit stayed capped at 30% max HP, but they added up within a fraction of a second into an effective one-shot. The 30% cap now applies to TOTAL damage taken over a rolling 1-second window, not per isolated hit'},
      {t:'change', sub:'equipements', tx:'The Naru Staff (Grey tier\'s starting weapon) now drops exclusively from Camp des Loups (the game\'s very first zone) instead of Ruines de Protty — consistent with the weaponless spawn: the very first zone directly gives you something to defend yourself with'},
    ] },
  { v:'V204', d:'08/07/2026 12:30', name:{fr:'Fix : la PD de Camp Rhutum retombait sous la zone précédente', en:'Fix: Camp Rhutum\'s DP dropped below the previous zone'}, fr:[
      {t:'fix', sub:'zones', tx:'La PD requise de Camp Rhutum (1ère zone du palier Blanc) était passée à 20, sous les 23 PD de la zone précédente — une régression introduite par le rééquilibrage de la mise à jour précédente. Corrigée (24 PD), avec les zones suivantes du palier (Ferme Shultz, Colonie Sausan, Île d\'Iliya) réajustées en proportion'},
    ], en:[
      {t:'fix', sub:'zones', tx:'Camp Rhutum\'s (first White tier zone) required DP had dropped to 20, below the previous zone\'s 23 DP — a regression introduced by the previous update\'s rebalance. Fixed (24 DP), with the tier\'s following zones (Ferme Shultz, Colonie Sausan, Île d\'Iliya) adjusted proportionally'},
    ] },
  { v:'V203', d:'08/07/2026 12:00', name:{fr:'Plafond de stuff rehaussé à 320 PA, transitions de palier plus dures', en:'Gear ceiling raised to 320 AP, harder tier transitions'}, fr:[
      {t:'change', sub:'zones', severity:'major', tx:'Le plafond de PA requis en fin de jeu (Forêt de Polly) passe de 145 à 320 (PD : 156 → 175). Les paliers Blanc/Vert/Bleu sont recalibrés pour qu\'un stuff complet du palier précédent, poussé en moyenne à PRI, retrouve son rôle de vrai jalon de progression pour passer au palier suivant'},
      {t:'change', sub:'zones', tx:'Chaque transition vers un nouveau palier de couleur (zones 3, 6 et 9) est délibérément plus dure que la progression fluide à l\'intérieur d\'un palier — le ratio PA/PD retombe nettement à l\'entrée d\'un nouveau palier avant de remonter au fil de ses zones, pour bien marquer le cap'},
      {t:'change', sub:'equipements', tx:'Le palier Gris (zones de départ) n\'est pas concerné par ce rééquilibrage, déjà calé sur le spawn sans arme'},
    ], en:[
      {t:'change', sub:'zones', severity:'major', tx:'The end-game required AP ceiling (Forêt de Polly) goes from 145 to 320 (DP: 156 → 175). The White/Green/Blue tiers are recalibrated so a full previous-tier set, enhanced to PRI on average, is once again a real progression milestone for moving up a tier'},
      {t:'change', sub:'zones', tx:'Every move into a new color tier (zones 3, 6, and 9) is deliberately harder than the smooth progression within a tier — the AP/DP ratio drops noticeably right at the start of a new tier before climbing back up across its zones, to properly mark the milestone'},
      {t:'change', sub:'equipements', tx:'The Grey tier (starting zones) isn\'t affected by this rebalance, already tuned for the weaponless spawn'},
    ] },
  { v:'V202', d:'08/07/2026 11:00', name:{fr:'Nouveaux joueurs et notes de version, 3 nouveaux modes d\'optimisation auto, loupe sur le loot', en:'New players and patch notes, 3 new auto-enhance modes, loot magnifier'}, fr:[
      {t:'fix', sub:'ux', severity:'major', tx:'Un nouveau joueur voyait un nombre absurde de notes de version "non lues" (tout l\'historique jamais publié). Désormais, seule la toute dernière version compte comme nouvelle à la création du compte — sa page de notes de version s\'ouvre directement dessus, pas besoin de fouiller un historique qu\'il n\'a pas vécu'},
      {t:'new', sub:'optimisation', tx:'3 nouveaux modes pour l\'auto-optimisation, en plus de "jusqu\'à un palier" : "en boucle" (continue jusqu\'à rupture de matériau), "jusqu\'au premier échec" (s\'arrête dès le 1er raté), "jusqu\'à épuisement des Pierres de Cron" (pousse un palier risqué tant qu\'il reste de la protection)'},
      {t:'new', sub:'interface', tx:'Les icônes de la table de loot s\'agrandissent automatiquement au survol (aperçu façon loupe) pour mieux voir le détail de chaque pièce'},
      {t:'fix', sub:'interface', tx:'Filet de sécurité ajouté sur l\'inventaire et le sac protégé du Compendium : si jamais un objet équipable n\'a pas d\'icône propre (vieille sauvegarde), il retombe sur l\'icône générique de son emplacement au lieu d\'afficher une case vide'},
    ], en:[
      {t:'fix', sub:'ux', severity:'major', tx:'A new player saw an absurd number of "unread" patch notes (the entire history ever published). Now only the very latest version counts as new at account creation — their patch notes page opens straight on it, no need to dig through history they never lived through'},
      {t:'new', sub:'optimisation', tx:'3 new modes for auto-enhance, alongside "until a target level": "on loop" (keeps going until out of material), "until the first failure" (stops at the first miss), "until out of Cron Stones" (push a risky tier as long as protection remains)'},
      {t:'new', sub:'interface', tx:'Loot table icons now automatically zoom in on hover (magnifier-style preview) to see each piece\'s detail more clearly'},
      {t:'fix', sub:'interface', tx:'Safety net added to the inventory grid and the Compendium\'s protected bag: if an equippable item somehow has no icon of its own (old save), it now falls back to its slot\'s generic icon instead of showing an empty cell'},
    ] },
  { v:'V201', d:'08/07/2026 10:00', name:{fr:'Pierre de Cron cliquable, spawn sans arme, zones rééquilibrées', en:'Clickable Cron Stone, empty spawn, rebalanced zones'}, fr:[
      {t:'change', sub:'interface', tx:'La case Pierre de Cron du panneau d\'optimisation sert désormais elle-même de bouton on/off (clique dessus pour activer/désactiver) — grisée quand désactivée. Remplace l\'ancienne case à cocher séparée'},
      {t:'change', sub:'equipements', tx:'Le personnage ne spawn plus avec un "Bâton de Grunil" par défaut — l\'emplacement d\'arme principale démarre vide, comme tous les autres emplacements'},
      {t:'fix', sub:'zones', severity:'major', tx:'Le passage vers le palier de stuff suivant était devenu bien plus dur que prévu depuis qu\'une zone ne garantit plus qu\'UNE SEULE pièce d\'équipement : un stuff complet du palier précédent poussé jusqu\'à PRI ne donnait qu\'un ratio PA/PD de 0.29-0.45 (ZONE DANGEREUSE) face à la 1ère zone du palier suivant. Toutes les zones à partir de Camp Rhutum recalibrées pour qu\'un tel stuff PRI atteigne ~0.8 (ZONE DIFFICILE, plus DANGEREUSE)'},
      {t:'fix', sub:'zones', tx:'Camp des Loups (1ère zone du jeu) rééquilibrée suite au spawn sans arme : un personnage tout juste créé y tombait à 0.27 (ZONE DANGEREUSE) au lieu de ~0.93 avec l\'ancienne arme de départ'},
    ], en:[
      {t:'change', sub:'interface', tx:'The Cron Stone slot in the optimization panel now doubles as an on/off button (click it to enable/disable) — greyed out when disabled. Replaces the old separate checkbox'},
      {t:'change', sub:'equipements', tx:'The character no longer spawns with a default "Grunil Staff" — the main weapon slot now starts empty, like every other slot'},
      {t:'fix', sub:'zones', severity:'major', tx:'Moving up to the next gear tier had become far harder than intended since a zone now guarantees only ONE piece of gear: a full previous-tier set pushed to PRI only reached a 0.29-0.45 AP/DP ratio (DANGEROUS ZONE) against the next tier\'s first zone. Every zone from Camp Rhutum onward recalibrated so such a PRI set reaches ~0.8 (HARD ZONE, no longer dangerous)'},
      {t:'fix', sub:'zones', tx:'Camp des Loups (the game\'s very first zone) rebalanced following the weaponless spawn: a freshly created character dropped to a 0.27 ratio (DANGEROUS ZONE) there instead of ~0.93 with the old starter weapon'},
    ] },
  { v:'V200', d:'08/07/2026 09:30', name:{fr:'Les nouvelles icônes de stuff arrivent aussi dans la table de loot', en:'The new gear icons now show up in the loot table too'}, fr:[
      {t:'fix', sub:'interface', tx:'La table de loot (et le récapitulatif condensé des zones de Velia) affichait encore un glyphe générique (⚔️/💍) partagé par toutes les pièces d\'un même type — elle montre désormais la VRAIE icône de chaque pièce (casque, arme, bijou...), avec sa couleur et son ornementation de palier'},
    ], en:[
      {t:'fix', sub:'interface', tx:'The loot table (and the condensed Velia zone summary) still showed a generic shared glyph (⚔️/💍) for every piece of a given type — it now shows each piece\'s REAL icon, with its tier color and rarity ornamentation'},
    ] },
  { v:'V199', d:'08/07/2026 09:00', name:{fr:'Refonte complète du stuff : sorcier, ornements par rareté', en:'Full gear rework: wizard theme, rarity ornaments'}, fr:[
      {t:'new', sub:'graphismes', tx:'Toutes les icônes d\'équipement redessinées et alignées sur la classe sorcier : bâton (arme principale), dague (arme secondaire), deux sphères Aad en lévitation (éveil), casque à fente en Y, cuirasse cintrée à épaulières, gants griffus, bottes à genouillère, collier/bague/boucles d\'oreille à pendentif'},
      {t:'new', sub:'graphismes', tx:'Ornementation cohérente par rareté sur TOUTE pièce de stuff : rien au gris/blanc, 4 rivets au palier Vert (Yuria), 4 gemmes + 1 losange central au palier Bleu (Grunil)'},
      {t:'new', sub:'graphismes', tx:'Fond de case plus abouti selon la rareté (remplace le halo autour de l\'objet) : uni au gris, bandeau clair au blanc, teinte + coins marqués au vert, teinte + coins ornés de losanges au bleu'},
      {t:'change', sub:'equipements', tx:'Arme principale renommée Bâton (au lieu d\'Épée/Lame) sur les 4 paliers, pour coller au thème sorcier — aucun impact sur les statistiques'},
    ], en:[
      {t:'new', sub:'graphismes', tx:'Every equipment icon redrawn around the wizard theme: staff (main weapon), dagger (secondary weapon), two floating Aad spheres (awakening), Y-slit helmet, waisted cuirass with pauldrons, clawed gloves, greaved boots, pendant necklace/ring/earrings'},
      {t:'new', sub:'graphismes', tx:'Consistent rarity ornamentation on EVERY gear piece: none at grey/white, 4 rivets at Green tier (Yuria), 4 gems + 1 center diamond at Blue tier (Grunil)'},
      {t:'new', sub:'graphismes', tx:'More refined slot background by rarity (replaces the glow around the item): plain at grey, light banner at white, tinted with marked corners at green, tinted with ornate diamond corners at blue'},
      {t:'change', sub:'equipements', tx:'Main weapon renamed Staff (instead of Sword/Blade) across all 4 tiers to fit the wizard theme — no stat impact'},
    ] },
  { v:'V198', d:'06/07/2026 11:00', name:{fr:'Halo de couleur sur le stuff, pastille de notes déplacée dans le panneau', en:'Color halo on gear, unread badge moved into the panel'}, fr:[
      {t:'new', sub:'graphismes', tx:'Chaque pièce équipée (arme, armure, bijou...) et chaque emplacement du panneau d\'optimisation (pièce en cours, matériau, Pierre de Cron) affiche désormais un halo lumineux dans la couleur de son palier — même esprit que le halo de l\'orbe de Pierre de Cron'},
      {t:'change', sub:'interface', tx:'La pastille "notes non lues" en haut de l\'écran a été retirée — l\'appel à remonter est maintenant un bandeau directement en haut du panneau des notes de version, qui scrolle en un clic'},
    ], en:[
      {t:'new', sub:'graphismes', tx:'Every equipped piece (weapon, armor, jewelry...) and every optimization panel slot (piece being enhanced, material, Cron Stone) now shows a glowing halo in its tier color — same spirit as the Cron Stone orb\'s glow'},
      {t:'change', sub:'interface', tx:'The "unread notes" badge at the top of the screen was removed — the scroll-up prompt is now a banner right at the top of the patch notes panel itself, one click to jump up'},
    ] },
  { v:'V197', d:'06/07/2026 10:00', name:{fr:'Nouvelle icône Pierre de Cron (orbe turquoise)', en:'New Cron Stone icon (teal orb)'}, fr:[
      {t:'improve', sub:'graphismes', tx:'Icône de la Pierre de Cron redessinée en orbe turquoise lumineux façon perle (au lieu du sablier doré), couleur mise à jour partout (sac, table de loot, panneau d\'optimisation)'},
      {t:'fix', sub:'interface', severity:'minor', tx:'La case Pierre de Cron du panneau d\'optimisation affichait un sablier ⏳ générique figé — elle montre maintenant la vraie icône de l\'objet'},
    ], en:[
      {t:'improve', sub:'graphismes', tx:'Cron Stone icon redesigned as a glowing pearl-like teal orb (instead of the golden hourglass), color updated everywhere (bag, loot table, enhancement panel)'},
      {t:'fix', sub:'interface', severity:'minor', tx:'The Cron Stone slot in the enhancement panel showed a static generic ⏳ hourglass — it now shows the item\'s real icon'},
    ] },
  { v:'V196', d:'06/07/2026 09:30', name:{fr:'Fix pastille notes de version : plus de chevauchement, plus de scroll forcé', en:'Patch notes badge fix: no more overlap, no more forced scrolling'}, fr:[
      {t:'fix', sub:'interface', severity:'minor', tx:'La pastille "notes de version non lues" en haut de page chevauchait le panneau des notes de version lui-même — elle se masque désormais tant qu\'un panneau est ouvert, et réapparaît dès qu\'il se ferme'},
      {t:'fix', sub:'interface', tx:'Notes de version : s\'il reste des entrées non lues, le panneau s\'ouvre désormais tout en haut (où elles sont) au lieu de reprendre l\'ancienne position de défilement, qui les cachait en dessous — la reprise de position ne s\'applique qu\'une fois à jour'},
    ], en:[
      {t:'fix', sub:'interface', severity:'minor', tx:'The "unread patch notes" badge at the top of the page overlapped the patch notes panel itself — it now hides while any panel is open, and reappears as soon as it closes'},
      {t:'fix', sub:'interface', tx:'Patch notes: if unread entries remain, the panel now opens scrolled to the very top (where they are) instead of resuming the old scroll position, which hid them below — position resume only kicks in once caught up'},
    ] },
  { v:'V195', d:'06/07/2026 09:00', name:{fr:'Loot détaillé par zone, armes réparties sur les dernières zones, patch notes qui se souviennent de toi', en:'Detailed per-zone loot, weapons spread on the last zones, patch notes that remember you'}, fr:[
      {t:'fix', sub:'interface', severity:'minor', tx:'Fix : la table de loot affichait encore 0.1% pour la Pierre de Cron (l\'ancien taux, avant le passage à 1% de la mise à jour précédente) — un seul chiffre de référence désormais, ne peut plus se désynchroniser'},
      {t:'improve', sub:'interface', tx:'La table de loot indique maintenant exactement QUELLE pièce d\'équipement (casque/plastron/gants/bottes/arme précise) cette zone garantit, au lieu d\'une ligne générique "arme/armure (7 pièces)"'},
      {t:'change', sub:'equipements', severity:'major', tx:'Les 3 types d\'arme se répartissent maintenant sur les 3 DERNIÈRES zones de chaque palier (au lieu des 3 premières, avec la 4e qui répétait l\'arme principale) — la toute première zone d\'un palier n\'a donc plus aucune arme garantie, mais chaque type n\'apparaît plus qu\'une seule fois par palier'},
      {t:'new', sub:'interface', tx:'Notes de version : le défilement reprend exactement là où tu l\'as laissé à chaque ouverture, et une pastille en haut de la page indique combien de notes tu n\'as pas encore lues (en plus du numéro sur le bouton du menu) — ces deux pastilles ne disparaissent que quand tu as réellement fait défiler jusqu\'à ces entrées, pas juste en ouvrant le panneau'},
      {t:'new', sub:'tresors', tx:'Nouvelle étiquette "Trésors" pour les notes de version liées au Trésor de Velia'},
    ], en:[
      {t:'fix', sub:'interface', severity:'minor', tx:'Fix: the loot table still showed 0.1% for the Cron Stone (the old rate, before the previous update\'s move to 1%) — a single reference value now, can no longer drift out of sync'},
      {t:'improve', sub:'interface', tx:'The loot table now shows exactly WHICH gear piece (helmet/armor/gloves/boots/specific weapon) this zone guarantees, instead of a generic "weapon/armor (7 pieces)" line'},
      {t:'change', sub:'equipements', severity:'major', tx:'The 3 weapon types now spread across a tier\'s LAST 3 zones (instead of the first 3, with the 4th repeating the main weapon) — a tier\'s very first zone no longer has any guaranteed weapon, but each type now appears only once per tier'},
      {t:'new', sub:'interface', tx:'Patch notes: scrolling now resumes exactly where you left it every time you open the panel, and a badge at the top of the page shows how many notes you haven\'t read yet (alongside the number on the menu button) — both badges only disappear once you\'ve actually scrolled to those entries, not just from opening the panel'},
      {t:'new', sub:'tresors', tx:'New "Treasures" tag for patch notes related to the Velia Treasure'},
    ] },
  { v:'V194', d:'06/07/2026 08:00', name:{fr:'Badge NEW repensé (numéro, par joueur, met en évidence le changement)', en:'Redesigned NEW badge (number, per-player, highlights the change)'}, fr:[
      {t:'change', sub:'interface', tx:'Le badge "NEW" clignotant (24h pour tout le monde) remplacé par un badge numéroté "1" qui disparaît dès que TOI tu ouvres le panneau — et le changement précis est mis en évidence en haut du panneau (Wiki/Compendium/Codex/Succès) tant que tu ne l\'as pas encore vu'},
      {t:'fix', sub:'interface', severity:'minor', tx:'Corrigé un bug qui empêchait le badge de jamais disparaître (comparaison à une date qui pouvait tomber dans le futur par rapport à l\'horloge réelle) — remplacé par un simple compteur, plus fiable'},
    ], en:[
      {t:'change', sub:'interface', tx:'The blinking "NEW" badge (24h for everyone) replaced by a numbered "1" badge that disappears as soon as YOU open the panel — and the specific change is highlighted at the top of the panel (Wiki/Compendium/Codex/Achievements) until you\'ve seen it'},
      {t:'fix', sub:'interface', severity:'minor', tx:'Fixed a bug that could keep the badge showing forever (comparison against a date that could fall in the future relative to the real clock) — replaced with a simple counter, more reliable'},
    ] },
  { v:'V193', d:'06/07/2026 07:00', name:{fr:'1 pièce d\'armure garantie par zone, armures sans AP, Pierre de Cron au choix, Bout de Velia simplifié', en:'1 guaranteed armor piece per zone, armor with no AP, choosable Cron Stone, simplified Velia piece'}, fr:[
      {t:'change', sub:'equipements', severity:'major', tx:'Chaque zone garantit désormais 1 seule pièce d\'armure précise (casque/armure/gants sur les 3 premières zones du palier, bottes sur la 4e) au lieu d\'un tirage au hasard partagé entre les 4 zones — même logique que les armes'},
      {t:'change', sub:'equipements', severity:'major', tx:'Les armures ne donnent plus d\'AP (comme dans le vrai jeu, purement défensif) — le total AP retiré est redistribué aux 3 armes pour que le total AP d\'un stuff complet reste identique. Rétroactif sur le stuff déjà possédé'},
      {t:'change', sub:'equipements', tx:'Pierre de Cron : taux relevé à 1% (au lieu de 0.1%), et son utilisation passe au choix du joueur — nouvelle case à droite du matériau chargé (panneau Optimisation) avec une case à cocher "Utiliser la Pierre de Cron si dispo", au lieu d\'une consommation 100% automatique et silencieuse'},
      {t:'change', sub:'pve', tx:'"Bout du trésor de Velia" : les 2 objets séparés fusionnés en 1 seul, taux fixe à 0.5%, 1 à 3 unités par ramassage'},
    ], en:[
      {t:'change', sub:'equipements', severity:'major', tx:'Every zone now guarantees exactly 1 specific armor piece (helmet/armor/gloves on the tier\'s first 3 zones, boots on the 4th) instead of a random pick shared across the tier\'s 4 zones — same logic as weapons'},
      {t:'change', sub:'equipements', severity:'major', tx:'Armor no longer grants AP (purely defensive, like the real game) — the removed AP total is redistributed to the 3 weapons so a full set\'s total AP stays the same. Retroactive on gear you already own'},
      {t:'change', sub:'equipements', tx:'Cron Stone: drop rate raised to 1% (from 0.1%), and its use is now the player\'s choice — new slot to the right of the loaded material (Enhancement panel) with a "Use Cron Stone if available" checkbox, instead of a fully automatic, silent consumption'},
      {t:'change', sub:'pve', tx:'"Velia Treasure Piece": the 2 separate items merged into 1, fixed 0.5% rate, 1 to 3 units per pickup'},
    ] },
  { v:'V192', d:'06/07/2026 06:00', name:{fr:'Fix meute en zone dangereuse, sac plein qui bloquait le farm, Craft déplacé dans l\'Inventaire', en:'Dangerous zone pack pile-up fix, full-bag freeze fix, Craft moved into Inventory'}, fr:[
      {t:'fix', sub:'pve', severity:'major', tx:'Un groupe de monstres engagé restait accroché pour toujours (jamais de désengagement), y compris en dehors de tout combat actif — en zone dangereuse (monstres plus rapides, toi plus lent), plusieurs groupes abandonnés finissaient par te rattraper en même temps qu\'un autre déjà engagé et faisaient meute. Un groupe trop éloigné (>550) abandonne maintenant la poursuite'},
      {t:'fix', sub:'interface', severity:'major', tx:'Sac plein : le personnage restait bloqué à suivre indéfiniment un objet au sol qu\'il ne pouvait plus ramasser, au lieu de continuer à combattre comme prévu — il abandonne maintenant cet objet précis après un court délai et repart chercher le prochain groupe'},
      {t:'change', sub:'interface', tx:'Le panneau de craft du Trésor de Velia déplacé de la carte Optimisation vers la carte Inventaire, accessible via un nouveau bouton "Assemblage" en haut (à côté d\'"Inventaire")'},
    ], en:[
      {t:'fix', sub:'pve', severity:'major', tx:'An engaged monster pack stayed aggroed forever (never disengaged), even outside of any active fight — in a dangerous zone (faster monsters, slower you), several abandoned packs would end up catching up to you at the same time as another already-engaged one, piling on. A pack too far away (>550) now gives up the chase'},
      {t:'fix', sub:'interface', severity:'major', tx:'Full bag: the character got stuck endlessly following a ground item it could no longer pick up, instead of continuing to fight as intended — it now abandons that specific item after a short delay and goes back to looking for the next pack'},
      {t:'change', sub:'interface', tx:'The Velia Treasure crafting panel moved from the Enhancement card to the Inventory card, accessible via a new "Craft" button up top (next to "Inventory")'},
    ] },
  { v:'V191', d:'06/07/2026 05:00', name:{fr:'Optimisations contre le ralentissement sur session longue', en:'Optimizations against long-session slowdown'}, fr:[
      {t:'fix', sub:'interface', severity:'major', tx:'Réduction de charge après un signalement de ralentissement système sur des sessions de plusieurs heures : le rendu (canvas + simulation) est désormais mis en pause quand l\'onglet est en arrière-plan, et le recalcul de hauteur des cartes (ajouté par erreur à chaque battement du HUD, potentiellement plusieurs fois par seconde) ne se déclenche plus qu\'au vrai changement de zone/inventaire'},
      {t:'fix', sub:'equipements', severity:'minor', tx:'Garde-fou : l\'optimisation automatique ne peut plus jamais empiler 2 minuteurs en parallèle'},
    ], en:[
      {t:'fix', sub:'interface', severity:'major', tx:'Reduced load after a report of system-wide slowdown on multi-hour sessions: rendering (canvas + simulation) now pauses when the tab is in the background, and the card-height recalculation (mistakenly added on every HUD tick, potentially several times per second) now only fires on an actual zone/inventory change'},
      {t:'fix', sub:'equipements', severity:'minor', tx:'Safety net: auto-enhancement can no longer ever stack 2 timers in parallel'},
    ] },
  { v:'V190', d:'06/07/2026 04:45', name:{fr:'Badge NEW sur contenu modifié, carré unique en ligne/inscrits, niveau à côté de la vie', en:'NEW badge on updated content, single online/registered box, level next to HP'}, fr:[
      {t:'new', sub:'interface', tx:'Badge "NEW" clignotant pendant 24h sur Wiki/Compendium/Codex/Succès après une modification de contenu, visible pour tout le monde (pas besoin de l\'avoir déjà vu ou pas)'},
      {t:'change', sub:'interface', severity:'minor', tx:'"En ligne" et "Inscrits" fusionnés dans un seul carré (au lieu de 2 boîtes empilées séparément)'},
      {t:'change', sub:'interface', tx:'Niveau et % d\'XP réalignés à côté de la barre de vie (au lieu d\'au-dessus)'},
    ], en:[
      {t:'new', sub:'interface', tx:'Blinking "NEW" badge for 24h on Wiki/Compendium/Codex/Achievements after a content update, visible to everyone (no need to have seen it or not)'},
      {t:'change', sub:'interface', severity:'minor', tx:'"Online" and "Registered" merged into a single box (instead of 2 separately stacked boxes)'},
      {t:'change', sub:'interface', tx:'Level and XP % realigned next to the HP bar (instead of above it)'},
    ] },
  { v:'V189', d:'06/07/2026 04:00', name:{fr:'Cartes alignées sur Statistiques, loot normal si overstuff, niveau sur la ligne PA/PD/GS', en:'Cards aligned to Stats, normal loot when overgeared, level on the AP/DP/GS line'}, fr:[
      {t:'fix', sub:'interface', tx:'"Zones de farm" et "Loot de cette zone" font désormais exactement la même hauteur que "Statistiques" (au lieu d\'un plafond fixe de 60% d\'écran sans rapport) — le surplus de contenu défile toujours en interne'},
      {t:'change', sub:'pve', severity:'major', tx:'Loot : plus de bonus (+10%) ni de malus anti-overfarm au-delà du 100% adapté à la zone — un stuff insuffisant reste pénalisé (jusqu\'à -70%), mais un stuff adapté OU largement overstuff donne désormais toujours un loot normal'},
      {t:'improve', sub:'interface', tx:'Niveau et % d\'XP ajoutés sur la même ligne que PA/PD/GS dans la carte Équipement'},
    ], en:[
      {t:'fix', sub:'interface', tx:'"Farming zones" and "Loot in this zone" now match "Statistics" height exactly (instead of a fixed 60% screen cap unrelated to it) — extra content still scrolls internally'},
      {t:'change', sub:'pve', severity:'major', tx:'Loot: no more +10% bonus nor anti-overfarm penalty beyond the 100% adapted-to-zone baseline — insufficient gear still gets penalized (up to -70%), but adapted OR heavily overgeared now always gives normal loot'},
      {t:'improve', sub:'interface', tx:'Level and XP % added to the same line as AP/DP/GS in the Equipment card'},
    ] },
  { v:'V188', d:'06/07/2026 03:30', name:{fr:'Plafond de dégâts par coup, screenshot admin, alignement joueurs par zone', en:'Per-hit damage cap, admin player screenshot, zone player count alignment'}, fr:[
      {t:'fix', sub:'pve', severity:'major', tx:'En zone très dangereuse, un coup pouvait carrément one-shot (vérifié : 544 dégâts pour 478 PV max) — les dégâts par coup sont désormais plafonnés à 30% des PV max, garantissant au moins ~3-4 coups pour mourir depuis la vie pleine, même dans le pire des cas'},
      {t:'new', sub:'comptes', tx:'Admin : bouton "📸 Screenshot" à côté du champ UUID — affiche l\'équipement et l\'inventaire d\'un joueur en lecture seule (aucune modification), en plus du reset ciblé déjà existant'},
      {t:'fix', sub:'interface', severity:'minor', tx:'Le badge 👥 (joueurs sur la zone) réserve maintenant toujours la même largeur : le bouton 👁 ne bouge plus d\'une ligne à l\'autre selon qu\'il y ait ou non des joueurs présents'},
    ], en:[
      {t:'fix', sub:'pve', severity:'major', tx:'In a very dangerous zone, a single hit could straight up one-shot (verified: 544 damage for 478 max HP) — per-hit damage is now capped at 30% of max HP, guaranteeing at least ~3-4 hits to die from full health, even in the worst case'},
      {t:'new', sub:'comptes', tx:'Admin: "📸 Screenshot" button next to the UUID field — shows a player\'s gear and inventory read-only (no changes made), alongside the existing targeted reset'},
      {t:'fix', sub:'interface', severity:'minor', tx:'The 👥 badge (players on the zone) now always reserves the same width: the 👁 button no longer shifts between rows depending on whether players are present'},
    ] },
  { v:'V187', d:'06/07/2026 03:00', name:{fr:'Nombre de joueurs déplacé à côté de l\'œil de loot', en:'Player count moved next to the loot eye'}, fr:[
      {t:'change', sub:'interface', severity:'minor', tx:'Le badge 👥 (joueurs sur la zone) est maintenant affiché juste à gauche du bouton 👁 (voir le loot), au lieu de juste après le badge de difficulté'},
    ], en:[
      {t:'change', sub:'interface', severity:'minor', tx:'The 👥 badge (players on the zone) now shows just left of the 👁 (view loot) button, instead of right after the difficulty badge'},
    ] },
  { v:'V186', d:'06/07/2026 02:45', name:{fr:'% d\'XP aussi gros que le niveau', en:'XP % as big as the level'}, fr:[
      {t:'improve', sub:'interface', severity:'minor', tx:'Le % d\'XP au-dessus de la barre de vie est maintenant aussi gros que le niveau (au lieu de petit en dessous)'},
    ], en:[
      {t:'improve', sub:'interface', severity:'minor', tx:'The XP % above the HP bar is now as big as the level (instead of small underneath)'},
    ] },
  { v:'V185', d:'06/07/2026 02:30', name:{fr:'Carte Statistiques sans espace vide', en:'Stats card without empty space'}, fr:[
      {t:'fix', sub:'interface', severity:'minor', tx:'La carte "Statistiques" s\'étirait elle aussi pour matcher la hauteur de ses voisines de rangée (Zones de farm/Loot), laissant un vide sous ses dernières lignes — suit maintenant sa propre hauteur de contenu, comme les 2 autres cartes de la rangée'},
    ], en:[
      {t:'fix', sub:'interface', severity:'minor', tx:'The "Statistics" card also stretched to match its row neighbors\' height (Farming zones/Loot), leaving empty space under its last rows — now follows its own content height, like the other 2 cards in the row'},
    ] },
  { v:'V184', d:'06/07/2026 02:00', name:{fr:'Joueurs par zone, niveau agrandi façon BDO, cartes sans espace vide, fix potion silencieuse', en:'Players per zone, BDO-style bigger level, no-empty-space cards, silent potion fix'}, fr:[
      {t:'new', sub:'interface', tx:'Nombre de joueurs actuellement présents affiché (👥 N) sur chaque zone de la liste de farm, masqué si personne n\'y est'},
      {t:'fix', sub:'interface', severity:'minor', tx:'Les cartes "Zones de farm" et "Loot de cette zone" s\'étiraient pour matcher la hauteur de leurs voisines de rangée, laissant un grand vide sous une liste courte — elles suivent maintenant leur propre contenu (toujours plafonnées avec défilement au-delà)'},
      {t:'fix', sub:'combat', severity:'major', tx:'Une potion (PV ou mana) sans assez de silver pour la payer échouait totalement en silence (aucun soin, aucun message) — un avertissement "Pas assez de silver pour la potion !" s\'affiche désormais, remarqué en zone dangereuse où ça pouvait ressembler à une potion cassée'},
      {t:'improve', sub:'interface', tx:'Niveau agrandi façon BDO au-dessus de la barre de vie (gros chiffre blanc), le % d\'XP reste petit juste en dessous'},
    ], en:[
      {t:'new', sub:'interface', tx:'Number of players currently in each zone shown (👥 N) in the farming zone list, hidden if nobody is there'},
      {t:'fix', sub:'interface', severity:'minor', tx:'The "Farming zones" and "Loot in this zone" cards stretched to match their row neighbors\' height, leaving a big empty gap under a short list — they now follow their own content instead (still capped with scrolling beyond that)'},
      {t:'fix', sub:'combat', severity:'major', tx:'A potion (HP or mana) without enough silver to pay for it used to fail completely silently (no heal, no message) — a "Not enough silver for a potion!" warning now shows, especially noticeable in dangerous zones where it could look like a broken potion'},
      {t:'improve', sub:'interface', tx:'BDO-style bigger level shown above the HP bar (large white number), XP % stays small right below'},
    ] },
  { v:'V183', d:'06/07/2026 01:30', name:{fr:'Palier PRI relevé pour sortir de zone dangereuse au changement de couleur', en:'PRI tier raised to escape dangerous zone at color-tier change'}, fr:[
      {t:'change', sub:'equipements', severity:'minor', tx:'Bonus du palier PRI relevé (+8% → +20%) : un stuff complet moyen-PRI (mix PEN/+10 possible) sort désormais de ZONE DANGEREUSE sur la 1ère zone du palier de couleur suivant, au lieu d\'y rester bloqué. Ne change rien pour +0 à +15 ni pour l\'équilibre sur sa propre zone (déjà bon) — rétroactif automatiquement sur tout le stuff déjà équipé/en sac, aucune migration nécessaire'},
    ], en:[
      {t:'change', sub:'equipements', severity:'minor', tx:'PRI tier bonus raised (+8% → +20%): a full average-PRI set (mixing PEN/+10 is fine) now escapes DANGEROUS ZONE on the next color tier\'s first zone, instead of staying stuck there. Nothing changes for +0 to +15 or for balance on its own zone (already fine) — automatically retroactive on all already-equipped/bagged gear, no migration needed'},
    ] },
  { v:'V182', d:'06/07/2026 01:00', name:{fr:'Chat anglais, reset admin par UUID, Marché marqué "en construction"', en:'English chat, admin reset by UUID, Market flagged "under construction"'}, fr:[
      {t:'new', sub:'interface', tx:'Nouveau canal de chat 🇬🇧 Anglais, séparé du canal Mondial'},
      {t:'new', sub:'comptes', tx:'Admin : nouvelle action pour réinitialiser le compte d\'UN joueur précis par UUID (silver/équipement/niveau/sac), sans toucher aux autres — même message d\'explication que le reset global, mais montré uniquement à ce joueur'},
      {t:'change', sub:'interface', tx:'Marché : bandeau "en construction, encore peu fonctionnel" ajouté dans le panneau et le Wiki, pour que ce ne soit pas pris pour une fonctionnalité stable'},
    ], en:[
      {t:'new', sub:'interface', tx:'New 🇬🇧 English chat channel, separate from the World channel'},
      {t:'new', sub:'comptes', tx:'Admin: new action to reset ONE specific player\'s account by UUID (silver/gear/level/bag), without touching anyone else — same explanation message as the global reset, but shown only to that player'},
      {t:'change', sub:'interface', tx:'Market: "under construction, still not very functional" banner added to the panel and the Wiki, so it isn\'t mistaken for a stable feature'},
    ] },
  { v:'V181', d:'06/07/2026 00:30', name:{fr:'Halo "où farmer" sur socle vide, niveau/XP déplacé au-dessus de la vie', en:'"Where to farm" halo on empty slots, level/XP moved above HP'}, fr:[
      {t:'new', sub:'equipements', tx:'Clique un socle d\'équipement vide : la ou les zones qui lootent cet objet s\'illuminent d\'un halo doré dans la liste des zones (+ bouton téléportation directe). Une zone dangereuse pour ton stuff actuel n\'est proposée que s\'il n\'existe vraiment aucune alternative plus sûre'},
      {t:'change', sub:'interface', tx:'Niveau et % d\'XP déplacés au-dessus de la barre de vie (en bas à gauche), retirés de la carte Inventaire'},
    ], en:[
      {t:'new', sub:'equipements', tx:'Click an empty equipment slot: the zone(s) that drop that item light up with a gold halo in the zone list (+ a direct teleport button). A zone too dangerous for your current gear is only suggested if there\'s truly no safer alternative'},
      {t:'change', sub:'interface', tx:'Level and XP % moved above the HP bar (bottom-left), removed from the Inventory card'},
    ] },
  { v:'V180', d:'05/07/2026 21:30', name:{fr:'Carte de loot plafonnée avec défilement', en:'Loot card capped with scrolling'}, fr:[
      {t:'fix', sub:'interface', severity:'minor', tx:'La carte "Loot dans cette zone" (notamment la vue condensée de toutes les zones à Velia) pouvait déborder largement sous les cartes voisines — plafonnée avec un défilement interne, comme la liste des zones (V178)'},
    ], en:[
      {t:'fix', sub:'interface', severity:'minor', tx:'The "Loot in this zone" card (especially the condensed all-zones view at Velia) could overflow well below the neighboring cards — capped with internal scrolling, like the zone list (V178)'},
    ] },
  { v:'V179', d:'05/07/2026 21:00', name:{fr:'Système de mana, barre d\'incantation repensée, zone dangereuse durcie', en:'Mana system, redesigned cast bar, harsher dangerous zone'}, fr:[
      {t:'new', sub:'competences', tx:'Ajout de la mana : chaque sort a désormais un coût, une régénération passive, et une potion de mana (auto-bue sous 30%) vient compléter la potion de PV'},
      {t:'improve', sub:'interface', tx:'Barre d\'incantation repensée : affichée près de la barre de sorts (plus au-dessus du personnage), la matière se retire des 2 côtés vers le centre — le sort part quand elle a entièrement disparu'},
      {t:'change', sub:'interface', tx:'Barre de PV retirée d\'au-dessus du personnage, ne reste plus qu\'en bas à gauche (où une barre de mana l\'accompagne désormais)'},
      {t:'change', sub:'pve', severity:'major', tx:'Zone dangereuse : le ralenti du joueur et l\'accélération des monstres sont durcis (×0,5 et ×1,7 au lieu de ×0,7/×1,35), et un message d\'avertissement s\'affiche tant qu\'on y reste'},
    ], en:[
      {t:'new', sub:'competences', tx:'Added mana: every skill now has a cost and passive regeneration, and a mana potion (auto-drunk under 30%) joins the HP potion'},
      {t:'improve', sub:'interface', tx:'Redesigned cast bar: now shown near the skill bar (no longer above the character), material recedes from both sides toward the center — the spell fires once it has fully disappeared'},
      {t:'change', sub:'interface', tx:'HP bar removed from above the character, only remains bottom-left (now joined by a mana bar)'},
      {t:'change', sub:'pve', severity:'major', tx:'Dangerous zone: player slowdown and monster speedup are harsher (×0.5 and ×1.7 instead of ×0.7/×1.35), and a warning message shows while you stay there'},
    ] },
  { v:'V178', d:'05/07/2026 20:30', name:{fr:'Liste des zones plafonnée avec défilement', en:'Zone list capped with scrolling'}, fr:[
      {t:'fix', sub:'interface', severity:'minor', tx:'La liste des zones de farm (16 depuis l\'ajout des boucles d\'oreille) débordait largement sous les cartes voisines au lieu de s\'arrêter et défiler — plafonnée avec un défilement interne'},
    ], en:[
      {t:'fix', sub:'interface', severity:'minor', tx:'The farming zone list (16 since the earring update) overflowed well below the neighboring cards instead of stopping and scrolling — capped with internal scrolling'},
    ] },
  { v:'V177', d:'05/07/2026 20:15', name:{fr:'Zone dangereuse : toi plus lent, les monstres plus rapides', en:'Dangerous zone: you slower, monsters faster'}, fr:[
      {t:'change', sub:'pve', severity:'major', tx:'En ZONE DANGEREUSE (PA/PD très insuffisants), tu es maintenant ralenti (×0,7) et les monstres qui t\'ont repéré deviennent plus rapides (×1,35) pour te rattraper — rend le danger concret plutôt qu\'une simple pénalité de dégâts/loot invisible'},
    ], en:[
      {t:'change', sub:'pve', severity:'major', tx:'In a DANGEROUS ZONE (very insufficient AP/DP), you are now slowed down (×0.7) and monsters that spotted you become faster (×1.35) to catch up — makes the danger tangible instead of just an invisible damage/loot penalty'},
    ] },
  { v:'V176', d:'05/07/2026 20:00', name:{fr:'Menu d\'optimisation détaillé, navigation clavier dans le chat, alerte de mention en continu', en:'Detailed enhance menu, chat keyboard navigation, continuous mention alert'}, fr:[
      {t:'improve', sub:'equipements', severity:'minor', tx:'Le menu déroulant "Auto jusqu\'à" affiche maintenant le gain de stats pour CHAQUE palier proposé, pas seulement celui sélectionné'},
      {t:'improve', sub:'interface', severity:'minor', tx:'Chat : les flèches ↑/↓ du clavier permettent de choisir un joueur dans la liste de suggestions de mention @'},
      {t:'improve', sub:'interface', tx:'L\'alerte de mention (couleur + vibration + agrandissement du chat replié) tourne maintenant en continu tant que le chat n\'est pas ouvert, au lieu de s\'arrêter après 3 répétitions'},
      {t:'fix', sub:'interface', severity:'minor', tx:'Une mention @joueur s\'affiche désormais en couleur pour TOUT le monde dans le chat, même si la personne mentionnée n\'est plus en ligne au moment où le message est affiché'},
    ], en:[
      {t:'improve', sub:'equipements', severity:'minor', tx:'The "Auto to" dropdown now shows the stat gain for EVERY tier offered, not just the selected one'},
      {t:'improve', sub:'interface', severity:'minor', tx:'Chat: keyboard ↑/↓ arrows let you pick a player from the @ mention suggestion list'},
      {t:'improve', sub:'interface', tx:'The mention alert (color + vibration + enlargement of the collapsed chat) now runs continuously until the chat is opened, instead of stopping after 3 repeats'},
      {t:'fix', sub:'interface', severity:'minor', tx:'An @player mention now shows in color for EVERYONE in chat, even if the mentioned person is no longer online when the message is displayed'},
    ] },
  { v:'V175', d:'05/07/2026 19:30', name:{fr:'4e zone par palier + boucles d\'oreille', en:'4th zone per tier + earrings'}, fr:[
      {t:'new', sub:'zones', tx:'1 zone supplémentaire par palier de stuff (Ruines de Trent, Île d\'Iliya, Base de Bashim, Forêt de Polly) — chaque palier passe de 3 à 4 zones. PA/PD requis volontairement identiques à la dernière zone déjà existante du palier : aucun changement du plafond de difficulté'},
      {t:'new', sub:'equipements', tx:'Ajout de la boucle d\'oreille, seul type de bijou qui manquait à chaque palier (les emplacements existaient déjà mais rien ne les alimentait). Le PA total des bijoux d\'un palier reste identique : redistribué sur 4 pièces au lieu de 3, avec une migration automatique du stuff déjà possédé'},
    ], en:[
      {t:'new', sub:'zones', tx:'1 extra zone per gear tier (Trent Ruins, Iliya Island, Bashim Base, Polly Forest) — each tier goes from 3 to 4 zones. Required AP/DP deliberately identical to the tier\'s existing last zone: no change to the difficulty ceiling'},
      {t:'new', sub:'equipements', tx:'Added the earring, the only jewelry type missing from every tier (the slots already existed but nothing dropped there). A tier\'s total jewelry AP stays the same: redistributed across 4 pieces instead of 3, with an automatic migration of gear you already own'},
    ] },
  { v:'V174', d:'05/07/2026 19:00', name:{fr:'Pseudo à l\'inscription, mentions @joueur dans le chat, nombre d\'inscrits', en:'Nickname at signup, @player mentions in chat, registered count'}, fr:[
      {t:'new', sub:'comptes', tx:'Champ pseudo sur l\'écran de création de compte — plus besoin de le changer après coup dans "Mon compte"'},
      {t:'new', sub:'interface', tx:'Nombre total de joueurs inscrits affiché sous le compteur "en ligne"'},
      {t:'improve', sub:'interface', severity:'minor', tx:'La pastille de gravité ne décale plus le texte des lignes de notes de version — déplacée dans la ligne d\'infos du bas, avec les autres badges'},
      {t:'improve', sub:'interface', severity:'minor', tx:'Les sous-catégories des notes de version reprennent désormais la couleur de leur catégorie principale, pour mieux montrer le lien de parenté'},
      {t:'fix', sub:'interface', severity:'minor', tx:'La pastille de notification sur "Notes de version" se vide maintenant dès l\'ouverture du panneau, plutôt qu\'à la fermeture de l\'onglet'},
      {t:'new', sub:'interface', tx:'Chat : taper "@" affiche la liste des joueurs en ligne (filtrable en tapant les premières lettres) pour les mentionner — un message qui te mentionne s\'affiche en surbrillance, et si ton chat est replié, il s\'anime (couleur + vibration + agrandissement) pour t\'inviter à l\'ouvrir'},
    ], en:[
      {t:'new', sub:'comptes', tx:'Nickname field on the account creation screen — no need to change it afterward in "My account"'},
      {t:'new', sub:'interface', tx:'Total number of registered players shown below the "online" counter'},
      {t:'improve', sub:'interface', severity:'minor', tx:'The severity dot no longer shifts patch note line text — moved to the bottom info row, with the other badges'},
      {t:'improve', sub:'interface', severity:'minor', tx:'Patch note subcategories now take on their parent category\'s color, to better show the relationship'},
      {t:'fix', sub:'interface', severity:'minor', tx:'The notification badge on "Patch Notes" now clears as soon as the panel is opened, instead of on tab close'},
      {t:'new', sub:'interface', tx:'Chat: typing "@" shows the list of online players (filterable by typing letters) to mention them — a message mentioning you is highlighted, and if your chat is collapsed, it animates (color + vibration + enlargement) to prompt you to open it'},
    ] },
  { v:'V173', d:'05/07/2026 18:30', name:{fr:'Alignement des boutons d\'inventaire + comparateur avant/après', en:'Inventory button alignment + before/after viewer'}, fr:[
      {t:'fix', sub:'interface', severity:'minor', tx:'Les boutons "⚡ Équiper meilleur" et "🗑️ Vendre" (+ "↩️ Racheter") n\'étaient pas parfaitement alignés (marge et taille de police différentes) — corrigé pour un alignement pixel-perfect'},
      {t:'improve', sub:'interface', severity:'minor', tx:'Les notes de version peuvent désormais inclure un bouton 🖼️ "Voir avant/après" sur une ligne, ouvrant un comparateur avec 2 captures d\'écran côte à côte'},
    ], en:[
      {t:'fix', sub:'interface', severity:'minor', tx:'The "⚡ Equip best" and "🗑️ Sell" (+ "↩️ Buy back") buttons weren\'t perfectly aligned (different margin and font size) — fixed for pixel-perfect alignment'},
      {t:'improve', sub:'interface', severity:'minor', tx:'Patch notes can now include a 🖼️ "See before/after" button on a line, opening a comparer with 2 side-by-side screenshots'},
    ] },
  { v:'V172', d:'05/07/2026 18:15', name:{fr:'Pastilles de gravité + infobulles sur les notes de version', en:'Severity dots + tooltips on patch notes'}, fr:[
      {t:'improve', sub:'interface', severity:'minor', tx:'Chaque ligne des notes de version peut désormais porter une pastille de couleur indiquant sa gravité (Critique/Important/Mineur/Info), indépendante de sa catégorie — une correction peut être Critique ou Mineure selon son impact réel'},
      {t:'improve', sub:'interface', severity:'minor', tx:'Toutes les pastilles/badges (catégorie, gravité, sous-catégorie, plateforme, nature) affichent désormais une explication au survol de la souris'},
    ], en:[
      {t:'improve', sub:'interface', severity:'minor', tx:'Each patch note line can now carry a colored severity dot (Critical/Major/Minor/Info), independent of its category — a fix can be Critical or Minor depending on its actual impact'},
      {t:'improve', sub:'interface', severity:'minor', tx:'All pastilles/badges (category, severity, subcategory, platform, nature) now show an explanation on mouse hover'},
    ] },
  { v:'V171', d:'05/07/2026 18:00', name:{fr:'Bouton optimiser sur l\'équipement + refonte du menu de gauche', en:'Enhance button on gear + left menu overhaul'}, fr:[
      {t:'improve', sub:'equipements', tx:'Petit bouton 🔧 directement sur chaque pièce équipée optimisable — charge instantanément CETTE pièce dans le panneau d\'optimisation, sans passer par le menu au clic. Mentionné dans le tutoriel et le Wiki (section Optimisation)'},
      {t:'improve', sub:'interface', tx:'Le Codex des objets sort du Wiki pour devenir sa propre section, directement accessible depuis le menu de gauche (📚 Codex)'},
      {t:'improve', sub:'interface', tx:'Refonte du menu de gauche : le vrai jeu (Quêtes, Courrier, Compendium, Codex, Succès, Marché, Classement) remonte en haut ; les infos moins utilisées au quotidien (Wiki, Notes de version, Discord, langue, compteur en ligne...) redescendent en bas'},
    ], en:[
      {t:'improve', sub:'equipements', tx:'Small 🔧 button directly on each optimizable equipped piece — instantly loads THAT piece into the enhancement panel, without going through the click menu. Mentioned in the tutorial and the Wiki (Enhancement section)'},
      {t:'improve', sub:'interface', tx:'The Item Codex moves out of the Wiki into its own section, directly accessible from the left menu (📚 Codex)'},
      {t:'improve', sub:'interface', tx:'Left menu overhaul: the actual game (Quests, Mailbox, Compendium, Codex, Achievements, Market, Leaderboard) moves to the top; info used less often day-to-day (Wiki, Patch notes, Discord, language, online counter...) moves to the bottom'},
    ] },
  { v:'V170', d:'05/07/2026 17:30', name:{fr:'Gain d\'optimisation auto affiché + guide de farm', en:'Auto-enhance gain preview + farm guide'}, fr:[
      {t:'improve', sub:'equipements', tx:'L\'optimisation automatique ("Auto jusqu\'à") affiche désormais le gain de stats (PA/PD/PV/Esquive) que rapporterait le palier choisi, avant même de lancer l\'auto'},
      {t:'new', sub:'objets', tx:'Clique sur un emplacement de sac VIDE pour ouvrir un guide "Où farmer ?" listant les zones débloquées et ce qu\'elles rapportent — les zones actuellement trop dangereuses pour ton stuff sont exclues'},
    ], en:[
      {t:'improve', sub:'equipements', tx:'Auto-enhance ("Auto to") now shows the stat gain (AP/DP/HP/Dodge) the chosen tier would bring, before even starting the auto run'},
      {t:'new', sub:'objets', tx:'Click an EMPTY bag slot to open a "Where to farm?" guide listing unlocked zones and what they drop — zones currently too dangerous for your gear are excluded'},
    ] },
  { v:'V169', d:'05/07/2026 17:00', name:{fr:'Refonte des notes de version + correction du cadeau de fidélité', en:'Patch notes overhaul + loyalty gift fix'}, fr:[
      {t:'improve', sub:'interface', tx:'Nouvelle taxonomie des notes de version (Nouveautés, Équilibrage, Améliorations, Corrections de bugs, Sécurité, Serveur, Événements, Informations) — les lignes d\'une même version sont désormais groupées par catégorie, chaque groupe séparé par un liseré doré, avec un alignement cohérent au lieu d\'un badge répété sur chaque ligne'},
      {t:'fix', sub:'connexion', tx:'Le cadeau de fidélité journalier (et son message flottant "Nouveau courrier") pouvait s\'afficher à tort à CHAQUE connexion, même si déjà réclamé aujourd\'hui — la vérification se faisait avant que la vraie sauvegarde cloud ait fini de charger. Corrigé : le jeu attend maintenant que la sauvegarde soit chargée avant de vérifier'},
    ], en:[
      {t:'improve', sub:'interface', tx:'New patch notes taxonomy (New, Balancing, Improvements, Bug fixes, Security, Server, Events, Information) — lines within a version are now grouped by category, each group separated by a gold divider, with consistent alignment instead of a repeated badge on every line'},
      {t:'fix', sub:'connexion', tx:'The daily loyalty gift (and its floating "New mail" toast) could wrongly show up on EVERY connection, even if already claimed today — the check ran before the real cloud save had finished loading. Fixed: the game now waits for the save to load before checking'},
    ] },
  { v:'V168', d:'05/07/2026 16:30', name:{fr:'Correction : jeu bloqué au chargement pour les invités', en:'Fix: game stuck loading for guests'}, fr:[
      {t:'fix', nature:'backend', tx:'Le correctif de la version précédente (page de connexion bloquée) déclenchait aussi un 2e chargement en parallèle de la sauvegarde pour une session invité, provoquant des effets en double (ex: bonus de bienvenue compté deux fois) et pouvait bloquer le jeu au chargement — sessions invité désormais exclues de ce relais, et un verrou empêche tout double appel'},
    ], en:[
      {t:'fix', nature:'backend', tx:'The previous version\'s fix (login screen stuck) also triggered a 2nd, parallel save load for guest sessions, causing duplicated effects (e.g. the welcome bonus counted twice) and could get the game stuck loading — guest sessions are now excluded from that relay, and a lock prevents any double call'},
    ] },
  { v:'V167', d:'05/07/2026 16:15', name:{fr:'Bouton "Vider le cache" sur l\'écran de connexion', en:'"Clear cache" button on the login screen'}, fr:[
      {t:'new', tx:'Le bouton "🧹 Vider le cache du jeu" est maintenant aussi accessible directement sur l\'écran de connexion (en plus du panneau "Mon compte"), pour les cas où un joueur reste bloqué dessus'},
    ], en:[
      {t:'new', tx:'The "🧹 Clear game cache" button is now also available directly on the login screen (in addition to the "My account" panel), for cases where a player gets stuck on it'},
    ] },
  { v:'V166', d:'05/07/2026 16:00', name:{fr:'Correction : page de connexion bloquée après une connexion réussie', en:'Fix: login screen stuck after a successful sign-in'}, fr:[
      {t:'fix', nature:'backend', tx:'Après une connexion via Discord (ou un lien de confirmation d\'email), l\'écran de connexion pouvait rester affiché malgré une connexion réussie, y compris après un rechargement de la page — la session était bien établie mais le jeu ne le détectait pas toujours à temps'},
    ], en:[
      {t:'fix', nature:'backend', tx:'After signing in via Discord (or an email confirmation link), the login screen could stay on-screen despite a successful sign-in, even after reloading the page — the session was properly established but the game didn\'t always detect it in time'},
    ] },
  { v:'V165', d:'05/07/2026 15:30', name:{fr:'Bouton "Vider le cache" et notes de version plus lisibles', en:'"Clear cache" button and more readable patch notes'}, fr:[
      {t:'new', tx:'Panneau "Mon compte" : bouton "🧹 Vider le cache et recharger" pour les cas où une mise à jour ne s\'affiche pas correctement (fichiers du jeu mis en cache par le navigateur) — ne touche jamais à la sauvegarde'},
      {t:'change', nature:'opticode', tx:'Refonte visuelle des notes de version : chaque entrée devient une carte avec un fond légèrement teinté et des séparateurs entre les lignes, badges arrondis en forme de pilule, entrée la plus récente mise en valeur'},
      {t:'fix', nature:'backend', tx:'La détection de nouvelle version déployée (bandeau "Recharger") avait cessé de fonctionner depuis la séparation du code en plusieurs fichiers — elle cherchait les notes de version dans le mauvais fichier'},
    ], en:[
      {t:'new', tx:'"My account" panel: "🧹 Clear cache and reload" button for cases where an update doesn\'t display correctly (game files cached by the browser) — never touches your save'},
      {t:'change', nature:'opticode', tx:'Visual redesign of the patch notes: each entry is now a card with a lightly tinted background and separators between lines, rounded pill-shaped badges, most recent entry highlighted'},
      {t:'fix', nature:'backend', tx:'Detection of a newly deployed version (the "Reload" banner) had stopped working since the code was split into multiple files — it was looking for the patch notes in the wrong file'},
    ] },
  { v:'V164', d:'05/07/2026 15:00', name:{fr:'Notes de version : tag "nature" (optim. code, backend...)', en:'Patch notes: "nature" tag (code opti, backend...)'}, fr:[
      {t:'new', tx:'Chaque ligne des notes de version peut désormais porter un tag "nature" en plus du type et de la plateforme — Optim. code, Optimisation, Inventaire ou Backend — pour repérer d\'un coup d\'œil les changements sous le capot qui ne touchent pas directement le contenu de jeu. Ce 2e badge (nature ou Tab/Mobile) s\'affiche maintenant sur sa propre ligne, sous le badge principal, plutôt qu\'à côté'},
      {t:'change', nature:'opticode', tx:'Le code du jeu (un seul fichier HTML de plus de 11 500 lignes) a été séparé en plusieurs fichiers — structure HTML, CSS et JavaScript (coupé en 2 fichiers) chacun à part — pour être plus simple à maintenir sur la durée. Aucun changement de gameplay, tout fonctionne à l\'identique'},
    ], en:[
      {t:'new', tx:'Each patch note line can now carry a "nature" tag in addition to its type and platform — Code opti, Optimization, Inventory or Backend — to spot at a glance under-the-hood changes that don\'t directly touch game content. This 2nd badge (nature or Tab/Mobile) now shows on its own line, below the main badge, instead of next to it'},
      {t:'change', nature:'opticode', tx:'The game\'s code (a single 11,500+ line HTML file) has been split into several files — HTML structure, CSS and JavaScript (split into 2 files) each on their own — to be easier to maintain long-term. No gameplay change, everything works identically'},
    ] },
  { v:'V163', d:'05/07/2026 14:30', name:{fr:'Tutoriel : indice de défilement quand la cible est hors champ', en:'Tutorial: scroll hint when the target is off-screen'}, fr:[
      {t:'new', tx:'Pendant le tutoriel de début, si l\'élément mis en avant par l\'étape en cours est hors du champ visible, une icône apparaît pour indiquer qu\'il faut défiler — 🖱️ souris sur ordinateur, 👆 doigt sur mobile/tablette. Disparaît dès que l\'élément redevient visible'},
    ], en:[
      {t:'new', tx:'During the opening tutorial, if the element highlighted by the current step is off-screen, an icon appears to indicate you need to scroll — 🖱️ mouse on desktop, 👆 finger on mobile/tablet. Disappears as soon as the element becomes visible again'},
    ] },
  { v:'V162', d:'05/07/2026 14:00', name:{fr:'Nouvelle zone : Planque des Mânes (3e zone bleue)', en:'New zone: Manes\' Hideout (3rd blue zone)'}, fr:[
      {t:'new', tx:'Nouvelle zone "Planque des Mânes" (Esprit des Mânes), 3e zone du palier bleu (Grunil) — complète la rotation d\'une arme garantie par zone et apporte la ceinture manquante (Orkinrad\'s Belt). Ses PA/PD requis sont volontairement identiques à Ruines de Kratuga : le plafond de stat du palier bleu au PEN ne change pas (~294 PA / ~247 PD stuff complet)'},
    ], en:[
      {t:'new', tx:'New "Manes\' Hideout" zone (Manes Spirit), 3rd zone of the blue tier (Grunil) — completes the one-guaranteed-weapon-per-zone rotation and brings the missing belt (Orkinrad\'s Belt). Its AP/DP requirements are deliberately identical to Kratuga Ruins: the blue tier\'s stat ceiling at PEN doesn\'t change (~294 AP / ~247 DP full set)'},
    ] },
  { v:'V161', d:'05/07/2026 13:30', name:{fr:'Badge "Compatible mobile/tablette" à la connexion', en:'"Mobile/tablet compatible" badge at login'}, fr:[
      {t:'new', plat:'mobile', tx:'Un badge "📱 BETA — Compatible mobile & tablette" s\'affiche désormais sur l\'écran de connexion/création de compte, pour annoncer l\'adaptation mobile dès l\'arrivée sur le jeu'},
    ], en:[
      {t:'new', plat:'mobile', tx:'A "📱 BETA — Mobile & tablet compatible" badge now shows on the login/account creation screen, announcing the mobile adaptation right from arrival on the game'},
    ] },
  { v:'V160', d:'05/07/2026 13:00', name:{fr:'Rééquilibrage PA/PD appliqué rétroactivement au stuff déjà possédé', en:'AP/DP rebalance applied retroactively to owned gear'}, fr:[
      {t:'fix', tx:'Le rééquilibrage des PA/PD (armes/armures/bijoux, voir version précédente) ne s\'appliquait qu\'aux nouveaux objets trouvés — tout le stuff déjà en possession (équipé ou dans le sac) gardait ses anciennes valeurs, bien plus hautes pour les armes. Recalculé une bonne fois pour toutes au prochain chargement, sans rien perdre (les PV/l\'Esquive, non concernés par le rééquilibrage, restent inchangés)'},
    ], en:[
      {t:'fix', tx:'The AP/DP rebalance (weapons/armor/jewelry, see previous version) only applied to newly found items — all gear already owned (equipped or in the bag) kept its old values, much higher for weapons. Recalculated once and for all on next load, without losing anything (HP/Dodge, untouched by the rebalance, stay the same)'},
    ] },
  { v:'V159', d:'05/07/2026 12:30', name:{fr:'Notes de version : badge Tablette/Mobile', en:'Patch notes: Tablet/Mobile badge'}, fr:[
      {t:'new', tx:'Chaque ligne des notes de version peut maintenant porter un 2e badge "📱 Tab/Mobile" en plus du type (Nouveauté/Modification/Correction/Faille), pour repérer d\'un coup d\'œil les changements qui ne concernent QUE la tablette/le téléphone. Appliqué rétroactivement aux notes V152 à V157 (adaptation mobile)'},
    ], en:[
      {t:'new', tx:'Each patch note line can now carry a 2nd "📱 Tab/Mobile" badge next to its type (New/Change/Fix/Security), to spot at a glance changes that only concern tablet/phone. Applied retroactively to notes V152 through V157 (mobile adaptation)'},
    ] },
  { v:'V158', d:'05/07/2026 12:00', name:{fr:'1 arme garantie par zone, PA des armes fortement réduit', en:'1 guaranteed weapon per zone, weapon AP greatly reduced'}, fr:[
      {t:'change', tx:'Chaque zone garantit désormais un type d\'arme précis (épée/dague/éveil, en rotation par palier) au lieu de tirer au hasard le même emplacement que l\'armure — la zone bleue (2 zones seulement pour l\'instant) fait exception : sa 2e zone garantit 2 types d\'arme'},
      {t:'change', tx:'Les armes donnaient bien trop de PA (à elles 3, environ 750 PA au PEN sur un stuff bleu complet, contre ~460 PD total) — rééquilibrées pour qu\'un stuff bleu complet (3 armes + 4 armures + bijoux) totalise environ 301 PA et 248 PD au PEN, chaque palier plus bas donnant proportionnellement moins'},
    ], en:[
      {t:'change', tx:'Each zone now guarantees a specific weapon type (sword/dagger/awakening, rotating by tier) instead of randomly rolling the same slot as armor — the blue tier (only 2 zones for now) is an exception: its 2nd zone guarantees 2 weapon types'},
      {t:'change', tx:'Weapons gave far too much AP (the 3 of them alone reached ~750 AP at PEN on a full blue set, vs ~460 total DP) — rebalanced so a full blue set (3 weapons + 4 armor + jewelry) totals around 301 AP and 248 DP at PEN, with each lower tier giving proportionally less'},
    ] },
  { v:'V157', d:'05/07/2026 11:30', name:{fr:'Mobile : header dégagé, gains XP/Loot lisibles, moins de chevauchement', en:'Mobile: cleared header, readable XP/Loot gains, less overlap'}, fr:[
      {t:'fix', plat:'mobile', tx:'Le bouton replié du menu de gauche (position fixe, en haut à gauche) cachait le premier onglet de la barre d\'activités sur téléphone — le contenu est repoussé sous ce bouton pour ne plus jamais le chevaucher'},
      {t:'fix', plat:'mobile', tx:'Les bannières "Sac plein" et "Tu es mort" recouvraient le nom de la zone sur téléphone (cadre de jeu très bas) — repoussées en dessous'},
      {t:'change', plat:'mobile', tx:'Les nombres flottants de gains (loot, XP, dégâts) sont dessinés sur un canvas à résolution fixe, réduit à la taille de l\'écran — sur téléphone ils devenaient minuscules, quasi illisibles. Leur taille compense maintenant la réduction de l\'écran pour rester lisible, quelle que soit la largeur'},
      {t:'change', plat:'mobile', tx:'Silver, taux/h et butin en direct légèrement resserrés sur téléphone pour laisser plus de place à cet ensemble sur un cadre de jeu réduit'},
    ], en:[
      {t:'fix', plat:'mobile', tx:'The left menu\'s folded button (fixed position, top-left) hid the first tab of the activity bar on phone — content is now pushed below this button so it\'s never covered again'},
      {t:'fix', plat:'mobile', tx:'The "Bag full" and "You died" banners covered the zone name on phone (very short game frame) — pushed further down'},
      {t:'change', plat:'mobile', tx:'Floating gain numbers (loot, XP, damage) are drawn on a fixed-resolution canvas that shrinks to fit the screen — on phone they became tiny, barely readable. Their size now compensates for the screen shrink to stay legible at any width'},
      {t:'change', plat:'mobile', tx:'Silver, rate/h and live loot slightly tightened on phone to leave more room for this group on a shrunk game frame'},
    ] },
  { v:'V156', d:'05/07/2026 11:00', name:{fr:'Mobile : barre de sorts repliable, potion mise en avant', en:'Mobile: collapsible skill bar, potion put forward'}, fr:[
      {t:'change', plat:'mobile', tx:'Sur mobile/tablette, la barre de sorts est maintenant repliée par défaut (purement indicative, aucun clic requis, le combat reste automatique) — un bouton ⚡ la déplie/replie à la demande, libérant de la place dans le cadre de jeu'},
      {t:'change', plat:'mobile', tx:'La potion (soin automatique), ce qui compte vraiment à surveiller en jeu, est mise en avant sur mobile/tablette : agrandie avec un halo doré au lieu d\'être réduite comme le reste du HUD'},
    ], en:[
      {t:'change', plat:'mobile', tx:'On mobile/tablet, the skill bar is now collapsed by default (purely informational, no click required, combat stays automatic) — a ⚡ button expands/collapses it on demand, freeing up space in the game frame'},
      {t:'change', plat:'mobile', tx:'The potion (auto-heal), the thing that actually matters to watch during play, is put forward on mobile/tablet: enlarged with a gold glow instead of being shrunk like the rest of the HUD'},
    ] },
  { v:'V155', d:'05/07/2026 10:30', name:{fr:'Correctifs mobile : barre de sorts coupée, IA superposée', en:'Mobile fixes: cropped skill bar, overlapping AI status'}, fr:[
      {t:'fix', plat:'mobile', tx:'Sur téléphone, la barre de 9 sorts (calibrée pour ~418px de large) dépassait des 2 côtés du cadre de jeu réduit (~360-380px), coupant les icônes de bord (ex: "Speed" et "Voltaic" à moitié visibles). Icônes réduites pour tenir entièrement dans le cadre'},
      {t:'fix', plat:'mobile', tx:'Le texte "IA : ..." se superposait au nom de la zone — le cadre de jeu devient très bas sur téléphone (son ratio suit la largeur), pas assez de place pour empiler proprement les deux. Masqué sur téléphone (indicatif seulement, le combat reste automatique)'},
      {t:'change', plat:'mobile', tx:'Barre de vie/potion légèrement réduite sur téléphone pour laisser plus de place à la barre de sorts juste à côté — un chevauchement résiduel entre les deux subsiste sur les téléphones les plus étroits, une refonte plus profonde (titre de zone notamment) serait nécessaire pour l\'éliminer complètement'},
    ], en:[
      {t:'fix', plat:'mobile', tx:'On phone, the 9-skill bar (sized for ~418px wide) overflowed both sides of the shrunk game frame (~360-380px), cropping the edge icons (e.g. "Speed" and "Voltaic" half-cut). Icons shrunk to fit entirely within the frame'},
      {t:'fix', plat:'mobile', tx:'The "AI: ..." status text overlapped the zone name — the game frame becomes very short on phone (its ratio follows the width), not enough room to stack both cleanly. Hidden on phone (informational only, combat stays automatic)'},
      {t:'change', plat:'mobile', tx:'HP/potion bar slightly shrunk on phone to leave more room for the skill bar right next to it — a residual overlap between the two remains on the narrowest phones; a deeper redesign (notably the zone title) would be needed to fully eliminate it'},
    ] },
  { v:'V154', d:'05/07/2026 10:00', name:{fr:'Correctif mobile : barre d\'onglets empilée sur 8 lignes', en:'Mobile fix: tab bar stacked into 8 rows'}, fr:[
      {t:'fix', plat:'mobile', tx:'Sur téléphone, les 8 onglets (Zone/Boss/Pêche/Mine/Forêt/Champs/Bergerie/Atelier royal) et le texte "Prochain boss" se partageaient une seule ligne — le texte, assez long, écrasait la largeur dispo pour les onglets, forcés à 1 seul par ligne (8 lignes de haut, confirmé sur un vrai téléphone). Empilés l\'un sous l\'autre à la place : les onglets se répartissent maintenant sur 3-4 par ligne'},
    ], en:[
      {t:'fix', plat:'mobile', tx:'On phone, the 8 tabs (Zone/Boss/Fishing/Mining/Forest/Fields/Ranch/Royal Workshop) and the "Next boss" text shared a single row — the fairly long text crushed the space left for the tabs, forcing them to 1 per row (8 rows tall, confirmed on a real phone). Stacked on top of each other instead: tabs now spread across 3-4 per row'},
    ] },
  { v:'V153', d:'05/07/2026 09:30', name:{fr:'Correctifs mobile : menu scrollable, version bien rangée', en:'Mobile fixes: scrollable menu, version properly placed'}, fr:[
      {t:'fix', plat:'mobile', tx:'Le numéro de version (tout en bas du menu de gauche) n\'était pas masqué quand le menu était replié — il flottait tout seul par-dessus le jeu. Il est maintenant bien rangé dans le menu, visible seulement quand celui-ci est déplié'},
      {t:'fix', plat:'mobile', tx:'Sur un petit écran, le menu de gauche déplié pouvait être plus haut que l\'écran lui-même, rendant certains boutons (Discord, Admin...) impossibles à atteindre. Le menu défile maintenant lui-même si besoin, plutôt que de déborder hors de l\'écran'},
    ], en:[
      {t:'fix', plat:'mobile', tx:'The version number (at the very bottom of the left menu) wasn\'t hidden when the menu was folded — it floated on its own over the game. It\'s now properly tucked inside the menu, only visible when expanded'},
      {t:'fix', plat:'mobile', tx:'On a small screen, the expanded left menu could be taller than the screen itself, making some buttons (Discord, Admin...) unreachable. The menu now scrolls internally when needed instead of overflowing off-screen'},
    ] },
  { v:'V152', d:'05/07/2026 09:00', name:{fr:'Adaptation tablette/téléphone', en:'Tablet/phone optimization'}, fr:[
      {t:'new', plat:'mobile', tx:'Sur tablette/téléphone (≤1024px de large, couvre les tailles standards du marché — iPhone SE à iPad en paysage), le menu de gauche, le suivi de quêtes et le chat se replient désormais automatiquement par défaut pour ne plus recouvrir le jeu ni se chevaucher entre eux ; toujours dépliables en un tap. Aucun changement sur la version ordinateur (>1024px), testée et inchangée'},
    ], en:[
      {t:'new', plat:'mobile', tx:'On tablet/phone (≤1024px wide, covers standard market sizes — iPhone SE to iPad landscape), the left menu, quest tracker and chat now auto-fold by default so they no longer cover the game or overlap each other; still one tap away to expand. No change to the desktop version (>1024px), tested and unaffected'},
    ] },
  { v:'V151', d:'05/07/2026 08:15', name:{fr:'Dates des notes de version, tutoriel Compendium, joueurs fluides', en:'Patch note dates, Compendium tutorial, smooth players'}, fr:[
      {t:'fix', tx:'Les notes de version affichaient une date/heure de publication erronée (jusqu\'à plusieurs jours dans le futur) — corrigé pour les versions V91 à V150 avec l\'horodatage réel'},
      {t:'fix', tx:'Dans le tutoriel du Compendium, les étapes 4 et 6 (une zone/le sac protégé) affichaient l\'encadré par-dessus l\'élément mis en avant au lieu d\'au-dessus — une hauteur de boîte codée en dur ne correspondait pas au texte plus long de ces étapes ; corrigé pour mesurer la vraie hauteur'},
      {t:'change', tx:'Les autres joueurs dans l\'arène d\'un World Boss partagé bougent maintenant de façon fluide (interpolés à chaque image) au lieu de sauter d\'une position à l\'autre toutes les ~0.35s'},
    ], en:[
      {t:'fix', tx:'Patch notes showed a wrong publish date/time (up to several days in the future) — fixed for versions V91 through V150 with the real timestamp'},
      {t:'fix', tx:'In the Compendium tutorial, steps 4 and 6 (a zone / the protected bag) showed the box overlapping the highlighted element instead of sitting above it — a hardcoded box height didn\'t match these steps\' longer text; fixed to measure the real height'},
      {t:'change', tx:'Other players in a shared World Boss arena now move smoothly (interpolated every frame) instead of jumping from position to position every ~0.35s'},
    ] },
  { v:'V150', d:'05/07/2026 07:41', name:{fr:'Compendium : bonus de zone = TOUS les objets obtenus', en:'Compendium: zone bonus = ALL items obtained'}, fr:[
      {t:'change', tx:'Le bonus +1% d\'une zone n\'est désormais actif que si ses 4 objets (trash, matériau, bijou jackpot, objet craft) ont TOUS déjà été obtenus au moins une fois — avant, un seul suffisait. Une zone incomplète affiche "Objet manquant" au lieu de "Non visitée". Entièrement recalculé à partir de tes objets déjà possédés : aucune perte de progression, le changement s\'applique rétroactivement dès le rechargement'},
    ], en:[
      {t:'change', tx:'A zone\'s +1% bonus is now only active if ALL 4 of its items (trash, material, jackpot jewel, craft item) have been obtained at least once — previously just one was enough. An incomplete zone now shows "Missing item" instead of "Not visited". Fully recomputed from items you already own: no progress lost, the change applies retroactively as soon as you reload'},
    ] },
  { v:'V149', d:'05/07/2026 07:35', name:{fr:'Tutoriel du Compendium', en:'Compendium tutorial'}, fr:[
      {t:'new', tx:'Nouveau bouton "?" en haut à droite du Compendium : lance un mini-tutoriel expliquant la progression globale, les 4 onglets, comment lire une zone, la Maîtrise PEN et le Sac protégé. Se lance automatiquement à la toute première ouverture du panneau, et peut être relancé à tout moment avec ce bouton'},
    ], en:[
      {t:'new', tx:'New "?" button at the top-right of the Compendium: launches a mini-tutorial explaining overall progress, the 4 tabs, how to read a zone, PEN Mastery and the Protected bag. Launches automatically the very first time the panel is opened, and can be replayed anytime with this button'},
    ] },
  { v:'V148', d:'05/07/2026 07:29', name:{fr:'Correctif Compendium : zones marquées "Non visitée" à tort', en:'Compendium fix: zones wrongly shown "Not visited"'}, fr:[
      {t:'fix', tx:'Une zone pouvait afficher "Non visitée" dans le Compendium alors que ses objets étaient déjà cochés ✓ — le suivi des zones visitées n\'existait pas encore quand ces objets avaient été ramassés. Rattrapage rétroactif au chargement : si tu possèdes déjà l\'objet unique de la zone, elle est maintenant marquée visitée (et le bonus +1% associé accordé)'},
    ], en:[
      {t:'fix', tx:'A zone could show "Not visited" in the Compendium even though its items were already checked ✓ — zone-visited tracking didn\'t exist yet when those items were first picked up. Retroactively backfilled on load: if you already own the zone\'s unique item, it\'s now marked visited (and the associated +1% bonus granted)'},
    ] },
  { v:'V147', d:'05/07/2026 07:18', name:{fr:'Alerte double réclamation déplacée sur le salon cheat', en:'Double-claim alert moved to the cheat channel'}, fr:[
      {t:'change', tx:'L\'alerte "Tentative de double réclamation" part désormais sur le salon Discord "cheat" (comme les bornages anti-triche) au lieu du salon général — déplacée côté serveur directement dans boss_claim(), plus fiable et impossible à contourner côté client'},
    ], en:[
      {t:'change', tx:'The "Double-claim attempt" alert now goes to the "cheat" Discord channel (like anti-cheat clamps) instead of the general channel — moved server-side directly into boss_claim(), more reliable and impossible to bypass client-side'},
    ] },
  { v:'V146', d:'05/07/2026 07:06', name:{fr:'Correctif serveur : logs Discord bloqués par CORS', en:'Server fix: Discord logs blocked by CORS'}, fr:[
      {t:'fix', tx:'La fonction serveur qui relaie les événements vers Discord (boss vaincu, succès, loot rare, etc.) ne répondait pas correctement aux requêtes CORS depuis le site déployé — le navigateur bloquait l\'appel avant même qu\'il n\'atteigne le webhook, donc plus aucun log Discord ne partait. Corrigé côté serveur (Edge Function) ; vérifié par un appel de test réel depuis l\'extérieur, reçu avec succès'},
    ], en:[
      {t:'fix', tx:'The server function that relays events to Discord (boss defeated, achievements, rare loot, etc.) wasn\'t responding correctly to CORS requests from the deployed site — the browser blocked the call before it ever reached the webhook, so no Discord logs were going out anymore. Fixed server-side (Edge Function); verified with a real external test call, received successfully'},
    ] },
  { v:'V145', d:'05/07/2026 07:02', name:{fr:'Correctif : présence des joueurs en World Boss', en:'Fix: player presence in World Boss'}, fr:[
      {t:'fix', tx:'Grâce aux logs [BossPresence] : le canal de présence Realtime se fermait parfois tout seul (coupure réseau) pendant un combat de World Boss partagé, sans jamais se rétablir — les joueurs devenaient invisibles les uns aux autres pour le reste du combat. Le canal se reconnecte désormais automatiquement tant que le combat partagé est en cours'},
      {t:'fix', tx:'Corrigé un plantage JS toutes les 60s (ping de temps de jeu) qui pouvait perturber la page en arrière-plan : "sb.rpc(...).catch is not a function"'},
    ], en:[
      {t:'fix', tx:'Thanks to the [BossPresence] logs: the Realtime presence channel sometimes closed on its own (network hiccup) during a shared World Boss fight and never recovered — players became invisible to each other for the rest of the fight. The channel now automatically reconnects as long as the shared fight is ongoing'},
      {t:'fix', tx:'Fixed a JS crash every 60s (playtime ping) that could disrupt the page in the background: "sb.rpc(...).catch is not a function"'},
    ] },
  { v:'V144', d:'05/07/2026 06:56', name:{fr:'Diagnostic : présence des joueurs en World Boss', en:'Diagnostics: player presence in World Boss'}, fr:[
      {t:'fix', tx:'Le partage des PV/top 10 fonctionne bien en World Boss (confirmé par test à 2 comptes), mais les silhouettes des autres joueurs restent invisibles dans l\'arène — traces de diagnostic ajoutées (console, préfixe [BossPresence]) pour identifier précisément la cause au prochain test'},
    ], en:[
      {t:'fix', tx:'HP/top 10 sharing works correctly in World Boss (confirmed via 2-account test), but other players\' silhouettes remain invisible in the arena — diagnostic logging added (console, [BossPresence] prefix) to pinpoint the exact cause on the next test'},
    ] },
  { v:'V143', d:'05/07/2026 06:42', name:{fr:'Correctif serveur : Vell planifié était toujours en solo', en:'Server fix: scheduled Vell was always solo'}, fr:[
      {t:'fix', tx:'Les apparitions programmées de Vell (jeudi 12h00, dimanche 16h45) ne créaient jamais d\'instance PARTAGÉE côté serveur — chaque joueur combattait Vell tout seul, sans jamais voir les autres joueurs ni PV communs, contrairement à Kzarka qui fonctionnait déjà correctement. Corrigé côté Supabase ; un spawn Vell déclenché par le planning est désormais bien partagé entre tous les joueurs, exactement comme un spawn admin'},
      {t:'fix', tx:'Correctif complémentaire : un spawn admin en cours (ex: Vell lancé manuellement) pouvait être écrasé par erreur si un créneau planifié de Kzarka devenait actif entre-temps — n\'importe quel spawn valide (admin ou planifié) est désormais protégé jusqu\'à son expiration'},
    ], en:[
      {t:'fix', tx:'Vell\'s scheduled appearances (Thursday 12:00, Sunday 16:45) never created a SHARED instance server-side — each player fought Vell completely alone, never seeing other players or shared HP, unlike Kzarka which already worked correctly. Fixed server-side; a scheduled Vell spawn is now properly shared among all players, exactly like an admin spawn'},
      {t:'fix', tx:'Additional fix: an ongoing admin spawn (e.g. Vell triggered manually) could be wrongly overwritten if a scheduled Kzarka slot became active in the meantime — any valid spawn (admin or scheduled) is now protected until it expires'},
    ] },
  { v:'V142', d:'05/07/2026 06:33', name:{fr:'Persistance : chat, encarts de suivi', en:'Persistence: chat, tracker widgets'}, fr:[
      {t:'change', tx:'Le canal de chat choisi et l\'état replié/déplié du chat survivent maintenant à un rechargement de la page (comme le menu de gauche, déjà persisté)'},
      {t:'change', tx:'Les encarts "🗒️ Suivi" (temps de jeu, reset quotidien/hebdo) et "🔖 Quêtes suivies" gardent leur état replié/déplié après un rechargement au lieu de toujours repartir dépliés'},
    ], en:[
      {t:'change', tx:'The chosen chat channel and the chat\'s folded/unfolded state now survive a page reload (like the left menu, already persisted)'},
      {t:'change', tx:'The "🗒️ Tracker" (playtime, daily/weekly reset) and "🔖 Tracked quests" widgets keep their folded/unfolded state after a reload instead of always starting unfolded'},
    ] },
  { v:'V141', d:'05/07/2026 06:25', name:{fr:'10 spots fixes par World Boss, Vell sur les pontons', en:'10 fixed spots per World Boss, Vell on the boat decks'}, fr:[
      {t:'change', tx:'Chaque joueur arrive désormais sur l\'un de 10 spots fixes tirés au hasard dans l\'arène du boss (au lieu de se superposer exactement au même point que tout le monde), et y revient entre deux AoE — les joueurs se voient enfin répartis dans la zone pendant la strat'},
      {t:'change', tx:'Sur Vell, ces 10 spots sont répartis sur les pontons des 2 bateaux (5 chacun) au lieu d\'un point unique en pleine mer'},
    ], en:[
      {t:'change', tx:'Each player now spawns on one of 10 fixed spots picked at random in the boss arena (instead of stacking exactly on the same point as everyone else), and returns there between AoEs — players are finally spread out visibly during the strat'},
      {t:'change', tx:'On Vell, these 10 spots are spread across the 2 boats\' decks (5 each) instead of a single point out in open water'},
    ] },
  { v:'V140', d:'05/07/2026 05:23', name:{fr:'Planning des World Boss ancré sur l\'heure française', en:'World Boss schedule anchored to French time'}, fr:[
      {t:'fix', tx:'Les horaires de Vell/Kzarka (repris de garmoth.com) sont ceux de l\'heure française (Europe/Paris) — mais le planning était calculé avec l\'heure LOCALE du navigateur, donc un joueur situé hors de France voyait un planning décalé de son propre fuseau. Le calcul est maintenant toujours ancré sur l\'heure de Paris (été/hiver géré automatiquement), quel que soit le fuseau du joueur'},
    ], en:[
      {t:'fix', tx:'Vell/Kzarka\'s schedule (sourced from garmoth.com) is in French time (Europe/Paris) — but it was computed using the browser\'s LOCAL time, so a player outside France saw a schedule shifted by their own timezone. The schedule is now always anchored to Paris time (summer/winter handled automatically), regardless of the player\'s timezone'},
    ] },
  { v:'V139', d:'05/07/2026 04:53', name:{fr:'Alerte Discord sur tentative de double réclamation', en:'Discord alert on double-claim attempt'}, fr:[
      {t:'new', tx:'Le blocage anti-double-réclamation d\'un World Boss (voir V135) était totalement silencieux — chaque tentative de re-réclamer une récompense déjà payée envoie désormais une alerte sur Discord (pseudo du joueur, boss concerné), pour repérer les abus'},
    ], en:[
      {t:'new', tx:'The World Boss anti-double-claim block (see V135) was completely silent — every attempt to re-claim an already-paid reward now sends a Discord alert (player name, boss involved), to spot abuse'},
    ] },
  { v:'V138', d:'05/07/2026 04:52', name:{fr:'Correctif : Vell affichait en fait Kzarka', en:'Fix: Vell was actually showing Kzarka'}, fr:[
      {t:'fix', tx:'Bug de longue date : le combat de Vell affichait en réalité toujours la silhouette de Kzarka (rouge/brun) — la fonction qui choisit le dessin comparait le mauvais identifiant et ne reconnaissait jamais Vell. Toutes les silhouettes de Vell dessinées depuis plusieurs versions (bateaux, ailes-vasque...) n\'étaient donc jamais visibles en jeu ; elles s\'affichent enfin correctement maintenant'},
    ], en:[
      {t:'fix', tx:'Long-standing bug: Vell\'s fight actually always displayed Kzarka\'s silhouette (red/brown) — the function choosing which creature to draw was comparing the wrong identifier and never recognized Vell. Every Vell silhouette drawn over the last several versions (boats, wing-bowl...) was therefore never actually visible in-game; it now renders correctly'},
    ] },
  { v:'V137', d:'05/07/2026 04:47', name:{fr:'Vell : ailes-vasque (angles supplémentaires de la sculpture)', en:'Vell: wing-bowl shape (extra sculpture angles)'}, fr:[
      {t:'change', tx:'Silhouette de Vell affinée d\'après 5 angles de la sculpture 3D de référence : ce que l\'on prenait pour des cornes/socle séparé sont en fait les 2 AILES du dragon, si immenses qu\'elles s\'enroulent vers l\'intérieur et se rejoignent en bas pour former une grande vasque — le corps du dragon (petit, crête de pointes, museau fin, longue queue en lame recourbée) est perché tout en haut, pattes agrippées au rebord'},
    ], en:[
      {t:'change', tx:'Vell\'s silhouette refined from 5 angles of the reference 3D sculpture: what looked like separate horns/a base are actually the dragon\'s 2 WINGS, so huge they curl inward and meet at the bottom to form a large bowl — the dragon\'s body (small, spiked crest, slender snout, long curved blade-tipped tail) perches at the top, claws gripping the rim'},
    ] },
  { v:'V136', d:'05/07/2026 04:44', name:{fr:'Vell : nouvelle silhouette (cornes enroulées, socle drapé)', en:'Vell: new silhouette (curled horns, draped base)'}, fr:[
      {t:'change', tx:'Silhouette de Vell redessinée une 3e fois d\'après une sculpture 3D de référence : deux immenses cornes/ailes enroulées en "C" qui encadrent la tête, une crête de pointes sur la nuque, un museau fin aux crocs visibles, des bras griffus repliés devant, une longue queue fine et courbe, le tout émergeant d\'un socle drapé façon vague/tissu enroulé'},
    ], en:[
      {t:'change', tx:'Vell\'s silhouette redesigned a 3rd time from a reference 3D sculpture: two huge horns/wings curled into a "C" shape framing the head, a spiked ridge along the neck, a slender snout with visible fangs, clawed arms folded in front, a long thin curved tail, all emerging from a draped wave/cloth-like base'},
    ] },
  { v:'V135', d:'05/07/2026 04:29', name:{fr:'Correctif exploit World Boss, Vell dragon, notifications par onglets', en:'World Boss exploit fix, Vell dragon redesign, tabbed notifications'}, fr:[
      {t:'exploit', tx:'Corrigé un exploit sérieux : sur un boss partagé déjà mort, rentrer dans l\'arène redéclenchait la victoire et payait silver/matériau/loot rare une DEUXIÈME fois, alors que le serveur refusait déjà la réclamation en silence — le client accordait la récompense sans jamais vérifier si la réclamation avait réussi. Chaque victoire ne peut désormais être payée qu\'une seule fois'},
      {t:'change', tx:'Vell entièrement redessiné d\'après la vraie photo de référence : couronne de cornes/pointes asymétriques, grande gueule ouverte pleine de crocs, ailes membraneuses déployées, plastron clair/orangé, pattes griffues — une silhouette de dragon des mers, plus rien à voir avec le poisson/serpent précédent ni avec Kzarka'},
      {t:'change', tx:'Centre de notifications : les catégories (Important/Réussites/Activité) sont maintenant des onglets FIXES en haut du panneau au lieu de simples titres perdus dans le défilement'},
      {t:'fix', tx:'Le panneau "Top contributeurs" d\'un boss partagé est repoussé plus bas pour ne plus jamais chevaucher la croix "✕" de sortie du combat'},
    ], en:[
      {t:'exploit', tx:'Fixed a serious exploit: re-entering an already-dead shared boss\'s arena re-triggered victory and paid out silver/material/rare loot a SECOND time, even though the server was already silently rejecting the claim — the client granted the reward without ever checking whether the claim actually succeeded. Each victory can now only be paid out once'},
      {t:'change', tx:'Vell fully redesigned from the real reference photo: a crown of asymmetric horns/spikes, a huge fang-filled open maw, spread membranous wings, a pale/orange chest plate, clawed legs — a sea dragon silhouette, nothing like the previous fish/serpent design or Kzarka'},
      {t:'change', tx:'Notification center: categories (Important/Achievements/Activity) are now FIXED tabs at the top of the panel instead of plain headers lost in the scroll'},
      {t:'fix', tx:'A shared boss\'s "Top contributors" panel is pushed further down so it never overlaps the "✕" exit cross again'},
    ] },
  { v:'V134', d:'05/07/2026 04:09', name:{fr:'Silhouette de Vell redessinée (forme distincte de Kzarka)', en:'Vell\'s silhouette redesigned (shape distinct from Kzarka)'}, fr:[
      {t:'change', tx:'Silhouette de Vell entièrement redessinée pour ne plus ressembler à Kzarka en composition : corps massif HORIZONTAL façon baleine qui déferle en diagonale (au lieu d\'un buste vertical), tête émoussée penchée en avant avec la mâchoire sur le dessous, et une grappe de 6 longs tentacules ondulants sous la tête — plus aucune paire de bras/griffes'},
    ], en:[
      {t:'change', tx:'Vell\'s silhouette fully redesigned to stop resembling Kzarka in composition: a massive HORIZONTAL whale-like body surging diagonally (instead of a vertical torso), a blunt head tilted forward with the jaw underneath, and a cluster of 6 long swaying tentacles under the head — no more arm/claw pair'},
    ] },
  { v:'V133', d:'05/07/2026 04:01', name:{fr:'Sac "Compendium" : protège les objets jamais montés en PEN', en:'"Compendium" bag: protects items never brought to PEN'}, fr:[
      {t:'new', tx:'Nouveau sac dédié "📖 Compendium" (192 cases, comme le sac principal) : quand "Vendre" s\'apprête à vendre une pièce d\'équipement ou un bijou dont ce TYPE n\'a jamais atteint PEN, le 1er exemplaire trouvé est protégé ici au lieu d\'être vendu — les exemplaires suivants du même type continuent d\'être vendus normalement'},
      {t:'new', tx:'Nouvel onglet "🎒 Sac protégé" dans le Compendium pour consulter ce sac et renvoyer un objet au sac principal en un clic'},
      {t:'change', tx:'Le message de "Vendre" précise maintenant combien d\'objets ont été vendus VS protégés dans le sac Compendium ; "Racheter" ne redevient actif que s\'il y a vraiment quelque chose à racheter (les objets protégés n\'ont jamais quitté ta possession)'},
    ], en:[
      {t:'new', tx:'New dedicated "📖 Compendium" bag (192 slots, like the main bag): when "Sell" is about to sell a gear piece or jewel whose TYPE has never reached PEN, the 1st copy found is protected here instead of being sold — further copies of the same type keep being sold normally'},
      {t:'new', tx:'New "🎒 Protected bag" tab in the Compendium to browse this bag and send an item back to your main bag in one click'},
      {t:'change', tx:'The "Sell" message now shows how many items were sold VS protected in the Compendium bag; "Buy back" only becomes active if there\'s actually something to buy back (protected items never left your possession)'},
    ] },
  { v:'V132', d:'05/07/2026 03:52', name:{fr:'Vell : ancres des bateaux, montagnes et entrée unique', en:'Vell: ship anchors, mountains and single entrance'}, fr:[
      {t:'change', tx:'Les abris de la charge de Vell sont désormais les ancres des 2 bateaux (chaîne qui descend du pont) au lieu des anciens piliers de pierre de Kzarka — cohérent avec le fait que les joueurs sont sur les bateaux'},
      {t:'new', tx:'Vell est maintenant cerné de montagnes de tous les côtés, avec une seule entrée étroite au centre pour l\'apercevoir depuis les bateaux, d\'après la capture de référence ("Barrier Rock")'},
    ], en:[
      {t:'change', tx:'Vell\'s charge shelters are now the 2 boats\' anchors (chain hanging from the deck) instead of Kzarka\'s old stone pillars — consistent with players being on the boats'},
      {t:'new', tx:'Vell is now surrounded by mountains on every side, with a single narrow entrance in the middle to glimpse him from the boats, based on the reference capture ("Barrier Rock")'},
    ] },
  { v:'V131', d:'05/07/2026 03:49', name:{fr:'Optimisation & Craft fusionnés, craft toujours visible', en:'Enhancement & Crafting merged, craft always visible'}, fr:[
      {t:'change', tx:'Les cartes "Conseil de stuff & Craft" et "Optimisation" sont fusionnées en une seule carte, avec l\'Optimisation en tête'},
      {t:'fix', tx:'Le panneau de craft du Trésor de Velia ne s\'affichait QUE quand l\'onglet "Trésors" de l\'inventaire était ouvert (reste de l\'époque où il vivait dans la carte Inventaire) — il reste maintenant visible en permanence dans la carte Optimisation'},
      {t:'change', tx:'Le Compendium précise maintenant clairement qu\'un clic sur une zone lance le farm directement (téléportation immédiate, sans confirmation), pas juste un aperçu'},
    ], en:[
      {t:'change', tx:'The "Gear advice & Crafting" and "Enhancement" cards are merged into one card, with Enhancement at the top'},
      {t:'fix', tx:'The Velia Treasure crafting panel only showed when the inventory\'s "Treasures" tab was open (a leftover from when it lived in the Inventory card) — it now stays visible at all times in the Enhancement card'},
      {t:'change', tx:'The Compendium now clearly states that clicking a zone starts farming there directly (instant teleport, no confirmation), not just a preview'},
    ] },
  { v:'V130', d:'05/07/2026 03:38', name:{fr:'Bateaux de Vell 10× plus gros, le héros plonge vraiment', en:'Vell\'s boats 10× bigger, hero really dives'}, fr:[
      {t:'change', tx:'Les 2 bateaux du combat de Vell sont désormais 10× plus gros, repoussés dans les coins bas de l\'écran pour rester au premier plan sans recouvrir tout le combat'},
      {t:'new', tx:'Le héros plonge VRAIMENT sous l\'eau quand il s\'abrite près d\'une bouée pendant la charge de Vell : il disparaît, remplacé par des ridules et des bulles qui remontent, au lieu de rester debout avec juste un bouclier bleu'},
    ], en:[
      {t:'change', tx:'Vell\'s 2 boats are now 10× bigger, pushed into the bottom corners of the screen to stay in the foreground without covering the whole fight'},
      {t:'new', tx:'The hero now REALLY dives underwater when taking shelter near a buoy during Vell\'s charge: they vanish, replaced by ripples and rising bubbles, instead of just standing there with a blue shield'},
    ] },
  { v:'V129', d:'05/07/2026 03:29', name:{fr:'Conseil de stuff & Craft regroupés, loot Velia condensé, Maîtrise PEN', en:'Grouped gear advice & Crafting, condensed Velia loot, PEN Mastery'}, fr:[
      {t:'change', tx:'Nouvelle carte "Conseil de stuff & Craft" en bas à droite, juste au-dessus de l\'Optimisation : regroupe le conseil de progression et TOUS les crafts (Trésor de Velia + conversion Poussière→Caphras), qui étaient auparavant éparpillés dans l\'Inventaire et l\'Optimisation'},
      {t:'fix', tx:'Le récapitulatif de loot "toutes zones" affiché à Velia est maintenant CONDENSÉ (1 ligne par zone, dépliable au clic) au lieu d\'afficher les 6 lignes de chaque zone d\'un coup — fini le scroll interminable'},
      {t:'change', tx:'La ligne "Pierre de Cron" dans la table de loot précise maintenant "1 à 3 unités" en plus du taux de drop'},
      {t:'fix', tx:'La Pierre Noire a désormais exactement la même couleur que le stuff Yuria (vert)'},
      {t:'fix', tx:'Les boutons "Équiper meilleur" et "Vendre" font maintenant exactement la même taille (le bouton "Racheter" se superpose en coin sans plus grignoter la largeur de "Vendre")'},
      {t:'new', tx:'Nouveau Compendium spécial "🌟 Maîtrise PEN" : liste les 39 objets optimisables du jeu (7 pièces × 4 paliers + 1 bijou par zone) et suit lesquels ont atteint PEN au moins une fois — un pur suivi de complétion, sans bonus de stats'},
    ], en:[
      {t:'change', tx:'New "Gear advice & Crafting" card in the bottom right, right above Enhancement: groups the progression advice and ALL crafting (Velia Treasure + Dust→Caphras conversion), previously scattered across Inventory and Enhancement'},
      {t:'fix', tx:'The "all zones" loot summary shown at Velia is now CONDENSED (1 line per zone, expandable on click) instead of showing all 6 lines per zone at once — no more endless scrolling'},
      {t:'change', tx:'The "Cron Stone" row in the loot table now shows "1 to 3 units" alongside the drop rate'},
      {t:'fix', tx:'The Black Stone now has the exact same color as Yuria (green) gear'},
      {t:'fix', tx:'"Equip best" and "Sell" buttons are now exactly the same size ("Buy back" now overlaps a corner instead of eating into "Sell"\'s width)'},
      {t:'new', tx:'New special "🌟 PEN Mastery" Compendium: lists all 39 optimizable items in the game (7 pieces × 4 tiers + 1 jewel per zone) and tracks which ones have reached PEN at least once — a pure completion tracker, no stat bonus'},
    ] },
  { v:'V128', d:'05/07/2026 03:18', name:{fr:'Vell en mer, Coeur de Vell, bonus de zone, Compendium refait', en:'Vell at sea, Heart of Vell, zone bonus, reworked Compendium'}, fr:[
      {t:'new', tx:'Combat de Vell entièrement repensé d\'après les captures fournies : arène en pleine mer (ciel, pitons rocheux au loin, rides d\'eau), 2 bateaux qui tirent des boulets de canon animés sur le monstre (avec un tic de dégâts à chaque impact), et sa charge périodique devient "PLONGE !" — il faut se réfugier près d\'une bouée au lieu de se cacher derrière un pilier'},
      {t:'new', tx:'Vell a 5% de chance de looter le Coeur de Vell à sa mort — une roue de récompense qui tourne toute seule s\'affiche en fin de combat, révélant si tu l\'as obtenu (visible même quand tu ne l\'as pas)'},
      {t:'new', tx:'La récompense de silver/matériau des World Boss dépend maintenant de ta meilleure zone découverte, mais SEULEMENT si tu es "certifié sans mort" depuis au moins 3 minutes — sinon aucun bonus de zone'},
      {t:'new', tx:'Le Compendium suit maintenant aussi les World Boss vaincus (même bonus +1% qu\'une zone) et a été entièrement refait : carte de progression claire (SPD/Dégâts/Esquive), onglets Zones/World Boss, et un clic sur un objet montre en halo doré toutes les zones qui le lootent avec un bouton pour y aller directement'},
    ], en:[
      {t:'new', tx:'Vell\'s fight fully reworked from the provided reference images: an open-sea arena (sky, distant rock spires, water ripples), 2 boats firing animated cannonballs at the creature (with a damage tick on each impact), and its periodic charge becomes "DIVE!" — you must take shelter near a buoy instead of hiding behind a pillar'},
      {t:'new', tx:'Vell has a 5% chance to drop the Heart of Vell on death — a reward wheel spins on its own at the end of the fight, revealing whether you got it (shown even when you didn\'t)'},
      {t:'new', tx:'World Boss silver/material rewards now scale with your best discovered zone, but ONLY if you\'ve been "death-free certified" for at least 3 minutes — otherwise no zone bonus'},
      {t:'new', tx:'The Compendium now also tracks defeated World Bosses (same +1% bonus as a zone) and was completely reworked: a clear progress card (SPD/Damage/Dodge), Zones/World Boss tabs, and clicking an item shows a gold halo on every zone that drops it with a button to travel there directly'},
    ] },
  { v:'V127', d:'05/07/2026 03:05', name:{fr:'Loot Velia, Pierre de Cron, Pierre Noire recolorée', en:'Velia loot, Cron Stone, Black Stone recolored'}, fr:[
      {t:'fix', tx:'Velia (zone paisible) affichait par erreur les stats de la dernière zone farmée dans le cadre "Butin" — affiche maintenant un message clair ("aucun monstre, aucun loot possible ici") suivi d\'un récapitulatif du loot de TOUTES les zones de Velia, zone par zone'},
      {t:'change', tx:'La Pierre Noire (palier Yuria/vert) est recolorée en vert (icône + couleur), au lieu du noir/violet d\'origine — cohérent avec le palier qu\'elle sert à optimiser'},
      {t:'new', tx:'Nouvelle Pierre de Cron : dropée dans TOUTES les zones du jeu à un taux fixe de 0.1% (1 à 3 unités), protège automatiquement un enchantement d\'une rétrogradation en cas d\'échec (consommée seulement quand elle sert vraiment)'},
    ], en:[
      {t:'fix', tx:'Velia (peaceful zone) wrongly showed the last farmed zone\'s stats in the "Loot" panel — now shows a clear message ("no monsters, no loot possible here") followed by a summary of ALL Velia zones\' loot, zone by zone'},
      {t:'change', tx:'The Black Stone (Yuria/green tier) is now green (icon + color), instead of the original black/purple — consistent with the tier it enhances'},
      {t:'new', tx:'New Cron Stone: drops in EVERY zone in the game at a fixed 0.1% rate (1 to 3 units), automatically protects an enhancement from downgrading on failure (only consumed when it actually matters)'},
    ] },
  { v:'V126', d:'05/07/2026 02:54', name:{fr:'Craft du Trésor, notifications repensées, potions, + de logs Discord', en:'Treasure crafting, revamped notifications, potions, more Discord logs'}, fr:[
      {t:'new', tx:'Craft du Trésor de Velia : 100 "Bout du trésor" → 1 "Trésor de Velia" (même numéro), et 3 Trésors (mélangés) → 1 "Objet inconnu" mystère. Panneau dédié dans l\'onglet Trésors de l\'inventaire'},
      {t:'fix', tx:'Corrigé un doublon de nom : la 2e ligne "Bout du trésor de Velia 1" (la plus rare) est en fait le morceau du "Velia 2" — renommée en conséquence'},
      {t:'new', tx:'État du Compendium affiché directement dans la zone de farm (📖 X/11, doré quand complet)'},
      {t:'change', tx:'Centre de notifications repensé : persistant (survit au reload), affiche les 20 dernières entrées avec défilement, bouton supprimer par ligne, auto-suppression après 7 jours, et un halo doré sur la cloche quand il y a du nouveau'},
      {t:'new', tx:'Nouvelle "Potion de vie infinie" (coût 0) ajoutée en bas du sélecteur, verrouillée 🔒 en attendant un futur déblocage'},
      {t:'change', tx:'Potions recalibrées par rapport à la courbe de gains des zones (~3 000 à 100 000 silver/h) ; le temps de recharge (CD) est maintenant affiché à côté du prix pour chacune'},
      {t:'change', tx:'"Capheon" corrigé en "Calpheon" dans les onglets de zones'},
      {t:'new', tx:'Plein de nouveaux logs Discord "pour le fun" : montée de niveau, nouvelle zone atteinte, bonus de Compendium débloqué, trésor trouvé, objets craftés, paliers de kills (tous les 1000), record de kills/min battu'},
    ], en:[
      {t:'new', tx:'Velia Treasure crafting: 100 "Treasure pieces" → 1 "Velia Treasure" (matching number), and 3 Treasures (mixed) → 1 mystery "Unknown Item". Dedicated panel in the inventory\'s Treasures tab'},
      {t:'fix', tx:'Fixed a duplicate name: the 2nd "Velia Treasure piece 1" row (the rarer one) was actually the piece for "Velia 2" — renamed accordingly'},
      {t:'new', tx:'Compendium status now shown directly in the farm zone (📖 X/11, gold when complete)'},
      {t:'change', tx:'Notification center reworked: persistent (survives reload), shows the last 20 entries with scrolling, per-row delete button, auto-deletion after 7 days, and a gold halo on the bell when there\'s something new'},
      {t:'new', tx:'New "Infinite HP Potion" (cost 0) added at the bottom of the selector, locked 🔒 pending a future unlock'},
      {t:'change', tx:'Potions recalibrated against the zone earnings curve (~3,000 to 100,000 silver/h); cooldown (CD) is now shown next to the price for each one'},
      {t:'change', tx:'"Capheon" fixed to "Calpheon" in the zone tabs'},
      {t:'new', tx:'Lots of new "for fun" Discord logs: level up, new zone reached, Compendium bonus unlocked, treasure found, items crafted, kill milestones (every 1000), kills/min record broken'},
    ] },
  { v:'V125', d:'05/07/2026 02:38', name:{fr:'Compendium, Vitesse (SPD) et Esquive', en:'Compendium, Speed (SPD) and Dodge'}, fr:[
      {t:'new', tx:'Nouveau 📖 Compendium : ramasse au moins 1 objet dans chaque zone pour débloquer son bonus permanent — +1% Vitesse, +1% Dégâts, +1% Esquive PAR zone (additif, jamais un multiplicateur : les 11 zones donnent +11% de chaque, pas +100%)'},
      {t:'new', tx:'Nouvelle stat Vitesse (SPD) : augmente avec le niveau, de +0% au niveau 1 jusqu\'à +75% au niveau 61 (plafonné), en plus du bonus de Compendium'},
      {t:'new', tx:'Nouvelle stat Esquive, qui se trouve UNIQUEMENT sur les 4 pièces d\'armure : évite complètement un coup en cas de succès. Son efficacité dépend de ton niveau de PD face à la zone — inutile face à un monstre bien trop fort pour toi, mais très puissante (jusqu\'à zéro dégât) dans une zone où tu es largement au-dessus du niveau requis'},
      {t:'change', tx:'But du jeu affiné : un bon taux de Vitesse et d\'Esquive permet de ne jamais mourir et de farmer plus vite — les tooltips d\'objets, la comparaison d\'équipement et "Équiper le meilleur" prennent maintenant l\'Esquive en compte'},
    ], en:[
      {t:'new', tx:'New 📖 Compendium: loot at least 1 item in each zone to unlock its permanent bonus — +1% Speed, +1% Damage, +1% Dodge PER zone (additive, never a multiplier: all 11 zones give +11% each, not +100%)'},
      {t:'new', tx:'New Speed (SPD) stat: increases with level, from +0% at level 1 up to +75% at level 61 (capped), on top of the Compendium bonus'},
      {t:'new', tx:'New Dodge stat, found ONLY on the 4 armor pieces: fully avoids a hit on success. Its effectiveness depends on your DP level relative to the zone — useless against a monster far too strong for you, but very powerful (up to zero damage) in a zone you\'ve far outgrown'},
      {t:'change', tx:'Refined game goal: a good Speed and Dodge rate lets you never die and farm faster — item tooltips, gear comparison and "Equip best" now account for Dodge'},
    ] },
  { v:'V124', d:'05/07/2026 02:24', name:{fr:'Enchantement ralenti, zones recalibrées, World Boss Vell', en:'Slower enhancement, recalibrated zones, Vell World Boss'}, fr:[
      {t:'change', tx:'Ralenti le gain de PA/PD des paliers +1 à +15 (divisé par ~1.6) : un stuff complet à +0 ne suffit plus à franchir la zone de couleur suivante, il faut réellement pousser jusqu\'à PRI+ pour progresser — les paliers PRI/DUO/TRI/TET/PEN représentent maintenant plus de la moitié du gain total à PEN'},
      {t:'change', tx:'PA/PD requis relevés d\'environ 30% sur les zones Camp Rhutum, Mine de Fer Abandonnée et Sanctuaire Elric (premières zones de chaque nouveau palier de couleur), et les zones suivantes de chaque palier réajustées en proportion pour garder une progression lisse'},
      {t:'change', tx:'% de drop de la Pierre concentrée doublé sur Sanctuaire Elric et Ruines de Kratuga (les 2 dernières zones, seule source de ce matériau) pour compenser l\'enchantement plus lent sur le stuff bleu'},
      {t:'new', tx:'Nouveau World Boss hebdomadaire : Vell, la Terreur des Flots (grand poisson des mers) — silhouette originale provisoire en attendant une photo de référence. Apparaît jeudi et dimanche, aux horaires du vrai Black Desert moins 15 minutes'},
    ], en:[
      {t:'change', tx:'Slowed AP/DP gains from +1 to +15 (cut by ~1.6): a full +0 gear set no longer clears the next color zone by itself — you now need to genuinely push to PRI+ to progress. The PRI/DUO/TRI/TET/PEN tiers now account for more than half the total gain at PEN'},
      {t:'change', tx:'Required AP/DP raised by roughly 30% on Rhutum Camp, Abandoned Iron Mine and Elric Sanctuary (the first zone of each new color tier), with the following zones of each tier scaled proportionally for a smooth curve'},
      {t:'change', tx:'Concentrated Stone drop rate doubled on Elric Sanctuary and Kratuga Ruins (the last 2 zones, the only source of this material) to offset the slower enhancement on blue-tier gear'},
      {t:'new', tx:'New weekly World Boss: Vell, Terror of the Tides (a giant sea creature) — a provisional original silhouette pending a reference photo. Appears Thursday and Sunday, at real Black Desert times minus 15 minutes'},
    ] },
  { v:'V123', d:'05/07/2026 02:07', name:{fr:'PA/PD affichés à côté du Gearscore (classement + admin)', en:'AP/DP shown next to Gearscore (leaderboard + admin)'}, fr:[
      {t:'new', tx:'Le classement "Gearscore" affiche maintenant le détail PA/PD de chaque joueur entre parenthèses, pas juste le score global'},
      {t:'new', tx:'Le tableau "Joueurs" du panneau admin a 2 nouvelles colonnes PA et PD, à côté du Gearscore'},
    ], en:[
      {t:'new', tx:'The "Gearscore" leaderboard now shows each player\'s AP/DP breakdown in parentheses, not just the overall score'},
      {t:'new', tx:'The admin panel\'s "Players" table has 2 new AP and DP columns, next to Gearscore'},
    ] },
  { v:'V122', d:'05/07/2026 01:54', name:{fr:'Mine de Fer Abandonnée : mineurs, boss de pack, décor de carrière', en:'Abandoned Iron Mine: miners, pack bosses, quarry scenery'}, fr:[
      {t:'new', tx:'Nouvelles silhouettes originales pour la Mine de Fer Abandonnée : le Mineur corrompu (voûté, capuche tombante, yeux rougeoyants, pioche à l\'épaule) et son contremaître blindé — 1 pack sur 2 est mené par ce boss massif bardé de pointes, plus gros et qui loot plus (bonus élite ×1.5-1.6 déjà en place)'},
      {t:'new', tx:'Décor de carrière dédié à la Mine de Fer : terre rouge/ocre, tours de guet en bois, pitons rocheux, chariots de minerai cassés, crevasses et éboulis — fini le décor générique'},
      {t:'fix', tx:'Trouvé un bug silencieux présent depuis toujours : la fonction de bruit du décor ne pouvait mathématiquement jamais dépasser 0.5 (bit de signe annulé dans le mélange final), donc AUCUN rocher/buisson/touffe n\'apparaissait dans les zones de combat. Corrigé : toutes les zones retrouvent leur végétation et leurs rochers'},
    ], en:[
      {t:'new', tx:'New original silhouettes for the Abandoned Iron Mine: the Corrupted Miner (hunched, drooping hood, glowing eyes, pickaxe on the shoulder) and its armored foreman — every other pack is led by this massive spiked boss, bigger and with better loot (the ×1.5-1.6 elite bonuses already in place)'},
      {t:'new', tx:'Dedicated quarry scenery for the Iron Mine: red/ochre earth, wooden watchtowers, rock spires, broken ore carts, crevasses and scree — no more generic scenery'},
      {t:'fix', tx:'Found a silent bug present since forever: the scenery noise function could mathematically never exceed 0.5 (sign bit self-cancelled in the final mix), so NO rocks/bushes/tufts ever appeared in combat zones. Fixed: every zone gets its vegetation and rocks back'},
    ] },
  { v:'V121', d:'05/07/2026 01:41', name:{fr:'Silhouette du Combattant Sausan', en:'Sausan Fighter silhouette'}, fr:[
      {t:'new', tx:'Nouvelle silhouette originale pour le Combattant Sausan (Colonie Sausan, juste après la Ferme Shultz) : guerrier des sables en cotte de mailles, capuche pointue rabattue, voile de tissu masquant le bas du visage et cimeterre courbe — au lieu de la silhouette générique. Son icône apparaît aussi en haut à gauche'},
    ], en:[
      {t:'new', tx:'New original silhouette for the Sausan Fighter (Sausan Colony, right after Shultz Farm): a desert warrior in chainmail with a pointed hood, a cloth veil over the lower face and a curved scimitar — instead of the generic silhouette. Its icon also appears in the top-left'},
    ] },
  { v:'V120', d:'05/07/2026 01:35', name:{fr:'Icône du monstre de zone, silhouette Garde Shultz', en:'Zone monster icon, Shultz Guard silhouette'}, fr:[
      {t:'new', tx:'Petite icône du monstre de la zone en cours affichée en haut à gauche de l\'écran de jeu (buste simplifié, une par zone déjà modélisée, feuillage doré pour Velia la zone paisible)'},
      {t:'new', tx:'Nouvelle silhouette originale pour le Garde Shultz (Ferme Shultz, juste après le Camp Rhutum) : garde humain lourdement blindé, casque à cimier empanaché, épaulières massives, moustache/bouc blanc et arme lourde brandie au-dessus de la tête'},
    ], en:[
      {t:'new', tx:'Small icon of the current zone\'s monster shown in the top-left of the game screen (simplified bust, one per already-modeled zone, golden foliage for Velia the peaceful zone)'},
      {t:'new', tx:'New original silhouette for the Shultz Guard (Shultz Farm, right after Rhutum Camp): a heavily armored human guard with a plumed helmet, massive pauldrons, white mustache/goatee, and a heavy weapon raised overhead'},
    ] },
  { v:'V119', d:'05/07/2026 01:24', name:{fr:'Silhouette du Guerrier Rhutum, taux de gain silver (admin)', en:'Rhutum Warrior silhouette, silver earn rate (admin)'}, fr:[
      {t:'new', tx:'Nouvelle silhouette originale pour le Guerrier Rhutum (Camp Rhutum, juste après le Repaire des Pirates) : humanoïde massif à peau verte, crâne à crête de plumes, bouc tressé et défenses — au lieu de la silhouette générique'},
      {t:'new', tx:'Onglet admin "Silver" : nouveau tableau "Qui gagne le plus vite ?" — classe les joueurs par taux de gain à vie (silver gagné ÷ temps de jeu), pour voir d\'un coup d\'œil qui progresse vite et en combien de temps, pas juste qui a le plus gros total'},
      {t:'change', tx:'Les tableaux "Richesses" et "Silver" du panneau admin affichent désormais le pseudo du joueur au lieu d\'un UUID tronqué illisible'},
    ], en:[
      {t:'new', tx:'New original silhouette for the Rhutum Warrior (Rhutum Camp, right after the Pirate Hideout): a massive green-skinned humanoid with a feathered crest, braided goatee and tusks — instead of the generic silhouette'},
      {t:'new', tx:'Admin "Silver" tab: new "Who earns fastest?" table — ranks players by lifetime earn rate (silver earned ÷ playtime), to see at a glance who\'s progressing fast and in how much time, not just who has the biggest total'},
      {t:'change', tx:'The admin panel\'s "Wealth" and "Silver" tables now show the player\'s pseudo instead of an unreadable truncated UUID'},
    ] },
  { v:'V118', d:'05/07/2026 01:17', name:{fr:'Record kills/min (classement + admin), tooltip inventaire', en:'Kills/min record (leaderboard + admin), inventory tooltip'}, fr:[
      {t:'new', tx:'Nouveau record personnel "🏹 Kills/min" (à vie) : visible dans un nouveau classement dédié ET dans la liste des joueurs du panneau admin. Le record ne se met à jour qu\'après 2 min de session pour éviter qu\'un petit échantillon bruité ne le fausse'},
      {t:'change', tx:'Ajout d\'une infobulle sur le bouton "🎒 Inventaire" du panneau admin, expliquant ce qu\'il ouvre (équipement + sac complet en lecture seule, dans une nouvelle fenêtre)'},
    ], en:[
      {t:'new', tx:'New personal "🏹 Kills/min" (lifetime) record: shown in a new dedicated leaderboard AND in the admin panel\'s player list. The record only updates after 2 min of session to avoid a noisy small sample skewing it'},
      {t:'change', tx:'Added a tooltip on the admin panel\'s "🎒 Inventory" button, explaining what it opens (gear + full bag, read-only, in a new window)'},
    ] },
  { v:'V117', d:'05/07/2026 01:06', name:{fr:'Refonte panneau Admin : rôles fusionnés, suivi du silver', en:'Admin panel refresh: merged roles, silver tracking'}, fr:[
      {t:'fix', tx:'Corrigé le rendu disgracieux du bouton "↩️ Racheter" superposé sur "Vendre" (bordures qui se chevauchaient) : le groupe entier porte maintenant une seule bordure/dégradé, les 2 boutons à l\'intérieur sont transparents avec un simple séparateur'},
      {t:'change', tx:'Section admin "Rembourser un clic Vendre mat" retirée : "Vendre mat." est verrouillé 🔒 (pas encore en jeu), ce bouton n\'avait donc plus lieu d\'être'},
      {t:'change', tx:'Les sections "Modérateurs" et "Testeurs" du panneau admin sont fusionnées en une seule section "Rôles" : un seul champ UUID + un menu déroulant pour choisir le rôle, une seule liste combinée (un joueur peut cumuler les deux rôles)'},
      {t:'new', tx:'Nouvel onglet "🏦 Silver" dans le panneau admin, sur le même principe que l\'onglet Loyalties : voir d\'un coup d\'œil le silver stocké chez les joueurs, le total gagné à vie, et le total dépensé (sorti du jeu via l\'optimisation), avec une barre de répartition visuelle'},
      {t:'change', tx:'Petit rafraîchissement visuel du panneau admin : cartes de section avec ombre légère et survol, + une légende de code couleur (bleu/rouge/vert) affichée en haut pour comprendre le niveau de risque de chaque section d\'un coup d\'œil'},
    ], en:[
      {t:'fix', tx:'Fixed the ugly rendering of the "↩️ Buy back" button overlapping "Sell" (overlapping borders): the whole group now carries a single border/gradient, with the 2 inner buttons transparent and a simple divider'},
      {t:'change', tx:'Removed the admin "Refund a Sell mats click" section: "Sell mats" is locked 🔒 (not in game yet), so this button no longer served a purpose'},
      {t:'change', tx:'The admin panel\'s "Moderators" and "Testers" sections are now merged into one "Roles" section: a single UUID field + a role dropdown, one combined list (a player can hold both roles)'},
      {t:'new', tx:'New "🏦 Silver" tab in the admin panel, on the same principle as the Loyalties tab: see at a glance the silver stored with players, total lifetime earned, and total spent (sunk via enhancement), with a visual breakdown bar'},
      {t:'change', tx:'Small visual refresh of the admin panel: section cards now have a light shadow and hover effect, plus a color-code legend (blue/red/green) shown at the top to understand each section\'s risk level at a glance'},
    ] },
  { v:'V116', d:'05/07/2026 00:52', name:{fr:'Inventaire admin complet, boutons 50/50', en:'Full admin inventory, 50/50 buttons'}, fr:[
      {t:'fix', tx:'La fenêtre popup "Inventaire" du panneau admin n\'affichait qu\'une grille brute — elle montre maintenant l\'équipement porté (comme le paperdoll normal) ET les 5 onglets de catégorie (Normal/Optimisation/Consommable/RNG/Trésors), comme dans l\'inventaire du joueur'},
      {t:'change', tx:'Boutons "Équiper meilleur" / "Vendre" : répartition stricte 50%/50% au lieu de 66%/34%. Le bouton "↩️ Racheter" n\'est plus un 3e bouton séparé : il se superpose désormais sur le coin droit de "Vendre" (15% de sa largeur) pour bien montrer qu\'il annule sa dernière action. Les 3 boutons ont chacun une infobulle expliquant leur fonctionnement au survol'},
    ], en:[
      {t:'fix', tx:'The admin panel\'s "Inventory" popup window only showed a raw grid — it now also shows the equipped gear (like the normal paperdoll) AND the 5 category tabs (Normal/Enhancement/Consumable/RNG/Treasures), matching the player\'s own inventory view'},
      {t:'change', tx:'"Equip best" / "Sell" buttons: strict 50%/50% split instead of 66%/34%. The "↩️ Buy back" button is no longer a separate 3rd button: it now overlaps the right edge of "Sell" (15% of its width) to make clear it undoes that specific action. All 3 buttons now have a hover tooltip explaining what they do'},
    ] },
  { v:'V115', d:'05/07/2026 00:38', name:{fr:'Silhouette originale du Pirate (Repaire des Pirates)', en:'Original Pirate silhouette (Pirate Hideout)'}, fr:[
      {t:'new', tx:'Nouvelle silhouette originale pour le Pirate (Repaire des Pirates, juste après Ruines de Protty) : humanoïde barbu au bandana rouge, torse entrouvert, lame à la main qui s\'étend lors de l\'attaque — au lieu de la silhouette générique partagée par les autres zones'},
    ], en:[
      {t:'new', tx:'New original silhouette for the Pirate (Pirate Hideout, right after Protty Ruins): a bearded humanoid with a red bandana, open vest, and a blade that extends on attack — instead of the generic silhouette shared by other zones'},
    ] },
  { v:'V114', d:'05/07/2026 00:29', name:{fr:'Vrai correctif Velia, silhouette des Esprits de Protty', en:'Real Velia fix, Protty Spirit silhouette'}, fr:[
      {t:'fix', tx:'Trouvé la vraie cause des monstres qui revenaient dans Velia (zone paisible) : la boucle de jeu re-générait des packs dès que leur nombre passait sous 6, SANS vérifier qu\'on était à Velia — ça remplissait la zone en boucle juste après le "aucun monstre" du chargement. Corrigé : à Velia, le joueur reste maintenant immobile et rien ne se passe, comme prévu'},
      {t:'new', tx:'Nouvelle silhouette originale pour l\'Esprit de Protty (Ruines de Protty) : créature flottante façon mollusque/poisson fantomatique (dôme, frange de nageoires ondulantes), au lieu de la silhouette générique partagée par toutes les zones'},
    ], en:[
      {t:'fix', tx:'Found the real cause of monsters reappearing in Velia (peaceful zone): the game loop kept respawning packs whenever their count dropped below 6, WITHOUT checking if we were in Velia — it kept refilling the zone right after the "no monsters" load. Fixed: in Velia the player now stays still and nothing happens, as intended'},
      {t:'new', tx:'New original silhouette for the Protty Spirit (Protty Ruins): a floating ghostly mollusk/fish-like creature (dome, wavy fin fringe), instead of the generic silhouette shared by all zones'},
    ] },
  { v:'V113', d:'05/07/2026 00:23', name:{fr:'Boutons inventaire raccourcis (robuste à toute largeur)', en:'Shortened inventory buttons (robust at any width)'}, fr:[
      {t:'fix', tx:'"Équiper le meilleur (socle)" et "Vendre l\'inférieur" se tronquaient encore en pleine largeur de fenêtre plus étroite ("soc e", "Ven...") — raccourcis en "Équiper meilleur" et "Vendre", le sens complet reste visible au survol'},
    ], en:[
      {t:'fix', tx:'"Equip best (base stats)" and "Sell the worse" still got cut off on narrower windows ("bas...", "Sel...") — shortened to "Equip best" and "Sell worse", full meaning still shown on hover'},
    ] },
  { v:'V112', d:'05/07/2026 00:18', name:{fr:'Correctifs : reset des Loyalties, bouton tronqué', en:'Fixes: Loyalties reset, truncated button'}, fr:[
      {t:'fix', tx:'Corrigé : les Loyalties n\'étaient jamais vraiment remises à 0 après un reset — le rafraîchissement de l\'affichage juste après regrantait aussitôt les 200 du jour, masquant la remise à zéro réelle'},
      {t:'fix', tx:'Le bouton "Vendre l\'inférieur" s\'affichait tronqué ("Ven...") — élargi pour afficher le texte en entier'},
    ], en:[
      {t:'fix', tx:'Fixed: Loyalties were never actually reset to 0 after a reset — the display refresh right after immediately re-granted the day\'s 200, masking the real reset'},
      {t:'fix', tx:'The "Sell the worse" button displayed truncated ("Sel...") — widened to show the full text'},
    ] },
  { v:'V111', d:'04/07/2026 23:47', name:{fr:'Marché Central façon BDO, chat par jour, Loyalties', en:'BDO-style Central Market, daily chat, Loyalties'}, fr:[
      {t:'new',    tx:'Marché commun repensé façon Marché Central de BDO (inspiré d\'une référence fournie) : solde bien visible, arbre de catégories (Arme principale/secondaire/éveil, Armure, Accessoires, Artéfact/Pierre, Matériaux), objets groupés par nom avec tiroir détaillé par niveau d\'enchantement (+13/+14/.../PRI/DUO...)'},
      {t:'new',    tx:'Chat : chaque jour est séparé par une barre dorée ; les jours précédents sont repliés par défaut (dépliables en un clic pour relire), seul le jour en cours reste toujours ouvert'},
      {t:'change',  tx:'Les notifications affichent maintenant toujours la date complète, pas seulement l\'heure'},
      {t:'change',  tx:'Renommé "Points de fidélité" en "Loyalties" (déjà stackables chaque jour et récupérables à tout moment, 200/jour, dans le Courrier)'},
      {t:'new',    tx:'Nouvel onglet "🏅 Loyalties" dans le panneau admin : total en jeu, moyenne par joueur (pas encore de boutique où les dépenser)'},
    ], en:[
      {t:'new',    tx:'Common market redesigned in the style of BDO\'s Central Market (inspired by a provided reference): balance clearly visible, category tree (Main/Secondary/Awakening weapon, Armor, Accessories, Artifact/Stone, Materials), items grouped by name with a detailed drawer per enhancement level (+13/+14/.../PRI/DUO...)'},
      {t:'new',    tx:'Chat: each day is separated by a golden bar; previous days are collapsed by default (expandable with one click to reread), only the current day stays always open'},
      {t:'change',  tx:'Notifications now always show the full date, not just the time'},
      {t:'change',  tx:'Renamed "Loyalty Points" to "Loyalties" (already stackable daily and claimable anytime, 200/day, in the Mailbox)'},
      {t:'new',    tx:'New "🏅 Loyalties" tab in the admin panel: total in game, average per player (no shop to spend it on yet)'},
    ] },
  { v:'V110', d:'04/07/2026 23:14', name:{fr:'Audit anti-triche & notifications refaites', en:'Anti-cheat audit & reworked notifications'}, fr:[
      {t:'fix',     tx:'Corrigé un "NaN%" possible sur la barre de vie du boss (division par zéro si les PV max valent 0, ex: juste après un despawn)'},
      {t:'exploit', tx:'Faille trouvée en audit : sur le marché, un vendeur pouvait mettre en vente un objet sans valeur en étiquetant l\'annonce comme un objet précieux (arnaque à l\'appât) — le nom/type de l\'annonce est désormais TOUJOURS recalculé depuis l\'objet réellement en vente, jamais depuis ce que le client prétend'},
      {t:'change',  tx:'Centre de notifications entièrement refait : regroupé en 3 sections claires (⚠️ Important, 🏆 Réussites, 📰 Activité) avec un code couleur par catégorie, au lieu d\'une simple liste plate'},
    ], en:[
      {t:'fix',     tx:'Fixed a possible "NaN%" on the boss HP bar (division by zero if max HP is 0, e.g. right after a despawn)'},
      {t:'exploit', tx:'Flaw found in audit: on the market, a seller could list a worthless item while labeling it as a valuable one (bait-and-switch scam) — the listing\'s name/type is now ALWAYS recalculated from the item actually being sold, never from what the client claims'},
      {t:'change',  tx:'Notification center fully reworked: grouped into 3 clear sections (⚠️ Important, 🏆 Achievements, 📰 Activity) with a color code per category, instead of a flat list'},
    ] },
  { v:'V109', d:'04/07/2026 17:00', name:{fr:'Marché en vitrine & correctif zones de farm', en:'Marketplace browse view & farm zones fix'}, fr:[
      {t:'new',    tx:'Marché commun repensé en vitrine (inspirée d\'une référence fournie) : parcours les objets en vente sous forme de cartes (icône, vendeur, temps, prix), avec filtre par catégorie, recherche, tri, et un panneau de détail complet avec comparaison face à ton équipement actuel'},
      {t:'new',    tx:'Achat en un clic depuis la vitrine : pose automatiquement un ordre d\'achat au prix exact de l\'annonce (exécution immédiate garantie)'},
      {t:'fix',    tx:'La liste des zones de farm laissait un grand vide en bas de sa carte (la grille étire toutes les cartes d\'une rangée à la même hauteur) — la liste remplit maintenant tout l\'espace disponible, de haut en bas'},
    ], en:[
      {t:'new',    tx:'Common market redesigned as a browsable storefront (inspired by a provided reference): browse listings as cards (icon, seller, time, price), with category filter, search, sort, and a full detail panel comparing against your currently equipped gear'},
      {t:'new',    tx:'One-click buy from the storefront: automatically places a buy order at the listing\'s exact price (guaranteed instant execution)'},
      {t:'fix',    tx:'The farm zone list left a large empty gap at the bottom of its card (the grid stretches every card in a row to the same height) — the list now fills all available space, top to bottom'},
    ] },
  { v:'V108', d:'04/07/2026 16:49', name:{fr:'Nouveaux emplacements, icônes teintées par palier', en:'New slots, tier-tinted icons'}, fr:[
      {t:'new',    tx:'Atelier royal ajouté dans le header (verrouillé, bientôt disponible)'},
      {t:'new',    tx:'3 nouveaux emplacements d\'équipement : 2 Artéfacts (ex: Vell, Khan) + 1 Pierre — pas encore de source de drop en jeu, prêts pour une future mise à jour'},
      {t:'change', tx:'Bouton "↩️ Racheter" réduit à une icône compacte, regroupé juste à côté de "Vendre l\'inférieur" (1/5 de la largeur) au lieu d\'un gros bouton séparé'},
      {t:'change', tx:'Nouvelles icônes pour l\'armure, les gants et les bottes : chaque pièce prend maintenant la vraie couleur de son palier (gris/blanc/vert/bleu) au lieu d\'une couleur fixe'},
      {t:'change', tx:'Nouvelles icônes de bijoux progressives selon le palier : anneau nu (gris/blanc) → un diamant (vert) → plusieurs diamants et couleur du palier (bleu)'},
    ], en:[
      {t:'new',    tx:'Royal Workshop added to the header (locked, coming soon)'},
      {t:'new',    tx:'3 new equipment slots: 2 Artifacts (e.g. Vell, Khan) + 1 Stone — no drop source yet, ready for a future update'},
      {t:'change', tx:'"↩️ Buy back" button shrunk to a compact icon, grouped right next to "Sell the worse" (1/5 of the width) instead of a big separate button'},
      {t:'change', tx:'New icons for armor, gloves and boots: each piece now takes the real color of its tier (grey/white/green/blue) instead of a fixed color'},
      {t:'change', tx:'New progressive jewelry icons by tier: bare ring (grey/white) → one diamond (green) → several diamonds and tier color (blue)'},
    ] },
  { v:'V107', d:'04/07/2026 16:38', name:{fr:'Économie retravaillée & vrai marché à ordres', en:'Reworked economy & real order-book market'}, fr:[
      {t:'change', tx:'Économie de Velia entièrement retravaillée : le silver/h moyen progresse maintenant de ~3 000/h (zone 1) à 100 000/h max (zone 11, stuff optimisé) au lieu de plusieurs millions/h — ce plafond correspond au bas de la nouvelle courbe à 5 régions (Velia 0-100k/h, Heidel 100k-1M/h, Calpheon 1M-100M/h, Valencia 100M-1B/h, Edana 1B-10B/h, voir zones-roadmap.md)'},
      {t:'new',    tx:'Marché commun entièrement refait : vrai carnet d\'ordres entre joueurs (achat ET vente), au lieu d\'un prix flottant avec achat/vente instantanés. Chacun pose le prix qu\'il veut ; ton silver (achat) ou ton objet (vente) reste bloqué tant que l\'ordre n\'est pas exécuté ou annulé'},
      {t:'new',    tx:'L\'exécution est automatique dès qu\'un ordre d\'achat et un ordre de vente compatibles existent (prix d\'achat ≥ prix de vente) ; en cas d\'égalité de prix entre plusieurs ordres, un tirage au sort désigne qui est servi'},
      {t:'new',    tx:'Le marché commun accepte maintenant aussi l\'équipement et les bijoux trouvés en jeu (pas seulement les matériaux), regroupés par nom + niveau d\'enchantement'},
      {t:'new',    tx:'Nouvel onglet "Mes ordres" dans le marché commun pour suivre et annuler ses ordres en cours'},
    ], en:[
      {t:'change', tx:'Velia\'s economy fully reworked: average silver/h now progresses from ~3,000/h (zone 1) to 100,000/h max (zone 11, optimized gear) instead of several million/h — this cap matches the bottom of the new 5-region curve (Velia 0-100k/h, Heidel 100k-1M/h, Calpheon 1M-100M/h, Valencia 100M-1B/h, Edana 1B-10B/h, see zones-roadmap.md)'},
      {t:'new',    tx:'Common market fully rebuilt: a real order book between players (buy AND sell), instead of a floating price with instant buy/sell. Everyone sets their own price; your silver (buy) or item (sell) stays locked until the order is filled or cancelled'},
      {t:'new',    tx:'Execution is automatic as soon as a compatible buy and sell order exist (buy price ≥ sell price); tied prices are settled by a random draw'},
      {t:'new',    tx:'The common market now also accepts gear and jewelry found in-game (not just materials), grouped by name + enhancement level'},
      {t:'new',    tx:'New "My orders" tab in the common market to track and cancel your open orders'},
    ] },
  { v:'V106', d:'04/07/2026 16:08', name:{fr:'Loot ticker, reset admin réparé, couleurs du stuff', en:'Loot ticker, fixed admin reset, gear colors'}, fr:[
      {t:'fix', tx:'Corrigé le sens d\'arrivée du loot ticker : les nouvelles entrées apparaissaient en haut (déjà estompées) et les anciennes en bas (bien visibles juste avant d\'être supprimées) — l\'inverse de l\'effet voulu, désormais les nouvelles entrées arrivent nettes en bas et remontent en s\'estompant'},
      {t:'fix', tx:'Trouvé pourquoi "Réinitialiser TOUS les comptes" ne fonctionnait pas : Supabase bloque les UPDATE/DELETE sans clause WHERE (confirmé dans les logs), même pour un reset global volontaire — corrigé'},
      {t:'fix', tx:'Le stuff (équipement ET matériaux d\'optimisation) se ressemblait dans le sac quel que soit son palier : les icônes SVG ont leurs couleurs figées dans le tracé, le style posé par-dessus n\'avait donc aucun effet. Corrigé en teintant la bordure de chaque case avec la vraie couleur du palier (gris/blanc/vert/bleu) ou du matériau'},
    ], en:[
      {t:'fix', tx:'Fixed the loot ticker\'s arrival direction: new entries appeared at the top (already faded) and old ones at the bottom (fully visible right before removal) — the opposite of the intended effect; new entries now arrive crisp at the bottom and fade as they move up'},
      {t:'fix', tx:'Found why "Reset ALL accounts" didn\'t work: Supabase blocks UPDATE/DELETE without a WHERE clause (confirmed in the logs), even for an intentional global reset — fixed'},
      {t:'fix', tx:'Gear and enhancement materials all looked alike in the bag regardless of tier: SVG icons have their colors baked into the artwork, so the color style layered on top had no effect. Fixed by tinting each cell\'s border with the real tier color (grey/white/green/blue) or material color'},
    ] },
  { v:'V105', d:'04/07/2026 15:55', name:{fr:'Bijoux alignés sur les vrais paliers BDO', en:'Jewelry aligned with real BDO tiers'}, fr:[
      {t:'change', tx:'Les bijoux rares (jackpot) des 11 zones de Velia utilisent maintenant les vrais noms BDO alignés sur le palier de stuff de la zone : Naru (gris), Tuvala (blanc), Asula (vert), Cadry/Serap (bleu) — un anneau, un collier et une ceinture par palier'},
    ], en:[
      {t:'change', tx:'Rare jewelry (jackpot) drops across the 11 Velia zones now use real BDO names matching the zone\'s gear tier: Naru (grey), Tuvala (white), Asula (green), Cadry/Serap (blue) — one ring, one necklace and one belt per tier'},
    ] },
  { v:'V104', d:'04/07/2026 15:19', name:{fr:'Reset complet des comptes & annonce dédiée', en:'Full account reset & dedicated announcement'}, fr:[
      {t:'new',    tx:'Nouveau bouton admin "💥 Réinitialiser TOUS les comptes" : efface silver/équipement/niveau/sac de tout le monde, et affiche une bannière colorée d\'explication (+ une entrée dans les notifications) à chaque joueur à sa prochaine connexion'},
      {t:'change', tx:'Le centre de notifications ne garde plus que les infos importantes (succès, boss vaincu, niveau supérieur) — les trouvailles de loot (bijoux/équipement rares) restent visibles dans le loot ticker mais ne polluent plus plus les notifications'},
    ], en:[
      {t:'new',    tx:'New admin button "💥 Reset ALL accounts": wipes silver/gear/level/bag for everyone, and shows a colorful explanation banner (+ a notification entry) to each player on their next login'},
      {t:'change', tx:'The notification center now only keeps important info (achievements, boss defeated, level up) — rare loot finds (jewelry/gear) stay visible in the loot ticker but no longer clutter notifications'},
    ] },
  { v:'V103', d:'04/07/2026 15:08', name:{fr:'Panneau admin bien plus rapide à l\'ouverture', en:'Admin panel opens much faster'}, fr:[
      {t:'fix', tx:'Trouvé la cause de la lenteur au clic sur "Zone Admin" : une vue serveur ("Ressources farmées") scannait TOUTE la table des ramassages (79 000+ lignes et ça grandit à chaque objet ramassé par tous les joueurs, depuis le début) sans aucune limite de temps — corrigée pour se limiter aux 30 derniers jours'},
      {t:'change', tx:'Le panneau admin s\'ouvre maintenant dès que la liste des joueurs est prête, sans attendre les 3 statistiques les plus lourdes (silver/heure, ressources farmées, richesses) qui se chargent maintenant en arrière-plan et remplissent leur onglet dès qu\'elles sont prêtes'},
    ], en:[
      {t:'fix', tx:'Found the cause of the "Admin Zone" click being slow: a server view ("Farmed resources") scanned the ENTIRE pickup log table (79,000+ rows and growing with every item picked up by every player, since the start) with no time limit at all — fixed to only look at the last 30 days'},
      {t:'change', tx:'The admin panel now opens as soon as the player list is ready, without waiting for the 3 heaviest stats (silver/hour, farmed resources, wealth) which now load in the background and fill in their tab once ready'},
    ] },
  { v:'V102', d:'04/07/2026 15:00', name:{fr:'Difficulté retravaillée, bouton "Racheter"', en:'Reworked difficulty, "Buy back" button'}, fr:[
      {t:'change', tx:'Difficulté de toute la région de Velia retravaillée : PA requis plafonné à 209 (au lieu de 400) sur la dernière zone, avec un saut plus marqué à chaque transition de palier de stuff (gris→blanc, blanc→vert, vert→bleu) — il faut être un minimum optimisé sur le palier précédent avant d\'attaquer le suivant'},
      {t:'new',    tx:'Bouton "↩️ Racheter" à côté de "Vendre l\'inférieur" : annule la dernière vente automatique (restaure les objets et le silver) en cas de clic accidentel'},
    ], en:[
      {t:'change', tx:'Reworked the difficulty of the whole Velia region: required AP capped at 209 (down from 400) on the last zone, with a sharper jump at every gear-tier transition (grey→white, white→green, green→blue) — you need to be at least somewhat enhanced on the previous tier before tackling the next one'},
      {t:'new',    tx:'"↩️ Buy back" button next to "Sell the worse": undoes the last automatic sale (restores items and silver) after an accidental click'},
    ] },
  { v:'V101', d:'04/07/2026 12:41', name:{fr:'Boss partagé enfin réparé, panneau admin retravaillé', en:'Shared boss finally fixed, reworked admin panel'}, fr:[
      {t:'fix',    tx:'Trouvé et corrigé LE bug qui empêchait le boss mondial d\'être partagé depuis le début : une erreur SQL silencieuse ("column reference ambiguous") faisait échouer chaque tentative d\'infliger des dégâts au boss partagé — les PV n\'ont donc jamais bougé, le classement de contribution est resté vide, confirmé par test réel et reproduction isolée du bug'},
      {t:'new',    tx:'Bouton admin pour faire disparaître le World Boss pour tout le monde à tout moment'},
      {t:'change', tx:'Un World Boss disparaît désormais au bout de 9 minutes (au lieu de 15)'},
      {t:'change', tx:'Onglet Joueurs (panneau admin) : 2 boutons dédiés "UUID" et "Inventaire" au lieu du clic-sur-la-ligne ; l\'inventaire s\'ouvre maintenant dans une vraie fenêtre séparée et revient sur le panneau admin à sa fermeture'},
      {t:'change', tx:'Panneau admin retravaillé : bordure colorée par niveau de risque (bleu = sans danger sur ton compte, rouge = touche tous les joueurs, vert = gestion staff) + description sous chaque section'},
      {t:'change', tx:'Le palier Grunil (bleu) a maintenant son propre matériau "Pierre concentrée" — la Pierre Noire est désormais réservée au palier Yuria (vert)'},
    ], en:[
      {t:'fix',    tx:'Found and fixed THE bug that had prevented the world boss from ever being shared: a silent SQL error ("column reference ambiguous") made every attempt to damage the shared boss fail — HP never moved, the contribution leaderboard stayed empty, confirmed via real testing and an isolated bug reproduction'},
      {t:'new',    tx:'Admin button to despawn the World Boss for everyone at any time'},
      {t:'change', tx:'A World Boss now despawns after 9 minutes (instead of 15)'},
      {t:'change', tx:'Players tab (admin panel): 2 dedicated buttons "UUID" and "Inventory" instead of click-the-row; inventory now opens in a real separate window and returns to the admin panel when closed'},
      {t:'change', tx:'Reworked admin panel: color-coded border by risk level (blue = safe on your own account, red = affects all players, green = staff management) + a short description under each section'},
      {t:'change', tx:'The Grunil (blue) tier now has its own "Concentrated Stone" material — Black Stone is now reserved for the Yuria (green) tier'},
    ] },
  { v:'V100', d:'04/07/2026 12:22', name:{fr:'Corrections, sécurité & classement Trésors', en:'Fixes, security & Treasure leaderboard'}, fr:[
      {t:'fix',     tx:'Corrigé le faux positif anti-triche "silver_per_hour astronomique" juste après le chargement d\'une sauvegarde (le calcul utilisait un compteur à vie divisé par un temps de session erroné)'},
      {t:'fix',     tx:'Les chances du Trésor de Velia étaient 100× trop généreuses (0.01 interprété comme 1% au lieu de 0.01%) — corrigées'},
      {t:'exploit', tx:'Corrigé 2 failles XSS trouvées en audit : le pseudo affiché dans le Classement et dans la liste de filleuls n\'était pas échappé (un pseudo malveillant pouvait exécuter du code chez les autres joueurs qui le consultaient)'},
      {t:'new',     tx:'Nouveau classement "🗺️ Trésors" (nombre de morceaux du Trésor de Velia ramassés à vie)'},
      {t:'new',     tx:'2 nouveaux succès "Chercheur/Chasseur de trésor"'},
      {t:'new',     tx:'Panneau admin : estimation du nombre moyen de monstres à tuer (et du temps) pour chaque morceau du Trésor de Velia'},
      {t:'change',  tx:'Wiki, codex et succès mis à jour pour refléter le Trésor de Velia, les zones groupées par palier et le boss Kzarka partagé'},
    ], en:[
      {t:'fix',     tx:'Fixed the "astronomical silver_per_hour" anti-cheat false positive right after loading a save (the calculation used a lifetime counter divided by a broken session time)'},
      {t:'fix',     tx:'Velia Treasure chances were 100× too generous (0.01 read as 1% instead of 0.01%) — corrected'},
      {t:'exploit', tx:'Fixed 2 XSS flaws found in an audit: the displayed pseudo in the Leaderboard and referral list wasn\'t escaped (a malicious pseudo could run code for other players viewing it)'},
      {t:'new',     tx:'New "🗺️ Treasures" leaderboard (lifetime Velia Treasure pieces collected)'},
      {t:'new',     tx:'2 new "Treasure seeker/hunter" achievements'},
      {t:'new',     tx:'Admin panel: average number of monsters to kill (and time) for each Velia Treasure piece'},
      {t:'change',  tx:'Wiki, codex and achievements updated to reflect the Velia Treasure, tier-grouped zones and the shared Kzarka boss'},
    ] },
  { v:'V99', d:'04/07/2026 12:04', name:{fr:'Nouvel inventaire "Trésors"', en:'New "Treasures" inventory'}, fr:[
      {t:'new', tx:'Nouvel onglet d\'inventaire dédié "🗺️ Trésors" pour ranger les objets du Trésor de Velia séparément du reste'},
    ], en:[
      {t:'new', tx:'New dedicated "🗺️ Treasures" inventory tab to store Velia Treasure items separately from the rest'},
    ] },
  { v:'V98', d:'04/07/2026 12:03', name:{fr:'Trésor de Velia (catégorie TEST)', en:'Velia Treasure (TEST category)'}, fr:[
      {t:'new', tx:'Toutes les zones de Velia peuvent désormais looter le "Trésor de Velia" : 5 objets collectibles (Bout du trésor de Velia 1 ×2 chances, Trésor de Velia 1/2/3), identiques dans toutes les zones'},
      {t:'new', tx:'Nouvelle catégorie "🧪 TEST" en bas de la table de loot de chaque zone pour ces objets expérimentaux (pas encore de recette/usage)'},
    ], en:[
      {t:'new', tx:'All Velia zones can now loot the "Velia Treasure": 5 collectible items (Velia Treasure Piece 1 ×2 chances, Velia Treasure 1/2/3), identical across every zone'},
      {t:'new', tx:'New "🧪 TEST" category at the bottom of each zone\'s loot table for these experimental items (no recipe/use yet)'},
    ] },
  { v:'V97', d:'04/07/2026 11:52', name:{fr:'Zones groupées par palier, boss Kzarka vraiment partagé', en:'Zones grouped by tier, truly shared Kzarka boss'}, fr:[
      {t:'new', tx:'La liste des zones de Velia est désormais groupée par palier de stuff (Naru/Tuvala/Yuria/Grunil), avec un en-tête coloré par groupe'},
      {t:'change', tx:'Dans la table de loot, les lignes "armure" et "matériau" reprennent la couleur du stuff correspondant dans l\'inventaire (gris/blanc/vert/bleu) au lieu d\'une couleur générique'},
      {t:'fix', tx:'Le Kzarka du planning horaire (pas seulement celui lancé par l\'admin) a maintenant des PV réellement partagés entre tous les joueurs, et tout le monde se voit dans l\'arène'},
    ], en:[
      {t:'new', tx:'The Velia zone list is now grouped by gear tier (Naru/Tuvala/Yuria/Grunil), with a colored header per group'},
      {t:'change', tx:'In the loot table, "armor" and "material" rows now use the matching gear color from the inventory (grey/white/green/blue) instead of a generic color'},
      {t:'fix', tx:'The scheduled Kzarka boss (not just the admin-spawned one) now has truly shared HP across all players, and everyone is visible in the arena'},
    ] },
  { v:'V96', d:'04/07/2026 11:44', name:{fr:'Village de Velia & pierres d\'optimisation en SVG', en:'Velia village & SVG optimization stones'}, fr:[
      {t:'new', tx:'Velia a désormais son propre décor de village paisible (maisons, puits, lampadaires, teinte chaleureuse) au lieu de réutiliser le terrain de la dernière zone de combat farmée'},
      {t:'new', tx:'Nouvelles icônes SVG originales (style pierre à facettes) pour les pierres d\'optimisation : Pierre de Novice, Pierre du Temps, Pierre Noire et Pierre de Caphras'},
    ], en:[
      {t:'new', tx:'Velia now has its own peaceful village scenery (houses, well, lamp posts, warm tint) instead of reusing the last farmed combat zone\'s terrain'},
      {t:'new', tx:'New original SVG icons (faceted stone style) for the optimization materials: Novice Stone, Time Stone, Black Stone and Caphras Stone'},
    ] },
  { v:'V95', d:'04/07/2026 10:56', name:{fr:'Menu repliable, mot de passe oublié, langue à la connexion', en:'Collapsible menu, forgot password, language at login'}, fr:[
      {t:'new', tx:'Bouton pour replier/déplier le menu latéral (état mémorisé)'},
      {t:'new', tx:'Bouton "Mot de passe oublié ?" sur l\'écran de connexion (envoie un email de réinitialisation)'},
      {t:'new', tx:'Choix de la langue (FR/EN) directement sur l\'écran de connexion/création de compte'},
    ], en:[
      {t:'new', tx:'Button to collapse/expand the side menu (state remembered)'},
      {t:'new', tx:'"Forgot password?" button on the login screen (sends a reset email)'},
      {t:'new', tx:'Language choice (FR/EN) directly on the login/signup screen'},
    ] },
  { v:'V94', d:'04/07/2026 10:45', name:{fr:'Vraies zones de Velia (11 zones remplacent les anciennes)', en:'Real Velia zones (11 zones replace the old ones)'}, fr:[
      {t:'change', tx:'Les 12 anciennes zones fictives sont remplacées par les 11 vraies zones de Velia : Camp des Loups, Ruines de Protty, Repaire des Pirates, Camp Rhutum, Ferme Shultz, Colonie Sausan, Mine de Fer Abandonnée, Poste Helm, Repaire Bandits Gahaz, Sanctuaire Elric, Ruines de Kratuga'},
      {t:'change', tx:'Progression PA/PD/loot inchangée (juste les noms de zones et de monstres qui changent) ; le palier Grunil couvre désormais 2 zones au lieu de 3 (11 zones au total)'},
    ], en:[
      {t:'change', tx:'The 12 old fictional zones are replaced by the 11 real Velia zones: Wolf Camp, Protty Ruins, Pirate Den, Rhutum Camp, Shultz Farm, Sausan Colony, Abandoned Iron Mine, Helm Post, Gahaz Bandit Lair, Elric Shrine, Kratuga Ruins'},
      {t:'change', tx:'AP/DP/loot progression unchanged (only zone and monster names change); the Grunil tier now covers 2 zones instead of 3 (11 zones total)'},
    ] },
  { v:'V93', d:'04/07/2026 10:39', name:{fr:'Onglets de région : juste le nom + pastille de couleur', en:'Region tabs: name only + color dot'}, fr:[
      {t:'change', tx:'Les onglets affichent juste le nom de la région (Velia/Heidel/Capheon/Valencia/Edana) sans préfixe Early/Mid/End, avec une pastille de couleur : vert, bleu, jaune, orange, rouge'},
    ], en:[
      {t:'change', tx:'Tabs now show just the region name (Velia/Heidel/Capheon/Valencia/Edana) without the Early/Mid/End prefix, with a color dot: green, blue, yellow, orange, red'},
    ] },
  { v:'V92', d:'04/07/2026 10:36', name:{fr:'5 régions planifiées : Velia/Heidel/Capheon/Valencia/Edana', en:'5 regions planned: Velia/Heidel/Capheon/Valencia/Edana'}, fr:[
      {t:'change', tx:'Les onglets de zones passent de 3 à 5 paliers : Early (Velia, en jeu), Mid (Heidel), End (Capheon), End+ (Valencia), End++ (Edana) — les 4 derniers restent verrouillés 🔒 en attendant leur construction'},
    ], en:[
      {t:'change', tx:'Zone tabs go from 3 to 5 tiers: Early (Velia, live), Mid (Heidel), End (Capheon), End+ (Valencia), End++ (Edana) — the last 4 remain locked 🔒 pending construction'},
    ] },
  { v:'V91', d:'04/07/2026 10:31', name:{fr:'Refonte du stuff Early : 4 paliers Naru/Tuvala/Yuria/Grunil + onglets Early/Mid/End', en:'Early gear overhaul: 4 tiers Naru/Tuvala/Yuria/Grunil + Early/Mid/End tabs'}, fr:[
      {t:'new', tx:'Onglets "Early / Mid / End" au-dessus de la liste des zones — Mid et End sont verrouillés 🔒 pour l\'instant, ils arriveront dans une future mise à jour'},
      {t:'new', tx:'Le stuff Early est réparti en 4 paliers (3 zones chacun) : ⬜ Naru (zones 1-3), ⬜ Tuvala (zones 4-6), 🟩 Yuria et 🟦 Grunil (zones 7-12)'},
      {t:'change', tx:'Chaque palier a désormais son propre matériau d\'optimisation (Pierre de Novice, Pierre du Temps, Pierre Noire) au lieu d\'un matériau générique par zone ; Yuria/Grunil ont une chance de drop fixe de 2% quelle que soit la zone'},
      {t:'new', tx:'Nouvelle conversion : 5 Poussière d\'esprit ancien → 1 Pierre de Caphras (bouton dans le cadre Optimisation) — la Pierre de Caphras ne se ramasse plus directement en zone'},
    ], en:[
      {t:'new', tx:'"Early / Mid / End" tabs above the zone list — Mid and End are locked 🔒 for now, coming in a future update'},
      {t:'new', tx:'Early gear is now split into 4 tiers (3 zones each): ⬜ Naru (zones 1-3), ⬜ Tuvala (zones 4-6), 🟩 Yuria and 🟦 Grunil (zones 7-12)'},
      {t:'change', tx:'Each tier now has its own enhancement material (Novice Stone, Time-worn Stone, Black Stone) instead of one generic material per zone; Yuria/Grunil have a fixed 2% drop chance regardless of zone'},
      {t:'new', tx:'New conversion: 5 Ancient Spirit Dust → 1 Caphras Stone (button in the Enhancement panel) — Caphras Stones no longer drop directly in zones'},
    ] },
  { v:'V90', d:'05/07/2026 05:00', name:{fr:'Optimisation auto, inventaire des joueurs (admin), loot ticker amélioré', en:'Auto-enhance, player inventory (admin), improved loot ticker'}, fr:[
      {t:'new', tx:'Optimisation : bouton "▶ Auto jusqu\'à" avec un palier au choix — tente automatiquement (et gère les rétrogradations) jusqu\'à atteindre ce palier ou tomber à court de matériau'},
      {t:'admin', tx:'Panneau Admin : bouton 🎒 dans l\'onglet Joueurs pour voir l\'inventaire complet (192 cases) de n\'importe quel joueur, en lecture seule'},
      {t:'change', tx:'Loot en direct : fondu des anciennes entrées plus prononcé, et les matériaux ont désormais leur propre couleur (bleu) au lieu du gris par défaut'},
    ], en:[
      {t:'new', tx:'Enhancement: "▶ Auto to" button with a chosen tier — automatically retries (handling downgrades) until reaching that tier or running out of material'},
      {t:'admin', tx:'Admin panel: 🎒 button in the Players tab to view any player\'s full inventory (192 slots), read-only'},
      {t:'change', tx:'Live loot: stronger fade on older entries, and materials now have their own color (blue) instead of the default gray'},
    ] },
  { v:'V89', d:'05/07/2026 04:00', name:{fr:'Log Discord (jeu + alertes triche)', en:'Discord logging (game + cheat alerts)'}, fr:[
      {t:'admin', tx:'Salon Discord "log général" : succès débloqués, boss vaincus, bijoux/équipement rares trouvés, et actions admin (mod/testeur, remboursement, boss global, reset quêtes, réévaluation marché) y sont désormais relayés automatiquement'},
      {t:'admin', tx:'Salon Discord "triche" séparé : alerte automatique quand l\'anti-triche serveur doit borner une valeur impossible (silver, gearscore, niveau, temps de jeu), avec le joueur et les valeurs concernées'},
    ], en:[
      {t:'admin', tx:'"General log" Discord channel: unlocked achievements, boss kills, rare gear/jewelry finds, and admin actions (mod/tester, refund, global boss, quest reset, market reevaluation) are now automatically relayed there'},
      {t:'admin', tx:'Separate "cheat" Discord channel: automatic alert when the server-side anti-cheat has to clamp an impossible value (silver, gearscore, level, playtime), with the player and the values involved'},
    ] },
  { v:'V88', d:'05/07/2026 03:00', name:{fr:'Admin : liste des joueurs + copie UUID', en:'Admin: player list + UUID copy'}, fr:[
      {t:'admin', tx:'Nouvel onglet "👥 Joueurs" dans le panneau Admin : liste de tous les joueurs inscrits avec statut en ligne, silver, GS, niveau — clique une ligne pour copier son UUID'},
      {t:'admin', tx:'Depuis le classement, le stuff d\'un joueur consulté par l\'admin propose désormais un bouton "📋 Copier UUID"'},
    ], en:[
      {t:'admin', tx:'New "👥 Players" tab in the Admin panel: list of all registered players with online status, silver, GS, level — click a row to copy its UUID'},
      {t:'admin', tx:'From the leaderboard, a player\'s gear viewed by the admin now offers a "📋 Copy UUID" button'},
    ] },
  { v:'V87', d:'05/07/2026 02:00', name:{fr:'Widget Suivi : explications sur les timers et le temps de jeu', en:'Tracker widget: timer and playtime clarifications'}, fr:[
      {t:'change', tx:'Le widget de suivi explique désormais (au survol) que "Journ." et "Hebdo" sont le temps avant la remise à zéro des quêtes, et sépare visuellement la section "Temps de jeu" (Total/Aujourd\'hui)'},
    ], en:[
      {t:'change', tx:'The tracker widget now explains (on hover) that "Daily" and "Weekly" are the time before quests reset, and visually separates the "Playtime" section (Total/Today)'},
    ] },
  { v:'V86', d:'05/07/2026 01:00', name:{fr:'Chat : halo messages non lus', en:'Chat: unread message halo'}, fr:[
      {t:'new', tx:'Halo sur l\'onglet d\'un canal de chat où un nouveau message est arrivé pendant que tu ne le regardais pas'},
      {t:'new', tx:'Halo temporaire sur les messages tout juste arrivés quand tu ouvres/regardes le canal'},
    ], en:[
      {t:'new', tx:'Halo on a chat channel tab when a new message arrives while you\'re not viewing it'},
      {t:'new', tx:'Temporary halo on messages that just arrived when you open/view the channel'},
    ] },
  { v:'V85', d:'05/07/2026 00:00', name:{fr:'Canal Annonce : rôle seul + message en rouge', en:'Announcement channel: role only + red message'}, fr:[
      {t:'change', tx:'Dans le canal Annonce, le pseudo n\'est plus affiché : seul le badge de rôle (ADMIN) apparaît, et le message est en rouge'},
    ], en:[
      {t:'change', tx:'In the Announcement channel, the pseudo is no longer shown: only the role badge (ADMIN) appears, and the message is in red'},
    ] },
  { v:'V84', d:'04/07/2026 23:00', name:{fr:'Centre de notifications, loot groupé', en:'Notification center, grouped loot'}, fr:[
      {t:'new', tx:'Nouveau bouton "🔔 Notifications" : journal des événements marquants (succès débloqués, niveaux gagnés, équipement/bijoux rares trouvés, boss vaincus)'},
      {t:'change', tx:'Le loot en direct regroupe désormais les objets identiques ramassés d\'affilée en une seule ligne "×N" au lieu de spammer une ligne par ramassage'},
    ], en:[
      {t:'new', tx:'New "🔔 Notifications" button: a log of key events (achievements unlocked, levels gained, rare gear/jewelry found, bosses defeated)'},
      {t:'change', tx:'Live loot now groups identical items picked up back-to-back into a single "×N" line instead of spamming one line per pickup'},
    ] },
  { v:'V83', d:'04/07/2026 22:00', name:{fr:'Statistiques réunies en une carte, retrait de l\'historique silver', en:'Stats merged into one card, silver history removed'}, fr:[
      {t:'change', tx:'Les stats perso et les stats de la zone de farm sont réunies dans une seule carte "Statistiques" (séparées par une ligne), au lieu de deux cartes côte à côte'},
      {t:'change', tx:'Retrait de l\'historique silver sous la table de loot pour l\'instant — une autre idée viendra à sa place plus tard'},
    ], en:[
      {t:'change', tx:'Personal stats and farming zone stats are now merged into a single "Stats" card (separated by a divider), instead of two side-by-side cards'},
      {t:'change', tx:'Removed the silver history under the loot table for now — something else will take its place later'},
    ] },
  { v:'V82', d:'04/07/2026 21:00', name:{fr:'PA/PD/GS sur la carte Équipement, icônes dans le menu d\'équipement', en:'AP/DP/GS on the Equipment card, icons in the equip menu'}, fr:[
      {t:'new', tx:'La carte Équipement affiche désormais PA/PD (en haut) et GS (au-dessus du personnage)'},
      {t:'new', tx:'Chaque pièce équipée affiche son PA (bas-gauche) et son PD (bas-droite) directement sur son icône'},
      {t:'new', tx:'Le menu d\'équipement (clic sur une pièce) affiche maintenant l\'icône de chaque objet candidat, pas juste son nom'},
    ], en:[
      {t:'new', tx:'The Equipment card now shows AP/DP (top) and GS (above the character)'},
      {t:'new', tx:'Each equipped piece shows its AP (bottom-left) and DP (bottom-right) directly on its icon'},
      {t:'new', tx:'The equip-slot menu (click a piece) now shows each candidate item\'s icon, not just its name'},
    ] },
  { v:'V81', d:'04/07/2026 20:00', name:{fr:'World Boss vraiment multijoueur, mort → Velia, loot stylisé', en:'World Boss truly multiplayer, death → Velia, styled loot'}, fr:[
      {t:'new', tx:'World Boss partagé : les autres joueurs sont maintenant VISIBLES en direct dans l\'arène (silhouette + pseudo), pas juste dans un classement textuel'},
      {t:'change', tx:'Mourir au combat renvoie désormais à Velia (zone paisible) avec un message d\'avertissement, au lieu de simplement récupérer 50% des PV sur place'},
      {t:'change', tx:'Cliquer sur "Velia" dans la liste des zones n\'ouvre plus automatiquement le tutoriel : ça t\'y emmène juste, en zone paisible sans monstre (le tutoriel reste accessible depuis le Wiki)'},
      {t:'change', tx:'Le loot en direct (bas à droite) : le rebut (trash) est maintenant blanc, un fondu estompe les entrées les plus anciennes vers le haut'},
      {t:'change', tx:'Le panneau Statistiques est scindé en deux : stats personnelles en haut, stats de la zone de farm juste en dessous'},
    ], en:[
      {t:'new', tx:'Shared World Boss: other players are now VISIBLE live in the arena (silhouette + pseudo), not just in a text leaderboard'},
      {t:'change', tx:'Dying in combat now sends you back to Velia (peaceful zone) with a warning message, instead of just recovering 50% HP on the spot'},
      {t:'change', tx:'Clicking "Velia" in the zone list no longer auto-launches the tutorial: it just takes you there, a peaceful zone with no monsters (tutorial still available from the Wiki)'},
      {t:'change', tx:'Live loot (bottom-right): trash is now white, older entries fade out toward the top'},
      {t:'change', tx:'The Stats panel is split in two: personal stats on top, farming zone stats right below'},
    ] },
  { v:'V80', d:'04/07/2026 19:00', name:{fr:'PA/PD sur les cases du sac, optimisation en un clic, footer raccourci', en:'AP/DP on bag slots, one-click enhancement, shortened footer'}, fr:[
      {t:'new', tx:'Les cases d\'équipement/bijoux du sac affichent maintenant le PA (bas-gauche) et le PD (bas-droite) directement sur l\'icône'},
      {t:'new', tx:'Le menu au clic sur un objet (sac ou équipement) propose désormais aussi "Mettre en optimisation" pour l\'armure/les bijoux, pas seulement les matériaux'},
      {t:'change', tx:'Footer raccourci : mention légale condensée + clause "fourni tel quel, sans garantie ni responsabilité, utilisation à tes risques"'},
    ], en:[
      {t:'new', tx:'Gear/jewelry slots in the bag now show AP (bottom-left) and DP (bottom-right) directly on the icon'},
      {t:'new', tx:'The click menu on an item (bag or equipped) now also offers "Load into enhancement" for armor/jewelry, not just materials'},
      {t:'change', tx:'Shortened footer: condensed legal notice + "provided as-is, no warranty or liability, use at your own risk" clause'},
    ] },
  { v:'V79', d:'04/07/2026 18:00', name:{fr:'Menu d\'équipement (5 objets), boss admin partagé, stuff des joueurs détaillé', en:'Equip-slot menu (5 items), shared admin boss, detailed player gear'}, fr:[
      {t:'new', tx:'Clic sur une pièce d\'équipement : affiche jusqu\'à 5 objets du sac équipables dans ce slot (avec le gain/perte de PA/PD/PV), en plus du bouton Déséquiper'},
      {t:'fix', tx:'Le test de boss "Pour moi" dans le panneau Admin lance maintenant un VRAI boss partagé (PV communs, top 10, contribution %, joueurs en direct) au lieu d\'un combat solo'},
      {t:'new', tx:'Le stuff d\'un joueur consulté depuis le classement affiche maintenant le nom de chaque objet et son PA/PD/PV en clair, pas seulement au survol'},
      {t:'change', tx:'Mention légale précisée : certains noms/styles de jeu/mécaniques s\'inspirent de Black Desert et restent la propriété de Pearl Abyss le cas échéant, mais les visuels de Velia Idle sont des créations originales de style fan, pas les mêmes assets'},
    ], en:[
      {t:'new', tx:'Click a gear slot: shows up to 5 bag items equippable in that slot (with AP/DP/HP gain or loss), alongside the Unequip button'},
      {t:'fix', tx:'The "For me" boss test in the Admin panel now launches a REAL shared boss (common HP, top 10, contribution %, live fighters) instead of a solo fight'},
      {t:'new', tx:'A player\'s gear viewed from the leaderboard now shows each item\'s name and AP/DP/HP as plain text, not just on hover'},
      {t:'change', tx:'Legal notice clarified: some names/game styles/mechanics are inspired by Black Desert and remain Pearl Abyss\'s property where applicable, but Velia Idle\'s visuals are original fan-style creations, not the same assets'},
    ] },
  { v:'V78', d:'04/07/2026 17:00', name:{fr:'Loot en bas à droite (15 entrées + effets), RNG/Consommable/Lifeskill verrouillés', en:'Bottom-right loot (15 entries + effects), locked RNG/Consumable/Lifeskill'}, fr:[
      {t:'change', tx:'Le butin en direct (loot ticker) passe en bas à droite du jeu (à la place de l\'ancien GS/Niveau, déjà visibles dans le panneau Statistiques et l\'inventaire) : il affiche maintenant 15 entrées, les nouvelles apparaissent en bas et poussent les anciennes vers le haut'},
      {t:'new', tx:'Effet visuel (flash + lueur pulsante) sur les entrées de butin rare et jackpot dans le loot ticker'},
      {t:'change', tx:'Les onglets d\'inventaire "Consommable" et "RNG" sont verrouillés 🔒 (contenu prévu pour une future mise à jour)'},
      {t:'change', tx:'Le bouton lifeskill (⛏️) est verrouillé 🔒 mais reste visible pour rappeler qu\'un futur système de lifeskill est prévu'},
    ], en:[
      {t:'change', tx:'The live loot ticker moves to the bottom-right of the game (replacing the old GS/Level display, already visible in the Stats panel and inventory): it now shows 15 entries, new ones appear at the bottom and push older ones up'},
      {t:'new', tx:'Visual effect (flash + pulsing glow) on rare and jackpot loot entries in the ticker'},
      {t:'change', tx:'The "Consumable" and "RNG" inventory tabs are locked 🔒 (content planned for a future update)'},
      {t:'change', tx:'The lifeskill button (⛏️) is locked 🔒 but stays visible as a reminder that a future lifeskill system is planned'},
    ] },
  { v:'V77', d:'04/07/2026 16:00', name:{fr:'Bannière en développement, stats sur le stuff, voir le stuff des autres', en:'In-development banner, gear stats, view others\' gear'}, fr:[
      {t:'fix', tx:'Chat : les messages d\'annonce sans pseudo affichaient "null" au lieu d\'un nom — corrigé avec un repli propre'},
      {t:'new', tx:'Bannière "🚧 Jeu en développement 🚧" ajoutée en bas de page'},
      {t:'new', tx:'La poupée d\'équipement affiche maintenant le PA/PD/PV donné par chaque pièce au survol'},
      {t:'new', tx:'Classement : clique sur le pseudo d\'un joueur pour voir son stuff équipé (lecture seule)'},
    ], en:[
      {t:'fix', tx:'Chat: announcement messages without a pseudo showed "null" instead of a name — fixed with a proper fallback'},
      {t:'new', tx:'"🚧 Game in development 🚧" banner added at the bottom of the page'},
      {t:'new', tx:'The equipment doll now shows the AP/DP/HP granted by each piece on hover'},
      {t:'new', tx:'Leaderboard: click a player\'s name to view their equipped gear (read-only)'},
    ] },
  { v:'V76', d:'04/07/2026 15:00', name:{fr:'Tutoriel amélioré, UUID privé, inventaire au clic gauche', en:'Improved tutorial, private UUID, left-click inventory'}, fr:[
      {t:'fix', tx:'L\'étape "Potions de vie" du tutoriel ne recouvre plus la case qu\'elle doit montrer (placement corrigé)'},
      {t:'new', tx:'Bouton "← Précédent" dans le tutoriel pour revenir à l\'étape d\'avant'},
      {t:'new', tx:'Nouvelle étape de tutoriel sur "Équiper le meilleur" : explique qu\'il compare toujours le SOCLE des objets, donc une pièce de plus haut niveau reste préférée même moins forte à l\'instant T (ton futur BiS)'},
      {t:'change', tx:'L\'UUID n\'est plus affiché en clair : le bouton affiche juste "📋 Copier UUID" et copie la valeur réelle au clic'},
      {t:'new', tx:'Clic gauche sur une case du sac : ouvre un menu collé à la case (Équiper/Optimiser/Vendre/Jeter) qui affiche en plus le gain ou la perte de PA/PD/PV par rapport à ce qui est déjà équipé'},
      {t:'change', tx:'Bouton "Vendre les objets inférieurs ou égaux" renommé en "Vendre l\'inférieur"'},
      {t:'change', tx:'"Vendre trash" et "Vendre mat." sont temporairement verrouillés 🔒 (reviendront avec une utilité dédiée plus tard)'},
    ], en:[
      {t:'fix', tx:'The tutorial\'s "HP Potions" step no longer covers the slot it\'s supposed to point at (placement fixed)'},
      {t:'new', tx:'"← Back" button in the tutorial to return to the previous step'},
      {t:'new', tx:'New tutorial step on "Equip best": explains it always compares items\' BASE stats, so a higher-tier piece stays preferred even if weaker right now (your future BiS)'},
      {t:'change', tx:'The UUID is no longer shown in plain text: the button just reads "📋 Copy UUID" and copies the real value on click'},
      {t:'new', tx:'Left-click on a bag slot: opens a menu attached to the slot (Equip/Enhance/Sell/Drop) that also shows the AP/DP/HP gain or loss versus what\'s currently equipped'},
      {t:'change', tx:'"Sell items worse than or equal to equipped" button renamed to "Sell the worse"'},
      {t:'change', tx:'"Sell trash" and "Sell mats" are temporarily locked 🔒 (will return with a dedicated purpose later)'},
    ] },
  { v:'V75', d:'04/07/2026 14:00', name:{fr:'Tutoriel : étape sur les potions', en:'Tutorial: potion step'}, fr:[
      {t:'new', tx:'Nouvelle étape du tutoriel sur les potions de vie : présente le choix de la taille et le curseur "Boire sous X%"'},
    ], en:[
      {t:'new', tx:'New tutorial step on HP potions: introduces the size selector and the "Drink under X%" slider'},
    ] },
  { v:'V74', d:'04/07/2026 13:15', name:{fr:'Seuil de potion réglable', en:'Adjustable potion threshold'}, fr:[
      {t:'new', tx:'Nouveau curseur dans le sélecteur de potion : règle le % de PV en dessous duquel une potion est bue automatiquement (5% à 95%)'},
    ], en:[
      {t:'new', tx:'New slider in the potion selector: sets the HP % below which a potion is drunk automatically (5% to 95%)'},
    ] },
  { v:'V73', d:'04/07/2026 12:30', name:{fr:'PV/potions en %, confirmation de vente, remboursement admin', en:'HP/potion %, sell confirmation, admin refund'}, fr:[
      {t:'new', tx:'La barre de vie du personnage affiche maintenant le % de PV, et le sélecteur de potion affiche le % de soin en plus du chiffre'},
      {t:'new', tx:'Une confirmation est désormais demandée avant toute vente (objet, tas, tout le rebut, tous les matériaux)'},
      {t:'admin', tx:'Panneau Admin : bouton pour rembourser le dernier clic "Vendre mat" d\'un joueur (par pseudo), à partir d\'un nouveau journal des ventes groupées'},
    ], en:[
      {t:'new', tx:'The character HP bar now shows the HP %, and the potion selector shows the heal % alongside the number'},
      {t:'new', tx:'A confirmation is now required before any sale (single item, stack, all trash, all materials)'},
      {t:'admin', tx:'Admin panel: button to refund a player\'s last "Sell mats" click (by pseudo), from a new bulk-sale log'},
    ] },
  { v:'V72', d:'04/07/2026 11:00', name:{fr:'Potions à 4 tailles, IA Loot/XP, clic sur le loot, PV du stuff, boss stylisé', en:'4 potion sizes, Loot/XP AI, click-to-loot, gear HP, styled boss'}, fr:[
      {t:'new', tx:'Les potions de vie proposent maintenant 4 tailles au choix (petite/moyenne/grande/majeure), chacune avec un prix fixe et un soin différents (recharge adaptée à la taille pour rester équilibrée) — clique sur l\'icône de potion en jeu pour choisir'},
      {t:'new', tx:'Nouveau bouton de mode d\'IA à côté de l\'état : "🎒 Loot" ramasse tout le butin d\'un pack avant de passer au suivant (corrigé pour ne plus rien laisser au sol), "⚡ XP" enchaîne les packs sans se soucier du loot pour maximiser les kills/xp par minute'},
      {t:'new', tx:'Clic sur un objet au sol : le perso s\'y déplace directement, prioritaire sur l\'IA jusqu\'à l\'arrivée'},
      {t:'new', tx:'L\'armure (casque/plastron/gants/bottes) apporte désormais des PV en plus de la PA/PD, pour éviter les one-shot en zone difficile — affiché dans les stats et sur les objets'},
      {t:'admin', tx:'Panneau Admin : graphique de répartition des joueurs par tranche de richesse + tuiles Total/Moyenne/Médiane en jeu'},
      {t:'change', tx:'Barre de vie du World Boss restylée : pourcentage bien visible, repères 25/50/75%, halo qui pulse en dessous de 20% PV'},
      {t:'change', tx:'Salle du World Boss encore plus "4D" : brume de fond en parallaxe (dérive indépendante du tremblement d\'écran) et vignette de corruption qui s\'intensifie à mesure que le boss perd des PV'},
    ], en:[
      {t:'new', tx:'HP potions now come in 4 selectable sizes (small/medium/large/major), each with a different fixed price and heal (cooldown scaled to size to stay balanced) — click the potion icon in-game to choose'},
      {t:'new', tx:'New AI mode button next to the state display: "🎒 Loot" clears all of a pack\'s drops before moving on (fixed to no longer leave loot behind), "⚡ XP" chains packs without caring about loot to maximize kills/xp per minute'},
      {t:'new', tx:'Click a ground item: the character walks straight to it, taking priority over the AI until it arrives'},
      {t:'new', tx:'Armor (helmet/chest/gloves/boots) now grants HP in addition to AP/DP, to avoid one-shots in harder zones — shown in stats and on items'},
      {t:'admin', tx:'Admin panel: player wealth-bracket distribution chart + Total/Average/Median in-game tiles'},
      {t:'change', tx:'World Boss HP bar restyled: clear percentage, 25/50/75% tick marks, pulsing glow under 20% HP'},
      {t:'change', tx:'World Boss room even more "4D": parallax background fog (drifts independently from screen shake) and a corruption vignette that intensifies as the boss loses HP'},
    ] },
  { v:'V71', d:'04/07/2026 09:30', name:{fr:'World Boss : combattants en direct + % de dégâts', en:'World Boss: live fighters + damage %'}, fr:[
      {t:'new', tx:'Le panneau de classement du World Boss partagé affiche maintenant un compteur "X joueurs combattent en direct" et un point vert à côté des pseudos qui tapent en ce moment'},
      {t:'change', tx:'Le classement affiche désormais le % de dégâts de chacun (calculé sur le total réel de tous les participants) en plus du nombre brut'},
      {t:'change', tx:'Les PV du World Boss lancé pour tous sont désormais calculés selon le nombre de joueurs en ligne, pour viser une mort en 2 à 7 minutes réelles selon le stuff et le nombre de participants'},
    ], en:[
      {t:'new', tx:'The shared World Boss leaderboard now shows a "X players fighting" live counter and a green dot next to pseudos currently hitting the boss'},
      {t:'change', tx:'The leaderboard now shows each player\'s damage % (computed on the real total across all participants) alongside the raw number'},
      {t:'change', tx:'HP for the globally-launched World Boss is now computed from the current online player count, targeting a real kill time of 2 to 7 minutes depending on gear and participation'},
    ] },
  { v:'V70', d:'04/07/2026 08:15', name:{fr:'Tutoriel : suivi pixel perfect + démo du suivi de quêtes', en:'Tutorial: pixel-perfect tracking + quest tracker demo'}, fr:[
      {t:'fix', tx:'Le halo/encadré du tutoriel suit maintenant la cible au pixel près en permanence (recalcul à chaque frame), y compris pendant un scroll'},
      {t:'change', tx:'L\'étape "Quêtes" ouvre maintenant le panneau Quêtes tout seul et montre directement le bouton "Suivre" à l\'intérieur, avant de le refermer et de montrer où s\'affiche le suivi'},
    ], en:[
      {t:'fix', tx:'The tutorial\'s halo/box now tracks the target pixel-perfectly at all times (recalculated every frame), including while scrolling'},
      {t:'change', tx:'The "Quests" step now opens the Quests panel on its own and points directly at the "Track" button inside it, before closing it and showing where the tracker appears'},
    ] },
  { v:'V69', d:'04/07/2026 07:45', name:{fr:'Tutoriel complet + BETA sur le marché', en:'Full tutorial tour + market BETA tag'}, fr:[
      {t:'new', tx:'Le tutoriel de bienvenue couvre maintenant tout le jeu en 19 étapes : pages, zones, sorts automatiques, statistiques, optimisation, inventaire (et ses boutons), butin en direct, quêtes (+ où trouver leur suivi), classement, succès, courrier, notes de version, marché, chat, déconnexion et UUID (utile si le staff doit t\'ajouter un rôle)'},
      {t:'change', tx:'Ajout d\'un badge "BETA" sur le bouton Marché et sur l\'Hôtel des ventes'},
    ], en:[
      {t:'new', tx:'The welcome tutorial now covers the whole game in 19 steps: pages, zones, automatic skills, stats, enhancement, inventory (and its buttons), live loot, quests (+ where to find their tracker), leaderboard, achievements, mailbox, patch notes, market, chat, logout and UUID (useful if staff needs to grant you a role)'},
      {t:'change', tx:'Added a "BETA" badge on the Market button and on the Marketplace'},
    ] },
  { v:'V68', d:'04/07/2026 07:00', name:{fr:'Correctif : halo du tutoriel figé au scroll', en:'Fix: tutorial halo stays static on scroll'}, fr:[
      {t:'fix', tx:'Le halo/encadré du tutoriel de bienvenue reste maintenant totalement statique à l\'écran, même en cas de scroll — il ne se recale plus (et ne bouge donc plus) pendant que tu défiles la page'},
    ], en:[
      {t:'fix', tx:'The welcome tutorial\'s halo/box now stays completely static on screen even when scrolling — it no longer repositions (and therefore no longer moves) while you scroll the page'},
    ] },
  { v:'V67', d:'04/07/2026 06:30', name:{fr:'Correctif : tutoriel désaligné au scroll', en:'Fix: tutorial misaligned on scroll'}, fr:[
      {t:'fix', tx:'L\'encadré et la flèche du tutoriel de bienvenue restent maintenant correctement collés à l\'élément expliqué même si on scroll la page pendant le tutoriel'},
    ], en:[
      {t:'fix', tx:'The welcome tutorial\'s box and arrow now stay correctly attached to the explained element even if the page is scrolled during the tutorial'},
    ] },
  { v:'V66', d:'04/07/2026 06:00', name:{fr:'Tutoriel de bienvenue à Velia', en:'Velia welcome tutorial'}, fr:[
      {t:'new', tx:'Nouvelle zone paisible 🏘️ Velia, épinglée en haut de la liste des zones — aucun monstre, juste un point de repère pour revoir le tutoriel'},
      {t:'new', tx:'Un petit tutoriel se lance automatiquement pour tout nouveau compte : des encadrés et des flèches expliquent les pages du jeu, les zones, les sorts automatiques, les statistiques, les quêtes et le chat'},
      {t:'new', tx:'Le tutoriel peut être relancé à tout moment depuis le 📖 Wiki (onglet 🔰 Tutoriel) ou en cliquant sur 🏘️ Velia'},
    ], en:[
      {t:'new', tx:'New peaceful zone 🏘️ Velia, pinned at the top of the zone list — no monsters, just a landmark to replay the tutorial'},
      {t:'new', tx:'A short tutorial now launches automatically for every new account: highlighted boxes and arrows explain the game pages, zones, automatic skills, stats, quests and chat'},
      {t:'new', tx:'The tutorial can be replayed anytime from the 📖 Wiki (🔰 Tutorial tab) or by clicking 🏘️ Velia'},
    ] },
  { v:'V65', d:'04/07/2026 05:00', name:{fr:'Mise à jour de la clause de non-affiliation', en:'Updated copyright disclaimer'}, fr:[
      {t:'change', tx:'Mention légale mise à jour en bas de page et dans le Wiki (À propos) : Black Desert et toutes les images/illustrations/icônes/noms/données du jeu sont la propriété de Pearl Abyss — projet de fan non officiel et gratuit, sans affiliation ni partenariat avec Pearl Abyss'},
    ], en:[
      {t:'change', tx:'Updated legal notice at the bottom of the page and in the Wiki (About): Black Desert and all in-game images/illustrations/icons/names/data are property of Pearl Abyss — unofficial, free fan project, no affiliation or partnership with Pearl Abyss'},
    ] },
  { v:'V64', d:'04/07/2026 04:10', name:{fr:'Renvoi de message, horodatage du chat & boss plus immersif', en:'Message restore, chat timestamps & more immersive boss'}, fr:[
      {t:'new', tx:'Onglet 🛡️ Modéré : bouton "↩ Renvoyer" pour republier un message supprimé à tort dans son canal d\'origine'},
      {t:'new', tx:'Chaque message des canaux Mondial/Trade/Annonce affiche désormais l\'heure (et la date s\'il ne date pas d\'aujourd\'hui)'},
      {t:'change', tx:'Le encart de chat est agrandi (plus large, plus de messages visibles) pour un meilleur confort de lecture'},
      {t:'new', tx:'Salle du World Boss Kzarka : effets de profondeur et d\'immersion — braises de corruption en parallaxe, tremblement d\'écran sur les coups critiques et les attaques de zone, légère oscillation de volume sur le boss'},
    ], en:[
      {t:'new', tx:'🛡️ Moderated tab: "↩ Restore" button to repost a wrongly-deleted message back to its original channel'},
      {t:'new', tx:'Every message in the World/Trade/Announcement channels now shows the time (and date if not from today)'},
      {t:'change', tx:'The chat box is bigger (wider, more visible messages) for a more comfortable read'},
      {t:'new', tx:'Kzarka World Boss room: depth/immersion effects — parallax corruption embers, screen shake on crits and AoE hits, subtle volumetric wobble on the boss'},
    ] },
  { v:'V63', d:'04/07/2026 03:15', name:{fr:'World Boss partagé, rôle Testeur & bouton copier', en:'Shared World Boss, Tester role & copy button'}, fr:[
      {t:'new', tx:'World Boss global : quand l\'admin lance un boss pour tous, les PV sont désormais PARTAGÉS entre tous les joueurs qui se battent — chaque coup porté par n\'importe qui fait baisser la même barre de vie'},
      {t:'new', tx:'Classement de contribution en direct (top 10) affiché pendant le combat, avec le pseudo de chaque joueur et ses dégâts infligés'},
      {t:'new', tx:'À la mort du boss, la récompense dépend de ton rang de contribution : plus tu es haut dans le classement, plus la récompense en argent et matériaux est intéressante (jusqu\'à ×3 pour le rang #1)'},
      {t:'new', tx:'Nouveau rôle "Testeur" : accès à un panneau 🧪 Testeur listant les futures fonctionnalités (pêche, mine, forêt...) — aucun avantage de jeu, uniquement de la prévisualisation. Géré par l\'admin comme les modérateurs'},
      {t:'change', tx:'La case UUID est maintenant un vrai bouton cliquable avec un indice "📋 Copier" bien visible (devient "✓ Copié !" après le clic)'},
    ], en:[
      {t:'new', tx:'Global World Boss: when the admin spawns a boss for everyone, HP is now SHARED among all fighting players — every hit from anyone drains the same health bar'},
      {t:'new', tx:'Live contribution leaderboard (top 10) shown during the fight, with each player\'s nickname and damage dealt'},
      {t:'new', tx:'When the boss dies, your reward depends on your contribution rank: the higher you rank, the better the silver and material reward (up to ×3 for rank #1)'},
      {t:'new', tx:'New "Tester" role: access to a 🧪 Tester panel listing upcoming features (fishing, mining, forest...) — no gameplay advantage, preview only. Managed by the admin like moderators'},
      {t:'change', tx:'The UUID field is now a real clickable button with a clear "📋 Copy" hint (turns into "✓ Copied!" after clicking)'},
    ] },
  { v:'V62', d:'04/07/2026 02:34', name:{fr:'Canal Modéré : journal des messages supprimés', en:'Moderated channel: deleted-message log'}, fr:[
      {t:'new', tx:'Nouveau canal de chat "🛡️ Modéré" visible seulement par l\'admin et les modérateurs : journal de tous les messages supprimés, avec le pseudo de l\'auteur, son UUID, le canal d\'origine et le message'},
      {t:'change', tx:'Le badge MOD s\'affiche devant le pseudo des modérateurs, et les modérateurs peuvent supprimer des messages dans le chat (le message supprimé est archivé dans le canal Modéré)'},
    ], en:[
      {t:'new', tx:'New "🛡️ Moderated" chat channel visible only to admin and moderators: a log of all deleted messages, with the author\'s nickname, their UUID, the original channel and the message'},
      {t:'change', tx:'The MOD badge shows in front of moderators\' nicknames, and moderators can delete chat messages (the deleted message is archived in the Moderated channel)'},
    ] },
  { v:'V61', d:'04/07/2026 02:27', name:{fr:'Correctif : rejoindre le World Boss global', en:'Fix: joining the global World Boss'}, fr:[
      {t:'fix', tx:'Quand l\'admin lance un boss pour tous, il apparaît maintenant instantanément pour chaque joueur : l\'état est rafraîchi à l\'ouverture de la page Boss et au démarrage, et le bouton "Combattre" apparaît tout seul si tu es déjà sur la page — tout le monde peut rejoindre'},
    ], en:[
      {t:'fix', tx:'When the admin launches a boss for all, it now appears instantly for every player: the state is refreshed when opening the Boss page and at startup, and the "Fight" button shows up on its own if you\'re already on the page — everyone can join'},
    ] },
  { v:'V60', d:'04/07/2026 02:19', name:{fr:'UUID copiable & gestion des modérateurs', en:'Copyable UUID & moderator management'}, fr:[
      {t:'new', tx:'Ton UUID de joueur s\'affiche sous les infos de connexion, avec un bouton 📋 pour le copier'},
      {t:'new', tx:'Zone Admin : section Modérateurs — ajouter un MOD par UUID, voir la liste des modérateurs et en retirer un à tout moment'},
    ], en:[
      {t:'new', tx:'Your player UUID is shown below the connection info, with a 📋 button to copy it'},
      {t:'new', tx:'Admin Zone: Moderators section — add a MOD by UUID, see the moderator list and remove one at any time'},
    ] },
  { v:'V59', d:'04/07/2026 02:13', name:{fr:'Boutons équiper/vendre déplacés dans l\'inventaire', en:'Equip/sell buttons moved into inventory'}, fr:[
      {t:'change', tx:'Les boutons "⚡ Équiper le meilleur (socle)" et "🗑️ Vendre les objets inférieurs ou égaux" sont déplacés dans la carte Inventaire (avec les outils) — plus besoin de faire défiler jusqu\'à l\'équipement'},
    ], en:[
      {t:'change', tx:'The "⚡ Equip best (base)" and "🗑️ Sell items worse than or equal" buttons moved into the Inventory card (with the tools) — no more scrolling down to the Equipment card'},
    ] },
  { v:'V58', d:'04/07/2026 02:11', name:{fr:'Lancer un World Boss pour tous les joueurs', en:'Launch a World Boss for all players'}, fr:[
      {t:'new', tx:'L\'admin peut lancer un World Boss pour TOUS les joueurs à la demande (15 min) : il apparaît instantanément "EN COURS" pour tout le monde et devient combattable, indépendamment du planning horaire'},
    ], en:[
      {t:'new', tx:'The admin can launch a World Boss for ALL players on demand (15 min): it instantly shows "LIVE" for everyone and becomes fightable, independently of the schedule'},
    ] },
  { v:'V57', d:'04/07/2026 02:04', name:{fr:'Panneau admin en 2 parties & vrai calendrier boss', en:'Two-part admin panel & real boss calendar'}, fr:[
      {t:'change', tx:'Zone Admin scindée en deux : "👤 Pour moi" (tests sur mon propre compte : +silver, +fidélité, débloquer les succès, réinitialiser mes quêtes/démo, combattre un boss) et "🌍 Pour les joueurs" (actions serveur qui touchent tout le monde)'},
      {t:'change', tx:'Le calendrier des World Boss est maintenant une vraie grille hebdomadaire : jours en colonnes, heures de spawn en lignes, avec le nom du boss dans chaque case et une légende'},
    ], en:[
      {t:'change', tx:'Admin Zone split in two: "👤 For me" (tests on my own account: +silver, +loyalty, unlock achievements, reset my quests/demo, fight a boss) and "🌍 For players" (server-wide actions affecting everyone)'},
      {t:'change', tx:'The World Boss calendar is now a real weekly grid: days as columns, spawn hours as rows, with the boss name in each cell and a legend'},
    ] },
  { v:'V56', d:'04/07/2026 01:58', name:{fr:'Pseudo affiché dans le chat', en:'Nickname shown in chat'}, fr:[
      {t:'fix', tx:'Le chat affiche désormais bien ton pseudo (celui vu dans l\'interface, y compris ton nom Discord si tu n\'as pas de pseudo perso), jamais l\'email ni "Joueur"'},
    ], en:[
      {t:'fix', tx:'Chat now correctly shows your nickname (the one seen in the UI, including your Discord name if you have no custom nickname), never the email nor "Player"'},
    ] },
  { v:'V55', d:'04/07/2026 01:48', name:{fr:'Salle de boss à piliers & mécanique d\'AoE', en:'Pillar boss room & AoE mechanic'}, fr:[
      {t:'new', tx:'Le World Boss se déroule maintenant dans une salle de pierre à 4 piliers, entièrement dessinée pour le jeu (art original)'},
      {t:'new', tx:'Le boss devient le "Grand Seigneur de guerre de la corruption" — grande créature originale et imposante'},
      {t:'new', tx:'Nouvelle mécanique : le boss charge une attaque de zone (AoE). Le héros court se cacher derrière un pilier pour la parer — s\'il est à découvert, il encaisse un gros coup ("PARÉ !" / "AoE !")'},
    ], en:[
      {t:'new', tx:'The World Boss now takes place in a stone room with 4 pillars, entirely drawn for the game (original art)'},
      {t:'new', tx:'The boss is now the "Great Warlord of Corruption" — a large, imposing original creature'},
      {t:'new', tx:'New mechanic: the boss charges an area attack (AoE). The hero runs to hide behind a pillar to block it — if caught in the open, they take a big hit ("BLOCKED!" / "AoE!")'},
    ] },
  { v:'V54', d:'04/07/2026 01:38', name:{fr:'Correctif double-réclamation & anti-triche', en:'Double-claim fix & anti-cheat'}, fr:[
      {t:'exploit', tx:'Faille corrigée : une quête terminée ne peut plus être réclamée deux fois (une fois dans l\'encart de suivi, une fois dans le panneau). Réclamer met désormais à jour instantanément les deux affichages, aucun bouton "Réclamer" périmé ne subsiste'},
      {t:'fix', tx:'Fermer le panneau Quêtes en cliquant à côté ne laisse plus l\'état incohérent'},
      {t:'change', tx:'Anti-triche côté serveur : le classement borne les valeurs manifestement impossibles (silver/gearscore/niveau/temps de jeu) pour rester crédible. Note : le jeu reste calculé côté navigateur, une triche subtile de sa propre ligne reste techniquement possible'},
    ], en:[
      {t:'exploit', tx:'Exploit fixed: a completed quest can no longer be claimed twice (once in the tracker widget, once in the panel). Claiming now instantly updates both displays, no stale "Claim" button remains'},
      {t:'fix', tx:'Closing the Quests panel by clicking outside no longer leaves an inconsistent state'},
      {t:'change', tx:'Server-side anti-cheat: the leaderboard clamps clearly impossible values (silver/gearscore/level/playtime) to stay credible. Note: the game is still computed in the browser, so subtle tampering of one\'s own row remains technically possible'},
    ] },
  { v:'V53', d:'04/07/2026 01:30', name:{fr:'Succès par catégorie, wiki + codex, dates patchnotes', en:'Categorized achievements, wiki + codex, patchnote dates'}, fr:[
      {t:'new', tx:'Chaque note de version affiche désormais sa date et son heure (JJ/MM/AAAA HH:MM)'},
      {t:'change', tx:'Succès réorganisés en catégories (Combat, Butin, Silver, Temps de jeu, Exploration, Équipement) avec un filtre "Pas fini" pour ne voir que ceux qui restent'},
      {t:'change', tx:'L\'encart de suivi affiche "🏅 Vous avez fini les succès !" une fois tous les succès débloqués'},
      {t:'change', tx:'Wiki réorganisé en catégories cliquables, et nouveau 📚 Codex des objets listant tous les objets du jeu (bijoux, matériaux, composants, butin)'},
    ], en:[
      {t:'new', tx:'Each patch note now shows its date and time (DD/MM/YYYY HH:MM)'},
      {t:'change', tx:'Achievements reorganized into categories (Combat, Loot, Silver, Playtime, Exploration, Equipment) with an "Unfinished" filter to show only what\'s left'},
      {t:'change', tx:'The tracker widget shows "🏅 You\'ve finished all achievements!" once every achievement is unlocked'},
      {t:'change', tx:'Wiki reorganized into clickable categories, plus a new 📚 Item Codex listing every item in the game (jewelry, materials, components, loot)'},
    ] },
  { v:'V52', name:{fr:'Icônes détaillées, optimisation PRI+, chat & historique silver', en:'Detailed icons, PRI+ enhancement, chat & silver history'}, fr:[
      {t:'change', tx:'Icônes d\'équipement redessinées, plus jolies et plus grosses, avec le niveau d\'optimisation affiché en gros sur l\'icône (+N, puis I à V pour PRI→PEN)'},
      {t:'change', tx:'Optimisation : à partir de PRI, un échec fait rétrograder d\'un palier (PRI→PEN), mais jamais en dessous de PRI — on ne retombe plus à +15'},
      {t:'change', tx:'Chat : le rôle (ADMIN/MOD) s\'affiche devant le pseudo, jamais l\'email. Les modérateurs peuvent aussi supprimer des messages ; en cas d\'échec de suppression, la raison est affichée'},
      {t:'new', tx:'Petit historique de silver (courbe) sous le loot, avec le taux estimé sur la dernière minute'},
    ], en:[
      {t:'change', tx:'Equipment icons redrawn, prettier and bigger, with the enhancement level shown large on the icon (+N, then I to V for PRI→PEN)'},
      {t:'change', tx:'Enhancement: from PRI, a failure downgrades one tier (PRI→PEN), but never below PRI — you no longer drop back to +15'},
      {t:'change', tx:'Chat: the role (ADMIN/MOD) shows in front of the nickname, never the email. Moderators can also delete messages; if a deletion fails, the reason is shown'},
      {t:'new', tx:'Small silver history (line chart) below the loot, with the estimated rate over the last minute'},
    ] },
  { v:'V51', name:{fr:'Inventaire à 4 catégories & header toujours visible', en:'4-category inventory & always-visible header'}, fr:[
      {t:'change', tx:'Inventaire réorganisé en 4 catégories distinctes (plus de "Tout") : Normal, Optimisation, Consommable, RNG. Chaque objet se range automatiquement dans la bonne'},
      {t:'change', tx:'La catégorie "Butin rare" devient "RNG" et est vidée — elle accueillera bientôt des coffres RNG (les composants de craft passent dans Optimisation)'},
      {t:'change', tx:'Le header (Zone / Boss / activités) reste maintenant toujours visible : ouvrir la page Boss ne cache plus la barre du haut, elle s\'affiche juste en dessous'},
    ], en:[
      {t:'change', tx:'Inventory reorganized into 4 distinct categories (no more "All"): Normal, Enhancement, Consumable, RNG. Each item is auto-sorted into the right one'},
      {t:'change', tx:'The "Rare loot" category becomes "RNG" and is emptied — it will soon hold RNG boxes (crafting components moved to Enhancement)'},
      {t:'change', tx:'The header (Zone / Boss / activities) now always stays visible: opening the Boss page no longer hides the top bar, it shows right below it'},
    ] },
  { v:'V50', name:{fr:'Page World Boss, chat amélioré, quêtes affinées', en:'World Boss page, improved chat, refined quests'}, fr:[
      {t:'change', tx:'Le header au-dessus du jeu est maintenant une liste de pages : ⚔️ Zone, 🐍 Boss, + activités verrouillées. La page Boss occupe toute la hauteur de l\'écran, dans le style de la zone de farm (sol iso, héros, boss au centre)'},
      {t:'change', tx:'Chat : affiche le pseudo (jamais l\'email), badge ADMIN/MOD à côté du pseudo, bouton de suppression de message pour le staff. Le chat est aussi agrandi'},
      {t:'change', tx:'Quêtes : bouton "Réclamer" plus petit ; l\'encart de suivi affiche désormais Journalières/Hebdo séparément et permet de réclamer directement les quêtes terminées'},
    ], en:[
      {t:'change', tx:'The header above the game is now a page list: ⚔️ Zone, 🐍 Boss, + locked activities. The Boss page takes the full screen height, in the farming-zone style (iso ground, hero, boss in the center)'},
      {t:'change', tx:'Chat: shows the nickname (never the email), ADMIN/MOD badge next to the nickname, message-delete button for staff. The chat is also enlarged'},
      {t:'change', tx:'Quests: smaller "Claim" button; the tracker widget now shows Daily/Weekly separately and lets you claim completed quests directly'},
    ] },
  { v:'V49', name:{fr:'Potions payantes, header Activités, calendrier boss par jour', en:'Paid potions, Activities header, per-day boss calendar'}, fr:[
      {t:'new', tx:'Les potions de vie coûtent désormais du silver à chaque utilisation (200 silver). Sans silver, pas de soin — le joueur encaisse. Une "potion infinie" gratuite sera débloquable plus tard'},
      {t:'change', tx:'La barre "🧭 Activités" est maintenant un header directement au-dessus de la zone de farm'},
      {t:'change', tx:'Le calendrier des World Boss de la semaine est désormais organisé par jour, chaque jour se replie/déplie (le jour du prochain boss est ouvert par défaut)'},
    ], en:[
      {t:'new', tx:'HP potions now cost silver each use (200 silver). Without silver, no heal — you take the hits. A free "infinite potion" will be unlockable later'},
      {t:'change', tx:'The "🧭 Activities" bar is now a header directly above the farming zone'},
      {t:'change', tx:'The weekly World Boss calendar is now organized by day, each day collapses/expands (the next boss\'s day is open by default)'},
    ] },
  { v:'V48', name:{fr:'Invocation de World Boss (admin)', en:'World Boss spawn (admin)'}, fr:[
      {t:'new', tx:'Zone Admin : sélecteur pour faire apparaître immédiatement le World Boss de ton choix (combat de test), sans toucher au planning horaire normal'},
    ], en:[
      {t:'new', tx:'Admin Zone: selector to immediately spawn the World Boss of your choice (test fight), without affecting the normal schedule'},
    ] },
  { v:'V47', name:{fr:'World Boss (Kzarka) & activités', en:'World Boss (Kzarka) & activities'}, fr:[
      {t:'new', tx:'Nouveau bouton "🧭 Activités" au-dessus du farm : accès à la zone, au World Boss, et des activités à venir en avant-goût (pêche, mine, forêt, champs, bergerie — verrouillées)'},
      {t:'new', tx:'Premier World Boss : Kzarka ! Encadré "prochain boss" avec compte à rebours, calendrier de la semaine (seuls les boss déjà en jeu s\'affichent). Horaires calqués sur le vrai BDO −15 min'},
      {t:'new', tx:'Salle de boss en plein écran : combat de 2 à 9 minutes selon ton stuff, avec récompenses (silver + Pierres noires) à la victoire'},
      {t:'change', tx:'Panneau Quêtes plus lisible : bascule Journalières/Hebdomadaires avec, d\'un coup d\'œil, le nombre de quêtes à réclamer (pastille dorée) ou restantes — sans avoir à faire défiler'},
      {t:'change', tx:'Zone Admin : le graphique par heure affiche désormais le nombre de joueurs distincts actifs (ex: "3" = trois joueurs) en plus du temps de jeu cumulé'},
      {t:'change', tx:'L\'adresse email n\'est plus affichée à côté du tag DÉMO (pseudo uniquement)'},
    ], en:[
      {t:'new', tx:'New "🧭 Activities" button above farming: access the zone, the World Boss, and upcoming activities as a teaser (fishing, mining, forest, fields, ranch — locked)'},
      {t:'new', tx:'First World Boss: Kzarka! "Next boss" panel with countdown, weekly schedule (only bosses already in the game are shown). Times mirror real BDO −15 min'},
      {t:'new', tx:'Fullscreen boss room: 2 to 9 minute fight depending on your gear, with rewards (silver + Black Stones) on victory'},
      {t:'change', tx:'More readable Quests panel: Daily/Weekly toggle showing at a glance how many quests are claimable (gold badge) or remaining — no scrolling needed'},
      {t:'change', tx:'Admin Zone: the per-hour chart now shows the number of distinct active players (e.g. "3" = three players) in addition to total playtime'},
      {t:'change', tx:'The email address is no longer shown next to the DEMO tag (nickname only)'},
    ] },
  { v:'V46', name:{fr:'Courrier & fidélité, inventaire par catégories, équipement lifeskill', en:'Mailbox & loyalty, inventory categories, lifeskill gear'}, fr:[
      {t:'new', tx:'Nouveau "📬 Courrier" : 200 points de fidélité offerts chaque jour, stockés en permanence (jamais perdus, s\'empilent sans limite) — base posée pour de futures récompenses'},
      {t:'new', tx:'L\'inventaire se divise maintenant en catégories cliquables : Tout, Normal (équipement), Optimisation (matériaux), Consommable, et Butin rare (composants de craft endgame)'},
      {t:'new', tx:'Nouvelle icône ⛏️ à côté de l\'inventaire : ouvre un 2e équipement dédié au lifeskill (couteau à dépecer, pioche, hache, seringue, houe, couteau de tanneur, flotteur, canne à pêche) — les accessoires de combat y sont rappelés en lecture seule. Ces emplacements sont prêts mais vides : aucune récolte/pêche n\'existe encore en jeu'},
    ], en:[
      {t:'new', tx:'New "📬 Mailbox": 200 Loyalty Points granted every day, stored permanently (never lost, stacks without limit) — groundwork for future rewards'},
      {t:'new', tx:'The inventory now splits into clickable categories: All, Normal (gear), Enhancement (materials), Consumable, and Rare loot (endgame crafting components)'},
      {t:'new', tx:'New ⛏️ icon next to the inventory: opens a 2nd equipment panel dedicated to lifeskill (skinning knife, pickaxe, axe, fluid collector, hoe, tanning knife, float, fishing rod) — combat accessories are mirrored there read-only. These slots are ready but empty: no gathering/fishing exists in-game yet'},
    ] },
  { v:'V45', name:{fr:'Chat en jeu', en:'In-game chat'}, fr:[
      {t:'new', tx:'Nouveau chat en bas à droite avec 3 canaux : 🌍 Mondial, 💱 Trade, 📢 Annonce (réservé au staff en écriture) — repliable, couleurs distinctes par canal, réservé aux comptes vérifiés pour écrire (lecture libre)'},
      {t:'new', tx:'Le canal "Guilde" est préparé côté serveur mais reste caché en attendant un vrai système de guildes'},
    ], en:[
      {t:'new', tx:'New chat at the bottom-right with 3 channels: 🌍 World, 💱 Trade, 📢 Announcement (staff-only posting) — collapsible, distinct colors per channel, posting restricted to verified accounts (reading is open)'},
      {t:'new', tx:'The "Guild" channel is prepared server-side but stays hidden until a real guild system exists'},
    ] },
  { v:'V44', name:{fr:'Panneau Admin consolidé & pseudo affiché', en:'Consolidated Admin panel & displayed nickname'}, fr:[
      {t:'change', tx:'Le bouton "🛠️ Admin" ouvre maintenant un seul panneau contenant les actions (réévaluer le marché, réinitialiser les quêtes ou la démo) et les statistiques par onglets, au lieu de boutons séparés dans la barre latérale'},
      {t:'new', tx:'Nouvel onglet "Silver & temps de jeu / heure" : temps de jeu cumulé de tous les joueurs par tranche d\'heure, à côté du silver farmé'},
      {t:'new', tx:'Le pseudo du joueur s\'affiche maintenant à côté du tag DÉMO'},
    ], en:[
      {t:'change', tx:'The "🛠️ Admin" button now opens a single panel containing the actions (reevaluate market, reset quests or demo) and the tabbed stats, instead of separate sidebar buttons'},
      {t:'new', tx:'New "Silver & playtime / hour" tab: total playtime across all players per hour bracket, next to silver farmed'},
      {t:'new', tx:'The player\'s nickname is now shown next to the DEMO tag'},
    ] },
  { v:'V43', name:{fr:'Traductions FR, correctifs objets & suivi amélioré', en:'French translations, item fixes & better tracking'}, fr:[
      {t:'change', tx:'Tous les matériaux et bijoux qui restaient affichés en anglais (Pierre noire, Éclats de cristal noir, Pierre de Caphras, Poussière d\'esprit ancien, Fragment de mémoire, Marbre du Dieu déchu, et les 12 bijoux rares) sont désormais traduits en français'},
      {t:'change', tx:'Black Stone (Arme) et Black Stone (Armure) fusionnés en un seul objet "Pierre noire", comme dans le vrai jeu'},
      {t:'fix', tx:'La Poussière d\'esprit ancien ne peut plus être utilisée directement pour optimiser l\'équipement (elle sert à fabriquer des Pierres de Caphras) — trois zones l\'utilisaient par erreur comme matériau d\'optimisation direct'},
      {t:'change', tx:'"Vendre les objets inférieurs" vend maintenant aussi les objets de force ÉGALE à celle déjà équipée, pas seulement les objets strictement plus faibles'},
      {t:'change', tx:'L\'encart "Quêtes suivies" est plus grand et affiche désormais le chiffre exact de progression (ex: "42 / 250 monstres") pour chaque quête, plus seulement son nom'},
    ], en:[
      {t:'change', tx:'All materials and jewelry that were still showing in English (Black Stone, Black Crystal Shards, Caphras Stone, Ancient Spirit Dust, Memory Fragment, Fallen God\'s Marble, and all 12 rare jewelry pieces) are now translated to French'},
      {t:'change', tx:'Black Stone (Weapon) and Black Stone (Armor) merged into a single "Black Stone" item, matching the original game'},
      {t:'fix', tx:'Ancient Spirit Dust can no longer be used directly to enhance gear (it\'s meant for crafting Caphras Stones) — three zones incorrectly used it as a direct enhancement material'},
      {t:'change', tx:'"Sell items worse than equipped" now also sells items of EQUAL strength to what\'s equipped, not just strictly weaker ones'},
      {t:'change', tx:'The "Tracked quests" widget is bigger and now shows the exact progress number (e.g. "42 / 250 monsters") for each quest, not just its name'},
    ] },
  { v:'V42', name:{fr:'Onglets par catégorie sur Classement & Admin', en:'Category tabs on Leaderboard & Admin'}, fr:[
      {t:'change', tx:'Classement et Zone Admin : chaque catégorie (Silver, Gearscore, meilleure zone, etc.) est maintenant un onglet cliquable, une seule catégorie affichée à la fois au lieu de tout empiler'},
      {t:'new', tx:'Ta propre ligne dans le Classement est mise en valeur par un petit halo doré'},
    ], en:[
      {t:'change', tx:'Leaderboard and Admin Zone: each category (Silver, Gearscore, best zone, etc.) is now a clickable tab, showing one category at a time instead of stacking everything'},
      {t:'new', tx:'Your own row in the Leaderboard is highlighted with a small gold halo'},
    ] },
  { v:'V41', name:{fr:'Courbe d\'XP et niveaux façon vrai jeu', en:'Real-game XP and level curve'}, fr:[
      {t:'new', tx:'En haut de l\'inventaire : niveau + pourcentage d\'XP à 3 décimales (00.000%), comme dans le vrai jeu'},
      {t:'change', tx:'La courbe de montée de niveau utilise désormais les vrais paliers d\'XP du jeu original : quasi instantané niveaux 0-4, puis ça explose fortement — au-delà d\'un certain niveau, un monstre ne fera plus gagner que quelques 0,001% de la barre. D\'autres bonus viendront plus tard pour augmenter fortement les gains d\'XP'},
    ], en:[
      {t:'new', tx:'At the top of the inventory: level + XP percentage with 3 decimals (00.000%), like the original game'},
      {t:'change', tx:'The leveling curve now uses the real XP thresholds from the original game: near-instant for levels 0-4, then it ramps up massively — past a certain level, a single monster only grants a few 0.001% of the bar. More bonuses will come later to greatly boost XP gains'},
    ] },
  { v:'V40', name:{fr:'Reset admin des quêtes', en:'Admin quest reset'}, fr:[
      {t:'new', tx:'Zone admin : bouton "Réinitialiser mes quêtes" (local, instantané) et bouton "Réinitialiser les quêtes de tous" (remet à zéro les quêtes journalières/hebdo de tous les joueurs, action serveur irréversible)'},
    ], en:[
      {t:'new', tx:'Admin zone: "Reset my quests" button (local, instant) and "Reset everyone\'s quests" button (clears daily/weekly quests for all players, irreversible server action)'},
    ] },
  { v:'V39', name:{fr:'Encarts repliables & suivi des quêtes', en:'Collapsible widgets & quest tracking'}, fr:[
      {t:'new', tx:'Nouveau bouton "🔖 Suivre les quêtes restantes" dans le panneau Quêtes : affiche un encart en haut à droite listant toutes les quêtes journalières et hebdomadaires pas encore réclamées, avec leur progression'},
      {t:'change', tx:'L\'encart de suivi (timers de reset journalier/hebdo + prochain succès) est déplacé en haut à droite, et peut être replié via son propre bouton ▾/▸'},
      {t:'new', tx:'Ajout du temps de jeu total et du temps de jeu du jour dans l\'encart de suivi'},
    ], en:[
      {t:'new', tx:'New "🔖 Track remaining quests" button in the Quests panel: shows a widget at the top-right listing every daily and weekly quest not yet claimed, with its progress'},
      {t:'change', tx:'The tracker widget (daily/weekly reset timers + next achievement) moved to the top-right, and can be collapsed via its own ▾/▸ button'},
      {t:'new', tx:'Added total playtime and today\'s playtime to the tracker widget'},
    ] },
  { v:'V38', name:{fr:'Refonte de la liste des zones de farm', en:'Farming zone list redesign'}, fr:[
      {t:'change', tx:'Chaque zone tient maintenant sur une seule ligne (nom, difficulté, PA/PD requis, 👁) — on voit plus de zones sans défiler'},
      {t:'change', tx:'Retiré le bouton "Farmer" : cliquer directement sur une zone permet désormais de partir la farmer ; le bouton 👁 ne fait plus que prévisualiser son loot sans y aller'},
      {t:'new', tx:'Le 👁 de la zone actuellement prévisualisée reste entouré d\'un halo doré en permanence, pour ne pas la confondre avec la zone qu\'on farm réellement'},
    ], en:[
      {t:'change', tx:'Each zone now fits on a single line (name, difficulty, required AP/DP, 👁) — see more zones without scrolling'},
      {t:'change', tx:'Removed the "Farm" button: clicking a zone directly now travels there to farm it; the 👁 button now only previews its loot without traveling'},
      {t:'new', tx:'The 👁 of the currently previewed zone keeps a permanent gold halo, so it\'s never confused with the zone you\'re actually farming'},
    ] },
  { v:'V37', name:{fr:'Aperçu complet des quêtes & panneau repliable', en:'Full quest overview & collapsible panel'}, fr:[
      {t:'change', tx:'Le panneau "🗒️ Quêtes" affiche désormais tous les objectifs possibles de chaque pool (journalier et hebdomadaire), pas seulement les 3 tirées ce cycle — celles non actives restent visibles en grisé avec leur objectif'},
      {t:'new', tx:'Les sections Journalières et Hebdomadaires peuvent être repliées/dépliées en cliquant sur leur titre'},
    ], en:[
      {t:'change', tx:'The "🗒️ Quests" panel now shows every possible objective in each pool (daily and weekly), not just the 3 picked this cycle — inactive ones stay visible dimmed out with their objective'},
      {t:'new', tx:'The Daily and Weekly sections can be collapsed/expanded by clicking their title'},
    ] },
  { v:'V36', name:{fr:'Quêtes hebdomadaires & encart de suivi', en:'Weekly quests & tracker widget'}, fr:[
      {t:'new', tx:'Quêtes hebdomadaires : 3 quêtes tirées au hasard chaque semaine (butin rare, équipement trouvé, optimisations réussies, grosses cibles de kills/silver/temps de jeu), avec des récompenses plus élevées — se réinitialisent chaque lundi, indépendamment des quêtes journalières'},
      {t:'new', tx:'Nouvel encart permanent en bas à droite de l\'écran : compte à rebours avant la prochaine réinitialisation (journalière et hebdomadaire) et le prochain succès le plus proche d\'être débloqué'},
    ], en:[
      {t:'new', tx:'Weekly quests: 3 randomly picked each week (rare jewelry, gear found, successful enhancements, big kill/silver/playtime targets), with higher rewards — reset every Monday, independently from daily quests'},
      {t:'new', tx:'New persistent widget at the bottom-right of the screen: countdown to the next reset (daily and weekly) and the achievement closest to being unlocked'},
    ] },
  { v:'V35', name:{fr:'Succès & quêtes journalières', en:'Achievements & daily quests'}, fr:[
      {t:'new', tx:'Nouveau bouton "🏅 Succès" : 22 succès permanents (kills, butin, silver, zones, gearscore, enchantement, temps de jeu...) qui rapportent du silver dès qu\'ils sont débloqués — d\'autres seront ajoutés à chaque future mise à jour selon le nouveau contenu'},
      {t:'new', tx:'Nouveau bouton "🗒️ Quêtes" : 3 quêtes journalières tirées au hasard chaque jour, à réclamer pour du silver une fois complétées — se réinitialisent chaque jour à minuit'},
    ], en:[
      {t:'new', tx:'New "🏅 Achievements" button: 22 permanent achievements (kills, loot, silver, zones, gearscore, enhancement, playtime...) that grant silver as soon as they\'re unlocked — more will be added with each future update based on new content'},
      {t:'new', tx:'New "🗒️ Quests" button: 3 daily quests randomly picked each day, claimable for silver once completed — reset every day at midnight'},
    ] },
  { v:'V34', name:{fr:'Icônes équipement originales', en:'Original equipment icons'}, fr:[
      {t:'change', tx:'Les icônes d\'équipement et de bijoux (arme, armure, anneaux, boucles d\'oreilles, collier, ceinture...) sont désormais des icônes SVG dessinées spécialement pour ce projet, à la place des emojis génériques'},
    ], en:[
      {t:'change', tx:'Equipment and jewelry icons (weapon, armor, rings, earrings, necklace, belt...) are now original SVG icons drawn specifically for this project, replacing the generic emojis'},
    ] },
  { v:'V33', name:{fr:'Fix charge CPU continue', en:'Continuous CPU load fix'}, fr:[
      {t:'fix', tx:'Correctif de performance important : la mise à jour automatique (chaque seconde) reconstruisait tout le sac (192 cases), la poupée d\'équipement et la liste des zones même quand rien n\'avait changé — ne le fait désormais que si l\'inventaire ou la zone a réellement changé'},
    ], en:[
      {t:'fix', tx:'Major performance fix: the automatic per-second refresh rebuilt the entire bag (192 slots), equipment paperdoll and zone list even when nothing had changed — now only does so when the inventory or zone actually changed'},
    ] },
  { v:'V32', name:{fr:'Nettoyage & fix latence optimisation', en:'Cleanup & enhancement lag fix'}, fr:[
      {t:'change', tx:'Retiré le système de code à générer pour lier Discord dans "Mon compte" (remplacé par le bouton "Connecter Discord" en un clic)'},
      {t:'fix',    tx:'Correctif de performance important : chaque tentative d\'optimisation reconstruisait toute la poupée d\'équipement et redessinait le portrait, causant une latence perceptible en spammant le bouton — ne met désormais à jour que la pièce concernée'},
    ], en:[
      {t:'change', tx:'Removed the code-generation system for linking Discord in "My account" (replaced by the one-click "Connect Discord" button)'},
      {t:'fix',    tx:'Major performance fix: every enhancement attempt rebuilt the entire equipment paperdoll and redrew the character portrait, causing noticeable lag when spamming the button — now only updates the affected piece'},
    ] },
  { v:'V31', name:{fr:'Correctif fermeture accidentelle', en:'Accidental close fix'}, fr:[
      {t:'fix', tx:'Sélectionner du texte dans un champ (ex: le pseudo) puis relâcher la souris juste en dehors ne ferme plus tout le panneau par erreur (Mon compte, Marché, connexion)'},
    ], en:[
      {t:'fix', tx:'Selecting text in a field (e.g. nickname) and releasing the mouse just outside no longer closes the whole panel by mistake (My account, Market, login)'},
    ] },
  { v:'V30', name:{fr:'Connexion Discord & pseudo', en:'Discord login & nickname'}, fr:[
      {t:'new',    tx:'Bouton "🎮 Se connecter avec Discord" — connexion directe, et ajout automatique au serveur Discord communautaire'},
      {t:'new',    tx:'Panneau "Mon compte" : les comptes email peuvent aussi connecter Discord (sans perdre leur compte existant)'},
      {t:'new',    tx:'Pseudo personnalisable dans "Mon compte" — par défaut ton pseudo Discord si tu t\'es connecté ainsi, sinon la partie avant @ de ton email'},
      {t:'change', tx:'Changer de pseudo met à jour la même entrée partout dans le classement (silver, gearscore, filleuls...), impossible d\'en recréer une nouvelle'},
    ], en:[
      {t:'new',    tx:'"🎮 Sign in with Discord" button — direct login, and automatic join to the community Discord server'},
      {t:'new',    tx:'"My account" panel: email accounts can now also connect Discord (without losing their existing account)'},
      {t:'new',    tx:'Customizable nickname in "My account" — defaults to your Discord name if you signed in that way, otherwise the part of your email before @'},
      {t:'change', tx:'Changing your nickname updates the same entry everywhere in the leaderboard (silver, gearscore, referrals...), it can never create a new one'},
    ] },
  { v:'V29', name:{fr:'Menu & clarté connexion', en:'Menu & login clarity'}, fr:[
      {t:'change', tx:'Le compteur "joueurs en ligne" est déplacé dans le menu latéral au lieu de flotter en haut de l\'écran'},
      {t:'fix',    tx:'Clarifie qu\'après une déconnexion (mode invité automatique), le bouton "🔗 Lier un compte" permet aussi de se reconnecter à un compte EXISTANT via "Se connecter" (et pas seulement d\'en créer un nouveau)'},
    ], en:[
      {t:'change', tx:'The "players online" counter now lives in the side menu instead of floating at the top of the screen'},
      {t:'fix',    tx:'Clarifies that after logging out (automatic guest mode), the "🔗 Link account" button can also sign back into an EXISTING account via "Sign in" (not just create a new one)'},
    ] },
  { v:'V28', name:{fr:'Liaison Discord', en:'Discord linking'}, fr:[
      {t:'new', tx:'Panneau "Mon compte" : bouton pour générer un code et lier ton compte Discord au jeu (commande /lier sur le serveur Discord)'},
    ], en:[
      {t:'new', tx:'"My account" panel: button to generate a code and link your Discord account to the game (/lier command on the Discord server)'},
    ] },
  { v:'V26', name:{fr:'Correctif de ralentissement', en:'Slowdown fix'}, fr:[
      {t:'fix', tx:'Correctif de performance important : les packs de monstres vaincus restaient en mémoire tant que le joueur ne s\'éloignait pas de 900 unités, ce qui ralentissait progressivement le jeu (et parfois le PC) sur une session de farm prolongée dans la même zone'},
    ], en:[
      {t:'fix', tx:'Major performance fix: defeated monster packs stayed in memory as long as the player didn\'t move 900 units away, progressively slowing down the game (and sometimes the PC) during long farming sessions in the same zone'},
    ] },
  { v:'V25', name:{fr:'Joueurs en ligne & parrainage', en:'Online players & referrals'}, fr:[
      {t:'new', tx:'Compteur "joueurs en ligne" en haut de l\'écran (invités inclus, mis à jour toutes les 20s)'},
      {t:'new', tx:'Nouveau panneau "👤 Mon compte" (comptes vérifiés) : code de parrainage à partager, champ pour entrer celui d\'un autre joueur, compteur et liste détaillée de tes filleuls (niveau, gearscore, silver) — pas de récompense pour l\'instant, uniquement du suivi'},
      {t:'change', tx:'Règles de parrainage : un compte ne peut être parrainé qu\'une fois, uniquement dans les 3 jours suivant sa création, jamais avec son propre code ni celui de son propre parrain'},
    ], en:[
      {t:'new', tx:'"Players online" counter at the top of the screen (guests included, refreshed every 20s)'},
      {t:'new', tx:'New "👤 My account" panel (verified accounts): referral code to share, a field to enter someone else\'s, a counter and detailed list of your referrals (level, gearscore, silver) — no reward for now, tracking only'},
      {t:'change', tx:'Referral rules: an account can only be referred once, only within 3 days of its creation, never with your own code or your own referrer\'s'},
    ] },
  { v:'V24', name:{fr:'Fini le mur de connexion', en:'No more login wall'}, fr:[
      {t:'change',  tx:'Le jeu se lance directement en mode invité (session anonyme sauvegardée sur le serveur, sans email ni pseudo) — plus besoin de créer un compte pour jouer et être sauvegardé dans le cloud'},
      {t:'new',     tx:'Bouton "🔗 Lier un compte" pour transformer une session invité en compte vérifié à tout moment — la progression est conservée intégralement'},
      {t:'exploit', tx:'Marché, Marché commun et Classement réservés aux comptes vérifiés (invités exclus) pour limiter la triche par comptes jetables — vérifié à la fois côté client et côté serveur'},
    ], en:[
      {t:'change',  tx:'The game now launches directly in guest mode (anonymous session saved server-side, no email or username needed) — no more account required to play and get cloud saves'},
      {t:'new',     tx:'"🔗 Link account" button to upgrade a guest session into a verified account at any time — progress is fully kept'},
      {t:'exploit', tx:'Market, Common Market and Leaderboard restricted to verified accounts (guests excluded) to limit throwaway-account abuse — enforced both client-side and server-side'},
    ] },
  { v:'V23', name:{fr:'Marché commun', en:'Common Market'}, fr:[
      {t:'new', tx:'Nouvel onglet "Marché commun" dans l\'Hôtel des ventes : achète/vends tes matériaux d\'optimisation à un prix commun flottant (borné par un min/max, façon vrai marché de BDO) — pas besoin de créer une annonce, transaction instantanée'},
      {t:'new', tx:'Le prix de chaque matériau varie dans le temps selon l\'offre et la demande (inflation/déflation), avec un code couleur (vert = proche du minimum, rouge = proche du maximum)'},
      {t:'new', tx:'Admin : bouton pour forcer une réévaluation immédiate du marché commun'},
      {t:'change', tx:'Le gear et les bijoux restent sur l\'Hôtel des ventes classique (annonces à prix libre) — chaque pièce a ses propres stats aléatoires, incompatible avec un prix commun'},
    ], en:[
      {t:'new', tx:'New "Common Market" tab in the Marketplace: buy/sell your enhancement materials at a floating common price (bounded by a min/max, like BDO\'s real central market) — no listing needed, instant transaction'},
      {t:'new', tx:'Each material\'s price drifts over time based on supply and demand (inflation/deflation), color-coded (green = near minimum, red = near maximum)'},
      {t:'new', tx:'Admin: button to force an immediate common market reevaluation'},
      {t:'change', tx:'Gear and jewelry stay on the classic Marketplace (free-price listings) — each piece has its own randomized stats, incompatible with a shared price'},
    ] },
  { v:'V22', name:{fr:'Encadré admin, zones & classement enrichi', en:'Admin box, zones & richer leaderboard'}, fr:[
      {t:'new',    tx:'Encadré Admin séparé dans le menu (Admin + Réinitialiser), prêt à accueillir de futures options réservées à l\'admin'},
      {t:'new',    tx:'Icônes réalistes pour les bijoux (bague, oreille, collier, ceinture) — avant, tous les bijoux affichaient la même icône bague'},
      {t:'fix',    tx:'Liste des zones : la colonne PA/PD est maintenant toujours alignée, et le badge de danger n\'est plus coupé'},
      {t:'new',    tx:'Chaque zone a maintenant un bouton Voir (aperçu du loot sans voyager) et un bouton Farmer (voyage direct)'},
      {t:'new',    tx:'Classement : ajout d\'un tableau "Objet le plus farmé" par joueur, et d\'un repère ⚠️ si les stats d\'un joueur n\'ont pas été synchronisées depuis plus de 10 minutes'},
    ], en:[
      {t:'new',    tx:'Separate Admin box in the menu (Admin + Reset), ready for future admin-only options'},
      {t:'new',    tx:'Realistic jewelry icons (ring, earring, necklace, belt) — previously every jewelry piece showed the same ring icon'},
      {t:'fix',    tx:'Zone list: the AP/DP column is now always aligned, and the danger badge no longer gets cut off'},
      {t:'new',    tx:'Each zone now has a View button (loot preview without traveling) and a Farm button (direct travel)'},
      {t:'new',    tx:'Leaderboard: added a "Most farmed item" table per player, and a ⚠️ marker if a player\'s stats haven\'t synced in over 10 minutes'},
    ] },
  { v:'V21', name:{fr:'Discord, menu réglable & correctifs', en:'Discord, adjustable menu & fixes'}, fr:[
      {t:'new',    tx:'Lien Discord ajouté dans le menu latéral'},
      {t:'new',    tx:'Slider Gauche/Droite pour choisir le côté d\'affichage du menu latéral'},
      {t:'new',    tx:'La version du client est affichée en bas du menu, et la fenêtre de mise à jour indique désormais le numéro de la nouvelle version — fenêtre déplacée en haut de l\'écran'},
      {t:'fix',    tx:'Correctif important : le tooltip et le menu clic-droit des objets affichaient les PA/PD DE BASE d\'une pièce d\'équipement au lieu de sa vraie valeur une fois enchantée (ex : une arme +10 affichait la stat d\'une arme +0)'},
      {t:'change', tx:'Poids de base (LT) recalibré pour tenir ~2h de farm continu avant ralentissement (contre ~30min avant) — augmentable plus tard via une boutique'},
      {t:'new',    tx:'Emoji ajoutés sur Wiki, Notes de version, Déconnexion et le sélecteur de langue'},
    ], en:[
      {t:'new',    tx:'Discord link added to the side menu'},
      {t:'new',    tx:'Left/Right slider to choose which side the side menu is displayed on'},
      {t:'new',    tx:'Client version shown at the bottom of the menu, and the update window now shows the new version number — window moved to the top of the screen'},
      {t:'fix',    tx:'Important fix: the tooltip and right-click menu for items showed a gear piece\'s BASE AP/DP instead of its real value once enhanced (e.g. a +10 weapon showed the same stat as a +0 one)'},
      {t:'change', tx:'Base weight limit (LT) recalibrated for ~2h of continuous farming before slowdown (was ~30min) — increasable later via a shop'},
      {t:'new',    tx:'Added emoji to Wiki, Patch Notes, Logout and the language selector'},
    ] },
  { v:'V20', name:{fr:'Refonte du menu', en:'Menu redesign'}, fr:[
      {t:'new',    tx:'Les notes de version ont maintenant un nom par version, et les lignes qui décrivent une mécanique retirée du jeu affichent un tag "🗑 Supprimé"'},
      {t:'change', tx:'Sélecteur de langue transformé en slider FR/EN qui indique clairement la langue active'},
      {t:'change', tx:'Menu latéral : les boutons (Wiki, Classement, Marché, Admin...) sont regroupés dans un menu vertical sur le côté gauche avec des icônes agrandies'},
      {t:'fix',    tx:'Le message "✓ sauvegardé" ne fait plus bouger les autres boutons du menu quand il apparaît/disparaît'},
    ], en:[
      {t:'new',    tx:'Patch notes now have a name per version, and lines describing a mechanic that no longer exists show a "🗑 Removed" tag'},
      {t:'change', tx:'Language selector turned into a FR/EN slider that clearly shows the active language'},
      {t:'change', tx:'Side menu: buttons (Wiki, Leaderboard, Marketplace, Admin...) are now grouped into a vertical menu on the left with bigger icons'},
      {t:'fix',    tx:'The "✓ saved" message no longer shifts the other menu buttons when it appears/disappears'},
    ] },
  { v:'V19', name:{fr:'Classement & Gearscore', en:'Leaderboard & Gearscore'}, fr:[
      {t:'change',  tx:'"Power Score" renommé en Gearscore, calculé simplement : (PA + PD) / 2'},
      {t:'new',     tx:'Nouvel onglet 🏆 Classement : silver, gearscore, meilleure zone atteinte et silver/heure (avec zone), top 20 pour chaque catégorie'},
      {t:'new',     tx:'Zone Admin : ajout du temps de jeu cumulé par joueur'},
    ], en:[
      {t:'change',  tx:'"Power Score" renamed to Gearscore, now simply computed as (AP + DP) / 2'},
      {t:'new',     tx:'New 🏆 Leaderboard tab: silver, gearscore, best zone reached and silver/hour (with zone), top 20 per category'},
      {t:'new',     tx:'Admin Zone: added cumulative playtime per player'},
    ] },
  { v:'V18', name:{fr:'Notification de mise à jour', en:'Update notification'}, fr:[
      {t:'new', tx:'Notification de mise à jour : un bandeau apparaît avec un bouton "Recharger" dès qu\'une nouvelle version du jeu est déployée, sans avoir à vider le cache manuellement'},
    ], en:[
      {t:'new', tx:'Update notification: a banner with a "Reload" button appears as soon as a new game version is deployed, no manual cache clearing needed'},
    ] },
  { v:'V17', name:{fr:'Zone Admin', en:'Admin Zone'}, fr:[
      {t:'new',     tx:'Zone Admin (🛠️ Admin) réservée au compte maxime.lacoste@icloud.com : silver farmé par heure, ressources les plus farmées, répartition des richesses entre joueurs'},
      {t:'new',     tx:'Journal de farm côté serveur : chaque objet ramassé par chaque joueur est enregistré (envoi par lots toutes les 25s) pour alimenter les stats admin'},
      {t:'exploit', tx:'Accès admin protégé par une règle de sécurité côté base de données (RLS) — même en trafiquant le code du navigateur, personne d\'autre que ce compte ne peut lire ces données'},
      {t:'change',  tx:'Le bouton Réinitialiser n\'est plus visible que pour l\'admin (avant : accessible à tous les testeurs)'},
    ], en:[
      {t:'new',     tx:'Admin Zone (🛠️ Admin) restricted to maxime.lacoste@icloud.com: silver farmed per hour, most-farmed resources, wealth distribution across players'},
      {t:'new',     tx:'Server-side farm log: every item picked up by every player is recorded (batched every 25s) to feed the admin stats'},
      {t:'exploit', tx:'Admin access protected by a database-level security rule (RLS) — even by tampering with browser code, no one else can read this data'},
      {t:'change',  tx:'The Reset button is now only visible to the admin (previously accessible to all testers)'},
    ] },
  { v:'V16', name:{fr:'Failstack par objet', en:'Per-item failstack'}, fr:[
      {t:'new',    tx:'Failstack PAR objet et PAR palier : chaque échec augmente ta chance sur CE niveau précis pour CET objet précis, et c\'est acquis pour toujours — barre à deux tons (or = base, bleu = bonus du failstack)'},
      {t:'fix',    tx:'L\'Arme d\'Éveil et l\'Arme secondaire ne comptaient jamais dans tes vraies stats de combat — seule l\'arme principale était lue. Corrigé.'},
      {t:'new',    tx:'Les bijoux (bagues/boucles/collier/ceinture) sont désormais optimisables comme le reste de l\'équipement'},
      {t:'new',    tx:'Double-clic sur n\'importe quelle pièce équipée (y compris armes et bijoux) pour la déséquiper directement'},
      {t:'new',    tx:'Bouton "Vendre les objets inférieurs" — nettoie le sac en vendant tout ce qui est strictement moins bon que ce qui est déjà équipé'},
      {t:'change', tx:'Le trash/silver est maintenant ramassé automatiquement même sac plein — seuls matériaux/bijoux/gear/craft restent au sol si le sac déborde'},
      {t:'change', tx:'Le poids a maintenant un vrai effet : au-dessus de la limite LT, le joueur est ralenti (jusqu\'à -65% de vitesse)'},
    ], en:[
      {t:'new',    tx:'PER-ITEM, PER-TIER failstack: every failure boosts your chance on THAT exact level for THAT exact item, permanently — two-tone bar (gold = base, blue = failstack bonus)'},
      {t:'fix',    tx:'Awakening and Secondary weapons never counted toward real combat stats — only the main weapon was read. Fixed.'},
      {t:'new',    tx:'Jewelry (rings/earrings/necklace/belt) can now be enhanced like any other gear'},
      {t:'new',    tx:'Double-click any equipped piece (including weapons and jewelry) to unequip it directly'},
      {t:'new',    tx:'"Sell items worse than equipped" button — cleans up your bag by selling anything strictly worse than what\'s already equipped'},
      {t:'change', tx:'Trash/silver is now always picked up even with a full bag — only materials/jewelry/gear/craft stay on the ground when it overflows'},
      {t:'change', tx:'Weight now actually matters: going over your LT limit slows you down (up to -65% speed)'},
    ] },
  { v:'V15', name:{fr:'Optimisation simplifiée', en:'Simplified enhancement'}, fr:[
      {t:'new',   tx:'Notes de version repensées : badge "NEW" par patch non lu, halo sur le bouton, compteur, catégories'},
      {t:'fix',   tx:'Le sac plein bloquait silencieusement le loot sans aucun message — bandeau d\'alerte ajouté'},
      {t:'change',tx:'Zones dangereuses beaucoup plus punitives (jusqu\'à 4,5× les dégâts reçus au lieu de 3×)'},
      {t:'change',tx:'Système d\'optimisation simplifié : retrait du failstack et du bandeau de Naderr, remplacés par des chances FIXES et lisibles'},
      {t:'fix',   tx:'Le classement des accessoires (bague/boucle/collier/ceinture) était cassé par une reconnaissance de mots-clés en français'},
    ], en:[
      {t:'new',   tx:'Redesigned patch notes: "NEW" badge per unread patch, button halo, counter, categories'},
      {t:'fix',   tx:'A full bag was silently blocking loot pickup with zero feedback — added a warning banner'},
      {t:'change',tx:'Dangerous zones now much more punishing (up to 4.5× incoming damage instead of 3×)'},
      {t:'change',tx:'Simplified enhancement system: removed failstack and Naderr\'s Band, replaced with clean FIXED odds'},
      {t:'fix',   tx:'Accessory categorization (ring/earring/necklace/belt) was broken due to French keyword matching'},
    ] },
  { v:'V14b', name:{fr:'Équiper le meilleur', en:'Equip best'}, fr:[
      {t:'new', tx:'Nouveau bouton "Équiper le meilleur" — compare les STATS DE BASE (enchantement ignoré) et équipe automatiquement le meilleur socle, même s\'il faut redescendre à +0 un objet à fort potentiel'},
      {t:'fix', tx:'Les accessoires étaient tous mal classés comme "bague" à cause d\'une reconnaissance de mots-clés en français sur des noms d\'objets anglais'},
    ], en:[
      {t:'new', tx:'New "Equip Best" button — compares BASE stats (enhancement ignored) and auto-equips the best foundation, even if it means dropping a high-potential piece back to +0'},
      {t:'fix', tx:'Accessories were all miscategorized as "ring" due to French keyword matching on English item names'},
    ] },
  { v:'V14', name:{fr:'Correctif de performance', en:'Performance fix'}, fr:[
      {t:'fix', tx:'Correctif de performance important : les tentatives d\'optimisation ne reconstruisent plus tout l\'inventaire (192 cases) et la liste des zones à chaque clic'},
      {t:'fix', tx:'Fini les ralentissements/plantages en enchaînant les tentatives d\'optimisation rapidement'},
    ], en:[
      {t:'fix', tx:'Major performance fix: enhancement attempts no longer rebuild the entire inventory (192 slots) and zone list on every click'},
      {t:'fix', tx:'No more slowdowns/freezes when spamming enhancement attempts quickly'},
    ] },
  { v:'V13', name:{fr:'Enchantement étendu (+15)', en:'Extended enhancement (+15)'}, fr:[
      {t:'change', tx:'Échelle d\'optimisation étendue à +15 avant les paliers PRI/DUO/TRI/TET/PEN'},
      {t:'change', tx:'À partir de PRI, un échec ne fait plus jamais rétrograder — seul le matériau est perdu'},
      {t:'change', tx:'+8 à +15 restent probabilistes et peuvent rétrograder, mais jamais sous +7'},
    ], en:[
      {t:'change', tx:'Enhancement scale extended to +15 before the PRI/DUO/TRI/TET/PEN tiers'},
      {t:'change', tx:'From PRI onward, a failure never downgrades your level anymore — only the material is lost'},
      {t:'change', tx:'+8 to +15 remain probabilistic and can downgrade, but never below +7'},
    ] },
  { v:'V12', name:{fr:'Éveil, failstack & Naderr', en:'Awakening, failstack & Naderr'}, fr:[
      {t:'change', tx:'Packs de monstres de plus en plus grands en avançant dans les zones (2-4 loups en early, jusqu\'à 9 en endgame)'},
      {t:'new',    tx:'Ajout de l\'Arme d\'Éveil et l\'Arme secondaire au loot (Dandelion, Nouver — vrais noms BDO)'},
      {t:'new',    tx:'Système de failstack façon Garmoth.com : chance de base + failstack, soft cap à 70%, plafond 90%', removed:true},
      {t:'new',    tx:'Bandeau de Naderr : 5 crans de failstack gratuits en montant de niveau, 5 autres réservés à une future boutique', removed:true},
      {t:'change', tx:'Rééquilibrage complet des stats d\'équipement lootable selon le rôle de chaque pièce'},
    ], en:[
      {t:'change', tx:'Monster packs grow larger deeper into the zones (2-4 wolves early, up to 9 at endgame)'},
      {t:'new',    tx:'Added Awakening Weapon and Secondary Weapon to loot (Dandelion, Nouver — real BDO names)'},
      {t:'new',    tx:'Garmoth.com-style failstack system: base chance + failstack, soft cap at 70%, 90% ceiling', removed:true},
      {t:'new',    tx:'Naderr\'s Band: 5 free failstack slots unlocked by leveling up, 5 more reserved for a future shop', removed:true},
      {t:'change', tx:'Full rebalance of lootable gear stats based on each piece\'s role'},
    ] },
  { v:'V11', name:{fr:'Système PA/PD', en:'AP/DP system'}, fr:[
      {t:'change', tx:'Remplacement du "Power Score" abstrait par un vrai système PA/PD affiché par zone (comme le vrai jeu)'},
      {t:'change', tx:'Pas assez de PD = tu encaisses plus de dégâts · pas assez de PA = tu en infliges moins'},
      {t:'fix',    tx:'Le PD de l\'équipement ne comptait pas dans la réduction de dégâts — oubli corrigé'},
      {t:'new',    tx:'La liste des zones affiche directement le PA/PD requis avec code couleur ✓/✗'},
    ], en:[
      {t:'change', tx:'Replaced the abstract "Power Score" with a real per-zone AP/DP system (like the real game)'},
      {t:'change', tx:'Not enough DP = you take more damage · not enough AP = you deal less'},
      {t:'fix',    tx:'Equipped DP wasn\'t counting toward damage reduction — fixed an oversight'},
      {t:'new',    tx:'The zone list now shows required AP/DP directly with ✓/✗ color coding'},
    ] },
  { v:'V10', name:{fr:'Wiki & traduction', en:'Wiki & translation'}, fr:[
      {t:'new', tx:'Ajout du wiki et des notes de version'},
      {t:'new', tx:'Bouton EN/FR pour traduire l\'interface'},
    ], en:[
      {t:'new', tx:'Added wiki and patch notes'},
      {t:'new', tx:'EN/FR toggle to translate the UI'},
    ] },
  { v:'V9', name:{fr:'Hôtel des ventes', en:'Marketplace'}, fr:[
      {t:'new',     tx:'Hôtel des ventes : acheter/vendre/annuler des annonces entre joueurs'},
      {t:'exploit', tx:'Transactions traitées par fonctions serveur sécurisées — impossible de tricher côté client'},
    ], en:[
      {t:'new',     tx:'Marketplace: buy/sell/cancel listings between players'},
      {t:'exploit', tx:'Transactions handled by secure server-side functions — no client-side cheating possible'},
    ] },
  { v:'V8', name:{fr:'Comptes joueurs & cloud save', en:'Player accounts & cloud save'}, fr:[
      {t:'new', tx:'Comptes joueurs avec connexion par email/mot de passe'},
      {t:'new', tx:'Sauvegarde automatique dans le cloud (Supabase) toutes les 30s'},
    ], en:[
      {t:'new', tx:'Player accounts with email/password login'},
      {t:'new', tx:'Automatic cloud save (Supabase) every 30s'},
    ] },
  { v:'V7', name:{fr:'Objets réels BDO', en:'Real BDO items'}, fr:[
      {t:'change', tx:'Vrais noms d\'objets et de zones tirés de Black Desert Online'},
      {t:'change', tx:'Taux de loot progressifs : généreux en zone 1, rares en fin de jeu'},
      {t:'new',    tx:'Cadre d\'optimisation avec sélection de la pièce à améliorer + suggestions'},
      {t:'new',    tx:'Armes et armures ajoutées au loot'},
      {t:'new',    tx:'Survol = infobulle, double-clic = équiper, clic droit = menu (jeter, vendre, optimiser)'},
    ], en:[
      {t:'change', tx:'Real item and zone names from Black Desert Online'},
      {t:'change', tx:'Progressive loot rates: generous in zone 1, rare at endgame'},
      {t:'new',    tx:'Enhancement panel with selectable target piece + suggestions'},
      {t:'new',    tx:'Weapons and armor added to loot tables'},
      {t:'new',    tx:'Hover = tooltip, double-click = equip, right-click = menu (drop, sell, enhance)'},
    ] },
  { v:'V6', name:{fr:'Panneau permanent', en:'Permanent panel'}, fr:[
      {t:'change', tx:'Panneau permanent (équipement + inventaire toujours visibles)'},
      {t:'change', tx:'Optimisation possible uniquement via le loot (plus d\'achat au silver)'},
    ], en:[
      {t:'change', tx:'Permanent panel (equipment + inventory always visible)'},
      {t:'change', tx:'Enhancement now loot-driven only (no more silver-bought upgrades)'},
    ] },
  { v:'V5', name:{fr:'Inventaire & équipement', en:'Inventory & equipment'}, fr:[
      {t:'new', tx:'Inventaire 192 emplacements façon BDO'},
      {t:'new', tx:'Équipement circulaire (arme, armure, accessoires)'},
      {t:'new', tx:'Équiper/déséquiper/vendre depuis le sac'},
    ], en:[
      {t:'new', tx:'192-slot BDO-style inventory'},
      {t:'new', tx:'Circular equipment paperdoll (weapon, armor, accessories)'},
      {t:'new', tx:'Equip/unequip/sell directly from the bag'},
    ] },
  { v:'V4', name:{fr:'Power Score & zones', en:'Power Score & zones'}, fr:[
      {t:'new', tx:'Power Score et ratio de puissance par zone', removed:true},
      {t:'new', tx:'Scaling des dégâts, du loot et du risque de mort selon le gear'},
      {t:'new', tx:'12 zones avec tables de loot à 4 couches'},
    ], en:[
      {t:'new', tx:'Power Score and per-zone power ratio', removed:true},
      {t:'new', tx:'Damage, loot and death-risk scaling based on gear'},
      {t:'new', tx:'12 zones with 4-layer loot tables'},
    ] },
  { v:'V3', name:{fr:'Vue isométrique', en:'Isometric view'}, fr:[
      {t:'change', tx:'Passage en vue isométrique'},
      {t:'change', tx:'Monde 2D libre (fini le couloir)'},
      {t:'change', tx:'Loot dispersé au sol, ramassé au contact, disparaît après 40s'},
    ], en:[
      {t:'change', tx:'Switched to isometric view'},
      {t:'change', tx:'Free 2D world (no more corridor)'},
      {t:'change', tx:'Loot scattered on the ground, picked up on contact, despawns after 40s'},
    ] },
  { v:'V2', name:{fr:'IA de combat complète', en:'Full combat AI'}, fr:[
      {t:'new', tx:'IA complète façon joueur BDO (recherche, déplacement, regroupement, combat, kite, soin, loot)'},
      {t:'new', tx:'Rotation de 10 sorts de Witch avec priorités'},
      {t:'new', tx:'Les monstres ripostent avec attaques télégraphiées'},
    ], en:[
      {t:'new', tx:'Full BDO-player-style AI (search, move, gather, combat, kite, heal, loot)'},
      {t:'new', tx:'10-skill Witch rotation with priorities'},
      {t:'new', tx:'Monsters now fight back with telegraphed attacks'},
    ] },
  { v:'V1', name:{fr:'Premier prototype', en:'First prototype'}, fr:[
      {t:'new', tx:'Premier prototype jouable : déplacement automatique, combat, loot basique'},
    ], en:[
      {t:'new', tx:'First playable prototype: automatic movement, combat, basic loot'},
    ] },
];

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
    const res = await fetch('./game-supabase.js?_=' + Date.now(), { cache: 'no-store' });
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
        <li>Le loot suit le pire des deux ratios : ta pénalité de loot est calculée sur <b>le plus faible</b> de tes 2 ratios (PA effectif / PA requis, PD effectif / PD requis), jamais la moyenne ni le meilleur. Exemple : un PA parfait (ratio 1.5) mais un PD à moitié du requis (ratio 0.5) → ton loot est pénalisé <b>comme si tu étais à 0.5 partout</b>, le PA excédentaire ne compense rien. Pas assez de stuff → loot réduit (jusqu'à -70%) ; stuff adapté OU overstuff → loot toujours normal (100%), plus aucun bonus ni malus au-delà</li>
        <li><b>ZONE DANGEREUSE</b> (très sous-PA/PD) → tu es ralenti, et les monstres qui t'ont repéré deviennent plus rapides pour te rattraper</li>
      </ul>
      <h3>Mana</h3>
      <p>Chaque sort coûte de la mana, qui se régénère passivement même hors combat. Une potion de mana (auto-bue sous 30%) complète la potion de PV si tu es à court.</p>
      <h3>Loot progressif</h3>
      <p>Les taux de drop sont <b>volontairement décroissants</b> zone par zone : très généreux en early (jusqu'à 55%), très rares en endgame (moins de 3%).</p>
      <h3>Sac plein (192/192)</h3>
      <p>Le silver n'occupe jamais de place (toujours ramassé). Un matériau/bijou déjà en stack dans ton sac continue lui aussi d'être ramassé tant que ce stack n'est pas à son maximum, même sac plein. Seuls les <b>nouveaux</b> objets qui auraient besoin d'une case libre restent au sol — un bandeau rouge ⚠ t'en avertit, sans jamais t'empêcher de continuer à farmer.</p>
      <h3>Zones groupées par palier de stuff</h3>
      <p>Les 16 zones de Velia sont regroupées par palier d'équipement (Naru/gris, Tuvala/blanc, Yuria/vert, Grunil/bleu — 4 zones chacun) — la couleur de l'en-tête et de la bordure correspond à la couleur du stuff qu'on y trouve, la même que dans l'inventaire.</p>
      <p>Chaque zone garantit une seule pièce d'équipement précise : casque/plastron/gants sur les 3 premières zones du palier, bottes sur la 4e, et une arme (arme principale/secondaire/éveil) sur les 3 <b>dernières</b> zones — la toute première zone d'un palier n'a donc aucune arme garantie. Clique l'icône 👁 d'une zone pour voir exactement laquelle.</p>
      <h3>Trésor de Velia (catégorie TEST)</h3>
      <p>Toutes les zones de Velia peuvent aussi looter des morceaux du <b>Trésor de Velia</b> — 4 objets collectibles très rares (0,5% à 0,00001% par kill), rangés dans leur propre onglet d'inventaire 🗺️. Encore expérimental : pas de recette ni d'usage pour l'instant.</p>
      <h3>Boss mondial partagé</h3>
      <p>Le Kzarka du planning horaire (12h45/19h45/23h45 tous les jours, 15h45 le week-end) a désormais des <b>PV réellement partagés entre tous les joueurs</b>, exactement comme un boss lancé par l'admin : tout le monde tape le même pool de PV et se voit dans l'arène.</p>
      <h3>Où farmer un socle vide ?</h3>
      <p>Clique un socle d'équipement <b>vide</b> sur la poupée : la ou les zones qui lootent cet objet s'illuminent d'un halo doré dans la liste des zones, et un bouton te téléporte directement dessus. Une zone dangereuse pour ton stuff actuel n'est jamais proposée tant qu'une alternative plus sûre existe.</p>`,
    en:`<h3>AP / DP per zone (like the real game)</h3>
      <p>Every zone has a <b>required AP</b> and <b>required DP</b>. The two stats play separate roles:</p>
      <ul>
        <li><b>Not enough AP</b> → your spells deal less damage (up to -75%)</li>
        <li><b>Not enough DP</b> → you take a lot more damage (up to 4.5×), high KO risk</li>
        <li>Above both → bonus damage and reduction, capped to prevent overfarming</li>
        <li>Loot follows the worse of the two ratios: your loot penalty is calculated on <b>whichever is lowest</b> of your 2 ratios (effective AP / required AP, effective DP / required DP), never the average or the best one. Example: perfect AP (ratio 1.5) but DP at half the requirement (ratio 0.5) → your loot is penalized <b>as if you were at 0.5 everywhere</b>, the excess AP compensates for nothing. Not enough gear → reduced loot (up to -70%); adequate gear OR overgeared → loot always normal (100%), no bonus or penalty beyond that</li>
        <li><b>DANGEROUS ZONE</b> (very under-AP/DP) → you are slowed down, and monsters that spotted you become faster to catch up</li>
      </ul>
      <h3>Mana</h3>
      <p>Every skill costs mana, which regenerates passively even out of combat. A mana potion (auto-drunk under 30%) joins the HP potion if you run low.</p>
      <h3>Progressive loot</h3>
      <p>Drop rates are <b>intentionally decreasing</b> zone by zone: very generous early (up to 55%), very rare at endgame (under 3%).</p>
      <h3>Full bag (192/192)</h3>
      <p>Silver never takes up space (always picked up). A material/jewelry already stacked in your bag keeps getting picked up as long as that stack isn't full, even with a full bag. Only <b>new</b> items that would need a free slot stay on the ground — a red ⚠ banner warns you, without ever stopping you from farming.</p>
      <h3>Zones grouped by gear tier</h3>
      <p>The 16 Velia zones are grouped by gear tier (Naru/grey, Tuvala/white, Yuria/green, Grunil/blue — 4 zones each) — the header and border color match the gear color found there, same as in the inventory.</p>
      <p>Every zone guarantees exactly one specific gear piece: helmet/armor/gloves on the tier's first 3 zones, boots on the 4th, and a weapon (main/secondary/awakening) on the <b>last</b> 3 zones — the very first zone of a tier has no guaranteed weapon. Click a zone's 👁 icon to see exactly which one.</p>
      <h3>Velia Treasure (TEST category)</h3>
      <p>All Velia zones can also drop pieces of the <b>Velia Treasure</b> — 4 very rare collectibles (0.5% to 0.00001% per kill), stored in their own 🗺️ inventory tab. Still experimental: no recipe or use yet.</p>
      <h3>Shared world boss</h3>
      <p>The scheduled Kzarka (12:45pm/7:45pm/11:45pm daily, 3:45pm on weekends) now has <b>truly shared HP across all players</b>, exactly like an admin-spawned boss: everyone hits the same HP pool and is visible in the arena.</p>
      <h3>Where to farm an empty slot?</h3>
      <p>Click an <b>empty</b> equipment slot on the paperdoll: the zone(s) that drop that item light up with a gold halo in the zone list, plus a button teleports you there directly. A zone too dangerous for your current gear is never suggested while a safer alternative exists.</p>` },
  { id:'enh', icon:'✦', label:{fr:'Optimisation',en:'Enhancement'},
    fr:`<h3>Enchantement</h3>
      <p>+1 à +7 toujours réussi. <b>+8 à +15</b> sont probabilistes (45% → 5%) et peuvent rétrograder en cas d'échec, mais jamais sous +7.</p>
      <p>Puis <b>PRI/DUO/TRI/TET/PEN</b> suivent des chances fixes (12%/9%/6%/3%/1,2%). À partir de PRI, un échec fait <b>rétrograder d'un palier</b> (ex : DUO → PRI) — mais <b>jamais sous PRI</b> : tu ne retombes plus jamais à +15.</p>
      <p>Pas de failstack caché : ce que tu vois à l'écran est la chance réelle. Chaque pièce a son propre niveau, indépendant.</p>
      <p>La <b>Poussière d'esprit ancien</b> ne sert pas à optimiser directement : c'est un composant pour fabriquer des Pierres de Caphras.</p>
      <p>La <b>Pierre de Cron</b> (1% de drop, 1 à 3 unités, toutes zones) protège d'une rétrogradation en cas d'échec — à toi de décider si tu veux l'utiliser via la case à cocher à côté du matériau chargé, elle n'est plus consommée automatiquement.</p>
      <p>Astuce : clique le petit 🔧 sur une pièce équipée pour charger directement CETTE pièce dans le panneau d'optimisation.</p>`,
    en:`<h3>Enhancement</h3>
      <p>+1 to +7 always succeed. <b>+8 to +15</b> are probabilistic (45% → 5%) and can downgrade on failure, but never below +7.</p>
      <p>Then <b>PRI/DUO/TRI/TET/PEN</b> follow fixed chances (12%/9%/6%/3%/1.2%). From PRI, a failure <b>downgrades one tier</b> (e.g. DUO → PRI) — but <b>never below PRI</b>: you never drop back to +15.</p>
      <p>No hidden failstack: what you see is the real chance. Each piece has its own independent level.</p>
      <p><b>Ancient Spirit Dust</b> isn't used to enhance directly: it's a component to craft Caphras Stones.</p>
      <p>The <b>Cron Stone</b> (1% drop rate, 1 to 3 units, every zone) protects against a downgrade on failure — you decide whether to use it via the checkbox next to the loaded material, it's no longer consumed automatically.</p>
      <p>Tip: click the small 🔧 on an equipped piece to load THAT piece directly into the enhancement panel.</p>` },
  { id:'market', icon:'🏛️', label:{fr:'Marché',en:'Market'},
    fr:`<h3>🚧 BETA — en construction</h3>
      <p>Le Marché est encore <b>peu fonctionnel</b> : attends-toi à des bugs, des changements et des remises à zéro pendant son développement. Ne t'y fie pas encore pour ta progression.</p>
      <h3>Hôtel des ventes</h3>
      <p>Prix fixes fixés par le vendeur, pas d'enchères ni de délai. <b>Aucune taxe de vente</b> (le vrai BDO prend ~30%).</p>
      <h3>Marché commun</h3>
      <p>Les matériaux se vendent à un prix commun flottant, borné par un min/max, qui varie avec l'offre et la demande.</p>`,
    en:`<h3>🚧 BETA — under construction</h3>
      <p>The Market is still <b>not very functional</b>: expect bugs, changes and resets while it's being developed. Don't rely on it for your progress yet.</p>
      <h3>Marketplace</h3>
      <p>Fixed prices set by the seller, no auctions or delay. <b>No sales tax</b> (real BDO takes ~30%).</p>
      <h3>Common market</h3>
      <p>Materials sell at a common floating price, bounded by a min/max, varying with supply and demand.</p>` },
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
    fr:`<h3>Noms & identité visuelle</h3>
      <p>Les noms de zones, monstres et objets sont inspirés de Black Desert Online pour l'ambiance, tout comme certains styles de jeu et mécaniques — ils restent, le cas échéant, la propriété de Pearl Abyss. Les icônes et visuels, eux, sont des créations originales de style fan : ils s'inspirent visuellement du jeu mais ne réutilisent aucun asset réel.</p>
      <p>Black Desert ainsi que toutes les images, illustrations, icônes, noms et données du jeu sont la propriété de Pearl Abyss. Projet de fan non officiel et gratuit, sans aucune affiliation ni partenariat avec Pearl Abyss.</p>`,
    en:`<h3>Names & visual identity</h3>
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
  // Trésor de Velia (catégorie TEST) : dédoublonne les 2 lignes "Bout du trésor de Velia 1" en
  // affichant leurs 2 chances côte à côte plutôt que 2 lignes identiques
  const treasureByName = new Map();
  VELIA_TREASURE.forEach(t => {
    if (!treasureByName.has(t.name)) treasureByName.set(t.name, []);
    treasureByName.get(t.name).push(t.ch);
  });
  const treasures = [...treasureByName.entries()].map(([name, chs]) => {
    const t = VELIA_TREASURE.find(x => x.name === name);
    return { icon:t.icon, name:tr(name), desc:`${LANG==='fr'?'TEST — toutes zones de Velia':'TEST — all Velia zones'} · ${chs.map(fmtTinyPct).join(' / ')}` };
  });
  return `<div class="admSummary">${LANG==='fr'?'Tous les objets actuellement présents dans le jeu.':'All items currently in the game.'}</div>` +
    section(LANG==='fr'?'💎 Bijoux rares':'💎 Rare jewelry', jewels) +
    section(LANG==='fr'?'◈ Matériaux d\'optimisation':'◈ Enhancement materials', mats) +
    section(LANG==='fr'?'✦ Composants de craft':'✦ Crafting components', crafts) +
    section(LANG==='fr'?'🗺️ Trésor de Velia (test)':'🗺️ Velia Treasure (test)', treasures) +
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
  if (tutoBtn) tutoBtn.onclick = () => { $a('infoOverlay').classList.remove('open'); startTutorial(); };
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
    text:{fr:'Une collection à vie : chaque zone visitée et chaque World Boss vaincu (au moins une fois) t\'accorde un bonus PERMANENT et ADDITIF (jamais un multiplicateur).', en:'A lifetime collection: every zone visited and every World Boss defeated (at least once) grants you a PERMANENT, ADDITIVE bonus (never a multiplier).'} },
  { target:'#infoBody .admStatTiles', placement:'bottom',
    title:{fr:'Ta progression globale',en:'Your overall progress'},
    text:{fr:'+1% Vitesse, +1% Dégâts et +1% Esquive pour chaque zone visitée ou boss vaincu — visible ici en un coup d\'œil.', en:'+1% Speed, +1% Damage and +1% Dodge for every zone visited or boss defeated — visible here at a glance.'} },
  { target:'#infoBody .catTabs', placement:'bottom',
    title:{fr:'4 onglets à explorer',en:'4 tabs to explore'},
    text:{fr:'Zones (farm), World Bosses, Maîtrise PEN (suivi pur, sans bonus) et le Sac protégé — chacun a sa propre logique, voir les étapes suivantes.', en:'Zones (farming), World Bosses, PEN Mastery (pure tracking, no bonus) and the Protected bag — each has its own logic, see the next steps.'},
    before: () => { tutCompTabSaved = compendiumTab; compendiumTab = 'zones'; openCompendium(); } },
  { target:'#infoBody .compZoneRow', placement:'top',
    title:{fr:'Une zone, ses objets',en:'A zone, its items'},
    text:{fr:'✓ = objet déjà obtenu au moins une fois. Clique sur un objet pour voir quelles zones le font dropper, puis clique une zone pour y lancer le farm directement (téléportation immédiate, sans confirmation).', en:'✓ = item already obtained at least once. Click an item to see which zones drop it, then click a zone to start farming there right away (instant teleport, no confirmation).'},
    before: () => { compendiumTab = 'zones'; openCompendium(); } },
  { target:'#infoBody .compPenGrid', placement:'top',
    title:{fr:'Maîtrise PEN',en:'PEN Mastery'},
    text:{fr:'Suivi de complétion pur (aucun bonus de stats) : amène chaque pièce d\'équipement et chaque bijou à PEN (niveau max) au moins une fois dans ton inventaire.', en:'Pure completion tracker (no stat bonus): bring every gear piece and every jewel to PEN (max level) at least once in your inventory.'},
    before: () => { compendiumTab = 'pen'; openCompendium(); } },
  { target:'#infoBody .compBagGrid', placement:'top', final:true,
    title:{fr:'Le sac protégé',en:'The protected bag'},
    text:{fr:'Quand "Vendre" s\'apprête à vendre un objet dont ce TYPE n\'a jamais atteint PEN, le 1er exemplaire est protégé ici au lieu d\'être vendu. Tu peux relancer ce tutoriel à tout moment avec le bouton "?" en haut du panneau.', en:'When "Sell" is about to sell an item whose TYPE has never reached PEN, the 1st copy is protected here instead of being sold. You can replay this tutorial anytime with the "?" button at the top of the panel.'},
    before: () => { compendiumTab = 'bag'; openCompendium(); },
    after: () => { compendiumTab = tutCompTabSaved; openCompendium(); } },
];
function startCompendiumTutorial() {
  tutCompTabSaved = compendiumTab;
  startTutorial(COMPENDIUM_TUTORIAL_STEPS, { resetView:false });
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
    by = Math.max(10, Math.min(window.innerHeight-160, by));
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
function startTutorial(steps = TUTORIAL_STEPS, { resetView = true } = {}) {
  activeTutorialSteps = steps;
  if (resetView) { questsPanelOpen = false; $a('infoOverlay').classList.remove('open'); currentActivity = 'zone'; showActivityPage('zone'); }
  tutorialStepIdx = 0;
  $a('tutorialOverlay').classList.add('open');
  showTutorialStep();
  if (!tutorialRafId) tutorialRafId = requestAnimationFrame(tutorialTrackLoop);
}
function endTutorial() {
  leaveTutorialStep();
  tutorialStepIdx = -1;
  $a('tutorialOverlay').classList.remove('open');
}
$a('tutNextBtn').onclick = () => {
  const step = activeTutorialSteps[tutorialStepIdx];
  leaveTutorialStep();
  if (step.final) { endTutorial(); return; }
  tutorialStepIdx++; showTutorialStep();
};
$a('tutSkipBtn').onclick = endTutorial;
$a('tutPrevBtn').onclick = () => {
  if (tutorialStepIdx <= 0) return;
  leaveTutorialStep();
  tutorialStepIdx--; showTutorialStep();
};

// ---------- suivi des patch notes lus ----------
// principe demandé : le tag NEW reste visible pendant TOUTE la session en cours (même après
// avoir défilé dessus), et n'est retiré définitivement qu'à la fermeture de l'onglet — pas avant.
let readPatches = new Set();          // patchs déjà lus lors de sessions PRÉCÉDENTES (persisté)
try { readPatches = new Set(JSON.parse(localStorage.getItem('velia-patch-read') || '[]')); } catch(e) {}
let seenThisSession = new Set();      // patchs vus pendant CETTE session (pas encore persistés)
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
// taxonomie standard adaptée à Velia Idle (les catégories sans équivalent dans ce jeu, ex.
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
  anticheat:'Anti-triche', authentification:'Authentification', comptes:'Comptes',
  serveur:'Serveur', securite:'Correctifs de sécurité',
  maintenance:'Maintenance', infrastructure:'Infrastructure', bdd:'Base de données',
  synchro:'Synchronisation',
  eventTemp:'Événements temporaires', bonusXp:'Bonus XP', bonusDrop:'Bonus Drop',
  cadeaux:'Cadeaux', calendrier:'Calendrier',
  annonces:'Annonces', roadmap:'Feuille de route', prochaines:'Prochaines mises à jour',
  connus:'Problèmes connus', tresors:'Trésors',
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
  anticheat:'Anti-cheat', authentification:'Authentication', comptes:'Accounts',
  serveur:'Server', securite:'Security fixes',
  maintenance:'Maintenance', infrastructure:'Infrastructure', bdd:'Database',
  synchro:'Synchronization',
  eventTemp:'Time-limited events', bonusXp:'XP bonus', bonusDrop:'Drop bonus',
  cadeaux:'Gifts', calendrier:'Calendar',
  annonces:'Announcements', roadmap:'Roadmap', prochaines:'Upcoming updates',
  connus:'Known issues', tresors:'Treasures',
};

let patchObserver = null;
$a('btnPatch').onclick = () => {
  // bandeau "N notes non lues", collé en haut du panneau tant qu'on n'a pas défilé jusqu'à elles
  // (2026-07-06, demande explicite) — calculé AVANT le reste (qui ne change plus ce compte)
  const unreadNow = unreadPatchCount();
  const unreadBannerHtml = `<div id="patchUnreadBanner" class="${unreadNow>0?'show':''}">` +
    `<span id="patchUnreadBannerNum">${unreadNow}</span> ` +
    `<span>${LANG==='fr'?'note(s) de version non lue(s) — clique pour remonter':'unread patch note(s) — click to scroll up'}</span></div>`;
  const html = unreadBannerHtml + PATCH_NOTES.map((p,i) => {
    const isNew = !readPatches.has(p.v); // basé UNIQUEMENT sur les sessions précédentes, pas sur le défilement en cours
    return `
    <div class="patchEntry ${i===0?'latest':''}" data-ver="${p.v}">
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
  }).join('');
  openInfo(LANG === 'fr' ? '📜 Notes de version' : '📜 Patch Notes', html);
  const unreadBannerEl = $a('patchUnreadBanner');
  if (unreadBannerEl) unreadBannerEl.onclick = () => { $a('infoBody').scrollTo({ top:0, behavior:'smooth' }); };

  // reprend le défilement exactement là où CE joueur s'était arrêté (2026-07-06, demande
  // explicite : "rappel toi la ou s'est arrete son scroll... et reprend a cet endroit tout le
  // temps") -- persisté par joueur (localStorage), restauré à CHAQUE ouverture du panneau, pas
  // seulement la première fois de la session. CORRIGÉ le 2026-07-06 (capture à l'appui :
  // "obligé de scroll pour voir les nouvelle update") : s'il reste des notes NON LUES, on ouvre
  // en haut (où elles sont, les plus récentes en premier) plutôt que de forcer la reprise de
  // l'ancienne position, qui les cachait en dessous -- la reprise de position ne s'applique donc
  // qu'une fois qu'il n'y a plus rien de nouveau à voir.
  const body = $a('infoBody');
  if (unreadPatchCount() > 0) {
    requestAnimationFrame(() => { body.scrollTop = 0; });
  } else {
    let savedScroll = 0;
    try { savedScroll = parseInt(localStorage.getItem('velia-patch-scroll')||'0', 10) || 0; } catch(e) {}
    requestAnimationFrame(() => { body.scrollTop = savedScroll; });
  }
  body.onscroll = () => { try { localStorage.setItem('velia-patch-scroll', String(body.scrollTop)); } catch(e) {} };

  // suit ce qui défile RÉELLEMENT dans la fenêtre pour marquer lu (pastille du bouton + pastille
  // en haut de page, voir updatePatchBadge) -- changement du 2026-07-06 (demande explicite) :
  // ouvrir le panneau seul ne marque plus rien lu, contrairement au comportement précédent (voir
  // le commentaire au-dessus d'updatePatchBadge) ; le tag "NEW" par entrée reste affiché toute la
  // session (voir commitPatchRead)
  if (patchObserver) patchObserver.disconnect();
  patchObserver = new IntersectionObserver((entries) => {
    let changed = false;
    for (const entry of entries) if (entry.isIntersecting && !seenThisSession.has(entry.target.dataset.ver)) { seenThisSession.add(entry.target.dataset.ver); changed = true; }
    if (changed) updatePatchBadge();
  }, { root: $a('infoBody'), threshold: 0.6 });
  document.querySelectorAll('.patchEntry').forEach(el => patchObserver.observe(el));

  // comparateur avant/après (2026-07-05, demande explicite) : câblé après insertion du HTML
  $a('infoBody').querySelectorAll('.patchImgBtn').forEach(btn => {
    btn.onclick = () => openPatchImgCompare(btn.dataset.before, btn.dataset.after);
  });
};
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
