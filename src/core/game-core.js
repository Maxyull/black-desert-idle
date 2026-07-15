'use strict';
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const W = cv.width, H = cv.height;
const $ = id => document.getElementById(id);
// $a est un alias identique de $ (historiquement introduit dans game-supabase.js) -- declare ICI
// desormais (pas dans game-supabase.js) pour eviter un piege de zone morte temporelle une fois le
// jeu regroupe en un seul fichier : des fonctions chargees AVANT game-supabase.js (ex: boss.js,
// tickBossPanelCountdown -> setInterval au chargement) y accedent avant que sa ligne `const $a = `
// (dans game-supabase.js) ne soit atteinte.
const $a = id => document.getElementById(id);
// le canvas a une résolution interne FIXE (1240×440, voir <canvas>) que le CSS (width:100%) réduit
// pour tenir dans un téléphone — tout texte dessiné dessus (floatTxt : gains de loot/XP, dégâts...)
// rétrécit donc dans les mêmes proportions et devient minuscule sur mobile (2026-07-05, demande
// explicite : "met en valeur le changement de XP/LOOT"). uiTextScale() compense en agrandissant les
// polices dans le repère du canvas d'autant que l'affichage réel a rétréci, pour une taille visuelle
// ~constante à l'écran quelle que soit la largeur ; plafonné pour rester lisible sans être absurde.
/** @returns {number} facteur d'agrandissement du texte dessiné sur le canvas (1-3.2), compense le rétrécissement CSS pour une taille visuelle ~constante à l'écran. */
function uiTextScale() { return Math.min(3.2, Math.max(1, 1240 / (cv.clientWidth || 1240))); }
// détecte un client mobile/tablette (2026-07-05, adaptation mobile) : sert à choisir un état
// replié par DÉFAUT pour les panneaux flottants (menu, chat, suivi) qui se chevauchent sinon sur un
// petit écran (voir les media queries ci-dessus) — un simple seuil de largeur de viewport suffit
// (pas besoin de sniffer le user-agent, le responsive suit déjà la taille réelle de la fenêtre)
function isMobileViewport() { return window.innerWidth <= 1024; }
// échappe pseudo/message avant insertion via innerHTML — ce sont des chaînes saisies par
// d'autres joueurs, jamais dignes de confiance (évite une injection XSS stockée dans le chat)
/** @param {*} s - texte à insérer via innerHTML (pseudo/message d'un autre joueur, jamais fiable). @returns {string} texte avec &<>"' échappés (empêche une injection XSS stockée). */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ==================== I18N (déclaré tôt : utilisé dès les premiers rendus) ====================
let LANG = 'fr';
try { LANG = localStorage.getItem('velia-idle-lang') || 'fr'; } catch(e) {}
// traduction des noms dynamiques (zones, mobs, objets) — clé = texte FR d'origine
const NAME_EN = {
  // zones
  'Camp des Loups':'Wolf Camp', 'Ruines de Protty':'Protty Ruins', 'Repaire des Pirates':'Pirate Den',
  'Camp Rhutum':'Rhutum Camp', 'Ferme Shultz':'Shultz Farm', 'Colonie Sausan':'Sausan Colony',
  'Mine de Fer Abandonnée':'Abandoned Iron Mine', 'Poste Helm':'Helm Post',
  'Repaire Bandits Gahaz':'Gahaz Bandit Lair', 'Sanctuaire Elric':'Elric Shrine', 'Ruines de Kratuga':'Kratuga Ruins',
  'Planque des Mânes':'Manes\' Hideout',
  // 4e zone de chaque palier (2026-07-05, demande explicite) : complète la rotation avec la
  // boucle d'oreille manquante — reqAP/reqDP volontairement identiques à la dernière zone du
  // palier (voir le commentaire sur Planque des Mânes), aucun changement du plafond de stat
  'Ruines de Trent':'Trent Ruins', 'Île d\'Iliya':'Iliya Island', 'Base de Bashim':'Bashim Base', 'Forêt de Polly':'Polly Forest',
  // mobs
  'Loup':'Wolf', 'Esprit de Protty':'Protty Spirit', 'Pirate':'Pirate', 'Guerrier Rhutum':'Rhutum Warrior',
  'Garde Shultz':'Shultz Guard', 'Combattant Sausan':'Sausan Fighter', 'Mineur corrompu':'Corrupted Miner',
  'Soldat Helm':'Helm Soldier', 'Bandit Gahaz':'Gahaz Bandit', 'Sectateur d\'Elric':'Elric Cultist', 'Uluan':'Uluan',
  'Esprit des Mânes':'Manes Spirit',
  'Troll des Ruines':'Ruins Troll', 'Pirate d\'Iliya':'Iliya Pirate', 'Soldat de Bashim':'Bashim Soldier', 'Troll de Polly':'Polly Troll',
  // trash loot
  'Viande de loup':'Wolf Meat', "Lame rouillée d'Imp":"Rusty Imp Blade", 'Insigne de Sausan':'Sausan Badge',
  'Bourse de pirate':'Pirate Purse', 'Croc de Naga':'Naga Fang', 'Oreille de Fogan':'Fogan Ear',
  'Fer rouillé':'Rusted Iron', 'Fourrure de Biraghi':'Biraghi Fur', "Défense d'orc":'Orc Tusk',
  'Éclat de relique ancienne':'Ancient Relic Shard', "Relique d'Hystria":'Hystria Relic', 'Icône de Rhasia':'Rhasia Icon',
  'Larme de Mâne':'Manes\' Tear',
  'Pierre de Trent':'Trent Stone', 'Perle d\'Iliya':'Iliya Pearl', 'Insigne de Bashim':'Bashim Badge', 'Mousse de Polly':'Polly Moss',
  // notes de la table de loot
  'revenu de base':'base income', 'optimisation':'enhancement', 'arme/armure (5 pièces)':'weapon/armor (5 pieces)',
  'craft endgame':'endgame crafting',
  // matériaux
  'Pierre noire':'Black Stone', 'Éclat de cristal noir tranchant':'Sharp Black Crystal Shard',
  'Éclat de cristal noir dur':'Hard Black Crystal Shard', 'Poussière d\'esprit ancien':'Ancient Spirit Dust',
  'Pierre de Caphras':'Caphras Stone', 'Fragment de mémoire':'Memory Fragment', 'Marbre du Dieu déchu':'Fallen God\'s Marble',
  // bijoux (jackpot) — noms alignés sur les vrais objets BDO par palier de stuff le 2026-07-06
  'Anneau Naru':'Naru Ring', 'Collier Naru':'Naru Necklace', 'Ceinture Naru':'Naru Belt',
  'Anneau Tuvala':'Tuvala Ring', 'Collier Tuvala':'Tuvala Necklace', 'Ceinture Tuvala':'Tuvala Belt',
  'Anneau Asula':'Asula Ring', 'Collier Asula':'Asula Necklace', 'Ceinture Asula':'Asula Belt',
  'Anneau de Cadry':'Cadry Ring', 'Collier du Dieu déchu':'Fallen God\'s Necklace',
  // boucles d'oreille (2026-07-05) : complètent la rotation de bijoux de chaque palier (il ne
  // manquait que ce slot — voir ACC_SLOTS earring1/earring2, jusque-là jamais alimenté en jeu)
  'Boucle Naru':'Naru Earring', 'Boucle Tuvala':'Tuvala Earring', 'Boucle Asula':'Asula Earring', "Tungrad's Earring":"Tungrad's Earring",
  // gear sets
  'Grunil / Yuria':'Grunil / Yuria', 'Boss (Kzarka, Bheg, Urugon…)':'Boss (Kzarka, Bheg, Urugon…)',
  // badges de zone
  'ZONE DANGEREUSE':'DANGEROUS ZONE', 'ZONE DIFFICILE':'HARD ZONE', 'ZONE ADAPTÉE':'SUITABLE ZONE',
  'ZONE FACILE':'EASY ZONE', 'ZONE DÉPASSÉE':'TRIVIAL ZONE',
  'DANGEREUSE':'DANGEROUS', 'DIFFICILE':'HARD', 'ADAPTÉE':'SUITABLE', 'FACILE':'EASY', 'DÉPASSÉE':'TRIVIAL',
  // mode IA
  'équilibré':'balanced', 'défensif':'defensive', 'overgeared':'overgeared',
};
/** @param {string} s - texte FR d'origine (nom de zone/mob/objet). @returns {string} traduction EN via NAME_EN si LANG==='en', sinon le texte inchangé. */
function tr(s) { if (LANG !== 'en' || !s) return s; return NAME_EN[s] || s; }

// ZONES est desormais defini dans world/zones-data.js (extrait le 2026-07-08,
// reorganisation par dossiers) -- charge AVANT ce fichier, voir index.html.
let zoneIdx = 0;
// devient true une fois la vraie sauvegarde cloud chargée (ou d'emblée si Supabase n'est pas
// configuré) -- avant ça, S contient encore les valeurs par défaut (ex: lastLoyaltyDate vide),
// ce qui déclenchait à tort le cadeau de fidélité (et son toast) à CHAQUE connexion, avant même
// que la vraie sauvegarde n'arrive (bug remonté en jeu le 2026-07-05)
let saveReady = false;
let atVelia = false; // true quand le perso est à Velia (zone paisible, aucun monstre — voir goToVelia)
let autoOptTimer = null, autoOptTargetLvl = null; // optimisation automatique jusqu'à un palier choisi (voir startAutoOpt)
let lastLootEntry = null; // dernière ligne du loot ticker, pour fusionner les drops identiques consécutifs
const Z = () => ZONES[zoneIdx];

// ==================== ÉTAT GLOBAL ====================
const S = {
  silver: 0, kills: 0, lootCount: 0, lvl: 1, xp: 0, xpNext: 1, // xpNext = LEVEL_XP_TABLE[lvl] (voir gainXp)
  pa: 4, dp: 10,   // PA innée (le gros vient de l'arme équipée ci-dessous)
  castMult: 1, hpMax: 100, mpMax: 100, lootRadius: 26, // mpMax (2026-07-05) : réserve de mana, voir SKILLS[].mp et usePotionMana()
  bossesKilled: {}, // Compendium World Boss (2026-07-08) : { [bossId]: true } dès qu'un World Boss a été vaincu au moins une fois (voir compendiumBossCount)
  // pity + bonus "premier kill de la semaine" par boss (2026-07-19, adaptation du prompt roulette) :
  // bossPity = { [bossId]: nombre de kills consécutifs SANS drop rare (rareLoot) sur ce boss précis },
  // remis à 0 dès qu'un rareLoot est effectivement gagné -- voir PITY_LEGENDARY_THRESHOLD (boss.js).
  // bossLastKillWeek = { [bossId]: 'YYYY-Www' de la dernière semaine où CE boss a été tué } -- le
  // bonus "+50% première victoire de la semaine" ne compare qu'à CE boss, pas tous les boss confondus.
  bossPity: {}, bossLastKillWeek: {},
  // Mini Boss (2026-07-13, src/combat/miniboss.js) : compteurs de réputation locaux (groupes créés,
  // runs rejoints, quittes seul/déconnexion/vote, runs sans/avec incident) -- voir
  // minibossReputationScore()/minibossReputationSeverityScore() (combat/miniboss-data.js).
  minibossRep: { groupsCreated:0, runsJoined:0, soloQuits:0, disconnects:0, votes:0, runsClean:0, runsIncident:0 },
  penMastery: {}, // Compendium spécial "Maîtrise PEN" (2026-07-08) : { [itemName]: true } dès que cet objet a atteint PEN au moins une fois (voir markPenMastery)
  // Sceau du Conclave des Marchands (2026-07-13, trésor multi-région, voir CONCLAVE_SEAL_FRAGMENTS
  // world/region-tiers-data.js + progression/treasure-craft.js craftConclaveSeal) : flag permanent
  // posé à l'assemblage (objet unique par compte, non ré-vendable -- pas un item INV classique une
  // fois assemblé, même famille que S.penMastery/S.bossesKilled : un simple flag persisté).
  hasConclaveMarchandsSeal: false,
  // record PERMANENT des tierId (ZONE_TIERS) dont le fragment a contribué à l'assemblage -- lu
  // APRÈS assemblage (les fragments eux-mêmes sont consommés) pour calculer le passif "Réseau
  // Continental" (+2%/région, voir conclaveSealRegionalBonusPct, market.js). Pattern "record
  // monotone" (CLAUDE.md §4/§13), jamais recalculé depuis l'inventaire une fois assemblé.
  conclaveSealRegions: [],
  enhPeakByName: {}, // meilleur niveau d'optimisation JAMAIS atteint par nom d'objet (2026-07-15) : { [itemName]: enhLv }, voir trackEnhPeak -- survit à la vente de l'objet
  lootTableVersion: 'v2', // 'v1' (par zone, historique) ou 'v2' (taux fixe par palier, 2026-07-15) -- voir gearDropChance/jewelDropChance, réversible à tout moment via l'admin
  costPA: 60, costDP: 55, costCast: 90, costHP: 70, costLoot: 110,
  startTime: performance.now(), silverEarned: 0,
  // XP totale gagnée À VIE (2026-07-12, rattrapage hors-ligne XP) -- distinct de S.xp, qui se remet
  // à 0 à chaque passage de niveau (voir gainXp) : sans ce compteur cumulatif séparé, impossible de
  // calculer un "xp/h" de session fiable (S.xp seul redescendrait au milieu d'une fenêtre de mesure
  // dès qu'un level-up survient). Incrémenté uniquement dans gainXp() pour n>0, ne redescend jamais.
  xpEarned: 0,
  // baseline (silverEarned/kills au début de LA SESSION EN COURS), pour calculer un vrai "silver/h"
  // et "kills/min" de session — S.silverEarned et S.kills sont des compteurs À VIE (achievements
  // "gagne X silver au total" etc.) et ne doivent jamais être réinitialisés au chargement d'une
  // sauvegarde. C'est S.startTime qui posait problème : restauré tel quel depuis le cloud, il ne
  // correspond plus au performance.now() de la NOUVELLE page, ce qui pouvait diviser un
  // silverEarned à vie énorme par un temps quasi nul → chiffre astronomique (faux positif
  // anti-triche confirmé le 2026-07-06). Corrigé en réinitialisant startTime + ces baselines à
  // chaque chargement (voir applySaveState).
  silverEarnedAtLoad: 0, killsAtLoad: 0,
  // baseline de session pour xpEarned (même principe que silverEarnedAtLoad juste au-dessus) --
  // voir applySaveState() pour le moment exact où elle est (re)posée.
  xpEarnedAtLoad: 0,
  // "silver par heure" affiché (#shRate) = UNIQUEMENT le trash/token vendu au sol (2026-07-12,
  // demande explicite : "compté exclusivement par les silver recolté grace au token vendu") --
  // compteur À VIE séparé de silverEarned (qui reste global, toutes sources, pour les succès), voir
  // addSilver(). tokenSilverEarnedAtLoad = même principe de baseline de session que silverEarnedAtLoad.
  tokenSilverEarned: 0, tokenSilverEarnedAtLoad: 0,
  bestKpm: 0, // record personnel de kills/min À VIE (voir refreshStatsOnly) — sert au classement "🏹 Record kills/min"
  // record personnel de silver/h À VIE (2026-07-18, demande explicite : "le classement... toujours
  // le meilleur affiché" + "afficher valeur/min puis meilleure valeur/heure") -- même principe que
  // bestKpm : ne redescend jamais, calculé seulement au-delà de 2 min de session (voir hud()) pour
  // ne jamais figer un pic irréaliste (ex: gros loot ramassé 3s après le chargement -> extrapolé à
  // "1.5M/h", bug corrigé ce jour). C'est CETTE valeur (pas un recalcul à chaque sync) qui est
  // envoyée au classement (voir syncPlayerStats, game-supabase.js) -- un record ne fait que monter,
  // aucune synchronisation temps réel n'est donc nécessaire côté classement.
  bestSilverPerHour: 0,
  // record perso À VIE d'xp/h (2026-07-12, demande explicite : rattrapage hors-ligne XP) -- même
  // principe "record monotone" que bestSilverPerHour/bestKpm : ne redescend jamais, calculé
  // seulement au-delà de 2 min de session (voir hud()), sert de taux plat à
  // computeOfflineCatchupXp() pour créditer l'XP gagnée pendant une vraie absence (navigateur
  // fermé/veille OS), symétrique de bestSilverPerHour pour le silver.
  bestXpPerHour: 0,
  // records perso À VIE de Gearscore/PA/PD (2026-07-08, demande explicite : "Classement public :
  // meilleur uniquement pas en temps reel donc oublie la synchro, on veut juste le meilleur") --
  // GS()/apEff()/totalDP() reflètent l'équipement ACTUELLEMENT porté, qui peut redescendre (test
  // d'un stuff inférieur, outil admin, désenchantement...) : le classement doit montrer le pic
  // jamais atteint, pas un instantané qui pourrait fluctuer d'une synchro à l'autre. Voir hud()
  // pour la mise à jour et syncPlayerStats() (game-supabase.js) pour l'envoi au classement.
  bestGearscore: 0, bestAp: 0, bestDp: 0,
  // record perso À VIE de silver gagné en UNE session AFK (2026-07-10, modal de reconnexion) --
  // même principe "record monotone" que bestKpm/bestSilverPerHour : ne redescend jamais, mis à
  // jour uniquement dans showAwayLootSummaryIfAny() au moment de fermer une session.
  bestAfkSessionSilver: 0,
  maxZoneIdx: 0, playtimeSec: 0, lootByItem: {},
  // streak de connexion (2026-07-13, demande explicite -- implémenté pour de vrai dans le panneau
  // "Mon compte", écrase l'ancien commentaire "hors périmètre" qui figeait streak:0 en dur dans
  // showAwayLootSummaryIfAny()) : loginStreak = jours consécutifs, lastActiveDay = dernier jour
  // (YYYY-MM-DD, heure locale) où le streak a été compté. Mis à jour par updateLoginStreak(),
  // appelée depuis onAuthedInner() (game-supabase.js) après le chargement de la sauvegarde cloud.
  loginStreak: 0, lastActiveDay: null,
  enhAttempts: 0, travelCount: 0, jackpotCount: 0, gearDropCount: 0, enhSuccess: 0,
  achUnlocked: {}, dq: null, wq: null, questTrackerOn: false,
  loyalty: 0, lastLoyaltyDate: null, mailbox: [],
  notifLog: [], // centre de notifications (2026-07-08) : persisté (survit au reload/reconnexion), auto-purgé après 7 jours (voir pruneNotifLog)
  lastDeathAt: 0, // horodatage de la dernière mort — 0 = jamais mort (voir endBossFight, bonus "certifié sans mort")
  potionType: 'medium', // 'small'/'medium'/'large'/'mega' = potions payantes ; 'infinite' = gratuite (débloquée plus tard)
  farmMode: 'loot', // 'loot' = ramasse tout avant le pack suivant ; 'xp' = enchaîne les packs sans se soucier du loot
  // mode de combat IA choisi MANUELLEMENT par le joueur (2026-07-14, demande explicite : "ajoute
  // le fais de pouvoir changer l'ia manuellement" -- remplace l'ancien calcul auto via bottleneck()
  // de gear, voir aiMode()) : 'défensif' | 'équilibré' | 'overgeared'
  aiCombatMode: 'équilibré',
  potionThreshold: 0.5, // % de PV en dessous duquel l'IA boit une potion automatiquement (réglable via le slider)
  useCronStone: false, // 2026-07-06 : au choix du joueur (case à cocher) si elle protège une rétrogradation, plus automatique en silence -- désactivée par défaut (2026-07-10, demande explicite), le joueur l'active lui-même s'il en veut
};

// ==================== Silver/h en fenêtre glissante (anti-pic reconnexion, 2026-07-13) ====================
// S.bestSilverPerHour (record perso à vie, voir plus bas) était calculé sur tokenGain/(minutes de
// SESSION ENTIÈRE) -- fenêtre qui grandit en continu, donc un pic ponctuel (gros paquet de loot
// groupé, notamment juste après une reconnexion où plusieurs secondes/minutes de rattrapage
// tombent d'un coup) pouvait gonfler durablement le taux avant que la moyenne ne se lisse avec le
// temps. Remplacé par une fenêtre GLISSANTE de SILVER_RATE_WINDOW_MS (3 min) : silverRateBuffer
// accumule un échantillon {t,silver} à chaque gain de silver de catégorie 'loot' (addSilver plus
// bas -- même source que tokenSilverEarned, pas les gains ponctuels quête/succès/boss), purgé des
// entrées trop vieilles à chaque lecture (pruneSilverRateBuffer). computeSlidingSilverPerHour est
// une fonction PURE (buffer en entrée, aucune lecture de S/Date.now() implicite) pour rester
// testable sans dépendre du tick réel du jeu. Garde-fou anti-pic explicite EN PLUS de la fenêtre
// glissante : un taux qui dépasse de plus de SILVER_RATE_MAX_DEVIATION (30%) le record déjà établi
// n'est PAS éligible à devenir le nouveau record -- seule une hausse "de fond" (répartie sur toute
// la fenêtre) doit pouvoir faire monter le record, jamais un pic isolé. Le garde-fou "2 minutes de
// session minimum" (voir hud()) reste EN PLUS de tout ceci, pas remplacé (double protection).
const SILVER_RATE_WINDOW_MS = 180000; // 3 min
const SILVER_RATE_MAX_DEVIATION = 0.30; // 30%
// SILVER_RATE_MIN_SPAN_MS (2026-07-13, retour utilisateur : "ne mettre que les bonnes moyennes,
// pas des moyennes seulement à la connexion quand y'a beaucoup de mob") -- bug réel trouvé :
// windowMs (ci-dessous) s'appuyait sur l'ÉTALEMENT RÉEL des échantillons retenus, pas sur
// SILVER_RATE_WINDOW_MS lui-même. silverRateBuffer est transitoire (vidé à chaque reload) : juste
// après une reconnexion, une bourrasque de kills sur quelques secondes (zone dense en mobs)
// produisait un windowMs minuscule -- extrapolé sur 1h, un total de silver raisonnable sur 5s
// devenait un taux astronomique. Pire, si le joueur n'avait encore aucun record établi
// (currentBest=0), le garde-fou "30% du record" ne pouvait rien filtrer (case triviale). Fix :
// un taux n'est éligible que si l'étalement RÉEL des échantillons couvre au moins la moitié de
// SILVER_RATE_WINDOW_MS -- une bourrasque de quelques secondes reste visible en LIVE ($('shRate'))
// mais ne peut plus jamais devenir le record à vie, peu importe currentBest.
const SILVER_RATE_MIN_SPAN_MS = SILVER_RATE_WINDOW_MS / 2; // 90s
let silverRateBuffer = []; // [{t:ms epoch, silver:delta}] -- transient (pas sauvegardé), vidé au reload
/**
 * Fonction PURE : calcule le silver/h projeté à partir d'un buffer d'échantillons {t,silver}
 * (silver gagné, catégorie 'loot' uniquement) et détermine si ce taux est éligible à devenir le
 * nouveau record (comparé à currentBest, S.bestSilverPerHour).
 * @param {{t:number,silver:number}[]} buffer - échantillons horodatés (ms epoch), jamais muté.
 * @param {number} now - horodatage de référence (ms epoch), typiquement Date.now().
 * @param {number} currentBest - record déjà établi (S.bestSilverPerHour), 0 si aucun encore.
 * @returns {{ratePerHour:number, eligible:boolean}} taux projeté sur la fenêtre + éligibilité record.
 */
function computeSlidingSilverPerHour(buffer, now, currentBest) {
  const pruned = (buffer||[]).filter(s => (now - s.t) <= SILVER_RATE_WINDOW_MS && (now - s.t) >= 0);
  if (pruned.length === 0) return { ratePerHour: 0, eligible: false };
  const oldestT = pruned.reduce((min, s) => Math.min(min, s.t), now);
  const windowMs = Math.max(now - oldestT, 1000); // évite une quasi-division par 0 sur un tout premier échantillon
  const total = pruned.reduce((sum, s) => sum + s.silver, 0);
  const ratePerHour = total / (windowMs / 3600000);
  let eligible = windowMs >= SILVER_RATE_MIN_SPAN_MS; // bourrasque trop courte (ex: à la connexion) -- jamais éligible
  if (eligible && currentBest > 0) {
    const deviation = (ratePerHour - currentBest) / currentBest;
    if (deviation > SILVER_RATE_MAX_DEVIATION) eligible = false; // pic isolé -- ignoré pour le record
  }
  return { ratePerHour, eligible };
}
/** Purge silverRateBuffer (mutation en place) des échantillons plus vieux que SILVER_RATE_WINDOW_MS. */
function pruneSilverRateBuffer(now) {
  now = now || Date.now();
  while (silverRateBuffer.length && (now - silverRateBuffer[0].t) > SILVER_RATE_WINDOW_MS) silverRateBuffer.shift();
}

// ==================== Kills/min en fenêtre glissante (même correctif que silver/h, 2026-07-13) ====================
// S.bestKpm était calculé sur (S.kills-S.killsAtLoad)/(minutes de SESSION ENTIÈRE) -- même famille
// de bug que l'ancien bestSilverPerHour (fenêtre qui grandit en continu, un pic ponctuel de kills
// juste après une reconnexion pouvait gonfler durablement la moyenne avant qu'elle ne se lisse).
// Demande explicite : "revoir aussi la formule best kpm, pareil sur 3 minutes avec 30% de
// variation max, on enlève les gros pics, on reset aussi ce classement" -- même traitement que
// SILVER_RATE_* juste au-dessus (fenêtre glissante 3 min, garde-fou étalement minimum 90s, garde-fou
// anti-pic 30%), constantes/buffer séparés par choix (pas de fusion avec silverRateBuffer, éviter
// tout risque de régression sur du code déjà testé).
const KPM_RATE_WINDOW_MS = 180000; // 3 min
const KPM_RATE_MAX_DEVIATION = 0.30; // 30%
const KPM_RATE_MIN_SPAN_MS = KPM_RATE_WINDOW_MS / 2; // 90s
let kpmRateBuffer = []; // [{t:ms epoch, kills:1}] -- transient (pas sauvegardé), vidé au reload, 1 échantillon par kill
/**
 * Fonction PURE : calcule le kills/min projeté à partir d'un buffer d'échantillons {t,kills} et
 * détermine si ce taux est éligible à devenir le nouveau record (comparé à currentBest, S.bestKpm).
 * Même formule/mêmes garde-fous que computeSlidingSilverPerHour (voir son commentaire), sur des
 * kills au lieu de silver et un taux par MINUTE (pas par heure).
 * @param {{t:number,kills:number}[]} buffer - échantillons horodatés (ms epoch), jamais muté.
 * @param {number} now - horodatage de référence (ms epoch), typiquement Date.now().
 * @param {number} currentBest - record déjà établi (S.bestKpm), 0 si aucun encore.
 * @returns {{ratePerMin:number, eligible:boolean}} taux projeté sur la fenêtre + éligibilité record.
 */
