// Dashboard admin — dégradation quand Supabase ne répond pas (2026-08-03, CLAUDE.md §11).
//
// Pourquoi un spec Playwright et pas un test dans tests/tests.js : le runner interne
// (window.runRegressionTests) est SYNCHRONE, or AdmDashboard.load() est asynchrone. tests/tests.js
// couvre donc les trois composants isolément (props -> DOM) plus des garde-fous statiques sur
// load() ; ce fichier-ci ferme la boucle en montant le VRAI composant racine avec un `sb` mocké et
// en attendant la fin du chargement — c'est le seul endroit où le câblage
// (load -> state.healthDown -> prop unreachable) est vérifié de bout en bout.
//
// Historique : sb.rpc(...).catch levait un TypeError synchrone (PR #93, 104 erreurs en prod) ;
// une fois ça corrigé, admin_health et admin_dashboard_kpis restaient sans aucune protection —
// un simple rejet réseau suffisait à ne jamais appeler setState, donc à figer le panneau sur son
// squelette POUR TOUJOURS, sans message et sans bouton Rafraîchir (rendu seulement après coup).
// Isolation des backends de production : voir tests/_hors-prod.js.
const { test, expect } = require('./_hors-prod');

// mocks fidèles au vrai PostgrestBuilder : un thenable, .then() seulement, jamais .catch()
// __rpcCalls compte les appels réellement passés au mock. Sans ce compteur, un mock jamais
// atteint (mauvaise portée, garde en amont) laisse le test vert sans rien avoir prouvé — c'est
// exactement ce qui est arrivé ici avant de découvrir le piège `let sb` décrit plus bas.
const MOCKS = `
  window.__rpcCalls = 0;
  window.__mkOk = data => { window.__rpcCalls++; return { then: (ok) => { ok({ data, error: null }); } }; };
  window.__mkFail = () => { window.__rpcCalls++; return { then: (ok, ko) => { ko(new Error('network down')); } }; };
`;

/** Monte AdmDashboard dans un noeud détaché avec un sb donné, attend la fin du chargement.
 *
 *  ⚠️ `sb = ...` en affectation NUE, surtout pas `window.sb = ...` : `sb` est déclaré
 *  `let sb = null` (backend/game-supabase.js:49), donc il vit dans la portée lexicale globale et
 *  n'est PAS une propriété de window — écrire window.sb crée un homonyme que le dashboard ne lit
 *  jamais. Piège rencontré en écrivant ce test : les deux scénarios hors ligne passaient au vert
 *  pour une mauvaise raison (le vrai `sb` valant null dans la page de test, c'est la branche `!sb`
 *  qui répondait, et le mock n'a jamais servi). Une affectation nue, elle, remonte la chaîne de
 *  portées et atteint bien le `let` global. */
async function mountDashboard(page, sbFactory) {
  return page.evaluate(async factorySrc => {
    const origSb = sb;
    sb = eval(factorySrc);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = ReactDOM.createRoot(host);
    try {
      root.render(React.createElement(AdmDashboard));
      // Attendre que le chargement soit VRAIMENT terminé : host est vide tant que React n'a pas
      // commité, donc tester `.admDashSkeleton` d'entrée sortait de la boucle au 1er tour (avant
      // même le squelette) et on lisait un DOM encore vide -- piège rencontré en écrivant ce test.
      const settled = () => host.children.length > 0 && !host.querySelector('.admDashSkeleton');
      for (let i = 0; i < 80 && !settled(); i++) await new Promise(r => setTimeout(r, 25));
      return { html: host.innerHTML, text: host.innerText, settled: settled(), rpcCalls: window.__rpcCalls || 0 };
    } finally {
      root.unmount(); host.remove(); sb = origSb;
    }
  }, sbFactory);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/index.dev.html', { waitUntil: 'load' });
  await expect.poll(() => page.evaluate(() => typeof window.AdmDashboard), { timeout: 10_000 })
    .toBe('function');
  await page.evaluate(MOCKS);
});

test('EN LIGNE : le dashboard affiche les vraies mesures', async ({ page }) => {
  const { html, text, rpcCalls } = await mountDashboard(page, `({
    rpc: (fn) => {
      if (fn === 'admin_health') return window.__mkOk([{ key:'db_size', status:'ok', checked_at:'2026-08-03T00:00:00Z' }]);
      if (fn === 'admin_dashboard_kpis') return window.__mkOk([{ metric:'client_errors', current_value:7, previous_value:3 }]);
      return window.__mkOk([]);
    }
  })`);
  expect(rpcCalls, 'les 4 RPC doivent passer par le mock').toBe(4);
  expect(html).not.toContain('admDashSkeleton');
  expect(html).toContain('tone-good');
  expect(text).toContain('7');                       // le KPI mesuré
  expect(text).not.toContain('—');                   // pas de tiret "indisponible" quand tout va bien
});

test('HORS LIGNE : aucune RPC ne répond, le dashboard ne reste pas bloqué et n\'invente rien', async ({ page }) => {
  const { html, text, rpcCalls } = await mountDashboard(page, `({ rpc: () => window.__mkFail() })`);

  // (0) le mock a bien été sollicité — sinon tout ce qui suit ne prouverait rien (voir MOCKS)
  expect(rpcCalls, 'les 4 RPC doivent passer par le mock').toBe(4);

  // (1) l'invariant central : plus jamais de squelette éternel
  expect(html, 'le dashboard doit sortir de l\'état de chargement').not.toContain('admDashSkeleton');

  // (2) et surtout : il ne doit RIEN affirmer qu'il n'a pas pu vérifier. C'est le vrai danger --
  // un panneau de supervision qui affiche un feu vert non vérifié est pire qu'un panneau cassé.
  const allNormal = await page.evaluate(() => i18next.t('admin:admin.dash.all_normal'));
  const nothingTodo = await page.evaluate(() => i18next.t('admin:admin.dash.nothing_todo'));
  expect(text, 'ne doit pas prétendre "Tout est normal"').not.toContain(allNormal);
  expect(text, 'ne doit pas donner le feu vert "Rien à traiter"').not.toContain(nothingTodo);
  expect(html, 'aucune tonalité verte').not.toContain('tone-good');

  // (3) il doit le dire explicitement, dans les deux quadrants concernés
  const unreachable = await page.evaluate(() => i18next.t('admin:admin.dash.health_unreachable'));
  const unknown = await page.evaluate(() => i18next.t('admin:admin.dash.actions_unknown'));
  expect(text).toContain(unreachable);
  expect(text).toContain(unknown);
  expect(text, 'les KPI affichent un tiret, pas un faux zéro').toContain('—');

  // (4) et rester récupérable : c'est le bouton Rafraîchir qui manquait le plus, puisqu'il n'est
  // rendu qu'une fois le chargement terminé — bloqué en chargement, l'admin n'avait AUCUNE sortie.
  const refresh = await page.evaluate(() => i18next.t('admin:admin.dash.refresh'));
  expect(text, 'le bouton Rafraîchir doit être là pour permettre un nouvel essai').toContain(refresh);
});

test('Supabase absent (sb null) : même sortie propre, pas de squelette éternel', async ({ page }) => {
  // CDN Supabase bloqué / init ratée : l'ancien `if (!sb) return;` laissait lui aussi loading=true
  const { html, text } = await mountDashboard(page, `null`);
  expect(html).not.toContain('admDashSkeleton');
  const allNormal = await page.evaluate(() => i18next.t('admin:admin.dash.all_normal'));
  expect(text).not.toContain(allNormal);
  expect(text).toContain(await page.evaluate(() => i18next.t('admin:admin.dash.health_unreachable')));
});
