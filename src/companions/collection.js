// ═══ COLLECTION ══════════════════════════════════════════════════
/** @param {'gs'|'rar'|'tier'|'nom'|'sec'|'typ'} mode - critère de tri. @param {HTMLElement} el - chip cliquée. Réinverse sortDir si déjà actif, sinon l'active en décroissant, met à jour la grille. */
function setSort(mode,el){
  if(sortMode===mode)sortDir*=-1;else{sortMode=mode;sortDir=-1;}
  document.querySelectorAll('.schip').forEach(c=>c.classList.remove('on'));
  el.classList.add('on');renderGrid();
}

// ═══ COLONNES PAR LIGNE (2026-07-20, demande explicite : "ajout d'un bouton choix combien par
// ligne 5 a 9") ═══
// Remplace l'ancien zoom à 3 crans (largeur mini approximative, repeat(auto-fill,minmax(Npx,1fr)))
// par un choix EXACT du nombre de colonnes -- repeat(N,1fr), N de 5 à 9. Préférence d'affichage
// pure, jamais persistée dans la sauvegarde. Le cran le plus dense (7-9 colonnes) bascule sur la
// variante compacte de carte (même logique qu'avant, voir renderGrid() plus bas) : au-delà de
// 6 colonnes, la carte est trop étroite pour la ligne meta verbeuse (rareté en toutes lettres).
const COLL_COLS_MIN = 5, COLL_COLS_MAX = 9, COLL_COLS_COMPACT_FROM = 7;
let collColsPerRow = 6; // valeur de départ, proche de l'ancien cran par défaut (160px ≈ 6 colonnes à largeur normale)
/** Reconstruit les chips de choix du nombre de colonnes (5-9) de la grille Collection. */
function renderCollColsChips(){
  const el = document.getElementById('coll-cols-chips');
  if(!el) return;
  el.innerHTML = Array.from({length:COLL_COLS_MAX-COLL_COLS_MIN+1},(_,i)=>COLL_COLS_MIN+i)
    .map(n=>`<button class="schip ${n===collColsPerRow?'on':''}" onclick="setCollColsPerRow(${n})">${n}</button>`).join('');
}
/** @param {number} n - nombre de colonnes voulu (clampé à [COLL_COLS_MIN, COLL_COLS_MAX]). Applique la grille, revient à la page 0 (la pagination dépend du nombre de colonnes) et rafraîchit. */
function setCollColsPerRow(n){
  const prevCompact = collColsPerRow>=COLL_COLS_COMPACT_FROM;
  collColsPerRow = Math.max(COLL_COLS_MIN, Math.min(COLL_COLS_MAX, n));
  const grid = document.getElementById('pet-grid');
  if(grid) grid.style.gridTemplateColumns = `repeat(${collColsPerRow},minmax(90px,1fr))`;
  renderCollColsChips();
  const nowCompact = collColsPerRow>=COLL_COLS_COMPACT_FROM;
  // changer le nombre de colonnes change aussi la pagination (taille de page dépend des colonnes) --
  // revient à la page 0 pour éviter une page hors-limites après le changement
  collPage = 0;
  renderGrid();
  if(prevCompact !== nowCompact) { /* renderGrid() ci-dessus régénère déjà les cartes avec la bonne variante */ }
}

// ═══ PAGINATION (2026-07-20, demande explicite : "turn on of pagination") ═══
// OFF par défaut : .pet-grid garde son défilement continu habituel (overflow-y:auto, déjà en
// place). ON : découpe la liste filtrée/triée en pages de collColsPerRow×4 cartes (4 lignes par
// page), avec un pager Précédent/Suivant sous la grille -- jamais persisté dans la sauvegarde.
let collPaginationOn = false;
let collPage = 0;
/** Bascule la pagination de la Collection on/off, revient à la page 0, rafraîchit la grille. */
function toggleCollPagination(){
  collPaginationOn = !collPaginationOn;
  collPage = 0;
  const btn = document.getElementById('pagination-toggle');
  if(btn) btn.textContent = collPaginationOn ? i18next.t('companions:companions.collection.pagination_on') : i18next.t('companions:companions.collection.pagination_off');
  renderGrid();
}
/** @param {number} delta - +1/-1. Change de page (clampé à 0 en bas, le clamp haut se fait dans renderGrid selon le nombre de résultats filtrés). */
function collPageDelta(delta){
  collPage = Math.max(0, collPage + delta); // le clamp haut se fait dans renderGrid() (dépend du nombre de résultats filtrés)
  renderGrid();
}

