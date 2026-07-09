// ==================== ROUE DE RÉCOMPENSE BOSS (React) ====================
// Remplace l'ancienne roue CSS (bwIcon en position:absolute + translate(0,-70px) + conic-gradient)
// le 2026-07-19, demande explicite : "je veux une roue react et que tout soit aligné". Les icônes
// de l'ancienne roue débordaient du cercle visuel (translate(-70px) pour un cercle de rayon ~57px,
// diagnostiqué a posteriori comme la cause du rendu "tordu" signalé) -- reconstruite en SVG avec une
// géométrie calculée (polarToCartesian), plus aucune approximation par superposition de transforms.
//
// SEUL fichier du projet qui utilise React (React.createElement pur, sans JSX ni bundler -- voir
// CLAUDE.md, exception documentée) : React/ReactDOM sont chargés en UMD depuis un CDN figé par SRI
// (index.dev.html, <head>), exactement comme le CDN Supabase déjà en place. Ce fichier reste un
// script classique du même scope global partagé que le reste du jeu -- il lit/écrit des variables
// globales (BOSS_NEAR_MISS_CHANCE, BOSS_NEAR_MISS_MARGIN_DEG, LANG) comme n'importe quel autre
// fichier de src/, seulement il les lit à l'INTÉRIEUR de fonctions (jamais au chargement immédiat),
// donc son ordre de chargement par rapport à boss.js n'a pas besoin d'être strict (voir CLAUDE.md
// section 7) -- il charge après boss.js par lisibilité, pas par nécessité technique.

// nombre de segments de la roue -- purement visuel (ne reflète pas le vrai % de chance, ex: 5% sur
// 12 segments = 1/12 ≈ 8.3% visuel), même convention que l'ancienne roue. Le segment d'index 0 est
// toujours le segment rare (icône/couleur de b.rareLoot).
const BOSS_WHEEL_SEGMENTS = 12;