function computeSlidingKpm(buffer, now, currentBest) {
  const pruned = (buffer||[]).filter(s => (now - s.t) <= KPM_RATE_WINDOW_MS && (now - s.t) >= 0);
  if (pruned.length === 0) return { ratePerMin: 0, eligible: false };
  const oldestT = pruned.reduce((min, s) => Math.min(min, s.t), now);
  const windowMs = Math.max(now - oldestT, 1000);
  const total = pruned.reduce((sum, s) => sum + s.kills, 0);
  const ratePerMin = total / (windowMs / 60000);
  let eligible = windowMs >= KPM_RATE_MIN_SPAN_MS;
  if (eligible && currentBest > 0) {
    const deviation = (ratePerMin - currentBest) / currentBest;
    if (deviation > KPM_RATE_MAX_DEVIATION) eligible = false;
  }
  return { ratePerMin, eligible };
}
/** Purge kpmRateBuffer (mutation en place) des échantillons plus vieux que KPM_RATE_WINDOW_MS. */
function pruneKpmRateBuffer(now) {
  now = now || Date.now();
  while (kpmRateBuffer.length && (now - kpmRateBuffer[0].t) > KPM_RATE_WINDOW_MS) kpmRateBuffer.shift();
}

// ==================== XP/h en fenêtre glissante (même correctif que silver/h et kpm, 2026-07-13) ====================
// S.bestXpPerHour était calculé sur (S.xpEarned-S.xpEarnedAtLoad)/(minutes de SESSION ENTIÈRE) --
// même famille de bug : un gros paquet d'XP juste après une reconnexion pouvait gonfler durablement
// la moyenne avant qu'elle ne se lisse. Demande explicite (2026-07-13, suite du fix kpm) : même
// traitement que SILVER_RATE_*/KPM_RATE_* (fenêtre glissante 3 min, garde-fou étalement minimum
// 90s, garde-fou anti-pic 30%), constantes/buffer séparés par choix (pas de fusion, éviter tout
// risque de régression sur silver/kpm déjà testés).
const XP_RATE_WINDOW_MS = 180000; // 3 min
const XP_RATE_MAX_DEVIATION = 0.30; // 30%
const XP_RATE_MIN_SPAN_MS = XP_RATE_WINDOW_MS / 2; // 90s
let xpRateBuffer = []; // [{t:ms epoch, xp:delta}] -- transient (pas sauvegardé), vidé au reload, 1 échantillon par gainXp(n>0)
/**
 * Fonction PURE : calcule le xp/h projeté à partir d'un buffer d'échantillons {t,xp} et détermine
 * si ce taux est éligible à devenir le nouveau record (comparé à currentBest, S.bestXpPerHour).
 * Même formule/mêmes garde-fous que computeSlidingSilverPerHour (voir son commentaire), sur de
 * l'XP au lieu de silver.
 * @param {{t:number,xp:number}[]} buffer - échantillons horodatés (ms epoch), jamais muté.
 * @param {number} now - horodatage de référence (ms epoch), typiquement Date.now().
 * @param {number} currentBest - record déjà établi (S.bestXpPerHour), 0 si aucun encore.
 * @returns {{ratePerHour:number, eligible:boolean}} taux projeté sur la fenêtre + éligibilité record.
 */
function computeSlidingXpPerHour(buffer, now, currentBest) {
  const pruned = (buffer||[]).filter(s => (now - s.t) <= XP_RATE_WINDOW_MS && (now - s.t) >= 0);
  if (pruned.length === 0) return { ratePerHour: 0, eligible: false };
  const oldestT = pruned.reduce((min, s) => Math.min(min, s.t), now);
  const windowMs = Math.max(now - oldestT, 1000);
  const total = pruned.reduce((sum, s) => sum + s.xp, 0);
  const ratePerHour = total / (windowMs / 3600000);
  let eligible = windowMs >= XP_RATE_MIN_SPAN_MS;
  if (eligible && currentBest > 0) {
    const deviation = (ratePerHour - currentBest) / currentBest;
    if (deviation > XP_RATE_MAX_DEVIATION) eligible = false;
  }
  return { ratePerHour, eligible };
}
/** Purge xpRateBuffer (mutation en place) des échantillons plus vieux que XP_RATE_WINDOW_MS. */
function pruneXpRateBuffer(now) {
  now = now || Date.now();
  while (xpRateBuffer.length && (now - xpRateBuffer[0].t) > XP_RATE_WINDOW_MS) xpRateBuffer.shift();
}

// point d'entrée UNIQUE pour toute variation de silver côté client (2026-07-10, demande explicite :
// "toute modification de silver doit être écrit dans ce registre... je dois pouvoir traquer le
// moindre silver") -- centralise S.silver/S.silverEarned ET la journalisation (voir
// queueSilverLedger, game-supabase.js), pour ne plus jamais pouvoir modifier l'un sans l'autre.
// category : identifiant court et STABLE (ex: 'loot','potion','sell','quest','achievement',
// 'welcome','admin_test') -- alimente l'onglet Admin "Silver" (tableau + graphique par catégorie).
/**
 * Point d'entrée UNIQUE pour toute variation de silver côté client — centralise S.silver/
 * S.silverEarned ET la journalisation (queueSilverLedger).
 * @param {number} delta - variation de silver (positive = gain, négative = dépense).
 * @param {string} category - identifiant court et STABLE ('loot','potion','sell','quest',
 *   'achievement','welcome','admin_test'...), alimente l'onglet Admin Silver.
 * @param {string} [note] - contexte libre, transmis tel quel à queueSilverLedger.
 */
function addSilver(delta, category, note) {
  if (!delta) return;
  S.silver += delta;
  if (delta > 0) S.silverEarned += delta;
  if (delta > 0 && document.hidden) awaySilverGained += delta;
  // "silver par heure" (2026-07-12, demande explicite : "compté exclusivement par les silver
  // recolté grace au token vendu") -- S.silverEarned (au-dessus) reste un compteur GLOBAL À VIE
  // (toutes sources : quêtes, succès, boss, marché...), utilisé pour les succès/classements. Le
  // HUD "silver/h" (#shRate) doit lui refléter UNIQUEMENT le revenu du trash (token) au sol, pas
  // le loot occasionnel de gros montants (succès/boss/quêtes) qui fausserait la lecture du rythme
  // de farm réel -- voir dropsTick, seul endroit qui appelle addSilver avec category:'loot'.
  if (delta > 0 && category === 'loot') {
    S.tokenSilverEarned = (S.tokenSilverEarned||0) + delta;
    // fenêtre glissante 3 min pour le record silver/h à vie (voir computeSlidingSilverPerHour
    // ci-dessus) -- même source que tokenSilverEarned, pas les gains ponctuels quête/succès/boss.
    silverRateBuffer.push({ t: Date.now(), silver: delta });
  }
  if (typeof queueSilverLedger === 'function') queueSilverLedger(delta, category, note);
}
/**
 * Suit combien de fois chaque objet a été ramassé (pour "meilleur objet farmé" dans le
 * classement), et accumule dans awayLootCounts si l'onglet est en arrière-plan (résumé au retour).
 * @param {string} name - nom de l'objet ramassé.
 * @param {string} color - couleur d'affichage (utilisée par le résumé au retour).
 * @param {number} val - valeur silver de référence (sert à trouver le "meilleur drop").
 * @param {string} kind - catégorie de l'objet ('trash', 'gear', 'jewel'...).
 */
function trackLoot(name, color, val, kind) {
  S.lootByItem[name] = (S.lootByItem[name]||0) + 1;
  if (document.hidden) {
    if (!awayLootCounts[name]) awayLootCounts[name] = { qty: 0, color: color || '#c9a55a', val: val||0, kind };
    awayLootCounts[name].qty++;
    if ((val||0) > awayLootCounts[name].val) awayLootCounts[name].val = val;
  }
}
/** @returns {{name:string, count:number}|null} objet le plus ramassé (S.lootByItem), ou null si aucun loot. */
function bestFarmedItem() {
  let best = null, bestN = 0;
  for (const name in S.lootByItem) if (S.lootByItem[name] > bestN) { best = name; bestN = S.lootByItem[name]; }
  return best ? { name: best, count: bestN } : null;
}

// Résumé du loot au retour (2026-07-10, demande explicite : "Afficher un résumé du loot, au
// retour") -- le jeu continue de simuler farm/loot pendant que l'onglet est en arrière-plan
// (setInterval de secours, voir plus bas dans ce fichier — décision V317/V-2026-07-15), mais
// jusqu'ici rien ne récapitulait ce qui s'était passé pendant l'absence. awaySilverGained/
// awayLootCounts accumulent UNIQUEMENT pendant document.hidden (remis à 0 à chaque nouvelle
// mise en arrière-plan), affichés dans le centre de notifications dès que l'onglet redevient
// visible. `document.hidden` (pas isOffline) est le bon signal ici : la simulation continue
// même sans coupure réseau, "au retour" = retour sur l'onglet, pas forcément retour du réseau.
let awaySilverGained = 0;
let awayLootCounts = {};
let awayXpGained = 0;
let awaySessionStartedAt = null;
let awayLevelBefore = 1, awayPercentBefore = 0;
// rattrapage hors-ligne "réel" (2026-07-11, demande explicite : "le modal qui calcule le farm hors
// ligne, je le vois pas quand on se reconnecte") -- awaySilverGained/awayLootCounts ci-dessus
// n'avancent QUE tant que l'onglet reste ouvert quelque part (rAF visible + le setInterval de
// secours en arrière-plan, voir plus bas dans ce fichier) : fermer le navigateur ou une mise en
// veille OS arrête ces timers, donc au chargement suivant ces variables valent encore 0 et le
// modal ne s'affichait JAMAIS, même après une vraie absence. computeOfflineCatchupSilver()
// (appelée depuis applySaveState) comble ce cas précis avec un taux plat (pas de simulation tick
// par tick), même principe que le rattrapage hors-ligne du module Compagnons
// (src/companions/save.js, applyOfflineProgress/OFFLINE_CAP_HOURS) : plafonné à
// OFFLINE_CATCHUP_CAP_HOURS, ignoré sous OFFLINE_CATCHUP_MIN_HOURS (bruit d'un simple changement
// d'onglet, déjà couvert par visibilitychange ci-dessous). Utilise S.bestSilverPerHour DE LA
// SAUVEGARDE CHARGÉE (record perso à vie, déjà isolé au seul revenu du trash au sol -- voir son
// commentaire plus bas, section hud()) comme taux. XP désormais simulée aussi (2026-07-12, demande
// explicite : revient sur la décision précédente) via computeOfflineCatchupXp()/S.bestXpPerHour,
// même principe exact -- taux plat, mêmes seuils/plafond. Loot (objets) désormais simulé aussi
// (2026-07-13, demande explicite : "la 0 en 5min c'est pas possible", annule la décision précédente
// figée juste au-dessus) via computeOfflineCatchupLoot() : ESPÉRANCE mathématique (kills équivalents
// = bestKpm × durée, puis qty = kills × chance de drop par kill de la table de loot RÉELLE de la
// zone où le joueur était), pas un taux/h à un seul nombre ni une simulation tick par tick -- même
// philosophie "expected-value, flat-rate" que applyOfflineProgress du module Compagnon pour
// Caphras/Dopi. Les objets estimés sont réellement ajoutés à INV (comme le silver via addSilver),
// pas juste affichés dans le modal. Le clamp anti-triche serveur (clamp_player_stats(), CLAUDE.md
// §12) reste le filet de sécurité si un taux était anormalement élevé.
const OFFLINE_CATCHUP_CAP_HOURS = 24;
const OFFLINE_CATCHUP_MIN_HOURS = 0.05; // ~3 min
// "Phase 2" (2026-07-14, demande explicite du owner, "illimité tant que le compte existe") : un
// cron SERVEUR horaire (credit_offline_progress_hourly(), voir
// supabase/migrations/20260722120000_offline_progress_hourly_cron.sql) crédite désormais aussi ce
// même rattrapage (silver/XP/loot) pendant que le navigateur est complètement fermé, sans plafond
// de durée -- ce bloc ci-dessous (Phase 1, 100% client) reste inchangé dans son fonctionnement,
// mais doit maintenant éviter de RECOMPTER des heures déjà créditées côté serveur. Le serveur écrit
// un horodatage `last_server_credit_at` (nouvelle colonne game_saves, séparée de save_data --
// jamais écrasée par un upsert client qui ne fournit que {user_id, save_data}), synchronisé vers le
// client par loadCloudSave() (backend/game-supabase.js, qui l'attache à `data.lastServerCreditAt`
// avant d'appeler applySaveState). computeOfflineElapsedHours() utilise désormais le PLUS RÉCENT de
// data.savedAt et data.lastServerCreditAt comme point de départ -- si le cron serveur vient de
// créditer une heure, Phase 1 ne recompte que le temps écoulé DEPUIS ce crédit serveur, jamais
// depuis le dernier vrai enregistrement client.
/**
 * Nombre d'heures RÉELLEMENT écoulées hors-ligne, plafonné/filtré par les mêmes seuils que tout le
 * rattrapage hors-ligne (silver/XP/loot) -- factorisé ici pour que les 3 rattrapages partagent
 * EXACTEMENT la même fenêtre de temps (pas de plafond séparé à inventer par flux, voir CLAUDE.md
 * §34 et la demande explicite du 2026-07-13 pour le loot). Voir aussi le commentaire juste au-dessus
 * (Phase 2, 2026-07-14) : la baseline est le PLUS RÉCENT de data.savedAt et
 * data.lastServerCreditAt, pour ne jamais recompter un gap déjà crédité par le cron serveur.
 * @param {object} data - sauvegarde chargée, lit data.savedAt et data.lastServerCreditAt.
 * @returns {number} heures écoulées (0 à OFFLINE_CATCHUP_CAP_HOURS), 0 si absent/négatif/sous OFFLINE_CATCHUP_MIN_HOURS.
 */
function computeOfflineElapsedHours(data) {
  if (!data || !data.savedAt) return 0;
  const savedAtMs = Date.parse(data.savedAt);
  const serverCreditMs = data.lastServerCreditAt ? Date.parse(data.lastServerCreditAt) : NaN;
  const baselineMs = (!isNaN(serverCreditMs) && serverCreditMs > savedAtMs) ? serverCreditMs : savedAtMs;
  const elapsedMs = Date.now() - baselineMs;
  if (!(elapsedMs > 0)) return 0;
  const hours = Math.min(elapsedMs / 3600000, OFFLINE_CATCHUP_CAP_HOURS);
  if (hours < OFFLINE_CATCHUP_MIN_HOURS) return 0;
  return hours;
}
/**
 * Rattrapage silver pour le temps réellement écoulé hors-ligne (navigateur fermé/veille OS),
 * complément du rattrapage "onglet en arrière-plan" (awaySilverGained). Taux plat = record perso
 * bestSilverPerHour de la sauvegarde chargée, pas de simulation tick par tick.
 * @param {object} data - sauvegarde chargée, lit data.savedAt et data.S.bestSilverPerHour.
 * @returns {number} silver à créditer, 0 si aucun taux connu ou absence sous OFFLINE_CATCHUP_MIN_HOURS.
 */
function computeOfflineCatchupSilver(data) {
  const rate = (data && data.S && data.S.bestSilverPerHour) || 0;
  if (rate <= 0) return 0;
  const hours = computeOfflineElapsedHours(data);
  if (hours <= 0) return 0;
  return Math.round(rate * hours);
}
/**
 * Rattrapage XP pour le temps réellement écoulé hors-ligne, calqué exactement sur
 * computeOfflineCatchupSilver() (mêmes seuils/plafond, mêmes garde-fous) mais lit
 * data.S.bestXpPerHour à la place. Ajouté le 2026-07-12 sur demande explicite — annule la décision
 * précédente ("XP volontairement pas simulée", voir commentaire au-dessus de
 * OFFLINE_CATCHUP_CAP_HOURS pour l'historique).
 * @param {object} data - sauvegarde chargée, lit data.savedAt et data.S.bestXpPerHour.
 * @returns {number} XP à créditer, 0 si aucun taux connu ou absence sous OFFLINE_CATCHUP_MIN_HOURS.
 */
function computeOfflineCatchupXp(data) {
  const rate = (data && data.S && data.S.bestXpPerHour) || 0;
  if (rate <= 0) return 0;
  const hours = computeOfflineElapsedHours(data);
  if (hours <= 0) return 0;
  return Math.round(rate * hours);
}
/**
 * Rattrapage LOOT (objets, pas juste silver) pour le temps réellement écoulé hors-ligne (2026-07-13,
 * demande explicite : "la 0 en 5min c'est pas possible" -- le modal affichait du silver gagné mais
 * 0 objet). Contrairement à computeOfflineCatchupSilver/Xp (un seul taux/h connu), un objet loot
 * dépend de la ZONE -- utilise donc la table de loot RÉELLE de la zone où le joueur se trouvait à
 * la fermeture (data.zoneIdx, voir rollDrops/loot-rolls.js pour la même table) + le record perso
 * kills/min (data.S.bestKpm) pour estimer un nombre de kills équivalent sur la durée hors-ligne.
 * ESPÉRANCE mathématique (qty = kills × chance de drop par kill), PAS un tirage aléatoire objet par
 * objet -- même philosophie "taux plat/espérance" que applyOfflineProgress du module Compagnon
 * (src/companions/save.js) pour Caphras/Dopi. Le trash (kind:'trash') est volontairement exclu :
 * déjà couvert par computeOfflineCatchupSilver (tokenSilverEarned = revenu du trash au sol), un
 * doublon ici compterait deux fois le même revenu sous 2 formes différentes.
 * @param {object} data - sauvegarde chargée, lit data.savedAt, data.S.bestKpm, data.zoneIdx.
 * @returns {{name:string,qty:number,val:number,color:string,icon:string,kind:string,key:string,stackable:true,weight:number}[]}
 *   liste d'objets à créditer (qty déjà arrondie à l'entier, jamais 0), [] si rien d'estimable.
 */
function computeOfflineCatchupLoot(data) {
  const kpm = (data && data.S && data.S.bestKpm) || 0;
  if (kpm <= 0) return [];
  const hours = computeOfflineElapsedHours(data);
  if (hours <= 0) return [];
  const zi = (data && data.zoneIdx) || 0;
  const zone = typeof ZONES !== 'undefined' ? ZONES[zi] : null;
  if (!zone || !zone.loot) return [];
  const kills = kpm * hours * 60;
  if (!(kills > 0)) return [];
  const tier = (typeof gearTierForZone === 'function') ? gearTierForZone(zi) : null;
  const tierMat = tier && tier.material;
  const L = zone.loot;
  const candidates = [];
  // matériau d'optimisation : même substitution que rollDrops (loot-rolls.js) -- l'icône/couleur
  // viennent du PALIER de stuff (tierMat), la chance/valeur de la table de zone (L.mat).
  if (tierMat && L.mat) candidates.push({ name: tierMat.name, ch: L.mat.ch||0, val: L.mat.val||0, color: tierMat.color, icon: tierMat.icon, kind:'material', key:'mat_'+tierMat.name });
  if (L.craft) candidates.push({ name: L.craft.name, ch: L.craft.ch||0, val: 0, color:'#b48ce8', icon:'✦', kind:'craft', key:'craft_'+L.craft.name });
  const results = [];
  for (const c of candidates) {
    const qty = Math.floor(kills * c.ch);
    if (qty > 0) results.push({ name:c.name, qty, val:c.val, color:c.color, icon:c.icon, kind:c.kind, key:c.key, stackable:true, weight:0.1 });
  }
  return results;
}
/** @returns {string} date du jour en heure LOCALE, format YYYY-MM-DD (pas UTC -- toISOString() déciderait le changement de jour au mauvais moment pour la plupart des fuseaux). */
function localDayKey(d) {
  d = d || new Date();
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
/**
 * Streak de connexion (2026-07-13, demande explicite, implémenté pour de vrai dans le panneau
 * "Mon compte" -- voir CLAUDE.md section dédiée). Taux plat par jour civil LOCAL, pas de fenêtre
 * glissante de 24h : comparer S.lastActiveDay au jour d'aujourd'hui.
 *   - même jour -> ne rien faire (déjà compté aujourd'hui)
 *   - hier -> streak+1
 *   - gap de 2+ jours, ou jamais connecté (lastActiveDay null) -> streak remis à 1
 * Appelée depuis onAuthedInner() (game-supabase.js), après le chargement de la sauvegarde cloud
 * (S.lastActiveDay doit déjà refléter la sauvegarde restaurée, pas l'état par défaut).
 * Pure sur son entrée sauf l'écriture dans S (mêmes conventions que le reste du fichier).
 */
function updateLoginStreak() {
  const today = localDayKey();
  if (S.lastActiveDay === today) return; // déjà compté aujourd'hui
  if (S.lastActiveDay) {
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (S.lastActiveDay === localDayKey(y)) S.loginStreak = (S.loginStreak || 0) + 1;
    else S.loginStreak = 1; // gap de 2+ jours
  } else {
    S.loginStreak = 1; // première connexion jamais comptée
  }
  S.lastActiveDay = today;
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    awaySilverGained = 0; awayLootCounts = {}; awayXpGained = 0;
    awaySessionStartedAt = Date.now();
    awayLevelBefore = S.lvl; awayPercentBefore = Math.round(S.xp / S.xpNext * 100);
  } else showAwayLootSummaryIfAny();
});
// 2026-07-10 : remplace l'ancien toast/modale texte (showResetNotice) par le vrai modal de
// reconnexion React (src/core/reconnect-modal-react.js, exception documentée CLAUDE.md §7) --
// même déclencheur (visibilitychange), mais montre désormais niveau avant/après, détail des
// objets (couleur réelle par palier), record perso À VIE (bestAfkSessionSilver) et l'historique
// des sessions passées (Supabase, get_afk_history). Ne se déclenche que s'il s'est VRAIMENT passé
// quelque chose (silver ou item), comme avant.
/**
 * Affiche le modal de reconnexion ("Bon retour") si du silver/loot s'est accumulé pendant que
 * l'onglet était en arrière-plan (awaySilverGained/awayLootCounts) — no-op sinon. Bascule le
 * record perso bestAfkSessionSilver si dépassé, journalise la session (recordAfkSession), puis
 * remet les compteurs "away" à zéro.
 */
function showAwayLootSummaryIfAny() {
  // awayXpGained ajouté à la garde (2026-07-12, rattrapage hors-ligne XP) : sans lui, un rattrapage
  // qui ne créditerait QUE de l'XP (bestSilverPerHour=0 mais bestXpPerHour>0, cas rare mais possible)
  // sortirait ici silencieusement et le modal ne s'afficherait jamais.
  if (awaySilverGained <= 0 && awayXpGained <= 0 && Object.keys(awayLootCounts).length === 0) return;
  if (typeof openReconnectModal !== 'function' || !$a('reconnectModalRoot')) {
    // repli si le fichier React n'a pas pu charger (CDN indispo) -- garde un minimum d'info visible
    if (typeof showResetNotice === 'function') {
      showResetNotice('🎁', i18next.t('core:core.away.title'),
        `+${awaySilverGained.toLocaleString(LANG==='fr'?'fr-FR':'en-US')} silver`);
    }
    awaySilverGained = 0; awayLootCounts = {}; awayXpGained = 0; return;
  }
  const items = Object.entries(awayLootCounts)
    .sort((a,b) => b[1].qty - a[1].qty)
    .map(([name, v]) => ({ name, qty: v.qty, color: v.color, val: v.val, kind: v.kind }));
  let bestDrop = null;
  for (const it of items) if (it.kind !== 'trash' && (!bestDrop || it.val > bestDrop.val)) bestDrop = it;
  const grade = (typeof GEAR_TIERS !== 'undefined' && GEAR_TIERS.find(g => g.zones.includes(zoneIdx))?.grade) || 'grey';
  const percentNow = Math.round(S.xp / S.xpNext * 100);
  if (awaySilverGained > S.bestAfkSessionSilver) S.bestAfkSessionSilver = awaySilverGained;

  openReconnectModal({
    pseudo: (typeof myPseudo !== 'undefined' && myPseudo) || i18next.t('core:core.default_pseudo'),
    streak: S.loginStreak || 0, streakGoal: 7, // streak de connexion réelle (voir updateLoginStreak() plus haut, S.loginStreak)
    awayLabel: reconnectDurationLabel(new Date(awaySessionStartedAt || Date.now()), new Date()),
    silver: awaySilverGained, xp: awayXpGained,
    levelBefore: awayLevelBefore, percentBefore: awayPercentBefore,
    levelNow: S.lvl, percentNow,
    items, bestDropName: bestDrop ? bestDrop.name : null, bestDropColor: bestDrop ? bestDrop.color : null,
    personalRecordSilver: S.bestAfkSessionSilver,
  });

  if (typeof recordAfkSession === 'function') {
    recordAfkSession({
      startedAt: new Date(awaySessionStartedAt || Date.now()).toISOString(),
      endedAt: new Date().toISOString(),
      silver: awaySilverGained, xp: awayXpGained,
      levelBefore: awayLevelBefore, levelNow: S.lvl,
      zoneName: (typeof ZONES !== 'undefined' && ZONES[zoneIdx] && ZONES[zoneIdx].name) || null,
      gearGrade: grade,
      items: items.map(it => ({ name: it.name, color: it.color, qty: it.qty })),
      bestDropName: bestDrop ? bestDrop.name : null, bestDropColor: bestDrop ? bestDrop.color : null,
    });
  }

  awaySilverGained = 0; awayLootCounts = {}; awayXpGained = 0;
}

