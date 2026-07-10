// ============================================================
// PANNEAU ADMIN — section "Économie" (2026-07-19, refonte complète, commit 2/2)
// Charge APRÈS src/admin/admin-panel.js (référence ADMIN_SECTIONS/ADMIN_THEMES déjà déclarés,
// et AJOUTE une catégorie 'economy' au registre au chargement immédiat -- voir index.dev.html
// pour le commentaire d'ordre). Regroupe tout ce qui est lourd en données/graphiques : santé
// économique (NOUVEAU, SVG), registre de silver, activité horaire, richesse, loyalties, marché,
// éditeur de la table de loot en % (NOUVEAU, table game_config + LOOT_RATES_LIVE).
// ============================================================

const CATEGORY_LABEL = {
  loot:{fr:'🎒 Butin au sol (trash)',en:'🎒 Ground loot (trash)'},
  sell:{fr:'🏷️ Ventes (sac)',en:'🏷️ Sales (bag)'},
  potion:{fr:'🧪 Potions',en:'🧪 Potions'},
  quest:{fr:'🗒️ Quêtes',en:'🗒️ Quests'},
  achievement:{fr:'🏅 Succès',en:'🏅 Achievements'},
  boss:{fr:'🐋 World Boss',en:'🐋 World Boss'},
  welcome:{fr:'🎁 Bonus de bienvenue',en:'🎁 Welcome bonus'},
  market_buy:{fr:'🏛️ Marché — achats',en:'🏛️ Market — buys'},
  market_sell:{fr:'🏛️ Marché — ventes',en:'🏛️ Market — sells'},
  market_refund:{fr:'🏛️ Marché — remboursements',en:'🏛️ Market — refunds'},
  undo_sell:{fr:'↩️ Annulation de vente',en:'↩️ Sale undo'},
  admin_test:{fr:'🛠️ Test admin',en:'🛠️ Admin test'},
};

// ---------- graphique silver en SVG (remplace les barres CSS .admBar/.admBarTrack) ----------
// fonction PURE (aucune dépendance DOM/réseau à l'intérieur) : prend les lignes déjà chargées de
// admin_silver_ledger_by_hour ({hour, net_delta}) et retourne une string SVG -- testable
// unitairement sans navigateur. rows vide -> SVG avec juste l'axe, jamais d'exception.
function buildSilverChartSvg(rows, accentColor, dangerColor) {
  // rapetissé le 2026-07-19 (640x140 -> 400x100) : ne doit plus s'étirer sur toute la largeur du
  // panneau, même convention de taille que buildBarSeriesSvg/les camemberts.
  const w = 400, h = 100, padT = 6, padB = 16;
  const midY = padT + (h - padT - padB) / 2;
  const sorted = (rows||[]).map(r => ({ hour:r.hour, net:Number(r.net_delta||0) }))
    .sort((a,b) => new Date(a.hour) - new Date(b.hour));
  const maxAbs = Math.max(1, ...sorted.map(r => Math.abs(r.net)));
  const barW = sorted.length ? Math.max(1.5, (w - 10) / sorted.length - 2) : 0;
  let bars = '';
  sorted.forEach((r, i) => {
    const x = 5 + i * (barW + 2);
    const bh = Math.abs(r.net) / maxAbs * (h - padT - padB) / 2;
    const y = r.net >= 0 ? midY - bh : midY;
    const col = r.net >= 0 ? accentColor : dangerColor;
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(bh,1).toFixed(1)}" rx="1.5" fill="${col}"></rect>`;
  });
  return `<svg class="admBarSeriesSvg" viewBox="0 0 ${w} ${h}" style="width:100%;max-width:420px;height:100px;display:block">` +
    `<line x1="5" y1="${midY}" x2="${w-5}" y2="${midY}" stroke="#2c2a33" stroke-width="1"></line>` +
    bars + `</svg>`;
}
function currentAdminAccentColors() {
  const overlay = $a('adminOverlay');
  const accent = overlay ? getComputedStyle(overlay).getPropertyValue('--gold').trim() || '#c9a55a' : '#c9a55a';
  const danger = overlay ? getComputedStyle(overlay).getPropertyValue('--danger').trim() || '#c05545' : '#c05545';
  return { accent, danger };
}

