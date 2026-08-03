// ============================================================
// SANTE DU CLIENT (version courante, detection de maj, erreurs JS, vidage du cache)
// ============================================================
// Extrait de src/backend/game-supabase.js le 2026-07-22 (audit repo P5 : le fichier avait
// atteint 3 124 lignes, trois fois la limite de decoupe obligatoire de CLAUDE.md, et melangeait
// la surveillance du client avec l'authentification).
//
// DECOUPAGE PAR TRANSPLANTATION, PAS PAR REECRITURE : les lignes sont sorties telles quelles, et
// ce fichier est charge dans index.dev.html EXACTEMENT a la place qu'occupait ce bloc dans
// l'original. Le projet n'a pas de modules ES -- tous les scripts partagent un seul scope global,
// et un `const`/`let` de haut niveau lu au chargement par un fichier suivant explose si l'ordre
// bouge (CLAUDE.md SS6). Preserver l'ordre a l'octet pres est ce qui rend ce decoupage sur.
//
// ATTENTION A L'ORDRE : `const CURRENT_VERSION = PATCH_NOTES[0].v` est evalue AU CHARGEMENT.
// Ce fichier doit donc rester apres meta/patch-notes-data.js, et avant tout code qui lit
// CURRENT_VERSION au chargement.

// ============================================================
// DÉTECTION DE NOUVELLE VERSION — prévient le joueur qu'une maj a été déployée
// (on refetch périodiquement index.html et on compare la première version du tableau)
// ============================================================
const CURRENT_VERSION = PATCH_NOTES[0].v;
$a('clientVersionNum').textContent = CURRENT_VERSION;

// ============================================================
// MONITORING D'ERREURS CLIENT (2026-07-21, repo-audit-todo.md point 18) — sans dépendance
// externe (pas de Sentry, option minimale) : logue les erreurs JS/promesses rejetées non gérées
// dans public.client_errors (supabase/migrations/20260721150000_client_error_logging.sql),
// jusque-là invisible côté développeur sauf signalement manuel Discord. Throttlé à
// CLIENT_ERROR_MAX_PER_SESSION (évite qu'une boucle d'erreur répétée spamme la table) ; hors
// ligne/sans sb : no-op silencieux (même pattern que les autres appels réseau du fichier, voir
// CLAUDE.md §11 politique tests en ligne + hors ligne).
// ============================================================
const CLIENT_ERROR_MAX_PER_SESSION = 5;
let clientErrorCount = 0;
// ---------- filtre d'origine (2026-08-03) ----------
// reportClientError() inserait depuis N'IMPORTE QUELLE origine, y compris
// http://127.0.0.1:<port>/index.dev.html — donc depuis chaque `npx playwright test` local. Mesuré
// sur le VPS le 2026-08-02 : sur 12 erreurs des dernières 24 h, 10 venaient du poste de dev, 2
// seulement de https://blackdesertidle.maxyull.fr. Conséquences : le KPI « erreurs client 24h » du
// dashboard de supervision (bdi-infra, /api/bdi/kpis) alertait dans le vide, et l'onglet Monitoring
// du panneau admin affichait des erreurs qu'aucun joueur n'a jamais vues.
//
// POURQUOI ICI ET NULLE PART AILLEURS : client_errors est la SEULE table qu'un client sans session
// Supabase valide peut écrire (policy `user_id is null or user_id = auth.uid()`, migration
// 20260722190000_harden_client_errors_insert.sql — le client n'envoie pas de user_id, donc un
// invité passe). Toutes les autres écritures du jeu (game_saves, player_stats, farm_events,
// silver_ledger, heartbeat_presence, log_playtime_ping, record_afk_session...) exigent
// `user_id = auth.uid()`, et les tests Playwright appellent onAuthed() avec un utilisateur
// fabriqué localement sans jamais ouvrir de session (voir signInForTest, tests/companions.spec.js) :
// leurs écritures sont refusées côté serveur et ne polluent rien.
//
// Liste BLANCHE, pas liste noire : seul le domaine de prod passe. Un nouveau contexte de dev
// (autre port, IP LAN pour tester au téléphone, *.github.io, file://, preview d'une PR) est donc
// filtré par défaut, sans avoir à penser à l'ajouter.
const PROD_HOSTNAME = 'blackdesertidle.maxyull.fr'; // = fichier CNAME à la racine (GitHub Pages)
/** @param {string} hostname. true si ce nom d'hôte est celui de la production (liste blanche stricte : 127.0.0.1, localhost, ::1, IP LAN, *.github.io... sont tous du dev). */
function isProdHostname(hostname) {
  return hostname === PROD_HOSTNAME;
}
// Évalué une fois au chargement : l'origine d'une page ne change pas de sa vie. `let` et non
// `const` pour que les tests puissent le forcer, exactement comme isOffline/sb (tests/tests.js).
let originIsProd = isProdHostname(location.hostname);
/** @param {string} message @param {?string} stack. Journalise une erreur client dans client_errors (prod uniquement, throttlé à CLIENT_ERROR_MAX_PER_SESSION, no-op hors-ligne/sans Supabase). */
function reportClientError(message, stack) {
  if (!originIsProd) return; // dev local : ne jamais polluer la table de prod, voir ci-dessus
  if (isOffline || !sb || clientErrorCount >= CLIENT_ERROR_MAX_PER_SESSION) return;
  clientErrorCount++;
  try {
    sb.from('client_errors').insert({
      message: String(message || '').slice(0, 2000),
      stack: stack ? String(stack).slice(0, 4000) : null,
      url: location.href,
      game_version: typeof CURRENT_VERSION !== 'undefined' ? CURRENT_VERSION : null,
      user_agent: navigator.userAgent,
    }).then(() => {}, () => {});
  } catch (e) {}
}
window.addEventListener('error', e => {
  reportClientError(e.message, e.error && e.error.stack);
});
window.addEventListener('unhandledrejection', e => {
  const reason = e.reason;
  reportClientError(reason && reason.message ? reason.message : String(reason), reason && reason.stack);
});

