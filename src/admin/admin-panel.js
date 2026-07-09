// vérification anti-auto-ban (2026-07-18, demande explicite : "l'admin ne doit jamais pouvoir se
// bannir lui-même par erreur") — fonction PURE, réutilisable telle quelle par un test unitaire
// (pas de dépendance à sb/currentUser à l'intérieur, ceux-ci sont passés en paramètres par
// l'appelant). Retourne false si l'UUID cible est vide OU identique à l'UUID de l'admin connecté.
function canBanUuid(targetUuid, myUuid) {
  return !!targetUuid && targetUuid !== myUuid;
}

// ---------- palette du panneau admin (2026-07-19, demande explicite : "garde toute les couleurs
// et qu'on poura modifier avec un slider") ----------
// ordre = position sur le slider (index). "gold" = thème actuel du jeu (par défaut). Les
// définitions de couleurs vivent dans styles.css (.admThemeRoot[data-adm-theme="..."]) -- ce
// tableau ne sert qu'à peupler le slider et son libellé, jamais les couleurs elles-mêmes.
const ADMIN_THEMES = [
  { id:'gold',    label:{fr:'Or (jeu)',en:'Gold (game)'} },
  { id:'emerald', label:{fr:'Émeraude',en:'Emerald'} },
  { id:'ruby',    label:{fr:'Rubis',en:'Ruby'} },
  { id:'royal',   label:{fr:'Bleu royal',en:'Royal blue'} },
  { id:'violet',  label:{fr:'Violet',en:'Violet'} },
];
const ADMIN_THEME_STORAGE_KEY = 'bdiAdminTheme';
// lit la préférence de palette persistée -- purement locale à ce navigateur/admin, ne touche
// jamais S/le compte (pas une donnée de jeu, pas besoin de sync/migration)
function getAdminTheme() {
  let saved = null;
  try { saved = localStorage.getItem(ADMIN_THEME_STORAGE_KEY); } catch (e) {}
  return ADMIN_THEMES.some(t => t.id === saved) ? saved : 'gold';
}
function setAdminTheme(id) {
  try { localStorage.setItem(ADMIN_THEME_STORAGE_KEY, id); } catch (e) {}
}

// ============================================================
// REFONTE 2026-07-19 : panneau admin plein écran avec sidebar (voir CLAUDE.md pour le contexte).
// Remplace l'ancienne modale à 4 onglets plats par une navigation par sections/catégories,
// pilotée par le registre ADMIN_SECTIONS ci-dessous -- chaque item a soit un render(container)
// (charge ses propres données au clic, jamais tout d'un coup), soit planned:true (emplacement
// réservé Guildes/PvP/Donations -- roadmap confirmée mais aucun code jeu derrière aujourd'hui,
// voir ADMIN_MENU_PLAN.md §0bis). AUCUNE RPC n'est réécrite ici -- uniquement réorganisées.
// ============================================================
const ADMIN_SECTIONS = [
  { cat:'overview', label:{fr:'Vue d\'ensemble',en:'Overview'}, items:[
    { id:'dashboard', icon:'🏠', label:{fr:'Dashboard',en:'Dashboard'}, render:renderAdminDashboard },
  ]},
  { cat:'players', label:{fr:'Joueurs',en:'Players'}, items:[
    { id:'list', icon:'👥', label:{fr:'Liste des joueurs',en:'Player list'}, render:renderAdminPlayerList },
    { id:'target', icon:'🎯', label:{fr:'Joueur précis',en:'Specific player'}, render:renderAdminTargetPlayer },
    { id:'sanctions', icon:'🚫', label:{fr:'Sanctions',en:'Sanctions'}, render:renderAdminSanctions },
    { id:'roles', icon:'🧑‍🤝‍🧑', label:{fr:'Rôles',en:'Roles'}, render:renderAdminRoles },
    { id:'guilds', icon:'👑', label:{fr:'Guildes',en:'Guilds'}, planned:true },
    { id:'pvp', icon:'⚔️', label:{fr:'PvP',en:'PvP'}, planned:true },
  ]},
  { cat:'content', label:{fr:'Contenu',en:'Content'}, items:[
    { id:'boss', icon:'🌍', label:{fr:'Boss mondiaux',en:'World bosses'}, render:renderAdminBoss },
    { id:'zones', icon:'🗾', label:{fr:'Progression par zone',en:'Zone progression'}, render:renderAdminZoneProgression },
    { id:'items', icon:'📦', label:{fr:'Ressources farmées',en:'Farmed resources'}, render:renderAdminItems },
    { id:'cron', icon:'⏳', label:{fr:'Pierres de Cron',en:'Cron Stones'}, render:renderAdminCron },
    { id:'treasure', icon:'🗺️', label:{fr:'Trésor de Velia',en:'Velia Treasure'}, render:renderAdminTreasure },
    { id:'loot', icon:'🎲', label:{fr:'Table de loot',en:'Loot table'}, render:renderAdminLoot },
  ]},
  { cat:'me', label:{fr:'Compte (Moi)',en:'Account (Me)'}, items:[
    { id:'tests', icon:'🧪', label:{fr:'Tests perso',en:'Personal tests'}, render:renderAdminMyTests },
  ]},
  { cat:'system', label:{fr:'Système',en:'System'}, items:[
    { id:'theme', icon:'🎨', label:{fr:'Palette',en:'Palette'}, render:renderAdminTheme },
    { id:'danger', icon:'⚙️', label:{fr:'Zone danger',en:'Danger zone'}, render:renderAdminServerDanger },
  ]},
];

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
  // avertit si le joueur ciblé est EN LIGNE (2026-07-16, demande explicite : "oui averti le
  // joueurs pour le reset" -- suite à la vérification du flux de reset : un joueur connecté garde
  // son ancien état en mémoire et le RÉÉCRIT dans game_saves à la prochaine sauvegarde automatique
  // (30s ou quasi chaque action), annulant silencieusement le reset en quelques secondes) -- ne
  // BLOQUE pas l'action (l'admin peut avoir une bonne raison, ex: bannissement immédiat suivi d'une
  // déconnexion forcée côté Discord), seulement un avertissement renforcé dans la confirmation.
  let online = false;
  try {
    const { data } = await sb.rpc('admin_is_player_online', { p_user_id: uuid, p_window_seconds: 90 });
    online = !!data;
  } catch(e) {}
  const onlineWarn = online
    ? (LANG === 'fr'
        ? '\n\n⚠️ CE JOUEUR EST ACTUELLEMENT EN LIGNE : sa propre sauvegarde automatique (toutes les 30s environ) risque de RÉÉCRIRE son ancien état par-dessus ce reset dans les secondes qui suivent, l\'annulant silencieusement. Pour un reset fiable, attends qu\'il soit déconnecté.'
        : '\n\n⚠️ THIS PLAYER IS CURRENTLY ONLINE: their own autosave (roughly every 30s) may OVERWRITE their old state back over this reset within seconds, silently undoing it. For a reliable reset, wait until they\'re disconnected.')
    : '';
  const msg = (LANG === 'fr'
    ? `🔄 Réinitialiser le compte du joueur ${uuid} (silver, équipement, niveau, sac) ? Un message d'explication lui sera montré à sa prochaine connexion. Action IRRÉVERSIBLE.`
    : `🔄 Reset player ${uuid}'s account (silver, gear, level, bag)? An explanation message will be shown to them on their next login. This action is IRREVERSIBLE.`) + onlineWarn;
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

