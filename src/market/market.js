// ============================================================
// HÔTEL DES VENTES
// ============================================================
/** @returns {boolean} vrai si connecté et vérifié (pas invité), affiche une alerte sinon. */
function marketRequireAuth() {
  if (!sb || !currentUser) { alert('Connecte-toi pour accéder au marché.'); return false; }
  if (isGuest()) {
    alert(i18next.t('market:market.auth_verified_required'));
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
        alert(i18next.t('market:market.closed_for_maintenance'));
        return;
      }
    } catch(e) {}
  }
  $a('marketOverlay').classList.add('open');
  refreshCommonMarket();
  // tutoriel d'action au tout premier accès au marché (2026-07-19) -- voir
  // ITEM_TUTORIALS.market/maybeQueueTutorialById (progression/notifications-quests.js)
  if (typeof maybeQueueTutorialById === 'function') maybeQueueTutorialById('market');
};
$a('closeMarket').onclick = () => $a('marketOverlay').classList.remove('open');
let marketMouseDownOnBackdrop = false;
$a('marketOverlay').addEventListener('mousedown', e => { marketMouseDownOnBackdrop = (e.target.id === 'marketOverlay'); });
$a('marketOverlay').addEventListener('click', e => { if (e.target.id === 'marketOverlay' && marketMouseDownOnBackdrop) $a('marketOverlay').classList.remove('open'); });

// ============================================================
// MARCHÉ COMMUN v3 (2026-07-22) — port fidèle du mockup fourni (voir CLAUDE.md §30) : catalogue
// UNIFIÉ équipement + matériaux (les objets sans vente en cours restent visibles, grisés), popup
// "Acheter" façon Marché Central BDO, panneau "Mes ordres" ancré à droite en permanence. Remplace
// l'ancien 3e sous-onglet "Matériaux" (carnet d'ordres/chandelier séparé, v2 du 2026-07-16) : les
// matériaux vivent désormais dans le MÊME catalogue/popup que le reste (market_listings les
// renvoie déjà avec les autres kinds quand p_kind est null).
//
// Décision importante (mécanique d'inflation/déflation du mockup) : le mockup fabrique côté client
// une échelle de prix fixe + des fonctions applyDemandInflation()/applySupplyDeflation() car il n'a
// pas de backend. Le VRAI marché a déjà un carnet d'ordres multi-prix authentique
// (market_order_book RPC) + un matching serveur qui sert TOUJOURS le meilleur acheteur en premier
// (market_match_item, order by price desc) et rembourse la différence si le prix réel est plus bas
// que le prix établi -- exactement la dynamique visée par le mockup, mais RÉELLE et sans risque de
// désync entre joueurs (aucun état economique n'est simulé côté client). La popup "Acheter" affiche
// donc l'échelle de prix RÉELLE (market_order_book, group by price) au lieu d'un pas de prix
// inventé -- voir openBuyModal/priceLadderFromOrderBook.
//
// Catalogue "objets sans vente en cours" : construit depuis les VRAIES tables de données du jeu
// (GEAR_TIERS pour l'armure/les armes, ZONES pour les bijoux par zone, MARKET_MATERIALS pour les
// matériaux) -- voir marketCatalog(). Le mockup fourni utilisait des noms d'objets fictifs
// (Kzarka/Kutum/Nouver/Ogre, noms de boss BDO qui n'existent PAS dans CE jeu, qui utilise ses
// propres paliers Naru/Tuvala/Yuria/Grunil puis Asula/Cadry/Serap's/Orkinrad's/Tungrad's pour les
// bijoux endgame) -- ces noms fictifs ne sont PAS repris, conformément à CLAUDE.md §30 point 5.
// La catégorie "Artéfact / Pierre" (slots artifact1/artifact2/eqStone) n'a AUCUNE source de drop
// dans le jeu actuel (voir NO_SOURCE_SLOTS, inventory-ui.js) -- aucune entrée catalogue générée
// pour elle, elle reste vide tant qu'aucun système ne l'alimente (pas une régression : elle était
// déjà vide avant cette refonte).
const MARKET_MATERIALS = [
  { name:'Pierre de Novice',   icon:ICO_MAT_NOVICE,     color:'#b8b8b8' },
  { name:'Pierre du Temps',    icon:ICO_MAT_TEMPS,      color:'#cfd8dc' },
  { name:'Pierre Noire',       icon:ICO_MAT_NOIRE,      color:'#7aa35e' },
  { name:'Pierre concentrée',  icon:ICO_MAT_CONCENTREE, color:'#6ea3c9' },
  { name:'Pierre de Caphras',  icon:ICO_MAT_CAPHRAS,    color:'#c9a55a' },
];
// taxe de vente Marché : 35% (2026-07-18, demande explicite : "35% au market") -- prélevée côté
// serveur sur le VENDEUR (market_match_item, voir migration 20260718130000_market_sales_tax_35pct.sql)
// : garder cette constante synchronisée avec le facteur SQL (* 0.65) si le taux change encore.
// Purement informatif ici (bandeau + aperçu net) -- le vrai calcul fait foi côté RPC.
const MARKET_SELL_TAX_RATE = 0.35;

/** Réouverture/rafraîchissement complet du panneau Marché : libellés i18next, portefeuille, onglets, parcours des offres, mes ordres. */
async function refreshCommonMarket() {
  applyMarketStaticI18n();
  updateCmWallet();
  wireCmMyOrdersTabs();
  refreshCmBrowse();
  refreshMyMarketOrders();
}
// libellés statiques de la refonte v3 appliqués via i18next (2026-07-22) -- PAS le vieux
// dictionnaire I18N/data-i18n (game-supabase.js), qui est un système bilingue ad hoc antérieur à
// i18next : CLAUDE.md §31 est explicite, tout texte NOUVEAU passe par i18next.t() dès l'écriture.
// Appelé à chaque ouverture du panneau (refreshCommonMarket) -- suffisant pour ce panneau (pas
// besoin d'un hook global de changement de langue, le panneau est toujours refermé/rouvert avant
// d'être revu après un changement de langue dans la pratique de ce jeu).
/** Applique les libellés i18next statiques du panneau Marché (appelé à chaque ouverture, panneau toujours refermé/rouvert entre changements de langue). */
function applyMarketStaticI18n() {
  const set = (id, key) => { const el = $a(id); if (el) el.textContent = i18next.t(key); };
  set('cmMyOrdersHdr', 'market:market.my_orders_hdr');
  set('cmBuyTabLbl', 'market:market.buy_label');
  set('cmSellTabLbl', 'market:market.sell_label');
  set('cmBuyModalTitle', 'market:market.buy_modal_title');
  set('cmBmBalanceLbl', 'market:market.balance_label');
  set('cmBmTotalCostLbl', 'market:market.total_cost_label');
  set('cmBmAfterBalanceLbl', 'market:market.after_balance_label');
  set('cmBmSetPriceLbl', 'market:market.set_buy_price_label');
  set('cmBmQtyLbl', 'market:market.qty_bought_label');
  set('cmBmTierLbl', 'market:market.choose_tier_label');
  set('cmBmBuyBtn', 'market:market.buy_btn');
  set('cmBmColStock', 'market:market.col_stock');
  set('cmBmColPrice', 'market:market.col_price');
  set('cmBmColOrders', 'market:market.col_orders');
  const disc = $a('cmBmDisclaimer');
  if (disc) disc.innerHTML = i18next.t('market:market.disclaimer_refund') + '<br>' +
    i18next.t('market:market.disclaimer_pending') + '<br>' + i18next.t('market:market.disclaimer_see_orders');
}

