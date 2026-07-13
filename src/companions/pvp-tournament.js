// ═══ TOURNOI PvP QUOTIDIEN (2026-07-13, demande explicite confirmée : "je crée et applique
// maintenant une vraie migration Supabase en PRODUCTION pour le tournoi PvP") ══════════════════
// Remplace le simple "bientôt disponible" de pvp.js (classement LOCAL par puissance, toujours
// gardé, voir ce fichier) par un vrai tournoi asynchrone : inscription en continu, fermeture
// chaque jour à 21h Europe/Paris, résolution automatique côté serveur (bracket à élimination
// directe + un facteur aléatoire pondéré par la puissance réelle), résultat consultable en replay
// le lendemain. Toujours PAS de combat temps réel joueur-contre-joueur (aucun serveur autoritaire
// pour ça) -- voir supabase/migrations/20260722090000_companion_pvp_tournament.sql pour le détail
// serveur (schéma, RPC, choix pg_cron+plpgsql plutôt qu'Edge Function+cron HTTP).
//
// Équipe engagée = snapshot FIGÉ au moment de l'inscription (tous les pets p.terrain===true,
// voir deployPet(), sections.js) -- si le joueur change son déploiement après inscription, ça ne
// change RIEN au tournoi déjà inscrit tant qu'il ne se réinscrit pas explicitement (les
// inscriptions restent ouvertes jusqu'à 21h, une réinscription remplace le snapshot précédent).
//
// Accès Supabase EXCLUSIVEMENT via window.parent.getSbClient()/getCurrentUserForSync() (même
// pattern que sync.js/market.js -- jamais window.parent.sb directement, jamais un 2e SDK dans
// l'iframe).

// ═══ CALCUL PUR (testable sans DOM/réseau) ═══════════════════════════════════════════════════

/**
 * Dérive 4 stats de combat (Attaque/Défense/Vitesse/Esquive%) d'un pet, de façon déterministe,
 * SANS stocker de nouvelle donnée sur le pet (tout recalculé depuis normGS()/tier/rareté déjà
 * existants, voir tier.js). Choix de formule (documenté ici, pas ailleurs) :
 * - ATK/DEF = split 60/40 du GS normalisé (0-1000) -- ATK domine légèrement, DEF reste significative.
 *   + un petit bonus par rareté/tier pour que 2 pets de même GS mais de rareté différente restent
 *   distinguables (un Ancestral bien roulé mais Tier bas doit quand même dépasser un Commun capé).
 * - SPD = base 50 (tous les pets ont une vitesse "normale" de référence) + une fraction du GS +
 *   un petit bonus de tier (monter en tier rend le pet plus vif) -- volontairement peu sensible au
 *   GS pour que SPD ne devienne jamais le facteur dominant du combat (voir computeTeamPower()).
 * - EVA% = base 5% + fraction du GS + bonus de rareté (les raretés hautes esquivent mieux),
 *   plafonnée à 60% (jamais un pet réellement invincible).
 * "Tier progresse via XP, pas GS" (voir README.md/tier.js) -- le tier reste donc un facteur
 * ADDITIF indépendant du GS dans ces formules, jamais une simple fonction du GS.
 * @param {object} pet - familier local (lit .rar, .tier, + tout ce que normGS() lit).
 * @returns {{atk:number, def:number, spd:number, eva:number}} 4 stats de combat entières.
 */
function deriveCombatStats(pet) {
  const gs = normGS(pet);
  const rar = pet.rar || 0;
  const tier = pet.tier || 1;
  const atk = Math.round(gs * 0.6 + rar * 15 + tier * 8);
  const def = Math.round(gs * 0.4 + rar * 20 + tier * 6);
  const spd = Math.round(50 + gs * 0.05 + tier * 3);
  const eva = Math.min(60, Math.round(5 + gs * 0.03 + rar * 1.5));
  return { atk, def, spd, eva };
}

/**
 * Puissance de combat d'un unique membre d'équipe (déjà doté de ses 4 stats dérivées) -- pondère
 * ATK/DEF comme les composantes dominantes, SPD/EVA comme des facteurs secondaires. Utilisée à la
 * fois pour la puissance d'équipe (moyenne) et côté serveur (pvp_simulate_match(), même esprit de
 * pondération, formule réimplémentée en SQL -- voir la migration pour la justification de cette
 * duplication volontaire plutôt qu'un appel réseau).
 * @param {{atk:number, def:number, spd:number, eva:number}} stats - stats de combat d'un membre.
 * @returns {number} puissance de combat individuelle.
 */