// ---------- graphiques compacts (2026-07-19, demande explicite : "modifie tout les graphique
// qu'il soit lisible avec camember et rapetisi pour eviter d'avoir des barre avec info a gauche et
// a droite de lecran merge les categorie si besoin") -- remplace les longues piles de .admBarRow
// (24h, 30 jours, N catégories) par des camemberts compacts + une série temporelle SVG resserrée.
// Toutes deux PURES (aucune dépendance DOM/réseau), testables sans navigateur. ----------
const PIE_PALETTE = ['#c9a55a','#5a8fc8','#8fc98a','#e05a6e','#a578d8','#e8b45a','#5ac8b0','#c8785a'];
// fusionne les entrées sous thresholdPct% du total dans un seul bucket "Autres"/"Other" -- évite
// un camembert à 12 fines tranches illisibles. Fonction PURE : ne dépend que de ses arguments.
function mergeSmallSlices(items, thresholdPct, otherLabel) {
  const total = items.reduce((a,i) => a + Math.max(0, Number(i.value)||0), 0);
  if (total <= 0) return [];
  const big = [], smallSum = { value: 0 };
  items.forEach(i => {
    const v = Math.max(0, Number(i.value)||0);
    if (v <= 0) return;
    if (v / total * 100 < thresholdPct) smallSum.value += v;
    else big.push({ label:i.label, value:v });
  });
  if (smallSum.value > 0) big.push({ label:otherLabel, value:smallSum.value });
  return big;
}
// camembert SVG pur -- prend des slices déjà { label, value, color }, retourne juste le <svg>.
// tableau vide -> cercle gris neutre, jamais d'exception.
function buildPieChartSvg(slices) {
  const size = 110, r = 50, cx = size/2, cy = size/2;
  const total = slices.reduce((a,s) => a + s.value, 0);
  if (total <= 0) return `<svg viewBox="0 0 ${size} ${size}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#2c2a33"></circle></svg>`;
  let angle = -Math.PI/2, paths = '';
  slices.forEach(s => {
    const frac = s.value / total;
    const a0 = angle, a1 = angle + frac * Math.PI * 2;
    angle = a1;
    if (frac >= 0.9999) { paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${s.color}"></circle>`; return; }
    const x0 = cx + r*Math.cos(a0), y0 = cy + r*Math.sin(a0);
    const x1 = cx + r*Math.cos(a1), y1 = cy + r*Math.sin(a1);
    const large = (a1 - a0) > Math.PI ? 1 : 0;
    paths += `<path d="M${cx},${cy} L${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z" fill="${s.color}"></path>`;
  });
  return `<svg viewBox="0 0 ${size} ${size}">${paths}</svg>`;
}
// camembert + légende (label, %, valeur formatée) -- point d'entrée utilisé par les render*().
// fuse automatiquement les petites tranches (<4% par défaut) dans "Autres"/"Other".
function buildPieWithLegendHtml(items, opts) {
  opts = opts || {};
  const otherLabel = LANG==='fr' ? 'Autres' : 'Other';
  const merged = mergeSmallSlices(items, opts.thresholdPct != null ? opts.thresholdPct : 4, otherLabel);
  if (!merged.length) return `<div class="admEmpty">${LANG==='fr'?'Pas encore de données':'No data yet'}</div>`;
  const total = merged.reduce((a,s) => a+s.value, 0);
  const slices = merged.map((s,i) => ({ ...s, color: PIE_PALETTE[i % PIE_PALETTE.length] }));
  const svg = buildPieChartSvg(slices);
  const legend = slices.map(s => {
    const pct = Math.round(s.value/total*100);
    const val = opts.formatValue ? opts.formatValue(s.value) : fmt(Math.round(s.value));
    return `<div class="lgRow"><span class="lgSwatch" style="background:${s.color}"></span><span class="lgLbl">${escapeHtml(s.label)} (${pct}%)</span><span class="lgVal">${val}</span></div>`;
  }).join('');
  return `<div class="admPieBlock">${svg}<div class="admPieLegend">${legend}</div></div>`;
}
// série temporelle en barres compactes (remplace les piles de .admBarRow pour 24h/30j) -- fonction
// PURE, points déjà triés chronologiquement par l'appelant. tableau vide -> juste l'axe.
function buildBarSeriesSvg(points, color) {
  const w = 400, h = 90, padB = 16, padT = 4;
  const maxV = Math.max(1, ...points.map(p => p.value));
  const barW = points.length ? Math.max(1.5, (w - 10) / points.length - 2) : 0;
  let bars = '';
  points.forEach((p, i) => {
    const x = 5 + i * (barW + 2);
    const bh = p.value / maxV * (h - padT - padB);
    const y = h - padB - bh;
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(bh,1).toFixed(1)}" rx="1" fill="${color}"></rect>`;
  });
  return `<svg class="admBarSeriesSvg" viewBox="0 0 ${w} ${h}" style="width:100%;max-width:420px;height:90px;display:block">` +
    `<line x1="5" y1="${h-padB}" x2="${w-5}" y2="${h-padB}" stroke="#2c2a33" stroke-width="1"></line>` +
    bars + `</svg>`;
}

// ---------- Alertes économiques (2026-07-20, demande explicite : "ajoute dans le dashboard tout,
// et surtout des alerte sil y a trop de quelque chose et qu'il faut créer un puit rapidement") --
// fonction PURE (aucune dépendance DOM/réseau) : prend les lignes déjà chargées de
// admin_silver_ledger_by_category ({category, gained, spent}) et retourne une liste d'alertes
// {icon, text} à afficher, jamais d'action automatique (juste un signal pour l'admin). Seuil de
// 500k gagné avant de se déclencher : évite le bruit sur un serveur de test avec très peu de
// données (un seul joueur qui gagne 200 silver ne doit pas déjà crier à l'inflation).
const ECON_ALERT_MIN_GAINED = 500000;
const ECON_ALERT_SINK_RATIO = 0.35;
function computeEconAlerts(categoryRows) {
  const rows = (categoryRows||[]).map(r => ({ gained:Number(r.total_gained||r.gained||0), spent:Number(r.total_spent||r.spent||0) }));
  const totalGained = rows.reduce((a,r) => a+r.gained, 0);
  const totalSpent = rows.reduce((a,r) => a+r.spent, 0);
  const alerts = [];
  if (totalGained >= ECON_ALERT_MIN_GAINED) {
    const ratio = totalGained > 0 ? totalSpent / totalGained : 0;
    if (ratio < ECON_ALERT_SINK_RATIO) {
      const pct = Math.round(ratio*100);
      alerts.push({ icon:'⚠️', text: LANG==='fr'
        ? `Seulement ${pct}% du silver gagné est réellement dépensé (sorti du jeu) — trop peu de puits, risque d'inflation. Envisage d'ajouter un puits (boutique, coût, sink) rapidement.`
        : `Only ${pct}% of gained silver is actually spent (sunk out of the game) — too few sinks, inflation risk. Consider adding a sink (shop, cost, drain) soon.` });
    }
  }
  return alerts;
}
function buildEconAlertsHtml(alerts) {
  if (!alerts.length) return '';
  return `<div class="admAlerts">${alerts.map(a => `<div class="admAlertBox">${a.icon} ${escapeHtml(a.text)}</div>`).join('')}</div>`;
}