// ---------- le toast est un CONFORT, jamais une condition de la mise à jour (2026-08-03) ----------
// Incident du 2026-08-03 : une joueuse est restée 11 h 30 sur le bundle V497 alors que la V498
// était en ligne depuis 9 heures. Sa progression est partie dans la base du cloud, que le jeu ne
// lit plus depuis la bascule vers le VPS, et il a fallu recopier sa sauvegarde à la main. Le
// mécanisme censé rendre les déploiements indolores est précisément celui qui a lâché, EN SILENCE.
//
// La cause exacte n'a PAS été prouvée (son bundle contenait bien checkForUpdate, le setInterval de
// 60 s, les quatre éléments du toast et la clé i18n : le mécanisme était complet). Le candidat le
// plus probable reste la forme d'alors :
//
//     if (updateToastShown) return;              // verrou définitif
//     ...
//     updateToastShown = true;                   // posé AVANT le travail faillible
//     $a('updToastVer').textContent = ...;       // peut lever ($a renvoie null si l'élément manque)
//     $a('updateToast').classList.add('show');   // peut lever
//     startUpdateCountdown();                    // appelle i18next.t(), peut lever
//     ...
//     } catch (e) {}                             // avale tout, sans une trace nulle part
//
// N'importe quelle exception d'affichage laissait le verrou posé : la fonction ressortait
// immédiatement à chaque appel suivant, pour toujours. Plus de toast, plus de compte à rebours,
// plus de rechargement. Un fetch en échec durable ou un onglet gelé restent possibles aussi.
//
// D'où la structure ci-dessous, qui ne parie sur AUCUN de ces diagnostics :
//   1. `updateToastShown` n'est plus un verrou d'entrée, et n'est posé qu'APRÈS un affichage réussi ;
//   2. un filet de sécurité recharge sans toucher au DOM ni à i18next si la version en ligne reste
//      différente sur UPDATE_FORCE_RELOAD_AFTER_CHECKS contrôles d'affilée ;
//   3. plus rien n'est avalé en silence (console.error systématique + remontée serveur).
let updateToastShown = false;
// 5 contrôles = ~5 min via le setInterval de 60 s. C'est un PLAFOND, pas un délai garanti : les
// contrôles déclenchés par visibilitychange/focus (voir plus bas) peuvent faire tomber les 5 en
// quelques secondes si le joueur passe d'un onglet à l'autre. C'est voulu — plus tôt vaut mieux
// que plus tard, et dans le chemin nominal le toast est déjà affiché avec son compte à rebours de
// 15 s, qui recharge bien avant que ce filet n'ait à servir.
const UPDATE_FORCE_RELOAD_AFTER_CHECKS = 5;
// Un fetch en échec n'apprend RIEN sur la version en ligne : il ne remet pas ce compteur à zéro
// (sinon une connexion instable suffirait à désarmer le filet). Seul un contrôle réussi qui voit
// la même version que la nôtre le remet à 0.
let updateStaleChecks = 0;
// Nombre de contrôles consécutifs dont le fetch a échoué. Avant, une panne de plusieurs heures
// était rigoureusement invisible : on retentait, et rien ne se plaignait jamais.
const UPDATE_CHECK_FAILURES_BEFORE_REPORT = 10; // ~10 min de panne avant d'alerter
let updateCheckFailures = 0;
/** SEUL point du fichier qui appelle location.reload() pour une MAJ. Cette indirection existe pour les tests : location.reload n'est pas redéfinissable sous Chrome, une fonction globale l'est. */
function reloadForUpdate() {
  location.reload();
}
// rechargement automatique 15s (2026-07-13, demande explicite : "afficher un compteur 15 secondes
// et recharger la page tout en continuant ce que fais le joueur") -- le joueur continue de jouer
// normalement pendant le compte à rebours (aucune pause de la boucle/du combat), seul un reload
// silencieux de la page ferme la session au bout de 15s si le bouton "Recharger maintenant" n'a
// pas déjà été cliqué entre-temps.
const UPDATE_AUTO_RELOAD_SEC = 15;
let updateCountdownTimer = null;
/** Démarre le compte à rebours de 15s affiché dans le toast de MAJ, rechargement automatique à 0 (annulé si btnReloadUpdate est cliqué avant). Le rendu (DOM + i18next) est isolé : son échec n'empêche jamais le rechargement. */
function startUpdateCountdown() {
  if (updateCountdownTimer) clearInterval(updateCountdownTimer); // jamais deux compteurs en parallèle
  let remaining = UPDATE_AUTO_RELOAD_SEC;
  // Le rendu est le seul morceau faillible ici (l'élément peut manquer, i18next peut ne pas être
  // prêt). Il est enveloppé pour que le setInterval démarre TOUJOURS : c'est lui qui recharge, et
  // c'est ça le but du compteur — l'affichage n'en est que la politesse. Avant, ce premier
  // `render()` synchrone levait avant même l'affectation du setInterval, et le compte à rebours
  // n'existait tout simplement pas.
  const render = () => {
    try {
      const el = $a('updCountdown');
      if (el) el.innerHTML = i18next.t('backend:backend.update.auto_reload_countdown', { count: remaining });
    } catch (e) {
      console.error('[maj] rendu du compte a rebours impossible (le rechargement reste programme)', e);
    }
  };
  render();
  updateCountdownTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) { clearInterval(updateCountdownTimer); updateCountdownTimer = null; reloadForUpdate(); return; }
    render();
  }, 1000);
}
/** @param {string} latest. Affiche le toast de MAJ et lance le compte à rebours. FAILLIBLE par nature (DOM + i18next) : l'appelant doit l'envelopper et ne jamais conditionner la mise à jour à sa réussite. */
function showUpdateToast(latest) {
  $a('updToastVer').textContent = '(' + latest + ')';
  $a('updateToast').classList.add('show');
  startUpdateCountdown();
}
/** @param {string} reason. Compte les échecs consécutifs du contrôle de version et alerte une fois par panne (console + client_errors) au-delà de UPDATE_CHECK_FAILURES_BEFORE_REPORT — une panne durable ne doit plus être invisible. */
function noteUpdateCheckFailure(reason) {
  updateCheckFailures++;
  console.error('[maj] controle de version en echec (' + updateCheckFailures + " d'affilee) : " + reason);
  // `===` et pas `>=` : une seule remontée serveur par panne, pas une par minute pendant des heures
  // (reportClientError a déjà son propre plafond de 5/session, autant ne pas le brûler ici).
  if (updateCheckFailures === UPDATE_CHECK_FAILURES_BEFORE_REPORT) {
    reportClientError('checkForUpdate: ' + updateCheckFailures + ' controles de version consecutifs en echec : ' + reason, null);
  }
}
/**
 * @param {?string} latest version lue en ligne (fetch déjà réussi).
 * Décide quoi faire d'UN contrôle de version réussi. Synchrone et sans réseau : c'est la partie
 * testable directement (le harnais de tests/tests.js est synchrone, il ne peut pas awaiter
 * checkForUpdate). Ordre volontaire — le filet de rechargement est évalué AVANT le toast, et le
 * toast ne peut jamais empêcher le filet de se déclencher au contrôle suivant.
 */