// Icones SVG (svgIcon, shadeHex, ICO_MAT_*, ICO_CRON_STONE, CRON_STONE, JEWEL_TIER_IDX,
// cronStoneCostForItem...) desormais dans inventory/gear-icons.js (extrait le 2026-07-08,
// reorganisation par dossiers) -- charge AVANT ce fichier, voir index.html.

// ==================== INVENTAIRE (192 slots) & ÉQUIPEMENT ====================
const INV_SIZE = 192;
const INV = new Array(INV_SIZE).fill(null);   // chaque slot : null | { key, name, kind, icon, color, qty, unit, val, weight, ap, dp }
// relevé de 9999 à 999999 (2026-07-10, rapporté explicitement : "pourquoi on peut se retrouver
// avec plusieurs stack d'une meme ressources") -- invAdd() (plus bas) ne fusionne dans un stack
// existant que si qty < MAX_STACK ; contrairement au Trésor de Velia (TREASURE_STACK_CAP +
// enforceTreasureStackCap, treasure-craft.js, qui auto-vend l'excédent), les matériaux/craft
// normaux (Pierre de Novice, Fragment de mémoire...) n'ont aucun filet — sur une session de farm
// longue, un stack plein forçait la création d'un 2e/3e stack séparé, consommant des cases du sac
// (192 max) sans raison. fmt() (plus bas) affiche déjà correctement les grands nombres (suffixe k/M).
const MAX_STACK = 999999;
// Sac "Compendium" (2026-07-08, demande explicite) : même taille que le sac principal (192 cases).
// Quand "Vendre" s'apprête à vendre une pièce d'équipement/bijou dont ce TYPE n'a JAMAIS atteint
// PEN (voir S.penMastery), un exemplaire est déposé ici au lieu d'être vendu — pour ne jamais perdre
// la chance de le monter en PEN plus tard. Toujours le PLUS ENCHANTÉ des exemplaires possédés (voir
// ensureCompendiumProtection, 2026-07-09) : un exemplaire plus enchanté trouvé dans le sac principal
// prend automatiquement la place de celui déjà protégé (souvent un +0), qui retourne dans le sac
// principal — jamais perdu ni détruit.
const COMPENDIUM_BAG = new Array(INV_SIZE).fill(null);
/** @param {string} name. @returns {boolean} vrai si un objet de ce nom est déjà protégé dans COMPENDIUM_BAG. */
function compendiumBagHasName(name) { return COMPENDIUM_BAG.some(s => s && s.name === name); }
// Coffre de ville (2026-07-16, demande explicite : "on ajoute un onglet coffre lié a la ville
// 20/192 emplacement le reste bloqué") -- rangement personnel séparé du sac principal, même taille
// que lui pour une future extension, mais seuls les 20 premiers emplacements sont utilisables pour
// l'instant (les suivants restent verrouillés 🔒, comme les futures cases RNG/Consommable ailleurs).
const VELIA_CHEST = new Array(INV_SIZE).fill(null);
const VELIA_CHEST_OPEN = 20;
/** @param {object} obj - item à protéger (copié, pas référencé). @returns {boolean} vrai si placé, faux si COMPENDIUM_BAG plein. */
function compendiumBagAdd(obj) {
  const idx = COMPENDIUM_BAG.findIndex(s => s === null);
  if (idx === -1) return false;
  COMPENDIUM_BAG[idx] = { ...obj };
  return true;
}
// filet de sécurité : après une VENTE (sellOne/sellStack, jamais "Jeter") qui touche du gear/jackpot,
// garantit que le sac protégé du Compendium contient toujours le PLUS ENCHANTÉ des exemplaires
// possédés de ce nom tant qu'il n'a jamais atteint PEN (2026-07-09, demande explicite : "l'item
// optimisé qui part dans le compendium à la place du +0, garde son optimisation"). Si un exemplaire
// du sac principal est plus enchanté que celui déjà protégé, il PREND SA PLACE (swap) — l'ancien
// exemplaire protégé (souvent un +0) retourne dans le sac principal, jamais perdu ni détruit. Ne
// touche JAMAIS l'équipement porté (demande explicite) — uniquement le sac principal.
/**
 * Filet de sécurité appelé après une VENTE (jamais "Jeter") touchant du gear/jackpot : garantit
 * que COMPENDIUM_BAG contient toujours le PLUS ENCHANTÉ des exemplaires possédés de ce nom, tant
 * qu'il n'a jamais atteint PEN. Si le sac principal a un exemplaire plus enchanté que celui déjà
 * protégé, échange les deux (l'ancien retourne en sac principal, jamais perdu). Ne touche jamais
 * l'équipement porté, uniquement le sac principal.
 * @param {string} name - nom de l'objet (gear/jackpot) à vérifier.
 */
function ensureCompendiumProtection(name) {
  if (!name || S.penMastery[name]) return;
  const curIdx = COMPENDIUM_BAG.findIndex(s => s && s.name === name);
  const current = curIdx !== -1 ? COMPENDIUM_BAG[curIdx] : null;
  let bestIdx = -1, bestEnh = current ? (current.enhLv || 0) : -1;
  for (let i = 0; i < INV_SIZE; i++) {
    const it = INV[i];
    if (!it || it.name !== name || (it.kind !== 'gear' && it.kind !== 'jackpot')) continue;
    const enh = it.enhLv || 0;
    if (enh > bestEnh) { bestEnh = enh; bestIdx = i; }
  }
  if (bestIdx === -1) return; // rien de mieux dans le sac que ce qui est déjà protégé (ou rien du tout)
  const better = INV[bestIdx];
  if (current) {
    if (!invAdd(current)) return; // sac principal plein : annule le swap, rien ne bouge
    COMPENDIUM_BAG[curIdx] = { ...better };
    INV[bestIdx] = null;
  } else if (compendiumBagAdd(better)) {
    INV[bestIdx] = null;
  }
}

// slots d'équipement type BDO — chaque pièce optimisable porte son PROPRE niveau d'enchant (enhLv)
// spawn à vide (2026-07-08, demande explicite : "ne plus spawn avec baton grunil -> spawn a vide")
// -- avant, un "Bâton de Grunil" (nom du palier le plus haut, trompeur pour un objet de départ)
// était équipé par défaut ; le joueur commence désormais sans arme, comme pour tous les autres slots
const EQUIP = {
  weapon: null, awakening: null, secondary: null, book: null,
  helmet: null, armor: null, gloves: null, boots: null,
  ring1: null, ring2: null, necklace: null, earring1: null, earring2: null, belt: null,
  // 2 emplacements Artéfact (ex: Vell, Khan) + 1 emplacement Pierre — pas encore de source de
  // drop en jeu, prêts à l'usage pour une future mise à jour (demande explicite du 2026-07-07)
  artifact1: null, artifact2: null, eqStone: null,
};
const ARMOR_SLOTS = ['helmet','armor','gloves','boots'];
const ACC_SLOTS = ['ring1','ring2','necklace','earring1','earring2','belt','artifact1','artifact2','eqStone'];
const WEAPON_SLOTS = ['weapon','awakening','secondary'];
// tout ce qui peut être optimisé — armes, armure ET bijoux
const OPTIMIZABLE_SLOTS = [...WEAPON_SLOTS, ...ARMOR_SLOTS, ...ACC_SLOTS];


/** @returns {number} poids total (LT) du sac principal, somme du poids×qty de chaque slot occupé. */
function invWeight() {
  let w = 0;
  for (const s of INV) if (s) w += (s.weight||0.1) * s.qty;
  return w;
}
// LT de base — mesuré empiriquement à ~6.8 LT/min en farm continu zone 1 (personnage neuf),
// calibré pour ~2h de farm avant ralentissement. Augmentable plus tard via une boutique.
const MAX_WEIGHT = () => 800;
/** @returns {number} nombre de slots occupés du sac principal. */
function invUsed() { return INV.filter(s => s).length; }

/**
 * Ajoute un objet à l'inventaire principal — fusionne dans un stack existant si `obj.stackable`
 * (clé de fusion = name, pas la clé technique de provenance), sinon prend un nouveau slot.
 * @param {object} obj - item à ajouter (copié, jamais référencé) ; lit .stackable, .name, .qty.
 * @returns {boolean} vrai si ajouté, faux si l'inventaire est plein.
 */
function invAdd(obj) {
  // "toute item identique et quelque soit leurs provenance (meme nom) doit tenir sur un seul
  // stack" (2026-07-08) -- avant, le stack était choisi par `key` (identifiant technique de la
  // source du drop), pas par `name` (ce que le joueur voit réellement). Deux objets AFFICHÉS de
  // façon identique pouvaient donc finir dans 2 stacks séparés si leur clé technique différait
  // (générée différemment selon la provenance) -- aucune raison valable pour un objet stackable
  // (matériau/craft/trash/trésor : jamais d'état individuel comme un enhLv à préserver par copie,
  // contrairement au gear/bijoux qui restent stackable:false). Le nom est désormais la seule clé
  // de fusion pour un stack, quelle que soit la provenance de l'objet.
  if (obj.stackable) {
    const slot = INV.find(s => s && s.stackable && s.name === obj.name && s.qty < MAX_STACK);
    if (slot) { slot.qty += obj.qty; enforceTreasureStackCap(slot); return true; }
  }
  const idx = INV.findIndex(s => s === null);
  if (idx === -1) return false; // inventaire plein
  // horodatage d'entrée dans le sac (2026-07-09, demande explicite) -- sert à détecter un meilleur
  // stuff laissé sans y toucher plus de 15s (voir hasNeglectedUpgradeInBag) ; ne l'écrase pas si
  // déjà présent (ex: un objet qui revient dans le sac après un déséquipement garde sa date d'origine)
  INV[idx] = { pickedAt: Date.now(), ...obj };
  enforceTreasureStackCap(INV[idx]);
  return true;
}
/** @param {number} i - index dans INV. @param {number} n - quantité à retirer (le slot devient null si qty tombe à 0 ou moins). */
function invRemoveAt(i, n) {
  const s = INV[i]; if (!s) return;
  s.qty -= n;
  if (s.qty <= 0) INV[i] = null;
}

// Échelle étendue façon vrai jeu : +1 à +7 sûr, +8 à +15 probabiliste (peut rétrograder, plancher +7),
// puis PRI/DUO/TRI/TET/PEN — à partir de PRI, un échec NE FAIT PLUS JAMAIS rétrograder (juste le matériau perdu)
const ENH_NAMES = ['+0','+1','+2','+3','+4','+5','+6','+7','+8','+9','+10','+11','+12','+13','+14','+15',
  'PRI (I)','DUO (II)','TRI (III)','TET (IV)','PEN (V)'];
const PRI_IDX = 16; // index du premier palier "PRI" — sert de frontière pour la règle anti-rétrogradation
const SAFE_IDX = 8; // à partir de cet index (+8), l'enchantement cesse d'être garanti à 100%
// Ralenti le 2026-07-08 (demande explicite) : +1 à +15 donnaient déjà +96% cumulé à eux seuls
// (0.56 jusqu'à +7, +0.40 jusqu'à +15) — largement suffisant pour franchir la zone suivante sans
// jamais avoir besoin de PRI+, qui perdait tout son intérêt. Les paliers +1→+15 sont divisés par
// ~1.6 (cumul +15 : 0.59 au lieu de 0.96) ; PRI→PEN restent inchangés et représentent maintenant
// plus de la moitié du gain total à PEN (0.74 sur 1.33, contre 0.74 sur 1.70 avant) — atteindre au
// moins PRI devient un vrai palier de progression, pas un bonus optionnel. Les zones ont aussi été
// recalibrées en conséquence (voir reqAP/reqDP des zones 3, 6 et 9 dans ZONES).
// Palier PRI relevé le 2026-07-06 (demande explicite : "en moyenne on doit être en PRI" pour
// passer au palier de couleur suivant) : simulation d'un stuff complet moyen-PRI (scale=1, farmé
// dans la meilleure zone du palier précédent) donnait un ratio PA/PD de seulement 0.58-0.70 face à
// la 1ère zone du palier suivant (zones 3/6/9) — encore sous le seuil de 0.6 qui bascule en ZONE
// DANGEREUSE pour le pire cas (gris→blanc). Plutôt que gonfler GEAR_ROLE (casserait l'équilibre
// déjà bon sur SA PROPRE zone, ratio ~0.9-1.0, en le faisant grimper à "ZONE DÉPASSÉE"), seul le
// palier PRI lui-même est relevé (+0.08 → +0.20) : ne change RIEN pour +0 à +15 (donc aucun impact
// sur l'équilibre intra-zone), et comme enhBonus() est recalculé à la volée depuis enhLv à chaque
// affichage (jamais figé sur l'objet), c'est rétroactif AUTOMATIQUEMENT sur tout le stuff déjà
// équipé/en sac de tous les joueurs, sans script de migration — exactement l'automatisme demandé.
const ENH_STEP = [0, .05,.05,.05,.05,.05,.05,.05,  .03,.03,.03,.03,.03,.03,.03,.03,  .20,.10,.13,.18,.25];
/**
 * Bonus multiplicatif cumulé d'enchantement jusqu'au palier `lvl` inclus (somme de ENH_STEP[1..lvl]).
 * @param {number} lvl - palier d'enchantement atteint (index dans ENH_NAMES, 0 = pas enchanté).
 * @returns {number} bonus cumulé (ex: 0.25 = +25%), recalculé à la volée à chaque appel — jamais
 *   figé sur l'objet, donc automatiquement rétroactif si ENH_STEP change (voir commentaire
 *   au-dessus de la constante).
 */
function enhBonus(lvl) { let b = 0; for (let i = 1; i <= (lvl||0); i++) b += ENH_STEP[i]; return b; }
/** @param {object} item - lit .optimizable et .enhLv. @returns {number} multiplicateur de stats (1 = aucun bonus). */
function itemMult(item) { return item && item.optimizable ? (1 + enhBonus(item.enhLv||0)) : 1; }
/**
 * PA/PD/PV/Esquive réels d'un objet une fois son bonus d'enchantement actuel appliqué (affichage
 * tooltip/popup). PA/PD/PV arrondis vers le BAS (Math.floor, jamais Math.round) — ne jamais
 * afficher/accorder plus de PA/PD que ce qui est réellement gagné (un arrondi standard pourrait
 * arrondir 2.6 à 3, donnant l'illusion d'un point de plus que la vraie valeur). L'Esquive reste en
 * % avec décimales (stat de %, pas concernée par cette règle d'arrondi entier).
 * @param {object} item - lit .ap, .dp, .hp, .dodge (bruts) + tout ce que itemMult() lit.
 * @returns {{ap:number, dp:number, hp:number, dodge:number}} stats après bonus d'enchantement actuel.
 */
function effectiveApDp(item) {
  const mult = itemMult(item);
  return { ap: Math.floor((item.ap||0) * mult), dp: Math.floor((item.dp||0) * mult), hp: Math.floor((item.hp||0) * mult),
    dodge: Math.round((item.dodge||0) * mult * 100) / 100 };
}
/**
 * Stats projetées SI l'objet atteignait `targetLvl` — sert à afficher le gain avant de lancer
 * l'optimisation auto ("gain si tu passes à ce palier").
 * @param {object} item - lit .ap, .dp, .hp, .dodge (bruts).
 * @param {number} targetLvl - palier visé (index dans ENH_NAMES).
 * @returns {{ap:number, dp:number, hp:number, dodge:number}} stats projetées à ce palier.
 */
function projectedApDp(item, targetLvl) {
  const mult = 1 + enhBonus(targetLvl);
  return { ap: Math.floor((item.ap||0) * mult), dp: Math.floor((item.dp||0) * mult), hp: Math.floor((item.hp||0) * mult),
    dodge: Math.round((item.dodge||0) * mult * 100) / 100 };
}

// ---------- chances d'optimisation : base FIXE + failstack PERSONNEL À CHAQUE OBJET ----------
// le failstack est attaché à l'objet ET au niveau précis qu'il a raté — jamais perdu, même après un succès ailleurs
const ENH_CHANCE_FLAT = {
  8:.45,  9:.38,  10:.30, 11:.24, 12:.18, 13:.13, 14:.08, 15:.05,   // +8 à +15
  16:.12, 17:.09, 18:.06, 19:.03, 20:.012,                          // PRI..PEN
};
// gain de chance par échec accumulé sur CE niveau précis, pour CET objet précis
const ENH_FS_INC = {
  8:.05,  9:.045, 10:.04, 11:.035, 12:.03, 13:.025, 14:.02, 15:.015,
  16:.015,17:.012,18:.008,19:.004, 20:.0015,
};
/** @param {?object} item @param {number} level. @returns {number} échecs déjà accumulés par cet objet à ce niveau précis (0 si aucun). */
function itemFailstack(item, level) { return (item && item.fsByLevel && item.fsByLevel[level]) || 0; }
/** Incrémente le failstack de `item` au niveau `level` précis (jamais partagé entre niveaux/objets). @param {object} item @param {number} level */
function addItemFailstack(item, level) {
  if (!item) return;
  if (!item.fsByLevel) item.fsByLevel = {};
  item.fsByLevel[level] = (item.fsByLevel[level] || 0) + 1;
}
/**
 * Chance de succès d'une tentative d'optimisation vers `level`, décomposée en base fixe et bonus
 * failstack (affichés séparément sur la barre de progression).
 * @param {number} level - palier visé (index dans ENH_NAMES ; < SAFE_IDX = toujours 100%).
 * @param {object} item - objet ciblé, lit item.fsByLevel[level] (échecs déjà accumulés à CE
 *   niveau précis, sur CET objet précis — jamais partagé entre objets ni entre niveaux).
 * @returns {{base:number, bonus:number, total:number}} total = base + bonus, plafonné à 90%.
 */
function enhChanceParts(level, item) {
  if (level < SAFE_IDX) return { base:1, bonus:0, total:1 };
  const base = ENH_CHANCE_FLAT[level] ?? .01;
  const inc = ENH_FS_INC[level] ?? .01;
  const fs = itemFailstack(item, level);
  const bonus = Math.min(0.9 - base, fs * inc); // plafond global 90%
  return { base, bonus: Math.max(0, bonus), total: base + Math.max(0, bonus) };
}
/** @param {number} level @param {object} item. @returns {number} chance totale de succès (base+bonus failstack), voir enhChanceParts(). */
function enhChance(level, item) { return enhChanceParts(level, item).total; }

// ==================== POWER SCORE & SCALING ====================
/** @returns {number} PA total des 3 armes équipées (principale/éveil/secondaire), chacune selon SON PROPRE enchant. */
function weaponAP() {
  let a = 0;
  for (const k of WEAPON_SLOTS) { const e = EQUIP[k]; if (e) a += (e.ap||0) * itemMult(e); }
  return a;
}
/** @returns {number} PA total de l'armure+bijoux équipés (hors armes), chaque pièce selon SON propre enchant. */
function equipAP() {
  let a = 0;
  for (const k of [...ARMOR_SLOTS, ...ACC_SLOTS]) { const e = EQUIP[k]; if (e) a += (e.ap||0) * itemMult(e); }
  return a;
}
/** @returns {number} PD total de l'armure+bijoux équipés. */
function equipDP() {
  let d = 0;
  for (const k of [...ARMOR_SLOTS, ...ACC_SLOTS]) { const e = EQUIP[k]; if (e) d += (e.dp||0) * itemMult(e); }
  return d;
}
// PV apportés par l'armure (casque/plastron/gants/bottes) — demande : "ajoute au stuff des PV pour
// que les joueurs ne se fassent pas one-shot". S.hpMax reste la valeur de BASE (progression par
// niveau) ; effHpMax() = base + bonus d'armure, utilisée partout où "les PV max actuels" comptent.
/** @returns {number} PV bonus des 4 pièces d'armure (chacune selon son enchant) — S.hpMax reste la base par niveau, voir effHpMax(). */
function equipHP() {
  let h = 0;
  for (const k of ARMOR_SLOTS) { const e = EQUIP[k]; if (e) h += (e.hp||0) * itemMult(e); }
  return h;
}
const effHpMax = () => S.hpMax + equipHP();
// mana (2026-07-05, demande explicite) : pas de bonus d'équipement pour l'instant, juste la
// réserve de base -- suit le même patron que effHpMax() pour rester facile à étendre plus tard
const effManaMax = () => S.mpMax;
// Esquive (2026-07-08) : stat de % dropée UNIQUEMENT sur les 4 pièces d'armure (voir GEAR_ROLE),
// enchantée comme AP/DP/PV (itemMult). Chaque point de % réduit la chance de subir un coup.
/** @returns {number} % d'esquive brut de l'armure équipée (avant dodgeEffectiveness()), enchanté comme AP/DP/PV. */
function equipDodge() {
  let d = 0;
  for (const k of ARMOR_SLOTS) { const e = EQUIP[k]; if (e) d += (e.dodge||0) * itemMult(e); }
  return d;
}
/** @returns {number} bonus d'enchantement moyen des 4 pièces d'armure équipées (0 si aucune). */
function armorBonusAvg() {
  const pieces = ARMOR_SLOTS.map(k => EQUIP[k]).filter(Boolean);
  if (!pieces.length) return 0;
  return pieces.reduce((s,e) => s + enhBonus(e.enhLv||0), 0) / pieces.length;
}
const apEff = () => (S.pa + weaponAP() + equipAP());
const totalDP = () => S.dp + equipDP();
const GS = () => (apEff() + totalDP()) / 2; // Gearscore affiché au joueur — n'est plus utilisé pour le scaling
const apRatio = (z) => apEff() / (z || Z()).reqAP;
const dpRatio = (z) => totalDP() / (z || Z()).reqDP;
const bottleneck = (z) => Math.min(apRatio(z), dpRatio(z));

// ==================== COMPENDIUM (bonus de collection) ====================
// demande explicite du 2026-07-08 : le bonus d'une zone n'est actif QUE si les 4 objets de cette
// zone (trash/matériau du palier/bijou jackpot/objet craft) ont TOUS déjà été obtenus au moins une
// fois — pas juste "avoir farmé la zone une fois" comme avant. Entièrement CALCULÉ à la volée à
// partir de S.lootByItem (jamais un flag stocké séparément) : donc automatiquement rétroactif, y
// compris pour les objets obtenus dans d'autres zones du même palier (matériau/bijou partagés).
/** @param {number} zi - index de zone. @returns {string[]} les 4 noms d'objets requis pour le Compendium de cette zone (trash/matériau/jackpot/craft). */
function zoneItemNames(zi) {
  const z = ZONES[zi], tier = gearTierForZone(zi);
  return [tr(z.loot.trash.name), tr(tier.material.name), tr(z.loot.jackpot.name), tr(z.loot.craft.name)];
}
/** @param {number} zi - index de zone. @returns {boolean} vrai si les 4 objets requis ont déjà tous été obtenus au moins une fois. */
function zoneFullyCollected(zi) { return zoneItemNames(zi).every(n => compendiumItemDone(n)); }
/**
 * Appelé après chaque ramassage d'objet (dropsTick) : détecte le passage "incomplet → complet"
 * du Compendium pour cette zone précise, et affiche la notif +1% (floatTxt + Discord).
 * @param {number} zi - index de zone.
 * @param {boolean} wasDone - état de zoneFullyCollected(zi) AVANT ce ramassage.
 */
function checkZoneCompendiumUnlock(zi, wasDone) {
  if (wasDone || !zoneFullyCollected(zi)) return;
  floatTxt(P.x, P.y, 96, '📖 Compendium — '+tr(ZONES[zi].name), { gold:true });
  const zc = compendiumZoneCount();
  logToDiscord('📖 Compendium', `**${myPseudo||'Joueur'}** débloque le bonus de **${tr(ZONES[zi].name)}** (${zc}/${ZONES.length} zones${zc>=ZONES.length?' — COMPENDIUM COMPLET ✓':''})`, 0xc9a55a);
}
// World Boss (ajouté au Compendium le 2026-07-08, demande explicite) : vaincre un boss AU MOINS
// une fois débloque le même bonus qu'une zone (+1% SPD/DMG/Esquive), voir endBossFight
/** @param {string} bossId - clé BOSS_ROSTER. Marque le boss vaincu au moins une fois (déclenche le bonus Compendium +1%, une seule fois). */
function markBossDefeated(bossId) {
  if (S.bossesKilled[bossId]) return;
  S.bossesKilled[bossId] = true;
  const b = BOSS_ROSTER[bossId];
  floatTxt(P.x, P.y, 96, '📖 Compendium — '+b.name[LANG], { gold:true });
  logToDiscord('📖 Compendium', `**${myPseudo||'Joueur'}** débloque le bonus de **${b.name.fr}** (World Boss)`, 0xc9a55a);
}
/** @returns {number} nombre de zones entièrement collectées (Compendium). */
function compendiumZoneCount() { return ZONES.reduce((n,z,zi) => n + (zoneFullyCollected(zi)?1:0), 0); }
/** @returns {number} nombre de World Boss vaincus au moins une fois. */
function compendiumBossCount() { return Object.keys(S.bossesKilled||{}).length; }
/** @returns {number} zones + boss confondus (points de bonus de stat Compendium, PEN exclu). */
function compendiumTotalCount() { return compendiumZoneCount() + compendiumBossCount(); }
/** @returns {number} total possible de zones+boss (dénominateur de compendiumTotalCount()). */
function compendiumTotalMax() { return ZONES.length + Object.keys(BOSS_ROSTER).length; }
function compendiumPct() { return compendiumTotalCount() * 1; } // points de %, 1 par zone OU par boss
// % de complétion GLOBALE du Compendium, toutes sources confondues (zones + boss + Maîtrise PEN) --
// distinct de compendiumPct() ci-dessus (qui n'est PAS un vrai pourcentage de complétion mais le
// nombre de points de bonus de stat, zones+boss uniquement, PEN exclu). Utilisé par la barre de
// progression combinée du Compendium et par le suivi admin (player_stats.compendium_pct).
/** @returns {number} % de complétion GLOBALE du Compendium (0-100), zones+boss+Maîtrise PEN confondus — distinct de compendiumPct() (bonus de stat, PEN exclu). Alimente aussi player_stats.compendium_pct côté admin. */
function compendiumOverallPct() {
  const done = compendiumTotalCount() + compendiumPenCount();
  const max = compendiumTotalMax() + penMasteryItemList().length;
  return max > 0 ? Math.round(done / max * 100) : 0;
}

