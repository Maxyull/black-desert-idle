// ==================== MINI BOSS — logique + wiring lobby/arène ====================
// DOIT charger APRÈS combat/miniboss-data.js (constantes) et combat/boss.js (playerBossDps,
// _skillDpsSum, setFarmViewVisible, renderActivityTabs, currentActivity, ACTIVITY_TABS) — voir
// index.dev.html pour le commentaire d'ordre exact.
//
// ---- Compromis de scope assumé (CLAUDE.md §24, migration Supabase NON appliquée en V1) ----
// Les RPC serveur (miniboss_start/miniboss_join/miniboss_contribute/miniboss_claim/...) sont
// appelées de façon opportuniste (try/catch) pour être prêtes le jour où la migration
// (supabase/migrations/*_miniboss_sessions.sql) sera appliquée, mais le jeu ne DÉPEND d'aucune
// d'elles pour fonctionner : tant qu'elles échouent (table/RPC absente), tout le gameplay tourne
// en mode dégradé "local déterministe" :
//  - le groupe se forme via Supabase Realtime PRESENCE (`miniboss_lobby`, aucune table requise) —
//    chaque membre diffuse {pseudo, gearPct, parchemin, role, groupId, status}
//  - le DPS de CHAQUE participant est estimé depuis son gearPct% SEUL (gearPct/100 × plafond de
//    référence × _skillDpsSum, boss.js) plutôt que rapporté tick par tick — un seul boss/classe
//    existant dans ce jeu (Sorcier) rend cette estimation fiable (voir minibossEstimatedDps)
//  - la fin de combat est déterministe pour tout le groupe (mêmes PV/DPS cumulé connus par tous
//    via la présence), pas un pool de PV RÉELLEMENT autoritaire côté serveur comme boss_contribute
// Solo (le cas garanti à 100%, aucune dépendance réseau) fonctionne entièrement sans Supabase.

// ---------------- craft (Velia) ----------------
/** @returns {boolean} vrai si craft effectué (retire 5 Livres interdits, ajoute 1 Parchemin de Mini Boss), false si ingrédients insuffisants ou sac plein. Fonction DÉDIÉE (ne réutilise PAS craftTreasurePiece, voir miniboss-data.js). */
function craftMiniBossParchemin() {
  const r = MINIBOSS_PARCHEMIN_RECIPE;
  if (invQtyByKey(r.needKey) < r.needQty) return false;
  if (!invHasRoomFor(r.giveKey)) { floatTxt(P.x,P.y,90,i18next.t('progression:progression.treasure_craft.bag_full'),{hurt:true}); return false; }
  invRemoveAt(invSlotByKey(r.needKey), r.needQty);
  invAdd({ name:r.giveName, kind:'craft', icon:MINIBOSS_PARCHEMIN.icon, color:MINIBOSS_PARCHEMIN.color, key:r.giveKey, qty:1, stackable:true, weight:0.05, val:0, ap:0, dp:0, hp:0, dodge:0 });
  trackLoot(r.giveName);
  floatTxt(P.x,P.y,90,'📜 '+r.giveName,{gold:true});
  logToDiscord('🔧 Craft', `**${myPseudo||'Joueur'}** combine ${r.needQty} Livres interdits en 1 ${r.giveName}`, 0xc9a55a);
  renderInventory();
  return true;
}
/** @returns {number} quantité de Parchemins de Mini Boss en sac. */
function minibossParcheminQty() { return invQtyByKey(MINIBOSS_PARCHEMIN.key); }
/** @returns {number} quantité de Livres interdits en sac. */
function minibossForbiddenBookQty() { return invQtyByKey(MINIBOSS_FORBIDDEN_BOOK.key); }
/** @returns {number} AP effective du joueur, robuste si apEff() n'est pas encore défini (ordre de test). */
function minibossMyApEff() { return typeof apEff === 'function' ? apEff() : 0; }
/** @returns {number} gear% du joueur courant (voir minibossGearPct, miniboss-data.js). */
function minibossMyGearPct() { return minibossGearPct(minibossMyApEff()); }
/** @param {number} gearPct - 0-100. @returns {number} DPS estimé pour ce gear% (voir compromis de scope en tête de fichier) — un seul boss/classe existant (Sorcier) rend cette estimation fiable. */
function minibossEstimatedDps(gearPct) {
  if (!_skillDpsSum) playerBossDps(); // force le calcul paresseux de _skillDpsSum (boss.js)
  return Math.max(1, (Math.max(0,gearPct)/100) * minibossGearRefAp() * _skillDpsSum);
}
/** @param {number} sec - durée en secondes. @returns {string} durée lisible ("≈42s"/"≈5min30"/"≈2h15") — dédié aux estimations de temps de combat, contrairement à fmtBossCountdown (boss.js, HH:MM:SS, pensé pour un décompte avant spawn). */
function minibossFmtDuration(sec) {
  sec = Math.max(0, Math.round(sec));
  if (sec < 60) return `≈${sec}s`;
  if (sec < 3600) { const m = Math.floor(sec/60), s = sec%60; return `≈${m}min${s ? String(s).padStart(2,'0') : ''}`; }
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60);
  return `≈${h}h${String(m).padStart(2,'0')}`;
}

// ---------------- état du groupe (Supabase Realtime Presence, aucune table requise) ----------------
const MINIBOSS_LOBBY_TOPIC = 'miniboss_lobby';
let minibossLobbyChannel = null;
let minibossLobbySubscribed = false;
// groupId courant : uid de l'invocateur qui a formé le groupe (null = pas encore dans un groupe,
// solo par défaut). Rejoindre = adopter le groupId de cet invocateur.
let minibossGroupId = null;
let minibossMyRole = 'summoner'; // 'summoner' | 'joiner' -- 'summoner' tant que solo (on invoquera soi-même)
let minibossRunLength = MINIBOSS_RUN_CHIPS[0];
let minibossRecruitLog = []; // messages du chat de recrutement (éphémère, pas persisté)
let minibossGroupLog = []; // messages du chat de groupe (éphémère)
let minibossPendingJoinReq = null; // { fromUid, fromPseudo } — demande reçue, en attente de résolution (groupe en combat)
let minibossPendingInvite = null; // { fromPseudo, groupId, groupSize } — invitation reçue via le chat de recrutement, en attente de résolution

/** Compteurs de réputation locaux (voir minibossReputationScore, miniboss-data.js). @returns {object} S.minibossRep, jamais null. */
function minibossRepCounters() { S.minibossRep = S.minibossRep || { groupsCreated:0, runsJoined:0, soloQuits:0, disconnects:0, votes:0, runsClean:0, runsIncident:0 }; return S.minibossRep; }

