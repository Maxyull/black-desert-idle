// ═══ TABS & PETITS UTILITAIRES D'UI ═════════════════════════════
function ST(i){
  document.querySelectorAll('.tab').forEach((t,j)=>t.classList.toggle('active',i===j));
  ['p5','p0','p1','p2','p3','p4','p6','p7','p8','p9'].forEach((id,j)=>{const el=document.getElementById(id);if(el)el.classList.toggle('active',i===j);});
  // bug corrigé (2026-07-20, rapporté explicitement : "timer qui se met pas a jour, on ne peut
  // pas acheter les oeufs") -- ST(1) (onglet Éclosion) n'appelait jamais renderHatch() : le tick
  // (companions.ticks.js) décrémente bien sl.tl/passe sl.ready à true en mémoire chaque seconde,
  // mais SEUL renderHatch() régénère le DOM de #incub-slots (compte à rebours affiché + bouton
  // "Éclore" qui n'apparaît que si sl.ready). Sans cet appel, un joueur qui ouvrait l'onglet AVANT
  // qu'un slot devienne prêt ne voyait jamais le bouton apparaître (il fallait quitter l'onglet et
  // y revenir -- ce qui ne redéclenchait rien non plus, d'où le symptôme "je ne peux pas acheter
  // d'œuf"). Voir aussi companions.ticks.js qui appelle désormais renderHatch() en direct tant que
  // cet onglet reste actif, pour que le compte à rebours bouge vraiment sans changer d'onglet.
  if(i===1) renderHatch();
  if(i===5) renderIndex();
  if(i===0) renderGameView();
  if(i===6) startHardinage();
  if(i===7) renderAchievements();
  if(i===8) renderPvp();
  if(i===9) renderMyStatsAndLeaderboard();
}
function toast(ico,msg){const w=document.getElementById('toast-wrap');const t=document.createElement('div');t.className='toast';t.innerHTML=`<span style="font-size:15px">${ico}</span><span>${msg}</span>`;w.appendChild(t);setTimeout(()=>t.remove(),2900);}
function OM(id){document.getElementById(id).classList.add('open');}
function CM(id){document.getElementById(id).classList.remove('open');}
function fmtT(s){if(s<=0)return'PRÊT';return`${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor(s%3600/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}

// ═══ HATCH ═══════════════════════════════════════════════════════
function renderHatch(){
  // Slots
  document.getElementById('incub-slots').innerHTML=incubSlots.map((sl,i)=>{
    if(sl.locked)return`<div class="isl locked"><span style="font-size:28px">🔒</span><div style="font-size:8px;color:var(--cream3)">${costLabelFor(scaleCost(500))}</div></div>`;
    if(sl.ready)return`<div class="isl ready"><div style="position:relative"><span style="font-size:28px">🥚</span><div style="position:absolute;inset:-6px;border-radius:50%;background:radial-gradient(circle,rgba(68,176,96,.4),transparent);animation:eglaur 1s ease-in-out infinite"></div></div>${sl.free?'<span style="font-size:8px;color:var(--green2);background:rgba(68,176,96,.1);border:1px solid rgba(68,176,96,.3);border-radius:3px;padding:1px 4px">✦ Gratuit</span>':''}<div class="itimer done">PRÊT!</div><button style="font-family:Cinzel,serif;font-size:9px;padding:4px 10px;border-radius:4px;border:1px solid var(--gold);background:linear-gradient(135deg,#5a3a10,#c8a96e);color:#080810;cursor:pointer" onclick="openEggChoice(${i})">Éclore</button></div>`;
    const pct=Math.round((1-sl.tl/sl.tot)*100);
    return`<div class="isl">${sl.free?'<span style="font-size:8px;color:var(--green2);background:rgba(68,176,96,.1);border:1px solid rgba(68,176,96,.3);border-radius:3px;padding:1px 4px">✦ Gratuit</span>':''}<span style="font-size:28px">🥚</span><div class="itimer">${fmtT(sl.tl)}</div><div class="iprog"><div class="iprog-fill" style="width:${pct}%"></div></div></div>`;
  }).join('')+`<div class="isl" style="opacity:.5;cursor:pointer" onclick="toast('💰','Slot premium — ${costLabelFor(scaleCost(1000))}')"><span style="font-size:28px">➕</span><div style="font-size:8px;color:var(--cream3)">${costLabelFor(scaleCost(1000))}</div></div>`;
  // Odds
  // Grille comparative : Rareté × Type d'œuf
  const PERIOD_DAYS = {2:7, 3:14, 4:21, 5:30}; // Rare→semaine, Épique→2sem, Légendaire→3sem, Ancestral→mois
  let tableHtml = `<table style="border-collapse:collapse;font-size:11px;min-width:520px">
    <thead><tr>
      <th style="padding:6px 10px;text-align:left;color:var(--cream2);border-bottom:1px solid var(--border)">Rareté</th>
      ${EGG_TYPES.map(e=>`<th style="padding:6px 10px;color:var(--gold);border-bottom:1px solid var(--border);font-family:'Cinzel',serif;font-size:10px">
        <div style="display:flex;gap:3px;justify-content:center;margin-bottom:4px">
          ${[1,5,10].map(q=>{
            const total=e.cost*q, affordable=SILVER>=total;
            return `<button class="btn ${q===1?'btn-ghost':'btn-gold'}" style="font-size:8px;padding:2px 6px;${affordable?'':'opacity:.35;pointer-events:none'}" onclick="bulkHatch('${e.id}',${q})" title="${total.toLocaleString('fr-FR')} Silver">×${q}</button>`;
          }).join('')}
        </div>
        ${e.ico} ${e.name}<div style="font-size:8px;color:var(--cream3);font-weight:400">${e.costLabel}</div>
      </th>`).join('')}
    </tr></thead><tbody>`;

  RARITIES.forEach((r,ri)=>{
    const period = PERIOD_DAYS[ri];
    tableHtml += `<tr>
      <td style="padding:6px 10px;color:${r.hex};font-family:'Cinzel',serif;border-bottom:1px solid var(--border)">${r.name}${period?`<div style="font-size:8px;color:var(--cream3);font-weight:400">cible: ${period===7?'1 sem.':period===14?'2 sem.':period===21?'3 sem.':'1 mois'}</div>`:''}</td>
      ${EGG_TYPES.map(egg=>{
        const pct = egg.odds[ri];
        let sub = '';
        if(period){
          const n = period*4; // 4 œufs/jour
          const prob = (1-Math.pow(1-pct/100, n))*100;
          sub = `<div style="font-size:8px;color:var(--green2)">(${prob.toFixed(0)}%)</div>`;
        }
        return `<td style="padding:6px 10px;text-align:center;font-family:'JetBrains Mono',monospace;border-bottom:1px solid var(--border);color:var(--cream)">${pct}%${sub}</td>`;
      }).join('')}
    </tr>`;
  });

  tableHtml += `</tbody></table>`;
  document.getElementById('egg-odds-table').innerHTML = tableHtml;
  // Rarity bonus
  document.getElementById('rarity-table').innerHTML=RARITIES.map((r,i)=>`<div style="display:flex;align-items:center;gap:5px;margin-bottom:5px"><span style="font-size:9px;color:${r.hex};width:72px">${r.name}</span><div style="display:flex;gap:2px">${Array(5).fill(0).map((_,si)=>`<div style="width:10px;height:10px;border-radius:2px;background:${si<BONUS_COUNT[i]?r.hex:'var(--border)'}"></div>`).join('')}</div><span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--cream3)">${BONUS_COUNT[i]}</span></div>`).join('');
  // History
  document.getElementById('hist-grid').innerHTML=PETS.slice(0,10).map(p=>{
    const gs=normGS(p),pct=gsPct(p);
    return`<div style="background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;display:flex;align-items:center;gap:8px;cursor:pointer" onclick="ST(2)">
      <canvas id="hh${p.id}" width="40" height="40" style="width:40px;height:40px;image-rendering:pixelated;flex-shrink:0"></canvas>
      <div style="flex:1;min-width:0">
        <div style="font-size:11px;font-weight:500;color:var(--cream);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.cat.name}</div>
        <div style="font-size:9px;color:${rc(p.rar)};margin-top:1px">${rn(p.rar)}</div>
        <div style="display:flex;align-items:center;gap:4px;margin-top:3px">
          <span class="gs-badge ${gsCls(pct)}" style="font-size:9px;padding:1px 5px">GS ${gs}</span>
          <span style="font-size:9px;color:var(--cream2)">${secById(p.cat.sec)?.ico}</span>
        </div>
      </div>
    </div>`;
  }).join('');
  PETS.slice(0,10).forEach(p=>{const c=document.getElementById('hh'+p.id);if(c)drawPixelArt(c,p.cat.art,40,null,p.tier||1);});
}

