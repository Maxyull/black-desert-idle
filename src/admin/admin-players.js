// ============================================================
// Sections admin "Joueurs" -- extrait de src/admin/admin-panel.js le 2026-07-19 (audit CLAUDE.md
// §"Taille des fichiers" : le shell dépassait 1000 lignes, découpe obligatoire). AUCUN changement
// de comportement : les fonctions sont déplacées telles quelles.
//
// Contenu : snapshot de sauvegarde d'un joueur, reset par UUID, sanctions (bans), rôles
// (mods/testeurs), liste des joueurs, joueur précis, et suivi des reconnexions.
//
// Charge APRÈS admin-panel.js (qui déclare ADMIN_SECTIONS et le shell) -- voir l'ordre des
// <script> dans index.dev.html. Le registre ADMIN_SECTIONS référence ces render via des flèches
// paresseuses `render:(el)=>renderX(el)` : la référence se résout à l'APPEL, jamais au chargement,
// donc l'ordre des fichiers ne peut plus casser le registre.
// ============================================================

/** Affiche un snapshot en lecture seule (équipement + sac + état) de la sauvegarde d'un joueur ciblé par UUID (RPC admin_get_player_save). Ne modifie jamais rien. */
async function adminScreenshotPlayer() {
  if (!isAdmin() || !sb) return;
  const uuid = ($a('admResetUuidInput').value || '').trim();
  if (!uuid) return;
  const { data, error } = await sb.rpc('admin_get_player_save', { p_user_id: uuid });
  if (error) { floatTxt(P.x, P.y, 100, i18next.t('admin:admin.common.failed_prefix') + error.message, { hurt:true }); return; }
  if (!data) { floatTxt(P.x, P.y, 100, i18next.t('admin:admin.reset.no_save_for_uuid'), { hurt:true }); return; }
  openInfo(i18next.t('admin:admin.reset.screenshot_title_prefix') + escapeHtml(data._pseudo||'?'), renderAdminScreenshotHtml(data));
}
/** @param {object} save - sauvegarde brute d'un joueur (S/EQUIP/INV/zoneIdx). @returns {string} HTML du snapshot admin (stats clés, équipement, inventaire). */
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
/** Remet à zéro le compte d'UN joueur ciblé par UUID (RPC admin_reset_account_by_uuid), avertit si ce joueur est actuellement en ligne (son reset serait réécrit à sa prochaine autosave). */
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
/** Recharge et reconstruit le tableau des bans actifs (RPC admin_list_bans), câble le bouton "Lever" de chaque ligne. */
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
/** Bannit un joueur par UUID pour une durée/motif choisis (RPC admin_ban_player). Vérifie canBanUuid AVANT tout appel réseau. */
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
/** @param {string} uuid. Lève le ban d'un joueur (RPC admin_unban_player), rafraîchit la liste. */
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
/** @param {number} sec - temps de jeu en secondes. @returns {string} format compact "XhYY". */
function fmtAdmPlaytime(sec) {
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60);
  return `${h}h${String(m).padStart(2,'0')}`;
}

// panneau unique "Rôles" : fusionne les listes Modérateur et Testeur (2 tables distinctes côté
// serveur, chat_mods et testers) pour que l'admin ajoute/retire les deux rôles au même endroit,
// sur une seule ligne par joueur — demande explicite du 2026-07-07 ("lie les 2 systèmes")
/** Recharge et fusionne les listes Modérateur/Testeur (2 tables serveur distinctes) en une seule ligne par joueur, câble les boutons de retrait de rôle. */
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

/** @param {string} provider - id fourni par auth.users.raw_app_meta_data. @returns {{icon:string, label:object}} icône+libellé du fournisseur d'inscription (repli '❔' si inconnu). */
function providerInfo(provider) {
  return PROVIDER_INFO[provider] || { icon:'❔', label:{fr:provider||'?',en:provider||'?'} };
}

// ---------- section "Joueurs" ----------
/** @param {HTMLElement} el. Section admin "Liste des joueurs" : tableau complet (en ligne, plateforme d'inscription, silver/GS/PA/PD/niveau/kpm), boutons copier UUID / voir inventaire. */
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
/** @param {HTMLElement} el. Section admin "Joueur précis" : champ UUID + boutons screenshot/reset ciblé. */
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
/** @param {HTMLElement} el. Section admin "Sanctions" : formulaire de ban (UUID/motif/durée) + tableau des bans actifs. */
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
/** @param {HTMLElement} el. Section admin "Rôles" : formulaire d'ajout mod/testeur par UUID + liste fusionnée des rôles actifs. */
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
/** @param {HTMLElement} el. Section admin "Reconnexion" : vue d'ensemble agrégée des sessions AFK/hors-ligne, lecture seule. */
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
/** Recharge et affiche les stats de sessions AFK/reconnexion (RPC admin_afk_sessions_summary) : compteurs globaux + top 10 des meilleures sessions. */
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
