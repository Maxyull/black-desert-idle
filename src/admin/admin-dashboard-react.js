// ============================================================
// Dashboard admin — 5e fichier du projet à utiliser React (React.createElement pur, sans JSX ni
// bundler, même convention que compendium-react.js / patch-notes-react.js / reconnect-modal-react.js).
// Refonte 2026-07-19 d'après bdi-admin-ux.md §1 : le dashboard ne montre plus des données à
// interpréter, il répond à TROIS questions dans cet ordre.
//
//   Q1 — Est-ce que tout va bien ?   bandeau de statut (pire état de system_health)
//   Q2 — Qu'est-ce qui a changé ?    5 KPI, chacun avec son delta vs la période PRÉCÉDENTE
//   Q3 — Qu'est-ce que je dois faire ? liste d'actions, chacune cliquable vers son traitement
//   puis seulement : les graphiques existants (DASHBOARD_WIDGETS), en dessous.
//
// Choix assumé (bdi-admin-monitoring-plan.md impose recharts) : les graphes restent les helpers
// SVG maison. Le projet n'a pas de bundler et vendorise ses libs (cf. three.js) -- ajouter une
// lib de charts par CDN irait contre cette règle, et bdi-admin-ux.md §12 l'exclut explicitement.
// React sert ici à la STRUCTURE et à l'ÉTAT, pas au dessin.
//
// Charge APRÈS admin-panel.js (utilise openAdminSection et le registre) -- voir index.dev.html.
// ============================================================

const admH = React.createElement;

// ---------- helper de delta (bdi-admin-ux.md §5) ----------
// La couleur suit le SENS MÉTIER, pas le signe : plus d'erreurs = rouge même si c'est un "+",
// plus de joueurs = vert. Le silver créé est ambigu -> neutre, c'est le seuil d'alerte qui parle.
/** @param {number} cur @param {number} prev @param {'up-is-good'|'up-is-bad'|'neutral'} direction
 *  @returns {{text:string, tone:'good'|'bad'|'neutral'}} libellé du delta + tonalité métier. */
function deltaBadge(cur, prev, direction) {
  const c = Number(cur || 0), p = Number(prev || 0);
  if (p === 0 && c === 0) return { text: '=', tone: 'neutral' };
  if (p === 0) return { text: '+' + admDashNum(c), tone: direction === 'up-is-bad' ? 'bad' : (direction === 'up-is-good' ? 'good' : 'neutral') };
  const diff = c - p;
  if (diff === 0) return { text: '=', tone: 'neutral' };
  const pct = Math.round((diff / Math.abs(p)) * 100);
  const text = (diff > 0 ? '+' : '') + pct + '%';
  let tone = 'neutral';
  if (direction === 'up-is-good') tone = diff > 0 ? 'good' : 'bad';
  else if (direction === 'up-is-bad') tone = diff > 0 ? 'bad' : 'good';
  return { text, tone };
}
/** @param {number} n @returns {string} nombre abrégé (1,2M / 4,2k) pour tenir dans une tuile KPI. */
function admDashNum(n) {
  const v = Number(n || 0), a = Math.abs(v);
  const loc = LANG === 'fr' ? 'fr-FR' : 'en-US';
  if (a >= 1e6) return (v / 1e6).toLocaleString(loc, { maximumFractionDigits: 1 }) + 'M';
  if (a >= 1e4) return (v / 1e3).toLocaleString(loc, { maximumFractionDigits: 1 }) + 'k';
  return v.toLocaleString(loc);
}
/** @param {string} iso @returns {string} "il y a 2 min" -- fraîcheur, pour ne jamais douter de ce qu'on lit. */
function admDashAgo(iso) {
  if (!iso) return '—';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return i18next.t('admin:admin.dash.ago_seconds', { n: s });
  if (s < 3600) return i18next.t('admin:admin.dash.ago_minutes', { n: Math.round(s / 60) });
  return i18next.t('admin:admin.dash.ago_hours', { n: Math.round(s / 3600) });
}

