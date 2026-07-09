// ═══ HEADER ══════════════════════════════════════════════════════
function updateHeader(){
  const loot=terrainPet('loot'),xp=terrainPet('xp'),combat=terrainPet('combat');
  document.getElementById('h-col').textContent=loot?`+${(loot.stats[0]||0).toFixed(1)}%`:'—';
  document.getElementById('h-pa').textContent=combat?`+${(combat.stats[0]||0).toFixed(1)}`:'—';
  document.getElementById('h-exp').textContent=xp?`+${(xp.stats[0]||0).toFixed(1)}%`:'—';
  const streakEl=document.getElementById('h-streak');
  if(streakEl) streakEl.textContent=`${loginStreak}/7`;
  updateSilverDisplay();
}
function updateSilverDisplay(){
  const val = SILVER.toLocaleString('fr-FR');
  ['h-silver','game-silver-inline','coll-silver','coll-silver-2'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.textContent = val;
  });
}

// ═══ TICKS ═══════════════════════════════════════════════════════
setInterval(()=>{
  PETS.forEach(p=>{if(p.terrain&&p.hunger>0)p.hunger=Math.max(0,p.hunger-.1);});
  incubSlots.forEach(sl=>{if(!sl.locked&&!sl.ready&&sl.tl>0){sl.tl--;if(sl.tl<=0)sl.ready=true;}});
  if(eggTimer>0)eggTimer--;else eggTimer=21600;
  document.getElementById('h-egg').textContent=fmtT(eggTimer);
  const rdy=incubSlots.filter(s=>s.ready).length;
  document.getElementById('tb0').textContent=rdy?rdy+' prêt':'En cours';
  if(document.getElementById('autotog')?.classList.contains('on')){
    PETS.forEach(p=>{
      if(!p.terrain||p.hunger>=30) return;
      // Prend le premier objet nourrissant disponible dans l'inventaire, en priorité les plus faibles (économise les rares)
      const cheapestFood = Object.entries(INVENTORY).filter(([n,d])=>d.feed>0).sort((a,b)=>a[1].feed-b[1].feed)[0];
      if(!cheapestFood) return;
      const [name,food] = cheapestFood;
      p.hunger=Math.min(100,p.hunger+food.feed);
      food.qty--;
      if(food.qty<=0) delete INVENTORY[name];
    });
  }
  // Gain d'XP de Tier — seuls les pets sur le terrain, bien nourris, progressent
  PETS.forEach(p=>{
    if(!p.terrain||p.hunger<=10||(p.tier||1)>=5) return;
    p.tierXp=(p.tierXp||0)+2;
    const xpMax=tierXpMaxFor(p);
    if(xpMax!==null && p.tierXp>=xpMax){
      p.tier=(p.tier||1)+1;
      p.tierXp=0;
      p.tierMult=rollTierMult(p.tier); // nouveau tirage dans la plage du nouveau tier

      // ═══ BREAKTHROUGH DE RARETÉ ═══
      // Chaque montée de Tier a une petite chance de faire bondir la RARETÉ
      // d'un cran. Si ça arrive, le Tier repart TOUJOURS à T1 (la rareté supérieure
      // se mérite à nouveau depuis le début) — pourcentage volontairement très bas.
      const breakthrough = p.rar<5 && Math.random()<RARITY_BREAKTHROUGH_CHANCE;
      if(breakthrough){
        p.rar += 1;
        p.stats = mkStats(p.rar);   // stats retirées dans la fourchette de la nouvelle rareté
        p.tier = 1;
        p.tierXp = 0;
        p.tierMult = rollTierMult(1);
        breakthroughCount++;
        toast('🌟', `${p.cat.name} PERCE À TRAVERS ! Rareté → ${RARITIES[p.rar].name} (retour à Tier 1)`);
        addGameLog(`🌟 <span style="color:${rc(p.rar)}">${p.cat.name} atteint ${RARITIES[p.rar].name} par un coup de chance rarissime !</span> (Tier réinitialisé à 1)`);
      } else {
        toast('⬆️',`${p.cat.name} atteint Tier ${p.tier} ! (×${p.tierMult.toFixed(3)}, ${tierMultPct(p)}% de la plage)`);
      }

      if(document.getElementById('p1')?.classList.contains('active')) renderSecDetail();
      if(document.getElementById('p2')?.classList.contains('active')) renderGrid();
    }
  });
  // Génération de loot en tâche de fond — chaque pet sur le terrain a une chance de looter, même hors de l'onglet Jeu
  PETS.forEach(p=>{
    if(!p.terrain||p.hunger<=5) return;
    if(Math.random()>0.35) return; // ~35% de chance par tick (1s) par pet actif
    const sec=secById(p.cat.sec); if(!sec||!sec.drops) return;
    // Vitesse/qualité du pet influence légèrement la chance de tomber sur le drop rare
    const gsFactor = 1 + gsPct(p)/200; // jusqu'à +50% sur le drop le plus rare si bien roulé
    const roll = Math.random()*100;
    let drop;
    if(roll < 2*gsFactor) drop = sec.drops[2];      // rare
    else if(roll < 18*gsFactor) drop = sec.drops[1]; // peu commun
    else drop = sec.drops[0];                        // commun
    if(drop.silver){
      const amt = Math.floor(5+Math.random()*15);
      SILVER += amt;
      addGameLog(`${p.cat.name} a trouvé <span style="color:var(--gold)">+${amt} Silver</span>`);
    } else {
      addToInventory(drop.n, drop.e, 1, drop.feed);
      if(drop.v>=200) addGameLog(`${p.cat.name} a trouvé <span style="color:var(--r3)">${drop.e} ${drop.n}</span> !`);
    }
    if(document.getElementById('p5')?.classList.contains('active')){
      renderGameInventory(); renderGameLog(); updateSilverDisplay();
    }
    if(document.getElementById('p2')?.classList.contains('active')){
      renderCollInventory();
    }
  });

  // Loot spécial (Caphras / Dopi / Boss) — cadence exacte de 2s comme calculé
  specialTickCounter++;
  if(specialTickCounter>=2){
    specialTickCounter=0;
    PETS.forEach(p=>{
      if(!p.terrain||p.hunger<=5) return;
      const tf = zoneTierFactor(p); // T1=×1 ... T5=×5 — zone difficile = plus de Caphras/Dopi

      // Item de Boss — flat 1e-8, indépendant du tier (reste un événement rarissime)
      if(Math.random() < BOSS_ITEM_RATE){
        const boss = BOSS_ITEMS[p.cat.sec];
        if(boss){
          addToInventory(boss.n, boss.e, 1, 0);
          bossItemFound = true;
          addGameLog(`🌟 <span style="color:var(--r5)">${p.cat.name} a trouvé ${boss.e} ${boss.n} !!</span> ÉVÉNEMENT RARISSIME`);
          toast('🌟',`${boss.e} ${boss.n} trouvé par ${p.cat.name} !`);
        }
      }
      // Caphras — taux croissant avec le Tier (zone difficile)
      if(Math.random() < CAPHRAS_BASE_RATE*tf){
        addToInventory(CAPHRAS_ITEM.n, CAPHRAS_ITEM.e, 1, CAPHRAS_ITEM.feed);
        addGameLog(`${p.cat.name} a trouvé <span style="color:var(--r3)">${CAPHRAS_ITEM.e} ${CAPHRAS_ITEM.n}</span>`);
      }
      // Pierres de Dopi — 3 paliers, taux croissant avec le Tier, décroissant avec la force de la pierre
      DOPI_ITEMS.forEach(dopi=>{
        if(Math.random() < dopi.baseRate*tf){
          addToInventory(dopi.n, dopi.e, 1, dopi.feed);
          addGameLog(`${p.cat.name} a trouvé <span style="color:var(--r2)">${dopi.e} ${dopi.n}</span>`);
        }
      });
    });
    if(document.getElementById('p5')?.classList.contains('active')){
      renderGameInventory(); renderGameLog();
    }
    if(document.getElementById('p2')?.classList.contains('active')){
      renderCollInventory();
    }
  }
  checkAchievements();
},1000);
