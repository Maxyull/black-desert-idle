// ═══ FUSION ══════════════════════════════════════════════════════
/** @param {number} pid - id du pet cliqué. Ajoute/retire ce pet des 2 slots de fusion (retire si déjà présent, sinon remplit le 1er slot vide ou décale le slot 0 vers le slot 1). */
function addToFusion(pid){
  if(fusionSlots[0]===pid||fusionSlots[1]===pid){const i=fusionSlots.indexOf(pid);fusionSlots[i]=null;}
  else if(fusionSlots[0]===null)fusionSlots[0]=pid;
  else if(fusionSlots[1]===null)fusionSlots[1]=pid;
  else{fusionSlots[0]=fusionSlots[1];fusionSlots[1]=pid;}
  updateFusionUI();renderGrid();
}
/** @param {number} i - index de slot (0 ou 1). Vide ce slot de fusion. */
function clearFS(i){fusionSlots[i]=null;updateFusionUI();renderGrid();}

/** Reconstruit les 2 slots de fusion et, si les deux sont remplis, l'aperçu de résultat (section/stats/GS/odds via computeFusionOdds). */
function updateFusionUI(){
  [0,1].forEach(i=>{
    const el=document.getElementById('fs'+i);const pid=fusionSlots[i];
    if(pid!==null){
      const p=PETS.find(pp=>pp.id===pid);
      if(!p){el.innerHTML='<span style="font-size:20px;color:var(--border2)">＋</span><span style="font-size:9px;color:var(--cream3)">'+i18next.t('companions:companions.fusion.select_slot')+'</span>';el.classList.remove('filled');return;}
      const pct=gsPct(p);
      el.innerHTML=`<canvas id="fs-cv${i}" width="44" height="44" style="width:44px;height:44px;image-rendering:pixelated"></canvas>
        <span style="font-size:9px;color:var(--cream);text-align:center;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.cat.name}</span>
        <span class="gs-badge ${gsCls(pct)}" style="font-size:9px;padding:1px 4px">GS ${normGS(p)}</span>`;
      el.classList.add('filled');
      setTimeout(()=>{const c=document.getElementById('fs-cv'+i);if(c)drawPixelArt(c,p.cat.art,44,rc(p.rar),p.tier||1);},30);
    } else {
      el.innerHTML='<span style="font-size:20px;color:var(--border2)">＋</span><span style="font-size:9px;color:var(--cream3)">'+i18next.t('companions:companions.fusion.select_slot')+'</span>';
      el.classList.remove('filled');
    }
  });

  const prev=document.getElementById('fus-preview');
  const btn=document.getElementById('fus-btn');
  if(fusionSlots[0]!==null&&fusionSlots[1]!==null){
    const a=PETS.find(p=>p.id===fusionSlots[0]),b=PETS.find(p=>p.id===fusionSlots[1]);
    if(!a||!b){btn.disabled=true;return;}
    const sameSec=a.cat.sec===b.cat.sec;
    const bestRar=Math.max(a.rar,b.rar);
    const resultStats=Array(5).fill(0).map((_,i)=>Math.max(a.stats[i]||0,b.stats[i]||0));
    const resultGS=Math.round(resultStats.reduce((s,v)=>s+v,0)/maxGS(5)*1000);
    const gain=resultGS-Math.max(normGS(a),normGS(b));
    const secForStats=secById(sameSec?a.cat.sec:a.cat.sec); // aperçu stats basé sur la section de A (résultat réel tiré 50/50 à la fusion)
    const baseTierPreview = Math.min(5, Math.max(a.tier||1,b.tier||1)+1);

    prev.innerHTML=`
      <div style="font-size:10px;font-family:'Cinzel',serif;letter-spacing:.06em;color:var(--cream2);margin-bottom:7px">
        Section — ${sameSec
          ? `<span style="color:var(--green2)">${i18next.t('companions:companions.fusion.section_same', {section:secName(secById(a.cat.sec))})}</span>`
          : `<span style="color:var(--blue2)">${i18next.t('companions:companions.fusion.section_5050', {a:secName(secById(a.cat.sec)), b:secName(secById(b.cat.sec))})}</span>`}
      </div>
      <div class="fp-hdr"><span>Stat</span><span style="text-align:center">${a.cat.name.split(' ')[0]}</span><span style="text-align:center">${b.cat.name.split(' ')[0]}</span><span style="text-align:right;color:var(--green2)">→</span></div>
      ${secForStats?secForStats.sk.map((k,i)=>{ const kLbl=skillName(secForStats,i);
        const active=i<BONUS_COUNT[bestRar];
        const va=a.stats[i]||0,vb=b.stats[i]||0,vr=Math.max(va,vb);
        const wa=va>=vb;
        return`<div class="fp-row">
          <span style="font-size:10px;color:${active?'var(--cream2)':'var(--cream3)'}">${active?'':'🔒 '}${kLbl}</span>
          <span class="fp-v" style="color:${active?wa?'var(--green2)':'var(--cream3)':'var(--cream3)'}">${active?va:'—'}</span>
          <span class="fp-v" style="color:${active?!wa?'var(--green2)':'var(--cream3)':'var(--cream3)'}">${active?vb:'—'}</span>
          <span class="fp-v" style="text-align:right;color:${active?rc(bestRar):'var(--cream3)'};font-weight:500">${active?vr:'—'}</span>
        </div>`;
      }).join(''):''}
      <div style="border-top:1px solid var(--border);margin-top:7px;padding-top:7px;display:flex;align-items:center;gap:7px">
        <span class="gs-badge ${gsCls(Math.round(resultGS/10))}">GS ${resultGS}</span>
        <span style="font-size:10px;color:${gain>=0?'var(--green2)':'var(--red2)'}">${i18next.t('companions:companions.fusion.vs_best_parent', {delta:`${gain>=0?'+':''}${gain}`})}</span>
      </div>
      <div style="border-top:1px solid var(--border);margin-top:7px;padding-top:7px;font-size:10px;color:var(--cream2)">
        ${(()=>{
          const odds = computeFusionOdds(a,b);
          const rarLines = odds.rarGap>0
            ? `<div>${i18next.t('companions:companions.fusion.base_rarity_line_html', {outcomes:odds.baseRarityOutcomes.map(o=>`${rn(o.rar)} ${o.pct.toFixed(0)}%`).join(' · ')})}</div>`
            : '';
          const rarFinalLine = `<div>${i18next.t('companions:companions.fusion.final_rarity_line_html', {outcomes:odds.rarOutcomes.map(o=>`${o.pct.toFixed(1)}% ${rn(o.rar)}`).join(' · ')})}</div>`;
          const tierLine = `<div>${i18next.t('companions:companions.fusion.tier_line_html', {outcomes:odds.tierOutcomes.map(o=>`${o.pct.toFixed(1)}% T${o.t}`).join(' · ')})}</div>`;
          const gapNote = odds.tierGap>0 ? `<div style="color:var(--cream3);font-size:9px">${i18next.t('companions:companions.fusion.gap_note', {gap:odds.tierGap, factor:odds.gapFactor.toFixed(2)})}</div>` : '';
          return rarLines + rarFinalLine + tierLine + gapNote + `<div>${i18next.t('companions:companions.fusion.rarity_up_reset_html')}</div>`;
        })()}
      </div>`;
    btn.disabled=false;
  } else {
    prev.innerHTML='<div style="font-size:10px;color:var(--cream3)">'+i18next.t('companions:companions.fusion.preview_placeholder')+'</div>';
    btn.disabled=true;
  }
}

