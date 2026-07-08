// ============================================================
// HÔTEL DES VENTES
// ============================================================
function marketRequireAuth() {
  if (!sb || !currentUser) { alert('Connecte-toi pour accéder au marché.'); return false; }
  if (isGuest()) {
    alert(LANG==='fr'
      ? 'Le Marché et le Classement sont réservés aux comptes vérifiés (protection anti-triche). Clique sur "🔗 Lier un compte" pour en créer un — ta progression actuelle sera conservée.'
      : 'The Market and Leaderboard are restricted to verified accounts (anti-cheat protection). Click "🔗 Link account" to create one — your current progress will be kept.');
    return false;
  }
  return true;
}

// fermeture d'urgence du marché (2026-07-16, demande explicite : "bloquer l'acces au marché laisse
// lacces a admin") -- get_market_open() (côté serveur, voir la migration
// market_lockdown_and_cancel_all) fait aussi foi côté RPC (market_place_order refuse tout nouvel
// ordre si fermé) ; ce blocage client évite juste d'ouvrir le panneau pour rien et explique
// pourquoi. L'admin garde toujours l'accès (même logique staff-only que le serveur).
$a('btnMarket').onclick = async () => {
  if (!marketRequireAuth()) return;
  if (!(typeof isAdmin === 'function' && isAdmin())) {
    try {
      const { data } = await sb.rpc('get_market_open');
      if (data === false) {
        alert(LANG==='fr'
          ? '🏛️ Le Marché est actuellement fermé pour maintenance. Réessaie plus tard.'
          : '🏛️ The Market is currently closed for maintenance. Try again later.');
        return;
      }
    } catch(e) {}
  }
  $a('marketOverlay').classList.add('open');
  refreshMarketBrowse();
  refreshSellTab();
  refreshMarketMine();
};
$a('closeMarket').onclick = () => $a('marketOverlay').classList.remove('open');
let marketMouseDownOnBackdrop = false;
$a('marketOverlay').addEventListener('mousedown', e => { marketMouseDownOnBackdrop = (e.target.id === 'marketOverlay'); });
$a('marketOverlay').addEventListener('click', e => { if (e.target.id === 'marketOverlay' && marketMouseDownOnBackdrop) $a('marketOverlay').classList.remove('open'); });

document.querySelectorAll('.mtab').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.mtab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ['browse','sell','mine','common'].forEach(t => { $a('market'+t[0].toUpperCase()+t.slice(1)).style.display = (t===btn.dataset.tab) ? 'block' : 'none'; });
    if (btn.dataset.tab === 'browse') refreshMarketBrowse();
    if (btn.dataset.tab === 'sell') refreshSellTab();
    if (btn.dataset.tab === 'mine') refreshMarketMine();
    if (btn.dataset.tab === 'common') refreshCommonMarket();
  };
});