// ---- Compendium spécial "Maîtrise PEN" (2026-07-08, demande explicite) : liste TOUS les objets
// optimisables du jeu (7 pièces × 4 paliers de stuff + 1 bijou par zone) et suit lesquels ont déjà
// atteint PEN (niveau max) AU MOINS UNE FOIS — purement un suivi de complétion, sans bonus de
// stats (contrairement au Compendium zones/World Boss). Persisté via S.penMastery.
// BUG trouvé le 2026-07-08 (demande explicite : "verifier si tout les stuff sont dans la maitrise
// pen") : cette fonction utilisait GEAR_SLOTS (= ['helmet','armor','gloves','boots'], réduit aux 4
// pièces d'ARMURE le 2026-07-05 pour les besoins du tirage aléatoire de loot, voir le commentaire
// sur GEAR_SLOTS dans world/gear-tiers-data.js) au lieu de [...WEAPON_SLOTS, ...ARMOR_SLOTS] (les 7
// VRAIES pièces optimisables : bâton/éveil/dague + casque/armure/gants/bottes) -- les 3 armes de
// chaque palier (12 au total) n'étaient donc JAMAIS suivies dans la Maîtrise PEN, aucun moyen de
// les compléter. Chaque entrée porte maintenant slot/grade/color/kind pour permettre un
// regroupement par palier de couleur + une icône fidèle (voir renderCompendiumHtml).
/** @returns {object[]} 44 entrées ({name,slot,grade,color,kind}) — 4 paliers × (3 armes + 4 armures + 4 bijoux), groupées par palier de couleur, pour le suivi Maîtrise PEN. */
function penMasteryItemList() {
  const entries = [];
  for (const tier of GEAR_TIERS) {
    // ordre demandé : arme, armure, puis bijou -- jamais mélangé entre paliers
    for (const slot of [...WEAPON_SLOTS, ...ARMOR_SLOTS]) {
      entries.push({ name: tier.sets[slot], slot, grade: tier.grade, color: tier.color, kind:'gear' });
    }
    for (const zi of tier.zones) {
      const jp = ZONES[zi].loot.jackpot;
      entries.push({ name: jp.name, slot: accSlotFor(jp), grade: tier.grade, color: tier.color, kind:'jackpot' });
    }
  }
  return entries; // 4 paliers × (7 pièces + 4 bijoux) = 44 entrées, groupées par palier de couleur
}
// icône fidèle d'une entrée de Maîtrise PEN (2026-07-08, demande explicite : "avec leurs icone") --
// réutilise EXACTEMENT les mêmes fonctions d'icône que le vrai stuff (gear-icons.js), jamais une
// icône générique, pour que l'objet soit reconnaissable au premier coup d'oeil
const PEN_GEAR_ICON_FOR_SLOT = {
  weapon:staffIconForColor, awakening:orbPairIconForColor, secondary:daggerIconForColor,
  helmet:helmetIconForColor, armor:armorIconForColor, gloves:glovesIconForColor, boots:bootsIconForColor,
};
const PEN_JEWEL_ICON_FOR_SLOT = { ring:ringIconForTier, necklace:necklaceIconForTier, earring:earringIconForTier, belt:beltIconForTier };
/** @param {object} entry - une entrée de penMasteryItemList(). @returns {string} HTML de l'icône fidèle (réutilise les vraies fonctions d'icône de gear-icons.js). */
function penMasteryIcon(entry) {
  if (entry.kind === 'gear') { const fn = PEN_GEAR_ICON_FOR_SLOT[entry.slot]; return fn ? fn(entry.color, entry.grade) : ''; }
  const fn = PEN_JEWEL_ICON_FOR_SLOT[entry.slot] || ringIconForTier;
  return fn(JEWEL_TIER_IDX[entry.grade] || 0, entry.color);
}
/** @param {string} name - nom de l'objet amené à PEN pour la 1re fois. Marque S.penMastery[name], toast + Discord, jamais rejoué si déjà fait. */
function markPenMastery(name) {
  if (S.penMastery[name]) return;
  S.penMastery[name] = true;
  const done = compendiumPenCount(), max = penMasteryItemList().length;
  floatTxt(P.x, P.y, 96, '🌟 PEN — '+tr(name), { gold:true });
  logToDiscord('🌟 Maîtrise PEN', `**${myPseudo||'Joueur'}** amène ${name} à PEN pour la première fois (${done}/${max}${done>=max?' — MAÎTRISE COMPLÈTE ✓':''})`, 0xffe9a8);
}
// bug réel signalé le 2026-07-19 (capture d'écran : "Maîtrise PEN (45/44)", dépasse le maximum
// théorique) -- l'ancienne version comptait TOUTES les clés jamais écrites dans S.penMastery, y
// compris un nom d'objet qui ne fait PLUS partie de penMasteryItemList() aujourd'hui (renommage/
// rééquilibrage passé laissant une entrée orpheline, jamais nettoyée). Filtre désormais sur les
// noms RÉELLEMENT présents dans la liste actuelle -- une entrée orpheline reste en mémoire (aucune
// perte de donnée si le nom revient un jour) mais ne gonfle plus le compteur affiché.
/** @returns {number} nombre d'entrées de S.penMastery encore valides (présentes dans penMasteryItemList() actuelle — filtre les noms orphelins d'un rééquilibrage passé). */
function compendiumPenCount() {
  const validNames = new Set(penMasteryItemList().map(e => e.name));
  return Object.keys(S.penMastery||{}).filter(n => validNames.has(n)).length;
}
// "Un item qui passe pen... supprime l'item non pen du sac protégé spécial compendium" (2026-07-08)
// -- ensureCompendiumProtection() protège toujours le PLUS ENCHANTÉ exemplaire d'un nom TANT QU'il
// n'a jamais atteint PEN (voir plus haut). Une fois S.penMastery[name] vrai (peu importe QUEL
// exemplaire a atteint PEN -- équipé, sac principal, ou celui-là même dans le Compendium), le
// protégé n'a plus de raison d'être : rendu ici au sac principal, jamais perdu (comme tout
// mouvement Compendium -> sac). ensureCompendiumProtection() ne re-protège jamais un nom déjà
// masterisé (garde-fou déjà en place), donc rien ne viendra le remplacer entre-temps.
/** @param {string} name - objet qui vient d'atteindre PEN (peu importe quel exemplaire). Rend au sac principal l'exemplaire protégé de ce nom dans COMPENDIUM_BAG (n'a plus besoin d'y rester). */
function evictMasteredFromCompendiumBag(name) {
  if (!name || !S.penMastery[name]) return;
  const idx = COMPENDIUM_BAG.findIndex(s => s && s.name === name);
  if (idx === -1) return;
  if (invAdd({ ...COMPENDIUM_BAG[idx] })) COMPENDIUM_BAG[idx] = null;
  // sac principal plein : l'objet reste protégé dans le Compendium plutôt que d'être perdu --
  // rattrapé au prochain appel (une vente/enchant/chargement ultérieur relance ce garde-fou)
}
// meilleur niveau d'optimisation JAMAIS atteint pour un nom d'objet donné (2026-07-15, demande
// explicite : "affiche l'opti dans le compendium si on a vendu un objet optimisé") — contrairement
// à S.penMastery (qui ne retient QUE le passage à PEN), ceci retient TOUT niveau intermédiaire
// (+1 à +19 compris), pour que le Compendium garde une trace même d'un objet enchanté puis vendu
// avant PEN. Mis à jour à CHAQUE succès d'optimisation (voir attemptEnhance), jamais effacé.
/** @param {string} name @param {number} lvl - niveau atteint. Retient le meilleur niveau d'optimisation JAMAIS atteint pour ce nom (S.enhPeakByName), jamais effacé même si l'objet est revendu avant PEN. */
function trackEnhPeak(name, lvl) {
  if (!S.enhPeakByName) S.enhPeakByName = {};
  if ((S.enhPeakByName[name]||0) < lvl) S.enhPeakByName[name] = lvl;
}

// Vitesse de déplacement (2026-07-08) : progression par NIVEAU (0% au niv.1, jusqu'à +75% au
// niveau 61, plafonné ensuite) + bonus de Compendium (points de % additifs entre eux).
/** @returns {number} % de vitesse gagné par le niveau actuel (0% au niv.1, +75% au niv.61, plafonné). */
function levelSpdPct() { return Math.max(0, Math.min(S.lvl,61)-1) / 60 * 75; }
/** @returns {number} % de vitesse total (niveau + Compendium). */
function totalSpdPct() { return levelSpdPct() + compendiumPct(); }
// variantes "pour un niveau HYPOTHÉTIQUE" (2026-07-15, demande explicite : "ce qu'on gagne par
// lvl... des qu'on prend un lvl les info change en fonction") -- réutilisées par l'onglet
// Statistiques > Niveaux pour prévisualiser les 5 niveaux avant/après le niveau actuel, sans
// dépendre de S.lvl. hpMaxFor() suppose la progression FIXE +8 PV/niveau depuis 100 à lvl 1 (voir
// S.hpMax += 8 dans le level-up, aucune autre source ne modifie S.hpMax).
/** @param {number} lvl - niveau hypothétique. @returns {number} % de vitesse pour ce niveau (même formule que levelSpdPct, sans dépendre de S.lvl). */
function levelSpdPctFor(lvl) { return Math.max(0, Math.min(lvl,61)-1) / 60 * 75; }
/** @param {number} lvl - niveau hypothétique. @returns {number} PV max pour ce niveau (+8/niveau depuis 100 à lvl 1). */
function hpMaxFor(lvl) { return 100 + 8*Math.max(0, lvl-1); }
function totalDmgPct() { return compendiumPct(); } // le DMG ne monte qu'avec le Compendium, pas le niveau

/**
 * Efficacité de l'esquive (0-1) selon le niveau du monstre RELATIF au joueur (dpR = dpRatio(),
 * comme le reste du combat). Sous-géré pour la zone (dpR < 0.5) → l'esquive perd tout son intérêt
 * (jusqu'à 0% d'effet) ; à niveau ou au-dessus (dpR >= 1) → pleinement efficace. Dans une zone
 * basse largement dépassée, un bon total d'esquive peut donc éviter presque tous les dégâts.
 * @param {number} dpR - ratio PD joueur / PD requis de la zone (voir dpRatio()).
 * @returns {number} facteur 0-1 appliqué au total d'esquive brut par totalDodgePct().
 */
function dodgeEffectiveness(dpR) {
  if (dpR >= 1) return 1;
  return Math.max(0, (dpR - 0.5) / 0.5);
}
/** @param {number} [dpR] - ratio PD (défaut dpRatio()). @returns {number} % d'esquive final, plafonné à 60 pour ne jamais rendre invincible. */
function totalDodgePct(dpR) {
  const raw = equipDodge() + compendiumPct();
  return Math.min(60, raw * dodgeEffectiveness(dpR ?? dpRatio())); // plafond 60% pour ne jamais rendre invincible
}

// Notifications/Succes(UI)/Courrier/Compendium/Quetes desormais dans
// progression/notifications-quests.js (extrait le 2026-07-08, reorganisation par dossiers) --
// charge APRES ce fichier, voir index.html.
// SKILLS/MANA_REGEN_PER_SEC/MANA_POTION/cds/buffTimer/teleportCd/evasionCd desormais dans
// classes/sorcier/skills-data.js (extrait le 2026-07-08, reorganisation par dossiers) --
// charge AVANT ce fichier, voir index.html.

// ==================== PROJECTION ISO ====================
/** @param {number} x @param {number} y. @returns {number} composante X de la projection isométrique. */
function isoX(x, y) { return (x - y); }
/** @param {number} x @param {number} y. @returns {number} composante Y de la projection isométrique. */
function isoY(x, y) { return (x + y) * .5; }
const cam = { x: 0, y: 0 };
/** @param {number} x @param {number} y @param {number} [z] - hauteur (jump/float). @returns {{sx:number, sy:number}} coordonnées écran (canvas), projection isométrique centrée sur cam. */
function toScreen(x, y, z = 0) {
  return {
    sx: W/2 + isoX(x,y) - isoX(cam.x,cam.y),
    sy: H/2 + 30 + isoY(x,y) - isoY(cam.x,cam.y) - z,
  };
}
/** Inverse de toScreen() (z=0, au niveau du sol) — sert au clic sur le loot au sol. @param {number} sx @param {number} sy @returns {{x:number, y:number}} coordonnées monde. */
function screenToWorld(sx, sy) {
  const a = sx - W/2 + isoX(cam.x,cam.y);
  const b = 2*(sy - H/2 - 30) + isoY(cam.x,cam.y)*2;
  return { x: (a+b)/2, y: (b-a)/2 };
}

// ==================== JOUEUR ====================
const P = {
  x: 0, y: 0, hp: 100, mp: 100, // mp (2026-07-05) : réserve de mana courante, voir effManaMax()
  state: 'search', stateT: 0,
  castTimer: 0, castingSkill: null, castProgress: 0,
  bob: 0, faceX: 1, orbitDir: 1, orbitAng: 0,
  potCd: 0, manaPotCd: 0, faint: 0, tpFlash: 0, lootTarget: null, lootClusterX: 0, lootClusterY: 0,
  manualTarget: null, manualMoveT: 0,
  dmgBurstAccum: 0, dmgBurstT: 0, // dégâts encaissés dans la fenêtre glissante en cours (voir wolvesTick)
  faintZoneIdx: 0, faintAtVelia: false, // zone au moment du K.O., utilisée par die() (voir wolvesTick)
};
const BASE_SPEED = 92;

// ==================== MONDE ====================
let packs = [], drops = [], particles = [], floats = [], corpses = [];
let packSerial = 0, target = null, shakeT = 0, shakeAmp = 0;

/** @param {number} ax @param {number} ay @param {number} bx @param {number} by. @returns {number} distance euclidienne entre les deux points. */
function dist(ax,ay,bx,by){ return Math.hypot(ax-bx,ay-by); }

// Boss de zone Gahaz (zone 8, "Repaire Bandits Gahaz") -- 2026-07-13, demande explicite : PREMIER
// monstre du jeu avec une capacité de combat DÉDIÉE (téléportation) au-delà du simple bump
// générique de pack alpha (taille/PV/dégâts, voir spawnPackNear ci-dessous). Scope volontairement
// restreint à zoneIdx===8 && alpha (jamais un mécanisme global appliqué aux packs alpha des autres
// zones) -- voir pickGahazTeleportSpot/gahazBossTeleport plus bas et le branchement dans wolvesTick.
const GAHAZ_BOSS_HP_MULT = 1.4;   // PAR-DESSUS le multiplicateur alpha générique (x2.6) -> x3.64 au total face à un monstre normal
const GAHAZ_BOSS_DMG_MULT = 1.35; // PAR-DESSUS le multiplicateur alpha générique (x1.8) -> x2.43 au total
const GAHAZ_TELEPORT_MIN_CD = 5, GAHAZ_TELEPORT_MAX_CD = 8; // secondes entre 2 téléportations (tant que le pack reste aggro)
const GAHAZ_TELEPORT_CHARGE_T = .6; // fenêtre de "charge" visuelle juste avant le teleport (lueur, voir drawGahazIso)
const GAHAZ_TELEPORT_MIN_DIST = 220, GAHAZ_TELEPORT_MAX_DIST = 380; // distance AU JOUEUR après teleport -- casse l'engagement mêlée sans sortir de la zone de combat

/** Fait apparaître un nouveau pack de monstres autour du joueur (taille/PV/alpha selon la zone et le palier), ajouté à `packs`. */
function spawnPackNear() {
  packSerial++;
  const z = Z();
  // Mine de Fer Abandonnée (zone 6) : 1 pack sur 2 est mené par un boss (contremaître blindé, plus
  // gros, qui loot plus — les multiplicateurs alpha ×1.5/1.6 s'appliquent déjà) — demande explicite
  // du 2026-07-07. Les autres zones gardent le rythme habituel d'1 pack alpha sur 5.
  const alpha = zoneIdx === 6 ? packSerial % 2 === 0 : packSerial % 5 === 0;
  // boss de zone Gahaz (voir bloc de constantes GAHAZ_* juste au-dessus) : uniquement le pack alpha
  // de la zone 8, jamais ailleurs.
  const gahazBoss = zoneIdx === 8 && alpha;
  let x, y, tries = 0;
  do {
    const a = Math.random()*Math.PI*2, d = 320 + Math.random()*360;
    x = P.x + Math.cos(a)*d; y = P.y + Math.sin(a)*d; tries++;
  } while (tries < 12 && packs.some(p => !p.dead && dist(x,y,p.x,p.y) < 200));

  // densité progressive : packs de plus en plus grands en avançant dans les zones
  const baseSize = 2 + Math.floor(zoneIdx * 0.5); // Z1→2, Z6→4-5, Z12→7-8
  const n = alpha ? 2 : Math.min(9, baseSize + Math.floor(Math.random()*3));
  const hpPer = z.hpPer * (alpha ? 2.6 : 1) * (gahazBoss ? GAHAZ_BOSS_HP_MULT : 1);
  const wolves = [];
  for (let i = 0; i < n; i++) {
    const a = (i/n)*Math.PI*2 + Math.random();
    wolves.push({
      ox: Math.cos(a)*(30+Math.random()*22), oy: Math.sin(a)*(30+Math.random()*22),
      gx: Math.cos(a)*10, gy: Math.sin(a)*10,
      scale: alpha ? 1.5 : .85 + Math.random()*.25,
      phase: Math.random()*6.28,
      tone: alpha ? z.alphaTone : z.tones[i % z.tones.length],
      alpha, // les silhouettes par zone peuvent dessiner une variante "boss" (voir drawMineurIso)
      atkT: 1 + Math.random()*2, lunge: 0,
      // PV INDIVIDUEL par monstre (2026-07-11, demande explicite : "chaque monstre a sa propre
      // barre de vie et son loot associé") -- avant, tout le pack partageait une seule barre/PV
      // agrégée et mourait d'un coup ; chaque monstre meurt maintenant un par un, voir currentWolf()/killWolf()
      hp: hpPer, maxHp: hpPer, dead: false,
      // lueur de "charge" juste avant un teleport (gahazBoss uniquement, mis à jour par wolvesTick,
      // lu par drawGahazIso) -- toujours présent (même sur les monstres normaux) pour rester un
      // simple nombre lu sans garde `typeof` partout dans le rendu.
      teleportChargeT: 0,
    });
  }
  packs.push({
    x, y, wolves, alpha,
    aggro:false, gathered:0, dead:false,
    dmg: z.dmg * (alpha ? 1.8 : 1) * (gahazBoss ? GAHAZ_BOSS_DMG_MULT : 1),
    gahazBoss,
    // léger délai avant la 1ère téléportation (laisse le temps d'engager le combat) -- seulement
    // pertinent pour un pack gahazBoss, ignoré sinon (voir garde `p.gahazBoss` dans wolvesTick).
    teleportCd: gahazBoss ? GAHAZ_TELEPORT_MIN_CD + Math.random()*2 : 0,
  });
}
/**
 * @param {number} px @param {number} py - position actuelle du joueur.
 * @returns {{x:number,y:number}} nouvelle position de téléportation du boss Gahaz : angle aléatoire,
 * distance comprise entre GAHAZ_TELEPORT_MIN_DIST et GAHAZ_TELEPORT_MAX_DIST DU JOUEUR -- casse
 * l'engagement en mêlée (le joueur doit re-parcourir la distance) sans envoyer le boss hors de la
 * zone de combat. Pure (aucun effet de bord) -- testable isolément, voir tests.js.
 */
function pickGahazTeleportSpot(px, py) {
  const a = Math.random()*Math.PI*2;
  const d = GAHAZ_TELEPORT_MIN_DIST + Math.random()*(GAHAZ_TELEPORT_MAX_DIST-GAHAZ_TELEPORT_MIN_DIST);
  return { x: px + Math.cos(a)*d, y: py + Math.sin(a)*d };
}
/**
 * Exécute la téléportation du boss de zone Gahaz : VFX (traînée `tpTrail` + éclats `spark` aux 2
 * points, même famille que doTeleport() côté joueur), déplace le pack entier (les 2 monstres du
 * pack alpha suivent, même logique que le reste du fichier où `alpha` est un concept de PACK, pas
 * d'un monstre isolé), relance le cooldown, remet la lueur de charge à 0.
 * @param {object} p - pack gahazBoss ciblé (lit/écrit p.x/p.y/p.teleportCd).
 */
function gahazBossTeleport(p) {
  const from = { x:p.x, y:p.y };
  const to = pickGahazTeleportSpot(P.x, P.y);
  particles.push({ type:'tpTrail', x1:from.x, y1:from.y, x2:to.x, y2:to.y, life:.4, max:.4 });
  for (let i=0;i<6;i++)
    particles.push({type:'spark', x:from.x+(Math.random()*30-15), y:from.y+(Math.random()*30-15),
      z:10+Math.random()*20, vz:60+Math.random()*40, life:.4, max:.4});
  for (let i=0;i<6;i++)
    particles.push({type:'spark', x:to.x+(Math.random()*30-15), y:to.y+(Math.random()*30-15),
      z:10+Math.random()*20, vz:60+Math.random()*40, life:.4, max:.4});
  p.x = to.x; p.y = to.y;
  p.teleportCd = GAHAZ_TELEPORT_MIN_CD + Math.random()*(GAHAZ_TELEPORT_MAX_CD-GAHAZ_TELEPORT_MIN_CD);
  for (const w of p.wolves) if (!w.dead) w.teleportChargeT = 0;
}

// nombre de packs actifs simultanément dans le monde -- davantage à partir du palier BLANC
// (2026-07-11, demande explicite : "rajoute des groupe de monstre a partir de la zone blanche" /
// "+ de pack meme monstre") : le monstre et son loot restent ceux de la zone, seul le nombre de
// groupes vivants en même temps dans le monde augmente avec le palier de stuff.
/** @returns {number} nombre de packs de monstres actifs simultanément dans le monde selon le palier de zone (0 à Velia). */
function targetPackCount() {
  if (atVelia) return 0;
  // volontairement SANS passer par GEAR_TIERS/gearTierForZone : resetWorld() (juste en dessous)
  // s'exécute immédiatement au chargement du script, AVANT que GEAR_TIERS (const déclarée bien
  // plus bas dans le fichier) n'existe -- y faire appel ici plantait tout le script au chargement
  // (ReferenceError, confirmé en live). Reprend directement les mêmes groupes de zones par palier
  // que GEAR_TIERS.zones (grey/white/green/blue), sans dépendance d'ordre de déclaration.
  if (zoneIdx===0 || zoneIdx===1 || zoneIdx===2 || zoneIdx===12) return 6;  // grey
  if (zoneIdx===3 || zoneIdx===4 || zoneIdx===5 || zoneIdx===13) return 8;  // white
  // vert = 2x le palier blanc (2026-07-12, demande explicite : "zone verte rajoute 2x le nombre
  // de monstre actuel", précisé "2x la valeur du palier blanc") -- 16 au lieu du +2 progressif
  // utilisé jusqu'ici (10), qui ne doublait rien
  if (zoneIdx===6 || zoneIdx===7 || zoneIdx===8 || zoneIdx===14) return 16; // green
  // bleu = 2.3x la valeur precedente (2026-07-18, demande explicite : "zone bleu change le
  // nombre de monstre a 2,3x plus que actuellement") -- 12 -> 28 (12*2.3=27.6, arrondi)
  return 28; // blue : 9,10,11,15
}
// keepPos (2026-07-15, demande explicite : "au reload, apres maj le joueur arrive dans une zone
// vide, fais en sorte qu'il trouve rapidement des monstre") -- BUG trouvé : au chargement d'une
// sauvegarde, applySaveState() restaurait bien P.x/P.y APRÈS resetWorld(), mais resetWorld()
// remettait TOUJOURS P.x/P.y à (0,0) avant de faire spawn les packs autour. Résultat : les packs
// spawnaient près de l'origine pendant que le joueur se téléportait ensuite loin de là -- "zone
// vide" au reload. keepPos=true fait spawn les packs autour de la position ACTUELLE de P (déjà
// restaurée par l'appelant) au lieu de forcer un retour à l'origine.
/** @param {boolean} [keepPos] - si vrai, fait spawn les packs autour de la position ACTUELLE de P au lieu de forcer un retour à l'origine (voir commentaire ci-dessus). Vide packs/drops/particules et réinitialise l'état de combat de la zone. */
function resetWorld(keepPos) {
  packs = []; drops = []; corpses = []; particles = []; floats = [];
  target = null; P.lootTarget = null; P.manualTarget = null;
  if (!keepPos) { P.x = 0; P.y = 0; }
  cam.x = P.x; cam.y = P.y; P.lootClusterX = 0; P.lootClusterY = 0;
  P.state = 'search'; P.hp = effHpMax();
  lastLootEntry = null; // évite de fusionner le loot d'une nouvelle zone avec celui d'avant
  if (atVelia) return; // Velia = zone paisible, aucun monstre n'y est jamais généré
  for (let i = 0; i < targetPackCount(); i++) spawnPackNear();
}
resetWorld();
// capture immédiate et synchrone de l'état "personnage neuf" — AVANT toute sauvegarde cloud
// éventuelle (qui se charge de façon asynchrone plus tard) pour ne jamais la contaminer
let DEFAULT_SAVE = JSON.parse(JSON.stringify(getSaveState()));

