// Mouvement réduit (2026-07-22, audit repo P6).
//
// POURQUOI UNE SPEC À PART plutôt qu'un test dans tests.js : `prefers-reduced-motion: reduce` est
// un réglage SYSTÈME. Une page ne peut pas se le mettre à elle-même — seul le navigateur peut
// l'émuler (`reducedMotion` de Playwright). tests.js peut vérifier le contrat de la fonction ; il
// ne peut pas vérifier que le CSS s'applique réellement. C'est ce que fait ce fichier.
//
// Ce qui est vérifié ici est le RÉSULTAT observable (getComputedStyle sur des éléments réels),
// pas la présence d'une règle dans la feuille de style : une règle peut exister et ne jamais
// s'appliquer (spécificité, ordre de cascade, media query qui ne matche pas). Ce projet s'est
// déjà fait avoir deux fois par une classe `.hidden` sans règle correspondante.
const { test, expect } = require('@playwright/test');

const PORT = process.env.PLAYWRIGHT_PORT || 8000;
const DEV = `http://localhost:${PORT}/index.dev.html`;

// Les deux mondes sont testés : sans le réglage, le mouvement DOIT rester (sinon on aurait
// simplement supprimé les animations pour tout le monde, ce qui n'est pas la demande).
test.describe('mouvement réduit', () => {
  test('sans le réglage système, les animations décoratives tournent normalement', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    await page.goto(DEV);
    const d = await page.evaluate(() => {
      const el = document.createElement('div');
      el.style.animation = 'shake .4s infinite';
      document.body.appendChild(el);
      const v = getComputedStyle(el).animationDuration;
      el.remove();
      return v;
    });
    expect(d).toBe('0.4s'); // la durée demandée est respectée : rien n'est cassé pour les autres
    await ctx.close();
  });

  test('avec le réglage système, toute animation est neutralisée (sélecteur universel)', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(DEV);
    const r = await page.evaluate(() => {
      const el = document.createElement('div');
      el.style.animation = 'shake .4s infinite';
      el.style.transition = 'opacity .5s';
      document.body.appendChild(el);
      const cs = getComputedStyle(el);
      const out = { anim: cs.animationDuration, iter: cs.animationIterationCount, trans: cs.transitionDuration };
      el.remove();
      return out;
    });
    // On compare des DURÉES, pas des chaînes : Chromium sérialise .01ms en "1e-05s" et pas
    // "0.00001s" — assertion d'abord écrite sur la chaîne, elle échouait alors que le CSS était
    // parfaitement correct. Le seuil dit ce qui compte vraiment (imperceptible), pas comment le
    // moteur formate son nombre.
    const sec = v => parseFloat(v); // "1e-05s" -> 0.00001
    expect(sec(r.anim)).toBeLessThan(0.001);
    expect(sec(r.trans)).toBeLessThan(0.001);
    // > 0 et pas `none` : l'animation JOUE et se termine aussitôt, donc `animationend` part quand
    // même. `none` l'empêcherait de jouer et bloquerait tout code qui attend cet événement.
    expect(sec(r.anim)).toBeGreaterThan(0);
    expect(r.iter).toBe('1');        // les boucles infinies s'arrêtent (halos, pulsations)
    await ctx.close();
  });

  test('prefersReducedMotion() suit réellement le réglage du navigateur, dans les deux sens', async ({ browser }) => {
    for (const [pref, expected] of [['reduce', true], ['no-preference', false]]) {
      const ctx = await browser.newContext({ reducedMotion: pref });
      const page = await ctx.newPage();
      await page.goto(DEV);
      expect(await page.evaluate(() => prefersReducedMotion()), `reducedMotion=${pref}`).toBe(expected);
      await ctx.close();
    }
  });

  test('le jeu continue de tourner : le canvas n\'est pas gelé par le mouvement réduit', async ({ browser }) => {
    // Le piège de cette fonctionnalité serait de "réduire le mouvement" en arrêtant le jeu.
    // Le canvas EST le jeu (perso, combat) : il doit continuer à être repeint.
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(DEV);
    const frames = await page.evaluate(() => new Promise(res => {
      let n = 0;
      const tick = () => { if (++n < 3) requestAnimationFrame(tick); else res(n); };
      requestAnimationFrame(tick);
      setTimeout(() => res(n), 2000);
    }));
    expect(frames).toBe(3); // la boucle d'animation vit toujours
    await ctx.close();
  });
});
