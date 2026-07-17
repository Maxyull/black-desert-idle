const { defineConfig } = require('@playwright/test');

const port = process.env.PLAYWRIGHT_PORT || '49213';
const baseURL = `http://127.0.0.1:${port}`;

module.exports = defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.js/,
  timeout: 60_000,
  // 2 et pas plus (2026-07-22, audit repo P7). `workers: 1` datait de l'import initial de la PR #5
  // et n'avait aucune justification écrite -- ce n'était pas une contrainte, juste un défaut jamais
  // remis en cause. Mesuré sur la suite complète, 3 runs par configuration :
  //
  //   workers:1 (avant)                    141 s
  //   workers:4 seul                       132 s   <- quasi rien : companions.spec.js est UN fichier,
  //                                                   donc UN worker, et il pèse 86 % du temps
  //   mode:'parallel' + workers:2           82 s   <- retenu (3 runs verts : 80/83/83 s)
  //   mode:'parallel' + workers:4           91 s   <- PLUS LENT, et 1 échec
  //
  // Plus de workers est PIRE, ce qui n'est pas intuitif : chaque test charge le jeu complet, qui
  // tourne en requestAnimationFrame sur un canvas. Au-delà de 2 navigateurs, ils se disputent le
  // CPU, tout ralentit, et les tests sensibles au temps se mettent à échouer. La CI (ubuntu-latest,
  // 4 vCPU) est encore plus serrée que cette machine (16 cœurs) : ne pas monter ce chiffre sans
  // refaire la mesure, et surtout pas "parce qu'il y a des cœurs disponibles".
  //
  // Le gain vient d'ABORD de `test.describe.configure({ mode: 'parallel' })` dans
  // companions.spec.js : Playwright répartit les FICHIERS entre workers, pas les tests d'un même
  // fichier. Sans ce mode, augmenter workers ici ne sert presque à rien.
  workers: 2,
  expect: {
    timeout: 5_000
  },
  use: {
    baseURL,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: `python3 -m http.server ${port}`,
    url: `${baseURL}/index.dev.html`,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe'
  }
});
