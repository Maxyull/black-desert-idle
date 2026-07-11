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
// voir docs/ADMIN_MENU_PLAN.md §0bis). AUCUNE RPC n'est réécrite ici -- uniquement réorganisées.
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
    { id:'reconnect', icon:'🔄', label:{fr:'Reconnexion',en:'Reconnect'}, render:renderAdminReconnect },
    { id:'guilds', icon:'👑', label:{fr:'Guildes',en:'Guilds'}, planned:true },
    { id:'pvp', icon:'⚔️', label:{fr:'PvP',en:'PvP'}, planned:true },
  ]},
  { cat:'content', label:{fr:'Contenu',en:'Content'}, items:[
    { id:'boss', icon:'🌍', label:{fr:'Boss mondiaux',en:'World bosses'}, render:renderAdminBoss },
    { id:'zones', icon:'🗾', label:{fr:'Progression par zone',en:'Zone progression'}, render:renderAdminZoneProgression },
    { id:'compendium', icon:'📖', label:{fr:'Compendium',en:'Compendium'}, render:renderAdminCompendium },
    { id:'items', icon:'📦', label:{fr:'Ressources farmées',en:'Farmed resources'}, render:renderAdminItems },
    { id:'cron', icon:'⏳', label:{fr:'Pierres de Cron',en:'Cron Stones'}, render:renderAdminCron },
    { id:'treasure', icon:'🗺️', label:{fr:'Trésor de Velia',en:'Velia Treasure'}, render:renderAdminTreasure },
    { id:'loot', icon:'🎲', label:{fr:'Table de loot',en:'Loot table'}, render:renderAdminLoot },
    { id:'tutorials', icon:'🎓', label:{fr:'Tutoriels d\'objets',en:'Item tutorials'}, render:renderAdminItemTutorials },
    { id:'onboarding', icon:'🧭', label:{fr:'Onboarding',en:'Onboarding'}, render:renderAdminOnboarding },
    { id:'companions', icon:'🐾', label:{fr:'Compagnons',en:'Companions'}, render:renderAdminCompanions },
    { id:'patchnotes', icon:'📜', label:{fr:'Notes de version → Discord',en:'Patch notes → Discord'}, render:renderAdminPatchNotesDiscord },
    { id:'patchnotesmod', icon:'🚩', label:{fr:'Notes de version : modération',en:'Patch notes: moderation'}, render:renderAdminPatchNotesModeration },
  ]},
  { cat:'me', label:{fr:'Compte (Moi)',en:'Account (Me)'}, items:[
    { id:'tests', icon:'🧪', label:{fr:'Tests perso',en:'Personal tests'}, render:renderAdminMyTests },
  ]},
  { cat:'system', label:{fr:'Système',en:'System'}, items:[
    { id:'danger', icon:'⚙️', label:{fr:'Zone danger',en:'Danger zone'}, render:renderAdminServerDanger },
  ]},
];

