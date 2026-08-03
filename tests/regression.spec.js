const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

// PROD_HOSTNAME (src/backend/client-health.js) décide si reportClientError() a le droit d'écrire
// dans public.client_errors — liste blanche stricte, ajoutée le 2026-08-03 pour que le poste de dev
// arrête de polluer la table de prod. Le jour où le domaine du jeu change, on éditera le CNAME (le
// site casserait sinon, c'est immédiatement visible) mais rien n'obligerait à éditer la constante :
// le monitoring d'erreurs s'éteindrait alors EN SILENCE, ce qui est exactement le contraire du but.
// Ce test compare les deux et doit rester côté Node : le CNAME n'est pas servi par la page.
test('PROD_HOSTNAME reste synchronisé avec le fichier CNAME', () => {
  const root = path.join(__dirname, '..');
  const cname = fs.readFileSync(path.join(root, 'CNAME'), 'utf8').trim();
  const src = fs.readFileSync(path.join(root, 'src', 'backend', 'client-health.js'), 'utf8');
  const match = src.match(/const PROD_HOSTNAME = '([^']+)'/);

  expect(match, 'PROD_HOSTNAME introuvable dans src/backend/client-health.js').not.toBeNull();
  expect(match[1], `CNAME=${cname} — mettre à jour PROD_HOSTNAME, sinon reportClientError() se tait en prod`).toBe(cname);
});

// Les 2 seules vraies erreurs joueur jamais enregistrées en prod venaient d'un `e.target.closest()`
// écrit en direct dans un listener posé sur `document` (2026-08-02, initLootIconZoom) : `e.target`
// n'est pas toujours un Element, et le handler entier tombait. `closestFrom()` (game-core.js) est
// désormais la seule forme autorisée. Ce test refuse toute réintroduction du motif N'IMPORTE OÙ
// dans src/, y compris dans un fichier qui n'existe pas encore — c'est le seul angle qui tienne :
// les listeners sont anonymes, donc inatteignables depuis les tests navigateur.
test('aucun e.target.closest() direct dans src/ (utiliser closestFrom)', () => {
  const root = path.join(__dirname, '..');
  const fautifs = [];

  const parcourir = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      // vendor/ = code tiers (three.js), jamais réécrit à la main ici
      if (e.isDirectory()) { if (e.name !== 'vendor') parcourir(p); continue; }
      if (!e.name.endsWith('.js')) continue;
      fs.readFileSync(p, 'utf8').split('\n').forEach((ligne, i) => {
        if (ligne.trimStart().startsWith('//')) return; // les commentaires citent le motif exprès
        if (/\.target\s*\.closest\s*\(/.test(ligne)) {
          fautifs.push(`${path.relative(root, p)}:${i + 1} -> ${ligne.trim()}`);
        }
      });
    }
  };
  parcourir(path.join(root, 'src'));

  expect(fautifs, `Remplacer par closestFrom(e.target, '<sel>') :\n${fautifs.join('\n')}`).toEqual([]);
});

test('runRegressionTests passes in the dev page', async ({ page }) => {
  const pageErrors = [];

  page.on('pageerror', error => {
    pageErrors.push(error.message);
  });

  await page.goto('/index.dev.html', { waitUntil: 'load' });

  await expect
    .poll(
      () => page.evaluate(() => typeof window.runRegressionTests),
      { timeout: 10_000, message: 'window.runRegressionTests should be loaded by tests/tests.js' }
    )
    .toBe('function');

  const result = await page.evaluate(() => window.runRegressionTests());
  const failures = Array.isArray(result.failed) ? result.failed : [];
  const details = failures.map(failure => `${failure.name}: ${failure.detail}`).join('\n');

  expect(failures, details).toEqual([]);
  expect(result.passed).toBe(result.total);
  expect(pageErrors).toEqual([]);
});
