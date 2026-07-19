// ============================================================
// Sections admin "Contenu" -- extrait de src/admin/admin-panel.js le 2026-07-19 (audit CLAUDE.md
// §"Taille des fichiers" : le shell dépassait 1000 lignes, découpe obligatoire). AUCUN changement
// de comportement : les fonctions sont déplacées telles quelles.
//
// Contenu : table de loot (V1/V2 + éditeur), ressources farmées, Pierres de Cron, Trésor de Velia,
// progression par zone, Compendium, tutoriels d'objets, onboarding, Compagnons.
//
// Charge APRÈS admin-panel.js (qui déclare ADMIN_SECTIONS et le shell) -- voir l'ordre des
// <script> dans index.dev.html. Même convention de référence paresseuse que admin-players.js.
// ============================================================

// table de loot V1/V2 (2026-07-15, demande explicite : "utilise ces valeurs pour le loot des a
// present garde a memoire v1 le loot davant et ça c'est la v2 a tout moment je repasse en v1") --
// S.lootTableVersion pilote gearDropChance/jewelDropChance (game-core.js). Les 2 tables restent
// visibles ici pour comparer, jamais perdues même quand une seule est active.
/** @returns {string} HTML du sélecteur de version de table de loot (V1/V2, S.lootTableVersion) + tableau récapitulatif des taux V2. */
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
/** Câble les boutons V1/V2 de bascule de la table de loot active (S.lootTableVersion). */
function wireLootVersionButtons() {
  const v1Btn = $a('btnLootVerV1'), v2Btn = $a('btnLootVerV2');
  if (v1Btn) v1Btn.onclick = () => { if(!isAdmin())return; S.lootTableVersion = 'v1'; renderAdminLoot($a('adminMainBody')); floatTxt(P.x,P.y,100,'Loot V1',{blue:true}); };
  if (v2Btn) v2Btn.onclick = () => { if(!isAdmin())return; S.lootTableVersion = 'v2'; renderAdminLoot($a('adminMainBody')); floatTxt(P.x,P.y,100,'Loot V2',{gold:true}); };
}
// point d'extension pour admin-economy.js (éditeur de taux en %, ajouté séparément) -- lu au
// moment du RENDU (pas au chargement), donc aucun risque d'ordre de chargement/TDZ : si
// admin-economy.js n'est pas encore chargé (ou n'existe pas), la table reste juste en lecture seule.
/** @param {HTMLElement} el. Section admin "Table de loot" : sélecteur V1/V2 + éditeur de taux en % si admin-economy.js est chargé (typeof guard, sinon lecture seule). */
function renderAdminLoot(el) {
  el.innerHTML = buildLootVersionTabHtml() + (typeof buildLootRateEditorHtml === 'function' ? buildLootRateEditorHtml() : '');
  wireLootVersionButtons();
  if (typeof wireLootRateEditor === 'function') wireLootRateEditor();
}

// ---------- sections "Contenu" réutilisant les données déjà chargées côté serveur (RPC/tables
// identiques à l'ancien panneau, juste ré-agencées en render(container) indépendants) ----------
/** @param {HTMLElement} el. Section admin "Ressources farmées" : top 20 objets par volume (RPC/table admin_farm_by_item). */
function renderAdminItems(el) {
  el.innerHTML = `<div class="admEmpty">${i18next.t('admin:admin.common.loading')}</div>`;
  sb.from('admin_farm_by_item').select('item_name, item_kind, pickups, total_qty, total_silver').limit(20).then(({data}) => {
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
/** @param {HTMLElement} el. Section admin "Pierres de Cron" : farmé vs utilisé (journalisé via queueFarmEvent kind='cron_used'), coût par palier, camembert de répartition. */
function renderAdminCron(el) {
  el.innerHTML = `<div class="admEmpty">${i18next.t('admin:admin.common.loading')}</div>`;
  Promise.all([
    sb.from('admin_farm_by_item').select('item_name, item_kind, pickups, total_qty'),
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
/** @param {HTMLElement} el. Section admin "Trésor de Velia" : chance/kill, kills moyens et temps estimé pour chaque objet (référence ADMIN_TREASURE_KPM_REF). */
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
/** @param {HTMLElement} el. Section admin "Progression par zone" : camemberts de répartition par meilleure zone atteinte et par tranche de Gearscore (player_stats). */
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
/** @param {HTMLElement} el. Section admin "Compendium" : distribution de la complétion globale (player_stats.compendium_pct) par tranche, en lecture seule. */
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
/** @param {HTMLElement} el. Section admin "Tutoriels d'objets" : taux de complétion/passage par tutoriel (RPC admin_item_tutorial_stats), lecture seule. */
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
/** @param {HTMLElement} el. Section admin "Onboarding" : taux de démarrage/complétion/abandon du tutoriel d'arrivée (RPC admin_onboarding_stats/admin_onboarding_dropoff), entonnoir d'abandon par étape. */
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
// 20260719190000_companion_stats.sql), alimentée par companions/sync.js (poussé toutes
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
/** @param {object[]} rows - lignes admin_companion_breakdown() (une par joueur). @param {string} field - 'rarity_breakdown'/'tier_breakdown'/'section_breakdown'. @returns {object} totaux {clé:compte} sommés sur tous les joueurs. Fonction pure. */
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
/** @param {HTMLElement} el. Section admin "Compagnons" : stats agrégées (pets/silver/fusions/succès/pity/index), répartitions rareté/section/tier, liste des joueurs fusionneurs actifs. */
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
