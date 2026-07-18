// ═══ TUTORIEL DU MENU COMPAGNON ═══════════════════════════════════
// Onglet "Tutoriel" refondu en DIAGRAMME ILLUSTRÉ PLEIN ÉCRAN (2026-07-19, demande explicite :
// "fais un tuto qui prend tout l'écran avec des images qui pointent vers d'autres images avec un
// peu de texte"). On garde les icônes d'onglets comme illustrations (même langage visuel que le
// module, léger et robuste vs. des captures qui se périmeraient) et on montre le FLUX : une boucle
// principale (Éclosion → Collection → Sections → Jeu → Nourrir → …) reliée par des flèches SVG,
// puis les autres onglets en satellites, plus un encart d'astuces. Texte minimal, une phrase/mot
// par nœud. Rendu par renderTutorial() (appelé par ST(11), hatch.js). Tout le texte joueur vient
// de l'i18n (locales/{fr,en}/companions.json, clés companions.tutorial.*) -- rien codé en dur ici.

/** Boucle principale du gameplay : chaque nœud = un onglet, `flow` = verbe de la flèche SORTANTE. */
const TUTORIAL_LOOP = [
  { icon:'🥚', key:'hatch',      flow:'flow1' }, // Éclosion → Collection
  { icon:'📦', key:'collection', flow:'flow2' }, // Collection → Sections
  { icon:'🗺️', key:'sections',   flow:'flow3' }, // Sections → Jeu
  { icon:'🎮', key:'game',       flow:'flow4' }, // Jeu → Nourrir
  { icon:'🍖', key:'feed',       flow:null    }, // Nourrir → (boucle, voir loop_note)
];

/** Les autres onglets, présentés en satellites (hors boucle de farm). */
const TUTORIAL_TOOLS = [
  { icon:'📖', key:'index' },
  { icon:'🌿', key:'hardinage' },
  { icon:'🏆', key:'progression' },
  { icon:'⚔️', key:'ranking' },
  { icon:'🔄', key:'market' },
];

/** Tous les onglets couverts par le tutoriel (boucle + satellites) -- une entrée par onglet. */
const TUTORIAL_STEPS = [...TUTORIAL_LOOP, ...TUTORIAL_TOOLS];

/** Petite flèche SVG horizontale (pivote à la verticale en colonne étroite via CSS). */
function tutoArrowSvg(){
  return `<svg width="46" height="14" viewBox="0 0 46 14" aria-hidden="true">
    <line x1="2" y1="7" x2="38" y2="7" stroke="var(--gold-dim)" stroke-width="2"/>
    <path d="M36 2 L44 7 L36 12" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

/** Reconstruit l'onglet Tutoriel : intro + boucle principale illustrée (flèches) + satellites + astuces. */
function renderTutorial(){
  const el = document.getElementById('tutorial-content');
  if(!el) return;
  // COMPANIONS_NS_PREFIX (='companions:', i18n.js) au lieu d'un littéral 'companions:...' : le
  // vérificateur check-missing-translations ne matche i18next.t('domaine:clé') QUE si un guillemet
  // suit immédiatement t( -- passer par la variable évite un faux positif sur la clé dynamique.
  const t = (k) => i18next.t(COMPANIONS_NS_PREFIX+'companions.tutorial.'+k);

  // Boucle principale : nœud (icône + titre + tag court) intercalé avec une flèche + son verbe.
  const loopHtml = TUTORIAL_LOOP.map((s)=>{
    const node = `
      <div class="tuto-node hl">
        <div class="tuto-ico">${s.icon}</div>
        <div class="tuto-nname">${t(s.key+'_title')}</div>
        <div class="tuto-ntag">${t(s.key+'_short')}</div>
      </div>`;
    const arrow = s.flow ? `
      <div class="tuto-arrow">
        <span class="lbl">${t(s.flow)}</span>
        ${tutoArrowSvg()}
      </div>` : '';
    return node + arrow;
  }).join('');

  const tools = TUTORIAL_TOOLS.map((s)=>`
    <div class="tuto-tool">
      <div class="t-ico">${s.icon}</div>
      <div>
        <div class="t-name">${t(s.key+'_title')}</div>
        <div class="t-desc">${t(s.key+'_desc')}</div>
      </div>
    </div>`).join('');

  el.innerHTML = `
    <div class="tuto-wrap">
      <div>
        <div class="tuto-h1">${t('title')}</div>
        <div class="tuto-intro">${t('intro')}</div>
      </div>

      <div class="tuto-block loop">
        <div class="tuto-sec-title">🔁 ${t('loop_title')}</div>
        <div class="tuto-loop">${loopHtml}</div>
        <div class="tuto-loopback"><span class="lp-ico">↻</span>${t('loop_note')}</div>
      </div>

      <div class="tuto-block">
        <div class="tuto-sec-title">🧭 ${t('tools_title')}</div>
        <div class="tuto-tools">${tools}</div>
      </div>

      <div class="tuto-tips">
        <div class="tp-title">💡 ${t('tips_title')}</div>
        <div class="tp-body">${t('tips_body')}</div>
      </div>
    </div>`;
}
