const { test, expect } = require('@playwright/test');

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
// sign-ins are disabled"), donc sb.auth.signInAnonymously() ne peut plus servir ici non plus.
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

  await companionTab.click();

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
  await companionTab.click();
  await expect(page.locator('#companionsFrame')).toHaveCount(1);
  await expect(overlay).toBeVisible();

  expect(pageErrors).toEqual([]);
});