// ---------- réinitialisation de la démo (réservée à l'admin, à tout moment) ----------
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
async function adminScreenshotPlayer() {
  if (!isAdmin() || !sb) return;
  const uuid = ($a('admResetUuidInput').value || '').trim();
  if (!uuid) return;
  const { data, error } = await sb.rpc('admin_get_player_save', { p_user_id: uuid });
  if (error) { floatTxt(P.x, P.y, 100, i18next.t('admin:admin.common.failed_prefix') + error.message, { hurt:true }); return; }
  if (!data) { floatTxt(P.x, P.y, 100, i18next.t('admin:admin.reset.no_save_for_uuid'), { hurt:true }); return; }
  openInfo(i18next.t('admin:admin.reset.screenshot_title_prefix') + escapeHtml(data._pseudo||'?'), renderAdminScreenshotHtml(data));
}
function renderAdminScreenshotHtml(save) {
  const s = save.S || {};
  const eq = save.EQUIP || {};
  const inv = (save.INV || []).filter(Boolean);
  const zone = ZONES[save.zoneIdx];
  const zoneName = zone ? tr(zone.name) : i18next.t('admin:admin.reset.default_zone_name');
  const eqRows = Object.entries(eq).filter(([,v]) => v).map(([slot,it]) => {
    const lvl = it.optimizable ? (ENH_NAMES[it.enhLv||0] || '+0') : '';
    return `<div class="row"><span>${it.icon||'▪'} ${SLOT_LABEL[slot]||slot}</span><span class="v">${escapeHtml(it.name)}${lvl?' ('+lvl+')':''}</span></div>`;
  }).join('') || `<div class="admEmpty">${i18next.t('admin:admin.reset.no_gear')}</div>`;
  const invRows = inv.map(it =>
    `<div class="row"><span>${it.icon||'▪'} ${escapeHtml(it.name)}</span><span class="v">${it.stackable ? 'x'+it.qty : (it.optimizable ? (ENH_NAMES[it.enhLv||0]||'+0') : '')}</span></div>`
  ).join('') || `<div class="admEmpty">${i18next.t('admin:admin.reset.empty_bag')}</div>`;
  return `
    <div class="admStatTiles">
      <div class="admStatTile"><div class="astLbl">${i18next.t('admin:admin.reset.stat_level')}</div><div class="astVal">${s.lvl||1}</div></div>
      <div class="admStatTile"><div class="astLbl">${i18next.t('admin:admin.reset.stat_silver')}</div><div class="astVal">${fmt(Math.round(s.silver||0))}</div></div>
      <div class="admStatTile"><div class="astLbl">${i18next.t('admin:admin.reset.stat_zone')}</div><div class="astVal">${escapeHtml(zoneName)}</div></div>
    </div>
    <div class="admSummary">${i18next.t('admin:admin.reset.saved_on')} ${save.savedAt ? new Date(save.savedAt).toLocaleString(LANG==='fr'?'fr-FR':'en-US') : '—'}</div>
    <h3>${i18next.t('admin:admin.reset.section_equipment')}</h3>${eqRows}
    <h3>${i18next.t('admin:admin.reset.section_inventory')} (${inv.length}/${INV_SIZE})</h3>${invRows}
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
    ? i18next.t('admin:admin.reset.online_warn')
    : '';
  const msg = i18next.t('admin:admin.reset.confirm_reset_uuid', { uuid }) + onlineWarn;
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
    floatTxt(P.x, P.y, 100, i18next.t('admin:admin.common.failed_prefix') + error.message, { hurt:true });
    return;
  }
  if (!data) {
    floatTxt(P.x, P.y, 100, i18next.t('admin:admin.reset.no_player_for_uuid'), { hurt:true });
    return;
  }
  logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a réinitialisé le compte du joueur \`${uuid}\``, 0xc05545);
  floatTxt(P.x, P.y, 100, i18next.t('admin:admin.reset.toast_account_reset'), { gold:true });
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
  if (!rows.length) { el.innerHTML = `<div class="admEmpty">${i18next.t('admin:admin.sanctions.no_active_bans')}</div>`; return; }
  el.innerHTML = `<table class="admTable">
    <thead><tr><th>${i18next.t('admin:admin.sanctions.table_player')}</th><th>${i18next.t('admin:admin.sanctions.table_reason')}</th><th>${i18next.t('admin:admin.sanctions.table_ban_ends')}</th><th></th></tr></thead>
    <tbody>${rows.map(r => `<tr>
      <td>${escapeHtml(r.pseudo || (r.user_id||'').slice(0,8)+'…')}</td>
      <td>${escapeHtml(r.ban_reason || '—')}</td>
      <td>${r.banned_until ? new Date(r.banned_until).toLocaleString(LANG==='fr'?'fr-FR':'en-US') : '—'}</td>
      <td><button class="admUnbanBtn" data-uuid="${r.user_id}">${i18next.t('admin:admin.sanctions.unban_btn')}</button></td>
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
    floatTxt(P.x, P.y, 100, i18next.t('admin:admin.sanctions.invalid_uuid'), { hurt:true });
    return;
  }
  const msg = i18next.t('admin:admin.sanctions.confirm_ban', { uuid, hours, reasonLabel });
  if (!confirm(msg)) return;
  const { error } = await sb.rpc('admin_ban_player', { p_user_id: uuid, p_duration_hours: hours, p_reason: reasonLabel });
  if (error) {
    floatTxt(P.x, P.y, 100, i18next.t('admin:admin.common.failed_prefix') + error.message, { hurt:true });
    return;
  }
  logToDiscord('🚫 Sanction', `**${myPseudo||'Admin'}** a banni le joueur \`${uuid}\` pour ${hours}h (motif : ${reasonLabel})`, 0xc05545);
  floatTxt(P.x, P.y, 100, i18next.t('admin:admin.sanctions.toast_banned'), { gold:true });
  input.value = '';
  refreshBanList();
}
// lève un ban — appelée par le bouton "Lever" d'une ligne du tableau (admin_list_bans)
async function unbanPlayer(uuid) {
  if (!isAdmin() || !sb || !uuid) return;
  const { error } = await sb.rpc('admin_unban_player', { p_user_id: uuid });
  if (error) {
    floatTxt(P.x, P.y, 100, i18next.t('admin:admin.common.failed_prefix') + error.message, { hurt:true });
    return;
  }
  logToDiscord('✅ Sanction levée', `**${myPseudo||'Admin'}** a levé le ban du joueur \`${uuid}\``, 0x8fc98a);
  floatTxt(P.x, P.y, 100, i18next.t('admin:admin.sanctions.toast_unbanned'), { gold:true });
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
  if (!rows.length) { el.innerHTML = `<div class="admEmpty">${i18next.t('admin:admin.roles.no_roles')}</div>`; return; }
  el.innerHTML = rows.map(r => `<div class="modRow">` +
    `<span class="modPseudo">${escapeHtml(r.pseudo || i18next.t('admin:admin.roles.no_nickname'))}</span>` +
    `<code class="modUuid">${r.user_id}</code>` +
    `<span class="roleBadges">${r.mod?'🛡️ MOD':''}${r.mod&&r.tester?' · ':''}${r.tester?'🧪 Testeur':''}</span>` +
    `${r.mod?`<button class="modRemBtn" data-uuid="${r.user_id}" data-role="mod">${i18next.t('admin:admin.roles.remove_mod_btn')}</button>`:''}` +
    `${r.tester?`<button class="modRemBtn" data-uuid="${r.user_id}" data-role="tester">${i18next.t('admin:admin.roles.remove_tester_btn')}</button>`:''}` +
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
  const v2Table = `<table class="admTable"><thead><tr><th>${i18next.t('admin:admin.loot.table_tier')}</th><th>${i18next.t('admin:admin.loot.table_gear')}</th><th>${i18next.t('admin:admin.loot.table_jewel')}</th></tr></thead><tbody>` +
    rows.map(r => `<tr><td>${r.label[LANG]}</td><td>${(LOOT_RATES_V2[r.grade].gear*100).toFixed(2)}%</td><td>${(LOOT_RATES_V2[r.grade].jewel*100).toFixed(3)}%</td></tr>`).join('') +
    `</tbody></table>`;
  return `<div class="admSummary">${i18next.t('admin:admin.loot.active_version')} <b>${v.toUpperCase()}</b></div>
    <div class="admActions">
      <button id="btnLootVerV1" class="${v==='v1'?'ready':''}">${i18next.t('admin:admin.loot.v1_btn')}</button>
      <button id="btnLootVerV2" class="${v==='v2'?'ready':''}">${i18next.t('admin:admin.loot.v2_btn')}</button>
    </div>
    <div class="admHint">${i18next.t('admin:admin.loot.version_hint')}</div>
    <h3>${i18next.t('admin:admin.loot.v2_table_title')}</h3>
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
  el.innerHTML = `<div class="admEmpty">${i18next.t('admin:admin.common.loading')}</div>`;
  sb.from('admin_farm_by_item').select('*').limit(20).then(({data}) => {
    const rows = data || [];
    const itemHtml = rows.map((r,i) => `
      <tr class="${i===0?'admTop':''}">
        <td>${i===0?'🔥 ':''}${tr(r.item_name)}</td><td>${r.item_kind}</td>
        <td>${fmt(r.pickups)}</td><td>${fmt(r.total_qty)}</td><td>${fmt(r.total_silver)}</td>
      </tr>`).join('') || `<tr><td colspan="5" class="admEmpty">${i18next.t('admin:admin.common.no_data')}</td></tr>`;
    el.innerHTML = `<table class="admTable">
        <thead><tr><th>${i18next.t('admin:admin.content.table_item')}</th><th>${i18next.t('admin:admin.content.table_kind')}</th><th>${i18next.t('admin:admin.content.table_pickups')}</th><th>Qté</th><th>Silver</th></tr></thead>
        <tbody>${itemHtml}</tbody>
      </table>`;
  });
}
// section "Pierres de Cron" — farmé vs UTILISÉ (2026-07-19, demande explicite : "je veux
// utilisation des cron ... comme les silver me le dire"). Jusqu'ici seul le ramassage était
// tracké (farm_events, kind='material') ; la consommation pour protéger un enchantement
// (invRemoveAt dans inventory-ui.js) ne touchait que l'inventaire local, invisible côté admin.
// Corrigé en journalisant aussi la consommation via le MÊME queueFarmEvent()/farm_events déjà en
// place (kind='cron_used', distinct de 'material' -- admin_farm_by_item groupe par les deux),
// sans nouvelle table. Requête SANS .limit(20) ici (contrairement à "Ressources farmées") : on
// filtre nommément sur la Pierre de Cron, pas besoin du top 20 par volume qui l'exclurait souvent.
function renderAdminCron(el) {
  el.innerHTML = `<div class="admEmpty">${i18next.t('admin:admin.common.loading')}</div>`;
  Promise.all([
    sb.from('admin_farm_by_item').select('*'),
    sb.from('player_stats').select('user_id'),
  ]).then(([{data: byItem}, {data: playerStats}]) => {
    const farmedRow = (byItem||[]).find(r => r.item_name === CRON_STONE.name && r.item_kind === 'material');
    const usedRow = (byItem||[]).find(r => r.item_name === CRON_STONE.name && r.item_kind === 'cron_used');
    const farmed = farmedRow ? Number(farmedRow.total_qty||0) : 0;
    const used = usedRow ? Number(usedRow.total_qty||0) : 0;
    const usedCount = usedRow ? Number(usedRow.pickups||0) : 0;
    const cronPlayerCount = (playerStats||[]).length;
    const avgFarmedPerPlayer = cronPlayerCount ? farmed/cronPlayerCount : 0;
    const CRON_TIER_LABEL = { grey:{fr:'Gris',en:'Grey'}, white:{fr:'Blanc',en:'White'}, green:{fr:'Vert',en:'Green'}, blue:{fr:'Bleu',en:'Blue'} };
    const cronCostRows = Object.entries(CRON_STONE_COST_BY_TIER).map(([grade,cost]) =>
      `<tr><td>${CRON_TIER_LABEL[grade][LANG]}</td><td>${cost}</td></tr>`).join('');
    const balancePie = typeof buildPieWithLegendHtml === 'function'
      ? buildPieWithLegendHtml([
          { label: i18next.t('admin:admin.content.cron_stock_label'), value: Math.max(0, farmed - used) },
          { label: i18next.t('admin:admin.content.cron_used_label'), value: used },
        ], { thresholdPct: 0 })
      : '';
    el.innerHTML = `<div class="admStatTiles">
        <div class="admStatTile"><div class="astLbl">⏳ ${i18next.t('admin:admin.content.cron_farmed_30d')}</div><div class="astVal">${fmt(farmed)}</div></div>
        <div class="admStatTile"><div class="astLbl">💥 ${i18next.t('admin:admin.content.cron_used_30d')}</div><div class="astVal">${fmt(used)}</div></div>
        <div class="admStatTile"><div class="astLbl">🛡️ ${i18next.t('admin:admin.content.cron_protections_30d')}</div><div class="astVal">${fmt(usedCount)}</div></div>
        <div class="admStatTile"><div class="astLbl">📊 ${i18next.t('admin:admin.content.cron_farmed_per_player')}</div><div class="astVal">${fmt(Math.round(avgFarmedPerPlayer))}</div></div>
      </div>
      <div class="admHint">${i18next.t('admin:admin.content.cron_hint')}</div>
      <h3>${i18next.t('admin:admin.content.cron_balance_title')}</h3>
      ${balancePie}
      <h3>${i18next.t('admin:admin.content.cron_cost_title')}</h3>
      <table class="admTable">
        <thead><tr><th>${i18next.t('admin:admin.content.table_tier')}</th><th>${i18next.t('admin:admin.content.table_cost')}</th></tr></thead>
        <tbody>${cronCostRows}</tbody>
      </table>`;
  });
}
function renderAdminTreasure(el) {
  el.innerHTML = `<div class="admSummary">${i18next.t('admin:admin.content.treasure_estimate', { kpm: ADMIN_TREASURE_KPM_REF })}</div>
    <table class="admTable">
      <thead><tr><th>${i18next.t('admin:admin.content.table_item')}</th><th>${i18next.t('admin:admin.content.table_chance_per_kill')}</th>
        <th>${i18next.t('admin:admin.content.table_avg_kills')}</th><th>${i18next.t('admin:admin.content.table_est_time')}</th></tr></thead>
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
  el.innerHTML = `<div class="admEmpty">${i18next.t('admin:admin.common.loading')}</div>`;
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
    const zonePie = typeof buildPieWithLegendHtml === 'function' ? buildPieWithLegendHtml(zoneItems) : `<div class="admEmpty">${i18next.t('admin:admin.common.chart_unavailable')}</div>`;
    const gsPie = typeof buildPieWithLegendHtml === 'function' ? buildPieWithLegendHtml(gsItems, { thresholdPct:0, formatValue: v => String(Math.round(v)) }) : '';
    el.innerHTML = `<div class="admSummary">${i18next.t('admin:admin.content.zone_progression_summary')}</div>
      <div class="admChartsRow">
        <div><h3 style="margin-top:0">${i18next.t('admin:admin.content.by_zone_title')}</h3>${zonePie}</div>
        <div><h3 style="margin-top:0">${i18next.t('admin:admin.content.by_gearscore_title')}</h3>${gsPie}</div>
      </div>`;
  });
}

