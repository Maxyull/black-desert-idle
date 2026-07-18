// ═══ MARCHÉ D'ÉCHANGE (2026-07-10, demande explicite : "vrai backend d'échange... c'est fini la
// sauvegarde locale") ═══════════════════════════════════════════════════════════════════════════
// Seul point du module qui fait vraiment traverser un PET d'un compte à l'autre (pas juste des
// compteurs comme sync.js) -- s'appuie sur
// supabase/migrations/20260710150000_companion_pet_trade_market.sql (offres/contre-offres/
// historique/livraisons/notifications, transaction atomique côté serveur). Accès Supabase
// EXCLUSIVEMENT via window.parent.getSbClient()/getCurrentUserForSync()/getMyPseudoForSync()
// (jamais window.parent.sb -- même piège déjà corrigé dans sync.js).

let marketSubTab = 'browse'; // browse | mine | history
let marketOffers = [];
let marketMyOffers = [];
let marketMyCounters = [];
let marketCountersByOffer = {};
let marketHistory = [];
let marketLoading = false;
let marketCreatePetUid = null;
let marketCreateAcceptsPets = true;
let marketCreateAcceptsSilver = false;
let marketCounterOfferId = null;
let marketCounterPetUids = new Set();
let marketCounterIncludeEver = false;

/** @returns {Window|null} la fenêtre hôte (jeu principal) si le module tourne bien en iframe, sinon null. */
function marketHostWin(){ return (window.parent && window.parent!==window) ? window.parent : null; }
/** @returns {object|null} client Supabase du jeu hôte (jamais un 2e SDK dans l'iframe, voir en-tête du fichier). */
function marketSb(){ const w=marketHostWin(); return w && typeof w.getSbClient==='function' ? w.getSbClient() : null; }
/** @returns {object|null} utilisateur Supabase courant, récupéré via le jeu hôte. */
function marketUser(){ const w=marketHostWin(); return w && typeof w.getCurrentUserForSync==='function' ? w.getCurrentUserForSync() : null; }
/** @returns {string} pseudo affiché du joueur courant (repli 'Joueur' si indisponible). */
function marketPseudo(){ const w=marketHostWin(); return w && typeof w.getMyPseudoForSync==='function' ? w.getMyPseudoForSync() : i18next.t('companions:companions.market.default_pseudo'); }
/** @returns {boolean} true si le compte courant est un invité (Marché inaccessible aux invités). */
function marketIsGuest(){ const w=marketHostWin(); return w && typeof w.isGuest==='function' ? w.isGuest() : false; }
/** @returns {boolean} true si le Marché peut être utilisé (Supabase + user dispo, pas invité). */
function marketReady(){ return !!(marketSb() && marketUser() && !marketIsGuest()); }

/** @param {object} pet - familier local. @returns {object} snapshot sérialisable envoyé au serveur (pet_snapshot), assez d'info pour recréer le pet côté acheteur. */
function petSnapshotOf(pet){
  return { uid:pet.uid, name:pet.cat.name, art:pet.cat.art, sec:pet.cat.sec, typ:pet.cat.typ, orig:pet.cat.orig,
    rar:pet.rar, tier:pet.tier||1, tierMult:tierMultOf(pet), stats:pet.stats.slice() };
}
/**
 * Reconstruit un pet local jouable à partir d'un snapshot reçu du serveur (livraison d'échange).
 * @param {object} snap - pet_snapshot stocké côté Supabase (voir petSnapshotOf).
 * @returns {object} nouveau pet inséré dans PETS, avec un id local frais et faim pleine.
 */
function petFromSnapshot(snap){
  const cat = PET_CATALOG.find(c=>c.name===snap.name) || {name:snap.name,art:snap.art,sec:snap.sec,typ:snap.typ,orig:snap.orig,rar:snap.rar};
  return { id:petId++, uid:snap.uid||crypto.randomUUID(), cat, rar:snap.rar, stats:(snap.stats||[]).slice(),
    hunger:100, terrain:false, tier:snap.tier||1, tierXp:0, tierMult:snap.tierMult||rollTierMult(snap.tier||1) };
}
/** @param {*} e - erreur capturée (fetch/RPC Supabase). @returns {string} message d'erreur affichable, repli générique si absent. */
function marketMkErr(e){ return (e && e.message) || i18next.t('companions:companions.common.network_error'); }

