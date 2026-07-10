// ═══ COLLECTION ══════════════════════════════════════════════════
function setSort(mode,el){
  if(sortMode===mode)sortDir*=-1;else{sortMode=mode;sortDir=-1;}
  document.querySelectorAll('.schip').forEach(c=>c.classList.remove('on'));
  el.classList.add('on');renderGrid();
}

// ═══ ZOOM DE LA GRILLE (2026-07-20, demande explicite) ═══
// Largeur minimale des cartes de .pet-grid (repeat(auto-fill,minmax(Npx,1fr)), voir
// companions.css) -- 3 crans, préférence d'affichage pure, jamais persistée dans la sauvegarde.
const COLL_ZOOM_STEPS = [120, 160, 200]; // px, du plus dense (plus par ligne) au plus large
let collZoomIdx = 1; // index de départ = valeur actuelle de companions.css (160px)
function setCollZoom(delta){
  collZoomIdx = Math.max(0, Math.min(COLL_ZOOM_STEPS.length-1, collZoomIdx+delta));
  const grid = document.getElementById('pet-grid');
  if(grid) grid.style.gridTemplateColumns = `repeat(auto-fill,minmax(${COLL_ZOOM_STEPS[collZoomIdx]}px,1fr))`;
  const outBtn = document.getElementById('zoom-out'), inBtn = document.getElementById('zoom-in');
  if(outBtn) outBtn.disabled = collZoomIdx===0;
  if(inBtn) inBtn.disabled = collZoomIdx===COLL_ZOOM_STEPS.length-1;
}

// ═══ BADGE FUSION CENTRÉ DANS LE HEADER (2026-07-20, demande explicite) ═══
// Reflète le même calcul TOP1/TOP2/TOP3 que renderGrid() ci-dessous (compte des candidats
// actuellement affichés dans la grille) -- appelée à chaque renderGrid(), visible seulement
// pendant une sélection de fusion (1 pet choisi, 2e slot vide).
function updateHeaderFusionBadge(counts){
  const el = document.getElementById('hdr-fusion-badge');
  if(!el) return;
  if(!counts){ el.style.display='none'; return; }
  const parts=[];
  if(counts.top1) parts.push(`🥇×${counts.top1}`);
  if(counts.top2) parts.push(`🥈×${counts.top2}`);
  if(counts.top3) parts.push(`🥉×${counts.top3}`);
  el.textContent = parts.length ? `Candidats fusion : ${parts.join(' ')}` : 'Aucun candidat de fusion trouvé';
  el.style.display = '';
}

function renderFilters(){
  document.getElementById('sec-filter-chips').innerHTML=
    SECTIONS.map(s=>`<div class="chip ${filterSec.has(s.id)?'on':''}" onclick="toggleFilter(filterSec,'${s.id}')">${s.ico}</div>`).join('');
  document.getElementById('rar-filter-chips').innerHTML=
    RARITIES.map(r=>`<div class="chip ${filterRar.has(String(r.id))?'on':''}" onclick="toggleFilter(filterRar,'${r.id}')"><span style="color:${r.hex}">${r.name.split(' ')[0]}</span></div>`).join('');
  const tierChipsEl = document.getElementById('tier-filter-chips');
  if(tierChipsEl){
    tierChipsEl.innerHTML =
      [1,2,3,4,5].map(t=>`<div class="chip ${filterTierColl.has(String(t))?'on':''}" onclick="toggleFilter(filterTierColl,'${t}')">T${t}</div>`).join('');
  }
}