// ═══ CHOIX D'ŒUF ═══════════════════════════════════════════════
function openEggChoice(slotIdx){
  const sl=incubSlots[slotIdx];
  const body=document.getElementById('hatch-body');
  const modal=document.getElementById('hatch-modal');
  const titleEl = modal.querySelector('.modal > div[style*="Cinzel"]');
  if(titleEl) titleEl.textContent = '🥚 Choisis ton œuf';

  const standardEggs = EGG_TYPES.filter(e=>!e.targeted);
  const targetedEggs = EGG_TYPES.filter(e=>e.targeted);

  function eggRow(egg,i){
    const affordable = SILVER>=egg.cost || (egg.cost===0);
    return `<div style="background:var(--s3);border:1px solid ${egg.targeted?'var(--blue2)':'var(--border)'};border-radius:9px;padding:10px 12px;display:flex;align-items:center;gap:12px;${affordable?'':'opacity:.45'}">
      <span style="font-size:26px">${egg.ico}</span>
      <div style="flex:1">
        <div style="font-family:'Cinzel',serif;font-size:12px;color:var(--cream)">${egg.name}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:${egg.cost===0?'var(--green2)':'var(--gold2)'}">${egg.costLabel}</div>
        <div style="display:flex;gap:4px;margin-top:5px;flex-wrap:wrap">
          ${egg.odds.map((o,ri)=>`<span style="font-size:8px;color:${RARITIES[ri].hex};${egg.targeted&&ri===egg.targetRar?'font-weight:700;text-decoration:underline':''}">${RARITIES[ri].name.slice(0,3)} ${o}%</span>`).join('<span style="color:var(--cream3)">·</span>')}
        </div>
      </div>
      <button class="btn ${egg.cost===0?'btn-ghost':'btn-gold'}" style="font-size:10px" ${affordable?'':'disabled'} onclick="doHatch(${slotIdx},'${egg.id}')">${egg.cost===0?'Utiliser':'Acheter'}</button>
    </div>`;
  }

  body.innerHTML = `
    <div style="font-size:11px;color:var(--cream2);margin-bottom:12px">
      Plus l'œuf est cher, meilleures sont les chances — mais le gain reste marginal. ${sl.free?'<span style="color:var(--green2)">Ce slot est gratuit : tu peux quand même payer pour un œuf de meilleure qualité.</span>':''}
    </div>
    <div style="font-family:'Cinzel',serif;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--cream2);margin-bottom:6px">Œufs standards</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
      ${standardEggs.map((egg)=>eggRow(egg)).join('')}
    </div>
    <div style="font-family:'Cinzel',serif;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--blue2);margin-bottom:6px">🎯 Œufs ciblés — boost une rareté, les autres baissent</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${targetedEggs.map((egg)=>eggRow(egg)).join('')}
    </div>`;
  OM('hatch-modal');
}

