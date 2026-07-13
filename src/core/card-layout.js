// Disposition des cartes du dashboard Zone (#panel) : glisser-déposer + imbrication en onglets.
// Mockup validé par l'utilisateur le 2026-07-13 (voir CLAUDE.md §13 pour l'esprit "mockup avant
// tout changement", généralisé à toute feature). Vanilla JS, pas de librairie de drag & drop
// (CLAUDE.md §7). Préférence d'AFFICHAGE, pas de progression -- persistée en localStorage,
// jamais dans S/getSaveState().
//
// Modèle : #panel contient toujours les 6 cartes en DOM (mêmes ids fixes, jamais clonées/recréées
// -- seulement déplacées avec appendChild pour ne jamais interrompre les fonctions qui les
// peuplent, ex: renderStatsPane()/buildZoneList()/renderInventory()/... continuent de cibler le
// même id, peu importe où le conteneur physique se trouve après un glisser-déposer).
//
// État logique (voir sanitizeCardLayoutState) :
//   { order: [idsAuNiveauTopLevel...], groups: { hostId: [guestId,...] }, active: { hostId: tabId } }
// Un "hostId" est l'id d'une carte qui a reçu au moins un "guest" par glisser-déposer -- son
// propre h3 est alors masqué au profit d'une barre d'onglets (.cardTabBar) qui liste host + guests.

const CARD_LAYOUT_IDS = ['statsCard', 'zonesCard', 'lootCard', 'equipCard', 'invCard', 'optCard'];
const CARD_LAYOUT_STORAGE_KEY = 'velia-idle-card-layout';

/** Disposition par défaut : les 6 cartes séparées, dans leur ordre HTML d'origine. */
function cardLayoutDefaultState() {
  return { order: CARD_LAYOUT_IDS.slice(), groups: {}, active: {} };
}

/**
 * Valide/nettoie un état de disposition arbitraire (ex: venu de localStorage, potentiellement
 * corrompu ou référant un id de carte qui n'existe plus). Retourne toujours un état utilisable --
 * la disposition par défaut si quoi que ce soit ne colle pas. Fonction pure, testable sans DOM
 * (voir tests/tests.js, testCardLayoutSanitizeRejectsCorruptState).
 */
function sanitizeCardLayoutState(raw) {
  const fallback = cardLayoutDefaultState();
  if (!raw || typeof raw !== 'object') return fallback;
  const order = Array.isArray(raw.order) ? raw.order.filter(id => CARD_LAYOUT_IDS.includes(id)) : null;
  const groupsRaw = (raw.groups && typeof raw.groups === 'object' && !Array.isArray(raw.groups)) ? raw.groups : {};
  const activeRaw = (raw.active && typeof raw.active === 'object' && !Array.isArray(raw.active)) ? raw.active : {};
  if (!order || order.length !== new Set(order).size) return fallback;

  const groups = {};
  const seenGuests = new Set();
  let ok = true;
  Object.keys(groupsRaw).forEach(hostId => {
    if (!ok) return;
    if (!order.includes(hostId)) { ok = false; return; }
    const guests = groupsRaw[hostId];
    if (!Array.isArray(guests) || !guests.length) { ok = false; return; }
    const cleanGuests = [];
    guests.forEach(gid => {
      if (!CARD_LAYOUT_IDS.includes(gid)) { ok = false; return; }
      if (gid === hostId) { ok = false; return; }
      if (order.includes(gid)) { ok = false; return; } // un guest ne peut pas AUSSI être top-level
      if (seenGuests.has(gid)) { ok = false; return; } // pas de guest dans 2 groupes
      seenGuests.add(gid);
      cleanGuests.push(gid);
    });
    if (cleanGuests.length) groups[hostId] = cleanGuests;
  });
  if (!ok) return fallback;

  // union order + tous les guests doit couvrir EXACTEMENT les 6 cartes, une seule fois chacune.
  const covered = order.concat(Object.values(groups).reduce((acc, g) => acc.concat(g), []));
  if (covered.length !== CARD_LAYOUT_IDS.length) return fallback;
  if (!CARD_LAYOUT_IDS.every(id => covered.includes(id))) return fallback;

  const active = {};
  Object.keys(groups).forEach(hostId => {
    const valid = [hostId].concat(groups[hostId]);
    active[hostId] = valid.includes(activeRaw[hostId]) ? activeRaw[hostId] : hostId;
  });

  return { order, groups, active };
}