// ---------- Économie → Santé économique (2 camemberts : sources / puits, par catégorie) ----------
function renderAdminEconHealth(el) {
  el.innerHTML = `<div class="admEmpty">${LANG==='fr'?'Chargement…':'Loading…'}</div>`;
  sb.from('admin_silver_ledger_by_category').select('*').then(({data}) => {
    const rows = (data||[]).map(r => ({
      category: r.category, gained: Number(r.total_gained||0), spent: Number(r.total_spent||0),
    }));
    const label = c => CATEGORY_LABEL[c] ? CATEGORY_LABEL[c][LANG] : c;
    const sources = rows.filter(r => r.gained > 0).map(r => ({ label:label(r.category), value:r.gained }));
    const sinks = rows.filter(r => r.spent > 0).map(r => ({ label:label(r.category), value:r.spent }));
    el.innerHTML = `${buildEconAlertsHtml(computeEconAlerts(rows))}
      <div class="admSummary">${LANG==='fr'
        ? 'Sources (gagné) vs puits (dépensé), par catégorie — même registre que "Silver", vue centrée sur l\'équilibre entrées/sorties. Catégories sous 4% du total fusionnées dans "Autres".'
        : 'Sources (gained) vs sinks (spent), by category — same ledger as "Silver", view centered on inflow/outflow balance. Categories under 4% of the total are merged into "Other".'}</div>
      <div class="admChartsRow">
        <div><h3 style="margin-top:0">${LANG==='fr'?'📥 Sources (gagné)':'📥 Sources (gained)'}</h3>${buildPieWithLegendHtml(sources)}</div>
        <div><h3 style="margin-top:0">${LANG==='fr'?'📤 Puits (dépensé)':'📤 Sinks (spent)'}</h3>${buildPieWithLegendHtml(sinks)}</div>
      </div>`;
  });
}