// coordonnées d'un point sur le cercle, angle en degrés, 0° = haut (12h), sens horaire -- même
// convention que rotate(deg) en CSS, pour que la géométrie et l'animation restent cohérentes.
function wheelPolarToCartesian(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

// chemin SVG d'un secteur (part de camembert) du centre (cx,cy) vers le bord, entre startDeg et
// endDeg -- pure, testable isolément (retourne toujours une chaîne "M...A...Z" bien formée).
function wheelSegmentPath(cx, cy, r, startDeg, endDeg) {
  const p1 = wheelPolarToCartesian(cx, cy, r, startDeg);
  const p2 = wheelPolarToCartesian(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M${cx},${cy} L${p1.x.toFixed(2)},${p1.y.toFixed(2)} A${r},${r} 0 ${largeArc} 1 ${p2.x.toFixed(2)},${p2.y.toFixed(2)} Z`;
}

// angle (0..360°, 0°=haut) où la roue doit s'arrêter -- pure, testable isolément, extraite de
// l'ancienne logique inline de wireBossRewardReveal (boss.js). Le segment rare occupe [0, segDeg[ :
// - gagné -> centre exact du segment rare (segDeg/2)
// - perdu + near-miss -> juste après une des 2 bordures du segment rare, jamais dessus (marginDeg
//   de marge de sécurité, voir BOSS_NEAR_MISS_MARGIN_DEG dans boss.js)
// - perdu, cas général -> point uniforme dans le reste de la roue (hors segment rare)
function wheelLandingDeg({ n = BOSS_WHEEL_SEGMENTS, won, marginDeg = 8, chance = 0, rng = Math.random }) {
  const segDeg = 360 / n;
  if (won) return segDeg / 2;
  if (rng() < chance) {
    // juste AVANT le début (360 - marginDeg, dans le segment précédent) ou juste APRÈS la fin
    // (segDeg + marginDeg) du segment rare -- jamais à l'intérieur de [0, segDeg[, sinon le
    // pointeur semblerait désigner le lot rare alors que la perte est déjà actée (it.won=false).
    const jitter = Math.min(4, marginDeg) * rng();
    return rng() < 0.5 ? (360 - marginDeg - jitter) : (segDeg + marginDeg + jitter);
  }
  return segDeg + rng() * (360 - segDeg);
}

// composant roue -- prend rareLoot/won/instant en props ; `instant` piloté par le parent (boss.js,
// via un nouveau render() sur le même root React) plutôt qu'une ref impérative, pour rester dans
// l'idiome React standard (re-render déclenché par un changement de prop, pas d'API impérative).
function BossWheelReact(props) {
  const rareLoot = props.rareLoot;
  const won = !!props.won;
  const instant = !!props.instant;
  const n = BOSS_WHEEL_SEGMENTS;
  const segDeg = 360 / n;
  const cx = 60, cy = 60, r = 56;

  const [rotation, setRotation] = React.useState(0);
  const spinsRef = React.useRef(null);
  const landingRef = React.useRef(null);

  React.useEffect(() => {
    if (landingRef.current === null) {
      landingRef.current = wheelLandingDeg({
        n, won,
        marginDeg: typeof BOSS_NEAR_MISS_MARGIN_DEG === 'number' ? BOSS_NEAR_MISS_MARGIN_DEG : 8,
        chance: typeof BOSS_NEAR_MISS_CHANCE === 'number' ? BOSS_NEAR_MISS_CHANCE : 0,
      });
      spinsRef.current = instant ? 0 : 5;
    }
    const target = spinsRef.current * 360 - landingRef.current;
    if (instant) {
      setRotation(target);
    } else {
      // 2 rAF imbriqués : laisse le navigateur peindre la position 0 AVANT de fixer la cible,
      // sinon la transition CSS ne s'anime pas (saut direct à la valeur finale sans transition).
      requestAnimationFrame(() => requestAnimationFrame(() => setRotation(target)));
    }
    // eslint n/a ici (pas de bundler) -- dépendances volontairement limitées : won/instant ne
    // doivent déclencher qu'un seul calcul de landingRef (voir garde landingRef.current===null)
  }, [won, instant]);

  const segments = [];
  const icons = [];
  for (let i = 0; i < n; i++) {
    const start = i * segDeg, end = start + segDeg, mid = start + segDeg / 2;
    const isRare = i === 0;
    segments.push(React.createElement('path', {
      key: 'seg' + i,
      d: wheelSegmentPath(cx, cy, r, start, end),
      fill: isRare ? rareLoot.color : '#232128',
      stroke: '#0b0a0e', strokeWidth: 1,
    }));
    const p = wheelPolarToCartesian(cx, cy, r * 0.68, mid);
    icons.push(React.createElement('text', {
      key: 'ic' + i, x: p.x, y: p.y, fontSize: 12, textAnchor: 'middle', dominantBaseline: 'central',
    }, isRare ? rareLoot.icon : '⚫'));
  }

  return React.createElement('div', { className: 'bossWheelWrap' },
    React.createElement('div', { className: 'bossWheelPointer' }, '▼'),
    React.createElement('svg', {
      className: 'bossWheel', viewBox: `0 0 ${cx * 2} ${cy * 2}`,
      style: { transform: `rotate(${rotation}deg)`, transition: instant ? 'none' : undefined },
    },
      React.createElement('circle', { cx, cy, r: r + 2, fill: '#16151a' }),
      React.createElement('g', null, segments),
      React.createElement('g', null, icons),
    ),
  );
}

// un seul React root par conteneur DOM (createRoot ne doit être appelé qu'une fois par élément --
// les re-renders, ex: "Passer" qui passe instant:true, réutilisent le root existant via .render()).
const bossWheelReactRoots = typeof WeakMap === 'function' ? new WeakMap() : null;
function mountBossWheelReact(container, props) {
  if (!container || typeof React === 'undefined' || typeof ReactDOM === 'undefined' || !bossWheelReactRoots) return;
  let root = bossWheelReactRoots.get(container);
  if (!root) {
    root = ReactDOM.createRoot(container);
    bossWheelReactRoots.set(container, root);
  }
  root.render(React.createElement(BossWheelReact, props));
}
