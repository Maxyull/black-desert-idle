// ==================== MINI BOSS — rendu canvas ====================
// DOIT charger APRÈS combat/miniboss.js (miniBossLoop() appelle drawMinibossRoom()) — miroir
// simplifié de combat/boss-render.js : groupe plafonné à 5 (pas 10), pas de piliers/spots
// d'esquive dédiés — un combat Mini Boss est volontairement plus simple visuellement que
// Kzarka/Vell (voir plan, "il va etre plus simple").
const minibossCtx = document.getElementById('minibossCv') ? document.getElementById('minibossCv').getContext('2d') : null;
/**
 * Dessine la salle de Mini Boss (fond, créature centrale flottante, avatars des participants).
 * @param {number} now - performance.now(), fourni par miniBossLoop().
 */
function drawMinibossRoom(now) {
  const cv = $a('minibossCv'); if (!cv || !minibossCtx) return;
  const ctx = minibossCtx;
  const w = cv.width, h = cv.height;
  ctx.clearRect(0, 0, w, h);
  const grad = ctx.createRadialGradient(w/2, h*0.4, 20, w/2, h*0.4, Math.max(w,h)*0.6);
  grad.addColorStop(0, 'rgba(155,127,214,.16)');
  grad.addColorStop(1, '#0a0912');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // créature centrale, légère oscillation verticale (même esprit que .arenaCreature du mockup)
  const bob = Math.sin(now/450) * 10;
  ctx.font = Math.round(Math.min(w,h)*0.22) + 'px serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(155,127,214,.6)'; ctx.shadowBlur = 30;
  ctx.fillText('👻', w/2, h*0.42 + bob);
  ctx.shadowBlur = 0;
  // avatars des participants, alignés en bas (invocateur avec un liseré distinct)
  const party = minibossState.party && minibossState.party.length ? minibossState.party : [{ pseudo:'Toi', role:'summoner', mine:true }];
  const n = party.length;
  const spacing = Math.min(90, (w*0.7)/Math.max(1,n));
  const startX = w/2 - spacing*(n-1)/2;
  party.forEach((p, i) => {
    const x = startX + spacing*i, y = h*0.82;
    ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI*2);
    ctx.fillStyle = '#181828';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = p.role==='summoner' ? '#9b7fd6' : (p.mine ? '#c9a55a' : '#3a3a58');
    ctx.stroke();
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#ddd0b8';
    ctx.fillText(p.role==='summoner'?'👑':'🙂', x, y);
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#9a8e78';
    ctx.fillText(String(p.pseudo||'?').slice(0,10), x, y+26);
  });
}
