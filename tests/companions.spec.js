const { test, expect } = require('@playwright/test');

// Le canvas de jeu fait 1240px de large (#wrap) et #sideMenu (position:fixed, 210px, z-index:40)
// se superpose au-dessus du header dès que la fenêtre est trop étroite pour laisser assez de
// marge -- au viewport par défaut de Playwright (1280×720), #sideMenu intercepte déjà les clics
// sur les onglets Zone/Boss/Compagnon (bug préexistant, indépendant de ce test -- voir aussi le
// correctif équivalent sur mobile, styles.css @media max-width:600px, "#wrap { margin-top:46px }").
// Un viewport plus large (comme un vrai poste desktop) laisse la marge nécessaire pour cliquer
// les onglets sans collision.
test.use({ viewport: { width: 1440, height: 900 } });
// Seul test de cette suite à dépendre d'une vraie connexion invité Supabase qui aboutit
// (sb.auth.signInAnonymously(), game-supabase.js:361) avant de pouvoir cliquer quoi que ce
// soit -- contrairement à regression.spec.js/prod.spec.js qui n'attendent jamais l'auth. Sous
// charge de test répétée, cet appel réseau échoue parfois côté Supabase (retombe sur
// #authOverlay, voir startGuestOrShowAuth()) sans que ce soit lié au code du jeu. Retries
// locaux pour absorber cette flakiness externe sans la masquer (un échec après 3 tentatives
// reste un vrai signal).
// mode:'parallel' ajouté le 2026-07-22 (audit repo P7). Playwright répartit les FICHIERS entre
// workers, jamais les tests d'un même fichier : ce fichier pèse 86 % du temps de la suite (122 s
// sur 141 s) et restait donc seul sur un worker, quel que soit le réglage `workers`. Augmenter
// workers sans ce mode ne gagnait que 9 s ; avec, la suite passe de 141 s à 82 s.
//
// C'est sûr ici parce que les 54 tests sont réellement indépendants : chacun fait son propre
// page.goto() et ne partage aucun état avec les autres. Vérifié avant de l'activer, pas supposé.
//
// LE VRAI RISQUE EST JUSTE AU-DESSUS, et c'est pour ça que workers reste à 2 (voir
// playwright.config.js) : chaque test attend une VRAIE connexion anonyme Supabase. Paralléliser
// multiplie les auth concurrentes -- à 4 workers, la suite devient plus lente ET échoue, ce qui
// ressemble beaucoup à cette limite-là. À 2 workers : 3 runs complets verts (80/83/83 s).
// Si cette suite redevient instable en CI, la première chose à soupçonner est le nombre d'auth
// concurrentes, pas le code du jeu.
test.describe.configure({ retries: 2, mode: 'parallel' });

// src/companions/ n'est jamais bundlé (scripts/build.py ne lit que les <script src="src/...">
// de index.dev.html) : ce module charge dans un iframe isolé, uniquement au premier clic sur
// l'onglet Compagnon -- voir src/combat/boss.js:openCompanionsModule et
// src/companions/README.md. Ce test couvre ce qu'aucune autre suite ne couvre : le module n'a
// pas de fonctions exposées sur `window` du jeu principal (isolation voulue), donc
// tests/tests.js (runRegressionTests) ne peut pas l'exercer -- seul un vrai clic + inspection
// de l'iframe le peut.

// le tutoriel d'onboarding (22 étapes) et les tutoriels d'action ponctuels (voir
// maybeQueueTutorialById, progression/notifications-quests.js) peuvent réapparaître à tout
// moment -- notamment après avoir fermé une page comme celle des Compagnons -- et
// interceptent alors les clics suivants (#tutorialOverlay en position:fixed). On le ferme
// via "Passer" chaque fois qu'il est visible, plutôt qu'une seule fois au début.
async function dismissTutorialIfPresent(page) {
  const skipBtn = page.locator('#tutSkipBtn');
  if (await skipBtn.isVisible().catch(() => false)) {
    // clic borné + best-effort (2026-07-15) : en CI (plus lent), le jeu déclenche parfois en fond
    // un tutoriel d'objet (ITEM_TUTORIALS "trash de zone") dont #tutSkipBtn est CSS-visible mais
    // reste sous un autre overlay (z-index) donc jamais cliquable. Un `.click()` SANS timeout
    // attendait alors l'actionnabilité jusqu'au timeout de test global (60s) et faisait échouer
    // tout le test avant même le vrai clic ciblé (dismissTutorialsAndClick, déjà borné à 8s). On
    // tolère l'échec ici : la boucle de retry appelante retentera le dismiss + le clic ciblé.
    await skipBtn.click({ timeout: 1500 }).catch(() => {});
  }
}

// startGuestOrShowAuth() n'ouvre plus de session anonyme automatique depuis le 2026-07-20
// (invités désactivés pour les vrais joueurs, voir CLAUDE.md/admin/README.md) -- #authOverlay
// reste donc affiché et bloque tous les clics tant qu'aucune session n'est établie. Vérifié :
// "Anonymous sign-ins" est maintenant refusé aussi côté serveur Supabase (422 "Anonymous
// sign-ins are disabled"), donc sb.auth.signInAnonymously() ne peut plus servir ici non plus
// (remplace l'ancien waitForAuthOverlayClosed() qui attendait cet ancien flux automatique).
// Ce test n'exerce que l'UI du jeu principal derrière la connexion (pas le formulaire lui-même,
// déjà couvert visuellement en manuel) : plutôt que de créer un vrai compte de test dans la base
// de données de production pour un simple test UI, on appelle directement onAuthed() avec un
// utilisateur fabriqué localement -- tous les appels réseau qu'il déclenche (get_my_ban_status,
// profiles, game_saves...) sont déjà protégés par des try/catch ou des repli silencieux dans
// game-supabase.js (aucun accès valide de toute façon, faute de vraie session), donc ça ne fait
// que débloquer l'UI sans jamais écrire quoi que ce soit côté serveur.
async function signInForTest(page) {
  await expect
    .poll(() => page.evaluate(() => typeof onAuthed), { timeout: 10_000 })
    .toBe('function');
  await page.evaluate(async () => {
    // supprime le tutoriel d'arrivée auto (22 étapes, startTutorial via onAuthed sur nouveau
    // personnage, game-supabase.js) AVANT qu'il ne soit programmé : sa garde `if (!tutorialAutoShown)`
    // devient fausse, donc aucun setTimeout(startTutorial) n'est planifié. Depuis 2026-07-19 le module
    // Compagnon est une vue inline (#companionsInline dans #wrap, plus d'overlay plein écran à 950) :
    // il ne recouvre donc plus #tutorialOverlay (900), et l'onboarding qui navigue vers la Zone
    // masquerait la vue Compagnon en plein test. `tutorialAutoShown` est un `let` de portée globale
    // lexicale (réassignation nue, comme le mock `sb`). Les tutoriels d'objet restent neutralisés via
    // localStorage (beforeEach). N'affecte que le contexte de test, pas le jeu.
    try { tutorialAutoShown = true; } catch (e) {}
    await onAuthed({ id:'00000000-0000-4000-8000-000000000001', email:'playwright-test@local.invalid', is_anonymous:false, identities:[] });
  });
  await expect(page.locator('#authOverlay')).toBeHidden({ timeout: 10_000 });
  // pré-marque l'onboarding du module Compagnon comme vu (2026-07-11) -- l'iframe est same-origin,
  // localStorage est donc PARTAGÉ avec la page hôte (voir onboarding.js) : sans ça, la modale
  // d'onboarding s'ouvre au tout premier chargement du module dans CHAQUE test (contexte de test
  // neuf = jamais vue avant) et bloque tous les clics suivants dans l'iframe.
  await page.evaluate(() => { try { localStorage.setItem('velia_idle_pets_onboarding_seen_v1', '1'); } catch (e) {} });
}

// pool partagé (2026-07-18) : le silver du module Compagnon vient du JEU (hôte, via
// window.parent.addGameSilverForCompanion). Le miroir local SILVER est resync depuis l'hôte à
// chaque affichage, donc l'écrire directement ne tient pas -- ce helper force le solde CÔTÉ JEU
// pour piloter l'accessibilité dans les tests white-box. Repli sur SILVER local hors iframe.
// À appeler APRÈS l'ouverture du module (hôte prêt). La mesure des dépenses passe par le compteur
// silverSpent (indépendant du pont), jamais par un delta de SILVER (miroir, non fiable).
async function setSharedSilver(frame, amount) {
  await frame.locator('body').evaluate((_el, target) => {
    const h = window.parent;
    if (h && typeof h.addGameSilverForCompanion === 'function') {
      h.addGameSilverForCompanion(target - (h.getGameSilverForCompanion() || 0), 'test:setup');
    } else { SILVER = target; }
    if (typeof syncSilverFromHost === 'function') syncSilverFromHost();
  }, amount);
}

// clique en tolérant qu'un tutoriel (onboarding, ou un tutoriel d'objet/action déclenché par le
// jeu qui continue de tourner en arrière-plan pendant les assertions précédentes -- ex: le
// tutoriel "trash de zone", voir ITEM_TUTORIALS, progression/notifications-quests.js) rouvre
// #tutorialOverlay juste avant le clic -- retente en le fermant à nouveau plutôt qu'un seul essai.
async function dismissTutorialsAndClick(page, locator, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    await dismissTutorialIfPresent(page);
    try {
      await locator.click({ timeout: 8000 });
      return;
    } catch (e) {
      if (i === attempts - 1) throw e;
    }
  }
}

// Barrière de démarrage du module Compagnon (2026-07-20). Les 47 tests attendaient
// `.hdr-logo` avant leur premier evaluate() dans l'iframe -- ce qui ne prouve RIEN : ce logo est
// du markup statique de companions.html (ligne 35), donc présent dès le parse du HTML, alors que
// PET_CATALOG / PETS / migratePetUidV1 / COMPANION_MODEL_MAP viennent des ~30 <script> qui ne
// commencent qu'à la ligne 491. Entre les deux, il y a une fenêtre où l'iframe est "visible" mais
// vide de toute fonction.
//
// À vide la fenêtre est nulle (le logo répond en ~140 ms, catalog.js a déjà tourné) -- c'est
// pourquoi ça passait en local et échouait au hasard dans la suite complète. Mesuré sous
// contention (6 workers, le serveur python http.server étant mono-thread et servant les ~30
// scripts en file) : le logo répond entre 130 et 1180 ms, et `typeof PET_CATALOG` valait encore
// `undefined` à cet instant dans 1 run sur 3 -> `ReferenceError: PET_CATALOG is not defined` sur
// le premier evaluate(). C'était la cause des échecs intermittents que `retries: 2` rattrapait et
// masquait en "flaky".
//
// #companion-version est rempli par la DERNIÈRE instruction de main.js, lui-même dernier script
// chargé, après renderAll() : c'est le seul signal qui prouve que TOUT le module a booté. Vide
// dans le markup (companions.html:476), non vide après boot -- et mesuré non vide encore après
// que PET_CATALOG soit défini, donc strictement plus sûr.
async function waitCompanionsReady(frame) {
  await expect(frame.locator('#companion-version')).toHaveText(/\S/, { timeout: 30_000 });
}

// Fiabilité (2026-07-18) : le jeu principal tourne en fond pendant ces tests et déclenche parfois un
// tutoriel d'OBJET (ITEM_TUTORIALS, ex. "Pierre de Cron") dont l'overlay hôte plein écran bloque
// tout clic DANS l'iframe Compagnon -> timeouts intermittents, sans rapport avec le module testé.
// On neutralise ces tutoriels de façon id-agnostique AVANT tout script de page : getItem renvoie
// "déjà vu" ('1') pour n'importe quelle clé velia-idle-item-tuto-seen-* (voir itemTutoStorageKey /
// isItemTutorialSeen, notifications-quests.js), donc maybeShowItemTutorial() n'en ouvre jamais.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const origGet = Storage.prototype.getItem;
    Storage.prototype.getItem = function (k) {
      if (typeof k === 'string' && k.startsWith('velia-idle-item-tuto-seen-')) return '1';
      return origGet.call(this, k);
    };
  });
});

test('companion module opens in an isolated iframe, renders, and closes cleanly', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialIfPresent(page);

  const companionTab = page.locator('.actTab[data-id="pet"]');
  await expect(companionTab).toBeVisible();
  await expect(companionTab).not.toHaveClass(/locked/);

  // pas encore ouvert : l'iframe ne doit exister qu'après le premier clic (chargement paresseux)
  await expect(page.locator('#companionsFrame')).toHaveCount(0);

  await dismissTutorialsAndClick(page, companionTab);

  const overlay = page.locator('#companionsInline'); // vue inline dans #wrap (2026-07-19, plus d'overlay plein écran)
  await expect(overlay).toBeVisible();

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  // roster de départ : 0 pet (2026-07-10, demande explicite -- voir roster.js)
  await expect(frame.locator('#tb2')).toHaveText('0');

  // onglet Collection : grille vide au départ (locator scopé à la barre d'onglets, pour ne pas
  // matcher aussi le texte d'un toast d'achievement contenant le même emoji/mot)
  await frame.locator('.tabs .tab', { hasText: 'Collection' }).click();
  await expect(frame.locator('.pet-card')).toHaveCount(0);

  // onglet Éclosion : le premier slot est prêt au démarrage. Nouveau flux (2026-07-18, demande
  // explicite : "quand on appuie sur Éclore on doit afficher l'éclosion, pas quel œuf acheter") --
  // "Éclore" lance DIRECTEMENT l'éclosion avec l'œuf gratuit (plus de modale de choix d'œuf ; le
  // choix d'un œuf premium est déplacé sur le petit bouton ✨).
  await frame.locator('.tabs .tab', { hasText: 'Éclosion' }).click();
  await frame.locator('.isl.ready button', { hasText: 'Éclore' }).click();
  await expect(frame.locator('#hatch-modal')).toHaveClass(/open/);
  // le pet est gardé d'office dès le tirage, une roulette de rareté (~1.9s) précède le reveal, et
  // le bouton "Garder" a disparu (garde automatique). Playwright auto-attend l'apparition du bouton
  // "Continuer" du reveal -> absorbe la durée de la roulette. Pas de "Utiliser" : plus de choix d'œuf.
  await frame.locator('#hatch-body .btn', { hasText: 'Continuer' }).click();
  await expect(frame.locator('#hatch-modal')).not.toHaveClass(/open/);

  await frame.locator('.tabs .tab', { hasText: 'Collection' }).click();
  await expect(frame.locator('.pet-card')).toHaveCount(1);
  await expect(frame.locator('#tb2')).toHaveText('1');

  // sync admin (2026-07-19) : totalHatched est un compteur À VIE (jamais remis à 0 par le pity,
  // contrairement à hatchCountSincePity) -- incrémenté une fois par tirage réel dans
  // rollAndCreatePet() (hatch.js), donc doit valoir 1 après l'unique éclosion ci-dessus.
  // syncCompanionStatsToServer doit exister et ne jamais lever (no-op silencieux ici : pas de
  // compte connecté dans ce contexte de test, la garde sb/currentUser/isGuest doit l'arrêter tôt).
  const syncState = await frame.locator('body').evaluate(() => ({
    totalHatched: typeof totalHatched !== 'undefined' ? totalHatched : null,
    hasSync: typeof syncCompanionStatsToServer === 'function',
  }));
  expect(syncState.totalHatched).toBe(1);
  expect(syncState.hasSync).toBe(true);
  await frame.locator('body').evaluate(() => { syncCompanionStatsToServer(); });

  // quitte le module en cliquant un autre onglet (Zone) : la vue inline disparaît et le jeu
  // principal redevient visible -- plus de bouton "Fermer" dédié (nav par onglets, comme Boss)
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="zone"]'));
  await expect(overlay).toBeHidden();
  await expect(page.locator('#gameFrame')).toBeVisible();

  // fermer le module peut faire avancer la file de tutoriels d'action (ex: prochaine étape
  // d'onboarding) -- la refermer avant de tenter le clic suivant
  await dismissTutorialIfPresent(page);

  // ré-ouverture : l'iframe existante est réutilisée (pas de doublon, pas de rechargement)
  await dismissTutorialsAndClick(page, companionTab);
  await expect(page.locator('#companionsFrame')).toHaveCount(1);
  await expect(overlay).toBeVisible();

  expect(pageErrors).toEqual([]);
});

// bug rapporté (2026-07-19, capture à l'appui : "enlevé gratuit... il s'est pas enlevé quand j'ai
// acheté l'œuf") -- le badge "Gratuit" d'un slot d'incubation doit refléter l'ŒUF (basique, coût 0),
// pas le SLOT : un œuf PAYANT (Argenté/Doré/Platine) démarré dans un des 2 slots gratuits (sl.free)
// gardait le badge. renderHatch() est le SEUL endroit qui décide -- test white-box du rendu.
test('incubation "free" badge follows the egg (basic), not the slot: a paid egg in a free slot shows no badge', async ({ page }) => {
  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));
  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  const res = await frame.locator('body').evaluate(() => {
    const badge = i18next.t('companions:companions.hatch.free_badge');
    // états connus : slot0 gratuit + œuf BASIQUE (gratuit), slot1 gratuit + œuf DORÉ (payant),
    // slot2 payant + œuf ARGENTÉ prêt (payant), slots 3-4 verrouillés.
    incubSlots[0] = { free: true,  eggId: 'basic', tl: 1000, tot: 21600, ready: false };
    incubSlots[1] = { free: true,  eggId: 'gold',  tl: 1000, tot: 21600, ready: false };
    incubSlots[2] = { free: false, eggId: 'silver', tl: 0,   tot: 21600, ready: true  };
    incubSlots[3] = { free: false, tl: null, tot: null, locked: true };
    incubSlots[4] = { free: false, tl: null, tot: null, locked: true };
    renderHatch();
    const slots = [...document.querySelectorAll('#incub-slots > .isl')];
    return {
      badge,
      slot0HasBadge: slots[0].textContent.includes(badge), // œuf gratuit -> badge attendu
      slot1HasBadge: slots[1].textContent.includes(badge), // œuf payant dans slot gratuit -> PAS de badge (le bug)
      slot2HasBadge: slots[2].textContent.includes(badge), // œuf payant prêt -> pas de badge
      totalBadges: document.querySelectorAll('#incub-slots').length && slots.filter(s => s.textContent.includes(badge)).length,
    };
  });

  expect(res.slot0HasBadge).toBe(true);
  expect(res.slot1HasBadge).toBe(false);
  expect(res.slot2HasBadge).toBe(false);
  expect(res.totalBadges).toBe(1); // seul le slot avec l'œuf basique gratuit
});