// ═══ NAVIGATION ═════════════════════════════════════════════════════════════════════════════
/** Rend la nav des sous-onglets Marché (browse/mine/history) et délègue au rendu du sous-onglet actif ; affiche un message de blocage si le Marché n'est pas accessible (invité/déconnecté). */
function renderMarketTab(){
  const nav = document.getElementById('market-nav');
  if(nav){
    nav.innerHTML = ['browse','mine','history'].map(t=>{
      const lbl = t==='browse'?i18next.t('companions:companions.market.tab_browse'):t==='mine'?i18next.t('companions:companions.market.tab_mine'):i18next.t('companions:companions.market.tab_history');
      return `<button class="schip ${marketSubTab===t?'on':''}" onclick="setMarketSubTab('${t}')">${lbl}</button>`;
    }).join('');
  }
  const body = document.getElementById('market-body');
  if(!body) return;
  if(!marketReady()){
    body.innerHTML = `<div style="padding:24px;text-align:center;font-size:12px;color:var(--cream3)">
      ${marketIsGuest()?i18next.t('companions:companions.market.guest_blocked'):i18next.t('companions:companions.market.login_required')}
    </div>`;
    return;
  }
  if(marketSubTab==='browse') renderMarketBrowse();
  else if(marketSubTab==='mine') renderMarketMine();
  else renderMarketHistory();
}
/** Change le sous-onglet actif du Marché et re-rend. @param {string} t - 'browse'|'mine'|'history'. */
function setMarketSubTab(t){ marketSubTab=t; renderMarketTab(); }

/**
 * Construit le HTML d'une "puce" pet (canvas art + nom + rareté/tier) réutilisée partout dans le Marché.
 * @param {object} snap - pet_snapshot (ou équivalent) à afficher.
 * @param {string} [extraBtn] - HTML optionnel d'un bouton additionnel accolé à la puce.
 * @returns {string} HTML de la puce ; le canvas doit ensuite être peint via paintMarketChips().
 */
function petChipHtml(snap, extraBtn){
  return `<div style="display:flex;align-items:center;gap:8px;background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:6px 9px">
    <canvas class="market-chip-canvas" data-art="${snap.art||''}" data-tier="${snap.tier||1}" width="32" height="32" style="width:32px;height:32px;image-rendering:pixelated;flex-shrink:0"></canvas>
    <div style="min-width:0">
      <div style="font-size:10.5px;color:var(--cream);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px">${snap.name}</div>
      <div style="font-size:9px;color:${rc(snap.rar)}">${rn(snap.rar)} · T${snap.tier||1}</div>
    </div>
    ${extraBtn||''}
  </div>`;
}
/** Peint les canvas `.market-chip-canvas` (art pixel + tier) déjà présents dans le DOM. @param {Element} [root] - conteneur à parcourir (document entier par défaut). */
function paintMarketChips(root){
  (root||document).querySelectorAll('.market-chip-canvas').forEach(cv=>{
    const art=cv.dataset.art, tier=+cv.dataset.tier||1;
    if(art && typeof drawPixelArt==='function') drawPixelArt(cv, art, 32, null, tier);
  });
}

// ═══ MARCHÉ (offres ouvertes des autres joueurs) ═══════════════════════════════════════════════
/** Charge et affiche les offres ouvertes des AUTRES joueurs (exclut les miennes), triées par date décroissante. */
async function renderMarketBrowse(){
  const body = document.getElementById('market-body');
  body.innerHTML = `<div style="padding:16px">
    <button class="btn btn-gold" style="margin-bottom:12px" onclick="openCreateOfferModal()">${i18next.t('companions:companions.market.propose_btn')}</button>
    <div id="market-browse-list" style="display:flex;flex-direction:column;gap:8px;font-size:11px;color:var(--cream3)">${i18next.t('companions:companions.common.loading')}</div>
  </div>`;
  try{
    const sb = marketSb(); const me = marketUser();
    const { data, error } = await sb.from('pet_trade_offers').select('id, status, pet_snapshot, accepts_pets, pet_qty, accepts_silver, min_silver, owner_pseudo, owner_user_id, expires_at').eq('status','open').neq('owner_user_id', me.id).order('created_at',{ascending:false}).limit(60);
    if(error) throw error;
    marketOffers = data||[];
  }catch(e){ marketOffers=[]; }
  const list = document.getElementById('market-browse-list');
  if(!list) return;
  if(!marketOffers.length){ list.innerHTML = `<div style="padding:12px;text-align:center">${i18next.t('companions:companions.market.no_open_offers')}</div>`; return; }
  list.innerHTML = marketOffers.map(o=>{
    const snap = o.pet_snapshot;
    const wants = [o.accepts_pets?i18next.t('companions:companions.market.wants_pets', {count:o.pet_qty}):null, o.accepts_silver?`≥ ${(o.min_silver||0).toLocaleString(NUM_LOCALE)} Silver`:null].filter(Boolean).join(i18next.t('companions:companions.market.and_or'));
    return `<div style="display:flex;align-items:center;gap:12px;background:var(--s2);border:1px solid var(--border);border-radius:9px;padding:10px 12px">
      ${petChipHtml(snap)}
      <div style="flex:1;font-size:10.5px;color:var(--cream2)">
        <div>${i18next.t('companions:companions.market.offered_by_html', {name:escapeMarket(o.owner_pseudo)})}</div>
        <div style="color:var(--cream3);margin-top:2px">${i18next.t('companions:companions.market.asking', {wants:wants||'—'})}</div>
        <div style="color:var(--cream3);font-size:9px;margin-top:2px">${i18next.t('companions:companions.market.expires', {date:new Date(o.expires_at).toLocaleDateString(NUM_LOCALE)})}</div>
      </div>
      <button class="btn btn-gold" style="font-size:10px" onclick="openCounterModal(${o.id})">${i18next.t('companions:companions.market.make_offer_btn')}</button>
    </div>`;
  }).join('');
  paintMarketChips(list);
}