// ═══ BADGE FUSION CENTRÉ DANS LE HEADER (2026-07-20, demande explicite) ═══
// Reflète le même calcul TOP1/TOP2/TOP3 que renderGrid() ci-dessous (compte des candidats
// actuellement affichés dans la grille) -- appelée à chaque renderGrid(), visible seulement
// pendant une sélection de fusion (1 pet choisi, 2e slot vide).
/** @param {?{top1:number, top2:number, top3:number}} counts - comptes de candidats de fusion (renderGrid), null pour masquer le badge. Met à jour le badge de fusion du header. */
function updateHeaderFusionBadge(counts){
  const el = document.getElementById('hdr-fusion-badge');
  if(!el) return;
  if(!counts){ el.style.display='none'; return; }
  const parts=[];
  if(counts.top1) parts.push(`🥇×${counts.top1}`);
  if(counts.top2) parts.push(`🥈×${counts.top2}`);
  if(counts.top3) parts.push(`🥉×${counts.top3}`);
  el.textContent = parts.length ? i18next.t('companions:companions.collection.fusion_candidates', {parts:parts.join(' ')}) : i18next.t('companions:companions.collection.no_fusion_candidates');
  el.style.display = '';
}

/** Reconstruit les chips de filtre section/rareté/tier de la Collection. */
function renderFilters(){
  document.getElementById('sec-filter-chips').innerHTML=
    SECTIONS.map(s=>`<div class="chip ${filterSec.has(s.id)?'on':''}" onclick="toggleFilter(filterSec,'${s.id}')">${s.ico}</div>`).join('');
  document.getElementById('rar-filter-chips').innerHTML=
    RARITIES.map(r=>`<div class="chip ${filterRar.has(String(r.id))?'on':''}" onclick="toggleFilter(filterRar,'${r.id}')"><span style="color:${r.hex}">${rn(r.id).split(' ')[0]}</span></div>`).join('');
  const tierChipsEl = document.getElementById('tier-filter-chips');
  if(tierChipsEl){
    tierChipsEl.innerHTML =
      [1,2,3,4,5].map(t=>`<div class="chip ${filterTierColl.has(String(t))?'on':''}" onclick="toggleFilter(filterTierColl,'${t}')">T${t}</div>`).join('');
  }
}

