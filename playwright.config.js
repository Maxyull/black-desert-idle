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
    // scripts/test_server.py et pas `python3 -m http.server` (2026-08-03) : ce dernier repond en
    // HTTP/1.0, donc ferme la connexion apres CHAQUE reponse. A ~130 scripts par test (page + iframe
    // compagnon), un run complet ouvrait ~8000 connexions TCP en une minute et saturait la plage de
    // ports ephemeres de Windows (16384, TIME_WAIT 2 min) : Chromium abandonnait alors une requete au
    // hasard en net::ERR_NO_BUFFER_SPACE / net::ERR_ADDRESS_IN_USE, un <script> manquait, et ca
    // ressortait plus tard en `ReferenceError: $a is not defined` dans un test sans rapport. C'etait
    // la "seconde cause inconnue" cherchee depuis le 2026-07-20 (voir signInForTest dans
    // companions.spec.js). Le remplacant parle HTTP/1.1 (keep-alive) et est threade -- tout le
    // raisonnement et la mesure sont dans l'en-tete de scripts/test_server.py.
    command: `python3 scripts/test_server.py ${port}`,
    url: `${baseURL}/index.dev.html`,
    // PIÈGE quand on enchaîne les suites en local (2026-07-20, après une fausse piste qui a coûté
    // du temps) : `reuseExistingServer` est vrai hors CI, donc un run peut s'attacher au serveur
    // que le run PRÉCÉDENT est en train d'éteindre. Des <script> de index.dev.html partent alors
    // en net::ERR_CONNECTION_REFUSED -- sans aucune erreur visible : le script manquant ne casse
    // rien tout de suite, ses globales restent juste indéfinies, et ça ressort BEAUCOUP plus tard
    // en `ReferenceError: ZONES is not defined` (ou fmtXpPct) au fond de refreshStatsOnly, dans un
    // test compagnon qui n'a rien à voir. On croit tenir un bug de l'appli, c'est le serveur.
    //
    // Ce n'est PAS le backlog TCP de http.server (request_queue_size = 5) : mesuré, rafales de 60
    // connexions simultanées x6, 0/360 refus à 5 comme à 128. Inutile d'aller le gonfler.
    //
    // À NE PAS CONFONDRE avec la saturation de ports éphémères corrigée le 2026-08-03 (voir le
    // commentaire sur `command` ci-dessus) : symptômes proches — un <script> manquant qui ressort
    // en ReferenceError lointain — mais causes distinctes. Ici ERR_CONNECTION_REFUSED (serveur en
    // train de s'éteindre), là ERR_NO_BUFFER_SPACE/ERR_ADDRESS_IN_USE (plus de socket côté client).
    //
    // Pour reproduire fidèlement la CI en local : `CI=1 npx playwright test` (un serveur dédié par
    // run, jamais réutilisé). Vérifié : 3 runs enchaînés, 77/77, zéro refus -- alors que les mêmes
    // runs sans CI=1 en produisaient. À utiliser dès qu'on soupçonne un test instable.
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe'
  }
});
