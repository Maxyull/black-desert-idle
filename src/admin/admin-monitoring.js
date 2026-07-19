// ============================================================
// Sections admin "Supervision" + zones jusqu'ici sans aucune surface (2026-07-19, demande
// explicite : "ajouter ce qu'il manque comme stats"). L'audit avait montré que plusieurs pans du
// jeu écrivaient en base sans qu'aucune vue admin ne les lise : erreurs client (collectées ET
// purgées par cron, mais jamais consultables), limitation de débit, Mini Boss (5 tables), PvP
// Compagnon et Donations (sections marquées "Prévu" alors que les données existaient déjà),
// Marché Compagnon (troc de familiers entre joueurs -- distinct du marché du jeu).
//
// Charge APRÈS src/admin/admin-panel.js (référence ADMIN_SECTIONS déjà déclaré) et après
// admin-economy.js (qui insère la catégorie "economy" que ce fichier complète) -- voir l'ordre
// des <script> dans index.dev.html. Même convention que admin-economy.js.
//
// Toutes les RPC lues ici viennent de la migration 20260724120000_admin_coverage_rpcs.sql
// (SECURITY DEFINER + garde e-mail staff côté serveur, jamais accessibles à anon). AUCUNE
// n'écrit : ces sections sont en lecture seule.
// ============================================================

/** @param {number} n @returns {string} nombre formaté selon la langue active (même convention que le reste du panel). */
function admMonNum(n) { return Number(n || 0).toLocaleString(LANG === 'fr' ? 'fr-FR' : 'en-US'); }
/** @param {?string} iso @returns {string} date/heure locale, ou tiret si absente. */
function admMonDate(iso) { return iso ? new Date(iso).toLocaleString(LANG === 'fr' ? 'fr-FR' : 'en-US') : '—'; }
/** @param {string} title @param {string} sub @param {string} bodyId @returns {string} squelette de section avec état "chargement" (même structure que les sections existantes). */
function admMonSkeleton(title, sub, bodyId) {
  return `<div class="admSection">
    <div class="admSectionTitle">${title}</div>
    <div class="admSectionSub">${sub}</div>
    <div id="${bodyId}"><div class="admEmpty">${i18next.t('admin:admin.common.loading')}</div></div>
  </div>`;
}
/** @param {HTMLElement} el @param {object} error. Affiche l'erreur d'une RPC sans casser le reste de la section. */
function admMonFail(el, error) {
  if (el) el.innerHTML = `<div class="admHint">${escapeHtml(error && error.message ? error.message : 'no data')}</div>`;
}
/** @param {{lbl:string, val:string}[]} tiles @returns {string} rangée de tuiles de stats. */
function admMonTiles(tiles) {
  return `<div class="admStatTiles">${tiles.map(t =>
    `<div class="admStatTile"><div class="astLbl">${t.lbl}</div><div class="astVal">${t.val}</div></div>`).join('')}</div>`;
}