function renderGrid(){
  document.getElementById('tb2').textContent=PETS.length;
  const q=document.getElementById('search-box')?.value.toLowerCase()||'';
  let list=[...PETS];
  if(filterSec.size) list=list.filter(p=>filterSec.has(p.cat.sec));
  if(filterRar.size) list=list.filter(p=>filterRar.has(String(p.rar)));
  if(filterTierColl.size) list=list.filter(p=>filterTierColl.has(String(p.tier||1)));
  if(q) list=list.filter(p=>p.cat.name.toLowerCase().includes(q)||p.cat.typ.toLowerCase().includes(q)||p.cat.sec.includes(q));

  list.sort((a,b)=>{
    let v=0;
    if(sortMode==='gs')v=normGS(a)-normGS(b);
    else if(sortMode==='rar')v=a.rar-b.rar;
    else if(sortMode==='tier')v=(a.tier||1)-(b.tier||1);
    else if(sortMode==='nom')v=a.cat.name.localeCompare(b.cat.name);
    else if(sortMode==='sec')v=a.cat.sec.localeCompare(b.cat.sec);
    else if(sortMode==='typ')v=a.cat.typ.localeCompare(b.cat.typ);
    return v*sortDir;
  });

  const bestInSec={};
  SECTIONS.forEach(s=>{
    const inSec=PETS.filter(p=>p.cat.sec===s.id);
    if(inSec.length){bestInSec[s.id]=inSec.reduce((a,b)=>normGS(a)>=normGS(b)?a:b).id;}
  });

  const inF=fusionSlots;
  const firstSelected = inF[0]!==null ? PETS.find(p=>p.id===inF[0]) : null;
  const showMergeHints = firstSelected && inF[1]===null; // un seul pet choisi -> on aide à voir quoi merger
  const bothSelected = inF[0]!==null && inF[1]!==null; // les 2 slots sont remplis -> on isole les 2 choisis
  const absMax = maxGS(5,5);
  // compteurs pour le badge fusion du header (2026-07-20, demande explicite) -- accumulés pendant
  // le même passage que le rendu des cartes ci-dessous, jamais un second calcul séparé.
  const fusionBadgeCounts = {top1:0, top2:0, top3:0};
  document.getElementById('pet-grid').innerHTML=list.map(p=>{
    const pct=gsPct(p),gs=normGS(p);
    const isBest=bestInSec[p.cat.sec]===p.id;
    const isF=inF.includes(p.id);
    const sec=secById(p.cat.sec);

    // TOP1 = même rareté + même section (le choix le plus sûr) · TOP2 = même rareté, section différente
    const sameRarAsFirst = showMergeHints && p.id!==firstSelected.id && p.rar===firstSelected.rar;
    const sameSecAsFirst = p.cat.sec===firstSelected?.cat.sec;
    const sameTierAsFirst = (p.tier||1)===(firstSelected?.tier||1);
    const isTop1 = sameRarAsFirst && sameSecAsFirst && sameTierAsFirst;
    const isTop2 = sameRarAsFirst && sameTierAsFirst && !sameSecAsFirst;
    const isTop3 = sameRarAsFirst && !sameSecAsFirst && !sameTierAsFirst;
    const isMergeCandidate = isTop1 || isTop2 || isTop3;
    if(isTop1) fusionBadgeCounts.top1++;
    else if(isTop2) fusionBadgeCounts.top2++;
    else if(isTop3) fusionBadgeCounts.top3++;
    const isDimmed = (showMergeHints && p.id!==firstSelected.id && !isMergeCandidate) || (bothSelected && !isF);

    // Mini-aperçu de fusion : meilleur des stats + rareté/tier probables
    let previewHtml = '';
    if(isMergeCandidate){
      const bestRar = Math.max(firstSelected.rar, p.rar);
      const baseTier = Math.min(5, Math.max(firstSelected.tier||1, p.tier||1)+1);
      const bestStats = Array(5).fill(0).map((_,i)=>Math.max(firstSelected.stats[i]||0, p.stats[i]||0));
      const previewGS = Math.round(bestStats.reduce((s,v)=>s+v,0)*tierMultOf({tier:baseTier,rar:bestRar,tierMult:(TIER_MULT_RANGE[baseTier-1][0]+TIER_MULT_RANGE[baseTier-1][1])/2})/absMax*1000);
      const badgeCol = isTop1 ? 'var(--gold-dim)' : isTop2 ? '#b8bcc460' : '#cd7f3260';
      const badgeTxtCol = isTop1 ? 'var(--gold2)' : isTop2 ? '#b8bcc4' : '#e0a878';
      previewHtml = `<div style="position:absolute;bottom:4px;left:4px;right:4px;background:rgba(8,8,16,.9);border:1px solid ${badgeCol};border-radius:5px;padding:4px 6px;z-index:2;font-size:8px;color:${badgeTxtCol};text-align:center">
        ⚗️ ~T${baseTier} · GS≈${previewGS}
      </div>`;
    }

    const cardGlow = isTop1 ? 'box-shadow:0 0 0 2px var(--gold),0 0 14px rgba(200,169,110,.35)'
      : isTop2 ? 'box-shadow:0 0 0 2px #b8bcc4,0 0 14px rgba(184,188,196,.3)'
      : isTop3 ? 'box-shadow:0 0 0 2px #cd7f32,0 0 14px rgba(205,127,50,.3)'
      : (bothSelected && isF) ? 'box-shadow:0 0 0 3px var(--green2),0 0 18px rgba(68,176,96,.5)'
      : '';

    return`<div class="pet-card ${p.terrain?'terrain':''} ${isF?'fusion-sel':''}" style="${cardGlow}${isDimmed?'filter:grayscale(0.9) brightness(.55);opacity:.55':''}" onclick="addToFusion(${p.id})" id="card${p.id}">
      <div class="rstrip" style="background:${rc(p.rar)}"></div>
      ${isTop1?`<div style="position:absolute;top:6px;left:50%;transform:translateX(-50%);background:var(--gold);color:#080810;font-size:12px;font-family:'Cinzel',serif;font-weight:700;padding:3px 12px;border-radius:5px;z-index:2;box-shadow:0 2px 8px rgba(200,169,110,.5);white-space:nowrap">🥇 TOP1</div>`:''}
      ${isTop2?`<div style="position:absolute;top:6px;left:50%;transform:translateX(-50%);background:#b8bcc4;color:#080810;font-size:12px;font-family:'Cinzel',serif;font-weight:700;padding:3px 12px;border-radius:5px;z-index:2;box-shadow:0 2px 8px rgba(184,188,196,.5);white-space:nowrap">🥈 TOP2</div>`:''}
      ${isTop3?`<div style="position:absolute;top:6px;left:50%;transform:translateX(-50%);background:#cd7f32;color:#080810;font-size:12px;font-family:'Cinzel',serif;font-weight:700;padding:3px 12px;border-radius:5px;z-index:2;box-shadow:0 2px 8px rgba(205,127,50,.5);white-space:nowrap">🥉 TOP3</div>`:''}
      ${bothSelected&&isF?`<div style="position:absolute;top:6px;left:50%;transform:translateX(-50%);background:var(--green2);color:#080810;font-size:12px;font-family:'Cinzel',serif;font-weight:700;padding:3px 12px;border-radius:5px;z-index:2;box-shadow:0 2px 8px rgba(68,176,96,.5);white-space:nowrap">✓ Choisi</div>`:''}
      <div class="card-art">
        <canvas id="ca${p.id}" width="56" height="56" style="width:56px;height:56px;image-rendering:pixelated"></canvas>
        ${p.terrain?'<div class="terrain-dot"></div>':''}
      </div>
      <div class="card-body">
        <div class="card-name">${p.cat.name}</div>
        <div class="card-meta">
          <span style="color:${rc(p.rar)};font-size:9px">${rn(p.rar)}</span>
          <span style="font-family:'Cinzel',serif;font-size:9px;color:var(--gold)" title="Multiplicateur ×${tierMultOf(p).toFixed(3)}">T${p.tier||1} <span style="color:var(--cream3)">(${tierMultPct(p)}%)</span></span>
          <span style="color:var(--cream3)">·</span>
          <span>${sec?.ico} ${sec?.name}</span>
          <span style="color:var(--cream3)">·</span>
          <span>${p.cat.typ}</span>
        </div>
        <div class="card-gs-row">
          <span class="gs-badge ${gsCls(pct)}" style="font-size:9px;padding:1px 5px">GS ${gs}</span>
          <div class="gs-bar"><div class="gs-bar-fill" style="width:${pct}%;background:${rc(p.rar)}"></div></div>
          <span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--cream3)">${pct}%</span>
        </div>
        ${(()=>{const cmp=comparisonBadge(p);return cmp?`<div style="font-size:9px;color:${cmp.beats?'var(--green2)':'var(--red2)'};margin-top:2px">${cmp.text}</div>`:'';})()}
        ${isBest&&!p.terrain?'<div style="font-size:9px;color:var(--gold);margin-top:1px">⭐ Meilleur de la section</div>':''}
        <div class="card-actions">
          ${p.terrain
            ?`<button class="btn btn-red" style="font-size:9px;padding:3px 7px;flex:1" onclick="event.stopPropagation();PETS.find(pp=>pp.id===${p.id}).terrain=false;renderAll()">Retirer</button>`
            :`<button class="btn btn-gold" style="font-size:9px;padding:3px 7px;flex:1" onclick="event.stopPropagation();deployPet(${p.id})">Déployer</button>`}
          <button class="btn ${isF?'btn-red':'btn-ghost'}" style="font-size:9px;padding:3px 7px" onclick="event.stopPropagation();addToFusion(${p.id})">${isF?'✕FS':'⚗️'}</button>
        </div>
      </div>
      ${previewHtml}
    </div>`;
  }).join('');
  list.forEach(p=>{
    const c=document.getElementById('ca'+p.id);
    if(c) drawPixelArt(c,p.cat.art,56,p.terrain?'#44b06033':null,p.tier||1);
  });
  updateHeaderFusionBadge(showMergeHints ? fusionBadgeCounts : null);
}