async function refreshMarketBrowse() {
  const box = $a('marketList');
  box.innerHTML = '<div class="mEmpty">Chargement...</div>';
  const { data, error } = await sb.from('market_listings')
    .select('id, item, price, seller_id, created_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) { box.innerHTML = '<div class="mEmpty">Erreur de chargement</div>'; return; }
  if (!data || !data.length) { box.innerHTML = '<div class="mEmpty">Aucune annonce pour le moment</div>'; return; }
  box.innerHTML = '';
  for (const l of data) {
    const it = l.item;
    const mine = l.seller_id === currentUser.id;
    const row = document.createElement('div');
    row.className = 'mRow';
    row.innerHTML = `
      <div class="mIcon" style="color:${it.color||'#c9a55a'}">${it.icon||'❔'}</div>
      <div class="mInfo"><div class="mName">${tr(it.name)}${it.qty>1?' ×'+it.qty:''}</div><div class="mSub">${it.kind||''}</div></div>
      <div class="mPrice">${fmt(l.price)} 🪙</div>
      ${mine ? '' : '<button data-id="'+l.id+'">Acheter</button>'}
    `;
    if (!mine) row.querySelector('button').onclick = () => buyListing(l.id);
    box.appendChild(row);
  }
}

async function buyListing(id) {
  const { error } = await sb.rpc('buy_listing', { p_listing_id: id });
  if (error) { alert('Achat impossible : ' + error.message); return; }
  await loadCloudSave();       // resynchronise silver + inventaire depuis le serveur
  await refreshMarketBrowse();
  await refreshMarketMine();
}

function refreshSellTab() {
  const sel = $a('sellItemSelect');
  sel.innerHTML = '<option value="">— Choisir un objet —</option>';
  for (let i = 0; i < INV_SIZE; i++) {
    const s = INV[i];
    if (!s || s.equipped) continue;
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${tr(s.name)}${s.qty>1?' (×'+s.qty+')':''} — ${s.kind}`;
    sel.appendChild(opt);
  }
}
$a('btnListItem').onclick = async () => {
  const idx = $a('sellItemSelect').value;
  const price = parseInt($a('sellPriceInput').value, 10);
  const msg = $a('sellMsg');
  if (idx === '') { msg.textContent = 'Choisis un objet.'; msg.className = 'fail'; return; }
  if (!price || price <= 0) { msg.textContent = 'Prix invalide.'; msg.className = 'fail'; return; }
  const { error } = await sb.rpc('list_item', { p_inv_index: parseInt(idx,10), p_price: price });
  if (error) { msg.textContent = 'Échec : ' + error.message; msg.className = 'fail'; return; }
  msg.textContent = 'Annonce publiée !'; msg.className = 'ok';
  $a('sellPriceInput').value = '';
  await loadCloudSave();
  refreshSellTab();
  refreshMarketMine();
};

async function refreshMarketMine() {
  const box = $a('marketMineList');
  box.innerHTML = '<div class="mEmpty">Chargement...</div>';
  const { data, error } = await sb.from('market_listings')
    .select('id, item, price, status, created_at')
    .eq('seller_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) { box.innerHTML = '<div class="mEmpty">Erreur de chargement</div>'; return; }
  if (!data || !data.length) { box.innerHTML = '<div class="mEmpty">Tu n\'as aucune annonce</div>'; return; }
  box.innerHTML = '';
  for (const l of data) {
    const it = l.item;
    const row = document.createElement('div');
    row.className = 'mRow';
    const statusLabel = l.status === 'active' ? (LANG==='fr'?'en vente':'active') : l.status === 'sold' ? (LANG==='fr'?'vendu ✓':'sold ✓') : (LANG==='fr'?'annulé':'cancelled');
    row.innerHTML = `
      <div class="mIcon" style="color:${it.color||'#c9a55a'}">${it.icon||'❔'}</div>
      <div class="mInfo"><div class="mName">${tr(it.name)}</div><div class="mSub">${statusLabel}</div></div>
      <div class="mPrice">${fmt(l.price)} 🪙</div>
      ${l.status === 'active' ? '<button data-id="'+l.id+'">Annuler</button>' : ''}
    `;
    if (l.status === 'active') row.querySelector('button').onclick = () => cancelListing(l.id);
    box.appendChild(row);
  }
}
async function cancelListing(id) {
  const { error } = await sb.rpc('cancel_listing', { p_listing_id: id });
  if (error) { alert('Annulation impossible : ' + error.message); return; }
  await loadCloudSave();
  refreshMarketMine();
  refreshSellTab();
}

// ============================================================
// MARCHÉ COMMUN v2 — vrai carnet d'ordres entre joueurs (achat ET vente), matériaux + équipement/
// bijoux. Chaque ordre bloque le silver (achat) ou l'objet (vente) jusqu'à exécution/annulation.
// Demande explicite du 2026-07-07.
// ============================================================
// catalogue des matériaux échangeables (clé stable = 'material:<nom>')
const MARKET_MATERIALS = [
  { name:'Pierre de Novice',   icon:ICO_MAT_NOVICE,     color:'#b8b8b8' },
  { name:'Pierre du Temps',    icon:ICO_MAT_TEMPS,      color:'#cfd8dc' },
  { name:'Pierre Noire',       icon:ICO_MAT_NOIRE,      color:'#7aa35e' },
  { name:'Pierre concentrée',  icon:ICO_MAT_CONCENTREE, color:'#6ea3c9' },
  { name:'Pierre de Caphras',  icon:ICO_MAT_CAPHRAS,    color:'#c9a55a' },
];
// clé de marché pour l'équipement/bijoux : regroupée par nom + niveau d'enchantement (comme le
// vrai marché BDO), puisque chaque pièce a par ailleurs des PA/PD quasi identiques pour un même nom
function marketKeyForGear(it) { return 'gear:' + it.name + '+' + (it.enhLv || 0); }

async function refreshCommonMarket() {
  wireCmSubTabs();
  refreshCmBrowse();
  refreshCmSellPicker();
  refreshMyMarketOrders();
  initMarketMaterials();
}
// sous-onglets du marché commun : Parcourir (vitrine, façon référence fournie le 2026-07-07) /
// Vendre / Mes ordres
const CM_TAB_PANES = { browse:'cmPaneBrowse', sell:'cmPaneSell', materials:'cmPaneMaterials', orders:'cmPaneOrders' };
function wireCmSubTabs() {
  document.querySelectorAll('.cmSubTab').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.cmSubTab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Object.entries(CM_TAB_PANES).forEach(([tab, paneId]) => { $a(paneId).style.display = (tab === btn.dataset.cmtab) ? '' : 'none'; });
    };
  });
}
// ---------- carnet d'ordres + graphique chandelier pour les matériaux (2026-07-16, demande
// explicite : "envoyer le nouveau marché") -- reprend le design de l'artefact de démo (carnet à 2
// colonnes avec barres de volume, meilleur prix mis en avant, spread, chandelier sur les 20
// dernières transactions), branché sur les VRAIES données : market_order_book (RPC déjà
// existante) et market_trades (table déjà existante, RLS SELECT publique). Pas de bots ni de
// fourchette min/max fictive (concepts spécifiques à la démo) -- prix validé comme partout
// ailleurs (juste > 0 côté serveur, voir market_place_order).
let mktSelectedIdx = 0, mktSide = 'buy';
function mktKey(m) { return 'material:' + m.name; }
function initMarketMaterials() {
  const pills = $a('mktItemPills'); if (!pills) return;
  pills.innerHTML = MARKET_MATERIALS.map((m,i) => `<button class="mktPill${i===mktSelectedIdx?' active':''}" data-i="${i}">${m.icon} ${tr(m.name)}</button>`).join('');
  pills.querySelectorAll('.mktPill').forEach(btn => {
    btn.onclick = () => { mktSelectedIdx = Number(btn.dataset.i); refreshMarketMaterials(); };
  });
  $a('mktSideBuy').onclick = () => { mktSide = 'buy'; updateMktForm(); };
  $a('mktSideSell').onclick = () => { mktSide = 'sell'; updateMktForm(); };
  $a('mktPlaceBtn').onclick = mktPlaceOrder;
  refreshMarketMaterials();
}
async function refreshMarketMaterials() {
  const m = MARKET_MATERIALS[mktSelectedIdx];
  const key = mktKey(m);
  const [{ data: book }, { data: trades }] = await Promise.all([
    sb.rpc('market_order_book', { p_item_key: key }),
    sb.from('market_trades').select('price, qty, created_at').eq('item_key', key).order('created_at', { ascending: true }).limit(20),
  ]);
  const sells = (book || []).filter(o => o.side === 'sell').sort((a,b) => a.price - b.price);
  const buys = (book || []).filter(o => o.side === 'buy').sort((a,b) => b.price - a.price);
  const bestSell = sells[0], bestBuy = buys[0];
  const spread = (bestSell && bestBuy) ? (bestSell.price - bestBuy.price) : null;

  // pression du marché : tendance des 10 dernières transactions (2026-07-16, demande explicite)
  const recentTrades = (trades || []).slice(-10);
  let up = 0, down = 0;
  for (let i = 1; i < recentTrades.length; i++) {
    if (recentTrades[i].price > recentTrades[i-1].price) up++;
    else if (recentTrades[i].price < recentTrades[i-1].price) down++;
  }
  const pressure = recentTrades.length < 2 ? { icon:'➡️', label: LANG==='fr'?'NEUTRE':'NEUTRAL', cls:'' }
    : up > down ? { icon:'🔺', label: LANG==='fr'?'HAUSSE':'RISING', cls:'up' }
    : down > up ? { icon:'🔻', label: LANG==='fr'?'BAISSE':'FALLING', cls:'down' }
    : { icon:'➡️', label: LANG==='fr'?'NEUTRE':'NEUTRAL', cls:'' };

  $a('mktMetaRow').innerHTML = `
    <div class="mktMetaCard"><div class="mktMetaLbl">${LANG==='fr'?'Meilleure vente':'Best sell'}</div><div class="mktMetaVal sell">${bestSell?fmt(bestSell.price):'—'}</div></div>
    <div class="mktMetaCard"><div class="mktMetaLbl">${LANG==='fr'?'Spread':'Spread'}</div><div class="mktMetaVal">${spread!=null?fmt(spread):'—'}</div></div>
    <div class="mktMetaCard"><div class="mktMetaLbl">${LANG==='fr'?'Meilleur achat':'Best buy'}</div><div class="mktMetaVal buy">${bestBuy?fmt(bestBuy.price):'—'}</div></div>
    <div class="mktMetaCard"><div class="mktMetaLbl">${LANG==='fr'?'Pression marché':'Market pressure'}</div><div class="mktMetaVal ${pressure.cls}">${pressure.icon} ${pressure.label}</div></div>`;

  $a('mktSellCol').innerHTML = `<div class="mktColHead sell"><span>${LANG==='fr'?'Ordres de vente':'Sell orders'}</span><span>${sells.length}</span></div>` +
    `<div class="mktRowsWrap">${mktOrderRowsHtml(sells, 'sell')}</div>`;
  $a('mktBuyCol').innerHTML = `<div class="mktColHead buy"><span>${LANG==='fr'?'Ordres d\'achat':'Buy orders'}</span><span>${buys.length}</span></div>` +
    `<div class="mktRowsWrap">${mktOrderRowsHtml(buys, 'buy')}</div>`;

  const histRows = (trades || []).slice().reverse().map(t => `
    <div class="mktHistRow">
      <span>${tr(m.name)}</span><span>${fmt(t.price)}</span><span>×${fmt(t.qty)}</span>
      <span class="mktHistTime">${new Date(t.created_at).toLocaleTimeString(LANG==='fr'?'fr-FR':'en-US')}</span>
    </div>`).join('');
  $a('mktHistRows').innerHTML = histRows || `<div class="mEmpty">${LANG==='fr'?'Aucune transaction':'No transactions'}</div>`;

  drawMktCandles(trades || []);
  updateMktForm();
}
function mktOrderRowsHtml(orders, side) {
  if (!orders.length) return `<div class="mEmpty">${LANG==='fr'?'Aucun ordre':'No orders'}</div>`;
  const maxQty = Math.max(...orders.map(o => o.qty));
  return orders.map((o,i) => `
    <div class="mktOrderRow ${side}${i===0?' best':''}">
      <div class="mktVol" style="width:${Math.round(o.qty/maxQty*100)}%"></div>
      <span class="mktPrice">${fmt(o.price)}</span><span class="mktQty">${o.qty}</span><span class="mktTotal">${fmt(o.price*o.qty)}</span>
    </div>`).join('');
}
function updateMktForm() {
  const m = MARKET_MATERIALS[mktSelectedIdx];
  const owned = INV.filter(s => s && s.kind === 'material' && s.name === m.name).reduce((n,s) => n + s.qty, 0);
  $a('mktFormTitle').textContent = (LANG==='fr'?'Placer un ordre — ':'Place an order — ') + tr(m.name) + ' · ' + (LANG==='fr'?'possédé':'owned') + ' : ' + fmt(owned);
  $a('mktSideBuy').classList.toggle('active', mktSide==='buy');
  $a('mktSideSell').classList.toggle('active', mktSide==='sell');
  const btn = $a('mktPlaceBtn');
  btn.className = 'mktPlaceBtn ' + mktSide;
  btn.textContent = mktSide === 'buy' ? (LANG==='fr'?"Placer l'ordre d'achat":'Place buy order') : (LANG==='fr'?"Placer l'ordre de vente":'Place sell order');
  $a('mktFormMsg').textContent = '';
}
async function mktPlaceOrder() {
  const m = MARKET_MATERIALS[mktSelectedIdx];
  const price = Number($a('mktPriceInput').value), qty = parseInt($a('mktQtyInput').value, 10) || 1;
  const msg = $a('mktFormMsg');
  if (!price || price <= 0) { msg.textContent = LANG==='fr'?'Prix invalide.':'Invalid price.'; return; }
  let invIndex = null;
  if (mktSide === 'sell') {
    invIndex = INV.findIndex(s => s && s.kind === 'material' && s.name === m.name);
    if (invIndex === -1) { msg.textContent = LANG==='fr'?'Tu n\'en as pas.':'You don\'t have any.'; return; }
  }
  const { error } = await sb.rpc('market_place_order', {
    p_side: mktSide, p_item_key: mktKey(m), p_item_name: m.name, p_item_kind: 'material',
    p_price: price, p_qty: qty, p_inv_index: invIndex,
  });
  if (error) { msg.textContent = (LANG==='fr'?'Échec : ':'Failed: ') + error.message; return; }
  msg.textContent = '';
  $a('mktPriceInput').value = ''; $a('mktQtyInput').value = '1';
  await loadCloudSave();
  refreshMarketMaterials();
}
// chandelier canvas (2026-07-16) : chaque transaction = 1 bougie (open = prix de la transaction
// précédente, close = son propre prix), même logique que l'artefact de démo -- fidèle aux VRAIES
// transactions, sans inventer de mèche haute/basse intra-transaction
function drawMktCandles(trades) {
  const canvas = $a('mktCandleCv'); if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width = canvas.clientWidth * 2;
  const H = canvas.height = 220 * 2;
  ctx.clearRect(0,0,W,H);
  if (trades.length < 2) {
    ctx.fillStyle = '#5a5f74'; ctx.font = '20px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(LANG==='fr'?'Pas assez de transactions':'Not enough transactions', W/2, H/2);
    return;
  }
  const candles = [];
  for (let i = 1; i < trades.length; i++) {
    const open = Number(trades[i-1].price), close = Number(trades[i].price);
    candles.push({ open, close, high: Math.max(open,close), low: Math.min(open,close) });
  }
  const padL = 70, padR = 16, padT = 16, padB = 16;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const allPrices = candles.flatMap(c => [c.high, c.low]);
  let pMin = Math.min(...allPrices), pMax = Math.max(...allPrices);
  if (pMin === pMax) { pMin *= 0.98; pMax *= 1.02; }
  const pad = (pMax-pMin)*0.08; pMin -= pad; pMax += pad;
  const y = p => padT + plotH - ((p-pMin)/(pMax-pMin))*plotH;
  const cw = plotW/candles.length;
  ctx.strokeStyle = '#2c2a33'; ctx.lineWidth = 1; ctx.font = '18px sans-serif'; ctx.fillStyle = '#9a917e'; ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const py = padT + plotH*i/4;
    ctx.beginPath(); ctx.moveTo(padL,py); ctx.lineTo(W-padR,py); ctx.stroke();
    ctx.fillText(fmt(pMax - (pMax-pMin)*i/4), padL-8, py+6);
  }
  candles.forEach((c,i) => {
    const cx = padL + cw*i + cw/2;
    const up = c.close >= c.open;
    ctx.strokeStyle = ctx.fillStyle = up ? '#7aa35e' : '#c05545';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, y(c.high)); ctx.lineTo(cx, y(c.low)); ctx.stroke();
    const bodyTop = y(Math.max(c.open,c.close)), bodyBot = y(Math.min(c.open,c.close));
    const bw = Math.max(4, cw*0.55);
    ctx.fillRect(cx-bw/2, bodyTop, bw, Math.max(2, bodyBot-bodyTop));
  });
}

// ---------- vitrine "Parcourir" : arbre de catégories, cartes groupées par objet avec tirage par
// niveau d'enchantement, panneau de détail avec comparaison — inspirée d'une référence visuelle du
// Marché Central de BDO fournie par l'utilisateur le 2026-07-07 ----------
const CM_CATEGORIES = [
  { id:'all',       label:{fr:'★ Tout',en:'★ All'},                          kind:null,      slots:null },
  { id:'weapon',    label:{fr:'⚔️ Arme principale',en:'⚔️ Main weapon'},      kind:'gear',    slots:['weapon'] },
  { id:'secondary', label:{fr:'🗡️ Arme secondaire',en:'🗡️ Secondary weapon'}, kind:'gear',    slots:['secondary'] },
  { id:'awakening', label:{fr:'✨ Arme d\'éveil',en:'✨ Awakening weapon'},     kind:'gear',    slots:['awakening'] },
  { id:'armor',     label:{fr:'🛡️ Armure',en:'🛡️ Armor'},                    kind:'gear',    slots:['helmet','armor','gloves','boots'] },
  { id:'accessory', label:{fr:'💍 Accessoires',en:'💍 Accessories'},          kind:'jackpot', slots:null },
  { id:'artifact',  label:{fr:'🔮 Artéfact / Pierre',en:'🔮 Artifact / Stone'}, kind:'gear',   slots:['artifact1','artifact2','eqStone'] },
  { id:'material',  label:{fr:'◈ Matériaux',en:'◈ Materials'},               kind:'material', slots:null },
];
let cmActiveCat = 'all', cmListings = [], cmSelectedId = null, cmDrilldownName = null;
function renderCmCategoryTree() {
  const el = $a('cmCategoryTree'); if (!el) return;
  el.innerHTML = CM_CATEGORIES.map(c => `<button class="cmCatBtn${c.id===cmActiveCat?' active':''}" data-cat="${c.id}">${c.label[LANG]}</button>`).join('');
  el.querySelectorAll('.cmCatBtn').forEach(btn => {
    btn.onclick = () => { cmActiveCat = btn.dataset.cat; cmDrilldownName = null; cmSelectedId = null; refreshCmBrowse(); };
  });
}
function updateCmWallet() { const el = $a('cmWalletVal'); if (el) el.textContent = fmt(Math.round(S.silver)) + ' 🪙'; }
async function refreshCmBrowse() {
  renderCmCategoryTree();
  updateCmWallet();
  const list = $a('cmListingsList'); if (!list) return;
  list.innerHTML = '<div class="mEmpty">Chargement...</div>';
  const cat = CM_CATEGORIES.find(c => c.id === cmActiveCat) || CM_CATEGORIES[0];
  const { data, error } = await sb.rpc('market_listings', { p_kind: cat.kind });
  let rows = data || [];
  if (cat.slots) rows = rows.filter(l => l.item_snapshot && cat.slots.includes(l.item_snapshot.slot));
  cmListings = rows;
  if (error) { list.innerHTML = `<div class="mEmpty">${LANG==='fr'?'Erreur de chargement':'Loading error'}</div>`; return; }
  renderCmListingsList();
}
function cmListingIcon(l) {
  if (l.item_kind === 'material') { const m = MARKET_MATERIALS.find(x => x.name === l.item_name); return m ? m.icon : '◈'; }
  return l.item_snapshot ? l.item_snapshot.icon : '📦';
}
function cmListingColor(l) {
  if (l.item_kind === 'material') { const m = MARKET_MATERIALS.find(x => x.name === l.item_name); return m ? m.color : '#8fb0c9'; }
  return l.item_snapshot ? l.item_snapshot.color : '#c9a55a';
}
function cmTimeAgo(iso) {
  const sec = Math.max(0, (Date.now() - new Date(iso).getTime())/1000);
  if (sec < 3600) return Math.round(sec/60) + 'm';
  if (sec < 86400) return Math.round(sec/3600) + 'h';
  return Math.round(sec/86400) + 'j';
}
// applique recherche + tri à un tableau d'annonces (utilisé pour les 2 niveaux : vue groupée et
// vue détaillée par niveau d'enchantement)
function cmApplySearchSort(items, priceOf, timeOf) {
  const search = ($a('cmSearch').value || '').toLowerCase().trim();
  const sort = $a('cmSort').value;
  let rows = items.filter(x => !search || tr(x.name || x.item_name).toLowerCase().includes(search));
  if (sort === 'price_asc') rows.sort((a,b) => priceOf(a) - priceOf(b));
  else if (sort === 'price_desc') rows.sort((a,b) => priceOf(b) - priceOf(a));
  else rows.sort((a,b) => new Date(timeOf(b)) - new Date(timeOf(a)));
  return rows;
}
function renderCmListingsList() {
  const list = $a('cmListingsList'); if (!list) return;
  if (cmDrilldownName) { renderCmDrilldown(); return; }
  // vue groupée par NOM d'objet (comme le Marché Central de BDO) : une ligne par objet, prix le
  // plus bas / stock total ; si plusieurs niveaux d'enchantement existent, clic = tiroir détaillé
  const groups = new Map();
  for (const l of cmListings) {
    if (!groups.has(l.item_name)) groups.set(l.item_name, { name: l.item_name, kind: l.item_kind, items: [] });
    groups.get(l.item_name).items.push(l);
  }
  let rows = [...groups.values()].map(g => {
    const best = g.items.reduce((a,b) => a.price < b.price ? a : b);
    const stock = g.items.reduce((n,x) => n + (x.item_kind === 'material' ? x.qty : 1), 0);
    const enhLvs = new Set(g.items.map(x => (x.item_snapshot && x.item_snapshot.enhLv) || 0));
    return { ...g, best, stock, drilldown: enhLvs.size > 1, latest: g.items.reduce((a,b) => new Date(a.created_at)>new Date(b.created_at)?a:b).created_at };
  });
  rows = cmApplySearchSort(rows, r => r.best.price, r => r.latest);
  if (!rows.length) { list.innerHTML = `<div class="mEmpty">${LANG==='fr'?'Aucune vente en cours':'No listings right now'}</div>`; return; }
  list.innerHTML = rows.map(g => {
    const color = cmListingColor(g.best);
    return `<div class="cmListCard" data-name="${escapeHtml(g.name)}">
      <div class="cmListIcon" style="color:${color}">${cmListingIcon(g.best)}</div>
      <div class="cmListInfo">
        <div class="cmListName" style="color:${color}">${tr(g.name)}</div>
        <div class="cmListSub">${LANG==='fr'?'En stock':'In stock'} : ${fmt(g.stock)}${g.drilldown?` · ${g.items.length} ${LANG==='fr'?'niveaux':'levels'}`:''}</div>
      </div>
      <div class="cmListPrice"><div class="price">${LANG==='fr'?'dès':'from'} ${fmt(g.best.price)} 🪙</div></div>
    </div>`;
  }).join('');
  list.querySelectorAll('.cmListCard').forEach(card => {
    const g = rows.find(r => r.name === card.dataset.name);
    card.onclick = () => {
      if (g.drilldown) { cmDrilldownName = g.name; renderCmListingsList(); }
      else { cmSelectedId = g.best.id; renderCmDetailPanel(); }
    };
  });
}
// tiroir détaillé par niveau d'enchantement (façon "+13/+14/+15/PRI/DUO..." du vrai marché BDO) —
// une ligne par niveau présent, avec son propre prix le plus bas et son stock
function renderCmDrilldown() {
  const list = $a('cmListingsList'); if (!list) return;
  const items = cmListings.filter(l => l.item_name === cmDrilldownName);
  const byLv = new Map();
  for (const l of items) {
    const lv = (l.item_snapshot && l.item_snapshot.enhLv) || 0;
    if (!byLv.has(lv)) byLv.set(lv, []);
    byLv.get(lv).push(l);
  }
  let rows = [...byLv.entries()].map(([lv, arr]) => ({
    lv, best: arr.reduce((a,b) => a.price < b.price ? a : b), stock: arr.length,
    latest: arr.reduce((a,b) => new Date(a.created_at)>new Date(b.created_at)?a:b).created_at,
  }));
  rows.sort((a,b) => a.lv - b.lv);
  rows = cmApplySearchSort(rows.map(r => ({...r, name:cmDrilldownName})), r => r.best.price, r => r.latest);
  const backBtn = `<button class="cmBackBtn" id="cmBackBtn">← ${LANG==='fr'?'Retour':'Back'}</button>`;
  list.innerHTML = backBtn + rows.map(r => {
    const color = cmListingColor(r.best);
    return `<div class="cmListCard" data-lv="${r.lv}">
      <div class="cmListIcon" style="color:${color}">${cmListingIcon(r.best)}</div>
      <div class="cmListInfo">
        <div class="cmListName" style="color:${color}">${ENH_NAMES[r.lv]} ${tr(cmDrilldownName)}</div>
        <div class="cmListSub">${LANG==='fr'?'En stock':'In stock'} : ${fmt(r.stock)}</div>
      </div>
      <div class="cmListPrice"><div class="price">${LANG==='fr'?'dès':'from'} ${fmt(r.best.price)} 🪙</div></div>
    </div>`;
  }).join('');
  $a('cmBackBtn').onclick = () => { cmDrilldownName = null; renderCmListingsList(); };
  list.querySelectorAll('.cmListCard').forEach(card => {
    const r = rows.find(x => x.lv === Number(card.dataset.lv));
    card.onclick = () => { cmSelectedId = r.best.id; renderCmDetailPanel(); };
  });
}
// panneau de détail : stats complètes + comparaison face à l'équipement actuel (si gear/bijou)
function renderCmDetailPanel() {
  const panel = $a('cmDetailPanel'); if (!panel) return;
  const l = cmListings.find(x => x.id === cmSelectedId);
  if (!l) { panel.innerHTML = `<div class="mEmpty" data-i18n="cmSelectItemHint">${LANG==='fr'?'Clique un objet pour voir le détail':'Click an item to see the detail'}</div>`; return; }
  const color = cmListingColor(l);
  let statsHtml = '', compareHtml = '';
  if (l.item_kind === 'gear' || l.item_kind === 'jackpot') {
    const snap = l.item_snapshot || {};
    const eff = effectiveApDp(snap);
    const rows = [];
    if (eff.ap) rows.push(['PA', '+'+eff.ap]);
    if (eff.dp) rows.push(['PD', '+'+eff.dp]);
    if (eff.hp) rows.push(['PV', '+'+eff.hp]);
    if (snap.enhLv) rows.push([LANG==='fr'?'Niveau':'Level', ENH_NAMES[snap.enhLv]]);
    statsHtml = `<div class="cmDetailStats">${rows.map(([k,v]) => `<div class="srow"><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
    // comparaison face à ce qui est déjà équipé dans ce slot (ou la meilleure des 2 bagues/boucles)
    const slotId = l.item_kind === 'jackpot' ? accSlotFor(snap) : snap.slot;
    const accSlot = l.item_kind === 'jackpot' ? accSlotFor(snap) : null;
    let equipped = slotId ? EQUIP[slotId] : null;
    if (accSlot === 'ring') equipped = itemScore(EQUIP.ring1) <= itemScore(EQUIP.ring2) ? EQUIP.ring1 : EQUIP.ring2;
    if (accSlot === 'earring') equipped = itemScore(EQUIP.earring1) <= itemScore(EQUIP.earring2) ? EQUIP.earring1 : EQUIP.earring2;
    if (equipped) {
      const effEq = effectiveApDp(equipped);
      const cmpRows = [['PA', effEq.ap||0, eff.ap||0], ['PD', effEq.dp||0, eff.dp||0], ['PV', effEq.hp||0, eff.hp||0]]
        .filter(([,a,b]) => a || b);
      compareHtml = `<div class="cmDetailSub">${LANG==='fr'?'Face à':'Vs'} <b style="color:${equipped.color||'#c9a55a'}">${tr(equipped.name)}</b></div>
        <table class="cmCompareTable"><thead><tr><th></th><th>${LANG==='fr'?'Équipé':'Equipped'}</th><th>${LANG==='fr'?'Celui-ci':'This one'}</th><th>Δ</th></tr></thead>
        <tbody>${cmpRows.map(([k,a,b]) => {
          const delta = b - a; const cls = delta > 0 ? 'up' : delta < 0 ? 'down' : '';
          return `<tr><td>${k}</td><td>${a}</td><td>${b}</td><td class="cmDelta ${cls}">${delta>0?'+':''}${delta}</td></tr>`;
        }).join('')}</tbody></table>`;
    }
  } else {
    statsHtml = `<div class="cmDetailStats"><div class="srow"><span>${LANG==='fr'?'Quantité disponible':'Available qty'}</span><b>${fmt(l.qty)}</b></div></div>`;
  }
  panel.innerHTML = `
    <div class="cmDetailIcon" style="border-color:${color};color:${color}">${cmListingIcon(l)}</div>
    <div class="cmDetailTitle" style="color:${color}">${tr(l.item_name)}</div>
    <div class="cmDetailSub">${LANG==='fr'?'Vendu par':'Sold by'} ${escapeHtml(l.pseudo||'?')} · ${cmTimeAgo(l.created_at)}</div>
    ${statsHtml}${compareHtml}
    <div class="cmDetailSub" style="margin-top:8px">${fmt(l.price)} 🪙${l.item_kind==='material'?(' × '+fmt(l.qty)):''}</div>
    <button class="btnBuyListing">${LANG==='fr'?'Acheter':'Buy'}</button>`;
  panel.querySelector('.btnBuyListing').onclick = () => buyCmListing(l);
}
// achat en un clic : pose un ordre d'achat EXACTEMENT au prix/quantité de l'annonce → correspond
// forcément (le vendeur a déjà posé son ordre à ce prix), donc exécution immédiate garantie
async function buyCmListing(l) {
  const msg = $a('commonMsg');
  const { error } = await sb.rpc('market_place_order', {
    p_side: 'buy', p_item_key: l.item_key, p_item_name: l.item_name, p_item_kind: l.item_kind,
    p_price: l.price, p_qty: l.item_kind === 'material' ? l.qty : 1, p_inv_index: null,
  });
  if (error) { msg.textContent = (LANG==='fr'?'Échec : ':'Failed: ') + error.message; msg.className = 'fail'; return; }
  msg.textContent = LANG==='fr'?'Achat effectué ✓':'Purchase complete ✓'; msg.className = 'ok';
  await loadCloudSave();
  updateCmWallet();
  refreshCmBrowse();
  refreshMyMarketOrders();
}
$a('cmSearch').oninput = () => renderCmListingsList();
$a('cmSort').onchange = () => renderCmListingsList();
// pose un ordre d'achat ou de vente ; p_inv_index n'est nécessaire QUE pour une vente (matériau =
// trouvé automatiquement par nom puisqu'il tient en un seul emplacement empilé ; équipement/bijou =
// passé explicitement par le picker "Vendre un objet de mon sac")
async function placeMarketOrder(side, key, name, kind, priceStr, qtyStr, invIndex) {
  const msg = $a('commonMsg');
  const price = Number(priceStr), qty = parseInt(qtyStr, 10) || 1;
  if (!price || price <= 0) { msg.textContent = LANG==='fr'?'Prix invalide.':'Invalid price.'; msg.className = 'fail'; return; }
  if (side === 'sell' && invIndex == null) {
    invIndex = INV.findIndex(s => s && s.kind === kind && s.name === name);
    if (invIndex === -1) { msg.textContent = LANG==='fr'?'Tu n\'en as pas.':'You don\'t have any.'; msg.className = 'fail'; return; }
  }
  const { error } = await sb.rpc('market_place_order', {
    p_side: side, p_item_key: key, p_item_name: name, p_item_kind: kind,
    p_price: price, p_qty: kind === 'material' ? qty : 1, p_inv_index: side==='sell' ? invIndex : null,
  });
  if (error) { msg.textContent = (LANG==='fr'?'Échec : ':'Failed: ') + error.message; msg.className = 'fail'; return; }
  msg.textContent = LANG==='fr'?'Ordre posé ✓ (exécuté immédiatement si un ordre opposé compatible existait)':'Order placed ✓ (filled immediately if a compatible opposite order existed)';
  msg.className = 'ok';
  await loadCloudSave();
  refreshCommonMarket();
}
// picker "vendre un objet de mon sac" : équipement/bijoux NON équipés uniquement (les matériaux se
// vendent depuis la ligne du catalogue ci-dessus, pas ici)
function refreshCmSellPicker() {
  const sel = $a('cmSellItemSelect'); if (!sel) return;
  const items = INV.map((s,i) => ({ s, i })).filter(x => x.s && (x.s.kind === 'gear' || x.s.kind === 'jackpot') && !x.s.equipped);
  sel.innerHTML = items.length
    ? items.map(x => `<option value="${x.i}">${tr(x.s.name)}${x.s.enhLv?' '+ENH_NAMES[x.s.enhLv]:''}</option>`).join('')
    : `<option value="">${LANG==='fr'?'(Rien à vendre)':'(Nothing to sell)'}</option>`;
}
$a('btnCmListItem').onclick = () => {
  const sel = $a('cmSellItemSelect');
  const idx = Number(sel.value);
  if (Number.isNaN(idx) || sel.value === '') return;
  const it = INV[idx]; if (!it) return;
  const price = $a('cmSellPriceInput').value;
  placeMarketOrder('sell', marketKeyForGear(it), it.name, it.kind, price, 1, idx);
};
// mes ordres ouverts (achat + vente), avec bouton annuler qui rend le silver/objet bloqué
async function refreshMyMarketOrders() {
  const box = $a('cmMyOrders'); if (!box) return;
  const { data, error } = await sb.rpc('market_my_orders');
  if (error || !data || !data.length) { box.innerHTML = `<div class="mEmpty">${LANG==='fr'?'Aucun ordre':'No orders'}</div>`; return; }
  box.innerHTML = data.map(o => `
    <div class="cmRow">
      <div class="cmInfo"><div class="mName">${o.side==='buy'?'🛒':'🏷️'} ${tr(o.item_name)}</div>
        <div class="cmOwned">${o.side==='buy'?(LANG==='fr'?'Achat':'Buy'):(LANG==='fr'?'Vente':'Sell')} · ${fmt(o.price)} 🪙 × ${fmt(o.qty)}/${fmt(o.qty_original)} · ${o.status==='open'?(LANG==='fr'?'ouvert':'open'):(LANG==='fr'?'terminé':'done')}</div></div>
      ${o.status==='open' ? `<button class="cmCancelOrder" data-id="${o.id}">${LANG==='fr'?'Annuler':'Cancel'}</button>` : ''}
    </div>`).join('');
  box.querySelectorAll('.cmCancelOrder').forEach(btn => {
    btn.onclick = async () => {
      const { error } = await sb.rpc('market_cancel_order', { p_order_id: Number(btn.dataset.id) });
      if (!error) { await loadCloudSave(); refreshCommonMarket(); }
    };
  });
}

