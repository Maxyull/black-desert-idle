// ==================== MODAL DE RECONNEXION (React) ====================
// 2e fichier du projet à utiliser React (React.createElement pur, sans JSX ni bundler -- voir
// CLAUDE.md §7, exception documentée pour ce fichier précis, même famille que
// src/combat/boss-wheel-react.js). Port de la maquette fournie par l'utilisateur
// (reconnect-modal.jsx, React/JSX/Tailwind/lucide-react) vers ce projet : Tailwind retiré (styles
// inline, comme boss-wheel-react.js), lucide-react retiré (emoji, convention déjà utilisée partout
// dans ce projet -- admin-panel.js, notifications-quests.js...), plafond d'AFK retiré (demande
// explicite : "enleve la limite de temps afk"), boutons de démo skeleton/erreur retirés (notes de
// l'auteur : "à retirer en prod").
//
// Remplace showResetNotice() comme mécanisme d'affichage du résumé "pendant ton absence"
// (showAwayLootSummaryIfAny, core/game-core.js) -- garde le même déclencheur (visibilitychange).
// React/ReactDOM UMD déjà chargés en <head> (index.dev.html, exception boss-wheel-react.js) --
// réutilisés tels quels, aucun 2e chargement CDN.

const RECONNECT_V = {
  bg: "#080810", s1: "#10101e", s2: "#181828", s3: "#202038",
  border: "#2a2a44", border2: "#3a3a58",
  gold: "#c8a96e", gold2: "#e8c880", goldDim: "#5a4820",
  blue: "#6a8fb0", blue2: "#90b8d8", green: "#44b060", green2: "#70d890",
  red: "#c04040", red2: "#e06060",
  cream: "#ddd0b8", cream2: "#9a8e78", cream3: "#585040",
};

const RC_CINZEL = { fontFamily: "'Cinzel', serif" };
const RC_INTER = { fontFamily: "'Inter', sans-serif" };
const RC_MONO = { fontFamily: "'JetBrains Mono', monospace" };
const h = React.createElement;

/** Hook React — anime un compteur de 0 vers `target` (easing cubique) sur `durationMs`. @param {number} target @param {number} durationMs. @returns {number} valeur animée courante. */
function rcCountUp(target, durationMs) {
  const [value, setValue] = React.useState(0);
  React.useEffect(() => {
    let start = null, raf;
    const step = (ts) => {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / (durationMs || 1400), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

/** Composant React — barre de progression de niveau (avant/après), % et niveau animés via rcCountUp. */
function RcLevelBar(p) {
  const animatedPercent = rcCountUp(p.percent, 1100);
  const animatedLevel = rcCountUp(p.level, 700);
  const [barWidth, setBarWidth] = React.useState(0);
  React.useEffect(() => {
    const t = setTimeout(() => setBarWidth(p.percent), 80 + (p.delay || 0));
    return () => clearTimeout(t);
  }, [p.percent, p.delay]);
  return h('div', { style: { flex: 1, minWidth: 0 } },
    h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 } },
      h('span', { style: { ...RC_INTER, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: RECONNECT_V.cream3 } }, p.label),
      h('span', { style: { ...RC_MONO, fontSize: 11, color: p.active ? RECONNECT_V.gold2 : RECONNECT_V.cream2 } }, animatedPercent + '%')),
    h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 } },
      h('span', { style: { ...RC_INTER, fontSize: 9, color: RECONNECT_V.cream3 } }, 'Niv.'),
      h('span', { style: { ...RC_CINZEL, fontSize: 16, lineHeight: 1, fontWeight: 600, color: p.active ? RECONNECT_V.gold : RECONNECT_V.cream, fontVariantNumeric: 'tabular-nums' } }, animatedLevel),
      p.active && p.delta > 0 ? h('span', { style: { ...RC_MONO, fontSize: 9, padding: '0 4px', borderRadius: 3, color: RECONNECT_V.bg, background: RECONNECT_V.gold2 } }, '+' + p.delta) : null),
    h('div', { style: { height: 3, borderRadius: 999, overflow: 'hidden', background: RECONNECT_V.border } },
      h('div', { style: { height: '100%', borderRadius: 999, width: barWidth + '%', background: p.active ? `linear-gradient(90deg, ${RECONNECT_V.goldDim}, ${RECONNECT_V.gold})` : RECONNECT_V.border2, transition: 'width 1.1s cubic-bezier(0.16,1,0.3,1)' } })));
}

