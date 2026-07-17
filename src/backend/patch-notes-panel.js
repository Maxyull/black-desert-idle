// ============================================================
// PANNEAU DES PATCH NOTES (pagination, badge non-lu, rendu HTML, comparateur d'images)
// ============================================================
// Extrait de src/backend/game-supabase.js le 2026-07-22 (audit repo P5 : le fichier avait
// atteint 3 124 lignes, trois fois la limite de decoupe obligatoire de CLAUDE.md, et melangeait
// le rendu des notes de version avec le client Supabase).
//
// DECOUPAGE PAR TRANSPLANTATION, PAS PAR REECRITURE : les lignes sont sorties telles quelles, et
// ce fichier est charge dans index.dev.html EXACTEMENT a la place qu'occupait ce bloc dans
// l'original. Le projet n'a pas de modules ES -- tous les scripts partagent un seul scope global,
// et un `const`/`let` de haut niveau lu au chargement par un fichier suivant explose si l'ordre
// bouge (CLAUDE.md SS6). Preserver l'ordre a l'octet pres est ce qui rend ce decoupage sur.
//
// Les DONNEES vivent dans meta/patch-notes-data.js, le numero de version dans
// meta/patch-notes-version.json (audit P4). Ce fichier n'est que la vue.

let patchPageStart = 0;
try { patchPageStart = parseInt(localStorage.getItem('velia-patch-page')||'0', 10) || 0; } catch(e) {}
/** Fusionne seenThisSession dans readPatches et persiste (localStorage) — appelé à la fermeture de l'onglet, le tag NEW reste visible toute la session jusque-là. */
function commitPatchRead() { // appelé à la fermeture de l'onglet
  try {
    const merged = new Set([...readPatches, ...seenThisSession]);
    localStorage.setItem('velia-patch-read', JSON.stringify([...merged]));
  } catch(e) {}
}
window.addEventListener('beforeunload', commitPatchRead);
window.addEventListener('pagehide', commitPatchRead); // filet de sécurité (mobile / onglets fermés brutalement)

// le badge (pastille numérique sur le bouton + pastille en haut de page) compte ce qui n'a été vu
// ni lors d'une session précédente NI pendant la session en cours. Changement du 2026-07-06
// (demande explicite : "s'il a pas scrollé les pastille restent... le numero reste aussi tant
// qu'il n'a pas scrollé pour lire le patch") -- REMPLACE le comportement du 2026-07-05 où ouvrir le
// panneau suffisait à tout vider d'un coup : désormais, seul le DÉFILEMENT réel jusqu'à une entrée
// (voir patchObserver plus bas) la marque vue, ouvrir le panneau seul ne change plus rien. Le tag
// "NEW" sur chaque entrée reste basé UNIQUEMENT sur les sessions précédentes (readPatches).
/** @returns {number} nombre de patch notes jamais vues (ni lors d'une session précédente, ni pendant celle-ci) — seul le défilement réel jusqu'à une entrée la marque vue. */
function unreadPatchCount() { return PATCH_NOTES.filter(p => !readPatches.has(p.v) && !seenThisSession.has(p.v)).length; }
// découpe PATCH_NOTES en pages de 2 à 7 entrées SELON LA TAILLE (2026-07-11, demande explicite :
// "affiche les 2 a 7 dernier note selon la taille") -- une page s'arrête dès qu'elle atteint 7
// entrées OU que son total de lignes dépasserait le budget (mais jamais moins de 2 entrées, même
// si les 2 premières sont déjà volumineuses). Recalculé à chaque ouverture/navigation (bon marché,
// PATCH_NOTES ne bouge jamais en cours de session).
const PATCH_PAGE_MIN = 2, PATCH_PAGE_MAX = 7, PATCH_PAGE_LINE_BUDGET = 10;
/** @returns {{start:number, count:number}[]} découpe PATCH_NOTES en pages de PATCH_PAGE_MIN à PATCH_PAGE_MAX entrées, arrêtées plus tôt si le budget de lignes (PATCH_PAGE_LINE_BUDGET) est dépassé (jamais moins de 2 entrées). */
function computePatchPages() {
  const pages = [];
  let i = 0;
  while (i < PATCH_NOTES.length) {
    let count = 0, lines = 0;
    while (count < PATCH_PAGE_MAX && i+count < PATCH_NOTES.length) {
      const entryLines = (PATCH_NOTES[i+count][LANG] || []).length;
      if (count >= PATCH_PAGE_MIN && lines + entryLines > PATCH_PAGE_LINE_BUDGET) break;
      lines += entryLines; count++;
    }
    if (count === 0) count = 1; // filet de sécurité, jamais une page vide
    pages.push({ start: i, count });
    i += count;
  }
  return pages;
}
/** Met à jour la pastille de patch notes non lues (bouton + bandeau interne au panneau, visible seulement si le panneau est ouvert). */
function updatePatchBadge() {
  const n = unreadPatchCount();
  // 2026-07-13 : #patchBadge/#btnPatch (sidebar) retirés, doublons du header -- seuls
  // #patchBadgeTopbar/#btnPatchTopbar restent (ci-dessous).
  // raccourci header (2026-07-13) : même compteur, badge superposé sur #btnPatchTopbar
  const badgeTopbar = $a('patchBadgeTopbar');
  if (badgeTopbar) { badgeTopbar.textContent = n; badgeTopbar.classList.toggle('show', n > 0); }
  const btnPatchTopbar = $a('btnPatchTopbar');
  if (btnPatchTopbar) btnPatchTopbar.classList.toggle('hasNew', n > 0);
  // bandeau DANS le panneau des notes de version (2026-07-06, demande explicite : "enleve la
  // pastille en haut de l'ecran... mets-la dans notes de version directement pour appel au scroll
  // vers le haut") -- remplace l'ancienne pastille flottante sur toute la page, qui chevauchait le
  // panneau. Ne s'affiche que si CE panneau est ouvert (sinon rien à quoi l'accrocher/scroller).
  const banner = $a('patchUnreadBanner');
  if (banner) {
    const patchPanelOpen = $a('infoOverlay').classList.contains('open') && document.querySelector('.patchEntry');
    $a('patchUnreadBannerNum').textContent = n;
    banner.classList.toggle('show', n > 0 && !!patchPanelOpen);
  }
}

