// ==================== WORLD BOSS ====================
// Bosses implémentés dans le jeu : Kzarka (quotidien) et Vell (hebdomadaire, ajouté le 2026-07-08).
// Les horaires suivent ceux du vrai BDO MOINS 15 minutes (demande utilisateur) ; ils sont exprimés
// en heure LOCALE du joueur pour rester simples, et le boss "in-game" se combat en 2 à 7 minutes
// selon ton stuff (voir startBossFight).
const BOSS_ROSTER = {
  kzarka: {
    name:{fr:'Grand Seigneur de guerre de la corruption',en:'Great Warlord of Corruption'},
    short:{fr:'Seigneur de guerre',en:'Warlord'}, icon:'👹', color:'#7a2d33',
    // réplique d'ambiance affichée sous le nom dans la carte "prochain boss" du lobby (2026-07-11,
    // reskin visuel du lobby Boss, voir CLAUDE.md) -- purement cosmétique, aucune mécanique dessus.
    lore:{fr:'« Sa colère a réduit trois royaumes en cendres avant qu\'on ne le scelle sous Valencia. »',
          en:'"His wrath reduced three kingdoms to ashes before he was sealed beneath Valencia."'},
    hp: 400000,          // calibré pour ~5 min à PA "adaptée" (~250), clampé à [2,7] min
    reward: 250000,      // silver de victoire (récompenses réelles désormais fixes par rang, voir KZARKA_REWARD_TIERS)
    matKey:'mat_Pierre noire', matName:'Pierre noire', matIcon:ICO_MAT_NOIRE, matQty:[8,20],
    // Pierre de sang de Kzarka (2026-07-16, demande explicite) : 1% de chance à la victoire — même
    // mécanique de roue que Coeur de Vell (voir endBossFight/renderBossRewardWheel), entièrement
    // générique via b.rareLoot, aucun code supplémentaire nécessaire pour la roulette.
    rareLoot: { name:'Pierre de sang de Kzarka', icon:'🩸', color:'#c0524a', ch:0.01 },
  },
  // Vell : grand poisson/serpent des mers, boss hebdomadaire (bien plus rare que Kzarka dans le
  // vrai jeu) — silhouette originale provisoire en attendant la photo de référence promise par
  // l'utilisateur (sera affinée ensuite, voir drawVell). Plus coriace et plus payant que Kzarka
  // pour refléter sa rareté hebdomadaire.
  vell: {
    name:{fr:'Vell, la Terreur des Flots',en:'Vell, Terror of the Tides'},
    short:{fr:'Vell',en:'Vell'}, icon:'🐋', color:'#2a5a78',
    lore:{fr:'« Les pêcheurs disent qu\'elle chante encore, quelque part sous les vagues, pour appeler les navires vers le fond. »',
          en:'"Sailors say she still sings somewhere beneath the waves, calling ships down to the deep."'},
    hp: 550000,
    reward: 400000,
    matKey:'mat_Pierre noire', matName:'Pierre noire', matIcon:ICO_MAT_NOIRE, matQty:[12,28],
    // Coeur de Vell (2026-07-08) : 5% de chance à la victoire — visible sur la roue de récompense
    // en fin de combat (voir endBossFight/renderBossRewardWheel), qu'on l'obtienne ou non.
    rareLoot: { name:'Coeur de Vell', icon:ICO_COEUR_VELL, color:'#5ec9e8', ch:0.05 },
  },
};
// récompenses FIXES par rang de contribution, réservées à Kzarka (2026-07-16, demande explicite,
// remplacent pour ce boss précis l'ancien système générique basé sur la zone de progression du
// joueur, voir endBossFight — Vell garde ce système générique, aucune donnée fournie pour lui ici).
const KZARKA_REWARD_TIERS = {
  1: { caphras:[50,100], frag:[20,30], silver:1000000 },
  2: { caphras:[35,75],  frag:[15,25], silver:100000 },
  3: { caphras:[15,50],  frag:[10,20], silver:10000 },
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
/** @param {Date} date @returns {number} décalage UTC actuel de Paris en minutes (calculé via Intl, suit automatiquement les changements d'heure été/hiver). */
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
/**
 * Prochaine occurrence (ou occurrence en cours) de chaque entrée de BOSS_SCHEDULE, sur 7 jours
 * glissants — les horaires sont en heure de Paris (garmoth.com), convertis vers l'heure du
 * navigateur du joueur peu importe son fuseau.
 * @param {Date} fromDate - instant de référence.
 * @returns {{boss:string, time:number, live:boolean}[]} occurrences triées par heure croissante,
 *   `live` = vrai si dans la fenêtre de combat (BOSS_WINDOW_MS) actuellement.
 */
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
// compteur d'échecs consécutifs de refreshLiveBoss() (2026-07-12, bug corrigé : "joueurs invisibles
// entre eux lors d'un World Boss") -- avant, l'appel RPC ensure_scheduled_boss ET son repli (lecture
// directe de live_boss) étaient chacun dans un try/catch qui avalait l'erreur SANS AUCUNE trace ; un
// joueur pouvait alors rejoindre un créneau du planning qui AURAIT DÛ être partagé (occ.live vrai
// localement, voir bossOccurrences) sans que liveBoss n'ait jamais pu être confirmé côté serveur --
// wireBossLobby() démarrait alors un combat solo silencieux (occ.sharedHp absent) que le joueur
// croyait partagé. Exposé désormais via un vrai compteur (log explicite + relance rapide en cas
// d'échec) et consommé par bossSharedConfirmState() (voir plus bas) pour ne plus JAMAIS laisser un
// joueur démarrer en mode "partagé implicite" sans confirmation ou message clair.
let liveBossFailCount = 0;
/** Rafraîchit liveBoss depuis Supabase (RPC ensure_scheduled_boss, repli sur lecture directe de live_boss), re-render le lobby si le statut "en cours" vient de changer pendant qu'il est affiché. Trace/relance en cas d'échec des DEUX tentatives (voir liveBossFailCount) plutôt que d'avaler l'erreur silencieusement. */
async function refreshLiveBoss() {
  if (!sb) return;
  const wasLive = !!(liveBoss && liveBoss.expires > Date.now());
  let data = null;
  let hadError = false;
  // ensure_scheduled_boss vérifie CÔTÉ SERVEUR si une occurrence du planning (Kzarka) doit être
  // en cours maintenant et, si oui, s'assure que live_boss la reflète (sans écraser un spawn admin
  // déjà actif) — rend le boss du planning RÉELLEMENT partagé (PV communs, tout le monde se voit
  // dans l'arène) au lieu d'une instance solo par joueur. Demande explicite du 2026-07-06.
  try {
    const r = await sb.rpc('ensure_scheduled_boss');
    if (r.error) throw r.error;
    data = Array.isArray(r.data) ? r.data[0] : r.data;
  } catch (e) {
    // repli sur une simple lecture si le RPC échoue -- mais désormais TRACÉ (console.warn), plus un
    // échec avalé sans laisser de trace
    console.warn('[LiveBoss] ensure_scheduled_boss a échoué, repli sur lecture directe de live_boss', e);
    try {
      const r = await sb.from('live_boss').select('boss_id, spawned_at, expires_at, hp, max_hp').eq('id', 1).maybeSingle();
      if (r.error) throw r.error;
      data = r.data;
    } catch (e2) {
      hadError = true;
      console.warn('[LiveBoss] lecture directe de live_boss a AUSSI échoué -- liveBoss reste inchangé pour cette passe', e2);
    }
  }
  if (hadError) {
    liveBossFailCount++;
    console.warn(`[LiveBoss] échec de synchro #${liveBossFailCount} consécutif(s) -- liveBoss non confirmé`);
    // relance rapide (au lieu d'attendre le prochain tick de 20s, voir les setInterval plus bas) tant
    // que l'échec reste isolé -- backoff croissant, bornée à 5 tentatives rapprochées
    if (liveBossFailCount <= 5) setTimeout(refreshLiveBoss, 3000 * liveBossFailCount);
    // volontairement PAS de `liveBoss = null` ici : un hoquet réseau transitoire ne doit pas faire
    // disparaître un boss partagé déjà confirmé juste avant (évite un flicker "partagé -> solo ->
    // partagé" pour les autres joueurs déjà dans l'arène)
  } else {
    liveBossFailCount = 0;
    if (data && data.boss_id && BOSS_ROSTER[data.boss_id] && new Date(data.expires_at).getTime() > Date.now()) {
      liveBoss = { boss: data.boss_id, time: new Date(data.spawned_at).getTime(), expires: new Date(data.expires_at).getTime(),
                   hp: Number(data.hp||0), maxHp: Number(data.max_hp||0) };
    } else liveBoss = null; // réponse SERVEUR fiable (pas d'erreur) : aucun boss actif confirmé
  }
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
/** @returns {{boss:string, time:number, live:boolean, sharedHp?:boolean, hp?:number, maxHp?:number}|null} prochaine occurrence de boss — un spawn global admin (liveBoss) encore valide passe avant le planning horaire. */
function nextBossOccurrence() {
  // un spawn global admin encore valide passe avant tout -- hp/maxHp exposés (2026-07-15, demande
  // explicite : "si tu arrive trop tard et que le boss a été tué tu as un message... revenir plus
  // tard") pour que le lobby puisse distinguer "encore en vie" de "déjà à 0 PV mais fenêtre encore
  // ouverte" (le boss reste "live" tout le créneau de 9 min même mort, voir refreshLiveBoss)
  if (liveBoss && liveBoss.expires > Date.now()) return { boss: liveBoss.boss, time: liveBoss.time, live: true, sharedHp: true, hp: liveBoss.hp, maxHp: liveBoss.maxHp };
  const occ = bossOccurrences(new Date());
  return occ.find(o => o.live) || occ[0] || null;
}
// ---- confirmation "boss partagé" (2026-07-12, bug corrigé : "joueurs invisibles entre eux lors
// d'un World Boss") ----
// nextBossOccurrence() peut retomber SILENCIEUSEMENT sur bossOccurrences() (planning purement
// local, sans sharedHp) si liveBoss n'a pas encore pu être confirmé par le serveur -- voir
// refreshLiveBoss/liveBossFailCount ci-dessus. Avant ce correctif, wireBossLobby() démarrait alors
// startBossFight(occ.boss, !!occ.sharedHp) avec isShared=false SANS RIEN dire au joueur : il croyait
// rejoindre le combat commun (PV partagés, tout le monde visible) alors qu'il démarrait une instance
// solo (joinBossChannel n'est appelé QUE si shared, voir startBossFight) -- lui restait invisible
// aux autres et inversement. On distingue maintenant 3 états EXPLICITES pour toute occurrence live :
//  - 'confirmed'    : occ.sharedHp === true, liveBoss confirmé par le serveur -- combat partagé normal.
//  - 'pending'      : occ.live localement mais pas encore confirmé -- bouton bloqué, message clair,
//                     tant que la confirmation reste possible (voir BOSS_SHARED_CONFIRM_TIMEOUT_MS).
//  - 'solo-fallback': délai de tolérance écoulé sans confirmation -- bouton réactivé mais avec un
//                     libellé HONNÊTE ("Combattre en solo"), jamais un simple "Combattre" qui
//                     laisserait croire à du partagé.
const BOSS_SHARED_CONFIRM_TIMEOUT_MS = 15000;
/**
 * Version pure (testable) de la machine à états de confirmation "boss partagé" -- ne touche à aucun
 * état module, prend `now`/`pendingSince` en paramètres et renvoie la nouvelle valeur à mémoriser.
 * @param {{live:boolean, sharedHp?:boolean}|null} occ - occurrence courante (voir nextBossOccurrence).
 * @param {number} pendingSince - horodatage (ms) depuis lequel cette occurrence est "live" sans
 *   confirmation serveur, 0 si aucune détection en cours.
 * @param {number} now - horodatage courant (ms).
 * @returns {{state:'confirmed'|'pending'|'solo-fallback'|null, pendingSince:number}}
 */
function computeBossSharedConfirmState(occ, pendingSince, now) {
  if (!occ || !occ.live) return { state: null, pendingSince: 0 };
  if (occ.sharedHp) return { state: 'confirmed', pendingSince: 0 };
  const since = pendingSince || now;
  const state = (now - since >= BOSS_SHARED_CONFIRM_TIMEOUT_MS) ? 'solo-fallback' : 'pending';
  return { state, pendingSince: since };
}
// mémorise pendingSince entre 2 appels (rendu du lobby, ticker d'accélération) -- wrapper fin autour
// de la fonction pure ci-dessus, seul point qui touche un `let` de module.
let sharedPendingSince = 0;
/** @param {{live:boolean, sharedHp?:boolean}|null} occ. @returns {'confirmed'|'pending'|'solo-fallback'|null} état de confirmation "boss partagé" pour l'occurrence live courante (null si pas live) -- voir computeBossSharedConfirmState. */
function bossSharedConfirmState(occ) {
  const r = computeBossSharedConfirmState(occ, sharedPendingSince, Date.now());
  sharedPendingSince = r.pendingSince;
  return r.state;
}
/** @param {number} ms. @returns {string} compte à rebours formaté (HH:MM:SS, ou MM:SS si <1h). */
function fmtBossCountdown(ms) {
  let s = Math.max(0, Math.floor(ms/1000));
  const h = Math.floor(s/3600); s -= h*3600;
  const m = Math.floor(s/60); s -= m*60;
  const pad = n => String(n).padStart(2,'0');
  return (h>0 ? pad(h)+':' : '') + pad(m)+':'+pad(s);
}
// petit rappel dans la barre d'activités, mis à jour chaque seconde
/** Met à jour le petit rappel #nextBossMini de la barre d'activités (compte à rebours ou "EN COURS"). */
function updateNextBossMini() {
  const el = $('nextBossMini'); if (!el) return;
  const occ = nextBossOccurrence();
  if (!occ) { el.innerHTML = ''; return; }
  const b = BOSS_ROSTER[occ.boss];
  if (occ.live) {
    el.innerHTML = `<span class="live">${b.icon} ${b.short[LANG]} ${i18next.t('combat:combat.boss.status_live')}</span>`;
  } else {
    el.innerHTML = `${i18next.t('combat:combat.boss.next_boss_label')} : <b>${b.icon} ${b.short[LANG]}</b> ${i18next.t('combat:combat.boss.in_label')} <b>${fmtBossCountdown(occ.time - Date.now())}</b>`;
  }
}

// liste des "pages" affichée en header au-dessus du jeu (demande utilisateur) : Zone / Boss +
// activités verrouillées en teaser. Cliquer une page bascule la vue du jeu.
// Compagnon/Vie en mer (2026-07-08, demande explicite : "remet les categorie compagnon et vie en
// mer dans le header") -- vivaient ici à l'origine, déplacés le 2026-07-17 dans la barre d'onglets
// de région (#zoneTierTabs, voir EXTRA_TEASER_TABS, core/game-core.js) ; remis ICI, dans le
// header, à la demande explicite -- retirés de EXTRA_TEASER_TABS pour ne pas les dupliquer.
const ACTIVITY_TABS = [
  { id:'zone', icon:'⚔️', name:{fr:'Zone',en:'Zone'},       locked:false },
  { id:'boss', icon:'🐍', name:{fr:'Boss',en:'Boss'},       locked:false },
  // Mini Boss (2026-07-13, port du plan validé — voir combat/miniboss.js/miniboss-data.js) : juste
  // après Boss, avant Compagnon (position proposée en maquette, jamais contestée en revue) --
  // isNew tant que la feature est toute fraîche, même convention que Compagnon ci-dessous.
  { id:'miniboss', icon:'📜', name:{fr:'Mini Boss',en:'Mini Boss'}, locked:false, isNew:true },
  // Compagnon juste après Boss (2026-07-10, demande explicite : "compagnon a droite de boss") --
  // le module est sorti de sa phase de test (2026-07-18, "on passe en prod et on lie compagnon avec
  // le jeu") : badge "NEW" retiré (isNew:false) comme prévu, silver désormais partagé avec le jeu.
  { id:'pet', icon:'🐾', name:{fr:'Compagnon',en:'Companion'}, locked:false, isNew:false },
  // PvP (2026-07-20, demande explicite : "header : PVP bloqué") -- teaser verrouillé, même
  // convention que les autres activités pas encore implémentées ci-dessous. Distinct du classement
  // "PvP" DÉJÀ jouable dans le module Compagnon (onglet ⚔️ PvP, pvp.js) qui, lui, classe
  // les familiers du joueur par puissance -- ceci est le PvP joueur-contre-joueur du jeu principal.
  { id:'pvp', icon:'🗡️', name:{fr:'PvP',en:'PvP'}, locked:true },
  { id:'fish', icon:'🎣', name:{fr:'Pêche',en:'Fishing'},   locked:true },
  { id:'mine', icon:'⛏️', name:{fr:'Mine',en:'Mining'},     locked:true },
  { id:'forest', icon:'🌲', name:{fr:'Forêt',en:'Forest'},  locked:true },
  { id:'field', icon:'🌾', name:{fr:'Champs',en:'Fields'},  locked:true },
  { id:'ranch', icon:'🐑', name:{fr:'Bergerie',en:'Ranch'}, locked:true },
  { id:'workshop', icon:'🏛️', name:{fr:'Atelier royal',en:'Royal Workshop'}, locked:true },
  { id:'sea', icon:'🌊', name:{fr:'Vie en mer',en:'Sea life'}, locked:true },
];
let currentActivity = 'zone';
// cadenas remis "sur la ligne du bas" (2026-07-08, demande explicite : "remet les cadenas dans le
// header sur la ligne du bas") -- avant, le 🔒 était collé en texte APRÈS le nom sur la même ligne
// ("🎣 Pêche 🔒"), ce qui allongeait le bouton et le faisait parfois passer à la ligne dans une
// barre déjà chargée (10 onglets). Le nom et le cadenas sont maintenant 2 lignes distinctes dans
// le même bouton (voir .actTab en flex-column dans styles.css), comme la convention .zoneTierLock
// déjà utilisée ailleurs, mais ici SANS badge flottant/absolu -- juste 2 lignes empilées normales.
/** Reconstruit la barre d'onglets d'activité (header) — badges %PV boss et "NEW" inclus, câble le clic. */
function renderActivityTabs() {
  const el = $('activityTabs'); if (!el) return;
  el.innerHTML = ACTIVITY_TABS.map(t => {
    // onglet Boss : badge %PV inséré ici, mis à jour en direct par updateBossActivityTabHot()
    const hpBadge = t.id === 'boss' ? '<span class="actTabBossHp" id="actTabBossHp"></span>' : '';
    const newBadge = (!t.locked && t.isNew) ? `<span class="actTabNew">${i18next.t('combat:combat.boss.new_badge')}</span>` : '';
    return `<button class="actTab${t.locked?' locked':''}${t.id===currentActivity?' active':''}" id="${t.id==='boss'?'actTabBoss':''}" data-id="${t.id}"${t.locked?' disabled':''}>` +
      `<span class="actTabLabel">${t.icon} ${t.name[LANG]}</span>${hpBadge}${t.locked?'<span class="actTabLock">🔒</span>':newBadge}</button>`;
  }).join('');
  el.querySelectorAll('.actTab').forEach(btn => {
    if (btn.classList.contains('locked')) return;
    btn.onclick = () => showActivityPage(btn.dataset.id);
  });
  updateBossActivityTabHot();
}
// "Créer un Flash lumineux sur la catégorie boss, qu'on le vois bien 5 min avant et pendant toute
// la durée du boss, met y les % hp du boss bien visible aussi" (2026-07-08) -- allume l'onglet
// Boss du header dès que le prochain spawn est à moins de 5 min ET tant que la fenêtre de combat
// (BOSS_WINDOW_MS, 9 min) reste ouverte -- ne touche PAS au DOM des autres onglets (léger, appelé
// chaque seconde), contrairement à renderActivityTabs() qui régénère tout le innerHTML.
const BOSS_TAB_FLASH_LEAD_MS = 5 * 60 * 1000;
/** Allume/éteint le flash "bossHot" de l'onglet Boss et met à jour son badge %PV, sans regénérer tout le DOM (appelé chaque seconde). */
function updateBossActivityTabHot() {
  const btn = $a('actTabBoss'); if (!btn) return;
  const occ = nextBossOccurrence();
  // combat RÉELLEMENT en cours (solo ou partagé) : bossState.hp/maxHp, plus précis/à jour que
  // l'occurrence planifiée -- couvre aussi un boss solo (jamais dans occ.hp, seulement partagé)
  const fighting = bossState.active && bossState.maxHp > 0;
  const hot = fighting || (!!occ && (occ.live || (occ.time - Date.now()) <= BOSS_TAB_FLASH_LEAD_MS));
  btn.classList.toggle('bossHot', hot);
  // "une fois que le boss est vaincu ecrire vaincu a la place des %" (2026-07-09) -- même mot que
  // le lobby (.bossNextHpTxt quand alreadyDead) plutôt qu'un "0%" qui laisse croire que le combat
  // continue.
  const defeatedTxt = i18next.t('combat:combat.boss.status_defeated');
  const hpEl = $a('actTabBossHp');
  if (hpEl) {
    if (fighting) hpEl.textContent = bossState.hp <= 0 ? defeatedTxt : (bossState.hp/bossState.maxHp*100).toFixed(0)+'%';
    else if (occ && occ.live && typeof occ.hp === 'number' && occ.maxHp > 0) hpEl.textContent = occ.hp <= 0 ? defeatedTxt : (occ.hp/occ.maxHp*100).toFixed(0)+'%';
    else hpEl.textContent = '';
  }
}
setInterval(updateBossActivityTabHot, 1000);
// affiche/masque la vue "farm" (canvas + panneaux) — le header (barre d'activités) n'est
// JAMAIS masqué : le boss s'insère juste en dessous, dans le flux du jeu
/** @param {boolean} v. Affiche/masque la vue "farm" (canvas + panneaux) sans jamais toucher au header. */
function setFarmViewVisible(v) {
  ['gameFrame','panel','itemPop','itemTooltip'].forEach(id => {
    const el = $(id); if (el) el.style.display = v ? '' : 'none';
  });
}
/** @param {string} id - id d'ACTIVITY_TABS. Bascule la vue du jeu vers cette activité (zone/boss/compagnon). */
function showActivityPage(id) {
  if (id === 'boss') {
    currentActivity = 'boss';
    setFarmViewVisible(false);
    if (!bossState.active) openBossLobby();
  } else if (id === 'miniboss') {
    // Mini Boss (2026-07-13, combat/miniboss.js) : miroir exact de la branche 'boss' ci-dessus,
    // réutilise setFarmViewVisible() tel quel — voir plan §5.
    currentActivity = 'miniboss';
    setFarmViewVisible(false);
    if (!minibossState.active) openMiniBossLobby();
  } else if (id === 'pet') {
    currentActivity = 'pet';
    openCompanionsModule();
  } else { // zone = retour au farm
    currentActivity = 'zone';
    if (!bossState.active) $('bossRoom').classList.remove('open');
    if (!minibossState.active) { const mbr = $a('minibossRoom'); if (mbr) mbr.classList.remove('open'); }
    setFarmViewVisible(true);
  }
  renderActivityTabs();
}

// Compagnon (2026-07-19, débloqué avec locked:false ci-dessus) : le module (src/companions/,
// ~2900 lignes portées depuis une maquette validée) charge dans un iframe isolé, créé au tout
// premier clic seulement -- jamais bundlé avec le jeu (scripts/build.py ne lit que les
// <script src="src/..."> de index.dev.html, ce dossier n'y figure pas), donc jamais
// téléchargé/exécuté tant que l'onglet n'est pas ouvert. Iframe plutôt que fusion au bundle :
// le module réutilise des noms globaux génériques (SILVER, PETS, toast, ST, son propre :root
// de couleurs...) qui entreraient en collision avec le scope global partagé du jeu -- voir
// src/companions/README.md.
/** Ouvre le module Compagnon dans une iframe isolée (créée au tout premier clic, jamais bundlée avec le jeu — voir src/companions/README.md). */
function openCompanionsModule() {
  let overlay = $a('companionsOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'companionsOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:950;background:#080810;display:flex;flex-direction:column';
    const bar = document.createElement('div');
    bar.style.cssText = 'flex-shrink:0;display:flex;justify-content:flex-end;padding:6px 10px;background:#10101e;border-bottom:1px solid #2a2a44';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ ' + i18next.t('combat:combat.boss.close_button');
    closeBtn.style.cssText = 'font-family:Georgia,serif;font-size:12px;background:transparent;border:1px solid #3a3a58;color:#ddd0b8;border-radius:5px;padding:5px 12px;cursor:pointer';
    closeBtn.onclick = closeCompanionsModule;
    bar.appendChild(closeBtn);
    const frame = document.createElement('iframe');
    frame.id = 'companionsFrame';
    frame.style.cssText = 'flex:1;border:0;width:100%';
    frame.src = 'src/companions/companions.html?v=17'; // bump OBLIGATOIRE dès que companions.html change (onglets/panels/shell), sinon le navigateur sert l'ancien shell en cache (cache-busting, voir companions.html)
    overlay.appendChild(bar);
    overlay.appendChild(frame);
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
}
/** Ferme l'iframe du module Compagnon et revient à la vue Zone. */
function closeCompanionsModule() {
  const overlay = $a('companionsOverlay');
  if (overlay) overlay.style.display = 'none';
  currentActivity = 'zone';
  showActivityPage('zone');
}

// affiche la page Boss (lobby) : prochain boss + calendrier, dans la colonne du jeu, pleine hauteur
/** Affiche la page Boss (lobby) : rafraîchit d'abord liveBoss puis render le lobby (prochain boss + calendrier), câble ses actions. */
async function openBossLobby() {
  $('bossRoom').classList.remove('fight'); $('bossRoom').classList.add('lobby', 'open');
  // rafraîchit d'abord l'état du boss global (spawn admin) pour que la page reflète tout de suite
  // ce que voit le serveur, sans attendre le prochain tick de polling (20 s)
  await refreshLiveBoss();
  $('bossLobbyBody').innerHTML = renderBossLobbyHtml();
  wireBossLobby();
  // tutoriel d'action au tout premier accès au lobby boss (2026-07-19) -- voir
  // ITEM_TUTORIALS.boss/maybeQueueTutorialById (progression/notifications-quests.js)
  if (typeof maybeQueueTutorialById === 'function') maybeQueueTutorialById('boss');
}
// BUG trouvé le 2026-07-16 (demande explicite : "le timer se met pas a jour dans boss") : le
// commentaire ci-dessus promettait un "tick de polling (20s)" qui n'existait NULLE PART dans le
// code -- le countdown #bossPanelCountdown n'était donc calculé qu'UNE SEULE FOIS, à l'ouverture du
// lobby, puis restait figé indéfiniment (contrairement à #nextBossMini, en dehors du lobby, qui
// tique bien chaque seconde via setInterval(updateNextBossMini,...) dans game-supabase.js). Un
// joueur qui restait sur la page Boss ne voyait jamais le compte à rebours descendre, ni le bouton
// "Combattre" apparaître automatiquement quand le créneau devenait live. Deux tickers, comme promis
// par le commentaire d'origine : un local (1s, juste le texte du countdown, aucun réseau) + un
// serveur (20s, ré-interroge ensure_scheduled_boss et re-render tout le lobby si l'état a changé) --
// tous deux inertes tant que le lobby n'est pas réellement ouvert.
/** Tick local (1s, aucun réseau) du compte à rebours #bossPanelCountdown affiché dans le lobby — n'agit pas si le créneau vient de passer "live" (le ticker serveur 20s re-render alors tout le lobby). */
function tickBossPanelCountdown() {
  const el = $a('bossPanelCountdown'); if (!el) return;
  const occ = nextBossOccurrence();
  if (!occ || occ.live) return; // passe en "live" -> le prochain tick serveur (20s) re-render tout le lobby
  el.textContent = fmtBossCountdown(occ.time - Date.now());
}
setInterval(tickBossPanelCountdown, 1000);
setInterval(() => {
  const room = $a('bossRoom');
  if (room && room.classList.contains('open') && room.classList.contains('lobby') && !bossState.active) refreshLiveBoss();
}, 20000);
// ticker dédié (3s) tant qu'une occurrence live n'est pas encore confirmée "partagée" (voir
// bossSharedConfirmState/BOSS_SHARED_CONFIRM_TIMEOUT_MS) -- accélère la confirmation serveur (au
// lieu d'attendre le ticker normal de 20s ci-dessus) ET re-render le lobby dès que l'état bascule
// (pending -> confirmed ou solo-fallback), pour que le joueur ne reste jamais devant un bouton figé
// dans un état ambigu plus longtemps que nécessaire.
let bossPendingRefreshInFlight = false;
setInterval(() => {
  const room = $a('bossRoom');
  if (!(room && room.classList.contains('open') && room.classList.contains('lobby') && !bossState.active)) return;
  const state = bossSharedConfirmState(nextBossOccurrence());
  if (state !== 'pending') return;
  $('bossLobbyBody').innerHTML = renderBossLobbyHtml(); // fait avancer le countdown de tolérance à l'écran
  wireBossLobby();
  if (bossPendingRefreshInFlight) return;
  bossPendingRefreshInFlight = true;
  // refreshLiveBoss() est une fonction async -> renvoie toujours une vraie Promise, .finally() existe
  refreshLiveBoss().finally(() => { bossPendingRefreshInFlight = false; });
}, 3000);
// quantité déjà en poche du matériau garanti du boss (b.matKey) -- affichée à côté de la fourchette
// de drop dans la carte "prochain boss" du lobby (2026-07-11, reskin visuel, voir CLAUDE.md).
// INV peut contenir plusieurs slots de la même clé en théorie (voir invAdd/MAX_STACK) -- somme sur
// tous les slots plutôt qu'un simple find, jamais de throw si INV est vide/non initialisé.
/** @param {string} matKey - clé du matériau garanti d'un boss. @returns {number} quantité déjà en poche (somme sur tous les slots INV partageant cette clé). */
function bossMatInHand(matKey) {
  if (!matKey || !Array.isArray(INV)) return 0;
  return INV.reduce((sum, s) => s && s.key === matKey ? sum + (s.qty || 0) : sum, 0);
}
// libellés/attributs du bouton "Combattre" du lobby (2026-07-12, voir bossSharedConfirmState) --
// extrait de renderBossLobbyHtml() pour couvrir explicitement les 4 états possibles d'une occurrence
// (pas encore live / confirmée partagée / en attente de confirmation / repli solo explicite) plutôt
// que le seul if(occ.live) binaire d'avant, qui masquait le mode "partagé implicite" du bug 2026-07-12.
/** @param {{live:boolean, sharedHp?:boolean}|null} occ. @returns {string} HTML du bouton "Combattre" (+ message au-dessus si pending/solo-fallback). */
function bossFightButtonHtml(occ) {
  if (!occ || !occ.live) {
    return `<button class="bossFightBtn" id="bossFightBtn" disabled>${i18next.t('combat:combat.boss.not_spawned_yet')}</button>`;
  }
  const state = bossSharedConfirmState(occ);
  if (state === 'pending') {
    return `<div class="admHint">${i18next.t('combat:combat.boss.connecting_hint')}</div>` +
      `<button class="bossFightBtn" id="bossFightBtn" disabled>${i18next.t('combat:combat.boss.connecting_button')}</button>`;
  }
  if (state === 'solo-fallback') {
    return `<div class="admHint">${i18next.t('combat:combat.boss.solo_fallback_hint')}</div>` +
      `<button class="bossFightBtn soloFallback" id="bossFightBtn">${i18next.t('combat:combat.boss.solo_fallback_button')}</button>`;
  }
  // 'confirmed' (occ.sharedHp === true) : combat partagé normal
  return `<button class="bossFightBtn" id="bossFightBtn">${i18next.t('combat:combat.boss.fight_button')}</button>`;
}
/** @returns {string} HTML complet du lobby Boss (carte "prochain boss" avec countdown/barre PV/récompense, calendrier hebdomadaire, règles de récompense). */
function renderBossLobbyHtml() {
  const occ = nextBossOccurrence();
  const now = Date.now();
  let nextHtml = `<div class="admEmpty">${i18next.t('combat:combat.boss.no_boss_scheduled')}</div>`;
  if (occ) {
    const b = BOSS_ROSTER[occ.boss];
    // boss partagé déjà à 0 PV mais fenêtre de 9 min encore ouverte (2026-07-15, demande explicite :
    // "si tu arrive trop tard et que le boss a été tué tu as un message... revenir plus tard") --
    // occ.live restait vrai (basé sur expires, pas sur hp), laissant un joueur en retard "entrer"
    // dans un combat déjà gagné sans avoir tapé, avec le risque de repartir sans rien (voir
    // endBossFight/boss_claim, -1 = aucune contribution). Bloqué en amont, avant même d'entrer.
    const alreadyDead = occ.live && occ.sharedHp && typeof occ.hp === 'number' && occ.hp <= 0;
    const cd = occ.live
      ? `<div class="bossNextCountdown live">${alreadyDead ? i18next.t('combat:combat.boss.status_defeated') : i18next.t('combat:combat.boss.status_live')}</div>`
      : `<div class="bossNextCountdown" id="bossPanelCountdown">${fmtBossCountdown(occ.time - now)}</div>`;
    const when = new Date(occ.time).toLocaleString(LANG==='fr'?'fr-FR':'en-US', { weekday:'long', hour:'2-digit', minute:'2-digit' });
    // "boss vaincu, on change la barre de vie et on ecris vaincu jusqu'au moment ou il aurait du
    // despawn" (2026-07-08) -- avant, seul le texte "VAINCU"/"Déjà vaincu..." existait dans le
    // lobby, sans aucune barre de vie (contrairement à l'arène, #bossHpBar). Ajoute une VRAIE barre
    // ici, à 0% et grisée/rouge tant que alreadyDead, visible tant que occ.live (donc jusqu'à
    // BOSS_WINDOW_MS après le spawn, le moment exact où il aurait normalement despawn).
    const hpBarHtml = (occ.live && occ.sharedHp && typeof occ.hp === 'number' && occ.maxHp > 0)
      ? (() => {
          const pct = Math.max(0, Math.min(100, occ.hp/occ.maxHp*100));
          return `<div class="bossNextHpWrap"><div class="bossNextHpBar${alreadyDead?' dead':''}" style="width:${pct}%"></div>` +
            `<span class="bossNextHpTxt">${alreadyDead ? i18next.t('combat:combat.boss.status_defeated') : pct.toFixed(1)+'%'}</span></div>`;
        })()
      : '';
    // ligne récompense garantie (+ quantité déjà en poche, voir bossMatInHand) et loot rarissime
    // (2026-07-11, reskin visuel du lobby Boss -- voir CLAUDE.md) : rendait auparavant visible
    // seulement APRÈS combat (bossRewardRulesHtml plus bas reste la source de vérité des règles
    // détaillées) -- ici juste un résumé compact dans la carte "prochain boss".
    const haveQty = bossMatInHand(b.matKey);
    const rewardLineHtml = `<div class="bossNextReward">` +
      `<span>${b.matIcon ? b.matIcon+' ' : ''}${tr(b.matName)} · <b>${b.matQty[0]}-${b.matQty[1]}</b> <span class="have">${i18next.t('combat:combat.boss.have_qty', { qty: haveQty })}</span></span>` +
      (b.rareLoot ? `<span>${b.rareLoot.icon} ${tr(b.rareLoot.name)} · <b>${Math.round(b.rareLoot.ch*100)}%</b></span>` : '') +
      `</div>`;
    // bandeau "premier kill de la semaine" (2026-07-11, reskin lobby) : le bonus n'était visible
    // qu'une fois le combat terminé (voir bossMultBadgesHtml/endBossFight) -- rendu visible ICI,
    // avant même de combattre, pour CE boss précis (bonus par boss, pas global, voir bossFirstKillOfWeek).
    const weekBannerHtml = bossFirstKillOfWeek(occ.boss)
      ? `<div class="weekBanner">${i18next.t('combat:combat.boss.week_bonus_available')} · ${i18next.t('combat:combat.boss.first_kill_week_bonus', { bonusPct: Math.round((BOSS_FIRST_KILL_WEEK_BONUS-1)*100) })}</div>`
      : '';
    nextHtml = `<div class="bossNext">
      <div class="bossNextIcon">${b.icon}</div>
      <div class="bossNextInfo">
        <div class="bossNextName">${b.name[LANG]}</div>
        ${b.lore ? `<div class="bossNextLore">${b.lore[LANG]}</div>` : ''}
        <div class="bossNextTime">${alreadyDead ? i18next.t('combat:combat.boss.already_defeated_by_others') : occ.live ? i18next.t('combat:combat.boss.available_now') : when}</div>
        ${rewardLineHtml}
        ${hpBarHtml}
      </div>
      ${cd}
    </div>
    ${weekBannerHtml}` +
    (alreadyDead
      ? `<div class="admHint">${i18next.t('combat:combat.boss.already_defeated_hint')}</div>` +
        `<button class="bossFightBtn" id="bossFightBtn" disabled>${i18next.t('combat:combat.boss.already_defeated_button')}</button>`
      : bossFightButtonHtml(occ));
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
    calHtml = `<div class="admEmpty">${i18next.t('combat:combat.boss.nothing_scheduled')}</div>`;
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
          calHtml += `<div class="bcCell${o.live?' bcLive':''}" title="${b.name[LANG]}">${b.icon}<span class="bcName">${o.live?i18next.t('combat:combat.boss.status_live'):b.short[LANG]}</span></div>`; }
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
  // reskin visuel (2026-07-11, voir CLAUDE.md) : chaque section du lobby devient une carte ".card"
  // (même convention que la refonte Zone, voir styles.css) au lieu d'un long bloc plat -- purement
  // additif côté HTML, aucune des fonctions génératrices ci-dessus n'est modifiée dans sa logique.
  return `<div class="card bossHeroCard">${nextHtml}</div>
    <div class="card" style="margin-top:14px">
      <h3>${i18next.t('combat:combat.boss.weekly_calendar_title')}</h3>
      ${calHtml}
      <div class="bcLegendRow">${legend}</div>
      <div class="admSummary">${i18next.t('combat:combat.boss.schedule_note')}</div>
    </div>
    <div class="card" style="margin-top:14px">
      ${bossRewardRulesHtml()}
    </div>`;
}
/** Câble les actions du lobby Boss (bouton Combattre, sélecteur d'aperçu de récompense Kzarka/Vell). */
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
  // serverConfirmedDead (2026-07-12, bug corrigé : fausse "récompense déjà réclamée") : en partagé,
  // seule cette valeur (mise à jour UNIQUEMENT depuis la réponse authoritative de boss_contribute,
  // voir applyBossContributeResponse/bossLoop) déclenche la victoire -- jamais bossState.hp, qui
  // reste décrémenté localement chaque frame au DPS RÉEL du joueur SANS le plafond de 5%/appel que
  // le serveur applique (boss_contribute, `p_damage := least(p_damage, max_hp*0.05)`). Un joueur à
  // fort DPS voyait sa prédiction locale atteindre 0 bien avant le serveur, endBossFight(true)
  // partait trop tôt, et boss_claim() (qui n'accorde la récompense QUE si le PV serveur est <=0)
  // refusait avec un faux "déjà réclamée" alors qu'il s'agissait d'une vraie première victoire.
  shared:false, expiresAt:0, contribAccum:0, contribCd:0, topCd:0, topList:[], myDmg:0, activeFighters:0, presenceCd:0, serverConfirmedDead:false,
  // ---- effet de profondeur/immersion ("4D") : tremblement d'écran + braises de corruption en parallaxe ----
  shakeT:0, embers:[],
  // ---- pénalité de récompense sur mort pendant le combat (voir bossDeathPenaltyMult) : ce boss ne
  // "wipe" jamais (bossLoop clampe playerHp à 1, "pas de wipe sur ce boss d'intro"), donc une "mort"
  // ici = playerHp qui atteint 0 AVANT ce clamp -- comptée une seule fois par occurrence (deathFlag
  // évite de recompter chaque frame tant que le joueur reste sous le seuil).
  deathCount:0, deathFlag:false };
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
/** @param {string} bossKey - clé BOSS_ROSTER. Rejoint le canal Supabase Realtime Presence de ce boss (topic 'boss_'+bossKey), diffuse la position du joueur, se reconnecte automatiquement en cas de coupure du canal pendant que le combat partagé est actif. */
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
/** Quitte le canal Presence du boss en cours (bossChannel), vide otherFighters/otherFightersPos. */
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
/** @param {string} bossId. @returns {{x:number,y:number}[]} les 10 spots d'attaque fixes de ce boss. */
function bossAttackSpots(bossId) { return bossId === 'vell' ? BOSS_SPOTS_VELL : BOSS_SPOTS_KZARKA; }
const bossCtx = document.getElementById('bossCv').getContext('2d');
// DPS nominal ≈ PA effective × somme(dmg/cd des sorts) ; sert à calculer une durée dans [2,9] min.
// SKILLS étant déclaré plus bas dans le fichier, la somme est calculée paresseusement (au 1er appel)
// pour éviter une erreur TDZ au chargement.
let _skillDpsSum = 0;
// DPS de référence pour un joueur à PA "adaptée" (~250) : sert à calibrer les PV du boss partagé
// (400000 PV / 300s = ~5 min pour ce stuff, cf commentaire du roster) sans dépendre du stuff de l'admin
const BOSS_REF_DPS = 1333;
/** @returns {number} DPS nominal estimé du joueur contre un boss (PA effective × somme dmg/cd des sorts), utilisé pour calibrer la durée du combat solo. */
function playerBossDps() {
  if (!_skillDpsSum) _skillDpsSum = SKILLS.filter(s => s.dmg).reduce((a,s) => a + s.dmg/s.cd, 0);
  return Math.max(1, apEff() * _skillDpsSum);
}
/**
 * Démarre un combat de boss : bascule sur PV/durée du serveur si partagé (liveBoss, PV communs),
 * sinon calcule une durée solo depuis playerBossDps() (clampée 2-7 min). Tire un spot d'attaque
 * fixe au hasard, rejoint le canal Presence si partagé, lance la boucle bossLoop.
 * @param {string} bossId - clé BOSS_ROSTER.
 * @param {boolean} [isShared] - vrai si le joueur rejoint un combat partagé (spawn admin/planning).
 */
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
    serverConfirmedDead:false,
    shakeT:0, embers:[], deathCount:0, deathFlag:false,
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
/** Rafraîchit le classement de contribution en direct (boss_top RPC) + le compteur de combattants actifs (boss_active_count), puis re-render. */
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
/** Reconstruit le top 10 de contribution affiché en combat partagé (pseudo, %, dégâts, pastille "actif"). */
function renderBossTop() {
  const el = $('bossTopList'); if (!el) return;
  const liveEl = $('btpLiveCount');
  if (liveEl) {
    const n = bossState.activeFighters || 0;
    liveEl.textContent = n > 0
      ? i18next.t('combat:combat.boss.players_fighting', { n, s: n>1?'s':'' })
      : i18next.t('combat:combat.boss.waiting_for_fighters');
  }
  const list = bossState.topList.slice(0, 10);
  if (!list.length) { el.innerHTML = `<div class="btpRow">${i18next.t('combat:combat.boss.be_first')}</div>`; return; }
  el.innerHTML = list.map((r,i) =>
    `<div class="btpRow${currentUser && r.user_id===currentUser.id?' me':''}"><span class="btpRank">#${i+1}</span>` +
    `<span class="btpPseudo">${r.active?'<span class="btpActiveDot"></span>':''}${escapeHtml(r.pseudo||'?')}</span>` +
    `<span class="btpPct">${(r.pct!=null?r.pct:0)}%</span><span class="btpDmg">${fmt(Math.round(r.damage))}</span></div>`).join('');
}
/** Redimensionne le canvas #bossCv à la taille CSS de son conteneur (repli 1280×600 si non mesurable). */
function resizeBossCanvas() {
  const cv = $('bossCv');
  cv.width = cv.clientWidth || 1280;
  cv.height = cv.clientHeight || 600;
}
/**
 * Multiplicateur de récompense selon le RANG de contribution (boss partagé) : plus haut dans le
 * top, plus la récompense est intéressante.
 * @param {number} rank - rang de contribution (1 = meilleur contributeur).
 * @returns {number} multiplicateur — 3× rang 1, 2× top 3, 1.4× top 10, 1× (base) au-delà.
 */
function bossRankMultiplier(rank) {
  if (rank === 1) return 3;
  if (rank <= 3) return 2;
  if (rank <= 10) return 1.4;
  return 1; // hors du top 10 : récompense de base pour avoir participé
}
// semaine ISO 8601 ('YYYY-Www') d'une date -- pure, testable isolément. Utilisée pour le bonus
// "premier kill de la semaine PAR BOSS" (S.bossLastKillWeek[bossId], voir endBossFight). ISO et non
// un simple Date.now()/durée fixe : évite toute dérive de fuseau horaire aux limites de semaine,
// cohérent avec le reste du fichier qui calcule déjà les horaires en Europe/Paris.
/** @param {Date} date. @returns {string} semaine ISO 8601 ('YYYY-Www') de cette date — pure, utilisée pour le bonus "premier kill de la semaine". */
function getISOWeekString(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // lundi=1..dimanche=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // jeudi de la même semaine ISO
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return d.getUTCFullYear() + '-W' + String(weekNo).padStart(2, '0');
}
// pity du loot rarissime (b.rareLoot, Kzarka/Vell uniquement) -- à 1%/5% de chance, l'espérance est
// ~100/~20 kills avant un drop ; un palier de garantie à 25 reste un vrai filet de sécurité (couvre
// la malchance extrême) sans devenir un "cadeau" qui casse la rareté voulue de l'objet.
const BOSS_PITY_THRESHOLD = 25;
// table de pénalité de récompense sur mort pendant le combat (voir bossState.deathCount) -- 0 mort
// n'est PAS un bonus, juste l'absence de malus (badge "Perfect Kill" seul, voir bossPerfectKillHtml).
// À 4+ morts : le loot chiffré (silver/matériau/Caphras/Fragment) tombe à 0, mais les drops garantis
// (récompense de base) restent -- l'esprit de la pénalité est de retirer le "bonus" de performance,
// jamais de punir une victoire chèrement acquise en la rendant totalement stérile.
const BOSS_DEATH_PENALTY = [1, 0.9, 0.75, 0.5, 0];
/**
 * Multiplicateur de récompense selon le nombre de morts pendant le combat.
 * @param {number} deathCount - S.bossFight.deathCount de la session en cours.
 * @returns {number} multiplicateur (1 = aucune pénalité, 0 = loot chiffré nul à 4+ morts — les
 *   drops garantis restent, voir BOSS_DEATH_PENALTY).
 */
function bossDeathPenaltyMult(deathCount) {
  return BOSS_DEATH_PENALTY[Math.min(deathCount, BOSS_DEATH_PENALTY.length - 1)];
}
// bonus "premier kill de la semaine" -- PAR BOSS (S.bossLastKillWeek[bossId]), pas global : tuer
// Kzarka cette semaine ne "consomme" pas le bonus de Vell. Lit la semaine AVANT de la mettre à jour
// (appelant : endBossFight), sinon le bonus ne se déclencherait jamais.
const BOSS_FIRST_KILL_WEEK_BONUS = 1.5;
/** @param {string} bossId. @returns {boolean} vrai si ce boss précis n'a pas encore été tué cette semaine ISO (bonus disponible). */
function bossFirstKillOfWeek(bossId) {
  return S.bossLastKillWeek[bossId] !== getISOWeekString(new Date());
}
// badges affichés dans l'écran de résultat (sous rewardsHtml) : "Perfect Kill" (0 mort, PAS un
// bonus chiffré supplémentaire -- juste l'absence de malus, voir BOSS_DEATH_PENALTY[0]=1), la
// pénalité de mort si elle a réduit le loot, et le bonus 1er kill de la semaine. Même idiome
// LANG==='fr'?'...':'...' que le reste du fichier, pas de nouvelle classe CSS -- réutilise .brRewards.
/** @param {number} deathCount @param {boolean} firstKillWeek. @returns {string} HTML des badges de résultat (Perfect Kill/pénalité de mort/bonus 1er kill de la semaine). */
function bossMultBadgesHtml(deathCount, firstKillWeek) {
  let html = '';
  if (deathCount === 0) {
    html += `<div class="brRewards admHint">✨ ${i18next.t('combat:combat.boss.perfect_kill')}</div>`;
  } else {
    const pct = Math.round((1 - bossDeathPenaltyMult(deathCount)) * 100);
    const s = deathCount>1?'s':'';
    const excludedNote = deathCount>=BOSS_DEATH_PENALTY.length-1 ? i18next.t('combat:combat.boss.death_penalty_rare_excluded') : '';
    html += `<div class="brRewards admHint">${i18next.t('combat:combat.boss.death_penalty', { deathCount, s, pct, excludedNote })}</div>`;
  }
  if (firstKillWeek) {
    html += `<div class="brRewards admHint" style="color:var(--gold)">🗓️ ${i18next.t('combat:combat.boss.first_kill_week_bonus', { bonusPct: Math.round((BOSS_FIRST_KILL_WEEK_BONUS-1)*100) })}</div>`;
  }
  return html;
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
/** @returns {number|null} index de la zone "ZONE DIFFICILE" la plus avancée (reqAP le plus haut), ou null si aucune. */
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
/** @returns {number|null} index de la zone "ZONE DANGEREUSE" la moins hors de portée (reqAP le plus bas), ou null si aucune. */
function nextDangereuseZoneIdx() {
  let best = -1;
  for (let zi = 0; zi < ZONES.length; zi++) {
    if (badgeOf(bottleneck(ZONES[zi])).txt === 'ZONE DANGEREUSE' && (best === -1 || ZONES[zi].reqAP < ZONES[best].reqAP)) best = zi;
  }
  return best === -1 ? null : best;
}
/** @param {number} zi - index de zone. @returns {object} item bijou (jackpot) reconstitué pour l'aperçu de récompense boss — mêmes formules que rollDrops (GEAR_ROLE.jackpot.apShare, JACKPOT_VAL_TRASH_RATIO). */
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
/** @param {number} zi - index de zone. @param {number} qty. @returns {object} item matériau du palier de cette zone, pour l'aperçu de récompense boss. */
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
/** @returns {string} HTML du sélecteur Kzarka/Vell de l'aperçu de récompense du lobby. */
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
// barre de progression du pity (voir BOSS_PITY_THRESHOLD/endBossFight) -- réutilise les classes
// .admBars/.admBarRow/.admBarTrack/.admBar/.admBarVal déjà existantes (styles.css) plutôt que
// d'introduire une nouvelle CSS, cohérent avec le thème sombre/or du reste du panneau.
/** @param {string} bossId. @returns {string} HTML de la barre de progression du pity vers le rareLoot de ce boss ('' si pas de rareLoot). */
function bossPityBarHtml(bossId) {
  const b = BOSS_ROSTER[bossId];
  if (!b || !b.rareLoot) return '';
  const count = S.bossPity[bossId] || 0;
  const pct = Math.min(100, count / BOSS_PITY_THRESHOLD * 100);
  return `<div class="admBars" style="margin:6px auto 0;max-width:260px">
    <div class="admBarRow">
      <span class="admBarLbl">${i18next.t('combat:combat.boss.pity_label')}</span>
      <span class="admBarTrack"><span class="admBar" style="width:${pct}%"></span></span>
      <span class="admBarVal">${count}/${BOSS_PITY_THRESHOLD}</span>
    </div>
  </div>`;
}
/** @returns {string} HTML complet des règles de récompense (sélecteur, podium par rang, ligne rareLoot+pity) pour bossRewardPreviewBoss — Kzarka en récompenses fixes (KZARKA_REWARD_TIERS), Vell en zones de progression. */
function bossRewardRulesHtml() {
  const b = BOSS_ROSTER[bossRewardPreviewBoss];
  const rareLine = b.rareLoot
    ? `<div class="bossRewardExtra">✨ +${Math.round(b.rareLoot.ch*100)}% ${i18next.t('combat:combat.boss.chance_label')} : <b style="color:${b.rareLoot.color}">${tr(b.rareLoot.name)}</b></div>${bossPityBarHtml(bossRewardPreviewBoss)}`
    : '';
  // Kzarka (2026-07-16, demande explicite) : podium à récompenses FIXES (silver + Caphras/Fragment
  // de mémoire), voir KZARKA_REWARD_TIERS/endBossFight -- Vell garde le podium générique basé sur
  // la zone de progression du joueur (bestDifficileZoneIdx/nextDangereuseZoneIdx).
  let baseHtml, podiumHtml;
  if (bossRewardPreviewBoss === 'kzarka') {
    const t1 = KZARKA_REWARD_TIERS[1], t2 = KZARKA_REWARD_TIERS[2], t3 = KZARKA_REWARD_TIERS[3];
    baseHtml = '';
    podiumHtml = `<div class="bossPodium">
      <div class="bossPodiumStep rank2"><div class="bossPodiumMedal">🥈</div><div class="bossPodiumReward">+${fmt(t2.silver)} 🪙<br>${t2.caphras[0]}-${t2.caphras[1]} ${i18next.t('combat:combat.boss.caphras_label')} · ${t2.frag[0]}-${t2.frag[1]} ${i18next.t('combat:combat.boss.memory_frag_label')}</div></div>
      <div class="bossPodiumStep rank1"><div class="bossPodiumMedal">🥇</div><div class="bossPodiumReward">+${fmt(t1.silver)} 🪙<br>${t1.caphras[0]}-${t1.caphras[1]} ${i18next.t('combat:combat.boss.caphras_label')} · ${t1.frag[0]}-${t1.frag[1]} ${i18next.t('combat:combat.boss.memory_frag_label')}</div></div>
      <div class="bossPodiumStep rank3"><div class="bossPodiumMedal">🥉</div><div class="bossPodiumReward">+${fmt(t3.silver)} 🪙<br>${t3.caphras[0]}-${t3.caphras[1]} ${i18next.t('combat:combat.boss.caphras_label')} · ${t3.frag[0]}-${t3.frag[1]} ${i18next.t('combat:combat.boss.memory_frag_label')}</div></div>
    </div>`;
  } else {
    const dZi = bestDifficileZoneIdx(), dgZi = nextDangereuseZoneIdx();
    const dName = dZi != null ? tr(ZONES[dZi].name) : '—';
    const dgName = dgZi != null ? tr(ZONES[dgZi].name) : '—';
    baseHtml = `<div class="bossRewardBase">🎁 ${i18next.t('combat:combat.boss.for_everyone')} : ${i18next.t('combat:combat.boss.hard_zone_stone')} (<b>${dName}</b>)</div>`;
    podiumHtml = `<div class="bossPodium">
      <div class="bossPodiumStep rank2"><div class="bossPodiumMedal">🥈</div><div class="bossPodiumReward">${i18next.t('combat:combat.boss.rank2_reward_generic')} (<b>${dName}</b>)</div></div>
      <div class="bossPodiumStep rank1"><div class="bossPodiumMedal">🥇</div><div class="bossPodiumReward">${i18next.t('combat:combat.boss.rank1_reward_generic')} (<b>${dgName}</b>)</div></div>
      <div class="bossPodiumStep rank3"><div class="bossPodiumMedal">🥉</div><div class="bossPodiumReward">${i18next.t('combat:combat.boss.rank3_reward_generic')}</div></div>
    </div>`;
  }
  return `<div class="bossRewardRules">
    ${bossRewardSelectorHtml()}
    ${baseHtml}
    ${podiumHtml}
    ${rareLine}
  </div>`;
}
// roue de récompense rare (2026-07-08, demande explicite) : affichée en fin de combat quand le
// boss a une table "rareLoot" définie (Vell → Coeur de Vell, 5%) — tourne toute seule et s'arrête
// sur le lot RÉELLEMENT obtenu (déjà tiré au sort avant l'animation, la roue ne fait que le révéler).
// Rendu en React depuis le 2026-07-19 (demande explicite : "je veux une roue react et que tout soit
// aligné") -- voir src/combat/boss-wheel-react.js (BossWheelReact/mountBossWheelReact/
// wheelLandingDeg). Ici, renderBossRewardReveal ne pose plus qu'un conteneur DOM vide par roue
// (au plus une par combat, IDs indexés comme le reste de la liste de révélation), React prend le
// relais entièrement pour le rendu ET l'animation.
// "lors de la fin du boss une roulette tourne ou un des se jette pour chaque recompense
// aléatoire, le joueur peut passer puis un bouton quitter s'affiche (retour a zone)" (2026-07-08)
// -- séquence de révélation : un dé (icône + résultat masqué) par récompense à quantité aléatoire,
// une roue (bossWheelMarkup) par récompense à chance binaire (loot rarissime), révélés l'un après
// l'autre. "Passer" révèle tout instantanément. Le bouton "Quitter" (retour DIRECT à la zone de
// farm, plus au lobby boss comme avant) n'apparaît qu'une fois tout révélé (naturellement ou via
// Passer) -- jamais avant, pour que le joueur voie au moins une fois ce qu'il a gagné.
const BOSS_REVEAL_STAGGER_MS = 850, BOSS_REVEAL_WHEEL_MS = 3600;
// "Les roll du boss Pierre de caphras et frag memoire doivent se faire plus lentement et donner
// une lenteur plus en plus petite des qu'il arrive a la fin ou alors casino entierement pour tout
// les loot montre" (2026-07-09) -- roulement "casino" pour TOUTE récompense chiffrée (silver,
// matériau, Caphras, Fragment...), pas seulement les 2 citées : le nombre défile aléatoirement,
// de plus en plus LENTEMENT (l'intervalle entre 2 tirages s'allonge à chaque tick, x1.16), jusqu'à
// s'arrêter PILE sur la vraie valeur déjà tirée plus haut (le hasard a déjà eu lieu, ceci ne fait
// que le révéler, comme la roue). Plus long qu'avant (2.2s de roulement contre 0.65s de rebond
// fixe) pour laisser le temps de "voir" le ralentissement.
const BOSS_ROLL_DURATION_MS = 2200, BOSS_ROLL_START_INTERVAL_MS = 40, BOSS_ROLL_GROWTH = 1.16;
// near-miss de la roue de récompense rare (voir revealOne ci-dessous) : 18% des pertes atterrissent
// volontairement à quelques degrés du segment rare plutôt qu'à un point uniforme de la zone sûre --
// la marge (8°) doit rester nettement plus grande que la tolérance visuelle du pointeur/segment pour
// ne jamais sembler tomber SUR le rare par erreur d'affichage.
const BOSS_NEAR_MISS_CHANCE = 0.18, BOSS_NEAR_MISS_MARGIN_DEG = 8;
/** @param {object[]} items - récompenses à révéler (dé 'dice' ou roue 'wheel'). @returns {string} HTML de la séquence de révélation (bouton Quitter direct si aucune récompense). */
function renderBossRewardReveal(items) {
  if (!items.length) return `<button id="bossCloseBtn">${i18next.t('combat:combat.boss.leave_button')}</button>`;
  const itemsHtml = items.map((it,i) => {
    const iconHtml = it.kind==='wheel' ? `<div class="bossWheelReactRoot" id="bossWheelReactRoot${i}"></div>`
      : `<span class="brDiceIcon" id="brDiceIcon${i}" style="color:${it.color||'#e8c96a'}">${it.icon||'🎲'}</span>`;
    return `<div class="brRevealItem" id="brRevealItem${i}">${iconHtml}<div class="brRevealResult" id="brRevealResult${i}">${i18next.t('combat:combat.boss.reveal_placeholder')}</div></div>`;
  }).join('');
  return `<div class="brRevealList">${itemsHtml}</div>` +
    `<button id="bossSkipBtn" class="bossSkipBtn">${i18next.t('combat:combat.boss.skip_button')}</button>` +
    `<button id="bossCloseBtn" style="display:none">${i18next.t('combat:combat.boss.leave_button')}</button>`;
}
// branche les timers de révélation + le bouton "Passer" -- appelé par l'appelant juste APRÈS avoir
// inséré le HTML de renderBossRewardReveal() dans le DOM (jamais via un setTimeout interne : cette
// assignation est déjà synchrone, un délai artificiel n'apportait rien et cassait les tests qui
// déclenchent "Passer" immédiatement après le rendu).
/** @param {object[]} items - mêmes récompenses que renderBossRewardReveal. Branche les timers de révélation échelonnée (roulement "casino" décélérant pour les dés chiffrés, roue React pour le rareLoot) + le bouton "Passer" qui révèle tout instantanément. */
function wireBossRewardReveal(items) {
  if (!items.length) return;
  const done = new Array(items.length).fill(false);
  let pendingTimers = []; // setTimeout des roues/dés statiques (sans rollValue) + démarrages différés (stagger)
  let cancelRolls = []; // fonctions d'annulation des roulements "casino" en cours (dés avec rollValue)
  function finishIfAllDone() {
    if (!done.every(Boolean)) return;
    const skipBtn = $a('bossSkipBtn'); if (skipBtn) skipBtn.style.display = 'none';
    const closeBtn = $a('bossCloseBtn'); if (closeBtn) closeBtn.style.display = '';
  }
  // roulement "casino" décélérant pour un dé À VALEUR CHIFFRÉE (rollValue défini) -- défile des
  // nombres aléatoires de même ordre de grandeur, intervalle x1.16 à chaque tick (de plus en plus
  // lent), s'arrête PILE sur la vraie valeur (déjà tirée avant l'appel, voir endBossFight) une fois
  // BOSS_ROLL_DURATION_MS écoulé -- ou instantanément si `instant` (bouton Passer).
  function rollDiceValue(i, instant) {
    const it = items[i], resEl = $a('brRevealResult'+i), iconEl = $a('brDiceIcon'+i);
    if (!resEl) return;
    if (instant) {
      resEl.innerHTML = it.rollTemplate(it.rollValue);
      if (iconEl) iconEl.classList.add('settled');
      done[i] = true; finishIfAllDone();
      return;
    }
    const startTime = performance.now();
    let interval = BOSS_ROLL_START_INTERVAL_MS, timer;
    const tick = () => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= BOSS_ROLL_DURATION_MS) {
        resEl.innerHTML = it.rollTemplate(it.rollValue);
        if (iconEl) iconEl.classList.add('settled');
        done[i] = true; finishIfAllDone();
        return;
      }
      const magnitude = Math.max(1, it.rollValue);
      resEl.innerHTML = it.rollTemplate(Math.floor(Math.random()*(magnitude*1.5)));
      interval *= BOSS_ROLL_GROWTH;
      timer = setTimeout(tick, interval);
    };
    tick();
    cancelRolls.push(() => clearTimeout(timer));
  }
  function revealOne(i, { instant } = {}) {
    if (done[i]) return;
    const it = items[i], resEl = $a('brRevealResult'+i); if (!resEl) return;
    if (it.kind === 'dice' && it.rollValue !== undefined) { rollDiceValue(i, instant); return; }
    done[i] = true;
    if (it.kind === 'dice') {
      const iconEl = $a('brDiceIcon'+i); if (iconEl) iconEl.classList.add('settled');
      resEl.innerHTML = it.resultHtml;
    } else {
      // roue React (voir combat/boss-wheel-react.js) : l'issue (it.won) est déjà tirée dans
      // endBossFight, ce composant ne fait QUE choisir/animer l'angle d'atterrissage — jamais
      // l'issue elle-même. `instant` (bouton Passer) est simplement repassé en prop.
      const container = $a('bossWheelReactRoot'+i);
      if (container && typeof mountBossWheelReact === 'function') {
        mountBossWheelReact(container, { rareLoot: it.rareLoot, won: it.won, instant: !!instant });
      }
      resEl.innerHTML = it.won
        ? `<span style="color:${it.rareLoot.color}">${it.rareLoot.icon} ${i18next.t('combat:combat.boss.wheel_obtained')} : ${tr(it.rareLoot.name)} !</span>`
        : i18next.t('combat:combat.boss.wheel_not_this_time', { icon: it.rareLoot.icon, name: tr(it.rareLoot.name) });
    }
    finishIfAllDone();
  }
  // Mouvement réduit (2026-07-22, audit repo P6) : c'est LE gros mouvement du jeu qui ne soit pas
  // du gameplay. La roue fait 5 tours complets sur elle-même et les dés défilent en "casino"
  // décélérant — exactement le déclencheur vestibulaire classique, et purement décoratif.
  //
  // AUCUNE INFORMATION N'EST PERDUE, et c'est ce qui rend ce court-circuit légitime plutôt que
  // mutilant : l'issue est déjà tirée dans endBossFight (voir le commentaire dans revealOne) — la
  // roue ne fait QUE choisir et animer l'angle d'atterrissage, jamais le résultat. Le joueur voit
  // exactement les mêmes récompenses, sans l'attente ni le mouvement. C'est le chemin du bouton
  // "Passer", déjà écrit et déjà testé, pas une deuxième implémentation à maintenir en parallèle.
  //
  // Sortie anticipée sûre : révéler tout met done[] à true partout, donc finishIfAllDone() masque
  // "Passer" et affiche "Fermer" — le bouton qu'on ne câble pas ensuite est déjà caché.
  if (typeof prefersReducedMotion === 'function' && prefersReducedMotion()) {
    items.forEach((_, i) => revealOne(i, { instant: true }));
    return;
  }
  items.forEach((it, i) => {
    const startDelay = i*BOSS_REVEAL_STAGGER_MS;
    if (it.kind === 'dice' && it.rollValue !== undefined) {
      // démarre le roulement APRÈS le délai d'échelonnement -- pas de délai de révélation séparé,
      // rollDiceValue gère elle-même sa propre durée (BOSS_ROLL_DURATION_MS)
      pendingTimers.push(setTimeout(() => revealOne(i), startDelay));
    } else {
      const revealDelay = startDelay + (it.kind==='wheel' ? BOSS_REVEAL_WHEEL_MS : 650);
      pendingTimers.push(setTimeout(() => revealOne(i), revealDelay));
    }
  });
  const skipBtn = $a('bossSkipBtn');
  if (skipBtn) skipBtn.onclick = () => {
    pendingTimers.forEach(t => clearTimeout(t)); pendingTimers = [];
    cancelRolls.forEach(c => c()); cancelRolls = [];
    items.forEach((_,i) => revealOne(i, { instant:true }));
  };
}
// "un bouton quitter s'affiche (retour a zone)" (2026-07-08) -- avant, "Retour" ramenait toujours
// au lobby Boss ; désormais un vrai retour direct au farm, cohérent avec la demande explicite.
/** Ferme l'écran de résultat et retourne directement à la vue farm (jamais au lobby Boss). */
function leaveBossResultToZone() {
  $('bossResult').classList.remove('show');
  currentActivity = 'zone';
  if (!bossState.active) $('bossRoom').classList.remove('open');
  setFarmViewVisible(true);
  renderActivityTabs();
}
/**
 * Termine le combat de boss (victoire ou défaite) : réclame la récompense côté serveur si partagé
 * (boss_claim, protégé contre la double réclamation), applique pénalité de mort × bonus 1er kill de
 * la semaine × multiplicateur de rang, tire le loot chiffré et le rareLoot, puis lance la séquence
 * de révélation (revealItems).
 * @param {boolean} win - vrai si le boss a été vaincu, faux sur une défaite/sortie.
 */
async function endBossFight(win) {
  if (bossState.ended) return;
  bossState.ended = true;
  bossState.active = false;
  cancelAnimationFrame(bossState.raf);
  leaveBossChannel();
  const b = bossState.boss;
  let rewardsHtml = '';
  // "lors de la fin du boss une roulette tourne ou un des se jette pour chaque recompense
  // aléatoire" (2026-07-08) -- déclaré ici (pas dans le bloc if(win) plus bas) car utilisé
  // inconditionnellement à la toute fin de cette fonction (reste vide sur une défaite/sortie).
  let revealItems = [];
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
    // pénalité de mort + bonus 1er kill de la semaine (PAR BOSS) -- calculés une seule fois ici,
    // stackés MULTIPLICATIVEMENT dans le même `mult` que bossRankMultiplier(rank) ci-dessous, pour
    // que tout le loot chiffré (Kzarka ET Vell/générique) passe par le même facteur unique au lieu
    // d'un second chemin de calcul parallèle. La semaine est lue AVANT d'être écrite plus bas.
    const deathMult = bossDeathPenaltyMult(bossState.deathCount);
    const firstKillWeek = bossState.bossId ? bossFirstKillOfWeek(bossState.bossId) : false;
    mult *= deathMult * (firstKillWeek ? BOSS_FIRST_KILL_WEEK_BONUS : 1);
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
        // *= et non = : ne doit pas écraser deathMult/firstKillWeek déjà appliqués au-dessus --
        // tous les facteurs stackent dans le MÊME `mult`, un seul chemin de calcul (voir plus haut).
        if (typeof data === 'number' && data > 0) { rank = data; mult *= bossRankMultiplier(rank); }
        // -1 : déjà réclamé, aucune contribution, ou boss pas encore à 0 PV. L'alerte Discord pour
        // le vrai cas de double réclamation part désormais depuis boss_claim() lui-même, côté
        // serveur, directement sur le salon "cheat" (déplacé le 2026-07-08 : elle partait avant sur
        // le salon général, côté client) — plus fiable, ne peut pas être usurpé
        else alreadyClaimed = true;
      } catch (e) { alreadyClaimed = true; } // en cas de doute (erreur réseau), ne JAMAIS accorder par défaut
    }
    // chaque récompense qui a une part de hasard (silver/matériau/caphras/fragment : quantité
    // aléatoire dans une fourchette -> dé ; bijou/loot rarissime : chance de tout ou rien -> roue
    // déjà existante) alimente `revealItems` (déclaré plus haut) plutôt que du texte statique. Le
    // tirage a lieu MAINTENANT comme avant (addSilver/invAdd non touchés), seule la RÉVÉLATION est
    // différée/animée -- voir renderBossRewardReveal plus bas.
    if (alreadyClaimed) {
      rewardsHtml = `<div class="brRewards admHint">${i18next.t('combat:combat.boss.reward_already_claimed')}</div>`;
    } else {
      // combat SOLO (pas de classement possible, instance perso) : traité comme rang #1, seul
      // participant -- il n'y a personne avec qui "partager" le meilleur lot (2026-07-15)
      if (!bossState.shared) rank = 1;
      let reward;
      // Kzarka (2026-07-16, demande explicite) : récompenses FIXES par rang de contribution
      // (silver + quantités aléatoires de Pierre de Caphras/Fragment de mémoire, voir
      // KZARKA_REWARD_TIERS), remplace pour CE boss précis l'ancien système générique basé sur la
      // zone de progression du joueur ci-dessous (conservé tel quel pour Vell/futurs boss).
      if (bossState.bossId === 'kzarka' && rank) {
        const tier = KZARKA_REWARD_TIERS[Math.min(rank, 3)];
        // mult (rang × pénalité de mort × bonus 1er kill semaine) s'applique aussi aux quantités
        // Caphras/Fragment, pas seulement au silver -- même esprit que le zoneMult du bloc générique
        // ci-dessous, qui multiplie déjà la quantité de matériau (voir plus bas).
        const caphrasQty = Math.max(0, Math.round((tier.caphras[0] + Math.random()*(tier.caphras[1]-tier.caphras[0])) * mult));
        const fragQty = Math.max(0, Math.round((tier.frag[0] + Math.random()*(tier.frag[1]-tier.frag[0])) * mult));
        reward = Math.round(tier.silver * mult);
        addSilver(reward, 'boss', b.name.fr);
        invAdd({ key:'mat_'+CAPHRAS_NAME, name:CAPHRAS_NAME, kind:'material', icon:ICO_MAT_CAPHRAS, color:'#c9a55a', qty:caphrasQty, stackable:true, weight:0.1, val:120 });
        invAdd({ name:'Fragment de mémoire', kind:'craft', icon:'✦', color:'#b48ce8', key:'craft_Fragment de mémoire', qty:fragQty, stackable:true, weight:0.2, val:0 });
        rewardsHtml = `<div class="brRewards">${i18next.t('combat:combat.boss.contribution_rank')} : <b>#${rank}</b></div>` + bossMultBadgesHtml(bossState.deathCount, firstKillWeek);
        revealItems.push(
          { kind:'dice', icon:'🪙', color:'#e8c96a', label:i18next.t('combat:combat.boss.silver_label'), rollValue:reward, rollTemplate:n=>`+${fmt(n)} 🪙` },
          { kind:'dice', icon:ICO_MAT_CAPHRAS, color:'#c9a55a', label:tr(CAPHRAS_NAME), rollValue:caphrasQty, rollTemplate:n=>`+${n} × ${tr(CAPHRAS_NAME)}` },
          { kind:'dice', icon:'✦', color:'#b48ce8', label:tr('Fragment de mémoire'), rollValue:fragQty, rollTemplate:n=>`+${n} × ${tr('Fragment de mémoire')}` },
        );
      } else {
        // Le loot des World Boss dépend de la MEILLEURE zone découverte, mais seulement si le joueur
        // n'est pas mort depuis au moins 3 minutes ("certifié sans mort") — demande explicite du
        // 2026-07-08. Sans ce certificat, la récompense reste la valeur de base (aucun bonus de zone).
        const deathFreeMs = Date.now() - (S.lastDeathAt || 0);
        const deathFreeOk = deathFreeMs >= 3*60*1000;
        const zoneMult = deathFreeOk ? 1 + (S.maxZoneIdx/(ZONES.length-1))*1.5 : 1;
        reward = Math.round(b.reward * mult * zoneMult);
        addSilver(reward, 'boss', b.name.fr);
        // récompenses par zone de progression (2026-07-15, demande explicite : "les recompense sont
        // en fonction de ta meilleure zone difficile... + 1 bijou de la prochaine zone dangereuse si
        // tu es premier...") -- remplace l'ancien matériau fixe du roster (matKey/matQty) par une
        // pierre d'optimisation de la meilleure zone difficile (garantie pour tous) + bijoux bonus
        // selon le rang, voir bossZoneMaterialItem/bossZoneJackpotItem/bestDifficileZoneIdx ci-dessus.
        const difficileZi = bestDifficileZoneIdx(), dangereuseZi = nextDangereuseZoneIdx();
        revealItems.push({ kind:'dice', icon:'🪙', color:'#e8c96a', label:i18next.t('combat:combat.boss.silver_label'), rollValue:reward, rollTemplate:n=>`+${fmt(n)} 🪙` });
        if (difficileZi != null) {
          const qty = Math.max(1, Math.round((3 + Math.random()*5) * mult * zoneMult));
          const matItem = bossZoneMaterialItem(difficileZi, qty);
          invAdd(matItem);
          revealItems.push({ kind:'dice', icon:matItem.icon, color:matItem.color, label:tr(matItem.name),
            rollValue:qty, rollTemplate:n=>`+${n} × ${tr(matItem.name)} <span class="admHint">(${tr(ZONES[difficileZi].name)})</span>` });
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
            revealItems.push({ kind:'dice', icon:jItem.icon, color:jItem.color, label:tr(jItem.name),
              resultHtml:`+💎 ${tr(jItem.name)} <span class="admHint">(${tr(ZONES[zi].name)})</span>` });
            logToDiscord('💎 Bijou de World Boss', `**${myPseudo||'Joueur'}** obtient ${jItem.name} (rang #${rank}) sur ${b.name.fr}`, 0xb48ce8);
          }
        }
        const rankHtml = rank ? `<div class="brRewards">${i18next.t('combat:combat.boss.contribution_rank')} : <b>#${rank}</b></div>` : '';
        const zoneHtml = `<div class="brRewards admHint">${deathFreeOk
          ? i18next.t('combat:combat.boss.zone_bonus_active', { zoneName: tr(ZONES[S.maxZoneIdx].name), mult: zoneMult.toFixed(2) })
          : i18next.t('combat:combat.boss.zone_bonus_inactive')}</div>`;
        rewardsHtml = rankHtml + zoneHtml + bossMultBadgesHtml(bossState.deathCount, firstKillWeek);
      }
      pushNotif('🏆', i18next.t('combat:combat.boss.boss_defeated_notif'), b.name[LANG]+' — +'+fmt(reward)+' 🪙', 'success');
      logToDiscord('🏆 Boss vaincu', `**${myPseudo||'Joueur'}** a vaincu ${b.name.fr}${rank?' (rang #'+rank+')':''} — +${fmt(reward)} 🪙`, 0xe8b84a);
      if (bossState.bossId) markBossDefeated(bossState.bossId); // Compendium (2026-07-08)
      // "premier kill de la semaine PAR BOSS" : écrit APRÈS avoir lu firstKillWeek plus haut (sinon
      // le bonus ne se déclencherait jamais) -- seulement une fois la victoire confirmée (pas déjà
      // réclamée), sinon rentrer dans l'arène d'un boss déjà réclamé consommerait quand même le bonus.
      if (bossState.bossId) S.bossLastKillWeek[bossState.bossId] = getISOWeekString(new Date());
      // roue de récompense rare (Coeur de Vell, etc.) : le tirage a lieu MAINTENANT, la roue ne fait
      // que révéler ce qui a déjà été décidé -- intégrée à la même séquence que les dés ci-dessus.
      // Pity (voir BOSS_PITY_THRESHOLD) : ne s'applique qu'aux boss qui ont un rareLoot -- au palier,
      // le gain est FORCÉ (won=true) sans tirage, puis le compteur repart de 0 comme sur un vrai gain.
      if (b.rareLoot) {
        const bossId = bossState.bossId;
        const pityCount = S.bossPity[bossId] || 0;
        // 4+ morts (deathMult===0, voir BOSS_DEATH_PENALTY) : le loot rarissime est exclu, comme le
        // reste du loot chiffré -- mais le pity NE PROGRESSE PAS sur ces tentatives (deathMult===0
        // veut dire "kill chèrement acquis, sans le bonus", pas "kill qui ne compte pas du tout" --
        // sinon un joueur enchaînant des kills à 4+ morts n'atteindrait jamais son pity légitime).
        const rareLootExcluded = deathMult === 0;
        const forcedByPity = !rareLootExcluded && pityCount >= BOSS_PITY_THRESHOLD;
        const won = !rareLootExcluded && (forcedByPity || Math.random() < b.rareLoot.ch);
        if (won) {
          invAdd({ name:b.rareLoot.name, kind:'craft', icon:b.rareLoot.icon, color:b.rareLoot.color, key:'craft_'+b.rareLoot.name, qty:1, stackable:true, weight:0.3, val:0 });
          trackLoot(b.rareLoot.name);
          S.bossPity[bossId] = 0;
          logToDiscord('❤️‍🔥 Loot rarissime', `**${myPseudo||'Joueur'}** obtient ${b.rareLoot.name} sur ${b.name.fr}${forcedByPity?' (pity garanti)':''} ! (${Math.round(b.rareLoot.ch*100)}% de chance)`, 0x5ec9e8);
        } else if (!rareLootExcluded) {
          S.bossPity[bossId] = pityCount + 1;
        }
        revealItems.push({ kind:'wheel', rareLoot:b.rareLoot, won, pityCount:S.bossPity[bossId], pityThreshold:BOSS_PITY_THRESHOLD });
      }
      refreshStatsOnly(); hud();
    }
  }
  $('bossResult').innerHTML =
    `<div class="brTitle ${win?'win':''}">${win?i18next.t('combat:combat.boss.victory_title'):i18next.t('combat:combat.boss.fight_left_title')}</div>` +
    rewardsHtml + renderBossRewardReveal(revealItems);
  $('bossResult').classList.add('show');
  wireBossRewardReveal(revealItems);
  // branché directement (pas de délégation document-level) : même convention que le reste du
  // fichier -- le bouton existe déjà dans le DOM à ce stade (juste masqué tant que la révélation
  // n'est pas terminée, voir renderBossRewardReveal), pas besoin de le re-brancher plus tard.
  $a('bossCloseBtn').onclick = leaveBossResultToZone;
}
// ---- victoire boss PARTAGÉ : décidée par le PV SERVEUR, jamais la prédiction locale (2026-07-12,
// bug corrigé : fausse "récompense déjà réclamée") ----
// Le serveur (boss_contribute, supabase/schema_snapshot_functions.sql) plafonne CHAQUE appel à 5%
// du max_hp (`p_damage := least(p_damage, max_hp*0.05)`), qu'il y ait un ou plusieurs joueurs -- un
// joueur seul à fort DPS ne peut donc jamais faire tomber le PV serveur plus vite que ce plafond
// (~5%/1.2s, le rythme d'envoi de bossLoop), même si SA prédiction locale (bossState.hp, décrémentée
// chaque frame au DPS RÉEL, sans ce plafond) atteint 0 bien avant. boss_claim() n'accorde la
// récompense QUE si le PV serveur est <=0 -- déclarer victoire depuis la prédiction locale (ancien
// code) menait donc systématiquement un joueur à fort DPS vers un faux "déjà réclamée" (boss_claim
// renvoie -1 tant que le PV serveur reste >0). Plutôt que de reproduire ce plafond de 5%/appel côté
// client (couplage fragile à un détail d'implémentation serveur qui peut changer), on attend
// simplement la confirmation SERVEUR avant de déclarer la victoire -- plus simple et plus robuste.
/**
 * Pure/testable : décide si le combat doit se terminer en victoire.
 * @param {boolean} shared - bossState.shared.
 * @param {number} localHp - bossState.hp (prédiction locale, décrémentée chaque frame).
 * @param {boolean} serverConfirmedDead - bossState.serverConfirmedDead (voir applyBossContributeResponse).
 * @returns {boolean} vrai si endBossFight(true) doit être appelé maintenant.
 */