// ═══ CALCUL PARTAGÉ DES ODDS DE FUSION (aperçu ET tirage réel utilisent CETTE fonction) ═══
// Plus l'écart de Tier entre les 2 pets est grand, moins les chances d'amélioration
// sont bonnes. Plus ils sont proches (voire identiques), meilleures sont les chances.
//
// Si les 2 parents n'ont PAS la même rareté, un tirage détermine d'abord laquelle des
// 2 raretés sert de base : 50/50 si l'écart est minime, jusqu'à 10/90 (favorable à la
// plus haute) si l'écart est maximal (Commun ↔ Ancestral, écart de 5).
/** @param {object[]} arr - issues avec un champ `key` et un `pct`. @param {string} key - nom du champ à dédupliquer. @returns {object[]} copie où les entrées de même `key` ont leurs pct sommés. */
function mergeDupOutcomes(arr, key){
  return arr.reduce((acc,o)=>{
    const ex=acc.find(x=>x[key]===o[key]);
    if(ex) ex.pct+=o.pct; else acc.push({...o});
    return acc;
  },[]);
}

/**
 * Détermine quelle rareté (basse ou haute des 2 parents) sert de base au tirage de fusion.
 * Toujours l'un des 2, jamais une 3e valeur — l'"amélioration" éventuelle (+1/+2/+3) est un
 * tirage séparé fait ensuite par computeFusionOdds()/rollFusionRarity().
 * @param {object} a - pet parent 1 (lit .rar).
 * @param {object} b - pet parent 2 (lit .rar).
 * @returns {{rarGap:number, outcomes:{rar:number,pct:number}[]}} rarGap = écart absolu de rareté ;
 *   outcomes = 1 entrée à 100% si même rareté, sinon 2 entrées (basse/haute) dont les % somment à
 *   100 — la rareté BASSE est favorisée, de 58/42 (écart 1) à 90/10 (écart maximal, 5).
 */
