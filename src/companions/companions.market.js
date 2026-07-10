// ═══ MARCHÉ D'ÉCHANGE (2026-07-10, demande explicite : "vrai backend d'échange... c'est fini la
// sauvegarde locale") ═══════════════════════════════════════════════════════════════════════════
// Seul point du module qui fait vraiment traverser un PET d'un compte à l'autre (pas juste des
// compteurs comme companions.sync.js) -- s'appuie sur
// supabase/migrations/20260710150000_companion_pet_trade_market.sql (offres/contre-offres/
// historique/livraisons/notifications, transaction atomique côté serveur). Accès Supabase
// EXCLUSIVEMENT via window.parent.getSbClient()/getCurrentUserForSync()/getMyPseudoForSync()
// (jamais window.parent.sb -- même piège déjà corrigé dans companions.sync.js).

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

function marketHostWin(){ return (window.parent && window.parent!==window) ? window.parent : null; }
function marketSb(){ const w=marketHostWin(); return w && typeof w.getSbClient==='function' ? w.getSbClient() : null; }
function marketUser(){ const w=marketHostWin(); return w && typeof w.getCurrentUserForSync==='function' ? w.getCurrentUserForSync() : null; }
function marketPseudo(){ const w=marketHostWin(); return w && typeof w.getMyPseudoForSync==='function' ? w.getMyPseudoForSync() : 'Joueur'; }
function marketIsGuest(){ const w=marketHostWin(); return w && typeof w.isGuest==='function' ? w.isGuest() : false; }
function marketReady(){ return !!(marketSb() && marketUser() && !marketIsGuest()); }

function petSnapshotOf(pet){
  return { uid:pet.uid, name:pet.cat.name, art:pet.cat.art, sec:pet.cat.sec, typ:pet.cat.typ, orig:pet.cat.orig,
    rar:pet.rar, tier:pet.tier||1, tierMult:tierMultOf(pet), stats:pet.stats.slice() };
}
function petFromSnapshot(snap){
  const cat = PET_CATALOG.find(c=>c.name===snap.name) || {name:snap.name,art:snap.art,sec:snap.sec,typ:snap.typ,orig:snap.orig,rar:snap.rar};
  return { id:petId++, uid:snap.uid||crypto.randomUUID(), cat, rar:snap.rar, stats:(snap.stats||[]).slice(),
    hunger:100, terrain:false, tier:snap.tier||1, tierXp:0, tierMult:snap.tierMult||rollTierMult(snap.tier||1) };
}
function marketMkErr(e){ return (e && e.message) || 'Erreur réseau'; }

// ═══ NAVIGATION ═════════════════════════════════════════════════════════════════════════════
function renderMarketTab(){
  const nav = document.getElementById('market-nav');
  if(nav){
    nav.innerHTML = ['browse','mine','history'].map(t=>{
      const lbl = t==='browse'?'🛒 Marché':t==='mine'?'📜 Mes contrats':'📚 Historique';
      return `<button class="schip ${marketSubTab===t?'on':''}" onclick="setMarketSubTab('${t}')">${lbl}</button>`;
    }).join('');
  }
  const body = document.getElementById('market-body');
  if(!body) return;
  if(!marketReady()){
    body.innerHTML = `<div style="padding:24px;text-align:center;font-size:12px;color:var(--cream3)">
      ${marketIsGuest()?'Le Marché nécessite un compte (pas disponible en invité).':'Connecte-toi pour accéder au Marché.'}
    </div>`;
    return;
  }
  if(marketSubTab==='browse') renderMarketBrowse();
  else if(marketSubTab==='mine') renderMarketMine();
  else renderMarketHistory();
}
function setMarketSubTab(t){ marketSubTab=t; renderMarketTab(); }

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
function paintMarketChips(root){
  (root||document).querySelectorAll('.market-chip-canvas').forEach(cv=>{
    const art=cv.dataset.art, tier=+cv.dataset.tier||1;
    if(art && typeof drawPixelArt==='function') drawPixelArt(cv, art, 32, null, tier);
  });
}

