function renderSecNav(){
  document.getElementById('sec-nav').innerHTML=SECTIONS.map((s,i)=>{
    const tp=terrainPet(s.id);const pct=tp?gsPct(tp):0;
    return`<div class="sec-row ${i===activeSecIdx?'active':''}" onclick="activeSecIdx=${i};renderSecNav();renderSecDetail()">
      <span style="font-size:20px">${s.ico}</span>
      <div style="flex:1;min-width:0">
        <div style="font-family:'Cinzel',serif;font-size:10px;color:${i===activeSecIdx?'var(--cream)':'var(--cream2)'}">${s.name}</div>
        ${tp?`<div style="font-size:9px;color:var(--cream3);margin-top:1px">${tp.cat.name}</div>`:`<div style="font-size:9px;color:var(--cream3)">Aucun pet</div>`}
      </div>
      ${tp?`<span class="gs-badge ${gsCls(pct)}" style="font-size:9px;padding:1px 5px">GS ${normGS(tp)}</span>`:''}
    </div>`;
  }).join('');
}

let expandedResPets = new Set(); // ids des pets de réserve actuellement dépliés

function toggleResPetExpand(id){
  if(expandedResPets.has(id)) expandedResPets.delete(id);
  else expandedResPets.add(id);
  renderSecDetail();
}

// tri de la réserve (2026-07-20, demande explicite : "trier par GS, Tiers") -- 'default' = ordre
// d'obtention (aucun tri), sinon décroissant au premier clic, réinverse au clic suivant sur le
// même mode (même pattern que setSort() de la Collection, collection.js).
// Tri par défaut = Tier (2026-07-20, demande explicite : "Tier par Tiers/GS") -- Tier décroissant
// en priorité, GS décroissant en cas d'égalité de Tier (plutôt que l'ordre d'obtention par défaut).
let resSortMode='tier', resSortDir=-1;
function setResSort(mode){
  if(resSortMode===mode) resSortDir*=-1; else { resSortMode=mode; resSortDir=-1; }
  renderSecDetail();
}
function sortReserveList(list){
  if(resSortMode==='default') return list;
  const sorted=[...list];
  sorted.sort((a,b)=>{
    let v;
    if(resSortMode==='gs') v = normGS(a)-normGS(b);
    else { // 'tier' : Tier en priorité, GS en départage à Tier égal
      v = (a.tier||1)-(b.tier||1);
      if(v===0) v = normGS(a)-normGS(b);
    }
    return v*resSortDir;
  });
  return sorted;
}

