// ==================== COMPENDIUM (React) ====================
// 3e fichier du projet à utiliser React (React.createElement pur, sans JSX ni bundler -- voir
// CLAUDE.md §7, exception documentée pour ce fichier précis, même famille que
// src/combat/boss-wheel-react.js et src/core/reconnect-modal-react.js). Port de la maquette
// fournie par l'utilisateur (compendium-grimoire.jsx, "garde les couleurs") vers ce projet :
// Tailwind retiré (styles inline), lucide-react retiré (emoji, convention du reste du jeu).
//
// Contrairement à la maquette (données de démo `MONDES`/`ZONES`/`PEN_MASTERY` en dur), ce fichier
// ne lit QUE des données réelles : `ZONE_TIERS` (world/region-tiers-data.js, les "mondes" du jeu,
// avec leur vrai flag `locked`), `GEAR_TIERS` (paliers de stuff), `ZONES`, `BOSS_ROSTER`,
// `S.penMastery`/`S.enhPeakByName`/`S.bossesKilled`, et les fonctions déjà existantes
// (compendiumZoneCount, compendiumBossCount, compendiumPenCount, penMasteryItemList, zoneFullyCollected,
// zoneItemNames, compendiumItemDone, travelTo, floatTxt) -- remplace `openCompendium()`/
// `renderCompendiumHtml()` (progression/notifications-quests.js) comme point d'entrée UI.
//
// IMPORTANT : la maquette inventait un bonus de stat par "maîtrise de set" (masteriser un slot sur
// tous les paliers => +1% dégâts/esquive/vitesse). Ce bonus n'existe PAS dans le vrai jeu -- la
// Maîtrise PEN est un suivi de complétion PUR, sans bonus de stat (voir le commentaire existant
// juste au-dessus de penMasteryItemList(), core/game-core.js). Ce fichier ne reproduit donc PAS ce
// bonus fictif : seul le bonus réel (compendiumPct(), +1%/+1%/+1% par zone/boss, PEN exclu) est
// affiché, pour ne jamais montrer une valeur de stat inventée au joueur.

const CMP_V = {
  bg0: '#0d0b08', bg1: '#14110d', bg2: '#1c1710', border: '#221e18', border2: '#3a352a',
  gold: '#c9a227', cream: '#e8dcc0', cream2: '#d8cdb8', muted: '#8a8168', muted2: '#6b6455', muted3: '#5c5645',
};
const CMP_CINZEL = { fontFamily: "'Cinzel', serif" };
const cmpH = React.createElement;

// couleur d'accent par monde -- dérivée de l'icône déjà utilisée par ZONE_TIERS (renderZoneTierTabs,
// core/game-core.js), pas une nouvelle convention : 🟢🔵🟡🟠🔴
const CMP_WORLD_COLOR = { early: '#6b9c6b', mid: '#5c85a8', end: '#c9a227', end2: '#e0935a', end3: '#9c3b3b' };
// aucun champ `world` sur BOSS_ROSTER aujourd'hui (les 2 bosses existants sont tous deux à Velia) --
// mapping explicite ici plutôt que de supposer un champ qui n'existe pas côté data.
const CMP_BOSS_WORLD = { kzarka: 'early', vell: 'early' };

function cmpMastered(val) { return typeof val === 'string' && val.indexOf('PEN') === 0; }

function CmpBadge(props) {
  return cmpH('span', { className: 'cinzelC', style: { display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: props.small ? 8.5 : 9.5, fontWeight: 700, letterSpacing: 1, color: CMP_V.bg0, background: CMP_V.gold, padding: props.small ? '1px 6px' : '2px 8px', borderRadius: 3, textTransform: 'uppercase', ...CMP_CINZEL } }, '✓ ', i18next.t('progression:progression.compendium_react.mastered_badge'));
}

function CmpStatPlate(props) {
  return cmpH('div', { style: { background: CMP_V.bg1, border: `1px solid ${CMP_V.border}`, borderTop: `2px solid ${props.accent}`, borderRadius: 4, padding: '10px 8px', textAlign: 'center' } },
    cmpH('div', { style: { fontSize: 9, letterSpacing: 1, color: CMP_V.muted, textTransform: 'uppercase', marginBottom: 4, ...CMP_CINZEL } }, props.icon + ' ' + props.label),
    cmpH('div', { style: { fontSize: 17, fontWeight: 700, color: CMP_V.cream, ...CMP_CINZEL } }, props.value));
}