// ---------- catalogue unifié : catégories façon Marché Central de BDO ----------
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
// mapping slot d'armure/arme -> catégorie catalogue (pour les entrées SANS vente en cours, voir
// marketCatalog() -- les entrées AVEC vente en cours utilisent déjà item_snapshot.slot)
const CM_SLOT_TO_CAT = { weapon:'weapon', secondary:'secondary', awakening:'awakening',
  helmet:'armor', armor:'armor', gloves:'armor', boots:'armor' };

let cmActiveCat = 'all', cmListings = [], cmSelectedKey = null, cmDrilldownName = null;
let cmMyOrdersTab = 'buy', cmMyOrdersData = [];

// clé d'objet cohérente avec le serveur (market_place_order) : 'material:<nom>' pour les
// matériaux, 'gear:<nom>+<enhLv>' pour TOUT le reste (gear ET bijoux -- le serveur ne distingue
// pas les deux dans son calcul de clé, voir v_real_key dans market_place_order)
/** @param {string} kind - 'material'/'gear'/'jackpot'. @param {string} name @param {number} enhLv - niveau d'enchant. @returns {string} clé d'objet cohérente avec le serveur (market_place_order). */
function cmItemKey(kind, name, enhLv) {
  return kind === 'material' ? ('material:' + name) : ('gear:' + name + '+' + (enhLv || 0));
}

// ---------- catalogue "objets du jeu", même sans vente en cours (2026-07-22) ----------
// construit une seule fois (donnée statique du jeu, ne change pas en cours de partie) à partir des
// VRAIES tables de données (GEAR_TIERS/ZONES/MARKET_MATERIALS) -- fonction, pas un littéral
// top-level, pour ne dépendre d'aucun ordre de chargement (voir CLAUDE.md §7-8).
let MARKET_CATALOG_CACHE = null;
/** @returns {object[]} catalogue complet des objets du jeu (armure/armes via GEAR_TIERS, bijoux via ZONES, matériaux via MARKET_MATERIALS) — construit une seule fois et mis en cache (MARKET_CATALOG_CACHE), inclut les objets sans vente en cours. */
function marketCatalog() {
  if (MARKET_CATALOG_CACHE) return MARKET_CATALOG_CACHE;
  const catalog = [];
  const ARMOR_ICON_FOR = { helmet:helmetIconForColor, armor:armorIconForColor, gloves:glovesIconForColor, boots:bootsIconForColor };
  const WEAPON_ICON_FOR = { weapon:staffIconForColor, secondary:daggerIconForColor, awakening:orbPairIconForColor };
  GEAR_TIERS.forEach(tier => {
    Object.entries(tier.sets).forEach(([slot, name]) => {
      const iconFn = ARMOR_ICON_FOR[slot] || WEAPON_ICON_FOR[slot];
      catalog.push({ name, kind:'gear', enhLv:0, slot, catId: CM_SLOT_TO_CAT[slot] || 'armor',
        icon: iconFn ? iconFn(tier.color, tier.grade) : '📦', color: tier.color });
    });
  });
  const seenJewel = new Set();
  const JEWEL_ICON_FOR_SLOT = { ring:ringIconForTier, necklace:necklaceIconForTier, earring:earringIconForTier, belt:beltIconForTier };
  ZONES.forEach((z, zi) => {
    const j = z.loot && z.loot.jackpot;
    if (!j || seenJewel.has(j.name)) return;
    seenJewel.add(j.name);
    const tier = gearTierForZone(zi);
    const jSlot = accSlotFor(j);
    const jTierIdx = JEWEL_TIER_IDX[tier.grade] ?? 0;
    const iconFn = JEWEL_ICON_FOR_SLOT[jSlot] || ringIconForTier;
    catalog.push({ name:j.name, kind:'jackpot', enhLv:0, slot:jSlot, catId:'accessory',
      icon: iconFn(jTierIdx, tier.color), color: tier.color });
  });
  MARKET_MATERIALS.forEach(m => catalog.push({ name:m.name, kind:'material', enhLv:0, slot:null, catId:'material', icon:m.icon, color:m.color }));
  MARKET_CATALOG_CACHE = catalog;
  return catalog;
}
/** @param {object} cat - entrée de CM_CATEGORIES. @returns {object[]} entrées du catalogue appartenant à cette catégorie ('all' = tout). */
function catalogEntriesForCat(cat) {
  if (cat.id === 'all') return marketCatalog();
  return marketCatalog().filter(c => c.catId === cat.id);
}