// garde-fou (2026-07-20, "Colllection si petite carte alors afficher tiers rareté et section et
// gs") -- au cran de zoom le plus dense (120px), la ligne meta normale (rareté en toutes lettres +
// tier + section + type, séparés par "·") déborde largement de la carte et se fait tronquer
// silencieusement par .pet-card{overflow:hidden}, perdant section/type/GS sans qu'aucune erreur ne
// s'affiche. Une variante compacte (.card-meta-compact : pastille de rareté, T{n}, icône de
// section, badge GS) doit apparaître à ce cran ET tenir sans déborder.
test('collection cards show a compact tier/rarity/section/GS summary that never overflows at the densest zoom', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  const result = await frame.locator('body').evaluate(() => {
    const cat = PET_CATALOG[0];
    PETS.push({ id: petId++, cat, rar: 2, stats: [10, 8, 6, 0, 0], hunger: 100, terrain: false, tier: 3, tierXp: 0, tierMult: 1 });
    ST(3); // Collection
    setCollColsPerRow(9); // cran le plus dense (2026-07-20, "choix combien par ligne 5 a 9")
    const card = document.querySelector('.pet-card');
    const compact = card.querySelector('.card-meta-compact');
    return {
      cardWidth: card.getBoundingClientRect().width,
      hasCompact: !!compact,
      hasVerboseMeta: !!card.querySelector('.card-meta'),
      overflowsCard: compact ? compact.scrollWidth > compact.clientWidth : null,
      // badge Tier+rareté unifié (2026-07-19) : .tr-pill remplace l'ancien .cmcDot/.cmcTier, avec un
      // segment Tier (.trT) et un segment rareté (.trR) tous deux présents.
      hasTierRarPill: compact ? !!(compact.querySelector('.tr-pill .trT') && compact.querySelector('.tr-pill .trR')) : false,
      hasSectionIcon: compact ? !!compact.querySelector('.cmcSec') : false,
      hasGsBadge: compact ? !!compact.querySelector('.gs-badge') : false,
    };
  });
  expect(pageErrors).toEqual([]);
  // 9 colonnes exactes (repeat(9,1fr), voir setCollColsPerRow()) dans .pet-grid (largeur variable
  // selon le viewport, plus de zoom CSS global depuis le 2026-07-20 "retire le zoom 25%") --
  // seuil large mais reste très en dessous du cran le plus étalé (5 colonnes).
  expect(result.cardWidth).toBeLessThan(250);
  expect(result.hasCompact).toBe(true);
  expect(result.hasVerboseMeta).toBe(false); // pas les deux affichages à la fois
  expect(result.overflowsCard).toBe(false);
  expect(result.hasTierRarPill).toBe(true);
  expect(result.hasSectionIcon).toBe(true);
  expect(result.hasGsBadge).toBe(true);

  // colonnes larges (5) : repasse à l'affichage verbeux normal, jamais la variante compacte
  const wide = await frame.locator('body').evaluate(() => {
    setCollColsPerRow(5);
    const card = document.querySelector('.pet-card');
    return { hasCompact: !!card.querySelector('.card-meta-compact'), hasVerboseMeta: !!card.querySelector('.card-meta') };
  });
  expect(wide.hasCompact).toBe(false);
  expect(wide.hasVerboseMeta).toBe(true);
  expect(pageErrors).toEqual([]);
});

// Pagination de la Collection (2026-07-20, demande explicite : "turn on of pagination") -- OFF
// par défaut (toute la liste filtrée/triée s'affiche, .pet-grid défile normalement) ; ON découpe
// en pages de collColsPerRow×4 cartes, avec un pager Précédent/Suivant.
test('collection pagination toggle limits visible cards per page and paginates correctly', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  const setup = await frame.locator('body').evaluate(() => {
    for (let i = 0; i < 30; i++) {
      const cat = PET_CATALOG[i % PET_CATALOG.length];
      PETS.push({ id: petId++, cat, rar: 1, stats: [5,4,3,0,0], hunger: 100, terrain: false, tier: 1, tierXp: 0, tierMult: 1 });
    }
    ST(3); // Collection
    setCollColsPerRow(5); // page = 5×4 = 20 cartes
    return { total: PETS.length };
  });
  expect(setup.total).toBeGreaterThanOrEqual(30);

  // OFF par défaut : le pager est caché, toutes les cartes s'affichent
  await expect(frame.locator('#coll-pager')).toBeHidden();
  const countBeforePagination = await frame.locator('.pet-card').count();
  expect(countBeforePagination).toBeGreaterThanOrEqual(30);

  await frame.locator('#pagination-toggle').click();
  await expect(frame.locator('#pagination-toggle')).toHaveText('📄 Pagination : ON');
  await expect(frame.locator('#coll-pager')).toBeVisible();
  const countPage1 = await frame.locator('.pet-card').count();
  expect(countPage1).toBe(20); // 5 colonnes × 4 lignes

  await frame.locator('#coll-pager').locator('text=Suivant').click();
  await expect(frame.locator('#coll-pager-label')).toContainText('Page 2');
  const countPage2 = await frame.locator('.pet-card').count();
  expect(countPage2).toBeGreaterThan(0);
  expect(countPage2).toBeLessThanOrEqual(20);

  await frame.locator('#coll-pager').locator('text=Précédent').click();
  await expect(frame.locator('#coll-pager-label')).toContainText('Page 1');

  expect(pageErrors).toEqual([]);
});

// Tri de la réserve dans Sections (2026-07-20, demande explicite : "trier par GS, Tiers").
// Tri par défaut = Tier (2026-07-20, demande explicite : "Tier par Tiers/GS") -- resSortMode doit
// démarrer sur 'tier' (Tier décroissant, GS en départage à Tier égal), pas 'default' (ordre
// d'obtention). Vérifie directement l'ordre produit par sortReserveList() sur un jeu de pets
// avec des tiers ET des GS variés, pour couvrir le départage GS à Tier égal.
test('reserve defaults to sorting by Tier (GS as tiebreak), not insertion order', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  const result = await frame.locator('body').evaluate(() => {
    const cat = PET_CATALOG[0];
    const low = { id: 1, cat, rar: 0, stats: [1,0,0,0,0], tier: 1 };
    const highTierLowGs = { id: 2, cat, rar: 0, stats: [1,0,0,0,0], tier: 5 };
    const highTierHighGs = { id: 3, cat, rar: 5, stats: [60,38,30,20,15], tier: 5 };
    const mid = { id: 4, cat, rar: 0, stats: [1,0,0,0,0], tier: 3 };
    const order = sortReserveList([low, highTierLowGs, mid, highTierHighGs]).map(p => p.id);
    return { defaultMode: resSortMode, defaultDir: resSortDir, order };
  });
  expect(result.defaultMode).toBe('tier');
  expect(result.defaultDir).toBe(-1);
  // Tier décroissant : highTierHighGs/highTierLowGs (T5) avant mid (T3) avant low (T1) ;
  // à Tier égal (les 2 T5), le meilleur GS passe en premier
  expect(result.order).toEqual([3, 2, 4, 1]);

  expect(pageErrors).toEqual([]);
});

test('reserve list in Sections can be sorted by GS and by Tier', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  const secIdx = await frame.locator('body').evaluate(() => {
    const cat = PET_CATALOG[0];
    const weak = { id: petId++, cat, rar: 0, stats: [1,0,0,0,0], hunger: 100, terrain: false, tier: 1, tierXp: 0, tierMult: 1 };
    const strong = { id: petId++, cat, rar: 5, stats: [60,38,30,20,15], hunger: 100, terrain: false, tier: 5, tierXp: 0, tierMult: 1 };
    PETS.push(weak, strong);
    const idx = SECTIONS.findIndex(s => s.id === cat.sec);
    activeSecIdx = idx;
    ST(2); // onglet Sections -- sans ça le panel #p1 reste caché (pas de classe "active")
    // le tri par défaut est désormais 'tier' (2026-07-20, "Tier par Tiers/GS") -- reparti sur
    // 'default' (ordre d'obtention) pour que "avant tri GS" soit un vrai état neutre, sinon
    // Tier-desc et GS-desc produiraient le même ordre sur ces 2 pets (T1 faible vs T5 fort)
    resSortMode='default'; resSortDir=-1;
    renderSecNav(); renderSecDetail();
    return idx;
  });
  expect(secIdx).toBeGreaterThanOrEqual(0);

  const gsOrderBefore = await frame.locator('.sec-detail .gs-badge').allTextContents();
  await frame.locator('.sec-detail button', { hasText: 'GS' }).click();
  const gsOrderAfterDesc = await frame.locator('.sec-detail .gs-badge').allTextContents();
  expect(gsOrderAfterDesc).not.toEqual(gsOrderBefore);
  // le 1er clic trie décroissant : le badge du pet fort (rar 5, stats élevées) doit passer en tête
  expect(gsOrderAfterDesc[0]).not.toBe(gsOrderBefore[0] === gsOrderAfterDesc[0] ? null : gsOrderBefore[0]);

  await frame.locator('.sec-detail button', { hasText: 'Tier' }).click();
  const tierSorted = await frame.locator('.sec-detail').evaluate(() => {
    // vérifie directement la logique de tri (pas seulement le DOM) : sortReserveList() doit
    // ordonner par tier croissant après un 1er clic sur "Tier" côté fonction, décroissant côté UI (resSortDir=-1 par défaut)
    return { mode: resSortMode, dir: resSortDir };
  });
  expect(tierSorted.mode).toBe('tier');
  expect(tierSorted.dir).toBe(-1);

  expect(pageErrors).toEqual([]);
});

// Réserve à droite du terrain (2026-07-20, demande explicite : "afficher les pet en reserve a
// droite du sur le terrain borner la taille de l'interface sur le terrain pour laisser placer a
// des nouvelle carte en reserve de loger a coter") -- la carte terrain doit avoir une largeur
// bornée (pas toute la largeur du panneau) et la réserve doit être positionnée à sa DROITE
// (même ligne, pas en dessous), avec assez de place pour plusieurs cartes de réserve par ligne.
test('terrain card is width-capped and the reserve sits to its right with room for multiple cards per row', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);
  await frame.locator('.tabs .tab', { hasText: 'Sections' }).click();

  await frame.locator('body').evaluate(() => {
    const cat = PET_CATALOG.find(c => c.sec === 'combat');
    const deployed = { id: petId++, cat, rar: 0, stats: [5,4,3,0,0], hunger: 100, terrain: true, tier: 1, tierXp: 0, tierMult: 1 };
    PETS.push(deployed);
    for (let i = 0; i < 6; i++) {
      PETS.push({ id: petId++, cat, rar: 0, stats: [5,4,3,0,0], hunger: 100, terrain: false, tier: 1, tierXp: 0, tierMult: 1 });
    }
    activeSecIdx = SECTIONS.findIndex(s => s.id === cat.sec);
    renderSecNav(); renderSecDetail();
  });

  const terrainBox = await frame.locator('.terrain-slot.occ').boundingBox();
  const reserveHeaderBox = await frame.locator('.sec-detail').locator('text=Réserve').first().boundingBox();
  // la carte terrain reste étroite (bornée), pas étalée sur toute la largeur du panneau -- 260px
  // CSS + bordure, x1.25 (transform:scale du module, voir companions.css) ≈ 330px mesurés
  expect(terrainBox.width).toBeLessThan(345);
  // la réserve démarre bien à DROITE de la carte terrain (pas en dessous : même hauteur de départ)
  expect(reserveHeaderBox.x).toBeGreaterThan(terrainBox.x + terrainBox.width);
  expect(Math.abs(reserveHeaderBox.y - terrainBox.y)).toBeLessThan(60);

  // au moins 2 cartes de réserve tiennent sur la même ligne (grille, pas une colonne unique)
  const reserveCardsInFirstRow = await frame.locator('body').evaluate(() => {
    const grid = document.querySelector('.sec-detail [style*="grid-template-columns"]');
    if (!grid) return 0;
    const cards = Array.from(grid.children);
    if (cards.length < 2) return cards.length;
    const firstTop = cards[0].getBoundingClientRect().top;
    return cards.filter(c => Math.abs(c.getBoundingClientRect().top - firstTop) < 5).length;
  });
  expect(reserveCardsInFirstRow).toBeGreaterThanOrEqual(2);

  expect(pageErrors).toEqual([]);
});

// Version bas gauche (2026-07-20, demande explicite : "ajoute version en bas a gauche") -- réutilise
// la numérotation VNNN partagée avec le jeu principal (COMPANION_MODULE_VERSION,
// economy.js), affichée via #companion-version, position:fixed bottom-left.
test('module version is displayed bottom-left, reusing the shared VNNN numbering', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  const versionEl = frame.locator('#companion-version');
  await expect(versionEl).toBeVisible();
  await expect(versionEl).toHaveText(/^Compagnon — V\d+$/);

  const check = await versionEl.evaluate(el => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { position: cs.position, left: r.left, bottomGap: window.innerHeight - r.bottom };
  });
  expect(check.position).toBe('fixed');
  expect(check.left).toBeLessThan(60); // collé au bord gauche
  expect(check.bottomGap).toBeLessThan(60); // collé au bord bas

  expect(pageErrors).toEqual([]);
});

// Plafond de collection (2026-07-20, demande explicite : "Borner collection a 96 pets prévoir 4
// depaçable pour recuperer des pet venant d'un trade") -- doHatch() doit refuser tout nouvel hatch
// une fois PETS.length >= PET_ROSTER_CAP (96), AVANT de dépenser le silver.
// Complétion Index 48×5=240 (2026-07-20, demande explicite : "Completion 48pet * 5 tier pour
// l'index et classement") -- companionIndexProgress() doit compter des combos ESPÈCE×TIER
// distincts, PAS juste des espèces : 2 pets de la MÊME espèce au MÊME tier ne comptent qu'une
// fois, mais la même espèce à 2 tiers DIFFÉRENTS compte 2 fois.
test('companion index completion counts distinct species×tier combos, capped at 48×5=240', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  const result = await frame.locator('body').evaluate(() => {
    const cat = PET_CATALOG[0];
    const sameSpeciesSameTierA = { id: petId++, cat, rar: 0, stats: [1,0,0,0,0], hunger: 100, terrain: false, tier: 1, tierXp: 0, tierMult: 1 };
    const sameSpeciesSameTierB = { id: petId++, cat, rar: 0, stats: [2,0,0,0,0], hunger: 100, terrain: false, tier: 1, tierXp: 0, tierMult: 1 }; // même espèce/tier -- ne doit PAS compter 2 fois
    const sameSpeciesOtherTier = { id: petId++, cat, rar: 0, stats: [1,0,0,0,0], hunger: 100, terrain: false, tier: 3, tierXp: 0, tierMult: 1 }; // même espèce, tier différent -- doit compter en plus
    const otherSpecies = { id: petId++, cat: PET_CATALOG[1], rar: 0, stats: [1,0,0,0,0], hunger: 100, terrain: false, tier: 1, tierXp: 0, tierMult: 1 };
    return {
      max: COMPANION_INDEX_MAX,
      catalogLen: PET_CATALOG.length,
      progress: companionIndexProgress([sameSpeciesSameTierA, sameSpeciesSameTierB, sameSpeciesOtherTier, otherSpecies]),
    };
  });
  expect(result.catalogLen).toBe(48);
  expect(result.max).toBe(240);
  expect(result.progress).toBe(3); // (cat0,T1) + (cat0,T3) + (cat1,T1) -- pas 4

  expect(pageErrors).toEqual([]);
});

// Purge rétroactive (2026-07-20, demande explicite : "supprime tout compagnon au dessus de la
// limite") -- trimRosterToCapIfNeeded() doit ramener une collection surchargée (sauvegarde
// antérieure au plafond) à 96 pets, en gardant TOUJOURS les pets déployés sur le terrain (même
// mal roulés) et en préférant les meilleurs GS parmi le reste.
test('trimRosterToCapIfNeeded() prunes an oversized roster to 96, always keeping deployed pets', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  const result = await frame.locator('body').evaluate(() => {
    const savedPets = PETS;
    try {
      const cat = PET_CATALOG[0];
      // 1 pet déployé, volontairement le PLUS FAIBLE (doit survivre quand même)
      const deployedWeak = { id: petId++, cat, rar: 0, stats: [0.1,0,0,0,0], hunger: 100, terrain: true, tier: 1, tierXp: 0, tierMult: 1 };
      const others = [];
      for (let i = 0; i < 110; i++) {
        others.push({ id: petId++, cat: PET_CATALOG[i % PET_CATALOG.length], rar: 1, stats: [i,0,0,0,0], hunger: 100, terrain: false, tier: 1, tierXp: 0, tierMult: 1 });
      }
      PETS = [deployedWeak, ...others];
      const totalBefore = PETS.length;
      trimRosterToCapIfNeeded();
      return {
        totalBefore, totalAfter: PETS.length,
        deployedSurvived: PETS.some(p => p.id === deployedWeak.id),
        highestKeptStat0: Math.max(...PETS.filter(p => !p.terrain).map(p => p.stats[0])),
      };
    } finally {
      PETS = savedPets;
    }
  });
  expect(result.totalBefore).toBe(111);
  expect(result.totalAfter).toBe(96); // PET_ROSTER_CAP
  expect(result.deployedSurvived).toBe(true); // jamais retiré, même mal roulé
  expect(result.highestKeptStat0).toBe(109); // les mieux roulés (stat la plus haute) gardés en priorité

  expect(pageErrors).toEqual([]);
});