function CmpWorldSelector(props) {
  return cmpH('div', { style: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' } },
    ZONE_TIERS.map(w => {
      const stats = props.getStats(w.id);
      const active = props.activeWorld === w.id;
      const complete = stats.total > 0 && stats.done === stats.total;
      const pct = stats.total > 0 ? Math.round(stats.done / stats.total * 100) : 0;
      const accent = w.locked ? CMP_V.border2 : CMP_WORLD_COLOR[w.id];
      return cmpH('button', {
        key: w.id, className: 'cinzelC cmpBtn', disabled: w.locked, 'aria-pressed': active, 'aria-disabled': w.locked,
        onClick: () => { if (!w.locked) props.setActiveWorld(w.id); },
        style: { display: 'flex', flexDirection: 'column', gap: 4, border: `1px solid ${w.locked ? CMP_V.border : active ? accent : CMP_V.border2}`, background: active && !w.locked ? accent + '1a' : 'transparent', borderRadius: 6, padding: '8px 14px', minWidth: 108, cursor: w.locked ? 'not-allowed' : 'pointer', ...CMP_CINZEL },
      },
        cmpH('span', { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: w.locked ? CMP_V.border2 : active ? accent : CMP_V.muted } },
          w.locked ? '🔒 ' : (w.icon + ' '), w.label[LANG],
          !w.locked && stats.total > 0 ? (complete ? cmpH(CmpBadge, { small: true }) : cmpH('span', { style: { fontSize: 9, opacity: .8 } }, ` ${stats.done}/${stats.total}`)) : null),
        !w.locked ? cmpH('div', { style: { height: 3, background: CMP_V.border, borderRadius: 3, overflow: 'hidden' } },
          cmpH('div', { style: { height: '100%', width: pct + '%', background: accent } })) : null);
    }));
}

function CmpTabButton(props) {
  return cmpH('button', {
    className: 'cinzelC cmpTabBtn', onClick: props.onClick, 'aria-pressed': props.active,
    style: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', borderBottom: props.active ? `2px solid ${CMP_V.gold}` : '2px solid transparent', color: props.active ? CMP_V.gold : CMP_V.muted2, fontSize: 11.5, padding: '8px 4px 10px', cursor: 'pointer', ...CMP_CINZEL },
  }, props.icon + ' ' + props.label);
}

