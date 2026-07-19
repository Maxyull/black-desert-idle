// ============================================================
// CHROME DE L'INTERFACE (cote du menu, repli des panneaux, echelle d'UI)
// ============================================================
// Extrait de src/backend/game-supabase.js le 2026-07-22 (audit repo P5 : le fichier avait
// atteint 3 124 lignes, trois fois la limite de decoupe obligatoire de CLAUDE.md, et melangeait
// les reglages d'affichage avec le client Supabase).
//
// DECOUPAGE PAR TRANSPLANTATION, PAS PAR REECRITURE : les lignes sont sorties telles quelles, et
// ce fichier est charge dans index.dev.html EXACTEMENT a la place qu'occupait ce bloc dans
// l'original. Le projet n'a pas de modules ES -- tous les scripts partagent un seul scope global,
// et un `const`/`let` de haut niveau lu au chargement par un fichier suivant explose si l'ordre
// bouge (CLAUDE.md SS6). Preserver l'ordre a l'octet pres est ce qui rend ce decoupage sur.
//
// Aucun rapport avec Supabase : preferences locales (localStorage), zero reseau.

// ---------- position du menu latéral (gauche/droite), persistée ----------
let menuSide = 'left';
try { menuSide = localStorage.getItem('velia-idle-menuside') || 'left'; } catch(e) {}
/** Applique la position du menu latéral (gauche/droite, persistée) au DOM. */
function applyMenuSide() {
  $a('sideMenu').classList.toggle('onRight', menuSide === 'right');
  $a('menuSideThumb').classList.toggle('right', menuSide === 'right');
  document.querySelectorAll('.menuSideOpt').forEach(el => el.classList.toggle('active', el.dataset.side === menuSide));
}
$a('menuSideToggle').onclick = () => {
  menuSide = menuSide === 'left' ? 'right' : 'left';
  try { localStorage.setItem('velia-idle-menuside', menuSide); } catch(e) {}
  applyMenuSide();
};
applyMenuSide();

// ---------- replier/déplier le menu latéral, persisté ----------
let sideMenuCollapsed = isMobileViewport();
try {
  const saved = localStorage.getItem('velia-idle-menu-collapsed');
  if (saved !== null) sideMenuCollapsed = saved === '1'; // préférence explicite du joueur > défaut auto
} catch(e) {}
/** Applique l'état replié/déplié (persisté) du menu latéral au DOM. */
function applyMenuCollapse() {
  $a('sideMenu').classList.toggle('collapsed', sideMenuCollapsed);
  $a('btnCollapseMenu').textContent = sideMenuCollapsed ? '▶' : '◀';
}
$a('btnCollapseMenu').onclick = () => {
  sideMenuCollapsed = !sideMenuCollapsed;
  try { localStorage.setItem('velia-idle-menu-collapsed', sideMenuCollapsed ? '1' : '0'); } catch(e) {}
  applyMenuCollapse();
};
applyMenuCollapse();

// ---------- replier/déplier la colonne de widgets flottants à droite, persisté ----------
// même mécanisme exact que sideMenuCollapsed/#btnCollapseMenu juste au-dessus (2026-07-13,
// demande explicite) -- toggle .collapsed sur #sideRight, .layout:has(#sideRight.collapsed)
// (styles.css) rétrécit la piste de grille correspondante.
let sideRightCollapsed = isMobileViewport();
try {
  const savedRight = localStorage.getItem('velia-idle-right-collapsed');
  if (savedRight !== null) sideRightCollapsed = savedRight === '1';
} catch(e) {}
/** Applique l'état replié/déplié (persisté) de la colonne de widgets droite au DOM. */
function applyRightCollapse() {
  $a('sideRight').classList.toggle('collapsed', sideRightCollapsed);
  // sens de flèche inversé par rapport au bouton gauche (▶ replier / ◀ déplier) -- la colonne
  // est à droite, donc "replier" pousse le contenu vers la droite.
  $a('btnCollapseRight').textContent = sideRightCollapsed ? '◀' : '▶';
}
$a('btnCollapseRight').onclick = () => {
  sideRightCollapsed = !sideRightCollapsed;
  try { localStorage.setItem('velia-idle-right-collapsed', sideRightCollapsed ? '1' : '0'); } catch(e) {}
  applyRightCollapse();
};
applyRightCollapse();