/** Reconstruit l'arbre de catégories du Marché commun, câble les clics (change cmActiveCat, rafraîchit la liste). */
function renderCmCategoryTree() {
  const el = $a('cmCategoryTree'); if (!el) return;
  el.innerHTML = CM_CATEGORIES.map(c => `<button class="cmCatBtn${c.id===cmActiveCat?' active':''}" data-cat="${c.id}">${c.label[LANG]}</button>`).join('');
  el.querySelectorAll('.cmCatBtn').forEach(btn => {
    btn.onclick = () => { cmActiveCat = btn.dataset.cat; cmDrilldownName = null; refreshCmBrowse(); };
  });
}
/** Affiche le solde silver et, si des ordres d'achat sont ouverts, le montant verrouillé en attente. */
function updateCmWallet() {
  const el = $a('cmWalletVal'); if (el) el.textContent = fmt(Math.round(S.silver)) + ' 🪙';
  const locked = (cmMyOrdersData || []).filter(o => o.side === 'buy' && o.status === 'open')
    .reduce((n,o) => n + o.price * o.qty, 0);
  const hint = $a('cmLockedHint');
  if (hint) {
    if (locked > 0) { hint.style.display = ''; hint.textContent = i18next.t('market:market.locked_hint', { amount: fmt(Math.round(locked)) }); }
    else hint.style.display = 'none';
  }
}
/** Recharge les annonces de la catégorie active (RPC market_listings, filtrées par slot si la catégorie en spécifie), rafraîchit l'arbre/portefeuille/liste. */
async function refreshCmBrowse() {
  renderCmCategoryTree();
  updateCmWallet();
  const list = $a('cmListingsList'); if (!list) return;
  list.innerHTML = `<div class="mEmpty">${i18next.t('market:market.loading_label')}</div>`;
  const cat = CM_CATEGORIES.find(c => c.id === cmActiveCat) || CM_CATEGORIES[0];
  const { data, error } = await sb.rpc('market_listings', { p_kind: cat.kind });
  let rows = data || [];
  if (cat.slots) rows = rows.filter(l => l.item_snapshot && cat.slots.includes(l.item_snapshot.slot));
  cmListings = rows;
  if (error) { list.innerHTML = `<div class="mEmpty">${i18next.t('market:market.loading_error')}</div>`; return; }
  renderCmListingsList();
}
/** @param {object} l - annonce (listing). @returns {string} icône de l'objet (matériau ou item_snapshot). */
function cmListingIcon(l) {
  if (l.item_kind === 'material') { const m = MARKET_MATERIALS.find(x => x.name === l.item_name); return m ? m.icon : '◈'; }
  return l.item_snapshot ? l.item_snapshot.icon : '📦';
}
/** @param {object} l - annonce (listing). @returns {string} couleur de l'objet (matériau ou item_snapshot). */
function cmListingColor(l) {
  if (l.item_kind === 'material') { const m = MARKET_MATERIALS.find(x => x.name === l.item_name); return m ? m.color : '#8fb0c9'; }
  return l.item_snapshot ? l.item_snapshot.color : '#c9a55a';
}
/** @param {string} iso - date ISO. @returns {string} durée écoulée compacte ("Nm"/"Nh"/"Nj"). */
function cmTimeAgo(iso) {
  const sec = Math.max(0, (Date.now() - new Date(iso).getTime())/1000);
  if (sec < 3600) return Math.round(sec/60) + 'm';
  if (sec < 86400) return Math.round(sec/3600) + 'h';
  return Math.round(sec/86400) + 'j';
}
// applique recherche + tri à un tableau de lignes déjà construites (utilisé par la vue groupée et
// la vue détaillée par niveau d'enchantement) -- priceOf renvoie Infinity pour une ligne "sans
// vente" (jamais triée artificiellement en tête par prix croissant)
/** @param {object[]} items - lignes à filtrer/trier. @param {function(object):number} priceOf - extrait le prix (Infinity si pas en vente, jamais triée en tête). @param {function(object):string} timeOf - extrait la date. @returns {object[]} lignes filtrées par recherche (cmSearch) et triées selon cmSort. */
function cmApplySearchSort(items, priceOf, timeOf) {
  const search = ($a('cmSearch').value || '').toLowerCase().trim();
  const sort = $a('cmSort').value;
  let rows = items.filter(x => !search || tr(x.name).toLowerCase().includes(search));
  if (sort === 'price_asc') rows.sort((a,b) => priceOf(a) - priceOf(b));
  else if (sort === 'price_desc') rows.sort((a,b) => { const pb = priceOf(b), pa = priceOf(a); return (pb===Infinity?-1:pb) - (pa===Infinity?-1:pa); });
  else rows.sort((a,b) => new Date(timeOf(b)||0) - new Date(timeOf(a)||0));
  return rows;
}
/** Reconstruit la liste du Marché groupée par nom d'objet (une ligne par objet, prix le plus bas/stock total), inclut les objets du catalogue sans vente en cours (grisés). Délègue au tiroir de drilldown si un nom est sélectionné. */
function renderCmListingsList() {
  const list = $a('cmListingsList'); if (!list) return;
  if (cmDrilldownName) { renderCmDrilldown(); return; }
  const cat = CM_CATEGORIES.find(c => c.id === cmActiveCat) || CM_CATEGORIES[0];
  // vue groupée par NOM d'objet (comme le Marché Central de BDO) : une ligne par objet, prix le
  // plus bas / stock total ; si plusieurs niveaux d'enchantement existent, clic = tiroir détaillé.
  // Les entrées du catalogue SANS aucune vente en cours restent affichées (grisées) -- navigation
  // "catalogue complet", pas juste "ce qui est en vente" (demande explicite du mockup fourni).
  const groups = new Map();
  for (const l of cmListings) {
    if (!groups.has(l.item_name)) groups.set(l.item_name, { name: l.item_name, kind: l.item_kind, items: [] });
    groups.get(l.item_name).items.push(l);
  }
  let rows = [...groups.values()].map(g => {
    const best = g.items.reduce((a,b) => a.price < b.price ? a : b);
    const stock = g.items.reduce((n,x) => n + (x.item_kind === 'material' ? x.qty : 1), 0);
    const enhLvs = new Set(g.items.map(x => (x.item_snapshot && x.item_snapshot.enhLv) || 0));
    return { ...g, best, stock, unlisted:false, drilldown: enhLvs.size > 1,
      latest: g.items.reduce((a,b) => new Date(a.created_at)>new Date(b.created_at)?a:b).created_at };
  });
  const listedNames = new Set(rows.map(r => r.name));
  catalogEntriesForCat(cat).forEach(c => {
    if (listedNames.has(c.name)) return;
    rows.push({ name:c.name, kind:c.kind, items:[], best:null, stock:0, unlisted:true, drilldown:false, latest:null, catalogEntry:c });
  });
  rows = cmApplySearchSort(rows, r => r.unlisted ? Infinity : r.best.price, r => r.latest);
  if (!rows.length) { list.innerHTML = `<div class="mEmpty">${i18next.t('market:market.no_listings')}</div>`; return; }
  list.innerHTML = rows.map(g => {
    const color = g.unlisted ? g.catalogEntry.color : cmListingColor(g.best);
    const icon = g.unlisted ? g.catalogEntry.icon : cmListingIcon(g.best);
    const key = g.unlisted ? cmItemKey(g.kind, g.name, 0) : cmItemKey(g.kind, g.name, g.best.item_snapshot ? g.best.item_snapshot.enhLv : 0);
    return `<div class="cmListCard${g.unlisted?' noListing':''}${key===cmSelectedKey?' selected':''}" data-name="${escapeHtml(g.name)}">
      <div class="cmListIcon" style="color:${color}">${icon}</div>
      <div class="cmListInfo">
        <div class="cmListName" style="color:${color}">${tr(g.name)}</div>
        <div class="cmListSub">${g.unlisted ? i18next.t('market:market.no_active_sale') : `${i18next.t('market:market.in_stock_label')} : ${fmt(g.stock)}${g.drilldown?` · ${g.items.length} ${i18next.t('market:market.levels_label')}`:''}`}</div>
      </div>
      <div class="cmListPrice"><div class="price">${g.unlisted ? '—' : `${i18next.t('market:market.from_price_label')} ${fmt(g.best.price)} 🪙`}</div></div>
    </div>`;
  }).join('');
  list.querySelectorAll('.cmListCard').forEach(card => {
    const g = rows.find(r => r.name === card.dataset.name);
    card.onclick = () => {
      if (g.drilldown) { cmDrilldownName = g.name; renderCmListingsList(); return; }
      cmSelectedKey = g.unlisted ? cmItemKey(g.kind, g.name, 0) : cmItemKey(g.kind, g.name, g.best.item_snapshot ? g.best.item_snapshot.enhLv : 0);
      renderCmListingsList();
      renderCmDetailPanel(g);
    };
  });
}
// tiroir détaillé par niveau d'enchantement (façon "+13/+14/+15/PRI/DUO..." du vrai marché BDO) —
// une ligne par niveau RÉELLEMENT en vente, avec son propre prix le plus bas et son stock
/** Reconstruit le tiroir détaillé par niveau d'enchantement (cmDrilldownName) — une ligne par niveau réellement en vente, avec prix/stock propres. */
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
    lv, kind: arr[0].item_kind, best: arr.reduce((a,b) => a.price < b.price ? a : b), stock: arr.length,
    latest: arr.reduce((a,b) => new Date(a.created_at)>new Date(b.created_at)?a:b).created_at,
  }));
  rows.sort((a,b) => a.lv - b.lv);
  rows = cmApplySearchSort(rows.map(r => ({...r, name:cmDrilldownName})), r => r.best.price, r => r.latest);
  const backBtn = `<button class="cmBackBtn" id="cmBackBtn">← ${i18next.t('market:market.back_btn')}</button>`;
  list.innerHTML = backBtn + rows.map(r => {
    const color = cmListingColor(r.best);
    const key = cmItemKey(r.kind, cmDrilldownName, r.lv);
    return `<div class="cmListCard${key===cmSelectedKey?' selected':''}" data-lv="${r.lv}">
      <div class="cmListIcon" style="color:${color}">${cmListingIcon(r.best)}</div>
      <div class="cmListInfo">
        <div class="cmListName" style="color:${color}">${ENH_NAMES[r.lv]} ${tr(cmDrilldownName)}</div>
        <div class="cmListSub">${i18next.t('market:market.in_stock_label')} : ${fmt(r.stock)}</div>
      </div>
      <div class="cmListPrice"><div class="price">${i18next.t('market:market.from_price_label')} ${fmt(r.best.price)} 🪙</div></div>
    </div>`;
  }).join('');
  $a('cmBackBtn').onclick = () => { cmDrilldownName = null; renderCmListingsList(); };
  list.querySelectorAll('.cmListCard').forEach(card => {
    const r = rows.find(x => x.lv === Number(card.dataset.lv));
    card.onclick = () => { cmSelectedKey = cmItemKey(r.kind, cmDrilldownName, r.lv); renderCmListingsList(); renderCmDetailPanel(r); };
  });
}
// possédé (INV) par nom+kind+enhLv EXACT -- corrige un flou de l'ancien placeMarketOrder (ne
// filtrait jamais par enhLv, risquait de vendre par erreur une autre variante du même objet)
/** @param {string} name @param {string} kind @param {number} enhLv - niveau d'enchant exact. @returns {number} quantité possédée dans INV correspondant exactement (jamais confondue avec une autre variante). */
function ownedQtyFor(name, kind, enhLv) {
  if (kind === 'material') return INV.filter(s => s && s.kind === 'material' && s.name === name).reduce((n,s) => n + s.qty, 0);
  return INV.some(s => s && s.kind === kind && s.name === name && (s.enhLv||0) === (enhLv||0)) ? 1 : 0;
}
/** @param {string} name @param {string} kind @param {number} enhLv. @returns {number} index INV de l'objet exact à vendre, -1 si absent. */
function findInvIndexForSell(name, kind, enhLv) {
  if (kind === 'material') return INV.findIndex(s => s && s.kind === 'material' && s.name === name);
  return INV.findIndex(s => s && s.kind === kind && s.name === name && (s.enhLv||0) === (enhLv||0));
}
// panneau de détail : stats + comparaison (objets réellement en vente) ou état "non listé" +
// offres d'achat/de vente (2026-07-22, port du mockup)
/** @param {?object} g - ligne groupée sélectionnée (renderCmListingsList/renderCmDrilldown), null pour l'état vide. Reconstruit le panneau de détail : stats/comparaison à l'équipé si en vente, sinon état "non listé", + formulaires d'offre d'achat/de vente. */
function renderCmDetailPanel(g) {
  const panel = $a('cmDetailPanel'); if (!panel) return;
  if (!g) { panel.innerHTML = `<div class="mEmpty">${i18next.t('market:market.select_item_hint')}</div>`; return; }
  const l = g.best; // ligne "réelle" (item_snapshot) si en vente, sinon null
  const catalogEntry = g.catalogEntry || marketCatalog().find(c => c.name === g.name && c.kind === g.kind);
  const kind = g.kind || (catalogEntry && catalogEntry.kind) || 'material';
  const enhLv = l ? ((l.item_snapshot && l.item_snapshot.enhLv) || 0) : (g.lv || 0);
  const color = l ? cmListingColor(l) : (catalogEntry ? catalogEntry.color : '#c9a55a');
  const icon = l ? cmListingIcon(l) : (catalogEntry ? catalogEntry.icon : '◈');

  let statsHtml = '', compareHtml = '';
  if (l && (kind === 'gear' || kind === 'jackpot')) {
    const snap = l.item_snapshot || {};
    const eff = effectiveApDp(snap);
    const rows = [];
    if (eff.ap) rows.push(['PA', '+'+eff.ap]);
    if (eff.dp) rows.push(['PD', '+'+eff.dp]);
    if (eff.hp) rows.push(['PV', '+'+eff.hp]);
    if (snap.enhLv) rows.push([i18next.t('market:market.level_label'), ENH_NAMES[snap.enhLv]]);
    statsHtml = `<div class="cmDetailStats">${rows.map(([k,v]) => `<div class="srow"><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
    const slotId = kind === 'jackpot' ? accSlotFor(snap) : snap.slot;
    let equipped = slotId ? EQUIP[slotId] : null;
    if (slotId === 'ring') equipped = itemScore(EQUIP.ring1) <= itemScore(EQUIP.ring2) ? EQUIP.ring1 : EQUIP.ring2;
    if (slotId === 'earring') equipped = itemScore(EQUIP.earring1) <= itemScore(EQUIP.earring2) ? EQUIP.earring1 : EQUIP.earring2;
    if (equipped) {
      const effEq = effectiveApDp(equipped);
      const cmpRows = [['PA', effEq.ap||0, eff.ap||0], ['PD', effEq.dp||0, eff.dp||0], ['PV', effEq.hp||0, eff.hp||0]].filter(([,a,b]) => a || b);
      compareHtml = `<div class="cmDetailSub cmCompareTitle">${i18next.t('market:market.vs_label')} <b style="color:${equipped.color||'#c9a55a'}">${tr(equipped.name)}</b></div>
        <table class="cmCompareTable"><thead><tr><th></th><th>${i18next.t('market:market.equipped_label')}</th><th>${i18next.t('market:market.this_one_label')}</th><th>Δ</th></tr></thead>
        <tbody>${cmpRows.map(([k,a,b]) => { const delta = b - a; const cls = delta > 0 ? 'up' : delta < 0 ? 'down' : ''; return `<tr><td>${k}</td><td>${a}</td><td>${b}</td><td class="cmDelta ${cls}">${delta>0?'+':''}${delta}</td></tr>`; }).join('')}</tbody></table>`;
    }
  } else if (l) {
    statsHtml = `<div class="cmDetailStats"><div class="srow"><span>${i18next.t('market:market.available_qty_label')}</span><b>${fmt(l.qty)}</b></div></div>`;
  }

  const owned = ownedQtyFor(g.name, kind, enhLv);
  const displayName = (enhLv ? ENH_NAMES[enhLv]+' ' : '') + tr(g.name);
  panel.innerHTML = `
    <div class="cmDetailIcon" style="border-color:${color};color:${color}">${icon}</div>
    <div class="cmDetailTitle" style="color:${color}">${displayName}</div>
    <div class="cmDetailSub">${l ? `${i18next.t('market:market.sold_by_label')} ${escapeHtml(l.pseudo||'?')} · ${cmTimeAgo(l.created_at)}` : i18next.t('market:market.no_active_sale')}</div>
    ${statsHtml}${compareHtml}
    ${l ? `<div class="cmPriceBig">${fmt(l.price)} 🪙${kind==='material'?(' × '+fmt(l.qty)):''}</div><button class="btnBuyListing">${i18next.t('market:market.buy_btn')}</button>`
        : `<div class="cmDetailSub">${i18next.t('market:market.no_seller_hint')}</div>`}
    <button class="cmOfferBtn" id="cmOfferBtn">📝 ${i18next.t('market:market.offer_buy_btn')}</button>
    <div class="cmOfferForm" id="cmOfferForm">
      <div class="cmOfferLbl">${i18next.t('market:market.offer_qty_label')}</div>
      <div class="cmOfferStepRow"><input id="cmOfferQty" type="number" min="1" value="1"><button type="button" id="cmOfferQtyMinus">−</button><button type="button" id="cmOfferQtyPlus">+</button></div>
      <div class="cmOfferLbl">${i18next.t('market:market.offer_buy_price_label')}</div>
      <input id="cmOfferPrice" type="number" placeholder="${l ? Math.round(l.price*0.9) : 500000}">
      <button id="cmOfferSubmitBtn">${i18next.t('market:market.offer_submit_btn')}</button>
    </div>
    <button class="cmOfferBtn" id="cmSellOfferBtn">🏷️ ${i18next.t('market:market.offer_sell_btn')}${owned>0?` (${i18next.t('market:market.owned_label')} : ${fmt(owned)})`:''}</button>
    <div class="cmOfferForm" id="cmSellOfferForm">
      ${owned>0 ? `<div class="cmOfferLbl">${i18next.t('market:market.offer_qty_label')} (/${fmt(owned)})</div>
      <div class="cmOfferStepRow"><input id="cmSellOfferQty" type="number" min="1" max="${owned}" value="1"><button type="button" id="cmSellOfferQtyMinus">−</button><button type="button" id="cmSellOfferQtyPlus">+</button></div>` : ''}
      <div class="cmOfferLbl">${owned>0 ? i18next.t('market:market.offer_sell_price_label') : i18next.t('market:market.not_owned_label', { name: tr(g.name) })}</div>
      <input id="cmSellOfferPrice" type="number" placeholder="${l ? Math.round(l.price*1.05) : 550000}" ${owned>0?'':'disabled'}>
      <button id="cmSellOfferSubmitBtn" ${owned>0?'':'disabled'}>${i18next.t('market:market.offer_sell_submit_btn')}</button>
    </div>
    <div id="cmBuyMsg"></div>`;

  if (l) panel.querySelector('.btnBuyListing').onclick = () => openBuyModal(g);
  wireCmOfferForms(panel, g, kind, enhLv, owned);
}
/** @param {HTMLElement} panel - panneau de détail. @param {object} g - ligne sélectionnée. @param {string} kind @param {number} enhLv @param {number} owned - quantité possédée. Câble les formulaires d'offre d'achat/de vente (ouverture, +/-, soumission RPC market_place_order). */
function wireCmOfferForms(panel, g, kind, enhLv, owned) {
  const msg = () => $a('cmBuyMsg');
  panel.querySelector('#cmOfferBtn').onclick = () => panel.querySelector('#cmOfferForm').classList.toggle('open');
  const qtyEl = panel.querySelector('#cmOfferQty');
  panel.querySelector('#cmOfferQtyMinus').onclick = () => { qtyEl.value = Math.max(1, (parseInt(qtyEl.value,10)||1)-1); };
  panel.querySelector('#cmOfferQtyPlus').onclick = () => { qtyEl.value = (parseInt(qtyEl.value,10)||1)+1; };
  panel.querySelector('#cmOfferSubmitBtn').onclick = async () => {
    const m = msg();
    const price = Number(panel.querySelector('#cmOfferPrice').value);
    const qty = kind === 'material' ? Math.max(1, parseInt(qtyEl.value,10)||1) : 1;
    if (!price || price <= 0) { m.className='fail'; m.textContent = i18next.t('market:market.invalid_price'); return; }
    const { error } = await sb.rpc('market_place_order', {
      p_side:'buy', p_item_key: cmItemKey(kind, g.name, enhLv), p_item_name: g.name, p_item_kind: kind,
      p_price: price, p_qty: qty, p_inv_index: null,
    });
    if (error) { m.className='fail'; m.textContent = i18next.t('market:market.failed_with_reason', { reason: error.message }); return; }
    m.className='ok'; m.textContent = i18next.t('market:market.offer_placed');
    await loadCloudSave();
    updateCmWallet(); refreshCmBrowse(); refreshMyMarketOrders();
  };
  panel.querySelector('#cmSellOfferBtn').onclick = () => panel.querySelector('#cmSellOfferForm').classList.toggle('open');
  const sellSubmit = panel.querySelector('#cmSellOfferSubmitBtn');
  if (owned > 0) {
    const sellQtyEl = panel.querySelector('#cmSellOfferQty');
    if (sellQtyEl) {
      panel.querySelector('#cmSellOfferQtyMinus').onclick = () => { sellQtyEl.value = Math.max(1, (parseInt(sellQtyEl.value,10)||1)-1); };
      panel.querySelector('#cmSellOfferQtyPlus').onclick = () => { sellQtyEl.value = Math.min(owned, (parseInt(sellQtyEl.value,10)||1)+1); };
    }
    sellSubmit.onclick = async () => {
      const m = msg();
      const price = Number(panel.querySelector('#cmSellOfferPrice').value);
      const qty = kind === 'material' ? Math.max(1, Math.min(owned, parseInt(sellQtyEl.value,10)||1)) : 1;
      if (!price || price <= 0) { m.className='fail'; m.textContent = i18next.t('market:market.invalid_price'); return; }
      const invIndex = findInvIndexForSell(g.name, kind, enhLv);
      if (invIndex === -1) { m.className='fail'; m.textContent = i18next.t('market:market.no_item_owned'); return; }
      const { error } = await sb.rpc('market_place_order', {
        p_side:'sell', p_item_key: cmItemKey(kind, g.name, enhLv), p_item_name: g.name, p_item_kind: kind,
        p_price: price, p_qty: qty, p_inv_index: invIndex,
      });
      if (error) { m.className='fail'; m.textContent = i18next.t('market:market.failed_with_reason', { reason: error.message }); return; }
      m.className='ok'; m.textContent = i18next.t('market:market.sell_offer_placed');
      await loadCloudSave();
      updateCmWallet(); refreshCmBrowse(); refreshMyMarketOrders();
    };
  }
}
$a('cmSearch').oninput = () => renderCmListingsList();
$a('cmSort').onchange = () => renderCmListingsList();