function CompendiumApp(props) {
  const [tab, setTab] = React.useState('zones');
  const [activeWorld, setActiveWorld] = React.useState('early');
  const [query, setQuery] = React.useState('');
  const [sortMode, setSortMode] = React.useState('default');
  const [highlightedItem, setHighlightedItem] = React.useState(null);
  const [teleportMsg, setTeleportMsg] = React.useState(null);

  const zc = compendiumZoneCount(), bc = compendiumBossCount();
  const bossMax = Object.keys(BOSS_ROSTER).length;
  const penItems = penMasteryItemList(), penDone = compendiumPenCount();
  const baseBonus = compendiumPct(); // réel : +1%/+1%/+1% par zone OU boss (jamais par PEN, voir en-tête)
  const grandDone = zc + bc + penDone, grandMax = ZONES.length + bossMax + penItems.length;

  function launchFarm(zi) {
    const wasHere = !atVelia && zi === zoneIdx;
    if (!wasHere) travelTo(zi);
    setTeleportMsg(tr(ZONES[zi].name));
    setTimeout(() => setTeleportMsg(null), 1800);
    props.onClose();
  }

  const zonesForHighlight = React.useMemo(() => {
    if (!highlightedItem) return [];
    const matches = [];
    ZONES.forEach((z, zi) => {
      const tier = gearTierForZone(zi);
      const names = [tr(z.loot.trash.name), tr(tier.material.name), tr(z.loot.jackpot.name), tr(z.loot.craft.name)];
      if (names.indexOf(highlightedItem) !== -1) matches.push(zi);
    });
    return matches;
  }, [highlightedItem]);

  // toutes les zones actuelles appartiennent au monde 'early' (Velia) -- comparaison explicite sur
  // l'id du monde plutôt qu'une supposition, pour qu'un monde ultérieur avec de vraies zones
  // n'ait qu'à étendre cette ligne (ex: un champ `world` sur GEAR_TIERS) sans toucher au reste.
  const zonesInWorld = activeWorld === 'early' ? ZONES.map((z, zi) => zi) : [];

  const filteredZoneIdxs = React.useMemo(() => {
    let idxs = zonesInWorld;
    if (query) {
      const q = query.toLowerCase();
      idxs = idxs.filter(zi => {
        const z = ZONES[zi];
        const names = zoneItemNames(zi).map(n => tr(n).toLowerCase());
        return tr(z.name).toLowerCase().indexOf(q) !== -1 || names.some(n => n.indexOf(q) !== -1);
      });
    }
    return idxs;
  }, [zonesInWorld, query]);

  return cmpH('div', { style: { position: 'fixed', inset: 0, zIndex: 965, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '30px 16px', overflowY: 'auto', background: 'rgba(4,3,2,.78)' } },
    cmpH('style', null, `
      .cinzelC { font-family: 'Cinzel', serif; }
      .cmpBtn:focus-visible, .cmpRow:focus-visible, .cmpItemChip:focus-visible, .cmpTabBtn:focus-visible { outline: 2px solid ${CMP_V.gold}; outline-offset: 2px; }
      @keyframes cmpTeleportIn { from { opacity:0; transform: translate(-50%, 10px); } to { opacity:1; transform: translate(-50%, 0); } }
      .cmpTeleportToast { animation: cmpTeleportIn .3s ease-out; }
      @media (prefers-reduced-motion: reduce) { .cmpTeleportToast { animation: none; } }
      @media (max-width: 480px) { .cmpStatGrid { grid-template-columns: repeat(2, 1fr) !important; } }
    `),
    cmpH('div', {
      style: { maxWidth: 720, width: '100%', background: 'radial-gradient(ellipse at 20% 0%, #1c1712 0%, #0d0b08 45%, #060504 100%)', color: CMP_V.cream2, fontFamily: "'EB Garamond', Georgia, serif", borderRadius: 10, border: `1px solid ${CMP_V.border2}`, padding: '30px 24px 44px', position: 'relative' },
    },
      cmpH('button', { className: 'cmpBtn', onClick: props.onClose, 'aria-label': i18next.t('progression:progression.compendium_react.close_aria'), style: { position: 'absolute', top: 14, right: 16, background: 'none', border: 'none', color: CMP_V.muted2, fontSize: 18, cursor: 'pointer' } }, '✕'),

      cmpH('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 } },
        cmpH('span', { style: { fontSize: 20, color: CMP_V.gold } }, '📖'),
        cmpH('div', null,
          cmpH('div', { className: 'cinzelC', style: { fontSize: 10, letterSpacing: 3, color: CMP_V.muted2, textTransform: 'uppercase' } }, 'Black Desert Idle'),
          cmpH('h1', { className: 'cinzelC', style: { fontSize: 22, fontWeight: 700, margin: 0, color: CMP_V.cream } }, i18next.t('progression:progression.compendium_react.title')))),

      cmpH('div', { className: 'cmpStatGrid', style: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 } },
        cmpH(CmpStatPlate, { icon: '📖', label: i18next.t('progression:progression.compendium_react.progress_label'), value: `${zc + bc}/${ZONES.length + bossMax}`, accent: CMP_V.cream }),
        cmpH(CmpStatPlate, { icon: '⚡', label: i18next.t('progression:progression.compendium_react.speed_label'), value: `+${baseBonus}%`, accent: CMP_V.gold }),
        cmpH(CmpStatPlate, { icon: '⚔️', label: i18next.t('progression:progression.compendium_react.dmg_label'), value: `+${baseBonus}%`, accent: CMP_V.gold }),
        cmpH(CmpStatPlate, { icon: '💧', label: i18next.t('progression:progression.compendium_react.dodge_label'), value: `+${baseBonus}%`, accent: CMP_V.gold })),

      cmpH('div', { style: { marginBottom: 14 } },
        cmpH('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: CMP_V.muted2, marginBottom: 4 } },
          cmpH('span', null, i18next.t('progression:progression.compendium_react.overall_progress_label')),
          cmpH('span', null, `${grandDone}/${grandMax}`)),
        cmpH('div', { style: { height: 5, background: CMP_V.border, borderRadius: 3, overflow: 'hidden' } },
          cmpH('div', { style: { height: '100%', width: (grandMax > 0 ? grandDone / grandMax * 100 : 0) + '%', background: CMP_V.gold } }))),

      cmpH('p', { style: { fontSize: 11.5, fontStyle: 'italic', color: CMP_V.muted3, marginBottom: 16, lineHeight: 1.5 } },
        i18next.t('progression:progression.compendium_react.intro_text')),

      tab === 'zones' ? cmpH('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' } },
        cmpH('div', { style: { display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${CMP_V.border2}`, borderRadius: 20, padding: '6px 12px', maxWidth: 260 } },
          cmpH('span', { style: { fontSize: 12, color: CMP_V.muted2 } }, '🔎'),
          cmpH('input', {
            value: query, onChange: e => setQuery(e.target.value), placeholder: i18next.t('progression:progression.compendium_react.search_placeholder'),
            'aria-label': i18next.t('progression:progression.compendium_react.search_aria'),
            style: { background: 'none', border: 'none', outline: 'none', color: CMP_V.cream2, fontSize: 12.5, fontFamily: 'inherit', width: '100%' },
          }),
          query ? cmpH('button', { onClick: () => setQuery(''), 'aria-label': i18next.t('progression:progression.compendium_react.clear_search_aria'), style: { background: 'none', border: 'none', color: CMP_V.muted3, cursor: 'pointer' } }, '✕') : null),
        cmpH('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
          cmpH('span', { style: { fontSize: 10.5, color: CMP_V.muted3 } }, i18next.t('progression:progression.compendium_react.sort_label')),
          [{ id: 'default', label: i18next.t('progression:progression.compendium_react.sort_default') }, { id: 'az', label: i18next.t('progression:progression.compendium_react.sort_az') }, { id: 'progress', label: i18next.t('progression:progression.compendium_react.sort_progress') }].map(opt =>
            cmpH('button', {
              key: opt.id, className: 'cmpBtn', onClick: () => setSortMode(opt.id), 'aria-pressed': sortMode === opt.id,
              style: { fontSize: 10.5, padding: '4px 10px', borderRadius: 20, cursor: 'pointer', border: `1px solid ${sortMode === opt.id ? CMP_V.gold : CMP_V.border2}`, background: sortMode === opt.id ? CMP_V.gold + '22' : 'transparent', color: sortMode === opt.id ? CMP_V.gold : CMP_V.muted2 },
            }, opt.label))) ) : null,

      highlightedItem ? cmpH('div', { style: { background: CMP_V.bg1, border: `1px solid ${CMP_V.gold}44`, borderRadius: 4, padding: '8px 12px', marginBottom: 16, fontSize: 11.5 } },
        cmpH('span', { style: { color: CMP_V.gold } }, highlightedItem),
        cmpH('span', { style: { color: CMP_V.muted } }, ' — ' + i18next.t('progression:progression.compendium_react.available_in_label') + zonesForHighlight.map(zi => tr(ZONES[zi].name)).join(', ')),
        cmpH('button', { onClick: () => setHighlightedItem(null), 'aria-label': i18next.t('progression:progression.compendium_react.clear_highlight_aria'), style: { marginLeft: 8, background: 'none', border: 'none', color: CMP_V.muted3, cursor: 'pointer' } }, '✕')) : null,

      cmpH('div', { style: { display: 'flex', gap: 8, marginBottom: 18, borderBottom: `1px solid ${CMP_V.border}` } },
        cmpH(CmpTabButton, { active: tab === 'zones', onClick: () => setTab('zones'), icon: '🗺️', label: `${i18next.t('progression:progression.compendium_react.tab_zones_label')} (${zc}/${ZONES.length})` }),
        cmpH(CmpTabButton, { active: tab === 'bosses', onClick: () => setTab('bosses'), icon: '💀', label: `World Bosses (${bc}/${bossMax})` }),
        cmpH(CmpTabButton, { active: tab === 'pen', onClick: () => setTab('pen'), icon: '💎', label: `${i18next.t('progression:progression.compendium_react.tab_pen_label')} (${penDone}/${penItems.length})` })),

      tab === 'zones' ? cmpH(CmpZonesTab, {
        activeWorld, setActiveWorld, filteredZoneIdxs, sortMode, highlightedItem, setHighlightedItem, launchFarm,
      }) : tab === 'bosses' ? cmpH(CmpBossesTab, { activeWorld, setActiveWorld }) : cmpH(CmpPenTab, { activeWorld, setActiveWorld }),

      teleportMsg ? cmpH('div', { className: 'cmpTeleportToast', style: { position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)', background: CMP_V.bg1, border: `1px solid ${CMP_V.gold}`, borderRadius: 6, padding: '12px 20px', fontSize: 12, color: CMP_V.cream, zIndex: 980 } },
        i18next.t('progression:progression.compendium_react.teleporting_label'), cmpH('span', { className: 'cinzelC', style: { color: CMP_V.gold, fontWeight: 700 } }, teleportMsg), '...') : null));
}

function CmpZonesTab(props) {
  let idxs = props.filteredZoneIdxs;
  if (props.sortMode === 'az') idxs = [...idxs].sort((a, b) => tr(ZONES[a].name).localeCompare(tr(ZONES[b].name)));
  else if (props.sortMode === 'progress') idxs = [...idxs].sort((a, b) => Number(zoneFullyCollected(b)) - Number(zoneFullyCollected(a)));

  return cmpH('div', null,
    cmpH(CmpWorldSelector, {
      activeWorld: props.activeWorld, setActiveWorld: props.setActiveWorld,
      getStats: worldId => worldId === 'early' ? { done: compendiumZoneCount(), total: ZONES.length } : { done: 0, total: 0 },
    }),
    props.activeWorld !== 'early' ? cmpH('p', { style: { fontSize: 12, fontStyle: 'italic', color: CMP_V.muted3, padding: '16px 0' } }, i18next.t('progression:progression.compendium_react.world_locked_text')) :
    GEAR_TIERS.map(tier => {
      const tierZoneIdxs = tier.zones.filter(zi => idxs.indexOf(zi) !== -1);
      if (tierZoneIdxs.length === 0) return null;
      const done = tierZoneIdxs.filter(zi => zoneFullyCollected(zi)).length;
      return cmpH('div', { key: tier.grade, style: { marginBottom: 22 } },
        cmpH('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 } },
          cmpH('span', { style: { width: 8, height: 8, borderRadius: '50%', background: tier.color } }),
          cmpH('span', { className: 'cinzelC', style: { fontSize: 12, fontWeight: 700, letterSpacing: 1, color: tier.color, textTransform: 'uppercase' } }, tier.label[LANG]),
          done === tierZoneIdxs.length ? cmpH(CmpBadge, { small: true }) : null,
          cmpH('span', { style: { fontSize: 10.5, color: CMP_V.muted3, marginLeft: 'auto' } }, `${done}/${tierZoneIdxs.length}`)),
        // fidèle à la maquette (compendium-grimoire.jsx) : zones EMPILÉES en une seule colonne
        // pleine largeur (une zone = une ligne), objets qui WRAP sur plusieurs lignes si besoin,
        // bouton "Lancer le farm ici" en pilule -- reverti le 2026-07-10 après un premier essai en
        // grille de cartes compactes qui s'éloignait de la maquette fournie ("non rien a voir je
        // veux que ce soit comme la maquette").
        cmpH('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, borderLeft: `2px solid ${tier.color}55`, paddingLeft: 12 } },
          tierZoneIdxs.map(zi => {
            const z = ZONES[zi], names = zoneItemNames(zi), zDone = zoneFullyCollected(zi);
            const isHighlighted = props.highlightedItem && names.some(n => tr(n) === props.highlightedItem);
            return cmpH('div', {
              key: zi, className: 'cmpRow', style: { background: CMP_V.bg1, border: `1px solid ${isHighlighted ? CMP_V.gold : zDone ? tier.color + '44' : CMP_V.border}`, borderRadius: 4, padding: '10px 14px' },
            },
              cmpH('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 } },
                cmpH('span', { style: { color: zDone ? tier.color : CMP_V.muted3 } }, '📖'),
                cmpH('span', { className: 'cinzelC', style: { fontSize: 13, fontWeight: 700, color: zDone ? CMP_V.cream : CMP_V.muted } }, tr(z.name)),
                cmpH('div', { style: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 } },
                  zDone ? cmpH(CmpBadge, { small: true }) : null,
                  cmpH('span', { style: { fontSize: 11, color: zDone ? CMP_V.gold : CMP_V.border2 } }, '+1%'))),
              cmpH('div', { style: { fontSize: 10.5, color: CMP_V.muted, marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 4 } },
                names.map((n, ii) => {
                  const label = tr(n), obtained = compendiumItemDone(n);
                  return cmpH('button', {
                    key: ii, className: 'cmpItemChip', onClick: () => props.setHighlightedItem(props.highlightedItem === label ? null : label),
                    'aria-pressed': props.highlightedItem === label, 'aria-label': i18next.t('progression:progression.compendium_react.see_zones_aria', { item: label }),
                    style: { background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: props.highlightedItem === label ? CMP_V.gold : obtained ? '#6b9c6b' : CMP_V.muted3, textDecoration: 'underline dotted', fontSize: 10.5, fontFamily: 'inherit' },
                  }, (obtained ? '✓ ' : '· ') + label);
                })),
              cmpH('button', {
                className: 'cmpBtn', onClick: () => props.launchFarm(zi),
                style: { fontSize: 10.5, color: CMP_V.gold, background: 'none', border: `1px solid ${CMP_V.gold}44`, borderRadius: 20, padding: '4px 10px', cursor: 'pointer' },
              }, i18next.t('progression:progression.compendium_react.start_farm_button')));
          })));
    }));
}

function CmpBossesTab(props) {
  return cmpH('div', null,
    cmpH(CmpWorldSelector, {
      activeWorld: props.activeWorld, setActiveWorld: props.setActiveWorld,
      getStats: worldId => {
        const ids = Object.keys(BOSS_ROSTER).filter(id => CMP_BOSS_WORLD[id] === worldId);
        return { done: ids.filter(id => !!S.bossesKilled[id]).length, total: ids.length };
      },
    }),
    cmpH('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
      Object.entries(BOSS_ROSTER).filter(([id]) => CMP_BOSS_WORLD[id] === props.activeWorld).map(([id, b]) => {
        const defeated = !!S.bossesKilled[id];
        return cmpH('div', {
          key: id, className: 'cmpRow', role: 'button', tabIndex: 0, 'aria-pressed': defeated,
          'aria-label': `${b.name[LANG]} — ${defeated ? i18next.t('progression:progression.compendium_react.boss_defeated_short') : i18next.t('progression:progression.compendium_react.boss_not_defeated_short')}`,
          style: { display: 'flex', alignItems: 'center', gap: 12, background: CMP_V.bg1, border: `1px solid ${defeated ? CMP_V.gold + '44' : CMP_V.border}`, borderRadius: 4, padding: '12px 14px' },
        },
          cmpH('span', { style: { fontSize: 20, color: defeated ? CMP_V.gold : CMP_V.muted3 } }, b.icon),
          cmpH('div', null,
            cmpH('div', { className: 'cinzelC', style: { fontSize: 13, fontWeight: 700, color: defeated ? CMP_V.cream : CMP_V.muted } }, b.name[LANG]),
            cmpH('div', { style: { fontSize: 10.5, color: CMP_V.muted3 } }, defeated ? i18next.t('progression:progression.compendium_react.boss_defeated_full') : i18next.t('progression:progression.compendium_react.boss_not_defeated_full'))),
          cmpH('div', { style: { marginLeft: 'auto' } }, defeated
            ? cmpH('span', { style: { fontSize: 11, color: CMP_V.gold, display: 'flex', alignItems: 'center', gap: 3 } }, '+1% ✓')
            : cmpH('span', { style: { color: CMP_V.muted3 } }, '🔒')));
      })));
}

function CmpPenTab(props) {
  return cmpH('div', null,
    cmpH('div', { style: { marginBottom: 18, background: CMP_V.bg1, border: `1px solid ${CMP_V.border}`, borderRadius: 4, padding: '10px 14px', fontSize: 10.5, color: CMP_V.muted3, fontStyle: 'italic' } },
      i18next.t('progression:progression.compendium_react.pen_hint_text')),
    cmpH(CmpWorldSelector, {
      activeWorld: props.activeWorld, setActiveWorld: props.setActiveWorld,
      getStats: worldId => {
        if (worldId !== 'early') return { done: 0, total: 0 };
        const items = penMasteryItemList();
        return { done: items.filter(e => S.penMastery[e.name]).length, total: items.length };
      },
    }),
    props.activeWorld !== 'early' ? cmpH('p', { style: { fontSize: 12, fontStyle: 'italic', color: CMP_V.muted3, padding: '16px 0' } }, i18next.t('progression:progression.compendium_react.no_gear_tier_text')) :
    GEAR_TIERS.map(tier => {
      const tierItems = penMasteryItemList().filter(e => e.grade === tier.grade);
      const tierDone = tierItems.filter(e => S.penMastery[e.name]).length;
      return cmpH('div', { key: tier.grade, style: { marginBottom: 22 } },
        cmpH('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 } },
          cmpH('span', { style: { width: 8, height: 8, borderRadius: '50%', background: tier.color } }),
          cmpH('span', { className: 'cinzelC', style: { fontSize: 12, fontWeight: 700, letterSpacing: 1, color: tier.color, textTransform: 'uppercase' } }, tier.label[LANG]),
          tierDone === tierItems.length ? cmpH(CmpBadge, { small: true }) : null,
          cmpH('span', { style: { fontSize: 10.5, color: CMP_V.muted3, marginLeft: 'auto' } }, `${tierDone}/${tierItems.length} ${i18next.t('progression:progression.compendium_react.at_pen_label')}`)),
        cmpH('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 } },
          tierItems.map(entry => {
            const mastered = !!S.penMastery[entry.name];
            const peak = (S.enhPeakByName && S.enhPeakByName[entry.name]) || 0;
            const owned = mastered || peak > 0;
            const label = mastered ? 'PEN (V)' : (peak > 0 ? ENH_NAMES[peak] : '—');
            return cmpH('div', {
              key: entry.name, title: tr(entry.name), style: { position: 'relative', background: mastered ? CMP_V.bg2 : CMP_V.bg1, border: `1px solid ${mastered ? CMP_V.gold : owned ? tier.color + '44' : CMP_V.border}`, borderRadius: 4, padding: '8px 10px', textAlign: 'center' },
            },
              mastered ? cmpH('span', { style: { position: 'absolute', top: 4, right: 4, fontSize: 9, color: CMP_V.gold } }, '✓') : null,
              cmpH('div', { style: { fontSize: 10, color: CMP_V.muted2, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, tr(entry.name)),
              cmpH('div', { className: 'cinzelC', style: { fontSize: 12.5, fontWeight: 700, color: mastered ? CMP_V.gold : owned ? '#9c927c' : CMP_V.border2 } }, label),
              owned && !mastered ? cmpH('div', { style: { fontSize: 8.5, color: CMP_V.muted3, marginTop: 2, fontStyle: 'italic' } }, i18next.t('progression:progression.compendium_react.in_progress_label')) : null);
          }))); }));
}

let cmpRoot = null;
let cmpSession = 0;
function cmpRender() {
  if (!cmpRoot) return;
  ReactDOM.flushSync(() => {
    cmpRoot.render(cmpH(CompendiumApp, { key: cmpSession, onClose: closeCompendiumReact }));
  });
}
function openCompendiumReact() {
  const container = document.getElementById('compendiumModalRoot');
  if (!container || typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
    if (typeof openCompendium === 'function') openCompendium(); // repli sur l'ancienne modale
    return;
  }
  cmpSession++;
  if (!cmpRoot) cmpRoot = ReactDOM.createRoot(container);
  cmpRender();
}
function closeCompendiumReact() {
  // flushSync : même raison que cmpRender() -- un test ou un appelant synchrone qui lit le DOM
  // juste après l'appel doit voir le démontage effectif, pas un rendu React 18 encore batché.
  if (cmpRoot) ReactDOM.flushSync(() => cmpRoot.render(null));
}