// ---------- Erreurs client ----------
// La section la plus utile du lot : le jeu remonte ses exceptions dans client_errors depuis des
// mois (avec purge automatique), sans que rien ne permette de les lire. Le tri par occurrences
// répond directement à "qu'est-ce que je corrige en premier".
/** @param {HTMLElement} el. Section Erreurs client : volume par jour, top messages, dernières erreurs. */
function renderAdminClientErrors(el) {
  el.innerHTML =
    admMonSkeleton('🐞 ' + i18next.t('admin:admin.errors.title'), i18next.t('admin:admin.errors.sub'), 'admErrTop') +
    admMonSkeleton('📋 ' + i18next.t('admin:admin.errors.recent_title'), i18next.t('admin:admin.errors.recent_sub'), 'admErrRecent');
  refreshAdminClientErrors();
}
/** Charge et rend les 3 RPC d'erreurs client (résumé par jour, top messages, dernières erreurs). */
async function refreshAdminClientErrors() {
  if (!isAdmin() || !sb) return;
  const topEl = $a('admErrTop'), recentEl = $a('admErrRecent');
  const [sum, top, recent] = await Promise.all([
    sb.rpc('admin_client_errors_summary', { p_days: 14 }),
    sb.rpc('admin_client_errors_top', { p_days: 14, p_limit: 15 }),
    sb.rpc('admin_client_errors_recent', { p_limit: 30 }),
  ]);
  if (topEl) {
    if (top.error) { admMonFail(topEl, top.error); }
    else {
      const rows = top.data || [], days = sum.data || [];
      const total = days.reduce((a, d) => a + Number(d.errors || 0), 0);
      const colors = typeof currentAdminAccentColors === 'function' ? currentAdminAccentColors() : { accent:'#c9a55a' };
      const chart = typeof buildBarSeriesSvg === 'function'
        ? buildBarSeriesSvg(days.map(d => ({ label:d.day, value:Number(d.errors||0) })), colors.danger || '#c96a5a') : '';
      topEl.innerHTML = admMonTiles([
        { lbl:'🐞 ' + i18next.t('admin:admin.errors.tile_total_14d'), val: admMonNum(total) },
        { lbl:'📅 ' + i18next.t('admin:admin.errors.tile_days_with_errors'), val: admMonNum(days.length) },
        { lbl:'🔁 ' + i18next.t('admin:admin.errors.tile_distinct_messages'), val: admMonNum(rows.length) },
        { lbl:'🕒 ' + i18next.t('admin:admin.errors.tile_last'), val: admMonDate(rows.length ? rows[0].last_seen : null) },
      ]) + chart + (rows.length === 0
        ? `<div class="admEmpty">${i18next.t('admin:admin.errors.none')}</div>`
        : `<table class="admTable"><thead><tr>
            <th>${i18next.t('admin:admin.errors.col_message')}</th>
            <th>${i18next.t('admin:admin.errors.col_count')}</th>
            <th>${i18next.t('admin:admin.errors.col_versions')}</th>
            <th>${i18next.t('admin:admin.errors.col_last')}</th>
          </tr></thead><tbody>${rows.map(r => `<tr>
            <td style="font-family:monospace;font-size:10.5px">${escapeHtml(r.message || '—')}</td>
            <td>${admMonNum(r.occurrences)}</td>
            <td style="font-size:10px;color:var(--ink-dim)">${escapeHtml(r.versions || '—')}</td>
            <td style="font-size:10px">${admMonDate(r.last_seen)}</td>
          </tr>`).join('')}</tbody></table>`);
    }
  }
  if (recentEl) {
    if (recent.error) { admMonFail(recentEl, recent.error); }
    else {
      const rows = recent.data || [];
      recentEl.innerHTML = rows.length === 0
        ? `<div class="admEmpty">${i18next.t('admin:admin.errors.none')}</div>`
        : `<table class="admTable"><thead><tr>
            <th>${i18next.t('admin:admin.errors.col_date')}</th>
            <th>${i18next.t('admin:admin.errors.col_message')}</th>
            <th>${i18next.t('admin:admin.errors.col_version')}</th>
            <th>${i18next.t('admin:admin.errors.col_url')}</th>
          </tr></thead><tbody>${rows.map(r => `<tr>
            <td style="font-size:10px;white-space:nowrap">${admMonDate(r.created_at)}</td>
            <td style="font-family:monospace;font-size:10.5px">${escapeHtml(r.message || '—')}</td>
            <td style="font-size:10px">${escapeHtml(r.game_version || '—')}</td>
            <td style="font-size:10px;color:var(--ink-dim)">${escapeHtml((r.url || '—').slice(0, 60))}</td>
          </tr>`).join('')}</tbody></table>`;
    }
  }
}

