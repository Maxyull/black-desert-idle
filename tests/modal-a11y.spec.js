// Accessibilité clavier des modales (2026-07-22, audit repo P9).
//
// Spec à part de tests.js parce qu'il faut de VRAIES touches clavier (page.keyboard.press) et un
// vrai focus : `tests.js` tourne dans la page et peut appeler des fonctions, pas simuler un
// utilisateur au clavier. Ce qui est vérifié ici est le comportement observable — quelle modale se
// ferme, où va le focus — pas la présence d'un écouteur dans le code.
//
// Les cas qui comptent le plus sont les deux REFUS : le verrou de session et l'écran d'auth sans
// compte ne doivent PAS se fermer avec Échap. Un « Échap ferme tout » serait une régression
// (session évincée qui rejoue, joueur coincé devant un jeu inutilisable). Ces deux tests-là sont la
// raison d'être du fichier.
const { test, expect } = require('@playwright/test');

const DEV = '/index.dev.html';

test.beforeEach(async ({ page }) => {
  await page.goto(DEV, { waitUntil: 'load' });
});

// Au chargement, #authOverlay n'a AUCUNE classe : l'écran de connexion est donc bel et bien ouvert,
// et c'est lui la modale du dessus (z-index 100). C'est correct — mais ça veut dire que les tests
// qui vérifient un panneau de jeu doivent d'abord représenter un joueur EN JEU, sinon ils ouvrent
// un panneau par-dessus l'écran de connexion, ce qu'aucun joueur ne peut faire. Mes 3 premiers
// tests échouaient pour cette raison : le code avait raison, les tests étaient irréalistes.
async function enterGame(page) {
  await page.evaluate(() => { currentUser = { id: 'x', email: 'a@b.c' }; showAuthOverlay(false); });
}

test('Échap ferme le panneau info (cas nominal)', async ({ page }) => {
  await enterGame(page);
  await page.evaluate(() => openInfo('Test', '<p>corps</p>'));
  await expect(page.locator('#infoOverlay')).toHaveClass(/open/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#infoOverlay')).not.toHaveClass(/open/);
});

test('le verrou de session NE se ferme PAS avec Échap', async ({ page }) => {
  // Le cas le plus important du fichier. Fermer ce verrou laisserait jouer une session évincée.
  await page.evaluate(() => showSessionLockOverlay());
  await expect(page.locator('#sessionLockOverlay')).not.toHaveClass(/hidden/);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape'); // insister ne doit rien changer non plus
  await expect(page.locator('#sessionLockOverlay')).not.toHaveClass(/hidden/);
});

test('l\'écran d\'auth NE se ferme PAS avec Échap sans compte connecté', async ({ page }) => {
  // Sans session, fermer l'auth laissait le joueur devant un jeu qu'il ne peut pas utiliser.
  // showAuthOverlay() masque #closeAuth quand il n'y a pas de currentUser : Échap suit cette règle
  // au lieu de la dupliquer.
  await page.evaluate(() => { currentUser = null; showAuthOverlay(true); });
  await expect(page.locator('#authOverlay')).not.toHaveClass(/hidden/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#authOverlay')).not.toHaveClass(/hidden/);
});

test('l\'écran d\'auth SE ferme avec Échap quand un compte est connecté', async ({ page }) => {
  // Le pendant du test précédent : la règle doit fonctionner dans les DEUX sens, sinon on aurait
  // juste interdit Échap sur l'auth et prétendu que c'était une politique.
  await page.evaluate(() => { currentUser = { id: 'x', email: 'a@b.c' }; showAuthOverlay(true); });
  await expect(page.locator('#closeAuth')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#authOverlay')).toHaveClass(/hidden/);
});

test('Échap ferme la modale du DESSUS, pas celle du dessous', async ({ page }) => {
  await enterGame(page);
  await page.evaluate(() => {
    openInfo('Fond', '<p>corps</p>');                        // z-index 95
    $a('patchImgOverlay').classList.add('open');             // z-index 105, au-dessus
  });
  await page.keyboard.press('Escape');
  await expect(page.locator('#patchImgOverlay')).not.toHaveClass(/open/); // la plus haute part
  await expect(page.locator('#infoOverlay')).toHaveClass(/open/);         // celle du dessous reste
  await page.keyboard.press('Escape');
  await expect(page.locator('#infoOverlay')).not.toHaveClass(/open/);     // puis elle
});

test('le focus revient sur l\'élément qui a ouvert la modale', async ({ page }) => {
  await enterGame(page);
  const restored = await page.evaluate(async () => {
    const opener = document.getElementById('btnCodex');
    opener.focus();
    openInfo('Test', '<p><button id="dedans">x</button></p>');
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const wentInside = document.getElementById('infoOverlay').contains(document.activeElement);
    closeInfoOverlay();
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return { wentInside, back: document.activeElement && document.activeElement.id };
  });
  expect(restored.wentInside).toBe(true);   // à l'ouverture, le focus ENTRE dans la modale
  expect(restored.back).toBe('btnCodex');   // à la fermeture, il REVIENT d'où il venait
});

test('Tab ne sort pas de la modale ouverte', async ({ page }) => {
  await enterGame(page);
  await page.evaluate(() => openInfo('Test',
    '<p><button id="a1">a</button><button id="a2">b</button><button id="a3">c</button></p>'));
  await page.waitForTimeout(50);
  // On tabule plus de fois qu'il n'y a d'éléments : sans piège, le focus serait parti dans la page
  // derrière (le HUD, la liste des zones...) au bout de quelques Tab.
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() =>
      document.getElementById('infoOverlay').contains(document.activeElement));
    expect(inside, `le focus est sorti de la modale au Tab n°${i + 1}`).toBe(true);
  }
});

test('les overlays sont annoncés comme des dialogues (ARIA)', async ({ page }) => {
  const aria = await page.evaluate(() => ['infoOverlay', 'authOverlay', 'sessionLockOverlay']
    .map(id => {
      const el = document.getElementById(id);
      return { id, role: el && el.getAttribute('role'), modal: el && el.getAttribute('aria-modal') };
    }));
  for (const a of aria) {
    expect(a.role, a.id).toBe('dialog');
    expect(a.modal, a.id).toBe('true');
  }
});
