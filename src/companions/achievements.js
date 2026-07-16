// ═══ ACHIEVEMENTS & SCORE DE PRESTIGE ═══════════════════════════
// Champ `hard` (2026-07-20, demande explicite : "ajoute des succes dure") : marque les
// achievements les plus exigeants/risqués (affichés avec un tag distinct, voir renderAchievements).
// N'ajoute PAS de nouvelle mécanique de jeu -- juste une catégorisation des achievements existants
// les plus difficiles + 1 nouvel achievement (fusion_downgrade) qui récompense un vrai PARI perdu.
// i18n (2026-07-16) : les champs name/desc ci-dessous sont le FR canonique de RÉFÉRENCE, mais
// l'affichage passe par achName()/achDesc() (clés companions.achievements.<id>_name/_desc,
// locales/{fr,en}/companions.json) -- modifier un libellé = modifier les JSON, pas ces champs.
const ACHIEVEMENTS = [
  {id:'first_pet',    ico:'🥚', name:'Premier familier',      desc:'Éclos ton premier familier',                        reward:500,   check:()=>PETS.length>=1},
  {id:'collector_10',  ico:'📦', name:'Collectionneur',        desc:'Possède 10 familiers en même temps',                reward:2000,  check:()=>PETS.length>=10},
  {id:'collector_24',  ico:'📚', name:'Grand collectionneur',  desc:'Possède 24 familiers en même temps',                reward:5000,  check:()=>PETS.length>=24},
  {id:'all_sections',  ico:'🗺️', name:'Explorateur complet',   desc:'Un pet actif sur les 8 sections à la fois',         reward:3000,  check:()=>SECTIONS.every(s=>terrainPet(s.id))},
  {id:'first_ancestral',ico:'🌟',name:'Première légende',      desc:'Obtiens un familier Ancestral',                     reward:8000,  check:()=>PETS.some(p=>p.rar===5)},
  {id:'tier5',         ico:'⬆️', name:'Maître du Tier',        desc:'Amène un familier au Tier 5',                       reward:4000,  check:()=>PETS.some(p=>(p.tier||1)>=5)},
  {id:'gs900',         ico:'💯', name:'Quasi-perfection',      desc:'Atteins un GS de 900+ sur un familier',             reward:6000,  check:()=>PETS.some(p=>normGS(p)>=900), hard:true},
  {id:'gs_champion',   ico:'🏅', name:'Champion de section',   desc:'Un familier GS 950+ actif sur le terrain',          reward:7000,  check:()=>PETS.some(p=>p.terrain&&normGS(p)>=950), hard:true},
  {id:'fusion_20',     ico:'⚗️', name:'Alchimiste des familiers',desc:'Réalise 20 fusions',                              reward:3000,  check:()=>fusionCount>=20},
  {id:'caphras_10',    ico:'🔺', name:'Artisan de Caphras',     desc:"Utilise l'atelier de Caphras 10 fois",             reward:2500,  check:()=>caphrasUpgradeCount>=10},
  {id:'boss_item',     ico:'💀', name:'Chasseur de Boss',       desc:'Loote un item de Boss (1 sur des millions)',        reward:15000, check:()=>bossItemFound, hard:true},
  {id:'pity',          ico:'🎁', name:'La chance sourit aux patients', desc:'Déclenche le pity counter Ancestral',        reward:1000,  check:()=>pityEverTriggered},
  {id:'breakthrough',  ico:'💥', name:'Percée fulgurante',      desc:'Déclenche une percée de rareté (reset Tier)',       reward:4000,  check:()=>breakthroughCount>=1},
  {id:'silver_rich',   ico:'💰', name:'Petit richissime',       desc:'Possède 100 000 Silver en même temps',              reward:5000,  check:()=>SILVER>=100000},
  {id:'full_catalog',  ico:'📖', name:'Encyclopédiste',         desc:'Possède au moins une fois les 48 familiers du catalogue', reward:20000, check:()=>new Set(PETS.map(p=>p.cat.name)).size>=48, hard:true},
  {id:'egg_master',    ico:'🎯', name:'Maître des œufs',        desc:"Utilise chaque type d'œuf au moins une fois",       reward:3000,  check:()=>eggTypesUsed.size>=EGG_TYPES.length},
  {id:'fusion_downgrade', ico:'🎰', name:'Pari perdu',          desc:'Fusionne un Légendaire/Ancestral et obtiens un résultat de rareté inférieure', reward:10000, check:()=>fusionLostHighRarityCount>=1, hard:true},
];

