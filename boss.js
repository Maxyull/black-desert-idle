// ==================== WORLD BOSS ====================
// Bosses implémentés dans le jeu : Kzarka (quotidien) et Vell (hebdomadaire, ajouté le 2026-07-08).
// Les horaires suivent ceux du vrai BDO MOINS 15 minutes (demande utilisateur) ; ils sont exprimés
// en heure LOCALE du joueur pour rester simples, et le boss "in-game" se combat en 2 à 7 minutes
// selon ton stuff (voir startBossFight).
const BOSS_ROSTER = {
  kzarka: {
    name:{fr:'Grand Seigneur de guerre de la corruption',en:'Great Warlord of Corruption'},
    short:{fr:'Seigneur de guerre',en:'Warlord'}, icon:'👹', color:'#7a2d33',
    hp: 400000,          // calibré pour ~5 min à PA "adaptée" (~250), clampé à [2,7] min
    reward: 250000,      // silver de victoire
    matKey:'mat_Pierre noire', matName:'Pierre noire', matIcon:ICO_MAT_NOIRE, matQty:[8,20],
  },
  // Vell : grand poisson/serpent des mers, boss hebdomadaire (bien plus rare que Kzarka dans le
  // vrai jeu) — silhouette originale provisoire en attendant la photo de référence promise par
  // l'utilisateur (sera affinée ensuite, voir drawVell). Plus coriace et plus payant que Kzarka
  // pour refléter sa rareté hebdomadaire.
  vell: {
    name:{fr:'Vell, la Terreur des Flots',en:'Vell, Terror of the Tides'},
    short:{fr:'Vell',en:'Vell'}, icon:'🐋', color:'#2a5a78',
    hp: 550000,
    reward: 400000,
    matKey:'mat_Pierre noire', matName:'Pierre noire', matIcon:ICO_MAT_NOIRE, matQty:[12,28],
    // Coeur de Vell (2026-07-08) : 5% de chance à la victoire — visible sur la roue de récompense
    // en fin de combat (voir endBossFight/renderBossRewardWheel), qu'on l'obtienne ou non.
    rareLoot: { name:'Coeur de Vell', icon:ICO_COEUR_VELL, color:'#5ec9e8', ch:0.05 },
  },
};
// horaires hebdomadaires (heure locale, déjà "-15 min") — day: 0=dimanche..6=samedi, ou 'daily'
// (Kzarka apparaît plusieurs fois par jour dans le vrai jeu ; sélection resserrée ici).
// Vell (2026-07-08) : hebdomadaire seulement, jeudi + dimanche d'après le planning cité par
// l'utilisateur (garmoth.com) — jeudi 12h15 → 12h00, dimanche 17h00 → 16h45 une fois le "-15min" appliqué.
const BOSS_SCHEDULE = [
  { boss:'kzarka', day:'daily', h:12, m:45 },
  { boss:'kzarka', day:'daily', h:19, m:45 },
  { boss:'kzarka', day:'daily', h:23, m:45 },
  { boss:'kzarka', day:0,       h:15, m:45 },
  { boss:'kzarka', day:6,       h:15, m:45 },
  { boss:'vell',   day:4,       h:12, m:0  },
  { boss:'vell',   day:0,       h:16, m:45 },
];
const BOSS_WINDOW_MS = 9 * 60 * 1000; // fenêtre pendant laquelle le boss reste combattable après spawn (demande du 2026-07-06)

// décalage UTC actuel de Paris, en minutes (ex: +60 en hiver/CET, +120 en été/CEST) — calculé via
// Intl plutôt que codé en dur pour suivre automatiquement les changements d'heure
function parisOffsetMinutes(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone:'Europe/Paris',
    hour12:false, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit'
  }).formatToParts(date).map(p => [p.type, p.value]));
  const asUTC = Date.UTC(+parts.year, +parts.month-1, +parts.day, parts.hour==='24'?0:+parts.hour, +parts.minute, +parts.second);
  return Math.round((asUTC - date.getTime()) / 60000);
}
// prochaine occurrence (ou occurrence en cours) de chaque entrée du planning, sur 7 jours glissants
// — les horaires de BOSS_SCHEDULE sont ceux de garmoth.com, donc de l'heure FRANÇAISE (Europe/Paris),
// pas l'heure locale du navigateur du joueur (2026-07-08 : bug corrigé, un joueur hors de France
// voyait un planning décalé de son propre fuseau)
function bossOccurrences(fromDate) {
  const now = fromDate.getTime();
  const offsetMin = parisOffsetMinutes(fromDate);
  const parisParts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone:'Europe/Paris',
    year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(fromDate).map(p => [p.type, p.value]));
  const baseY = +parisParts.year, baseM = +parisParts.month-1, baseD = +parisParts.day;
  const list = [];
  for (const entry of BOSS_SCHEDULE) {
    for (let d = -1; d <= 7; d++) {
      const dow = new Date(Date.UTC(baseY, baseM, baseD+d)).getUTCDay(); // jour de la semaine à Paris
      if (entry.day !== 'daily' && dow !== entry.day) continue;
      const t = Date.UTC(baseY, baseM, baseD+d, entry.h, entry.m, 0, 0) - offsetMin*60000;
      if (t + BOSS_WINDOW_MS < now) continue; // déjà terminé
      list.push({ boss:entry.boss, time:t, live: t <= now && now < t + BOSS_WINDOW_MS });
    }
  }
  return list.sort((a,b) => a.time - b.time);
}
// boss "global" déclenché par l'admin pour TOUS les joueurs (état partagé via Supabase, table
// live_boss). Prioritaire sur le planning horaire : s'il est actif, il apparaît comme "EN COURS"
// pour tout le monde. Rafraîchi périodiquement (voir refreshLiveBoss).
let liveBoss = null; // { boss, time, expires } quand un spawn global est en cours
async function refreshLiveBoss() {
  if (!sb) return;
  const wasLive = !!(liveBoss && liveBoss.expires > Date.now());
  try {
    // ensure_scheduled_boss vérifie CÔTÉ SERVEUR si une occurrence du planning (Kzarka) doit être
    // en cours maintenant et, si oui, s'assure que live_boss la reflète (sans écraser un spawn admin
    // déjà actif) — rend le boss du planning RÉELLEMENT partagé (PV communs, tout le monde se voit
    // dans l'arène) au lieu d'une instance solo par joueur. Demande explicite du 2026-07-06.
    // Retombe sur une simple lecture si l'appel échoue, pour ne jamais bloquer l'affichage du lobby.
    let data = null;
    try {
      const r = await sb.rpc('ensure_scheduled_boss');
      data = Array.isArray(r.data) ? r.data[0] : r.data;
    } catch (e) {}
    if (!data) {
      const r = await sb.from('live_boss').select('boss_id, spawned_at, expires_at, hp, max_hp').eq('id', 1).maybeSingle();
      data = r.data;
    }
    if (data && data.boss_id && BOSS_ROSTER[data.boss_id] && new Date(data.expires_at).getTime() > Date.now()) {
      liveBoss = { boss: data.boss_id, time: new Date(data.spawned_at).getTime(), expires: new Date(data.expires_at).getTime(),
                   hp: Number(data.hp||0), maxHp: Number(data.max_hp||0) };
    } else liveBoss = null;
  } catch (e) {}
  updateNextBossMini();
  // si le statut "en cours" a changé pendant qu'un joueur regarde le lobby (sans être en plein
  // combat), on re-render le lobby pour que le bouton "Combattre" apparaisse/disparaisse tout seul
  const nowLive = !!(liveBoss && liveBoss.expires > Date.now());
  const room = $('bossRoom');
  if (nowLive !== wasLive && room && room.classList.contains('open') && room.classList.contains('lobby') && !bossState.active) {
    $('bossLobbyBody').innerHTML = renderBossLobbyHtml();
    wireBossLobby();
  }
}
function nextBossOccurrence() {
  // un spawn global admin encore valide passe avant tout -- hp/maxHp exposés (2026-07-15, demande
  // explicite : "si tu arrive trop tard et que le boss a été tué tu as un message... revenir plus
  // tard") pour que le lobby puisse distinguer "encore en vie" de "déjà à 0 PV mais fenêtre encore
  // ouverte" (le boss reste "live" tout le créneau de 9 min même mort, voir refreshLiveBoss)
  if (liveBoss && liveBoss.expires > Date.now()) return { boss: liveBoss.boss, time: liveBoss.time, live: true, sharedHp: true, hp: liveBoss.hp, maxHp: liveBoss.maxHp };
  const occ = bossOccurrences(new Date());
  return occ.find(o => o.live) || occ[0] || null;
}
function fmtBossCountdown(ms) {
  let s = Math.max(0, Math.floor(ms/1000));
  const h = Math.floor(s/3600); s -= h*3600;
  const m = Math.floor(s/60); s -= m*60;
  const pad = n => String(n).padStart(2,'0');
  return (h>0 ? pad(h)+':' : '') + pad(m)+':'+pad(s);
}
// petit rappel dans la barre d'activités, mis à jour chaque seconde
function updateNextBossMini() {
  const el = $('nextBossMini'); if (!el) return;
  const occ = nextBossOccurrence();
  if (!occ) { el.innerHTML = ''; return; }
  const b = BOSS_ROSTER[occ.boss];
  if (occ.live) {
    el.innerHTML = `<span class="live">${b.icon} ${b.short[LANG]} ${LANG==='fr'?'EN COURS':'LIVE'}</span>`;
  } else {
    el.innerHTML = `${LANG==='fr'?'Prochain boss':'Next boss'} : <b>${b.icon} ${b.short[LANG]}</b> ${LANG==='fr'?'dans':'in'} <b>${fmtBossCountdown(occ.time - Date.now())}</b>`;
  }
}

// liste des "pages" affichée en header au-dessus du jeu (demande utilisateur) : Zone / Boss +
// activités verrouillées en teaser. Cliquer une page bascule la vue du jeu.
const ACTIVITY_TABS = [
  { id:'zone', icon:'⚔️', name:{fr:'Zone',en:'Zone'},       locked:false },
  { id:'boss', icon:'🐍', name:{fr:'Boss',en:'Boss'},       locked:false },
  { id:'fish', icon:'🎣', name:{fr:'Pêche',en:'Fishing'},   locked:true },
  { id:'mine', icon:'⛏️', name:{fr:'Mine',en:'Mining'},     locked:true },
  { id:'forest', icon:'🌲', name:{fr:'Forêt',en:'Forest'},  locked:true },
  { id:'field', icon:'🌾', name:{fr:'Champs',en:'Fields'},  locked:true },
  { id:'ranch', icon:'🐑', name:{fr:'Bergerie',en:'Ranch'}, locked:true },
  { id:'workshop', icon:'🏛️', name:{fr:'Atelier royal',en:'Royal Workshop'}, locked:true },
];
let currentActivity = 'zone';
function renderActivityTabs() {
  const el = $('activityTabs'); if (!el) return;
  el.innerHTML = ACTIVITY_TABS.map(t =>
    `<button class="actTab${t.locked?' locked':''}${t.id===currentActivity?' active':''}" data-id="${t.id}"${t.locked?' disabled':''}>${t.icon} ${t.name[LANG]}${t.locked?' 🔒':''}</button>`).join('');
  el.querySelectorAll('.actTab').forEach(btn => {
    if (btn.classList.contains('locked')) return;
    btn.onclick = () => showActivityPage(btn.dataset.id);
  });
}
// affiche/masque la vue "farm" (canvas + panneaux) — le header (barre d'activités) n'est
// JAMAIS masqué : le boss s'insère juste en dessous, dans le flux du jeu
function setFarmViewVisible(v) {
  ['gameFrame','panel','itemPop','itemTooltip'].forEach(id => {
    const el = $(id); if (el) el.style.display = v ? '' : 'none';
  });
}
function showActivityPage(id) {
  if (id === 'boss') {
    currentActivity = 'boss';
    setFarmViewVisible(false);
    if (!bossState.active) openBossLobby();
  } else { // zone = retour au farm
    currentActivity = 'zone';
    if (!bossState.active) $('bossRoom').classList.remove('open');
    setFarmViewVisible(true);
  }
  renderActivityTabs();
}