// ---------- Économie → Silver (registre détaillé + graphique SVG + taux de gain) ----------
function renderAdminSilver(el) {
  el.innerHTML = `<div class="admEmpty">${LANG==='fr'?'Chargement…':'Loading…'}</div>`;
  Promise.all([
    sb.from('admin_wealth').select('*'),
    sb.from('admin_silver_ledger_by_category').select('*'),
    sb.from('admin_silver_ledger_by_hour').select('*'),
    sb.from('player_stats').select('user_id, playtime_sec'),
    sb.rpc('admin_list_players'),
  ]).then(([{data: wealth}, {data: silverByCategory}, {data: silverByHour}, {data: stats}, {data: playersList}]) => {
    const nameByUser = new Map((playersList||[]).map(p => [p.user_id, p.display_name||'?']));
    const playtimeByUser = new Map((stats||[]).map(r => [r.user_id, Number(r.playtime_sec||0)]));
    const silvers = (wealth||[]).map(r => Number(r.silver||0));
    const totalSilver = silvers.reduce((a,b) => a+b, 0);
    const avgSilver = silvers.length ? Math.round(totalSilver/silvers.length) : 0;
    const totalEarned = (wealth||[]).reduce((a,r) => a + Number(r.silver_earned||0), 0);
    const totalSpent = Math.max(0, totalEarned - totalSilver);
    const catRows = (silverByCategory||[]).map(r => ({
      category: r.category, gained: Number(r.total_gained||0), spent: Number(r.total_spent||0), tx: Number(r.tx_count||0),
    }));
    const categoryHtml = catRows.map(r => {
      const label = CATEGORY_LABEL[r.category] ? CATEGORY_LABEL[r.category][LANG] : r.category;
      return `<tr><td>${escapeHtml(label)}</td><td class="admGain">+${fmt(r.gained)}</td><td class="admLoss">-${fmt(r.spent)}</td>` +
        `<td>${fmt(r.tx)}</td></tr>`;
    }).join('') || `<tr><td colspan="4" class="admEmpty">${LANG==='fr'?'Pas encore de données':'No data yet'}</td></tr>`;
    const { accent, danger } = currentAdminAccentColors();
    const chartSvg = buildSilverChartSvg(silverByHour, accent, danger);
    const rateRows = (wealth||[]).map(r => {
      const sec = playtimeByUser.get(r.user_id) || 0;
      const earned = Number(r.silver_earned||0);
      const hrs = sec / 3600;
      return { user_id:r.user_id, earned, sec, rate: hrs > 0.05 ? earned/hrs : 0 };
    }).filter(r => r.sec > 180).sort((a,b) => b.rate - a.rate).slice(0,15);
    const rateHtml = rateRows.map((r,i) => `
      <tr class="${i===0?'admTop':''}"><td>#${i+1}</td><td>${escapeHtml(nameByUser.get(r.user_id) || (r.user_id||'').slice(0,8)+'…')}</td>
        <td>${fmt(r.earned)}</td><td>${fmtAdmPlaytime(r.sec)}</td><td>${fmt(Math.round(r.rate))}/h</td></tr>
    `).join('') || `<tr><td colspan="5" class="admEmpty">${LANG==='fr'?'Pas encore de données (au moins 3 min de jeu requises)':'No data yet (at least 3 min playtime required)'}</td></tr>`;
    el.innerHTML = `<div class="admStatTiles">
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'🏦 Stocké (chez les joueurs)':'🏦 Stored (with players)'}</div><div class="astVal">${fmt(totalSilver)}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'📈 Gagné à vie':'📈 Lifetime earned'}</div><div class="astVal">${fmt(totalEarned)}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'🔻 Dépensé (sorti du jeu)':'🔻 Spent (sunk)'}</div><div class="astVal">${fmt(totalSpent)}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'📊 Moyenne / joueur':'📊 Average / player'}</div><div class="astVal">${fmt(avgSilver)}</div></div>
      </div>
      <h3>${LANG==='fr'?'📊 Flux net de silver par heure (48h)':'📊 Net silver flow per hour (48h)'}</h3>
      ${chartSvg}
      <h3>${LANG==='fr'?'🔍 Où partent les silver ? (registre détaillé)':'🔍 Where does the silver go? (detailed ledger)'}</h3>
      <div class="admHint">${LANG==='fr'?'Répartition visuelle par catégorie : voir la section "Santé économique".':'Visual breakdown by category: see the "Economic health" section.'}</div>
      <table class="admTable">
        <thead><tr><th>${LANG==='fr'?'Catégorie':'Category'}</th><th>${LANG==='fr'?'Gagné':'Gained'}</th><th>${LANG==='fr'?'Dépensé':'Spent'}</th><th>${LANG==='fr'?'Mouvements':'Transactions'}</th></tr></thead>
        <tbody>${categoryHtml}</tbody>
      </table>
      <h3>${LANG==='fr'?'🏆 Qui gagne le plus vite ? (taux à vie)':'🏆 Who earns fastest? (lifetime rate)'}</h3>
      <table class="admTable">
        <thead><tr><th>#</th><th>${LANG==='fr'?'Joueur':'Player'}</th><th>${LANG==='fr'?'Gagné à vie':'Lifetime earned'}</th><th>${LANG==='fr'?'Temps de jeu':'Playtime'}</th><th>${LANG==='fr'?'Taux':'Rate'}</th></tr></thead>
        <tbody>${rateHtml}</tbody>
      </table>`;
  });
}

// ---------- Économie → Activité horaire ----------
function renderAdminHourly(el) {
  el.innerHTML = `<div class="admEmpty">${LANG==='fr'?'Chargement…':'Loading…'}</div>`;
  Promise.all([
    sb.from('admin_farm_by_hour').select('*'),
    sb.from('admin_playtime_by_hour').select('*'),
  ]).then(([{data: byHour}, {data: playtimeByHour}]) => {
    const { accent } = currentAdminAccentColors();
    const hourMap = new Map();
    (byHour||[]).forEach(r => hourMap.set(r.hour, (hourMap.get(r.hour)||0) + Number(r.total_silver||0)));
    const hours = [...hourMap.entries()].sort((a,b) => new Date(a[0]) - new Date(b[0])).slice(-24);
    const hourChart = buildBarSeriesSvg(hours.map(([h,v]) => ({ label:h, value:v })), accent);
    const ptRows = (playtimeByHour||[]).map(r => ({ hour:r.hour, players:Number(r.players||0), sec:Number(r.playtime_sec||0) }))
      .sort((a,b) => new Date(a.hour) - new Date(b.hour)).slice(-24);
    const ptChart = buildBarSeriesSvg(ptRows.map(r => ({ label:r.hour, value:r.players })), accent);
    const maxHourEntry = hours.length ? hours.reduce((m,h) => h[1]>m[1]?h:m) : null;
    const maxPtEntry = ptRows.length ? ptRows.reduce((m,r) => r.players>m.players?r:m, ptRows[0]) : null;
    el.innerHTML = `<h3>${LANG==='fr'?'💰 Silver farmé par heure (48h)':'💰 Silver farmed per hour (48h)'}</h3>
      ${hourChart}
      <div class="admHint">${LANG==='fr'?'Pic :':'Peak:'} ${maxHourEntry ? fmt(maxHourEntry[1]) : '—'}</div>
      <h3>${LANG==='fr'?'👥 Joueurs actifs par heure (48h)':'👥 Active players per hour (48h)'}</h3>
      ${ptChart}
      <div class="admHint">${LANG==='fr'?'Pic :':'Peak:'} ${maxPtEntry ? maxPtEntry.players : '—'}</div>`;
  });
}

