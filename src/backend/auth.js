// ============================================================
// AUTHENTIFICATION (email + Discord/Google/GitHub/Twitter, magic link, recovery) + BOOT
// ============================================================
// Extrait de game-supabase.js le 2026-07-22 (2e vague, apres P5). Le fichier restait a 1341 lignes
// apres les cuts presence/account ; l'auth etait le dernier gros domaine borne.
//
// CHARGE EN DERNIER, et c'est structurel : ce fichier contient le POINT D'ENTREE de l'appli
// (l'IIFE de fin qui fait sb.auth.getSession() -> onAuthed / startGuestOrShowAuth). Il doit tourner
// une fois que TOUT le reste est defini -- game-supabase (sb, loadCloudSave, saveToCloud),
// presence (refreshPresenceSnapshot appele par onAuthedInner), les panneaux, etc.
//
// Pourquoi le cablage des boutons est ICI et pas dans game-supabase : il lit AUTH_MODES/setAuthMode
// AU CHARGEMENT. S'il etait reste dans game-supabase (charge avant auth.js), ces symboles seraient
// indefinis -- exactement le bug btnClearCacheAuth de P5. En le gardant avec les definitions, le
// probleme ne peut pas exister. Verifie : aucun autre fichier ne reference un symbole auth au
// chargement (game-supabase restant, ni les 8 fichiers charges entre les deux).

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

// ---------- cablage des boutons + point d'entree ----------
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
// La flèche n'est pas cosmétique (2026-07-22, découpage P5) : clearGameCache() vit maintenant dans
// backend/client-health.js, chargé APRÈS ce fichier. Les autres boutons juste au-dessus référencent
// des fonctions de CE fichier, donc `= doSignInDiscord` marche ; ici `= clearGameCache` lisait la
// variable AU CHARGEMENT, avant que le script qui la déclare n'ait tourné -> ReferenceError, qui
// tuait au passage tout le reste du fichier (btnLogoutTopbar juste en dessous n'était plus câblé).
// Le hoisting des `function` est PAR SCRIPT, pas global : en dev les 7 fichiers s'exécutent
// séparément. La flèche repousse la résolution au clic, quand tous les scripts ont tourné.
$a('btnClearCacheAuth').onclick = () => clearGameCache();
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