// ---------- section "Contenu → Compendium" (2026-07-10, demande explicite : "ajoute au panneau
// admin ce qui manque") -- distribution de player_stats.compendium_pct (alimenté par
// compendiumOverallPct(), core/game-core.js, à chaque syncPlayerStats()) -- même pattern que
// renderAdminZoneProgression juste au-dessus (placeholder synchrone, requête async, buckets +
// buildPieWithLegendHtml). Lecture seule, aucune action admin ici.
function renderAdminCompendium(el) {
  el.innerHTML = `<div class="admEmpty">${i18next.t('admin:admin.common.loading')}</div>`;
  sb.from('player_stats').select('compendium_pct').then(({data}) => {
    const rows = data||[];
    const PCT_BRACKETS = [
      { max:10, label:'0-10%' }, { max:30, label:'10-30%' }, { max:60, label:'30-60%' },
      { max:90, label:'60-90%' }, { max:Infinity, label:'90-100%' },
    ];
    const counts = PCT_BRACKETS.map(() => 0);
    rows.forEach(r => {
      const pct = Number(r.compendium_pct||0);
      const idx = PCT_BRACKETS.findIndex(b => pct < b.max);
      counts[idx >= 0 ? idx : PCT_BRACKETS.length-1]++;
    });
    const items = PCT_BRACKETS.map((b,i) => ({ label:b.label, value:counts[i] }));
    const avg = rows.length ? Math.round(rows.reduce((s,r) => s + Number(r.compendium_pct||0), 0) / rows.length) : 0;
    const pie = typeof buildPieWithLegendHtml === 'function' ? buildPieWithLegendHtml(items, { thresholdPct:0, formatValue: v => String(Math.round(v)) }) : `<div class="admEmpty">${i18next.t('admin:admin.common.chart_unavailable')}</div>`;
    el.innerHTML = `<div class="admSummary">${i18next.t('admin:admin.content.compendium_summary', { avg, count: rows.length })}</div>
      <div class="admChartsRow"><div><h3 style="margin-top:0">${i18next.t('admin:admin.content.compendium_distribution_title')}</h3>${pie}</div></div>`;
  });
}

// ---------- section "Contenu → Tutoriels d'objets" (NOUVEAU, 2026-07-19) -- lecture seule (pas
// d'éditeur, pas de bouton reset : demande explicite "voir qui a vu/pas vu") sur
// item_tutorials_seen via l'agrégat admin_item_tutorial_stats() (SECURITY DEFINER, une ligne par
// tutorial_id avec completed_count/skipped_count/total_count). La table démarre vide tant que le
// système de tutoriel objet (en cours de build en parallèle côté progression) n'a pas encore été
// traversé par un joueur -- même state vide que renderAdminSignups ("Aucune inscription..."), pas
// une erreur. buildPieWithLegendHtml vient de admin-economy.js (chargé APRÈS ce fichier, guard
// typeof identique à renderAdminLoot/renderAdminZoneProgression ci-dessus). ----------
function renderAdminItemTutorials(el) {
  el.innerHTML = `<div class="admEmpty">${i18next.t('admin:admin.common.loading')}</div>`;
  sb.rpc('admin_item_tutorial_stats').then(({data, error}) => {
    if (error) { el.innerHTML = `<div class="admHint">${escapeHtml(error.message)}</div>`; return; }
    const rows = data || [];
    if (!rows.length) {
      el.innerHTML = `<div class="admEmpty">${i18next.t('admin:admin.content.tutorials_no_data')}</div>`;
      return;
    }
    const totalCompleted = rows.reduce((a,r) => a + Number(r.completed_count||0), 0);
    const totalSkipped = rows.reduce((a,r) => a + Number(r.skipped_count||0), 0);
    const rowsHtml = rows.map(r => {
      const completed = Number(r.completed_count||0), skipped = Number(r.skipped_count||0), total = Number(r.total_count||0);
      const rate = (completed + skipped) > 0 ? Math.round(completed/(completed+skipped)*100) : 0;
      return `<tr><td>${escapeHtml(r.tutorial_id)}</td><td>${fmt(completed)}</td><td>${fmt(skipped)}</td><td>${fmt(total)}</td><td>${rate}%</td></tr>`;
    }).join('');
    const pie = typeof buildPieWithLegendHtml === 'function'
      ? buildPieWithLegendHtml([
          { label: i18next.t('admin:admin.content.completed_label'), value: totalCompleted },
          { label: i18next.t('admin:admin.content.skipped_label'), value: totalSkipped },
        ], { thresholdPct: 0 })
      : '';
    el.innerHTML = `<div class="admStatTiles">
        <div class="admStatTile"><div class="astLbl">🎓 ${i18next.t('admin:admin.content.tutorials_tracked')}</div><div class="astVal">${rows.length}</div></div>
        <div class="admStatTile"><div class="astLbl">✅ ${i18next.t('admin:admin.content.completed_total')}</div><div class="astVal">${fmt(totalCompleted)}</div></div>
        <div class="admStatTile"><div class="astLbl">⏭️ ${i18next.t('admin:admin.content.skipped_total')}</div><div class="astVal">${fmt(totalSkipped)}</div></div>
      </div>
      <div class="admHint">${i18next.t('admin:admin.content.tutorials_hint')}</div>
      <h3>${i18next.t('admin:admin.content.tutorials_completed_vs_skipped_title')}</h3>
      ${pie}
      <h3>${i18next.t('admin:admin.content.tutorials_detail_title')}</h3>
      <table class="admTable">
        <thead><tr><th>${i18next.t('admin:admin.content.table_tutorial')}</th><th>${i18next.t('admin:admin.content.completed_label')}</th><th>${i18next.t('admin:admin.content.skipped_label')}</th><th>${i18next.t('admin:admin.content.table_total')}</th><th>${i18next.t('admin:admin.content.table_rate')}</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>`;
  });
}