// ---------- Économie → Richesse ----------
function renderAdminWealth(el) {
  el.innerHTML = `<div class="admEmpty">${LANG==='fr'?'Chargement…':'Loading…'}</div>`;
  Promise.all([
    sb.from('admin_wealth').select('*'),
    sb.from('player_stats').select('user_id, playtime_sec'),
    sb.rpc('admin_list_players'),
  ]).then(([{data: wealth}, {data: stats}, {data: playersList}]) => {
    const nameByUser = new Map((playersList||[]).map(p => [p.user_id, p.display_name||'?']));
    const playtimeByUser = new Map((stats||[]).map(r => [r.user_id, Number(r.playtime_sec||0)]));
    const silvers = (wealth||[]).map(r => Number(r.silver||0)).sort((a,b) => a-b);
    const totalSilver = silvers.reduce((a,b) => a+b, 0);
    const avgSilver = silvers.length ? Math.round(totalSilver/silvers.length) : 0;
    const medSilver = silvers.length ? silvers[Math.floor(silvers.length/2)] : 0;
    const WEALTH_BRACKETS = [
      { max:10000, label:'< 10k' }, { max:100000, label:'10k-100k' }, { max:1000000, label:'100k-1M' },
      { max:10000000, label:'1M-10M' }, { max:Infinity, label:'10M+' },
    ];
    const bracketCounts = WEALTH_BRACKETS.map(() => 0);
    for (const v of silvers) {
      const idx = WEALTH_BRACKETS.findIndex(b => v < b.max);
      bracketCounts[idx >= 0 ? idx : WEALTH_BRACKETS.length-1]++;
    }
    // camembert (2026-07-19) au lieu de l'histogramme vertical -- les tranches restent ORDONNÉES
    // dans la légende (pas de fusion "Autres" ici, contrairement aux autres camemberts : seulement
    // 5 tranches fixes, jamais assez nombreuses pour devenir illisibles)
    const bracketPie = buildPieWithLegendHtml(
      WEALTH_BRACKETS.map((b,i) => ({ label:b.label, value:bracketCounts[i] })),
      { thresholdPct: 0, formatValue: v => String(Math.round(v)) }
    );
    const wealthHtml = (wealth||[]).slice(0,20).map((r,i) => `
      <tr><td>#${i+1}</td><td>${escapeHtml(nameByUser.get(r.user_id) || (r.user_id||'').slice(0,8)+'…')}</td><td>${fmt(r.silver||0)}</td><td>${r.lvl||1}</td><td>${fmtAdmPlaytime(playtimeByUser.get(r.user_id)||0)}</td></tr>
    `).join('') || `<tr><td colspan="5" class="admEmpty">${LANG==='fr'?'Pas encore de données':'No data yet'}</td></tr>`;
    el.innerHTML = `<div class="admStatTiles">
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'💰 Total en jeu':'💰 Total in game'}</div><div class="astVal">${fmt(totalSilver)}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'📊 Moyenne / joueur':'📊 Average / player'}</div><div class="astVal">${fmt(avgSilver)}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'📍 Médiane':'📍 Median'}</div><div class="astVal">${fmt(medSilver)}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'👥 Joueurs':'👥 Players'}</div><div class="astVal">${silvers.length}</div></div>
      </div>
      <h3>${LANG==='fr'?'📈 Répartition des joueurs par richesse':'📈 Players by wealth bracket'}</h3>
      ${bracketPie}
      <table class="admTable">
        <thead><tr><th>#</th><th>${LANG==='fr'?'Joueur':'Player'}</th><th>Silver</th><th>Niv.</th><th>${LANG==='fr'?'Temps de jeu':'Playtime'}</th></tr></thead>
        <tbody>${wealthHtml}</tbody>
      </table>`;
  });
}

// ---------- Économie → Loyalties ----------
function renderAdminLoyalty(el) {
  el.innerHTML = `<div class="admEmpty">${LANG==='fr'?'Chargement…':'Loading…'}</div>`;
  sb.from('player_stats').select('loyalty').then(({data: stats}) => {
    const loyaltyVals = (stats||[]).map(r => Number(r.loyalty||0));
    const loyaltyTotal = loyaltyVals.reduce((a,b) => a+b, 0);
    const loyaltyAvg = loyaltyVals.length ? Math.round(loyaltyTotal/loyaltyVals.length) : 0;
    el.innerHTML = `<div class="admStatTiles">
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'🏅 Total en jeu':'🏅 Total in game'}</div><div class="astVal">${fmt(loyaltyTotal)}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'📊 Moyenne / joueur':'📊 Average / player'}</div><div class="astVal">${fmt(loyaltyAvg)}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'👥 Joueurs':'👥 Players'}</div><div class="astVal">${loyaltyVals.length}</div></div>
      </div>
      <h3>${LANG==='fr'?'🛍️ Utilisées pour':'🛍️ Used to buy'}</h3>
      <div class="admEmpty">${LANG==='fr'
        ? 'Aucune boutique Loyalties en jeu pour l\'instant — rien à dépenser, ces stats servent à suivre l\'accumulation avant d\'ouvrir une boutique.'
        : 'No Loyalties shop in game yet — nothing to spend it on, these stats track accumulation ahead of opening a shop.'}</div>`;
  });
}

