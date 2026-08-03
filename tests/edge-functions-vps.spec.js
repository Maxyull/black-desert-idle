// Les fonctions edge écrivent-elles là où le jeu LIT ? (2026-08-03)
//
// CE QUE CES TESTS PROTÈGENT
// Depuis la bascule du 2026-08-02, les données du jeu vivent sur le VPS
// (bdi.maxyull.fr) et le cloud Supabase ne garde que l'authentification. Deux
// fonctions edge étaient restées branchées sur la base du cloud :
//
//   * `paypal-webhook` écrivait le don dans le `public.donations` DU CLOUD,
//     alors que la page /donation, le panneau admin et Grafana lisent celui du
//     VPS. Un don encaissé serait resté invisible partout, sans aucune erreur.
//   * `discord-log` comptait sur le limiteur du cloud, donc le quota anti-spam
//     Discord vivait à un endroit et celui de la connexion à un autre.
//
// POURQUOI DES TESTS STATIQUES, ET PAS UN APPEL RÉEL
// Ces fichiers sont du TypeScript Deno déployé chez Supabase : ils ne sont ni
// chargés par index.dev.html, ni exécutables par Node. On ne peut donc pas les
// appeler. Mais le défaut qu'on corrige est justement STRUCTUREL — « cette
// requête part vers le mauvais hôte » — et c'est exactement ce qu'un garde-fou
// sur la source sait attraper. Même famille que
// `testSorcierRenderLoadsBeforeSyncStartupCallers` ou que le test qui tient
// `HOTES_PROD` aligné sur `game-supabase.js` (tests/hors-prod.spec.js).
//
// Le chemin complet (don réel -> table du VPS -> ce que lit le jeu) ne peut PAS
// être vérifié ici : la suite a interdiction de parler aux backends de prod
// (voir tests/_hors-prod.js). Il l'est par un script à lancer à la main, contre
// le vrai endpoint : bdi-infra/migration/verifier-don-bout-en-bout.sh.

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const RACINE = path.join(__dirname, '..');
const FONCTIONS = path.join(RACINE, 'supabase', 'functions');

const lire = (...p) => fs.readFileSync(path.join(RACINE, ...p), 'utf8');
const lireFonction = (nom) => fs.readFileSync(path.join(FONCTIONS, nom, 'index.ts'), 'utf8');

/** Retire commentaires de ligne et de bloc : ces fichiers CITENT abondamment
 *  l'ancien comportement pour l'expliquer, et un test qui lirait les
 *  commentaires verrait des `rest/v1/donations` qui ne sont plus du code. */
