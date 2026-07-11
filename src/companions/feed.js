// ═══ FEED ════════════════════════════════════════════════════════
function renderFeed(){
  const hungry=PETS.filter(p=>p.terrain&&p.hunger<30).length;
  document.getElementById('tb3').textContent=hungry>0?hungry+'!':'✓';
  document.getElementById('tb3').className='tbadge'+(hungry>0?' alert':'');
  const hc=h=>h>60?'var(--green)':h>30?'var(--gold)':'var(--red)';
  document.getElementById('feed-list').innerHTML=PETS.map(p=>`
    <div class="fcard">
      <canvas id="fc${p.id}" width="38" height="38" style="width:38px;height:38px;image-rendering:pixelated;flex-shrink:0"></canvas>
      <div style="flex:1">
        <div style="font-size:11px;font-weight:500;color:var(--cream)">${p.cat.name}</div>
        <div style="font-size:9px;color:${rc(p.rar)};margin:1px 0">${rn(p.rar)} · ${secById(p.cat.sec)?.ico}</div>
        <div style="display:flex;align-items:center;gap:5px">
          <div class="fhbar"><div class="fhfill" style="width:${p.hunger}%;background:${hc(p.hunger)}"></div></div>
          <span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--cream2)">${Math.round(p.hunger)}</span>
        </div>
        <div style="font-size:9px;color:${p.hunger<30?'var(--red2)':p.terrain?'var(--green2)':'var(--cream3)'};margin-top:1px">${p.hunger<30?'⚠️ Affamé':p.terrain?'● Terrain':'○ Réserve'}</div>
      </div>
      <button class="btn btn-gold" style="font-size:9px;padding:3px 7px" onclick="feedOne(${p.id})">🍖</button>
    </div>`).join('');
  PETS.forEach(p=>{const c=document.getElementById('fc'+p.id);if(c)drawPixelArt(c,p.cat.art,38,null,p.tier||1);});

  // Nourriture = loot classique des sections (feed>0), EXCLU les ressources spéciales (Caphras/Dopi/Boss)
  // qui ont leur propre usage ailleurs (atelier de Caphras, futur craft...).
  const specialResourceNames = new Set([
    CAPHRAS_ITEM.n,
    ...DOPI_ITEMS.map(d=>d.n),
    ...Object.values(BOSS_ITEMS).map(b=>b.n),
  ]);
  const foodItems = Object.entries(INVENTORY).filter(([name,d])=>d.feed>0 && !specialResourceNames.has(name));
  const resourceItems = Object.entries(INVENTORY).filter(([name])=>specialResourceNames.has(name));

  const foodListEl = document.getElementById('food-list');
  if(!foodItems.length){
    foodListEl.innerHTML = `<div style="font-size:10px;color:var(--cream3);padding:8px">Aucune nourriture — déploie des pets dans Sections pour qu'ils loot de quoi nourrir tout le monde.</div>`;
  } else {
    // Sélection par défaut : premier objet dispo si rien n'est choisi ou si le choix précédent est épuisé
    if(!selFoodName || !INVENTORY[selFoodName] || INVENTORY[selFoodName].qty<=0 || specialResourceNames.has(selFoodName)){
      selFoodName = foodItems[0][0];
    }
    foodListEl.innerHTML = foodItems.map(([name,d])=>`
      <div class="food-row ${selFoodName===name?'sel':''}" onclick="selFoodName='${name.replace(/'/g,"\\'")}';renderFeed()">
        <span style="font-size:18px">${d.icon}</span>
        <div style="flex:1"><div style="font-size:11px;color:var(--cream)">${name}</div><div style="font-size:9px;color:var(--green2)">+${d.feed} faim</div></div>
        <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--cream2)">×${d.qty}</span>
      </div>`).join('');
  }

  // Ressources spéciales — affichage lecture seule (pas nourrissables, usage dédié ailleurs)
  const resEl = document.getElementById('resource-list');
  if(resEl){
    if(!resourceItems.length){
      resEl.innerHTML = `<div style="font-size:9px;color:var(--cream3)">Aucune ressource spéciale pour l'instant.</div>`;
    } else {
      resEl.innerHTML = resourceItems.map(([name,d])=>`
        <div style="display:flex;align-items:center;gap:7px;padding:5px 8px;background:var(--s3);border:1px solid var(--border);border-radius:6px;opacity:.85">
          <span style="font-size:15px">${d.icon}</span>
          <span style="flex:1;font-size:10px;color:var(--cream2)">${name}</span>
          <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--r3)">×${d.qty}</span>
        </div>`).join('');
    }
  }
}

function feedOne(id){
  const p=PETS.find(pp=>pp.id===id);if(!p)return;
  if(!selFoodName || !INVENTORY[selFoodName] || INVENTORY[selFoodName].qty<=0){
    toast('❌','Aucune nourriture disponible — va looter dans Sections');
    return;
  }
  const food = INVENTORY[selFoodName];
  p.hunger=Math.min(100,p.hunger+food.feed);
  food.qty--;
  if(food.qty<=0) delete INVENTORY[selFoodName];
  renderFeed();
  renderCollInventory();
  if(document.getElementById('p5')?.classList.contains('active')) renderGameInventory();
}

function feedAll(){
  const activePets = PETS.filter(p=>true); // tous, comme avant
  let fed=0;
  for(const p of activePets){
    if(!selFoodName || !INVENTORY[selFoodName] || INVENTORY[selFoodName].qty<=0) break;
    const food = INVENTORY[selFoodName];
    p.hunger=Math.min(100,p.hunger+food.feed);
    food.qty--;
    fed++;
    if(food.qty<=0){ delete INVENTORY[selFoodName]; selFoodName=null; }
  }
  renderFeed();
  renderCollInventory();
  if(document.getElementById('p5')?.classList.contains('active')) renderGameInventory();
  if(fed>0) toast('🍖',`${fed} familier(s) nourri(s) !`);
  else toast('❌','Aucune nourriture disponible — va looter dans Sections');
}