// ---------- sanctions (ban/mute) — demande explicite du 2026-07-18 : jusqu'ici un joueur toxique
// ne pouvait être que réinitialisé, jamais bloqué. Voir supabase/migrations/20260718140000_sanctions_ban_system.sql
// pour le contrat RPC exact (admin_ban_player/admin_unban_player/admin_list_bans). ----------
const BAN_REASONS = [
  { id:'cheat', label:{fr:'Triche',en:'Cheating'} },
  { id:'exploit', label:{fr:'Exploit',en:'Exploit'} },
  { id:'harassment', label:{fr:'Harcèlement',en:'Harassment'} },
  { id:'other', label:{fr:'Autre',en:'Other'} },
];
const BAN_DURATIONS = [
  { hours:1, label:{fr:'1 heure',en:'1 hour'} },
  { hours:24, label:{fr:'24 heures',en:'24 hours'} },
  { hours:72, label:{fr:'72 heures',en:'72 hours'} },
  { hours:24*7, label:{fr:'7 jours',en:'7 days'} },
  { hours:24*30, label:{fr:'30 jours',en:'30 days'} },
];
// rafraîchit le tableau des bans actifs (suit le même pattern que refreshRoleList : appel RPC,
// regénération complète du HTML, re-branchement des boutons de ligne à chaque appel)
async function refreshBanList() {
  const el = $a('admBanList'); if (!el || !sb) return;
  const { data, error } = await sb.rpc('admin_list_bans');
  if (error) { el.innerHTML = `<div class="admHint">${escapeHtml(error.message)}</div>`; return; }
  const rows = data || [];
  if (!rows.length) { el.innerHTML = `<div class="admEmpty">${LANG==='fr'?'Aucun bannissement actif':'No active bans'}</div>`; return; }
  el.innerHTML = `<table class="admTable">
    <thead><tr><th>${LANG==='fr'?'Joueur':'Player'}</th><th>${LANG==='fr'?'Motif':'Reason'}</th><th>${LANG==='fr'?'Fin du ban':'Ban ends'}</th><th></th></tr></thead>
    <tbody>${rows.map(r => `<tr>
      <td>${escapeHtml(r.pseudo || (r.user_id||'').slice(0,8)+'…')}</td>
      <td>${escapeHtml(r.ban_reason || '—')}</td>
      <td>${r.banned_until ? new Date(r.banned_until).toLocaleString(LANG==='fr'?'fr-FR':'en-US') : '—'}</td>
      <td><button class="admUnbanBtn" data-uuid="${r.user_id}">${LANG==='fr'?'Lever':'Unban'}</button></td>
    </tr>`).join('')}</tbody>
  </table>`;
  el.querySelectorAll('.admUnbanBtn').forEach(btn => {
    btn.onclick = () => unbanPlayer(btn.dataset.uuid);
  });
}
// bannit un joueur par UUID pour une durée choisie avec un motif prédéfini — vérifie D'ABORD
// (canBanUuid) que l'admin ne se bannit pas lui-même par erreur, AVANT tout appel RPC.
async function banPlayerByUuid() {
  if (!isAdmin() || !sb) return;
  const input = $a('admBanUuidInput');
  const uuid = (input.value || '').trim();
  const reasonId = $a('admBanReasonSelect').value;
  const hours = Number($a('admBanDurationSelect').value) || 24;
  const reasonLabel = (BAN_REASONS.find(r => r.id === reasonId) || BAN_REASONS[BAN_REASONS.length-1]).label[LANG];
  if (!canBanUuid(uuid, currentUser && currentUser.id)) {
    floatTxt(P.x, P.y, 100, LANG==='fr' ? 'UUID invalide ou identique au tien — action bloquée' : 'Invalid UUID or same as yours — action blocked', { hurt:true });
    return;
  }
  const msg = LANG === 'fr'
    ? `🚫 Bannir le joueur ${uuid} pour ${hours}h (motif : ${reasonLabel}) ?`
    : `🚫 Ban player ${uuid} for ${hours}h (reason: ${reasonLabel})?`;
  if (!confirm(msg)) return;
  const { error } = await sb.rpc('admin_ban_player', { p_user_id: uuid, p_duration_hours: hours, p_reason: reasonLabel });
  if (error) {
    floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Échec — ' + error.message : 'Failed — ' + error.message, { hurt:true });
    return;
  }
  logToDiscord('🚫 Sanction', `**${myPseudo||'Admin'}** a banni le joueur \`${uuid}\` pour ${hours}h (motif : ${reasonLabel})`, 0xc05545);
  floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Joueur banni ✓' : 'Player banned ✓', { gold:true });
  input.value = '';
  refreshBanList();
}
// lève un ban — appelée par le bouton "Lever" d'une ligne du tableau (admin_list_bans)
async function unbanPlayer(uuid) {
  if (!isAdmin() || !sb || !uuid) return;
  const { error } = await sb.rpc('admin_unban_player', { p_user_id: uuid });
  if (error) {
    floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Échec — ' + error.message : 'Failed — ' + error.message, { hurt:true });
    return;
  }
  logToDiscord('✅ Sanction levée', `**${myPseudo||'Admin'}** a levé le ban du joueur \`${uuid}\``, 0x8fc98a);
  floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Ban levé ✓' : 'Ban lifted ✓', { gold:true });
  refreshBanList();
}
function fmtAdmPlaytime(sec) {
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60);
  return `${h}h${String(m).padStart(2,'0')}`;
}