function sansCommentaires(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

// ---------------------------------------------------------------- paypal
test.describe('paypal-webhook écrit le don sur le VPS', () => {
  const source = lireFonction('paypal-webhook');
  const code = sansCommentaires(source);

  test('le don part vers la route interne, pas vers le PostgREST du VPS', () => {
    // La clé service_role est un JWT HS256 ; le PostgREST du VPS ne vérifie que
    // de l'ES256 et répond 401 « No suitable key was found to decode the JWT ».
    // C'est l'erreur qui a cassé la connexion par pseudo le 2026-08-02 : viser
    // bdi.maxyull.fr/rest/v1 depuis une fonction edge ne peut PAS marcher.
    expect(code).toContain('AUTH_INTERNE_URL');
    expect(code).toContain('AUTH_INTERNE_SECRET');
    expect(code, "le don doit passer par l'endpoint interne")
      .toMatch(/interne\(\s*["']don["']/);
    expect(code, 'aucune fonction edge ne doit viser le PostgREST du VPS avec service_role')
      .not.toContain('bdi.maxyull.fr/rest/v1');
  });

  test("l'écriture cloud ne subsiste que comme repli AVANT la pose des secrets", () => {
    // Le repli est volontaire (déployer le code avant les secrets), mais il doit
    // être GARDÉ par VERS_VPS. Sans la garde, on réécrirait dans le cloud.
    expect(code).toMatch(/const\s+VERS_VPS\s*=\s*Boolean\(INTERNE_URL\s*&&\s*INTERNE_SECRET\)/);
    const brancheVps = code.indexOf('if (VERS_VPS)');
    const ecritureCloud = code.indexOf('/rest/v1/donations');
    expect(brancheVps, 'la branche VPS doit exister').toBeGreaterThan(-1);
    expect(ecritureCloud, "l'écriture cloud doit subsister comme repli").toBeGreaterThan(-1);
    expect(brancheVps, "le repli cloud doit venir APRÈS la branche VPS, jamais avant")
      .toBeLessThan(ecritureCloud);
  });

  test('aucun repli vers le cloud quand le VPS échoue', () => {
    // LE test qui porte l'argent. Un repli écrirait le don dans la base que
    // plus personne ne lit, tout en répondant 200 à PayPal -- donc en le
    // dissuadant de retenter. Le don serait perdu de vue en silence.
    // On répond 500 : PayPal retente pendant trois jours.
    const brancheVps = code.slice(code.indexOf('if (VERS_VPS)'), code.indexOf('/rest/v1/donations'));
    expect(brancheVps, 'un échec VPS doit répondre 500 pour que PayPal retente')
      .toMatch(/return\s+json\(\{\s*error:\s*["']insert_failed["']\s*\}\s*,\s*500\)/);
    // Chaque sortie de la branche VPS est soit un 500, soit un `ok`. Aucune ne
    // doit tomber en dehors du `if` et poursuivre vers l'écriture cloud.
    const retours = brancheVps.match(/return\s+json\(/g) || [];
    expect(retours.length, 'la branche VPS doit sortir sur tous ses chemins').toBeGreaterThanOrEqual(3);
  });

  test('les montants partent en chaînes, jamais en nombres JSON', () => {
    // 4.62 n'est pas représentable en flottant binaire. La colonne est en
    // numeric(10,2) et porte de l'argent réel : l'écart se paierait en centimes.
    expect(code).toMatch(/montant_usd:\s*String\(/);
    expect(code).toMatch(/montant_origine:\s*String\(/);
    expect(code).toMatch(/taux_usd:\s*String\(/);
  });

  test('un rejeu de PayPal reste un succès, pas une erreur', () => {
    // L'idempotence vit dans l'index unique partiel côté VPS ; la route répond
    // `enregistre: false`. Il faut répondre 200, sinon PayPal retente sans fin.
    expect(code).toMatch(/enregistre\s*===\s*false/);
  });

  test('la clé d\'idempotence reste l\'id de l\'ÉVÉNEMENT', () => {
    // Régression : avec l'id de la CAPTURE, deux événements distincts portant la
    // même capture se dédoublonneraient à tort, et un rejeu du même événement
    // passerait deux fois. C'est `ev.id` qui est rejoué, pas `resource.id`.
    expect(code).toMatch(/external_id:\s*String\(ev\.id\)/);
  });
});

// --------------------------------------------------------------- discord
test.describe('discord-log compte sur le limiteur du VPS', () => {
  const code = sansCommentaires(lireFonction('discord-log'));

  test('le limiteur passe par /limite-debit quand les secrets sont posés', () => {
    // Route qui EXISTE DÉJÀ pour auth-by-identifier : aucune route nouvelle
    // n'était nécessaire, seulement le même transport.
    expect(code).toContain('/limite-debit');
    expect(code).toMatch(/const\s+VERS_VPS\s*=\s*Boolean\(INTERNE_URL\s*&&\s*INTERNE_SECRET\)/);
    expect(code).toMatch(/x-auth-interne/);
  });

  test('le limiteur reste fail-open des deux côtés', () => {
    // Ce limiteur bride le spam, il ne protège rien de sensible. Un VPS
    // injoignable ne doit pas faire taire le log anti-triche.
    const rateOk = code.slice(code.indexOf('async function rateOk'));
    const corps = rateOk.slice(0, rateOk.indexOf('\n}'));
    expect(corps).toMatch(/catch\s*\{\s*return true;?\s*\}/);
    expect(corps, "un statut non-2xx doit autoriser").toMatch(/if\s*\(!r\.ok\)\s*return true/);
  });

  test('le repli cloud reste gardé par VERS_VPS', () => {
    const brancheVps = code.indexOf('if (VERS_VPS)');
    const cloud = code.indexOf('/rest/v1/rpc/rate_limit_hit');
    expect(brancheVps).toBeGreaterThan(-1);
    expect(brancheVps, 'le repli cloud doit venir APRÈS la branche VPS').toBeLessThan(cloud);
  });
});

// ------------------------------------------------------- page /donation
test.describe('la page /donation lit la base du VPS', () => {
  const page = lire('donation', 'index.html');

  test('elle interroge le domaine des données, pas le projet cloud', () => {
    // Sans ça, corriger l'écriture aurait simplement déplacé l'invisibilité :
    // le don serait bien arrivé sur le VPS, et le compteur public serait resté
    // à zéro sur une page qui revendique « Transparence totale ».
    expect(page).toContain("const DATA_API_URL = 'https://bdi.maxyull.fr'");
    const script = page.slice(page.indexOf('donation_public_summary'));
    expect(script, "la page ne doit plus appeler le projet cloud pour les dons")
      .not.toContain('supabase.co');
  });

  test("aucun en-tête Authorization ne part vers le VPS", () => {
    // PostgREST du VPS ne sait vérifier que des JWT ES256, et la clé publiable
    // n'est pas un JWT : tout en-tête Authorization vaudrait un 401. Sans
    // en-tête, PostgREST applique db-anon-role, donc le rôle `anon`.
    // Commentaires retirés : ils PARLENT de l'en-tête pour expliquer pourquoi
    // il est absent, ce qui suffirait à faire échouer un test naïf.
    const script = sansCommentaires(page.slice(page.indexOf('const DATA_API_URL')));
    expect(script).not.toMatch(/Authorization/i);
    expect(script).not.toContain('sb_publishable_');
    expect(script, "l'appel doit être un fetch direct, sans SDK porteur de jeton")
      .toMatch(/fetch\(DATA_API_URL \+ '\/rest\/v1\/rpc\/donation_public_summary'/);
  });

  test('DATA_API_URL reste aligné sur celui du jeu', () => {
    // Constante DUPLIQUÉE : cette page est autonome, hors du bundle. Même
    // dispositif que « PROD_HOSTNAME reste synchronisé avec CNAME ». Le retour
    // arrière se pilote depuis game-supabase.js, et il doit valoir ici aussi --
    // sinon la page continuerait de lire le VPS après un retour au cloud.
    const jeu = lire('src', 'backend', 'game-supabase.js');
    const duJeu = jeu.match(/^const DATA_API_URL = '([^']*)'/m);
    const deLaPage = page.match(/^\s*const DATA_API_URL = '([^']*)'/m);
    expect(duJeu, 'DATA_API_URL introuvable dans game-supabase.js').not.toBeNull();
    expect(deLaPage, 'DATA_API_URL introuvable dans donation/index.html').not.toBeNull();
    expect(deLaPage[1], 'la page /donation et le jeu doivent viser la même base')
      .toBe(duJeu[1]);
  });
});

// --------------------------------------------------------- verify_jwt
// `supabase functions deploy` applique verify_jwt = true quand rien ne le
// déclare. Trois des quatre fonctions tournent en false, et config.toml n'en
// disait rien : un déploiement sans `--no-verify-jwt` les aurait basculées
// toutes ensemble, en silence. paypal-webhook aurait alors rejeté chaque don
// en 401 (PayPal ne peut pas s'authentifier chez nous) et auth-by-identifier
// aurait coupé la connexion de tout le monde.
test.describe('config.toml fige le verify_jwt de chaque fonction', () => {
  const config = lire('supabase', 'config.toml');
  const noms = fs.readdirSync(FONCTIONS)
    .filter((n) => fs.existsSync(path.join(FONCTIONS, n, 'index.ts')));

  test('chaque fonction du dépôt a sa section', () => {
    expect(noms.length, 'aucune fonction edge trouvée : extraction cassée').toBeGreaterThan(0);
    for (const nom of noms) {
      expect(
        config,
        `[functions.${nom}] manque dans supabase/config.toml : un deploy la basculerait ` +
        `en verify_jwt = true sans que personne ne le voie`
      ).toContain(`[functions.${nom}]`);
      const section = config.slice(config.indexOf(`[functions.${nom}]`));
      const valeur = section.slice(0, section.indexOf('\n\n') + 1 || undefined)
        .match(/verify_jwt\s*=\s*(true|false)/);
      expect(valeur, `[functions.${nom}] ne déclare pas verify_jwt`).not.toBeNull();
    }
  });

  // Les trois qui DOIVENT rester ouvertes, chacune pour une raison propre.
  // Un passage à true ici n'est pas un durcissement, c'est une panne.
  for (const [nom, raison] of [
    ['paypal-webhook', 'PayPal ne peut pas s\'authentifier : chaque don prendrait un 401'],
    ['auth-by-identifier', "l'écran de connexion n'est pas authentifié par construction"],
    ['discord-log', 'le client porte la clé publiable, qui n\'est pas un JWT'],
  ]) {
    test(`${nom} reste en verify_jwt = false (${raison})`, () => {
      const section = config.slice(config.indexOf(`[functions.${nom}]`));
      expect(section).toMatch(/^\[functions\.[^\]]+\]\s*\nverify_jwt\s*=\s*false/);
    });
  }
});

// ------------------------------------------------------- règle générale
test('toute fonction edge qui parle à une base déclare VERS_VPS', () => {
  // Régression de PORTÉE, et c'est elle qui compte le plus : les deux fonctions
  // corrigées ici n'avaient pas été oubliées par distraction, mais parce que
  // rien ne signalait qu'elles touchaient à la base. Ce test fait échouer
  // l'ajout d'une fonction edge qui écrirait dans le cloud sans y penser.
  const noms = fs.readdirSync(FONCTIONS)
    .filter((n) => fs.existsSync(path.join(FONCTIONS, n, 'index.ts')));
  expect(noms.length, 'aucune fonction edge trouvée : extraction cassée').toBeGreaterThan(0);

  for (const nom of noms) {
    const code = sansCommentaires(lireFonction(nom));
    if (!code.includes('/rest/v1/')) continue; // ne touche pas à la base
    expect(
      code,
      `${nom} interroge une base mais ne déclare pas VERS_VPS : elle vise donc le ` +
      `cloud, où les données du jeu ne vivent plus depuis le 2026-08-02`
    ).toContain('VERS_VPS');
  }
});
