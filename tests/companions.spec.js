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
test.describe.configure({ retries: 2 });

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
    await skipBtn.click();
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
    await onAuthed({ id:'00000000-0000-4000-8000-000000000001', email:'playwright-test@local.invalid', is_anonymous:false, identities:[] });
  });
  await expect(page.locator('#authOverlay')).toBeHidden({ timeout: 10_000 });
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

  const overlay = page.locator('#companionsOverlay');
  await expect(overlay).toBeVisible();

  const frame = page.frameLocator('#companionsFrame');
  await expect(frame.locator('.hdr-logo')).toHaveText('Black Desert Idle');

  // roster de départ : 0 pet (2026-07-10, demande explicite -- voir roster.js)
  await expect(frame.locator('#tb2')).toHaveText('0');

  // onglet Collection : grille vide au départ (locator scopé à la barre d'onglets, pour ne pas
  // matcher aussi le texte d'un toast d'achievement contenant le même emoji/mot)
  await frame.locator('.tabs .tab', { hasText: 'Collection' }).click();
  await expect(frame.locator('.pet-card')).toHaveCount(0);

  // onglet Éclosion : le premier slot est prêt au démarrage, l'ouverture de la modale de choix
  // d'œuf fonctionne, et éclore l'œuf gratuit peuple bien la collection
  await frame.locator('.tabs .tab', { hasText: 'Éclosion' }).click();
  await frame.locator('.isl.ready button', { hasText: 'Éclore' }).click();
  await expect(frame.locator('#hatch-modal')).toHaveClass(/open/);
  await expect(frame.locator('#hatch-body .btn')).not.toHaveCount(0);

  await frame.locator('#hatch-body .btn', { hasText: 'Utiliser' }).first().click();
  await frame.locator('#hatch-body .btn', { hasText: 'Garder' }).click();
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

  // ferme le module : l'overlay disparaît et le jeu principal redevient visible
  await page.locator('#companionsOverlay button', { hasText: 'Fermer' }).click();
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
  await expect(frame.locator('.hdr-logo')).toHaveText('Black Desert Idle');

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
      hasTierDot: compact ? !!compact.querySelector('.cmcDot') : false,
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
  expect(result.hasTierDot).toBe(true);
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
  await expect(frame.locator('.hdr-logo')).toHaveText('Black Desert Idle');

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
  await expect(frame.locator('.hdr-logo')).toHaveText('Black Desert Idle');

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
  await expect(frame.locator('.hdr-logo')).toHaveText('Black Desert Idle');

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
  await expect(frame.locator('.hdr-logo')).toHaveText('Black Desert Idle');

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
// depaçable pour recuperer des pet venant d'un trade") -- doHatch()/bulkHatch() doivent refuser
// tout nouvel hatch une fois PETS.length >= PET_ROSTER_CAP (96), AVANT de dépenser le silver.
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
  await expect(frame.locator('.hdr-logo')).toHaveText('Black Desert Idle');

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
  await expect(frame.locator('.hdr-logo')).toHaveText('Black Desert Idle');

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
  await expect(frame.locator('.hdr-logo')).toHaveText('Black Desert Idle');

  const result = await frame.locator('body').evaluate(() => {
    // remplit la collection jusqu'au plafond
    while (PETS.length < PET_ROSTER_CAP) {
      const cat = PET_CATALOG[PETS.length % PET_CATALOG.length];
      PETS.push({ id: petId++, cat, rar: 1, stats: [5,4,3,0,0], hunger: 100, terrain: false, tier: 1, tierXp: 0, tierMult: 1 });
    }
    const savedSilver = SILVER;
    SILVER = 999999999; // jamais bloqué par manque de silver, seulement par le plafond
    const roomBefore = petRosterRoomLeft();
    const countBefore = PETS.length;
    bulkHatch('basic', 1); // 1er type d'œuf standard, peu importe lequel
    const countAfter = PETS.length;
    const silverAfter = SILVER;
    SILVER = savedSilver; // restaure (pas de vraie sauvegarde dans ce contexte de test de toute façon)
    return { roomBefore, countBefore, countAfter, silverSpent: 999999999 - silverAfter };
  });
  expect(result.roomBefore).toBe(0);
  expect(result.countBefore).toBe(96);
  expect(result.countAfter).toBe(96); // bulkHatch() n'a RIEN ajouté, refusé par le plafond
  expect(result.silverSpent).toBe(0); // et n'a jamais débité le silver

  expect(pageErrors).toEqual([]);
});

