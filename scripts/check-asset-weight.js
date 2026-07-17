// Garde-fou de poids des assets partagés (2026-07-22, audit perf P2).
//
// POURQUOI CE SCRIPT EXISTE : l'image Open Graph avait DÉJÀ été recompressée par le passé (256 Ko),
// puis un commit suivant a remis une version lourde -- elle était remontée à 1051 Ko sans que
// personne ne s'en aperçoive, et Discord/Twitter la retéléchargeaient à chaque partage de lien.
// Une correction qui peut être annulée en silence n'est pas une correction : ce script la rend
// permanente en faisant échouer la CI si ça se reproduit.
//
// Usage : node scripts/check-asset-weight.js   (lancé par `npm run check-assets` et par la CI)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Limites en OCTETS. Volontairement larges : le but est d'attraper une régression grossière
// (un PNG brut de 1 Mo), pas de chipoter sur 10 Ko. La cible réelle de l'OG est ~140 Ko.
const LIMITS = [
  { dir: 'assets', pattern: /^og-.*\.(png|jpe?g|webp)$/i, max: 400 * 1024,
    why: 'image Open Graph : retéléchargée par Discord/Twitter à chaque partage de lien' },
];

let failed = false;
for (const rule of LIMITS) {
  const dir = path.join(ROOT, rule.dir);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!rule.pattern.test(f)) continue;
    const size = fs.statSync(path.join(dir, f)).size;
    const ko = (size / 1024).toFixed(0);
    const maxKo = (rule.max / 1024).toFixed(0);
    if (size > rule.max) {
      console.error(`ECHEC : ${rule.dir}/${f} pèse ${ko} Ko (limite ${maxKo} Ko)`);
      console.error(`        ${rule.why}`);
      console.error(`        Recompresse-le (JPEG q90 progressif, ou pngquant/squoosh) avant de committer.`);
      failed = true;
    } else {
      console.log(`OK : ${rule.dir}/${f} — ${ko} Ko (limite ${maxKo} Ko)`);
    }
  }
}
if (failed) process.exit(1);
console.log('Poids des assets partagés : OK.');
