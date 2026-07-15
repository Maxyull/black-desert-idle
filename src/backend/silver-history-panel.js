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
/** Ferme le panneau si le clic est en dehors du panneau ET de la pastille #shRate (qui gère déjà son propre toggle). */
function silverHistOutsideClick(e) {
  const el = $a('silverHistPanel');
  if (!el) return;
  if (el.contains(e.target)) return;
  const pill = $a('shRate');
  if (pill && pill.contains(e.target)) return;
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
      ? `<div class="shpChart">${buildBarSeriesSvg(sessionPoints, green)}</div><div class="shpTotals">${silverHistTotalsLine(sessionPoints, '/min')}</div>`
      : `<div class="shpEmpty">${i18next.t('backend:backend.silver_hist.empty_session')}</div>`) +
    `<div class="shpSection">${i18next.t('backend:backend.silver_hist.day_title')}</div><div class="shpHint">${i18next.t('backend:backend.silver_hist.day_hint')}</div>` +
    `<div class="shpChart" id="shpDayChart"><div class="shpEmpty">${i18next.t('backend:backend.silver_hist.loading')}</div></div>`;
  document.body.appendChild(el);
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

/** Charge le graphique 24 h dans #shpDayChart (RPC my_silver_history) -- best-effort : message hors ligne/erreur à la place du graphique si indisponible, jamais d'exception. */
async function loadSilverHistDayChart() {
  const slot = $a('shpDayChart');
  if (!slot) return;
  if (typeof sb === 'undefined' || !sb || !currentUser || (typeof isOffline !== 'undefined' && isOffline)) {
    slot.innerHTML = `<div class="shpEmpty">${i18next.t('backend:backend.silver_hist.offline')}</div>`;
    return;
  }
  try {
    const { data, error } = await sb.rpc('my_silver_history', { p_hours: SILVER_HIST_DAY_HOURS });
    if (error) throw error;
    if (!$a('shpDayChart')) return; // panneau refermé pendant le chargement
    const points = buildSilverHourPoints(data, Date.now());
    if (!points.some(p => p.value > 0)) { slot.innerHTML = `<div class="shpEmpty">${i18next.t('backend:backend.silver_hist.empty_day')}</div>`; return; }
    const gold = getComputedStyle(document.documentElement).getPropertyValue('--gold2').trim() || '#d4a955';
    slot.innerHTML = buildBarSeriesSvg(points, gold) + `<div class="shpTotals">${silverHistTotalsLine(points, '/h')}</div>`;
  } catch (e) {
    if ($a('shpDayChart')) slot.innerHTML = `<div class="shpEmpty">${i18next.t('backend:backend.silver_hist.error')}</div>`;
  }
}

/** Toggle du panneau (point d'entrée du clic sur la pastille #shRate). */
function toggleSilverHistPanel() {
  if ($a('silverHistPanel')) closeSilverHistPanel();
  else openSilverHistPanel();
}

// câblage au chargement immédiat : #shRate est dans le DOM statique du topbar (index.dev.html),
// bien avant cette balise <script> -- $a suffit, pas besoin d'attendre un DOMContentLoaded.
// hud() ne réécrit que le textContent de la pastille (jamais l'élément lui-même), le listener survit.
(function wireSilverHistPill() {
  const pill = $a('shRate');
  if (!pill) return;
  pill.classList.add('clickable');
  pill.addEventListener('click', toggleSilverHistPanel);
})();