// ═══ MARCHÉ (offres ouvertes des autres joueurs) ═══════════════════════════════════════════════
async function renderMarketBrowse(){
  const body = document.getElementById('market-body');
  body.innerHTML = `<div style="padding:16px">
    <button class="btn btn-gold" style="margin-bottom:12px" onclick="openCreateOfferModal()">➕ Proposer un de mes familiers</button>
    <div id="market-browse-list" style="display:flex;flex-direction:column;gap:8px;font-size:11px;color:var(--cream3)">Chargement…</div>
  </div>`;
  try{
    const sb = marketSb(); const me = marketUser();
    const { data, error } = await sb.from('pet_trade_offers').select('*').eq('status','open').neq('owner_user_id', me.id).order('created_at',{ascending:false}).limit(60);
    if(error) throw error;
    marketOffers = data||[];
  }catch(e){ marketOffers=[]; }
  const list = document.getElementById('market-browse-list');
  if(!list) return;
  if(!marketOffers.length){ list.innerHTML = `<div style="padding:12px;text-align:center">Aucune offre ouverte pour l'instant.</div>`; return; }
  list.innerHTML = marketOffers.map(o=>{
    const snap = o.pet_snapshot;
    const wants = [o.accepts_pets?`${o.pet_qty} compagnon${o.pet_qty>1?'s':''}`:null, o.accepts_silver?`≥ ${(o.min_silver||0).toLocaleString('fr-FR')} Silver`:null].filter(Boolean).join(' et/ou ');
    return `<div style="display:flex;align-items:center;gap:12px;background:var(--s2);border:1px solid var(--border);border-radius:9px;padding:10px 12px">
      ${petChipHtml(snap)}
      <div style="flex:1;font-size:10.5px;color:var(--cream2)">
        <div>Proposé par <strong style="color:var(--gold)">${escapeMarket(o.owner_pseudo)}</strong></div>
        <div style="color:var(--cream3);margin-top:2px">Demande : ${wants||'—'}</div>
        <div style="color:var(--cream3);font-size:9px;margin-top:2px">Expire ${new Date(o.expires_at).toLocaleDateString('fr-FR')}</div>
      </div>
      <button class="btn btn-gold" style="font-size:10px" onclick="openCounterModal(${o.id})">Faire une offre</button>
    </div>`;
  }).join('');
  paintMarketChips(list);
}