// ---------- Économie → Marché (lockdown + annulation en masse) ----------
function renderAdminMarket(el) {
  el.innerHTML = `
    <div class="admSection riskGlobal">
      <div class="admSectionTitle">🏛️ ${LANG==='fr'?'Marché':'Market'}</div>
      <div class="admSectionSub">⚠️ ${LANG==='fr'?'Ferme l\'accès au Marché pour TOUT LE MONDE sauf toi ; l\'annulation rembourse chaque ordre ouvert (silver ou objet) à son propriétaire.':'Closes Market access for EVERYONE except you; cancelling refunds every open order (silver or item) to its owner.'}</div>
      <div class="admActions">
        <button id="btnMarketToggle">${LANG==='fr'?'Chargement…':'Loading…'}</button>
        <button id="btnMarketCancelAll" style="border-color:var(--danger);color:#e8a89f">💥 ${LANG==='fr'?'Annuler tous les ordres ouverts':'Cancel all open orders'}</button>
      </div>
      <div id="admMarketStatus" class="admHint"></div>
    </div>`;
  async function refreshMarketAdminStatus() {
    const btn = $a('btnMarketToggle'); if (!btn) return;
    const { data } = await sb.rpc('get_market_open');
    const open = data !== false;
    btn.textContent = open
      ? (LANG==='fr'?'🔓 Marché ouvert (clique pour fermer)':'🔓 Market open (click to close)')
      : (LANG==='fr'?'🔒 Marché fermé (clique pour rouvrir)':'🔒 Market closed (click to reopen)');
    btn.style.borderColor = open ? '' : 'var(--danger)';
    btn.style.color = open ? '' : '#e8a89f';
  }
  refreshMarketAdminStatus();
  $a('btnMarketToggle').onclick = async () => {
    if (!isAdmin() || !sb) return;
    const { data } = await sb.rpc('get_market_open');
    const nextOpen = data === false;
    const { error } = await sb.rpc('admin_set_market_open', { p_open: nextOpen });
    if (!error) {
      logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a ${nextOpen?'rouvert':'fermé'} le Marché`, 0x9cc9e8);
      await refreshMarketAdminStatus();
    }
    floatTxt(P.x, P.y, 100, !error ? (nextOpen?(LANG==='fr'?'Marché rouvert ✓':'Market reopened ✓'):(LANG==='fr'?'Marché fermé ✓':'Market closed ✓')) : (LANG==='fr'?'Échec':'Failed'), { gold:!error, hurt:!!error });
  };
  $a('btnMarketCancelAll').onclick = async () => {
    if (!isAdmin() || !sb) return;
    if (!confirm(LANG==='fr'
      ? '💥 Annuler TOUS les ordres ouverts du Marché ? Chaque ordre sera remboursé (silver ou objet) à son propriétaire. Irréversible.'
      : '💥 Cancel ALL open Market orders? Each order will be refunded (silver or item) to its owner. Irreversible.')) return;
    const { data, error } = await sb.rpc('admin_cancel_all_market_orders');
    if (!error) logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a annulé ${data} ordre(s) de marché (remboursés)`, 0xc05545);
    const msg = error ? (LANG==='fr'?'Échec — '+error.message:'Failed — '+error.message)
      : (LANG==='fr'?`${data} ordre(s) annulé(s) et remboursé(s) ✓`:`${data} order(s) cancelled and refunded ✓`);
    $a('admMarketStatus').textContent = msg;
    floatTxt(P.x, P.y, 100, msg, { gold:!error, hurt:!!error });
  };
}

// ---------- Économie → Volume du marché (NOUVEAU, 2026-07-19) — top objets échangés (30j) +
// volume total. Distinct de la section "Marché" ci-dessus (lockdown/annulation) : ici c'est de la
// lecture pure, aucune action. admin_market_top_items (SECURITY DEFINER) agrège côté serveur
// plutôt que de renvoyer les lignes brutes de market_trades au client. ----------
function renderAdminMarketVolume(el) {
  el.innerHTML = `<div class="admEmpty">${LANG==='fr'?'Chargement…':'Loading…'}</div>`;
  sb.rpc('admin_market_top_items', { p_days: 30 }).then(({data, error}) => {
    if (error) { el.innerHTML = `<div class="admHint">${escapeHtml(error.message)}</div>`; return; }
    const rows = data || [];
    const totalVolume = rows.reduce((a,r) => a + Number(r.total_silver_value||0), 0);
    const totalTrades = rows.reduce((a,r) => a + Number(r.trade_count||0), 0);
    const itemHtml = rows.map((r,i) => `
      <tr class="${i===0?'admTop':''}"><td>${tr(r.item_name) || escapeHtml(r.item_name)}</td>
        <td>${fmt(r.trade_count)}</td><td>${fmt(r.total_qty)}</td><td>${fmt(r.total_silver_value)}</td></tr>
    `).join('') || `<tr><td colspan="4" class="admEmpty">${LANG==='fr'?'Aucun échange sur les 30 derniers jours':'No trades in the last 30 days'}</td></tr>`;
    const pie = buildPieWithLegendHtml(rows.map(r => ({ label: tr(r.item_name) || r.item_name, value: Number(r.total_silver_value||0) })));
    el.innerHTML = `<div class="admStatTiles">
        <div class="admStatTile"><div class="astLbl">💱 ${LANG==='fr'?'Volume total (30j)':'Total volume (30d)'}</div><div class="astVal">${fmt(totalVolume)}</div></div>
        <div class="admStatTile"><div class="astLbl">🔄 ${LANG==='fr'?'Échanges (30j)':'Trades (30d)'}</div><div class="astVal">${fmt(totalTrades)}</div></div>
      </div>
      <h3>${LANG==='fr'?'🏆 Part de valeur par objet':'🏆 Value share by item'}</h3>
      ${pie}
      <h3>${LANG==='fr'?'Détail':'Detail'}</h3>
      <table class="admTable">
        <thead><tr><th>${LANG==='fr'?'Objet':'Item'}</th><th>${LANG==='fr'?'Échanges':'Trades'}</th><th>Qté</th><th>${LANG==='fr'?'Valeur totale':'Total value'}</th></tr></thead>
        <tbody>${itemHtml}</tbody>
      </table>`;
  });
}

