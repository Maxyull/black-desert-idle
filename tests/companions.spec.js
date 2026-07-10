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

// l'auto-connexion invité/démo (#authOverlay) fait un vrai aller-retour réseau (Supabase) avant de
// se fermer -- délai variable et parfois > 5s (timeout par défaut de expect()) selon la charge du
// projet Supabase. 20s laisse une vraie marge sans pour autant masquer un blocage réel (le timeout
// global du test, 60s, reste le vrai filet de sécurité).
async function waitForAuthOverlayClosed(page) {
  await expect(page.locator('#authOverlay')).toHaveClass(/hidden/, { timeout: 30000 });
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
  await waitForAuthOverlayClosed(page);
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
  await expect(frame.locator('.hdr-logo')).toHaveText('Velia Idle');

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
  await waitForAuthOverlayClosed(page);
  await dismissTutorialsAndClick(page, page.locator('.actTab[data-id="pet"]'));

  const frame = page.frameLocator('#companionsFrame');
  await expect(frame.locator('.hdr-logo')).toHaveText('Velia Idle');
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