// ═══ TIRAGE PARTAGÉ — utilisé par l'éclosion via slot ET l'achat instantané ═══
function rollAndCreatePet(eggType){
  const odds = eggType.odds;
  const roll=Math.random()*100;let cum=0,rar=0;
  for(let i=0;i<odds.length;i++){cum+=odds[i];if(roll<=cum){rar=i;break;}}
  eggTypesUsed.add(eggType.id);
  totalHatched++; // compteur à vie, jamais remis à 0 (voir companions.economy.js)

  // ═══ PITY COUNTER ═══ Garantit un Ancestral après trop de malchance cumulée
  hatchCountSincePity++;
  let pityTriggered=false;
  if(rar<5 && hatchCountSincePity>=PITY_THRESHOLD){
    rar=5; pityTriggered=true; pityEverTriggered=true;
  }
  if(rar===5) hatchCountSincePity=0;

  const candidates=PET_CATALOG.filter(c=>Math.abs(c.rar-rar)<=1);
  const cat=candidates[Math.floor(Math.random()*candidates.length)];
  const stats=mkStats(rar);
  const np={id:petId++,cat,rar,stats,hunger:100,terrain:false,tier:1,tierXp:0,tierMult:rollTierMult(1)};
  return {pet:np, pityTriggered};
}