// ---------- section "Contenu → Onboarding" (NOUVEAU, 2026-07-19, demande explicite : "ajoute des
// stats sur l'onboarding") -- distincte de "Tutoriels d'objets" ci-dessus : suit spécifiquement le
// tutoriel d'arrivée (TUTORIAL_STEPS, 21 étapes, tutorial_id='onboarding') via
// admin_onboarding_stats()/admin_onboarding_dropoff() (migration 20260719180000_onboarding_stats.sql
// + 20260719180100). Le tutoriel d'arrivée n'a AUCUN déclenchement automatique à la 1ère connexion
// (seulement un bouton dans le Wiki, voir game-supabase.js) -- ce panneau permet justement de
// constater ce faible taux de démarrage, pas seulement le taux de complétion une fois démarré. ----------
function renderAdminOnboarding(el) {
  el.innerHTML = `<div class="admEmpty">${i18next.t('admin:admin.common.loading')}</div>`;
  Promise.all([sb.rpc('admin_onboarding_stats'), sb.rpc('admin_onboarding_dropoff')]).then(([statsRes, dropRes]) => {
    if (statsRes.error) { el.innerHTML = `<div class="admHint">${escapeHtml(statsRes.error.message)}</div>`; return; }
    const s = (statsRes.data && statsRes.data[0]) || { started:0, completed:0, skipped:0, in_progress:0 };
    const started = Number(s.started||0), completed = Number(s.completed||0), skipped = Number(s.skipped||0), inProgress = Number(s.in_progress||0);
    if (!started) {
      el.innerHTML = `<div class="admEmpty">${i18next.t('admin:admin.content.onboarding_no_data')}</div>`;
      return;
    }
    const completedPct = started > 0 ? Math.round(completed/started*100) : 0;
    const pie = typeof buildPieWithLegendHtml === 'function'
      ? buildPieWithLegendHtml([
          { label: i18next.t('admin:admin.content.onboarding_completed_label'), value: completed },
          { label: i18next.t('admin:admin.content.onboarding_skipped_label'), value: skipped },
          { label: i18next.t('admin:admin.content.in_progress_abandoned_label'), value: inProgress },
        ], { thresholdPct: 0 })
      : '';
    const dropRows = (dropRes.data || []);
    const totalSteps = (typeof TUTORIAL_STEPS !== 'undefined' && TUTORIAL_STEPS.length) || 21;
    const dropoffHtml = dropRows.length
      ? `<table class="admTable">
          <thead><tr><th>${i18next.t('admin:admin.content.table_step_reached')}</th><th>${i18next.t('admin:admin.content.table_players')}</th></tr></thead>
          <tbody>${dropRows.map(r => `<tr><td>${Number(r.last_step)+1} / ${totalSteps}</td><td>${fmt(Number(r.user_count||0))}</td></tr>`).join('')}</tbody>
        </table>`
      : `<div class="admEmpty">${i18next.t('admin:admin.content.onboarding_no_dropoff')}</div>`;
    el.innerHTML = `<div class="admSummary">${i18next.t('admin:admin.content.onboarding_summary')}</div>
      <div class="admStatTiles">
        <div class="admStatTile"><div class="astLbl">🧭 ${i18next.t('admin:admin.content.started_label')}</div><div class="astVal">${fmt(started)}</div></div>
        <div class="admStatTile"><div class="astLbl">✅ ${i18next.t('admin:admin.content.onboarding_completed_label')}</div><div class="astVal">${fmt(completed)} <span class="admHint">(${completedPct}%)</span></div></div>
        <div class="admStatTile"><div class="astLbl">⏭️ ${i18next.t('admin:admin.content.onboarding_skipped_label')}</div><div class="astVal">${fmt(skipped)}</div></div>
        <div class="admStatTile"><div class="astLbl">🚪 ${i18next.t('admin:admin.content.in_progress_abandoned_label')}</div><div class="astVal">${fmt(inProgress)}</div></div>
      </div>
      <h3>${i18next.t('admin:admin.content.breakdown_title')}</h3>
      ${pie}
      <h3>${i18next.t('admin:admin.content.dropoff_funnel_title')}</h3>
      ${dropoffHtml}`;
  });
}