/** Diffuse mon état courant (pseudo/gear%/Parchemins/rôle/groupe/statut) sur le canal de présence Mini Boss — no-op silencieux si offline/déconnecté. */
function minibossTrackPresence(status) {
  if (!minibossLobbyChannel || !minibossLobbySubscribed || !currentUser) return;
  try {
    minibossLobbyChannel.track({
      pseudo: myPseudo || '?', gearPct: minibossMyGearPct(), parchemin: minibossParcheminQty(),
      role: minibossMyRole, groupId: minibossGroupId || currentUser.id, status: status || 'forming',
      runLength: minibossRunLength,
    });
  } catch (e) {}
}
/** Rejoint (ou recrée) le canal de présence/diffusion Mini Boss — mêmes conventions que joinBossChannel (boss.js), aucune table Supabase requise (Presence + Broadcast purs). */
function joinMinibossLobbyChannel() {
  if (!sb || !currentUser || minibossLobbyChannel) return;
  const ch = sb.channel(MINIBOSS_LOBBY_TOPIC, { config: { presence: { key: currentUser.id }, broadcast:{ self:false } } });
  minibossLobbyChannel = ch;
  ch.on('presence', { event:'sync' }, () => { if (isMinibossLobbyOpen()) refreshMiniBossLobbyGroupParts(); });
  ch.on('broadcast', { event:'chat' }, ({ payload }) => {
    if (!payload) return;
    if (payload.groupId) { if (payload.groupId === (minibossGroupId||currentUser.id)) { minibossGroupLog.push(payload); renderMinibossGroupChatLog(); } }
    else { minibossRecruitLog.push(payload); renderMinibossRecruitChatLog(); }
  });
  ch.on('broadcast', { event:'invite' }, ({ payload }) => {
    if (!payload || payload.toPseudo !== (myPseudo||'?')) return;
    minibossPendingInvite = payload;
    minibossShowInviteBanner(payload);
  });
  ch.on('broadcast', { event:'join_request' }, ({ payload }) => {
    if (!payload || payload.groupId !== (minibossGroupId||currentUser.id)) return;
    if (minibossMyRole !== 'summoner') return; // seul l'invocateur reçoit le pop-up (les autres attendent sa décision)
    minibossPendingJoinReq = payload;
    minibossShowJoinRequestPopup(payload);
  });
  ch.on('broadcast', { event:'join_resolved' }, ({ payload }) => {
    if (!payload || payload.groupId !== (minibossGroupId||currentUser.id)) return;
    if (payload.accepted) {
      // groupe EN COMBAT accepte un nouveau membre : annule le combat en cours (aucun loot perdu,
      // aucun Parchemin déjà engagé reperdu) et repasse en formation -- voir plan §0sexies.
      if (minibossState.active) minibossCancelFightForNewMember();
      if (payload.forUid === currentUser.id) { minibossGroupId = payload.groupId; minibossMyRole = 'joiner'; minibossTrackPresence('forming'); }
      if (isMinibossLobbyOpen()) { $('minibossLobbyBody').innerHTML = renderMiniBossLobbyHtml(); wireMiniBossLobby(); }
    }
  });
  ch.on('broadcast', { event:'combat_start' }, ({ payload }) => {
    if (!payload || payload.groupId !== (minibossGroupId||currentUser.id) || minibossMyRole === 'summoner') return;
    startMiniBossFightLocal(payload);
  });
  ch.on('broadcast', { event:'vote_stop' }, ({ payload }) => {
    if (!payload || !minibossState.active || payload.groupId !== (minibossGroupId||currentUser.id) || !minibossState.votes) return;
    minibossState.votes.add(payload.pseudo);
    renderMinibossVoteChips();
  });
  ch.subscribe(status => { minibossLobbySubscribed = (status === 'SUBSCRIBED'); if (minibossLobbySubscribed) minibossTrackPresence('forming'); });
}
/** Quitte le canal de présence Mini Boss (retour solo). */
function leaveMinibossLobbyChannel() {
  if (minibossLobbyChannel) { try { sb.removeChannel(minibossLobbyChannel); } catch (e) {} }
  minibossLobbyChannel = null; minibossLobbySubscribed = false;
}
/** @returns {boolean} vrai si le lobby Mini Boss est actuellement affiché à l'écran. */
function isMinibossLobbyOpen() {
  const room = $a('minibossRoom');
  return !!(room && room.classList.contains('open') && room.classList.contains('lobby'));
}
/** @returns {object[]} entrées de présence brutes du canal Mini Boss ({pseudo,gearPct,parchemin,role,groupId,status,runLength}), tableau vide si hors ligne. */
function minibossPresenceEntries() {
  if (!minibossLobbyChannel || !minibossLobbySubscribed) return [];
  try {
    const state = minibossLobbyChannel.presenceState();
    return Object.values(state).map(arr => arr && arr[0]).filter(Boolean);
  } catch (e) { return []; }
}
/** @returns {object[]} membres de MON groupe courant (moi inclus), triés invocateur d'abord. */
function minibossMyParty() {
  const myGroupId = minibossGroupId || (currentUser && currentUser.id) || 'solo';
  const me = { pseudo: myPseudo||i18next.t('combat:combat.miniboss.you_label'), gearPct: minibossMyGearPct(), parchemin: minibossParcheminQty(), role: minibossMyRole, groupId: myGroupId, mine:true };
  const others = minibossPresenceEntries().filter(e => e.groupId === myGroupId && e.pseudo !== me.pseudo);
  const party = [me, ...others];
  party.sort((a,b) => (a.role==='summoner'?0:1) - (b.role==='summoner'?0:1));
  return party.slice(0, MINIBOSS_MAX_GROUP_SIZE);
}
/** @returns {object[]} un groupe par groupId distinct (annuaire "Groupes") — status 'fighting' si au moins un membre l'annonce. */
function minibossAllGroups() {
  const entries = minibossPresenceEntries();
  const byGroup = new Map();
  entries.forEach(e => {
    if (!byGroup.has(e.groupId)) byGroup.set(e.groupId, []);
    byGroup.get(e.groupId).push(e);
  });
  return [...byGroup.entries()].map(([groupId, members]) => {
    const summoner = members.find(m => m.role === 'summoner') || members[0];
    const fighting = members.some(m => m.status === 'fighting');
    const avgGear = Math.round(members.reduce((a,m)=>a+(m.gearPct||0),0) / members.length);
    return { groupId, members, summoner, fighting, size: members.length, avgGear };
  }).filter(g => g.size < MINIBOSS_MAX_GROUP_SIZE || g.fighting);
}

