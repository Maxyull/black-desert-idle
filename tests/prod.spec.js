const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// regression (2026-07-23) : rewrite_prod_html() (scripts/build.py) supprime des LIGNES ENTIERES
// qui matchent <script src="src/...">, y compris quand un commentaire HTML est accole sur la
// meme ligne juste apres </script> -- l'ouverture <!-- part avec la ligne supprimee, laissant sa
// fermeture --> orpheline plus loin dans le fichier, ce qui casse le parsing HTML et affiche du
// texte de commentaire brut en bas de la page en prod. Verifie que index.html n'a plus AUCUN
// commentaire desequilibre (chaque <!-- doit trouver son --> avant le <!-- suivant).
test('index.html has no orphaned/unbalanced HTML comments', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf-8');
  let pos = 0;
  let count = 0;
  while (true) {
    const open = html.indexOf('<!--', pos);
    if (open === -1) break;
    const close = html.indexOf('-->', open);
    expect(close, `commentaire HTML non ferme trouve a l'offset ${open}: ${JSON.stringify(html.slice(open, open + 200))}`).not.toBe(-1);
    pos = close + 3;
    count++;
  }
  expect(count).toBeGreaterThan(0);
});

test('production page loads the minified bundle', async ({ page }) => {
  const pageErrors = [];

  page.on('pageerror', error => {
    pageErrors.push(error.message);
  });

  await page.goto('/index.html', { waitUntil: 'load' });

  await expect(page.locator('script[src^="build/source.min.js"]')).toHaveCount(1);
  await expect
    .poll(
      () => page.evaluate(() => ({
        aiMode: typeof window.aiMode,
        renderAiModeBtn: typeof window.renderAiModeBtn,
        setAiCombatMode: typeof window.setAiCombatMode,
        runRegressionTests: typeof window.runRegressionTests,
      })),
      { timeout: 10_000, message: 'production globals should survive minification' }
    )
    .toEqual({
      aiMode: 'function',
      renderAiModeBtn: 'function',
      setAiCombatMode: 'function',
      runRegressionTests: 'undefined',
    });

  expect(pageErrors).toEqual([]);

  // meme regression que le test statique ci-dessus, mais verifie en plus que rien de tout ca
  // n'est visible pour le joueur (ce qui a ete reellement signale : du texte de commentaire de
  // build brut affiche en bas de la page de jeu).
  const bodyText = await page.evaluate(() => document.body.innerText);
  expect(bodyText).not.toContain('genere par scripts/build.py');
  expect(bodyText).not.toContain('jamais edite a la main');
});
