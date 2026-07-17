// Annonce Discord automatique d'un nouveau patch note (2026-07-21, demande explicite : "on va
// arreter de passer par le bot pour les patchnote" -- remplace la suggestion initiale de
// repo-audit-todo.md, "webhook via le bot Discord Render", par ce script CI qui appelle
// directement l'Edge Function Supabase "discord-log" déjà déployée (générique, réutilisée telle
// quelle -- voir notify_cheat_discord() pour le même pattern côté anti-triche). Lancé par
// .github/workflows/ci.yml UNIQUEMENT sur push vers main, après que les tests soient verts.
//
// Détection "nouveau patch note" : compare PATCH_NOTES[0].v (la version la plus récente) entre
// le commit courant et HEAD~1 -- si identique, rien de neuf à annoncer (le fichier a pu changer
// pour une autre raison, ex: correction de typo sur une ancienne entrée), le script sort sans
// rien poster. Idempotent : ne spamme jamais deux fois la même version.
//
// Retry sur rate-limit Discord (2026-07-13, bug confirmé via `gh run view 29227544180 --log-failed` :
// 502 discord_failed avec {"message":"You are being rate limited.","retry_after":0.3,"global":false},
// script sans retry -> throw + exit 1 immédiat -> annonce V416 perdue silencieusement, jamais
// repostée automatiquement). Décision produit (2026-07-13, même session) : V416 n'a PAS été
// republiée manuellement -- plusieurs versions ont été poussées depuis, republier une annonce
// obsolète après coup n'apporterait rien. Le bouton admin manuel qui aurait permis ça
// (publishPatchNoteToDiscord/renderAdminPatchNotesDiscord, src/admin/admin-panel.js) a d'ailleurs
// été RETIRÉ dans la foulée : ce script CI (avec son retry) est désormais le SEUL chemin
// d'annonce Discord des patch notes, plus aucun chemin manuel.
//
// Couverture tests : ce script est un script Node standalone lancé par CI (.github/workflows/
// ci.yml), jamais chargé par index.dev.html -- ni tests/tests.js (window.runRegressionTests(),
// navigateur) ni tests/*.spec.js (Playwright, pilote le jeu réel) ne peuvent l'exercer, ce sont
// deux pipelines différents (voir CLAUDE.md §11). Pas de test unitaire Node dédié ajouté ici :
// un garde-fou statique par inspection de `.toString()`/regex sur ce fichier n'apporterait rien
// de plus que la relecture directe du code ci-dessous (fonction courte, un seul point d'entrée
// réseau) -- documenté plutôt que forcé, conformément à CLAUDE.md §11 ("documenter pourquoi ce
// n'est pas testable dans ce pipeline plutôt que de forcer un test inadapté").
const fs = require('fs');
const { execSync } = require('child_process');

const DISCORD_LOG_URL = 'https://mkwwvzbjtyawpcyrnybk.supabase.co/functions/v1/discord-log';
// clé publique (déjà embarquée côté client dans game-supabase.js, protégée par RLS -- pas un secret)
const SUPABASE_ANON_KEY = 'sb_publishable_c7HLxbeBLe01rirZVg-XPA_TClYulIJ';
const TYPE_ICONS = { new: '🆕', change: '🔧', fix: '🐛', exploit: '⚠️' };

function extractLatestEntry(source) {
  // meta/patch-notes-data.js est un simple `const PATCH_NOTES = [...]`, sans dépendance externe
  // (pas d'i18next ici, juste des objets {fr,en}) -- évaluable directement.
  const notes = new Function(`${source}\nreturn PATCH_NOTES;`)();
  return notes[0];
}

function buildDescription(entry, lang) {
  const lines = entry[lang].map(l => `${TYPE_ICONS[l.t] || '•'} ${l.tx}`).join('\n');
  const full = `**${entry.name[lang]}**\n\n${lines}`;
  return full.length > 2000 ? full.slice(0, 1997) + '…' : full;
}

const MAX_ATTEMPTS = 3;
const FALLBACK_BACKOFF_SEC = [2, 4, 8]; // utilisé si le corps de réponse n'a pas de retry_after exploitable

function sleep(seconds) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, seconds) * 1000));
}