// ---------- taille de l'UI/jeu (Petit/Moyen/Grand), persistée ----------
// mockup validé par l'utilisateur (2026-07-13) : 2 boutons +/- quasi invisibles au repos sur les
// bords de #gameFrame (voir #btnUiScaleDown/#btnUiScaleUp, index.dev.html, styles .uiScaleBtn dans
// styles.css). Le scale s'applique sur #wrap (colonne centrale : #gameFrame + #panel + #bossRoom/
// #minibossRoom) via un simple transform CSS -- ne touche JAMAIS à la résolution interne du canvas
// #cv (1240x440), voir CLAUDE.md règle critique #4 et §14 (ne pas changer la résolution canvas).
const UI_SCALE_LEVELS = ['small', 'medium', 'large'];
const UI_SCALE_FACTORS = { small:.85, medium:1, large:1.15 };

/**
 * Calcule le prochain palier de taille UI à partir du palier courant et d'une direction
 * (+1 = "+", -1 = "-"), clampé aux deux bouts (no-op si déjà à small/large). Fonction pure,
 * isolée pour être testable sans DOM -- voir tests/tests.js.
 */
function nextUiScaleLevel(current, direction) {
  const idx = UI_SCALE_LEVELS.indexOf(current);
  const from = idx === -1 ? UI_SCALE_LEVELS.indexOf('medium') : idx;
  const to = Math.max(0, Math.min(UI_SCALE_LEVELS.length - 1, from + direction));
  return UI_SCALE_LEVELS[to];
}

let uiScaleLevel = 'medium';
try {
  const savedScale = localStorage.getItem('velia-idle-ui-scale');
  if (UI_SCALE_LEVELS.includes(savedScale)) uiScaleLevel = savedScale;
} catch(e) {}
/**
 * Recalcule et pose la variable CSS --ui-center-track sur .layout (#gameLayout), qui pilote la
 * largeur de la piste centrale de la grille 3 colonnes (#sideMenu | #wrap | .side-right, voir
 * `.layout { grid-template-columns:210px var(--ui-center-track,1fr) 300px; }` dans styles.css et
 * ses 3 variantes :has(...collapsed) -- valeur par défaut `1fr` = comportement identique à avant
 * ce correctif tant que la variable n'est pas posée.
 *
 * Pourquoi : #wrap est un item de grille avec width:auto, donc "stretché" par défaut à la taille
 * EXACTE de sa piste -- un simple `zoom` (ou l'ancien `transform:scale()`) sur #wrap ne fait
 * jamais grandir sa largeur RENDUE au-delà de cette piste (vérifié empiriquement : la largeur de
 * #wrap.getBoundingClientRect() ne bougeait pas du tout sous zoom seul, contrairement à la
 * hauteur qui suit normalement le flux de page). Il faut donc faire grandir/rétrécir la piste
 * elle-même, pas seulement son contenu.
 *
 * La largeur "de base" (palier medium) de la piste centrale n'est PAS un nombre fixe : elle
 * dépend de la largeur de vue (fenêtre) ET de l'état replié/déployé de #sideMenu/.side-right
 * (voir :has(#sideMenu.collapsed) etc plus haut dans ce fichier). On la calcule donc en LISANT
 * la largeur réelle courante de #sideMenu et .side-right (qui, eux, ne sont jamais mis à
 * l'échelle -- leur taille reste fiable comme référence) plutôt qu'en la codant en dur.
 *
 * Sur mobile (isMobileViewport(), <=1024px), .layout passe en 1 seule colonne (grid-template-
 * columns:1fr, media query dédiée) qui n'utilise PAS cette variable -- rien à faire, on efface
 * simplement toute valeur posée pour ne rien laisser traîner si la fenêtre est redimensionnée
 * en dessous du seuil pendant qu'un palier non-medium était actif.
 */