// affiche la page Boss (lobby) : prochain boss + calendrier, dans la colonne du jeu, pleine hauteur
async function openBossLobby() {
  $('bossRoom').classList.remove('fight'); $('bossRoom').classList.add('lobby', 'open');
  // rafraîchit d'abord l'état du boss global (spawn admin) pour que la page reflète tout de suite
  // ce que voit le serveur, sans attendre le prochain tick de polling (20 s)
  await refreshLiveBoss();
  $('bossLobbyBody').innerHTML = renderBossLobbyHtml();
  wireBossLobby();
}
function renderBossLobbyHtml() {
  const occ = nextBossOccurrence();
  const now = Date.now();
  let nextHtml = `<div class="admEmpty">${LANG==='fr'?'Aucun boss programmé':'No boss scheduled'}</div>`;
  if (occ) {
    const b = BOSS_ROSTER[occ.boss];
    // boss partagé déjà à 0 PV mais fenêtre de 9 min encore ouverte (2026-07-15, demande explicite :
    // "si tu arrive trop tard et que le boss a été tué tu as un message... revenir plus tard") --
    // occ.live restait vrai (basé sur expires, pas sur hp), laissant un joueur en retard "entrer"
    // dans un combat déjà gagné sans avoir tapé, avec le risque de repartir sans rien (voir
    // endBossFight/boss_claim, -1 = aucune contribution). Bloqué en amont, avant même d'entrer.
    const alreadyDead = occ.live && occ.sharedHp && typeof occ.hp === 'number' && occ.hp <= 0;
    const cd = occ.live
      ? `<div class="bossNextCountdown live">${alreadyDead ? (LANG==='fr'?'VAINCU':'DEFEATED') : (LANG==='fr'?'EN COURS':'LIVE')}</div>`
      : `<div class="bossNextCountdown" id="bossPanelCountdown">${fmtBossCountdown(occ.time - now)}</div>`;
    const when = new Date(occ.time).toLocaleString(LANG==='fr'?'fr-FR':'en-US', { weekday:'long', hour:'2-digit', minute:'2-digit' });
    nextHtml = `<div class="bossNext">
      <div class="bossNextIcon">${b.icon}</div>
      <div class="bossNextInfo">
        <div class="bossNextName">${b.name[LANG]}</div>
        <div class="bossNextTime">${alreadyDead ? (LANG==='fr'?'Déjà vaincu par d\'autres joueurs':'Already defeated by other players') : occ.live ? (LANG==='fr'?'Disponible maintenant !':'Available now!') : when}</div>
      </div>
      ${cd}
    </div>` +
    (alreadyDead
      ? `<div class="admHint">${LANG==='fr'?'Ce boss a déjà été vaincu — reviens plus tard, au prochain spawn.':'This boss has already been defeated — come back later, at the next spawn.'}</div>` +
        `<button class="bossFightBtn" id="bossFightBtn" disabled>${LANG==='fr'?'💀 Déjà vaincu':'💀 Already defeated'}</button>`
      : `<button class="bossFightBtn" id="bossFightBtn" ${occ.live?'':'disabled'}>${occ.live?(LANG==='fr'?'⚔️ Combattre':'⚔️ Fight'):(LANG==='fr'?'⏳ Pas encore apparu':'⏳ Not spawned yet')}</button>`);
  }
  // VRAI calendrier hebdomadaire : grille jours (colonnes) × heures de spawn (lignes), le nom du
  // boss dans chaque case. Seuls les boss implémentés (BOSS_ROSTER) apparaissent.
  const weekOcc = bossOccurrences(new Date()).filter(o => o.time < now + 7*24*3600*1000);
  const dayKey = d => d.getFullYear()+'-'+d.getMonth()+'-'+d.getDate();
  const todayKey = dayKey(new Date());
  // colonnes : aujourd'hui + 6 jours
  const days = [];
  for (let i=0;i<7;i++){ const d=new Date(); d.setDate(d.getDate()+i); d.setHours(0,0,0,0); days.push(d); }
  // lignes : heures de spawn distinctes de la semaine, triées
  const timeSet = new Set();
  weekOcc.forEach(o => { const d=new Date(o.time); timeSet.add(String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')); });
  const times = [...timeSet].sort();
  const cellMap = new Map();
  weekOcc.forEach(o => { const d=new Date(o.time); cellMap.set(dayKey(d)+'@'+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'), o); });
  let calHtml;
  if (!times.length) {
    calHtml = `<div class="admEmpty">${LANG==='fr'?'Rien de programmé':'Nothing scheduled'}</div>`;
  } else {
    calHtml = `<div class="bossCal" style="grid-template-columns:44px repeat(7,1fr)">`;
    calHtml += `<div class="bcCorner"></div>`;
    days.forEach(d => { const today = dayKey(d)===todayKey;
      calHtml += `<div class="bcHead${today?' bcToday':''}">${d.toLocaleDateString(LANG==='fr'?'fr-FR':'en-US',{weekday:'short'})}<span class="bcDate">${d.getDate()}/${d.getMonth()+1}</span></div>`; });
    times.forEach(tm => {
      calHtml += `<div class="bcTime">${tm}</div>`;
      days.forEach(d => {
        const o = cellMap.get(dayKey(d)+'@'+tm);
        if (o) { const b=BOSS_ROSTER[o.boss];
          calHtml += `<div class="bcCell${o.live?' bcLive':''}" title="${b.name[LANG]}">${b.icon}<span class="bcName">${o.live?(LANG==='fr'?'EN COURS':'LIVE'):b.short[LANG]}</span></div>`; }
        else calHtml += `<div class="bcCell bcEmpty"></div>`;
      });
    });
    calHtml += `</div>`;
  }
  // légende des boss (nom complet)
  const legend = Object.values(BOSS_ROSTER).map(b => `<span class="bcLegend">${b.icon} ${b.name[LANG]}</span>`).join('');
  // règles de récompense "visibles par tous" (2026-07-15, demande explicite : "met ces recompense
  // dans boss visible par tous") -- affichées dans le lobby, avant même de combattre, calculées
  // pour SA propre progression (chaque joueur voit son propre aperçu, la règle est la même pour tous).
  // Repositionnées le 2026-07-16 (demande explicite : "podium world boss en dessous des horaire de
  // boss") -- vivaient avant juste sous le countdown/prochain spawn (nextHtml) et AVANT le calendrier
  // hebdomadaire ; désormais après le calendrier complet, qui compte comme "les horaires de boss".
  return `${nextHtml}
    <h3>${LANG==='fr'?'📅 Calendrier de la semaine':'📅 Weekly calendar'}</h3>
    ${calHtml}
    <div class="bcLegendRow">${legend}</div>
    <div class="admSummary">${LANG==='fr'?'Horaires calqués sur le vrai BDO −15 min. Heure locale.':'Times mirror real BDO −15 min. Local time.'}</div>
    ${bossRewardRulesHtml()}`;
}
function wireBossLobby() {
  const btn = $a('bossFightBtn');
  const occ = nextBossOccurrence();
  if (btn && !btn.disabled && occ) btn.onclick = () => startBossFight(occ.boss, !!occ.sharedHp);
  // sélecteur Kzarka/Vell de l'aperçu de récompense (2026-07-16, demande explicite) : re-render
  // complet du lobby au clic, même idiome que refreshLiveBoss() plus haut
  document.querySelectorAll('.bossRewardSelSeg').forEach(seg => {
    seg.onclick = () => {
      bossRewardPreviewBoss = seg.dataset.boss;
      $('bossLobbyBody').innerHTML = renderBossLobbyHtml();
      wireBossLobby();
    };
  });
}

// ---- combat de boss : plein écran, canvas dédié, boucle rAF indépendante du farm ----
const bossState = { active:false, boss:null, hp:0, maxHp:0, duration:0, elapsed:0, playerHp:0, playerHpMax:0, hits:[], last:0, raf:0, potCd:0, ended:false,
  px:0.5, py:0.85, pillars:[], aoePhase:'idle', aoeT:0, aoeInterval:9, blocked:false, blockFlash:0, hurtFlash:0, floatMsgs:[],
  // ---- world boss PARTAGÉ (spawn admin) : PV communs à tous, contribution reportée au serveur ----
  shared:false, expiresAt:0, contribAccum:0, contribCd:0, topCd:0, topList:[], myDmg:0, activeFighters:0, presenceCd:0,
  // ---- effet de profondeur/immersion ("4D") : tremblement d'écran + braises de corruption en parallaxe ----
  shakeT:0, embers:[] };
// ---- présence en direct des autres joueurs dans la salle de boss PARTAGÉ (Supabase Realtime,
// pas de table nécessaire) : chaque joueur diffuse sa position normalisée dans l'arène, on
// affiche les autres comme de petites silhouettes + pseudo — demande explicite : "tous les
// joueurs doivent se voir dans la zone du boss", pas juste un classement textuel
let bossChannel = null;
let otherFighters = {}; // uid -> { pseudo, px, py } — dernière position BRUTE reçue via Presence
let otherFightersPos = {}; // uid -> { x, y } — position lissée affichée à l'écran (voir bossLoop)
// traces de diagnostic (2026-07-08, demande explicite : "les joueurs ne se voient pas en world
// boss") : le partage des PV/top10 fonctionne (confirmé), donc le souci se situe précisément dans
// ce canal de présence Realtime — ces logs préfixés [BossPresence] permettent de vérifier, la
// prochaine fois que ça se reproduit, si les 2 joueurs rejoignent bien le MÊME topic, si le
// statut passe à SUBSCRIBED, et si l'event 'sync' renvoie bien l'autre joueur
function joinBossChannel(bossKey) {
  leaveBossChannel();
  if (!sb || !currentUser) { console.debug('[BossPresence] abandon (pas de sb ou pas connecté)'); return; }
  const myUid = currentUser.id;
  const topic = 'boss_'+bossKey;
  console.debug('[BossPresence] join', { topic, myUid });
  const ch = sb.channel(topic, { config: { presence: { key: myUid } } });
  bossChannel = ch;
  ch.on('presence', { event: 'sync' }, () => {
    const state = ch.presenceState();
    console.debug('[BossPresence] sync', { topic, keys: Object.keys(state) });
    const next = {};
    for (const uid in state) {
      if (uid === myUid) continue;
      const entry = state[uid] && state[uid][0];
      if (entry) next[uid] = entry;
    }
    otherFighters = next;
  });
  ch.subscribe(status => {
    console.debug('[BossPresence] status', { topic, status });
    if (status === 'SUBSCRIBED') { ch.track({ pseudo: myPseudo || 'Joueur', px: bossState.px, py: bossState.py }); return; }
    // reconnexion automatique (2026-07-08, bug confirmé en prod : le canal passe parfois à CLOSED
    // tout seul — coupure réseau/Realtime — sans qu'aucun code du jeu ne l'ait fermé, et rien ne le
    // rétablissait ensuite, laissant les joueurs invisibles les uns aux autres pour le reste du
    // combat) : si CE canal est toujours celui en cours d'utilisation et que le combat partagé est
    // toujours actif, on retente un rejoin après un court délai
    if ((status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && bossChannel === ch) {
      console.debug('[BossPresence] reconnexion programmée', { topic, status });
      setTimeout(() => { if (bossChannel === ch && bossState.active && bossState.shared) joinBossChannel(bossKey); }, 1500);
    }
  });
}
function leaveBossChannel() {
  if (bossChannel) console.debug('[BossPresence] leave', { topic: bossChannel.topic });
  if (bossChannel && sb) { try { sb.removeChannel(bossChannel); } catch(e) {} }
  bossChannel = null;
  otherFighters = {};
  otherFightersPos = {};
}
// 4 piliers de la salle (coords normalisées 0..1) — on se cache DERRIÈRE (en dessous) pour éviter l'AoE
const BOSS_PILLARS = [{x:.28,y:.44},{x:.72,y:.44},{x:.28,y:.72},{x:.72,y:.72}];
// 10 spots fixes où chaque joueur "attaque" (2026-07-08, demande explicite : "prévoir une dizaine
// de spot fixe pour les joueurs... les joueurs vont arriver aléatoirement dans une des zones
// prévues et se voir") — remplace l'ancien BOSS_ATTACK_POS unique où tout le monde se superposait
// exactement au même endroit ; chaque joueur pioche un spot au hasard au début du combat (voir
// startBossFight) et y revient entre deux AoE, ce qui les répartit visiblement dans l'arène tout en
// restant à portée pour la stratégie commune (esquive vers le pilier/l'ancre le plus proche)
const BOSS_SPOTS_KZARKA = [
  {x:.18,y:.58},{x:.50,y:.52},{x:.82,y:.58},
  {x:.28,y:.66},{x:.72,y:.66},
  {x:.14,y:.76},{x:.38,y:.80},{x:.50,y:.84},{x:.62,y:.80},{x:.86,y:.76},
];
// Vell : les joueurs sont sur les pontons des 2 bateaux (demande explicite du 2026-07-08), 5 spots
// par bateau échelonnés le long du pont, pas dans l'eau
const BOSS_SPOTS_VELL = [
  {x:.06,y:.86},{x:.11,y:.89},{x:.16,y:.92},{x:.09,y:.95},{x:.14,y:.97},
  {x:.94,y:.86},{x:.89,y:.89},{x:.84,y:.92},{x:.91,y:.95},{x:.86,y:.97},
];
function bossAttackSpots(bossId) { return bossId === 'vell' ? BOSS_SPOTS_VELL : BOSS_SPOTS_KZARKA; }
const bossCtx = document.getElementById('bossCv').getContext('2d');
// DPS nominal ≈ PA effective × somme(dmg/cd des sorts) ; sert à calculer une durée dans [2,9] min.
// SKILLS étant déclaré plus bas dans le fichier, la somme est calculée paresseusement (au 1er appel)
// pour éviter une erreur TDZ au chargement.
let _skillDpsSum = 0;
// DPS de référence pour un joueur à PA "adaptée" (~250) : sert à calibrer les PV du boss partagé
// (400000 PV / 300s = ~5 min pour ce stuff, cf commentaire du roster) sans dépendre du stuff de l'admin
const BOSS_REF_DPS = 1333;
function playerBossDps() {
  if (!_skillDpsSum) _skillDpsSum = SKILLS.filter(s => s.dmg).reduce((a,s) => a + s.dmg/s.cd, 0);
  return Math.max(1, apEff() * _skillDpsSum);
}
function startBossFight(bossId, isShared) {
  const b = BOSS_ROSTER[bossId];
  // boss PARTAGÉ (spawn admin, PV communs) : les PV/durée viennent du serveur (liveBoss), pas du stuff perso
  const shared = !!isShared && liveBoss && liveBoss.expires > Date.now();
  const hp = shared ? liveBoss.hp : b.hp;
  const maxHp = shared ? liveBoss.maxHp : b.hp;
  const rawDur = b.hp / playerBossDps();           // durée "naturelle" selon ton stuff (boss solo uniquement)
  const duration = Math.max(120, Math.min(420, rawDur)); // clampée à [2 min, 7 min]
  // Vell (2026-07-08, demande explicite) : les joueurs sont SUR les bateaux — les abris ne sont
  // plus des piliers de pierre mais les ancres des 2 bateaux, on plonge dessous pour se protéger
  const spots = bossId === 'vell' ? VELL_ANCHORS : BOSS_PILLARS;
  // spot d'attaque personnel, tiré au hasard parmi les 10 spots fixes (voir BOSS_SPOTS_KZARKA /
  // BOSS_SPOTS_VELL) — le joueur y apparaît directement et y revient entre deux AoE, ce qui
  // répartit visiblement tout le monde dans l'arène au lieu de s'empiler au même endroit
  const atkSpots = bossAttackSpots(bossId);
  const atkPos = { ...atkSpots[Math.floor(Math.random()*atkSpots.length)] };
  Object.assign(bossState, {
    active:true, ended:false, boss:b, bossId, hp, maxHp, duration, elapsed:0,
    playerHp: effHpMax(), playerHpMax: effHpMax(), hits:[], last:performance.now(), potCd:0,
    px:atkPos.x, py:atkPos.y, atkPos, pillars:spots.map(p=>({...p})), aoePhase:'idle', aoeT:0, aoeInterval:8,
    blocked:false, blockFlash:0, hurtFlash:0, floatMsgs:[],
    shared, expiresAt: shared ? liveBoss.expires : 0, contribAccum:0, contribCd:0, topCd:0, topList:[], myDmg:0, activeFighters:0,
    shakeT:0, embers:[],
  });
  currentActivity = 'boss'; renderActivityTabs();
  setFarmViewVisible(false);
  $('bossRoom').classList.remove('lobby'); $('bossRoom').classList.add('open', 'fight');
  $('bossResult').classList.remove('show');
  $('bossName').textContent = b.name[LANG] + (shared ? ' 🌐' : '');
  $('bossTopPanel').classList.toggle('show', shared);
  if (shared) { refreshBossTop(); joinBossChannel(liveBoss.time); } else { leaveBossChannel(); }
  resizeBossCanvas();
  bossState.raf = requestAnimationFrame(bossLoop);
}
// classement de contribution en direct (top 10 affiché en %, avec un point vert pour les joueurs
// actuellement en train de taper) + compteur "X joueurs combattent en direct" — demande explicite :
// "les joueurs doivent se voir et voir le top 10 de degats en % en direct"
async function refreshBossTop() {
  if (!sb || !bossState.shared) return;
  try {
    const [{ data }, { data: activeCount }] = await Promise.all([
      sb.rpc('boss_top'), sb.rpc('boss_active_count'),
    ]);
    bossState.topList = data || [];
    bossState.activeFighters = typeof activeCount === 'number' ? activeCount : 0;
    renderBossTop();
  } catch (e) {}
}
function renderBossTop() {
  const el = $('bossTopList'); if (!el) return;
  const liveEl = $('btpLiveCount');
  if (liveEl) {
    const n = bossState.activeFighters || 0;
    liveEl.textContent = n > 0
      ? (LANG==='fr' ? `${n} joueur${n>1?'s':''} combattent` : `${n} player${n>1?'s':''} fighting`)
      : (LANG==='fr' ? 'En attente de combattants' : 'Waiting for fighters');
  }
  const list = bossState.topList.slice(0, 10);
  if (!list.length) { el.innerHTML = `<div class="btpRow">${LANG==='fr'?'Sois le premier !':'Be the first!'}</div>`; return; }
  el.innerHTML = list.map((r,i) =>
    `<div class="btpRow${currentUser && r.user_id===currentUser.id?' me':''}"><span class="btpRank">#${i+1}</span>` +
    `<span class="btpPseudo">${r.active?'<span class="btpActiveDot"></span>':''}${escapeHtml(r.pseudo||'?')}</span>` +
    `<span class="btpPct">${(r.pct!=null?r.pct:0)}%</span><span class="btpDmg">${fmt(Math.round(r.damage))}</span></div>`).join('');
}
function resizeBossCanvas() {
  const cv = $('bossCv');
  cv.width = cv.clientWidth || 1280;
  cv.height = cv.clientHeight || 600;
}
// multiplicateur de récompense selon le RANG de contribution (boss partagé) : plus haut dans le
// top, plus la récompense est intéressante — cf demande "plus t'es haut plus la recompense est interessante"
function bossRankMultiplier(rank) {
  if (rank === 1) return 3;
  if (rank <= 3) return 2;
  if (rank <= 10) return 1.4;
  return 1; // hors du top 10 : récompense de base pour avoir participé
}
// récompenses de World Boss basées sur la PROGRESSION du joueur (2026-07-15, demande explicite) --
// remplace l'ancien matériau fixe par palier (matKey/matQty du roster) par une pierre d'optimisation
// de SA meilleure zone "ZONE DIFFICILE" (garantie pour tout le monde) + un bijou bonus selon le
// rang de contribution : #1 -> bijou de la PROCHAINE "ZONE DANGEREUSE" (au-dessus de son niveau
// actuel) ; #2 -> bijou de sa propre zone difficile ; #3 -> 20% de chance de bijou zone dangereuse
// + 30% de chance (tirage indépendant) de bijou zone difficile. Réutilise EXACTEMENT les mêmes
// formules que rollDrops (GEAR_ROLE.jackpot.apShare, JACKPOT_VAL_TRASH_RATIO) pour rester cohérent
// avec le loot normal de ces zones.
// "meilleure zone difficile" = parmi les zones classées ZONE DIFFICILE (bottleneck 0.6-0.9), la
// plus avancée (reqAP le plus haut) -- celle qui représente le mieux sa progression actuelle.
function bestDifficileZoneIdx() {
  let best = -1;
  for (let zi = 0; zi < ZONES.length; zi++) {
    if (badgeOf(bottleneck(ZONES[zi])).txt === 'ZONE DIFFICILE' && (best === -1 || ZONES[zi].reqAP > ZONES[best].reqAP)) best = zi;
  }
  return best === -1 ? null : best;
}
// "prochaine zone dangereuse" = parmi les zones classées ZONE DANGEREUSE (bottleneck < 0.6), la
// moins hors de portée (reqAP le plus bas) -- celle juste au-dessus de ce que le joueur peut
// actuellement gérer, pas une zone endgame totalement hors d'atteinte.
function nextDangereuseZoneIdx() {
  let best = -1;
  for (let zi = 0; zi < ZONES.length; zi++) {
    if (badgeOf(bottleneck(ZONES[zi])).txt === 'ZONE DANGEREUSE' && (best === -1 || ZONES[zi].reqAP < ZONES[best].reqAP)) best = zi;
  }
  return best === -1 ? null : best;
}
function bossZoneJackpotItem(zi) {
  const z = ZONES[zi], tier = gearTierForZone(zi);
  const jSlot = accSlotFor(z.loot.jackpot);
  const jTierIdx = JEWEL_TIER_IDX[tier.grade] ?? 0;
  const JEWEL_ICON_FOR_SLOT = { ring:ringIconForTier, necklace:necklaceIconForTier, earring:earringIconForTier, belt:beltIconForTier };
  const icon = (JEWEL_ICON_FOR_SLOT[jSlot] || ringIconForTier)(jTierIdx, tier.color);
  const ap = gearFloor((z.gearBasisAP ?? z.reqAP) * GEAR_ROLE.jackpot.apShare);
  const val = gearFloor(z.loot.trash.val * JACKPOT_VAL_TRASH_RATIO);
  return { ...z.loot.jackpot, ap, val, kind:'jackpot', color:tier.color, key:'acc_boss_'+zi+'_'+Math.random().toString(36).slice(2,7), icon, stackable:false, weight:0.5, matName:tier.material.name };
}
function bossZoneMaterialItem(zi, qty) {
  const tier = gearTierForZone(zi), z = ZONES[zi];
  return { name:tier.material.name, kind:'material', icon:tier.material.icon, color:tier.material.color, key:'mat_'+tier.material.name, qty, stackable:true, weight:0.1, val:z.loot.mat.val };
}
// sélecteur Kzarka/Vell de l'aperçu de récompense (2026-07-16, demande explicite : "affiche les
// recompense en dessous des horaires boss avec un selecteur vell/kzarka et un podium") -- la
// formule de récompense (zone difficile/dangereuse, rang de contribution) est IDENTIQUE pour les
// 2 boss, seule la ligne "extra" (Coeur de Vell, voir BOSS_ROSTER.vell.rareLoot) diffère -- le
// sélecteur sert donc surtout à prévisualiser cette différence.
let bossRewardPreviewBoss = 'kzarka';
function bossRewardSelectorHtml() {
  return `<div class="bossRewardSel">` + Object.keys(BOSS_ROSTER).map(k => {
    const b = BOSS_ROSTER[k], active = bossRewardPreviewBoss === k;
    return `<div class="bossRewardSelSeg${active?' active':''}" data-boss="${k}">${b.icon} ${b.short[LANG]}</div>`;
  }).join('') + `</div>`;
}
// résumé des règles de récompense, utilisé dans le lobby (aperçu, "visible par tous" --
// demande explicite). Agrandi le 2026-07-15 (demande explicite : "recompense, affiche en plus gros
// en dessous des horaires de boss") -- avant, un simple .admHint discret, facile à manquer ;
// désormais une carte dédiée (.bossRewardRules). Restructuré en podium le 2026-07-16 (demande
// explicite) -- avant, une seule phrase en ligne listant #1/#2/#3 ; désormais un vrai podium visuel
// (2e/1er/3e) avec un sélecteur de boss au-dessus. Repositionné le même jour (demande explicite :
// "podium world boss en dessous des horaire de boss") -- vivait avant entre le countdown (nextHtml)
// et le calendrier hebdomadaire ; désormais après le calendrier complet (voir renderBossLobbyHtml).
function bossRewardRulesHtml() {
  const dZi = bestDifficileZoneIdx(), dgZi = nextDangereuseZoneIdx();
  const dName = dZi != null ? tr(ZONES[dZi].name) : '—';
  const dgName = dgZi != null ? tr(ZONES[dgZi].name) : '—';
  const b = BOSS_ROSTER[bossRewardPreviewBoss];
  const rareLine = b.rareLoot
    ? `<div class="bossRewardExtra">✨ +${Math.round(b.rareLoot.ch*100)}% ${LANG==='fr'?'de chance':'chance'} : <b style="color:${b.rareLoot.color}">${b.rareLoot.name}</b></div>`
    : '';
  return `<div class="bossRewardRules">
    ${bossRewardSelectorHtml()}
    <div class="bossRewardBase">🎁 ${LANG==='fr'?'Pour tous':'For everyone'} : ${LANG==='fr'?"pierre d'optimisation de ta meilleure zone difficile":'enhancement stone from your best hard zone'} (<b>${dName}</b>)</div>
    <div class="bossPodium">
      <div class="bossPodiumStep rank2"><div class="bossPodiumMedal">🥈</div><div class="bossPodiumReward">${LANG==='fr'?'+1 bijou de ta zone difficile':'+1 jewel from your hard zone'} (<b>${dName}</b>)</div></div>
      <div class="bossPodiumStep rank1"><div class="bossPodiumMedal">🥇</div><div class="bossPodiumReward">${LANG==='fr'?'+1 bijou de la prochaine zone dangereuse':'+1 jewel from the next dangerous zone'} (<b>${dgName}</b>)</div></div>
      <div class="bossPodiumStep rank3"><div class="bossPodiumMedal">🥉</div><div class="bossPodiumReward">${LANG==='fr'?'20% bijou dangereuse + 30% bijou difficile':'20% dangerous jewel + 30% hard jewel'}</div></div>
    </div>
    ${rareLine}
  </div>`;
}
// roue de récompense rare (2026-07-08, demande explicite) : affichée en fin de combat quand le
// boss a une table "rareLoot" définie (Vell → Coeur de Vell, 5%) — tourne toute seule et s'arrête
// sur le lot RÉELLEMENT obtenu (déjà tiré au sort avant l'animation, la roue ne fait que le révéler).
function renderBossRewardWheel(rareLoot, won) {
  const N = 12; // segments (1 rare + 11 "rien") — purement visuel, ne reflète pas le vrai % (5%)
  const segDeg = 360/N;
  const commonIcon = '🌊';
  let iconsHtml = '';
  for (let i = 0; i < N; i++) {
    const centerDeg = i*segDeg + segDeg/2;
    const isRare = i === 0;
    iconsHtml += `<span class="bwIcon" style="transform:rotate(${centerDeg}deg) translate(0,-70px) rotate(${-centerDeg}deg)">${isRare?rareLoot.icon:commonIcon}</span>`;
  }
  const wheelHtml = `<div class="bossWheelWrap"><div class="bossWheelPointer">▼</div>` +
    `<div class="bossWheel" id="bossWheelEl" style="background:conic-gradient(${rareLoot.color} 0deg ${segDeg}deg, #232128 ${segDeg}deg 360deg)">${iconsHtml}</div></div>` +
    `<div class="bossWheelResult" id="bossWheelResultEl">${LANG==='fr'?'🎡 Récompense rare...':'🎡 Rare reward...'}</div>`;
  // lance l'animation juste après l'insertion dans le DOM (voir appel dans endBossFight)
  setTimeout(() => {
    const wheel = $a('bossWheelEl'); if (!wheel) return;
    const spins = 5;
    // atterrit au CENTRE du segment rare (15°) si gagné, sinon un point sûr dans la zone "rien"
    // (60°-330°, loin des bords pour ne jamais sembler tomber sur le rare par erreur visuelle)
    const targetDeg = won ? segDeg/2 : (60 + Math.random()*270);
    const finalRotation = spins*360 - targetDeg;
    wheel.style.transform = `rotate(${finalRotation}deg)`;
    setTimeout(() => {
      const res = $a('bossWheelResultEl'); if (!res) return;
      res.innerHTML = won
        ? `<span style="color:${rareLoot.color}">${rareLoot.icon} ${LANG==='fr'?'Obtenu' : 'Obtained'} : ${rareLoot.name} !</span>`
        : (LANG==='fr' ? `Pas cette fois — ${rareLoot.icon} ${rareLoot.name} attend toujours` : `Not this time — ${rareLoot.icon} ${rareLoot.name} still awaits`);
    }, 3600);
  }, 50);
  return wheelHtml;
}
async function endBossFight(win) {
  if (bossState.ended) return;
  bossState.ended = true;
  bossState.active = false;
  cancelAnimationFrame(bossState.raf);
  leaveBossChannel();
  const b = bossState.boss;
  let rewardsHtml = '';
  let wheelHtml = '';
  // BUG D'EXPLOIT corrigé le 2026-07-08 ("quand un world boss meurt, plus moyen d'y retourner et
  // de récupérer 2x la récompense") : sur un boss PARTAGÉ, boss_claim() était déjà correctement
  // bloqué côté serveur pour une 2e réclamation (table boss_claims, contrainte par user+boss_key),
  // MAIS le code ci-dessous accordait quand même silver/matériau/loot rare INCONDITIONNELLEMENT,
  // sans jamais vérifier si l'appel avait réussi — rentrer dans l'arène d'un boss partagé déjà à
  // 0 PV redéclenchait endBossFight(true) instantanément (voir bossLoop) et regagnait la
  // récompense complète à chaque fois. Sur un boss SOLO (test perso, pas de table de réclamation),
  // rien ne change : chaque combat est une instance fraîche et légitime.
  let alreadyClaimed = false;
  if (win) {
    let mult = 1, rank = null;
    if (bossState.shared && sb) {
      try {
        // BUG corrigé le 2026-07-15 (demande explicite : "ça affiche victoire sans donner de loot
        // alors qu'il a tapé le boss solo") : le dernier paquet de dégâts (bossState.contribAccum)
        // n'est envoyé au serveur que toutes les 1.2s (voir bossLoop) -- si le boss tombe à 0 PV
        // AVANT le prochain envoi programmé (typique d'un kill très rapide, tout juste soloé), ce
        // dernier paquet n'était JAMAIS transmis avant l'appel à boss_claim() juste en dessous : le
        // serveur ne voyait alors AUCUNE contribution enregistrée pour ce joueur et boss_claim()
        // renvoyait -1 ("aucune contribution"), refusant la récompense malgré une vraie victoire.
        // On force désormais l'envoi de ce reliquat, ATTENDU avant de réclamer, pour que le serveur
        // ait toujours la contribution complète au moment du claim.
        if (bossState.contribAccum > 0) {
          const dmg = bossState.contribAccum; bossState.contribAccum = 0;
          try { await sb.rpc('boss_contribute', { p_damage: dmg, p_pseudo: myPseudo || null }); } catch (e) {}
        }
        const { data } = await sb.rpc('boss_claim');
        if (typeof data === 'number' && data > 0) { rank = data; mult = bossRankMultiplier(rank); }
        // -1 : déjà réclamé, aucune contribution, ou boss pas encore à 0 PV. L'alerte Discord pour
        // le vrai cas de double réclamation part désormais depuis boss_claim() lui-même, côté
        // serveur, directement sur le salon "cheat" (déplacé le 2026-07-08 : elle partait avant sur
        // le salon général, côté client) — plus fiable, ne peut pas être usurpé
        else alreadyClaimed = true;
      } catch (e) { alreadyClaimed = true; } // en cas de doute (erreur réseau), ne JAMAIS accorder par défaut
    }
    if (alreadyClaimed) {
      rewardsHtml = `<div class="brRewards admHint">${LANG==='fr'
        ? 'Récompense déjà réclamée pour ce boss — chaque victoire ne peut être payée qu\'une seule fois.'
        : 'Reward already claimed for this boss — each victory can only be paid out once.'}</div>`;
    } else {
      // Le loot des World Boss dépend de la MEILLEURE zone découverte, mais seulement si le joueur
      // n'est pas mort depuis au moins 3 minutes ("certifié sans mort") — demande explicite du
      // 2026-07-08. Sans ce certificat, la récompense reste la valeur de base (aucun bonus de zone).
      const deathFreeMs = Date.now() - (S.lastDeathAt || 0);
      const deathFreeOk = deathFreeMs >= 3*60*1000;
      const zoneMult = deathFreeOk ? 1 + (S.maxZoneIdx/(ZONES.length-1))*1.5 : 1;
      const reward = Math.round(b.reward * mult * zoneMult);
      addSilver(reward, 'boss', b.name.fr);
      // combat SOLO (pas de classement possible, instance perso) : traité comme rang #1, seul
      // participant -- il n'y a personne avec qui "partager" le meilleur lot (2026-07-15)
      if (!bossState.shared) rank = 1;
      // récompenses par zone de progression (2026-07-15, demande explicite : "les recompense sont
      // en fonction de ta meilleure zone difficile... + 1 bijou de la prochaine zone dangereuse si
      // tu es premier...") -- remplace l'ancien matériau fixe du roster (matKey/matQty) par une
      // pierre d'optimisation de la meilleure zone difficile (garantie pour tous) + bijoux bonus
      // selon le rang, voir bossZoneMaterialItem/bossZoneJackpotItem/bestDifficileZoneIdx ci-dessus.
      const difficileZi = bestDifficileZoneIdx(), dangereuseZi = nextDangereuseZoneIdx();
      const zoneRewardLines = [];
      if (difficileZi != null) {
        const qty = Math.max(1, Math.round((3 + Math.random()*5) * mult * zoneMult));
        const matItem = bossZoneMaterialItem(difficileZi, qty);
        invAdd(matItem);
        zoneRewardLines.push(`+${qty} × ${tr(matItem.name)} <span class="admHint">(${tr(ZONES[difficileZi].name)})</span>`);
      }
      const jewelZonesToGrant = [];
      if (rank === 1 && dangereuseZi != null) jewelZonesToGrant.push(dangereuseZi);
      else if (rank === 2 && difficileZi != null) jewelZonesToGrant.push(difficileZi);
      else if (rank === 3) {
        if (dangereuseZi != null && Math.random() < 0.20) jewelZonesToGrant.push(dangereuseZi);
        if (difficileZi != null && Math.random() < 0.30) jewelZonesToGrant.push(difficileZi);
      }
      for (const zi of jewelZonesToGrant) {
        const jItem = bossZoneJackpotItem(zi);
        if (invAdd(jItem)) {
          trackLoot(jItem.name);
          zoneRewardLines.push(`+💎 ${tr(jItem.name)} <span class="admHint">(${tr(ZONES[zi].name)})</span>`);
          logToDiscord('💎 Bijou de World Boss', `**${myPseudo||'Joueur'}** obtient ${jItem.name} (rang #${rank}) sur ${b.name.fr}`, 0xb48ce8);
        }
      }
      const rankHtml = rank ? `<div class="brRewards">${LANG==='fr'?'Rang de contribution':'Contribution rank'} : <b>#${rank}</b></div>` : '';
      const zoneHtml = `<div class="brRewards admHint">${deathFreeOk
        ? (LANG==='fr'?`Bonus de zone (${tr(ZONES[S.maxZoneIdx].name)}) : certifié sans mort ✓ ×${zoneMult.toFixed(2)}`:`Zone bonus (${tr(ZONES[S.maxZoneIdx].name)}): death-free certified ✓ ×${zoneMult.toFixed(2)}`)
        : (LANG==='fr'?'Pas de bonus de zone : mort il y a moins de 3 min':'No zone bonus: died less than 3 min ago')}</div>`;
      rewardsHtml = rankHtml + `<div class="brRewards">+${fmt(reward)} 🪙<br>${zoneRewardLines.join('<br>')}</div>` + zoneHtml;
      pushNotif('🏆', LANG==='fr'?'Boss vaincu':'Boss defeated', b.name[LANG]+' — +'+fmt(reward)+' 🪙', 'success');
      logToDiscord('🏆 Boss vaincu', `**${myPseudo||'Joueur'}** a vaincu ${b.name.fr}${rank?' (rang #'+rank+')':''} — +${fmt(reward)} 🪙`, 0xe8b84a);
      if (bossState.bossId) markBossDefeated(bossState.bossId); // Compendium (2026-07-08)
      // roue de récompense rare (Coeur de Vell, etc.) : le tirage a lieu MAINTENANT, la roue ne fait
      // que révéler ce qui a déjà été décidé
      if (b.rareLoot) {
        const won = Math.random() < b.rareLoot.ch;
        if (won) {
          invAdd({ name:b.rareLoot.name, kind:'craft', icon:b.rareLoot.icon, color:b.rareLoot.color, key:'craft_'+b.rareLoot.name, qty:1, stackable:true, weight:0.3, val:0 });
          trackLoot(b.rareLoot.name);
          logToDiscord('❤️‍🔥 Loot rarissime', `**${myPseudo||'Joueur'}** obtient ${b.rareLoot.name} sur ${b.name.fr} ! (${Math.round(b.rareLoot.ch*100)}% de chance)`, 0x5ec9e8);
        }
        wheelHtml = renderBossRewardWheel(b.rareLoot, won);
      }
      refreshStatsOnly(); hud();
    }
  }
  $('bossResult').innerHTML =
    `<div class="brTitle ${win?'win':''}">${win?(LANG==='fr'?'🏆 VICTOIRE':'🏆 VICTORY'):(LANG==='fr'?'Combat quitté':'Fight left')}</div>` +
    rewardsHtml + wheelHtml +
    `<button id="bossCloseBtn">${LANG==='fr'?'Retour':'Back'}</button>`;
  $('bossResult').classList.add('show');
  // au retour, on revient au lobby Boss (pas au farm) pour rester cohérent avec la nav par pages
  $a('bossCloseBtn').onclick = () => { $('bossResult').classList.remove('show'); openBossLobby(); };
}
function bossLoop(now) {
  if (!bossState.active) return;
  const dt = Math.min(.05, (now - bossState.last)/1000); bossState.last = now;
  bossState.elapsed += dt;
  // dégâts au boss : boss solo → linéaires sur la durée choisie ; boss PARTAGÉ → DPS réel du joueur,
  // reporté périodiquement au serveur qui tient les PV communs à tous les joueurs
  const dps = bossState.shared ? playerBossDps() : (bossState.maxHp / bossState.duration);
  bossState.hp = Math.max(0, bossState.hp - dps*dt);
  if (bossState.shared) {
    bossState.contribAccum += dps*dt; bossState.myDmg += dps*dt;
    bossState.contribCd -= dt; bossState.topCd -= dt;
    if (bossState.contribCd <= 0 && bossState.contribAccum > 0) {
      bossState.contribCd = 1.2;
      const dmg = bossState.contribAccum; bossState.contribAccum = 0;
      sb.rpc('boss_contribute', { p_damage: dmg, p_pseudo: myPseudo || null }).then(({ data, error }) => {
        if (error || !data || !data.length) return;
        // état AUTORITAIRE renvoyé par le serveur (inclut les dégâts de tous les autres joueurs)
        bossState.hp = Number(data[0].hp); bossState.maxHp = Number(data[0].max_hp) || bossState.maxHp;
      }).catch(()=>{});
    }
    if (bossState.topCd <= 0) { bossState.topCd = 4; refreshBossTop(); }
    bossState.presenceCd -= dt;
    if (bossState.presenceCd <= 0 && bossChannel) {
      bossState.presenceCd = 0.35;
      bossChannel.track({ pseudo: myPseudo || 'Joueur', px: bossState.px, py: bossState.py });
    }
    // interpolation des AUTRES joueurs (2026-07-08, demande explicite : "les animations des joueurs
    // en World Boss doivent être en temps réel") : leur position ne nous parvient que toutes les
    // ~0.35s via Presence (bossChannel.track ci-dessus), donc les afficher directement à la position
    // brute reçue les faisait "sauter" au lieu de bouger fluidement — on lisse chaque frame vers la
    // dernière position connue, à la même vitesse que le déplacement du héros local
    for (const uid in otherFighters) {
      const f = otherFighters[uid];
      if (!f || typeof f.px !== 'number' || typeof f.py !== 'number') continue;
      let p = otherFightersPos[uid];
      if (!p) { p = otherFightersPos[uid] = { x:f.px, y:f.py }; } // 1ère fois : apparaît directement à sa position
      const mdx = f.px-p.x, mdy = f.py-p.y, md = Math.hypot(mdx,mdy);
      if (md > 0.0015) { const spd = 1.1*dt; p.x += mdx/md*Math.min(spd,md); p.y += mdy/md*Math.min(spd,md); }
    }
    for (const uid in otherFightersPos) { if (!otherFighters[uid]) delete otherFightersPos[uid]; } // joueur parti
  }
  if (Math.random() < dt*4) { // ~4 impacts/s
    const crit = Math.random() < .2;
    bossState.hits.push({ x:.5+(Math.random()-.5)*.3, y:.4+(Math.random()-.5)*.15, life:1, dmg:dps*(crit?1.6:.7), crit });
    if (crit) bossState.shakeT = Math.max(bossState.shakeT, 6); // petit tremblement d'écran sur un coup critique
  }
  // ---- braises de corruption en parallaxe (profondeur/immersion) : plusieurs couches de
  // particules qui montent à des vitesses différentes selon leur "profondeur" simulée ----
  bossState.shakeT = Math.max(0, bossState.shakeT - dt*26);
  if (Math.random() < dt*3) {
    bossState.embers.push({ x:Math.random(), y:0.55+Math.random()*0.4, depth:0.25+Math.random()*0.85, life:1, sway:Math.random()*6.28 });
  }
  bossState.embers.forEach(e => { e.y -= dt*0.10*(0.4+e.depth); e.sway += dt*2; e.life -= dt*0.16; });
  bossState.embers = bossState.embers.filter(e => e.life > 0 && e.y > -0.05);
  // dégâts continus légers du boss (attaques de base) ; potion auto
  bossState.potCd = Math.max(0, bossState.potCd - dt);
  const incoming = (bossState.playerHpMax * 0.04) * dmgTakenMult(dpRatio()) * dt;
  bossState.playerHp -= incoming;

  // ---- mécanique d'AoE : le boss charge une attaque de zone, il faut se cacher DERRIÈRE un pilier ----
  bossState.aoeT += dt;
  const bs = bossState, dodging = (bs.aoePhase==='telegraph'||bs.aoePhase==='blast');
  // cible de déplacement du héros : abri (pilier le plus proche, on se place en dessous) ou position d'attaque
  let tx, ty;
  if (dodging) {
    let best=bs.pillars[0], bd=1e9;
    for (const p of bs.pillars) { const d=Math.hypot(p.x-bs.px, p.y-bs.py); if(d<bd){bd=d;best=p;} }
    tx = best.x; ty = best.y + 0.07; // juste derrière (sous) le pilier, loin du boss placé en haut
  } else { tx = bs.atkPos.x; ty = bs.atkPos.y; }
  const spd = 0.9*dt, mdx = tx-bs.px, mdy = ty-bs.py, md = Math.hypot(mdx,mdy);
  if (md>0.002) { bs.px += mdx/md*Math.min(spd,md); bs.py += mdy/md*Math.min(spd,md); }
  // machine à états de l'AoE
  if (bs.aoePhase==='idle' && bs.aoeT >= bs.aoeInterval) { bs.aoePhase='telegraph'; bs.aoeT=0; }
  else if (bs.aoePhase==='telegraph' && bs.aoeT >= 2.2) {
    bs.aoePhase='blast'; bs.aoeT=0;
    // à l'explosion : es-tu à couvert ? (proche d'un pilier/bouée ET en dessous)
    const safe = bs.pillars.some(p => Math.hypot(p.x-bs.px, p.y-bs.py) < 0.10 && bs.py > p.y);
    bs.blocked = safe;
    // Vell (2026-07-08) : reskin "plonge sous l'eau" au lieu de "cache-toi derrière un pilier" —
    // même mécanique sûr/pas-sûr, juste le texte/la couleur qui changent
    const isVell = bs.boss === BOSS_ROSTER.vell;
    if (safe) {
      bs.blockFlash = 0.6; bs.shakeT = 6;
      bs.floatMsgs.push({txt: isVell ? (LANG==='fr'?'PLONGÉ !':'DIVED!') : (LANG==='fr'?'PARÉ !':'BLOCKED!'), life:1, color:'#8cc8ff'});
    } else {
      bs.playerHp -= bs.playerHpMax*0.30; bs.hurtFlash = 0.6; bs.shakeT = 20;
      bs.floatMsgs.push({txt: isVell ? (LANG==='fr'?'VAGUE !':'WAVE!') : 'AoE !', life:1, color:'#e05050'});
    }
  }
  else if (bs.aoePhase==='blast' && bs.aoeT >= 0.45) { bs.aoePhase='idle'; bs.aoeT=0; bs.aoeInterval = 7 + Math.random()*4; }
  bs.blockFlash = Math.max(0, bs.blockFlash - dt);
  bs.hurtFlash = Math.max(0, bs.hurtFlash - dt);
  bs.floatMsgs.forEach(m => m.life -= dt*0.8);
  bs.floatMsgs = bs.floatMsgs.filter(m => m.life > 0);

  if (bossState.playerHp < bossState.playerHpMax*0.35 && bossState.potCd <= 0) {
    bossState.playerHp = Math.min(bossState.playerHpMax, bossState.playerHp + bossState.playerHpMax*0.5);
    bossState.potCd = 4.2;
  }
  if (bossState.playerHp < 1) bossState.playerHp = 1; // pas de wipe sur ce boss d'intro
  bossState.hits.forEach(h => h.life -= dt*1.4);
  bossState.hits = bossState.hits.filter(h => h.life > 0);
  drawBossRoom(now/1000);
  // HUD
  // maxHp peut être 0 (ex: boss despawn par l'admin pendant qu'on est encore dans l'arène) —
  // sans ce garde-fou, hp/0*100 = NaN et affiche "NaN%" — bug trouvé le 2026-07-07
  const hpPct = bossState.maxHp > 0 ? bossState.hp/bossState.maxHp*100 : 0;
  $('bossHpBar').style.width = hpPct+'%';
  $('bossHpBar').classList.toggle('low', hpPct <= 20);
  $('bossHpTxt').innerHTML = `<span class="bhpPct">${hpPct.toFixed(1)}%</span><span class="bhpNum">(${fmt(Math.ceil(bossState.hp))} / ${fmt(bossState.maxHp)})</span>`;
  $('bossTimer').textContent = bossState.shared ? fmtBossCountdown(bossState.expiresAt - Date.now()) : fmtBossCountdown((bossState.duration - bossState.elapsed)*1000);
  $('bossPlayerHp').style.width = (bossState.playerHp/bossState.playerHpMax*100)+'%';
  $('bossPlayerHpTxt').textContent = Math.ceil(bossState.playerHp)+' / '+bossState.playerHpMax+' PV';
  if (bossState.hp <= 0) { endBossFight(true); return; }
  if (bossState.shared && Date.now() > bossState.expiresAt) { endBossFight(false); return; }
  bossState.raf = requestAnimationFrame(bossLoop);
}
// ===== salle de boss ORIGINALE (art dessiné, aucun asset réel) : salle de pierre à 4 piliers,
// grand seigneur de guerre de la corruption au fond, mécanique d'AoE dont on se protège en se
// plaçant derrière un pilier. Vue de dessus légèrement inclinée. =====
function bossProj(nx, ny) { const cv = $('bossCv'); return { x: cv.width*0.5 + (nx-0.5)*cv.width*0.86, y: cv.height*0.10 + ny*cv.height*0.78 }; }
function drawStonePillar(cx, sx, sy, scale) {
  const w = 34*scale, h = 120*scale;
  cx.fillStyle = 'rgba(0,0,0,.4)'; cx.beginPath(); cx.ellipse(sx, sy, w*0.75, w*0.28, 0, 0, 7); cx.fill(); // ombre
  // fût (dégradé pierre)
  const g = cx.createLinearGradient(sx-w/2, 0, sx+w/2, 0);
  g.addColorStop(0,'#2c3238'); g.addColorStop(.45,'#5a636c'); g.addColorStop(.6,'#6d7681'); g.addColorStop(1,'#333940');
  cx.fillStyle = g; cx.fillRect(sx-w/2, sy-h, w, h);
  // chapiteau + base
  cx.fillStyle = '#4b535c'; cx.fillRect(sx-w*0.62, sy-h-8*scale, w*1.24, 10*scale);
  cx.fillRect(sx-w*0.62, sy-6*scale, w*1.24, 8*scale);
  // rainures
  cx.strokeStyle = 'rgba(0,0,0,.25)'; cx.lineWidth = 1;
  for (let i=1;i<4;i++){ const lx=sx-w/2+w*i/4; cx.beginPath(); cx.moveTo(lx,sy-h+6*scale); cx.lineTo(lx,sy-4*scale); cx.stroke(); }
}
function drawWarlord(cx, sx, sy, r, t) {
  cx.save();
  // ombre au sol
  cx.fillStyle='rgba(0,0,0,.45)'; cx.beginPath(); cx.ellipse(sx, sy+r*0.15, r*1.15, r*0.34, 0, 0, 7); cx.fill();
  const glow = 0.5+0.5*Math.sin(t*2);
  // corps massif (carapace corrompue)
  const body = cx.createLinearGradient(sx, sy-r*1.6, sx, sy+r*0.2);
  body.addColorStop(0,'#7a2d33'); body.addColorStop(.5,'#5a2028'); body.addColorStop(1,'#33121a');
  cx.fillStyle = body;
  cx.beginPath();
  cx.moveTo(sx-r*1.1, sy+r*0.1);
  cx.quadraticCurveTo(sx-r*1.35, sy-r*0.9, sx-r*0.5, sy-r*1.15);
  cx.quadraticCurveTo(sx, sy-r*1.5, sx+r*0.5, sy-r*1.15);
  cx.quadraticCurveTo(sx+r*1.35, sy-r*0.9, sx+r*1.1, sy+r*0.1);
  cx.closePath(); cx.fill();
  // pointes de carapace sur le dos
  cx.fillStyle = '#3a161c';
  for (let i=-3;i<=3;i++){ const bx=sx+i*r*0.28, by=sy-r*1.1-Math.abs(i)*r*0.02;
    cx.beginPath(); cx.moveTo(bx-r*0.09,by); cx.lineTo(bx+r*0.09,by); cx.lineTo(bx, by-r*0.4); cx.closePath(); cx.fill(); }
  // fissures de corruption lumineuses
  cx.strokeStyle = `rgba(255,90,70,${0.55+0.35*glow})`; cx.lineWidth = 2; cx.shadowColor='#ff5a46'; cx.shadowBlur=12;
  cx.beginPath();
  cx.moveTo(sx-r*0.5,sy-r*0.9); cx.lineTo(sx-r*0.2,sy-r*0.4); cx.lineTo(sx-r*0.35,sy-r*0.1);
  cx.moveTo(sx+r*0.5,sy-r*0.8); cx.lineTo(sx+r*0.25,sy-r*0.35); cx.lineTo(sx+r*0.4,sy);
  cx.stroke(); cx.shadowBlur=0;
  // bras/griffes
  cx.fillStyle = '#4a1a20';
  cx.beginPath(); cx.moveTo(sx-r*1.0,sy-r*0.5); cx.lineTo(sx-r*1.5,sy-r*0.1); cx.lineTo(sx-r*1.25,sy-r*0.05); cx.lineTo(sx-r*0.9,sy-r*0.3); cx.closePath(); cx.fill();
  cx.beginPath(); cx.moveTo(sx+r*1.0,sy-r*0.5); cx.lineTo(sx+r*1.5,sy-r*0.1); cx.lineTo(sx+r*1.25,sy-r*0.05); cx.lineTo(sx+r*0.9,sy-r*0.3); cx.closePath(); cx.fill();
  // tête casquée
  const hy = sy-r*1.05;
  cx.fillStyle = '#43191f'; cx.beginPath(); cx.arc(sx, hy, r*0.42, 0, 7); cx.fill();
  // cornes
  cx.strokeStyle = '#c9b48a'; cx.lineWidth = r*0.16; cx.lineCap='round';
  cx.beginPath(); cx.moveTo(sx-r*0.3, hy-r*0.2); cx.quadraticCurveTo(sx-r*0.75, hy-r*0.7, sx-r*0.55, hy-r*1.0); cx.stroke();
  cx.beginPath(); cx.moveTo(sx+r*0.3, hy-r*0.2); cx.quadraticCurveTo(sx+r*0.75, hy-r*0.7, sx+r*0.55, hy-r*1.0); cx.stroke();
  cx.lineCap='butt';
  // yeux ardents
  cx.fillStyle = `rgba(255,${120+100*glow|0},60,1)`; cx.shadowColor='#ffae3a'; cx.shadowBlur=14;
  cx.beginPath(); cx.arc(sx-r*0.16, hy, r*0.09, 0, 7); cx.fill();
  cx.beginPath(); cx.arc(sx+r*0.16, hy, r*0.09, 0, 7); cx.fill();
  cx.shadowBlur=0;
  cx.restore();
}
// Vell — grand dragon des mers ORIGINAL. Silhouette redessinée le 2026-07-08 (4e version) d'après
// 5 angles d'une sculpture 3D de référence fournie par l'utilisateur, qui clarifient la composition :
// ce ne sont PAS deux cornes séparées d'un socle, mais les DEUX AILES du dragon lui-même, si
// gigantesques qu'elles s'enroulent vers l'intérieur et se rejoignent en bas pour former une grande
// vasque/coupe — le corps du dragon (petit, tête à crête de pointes, museau fin, queue longue et
// fine terminée par une pointe recourbée en lame) est perché tout en haut au centre de cette coupe,
// pattes griffues agrippées au rebord. Franchement différent de Kzarka (humanoïde compact, 2 cornes
// droites, gueule fermée). Pas de reprise d'asset réel, juste l'ambiance/la composition.
function drawVell(cx, sx, sy, r, t) {
  cx.save();
  const glow = 0.5+0.5*Math.sin(t*2);
  const sway = Math.sin(t*0.9)*r*0.02;
  cx.fillStyle='rgba(0,0,0,.4)'; cx.beginPath(); cx.ellipse(sx, sy+r*0.5, r*1.15, r*0.26, 0, 0, 7); cx.fill();
  // les 2 immenses ailes enroulées en vasque/coupe — élément signature : elles partent des épaules
  // (haut, près de la tête), s'ouvrent largement vers l'extérieur puis se recourbent vers l'intérieur
  // et vers le bas pour se rejoindre au centre, formant une grande coupe qui sert de socle
  const wingBowl = (side) => {
    cx.save(); cx.translate(sx,sy-r*0.75); cx.scale(side,1);
    const wg = cx.createLinearGradient(0,-r*0.2,r*1.15,r*1.1);
    wg.addColorStop(0,'#1c3a4a'); wg.addColorStop(1,'#0a1c26');
    cx.fillStyle = wg;
    cx.beginPath();
    cx.moveTo(r*0.08,-r*0.05);
    cx.quadraticCurveTo(r*0.5,-r*0.2, r*0.85,-r*0.05);
    cx.quadraticCurveTo(r*1.2,r*0.12, r*1.15,r*0.55);
    cx.quadraticCurveTo(r*1.1,r*0.95, r*0.7,r*1.15+sway);
    cx.quadraticCurveTo(r*0.35,r*1.3, r*0.02,r*1.18);
    cx.quadraticCurveTo(r*0.28,r*0.95, r*0.32,r*0.6);
    cx.quadraticCurveTo(r*0.34,r*0.25, r*0.16,r*0.08);
    cx.closePath(); cx.fill();
    // nervures de l'aile
    cx.strokeStyle='rgba(160,220,230,.18)'; cx.lineWidth=r*0.02;
    cx.beginPath(); cx.moveTo(r*0.15,-r*0.02); cx.quadraticCurveTo(r*0.75,r*0.05, r*0.85,r*0.9+sway); cx.stroke();
    cx.beginPath(); cx.moveTo(r*0.15,-r*0.02); cx.quadraticCurveTo(r*0.55,r*0.15, r*0.5,r*0.85); cx.stroke();
    cx.restore();
  };
  wingBowl(-1); wingBowl(1);
  // queue longue et fine, part du corps et longe l'extérieur d'une aile jusqu'à une pointe recourbée
  // en lame — visible qui dépasse sur le côté de la coupe
  cx.strokeStyle='#0e1c24'; cx.lineCap='round';
  cx.beginPath(); cx.lineWidth=r*0.09;
  cx.moveTo(sx-r*0.2,sy-r*0.55);
  cx.quadraticCurveTo(sx-r*0.95,sy-r*0.15+sway, sx-r*1.25,sy+r*0.35);
  cx.stroke();
  cx.lineWidth=r*0.035;
  cx.beginPath(); cx.moveTo(sx-r*1.15,sy+r*0.15); cx.quadraticCurveTo(sx-r*1.4,sy+r*0.3+sway, sx-r*1.42,sy+r*0.55); cx.stroke();
  cx.lineCap='butt';
  // torse : petit corps sombre écaillé perché en haut au centre de la coupe
  const body = cx.createLinearGradient(sx, sy-r*1.35, sx, sy-r*0.4);
  body.addColorStop(0,'#1c3a4a'); body.addColorStop(.6,'#12222c'); body.addColorStop(1,'#0a1620');
  cx.fillStyle = body;
  cx.beginPath();
  cx.moveTo(sx-r*0.24,sy-r*0.45); cx.quadraticCurveTo(sx-r*0.3,sy-r*0.95, sx-r*0.14,sy-r*1.15);
  cx.quadraticCurveTo(sx,sy-r*1.22, sx+r*0.14,sy-r*1.15);
  cx.quadraticCurveTo(sx+r*0.3,sy-r*0.95, sx+r*0.24,sy-r*0.45);
  cx.quadraticCurveTo(sx,sy-r*0.32, sx-r*0.24,sy-r*0.45);
  cx.closePath(); cx.fill();
  // pattes griffues courtes agrippées au rebord de la coupe
  cx.fillStyle = '#12222c';
  for (const side of [-1,1]) {
    cx.beginPath(); cx.ellipse(sx+side*r*0.2,sy-r*0.38,r*0.1,r*0.16,side*0.3,0,7); cx.fill();
    cx.strokeStyle='#e8e2d0'; cx.lineWidth=r*0.02; cx.lineCap='round';
    for (let c=-1;c<=1;c++) { cx.beginPath(); cx.moveTo(sx+side*r*0.19+c*r*0.04,sy-r*0.3); cx.lineTo(sx+side*r*0.16+c*r*0.05,sy-r*0.2); cx.stroke(); }
    cx.lineCap='butt';
  }
  // tête : museau fin, surmontée d'une crête de pointes asymétrique
  const hy = sy-r*1.18;
  cx.fillStyle = '#12222c';
  cx.beginPath(); cx.ellipse(sx,hy,r*0.22,r*0.19,0,0,7); cx.fill();
  cx.beginPath(); cx.ellipse(sx,hy+r*0.15,r*0.13,r*0.11,0,0,7); cx.fill();
  // crête de pointes le long de la nuque/tête — la couronne caractéristique
  cx.fillStyle = '#0e1c24';
  const ridge = [[-0.3,-0.95,0.55],[-0.12,-1.1,0.75],[0.06,-1.15,0.8],[0.24,-1.05,0.65],[0.4,-0.85,0.45]];
  for (const [dx,dy,len] of ridge) {
    const bx=sx+dx*r*0.4, by=hy+dy*r*0.4;
    cx.beginPath();
    cx.moveTo(bx-r*0.035,by); cx.lineTo(bx+dx*r*0.25*len, by+dy*r*0.35*len); cx.lineTo(bx+r*0.035,by);
    cx.closePath(); cx.fill();
  }
  // gueule, crocs, gorge sombre
  cx.fillStyle='#4a0e0e'; cx.beginPath(); cx.ellipse(sx,hy+r*0.18,r*0.13,r*0.1,0,0,Math.PI); cx.fill();
  cx.fillStyle='#e8e2d0';
  for (let i=-2;i<=2;i++) { const tx=sx+i*r*0.05;
    cx.beginPath(); cx.moveTo(tx-r*0.02,hy+r*0.1); cx.lineTo(tx,hy+r*0.21); cx.lineTo(tx+r*0.02,hy+r*0.1); cx.closePath(); cx.fill(); }
  // yeux luminescents, petits et enfoncés
  cx.fillStyle = `rgba(255,${60+40*glow|0},60,1)`; cx.shadowColor='#ff3a3a'; cx.shadowBlur=12;
  cx.beginPath(); cx.arc(sx-r*0.08,hy-r*0.02,r*0.04,0,7); cx.fill();
  cx.beginPath(); cx.arc(sx+r*0.08,hy-r*0.02,r*0.04,0,7); cx.fill();
  cx.shadowBlur=0;
  cx.restore();
}
// dispatcher : chaque boss du roster a sa propre silhouette dans l'arène — pour l'instant Kzarka
// (Grand Seigneur de guerre) et Vell (grand poisson des mers) ont la leur
function drawBossCreature(bossId, cx, sx, sy, r, t) {
  if (bossId === 'vell') return drawVell(cx, sx, sy, r, t);
  return drawWarlord(cx, sx, sy, r, t);
}
// bateaux + tirs de canon (2026-07-08, demande explicite : "les joueurs sont autour en bateau et
// lancent des boulets dessus") — dessinés SEULEMENT pour Vell. Réutilise le tableau bs.hits déjà
// généré ~4×/s par bossLoop (chaque hit = un boulet, h.life 1→0 sert de progression de vol).
// bateaux 10× plus gros (demande explicite du 2026-07-08) : repoussés vers les coins bas de l'écran
// pour rester au premier plan sans recouvrir tout le combat malgré leur taille
const VELL_BOATS = [ {x:0.04, y:0.92}, {x:0.96, y:0.92} ];
const VELL_BOAT_SCALE = 13; // 1.3 × 10
// ancres des 2 bateaux (2026-07-08, demande explicite : "les joueurs plongent sous l'ancre des
// bateaux à la place des piliers de Kzarka") — un peu vers le centre par rapport au bateau lui-même,
// pour rester une position atteignable à la nage plutôt que collée au bord de l'écran
const VELL_ANCHORS = [ {x:0.16, y:0.74}, {x:0.84, y:0.74} ];
function drawVellBoat(cx, sx, sy, scale, facingRight) {
  cx.save(); cx.translate(sx,sy); if (!facingRight) cx.scale(-1,1); cx.scale(scale,scale);
  cx.fillStyle='rgba(0,0,0,.35)'; cx.beginPath(); cx.ellipse(0,4,26,7,0,0,7); cx.fill();
  cx.fillStyle='#3a2c1e'; // coque
  cx.beginPath(); cx.moveTo(-22,0); cx.quadraticCurveTo(-24,8,-14,9); cx.lineTo(20,9); cx.quadraticCurveTo(26,4,20,0); cx.closePath(); cx.fill();
  cx.strokeStyle='#241a10'; cx.lineWidth=1; cx.beginPath(); cx.moveTo(-20,3); cx.lineTo(18,3); cx.stroke();
  cx.strokeStyle='#5a4630'; cx.lineWidth=1.6; cx.beginPath(); cx.moveTo(-4,0); cx.lineTo(-4,-26); cx.stroke(); // mât
  cx.fillStyle='#c9c2a8'; cx.beginPath(); cx.moveTo(-4,-25); cx.lineTo(12,-16); cx.lineTo(-4,-9); cx.closePath(); cx.fill(); // voile
  cx.restore();
}
function drawBossRoom(t) {
  const cx = bossCtx, cv = $('bossCv'), W = cv.width, H = cv.height, bs = bossState;
  const isVell = bs.boss === BOSS_ROSTER.vell;
  cx.save();
  // tremblement d'écran (crit / AoE non paré) : léger décalage aléatoire de toute la scène,
  // renforce la sensation d'impact et de profondeur ("4D")
  if (bs.shakeT > 0) cx.translate((Math.random()-0.5)*bs.shakeT, (Math.random()-0.5)*bs.shakeT);
  if (isVell) {
    // Vell : en pleine mer, ciel pâle au loin qui s'assombrit vers l'eau (demande explicite,
    // d'après les captures de référence) — pas de dalles de pierre, juste des rides d'eau
    const sky = cx.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,'#8fb8c9'); sky.addColorStop(.42,'#4a7a8f'); sky.addColorStop(.55,'#1c4a5e'); sky.addColorStop(1,'#0a2430');
    cx.fillStyle = sky; cx.fillRect(0,0,W,H);
    // Vell est cerné de montagnes de tous côtés, UNE SEULE entrée étroite au centre pour aller le
    // voir depuis les bateaux (demande explicite du 2026-07-08, d'après la capture "Barrier Rock" —
    // "il doit y avoir qu'une entrée") : 2 versants rocheux séparés par un unique passage
    const gapL = W*0.40, gapR = W*0.60;
    cx.fillStyle = 'rgba(10,20,26,.6)';
    cx.beginPath(); cx.moveTo(0,H*.5);
    for (let i=0;i<=8;i++) { const x=i/8*gapL; cx.lineTo(x, H*.42 - Math.abs(Math.sin(i*2.3+3))*H*.16); }
    cx.lineTo(gapL,H*.5); cx.closePath(); cx.fill();
    cx.beginPath(); cx.moveTo(gapR,H*.5);
    for (let i=0;i<=8;i++) { const x=gapR+i/8*(W-gapR); cx.lineTo(x, H*.42 - Math.abs(Math.sin(i*2.1+11))*H*.16); }
    cx.lineTo(W,H*.5); cx.closePath(); cx.fill();
    // "Barrier Rock" : 2 pointes plus sombres/proches encadrant directement l'entrée
    cx.fillStyle = 'rgba(6,14,18,.75)';
    const rockSpike = (sx, h) => { cx.beginPath(); cx.moveTo(sx-18,H*.58); cx.lineTo(sx,H*.58-h); cx.lineTo(sx+18,H*.58); cx.closePath(); cx.fill(); };
    rockSpike(gapL-10, H*.22);
    rockSpike(gapR+10, H*.24);
    // rides d'eau horizontales, ondulantes
    cx.strokeStyle='rgba(255,255,255,.10)'; cx.lineWidth=1;
    for (let i=0;i<9;i++) { const y = H*.5 + i*(H*.5/9);
      cx.beginPath();
      for (let x=0;x<=W;x+=24) cx.lineTo(x, y+Math.sin(x*0.03+t*1.2+i)*3);
      cx.stroke();
    }
  } else {
    // fond : grande salle brumeuse bleu-gris
    const bg = cx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#1a2830'); bg.addColorStop(.55,'#223038'); bg.addColorStop(1,'#10171c');
    cx.fillStyle = bg; cx.fillRect(0,0,W,H);
    // dalles de pierre au sol (bandes qui s'élargissent vers le bas = légère perspective)
    cx.strokeStyle = 'rgba(0,0,0,.28)'; cx.lineWidth = 1;
    for (let i=0;i<=10;i++){ const p=bossProj(0,i/10); cx.beginPath(); cx.moveTo(0,p.y); cx.lineTo(W,p.y); cx.stroke(); }
    for (let i=0;i<=8;i++){ const top=bossProj(i/8,0), bot=bossProj(i/8,1); cx.beginPath(); cx.moveTo(top.x,top.y); cx.lineTo(bot.x,bot.y); cx.stroke(); }
  }
  // brume de fond en parallaxe : dérive LENTE et indépendante du tremblement d'écran — donne au
  // donjon une vraie impression de profondeur/volume ("4D") au-delà du simple décor plat
  const fogDrift = Math.sin(t*0.15)*16;
  const fog = cx.createRadialGradient(W/2+fogDrift, H*0.32, W*0.08, W/2+fogDrift, H*0.32, W*0.8);
  fog.addColorStop(0,'rgba(255,255,255,0)'); fog.addColorStop(1,`rgba(0,0,0,${isVell?.22:.4})`);
  cx.fillStyle = fog; cx.fillRect(0,0,W,H);
  if (isVell) { // bateaux des joueurs, de part et d'autre — demande explicite du 2026-07-08
    drawVellBoat(cx, W*VELL_BOATS[0].x, H*VELL_BOATS[0].y, VELL_BOAT_SCALE, true);
    drawVellBoat(cx, W*VELL_BOATS[1].x, H*VELL_BOATS[1].y, VELL_BOAT_SCALE, false);
  }
  // braises de corruption en arrière-plan (profondeur : plus loin = plus petit/lent/transparent)
  for (const e of bs.embers) {
    if (e.depth > 0.6) continue; // couche lointaine, DERRIÈRE le boss
    const ex = (e.x + Math.sin(e.sway)*0.01)*W, ey = e.y*H;
    cx.globalAlpha = e.life*0.35*e.depth; cx.fillStyle = '#ff8a4a'; cx.shadowColor='#ff5a2a'; cx.shadowBlur = 6;
    cx.beginPath(); cx.arc(ex, ey, 1+1.5*e.depth, 0, 7); cx.fill();
  }
  cx.globalAlpha = 1; cx.shadowBlur = 0;
  // boss au fond : légère oscillation de volume (skew) pour donner une impression de masse en 3D
  const bpos = bossProj(0.5, 0.12); const r = Math.min(W,H)*0.14;
  cx.save();
  cx.translate(bpos.x, bpos.y);
  cx.transform(1, 0, 0.05*Math.sin(t*0.6), 1+0.015*Math.sin(t*1.3), 0, 0);
  drawBossCreature(bs.bossId, cx, 0, 0, r, t);
  cx.restore();
  // braises au premier plan (devant le boss, plus grosses/rapides/opaques)
  for (const e of bs.embers) {
    if (e.depth <= 0.6) continue;
    const ex = (e.x + Math.sin(e.sway)*0.015)*W, ey = e.y*H;
    cx.globalAlpha = e.life*0.55*e.depth; cx.fillStyle = '#ffb066'; cx.shadowColor='#ff5a2a'; cx.shadowBlur = 8;
    cx.beginPath(); cx.arc(ex, ey, 1.5+2*e.depth, 0, 7); cx.fill();
  }
  cx.globalAlpha = 1; cx.shadowBlur = 0;
  // boulets de canon tirés des bateaux (Vell uniquement) : chaque hit = 1 boulet, h.life 1→0 sert de
  // progression de vol (le bateau tire du côté le plus proche de x du hit) — demande explicite :
  // "affiche ça, l'animation de boulet ... avec un tic à chaque boulet"
  if (isVell) {
    for (const h of bs.hits) {
      const boat = VELL_BOATS[h.x < 0.5 ? 0 : 1];
      const bx = W*boat.x, by = H*boat.y - VELL_BOAT_SCALE*12; // départ du boulet à hauteur du pont, proportionnel à la taille du bateau
      const prog = 1-h.life; // 0 au départ du bateau, 1 à l'impact
      const px = bx + (bpos.x-bx)*prog;
      const py = by + (bpos.y-by)*prog - Math.sin(prog*Math.PI)*70; // arc parabolique
      cx.fillStyle = '#1a1a1a';
      cx.beginPath(); cx.arc(px, py, 4.5, 0, 7); cx.fill();
      cx.strokeStyle = 'rgba(200,200,200,.4)'; cx.lineWidth = 1.5;
      cx.beginPath(); cx.moveTo(px,py); cx.lineTo(px-(bpos.x-bx)*0.05, py-(bpos.y-by)*0.05+8); cx.stroke();
    }
  }
  // impacts de dégâts sur le boss
  for (const h of bs.hits) {
    const hy = bpos.y - (1-h.life)*40;
    cx.globalAlpha = Math.max(0,h.life);
    cx.font = h.crit?'bold 24px Georgia':'18px Georgia'; cx.textAlign='center';
    cx.fillStyle = h.crit?'#ffbe78':'#fff';
    cx.fillText('-'+fmt(Math.ceil(h.dmg))+(h.crit?'!':''), bpos.x+(h.x-.5)*r*2.4, hy);
    cx.globalAlpha = 1;
  }
  cx.textAlign='left';
  // ---- AoE au sol : cercle qui grandit (telegraph) puis explosion, sauf derrière les piliers —
  // pour Vell (2026-07-08), reskin "vague" bleu/écume : le joueur doit PLONGER au lieu de se cacher
  // derrière un pilier, mais le mécanisme sûr/pas-sûr sous-jacent reste identique
  const aoeCol = isVell ? [90,180,220] : [224,70,60];
  if (bs.aoePhase==='telegraph' || bs.aoePhase==='blast') {
    const c = bossProj(0.5, 0.6);
    const rad = Math.min(W,H)*0.55;
    if (bs.aoePhase==='telegraph') {
      const prog = Math.min(1, bs.aoeT/2.2);
      cx.fillStyle = `rgba(${aoeCol[0]},${aoeCol[1]},${aoeCol[2]},${0.10+0.14*prog})`;
      cx.beginPath(); cx.ellipse(c.x, c.y, rad, rad*0.55, 0, 0, 7); cx.fill();
      cx.strokeStyle = `rgba(${isVell?'160,220,255':'255,80,60'},${0.5+0.4*Math.sin(t*10)})`; cx.lineWidth = 3;
      cx.beginPath(); cx.ellipse(c.x, c.y, rad*prog, rad*0.55*prog, 0, 0, 7); cx.stroke();
    } else {
      const a = 1-Math.min(1,bs.aoeT/0.45);
      cx.fillStyle = `rgba(${isVell?'160,220,255':'255,90,60'},${0.55*a})`;
      cx.beginPath(); cx.ellipse(c.x, c.y, rad, rad*0.55, 0, 0, 7); cx.fill();
    }
    // zones sûres (pilier en pierre, ou bouée de plongée pour Vell) — petite ombre bleutée = "à couvert"
    for (const p of bs.pillars) { const s = bossProj(p.x, p.y+0.05);
      cx.fillStyle = 'rgba(120,180,255,.16)'; cx.beginPath(); cx.ellipse(s.x, s.y, 40, 16, 0, 0, 7); cx.fill(); }
  }
  // ---- éléments au sol triés par profondeur (piliers/ancres + héros) pour un rendu cohérent
  const drawables = bs.pillars.map((p,pi) => ({ ny:p.y, fn:()=>{
    const s = bossProj(p.x,p.y);
    if (isVell) {
      // ancre du bateau le plus proche : chaîne qui descend du pont jusqu'à la surface, où l'on
      // plonge pour se mettre à l'abri — demande explicite du 2026-07-08 ("plonge sous l'ancre des
      // bateaux à la place des anciens piliers de Kzarka")
      const boat = VELL_BOATS[pi] || VELL_BOATS[0];
      const bx = W*boat.x, by = H*boat.y - VELL_BOAT_SCALE*12;
      cx.strokeStyle='rgba(90,90,90,.55)'; cx.lineWidth=2;
      cx.beginPath(); cx.moveTo(bx,by); cx.lineTo(s.x,s.y-14); cx.stroke();
      cx.fillStyle='rgba(0,0,0,.3)'; cx.beginPath(); cx.ellipse(s.x,s.y+2,12,4.5,0,0,7); cx.fill();
      cx.strokeStyle='#7a7a78'; cx.lineWidth=2.4; cx.lineCap='round';
      cx.beginPath(); cx.moveTo(s.x,s.y-14); cx.lineTo(s.x,s.y-2); cx.stroke(); // tige de l'ancre
      cx.beginPath(); cx.arc(s.x,s.y-14,3,0,7); cx.stroke(); // anneau du haut
      cx.beginPath(); cx.arc(s.x,s.y-3,6,Math.PI*0.15,Math.PI*0.85); cx.stroke(); // courbe des pattes
      cx.beginPath(); cx.moveTo(s.x-6,s.y-3); cx.lineTo(s.x-9,s.y-8); cx.moveTo(s.x+6,s.y-3); cx.lineTo(s.x+9,s.y-8); cx.stroke(); // pattes
      cx.beginPath(); cx.moveTo(s.x-9,s.y-13); cx.lineTo(s.x+9,s.y-13); cx.stroke(); // barre transversale
    } else drawStonePillar(cx, s.x, s.y, Math.min(W,H)/500*1.6);
  } }));
  // Vell (2026-07-08, demande explicite "fais plonger le personnage") : quand on s'abrite près
  // d'une bouée pendant la charge, le héros disparaît sous l'eau (ridules + bulles) au lieu de
  // rester debout comme si de rien n'était — bien plus lisible que le simple bouclier bleu.
  const dodgingNow = bs.aoePhase==='telegraph' || bs.aoePhase==='blast';
  const nearBuoy = isVell && bs.pillars.some(p => Math.hypot(p.x-bs.px, p.y-bs.py) < 0.10 && bs.py > p.y);
  const diving = isVell && dodgingNow && nearBuoy;
  drawables.push({ ny:bs.py, fn:()=>{
    const s = bossProj(bs.px, bs.py);
    if (diving) {
      // ridules concentriques qui s'élargissent + bulles qui remontent, à la surface où il a plongé
      cx.strokeStyle='rgba(200,230,255,.5)'; cx.lineWidth=1.4;
      for (let i=0;i<3;i++) { const rr = 6+((t*30+i*9)%22);
        cx.globalAlpha = Math.max(0,1-rr/22); cx.beginPath(); cx.ellipse(s.x,s.y,rr,rr*0.4,0,0,7); cx.stroke(); }
      cx.globalAlpha = 1;
      cx.fillStyle='rgba(220,240,255,.6)';
      for (let i=0;i<4;i++) { const bx=s.x+Math.sin(t*3+i*2)*8, by=s.y-((t*18+i*7)%20);
        cx.beginPath(); cx.arc(bx,by,1.4+i*0.3,0,7); cx.fill(); }
      return;
    }
    cx.fillStyle='rgba(0,0,0,.35)'; cx.beginPath(); cx.ellipse(s.x, s.y, 12, 5, 0, 0, 7); cx.fill();
    // bouclier si paré
    if (bs.blockFlash>0) { cx.strokeStyle=`rgba(140,200,255,${bs.blockFlash})`; cx.lineWidth=3; cx.beginPath(); cx.arc(s.x, s.y-18, 20, 0, 7); cx.stroke(); }
    const hurt = bs.hurtFlash>0;
    cx.fillStyle = hurt ? '#c0554533' : '#3b6ea8';
    cx.beginPath(); cx.moveTo(s.x, s.y-36); cx.lineTo(s.x-10, s.y); cx.lineTo(s.x+10, s.y); cx.closePath(); cx.fill();
    cx.fillStyle = hurt ? '#e0a0a0' : '#e8d0a0'; cx.beginPath(); cx.arc(s.x, s.y-38, 5.5, 0, 7); cx.fill();
    cx.fillStyle = '#2a4a7a'; cx.beginPath(); cx.moveTo(s.x-7,s.y-38); cx.lineTo(s.x+7,s.y-38); cx.lineTo(s.x,s.y-50); cx.closePath(); cx.fill();
  }});
  // ---- les AUTRES joueurs du boss partagé, en direct via Supabase Realtime presence (voir
  // joinBossChannel) : silhouette simplifiée + pseudo, à leur position réelle dans l'arène —
  // demande explicite : "tous les joueurs doivent se voir dans la zone du boss"
  if (bs.shared) {
    for (const uid in otherFighters) {
      const f = otherFighters[uid];
      if (!f || typeof f.px !== 'number' || typeof f.py !== 'number') continue;
      const p = otherFightersPos[uid] || { x:f.px, y:f.py }; // position lissée (voir bossLoop), repli sur la brute si pas encore initialisée
      drawables.push({ ny:p.y, fn:()=>{
        const s = bossProj(p.x, p.y);
        cx.fillStyle='rgba(0,0,0,.3)'; cx.beginPath(); cx.ellipse(s.x, s.y, 10, 4, 0, 0, 7); cx.fill();
        cx.fillStyle = '#5a8a4a';
        cx.beginPath(); cx.moveTo(s.x, s.y-30); cx.lineTo(s.x-8, s.y); cx.lineTo(s.x+8, s.y); cx.closePath(); cx.fill();
        cx.fillStyle = '#d8c89a'; cx.beginPath(); cx.arc(s.x, s.y-32, 4.5, 0, 7); cx.fill();
        cx.font = '10px Georgia'; cx.textAlign = 'center'; cx.fillStyle = '#cde8c0';
        cx.shadowColor = '#000'; cx.shadowBlur = 3;
        cx.fillText((f.pseudo||'?').slice(0,14), s.x, s.y-40);
        cx.shadowBlur = 0;
      }});
    }
  }
  drawables.sort((a,b)=>a.ny-b.ny).forEach(d => d.fn());
  // messages flottants (PARÉ / AoE) au-dessus du héros
  for (const m of bs.floatMsgs) {
    const s = bossProj(bs.px, bs.py);
    cx.globalAlpha = Math.max(0, Math.min(1, m.life));
    cx.font = 'bold 18px Georgia'; cx.textAlign='center'; cx.fillStyle = m.color;
    cx.fillText(m.txt, s.x, s.y-56-(1-m.life)*24);
    cx.globalAlpha = 1;
  }
  cx.textAlign='left'; cx.textBaseline='alphabetic';
  // vignette réactive aux PV du boss : le donjon "respire" la corruption à mesure qu'il faiblit —
  // renforce encore l'immersion "4D" en réagissant à l'état réel du combat, pas juste au décor
  const hpFrac = bs.maxHp > 0 ? Math.max(0, bs.hp/bs.maxHp) : 1;
  const breathe = 1 + Math.sin(t*2.2)*(hpFrac<0.3?0.18:0.05);
  const vigStrength = (0.14 + (1-hpFrac)*0.36) * breathe;
  const vig = cx.createRadialGradient(W/2,H/2,H*0.25,W/2,H/2,H*0.78);
  vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(1,`rgba(140,20,20,${Math.min(0.6,vigStrength)})`);
  cx.fillStyle = vig; cx.fillRect(0,0,W,H);
  cx.restore(); // referme le cx.save() du tremblement d'écran en tout début de fonction
}