// catégories principales des notes de version (refonte du 2026-07-05, demande explicite) --
// taxonomie standard adaptée à Black Desert Idle (les catégories sans équivalent dans ce jeu, ex.
// "Boutique"/devise premium, "Classes"/"Montures", ne sont pas utilisées ici)
const PATCH_CATS = {
  new:     { fr:'Nouveautés',           en:'New',            icon:'🆕', color:'#8fc98a',
    desc:{fr:'Nouveau contenu ajouté au jeu', en:'New content added to the game'} },
  change:  { fr:'Équilibrage',          en:'Balancing',      icon:'⚖️', color:'#9cc9e8',
    desc:{fr:'Ajustement de valeurs existantes (stats, taux, difficulté...)', en:'Adjustment of existing values (stats, rates, difficulty...)'} },
  improve: { fr:'Améliorations',        en:'Improvements',   icon:'✨', color:'#7ec9c2',
    desc:{fr:'Amélioration de l\'existant sans changer son fonctionnement de base', en:'Improvement of something existing without changing its core behavior'} },
  fix:     { fr:'Corrections de bugs',  en:'Bug fixes',      icon:'🐛', color:'#e8b84a',
    desc:{fr:'Correction d\'un bug ou d\'un comportement incorrect', en:'Fix for a bug or incorrect behavior'} },
  exploit: { fr:'Sécurité',             en:'Security',       icon:'🔒', color:'#b48ce8',
    desc:{fr:'Faille de sécurité corrigée', en:'Security vulnerability fixed'} },
  admin:   { fr:'Serveur',              en:'Server',         icon:'🌐', color:'#c9a55a',
    desc:{fr:'Changement côté serveur/infrastructure', en:'Server-side/infrastructure change'} },
  event:   { fr:'Événements',           en:'Events',         icon:'🎉', color:'#e89fc4',
    desc:{fr:'Contenu ou bonus temporaire', en:'Temporary content or bonus'} },
  info:    { fr:'Informations',         en:'Information',    icon:'📢', color:'#9aa8c9',
    desc:{fr:'Annonce ou information, sans changement de jeu', en:'Announcement or information, no gameplay change'} },
};
// tag de plateforme (2026-07-05, demande explicite) : en plus de la catégorie, précise quand
// une ligne ne concerne QUE tablette/téléphone — sert à repérer d'un coup d'œil les changements
// qui ne touchent pas la version ordinateur. Optionnel (line.plat) : absent = toutes plateformes.
const PATCH_PLATFORMS = {
  mobile: { fr:'Tab/Mobile', en:'Tab/Mobile', icon:'📱', color:'#e0a840',
    desc:{fr:'Concerne uniquement tablette/téléphone', en:'Only concerns tablet/phone'} },
  firefox: { fr:'Firefox', en:'Firefox', icon:'🦊', color:'#e0824a',
    desc:{fr:'Bug spécifique à Firefox (Chrome non affecté)', en:'Firefox-specific bug (Chrome unaffected)'} },
};
// tag de nature (2026-07-05, demande explicite) : précise si une ligne relève d'une optimisation
// "sous le capot" (code, performance, structure des données) plutôt que du contenu de jeu direct.
// Optionnel (line.nature) : absent = non concerné.
const PATCH_NATURE = {
  opticode:     { fr:'Optim. code',   en:'Code opti',   icon:'🧹', color:'#7aa8c9',
    desc:{fr:'Nettoyage/restructuration du code, sans impact visible', en:'Code cleanup/restructuring, no visible impact'} },
  optimisation: { fr:'Optimisation',  en:'Optimization', icon:'⚡', color:'#c9a55a',
    desc:{fr:'Optimisation de performance ou d\'algorithme', en:'Performance or algorithm optimization'} },
  inventaire:   { fr:'Inventaire',    en:'Inventory',   icon:'🎒', color:'#8fc98a',
    desc:{fr:'Concerne le stockage/la structure des données de sauvegarde', en:'Concerns storage/structure of save data'} },
  backend:      { fr:'Backend',       en:'Backend',     icon:'🗄️', color:'#b48ce8',
    desc:{fr:'Changement côté serveur (Supabase, base de données...)', en:'Server-side change (Supabase, database...)'} },
};
// gravité du changement (2026-07-05, demande explicite) : pastille de couleur indiquant l'impact
// du changement, indépendamment de sa catégorie. Optionnel (line.severity) : absent = pas de
// gravité précisée (la plupart des lignes mineures n'ont pas besoin d'en avoir une).
const PATCH_SEVERITY = {
  critical: { fr:'Critique', en:'Critical', color:'#e85a5a',
    desc:{fr:'Impact majeur : sécurité, perte de données, ou jeu bloqué', en:'Major impact: security, data loss, or game-blocking issue'} },
  major:    { fr:'Important', en:'Major', color:'#e8a840',
    desc:{fr:'Changement notable qui affecte l\'expérience de jeu', en:'Notable change affecting the gameplay experience'} },
  minor:    { fr:'Mineur', en:'Minor', color:'#e8d840',
    desc:{fr:'Petit ajustement, impact limité', en:'Small adjustment, limited impact'} },
  info:     { fr:'Info', en:'Info', color:'#9aa8c9',
    desc:{fr:'Purement informatif, aucun impact sur le jeu', en:'Purely informational, no impact on the game'} },
};
// sous-catégorie libre (2026-07-05, demande explicite) : précise le domaine exact touché à
// l'intérieur d'une catégorie principale (ex: "Boss" dans Nouveautés OU dans Équilibrage) --
// simple étiquette informative, pas de code couleur dédié (contrairement aux tags ci-dessus).
// Optionnel (line.sub) : absent = pas de sous-catégorie précisée.
const PATCH_SUBCATS = {
  boss:'Boss', monstres:'Monstres', zones:'Zones', quetes:'Quêtes', pnj:'PNJ', objets:'Objets',
  equipements:'Équipements', competences:'Compétences', systeme:'Système de jeu',
  pve:'PvE', loot:'Loot', economie:'Économie', craft:'Craft', xp:'Expérience (XP)',
  interface:'Interface (UI)', ux:'Expérience utilisateur (UX)', perf:'Performances',
  optimisation:'Optimisation', graphismes:'Graphismes', audio:'Audio', animations:'Animations',
  accessibilite:'Accessibilité', chargement:'Temps de chargement',
  gameplay:'Gameplay', combat:'Combat', inventaire:'Inventaire', reseau:'Réseau',
  sauvegarde:'Sauvegarde', connexion:'Connexion',
  anticheat:'Anti-triche', authentification:'Authentification', comptes:'Comptes', compte:'Compte',
  serveur:'Serveur', securite:'Correctifs de sécurité', admin:'Administration',
  maintenance:'Maintenance', infrastructure:'Infrastructure', bdd:'Base de données',
  synchro:'Synchronisation',
  eventTemp:'Événements temporaires', bonusXp:'Bonus XP', bonusDrop:'Bonus Drop',
  cadeaux:'Cadeaux', calendrier:'Calendrier',
  annonces:'Annonces', roadmap:'Feuille de route', prochaines:'Prochaines mises à jour',
  connus:'Problèmes connus', tresors:'Trésors', compagnon:'Compagnon',
};
const PATCH_SUBCATS_EN = {
  boss:'Boss', monstres:'Monsters', zones:'Zones', quetes:'Quests', pnj:'NPC', objets:'Items',
  equipements:'Gear', competences:'Skills', systeme:'Game systems',
  pve:'PvE', loot:'Loot', economie:'Economy', craft:'Crafting', xp:'Experience (XP)',
  interface:'Interface (UI)', ux:'User experience (UX)', perf:'Performance',
  optimisation:'Optimization', graphismes:'Graphics', audio:'Audio', animations:'Animations',
  accessibilite:'Accessibility', chargement:'Loading times',
  gameplay:'Gameplay', combat:'Combat', inventaire:'Inventory', reseau:'Network',
  sauvegarde:'Save', connexion:'Login',
  anticheat:'Anti-cheat', authentification:'Authentication', comptes:'Accounts', compte:'Account',
  serveur:'Server', securite:'Security fixes', admin:'Administration',
  maintenance:'Maintenance', infrastructure:'Infrastructure', bdd:'Database',
  synchro:'Synchronization',
  eventTemp:'Time-limited events', bonusXp:'XP bonus', bonusDrop:'Drop bonus',
  cadeaux:'Gifts', calendrier:'Calendar',
  annonces:'Announcements', roadmap:'Roadmap', prochaines:'Upcoming updates',
  connus:'Known issues', tresors:'Treasures', compagnon:'Companion',
};