// ==================== FSM ====================
/** @returns {'agressif'|'normal'|'prudent'|'urgence'} palier de comportement IA selon le % de PV actuel (utilisé par pickSkill/l'IA de combat). */
function hpTier() {
  const p = P.hp / effHpMax();
  if (p > .8) return 'agressif';
  if (p > .5) return 'normal';
  if (p > .25) return 'prudent';
  return 'urgence';
}
/** @param {string} st - nouvel état de la FSM du joueur. Change P.state et réinitialise son minuteur (P.stateT). */
function setState(st){ P.state = st; P.stateT = 0; }

// pénalité de vitesse liée au poids retirée (2026-07-15, demande explicite : "enleve ralentit par
// le poids") -- ne reste que le bonus SPD niveau/Compendium et le malus de zone dangereuse
/** @returns {number} multiplicateur de vitesse de déplacement — bonus SPD niveau/Compendium × malus si zone dangereuse. */
function speedMult() {
  const dangerMult = isZoneDangerous() ? DANGER_PLAYER_SPEED_MULT : 1;
  return (1 + totalSpdPct()/100) * dangerMult;
}
/**
 * Déplace P vers (tx,ty) à `speed` (avant speedMult()) pendant `dt` secondes, met à jour l'orientation/l'animation de rebond.
 * @param {number} tx @param {number} ty @param {number} speed @param {number} dt
 * @returns {number} distance restante avant d'atteindre la cible (0 si déjà arrivé).
 */
function moveToward(tx, ty, speed, dt) {
  const d = dist(P.x,P.y,tx,ty);
  if (d < 1) return d;
  const vx = (tx-P.x)/d, vy = (ty-P.y)/d;
  const effSpeed = speed * speedMult();
  P.x += vx*effSpeed*dt; P.y += vy*effSpeed*dt;
  P.faceX = isoX(vx,vy) >= 0 ? 1 : -1;
  P.bob += dt*9;
  return d;
}
/** @param {number} dirX @param {number} dirY - direction (normalisée en interne). Téléporte P de 95 unités dans cette direction, déclenche le cooldown et l'effet visuel de traînée. */
function doTeleport(dirX, dirY) {
  teleportCd = 4.5;
  const d = Math.hypot(dirX,dirY)||1;
  const nx = P.x + dirX/d*95, ny = P.y + dirY/d*95;
  particles.push({ type:'tpTrail', x1:P.x, y1:P.y, x2:nx, y2:ny, life:.4, max:.4 });
  P.x = nx; P.y = ny; P.tpFlash = 1;
}
// potions de vie : 4 tailles au choix du joueur, prix FIXE différent pour chacune, payées à
// CHAQUE utilisation (vrai sink économique — sans silver, pas de soin, le joueur encaisse).
// Calibrage : le coût au %PV soigné augmente légèrement avec la taille (les grosses potions
// restent un luxe) et le temps de recharge grandit avec le soin apporté, pour qu'aucune taille
// ne soit "abusable" (spam en boucle) ni trop faible pour être utile.
// Recalibré le 2026-07-08 par rapport à la courbe de gains des zones de Velia (~3 000 silver/h en
// zone 1 jusqu'à ~100 000 silver/h en zone 11, voir docs/roadmap.md) : même utilisée en continu à
// son propre CD, la potion la plus chère (mega) ne dépasse jamais ~15% du revenu horaire d'une
// zone adaptée à son coût — un vrai sink sans jamais casser l'économie du joueur qui progresse.
// "Potion de vie" (infinite, cost:0) : verrouillée 🔒 en bas du sélecteur, réservée à un futur
// déblocage (récompense/boutique) — visible dès maintenant pour montrer où elle mènera.
// POTIONS/POTION_ORDER desormais dans combat/potions-data.js (extrait le 2026-07-08,
// reorganisation par dossiers) -- charge AVANT ce fichier, voir index.html.
// potionHourlyIncome/potionCost/usePotion/usePotionMana/renderPotSelect/togglePotSelect
// desormais dans combat/potions-logic.js (extrait le 2026-07-08, reorganisation par dossiers) --
// charge APRES ce fichier, voir index.html.

/**
 * Machine à états du joueur (IA), appelée chaque frame (voir advanceSim). États : search (cherche
 * un pack) → move (approche) → gather (contact, temporisation avant combat) → combat (délègue à
 * combatTick) → kite (esquive à distance, IA défensive) → loot (ramasse le loot du pack tué) →
 * search. faint (K.O.) court-circuite tout le reste et appelle die().
 * @param {number} dt - delta-temps en secondes depuis la frame précédente.
 */
function fsm(dt) {
  P.stateT += dt;
  if (P.faint > 0) {
    P.faint -= dt;
    if (P.faint <= 0) { die(); }
    return;
  }

  P.potCd = Math.max(0, P.potCd-dt);
  const tier = hpTier();
  // jamais d'auto-soin à Velia (2026-07-09, bug trouvé lors d'une vérification) : Velia est une
  // zone paisible sans aucun monstre, mais fsm() tournait quand même à Velia -- juste après une
  // mort (die() met P.hp à 50% PILE au seuil par défaut), une potion payante partait aussitôt sans
  // aucun combat pour la justifier, gaspillant du silver au pire moment (juste après avoir été tué)
  if (!atVelia && (P.hp/effHpMax()) <= (S.potionThreshold ?? 0.5) && P.potCd <= 0) usePotion();
  // mana (2026-07-05, demande explicite) : régén passive + potion de mana auto-bue sous 30%,
  // même principe que la potion de PV mais seuil fixe (pas de réglage joueur pour l'instant) —
  // la régén passive continue à Velia (sans danger), seul l'ACHAT auto d'une potion est bloqué
  P.mp = Math.min(effManaMax(), P.mp + MANA_REGEN_PER_SEC*dt);
  P.manaPotCd = Math.max(0, P.manaPotCd-dt);
  if (!atVelia && (P.mp/effManaMax()) <= 0.3 && P.manaPotCd <= 0) usePotionMana();
  if (tier==='urgence' && teleportCd <= 0 && target && !target.dead) {
    doTeleport(P.x-target.x, P.y-target.y);
    teleportCd = 0; doTeleport(P.x-target.x, P.y-target.y);
  }

  // déplacement manuel (clic joueur sur du loot au sol) : prioritaire sur l'IA. Tant que le perso
  // n'est pas arrivé, on ne repasse PAS par le switch d'état ci-dessous ("pas de retour" demandé) —
  // l'IA reprend exactement où elle en était (état inchangé) une fois la destination atteinte.
  if (P.manualTarget) {
    const d = moveToward(P.manualTarget.x, P.manualTarget.y, BASE_SPEED*(buffTimer>0?1.25:1), dt);
    if (d < 14) P.manualTarget = null;
    for (const k in cds) cds[k] = Math.max(0, cds[k]-dt);
    buffTimer = Math.max(0,buffTimer-dt);
    teleportCd = Math.max(0,teleportCd-dt);
    evasionCd = Math.max(0,evasionCd-dt);
    P.tpFlash = Math.max(0,P.tpFlash-dt*3);
    return;
  }

  switch (P.state) {
    case 'search': {
      target = packs.filter(p=>!p.dead)
                    .sort((a,b)=>dist(P.x,P.y,a.x,a.y)-dist(P.x,P.y,b.x,b.y))[0]||null;
      if (target) setState('move');
      break;
    }
    case 'move': {
      if (!target || target.dead) { setState('search'); break; }
      const d = moveToward(target.x,target.y,BASE_SPEED*(buffTimer>0?1.25:1),dt);
      if (teleportCd <= 0 && d > 260) doTeleport(target.x-P.x,target.y-P.y);
      if (d <= 170) { target.aggro = true; setState(aiMode()==='overgeared'?'combat':'gather'); }
      break;
    }
    case 'gather': {
      if (!target || target.dead) { setState('search'); break; }
      target.gathered = Math.min(1, target.gathered + dt/1.1);
      P.orbitAng += dt*2.2*P.orbitDir;
      moveToward(target.x+Math.cos(P.orbitAng)*105, target.y+Math.sin(P.orbitAng)*105, BASE_SPEED*.85, dt);
      if (target.gathered >= 1) setState('combat');
      break;
    }
    case 'combat': {
      if (!target || target.dead) { setState(S.farmMode==='xp'?'search':'loot'); break; }
      combatTick(dt);
      break;
    }
    case 'kite': {
      if (!target || target.dead) { setState(S.farmMode==='xp'?'search':'loot'); break; }
      P.orbitAng += dt*1.9*P.orbitDir;
      const r = 125 + Math.sin(P.stateT*3)*14;
      moveToward(target.x+Math.cos(P.orbitAng)*r, target.y+Math.sin(P.orbitAng)*r, BASE_SPEED*.95, dt);
      const danger = target.wolves.filter(w=>!w.dead && w.lunge>0).length >= 2;
      if (danger && teleportCd <= 0) { doTeleport(P.x-target.x,P.y-target.y); P.orbitDir *= -1; }
      if (pickSkill()) setState('combat');
      if (P.stateT > 2.5) setState('combat');
      break;
    }
    case 'loot': {
      P.bob += dt*7;
      // rayon FIXE autour du lieu de mise à mort (pas de la position courante du joueur) : garantit
      // que l'IA "Loot" ramasse VRAIMENT tout le loot du pack avant de repartir, même les drops
      // tombés plus loin que sa position une fois qu'elle a commencé à se déplacer pour looter
      if (!P.lootTarget || P.lootTarget.taken) {
        P.lootStuckT = 0;
        P.lootTarget = drops.filter(l=>!l.taken && !l.skipped && dist(P.lootClusterX,P.lootClusterY,l.x,l.y)<320)
                            .sort((a,b)=>dist(P.x,P.y,a.x,a.y)-dist(P.x,P.y,b.x,b.y))[0]||null;
      }
      if (P.lootTarget) {
        moveToward(P.lootTarget.x,P.lootTarget.y,BASE_SPEED*.9,dt);
        // sac plein : dropsTick() échoue en boucle à ramasser CET objet précis (jamais marqué
        // .taken), le perso restait donc bloqué à le suivre indéfiniment au lieu de continuer à
        // farmer (bug remonté en jeu le 2026-07-06 : "mon perso s'arrête quand il est full, il doit
        // continuer à attaquer comme convenu") -- au bout d'un délai raisonnable, on l'ignore (sans
        // le marquer .taken : il reste au sol, ramassable plus tard si de la place se libère) et on
        // repart chercher le pack suivant, exactement comme prévu à l'origine pour le sac plein.
        P.lootStuckT = (P.lootStuckT||0) + dt;
        if (P.lootStuckT > 1.5) { P.lootTarget.skipped = true; P.lootTarget = null; P.lootStuckT = 0; setState('search'); }
      }
      else setState('search');
      break;
    }
  }

  for (const k in cds) cds[k] = Math.max(0, cds[k]-dt);
  buffTimer = Math.max(0,buffTimer-dt);
  teleportCd = Math.max(0,teleportCd-dt);
  evasionCd = Math.max(0,evasionCd-dt);
  P.tpFlash = Math.max(0,P.tpFlash-dt*3);
}

/** @returns {object|null} prochain sort à lancer selon priorité/cooldown/mana disponible (buff en priorité si prêt), null si aucun n'est castable — l'appelant (combatTick) bascule alors en kite. */
function pickSkill() {
  const buff = SKILLS.find(s=>s.type==='buff');
  if (buffTimer <= 0 && cds[buff.id] <= 0 && P.mp >= buff.mp) return buff;
  // affordable (2026-07-05, demande explicite) : un sort dont le coût en mana dépasse la réserve
  // actuelle n'est simplement pas proposé -- l'IA retombe sur un sort moins cher, ou aucun (kite)
  const ready = SKILLS.filter(s=>!s.type && cds[s.id]<=0 && P.mp >= s.mp).sort((a,b)=>a.prio-b.prio);
  if (!ready.length) return null;
  const best = ready[0];
  if (best.prio >= 8) {
    const soonBig = SKILLS.filter(s=>!s.type && s.prio<=5).some(s=>cds[s.id]>0 && cds[s.id]<.6);
    if (soonBig) return null;
  }
  return best;
}

/**
 * Logique de combat par frame (état 'combat' de fsm()) : maintient la distance d'engagement selon
 * hpTier(), orbite autour de la cible, esquive défensive hors zone dangereuse, gère le cast en
 * cours (résolution via resolveSkill) ou en lance un nouveau (pickSkill) — retombe en 'kite' si
 * rien n'est castable et que le mode/palier de PV l'exige.
 * @param {number} dt - delta-temps en secondes.
 */
function combatTick(dt) {
  const mode = aiMode(), tier = hpTier();
  const wantDist = tier==='agressif' ? 75 : tier==='normal' ? 100 : 130;
  const d = dist(P.x,P.y,target.x,target.y);
  const dx = (P.x-target.x)/(d||1), dy = (P.y-target.y)/(d||1);
  const radial = wantDist - d;
  P.x += dx*radial*dt*2.2; P.y += dy*radial*dt*2.2;
  P.orbitAng = Math.atan2(P.y-target.y,P.x-target.x) + dt*.9*P.orbitDir;
  const nx = target.x + Math.cos(P.orbitAng)*Math.max(d,40);
  const ny = target.y + Math.sin(P.orbitAng)*Math.max(d,40);
  P.x += (nx-P.x)*dt*3; P.y += (ny-P.y)*dt*3;
  P.faceX = isoX(target.x-P.x,target.y-P.y) >= 0 ? 1 : -1;
  P.bob += dt*4;
  if (Math.random() < dt*.15) P.orbitDir *= -1;

  // pas d'esquive automatique en zone dangereuse (2026-07-08, demande explicite : "les monstres...
  // doivent tuer rapidement le joueurs... ONE SHOT") -- sinon ce téléport défensif pouvait sauver
  // le joueur du coup fatal garanti (voir wolvesTick), rendant le risque de la zone contournable
  const incoming = !isZoneDangerous() && target.wolves.some(w=>!w.dead && w.lunge>.25 && w.lunge<.5);
  if (incoming && evasionCd <= 0 && mode !== 'overgeared') {
    evasionCd = 3.2;
    P.x += dx*36; P.y += dy*36; P.tpFlash = .6;
    floatTxt(P.x,P.y,92,'Évasion',{blue:true});
  }

  if (P.castTimer > 0) {
    P.castTimer -= dt;
    P.castProgress = 1 - P.castTimer/(P.castingSkill.castT/S.castMult);
    if (P.castTimer <= 0) resolveSkill(P.castingSkill);
    return;
  }
  const sk = pickSkill();
  if (sk) {
    P.castingSkill = sk;
    P.castTimer = sk.castT/S.castMult;
    P.mp = Math.max(0, P.mp - sk.mp); // coût en mana prélevé au lancer, pas à la résolution
    cds[sk.id] = sk.cd * (mode==='overgeared'?.85:1);
    $('aiSkill').textContent = sk.name;
    // burst visuel à l'ORIGINE du cast, propre à chaque sort (2026-07-18, demande explicite :
    // "pense aux animations de sorts aussi") -- distinct du VFX d'impact (spawnVfx, à la
    // résolution dans resolveSkill) : celui-ci accompagne le temps de cast lui-même. Référence en
    // exécution (spawnCastOriginVfx vit dans combat/vfx.js, chargé après ce fichier) -- ne
    // s'exécute qu'en jeu, bien après que tous les scripts soient chargés, comme spawnVfx()
    // ci-dessous dans resolveSkill.
    spawnCastOriginVfx(sk);
  } else if (tier !== 'agressif' || mode === 'défensif') setState('kite');
}

// le monstre du pack ACTUELLEMENT visé par le joueur : le premier encore vivant (2026-07-11,
// demande explicite : chaque monstre a désormais son propre PV, on les abat un par un plutôt que
// de vider une seule barre agrégée pour tout le pack d'un coup)
/** @param {object} p - pack de monstres. @returns {?object} premier monstre encore vivant du pack (cible actuelle), null si tous morts. */
function currentWolf(p) { return p.wolves.find(w => !w.dead) || null; }

/**
 * Applique les effets d'un sort dont le cast vient de se terminer : dégâts de zone répartis sur
 * TOUS les monstres vivants des packs qui se chevauchent avec la cible (voir commentaires
 * ci-dessous pour le détail du splitFactor), VFX, écran de secousse.
 * @param {object} sk - sort résolu (SKILLS), lit .type, .dmg, .shake, .dur.
 */
function resolveSkill(sk) {
  P.castingSkill = null;
  if (sk.type === 'buff') { buffTimer = sk.dur; floatTxt(P.x,P.y,98,'✦ Speed Spell',{gold:true}); return; }
  if (!target || target.dead) return;
  const aliveWolves = target.wolves.filter(w => !w.dead);
  if (!aliveWolves.length) return; // sécurité : pack déjà vidé (ne devrait pas arriver, target.dead le couvre déjà)
  spawnVfx(sk,target);
  if (sk.shake) { shakeT=.3; shakeAmp=sk.shake; }
  // dégâts de ZONE (2026-07-14, demande explicite : "les attaques de zone visuellement doivent
  // faire des degats de zone sur les monstres") -- les VFX (meteor/ice/quake/bolt...) couvrent déjà
  // toute l'aire du pack (dispersion des particules ~100-110, contre un offset max de ~52 entre
  // monstres d'un même pack, voir spawnPackNear) : avant ce correctif, seul currentWolf() (le 1er
  // monstre vivant) encaissait les dégâts malgré une explosion visuellement étalée sur tout le
  // groupe -- chaque sort touche désormais TOUS les monstres vivants du pack ciblé, chacun avec son
  // propre jet de dégâts/critique indépendant.
  // packs VOISINS qui se chevauchent (2026-07-15, demande explicite : "si plusieurs pack se
  // chevauche... le sort divise ses degats a tout les monstres meme ceux des packs a coté... tu as
  // 4 pack et tu tue qu'un seul pack") -- même seuil de distance que spawnPackNear (200, la distance
  // minimum entre 2 centres de pack) pour désigner 2 packs comme "collés". Confirmé explicitement :
  // le cas à 1 seul pack (pas de voisin collé) garde ses PLEINS dégâts individuels, inchangé -- le
  // partage ne s'applique QUE quand d'autres packs sont réellement dans la même zone d'effet.
  const touchingPacks = packs.filter(p => !p.dead && (p === target || dist(p.x,p.y,target.x,target.y) < 200));
  const allHits = [];
  for (const p of touchingPacks) for (const w of p.wolves) if (!w.dead) allHits.push({ p, w });
  // budget total ancré sur "dégâts pleins pour vider SEULEMENT le pack ciblé" (comme avant) --
  // reparti sur tous les monstres touchés (packs voisins compris) au lieu de se concentrer QUE sur
  // le pack ciblé : plus de packs collés = plus de monstres touchés, mais dégâts individuels plus
  // faibles, pour un total infligé comparable plutôt qu'un multiplicateur par nombre de packs
  const splitFactor = touchingPacks.length > 1 ? aliveWolves.length / allHits.length : 1;
  for (const { p, w } of allHits) {
    const crit = Math.random() < .15;
    // >>> scaling par la PA face à la PA requise de la zone <<<
    const dmg = apEff() * sk.dmg * dmgMult(apRatio()) * (1+totalDmgPct()/100)
              * (0.9+Math.random()*.25) * (crit?2:1) * (buffTimer>0?1.12:1) * splitFactor;
    w.hp -= dmg;
    const wp = wolfPos(p,w);
    floatTxt(wp.x+(Math.random()*36-18), wp.y+(Math.random()*36-18), 62,
      '-'+fmt(Math.ceil(dmg))+(crit?'!':''), {crit});
    if (w.hp <= 0 && !w.dead) killWolf(p, w);
  }
}

// ---------- loups ----------
/** @param {object} p - pack. @param {object} w - monstre du pack. @returns {{x:number,y:number}} position monde du monstre, interpolée entre dispersion (ox/oy) et regroupement (gx/gy) selon p.gathered. */
function wolfPos(p,w){
  return { x:p.x + w.ox*(1-p.gathered) + w.gx*p.gathered,
           y:p.y + w.oy*(1-p.gathered) + w.gy*p.gathered };
}
/** @param {number} dt - delta-temps en secondes. Fait attaquer les monstres du pack ciblé (lunge/dégâts sur le joueur), gère le K.O. et la fenêtre glissante de dégâts encaissés (voir P.dmgBurstAccum). */
function wolvesTick(dt) {
  // K.O. (2026-07-09, demande explicite : "quand tu meurs, les monstres ne t'attaquent plus") --
  // sans cette garde, les loups continuaient de charger et de toucher le joueur déjà à 0 PV
  // pendant tout le compte à rebours, ce qui reprolongeait le K.O. (P.faint réinitialisé à 6 à
  // chaque coup) et retirait de l'XP en boucle au lieu d'une seule fois.
  if (P.faint > 0) return;
  // atténuation des dégâts reçus : dépend de TA PD (base + équipement) face à la PD requise de cette zone
  const dpR = dpRatio();
  const mitig = dmgTakenMult(dpR);
  const dangerous = isZoneDangerous();
  // aucune esquive possible en zone dangereuse (2026-07-08, demande explicite : "les monstres...
  // doivent tuer... ONE SHOT dans 100% des cas") -- sinon un résidu de chance d'esquive (dpR entre
  // 0.5 et 0.6, voir dodgeEffectiveness) pouvait sauver le joueur du coup garanti ci-dessous
  const dodgeChance = dangerous ? 0 : totalDodgePct(dpR) / 100; // voir dodgeEffectiveness : quasi nulle si trop sous-géré
  const mobSpeed = 50 * (dangerous ? DANGER_MOB_SPEED_MULT : 1);
  // TOUS les packs proches se réveillent d'un coup, pas seulement celui visé par l'IA (2026-07-08,
  // demande explicite : "les monstres aggros de plus loins... dans 100% des cas" — d'abord limité
  // aux zones dangereuses ; généralisé à TOUTE zone le 2026-07-14, demande explicite : "les monstre
  // aggro lorsque tu es proche d'eux maintenant") -- rend le risque immédiat et évident dès qu'on
  // s'approche, dans n'importe quelle zone, pas juste sur le pack engagé
  for (const p of packs) {
    if (!p.dead && !p.aggro && dist(P.x,P.y,p.x,p.y) <= 400) p.aggro = true;
  }
  for (const p of packs) {
    if (p.dead || !p.aggro) continue;
    const d = dist(P.x,P.y,p.x,p.y);
    // désengagement à distance (demande explicite du 2026-07-06 : "les groupes t'attaquent de plus
    // loin et les autres groupes t'agressent aussi") -- .aggro ne repassait JAMAIS à false une fois
    // activé (voir la FSM, état 'move'), donc chaque pack déjà croisé restait accroché pour
    // toujours, même après que l'IA soit passée à un autre combat : en zone dangereuse (monstres
    // plus rapides, joueur plus lent), ces packs abandonnés finissaient par rattraper le joueur en
    // même temps qu'un autre déjà engagé, créant un effet de meute cumulatif jamais voulu. Passé
    // cette distance, le pack retourne en patrouille (comme s'il n'avait jamais été engagé).
    if (d > 550) { p.aggro = false; continue; }
    if (d > 60) { p.x += (P.x-p.x)/d*mobSpeed*dt; p.y += (P.y-p.y)/d*mobSpeed*dt; }
    // boss de zone Gahaz (2026-07-13, demande explicite : voir bloc de constantes GAHAZ_* et
    // gahazBossTeleport/pickGahazTeleportSpot ci-dessus) -- se téléporte périodiquement TANT QUE le
    // pack reste engagé (aggro), forçant le joueur à re-parcourir la distance. Uniquement les packs
    // marqués gahazBoss à la génération (zoneIdx===8 && alpha, voir spawnPackNear) ET s'il reste au
    // moins un monstre vivant (sécurité : évite de téléporter un pack déjà entièrement vidé mais pas
    // encore marqué .dead dans la frame courante).
    if (p.gahazBoss && p.wolves.some(w=>!w.dead)) {
      p.teleportCd -= dt;
      // lueur de charge (voir drawGahazIso) : monte de 0 à GAHAZ_TELEPORT_CHARGE_T durant la
      // dernière fraction de seconde avant le teleport, purement cosmétique.
      const charge = Math.min(GAHAZ_TELEPORT_CHARGE_T, Math.max(0, GAHAZ_TELEPORT_CHARGE_T - p.teleportCd));
      for (const w of p.wolves) if (!w.dead) w.teleportChargeT = charge;
      if (p.teleportCd <= 0) gahazBossTeleport(p);
    }
    for (const w of p.wolves) {
      if (w.dead) continue; // (2026-07-11) un monstre déjà tué individuellement n'attaque plus
      if (w.lunge > 0) {
        w.lunge -= dt;
        if (w.lunge <= 0) {
          const wp = wolfPos(p,w);
          if (dist(P.x,P.y,wp.x,wp.y) < 95) {
            if (Math.random() < dodgeChance) {
              floatTxt(P.x,P.y,80,i18next.t('core:core.combat.dodge'),{blue:true});
            } else {
              const dmgRaw = p.dmg*(0.8+Math.random()*.4)*mitig;
              let dmg;
              if (dangerous) {
                // ZONE DANGEREUSE : dégâts GARANTIS létaux, pas juste "sans plafond" -- demande
                // explicite du 2026-07-08 ("dans 100% des cas... tuer rapidement... ONE SHOT") :
                // le coup brut peut suffire seul, mais Math.max avec effHpMax() garantit la mort
                // même sur un stuff tout juste sous le seuil (dmgRaw parfois insuffisant de peu) —
                // le badge doit représenter un risque de mort certaine, jamais probable seulement.
                dmg = Math.max(dmgRaw, effHpMax());
              } else {
                // en dehors d'une zone dangereuse : garde le plafond à 30% des PV max CUMULÉ sur
                // une fenêtre glissante d'1s (2026-07-06/08) -- plusieurs loups d'un même pack (ou
                // plusieurs packs agressifs à la fois) peuvent chacun toucher au même moment ; sans
                // ce plafond cumulé, plusieurs coups à 30% s'enchaînant en une fraction de seconde
                // équivaudraient à une mort surprise même quand le stuff n'est QUE légèrement sous
                // le seuil (DIFFICILE, pas DANGEREUSE).
                if (performance.now() - P.dmgBurstT > 1000) P.dmgBurstAccum = 0;
                P.dmgBurstT = performance.now();
                const room = Math.max(0, effHpMax()*0.3 - P.dmgBurstAccum);
                dmg = Math.min(dmgRaw, room);
                P.dmgBurstAccum += dmg;
              }
              P.hp -= dmg;
              floatTxt(P.x,P.y,80,'-'+Math.ceil(dmg),{hurt:true});
              if (P.hp <= 0) {
                P.hp = 0; P.faint = 6;
                // zone au moment du K.O. (2026-07-09, demande explicite) : sert à die() pour ne
                // renvoyer à Velia que si le joueur n'a pas déjà changé de zone pendant le KO
                P.faintZoneIdx = zoneIdx; P.faintAtVelia = atVelia;
                floatTxt(P.x,P.y,105,'K.O.',{hurt:true});
                S.xp = Math.max(0, S.xp - S.xpNext*.01); // -1 % XP
              }
            }
          }
        }
      } else {
        w.atkT -= dt;
        if (w.atkT <= 0) {
          // attaque bien plus rapide en zone dangereuse (2026-07-08, demande explicite : "doivent
          // tuer rapidement le joueur") -- le loup n'attend presque plus entre deux coups et lance
          // sa charge quasi instantanément, au lieu du rythme normal de patrouille
          w.atkT = dangerous ? 0.4+Math.random()*.3 : 2.6+Math.random()*2;
          w.lunge = dangerous ? 0.15 : 0.55;
        }
      }
    }
  }
}