/** Reconstruit la grille Collection : filtre/trie PETS, pagine si activé, calcule les indices de fusion (TOP1/TOP2/TOP3 selon rareté/section/tier communs au 1er pet sélectionné) et rend chaque carte. */
function renderGrid(){
  // badge d'onglet Collection : masqué à 0 (2026-07-19, "menu trop de chiffre pour rien") -- n'affiche
  // le compte que lorsqu'il porte une information (au moins 1 familier en collection).
  const tb2=document.getElementById('tb2'); if(tb2){ tb2.textContent=PETS.length; tb2.style.display=PETS.length?'':'none'; }
  const gridEl = document.getElementById('pet-grid');
  if(gridEl) gridEl.style.gridTemplateColumns = `repeat(${collColsPerRow},minmax(90px,1fr))`;
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

  // pagination (2026-07-20, demande explicite) : découpe list APRÈS filtre/tri, jamais avant --
  // sinon la pagination porterait sur un ordre incohérent avec ce que le joueur voit dans les
  // filtres/tri actifs. bestInSec/fusionBadgeCounts restent calculés sur TOUTE la collection
  // (PETS), pas seulement la page affichée -- "meilleur de la section" doit rester vrai même si
  // ce pet n'est pas sur la page courante.
  const collPageSize = collColsPerRow * 4; // 4 lignes par page
  const pageCount = collPaginationOn ? Math.max(1, Math.ceil(list.length / collPageSize)) : 1;
  if(collPage > pageCount-1) collPage = pageCount-1; // clamp après un changement de filtre qui réduit le total
  const pageList = collPaginationOn ? list.slice(collPage*collPageSize, (collPage+1)*collPageSize) : list;
  const pagerEl = document.getElementById('coll-pager');
  if(pagerEl){
    pagerEl.style.display = collPaginationOn ? 'flex' : 'none';
    const lbl = document.getElementById('coll-pager-label');
    if(lbl) lbl.textContent = i18next.t('companions:companions.collection.page_label', {page:collPage+1, total:pageCount, count:list.length});
  }
  renderCollColsChips();

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
  document.getElementById('pet-grid').innerHTML=pageList.map(p=>{
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

    const cardGlow = isTop1 ? 'box-shadow:0 0 0 2px var(--gold),0 0 14px rgba(212,169,85,.35)'
      : isTop2 ? 'box-shadow:0 0 0 2px #b8bcc4,0 0 14px rgba(184,188,196,.3)'
      : isTop3 ? 'box-shadow:0 0 0 2px #cd7f32,0 0 14px rgba(205,127,50,.3)'
      : (bothSelected && isF) ? 'box-shadow:0 0 0 3px var(--green2),0 0 18px rgba(111,220,111,.5)'
      : '';

    return`<div class="pet-card ${p.terrain?'terrain':''} ${isF?'fusion-sel':''}" style="${cardGlow}${isDimmed?'filter:grayscale(0.9) brightness(.55);opacity:.55':''}" onclick="addToFusion(${p.id})" id="card${p.id}">
      <div class="rstrip" style="background:${rc(p.rar)}"></div>
      ${isTop1?`<div style="position:absolute;top:6px;left:50%;transform:translateX(-50%);background:var(--gold);color:var(--bg);font-size:12px;font-family:'Cinzel',serif;font-weight:700;padding:3px 12px;border-radius:5px;z-index:2;box-shadow:0 2px 8px rgba(200,169,110,.5);white-space:nowrap">🥇 TOP1</div>`:''}
      ${isTop2?`<div style="position:absolute;top:6px;left:50%;transform:translateX(-50%);background:#b8bcc4;color:var(--bg);font-size:12px;font-family:'Cinzel',serif;font-weight:700;padding:3px 12px;border-radius:5px;z-index:2;box-shadow:0 2px 8px rgba(184,188,196,.5);white-space:nowrap">🥈 TOP2</div>`:''}
      ${isTop3?`<div style="position:absolute;top:6px;left:50%;transform:translateX(-50%);background:#cd7f32;color:var(--bg);font-size:12px;font-family:'Cinzel',serif;font-weight:700;padding:3px 12px;border-radius:5px;z-index:2;box-shadow:0 2px 8px rgba(205,127,50,.5);white-space:nowrap">🥉 TOP3</div>`:''}
      ${bothSelected&&isF?`<div style="position:absolute;top:6px;left:50%;transform:translateX(-50%);background:var(--green2);color:var(--bg);font-size:12px;font-family:'Cinzel',serif;font-weight:700;padding:3px 12px;border-radius:5px;z-index:2;box-shadow:0 2px 8px rgba(68,176,96,.5);white-space:nowrap">${i18next.t('companions:companions.collection.chosen_badge')}</div>`:''}
      <div class="card-art">
        <canvas id="ca${p.id}" width="56" height="56" style="width:56px;height:56px;image-rendering:pixelated"></canvas>
        ${p.terrain?'<div class="terrain-dot"></div>':''}
      </div>
      <div class="card-body">
        <div class="card-name">${p.cat.name}</div>
        ${collColsPerRow>=COLL_COLS_COMPACT_FROM ? `
        <div class="card-meta-compact" title="${rn(p.rar)} · T${p.tier||1} (${tierMultPct(p)}%) · ${secName(sec)} · ${typeLabel(p.cat.typ)}">
          ${tierRarPill(p,'sm')}
          <span class="cmcSec">${sec?.ico}</span>
          <span class="gs-badge ${gsCls(pct)}" style="color:${rc(p.rar)};border-color:${rc(p.rar)}">GS ${gs}</span>
        </div>` : `
        <div class="card-meta">
          ${tierRarPill(p)}
          <span style="font-family:'Cinzel',serif;font-size:9px;color:var(--gold)" title="${i18next.t('companions:companions.collection.mult_title', {mult:tierMultOf(p).toFixed(3)})}">${tierMultPct(p)}%</span>
          <span style="color:var(--cream3)">·</span>
          <span>${sec?.ico} ${secName(sec)}</span>
          <span style="color:var(--cream3)">·</span>
          <span>${typeLabel(p.cat.typ)}</span>
        </div>
        <div class="card-gs-row">
          <span class="gs-badge ${gsCls(pct)}" style="font-size:9px;padding:1px 5px;color:${rc(p.rar)};border-color:${rc(p.rar)}">GS ${gs}</span>
          <div class="gs-bar"><div class="gs-bar-fill" style="width:${pct}%;background:${rc(p.rar)}"></div></div>
          <span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--cream3)">${pct}%</span>
        </div>`}
        ${(()=>{const cmp=comparisonBadge(p);return cmp?`<div style="font-size:9px;color:${cmp.beats?'var(--green2)':'var(--red2)'};margin-top:2px">${cmp.text}</div>`:'';})()}
        ${isBest&&!p.terrain?'<div style="font-size:9px;color:var(--gold);margin-top:1px">'+i18next.t('companions:companions.collection.best_of_section')+'</div>':''}
        <div class="card-actions">
          ${p.terrain
            ?`<button class="btn btn-red" style="font-size:9px;padding:3px 7px;flex:1" onclick="event.stopPropagation();PETS.find(pp=>pp.id===${p.id}).terrain=false;renderAll()">${i18next.t('companions:companions.collection.remove_btn')}</button>`
            :`<button class="btn btn-gold" style="font-size:9px;padding:3px 7px;flex:1" onclick="event.stopPropagation();deployPet(${p.id})">${i18next.t('companions:companions.hatch.deploy_btn')}</button>`}
          ${typeof companionModelUrlFor==='function'&&companionModelUrlFor(p)?`<button class="btn btn-ghost" style="font-size:9px;padding:3px 7px" title="${i18next.t('companions:companions.collection.view_3d_title')}" onclick="event.stopPropagation();open3dPreviewModal(PETS.find(pp=>pp.id===${p.id}))">🧊</button>`:''}
          ${typeof quickAddToMarket==='function'?`<button class="btn btn-ghost" style="font-size:9px;padding:3px 7px" title="${i18next.t('companions:companions.collection.add_to_market_title')}" onclick="event.stopPropagation();quickAddToMarket(${p.id})">🔄</button>`:''}
          <button class="btn ${isF?'btn-red':'btn-ghost'}" style="font-size:9px;padding:3px 7px" onclick="event.stopPropagation();addToFusion(${p.id})">${isF?'✕FS':'⚗️'}</button>
        </div>
      </div>
      ${previewHtml}
    </div>`;
  }).join('');
  pageList.forEach(p=>{
    const c=document.getElementById('ca'+p.id);
    if(c) drawPixelArt(c,p.cat.art,56,p.terrain?'#44b06033':null,p.tier||1);
  });
  updateHeaderFusionBadge(showMergeHints ? fusionBadgeCounts : null);
}
