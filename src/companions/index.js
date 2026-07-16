// ═══ INDEX (Rareté × Tier + Catalogue) ═══════════════════════════
let indexFilterSec='all';
let indexFilterTier='all';

/** @param {number} rar - rareté visée (0-5). Affiche un toast avec les odds de chaque type d'œuf pour cette rareté. */
function suggestEggFor(rar){
  const lines = EGG_TYPES.map(e=>`${e.ico} ${eggName(e)} : ${e.odds[rar]}%`).join(' · ');
  toast('🥚', i18next.t('companions:companions.index.suggest_toast', {rarity:rn(rar), lines:lines}));
}

/** Reconstruit l'onglet Index (matrice rareté×tier, chips de filtre, table du catalogue). */
function renderIndex(){
  renderIndexMatrix();
  renderIndexFilterChips();
  renderIndexPetTable();
}

/** Reconstruit la matrice rareté×tier (plage de GS normalisée sur l'absolu Ancestral T5, statut possédé/à nourrir/à éclore par case) + légende. */
function renderIndexMatrix(){
  // Pour chaque (rareté, tier), calcule la plage de GS possible : du pire tirage
  // (stats + multiplicateur de tier au plancher) au meilleur tirage (les deux au plafond).
  const absMax = maxGS(5,5); // référence absolue = Ancestral T5 au meilleur tirage possible

  // Détermine, pour chaque rareté, le meilleur tier possédé actuellement (ou null si aucun pet de cette rareté)
  const bestTierOwnedByRar = {};
  PETS.forEach(p=>{
    const t = p.tier||1;
    if(!bestTierOwnedByRar[p.rar] || t>bestTierOwnedByRar[p.rar]) bestTierOwnedByRar[p.rar]=t;
  });

  let html = `<table style="border-collapse:collapse;font-size:10.5px;min-width:680px">
    <thead><tr>
      <th style="padding:6px 10px;text-align:left;color:var(--cream2);border-bottom:1px solid var(--border)">${i18next.t('companions:companions.index.matrix_col_header')}</th>
      ${[1,2,3,4,5].map(t=>`<th style="padding:6px 10px;color:var(--gold);border-bottom:1px solid var(--border);font-family:'Cinzel',serif">T${t}<div style="font-size:8px;color:var(--cream3);font-weight:400">×${TIER_MULT_RANGE[t-1][0].toFixed(2)}–${TIER_MULT_RANGE[t-1][1].toFixed(2)}</div></th>`).join('')}
    </tr></thead><tbody>`;

  RARITIES.forEach((r,rar)=>{
    const ownedTier = bestTierOwnedByRar[rar]; // meilleur tier déjà possédé pour cette rareté (undefined si aucun)
    html += `<tr>
      <td style="padding:6px 10px;color:${r.hex};font-family:'Cinzel',serif;border-bottom:1px solid var(--border)">${rn(rar)}</td>
      ${[1,2,3,4,5].map(tier=>{
        const gsMin = Math.round(minGS(rar,tier)/absMax*1000);
        const gsMax = Math.round(maxGS(rar,tier)/absMax*1000);
        const nextRarAvg = rar<5 ? avgGSForRarityAtTier1(rar+1) : null;
        const overlaps = nextRarAvg!==null && gsMax>=nextRarAvg;
        const pctOfAbs = Math.round(gsMax/1000*100);

        // Statut d'action pour cette cellule précise
        let bg='transparent', txtCol='var(--cream2)', action=null, cursor='default', onclick='';
        if(ownedTier===tier){
          bg='rgba(68,176,96,.16)'; txtCol='var(--green2)'; action=i18next.t('companions:companions.index.owned');
        } else if(ownedTier!==undefined && tier===ownedTier+1){
          bg='rgba(232,184,75,.14)'; txtCol='var(--gold2)'; action=i18next.t('companions:companions.index.feed_to_climb');
          cursor='pointer'; onclick=`onclick="ST(4)"`;
        } else if(ownedTier===undefined && tier===1){
          bg='rgba(123,157,191,.14)'; txtCol='var(--blue2)'; action=i18next.t('companions:companions.index.to_hatch');
          cursor='pointer'; onclick=`onclick="ST(1);suggestEggFor(${rar})"`;
        } else if(overlaps){
          bg='rgba(68,176,96,.06)';
        }

        return `<td ${onclick} style="padding:6px 10px;text-align:center;font-family:'JetBrains Mono',monospace;border-bottom:1px solid var(--border);background:${bg};color:${txtCol};cursor:${cursor}" title="${action||''}">
          ${gsMin}–${gsMax}${overlaps?' ▲':''}
          <div style="font-size:8px;color:var(--cream3)">max ${pctOfAbs}% abs.</div>
          ${action?`<div style="font-size:8px;margin-top:1px;color:${txtCol}">${action}</div>`:''}
        </td>`;
      }).join('')}
    </tr>`;
  });

  html += `</tbody></table>
    <div style="display:flex;flex-wrap:wrap;gap:14px;margin-top:10px;padding:10px 12px;background:var(--s2);border:1px solid var(--border);border-radius:8px">
      <div style="font-family:'Cinzel',serif;font-size:10px;color:var(--cream2);letter-spacing:.06em;text-transform:uppercase;width:100%;margin-bottom:2px">${i18next.t('companions:companions.index.legend_title')}</div>
      <div style="display:flex;align-items:center;gap:6px;font-size:10px;color:var(--cream2)"><span style="width:12px;height:12px;border-radius:3px;background:rgba(68,176,96,.16);border:1px solid var(--green2);display:inline-block"></span>${i18next.t('companions:companions.index.legend_owned')}</div>
      <div style="display:flex;align-items:center;gap:6px;font-size:10px;color:var(--cream2)"><span style="width:12px;height:12px;border-radius:3px;background:rgba(232,184,75,.14);border:1px solid var(--gold2);display:inline-block"></span>${i18next.t('companions:companions.index.legend_feed')}</div>
      <div style="display:flex;align-items:center;gap:6px;font-size:10px;color:var(--cream2)"><span style="width:12px;height:12px;border-radius:3px;background:rgba(123,157,191,.14);border:1px solid var(--blue2);display:inline-block"></span>${i18next.t('companions:companions.index.legend_hatch')}</div>
      <div style="display:flex;align-items:center;gap:6px;font-size:10px;color:var(--green2)"><span style="width:12px;height:12px;border-radius:3px;background:rgba(68,176,96,.06);border:1px solid var(--border);display:inline-block"></span>${i18next.t('companions:companions.index.legend_overlap')}</div>
      <div style="font-size:9px;color:var(--cream3);width:100%;margin-top:2px">${i18next.t('companions:companions.index.legend_hint')}</div>
    </div>`;
  document.getElementById('index-matrix').innerHTML = html;
}

