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
  const w = 640, h = 140, padT = 6, padB = 20;
  const midY = padT + (h - padT - padB) / 2;
  const sorted = (rows||[]).map(r => ({ hour:r.hour, net:Number(r.net_delta||0) }))
    .sort((a,b) => new Date(a.hour) - new Date(b.hour));
  const maxAbs = Math.max(1, ...sorted.map(r => Math.abs(r.net)));
  const barW = sorted.length ? Math.max(2, (w - 20) / sorted.length - 3) : 0;
  let bars = '';
  sorted.forEach((r, i) => {
    const x = 10 + i * (barW + 3);
    const bh = Math.abs(r.net) / maxAbs * (h - padT - padB) / 2;
    const y = r.net >= 0 ? midY - bh : midY;
    const col = r.net >= 0 ? accentColor : dangerColor;
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(bh,1).toFixed(1)}" rx="1.5" fill="${col}"></rect>`;
  });
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:140px;display:block">` +
    `<line x1="10" y1="${midY}" x2="${w-10}" y2="${midY}" stroke="#2c2a33" stroke-width="1"></line>` +
    bars + `</svg>`;
}
function currentAdminAccentColors() {
  const overlay = $a('adminOverlay');
  const accent = overlay ? getComputedStyle(overlay).getPropertyValue('--gold').trim() || '#c9a55a' : '#c9a55a';
  const danger = overlay ? getComputedStyle(overlay).getPropertyValue('--danger').trim() || '#c05545' : '#c05545';
  return { accent, danger };
}

// ---------- Économie → Santé économique (NOUVEAU) ----------
function renderAdminEconHealth(el) {
  el.innerHTML = `<div class="admEmpty">${LANG==='fr'?'Chargement…':'Loading…'}</div>`;
  sb.from('admin_silver_ledger_by_category').select('*').then(({data}) => {
    const rows = (data||[]).map(r => ({
      category: r.category, gained: Number(r.total_gained||0), spent: Number(r.total_spent||0),
    }));
    const maxVol = Math.max(1, ...rows.map(r => r.gained + r.spent));
    const { accent, danger } = currentAdminAccentColors();
    const bars = rows.map(r => {
      const label = CATEGORY_LABEL[r.category] ? CATEGORY_LABEL[r.category][LANG] : r.category;
      const isGain = r.gained > 0;
      const pct = Math.round((r.gained + r.spent) / maxVol * 100);
      const val = isGain ? '+' + fmt(r.gained) : '-' + fmt(r.spent);
      const col = isGain ? accent : danger;
      return `<div class="admBarRow"><span class="admBarLbl">${escapeHtml(label)}</span>` +
        `<div class="admBarTrack"><div class="admBar" style="width:${pct}%;background:${col}"></div></div>` +
        `<span class="admBarVal" style="color:${col}">${val}</span></div>`;
    }).join('') || `<div class="admEmpty">${LANG==='fr'?'Pas encore de données':'No data yet'}</div>`;
    el.innerHTML = `<div class="admSummary">${LANG==='fr'
        ? 'Sources (gagné) vs puits (dépensé), par catégorie — même registre que "Silver", vue centrée sur l\'équilibre entrées/sorties.'
        : 'Sources (gained) vs sinks (spent), by category — same ledger as "Silver", view centered on inflow/outflow balance.'}</div>
      <div class="admBars">${bars}</div>`;
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
    const maxCatVolume = Math.max(1, ...catRows.map(r => r.gained + r.spent));
    const categoryHtml = catRows.map(r => {
      const label = CATEGORY_LABEL[r.category] ? CATEGORY_LABEL[r.category][LANG] : r.category;
      const pct = Math.round((r.gained + r.spent) / maxCatVolume * 100);
      return `<tr><td>${escapeHtml(label)}</td><td class="admGain">+${fmt(r.gained)}</td><td class="admLoss">-${fmt(r.spent)}</td>` +
        `<td>${fmt(r.tx)}</td><td><div class="admBarTrack"><div class="admBar" style="width:${pct}%"></div></div></td></tr>`;
    }).join('') || `<tr><td colspan="5" class="admEmpty">${LANG==='fr'?'Pas encore de données':'No data yet'}</td></tr>`;
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
      <table class="admTable">
        <thead><tr><th>${LANG==='fr'?'Catégorie':'Category'}</th><th>${LANG==='fr'?'Gagné':'Gained'}</th><th>${LANG==='fr'?'Dépensé':'Spent'}</th><th>${LANG==='fr'?'Mouvements':'Transactions'}</th><th>${LANG==='fr'?'Volume':'Volume'}</th></tr></thead>
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
    const hourMap = new Map();
    (byHour||[]).forEach(r => hourMap.set(r.hour, (hourMap.get(r.hour)||0) + Number(r.total_silver||0)));
    const hours = [...hourMap.entries()].sort((a,b) => new Date(b[0]) - new Date(a[0])).slice(0,24);
    const maxSilver = Math.max(1, ...hours.map(h => h[1]));
    const hourHtml = hours.map(([h,v]) => {
      const label = new Date(h).toLocaleString(LANG==='fr'?'fr-FR':'en-US', { hour:'2-digit', day:'2-digit', month:'2-digit' });
      const pct = Math.round(v/maxSilver*100);
      return `<div class="admBarRow"><span class="admBarLbl">${label}</span><div class="admBarTrack"><div class="admBar" style="width:${pct}%"></div></div><span class="admBarVal">${fmt(v)}</span></div>`;
    }).join('') || `<div class="admEmpty">${LANG==='fr'?'Pas encore de données':'No data yet'}</div>`;
    const ptRows = (playtimeByHour||[]).map(r => ({ hour:r.hour, players:Number(r.players||0), sec:Number(r.playtime_sec||0) }))
      .sort((a,b) => new Date(b.hour) - new Date(a.hour)).slice(0,24);
    const maxPlayers = Math.max(1, ...ptRows.map(r => r.players));
    const ptHourHtml = ptRows.map(r => {
      const label = new Date(r.hour).toLocaleString(LANG==='fr'?'fr-FR':'en-US', { hour:'2-digit', day:'2-digit', month:'2-digit' });
      const pct = Math.round(r.players/maxPlayers*100);
      return `<div class="admBarRow"><span class="admBarLbl">${label}</span><div class="admBarTrack"><div class="admBar" style="width:${pct}%"></div></div><span class="admBarVal">${r.players} · ${fmtAdmPlaytime(r.sec)}</span></div>`;
    }).join('') || `<div class="admEmpty">${LANG==='fr'?'Pas encore de données':'No data yet'}</div>`;
    el.innerHTML = `<h3>${LANG==='fr'?'💰 Silver farmé par heure (48h)':'💰 Silver farmed per hour (48h)'}</h3>
      <div class="admBars">${hourHtml}</div>
      <h3>${LANG==='fr'?'👥 Joueurs actifs par heure (48h)':'👥 Active players per hour (48h)'}</h3>
      <div class="admBars">${ptHourHtml}</div>`;
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
    const maxBracketCount = Math.max(1, ...bracketCounts);
    const histHtml = WEALTH_BRACKETS.map((b,i) => {
      const pct = Math.max(2, Math.round(bracketCounts[i]/maxBracketCount*100));
      return `<div class="admHistBar"><span class="ahbCount">${bracketCounts[i]}</span><div class="ahbFill" style="height:${pct}%"></div><span class="ahbLbl">${b.label}</span></div>`;
    }).join('');
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
      <div class="admHistBars">${histHtml}</div>
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
  { id:'donations', icon:'💝', label:{fr:'Donations',en:'Donations'}, planned:true },
]});