// ---------- Q1 : bandeau de statut ----------
const ADM_STATUS_RANK = { down: 0, warn: 1, unknown: 2, ok: 3 };
// où mener quand on clique une alerte : chaque clé de check pointe vers sa section de traitement
const ADM_HEALTH_TARGET = {
  client_errors: ['monitoring', 'errors'],
  silver_drift: ['economy', 'silver'],
  db_size: ['system', 'danger'],
};
/** @param {object[]} checks - lignes de admin_health(). @returns {React.Element} bandeau Q1. */
function AdmHealthBanner({ checks, checkedAt }) {
  const bad = (checks || []).filter(c => c.status === 'warn' || c.status === 'down');
  const worst = (checks || []).reduce((w, c) => (ADM_STATUS_RANK[c.status] < ADM_STATUS_RANK[w] ? c.status : w), 'ok');
  const tone = worst === 'down' ? 'crit' : worst === 'warn' ? 'warn' : worst === 'unknown' ? 'muted' : 'good';
  return admH('div', { className: 'admHealthBanner tone-' + tone },
    admH('div', { className: 'admHealthMain' },
      admH('span', { className: 'admHealthDot' }, tone === 'good' ? '🟢' : tone === 'warn' ? '🟠' : tone === 'crit' ? '🔴' : '⚪'),
      admH('span', { className: 'admHealthTitle' },
        bad.length === 0 ? i18next.t('admin:admin.dash.all_normal')
                         : i18next.t('admin:admin.dash.n_problems', { count: bad.length })),
      admH('span', { className: 'admHealthAgo' }, admDashAgo(checkedAt))
    ),
    bad.length > 0 && admH('div', { className: 'admHealthList' },
      bad.map(c => {
        const target = ADM_HEALTH_TARGET[c.key] || (c.key.indexOf('cron_') === 0 ? ['system', 'danger'] : null);
        return admH('button', {
          key: c.key, className: 'admHealthItem ' + (c.status === 'down' ? 'crit' : 'warn'),
          onClick: target ? () => openAdminSection(target[0], target[1]) : undefined,
          disabled: !target,
        }, (c.label || c.key) + (c.message ? ' — ' + c.message : ''));
      })
    )
  );
}

// ---------- Q2 : 5 KPI avec delta ----------
// Cinq, pas six (bdi-admin-ux.md §1) : au-delà, on ne lit plus, on scanne.
// `label` est une FONCTION à clé littérale et non `t('...kpi_' + key)` : une clé i18n construite
// dynamiquement échappe à scripts/check-missing-translations.js, qui ne peut alors plus garantir
// qu'elle existe en fr ET en en (il l'a d'ailleurs refusée). Littéral = vérifiable.
const ADM_KPIS = [
  { key: 'active_players', icon: '🟢', dir: 'up-is-good', label: () => i18next.t('admin:admin.dash.kpi_active_players') },
  { key: 'silver_net',     icon: '🏦', dir: 'neutral',    label: () => i18next.t('admin:admin.dash.kpi_silver_net') },
  { key: 'signups',        icon: '🆕', dir: 'up-is-good', label: () => i18next.t('admin:admin.dash.kpi_signups') },
  { key: 'client_errors',  icon: '🐞', dir: 'up-is-bad',  label: () => i18next.t('admin:admin.dash.kpi_client_errors') },
  { key: 'market_sales',   icon: '🏛️', dir: 'up-is-good', label: () => i18next.t('admin:admin.dash.kpi_market_sales') },
];
/** @param {object} kpis - {metric: {current, previous}}. @returns {React.Element} rangée Q2. */
function AdmKpiRow({ kpis, hours }) {
  return admH('div', { className: 'admKpiRow' },
    ADM_KPIS.map(def => {
      const row = (kpis || {})[def.key] || { current: 0, previous: 0 };
      const d = deltaBadge(row.current, row.previous, def.dir);
      return admH('div', { key: def.key, className: 'admKpiCard' },
        admH('div', { className: 'admKpiLbl' }, def.icon + ' ' + def.label()),
        admH('div', { className: 'admKpiVal' }, admDashNum(row.current)),
        admH('div', { className: 'admKpiDelta tone-' + d.tone }, d.text,
          admH('span', { className: 'admKpiVs' }, i18next.t('admin:admin.dash.vs_previous', { period: adminPeriodLabel() })))
      );
    })
  );
}

// ---------- Q3 : à traiter ----------
/** @param {object[]} actions - {icon,label,cat,id}. @returns {React.Element} liste Q3 (état vide explicite). */
function AdmActionList({ actions }) {
  if (!actions || actions.length === 0) {
    return admH('div', { className: 'admActionsEmpty' }, '✅ ' + i18next.t('admin:admin.dash.nothing_todo'));
  }
  return admH('div', { className: 'admActionsList' },
    actions.map((a, i) => admH('button', {
      key: i, className: 'admActionRow', onClick: () => openAdminSection(a.cat, a.id),
    },
      admH('span', { className: 'admActionLbl' }, a.icon + '  ' + a.label),
      admH('span', { className: 'admActionGo' }, i18next.t('admin:admin.dash.handle') + ' →')
    ))
  );
}