function updateUiScaleLayoutTrack() {
  const layout = $a('gameLayout');
  if (!layout) return;
  const factor = UI_SCALE_FACTORS[uiScaleLevel];
  // factor <= 1 (2026-07-19) : NE PAS fixer la piste centrale. Depuis que la sidebar gauche est
  // masquée (menus déplacés dans le header), la grille .layout n'a que 2 colonnes (jeu | droite) avec
  // justify-content:space-between. Rétrécir la piste centrale sous la largeur dispo (échelle "small",
  // factor 0.85) faisait accumuler tout le surplus ENTRE le jeu et la colonne de droite -> "trou béant
  // à droite" (retour joueur). On laisse alors la piste à 1fr (remplit) ; le zoom sur #wrap suffit à
  // réduire le contenu sans créer de trou. On ne fixe la piste QUE pour l'AGRANDIR (factor > 1, "large"),
  // cas où #wrap a réellement besoin de plus de place que la largeur dispo.
  if (factor <= 1 || isMobileViewport()) {
    layout.style.removeProperty('--ui-center-track');
    return;
  }
  const sideMenu = $a('sideMenu'), sideRight = $a('sideRight');
  if (!sideMenu || !sideRight) return;
  const gap = 14; // .layout { gap:14px } -- 2 gaps encadrent la colonne centrale
  const baseCenterWidth = layout.clientWidth - sideMenu.getBoundingClientRect().width
    - sideRight.getBoundingClientRect().width - gap * 2;
  if (baseCenterWidth <= 0) { layout.style.removeProperty('--ui-center-track'); return; }
  layout.style.setProperty('--ui-center-track', `${Math.round(baseCenterWidth * factor)}px`);
}
/**
 * Applique le palier de taille UI courant (persisté) au DOM : CSS `zoom` sur #wrap (PAS
 * transform:scale()) + ajustement de la piste centrale de la grille via
 * updateUiScaleLayoutTrack() (voir sa doc juste au-dessus pour le détail du "pourquoi").
 *
 * Historique du bug (retour utilisateur "l'agrandissement c'est juste en hauteur") : #wrap est
 * un item de la grille 3 colonnes `.layout` (#sideMenu | #wrap | .side-right, voir styles.css)
 * avec width:auto -- sa largeur rendue suivait donc la piste 1fr de la grille, jamais sa propre
 * règle CSS. `transform:scale()` est un pur effet visuel de peinture : il ne déclenche AUCUN
 * reflow, donc la grille ne recalculait jamais la taille de la piste, et le surplus de largeur
 * finissait sous les panneaux latéraux opaques (#sideMenu/.side-right) -- l'agrandissement se
 * voyait seulement en hauteur (poussée normale du flux de page), jamais en largeur (invisible,
 * caché). `zoom` déclenche un vrai reflow (contrairement à transform) : le CONTENU de #wrap se
 * met à l'échelle correctement, mais #wrap restait quand même stretché à sa piste (vérifié
 * empiriquement : la largeur ne bougeait toujours pas d'1px). D'où le 2e volet du correctif :
 * la piste elle-même doit grandir (updateUiScaleLayoutTrack()) pour que #wrap ait de la place où
 * grandir. Vérifié par capture d'écran avant/après + getBoundingClientRect à ~1300px et ~1800px
 * de large (voir Playwright) : la largeur ET la hauteur visibles grandissent bien maintenant,
 * sans être masquées par les colonnes latérales.
 */