function baseRarityDraw(a, b){
  const rarGap = Math.abs(a.rar-b.rar);
  if(rarGap===0) return {rarGap, outcomes:[{rar:a.rar, pct:100}]};
  const lo=Math.min(a.rar,b.rar), hi=Math.max(a.rar,b.rar);
  // Dégressif : écart 1 ≈ 58/42, écart 5 (max) = 90/10 — la rareté BASSE est favorisée
  const pctHigherGapBased = Math.max(10, 50 - rarGap*8);
  // Chevauchement progressif (2026-07-13, demande explicite) : en plus de l'écart brut de rareté
  // ci-dessus, un parent de rareté BASSE déjà bien roulé (proche du GS moyen T1 attendu pour la
  // rareté supérieure, voir avgGSForRarityAtTier1()/progressiveTierProbability(), tier.js) a de
  // meilleures chances de tomber sur l'issue haute -- pas un cutoff net, une rampe linéaire sur une
  // bande de ±10% autour de ce seuil. Moyenné avec le facteur d'écart existant pour ne jamais
  // s'écarter trop loin de l'équilibrage déjà en place (le lo/hi de baseRarityDraw() reste inchangé).
  const loParent = a.rar===lo ? a : b;
  const nextThreshold = avgGSForRarityAtTier1(lo+1);
  const band = nextThreshold*0.10;
  const progressivePct = progressiveTierProbability(normGS(loParent), nextThreshold, band)*100;
  const pctHigher = Math.max(10, Math.min(90, (pctHigherGapBased+progressivePct)/2));
  return {rarGap, outcomes:[{rar:lo, pct:100-pctHigher},{rar:hi, pct:pctHigher}]};
}

/**
 * Calcule la distribution COMPLÈTE des résultats possibles d'une fusion (affichage préview, pas
 * le tirage réel — voir rollFusionRarity() pour le tirage effectif au moment de fusionner).
 * @param {object} a - pet parent 1 (lit .rar, .tier).
 * @param {object} b - pet parent 2 (lit .rar, .tier).
 * @returns {object} { tierGap, gapFactor, rarGap, baseRarityOutcomes, baseTier, rarOutcomes,
 *   tierOutcomes } — rarOutcomes/tierOutcomes sont déjà fusionnés (mergeDupOutcomes) et sommables
 *   à 100% chacun.
 */
function computeFusionOdds(a, b){
  const tierGap = Math.abs((a.tier||1)-(b.tier||1));
  // gapFactor : 1.0 si même tier (gap=0), descend jusqu'à un plancher de 0.15 si l'écart est grand
  // (T1 vs T5 = gap 4) -- plus l'écart de tier entre les 2 parents est grand, moins la fusion a de
  // chances de faire monter la rareté/le tier au-delà du résultat de base (voir up1/up2/up3 plus bas).
  const gapFactor = Math.max(0.15, 1 - tierGap*0.18);

  const {rarGap, outcomes:baseRarityOutcomes} = baseRarityDraw(a,b);

  // Distribution finale de rareté = tirage de la rareté de base × escalade (+1/+2/+3), composés
  let rarOutcomes = [];
  baseRarityOutcomes.forEach(baseO=>{
    const br = baseO.rar;
    const up1=18*gapFactor, up2=6*gapFactor, up3=1*gapFactor;
    const same = 100-up1-up2-up3;
    [[br,same],[Math.min(5,br+1),up1],[Math.min(5,br+2),up2],[Math.min(5,br+3),up3]].forEach(([r,p])=>{
      rarOutcomes.push({rar:r, pct:p*baseO.pct/100});
    });
  });
  rarOutcomes = mergeDupOutcomes(rarOutcomes, 'rar');

  // Tier (si la rareté ne bouge pas) — chances de sauter au-delà du palier de base, réduites par gapFactor
  const baseTier = Math.min(5, Math.max(a.tier||1, b.tier||1)+1);
  const tUp1 = 20*gapFactor, tUp2 = 7*gapFactor, tUp3 = 2.5*gapFactor, tUp4 = 0.5*gapFactor;
  const tBase = 100 - tUp1 - tUp2 - tUp3 - tUp4;
  const tierOutcomes = mergeDupOutcomes([
    {t:baseTier, pct:tBase},
    {t:Math.min(5,baseTier+1), pct:tUp1},
    {t:Math.min(5,baseTier+2), pct:tUp2},
    {t:Math.min(5,baseTier+3), pct:tUp3},
    {t:Math.min(5,baseTier+4), pct:tUp4},
  ], 't');

  return {
    tierGap, gapFactor, rarGap, baseRarityOutcomes, baseTier,
    rarOutcomes, tierOutcomes,
  };
}