// ============================================================
// popup "Acheter" façon Marché Central BDO (2026-07-22) : échelle de prix RÉELLE
// (market_order_book, regroupée par prix), stepper quantité, cycle de niveau d'optimisation
// (variantes enhLv réellement en vente), graphique (market_trades réel), coût total.
// ============================================================
let cmBmEntry = null; // { name, kind } de l'objet actuellement affiché dans la popup
let cmBmEnhLv = 0;
let cmBmLadder = []; // [{price, stock, orders}] -- construit depuis market_order_book, PAS inventé
/** @param {object} g - ligne sélectionnée (liste ou drilldown). Ouvre la popup "Acheter" (échelle de prix réelle, stepper quantité, cycle de niveau d'enchant, graphique). */
async function openBuyModal(g) {
  cmBmEntry = { name: g.name, kind: g.kind };
  cmBmEnhLv = g.best ? ((g.best.item_snapshot && g.best.item_snapshot.enhLv) || 0) : (g.lv || 0);
  const icon = g.best ? cmListingIcon(g.best) : (g.catalogEntry ? g.catalogEntry.icon : '◈');
  const color = g.best ? cmListingColor(g.best) : (g.catalogEntry ? g.catalogEntry.color : '#c9a55a');
  $a('cmBmIcon').innerHTML = icon; $a('cmBmIcon').style.color = color;
  $a('cmBmName').textContent = (cmBmEnhLv ? ENH_NAMES[cmBmEnhLv]+' ' : '') + tr(g.name);
  $a('cmBmPrice').value = g.best ? g.best.price : '';
  $a('cmBmQty').value = 1;
  $a('cmBmSolde').textContent = fmt(Math.round(S.silver)) + ' 🪙';
  $a('cmBmMsg').textContent = ''; $a('cmBmMsg').className = 'cmBmMsg';
  await refreshBuyModalLadderAndStats();
  updateBmCost();
  $a('cmBuyModalBg').classList.add('open');
}
/** @returns {string} clé d'objet de la popup Acheter actuellement ouverte (cmBmEntry/cmBmEnhLv). */
function bmItemKey() { return cmItemKey(cmBmEntry.kind, cmBmEntry.name, cmBmEnhLv); }
/** Recharge l'échelle de prix réelle (market_order_book) et les stats/graphique (market_trades) de la popup Acheter, reconstruit la liste de paliers. */
async function refreshBuyModalLadderAndStats() {
  const key = bmItemKey();
  const [{ data: book }, { data: trades }] = await Promise.all([
    sb.rpc('market_order_book', { p_item_key: key }),
    sb.from('market_trades').select('price, qty, created_at').eq('item_key', key).order('created_at', { ascending:true }).limit(20),
  ]);
  const stockByPrice = new Map(), ordersByPrice = new Map();
  (book || []).forEach(r => {
    if (r.side === 'sell') stockByPrice.set(Number(r.price), (stockByPrice.get(Number(r.price))||0) + Number(r.qty));
    else ordersByPrice.set(Number(r.price), (ordersByPrice.get(Number(r.price))||0) + Number(r.qty));
  });
  const prices = new Set([...stockByPrice.keys(), ...ordersByPrice.keys()]);
  cmBmLadder = [...prices].sort((a,b) => b - a).map(price => ({
    price, stock: stockByPrice.get(price) || 0, orders: ordersByPrice.get(price) || 0,
  }));
  renderBmTierList();
  const totalStock = [...stockByPrice.values()].reduce((n,q) => n+q, 0);
  const lastTrade = (trades && trades.length) ? trades[trades.length-1] : null;
  $a('cmBmStatsGrid').innerHTML = `
    <div class="cmBmStat"><div class="cmBmLbl">${i18next.t('market:market.col_stock')}</div><div class="cmBmStatVal">${fmt(totalStock)}</div></div>
    <div class="cmBmStat"><div class="cmBmLbl">${i18next.t('market:market.recent_price_label')}</div><div class="cmBmStatVal">${lastTrade?fmt(lastTrade.price):'—'}</div></div>
    <div class="cmBmStat"><div class="cmBmLbl">${i18next.t('market:market.transactions_label')}</div><div class="cmBmStatVal">${(trades||[]).length}${(trades||[]).length===20?'+':''}</div></div>
    <div class="cmBmStat"><div class="cmBmLbl">${i18next.t('market:market.last_transaction_label')}</div><div class="cmBmStatVal">${lastTrade?cmTimeAgo(lastTrade.created_at):'—'}</div></div>`;
  drawItemPriceChart('cmBmChart', trades || []);
  const group = cmListings.filter(l => l.item_name === cmBmEntry.name && l.item_kind === cmBmEntry.kind);
  const enhLvs = [...new Set(group.map(l => (l.item_snapshot && l.item_snapshot.enhLv) || 0))].sort((a,b) => a-b);
  const tierWrap = $a('cmBmTierRowWrap');
  if (enhLvs.length > 1) { tierWrap.style.display = ''; $a('cmBmTierVal').textContent = ENH_NAMES[cmBmEnhLv]; }
  else tierWrap.style.display = 'none';
}
/** Reconstruit la liste de paliers de prix (cmBmLadder) de la popup Acheter, câble le clic pour sélectionner un prix. */
function renderBmTierList() {
  const list = $a('cmBmTierList');
  const selectedPrice = Number($a('cmBmPrice').value) || null;
  if (!cmBmLadder.length) { list.innerHTML = `<div class="mEmpty">${i18next.t('market:market.no_orders_label')}</div>`; return; }
  list.innerHTML = cmBmLadder.map(r => `<div class="cmBmTierRow${r.stock>0?' hasStock':''}${r.price===selectedPrice?' sel':''}" data-price="${r.price}">
    <span>${r.stock>0?fmt(r.stock):'—'}</span><span class="p">${fmt(r.price)}</span><span>${r.orders>0?fmt(r.orders):'—'}</span></div>`).join('');
  list.querySelectorAll('.cmBmTierRow').forEach(row => {
    row.onclick = () => { $a('cmBmPrice').value = row.dataset.price; renderBmTierList(); updateBmCost(); };
  });
}
/** Recalcule et affiche le coût total (prix×qté) et le solde après achat dans la popup Acheter. */
function updateBmCost() {
  const price = Number($a('cmBmPrice').value) || 0;
  const qty = parseInt($a('cmBmQty').value, 10) || 1;
  const total = price * qty;
  $a('cmBmCostBig').textContent = fmt(total) + ' 🪙';
  $a('cmBmAfter').textContent = fmt(Math.round(S.silver) - total) + ' 🪙';
}
/** @param {number} dir - +1/-1. Fait défiler cmBmEnhLv vers le niveau d'enchant réellement en vente suivant/précédent, rafraîchit prix/échelle/stats. */
async function cycleBmTier(dir) {
  const group = cmListings.filter(l => l.item_name === cmBmEntry.name && l.item_kind === cmBmEntry.kind);
  const enhLvs = [...new Set(group.map(l => (l.item_snapshot && l.item_snapshot.enhLv) || 0))].sort((a,b) => a-b);
  const idx = enhLvs.indexOf(cmBmEnhLv);
  if (idx === -1 || enhLvs.length < 2) return;
  cmBmEnhLv = enhLvs[(idx + dir + enhLvs.length) % enhLvs.length];
  const best = group.filter(l => ((l.item_snapshot && l.item_snapshot.enhLv)||0) === cmBmEnhLv).reduce((a,b) => a.price < b.price ? a : b);
  $a('cmBmName').textContent = (cmBmEnhLv ? ENH_NAMES[cmBmEnhLv]+' ' : '') + tr(cmBmEntry.name);
  $a('cmBmPrice').value = best.price;
  await refreshBuyModalLadderAndStats();
  updateBmCost();
}
$a('cmBmClose').onclick = () => $a('cmBuyModalBg').classList.remove('open');
$a('cmBmPrice').addEventListener('input', () => { renderBmTierList(); updateBmCost(); });
$a('cmBmQty').addEventListener('input', updateBmCost);
$a('cmBmQtyPlus').onclick = () => { $a('cmBmQty').value = (parseInt($a('cmBmQty').value,10)||1)+1; updateBmCost(); };
$a('cmBmQtyMinus').onclick = () => { $a('cmBmQty').value = Math.max(1,(parseInt($a('cmBmQty').value,10)||1)-1); updateBmCost(); };
$a('cmBmMax').onclick = () => { if (cmBmLadder.length) { $a('cmBmPrice').value = Math.max(...cmBmLadder.map(r=>r.price)); renderBmTierList(); updateBmCost(); } };
$a('cmBmMin').onclick = () => { if (cmBmLadder.length) { $a('cmBmPrice').value = Math.min(...cmBmLadder.map(r=>r.price)); renderBmTierList(); updateBmCost(); } };
$a('cmBmTierPlus').onclick = () => cycleBmTier(1);
$a('cmBmTierMinus').onclick = () => cycleBmTier(-1);
$a('cmBmBuyBtn').onclick = async () => {
  const price = Number($a('cmBmPrice').value);
  const qty = cmBmEntry.kind === 'material' ? (parseInt($a('cmBmQty').value,10) || 1) : 1;
  const msg = $a('cmBmMsg');
  if (!price || price <= 0) { msg.className='cmBmMsg fail'; msg.textContent = i18next.t('market:market.invalid_price'); return; }
  const { data: orderId, error } = await sb.rpc('market_place_order', {
    p_side:'buy', p_item_key: bmItemKey(), p_item_name: cmBmEntry.name, p_item_kind: cmBmEntry.kind,
    p_price: price, p_qty: qty, p_inv_index: null,
  });
  if (error) { msg.className='cmBmMsg fail'; msg.textContent = i18next.t('market:market.failed_with_reason', { reason: error.message }); return; }
  await loadCloudSave();
  // détermine si l'achat a été exécuté immédiatement (matché serveur) ou reste en attente, en
  // relisant le VRAI statut de l'ordre -- jamais deviné/simulé côté client
  const { data: myOrders } = await sb.rpc('market_my_orders');
  const placed = (myOrders || []).find(o => o.id === orderId);
  msg.className = 'cmBmMsg ok';
  msg.textContent = (placed && placed.status === 'filled')
    ? i18next.t('market:market.instant_buy_done', { price: fmt(placed.price) })
    : i18next.t('market:market.pending_order_created');
  $a('cmBmSolde').textContent = fmt(Math.round(S.silver)) + ' 🪙';
  updateBmCost();
  await refreshBuyModalLadderAndStats();
  updateCmWallet();
  refreshCmBrowse();
  refreshMyMarketOrders();
};
let cmBmMouseDownOnBackdrop = false;
$a('cmBuyModalBg').addEventListener('mousedown', e => { cmBmMouseDownOnBackdrop = (e.target.id === 'cmBuyModalBg'); });
$a('cmBuyModalBg').addEventListener('click', e => { if (e.target.id === 'cmBuyModalBg' && cmBmMouseDownOnBackdrop) $a('cmBuyModalBg').classList.remove('open'); });