// ---------------- lobby : rendu + wiring ----------------
/** Ouvre la page Mini Boss (lobby) — miroir de openBossLobby() (boss.js). */
function openMiniBossLobby() {
  $('minibossRoom').classList.remove('fight'); $('minibossRoom').classList.add('lobby','open');
  joinMinibossLobbyChannel();
  $('minibossLobbyBody').innerHTML = renderMiniBossLobbyHtml();
  wireMiniBossLobby();
}
/** @param {number} n - taille de groupe. @returns {string} échelle du bonus de groupe (paliers 1..5, palier courant en évidence) — porte fidèlement la maquette : titre + multiplicateur courant en évidence, et par palier le %, les PV du boss et le temps de combat idéal (gear 100%), pas seulement le multiplicateur brut. */
function minibossBonusLadderHtml(n) {
  const idealDpsPerPlayer = minibossEstimatedDps(100);
  const steps = [1,2,3,4,5].map(i => {
    const cls = ['minibossBonusStep', i<=n?'reached':'', i===n?'current':'', i===5?'jackpot':''].filter(Boolean).join(' ');
    const pct = Math.round((MINIBOSS_GROUP_BONUS[i]-1)*100);
    const stepHp = minibossMaxHp(i);
    const stepTime = stepHp / Math.max(1, i*idealDpsPerPlayer);
    return `<div class="${cls}">` +
      `<span class="minibossBonusStepN">${i}</span>` +
      `<span class="minibossBonusStepMult">×${MINIBOSS_GROUP_BONUS[i]}</span>` +
      `<span class="minibossBonusStepPct">${pct>=0?'+':''}${pct}%</span>` +
      `<span class="minibossBonusStepHp">${fmt(stepHp)} PV</span>` +
      `<span class="minibossBonusStepTime">${minibossFmtDuration(stepTime)}</span>` +
      `</div>`;
  }).join('');
  return `<div class="minibossBonusLadder">` +
    `<div class="minibossBonusLadderHead"><span class="minibossBonusLadderTitle">✨ ${i18next.t('combat:combat.miniboss.bonus_current')}</span><span class="minibossBonusLadderCurrent">×${MINIBOSS_GROUP_BONUS[Math.max(1,Math.min(5,n))]}</span></div>` +
    `<div class="minibossBonusLadderTrack">${steps}</div></div>`;
}
/** @returns {string} HTML complet du lobby Mini Boss (carte Parchemin/Invoquer, craft, état du groupe, chat à onglets). */
function renderMiniBossLobbyHtml() {
  const parchQty = minibossParcheminQty(), bookQty = minibossForbiddenBookQty();
  const party = minibossMyParty();
  const n = Math.max(1, party.length);
  const gearPcts = party.map(p => p.gearPct||0);
  const avgGear = Math.round(gearPcts.reduce((a,b)=>a+b,0) / n);
  // maillon faible identifié explicitement (mockup, "Mise à jour 22/23") -- seulement pertinent
  // à plusieurs, et seulement si l'écart au reste du groupe est notable (>10 points), pas pour un
  // groupe homogène où pointer du doigt le "pire" serait juste du bruit.
  const weakest = n > 1 ? party.reduce((min, p) => (p.gearPct||0) < (min.gearPct||0) ? p : min, party[0]) : null;
  const weakestHint = (weakest && (avgGear - (weakest.gearPct||0)) > 10)
    ? i18next.t('combat:combat.miniboss.weakest_link_hint', { pseudo: weakest.mine ? i18next.t('combat:combat.miniboss.you_label') : escapeHtml(weakest.pseudo), pct: weakest.gearPct||0 })
    : '';
  const stocks = party.map(p => p.mine ? parchQty : (p.parchemin||0));
  const maxRun = minibossMaxRunLength(stocks) || 0;
  if (minibossRunLength > Math.max(1, ...stocks, MINIBOSS_RUN_CHIPS[0])) minibossRunLength = MINIBOSS_RUN_CHIPS[0];
  const maxHp = minibossMaxHp(n);
  const idealDps = n * minibossEstimatedDps(100);
  const realDps = party.reduce((a,p)=>a+minibossEstimatedDps(p.gearPct||0), 0) || 1;
  const idealTimePerFight = maxHp / Math.max(1, idealDps);
  const realTimePerFight = maxHp / Math.max(1, realDps);
  const summonBtnDisabled = parchQty <= 0;
  const chipsHtml = MINIBOSS_RUN_CHIPS.map(c => `<button class="minibossRunChip${c===minibossRunLength?' on':''}" data-fights="${c}">${c}</button>`).join('');
  const sliderMax = Math.max(1, ...stocks, MINIBOSS_RUN_CHIPS[0]);
  const partyRows = party.map(p => {
    const have = p.mine ? parchQty : (p.parchemin||0);
    const ok = have >= minibossRunLength;
    const gearCls = p.gearPct>=85?'good':p.gearPct>=60?'ok':'low';
    return `<div class="minibossPartyRow${p.mine?' mine':''}">` +
      `<span class="minibossPartyName">${p.role==='summoner'?'👑 ':''}${escapeHtml(p.pseudo)}</span>` +
      `<span class="minibossPartyGear ${gearCls}">⚔️${p.gearPct||0}%</span>` +
      `<span class="minibossPartyParch">📜 ${have}</span>` +
      `<span class="minibossPartyReady ${ok?'ready':''}">${ok?'✅':'❌'} ${have}/${minibossRunLength}</span>` +
      `</div>`;
  }).join('');
  const nextTierHint = n >= MINIBOSS_MAX_GROUP_SIZE
    ? i18next.t('combat:combat.miniboss.ladder_maxed')
    : i18next.t('combat:combat.miniboss.ladder_next_tier', { need: MINIBOSS_MAX_GROUP_SIZE-n, pct: Math.round((MINIBOSS_GROUP_BONUS[n+1]-1)*100) });
  return `<div class="card minibossLobbyBonusCard">
      ${minibossBonusLadderHtml(n)}
      <div class="minibossBonusTagline">${i18next.t('combat:combat.miniboss.ladder_tagline')}</div>
      <div class="minibossBonusHint">${nextTierHint}</div>
    </div>
    <div class="minibossLobbyGrid">
    <div class="minibossLobbyMain">
    <div class="card minibossSummonCard">
      <div class="minibossSummonIcon">👻</div>
      <div class="minibossSummonName">${i18next.t('combat:combat.miniboss.creature_name')}</div>
      <div class="minibossSummonLore">${i18next.t('combat:combat.miniboss.creature_lore')}</div>
      <div class="minibossParcheminRow">
        <span class="minibossParcheminIcon">${MINIBOSS_PARCHEMIN.icon}</span>
        <div><div class="minibossParcheminQty">${parchQty} <small>${i18next.t('combat:combat.miniboss.parchemin_in_bag')}</small></div>
        <div class="minibossTradeTag">🔒 ${i18next.t('combat:combat.miniboss.not_tradeable')}</div></div>
      </div>
      <button class="minibossSummonBtn" id="minibossSummonBtn" ${summonBtnDisabled?'disabled':''}>✦ ${i18next.t('combat:combat.miniboss.summon_button')}</button>
    </div>
    <div class="card minibossCraftCard">
      <div class="minibossCraftRow">
        <span class="minibossCraftIcon">${MINIBOSS_FORBIDDEN_BOOK.icon}</span>
        <div class="minibossCraftBody">
          <div class="minibossCraftLbl">${i18next.t('combat:combat.miniboss.craft_label')} <span class="minibossTradeTagSellable">🏪 ${i18next.t('combat:combat.miniboss.book_sellable')}</span></div>
          <div class="minibossCraftBar"><div class="minibossCraftBarFill" style="width:${Math.min(100, bookQty/MINIBOSS_PARCHEMIN_RECIPE.needQty*100)}%"></div></div>
          <div class="minibossCraftCount">${bookQty} / ${MINIBOSS_PARCHEMIN_RECIPE.needQty}</div>
        </div>
        <button class="minibossCraftBtn${bookQty>=MINIBOSS_PARCHEMIN_RECIPE.needQty?' ready':''}" id="minibossCraftBtn" ${bookQty>=MINIBOSS_PARCHEMIN_RECIPE.needQty?'':'disabled'}>${i18next.t('combat:combat.miniboss.craft_button')}</button>
      </div>
    </div>
    <div class="card minibossGroupCard">
      <h3>${i18next.t('combat:combat.miniboss.group_state_title')} (${n}/${MINIBOSS_MAX_GROUP_SIZE})
        <span class="minibossRulesInfo"><span class="minibossRulesIcon">?</span>
          <div class="minibossRulesCard">
            <div class="minibossRule">${i18next.t('combat:combat.miniboss.rule_solo_leave')}</div>
            <div class="minibossRule">${i18next.t('combat:combat.miniboss.rule_disconnect')}</div>
            <div class="minibossRule">${i18next.t('combat:combat.miniboss.rule_vote')}</div>
          </div>
        </span>
      </h3>
      <div class="minibossRunLengthRow">
        <span>${i18next.t('combat:combat.miniboss.fights_to_chain')}</span>
        <div class="minibossRunChips">${chipsHtml}</div>
      </div>
      <div class="minibossRunCustom">
        <input type="range" id="minibossRunSlider" min="1" max="${sliderMax}" step="1" value="${Math.min(minibossRunLength, sliderMax)}">
        <span id="minibossRunSliderVal">${minibossRunLength}</span>
        <button class="minibossMaxBtn" id="minibossMaxBtn">🔺 MAX</button>
      </div>
      <div class="minibossGroupPreview">
        <div class="minibossGbpRow"><span>${i18next.t('combat:combat.miniboss.boss_hp_for_group')}</span><b>${fmt(maxHp)}</b></div>
        <div class="minibossGbpRow"><span>${i18next.t('combat:combat.miniboss.time_per_fight_ideal')}</span><b class="ideal">${minibossFmtDuration(idealTimePerFight)}</b></div>
        <div class="minibossGbpRow"><span>${i18next.t('combat:combat.miniboss.time_per_fight_real', { pct: avgGear })}</span><b class="real">${minibossFmtDuration(realTimePerFight)}</b></div>
        <div class="minibossGbpRow"><span>${i18next.t('combat:combat.miniboss.parchemin_required', { n: minibossRunLength })}</span><b>${minibossRunLength}</b></div>
        <div class="minibossGbpRow"><span>${i18next.t('combat:combat.miniboss.total_time_estimate')}</span><b class="real">${minibossFmtDuration(realTimePerFight*minibossRunLength)}</b></div>
        ${weakestHint ? `<div class="minibossGbpHint">${weakestHint}</div>` : ''}
        ${realTimePerFight > 600 ? `<div class="minibossGbpWarn">${i18next.t('combat:combat.miniboss.gear_too_low_warning')}</div>` : ''}
      </div>
      <div class="minibossPartyList">${partyRows}</div>
      <button class="minibossReadyBtn" id="minibossSummonBtn2" ${summonBtnDisabled?'disabled':''}>✅ ${i18next.t('combat:combat.miniboss.engage_button', { n: minibossRunLength })}</button>
      <div class="minibossMaxHint">${maxRun>0?i18next.t('combat:combat.miniboss.max_hint', { n: maxRun }):''}</div>
    </div>
    </div>
    <div class="minibossLobbySide">
    <div class="card minibossChatCard">
      <div class="minibossChatTabs">
        <button class="minibossChatTab on" data-chat="recruit">💬 ${i18next.t('combat:combat.miniboss.chat_recruit')}</button>
        <button class="minibossChatTab" data-chat="groups">👥 ${i18next.t('combat:combat.miniboss.chat_groups')}</button>
        <button class="minibossChatTab" data-chat="group">🔒 ${i18next.t('combat:combat.miniboss.chat_group')} <span class="minibossChatCount">${n}/${MINIBOSS_MAX_GROUP_SIZE}</span></button>
      </div>
      <div class="minibossChatPane on" id="minibossChatPane-recruit">
        <div class="minibossInviteBanner" id="minibossInviteBanner">
          <span id="minibossInviteBannerBody"></span>
          <div class="minibossInviteActions">
            <button id="minibossInviteAcceptBtn">${i18next.t('combat:combat.miniboss.invite_accept_btn')}</button>
            <button id="minibossInviteIgnoreBtn">${i18next.t('combat:combat.miniboss.invite_ignore_btn')}</button>
          </div>
        </div>
        <div class="minibossChatLog" id="minibossRecruitLog"></div>
        <div class="minibossChatInputRow">
          <input class="minibossChatInput" id="minibossRecruitInput" placeholder="${i18next.t('combat:combat.miniboss.chat_placeholder')}" ${sb&&currentUser?'':'disabled'}>
          <button class="minibossSendBtn" id="minibossRecruitSend">${i18next.t('combat:combat.miniboss.send_button')}</button>
        </div>
      </div>
      <div class="minibossChatPane" id="minibossChatPane-groups">
        <div class="minibossGroupsList" id="minibossGroupsList"></div>
      </div>
      <div class="minibossChatPane" id="minibossChatPane-group">
        <div class="minibossGroupChatHead">${i18next.t('combat:combat.miniboss.you_are', { n })} <small>/${MINIBOSS_MAX_GROUP_SIZE}</small></div>
        <div class="minibossChatLog" id="minibossGroupLog"></div>
        <div class="minibossChatInputRow">
          <input class="minibossChatInput" id="minibossGroupInput" placeholder="${i18next.t('combat:combat.miniboss.chat_group_placeholder')}" ${sb&&currentUser?'':'disabled'}>
          <button class="minibossSendBtn" id="minibossGroupSend">${i18next.t('combat:combat.miniboss.send_button')}</button>
        </div>
      </div>
    </div>
    </div>
    </div>`;
}
/** Câble les actions du lobby Mini Boss (craft, invoquer, chips/slider/MAX, chat à onglets, annuaire Groupes). */
function wireMiniBossLobby() {
  const craftBtn = $a('minibossCraftBtn');
  if (craftBtn) craftBtn.onclick = () => { craftMiniBossParchemin(); $('minibossLobbyBody').innerHTML = renderMiniBossLobbyHtml(); wireMiniBossLobby(); };
  const summonHandler = () => startMiniBossFight();
  const s1 = $a('minibossSummonBtn'); if (s1 && !s1.disabled) s1.onclick = summonHandler;
  const s2 = $a('minibossSummonBtn2'); if (s2 && !s2.disabled) s2.onclick = summonHandler;
  document.querySelectorAll('.minibossRunChip').forEach(btn => {
    btn.onclick = () => { minibossApplyRunLength(parseInt(btn.dataset.fights,10)); };
  });
  const slider = $a('minibossRunSlider');
  if (slider) slider.oninput = () => minibossApplyRunLength(parseInt(slider.value,10));
  const maxBtn = $a('minibossMaxBtn');
  if (maxBtn) maxBtn.onclick = () => {
    const party = minibossMyParty();
    const stocks = party.map(p => p.mine ? minibossParcheminQty() : (p.parchemin||0));
    minibossApplyRunLength(minibossMaxRunLength(stocks) || 1);
  };
  document.querySelectorAll('.minibossChatTab').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.minibossChatTab').forEach(b=>b.classList.remove('on'));
      document.querySelectorAll('.minibossChatPane').forEach(p=>p.classList.remove('on'));
      btn.classList.add('on');
      $a('minibossChatPane-'+btn.dataset.chat).classList.add('on');
      if (btn.dataset.chat === 'groups') renderMinibossGroupsList();
    };
  });
  renderMinibossRecruitChatLog(); renderMinibossGroupChatLog(); renderMinibossGroupsList();
  const recruitSend = $a('minibossRecruitSend');
  if (recruitSend) recruitSend.onclick = () => minibossSendChat('recruit');
  const recruitInput = $a('minibossRecruitInput');
  if (recruitInput) recruitInput.onkeydown = e => { if (e.key==='Enter') minibossSendChat('recruit'); };
  const groupSend = $a('minibossGroupSend');
  if (groupSend) groupSend.onclick = () => minibossSendChat('group');
  const groupInput = $a('minibossGroupInput');
  if (groupInput) groupInput.onkeydown = e => { if (e.key==='Enter') minibossSendChat('group'); };
  // "Inviter" à côté de chaque message du chat de recrutement (mockup : .mbInviteMeBtn) --
  // délégation sur le conteneur car le log est reconstruit à chaque nouveau message reçu
  // (renderMinibossRecruitChatLog), pas seulement au wiring initial du lobby.
  const recruitLog = $a('minibossRecruitLog');
  if (recruitLog) recruitLog.onclick = e => {
    const btn = e.target.closest('.minibossInviteMeBtn');
    if (btn) minibossInviteToChat(btn.dataset.pseudo);
  };
  const inviteAccept = $a('minibossInviteAcceptBtn'); if (inviteAccept) inviteAccept.onclick = () => minibossResolveInvite(true);
  const inviteIgnore = $a('minibossInviteIgnoreBtn'); if (inviteIgnore) inviteIgnore.onclick = () => minibossResolveInvite(false);
}
/** @param {number} n - nombre de combats choisi (chip/slider/MAX). Applique et rafraîchit le lobby SANS tout re-render (juste les champs concernés, pattern léger). */
function minibossApplyRunLength(n) {
  minibossRunLength = Math.max(1, n||1);
  minibossTrackPresence('forming');
  if (isMinibossLobbyOpen()) { $('minibossLobbyBody').innerHTML = renderMiniBossLobbyHtml(); wireMiniBossLobby(); }
}
/** Re-render léger de la carte "État du groupe" quand la présence change (nouveau membre, départ) — appelé depuis le sync Presence. */
function refreshMiniBossLobbyGroupParts() {
  if (!isMinibossLobbyOpen()) return;
  $('minibossLobbyBody').innerHTML = renderMiniBossLobbyHtml();
  wireMiniBossLobby();
}
/** @param {'recruit'|'group'} mode. Envoie le message du champ correspondant sur le canal Mini Boss (broadcast, éphémère — pas persisté). */
function minibossSendChat(mode, inputEl) {
  const input = inputEl || $a(mode==='recruit' ? 'minibossRecruitInput' : 'minibossGroupInput');
  if (!input || !input.value.trim() || !minibossLobbyChannel) return;
  const payload = { pseudo: myPseudo||'?', text: input.value.trim().slice(0,200), time: Date.now(),
    groupId: mode==='group' ? (minibossGroupId || (currentUser&&currentUser.id)) : null,
    gearPct: minibossMyGearPct(), repCounters: minibossRepCounters() };
  try { minibossLobbyChannel.send({ type:'broadcast', event:'chat', payload }); } catch (e) {}
  if (payload.groupId) { minibossGroupLog.push(payload); renderMinibossGroupChatLog(); } else { minibossRecruitLog.push(payload); renderMinibossRecruitChatLog(); }
  input.value = '';
}
/** @param {object} c - compteurs de réputation ({groupsCreated,runsJoined,soloQuits,disconnects,votes,runsClean,runsIncident}). @returns {string} badge ⭐note/5 + carte détaillée au survol (CSS pur, mêmes conventions que .minibossRulesInfo). */
function minibossRepBadgeHtml(c) {
  c = c || {};
  const score = minibossReputationScore(c.runsClean, c.runsIncident);
  const cls = score>=4?'good':score>=2.5?'ok':'bad';
  return `<span class="minibossRepBadge ${cls}">🛡️${score}/5<div class="minibossRepCard">` +
    `<div class="minibossRepCardTitle">${i18next.t('combat:combat.miniboss.rep_card_title')}</div>` +
    `<div class="minibossRepCardRow"><span>👥 ${i18next.t('combat:combat.miniboss.rep_groups_created')}</span><b>${c.groupsCreated||0}</b></div>` +
    `<div class="minibossRepCardRow"><span>🤝 ${i18next.t('combat:combat.miniboss.rep_runs_joined')}</span><b>${c.runsJoined||0}</b></div>` +
    `<div class="minibossRepCardRow"><span>🚪 ${i18next.t('combat:combat.miniboss.rep_solo_quits')}</span><b>${c.soloQuits||0}</b></div>` +
    `<div class="minibossRepCardRow"><span>📡 ${i18next.t('combat:combat.miniboss.rep_disconnects')}</span><b>${c.disconnects||0}</b></div>` +
    `<div class="minibossRepCardRow"><span>🗳️ ${i18next.t('combat:combat.miniboss.rep_votes')}</span><b>${c.votes||0}</b></div>` +
    `<div class="minibossRepCardRow good minibossRepCardDivider"><span>✅ ${i18next.t('combat:combat.miniboss.rep_runs_clean')}</span><b>${c.runsClean||0}</b></div>` +
    `<div class="minibossRepCardRow bad"><span>⚠️ ${i18next.t('combat:combat.miniboss.rep_runs_incident')}</span><b>${c.runsIncident||0}</b></div>` +
    `</div></span>`;
}
/** Reconstruit le log du chat de recrutement (public). */
function renderMinibossRecruitChatLog() {
  const el = $a('minibossRecruitLog'); if (!el) return;
  const hasRoom = minibossMyParty().length < MINIBOSS_MAX_GROUP_SIZE;
  const myName = myPseudo || '?';
  el.innerHTML = minibossRecruitLog.slice(-50).map(m => {
    const inviteBtn = (m.pseudo !== myName && hasRoom)
      ? `<button class="minibossInviteMeBtn" data-pseudo="${escapeHtml(m.pseudo)}">${i18next.t('combat:combat.miniboss.invite_button')}</button>` : '';
    return `<div class="minibossChatMsg"><span class="minibossChatPseudo">${escapeHtml(m.pseudo)}</span>` +
      minibossRepBadgeHtml(m.repCounters) +
      `<span class="minibossGearBadge">⚔️${m.gearPct||0}%</span>` +
      `<span class="minibossChatText">${escapeHtml(m.text)}</span>${inviteBtn}</div>`;
  }).join('') || `<div class="admHint">${i18next.t('combat:combat.miniboss.chat_empty')}</div>`;
  el.scrollTop = el.scrollHeight;
}
/** Reconstruit le(s) log(s) du chat de groupe (privé, filtré par groupId) -- met à jour la version lobby (#minibossGroupLog) ET la version arène (#minibossArenaGroupLog) si présentes, les deux affichent le même flux partagé. */
function renderMinibossGroupChatLog() {
  const html = minibossGroupLog.slice(-50).map(m =>
    `<div class="minibossChatMsg"><span class="minibossChatPseudo">${escapeHtml(m.pseudo)}</span><span class="minibossChatText">${escapeHtml(m.text)}</span></div>`).join('') ||
    `<div class="admHint">${i18next.t('combat:combat.miniboss.chat_empty')}</div>`;
  ['minibossGroupLog', 'minibossArenaGroupLog'].forEach(id => {
    const el = $a(id); if (!el) return;
    el.innerHTML = html; el.scrollTop = el.scrollHeight;
  });
}
/** Reconstruit l'annuaire "Groupes" (tous les groupes ouverts, formation ET combat) — bouton direct si en formation, demande si en combat (voir plan §0sexies). */
function renderMinibossGroupsList() {
  const el = $a('minibossGroupsList'); if (!el) return;
  const groups = minibossAllGroups().filter(g => !currentUser || g.groupId !== currentUser.id || minibossGroupId);
  if (!groups.length) { el.innerHTML = `<div class="admHint">${i18next.t('combat:combat.miniboss.no_groups')}</div>`; return; }
  el.innerHTML = groups.map(g => `<div class="minibossGroupRow">
      <div class="minibossGroupRowHead">
        <span class="minibossGroupRowName">👑 ${escapeHtml(g.summoner ? g.summoner.pseudo : '?')}</span>
        <span class="minibossGroupRowStatus ${g.fighting?'fighting':'forming'}">${g.fighting?'⚔️ '+i18next.t('combat:combat.miniboss.status_fighting'):'🟢 '+i18next.t('combat:combat.miniboss.status_forming')}</span>
        <span class="minibossGroupRowSize">${g.size}/${MINIBOSS_MAX_GROUP_SIZE}</span>
      </div>
      <div class="minibossGroupRowMeta">🛡️ ${i18next.t('combat:combat.miniboss.avg_gear', { pct:g.avgGear })}</div>
      <button class="minibossGroupJoinBtn" data-group="${escapeHtml(g.groupId)}" data-fighting="${g.fighting}">${g.fighting?i18next.t('combat:combat.miniboss.request_join'):i18next.t('combat:combat.miniboss.join_direct')}</button>
    </div>`).join('');
  el.querySelectorAll('.minibossGroupJoinBtn').forEach(btn => {
    btn.onclick = () => minibossJoinGroup(btn.dataset.group, btn.dataset.fighting === 'true');
  });
}
/** @param {string} groupId. @param {boolean} fighting. Rejoint directement (formation) ou envoie une demande (combat, voir plan §0sexies). */
function minibossJoinGroup(groupId, fighting) {
  if (!groupId) return;
  if (!fighting) { minibossGroupId = groupId; minibossMyRole = 'joiner'; minibossRepCounters().runsJoined++; minibossTrackPresence('forming'); refreshMiniBossLobbyGroupParts(); return; }
  if (!minibossLobbyChannel || !currentUser) return;
  try { minibossLobbyChannel.send({ type:'broadcast', event:'join_request', payload:{ groupId, fromUid:currentUser.id, fromPseudo: myPseudo||'?' } }); } catch (e) {}
  pushNotif('📨', i18next.t('combat:combat.miniboss.request_sent_title'), i18next.t('combat:combat.miniboss.request_sent_body'), 'info');
}
/** Invite un joueur vu dans le chat de recrutement à rejoindre MON groupe (mockup : bouton "Inviter" à côté de chaque message, actif seulement si j'ai déjà une place libre — voir renderMinibossRecruitChatLog). */
function minibossInviteToChat(toPseudo) {
  if (!minibossLobbyChannel || !currentUser || !toPseudo) return;
  const groupId = minibossGroupId || currentUser.id;
  try { minibossLobbyChannel.send({ type:'broadcast', event:'invite', payload:{ toPseudo, fromPseudo: myPseudo||'?', groupId, groupSize: minibossMyParty().length } }); } catch (e) {}
  pushNotif('📨', i18next.t('combat:combat.miniboss.invite_sent_title'), i18next.t('combat:combat.miniboss.invite_sent_body', { pseudo: toPseudo }), 'info');
}
/** @param {{fromPseudo:string, groupId:string, groupSize:number}} invite. Affiche le bandeau d'invitation reçue en tête du chat de recrutement (mockup : .mbInviteBanner). */
function minibossShowInviteBanner(invite) {
  const banner = $a('minibossInviteBanner'); if (!banner) return;
  $a('minibossInviteBannerBody').innerHTML = i18next.t('combat:combat.miniboss.invite_banner_body', { pseudo: escapeHtml(invite.fromPseudo), n: invite.groupSize, max: MINIBOSS_MAX_GROUP_SIZE });
  banner.classList.add('show');
}
/** @param {boolean} accepted. Résout l'invitation reçue en attente (minibossPendingInvite) -- accepter rejoint directement (décision unilatérale de l'invité, pas d'approbation supplémentaire côté groupe). */
function minibossResolveInvite(accepted) {
  const banner = $a('minibossInviteBanner'); if (banner) banner.classList.remove('show');
  const invite = minibossPendingInvite; minibossPendingInvite = null;
  if (!invite) return;
  if (accepted) minibossJoinGroup(invite.groupId, false);
}
/** @param {{fromUid:string, fromPseudo:string, groupId:string}} req. Affiche le pop-up "demande de rejoindre" (uniquement chez l'invocateur du groupe visé). */
function minibossShowJoinRequestPopup(req) {
  const backdrop = $a('minibossJoinReqBackdrop'); if (!backdrop) return;
  $a('minibossJoinReqBody').textContent = i18next.t('combat:combat.miniboss.join_request_body', { pseudo: req.fromPseudo });
  backdrop.classList.add('show');
  $a('minibossJoinReqAccept').onclick = () => minibossResolveJoinRequest(true);
  $a('minibossJoinReqRefuse').onclick = () => minibossResolveJoinRequest(false);
}
/** @param {boolean} accepted. Résout la demande en attente (minibossPendingJoinReq) et diffuse la décision à tout le groupe. */
function minibossResolveJoinRequest(accepted) {
  const backdrop = $a('minibossJoinReqBackdrop'); if (backdrop) backdrop.classList.remove('show');
  const req = minibossPendingJoinReq; minibossPendingJoinReq = null;
  if (!req || !minibossLobbyChannel) return;
  try { minibossLobbyChannel.send({ type:'broadcast', event:'join_resolved', payload:{ groupId:req.groupId, forUid:req.fromUid, accepted } }); } catch (e) {}
  if (accepted && minibossState.active) minibossCancelFightForNewMember();
}
/** Annule proprement le combat en cours (aucun loot perdu pour les membres actuels, aucun Parchemin reperdu) suite à l'acceptation d'un nouveau membre en pleine bataille. */
function minibossCancelFightForNewMember() {
  if (!minibossState.active) return;
  cancelAnimationFrame(minibossState.raf);
  minibossState.active = false; minibossState.ended = true;
  pushNotif('⚔️', i18next.t('combat:combat.miniboss.fight_cancelled_title'), i18next.t('combat:combat.miniboss.fight_cancelled_body'), 'info');
  currentActivity = 'miniboss'; $('minibossRoom').classList.remove('fight'); $('minibossRoom').classList.add('lobby');
  openMiniBossLobby();
}

