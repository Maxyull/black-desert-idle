// ============================================================
// ACCESSIBILITÉ CLAVIER DES MODALES (2026-07-22, audit repo P9)
// ============================================================
// Avant : une seule modale du jeu gérait Échap et le focus (le panneau React des patch notes,
// progression/patch-notes-engage-react.js). Les 8 overlays du jeu ne géraient rien — pas d'Échap,
// pas de piège de focus, pas de restauration du focus à la fermeture, aucun attribut ARIA. Au
// clavier, ouvrir une modale envoyait le focus continuer sa route dans la page DERRIÈRE, et le
// fermer ramenait le focus au début du document.
//
// ------------------------------------------------------------
// LE PRINCIPE : « Échap fait ce que fait le bouton de fermeture VISIBLE. Pas de bouton, pas
// d'Échap. »
// ------------------------------------------------------------
// C'est le cœur de ce fichier, et ce n'est pas un détail d'implémentation.
//
// Un « Échap ferme tout » serait une RÉGRESSION, pas une amélioration :
//   * #sessionLockOverlay est un VERROU (une autre session joue sur ce compte). Le fermer au
//     clavier laisserait jouer une session évincée -- exactement ce que le verrou empêche. Il n'a
//     d'ailleurs aucun bouton de fermeture, seulement « Reprendre » (qui réclame la session).
//   * #authOverlay sans session connectée : le fermer laissait le joueur coincé devant un jeu
//     qu'il ne peut pas utiliser. C'est un vrai bug déjà vécu (voir le commentaire du 2026-07-16
//     dans game-supabase.js, et la PR #19 sur les invités piégés).
//
// Plutôt qu'une liste de politiques « qui a le droit à Échap » — qui dériverait du reste du code au
// premier changement, en silence — on lit l'état RÉEL du bouton de fermeture. #closeAuth est déjà
// masqué/affiché dynamiquement par showAuthOverlay() selon `currentUser && !inPasswordRecovery` :
// cette règle existe, elle est testée, elle est la source de vérité. On s'y branche au lieu de la
// dupliquer. Résultat : le jour où quelqu'un change les conditions de fermeture de l'écran d'auth,
// Échap suit automatiquement, sans que personne ait à y penser.
//
// Corollaire volontaire : Échap ne fait RIEN de plus que ce qu'un clic ferait. Il ne contourne
// aucune garde, ne saute aucune confirmation.
//
// ------------------------------------------------------------
// Chargement : ce fichier ne référence AUCUNE fonction d'un autre fichier au chargement -- tout
// passe par des clics simulés sur des éléments trouvés à l'exécution. Il peut donc être placé
// n'importe où dans l'ordre des <script> (leçon du découpage P5, voir backend/README.md).

// Ordonné par z-index DÉCROISSANT : Échap ferme la modale du DESSUS, celle que le joueur voit.
// Les valeurs viennent de styles.css et sont rappelées ici pour que l'ordre de ce tableau soit
// vérifiable d'un coup d'œil plutôt que d'être un ordre arbitraire qu'on n'ose plus toucher.
const A11Y_MODALS = [
  { id:'tutorialOverlay',    z:900, openWhen:'open',   closeBtn:'tutSkipBtn' },
  { id:'sessionLockOverlay', z:150, openWhen:'hidden', invert:true, closeBtn:null }, // VERROU : jamais fermable
  { id:'adminOverlay',       z:150, openWhen:'open',   closeBtn:'closeAdmin' },
  { id:'patchImgOverlay',    z:105, openWhen:'open',   closeBtn:'closePatchImg' },
  { id:'authOverlay',        z:100, openWhen:'hidden', invert:true, closeBtn:'closeAuth' }, // fermable SEULEMENT si #closeAuth est visible
  { id:'infoOverlay',        z:95,  openWhen:'open',   closeBtn:'closeInfo' },
  { id:'marketOverlay',      z:90,  openWhen:'open',   closeBtn:'closeMarket' },
  { id:'resetNoticeOverlay', z:80,  openWhen:'show',   closeBtn:'resetNoticeClose' },
];

/** @param {object} m - entrée de A11Y_MODALS. @returns {boolean} la modale est-elle actuellement affichée ? (les conventions diffèrent d'un overlay à l'autre : .open, .show, ou .hidden inversé) */
function a11yModalIsOpen(m) {
  const el = document.getElementById(m.id);
  if (!el) return false;
  const has = el.classList.contains(m.openWhen);
  return m.invert ? !has : has;
}

/** @returns {object|null} la modale ouverte la plus HAUTE dans la pile (celle que le joueur voit), ou null. */
function a11yTopModal() {
  return A11Y_MODALS.find(a11yModalIsOpen) || null;
}