function combatMemberPower(stats) {
  return (stats.atk || 0) * 0.4 + (stats.def || 0) * 0.3 + (stats.spd || 0) * 0.15 + (stats.eva || 0) * 3;
}

/**
 * Puissance d'ÉQUIPE = MOYENNE (pas la somme -- une équipe à 8 pets ne doit pas mécaniquement
 * dominer une équipe à 1 pet très fort) des puissances individuelles de chaque pet déployé.
 * @param {object[]} deployedPets - pets avec .terrain===true (voir terrainPet(), sections.js).
 * @returns {number} puissance d'équipe (0 si aucun pet déployé).
 */
function computeTeamPower(deployedPets) {
  const list = Array.isArray(deployedPets) ? deployedPets : [];
  if (!list.length) return 0;
  const total = list.reduce((sum, p) => sum + combatMemberPower(deriveCombatStats(p)), 0);
  return +(total / list.length).toFixed(2);
}

/**
 * Construit le snapshot figé envoyé au serveur à l'inscription -- un objet léger par pet déployé,
 * jamais l'objet pet complet (pas de stats[]/uid interne exposés inutilement).
 * @param {object[]} deployedPets - pets avec .terrain===true.
 * @returns {object[]} [{id,name,rarity,tier,section,atk,def,spd,eva}] -- forme validée côté serveur (register_pvp_team).
 */
function buildTeamSnapshot(deployedPets) {
  return (Array.isArray(deployedPets) ? deployedPets : []).map(p => {
    const stats = deriveCombatStats(p);
    return {
      id: p.id, name: p.cat.name, rarity: p.rar, tier: p.tier || 1, section: p.cat.sec,
      atk: stats.atk, def: stats.def, spd: stats.spd, eva: stats.eva,
    };
  });
}

/** @returns {object[]} tous les pets actuellement déployés (terrain===true), toutes sections confondues. */
function currentlyDeployedPets() {
  return (Array.isArray(PETS) ? PETS : []).filter(p => p.terrain);
}

// ═══ BRACKET (référence/aperçu client + tests -- l'AUTORITÉ reste la résolution serveur SQL,
// voir run_pvp_tournament() dans la migration ; les deux ne sont PAS tenues de tirer les mêmes
// résultats bit-à-bit, seul le résultat stocké côté serveur fait foi pour le vrai tournoi. Ces
// fonctions servent de spécification testable en JS pur, et à un éventuel aperçu client. ═══════

/** PRNG déterministe simple (mulberry32) -- seed numérique -> suite reproductible dans [0,1). @param {number} seed. @returns {function():number} générateur. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** @param {string} str - texte à hacher. @returns {number} entier 32 bits (seed pour mulberry32), déterministe. */
function seedFromString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * Construit un bracket à élimination directe : taille = puissance de 2 la plus proche du nombre
 * d'entrants (byes = null en fin de liste, après un mélange pseudo-aléatoire seedé).
 * @param {{userId:string, pseudo:string, power:number}[]} entrants - inscrits (déjà résolus, pas de PETS/DOM ici).
 * @param {string} seed - graine texte (ex: le jour ISO du tournoi) -- même seed = même ordre.
 * @returns {{size:number, entrants:object[], slots:(object|null)[]}} structure de départ du bracket (round 0 pas encore résolu).
 */
function buildBracket(entrants, seed) {
  const list = Array.isArray(entrants) ? entrants.slice() : [];
  if (!list.length) return { size: 0, entrants: [], slots: [] };
  const rng = mulberry32(seedFromString(String(seed || '')));
  // mélange de Fisher-Yates seedé, déterministe pour une seed donnée
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  const size = list.length === 1 ? 1 : Math.pow(2, Math.ceil(Math.log2(list.length)));
  const slots = list.slice();
  while (slots.length < size) slots.push(null);
  return { size, entrants: list, slots };
}