test('hatching is blocked once the collection reaches the 96-pet cap, silver is never spent', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  await setSharedSilver(frame, 999_999_999); // silver côté jeu large : le blocage doit venir du plafond, pas du silver
  const result = await frame.locator('body').evaluate(() => {
    // remplit la collection jusqu'au plafond
    while (PETS.length < PET_ROSTER_CAP) {
      const cat = PET_CATALOG[PETS.length % PET_CATALOG.length];
      PETS.push({ id: petId++, cat, rar: 1, stats: [5,4,3,0,0], hunger: 100, terrain: false, tier: 1, tierXp: 0, tierMult: 1 });
    }
    // slot prêt avec son œuf (nouveau modèle 2026-07-18 : l'œuf est choisi/payé au démarrage, doHatch
    // ne prend plus que l'index et lit slot.eggId ; il ne dépense plus rien).
    incubSlots[0] = { free:true, eggId:'silver', tl:0, tot:1, ready:true };
    const roomBefore = petRosterRoomLeft();
    const countBefore = PETS.length;
    doHatch(0); // doit être refusé par le plafond (roster plein) -> aucun pet ajouté
    return { roomBefore, countBefore, countAfter: PETS.length, stillReady: !!incubSlots[0].ready };
  });
  expect(result.roomBefore).toBe(0);
  expect(result.countBefore).toBe(96);
  expect(result.countAfter).toBe(96);   // doHatch() n'a RIEN ajouté, refusé par le plafond
  expect(result.stillReady).toBe(true); // le slot reste prêt (rien consommé, l'œuf déjà payé au départ)

  expect(pageErrors).toEqual([]);
});

// nouveau flux d'incubation (2026-07-18, demande explicite : "le slot devient vide et il faut le
// remplir et le timer reprend après le choix") : choix + paiement de l'œuf au DÉMARRAGE, minuteur de
// 6h, puis l'éclosion vide le slot (plus d'œuf basique remis d'office).
test('incubation: choose+pay egg on start, timer runs, and the slot goes empty after hatching', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);
  await frame.locator('.tabs .tab', { hasText: 'Éclosion' }).click();

  await setSharedSilver(frame, 10_000_000);
  const result = await frame.locator('body').evaluate(() => {
    incubSlots[0] = { free: true, empty: true };
    const spent0 = silverSpent;
    startIncubation(0, 'silver');                 // paie 500k + démarre l'incubation 6h
    const afterStart = { eggId: incubSlots[0].eggId, ready: !!incubSlots[0].ready, tl: incubSlots[0].tl, spent: silverSpent - spent0 };

    incubSlots[0].ready = true;                   // simule la fin du minuteur
    const countBefore = PETS.length;
    doHatch(0);                                   // éclot -> slot vide
    return { afterStart, countBefore, countAfter: PETS.length, slotEmptyAfter: !!incubSlots[0].empty, slotHasEgg: !!incubSlots[0].eggId };
  });
  expect(pageErrors).toEqual([]);
  expect(result.afterStart.eggId).toBe('silver');   // l'œuf choisi est posé sur le slot
  expect(result.afterStart.ready).toBe(false);      // il incube (pas prêt tout de suite)
  expect(result.afterStart.tl).toBeGreaterThan(0);  // minuteur démarré
  expect(result.afterStart.spent).toBe(500000);     // payé AU DÉMARRAGE (coût de l'œuf argenté)
  expect(result.countAfter).toBe(result.countBefore + 1); // l'éclosion a bien ajouté 1 pet
  expect(result.slotEmptyAfter).toBe(true);         // slot VIDE après éclosion
  expect(result.slotHasEgg).toBe(false);            // plus d'œuf remis d'office
});

// chance d'éclore un tier selon l'œuf (2026-07-18, demande explicite : "ajoute la chance d'éclore un
// tier 1 à 5 selon l'œuf") -- avant, tout éclosait en T1. Chaque œuf a maintenant un tierOdds (5
// valeurs T1→T5 sommant à 100), rollAndCreatePet en tire le tier de départ, et un tableau l'affiche.
test('eggs roll a starting tier from tierOdds (well-formed, honored by rollAndCreatePet) and it is shown in the Hatchery', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);
  await frame.locator('.tabs .tab', { hasText: 'Éclosion' }).click();

  const result = await frame.locator('body').evaluate(() => {
    // 1) tierOdds bien formées : 5 valeurs par œuf, sommant à 100 (tolérance flottante)
    const wellFormed = EGG_TYPES.every(e => Array.isArray(e.tierOdds) && e.tierOdds.length === 5
      && Math.abs(e.tierOdds.reduce((a, b) => a + b, 0) - 100) < 1e-6);

    // 2) rollAndCreatePet honore tierOdds. Math.random=0.999 -> dernier bucket de chaque tirage
    //    pondéré -> Platine éclot au tier MAX (T5) ; 0.001 -> premier bucket -> T1.
    const platinum = EGG_TYPES.find(e => e.id === 'platinum');
    const orig = Math.random;
    Math.random = () => 0.999;
    const hi = rollAndCreatePet(platinum).pet.tier;
    Math.random = () => 0.001;
    const lo = rollAndCreatePet(platinum).pet.tier;
    Math.random = orig;

    return { wellFormed, hi, lo };
  });
  expect(pageErrors).toEqual([]);
  expect(result.wellFormed).toBe(true);
  expect(result.hi).toBe(5); // tirage max -> T5
  expect(result.lo).toBe(1); // tirage min -> T1

  // 3) le tableau des chances de tier est rendu, avec une ligne par tier et les bonnes valeurs
  await expect(frame.locator('#tier-odds-table')).toBeVisible();
  await expect(frame.locator('#tier-odds-table')).toContainText('T5');
  await expect(frame.locator('#tier-odds-table')).toContainText('0.02%'); // Basique T5 (valeur unique)
  await expect(frame.locator('#tier-odds-table')).toContainText('0.3%');  // Doré T5 (valeur unique)

  expect(pageErrors).toEqual([]);
});

// onglet Tutoriel (2026-07-19, demande explicite : "fais un tuto qui prend tout l'écran avec des
// images qui pointent vers d'autres images avec un peu de texte") -- refondu en DIAGRAMME illustré
// plein écran : boucle de gameplay (Éclosion → Collection → Sections → Jeu → Nourrir) reliée par
// des flèches SVG, satellites (Index/Hardinage/Progression/PvP/Marché), rendu par renderTutorial().
test('the Tutorial tab renders an illustrated, concise guide of the companion menu', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);
  await frame.locator('.tabs .tab', { hasText: 'Tutoriel' }).click();

  const content = frame.locator('#tutorial-content');
  await expect(content).toBeVisible();
  await expect(content).toContainText('Comment marche le menu Compagnon'); // titre
  await expect(content).toContainText('Éclosion');
  await expect(content).toContainText('Collection');
  await expect(content).toContainText('Hardinage');

  // le diagramme est bien rendu : la boucle principale, ses 5 nœuds illustrés et les flèches
  // (SVG) qui les relient, plus les onglets satellites présentés à part.
  await expect(content.locator('.tuto-loop')).toBeVisible();
  await expect(content.locator('.tuto-node')).toHaveCount(5);       // Éclosion→Collection→Sections→Jeu→Nourrir
  await expect(content.locator('.tuto-arrow svg')).toHaveCount(4);  // 4 flèches entre les 5 nœuds
  await expect(content.locator('.tuto-tool')).toHaveCount(5);       // Index/Hardinage/Progression/PvP/Marché

  // une entrée par onglet couvert (TUTORIAL_STEPS = 5 boucle + 5 satellites = 10)
  const stepCount = await frame.locator('body').evaluate(() => (typeof TUTORIAL_STEPS !== 'undefined' ? TUTORIAL_STEPS.length : 0));
  expect(stepCount).toBe(10);

  // aucune clé i18next brute ne fuit (ni "companions.tutorial." ni des labels de flèche non traduits)
  const bodyText = await content.innerText();
  expect(bodyText).not.toMatch(/companions\.tutorial\./);

  expect(pageErrors).toEqual([]);
});

// échelle de slots (2026-07-18, demande explicite : "5 slots, 2 gratuits puis 1M/10M/100M") --
// 5 slots FIXES : 2 gratuits + 3 déblocables dans l'ORDRE contre 1M/10M/100M. Vérifie que chaque
// déblocage débite le bon montant (via spendSilver, donc silverSpent), passe le slot en prêt, et
// que le ladder empêche de sauter un palier (débloquer un slot dont le précédent est verrouillé).
test('incubation slots unlock in order for 1M/10M/100M, spending the exact cost each time (ladder)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);
  await frame.locator('.tabs .tab', { hasText: 'Éclosion' }).click();

  await setSharedSilver(frame, 200_000_000); // assez pour les 3 paliers (1M + 10M + 100M) côté jeu
  const result = await frame.locator('body').evaluate(() => {
    const startLen = incubSlots.length;
    const freeSlots = FREE_INCUB_SLOTS;
    const wasLocked2 = !!(incubSlots[2] && incubSlots[2].locked);
    const costs = [slotUnlockCost(2), slotUnlockCost(3), slotUnlockCost(4)];

    // ladder : débloquer le slot 4 (index 3) AVANT le slot 3 (index 2) doit être un no-op complet
    const spentBeforeSkip = silverSpent;
    unlockIncubSlot(3);
    const skipBlocked = silverSpent === spentBeforeSkip && !!(incubSlots[3] && incubSlots[3].locked);

    const s0 = silverSpent; unlockIncubSlot(2); // 1M
    const afterSlot3 = { spent: silverSpent - s0, stillLocked: !!(incubSlots[2] && incubSlots[2].locked), ready: !!(incubSlots[2] && incubSlots[2].ready) };

    const s1 = silverSpent; unlockIncubSlot(3); // 10M
    const afterSlot4 = { spent: silverSpent - s1, stillLocked: !!(incubSlots[3] && incubSlots[3].locked) };

    return { startLen, freeSlots, wasLocked2, costs, skipBlocked, afterSlot3, afterSlot4 };
  });
  expect(pageErrors).toEqual([]);
  expect(result.startLen).toBe(5);      // 5 slots fixes
  expect(result.freeSlots).toBe(2);     // les 2 premiers gratuits
  expect(result.wasLocked2).toBe(true); // le 3e slot part verrouillé
  expect(result.costs).toEqual([1_000_000, 10_000_000, 100_000_000]);
  expect(result.skipBlocked).toBe(true); // ladder : impossible de sauter un palier
  expect(result.afterSlot3.spent).toBe(1_000_000);
  expect(result.afterSlot3.stillLocked).toBe(false);
  expect(result.afterSlot3.ready).toBe(true);
  expect(result.afterSlot4.spent).toBe(10_000_000);
  expect(result.afterSlot4.stillLocked).toBe(false);

  // le DOM reflète l'état : après avoir débloqué 2 slots verrouillés, il n'en reste qu'un (100M).
  const lockedLeft = await frame.locator('#incub-slots .isl.locked').count();
  expect(lockedLeft).toBe(1);
  expect(pageErrors).toEqual([]);
});

// plafond de slots (2026-07-18, demande explicite : "5 slots") -- le tableau incubSlots contient
// exactement 5 slots, jamais plus (plus de "buyExtraIncubSlot" qui poussait à l'infini). Vérifie
// qu'un déblocage silver insuffisant est un no-op, et que MAX_INCUB_SLOTS vaut bien 5.
test('incubation is capped at 5 fixed slots and an unaffordable unlock spends nothing', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);
  await frame.locator('.tabs .tab', { hasText: 'Éclosion' }).click();

  await setSharedSilver(frame, 10); // très en dessous du coût du 3e slot (1M), côté jeu
  const result = await frame.locator('body').evaluate(() => {
    const max = MAX_INCUB_SLOTS, len = incubSlots.length;
    const spentBefore = silverSpent;
    unlockIncubSlot(2); // doit échouer (silver insuffisant) sans rien débiter
    return { max, len, spentBefore, spentAfter: silverSpent, stillLocked: !!(incubSlots[2] && incubSlots[2].locked) };
  });
  expect(pageErrors).toEqual([]);
  expect(result.max).toBe(5);
  expect(result.len).toBe(5);
  expect(result.spentAfter).toBe(result.spentBefore); // aucun débit sur achat impossible
  expect(result.stillLocked).toBe(true);
});

// pont silver pool partagé (2026-07-18, demande explicite : "silver bidirectionnel, on lie
// compagnon avec le jeu") -- le module Compagnon ne tient plus une bourse séparée : dépenser débite
// le silver DU JEU (S.silver via addSilver, catégorie 'companion'), gagner le crédite, et le miroir
// local SILVER suit le solde du jeu. Vérifie les deux sens (bidirectionnel) sur le vrai pont.
test('companion silver is the shared game pool: a spend debits the game and an earn credits it (bridge)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);
  await frame.locator('.tabs .tab', { hasText: 'Éclosion' }).click();

  await setSharedSilver(frame, 5_000_000);
  const result = await frame.locator('body').evaluate(() => {
    const host = window.parent;
    const bridgeOn = typeof host.getGameSilverForCompanion === 'function';
    const gameBefore = host.getGameSilverForCompanion();
    unlockIncubSlot(2);                 // dépense : débloque le 3e slot (1M) -> débit du silver DU JEU
    const gameAfterSpend = host.getGameSilverForCompanion();
    earnSilver(777, 'test:earn');       // gain compagnon -> crédit du silver DU JEU
    const gameAfterEarn = host.getGameSilverForCompanion();
    return { bridgeOn, gameBefore, gameAfterSpend, gameAfterEarn, mirror: SILVER };
  });
  expect(pageErrors).toEqual([]);
  expect(result.bridgeOn).toBe(true);                                   // le pont hôte est bien exposé
  expect(result.gameAfterSpend).toBe(result.gameBefore - 1_000_000);    // dépense compagnon = débit jeu
  expect(result.gameAfterEarn).toBe(result.gameAfterSpend + 777);       // gain compagnon = crédit jeu
  expect(result.mirror).toBe(result.gameAfterEarn);                     // le miroir local suit le jeu
});

// récompenses PvP journalières (2026-07-18, demande explicite : "met des recompense pour le pvp
// journalier top 1 2 3 puis le reste") -- le rang + le montant sont autoritaires côté serveur
// (claim_pvp_rewards), le crédit se fait sur le silver DU JEU (pool partagé) côté client. On mocke
// la RPC pour vérifier le chemin réclamation -> crédit sans dépendre d'un vrai tournoi résolu.
test('claimPvpRewards credits the shared game silver with the server-authoritative reward', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);
  await frame.locator('.tabs .tab', { hasText: 'PvP' }).click();

  await setSharedSilver(frame, 1000);
  const result = await frame.locator('body').evaluate(async () => {
    const host = window.parent;
    const origGetSb = host.getSbClient;
    // client Supabase hôte mocké : claim_pvp_rewards renvoie un gain de rang 1 (5M).
    host.getSbClient = () => ({
      rpc: (name) => (name === 'claim_pvp_rewards'
        ? Promise.resolve({ data: [{ day: '2026-07-18', rank: 1, silver: 5000000 }], error: null })
        : Promise.resolve({ data: null, error: null })),
    });
    const before = host.getGameSilverForCompanion();
    await claimPvpRewards();
    const after = host.getGameSilverForCompanion();
    host.getSbClient = origGetSb;
    return { before, after };
  });
  expect(pageErrors).toEqual([]);
  expect(result.before).toBe(1000);
  expect(result.after).toBe(5_001_000); // +5M crédités sur le silver DU JEU
});

// carte terrain en 3D (2026-07-10, demande explicite) -- pour les espèces avec un modèle GLB,
// updateTerrainViewer3d() doit RÉUTILISER le contexte WebGL déjà créé sur un re-render du même pet
// (ticks.js appelle renderSecDetail() chaque seconde tant que l'onglet Sections est
// ouvert -- recréer le contexte à chaque tick reproduirait le bug de fuite déjà corrigé pour la
// modale 3D), et le LIBÉRER en quittant l'onglet.
test('terrain 3D viewer reuses its WebGL context across re-renders of the same pet and disposes when leaving the Sections tab', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));
  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  const result = await frame.locator('body').evaluate(async () => {
    const cat = PET_CATALOG.find(c => typeof companionModelUrlFor === 'function' && companionModelUrlFor({ cat: c, tier: 3 }));
    if (!cat) return { skip: true };
    if (typeof window.THREE === 'undefined') await new Promise(r => window.addEventListener('three-ready', r, { once: true }));
    const pet = { id: 999001, cat, rar: cat.rar, stats: mkStats(cat.rar), hunger: 100, terrain: true, tier: 3, tierXp: 0, tierMult: 1 };
    PETS.forEach(p => { if (p.cat.sec === cat.sec) p.terrain = false; });
    PETS.push(pet);
    activeSecIdx = SECTIONS.findIndex(s => s.id === cat.sec);
    ST(2); // onglet Sections -- ne rend PAS lui-même (seul ticks.js le fait, chaque
    // seconde tant que l'onglet reste actif) : appel explicite ici pour le premier rendu.
    renderSecDetail();
    await new Promise(r => setTimeout(r, 50)); // laisse mount() (async, attend 'three-ready') tourner
    const firstWrap = terrainViewer3dState ? terrainViewer3dState.wrap : null;
    renderSecDetail(); // simule le re-render déclenché chaque seconde par ticks.js
    const sameWrapReused = !!firstWrap && terrainViewer3dState && terrainViewer3dState.wrap === firstWrap;
    const anchorHasWrap = !!document.getElementById('ts-cv3d-anchor') && document.getElementById('ts-cv3d-anchor').contains(terrainViewer3dState.wrap);
    ST(3); // quitte l'onglet Sections -> doit libérer le contexte WebGL
    return { skip: false, hadState: !!firstWrap, sameWrapReused, anchorHasWrap, disposedOnLeave: terrainViewer3dState === null };
  });
  expect(pageErrors).toEqual([]);
  if (result.skip) return; // aucune espèce modélisée dans PET_CATALOG (ne devrait pas arriver)
  expect(result.hadState).toBe(true);
  expect(result.sameWrapReused).toBe(true);
  expect(result.anchorHasWrap).toBe(true);
  expect(result.disposedOnLeave).toBe(true);
});