// chandelier canvas générique (2026-07-16, généralisé le 2026-07-22 pour marcher sur N'IMPORTE
// QUEL item_key, pas seulement les matériaux) : chaque transaction = 1 bougie (open = prix de la
// transaction précédente, close = son propre prix) -- fidèle aux VRAIES transactions, sans
// inventer de mèche haute/basse intra-transaction
/** @param {string} canvasId - id du canvas cible. @param {object[]} trades - transactions réelles (market_trades), triées par date. Dessine un chandelier fidèle (chaque transaction = 1 bougie, pas de mèche inventée), placeholder si moins de 2 transactions. */
function drawItemPriceChart(canvasId, trades) {
  const canvas = $a(canvasId); if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width = canvas.clientWidth * 2;
  const H = canvas.height = 110 * 2;
  ctx.clearRect(0,0,W,H);
  if (trades.length < 2) {
    ctx.fillStyle = '#5a5f74'; ctx.font = '18px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(i18next.t('market:market.not_enough_transactions'), W/2, H/2);
    return;
  }
  const candles = [];
  for (let i = 1; i < trades.length; i++) {
    const open = Number(trades[i-1].price), close = Number(trades[i].price);
    candles.push({ open, close, high: Math.max(open,close), low: Math.min(open,close) });
  }
  const padL = 60, padR = 12, padT = 12, padB = 12;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const allPrices = candles.flatMap(c => [c.high, c.low]);
  let pMin = Math.min(...allPrices), pMax = Math.max(...allPrices);
  if (pMin === pMax) { pMin *= 0.98; pMax *= 1.02; }
  const pad = (pMax-pMin)*0.08; pMin -= pad; pMax += pad;
  const y = p => padT + plotH - ((p-pMin)/(pMax-pMin))*plotH;
  const cw = plotW/candles.length;
  ctx.strokeStyle = '#2c2a33'; ctx.lineWidth = 1; ctx.font = '16px sans-serif'; ctx.fillStyle = '#9a917e'; ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const py = padT + plotH*i/4;
    ctx.beginPath(); ctx.moveTo(padL,py); ctx.lineTo(W-padR,py); ctx.stroke();
    ctx.fillText(fmt(pMax - (pMax-pMin)*i/4), padL-8, py+5);
  }
  candles.forEach((c,i) => {
    const cx = padL + cw*i + cw/2;
    const up = c.close >= c.open;
    ctx.strokeStyle = ctx.fillStyle = up ? '#70d890' : '#e06060';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, y(c.high)); ctx.lineTo(cx, y(c.low)); ctx.stroke();
    const bodyTop = y(Math.max(c.open,c.close)), bodyBot = y(Math.min(c.open,c.close));
    const bw = Math.max(3, cw*0.55);
    ctx.fillRect(cx-bw/2, bodyTop, bw, Math.max(2, bodyBot-bodyTop));
  });
}