/** Reconstruit les chips de filtre section/tier de l'onglet Index (indexFilterSec/indexFilterTier). */
function renderIndexFilterChips(){
  document.getElementById('index-filter-chips').innerHTML =
    [['all',i18next.t('companions:companions.index.filter_all')],...SECTIONS.map(s=>[s.id,s.ico+' '+secName(s)])].map(([id,lbl])=>
      `<div class="chip ${indexFilterSec===id?'on':''}" onclick="indexFilterSec='${id}';renderIndexFilterChips();renderIndexPetTable()">${lbl}</div>`
    ).join('');
  const tierChipsEl = document.getElementById('index-tier-chips');
  if(tierChipsEl){
    tierChipsEl.innerHTML =
      [['all',i18next.t('companions:companions.index.filter_all_tiers')],...[1,2,3,4,5].map(t=>[String(t),'T'+t])].map(([id,lbl])=>
        `<div class="chip ${indexFilterTier===id?'on':''}" onclick="indexFilterTier='${id}';renderIndexFilterChips();renderIndexPetTable()">${lbl}</div>`
      ).join('');
  }
}

/** Reconstruit la table du catalogue (une espèce par groupe de lignes T1-T5), filtrée par indexFilterSec/indexFilterTier — statut possédé calculé sur la rareté RÉELLE du pet (pas la rareté de base de l'espèce, peut différer après un breakthrough). */
function renderIndexPetTable(){
  let list=[...PET_CATALOG];
  if(indexFilterSec!=='all') list=list.filter(c=>c.sec===indexFilterSec);
  list.sort((a,b)=>b.rar-a.rar||a.name.localeCompare(b.name));

  // Map nom -> instance possédée (pour marquer le statut Obtenu au bon tier précis)
  // normalizeName() (2026-07-21, rapporté explicitement : une espèce possédée -- 2 pets, vus
  // corrects dans Collection -- ressortait "(inconnu)" ici) -- .trim() défensif : une sauvegarde
  // ancienne peut porter un p.cat.name avec un espace de bordure invisible (JSON figé au moment du
  // hatch, jamais retouché depuis), qui casse une comparaison stricte === à la chaîne du
  // catalogue actuel alors que le nom affiché est visuellement identique.
  const normalizeName = n => (n||'').trim();
  const ownedMap = new Map(PETS.map(p=>[normalizeName(p.cat.name), p]));
  const absMax = maxGS(5,5);

  const tiersToShow = indexFilterTier==='all' ? [1,2,3,4,5] : [+indexFilterTier];

  let html = `<thead><tr>
    <th style="padding:8px 10px;text-align:left;color:var(--cream2);border-bottom:1px solid var(--border);font-size:12px">${i18next.t('companions:companions.index.col_name')}</th>
    <th style="padding:8px 10px;text-align:left;color:var(--cream2);border-bottom:1px solid var(--border);font-size:12px">${i18next.t('companions:companions.index.col_type')}</th>
    <th style="padding:8px 10px;text-align:left;color:var(--cream2);border-bottom:1px solid var(--border);font-size:12px">${i18next.t('companions:companions.index.col_section')}</th>
    <th style="padding:8px 10px;text-align:left;color:var(--cream2);border-bottom:1px solid var(--border);font-size:12px">${i18next.t('companions:companions.index.col_rarity')}</th>
    <th style="padding:8px 10px;text-align:center;color:var(--cream2);border-bottom:1px solid var(--border);font-size:12px">${i18next.t('companions:companions.index.col_tier')}</th>
    <th style="padding:8px 10px;text-align:center;color:var(--cream2);border-bottom:1px solid var(--border);font-size:12px">${i18next.t('companions:companions.index.col_gs')}</th>
    <th style="padding:8px 10px;text-align:left;color:var(--cream2);border-bottom:1px solid var(--border);font-size:12px">${i18next.t('companions:companions.index.col_origin')}</th>
    <th style="padding:8px 10px;text-align:center;color:var(--cream2);border-bottom:1px solid var(--border);font-size:12px">${i18next.t('companions:companions.index.col_status')}</th>
  </tr></thead><tbody>`;

  const previewsToRender = []; // {canvasId, artKey, rarColor, tier, owned}

  list.forEach((c,ci)=>{
    const sec=secById(c.sec);
    const owned=ownedMap.get(normalizeName(c.name));
    const ownedTier = owned ? (owned.tier||1) : null;
    // bug corrigé (2026-07-21, rapporté explicitement : "dans l'index il est noté comme épique,
    // dans sections légendaire, dans la collection ancestral") -- une percée de rareté (ticks.js,
    // BREAKTHROUGH) change p.rar SANS jamais toucher p.cat (l'espèce/son entrée catalogue reste
    // celle d'origine). Cette table affichait c.rar (rareté DE BASE de l'espèce, figée) au lieu de
    // la rareté RÉELLE actuelle du pet possédé -- Collection (rn(p.rar)/rc(p.rar)) était déjà juste,
    // Index ne l'était pas. displayRar = rareté réelle si possédé, sinon rareté de base (espèce
    // jamais obtenue, rien à afficher de "réel").
    const displayRar = owned ? owned.rar : c.rar;

    // Rangée d'aperçus T1→T5 — seul le tier réellement possédé s'illumine, les autres restent éteints
    const evoRow = [1,2,3,4,5].map(t=>{
      const pid = `idx-prev-${ci}-t${t}`;
      const isOwnedAtThisTier = ownedTier===t;
      previewsToRender.push({id:pid, art:c.art, col:rc(displayRar), tier:t, lit:isOwnedAtThisTier});
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
        <div style="position:relative;${isOwnedAtThisTier?'':'opacity:.28;filter:grayscale(0.9) brightness(.7)'}">
          <canvas id="${pid}" width="52" height="52" style="width:52px;height:52px;image-rendering:pixelated;${isOwnedAtThisTier?'box-shadow:0 0 10px var(--gold),0 0 3px var(--gold2);border-radius:4px':''}"></canvas>
        </div>
        <span style="font-size:9px;font-family:'Cinzel',serif;font-weight:${isOwnedAtThisTier?'700':'400'};color:${isOwnedAtThisTier?'var(--gold)':'var(--cream3)'}">T${t}</span>
      </div>`;
    }).join('');

    // Buffs de la section : tags des stats actives pour cette rareté, avec plage min-max + valeur réelle si possédé
    const bonusCount = BONUS_COUNT[c.rar];
    const buffTags = sec ? sec.sk.slice(0,bonusCount).map((k,i)=>{ const kLbl=skillName(sec,i);
      const [lo,hi] = STAT_RANGES[c.rar][i];
      const val = owned ? (owned.stats[i]||0) : null;
      return `<span style="display:inline-block;background:var(--s3);border:1px solid var(--border);border-radius:4px;padding:2px 7px;font-size:10px;color:${owned?'var(--green2)':'var(--cream2)'};margin:2px 3px 0 0">${kLbl}
        <span style="font-family:'JetBrains Mono',monospace;color:var(--cream3)">[${lo}–${hi}]</span>
        ${val!==null?` <b style="font-family:'JetBrains Mono',monospace;color:var(--gold2)">+${val}</b>`:''}</span>`;
    }).join('') : '';

    tiersToShow.forEach((t,ti)=>{
      const isFirstRowOfGroup = ti===0;
      const gsMin = Math.round(minGS(c.rar,t)/absMax*1000);
      const gsMax = Math.round(maxGS(c.rar,t)/absMax*1000);
      const isOwnedAtThisTier = ownedTier===t;
      const rowBg = isFirstRowOfGroup ? '' : 'background:rgba(255,255,255,0.015)';
      const nameCell = isFirstRowOfGroup
        ? `<td rowspan="${tiersToShow.length}" style="padding:10px;border-bottom:2px solid var(--border);vertical-align:top">
             <div style="font-size:19px;font-weight:700;color:${owned?'var(--cream)':'var(--cream3)'};margin-bottom:8px">${c.name}${owned?'':' <span style="font-size:11px;font-weight:400">'+i18next.t('companions:companions.index.unknown_suffix')+'</span>'}</div>
             <div style="display:flex;gap:10px">${evoRow}</div>
           </td>`
        : '';
      const typeCell = isFirstRowOfGroup ? `<td rowspan="${tiersToShow.length}" style="padding:8px 10px;color:var(--cream2);border-bottom:2px solid var(--border);vertical-align:top;font-size:12px">${typeLabel(c.typ)}</td>` : '';
      const secCell = isFirstRowOfGroup ? `<td rowspan="${tiersToShow.length}" style="padding:8px 10px;color:var(--cream2);border-bottom:2px solid var(--border);vertical-align:top;font-size:12px;max-width:220px">
          <div style="margin-bottom:4px">${sec?.ico||''} ${secName(sec)}</div>
          <div style="display:flex;flex-wrap:wrap">${buffTags}</div>
        </td>` : '';
      const rarCell = isFirstRowOfGroup ? `<td rowspan="${tiersToShow.length}" style="padding:8px 10px;color:${rc(displayRar)};border-bottom:2px solid var(--border);vertical-align:top;font-size:13px;font-weight:600">${rn(displayRar)}</td>` : '';
      const origCell = isFirstRowOfGroup ? `<td rowspan="${tiersToShow.length}" style="padding:8px 10px;color:var(--cream3);border-bottom:2px solid var(--border);font-size:11px;vertical-align:top">${c.orig}</td>` : '';
      const isLastTierRow = ti===tiersToShow.length-1;
      const borderStyle = isLastTierRow ? '2px solid var(--border)' : '1px solid var(--border)';

      html += `<tr style="${rowBg}${owned?'':';opacity:.6'}">
        ${nameCell}${typeCell}${secCell}${rarCell}
        <td style="padding:6px 10px;text-align:center;border-bottom:${borderStyle}"><span style="font-family:'Cinzel',serif;font-size:13px;color:${isOwnedAtThisTier?'var(--gold)':'var(--cream3)'}">T${t}</span></td>
        <td style="padding:6px 10px;text-align:center;border-bottom:${borderStyle};font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--cream2)">${gsMin}–${gsMax}</td>
        ${origCell}
        <td style="padding:6px 10px;text-align:center;border-bottom:${borderStyle}">${isOwnedAtThisTier?'<span style="color:var(--green2);font-size:11px;font-weight:600">'+i18next.t('companions:companions.index.this_tier')+'</span>':(owned?'<span style="color:var(--cream3);font-size:10px">'+i18next.t('companions:companions.index.other_tier')+'</span>':'<span style="color:var(--cream3);font-size:10px">—</span>')}</td>
      </tr>`;
    });
  });

  html += '</tbody>';
  document.getElementById('index-pet-table').innerHTML = html;

  // Rendu de chaque aperçu T1→T5 pour chaque pet
  previewsToRender.forEach(pv=>{
    setTimeout(()=>{
      const cv=document.getElementById(pv.id);
      if(cv) drawPixelArt(cv, pv.art, 52, pv.col, pv.tier);
    },30);
  });
}