// ---------- racine ----------
let admDashRoot = null;
/** Composant racine du dashboard : charge santé + KPI + actions, puis rend Q1/Q2/Q3. */
function AdmDashboard() {
  const [state, setState] = React.useState({ loading: true, checks: [], kpis: {}, actions: [] });
  const hours = adminPeriodHours();

  const load = React.useCallback(async () => {
    if (!sb) return;
    const [health, kpi, reports] = await Promise.all([
      sb.rpc('admin_health'),
      sb.rpc('admin_dashboard_kpis', { p_hours: hours }),
      sb.rpc('admin_patch_note_pending_reports').catch(() => ({ data: [] })),
    ]);
    const kpis = {};
    (kpi.data || []).forEach(r => { kpis[r.metric] = { current: r.current_value, previous: r.previous_value }; });
    // Q3 se déduit des mêmes données : pas de source séparée à maintenir en plus.
    const actions = [];
    const nReports = (reports && reports.data || []).length;
    if (nReports > 0) actions.push({ icon: '🚩', label: i18next.t('admin:admin.dash.todo_reports', { count: nReports }), cat: 'content', id: 'patchnotesmod' });
    const errs = Number((kpis.client_errors || {}).current || 0);
    if (errs > 0) actions.push({ icon: '🐞', label: i18next.t('admin:admin.dash.todo_errors', { count: errs }), cat: 'monitoring', id: 'errors' });
    (health.data || []).filter(c => c.status === 'down').forEach(c => {
      actions.push({ icon: '🔴', label: (c.label || c.key) + (c.message ? ' — ' + c.message : ''), cat: 'system', id: 'danger' });
    });
    setState({ loading: false, checks: health.data || [], kpis, actions,
               checkedAt: (health.data || []).reduce((m, c) => (!m || c.checked_at > m ? c.checked_at : m), null) });
  }, []);

  React.useEffect(() => { load(); }, [load]);

  if (state.loading) {
    // squelette plutôt qu'un vide : pas de saut de mise en page quand les données arrivent
    return admH('div', { className: 'admDashSkeleton' },
      admH('div', { className: 'admSkelBanner' }),
      admH('div', { className: 'admSkelKpis' }, [0,1,2,3,4].map(i => admH('div', { key: i, className: 'admSkelKpi' })))
    );
  }
  return admH('div', { className: 'admDashV2' },
    admH(AdmHealthBanner, { checks: state.checks, checkedAt: state.checkedAt }),
    admH('div', { className: 'admDashQLabel' }, i18next.t('admin:admin.dash.q2_title', { period: adminPeriodLabel() })),
    admH(AdmKpiRow, { kpis: state.kpis, hours }),
    admH('div', { className: 'admDashQLabel' }, i18next.t('admin:admin.dash.q3_title')),
    admH(AdmActionList, { actions: state.actions }),
    admH('button', { className: 'admDashRefresh', onClick: load }, '⟳ ' + i18next.t('admin:admin.dash.refresh'))
  );
}

/** @param {HTMLElement} el. Monte le dashboard React puis, EN DESSOUS, les graphiques existants
 *  (DASHBOARD_WIDGETS via renderAdminDashboardWidgets) -- un graphe sert à enquêter, pas à
 *  surveiller : la surveillance c'est Q1, le graphe c'est ce qu'on ouvre après. */
function renderAdminDashboardV2(el) {
  if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
    // repli : si React n'a pas chargé, on garde l'ancien dashboard plutôt qu'un écran blanc
    if (typeof renderAdminDashboardWidgets === 'function') return renderAdminDashboardWidgets(el);
    el.innerHTML = `<div class="admHint">React indisponible</div>`;
    return;
  }
  el.innerHTML = '<div id="admDashReact"></div><div id="admDashCharts"></div>';
  admDashRoot = ReactDOM.createRoot(el.querySelector('#admDashReact'));
  admDashRoot.render(admH(AdmDashboard));
  if (typeof renderAdminDashboardWidgets === 'function') renderAdminDashboardWidgets(el.querySelector('#admDashCharts'));
}