// construit le HTML d'UNE entrée de patch note -- absIdx = index ABSOLU dans PATCH_NOTES (pas
// juste dans la page affichée), pour que la classe "latest" ne s'applique qu'à la toute dernière
// version du jeu, même quand on navigue vers une page qui ne contient pas l'index 0.
/** @param {object} p - entrée de PATCH_NOTES. @param {number} absIdx - index absolu dans PATCH_NOTES (pas dans la page affichée, pour que la classe "latest" ne s'applique qu'à la vraie dernière version). @returns {string} HTML d'une entrée de patch note, lignes groupées par catégorie avec tags gravité/plateforme/nature/sous-catégorie. */
function renderPatchEntryHtml(p, absIdx) {
    const isNew = !readPatches.has(p.v); // basé UNIQUEMENT sur les sessions précédentes, pas sur l'affichage en cours
    return `
    <div class="patchEntry ${absIdx===0?'latest':''}" data-ver="${p.v}">
      <div class="patchEntryHead">
        <span class="patchVer">${p.v}</span>
        ${p.name ? `<span class="patchName">${p.name[LANG]}</span>` : ''}
        ${isNew ? '<span class="patchNewTag">NEW</span>' : ''}
        ${p.d ? `<span class="patchDate">${p.d}</span>` : ''}
      </div>
      ${(() => {
        // groupe les lignes par catégorie principale (2026-07-05, demande explicite) : chaque
        // groupe démarre par un en-tête bordé d'un liseré doré, et toutes les lignes d'un même
        // groupe s'alignent à la même hauteur -- au lieu d'un badge répété sur chaque ligne
        const groups = [];
        for (const line of p[LANG]) {
          const key = line.t || 'change';
          let g = groups.find(g => g.key === key);
          if (!g) { g = { key, lines: [] }; groups.push(g); }
          g.lines.push(line);
        }
        return groups.map(g => {
          const cat = PATCH_CATS[g.key] || PATCH_CATS.change;
          const subMap = LANG === 'fr' ? PATCH_SUBCATS : PATCH_SUBCATS_EN;
          return `
          <div class="patchGroup">
            <div class="patchGroupHead" style="color:${cat.color}" title="${escapeHtml(cat.desc[LANG])}">${cat.icon} ${cat[LANG]}</div>
            <ul>${g.lines.map(line => {
              const sev = line.severity ? PATCH_SEVERITY[line.severity] : null;
              const plat = line.plat ? PATCH_PLATFORMS[line.plat] : null;
              const nature = line.nature ? PATCH_NATURE[line.nature] : null;
              const sub = line.sub ? subMap[line.sub] : null;
              // pastille de gravité (2026-07-05, demande explicite) : déplacée dans la ligne d'infos
              // du bas (comme les autres badges) pour ne plus décaler le texte de la ligne -- garde
              // un petit point coloré devant son libellé, infobulle au survol
              const sevTag = sev ? `<span class="patchCat" style="color:${sev.color};border-color:${sev.color}" title="${escapeHtml(sev.desc[LANG])}"><span class="patchSevDot" style="background:${sev.color}"></span>${sev[LANG]}</span>` : '';
              const platTag = plat ? `<span class="patchCat" style="color:${plat.color};border-color:${plat.color}" title="${escapeHtml(plat.desc[LANG])}">${plat.icon} ${plat[LANG]}</span>` : '';
              const natureTag = nature ? `<span class="patchCat" style="color:${nature.color};border-color:${nature.color}" title="${escapeHtml(nature.desc[LANG])}">${nature.icon} ${nature[LANG]}</span>` : '';
              // sous-catégorie (2026-07-05, demande explicite : "marquer chaque grosse catégorie ET
              // sous-catégorie mais plus finement") -- reprend la couleur de la catégorie parente au
              // lieu d'un gris neutre, pour bien montrer le lien de parenté tout en restant plus discret
              const subTag = sub ? `<span class="patchSub" style="color:${cat.color};border-color:${cat.color}55" title="${i18next.t('backend:backend.patch_notes.subcategory_label')} : ${escapeHtml(sub)}">${sub}</span>` : '';
              const extraTags = sevTag + subTag + platTag + natureTag;
              const removedTag = line.removed ? `<span class="patchRemoved">${i18next.t('backend:backend.patch_notes.removed_tag')}</span>` : '';
              // bouton avant/après (2026-07-05, demande explicite) : ouvre un comparateur d'images
              // quand la ligne référence des captures d'écran (voir line.img.before/after)
              const imgBtn = line.img ? `<button class="patchImgBtn" data-before="${escapeHtml(line.img.before)}" data-after="${escapeHtml(line.img.after)}" title="${i18next.t('backend:backend.patch_notes.before_after_title')}">🖼️</button>` : '';
              return `<li class="${line.removed?'patchLineRemoved':''}">
                <div class="patchLineMain"><span class="patchLineText">${line.tx}${removedTag}</span>${imgBtn}</div>
                ${extraTags ? `<div class="patchLineExtra">${extraTags}</div>` : ''}
              </li>`;
            }).join('')}</ul>
          </div>`;
        }).join('');
      })()}
    </div>`;
}
// affiche la page COURANTE (patchPageStart) des notes de version -- remplace l'ancien système à
// scroll (2026-07-11, demande explicite : "enleve le scroll affiche les 2 a 7 dernier note selon
// la taille et met un bouton vers le haut pour voir les nouveau et vers le bas pour regarder les
// ancien") : plus de mémoire de position de scroll, plus d'IntersectionObserver -- une page ENTIÈRE
// (2 à 7 notes, voir computePatchPages) est toujours affichée en entier, donc marquée "vue" dès son
// rendu, sans avoir besoin de défiler dessus.
/** Affiche la page courante des notes de version (repli HTML si le panneau React est indisponible) — une page entière (2-7 entrées) rendue = marquée vue immédiatement, câble la navigation haut/bas et le comparateur avant/après. */
function renderPatchNotesPanel() {
  const pages = computePatchPages();
  let pageIdx = pages.findIndex(pg => pg.start === patchPageStart);
  if (pageIdx === -1) { pageIdx = 0; patchPageStart = pages[0].start; } // sécurité si l'historique a changé depuis
  const page = pages[pageIdx];
  const entries = PATCH_NOTES.slice(page.start, page.start + page.count);

  // bandeau "N notes non lues" -- calculé AVANT le reste (qui ne change plus ce compte)
  const unreadNow = unreadPatchCount();
  const unreadBannerHtml = `<div id="patchUnreadBanner" class="${unreadNow>0?'show':''}">` +
    `<span id="patchUnreadBannerNum">${unreadNow}</span> ` +
    `<span>${i18next.t('backend:backend.patch_notes.unread_banner')}</span></div>`;

  const navHtml = `<div class="patchNavRow">
      <button id="patchNavUp" class="patchNavBtn"${pageIdx===0?' disabled':''} title="${i18next.t('backend:backend.patch_notes.newer_notes_title')}">▲ ${i18next.t('backend:backend.patch_notes.newer_label')}</button>
      <span class="patchNavPos">${page.start+1}–${page.start+entries.length} / ${PATCH_NOTES.length}</span>
      <button id="patchNavDown" class="patchNavBtn"${pageIdx===pages.length-1?' disabled':''} title="${i18next.t('backend:backend.patch_notes.older_notes_title')}">${i18next.t('backend:backend.patch_notes.older_label')} ▼</button>
    </div>`;

  const entriesHtml = entries.map((p,k) => renderPatchEntryHtml(p, page.start+k)).join('');
  openInfo(i18next.t('backend:backend.patch_notes.panel_title'), unreadBannerHtml + navHtml + entriesHtml);

  // toute la page affichée est immédiatement marquée "vue" (plus besoin de défiler dessus,
  // contrairement à l'ancien système) -- le tag "NEW" par entrée reste basé sur readPatches
  // (sessions précédentes) et ne disparaît qu'à la fermeture de l'onglet, voir commitPatchRead
  let changed = false;
  entries.forEach(p => { if (!seenThisSession.has(p.v)) { seenThisSession.add(p.v); changed = true; } });
  if (changed) updatePatchBadge();

  try { localStorage.setItem('velia-patch-page', String(patchPageStart)); } catch(e) {}

  const unreadBannerEl = $a('patchUnreadBanner');
  if (unreadBannerEl) unreadBannerEl.onclick = () => { patchPageStart = 0; renderPatchNotesPanel(); };
  const upBtn = $a('patchNavUp'), downBtn = $a('patchNavDown');
  if (upBtn) upBtn.onclick = () => { if (pageIdx > 0) { patchPageStart = pages[pageIdx-1].start; renderPatchNotesPanel(); } };
  if (downBtn) downBtn.onclick = () => { if (pageIdx < pages.length-1) { patchPageStart = pages[pageIdx+1].start; renderPatchNotesPanel(); } };

  // comparateur avant/après (2026-07-05, demande explicite) : câblé après insertion du HTML
  $a('infoBody').querySelectorAll('.patchImgBtn').forEach(btn => {
    btn.onclick = () => openPatchImgCompare(btn.dataset.before, btn.dataset.after);
  });
}
// 2026-07-10 : #btnPatch ouvre désormais le panneau React (src/progression/patch-notes-engage-react.js,
// 4e exception React, voir CLAUDE.md §7) -- karma/commentaires/recherche/filtres/vue controverse,
// même palette que la maquette fournie. renderPatchNotesPanel() (ci-dessus) reste le repli HTML si
// React est indisponible, comme pour le Compendium/le modal de reconnexion.
// 2026-07-13 : #btnPatch (sidebar) retiré, doublon du raccourci header -- #btnPatchTopbar est
// désormais le SEUL déclencheur, câblé directement sur le panneau (plus de proxy .click()).
$a('btnPatchTopbar').onclick = () => {
  if (typeof openPatchNotesReact === 'function' && $a('patchNotesModalRoot')) openPatchNotesReact();
  else renderPatchNotesPanel();
};
/** @param {string} before @param {string} after - URLs des captures. Ouvre le comparateur d'images avant/après d'une ligne de patch note. */
function openPatchImgCompare(before, after) {
  $a('patchImgLblBefore').textContent = i18next.t('backend:backend.patch_notes.compare_before_label');
  $a('patchImgLblAfter').textContent = i18next.t('backend:backend.patch_notes.compare_after_label');
  $a('patchImgBefore').src = before;
  $a('patchImgAfter').src = after;
  $a('patchImgOverlay').classList.add('open');
}
$a('closePatchImg').onclick = () => $a('patchImgOverlay').classList.remove('open');
let patchImgMouseDownOnBackdrop = false;
$a('patchImgOverlay').addEventListener('mousedown', e => { patchImgMouseDownOnBackdrop = (e.target.id === 'patchImgOverlay'); });
$a('patchImgOverlay').addEventListener('click', e => { if (e.target.id === 'patchImgOverlay' && patchImgMouseDownOnBackdrop) $a('patchImgOverlay').classList.remove('open'); });

updatePatchBadge();
applyI18n();