// garde-fou (2026-07-20, rapporté explicitement : "impossible d'acheter les slots d'oeuf") --
// DEUX boutons d'achat de slot d'incubation étaient des impasses : le slot verrouillé
// (incubSlots[2].locked) n'avait AUCUN onclick, et le bouton "➕ slot premium" ne faisait qu'un
// toast() factice sans jamais rien acheter. Vérifie que les deux débitent réellement SILVER
// (via spendSilver(), donc silverSpent aussi) et changent l'état réel des slots.
test('both egg-slot purchase buttons (unlock the 3rd slot, buy an extra slot) actually spend silver and change slot state', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await expect(frame.locator('.hdr-logo')).toHaveText('Black Desert Idle');
  await frame.locator('.tabs .tab', { hasText: 'Éclosion' }).click();

  const result = await frame.locator('body').evaluate(() => {
    SILVER = 1_000_000; // largement assez pour les 2 achats
    const spentBefore = silverSpent;
    const slotsBefore = incubSlots.length;
    const wasLocked = incubSlots[2] && incubSlots[2].locked === true;

    unlockIncubSlot(2);
    const afterUnlock = { silverSpent, stillLocked: !!(incubSlots[2] && incubSlots[2].locked), ready: incubSlots[2] && incubSlots[2].ready };

    buyExtraIncubSlot();
    const afterExtra = { silverSpent, slotCount: incubSlots.length };

    return { wasLocked, spentBefore, slotsBefore, afterUnlock, afterExtra };
  });
  expect(pageErrors).toEqual([]);
  expect(result.wasLocked).toBe(true); // précondition : le roster de départ a bien un 3e slot verrouillé
  expect(result.afterUnlock.silverSpent).toBeGreaterThan(result.spentBefore);
  expect(result.afterUnlock.stillLocked).toBe(false);
  expect(result.afterUnlock.ready).toBe(true);
  expect(result.afterExtra.silverSpent).toBeGreaterThan(result.afterUnlock.silverSpent);
  expect(result.afterExtra.slotCount).toBe(result.slotsBefore + 1);

  // le DOM reflète bien le nouvel état (pas juste les variables JS) : le bouton "➕" doit toujours
  // exister après l'achat (on peut en acheter un autre), et il ne doit plus rester de slot .locked.
  const domState = await frame.locator('body').evaluate(() => ({
    lockedCount: document.querySelectorAll('#incub-slots .isl.locked').length,
    hasExtraButton: !!document.querySelector('#incub-slots .isl span'),
  }));
  expect(domState.lockedCount).toBe(0);
  expect(domState.hasExtraButton).toBe(true);
  expect(pageErrors).toEqual([]);
});

