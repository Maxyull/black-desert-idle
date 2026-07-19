// ==================== PANNEAU HISTORIQUE DE SILVER (2026-07-15) ====================
// Demande explicite : "Ajoutons un petit graphique lorsqu'on clique sur silver/min record /h et
// historique de silver" -- un clic sur la pastille #shRate du topbar ouvre un petit panneau avec :
//   1. la moyenne de session en direct + le record à vie (mêmes formules que hud(), game-core.js) ;
//   2. un graphique de la session : silver de trash ramassé par minute sur les 60 dernières
//      minutes (silverMinuteHistory, alimenté par addSilver -- voir pushSilverMinuteSample,
//      core/game-core.js), disponible même hors ligne ;
//   3. l'historique des 24 dernières heures : agrégats horaires du silver_ledger via la RPC
//      my_silver_history (SECURITY DEFINER, lignes du joueur appelant uniquement -- la table
//      elle-même reste en lecture admin-only, voir
//      supabase/migrations/20260722130000_my_silver_history_rpc.sql). Best-effort : hors ligne ou
//      sur échec RPC, un message remplace ce graphique, jamais d'exception (politique CLAUDE.md
//      §11 en ligne + hors ligne).
// Réutilise buildBarSeriesSvg (admin/admin-economy.js, fonction PURE globale) plutôt que
// d'introduire un 2e générateur de graphique -- appel à l'exécution seulement, l'ordre de
// chargement entre ces deux fichiers est sans importance (CLAUDE.md §7).
// Charge APRÈS game-supabase.js (lit sb/currentUser/isOffline au runtime) et après le DOM du
// topbar (#shRate, câblé au chargement immédiat tout en bas de ce fichier).

// fenêtres affichées -- alignées sur SILVER_HIST_WINDOW_MS (60 buckets minute côté client) et sur
// le défaut p_hours:24 de la RPC (borné à 168 côté SQL, un client modifié ne peut pas élargir).
const SILVER_HIST_SESSION_MINUTES = 60;
const SILVER_HIST_DAY_HOURS = 24;

/**
 * Fonction PURE : transforme le buffer de buckets minute (silverMinuteHistory) en série CONTIGUË
 * de SILVER_HIST_SESSION_MINUTES points pour buildBarSeriesSvg -- les minutes sans gain deviennent
 * des points à 0 (un trou de farm doit se VOIR sur le graphique, pas se compresser).
 * @param {{t:number,silver:number}[]} hist - buckets {t: ms epoch arrondi à la minute, silver}.
 * @param {number} now - horodatage ms epoch de référence (Date.now()).
 * @returns {{label:string, value:number}[]} exactement SILVER_HIST_SESSION_MINUTES points, du plus ancien au plus récent.
 */
