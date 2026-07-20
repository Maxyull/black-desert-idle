// ============================================================
// Section admin "Journal d'audit" (2026-07-20, bdi-admin-monitoring-plan.md §7).
//
// 18 RPC du panneau modifient l'état du jeu -- bannir, réinitialiser un compte ou TOUS les comptes,
// donner/retirer un rôle, changer les taux de loot, fermer le marché, faire apparaître un boss,
// rembourser, diffuser une annonce. Aucune ne laissait de trace : après coup, « qui a réinitialisé
// ce compte, quand, et pourquoi » n'avait pas de réponse. La migration 20260724200000 les
// instrumente toutes ; cette section est la fenêtre de lecture.
//
// Écran en LECTURE SEULE, et ce n'est pas un oubli : le journal est append-only côté base (RLS sans
// policy + trigger qui refuse UPDATE et DELETE même à service_role). Ne rien proposer d'autre que
// lire est exactement le comportement attendu.
//
// Charge APRÈS src/admin/admin-monitoring.js (réutilise ses aides admMonSkeleton/admMonTiles et
// complète la catégorie "Supervision" qu'il crée) -- voir l'ordre des <script> dans index.dev.html.
// ============================================================

/** Actions jugées lourdes : mises en avant dans la liste. Les autres restent visibles, sans pastille. */
const AUDIT_HEAVY_ACTIONS = [
  'admin_reset_all_accounts', 'admin_reset_account_by_uuid', 'admin_reset_all_quests',
  'admin_ban_player', 'admin_set_loot_rates', 'admin_cancel_all_market_orders',
];
/** @param {string} action @returns {string} icône de l'action (repli neutre pour une action ajoutée plus tard côté serveur). */
function auditActionIcon(action) {
  if (!action) return '•';
  if (action.indexOf('ban') !== -1) return '🚫';
  if (action.indexOf('reset') !== -1) return '♻️';
  if (action.indexOf('mod') !== -1 || action.indexOf('tester') !== -1) return '🧑‍🤝‍🧑';
  if (action.indexOf('boss') !== -1) return '🌍';
  if (action.indexOf('market') !== -1) return '🏛️';
  if (action.indexOf('loot') !== -1) return '🎲';
  if (action.indexOf('donation') !== -1) return '💝';
  if (action.indexOf('notice') !== -1) return '📢';
  return '•';
}
/**
 * @param {object} details @returns {string} résumé lisible d'une ligne de détails, échappé.
 * Rendu générique (clé: valeur) plutôt qu'un gabarit par action : le serveur peut auditer une
 * nouvelle action demain sans que ce fichier bouge, et une action non prévue doit rester lisible
 * plutôt que d'apparaître vide.
 */
function auditDetailsText(details) {
  if (!details || typeof details !== 'object') return '';
  const parts = Object.keys(details)
    .filter(k => details[k] !== null && details[k] !== undefined && details[k] !== '')
    .map(k => k + ' : ' + (typeof details[k] === 'object' ? JSON.stringify(details[k]) : String(details[k])));
  return parts.join(' · ');
}

/** @param {HTMLElement} el. Section Journal d'audit : qui a fait quoi, quand, sur qui. */
function renderAdminAudit(el) {
  el.innerHTML = admMonSkeleton('📒 ' + i18next.t('admin:admin.audit.title'),
    i18next.t('admin:admin.audit.sub'), 'admAuditBody');
  loadAdminAudit();
}

/** Charge et affiche les dernières entrées du journal. */
async function loadAdminAudit() {
  const el = $a('admAuditBody');
  if (!el) return;
  const { data, error } = await sb.rpc('admin_list_audit_log', { p_limit: 200, p_action: null });
  if (error) return admMonFail(el, error);
  const rows = data || [];
  const heavy = rows.filter(r => AUDIT_HEAVY_ACTIONS.indexOf(r.action) !== -1).length;
  const acteurs = new Set(rows.map(r => r.actor_email).filter(Boolean));

  el.innerHTML = admMonTiles([
    { lbl:'📒 ' + i18next.t('admin:admin.audit.tile_entries'), val: admMonNum(rows.length) },
    { lbl:'⚠️ ' + i18next.t('admin:admin.audit.tile_heavy'), val: admMonNum(heavy) },
    { lbl:'🧑 ' + i18next.t('admin:admin.audit.tile_actors'), val: admMonNum(acteurs.size) },
    { lbl:'🕒 ' + i18next.t('admin:admin.audit.tile_last'), val: admMonDate(rows.length ? rows[0].created_at : null) },
  ]) + (rows.length === 0
    // un journal vide juste après la mise en place est NORMAL : il ne se remplit qu'à la prochaine
    // action admin. Le dire évite de le lire comme une panne.
    ? `<div class="admEmpty">${i18next.t('admin:admin.audit.none')}</div>`
    : `<table class="admTable"><thead><tr>
        <th>${i18next.t('admin:admin.audit.col_when')}</th>
        <th>${i18next.t('admin:admin.audit.col_actor')}</th>
        <th>${i18next.t('admin:admin.audit.col_action')}</th>
        <th>${i18next.t('admin:admin.audit.col_target')}</th>
        <th>${i18next.t('admin:admin.audit.col_details')}</th>
      </tr></thead><tbody>${rows.map(r => `<tr>
        <td style="font-size:10px;white-space:nowrap">${admMonDate(r.created_at)}</td>
        <td style="font-size:10px">${escapeHtml(r.actor_email || '—')}</td>
        <td>${auditActionIcon(r.action)} ${escapeHtml(r.action)}${
            AUDIT_HEAVY_ACTIONS.indexOf(r.action) !== -1
              ? ` <span class="admSevPill tone-warn">${i18next.t('admin:admin.audit.heavy')}</span>` : ''}</td>
        <td>${r.target_user_id
            ? `<a href="${escapeHtml(buildAdminHash('players','all', r.target_user_id))}">${escapeHtml(r.target_name || r.target_user_id.slice(0,8))}</a>`
            : '<span class="admHint">—</span>'}</td>
        <td style="font-size:10px">${escapeHtml(auditDetailsText(r.details))}</td>
      </tr>`).join('')}</tbody></table>`);
}

// Rejoint "Supervision", juste après l'Intégrité : les deux répondent à « qu'est-ce qui s'est
// passé sur ce serveur », l'une côté joueurs, l'autre côté staff.
const admAuditGroup = ADMIN_SECTIONS.find(g => g.cat === 'monitoring');
if (admAuditGroup) {
  const apresIntegrite = admAuditGroup.items.findIndex(i => i.id === 'integrity') + 1;
  admAuditGroup.items.splice(apresIntegrite, 0,
    { id:'audit', icon:'📒', label:{fr:'Journal d\'audit',en:'Audit log'}, render:(el)=>renderAdminAudit(el) });
}