// panneau unique "Rôles" : fusionne les listes Modérateur et Testeur (2 tables distinctes côté
// serveur, chat_mods et testers) pour que l'admin ajoute/retire les deux rôles au même endroit,
// sur une seule ligne par joueur — demande explicite du 2026-07-07 ("lie les 2 systèmes")
async function refreshRoleList() {
  const el = $a('admRoleList'); if (!el || !sb) return;
  const [{ data: mods, error: modErr }, { data: testers, error: testErr }] = await Promise.all([
    sb.rpc('admin_list_mods'), sb.rpc('admin_list_testers'),
  ]);
  if (modErr || testErr) { el.innerHTML = `<div class="admHint">${escapeHtml((modErr||testErr).message)}</div>`; return; }
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

// table de loot V1/V2 (2026-07-15, demande explicite : "utilise ces valeurs pour le loot des a
// present garde a memoire v1 le loot davant et ça c'est la v2 a tout moment je repasse en v1") --
// S.lootTableVersion pilote gearDropChance/jewelDropChance (game-core.js). Les 2 tables restent
// visibles ici pour comparer, jamais perdues même quand une seule est active.
function buildLootVersionTabHtml() {
  const v = S.lootTableVersion || 'v2';
  const rows = [
    { grade:'grey', label:{fr:'Gris',en:'Grey'} }, { grade:'white', label:{fr:'Blanc',en:'White'} },
    { grade:'green', label:{fr:'Vert',en:'Green'} }, { grade:'blue', label:{fr:'Bleu',en:'Blue'} },
  ];
  const v2Table = `<table class="admTable"><thead><tr><th>${LANG==='fr'?'Palier':'Tier'}</th><th>${LANG==='fr'?'Armure/Arme':'Armor/Weapon'}</th><th>${LANG==='fr'?'Bijou':'Jewel'}</th></tr></thead><tbody>` +
    rows.map(r => `<tr><td>${r.label[LANG]}</td><td>${(LOOT_RATES_V2[r.grade].gear*100).toFixed(2)}%</td><td>${(LOOT_RATES_V2[r.grade].jewel*100).toFixed(3)}%</td></tr>`).join('') +
    `</tbody></table>`;
  return `<div class="admSummary">${LANG==='fr'?'Version active :':'Active version:'} <b>${v.toUpperCase()}</b></div>
    <div class="admActions">
      <button id="btnLootVerV1" class="${v==='v1'?'ready':''}">${LANG==='fr'?'V1 — taux par zone (historique)':'V1 — per-zone rates (legacy)'}</button>
      <button id="btnLootVerV2" class="${v==='v2'?'ready':''}">${LANG==='fr'?'V2 — taux fixe par palier':'V2 — flat per-tier rate'}</button>
    </div>
    <div class="admHint">${LANG==='fr'
      ? 'V1 : chaque zone a son propre taux (décroissant zone après zone, voir GEAR_CHANCE). V2 : un seul taux par palier, appliqué à ses 4 zones. Change instantanément, réversible à tout moment, aucune donnée perdue.'
      : 'V1: each zone has its own rate (decreasing zone after zone, see GEAR_CHANCE). V2: a single rate per tier, applied to its 4 zones. Switches instantly, reversible anytime, no data lost.'}</div>
    <h3>${LANG==='fr'?'📋 Table V2':'📋 V2 table'}</h3>
    ${v2Table}`;
}
function wireLootVersionButtons() {
  const v1Btn = $a('btnLootVerV1'), v2Btn = $a('btnLootVerV2');
  if (v1Btn) v1Btn.onclick = () => { if(!isAdmin())return; S.lootTableVersion = 'v1'; renderAdminLoot($a('adminMainBody')); floatTxt(P.x,P.y,100,'Loot V1',{blue:true}); };
  if (v2Btn) v2Btn.onclick = () => { if(!isAdmin())return; S.lootTableVersion = 'v2'; renderAdminLoot($a('adminMainBody')); floatTxt(P.x,P.y,100,'Loot V2',{gold:true}); };
}
// point d'extension pour admin-economy.js (éditeur de taux en %, ajouté séparément) -- lu au
// moment du RENDU (pas au chargement), donc aucun risque d'ordre de chargement/TDZ : si
// admin-economy.js n'est pas encore chargé (ou n'existe pas), la table reste juste en lecture seule.
function renderAdminLoot(el) {
  el.innerHTML = buildLootVersionTabHtml() + (typeof buildLootRateEditorHtml === 'function' ? buildLootRateEditorHtml() : '');
  wireLootVersionButtons();
  if (typeof wireLootRateEditor === 'function') wireLootRateEditor();
}

// ---------- sections "Contenu" réutilisant les données déjà chargées côté serveur (RPC/tables
// identiques à l'ancien panneau, juste ré-agencées en render(container) indépendants) ----------
function renderAdminItems(el) {
  el.innerHTML = `<div class="admEmpty">${LANG==='fr'?'Chargement…':'Loading…'}</div>`;
  sb.from('admin_farm_by_item').select('*').limit(20).then(({data}) => {
    const rows = data || [];
    const itemHtml = rows.map((r,i) => `
      <tr class="${i===0?'admTop':''}">
        <td>${i===0?'🔥 ':''}${tr(r.item_name)}</td><td>${r.item_kind}</td>
        <td>${fmt(r.pickups)}</td><td>${fmt(r.total_qty)}</td><td>${fmt(r.total_silver)}</td>
      </tr>`).join('') || `<tr><td colspan="5" class="admEmpty">${LANG==='fr'?'Pas encore de données':'No data yet'}</td></tr>`;
    el.innerHTML = `<table class="admTable">
        <thead><tr><th>${LANG==='fr'?'Objet':'Item'}</th><th>${LANG==='fr'?'Type':'Kind'}</th><th>${LANG==='fr'?'Ramassages':'Pickups'}</th><th>Qté</th><th>Silver</th></tr></thead>
        <tbody>${itemHtml}</tbody>
      </table>`;
  });
}
function renderAdminCron(el) {
  el.innerHTML = `<div class="admEmpty">${LANG==='fr'?'Chargement…':'Loading…'}</div>`;
  Promise.all([
    sb.from('admin_farm_by_item').select('*').limit(20),
    sb.from('player_stats').select('user_id'),
  ]).then(([{data: byItem}, {data: playerStats}]) => {
    const naTxt = LANG==='fr' ? 'Hors top 20' : 'Outside top 20';
    const cronRow = (byItem||[]).find(r => r.item_name === CRON_STONE.name);
    const cronTotalQty = cronRow ? Number(cronRow.total_qty||0) : null;
    const cronPickups = cronRow ? Number(cronRow.pickups||0) : null;
    const cronPlayerCount = (playerStats||[]).length;
    const cronAvgPerPlayer = (cronTotalQty != null && cronPlayerCount) ? cronTotalQty/cronPlayerCount : null;
    const CRON_TIER_LABEL = { grey:{fr:'Gris',en:'Grey'}, white:{fr:'Blanc',en:'White'}, green:{fr:'Vert',en:'Green'}, blue:{fr:'Bleu',en:'Blue'} };
    const cronCostRows = Object.entries(CRON_STONE_COST_BY_TIER).map(([grade,cost]) =>
      `<tr><td>${CRON_TIER_LABEL[grade][LANG]}</td><td>${cost}</td></tr>`).join('');
    el.innerHTML = `<div class="admStatTiles">
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'⏳ Farmées (tous joueurs)':'⏳ Farmed (all players)'}</div><div class="astVal">${cronTotalQty!=null?fmt(cronTotalQty):naTxt}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'🎒 Ramassages':'🎒 Pickups'}</div><div class="astVal">${cronPickups!=null?fmt(cronPickups):naTxt}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'📊 Moyenne / joueur':'📊 Average / player'}</div><div class="astVal">${cronAvgPerPlayer!=null?fmt(Math.round(cronAvgPerPlayer)):naTxt}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'🎲 Chance/kill':'🎲 Chance/kill'}</div><div class="astVal">${(CRON_STONE.ch*100).toFixed(1)}%</div></div>
      </div>
      <div class="admHint">${LANG==='fr'
        ? 'Taux de drop FIXE, identique dans toutes les zones du jeu (pas de décroissance par zone comme le trash/matériaux) — 1 à 3 unités par ramassage. Les 3 premières tuiles viennent du même top 20 que "Ressources farmées" : "Hors top 20" si la Pierre de Cron n\'y figure pas encore (volume trop faible face au trash).'
        : 'FIXED drop rate, identical in every zone of the game (no per-zone decay like trash/materials) — 1 to 3 units per pickup. The first 3 tiles come from the same top 20 as "Farmed resources": "Outside top 20" if the Cron Stone isn\'t in it yet (too little volume next to trash).'}</div>
      <h3>${LANG==='fr'?'💎 Coût par palier de la pièce protégée':'💎 Cost by tier of the protected piece'}</h3>
      <table class="admTable">
        <thead><tr><th>${LANG==='fr'?'Palier':'Tier'}</th><th>${LANG==='fr'?'Coût':'Cost'}</th></tr></thead>
        <tbody>${cronCostRows}</tbody>
      </table>`;
  });
}
function renderAdminTreasure(el) {
  el.innerHTML = `<div class="admSummary">${LANG==='fr'
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
    </table>`;
}
// ---------- section "Contenu → Progression par zone" (NOUVEAU, 2026-07-19, demande explicite :
// "ajoute et modifie ce qui te semble manquant comme stats") -- best_zone_index (player_stats,
// bornage anti-triche déjà en place, voir clamp_player_stats côté SQL) n'était affiché nulle part
// dans l'admin ; permet de voir où les joueurs progressent réellement dans le contenu, pas juste
// leur richesse. Même politique select-all déjà utilisée ailleurs dans ce fichier pour player_stats
// (ex: playtimeByUser) -- aucune nouvelle RPC nécessaire, lecture directe.
// camembert (2026-07-19) + complément "Répartition par Gearscore" (demande explicite : "ajoute
// en si necessaire") -- déjà dans la même requête player_stats, aucun coût réseau supplémentaire.
// buildPieWithLegendHtml vient de admin-economy.js (chargé APRÈS ce fichier) -- appelé seulement
// au clic sur la section, bien après le chargement des deux fichiers : aucun risque de TDZ, même
// pattern que le hook buildLootRateEditorHtml() de renderAdminLoot() ci-dessus.
function renderAdminZoneProgression(el) {
  el.innerHTML = `<div class="admEmpty">${LANG==='fr'?'Chargement…':'Loading…'}</div>`;
  sb.from('player_stats').select('best_zone_index, gearscore').then(({data}) => {
    const zoneCounts = new Map();
    (data||[]).forEach(r => {
      const zi = Number(r.best_zone_index||0);
      zoneCounts.set(zi, (zoneCounts.get(zi)||0) + 1);
    });
    const zoneItems = [...zoneCounts.entries()].sort((a,b) => a[0]-b[0]).map(([zi, cnt]) => {
      const zone = ZONES[zi];
      return { label: zone ? tr(zone.name) : `#${zi}`, value: cnt };
    });
    const GS_BRACKETS = [
      { max:100, label:'< 100' }, { max:300, label:'100-300' }, { max:600, label:'300-600' },
      { max:1200, label:'600-1200' }, { max:Infinity, label:'1200+' },
    ];
    const gsCounts = GS_BRACKETS.map(() => 0);
    (data||[]).forEach(r => {
      const gs = Number(r.gearscore||0);
      const idx = GS_BRACKETS.findIndex(b => gs < b.max);
      gsCounts[idx >= 0 ? idx : GS_BRACKETS.length-1]++;
    });
    const gsItems = GS_BRACKETS.map((b,i) => ({ label:b.label, value:gsCounts[i] }));
    const zonePie = typeof buildPieWithLegendHtml === 'function' ? buildPieWithLegendHtml(zoneItems) : `<div class="admEmpty">${LANG==='fr'?'Graphique indisponible':'Chart unavailable'}</div>`;
    const gsPie = typeof buildPieWithLegendHtml === 'function' ? buildPieWithLegendHtml(gsItems, { thresholdPct:0, formatValue: v => String(Math.round(v)) }) : '';
    el.innerHTML = `<div class="admSummary">${LANG==='fr'
      ? 'Zone la plus avancée atteinte par chaque joueur (best_zone_index, borné côté anti-triche) — pas la zone farmée maintenant. Catégories sous 4% fusionnées dans "Autres".'
      : 'Furthest zone reached by each player (best_zone_index, anti-cheat bounded) — not the zone currently being farmed. Categories under 4% merged into "Other".'}</div>
      <div class="admChartsRow">
        <div><h3 style="margin-top:0">${LANG==='fr'?'🗾 Par zone':'🗾 By zone'}</h3>${zonePie}</div>
        <div><h3 style="margin-top:0">${LANG==='fr'?'⚔️ Par Gearscore':'⚔️ By Gearscore'}</h3>${gsPie}</div>
      </div>`;
  });
}

// ---------- section "Vue d'ensemble" — dashboard synthétique (NOUVEAU, 2026-07-19) ----------
function renderAdminDashboard(el) {
  el.innerHTML = `<div class="admEmpty">${LANG==='fr'?'Chargement…':'Loading…'}</div>`;
  Promise.all([
    sb.rpc('admin_list_players'),
    sb.from('admin_wealth').select('silver'),
    sb.rpc('admin_list_bans'),
    sb.rpc('get_market_open'),
  ]).then(([{data: players}, {data: wealth}, {data: bans}, {data: marketOpen}]) => {
    const online = (players||[]).filter(p => p.online).length;
    const totalSilver = (wealth||[]).reduce((a,r) => a + Number(r.silver||0), 0);
    const activeBans = (bans||[]).length;
    const open = marketOpen !== false;
    el.innerHTML = `<div class="admStatTiles">
        <div class="admStatTile"><div class="astLbl">🟢 ${LANG==='fr'?'Joueurs en ligne':'Players online'}</div><div class="astVal">${online}</div></div>
        <div class="admStatTile"><div class="astLbl">🏦 ${LANG==='fr'?'Silver total en jeu':'Total silver in game'}</div><div class="astVal">${fmt(totalSilver)}</div></div>
        <div class="admStatTile"><div class="astLbl">🚫 ${LANG==='fr'?'Bannissements actifs':'Active bans'}</div><div class="astVal">${activeBans}</div></div>
        <div class="admStatTile"><div class="astLbl">🏛️ ${LANG==='fr'?'Marché':'Market'}</div><div class="astVal" style="${open?'':'color:var(--danger)'}">${open?(LANG==='fr'?'Ouvert':'Open'):(LANG==='fr'?'Fermé':'Closed')}</div></div>
      </div>
      <div class="admHint">${LANG==='fr'?'Vue d\'ensemble rapide — pour le détail, utilise les sections de la sidebar.':'Quick overview — for details, use the sidebar sections.'}</div>`;
  });
}

// ---------- section "Joueurs" ----------
function renderAdminPlayerList(el) {
  el.innerHTML = `<div class="admEmpty">${LANG==='fr'?'Chargement…':'Loading…'}</div>`;
  sb.rpc('admin_list_players').then(({data: playersList}) => {
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
    el.innerHTML = `<div class="admSummary">${LANG==='fr'?`${(playersList||[]).filter(p=>p.online).length} en ligne · ${(playersList||[]).length} inscrits`:`${(playersList||[]).filter(p=>p.online).length} online · ${(playersList||[]).length} registered`}</div>
      <table class="admTable">
        <thead><tr><th></th><th>${LANG==='fr'?'Joueur':'Player'}</th><th>Silver</th><th>GS</th><th title="${LANG==='fr'?'PA':'AP'}">PA</th><th title="${LANG==='fr'?'PD':'DP'}">PD</th><th>Niv.</th><th title="${LANG==='fr'?'Record kills/min':'Kills/min record'}">🏹</th><th></th><th></th></tr></thead>
        <tbody>${playersHtml}</tbody>
      </table>`;
    el.querySelectorAll('.admUuidBtn').forEach(btn => {
      btn.onclick = async e => {
        e.stopPropagation();
        try { await navigator.clipboard.writeText(btn.dataset.uuid); } catch(e) {}
        floatTxt(P.x, P.y, 100, LANG==='fr'?'UUID copié ✓':'UUID copied ✓', { gold:true });
      };
    });
    el.querySelectorAll('.admInvBtn').forEach(btn => {
      btn.onclick = e => { e.stopPropagation(); showPlayerInventoryWindow(btn.dataset.uuid, btn.dataset.name); };
    });
  });
}
function renderAdminTargetPlayer(el) {
  el.innerHTML = `
    <div class="admSection riskSingle">
      <div class="admSectionTitle">🎯 ${LANG==='fr'?'Un joueur précis — par UUID':'A specific player — by UUID'}</div>
      <div class="admSectionSub">⚠️ ${LANG==='fr'?'Efface silver/équipement/niveau/sac de CE joueur uniquement.':'Wipes silver/gear/level/bag for THAT player only.'}</div>
      <div class="admActions">
        <input type="text" id="admResetUuidInput" placeholder="${LANG==='fr'?'UUID du joueur':'Player UUID'}" style="width:230px">
        <button id="btnScreenshotPlayer">📸 ${LANG==='fr'?'Screenshot':'Screenshot'}</button>
        <button id="btnResetAccountByUuid" style="border-color:var(--danger);color:#e8a89f">🔄 ${LANG==='fr'?'Réinitialiser ce joueur':'Reset this player'}</button>
      </div>
      <div class="admHint">${LANG==='fr'?'Trouve l\'UUID d\'un joueur via le Classement ou ses messages en jeu (bouton "Copier UUID" dans son propre menu). "Screenshot" affiche son équipement/inventaire en lecture seule (aucune modification). Le reset envoie le même message d\'explication que le reset global, mais montré UNIQUEMENT à ce joueur.':'Find a player\'s UUID via the Leaderboard or their in-game messages (the "Copy UUID" button in their own menu). "Screenshot" shows their gear/inventory read-only (no changes made). The reset sends the same explanation message as the global reset, but shown ONLY to that player.'}</div>
    </div>`;
  $a('btnScreenshotPlayer').onclick = adminScreenshotPlayer;
  $a('btnResetAccountByUuid').onclick = resetAccountByUuid;
}
function renderAdminSanctions(el) {
  el.innerHTML = `
    <div class="admSection">
      <div class="admSectionTitle">🚫 ${LANG==='fr'?'Bannir un joueur':'Ban a player'}</div>
      <div class="admSectionSub">${LANG==='fr'?'Bloque temporairement l\'accès au jeu pour ce joueur (durée + motif prédéfini).':'Temporarily blocks game access for this player (duration + predefined reason).'}</div>
      <div class="admActions">
        <input type="text" id="admBanUuidInput" placeholder="${LANG==='fr'?'UUID du joueur':'Player UUID'}" style="width:230px">
        <select id="admBanReasonSelect">${BAN_REASONS.map(r => `<option value="${r.id}">${r.label[LANG]}</option>`).join('')}</select>
        <select id="admBanDurationSelect">${BAN_DURATIONS.map(d => `<option value="${d.hours}"${d.hours===24?' selected':''}>${d.label[LANG]}</option>`).join('')}</select>
        <button id="btnBanPlayer" style="border-color:var(--danger);color:#e8a89f">🚫 ${LANG==='fr'?'Bannir':'Ban'}</button>
      </div>
      <div class="admHint warn">${LANG==='fr'
        ? 'L\'admin ne peut jamais se bannir lui-même (vérifié côté client avant l\'appel serveur). Trouve l\'UUID via le Classement ou la section Joueurs.'
        : 'The admin can never ban themselves (checked client-side before the server call). Find the UUID via the Leaderboard or the Players section.'}</div>
    </div>
    <div class="admSection">
      <div class="admSectionTitle">📋 ${LANG==='fr'?'Bannissements actifs':'Active bans'}</div>
      <div id="admBanList"><div class="admEmpty">${LANG==='fr'?'Chargement…':'Loading…'}</div></div>
    </div>`;
  $a('btnBanPlayer').onclick = banPlayerByUuid;
  refreshBanList();
}
function renderAdminRoles(el) {
  el.innerHTML = `
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
    </div>`;
  $a('btnAddRole').onclick = async () => {
    if (!isAdmin() || !sb) return;
    const uuid = $a('admRoleUuid').value.trim(); if (!uuid) return;
    const role = $a('admRoleSelect').value;
    const rpc = role === 'mod' ? 'admin_add_mod' : 'admin_add_tester';
    const { error } = await sb.rpc(rpc, { p_user_id: uuid });
    if (error) { $a('admRoleList').insertAdjacentHTML('afterbegin', `<div class="admHint">${escapeHtml(error.message)}</div>`); return; }
    logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a ajouté le rôle ${role==='mod'?'Modérateur':'Testeur'} à \`${uuid}\``, 0x9cc9e8);
    $a('admRoleUuid').value = ''; refreshRoleList();
  };
  refreshRoleList();
}