/**
 * Résout un bracket construit par buildBracket() -- un combat par paire, gagnant pondéré par
 * l'écart relatif de puissance (borné [0.05,0.95], jamais un résultat 100% garanti). Même
 * formule de probabilité que pvp_simulate_match() côté SQL (voir migration), reproduite ici en
 * JS pur pour rester testable sans base de données.
 * @param {{size:number, slots:(object|null)[]}} bracket - résultat de buildBracket().
 * @param {string} seed - graine texte (mêmes garanties de reproductibilité que buildBracket()).
 * @returns {{size:number, rounds:object[][], winner:?object}} bracket entièrement résolu, prêt pour un replay.
 */
function resolveBracket(bracket, seed) {
  const rng = mulberry32(seedFromString(String(seed || '') + ':resolve'));
  let current = Array.isArray(bracket && bracket.slots) ? bracket.slots.slice() : [];
  if (!current.length) return { size: 0, rounds: [], winner: null };
  if (current.length === 1) return { size: 1, rounds: [], winner: current[0] };
  const rounds = [];
  while (current.length > 1) {
    const round = [];
    const next = [];
    for (let i = 0; i < current.length; i += 2) {
      const a = current[i], b = current[i + 1];
      let winner, aWinProbability, roll = null;
      if (!a) { winner = b; aWinProbability = 0; }
      else if (!b) { winner = a; aWinProbability = 1; }
      else {
        const pa = a.power, pb = b.power;
        aWinProbability = Math.min(0.95, Math.max(0.05, 0.5 + 0.45 * ((pa - pb) / (pa + pb + 1))));
        roll = rng();
        winner = roll < aWinProbability ? a : b;
      }
      round.push({ a, b, winner, aWinProbability: +aWinProbability.toFixed(3), roll: roll === null ? null : +roll.toFixed(3) });
      next.push(winner);
    }
    rounds.push(round);
    current = next;
  }
  return { size: bracket.size, rounds, winner: current[0] };
}

// ═══ RÉSEAU (Supabase, via le client hôte -- jamais window.parent.sb directement) ═════════════

/** @returns {Window|null} fenêtre hôte si en iframe, sinon null (même pattern que market.js/sync.js). */
function pvpHostWin() { return (window.parent && window.parent !== window) ? window.parent : null; }
/** @returns {object|null} client Supabase du jeu hôte. */
function pvpSb() { const w = pvpHostWin(); return w && typeof w.getSbClient === 'function' ? w.getSbClient() : null; }
/** @returns {object|null} utilisateur courant, via le jeu hôte. */
function pvpUser() { const w = pvpHostWin(); return w && typeof w.getCurrentUserForSync === 'function' ? w.getCurrentUserForSync() : null; }
/** @returns {boolean} true si invité (tournoi nécessite un compte -- même garde que le Marché). */
function pvpIsGuest() { const w = pvpHostWin(); return w && typeof w.isGuest === 'function' ? w.isGuest() : false; }
/** @returns {boolean} true si le tournoi est utilisable (Supabase + user dispo, pas invité). */
function pvpTournamentReady() { return !!(pvpSb() && pvpUser() && !pvpIsGuest()); }

/**
 * Heure Paris courante, dérivée de façon fiable via Intl (gère automatiquement l'heure d'été/hiver,
 * même sans dépendre d'une lib de timezone externe) -- même esprit que BOSS_SCHEDULE côté jeu
 * principal (combat/boss.js), qui ancre déjà tout sur Europe/Paris.
 * @returns {{y:number,mo:number,d:number,h:number,mi:number,s:number}} composants de la date/heure Paris actuelle.
 */