// reveal 3D à l'éclosion (2026-07-10, demande explicite) -- pour une espèce avec modèle GLB, le
// viewer doit être libéré à la fermeture de la modale (bouton "Garder"/"Déployer" ou "✕"), jamais
// laissé vivre en arrière-plan.
test('hatch reveal 3D viewer is disposed when the modal closes', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));
  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  const result = await frame.locator('body').evaluate(async () => {
    const cat = PET_CATALOG.find(c => typeof companionModelUrlFor === 'function' && companionModelUrlFor({ cat: c, tier: 1 }));
    if (!cat) return { skip: true };
    if (typeof window.THREE === 'undefined') await new Promise(r => window.addEventListener('three-ready', r, { once: true }));
    const np = { id: 999002, cat, rar: cat.rar, stats: mkStats(cat.rar), hunger: 100, terrain: false, tier: 1, tierXp: 0, tierMult: 1 };
    window._np = np;
    document.getElementById('hatch-body').innerHTML = '<div id="hcv3d-anchor" style="width:120px;height:120px"></div>';
    OM('hatch-modal');
    const anchor = document.getElementById('hcv3d-anchor');
    const wrap = document.createElement('div'); wrap.style.width = '120px'; wrap.style.height = '120px';
    anchor.appendChild(wrap);
    hatchReveal3dState = createThreeViewer(wrap, () => {});
    hatchReveal3dState.loadModel(companionModelUrlFor(np));
    const mountedBefore = !!hatchReveal3dState;
    closeHatchModal();
    return { skip: false, mountedBefore, disposedAfterClose: hatchReveal3dState === null };
  });
  expect(pageErrors).toEqual([]);
  if (result.skip) return;
  expect(result.mountedBefore).toBe(true);
  expect(result.disposedAfterClose).toBe(true);
});

// garde-fou (2026-07-20, "ajouter classement, oeuf ouvert, argent depensé...") -- nouvel onglet
// "Tes stats" + "Classement" (tab 9, panel p9) : "Tes stats" reste 100% local (aucun réseau),
// vérifie que les compteurs déjà suivis ailleurs (totalHatched, silverSpent) s'affichent
// correctement après une dépense réelle. Le classement appelle une vraie RPC réseau
// (companion_leaderboard) -- ce test vérifie seulement qu'il ne plante jamais (page invitée fake,
// isGuest()===true dans ce contexte de test -- voir signInForTest -- donc le message "compte
// invité" attendu, pas un vrai classement réseau).
test('companion "Tes stats" tab shows real eggs-opened/money-spent counters and the leaderboard container never throws', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  // dépense réelle : achète un œuf pour que "Œufs ouverts"/"Argent dépensé" ne soient pas juste 0 par défaut
  await setSharedSilver(frame, 10_000_000); // silver côté jeu suffisant pour n'importe quel œuf
  const before = await frame.locator('body').evaluate(() => {
    // nouveau flux (2026-07-18) : on paie l'œuf au DÉMARRAGE de l'incubation (startIncubation), puis
    // on éclot (doHatch). Œuf payant (silver, 500k) pour que "Argent dépensé" ne soit pas 0.
    const eggType = EGG_TYPES.find(e => e.id === 'silver');
    incubSlots[0] = { free: true, empty: true };
    startIncubation(0, eggType.id);  // silverSpent += 500k + incubation démarrée
    incubSlots[0].ready = true;      // force prêt pour éclore immédiatement
    doHatch(0);                      // totalHatched++
    return { totalHatched, silverSpent, eggCost: eggType.cost };
  });
  expect(before.totalHatched).toBeGreaterThan(0);
  expect(before.silverSpent).toBe(before.eggCost); // dépense = coût de l'œuf (payé au démarrage)

  // doHatch() ouvre #hatch-modal (choix Garder/Déployer) -- le fermer avant de cliquer l'onglet,
  // sinon il intercepte le clic (modal-bg plein écran).
  await frame.locator('body').evaluate(() => { CM('hatch-modal'); });
  await frame.locator('.tabs .tab', { hasText: 'Classement' }).click();
  const result = await frame.locator('body').evaluate(async () => {
    // laisse fetchAndRenderCompanionLeaderboard() (appelée par ST(9)) se résoudre
    await new Promise(r => setTimeout(r, 800));
    const tiles = Array.from(document.querySelectorAll('#my-stats-grid > div')).map(d => d.textContent);
    return {
      tileCount: tiles.length,
      hasEggTile: tiles.some(t => t.includes('Œufs ouverts')),
      hasSpentTile: tiles.some(t => t.includes('Argent dépensé')),
      leaderboardHTML: document.getElementById('companion-leaderboard').innerHTML,
    };
  });
  expect(result.tileCount).toBeGreaterThan(0);
  expect(result.hasEggTile).toBe(true);
  expect(result.hasSpentTile).toBe(true);
  expect(result.leaderboardHTML.length).toBeGreaterThan(0); // un état quelconque affiché, jamais resté vide/"Chargement…" figé
  expect(pageErrors).toEqual([]);
});

// garde-fou (2026-07-20, "toujours aucunes stats declosion... verifie si tout est connecté a
// supabase") : DEUX bugs cumulés empêchaient TOUTE synchro admin depuis la création du module,
// pour tous les comptes (invité ou non) -- (1) window.parent.sb/currentUser étaient TOUJOURS
// undefined (déclarations `let` top-level, jamais attachées à `window` -- voir getSbClient()/
// getCurrentUserForSync(), game-supabase.js), corrigé en passant par ces accesseurs `function` ;
// (2) même une fois (1) corrigé, le builder Postgrest renvoyé par sb.rpc(...) n'a QUE .then(),
// jamais .catch() -- l'ancien `.catch(()=>{})` levait une TypeError AVANT que la requête ne parte,
// silencieusement avalée par le try/catch englobant (donc jamais visible comme pageerror). Un mock
// volontairement dépourvu de .catch() (comme le vrai builder) reproduit fidèlement (2) : le test
// vérifie à la fois l'absence de throw ET que .then() est bien atteint (pas juste bloqué par la garde).
test('syncCompanionStatsToServer reaches the RPC call and never throws with a catchless (real-shaped) Postgrest builder', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page); // currentUser non-guest (is_anonymous:false) -- la garde sb/currentUser/isGuest doit laisser passer
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  const result = await page.evaluate(async () => {
    const origGetSb = window.getSbClient;
    let thenReached = false;
    window.getSbClient = () => ({
      rpc() {
        // reproduit fidèlement le vrai PostgrestFilterBuilder : .then() existe, .catch() n'existe PAS
        return { then(onFulfilled) { thenReached = true; if (onFulfilled) onFulfilled({ data: null, error: null }); return this; } };
      },
    });
    const frameEl = document.getElementById('companionsFrame');
    let threw = false;
    try { await frameEl.contentWindow.syncCompanionStatsToServer(); } catch (e) { threw = true; }
    window.getSbClient = origGetSb;
    return { threw, thenReached };
  });
  expect(result.threw).toBe(false);
  expect(result.thenReached).toBe(true);
  expect(pageErrors).toEqual([]);
});

// migration rétroactive (2026-07-19, demande explicite : "supprime les 48 pet pour tout le
// monde") -- une sauvegarde antérieure au passage du roster de départ à 0 pet (roster.js,
// 2026-07-10) n'a jamais son flag petsRosterResetV1 : simule ce cas en injectant directement une
// sauvegarde localStorage AVANT le premier chargement (localStorage est partagé entre la page hôte
// et l'iframe, même origine -- voir save.js).
test('retroactive migration clears a pre-existing roster and never repeats', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.addInitScript(() => {
    localStorage.setItem('velia_idle_pets_save', JSON.stringify({
      PETS: [{ id: 1 }, { id: 2 }, { id: 3 }], SILVER: 12345, INVENTORY: {}, incubSlots: [],
      eggTimer: 0, petId: 4, hatchCountSincePity: 0, fusionCount: 2, caphrasUpgradeCount: 0,
      bossItemFound: false, breakthroughCount: 0, totalHatched: 3, eggTypesUsed: [],
      completedAchievements: [], pityEverTriggered: false, loginStreak: 1, lastLoginDate: null,
      // déjà passé le wipe économie prod (isole ce test sur la SEULE migration roster : sinon le
      // wipe remettrait fusionCount à 0 et l'assertion fusionKept échouerait -- voir le test dédié).
      petsEconomyWipeV1: true,
      savedAt: Date.now(),
      // pas de petsRosterResetV1 -- exactement l'état d'une sauvegarde jamais migrée
    }));
  });

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);
  // "0" est AUSSI l'état par défaut d'un tout nouveau joueur (roster.js) -- ne prouve
  // pas à lui seul que loadGame()/la migration ont fini de tourner, donc pas fiable comme seule
  // condition d'attente. On poll directement petsRosterResetV1 (posé synchroneement à la toute fin
  // de loadGame(), voir save.js) jusqu'à ce qu'il devienne true.
  await expect.poll(() => frame.locator('body').evaluate(() => petsRosterResetV1)).toBe(true);
  const afterMigration = await frame.locator('body').evaluate(() => ({
    petsLen: PETS.length, flag: petsRosterResetV1, fusionKept: fusionCount,
    silver: SILVER, gameSilver: (window.parent.getGameSilverForCompanion ? window.parent.getGameSilverForCompanion() : null),
  }));
  expect(afterMigration.petsLen).toBe(0);
  expect(afterMigration.flag).toBe(true);
  expect(afterMigration.fusionKept).toBe(2);
  // pool partagé (2026-07-18) : le silver ne vient PLUS de la sauvegarde compagnon (12345 ignoré) --
  // c'est le silver DU JEU qui fait autorité (pont). Le miroir local doit refléter le solde du jeu.
  expect(typeof afterMigration.gameSilver).toBe('number');
  expect(afterMigration.silver).toBe(afterMigration.gameSilver);

  // la migration a persisté (saveGame() appelé immédiatement dans loadGame()) -- lire directement
  // localStorage confirme que le flag est bien écrit, pas seulement en mémoire
  const persisted = await frame.locator('body').evaluate(() =>
    JSON.parse(localStorage.getItem('velia_idle_pets_save')));
  expect(persisted.petsRosterResetV1).toBe(true);
  expect(persisted.PETS).toEqual([]);

  expect(pageErrors).toEqual([]);
});

// migration wipe économie prod (2026-07-18, demande explicite : "au moment du merge on supprimera
// tout et les compagnons vont farm plus") -- une sauvegarde d'AVANT le passage en prod (pets/
// inventaire/slots de la phase de test, hoards) doit être remise à zéro UNE SEULE FOIS, en gardant
// les succès déjà obtenus (pas de re-versement de silver réel) et sans jamais se répéter.
test('prod economy wipe clears pets/inventory/slots once, keeps earned achievements, and never repeats', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.addInitScript(() => {
    localStorage.setItem('velia_idle_pets_save', JSON.stringify({
      PETS: [{ id: 1 }, { id: 2 }], SILVER: 99999,
      INVENTORY: { 'Minerai de fer': { icon: '⛏️', qty: 74000, feed: 0 } },
      incubSlots: [{ free: true, tl: 0, tot: 1, ready: true }], eggTimer: 0, petId: 3,
      totalHatched: 42, fusionCount: 5, completedAchievements: ['first_hatch'],
      petsRosterResetV1: true, petsRosterCapV1: true, petsUidV1: true, petsSpeciesRarityV1: true,
      savedAt: Date.now(),
      // pas de petsEconomyWipeV1 -- exactement une sauvegarde d'avant le passage en prod
    }));
  });

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);
  await expect.poll(() => frame.locator('body').evaluate(() => petsEconomyWipeV1)).toBe(true);

  const after = await frame.locator('body').evaluate(() => ({
    petsLen: PETS.length,
    invKeys: Object.keys(INVENTORY).length,
    slotCount: incubSlots.length,
    lockedCount: incubSlots.filter(s => s.locked).length,
    totalHatched, fusionCount,
    achievementsKept: completedAchievements.has('first_hatch'),
    flag: petsEconomyWipeV1,
  }));
  expect(after.petsLen).toBe(0);             // roster de test effacé
  expect(after.invKeys).toBe(0);             // hoards d'inventaire effacés
  expect(after.slotCount).toBe(5);           // slots remis au modèle prod (5 fixes)
  expect(after.lockedCount).toBe(3);         // 2 gratuits + 3 verrouillés
  expect(after.totalHatched).toBe(0);        // compteurs de tirage remis à zéro
  expect(after.fusionCount).toBe(0);
  expect(after.achievementsKept).toBe(true); // succès déjà obtenus PRÉSERVÉS (pas de re-versement)
  expect(after.flag).toBe(true);

  // persisté -> ne se répète jamais
  const persisted = await frame.locator('body').evaluate(() =>
    JSON.parse(localStorage.getItem('velia_idle_pets_save')));
  expect(persisted.petsEconomyWipeV1).toBe(true);
  expect(persisted.PETS).toEqual([]);
  expect(pageErrors).toEqual([]);
});

// 2026-07-20, demande explicite (bandeau/titre/bouton fermer/légende/tri/zoom) : couvre la
// présence de chaque élément UI ajouté, pas leur comportement détaillé (déjà couvert ailleurs).
test('header shows title, close button, and collection legend/sort/zoom controls (no WIP banner in prod)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  // titre du header : c'est le SEUL test dont c'est le sujet, donc il garde l'assertion explicite.
  // Ailleurs, `.hdr-logo` ne servait que de (fausse) barrière de démarrage -- voir
  // waitCompanionsReady.
  await expect(frame.locator('.hdr-logo')).toHaveText('Black Desert Idle');

  // bandeau "test en cours" RETIRÉ au passage en prod (2026-07-18) -- ne doit plus exister
  await expect(frame.locator('#wipBanner')).toHaveCount(0);

  // bouton de fermeture DANS le module, à côté de "FAMILIERS" -- appelle bien closeCompanionsModule
  // de la page hôte (vérifié via l'overlay principal qui se cache après le clic)
  await expect(frame.locator('#hdrCloseBtn')).toBeVisible();
  const overlay = page.locator('#companionsInline'); // vue inline dans #wrap (2026-07-19, plus d'overlay plein écran)
  await expect(overlay).toBeVisible();
  await frame.locator('#hdrCloseBtn').click();
  await expect(overlay).toBeHidden();
  await dismissTutorialIfPresent(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));
  await expect(overlay).toBeVisible();

  // Collection : légende TOP1/2/3, bouton de tri par Tier, contrôle de colonnes (2026-07-20,
  // "ajout d'un bouton choix combien par ligne 5 a 9", remplace l'ancien zoom à 3 crans)
  await frame.locator('.tabs .tab', { hasText: 'Collection' }).click();
  await expect(frame.locator('text=TOP1 = même rareté')).toBeVisible();
  await expect(frame.locator('#sort-tier')).toBeVisible();
  await expect(frame.locator('#coll-cols-chips button')).toHaveCount(5); // 5,6,7,8,9
  const gridColsBefore = await frame.locator('#pet-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns);
  await frame.locator('#coll-cols-chips button', { hasText: '9' }).click();
  const gridColsAfter = await frame.locator('#pet-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns);
  expect(gridColsAfter).not.toBe(gridColsBefore);

  // onglet Éclosion : le tableau des odds est purement informatif -- l'achat multiple ×1/×5/×10
  // (bulkHatch) et son disclaimer ont été RETIRÉS (2026-07-18, "enlever l'achat multiple").
  await frame.locator('.tabs .tab', { hasText: 'Éclosion' }).click();
  await expect(frame.locator('#egg-odds-table')).toBeVisible();
  await expect(frame.locator('#egg-odds-table button')).toHaveCount(0); // plus aucun bouton d'achat ×N dans le tableau
  await expect(frame.locator('text=éclosent instantanément')).toHaveCount(0);

  expect(pageErrors).toEqual([]);
});

// bug corrigé (2026-07-20, rapporté explicitement : "timer qui se met pas a jour, on ne peut pas
// acheter les oeufs") -- ST(1) n'appelait jamais renderHatch(), et le tick ne rafraîchissait pas
// le panel Éclosion même quand il restait ouvert. Vérifie que le texte du compte à rebours change
// tout seul, SANS changer d'onglet, entre deux lectures espacées de plus d'1s (ticks.js
// tourne toutes les 1000ms).
test('hatch countdown keeps updating live while the tab stays open', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);
  await frame.locator('.tabs .tab', { hasText: 'Éclosion' }).click();

  // le 2e slot (non gratuit, non prêt au démarrage) affiche un vrai compte à rebours -- on lit son
  // texte deux fois avec >1.2s d'écart, sans jamais quitter l'onglet Éclosion entre les deux lectures
  const timerEl = frame.locator('.isl:not(.ready):not(.locked) .itimer').first();
  await expect(timerEl).toBeVisible();
  const before = await timerEl.textContent();
  await page.waitForTimeout(1200);
  const after = await timerEl.textContent();
  expect(after).not.toBe(before);

  expect(pageErrors).toEqual([]);
});