// ═══ MES CONTRATS ═══════════════════════════════════════════════════════════════════════════════
async function renderMarketMine(){
  const body = document.getElementById('market-body');
  body.innerHTML = `<div style="padding:16px;font-size:11px;color:var(--cream3)" id="market-mine-body">Chargement…</div>`;
  const el = document.getElementById('market-mine-body');
  try{
    const sb = marketSb(); const me = marketUser();
    const [offersRes, countersRes] = await Promise.all([
      sb.from('pet_trade_offers').select('*').eq('owner_user_id', me.id).order('created_at',{ascending:false}).limit(40),
      sb.from('pet_trade_counters').select('*').eq('from_user_id', me.id).order('created_at',{ascending:false}).limit(40),
    ]);
    marketMyOffers = offersRes.data||[];
    marketMyCounters = countersRes.data||[];
    const openIds = marketMyOffers.filter(o=>o.status==='open').map(o=>o.id);
    marketCountersByOffer = {};
    if(openIds.length){
      const { data:cs } = await sb.from('pet_trade_counters').select('*').in('offer_id', openIds).eq('status','pending');
      (cs||[]).forEach(c=>{ (marketCountersByOffer[c.offer_id] = marketCountersByOffer[c.offer_id]||[]).push(c); });
    }
  }catch(e){ el.innerHTML = `<div>Erreur : ${escapeMarket(marketMkErr(e))}</div>`; return; }

  const offersHtml = marketMyOffers.length ? marketMyOffers.map(o=>{
    const snap = o.pet_snapshot;
    const counters = marketCountersByOffer[o.id]||[];
    return `<div style="background:var(--s2);border:1px solid var(--border);border-radius:9px;padding:10px 12px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:12px">
        ${petChipHtml(snap)}
        <div style="flex:1;font-size:10.5px;color:var(--cream2)">
          <div>Statut : <strong style="color:${o.status==='open'?'var(--green2)':'var(--cream3)'}">${marketStatusLabel(o.status)}</strong></div>
        </div>
        ${o.status==='open'?`<button class="btn btn-red" style="font-size:9px" onclick="cancelMyOffer(${o.id})">Retirer</button>`:''}
      </div>
      ${counters.length?`<div style="margin-top:8px;display:flex;flex-direction:column;gap:6px">
        ${counters.map(c=>`<div style="display:flex;align-items:center;gap:10px;background:var(--s3);border:1px solid var(--border);border-radius:7px;padding:6px 9px">
          <div style="flex:1;font-size:10px;color:var(--cream2)">
            <strong style="color:var(--gold)">${escapeMarket(c.from_pseudo)}</strong> propose :
            ${(c.pets||[]).map(p=>p.name).join(', ')||''}${c.silver>0?` ${(c.pets||[]).length?'+':''} ${c.silver.toLocaleString('fr-FR')} Silver`:''}
          </div>
          <button class="btn btn-gold" style="font-size:9px" onclick="acceptMarketCounter(${c.id})">✓ Accepter</button>
          <button class="btn btn-ghost" style="font-size:9px" onclick="declineMarketCounter(${c.id})">✕ Refuser</button>
        </div>`).join('')}
      </div>`:''}
    </div>`;
  }).join('') : `<div style="color:var(--cream3);padding:8px 0">Aucune offre créée.</div>`;

  const countersHtml = marketMyCounters.length ? marketMyCounters.map(c=>`
    <div style="display:flex;align-items:center;gap:10px;background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;margin-bottom:6px">
      <div style="flex:1;font-size:10.5px;color:var(--cream2)">
        Contre-offre sur le contrat #${c.offer_id} — statut : <strong style="color:${c.status==='pending'?'var(--gold)':c.status==='accepted'?'var(--green2)':'var(--cream3)'}">${marketStatusLabel(c.status)}</strong>
      </div>
      ${c.status==='pending'?`<button class="btn btn-ghost" style="font-size:9px" onclick="withdrawMyCounter(${c.id})">Retirer</button>`:''}
    </div>`).join('') : `<div style="color:var(--cream3);padding:8px 0">Aucune contre-offre envoyée.</div>`;

  el.innerHTML = `
    <div style="font-family:'Cinzel',serif;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--cream2);margin-bottom:8px">Mes offres</div>
    ${offersHtml}
    <div style="font-family:'Cinzel',serif;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--cream2);margin:16px 0 8px">Mes contre-offres envoyées</div>
    ${countersHtml}
  `;
  paintMarketChips(el);
}
function marketStatusLabel(s){
  return {open:'Ouvert',closed:'Conclu',cancelled:'Retiré',expired:'Expiré',pending:'En attente',accepted:'Acceptée',declined:'Refusée',withdrawn:'Retirée',invalidated:'Invalidée'}[s]||s;
}