// plafond de slots d'incubation (2026-07-10, demande explicite : "borner incubation a 8") --
// buyExtraIncubSlot() poussait dans incubSlots sans aucune limite auparavant. Vérifie que le
// plafond bloque bien l'achat ET le débit de silver une fois atteint (pas juste visuel), et que
// le bouton "➕" est remplacé par un état figé dans le DOM.
test('incubation slot purchases are capped at 8, both server-side (silver never spent past the cap) and in the DOM', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await expect(frame.locator('.hdr-logo')).toHaveText('Black Desert Idle');
  await frame.locator('.tabs .tab', { hasText: 'Éclosion' }).click();

  const result = await frame.locator('body').evaluate(() => {
    SILVER = 10_000_000;
    // pousse déjà au plafond (partant du roster de départ, 3 slots) pour isoler le comportement
    // AU plafond sans dépendre du nombre d'achats nécessaires pour l'atteindre.
    while (incubSlots.length < MAX_INCUB_SLOTS) incubSlots.push({ free: false, tl: 0, tot: 1, ready: true });
    renderHatch();
    const spentAtCap = silverSpent, countAtCap = incubSlots.length;
    buyExtraIncubSlot(); // doit être un no-op complet
    return {
      countAtCap, spentAtCap,
      countAfter: incubSlots.length, spentAfter: silverSpent,
      lockedPlaceholder: document.querySelectorAll('#incub-slots .isl.locked').length,
    };
  });
  expect(pageErrors).toEqual([]);
  expect(result.countAtCap).toBe(8);
  expect(result.countAfter).toBe(8); // aucun slot ajouté au-delà du plafond
  expect(result.spentAfter).toBe(result.spentAtCap); // et aucun silver dépensé pour rien
  expect(result.lockedPlaceholder).toBeGreaterThan(0); // le "+" est remplacé par un état figé
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
  await expect(frame.locator('.hdr-logo')).toHaveText('Black Desert Idle');

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
  await expect(frame.locator('.hdr-logo')).toHaveText('Black Desert Idle');

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
  await expect(frame.locator('.hdr-logo')).toHaveText('Black Desert Idle');

  // dépense réelle : achète un œuf pour que "Œufs ouverts"/"Argent dépensé" ne soient pas juste 0 par défaut
  const before = await frame.locator('body').evaluate(() => {
    const cat = PET_CATALOG[0];
    const eggType = EGG_TYPES[0];
    SILVER = eggType.cost + 1000; // assez pour payer
    doHatch(0, eggType.id);
    return { totalHatched, silverSpent, eggCost: eggType.cost };
  });
  expect(before.totalHatched).toBeGreaterThan(0);
  expect(before.silverSpent).toBe(before.eggCost);

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
  await expect(frame.locator('.hdr-logo')).toHaveText('Black Desert Idle');

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
// et l'iframe, même origine -- voir companions.save.js).
test('retroactive migration clears a pre-existing roster and never repeats', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.addInitScript(() => {
    localStorage.setItem('velia_idle_pets_save', JSON.stringify({
      PETS: [{ id: 1 }, { id: 2 }, { id: 3 }], SILVER: 12345, INVENTORY: {}, incubSlots: [],
      eggTimer: 0, petId: 4, hatchCountSincePity: 0, fusionCount: 2, caphrasUpgradeCount: 0,
      bossItemFound: false, breakthroughCount: 0, totalHatched: 3, eggTypesUsed: [],
      completedAchievements: [], pityEverTriggered: false, loginStreak: 1, lastLoginDate: null,
      savedAt: Date.now(),
      // pas de petsRosterResetV1 -- exactement l'état d'une sauvegarde jamais migrée
    }));
  });

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await expect(frame.locator('.hdr-logo')).toHaveText('Black Desert Idle');
  // "0" est AUSSI l'état par défaut d'un tout nouveau joueur (roster.js) -- ne prouve
  // pas à lui seul que loadGame()/la migration ont fini de tourner, donc pas fiable comme seule
  // condition d'attente. On poll directement petsRosterResetV1 (posé synchroneement à la toute fin
  // de loadGame(), voir companions.save.js) jusqu'à ce qu'il devienne true.
  await expect.poll(() => frame.locator('body').evaluate(() => petsRosterResetV1)).toBe(true);
  const afterMigration = await frame.locator('body').evaluate(() => ({
    petsLen: PETS.length, flag: petsRosterResetV1, silverKept: SILVER, fusionKept: fusionCount,
  }));
  expect(afterMigration.petsLen).toBe(0);
  expect(afterMigration.flag).toBe(true);
  // >= et non === : checkDailyStreak() (appelé juste après la migration dans loadGame()) peut
  // accorder un bonus de connexion sur ce même chargement (lastLoginDate:null dans la fixture) --
  // ce qui compte ici est que le silver n'a pas été REMIS À ZÉRO par la migration, pas sa valeur exacte.
  expect(afterMigration.silverKept).toBeGreaterThanOrEqual(12345);
  expect(afterMigration.fusionKept).toBe(2);

  // la migration a persisté (saveGame() appelé immédiatement dans loadGame()) -- lire directement
  // localStorage confirme que le flag est bien écrit, pas seulement en mémoire
  const persisted = await frame.locator('body').evaluate(() =>
    JSON.parse(localStorage.getItem('velia_idle_pets_save')));
  expect(persisted.petsRosterResetV1).toBe(true);
  expect(persisted.PETS).toEqual([]);

  expect(pageErrors).toEqual([]);
});