// ---------------- combat ----------------
const minibossState = { active:false, ended:false, raf:0, startedAt:0, hp:0, maxHp:0, duration:0, groupDps:1,
  isSummoner:true, party:[], runLength:1, runIndex:0, playerHp:0, playerHpMax:0, floatMsgs:[], shakeT:0 };
/** Invoque un Mini Boss (consomme 1 Parchemin, moi = invocateur) — miroir simplifié de startBossFight() (boss.js). Diffuse combat_start au groupe si non solo. */
function startMiniBossFight() {
  if (minibossParcheminQty() <= 0) return;
  const idx = invSlotByKey(MINIBOSS_PARCHEMIN.key);
  if (idx === -1) return;
  invRemoveAt(idx, 1);
  minibossMyRole = 'summoner';
  minibossRepCounters().groupsCreated++;
  const party = minibossMyParty();
  const payload = { groupId: minibossGroupId || (currentUser&&currentUser.id) || 'solo', party, runLength: minibossRunLength, startedAt: Date.now() };
  if (minibossLobbyChannel) { try { minibossLobbyChannel.send({ type:'broadcast', event:'combat_start', payload }); } catch (e) {} }
  minibossTrackPresence('fighting');
  startMiniBossFightLocal(payload, true);
  // best-effort : tente de créer une VRAIE session serveur (RPC), sans jamais bloquer le jeu si
  // la migration n'est pas encore appliquée (voir compromis de scope en tête de fichier).
  if (sb) sb.rpc('miniboss_start', { p_run_length: minibossRunLength }).catch(() => {});
}
/**
 * Démarre localement la simulation d'un combat (déterministe : mêmes PV/DPS cumulé connus par
 * tout le groupe via Presence, voir minibossEstimatedDps) — appelé pour l'invocateur (immédiat) et
 * pour chaque participant (à réception du broadcast combat_start).
 * @param {{party:object[], groupId:string, runLength:number}} payload.
 * @param {boolean} [isSummoner].
 */
