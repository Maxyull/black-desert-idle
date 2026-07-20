// ============================================================
// Sections admin "Joueurs" -- extrait de src/admin/admin-panel.js le 2026-07-19 (audit CLAUDE.md
// §"Taille des fichiers" : le shell dépassait 1000 lignes, découpe obligatoire). AUCUN changement
// de comportement : les fonctions sont déplacées telles quelles.
//
// Réduit le 2026-07-20 : la fusion des 5 sections Joueurs en une page React unique
// (admin-players-react.js) a rendu mortes renderAdminTargetPlayer / renderAdminSanctions /
// renderAdminRoles / renderAdminReconnect et leurs helpers exclusifs (refreshBanList,
// banPlayerByUuid, unbanPlayer, refreshRoleList, resetAccountByUuid, adminScreenshotPlayer,
// refreshAdminReconnect) -- supprimées, c'est la fiche joueur React qui porte ces actions.
//
// Contenu restant, tout consommé par la page React : renderAdminScreenshotHtml (bloc inventaire
// de la fiche), BAN_REASONS/BAN_DURATIONS (les deux <select> de sanction), providerInfo, et
// renderAdminPlayerList, gardée comme REPLI si React ne charge pas (renderAdminPlayersUnified).
//
// Charge APRÈS admin-panel.js (qui déclare ADMIN_SECTIONS et le shell) -- voir l'ordre des
// <script> dans index.dev.html. Le registre ADMIN_SECTIONS référence ces render via des flèches
// paresseuses `render:(el)=>renderX(el)` : la référence se résout à l'APPEL, jamais au chargement,
// donc l'ordre des fichiers ne peut plus casser le registre.
// ============================================================

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
// ---------- sanctions (ban/mute) — demande explicite du 2026-07-18 : jusqu'ici un joueur toxique
// ne pouvait être que réinitialisé, jamais bloqué. Voir supabase/migrations/20260718140000_sanctions_ban_system.sql
// pour le contrat RPC exact (admin_ban_player/admin_unban_player/admin_list_bans).
// Depuis la fusion de la page Joueurs (2026-07-20), les APPELS RPC vivent dans la fiche joueur
// React (admin-players-react.js:AdmPlayerCard) ; il ne reste ici que les deux catalogues, qu'elle
// consomme pour peupler ses deux <select>. ----------
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
/** @param {number} sec - temps de jeu en secondes. @returns {string} format compact "XhYY". */
function fmtAdmPlaytime(sec) {
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60);
  return `${h}h${String(m).padStart(2,'0')}`;
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
