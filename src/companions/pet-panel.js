// ═══ STAT BARS ═══════════════════════════════════════════════════
/** @param {object} pet - familier. @returns {string} HTML des barres de stat de sa section (verrouillées au-delà de BONUS_COUNT[pet.rar], bonus Caphras affiché à part). */
function renderStatBars(pet){
  const sec=secById(pet.cat.sec);if(!sec)return'';
  return`<div style="display:flex;flex-direction:column;gap:0">${sec.sk.map((k,i)=>{
    const active=i<BONUS_COUNT[pet.rar];
    const val=pet.stats[i]||0;
    const caphras=(pet.caphrasBonus||[])[i]||0;
    const[lo,hi]=STAT_RANGES[pet.rar][i];
    const pct=hi>lo?Math.round((val-lo)/(hi-lo)*100):0;
    return`<div style="display:grid;grid-template-columns:110px 1fr 65px 50px;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid var(--border);${!active?'opacity:.25;filter:grayscale(1)':''}">
      <div style="font-size:10px;color:var(--cream2);display:flex;align-items:center;gap:3px"><span style="font-size:8px;color:${active?rc(pet.rar):'var(--cream3)'}">${active?'●':'○'}</span>${k}</div>
      <div style="height:5px;background:var(--border);border-radius:3px;overflow:hidden">${active?`<div style="height:100%;width:${pct}%;background:linear-gradient(90deg,${rc(pet.rar)}88,${rc(pet.rar)});border-radius:3px"></div>`:''}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:10px;text-align:right;color:${active?rc(pet.rar):'var(--cream3)'}">${active?val:'—'}${caphras>0?`<span style="color:var(--r3)"> +${caphras.toFixed(1)}</span>`:''}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:9px;text-align:right;color:var(--cream3)">${active?'/'+hi:'lock'}</div>
    </div>`;
  }).join('')}</div>`;
}

// ═══ ATELIER DE CAPHRAS — vrai usage des pierres au-delà de la nourriture ═══
const CAPHRAS_COST_PER_UPGRADE = 3; // pierres consommées par tentative
const CAPHRAS_BOOST_AMOUNT = 0.6;   // gain de stat par tentative réussie
const CAPHRAS_MAX_BONUS_RATIO = 0.25; // plafond = 25% du max de la stat pour cette rareté

/** @param {object} pet - familier. @returns {string} HTML de l'atelier de Caphras : un bouton d'amélioration par stat active, désactivé si stock insuffisant ou stat déjà au plafond (25% du max). */
function renderCaphrasWorkshop(pet){
  const sec=secById(pet.cat.sec); if(!sec) return '';
  const stock = INVENTORY['Pierre de Caphras']?.qty || 0;
  const bonusCount = BONUS_COUNT[pet.rar];
  return `<div style="background:var(--s3);border:1px solid var(--r3);border-radius:7px;padding:9px 11px;margin-top:8px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <span style="font-family:'Cinzel',serif;font-size:10px;color:var(--r3)">🔺 Atelier de Caphras</span>
      <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--cream2)">Stock : ${stock}</span>
    </div>
    <div style="font-size:9px;color:var(--cream3);margin-bottom:7px">${CAPHRAS_COST_PER_UPGRADE} pierres → +${CAPHRAS_BOOST_AMOUNT} permanent sur une stat (plafond ${Math.round(CAPHRAS_MAX_BONUS_RATIO*100)}% du max).</div>
    <div style="display:flex;flex-wrap:wrap;gap:5px">
      ${sec.sk.slice(0,bonusCount).map((k,i)=>{
        const [lo,hi]=STAT_RANGES[pet.rar][i];
        const capMax = +(hi*CAPHRAS_MAX_BONUS_RATIO).toFixed(1);
        const current = (pet.caphrasBonus||[])[i]||0;
        const maxed = current>=capMax;
        const canAfford = stock>=CAPHRAS_COST_PER_UPGRADE;
        return `<button class="btn btn-ghost" style="font-size:9px;padding:4px 8px;${maxed||!canAfford?'opacity:.4;pointer-events:none':''}" onclick="upgradeCaphras(${pet.id},${i})">${k.split(' ')[0]} ${maxed?'(max)':`+${CAPHRAS_BOOST_AMOUNT}`}</button>`;
      }).join('')}
    </div>
  </div>`;
}