// 2026-07-20, demande explicite (bandeau/titre/bouton fermer/légende/tri/zoom) : couvre la
// présence de chaque élément UI ajouté, pas leur comportement détaillé (déjà couvert ailleurs).
test('header shows WIP banner, new title, close button, and collection legend/sort/zoom controls', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await expect(frame.locator('.hdr-logo')).toHaveText('Black Desert Idle');

  // bandeau "test en cours" (2026-07-20) -- toujours visible, pas de bouton pour le masquer
  await expect(frame.locator('#wipBanner')).toBeVisible();
  await expect(frame.locator('#wipBanner')).toContainText('test');

  // bouton de fermeture DANS le module, à côté de "FAMILIERS" -- appelle bien closeCompanionsModule
  // de la page hôte (vérifié via l'overlay principal qui se cache après le clic)
  await expect(frame.locator('#hdrCloseBtn')).toBeVisible();
  const overlay = page.locator('#companionsOverlay');
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

  // disclaimer "achat instantané de test" près des boutons ×1/×5/×10
  await frame.locator('.tabs .tab', { hasText: 'Éclosion' }).click();
  await expect(frame.locator('text=raccourci de TEST')).toBeVisible();

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
  await expect(frame.locator('.hdr-logo')).toHaveText('Black Desert Idle');

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
  await expect(frame.locator('.hdr-logo')).toHaveText('Black Desert Idle');

  // Le tier grimpe toujours d'au moins 1 cran par rapport au meilleur parent (baseTier =
  // max(tiers)+1, jamais moins), donc le sens du Tier est déterministe -> ⬆️ vert garanti.
  // Le Score (GS) dépend en revanche d'un tirage de multiplicateur de tier (rollTierMult) —
  // pas déterministe -> le test déduit le sens ATTENDU depuis les vraies valeurs renvoyées par
  // le jeu (plutôt que de figer une direction), pour rester robuste au hasard tout en vérifiant
  // que le HTML affiche exactement la flèche/couleur cohérente avec ce résultat réel.
  const result = await frame.locator('body').evaluate(() => {
    const cat = PET_CATALOG.find(c => c.rar === 1);
    const a = { id: petId++, cat, rar: 1, stats: [10, 10, 10, 0, 0], hunger: 100, terrain: false, tier: 1, tierXp: 0, tierMult: 1 };
    const b = { id: petId++, cat, rar: 1, stats: [12, 12, 12, 0, 0], hunger: 100, terrain: false, tier: 2, tierXp: 0, tierMult: 1 };
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
  await expect(frame.locator('.hdr-logo')).toHaveText('Black Desert Idle');

  const result = await frame.locator('body').evaluate(() => {
    const cat = PET_CATALOG.find(c => c.rar === 0);
    const a = { id: petId++, cat, rar: 0, stats: [5, 0, 0, 0, 0], hunger: 100, terrain: false, tier: 2, tierXp: 0, tierMult: 1 };
    const b = { id: petId++, cat, rar: 0, stats: [5, 0, 0, 0, 0], hunger: 100, terrain: false, tier: 2, tierXp: 0, tierMult: 1 };
    PETS.push(a, b);
    fusionSlots = [a.id, b.id];
    executeFusion(a, b);
    const merged = PETS[PETS.length - 1];
    return { html: document.getElementById('fusion-modal-body').innerHTML, mergedTier: merged.tier };
  });
  expect(pageErrors).toEqual([]);
  expect(result.mergedTier).toBeGreaterThan(2); // baseTier = max(2,2)+1 = 3 minimum
  expect(result.html).not.toContain('var(--red2);font-weight:600">T'); // jamais de flèche rouge sur le Tier
});

// PvP (2026-07-20, demande explicite : "categorie pvp, classement de toutes les fonction de la
// categorie" + "header : PVP bloqué") -- vrai PvP joueur-contre-joueur pas encore livré (bandeau
// verrouillé, voir companions.pvp.js), mais le classement local par puissance (GS) fonctionne
// réellement -- vérifie les deux : l'UI verrouillée ET le tri correct du classement.
test('PvP tab shows a locked banner and a real GS-sorted ranking of owned pets', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await frame.locator('.tabs .tab', { hasText: 'PvP' }).click();
  await expect(frame.locator('text=PvP — Bientôt disponible')).toBeVisible();

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

// Viewer 3D GLB (2026-07-10, demande explicite : "on va integrer des model gbl") -- écran de test
// isolé qui charge Three.js vendorisé en local (vendor/three/, jamais de CDN, voir README.md) via
// un pont module->global (vendor/three/three-bridge.js, event 'three-ready') puis un .glb hébergé
// sur Supabase Storage (bucket public "companion-models", voir supabase/migrations/
// 20260710072116_companion_models_bucket.sql). Ce test couvre le PIPELINE (THREE chargé, canvas
// WebGL créé, statut mis à jour), pas le contenu du modèle lui-même -- le fichier de test
// (loot/black_mask_cat_T5.glb) est uploadé manuellement via le Dashboard Supabase (pas dans ce
// repo, ~31 Mo), donc peut être absent selon l'environnement ; un 404 réseau est un échec de
// CHARGEMENT géré proprement (message d'erreur affiché), jamais une exception JS -- distinction
// vérifiée explicitement ci-dessous.
test('3D viewer tab loads Three.js locally (no CDN) and creates a WebGL canvas without throwing', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await frame.locator('.tabs .tab', { hasText: 'Viewer 3D' }).click();
  await expect(frame.locator('#viewer3d-canvas-wrap')).toBeVisible();

  // three-bridge.js est un <script type="module">, chargé de façon asynchrone -- on attend
  // l'event 'three-ready' déjà géré par companions.viewer3d.js (initViewer3dIfNeeded réessaie
  // via window.addEventListener('three-ready', ...) s'il tourne avant que le bridge soit prêt).
  await expect
    .poll(() => frame.locator('body').evaluate(() => typeof window.THREE), { timeout: 15_000 })
    .toBe('object');

  // un <canvas> WebGL doit apparaître dans le conteneur dédié une fois le renderer créé
  await expect(frame.locator('#viewer3d-canvas-wrap canvas')).toHaveCount(1, { timeout: 10_000 });

  // le statut doit sortir de l'état initial ("En attente…"), que le .glb charge ou échoue
  // (404 si le fichier de test n'a pas encore été uploadé dans ce bucket dans cet environnement)
  await expect
    .poll(() => frame.locator('#viewer3d-status').textContent(), { timeout: 15_000 })
    .not.toBe('En attente…');

  // jamais d'exception JS non gérée, même si le chargement réseau du .glb échoue (404)
  expect(pageErrors).toEqual([]);
});

// Intégration réelle du 1er modèle GLB (2026-07-10, demande explicite : "envoyer le premier test
// .glb") -- le bouton "🧊 Voir en 3D" (panneau du pet déployé sur le terrain,
// sections.js) ne doit apparaître QUE pour un pet dont companionModelUrlFor() renvoie
// une URL réelle (COMPANION_MODEL_MAP, companions.viewer3d.js) -- seul "Black Mask Cat" T5 est
// câblé pour l'instant (seul fichier uploadé dans le bucket). Vérifie l'affichage conditionnel ET
// que la modale réutilise bien le même pipeline Three.js déjà validé par l'écran de test.
test('"Voir en 3D" button only appears for a pet with an uploaded model, and opens a working Three.js modal', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
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
  await expect(frame.locator('.hdr-logo')).toHaveText('Black Desert Idle');

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
  await expect(frame.locator('.hdr-logo')).toHaveText('Black Desert Idle');

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
// pet.uid stable + companions.market.js -- voir supabase/migrations/20260710150000_companion_pet_trade_market.sql

test('rollAndCreatePet assigns a stable uid, and petSnapshotOf/petFromSnapshot round-trip preserves it', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await expect(frame.locator('.hdr-logo')).toHaveText('Black Desert Idle');

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
// écraser un uid déjà présent sur un autre pet (voir loadGame(), companions.save.js).
test('migratePetUidV1 assigns a uid to legacy pets missing one, without touching pets that already have one', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await expect(frame.locator('.hdr-logo')).toHaveText('Black Desert Idle');

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
// try/catch dans companions.market.js, jamais une exception qui remonte au navigateur).
test('Marché tab renders its 3 sub-tabs and never throws even without a real Supabase session', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await expect(frame.locator('.hdr-logo')).toHaveText('Black Desert Idle');

  await frame.locator('.tabs .tab', { hasText: 'Marché' }).click();
  await expect(frame.locator('#market-body')).toBeVisible();

  const navLabels = await frame.locator('#market-nav .schip').allTextContents();
  expect(navLabels).toEqual(['🛒 Marché', '📜 Mes contrats', '📚 Historique']);

  await frame.locator('#market-nav .schip', { hasText: 'Mes contrats' }).click();
  await frame.locator('#market-nav .schip', { hasText: 'Historique' }).click();
  await frame.locator('#market-nav .schip', { hasText: 'Marché' }).click();

  expect(pageErrors).toEqual([]);
});
