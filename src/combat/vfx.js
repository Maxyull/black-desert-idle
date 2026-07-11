// ==================== VFX (particules de sorts) ====================
// Extrait de game-core.js le 2026-07-08 (reorganisation par dossiers) -- DOIT charger APRES
// core/game-core.js (particules/P definis dans la section MONDE) -- reference en execution
// uniquement, aucune evaluation immediate.
// ==================== VFX ====================
/** @param {object} sk - sort lancé (lit sk.vfx). @param {{x:number,y:number}} p - point d'impact. Pousse les particules d'impact correspondant au type de VFX du sort. */
function spawnVfx(sk,p) {
  switch (sk.vfx) {
    case 'meteor':
      for (let i=0;i<5;i++)
        particles.push({type:'meteor',x:p.x+(Math.random()*110-55),y:p.y+(Math.random()*110-55),
          z:260+Math.random()*70,vz:-(430+Math.random()*130),life:1.4,max:1.4});
      break;
    case 'ice':
      for (let i=0;i<14;i++)
        particles.push({type:'ice',x:p.x+(Math.random()*100-50),y:p.y+(Math.random()*100-50),
          z:170+Math.random()*50,vz:-(300+Math.random()*110),life:1,max:1});
      break;
    case 'bolt':
      for (let i=0;i<3;i++)
        particles.push({type:'bolt',x:p.x+(Math.random()*70-35),y:p.y+(Math.random()*70-35),life:.28,max:.28});
      particles.push({type:'flash',life:.14,max:.14});
      break;
    case 'fire':
      particles.push({type:'fireOrb',x:P.x,y:P.y,tx:p.x,ty:p.y,t:0});
      break;
    case 'quake':
      particles.push({type:'quake',x:p.x,y:p.y,r:10,life:.55,max:.55});
      break;
    case 'spark':
      for (let i=0;i<8;i++)
        particles.push({type:'spark',x:p.x+(Math.random()*60-30),y:p.y+(Math.random()*60-30),
          z:10+Math.random()*30,vz:40+Math.random()*50,life:.45,max:.45});
      break;
  }
}
// burst à l'ORIGINE (sur le joueur, au moment où le cast DÉMARRE) -- 2026-07-18, demande
// explicite : "pense aux animations de sorts aussi" / "des effets un peu different pour chaque
// sort". Distinct de spawnVfx ci-dessus (effet d'IMPACT sur la cible, à la résolution du sort) :
// ici c'est ce qui accompagne visuellement le temps de cast, tout de suite quand P.castingSkill
// est posé (voir game-core.js). sk.castBurst vient des données de SKILLS (skills-data.js).
/** @param {object} sk - sort en cours de cast (lit sk.castBurst/castColor/castT). Pousse les particules d'ORIGINE (sur le joueur, au démarrage du cast) — distinct de spawnVfx (impact sur la cible). */
function spawnCastOriginVfx(sk) {
  const color = sk.castColor || '#c9a55a';
  switch (sk.castBurst) {
    case 'ember': // meteor : quelques braises qui montent lentement, charge lourde
      for (let i=0;i<3;i++)
        particles.push({type:'castOrigin',style:'ember',color,x:P.x+(Math.random()*16-8),y:P.y+(Math.random()*16-8),
          z:Math.random()*10,vz:26+Math.random()*14,life:.7,max:.7});
      break;
    case 'frost': // blizzard : petits éclats qui se resserrent en anneau
      for (let i=0;i<6;i++) {
        const a = i/6*Math.PI*2;
        particles.push({type:'castOrigin',style:'frost',color,x:P.x+Math.cos(a)*14,y:P.y+Math.sin(a)*14,
          ang:a,life:.5,max:.5});
      }
      break;
    case 'crackle': // thunder/lstorm : crépitement nerveux, très bref
      for (let i=0;i<5;i++)
        particles.push({type:'castOrigin',style:'crackle',color,x:P.x+(Math.random()*20-10),y:P.y+(Math.random()*20-10),
          z:14+Math.random()*18,life:.22,max:.22});
      break;
    case 'orb': // bolide/fireball : un seul orbe qui se charge au bout du bâton
      particles.push({type:'castOrigin',style:'orb',color,x:P.x,y:P.y,z:34,life:sk.castT,max:sk.castT});
      break;
    case 'dust': // quake : petit nuage de poussière au sol, aux pieds
      for (let i=0;i<4;i++)
        particles.push({type:'castOrigin',style:'dust',color,x:P.x+(Math.random()*18-9),y:P.y+(Math.random()*10-5),
          life:.5,max:.5});
      break;
    case 'flash': // equil : flash violet net et bref, arcane
      particles.push({type:'castOrigin',style:'flash',color,x:P.x,y:P.y,z:20,life:.18,max:.18});
      break;
    case 'flicker': // voltaic : minuscule étincelle unique, quasi instantanée (sort le + rapide)
      particles.push({type:'castOrigin',style:'flicker',color,x:P.x+(Math.random()*8-4),y:P.y+(Math.random()*8-4),
        z:20,life:.12,max:.12});
      break;
    case 'shimmer': // speed : scintillement doux et calme (buff, pas d'agressivité visuelle)
      for (let i=0;i<3;i++)
        particles.push({type:'castOrigin',style:'shimmer',color,x:P.x+(Math.random()*20-10),y:P.y+(Math.random()*20-10),
          z:8+Math.random()*10,vz:8,life:.9,max:.9});
      break;
  }
}
/** @param {number} dt - delta-temps de la frame, en secondes. Fait vivre/vieillir chaque particule (chute, explosion au sol, éclats du fireOrb au contact), purge les particules mortes. */
function particlesTick(dt) {
  for (const q of particles) {
    if (q.life !== undefined) q.life -= dt;
    if (q.type==='meteor'||q.type==='ice') {
      q.z += q.vz*dt;
      if (q.z <= 0 && !q.boom) { q.boom = true; q.z = 0; q.life = Math.min(q.life,.2); }
    }
    if (q.type==='spark') { q.z += q.vz*dt; q.vz -= 200*dt; if (q.z<0) q.z=0; }
    if (q.type==='quake') q.r += 210*dt;
    if (q.type==='castOrigin' && (q.style==='ember'||q.style==='shimmer')) q.z += q.vz*dt;
    if (q.type==='fireOrb') {
      q.t += dt*3;
      if (q.t >= 1 && !q.done) {
        q.done = true; q.life = 0;
        for (let i=0;i<7;i++)
          particles.push({type:'spark',x:q.tx+(Math.random()*40-20),y:q.ty+(Math.random()*40-20),
            z:5+Math.random()*20,vz:50+Math.random()*70,life:.4,max:.4,fire:true});
      } else if (q.life === undefined) q.life = 1;
    }
  }
  particles = particles.filter(q => q.life===undefined || q.life>0);
}
