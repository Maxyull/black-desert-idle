// ═══ HARDINAGE — champ visuel animé avec les pets sur le terrain ═══
let hardinageStarted = false;
let hardFieldPets = []; // {pet, sprite, x,y,tx,ty,prog}
let hardSession = {items:0, silver:0, rare:0, legendary:0};
let hardLastTime = 0;

function startHardinage(){
  if(hardinageStarted){ initHardFieldPets(); return; }
  hardinageStarted = true;
  initHardField();
  renderHardSession();
  setInterval(triggerHardDrop, 1200);
}

function initHardFieldPets(){
  // Rafraîchit la liste des pets affichés (si on a changé de terrain depuis le dernier passage sur l'onglet)
  const active = PETS.filter(p=>p.terrain);
  hardFieldPets = active.map(p=>{
    const spriteCanvas = document.createElement('canvas');
    drawPixelArt(spriteCanvas, p.cat.art, 40, rc(p.rar), p.tier||1);
    return { pet:p, sprite:spriteCanvas, x:Math.random(), y:Math.random(), tx:Math.random(), ty:Math.random(), prog:1 };
  });
}

function initHardField(){
  const wrap = document.getElementById('hard-field-wrap');
  const canvas = document.getElementById('hard-field-canvas');
  if(!wrap||!canvas) return;
  canvas.width = wrap.offsetWidth || 700;
  canvas.height = wrap.offsetHeight || 500;
  initHardFieldPets();
  animateHardField(canvas);
}

function drawIsoFieldBg(ctx,W,H){
  ctx.clearRect(0,0,W,H);
  const TW=56,TH=30,COLS=16,ROWS=11;
  const sx=W/2, sy=H*0.12;
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const x=sx+(c-r)*TW/2, y=sy+(c+r)*TH/2;
      const even=(r+c)%2===0;
      ctx.beginPath();
      ctx.moveTo(x,y); ctx.lineTo(x+TW/2,y+TH/2); ctx.lineTo(x,y+TH); ctx.lineTo(x-TW/2,y+TH/2); ctx.closePath();
      ctx.fillStyle = even?'#0e0e20':'#0b0b1a'; ctx.fill();
      ctx.strokeStyle='#1a1a2e'; ctx.lineWidth=.6; ctx.stroke();
      const seed=(r*97+c*53)%211;
      if(seed%17===0 && r>0&&r<ROWS-1&&c>0&&c<COLS-1){
        ctx.fillStyle='#2a1a08'; ctx.fillRect(x-2,y-8,4,8);
        ctx.fillStyle='#0d2810'; ctx.beginPath(); ctx.moveTo(x,y-20); ctx.lineTo(x+8,y-5); ctx.lineTo(x-8,y-5); ctx.closePath(); ctx.fill();
        ctx.fillStyle='#123018'; ctx.beginPath(); ctx.moveTo(x,y-14); ctx.lineTo(x+5,y-4); ctx.lineTo(x-5,y-4); ctx.closePath(); ctx.fill();
      } else if(seed%23===0){
        ctx.fillStyle='#1e1e38'; ctx.beginPath(); ctx.ellipse(x,y-3,6,3.5,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#282848'; ctx.beginPath(); ctx.ellipse(x-1,y-4,3,1.8,-.3,0,Math.PI*2); ctx.fill();
      }
    }
  }
}