// ═══ MES CONTRATS ═══════════════════════════════════════════════════════════════════════════════
/** Charge et affiche mes offres publiées (avec contre-offres pendantes reçues) et mes contre-offres envoyées ailleurs. */
async function renderMarketMine(){
  const body = document.getElementById('market-body');
  body.innerHTML = `<div style="padding:16px;font-size:11px;color:var(--cream3)" id="market-mine-body">${i18next.t('companions:companions.common.loading')}</div>`;
  const el = document.getElementById('market-mine-body');
  try{
    const sb = marketSb(); const me = marketUser();
    const [offersRes, countersRes] = await Promise.all([
      sb.from('pet_trade_offers').select('id, status, pet_snapshot, pet_uid').eq('owner_user_id', me.id).order('created_at',{ascending:false}).limit(40),
      sb.from('pet_trade_counters').select('id, offer_id, status').eq('from_user_id', me.id).order('created_at',{ascending:false}).limit(40),
    ]);
    marketMyOffers = offersRes.data||[];
    marketMyCounters = countersRes.data||[];
    const openIds = marketMyOffers.filter(o=>o.status==='open').map(o=>o.id);
    marketCountersByOffer = {};
    if(openIds.length){
      const { data:cs } = await sb.from('pet_trade_counters').select('id, offer_id, from_pseudo, pets, silver').in('offer_id', openIds).eq('status','pending');
      (cs||[]).forEach(c=>{ (marketCountersByOffer[c.offer_id] = marketCountersByOffer[c.offer_id]||[]).push(c); });
    }
  }catch(e){ el.innerHTML = `<div>${i18next.t('companions:companions.common.error_with_message', {message:escapeMarket(marketMkErr(e))})}</div>`; return; }

  const offersHtml = marketMyOffers.length ? marketMyOffers.map(o=>{
    const snap = o.pet_snapshot;
    const counters = marketCountersByOffer[o.id]||[];
    return `<div style="background:var(--s2);border:1px solid var(--border);border-radius:9px;padding:10px 12px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:12px">
        ${petChipHtml(snap)}
        <div style="flex:1;font-size:10.5px;color:var(--cream2)">
          <div>${i18next.t('companions:companions.market.status_html', {color:o.status==='open'?'var(--green2)':'var(--cream3)', status:marketStatusLabel(o.status)})}</div>
        </div>
        ${o.status==='open'?`<button class="btn btn-red" style="font-size:9px" onclick="cancelMyOffer(${o.id})">${i18next.t('companions:companions.market.withdraw_btn')}</button>`:''}
      </div>
      ${counters.length?`<div style="margin-top:8px;display:flex;flex-direction:column;gap:6px">
        ${counters.map(c=>`<div style="display:flex;align-items:center;gap:10px;background:var(--s3);border:1px solid var(--border);border-radius:7px;padding:6px 9px">
          <div style="flex:1;font-size:10px;color:var(--cream2)">
            ${i18next.t('companions:companions.market.counter_from_html', {name:escapeMarket(c.from_pseudo)})}
            ${(c.pets||[]).map(p=>p.name).join(', ')||''}${c.silver>0?` ${(c.pets||[]).length?'+':''} ${c.silver.toLocaleString(NUM_LOCALE)} Silver`:''}
          </div>
          <button class="btn btn-gold" style="font-size:9px" onclick="acceptMarketCounter(${c.id})">${i18next.t('companions:companions.market.accept_btn')}</button>
          <button class="btn btn-ghost" style="font-size:9px" onclick="declineMarketCounter(${c.id})">${i18next.t('companions:companions.market.decline_btn')}</button>
        </div>`).join('')}
      </div>`:''}
    </div>`;
  }).join('') : `<div style="color:var(--cream3);padding:8px 0">${i18next.t('companions:companions.market.no_offers_created')}</div>`;

  const countersHtml = marketMyCounters.length ? marketMyCounters.map(c=>`
    <div style="display:flex;align-items:center;gap:10px;background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;margin-bottom:6px">
      <div style="flex:1;font-size:10.5px;color:var(--cream2)">
        ${i18next.t('companions:companions.market.counter_on_contract_html', {id:c.offer_id, color:c.status==='pending'?'var(--gold)':c.status==='accepted'?'var(--green2)':'var(--cream3)', status:marketStatusLabel(c.status)})}
      </div>
      ${c.status==='pending'?`<button class="btn btn-ghost" style="font-size:9px" onclick="withdrawMyCounter(${c.id})">${i18next.t('companions:companions.market.withdraw_btn')}</button>`:''}
    </div>`).join('') : `<div style="color:var(--cream3);padding:8px 0">${i18next.t('companions:companions.market.no_counters_sent')}</div>`;

  el.innerHTML = `
    <div style="font-family:'Cinzel',serif;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--cream2);margin-bottom:8px">${i18next.t('companions:companions.market.my_offers_title')}</div>
    ${offersHtml}
    <div style="font-family:'Cinzel',serif;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--cream2);margin:16px 0 8px">${i18next.t('companions:companions.market.my_counters_title')}</div>
    ${countersHtml}
  `;
  paintMarketChips(el);
}
/** @param {string} s - code de statut brut (offre ou contre-offre). @returns {string} libellé FR affichable, ou le code tel quel si inconnu. */
function marketStatusLabel(s){
  const key = 'companions.market.status_'+s;
  return i18next.exists(COMPANIONS_NS_PREFIX+key) ? i18next.t(COMPANIONS_NS_PREFIX+key) : s;
}

