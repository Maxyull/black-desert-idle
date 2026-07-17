// ============================================================
// TUTORIELS (arrivee a Velia, Compendium, Pierre de Cron) — moteur generique
// ============================================================
// Extrait de src/backend/game-supabase.js le 2026-07-22 (audit repo P5 : le fichier avait
// atteint 3 124 lignes, trois fois la limite de decoupe obligatoire de CLAUDE.md, et melangeait
// le moteur de tutoriel avec le client Supabase).
//
// DECOUPAGE PAR TRANSPLANTATION, PAS PAR REECRITURE : les lignes sont sorties telles quelles, et
// ce fichier est charge dans index.dev.html EXACTEMENT a la place qu'occupait ce bloc dans
// l'original. Le projet n'a pas de modules ES -- tous les scripts partagent un seul scope global,
// et un `const`/`let` de haut niveau lu au chargement par un fichier suivant explose si l'ordre
// bouge (CLAUDE.md SS6). Preserver l'ordre a l'octet pres est ce qui rend ce decoupage sur.
//
// Deplace dans progression/ plutot que backend/ : c'est de l'onboarding joueur, pas du reseau
// (CLAUDE.md : organisation par fonctionnalite). Seul reportTutorialProgress() parle a Supabase.

// ============================================================
// Tutoriel d'arrivée à Velia — encadrés + flèche pointant vers l'élément expliqué. Se lance
// automatiquement à la création d'un compte (aucune sauvegarde cloud trouvée, voir loadCloudSave),
// et peut être relancé à tout moment depuis 🏘️ Velia (haut de la liste des zones) ou le 📖 Wiki.
// ============================================================
// petit état pour le hook before/after du step "suivi de quêtes" (voir plus bas) — permet de
// montrer l'encart même s'il est actuellement masqué, puis de restaurer l'état d'origine en sortant
let tutTrackerWasOn = false, tutTrackerForced = false;
let tutPotWasOpen = false;
const TUTORIAL_STEPS = [
  { title:{fr:'Bienvenue à Velia !',en:'Welcome to Velia!'},
    text:{fr:'Velia est une ville paisible : aucun monstre n\'y rôde. C\'est le meilleur endroit pour découvrir les bases avant de partir à l\'aventure.', en:'Velia is a peaceful town: no monsters roam here. It\'s the best place to learn the basics before heading out to adventure.'} },
  { target:'#activityTabs', placement:'bottom',
    title:{fr:'Les pages du jeu',en:'Game pages'},
    text:{fr:'Cette barre te permet de basculer entre les activités : la Zone (farm) et le Boss mondial. D\'autres activités arriveront plus tard.', en:'This bar lets you switch between activities: the Zone (farming) and the World Boss. More activities will arrive later.'} },
  { target:'#zoneList', placement:'left',
    title:{fr:'Choisis ta zone de farm',en:'Pick your farming zone'},
    text:{fr:'Clique une zone pour t\'y rendre. Ton personnage combat AUTOMATIQUEMENT — pas besoin de cliquer pour attaquer !', en:'Click a zone to travel there. Your character fights AUTOMATICALLY — no need to click to attack!'} },
  { target:'#skillBar', placement:'top',
    title:{fr:'Sorts automatiques',en:'Automatic skills'},
    text:{fr:'Tes sorts se lancent tout seuls selon une IA de combat. Optimise ton équipement pour qu\'ils tapent plus fort.', en:'Your skills cast themselves based on a combat AI. Improve your gear so they hit harder.'} },
  { target:'#potSlot', placement:'right',
    title:{fr:'Potions de vie et de mana',en:'HP and mana potions'},
    text:{fr:'Clique ici pour choisir la taille de potion de vie bue automatiquement (prix fixe et soin différents selon la taille) et régler le seuil "Boire sous X%". La potion de mana se boit toute seule sous 30% mana, aucun réglage nécessaire.', en:'Click here to choose the HP potion size drunk automatically (fixed price and heal that differ by size) and set the "Drink under X%" threshold. The mana potion drinks itself under 30% mana, no setting needed.'},
    before: () => { tutPotWasOpen = $a('potSelect').classList.contains('show'); renderPotSelect(); $a('potSelect').classList.add('show'); },
    after: () => { if (!tutPotWasOpen) $a('potSelect').classList.remove('show'); } },
  { target:'#panel .card', placement:'left',
    title:{fr:'Tes statistiques',en:'Your stats'},
    text:{fr:'Gearscore, PA/PD et progression : tout ce qu\'il faut pour savoir si tu es prêt pour la zone suivante.', en:'Gearscore, AP/DP and progress: everything you need to know if you\'re ready for the next zone.'} },
  { target:'#optCard', placement:'left',
    title:{fr:'Système d\'optimisation',en:'Enhancement system'},
    text:{fr:'Charge un matériau depuis ton sac pour tenter d\'améliorer une pièce d\'équipement. Plus le niveau visé est haut, plus le risque d\'échec est grand. Astuce : le petit 🔧 sur une pièce équipée t\'amène directement ici pour CETTE pièce.', en:'Load a material from your bag to try enhancing a gear piece. The higher the target level, the higher the risk of failure. Tip: the small 🔧 on an equipped piece brings you straight here for THAT piece.'} },
  { target:'#invCard', placement:'left',
    title:{fr:'Ton inventaire',en:'Your inventory'},
    text:{fr:'Tout ce que tu ramasses atterrit ici. Les boutons au-dessus t\'aident à équiper le meilleur stuff, vendre le surplus (trash, matériaux, objets inférieurs) ou trier le sac en un clic.', en:'Everything you loot lands here. The buttons above help you equip your best gear, sell the surplus (trash, materials, lower items) or sort your bag in one click.'} },
  { target:'#btnEquipBest', placement:'bottom',
    title:{fr:'"Équiper le meilleur" = toujours le meilleur SOCLE',en:'"Equip best" = always the best BASE gear'},
    text:{fr:'Ce bouton compare le socle (stats de base) de chaque objet, pas ses stats actuelles à l\'écran. Une pièce de plus haut niveau reste donc TOUJOURS préférée à une pièce plus faible même très enchantée : c\'est ton futur BiS (Best in Slot), et l\'enchanter la rendra encore plus forte.', en:'This button compares each item\'s BASE stats, not what\'s currently shown on screen. A higher-tier piece is therefore ALWAYS preferred over a weaker one even if heavily enhanced: it\'s your future BiS (Best in Slot), and enhancing it will make it even stronger.'} },
  { target:'#lootTicker', placement:'left',
    title:{fr:'Le butin en direct',en:'Live loot'},
    text:{fr:'Ce que ton personnage ramasse défile ici, à droite de la zone de jeu, en temps réel.', en:'What your character loots scrolls here, on the right of the game view, in real time.'} },
  { target:'#btnDailyQuests', placement:'bottom',
    title:{fr:'Quêtes journalières & hebdo',en:'Daily & weekly quests'},
    text:{fr:'Clique ici pour voir tes quêtes. Des objectifs se renouvellent chaque jour et chaque semaine, avec des récompenses en silver à la clé.', en:'Click here to see your quests. Objectives refresh every day and every week, with silver rewards waiting for you.'} },
  { target:'#btnToggleTracker', placement:'bottom',
    title:{fr:'Suis tes quêtes',en:'Track your quests'},
    text:{fr:'Ce bouton ouvre le suivi des quêtes restantes : elles s\'affichent alors en permanence à l\'écran, avec leur progression en direct.', en:'This button opens the remaining quests tracker: they then show permanently on screen, with live progress.'},
    // ouvre le panneau Quêtes tout seul en arrivant sur ce step (pour montrer le bouton "Suivre"
    // DANS le menu qui s'ouvre), puis le referme en le quittant
    before: () => { openDailyQuests(); },
    after: () => { questsPanelOpen = false; $a('infoOverlay').classList.remove('open'); } },
  { target:'#questTrackerWidget', placement:'left',
    title:{fr:'Le suivi de quête',en:'The quest tracker'},
    text:{fr:'Voici où apparaissent les quêtes que tu suis, avec leur progression en direct — pratique pour ne rien oublier.', en:'This is where the quests you track appear, with live progress — handy so you never forget them.'},
    before: () => { tutTrackerWasOn = S.questTrackerOn; if (!S.questTrackerOn) { S.questTrackerOn = true; tutTrackerForced = true; renderQuestTrackerWidget(); } },
    after: () => { if (tutTrackerForced) { S.questTrackerOn = tutTrackerWasOn; tutTrackerForced = false; renderQuestTrackerWidget(); } } },
  { target:'#btnLeaderboardTopbar', placement:'bottom',
    title:{fr:'Le classement',en:'The leaderboard'},
    text:{fr:'Compare ton silver, ton gearscore et ta meilleure zone atteinte à celles des autres joueurs.', en:'Compare your silver, gearscore and best zone reached to other players.'} },
  { target:'#btnAchievements', placement:'bottom',
    title:{fr:'Les succès',en:'Achievements'},
    text:{fr:'Des objectifs à long terme avec des récompenses en silver à débloquer au fil de ta progression.', en:'Long-term goals with silver rewards to unlock as you progress.'} },
  { target:'#btnMailbox', placement:'bottom',
    title:{fr:'Le courrier',en:'The mailbox'},
    text:{fr:'200 Loyalties t\'y attendent chaque jour — elles s\'y empilent en permanence et ne se perdent jamais.', en:'200 Loyalties wait for you here every day — they stack up permanently and never get lost.'} },
  { target:'#btnPatchTopbar', placement:'bottom',
    title:{fr:'Les notes de version',en:'Patch notes'},
    text:{fr:'Retrouve ici tout ce qui change à chaque mise à jour du jeu.', en:'Find everything that changes with each game update here.'} },
  { target:'#btnMarketTopbar', placement:'bottom',
    title:{fr:'Le marché (BETA)',en:'The market (BETA)'},
    text:{fr:'Achète et vends du gear et des matériaux avec les autres joueurs. Cette fonctionnalité est encore en BETA, des ajustements sont à prévoir.', en:'Buy and sell gear and materials with other players. This feature is still in BETA, adjustments are to be expected.'} },
  { target:'#chatWidget', placement:'left',
    title:{fr:'Discute avec les autres joueurs',en:'Chat with other players'},
    text:{fr:'Mondial, Trade, Annonces... échange avec la communauté directement depuis le jeu.', en:'World, Trade, Announcements... chat with the community right from the game.'} },
  { target:'#btnLogoutTopbar', placement:'bottom',
    title:{fr:'La déconnexion',en:'Logging out'},
    text:{fr:'Ta progression est sauvegardée automatiquement dans le cloud — tu peux te déconnecter puis te reconnecter sans rien perdre.', en:'Your progress is saved automatically in the cloud — you can log out and log back in without losing anything.'} },
  { target:'#uuidRow', placement:'bottom',
    title:{fr:'Ton UUID',en:'Your UUID'},
    text:{fr:'Cet identifiant unique te sera demandé si le staff doit t\'ajouter un rôle (modérateur, testeur...). Il n\'est pas affiché à l\'écran pour rester privé : clique sur ce bouton pour le copier directement.', en:'This unique ID will be asked from you if the staff needs to grant you a role (moderator, tester...). It isn\'t shown on screen to stay private: click this button to copy it directly.'} },
  { target:'#btnWiki', placement:'bottom', final:true,
    title:{fr:'Besoin d\'aide plus tard ?',en:'Need help later?'},
    text:{fr:'Tu peux relancer ce tutoriel à tout moment depuis le 📖 Wiki (onglet 🔰 Tutoriel), ou en cliquant sur 🏘️ Velia en haut de la liste des zones.', en:'You can replay this tutorial anytime from the 📖 Wiki (🔰 Tutorial tab), or by clicking 🏘️ Velia at the top of the zone list.'} },
];
// ============================================================
// Tutoriel du Compendium (2026-07-08, demande explicite) — se lance automatiquement à la toute
// première ouverture du panneau (voir openCompendium/compTutoSeen), et peut être relancé à tout
// moment via le bouton "?" en haut à droite du panneau. Réutilise le même moteur/overlay que le
// tutoriel d'arrivée (voir activeTutorialSteps), avec resetView:false pour laisser le Compendium
// affiché derrière le spotlight au lieu de le fermer.
let tutCompTabSaved = 'zones'; // onglet à restaurer en quittant le tutoriel (celui d'avant son lancement)
const COMPENDIUM_TUTORIAL_STEPS = [
  { title:{fr:'Le Compendium',en:'The Compendium'},
    text:{fr:'Une collection à vie : chaque zone <b>entièrement collectée</b> (ses 4 objets : trash, matériau, bijou, craft — pas juste visitée) et chaque World Boss vaincu (au moins une fois) t\'accorde un bonus PERMANENT et ADDITIF (jamais un multiplicateur).', en:'A lifetime collection: every zone <b>fully collected</b> (its 4 items: trash, material, jewelry, craft — not just visited) and every World Boss defeated (at least once) grants you a PERMANENT, ADDITIVE bonus (never a multiplier).'} },
  { target:'#infoBody .admStatTiles', placement:'bottom',
    title:{fr:'Ta progression globale',en:'Your overall progress'},
    text:{fr:'+1% Vitesse, +1% Dégâts et +1% Esquive pour chaque zone visitée ou boss vaincu — visible ici en un coup d\'œil.', en:'+1% Speed, +1% Damage and +1% Dodge for every zone visited or boss defeated — visible here at a glance.'} },
  { target:'#infoBody .catTabs', placement:'bottom',
    title:{fr:'3 onglets à explorer',en:'3 tabs to explore'},
    // "sac protégé" retiré le 2026-07-16 (demande explicite : "enleve le sac protege du compendium
    // il est maintenant dans l'inventaire") -- vit désormais uniquement dans la carte Inventaire
    // (onglet "Compendium", voir #invModeCompendiumPane)
    text:{fr:'Zones (farm), World Bosses et Maîtrise PEN (suivi pur, sans bonus) — chacun a sa propre logique, voir les étapes suivantes. Le sac protégé vit maintenant dans la carte Inventaire.', en:'Zones (farming), World Bosses and PEN Mastery (pure tracking, no bonus) — each has its own logic, see the next steps. The protected bag now lives in the Inventory card.'},
    before: () => { tutCompTabSaved = compendiumTab; compendiumTab = 'zones'; openCompendium(); } },
  { target:'#infoBody .compZoneRow', placement:'top',
    title:{fr:'Une zone, ses objets',en:'A zone, its items'},
    text:{fr:'✓ = objet déjà obtenu au moins une fois. Il faut les 4 ✓ de la zone (trash, matériau, bijou, craft) pour toucher son bonus. Clique sur un objet pour voir quelles zones le font dropper, puis clique une zone pour y lancer le farm directement (téléportation immédiate, sans confirmation).', en:'✓ = item already obtained at least once. You need all 4 ✓ for that zone (trash, material, jewelry, craft) to earn its bonus. Click an item to see which zones drop it, then click a zone to start farming there right away (instant teleport, no confirmation).'},
    before: () => { compendiumTab = 'zones'; openCompendium(); } },
  { target:'#infoBody .compPenGrid', placement:'top', final:true,
    title:{fr:'Maîtrise PEN',en:'PEN Mastery'},
    text:{fr:'Suivi de complétion pur (aucun bonus de stats) : amène chaque pièce d\'équipement et chaque bijou à PEN (niveau max) au moins une fois dans ton inventaire. Tu peux relancer ce tutoriel à tout moment avec le bouton "?" en haut du panneau.', en:'Pure completion tracker (no stat bonus): bring every gear piece and every jewel to PEN (max level) at least once in your inventory. You can replay this tutorial anytime with the "?" button at the top of the panel.'},
    before: () => { compendiumTab = 'pen'; openCompendium(); },
    after: () => { compendiumTab = tutCompTabSaved; openCompendium(); } },
];
/** Lance le tutoriel du Compendium (COMPENDIUM_TUTORIAL_STEPS), garde le panneau affiché derrière le spotlight (resetView:false). */
function startCompendiumTutorial() {
  tutCompTabSaved = compendiumTab;
  startTutorial(COMPENDIUM_TUTORIAL_STEPS, { resetView:false });
}
// ============================================================
// Tutoriel de la Pierre de Cron (2026-07-09, demande explicite) — se lance automatiquement au tout
// premier ramassage d'une Pierre de Cron (voir dropsTick/cronTutoSeen dans game-core.js), 1 seule
// étape, même moteur/overlay que les autres tutoriels (resetView:false pour laisser le jeu affiché
// derrière le spotlight au lieu de le fermer).
const CRON_TUTORIAL_STEPS = [
  { target:'#optCronSlot', placement:'top', final:true,
    title:{fr:'Pierre de Cron',en:'Cron Stone'},
    text:{fr:'Cet objet protège ta pièce d\'équipement contre une rétrogradation en cas d\'échec d\'optimisation. Clique dessus pour l\'activer ou la désactiver.', en:'This item protects your gear piece from downgrading if an enhancement attempt fails. Click it to activate or deactivate it.'} },
];
/** Lance le tutoriel de la Pierre de Cron (1 étape), au tout premier ramassage. */
function startCronTutorial() {
  startTutorial(CRON_TUTORIAL_STEPS, { resetView:false });
}
let tutorialStepIdx = -1;
// moteur générique (2026-07-08) : au départ figé sur TUTORIAL_STEPS (le tutoriel d'arrivée), rendu
// générique pour pouvoir aussi jouer d'autres listes d'étapes (ex: COMPENDIUM_TUTORIAL_STEPS) avec
// le même overlay/spotlight — activeTutorialSteps pointe vers la liste actuellement jouée
let activeTutorialSteps = TUTORIAL_STEPS;
// affiche/masque l'indice "il faut défiler" (2026-07-05, demande explicite) : si le RECTANGLE de la
// cible est entièrement au-dessus ou en-dessous de la fenêtre visible, montre une icône souris
// (ordinateur) ou doigt (mobile/tablette, voir la media query CSS) qui rebondit vers le haut/bas,
// à l'opposé du bord hors champ. Se cache dès que la cible redevient visible (ex: le joueur a
// scrollé) — recalculé à chaque frame par tutorialTrackLoop, comme le reste du positionnement.
/** @param {?DOMRect} r - rectangle de la cible du step courant (null = pas de cible). Affiche un indice "il faut défiler" (souris/doigt rebondissant) si la cible est entièrement hors du viewport visible. */
function updateTutorialScrollHint(r) {
  const hint = $a('tutorialScrollHint');
  if (!r) { hint.classList.remove('show'); return; }
  const below = r.top >= window.innerHeight;
  const above = r.bottom <= 0;
  if (!below && !above) { hint.classList.remove('show'); return; }
  hint.classList.add('show');
  hint.classList.toggle('up', above);
  hint.style.top = above ? '18px' : (window.innerHeight-56)+'px';
}
/** Repositionne le spotlight/encadré/flèche du step de tutoriel courant sur sa cible réelle (recalculé à chaque frame par tutorialTrackLoop, donc suit aussi un scroll). Centre l'encadré si le step n'a pas de cible précise. */
function positionTutorialStep() {
  const step = activeTutorialSteps[tutorialStepIdx];
  const hi = $a('tutorialHighlight'), box = $a('tutorialBox'), arrow = $a('tutorialArrow');
  const target = step.target ? document.querySelector(step.target) : null;
  if (!target) {
    // pas de cible précise (ex: message de bienvenue) : encadré centré, pas de spotlight ni flèche
    hi.classList.add('center'); hi.style.top='0'; hi.style.left='0'; hi.style.width='0'; hi.style.height='0';
    arrow.style.display = 'none';
    box.style.top = '50%'; box.style.left = '50%'; box.style.transform = 'translate(-50%,-50%)';
    updateTutorialScrollHint(null);
  } else {
    const r = target.getBoundingClientRect();
    updateTutorialScrollHint(r);
    const pad = 6;
    hi.classList.remove('center');
    hi.style.top = (r.top-pad)+'px'; hi.style.left = (r.left-pad)+'px';
    hi.style.width = (r.width+pad*2)+'px'; hi.style.height = (r.height+pad*2)+'px';
    box.style.transform = 'none';
    const boxW = 280, gap = 16, arrowSize = 11;
    let bx, by, arrowCls;
    if (step.placement === 'bottom') { bx = r.left+r.width/2-boxW/2; by = r.bottom+pad+gap; arrowCls='top'; }
    // hauteur RÉELLE de la boîte (2026-07-08, bug corrigé) : une hauteur fixe de 140 supposait un
    // texte court — un step avec un texte plus long (ex: tutoriel du Compendium) rendait une boîte
    // bien plus haute, qui débordait alors SUR l'élément ciblé au lieu de rester au-dessus
    else if (step.placement === 'top') { bx = r.left+r.width/2-boxW/2; by = r.top-pad-gap-box.offsetHeight; arrowCls='bottom'; }
    else if (step.placement === 'right') { bx = r.right+pad+gap; by = r.top+r.height/2-70; arrowCls='left'; }
    else { bx = r.left-pad-gap-boxW; by = r.top+r.height/2-70; arrowCls='right'; } // 'left' par défaut
    bx = Math.max(10, Math.min(window.innerWidth-boxW-10, bx));
    // clamp sur la hauteur RÉELLE de la boîte (2026-07-10, bug corrigé) : l'ancien clamp supposait
    // une hauteur fixe de 160 (comme l'ancien bug de placement 'top' corrigé le 2026-07-08, voir
    // commentaire ci-dessus) -- un step avec un texte long (ex: tutoriel Marché commun) ET une
    // cible proche du bord bas de l'écran produisait alors une boîte coupée hors du viewport.
    by = Math.max(10, Math.min(window.innerHeight-box.offsetHeight-10, by));
    box.style.left = bx+'px'; box.style.top = by+'px';
    arrow.style.display = '';
    arrow.className = arrowCls;
    if (arrowCls==='top' || arrowCls==='bottom') {
      arrow.style.left = (r.left+r.width/2-9)+'px';
      arrow.style.top = arrowCls==='top' ? (r.bottom+pad+2)+'px' : (r.top-pad-13)+'px';
    } else {
      arrow.style.top = (r.top+r.height/2-9)+'px';
      arrow.style.left = arrowCls==='left' ? (r.right+pad+2)+'px' : (r.left-pad-13)+'px';
    }
  }
}
/** Affiche le step de tutoriel courant (activeTutorialSteps[tutorialStepIdx]) : titre/texte/boutons, exécute son hook `before` s'il en a un, positionne le spotlight. */
function showTutorialStep() {
  const step = activeTutorialSteps[tutorialStepIdx];
  $a('tutStepLbl').textContent = `${i18next.t('backend:backend.tutorial.step_label')} ${tutorialStepIdx+1} / ${activeTutorialSteps.length}`;
  $a('tutTitle').textContent = step.title[LANG];
  $a('tutText').textContent = step.text[LANG];
  $a('tutSkipBtn').textContent = i18next.t('backend:backend.tutorial.skip');
  $a('tutPrevBtn').textContent = i18next.t('backend:backend.tutorial.prev');
  $a('tutPrevBtn').disabled = tutorialStepIdx <= 0;
  $a('tutNextBtn').textContent = step.final ? i18next.t('backend:backend.tutorial.finish') : i18next.t('backend:backend.tutorial.next');
  // certains steps ont besoin de forcer temporairement un état pour être visibles (ex: le suivi de
  // quêtes) — voir tutTrackerForced. Le nettoyage correspondant (after) est appelé en quittant le step.
  if (step.before) step.before();
  positionTutorialStep();
}
// referme proprement le step courant avant d'en changer (ou de terminer) : appelle son "after" s'il
// en a un (idempotent par design, voir tutTrackerForced — donc sans risque si appelé deux fois)
/** Referme proprement le step de tutoriel courant (exécute son hook `after` idempotent) avant d'en changer ou de terminer. */
function leaveTutorialStep() {
  const step = activeTutorialSteps[tutorialStepIdx];
  if (step && step.after) step.after();
}
// suivi pixel perfect de la cible à CHAQUE frame (donc y compris pendant un scroll, quelle que
// soit sa source : molette, glisser la scrollbar, scroll d'un conteneur interne...) — plus fiable
// qu'un event "scroll" (qui ne remonte pas depuis les conteneurs internes) ou qu'un debounce
let tutorialRafId = 0;
/** Boucle requestAnimationFrame qui suit pixel-perfect la cible du step de tutoriel (survit à tout scroll, y compris depuis un conteneur interne), s'arrête quand tutorialStepIdx repasse à -1. */
function tutorialTrackLoop() {
  if (tutorialStepIdx < 0) { tutorialRafId = 0; return; }
  positionTutorialStep();
  tutorialRafId = requestAnimationFrame(tutorialTrackLoop);
}
// steps : liste d'étapes à jouer (par défaut le tutoriel d'arrivée) ; resetView : si true (défaut),
// ferme les panneaux ouverts et repart sur la vue Zone — mis à false pour le tutoriel du Compendium
// qui doit au contraire rester affiché derrière le spotlight pour pouvoir en montrer les éléments
// suivi de progression admin (2026-07-19, demande explicite) : optionnel, réservé au tutoriel
// d'arrivée (trackId:'onboarding') -- les autres tutoriels (Compendium/Cron/objets) ont déjà leur
// propre suivi via markItemTutorialSeen (progression/notifications-quests.js) et ne passent jamais
// trackId, donc ce mécanisme reste totalement inerte pour eux (activeTutorialTrackId reste null).
let activeTutorialTrackId = null;
// fire-and-forget, même garde que markItemTutorialSeen (sb && currentUser && !isGuest()) -- réutilise
// la RPC mark_item_tutorial_seen (généralisée le 2026-07-19 avec p_last_step/p_completed, voir
// migration 20260719180000_onboarding_stats.sql) plutôt qu'une RPC dédiée en double.
/** @param {boolean} completed @param {boolean} skipped. Journalise la progression du tutoriel suivi (RPC mark_item_tutorial_seen), fire-and-forget. No-op si aucun trackId actif ou invité. */
function reportTutorialProgress(completed, skipped) {
  if (!activeTutorialTrackId) return;
  if (!sb || !currentUser || (typeof isGuest === 'function' && isGuest())) return;
  try {
    // même bug que log_playtime_ping ci-dessus (ligne ~1004) : le builder Postgrest n'a pas de
    // .catch(), seulement .then() -- .then(null, cb) reste fire-and-forget sans planter silencieusement.
    sb.rpc('mark_item_tutorial_seen', {
      p_tutorial_id: activeTutorialTrackId, p_skipped: !!skipped, p_last_step: tutorialStepIdx, p_completed: !!completed,
    }).then(null, ()=>{});
  } catch(e) {}
}
/** @param {object[]} [steps] - liste d'étapes à jouer (défaut TUTORIAL_STEPS). @param {{resetView?:boolean, trackId?:?string}} [opts] - resetView ferme les panneaux et revient à la Zone (false pour un tutoriel qui doit rester affiché derrière son spotlight) ; trackId active le suivi de progression admin. Lance le moteur générique de tutoriel. No-op si pas authentifié. */
function startTutorial(steps = TUTORIAL_STEPS, { resetView = true, trackId = null } = {}) {
  // défense en profondeur (2026-07-20, voir maybeQueueTutorialById, notifications-quests.js pour
  // le vrai correctif) : jamais de tutoriel avant une authentification réelle, même via un futur
  // appelant qui oublierait cette garde.
  if (!currentUser) return;
  activeTutorialSteps = steps;
  activeTutorialTrackId = trackId;
  if (resetView) { questsPanelOpen = false; $a('infoOverlay').classList.remove('open'); currentActivity = 'zone'; showActivityPage('zone'); }
  tutorialStepIdx = 0;
  $a('tutorialOverlay').classList.add('open');
  showTutorialStep();
  reportTutorialProgress(false, false); // démarré (last_step=0, ni terminé ni passé)
  if (!tutorialRafId) tutorialRafId = requestAnimationFrame(tutorialTrackLoop);
}
/** @param {boolean} skipped - vrai si le joueur a cliqué "Passer" plutôt que terminé toutes les étapes. Ferme le tutoriel actif, journalise la progression finale. */
function endTutorial(skipped) {
  leaveTutorialStep();
  reportTutorialProgress(!skipped, !!skipped);
  activeTutorialTrackId = null;
  tutorialStepIdx = -1;
  $a('tutorialOverlay').classList.remove('open');
}
$a('tutNextBtn').onclick = () => {
  const step = activeTutorialSteps[tutorialStepIdx];
  leaveTutorialStep();
  if (step.final) { endTutorial(false); return; }
  tutorialStepIdx++; showTutorialStep();
  reportTutorialProgress(false, false); // progression normale (Suivant), pas encore terminé
};
$a('tutSkipBtn').onclick = () => endTutorial(true);
$a('tutPrevBtn').onclick = () => {
  if (tutorialStepIdx <= 0) return;
  leaveTutorialStep();
  tutorialStepIdx--; showTutorialStep();
};

// ---------- suivi des patch notes lus ----------
// principe demandé : le tag NEW reste visible pendant TOUTE la session en cours (même après
// avoir défilé dessus), et n'est retiré définitivement qu'à la fermeture de l'onglet — pas avant.
// readPatches/seenThisSession sont déclarés dans game-core.js (évite un piège de zone morte
// temporelle une fois le jeu regroupé en un seul fichier -- unreadPatchCount() les lit dès le
// tout premier hud() synchrone au démarrage, avant que CE fichier n'ait fini de charger -- voir
// le commentaire juste avant buildZoneList() dans game-core.js).
// index (dans PATCH_NOTES, 0 = le plus récent) du début de la page actuellement affichée
// (2026-07-11, demande explicite : "enleve le scroll... met un bouton vers le haut/vers le bas")
// -- persisté par joueur, remplace l'ancien "velia-patch-scroll" (position de pixels).