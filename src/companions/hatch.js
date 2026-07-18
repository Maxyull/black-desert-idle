// ═══ TABS & PETITS UTILITAIRES D'UI ═════════════════════════════
/** @param {number} i - index d'onglet (0-11). Bascule l'onglet actif et déclenche le render/dispose lazy propre à chaque onglet (viewers 3D montés/libérés uniquement quand leur onglet est visible). */
function ST(i){
  document.querySelectorAll('.tab').forEach((t,j)=>t.classList.toggle('active',i===j));
  // onglet Viewer 3D (ancien p10) RETIRÉ (2026-07-18, demande explicite : "enleve le viewer 3D") --
  // c'était un écran de test du pipeline GLB ; le rendu 3D reste dispo via le preview d'un pet
  // (open3dPreviewModal, viewer3d.js). Marché passe à l'index 10, Tutoriel à 11.
  ['p5','p0','p1','p2','p3','p4','p6','p7','p8','p9','p11','p12'].forEach((id,j)=>{const el=document.getElementById(id);if(el)el.classList.toggle('active',i===j);});
  // bug corrigé (2026-07-20, rapporté explicitement : "timer qui se met pas a jour, on ne peut
  // pas acheter les oeufs") -- ST(1) (onglet Éclosion) n'appelait jamais renderHatch() : le tick
  // (ticks.js) décrémente bien sl.tl/passe sl.ready à true en mémoire chaque seconde,
  // mais SEUL renderHatch() régénère le DOM de #incub-slots (compte à rebours affiché + bouton
  // "Éclore" qui n'apparaît que si sl.ready). Sans cet appel, un joueur qui ouvrait l'onglet AVANT
  // qu'un slot devienne prêt ne voyait jamais le bouton apparaître (il fallait quitter l'onglet et
  // y revenir -- ce qui ne redéclenchait rien non plus, d'où le symptôme "je ne peux pas acheter
  // d'œuf"). Voir aussi ticks.js qui appelle désormais renderHatch() en direct tant que
  // cet onglet reste actif, pour que le compte à rebours bouge vraiment sans changer d'onglet.
  if(i===1) renderHatch();
  // bug corrigé (2026-07-11, rapporté explicitement : "GS different entre deploye sur le terrain
  // et en Reserve") -- même classe de bug que le correctif ST(1) ci-dessus : ST(2)/ST(3) ne
  // rappelaient JAMAIS renderSecDetail()/renderGrid() au changement d'onglet. Un tier-up (donc un
  // nouveau GS) qui arrive dans ticks.js pendant que Sections/Collection n'est PAS l'onglet actif
  // ne re-rend que l'onglet réellement actif à ce moment-là (voir ticks.js) -- revenir sur
  // Sections/Collection ensuite affichait donc un GS périmé jusqu'à la prochaine action qui
  // déclenche un renderAll() complet (déployer/fusionner...).
  if(i===2){ renderSecNav(); renderSecDetail(); }
  if(i===3){ renderFilters(); renderGrid(); }
  if(i===5) renderIndex();
  if(i===0) renderGameView();
  if(i===6) startHardinage();
  if(i===7) renderAchievements();
  if(i===8){ renderPvp(); if(typeof refreshPvpTournamentState==='function') refreshPvpTournamentState(); }
  if(i===9) renderMyStatsAndLeaderboard();
  if(i===10 && typeof renderMarketTab==='function') renderMarketTab();
  if(i===11 && typeof renderTutorial==='function') renderTutorial();
  // onglet de test Viewer 3D retiré (2026-07-18) -- plus d'init/dispose du renderer de test ici.
  // Le rendu 3D d'un pet passe désormais uniquement par sa modale de preview (open3dPreviewModal,
  // viewer3d.js), qui gère son propre cycle de vie WebGL.
  // carte terrain en 3D (2026-07-10) : même principe -- libère le contexte WebGL dès qu'on quitte
  // l'onglet Sections (i===2), voir updateTerrainViewer3d()/disposeTerrainViewer3dIfActive()
  // (sections.js).
  if(i!==2 && typeof disposeTerrainViewer3dIfActive==='function') disposeTerrainViewer3dIfActive();
}
/** Affiche une notification toast éphémère (auto-retirée après ~2.9s). @param {string} ico - emoji. @param {string} msg - texte. */
function toast(ico,msg){const w=document.getElementById('toast-wrap');const t=document.createElement('div');t.className='toast';t.innerHTML=`<span style="font-size:15px">${ico}</span><span>${msg}</span>`;w.appendChild(t);setTimeout(()=>t.remove(),2900);}
/** Ouvre une modale (ajoute la classe 'open'). @param {string} id - id DOM de la modale. */
function OM(id){document.getElementById(id).classList.add('open');}
/** Ferme une modale (retire la classe 'open'). @param {string} id - id DOM de la modale. */
function CM(id){document.getElementById(id).classList.remove('open');}
/** @param {number} s - secondes restantes. @returns {string} 'PRÊT' si ≤0, sinon durée formatée HH:MM:SS. */
function fmtT(s){if(s<=0)return i18next.t('companions:companions.common.ready');s=Math.floor(s);return`${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor(s%3600/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}

// ═══ HATCH ═══════════════════════════════════════════════════════
// achat/déblocage de slot d'incubation (2026-07-20, bug rapporté explicitement : "impossible
// d'acheter les slots d'oeuf") -- DEUX boutons étaient des impasses : le slot verrouillé
// (incubSlots[2].locked, voir roster.js) n'avait AUCUN onclick, et le bouton "➕ slot
// premium" ne faisait qu'un toast() factice sans jamais rien acheter. Les deux appellent
// maintenant spendSilver() (economy.js) puis déclenchent une vraie action.
// ÉCHELLE DE SLOTS (2026-07-18, demande explicite : "5 slots, 2 gratuits puis 1M/10M/100M") --
// 5 slots FIXES (roster.js), les 2 premiers gratuits d'emblée, les 3 suivants déblocables dans
// l'ORDRE contre un coût qui décuple à chaque palier. Plus de "buyExtraIncubSlot" (l'ancien modèle
// poussait des slots à l'infini jusqu'à un plafond de 8) : le tableau incubSlots contient déjà les
// 5 slots, les verrouillés se débloquent sur place via unlockIncubSlot().
const FREE_INCUB_SLOTS = 2;
const SLOT_UNLOCK_COSTS = [1000000, 10000000, 100000000]; // slots 3/4/5 (index 2/3/4), avant scaleCost()
const MAX_INCUB_SLOTS = FREE_INCUB_SLOTS + SLOT_UNLOCK_COSTS.length; // 5
/** @param {number} i - index du slot verrouillé (>= FREE_INCUB_SLOTS). @returns {number} coût de déblocage réel (1M/10M/100M selon l'index, passé par scaleCost). */
function slotUnlockCost(i){
  const raw = SLOT_UNLOCK_COSTS[i - FREE_INCUB_SLOTS] ?? SLOT_UNLOCK_COSTS[SLOT_UNLOCK_COSTS.length-1];
  return scaleCost(raw);
}
/** @param {number} i - index du slot verrouillé. Débloque le slot contre slotUnlockCost(i) ; ladder séquentiel (le slot précédent doit déjà être débloqué), no-op si silver insuffisant. */
function unlockIncubSlot(i){
  if(i>FREE_INCUB_SLOTS && incubSlots[i-1] && incubSlots[i-1].locked) return; // ladder : débloquer dans l'ordre
  const cost = slotUnlockCost(i);
  if(SILVER < cost){ toast('❌',i18next.t('companions:companions.hatch.insufficient_silver')); return; }
  spendSilver(cost);
  incubSlots[i] = { free:false, tl:0, tot:scaleTimer(21600), ready:true };
  toast('🔓',i18next.t('companions:companions.hatch.slot_unlocked'));
  renderHatch();
}
/** Reconstruit l'onglet Éclosion : slots d'incubation (verrouillé/en cours/prêt), grille comparative des odds par rareté×type d'œuf, bonus de rareté, historique des 10 derniers pets obtenus. */
function renderHatch(){
  // "Éclore tout" (2026-07-18) : visible seulement quand AU MOINS 2 slots sont prêts (pour 1 seul,
  // le bouton "Éclore" du slot suffit et laisse choisir l'œuf ; "tout" utilise l'œuf Basique).
  const hatchAllBtn = document.getElementById('hatch-all-btn');
  if(hatchAllBtn) hatchAllBtn.style.display = incubSlots.filter(s=>s.ready).length >= 2 ? '' : 'none';
  // Slots
  document.getElementById('incub-slots').innerHTML=incubSlots.map((sl,i)=>{
    if(sl.locked){
      // ladder : seul le PROCHAIN slot verrouillé (le précédent déjà débloqué) est cliquable ; les
      // suivants restent grisés et montrent leur prix (1M/10M/100M) sans être achetables d'avance.
      const cost=slotUnlockCost(i);
      const isNext = i===FREE_INCUB_SLOTS || (incubSlots[i-1] && !incubSlots[i-1].locked);
      const affordable = isNext && SILVER>=cost;
      return`<div class="isl locked" style="cursor:${affordable?'pointer':'not-allowed'};opacity:${isNext?(affordable?1:.6):.4}" ${isNext?`onclick="unlockIncubSlot(${i})"`:''}><span style="font-size:28px">🔒</span><div style="font-size:8px;color:var(--cream3)">${costLabelFor(cost)}</div></div>`;
    }
    // slot VIDE (2026-07-18) : après une éclosion, le slot ne se remplit plus tout seul -- le joueur
    // choisit l'œuf à y mettre (openEggChoice -> startIncubation, paiement + minuteur au départ).
    if(sl.empty)return`<div class="isl" style="cursor:pointer;justify-content:center" onclick="openEggChoice(${i})"><span style="font-size:28px;opacity:.5">➕</span>${sl.free?'<span style="font-size:8px;color:var(--green2);background:rgba(111,220,111,.1);border:1px solid rgba(111,220,111,.3);border-radius:3px;padding:1px 4px">'+i18next.t('companions:companions.hatch.free_badge')+'</span>':''}<div style="font-size:8px;color:var(--gold2)">${i18next.t('companions:companions.hatch.choose_egg_btn')}</div></div>`;
    const eggIco = (EGG_TYPES.find(e=>e.id===sl.eggId) || EGG_TYPES[0]).ico;
    if(sl.ready)return`<div class="isl ready"><div style="position:relative"><span style="font-size:28px">${eggIco}</span><div style="position:absolute;inset:-6px;border-radius:50%;background:radial-gradient(circle,rgba(111,220,111,.4),transparent);animation:eglaur 1s ease-in-out infinite"></div></div>${sl.free?'<span style="font-size:8px;color:var(--green2);background:rgba(111,220,111,.1);border:1px solid rgba(111,220,111,.3);border-radius:3px;padding:1px 4px">'+i18next.t('companions:companions.hatch.free_badge')+'</span>':''}<div class="itimer done">${i18next.t('companions:companions.hatch.ready_badge')}</div><button style="font-family:Cinzel,serif;font-size:9px;padding:4px 12px;border-radius:4px;border:1px solid var(--gold);background:linear-gradient(135deg,var(--gold-dim),var(--gold));color:var(--bg);cursor:pointer;margin-top:2px" onclick="doHatch(${i})">${i18next.t('companions:companions.hatch.hatch_btn')}</button></div>`;
    const pct=Math.round((1-sl.tl/sl.tot)*100);
    return`<div class="isl">${sl.free?'<span style="font-size:8px;color:var(--green2);background:rgba(111,220,111,.1);border:1px solid rgba(111,220,111,.3);border-radius:3px;padding:1px 4px">'+i18next.t('companions:companions.hatch.free_badge')+'</span>':''}<span style="font-size:28px">${eggIco}</span><div class="itimer">${fmtT(sl.tl)}</div><div class="iprog"><div class="iprog-fill" style="width:${pct}%"></div></div></div>`;
  }).join('');
  // Odds
  // Grille comparative : Rareté × Type d'œuf
  const PERIOD_DAYS = {2:7, 3:14, 4:21, 5:30}; // Rare→semaine, Épique→2sem, Légendaire→3sem, Ancestral→mois
  let tableHtml = `<table style="border-collapse:collapse;font-size:11px;min-width:520px">
    <thead><tr>
      <th style="padding:6px 10px;text-align:left;color:var(--cream2);border-bottom:1px solid var(--border)">${i18next.t('companions:companions.hatch.col_rarity')}</th>
      ${EGG_TYPES.map(e=>`<th style="padding:6px 10px;color:var(--gold);border-bottom:1px solid var(--border);font-family:'Cinzel',serif;font-size:10px">
        ${e.ico} ${eggName(e)}<div style="font-size:8px;color:var(--cream3);font-weight:400">${e.costLabel}</div>
      </th>`).join('')}
    </tr></thead><tbody>`;

  RARITIES.forEach((r,ri)=>{
    const period = PERIOD_DAYS[ri];
    tableHtml += `<tr>
      <td style="padding:6px 10px;color:${r.hex};font-family:'Cinzel',serif;border-bottom:1px solid var(--border)">${rn(ri)}${period?`<div style="font-size:8px;color:var(--cream3);font-weight:400">${i18next.t('companions:companions.hatch.target_label', {period:i18next.t(COMPANIONS_NS_PREFIX+'companions.hatch.period_'+(period===7?'1w':period===14?'2w':period===21?'3w':'1m'))})}</div>`:''}</td>
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
  // Chances de TIER à l'éclosion (T1→T5 × œuf) -- 2026-07-18, demande explicite : "chance d'éclore
  // un tier 1 à 5 selon l'œuf". Même mise en page que la table de rareté, alimentée par tierOdds.
  const tierEl = document.getElementById('tier-odds-table');
  if(tierEl){
    let tierTableHtml = `<table style="border-collapse:collapse;font-size:11px;min-width:520px">
      <thead><tr>
        <th style="padding:6px 10px;text-align:left;color:var(--cream2);border-bottom:1px solid var(--border)">${i18next.t('companions:companions.hatch.col_tier')}</th>
        ${EGG_TYPES.map(e=>`<th style="padding:6px 10px;color:var(--gold);border-bottom:1px solid var(--border);font-family:'Cinzel',serif;font-size:10px">${e.ico} ${eggName(e)}</th>`).join('')}
      </tr></thead><tbody>`;
    for(let t=0;t<5;t++){
      tierTableHtml += `<tr>
        <td style="padding:6px 10px;font-family:'Cinzel',serif;border-bottom:1px solid var(--border);color:${t>=3?'var(--gold)':'var(--cream2)'}">T${t+1}</td>
        ${EGG_TYPES.map(egg=>{
          const pct = (egg.tierOdds && egg.tierOdds[t]!=null) ? egg.tierOdds[t] : (t===0?100:0);
          return `<td style="padding:6px 10px;text-align:center;font-family:'JetBrains Mono',monospace;border-bottom:1px solid var(--border);color:var(--cream)">${pct}%</td>`;
        }).join('')}
      </tr>`;
    }
    tierTableHtml += `</tbody></table>`;
    tierEl.innerHTML = tierTableHtml;
  }
  // Rarity bonus
  document.getElementById('rarity-table').innerHTML=RARITIES.map((r,i)=>`<div style="display:flex;align-items:center;gap:5px;margin-bottom:5px"><span style="font-size:9px;color:${r.hex};width:72px">${rn(i)}</span><div style="display:flex;gap:2px">${Array(5).fill(0).map((_,si)=>`<div style="width:10px;height:10px;border-radius:2px;background:${si<BONUS_COUNT[i]?r.hex:'var(--border)'}"></div>`).join('')}</div><span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--cream3)">${BONUS_COUNT[i]}</span></div>`).join('');
  // History
  document.getElementById('hist-grid').innerHTML=PETS.slice(0,10).map(p=>{
    const gs=normGS(p),pct=gsPct(p);
    return`<div style="background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;display:flex;align-items:center;gap:8px;cursor:pointer" onclick="ST(2)">
      <canvas id="hh${p.id}" width="40" height="40" style="width:40px;height:40px;image-rendering:pixelated;flex-shrink:0"></canvas>
      <div style="flex:1;min-width:0">
        <div style="font-size:11px;font-weight:500;color:var(--cream);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.cat.name}</div>
        <div style="margin-top:2px">${tierRarPill(p,'sm')}</div>
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
/** @param {number} slotIdx - index du slot d'incubation prêt. Ouvre la modale de choix d'œuf (standards + ciblés) pour ce slot. */
function openEggChoice(slotIdx){
  const sl=incubSlots[slotIdx];
  const body=document.getElementById('hatch-body');
  const modal=document.getElementById('hatch-modal');
  const titleEl = modal.querySelector('.modal > div[style*="Cinzel"]');
  if(titleEl) titleEl.textContent = i18next.t('companions:companions.hatch.egg_choice_title');

  const standardEggs = EGG_TYPES.filter(e=>!e.targeted);
  const targetedEggs = EGG_TYPES.filter(e=>e.targeted);

  function eggRow(egg,i){
    const affordable = SILVER>=egg.cost || (egg.cost===0);
    return `<div style="background:var(--s3);border:1px solid ${egg.targeted?'var(--blue2)':'var(--border)'};border-radius:9px;padding:10px 12px;display:flex;align-items:center;gap:12px;${affordable?'':'opacity:.45'}">
      <span style="font-size:26px">${egg.ico}</span>
      <div style="flex:1">
        <div style="font-family:'Cinzel',serif;font-size:12px;color:var(--cream)">${eggName(egg)}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:${egg.cost===0?'var(--green2)':'var(--gold2)'}">${egg.costLabel}</div>
        <div style="display:flex;gap:4px;margin-top:5px;flex-wrap:wrap">
          ${egg.odds.map((o,ri)=>`<span style="font-size:8px;color:${RARITIES[ri].hex};${egg.targeted&&ri===egg.targetRar?'font-weight:700;text-decoration:underline':''}">${rn(ri).slice(0,3)} ${o}%</span>`).join('<span style="color:var(--cream3)">·</span>')}
        </div>
      </div>
      <button class="btn ${egg.cost===0?'btn-ghost':'btn-gold'}" style="font-size:10px" ${affordable?'':'disabled'} onclick="startIncubation(${slotIdx},'${egg.id}')">${egg.cost===0?i18next.t('companions:companions.hatch.use_btn'):i18next.t('companions:companions.hatch.buy_btn')}</button>
    </div>`;
  }

  body.innerHTML = `
    <div style="font-size:11px;color:var(--cream2);margin-bottom:12px">
      ${i18next.t('companions:companions.hatch.egg_choice_hint')} ${sl.free?'<span style="color:var(--green2)">'+i18next.t('companions:companions.hatch.free_slot_note')+'</span>':''}
    </div>
    <div style="font-family:'Cinzel',serif;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--cream2);margin-bottom:6px">${i18next.t('companions:companions.hatch.standard_eggs')}</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
      ${standardEggs.map((egg)=>eggRow(egg)).join('')}
    </div>
    ${targetedEggs.length ? `<div style="font-family:'Cinzel',serif;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--blue2);margin-bottom:6px">${i18next.t('companions:companions.hatch.targeted_eggs')}</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${targetedEggs.map((egg)=>eggRow(egg)).join('')}
    </div>` : ''}`;
  OM('hatch-modal');
}

/**
 * Rappel compact des probabilités par rareté de l'œuf utilisé (2026-07-13, demande explicite :
 * "afficher % chance par palier à l'éclosion" -- les % étaient déjà visibles AVANT le clic
 * (openEggChoice()/eggRow() ci-dessus, sélection de l'œuf), mais disparaissaient ensuite : l'écran
 * de reveal (doHatch()) n'affichait plus jamais quelles étaient les chances de CET œuf précis une
 * fois le tirage fait. Réutilise egg.odds déjà calculé (aucune logique de calcul dupliquée ici).
 * @param {object} eggType - un des EGG_TYPES/TARGETED_EGG_DEFS, lit .odds[] et .id/.name/.ico.
 * @returns {string} HTML d'un petit tableau de rappel des odds par rareté.
 */
function renderEggOddsRecap(eggType){
  return `<div style="border-top:1px solid var(--border);margin-top:4px;padding-top:8px">
    <div style="font-size:9px;color:var(--cream3);text-align:center;margin-bottom:5px">${i18next.t('companions:companions.hatch.odds_recap_label', {egg:eggType.ico, name:eggName(eggType)})}</div>
    <div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap">
      ${eggType.odds.map((o,ri)=>`<span style="font-size:9px;color:${RARITIES[ri].hex};${eggType.targeted&&ri===eggType.targetRar?'font-weight:700;text-decoration:underline':''}">${rn(ri).slice(0,3)} ${o}%</span>`).join('<span style="color:var(--cream3)">·</span>')}
    </div>
  </div>`;
}

/**
 * Tirage partagé — utilisé par l'éclosion via slot ET l'achat instantané. Tire une rareté selon
 * la table d'odds de l'œuf, applique le pity (garantit un Ancestral après PITY_THRESHOLD hatchs
 * sans en obtenir), puis choisit une espèce dont la rareté catalogue est à ±1 de la rareté tirée
 * (l'espèce n'est donc pas toujours EXACTEMENT alignée sur p.rar — voir speciesForSectionAndRarity()
 * pour le cas différent d'une percée de rareté, qui elle réaligne toujours exactement).
 * @param {object} eggType - un des EGG_TYPES/TARGETED_EGG_DEFS, lit .odds[] (6 valeurs, une par
 *   rareté, sommant à 100) et .id.
 * @returns {{pet:object, pityTriggered:boolean}} pet = nouvelle instance (id/uid/cat/rar/stats/
 *   tier 1) ; pityTriggered = vrai si le pity a forcé la rareté à Ancestral (5) cette fois-ci.
 */
function rollAndCreatePet(eggType){
  const odds = eggType.odds;
  const roll=Math.random()*100;let cum=0,rar=0;
  for(let i=0;i<odds.length;i++){cum+=odds[i];if(roll<=cum){rar=i;break;}}
  eggTypesUsed.add(eggType.id);
  totalHatched++; // compteur à vie, jamais remis à 0 (voir economy.js)

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
  // tier de départ tiré selon l'œuf (2026-07-18, demande explicite : "chance d'éclore un tier 1 à 5
  // selon l'œuf") -- même tirage pondéré que la rareté ci-dessus, sur eggType.tierOdds (5 valeurs
  // T1→T5 sommant à 100). Repli T1 si l'œuf n'a pas de tierOdds (robustesse). Le tierMult est tiré
  // dans la plage du tier obtenu (rollTierMult), pas forcément T1.
  const tOdds=eggType.tierOdds;
  let startTier=1;
  if(tOdds){ const tr=Math.random()*100; let tc=0; for(let i=0;i<tOdds.length;i++){ tc+=tOdds[i]; if(tr<=tc){ startTier=i+1; break; } } }
  // uid stable cross-compte (2026-07-10, marché d'échange) -- distinct de `id` (local, jamais
  // envoyé au serveur) : c'est la clé qui identifie ce pet précis dans pet_trade_offers/deliveries,
  // doit survivre à un transfert d'un compte à l'autre (voir migratePetUidV1, save.js).
  const np={id:petId++,uid:crypto.randomUUID(),cat,rar,stats,hunger:100,terrain:false,tier:startTier,tierXp:0,tierMult:rollTierMult(startTier)};
  return {pet:np, pityTriggered};
}

/**
 * Roulette de rareté (2026-07-18, demande explicite : "roulette sur la rareté" à l'éclosion).
 * "Machine à sous" : défile les 6 raretés (rapide -> lent), décélère et s'ARRÊTE sur `finalRar`.
 * Pas de canvas/roue (le module n'a pas le composant React du jeu principal) : une rangée de chips,
 * on déplace une surbrillance. Purement visuel -- la rareté est DÉJÀ tirée (rollAndCreatePet),
 * cette animation ne fait que la révéler, comme la roue de boss du jeu principal.
 * @param {HTMLElement} container @param {number} finalRar - rareté sur laquelle s'arrêter (0-5).
 * @param {Function} onDone - appelé une fois posé sur finalRar.
 */
function spinRarityRoulette(container, finalRar, onDone){
  container.innerHTML = `<div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin:18px 0">
    ${RARITIES.map((r,i)=>`<div class="roul-cell" data-i="${i}" style="padding:7px 12px;border-radius:7px;border:2px solid transparent;font-family:'Cinzel',serif;font-size:11px;color:${r.hex};opacity:.3;transition:opacity .08s,transform .08s">${rn(i)}</div>`).join('')}
  </div>`;
  const cells = [...container.querySelectorAll('.roul-cell')];
  const N = RARITIES.length;
  const DURATION = 1900; // ms — durée totale, fixe
  const TRAVEL = 3*N + finalRar; // ~3 tours puis atterrit sur finalRar
  const start = performance.now();
  function highlight(idx){
    cells.forEach((c,k)=>{ const on=k===idx; c.style.opacity=on?'1':'.3'; c.style.borderColor=on?RARITIES[k].hex:'transparent'; c.style.transform=on?'scale(1.12)':'none'; });
  }
  // DÉCOUPLAGE (2026-07-18) : le VISUEL (défilement + décélération) est une boucle rAF best-effort,
  // mais le DÉCLENCHEUR du reveal est un SEUL setTimeout fiable (DURATION). Ainsi le reveal apparaît
  // TOUJOURS après DURATION même si les frames rAF sont throttlées/pausées (onglet non focus,
  // contexte headless...) -- l'animation ne doit jamais pouvoir "coincer" le joueur sur une roue qui
  // tourne. La garde offsetParent (modale fermée via Échap/clic) empêche le reveal de ré-ouvrir.
  function frame(now){
    if(!container.offsetParent) return; // modale fermée -> stoppe le visuel
    const t = Math.min(1, (now-start)/DURATION);
    if(t>=1){ highlight(finalRar); return; }
    highlight(Math.floor((1-Math.pow(1-t,3))*TRAVEL) % N);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  setTimeout(()=>{ if(container.offsetParent){ highlight(finalRar); if(onDone) onDone(); } }, DURATION);
}

/**
 * Éclosion via un slot d'incubation. NOUVEAU FLUX (2026-07-18, demande explicite) : le pet est
 * AJOUTÉ AU ROSTER IMMÉDIATEMENT (terrain=false, en réserve) dès le tirage -- Échap/clic/✕ ne le
 * perdent plus jamais (avant, fermer sans cliquer Garder/Déployer perdait le pet ET le silver). On
 * montre d'abord la roulette de rareté, puis le reveal (3D si modèle GLB, sinon pixel-art) avec un
 * bouton Déployer optionnel ; la fermeture ramène à la liste des slots.
 * @param {number} slotIdx - index du slot d'incubation prêt.
 * @param {string} eggTypeId - id de EGG_TYPES choisi.
 */
/** @param {number} slotIdx - index d'un slot VIDE. @param {string} eggId - œuf choisi. Paie le coût de l'œuf et démarre l'incubation (minuteur de 6h) avec cet œuf ; no-op si silver insuffisant ou slot non vide. */
function startIncubation(slotIdx, eggId){
  const sl = incubSlots[slotIdx];
  if(!sl || sl.locked || !sl.empty) return;
  const eggType = EGG_TYPES.find(e=>e.id===eggId) || EGG_TYPES[0];
  if(SILVER < eggType.cost){ toast('❌',i18next.t('companions:companions.hatch.insufficient_silver')); return; }
  spendSilver(eggType.cost);
  updateSilverDisplay();
  incubSlots[slotIdx] = { free: sl.free, eggId: eggType.id, tl: scaleTimer(21600), tot: scaleTimer(21600), ready: false };
  eggTypesUsed.add(eggType.id);
  closeHatchModal();
  renderHatch();
}

function doHatch(slotIdx){
  const sl = incubSlots[slotIdx];
  if(!sl || !sl.ready) return;
  // plafond de collection (2026-07-20, demande explicite : "Borner collection a 96 pets") -- si plein,
  // le slot RESTE prêt (rien n'est consommé : l'œuf a déjà été payé au démarrage de l'incubation).
  if(petRosterRoomLeft()<=0){ toast('📦',i18next.t('companions:companions.hatch.collection_full', {cap:PET_ROSTER_CAP})); return; }
  const eggType = EGG_TYPES.find(e=>e.id===sl.eggId) || EGG_TYPES[0];
  // plus de spendSilver ici : l'œuf a été payé à startIncubation() (2026-07-18, "paiement au départ").

  const {pet:np, pityTriggered} = rollAndCreatePet(eggType);
  np.terrain = false;
  PETS.push(np); // gardé d'office : plus jamais perdu à la fermeture
  // après éclosion le slot devient VIDE (plus d'œuf basique remis d'office, 2026-07-18) : le joueur
  // devra re-choisir un œuf pour relancer une incubation.
  incubSlots[slotIdx] = { free: sl.free, empty: true };
  window._np = np;

  const titleEl2 = document.querySelector('#hatch-modal .modal > div[style*="Cinzel"]');
  if(titleEl2) titleEl2.textContent = pityTriggered ? i18next.t('companions:companions.hatch.pity_title') : i18next.t('companions:companions.hatch.hatched_title');

  // 1) roulette de rareté, puis 2) reveal du pet
  const body = document.getElementById('hatch-body');
  body.innerHTML = '';
  OM('hatch-modal');
  spinRarityRoulette(body, np.rar, () => showHatchPetReveal(np, eggType));
  renderHatch();
}

/**
 * Reveal d'UN pet après la roulette (extrait de doHatch pour être réutilisable). Le pet est déjà
 * dans PETS (gardé) -- ce reveal ne fait qu'afficher + proposer le déploiement.
 * @param {object} np - le pet tiré (déjà poussé dans PETS). @param {object} eggType - œuf utilisé.
 */
function showHatchPetReveal(np, eggType){
  const rar = np.rar, cat = np.cat;
  const sec = secById(cat.sec);
  const gs = normGS(np), pct = gsPct(np);
  const modelUrl = typeof companionModelUrlFor==='function' ? companionModelUrlFor(np) : null;
  const petIdx = PETS.indexOf(np);
  document.getElementById('hatch-body').innerHTML=`
    <div style="text-align:center;margin-bottom:12px">
      ${modelUrl
        ? `<div id="hcv3d-anchor" style="width:120px;height:120px;margin:0 auto"></div>`
        : `<canvas id="hcv" width="80" height="80" style="width:80px;height:80px;image-rendering:pixelated"></canvas>`}
    </div>
    <div style="text-align:center;font-size:9px;color:${rc(rar)};letter-spacing:.1em;text-transform:uppercase;margin-bottom:2px">${cat.orig.toUpperCase()} · ${typeLabel(cat.typ)} · ${eggType.ico} ${eggName(eggType)}</div>
    <div style="text-align:center;font-family:'Cinzel',serif;font-size:19px;color:var(--cream);margin-bottom:4px">${cat.name}</div>
    <!-- Tier + Rareté MIS EN ÉVIDENCE (2026-07-18, "bien afficher Tier+rareté" + "sur quoi on s'est
         arrêté... avec des animations") : gros badge dans la couleur de rareté, pulsé à l'apparition. -->
    <div style="text-align:center;margin-bottom:8px">
      <span class="tierRarBadge" style="display:inline-block;font-family:'Cinzel',serif;font-size:15px;font-weight:700;color:${rc(rar)};background:${rc(rar)}1a;border:1.5px solid ${rc(rar)};border-radius:20px;padding:4px 16px">T${np.tier||1} · ${rn(rar)}</span>
    </div>
    <div style="text-align:center;font-size:10.5px;color:var(--cream2);margin-bottom:10px">${sec?.ico} ${secName(sec)}</div>
    <div style="display:flex;justify-content:center;gap:8px;margin-bottom:12px">
      <span class="gs-badge ${gsCls(pct)}">GS ${gs} / 1000</span>
      <span style="font-size:10px;color:var(--cream2)">${i18next.t('companions:companions.hatch.gs_of_max', {pct:pct, rarity:rn(rar)})}</span>
    </div>
    <div style="margin-bottom:8px">${renderTierBlock(np)}${renderStatBars(np)}</div>
    ${renderEggOddsRecap(eggType)}
    <div style="font-size:9px;color:var(--green2);text-align:center;margin-top:8px">${i18next.t('companions:companions.hatch.kept_hint')}</div>
    <div style="display:flex;gap:7px;margin-top:10px">
      <button class="btn btn-ghost" style="flex:1" onclick="deployHatchedPet(${petIdx})">🌿 ${i18next.t('companions:companions.hatch.deploy_btn')}</button>
      <button class="btn btn-gold" style="flex:1" onclick="closeHatchModal()">${i18next.t('companions:companions.hatch.continue_btn')}</button>
    </div>`;
  // animation d'entrée de la fiche (2026-07-18) : retrigger la classe .hatchPop (pop + fondu) pour
  // "bien afficher sur quoi on s'est arrêté" avec un effet visuel marqué à chaque reveal.
  const hbEl=document.getElementById('hatch-body');
  if(hbEl){ hbEl.classList.remove('hatchPop'); void hbEl.offsetWidth; hbEl.classList.add('hatchPop'); }
  if(modelUrl){
    const mount=()=>{
      const anchor=document.getElementById('hcv3d-anchor'); if(!anchor) return;
      const wrap=document.createElement('div'); wrap.style.width='120px'; wrap.style.height='120px';
      anchor.appendChild(wrap);
      hatchReveal3dState=createThreeViewer(wrap, ()=>{});
      hatchReveal3dState.loadModel(modelUrl);
    };
    if(typeof window.THREE==='undefined') window.addEventListener('three-ready', mount, { once:true });
    else mount();
  } else {
    setTimeout(()=>{const c=document.getElementById('hcv');if(c)drawPixelArt(c,cat.art,80,rc(rar),np.tier||1);},40);
  }
}

/** @param {number} petIdx - index dans PETS du pet fraîchement éclos. Le déploie sur le terrain (retire les autres pets de sa section du terrain), ferme la modale. */
function deployHatchedPet(petIdx){
  const np = PETS[petIdx]; if(!np) { closeHatchModal(); return; }
  PETS.forEach(p=>{ if(p.cat.sec===np.cat.sec) p.terrain=false; });
  np.terrain = true;
  disposeHatchReveal3d(); renderAll(); CM('hatch-modal');
  toast('🌿', i18next.t('companions:companions.hatch.deployed_toast', {name:np.cat.name}));
}

/**
 * "Éclore tout" (2026-07-18, demande explicite) : éclot d'un coup TOUS les slots prêts, chacun avec
 * l'œuf Basique gratuit. Les pets sont ajoutés au roster immédiatement (gardés), puis une roulette
 * de rareté joue avant de révéler tout le lot d'un coup (grille, réutilise showBulkHatchModal).
 * Respecte le plafond de collection : n'éclot que ce qui rentre.
 */
function hatchAll(){
  const readyIdx = incubSlots.map((sl,i)=>sl.ready?i:-1).filter(i=>i>=0);
  if(!readyIdx.length){ toast('🥚', i18next.t('companions:companions.hatch.nothing_ready')); return; }
  const room = petRosterRoomLeft();
  if(room<=0){ toast('📦', i18next.t('companions:companions.hatch.collection_full', {cap:PET_ROSTER_CAP})); return; }
  const toHatch = readyIdx.slice(0, room);
  // œuf d'affichage pour le récap (le lot peut mêler plusieurs œufs) : celui du 1er slot éclos.
  const eggType = EGG_TYPES.find(e=>e.id===incubSlots[toHatch[0]].eggId) || EGG_TYPES[0];
  const results = [];
  let anyPity = false;
  toHatch.forEach(i=>{
    // chaque slot éclot avec SON œuf (déjà payé au démarrage), pas un basique imposé.
    const et = EGG_TYPES.find(e=>e.id===incubSlots[i].eggId) || EGG_TYPES[0];
    const {pet, pityTriggered} = rollAndCreatePet(et);
    pet.terrain = false;
    PETS.push(pet);
    results.push(pet);
    if(pityTriggered) anyPity = true;
    incubSlots[i] = { free: incubSlots[i].free, empty: true }; // vide après éclosion (2026-07-18)
  });
  const tally=[0,0,0,0,0,0]; results.forEach(p=>tally[p.rar]++);
  // roulette globale (s'arrête sur la MEILLEURE rareté du lot, effet "jackpot"), puis grille
  const best = Math.max(...results.map(p=>p.rar));
  const titleEl = document.querySelector('#hatch-modal .modal > div[style*="Cinzel"]');
  if(titleEl) titleEl.textContent = anyPity ? i18next.t('companions:companions.hatch.bulk_title_pity', {count:results.length}) : i18next.t('companions:companions.hatch.bulk_title_done', {count:results.length});
  const body = document.getElementById('hatch-body');
  body.innerHTML = '';
  OM('hatch-modal');
  spinRarityRoulette(body, best, () => showBulkHatchModal(eggType, results, tally, anyPity));
  renderAll();
  addGameLog(i18next.t('companions:companions.hatch.bulk_log', {qty:results.length, egg:eggName(eggType), summary:RARITIES.map((r,i)=>tally[i]>0?`<span style="color:${r.hex}">${tally[i]}× ${rn(i)}</span>`:null).filter(Boolean).join(' · ')}));
}
// viewer 3D de la modale de reveal -- une seule éclosion à la fois (pas de tick qui réappelle
// doHatch en boucle contrairement à renderSecDetail, donc pas besoin du cache par clé de
// updateTerrainViewer3d() : juste un dispose propre à la fermeture, voir closeHatchModal().
let hatchReveal3dState = null;
/** Libère le viewer 3D de la modale de reveal d'éclosion s'il est actif. */
function disposeHatchReveal3d(){
  if(!hatchReveal3dState) return;
  hatchReveal3dState.dispose();
  hatchReveal3dState = null;
}
/** Ferme la modale d'éclosion et libère le viewer 3D de reveal associé. */
function closeHatchModal(){
  disposeHatchReveal3d();
  CM('hatch-modal');
}
// Fermeture Échap + clic sur le fond (2026-07-18, demande explicite : "echap ou clique on retourne
// sur liste des oeuf"). Sûr : le pet est ajouté à PETS DÈS le tirage (doHatch/hatchAll), fermer ne
// perd donc jamais rien -- contrairement à l'ancien flux où fermer sans cliquer Garder perdait le
// pet et le silver.
document.addEventListener('keydown', e=>{
  if(e.key==='Escape' && document.getElementById('hatch-modal')?.classList.contains('open')) closeHatchModal();
});
{ const _hbg=document.getElementById('hatch-modal'); if(_hbg) _hbg.addEventListener('click', e=>{ if(e.target===_hbg) closeHatchModal(); }); }

// ═══ RÉSUMÉ D'ÉCLOSION EN LOT ═══ (utilisé par « Éclore tout », hatchAll) ═══════════════════════
// L'ancienne éclosion instantanée payante ×1/×5/×10 (bulkHatch) a été SUPPRIMÉE (2026-07-18,
// demande explicite : "enlever l'achat multiple") -- on n'obtient plus un œuf qu'en éclosant un
// slot d'incubation prêt (doHatch/openEggChoice) ou via « Éclore tout ». showBulkHatchModal reste,
// réutilisée par hatchAll() pour afficher le récap d'un lot de slots éclos d'un coup.
/**
 * Affiche la modale de résumé d'une éclosion en masse (pas de reveal 3D volontairement — jusqu'à
 * 10 pets affichés en même temps dépasserait la limite de contextes WebGL du navigateur).
 * @param {object} eggType - type d'œuf utilisé. @param {object[]} results - pets obtenus.
 * @param {number[]} tally - compte par rareté. @param {boolean} anyPity - vrai si le pity a été déclenché dans ce lot.
 */
function showBulkHatchModal(eggType, results, tally, anyPity){
  const titleEl = document.querySelector('#hatch-modal .modal > div[style*="Cinzel"]');
  if(titleEl) titleEl.textContent = anyPity ? i18next.t('companions:companions.hatch.bulk_title_pity', {count:results.length}) : i18next.t('companions:companions.hatch.bulk_title_done', {count:results.length});

  document.getElementById('hatch-body').innerHTML = `
    <div style="font-size:11px;color:var(--cream2);margin-bottom:12px">${eggType.ico} ${eggName(eggType)} × ${results.length}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
      ${RARITIES.map((r,i)=>tally[i]>0?`<span style="background:${r.hex}22;border:1px solid ${r.hex}55;border-radius:5px;padding:4px 10px;font-size:11px;color:${r.hex}">${tally[i]}× ${rn(i)}</span>`:'').join('')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:8px;max-height:280px;overflow-y:auto;margin-bottom:14px">
      ${results.map((p,i)=>`
        <div style="background:var(--s3);border:1px solid ${rc(p.rar)}55;border-radius:7px;padding:6px;text-align:center">
          <canvas id="bh-cv-${i}" width="44" height="44" style="width:44px;height:44px;image-rendering:pixelated"></canvas>
          <div style="font-size:8px;color:${rc(p.rar)};margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.cat.name}</div>
        </div>`).join('')}
    </div>
    ${renderEggOddsRecap(eggType)}
    <button class="btn btn-gold" style="width:100%;margin-top:10px" onclick="closeHatchModal()">${i18next.t('companions:companions.hatch.continue_btn')}</button>
  `;
  // pas de reveal 3D ici volontairement (2026-07-10) : jusqu'à 10 pets affichés EN MÊME TEMPS dans
  // cette grille -- un contexte WebGL par carte dépasserait vite la limite du navigateur (~16, même
  // classe de bug que la Collection, voir CLAUDE.md companions §pièges). Le reveal 3D reste réservé
  // à doHatch() (une seule éclosion à la fois, voir hatchReveal3dState).
  OM('hatch-modal');
  results.forEach((p,i)=>{
    setTimeout(()=>{const c=document.getElementById('bh-cv-'+i);if(c)drawPixelArt(c,p.cat.art,44,rc(p.rar),p.tier||1);},30);
  });
}
