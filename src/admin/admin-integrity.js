// ============================================================
// Section admin "Intégrité" (2026-07-20, bdi-admin-monitoring-plan.md §8 — l'étape que le doc
// appelle « le job le plus important du projet »).
//
// Le reste du panneau dit CE QUE FONT les joueurs. Cette section dit si l'état du jeu est encore
// COHÉRENT : horloge client trafiquée, gains hors des bornes physiques, plafond de collection
// dépassé, silver qui n'est plus conservé. Les contrôles tournent côté serveur (cron horaire
// admin_run_integrity_checks, migration 20260724180000) et déposent leurs constats dans
// integrity_violations ; ici on ne fait que les lire et les clore.
//
// Contrairement aux sections de admin-monitoring.js, celle-ci ÉCRIT : admin_resolve_violation
// exige un motif, qui est stocké avec l'auteur et l'horodatage. C'est volontaire -- le doc §8.3
// interdit tout bannissement automatique, la file est donc une file de REVUE MANUELLE : chaque
// ligne se termine par une décision humaine tracée, pas par une action de la machine.
//
// Charge APRÈS src/admin/admin-panel.js (référence ADMIN_SECTIONS et admAttachSection déjà
// déclarés) -- voir l'ordre des <script> dans index.dev.html.
// ============================================================

/** Libellés des types de violation. Clés i18next LITTÉRALES (scripts/check-missing-translations.js refuse la concaténation dynamique). */
const INTEGRITY_KINDS = {
  clock_drift:         { ico:'🕒', label: () => i18next.t('admin:admin.integrity.kind_clock_drift') },
  silver_rate:         { ico:'💰', label: () => i18next.t('admin:admin.integrity.kind_silver_rate') },
  pet_cap:             { ico:'🐾', label: () => i18next.t('admin:admin.integrity.kind_pet_cap') },
  silver_conservation: { ico:'⚖️', label: () => i18next.t('admin:admin.integrity.kind_silver_conservation') },
};
/**
 * @param {string} kind @returns {{ico:string,label:function}} descripteur, avec repli lisible si le
 * serveur ajoute un type que ce client ne connaît pas encore.
 * hasOwnProperty et non `INTEGRITY_KINDS[kind] ||` : sur un type venant de la base, 'constructor'
 * ou 'toString' remonteraient la chaîne de prototypes et rendraient un objet TRUTHY sans .label,
 * qui planterait au rendu -- donc une violation qui disparaît de la file, l'inverse du but.
 */
function integrityKind(kind) {
  if (kind && Object.prototype.hasOwnProperty.call(INTEGRITY_KINDS, kind)) return INTEGRITY_KINDS[kind];
  return { ico:'❓', label: () => String(kind || '—') };
}
/** @param {string} sev @returns {string} pastille colorée de gravité (mêmes tons que le bandeau de santé du dashboard). */
function integritySeverityPill(sev) {
  const tone = sev === 'critical' ? 'crit' : (sev === 'warn' ? 'warn' : 'muted');
  const txt = sev === 'critical' ? i18next.t('admin:admin.integrity.sev_critical')
            : sev === 'warn' ? i18next.t('admin:admin.integrity.sev_warn')
            : i18next.t('admin:admin.integrity.sev_info');
  return `<span class="admSevPill tone-${tone}">${escapeHtml(txt)}</span>`;
}

/** @param {HTMLElement} el. Section Intégrité : file des violations ouvertes, la plus grave d'abord. */
function renderAdminIntegrity(el) {
  el.innerHTML = admMonSkeleton('🛡️ ' + i18next.t('admin:admin.integrity.title'),
    i18next.t('admin:admin.integrity.sub'), 'admIntegrityBody');
  loadAdminIntegrity();
}

