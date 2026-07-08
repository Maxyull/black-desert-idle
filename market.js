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
  refreshCmMaterialList();
  refreshCmSellPicker();
  refreshMyMarketOrders();
}
// sous-onglets du marché commun : Parcourir (vitrine, façon référence fournie le 2026-07-07) /
// Vendre / Mes ordres
const CM_TAB_PANES = { browse:'cmPaneBrowse', sell:'cmPaneSell', orders:'cmPaneOrders' };
function wireCmSubTabs() {
  document.querySelectorAll('.cmSubTab').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.cmSubTab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Object.entries(CM_TAB_PANES).forEach(([tab, paneId]) => { $a(paneId).style.display = (tab === btn.dataset.cmtab) ? '' : 'none'; });
    };
  });
}
async function refreshCmMaterialList() {
  const box = $a('marketCommonList');
  box.innerHTML = '<div class="mEmpty">Chargement...</div>';
  const rows = await Promise.all(MARKET_MATERIALS.map(async m => {
    const key = 'material:' + m.name;
    const { data } = await sb.rpc('market_order_book', { p_item_key: key });
    return { m, key, book: data || [] };
  }));
  box.innerHTML = '';
  for (const { m, key, book } of rows) {
    const owned = INV.filter(s => s && s.kind === 'material' && s.name === m.name).reduce((n,s) => n + s.qty, 0);
    const buys = book.filter(b => b.side === 'buy').sort((a,b) => b.price - a.price);
    const sells = book.filter(b => b.side === 'sell').sort((a,b) => a.price - b.price);
    const bestBuy = buys[0], bestSell = sells[0];
    const row = document.createElement('div');
    row.className = 'cmRow';
    row.innerHTML = `
      <div class="mIcon" style="color:${m.color}">${m.icon}</div>
      <div class="cmInfo"><div class="mName">${tr(m.name)}</div><div class="cmOwned">${LANG==='fr'?'Possédé':'Owned'} : ${fmt(owned)}</div></div>
      <div class="cmBook">
        <div class="cmBid">${LANG==='fr'?'Meilleur achat':'Best buy'} : ${bestBuy?fmt(bestBuy.price)+' 🪙 (×'+fmt(bestBuy.qty)+')':'—'}</div>
        <div class="cmAsk">${LANG==='fr'?'Meilleure vente':'Best sell'} : ${bestSell?fmt(bestSell.price)+' 🪙 (×'+fmt(bestSell.qty)+')':'—'}</div>
      </div>
      <div class="cmActions">
        <input type="number" class="cmQty" value="1" min="1" title="${LANG==='fr'?'Quantité':'Quantity'}">
        <input type="number" class="cmPriceInput" placeholder="${LANG==='fr'?'Prix':'Price'}" min="1">
        <button class="cmBuy">${LANG==='fr'?'Ordre d\'achat':'Buy order'}</button>
        <button class="cmSell" ${owned<=0?'disabled':''}>${LANG==='fr'?'Ordre de vente':'Sell order'}</button>
      </div>`;
    const qtyEl = row.querySelector('.cmQty'), priceEl = row.querySelector('.cmPriceInput');
    row.querySelector('.cmBuy').onclick = () => placeMarketOrder('buy', key, m.name, 'material', priceEl.value, qtyEl.value);
    row.querySelector('.cmSell').onclick = () => placeMarketOrder('sell', key, m.name, 'material', priceEl.value, qtyEl.value);
    box.appendChild(row);
  }
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

