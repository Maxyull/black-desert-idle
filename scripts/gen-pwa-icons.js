// Génère les PNG 192/512 du manifest PWA à partir de favicon.svg (audit repo, point "icônes PWA").
//
// Rasterise le VRAI favicon via Chromium (Playwright, déjà une dépendance du projet) plutôt que de
// redessiner la forme à la main : aucun risque que les icônes divergent du favicon si celui-ci
// change. À relancer si favicon.svg est modifié : node scripts/gen-pwa-icons.js
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SVG = fs.readFileSync(path.join(ROOT, 'favicon.svg'), 'utf8');
const SIZES = [192, 512];

(async () => {
  const browser = await chromium.launch();
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    // fond opaque = background_color du manifest : une icône PWA transparente s'affiche mal sur
    // certains lanceurs Android (fond blanc impose, illisible sur un logo sombre).
    await page.setContent(
      `<html><body style="margin:0;background:#0b0f1a">
         <div style="width:${size}px;height:${size}px">${SVG.replace('<svg ', `<svg width="${size}" height="${size}" `)}</div>
       </body></html>`);
    const out = path.join(ROOT, 'assets', `icon-${size}.png`);
    await page.locator('svg').screenshot({ path: out, omitBackground: false });
    await page.close();
    console.log(`${path.relative(ROOT, out)} — ${(fs.statSync(out).size / 1024).toFixed(1)} Ko`);
  }
  await browser.close();
})();