/** Charge et affiche la file. Isolée de renderAdminIntegrity pour pouvoir se rappeler après une clôture. */
async function loadAdminIntegrity() {
  const el = $a('admIntegrityBody');
  if (!el) return;
  const [list, sum] = await Promise.all([
    sb.rpc('admin_integrity_violations', { p_days: adminPeriodDays(), p_include_resolved: false }),
    sb.rpc('admin_integrity_summary'),
  ]);
  if (list.error) return admMonFail(el, list.error);
  const rows = list.data || [];
  const bySev = {};
  (sum.data || []).forEach(r => { bySev[r.severity] = Number(r.n) || 0; });

  el.innerHTML = admMonTiles([
    { lbl:'🚨 ' + i18next.t('admin:admin.integrity.tile_critical'), val: admMonNum(bySev.critical) },
    { lbl:'⚠️ ' + i18next.t('admin:admin.integrity.tile_warn'), val: admMonNum(bySev.warn) },
    { lbl:'📋 ' + i18next.t('admin:admin.integrity.tile_open_period', { period: adminPeriodLabel() }), val: admMonNum(rows.length) },
    { lbl:'🕒 ' + i18next.t('admin:admin.integrity.tile_last'), val: admMonDate(rows.length ? rows[0].last_seen_at : null) },
  ]) + (rows.length === 0
    // « aucune violation » est le résultat NORMAL, pas un manque de données : on le dit
    // explicitement, sinon une file vide se lit comme un contrôle en panne.
    ? `<div class="admEmpty">✅ ${i18next.t('admin:admin.integrity.none')}</div>`
    : `<table class="admTable"><thead><tr>
        <th>${i18next.t('admin:admin.integrity.col_kind')}</th>
        <th>${i18next.t('admin:admin.integrity.col_severity')}</th>
        <th>${i18next.t('admin:admin.integrity.col_player')}</th>
        <th>${i18next.t('admin:admin.integrity.col_expected')}</th>
        <th>${i18next.t('admin:admin.integrity.col_actual')}</th>
        <th>${i18next.t('admin:admin.integrity.col_seen')}</th>
        <th></th>
      </tr></thead><tbody>${rows.map(r => {
        const k = integrityKind(r.kind);
        return `<tr>
          <td>${k.ico} ${escapeHtml(k.label())}</td>
          <td>${integritySeverityPill(r.severity)}</td>
          <td>${r.user_id
              // lien profond vers la fiche joueur : depuis un constat, on veut le dossier complet
              // en un clic, pas une recherche manuelle par pseudo.
              ? `<a href="${escapeHtml(buildAdminHash('players','all', r.user_id))}">${escapeHtml(r.display_name || r.user_id.slice(0,8))}</a>`
              : `<span class="admHint">${i18next.t('admin:admin.integrity.global')}</span>`}</td>
          <td>${admMonNum(Math.round(Number(r.expected) || 0))}</td>
          <td>${admMonNum(Math.round(Number(r.actual) || 0))}</td>
          <td style="font-size:10px">${admMonDate(r.last_seen_at)}${
              Number(r.occurrences) > 1 ? ` <span class="admHint">×${admMonNum(r.occurrences)}</span>` : ''}</td>
          <td><button class="admIntegrityResolve" data-id="${r.id}">${i18next.t('admin:admin.integrity.resolve_btn')}</button></td>
        </tr>`;
      }).join('')}</tbody></table>`);

  el.querySelectorAll('.admIntegrityResolve').forEach(btn => {
    btn.onclick = () => resolveAdminIntegrity(Number(btn.dataset.id));
  });
}

/** @param {number} id. Clôt une violation après saisie d'un motif (obligatoire côté serveur aussi). */
async function resolveAdminIntegrity(id) {
  const motif = prompt(i18next.t('admin:admin.integrity.resolve_prompt'));
  // annulation (null) et motif vide sont deux choses différentes, mais aucune ne doit écrire :
  // le serveur refuserait la seconde de toute façon, autant ne pas faire l'aller-retour.
  if (motif == null || !motif.trim()) return;
  const { error } = await sb.rpc('admin_resolve_violation', { p_id: id, p_resolution: motif.trim() });
  if (error) { alert(i18next.t('admin:admin.common.failed_prefix') + ' ' + error.message); return; }
  loadAdminIntegrity();
}

// L'intégrité rejoint "Supervision" : comme les erreurs client, elle parle de la santé du jeu, pas
// d'un joueur en particulier. Placée en tête du groupe -- c'est ce qu'on veut voir en premier.
const admMonitoringGroup = ADMIN_SECTIONS.find(g => g.cat === 'monitoring');
if (admMonitoringGroup) admMonitoringGroup.items.unshift(
  { id:'integrity', icon:'🛡️', label:{fr:'Intégrité',en:'Integrity'}, render:(el)=>renderAdminIntegrity(el) }
);