// ---------- section "Contenu → Compagnons" (NOUVEAU, 2026-07-19, demande explicite : "branche
// des stats sur toutes les nouvelle fonctionnalité de compagnons") -- le module (src/companions/,
// iframe isolée, voir combat/boss.js) était 100% local jusqu'ici (localStorage, aucune sync
// serveur) : ce panneau lit companion_stats via admin_companion_stats() (migration
// 20260719190000_companion_stats.sql), alimentée par companions/companions.sync.js (poussé toutes
// les 60s, réutilise le client sb/currentUser déjà authentifié de la page hôte via window.parent,
// iframe same-origin). "players_synced" = a ouvert le module au moins une fois ET a un compte
// (jamais les invités, ni les joueurs qui n'ont jamais cliqué l'onglet Compagnon). ----------
// libellés/icônes en dur (2026-07-20) : RARITIES/SECTIONS vivent dans catalog.js,
// chargé UNIQUEMENT dans l'iframe du module (jamais dans le bundle principal) -- le panneau admin
// ne peut pas les lire directement. Recopie minimale (id/nom/couleur/icône), tenue à jour à la
// main si le catalogue change -- même limite que toute donnée d'un module non bundlé.
const COMPANION_RARITY_LABELS = [
  { id:0, name:'Commun',     color:'#888' },
  { id:1, name:'Peu commun', color:'#44b060' },
  { id:2, name:'Rare',       color:'#4488cc' },
  { id:3, name:'Épique',     color:'#9944cc' },
  { id:4, name:'Légendaire', color:'#cc8820' },
  { id:5, name:'Ancestral',  color:'#cc3030' },
];
const COMPANION_SECTION_LABELS = {
  loot:'💎 Collecte', xp:'✨ Expérience', minage:'⛏️ Minage', bucheron:'🪓 Bûcheron',
  peche:'🎣 Pêche', farming:'🌾 Farming', alchimie:'⚗️ Alchimie', combat:'⚔️ Combat',
};
// somme un tableau de lignes {rarity_breakdown|tier_breakdown|section_breakdown: {clé:compte}}
// (une ligne par joueur, admin_companion_breakdown()) en un seul objet {clé:total} -- pure,
// testable isolément sans réseau/DOM.
function sumCompanionBreakdown(rows, field) {
  const totals = {};
  (rows||[]).forEach(r => {
    const obj = r && r[field];
    if (!obj || typeof obj !== 'object') return;
    Object.entries(obj).forEach(([k,v]) => { totals[k] = (totals[k]||0) + Number(v||0); });
  });
  return totals;
}
// taille totale de la complétion Index (2026-07-20, "Completion 48pet * 5 tier pour l'index et
// classement") -- 48 espèces × 5 tiers = 240, recopiée en dur (même limite que
// COMPANION_RARITY_LABELS/COMPANION_SECTION_LABELS ci-dessus : le panneau admin, bundle principal,
// ne peut jamais charger catalog.js, jamais bundlé). À tenir à jour si le catalogue
// du module change. unique_species_count (RPC) compte désormais des combos espèce×tier, pas
// juste des espèces — voir companionIndexProgress(), catalog.js.
const COMPANION_CATALOG_SIZE = 48 * 5;
function renderAdminCompanions(el) {
  el.innerHTML = `<div class="admEmpty">${i18next.t('admin:admin.common.loading')}</div>`;
  Promise.all([sb.rpc('admin_companion_stats'), sb.rpc('admin_companion_breakdown'), sb.rpc('admin_companion_player_list'), sb.rpc('admin_list_players')]).then(([statsRes, breakdownRes, playerListRes, allPlayersRes]) => {
    if (statsRes.error) { el.innerHTML = `<div class="admHint">${escapeHtml(statsRes.error.message)}</div>`; return; }
    const s = (statsRes.data && statsRes.data[0]) || {};
    const playersSynced = Number(s.players_synced||0);
    if (!playersSynced) {
      el.innerHTML = `<div class="admEmpty">${i18next.t('admin:admin.content.companions_no_data')}</div>`;
      return;
    }
    const totalPet = Number(s.total_pet_count||0), avgPet = Number(s.avg_pet_count||0);
    const totalSilver = Number(s.total_silver||0), totalHatch = Number(s.total_hatch_count||0), totalFusion = Number(s.total_fusion_count||0);
    const avgStreak = Number(s.avg_login_streak||0), playersWithPity = Number(s.players_with_pity||0), avgAch = Number(s.avg_achievements||0);
    const avgHardAch = Number(s.avg_hard_achievements||0), totalFusionDowngrade = Number(s.total_fusion_downgrade||0);
    // NOUVEAU (2026-07-20, demande explicite : "stats pour oeuf, moyenne doeuf eclos/jour, stats
    // entiere liste des fusion et grph completion index") -- avg_hatch_per_day/avg_unique_species
    // viennent de admin_companion_stats() enrichi (migration 20260720130000_companion_stats_egg_and_index.sql).
    const avgHatchPerDay = Number(s.avg_hatch_per_day||0), avgUniqueSpecies = Number(s.avg_unique_species||0);
    const avgCompletionPct = Math.round(avgUniqueSpecies/COMPANION_CATALOG_SIZE*100);

    const nameByUser = new Map((allPlayersRes.data||[]).map(p => [p.user_id, p.display_name||'?']));
    const playerRows = (playerListRes.error ? [] : (playerListRes.data||[])).filter(r => r.fusion_count > 0 || r.hatch_count > 0);
    const fusionListHtml = playerRows.length
      ? `<table class="admTable">
          <thead><tr><th>${i18next.t('admin:admin.content.table_player')}</th><th>🔗 ${i18next.t('admin:admin.content.table_fusions')}</th><th>🌟 ${i18next.t('admin:admin.content.table_breakthroughs')}</th><th>🎰 ${i18next.t('admin:admin.content.table_downgrades')}</th><th>🥚 ${i18next.t('admin:admin.content.table_eggs')}</th><th>📖 ${i18next.t('admin:admin.content.table_index')}</th></tr></thead>
          <tbody>${playerRows.map((r,i) => `
            <tr class="${i===0&&r.fusion_count>0?'admTop':''}">
              <td>${escapeHtml(nameByUser.get(r.user_id) || (r.user_id||'').slice(0,8)+'…')}</td>
              <td>${fmt(r.fusion_count||0)}</td><td>${fmt(r.breakthrough_count||0)}</td><td>${fmt(r.fusion_downgrade_count||0)}</td>
              <td>${fmt(r.hatch_count||0)}</td><td>${r.unique_species_count||0}/${COMPANION_CATALOG_SIZE}</td>
            </tr>`).join('')}</tbody>
        </table>`
      : `<div class="admEmpty">${i18next.t('admin:admin.content.companions_no_fusion')}</div>`;
    const completionBuckets = [0,25,50,75,100].map((min,i,arr) => {
      const max = arr[i+1] ?? 101;
      const label = i===arr.length-1 ? '100%' : `${min}-${arr[i+1]-1}%`;
      const count = playerRows.filter(r => { const pct = Math.round((r.unique_species_count||0)/COMPANION_CATALOG_SIZE*100); return pct>=min && pct<max; }).length;
      return { label, value:count };
    });
    const completionChart = typeof buildBarSeriesSvg === 'function'
      ? buildBarSeriesSvg(completionBuckets, (typeof currentAdminAccentColors === 'function' ? currentAdminAccentColors().accent : '#c9a55a')) : '';

    const rows = breakdownRes.error ? [] : (breakdownRes.data || []);
    const rarityTotals = sumCompanionBreakdown(rows, 'rarity_breakdown');
    const tierTotals = sumCompanionBreakdown(rows, 'tier_breakdown');
    const sectionTotals = sumCompanionBreakdown(rows, 'section_breakdown');

    const rarityItems = COMPANION_RARITY_LABELS
      .filter(r => rarityTotals[r.id])
      .map(r => ({ label:r.name, value:rarityTotals[r.id] }));
    const sectionItems = Object.entries(sectionTotals)
      .map(([id,v]) => ({ label: COMPANION_SECTION_LABELS[id] || id, value:v }));
    const rarityPie = typeof buildPieWithLegendHtml === 'function'
      ? buildPieWithLegendHtml(rarityItems, { thresholdPct:0 }) : '';
    const sectionPie = typeof buildPieWithLegendHtml === 'function'
      ? buildPieWithLegendHtml(sectionItems, { thresholdPct:0 }) : '';
    const tierPoints = [1,2,3,4,5].map(t => ({ label:'T'+t, value:tierTotals[t]||0 }));
    const tierBar = typeof buildBarSeriesSvg === 'function'
      ? buildBarSeriesSvg(tierPoints, (typeof currentAdminAccentColors === 'function' ? currentAdminAccentColors().accent : '#c9a55a')) : '';

    el.innerHTML = `<div class="admSummary">${i18next.t('admin:admin.content.companions_summary')}</div>
      <div class="admStatTiles">
        <div class="admStatTile"><div class="astLbl">🐾 ${i18next.t('admin:admin.content.companions_synced')}</div><div class="astVal">${fmt(playersSynced)}</div></div>
        <div class="admStatTile"><div class="astLbl">📦 ${i18next.t('admin:admin.content.companions_pets')}</div><div class="astVal">${fmt(totalPet)} <span class="admHint">(${avgPet.toFixed(1)})</span></div></div>
        <div class="admStatTile"><div class="astLbl">💰 ${i18next.t('admin:admin.content.companions_silver')}</div><div class="astVal">${fmt(totalSilver)}</div></div>
        <div class="admStatTile"><div class="astLbl">🥚 ${i18next.t('admin:admin.content.companions_eggs_hatched')}</div><div class="astVal">${fmt(totalHatch)}</div></div>
        <div class="admStatTile"><div class="astLbl">🔗 ${i18next.t('admin:admin.content.companions_fusions_total')}</div><div class="astVal">${fmt(totalFusion)}</div></div>
        <div class="admStatTile"><div class="astLbl">🎰 ${i18next.t('admin:admin.content.companions_downgrade_fusions')}</div><div class="astVal">${fmt(totalFusionDowngrade)}</div></div>
        <div class="admStatTile"><div class="astLbl">🔥 ${i18next.t('admin:admin.content.companions_login_streak')}</div><div class="astVal">${avgStreak.toFixed(1)}</div></div>
        <div class="admStatTile"><div class="astLbl">🎁 ${i18next.t('admin:admin.content.companions_triggered_pity')}</div><div class="astVal">${fmt(playersWithPity)}</div></div>
        <div class="admStatTile"><div class="astLbl">🏆 ${i18next.t('admin:admin.content.companions_achievements_avg')}</div><div class="astVal">${avgAch.toFixed(1)} <span class="admHint">/17</span></div></div>
        <div class="admStatTile"><div class="astLbl">🔥 ${i18next.t('admin:admin.content.companions_hard_achievements_avg')}</div><div class="astVal">${avgHardAch.toFixed(1)} <span class="admHint">/4</span></div></div>
        <div class="admStatTile"><div class="astLbl">📈 ${i18next.t('admin:admin.content.companions_hatches_per_day')}</div><div class="astVal">${avgHatchPerDay.toFixed(2)}</div></div>
        <div class="admStatTile"><div class="astLbl">📖 ${i18next.t('admin:admin.content.companions_index_completion')}</div><div class="astVal">${avgCompletionPct}% <span class="admHint">(${avgUniqueSpecies.toFixed(1)}/${COMPANION_CATALOG_SIZE})</span></div></div>
      </div>
      <div class="admChartsRow">
        <div><h3 style="margin-top:0">${i18next.t('admin:admin.content.by_rarity_title')}</h3>${rarityPie}</div>
        <div><h3 style="margin-top:0">${i18next.t('admin:admin.content.by_section_title')}</h3>${sectionPie}</div>
      </div>
      <h3>${i18next.t('admin:admin.content.by_tier_title')}</h3>
      ${tierBar}
      <h3>${i18next.t('admin:admin.content.index_completion_breakdown_title')}</h3>
      ${completionChart}
      <h3>${i18next.t('admin:admin.content.fusion_list_title')}</h3>
      ${fusionListHtml}`;
  });
}