// ---------- Vue d'ensemble → Inscriptions (NOUVEAU, 2026-07-19) — courbe des créations de compte
// par jour (30j). auth.users n'est pas exposé via PostgREST, seule une RPC SECURITY DEFINER peut
// y accéder -- admin_signups_by_day() (voir la migration). ----------
function renderAdminSignups(el) {
  el.innerHTML = `<div class="admEmpty">${LANG==='fr'?'Chargement…':'Loading…'}</div>`;
  Promise.all([
    sb.rpc('admin_signups_by_day', { p_days: 30 }),
    sb.rpc('admin_signups_by_provider'),
  ]).then(([{data, error}, { data: byProvider, error: provError }]) => {
    if (error) { el.innerHTML = `<div class="admHint">${escapeHtml(error.message)}</div>`; return; }
    const rows = data || [];
    const total = rows.reduce((a,r) => a + Number(r.signups||0), 0);
    const { accent } = currentAdminAccentColors();
    const chart = rows.length
      ? buildBarSeriesSvg(rows.map(r => ({ label:r.day, value:Number(r.signups||0) })), accent)
      : `<div class="admEmpty">${LANG==='fr'?'Aucune inscription sur les 30 derniers jours':'No signups in the last 30 days'}</div>`;
    // camembert par plateforme (2026-07-20, demande explicite : "montre avec quoi les joueur se
    // sont inscrit comme plateforme ... et tu peux créer un graph aussi") -- providerInfo() vient
    // de admin-panel.js, chargé AVANT ce fichier (voir index.dev.html), donc jamais de risque de TDZ.
    const providerPie = !provError && (byProvider||[]).length
      ? buildPieWithLegendHtml((byProvider||[]).map(r => ({ label: providerInfo(r.provider).icon + ' ' + providerInfo(r.provider).label[LANG], value: Number(r.signups||0) })), { thresholdPct:0 })
      : `<div class="admEmpty">${LANG==='fr'?'Pas encore de données':'No data yet'}</div>`;
    el.innerHTML = `<div class="admStatTiles">
        <div class="admStatTile"><div class="astLbl">🆕 ${LANG==='fr'?'Inscriptions (30j)':'Signups (30d)'}</div><div class="astVal">${total}</div></div>
      </div>
      <h3>${LANG==='fr'?'📅 Par jour':'📅 By day'}</h3>
      ${chart}
      <h3>${LANG==='fr'?'🧩 Par plateforme (tous comptes)':'🧩 By platform (all accounts)'}</h3>
      ${providerPie}`;
  });
}