// ---------- Limitation de débit (anti-abus) ----------
// Table auth_rate_limit : malgré son nom elle sert de compteur GÉNÉRIQUE (les seaux observés sont
// surtout `discordlog:*`), d'où un libellé "limitation de débit" plutôt que "connexions".
/** @param {HTMLElement} el. Section anti-abus : seaux de limitation de débit les plus récents. */
function renderAdminRateLimit(el) {
  el.innerHTML = admMonSkeleton('🛡️ ' + i18next.t('admin:admin.ratelimit.title'), i18next.t('admin:admin.ratelimit.sub'), 'admRateLimitBody');
  refreshAdminRateLimit();
}
/** Charge et rend les seaux de limitation de débit (admin_auth_rate_limit). */
async function refreshAdminRateLimit() {
  if (!isAdmin() || !sb) return;
  const el = $a('admRateLimitBody');
  const { data, error } = await sb.rpc('admin_auth_rate_limit', { p_limit: 60 });
  if (error) return admMonFail(el, error);
  const rows = data || [];
  const totalHits = rows.reduce((a, r) => a + Number(r.hits || 0), 0);
  // préfixe = partie avant le premier ":" (ex. "discordlog") -- donne le TYPE d'action limitée
  const kinds = new Set(rows.map(r => String(r.bucket || '').split(':')[0]).filter(Boolean));
  el.innerHTML = admMonTiles([
    { lbl:'🧺 ' + i18next.t('admin:admin.ratelimit.tile_buckets'), val: admMonNum(rows.length) },
    { lbl:'📈 ' + i18next.t('admin:admin.ratelimit.tile_hits'), val: admMonNum(totalHits) },
    { lbl:'🏷️ ' + i18next.t('admin:admin.ratelimit.tile_kinds'), val: admMonNum(kinds.size) },
  ]) + (rows.length === 0
    ? `<div class="admEmpty">${i18next.t('admin:admin.ratelimit.none')}</div>`
    : `<table class="admTable"><thead><tr>
        <th>${i18next.t('admin:admin.ratelimit.col_bucket')}</th>
        <th>${i18next.t('admin:admin.ratelimit.col_hits')}</th>
        <th>${i18next.t('admin:admin.ratelimit.col_window')}</th>
      </tr></thead><tbody>${rows.map(r => `<tr>
        <td style="font-family:monospace;font-size:10.5px">${escapeHtml(r.bucket || '—')}</td>
        <td>${admMonNum(r.hits)}</td>
        <td style="font-size:10px">${admMonDate(r.window_start)}</td>
      </tr>`).join('')}</tbody></table>`);
}

// ---------- Mini Boss ----------
/** @param {HTMLElement} el. Section Mini Boss : agrégats + sessions récentes (état vide tant qu'aucune session). */
function renderAdminMiniboss(el) {
  el.innerHTML = admMonSkeleton('📜 ' + i18next.t('admin:admin.miniboss.title'), i18next.t('admin:admin.miniboss.sub'), 'admMinibossBody');
  refreshAdminMiniboss();
}
/** Charge et rend les stats Mini Boss (admin_miniboss_stats + admin_miniboss_recent). */
async function refreshAdminMiniboss() {
  if (!isAdmin() || !sb) return;
  const el = $a('admMinibossBody');
  const [stats, recent] = await Promise.all([
    sb.rpc('admin_miniboss_stats'),
    sb.rpc('admin_miniboss_recent', { p_limit: 20 }),
  ]);
  if (stats.error) return admMonFail(el, stats.error);
  const s = (stats.data && stats.data[0]) || {};
  const rows = recent.data || [];
  el.innerHTML = admMonTiles([
    { lbl:'📜 ' + i18next.t('admin:admin.miniboss.tile_sessions'), val: admMonNum(s.sessions_total) },
    { lbl:'🟢 ' + i18next.t('admin:admin.miniboss.tile_active'), val: admMonNum(s.sessions_active) },
    { lbl:'👥 ' + i18next.t('admin:admin.miniboss.tile_players'), val: admMonNum(s.distinct_players) },
    { lbl:'💥 ' + i18next.t('admin:admin.miniboss.tile_damage'), val: admMonNum(Math.round(s.total_damage || 0)) },
    { lbl:'🕒 ' + i18next.t('admin:admin.miniboss.tile_last'), val: admMonDate(s.last_session) },
  ]) + (rows.length === 0
    ? `<div class="admEmpty">${i18next.t('admin:admin.miniboss.none')}</div>`
    : `<table class="admTable"><thead><tr>
        <th>${i18next.t('admin:admin.miniboss.col_summoner')}</th>
        <th>${i18next.t('admin:admin.miniboss.col_status')}</th>
        <th>${i18next.t('admin:admin.miniboss.col_hp')}</th>
        <th>${i18next.t('admin:admin.miniboss.col_participants')}</th>
        <th>${i18next.t('admin:admin.miniboss.col_run')}</th>
        <th>${i18next.t('admin:admin.miniboss.col_date')}</th>
      </tr></thead><tbody>${rows.map(r => `<tr>
        <td>${escapeHtml(r.summoner_pseudo || '—')}</td>
        <td>${escapeHtml(r.status || '—')}</td>
        <td>${admMonNum(Math.round(r.hp || 0))} / ${admMonNum(Math.round(r.max_hp || 0))}</td>
        <td>${admMonNum(r.participant_count)}</td>
        <td>${admMonNum(r.run_index)} / ${admMonNum(r.run_length)}</td>
        <td style="font-size:10px">${admMonDate(r.created_at)}</td>
      </tr>`).join('')}</tbody></table>`);
}