/**
 * Tirage RÉEL en 2 étapes (rareté de base via baseRarityDraw(), puis escalade +1/+2/+3 pondérée
 * par gapFactor) — n'appeler qu'à la confirmation de fusion, jamais pour un aperçu (voir
 * computeFusionOdds() pour la distribution complète sans tirer). Ne peut QUE faire monter la
 * rareté depuis bestRar (jamais descendre) ; la vraie "perte" possible se joue dans
 * baseRarityDraw() en amont (favorise la rareté basse des 2 parents).
 * @param {object} a - pet parent 1.
 * @param {object} b - pet parent 2.
 * @param {number} gapFactor - voir computeFusionOdds(), réduit les chances d'escalade si les
 *   parents ont des tiers très différents.
 * @returns {{bestRar:number, newRar:number, rarityIncreased:boolean}} bestRar = rareté de base
 *   tirée (avant escalade), newRar = rareté finale (0 à 5, ≥ bestRar), rarityIncreased = vrai si
 *   l'escalade a eu lieu.
 */
function rollFusionRarity(a, b, gapFactor){
  const {outcomes} = baseRarityDraw(a,b);
  let bestRar;
  if(outcomes.length===1){
    bestRar = outcomes[0].rar;
  } else {
    const roll = Math.random()*100;
    bestRar = roll < outcomes[0].pct ? outcomes[0].rar : outcomes[1].rar;
  }
  const up1=18*gapFactor, up2=6*gapFactor, up3=1*gapFactor;
  const roll2 = Math.random()*100;
  let newRar = bestRar;
  if(roll2<up3) newRar = Math.min(5,bestRar+3);
  else if(roll2<up3+up2) newRar = Math.min(5,bestRar+2);
  else if(roll2<up3+up2+up1) newRar = Math.min(5,bestRar+1);
  return {bestRar, newRar, rarityIncreased:newRar>bestRar};
}