function startMiniBossFightLocal(payload, isSummoner) {
  const party = (payload.party && payload.party.length) ? payload.party : minibossMyParty();
  const n = Math.max(1, Math.min(MINIBOSS_MAX_GROUP_SIZE, party.length));
  const maxHp = minibossMaxHp(n);
  const groupDps = Math.max(1, party.reduce((a,p)=>a+minibossEstimatedDps(p.gearPct||0), 0));
  Object.assign(minibossState, {
    active:true, ended:false, startedAt: performance.now(), hp:maxHp, maxHp, duration: maxHp/groupDps, groupDps,
    isSummoner: !!isSummoner, party, runLength: payload.runLength || minibossRunLength, runIndex: 1,
    playerHp: effHpMax(), playerHpMax: effHpMax(), floatMsgs:[], shakeT:0, votes: new Set(),
  });
  currentActivity = 'miniboss'; renderActivityTabs();
  setFarmViewVisible(false);
  $('minibossRoom').classList.remove('lobby'); $('minibossRoom').classList.add('open','fight');
  $('minibossResult').classList.remove('show');
  $('minibossName').textContent = i18next.t('combat:combat.miniboss.creature_name');
  const pauseEl = $a('minibossPauseMsg'); if (pauseEl) pauseEl.textContent = i18next.t('combat:combat.miniboss.pause_warning');
  const voteBtn = $a('minibossVoteStopBtn'); if (voteBtn) voteBtn.textContent = i18next.t('combat:combat.miniboss.vote_stop_btn');
  const leaveBtn = $a('minibossSoloLeaveBtn'); if (leaveBtn) leaveBtn.textContent = i18next.t('combat:combat.miniboss.solo_leave_btn');
  const confirmMsg = $a('minibossSoloLeaveConfirmMsg'); if (confirmMsg) confirmMsg.textContent = i18next.t('combat:combat.miniboss.solo_leave_confirm_msg');
  const confirmBtn = $a('minibossSoloLeaveConfirmBtn'); if (confirmBtn) confirmBtn.textContent = i18next.t('combat:combat.miniboss.solo_leave_confirm_btn');
  const cancelBtn = $a('minibossSoloLeaveCancelBtn'); if (cancelBtn) cancelBtn.textContent = i18next.t('combat:combat.miniboss.solo_leave_cancel_btn');
  const ladderCard = $a('minibossArenaLadder'); if (ladderCard) ladderCard.innerHTML = minibossBonusLadderHtml(n);
  const chatTitle = $a('minibossArenaChatTitle'); if (chatTitle) chatTitle.textContent = '💬 ' + i18next.t('combat:combat.miniboss.chat_group');
  const chatCount = $a('minibossArenaChatCount'); if (chatCount) chatCount.textContent = `${n}/${MINIBOSS_MAX_GROUP_SIZE}`;
  const arenaInput = $a('minibossArenaGroupInput'); if (arenaInput) arenaInput.placeholder = i18next.t('combat:combat.miniboss.chat_group_placeholder');
  const arenaSend = $a('minibossArenaGroupSend'); if (arenaSend) arenaSend.textContent = i18next.t('combat:combat.miniboss.send_button');
  renderMinibossGroupChatLog();
  resizeMinibossCanvas();
  renderMinibossRoster();
  minibossState.raf = requestAnimationFrame(miniBossLoop);
}
/** Reconstruit le panneau roster (#minibossRosterList/#minibossRosterTitle) de l'arène — une fois par combat (le groupe ne change plus une fois lancé, voir minibossCancelFightForNewMember pour le seul cas d'exception). */
function renderMinibossRoster() {
  const titleEl = $a('minibossRosterTitle'); if (titleEl) titleEl.textContent = i18next.t('combat:combat.miniboss.roster_title', { n: minibossState.party.length, max: MINIBOSS_MAX_GROUP_SIZE });
  const listEl = $a('minibossRosterList'); if (!listEl) return;
  listEl.innerHTML = minibossState.party.map(p => {
    const gearCls = p.gearPct>=85?'good':p.gearPct>=60?'ok':'low';
    return `<div class="minibossRosterRow"><span class="minibossRosterRole ${p.role}">${p.role==='summoner'?'👑':'🙂'}</span>` +
      `<span class="minibossRosterName">${escapeHtml(p.pseudo||'?')}</span><span class="minibossRosterGear ${gearCls}">⚔️${p.gearPct||0}%</span></div>`;
  }).join('');
}
/**
 * Boucle rAF du combat Mini Boss — AUCUN filet setInterval (retour explicite : "pas de mode hors
 * ligne", voir CLAUDE.md §33/34 et plan) : requestAnimationFrame se suspend tout seul dès que
 * l'onglet passe en arrière-plan, exactement comme bossLoop() (boss.js).
 * @param {number} now - performance.now(), fourni par requestAnimationFrame.
 */
