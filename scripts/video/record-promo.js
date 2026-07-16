// Enregistre une vidéo promo du jeu (plan B : début de partie + écrans accessibles sans
// progression) en pilotant le bundle PROD local (index.html) avec Playwright.
// - Session locale factice via onAuthed() (même technique que tests/companions.spec.js:59) :
//   AUCUN compte réel, aucune écriture serveur.
// - Captions anglaises injectées dans le DOM (pas de montage nécessaire), sortie .webm dans
//   scripts/video/out/ (convertible en mp4 via le ffmpeg embarqué de Playwright, voir README).
// Usage : node scripts/video/record-promo.js
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(__dirname, 'out');
const PORT = 5470;
const W = 1920, H = 1080;

const wait = ms => new Promise(r => setTimeout(r, ms));

// bannière de caption en bas d'écran, style doré du jeu, fondu entrée/sortie
async function caption(page, text, ms) {
  await page.evaluate(({ text, ms }) => {
    const prev = document.getElementById('promoCaption');
    if (prev) prev.remove();
    const d = document.createElement('div');
    d.id = 'promoCaption';
    d.textContent = text;
    d.style.cssText = [
      'position:fixed', 'left:50%', 'bottom:64px', 'transform:translateX(-50%)',
      'max-width:72%', 'padding:18px 36px', 'border-radius:12px',
      'background:rgba(11,15,26,.88)', 'border:1px solid #d4a955',
      'color:#f0e6d2', 'font-family:Georgia,serif', 'font-size:34px',
      'font-weight:bold', 'text-align:center', 'letter-spacing:.5px',
      'z-index:99999', 'box-shadow:0 6px 30px rgba(0,0,0,.6)',
      'opacity:0', 'transition:opacity .6s ease',
    ].join(';');
    document.body.appendChild(d);
    requestAnimationFrame(() => { d.style.opacity = '1'; });
    setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 700); }, ms - 700);
  }, { text, ms });
  await wait(ms);
}

async function dismissTutorial(page) {
  const skipBtn = page.locator('#tutSkipBtn');
  for (let i = 0; i < 5; i++) {
    if (await skipBtn.isVisible().catch(() => false)) {
      await skipBtn.click({ timeout: 1500 }).catch(() => {});
      await wait(400);
    } else break;
  }
}

async function safeClick(page, selector) {
  await dismissTutorial(page);
  try { await page.locator(selector).first().click({ timeout: 4000 }); return true; }
  catch (e) { console.log(`  (clic raté sur ${selector} : ${e.message.split('\n')[0]})`); return false; }
}

async function closeOverlays(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await wait(300);
  // ✕ génériques encore visibles (infoBox & co)
  for (const sel of ['#infoBox .closeX', '#infoOverlay .closeX', 'button:has-text("✕")']) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible().catch(() => false)) await btn.click({ timeout: 1000 }).catch(() => {});
  }
  await wait(300);
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // serveur statique local sur le bundle prod
  const server = spawn('python', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  await wait(1500);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir: OUT_DIR, size: { width: W, height: H } },
  });
  const page = await context.newPage();
  // langue EN avant tout chargement (même clé que i18n-init.js)
  await context.addInitScript(() => { try { localStorage.setItem('velia-idle-lang', 'en'); } catch (e) {} });

  console.log('Chargement du jeu (bundle prod local)...');
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });

  // session locale factice (voir tests/companions.spec.js) — débloque l'UI, zéro écriture serveur
  await page.waitForFunction(() => typeof onAuthed === 'function', null, { timeout: 15000 });
  await page.evaluate(async () => {
    await onAuthed({ id: '00000000-0000-4000-8000-00000000video', email: 'promo-video@local.invalid', is_anonymous: false, identities: [] });
  });
  await page.waitForSelector('#authOverlay', { state: 'hidden', timeout: 15000 });
  await wait(1000);
  await dismissTutorial(page);

  console.log('Scène 1 : titre');
  await caption(page, 'BLACK DESERT IDLE — a free browser idle RPG', 6000);

  console.log('Scène 2 : combat idle');
  await caption(page, 'Your hero fights, loots and levels up — all on their own', 10000);

  console.log('Scène 3 : loot / dashboard');
  await page.mouse.wheel(0, 500); await wait(800);
  await caption(page, 'Layered loot: trash, materials, gear and rare treasures', 8000);
  await page.mouse.wheel(0, -500); await wait(500);

  console.log('Scène 4 : enchantement');
  const optBtn = page.locator('#btnOpt');
  if (await optBtn.count()) { await optBtn.scrollIntoViewIfNeeded().catch(() => {}); await wait(800); }
  await caption(page, 'Enhance your gear from +1 all the way to PEN — pity system included', 9000);
  await page.mouse.wheel(0, -1000); await wait(500);

  console.log('Scène 5 : zones');
  await caption(page, '11 zones to conquer — 4 more regions on the roadmap', 8000);

  console.log('Scène 6 : compendium');
  if (await safeClick(page, '#btnCompendium')) { await wait(1500); await caption(page, 'Master every item in the Compendium', 8000); await closeOverlays(page); }

  console.log('Scène 7 : wiki');
  if (await safeClick(page, '#btnWiki')) { await wait(1500); await caption(page, 'Built-in wiki — every drop rate is public', 8000); await closeOverlays(page); }

  console.log('Scène 8 : classement');
  if (await safeClick(page, '#btnLeaderboardTopbar')) { await wait(1500); await caption(page, 'Climb the leaderboards against other players', 8000); await closeOverlays(page); }

  console.log('Scène 9 : patch notes');
  if (await safeClick(page, '#btnPatchTopbar')) { await wait(1500); await caption(page, 'In active development — 450+ updates shipped so far', 8000); await closeOverlays(page); }

  console.log('Scène 10 : outro');
  await page.evaluate(() => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;background:rgba(6,8,14,.94);z-index:99998;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;opacity:0;transition:opacity 1s ease';
    d.innerHTML = '<div style="font-family:Georgia,serif;font-size:64px;font-weight:bold;color:#d4a955;letter-spacing:2px">BLACK DESERT IDLE</div>' +
      '<div style="font-family:Georgia,serif;font-size:30px;color:#f0e6d2">maxyull.github.io/black-desert-idle</div>' +
      '<div style="font-family:Georgia,serif;font-size:24px;color:#9aa4b5">Free · Unofficial fan project · Feedback welcome</div>';
    document.body.appendChild(d);
    requestAnimationFrame(() => { d.style.opacity = '1'; });
  });
  await wait(8000);

  console.log('Finalisation vidéo...');
  await context.close();
  const video = await page.video();
  await browser.close();
  server.kill();
  console.log('OK — vidéo webm dans', OUT_DIR);
})().catch(e => { console.error(e); process.exit(1); });