// ---------- section "Vue d'ensemble" — dashboard synthétique (NOUVEAU, 2026-07-19, alertes
// ajoutées le 2026-07-20, consolidé avec TOUS les graphiques du panneau + voyants 🟢/🔴 le
// 2026-07-20 -- demande explicite : "ajoute dans le dashboard tout, et surtout des alerte sil y a
// trop de quelque chose" puis "ajoute toutes les graphique de tout les panel dans dashboard avec
// des voyant vert rouge pour plus dinfos") ----------

// voyant vert/rouge -- fonction PURE (juste une projection booléen -> {dot,label}), testable isolément
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
    fetch: () => sb.from('admin_silver_ledger_by_category').select('*'),
    build: ({ data }) => {
      const rows = (data||[]).map(r => ({ category:r.category, gained:Number(r.total_gained||0), spent:Number(r.total_spent||0) }));
      const alerts = computeEconAlerts(rows);
      const label = c => CATEGORY_LABEL[c] ? CATEGORY_LABEL[c][LANG] : c;
      const sources = rows.filter(r=>r.gained>0).map(r=>({label:label(r.category), value:r.gained}));
      return {
        light: dashboardLight(alerts.length===0),
        chart: buildPieWithLegendHtml(sources, { thresholdPct:6 }),
        note: alerts.length ? alerts[0].text : i18next.t('admin:admin.dashboard.econ_healthy_note'),
      };
    } },
  { id:'dw-silver', cat:'economy', sec:'silver', icon:'🏦', title:{fr:'Flux de silver (48h)',en:'Silver flow (48h)'},
    fetch: () => sb.from('admin_silver_ledger_by_hour').select('*'),
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
        chart: buildPieWithLegendHtml(brackets.map((b,i)=>({label:b.label, value:counts[i]})), { thresholdPct:0, formatValue:v=>String(Math.round(v)) }),
        note: skewed ? i18next.t('admin:admin.dashboard.wealth_skewed_note') : i18next.t('admin:admin.dashboard.wealth_reasonable_note'),
      };
    } },
  { id:'dw-market', cat:'economy', sec:'market', icon:'🏛️', title:{fr:'Marché',en:'Market'},
    fetch: () => Promise.all([sb.rpc('get_market_open'), sb.rpc('admin_market_top_items', { p_days:30 })]),
    build: ([{ data: openData }, { data: topItems }]) => {
      const open = openData !== false;
      const rows = topItems || [];
      return {
        light: dashboardLight(open && rows.length > 0),
        chart: buildPieWithLegendHtml(rows.map(r => ({ label: tr(r.item_name)||r.item_name, value: Number(r.total_silver_value||0) }))),
        note: !open ? i18next.t('admin:admin.dashboard.market_closed_note') : (rows.length ? i18next.t('admin:admin.dashboard.market_active_note') : i18next.t('admin:admin.dashboard.market_no_trades_note')),
      };
    } },
  { id:'dw-signups', cat:'overview', sec:'signups', icon:'📈', title:{fr:'Inscriptions (30j)',en:'Signups (30d)'},
    fetch: () => Promise.all([sb.rpc('admin_signups_by_day', { p_days:30 }), sb.rpc('admin_signups_by_provider')]),
    build: ([{ data: byDay }, { data: byProvider }]) => {
      const rows = byDay || [];
      const { accent } = currentAdminAccentColors();
      const last7 = rows.slice(-7).reduce((a,r) => a + Number(r.signups||0), 0);
      const chart = rows.length
        ? buildBarSeriesSvg(rows.map(r => ({ label:r.day, value:Number(r.signups||0) })), accent)
        : buildPieWithLegendHtml((byProvider||[]).map(r => ({ label: providerInfo(r.provider).icon+' '+providerInfo(r.provider).label[LANG], value: Number(r.signups||0) })), { thresholdPct:0 });
      return {
        light: dashboardLight(last7 > 0),
        chart,
        note: i18next.t('admin:admin.dashboard.signups_note', { count: last7 }),
      };
    } },
  { id:'dw-bans', cat:'players', sec:'sanctions', icon:'🚫', title:{fr:'Sanctions actives',en:'Active sanctions'},
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
        chart: playersSynced ? buildPieWithLegendHtml(rarityItems, { thresholdPct:0 }) : `<div class="admEmpty">${i18next.t('admin:admin.dashboard.companions_none_synced')}</div>`,
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
        chart: buildPieWithLegendHtml(items),
        note: i18next.t('admin:admin.dashboard.players_count_note', { count: (data||[]).length }),
      };
    } },
  { id:'dw-cron', cat:'content', sec:'cron', icon:'⏳', title:{fr:'Pierres de Cron',en:'Cron Stones'},
    fetch: () => sb.from('admin_farm_by_item').select('*'),
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
function buildDashboardCardError(widget) {
  return `<div class="admDashCard" data-cat="${widget.cat}" data-id="${widget.sec}">
      <div class="admDashCardHead"><span class="admDashCardTitle">${widget.icon} ${widget.title[LANG]}</span><span class="admDashLight" title="${i18next.t('admin:admin.dashboard.unavailable')}">⚪</span></div>
      <div class="admDashCardBody"><div class="admEmpty">${i18next.t('admin:admin.dashboard.unavailable')}</div></div>
    </div>`;
}
function renderAdminDashboard(el) {
  el.innerHTML = `<div class="admEmpty">${i18next.t('admin:admin.common.loading')}</div>`;
  const topPromise = Promise.all([
    sb.rpc('admin_list_players'),
    sb.from('admin_wealth').select('silver'),
    sb.rpc('admin_list_bans'),
    sb.rpc('get_market_open'),
    sb.from('admin_silver_ledger_by_category').select('*'),
  ]).then(([{data: players}, {data: wealth}, {data: bans}, {data: marketOpen}, {data: ledgerByCat}]) => {
    const online = (players||[]).filter(p => p.online).length;
    const totalSilver = (wealth||[]).reduce((a,r) => a + Number(r.silver||0), 0);
    const activeBans = (bans||[]).length;
    const open = marketOpen !== false;
    const alerts = typeof computeEconAlerts === 'function' ? computeEconAlerts(ledgerByCat) : [];
    const alertsHtml = typeof buildEconAlertsHtml === 'function' ? buildEconAlertsHtml(alerts) : '';
    return `${alertsHtml}<div class="admStatTiles">
        <div class="admStatTile"><div class="astLbl">🟢 ${i18next.t('admin:admin.dashboard.players_online')}</div><div class="astVal">${online}</div></div>
        <div class="admStatTile"><div class="astLbl">🏦 ${i18next.t('admin:admin.dashboard.total_silver_in_game')}</div><div class="astVal">${fmt(totalSilver)}</div></div>
        <div class="admStatTile"><div class="astLbl">🚫 ${i18next.t('admin:admin.dashboard.active_bans_stat')}</div><div class="astVal">${activeBans}</div></div>
        <div class="admStatTile"><div class="astLbl">🏛️ ${i18next.t('admin:admin.dashboard.market_label')}</div><div class="astVal" style="${open?'':'color:var(--danger)'}">${open?i18next.t('admin:admin.dashboard.market_state_open'):i18next.t('admin:admin.dashboard.market_state_closed')}</div></div>
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
function providerInfo(provider) {
  return PROVIDER_INFO[provider] || { icon:'❔', label:{fr:provider||'?',en:provider||'?'} };
}

// ---------- section "Joueurs" ----------
function renderAdminPlayerList(el) {
  el.innerHTML = `<div class="admEmpty">${i18next.t('admin:admin.common.loading')}</div>`;
  sb.rpc('admin_list_players').then(({data: playersList}) => {
    const playersHtml = (playersList||[]).map(p => {
      const prov = providerInfo(p.provider);
      return `
      <tr>
        <td>${p.online ? '🟢' : '⚪'}</td><td>${escapeHtml(p.display_name||'?')}</td>
        <td title="${escapeHtml(prov.label[LANG])}">${prov.icon}</td>
        <td>${fmt(p.silver||0)}</td><td>${p.gearscore||0}</td>
        <td title="${i18next.t('admin:admin.players.ap_title')}">${(p.ap||0).toFixed(1)}</td>
        <td title="${i18next.t('admin:admin.players.dp_title')}">${(p.dp||0).toFixed(1)}</td>
        <td>${p.lvl||1}</td>
        <td title="${i18next.t('admin:admin.players.best_kpm_title')}">🏹 ${(p.best_kpm||0).toFixed(1)}</td>
        <td><button class="admUuidBtn" data-uuid="${p.user_id}">📋 UUID</button></td>
        <td><button class="admInvBtn" data-uuid="${p.user_id}" data-name="${escapeHtml(p.display_name||'?')}" title="${i18next.t('admin:admin.players.inventory_btn_title')}">🎒 ${i18next.t('admin:admin.players.inventory_btn')}</button></td>
      </tr>`;
    }).join('') || `<tr><td colspan="11" class="admEmpty">${i18next.t('admin:admin.common.no_data')}</td></tr>`;
    el.innerHTML = `<div class="admSummary">${i18next.t('admin:admin.players.summary_online_registered', { online: (playersList||[]).filter(p=>p.online).length, total: (playersList||[]).length })}</div>
      <table class="admTable">
        <thead><tr><th></th><th>${i18next.t('admin:admin.players.table_player')}</th><th title="${i18next.t('admin:admin.players.signup_platform_title')}">${i18next.t('admin:admin.players.table_platform')}</th><th>Silver</th><th>GS</th><th title="${i18next.t('admin:admin.players.ap_title')}">PA</th><th title="${i18next.t('admin:admin.players.dp_title')}">PD</th><th>Niv.</th><th title="${i18next.t('admin:admin.players.kpm_record_title')}">🏹</th><th></th><th></th></tr></thead>
        <tbody>${playersHtml}</tbody>
      </table>`;
    el.querySelectorAll('.admUuidBtn').forEach(btn => {
      btn.onclick = async e => {
        e.stopPropagation();
        try { await navigator.clipboard.writeText(btn.dataset.uuid); } catch(e) {}
        floatTxt(P.x, P.y, 100, i18next.t('admin:admin.players.uuid_copied'), { gold:true });
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
      <div class="admSectionTitle">🎯 ${i18next.t('admin:admin.players.target_title')}</div>
      <div class="admSectionSub">⚠️ ${i18next.t('admin:admin.players.target_sub')}</div>
      <div class="admActions">
        <input type="text" id="admResetUuidInput" placeholder="${i18next.t('admin:admin.players.uuid_placeholder')}" style="width:230px">
        <button id="btnScreenshotPlayer">📸 ${i18next.t('admin:admin.players.screenshot_btn')}</button>
        <button id="btnResetAccountByUuid" style="border-color:var(--danger);color:#e8a89f">🔄 ${i18next.t('admin:admin.players.reset_this_player_btn')}</button>
      </div>
      <div class="admHint">${i18next.t('admin:admin.players.target_hint')}</div>
    </div>`;
  $a('btnScreenshotPlayer').onclick = adminScreenshotPlayer;
  $a('btnResetAccountByUuid').onclick = resetAccountByUuid;
}
function renderAdminSanctions(el) {
  el.innerHTML = `
    <div class="admSection">
      <div class="admSectionTitle">🚫 ${i18next.t('admin:admin.sanctions.ban_a_player_title')}</div>
      <div class="admSectionSub">${i18next.t('admin:admin.sanctions.ban_a_player_sub')}</div>
      <div class="admActions">
        <input type="text" id="admBanUuidInput" placeholder="${i18next.t('admin:admin.players.uuid_placeholder')}" style="width:230px">
        <select id="admBanReasonSelect">${BAN_REASONS.map(r => `<option value="${r.id}">${r.label[LANG]}</option>`).join('')}</select>
        <select id="admBanDurationSelect">${BAN_DURATIONS.map(d => `<option value="${d.hours}"${d.hours===24?' selected':''}>${d.label[LANG]}</option>`).join('')}</select>
        <button id="btnBanPlayer" style="border-color:var(--danger);color:#e8a89f">🚫 ${i18next.t('admin:admin.sanctions.ban_btn')}</button>
      </div>
      <div class="admHint warn">${i18next.t('admin:admin.sanctions.ban_hint')}</div>
    </div>
    <div class="admSection">
      <div class="admSectionTitle">📋 ${i18next.t('admin:admin.sanctions.active_bans_title')}</div>
      <div id="admBanList"><div class="admEmpty">${i18next.t('admin:admin.common.loading')}</div></div>
    </div>`;
  $a('btnBanPlayer').onclick = banPlayerByUuid;
  refreshBanList();
}
function renderAdminRoles(el) {
  el.innerHTML = `
    <div class="admSection riskMgmt">
      <div class="admSectionTitle">🎭 ${i18next.t('admin:admin.roles.title')}</div>
      <div class="admSectionSub">${i18next.t('admin:admin.roles.sub')}</div>
      <div class="admBossSpawn">
        <input type="text" id="admRoleUuid" placeholder="${i18next.t('admin:admin.players.uuid_placeholder')}" style="flex:1;min-width:180px;background:#0d0c11;border:1px solid #333;color:var(--ink);padding:5px 7px;font-family:monospace;font-size:11px;border-radius:3px;">
        <select id="admRoleSelect" style="flex:0 0 auto;width:auto;">
          <option value="mod">🛡️ ${i18next.t('admin:admin.roles.moderator_label')}</option>
          <option value="tester">🧪 ${i18next.t('admin:admin.roles.tester_label')}</option>
        </select>
        <button id="btnAddRole" style="flex:0 0 auto;width:auto;">${i18next.t('admin:admin.roles.add_btn')}</button>
      </div>
      <div id="admRoleList"><div class="admEmpty">${i18next.t('admin:admin.common.loading')}</div></div>
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

// ---------- section "Joueurs → Reconnexion" (2026-07-10, demande explicite : "suivit admin") ----------
// vue d'ensemble agrégée des sessions AFK/hors-ligne journalisées par le modal de reconnexion
// (src/core/reconnect-modal-react.js, table player_afk_sessions) -- lecture seule, RPC dédiée
// admin_afk_sessions_summary (gate email staff côté serveur, voir migration correspondante).
function renderAdminReconnect(el) {
  el.innerHTML = `
    <div class="admSection">
      <div class="admSectionTitle">🔄 ${i18next.t('admin:admin.reconnect.title')}</div>
      <div class="admSectionSub">${i18next.t('admin:admin.reconnect.sub')}</div>
      <div id="admReconnectStats"><div class="admEmpty">${i18next.t('admin:admin.common.loading')}</div></div>
    </div>
    <div class="admSection">
      <div class="admSectionTitle">🏆 ${i18next.t('admin:admin.reconnect.top10_title')}</div>
      <div id="admReconnectTop"><div class="admEmpty">${i18next.t('admin:admin.common.loading')}</div></div>
    </div>`;
  refreshAdminReconnect();
}
async function refreshAdminReconnect() {
  if (!isAdmin() || !sb) return;
  const statsEl = $a('admReconnectStats'), topEl = $a('admReconnectTop');
  if (!statsEl || !topEl) return;
  const { data, error } = await sb.rpc('admin_afk_sessions_summary');
  if (error || !data || !data[0]) {
    statsEl.innerHTML = `<div class="admHint">${escapeHtml(error ? error.message : 'no data')}</div>`;
    topEl.innerHTML = '';
    return;
  }
  const s = data[0];
  statsEl.innerHTML = `
    <div class="admStatsGrid">
      <div class="admStatCard"><b>${(s.total_sessions||0).toLocaleString(LANG==='fr'?'fr-FR':'en-US')}</b><span>${i18next.t('admin:admin.reconnect.logged_sessions')}</span></div>
      <div class="admStatCard"><b>${(s.total_players||0).toLocaleString(LANG==='fr'?'fr-FR':'en-US')}</b><span>${i18next.t('admin:admin.reconnect.players_involved')}</span></div>
      <div class="admStatCard"><b>${Math.round(s.total_silver||0).toLocaleString(LANG==='fr'?'fr-FR':'en-US')}</b><span>${i18next.t('admin:admin.reconnect.total_silver_recovered')}</span></div>
      <div class="admStatCard"><b>${Math.round(s.avg_silver||0).toLocaleString(LANG==='fr'?'fr-FR':'en-US')}</b><span>${i18next.t('admin:admin.reconnect.avg_per_session')}</span></div>
    </div>`;
  const top = Array.isArray(s.top_sessions) ? s.top_sessions : [];
  topEl.innerHTML = top.length === 0
    ? `<div class="admEmpty">${i18next.t('admin:admin.reconnect.no_session_yet')}</div>`
    : `<table class="admTable"><thead><tr>
        <th>Silver</th><th>${i18next.t('admin:admin.reconnect.table_zone')}</th><th>${i18next.t('admin:admin.reconnect.table_date')}</th><th>${i18next.t('admin:admin.reconnect.table_player_uuid')}</th>
      </tr></thead><tbody>${top.map(t => `<tr>
        <td>${Math.round(t.silver_gained||0).toLocaleString(LANG==='fr'?'fr-FR':'en-US')}</td>
        <td>${escapeHtml(t.zone_name||'—')}</td>
        <td>${new Date(t.ended_at).toLocaleString(LANG==='fr'?'fr-FR':'en-US')}</td>
        <td style="font-family:monospace;font-size:10px">${escapeHtml((t.user_id||'').slice(0,8))}…</td>
      </tr>`).join('')}</tbody></table>`;
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

// ---------- section "Notes de version → Discord" (2026-07-20, demande explicite : "ajoute la
// publication de patchnote directement sur discord") ----------
// Réutilise le webhook Discord "log général" déjà en place (logToDiscord(), voir
// notifications-quests.js, appelé aussi par resetAllQuests/renderAdminBoss ci-dessus) — aucun
// nouveau secret/Edge Function nécessaire. La publication reste une action ADMIN manuelle (bouton),
// pas automatique au déploiement : ce projet n'a pas de hook CI/CD après le `git push` GitHub Pages
// pour déclencher un appel serveur au moment exact où une note devient live.
const PATCH_NOTE_DISCORD_TYPE_ICON = { new:'🆕', change:'🔄', fix:'🛠️', exploit:'🔒' };
// fonction PURE, testable sans DOM/réseau — construit juste le texte, n'envoie rien.
function formatPatchNoteForDiscord(note, lang) {
  lang = (note[lang] ? lang : null) || 'fr';
  const name = (note.name && (note.name[lang] || note.name.fr)) || note.v;
  const lines = (note[lang] || note.fr || []).map(l => `${PATCH_NOTE_DISCORD_TYPE_ICON[l.t] || '•'} ${l.tx}`);
  return {
    title: `📜 Mise à jour ${note.v} — ${name}`,
    description: lines.join('\n') || (lang==='fr' ? '(note vide)' : '(empty note)'),
  };
}
async function publishPatchNoteToDiscord(version) {
  if (!isAdmin()) return false;
  const note = PATCH_NOTES.find(n => n.v === version) || PATCH_NOTES[0];
  if (!note) return false;
  const { title, description } = formatPatchNoteForDiscord(note, 'fr');
  await logToDiscord(title, description, 0xc9a55a);
  return true;
}
function renderAdminPatchNotesDiscord(el) {
  const options = PATCH_NOTES.slice(0, 20).map(n => `<option value="${n.v}">${n.v} — ${n.name.fr}</option>`).join('');
  el.innerHTML = `
    <div class="admSection riskSafe">
      <div class="admSectionTitle">📜 ${i18next.t('admin:admin.patchnotes.publish_title')}</div>
      <div class="admSectionSub">${i18next.t('admin:admin.patchnotes.publish_sub')}</div>
      <div class="admBossSpawn">
        <span>${i18next.t('admin:admin.patchnotes.version_label')}</span>
        <select id="admPatchNoteSelect">${options}</select>
        <button id="btnAdmPublishPatchNote">🚀 ${i18next.t('admin:admin.patchnotes.publish_btn')}</button>
      </div>
      <div class="admHint">${i18next.t('admin:admin.patchnotes.publish_hint')}</div>
    </div>`;
  $a('btnAdmPublishPatchNote').onclick = async () => {
    if (!isAdmin()) return;
    const version = $a('admPatchNoteSelect').value;
    const ok = await publishPatchNoteToDiscord(version);
    floatTxt(P.x, P.y, 100, ok ? i18next.t('admin:admin.patchnotes.published_toast') : i18next.t('admin:admin.common.failed'), { gold:ok, hurt:!ok });
  };
}

// ---------- section "Contenu → Notes de version : modération" (2026-07-10, demande explicite,
// port de patch-notes-pipeline.md §12-13) -- commentaires retirés (restaurables) + signalements en
// attente sur les commentaires encore visibles. Réservé admin/modérateur côté serveur (même gate
// que remove_patch_note_comment, voir la migration) -- ce panneau n'est de toute façon accessible
// que via le panneau admin lui-même (isAdmin() déjà requis pour l'ouvrir).
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
function renderAdminThemeSwatchesHtml(currentTheme) {
  return `<div class="admThemeSwatches" title="🎨 ${i18next.t('admin:admin.system.palette_label')}">${ADMIN_THEMES.map(t =>
    `<button class="admSwatchBtn${t.id===currentTheme?' active':''}" data-theme="${t.id}" style="background:${t.color}" title="${escapeHtml(t.label[LANG])}"></button>`
  ).join('')}</div>`;
}
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
function closeAdminPanel() {
  const overlay = $a('adminOverlay'); if (overlay) overlay.classList.remove('open');
}
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
async function openAdminPanel() {
  if (!isAdmin() || !sb) return;
  const currentTheme = getAdminTheme();
  const overlay = $a('adminOverlay');
  overlay.classList.add('admThemeRoot');
  overlay.dataset.admTheme = currentTheme;
  $a('adminMainHead').innerHTML = `<span id="adminMainTitle" style="flex:1"></span>`;
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
    `<div class="achInfo"><div class="achName">${a.name[LANG]}</div><div class="achDesc">${i18next.t('admin:admin.tests.upcoming_in_dev')}</div></div></div>`).join('');
  openInfo(i18next.t('admin:admin.tests.tester_panel_title'),
    `<div class="admSummary">${i18next.t('admin:admin.tests.tester_panel_intro')}</div>` +
    list);
}
$a('btnTester').onclick = openTesterPanel;