// ---------- section "Contenu → Boss mondiaux" (gestion globale — spawn/despawn pour TOUS) ----------
// spawn un VRAI boss partagé (PV communs, top10, contribution %, joueurs en direct) — utilisé à la
// fois par le test perso admin (Compte→Tests) et par le lancement pour tous, pour que le test admin
// ressemble exactement au vrai boss multijoueurs (demande explicite : "pas un boss solo")
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
function renderAdminBoss(el) {
  const bossOptions = Object.keys(BOSS_ROSTER).map(id => `<option value="${id}">${BOSS_ROSTER[id].icon} ${BOSS_ROSTER[id].short[LANG]}</option>`).join('');
  el.innerHTML = `
    <div class="admSection riskGlobal">
      <div class="admSectionTitle">🌍 ${LANG==='fr'?'Lancer un boss pour TOUS':'Launch a boss for ALL'}</div>
      <div class="admSectionSub">⚠️ ${LANG==='fr'?'Danger : ces actions touchent TOUS les joueurs connectés.':'Danger: these actions affect ALL connected players.'}</div>
      <div class="admBossSpawn">
        <span>${LANG==='fr'?'🌍 Boss :':'🌍 Boss:'}</span>
        <select id="admGlobalBossSelect">${bossOptions}</select>
        <select id="admBossDurationSelect">
          ${[2,3,4,5,6,7].map(m => `<option value="${m}"${m===4?' selected':''}>${LANG==='fr'?`~${m} min à tuer`:`~${m} min to kill`}</option>`).join('')}
        </select>
        <button id="btnAdmSpawnGlobal">${LANG==='fr'?'Lancer (9 min)':'Launch (9 min)'}</button>
        <button id="btnAdmDespawnBoss">🛑 ${LANG==='fr'?'Faire disparaître':'Despawn'}</button>
      </div>
      <div class="admHint">${LANG==='fr'?'Les PV sont calculés selon le nombre de joueurs en ligne pour viser la durée choisie (la durée réelle dépendra du stuff et du nombre de participants réels). Le boss disparaît de toute façon au bout de 9 minutes.':'HP is calculated from current online players to target the chosen duration (actual time will depend on gear and real participation). The boss despawns after 9 minutes regardless.'}</div>
    </div>`;
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
}