// ---------- PvP Compagnon ----------
/** @param {HTMLElement} el. Section PvP Compagnon : agrégats tournois/inscriptions/récompenses + derniers tournois. */
function renderAdminPvp(el) {
  el.innerHTML = admMonSkeleton('⚔️ ' + i18next.t('admin:admin.pvp.title'), i18next.t('admin:admin.pvp.sub'), 'admPvpBody');
  refreshAdminPvp();
}
/** Charge et rend les stats PvP (admin_pvp_stats + admin_pvp_recent). Signale le cas "tournois résolus sans aucune récompense". */
async function refreshAdminPvp() {
  if (!isAdmin() || !sb) return;
  const el = $a('admPvpBody');
  const [stats, recent] = await Promise.all([
    sb.rpc('admin_pvp_stats'),
    sb.rpc('admin_pvp_recent', { p_limit: 20 }),
  ]);
  if (stats.error) return admMonFail(el, stats.error);
  const s = (stats.data && stats.data[0]) || {};
  const rows = recent.data || [];
  // anomalie repérée à la mise en place (2026-07-19) : des tournois passent bien en "resolved"
  // mais aucune ligne n'apparaît dans companion_pvp_rewards -- on le signale plutôt que de
  // laisser deux compteurs incohérents côte à côte sans explication.
  const rewardGap = Number(s.tournaments_resolved || 0) > 0 && Number(s.rewards_total || 0) === 0;
  el.innerHTML = admMonTiles([
    { lbl:'🏆 ' + i18next.t('admin:admin.pvp.tile_tournaments'), val: admMonNum(s.tournaments_total) },
    { lbl:'✅ ' + i18next.t('admin:admin.pvp.tile_resolved'), val: admMonNum(s.tournaments_resolved) },
    { lbl:'📝 ' + i18next.t('admin:admin.pvp.tile_registrations'), val: admMonNum(s.registrations_total) },
    { lbl:'👥 ' + i18next.t('admin:admin.pvp.tile_players'), val: admMonNum(s.distinct_players) },
    { lbl:'🎁 ' + i18next.t('admin:admin.pvp.tile_rewards'), val: admMonNum(s.rewards_total) },
    { lbl:'💰 ' + i18next.t('admin:admin.pvp.tile_silver'), val: admMonNum(s.silver_awarded) },
  ]) + (rewardGap ? `<div class="admAlertBox">⚠️ ${i18next.t('admin:admin.pvp.reward_gap')}</div>` : '')
    + (rows.length === 0
    ? `<div class="admEmpty">${i18next.t('admin:admin.pvp.none')}</div>`
    : `<table class="admTable"><thead><tr>
        <th>${i18next.t('admin:admin.pvp.col_day')}</th>
        <th>${i18next.t('admin:admin.pvp.col_status')}</th>
        <th>${i18next.t('admin:admin.pvp.col_registrants')}</th>
        <th>${i18next.t('admin:admin.pvp.col_winner')}</th>
        <th>${i18next.t('admin:admin.pvp.col_resolved')}</th>
      </tr></thead><tbody>${rows.map(r => `<tr>
        <td>${escapeHtml(r.day || '—')}</td>
        <td>${escapeHtml(r.status || '—')}</td>
        <td>${admMonNum(r.registrant_count)}</td>
        <td>${escapeHtml(r.winner_pseudo || '—')}</td>
        <td style="font-size:10px">${admMonDate(r.resolved_at)}</td>
      </tr>`).join('')}</tbody></table>`);
}