function animateHardField(canvas){
  const ctx = canvas.getContext('2d');
  function tick(ts){
    if(!document.getElementById('p6')?.classList.contains('active')){ requestAnimationFrame(tick); return; }
    if(ts-hardLastTime<60){ requestAnimationFrame(tick); return; }
    hardLastTime=ts;
    const W=canvas.width,H=canvas.height;
    drawIsoFieldBg(ctx,W,H);
    const TW=56,TH=30,ROWS=11,COLS=16,sx=W/2,sy=H*0.12;
    hardFieldPets.forEach(fp=>{
      fp.prog += 0.012;
      if(fp.prog>=1){ fp.x=fp.tx; fp.y=fp.ty; fp.tx=Math.random(); fp.ty=Math.random(); fp.prog=0; }
      const ease = fp.prog<0.5 ? 2*fp.prog*fp.prog : 1-Math.pow(-2*fp.prog+2,2)/2;
      const cx = fp.x+(fp.tx-fp.x)*ease, cy=fp.y+(fp.ty-fp.y)*ease;
      const r = cy*(ROWS-2)+1, c = cx*(COLS-2)+1;
      const px = sx+(c-r)*TW/2, py = sy+(c+r)*TH/2;
      // ombre
      ctx.fillStyle='rgba(0,0,0,.3)';
      ctx.beginPath(); ctx.ellipse(px,py+5,11,4,0,0,Math.PI*2); ctx.fill();
      // sprite (pré-rendu, évite de recalculer drawPixelArt à chaque frame)
      ctx.drawImage(fp.sprite, px-20, py-38, 40, 40);
      // étiquette nom
      const nm = fp.pet.cat.name.length>13?fp.pet.cat.name.slice(0,11)+'…':fp.pet.cat.name;
      ctx.font='8px Inter';
      const tw = ctx.measureText(nm).width+8;
      ctx.fillStyle='rgba(8,8,16,.8)'; ctx.fillRect(px-tw/2,py-46,tw,11);
      ctx.fillStyle = RARITIES[fp.pet.rar].hex;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(nm, px, py-41);
    });
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function triggerHardDrop(){
  if(!document.getElementById('p6')?.classList.contains('active')) return;
  if(!hardFieldPets.length) return;
  const fp = hardFieldPets[Math.floor(Math.random()*hardFieldPets.length)];
  const p = fp.pet;
  const sec = secById(p.cat.sec); if(!sec||!sec.drops) return;

  const gsFactor = 1 + gsPct(p)/200;
  const roll = Math.random()*100;
  let drop;
  if(roll < 2*gsFactor) drop = sec.drops[2];
  else if(roll < 18*gsFactor) drop = sec.drops[1];
  else drop = sec.drops[0];

  if(drop.silver){
    const amt = Math.floor(5+Math.random()*15);
    SILVER += amt;
    hardSession.silver += amt;
    addHardLog(p, {e:'💰',n:`+${amt} Silver`}, 'gold');
    spawnHardFloat(fp, '💰');
  } else {
    addToInventory(drop.n, drop.e, 1, drop.feed);
    hardSession.items++;
    if(drop.v>=200){ hardSession.rare++; addHardLog(p, drop, 'r3'); }
    else addHardLog(p, drop, null);
    spawnHardFloat(fp, drop.e);
  }
  updateSilverDisplay();
  renderHardSession();
  if(document.getElementById('p2')?.classList.contains('active')) renderCollInventory();
}

function spawnHardFloat(fp, emoji){
  const layer = document.getElementById('hard-drop-layer');
  const canvas = document.getElementById('hard-field-canvas');
  if(!layer||!canvas) return;
  const W=canvas.width,H=canvas.height;
  const TW=56,TH=30,ROWS=11,COLS=16,sx=W/2,sy=H*0.12;
  const r = fp.y*(ROWS-2)+1, c = fp.x*(COLS-2)+1;
  const px = sx+(c-r)*TW/2, py = sy+(c+r)*TH/2;
  const el = document.createElement('div');
  el.style.cssText = `position:absolute;left:${px}px;top:${py-30}px;font-size:16px;animation:hfloat 1.3s ease-out forwards`;
  el.textContent = emoji;
  layer.appendChild(el);
  setTimeout(()=>el.remove(), 1400);
}

function addHardLog(pet, drop, colorKey){
  const lb = document.getElementById('hard-log-body');
  if(!lb) return;
  const now = new Date();
  const t = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  const col = colorKey==='gold' ? 'var(--gold2)' : colorKey==='r3' ? 'var(--r3)' : 'var(--cream2)';
  const el = document.createElement('div');
  el.style.cssText = 'display:flex;align-items:center;gap:7px;padding:4px 7px;border-radius:4px;background:var(--s2);font-size:10px';
  el.innerHTML = `<span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--cream3)">${t}</span><span style="font-size:13px">${drop.e}</span><span style="flex:1;color:${col}">${drop.n}</span><span style="font-size:9px;color:var(--cream3)">${pet.cat.name.split(' ')[0]}</span>`;
  lb.insertBefore(el, lb.firstChild);
  while(lb.children.length>60) lb.removeChild(lb.lastChild);
}

function renderHardSession(){
  const el = document.getElementById('hard-session-grid');
  if(!el) return;
  el.innerHTML = `
    <div style="font-size:10px;color:var(--cream2)">Items<span style="display:block;font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--cream)">${hardSession.items}</span></div>
    <div style="font-size:10px;color:var(--cream2)">Silver<span style="display:block;font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--gold)">${hardSession.silver.toLocaleString('fr-FR')}</span></div>
    <div style="font-size:10px;color:var(--cream2)">Rares<span style="display:block;font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--r3)">${hardSession.rare}</span></div>
    <div style="font-size:10px;color:var(--cream2)">Actifs<span style="display:block;font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--green2)">${hardFieldPets.length}</span></div>`;
}
