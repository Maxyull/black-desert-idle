// ═══ PVP (2026-07-20, demande explicite : "categorie pvp, classement de toutes les fonction de
// la categorie" + "header : PVP bloqué") ═══════════════════════════════════════════════════════
// PvP joueur-contre-joueur (vrais combats entre les familiers de 2 joueurs) n'existe pas encore --
// nécessite un serveur autoritaire (matchmaking, résolution de combat côté Supabase) qui n'existe
// pas pour ce module 100% local (voir README.md). Ce qui EST livré aujourd'hui, sans attendre ce
// futur serveur : un vrai CLASSEMENT ("de toutes les fonctions de la catégorie" = tous les pets,
// toutes sections confondues), trié par puissance de combat (GS) -- la base sur laquelle un futur
// matchmaking PvP pourra directement s'appuyer.

// puissance de combat utilisée pour classer les familiers en PvP -- volontairement le même normGS
// que partout ailleurs dans le module (tier.js), pas une formule séparée : un pet fort
// en Collection doit rester fort en PvP, pas de double calibration à maintenir.
function pvpPower(p) { return normGS(p); }

// classement pur (id → rang), testable isolément sans DOM -- tri par puissance décroissante,
// égalité départagée par Tier puis par id (stable, jamais d'ex-aequo silencieux).
function computePvpRanking(pets) {
  return [...(pets||[])].sort((a,b) => {
    const pv = pvpPower(b) - pvpPower(a);
    if (pv !== 0) return pv;
    const tv = (b.tier||1) - (a.tier||1);
    if (tv !== 0) return tv;
    return a.id - b.id;
  });
}

function renderPvp() {
  const el = document.getElementById('pvp-ranking');
  if (!el) return;
  const ranked = computePvpRanking(PETS);
  if (!ranked.length) {
    el.innerHTML = `<div style="font-size:11px;color:var(--cream3);padding:16px;text-align:center">Aucun familier pour l'instant — éclos-en un pour apparaître dans ce classement.</div>`;
    return;
  }
  const medal = i => i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`;
  el.innerHTML = ranked.map((p,i) => {
    const sec = secById(p.cat.sec);
    return `<div style="display:flex;align-items:center;gap:10px;padding:6px 10px;background:${i<3?'rgba(200,169,110,.06)':'var(--s2)'};border:1px solid ${i<3?'var(--gold-dim)':'var(--border)'};border-radius:7px;margin-bottom:4px">
      <span style="font-family:'Cinzel',serif;font-size:12px;color:var(--gold);width:26px;text-align:center;flex-shrink:0">${medal(i)}</span>
      <canvas id="pvp-cv${p.id}" width="30" height="30" style="width:30px;height:30px;image-rendering:pixelated;flex-shrink:0"></canvas>
      <div style="flex:1;min-width:0">
        <div style="font-size:11px;color:var(--cream);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.cat.name}</div>
        <div style="font-size:9px;color:${rc(p.rar)}">${rn(p.rar)} · T${p.tier||1} · ${sec?.ico||''} ${sec?.name||''}</div>
      </div>
      <span class="gs-badge ${gsCls(gsPct(p))}">GS ${pvpPower(p)}</span>
    </div>`;
  }).join('');
  ranked.forEach(p => {
    const c = document.getElementById('pvp-cv'+p.id);
    if (c) drawPixelArt(c, p.cat.art, 30, null, p.tier||1);
  });
}