/** @param {number} petId - id du familier. @param {number} statIndex - index de la stat à améliorer. Consomme CAPHRAS_COST_PER_UPGRADE pierres pour +CAPHRAS_BOOST_AMOUNT permanent, plafonné à CAPHRAS_MAX_BONUS_RATIO du max de la stat. No-op si stock/plafond insuffisant. */
function upgradeCaphras(petId, statIndex){
  const p = PETS.find(pp=>pp.id===petId); if(!p) return;
  const stock = INVENTORY['Pierre de Caphras']?.qty || 0;
  if(stock < CAPHRAS_COST_PER_UPGRADE){ toast('❌','Pas assez de Pierres de Caphras'); return; }
  const [lo,hi] = STAT_RANGES[p.rar][statIndex];
  const capMax = +(hi*CAPHRAS_MAX_BONUS_RATIO).toFixed(1);
  if(!p.caphrasBonus) p.caphrasBonus=[0,0,0,0,0];
  if(p.caphrasBonus[statIndex]>=capMax){ toast('⚠️','Stat déjà au plafond de Caphras'); return; }

  INVENTORY['Pierre de Caphras'].qty -= CAPHRAS_COST_PER_UPGRADE;
  if(INVENTORY['Pierre de Caphras'].qty<=0) delete INVENTORY['Pierre de Caphras'];
  p.caphrasBonus[statIndex] = Math.min(capMax, +(p.caphrasBonus[statIndex]+CAPHRAS_BOOST_AMOUNT).toFixed(1));
  caphrasUpgradeCount++;

  toast('🔺', `${p.cat.name} amélioré ! +${CAPHRAS_BOOST_AMOUNT} permanent`);
  renderSecDetail();
  renderCollInventory();
}

// ═══ TIER BLOCK (badge + XP bar + comparaison) ═══════════════════
/** @param {object} pet - familier. @returns {string} HTML du bloc Tier : badge, multiplicateur réel tiré vs plage, barre d'XP de tier, comparaison GS avec la rareté supérieure. */
function renderTierBlock(pet){
  const tier=pet.tier||1;
  const mult=tierMultOf(pet); // valeur RÉELLEMENT tirée pour ce pet (pas une constante)
  const [mLo,mHi]=TIER_MULT_RANGE[tier-1];
  const mPct=tierMultPct(pet);
  const xpMax=tierXpMaxFor(pet);
  const xpPct=xpMax?Math.round((pet.tierXp||0)/xpMax*100):100;
  const cmp=comparisonBadge(pet);
  const tierDots=Array(5).fill(0).map((_,i)=>`<span style="display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:2px;background:${i<tier?'var(--gold)':'var(--border)'}"></span>`).join('');
  const mCls = mPct>=90?'var(--r5)':mPct>=65?'var(--gold)':mPct>=35?'var(--r2)':'var(--cream3)';

  return `<div style="background:var(--s3);border:1px solid var(--border);border-radius:7px;padding:9px 11px;margin-bottom:8px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <div style="display:flex;align-items:center;gap:7px">
        <span style="font-family:'Cinzel',serif;font-size:11px;color:var(--gold)">Tier ${tier}</span>
      </div>
      <div>${tierDots}</div>
    </div>
    <div style="display:grid;grid-template-columns:70px 1fr 55px 40px;align-items:center;gap:6px;margin-bottom:6px;padding:4px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:9px;color:var(--cream2)">Multiplic.</span>
      <div style="height:5px;background:var(--border);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${mPct}%;background:linear-gradient(90deg,var(--cream3),${mCls});border-radius:3px"></div>
      </div>
      <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:${mCls};text-align:right">×${mult.toFixed(3)}</span>
      <span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--cream3);text-align:right">${mPct}%</span>
    </div>
    <div style="font-size:8px;color:var(--cream3);margin-bottom:6px">Plage T${tier} : ×${mLo.toFixed(2)} – ×${mHi.toFixed(2)} (tirage aléatoire à chaque montée de tier)</div>
    ${xpMax?`<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <div style="flex:1;height:5px;background:var(--border);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${xpPct}%;background:linear-gradient(90deg,var(--gold-dim),var(--gold));border-radius:3px"></div>
      </div>
      <span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--cream3)">${pet.tierXp||0}/${xpMax} XP</span>
    </div>`:`<div style="font-size:9px;color:var(--gold2);margin-bottom:6px">✦ Tier maximum atteint</div>`}
    ${cmp?`<div style="font-size:10px;color:${cmp.beats?'var(--green2)':'var(--red2)'};display:flex;align-items:center;gap:5px">
      <span>${cmp.text}</span>
      <span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--cream3)">(${cmp.delta>=0?'+':''}${cmp.delta} GS)</span>
    </div>`:`<div style="font-size:9px;color:var(--cream3)">Rareté maximale — aucune comparaison au-dessus</div>`}
  </div>`;
}
