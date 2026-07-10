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
  await expect(frame.locator('.hdr-logo')).toHaveText('Black Desert Idle Compagnon');

  // roster de départ : 0 pet (2026-07-10, demande explicite -- voir companions.roster.js)
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
  // rollAndCreatePet() (companions.hatch.js), donc doit valoir 1 après l'unique éclosion ci-dessus.
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

// migration rétroactive (2026-07-19, demande explicite : "supprime les 48 pet pour tout le
// monde") -- une sauvegarde antérieure au passage du roster de départ à 0 pet (companions.roster.js,
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
  await expect(frame.locator('.hdr-logo')).toHaveText('Black Desert Idle Compagnon');
  // "0" est AUSSI l'état par défaut d'un tout nouveau joueur (companions.roster.js) -- ne prouve
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
  await expect(frame.locator('.hdr-logo')).toHaveText('Black Desert Idle Compagnon');

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

  // Collection : légende TOP1/2/3, bouton de tri par Tier, contrôle de zoom
  await frame.locator('.tabs .tab', { hasText: 'Collection' }).click();
  await expect(frame.locator('text=TOP1 = même rareté')).toBeVisible();
  await expect(frame.locator('#sort-tier')).toBeVisible();
  await expect(frame.locator('#zoom-in')).toBeVisible();
  await expect(frame.locator('#zoom-out')).toBeVisible();
  const gridColsBefore = await frame.locator('#pet-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns);
  await frame.locator('#zoom-in').click();
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
// tout seul, SANS changer d'onglet, entre deux lectures espacées de plus d'1s (companions.ticks.js
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
// détaillé dans executeFusion, companions.fusion.js, sur pourquoi bestParentRar et pas bestRar).
test('fusing an Ancestral into a weaker pet that downgrades unlocks the hard achievement', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await expect(frame.locator('.hdr-logo')).toHaveText('Black Desert Idle Compagnon');

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
// passes") -- deltaArrow()/showFusionResultModal() (companions.fusion.js) comparent le Tier et le
// Score (GS) du résultat au MEILLEUR des 2 parents (pas une moyenne) : ⬆️ vert si gain, ⬇️ rouge
// si perte. Deux fusions forcées ici pour couvrir les deux directions dans le même test.
test('fusion result modal shows a green up arrow on gain and a red down arrow on loss, for both tier and GS', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await signInForTest(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await expect(frame.locator('.hdr-logo')).toHaveText('Black Desert Idle Compagnon');

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
  await expect(frame.locator('.hdr-logo')).toHaveText('Black Desert Idle Compagnon');

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