function parisNowParts() {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = {};
  fmt.formatToParts(new Date()).forEach(p => { if (p.type !== 'literal') parts[p.type] = parseInt(p.value, 10); });
  return { y: parts.year, mo: parts.month, d: parts.day, h: parts.hour === 24 ? 0 : parts.hour, mi: parts.minute, s: parts.second };
}
/** @returns {string} jour Paris courant au format ISO (YYYY-MM-DD). */
function parisTodayIso() {
  const p = parisNowParts();
  return `${p.y}-${String(p.mo).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}
/** @returns {string} jour ISO du PROCHAIN tournoi visé par une inscription faite maintenant (aujourd'hui si avant 21h Paris, sinon demain) -- même règle que register_pvp_team() côté serveur. */
function pvpTargetDayIso() {
  const p = parisNowParts();
  const base = new Date(Date.UTC(p.y, p.mo - 1, p.d));
  if (p.h >= 21) base.setUTCDate(base.getUTCDate() + 1);
  return base.toISOString().slice(0, 10);
}
/** @returns {string} jour ISO d'HIER (Paris) -- pour retrouver le tournoi déjà résolu à afficher en "replay". */
function pvpYesterdayIso() {
  const p = parisNowParts();
  const base = new Date(Date.UTC(p.y, p.mo - 1, p.d));
  base.setUTCDate(base.getUTCDate() - 1);
  return base.toISOString().slice(0, 10);
}
/** @returns {number} secondes restantes avant la fermeture des inscriptions du tournoi CIBLE (21h Paris du jour visé par une inscription faite maintenant). */
function pvpSecondsUntilClose() {
  const p = parisNowParts();
  if (p.h < 21) {
    return (21 - p.h - 1) * 3600 + (60 - p.mi - 1) * 60 + (60 - p.s);
  }
  // après 21h : compte à rebours vers 21h le lendemain
  return (24 - p.h + 21 - 1) * 3600 + (60 - p.mi - 1) * 60 + (60 - p.s);
}

let pvpTournamentState = { day: null, registrantCount: 0, myRegistered: false, myTeamPower: 0, yesterday: null };

/** Inscrit l'équipe actuellement déployée au prochain tournoi (RPC register_pvp_team). @returns {Promise<void>} */
async function registerForPvpTournament() {
  if (!pvpTournamentReady()) { toast('⚠️', pvpIsGuest() ? 'Le tournoi nécessite un compte (pas disponible en invité).' : 'Connecte-toi pour t\'inscrire.'); return; }
  const deployed = currentlyDeployedPets();
  if (!deployed.length) { toast('⚠️', 'Déploie au moins un familier sur le terrain avant de t\'inscrire.'); return; }
  const team = buildTeamSnapshot(deployed);
  const power = computeTeamPower(deployed);
  try {
    const sb = pvpSb();
    const { data, error } = await sb.rpc('register_pvp_team', { p_team: team, p_team_power: power });
    if (error) throw error;
    toast('⚔️', `Équipe inscrite pour le tournoi du ${data.day} !`);
    await refreshPvpTournamentState();
  } catch (e) {
    toast('⚠️', 'Inscription échouée : ' + ((e && e.message) || 'erreur réseau'));
  }
}

/** Recharge l'état du tournoi (jour cible, compte d'inscrits, ma propre inscription, résultat d'hier) puis rafraîchit l'UI. @returns {Promise<void>} */
async function refreshPvpTournamentState() {
  if (!pvpTournamentReady()) { renderPvpTournamentCard(); return; }
  const sb = pvpSb();
  const user = pvpUser();
  const day = pvpTargetDayIso();
  const yesterday = pvpYesterdayIso();
  pvpTournamentState.day = day;
  try {
    const { data: count } = await sb.rpc('pvp_registrant_count', { p_day: day });
    pvpTournamentState.registrantCount = count || 0;
  } catch (e) { pvpTournamentState.registrantCount = 0; }
  try {
    const { data: mine } = await sb.from('companion_pvp_registrations').select('team_power,registered_at').eq('user_id', user.id).eq('day', day).maybeSingle();
    pvpTournamentState.myRegistered = !!mine;
    pvpTournamentState.myTeamPower = mine ? mine.team_power : 0;
  } catch (e) { pvpTournamentState.myRegistered = false; }
  try {
    const { data: y } = await sb.from('companion_pvp_tournaments').select('*').eq('day', yesterday).maybeSingle();
    pvpTournamentState.yesterday = y || null;
  } catch (e) { pvpTournamentState.yesterday = null; }
  renderPvpTournamentCard();
}

// ═══ UI ═══════════════════════════════════════════════════════════════════════════════════════

let pvpCountdownInterval = null;

/** @param {number} s - secondes. @returns {string} durée HH:MM:SS (même format que fmtT(), sans le repli "PRÊT"). */
function fmtCountdown(s) {
  s = Math.max(0, Math.floor(s));
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Construit le détail round-par-round de MON équipe à partir du bracket stocké (victoires/défaites/delta de puissance). @param {object} bracket - bracket résolu stocké côté serveur. @param {string} myUserId. @returns {object[]} liste de mes combats (round, adversaire, résultat, delta). */
function myPvpRunFromBracket(bracket, myUserId) {
  if (!bracket || !Array.isArray(bracket.rounds)) return [];
  const runs = [];
  let stillIn = true;
  bracket.rounds.forEach((round, ri) => {
    if (!stillIn) return;
    const match = round.find(m => (m.a && m.a.user_id === myUserId) || (m.b && m.b.user_id === myUserId));
    if (!match) return;
    const isA = match.a && match.a.user_id === myUserId;
    const me = isA ? match.a : match.b;
    const opp = isA ? match.b : match.a;
    const won = match.winner_user_id === myUserId;
    runs.push({
      round: ri + 1, opponentPseudo: opp ? opp.pseudo : '(bye)', won,
      delta: opp ? +(me.power - opp.power).toFixed(1) : null, bye: !opp,
    });
    if (!won) stillIn = false;
  });
  return runs;
}

/** Reconstruit la carte "Tournoi du jour" + "Ton équipe engagée" + "Tournoi d'hier" dans l'onglet PvP (#pvp-tournament-card). No-op si l'élément n'existe pas (onglet pas encore ouvert). */
function renderPvpTournamentCard() {
  const el = document.getElementById('pvp-tournament-card');
  if (!el) return;

  if (pvpCountdownInterval) { clearInterval(pvpCountdownInterval); pvpCountdownInterval = null; }

  if (!pvpTournamentReady()) {
    el.innerHTML = `<div style="font-size:11px;color:var(--cream3);padding:16px;text-align:center">${pvpIsGuest() ? 'Le tournoi nécessite un compte (pas disponible en invité).' : 'Connecte-toi pour rejoindre le tournoi.'}</div>`;
    return;
  }

  const deployed = currentlyDeployedPets();
  const livePower = computeTeamPower(deployed);
  const y = pvpTournamentState.yesterday;
  const user = pvpUser();
  const myRuns = (y && y.status === 'resolved' && user) ? myPvpRunFromBracket(y.bracket, user.id) : [];
  const myWasEntrant = y && y.bracket && Array.isArray(y.bracket.entrants) && user && y.bracket.entrants.some(e => e.user_id === user.id);

  el.innerHTML = `
    <div style="background:var(--s2);border:1px solid var(--gold-dim);border-radius:10px;padding:14px 16px;margin-bottom:12px">
      <div style="font-family:'Cinzel',serif;font-size:12px;color:var(--gold);margin-bottom:6px">🏆 Tournoi du jour</div>
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <div style="font-family:'JetBrains Mono',monospace;font-size:20px;color:var(--gold2)" id="pvp-countdown">--:--:--</div>
        <div style="font-size:10px;color:var(--cream3)">avant fermeture des inscriptions (21h, heure de Paris)</div>
        <div style="margin-left:auto;font-size:11px;color:var(--cream2)">👥 <strong id="pvp-registrant-count">${pvpTournamentState.registrantCount}</strong> dresseur(s) inscrit(s)</div>
      </div>
    </div>
    <div style="background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:12px">
      <div style="font-family:'Cinzel',serif;font-size:12px;color:var(--cream2);margin-bottom:6px">🌿 Ton équipe engagée</div>
      ${deployed.length ? `
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
          ${deployed.map(p => `<span style="font-size:10px;color:${rc(p.rar)};background:var(--s3);border:1px solid var(--border);border-radius:6px;padding:2px 7px">${p.cat.name}</span>`).join('')}
        </div>
        <div style="font-size:11px;color:var(--cream2)">Puissance d'équipe actuelle : <strong style="color:var(--gold2)">${livePower}</strong></div>
      ` : `<div style="font-size:11px;color:var(--cream3)">Aucun familier déployé -- va dans l'onglet Sections pour en déployer au moins un.</div>`}
      ${pvpTournamentState.myRegistered
        ? `<div style="font-size:10.5px;color:var(--green2);margin-top:8px">✓ Inscrit pour le tournoi du ${pvpTournamentState.day} (puissance figée : ${pvpTournamentState.myTeamPower}). Se réinscrire remplace cette équipe tant que les inscriptions restent ouvertes.</div>`
        : `<div style="font-size:9.5px;color:var(--cream3);margin-top:8px">L'équipe engagée au tournoi est figée au moment de l'inscription -- un changement de déploiement après coup n'est pas repris tant que tu ne te réinscris pas.</div>`}
      <button class="btn btn-gold" style="margin-top:10px" onclick="registerForPvpTournament()" ${deployed.length ? '' : 'disabled'}>${pvpTournamentState.myRegistered ? '🔄 Réinscrire mon équipe' : '⚔️ Inscrire mon équipe'}</button>
    </div>
    <div style="background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:14px 16px">
      <div style="font-family:'Cinzel',serif;font-size:12px;color:var(--cream2);margin-bottom:6px">📜 Tournoi d'hier</div>
      ${!y ? `<div style="font-size:11px;color:var(--cream3)">Aucun tournoi hier.</div>`
        : y.status !== 'resolved' ? `<div style="font-size:11px;color:var(--cream3)">Pas encore résolu.</div>`
        : (y.bracket.size === 0) ? `<div style="font-size:11px;color:var(--cream3)">Personne ne s'était inscrit hier.</div>`
        : `<div style="font-size:11px;color:var(--cream2);margin-bottom:6px">🥇 Vainqueur : <strong style="color:var(--gold2)">${y.winner_pseudo || '?'}</strong> (${y.registrant_count} inscrit(s))</div>
          ${myWasEntrant ? `<div style="font-size:10.5px;color:var(--cream2);margin-bottom:8px">Ton parcours :
            ${myRuns.map(r => `<div style="padding:3px 0">Round ${r.round} vs ${r.opponentPseudo}${r.bye ? ' (bye)' : ''} — ${r.won ? '<span style="color:var(--green2)">Victoire</span>' : '<span style="color:var(--red2)">Défaite</span>'}${r.delta !== null ? ` (Δ puissance ${r.delta >= 0 ? '+' : ''}${r.delta})` : ''}</div>`).join('') || '<div>Pas de combat enregistré.</div>'}
          </div>` : `<div style="font-size:10px;color:var(--cream3);margin-bottom:8px">Tu n'étais pas inscrit hier.</div>`}
          <button class="btn btn-ghost" onclick="openPvpBracketModalIfAny()">📋 Voir le bracket complet</button>`}
    </div>
  `;

  const tick = () => { const c = document.getElementById('pvp-countdown'); if (c) c.textContent = fmtCountdown(pvpSecondsUntilClose()); };
  tick();
  pvpCountdownInterval = setInterval(tick, 1000);
}

/** Ouvre la modale #pvp-bracket-modal (companions.html) avec le détail round-par-round du bracket d'hier -- jamais window.alert() (bloquerait les tests Playwright, voir dismissTutorialsAndClick dans companions.spec.js pour la même préoccupation ailleurs dans ce module). No-op (avec toast d'explication) si aucun bracket résolu n'est en mémoire. */
function openPvpBracketModalIfAny() {
  const y = pvpTournamentState.yesterday;
  const body = document.getElementById('pvp-bracket-modal-body');
  if (!y || y.status !== 'resolved' || !y.bracket || !y.bracket.rounds || !body) { toast('⚠️', 'Aucun bracket à afficher.'); return; }
  body.innerHTML = `
    <div style="font-size:11px;color:var(--cream2);margin-bottom:10px">🥇 Vainqueur : <strong style="color:var(--gold2)">${y.winner_pseudo || '?'}</strong> — ${y.registrant_count} inscrit(s)</div>
    ${y.bracket.rounds.map((round, ri) => `
      <div style="margin-bottom:8px">
        <div style="font-family:'Cinzel',serif;font-size:10px;color:var(--gold);margin-bottom:4px">Round ${ri + 1}</div>
        ${round.map(m => {
          const an = m.a ? m.a.pseudo : '(bye)', bn = m.b ? m.b.pseudo : '(bye)';
          const aWon = m.a && m.a.user_id === m.winner_user_id;
          return `<div style="font-size:10.5px;color:var(--cream2);padding:2px 0">
            <span style="${aWon ? 'color:var(--green2);font-weight:600' : ''}">${an}</span>
            &nbsp;vs&nbsp;
            <span style="${!aWon ? 'color:var(--green2);font-weight:600' : ''}">${bn}</span>
          </div>`;
        }).join('')}
      </div>`).join('')}
  `;
  OM('pvp-bracket-modal');
}