// ═══ HISTORIQUE ═════════════════════════════════════════════════════════════════════════════════
/** Charge et affiche l'historique des échanges conclus impliquant le joueur (vendeur ou acheteur), avec ce qui a été cédé/reçu. */
async function renderMarketHistory(){
  const body = document.getElementById('market-body');
  body.innerHTML = `<div style="padding:16px;font-size:11px;color:var(--cream3)" id="market-hist-body">${i18next.t('companions:companions.common.loading')}</div>`;
  const el = document.getElementById('market-hist-body');
  try{
    const sb = marketSb(); const me = marketUser();
    const { data, error } = await sb.from('pet_trade_history').select('seller_user_id, seller_gave, buyer_gave, completed_at').or(`seller_user_id.eq.${me.id},buyer_user_id.eq.${me.id}`).order('completed_at',{ascending:false}).limit(50);
    if(error) throw error;
    marketHistory = data||[];
  }catch(e){ el.innerHTML = `<div>${i18next.t('companions:companions.common.error_with_message', {message:escapeMarket(marketMkErr(e))})}</div>`; return; }
  if(!marketHistory.length){ el.innerHTML = `<div>${i18next.t('companions:companions.market.no_history')}</div>`; return; }
  const me = marketUser();
  el.innerHTML = marketHistory.map(h=>{
    const iWasSeller = h.seller_user_id===me.id;
    const gave = iWasSeller ? [h.seller_gave] : (h.buyer_gave.pets||[]);
    const got = iWasSeller ? (h.buyer_gave.pets||[]) : [h.seller_gave];
    const silverPart = iWasSeller ? 0 : (h.buyer_gave.silver||0);
    return `<div style="background:var(--s2);border:1px solid var(--border);border-radius:9px;padding:10px 12px;margin-bottom:8px;font-size:10.5px;color:var(--cream2)">
      <div style="color:var(--cream3);font-size:9px;margin-bottom:4px">${new Date(h.completed_at).toLocaleString(NUM_LOCALE)}</div>
      <div>${i18next.t('companions:companions.market.gave', {list:gave.map(p=>p.name).join(', ')||'—'})}</div>
      <div>${i18next.t('companions:companions.market.got', {list:got.map(p=>p.name).join(', ')||'—'})}${silverPart>0?` + ${silverPart.toLocaleString(NUM_LOCALE)} Silver`:''}</div>
    </div>`;
  }).join('');
}
/** @param {*} s - texte potentiellement fourni par un autre joueur (pseudo, message). @returns {string} version échappée sûre pour insertion HTML. */
function escapeMarket(s){ return String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// ═══ CRÉER UNE OFFRE ════════════════════════════════════════════════════════════════════════════
/** @returns {Set<string>} uid des pets déjà en vente sur une offre ouverte (à exclure des listes de sélection). */
function alreadyOfferedUids(){
  const mine = new Set((marketMyOffers||[]).filter(o=>o.status==='open').map(o=>o.pet_uid));
  return mine;
}
/** Ouvre la modale de création d'offre : liste les pets encore éligibles (pas déjà en vente) et réinitialise l'état du formulaire. */
function openCreateOfferModal(){
  marketCreatePetUid = null; marketCreateAcceptsPets = true; marketCreateAcceptsSilver = false;
  const offered = alreadyOfferedUids();
  const eligible = PETS.filter(p=>!offered.has(p.uid));
  document.getElementById('market-modal-title').textContent = i18next.t('companions:companions.market.create_title');
  // Sélecteur de familier EN DEHORS du formulaire des conditions (2026-07-13, demande explicite)
  // -- déjà une grille cliquable (pas un <select> natif), mais mêlée aux champs "conditions"
  // en dessous dans le même bloc visuel. Isolé ici dans son propre panneau bordé (fond --s2,
  // titre dédié) séparé par un vrai bord (border-top) du formulaire de conditions, pour qu'il se
  // lise comme une étape distincte (choisir QUI) avant le formulaire (choisir QUOI en échange).
  document.getElementById('market-modal-body').innerHTML = `
    <div style="background:var(--s2);border:1px solid var(--border);border-radius:9px;padding:10px;margin-bottom:14px">
      <div style="font-family:'Cinzel',serif;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--cream2);margin-bottom:8px">${i18next.t('companions:companions.market.step1')}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px;max-height:220px;overflow-y:auto" id="market-create-pet-list">
        ${eligible.length?eligible.map(p=>`<div class="market-pick" data-uid="${p.uid}" onclick="pickCreatePet('${p.uid}')" style="cursor:pointer;border:1px solid var(--border);border-radius:8px;padding:6px">
          ${petChipHtml(petSnapshotOf(p))}
        </div>`).join(''):`<div style="grid-column:1/-1;color:var(--cream3);font-size:10.5px">${i18next.t('companions:companions.market.all_on_sale')}</div>`}
      </div>
    </div>
    <div style="border-top:1px solid var(--border);padding-top:12px">
      <div style="font-family:'Cinzel',serif;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--cream2);margin-bottom:8px">${i18next.t('companions:companions.market.step2')}</div>
      <div style="display:flex;flex-direction:column;gap:8px;font-size:11px;color:var(--cream2)">
        <label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="market-accepts-pets" checked onchange="marketCreateAcceptsPets=this.checked"> ${i18next.t('companions:companions.market.accept_pets_label')}</label>
        <label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="market-accepts-silver" onchange="marketCreateAcceptsSilver=this.checked"> ${i18next.t('companions:companions.market.accept_silver_label')}</label>
        <label style="display:flex;align-items:center;gap:8px">${i18next.t('companions:companions.market.pet_qty_label')} <input type="number" id="market-pet-qty" min="1" max="5" value="1" style="width:56px"></label>
        <label style="display:flex;align-items:center;gap:8px">${i18next.t('companions:companions.market.min_silver_label')} <input type="number" id="market-min-silver" min="0" value="0" style="width:100px"></label>
      </div>
    </div>
    <button class="btn btn-gold" style="width:100%;margin-top:14px" onclick="submitCreateOffer()">${i18next.t('companions:companions.market.publish_btn')}</button>
  `;
  paintMarketChips(document.getElementById('market-create-pet-list'));
  document.getElementById('market-modal').classList.add('open');
}
/** Sélectionne le pet à proposer dans la modale de création d'offre et met à jour le surlignage visuel. @param {string} uid - uid du pet choisi. */
function pickCreatePet(uid){
  marketCreatePetUid = uid;
  document.querySelectorAll('#market-create-pet-list .market-pick').forEach(el=>{
    el.style.boxShadow = el.dataset.uid===uid ? '0 0 0 2px var(--gold)' : '';
  });
}
// Raccourci "Ajouter au marché" depuis une carte Collection (2026-07-21, demande explicite) --
// bascule sur l'onglet Marché puis ouvre directement la modale de création AVEC ce familier déjà
// pré-sélectionné (évite de re-cliquer dessus dans la grille de choix qui s'affiche quand même,
// utile pour voir/changer de choix avant publication).
/** @param {number} petId - id local du pet à pré-sélectionner (voir commentaire ci-dessus pour le contexte). */
function quickAddToMarket(petId){
  const pet = PETS.find(p=>p.id===petId); if(!pet) return;
  if(alreadyOfferedUids().has(pet.uid)){ toast('❌',i18next.t('companions:companions.market.already_on_sale')); return; }
  ST(10); // onglet Marché (index 10 depuis le retrait du Viewer 3D, 2026-07-18)
  setMarketSubTab('browse');
  openCreateOfferModal();
  pickCreatePet(pet.uid);
  const el = document.querySelector(`#market-create-pet-list .market-pick[data-uid="${pet.uid}"]`);
  if(el) el.scrollIntoView({ block:'center' });
}
/** Valide le formulaire de création d'offre et publie l'offre via la RPC `create_pet_trade_offer`. */
async function submitCreateOffer(){
  if(!marketCreatePetUid){ toast('❌',i18next.t('companions:companions.market.choose_pet')); return; }
  const pet = PETS.find(p=>p.uid===marketCreatePetUid);
  if(!pet){ toast('❌',i18next.t('companions:companions.market.pet_not_found')); return; }
  const qty = Math.max(1, Math.min(5, +document.getElementById('market-pet-qty').value||1));
  const minSilver = Math.max(0, +document.getElementById('market-min-silver').value||0);
  if(!marketCreateAcceptsPets && !marketCreateAcceptsSilver){ toast('❌',i18next.t('companions:companions.market.accept_something')); return; }
  try{
    const sb = marketSb();
    const everOfSameSpecies = PETS.filter(p=>p.cat.name===pet.cat.name).length>0 ? [pet.cat.name] : [];
    const { error } = await sb.rpc('create_pet_trade_offer', {
      p_pet_uid: pet.uid, p_pet_snapshot: petSnapshotOf(pet), p_accepts_pets: marketCreateAcceptsPets,
      p_accepts_silver: marketCreateAcceptsSilver, p_pet_qty: qty, p_min_silver: minSilver,
      p_owner_has_ever: everOfSameSpecies, p_owner_pseudo: marketPseudo(),
    });
    if(error) throw error;
    toast('🛒',i18next.t('companions:companions.market.published_toast'));
    document.getElementById('market-modal').classList.remove('open');
    setMarketSubTab('mine');
  }catch(e){ toast('❌', marketMkErr(e)); }
}
/** Retire une de mes offres ouvertes après confirmation (invalide toute contre-offre en attente). @param {number} offerId */
async function cancelMyOffer(offerId){
  if(!confirm(i18next.t('companions:companions.market.cancel_confirm'))) return;
  try{ const sb=marketSb(); const { error } = await sb.rpc('cancel_pet_trade_offer', { p_offer_id: offerId }); if(error) throw error; toast('🗑️',i18next.t('companions:companions.market.contract_withdrawn')); renderMarketMine(); }
  catch(e){ toast('❌', marketMkErr(e)); }
}

// ═══ CONTRE-OFFRE ═══════════════════════════════════════════════════════════════════════════════
// Marché — "montrer ce que le joueur en face n'a pas" (2026-07-21, demande explicite) : rempli
// par openCounterModal() via get_player_owned_species(), lu par renderCounterPetList() pour
// badger chaque familier candidat encore "nouveau" pour le créateur de l'offre. Accès restreint
// côté serveur au contexte de CETTE offre ouverte précise (voir migration
// restrict_get_player_owned_species_to_open_offer.sql) -- jamais une sonde arbitraire.
let marketOpponentOwnedSpecies = null; // Set<string> | null tant que non chargé
/**
 * Ouvre la modale de contre-offre sur une offre du Marché : construit le formulaire (pets/silver
 * selon ce que l'offre accepte) puis charge en tâche de fond les espèces déjà possédées par le
 * créateur de l'offre pour badger les pets "nouveaux" pour lui.
 * @param {number} offerId - id de l'offre visée (doit être dans marketOffers).
 */
async function openCounterModal(offerId){
  const o = marketOffers.find(x=>x.id===offerId);
  if(!o) return;
  marketCounterOfferId = offerId; marketCounterPetUids = new Set(); marketCounterIncludeEver = false;
  marketOpponentOwnedSpecies = null;
  document.getElementById('market-modal-title').textContent = i18next.t('companions:companions.market.counter_title');
  document.getElementById('market-modal-body').innerHTML = `
    <div style="margin-bottom:10px">${petChipHtml(o.pet_snapshot)}</div>
    ${o.accepts_pets?`
    <div style="font-size:10.5px;color:var(--cream3);margin-bottom:6px">${i18next.t('companions:companions.market.choose_up_to', {count:o.pet_qty})}</div>
    <label style="display:flex;align-items:center;gap:6px;font-size:10px;color:var(--cream3);margin-bottom:6px">
      <input type="checkbox" id="market-counter-ever" onchange="marketCounterIncludeEver=this.checked;renderCounterPetList(${offerId})"> ${i18next.t('companions:companions.market.include_owned_label')}
    </label>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px;max-height:200px;overflow-y:auto;margin-bottom:12px" id="market-counter-pet-list"></div>`:''}
    ${o.accepts_silver?`<label style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--cream2);margin-bottom:12px">${i18next.t('companions:companions.market.silver_offered_label', {min:(o.min_silver||0).toLocaleString(NUM_LOCALE)})} <input type="number" id="market-counter-silver" min="0" value="${o.min_silver||0}" style="width:120px"></label>`:''}
    <button class="btn btn-gold" style="width:100%" onclick="submitCounter(${offerId})">${i18next.t('companions:companions.market.send_btn')}</button>
  `;
  if(o.accepts_pets){
    renderCounterPetList(offerId);
    try{
      const sb = marketSb();
      const { data, error } = await sb.rpc('get_player_owned_species', { p_user_id: o.owner_user_id, p_offer_id: offerId });
      if(error) throw error;
      marketOpponentOwnedSpecies = new Set(Array.isArray(data) ? data : []);
      renderCounterPetList(offerId);
    }catch(e){ marketOpponentOwnedSpecies = null; }
  }
  document.getElementById('market-modal').classList.add('open');
}
/** Rend la grille de sélection des pets à proposer en contre-offre, avec badge "🆕" pour les espèces que le créateur de l'offre ne possède pas encore. @param {number} offerId */
function renderCounterPetList(offerId){
  const o = marketOffers.find(x=>x.id===offerId); if(!o) return;
  const list = document.getElementById('market-counter-pet-list'); if(!list) return;
  const offered = alreadyOfferedUids();
  const eligible = PETS.filter(p=>!offered.has(p.uid));
  list.innerHTML = eligible.map(p=>{
    const isNewForOpponent = marketOpponentOwnedSpecies && !marketOpponentOwnedSpecies.has(p.cat.name);
    return `<div class="market-pick" data-uid="${p.uid}" onclick="toggleCounterPet('${p.uid}',${offerId})" style="cursor:pointer;position:relative;border:1px solid ${marketCounterPetUids.has(p.uid)?'var(--gold)':'var(--border)'};border-radius:8px;padding:6px">
    ${isNewForOpponent?`<span style="position:absolute;top:2px;right:2px;background:var(--green2);color:var(--bg);font-size:8px;font-weight:700;border-radius:3px;padding:1px 4px;z-index:1" title="${i18next.t('companions:companions.market.new_for_owner_title')}">🆕</span>`:''}
    ${petChipHtml(petSnapshotOf(p))}
  </div>`;
  }).join('') || `<div style="grid-column:1/-1;color:var(--cream3);font-size:10.5px">${i18next.t('companions:companions.market.none_available')}</div>`;
  paintMarketChips(list);
}
/** Ajoute/retire un pet de la sélection de contre-offre, en respectant le quota `pet_qty` de l'offre. @param {string} uid @param {number} offerId */
function toggleCounterPet(uid, offerId){
  const o = marketOffers.find(x=>x.id===offerId);
  if(marketCounterPetUids.has(uid)) marketCounterPetUids.delete(uid);
  else { if(o && marketCounterPetUids.size>=o.pet_qty){ toast('❌',i18next.t('companions:companions.market.max_pets', {count:o.pet_qty})); return; } marketCounterPetUids.add(uid); }
  renderCounterPetList(offerId);
}
/** Valide et envoie la contre-offre (pets sélectionnés + silver) via la RPC `submit_pet_trade_counter`. @param {number} offerId */
async function submitCounter(offerId){
  const o = marketOffers.find(x=>x.id===offerId); if(!o) return;
  const pets = Array.from(marketCounterPetUids).map(uid=>petSnapshotOf(PETS.find(p=>p.uid===uid))).filter(Boolean);
  const silverEl = document.getElementById('market-counter-silver');
  const silver = silverEl ? Math.max(0, +silverEl.value||0) : 0;
  if(!pets.length && silver<=0){ toast('❌',i18next.t('companions:companions.market.propose_something')); return; }
  try{
    const sb = marketSb();
    const { error } = await sb.rpc('submit_pet_trade_counter', { p_offer_id: offerId, p_pets: pets, p_silver: silver, p_from_pseudo: marketPseudo() });
    if(error) throw error;
    toast('🤝',i18next.t('companions:companions.market.offer_sent'));
    document.getElementById('market-modal').classList.remove('open');
    renderMarketBrowse();
  }catch(e){ toast('❌', marketMkErr(e)); }
}
/** Retire une contre-offre que j'ai envoyée, tant qu'elle est encore pending. @param {number} counterId */
async function withdrawMyCounter(counterId){
  try{ const sb=marketSb(); const { error } = await sb.rpc('withdraw_pet_trade_counter', { p_counter_id: counterId }); if(error) throw error; toast('🗑️',i18next.t('companions:companions.market.counter_withdrawn')); renderMarketMine(); }
  catch(e){ toast('❌', marketMkErr(e)); }
}
/** Refuse une contre-offre reçue sur une de mes offres. @param {number} counterId */
async function declineMarketCounter(counterId){
  try{ const sb=marketSb(); const { error } = await sb.rpc('decline_pet_trade_counter', { p_counter_id: counterId }); if(error) throw error; toast('✕',i18next.t('companions:companions.market.counter_declined')); renderMarketMine(); updateMarketBadge(); }
  catch(e){ toast('❌', marketMkErr(e)); }
}
/** Accepte une contre-offre après confirmation : conclut l'échange côté serveur (atomique) puis réclame la livraison locale. @param {number} counterId */
async function acceptMarketCounter(counterId){
  if(!confirm(i18next.t('companions:companions.market.accept_confirm'))) return;
  try{
    const sb = marketSb();
    const { error } = await sb.rpc('accept_pet_trade_counter', { p_counter_id: counterId });
    if(error) throw error;
    toast('✨',i18next.t('companions:companions.market.trade_done'));
    await claimMarketDeliveries();
    updateMarketBadge();
    renderMarketMine();
  }catch(e){ toast('❌', marketMkErr(e)); }
}

// ═══ LIVRAISONS + NOTIFICATIONS (appelées au chargement du module) ═════════════════════════════
/**
 * Réclame les livraisons d'échange non encore récupérées : insère les pets reçus dans PETS
 * (en respectant le plafond du roster + tampon d'échange), crédite le silver reçu, marque
 * chaque livraison comme réclamée côté serveur, puis sauvegarde/rafraîchit l'UI si du gain a eu lieu.
 */
async function claimMarketDeliveries(){
  if(!marketReady()) return;
  try{
    const sb = marketSb(); const me = marketUser();
    const { data, error } = await sb.from('pet_trade_deliveries').select('id, pets, silver').eq('user_id', me.id).eq('claimed', false);
    if(error || !data || !data.length) return;
    let gained = [];
    for(const d of data){
      (d.pets||[]).forEach(snap=>{
        if(petRosterRoomLeft() + (PET_ROSTER_CAP_WITH_TRADE_BUFFER - PET_ROSTER_CAP) <= 0 && PETS.length>=PET_ROSTER_CAP_WITH_TRADE_BUFFER) return;
        const np = petFromSnapshot(snap);
        PETS.push(np); gained.push(np.cat.name);
      });
      if(d.silver>0){ earnSilver(d.silver, 'compagnon:marche'); }
      await sb.rpc('claim_pet_trade_delivery', { p_delivery_id: d.id });
    }
    if(gained.length || data.some(d=>d.silver>0)){
      const silverGained = data.reduce((s,d)=>s+(d.silver||0),0);
      toast('📦', i18next.t('companions:companions.market.delivery_toast', {list:gained.join(', ')})+(silverGained>0?` + ${silverGained.toLocaleString(NUM_LOCALE)} Silver`:''));
      saveGame(); renderAll();
    }
  }catch(e){}
}
/** Récupère et affiche (toast) les notifications Marché non lues, puis les marque comme lues côté serveur. */
async function pollMarketNotifications(){
  if(!marketReady()) return;
  try{
    const sb = marketSb(); const me = marketUser();
    const { data, error } = await sb.from('pet_trade_notifications').select('message').eq('user_id', me.id).eq('read', false).order('created_at',{ascending:true}).limit(10);
    if(error || !data || !data.length) return;
    data.forEach(n=>toast('🔔', n.message));
    await sb.rpc('mark_pet_trade_notifications_read');
  }catch(e){}
}
// badge d'attention sur l'onglet Marché (2026-07-11, demande explicite : "Afficher le bon onglet
// de presence pour le market") -- seul onglet du module sans indicateur (tb0/tb2/tb3/tb7 existent
// déjà pour Éclosion/Collection/Nourrir/Progression, voir companions.html) alors que le Marché a
// de vraies notifications asynchrones (contre-offres reçues sur mes contrats) -- compte les
// contre-offres en attente sur MES offres ouvertes, même info que la liste détaillée de l'onglet
// "Mes contrats" (renderMarketMine()), juste résumée en un chiffre visible sans ouvrir l'onglet.
/** Met à jour le badge numérique de l'onglet Marché avec le nombre de contre-offres en attente sur mes offres ouvertes. */
async function updateMarketBadge(){
  const badge = document.getElementById('tb-market');
  if(!badge) return;
  if(!marketReady()){ badge.textContent=''; badge.classList.remove('alert'); return; }
  try{
    const sb = marketSb(); const me = marketUser();
    const { data: myOpenOffers } = await sb.from('pet_trade_offers').select('id').eq('owner_user_id', me.id).eq('status','open');
    let pendingCount = 0;
    if(myOpenOffers && myOpenOffers.length){
      const ids = myOpenOffers.map(o=>o.id);
      const { count } = await sb.from('pet_trade_counters').select('id', { count: 'exact', head: true }).in('offer_id', ids).eq('status','pending');
      pendingCount = count || 0;
    }
    badge.textContent = pendingCount>0 ? String(pendingCount) : '';
    badge.classList.toggle('alert', pendingCount>0);
  }catch(e){}
}
setTimeout(()=>{ claimMarketDeliveries(); pollMarketNotifications(); updateMarketBadge(); }, 6000);
setInterval(()=>{ claimMarketDeliveries(); pollMarketNotifications(); updateMarketBadge(); }, 90000);