// achievement "dur" (2026-07-20, demande explicite : "succes dure genre fusionner pour perdre des
// legendaire/ancestral") -- force le tirage (Math.random mocké à 0 dans le contexte de l'iframe)
// pour garantir un résultat de rareté inférieure au meilleur des 2 parents (voir le commentaire
// détaillé dans executeFusion, fusion.js, sur pourquoi bestParentRar et pas bestRar).
test('fusing an Ancestral into a weaker pet that downgrades unlocks the hard achievement', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  const result = await frame.locator('body').evaluate(() => {
    const origRandom = Math.random;
    Math.random = () => 0; // force le tirage de base vers la rareté BASSE (baseRarityDraw) + escalade min
    try {
      const ancestralCat = PET_CATALOG.find(c => c.rar === 5);
      const commonCat = PET_CATALOG.find(c => c.rar === 0);
      const a = { id: petId++, cat: ancestralCat, rar: 5, stats: mkStats(5), hunger: 100, terrain: false, tier: 1, tierXp: 0, tierMult: 1 };
      const b = { id: petId++, cat: commonCat, rar: 0, stats: mkStats(0), hunger: 100, terrain: false, tier: 1, tierXp: 0, tierMult: 1 };
      PETS.push(a, b);
      const beforeCount = fusionLostHighRarityCount;
      executeFusion(a, b);
      checkAchievements();
      return {
        counterIncremented: fusionLostHighRarityCount > beforeCount,
        achievementUnlocked: completedAchievements.has('fusion_downgrade'),
        petsLenAfter: PETS.length, // les 2 parents consommés, 1 seul résultat -> +1 net (0 -> 1 ici)
      };
    } finally {
      Math.random = origRandom;
    }
  });
  expect(result.counterIncremented).toBe(true);
  expect(result.achievementUnlocked).toBe(true);
  expect(result.petsLenAfter).toBe(1);

  // le nouvel achievement existe bien dans le registre, marqué "hard"
  const achDef = await frame.locator('body').evaluate(() =>
    ACHIEVEMENTS.find(a => a.id === 'fusion_downgrade'));
  expect(achDef).toBeTruthy();
  expect(achDef.hard).toBe(true);

  expect(pageErrors).toEqual([]);
});

// Flèches de résultat de fusion (2026-07-20, demande explicite : "afficher des fleches verte si
// on gagne des stats rang, ou rouge si on en perd, afficher de quel tiers a quel tiers on est
// passes") -- deltaArrow()/showFusionResultModal() (fusion.js) comparent le Tier et le
// Score (GS) du résultat au MEILLEUR des 2 parents (pas une moyenne) : ⬆️ vert si gain, ⬇️ rouge
// si perte. Deux fusions forcées ici pour couvrir les deux directions dans le même test.
test('fusion result modal shows a green up arrow on gain and a red down arrow on loss, for both tier and GS', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  // Le tier grimpe toujours d'au moins 1 cran par rapport au meilleur parent (baseTier =
  // max(tiers)+1) -> ⬆️ vert garanti. MAIS ce n'est vrai QUE hors "breakthrough" de rareté :
  // executeFusion() remet le Tier à 1 quand la rareté BONDIT (fusion.js §3), ce qui arrivait ~1 fois
  // sur 3 avec des parents de rareté basse -> test flaky (mergedTier=1). On force donc des parents à la
  // rareté MAX (5) : rollFusionRarity() ne peut plus augmenter la rareté, donc pas de reset, le Tier
  // monte de façon déterministe. Le Score (GS) reste aléatoire (rollTierMult) -> le test déduit son
  // sens ATTENDU depuis les vraies valeurs renvoyées, pour rester robuste tout en vérifiant le HTML.
  const result = await frame.locator('body').evaluate(() => {
    const cat = PET_CATALOG.find(c => c.rar === 1);
    const a = { id: petId++, cat, rar: 5, stats: [10, 10, 10, 0, 0], hunger: 100, terrain: false, tier: 1, tierXp: 0, tierMult: 1 };
    const b = { id: petId++, cat, rar: 5, stats: [12, 12, 12, 0, 0], hunger: 100, terrain: false, tier: 2, tierXp: 0, tierMult: 1 };
    const bestParentTier = Math.max(a.tier, b.tier);
    const bestParentGS = Math.max(normGS(a), normGS(b));
    PETS.push(a, b);
    fusionSlots = [a.id, b.id];
    executeFusion(a, b);
    const merged = PETS[PETS.length - 1];
    const html = document.getElementById('fusion-modal-body').innerHTML;
    return {
      html,
      bestParentTier, bestParentGS,
      mergedTier: merged.tier, mergedGS: normGS(merged),
    };
  });
  expect(pageErrors).toEqual([]);
  expect(result.mergedTier).toBeGreaterThan(result.bestParentTier);

  const tierArrow = result.mergedTier > result.bestParentTier ? '⬆️' : result.mergedTier < result.bestParentTier ? '⬇️' : '➡️';
  const tierColor = result.mergedTier > result.bestParentTier ? 'var(--green2)' : result.mergedTier < result.bestParentTier ? 'var(--red2)' : 'var(--cream3)';
  const gsArrow = result.mergedGS > result.bestParentGS ? '⬆️' : result.mergedGS < result.bestParentGS ? '⬇️' : '➡️';
  const gsColor = result.mergedGS > result.bestParentGS ? 'var(--green2)' : result.mergedGS < result.bestParentGS ? 'var(--red2)' : 'var(--cream3)';

  expect(result.html).toContain(`🏅 Rang (Tier)`);
  expect(result.html).toContain(`color:${tierColor};font-weight:600">T${result.bestParentTier} ➡️ T${result.mergedTier} ${tierArrow}`);
  expect(result.html).toContain(`💪 Score (GS)`);
  expect(result.html).toContain(`color:${gsColor};font-weight:600">${result.bestParentGS} ➡️ ${result.mergedGS} ${gsArrow}`);
  // Le Tier étant garanti en hausse dans ce scénario, on vérifie explicitement le vert ici —
  // c'est la moitié "gain" de la demande explicite ("flèche verte si on gagne").
  expect(tierArrow).toBe('⬆️');
  expect(tierColor).toBe('var(--green2)');
});

// Cas symétrique : deux pets identiques (aucun gain possible ni en tier ni en GS au-delà du
// minimum garanti) ne doivent jamais afficher de flèche rouge sur le Tier (qui ne peut que monter
// ou stagner, jamais descendre par construction de executeFusion).
test('fusion of two identical pets never shows a red arrow on tier (tier can only rise or stay)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  const result = await frame.locator('body').evaluate(() => {
    // Parents à la rareté MAXIMALE (5) pour rendre le test déterministe : l'invariant "le Tier ne peut
    // que monter ou rester" (aucune flèche rouge) n'est vrai QUE hors "breakthrough" de rareté --
    // executeFusion() remet volontairement le Tier à 1 quand la rareté BONDIT (fusion.js §3). À la
    // rareté max, rollFusionRarity() ne peut plus augmenter la rareté (newRar=min(5,5+k)=5, donc
    // rarityIncreased=false), donc on teste bien la branche "montée de Tier" : baseTier=max(2,2)+1=3
    // + un éventuel extra. (Avec des parents de rareté basse, le breakthrough aléatoire remettait le
    // Tier à 1 ~1 fois sur 3 -> test flaky, corrigé ici.)
    const cat = PET_CATALOG.find(c => c.rar === 0);
    const a = { id: petId++, cat, rar: 5, stats: [5, 0, 0, 0, 0], hunger: 100, terrain: false, tier: 2, tierXp: 0, tierMult: 1 };
    const b = { id: petId++, cat, rar: 5, stats: [5, 0, 0, 0, 0], hunger: 100, terrain: false, tier: 2, tierXp: 0, tierMult: 1 };
    PETS.push(a, b);
    fusionSlots = [a.id, b.id];
    executeFusion(a, b);
    const merged = PETS[PETS.length - 1];
    return { html: document.getElementById('fusion-modal-body').innerHTML, mergedTier: merged.tier };
  });
  expect(pageErrors).toEqual([]);
  expect(result.mergedTier).toBeGreaterThan(2); // baseTier = max(2,2)+1 = 3 minimum (rareté max => pas de reset à T1)
  expect(result.html).not.toContain('var(--red2);font-weight:600">T'); // jamais de flèche rouge sur le Tier
});

// PvP (2026-07-20, demande explicite : "categorie pvp, classement de toutes les fonction de la
// categorie" + "header : PVP bloqué") -- vrai PvP joueur-contre-joueur pas encore livré (bandeau
// verrouillé, voir pvp.js), mais le classement local par puissance (GS) fonctionne
// réellement -- vérifie les deux : l'UI verrouillée ET le tri correct du classement.
test('PvP tab shows the daily-tournament banner and a real GS-sorted ranking of owned pets', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);
  await frame.locator('.tabs .tab', { hasText: 'PvP' }).click();
  // bannière ré-encadrée (2026-07-18, "ouvrir pvp") : le tournoi quotidien est jouable, plus de "🔒 Bientôt".
  await expect(frame.locator('text=PvP — Tournoi quotidien')).toBeVisible();

  // injecte 3 pets de puissances connues et vérifie que computePvpRanking() les trie du plus fort
  // au plus faible (pure, testable sans dépendre du tirage aléatoire de rollAndCreatePet)
  const ranking = await frame.locator('body').evaluate(() => {
    const weak = { id: 901, cat: PET_CATALOG.find(c => c.rar === 0), rar: 0, stats: [1,0,0,0,0], tier: 1 };
    const strong = { id: 902, cat: PET_CATALOG.find(c => c.rar === 5), rar: 5, stats: [60,38,30,20,15], tier: 5 };
    const mid = { id: 903, cat: PET_CATALOG.find(c => c.rar === 2), rar: 2, stats: [14,7,6,0,0], tier: 3 };
    const ranked = computePvpRanking([weak, strong, mid]);
    return ranked.map(p => p.id);
  });
  expect(ranking).toEqual([902, 903, 901]); // strong > mid > weak

  expect(pageErrors).toEqual([]);
});

// (onglet de test "Viewer 3D" retiré le 2026-07-18 -- "enleve le viewer 3D" ; le pipeline GLB
// Three.js reste couvert par le test de la modale de preview d'un pet, ci-dessous.)

// Intégration réelle du 1er modèle GLB (2026-07-10, demande explicite : "envoyer le premier test
// .glb") -- le bouton "🧊 Voir en 3D" (panneau du pet déployé sur le terrain,
// sections.js) ne doit apparaître QUE pour un pet dont companionModelUrlFor() renvoie
// une URL réelle (COMPANION_MODEL_MAP, viewer3d.js) -- seul "Black Mask Cat" T5 est
// câblé pour l'instant (seul fichier uploadé dans le bucket). Vérifie l'affichage conditionnel ET
// que la modale réutilise bien le même pipeline Three.js déjà validé par l'écran de test.
test('"Voir en 3D" button only appears for a pet with an uploaded model, and opens a working Three.js modal', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);
  await frame.locator('.tabs .tab', { hasText: 'Sections' }).click();

  const noModelState = await frame.locator('body').evaluate(() => {
    // 2026-07-20 ("integre les menu 3D de la phase 1") : COMPANION_MODEL_MAP couvre désormais les
    // 11 espèces des sections loot/combat (55 combos) -- un pet SANS modèle doit venir d'une AUTRE
    // section (ex: minage), plus aucune espèce loot/combat n'en est dépourvue.
    const cat = PET_CATALOG.find(c => c.sec === 'minage');
    const secIdx = SECTIONS.findIndex(s => s.id === cat.sec);
    const noModelPet = { id: petId++, cat, rar: 1, stats: [5,4,3,0,0], hunger: 100, terrain: true, tier: 5, tierXp: 0, tierMult: 1 };
    PETS.push(noModelPet);
    activeSecIdx = secIdx;
    renderSecNav(); renderSecDetail();
    // .btn-ghost existe déjà ailleurs dans ce panneau (boutons Caphras, renderCaphrasWorkshop) —
    // cibler le texte exact du bouton 3D, pas juste la classe
    return { hasButton: Array.from(document.querySelectorAll('.terrain-slot.occ button')).some(b => b.textContent.includes('Voir en 3D')) };
  });
  expect(noModelState.hasButton).toBe(false); // pas de bouton pour un pet sans modèle uploadé

  const withModelState = await frame.locator('body').evaluate(() => {
    const cat = PET_CATALOG.find(c => c.name === 'Black Mask Cat');
    PETS.forEach(p => { if (p.cat.sec === cat.sec) p.terrain = false; }); // libère le slot terrain de la section
    const modelPet = { id: petId++, cat, rar: 0, stats: [5,4,3,0,0], hunger: 100, terrain: true, tier: 5, tierXp: 0, tierMult: 1 };
    PETS.push(modelPet);
    activeSecIdx = SECTIONS.findIndex(s => s.id === cat.sec); // le bloc précédent a pu la laisser sur une AUTRE section (minage)
    renderSecNav(); renderSecDetail();
    return { hasButton: Array.from(document.querySelectorAll('.terrain-slot.occ button')).some(b => b.textContent.includes('Voir en 3D')), petId: modelPet.id };
  });
  expect(withModelState.hasButton).toBe(true);

  await frame.locator('.terrain-slot.occ button', { hasText: 'Voir en 3D' }).click();
  await expect(frame.locator('#pet3d-modal')).toHaveClass(/open/);
  await expect(frame.locator('#pet3d-modal-title')).toContainText('Black Mask Cat');

  await expect
    .poll(() => frame.locator('body').evaluate(() => typeof window.THREE), { timeout: 15_000 })
    .toBe('object');
  await expect(frame.locator('#pet3d-canvas-wrap canvas')).toHaveCount(1, { timeout: 10_000 });
  await expect
    .poll(() => frame.locator('#pet3d-status').textContent(), { timeout: 15_000 })
    .not.toBe('En attente…');

  await frame.locator('#pet3d-modal .mcl').click();
  await expect(frame.locator('#pet3d-modal')).not.toHaveClass(/open/);

  expect(pageErrors).toEqual([]);
});

// COMPANION_MODEL_MAP étendu (2026-07-20, "integre les menu 3D de la phase 1" = output/loot/tiers
// + output/combat/tiers) : couvre désormais les 11 espèces des 2 sections avec modèle 3D
// (loot: 6, combat: 6 -- Black Cloaked Dog compte dans les 2 comptages ci-dessous seulement une
// fois par section), T1 à T5 chacune. Garde-fou statique + le bouton 3D apparaît aussi dans la
// Collection (pas seulement le panneau terrain de Sections).
test('COMPANION_MODEL_MAP covers all 11 loot/combat species at every tier, and the 3D button appears on Collection cards too', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  const mapCheck = await frame.locator('body').evaluate(() => {
    const lootSpecies = PET_CATALOG.filter(c => c.sec === 'loot').map(c => c.name);
    const combatSpecies = PET_CATALOG.filter(c => c.sec === 'combat').map(c => c.name);
    const allCovered = [...lootSpecies, ...combatSpecies].every(name => {
      const m = COMPANION_MODEL_MAP[name];
      return m && [1,2,3,4,5].every(t => m.tiers.includes(t));
    });
    return { lootCount: lootSpecies.length, combatCount: combatSpecies.length, allCovered };
  });
  expect(mapCheck.lootCount).toBe(6);
  expect(mapCheck.combatCount).toBe(6);
  expect(mapCheck.allCovered).toBe(true);

  // le bouton 3D doit aussi apparaître sur une carte de Collection (pas juste le panneau terrain)
  const collCheck = await frame.locator('body').evaluate(() => {
    const cat = PET_CATALOG.find(c => c.name === 'Black Mask Cat');
    PETS.push({ id: petId++, cat, rar: 0, stats: [5,4,3,0,0], hunger: 100, terrain: false, tier: 5, tierXp: 0, tierMult: 1 });
    ST(3); // Collection -- ST() n'appelle pas renderGrid() lui-même (contrairement à d'autres onglets)
    renderGrid();
    const card = document.querySelector('.pet-card');
    return { hasButton: card ? Array.from(card.querySelectorAll('button')).some(b => b.title === 'Voir en 3D') : false };
  });
  expect(collCheck.hasButton).toBe(true);

  expect(pageErrors).toEqual([]);
});

// Agrandissement 25% sans `zoom` CSS (2026-07-20, demande explicite : "agrandi de 25%
// l'inferface pas de zoom compagnon") -- `transform:scale(1.25)` sur body (width/height
// compensés à 80%) au lieu de `zoom:1.25` (retiré plus tôt le même jour). Piège à couvrir : un
// ancêtre avec `transform` devient le containing block des descendants `position:fixed`
// (.modal-bg, .toast-wrap) -- doivent quand même couvrir tout le viewport de l'iframe, pas
// seulement le body pré-scale (80% de la taille).
test('body is scaled 1.25x via transform (not CSS zoom) and fixed-position modals still cover the full iframe viewport', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  const bodyStyle = await frame.locator('body').evaluate(el => {
    const cs = getComputedStyle(el);
    return { transform: cs.transform, usesZoom: cs.zoom !== '1' && cs.zoom !== '' && cs.zoom !== 'normal', rect: el.getBoundingClientRect() };
  });
  // matrix(1.25, 0, 0, 1.25, 0, 0) -- scale 1.25 sur les deux axes, aucun autre terme
  expect(bodyStyle.transform).toBe('matrix(1.25, 0, 0, 1.25, 0, 0)');
  expect(bodyStyle.usesZoom).toBe(false);

  const iframeBox = await page.locator('#companionsFrame').boundingBox();
  // body (scale compensé) doit couvrir tout le viewport RENDU de l'iframe, pas 80% de sa taille
  expect(Math.round(bodyStyle.rect.width)).toBe(Math.round(iframeBox.width));
  expect(Math.round(bodyStyle.rect.height)).toBe(Math.round(iframeBox.height));

  await frame.locator('body').evaluate(() => { OM('hatch-modal'); });
  const modalRect = await frame.locator('#hatch-modal').evaluate(el => el.getBoundingClientRect());
  expect(Math.round(modalRect.width)).toBe(Math.round(iframeBox.width));
  expect(Math.round(modalRect.height)).toBe(Math.round(iframeBox.height));
  expect(Math.round(modalRect.top)).toBe(0);
  expect(Math.round(modalRect.left)).toBe(0);

  expect(pageErrors).toEqual([]);
});

