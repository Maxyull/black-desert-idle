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

// le tutoriel d'onboarding (22 étapes) s'ouvre ~500ms après la fin de loadCloudSave()
// (game-supabase.js:382), elle-même déclenchée après le login invité automatique -- 2 appels
// réseau asynchrones dont la durée réelle varie (CI, latence Supabase). Un simple isVisible()
// (ou une seule attente bornée) rate le tutoriel s'il s'ouvre un peu tard. On poll activement,
// en cliquant "Passer" à chaque fois qu'il apparaît, jusqu'à `timeoutMs` OU jusqu'à observer
// plusieurs vérifications consécutives sans tutoriel visible (signal qu'il ne s'ouvrira plus).
async function waitForTutorialClear(page, timeoutMs = 8000) {
  const skipBtn = page.locator('#tutSkipBtn');
  const deadline = Date.now() + timeoutMs;
  let clearStreak = 0;
  while (Date.now() < deadline && clearStreak < 4) {
    if (await skipBtn.isVisible().catch(() => false)) {
      await skipBtn.click().catch(() => {});
      clearStreak = 0;
      await page.waitForTimeout(300);
    } else {
      clearStreak++;
      await page.waitForTimeout(150);
    }
  }
}

test('companion module opens in an isolated iframe, renders, and closes cleanly', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/index.dev.html', { waitUntil: 'load' });
  // le flux invité (auto-login démo) masque #authOverlay de façon asynchrone après le chargement
  await expect(page.locator('#authOverlay')).toBeHidden({ timeout: 10_000 });
  await waitForTutorialClear(page);

  const companionTab = page.locator('.actTab[data-id="pet"]');
  await expect(companionTab).toBeVisible();
  await expect(companionTab).not.toHaveClass(/locked/);

  // pas encore ouvert : l'iframe ne doit exister qu'après le premier clic (chargement paresseux)
  await expect(page.locator('#companionsFrame')).toHaveCount(0);

  // filet de sécurité : si le tutoriel s'ouvre pile au moment du clic (course résiduelle malgré
  // waitForTutorialClear ci-dessus), une nouvelle passe le referme puis retente une fois
  try {
    await companionTab.click({ timeout: 5000 });
  } catch {
    await waitForTutorialClear(page, 5000);
    await companionTab.click();
  }

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
  await waitForTutorialClear(page);

  // ré-ouverture : l'iframe existante est réutilisée (pas de doublon, pas de rechargement)
  try {
    await companionTab.click({ timeout: 5000 });
  } catch {
    await waitForTutorialClear(page, 5000);
    await companionTab.click();
  }
  await expect(page.locator('#companionsFrame')).toHaveCount(1);
  await expect(overlay).toBeVisible();

  expect(pageErrors).toEqual([]);
});