// ---------- Marché Compagnon (troc de familiers) ----------
// À ne pas confondre avec la section "Marché" (marché d'objets du jeu) : ici c'est l'échange
// joueur-à-joueur de PETS (pet_trade_*), la seule partie du module Compagnon qui fait vraiment
// traverser un familier d'un compte à l'autre.
/** @param {HTMLElement} el. Section Marché Compagnon : offres/échanges/livraisons du troc de familiers. */
function renderAdminPetTrade(el) {
  el.innerHTML = admMonSkeleton('🔄 ' + i18next.t('admin:admin.pettrade.title'), i18next.t('admin:admin.pettrade.sub'), 'admPetTradeBody');
  refreshAdminPetTrade();
}
/** Charge et rend les stats du troc de familiers (admin_pet_trade_stats + admin_pet_trade_recent). */
async function refreshAdminPetTrade() {
  if (!isAdmin() || !sb) return;
  const el = $a('admPetTradeBody');
  const [stats, recent] = await Promise.all([
    sb.rpc('admin_pet_trade_stats'),
    sb.rpc('admin_pet_trade_recent', { p_limit: 20 }),
  ]);
  if (stats.error) return admMonFail(el, stats.error);
  const s = (stats.data && stats.data[0]) || {};
  const rows = recent.data || [];
  el.innerHTML = admMonTiles([
    { lbl:'📦 ' + i18next.t('admin:admin.pettrade.tile_offers'), val: admMonNum(s.offers_total) },
    { lbl:'🟢 ' + i18next.t('admin:admin.pettrade.tile_open'), val: admMonNum(s.offers_open) },
    { lbl:'🤝 ' + i18next.t('admin:admin.pettrade.tile_trades'), val: admMonNum(s.trades_total) },
    { lbl:'📮 ' + i18next.t('admin:admin.pettrade.tile_pending'), val: admMonNum(s.deliveries_pending) },
    { lbl:'👥 ' + i18next.t('admin:admin.pettrade.tile_traders'), val: admMonNum(s.distinct_traders) },
  ]) + (rows.length === 0
    ? `<div class="admEmpty">${i18next.t('admin:admin.pettrade.none')}</div>`
    : `<table class="admTable"><thead><tr>
        <th>${i18next.t('admin:admin.pettrade.col_owner')}</th>
        <th>${i18next.t('admin:admin.pettrade.col_status')}</th>
        <th>${i18next.t('admin:admin.pettrade.col_wants')}</th>
        <th>${i18next.t('admin:admin.pettrade.col_min_silver')}</th>
        <th>${i18next.t('admin:admin.pettrade.col_date')}</th>
      </tr></thead><tbody>${rows.map(r => {
        const wants = [r.accepts_pets ? `${i18next.t('admin:admin.pettrade.wants_pets')} ×${admMonNum(r.pet_qty)}` : '',
                       r.accepts_silver ? i18next.t('admin:admin.pettrade.wants_silver') : ''].filter(Boolean).join(' + ');
        return `<tr>
        <td>${escapeHtml(r.owner_pseudo || '—')}</td>
        <td>${escapeHtml(r.status || '—')}</td>
        <td style="font-size:10.5px">${escapeHtml(wants || '—')}</td>
        <td>${admMonNum(r.min_silver)}</td>
        <td style="font-size:10px">${admMonDate(r.created_at)}</td>
      </tr>`; }).join('')}</tbody></table>`);
}