/** @param {object} a - entrée ACHIEVEMENTS. @returns {string} nom traduit (clé companions.achievements.<id>_name). */
function achName(a){ return i18next.t(COMPANIONS_NS_PREFIX+'companions.achievements.'+a.id+'_name'); }
/** @param {object} a - entrée ACHIEVEMENTS. @returns {string} description traduite (clé companions.achievements.<id>_desc). */
function achDesc(a){ return i18next.t(COMPANIONS_NS_PREFIX+'companions.achievements.'+a.id+'_desc'); }

/** Vérifie tous les ACHIEVEMENTS non encore complétés, débloque ceux dont check() passe (verse la récompense en SILVER), affiche un toast/log et rafraîchit le badge + le panneau s'il est ouvert. */
function checkAchievements(){
  let newlyCompleted=[];
  ACHIEVEMENTS.forEach(a=>{
    if(!completedAchievements.has(a.id) && a.check()){
      completedAchievements.add(a.id);
      SILVER += a.reward;
      newlyCompleted.push(a);
    }
  });
  if(newlyCompleted.length){
    updateSilverDisplay();
    newlyCompleted.forEach(a=>{
      toast('🏆', i18next.t('companions:companions.achievements.unlocked_toast', {icon:a.ico, name:achName(a), reward:a.reward.toLocaleString(NUM_LOCALE)}));
      addGameLog(i18next.t('companions:companions.achievements.unlocked_log_html', {name:achName(a), reward:a.reward.toLocaleString(NUM_LOCALE)}));
    });
    const badge = document.getElementById('tb7');
    if(badge) badge.textContent = `${completedAchievements.size}/${ACHIEVEMENTS.length}`;
    if(document.getElementById('p7')?.classList.contains('active')) renderAchievements();
  }
}

/** @returns {number} score composite du Classement (achievements×250 + GS/tier/fusions/caphras/breakthroughs cumulés + silver/100). */
function prestigeScore(){
  // Score composite : achievements (poids fort) + progression brute (GS cumulé, tiers, fusions...)
  let score = completedAchievements.size*250;
  PETS.forEach(p=>{ score += normGS(p); score += (p.tier||1)*20; });
  score += fusionCount*15 + caphrasUpgradeCount*10 + breakthroughCount*100;
  score += Math.floor(SILVER/100);
  return Math.round(score);
}

/** Reconstruit la grille du panneau Succès (compteur, score de prestige, une tuile par ACHIEVEMENTS avec état débloqué/verrouillé). */
function renderAchievements(){
  document.getElementById('ach-count').textContent = `${completedAchievements.size} / ${ACHIEVEMENTS.length}`;
  document.getElementById('prestige-score').textContent = prestigeScore().toLocaleString(NUM_LOCALE);
  const el = document.getElementById('achievements-grid');
  el.innerHTML = ACHIEVEMENTS.map(a=>{
    const done = completedAchievements.has(a.id);
    return `<div style="background:${done?'rgba(200,169,110,.08)':'var(--s2)'};border:1px solid ${done?'var(--gold-dim)':'var(--border)'};border-radius:9px;padding:11px 13px;display:flex;align-items:center;gap:11px;${done?'':'opacity:.65'}">
      <span style="font-size:26px;${done?'':'filter:grayscale(1);opacity:.5'}">${a.ico}</span>
      <div style="flex:1">
        <div style="font-family:'Cinzel',serif;font-size:12px;color:${done?'var(--gold2)':'var(--cream)'};display:flex;align-items:center;gap:6px">${achName(a)}${a.hard?'<span style="font-size:8px;color:var(--red2);border:1px solid var(--red);border-radius:3px;padding:0 4px;font-family:Inter,sans-serif;letter-spacing:.04em">'+i18next.t('companions:companions.achievements.hard_badge')+'</span>':''}</div>
        <div style="font-size:10px;color:var(--cream2);margin-top:1px">${achDesc(a)}</div>
        <div style="font-size:9px;color:${done?'var(--green2)':'var(--cream3)'};margin-top:3px">${done?i18next.t('companions:companions.achievements.unlocked'):i18next.t('companions:companions.achievements.locked')} · +${a.reward.toLocaleString(NUM_LOCALE)} Silver</div>
      </div>
    </div>`;
  }).join('');
}