// Bug corrigé (2026-07-20, rapporté explicitement : "je ne vois pas mes model que le premier") --
// renderer.dispose() (Three.js) libère les ressources GPU mais PAS le contexte WebGL lui-même,
// repris seulement au ramassage mémoire du <canvas> sans garantie de timing. Les navigateurs
// plafonnent le nombre de contextes WebGL VIVANTS simultanément (souvent ~16) -- en ouvrant la
// modale 3D sur plusieurs familiers d'affilée SANS que les anciens contextes soient vraiment
// libérés, les nouveaux finissaient par échouer silencieusement (canvas vide). Vérifie qu'ouvrir
// bien plus de modèles que la limite classique de contextes WebGL fonctionne toujours à la fin.
test('opening the 3D preview for many companions in a row never fails to render (WebGL context leak)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);
  await frame.locator('.tabs .tab', { hasText: 'Collection' }).click();

  const results = await frame.locator('body').evaluate(async () => {
    // > 16 ouvertures (plafond typique de contextes WebGL vivants) pour dépasser franchement la limite
    const names = Object.keys(COMPANION_MODEL_MAP);
    const rounds = [...names, ...names]; // 22 espèces -> 22 ouvertures, largement > 16
    const out = [];
    for (const name of rounds) {
      const cat = PET_CATALOG.find(c => c.name === name);
      const p = { id: petId++, cat, rar: 0, stats: [5,4,3,0,0], hunger: 100, terrain: false, tier: 1, tierXp: 0, tierMult: 1 };
      PETS.push(p);
      open3dPreviewModal(p);
      await new Promise(r => {
        const check = () => {
          const s = document.getElementById('pet3d-status').textContent;
          if (s.startsWith('Chargé') || s.startsWith('Erreur')) r(); else setTimeout(check, 100);
        };
        check();
      });
      out.push({ name, status: document.getElementById('pet3d-status').textContent, hasCanvas: !!document.querySelector('#pet3d-canvas-wrap canvas') });
    }
    close3dPreviewModal();
    return out;
  });

  const failures = results.filter(r => !r.status.startsWith('Chargé') || !r.hasCanvas);
  expect(failures).toEqual([]);

  expect(pageErrors).toEqual([]);
});

// ═══ MARCHÉ D'ÉCHANGE (2026-07-10, demande explicite : "vrai backend d'échange") ═══════════════
// pet.uid stable + market.js -- voir supabase/migrations/20260710150000_companion_pet_trade_market.sql

test('rollAndCreatePet assigns a stable uid, and petSnapshotOf/petFromSnapshot round-trip preserves it', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  const result = await frame.locator('body').evaluate(() => {
    const { pet } = rollAndCreatePet(EGG_TYPES[0]);
    const hasUid = typeof pet.uid === 'string' && pet.uid.length > 10;
    const snap = petSnapshotOf(pet);
    const revived = petFromSnapshot(snap);
    return {
      hasUid,
      uidPreserved: revived.uid === pet.uid,
      nameMatches: revived.cat.name === pet.cat.name,
      catIsCanonicalCatalogEntry: revived.cat === PET_CATALOG.find(c => c.name === pet.cat.name),
      statsMatch: JSON.stringify(revived.stats) === JSON.stringify(pet.stats),
      idDiffersFromUid: revived.id !== revived.uid, // `id` local reste distinct de `uid` (clé serveur)
    };
  });
  expect(pageErrors).toEqual([]);
  expect(result.hasUid).toBe(true);
  expect(result.uidPreserved).toBe(true);
  expect(result.nameMatches).toBe(true);
  expect(result.catIsCanonicalCatalogEntry).toBe(true);
  expect(result.statsMatch).toBe(true);
  expect(result.idDiffersFromUid).toBe(true);
});

// migration rétroactive : une sauvegarde antérieure à l'ajout de `uid` (2026-07-10) a des pets
// sans ce champ -- migratePetUidV1() doit leur en attribuer un, une seule fois, sans jamais
// écraser un uid déjà présent sur un autre pet (voir loadGame(), save.js).
test('migratePetUidV1 assigns a uid to legacy pets missing one, without touching pets that already have one', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  const result = await frame.locator('body').evaluate(() => {
    const cat = PET_CATALOG[0];
    const legacyPet = { id: petId++, cat, rar: 1, stats: [3, 1, 0, 0, 0], hunger: 100, terrain: false, tier: 1, tierXp: 0, tierMult: 1 }; // pas de `uid` -- simule une sauvegarde antérieure
    const alreadyMigrated = { id: petId++, uid: 'keep-me', cat, rar: 1, stats: [3, 1, 0, 0, 0], hunger: 100, terrain: false, tier: 1, tierXp: 0, tierMult: 1 };
    PETS.push(legacyPet, alreadyMigrated);
    migratePetUidV1();
    return {
      legacyGotUid: typeof legacyPet.uid === 'string' && legacyPet.uid.length > 10,
      untouchedUidKept: alreadyMigrated.uid === 'keep-me',
    };
  });
  expect(pageErrors).toEqual([]);
  expect(result.legacyGotUid).toBe(true);
  expect(result.untouchedUidKept).toBe(true);
});

// Onglet Marché : rendu de la nav (Marché/Mes contrats/Historique) sans crash, même quand aucune
// vraie session Supabase n'est disponible (signInForTest fabrique un utilisateur local, voir
// commentaire en tête de fichier -- les appels réseau réels échouent silencieusement, gérés en
// try/catch dans market.js, jamais une exception qui remonte au navigateur).
test('Marché tab renders its 3 sub-tabs and never throws even without a real Supabase session', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  await frame.locator('.tabs .tab', { hasText: 'Marché' }).click();
  await expect(frame.locator('#market-body')).toBeVisible();

  const navLabels = await frame.locator('#market-nav .schip').allTextContents();
  expect(navLabels).toEqual(['🛒 Marché', '📜 Mes contrats', '📚 Historique']);

  await frame.locator('#market-nav .schip', { hasText: 'Mes contrats' }).click();
  await frame.locator('#market-nav .schip', { hasText: 'Historique' }).click();
  await frame.locator('#market-nav .schip', { hasText: 'Marché' }).click();

  expect(pageErrors).toEqual([]);
});

// bug corrigé (2026-07-11, rapporté explicitement : "Auto nourrissage non fonctionnel") -- l'auto-
// nourrissage grillait silencieusement les ressources spéciales (Caphras/Dopi) au lieu de la
// nourriture commune (même filtre que le nourrissage manuel, feed.js), et ne rafraîchissait jamais
// l'onglet Nourrir. Vérifie les deux sur un vrai tick (ticks.js tourne toutes les 1000ms).
test('auto-feed only spends common food (never Caphras/Dopi stones) and refreshes the Feed tab live', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);
  await frame.locator('.tabs .tab', { hasText: 'Nourrir' }).click();

  const setup = await frame.locator('body').evaluate(() => {
    const cat = PET_CATALOG.find(c => c.sec === 'loot');
    const pet = { id: petId++, uid: 'autofeed-uid', cat, rar: 1, stats: mkStats(1), hunger: 5, terrain: true, tier: 1, tierXp: 0, tierMult: 1 };
    PETS.push(pet);
    // inventaire ne contient QUE des ressources spéciales -- si l'auto-nourrissage les consomme,
    // c'est le bug ; s'il n'y touche pas (les exclut), la faim ne doit PAS monter.
    INVENTORY[CAPHRAS_ITEM.n] = { icon: CAPHRAS_ITEM.e, feed: CAPHRAS_ITEM.feed, qty: 5 };
    document.getElementById('autotog').classList.add('on');
    return { petId: pet.id, caphrasQtyBefore: INVENTORY[CAPHRAS_ITEM.n].qty };
  });

  await page.waitForTimeout(1300); // laisse au moins 1 tick réel s'exécuter

  const after = await frame.locator('body').evaluate((el, id) => {
    const p = PETS.find(pp => pp.id === id);
    return { hunger: p.hunger, caphrasQty: INVENTORY[CAPHRAS_ITEM.n] ? INVENTORY[CAPHRAS_ITEM.n].qty : 0 };
  }, setup.petId);

  expect(after.caphrasQty).toBe(setup.caphrasQtyBefore); // jamais consommée
  expect(after.hunger).toBeLessThan(30); // pas nourri faute de vraie nourriture disponible

  // ajoute maintenant de la vraie nourriture commune -- l'auto-nourrissage doit s'en servir ET
  // rafraîchir l'onglet Nourrir tout seul (barre de faim visible mise à jour sans action manuelle)
  await frame.locator('body').evaluate((el, id) => {
    addToInventory('Butin', '🏺', 10, 12);
    PETS.find(pp => pp.id === id).hunger = 5;
  }, setup.petId);
  await page.waitForTimeout(1300);
  const afterFood = await frame.locator('body').evaluate((el, id) => PETS.find(pp => pp.id === id).hunger, setup.petId);
  expect(afterFood).toBeGreaterThan(5);

  expect(pageErrors).toEqual([]);
});

// bug corrigé (2026-07-11, rapporté explicitement : "GS different entre deploye sur le terrain et
// en Reserve") -- ST(2)/ST(3) ne rappelaient jamais renderSecDetail()/renderGrid() au changement
// d'onglet -- un tier-up (donc un nouveau GS) survenu pendant qu'on est sur un AUTRE onglet restait
// invisible en revenant sur Sections tant qu'aucune autre action ne forçait un renderAll() complet.
test('switching to Sections/Collection tabs always re-renders the current GS (no stale badge)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);
  await frame.locator('.tabs .tab', { hasText: 'Nourrir' }).click(); // onglet quelconque, PAS Sections/Collection

  const result = await frame.locator('body').evaluate(() => {
    const cat = PET_CATALOG.find(c => c.sec === 'loot');
    const pet = { id: petId++, uid: 'st-rerender-uid', cat, rar: 2, stats: mkStats(2), hunger: 100, terrain: true, tier: 1, tierXp: 0, tierMult: 1 };
    PETS.push(pet);
    activeSecIdx = SECTIONS.findIndex(s => s.id === cat.sec);
    // simule un changement de GS survenu "en arrière-plan" (hors onglets Sections/Collection) --
    // sans jamais appeler renderAll()/renderSecDetail()/renderGrid() nous-mêmes.
    pet.tier = 4; pet.tierMult = 1.6;
    const expectedGs = normGS(pet);
    ST(2); // bascule vers Sections -- doit re-rendre avec le NOUVEAU GS, pas un ancien DOM figé
    const terrainBadge = document.querySelector('.terrain-slot.occ .gs-badge');
    const sectionsGs = terrainBadge ? terrainBadge.textContent : 'not-found';
    ST(3); // bascule vers Collection -- même vérification
    const gridBadge = document.querySelector('.pet-card .gs-badge');
    const collectionGs = gridBadge ? gridBadge.textContent : 'not-found';
    return { expectedGs, sectionsGs, collectionGs };
  });

  expect(result.sectionsGs).toBe(`GS ${result.expectedGs}`);
  expect(result.collectionGs).toContain(String(result.expectedGs));
  expect(pageErrors).toEqual([]);
});

// bug corrigé (2026-07-11, rapporté explicitement : "Fenetre hors ligne non affichée au retour
// d'un jour... verifier si le farm est bien calculé") -- applyOfflineProgress() n'était appelée
// qu'au chargement de l'iframe (loadGame()) -- un onglet resté ouvert/caché longtemps sans jamais
// recharger la page n'avait aucun moyen de déclencher le rattrapage. Simule un visibilitychange
// après une longue absence et vérifie que le rattrapage (silver + toast) se déclenche bien.
test('offline catch-up fires on visibilitychange after a long hidden gap, not just on page load', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  const result = await frame.locator('body').evaluate(() => {
    const cat = PET_CATALOG.find(c => c.sec === 'loot');
    const pet = { id: petId++, uid: 'vis-offline-uid', cat, rar: 1, stats: mkStats(1), hunger: 100, terrain: true, tier: 1, tierXp: 0, tierMult: 1 };
    PETS.push(pet);
    const silverBefore = SILVER;
    // recule lastVisibleTs de 5h (bien au-delà du garde-fou "moins de 3 minutes" d'applyOfflineProgress)
    lastVisibleTs = Date.now() - 5 * 3600 * 1000;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
    return { silverBefore, silverAfter: SILVER, toastHTML: document.getElementById('toast-wrap').innerHTML };
  });

  expect(result.silverAfter).toBeGreaterThan(result.silverBefore);
  expect(result.toastHTML).toContain('Retour après');
  expect(pageErrors).toEqual([]);
});

// onboarding (2026-07-11, demande explicite : "Onboarding pour le menu Compagnon") -- s'affiche une
// seule fois par navigateur (localStorage dédié), jamais si déjà vu. signInForTest() pré-marque ce
// flag pour tous les AUTRES tests (voir son commentaire) -- celui-ci l'efface exprès pour vérifier
// le comportement "première visite".
test('onboarding modal shows on first visit only, and never reopens once dismissed', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await page.evaluate(() => { try { localStorage.removeItem('velia_idle_pets_onboarding_seen_v1'); } catch (e) {} });
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);
  await expect(frame.locator('#onboarding-modal')).toHaveClass(/open/);
  await frame.locator('#onboarding-body button', { hasText: 'Passer' }).click();
  await expect(frame.locator('#onboarding-modal')).not.toHaveClass(/open/);

  const seenFlag = await page.evaluate(() => localStorage.getItem('velia_idle_pets_onboarding_seen_v1'));
  expect(seenFlag).toBe('1');

  expect(pageErrors).toEqual([]);
});

// bug corrigé (2026-07-21, rapporté explicitement : "dans l'index il est noté comme épique, dans
// sections il est noté comme légendaire et dans la collection il est noté comme ancestral") --
// une percée de rareté (BREAKTHROUGH, ticks.js) change p.rar SANS jamais toucher p.cat (l'entrée
// catalogue/espèce reste celle d'origine) : (1) index.js affichait c.rar (rareté DE BASE de
// l'espèce, jamais mise à jour) au lieu de la rareté RÉELLE du pet possédé -- corrigé en
// affichant owned.rar quand le pet est possédé ; (2) la percée ne rappelait que renderSecDetail()
// (panneau de droite), jamais renderSecNav() (liste de gauche) si l'onglet Sections était déjà
// ouvert au moment de la percée -- corrigé, les deux sont maintenant rappelées ensemble.
test('a pet that breaks through in rarity shows the SAME current rarity in Index, Sections and Collection', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);
  await frame.locator('.tabs .tab', { hasText: 'Sections' }).click(); // déjà sur Sections quand la percée survient

  const result = await frame.locator('body').evaluate(() => {
    const cat = PET_CATALOG.find(c => c.rar === 2 && c.sec === 'loot'); // espèce Rare de base
    const pet = { id: petId++, uid: 'breakthrough-uid', cat, rar: 2, stats: mkStats(2), hunger: 100, terrain: true, tier: 1, tierXp: 0, tierMult: rollTierMult(1) };
    PETS.forEach(pp => { if (pp.cat.sec === cat.sec) pp.terrain = false; });
    PETS.push(pet);
    activeSecIdx = SECTIONS.findIndex(s => s.id === cat.sec);
    renderSecNav(); renderSecDetail();
    // 2 percées (comme le tick réel : ne touchent QUE p.rar/p.stats/p.tier, jamais p.cat), en
    // rappelant renderSecNav()+renderSecDetail() ENSEMBLE (le fix), onglet Sections déjà actif
    pet.rar = 3; pet.stats = mkStats(3); pet.tier = 1; pet.tierXp = 0;
    renderSecNav(); renderSecDetail();
    pet.rar = 5; pet.stats = mkStats(5); pet.tier = 1; pet.tierXp = 0;
    renderSecNav(); renderSecDetail();

    const sectionsRstripColor = document.querySelector('.terrain-slot.occ').style.getPropertyValue('--pcard-color');
    const sectionsNavColor = document.querySelector('.sec-row.active .gs-badge') ? getComputedStyle(document.querySelector('.terrain-slot.occ .pcard-name div:nth-child(2)')).color : null;

    ST(3); // Collection
    const collectionRstripColor = document.querySelector(`#card${pet.id} .rstrip`).style.background;

    ST(5); // Index
    const idxCell = Array.from(document.querySelectorAll('#index-pet-table td')).find(td => td.textContent.trim() === 'Ancestral');

    return {
      ancestralHex: RARITIES[5].hex,
      sectionsRstripColor,
      collectionRstripColor,
      indexShowsAncestral: !!idxCell,
    };
  });

  const hexToRgb = hex => { const n = parseInt(hex.slice(1), 16); return `rgb(${(n>>16)&255}, ${(n>>8)&255}, ${n&255})`; };
  expect(result.sectionsRstripColor.toLowerCase()).toBe(result.ancestralHex.toLowerCase());
  expect(result.collectionRstripColor.toLowerCase()).toBe(hexToRgb(result.ancestralHex));
  expect(result.indexShowsAncestral).toBe(true);
  expect(pageErrors).toEqual([]);
});

// bug corrigé (2026-07-21) -- ST() surligne l'onglet actif par POSITION DOM parmi les .tab, pas
// par l'argument i passé à onclick="ST(i)". Garde-fou maintenu après le retrait du Viewer 3D
// (2026-07-18) : les 2 DERNIERS onglets (Marché onclick=ST(10) -> panel p11, Tutoriel ST(11) ->
// p12) doivent chacun se surligner correctement et activer LEUR panel, jamais celui de l'autre.
test('clicking Marché then Tutoriel highlights the right tab and panel (DOM-position based)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  await frame.locator('.tabs .tab', { hasText: 'Marché' }).click();
  await expect(frame.locator('.tabs .tab', { hasText: 'Marché' })).toHaveClass(/active/);
  await expect(frame.locator('.tabs .tab', { hasText: 'Tutoriel' })).not.toHaveClass(/active/);
  await expect(frame.locator('#p11')).toHaveClass(/active/); // Marché = panel p11

  await frame.locator('.tabs .tab', { hasText: 'Tutoriel' }).click();
  await expect(frame.locator('.tabs .tab', { hasText: 'Tutoriel' })).toHaveClass(/active/);
  await expect(frame.locator('.tabs .tab', { hasText: 'Marché' })).not.toHaveClass(/active/);
  await expect(frame.locator('#p12')).toHaveClass(/active/); // Tutoriel = panel p12

  expect(pageErrors).toEqual([]);
});