// ═══ HISTORIQUE ═════════════════════════════════════════════════════════════════════════════════
async function renderMarketHistory(){
  const body = document.getElementById('market-body');
  body.innerHTML = `<div style="padding:16px;font-size:11px;color:var(--cream3)" id="market-hist-body">Chargement…</div>`;
  const el = document.getElementById('market-hist-body');
  try{
    const sb = marketSb(); const me = marketUser();
    const { data, error } = await sb.from('pet_trade_history').select('*').or(`seller_user_id.eq.${me.id},buyer_user_id.eq.${me.id}`).order('completed_at',{ascending:false}).limit(50);
    if(error) throw error;
    marketHistory = data||[];
  }catch(e){ el.innerHTML = `<div>Erreur : ${escapeMarket(marketMkErr(e))}</div>`; return; }
  if(!marketHistory.length){ el.innerHTML = `<div>Aucun échange conclu pour l'instant.</div>`; return; }
  const me = marketUser();
  el.innerHTML = marketHistory.map(h=>{
    const iWasSeller = h.seller_user_id===me.id;
    const gave = iWasSeller ? [h.seller_gave] : (h.buyer_gave.pets||[]);
    const got = iWasSeller ? (h.buyer_gave.pets||[]) : [h.seller_gave];
    const silverPart = iWasSeller ? 0 : (h.buyer_gave.silver||0);
    return `<div style="background:var(--s2);border:1px solid var(--border);border-radius:9px;padding:10px 12px;margin-bottom:8px;font-size:10.5px;color:var(--cream2)">
      <div style="color:var(--cream3);font-size:9px;margin-bottom:4px">${new Date(h.completed_at).toLocaleString('fr-FR')}</div>
      <div>Cédé : ${gave.map(p=>p.name).join(', ')||'—'}</div>
      <div>Reçu : ${got.map(p=>p.name).join(', ')||'—'}${silverPart>0?` + ${silverPart.toLocaleString('fr-FR')} Silver`:''}</div>
    </div>`;
  }).join('');
}
function escapeMarket(s){ return String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// ═══ CRÉER UNE OFFRE ════════════════════════════════════════════════════════════════════════════
function alreadyOfferedUids(){
  const mine = new Set((marketMyOffers||[]).filter(o=>o.status==='open').map(o=>o.pet_uid));
  return mine;
}
function openCreateOfferModal(){
  marketCreatePetUid = null; marketCreateAcceptsPets = true; marketCreateAcceptsSilver = false;
  const offered = alreadyOfferedUids();
  const eligible = PETS.filter(p=>!offered.has(p.uid));
  document.getElementById('market-modal-title').textContent = '➕ Nouvelle offre d\'échange';
  document.getElementById('market-modal-body').innerHTML = `
    <div style="font-size:10.5px;color:var(--cream3);margin-bottom:8px">Choisis le familier à proposer :</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px;max-height:220px;overflow-y:auto;margin-bottom:12px" id="market-create-pet-list">
      ${eligible.length?eligible.map(p=>`<div class="market-pick" data-uid="${p.uid}" onclick="pickCreatePet('${p.uid}')" style="cursor:pointer;border:1px solid var(--border);border-radius:8px;padding:6px">
        ${petChipHtml(petSnapshotOf(p))}
      </div>`).join(''):`<div style="grid-column:1/-1;color:var(--cream3);font-size:10.5px">Tous tes familiers sont déjà en vente.</div>`}
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;font-size:11px;color:var(--cream2)">
      <label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="market-accepts-pets" checked onchange="marketCreateAcceptsPets=this.checked"> Accepter en échange d'autres compagnons</label>
      <label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="market-accepts-silver" onchange="marketCreateAcceptsSilver=this.checked"> Accepter en échange de Silver</label>
      <label style="display:flex;align-items:center;gap:8px">Nombre de compagnons demandés : <input type="number" id="market-pet-qty" min="1" max="5" value="1" style="width:56px"></label>
      <label style="display:flex;align-items:center;gap:8px">Silver minimum : <input type="number" id="market-min-silver" min="0" value="0" style="width:100px"></label>
    </div>
    <button class="btn btn-gold" style="width:100%;margin-top:14px" onclick="submitCreateOffer()">Publier l'offre</button>
  `;
  paintMarketChips(document.getElementById('market-create-pet-list'));
  document.getElementById('market-modal').classList.add('open');
}
function pickCreatePet(uid){
  marketCreatePetUid = uid;
  document.querySelectorAll('#market-create-pet-list .market-pick').forEach(el=>{
    el.style.boxShadow = el.dataset.uid===uid ? '0 0 0 2px var(--gold)' : '';
  });
}
async function submitCreateOffer(){
  if(!marketCreatePetUid){ toast('❌','Choisis un familier à proposer.'); return; }
  const pet = PETS.find(p=>p.uid===marketCreatePetUid);
  if(!pet){ toast('❌','Familier introuvable.'); return; }
  const qty = Math.max(1, Math.min(5, +document.getElementById('market-pet-qty').value||1));
  const minSilver = Math.max(0, +document.getElementById('market-min-silver').value||0);
  if(!marketCreateAcceptsPets && !marketCreateAcceptsSilver){ toast('❌','Accepte au moins compagnons ou Silver.'); return; }
  try{
    const sb = marketSb();
    const everOfSameSpecies = PETS.filter(p=>p.cat.name===pet.cat.name).length>0 ? [pet.cat.name] : [];
    const { error } = await sb.rpc('create_pet_trade_offer', {
      p_pet_uid: pet.uid, p_pet_snapshot: petSnapshotOf(pet), p_accepts_pets: marketCreateAcceptsPets,
      p_accepts_silver: marketCreateAcceptsSilver, p_pet_qty: qty, p_min_silver: minSilver,
      p_owner_has_ever: everOfSameSpecies, p_owner_pseudo: marketPseudo(),
    });
    if(error) throw error;
    toast('🛒','Offre publiée !');
    document.getElementById('market-modal').classList.remove('open');
    setMarketSubTab('mine');
  }catch(e){ toast('❌', marketMkErr(e)); }
}
async function cancelMyOffer(offerId){
  if(!confirm('Retirer ce contrat ? Toute contre-offre en attente sera invalidée.')) return;
  try{ const sb=marketSb(); const { error } = await sb.rpc('cancel_pet_trade_offer', { p_offer_id: offerId }); if(error) throw error; toast('🗑️','Contrat retiré.'); renderMarketMine(); }
  catch(e){ toast('❌', marketMkErr(e)); }
}

// ═══ CONTRE-OFFRE ═══════════════════════════════════════════════════════════════════════════════
function openCounterModal(offerId){
  const o = marketOffers.find(x=>x.id===offerId);
  if(!o) return;
  marketCounterOfferId = offerId; marketCounterPetUids = new Set(); marketCounterIncludeEver = false;
  const everNames = new Set(PETS.map(p=>p.cat.name));
  document.getElementById('market-modal-title').textContent = '🤝 Faire une offre';
  document.getElementById('market-modal-body').innerHTML = `
    <div style="margin-bottom:10px">${petChipHtml(o.pet_snapshot)}</div>
    ${o.accepts_pets?`
    <div style="font-size:10.5px;color:var(--cream3);margin-bottom:6px">Choisis jusqu'à ${o.pet_qty} familier(s) à proposer :</div>
    <label style="display:flex;align-items:center;gap:6px;font-size:10px;color:var(--cream3);margin-bottom:6px">
      <input type="checkbox" id="market-counter-ever" onchange="marketCounterIncludeEver=this.checked;renderCounterPetList(${offerId})"> Inclure les compagnons déjà obtenus (ne compteront pas comme découverte)
    </label>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px;max-height:200px;overflow-y:auto;margin-bottom:12px" id="market-counter-pet-list"></div>`:''}
    ${o.accepts_silver?`<label style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--cream2);margin-bottom:12px">Silver proposé (min ${(o.min_silver||0).toLocaleString('fr-FR')}) : <input type="number" id="market-counter-silver" min="0" value="${o.min_silver||0}" style="width:120px"></label>`:''}
    <button class="btn btn-gold" style="width:100%" onclick="submitCounter(${offerId})">Envoyer l'offre</button>
  `;
  if(o.accepts_pets) renderCounterPetList(offerId);
  document.getElementById('market-modal').classList.add('open');
}
function renderCounterPetList(offerId){
  const o = marketOffers.find(x=>x.id===offerId); if(!o) return;
  const list = document.getElementById('market-counter-pet-list'); if(!list) return;
  const offered = alreadyOfferedUids();
  const eligible = PETS.filter(p=>!offered.has(p.uid));
  list.innerHTML = eligible.map(p=>`<div class="market-pick" data-uid="${p.uid}" onclick="toggleCounterPet('${p.uid}',${offerId})" style="cursor:pointer;border:1px solid ${marketCounterPetUids.has(p.uid)?'var(--gold)':'var(--border)'};border-radius:8px;padding:6px">
    ${petChipHtml(petSnapshotOf(p))}
  </div>`).join('') || `<div style="grid-column:1/-1;color:var(--cream3);font-size:10.5px">Aucun familier disponible.</div>`;
  paintMarketChips(list);
}
function toggleCounterPet(uid, offerId){
  const o = marketOffers.find(x=>x.id===offerId);
  if(marketCounterPetUids.has(uid)) marketCounterPetUids.delete(uid);
  else { if(o && marketCounterPetUids.size>=o.pet_qty){ toast('❌',`Maximum ${o.pet_qty} familier(s).`); return; } marketCounterPetUids.add(uid); }
  renderCounterPetList(offerId);
}
async function submitCounter(offerId){
  const o = marketOffers.find(x=>x.id===offerId); if(!o) return;
  const pets = Array.from(marketCounterPetUids).map(uid=>petSnapshotOf(PETS.find(p=>p.uid===uid))).filter(Boolean);
  const silverEl = document.getElementById('market-counter-silver');
  const silver = silverEl ? Math.max(0, +silverEl.value||0) : 0;
  if(!pets.length && silver<=0){ toast('❌','Propose au moins un familier ou du Silver.'); return; }
  try{
    const sb = marketSb();
    const { error } = await sb.rpc('submit_pet_trade_counter', { p_offer_id: offerId, p_pets: pets, p_silver: silver, p_from_pseudo: marketPseudo() });
    if(error) throw error;
    toast('🤝','Offre envoyée !');
    document.getElementById('market-modal').classList.remove('open');
    renderMarketBrowse();
  }catch(e){ toast('❌', marketMkErr(e)); }
}
async function withdrawMyCounter(counterId){
  try{ const sb=marketSb(); const { error } = await sb.rpc('withdraw_pet_trade_counter', { p_counter_id: counterId }); if(error) throw error; toast('🗑️','Contre-offre retirée.'); renderMarketMine(); }
  catch(e){ toast('❌', marketMkErr(e)); }
}
async function declineMarketCounter(counterId){
  try{ const sb=marketSb(); const { error } = await sb.rpc('decline_pet_trade_counter', { p_counter_id: counterId }); if(error) throw error; toast('✕','Contre-offre refusée.'); renderMarketMine(); }
  catch(e){ toast('❌', marketMkErr(e)); }
}
async function acceptMarketCounter(counterId){
  if(!confirm('Accepter cette offre ? L\'échange sera définitif.')) return;
  try{
    const sb = marketSb();
    const { error } = await sb.rpc('accept_pet_trade_counter', { p_counter_id: counterId });
    if(error) throw error;
    toast('✨','Échange conclu !');
    await claimMarketDeliveries();
    renderMarketMine();
  }catch(e){ toast('❌', marketMkErr(e)); }
}

// ═══ LIVRAISONS + NOTIFICATIONS (appelées au chargement du module) ═════════════════════════════
async function claimMarketDeliveries(){
  if(!marketReady()) return;
  try{
    const sb = marketSb(); const me = marketUser();
    const { data, error } = await sb.from('pet_trade_deliveries').select('*').eq('user_id', me.id).eq('claimed', false);
    if(error || !data || !data.length) return;
    let gained = [];
    for(const d of data){
      (d.pets||[]).forEach(snap=>{
        if(petRosterRoomLeft() + (PET_ROSTER_CAP_WITH_TRADE_BUFFER - PET_ROSTER_CAP) <= 0 && PETS.length>=PET_ROSTER_CAP_WITH_TRADE_BUFFER) return;
        const np = petFromSnapshot(snap);
        PETS.push(np); gained.push(np.cat.name);
      });
      if(d.silver>0){ SILVER += d.silver; }
      await sb.rpc('claim_pet_trade_delivery', { p_delivery_id: d.id });
    }
    if(gained.length || data.some(d=>d.silver>0)){
      const silverGained = data.reduce((s,d)=>s+(d.silver||0),0);
      toast('📦', `Livraison d'échange reçue : ${gained.join(', ')}${silverGained>0?` + ${silverGained.toLocaleString('fr-FR')} Silver`:''}`);
      saveGame(); renderAll();
    }
  }catch(e){}
}
async function pollMarketNotifications(){
  if(!marketReady()) return;
  try{
    const sb = marketSb(); const me = marketUser();
    const { data, error } = await sb.from('pet_trade_notifications').select('*').eq('user_id', me.id).eq('read', false).order('created_at',{ascending:true}).limit(10);
    if(error || !data || !data.length) return;
    data.forEach(n=>toast('🔔', n.message));
    await sb.rpc('mark_pet_trade_notifications_read');
  }catch(e){}
}
setTimeout(()=>{ claimMarketDeliveries(); pollMarketNotifications(); }, 6000);
setInterval(()=>{ claimMarketDeliveries(); pollMarketNotifications(); }, 90000);