// ---------- éditeur de la table de loot en % (NOUVEAU) — hook lu par renderAdminLoot()
// (src/admin/admin-panel.js), jamais appelé directement par le shell ----------
const LOOT_RATE_GRADES = [
  { grade:'grey', label:{fr:'Gris',en:'Grey'} }, { grade:'white', label:{fr:'Blanc',en:'White'} },
  { grade:'green', label:{fr:'Vert',en:'Green'} }, { grade:'blue', label:{fr:'Bleu',en:'Blue'} },
];
function buildLootRateEditorHtml() {
  return `<h3>${LANG==='fr'?'🛠️ Éditeur de taux (V2, en direct)':'🛠️ Rate editor (V2, live)'}</h3>
    <div class="admHint">${LANG==='fr'
      ? 'Modifie les taux réellement utilisés par TOUS les joueurs (si la table de loot est en V2), rechargés à la connexion. Les valeurs par défaut du jeu restent inchangées en dur — "Réinitialiser" les restaure à tout moment.'
      : 'Changes the rates actually used by ALL players (while the loot table is on V2), reloaded on login. The game\'s default values stay unchanged in code — "Reset" restores them anytime.'}</div>
    <table class="admTable"><thead><tr><th>${LANG==='fr'?'Palier':'Tier'}</th><th>${LANG==='fr'?'Armure/Arme (%)':'Armor/Weapon (%)'}</th><th>${LANG==='fr'?'Bijou (%)':'Jewel (%)'}</th></tr></thead>
      <tbody>${LOOT_RATE_GRADES.map(g => `<tr>
        <td>${g.label[LANG]}</td>
        <td><input type="number" step="0.01" min="0" max="100" id="admLootGear_${g.grade}" value="${(LOOT_RATES_LIVE[g.grade].gear*100).toFixed(2)}" style="width:80px"></td>
        <td><input type="number" step="0.001" min="0" max="100" id="admLootJewel_${g.grade}" value="${(LOOT_RATES_LIVE[g.grade].jewel*100).toFixed(3)}" style="width:80px"></td>
      </tr>`).join('')}</tbody>
    </table>
    <div class="admActions">
      <button id="btnSaveLootRates">💾 ${LANG==='fr'?'Enregistrer (tous les joueurs)':'Save (all players)'}</button>
      <button id="btnResetLootRates">🔄 ${LANG==='fr'?'Réinitialiser aux valeurs du jeu':'Reset to game defaults'}</button>
    </div>
    <div id="admLootRateStatus" class="admHint"></div>`;
}
function wireLootRateEditor() {
  const saveBtn = $a('btnSaveLootRates'); if (!saveBtn) return; // pane pas affichée / hook pas rendu
  saveBtn.onclick = async () => {
    if (!isAdmin() || !sb) return;
    const rates = {};
    for (const g of LOOT_RATE_GRADES) {
      const gearEl = $a('admLootGear_'+g.grade), jewelEl = $a('admLootJewel_'+g.grade);
      rates[g.grade] = { gear: Number(gearEl.value)/100, jewel: Number(jewelEl.value)/100 };
    }
    const { error } = await sb.rpc('admin_set_loot_rates', { p_rates: rates });
    const statusEl = $a('admLootRateStatus');
    if (error) { statusEl.textContent = (LANG==='fr'?'Échec — ':'Failed — ') + error.message; statusEl.classList.add('warn'); return; }
    for (const g of LOOT_RATE_GRADES) LOOT_RATES_LIVE[g.grade] = rates[g.grade];
    logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a modifié les taux de la table de loot V2`, 0x9cc9e8);
    statusEl.classList.remove('warn');
    statusEl.textContent = LANG==='fr' ? 'Enregistré — appliqué immédiatement à tous les joueurs ✓' : 'Saved — applied immediately to all players ✓';
    floatTxt(P.x, P.y, 100, LANG==='fr'?'Taux de loot mis à jour ✓':'Loot rates updated ✓', { gold:true });
  };
  const resetBtn = $a('btnResetLootRates');
  if (resetBtn) resetBtn.onclick = async () => {
    if (!isAdmin() || !sb) return;
    if (!confirm(LANG==='fr' ? 'Réinitialiser les taux aux valeurs par défaut du jeu, pour TOUS les joueurs ?' : 'Reset rates to the game\'s default values, for ALL players?')) return;
    const defaults = JSON.parse(JSON.stringify(LOOT_RATES_V2));
    const { error } = await sb.rpc('admin_set_loot_rates', { p_rates: defaults });
    if (!error) { LOOT_RATES_LIVE = defaults; renderAdminLoot($a('adminMainBody')); logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a réinitialisé les taux de la table de loot V2`, 0x9cc9e8); }
    floatTxt(P.x, P.y, 100, !error ? (LANG==='fr'?'Taux réinitialisés ✓':'Rates reset ✓') : (LANG==='fr'?'Échec':'Failed'), { gold:!error, hurt:!!error });
  };
}

// ---------- enregistrement de la catégorie "Économie" dans le registre du shell (chargement
// immédiat -- ADMIN_SECTIONS existe déjà, déclaré dans admin-panel.js qui charge AVANT ce fichier,
// voir index.dev.html) : insérée après "players", avant "content", même ordre que la sidebar
// visée dans le plan de refonte. ----------
ADMIN_SECTIONS.splice(2, 0, { cat:'economy', label:{fr:'Économie',en:'Economy'}, items:[
  { id:'health', icon:'💹', label:{fr:'Santé économique',en:'Economic health'}, render:renderAdminEconHealth },
  { id:'silver', icon:'🏦', label:{fr:'Silver',en:'Silver'}, render:renderAdminSilver },
  { id:'hourly', icon:'⏱️', label:{fr:'Activité horaire',en:'Hourly activity'}, render:renderAdminHourly },
  { id:'wealth', icon:'📈', label:{fr:'Richesse',en:'Wealth'}, render:renderAdminWealth },
  { id:'loyalty', icon:'🏅', label:{fr:'Loyalties',en:'Loyalties'}, render:renderAdminLoyalty },
  { id:'market', icon:'🏛️', label:{fr:'Marché',en:'Market'}, render:renderAdminMarket },
  { id:'marketvolume', icon:'💱', label:{fr:'Volume du marché',en:'Market volume'}, render:renderAdminMarketVolume },
  { id:'donations', icon:'💝', label:{fr:'Donations',en:'Donations'}, planned:true },
]});
// "Inscriptions" rejoint "Vue d'ensemble" (groupe déjà déclaré dans admin-panel.js, qui charge
// AVANT ce fichier) -- .push() sur son tableau items existant plutôt qu'un nouveau groupe pour 1 item.
const adminOverviewGroup = ADMIN_SECTIONS.find(g => g.cat === 'overview');
if (adminOverviewGroup) adminOverviewGroup.items.push(
  { id:'signups', icon:'🆕', label:{fr:'Inscriptions',en:'Signups'}, render:renderAdminSignups }
);