/** Composant React — ligne "état vide" (bordure pointillée), texte via p.text. */
function RcEmptyRow(p) {
  return h('div', { style: { borderRadius: 7, padding: '12px', textAlign: 'center', background: RECONNECT_V.s1, border: `1px dashed ${RECONNECT_V.border}` } },
    h('p', { style: { ...RC_INTER, fontSize: 11, color: RECONNECT_V.cream3 } }, p.text));
}

// tiers = les 4 paliers de zone déjà définis par le jeu (GEAR_TIERS grade/color), pas des tiers
// inventés -- cohérent avec le reste du projet (zoneIdx -> grey/white/green/blue).
/** @param {string} grade. @returns {string} label localisé du palier de zone (GEAR_TIERS), ou grade tel quel si introuvable. */
function rcGearGradeLabel(grade) {
  const t = (typeof GEAR_TIERS !== 'undefined' ? GEAR_TIERS : []).find(g => g.grade === grade);
  return t ? (t.label[LANG] || t.label.fr) : grade;
}
/** @param {string} grade. @returns {string} couleur du palier de zone (GEAR_TIERS), repli neutre si introuvable. */
function rcGearGradeColor(grade) {
  const t = (typeof GEAR_TIERS !== 'undefined' ? GEAR_TIERS : []).find(g => g.grade === grade);
  return t ? t.color : RECONNECT_V.cream2;
}