function loadCardLayoutState() {
  let raw = null;
  try {
    const stored = localStorage.getItem(CARD_LAYOUT_STORAGE_KEY);
    if (stored) raw = JSON.parse(stored);
  } catch (e) { raw = null; }
  return sanitizeCardLayoutState(raw);
}

function saveCardLayoutState(state) {
  try { localStorage.setItem(CARD_LAYOUT_STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
}

/** Détache un guest précis d'un groupe (croix individuelle à côté de son nom d'onglet -- jamais l'hôte lui-même, qui reste l'ancre du groupe). */
function cardLayoutDetach(state, hostId, tabId) {
  const st = JSON.parse(JSON.stringify(state));
  const group = st.groups[hostId];
  if (!group || !group.length) return st;
  const toDetach = tabId != null ? tabId : group[0];
  if (toDetach === hostId || !group.includes(toDetach)) return st;
  st.groups[hostId] = group.filter(g => g !== toDetach);
  const hostIdx = st.order.indexOf(hostId);
  st.order.splice(hostIdx + 1, 0, toDetach);
  if (st.groups[hostId].length) {
    if (!st.active[hostId] || st.active[hostId] === toDetach) st.active[hostId] = hostId;
  } else {
    delete st.groups[hostId];
    delete st.active[hostId];
  }
  return st;
}

/** Imbrique sourceId comme onglet de targetId (fusionne les guests existants de sourceId, le cas
 *  échéant, pour ne jamais créer d'imbrication à 2 niveaux). */
function cardLayoutNest(state, sourceId, targetId) {
  if (sourceId === targetId) return state;
  if (!CARD_LAYOUT_IDS.includes(sourceId) || !CARD_LAYOUT_IDS.includes(targetId)) return state;
  const st = JSON.parse(JSON.stringify(state));
  if (!st.order.includes(sourceId) || !st.order.includes(targetId)) return state; // seules des cartes top-level se glissent
  const sourceGuests = st.groups[sourceId] ? st.groups[sourceId].slice() : [];
  delete st.groups[sourceId];
  delete st.active[sourceId];
  st.order = st.order.filter(id => id !== sourceId);
  const merged = (st.groups[targetId] || []).concat([sourceId], sourceGuests);
  st.groups[targetId] = Array.from(new Set(merged));
  st.active[targetId] = sourceId;
  return st;
}

/** Échange une carte/groupe top-level avec son voisin immédiat dans order (dir -1 = gauche, +1 = droite) --
 *  alternative aux flèches sans glisser-déposer (2026-07-13, retour utilisateur). No-op en bout de liste. */
function cardLayoutReorder(state, id, dir) {
  if (!state.order.includes(id)) return state;
  const st = JSON.parse(JSON.stringify(state));
  const i = st.order.indexOf(id);
  const j = i + dir;
  if (j < 0 || j >= st.order.length) return st;
  [st.order[i], st.order[j]] = [st.order[j], st.order[i]];
  return st;
}

/** Déplace une carte/groupe top-level juste avant ou après une autre carte top-level dans order --
 *  glisser-déposer ENTRE deux cartes (2026-07-13, distinct de cardLayoutNest qui imbrique EN onglets). */
function cardLayoutReorderTo(state, sourceId, targetId, before) {
  if (sourceId === targetId) return state;
  if (!state.order.includes(sourceId) || !state.order.includes(targetId)) return state;
  const st = JSON.parse(JSON.stringify(state));
  st.order = st.order.filter(id => id !== sourceId);
  let targetIdx = st.order.indexOf(targetId);
  if (!before) targetIdx += 1;
  st.order.splice(targetIdx, 0, sourceId);
  return st;
}

function cardLayoutSetActiveTab(state, hostId, tabId) {
  const group = state.groups[hostId];
  if (!group) return state;
  if (tabId !== hostId && !group.includes(tabId)) return state;
  const st = JSON.parse(JSON.stringify(state));
  st.active[hostId] = tabId;
  return st;
}

/** Récupère le libellé déjà rendu du h3 d'une carte, pour l'afficher dans un onglet. */
function cardLayoutTitleLabel(cardEl) {
  if (!cardEl) return '';
  const h3 = cardEl.querySelector('h3');
  if (!h3) return '';
  if (h3.hasAttribute('data-i18n')) return h3.textContent.trim();
  const inner = h3.querySelector('[data-i18n]');
  return (inner ? inner.textContent : h3.textContent).trim();
}

/** Remet une carte dans son état DOM autonome (retire tabBar/wrapper hérités d'un ancien groupe). */
function cardLayoutResetToStandalone(cardEl) {
  cardEl.classList.remove('cardTabbed', 'cardNested');
  cardEl.style.display = '';
  const tabBar = cardEl.querySelector(':scope > .cardTabBar');
  if (tabBar) tabBar.remove();
  const body = cardEl.querySelector(':scope > .cardHostBody');
  if (body) {
    while (body.firstChild) cardEl.insertBefore(body.firstChild, body);
    body.remove();
  }
  const h3 = cardEl.querySelector(':scope > h3');
  if (h3) {
    const handle = h3.querySelector(':scope > .cardDragHandle');
    if (handle) handle.remove();
    const arrows = h3.querySelector(':scope > .cardMoveArrows');
    if (arrows) arrows.remove();
    const textWrap = h3.querySelector(':scope > .cardTitleText');
    if (textWrap) {
      while (textWrap.firstChild) h3.appendChild(textWrap.firstChild);
      textWrap.remove();
    }
  }
}

/** Boutons ◀▶ pour déplacer une carte/groupe top-level d'une position dans order, sans glisser-déposer
 *  (2026-07-13, retour utilisateur : "passer une carte ou un groupe de cartes d'un côté ou un autre").
 *  Grisé/désactivé en bout de liste plutôt que masqué (repère visuel stable, pas de layout qui saute). */
function cardLayoutBuildMoveArrows(id, isFirst, isLast) {
  const wrap = document.createElement('span');
  wrap.className = 'cardMoveArrows';
  [['-1', '◀', isFirst, 'core.card_layout.move_left'], ['1', '▶', isLast, 'core.card_layout.move_right']].forEach(([dir, glyph, disabled, i18nKey]) => {
    const btn = document.createElement('button');
    btn.className = 'cardMoveBtn';
    btn.dataset.cardMoveId = id;
    btn.dataset.cardMoveDir = dir;
    btn.textContent = glyph;
    btn.disabled = disabled;
    btn.title = (typeof i18next !== 'undefined') ? i18next.t('core:' + i18nKey) : '';
    wrap.appendChild(btn);
  });
  return wrap;
}

function cardLayoutAddHandleToH3(cardEl, isFirst, isLast) {
  const h3 = cardEl.querySelector(':scope > h3');
  if (!h3 || h3.querySelector(':scope > .cardDragHandle')) return;
  // le texte d'origine du titre est déplacé dans son propre span pour pouvoir le tronquer sur
  // 1 ligne (ellipsis) SANS emporter la poignée/les flèches avec lui (2026-07-13, retour
  // utilisateur "le titre de la carte tienne sur 1 ligne").
  const textWrap = document.createElement('span');
  textWrap.className = 'cardTitleText';
  while (h3.firstChild) textWrap.appendChild(h3.firstChild);

  const handle = document.createElement('span');
  handle.className = 'cardDragHandle';
  handle.textContent = '⠿ ';
  handle.title = (typeof i18next !== 'undefined') ? i18next.t('core:core.card_layout.drag_handle') : '';

  h3.appendChild(handle);
  h3.appendChild(textWrap);
  h3.appendChild(cardLayoutBuildMoveArrows(cardEl.id, isFirst, isLast));
}

function cardLayoutBuildTabbedHost(hostEl, hostId, guestIds, activeId, isFirst, isLast) {
  hostEl.classList.add('cardTabbed');

  const tabBar = document.createElement('div');
  tabBar.className = 'cardTabBar';

  const handle = document.createElement('span');
  handle.className = 'cardDragHandle';
  handle.textContent = '⠿';
  handle.title = (typeof i18next !== 'undefined') ? i18next.t('core:core.card_layout.drag_handle') : '';
  tabBar.appendChild(handle);

  [hostId].concat(guestIds).forEach(tabId => {
    const el = document.getElementById(tabId);
    const group = document.createElement('span');
    group.className = 'cardTabGroup';

    const btn = document.createElement('button');
    btn.className = 'cardTabBtn' + (tabId === activeId ? ' active' : '');
    btn.dataset.cardTabHost = hostId;
    btn.dataset.cardTabId = tabId;
    btn.textContent = cardLayoutTitleLabel(el);
    group.appendChild(btn);

    // le nom hôte reste l'ancre du groupe (jamais de croix dessus) -- seuls les invités,
    // détachables individuellement, ont leur propre croix juste à côté de leur nom.
    if (tabId !== hostId) {
      const detachBtn = document.createElement('button');
      detachBtn.className = 'cardDetachBtn';
      detachBtn.dataset.cardDetachHost = hostId;
      detachBtn.dataset.cardDetachTab = tabId;
      detachBtn.textContent = '✕';
      detachBtn.title = (typeof i18next !== 'undefined') ? i18next.t('core:core.card_layout.detach') : '';
      group.appendChild(detachBtn);
    }

    tabBar.appendChild(group);
  });

  tabBar.appendChild(cardLayoutBuildMoveArrows(hostId, isFirst, isLast));

  hostEl.insertBefore(tabBar, hostEl.firstChild);

  const body = document.createElement('div');
  body.className = 'cardHostBody';
  Array.from(hostEl.children).forEach(child => {
    if (child === tabBar) return;
    if (child.tagName === 'H3') return;
    body.appendChild(child);
  });
  hostEl.appendChild(body);
  body.style.display = (activeId === hostId) ? '' : 'none';

  guestIds.forEach(gid => {
    const gEl = document.getElementById(gid);
    if (!gEl) return;
    gEl.classList.add('cardNested');
    gEl.style.display = (gid === activeId) ? '' : 'none';
    hostEl.appendChild(gEl);
  });
}

let cardLayoutState = cardLayoutDefaultState();
let cardLayoutDragSourceId = null;

/** Redessine #panel à partir de l'état logique (source de vérité). Idempotent, peut être rappelée
 *  après chaque mutation (drag/détacher/changement d'onglet) ou au chargement. */
function renderCardLayout(state) {
  const panel = document.getElementById('panel');
  if (!panel) return;
  CARD_LAYOUT_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) cardLayoutResetToStandalone(el);
  });
  const mobile = (typeof isMobileViewport === 'function') ? isMobileViewport() : false;
  state.order.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    panel.appendChild(el);
    const isFirst = i === 0, isLast = i === state.order.length - 1;
    const guests = state.groups[id];
    if (guests && guests.length) {
      cardLayoutBuildTabbedHost(el, id, guests, state.active[id] || id, mobile || isFirst, mobile || isLast);
    } else if (!mobile) {
      cardLayoutAddHandleToH3(el, isFirst, isLast);
    }
    el.draggable = !mobile;
  });
}

