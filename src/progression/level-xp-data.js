// ==================== TABLE D'XP PAR NIVEAU ====================
// Extrait de game-core.js le 2026-07-08 (reorganisation par dossiers) -- pure donnee, aucune
// dependance, charge AVANT core/game-core.js (xpNeededFor() la lit uniquement a l'execution).
// table d'XP requise par niveau du vrai jeu (BDO) — indice = niveau actuel, valeur = XP pour
// passer au niveau suivant. Les niveaux 0-4 ne coûtent presque rien (quasi instantané), puis ça
// explose jusqu'à des quantités astronomiques (~1.29 quadrillion à partir du niveau 71, où la
// courbe plafonne dans le jeu original) — d'où le format d'affichage en % à 3 décimales : passé
// un certain niveau, un monstre ne fait plus gagner que quelques 0.001% de la barre.
const LEVEL_XP_TABLE = [
  1,1,1,1,1,161,472,1181,2626,5319,10005,17721,29865,48273,75300,113911,167777,241381,340127,
  470464,640005,857666,1133804,1480364,1911035,2441411,3089163,3874210,4818908,5948238,7290005,
  8875042,10737423,12914685,15448049,18382661,21767828,25657269,30109369,35187443,40960005,
  47501047,54890322,63213635,72563144,83037661,94742974,118571374,158997683,207619316,415238632,
  830477264,1245715896,1868573844,2802860766,8408582298,21021455745,52553639363,105107278725,
  210214557450,630643672350,1261287344700,2522574689400,5045149378800,10090298757600,
  20180597515200,40361195000000,80722390000000,161444780000000,322889560000000,645779120000000,
  1291558200000000,
];