function applyUiScale() {
  $a('wrap').style.zoom = UI_SCALE_FACTORS[uiScaleLevel];
  updateUiScaleLayoutTrack();
  $a('btnUiScaleDown').classList.toggle('uiScaleBtnDisabled', uiScaleLevel === UI_SCALE_LEVELS[0]);
  $a('btnUiScaleUp').classList.toggle('uiScaleBtnDisabled', uiScaleLevel === UI_SCALE_LEVELS[UI_SCALE_LEVELS.length - 1]);
}
function setUiScaleLevel(direction) {
  uiScaleLevel = nextUiScaleLevel(uiScaleLevel, direction);
  try { localStorage.setItem('velia-idle-ui-scale', uiScaleLevel); } catch(e) {}
  applyUiScale();
}
// redimensionnement de fenêtre : la piste centrale (voir updateUiScaleLayoutTrack) dépend de la
// largeur de vue courante -- sans ce listener, un palier non-medium posé avant un resize
// (fenêtre agrandie/rétrécie, ou repli #sideMenu/.side-right qui change aussi leur largeur)
// resterait figé sur l'ancienne valeur en px, se désynchronisant de la grille réelle. Même
// pattern que les autres listeners resize existants (voir resizeBossCanvas plus haut,
// syncFarmCardHeights game-core.js) : pas de debounce, ces recalculs sont bon marché.
window.addEventListener('resize', () => { if (uiScaleLevel !== 'medium') updateUiScaleLayoutTrack(); });
$a('btnUiScaleDown').onclick = () => setUiScaleLevel(-1);
$a('btnUiScaleUp').onclick = () => setUiScaleLevel(1);
applyUiScale();

// ═══ DOCK FLOTTANT À DROITE (2026-07-19, demande explicite : "vire la colonne de droite, mets-la
// sous le header au même endroit que les menus zone/boss, en panneaux lockés à droite") ═══
// La colonne de droite (#sideRight) n'est plus une colonne de grille mais un dock fixe ancré à droite,
// masqué par défaut. Chaque bouton de #rightDockBar (barre d'activités) ouvre UN widget à la fois dans
// le dock : Suivi (#questWidget), Temps de jeu (#playtimeWidget), Quêtes suivies (#questTrackerWidget),
// Chat (#chatWidget). Les widgets restent câblés/rendus par id (déplacés, jamais dupliqués) ; on ne fait
// que basculer leur affichage. Re-cliquer le bouton actif referme le dock.
const RIGHT_DOCK_WIDGETS = ['questWidget', 'playtimeWidget', 'questTrackerWidget', 'chatWidget'];
const RIGHT_DOCK_BTN = { questWidget:'dockBtnSuivi', playtimeWidget:'dockBtnPlaytime', questTrackerWidget:'dockBtnQuests', chatWidget:'dockBtnChat' };
/** Met en évidence le bouton de dock actif (ou aucun si btnId null). */
function updateDockBtnActive(btnId) {
  Object.values(RIGHT_DOCK_BTN).forEach(id => { const b = $a(id); if (b) b.classList.toggle('dockBtnActive', id === btnId); });
}
/** @param {string} widgetId - un des RIGHT_DOCK_WIDGETS. Ouvre ce widget dans le dock ancré à droite (masque les autres), ou referme le dock si ce widget est déjà affiché. */
function toggleRightDock(widgetId) {
  const dock = $a('sideRight');
  if (!dock || RIGHT_DOCK_WIDGETS.indexOf(widgetId) === -1) return;
  dock.classList.remove('collapsed'); // neutralise l'ancien état replié éventuellement restauré au chargement
  const alreadyShown = dock.style.display === 'block' && dock.dataset.dockActive === widgetId;
  if (alreadyShown) { dock.style.display = 'none'; dock.dataset.dockActive = ''; updateDockBtnActive(null); return; }
  // masque les widgets non actifs via une classe `!important` plutôt que style.display : le rendu de
  // certains widgets (ex. #questTrackerWidget) re-force son propre display à chaque tick, ce qui
  // écrasait un simple style.display='none' -> le widget "fuyait" dans tous les panneaux (retour joueur).
  RIGHT_DOCK_WIDGETS.forEach(id => { const w = $a(id); if (w) w.classList.toggle('dockHidden', id !== widgetId); });
  dock.dataset.dockActive = widgetId;
  dock.style.display = 'block';
  // ancre juste sous la barre d'activités (hauteur variable -> mesurée à l'ouverture)
  const bar = $a('activitiesBar');
  dock.style.top = (bar ? Math.round(bar.getBoundingClientRect().bottom + 6) : 120) + 'px';
  updateDockBtnActive(RIGHT_DOCK_BTN[widgetId]);
}

// (NAME_EN et tr() sont maintenant déclarés en haut du script)

// PATCH_NOTES est desormais defini dans patch-notes-data.js (charge AVANT ce fichier, voir index.html)