function applyUpdateCheckResult(latest) {
  if (!latest || latest === CURRENT_VERSION) { updateStaleChecks = 0; return; }
  // --- à partir d'ici une nouvelle version EST en ligne : plus rien ne doit pouvoir bloquer la MAJ ---
  updateStaleChecks++;
  if (updateStaleChecks >= UPDATE_FORCE_RELOAD_AFTER_CHECKS) {
    // Chemin de secours : aucun accès DOM, aucun i18next, aucune dépendance faillible. Si on en est
    // là, c'est que le toast n'a pas fait son travail — on recharge quand même.
    console.error('[maj] version ' + latest + ' en ligne depuis ' + updateStaleChecks
      + ' controles et toujours pas rechargee (toast affiche: ' + updateToastShown + ') -> rechargement force');
    reloadForUpdate();
    return;
  }
  if (updateToastShown) return; // déjà affiché, rien à refaire — mais le compteur ci-dessus, lui, continue
  try {
    showUpdateToast(latest);
    updateToastShown = true; // APRÈS l'affichage réussi, jamais avant : c'est ce qui a coûté 11 h 30 le 2026-08-03
  } catch (e) {
    // Ne plus jamais avaler ça en silence. On ne remet PAS updateToastShown à true : le prochain
    // contrôle retentera l'affichage (une gêne transitoire du DOM peut se résorber), et si ça
    // continue de rater, le filet ci-dessus recharge de toute façon.
    console.error('[maj] affichage du toast impossible (le rechargement force reste arme)', e);
    reportClientError('checkForUpdate: affichage du toast de MAJ impossible: ' + (e && e.message ? e.message : String(e)), e && e.stack);
  }
}
/** Refetch meta/patch-notes-version.json et confie le résultat à applyUpdateCheckResult(). Ne sort JAMAIS tôt sur updateToastShown : le filet de rechargement forcé a besoin de continuer à compter même quand le toast est déjà à l'écran (ou a échoué à s'afficher). */
async function checkForUpdate() {
  let latest = null;
  try {
    // Ce check tourne toutes les 60 s + à chaque retour d'onglet et de focus (voir plus bas), et
    // il ne veut qu'UNE chose : le numéro de la version en ligne. Il téléchargeait pour ça
    // meta/patch-notes-data.js EN ENTIER (591 Ko, ~184 Ko gzippé) puis en extrayait 5 caractères
    // par regex -- et `cache: 'no-store'` interdisait au navigateur de le mettre en cache ou de
    // répondre 304, donc le fichier repartait vraiment sur le fil à chaque appel : ~11 Mo/h et
    // par joueur. meta/patch-notes-version.json ne contient que {"v":"..."} (~15 octets), généré
    // au build depuis PATCH_NOTES[0].v (scripts/build.py, gen_patch_version) -- même valeur,
    // même source de vérité, ~12 000× moins de données.
    // `no-store` est CONSERVÉ, et c'est volontaire : ce fichier doit refléter le déploiement à la
    // seconde près, un cache le rendrait inutile. C'est bien la TAILLE qui était le problème, pas
    // le fait de ne pas cacher.
    const res = await fetch('./meta/patch-notes-version.json?_=' + Date.now(), { cache: 'no-store' });
    // 404 pendant un déploiement partiel : on retentera dans 60 s — mais on le COMPTE désormais,
    // un 404 qui dure n'est plus un non-événement.
    if (!res.ok) { noteUpdateCheckFailure('HTTP ' + res.status); return; }
    latest = (await res.json()).v;
  } catch (e) {
    noteUpdateCheckFailure(e && e.message ? e.message : String(e));
    return;
  }
  updateCheckFailures = 0; // fetch réussi : la panne éventuelle est terminée
  applyUpdateCheckResult(latest);
}
if ($a('btnReloadUpdate')) {
  // Gardé : ce fichier charge au top-level, une exception ici tuerait tout ce qui le suit dans le
  // bundle (un seul scope global partagé, CLAUDE.md §7-§8).
  $a('btnReloadUpdate').onclick = () => { if (updateCountdownTimer) clearInterval(updateCountdownTimer); reloadForUpdate(); };
}
// vide le cache du navigateur pour les fichiers du jeu (utile si une maj ne s'affiche pas
// correctement) -- ne touche jamais la sauvegarde (Supabase ni le fallback localStorage)
/** Vide le cache navigateur (Cache API + service workers) du jeu et recharge sans cache. Ne touche jamais la sauvegarde. */
async function clearGameCache() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
  } catch (e) {}
  location.href = location.pathname + '?nocache=' + Date.now();
}
setInterval(checkForUpdate, 60 * 1000); // toutes les 60s (déploiement GitHub Pages ~1-2 min)
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate(); });
window.addEventListener('focus', checkForUpdate);
setTimeout(checkForUpdate, 15000); // premier check peu après le chargement