/**
 * POST vers discord-log avec retry sur rate-limit (429/502 + retry_after dans le corps JSON).
 * Jusqu'à MAX_ATTEMPTS tentatives. Renvoie la Response finale (ok ou pas) -- l'appelant décide
 * du sort (exit 1) si toutes les tentatives ont échoué.
 */
async function postToDiscordLogWithRetry(payload) {
  let lastRes = null;
  let lastText = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // x-announce-secret : verrouille les cibles publiques patch_fr/patch_en côté fonction
    // discord-log (durcissement audit #9). Fourni via l'env ANNOUNCE_SECRET (secret CI/local),
    // jamais en dur. Absent -> header vide : la fonction reste ouverte tant que son propre
    // ANNOUNCE_SECRET n'est pas posé (bascule progressive).
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
    if (process.env.ANNOUNCE_SECRET) headers['x-announce-secret'] = process.env.ANNOUNCE_SECRET;
    const res = await fetch(DISCORD_LOG_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (res.ok) return res;

    lastRes = res;
    lastText = await res.text().catch(() => '');

    const isRateLimitStatus = res.status === 429 || res.status === 502;
    let retryAfter = null;
    try {
      const parsed = JSON.parse(lastText);
      if (typeof parsed.retry_after === 'number') retryAfter = parsed.retry_after;
    } catch (e) {
      // corps non-JSON ou pas de retry_after -- repli sur le backoff fixe
    }

    const shouldRetry = (isRateLimitStatus || retryAfter !== null) && attempt < MAX_ATTEMPTS;
    if (!shouldRetry) break;

    const waitSec = retryAfter !== null ? retryAfter : FALLBACK_BACKOFF_SEC[attempt - 1];
    console.log(`discord-log a échoué (${res.status}), tentative ${attempt}/${MAX_ATTEMPTS}, retry dans ${waitSec}s: ${lastText}`);
    await sleep(waitSec);
  }
  // reconstruit un objet "réponse" minimal pour l'appelant (dernier échec, texte déjà lu)
  return { ok: false, status: lastRes ? lastRes.status : 0, _text: lastText };
}

async function main() {
  const current = fs.readFileSync('meta/patch-notes-data.js', 'utf8');
  const currentLatest = extractLatestEntry(current);

  let previousLatest = null;
  try {
    const previous = execSync('git show HEAD~1:meta/patch-notes-data.js', { encoding: 'utf8' });
    previousLatest = extractLatestEntry(previous);
  } catch (e) {
    // pas de HEAD~1 (premier commit) ou fichier absent avant -- traite comme "toujours nouveau"
  }

  if (previousLatest && previousLatest.v === currentLatest.v) {
    console.log(`Pas de nouvelle version (toujours ${currentLatest.v}) -- rien à annoncer.`);
    return;
  }

  // Poste séparément en FR et en EN (2026-07-14, demande explicite : les 2 langues ont chacune
  // leur propre canal Discord -- 'target' sélectionne le webhook côté fonction discord-log, voir
  // son code source pour le détail. Les 2 posts sont indépendants : un échec sur l'un n'empêche
  // pas la tentative de l'autre, mais fait quand même échouer le script (exit 1) pour que le
  // problème remonte en CI plutôt que d'être avalé silencieusement.
  const langs = [
    { lang: 'fr', target: 'patch_fr', titlePrefix: '📜 Notes de version' },
    { lang: 'en', target: 'patch_en', titlePrefix: '📜 Patch notes' },
  ];
  const failures = [];
  for (const { lang, target, titlePrefix } of langs) {
    const res = await postToDiscordLogWithRetry({
      title: `${titlePrefix} — ${currentLatest.v}`,
      description: buildDescription(currentLatest, lang),
      color: 0xd4a955,
      target,
    });
    if (!res.ok) {
      const text = res._text !== undefined ? res._text : await res.text().catch(() => '');
      failures.push(`[${lang}] ${res.status}: ${text}`);
    } else {
      console.log(`Annonce Discord (${lang}) envoyée pour ${currentLatest.v}.`);
    }
  }
  if (failures.length) {
    throw new Error(`discord-log a échoué après ${MAX_ATTEMPTS} tentatives -- ${failures.join(' | ')}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
