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

  // carte de réserve resserrée (2026-07-20, demande explicite : "carte de reserve plus petite
  // avec info") -- canvas/paddings réduits, mais le GS/Tier/section restent visibles SANS avoir à
  // déplier (contrairement à avant où seul le nom était garanti visible en un coup d'œil) ; le
  // détail complet (stats/atelier Caphras) reste replié derrière le clic, comme avant.
  const resHtml=reserves.length?`
    <div style="background:var(--s2);border:1px solid var(--border);border-radius:9px;overflow:hidden">
      <div style="padding:5px 9px;border-bottom:1px solid var(--border);font-family:'Cinzel',serif;font-size:8.5px;letter-spacing:.08em;color:var(--cream2)">📦 Réserve (${reserves.length}) — clique pour voir les stats</div>
      <div style="padding:4px;display:flex;flex-direction:column;gap:3px">
        ${reserves.map(p=>{
          const expanded = expandedResPets.has(p.id);
          const sec=secById(p.cat.sec);
          return `<div style="background:var(--s3);border:1px solid var(--border);border-radius:5px;overflow:hidden">
            <div style="padding:3px 6px;display:flex;align-items:center;gap:5px;cursor:pointer" onclick="toggleResPetExpand(${p.id})">
              <canvas id="rv${p.id}" width="18" height="18" style="width:18px;height:18px;image-rendering:pixelated;flex-shrink:0"></canvas>
              <div style="flex:1;min-width:0">
                <div style="font-size:8.5px;color:var(--cream);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.cat.name}</div>
                <div style="display:flex;align-items:center;gap:3px;margin-top:1px">
                  <span class="gs-badge ${gsCls(gsPct(p))}" style="font-size:6.5px;padding:0 2px">GS ${normGS(p)}</span>
                  <span style="font-size:6.5px;color:var(--gold);font-family:'Cinzel',serif">T${p.tier||1}</span>
                  <span style="font-size:6.5px;color:${rc(p.rar)}">${rn(p.rar)}</span>
                  <span style="font-size:9px;color:var(--cream3)" title="${sec?.name||''}">${sec?.ico||''}</span>
                </div>
              </div>
              <span style="font-size:8px;color:var(--cream3);transform:rotate(${expanded?'90deg':'0deg'});transition:transform .15s;flex-shrink:0">▶</span>
              <button style="font-size:6.5px;padding:1px 3px;border-radius:3px;border:1px solid var(--gold-dim);background:transparent;color:var(--gold);cursor:pointer;font-family:'Cinzel',serif;flex-shrink:0" onclick="event.stopPropagation();deployPet(${p.id})">Déployer</button>
            </div>
            ${expanded?`<div style="padding:0 6px 6px 6px;border-top:1px solid var(--border);font-size:.78em;transform-origin:top left">${renderTierBlock(p)}${renderStatBars(p)}</div>`:''}
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
