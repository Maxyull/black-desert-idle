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
/** @param {string} message @param {?string} stack. Journalise une erreur client dans client_errors (throttlé à CLIENT_ERROR_MAX_PER_SESSION, no-op hors-ligne/sans Supabase). */
function reportClientError(message, stack) {
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

let updateToastShown = false;
// rechargement automatique 15s (2026-07-13, demande explicite : "afficher un compteur 15 secondes
// et recharger la page tout en continuant ce que fais le joueur") -- le joueur continue de jouer
// normalement pendant le compte à rebours (aucune pause de la boucle/du combat), seul un reload
// silencieux de la page ferme la session au bout de 15s si le bouton "Recharger maintenant" n'a
// pas déjà été cliqué entre-temps.
const UPDATE_AUTO_RELOAD_SEC = 15;
let updateCountdownTimer = null;
/** Démarre le compte à rebours de 15s affiché dans le toast de MAJ, rechargement automatique à 0 (annulé si btnReloadUpdate est cliqué avant). */
function startUpdateCountdown() {
  let remaining = UPDATE_AUTO_RELOAD_SEC;
  const el = $a('updCountdown');
  const render = () => { if (el) el.innerHTML = i18next.t('backend:backend.update.auto_reload_countdown', { count: remaining }); };
  render();
  updateCountdownTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) { clearInterval(updateCountdownTimer); location.reload(); return; }
    render();
  }, 1000);
}
/** Refetch meta/patch-notes-version.json et compare sa version à CURRENT_VERSION — affiche le toast de mise à jour une seule fois si différente, démarre le compte à rebours de rechargement auto. */
async function checkForUpdate() {
  if (updateToastShown) return;
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
    if (!res.ok) return; // 404 pendant un déploiement partiel : on retentera dans 60 s
    const latest = (await res.json()).v;
    if (latest && latest !== CURRENT_VERSION) {
      updateToastShown = true;
      $a('updToastVer').textContent = '(' + latest + ')';
      $a('updateToast').classList.add('show');
      startUpdateCountdown();
    }
  } catch (e) {}
}
$a('btnReloadUpdate').onclick = () => { if (updateCountdownTimer) clearInterval(updateCountdownTimer); location.reload(); };
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