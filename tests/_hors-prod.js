// Isolation des tests vis-à-vis des backends de PRODUCTION (2026-08-03).
//
// POURQUOI CE FICHIER EXISTE
// `SUPABASE_URL` et `DATA_API_URL` sont en dur dans src/backend/game-supabase.js, et
// `index.dev.html` charge ce fichier tel quel. Conséquence longtemps passée inaperçue :
// **la suite Playwright parlait aux vraies bases**. Mesuré le 2026-08-03 dans le journal
// Caddy du VPS, sur les 5000 dernières requêtes : 4989 venaient d'origines
// `http://127.0.0.1:49xxx`, c'est-à-dire de `npm test`, contre 9 du vrai site.
//
// Ce n'était pas qu'du bruit dans les journaux. tests/modal-a11y.spec.js pose un
// `currentUser` factice (`{ id: 'x' }`) pour ouvrir la modale d'auth. Le garde de
// `heartbeatPresence()` (`if (!sb || !currentUser) return`) laisse alors passer l'appel,
// mais il n'y a aucune session derrière : `jetonPourDonnees()` renvoie '', `fetchDonnees()`
// retire l'en-tête vide, PostgREST retombe sur `anon`, `auth.uid()` est null et la fonction
// lève « Non authentifié ». D'où 2637 erreurs Postgres sur la seule heure de 07h le
// 2026-08-03, pour UN run de la suite, et un journal Postgres à 11 Mo.
//
// CE QUE ÇA FAIT
// Coupe au niveau du contexte navigateur toute requête vers un hôte de production. Le jeu
// se comporte alors comme hors ligne, cas qu'il gère déjà partout (`try {} catch (e) {}`
// autour des appels réseau, `saveToLocalOfflineCache`, etc.).
//
// CE QUE ÇA NE FAIT PAS
// `context.route` n'intercepte QUE le HTTP. Le realtime de supabase-js passe par WebSocket
// et n'est pas couvert ici. Il ne porte que la présence des lobbies boss (voir le
// commentaire de `sbAuth` dans game-supabase.js), n'écrit rien en base, et aucun spec ne
// l'exerce aujourd'hui. Si ça change un jour, il faudra `context.routeWebSocket`.
//
// USAGE : dans un spec, remplacer
//     const { test, expect } = require('@playwright/test');
// par
//     const { test, expect } = require('./_hors-prod');
// Il n'y a rien d'autre à faire, le blocage est un fixture `auto`.

const base = require('@playwright/test');

/**
 * Hôtes de production que les tests n'ont pas le droit de joindre.
 *
 * Gardé synchronisé avec les constantes de src/backend/game-supabase.js par
 * tests/hors-prod.spec.js : ajouter un backend au jeu sans l'ajouter ici ferait
 * échouer ce test, plutôt que de rouvrir silencieusement la vanne.
 */
const HOTES_PROD = [
  'mkwwvzbjtyawpcyrnybk.supabase.co',              // SUPABASE_URL — auth, realtime, fonctions edge
  'bdi.maxyull.fr',                                // DATA_API_URL — PostgREST du VPS (données du jeu)
  'black-desert-idle-discord-bot.onrender.com',    // BOT_API_URL — bot Discord
];

/**
 * Seule exception au blocage : les fichiers statiques publics.
 *
 * `bdi.maxyull.fr` sert DEUX choses : l'API PostgREST, et les 55 modèles .glb des
 * compagnons sous /storage/v1/object/public/companion-models (voir COMPANION_MODELS_BASE
 * dans src/companions/viewer3d.js, et le test qui verrouille les deux hôtes ensemble dans
 * companions.spec.js). Couper l'hôte entier faisait échouer le test de fuite de contexte
 * WebGL, qui a besoin de vrais modèles pour dire quoi que ce soit.
 *
 * Ce qu'on cherche à empêcher, c'est que les tests touchent les BASES de production. Lire
 * un .glb public n'écrit rien, ne s'authentifie pas et ne laisse aucune trace en base :
 * ça ne fait pas partie du problème. Tout le reste reste bloqué par défaut.
 */
const CHEMIN_STATIQUE_PUBLIC = /^\/storage\/v1\/object\/public\//;

/** @param {URL} url */
const versLaProd = (url) =>
  HOTES_PROD.includes(url.hostname) && !CHEMIN_STATIQUE_PUBLIC.test(url.pathname);

const test = base.test.extend({
  /**
   * Liste des URL bloquées pendant le test, dans l'ordre d'apparition.
   *
   * `auto: true` : actif dans TOUS les tests du fichier qui importe ce module, sans
   * que le test ait à le demander. C'est volontaire — l'isolation ne doit pas dépendre
   * du fait que l'auteur d'un nouveau spec y ait pensé.
   */
  appelsProdBloques: [async ({ context }, use) => {
    const bloques = [];
    await context.route(versLaProd, (route) => {
      const url = route.request().url();
      bloques.push(url);
      // On RÉPOND (200 vide) au lieu de refuser la requête.
      //
      // Mesuré le 2026-08-03 : avec `route.abort()`, companions.spec.js passait de ~2 min
      // à plus de 9 min sans finir. Le jeu traite un échec réseau comme une panne et
      // relance (boss.js relance après DEUX échecs, voir liveBossFailCount), donc chaque
      // refus déclenche une reprise, en boucle serrée puisque l'abort est instantané. Le
      // CPU part dans les reprises, et les tests qui dépendent du canvas en rAF ralentissent
      // tous ensemble.
      //
      // Une réponse vide et valide coupe court : l'appli conclut « rien à afficher »,
      // chemin qu'elle gère nativement, et ne relance pas.
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        // Une RPC renvoie un scalaire ou un objet, une lecture de table renvoie une liste.
        body: /\/rest\/v1\/rpc\//.test(url) ? 'null' : '[]',
      });
    });
    await use(bloques);
  }, { auto: true }],
});

module.exports = { test, expect: base.expect, HOTES_PROD };