function doHatch(slotIdx, eggTypeId){
  const eggType = EGG_TYPES.find(e=>e.id===eggTypeId) || EGG_TYPES[0];
  if(SILVER < eggType.cost){ toast('❌','Silver insuffisant'); return; }
  spendSilver(eggType.cost);
  updateSilverDisplay();

  const {pet:np, pityTriggered} = rollAndCreatePet(eggType);
  const rar = np.rar, cat = np.cat;
  const sec=secById(cat.sec);
  const gs=normGS(np),pct=gsPct(np);
  const titleEl2 = document.querySelector('#hatch-modal .modal > div[style*="Cinzel"]');
  if(titleEl2) titleEl2.textContent = pityTriggered ? '🎁 Pity déclenché — Ancestral garanti !' : '✨ Familier éclos !';
  document.getElementById('hatch-body').innerHTML=`
    <div style="text-align:center;margin-bottom:12px">
      <canvas id="hcv" width="80" height="80" style="width:80px;height:80px;image-rendering:pixelated"></canvas>
    </div>
    <div style="text-align:center;font-size:9px;color:${rc(rar)};letter-spacing:.1em;text-transform:uppercase;margin-bottom:2px">${cat.orig.toUpperCase()} · ${cat.typ} · ${eggType.ico} ${eggType.name}</div>
    <div style="text-align:center;font-family:'Cinzel',serif;font-size:19px;color:var(--cream);margin-bottom:2px">${cat.name}</div>
    <div style="text-align:center;font-size:11px;color:var(--cream2);margin-bottom:10px">${sec?.ico} ${sec?.name} · ${rn(rar)}</div>
    <div style="display:flex;justify-content:center;gap:8px;margin-bottom:12px">
      <span class="gs-badge ${gsCls(pct)}">GS ${gs} / 1000</span>
      <span style="font-size:10px;color:var(--cream2)">${pct}% du max ${rn(rar)}</span>
    </div>
    <div style="margin-bottom:8px">${renderTierBlock(np)}${renderStatBars(np)}</div>
    <div style="display:flex;gap:7px;margin-top:12px">
      <button class="btn btn-gold" onclick="window._np.terrain=false;PETS.push(window._np);incubSlots[${slotIdx}].ready=false;incubSlots[${slotIdx}].tl=scaleTimer(21600);renderAll();CM('hatch-modal');toast('🥚','${cat.name} ajouté !')">Garder</button>
      <button class="btn btn-ghost" onclick="PETS.forEach(p=>{if(p.cat.sec===window._np.cat.sec)p.terrain=false});window._np.terrain=true;PETS.push(window._np);incubSlots[${slotIdx}].ready=false;incubSlots[${slotIdx}].tl=scaleTimer(21600);renderAll();CM('hatch-modal');toast('🌿','${cat.name} déployé !')">Déployer</button>
    </div>`;
  window._np=np;
  OM('hatch-modal');
  setTimeout(()=>{const c=document.getElementById('hcv');if(c)drawPixelArt(c,cat.art,80,rc(rar),np.tier||1);},40);
  incubSlots[slotIdx].ready=false;incubSlots[slotIdx].tl=scaleTimer(21600);
  renderHatch();
}

// ═══ ÉCLOSION INSTANTANÉE — ×1/×5/×10, indépendant des créneaux d'incubation ═══
function bulkHatch(eggTypeId, qty){
  const eggType = EGG_TYPES.find(e=>e.id===eggTypeId) || EGG_TYPES[0];
  const totalCost = eggType.cost * qty;
  if(SILVER < totalCost){ toast('❌',`Silver insuffisant (${totalCost.toLocaleString('fr-FR')} requis)`); return; }
  spendSilver(totalCost);
  updateSilverDisplay();

  const results = [];
  let anyPity = false;
  for(let i=0;i<qty;i++){
    const {pet, pityTriggered} = rollAndCreatePet(eggType);
    PETS.push(pet);
    results.push(pet);
    if(pityTriggered) anyPity = true;
  }

  // Résumé par rareté
  const tally = [0,0,0,0,0,0];
  results.forEach(p=>tally[p.rar]++);
  const summaryParts = RARITIES.map((r,i)=>tally[i]>0?`<span style="color:${r.hex}">${tally[i]}× ${r.name}</span>`:null).filter(Boolean).join(' · ');

  renderAll();
  showBulkHatchModal(eggType, results, tally, anyPity);
  addGameLog(`🥚 Éclosion ×${qty} (${eggType.name}) : ${summaryParts}`);
}

function showBulkHatchModal(eggType, results, tally, anyPity){
  const titleEl = document.querySelector('#hatch-modal .modal > div[style*="Cinzel"]');
  if(titleEl) titleEl.textContent = anyPity ? `🎁 Éclosion ×${results.length} — Pity déclenché !` : `✨ Éclosion ×${results.length} terminée !`;

  document.getElementById('hatch-body').innerHTML = `
    <div style="font-size:11px;color:var(--cream2);margin-bottom:12px">${eggType.ico} ${eggType.name} × ${results.length}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
      ${RARITIES.map((r,i)=>tally[i]>0?`<span style="background:${r.hex}22;border:1px solid ${r.hex}55;border-radius:5px;padding:4px 10px;font-size:11px;color:${r.hex}">${tally[i]}× ${r.name}</span>`:'').join('')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:8px;max-height:280px;overflow-y:auto;margin-bottom:14px">
      ${results.map((p,i)=>`
        <div style="background:var(--s3);border:1px solid ${rc(p.rar)}55;border-radius:7px;padding:6px;text-align:center">
          <canvas id="bh-cv-${i}" width="44" height="44" style="width:44px;height:44px;image-rendering:pixelated"></canvas>
          <div style="font-size:8px;color:${rc(p.rar)};margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.cat.name}</div>
        </div>`).join('')}
    </div>
    <button class="btn btn-gold" style="width:100%" onclick="CM('hatch-modal')">Continuer</button>
  `;
  OM('hatch-modal');
  results.forEach((p,i)=>{
    setTimeout(()=>{const c=document.getElementById('bh-cv-'+i);if(c)drawPixelArt(c,p.cat.art,44,rc(p.rar),p.tier||1);},30);
  });
}