/** Composant React racine du modal "Bon retour" (progression niveau/silver/XP animée, objets ramassés, historique AFK filtrable par palier). */
function ReconnectModal(props) {
  const d = props.data;
  const [open, setOpen] = React.useState(true);
  const [tierFilter, setTierFilter] = React.useState('Tous');
  const silverCount = rcCountUp(d.silver, 1400);
  const xpCount = rcCountUp(d.xp, 1100);
  const leveledUp = d.levelNow > d.levelBefore;
  const grades = (typeof GEAR_TIERS !== 'undefined' ? GEAR_TIERS : []).map(g => g.grade);
  const filteredHistory = tierFilter === 'Tous' ? d.history : d.history.filter(x => x.gearGrade === tierFilter);

  if (!open) return null;

  // bug corrigé (2026-07-10, rapporté explicitement : "modal de retour invisible") : le wrapper
  // n'avait ni overflowY ni alignItems:'flex-start' -- avec un contenu plus haut que le viewport
  // (fréquent : progression de niveau + 3 stats + objets + historique + bouton), align-items:center
  // sans scroll centrait la carte en la faisant déborder DES DEUX côtés du conteneur fixed (inset:0,
  // donc borné à la fenêtre) SANS aucun moyen d'atteindre le haut (en-tête/titre "Bon retour"/bouton
  // fermer) ni le bas (bouton "Récupérer le butin") -- rendait le modal effectivement invisible/
  // inutilisable dès que la fenêtre était plus courte que le contenu. overflowY:'auto' +
  // alignItems:'flex-start' (comme le Compendium, compendium-react.js) corrige ça : le contenu
  // démarre en haut et devient scrollable plutôt que clippé sans recours.
  return h('div', { style: { position: 'fixed', inset: 0, zIndex: 970, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '30px 16px', overflowY: 'auto', background: 'rgba(4,4,8,.72)' } },
    h('style', null, `
      @keyframes rcRiseIn { from { opacity:0; transform:translateY(10px);} to { opacity:1; transform:translateY(0);} }
      @keyframes rcFadeSlide { from { opacity:0; transform:translateY(6px);} to { opacity:1; transform:translateY(0);} }
      @keyframes rcPulseDot { 0%,100% { opacity:1;} 50% { opacity:.35;} }
      @keyframes rcLevelGlow { 0%,100% { opacity:.5;} 50% { opacity:1;} }
      .rcFadeSlide { opacity:0; animation: rcFadeSlide .45s ease-out forwards; }
      .rcLevelGlow { animation: rcLevelGlow 1.8s ease-in-out infinite; }
      .rcPulseDot { animation: rcPulseDot 1.4s ease-in-out infinite; }
      .rcRiseIn { animation: rcRiseIn .5s ease-out both; }
      .rcHistScroll::-webkit-scrollbar { width:4px; }
      .rcHistScroll::-webkit-scrollbar-thumb { background:${RECONNECT_V.border}; border-radius:2px; }
      .rcBtn:focus-visible { outline: 2px solid ${RECONNECT_V.gold}; outline-offset: 2px; }
      /* même piège que patch-notes-engage-react.js : la règle globale "button { width:100%;
         margin-top:4px; ... }" (src/styles/styles.css) s'applique aussi ici -- les chips de
         palier (Tous/Mid/End/...) n'avaient pas de width explicite. */
      #reconnectModalRoot button { width: auto; margin: 0; }
    `),
    h('div', { className: 'rcRiseIn', style: { position: 'relative', width: '100%', maxWidth: 520 } },
      h('div', { style: { borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,.6)', overflow: 'hidden', background: RECONNECT_V.s2, border: `1px solid ${RECONNECT_V.border2}` } },
        // ---- En-tête ----
        h('div', { style: { position: 'relative', padding: '28px 28px 24px', borderBottom: `1px solid ${RECONNECT_V.border}` } },
          h('button', { className: 'rcBtn', onClick: () => setOpen(false), 'aria-label': 'Fermer', style: { position: 'absolute', top: 16, right: 16, fontSize: 16, color: RECONNECT_V.cream2, background: 'transparent', border: 'none', cursor: 'pointer' } }, '✕'),
          d.streak > 0 ? h('div', { title: 'Connexions consécutives', style: { position: 'absolute', top: 16, right: 48, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 999, background: RECONNECT_V.s3, border: `1px solid ${RECONNECT_V.border}` } },
            h('span', null, '🔥'),
            h('span', { style: { ...RC_MONO, fontSize: 10, color: RECONNECT_V.cream2, fontVariantNumeric: 'tabular-nums' } }, d.streak + '/' + d.streakGoal)) : null,
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 } },
            h('span', { style: { fontSize: 20 } }, '⏳'),
            h('p', { style: { ...RC_INTER, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: RECONNECT_V.cream3 } }, 'Session hors ligne terminée')),
          h('h1', { style: { ...RC_CINZEL, fontSize: 24, fontWeight: 600, color: RECONNECT_V.gold, margin: '0 0 2px' } }, 'Bon retour'),
          h('p', { style: { ...RC_CINZEL, fontSize: 13, fontWeight: 600, color: RECONNECT_V.cream, margin: '0 0 8px' } }, d.pseudo),
          h('p', { style: { ...RC_INTER, fontSize: 14, color: RECONNECT_V.cream2, margin: 0 } }, 'Absent pendant : ',
            h('span', { style: { color: RECONNECT_V.gold2, fontWeight: 500 } }, d.awayLabel))),

        // ---- Progression de niveau ----
        h('div', { style: { padding: '16px 28px 20px', borderBottom: `1px solid ${RECONNECT_V.border}`, background: RECONNECT_V.s1 } },
          h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 } },
            h('p', { style: { ...RC_INTER, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: RECONNECT_V.cream3 } }, 'Progression de niveau'),
            leveledUp ? h('span', { className: 'rcLevelGlow', style: { ...RC_INTER, fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 999, color: RECONNECT_V.gold2, border: `1px solid ${RECONNECT_V.goldDim}` } }, '⭐ Niveau supérieur !') : null),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
            h(RcLevelBar, { label: 'Avant', level: d.levelBefore, percent: d.percentBefore, active: false, delay: 0 }),
            h('span', { style: { color: RECONNECT_V.cream3, flexShrink: 0, marginTop: 12 } }, '➜'),
            h(RcLevelBar, { label: 'Maintenant', level: d.levelNow, percent: d.percentNow, active: leveledUp, delta: d.levelNow - d.levelBefore, delay: 300 }))),

        // ---- Récap butin ----
        h('div', { style: { padding: '24px 28px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, borderBottom: `1px solid ${RECONNECT_V.border}` } },
          [
            { ic: '🪙', color: RECONNECT_V.gold2, value: silverCount.toLocaleString('fr-FR'), label: 'Silver' },
            { ic: '✨', color: RECONNECT_V.blue2, value: '+' + xpCount.toLocaleString('fr-FR'), label: 'XP' },
            { ic: '📦', color: RECONNECT_V.cream, value: d.items.length, label: 'Objets trouvés' },
          ].map((s, i) => h('div', { key: i, className: 'rcFadeSlide', style: { animationDelay: (i * 90) + 'ms', borderRadius: 7, padding: '12px', textAlign: 'center', background: RECONNECT_V.s3, border: `1px solid ${RECONNECT_V.border}` } },
            h('div', { style: { fontSize: 16, marginBottom: 8 } }, s.ic),
            h('p', { style: { ...RC_MONO, fontSize: 15, color: RECONNECT_V.cream, fontVariantNumeric: 'tabular-nums' } }, s.value),
            h('p', { style: { ...RC_INTER, fontSize: 10, marginTop: 4, letterSpacing: '.02em', textTransform: 'uppercase', color: RECONNECT_V.cream3 } }, s.label)))),

        // ---- Record personnel ----
        h('div', { style: { padding: '16px 28px 4px', display: 'flex', alignItems: 'center', gap: 8 } },
          d.silver > d.personalRecordSilver
            ? h(React.Fragment, null, h('span', null, '🏆'), h('p', { style: { ...RC_INTER, fontSize: 11, color: RECONNECT_V.gold2 } }, 'Nouveau record personnel de Silver !'))
            : h('p', { style: { ...RC_INTER, fontSize: 11, color: RECONNECT_V.cream3 } }, 'Record personnel : ' + d.personalRecordSilver.toLocaleString('fr-FR') + ' Silver')),

        // ---- Objets trouvés ----
        h('div', { style: { padding: '20px 28px 0' } },
          h('p', { style: { ...RC_INTER, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8, color: RECONNECT_V.cream3 } }, `Objets trouvés (${d.items.length})`),
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
            d.items.length > 0 ? d.items.map((it, i) => {
              const isBest = it.name === d.bestDropName;
              return h('div', { key: i, className: 'rcFadeSlide', style: { animationDelay: (i * 80) + 'ms', display: 'flex', alignItems: 'center', gap: 10, borderRadius: 7, padding: '8px 12px', background: isBest ? `linear-gradient(90deg, ${RECONNECT_V.goldDim}22, ${RECONNECT_V.s1})` : RECONNECT_V.s1, border: `1px solid ${isBest ? RECONNECT_V.goldDim : RECONNECT_V.border}`, boxShadow: isBest ? `0 0 8px ${RECONNECT_V.goldDim}55` : 'none' } },
                h('span', { title: it.name, style: { width: 8, height: 8, borderRadius: 999, flexShrink: 0, background: it.color, boxShadow: `0 0 6px ${it.color}` } }),
                h('span', { style: { ...RC_INTER, fontSize: 12, color: RECONNECT_V.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, it.name),
                isBest ? h('span', { style: { flexShrink: 0 } }, '⭐') : null,
                it.qty > 1 ? h('span', { style: { ...RC_MONO, fontSize: 10, marginLeft: 'auto', color: RECONNECT_V.cream3 } }, '×' + it.qty) : null);
            }) : h(RcEmptyRow, { text: 'Aucun objet trouvé pendant cette session — retente ta chance !' }))),

        // ---- Historique ----
        h('div', { style: { padding: '20px 28px 8px' } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' } },
            h('span', { style: { color: RECONNECT_V.cream3 } }, '📜'),
            h('h2', { style: { ...RC_INTER, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: RECONNECT_V.cream3, margin: 0 } }, 'Historique des sessions'),
            // légende des paliers (2026-07-11, "à l'identique" de la maquette : pastille+label à
            // côté du titre "Historique des sessions") -- réutilise rcGearGradeColor/Label, mêmes
            // 4 paliers réels du jeu (grey/white/green/blue) que les chips de filtre juste en dessous.
            h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' } },
              grades.map(g => h('div', { key: g, style: { display: 'flex', alignItems: 'center', gap: 3 } },
                h('span', { style: { width: 6, height: 6, borderRadius: 999, flexShrink: 0, background: rcGearGradeColor(g) } }),
                h('span', { style: { ...RC_INTER, fontSize: 8, color: RECONNECT_V.cream3 } }, rcGearGradeLabel(g)))))),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' } },
            ['Tous', ...grades].map(grade => {
              const on = tierFilter === grade;
              const color = grade === 'Tous' ? RECONNECT_V.cream2 : rcGearGradeColor(grade);
              const label = grade === 'Tous' ? 'Tous' : rcGearGradeLabel(grade);
              return h('button', { key: grade, className: 'rcBtn', onClick: () => setTierFilter(grade), style: { ...RC_CINZEL, fontSize: 9, padding: '4px 8px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${on ? color : RECONNECT_V.border}`, color: on ? color : RECONNECT_V.cream3, background: on ? color + '1a' : 'transparent' } }, label);
            })),
          d.historyError
            ? h('div', { style: { borderRadius: 7, padding: '12px', textAlign: 'center', background: RECONNECT_V.s1, border: `1px solid ${RECONNECT_V.red}55` } },
                h('p', { style: { ...RC_INTER, fontSize: 11, color: RECONNECT_V.red2, marginBottom: 8 } }, "Impossible de charger l'historique."),
                h('button', { className: 'rcBtn', onClick: props.onRetryHistory, style: { ...RC_CINZEL, fontSize: 11, padding: '5px 14px', borderRadius: 5, background: 'transparent', border: `1px solid ${RECONNECT_V.red}`, color: RECONNECT_V.red2, cursor: 'pointer' } }, 'Réessayer'))
            : d.historyLoading
              ? h(RcEmptyRow, { text: 'Chargement…' })
              : h('div', { className: 'rcHistScroll', style: { maxHeight: 220, overflowY: 'auto' } },
                  h('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
                    filteredHistory.length > 0 ? filteredHistory.map((sh, i) => h('div', {
                        key: sh.id, className: 'rcFadeSlide',
                        style: { animationDelay: (i * 60) + 'ms', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 9, padding: '10px 12px', background: RECONNECT_V.s1, border: `1px solid ${sh.current ? RECONNECT_V.gold : RECONNECT_V.border}`, boxShadow: sh.current ? `0 0 10px ${RECONNECT_V.goldDim}55` : 'none' } },
                      h('div', { style: { minWidth: 0 } },
                        h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
                          h('span', { style: { ...RC_INTER, fontSize: 13, fontWeight: 500, color: RECONNECT_V.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, sh.zone),
                          h('span', { style: { ...RC_CINZEL, fontSize: 9, padding: '2px 6px', borderRadius: 4, flexShrink: 0, color: rcGearGradeColor(sh.gearGrade), border: `1px solid ${rcGearGradeColor(sh.gearGrade)}55` } }, rcGearGradeLabel(sh.gearGrade)),
                          sh.current ? h('span', { style: { ...RC_INTER, fontSize: 8, fontWeight: 600, padding: '2px 6px', borderRadius: 999, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, color: RECONNECT_V.bg, background: RECONNECT_V.gold } },
                            h('span', { className: 'rcPulseDot', style: { width: 4, height: 4, borderRadius: 999, background: RECONNECT_V.bg } }), 'ACTUEL') : null),
                        h('p', { style: { ...RC_INTER, fontSize: 11, marginTop: 2, color: RECONNECT_V.cream3 } }, sh.date + ' • ' + sh.duration)),
                      h('div', { style: { textAlign: 'right', flexShrink: 0 } },
                        h('p', { style: { ...RC_MONO, fontSize: 12, color: RECONNECT_V.gold2, fontVariantNumeric: 'tabular-nums' } }, '+' + sh.silver.toLocaleString('fr-FR')),
                        sh.drop ? h('p', { style: { fontSize: 10, marginTop: 2, color: RECONNECT_V.cream2 } }, '⚔ ' + sh.drop) : h('p', { style: { fontSize: 10, marginTop: 2, color: RECONNECT_V.border2 } }, '—'))))
                    : h(RcEmptyRow, { text: d.history.length === 0 ? 'Première connexion — ton historique se remplira au fil de tes sessions.' : 'Aucune session pour ce palier.' })))),

        // ---- Action ----
        h('div', { style: { padding: '16px 28px 28px' } },
          h('button', {
            className: 'rcBtn', onClick: () => setOpen(false),
            style: { ...RC_CINZEL, width: '100%', padding: '12px', borderRadius: 5, fontSize: 14, fontWeight: 600, letterSpacing: '.02em', cursor: 'pointer', background: `linear-gradient(135deg, ${RECONNECT_V.goldDim}, ${RECONNECT_V.gold})`, color: RECONNECT_V.bg, border: `1px solid ${RECONNECT_V.gold}` },
          }, 'Récupérer le butin')))));
}

let reconnectModalRoot = null;
let reconnectModalData = null;
let reconnectModalSession = 0;
/** Re-render synchrone (remount via session incrémentée) du modal de reconnexion depuis reconnectModalData. */
function reconnectModalRender() {
  if (!reconnectModalRoot || !reconnectModalData) return;
  // key=session : force un remount (donc un useState(true) frais pour `open`) à chaque nouvelle
  // absence -- sans ça, React réutilise l'instance précédente et rouvre un modal resté fermé
  // (open=false persisté) si le joueur avait fermé le résumé de la session d'avant.
  // flushSync : force un commit DOM synchrone -- sans ça, React 18 (createRoot) peut batcher le
  // rendu au tick suivant, et un code appelant qui lit le DOM juste après render() (tests, ou tout
  // autre wiring synchrone) verrait encore l'ancien contenu.
  ReactDOM.flushSync(() => {
    reconnectModalRoot.render(h(ReconnectModal, { key: reconnectModalSession, data: reconnectModalData, onRetryHistory: reconnectModalRetryHistory }));
  });
}
// mount/ouverture — appelé par showAwayLootSummaryIfAny() (core/game-core.js) avec toutes les
// données déjà connues localement (silver/xp/items/niveaux, instantané) ; l'historique + le record
// perso arrivent de façon async (Supabase), affichés en "Chargement…" le temps du fetch — jamais
// tout le modal en skeleton, puisque l'essentiel de la donnée est déjà disponible côté client.
/** @param {object} data - silver/xp/items/niveaux déjà connus localement (instantané). Monte le modal "Bon retour" (affiche l'essentiel tout de suite, l'historique/record perso arrive en async). */
function openReconnectModal(data) {
  const container = document.getElementById('reconnectModalRoot');
  if (!container || typeof React === 'undefined' || typeof ReactDOM === 'undefined') return;
  reconnectModalData = Object.assign({ history: [], historyLoading: true, historyError: false, personalRecordSilver: 0 }, data);
  reconnectModalSession++;
  if (!reconnectModalRoot) reconnectModalRoot = ReactDOM.createRoot(container);
  reconnectModalRender();
  reconnectModalLoadHistory();
}
/** Charge l'historique AFK (fetchAfkHistory), met à jour le record perso, re-render — gère l'état loading/erreur. */
async function reconnectModalLoadHistory() {
  if (!reconnectModalData) return;
  reconnectModalData = Object.assign({}, reconnectModalData, { historyLoading: true, historyError: false });
  reconnectModalRender();
  try {
    const rows = typeof fetchAfkHistory === 'function' ? await fetchAfkHistory() : [];
    if (!reconnectModalData) return; // fermé entre-temps
    const history = rows.map(r => ({
      id: r.id,
      date: fmtNotifTime ? fmtNotifTime(new Date(r.ended_at).getTime()) : r.ended_at,
      zone: r.zone_name || '—',
      gearGrade: r.gear_grade || 'grey',
      duration: reconnectDurationLabel(new Date(r.started_at), new Date(r.ended_at)),
      silver: r.silver_gained || 0,
      drop: r.best_drop_name || null,
      current: false,
    }));
    if (history[0]) history[0].current = true;
    const personalRecordSilver = history.reduce((m, x) => Math.max(m, x.silver), 0);
    reconnectModalData = Object.assign({}, reconnectModalData, { history, historyLoading: false, personalRecordSilver: Math.max(personalRecordSilver, reconnectModalData.personalRecordSilver || 0) });
    reconnectModalRender();
  } catch (e) {
    if (!reconnectModalData) return;
    reconnectModalData = Object.assign({}, reconnectModalData, { historyLoading: false, historyError: true });
    reconnectModalRender();
  }
}
/** Relance le chargement de l'historique AFK (bouton "Réessayer" en cas d'erreur). */
function reconnectModalRetryHistory() { reconnectModalLoadHistory(); }
/** @param {Date} start @param {Date} end. @returns {string} durée formatée ("Xh YYmin" ou "Ymin", minimum 1min). */
function reconnectDurationLabel(start, end) {
  const mins = Math.max(1, Math.round((end - start) / 60000));
  const h2 = Math.floor(mins / 60), m = mins % 60;
  return h2 > 0 ? `${h2}h ${String(m).padStart(2, '0')}min` : `${m}min`;
}