// ---------- Donations ----------
// L'écriture (admin_add_donation) et le résumé public (donation_public_summary) existaient déjà
// depuis la page Donation ; il manquait uniquement la LECTURE côté admin.
/** @param {HTMLElement} el. Section Donations : total, répartition public/privé, liste détaillée. */
function renderAdminDonations(el) {
  el.innerHTML = admMonSkeleton('💝 ' + i18next.t('admin:admin.donations.title'), i18next.t('admin:admin.donations.sub'), 'admDonationsBody');
  refreshAdminDonations();
}
/** Charge et rend la liste des donations (admin_list_donations). */
async function refreshAdminDonations() {
  if (!isAdmin() || !sb) return;
  const el = $a('admDonationsBody');
  const { data, error } = await sb.rpc('admin_list_donations', { p_limit: 100 });
  if (error) return admMonFail(el, error);
  const rows = data || [];
  const totalUsd = rows.reduce((a, r) => a + Number(r.amount_usd || 0), 0);
  const publicCount = rows.filter(r => r.is_public).length;
  el.innerHTML = admMonTiles([
    { lbl:'💵 ' + i18next.t('admin:admin.donations.tile_total_usd'), val: '$' + totalUsd.toFixed(2) },
    { lbl:'🎁 ' + i18next.t('admin:admin.donations.tile_count'), val: admMonNum(rows.length) },
    { lbl:'👁️ ' + i18next.t('admin:admin.donations.tile_public'), val: admMonNum(publicCount) },
    { lbl:'🕒 ' + i18next.t('admin:admin.donations.tile_last'), val: admMonDate(rows.length ? (rows[0].received_at || rows[0].created_at) : null) },
  ]) + (rows.length === 0
    ? `<div class="admEmpty">${i18next.t('admin:admin.donations.none')}</div>`
    : `<table class="admTable"><thead><tr>
        <th>${i18next.t('admin:admin.donations.col_date')}</th>
        <th>${i18next.t('admin:admin.donations.col_amount')}</th>
        <th>${i18next.t('admin:admin.donations.col_donor')}</th>
        <th>${i18next.t('admin:admin.donations.col_source')}</th>
        <th>${i18next.t('admin:admin.donations.col_public')}</th>
      </tr></thead><tbody>${rows.map(r => `<tr>
        <td style="font-size:10px">${admMonDate(r.received_at || r.created_at)}</td>
        <td>$${Number(r.amount_usd || 0).toFixed(2)}${r.currency && r.currency !== 'USD' ? ` <span style="font-size:9px;color:var(--ink-dim)">(${escapeHtml(r.currency)} ${admMonNum(r.amount_original)})</span>` : ''}</td>
        <td>${escapeHtml(r.donor_label || '—')}</td>
        <td style="font-size:10px">${escapeHtml(r.source || '—')}</td>
        <td>${r.is_public ? '✅' : '—'}</td>
      </tr>`).join('')}</tbody></table>`);
}