function buildSilverMinutePoints(hist, now) {
  const nowMin = Math.floor(now / 60000) * 60000;
  const byT = {};
  (hist || []).forEach(b => { byT[b.t] = (byT[b.t] || 0) + b.silver; });
  const points = [];
  for (let i = SILVER_HIST_SESSION_MINUTES - 1; i >= 0; i--) {
    const t = nowMin - i * 60000;
    const d = new Date(t);
    points.push({ label: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'), value: byT[t] || 0 });
  }
  return points;
}

/**
 * Fonction PURE : transforme les lignes de la RPC my_silver_history ({bucket, gained, spent}) en
 * série CONTIGUË de SILVER_HIST_DAY_HOURS points horaires (gains uniquement) pour
 * buildBarSeriesSvg -- même principe de trous à 0 que buildSilverMinutePoints. Lignes hors
 * fenêtre ou malformées ignorées, jamais d'exception.
 * @param {object[]} rows - lignes RPC {bucket: ISO string, gained, spent}.
 * @param {number} now - horodatage ms epoch de référence (Date.now()).
 * @returns {{label:string, value:number}[]} exactement SILVER_HIST_DAY_HOURS points, du plus ancien au plus récent.
 */
function buildSilverHourPoints(rows, now) {
  const nowHour = Math.floor(now / 3600000) * 3600000;
  const byT = {};
  (rows || []).forEach(r => {
    const t = new Date(r.bucket).getTime();
    if (!isFinite(t)) return;
    byT[Math.floor(t / 3600000) * 3600000] = Number(r.gained) || 0;
  });
  const points = [];
  for (let i = SILVER_HIST_DAY_HOURS - 1; i >= 0; i--) {
    const t = nowHour - i * 3600000;
    points.push({ label: String(new Date(t).getHours()).padStart(2, '0') + 'h', value: byT[t] || 0 });
  }
  return points;
}

/**
 * Fonction PURE : reconstruit l'évolution du SOLDE de silver heure par heure à REBOURS depuis le
 * solde actuel (S.silver) et les nets horaires du registre (gained - spent, RPC my_silver_history).
 * Le solde de fin de l'heure courante = solde actuel ; chaque heure plus ancienne retire le net de
 * l'heure qui la suit. Lignes malformées ignorées, jamais d'exception.
 * @param {object[]} rows - lignes RPC {bucket: ISO string, gained, spent}.
 * @param {number} now - horodatage ms epoch de référence (Date.now()).
 * @param {number} currentSilver - solde actuel du joueur (S.silver).
 * @returns {{label:string, value:number}[]} exactement SILVER_HIST_DAY_HOURS points, du plus ancien au plus récent.
 */
function buildSilverBalancePoints(rows, now, currentSilver) {
  const nowHour = Math.floor(now / 3600000) * 3600000;
  const netByT = {};
  (rows || []).forEach(r => {
    const t = new Date(r.bucket).getTime();
    if (!isFinite(t)) return;
    netByT[Math.floor(t / 3600000) * 3600000] = (Number(r.gained) || 0) - (Number(r.spent) || 0);
  });
  const out = new Array(SILVER_HIST_DAY_HOURS);
  let bal = Number(currentSilver) || 0;
  for (let i = SILVER_HIST_DAY_HOURS - 1; i >= 0; i--) {
    const t = nowHour - (SILVER_HIST_DAY_HOURS - 1 - i) * 3600000;
    out[i] = { label: String(new Date(t).getHours()).padStart(2, '0') + 'h', value: bal };
    bal -= netByT[t] || 0;
  }
  return out;
}

/**
 * Fonction PURE : courbe en ligne + aire (mêmes conventions 400x90 que buildBarSeriesSvg,
 * admin-economy.js) pour une série déjà triée chronologiquement -- utilisée pour le SOLDE (des
 * barres n'ont pas de sens pour un solde qui varie peu d'une heure à l'autre). Tableau vide ->
 * juste l'axe, jamais d'exception.
 * @param {{label:string, value:number}[]} points @param {string} color @returns {string} SVG.
 */
function buildLineSeriesSvg(points, color) {
  const w = 400, h = 90, padT = 6, padB = 16, padX = 5;
  const axis = `<line x1="${padX}" y1="${h - padB}" x2="${w - padX}" y2="${h - padB}" stroke="#2c2a33" stroke-width="1"></line>`;
  if (!points || points.length < 2) return `<svg class="admBarSeriesSvg" viewBox="0 0 ${w} ${h}" style="width:100%;max-width:420px;height:90px;display:block">${axis}</svg>`;
  const vals = points.map(p => p.value);
  const min = Math.min(...vals), span = Math.max(1, Math.max(...vals) - min);
  const stepX = (w - 2 * padX) / (points.length - 1);
  const xy = points.map((p, i) => [padX + i * stepX, h - padB - ((p.value - min) / span) * (h - padT - padB)]);
  const poly = xy.map(c => `${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(' ');
  const area = `M${padX},${h - padB} L${poly.split(' ').join(' L')} L${(w - padX).toFixed(1)},${h - padB} Z`;
  return `<svg class="admBarSeriesSvg" viewBox="0 0 ${w} ${h}" style="width:100%;max-width:420px;height:90px;display:block">` +
    `<path d="${area}" fill="${color}" opacity="0.15"></path>` +
    `<polyline points="${poly}" fill="none" stroke="${color}" stroke-width="1.6"></polyline>` +
    axis + `</svg>`;
}

/**
 * Fonction PURE : index du point survolé à partir de l'abscisse en coordonnées viewBox (0-400).
 * Barres : slot plein (floor) ; ligne : point le plus PROCHE (round). Toujours borné à [0, n-1].
 * @param {number} xRel - abscisse souris ramenée au viewBox 400 de large.
 * @param {number} n - nombre de points de la série.
 * @param {boolean} isLine - vrai pour une courbe (buildLineSeriesSvg), faux pour des barres.
 * @returns {number} index dans la série.
 */
function chartIndexFromX(xRel, n, isLine) {
  if (!n || n <= 1) return 0;
  const usable = 390; // 400 - 2*5 de marge, même géométrie que buildBarSeriesSvg/buildLineSeriesSvg
  const raw = isLine ? Math.round((xRel - 5) / usable * (n - 1)) : Math.floor((xRel - 5) / (usable / n));
  return Math.max(0, Math.min(n - 1, raw));
}

/**
 * Câble le survol souris d'un graphique du panneau : petit tooltip "label · valeur" qui suit la
 * souris au-dessus du graphe (demande explicite : "un petit graph ou on peut mettre la souris").
 * @param {Element} container - conteneur .shpChart (position:relative) contenant le <svg>.
 * @param {{label:string, value:number}[]} points - série affichée, même ordre que le SVG.
 * @param {{suffix?:string, isLine?:boolean}} [opts] - suffixe d'unité du tooltip + type de graphe.
 */
function wireChartHover(container, points, opts) {
  opts = opts || {};
  const svg = container && container.querySelector('svg');
  if (!svg || !points || !points.length) return;
  let tip = container.querySelector('.shpTip');
  if (!tip) { tip = document.createElement('div'); tip.className = 'shpTip'; container.appendChild(tip); }
  svg.style.cursor = 'crosshair';
  svg.addEventListener('mousemove', e => {
    const r = svg.getBoundingClientRect();
    if (!r.width) return;
    const xRel = (e.clientX - r.left) / r.width * 400;
    const p = points[chartIndexFromX(xRel, points.length, !!opts.isLine)];
    tip.textContent = p.label + ' · ' + fmt(Math.round(p.value)) + (opts.suffix || '');
    tip.style.display = 'block';
    tip.style.left = Math.max(0, Math.min((e.clientX - r.left) + 10, container.clientWidth - tip.offsetWidth - 2)) + 'px';
  });
  svg.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
}

/** @param {{value:number}[]} points @param {string} perUnitSuffix - suffixe du pic ('/min', '/h'). @returns {string} ligne "Total : X · pic : Y/unité" (clé i18n backend.silver_hist.totals). */
function silverHistTotalsLine(points, perUnitSuffix) {
  const total = points.reduce((a, p) => a + p.value, 0);
  const peak = points.reduce((a, p) => Math.max(a, p.value), 0);
  return i18next.t('backend:backend.silver_hist.totals', { total: fmt(Math.round(total)), peak: fmt(Math.round(peak)) + perUnitSuffix });
}

/** Retire le panneau du DOM et décâble les listeners fermeture (clic extérieur / Échap). */
function closeSilverHistPanel() {
  const el = $a('silverHistPanel');
  if (el) el.remove();
  document.removeEventListener('mousedown', silverHistOutsideClick, true);
  document.removeEventListener('keydown', silverHistEscKey, true);
}
/** Ferme le panneau si le clic est en dehors du panneau ET des pastilles #shRate/#silverPill (qui gèrent déjà leur propre toggle -- sans cette exclusion, le mousedown fermerait puis le click rouvrirait). */
function silverHistOutsideClick(e) {
  const el = $a('silverHistPanel');
  if (!el) return;
  if (el.contains(e.target)) return;
  if ([$a('shRate'), $a('silverPill')].some(pill => pill && pill.contains(e.target))) return;
  closeSilverHistPanel();
}
/** Ferme le panneau sur Échap. */
function silverHistEscKey(e) { if (e.key === 'Escape') closeSilverHistPanel(); }

/**
 * Ouvre le panneau sous la pastille #shRate : moyenne de session + record, graphique de session
 * (immédiat, données locales), puis graphique 24 h (asynchrone, RPC my_silver_history --
 * remplacé par un message hors ligne/erreur si indisponible, jamais d'exception).
 */
function openSilverHistPanel() {
  closeSilverHistPanel();
  const pill = $a('shRate');
  if (!pill) return;
  // mêmes formules que hud() (game-core.js) -- moyenne depuis le chargement, pas une fenêtre glissante
  const mins = (performance.now() - S.startTime) / 60000;
  const tokenGain = S.tokenSilverEarned - (S.tokenSilverEarnedAtLoad || 0);
  const liveRate = mins > .1 ? fmt(Math.round(tokenGain / mins)) : '—';
  const record = S.bestSilverPerHour ? fmt(Math.round(S.bestSilverPerHour)) + '/h' : '—';

  const sessionPoints = buildSilverMinutePoints(silverMinuteHistory, Date.now());
  const sessionHasData = sessionPoints.some(p => p.value > 0);
  const green = getComputedStyle(document.documentElement).getPropertyValue('--green2').trim() || '#6fdc6f';

  const el = document.createElement('div');
  el.id = 'silverHistPanel';
  el.innerHTML =
    `<div class="shpHead"><b>${i18next.t('backend:backend.silver_hist.title')}</b><button class="shpClose" type="button">✕</button></div>` +
    `<div class="shpLive"><span>${i18next.t('backend:backend.silver_hist.live_label')} : <b>${liveRate}</b> silver/min</span>` +
    `<span>${i18next.t('backend:backend.silver_hist.record_label')} : <b>${record}</b></span></div>` +
    `<div class="shpSection">${i18next.t('backend:backend.silver_hist.session_title')}</div><div class="shpHint">${i18next.t('backend:backend.silver_hist.session_hint')}</div>` +
    (sessionHasData
      ? `<div class="shpChart" id="shpSessionChart">${buildBarSeriesSvg(sessionPoints, green)}</div><div class="shpTotals">${silverHistTotalsLine(sessionPoints, '/min')}</div>`
      : `<div class="shpEmpty">${i18next.t('backend:backend.silver_hist.empty_session')}</div>`) +
    `<div class="shpSection">${i18next.t('backend:backend.silver_hist.day_title')}</div><div class="shpHint">${i18next.t('backend:backend.silver_hist.day_hint')}</div>` +
    `<div class="shpChart" id="shpDayChart"><div class="shpEmpty">${i18next.t('backend:backend.silver_hist.loading')}</div></div>` +
    `<div class="shpSection">${i18next.t('backend:backend.silver_hist.balance_title')}</div><div class="shpHint">${i18next.t('backend:backend.silver_hist.balance_hint')}</div>` +
    `<div class="shpChart" id="shpBalanceChart"><div class="shpEmpty">${i18next.t('backend:backend.silver_hist.loading')}</div></div>`;
  document.body.appendChild(el);
  if (sessionHasData) wireChartHover($a('shpSessionChart'), sessionPoints, { suffix: ' silver' });
  // position : sous la pastille, aligné à gauche mais jamais hors écran (même clamp que les
  // popups d'inventory-ui.js) -- en ≤600px le CSS force pleine largeur, ce left est alors ignoré.
  const r = pill.getBoundingClientRect();
  el.style.top = Math.round(r.bottom + 6) + 'px';
  el.style.left = Math.round(Math.max(8, Math.min(r.left, window.innerWidth - el.offsetWidth - 8))) + 'px';
  el.querySelector('.shpClose').onclick = closeSilverHistPanel;
  document.addEventListener('mousedown', silverHistOutsideClick, true);
  document.addEventListener('keydown', silverHistEscKey, true);
  loadSilverHistDayChart();
}

/** Charge les graphiques 24 h dans #shpDayChart (silver gagné/h, barres) et #shpBalanceChart (évolution du solde, courbe) depuis UN SEUL appel à la RPC my_silver_history -- best-effort : message hors ligne/erreur à la place des graphiques si indisponible, jamais d'exception. */
async function loadSilverHistDayChart() {
  const slot = $a('shpDayChart'), balSlot = $a('shpBalanceChart');
  if (!slot) return;
  const showBoth = html => { slot.innerHTML = html; if (balSlot) balSlot.innerHTML = html; };
  if (typeof sb === 'undefined' || !sb || !currentUser || (typeof isOffline !== 'undefined' && isOffline)) {
    showBoth(`<div class="shpEmpty">${i18next.t('backend:backend.silver_hist.offline')}</div>`);
    return;
  }
  try {
    const { data, error } = await sb.rpc('my_silver_history', { p_hours: SILVER_HIST_DAY_HOURS });
    if (error) throw error;
    if (!$a('shpDayChart')) return; // panneau refermé pendant le chargement
    const now = Date.now();
    const points = buildSilverHourPoints(data, now);
    const gold = getComputedStyle(document.documentElement).getPropertyValue('--gold2').trim() || '#d4a955';
    if (!points.some(p => p.value > 0)) slot.innerHTML = `<div class="shpEmpty">${i18next.t('backend:backend.silver_hist.empty_day')}</div>`;
    else {
      slot.innerHTML = buildBarSeriesSvg(points, gold) + `<div class="shpTotals">${silverHistTotalsLine(points, '/h')}</div>`;
      wireChartHover(slot, points, { suffix: ' silver' });
    }
    if (balSlot) {
      const balPoints = buildSilverBalancePoints(data, now, S.silver);
      balSlot.innerHTML = buildLineSeriesSvg(balPoints, gold);
      wireChartHover(balSlot, balPoints, { suffix: ' silver', isLine: true });
    }
  } catch (e) {
    if ($a('shpDayChart')) showBoth(`<div class="shpEmpty">${i18next.t('backend:backend.silver_hist.error')}</div>`);
  }
}

/** Toggle du panneau (point d'entrée du clic sur la pastille #shRate). */
function toggleSilverHistPanel() {
  if ($a('silverHistPanel')) closeSilverHistPanel();
  else openSilverHistPanel();
}

// ==================== RÉPARTITION DU SILVER PAR SOURCE (tooltip) ====================
// 2026-07-19, demande explicite : "silver/min et silver séparés en tooltip, je veux une liste écrite
// des silver avec libellé". La pastille silver TOTAL (#silverPill) montre au survol une liste écrite
// du silver gagné par catégorie (S.silverByCategory, alimenté par addSilver -- game-core.js), tandis
// que la pastille silver/min (#shRate) garde son panneau d'historique (graphique). Les deux sont donc
// désormais SÉPARÉS (avant, les deux ouvraient le même panneau).
const SILVER_CAT_LABELS = {
  loot:            { fr:'🗡️ Butin au sol',  en:'🗡️ Ground loot' },
  sell:            { fr:'💰 Ventes',         en:'💰 Sales' },
  quest:           { fr:'🗒️ Quêtes',         en:'🗒️ Quests' },
  boss:            { fr:'🐍 Boss',           en:'🐍 Bosses' },
  achievement:     { fr:'🏅 Succès',         en:'🏅 Achievements' },
  companion:       { fr:'🐾 Compagnon',      en:'🐾 Companion' },
  potion:          { fr:'🧪 Potions',        en:'🧪 Potions' },
  welcome:         { fr:'🎁 Bienvenue',      en:'🎁 Welcome' },
  offline_catchup: { fr:'💤 Hors ligne',     en:'💤 Offline' },
  admin_test:      { fr:'🛠️ Test admin',     en:'🛠️ Admin test' },
  autre:           { fr:'❓ Autre',          en:'❓ Other' },
};
/** @returns {string} HTML de la liste écrite "silver gagné par source" (triée décroissant + total), depuis S.silverByCategory. */
function buildSilverBreakdownHtml() {
  const en = (typeof LANG !== 'undefined' && LANG === 'en');
  const by = (typeof S !== 'undefined' && S.silverByCategory) || {};
  const entries = Object.entries(by).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const title = en ? 'Silver earned — by source' : 'Silver gagné — par source';
  if (!entries.length) return `<div class="silverBdTitle">${title}</div><div class="silverBdEmpty">${en ? 'No silver earned yet' : 'Aucun silver gagné pour l\'instant'}</div>`;
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const rows = entries.map(([cat, v]) => {
    const l = SILVER_CAT_LABELS[cat];
    const lbl = l ? (en ? l.en : l.fr) : cat;
    const pct = total > 0 ? Math.round(v / total * 100) : 0;
    return `<div class="silverBdRow"><span class="silverBdLbl">${lbl}</span><span class="silverBdVal">${fmt(v)}</span><span class="silverBdPct">${pct}%</span></div>`;
  }).join('');
  return `<div class="silverBdTitle">${title}</div>${rows}<div class="silverBdTotal"><span>Total</span><span>${fmt(total)}</span></div>`;
}
/** Affiche le tooltip de répartition sous la pastille silver. */
function showSilverBreakdownTip() {
  let tip = $a('silverBreakdownTip');
  if (!tip) { tip = document.createElement('div'); tip.id = 'silverBreakdownTip'; document.body.appendChild(tip); }
  tip.innerHTML = buildSilverBreakdownHtml();
  const pill = $a('silverPill'); if (!pill) return;
  const r = pill.getBoundingClientRect();
  tip.style.display = 'block';
  tip.style.left = Math.round(Math.max(6, r.left)) + 'px';
  tip.style.top = Math.round(r.bottom + 6) + 'px';
}
/** Masque le tooltip de répartition. */
function hideSilverBreakdownTip() { const tip = $a('silverBreakdownTip'); if (tip) tip.style.display = 'none'; }

// rétro-catégorisation depuis le ledger (2026-07-19, demande explicite : "rétro-catégorise les gains
// passés depuis le ledger") : le silver_ledger serveur contient TOUT l'historique par catégorie. Au
// chargement, on remplace l'accumulateur local S.silverByCategory par les totaux du ledger (source de
// vérité, y compris les sessions d'avant V490 où l'accumulateur n'existait pas encore). Les gains live
// À VENIR s'ajoutent par-dessus (addSilver). Best-effort : une seule fois par session, jamais bloquant,
// silencieux hors ligne / invité / erreur RPC. Appelé depuis loadCloudSave (game-supabase.js).
let silverByCategoryBackfilled = false;
async function backfillSilverByCategory() {
  if (silverByCategoryBackfilled || !sb || !currentUser || (typeof isGuest === 'function' && isGuest())) return;
  silverByCategoryBackfilled = true;
  try {
    const { data, error } = await sb.rpc('my_silver_by_category');
    if (error || !Array.isArray(data)) return;
    const map = {};
    data.forEach(r => { if (r && r.category && Number(r.gained) > 0) map[r.category] = Number(r.gained); });
    if (typeof S !== 'undefined') S.silverByCategory = map;
  } catch (e) { /* best-effort, la répartition se remplira via les gains live */ }
}

// câblage au chargement immédiat : #shRate/#silverPill sont dans le DOM statique du topbar
// (index.dev.html). hud() ne réécrit que le textContent des pastilles (jamais les éléments eux-mêmes),
// les listeners survivent.
(function wireSilverPills() {
  // silver/min (#shRate) : historique (graphique) au clic -- inchangé
  const rate = $a('shRate');
  if (rate) { rate.classList.add('clickable'); rate.addEventListener('click', toggleSilverHistPanel); }
  // silver TOTAL (#silverPill) : tooltip "répartition par source" (liste écrite) au survol -- SÉPARÉ
  const total = $a('silverPill');
  if (total) {
    total.classList.add('clickable');
    total.addEventListener('mouseenter', showSilverBreakdownTip);
    total.addEventListener('mouseleave', hideSilverBreakdownTip);
  }
})();