function renderSecDetail(){
  const s=SECTIONS[activeSecIdx];
  const tp=terrainPet(s.id);
  const reserves=PETS.filter(p=>p.cat.sec===s.id&&!p.terrain);
  const c=document.getElementById('sec-detail');
  const terrainHtml=tp?`
    <div class="terrain-slot occ" style="--pcard-color:${rc(tp.rar)}">
      <div class="pcard-art">
        ${typeof companionModelUrlFor==='function'&&companionModelUrlFor(tp)
          ?`<div id="ts-cv3d-anchor" style="width:140px;height:140px"></div>`
          :`<canvas id="ts-cv" width="140" height="140" style="width:140px;height:140px;image-rendering:pixelated"></canvas>`}
        <span style="position:absolute;top:8px;left:8px;font-family:'Cinzel',serif;font-size:10px;color:var(--gold);background:rgba(0,0,0,.5);border-radius:4px;padding:1px 6px">T${tp.tier||1}</span>
        <span class="gs-badge ${gsCls(gsPct(tp))}" style="position:absolute;top:8px;right:8px">GS ${normGS(tp)}</span>
      </div>
      <div class="pcard-name">
        <div style="font-family:'Cinzel',serif;font-size:15px;color:var(--cream)">${tp.cat.name}</div>
        <div style="font-size:9px;color:${rc(tp.rar)};margin-top:2px">${rn(tp.rar)} · ${tp.cat.typ}</div>
      </div>
      <div class="pcard-body">
        <div style="display:flex;align-items:center;gap:7px">
          <span style="font-size:10px;color:var(--cream2)">${gsPct(tp)}% du max ${rn(tp.rar)}</span>
        </div>
        ${renderTierBlock(tp)}
        ${renderStatBars(tp)}
        ${renderCaphrasWorkshop(tp)}
      </div>
      <div class="pcard-actions">
        ${typeof companionModelUrlFor==='function'&&companionModelUrlFor(tp)?`<button class="btn btn-ghost" style="font-size:9px;padding:4px 9px;flex:1" onclick="open3dPreviewModal(PETS.find(p=>p.id===${tp.id}))">🧊 Voir en 3D</button>`:''}
        <button class="btn btn-red" style="font-size:9px;padding:4px 9px;flex:1" onclick="PETS.find(p=>p.id===${tp.id}).terrain=false;renderAll()">Retirer</button>
      </div>
    </div>`:`
    <div class="terrain-slot">
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;flex:1;color:var(--cream3)">
        <span style="font-size:30px;opacity:.2">${s.ico}</span>
        <span style="font-size:11px">Aucun pet sur le terrain</span>
        <button class="btn btn-ghost" style="margin-top:3px" onclick="ST(2)">Choisir dans la collection</button>
      </div>
    </div>`;

  // carte de réserve encore resserrée (2026-07-20, demande explicite : "carte reservce plus
  // petite" -- 2e passe après un premier resserrement le même jour) -- canvas/paddings/polices
  // réduits une nouvelle fois, GS/Tier/section restent visibles SANS avoir à déplier ; le détail
  // complet (stats/atelier Caphras) reste replié derrière le clic, comme avant.
  // Réserve à DROITE du terrain, en grille (2026-07-20, demande explicite : "afficher les pet en
  // reserve a droite du sur le terrain borner la taille de l'interface sur le terrain pour laisser
  // placer a des nouvelle carte en reserve de loger a coter") -- remplace l'ancienne liste
  // empilée en dessous par une grille responsive (auto-fill), qui profite de la largeur libérée
  // par le plafonnement de la carte terrain (260px fixe, voir .terrain-slot.occ) à sa gauche.
  const sortedReserves = sortReserveList(reserves);
  const resHtml=reserves.length?`
    <div style="background:var(--s2);border:1px solid var(--border);border-radius:9px;overflow:hidden;display:flex;flex-direction:column;min-height:0">
      <div style="padding:4px 8px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:6px;flex-wrap:wrap;flex-shrink:0">
        <span style="font-family:'Cinzel',serif;font-size:8px;letter-spacing:.08em;color:var(--cream2)">📦 Réserve (${reserves.length})</span>
        <!-- tri (2026-07-20, demande explicite : "trier par GS, Tiers") -->
        <div style="display:flex;gap:2px;margin-left:auto">
          <button class="schip ${resSortMode==='gs'?'on':''}" style="font-size:7px;padding:1px 5px" onclick="setResSort('gs')">GS${resSortMode==='gs'?(resSortDir<0?'↓':'↑'):''}</button>
          <button class="schip ${resSortMode==='tier'?'on':''}" style="font-size:7px;padding:1px 5px" onclick="setResSort('tier')">Tier${resSortMode==='tier'?(resSortDir<0?'↓':'↑'):''}</button>
        </div>
      </div>
      <div style="padding:4px;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:4px;overflow-y:auto;max-height:70vh">
        ${sortedReserves.map(p=>{
          const expanded = expandedResPets.has(p.id);
          const sec=secById(p.cat.sec);
          // carte compacte en 2 lignes (2026-07-20, "afficher les pet en reserve a droite... pour
          // laisser placer a des nouvelle carte en reserve de loger a coter") -- la grille auto-fill
          // (minmax(150px,1fr)) rend une ligne unique canvas+nom+badges+actions trop étroite ;
          // ligne 1 = identité (canvas/nom/flèche), ligne 2 = badges + actions, sur toute la largeur.
          return `<div style="background:var(--s3);border:1px solid var(--border);border-radius:5px;overflow:hidden">
            <div style="padding:3px 5px;cursor:pointer" onclick="toggleResPetExpand(${p.id})">
              <div style="display:flex;align-items:center;gap:4px">
                <canvas id="rv${p.id}" width="18" height="18" style="width:18px;height:18px;image-rendering:pixelated;flex-shrink:0"></canvas>
                <div style="flex:1;min-width:0;font-size:8px;color:var(--cream);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.cat.name}</div>
                <span style="font-size:7px;color:var(--cream3);transform:rotate(${expanded?'90deg':'0deg'});transition:transform .15s;flex-shrink:0">▶</span>
              </div>
              <div style="display:flex;align-items:center;gap:3px;margin-top:3px;flex-wrap:wrap">
                <span class="gs-badge ${gsCls(gsPct(p))}" style="font-size:6px;padding:0 2px">GS ${normGS(p)}</span>
                <span style="font-size:6px;color:var(--gold);font-family:'Cinzel',serif">T${p.tier||1}</span>
                <span style="font-size:6px;color:${rc(p.rar)}">${rn(p.rar)}</span>
                <span style="font-size:8px;color:var(--cream3)" title="${sec?.name||''}">${sec?.ico||''}</span>
                <div style="margin-left:auto;display:flex;gap:2px">
                  ${typeof companionModelUrlFor==='function'&&companionModelUrlFor(p)?`<button style="font-size:6px;padding:1px 3px;border-radius:3px;border:1px solid var(--border2);background:transparent;color:var(--cream2);cursor:pointer;flex-shrink:0" title="Voir en 3D" onclick="event.stopPropagation();open3dPreviewModal(PETS.find(pp=>pp.id===${p.id}))">🧊</button>`:''}
                  <button style="font-size:6px;padding:1px 3px;border-radius:3px;border:1px solid var(--gold-dim);background:transparent;color:var(--gold);cursor:pointer;font-family:'Cinzel',serif;flex-shrink:0" onclick="event.stopPropagation();deployPet(${p.id})">Déployer</button>
                </div>
              </div>
            </div>
            ${expanded?`<div style="padding:0 5px 5px 5px;border-top:1px solid var(--border);font-size:.75em;transform-origin:top left">${renderTierBlock(p)}${renderStatBars(p)}</div>`:''}
          </div>`;
        }).join('')}
      </div>
    </div>`:''

  c.innerHTML=`
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:32px">${s.ico}</span>
      <div><div style="font-family:'Cinzel',serif;font-size:17px;color:var(--cream)">${s.name}</div><div style="font-size:11px;color:var(--green2)">${s.bonus||''}</div></div>
    </div>
    <div style="display:flex;gap:14px;align-items:flex-start">
      <div style="width:300px;flex-shrink:0;background:var(--s2);border:1px solid var(--border);border-radius:10px;overflow:hidden">
        <div style="padding:7px 12px;border-bottom:1px solid var(--border);font-family:'Cinzel',serif;font-size:10px;letter-spacing:.08em;color:var(--cream2)">🌿 Sur le terrain</div>
        <div style="padding:10px 12px;display:flex;justify-content:center">${terrainHtml}</div>
      </div>
      <div style="flex:1;min-width:0">${resHtml}</div>
    </div>`;

  if(tp){setTimeout(()=>{const cv=document.getElementById('ts-cv');if(cv)drawPixelArt(cv,tp.cat.art,140,rc(tp.rar),tp.tier||1);},30);}
  reserves.forEach(p=>{setTimeout(()=>{const cv=document.getElementById('rv'+p.id);if(cv)drawPixelArt(cv,p.cat.art,18,null,p.tier||1);},30);});
  updateTerrainViewer3d(tp);
}

