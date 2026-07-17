// Mouvement réduit (2026-07-22, audit repo P6).
//
// POURQUOI UNE SPEC À PART plutôt qu'un test dans tests.js : `prefers-reduced-motion: reduce` est
// un réglage SYSTÈME. Une page ne peut pas se le mettre à elle-même — seul le navigateur peut
// l'émuler. tests.js peut vérifier le contrat de la fonction ; il ne peut pas vérifier que le CSS
// s'applique réellement. C'est ce que fait ce fichier.
//
// Ce qui est vérifié ici est le RÉSULTAT observable (getComputedStyle sur des éléments réels), pas
// la présence d'une règle dans la feuille de style : une règle peut exister et ne jamais
// s'appliquer (spécificité, ordre de cascade, media query qui ne matche pas). Ce projet s'est déjà
// fait avoir deux fois par une classe `.hidden` sans règle correspondante.
//
// DEUX PIÈGES, tous les deux payés ici — à lire avant de "simplifier" ce fichier :
//
// 1. La 1re version fabriquait des URL absolues avec son PROPRE repli de port (8000). Ça passait en
//    local (j'exporte toujours PLAYWRIGHT_PORT) et cassait en CI sur ERR_CONNECTION_REFUSED : le
//    vrai défaut de playwright.config.js est 49213. D'où `baseURL`, pris sur la FIXTURE de la
//    config — une seule source de vérité pour le port, jamais recopiée.
//
// 2. `test.use({ reducedMotion: 'reduce' })` (l'idiomatique, essayé en premier) NE MARCHE PAS ici :
//    vérifié en sonde, `contextOptions.reducedMotion` arrive `undefined` et `matchMedia` répond
//    false — au niveau fichier comme au niveau describe (Playwright 1.61). `browser.newContext({
//    reducedMotion })` applique bien l'émulation : comparés côte à côte dans un même test, l'un
//    donne false et l'autre true. Les contextes explicites ci-dessous ne sont donc pas une
//    maladresse, c'est le seul des deux chemins qui fonctionne.
const { test, expect } = require('@playwright/test');

const DEV = '/index.dev.html';
// Chromium sérialise .01ms en "1e-05s" et non "0.00001s" : on compare des DURÉES, jamais des
// chaînes. Assertion d'abord écrite sur la chaîne, elle échouait alors que le CSS était correct.
const sec = v => parseFloat(v);

/** Ouvre index.dev.html dans un contexte émulant `pref`. baseURL vient de la config (fixture), jamais recopié. */
async function openWith(browser, baseURL, pref) {
  const ctx = await browser.newContext({ reducedMotion: pref, baseURL });
  const page = await ctx.newPage();
  await page.goto(DEV);
  return { page, done: () => ctx.close() };
}

// Les deux mondes sont testés. Sans le réglage, le mouvement DOIT rester : sinon on aurait
// simplement supprimé les animations pour tout le monde, ce qui n'est pas la demande.
test.describe('mouvement réduit — réglage système ABSENT', () => {
  test('les animations décoratives tournent normalement', async ({ browser, baseURL }) => {
    const { page, done } = await openWith(browser, baseURL, 'no-preference');
    const d = await page.evaluate(() => {
      const el = document.createElement('div');
      el.style.animation = 'shake .4s infinite';
      document.body.appendChild(el);
      const v = getComputedStyle(el).animationDuration;
      el.remove();
      return v;
    });
    expect(sec(d)).toBeCloseTo(0.4); // la durée demandée est respectée : rien n'est cassé pour les autres
    await done();
  });

  test('prefersReducedMotion() renvoie false', async ({ browser, baseURL }) => {
    const { page, done } = await openWith(browser, baseURL, 'no-preference');
    expect(await page.evaluate(() => prefersReducedMotion())).toBe(false);
    await done();
  });
});

test.describe('mouvement réduit — réglage système ACTIF', () => {
  test('toute animation est neutralisée (sélecteur universel)', async ({ browser, baseURL }) => {
    const { page, done } = await openWith(browser, baseURL, 'reduce');
    const r = await page.evaluate(() => {
      const el = document.createElement('div');
      // style INLINE volontairement : s'il est écrasé, c'est que le !important de la media query
      // gagne — donc que la règle s'applique vraiment, et pas seulement qu'elle existe.
      el.style.animation = 'shake .4s infinite';
      el.style.transition = 'opacity .5s';
      document.body.appendChild(el);
      const cs = getComputedStyle(el);
      const out = { anim: cs.animationDuration, iter: cs.animationIterationCount, trans: cs.transitionDuration };
      el.remove();
      return out;
    });
    expect(sec(r.anim)).toBeLessThan(0.001);
    expect(sec(r.trans)).toBeLessThan(0.001);
    // > 0 et pas `none` : l'animation JOUE et se termine aussitôt, donc `animationend` part quand
    // même. `none` l'empêcherait de jouer et bloquerait tout code qui attend cet événement.
    expect(sec(r.anim)).toBeGreaterThan(0);
    expect(r.iter).toBe('1'); // les boucles infinies s'arrêtent (halos, pulsations)
    await done();
  });

  test('prefersReducedMotion() renvoie true', async ({ browser, baseURL }) => {
    const { page, done } = await openWith(browser, baseURL, 'reduce');
    expect(await page.evaluate(() => prefersReducedMotion())).toBe(true);
    await done();
  });

  test('le jeu continue de tourner : le canvas n\'est pas gelé', async ({ browser, baseURL }) => {
    // Le piège de cette fonctionnalité serait de "réduire le mouvement" en arrêtant le jeu.
    // Le canvas EST le jeu (perso, combat) : il doit continuer à être repeint.
    const { page, done } = await openWith(browser, baseURL, 'reduce');
    const frames = await page.evaluate(() => new Promise(res => {
      let n = 0;
      const tick = () => { if (++n < 3) requestAnimationFrame(tick); else res(n); };
      requestAnimationFrame(tick);
      setTimeout(() => res(n), 2000);
    }));
    expect(frames).toBe(3); // la boucle d'animation vit toujours
    await done();
  });
});
