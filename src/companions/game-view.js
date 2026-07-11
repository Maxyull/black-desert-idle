// ═══ VUE DE JEU (personnage + pets actifs + inventaire) ══════════
function renderGameView(){
  renderGameCompanions();
  renderGameStats();
  renderGameInventory();
  renderGameLog();
  updateSilverDisplay();
}

function renderGameCompanions(){
  const el = document.getElementById('game-companions');
  if(!el) return;
  const active = PETS.filter(p=>p.terrain);
  if(!active.length){
    el.innerHTML = `<div style="font-size:11px;color:var(--cream3);align-self:center">Aucun familier actif — déploie-en un depuis l'onglet Sections.</div>`;
    return;
  }
  el.innerHTML = active.map(p=>`
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
      <canvas id="gc-${p.id}" width="48" height="48" style="width:48px;height:48px;image-rendering:pixelated"></canvas>
      <div style="font-size:9px;color:${rc(p.rar)};max-width:60px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.cat.name}</div>
      <div style="font-size:8px;color:var(--gold);font-family:'Cinzel',serif">T${p.tier||1} (${tierMultPct(p)}%)</div>
    </div>`).join('');
  active.forEach(p=>{
    const c=document.getElementById('gc-'+p.id);
    if(c) drawPixelArt(c,p.cat.art,48,rc(p.rar),p.tier||1);
  });
}

function renderGameStats(){
  const el = document.getElementById('game-stats-grid');
  if(!el) return;
  el.innerHTML = SECTIONS.map(s=>{
    const p = terrainPet(s.id);
    if(!p) return `<div style="background:var(--s3);border:1px solid var(--border);border-radius:7px;padding:8px 10px;opacity:.4">
      <div style="font-size:10px;color:var(--cream3)">${s.ico} ${s.name}</div>
      <div style="font-size:9px;color:var(--cream3)">— aucun pet —</div>
    </div>`;
    const mult = tierMultOf(p);
    const val = ((p.stats[0]||0)*mult).toFixed(1);
    return `<div style="background:var(--s3);border:1px solid var(--border);border-radius:7px;padding:8px 10px">
      <div style="font-size:10px;color:var(--cream2)">${s.ico} ${s.name}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:14px;color:var(--green2)">+${val}</div>
      <div style="font-size:8px;color:var(--cream3)">${p.cat.name} · T${p.tier||1} (${tierMultPct(p)}%)</div>
    </div>`;
  }).join('');
}

function renderGameInventory(){
  const el = document.getElementById('game-inventory-grid');
  if(!el) return;
  const items = Object.entries(INVENTORY);
  if(!items.length){
    el.innerHTML = `<div style="font-size:11px;color:var(--cream3)">Inventaire vide — déploie des pets pour qu'ils commencent à looter.</div>`;
    return;
  }
  el.innerHTML = items.map(([name,data])=>`
    <div style="background:var(--s3);border:1px solid var(--border);border-radius:6px;padding:6px 8px;display:flex;align-items:center;gap:6px">
      <span style="font-size:16px">${data.icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:9px;color:var(--cream);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--gold)">×${data.qty}</div>
      </div>
    </div>`).join('');
  updateSilverDisplay();
}

function renderCollInventory(){
  const el = document.getElementById('coll-inventory-grid');
  if(!el) return;
  const items = Object.entries(INVENTORY);
  if(!items.length){
    el.innerHTML = `<div style="font-size:10px;color:var(--cream3);grid-column:1/-1">Inventaire vide.</div>`;
    return;
  }
  el.innerHTML = items.map(([name,data])=>`
    <div style="background:var(--s3);border:1px solid var(--border);border-radius:5px;padding:5px 6px;display:flex;align-items:center;gap:5px" title="${name}">
      <span style="font-size:13px">${data.icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:8px;color:var(--cream);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--gold)">×${data.qty}</div>
      </div>
    </div>`).join('');
  updateSilverDisplay();
}

function renderGameLog(){
  const el = document.getElementById('game-log');
  if(!el) return;
  if(!GAME_LOG.length){
    el.innerHTML = `<div style="font-size:10px;color:var(--cream3)">Aucune activité pour l'instant.</div>`;
    return;
  }
  el.innerHTML = GAME_LOG.slice(0,20).map(l=>`
    <div style="font-size:10px;color:var(--cream2);display:flex;gap:6px">
      <span style="font-family:'JetBrains Mono',monospace;color:var(--cream3)">${l.t}</span>
      <span>${l.text}</span>
    </div>`).join('');
}