function miniBossLoop(now) {
  if (!minibossState.active) return;
  const elapsed = (now - minibossState.startedAt) / 1000;
  minibossState.hp = Math.max(0, minibossState.maxHp - minibossState.groupDps * elapsed);
  drawMinibossRoom(now);
  const hpEl = $a('minibossHpTxt');
  if (hpEl) hpEl.textContent = fmt(Math.round(minibossState.hp)) + ' / ' + fmt(minibossState.maxHp);
  const hpBar = $a('minibossHpBar');
  if (hpBar) hpBar.style.width = Math.max(0, minibossState.hp/minibossState.maxHp*100) + '%';
  const timerEl = $a('minibossTimer');
  if (timerEl) timerEl.textContent = fmtBossCountdown(Math.max(0, minibossState.duration-elapsed)*1000);
  const progressEl = $a('minibossRunProgress');
  if (progressEl) progressEl.textContent = i18next.t('combat:combat.miniboss.fight_progress', { i: minibossState.runIndex, n: minibossState.runLength });
  const pHpBar = $a('minibossPlayerHp'), pHpTxt = $a('minibossPlayerHpTxt');
  if (pHpBar) pHpBar.style.width = Math.max(0, minibossState.playerHp/minibossState.playerHpMax*100) + '%';
  if (pHpTxt) pHpTxt.textContent = Math.round(minibossState.playerHp) + ' / ' + Math.round(minibossState.playerHpMax);
  if (minibossState.hp <= 0) { endMiniBossFight(true); return; }
  minibossState.raf = requestAnimationFrame(miniBossLoop);
}
/** @param {boolean} win. Termine le combat Mini Boss courant : calcule le loot (rôle × bonus de groupe), enchaîne le prochain combat du run ou affiche le résultat. */
async function endMiniBossFight(win) {
  if (minibossState.ended) return;
  minibossState.ended = true; minibossState.active = false;
  cancelAnimationFrame(minibossState.raf);
  const n = Math.max(1, minibossState.party.length);
  const mult = minibossFinalMult(minibossState.isSummoner, n);
  let rewardsHtml = '';
  if (win) {
    const base = Math.round(referenceGearVal() * 20);
    const reward = Math.round(base * mult);
    addSilver(reward, 'loot', i18next.t('combat:combat.miniboss.creature_name'));
    const caphrasQty = Math.max(0, Math.round((3 + Math.random()*5) * mult));
    const fragQty = Math.max(0, Math.round((2 + Math.random()*3) * mult));
    invAdd({ key:'mat_'+CAPHRAS_NAME, name:CAPHRAS_NAME, kind:'material', icon:ICO_MAT_CAPHRAS, color:'#c9a55a', qty:caphrasQty, stackable:true, weight:0.1, val:120 });
    invAdd({ name:'Fragment de mémoire', kind:'craft', icon:'✦', color:'#b48ce8', key:'craft_Fragment de mémoire', qty:fragQty, stackable:true, weight:0.2, val:0 });
    const zi = (typeof bestDifficileZoneIdx === 'function') ? bestDifficileZoneIdx() : null;
    if (zi != null) {
      const tier = gearTierForZone(zi), qty = Math.max(1, Math.round((1 + Math.random()*2) * mult));
      invAdd({ name:tier.material.name, key:'mat_'+tier.material.name, kind:'material', icon:tier.material.icon, color:tier.color, qty, stackable:true, weight:0.1, val:0 });
    }
    let marbleHtml = '';
    if (Math.random() < 0.05) {
      invAdd({ name:'Marbre du Dieu déchu', kind:'craft', icon:'✦', color:'#b48ce8', key:'craft_Marbre du Dieu déchu', qty:1, stackable:true, weight:0.2, val:0 });
      trackLoot('Marbre du Dieu déchu');
      marbleHtml = `<div class="brRewards admHint" style="color:var(--gold)">✨ ${i18next.t('combat:combat.miniboss.marble_bonus')}</div>`;
    }
    logToDiscord('📜 Mini Boss', `**${myPseudo||'Joueur'}** vainc ${i18next.t('combat:combat.miniboss.creature_name')} (${minibossState.isSummoner?'invocateur':'participant'}, ${n} joueur(s)) — +${fmt(reward)} 🪙`, 0x9b7fd6);
    rewardsHtml = `<div class="minibossRewardMath">${fmt(base)} × ${minibossState.isSummoner?MINIBOSS_SUMMONER_MULT:MINIBOSS_JOINER_MULT} × ${minibossGroupBonusMult(n)} = <b>${fmt(reward)}</b> 🪙</div>` +
      `<div class="brRewards">+${caphrasQty} × ${tr(CAPHRAS_NAME)} · +${fragQty} × ${tr('Fragment de mémoire')}</div>${marbleHtml}` + minibossBonusLadderHtml(n);
    minibossRepCounters().runsClean++;
    refreshStatsOnly(); hud();
    if (sb) sb.rpc('miniboss_claim', { p_session_id: null }).catch(() => {});
    // enchaîne le prochain combat du run (mêmes règles, même groupe) tant qu'il en reste et que le
    // stock de Parchemins le permet -- l'invocateur relance pour le groupe.
    if (minibossState.isSummoner && minibossState.runIndex < minibossState.runLength && minibossParcheminQty() > 0) {
      minibossState.runIndex++;
      setTimeout(() => { if (currentActivity === 'miniboss') startMiniBossFightAgainInRun(); }, 1500);
      return;
    }
  }
  minibossTrackPresence('forming');
  $('minibossResult').innerHTML = `<div class="brTitle ${win?'win':''}">${win?i18next.t('combat:combat.miniboss.victory_title'):i18next.t('combat:combat.boss.fight_left_title')}</div>${rewardsHtml}` +
    `<button id="minibossCloseBtn">🚪 ${i18next.t('combat:combat.boss.leave_button')}</button>`;
  $('minibossResult').classList.add('show');
  $a('minibossCloseBtn').onclick = () => { $('minibossResult').classList.remove('show'); currentActivity='miniboss'; $('minibossRoom').classList.remove('open'); setFarmViewVisible(true); renderActivityTabs(); openMiniBossLobby(); };
}
/** Relance immédiatement le combat suivant d'un run en cours (même groupe/PV, runIndex déjà incrémenté) — consomme 1 Parchemin de plus. */
function startMiniBossFightAgainInRun() {
  if (minibossParcheminQty() <= 0) { endMiniBossFight(false); return; }
  const idx = invSlotByKey(MINIBOSS_PARCHEMIN.key); if (idx === -1) { endMiniBossFight(false); return; }
  invRemoveAt(idx, 1);
  const party = minibossMyParty();
  const payload = { party, groupId: minibossGroupId || (currentUser&&currentUser.id) || 'solo', runLength: minibossState.runLength, startedAt: Date.now() };
  if (minibossLobbyChannel) { try { minibossLobbyChannel.send({ type:'broadcast', event:'combat_start', payload }); } catch (e) {} }
  const keepIdx = minibossState.runIndex;
  startMiniBossFightLocal(payload, true);
  minibossState.runIndex = keepIdx;
}
/** Quitte seul le combat/run en cours (§ "Règles de fin de run") : perd tout le loot de ce combat, le Parchemin déjà engagé n'est PAS remboursé. */
/** Affiche/cache la confirmation "quitter seul" (perte sèche du loot, ne doit jamais être accidentelle — voir mockup, retour de revue). N'exécute PAS minibossSoloLeave() directement. */
function minibossToggleSoloLeaveConfirm() {
  const panel = $a('minibossSoloLeaveConfirm'); if (!panel) return;
  const votePanel = $a('minibossVoteStopPanel'); if (votePanel) votePanel.classList.remove('show');
  panel.classList.toggle('show');
}
/** Quitte réellement le combat en solo (appelé UNIQUEMENT après confirmation, voir minibossToggleSoloLeaveConfirm) — perd tout le loot, le Parchemin déjà engagé n'est pas remboursé. */
function minibossSoloLeave() {
  if (!minibossState.active) return;
  const panel = $a('minibossSoloLeaveConfirm'); if (panel) panel.classList.remove('show');
  cancelAnimationFrame(minibossState.raf);
  minibossState.active = false; minibossState.ended = true;
  minibossRepCounters().soloQuits++; minibossRepCounters().runsIncident++;
  currentActivity = 'zone'; $('minibossRoom').classList.remove('open','fight');
  setFarmViewVisible(true); renderActivityTabs();
}
/** Bascule l'affichage du panneau de vote collectif pour arrêter le combat/run en cours -- ouvrir le panneau vaut vote ("Toi ✅" immédiatement dans la liste, même logique que la maquette), diffusé aux autres membres du groupe via le canal Presence/Broadcast. */
function minibossToggleVoteStop() {
  const panel = $a('minibossVoteStopPanel'); if (!panel) return;
  const leaveConfirm = $a('minibossSoloLeaveConfirm'); if (leaveConfirm) leaveConfirm.classList.remove('show');
  panel.classList.toggle('show');
  if (panel.classList.contains('show')) {
    minibossRepCounters().votes++;
    const head = $a('minibossVoteStopHead');
    if (head) head.textContent = i18next.t('combat:combat.miniboss.vote_stop_head');
    const myName = myPseudo || i18next.t('combat:combat.miniboss.you_label');
    if (minibossState.votes) minibossState.votes.add(myName);
    const groupId = minibossGroupId || (currentUser && currentUser.id);
    if (minibossLobbyChannel && groupId) {
      try { minibossLobbyChannel.send({ type:'broadcast', event:'vote_stop', payload:{ groupId, pseudo: myName } }); } catch (e) {}
    }
    renderMinibossVoteChips();
  }
}
/** Reconstruit la liste nominative des votants (✅ a voté / ⏳ en attente) dans #minibossVoteStopList — un chip par membre du groupe engagé dans ce combat. */
function renderMinibossVoteChips() {
  const el = $a('minibossVoteStopList'); if (!el || !minibossState.party) return;
  const votes = minibossState.votes || new Set();
  const myName = myPseudo || i18next.t('combat:combat.miniboss.you_label');
  el.innerHTML = minibossState.party.map(p => {
    const name = p.mine ? myName : p.pseudo;
    const voted = votes.has(name);
    return `<span class="minibossVoteChip ${voted?'yes':'pending'}">${escapeHtml(p.mine?i18next.t('combat:combat.miniboss.you_label'):p.pseudo)} ${voted?'✅':'⏳'}</span>`;
  }).join('');
  const head = $a('minibossVoteStopHead');
  if (head) head.textContent = `${i18next.t('combat:combat.miniboss.vote_stop_head')} — ${votes.size}/${minibossState.party.length}`;
}
/** Redimensionne le canvas #minibossCv à la taille CSS de son conteneur. */
function resizeMinibossCanvas() {
  const cv = $a('minibossCv'); if (!cv) return;
  cv.width = cv.clientWidth || 1280; cv.height = cv.clientHeight || 600;
}