/** Ouvre la modale d'aperçu de fusion pour les 2 pets actuellement en fusionSlots (odds de section/rareté/tier détaillés, bouton de confirmation). No-op si un des 2 slots est vide. */
function openFusionPreviewModal(){
  const a=PETS.find(p=>p.id===fusionSlots[0]),b=PETS.find(p=>p.id===fusionSlots[1]);
  if(!a||!b)return;

  const sameSec = a.cat.sec===b.cat.sec;
  const odds = computeFusionOdds(a,b);
  const {baseRarityOutcomes, baseTier, tierGap, gapFactor, rarGap, rarOutcomes, tierOutcomes} = odds;

  document.getElementById('fusion-modal-title').textContent = i18next.t('companions:companions.fusion.preview_title');
  document.getElementById('fusion-modal-body').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:16px">
      <div style="text-align:center">
        <canvas id="fp-a" width="52" height="52" style="width:52px;height:52px;image-rendering:pixelated"></canvas>
        <div style="font-size:10px;color:${rc(a.rar)};margin-top:3px">${a.cat.name}</div>
        <div style="font-size:9px;color:var(--gold)">T${a.tier||1}</div>
      </div>
      <span style="font-size:22px;color:var(--gold)">+</span>
      <div style="text-align:center">
        <canvas id="fp-b" width="52" height="52" style="width:52px;height:52px;image-rendering:pixelated"></canvas>
        <div style="font-size:10px;color:${rc(b.rar)};margin-top:3px">${b.cat.name}</div>
        <div style="font-size:9px;color:var(--gold)">T${b.tier||1}</div>
      </div>
    </div>

    <div style="text-align:center;margin-bottom:10px;padding:6px 10px;border-radius:6px;background:${tierGap===0?'rgba(68,176,96,.1)':tierGap<=2?'rgba(232,184,75,.1)':'rgba(224,80,80,.1)'};border:1px solid ${tierGap===0?'var(--green2)':tierGap<=2?'var(--gold2)':'var(--r5)'}">
      <span style="font-size:10px;color:${tierGap===0?'var(--green2)':tierGap<=2?'var(--gold2)':'var(--r5)'}">
        ${tierGap===0?i18next.t('companions:companions.fusion.tiers_identical'):i18next.t('companions:companions.fusion.tier_gap_warning', {gap:tierGap, factor:gapFactor.toFixed(2)})}
      </span>
    </div>

    <div style="background:var(--s3);border:1.5px solid var(--cream2);border-radius:8px;padding:10px 12px;margin-bottom:10px">
      <div style="margin-bottom:7px">
        <span style="font-family:'Cinzel',serif;font-size:10px;letter-spacing:.06em;color:var(--cream2)">${sameSec?i18next.t('companions:companions.fusion.section_header_same'):i18next.t('companions:companions.fusion.section_header_diff')}</span>
      </div>
      ${sameSec
        ? `<div style="font-size:11px;color:var(--green2)">${i18next.t('companions:companions.fusion.section_100', {section:secName(secById(a.cat.sec))})}</div>`
        : `<div style="display:flex;flex-direction:column;gap:4px">
             <div style="display:flex;align-items:center;gap:8px"><span style="font-size:11px;color:var(--cream2);width:120px">${secById(a.cat.sec)?.ico} ${secName(secById(a.cat.sec))}</span><div style="flex:1;height:5px;background:var(--border);border-radius:3px;overflow:hidden"><div style="width:50%;height:100%;background:var(--cream2)"></div></div><span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--cream3)">50%</span></div>
             <div style="display:flex;align-items:center;gap:8px"><span style="font-size:11px;color:var(--cream2);width:120px">${secById(b.cat.sec)?.ico} ${secName(secById(b.cat.sec))}</span><div style="flex:1;height:5px;background:var(--border);border-radius:3px;overflow:hidden"><div style="width:50%;height:100%;background:var(--cream2)"></div></div><span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--cream3)">50%</span></div>
           </div>`}
    </div>

    <div style="background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:10px">
      <div style="font-family:'Cinzel',serif;font-size:10px;letter-spacing:.06em;color:var(--cream2);margin-bottom:7px">${i18next.t('companions:companions.fusion.tier_possible_title')}</div>
      <div style="font-size:9px;color:var(--cream3);margin-bottom:6px">${i18next.t('companions:companions.fusion.if_rarity_same', {pct:rarOutcomes[0].pct.toFixed(1)})}</div>
      ${tierOutcomes.map(o=>`
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
          <span style="font-family:'Cinzel',serif;font-size:11px;color:var(--gold);width:40px">T${o.t}</span>
          <div style="flex:1;height:4px;background:var(--border);border-radius:2px;overflow:hidden"><div style="width:${o.pct}%;height:100%;background:var(--gold)"></div></div>
          <span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--cream3);width:35px;text-align:right">${o.pct.toFixed(1)}%</span>
        </div>`).join('')}
      <div style="font-size:9px;color:var(--r5);margin-top:6px">${i18next.t('companions:companions.fusion.if_rarity_up_reset', {pct:(100-rarOutcomes[0].pct).toFixed(1)})}</div>
    </div>

    ${rarGap>0?`
    <div style="background:var(--s3);border:1px solid var(--r3);border-radius:8px;padding:10px 12px;margin-bottom:10px">
      <div style="font-family:'Cinzel',serif;font-size:10px;letter-spacing:.06em;color:var(--r3);margin-bottom:7px">${i18next.t('companions:companions.fusion.downgrade_warning_title')}</div>
      ${baseRarityOutcomes.map(o=>`
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span style="font-size:11px;color:${rc(o.rar)};width:90px">${rn(o.rar)}</span>
          <div style="flex:1;height:5px;background:var(--border);border-radius:3px;overflow:hidden"><div style="width:${o.pct}%;height:100%;background:${rc(o.rar)}"></div></div>
          <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--cream3);width:35px;text-align:right">${o.pct.toFixed(0)}%</span>
        </div>`).join('')}
      <div style="font-size:9px;color:var(--cream3);margin-top:4px">${i18next.t('companions:companions.fusion.downgrade_note', {gap:rarGap})}</div>
    </div>`:''}

    <div style="background:var(--s3);border:1.5px solid var(--gold);border-radius:8px;padding:10px 12px;margin-bottom:10px">
      <div style="margin-bottom:7px">
        <span style="font-family:'Cinzel',serif;font-size:10px;letter-spacing:.06em;color:var(--gold)">${rarGap>0?i18next.t('companions:companions.fusion.bonus_title_with_gap'):i18next.t('companions:companions.fusion.bonus_title')}</span>
      </div>
      ${rarOutcomes.map(o=>`
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span style="font-size:11px;color:${rc(o.rar)};width:90px">${rn(o.rar)}</span>
          <div style="flex:1;height:5px;background:var(--border);border-radius:3px;overflow:hidden"><div style="width:${o.pct}%;height:100%;background:${rc(o.rar)}"></div></div>
          <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--cream3);width:35px;text-align:right">${o.pct.toFixed(1)}%</span>
        </div>`).join('')}
      <div style="font-size:9px;color:var(--cream3);margin-top:4px">${i18next.t('companions:companions.fusion.bonus_note')}</div>
    </div>

    <div style="background:var(--s1);border:1px solid var(--border);border-radius:8px;padding:9px 12px;margin-bottom:14px">
      <div style="font-family:'Cinzel',serif;font-size:9px;letter-spacing:.06em;color:var(--cream2);margin-bottom:6px">${i18next.t('companions:companions.fusion.legend_title')}</div>
      <div style="font-size:9px;color:var(--cream3);line-height:1.6">
        ${i18next.t('companions:companions.fusion.legend_sections_html', {list:SECTIONS.map(s=>s.ico+' '+secName(s)).join(', ')})}<br>
        ${i18next.t('companions:companions.fusion.legend_tier_html')}<br>
        ${i18next.t('companions:companions.fusion.legend_rarity_html', {list:RARITIES.map(r=>`<span style="color:${r.hex}">${rn(r.id)}</span>`).join(', ')})}
      </div>
    </div>

    <button class="btn btn-gold" style="width:100%" onclick="confirmFusionExecute(${a.id},${b.id})">${i18next.t('companions:companions.fusion.confirm_btn')}</button>
  `;
  OM('fusion-modal');
  setTimeout(()=>{
    const ca=document.getElementById('fp-a'); if(ca) drawPixelArt(ca,a.cat.art,52,rc(a.rar),a.tier||1);
    const cb=document.getElementById('fp-b'); if(cb) drawPixelArt(cb,b.cat.art,52,rc(b.rar),b.tier||1);
  },30);
}

/** @param {number} aId @param {number} bId - ids des 2 pets parents. Lance executeFusion() si les deux existent encore. */
function confirmFusionExecute(aId,bId){
  const a=PETS.find(p=>p.id===aId), b=PETS.find(p=>p.id===bId);
  if(!a||!b) return;
  executeFusion(a,b);
}

/**
 * Tirage réel de fusion : résout la section (même si identique, 50/50 sinon), la rareté
 * (rollFusionRarity, tracke fusionLostHighRarityCount si le meilleur parent était Légendaire+/
 * Ancestral et redescend), le tier (reset à T1 si la rareté a bondi, sinon +1 garanti avec chance
 * d'escalade), les stats (meilleur des 2 parents, clampé à la nouvelle rareté). Remplace les 2
 * parents par le pet fusionné dans PETS, log + affiche le résultat.
 * @param {object} a - pet parent 1.
 * @param {object} b - pet parent 2.
 */
function executeFusion(a,b){
  // 1. Résolution de la section du résultat
  const sameSec = a.cat.sec===b.cat.sec;
  const resultSec = sameSec ? a.cat.sec : (Math.random()<0.5 ? a.cat.sec : b.cat.sec);
  const cat = a.cat.sec===resultSec ? a.cat : b.cat;

  // 2. Rareté — tirage réel en 2 étapes (rareté de base si raretés différentes, puis escalade)
  const odds = computeFusionOdds(a,b);
  const {bestRar, newRar, rarityIncreased} = rollFusionRarity(a, b, odds.gapFactor);
  fusionCount++;
  if(rarityIncreased) breakthroughCount++;
  // achievement "dur" (2026-07-20, demande explicite) : compare au meilleur des 2 PARENTS
  // d'ORIGINE (Math.max(a.rar,b.rar)), PAS à `bestRar` ci-dessus -- `bestRar` est déjà le résultat
  // du tirage de base (baseRarityDraw, qui favorise la rareté BASSE des deux parents jusqu'à
  // 90/10), donc `newRar` ne peut structurellement jamais descendre sous `bestRar`
  // (rollFusionRarity n'AJOUTE qu'une escalade +0/+1/+2/+3, jamais de malus). La vraie "perte" se
  // joue DANS baseRarityDraw : fusionner un Ancestral avec un pet plus faible peut retomber sur la
  // rareté du parent le plus faible -- c'est CE cas qu'on veut détecter ici.
  const bestParentRar = Math.max(a.rar, b.rar);
  if(bestParentRar>=4 && newRar<bestParentRar) fusionLostHighRarityCount++;

  // 3. Tier — si la rareté a bondi, reset systématique à T1.
  //    Sinon, la fusion progresse d'au moins 1 cran, avec une chance de sauter plus loin
  //    (réduite si l'écart de Tier entre les 2 parents est important — même calcul que l'aperçu).
  let newTier;
  if(rarityIncreased){
    newTier = 1;
  } else {
    const baseTier = odds.baseTier;
    const gapFactor = odds.gapFactor;
    const tUp1=20*gapFactor, tUp2=7*gapFactor, tUp3=2.5*gapFactor, tUp4=0.5*gapFactor;
    const tRoll = Math.random()*100;
    let extra=0;
    if(tRoll<tUp4) extra=4;
    else if(tRoll<tUp4+tUp3) extra=3;
    else if(tRoll<tUp4+tUp3+tUp2) extra=2;
    else if(tRoll<tUp4+tUp3+tUp2+tUp1) extra=1;
    newTier = Math.min(5, baseTier+extra);
  }

  // 4. Stats — meilleur des deux parents, plafonné à la fourchette de la nouvelle rareté
  const newStats=Array(5).fill(0).map((_,i)=>{
    if(i>=BONUS_COUNT[newRar])return 0;
    const best=Math.max(a.stats[i]||0,b.stats[i]||0);
    const[lo,hi]=STAT_RANGES[newRar][i];
    return +Math.min(hi,Math.max(lo,best)).toFixed(1);
  });

  const wasTerrain=a.terrain||b.terrain;
  const merged={id:petId++,cat,rar:newRar,stats:newStats,hunger:80,terrain:wasTerrain,tier:newTier,tierXp:0,tierMult:rollTierMult(newTier)};
  PETS=PETS.filter(p=>p.id!==a.id&&p.id!==b.id);
  PETS.push(merged);

  const fl=document.getElementById('fus-log');
  if(fl){
    const r=document.createElement('div');
    r.style.cssText='font-size:10px;display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border)';
    r.innerHTML=`<span style="color:var(--cream2)">${a.cat.name}+${b.cat.name}</span><span style="color:${rc(newRar)}">→${rn(newRar)} T${newTier} GS${normGS(merged)}</span>`;
    fl.insertBefore(r,fl.firstChild);
  }
  fusionSlots=[null,null];renderAll();
  showFusionResultModal(a, b, merged, rarityIncreased, sameSec, resultSec);
}

// Flèche colorée compréhensible d'un coup d'œil : ⬆️ vert = gain, ⬇️ rouge = perte, ➡️ gris = inchangé
/** @param {number} delta - variation (positive/négative/nulle). @returns {{ico:string, color:string}} flèche/couleur (⬆️ vert gain, ⬇️ rouge perte, ➡️ gris inchangé). */
function deltaArrow(delta){
  if(delta>0) return {ico:'⬆️', color:'var(--green2)'};
  if(delta<0) return {ico:'⬇️', color:'var(--red2)'};
  return {ico:'➡️', color:'var(--cream3)'};
}

/**
 * Affiche la modale de résultat de fusion (comparaison Tier/GS au meilleur des 2 parents, flèches
 * de progression, stats détaillées du pet obtenu).
 * @param {object} a - pet parent 1 (avant fusion). @param {object} b - pet parent 2 (avant fusion).
 * @param {object} merged - pet résultant. @param {boolean} rarityIncreased - vrai si percée de rareté.
 * @param {boolean} sameSec - vrai si les 2 parents partageaient la même section.
 * @param {string} resultSec - section du résultat.
 */
function showFusionResultModal(a, b, merged, rarityIncreased, sameSec, resultSec){
  document.getElementById('fusion-modal-title').textContent = rarityIncreased ? i18next.t('companions:companions.fusion.result_breakthrough_title') : i18next.t('companions:companions.fusion.result_success_title');

  const gs = normGS(merged), pct = gsPct(merged);
  const sec = secById(merged.cat.sec);
  const gainA = gs - normGS(a), gainB = gs - normGS(b);

  // Rang (Tier) et Score (GS) comparés au MEILLEUR des 2 parents — c'est la vraie question du
  // joueur ("est-ce que j'ai progressé ?"), pas une moyenne des deux.
  const bestParentTier = Math.max(a.tier||1, b.tier||1);
  const bestParentGS = Math.max(normGS(a), normGS(b));
  const tierArrow = deltaArrow(merged.tier - bestParentTier);
  const gsArrow = deltaArrow(gs - bestParentGS);

  document.getElementById('fusion-modal-body').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:14px">
      <div style="text-align:center;opacity:.7">
        <canvas id="fr-a" width="40" height="40" style="width:40px;height:40px;image-rendering:pixelated"></canvas>
        <div style="font-size:8px;color:${rc(a.rar)};margin-top:2px">${a.cat.name.split(' ')[0]}</div>
      </div>
      <span style="font-size:18px;color:var(--cream3)">+</span>
      <div style="text-align:center;opacity:.7">
        <canvas id="fr-b" width="40" height="40" style="width:40px;height:40px;image-rendering:pixelated"></canvas>
        <div style="font-size:8px;color:${rc(b.rar)};margin-top:2px">${b.cat.name.split(' ')[0]}</div>
      </div>
      <span style="font-size:18px;color:var(--gold)">→</span>
      <div style="text-align:center">
        <canvas id="fr-merged" width="70" height="70" style="width:70px;height:70px;image-rendering:pixelated"></canvas>
      </div>
    </div>

    ${!sameSec?`<div style="text-align:center;font-size:10px;color:var(--blue2);margin-bottom:8px">${i18next.t('companions:companions.fusion.diff_sections_result_html', {section:secName(sec)})}</div>`:''}

    <div style="text-align:center;font-size:9px;color:${rc(merged.rar)};letter-spacing:.1em;text-transform:uppercase;margin-bottom:2px">${merged.cat.orig.toUpperCase()} · ${typeLabel(merged.cat.typ)}</div>
    <div style="text-align:center;font-family:'Cinzel',serif;font-size:19px;color:var(--cream);margin-bottom:2px">${merged.cat.name}</div>
    <div style="text-align:center;font-size:11px;color:var(--cream2);margin-bottom:10px">${sec?.ico} ${secName(sec)} · ${rn(merged.rar)}</div>

    ${rarityIncreased?`<div style="text-align:center;background:rgba(224,80,80,.1);border:1px solid var(--r5);border-radius:7px;padding:8px;margin-bottom:12px;font-size:11px;color:var(--r5)">${i18next.t('companions:companions.fusion.breakthrough_banner')}</div>`:''}

    <div style="display:flex;justify-content:center;gap:8px;margin-bottom:8px">
      <span class="gs-badge ${gsCls(pct)}">GS ${gs} / 1000</span>
      <span style="font-size:10px;color:var(--cream2)">${i18next.t('companions:companions.hatch.gs_of_max', {pct:pct, rarity:rn(merged.rar)})}</span>
    </div>

    <div style="background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:9px 12px;margin-bottom:10px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:11px;color:var(--cream2)">${i18next.t('companions:companions.fusion.rank_label')}</span>
        <span style="font-size:12px;color:${tierArrow.color};font-weight:600">T${bestParentTier} ➡️ T${merged.tier} ${tierArrow.ico}</span>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:11px;color:var(--cream2)">💪 Score (GS)</span>
        <span style="font-size:12px;color:${gsArrow.color};font-weight:600">${bestParentGS} ➡️ ${gs} ${gsArrow.ico}</span>
      </div>
    </div>
    <div style="text-align:center;font-size:10px;color:var(--cream3);margin-bottom:12px">${gainA>=0?'+':''}${gainA} vs ${a.cat.name.split(' ')[0]} · ${gainB>=0?'+':''}${gainB} vs ${b.cat.name.split(' ')[0]}</div>

    <div style="margin-bottom:8px">${renderTierBlock(merged)}${renderStatBars(merged)}</div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn btn-ghost" style="flex:1" onclick="CM('fusion-modal')">${i18next.t('companions:companions.fusion.close_btn')}</button>
      <button class="btn btn-gold" style="flex:1" onclick="CM('fusion-modal');ST(3)">${i18next.t('companions:companions.fusion.view_in_collection')}</button>
    </div>
  `;
  // La fenêtre reste ouverte (déjà affichée depuis l'étape aperçu) — on ne fait que remplacer son contenu.
  OM('fusion-modal');
  setTimeout(()=>{
    const ca=document.getElementById('fr-a'); if(ca) drawPixelArt(ca, a.cat.art, 40, rc(a.rar), a.tier||1);
    const cb=document.getElementById('fr-b'); if(cb) drawPixelArt(cb, b.cat.art, 40, rc(b.rar), b.tier||1);
    const cm=document.getElementById('fr-merged'); if(cm) drawPixelArt(cm, merged.cat.art, 70, rc(merged.rar), merged.tier||1);
  }, 40);

  if(rarityIncreased) toast('🌟',i18next.t('companions:companions.fusion.breakthrough_toast', {name:merged.cat.name, rarity:rn(merged.rar), from:bestParentGS, to:gs, arrow:gsArrow.ico}));
  else toast('⚗️',i18next.t('companions:companions.fusion.result_toast', {name:merged.cat.name, fromTier:bestParentTier, toTier:merged.tier, tierArrow:tierArrow.ico, from:bestParentGS, to:gs, arrow:gsArrow.ico}));
}