function cardLayoutUpdate(mutator) {
  const next = sanitizeCardLayoutState(mutator(cardLayoutState));
  cardLayoutState = next;
  saveCardLayoutState(next);
  renderCardLayout(next);
}

function cardLayoutClearDropTargets() {
  document.querySelectorAll('#panel .card.cardDropTarget, #panel .card.cardDropBefore, #panel .card.cardDropAfter')
    .forEach(el => el.classList.remove('cardDropTarget', 'cardDropBefore', 'cardDropAfter'));
}

/** Zone de dépose sous le curseur pour une carte cible : bords (~28% chaque côté) = déposer ENTRE
 *  deux cartes (réordonne, cardLayoutReorderTo), centre = déposer SUR la carte (imbrique en
 *  onglets, cardLayoutNest) -- 2026-07-13, retour utilisateur "glisser déposer entre 2 cartes". */
function cardLayoutDropZoneFor(cardEl, clientX) {
  const rect = cardEl.getBoundingClientRect();
  const ratio = (clientX - rect.left) / rect.width;
  if (ratio < 0.28) return 'before';
  if (ratio > 0.72) return 'after';
  return 'nest';
}

/** Recharge/rejette l'état selon le seuil mobile courant et redessine -- appelée au démarrage et
 *  au redimensionnement (voir initCardLayout) pour ne jamais laisser une poignée/un drag actif
 *  sous ~1024px, y compris si la fenêtre passe de desktop à mobile en cours de session. */