// ---------- mort de monstre (individuel) & de pack (une fois tous ses monstres tués) ----------
// (2026-07-11, demande explicite : "chaque monstre a sa propre barre de vie et son loot associé")
// -- avant, killPack tuait tout le pack et tirait le loot de chaque loup EN UNE FOIS quand la barre
// agrégée du pack tombait à 0 ; désormais chaque monstre meurt et loot individuellement dès que SON
// PROPRE PV atteint 0 (voir currentWolf/resolveSkill), et killPack ne fait plus que la finalisation
// une fois le DERNIER monstre du pack tombé.
/**
 * Mort d'UN monstre du pack : incrémente kills/XP, spawn le loot (rollDrops), et finalise le pack
 * entier (killPack) si c'était le dernier monstre vivant.
 * @param {object} p - pack contenant le monstre.
 * @param {object} w - monstre tué.
 */
function killWolf(p, w) {
  w.dead = true;
  const z = Z(), lm = lootMult(bottleneck());
  const killsBefore = S.kills;
  S.kills++;
  kpmRateBuffer.push({ t: Date.now(), kills: 1 }); // fenêtre glissante bestKpm (voir computeSlidingKpm)
  // palier de kills "pour le fun" (demande explicite du 2026-07-08)
  if (Math.floor(S.kills/1000) > Math.floor(killsBefore/1000)) {
    logToDiscord('💀 Palier de kills', `**${myPseudo||'Joueur'}** vient d'atteindre **${fmt(Math.floor(S.kills/1000)*1000)}** monstres tués à vie`, 0x7a2d33);
  }
  gainXp(z.xp * (p.alpha?3:1));
  const wp = wolfPos(p,w);
  corpses.push({ x:wp.x, y:wp.y, scale:w.scale, tone:w.tone, life:2.4 });
  rollDrops(wp, p.alpha, lm);
  hud();
  if (p.wolves.every(ww => ww.dead)) killPack(p);
}
/** @param {object} p - pack dont le dernier monstre vient de mourir. Finalise le pack (marque dead), enchaîne vers 'search' (mode XP) ou 'loot' (nettoie la zone avant de repartir). */
function killPack(p) {
  p.dead = true;
  $('aiSkill').textContent = '—';
  P.lootTarget = null;
  if (S.farmMode === 'xp') {
    setState('search'); // mode XP : ignore le loot au sol, enchaîne directement vers le pack suivant
  } else {
    P.lootClusterX = p.x; P.lootClusterY = p.y; // centre de la zone de loot à nettoyer avant de repartir
    setState('loot');
  }
  hud();
}

// GEAR_TIERS/GEAR_CHANCE/LOOT_RATES_V2/GEAR_SLOTS/ZONE_WEAPON_SLOTS/ZONE_ARMOR_SLOTS/GEAR_ROLE/
// HP_GEAR_SCALE/DODGE_GEAR_SCALE (+ gearTierForZone/gearDropChance/jewelDropChance/gearFloor)
// desormais dans world/gear-tiers-data.js (extrait le 2026-07-08, reorganisation par dossiers) --
// charge AVANT ce fichier, voir index.html.
// GEAR_SELL_MULT/JACKPOT_VAL_TRASH_RATIO/ALPHA_LOOT_CHANCE_MULT/rollGearDrop/rollWeaponDrop/
// rollDrops/dropsTick/accSlotFor/lootLine/xpNeededFor/fmtXpPct/flashXpGain/gainXp/floatTxt
// desormais dans combat/loot-rolls.js (extrait le 2026-07-08, reorganisation par dossiers) --
// charge APRES ce fichier, voir index.html.

// spawnVfx/particlesTick desormais dans combat/vfx.js (extrait le 2026-07-08, reorganisation
// par dossiers) -- charge APRES ce fichier, voir index.html.

// Rendu canvas (scene, sprites, particules) + demarrage du jeu -> voir render.js (charge APRES ce fichier, voir index.html)
// ==================== HUD ====================
/** @param {number} n. @returns {string} nombre compacté (ex: "1.2M"/"3.4k"), tronqué à l'entier en dessous de 1000. */
function fmt(n){ n=Math.floor(n); return n>=1e6 ? (n/1e6).toFixed(1)+'M' : n>=1e3 ? (n/1e3).toFixed(1)+'k' : n; }
const STATE_FR = { search:'SearchPack', move:'MoveToPack', gather:'GatherPack', combat:'Combat', kite:'Kite', loot:'Loot' };

const skillBar = $('skillBar');
const skEls = {};
for (const s of SKILLS) {
  const el = document.createElement('div');
  el.className = 'sk';
  el.innerHTML = `<div class="ic">${s.ic}</div><div class="nm">${s.name.split(' ')[0]}</div><div class="cd"></div>`;
  el.title = s.name;
  skillBar.appendChild(el);
  skEls[s.id] = el;
}