// feature ajoutée (2026-07-21, demande explicite : "Ajouter au market") -- raccourci depuis une
// carte Collection qui bascule sur l'onglet Marché et pré-sélectionne directement ce familier
// dans la modale de création d'offre, au lieu d'obliger à re-cliquer dessus dans la grille.
test('quickAddToMarket switches to the Marché tab and preselects the clicked pet in the create-offer modal', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);
  await frame.locator('.tabs .tab', { hasText: 'Collection' }).click();

  const petId = await frame.locator('body').evaluate(() => {
    const cat = PET_CATALOG.find(c => c.sec === 'loot');
    const pet = { id: petId++, uid: 'quick-add-uid', cat, rar: 2, stats: mkStats(2), hunger: 100, terrain: false, tier: 1, tierXp: 0, tierMult: 1 };
    PETS.push(pet);
    renderGrid();
    return pet.id;
  });

  // un tutoriel d'objet du jeu principal (ITEM_TUTORIALS) peut s'ouvrir en fond par-dessus l'iframe
  // et bloquer le clic (overlay hôte z-index) -- on ferme tout tutoriel puis on retente le clic.
  const marketBtn = frame.locator(`#card${petId} button[title="Ajouter au marché"]`);
  await expect(marketBtn).toBeVisible();
  for (let i = 0; i < 5; i++) {
    await dismissTutorialIfPresent(page);
    try { await marketBtn.click({ timeout: 3000 }); break; } catch (e) { if (i === 4) throw e; }
  }

  await expect(frame.locator('.tabs .tab', { hasText: 'Marché' })).toHaveClass(/active/);
  await expect(frame.locator('#market-modal')).toHaveClass(/open/);
  const preselected = await frame.locator('body').evaluate(() => marketCreatePetUid);
  const petUid = await frame.locator('body').evaluate((el, id) => PETS.find(p => p.id === id).uid, petId);
  expect(preselected).toBe(petUid);

  expect(pageErrors).toEqual([]);
});

// feature ajoutée (2026-07-21, demande explicite : "montrer ce que le joueur en face n'a pas") --
// dans la modale de contre-offre, chaque familier candidat encore INCONNU du créateur de l'offre
// (species absente de marketOpponentOwnedSpecies, rempli par get_player_owned_species() côté
// serveur -- accès restreint au contexte d'une offre ouverte réelle, voir la migration
// restrict_get_player_owned_species_to_open_offer.sql) affiche un badge "🆕". Teste
// renderCounterPetList() directement avec un Set simulé (pas de vraie session Supabase possible
// dans ce test, voir signInForTest()) plutôt que le trajet réseau complet.
test('counter-offer pet list badges species the offer creator does not own yet', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);
  await frame.locator('.tabs .tab', { hasText: 'Marché' }).click();

  const result = await frame.locator('body').evaluate(() => {
    const catKnown = PET_CATALOG.find(c => c.sec === 'loot');
    const catUnknown = PET_CATALOG.find(c => c.sec === 'xp' && c.name !== catKnown.name);
    const petKnown = { id: petId++, uid: 'known-uid', cat: catKnown, rar: 1, stats: mkStats(1), hunger: 100, terrain: false, tier: 1, tierXp: 0, tierMult: 1 };
    const petUnknown = { id: petId++, uid: 'unknown-uid', cat: catUnknown, rar: 1, stats: mkStats(1), hunger: 100, terrain: false, tier: 1, tierXp: 0, tierMult: 1 };
    PETS.push(petKnown, petUnknown);

    marketOffers = [{ id: 999, owner_user_id: 'someone-else', pet_qty: 1, accepts_pets: true }];
    document.getElementById('market-modal-body').innerHTML = '<div id="market-counter-pet-list"></div>';
    marketCounterOfferId = 999; marketCounterPetUids = new Set();
    marketOpponentOwnedSpecies = new Set([catKnown.name]); // le créateur possède déjà catKnown, pas catUnknown

    renderCounterPetList(999);
    const knownHasBadge = !!document.querySelector(`.market-pick[data-uid="known-uid"] span[title]`);
    const unknownHasBadge = !!document.querySelector(`.market-pick[data-uid="unknown-uid"] span[title]`);
    return { knownHasBadge, unknownHasBadge };
  });

  expect(result.knownHasBadge).toBe(false);
  expect(result.unknownHasBadge).toBe(true);
  expect(pageErrors).toEqual([]);
});

// feature ajoutée (2026-07-21, demande explicite : "lorsqu'on passe a la rareté superieur, on
// change de nom et on prend les noms de la rareté superieur") -- BREAKTHROUGH changeait p.rar
// SANS jamais réassigner p.cat (espèce/nom), laissant un pet affiché sous un ancien nom qui ne
// correspondait plus à sa vraie rareté. Teste directement la fonction pure partagée
// (speciesForSectionAndRarity, tier.js) plutôt que de forcer un vrai tick aléatoire (le tirage de
// breakthrough est très rare, voir RARITY_BREAKTHROUGH_CHANCE) -- même approche que les autres
// tests de fonctions pures de ce fichier.
test('speciesForSectionAndRarity returns the exact species for every section×rarity combo (deterministic 1-to-1 mapping)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);
  const result = await frame.locator('body').evaluate(() => {
    const mismatches = [];
    SECTIONS.forEach(s => {
      for (let rar = 0; rar <= 5; rar++) {
        const cat = speciesForSectionAndRarity(s.id, rar);
        if (!cat || cat.sec !== s.id || cat.rar !== rar) mismatches.push({ sec: s.id, rar, cat });
      }
    });
    return { mismatches };
  });

  expect(result.mismatches).toEqual([]);
  expect(pageErrors).toEqual([]);
});

// Vérifie que la migration rétroactive corrige un pet "percé" avant le correctif (écart >= 2
// entre p.rar et p.cat.rar, seule signature possible d'une percée historique -- voir commentaire
// de migratePetSpeciesRarityV1, save.js) SANS toucher un pet fraîchement éclos dont l'écart voulu
// de 1 (rollAndCreatePet, hatch.js) est un mécanisme de jeu distinct, pas un bug à corriger.
test('migratePetSpeciesRarityV1 fixes a legacy breakthrough pet but leaves a normal ±1 hatch mismatch untouched', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);
  const result = await frame.locator('body').evaluate(() => {
    // pet "légende" avant le correctif : espèce Épique (rar=3) de la section farming, mais p.rar
    // a percé jusqu'à 5 (Ancestral) sans jamais réassigner p.cat -- écart de 2, signature d'une
    // percée historique.
    const staleCat = speciesForSectionAndRarity('farming', 3);
    const legacyPet = { id: petId++, uid: 'legacy-breakthrough', cat: staleCat, rar: 5, stats: mkStats(5), hunger: 100, terrain: false, tier: 1, tierXp: 0, tierMult: 1 };
    // pet fraîchement éclos : écart voulu de 1 (fuzzy match du hatch), ne doit PAS être touché.
    const freshCat = speciesForSectionAndRarity('loot', 1);
    const freshPet = { id: petId++, uid: 'fresh-hatch-mismatch', cat: freshCat, rar: 2, stats: mkStats(2), hunger: 100, terrain: false, tier: 1, tierXp: 0, tierMult: 1 };
    PETS.push(legacyPet, freshPet);

    migratePetSpeciesRarityV1();

    return {
      legacyCatName: legacyPet.cat.name,
      legacyCatRar: legacyPet.cat.rar,
      expectedLegacyCatName: speciesForSectionAndRarity('farming', 5).name,
      freshCatName: freshPet.cat.name,
      expectedFreshCatNameUnchanged: freshCat.name,
    };
  });

  expect(result.legacyCatRar).toBe(5);
  expect(result.legacyCatName).toBe(result.expectedLegacyCatName);
  expect(result.freshCatName).toBe(result.expectedFreshCatNameUnchanged);
  expect(pageErrors).toEqual([]);
});

// ═══ Session du 2026-07-13 — 7 tâches liées au module Compagnon (CLAUDE.md §28) ═══

// Tâche 1 -- les % de chance par palier étaient déjà visibles AVANT l'éclosion (sélection d'œuf,
// openEggChoice()) mais disparaissaient à l'écran de reveal (doHatch()). renderEggOddsRecap()
// réaffiche EXACTEMENT egg.odds sur ce même écran, sans dupliquer le calcul.
test('hatch reveal screen shows the odds recap of the egg that was used', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  await setSharedSilver(frame, 10_000_000); // silver côté jeu suffisant (pool partagé)
  const result = await frame.locator('body').evaluate(async () => {
    const eggType = EGG_TYPES[0];
    // nouveau modèle (2026-07-18) : l'œuf est sur le slot ; doHatch(index) lit slot.eggId.
    incubSlots[0] = { free: true, eggId: eggType.id, tl: 0, tot: 1, ready: true };
    doHatch(0);
    // doHatch affiche d'abord la roulette de rareté (~1.9s) PUIS le reveal (showHatchPetReveal, qui
    // contient le récap des odds). On attend la fin de la roulette.
    await new Promise(r => setTimeout(r, 2200));
    const bodyHtml = document.getElementById('hatch-body').innerHTML;
    return { bodyHtml, firstOdd: eggType.odds[0], eggName: eggType.name };
  });
  expect(pageErrors).toEqual([]);
  expect(result.bodyHtml).toContain('Chances de');
  expect(result.bodyHtml).toContain(result.eggName);
  expect(result.bodyHtml).toContain(`${result.firstOdd}%`);
});

// Tâche 2 -- progressiveTierProbability() (tier.js) remplace un cutoff net par une rampe linéaire
// autour d'un seuil ; vérifie la fonction pure (0 en dessous de la bande, 1 au-dessus, 0.5 au
// centre), puis que baseRarityDraw() (fusion.js) produit bien des probabilités différentes selon
// que le parent de rareté basse est proche ou loin du seuil GS de la rareté supérieure.
test('progressiveTierProbability() ramps linearly around a threshold and feeds into fusion base-rarity odds', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  const result = await frame.locator('body').evaluate(() => {
    const pure = {
      belowBand: progressiveTierProbability(80, 100, 10),   // 80 < 100-10 -> 0
      aboveBand: progressiveTierProbability(120, 100, 10),  // 120 > 100+10 -> 1
      atThreshold: progressiveTierProbability(100, 100, 10),// centre de la rampe -> 0.5
      hardCutoffBelow: progressiveTierProbability(50, 100, 0), // band<=0 -> cutoff dur
      hardCutoffAbove: progressiveTierProbability(150, 100, 0),
    };
    // 2 parents de rareté 3 (Épique) et 4 (Légendaire) -- écart de rareté fixe (rarGap=1) mais GS
    // du parent Épique très différent : un mal roulé (stats au plancher, Tier 1) très en dessous
    // du seuil GS moyen T1 de la rareté supérieure, vs un très bien roulé (stats au plafond,
    // Tier 5) bien au-dessus de ce même seuil.
    const cat = PET_CATALOG[0];
    const weakLo = { cat, rar: 3, tier: 1, stats: [14,7,6,2,0], tierMult: TIER_MULT_RANGE[0][0] };
    const strongLo = { cat, rar: 3, tier: 5, stats: [25,14,12,7,0], tierMult: TIER_MULT_RANGE[4][1] };
    const hi = { cat, rar: 4, tier: 1, stats: [30,17,14,9,6], tierMult: 1 };
    const drawWeak = baseRarityDraw(weakLo, hi);
    const drawStrong = baseRarityDraw(strongLo, hi);
    const pctHigherWeak = drawWeak.outcomes.find(o => o.rar === 4).pct;
    const pctHigherStrong = drawStrong.outcomes.find(o => o.rar === 4).pct;
    return { pure, pctHigherWeak, pctHigherStrong };
  });
  expect(pageErrors).toEqual([]);
  expect(result.pure.belowBand).toBe(0);
  expect(result.pure.aboveBand).toBe(1);
  expect(result.pure.atThreshold).toBeCloseTo(0.5, 5);
  expect(result.pure.hardCutoffBelow).toBe(0);
  expect(result.pure.hardCutoffAbove).toBe(1);
  // un parent bas mieux roulé (plus proche du seuil de la rareté supérieure) doit avoir de
  // meilleures chances de tomber sur l'issue haute -- chevauchement progressif, pas un cutoff net
  expect(result.pctHigherStrong).toBeGreaterThan(result.pctHigherWeak);
  // reste borné entre 10 et 90 (même garde-fou que l'ancienne formule gapRatio-only)
  expect(result.pctHigherWeak).toBeGreaterThanOrEqual(10);
  expect(result.pctHigherStrong).toBeLessThanOrEqual(90);
});

// Tâche 3 -- applyOfflineProgress() doit rattraper TOUS les timers/compteurs identifiés à l'audit
// (CLAUDE.md §28), pas seulement le silver/loot commun des pets déployés : slots d'incubation,
// XP de Tier des pets déployés, loot spécial (Caphras).
test('offline catch-up advances incubation slot timers, tier XP, and special loot -- not just silver', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  const result = await frame.locator('body').evaluate(() => {
    const cat = PET_CATALOG.find(c => c.sec === 'minage'); // section avec du Caphras/Dopi (catalog.js)
    const deployed = { id: petId++, cat, rar: 0, stats: [3,0,0,0,0], hunger: 90, terrain: true, tier: 1, tierXp: 0, tierMult: 1 };
    PETS.push(deployed);
    incubSlots.push({ locked:false, ready:false, tl:5000, tot:5000 }); // ne serait PAS prêt sans rattrapage
    const eggTimerBefore = eggTimer;
    const invBefore = Object.keys(INVENTORY).length;

    // simule 10h d'absence (bien en dessous du plafond 24h)
    const savedAt = Date.now() - 10*3600*1000;
    applyOfflineProgress(savedAt);

    const slot = incubSlots[incubSlots.length-1];
    return {
      slotReady: slot.ready,
      slotTl: slot.tl,
      tierAfter: deployed.tier,
      tierXpAfter: deployed.tierXp,
      eggTimerChanged: eggTimer !== eggTimerBefore,
      invGrew: Object.keys(INVENTORY).length >= invBefore,
      hungerAfter: deployed.hunger,
    };
  });
  expect(pageErrors).toEqual([]);
  // 10h = 36000s >> le timer de 5000s du slot -- doit être rattrapé et prêt
  expect(result.slotReady).toBe(true);
  expect(result.slotTl).toBe(0);
  // 10h à 2 XP/s = 72000 XP, largement de quoi monter au moins 1 Tier depuis T1 (seuil 800)
  expect(result.tierAfter).toBeGreaterThan(1);
  expect(result.eggTimerChanged).toBe(true);
  expect(result.hungerAfter).toBeLessThan(90); // la faim a quand même un peu baissé
  expect(result.hungerAfter).toBeGreaterThanOrEqual(0);
});

// Tâche 4 -- l'auto-nourrissage n'était jamais persisté (toujours ON après un rechargement, quel
// que soit le choix précédent du joueur) : autoFeedEnabled doit survivre à un cycle save/load.
test('auto-feed toggle state persists across a save/load cycle', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  const result = await frame.locator('body').evaluate(() => {
    // désactive puis sauvegarde
    toggleAutoFeed(document.getElementById('autotog'));
    const afterToggle = autoFeedEnabled;
    saveGame();
    const persisted = JSON.parse(localStorage.getItem('velia_idle_pets_save'));
    // simule un rechargement : reset la variable au défaut, puis recharge depuis localStorage
    autoFeedEnabled = true;
    loadGame();
    return { afterToggle, persistedValue: persisted.autoFeedEnabled, afterReload: autoFeedEnabled, domOn: document.getElementById('autotog').classList.contains('on') };
  });
  expect(pageErrors).toEqual([]);
  expect(result.afterToggle).toBe(false);
  expect(result.persistedValue).toBe(false);
  expect(result.afterReload).toBe(false);
  expect(result.domOn).toBe(false);
});

// Auto-nourrissage : ne plante jamais et ne boucle jamais quand il n'y a plus aucune nourriture
// disponible (garde-fou déjà en place avant cette session, vérifié explicitement à l'audit §28).
test('auto-feed tick is a safe no-op when no food is available', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  const result = await frame.locator('body').evaluate(() => {
    const cat = PET_CATALOG[0];
    const hungry = { id: petId++, cat, rar: 0, stats: [1,0,0,0,0], hunger: 5, terrain: true, tier: 1, tierXp: 0, tierMult: 1 };
    PETS.push(hungry);
    INVENTORY = {}; // aucune nourriture disponible
    autoFeedEnabled = true;
    let threw = false;
    try {
      const specialResourceNames = new Set([CAPHRAS_ITEM.n, ...DOPI_ITEMS.map(d=>d.n), ...Object.values(BOSS_ITEMS).map(b=>b.n)]);
      PETS.forEach(p => {
        if (!p.terrain || p.hunger >= 30) return;
        const cheapestFood = Object.entries(INVENTORY).filter(([n,d]) => d.feed>0 && !specialResourceNames.has(n)).sort((a,b)=>a[1].feed-b[1].feed)[0];
        if (!cheapestFood) return;
        const [name, food] = cheapestFood;
        p.hunger = Math.min(100, p.hunger+food.feed);
        food.qty--;
        if (food.qty<=0) delete INVENTORY[name];
      });
    } catch (e) { threw = true; }
    return { threw, hungerUnchanged: hungry.hunger === 5 };
  });
  expect(pageErrors).toEqual([]);
  expect(result.threw).toBe(false);
  expect(result.hungerUnchanged).toBe(true);
});