/** @param {object} m - entrée de A11Y_MODALS. @returns {HTMLElement|null} le bouton de fermeture s'il est réellement VISIBLE (offsetParent), sinon null — c'est ce qui interdit Échap sur le verrou de session et sur l'auth sans compte. */
function a11yVisibleCloseBtn(m) {
  if (!m.closeBtn) return null;
  const b = document.getElementById(m.closeBtn);
  // offsetParent === null couvre display:none, .hidden, et un parent masqué -- on teste ce que
  // l'utilisateur VOIT, pas ce que le HTML déclare. Le projet a déjà été piégé deux fois par une
  // classe `.hidden` sans règle CSS correspondante : lire la classe ne prouve rien.
  if (!b || b.offsetParent === null) return null;
  return b;
}

// ---------- restauration du focus ----------
// Qui avait le focus avant l'ouverture, par modale. Fermer doit rendre le focus au bouton qui a
// ouvert, sinon on repart du début du document -- pénible à la souris, bloquant au clavier.
const a11yFocusOrigin = new Map();

/** @param {HTMLElement} root @returns {HTMLElement[]} éléments focusables réellement visibles, recalculés à chaque appel (le contenu des panneaux change : filtres, pagination, onglets). */
function a11yFocusables(root) {
  if (!root) return [];
  return Array.from(root.querySelectorAll(
    'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'
  )).filter(el => el.offsetParent !== null);
}

/** Piège Tab/Shift+Tab à l'intérieur de `root` (cycle du dernier au premier et inversement). @param {KeyboardEvent} e @param {HTMLElement} root */
function a11yTrapTab(e, root) {
  const items = a11yFocusables(root);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  // Le focus s'est échappé (clic dans le fond, ou focus resté derrière) : on le ramène.
  if (!root.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

// Un SEUL écouteur global, en phase de capture, plutôt qu'un par modale : les overlays s'ouvrent et
// se ferment via des chemins très différents (classList un peu partout, React, timers) et il n'y a
// pas de point commun où brancher un add/removeEventListener fiable. Un écouteur unique qui
// interroge l'état réel du DOM à chaque touche ne peut pas se désynchroniser ni fuiter.
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' && e.key !== 'Tab') return;
  const m = a11yTopModal();
  if (!m) return;
  const root = document.getElementById(m.id);
  if (e.key === 'Tab') { a11yTrapTab(e, root); return; }
  const btn = a11yVisibleCloseBtn(m);
  if (!btn) return; // verrou de session, ou auth sans compte : Échap ne doit RIEN faire
  e.preventDefault();
  btn.click(); // exactement ce qu'un clic ferait -- aucune garde contournée
}, true);

// Le focus est capté à l'ouverture et rendu à la fermeture. On observe les changements de classe
// des overlays plutôt que de patcher chaque fonction d'ouverture : elles sont éparpillées dans 6
// fichiers et certaines sont dans du React. L'observateur voit l'état réel, quel que soit le chemin.
A11Y_MODALS.forEach(m => {
  const el = document.getElementById(m.id);
  if (!el) return;
  // ARIA : le lecteur d'écran doit annoncer « dialogue » et ne pas lire la page derrière.
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  let wasOpen = a11yModalIsOpen(m);
  new MutationObserver(() => {
    const open = a11yModalIsOpen(m);
    if (open === wasOpen) return;
    wasOpen = open;
    if (open) {
      a11yFocusOrigin.set(m.id, document.activeElement);
      // Focus sur le 1er élément utile de la modale. requestAnimationFrame : beaucoup de panneaux
      // remplissent leur contenu juste APRÈS avoir ajouté la classe d'ouverture — chercher les
      // focusables tout de suite tomberait sur un conteneur encore vide.
      requestAnimationFrame(() => {
        if (!a11yModalIsOpen(m)) return;
        const items = a11yFocusables(el);
        if (items.length) try { items[0].focus(); } catch (err) {}
      });
    } else {
      const origin = a11yFocusOrigin.get(m.id);
      a11yFocusOrigin.delete(m.id);
      // isConnected : le bouton d'origine peut avoir été retiré du DOM pendant que la modale était
      // ouverte (panneaux re-rendus). Lui redonner le focus ne ferait rien et laisserait le focus
      // sur <body> — on ne tente que si l'élément est encore là.
      if (origin && origin.isConnected && typeof origin.focus === 'function') try { origin.focus(); } catch (err) {}
    }
  }).observe(el, { attributes: true, attributeFilter: ['class'] });
});