// liste des zones
// une seule ligne par zone : cliquer la ligne = partir farmer cette zone (l'ancien bouton
// "Farmer" a été retiré), le bouton 👁 en bout de ligne prévisualise juste le loot sans y aller.
// Le halo doré sur le 👁 marque la zone actuellement PRÉVISUALISÉE (voir lootPreviewIdx) — utile
// pour ne pas confondre la zone dont on regarde le loot avec celle qu'on est en train de farmer.
let lootPreviewIdx = null; // null = suit la zone qu'on farm ; sinon index de la zone prévisualisée via 👁
// paliers de zones : pour l'instant tout ZONES[] est "Early" (jusqu'au niveau ~31) — Mid et End
// arriveront dans une future mise à jour, d'où le verrou 🔒 (demande explicite du 2026-07-05)
let zoneTier = 'early';
// 5 paliers de régions (voir docs/roadmap.md pour le détail des zones prévues par palier) —
// seul "Early / Velia" est en jeu pour l'instant, les autres sont verrouillés en attendant
// d'être construits (demande explicite du 2026-07-05)
// TIER_PREVIEW_CARD/ZONE_TIERS desormais dans world/region-tiers-data.js (extrait le
// 2026-07-08, reorganisation par dossiers) -- charge AVANT ce fichier, voir index.html.
// onglets de la carte Statistiques : "Perso" (contenu existant, inchangé) / "Recommandations"
// (2026-07-09, demande explicite) -- les valeurs de recommandation sont purement THÉORIQUES (voir
// zoneSilverPerHour/zoneXpPerHour/zoneKillsPerMin), donc constantes tout le long d'une session :
// rendu une seule fois au clic sur l'onglet plutôt qu'à chaque tick de hud().
let statsTab = 'perso';
/** Bascule les panneaux de la carte Statistiques (Perso/Recommandations/Niveaux) selon statsTab, rend Reco une seule fois (valeurs théoriques stables) et Niveaux à chaque affichage (doit refléter le niveau courant). */
function renderStatsTabs() {
  const el = $('statsTabTabs'); if (!el) return;
  el.querySelectorAll('.catTab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === statsTab));
  const personaPane = $('statsPersoPane'), recoPane = $('statsRecoPane'), levelsPane = $('statsLevelsPane');
  if (personaPane) personaPane.style.display = statsTab === 'perso' ? '' : 'none';
  if (recoPane) recoPane.style.display = statsTab === 'reco' ? '' : 'none';
  if (levelsPane) levelsPane.style.display = statsTab === 'levels' ? '' : 'none';
  if (statsTab === 'reco' && recoPane && !recoPane.dataset.rendered) { renderStatsRecoPane(); recoPane.dataset.rendered = '1'; }
  // pas de garde "déjà rendu" ici (contrairement à Reco) : demande explicite "des qu'on prend un
  // lvl les info change en fonction" -- doit toujours refléter le niveau ACTUEL au moment de l'affichage
  if (statsTab === 'levels') renderStatsLevelsPane();
}
(function wireStatsTabTabs() {
  const el = $('statsTabTabs'); if (!el) return;
  el.querySelectorAll('.catTab').forEach(btn => {
    btn.onclick = () => { statsTab = btn.dataset.tab; renderStatsTabs(); };
  });
})();
// contenu de l'onglet "Recommandations" : meilleure zone pour le silver/h, le xp/h et les
// kills/min, chacun cliquable pour s'y rendre directement (même geste que les zones de farm)
/** Reconstruit l'onglet Recommandations : meilleure zone pour silver/h, xp/h et kills/min, chaque ligne cliquable pour s'y téléporter. */
function renderStatsRecoPane() {
  const el = $('statsRecoPane'); if (!el) return;
  const rows = [
    { label: i18next.t('core:core.stats_reco.best_silver_hour'), best: bestZoneForMetric(zoneSilverPerHour), fmtV: v => fmt(Math.round(v))+'/h' },
    { label: i18next.t('core:core.stats_reco.best_xp_hour'), best: bestZoneForMetric(zoneXpPerHour), fmtV: v => fmt(Math.round(v))+'/h' },
    { label: i18next.t('core:core.stats_reco.best_kills_min'), best: bestZoneForMetric(zoneKillsPerMin), fmtV: v => v.toFixed(1)+'/min' },
  ];
  el.innerHTML = `<div class="constructionBanner">${i18next.t('core:core.stats_reco.construction_banner')}</div>` +
    `<div class="admHint">${i18next.t('core:core.stats_reco.hint')}</div>` +
    rows.map((r,ri) => `<div class="row statsRecoRow" data-zi="${r.best.i}" data-ri="${ri}">` +
      `<span>${r.label}</span><span class="v">${tr(ZONES[r.best.i].name)} · ${r.fmtV(r.best.v)}</span></div>`).join('');
  el.querySelectorAll('.statsRecoRow').forEach(row => {
    row.onclick = () => { const zi = parseInt(row.dataset.zi,10); if (atVelia || zi !== zoneIdx) travelTo(zi); };
  });
}
// onglet "Niveaux" de la carte Statistiques (2026-07-15, demande explicite : "ce qu'on gagne par
// lvl (5 avant 5 apres et celui + le notre) en stats, des qu'on prend un lvl les info change en
// fonction") -- 5 niveaux avant/après le niveau ACTUEL, ligne du niveau courant mise en évidence.
// PAS de garde "déjà rendu" (contrairement à renderStatsRecoPane) : appelée à chaque affichage de
// l'onglet ET après un level-up (voir le bloc S.lvl++ un peu plus haut) pour toujours refléter le
// niveau courant, comme demandé explicitement.
/** Reconstruit l'onglet Niveaux : 5 niveaux avant/après le niveau actuel (PV/vitesse/XP requis), ligne courante mise en évidence. Toujours re-rendu (pas de garde), pour suivre chaque level-up. */
function renderStatsLevelsPane() {
  const el = $('statsLevelsPane'); if (!el) return;
  const cur = S.lvl, maxLvl = LEVEL_XP_TABLE.length - 1;
  const from = Math.max(1, cur - 5), to = Math.min(maxLvl, cur + 5);
  let rows = '';
  for (let lvl = from; lvl <= to; lvl++) {
    const isCur = lvl === cur;
    rows += `<div class="row statsLevelRow${isCur?' current':''}">` +
      `<span>${i18next.t('core:core.stats_levels.lvl_label')} ${lvl}${isCur?i18next.t('core:core.stats_levels.you_suffix'):''}</span>` +
      `<span class="v">${i18next.t('core:core.stats_levels.hp_label')} ${fmt(hpMaxFor(lvl))} · SPD +${Math.round(levelSpdPctFor(lvl))}% · XP ${fmt(xpNeededFor(lvl))}</span></div>`;
  }
  el.innerHTML = `<div class="admHint">${i18next.t('core:core.stats_levels.hint')}</div>` + rows;
}
// Compagnon/Vie en mer (2026-07-17, "on y transvase du menu de gauche compagnon et vie en mer
// avec cadenas") vivaient ici, dans la barre d'onglets de région -- remis dans le header
// (#activityTabs, ACTIVITY_TABS dans combat/boss.js) le 2026-07-08, demande explicite : "remet les
// categorie compagnon et vie en mer dans le header". Retirés d'ici pour ne pas les dupliquer.
/** Reconstruit les onglets de palier de zone (ZONE_TIERS), cadenas pour les paliers non encore construits. */
function renderZoneTierTabs() {
  const el = $('zoneTierTabs'); if (!el) return;
  // cadenas déplacé AU-DESSUS, centré (2026-07-12, demande explicite : "réorganise les noms de
  // zone... pour qu'elle prenne qu'une seule ligne si possible en mettant le cadenas au dessus au
  // milieu de chaque item") -- avant, "🔒 🔵 Calpheon" tout sur la même ligne dans le texte du
  // bouton faisait déborder/passer à la ligne certains des 5 onglets ; le cadenas est maintenant un
  // badge séparé au-dessus (.zoneTierLock), le texte du bouton se limite à "🔵 Calpheon", plus court.
  // le libellé vit dans un <span> interne à sa propre troncature (overflow/ellipsis) -- le
  // <button> lui-même reste overflow:visible pour que le badge cadenas (position absolute, dépasse
  // au-dessus) ne soit jamais rogné par la troncature du texte.
  el.innerHTML = ZONE_TIERS.map(t => {
    const card = TIER_PREVIEW_CARD[t.id];
    const lockedTitle = card
      ? i18next.t('core:core.zone_tier.locked_title_with_drop', { icon: card.icon, name: tr(card.name) })
      : i18next.t('core:core.zone_tier.locked_title');
    return `<button class="catTab${t.id===zoneTier?' active':''}${t.locked?' locked':''}"` +
    `${t.locked?' disabled title="'+lockedTitle+'"':''} data-tier="${t.id}">` +
    `${t.locked?'<span class="zoneTierLock">🔒</span>':''}<span class="zoneTierLabel">${t.icon} ${t.label[LANG]}</span></button>`;
  }).join('');
  el.querySelectorAll('.catTab:not(.locked)').forEach(btn => {
    btn.onclick = () => { zoneTier = btn.dataset.tier; buildZoneList(); };
  });
}
// zonePlayerCounts/adminZoneIdx/veliaPlayers : alimentes par game-supabase.js (heartbeat), mais
// LUS ici des le tout premier hud() synchrone au demarrage (buildZoneList/updateVeliaPlayersTicker)
// -- declares ICI (pas dans game-supabase.js) pour eviter une erreur de zone morte temporelle
// (TDZ) une fois le jeu regroupe en un seul fichier (build/source.js) : un simple
// "typeof zonePlayerCounts !== 'undefined'" protege bien contre un fichier separe PAS ENCORE
// charge, mais PAS contre un `let` du MEME script pas encore atteint dans l'ordre d'execution
// (bug reel constate le 2026-07-08 lors de la mise en place du build : zonePlayerCounts/
// adminZoneIdx etaient declares dans game-supabase.js, qui charge apres game-core.js -- une fois
// bundles en un seul <script>, y accéder avant la ligne `let zonePlayerCounts = {}` levait
// "Cannot access before initialization" au lieu de simplement etre absent, gelant le jeu comme
// le bug V317 witchBodyOn).
let zonePlayerCounts = {};
let adminZoneIdx = null;
let veliaPlayers = [];
// readPatches/seenThisSession : meme raison (unreadPatchCount(), lu par updatePatchBadge() ->
// hud() des le demarrage, mais defini a l'origine dans game-supabase.js qui charge apres)
let readPatches = new Set();
try { readPatches = new Set(JSON.parse(localStorage.getItem('velia-patch-read') || '[]')); } catch(e) {}
let seenThisSession = new Set();
/** Reconstruit la liste de zones (#zoneList) : Velia épinglée en haut, zones groupées par palier de stuff (GEAR_TIERS.zones, pas l'ordre physique de ZONES), badges danger/PA-PD/upgrade/joueurs présents/admin ici. */
function buildZoneList() {
  renderZoneTierTabs();
  const list = $('zoneList');
  list.innerHTML = '';
  // Velia, la ville paisible : épinglée en haut, aucun monstre, aucun farm — juste un accès
  // rapide pour revoir le tutoriel de bienvenue à tout moment
  const veliaRow = document.createElement('div');
  veliaRow.className = 'zRow veliaRow' + (atVelia ? ' current' : '');
  veliaRow.title = i18next.t('core:core.velia.title');
  veliaRow.innerHTML =
    `<span class="zname">🏘️ Velia</span>` +
    `<span class="zBadge">${i18next.t('core:core.zone.peaceful_badge')}</span>` +
    `<span class="zreq" style="width:auto">${i18next.t('core:core.zone.no_monsters')}</span>`;
  veliaRow.onclick = () => { if (!atVelia) goToVelia(); };
  list.appendChild(veliaRow);
  // zones regroupées par palier de stuff (armure + bijou) — demande explicite du 2026-07-06 :
  // un en-tête coloré (pastille = couleur du palier) sépare les groupes de zones au lieu d'une
  // liste plate, pour bien voir quel stuff on farm dans quelle zone.
  // Parcourt GEAR_TIERS.zones (ordre LOGIQUE des paliers) plutôt que ZONES dans son ordre PHYSIQUE
  // (2026-07-05, bug corrigé) : les 4e zones de chaque palier ont été ajoutées en FIN de tableau
  // (voir ZONES) pour ne jamais décaler les index existants — les parcourir dans l'ordre physique
  // dédoublait les en-têtes de palier (grey/white/green/blue une 2e fois pour ces 4 zones-là).
  // zones offrant vraiment un meilleur socle (2026-07-09, demande explicite) — calculé UNE fois
  // avant la boucle, pas par ligne (chaque appel parcourt tous les slots équipables)
  const upgradeZones = zonesOfferingUpgrade();
  GEAR_TIERS.forEach(tier => {
    const head = document.createElement('div');
    head.className = 'zTierHead';
    head.innerHTML = `<span class="zTierDot" style="background:${tier.color}"></span>${tier.label[LANG]}`;
    list.appendChild(head);
    tier.zones.forEach(i => {
      const z = ZONES[i];
      const b = badgeOf(bottleneck(z));
      const apOk = apRatio(z) >= 1, dpOk = dpRatio(z) >= 1;
      const previewed = lootPreviewIdx==null ? i===zoneIdx : i===lootPreviewIdx;
      const row = document.createElement('div');
      const isCurrent = !atVelia && i===zoneIdx;
      row.className = 'zRow' + (isCurrent?' current':'');
      row.dataset.zi = i; // affichées dans l'ordre des PALIERS, pas l'ordre physique de ZONES — voir updateZoneViewHalo
      row.title = tr(z.name);
      if (!isCurrent) row.style.borderLeftColor = tier.color;
      // nombre de joueurs actuellement dans cette zone (demande explicite du 2026-07-06) — voir
      // zonePlayerCounts/refreshZonePlayerCounts (game-supabase.js), alimenté par le heartbeat de
      // présence toutes les 20s ; masqué (pas de case vide) tant que personne n'y est
      const pCount = (typeof zonePlayerCounts !== 'undefined' && zonePlayerCounts[i]) || 0;
      const hasUpgrade = upgradeZones.has(i);
      // étiquette "admin ici" (2026-07-15, demande explicite : "ajoute a coté des joueurs sur zone
      // une petite etiquette avec écris admin ici") -- visible par TOUS les joueurs depuis le
      // 2026-07-16 (demande explicite : "ettiquette admin montré a tout le monde") : avant, purement
      // client-side (isAdmin() + isCurrent), ne pouvait s'afficher que sur le propre client de
      // l'admin. adminZoneIdx (game-supabase.js, alimenté par get_admin_zone() côté serveur, voir sa
      // migration) renvoie l'index de zone où se trouve le SEUL compte admin, sans exposer
      // l'identité d'aucun autre joueur — même principe de minimisation que zonePlayerCounts.
      const adminHereTag = (typeof adminZoneIdx !== 'undefined' && adminZoneIdx === i)
        ? `<span class="zAdminTag" title="${i18next.t('core:core.zone.admin_tag_title')}">ADMIN</span>` : '';
      row.innerHTML =
        `<span class="zname">${tr(z.name)}</span>` +
        `<span class="zBadge ${b.cls}">${tr(b.txt.replace('ZONE ',''))}</span>` +
        `<span class="zreq"><span class="${apOk?'ok':'bad'}">${z.reqAP} PA</span> · <span class="${dpOk?'ok':'bad'}">${z.reqDP} PD</span></span>` +
        `<span class="zUpgradeIcon"${hasUpgrade?'':' style="visibility:hidden"'} title="${i18next.t('core:core.zone.better_gear_title')}">⬆️</span>` +
        // étiquette ADMIN désormais ancrée au-dessus du compteur de joueurs spécifiquement (2026-07-16,
        // demande explicite : "met le admin absolu au dessus du nombre des joueurs sur la zone") --
        // avant, positionnée en absolu par rapport à TOUTE la ligne (top-right), elle atterrissait
        // au-dessus du bouton 👁 (largeur variable des autres éléments avant elle) plutôt qu'au-dessus
        // du nombre lui-même ; sibling de zPlayerCount dans un wrapper dédié, jamais couplée à sa
        // visibilité (reste visible même si pCount vaut encore 0 au moment du rendu)
        `<span class="zPlayerCountWrap">${adminHereTag}<span class="zPlayerCount"${pCount?'':' style="visibility:hidden"'} title="${i18next.t('core:core.zone.players_here_title')}">👥 ${pCount}</span></span>` +
        `<button class="zBtnView${previewed?' active':''}" title="${i18next.t('core:core.zone.view_loot_title')}">👁</button>`;
      row.querySelector('.zBtnView').onclick = e => { e.stopPropagation(); renderLootTable(i); };
      row.onclick = () => { if (atVelia || i !== zoneIdx) travelTo(i); };
      // survol d'une zone -> surligne UNIQUEMENT les cases de la poupée que CETTE zone améliore
      // (2026-07-12, demande explicite) -- lien inverse du halo existant "case vide -> zones"
      row.onmouseenter = () => highlightEquipSlotsForZone(slotsUpgradedByZone(i));
      row.onmouseleave = () => highlightEquipSlotsForZone([]);
      list.appendChild(row);
    });
  });
}
// rafraîchit juste les compteurs "👥 N joueurs" (appelé toutes les 20s par refreshZonePlayerCounts,
// game-supabase.js), sans reconstruire toute la liste — même logique dataset.zi que le halo du 👁
/** Rafraîchit juste les compteurs "👥 N joueurs" de la liste de zones sans la reconstruire entièrement (appelé toutes les 20s). */
function updateZonePlayerCountBadges() {
  document.querySelectorAll('#zoneList .zRow:not(.veliaRow)').forEach(row => {
    const i = parseInt(row.dataset.zi, 10);
    const el = row.querySelector('.zPlayerCount'); if (!el) return;
    const n = (zonePlayerCounts && zonePlayerCounts[i]) || 0;
    el.textContent = `👥 ${n}`;
    el.style.visibility = n ? '' : 'hidden';
  });
}
// rafraîchit juste le halo du 👁 sans reconstruire toute la liste (appelé à chaque aperçu de loot)
/** Rafraîchit juste le halo actif du bouton 👁 (aperçu de loot) sans reconstruire la liste de zones, basé sur data-zi (pas la position DOM). */
function updateZoneViewHalo() {
  // se base sur data-zi (index réel de la zone), pas la position dans le DOM -- depuis que les
  // zones sont affichées groupées par PALIER (voir buildZoneList), l'ordre d'affichage ne
  // correspond plus à l'ordre physique 0..N de ZONES (2026-07-05, bug corrigé)
  document.querySelectorAll('#zoneList .zRow:not(.veliaRow)').forEach(row => {
    const i = parseInt(row.dataset.zi, 10);
    const previewed = lootPreviewIdx==null ? i===zoneIdx : i===lootPreviewIdx;
    row.querySelector('.zBtnView').classList.toggle('active', previewed);
  });
}
// nom + palier affichés en haut du cadre de jeu (#ztName/#ztTier) -- SEUL endroit qui les met à
// jour (2026-07-11, bug corrigé : "le nom de la zone doit être mis à jour et rester en place") :
// avant, seuls travelTo()/goToVelia() les modifiaient, jamais applySaveState() -- après un
// rechargement de page sur une zone différente de la zone 0, le nom affiché restait bloqué sur le
// texte statique du HTML ("Camp des Loups") tant que le joueur ne voyageait pas manuellement.
/** Met à jour le nom/palier affichés en haut du cadre de jeu (#ztName/#ztTier) — seul point d'appel qui les synchronise, y compris après un rechargement de sauvegarde. */
function updateZoneTitleText() {
  if (atVelia) {
    $('ztName').textContent = 'Velia'; // nom propre, identique dans toutes les langues -- ternaire d'origine n'avait aucune variante EN
    $('ztTier').textContent = i18next.t('core:core.velia.zone_type_label');
  } else {
    $('ztName').textContent = tr(Z().name);
    $('ztTier').textContent = Z().tier;
  }
}
/** @param {number} i - index de zone cible. Voyage vers une zone de farm : reset le monde, met à jour titre/loot/HUD/liste de zones/poupée d'équipement, log la 1ère découverte sur Discord. */
function travelTo(i) {
  atVelia = false;
  // quitter Velia : efface la liste de joueurs éventuellement affichée dans #lootTicker (2026-07-16)
  // -- sinon elle reste figée par-dessus le loot normal, qui s'ajoute juste après par appendChild
  // (voir lootLine()) sans jamais vider le conteneur lui-même.
  const lt = $('lootTicker'); if (lt) lt.innerHTML = '';
  // "pour le fun" (demande du 2026-07-08) : log Discord la 1ère fois qu'une zone est atteinte
  if (i > S.maxZoneIdx) logToDiscord('🗺️ Nouvelle zone', `**${myPseudo||'Joueur'}** atteint **${tr(ZONES[i].name)}** (${ZONES[i].tier}) pour la première fois`, 0x8fc98a);
  zoneIdx = i;
  if (i > S.maxZoneIdx) S.maxZoneIdx = i;
  S.travelCount = (S.travelCount||0) + 1;
  resetWorld();
  updateZoneTitleText();
  lootPreviewIdx = null; // farmer une nouvelle zone fait à nouveau suivre son loot par défaut
  renderLootTable();
  hud();
  buildZoneList();
  // "l'icône d'upgrade doit revenir sur le stuff... si elle est quittée" (2026-07-12, bug corrigé) :
  // renderEquipment() (badges ⬆️ pdUpgradeBtn de la poupée) n'était jusqu'ici rafraîchi QUE par
  // hud() quand la COMPOSITION du sac change (voir invSignature) -- upgradeZonesForEquippedSlot()
  // dépend pourtant de zoneIdx (une zone quittée redevient une source d'upgrade valide, voir son
  // filtre "atVelia || zi !== zoneIdx"), donc changer de zone SEULE ne rafraîchissait jamais la
  // poupée, qui restait figée sur l'état de la zone précédente jusqu'au prochain loot/vente.
  renderEquipment();
}
// liste des joueurs en ville, affichée dans #lootTicker à la place du loot normal (2026-07-16,
// demande explicite : "on peut voir la liste des joueurs dans la ville a droite a la place du loot
// ticker") -- aucun monstre à Velia donc le ticker de loot y est de toute façon toujours vide
// (lootLine() n'est jamais appelé sans pack), cette zone de l'écran est donc libre à réutiliser.
/** Affiche la liste des joueurs présents à Velia dans #lootTicker (réutilise cet espace, toujours vide à Velia puisqu'aucun monstre n'y génère de loot). No-op hors Velia. */
function updateVeliaPlayersTicker() {
  const t = $('lootTicker'); if (!t || !atVelia) return;
  const label = i18next.t('core:core.velia.in_town_label', { count: veliaPlayers.length });
  const rows = veliaPlayers.map(p => `<div class="veliaPlayerRow">${p.is_guest?'🎭':'👤'} ${escapeHtml(p.pseudo)}</div>`).join('');
  t.innerHTML = `<div class="veliaPlayersHead">${label}</div>` +
    (rows || `<div class="admHint">${i18next.t('core:core.velia.nobody_else')}</div>`);
}
// Velia : zone paisible, aucun monstre — ne lance plus le tutoriel automatiquement (voir
// demande du 2026-07-04), juste un endroit calme où se rendre (à la main ou après une mort)
/** Voyage vers Velia (zone paisible, aucun monstre) : reset le monde, met à jour titre/loot/HUD/liste de zones/poupée, rafraîchit la liste des joueurs en ville. */
function goToVelia() {
  atVelia = true;
  resetWorld();
  updateZoneTitleText();
  lootPreviewIdx = null;
  renderLootTable();
  hud();
  buildZoneList();
  renderEquipment(); // voir le commentaire équivalent dans travelTo()
  // affichage immédiat (état vide le temps que le serveur réponde), sans attendre le prochain tick
  // de refreshVeliaPlayers (20s, voir game-supabase.js)
  updateVeliaPlayersTicker();
  if (typeof refreshVeliaPlayers === 'function') refreshVeliaPlayers();
}
// mort au combat (PV à 0) : renvoie à Velia (zone paisible) avec un message d'avertissement —
// demande explicite du 2026-07-05, remplace l'ancien "faint" qui soignait sur place. Ne renvoie
// PLUS de force vers Velia si le joueur a déjà changé de zone pendant le K.O. (2026-07-09, demande
// explicite : "à la fin du timer tu es renvoyé en ville SI tu n'as pas changé de zone entre temps")
/** Gère la mort du joueur (PV à 0) : renvoie à Velia SEULEMENT si la zone n'a pas changé pendant le K.O., soigne à 50% PV, affiche la bannière de mort. */
function die() {
  const stayedPut = (zoneIdx === P.faintZoneIdx) && (atVelia === P.faintAtVelia);
  if (stayedPut) goToVelia();
  P.hp = effHpMax()*.5;
  S.lastDeathAt = Date.now(); // sert au bonus de zone des World Boss ("certifié sans mort 3 min", voir endBossFight)
  const banner = $('deathBanner');
  if (banner) {
    banner.textContent = stayedPut
      ? i18next.t('core:core.death.killed_by_monsters')
      : i18next.t('core:core.death.got_back_up');
    banner.classList.add('show');
    clearTimeout(die._t);
    die._t = setTimeout(() => banner.classList.remove('show'), 6000);
  }
}

// mise à jour légère des chiffres uniquement (aucune reconstruction de DOM lourde) —
// utilisée pour les actions fréquentes comme les tentatives d'optimisation
/** Met à jour les chiffres du HUD/panneau Stats sans reconstruire le DOM lourd (silver, niveau/XP, PA/PD/GS, bannières sac plein/zone dangereuse) — utilisé pour les actions fréquentes comme les tentatives d'optimisation. */
function refreshStatsOnly() {
  const invFullEl = $('invFullBanner');
  if (invFullEl) invFullEl.classList.toggle('show', invUsed() >= INV_SIZE);
  const dangerEl = $('dangerBanner');
  if (dangerEl) dangerEl.classList.toggle('show', !atVelia && isZoneDangerous());
  const apR = apRatio(), dpR = dpRatio(), z = Z();
  $('silver').textContent = fmt(S.silver);
  $('invLvl').textContent = S.lvl;
  $('invXpPct').textContent = fmtXpPct(S.xp / S.xpNext * 100);
  // niveau/XP fusionnés sur la même ligne que PA/PD/GS de l'équipement (demande explicite du
  // 2026-07-06) — mêmes valeurs que le HUD au-dessus de la vie, juste un 2e affichage
  const eqSumLvlEl = $('eqSumLvl'), eqSumXpEl = $('eqSumXp');
  if (eqSumLvlEl) eqSumLvlEl.textContent = i18next.t('core:core.equip_summary.lvl_prefix') + S.lvl;
  if (eqSumXpEl) eqSumXpEl.textContent = fmtXpPct(S.xp / S.xpNext * 100);
  $('stPS').textContent = Math.round(GS());
  // PA/PD affichés en entier, arrondis vers le bas (2026-07-08, demande explicite : "enleve toute
  // trace de virgule de PA/PD" -- ne jamais afficher plus que ce qui est réellement acquis)
  $('stPA').textContent = Math.floor(apEff());
  $('stDP').textContent = Math.floor(totalDP());
  $('stHpMax').textContent = fmt(Math.round(effHpMax()));
  $('stMpMax').textContent = fmt(Math.round(effManaMax()));
  $('stSpd').textContent = '+' + Math.round(totalSpdPct()) + '%';
  $('stDodge').textContent = Math.round(totalDodgePct(dpR)*10)/10 + '%';
  // affiche l'état du Compendium directement dans la zone de farm — demande explicite du 2026-07-08
  const ztComp = $('ztCompendium');
  if (ztComp) {
    const zc = compendiumZoneCount(), complete = zc >= ZONES.length;
    ztComp.textContent = (complete ? '📖✓ ' : '📖 ') + zc + '/' + ZONES.length;
    ztComp.className = complete ? 'complete' : '';
  }
  const apEl = $('stApZone');
  const dpEl = $('stDpZone');
  if (atVelia) {
    apEl.textContent = '—'; apEl.className = 'v'; // identique dans toutes les langues -- ternaire d'origine n'avait aucune variante EN
    dpEl.textContent = '—'; dpEl.className = 'v';
  } else {
    apEl.textContent = Math.floor(apEff()) + ' / ' + z.reqAP;
    apEl.className = 'v ' + (apR >= 1 ? 'ok' : 'bad');
    dpEl.textContent = Math.floor(totalDP()) + ' / ' + z.reqDP;
    dpEl.className = 'v ' + (dpR >= 1 ? 'ok' : 'bad');
  }
  $('stMode').textContent = tr(aiMode());
  $('stKills').textContent = S.kills;
  $('stLoot').textContent = S.lootCount;
  const mins = (performance.now()-S.startTime)/60000;
  const kpmNow = mins>.1 ? (S.kills-(S.killsAtLoad||0))/mins : 0;
  $('stKpm').textContent = mins>.1 ? kpmNow.toFixed(1) : '—';
  // record kills/min : on exige au moins 2 min de session pour éviter qu'un petit échantillon
  // bruité (ex: 3 kills en 5 secondes juste après un chargement) ne fausse le record à vie —
  // même précaution que le faux positif silver_per_hour corrigé le 2026-07-06
  // fenêtre glissante 3 min + garde-fous anti-pic (2026-07-13, même traitement que
  // bestSilverPerHour, voir computeSlidingKpm) EN PLUS du garde-fou "2 minutes de session" déjà
  // en place ci-dessus (double protection, pas un remplacement).
  pruneKpmRateBuffer();
  if (mins > 2) {
    const { ratePerMin: kpmSliding, eligible } = computeSlidingKpm(kpmRateBuffer, Date.now(), S.bestKpm||0);
    if (eligible && kpmSliding > (S.bestKpm||0)) {
      // "pour le fun" (demande du 2026-07-08) : seuil de +0.5 kills/min pour ne pas spammer sur du bruit
      if (kpmSliding - (S.bestKpm||0) > 0.5) logToDiscord('🏹 Record kills/min', `**${myPseudo||'Joueur'}** bat son record perso : **${kpmSliding.toFixed(1)}** kills/min (${tr(Z().name)})`, 0xc9a55a);
      S.bestKpm = kpmSliding;
    }
  }
  // "1M5/h alors que c'est faux" (2026-07-18) -- l'ancien affichage extrapolait le gain sur une
  // fenêtre dès 6s de session (mins>.1) directement en silver/HEURE (×60 sur cette fenêtre) : un
  // seul gros loot juste après le chargement suffisait à afficher un chiffre absurde. Le chiffre
  // affiché en direct est désormais silver/MIN (même fenêtre, mais sans le facteur ×60 qui
  // amplifiait le bruit), et le silver/h projeté ne devient un RECORD (voir bestSilverPerHour
  // ci-dessus) qu'après 2 min de session — même garde-fou que kpmNow/bestKpm juste au-dessus.
  const tokenGain = S.tokenSilverEarned-(S.tokenSilverEarnedAtLoad||0);
  const silverPerMinNow = mins>.1 ? tokenGain/mins : 0;
  // record silver/h : fenêtre glissante 3 min + garde-fou anti-pic 30% (voir
  // computeSlidingSilverPerHour ci-dessus) EN PLUS du garde-fou "2 min de session minimum" déjà en
  // place ici (double protection, pas un remplacement) -- remplace l'ancien calcul sur
  // tokenGain/(minutes de session ENTIÈRE), qui grandissait en continu et restait sensible à un
  // pic isolé (ex: rattrapage groupé juste après une reconnexion) pendant plusieurs minutes.
  pruneSilverRateBuffer();
  if (mins > 2) {
    const { ratePerHour: silverPerHourNow, eligible } = computeSlidingSilverPerHour(silverRateBuffer, Date.now(), S.bestSilverPerHour||0);
    if (eligible && silverPerHourNow > (S.bestSilverPerHour||0)) S.bestSilverPerHour = silverPerHourNow;
  }
  $('shRate').textContent = mins>.1
    ? fmt(Math.round(silverPerMinNow))+' silver/min'+(S.bestSilverPerHour ? ' · record '+fmt(Math.round(S.bestSilverPerHour))+'/h' : '')
    : '— silver/min';
  // record perso xp/h À VIE -- même fenêtre glissante 3min + anti-pic 30% que silver/h et kpm
  // (2026-07-13, même correctif appliqué aux 3 records). S.xpEarned est le compteur cumulatif À VIE
  // (ne redescend JAMAIS, contrairement à S.xp qui se remet à 0 à chaque niveau -- voir gainXp) ;
  // xpEarnedAtLoad est la baseline de session, posée/reposée dans applySaveState(), gardée pour
  // l'affichage live (pas pour le calcul du record, désormais fondé sur xpRateBuffer).
  pruneXpRateBuffer();
  if (mins > 2) {
    const { ratePerHour: xpPerHourNow, eligible } = computeSlidingXpPerHour(xpRateBuffer, Date.now(), S.bestXpPerHour||0);
    if (eligible && xpPerHourNow > (S.bestXpPerHour||0)) S.bestXpPerHour = xpPerHourNow;
  }
  // records PA/PD à vie (voir S.bestAp/S.bestDp ci-dessus) -- simple max courant, pas besoin du
  // garde-fou "2 minutes" de bestKpm/bestSilverPerHour : ce ne sont pas des taux bruités sur une
  // fenêtre courte, juste l'état d'équipement actuel, jamais faussé par un petit échantillon de temps.
  const apNow = apEff(), dpNow = totalDP();
  if (apNow > (S.bestAp||0)) S.bestAp = apNow;
  if (dpNow > (S.bestDp||0)) S.bestDp = dpNow;
  // bestGearscore DÉRIVÉ de bestAp/bestDp (2026-07-13, bug trouvé : "les premiers qui sont full
  // stuff n'ont pas le même GS") -- avant, gsNow = GS() était tracké comme un 3e record INDÉPENDANT
  // (`if (gsNow > bestGearscore) ...`), pouvant capturer son pic à un instant différent de celui où
  // bestAp/bestDp ont atteint LEUR pic respectif (ex: PA au plus haut avec une arme pas encore
  // remplacée, PD au plus haut atteint plus tard avec une meilleure armure) -- bestGearscore
  // dérivait alors silencieusement de (bestAp+bestDp)/2, affichant un GS incohérent avec les PA/PD
  // juste à côté au classement, même pour un stuff aujourd'hui strictement identique entre 2
  // joueurs. Dérivé ici : reste monotone (bestAp/bestDp ne redescendent jamais) tout en garantissant
  // bestGearscore === (bestAp+bestDp)/2 à tout instant.
  S.bestGearscore = (S.bestAp + S.bestDp) / 2;
  const zb = $('zoneBadge');
  if (atVelia) {
    zb.className = 'b-green'; zb.textContent = i18next.t('core:core.zone.peaceful_badge');
    $('ztReq').textContent = i18next.t('core:core.zone.no_monsters');
  } else {
    const b = badgeOf(bottleneck());
    zb.className = b.cls; zb.textContent = tr(b.txt);
    // rend le danger tangible (2026-07-05, demande explicite) : rappel au survol de la pénalité de
    // vitesse (toi) / bonus de vitesse (monstres aggro) en zone dangereuse -- voir isZoneDangerous()
    zb.title = b.cls === 'b-red'
      ? i18next.t('core:core.zone.too_hard_warning')
      : '';
    $('ztReq').innerHTML = `<span class="${apR>=1?'ok':'bad'}">${Math.floor(apEff())}/${z.reqAP} PA</span> · <span class="${dpR>=1?'ok':'bad'}">${Math.floor(totalDP())}/${z.reqDP} PD</span>`;
  }
}
// version complète : chiffres + reconstruction du DOM (192 cases d'inventaire, liste des 12 zones, paperdoll...)
// coûteuse — appelée automatiquement chaque seconde, et sur les actions peu fréquentes (loot, équiper, changer de zone)
// signatures bon marché pour éviter de reconstruire le DOM (192 cases + poupée + liste
// de zones) chaque seconde quand rien n'a réellement changé — avant ce correctif, hud()
// refaisait tout ce travail en continu, pour toujours, même quand le joueur ne looter/
// n'équipait/ne voyageait pas cette seconde-là précise
let lastInvSig = '', lastZoneSig = '';
/** @returns {string} signature bon marché du sac+équipement (clé/qté/enhLv de chaque slot), sert à éviter de reconstruire le DOM inventaire quand rien n'a réellement changé (voir hud()). */
function invSignature() {
  let s = '';
  for (let i = 0; i < INV_SIZE; i++) { const it = INV[i]; s += it ? (it.key+','+it.qty+','+(it.enhLv||0)) : '_'; s += '|'; }
  // EQUIP inclus depuis le 2026-07-14 (bug trouvé : "l'affichage ap dp au dessus du personnage
  // n'est parfois pas instantané et parfois figé mauvaise valeur") -- une réussite d'optimisation
  // change EQUIP[slot].enhLv SANS toucher au sac, donc cette signature ne changeait pas et
  // refreshInvUI()/renderEquipment() (le résumé PA/PD au-dessus du perso) ne se rafraîchissait que
  // par coïncidence, au prochain vrai changement de sac (loot/vente/équipement d'un autre objet)
  for (const k of Object.keys(EQUIP)) { const e = EQUIP[k]; s += e ? (e.key+','+(e.enhLv||0)) : '_'; s += '|'; }
  return s;
}
/** @returns {string} signature bon marché de la zone+puissance courantes, sert à éviter de reconstruire la liste de zones à chaque tick (voir hud()). */
function zoneSignature() { return zoneIdx + ':' + atVelia + ':' + Math.round(apEff()) + ':' + Math.round(totalDP()); }

// badge "1" sur Wiki/Compendium/Codex/Succès après une modification de contenu, RETIRÉ dès que CE
// joueur ouvre le panneau (2026-07-06, demande explicite : "affiche plutot un numero qui s'enleve
// une fois lu et a l'interieur met en évidence ce qui a été modifié" — remplace la version
// précédente, un simple "NEW" clignotant pendant 24h pour tout le monde sans lien avec la lecture).
// Chaque entrée porte aussi une courte description ("desc") du changement, affichée en évidence en
// haut du panneau tant qu'il n'a pas encore été ouvert depuis ce changement.
// RÈGLE À SUIVRE DÉSORMAIS : mettre à jour "at" (et "desc") à chaque modification de contenu dans
// un de ces 4 panneaux.
// numéro de version PAR PANNEAU, pas un horodatage -- un 1er essai avec des dates ISO "à venir
// dans la journée" (ex: '...T07:00:00Z') s'est révélé cassé en le testant : si l'heure choisie est
// dans le FUTUR par rapport à l'horloge réelle au moment du déploiement, contentIsUnread() reste
// vrai pour toujours (aucun "vu" ne peut jamais dépasser une date future) -- le badge ne
// disparaissait JAMAIS, peu importe combien de fois le panneau était ouvert. Un simple compteur
// entier incrémenté à la main élimine tout risque de désynchronisation d'horloge.
const CONTENT_UPDATE_VERSION = {
  wiki:         { v:2, desc:{fr:'1 arme garantie sur les 3 dernières zones de chaque palier (plus rien sur la 1ère)',en:'1 guaranteed weapon on a tier\'s last 3 zones (none on the 1st)'} },
  compendium:   { v:1, desc:{fr:'Clique un objet pour voir dans quelles zones le farmer',en:'Click an item to see which zones farm it'} },
  codex:        { v:1, desc:{fr:'Liste à jour de tous les objets du jeu',en:'Up to date list of every item in the game'} },
  achievements: { v:2, desc:{fr:'Nouveau visuel : succès groupés par chaîne de paliers, vue d\'ensemble et derniers débloqués',en:'New look: achievements grouped into tiered chains, overview and recent unlocks'} },
};
/** @param {string} panel - clé de CONTENT_UPDATE_VERSION. @returns {string} clé localStorage de dernière version vue de ce panneau. */
function contentSeenKey(panel) { return 'velia-idle-seenv-'+panel; }
/** @param {string} panel. @returns {number} numéro de version du dernier changement vu par ce joueur pour ce panneau (0 si jamais). */
function contentLastSeenVersion(panel) {
  try { return parseInt(localStorage.getItem(contentSeenKey(panel))||'0', 10) || 0; } catch(e) { return 0; }
}
/** @param {string} panel. @returns {boolean} vrai si le panneau a un changement de contenu plus récent que la dernière ouverture de ce joueur. */
function contentIsUnread(panel) {
  const entry = CONTENT_UPDATE_VERSION[panel]; if (!entry) return false;
  return entry.v > contentLastSeenVersion(panel);
}
// à appeler à l'OUVERTURE de chaque panneau (après avoir déjà lu contentIsUnread pour l'affichage
// de cette ouverture précise) — le badge disparaît, mais la mise en évidence reste visible tant
// que le panneau affiché à l'écran ne s'est pas refermé/rouvert
/** @param {string} panel. Marque la version actuelle du panneau comme vue (localStorage), retire le badge "1" (à appeler à l'ouverture du panneau, après avoir lu contentIsUnread pour cette ouverture). */
function markContentSeen(panel) {
  const entry = CONTENT_UPDATE_VERSION[panel]; if (!entry) return;
  try { localStorage.setItem(contentSeenKey(panel), String(entry.v)); } catch(e) {}
  refreshContentNewBadges();
}
// callout affiché en haut du panneau tant qu'il n'a pas encore été ouvert depuis le changement
/** @param {string} panel. @returns {string} HTML du callout "🆕 ..." affiché en haut du panneau tant qu'il n'a pas été ouvert depuis ce changement, vide sinon. */
function contentChangeCalloutHtml(panel) {
  if (!contentIsUnread(panel)) return '';
  const entry = CONTENT_UPDATE_VERSION[panel]; if (!entry || !entry.desc) return '';
  return `<div class="contentNewCallout">🆕 ${escapeHtml(entry.desc[LANG]||entry.desc.fr)}</div>`;
}
/** Rafraîchit les pastilles "1" de Wiki/Compendium/Codex/Succès selon contentIsUnread() de chacun. */
function refreshContentNewBadges() {
  const map = { wiki:'newBadgeWiki', compendium:'newBadgeCompendium', codex:'newBadgeCodex', achievements:'newBadgeAchievements' };
  for (const key in map) {
    const el = $(map[key]); if (!el) continue;
    el.textContent = '1';
    el.classList.toggle('show', contentIsUnread(key));
  }
}

/** Boucle d'affichage principale (appelée ~1×/s + après chaque action) : stats/zone/inventaire reconstruits seulement si leur signature a changé, quêtes/succès/loyalty/badges toujours resynchronisés. */
function hud() {
  refreshStatsOnly();
  drawZoneMobIcon();
  renderFarmModeBtn();
  const zSig = zoneSignature();
  // syncFarmCardHeights() force une lecture de mise en page (getBoundingClientRect) — coûteux à
  // répéter à CHAQUE appel de hud() (bien plus qu'1×/s en combat actif, hud() étant aussi appelé
  // après chaque loot/vente/équipement). Ne le refaire que quand la liste de zones est VRAIMENT
  // reconstruite (même déclencheur que buildZoneList) + au redimensionnement (voir plus bas) —
  // remonté en jeu le 2026-07-06 ("la souris se met à buguer si je garde les onglets ouverts") :
  // ce recalcul répété pendant des heures de session active était un coût inutile à éliminer,
  // même sans certitude que ce soit LA cause exacte du ralenti.
  if (zSig !== lastZoneSig) { lastZoneSig = zSig; buildZoneList(); syncFarmCardHeights(); }
  const iSig = invSignature();
  if (iSig !== lastInvSig) { lastInvSig = iSig; refreshInvUI(); }
  // silver/loyalty peuvent changer sans toucher à la composition du sac (récompense de succès,
  // de quête, de boss, achat...) -- mis à jour hors du gate d'invSignature, sinon l'affichage
  // reste visuellement obsolète jusqu'au prochain vrai changement d'inventaire
  const invSilverEl = $('invSilver'); if (invSilverEl) invSilverEl.textContent = fmt(S.silver);
  const invLoyaltyEl2 = $('invLoyalty'); if (invLoyaltyEl2) invLoyaltyEl2.textContent = '🏅 '+fmt(S.loyalty||0);
  ensureQuests('daily');
  ensureQuests('weekly');
  checkAchievements();
  updateQuestBadge();
  renderQuestWidget();
  if (typeof renderPlaytimeWidget === 'function') renderPlaytimeWidget();
  renderQuestTrackerWidget();
  ensureLoyaltyGrant();
  updateMailBadge();
  refreshContentNewBadges();
  // resynchronise la pastille "notes de version non lues" en haut de page : elle doit disparaître
  // dès qu'un panneau se referme (quel que soit le chemin de fermeture — bouton ✕, clic sur le
  // fond, Échap...), voir updatePatchBadge (game-supabase.js)
  if (typeof updatePatchBadge === 'function') updatePatchBadge();
  // met en évidence "⚡ Équiper meilleur" dès qu'un objet oublié plus de 15s est meilleur que
  // l'équipé (2026-07-09, demande explicite) — recalculé chaque seconde (hud tourne sur un
  // setInterval(hud,1000)), pas besoin d'un timer dédié
  const equipBestBtn = $('btnEquipBest');
  if (equipBestBtn) equipBestBtn.classList.toggle('hasUpgrade', hasNeglectedUpgradeInBag());
}
// aligne la hauteur des cartes "Zones de farm" et "Loot de cette zone" sur celle de la carte
// Statistiques (demande explicite du 2026-07-06 : "fait en sorte que les carte zone de farm et
// loot de cette zone fasse la meme taille que statistique") -- #statsCard a un contenu fixe (13
// lignes), donc une hauteur assez stable ; les 2 autres ont un contenu variable (nb de zones/objets)
// plafonné jusqu'ici par un max-height:60vh fixe, sans rapport avec la hauteur réelle de
// Statistiques -- d'où l'écart visible. Mesure la hauteur RÉELLE de Statistiques et l'applique en
// max-height sur les listes internes (le défilement absorbe le surplus de contenu).
/** Aligne la hauteur des cartes "Zones de farm"/"Loot"/"Coffre" sur celle de la carte Statistiques (mesure réelle, jamais de valeur fixe). Appelé seulement quand la liste de zones est reconstruite ou au redimensionnement, pas à chaque tick (coûteux, cause un ralenti connu). */
function syncFarmCardHeights() {
  const statsCard = $('statsCard');
  if (!statsCard) return;
  const targetH = statsCard.getBoundingClientRect().height;
  if (targetH < 50) return; // pas encore mis en page (ex: juste après le chargement)
  // coffre de ville (2026-07-08, demande explicite : "borne la taille de la fiche coffre a une
  // taille standard par rapport au autre") -- vivait avec un max-height fixe (260px, sans rapport
  // avec la hauteur réelle des cartes voisines) au lieu de suivre ce même mécanisme de synchro que
  // zoneList/lootTable. #veliaChestGrid partage la carte #lootCard avec #lootTable (2 onglets
  // mutuellement exclusifs, voir le bascule Loot/Coffre dans inventory-ui.js) -- son overhead n'est
  // mesurable correctement que quand cet onglet est réellement visible (sinon hauteur 0, display:
  // none), d'où le rappel explicite de syncFarmCardHeights() au moment du clic sur l'onglet Coffre.
  [['zonesCard','zoneList'], ['lootCard','lootTable'], ['lootCard','veliaChestGrid']].forEach(([cardId, listId]) => {
    const card = $(cardId), list = $(listId);
    if (!card || !list) return;
    const listH = list.getBoundingClientRect().height;
    if (listH === 0) return; // onglet masqué (ex: Coffre pendant que Loot est affiché) -- pas mesurable maintenant, sera recalculé quand cet onglet redevient visible
    const overhead = card.getBoundingClientRect().height - listH; // en-tête/onglets/marges
    const newListH = Math.max(80, Math.round(targetH - overhead));
    list.style.maxHeight = newListH + 'px';
  });
}
window.addEventListener('resize', () => { if (typeof syncFarmCardHeights === 'function') syncFarmCardHeights(); });
/** Rafraîchit à chaque frame les éléments à jour élevée (barres PV/mana/cooldowns potions, cooldowns de sorts, barre d'incantation) — distinct de hud() qui tourne plus rarement. */
function hudFast() {
  $('stateName').textContent = STATE_FR[P.state]||P.state;
  if (P.hp > effHpMax()) P.hp = effHpMax(); // déséquiper une pièce peut faire baisser le max courant
  const hpPct = Math.max(0,P.hp/effHpMax()*100);
  $('hpFill').style.width = hpPct+'%';
  $('hpPct').textContent = Math.round(hpPct)+'%';
  // mana (2026-07-05, demande explicite) : même principe que la barre de PV, juste en dessous
  if (P.mp > effManaMax()) P.mp = effManaMax();
  const mpPct = Math.max(0,P.mp/effManaMax()*100);
  $('mpFill').style.width = mpPct+'%';
  $('mpPct').textContent = Math.round(mpPct)+'%';
  $('manaPotCd').style.height = (P.manaPotCd/MANA_POTION.cd*100)+'%';
  const pot = POTIONS[S.potionType] || POTIONS.medium;
  $('potCd').style.height = (P.potCd/pot.cd*100)+'%';
  // case unique vie+mana (2026-07-08) : l'icône est désormais FIXE (fiole vie+mana générique),
  // plus besoin de la changer selon la taille de potion choisie (ça reste géré dans le panneau) —
  // rendue une seule fois (innerHTML déjà posé au premier hud() suffit, voir plus bas)
  const dualIcon = $('potDualIcon');
  if (dualIcon && !dualIcon.dataset.set) { dualIcon.innerHTML = ICO_POTION_DUO; dualIcon.dataset.set = '1'; }
  const potCostNow = potionCost(pot.cost), manaCostNow = potionCost(MANA_POTION.cost);
  $('potSlot').title = pot.name[LANG] + (potCostNow>0 ? ` — ${fmt(potCostNow)} silver/${i18next.t('core:core.potions.usage_word')} (+${Math.round(effHpMax()*pot.heal)} PV, ${Math.round(pot.heal*100)}%, CD ${pot.cd}s)` : i18next.t('core:core.potions.free_suffix', { cd: pot.cd })) +
    ' · ' + MANA_POTION.name[LANG] + ` — ${fmt(manaCostNow)} silver/${i18next.t('core:core.potions.usage_word')} (+${Math.round(MANA_POTION.restore*100)}% MP, CD ${MANA_POTION.cd}s, auto)`;
  for (const s of SKILLS) {
    const el = skEls[s.id];
    el.querySelector('.cd').style.height = (cds[s.id]/s.cd*100)+'%';
    el.classList.toggle('cast', P.castingSkill===s);
    el.classList.toggle('buffed', s.type==='buff' && buffTimer>0);
  }
  renderCastBar();
}
// barre d'incantation (2026-07-05, demande explicite) : "----------o----------", la matière se
// retire des 2 côtés vers le centre au fil du temps -- le sort part quand elle a disparu. scaleX
// part de 1 (barre pleine) et va vers 0 (juste le point central) en suivant P.castProgress.
/** Anime la barre d'incantation ("----o----", se retire des 2 côtés vers le centre selon P.castProgress), masquée si aucun sort en cours de cast. */
function renderCastBar() {
  const bar = $('castBar');
  if (!P.castingSkill) { bar.classList.remove('show'); return; }
  bar.classList.add('show');
  const remain = Math.max(0, 1 - P.castProgress);
  $('castBarLeft').style.transform = `scaleX(${remain})`;
  $('castBarRight').style.transform = `scaleX(${remain})`;
  $('castBarLabel').textContent = P.castingSkill.name;
}

// ==================== BOUCLE ====================
let last = performance.now();
// simulation extraite de loop() en fonction séparée (2026-07-15, demande explicite : "fais en sorte
// que le jeu ne s'arrete pas une fois changer d'onglet, on doit farmer meme sur un autre onglet du
// jeu ou du navigateur") -- retirer le check document.hidden (fait le 2026-07-14) ne suffisait PAS :
// requestAnimationFrame lui-même est THROTTLÉ/SUSPENDU par le navigateur dès que l'onglet n'est
// plus visible, quel que soit le code JS qui l'appelle -- aucune ligne de ce fichier ne peut
// changer ce comportement du navigateur. La vraie solution : un setInterval (voir tout en bas de
// cette fonction) qui, lui, continue de tourner en arrière-plan (juste clampé à ~1s minimum par les
// navigateurs, jamais suspendu comme rAF) prend le relais pour cette même fonction quand l'onglet
// est caché, avec un dt basé sur le temps RÉEL écoulé (pas un FPS supposé).
/**
 * Simulation d'un tick de jeu (dt réel écoulé depuis le dernier appel, plafonné à 2s) : gate sur
 * sessionLocked/combat de boss, respawn les packs manquants, purge corpses/floats, avance FSM/
 * combat/loot/particules, suit la caméra. Appelée par loop() (rAF, tant que l'onglet est visible)
 * ET par un setInterval de secours (tant que l'onglet est masqué, rAF étant throttlé par le
 * navigateur) — c'est ce qui permet au farm de continuer en arrière-plan.
 * @param {number} now - horodatage performance.now() de cet appel.
 */
function advanceSim(now) {
  const dt = Math.min(2, (now-last)/1000); last = now;
  if (dt <= 0) return;
  // verrou multi-session (2026-07-10, demande explicite : "Interdire multionglet, multi navigateur
  // and multidevice") -- sessionLocked posé par checkPlayerSession() (game-supabase.js) dès qu'une
  // AUTRE session a pris le relais sur ce compte. Bloque ICI (avant tout effet de bord : spawn,
  // fsm, drops...) plutôt qu'au niveau du rAF/setInterval qui l'appellent, pour couvrir les deux
  // chemins d'un coup (onglet visible ET filet de secours en arrière-plan, voir plus bas).
  if (typeof sessionLocked !== 'undefined' && sessionLocked) return;
  // pendant un combat de boss (plein écran), on met le farm en pause : la salle de boss couvre
  // tout l'écran, inutile de continuer à simuler la zone de farm derrière
  if (bossState.active) return;
  // BUG trouvé le 2026-07-07 : cette respawn continue n'était jamais gardée par atVelia — Velia
  // partait bien à 0 pack (resetWorld), mais dès la frame suivante ce respawn en ajoutait jusqu'à
  // en avoir 6, remplissant en boucle la "zone paisible" de monstres. Confirmé par le joueur.
  if (!atVelia && packs.filter(p=>!p.dead).length < targetPackCount()) spawnPackNear();
  // les packs morts ne sont plus jamais dessinés (voir render()) ni utilisés ailleurs —
  // avant ce correctif ils restaient dans le tableau tant que le joueur ne s'éloignait pas
  // de 900 unités, ce qui faisait grossir `packs` indéfiniment sur une session de farm
  // prolongée dans la même zone et ralentissait le jeu de plus en plus au fil du temps.
  packs = packs.filter(p=>!p.dead);
  corpses.forEach(c=>c.life-=dt); corpses = corpses.filter(c=>c.life>0);
  floats.forEach(f=>f.life-=dt); floats = floats.filter(f=>f.life>0);

  fsm(dt);
  wolvesTick(dt);
  dropsTick(dt);
  particlesTick(dt);

  cam.x += (P.x-cam.x)*Math.min(1,dt*4);
  cam.y += (P.y-cam.y)*Math.min(1,dt*4);
}
/** @param {number} now - performance.now() (fourni par requestAnimationFrame). Boucle de rendu principale : avance la simulation, dessine le monde, met à jour le HUD rapide, se replanifie. Skip pendant un combat de boss (plein écran séparé). */
function loop(now) {
  if (bossState.active) { requestAnimationFrame(loop); return; }
  advanceSim(now);
  render(now/1000);
  hudFast();
  requestAnimationFrame(loop);
}
// filet de secours en arrière-plan (2026-07-15) : ne fait RIEN tant que l'onglet est visible (rAF
// s'en charge déjà, ce setInterval serait redondant) -- dès que l'onglet est caché, prend le relais
// pour que kills/loot/déplacement continuent réellement d'avancer, pas juste "en théorie"
setInterval(() => { if (document.hidden) advanceSim(performance.now()); }, 1000);

// Inventaire/Equipement -- UI (paperdoll, grille, enchantement, auto-opti) -> voir inventory-ui.js (charge APRES boss.js, AVANT render.js -- voir index.html)
// ==================== SAUVEGARDE (prêt pour Supabase) ====================
// Rassemble tout l'état du joueur en un objet JSON sérialisable.
// C'est CE bloc qui doit être envoyé/lu depuis la table Supabase "game_saves".
/** @returns {object} instantané JSON-sérialisable de tout l'état joueur (S, EQUIP, INV, sacs spéciaux, zone, position) — c'est ce bloc qui est envoyé/lu depuis Supabase (table game_saves). */
function getSaveState() {
  return {
    version: 1,
    S: { ...S },
    EQUIP: JSON.parse(JSON.stringify(EQUIP)),
    INV: JSON.parse(JSON.stringify(INV)),
    COMPENDIUM_BAG: JSON.parse(JSON.stringify(COMPENDIUM_BAG)),
    VELIA_CHEST: JSON.parse(JSON.stringify(VELIA_CHEST)),
    zoneIdx,
    playerPos: { x: P.x, y: P.y },
    savedAt: new Date().toISOString(),
  };
}
/**
 * Restaure un instantané de getSaveState() dans l'état live du jeu : S/EQUIP/INV/sacs spéciaux,
 * zone/position (playerPos restauré AVANT resetWorld() pour que les packs spawnent au bon
 * endroit), lance toutes les migrations rétroactives gear-migrations.js (une seule fois chacune,
 * gatées par leur flag S.migratedXxxVNNN), puis calcule et applique le rattrapage hors-ligne
 * (computeOfflineCatchupSilver + computeOfflineCatchupXp + computeOfflineCatchupLoot) avant d'afficher le résumé au retour si
 * applicable.
 * @param {object} data - instantané produit par getSaveState() (ou chargé depuis Supabase/fichier).
 * @returns {boolean} vrai si appliqué, faux si `data` est absent ou d'une version incompatible.
 */
function applySaveState(data) {
  if (!data || data.version !== 1) return false;
  // calculé AVANT Object.assign : le taux/niveau "avant" doivent venir de la sauvegarde chargée
  // (data.S), pas de l'état par défaut encore présent dans S à cet instant (voir
  // computeOfflineCatchupSilver ci-dessus).
  const offlineSilverGain = computeOfflineCatchupSilver(data);
  const offlineXpGain = computeOfflineCatchupXp(data);
  const offlineLootItems = computeOfflineCatchupLoot(data);
  const offlineLevelBefore = data.S ? data.S.lvl : 1;
  const offlinePercentBefore = data.S ? Math.round((data.S.xp||0) / xpNeededFor(data.S.lvl||1) * 100) : 0;
  const offlineSavedAtMs = data.savedAt ? Date.parse(data.savedAt) : Date.now();
  Object.assign(S, data.S);
  // repart sur une base FRAÎCHE pour les stats de SESSION (silver/h, kills/min) — voir le
  // commentaire sur silverEarnedAtLoad/killsAtLoad plus haut ; corrige le faux positif anti-triche
  // du 2026-07-06 (silver_per_hour astronomique juste après le chargement d'une sauvegarde)
  S.startTime = performance.now();
  S.silverEarnedAtLoad = S.silverEarned || 0;
  S.tokenSilverEarnedAtLoad = S.tokenSilverEarned || 0;
  S.killsAtLoad = S.kills || 0;
  // baseline xp/h de session (voir S.xpEarnedAtLoad plus haut) -- reposée une 2e fois plus bas,
  // APRÈS application du rattrapage XP hors-ligne, pour que ce rattrapage ne s'auto-inflate pas
  // (même principe que tokenSilverEarned volontairement exclu de addSilver('offline_catchup', ...)).
  S.xpEarnedAtLoad = S.xpEarned || 0;
  // absents des sauvegardes antérieures à cette feature (2026-07-19) -- filet défensif, pas besoin
  // d'une migration dédiée (gear-migrations.js) puisqu'un objet vide est déjà l'état "jamais tué ce
  // boss avec pity", identique à un vrai nouveau joueur -- aucune donnée existante à corriger.
  S.bossPity = S.bossPity || {};
  S.bossLastKillWeek = S.bossLastKillWeek || {};
  // Mini Boss (2026-07-13) : compteurs de réputation locaux — feature entièrement nouvelle, aucune
  // donnée existante ne change de sens (CLAUDE.md §13 ne s'applique pas), un objet vide suffit comme
  // filet défensif (voir src/combat/miniboss.js, minibossRepCounters()).
  S.minibossRep = S.minibossRep || { groupsCreated:0, runsJoined:0, soloQuits:0, disconnects:0, votes:0, runsClean:0, runsIncident:0 };
  Object.keys(EQUIP).forEach(k => EQUIP[k] = data.EQUIP[k] ?? null);
  for (let i = 0; i < INV_SIZE; i++) INV[i] = data.INV[i] ?? null;
  // sac "Compendium" (2026-07-08) : absent des sauvegardes antérieures à cette version, ?? null
  // migre proprement les anciennes sauvegardes (toutes les cases restent vides, rien à perdre)
  for (let i = 0; i < INV_SIZE; i++) COMPENDIUM_BAG[i] = data.COMPENDIUM_BAG?.[i] ?? null;
  // coffre de ville (2026-07-16) : même migration douce que le sac Compendium ci-dessus
  for (let i = 0; i < INV_SIZE; i++) VELIA_CHEST[i] = data.VELIA_CHEST?.[i] ?? null;
  if (!S.migratedGearRebalanceV158) { migrateGearRebalanceV158(); S.migratedGearRebalanceV158 = true; }
  if (!S.migratedEarringRebalanceV175) { migrateEarringRebalanceV175(); S.migratedEarringRebalanceV175 = true; }
  if (!S.migratedArmorNoApV192) { migrateArmorNoApV192(); S.migratedArmorNoApV192 = true; }
  if (!S.migratedJewelryApV207) { migrateJewelryApV207(); S.migratedJewelryApV207 = true; }
  if (!S.migratedGearFixedStatsV226) { migrateGearFixedStatsV226(); S.migratedGearFixedStatsV226 = true; }
  if (!S.migratedGearRescaleV235) { migrateGearRescaleV235(); S.migratedGearRescaleV235 = true; }
  if (!S.migratedJewelryMatNameV239) { migrateJewelryMatNameV239(); S.migratedJewelryMatNameV239 = true; }
  if (!S.migratedGearRescaleV243) { migrateGearRescaleV243(); S.migratedGearRescaleV243 = true; }
  if (!S.migratedGearRescaleV245) { migrateGearRescaleV245(); S.migratedGearRescaleV245 = true; }
  if (!S.migratedGearRescaleV403) { migrateGearRescaleV403(); S.migratedGearRescaleV403 = true; }
  if (!S.migratedGearLeaderboardRecordFixV405) { migrateGearLeaderboardRecordFixV405(); S.migratedGearLeaderboardRecordFixV405 = true; }
  if (!S.migratedPenMasteryV308) { migratePenMasteryV308(); S.migratedPenMasteryV308 = true; }
  if (!S.migratedMergeStackableDuplicatesV407) { migrateMergeStackableDuplicatesV407(); S.migratedMergeStackableDuplicatesV407 = true; }
  if (!S.migratedGearscoreDerivedFixV414) { migrateGearscoreDerivedFixV414(); S.migratedGearscoreDerivedFixV414 = true; }
  if (!S.migratedSilverPerHourResetV436) { migrateSilverPerHourResetV436(); S.migratedSilverPerHourResetV436 = true; }
  if (!S.migratedBestKpmResetV439) { migrateBestKpmResetV439(); S.migratedBestKpmResetV439 = true; }
  if (!S.migratedBestXpPerHourResetV440) { migrateBestXpPerHourResetV440(); S.migratedBestXpPerHourResetV440 = true; }
  // Rattrapage NON gaté (2026-07-13, bug rapporté : "j'ai des items protégé compendium dans mon
  // sac tuvala qui sont deja pen compendium") -- evictMasteredFromCompendiumBag() n'est rejouée
  // que lors d'un NOUVEL enchantement PEN, ou une seule fois via migratePenMasteryV308 (gatée,
  // déjà consommée pour ces joueurs). Si invAdd() échouait silencieusement au moment de l'éviction
  // (sac principal plein), l'objet restait protégé dans COMPENDIUM_BAG POUR TOUJOURS -- rien ne
  // relance jamais l'éviction pour ce nom ensuite. Contrairement aux migrations `migratedXxx`
  // ci-dessus (gatées, exécution unique), ce balayage tourne à CHAQUE chargement : idempotent
  // (evictMasteredFromCompendiumBag() sort tout de suite si le nom n'est pas dans S.penMastery ou
  // déjà absent de COMPENDIUM_BAG) et auto-réparateur (un objet coincé se libère dès qu'il y a à
  // nouveau de la place dans le sac principal, sans attendre un hypothétique futur enchantement).
  new Set(COMPENDIUM_BAG.filter(Boolean).map(it => it.name)).forEach(evictMasteredFromCompendiumBag);
  zoneIdx = data.zoneIdx || 0;
  S.maxZoneIdx = Math.max(S.maxZoneIdx||0, zoneIdx); // rattrape les vieilles sauvegardes sans ce champ
  S.xpNext = xpNeededFor(S.lvl); // migre les anciennes sauvegardes (ancienne courbe ×1.35) vers la vraie table BDO
  if (!POTIONS[S.potionType]) S.potionType = 'medium'; // migre l'ancienne potion unique 'basic' vers les 4 tailles
  // BUG trouvé le 2026-07-15 (demande explicite : "au reload, apres maj le joueur arrive dans une
  // zone vide, fais en sorte qu'il trouve rapidement des monstre") : resetWorld() fait spawn tous
  // les packs autour de P.x/P.y -- or à ce stade P.x/P.y valaient encore (0,0) (position par défaut),
  // la vraie position sauvegardée n'était restaurée QU'APRÈS, sur la ligne suivante. Le joueur se
  // téléportait donc sur sa position réelle pendant que tous les monstres restaient massés près de
  // l'origine, potentiellement à des centaines d'unités -- d'où la "zone vide" au reload. Restaurer
  // playerPos AVANT resetWorld() pour que les packs spawnent bien autour du joueur.
  if (data.playerPos) { P.x = data.playerPos.x; P.y = data.playerPos.y; }
  resetWorld(true); // recrée les packs autour de la vraie position du joueur (keepPos, voir commentaire sur resetWorld)
  updateZoneTitleText(); // voir son commentaire -- sans cet appel, le nom de zone affiché restait figé au placeholder HTML
  hud();
  // rattrapage hors-ligne réel (voir computeOfflineCatchupSilver/computeOfflineCatchupXp ci-dessus) :
  // appliqué ICI, APRÈS Object.assign(S,...) pour que addSilver()/gainXp() s'appliquent bien à
  // l'état fraîchement restauré (pas à un état par défaut qui serait de toute façon écrasé).
  // Réutilise le mécanisme d'affichage déjà en place (awaySilverGained/awayXpGained/
  // showAwayLootSummaryIfAny, voir plus haut) au lieu d'un chemin séparé.
  if (offlineSilverGain > 0 || offlineXpGain > 0 || offlineLootItems.length > 0) {
    if (offlineSilverGain > 0) addSilver(offlineSilverGain, 'offline_catchup', 'Rattrapage hors ligne');
    if (offlineXpGain > 0) {
      // gainXp() réutilisée telle quelle (pas de logique de niveau dupliquée ici) : gère déjà la
      // cascade de passages de niveau (while, un gros rattrapage peut faire monter plusieurs
      // niveaux d'un coup), le +8 HP max/niveau, les notifications/logs Discord "Niveau supérieur".
      // trackRate=false (2026-07-14, bug corrigé : rattrapage de +9 milliards d'XP signalé par un
      // joueur) -- sans ça, ce gros paquet d'XP alimentait xpRateBuffer comme un gain de gameplay
      // normal, gonflant bestXpPerHour, qui servait de taux au PROCHAIN rattrapage -- boucle qui
      // s'auto-amplifiait à chaque reconnexion espacée. Voir le commentaire de gainXp() (loot-rolls.js).
      gainXp(offlineXpGain, false);
      // re-baseline APRÈS avoir crédité l'XP hors-ligne (comme tokenSilverEarned qui n'est PAS
      // incrémenté par addSilver('offline_catchup',...)) : sinon ce rattrapage compterait comme un
      // gain de LA SESSION EN COURS et fausserait/inflaterait le prochain calcul de bestXpPerHour.
      S.xpEarnedAtLoad = S.xpEarned || 0;
    }
    // objets réellement ajoutés à INV (2026-07-13, demande explicite : "la 0 en 5min c'est pas
    // possible") -- pas juste affichés dans le modal, sinon le joueur verrait un décalage plus
    // tard (voir CLAUDE.md, discipline habituelle pour tout gain simulé). invAdd() retourne false
    // sans throw si le sac est plein (piège connu, voir CLAUDE.md section tests "sac plein") :
    // dans ce cas l'objet n'est simplement PAS crédité au résumé, pour ne jamais afficher un objet
    // que le joueur n'a en réalité pas reçu.
    offlineLootItems.forEach(it => {
      const added = invAdd({ name: it.name, val: it.val, kind: it.kind, key: it.key, icon: it.icon, color: it.color, stackable: true, qty: it.qty, weight: it.weight });
      if (added) {
        if (!awayLootCounts[it.name]) awayLootCounts[it.name] = { qty: 0, color: it.color || '#c9a55a', val: it.val||0, kind: it.kind };
        awayLootCounts[it.name].qty += it.qty;
      }
    });
    awaySilverGained = offlineSilverGain;
    awayXpGained = offlineXpGain;
    awaySessionStartedAt = offlineSavedAtMs;
    awayLevelBefore = offlineLevelBefore;
    awayPercentBefore = offlinePercentBefore;
    showAwayLootSummaryIfAny();
  }
  return true;
}
// Export manuel (bouton à brancher si besoin) : télécharge un .json local
/** Télécharge un fichier .json local contenant l'état de sauvegarde complet (getSaveState()). */
function exportSaveToFile() {
  const blob = new Blob([JSON.stringify(getSaveState(), null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'velia-idle-save.json';
  a.click();
}
// Import manuel depuis un fichier .json choisi par le joueur
/** @param {File} file - fichier .json choisi par le joueur. Lit et applique la sauvegarde (applySaveState), log une erreur en console si le JSON est invalide. */
function importSaveFromFile(file) {
  const reader = new FileReader();
  reader.onload = e => { try { applySaveState(JSON.parse(e.target.result)); } catch(err) { console.error('Sauvegarde invalide', err); } };
  reader.readAsText(file);
}
// Ces 4 fonctions sont exposées globalement : un futur wrapper React/Supabase
// pourra appeler window.getSaveState() avant de fermer, et window.applySaveState(json) au chargement.
window.getSaveState = getSaveState;
window.applySaveState = applySaveState;
window.exportSaveToFile = exportSaveToFile;
window.importSaveFromFile = importSaveFromFile;

// demarrage du jeu deplace dans render.js (voir commentaire la-bas)