function bossShouldDeclareVictory(shared, localHp, serverConfirmedDead) {
  return shared ? !!serverConfirmedDead : localHp <= 0;
}
/**
 * Applique la réponse AUTORITAIRE de boss_contribute à un état de boss (bossState en vrai jeu, un
 * mock dans les tests) -- seule source qui doit faire passer serverConfirmedDead à true. Pure à
 * l'exception de la mutation de `state` (2e paramètre), aucun accès réseau/DOM ici.
 * @param {{hp:number, max_hp:number}[]|null|undefined} data - `data` de la réponse RPC boss_contribute.
 * @param {{hp:number, maxHp:number, serverConfirmedDead:boolean}} state - état à mettre à jour.
 */
function applyBossContributeResponse(data, state) {
  if (!data || !data.length) return;
  state.hp = Number(data[0].hp);
  state.maxHp = Number(data[0].max_hp) || state.maxHp;
  if (state.hp <= 0) state.serverConfirmedDead = true;
}
/**
 * Boucle de rendu/simulation du combat de boss (requestAnimationFrame) : dégâts du joueur au fil
 * du temps (playerBossDps), timers d'AoE et blocage, PV du boss (partagés ou solo), position des
 * autres joueurs (Presence), fin de combat (victoire/temps écoulé) qui déclenche endBossFight.
 * @param {number} now - timestamp performance.now() de la frame courante.
 */
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
        if (error) return;
        // état AUTORITAIRE renvoyé par le serveur (inclut les dégâts de tous les autres joueurs) --
        // seule source qui peut faire passer serverConfirmedDead à true, voir bossShouldDeclareVictory.
        applyBossContributeResponse(data, bossState);
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
      bs.floatMsgs.push({txt: isVell ? i18next.t('combat:combat.boss.dived_msg') : i18next.t('combat:combat.boss.blocked_msg'), life:1, color:'#8cc8ff'});
    } else {
      bs.playerHp -= bs.playerHpMax*0.30; bs.hurtFlash = 0.6; bs.shakeT = 20;
      bs.floatMsgs.push({txt: isVell ? i18next.t('combat:combat.boss.wave_msg') : 'AoE !', life:1, color:'#e05050'});
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
  // compte une "mort" (voir bossDeathPenaltyMult) AVANT le clamp anti-wipe ci-dessous -- deathFlag
  // évite de recompter chaque frame tant que le joueur reste à 0 PV, remis à false dès qu'il repasse
  // au-dessus du seuil (une potion auto ou la fin de l'AoE peut le faire remonter)
  if (bossState.playerHp <= 0) {
    if (!bossState.deathFlag) { bossState.deathFlag = true; bossState.deathCount++; }
  } else bossState.deathFlag = false;
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
  if (bossShouldDeclareVictory(bossState.shared, bossState.hp, bossState.serverConfirmedDead)) { endBossFight(true); return; }
  if (bossState.shared && Date.now() > bossState.expiresAt) { endBossFight(false); return; }
  bossState.raf = requestAnimationFrame(bossLoop);
}
// Le rendu canvas de la salle de boss (bossProj, drawStonePillar, drawWarlord, drawVell,
// drawBossCreature, drawVellBoat, drawBossRoom...) est desormais dans combat/boss-render.js
// (extrait le 2026-07-08, reorganisation par dossiers) -- charge APRES ce fichier, voir index.html.