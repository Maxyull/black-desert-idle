// Enregistre une vidéo promo du jeu (plan B : début de partie + écrans accessibles sans
// progression) en pilotant le bundle PROD local (index.html) avec Playwright.
// - Session locale factice via onAuthed() (même technique que tests/companions.spec.js:59) :
//   AUCUN compte réel, aucune écriture serveur.
// - Captions anglaises injectées dans le DOM (pas de montage nécessaire), sortie .webm dans
//   scripts/video/out/ (convertible en mp4 via le ffmpeg embarqué de Playwright, voir README).
// Usage :
//   node scripts/video/record-promo.js login   -> fenêtre visible, connecte-toi À LA MAIN avec le
//     compte à filmer ; la session est sauvegardée dans auth-state.json (gitignoré, local)
//   node scripts/video/record-promo.js         -> enregistre la vidéo (session sauvegardée si
//     auth-state.json existe, sinon session locale factice sans compte)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(__dirname, 'out');
const AUTH_STATE = path.join(__dirname, 'auth-state.json');
const PORT = 5470;
const W = 1920, H = 1080;
const MODE = process.argv[2] === 'login' ? 'login' : 'record';

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
  // ferme via les fonctions du jeu (fiable), puis Escape en secours
  await page.evaluate(() => {
    try { if (typeof closeCompendiumReact === 'function') closeCompendiumReact(); } catch (e) {}
    try { if (typeof closeInfoOverlay === 'function') closeInfoOverlay(); } catch (e) {}
    try { if (typeof closeWikiPanel === 'function') closeWikiPanel(); } catch (e) {}
  }).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
  await wait(600);
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // serveur statique local sur le bundle prod
  const server = spawn('python', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  await wait(1500);

  if (MODE === 'login') {
    // fenêtre VISIBLE : l'utilisateur se connecte lui-même (le script ne touche jamais au mot de
    // passe), puis la session Supabase (localStorage) est sauvegardée pour le mode record.
    // chrome.exe de Playwright refuse de se lancer en mode visible sur cette machine (spawn
    // UNKNOWN) -- on passe par le navigateur système (Edge, toujours présent sous Windows)
    let browser;
    try { browser = await chromium.launch({ headless: false, channel: 'msedge' }); }
    catch (e) { browser = await chromium.launch({ headless: false, channel: 'chrome' }); }
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
    console.log('Connecte-toi dans la fenêtre (compte à filmer). J\'attends que le jeu soit chargé...');
    await page.waitForSelector('#authOverlay', { state: 'hidden', timeout: 300000 });
    await wait(3000); // laisse la session Supabase se poser dans localStorage
    await context.storageState({ path: AUTH_STATE });
    console.log('Session sauvegardée dans', AUTH_STATE, '- relance sans argument pour enregistrer.');
    await browser.close();
    server.kill();
    return;
  }

  const hasAuth = fs.existsSync(AUTH_STATE);
  console.log(hasAuth ? 'Session sauvegardée trouvée (compte réel).' : 'Pas de auth-state.json : session locale factice.');
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir: OUT_DIR, size: { width: W, height: H } },
    ...(hasAuth ? { storageState: AUTH_STATE } : {}),
  });
  const page = await context.newPage();
  // langue EN avant tout chargement (même clé que i18n-init.js)
  await context.addInitScript(() => {
    try { localStorage.setItem('velia-idle-lang', 'en'); } catch (e) {}
    // pré-marque l'onboarding du module Compagnon comme déjà vu (iframe same-origin, localStorage
    // partagé) pour qu'il s'ouvre direct sur la collection au lieu de la modale de bienvenue.
    try { localStorage.setItem('velia_idle_pets_onboarding_seen_v1', '1'); } catch (e) {}
  });
  // neutralise l'overlay tutoriel (onboarding + tutoriels d'objets) : il recouvre tout l'écran
  // en position:fixed et bloque tous les clics -- indésirable dans une vidéo promo
  await context.addInitScript(() => {
    const style = document.createElement('style');
    style.textContent = '#tutorialOverlay{display:none !important;pointer-events:none !important}';
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
  });

  console.log('Chargement du jeu (bundle prod local)...');
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });

  if (hasAuth) {
    // session réelle restaurée depuis auth-state.json : le jeu se connecte tout seul
    await page.waitForSelector('#authOverlay', { state: 'hidden', timeout: 30000 });
  } else {
    // session locale factice (voir tests/companions.spec.js) — débloque l'UI, zéro écriture serveur
    await page.waitForFunction(() => typeof onAuthed === 'function', null, { timeout: 15000 });
    await page.evaluate(async () => {
      await onAuthed({ id: '00000000-0000-4000-8000-00000000video', email: 'promo-video@local.invalid', is_anonymous: false, identities: [] });
    });
    await page.waitForSelector('#authOverlay', { state: 'hidden', timeout: 15000 });
  }
  await wait(1000);
  await dismissTutorial(page);
  // ferme le modal de reconnexion "Bon retour"/"Welcome back" (rattrapage hors-ligne) s'il s'est
  // ouvert -- il recouvre l'écran et bloque tous les clics. Le ✕ est le 1er bouton du modal React
  // (aria-label "Fermer" en FR / "Close" en EN) : on cible par contenu '✕' pour être indépendant
  // de la langue.
  const reconnectClose = page.locator('#reconnectModalRoot button', { hasText: '✕' }).first();
  if (await reconnectClose.isVisible().catch(() => false)) {
    await reconnectClose.click({ timeout: 3000 }).catch(() => {});
    await wait(800);
  }

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

  // helper : bascule d'activité via la fonction du jeu (fiable, indépendant du DOM/langue)
  const goActivity = async (id) => { await page.evaluate((a) => { if (typeof showActivityPage === 'function') showActivityPage(a); }, id).catch(() => {}); await wait(1800); };

  console.log('Scène 6 : mini-boss');
  await goActivity('miniboss');
  await caption(page, 'Mini-bosses: summon them with scrolls & relics, fought in groups of 5', 9000);

  console.log('Scène 7 : world boss');
  await goActivity('boss');
  await caption(page, 'Team up against world bosses on a shared server timer', 9000);

  console.log('Scène 8 : companions');
  await goActivity('pet');
  await wait(2500); // l'iframe du module se charge au 1er affichage
  await caption(page, 'Hatch, collect and fuse 3D companions', 9000);

  console.log('Scène 9 : retour zone + marché');
  // ferme explicitement l'overlay iframe Compagnon (z-index 950) : showActivityPage('zone') ne le
  // masque pas et il recouvrirait sinon la topbar (clics marché/classement bloqués).
  await page.evaluate(() => {
    if (typeof closeCompanionsModule === 'function') closeCompanionsModule();
    const o = document.getElementById('companionsOverlay'); if (o) o.style.display = 'none';
  }).catch(() => {});
  await goActivity('zone');
  if (await safeClick(page, '#btnMarketTopbar')) {
    await wait(2000);
    await caption(page, 'A real player-driven marketplace — buy and sell with other players', 9000);
    await page.evaluate(() => { const m = document.getElementById('marketOverlay'); if (m) m.classList.remove('open'); }).catch(() => {});
    await wait(600);
  }

  console.log('Scène 10 : farm hors-ligne');
  await page.evaluate(() => {
    if (typeof openReconnectModal !== 'function') return;
    openReconnectModal({
      pseudo: (typeof myPseudo !== 'undefined' && myPseudo) || 'Player', streak: 3, streakGoal: 7, awayLabel: '8h 12min',
      silver: 486000, xp: 71200, levelBefore: 23, percentBefore: 41, levelNow: 24, percentNow: 6,
      items: [
        { name: (typeof tr === 'function' ? tr('Bourse de pirate') : 'Pirate Purse'), qty: 214, color:'#c8a96e', val: 9, kind:'trash' },
        { name: (typeof tr === 'function' ? tr('Pierre de Caphras') : 'Caphras Stone'), qty: 12, color:'#6ea3c9', val: 0, kind:'material' },
        { name: (typeof tr === 'function' ? tr('Anneau Tuvala') : 'Tuvala Ring'), qty: 1, color:'#e0935a', val: 0, kind:'jackpot' },
      ],
      bestDropName: (typeof tr === 'function' ? tr('Anneau Tuvala') : 'Tuvala Ring'), bestDropColor:'#e0935a', personalRecordSilver: 486000,
    });
  }).catch(() => {});
  await wait(2000);
  await caption(page, 'Keep farming while offline — collect it all when you come back', 9000);
  // ferme le modal (✕, indépendant de la langue)
  const offClose = page.locator('#reconnectModalRoot button', { hasText: '✕' }).first();
  if (await offClose.isVisible().catch(() => false)) { await offClose.click({ timeout: 3000 }).catch(() => {}); await wait(600); }

  console.log('Scène 11 : classement');
  if (await safeClick(page, '#btnLeaderboardTopbar')) { await wait(1800); await caption(page, 'Climb the lifetime leaderboards against other players', 8000); await closeOverlays(page); }

  console.log('Scène 12 : outro');
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
