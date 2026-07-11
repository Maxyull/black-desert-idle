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

function buildDescription(entry) {
  const lines = entry.fr.map(l => `${TYPE_ICONS[l.t] || '•'} ${l.tx}`).join('\n');
  const full = `**${entry.name.fr}**\n\n${lines}`;
  return full.length > 2000 ? full.slice(0, 1997) + '…' : full;
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

  const res = await fetch(DISCORD_LOG_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({
      title: `📜 Notes de version — ${currentLatest.v}`,
      description: buildDescription(currentLatest),
      color: 0xd4a955,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`discord-log a échoué (${res.status}): ${text}`);
  }
  console.log(`Annonce Discord envoyée pour ${currentLatest.v}.`);
}

main().catch(e => { console.error(e); process.exit(1); });