// ---------- Cadence des joueurs (anti-triche) ----------
// player_hour_rates est alimentée par compute_player_hour_rates() et protégée en écriture
// (protect_server_rate_columns) : c'est la table qui sert à repérer une progression impossible.
// Elle n'avait aucune surface admin -- on tri par silver/h décroissant, donc les valeurs
// aberrantes remontent d'elles-mêmes en haut de liste.
/** @param {HTMLElement} el. Section anti-triche : cadences horaires (silver/kills) les plus élevées + verrous de session actifs. */
function renderAdminPlayerRates(el) {
  el.innerHTML = admMonSkeleton('📊 ' + i18next.t('admin:admin.rates.title'), i18next.t('admin:admin.rates.sub'), 'admRatesBody');
  refreshAdminPlayerRates();
}
/** Charge et rend les cadences horaires (admin_player_rates_summary + admin_player_rates). */
async function refreshAdminPlayerRates() {
  if (!isAdmin() || !sb) return;
  const el = $a('admRatesBody');
  const [stats, top] = await Promise.all([
    sb.rpc('admin_player_rates_summary'),
    sb.rpc('admin_player_rates', { p_limit: 30 }),
  ]);
  if (stats.error) return admMonFail(el, stats.error);
  const s = (stats.data && stats.data[0]) || {};
  const rows = top.data || [];
  el.innerHTML = admMonTiles([
    { lbl:'⏱️ ' + i18next.t('admin:admin.rates.tile_hours'), val: admMonNum(s.hours_tracked) },
    { lbl:'👥 ' + i18next.t('admin:admin.rates.tile_players'), val: admMonNum(s.players_tracked) },
    { lbl:'💰 ' + i18next.t('admin:admin.rates.tile_max_silver'), val: admMonNum(s.max_silver_per_hour) },
    { lbl:'📉 ' + i18next.t('admin:admin.rates.tile_avg_silver'), val: admMonNum(s.avg_silver_per_hour) },
    { lbl:'⚔️ ' + i18next.t('admin:admin.rates.tile_max_kills'), val: admMonNum(s.max_kills_per_hour) },
    { lbl:'🔒 ' + i18next.t('admin:admin.rates.tile_locks'), val: admMonNum(s.active_session_locks) },
  ]) + (rows.length === 0
    ? `<div class="admEmpty">${i18next.t('admin:admin.rates.none')}</div>`
    : `<table class="admTable"><thead><tr>
        <th>${i18next.t('admin:admin.rates.col_player')}</th>
        <th>${i18next.t('admin:admin.rates.col_hour')}</th>
        <th>${i18next.t('admin:admin.rates.col_silver')}</th>
        <th>${i18next.t('admin:admin.rates.col_kills')}</th>
      </tr></thead><tbody>${rows.map(r => `<tr>
        <td>${escapeHtml(r.display_name || '—')}</td>
        <td style="font-size:10px">${admMonDate(r.hour)}</td>
        <td>${admMonNum(r.loot_silver)}</td>
        <td>${admMonNum(r.kills)}</td>
      </tr>`).join('')}</tbody></table>`);
}

// ---------- enregistrement dans le registre du shell ----------
// Nouvelle catégorie "Supervision" (erreurs + anti-abus) : ces deux sections ne parlent ni de
// joueurs ni d'économie ni de contenu, elles surveillent la SANTÉ TECHNIQUE du jeu.
ADMIN_SECTIONS.push({ cat:'monitoring', label:{fr:'Supervision',en:'Monitoring'}, items:[
  { id:'errors', icon:'🐞', label:{fr:'Erreurs client',en:'Client errors'}, render:renderAdminClientErrors },
  { id:'ratelimit', icon:'🛡️', label:{fr:'Limitation de débit',en:'Rate limiting'}, render:renderAdminRateLimit },
  { id:'rates', icon:'📊', label:{fr:'Cadence joueurs',en:'Player rates'}, render:renderAdminPlayerRates },
]});

/** @param {string} cat @param {string} id @param {Function} render. Remplace un item "planned" (ou en ajoute un) par une vraie section câblée -- no-op silencieux si la catégorie est absente. */
function admAttachSection(cat, id, render) {
  const group = ADMIN_SECTIONS.find(g => g.cat === cat);
  if (!group) return;
  const item = group.items.find(i => i.id === id);
  if (item) { delete item.planned; item.render = render; }
}
// Mini Boss rejoint "Contenu" (à côté des Boss mondiaux), le troc de familiers rejoint "Économie"
// (à côté du marché du jeu). PvP et Donations étaient déjà déclarés planned:true : on les câble.
const admContentGroup = ADMIN_SECTIONS.find(g => g.cat === 'content');
if (admContentGroup) admContentGroup.items.push(
  { id:'miniboss', icon:'📜', label:{fr:'Mini Boss',en:'Mini Boss'}, render:renderAdminMiniboss }
);
const admEconomyGroup = ADMIN_SECTIONS.find(g => g.cat === 'economy');
if (admEconomyGroup) admEconomyGroup.items.push(
  { id:'pettrade', icon:'🔄', label:{fr:'Marché Compagnon',en:'Companion market'}, render:renderAdminPetTrade }
);
admAttachSection('players', 'pvp', renderAdminPvp);
admAttachSection('economy', 'donations', renderAdminDonations);
