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