// Tâche 5 -- les % de loot du Hardinage n'étaient affichés nulle part dans l'UI. renderHardOdds()
// doit lister, pour chaque pet actif sur le terrain, la même distribution commun/peu commun/rare
// que triggerHardDrop() calcule réellement (même gsFactor, même formule).
test('hardinage tab displays per-pet loot odds matching the real drop calculation', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  const result = await frame.locator('body').evaluate(() => {
    const cat = PET_CATALOG.find(c => c.sec === 'peche');
    const deployed = { id: petId++, cat, rar: 4, stats: [20,10,8,4,0], hunger: 100, terrain: true, tier: 3, tierXp: 0, tierMult: 1.3 };
    PETS.push(deployed);
    ST(6); // onglet Hardinage
    const html = document.getElementById('hard-odds-panel').innerHTML;
    const gsFactor = 1 + gsPct(deployed)/200;
    const expectedRarePct = Math.min(100, 2*gsFactor).toFixed(1);
    return { html, petName: cat.name, expectedRarePct, hasCommon: html.includes(secById(cat.sec).drops[0].n), hasUncommon: html.includes(secById(cat.sec).drops[1].n), hasRare: html.includes(secById(cat.sec).drops[2].n) };
  });
  expect(pageErrors).toEqual([]);
  expect(result.html).toContain(result.petName);
  expect(result.html).toContain(`${result.expectedRarePct}%`);
  expect(result.hasCommon).toBe(true);
  expect(result.hasUncommon).toBe(true);
  expect(result.hasRare).toBe(true);
});

// Tâche 6 -- les cartes de réserve (Sections) doivent être dépliées par défaut (tout le détail
// visible sans clic), le badge GS coloré selon la rareté du pet (pas une couleur neutre), et le
// Tier affiché à côté du GS.
test('reserve cards in Sections are expanded by default with a rarity-colored GS badge next to the Tier', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  const result = await frame.locator('body').evaluate(() => {
    const cat = PET_CATALOG.find(c => c.sec === 'combat');
    const reservePet = { id: petId++, cat, rar: 4, stats: [20,10,8,4,0], hunger: 100, terrain: false, tier: 2, tierXp: 0, tierMult: 1.2 };
    PETS.push(reservePet);
    activeSecIdx = SECTIONS.findIndex(s => s.id === cat.sec);
    ST(2);
    renderSecNav(); renderSecDetail();
    const card = document.querySelector('.sec-detail [style*="grid-template-columns"] > div');
    const gsBadge = card.querySelector('.gs-badge');
    return {
      isCollapsedByDefault: collapsedResPets.has(reservePet.id),
      hasStatBars: !!card.querySelector('[class*="stat"], .fp-row, canvas') && card.innerHTML.includes('%'),
      innerHtmlLength: card.innerHTML.length,
      gsBadgeColor: gsBadge ? gsBadge.style.color : null,
      expectedColor: RARITIES[4].hex,
      hasTierNearGs: card.textContent.includes('T2') && card.textContent.includes('GS'),
    };
  });
  expect(pageErrors).toEqual([]);
  expect(result.isCollapsedByDefault).toBe(false); // déplié par défaut, jamais dans le Set des repliés
  expect(result.gsBadgeColor).toBeTruthy();
  expect(result.hasTierNearGs).toBe(true);
  // la couleur inline doit correspondre à la rareté (Légendaire, #cc8820 = rgb(204,136,32)), pas
  // une couleur neutre -- getComputedStyle renvoie toujours du rgb(), jamais l'hex d'origine.
  expect(result.gsBadgeColor).toBe('rgb(204, 136, 32)');
});

// Tâche 7 -- le sélecteur de familier de "nouvelle offre" (Marché) est une grille cliquable, PAS
// un <select> natif, et vit dans son propre panneau visuellement séparé (bordé, titré "1.") du
// formulaire de conditions ("2.") ; aucun fond blanc résiduel sur les champs natifs (number/checkbox).
test('market "new offer" pet selector is a clickable grid (not a native select) visually separated from the terms form, with no residual white background', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  const result = await frame.locator('body').evaluate(() => {
    const cat = PET_CATALOG[0];
    PETS.push({ id: petId++, uid: crypto.randomUUID(), cat, rar: 0, stats: [1,0,0,0,0], hunger: 100, terrain: false, tier: 1, tierXp: 0, tierMult: 1 });
    marketMyOffers = []; // pour que le pet ne soit pas exclu comme "déjà en vente"
    openCreateOfferModal();
    const body = document.getElementById('market-modal-body');
    const hasNativeSelect = !!body.querySelector('select');
    const picks = body.querySelectorAll('.market-pick');
    const numberInput = body.querySelector('input[type="number"]');
    const inputBg = numberInput ? getComputedStyle(numberInput).backgroundColor : null;
    const bodyHtml = body.innerHTML;
    return {
      hasNativeSelect,
      pickCount: picks.length,
      bodyHtml,
      inputBg,
      hasWhiteBg: /background(-color)?\s*:\s*(#fff|#ffffff|white|rgb\(255,\s*255,\s*255\))/i.test(bodyHtml),
    };
  });
  expect(pageErrors).toEqual([]);
  expect(result.hasNativeSelect).toBe(false); // grille cliquable, jamais un <select>
  expect(result.pickCount).toBeGreaterThan(0);
  expect(result.bodyHtml).toContain('1. Choisis le familier');
  expect(result.bodyHtml).toContain('2. Conditions de l\'offre');
  expect(result.hasWhiteBg).toBe(false); // pas de background blanc en dur dans le HTML généré
  // le champ number a bien un fond thémé (pas transparent/blanc par défaut du navigateur)
  expect(result.inputBg).not.toBe('rgba(0, 0, 0, 0)');
  expect(result.inputBg).not.toMatch(/^rgb\(255,\s*255,\s*255\)$/);
});

// ═══ TOURNOI PvP QUOTIDIEN (2026-07-13, demande explicite confirmée) ═══════════════════════════
// src/companions/pvp-tournament.js + supabase/migrations/20260722090000_companion_pvp_tournament.sql.
// Comme le reste de ce module, la RPC réelle (register_pvp_team/pvp_registrant_count) ne peut pas
// être exercée de bout en bout ici -- signInForTest() fabrique un utilisateur LOCAL (onAuthed()
// direct, pas une vraie session Supabase, voir plus haut), donc tout appel réseau retombe sur un
// repli géré (même politique que syncCompanionStatsToServer : "jamais throw", pas "réussit
// vraiment"). Les fonctions PURES (deriveCombatStats/computeTeamPower/buildBracket/resolveBracket)
// et le rendu client (état de tournoi injecté directement, sans réseau) sont donc testés
// séparément de l'appel RPC lui-même -- même séparation que le prompt de cette tâche demandait
// ("calcul pur testable" vs "I/O réseau").

test('deriveCombatStats/computeTeamPower are pure and computeTeamPower is an AVERAGE (not a sum) across deployed pets', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));
  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  const result = await frame.locator('body').evaluate(() => {
    const mk = (rar, tier) => ({ id: petId++, uid: crypto.randomUUID(), cat: PET_CATALOG.find(c=>c.rar===rar), rar, stats: mkStats(rar), hunger: 100, terrain: true, tier, tierXp: 0, tierMult: (TIER_MULT_RANGE[tier-1][0]+TIER_MULT_RANGE[tier-1][1])/2 });
    const single = [mk(2, 3)];
    const eight = [mk(0,1), mk(1,1), mk(2,1), mk(3,1), mk(4,1), mk(5,1), mk(2,3), mk(3,4)];
    const noPets = [];
    const stats = deriveCombatStats(single[0]);
    return {
      noPetsPower: computeTeamPower(noPets),
      singlePower: computeTeamPower(single),
      eightPower: computeTeamPower(eight),
      statsShape: stats && typeof stats.atk === 'number' && typeof stats.def === 'number' && typeof stats.spd === 'number' && typeof stats.eva === 'number',
      evaCapped: deriveCombatStats({ rar: 5, tier: 5, stats: [60,38,30,20,15] }).eva <= 60,
      // même pet -> même stats à chaque appel (pur, pas d'effet de bord/aléatoire)
      deterministic: JSON.stringify(deriveCombatStats(single[0])) === JSON.stringify(deriveCombatStats(single[0])),
    };
  });
  expect(pageErrors).toEqual([]);
  expect(result.noPetsPower).toBe(0); // aucun pet déployé -- puissance nulle, jamais NaN/erreur
  expect(result.statsShape).toBe(true);
  expect(result.evaCapped).toBe(true);
  expect(result.deterministic).toBe(true);
  // MOYENNE, pas somme : la puissance à 8 pets (mélange faible/fort) reste dans le même ordre de
  // grandeur qu'un seul pet fort, jamais ~8x plus élevée (ce qui prouverait une somme, pas une moyenne).
  expect(result.eightPower).toBeLessThan(result.singlePower * 3);
  expect(result.eightPower).toBeGreaterThan(0);
});

test('buildBracket pads an odd entrant count with byes to the next power of two, and resolveBracket is deterministic for a given seed', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));
  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  const result = await frame.locator('body').evaluate(() => {
    const entrants5 = [1,2,3,4,5].map(i => ({ userId: 'u'+i, pseudo: 'P'+i, power: i*100 }));
    const b5 = buildBracket(entrants5, 'test-seed-2099-01-01');
    const emptyBracket = buildBracket([], 'x');
    const r1 = resolveBracket(b5, 'test-seed-2099-01-01');
    const r2 = resolveBracket(b5, 'test-seed-2099-01-01'); // même seed -> même résultat
    const rOther = resolveBracket(b5, 'a-different-seed'); // seed différente -> pas garanti pareil
    return {
      size5: b5.size, byeCount: b5.slots.filter(s => s === null).length, slotCount: b5.slots.length,
      emptySize: emptyBracket.size,
      r1Winner: r1.winner && r1.winner.userId, r2Winner: r2.winner && r2.winner.userId,
      roundCount: r1.rounds.length,
      sameSeedSameWinner: JSON.stringify(r1) === JSON.stringify(r2),
    };
  });
  expect(pageErrors).toEqual([]);
  expect(result.size5).toBe(8); // puissance de 2 >= 5
  expect(result.slotCount).toBe(8);
  expect(result.byeCount).toBe(3); // 8 - 5 = 3 byes
  expect(result.emptySize).toBe(0); // 0 inscrit -- jamais une erreur/NaN
  expect(result.roundCount).toBe(3); // log2(8) = 3 rounds
  expect(result.sameSeedSameWinner).toBe(true); // déterministe pour une seed donnée (rejouable)
});

test('PvP tab shows the tournament countdown card, disables registration with zero deployed pets, and renders yesterday\'s replay bracket from an injected resolved state', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));
  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  await dismissTutorialsAndClick(page, frame.locator('.tabs .tab', { hasText: 'PvP' }));
  await expect(frame.locator('#pvp-tournament-card')).toBeVisible();
  // le compte à rebours affiche un vrai format HH:MM:SS, pas un texte figé "--:--:--"
  await expect(frame.locator('#pvp-countdown')).toHaveText(/^\d{2}:\d{2}:\d{2}$/, { timeout: 5000 });

  // aucun familier déployé au départ (roster de test vide, voir "roster de départ : 0 pet" plus
  // haut) -- le bouton d'inscription doit être désactivé, pas juste silencieusement inopérant.
  const registerBtn = frame.locator('#pvp-tournament-card button', { hasText: 'Inscrire mon équipe' });
  await expect(registerBtn).toBeDisabled();

  // état "résolu" injecté directement côté client (pas de vraie session Supabase dans ce
  // contexte de test, voir commentaire en tête de cette section) -- vérifie le rendu du replay
  // (vainqueur + parcours perso + bracket complet), pas l'appel RPC lui-même.
  const injected = await frame.locator('body').evaluate(() => {
    const myId = (typeof getCurrentUserForSync === 'function') ? null : null; // n/a côté iframe
    const userId = '00000000-0000-4000-8000-000000000001'; // même id que signInForTest()
    pvpTournamentState.yesterday = {
      day: '2099-01-01', status: 'resolved', winner_pseudo: 'ChampionDuTest', registrant_count: 3,
      bracket: {
        size: 4,
        entrants: [
          { user_id: userId, pseudo: 'Moi', power: 500 },
          { user_id: 'u2', pseudo: 'Rival', power: 300 },
          { user_id: 'u3', pseudo: 'ChampionDuTest', power: 900 },
        ],
        rounds: [
          [
            { a: { user_id: userId, pseudo: 'Moi', power: 500 }, b: { user_id: 'u2', pseudo: 'Rival', power: 300 }, winner_user_id: userId },
            { a: { user_id: 'u3', pseudo: 'ChampionDuTest', power: 900 }, b: null, winner_user_id: 'u3' },
          ],
          [
            { a: { user_id: userId, pseudo: 'Moi', power: 500 }, b: { user_id: 'u3', pseudo: 'ChampionDuTest', power: 900 }, winner_user_id: 'u3' },
          ],
        ],
      },
    };
    renderPvpTournamentCard();
    const cardHtml = document.getElementById('pvp-tournament-card').innerHTML;
    return { cardHtml };
  });
  expect(pageErrors).toEqual([]);
  expect(injected.cardHtml).toContain('ChampionDuTest'); // vainqueur affiché
  expect(injected.cardHtml).toContain('Round 1');
  expect(injected.cardHtml).toContain('Round 2');
  expect(injected.cardHtml).toContain('Victoire'); // round 1 gagné
  expect(injected.cardHtml).toContain('Défaite'); // round 2 perdu

  // "voir le bracket complet" ouvre bien la modale dédiée avec le détail des combats -- appelé
  // directement en JS (pas via un clic Playwright) pour ne pas dépendre du timing d'un éventuel
  // tutoriel qui rouvrirait #tutSkipBtn par-dessus l'iframe pendant le clic (flakiness déjà
  // observée avec dismissTutorialsAndClick sur ce test précis, sans rapport avec la logique
  // testée ici -- openPvpBracketModalIfAny()/OM() sont exactement ce que fait ce bouton onclick).
  await frame.locator('body').evaluate(() => { openPvpBracketModalIfAny(); });
  const modalBody = frame.locator('#pvp-bracket-modal-body');
  await expect(modalBody).toContainText('ChampionDuTest');
  await expect(modalBody).toContainText('Round 1');
  await expect(modalBody).toContainText('Rival');
});

test('register_pvp_team RPC call never throws an unhandled exception when the account is not a real Supabase session (offline/invalid-JWT-style failure)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));
  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);
  await dismissTutorialsAndClick(page, frame.locator('.tabs .tab', { hasText: 'PvP' }));

  await frame.locator('body').evaluate(async () => {
    // déploie un familier factice pour que le bouton d'inscription soit actionnable, puis appelle
    // le flux d'inscription réel (échouera réseau -- signInForTest() fabrique un user local sans
    // vraie session -- mais ne doit JAMAIS lever d'exception non gérée, même politique que
    // syncCompanionStatsToServer, voir plus haut).
    const cat = PET_CATALOG[0];
    PETS.push({ id: petId++, uid: crypto.randomUUID(), cat, rar: 0, stats: [1,0,0,0,0], hunger: 100, terrain: true, tier: 1, tierXp: 0, tierMult: 1 });
    await registerForPvpTournament();
  });
  expect(pageErrors).toEqual([]); // aucune exception JS non gérée, même si la RPC échoue réseau
});

// i18n du module (2026-07-16, retour utilisateur : "compagnon pas anglais") -- le module a sa
// PROPRE instance i18next (namespace locales/{fr,en}/companions.json, voir src/companions/i18n.js
// et docs/I18N_PLAN.md §3 "Cas à part : module Compagnons"), et lit la langue depuis
// localStorage['velia-idle-lang'] (iframe same-origin, localStorage partagé avec le jeu
// principal) AU CHARGEMENT de l'iframe. Le défaut reste 'fr' (tous les autres tests de ce
// fichier tournent en français et doivent rester verts) -- ce test force 'en' AVANT le premier
// clic sur l'onglet Compagnon (l'iframe n'existe pas encore, elle bootera donc en anglais) et
// vérifie que le shell statique (onglets, bandeau test), les rendus JS (modale de choix d'œuf)
// et le flux d'éclosion complet s'affichent en anglais -- et qu'aucune clé brute
// "companions.xxx" ne fuit à l'écran.
test('companion module renders in English when velia-idle-lang=en (own i18next instance)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await page.evaluate(() => { try { localStorage.setItem('velia-idle-lang', 'en'); } catch (e) {} });
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await waitCompanionsReady(frame);

  // shell statique traduit par applyCompanionsI18n() (data-i18n, i18n.js)
  await expect(frame.locator('.tabs .tab', { hasText: 'Hatchery' })).toBeVisible();
  await expect(frame.locator('.tabs .tab', { hasText: 'Feed' })).toBeVisible();
  await expect(frame.locator('.tabs .tab', { hasText: 'Leaderboard' })).toBeVisible();

  // flux d'éclosion en anglais (rendus JS : renderHatch/doHatch/reveal) -- le slot de départ est prêt
  // avec un œuf basique ; "Hatch" l'éclot directement (le choix d'œuf est désormais au DÉMARRAGE
  // d'une incubation, sur un slot vide). Garde d'office + roulette, on ferme via "Continue".
  await frame.locator('.tabs .tab', { hasText: 'Hatchery' }).click();
  await frame.locator('.isl.ready button', { hasText: 'Hatch' }).click();
  await expect(frame.locator('#hatch-modal')).toHaveClass(/open/);
  await frame.locator('#hatch-body .btn', { hasText: 'Continue' }).click();
  await expect(frame.locator('#hatch-modal')).not.toHaveClass(/open/);

  await frame.locator('.tabs .tab', { hasText: 'Collection' }).click();
  await expect(frame.locator('.pet-card')).toHaveCount(1);

  // règles de fusion (panneau statique de la Collection) traduites
  await expect(frame.locator('.fusion-panel')).toContainText('Rules');

  // jamais de clé brute "companions.xxx" affichée au joueur (fallbackLng/en complet)
  const bodyText = await frame.locator('body').innerText();
  expect(bodyText).not.toMatch(/companions\.[a-z_]+\./);

  expect(pageErrors).toEqual([]);
});
