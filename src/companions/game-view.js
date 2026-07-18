// ═══ VUE DE JEU (personnage + pets actifs + inventaire) ══════════
/** Rafraîchit l'onglet Jeu (pets actifs, stats par section, inventaire, log, silver). */
function renderGameView(){
  renderGameCompanions();
  renderGameStats();
  renderGameInventory();
  renderGameLog();
  updateSilverDisplay();
}

/** Affiche les sprites des familiers actuellement sur le terrain (p.terrain), avec leur tier/multiplicateur. */
function renderGameCompanions(){
  const el = document.getElementById('game-companions');
  if(!el) return;
  const active = PETS.filter(p=>p.terrain);
  if(!active.length){
    el.innerHTML = `<div style="font-size:11px;color:var(--cream3);align-self:center">${i18next.t('companions:companions.game.no_active_pets')}</div>`;
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

/** Affiche une tuile par SECTIONS avec le bonus réel (stat×multiplicateur de tier) du pet actif sur cette section, vide si aucun. */
function renderGameStats(){
  const el = document.getElementById('game-stats-grid');
  if(!el) return;
  el.innerHTML = SECTIONS.map(s=>{
    const p = terrainPet(s.id);
    if(!p) return `<div style="background:var(--s3);border:1px solid var(--border);border-radius:7px;padding:8px 10px;opacity:.4">
      <div style="font-size:10px;color:var(--cream3)">${s.ico} ${secName(s)}</div>
      <div style="font-size:9px;color:var(--cream3)">${i18next.t('companions:companions.game.stat_no_pet')}</div>
    </div>`;
    const mult = tierMultOf(p);
    const val = ((p.stats[0]||0)*mult).toFixed(1);
    return `<div style="background:var(--s3);border:1px solid var(--border);border-radius:7px;padding:8px 10px">
      <div style="font-size:10px;color:var(--cream2)">${s.ico} ${secName(s)}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:14px;color:var(--green2)">+${val}</div>
      <div style="font-size:8px;color:var(--cream3)">${p.cat.name} · T${p.tier||1} (${tierMultPct(p)}%)</div>
    </div>`;
  }).join('');
}

/** Reconstruit la grille d'inventaire de l'onglet Jeu (INVENTORY complet). */
function renderGameInventory(){
  const el = document.getElementById('game-inventory-grid');
  if(!el) return;
  const items = Object.entries(INVENTORY);
  if(!items.length){
    el.innerHTML = `<div style="font-size:11px;color:var(--cream3)">${i18next.t('companions:companions.game.inventory_empty')}</div>`;
    return;
  }
  el.innerHTML = items.map(([name,data])=>{
    // valeur de revente (2026-07-18) : chaque item vendable montre sa valeur unitaire + un bouton 💰
    // qui vend toute la pile (sellItem, economy.js). Un item sans valeur (aucun aujourd'hui) n'aurait
    // simplement pas de bouton.
    const unit = typeof sellValueOf==='function' ? sellValueOf(name) : 0;
    const sellBtn = unit>0
      ? `<button onclick="sellItem('${name.replace(/'/g,"\\'")}')" title="${i18next.t('companions:companions.sell.sell_stack_title', {silver:(unit*data.qty).toLocaleString(NUM_LOCALE)})}" style="font-size:9px;padding:2px 6px;border-radius:4px;border:1px solid var(--gold);background:transparent;color:var(--gold2);cursor:pointer;flex-shrink:0">💰${unit.toLocaleString(NUM_LOCALE)}</button>`
      : '';
    return `<div style="background:var(--s3);border:1px solid var(--border);border-radius:6px;padding:6px 8px;display:flex;align-items:center;gap:6px">
      <span style="font-size:16px">${data.icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:9px;color:var(--cream);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${itemLabel(name)}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--gold)">×${data.qty}</div>
      </div>
      ${sellBtn}
    </div>`;
  }).join('');
  updateSilverDisplay();
}

/** Reconstruit la grille d'inventaire compacte de l'onglet Collection (même données que renderGameInventory, mise en page réduite). */
function renderCollInventory(){
  const el = document.getElementById('coll-inventory-grid');
  if(!el) return;
  const items = Object.entries(INVENTORY);
  if(!items.length){
    el.innerHTML = `<div style="font-size:10px;color:var(--cream3);grid-column:1/-1">${i18next.t('companions:companions.game.inventory_empty_short')}</div>`;
    return;
  }
  el.innerHTML = items.map(([name,data])=>`
    <div style="background:var(--s3);border:1px solid var(--border);border-radius:5px;padding:5px 6px;display:flex;align-items:center;gap:5px" title="${itemLabel(name)}">
      <span style="font-size:13px">${data.icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:8px;color:var(--cream);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${itemLabel(name)}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--gold)">×${data.qty}</div>
      </div>
    </div>`).join('');
  updateSilverDisplay();
}

/** Affiche les 20 dernières entrées de GAME_LOG (journal d'activité). */
function renderGameLog(){
  const el = document.getElementById('game-log');
  if(!el) return;
  if(!GAME_LOG.length){
    el.innerHTML = `<div style="font-size:10px;color:var(--cream3)">${i18next.t('companions:companions.game.no_activity')}</div>`;
    return;
  }
  el.innerHTML = GAME_LOG.slice(0,20).map(l=>`
    <div style="font-size:10px;color:var(--cream2);display:flex;gap:6px">
      <span style="font-family:'JetBrains Mono',monospace;color:var(--cream3)">${l.t}</span>
      <span>${l.text}</span>
    </div>`).join('');
}