// ---------- section "Compte (Moi)" ----------
function renderAdminMyTests(el) {
  const bossOptions = Object.keys(BOSS_ROSTER).map(id => `<option value="${id}">${BOSS_ROSTER[id].icon} ${BOSS_ROSTER[id].short[LANG]}</option>`).join('');
  el.innerHTML = `
    <div class="admSection riskSafe">
      <div class="admSectionTitle">👤 ${LANG==='fr'?'Pour moi — test sur mon compte':'For me — test on my account'}</div>
      <div class="admSectionSub">${LANG==='fr'?'Sans danger : ça ne touche que TON propre personnage.':'Safe: only affects YOUR own character.'}</div>
      <div class="admActions">
        <button id="btnTestSilver">💰 +1M silver</button>
        <button id="btnTestLoyalty">📬 +200 Loyalties</button>
        <button id="btnTestAch">🏅 ${LANG==='fr'?'Débloquer tous les succès':'Unlock all achievements'}</button>
        <button id="btnResetMyQuests">🔄 ${LANG==='fr'?'Réinitialiser mes quêtes':'Reset my quests'}</button>
        <button id="btnResetDemo">🔄 ${LANG==='fr'?'Réinitialiser la démo':'Reset the demo'}</button>
      </div>
      <div class="admBossSpawn">
        <span>${LANG==='fr'?'⚔️ Combattre un World Boss :':'⚔️ Fight a World Boss:'}</span>
        <select id="admBossSelect">${bossOptions}</select>
        <button id="btnAdmSpawnBoss">${LANG==='fr'?'Combattre maintenant':'Fight now'}</button>
      </div>
      <div class="admHint">${LANG==='fr'?'Lance un vrai boss partagé (PV communs) rien que pour toi, pour tester sans attendre le planning ni prévenir personne.':'Spawns a real shared boss (common HP) just for you, to test without waiting for the schedule or notifying anyone.'}</div>
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
    if (!ok) { floatTxt(P.x, P.y, 100, LANG==='fr'?'Échec du lancement':'Failed to launch', { hurt:true }); return; }
    closeAdminPanel();
    startBossFight(id, true); // true = rejoint le boss PARTAGÉ qu'on vient de lancer (PV communs, top10...)
  };
}

// ---------- section "Système" ----------
function renderAdminTheme(el) {
  const currentTheme = getAdminTheme();
  const themeIdx = Math.max(0, ADMIN_THEMES.findIndex(t => t.id === currentTheme));
  el.innerHTML = `
    <div class="admThemeSlider">
      <label for="admThemeSlider">🎨 ${LANG==='fr'?'Palette':'Palette'}</label>
      <input type="range" id="admThemeSlider" min="0" max="${ADMIN_THEMES.length-1}" step="1" value="${themeIdx}">
      <span class="admThemeName" id="admThemeName">${ADMIN_THEMES[themeIdx].label[LANG]}</span>
    </div>
    <div class="admHint">${LANG==='fr'?'Change instantanément la couleur d\'accent de tout le panneau admin (thème persisté sur ce navigateur, aucun effet joueur).':'Instantly changes the accent color of the whole admin panel (theme persisted on this browser, no player effect).'}</div>`;
  const themeSlider = $a('admThemeSlider');
  themeSlider.oninput = () => {
    const t = ADMIN_THEMES[Number(themeSlider.value)] || ADMIN_THEMES[0];
    const root = $a('adminOverlay');
    if (root) root.dataset.admTheme = t.id;
    const nameEl = $a('admThemeName'); if (nameEl) nameEl.textContent = t.label[LANG];
    setAdminTheme(t.id);
  };
}
function renderAdminServerDanger(el) {
  el.innerHTML = `
    <div class="admSection riskGlobal">
      <div class="admSectionTitle">🌍 ${LANG==='fr'?'Pour les joueurs — actions serveur':'For players — server-wide'}</div>
      <div class="admSectionSub">⚠️ ${LANG==='fr'?'Danger : ces actions touchent TOUS les joueurs connectés.':'Danger: these actions affect ALL connected players.'}</div>
      <div class="admActions">
        <button id="btnResetAllQuests">⚠️ ${LANG==='fr'?'Réinitialiser les quêtes de tous':'Reset everyone\'s quests'}</button>
        <button id="btnResetAllAccounts" style="border-color:var(--danger);color:#e8a89f">💥 ${LANG==='fr'?'Réinitialiser TOUS les comptes':'Reset ALL accounts'}</button>
      </div>
      <div class="admHint warn">${LANG==='fr'?'"Réinitialiser TOUS les comptes" efface silver/équipement/niveau/sac de TOUT LE MONDE et affiche un message d\'explication à chaque joueur à sa prochaine connexion. Irréversible.':'"Reset ALL accounts" wipes silver/gear/level/bag for EVERYONE and shows an explanation message to each player on their next login. Irreversible.'}</div>
    </div>`;
  $a('btnResetAllQuests').onclick = resetAllQuests;
  $a('btnResetAllAccounts').onclick = resetAllAccounts;
}

// ============================================================
// SHELL : ouverture/fermeture du panneau, sidebar pilotée par ADMIN_SECTIONS
// ============================================================
function closeAdminPanel() {
  const overlay = $a('adminOverlay'); if (overlay) overlay.classList.remove('open');
}
function renderAdminSidebar(activeCat, activeId) {
  return ADMIN_SECTIONS.map(group => `
    <div class="admNavCatLabel">${group.label[LANG]}</div>
    ${group.items.map(item => `
      <div class="admNavItem${activeCat===group.cat&&activeId===item.id?' active':''}${item.planned?' planned':''}" data-cat="${group.cat}" data-id="${item.id}">
        <span class="admNavIcon">${item.icon}</span><span>${item.label[LANG]}</span>
        ${item.planned?`<span class="admNavBadge">${LANG==='fr'?'🔜 prévu':'🔜 planned'}</span>`:''}
      </div>`).join('')}
  `).join('');
}
function findAdminSection(cat, id) {
  const group = ADMIN_SECTIONS.find(g => g.cat === cat);
  return group ? group.items.find(i => i.id === id) : null;
}
function openAdminSection(cat, id) {
  const item = findAdminSection(cat, id);
  if (!item) return;
  $a('adminSidebar').querySelectorAll('.admNavItem').forEach(el => {
    el.classList.toggle('active', el.dataset.cat === cat && el.dataset.id === id);
  });
  $a('adminMainHead').textContent = item.icon + ' ' + item.label[LANG];
  const body = $a('adminMainBody');
  if (item.planned) {
    body.innerHTML = `<div class="admPlannedPane"><div class="admPlannedIcon">🔜</div>
      ${LANG==='fr'
        ? 'Prévu sur la roadmap, mais aucun code jeu derrière pour l\'instant (pas de table, pas de mécanique côté client). Cet onglet deviendra utile une fois qu\'une première brique réelle existera — voir ADMIN_MENU_PLAN.md.'
        : 'On the roadmap, but no game code behind it yet (no table, no client-side mechanic). This tab becomes useful once a first real piece exists — see ADMIN_MENU_PLAN.md.'}</div>`;
    return;
  }
  item.render(body);
}
async function openAdminPanel() {
  if (!isAdmin() || !sb) return;
  const currentTheme = getAdminTheme();
  const overlay = $a('adminOverlay');
  overlay.classList.add('admThemeRoot');
  overlay.dataset.admTheme = currentTheme;
  $a('adminMainHead').innerHTML = `<span style="flex:1">🛠️ ${LANG==='fr'?'Zone Admin':'Admin Zone'}</span><button id="closeAdmin">✕</button>`;
  $a('closeAdmin').onclick = closeAdminPanel;
  $a('adminSidebar').innerHTML = `<div class="admNavHead"><span class="admNavTitle">🛠️ ${LANG==='fr'?'Admin':'Admin'}</span></div>` + renderAdminSidebar('overview', 'dashboard');
  $a('adminSidebar').querySelectorAll('.admNavItem').forEach(el => {
    el.onclick = () => openAdminSection(el.dataset.cat, el.dataset.id);
  });
  overlay.classList.add('open');
  openAdminSection('overview', 'dashboard');
}
$a('btnAdmin').onclick = openAdminPanel;

// panneau Testeur : accès aux fonctionnalités en avant-première, sans aucun avantage de jeu.
// Pour l'instant, contenu limité (pêche/mine/etc. pas encore développés) — le panneau existe et
// se remplira au fur et à mesure des nouveautés à tester. Reste sur l'ancienne modale (openInfo) :
// c'est un panneau JOUEUR (myIsTester), pas admin, pas concerné par la refonte de la sidebar.
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
      ? 'Merci de tester Black Desert Idle ! Ce panneau te donnera accès aux nouveautés en avant-première (sans aucun avantage en jeu — c\'est du test pur). Rien à tester pour l\'instant, mais voici ce qui arrive :'
      : 'Thanks for testing Black Desert Idle! This panel gives you early access to new features (no in-game advantage — pure testing). Nothing to test yet, but here\'s what\'s coming:'}</div>` +
    list);
}
$a('btnTester').onclick = openTesterPanel;