function cardLayoutSyncViewport() {
  const mobile = (typeof isMobileViewport === 'function') ? isMobileViewport() : false;
  cardLayoutState = mobile ? cardLayoutDefaultState() : loadCardLayoutState();
  renderCardLayout(cardLayoutState);
}

let cardLayoutResizeTimer = null;

/** Point d'entrée : câble le drag & drop + les onglets/détache, restaure la disposition
 *  sauvegardée. Desktop uniquement -- sur mobile le drag HTML5 natif se comporte mal au toucher,
 *  on garde l'ordre par défaut sans poignée visible (voir CLAUDE.md, contrainte responsive).
 *  Les écouteurs sont délégués sur #panel et vérifient isMobileViewport() à chaque interaction
 *  (via renderCardLayout qui ne pose ni draggable ni poignée en dessous du seuil), donc les
 *  attacher une seule fois même s'il faut re-synchroniser au redimensionnement. */
function initCardLayout() {
  const panel = document.getElementById('panel');
  if (!panel) return;
  cardLayoutSyncViewport();
  window.addEventListener('resize', () => {
    clearTimeout(cardLayoutResizeTimer);
    cardLayoutResizeTimer = setTimeout(cardLayoutSyncViewport, 200);
  });

  panel.addEventListener('dragstart', e => {
    const card = e.target.closest && e.target.closest('#panel > .card');
    if (!card) return;
    cardLayoutDragSourceId = card.id;
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', card.id); } catch (err) {}
  });
  panel.addEventListener('dragover', e => {
    const card = e.target.closest && e.target.closest('#panel > .card');
    if (!card || !cardLayoutDragSourceId || card.id === cardLayoutDragSourceId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const zone = cardLayoutDropZoneFor(card, e.clientX);
    cardLayoutClearDropTargets();
    card.classList.add(zone === 'before' ? 'cardDropBefore' : zone === 'after' ? 'cardDropAfter' : 'cardDropTarget');
  });
  panel.addEventListener('dragleave', e => {
    const card = e.target.closest && e.target.closest('#panel > .card');
    if (card && !card.contains(e.relatedTarget)) card.classList.remove('cardDropTarget', 'cardDropBefore', 'cardDropAfter');
  });
  panel.addEventListener('drop', e => {
    const card = e.target.closest && e.target.closest('#panel > .card');
    if (!card || !cardLayoutDragSourceId || card.id === cardLayoutDragSourceId) { cardLayoutClearDropTargets(); cardLayoutDragSourceId = null; return; }
    e.preventDefault();
    const zone = cardLayoutDropZoneFor(card, e.clientX);
    cardLayoutClearDropTargets();
    const sourceId = cardLayoutDragSourceId;
    const targetId = card.id;
    cardLayoutDragSourceId = null;
    if (zone === 'nest') {
      cardLayoutUpdate(st => cardLayoutNest(st, sourceId, targetId));
    } else {
      cardLayoutUpdate(st => cardLayoutReorderTo(st, sourceId, targetId, zone === 'before'));
    }
  });
  panel.addEventListener('dragend', () => { cardLayoutDragSourceId = null; cardLayoutClearDropTargets(); });

  panel.addEventListener('click', e => {
    const tabBtn = e.target.closest && e.target.closest('.cardTabBtn');
    if (tabBtn) {
      const hostId = tabBtn.dataset.cardTabHost, tabId = tabBtn.dataset.cardTabId;
      cardLayoutUpdate(st => cardLayoutSetActiveTab(st, hostId, tabId));
      return;
    }
    const detachBtn = e.target.closest && e.target.closest('.cardDetachBtn');
    if (detachBtn) {
      const hostId = detachBtn.dataset.cardDetachHost, tabId = detachBtn.dataset.cardDetachTab;
      cardLayoutUpdate(st => cardLayoutDetach(st, hostId, tabId));
      return;
    }
    const moveBtn = e.target.closest && e.target.closest('.cardMoveBtn');
    if (moveBtn && !moveBtn.disabled) {
      const id = moveBtn.dataset.cardMoveId, dir = Number(moveBtn.dataset.cardMoveDir);
      cardLayoutUpdate(st => cardLayoutReorder(st, id, dir));
    }
  });
}

initCardLayout();
