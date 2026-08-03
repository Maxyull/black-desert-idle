// Garde-fou : la suite de tests ne doit JAMAIS parler aux backends de production.
//
// Voir l'en-tête de tests/_hors-prod.js pour l'incident qui a motivé ce dispositif
// (la suite tapait le VPS et le projet cloud, 4989 requêtes sur 5000 dans le journal
// Caddy venaient de `npm test`).
//
// Deux tests, deux modes de panne distincts :
//   1. quelqu'un ajoute un backend au jeu sans l'ajouter à HOTES_PROD  -> test 1
//   2. l'interception se casse (fixture retirée, matcher faux, API Playwright changée)
//      et les requêtes repartent vers la prod sans que personne ne le voie  -> test 2

const fs = require('fs');
const path = require('path');
const { test, expect, HOTES_PROD } = require('./_hors-prod');

// Ce test-ci est côté Node : il lit la source, il n'a pas besoin de navigateur.
// Même esprit que « PROD_HOSTNAME reste synchronisé avec le fichier CNAME »
// (tests/regression.spec.js) : une constante dupliquée qu'un test tient alignée.
test('HOTES_PROD couvre tous les backends déclarés dans game-supabase.js', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'backend', 'game-supabase.js'),
    'utf8'
  );

  // On ne lit QUE les déclarations de constantes en tête de fichier, pas les URL citées
  // dans les commentaires (il y en a, vers la doc de bdi-infra et les notes JWT).
  const declarees = [...source.matchAll(/^const\s+\w*(?:URL|API)\w*\s*=\s*'(https:\/\/[^']+)'/gm)]
    .map((m) => new URL(m[1]).hostname);

  // Si cette assertion tombe, c'est que le fichier a été restructuré : le test ne
  // protège plus rien, il faut réparer l'extraction avant de continuer.
  expect(declarees.length, 'aucune URL de backend trouvée dans game-supabase.js').toBeGreaterThan(0);

  for (const hote of declarees) {
    expect(
      HOTES_PROD,
      `${hote} est un backend du jeu mais n'est pas bloqué dans tests/_hors-prod.js`
    ).toContain(hote);
  }
});

test('aucune requête ne part vers la production au chargement du jeu', async ({ page, appelsProdBloques }) => {
  await page.goto('/index.dev.html');

  // Le jeu appelle plusieurs RPC publiques dès le chargement (get_registered_count,
  // chat_messages, live_boss...). Si RIEN n'est bloqué, ce n'est pas que le jeu est
  // devenu sobre : c'est que l'interception ne mord plus.
  await expect
    .poll(() => appelsProdBloques.length, {
      timeout: 15_000,
      message: "l'interception de tests/_hors-prod.js n'a rien capté, elle ne protège plus rien",
    })
    .toBeGreaterThan(0);

  // Et tout ce qui a été capté visait bien un hôte de prod, jamais le serveur local.
  for (const url of appelsProdBloques) {
    expect(HOTES_PROD).toContain(new URL(url).hostname);
  }
});
