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
// même mode (même pattern que setSort() de la Collection, companions.collection.js).
let resSortMode='default', resSortDir=-1;
function setResSort(mode){
  if(resSortMode===mode) resSortDir*=-1; else { resSortMode=mode; resSortDir=-1; }
  renderSecDetail();
}
function sortReserveList(list){
  if(resSortMode==='default') return list;
  const sorted=[...list];
  sorted.sort((a,b)=>{
    const v = resSortMode==='gs' ? normGS(a)-normGS(b) : (a.tier||1)-(b.tier||1);
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
    <div class="terrain-slot occ">
      <canvas id="ts-cv" width="70" height="70" style="width:70px;height:70px;image-rendering:pixelated;flex-shrink:0"></canvas>
      <div style="flex:1">
        <div style="font-size:9px;color:${rc(tp.rar)};margin-bottom:2px">${rn(tp.rar)} · ${tp.cat.typ}</div>
        <div style="font-family:'Cinzel',serif;font-size:14px;color:var(--cream);margin-bottom:4px">${tp.cat.name}</div>
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:8px">
          <span class="gs-badge ${gsCls(gsPct(tp))}">GS ${normGS(tp)} / 1000</span>
          <span style="font-size:10px;color:var(--cream2)">${gsPct(tp)}% du max</span>
        </div>
        ${renderTierBlock(tp)}
        ${renderStatBars(tp)}
        ${renderCaphrasWorkshop(tp)}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${typeof companionModelUrlFor==='function'&&companionModelUrlFor(tp)?`<button class="btn btn-ghost" style="font-size:9px;padding:4px 9px" onclick="open3dPreviewModal(PETS.find(p=>p.id===${tp.id}))">🧊 Voir en 3D</button>`:''}
        <button class="btn btn-red" style="font-size:9px;padding:4px 9px" onclick="PETS.find(p=>p.id===${tp.id}).terrain=false;renderAll()">Retirer</button>
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
  const sortedReserves = sortReserveList(reserves);
  const resHtml=reserves.length?`
    <div style="background:var(--s2);border:1px solid var(--border);border-radius:9px;overflow:hidden">
      <div style="padding:4px 8px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span style="font-family:'Cinzel',serif;font-size:8px;letter-spacing:.08em;color:var(--cream2)">📦 Réserve (${reserves.length})</span>
        <!-- tri (2026-07-20, demande explicite : "trier par GS, Tiers") -->
        <div style="display:flex;gap:2px;margin-left:auto">
          <button class="schip ${resSortMode==='gs'?'on':''}" style="font-size:7px;padding:1px 5px" onclick="setResSort('gs')">GS${resSortMode==='gs'?(resSortDir<0?'↓':'↑'):''}</button>
          <button class="schip ${resSortMode==='tier'?'on':''}" style="font-size:7px;padding:1px 5px" onclick="setResSort('tier')">Tier${resSortMode==='tier'?(resSortDir<0?'↓':'↑'):''}</button>
        </div>
      </div>
      <div style="padding:3px;display:flex;flex-direction:column;gap:2px">
        ${sortedReserves.map(p=>{
          const expanded = expandedResPets.has(p.id);
          const sec=secById(p.cat.sec);
          return `<div style="background:var(--s3);border:1px solid var(--border);border-radius:4px;overflow:hidden">
            <div style="padding:2px 5px;display:flex;align-items:center;gap:4px;cursor:pointer" onclick="toggleResPetExpand(${p.id})">
              <canvas id="rv${p.id}" width="14" height="14" style="width:14px;height:14px;image-rendering:pixelated;flex-shrink:0"></canvas>
              <div style="flex:1;min-width:0">
                <div style="font-size:7.5px;color:var(--cream);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.cat.name}</div>
                <div style="display:flex;align-items:center;gap:2px;margin-top:1px">
                  <span class="gs-badge ${gsCls(gsPct(p))}" style="font-size:6px;padding:0 2px">GS ${normGS(p)}</span>
                  <span style="font-size:6px;color:var(--gold);font-family:'Cinzel',serif">T${p.tier||1}</span>
                  <span style="font-size:6px;color:${rc(p.rar)}">${rn(p.rar)}</span>
                  <span style="font-size:8px;color:var(--cream3)" title="${sec?.name||''}">${sec?.ico||''}</span>
                </div>
              </div>
              <span style="font-size:7px;color:var(--cream3);transform:rotate(${expanded?'90deg':'0deg'});transition:transform .15s;flex-shrink:0">▶</span>
              ${typeof companionModelUrlFor==='function'&&companionModelUrlFor(p)?`<button style="font-size:6px;padding:1px 3px;border-radius:3px;border:1px solid var(--border2);background:transparent;color:var(--cream2);cursor:pointer;flex-shrink:0" title="Voir en 3D" onclick="event.stopPropagation();open3dPreviewModal(PETS.find(pp=>pp.id===${p.id}))">🧊</button>`:''}
              <button style="font-size:6px;padding:1px 3px;border-radius:3px;border:1px solid var(--gold-dim);background:transparent;color:var(--gold);cursor:pointer;font-family:'Cinzel',serif;flex-shrink:0" onclick="event.stopPropagation();deployPet(${p.id})">Déployer</button>
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
    <div style="background:var(--s2);border:1px solid var(--border);border-radius:10px;overflow:hidden">
      <div style="padding:7px 12px;border-bottom:1px solid var(--border);font-family:'Cinzel',serif;font-size:10px;letter-spacing:.08em;color:var(--cream2)">🌿 Sur le terrain</div>
      <div style="padding:10px 12px">${terrainHtml}</div>
    </div>
    ${resHtml}`;

  if(tp){setTimeout(()=>{const cv=document.getElementById('ts-cv');if(cv)drawPixelArt(cv,tp.cat.art,70,rc(tp.rar),tp.tier||1);},30);}
  reserves.forEach(p=>{setTimeout(()=>{const cv=document.getElementById('rv'+p.id);if(cv)drawPixelArt(cv,p.cat.art,24,null,p.tier||1);},30);});
}

function deployPet(id){
  const p=PETS.find(pp=>pp.id===id);if(!p)return;
  PETS.forEach(pp=>{if(pp.cat.sec===p.cat.sec)pp.terrain=false;});
  p.terrain=true;renderAll();toast('🌿',`${p.cat.name} déployé !`);
}