// carte terrain en 3D (2026-07-10, demande explicite : les 2 premières idées listées -- "carte
// terrain en 3D" pour les 12 espèces modélisées) -- remplace le pixel art de la grande carte
// "Pokémon" par le modèle GLB en rotation quand le pet déployé en a un (companionModelUrlFor).
// ATTENTION perf/leak : ticks.js appelle renderSecDetail() CHAQUE SECONDE tant que cet
// onglet est ouvert (voir tickHunger) -- créer un nouveau contexte WebGL à chaque appel aurait
// reproduit exactement le bug de fuite déjà corrigé pour la modale 3D (2026-07-20, "je ne vois pas
// mes model que le premier"). Le viewer est donc mis en cache par (id pet + tier) et son `wrap`
// (contenant le <canvas> WebGL déjà initialisé) est simplement RÉ-ATTACHÉ dans le nouvel ancrage
// généré par innerHTML, jamais recréé tant que le pet affiché ne change pas.
let terrainViewer3dState = null; // { key, wrap, viewer }
function disposeTerrainViewer3dIfActive(){
  if(!terrainViewer3dState) return;
  terrainViewer3dState.viewer.dispose();
  terrainViewer3dState = null;
}
function updateTerrainViewer3d(tp){
  const modelUrl = tp && typeof companionModelUrlFor==='function' ? companionModelUrlFor(tp) : null;
  if(!modelUrl){ disposeTerrainViewer3dIfActive(); return; }
  const key = tp.id+'_'+tp.tier;
  const anchor = document.getElementById('ts-cv3d-anchor');
  if(!anchor) return; // ce pet/section n'est plus affiché (re-render entre-temps) -- rien à faire
  if(terrainViewer3dState && terrainViewer3dState.key===key){
    anchor.appendChild(terrainViewer3dState.wrap); // même pet/tier : réutilise le contexte WebGL déjà chargé
    return;
  }
  disposeTerrainViewer3dIfActive();
  const mount = () => {
    const wrap = document.createElement('div');
    wrap.style.width='140px'; wrap.style.height='140px';
    anchor.appendChild(wrap);
    const viewer = createThreeViewer(wrap, () => {});
    viewer.loadModel(modelUrl);
    terrainViewer3dState = { key, wrap, viewer };
  };
  if(typeof window.THREE==='undefined') window.addEventListener('three-ready', mount, { once:true });
  else mount();
}

function deployPet(id){
  const p=PETS.find(pp=>pp.id===id);if(!p)return;
  PETS.forEach(pp=>{if(pp.cat.sec===p.cat.sec)pp.terrain=false;});
  p.terrain=true;renderAll();toast('🌿',`${p.cat.name} déployé !`);
}