// ============================================================
// "Mes ordres" ancré à droite en permanence (2026-07-22) : onglets Achat/Vente séparés, remplace
// l'ancien 3e sous-onglet. Cancel = rend le silver/objet bloqué (market_cancel_order, inchangé).
// ============================================================
/** Câble les onglets Achat/Vente du panneau "Mes ordres". */
function wireCmMyOrdersTabs() {
  document.querySelectorAll('.cmMyOrdersTab').forEach(btn => {
    btn.onclick = () => { cmMyOrdersTab = btn.dataset.side; renderCmMyOrdersList(); };
  });
}
/** Recharge mes ordres (RPC market_my_orders) et rafraîchit portefeuille + liste. */
async function refreshMyMarketOrders() {
  const { data } = await sb.rpc('market_my_orders');
  cmMyOrdersData = data || [];
  updateCmWallet();
  renderCmMyOrdersList();
}
/** Reconstruit la liste "Mes ordres" (onglet actif cmMyOrdersTab), câble le bouton Annuler (market_cancel_order). */
function renderCmMyOrdersList() {
  const box = $a('cmMyOrders'); if (!box) return;
  document.querySelectorAll('.cmMyOrdersTab').forEach(btn => btn.classList.toggle('active', btn.dataset.side === cmMyOrdersTab));
  const buyCount = cmMyOrdersData.filter(o => o.side === 'buy').length;
  const sellCount = cmMyOrdersData.filter(o => o.side === 'sell').length;
  if ($a('cmOrdersCountBuy')) $a('cmOrdersCountBuy').textContent = fmt(buyCount);
  if ($a('cmOrdersCountSell')) $a('cmOrdersCountSell').textContent = fmt(sellCount);
  const rows = cmMyOrdersData.filter(o => o.side === cmMyOrdersTab);
  if (!rows.length) { box.innerHTML = `<div class="mEmpty">${i18next.t('market:market.no_orders_label')}</div>`; return; }
  box.innerHTML = rows.map(o => `
    <div class="cmRow">
      <div class="cmInfo"><div class="mName">${o.side==='buy'?'🛒':'🏷️'} ${o.item_snapshot&&o.item_snapshot.enhLv?ENH_NAMES[o.item_snapshot.enhLv]+' ':''}${tr(o.item_name)}</div>
        <div class="cmOwned">${fmt(o.price)} 🪙 × ${fmt(o.qty)}/${fmt(o.qty_original)} · ${o.status==='open'?i18next.t('market:market.status_open'):i18next.t('market:market.status_done')}</div></div>
      ${o.status==='open' ? `<button class="cmCancelOrder" data-id="${o.id}">${i18next.t('market:market.cancel_btn')}</button>` : ''}
    </div>`).join('');
  box.querySelectorAll('.cmCancelOrder').forEach(btn => {
    btn.onclick = async () => {
      const { error } = await sb.rpc('market_cancel_order', { p_order_id: Number(btn.dataset.id) });
      if (!error) { await loadCloudSave(); refreshCommonMarket(); }
    };
  });
}
