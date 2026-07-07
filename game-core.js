'use strict';
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const W = cv.width, H = cv.height;
const $ = id => document.getElementById(id);
// le canvas a une résolution interne FIXE (1240×440, voir <canvas>) que le CSS (width:100%) réduit
// pour tenir dans un téléphone — tout texte dessiné dessus (floatTxt : gains de loot/XP, dégâts...)
// rétrécit donc dans les mêmes proportions et devient minuscule sur mobile (2026-07-05, demande
// explicite : "met en valeur le changement de XP/LOOT"). uiTextScale() compense en agrandissant les
// polices dans le repère du canvas d'autant que l'affichage réel a rétréci, pour une taille visuelle
// ~constante à l'écran quelle que soit la largeur ; plafonné pour rester lisible sans être absurde.
function uiTextScale() { return Math.min(3.2, Math.max(1, 1240 / (cv.clientWidth || 1240))); }
// détecte un client mobile/tablette (2026-07-05, adaptation mobile) : sert à choisir un état
// replié par DÉFAUT pour les panneaux flottants (menu, chat, suivi) qui se chevauchent sinon sur un
// petit écran (voir les media queries ci-dessus) — un simple seuil de largeur de viewport suffit
// (pas besoin de sniffer le user-agent, le responsive suit déjà la taille réelle de la fenêtre)
function isMobileViewport() { return window.innerWidth <= 1024; }
// échappe pseudo/message avant insertion via innerHTML — ce sont des chaînes saisies par
// d'autres joueurs, jamais dignes de confiance (évite une injection XSS stockée dans le chat)
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
function tr(s) { if (LANG !== 'en' || !s) return s; return NAME_EN[s] || s; }

// ==================== DONNÉES DES ZONES ====================
// PR = power recommandé · hpPer/dmg/xp = stats des mobs (FIXES par zone, jamais scalées au joueur)
// loot : 4 couches — trash (revenu), material, jackpot (accessoire équipable), craft (endgame)
// Difficulté entièrement retravaillée le 2026-07-06 : reqAP plafonné à 209 max (zone 10, contre 400
// avant) sur toute la région de Velia. hpPer/dmg de chaque zone réduits dans la même proportion que
// reqAP pour garder la difficulté relative identique. Un saut de reqAP nettement plus marqué a été
// placé à CHAQUE transition de palier de stuff (zone 2→3 gris→blanc, 5→6 blanc→vert, 8→9 vert→bleu)
// : passer de la dernière sous-zone d'un palier à la première du suivant nécessite d'être un minimum
// optimisé sur le stuff du palier précédent, sinon les monstres de la nouvelle zone font mal (via le
// malus de dégâts subis/dégâts infligés déjà existant quand le ratio PA/PD réel < requis).
//
// Économie retravaillée le 2026-07-07 (demande explicite : "économie progressive selon les zones") :
// trash/mat/jackpot de CHAQUE zone réduits proportionnellement pour que le silver/h moyen (à un
// rythme de référence de 15 kills/min, stuff adapté à la zone) progresse de ~3 000/h (zone 1) à
// 100 000/h max (zone 11, Ruines de Kratuga, avec un stuff bien optimisé) — c'est le plafond haut de
// la région Velia dans la nouvelle courbe économique à 5 régions :
//   Velia 0→100k/h · Heidel 100k→1M/h · Calpheon 1M→100M/h · Valencia 100M→1B/h · Edana 1B→10B/h
// (voir roadmap.md pour le détail des paliers futurs). Le "selon l'optimisation" vient
// naturellement de la mécanique existante (un stuff mieux enchanté = plus de dps = plus de
// kills/min = plus haut dans la fourchette de la zone), sans formule additionnelle nécessaire.
const ZONES = [
  // reqAP abaissé le 2026-07-08 (demande explicite, suite au retrait de l'arme de départ "spawn à
  // vide") : un personnage tout juste créé (PA innée = 4, aucune arme avant le drop de la zone1)
  // tombait à un ratio de 0.27 ici (ZONE DANGEREUSE) au lieu de ~0.93 avec l'ancien "Bâton de
  // Grunil" par défaut — reqDP inchangé (déjà correct, ratio PD ~0.71 avec la PD innée de 10).
  // gearBasisAP/DP (2026-07-08, demande explicite : "compliqué d'arriver à 20PA avec ce que je
  // loot") : reqAP:6 rendait aussi le STUFF de cette zone quasi inutile (round(6*apShare) ≈ 1),
  // un casque+arme+2 bagues full +12 ne donnait que 8.5 PA effectif — bien en dessous des 20 PA de
  // la zone suivante. Découple la difficulté DE COMBAT de cette zone (reqAP, volontairement bas
  // pour rester jouable sans arme) de la PUISSANCE de son stuff (gearBasisAP/DP, calé sur la zone
  // SUIVANTE) : le stuff qu'on y loot doit préparer à la zone d'après, pas refléter sa propre
  // facilité. Voir rollGearDrop/rollWeaponDrop/rollDrops (jackpot).
  { name:'Camp des Loups', tier:'Balenos — Early', reqAP:6, reqDP:14, gearBasisAP:20, gearBasisDP:19, mob:'Loup',
    hpPer:23, dmg:3, xp:8,
    tint:{ a:'#3a4a31', b:'#36452e', dry:'#414f33' }, tones:['#6b5f52','#5a5248','#75685a'], alphaTone:'#3d3a45',
    loot:{ trash:{name:'Viande de loup',val:1,ch:1}, mat:{name:'Pierre noire',val:1,ch:.55},
      jackpot:{name:'Anneau Naru',val:290,ch:.006,ap:1}, craft:{name:'Poussière d\'esprit ancien',ch:.03} } },
  { name:'Ruines de Protty', tier:'Balenos — Early', reqAP:20, reqDP:19, mob:'Esprit de Protty',
    hpPer:26, dmg:3, xp:12,
    tint:{ a:'#4a4231', b:'#453e2e', dry:'#4f4833' }, tones:['#a5543c','#8f4a38','#b06045'], alphaTone:'#6e2f24',
    loot:{ trash:{name:'Lame rouillée d\'Imp',val:3,ch:1}, mat:{name:'Pierre noire',val:1,ch:.48},
      jackpot:{name:'Collier Naru',val:550,ch:.005,ap:1}, craft:{name:'Poussière d\'esprit ancien',ch:.026} } },
  { name:'Repaire des Pirates', tier:'Balenos — Early', reqAP:25, reqDP:23, mob:'Pirate',
    hpPer:31, dmg:4, xp:18,
    tint:{ a:'#4a4232', b:'#443c2d', dry:'#524936' }, tones:['#7a6248','#6b563e','#8a7055'], alphaTone:'#4a3a28',
    loot:{ trash:{name:'Insigne de Sausan',val:5,ch:1}, mat:{name:'Pierre noire',val:1,ch:.4},
      jackpot:{name:'Ceinture Naru',val:1025,ch:.0038,ap:1}, craft:{name:'Poussière d\'esprit ancien',ch:.022} } },
  // reqAP/reqDP des paliers blanc/vert/bleu (zones 3+) REHAUSSÉES le 2026-07-08 (demande explicite :
  // "rehausse le max a 320 et le stuff comme avant, chaque item doit etre monte en moyenne en PRI
  // pour pouvoir monter de zone et un peu plus dure entre chaque grosse zone") — reprend la forme
  // de la courbe précédente (2026-07-08, voir historique ci-dessous) étirée jusqu'à 320 PA / 175 PD
  // en toute fin de jeu (Forêt de Polly). Grille de contrôle (stuff COMPLET du palier précédent à
  // PRI, walkthrough zone par zone en ordre réel de farm) : le ratio PA/PD retombe à ~0.3-0.4 pile à
  // l'entrée de chaque nouveau palier (un peu plus dur "entre les grosses zones", comme demandé),
  // puis remonte jusqu'à ~0.85 en fin de palier avant la marche suivante — grey (zones 0-2/12)
  // inchangé, déjà calé sur le spawn sans arme (session précédente).
  { name:'Camp Rhutum', tier:'Serendia — Early', reqAP:40, reqDP:24, mob:'Guerrier Rhutum',
    hpPer:48, dmg:6, xp:27,
    tint:{ a:'#32383f', b:'#2d333a', dry:'#3a4147' }, tones:['#5a6a78','#4e5d6a','#687888'], alphaTone:'#33404d',
    loot:{ trash:{name:'Bourse de pirate',val:9,ch:1}, mat:{name:'Pierre noire',val:1,ch:.32},
      jackpot:{name:'Anneau Tuvala',val:1960,ch:.0028,ap:1}, craft:{name:'Poussière d\'esprit ancien',ch:.018} } },
  { name:'Ferme Shultz', tier:'Serendia — Early', reqAP:49, reqDP:30, mob:'Garde Shultz',
    hpPer:66, dmg:8, xp:40,
    tint:{ a:'#2f4038', b:'#2b3b33', dry:'#37473c' }, tones:['#4a7060','#3f6353','#568070'], alphaTone:'#2c4a3e',
    loot:{ trash:{name:'Croc de Naga',val:15,ch:1}, mat:{name:'Éclat de cristal noir tranchant',val:1,ch:.26},
      jackpot:{name:'Collier Tuvala',val:3375,ch:.002,ap:2}, craft:{name:'Poussière d\'esprit ancien',ch:.015} } },
  // gearBasisDP (2026-07-12, demande explicite : "fais en sorte que la mine de fer abandonné pass
  // en zone difficile en moyenne avec le stuff de la zone d'avant en +13") -- simulation d'un stuff
  // COMPLET de Colonie Sausan (armes+armure+bijoux, formule réelle GEAR_ROLE) : à +13, le ratio face
  // à Mine de Fer Abandonnée était bloqué par la PD (0.56, ZONE DANGEREUSE) alors que la PA était
  // déjà largement suffisante (0.74) -- reqDP:37 ne donnait pas assez de PD au stuff d'armure pour y
  // parvenir. Découple la PUISSANCE de PD du stuff (gearBasisDP) de la difficulté de COMBAT de cette
  // zone (reqDP, inchangé) : même principe déjà utilisé pour Camp des Loups (gearBasisAP/DP), qui
  // prépare volontairement à la zone suivante plutôt que de refléter sa propre facilité. Au PEN, ce
  // même stuff de Colonie Sausan atteint bien "ZONE DIFFICILE" face à Poste Helm (2 zones plus loin),
  // déjà vrai avant ce changement (0.65) et non affecté négativement par cette hausse de PD.
  { name:'Colonie Sausan', tier:'Serendia — Mid', reqAP:62, reqDP:37, gearBasisDP:45, mob:'Combattant Sausan',
    hpPer:93, dmg:12, xp:60,
    tint:{ a:'#38452e', b:'#33402a', dry:'#3f4c33' }, tones:['#607a45','#546c3c','#6e8a50'], alphaTone:'#3c4e2a',
    loot:{ trash:{name:'Oreille de Fogan',val:24,ch:1}, mat:{name:'Éclat de cristal noir dur',val:4,ch:.2},
      jackpot:{name:'Ceinture Tuvala',val:5500,ch:.0015,ap:3}, craft:{name:'Poussière d\'esprit ancien',ch:.012} } },
  // chance de bijou (jackpot) des 4 zones VERTES rehaussée ×1.8 et des 4 zones BLEUES ×2.0
  // (2026-07-14, demande explicite : "réhausser tout les drop de bijou de 100% zone bleu, 80% zone
  // verte") -- ne touche pas les zones grise/blanche. RE-DOUBLÉ le 2026-07-15 (demande explicite :
  // "double uniquement les loot de bijou bleu et vert") : les 8 zones vert+bleu ci-dessous ont
  // chacune leur ch de bijou ×2 par rapport à leur valeur du 2026-07-14 (donc ×3.6 vert / ×4.0 bleu
  // au total depuis la valeur d'origine). Toujours pas les zones grise/blanche. Voir GEAR_TIERS pour la liste des zones par
  // palier (vert:[6,7,8,14], bleu:[9,10,11,15]).
  // reqAP/reqDP des 4 zones du palier VERT (Mine de Fer/Poste Helm/Repaire Bandits Gahaz/Base de
  // Bashim) abaissées le 2026-07-12 (demande explicite : "avec un full stuff blanc je dois pouvoir
  // passer en zone vert tout juste difficile en +13 en moyenne et full pen me fais passer a la 2e
  // zone verte" -- "sans toucher a la blanche") : simulation d'un stuff COMPLET de palier blanc (3
  // armes + 4 armures + 6 bijoux, chacun depuis SA zone réelle du palier blanc, formule GEAR_ROLE) :
  // à +13, la PD était le vrai facteur bloquant (0.49, ZONE DANGEREUSE) malgré une PA déjà largement
  // suffisante (0.73) -- confirmé qu'abaisser seulement le PA requis n'aurait rien changé. Les 4
  // zones sont réduites uniformément ×0.80 (PA ET PD, préserve la progression interne du palier) :
  // Mine de Fer Abandonnée passe tout juste en ZONE DIFFICILE à +13 (0.61), Poste Helm (2e zone
  // verte) atteint ZONE DIFFICILE au PEN (0.70). Le palier blanc (reqAP/reqDP) reste inchangé.
  { name:'Mine de Fer Abandonnée', tier:'Serendia — Mid', reqAP:99, reqDP:54, mob:'Mineur corrompu',
    hpPer:156, dmg:19, xp:90,
    // sol terre rouge/brune de carrière (retexturé le 2026-07-07 d'après les captures de référence :
    // canyon ocre, crevasses, chariots) — tones = capuches/tuniques poussiéreuses des mineurs,
    // alphaTone = armure de fer bleuté du boss de pack (voir drawMineurIso)
    tint:{ a:'#4a3226', b:'#443023', dry:'#583c2c' }, tones:['#8a7a68','#7a6c5a','#988676'], alphaTone:'#5a6068',
    loot:{ trash:{name:'Fer rouillé',val:39,ch:1}, mat:{name:'Pierre de Caphras',val:11,ch:.15},
      jackpot:{name:'Anneau Asula',val:8900,ch:.0036,ap:2}, craft:{name:'Fragment de mémoire',ch:.009} } },
  { name:'Poste Helm', tier:'Serendia — Late', reqAP:122, reqDP:66, mob:'Soldat Helm',
    hpPer:233, dmg:29, xp:135,
    tint:{ a:'#403845', b:'#3a3340', dry:'#48404d' }, tones:['#6a5a80','#5c4e70','#786890'], alphaTone:'#3a2f52',
    loot:{ trash:{name:'Fourrure de Biraghi',val:56,ch:1}, mat:{name:'Pierre de Caphras',val:11,ch:.11},
      jackpot:{name:'Collier Asula',val:13000,ch:.00252,ap:4}, craft:{name:'Fragment de mémoire',ch:.007} } },
  { name:'Repaire Bandits Gahaz', tier:'Serendia — Late', reqAP:150, reqDP:82, mob:'Bandit Gahaz',
    hpPer:353, dmg:44, xp:200,
    tint:{ a:'#38452e', b:'#33402a', dry:'#3f4c33' }, tones:['#607a45','#546c3c','#6e8a50'], alphaTone:'#3c4e2a',
    loot:{ trash:{name:'Défense d\'orc',val:74,ch:1}, mat:{name:'Pierre de Caphras',val:9,ch:.08},
      jackpot:{name:'Ceinture Asula',val:17850,ch:.0018,ap:6}, craft:{name:'Fragment de mémoire',ch:.005} } },
  // reqDP abaissé de 148 à 91 le 2026-07-14, PUIS remonté à 101 le même jour (demande explicite :
  // "la premiere zone bleu est difficile en meme temps que bashim pas normal modifie dp au besoin"
  // -- reqDP=91 rendait Sanctuaire Elric EXACTEMENT aussi difficile que Base de Bashim, la dernière
  // zone verte juste avant, ce qui n'a pas de sens pour la 1ère zone d'un palier supérieur) :
  // simulation d'un stuff COMPLET de palier vert/Yuria (3 armes + 4 armures + 6 bijoux, chacun
  // depuis SA zone verte réelle, formule GEAR_ROLE, + stats innées S.pa/S.dp) à +15 -- 61 PD dispo.
  // reqAP inchangé (n'était pas le problème). reqDP=101 ramène le ratio PD à 0.603 (tout juste au-
  // dessus du seuil ZONE DIFFICILE à 0.6, voir bottleneck()) : Sanctuaire Elric reste "tout juste
  // difficile" pour un stuff vert +15 COMME demandé, tout en étant désormais visiblement plus dur
  // que Base de Bashim (91), pas identique. Ne touche pas Forêt de Polly (dernière zone du jeu,
  // demande explicite de ne pas y toucher) ni les 2 autres zones Mediah (Kratuga/Mânes).
  { name:'Sanctuaire Elric', tier:'Mediah — Early', reqAP:269, reqDP:101, mob:'Sectateur d\'Elric',
    hpPer:596, dmg:73, xp:300,
    tint:{ a:'#3d3545', b:'#383040', dry:'#453c4e' }, tones:['#7a6a9a','#6c5d8a','#8878aa'], alphaTone:'#4a3e62',
    // % de la "Pierre concentrée" (matériau réel dropé ici, voir tierMat dans rollDrops — le nom
    // 'Pierre de Caphras' ci-dessous n'est qu'un label hérité, jamais affiché) doublé le 2026-07-08 :
    // avec l'enchantement ralenti, ces 2 dernières zones sont désormais LA seule source de matériau
    // bleu, il en faut beaucoup plus pour pousser du stuff Grunil jusqu'à PRI+
    loot:{ trash:{name:'Éclat de relique ancienne',val:90,ch:1}, mat:{name:'Pierre de Caphras',val:7,ch:.12},
      jackpot:{name:'Anneau de Cadry',val:24200,ch:.0012,ap:6}, craft:{name:'Marbre du Dieu déchu',ch:.0035} } },
  // les 3 dernières zones du jeu (Kratuga/Mânes/Polly) étaient toutes identiques à 320/175
  // (plafond de fin de jeu) -- lissées le 2026-07-11 (demande explicite : "lisse les req des 3
  // dernière zone du jeu") en une montée linéaire depuis Sanctuaire Elric (269/148 à l'époque,
  // désormais 269/101 en PD depuis le rééquilibrage du 2026-07-14 ci-dessus -- ce lissage ne
  // touchait que Kratuga/Mânes/Polly, restés inchangés) jusqu'au même plafond 320/175, désormais
  // atteint seulement à la toute dernière zone (Forêt de Polly, inchangée)
  { name:'Ruines de Kratuga', tier:'Mediah — Early', reqAP:286, reqDP:157, mob:'Uluan',
    hpPer:894, dmg:110, xp:450,
    tint:{ a:'#4a3d30', b:'#44382c', dry:'#524436' }, tones:['#b09060','#a08252','#c0a070'], alphaTone:'#6e5636',
    loot:{ trash:{name:'Relique d\'Hystria',val:105,ch:1}, mat:{name:'Pierre de Caphras',val:6,ch:.09},
      jackpot:{name:'Serap\'s Necklace',val:29600,ch:.0008,ap:9}, craft:{name:'Marbre du Dieu déchu',ch:.0025} } },
  // 3e zone Grunil (2026-07-05, demande explicite : "ajoute Planque des Mânes dernière zone") —
  // complète la rotation d'arme (weapon/secondary/awakening, une par zone du palier — voir
  // ZONE_WEAPON_SLOTS) et apporte la ceinture manquante (Orkinrad's Belt). reqAP/reqDP lissés le
  // 2026-07-11 (voir commentaire sur Ruines de Kratuga juste au-dessus) — 1 palier intermédiaire
  // entre Kratuga (286/157) et le plafond final 320/175 (Forêt de Polly).
  { name:'Planque des Mânes', tier:'Mediah — Early', reqAP:303, reqDP:166, mob:'Esprit des Mânes',
    hpPer:1000, dmg:125, xp:500,
    tint:{ a:'#3a3f4a', b:'#343943', dry:'#40454f' }, tones:['#8a9ab0','#7c8ca2','#98a8c0'], alphaTone:'#4a5568',
    loot:{ trash:{name:'Larme de Mâne',val:120,ch:1}, mat:{name:'Pierre de Caphras',val:5,ch:.07},
      jackpot:{name:'Orkinrad\'s Belt',val:35000,ch:.0006,ap:10}, craft:{name:'Marbre du Dieu déchu',ch:.0018} } },
  // 4e zone de CHAQUE palier (2026-07-05, demande explicite : "1 sous-zone pour en avoir 4 au
  // maximum et ajouter les boucles d'oreille") -- complète le seul type de bijou qui manquait
  // partout (ACC_SLOTS a bien earring1/earring2, mais aucune zone n'en droppait jusqu'ici).
  // AJOUTÉES EN FIN DE TABLEAU (jamais insérées entre des zones existantes) pour ne décaler
  // AUCUN index de zone déjà utilisé par les sauvegardes existantes (S.maxZoneIdx, zoneIdx,
  // Compendium par zone...) — voir GEAR_TIERS.zones et ZONE_WEAPON_SLOTS plus bas, mis à jour
  // en conséquence avec ces nouveaux index (12,13,14,15).
  // reqAP/reqDP étaient volontairement IDENTIQUES à la dernière zone déjà existante de chaque
  // palier depuis leur ajout (2026-07-05). Légèrement échelonnées le 2026-07-11 (demande explicite :
  // "certaine zone ont le meme nombre d'ap dp req, pas normal") -- Trent/Iliya/Bashim montent d'un
  // cran (toujours nettement sous le premier req du palier suivant, voir testZoneMonotonicity) pour
  // ne plus être de purs doublons, TOUJOURS sans dépasser le plafond de fin de jeu à 320/175 fixé
  // explicitement avant : Forêt de Polly (dernière zone du jeu, palier bleu) reste à 320/175, seul
  // vrai plafond — Ruines de Kratuga et Planque des Mânes, qui étaient identiques à Polly, ont
  // ensuite été lissées le même jour pour monter progressivement jusqu'à ce plafond (voir leur
  // commentaire dédié plus bas) au lieu d'y être déjà au premier des 3.
  // Le total de PA des bijoux d'un palier (avant réparti sur 3 pièces) a été redistribué sur 4 (voir
  // les ap ci-dessus, réduits en conséquence) pour que le total PA du palier reste EXACTEMENT le
  // même malgré ce nouveau 4e bijou -- migration rétroactive du stuff déjà possédé, voir
  // migrateEarringRebalanceV175().
  { name:'Ruines de Trent', tier:'Balenos — Early', reqAP:30, reqDP:24, mob:'Troll des Ruines',
    hpPer:35, dmg:4, xp:20,
    tint:{ a:'#3d4238', b:'#383d33', dry:'#454a3e' }, tones:['#6a7a5e','#5c6c50','#788a6c'], alphaTone:'#455038',
    loot:{ trash:{name:'Pierre de Trent',val:7,ch:1}, mat:{name:'Pierre noire',val:1,ch:.34},
      jackpot:{name:'Boucle Naru',val:1300,ch:.0032,ap:1}, craft:{name:'Poussière d\'esprit ancien',ch:.019} } },
  { name:'Île d\'Iliya', tier:'Serendia — Mid', reqAP:75, reqDP:44, mob:'Pirate d\'Iliya',
    hpPer:104, dmg:13, xp:67,
    tint:{ a:'#2e4a4a', b:'#2a4444', dry:'#355656' }, tones:['#4a9a9a', '#3f8888', '#5aacac'], alphaTone:'#2c5a5a',
    loot:{ trash:{name:'Perle d\'Iliya',val:38,ch:1}, mat:{name:'Éclat de cristal noir dur',val:5,ch:.14},
      jackpot:{name:'Boucle Tuvala',val:6900,ch:.0011,ap:3}, craft:{name:'Poussière d\'esprit ancien',ch:.009} } },
  { name:'Base de Bashim', tier:'Serendia — Late', reqAP:168, reqDP:91, mob:'Soldat de Bashim',
    hpPer:395, dmg:49, xp:224,
    tint:{ a:'#3c3c34', b:'#36362f', dry:'#44443a' }, tones:['#8a8a68', '#78785a', '#9a9a78'], alphaTone:'#565640',
    loot:{ trash:{name:'Insigne de Bashim',val:92,ch:1}, mat:{name:'Pierre de Caphras',val:8,ch:.058},
      jackpot:{name:'Boucle Asula',val:22300,ch:.00126,ap:9}, craft:{name:'Fragment de mémoire',ch:.003} } },
  { name:'Forêt de Polly', tier:'Mediah — Early', reqAP:320, reqDP:175, mob:'Troll de Polly',
    hpPer:1120, dmg:140, xp:560,
    tint:{ a:'#25382c', b:'#213228', dry:'#2c4034' }, tones:['#3f6e50', '#356045', '#4a805c'], alphaTone:'#274a34',
    loot:{ trash:{name:'Mousse de Polly',val:135,ch:1}, mat:{name:'Pierre de Caphras',val:4,ch:.055},
      jackpot:{name:'Tungrad\'s Earring',val:38500,ch:.00044,ap:11}, craft:{name:'Marbre du Dieu déchu',ch:.0013} } },
];
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
  penMastery: {}, // Compendium spécial "Maîtrise PEN" (2026-07-08) : { [itemName]: true } dès que cet objet a atteint PEN au moins une fois (voir markPenMastery)
  enhPeakByName: {}, // meilleur niveau d'optimisation JAMAIS atteint par nom d'objet (2026-07-15) : { [itemName]: enhLv }, voir trackEnhPeak -- survit à la vente de l'objet
  lootTableVersion: 'v2', // 'v1' (par zone, historique) ou 'v2' (taux fixe par palier, 2026-07-15) -- voir gearDropChance/jewelDropChance, réversible à tout moment via l'admin
  costPA: 60, costDP: 55, costCast: 90, costHP: 70, costLoot: 110,
  startTime: performance.now(), silverEarned: 0,
  // baseline (silverEarned/kills au début de LA SESSION EN COURS), pour calculer un vrai "silver/h"
  // et "kills/min" de session — S.silverEarned et S.kills sont des compteurs À VIE (achievements
  // "gagne X silver au total" etc.) et ne doivent jamais être réinitialisés au chargement d'une
  // sauvegarde. C'est S.startTime qui posait problème : restauré tel quel depuis le cloud, il ne
  // correspond plus au performance.now() de la NOUVELLE page, ce qui pouvait diviser un
  // silverEarned à vie énorme par un temps quasi nul → chiffre astronomique (faux positif
  // anti-triche confirmé le 2026-07-06). Corrigé en réinitialisant startTime + ces baselines à
  // chaque chargement (voir applySaveState).
  silverEarnedAtLoad: 0, killsAtLoad: 0,
  // "silver par heure" affiché (#shRate) = UNIQUEMENT le trash/token vendu au sol (2026-07-12,
  // demande explicite : "compté exclusivement par les silver recolté grace au token vendu") --
  // compteur À VIE séparé de silverEarned (qui reste global, toutes sources, pour les succès), voir
  // addSilver(). tokenSilverEarnedAtLoad = même principe de baseline de session que silverEarnedAtLoad.
  tokenSilverEarned: 0, tokenSilverEarnedAtLoad: 0,
  bestKpm: 0, // record personnel de kills/min À VIE (voir refreshStatsOnly) — sert au classement "🏹 Record kills/min"
  maxZoneIdx: 0, playtimeSec: 0, lootByItem: {},
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

// point d'entrée UNIQUE pour toute variation de silver côté client (2026-07-10, demande explicite :
// "toute modification de silver doit être écrit dans ce registre... je dois pouvoir traquer le
// moindre silver") -- centralise S.silver/S.silverEarned ET la journalisation (voir
// queueSilverLedger, game-supabase.js), pour ne plus jamais pouvoir modifier l'un sans l'autre.
// category : identifiant court et STABLE (ex: 'loot','potion','sell','quest','achievement',
// 'welcome','admin_test') -- alimente l'onglet Admin "Silver" (tableau + graphique par catégorie).
function addSilver(delta, category, note) {
  if (!delta) return;
  S.silver += delta;
  if (delta > 0) S.silverEarned += delta;
  // "silver par heure" (2026-07-12, demande explicite : "compté exclusivement par les silver
  // recolté grace au token vendu") -- S.silverEarned (au-dessus) reste un compteur GLOBAL À VIE
  // (toutes sources : quêtes, succès, boss, marché...), utilisé pour les succès/classements. Le
  // HUD "silver/h" (#shRate) doit lui refléter UNIQUEMENT le revenu du trash (token) au sol, pas
  // le loot occasionnel de gros montants (succès/boss/quêtes) qui fausserait la lecture du rythme
  // de farm réel -- voir dropsTick, seul endroit qui appelle addSilver avec category:'loot'.
  if (delta > 0 && category === 'loot') S.tokenSilverEarned = (S.tokenSilverEarned||0) + delta;
  if (typeof queueSilverLedger === 'function') queueSilverLedger(delta, category, note);
}
// suit combien de fois chaque objet a été ramassé (pour "meilleur objet farmé" dans le classement)
function trackLoot(name) { S.lootByItem[name] = (S.lootByItem[name]||0) + 1; }
function bestFarmedItem() {
  let best = null, bestN = 0;
  for (const name in S.lootByItem) if (S.lootByItem[name] > bestN) { best = name; bestN = S.lootByItem[name]; }
  return best ? { name: best, count: bestN } : null;
}

// icônes SVG originales (dessinées pour ce projet, aucun asset BDO réel) — plus détaillées :
// base + reflets + ombres pour un rendu plus joli, remplissant davantage la case
function svgIcon(inner) { return `<svg class="gicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`; }
// livre (compétences de vie) : couverture bleue + tranche + pages
const ICO_BOOK = svgIcon(
  '<path d="M4 4.5c3-1.2 5.5-1 8 .5v15c-2.5-1.5-5-1.7-8-.5z" fill="#3a6ea8"/>' +
  '<path d="M20 4.5c-3-1.2-5.5-1-8 .5v15c2.5-1.5 5-1.7 8-.5z" fill="#5a8fc8"/>' +
  '<path d="M12 5v15" stroke="#274a6e" stroke-width="1.4"/><path d="M14 8h4M14 11h4M6 8h4M6 11h4" stroke="#dfeaf5" stroke-width="0.9"/>');
// éclaircit/assombrit une couleur hex (amt en [-255,255]) — sert à générer les tons d'ombre/lumière
// des icônes teintées par palier de stuff ci-dessous
function shadeHex(hex, amt) {
  const h = hex.replace('#','');
  const num = parseInt(h.length===3 ? h.split('').map(c=>c+c).join('') : h, 16);
  let r = (num>>16) + amt, g = ((num>>8)&0xff) + amt, b = (num&0xff) + amt;
  r = Math.max(0,Math.min(255,r)); g = Math.max(0,Math.min(255,g)); b = Math.max(0,Math.min(255,b));
  return '#' + ((1<<24) + (r<<16) + (g<<8) + b).toString(16).slice(1);
}
// fond de case selon la rareté (remplace l'ancien halo autour de l'objet, demande explicite du
// 2026-07-08 : "enleve le halo et met un fond de couleur plus ou moins abouti selon la rareté") —
// rien pour gris/blanc, teinte + coins marqués au vert, teinte + coins ornés de losanges au bleu.
// tierIdx : 0=gris/blanc, 1=vert, 2=bleu (voir JEWEL_TIER_IDX plus bas)
function rarityBackdrop(tierIdx, color) {
  if (tierIdx === 1) return `<rect x="1" y="1" width="22" height="22" rx="4" fill="${color}" opacity=".14"/>` +
    `<path d="M2 6.5l4.5-4.5M22 6.5l-4.5-4.5M2 17.5l4.5 4.5M22 17.5l-4.5 4.5" stroke="${color}" stroke-width="1" opacity=".5"/>`;
  if (tierIdx >= 2) return `<rect x="1" y="1" width="22" height="22" rx="4" fill="${color}" opacity=".18"/>` +
    `<path d="M2 7.5l5.5-5.5M22 7.5l-5.5-5.5M2 16.5l5.5 5.5M22 16.5l-5.5 5.5" stroke="${color}" stroke-width="1.2" opacity=".65"/>` +
    `<path d="M12 .3l1.5 1.9-1.5 1.9-1.5-1.9z" fill="${color}" opacity=".7"/><path d="M12 23.7l1.5-1.9-1.5-1.9-1.5 1.9z" fill="${color}" opacity=".7"/>`;
  return '';
}
// ornements communs à toute pièce de stuff (armes, armure, bijoux) : rien au gris/blanc, 4 rivets
// pleins au vert, 4 gemmes claires + 1 losange central (5e ornement) au bleu — demande explicite du
// 2026-07-08 : "ornement 5 pour la bleu et 4 pour la verte", appliqué de façon cohérente partout
function gearOrnaments(tierIdx, positions, color, center) {
  if (tierIdx === 1) return positions.map(([x,y]) => `<circle cx="${x}" cy="${y}" r=".6" fill="${color}"/>`).join('');
  if (tierIdx >= 2) {
    const gem = shadeHex(color, 60);
    let out = positions.map(([x,y]) => `<circle cx="${x}" cy="${y}" r=".6" fill="${gem}"/>`).join('');
    if (center) out += `<path d="M${center[0]} ${center[1]-1.3}l1.3 1.3-1.3 1.3-1.3-1.3z" fill="#eaf6ff"/>`;
    return out;
  }
  return '';
}
// arme principale : bâton de sorcier (manche + tête sertie d'un cristal), teinté par palier —
// remplace l'ancienne arme fixe (2026-07-08, demande explicite : "l'arme c'est un baton de sorcier")
function staffIconForColor(color, grade) {
  const t = JEWEL_TIER_IDX[grade] || 0;
  const wood = grade==='grey' ? '#6b5030' : grade==='white' ? '#7a8083' : grade==='green' ? '#26301f' : '#0a1216';
  const gem = grade==='grey' ? '#9aa0a3' : color;
  const cage = grade==='grey' ? wood : shadeHex(color,-95);
  let claws = '';
  if (grade==='green') claws = `<path d="M12 1.8c-2.2.6-3.6 2-4 4.2l2 1.6c-.2-2 .5-3.8 2-5.8z" fill="${cage}"/><path d="M12 1.8c2.2.6 3.6 2 4 4.2l-2 1.6c.2-2-.5-3.8-2-5.8z" fill="${shadeHex(cage,-30)}"/>`;
  if (grade==='blue') claws = `<path d="M12 1.4c-2.6.5-4.3 2.1-4.8 4.8l2.3 1.8c-.4-2.4.5-4.5 2.5-6.6z" fill="${cage}"/><path d="M12 1.4c2.6.5 4.3 2.1 4.8 4.8l-2.3 1.8c.4-2.4-.5-4.5-2.5-6.6z" fill="${shadeHex(cage,-30)}"/>`;
  let cross = '';
  if (grade==='white') cross = `<rect x="10.6" y="12" width="2.8" height="1.2" rx=".5" fill="${gem}"/>`;
  if (grade==='blue') cross = `<rect x="10.6" y="11.6" width="2.8" height="1.1" rx=".5" fill="${gem}"/><rect x="10.6" y="14.4" width="2.8" height="1.1" rx=".5" fill="${gem}" opacity=".65"/>`;
  const rivets = gearOrnaments(t, [[12,10.4],[12,13.2],[12,16],[12,18.8]], color, [12,15]);
  return svgIcon(rarityBackdrop(t,color) + claws +
    `<rect x="11" y="7.5" width="2" height="14.5" rx="1" fill="${wood}"/><rect x="11" y="7.5" width=".9" height="14.5" rx=".45" fill="${shadeHex(wood,40)}"/>` +
    cross +
    `<path d="M12 3l1.7 1.9-1.7 2.6-1.7-2.6z" fill="${shadeHex(gem,30)}"/><path d="M12 3l1.7 1.9-1.7 2.6z" fill="${gem}"/>` +
    `<circle cx="12" cy="5" r=".5" fill="#eaf6ff"/>` +
    rivets);
}
// arme secondaire : dague, teintée par palier — remplace l'ancienne dague fixe
function daggerIconForColor(color, grade) {
  const t = JEWEL_TIER_IDX[grade] || 0;
  const blade = grade==='grey' ? '#8f9aa6' : grade==='white' ? '#e8e8e8' : grade==='green' ? '#3d4a3a' : '#20303c';
  const bladeDark = grade==='green' ? '#26301f' : grade==='blue' ? '#16232b' : shadeHex(blade,-30);
  const guard = grade==='grey' ? '#5f6873' : grade==='white' ? '#9aa0a3' : grade==='green' ? '#182015' : '#0a1216';
  const pommel = grade==='grey' ? '#6b5030' : grade==='white' ? '#7a8083' : grade==='green' ? '#26301f' : '#0a1216';
  const fuller = grade!=='grey' ? `<path d="M12 9.6v9.8" stroke="${grade==='white'?guard:color}" stroke-width=".55"/>` : '';
  const curvedGuard = (grade==='green'||grade==='blue')
    ? `<path d="M7.6 8.4c1.4-1 3-1.4 4.4-1.4s3 .4 4.4 1.4l-.8 1.2c-1.2-.7-2.4-1-3.6-1s-2.4.3-3.6 1z" fill="${guard}"/>`
    : `<rect x="8.2" y="7.6" width="7.6" height="1.7" rx=".8" fill="${guard}"/>`;
  const rivets = gearOrnaments(t, [[9.2,8.9],[14.8,8.9],[12,4.4],[12,6.4]], color, [12,10.5]);
  return svgIcon(rarityBackdrop(t,color) +
    `<path d="M12 22l-2.2-4.6V9h4.4v8.4z" fill="${blade}"/><path d="M12 22l-2.2-4.6V9H12z" fill="${bladeDark}"/>` +
    fuller + curvedGuard +
    `<rect x="11" y="3.4" width="2" height="4.2" rx=".9" fill="${pommel}"/><circle cx="12" cy="2.8" r="1.1" fill="${guard}"/>` +
    rivets);
}
// éveil : deux sphères Aad flottant en lévitation (remplace l'ancienne grande épée dorée, 2026-07-08
// demande explicite : "l'eveil c'est 2 boules flottante" / "que les 2 boules ce sont des sphere aad")
function orbPairIconForColor(color, grade) {
  const t = JEWEL_TIER_IDX[grade] || 0;
  const stone = grade==='grey' ? '#6b6f74' : grade==='white' ? '#cfd8dc' : grade==='green' ? '#182015' : '#0f1a20';
  const ringCol = grade==='grey' ? '#43494f' : grade==='white' ? '#9aa0a3' : color;
  let bigCore = '', smallCore = '';
  if (grade === 'grey') { bigCore = '<circle cx="7.6" cy="9.1" r="1.1" fill="#8f9aa6"/>'; smallCore = '<circle cx="15.5" cy="13.9" r=".75" fill="#8f9aa6"/>'; }
  else if (grade === 'white') { bigCore = '<circle cx="7.6" cy="9.1" r="1.2" fill="#fff"/>'; smallCore = '<circle cx="15.5" cy="13.9" r=".8" fill="#fff"/>'; }
  else if (grade === 'green') {
    bigCore = `<path d="M9 7.4c1.7 1.2 2.3 2.7 1.8 4.4-.5 1.3-1.8 2.1-1.8 2.1s-1.3-.8-1.8-2.1c-.5-1.7.1-3.2 1.8-4.4z" fill="${color}" opacity=".8"/>`;
    smallCore = `<path d="M16.4 12.8c1.1.8 1.5 1.8 1.2 2.9-.3.9-1.2 1.4-1.2 1.4s-.9-.5-1.2-1.4c-.3-1.1.1-2.1 1.2-2.9z" fill="${color}" opacity=".8"/>`;
  } else {
    bigCore = '<path d="M9.8 7.6l-1.9 3.3h1.5L8 14.3l3.3-4.3H9.6z" fill="#dfeaf4"/>';
    smallCore = '<path d="M17 13l-1.3 2.2h1l-.9 2.1 2.2-2.9h-1.1z" fill="#dfeaf4"/>';
  }
  const rivets = gearOrnaments(t, [[3.6,8.4],[14.2,12.2],[12.4,6.2],[19.8,11.7]], color, [12,17.2]);
  return svgIcon(rarityBackdrop(t,color) +
    `<circle cx="9" cy="10.5" r="4.2" fill="${stone}"/><circle cx="9" cy="10.5" r="4.2" fill="none" stroke="${ringCol}" stroke-width=".8"/>` +
    bigCore +
    `<circle cx="16.4" cy="14.8" r="2.9" fill="${stone}"/><circle cx="16.4" cy="14.8" r="2.9" fill="none" stroke="${ringCol}" stroke-width=".8"/>` +
    smallCore +
    `<path d="M7 17.8h4M14.6 19.6h3.6" stroke="${ringCol}" stroke-width=".8" stroke-linecap="round"/>` +
    rivets);
}
// casque : heaume avec fente en Y, teinté par palier — cornes qui apparaissent au vert/bleu
function helmetIconForColor(color, grade) {
  const t = JEWEL_TIER_IDX[grade] || 0;
  const base = (grade==='green'||grade==='blue') ? shadeHex(color,-95) : color;
  const dark = shadeHex(base,-40), visor = shadeHex(base,-90);
  let horns = '';
  if (grade==='white') horns = `<path d="M9 8l-1.6-2.6 1.4-.6z" fill="${shadeHex(color,-20)}"/><path d="M15 8l1.6-2.6-1.4-.6z" fill="${shadeHex(color,-20)}"/>`;
  if (grade==='green') horns = `<path d="M6.2 6.8C4.8 5.6 4.4 4 5 2.4c.5 1.5 1.5 2.6 2.9 3.2z" fill="${shadeHex(color,70)}"/><path d="M17.8 6.8c1.4-1.2 1.8-2.8 1.2-4.4-.5 1.5-1.5 2.6-2.9 3.2z" fill="${shadeHex(color,70)}"/>`;
  if (grade==='blue') horns = `<path d="M6.4 7.4C3.6 6 2.6 3.4 3.6.8c.6 2.4 2.2 4.2 4.4 5z" fill="${shadeHex(color,70)}"/><path d="M17.6 7.4C20.4 6 21.4 3.4 20.4.8c-.6 2.4-2.2 4.2-4.4 5z" fill="${shadeHex(color,70)}"/>`;
  const rivets = gearOrnaments(t, [[7,9.4],[17,9.4],[7,16.6],[17,16.6]], color, [12,9.6]);
  return svgIcon(rarityBackdrop(t,color) + horns +
    `<path d="M4 15a8 8 0 0116 0v1H4z" fill="${base}"/><path d="M4 15a8 8 0 0116 0h-4a4 4 0 00-8 0z" fill="${shadeHex(base,35)}"/>` +
    `<rect x="3" y="16" width="18" height="2.6" rx="1.2" fill="${dark}"/>` +
    `<path d="M12 8.6c1.8 0 3.2.6 3.2 2v1.2h-2v6h-2.4v-6h-2v-1.2c0-1.4 1.4-2 3.2-2z" fill="${visor}"/>` +
    `<path d="M8 12.2h1.8M14.2 12.2H16" stroke="${visor}" stroke-width="1.5"/>` +
    rivets);
}
// armure : cuirasse cintrée avec épaulières, teintée par palier — redessinée le 2026-07-08 pour
// mieux lire comme une armure (col en V, taille marquée, panneaux abdominaux)
function armorIconForColor(color, grade) {
  const t = JEWEL_TIER_IDX[grade] || 0;
  const base = (grade==='green'||grade==='blue') ? shadeHex(color,-95) : color;
  const dark = shadeHex(base,-40), line = shadeHex(base,-70), light = shadeHex(base,45);
  const epaulettes = grade==='grey' ? '' :
    `<path d="M7.4 4.6C4.8 5 3.4 6.6 3.2 9l2.8 1c.2-2 .6-3.8 1.4-5.4z" fill="${grade==='white'?light:shadeHex(base,25)}"/>` +
    `<path d="M16.6 4.6c2.6.4 4 2 4.2 4.4l-2.8 1c-.2-2-.6-3.8-1.4-5.4z" fill="${dark}"/>`;
  const rivets = gearOrnaments(t, [[9.5,8],[14.5,8],[9.8,14.6],[14.2,14.6]], color, [12,11.3]);
  return svgIcon(rarityBackdrop(t,color) + epaulettes +
    `<path d="M12 3l4.6 1.6c1 2.4.8 4.9.4 7.4-.4 3.5-2 6.6-5 7.8-3-1.2-4.6-4.3-5-7.8-.4-2.5-.6-5-.4-7.4z" fill="${base}"/>` +
    `<path d="M12 3l4.6 1.6c1 2.4.8 4.9.4 7.4-.4 3.5-2 6.6-5 7.8z" fill="${dark}"/>` +
    `<path d="M9.6 4.4c.8 1.6 4 1.6 4.8 0" fill="none" stroke="${line}" stroke-width=".8"/>` +
    `<path d="M12 6v13" stroke="${line}" stroke-width=".7"/>` +
    `<path d="M8.6 9.2c1.2 1 5.6 1 6.8 0M9 13c1.1.9 4.9.9 6 0" fill="none" stroke="${line}" stroke-width=".55"/>` +
    rivets);
}
// gants : moufle d'armure vue de dos avec doigts segmentés — redessinés le 2026-07-08 (griffes au
// vert/bleu, plus lisibles que l'ancien gantelet trop simple)
function glovesIconForColor(color, grade) {
  const t = JEWEL_TIER_IDX[grade] || 0;
  const base = (grade==='green'||grade==='blue') ? shadeHex(color,-95) : color;
  const dark = shadeHex(base,-40), cuff = shadeHex(base,-70);
  let claws = '';
  if (grade === 'green') claws = `<path d="M6.9 11.7l-.9-2 1.1.6zM10.1 10.3l-.7-2.2 1.1.8zM13.3 9.9l.4-2.3.7 1zM16.5 11.2l1-1.9-.1 1.3z" fill="${shadeHex(color,60)}"/>`;
  if (grade === 'blue') claws = `<path d="M6.9 11.7l-1.4-3 1.6 1zM10.1 10.3l-1-3.2 1.5 1.2zM13.3 9.9l.6-3.3 1 1.5zM16.5 11.2l1.6-2.8-.2 1.9z" fill="${shadeHex(color,70)}"/>`;
  const rivets = gearOrnaments(t, [[9.2,11.8],[14.8,11.8],[9.2,15.6],[14.8,15.6]], color, [12,13.7]);
  return svgIcon(rarityBackdrop(t,color) + claws +
    `<path d="M5.6 20.5V13a1.3 1.3 0 012.6 0v3h.6v-4.4a1.3 1.3 0 012.6 0V16h.6v-4.8a1.3 1.3 0 012.6 0V16h.6v-3.6a1.3 1.3 0 012.6 0v6c0 1.5-1.2 2.7-2.7 2.7H8.3c-1.5 0-2.7-1.2-2.7-2.6z" fill="${base}"/>` +
    `<path d="M5.6 20.5V13a1.3 1.3 0 012.6 0v7.4c0 .4-.1.7-.3 1-1.3-.1-2.3-1.2-2.3-1.9z" fill="${dark}"/>` +
    `<path d="M4.6 19.4h14.8l-.8 3.2H5.4z" fill="${cuff}"/>` +
    rivets);
}
// bottes : tige haute + pied, genouillère pointue au vert/bleu — redessinées le 2026-07-08
function bootsIconForColor(color, grade) {
  const t = JEWEL_TIER_IDX[grade] || 0;
  const base = (grade==='green'||grade==='blue') ? shadeHex(color,-95) : color;
  const dark = shadeHex(base,-40), sole = shadeHex(base,-80);
  let knee = '';
  if (grade==='green') knee = `<path d="M8.6 5.4L11.7 3l3.1 2.4-3.1 1.5z" fill="${dark}"/>`;
  if (grade==='blue') knee = `<path d="M8.6 5.4L11.7 2.6l3.1 2.8-3.1 1.5z" fill="${dark}"/><path d="M11.7 2.6V.9l1.5 1.9z" fill="${shadeHex(color,50)}"/>`;
  const spur = grade==='blue' ? `<path d="M7.5 18.2l-1.7-.9 1.7-.9z" fill="${color}"/>` : '';
  const trim = (grade==='green'||grade==='blue') ? `<path d="M9.4 12.4h4.4" stroke="${color}" stroke-width=".5"/>` : '';
  const rivets = gearOrnaments(t, [[10.4,9],[13,9],[10.4,12.4],[13,12.4]], color, [11.7,10.7]);
  return svgIcon(rarityBackdrop(t,color) + knee +
    `<path d="M9 4h5.5v9.8c0 .9.4 1.7 1.1 2.2l2.7 2c.7.5 1.1 1.3 1.1 2.2v1.4H9z" fill="${base}"/>` +
    `<path d="M14.5 4v9.8c0 .9.4 1.7 1.1 2.2l2.7 2c.7.5 1.1 1.3 1.1 2.2v1.4h-5V4z" fill="${dark}"/>` +
    `<ellipse cx="11.7" cy="5.2" rx="2.9" ry="1.4" fill="${sole}"/>` + trim + spur +
    `<path d="M8.4 21.6c-.5 0-.9-.4-.9-.9s.4-.9.9-.9h11.2c.5 0 .9.4.9.9s-.4.9-.9.9z" fill="${dark}"/>` +
    rivets);
}
// ceinture : sangle + boucle
const ICO_BELT = svgIcon(
  '<rect x="1.5" y="9.5" width="21" height="5" rx="1.4" fill="#5a3f22"/><rect x="1.5" y="9.5" width="21" height="2" rx="1" fill="#8a6a3a"/>' +
  '<rect x="8.5" y="7.5" width="7" height="9" rx="1.6" fill="none" stroke="#e6cf7a" stroke-width="2"/>' +
  '<rect x="11" y="9.5" width="2" height="5" rx="1" fill="#c9a55a"/>');
// artéfact : tablette runique ancienne, bronze/ambre avec une rune lumineuse gravée — nouveaux
// emplacements dédiés (2 slots, ex: Vell/Khan), demande explicite du 2026-07-07
const ICO_ARTIFACT = svgIcon(
  '<path d="M6 3h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z" fill="#6e4a2a"/>' +
  '<path d="M6 3h12a2 2 0 012 2v14a2 2 0 01-2 2H12V3z" fill="#8a6038"/>' +
  '<circle cx="12" cy="11" r="3.4" fill="none" stroke="#e6cf7a" stroke-width="1.3"/>' +
  '<path d="M12 8.4l1.2 2.4-1.2 2.4-1.2-2.4z" fill="#ffe9a8"/>' +
  '<rect x="8" y="16.5" width="8" height="1.4" rx=".7" fill="#e6cf7a" opacity=".8"/>');
// pierre d'équipement (emplacement unique) : orbe sombre sertie dans une monture dorée, lueur
// intérieure — demande explicite du 2026-07-07
const ICO_EQSTONE = svgIcon(
  '<path d="M12 2.5c-4 3-7 4-7 9a7 7 0 0014 0c0-5-3-6-7-9z" fill="#7a5a2a"/>' +
  '<circle cx="12" cy="13" r="6" fill="#211c2c"/><circle cx="12" cy="13" r="6" fill="none" stroke="#c9a55a" stroke-width="1.3"/>' +
  '<circle cx="12" cy="13" r="3" fill="#8a54c9" opacity=".7"/><circle cx="10.4" cy="11.2" r="1.1" fill="#fff" opacity=".8"/>');

// ---- bijoux (jackpot) : progression visuelle par palier de stuff — demande explicite du
// 2026-07-07 : "les premiers bijoux auront des simples anneaux, puis des diamants, puis plusieurs
// diamants arrivé au stuff ultime orné de diamants et de couleur". tierIdx : 0=gris/blanc (anneau
// nu), 1=vert (un diamant), 2=bleu (plusieurs diamants + couleur du palier), 3=palier ultime
// (jaune/orange/rouge, pas encore en jeu — orné, plus gros, couleur dominante).
function jewelGemCluster(tierIdx, color, cx, cy) {
  if (tierIdx <= 0) return '';
  if (tierIdx === 1) return `<path d="M${cx} ${cy-3.5}l2 3-2 3-2-3z" fill="#bfe4ff"/><path d="M${cx} ${cy-3.5}l2 3-2 3z" fill="#8cc8ff"/>`;
  if (tierIdx === 2) return `<path d="M${cx} ${cy-4}l2.1 3.2-2.1 3.2-2.1-3.2z" fill="#eaf6ff"/><path d="M${cx} ${cy-4}l2.1 3.2-2.1 3.2z" fill="${color}"/>` +
      `<path d="M${cx-3.4} ${cy-1.2}l1.1 1.7-1.1 1.7-1.1-1.7z" fill="${color}" opacity=".85"/>` +
      `<path d="M${cx+3.4} ${cy-1.2}l1.1 1.7-1.1 1.7-1.1-1.7z" fill="${color}" opacity=".85"/>`;
  // palier ultime : encore plus gros, halo de couleur
  return `<circle cx="${cx}" cy="${cy}" r="6" fill="${color}" opacity=".22"/>` +
      `<path d="M${cx} ${cy-4.6}l2.4 3.6-2.4 3.6-2.4-3.6z" fill="#fff" opacity=".95"/><path d="M${cx} ${cy-4.6}l2.4 3.6-2.4 3.6z" fill="${color}"/>` +
      `<path d="M${cx-4} ${cy-1.4}l1.3 2-1.3 2-1.3-2z" fill="${color}"/><path d="M${cx+4} ${cy-1.4}l1.3 2-1.3 2-1.3-2z" fill="${color}"/>`;
}
// bague / collier / boucles d'oreille redessinés le 2026-07-08 (cohérence avec le reste du set) —
// même règle d'ornements que les armes/armure : 0 au gris/blanc, 4 rivets au vert, 4 gemmes + 1
// losange (5e ornement) au bleu (voir gearOrnaments) ; le tierIdx (0/1/2) reste celui de
// JEWEL_TIER_IDX, la couleur elle-même distingue déjà gris de blanc
function ringIconForTier(tierIdx, color) {
  // contour dans la couleur du palier (2026-07-08, demande explicite : "contour des bijou =
  // couleurs de la zone") -- remplace l'ancien contour sombre/noir au vert et au bleu
  const band = color;
  const bandLine = tierIdx<=0 ? shadeHex(color,-15) : shadeHex(color,60);
  let gem = '';
  if (tierIdx<=0) gem = `<rect x="10.6" y="6.6" width="2.8" height="2.4" rx=".7" fill="${shadeHex(color,-30)}"/>`;
  else if (tierIdx===1) gem = `<path d="M12 4.2l2 2.4-2 3-2-3z" fill="${color}"/><path d="M12 4.2l2 2.4-2 3z" fill="${shadeHex(color,-40)}"/>`;
  else gem = `<path d="M12 3.4l2.4 2.8-2.4 3.6-2.4-3.6z" fill="${shadeHex(color,70)}"/><path d="M12 3.4l2.4 2.8-2.4 3.6z" fill="${color}"/>`;
  const rivets = gearOrnaments(tierIdx, [[6.9,10.5],[17.1,10.5],[6.9,17.5],[17.1,17.5]], color, [12,20.8]);
  return svgIcon(rarityBackdrop(tierIdx,color) +
    `<circle cx="12" cy="14" r="6" fill="none" stroke="${band}" stroke-width="2.4"/>` +
    `<circle cx="12" cy="14" r="6" fill="none" stroke="${bandLine}" stroke-width=".9"/>` +
    gem + rivets);
}
function necklaceIconForTier(tierIdx, color) {
  const chain = color;
  let pend = '';
  if (tierIdx<=0) pend = `<circle cx="12" cy="16.5" r="1.6" fill="${shadeHex(color,-30)}"/>`;
  else if (tierIdx===1) pend = `<path d="M12 13l3.4 4-3.4 4.4L8.6 17z" fill="${color}"/><path d="M12 13l3.4 4-3.4 4.4z" fill="${shadeHex(color,-40)}"/><path d="M12 15l1.6 2-1.6 2.2-1.6-2.2z" fill="${shadeHex(color,60)}"/>`;
  else pend = `<path d="M12 12.6l3.8 4.4-3.8 4.8-3.8-4.8z" fill="${color}"/><path d="M12 12.6l3.8 4.4-3.8 4.8z" fill="${shadeHex(color,-40)}"/><path d="M12 14.6l1.9 2.4-1.9 2.6-1.9-2.6z" fill="#eaf6ff"/><path d="M12 14.6l1.9 2.4-1.9 2.6z" fill="${shadeHex(color,60)}"/>`;
  const rivets = gearOrnaments(tierIdx, [[12,13.6],[8.9,17],[15.1,17],[12,20.6]], color, [17.2,13.8]);
  return svgIcon(rarityBackdrop(tierIdx,color) +
    `<path d="M4 5c0 6.5 4 10 8 10s8-3.5 8-10" fill="none" stroke="${chain}" stroke-width="1.8"/>` +
    `<path d="M4 5c0 6.5 4 10 8 10" fill="none" stroke="${tierIdx<=0?shadeHex(chain,40):shadeHex(chain,60)}" stroke-width="1.8"/>` +
    pend + rivets);
}
function earringIconForTier(tierIdx, color) {
  const ring = color;
  let drop = '', drop2 = '';
  if (tierIdx<=0) { drop = `<circle cx="8" cy="13.5" r="1.4" fill="${shadeHex(color,-30)}"/>`; drop2 = `<circle cx="16" cy="13.5" r="1.4" fill="${shadeHex(color,-30)}"/>`; }
  else if (tierIdx===1) {
    drop = `<path d="M8 10.8l1.6 2.4-1.6 3.2-1.6-2.8z" fill="${shadeHex(color,-40)}"/><path d="M8 11.8l.9 1.4-.9 1.6-.9-1.6z" fill="${color}"/>`;
    drop2 = `<path d="M16 10.8l1.6 2.4-1.6 3.2-1.6-2.8z" fill="${shadeHex(color,-40)}"/><path d="M16 11.8l.9 1.4-.9 1.6-.9-1.6z" fill="${color}"/>`;
  } else {
    drop = `<path d="M8 10.4l1.8 2.7-1.8 3.3-1.8-3.3z" fill="${shadeHex(color,-40)}"/><path d="M8 11.6l1 1.5-1 1.9-1-1.9z" fill="#eaf6ff"/><path d="M8 11.6l1 1.5-1 1.9z" fill="${shadeHex(color,60)}"/>`;
    drop2 = `<path d="M16 10.4l1.8 2.7-1.8 3.3-1.8-3.3z" fill="${shadeHex(color,-40)}"/><path d="M16 11.6l1 1.5-1 1.9-1-1.9z" fill="#eaf6ff"/><path d="M16 11.6l1 1.5-1 1.9z" fill="${shadeHex(color,60)}"/>`;
  }
  const rivets = gearOrnaments(tierIdx, [[6.2,9],[9.8,9],[14.2,9],[17.8,9]], color, [12,5.6]);
  return svgIcon(rarityBackdrop(tierIdx,color) +
    `<circle cx="8" cy="7" r="2.6" fill="none" stroke="${ring}" stroke-width="1.5"/>` +
    `<circle cx="16" cy="7" r="2.6" fill="none" stroke="${ring}" stroke-width="1.5"/>` +
    drop + drop2 + rivets);
}
// ceinture redessinée le 2026-07-08 (demande explicite, même style que le reste du set) : sangle
// teintée par palier, boucle au contour dans la couleur de la zone (comme bague/collier/boucles
// d'oreille), même règle de rivets/gemmes que le reste (voir gearOrnaments)
function beltIconForTier(tierIdx, color) {
  const strap = tierIdx<=0 ? color : shadeHex(color,-90);
  const strapLine = tierIdx<=0 ? shadeHex(color,60) : shadeHex(color,60);
  let buckle = '';
  if (tierIdx<=0) buckle = `<rect x="11" y="9.5" width="2" height="5" rx="1" fill="${shadeHex(color,-30)}"/>`;
  else if (tierIdx===1) buckle = `<path d="M11.7 9.4l1.3 2-1.3 2-1.3-2z" fill="${color}"/>`;
  else buckle = `<path d="M11.7 8.8l1.5 2.3-1.5 2.3-1.5-2.3z" fill="${shadeHex(color,60)}"/><path d="M11.7 8.8l1.5 2.3-1.5 2.3z" fill="${color}"/>`;
  const rivets = gearOrnaments(tierIdx, [[4.5,12],[19.5,12],[9,11.2],[15,11.2]], color, [11.7,15.5]);
  return svgIcon(rarityBackdrop(tierIdx,color) +
    `<rect x="1.5" y="9.5" width="21" height="5" rx="1.4" fill="${strap}"/><rect x="1.5" y="9.5" width="21" height="1.6" rx=".8" fill="${strapLine}"/>` +
    `<rect x="8.5" y="7.5" width="7" height="9" rx="1.6" fill="none" stroke="${color}" stroke-width="2"/>` +
    buckle + rivets);
}
// convertit un grade GEAR_TIERS ('grey'/'white'/'green'/'blue') en tierIdx de richesse visuelle
// (gris+blanc = "simples anneaux", même palier visuel — voir demande utilisateur)
const JEWEL_TIER_IDX = { grey:0, white:0, green:1, blue:2 };

// pierres d'optimisation — création originale inspirée du style "pierre à facettes" de Black
// Desert, sans reprendre d'assets réels (demande du 2026-07-05)
// Pierre de Novice : moellon brut gris, à peine dégrossi
const ICO_MAT_NOVICE = svgIcon(
  '<path d="M12 3l6 4.5-2 8-4 6-4-6-2-8z" fill="#a8a8a4"/><path d="M12 3l6 4.5-2 8-4 6z" fill="#878782"/>' +
  '<path d="M12 3l-2 7.2 4 1.1z" fill="#c6c6c0"/>');
// Pierre du Temps : cristal bleu pâle, facette centrale évoquant un sablier
const ICO_MAT_TEMPS = svgIcon(
  '<path d="M12 2l5.4 5-2 9-3.4 6-3.4-6-2-9z" fill="#cfd8dc"/><path d="M12 2l5.4 5-2 9-3.4 6z" fill="#a3b8c1"/>' +
  '<path d="M12 2l-2 7.2 4 1.1z" fill="#eef6f8"/><path d="M10.3 12.5h3.4l-1.7 3-1.7-3z" fill="#6f9aa8" opacity=".55"/>');
// Pierre Noire : jade à facettes avec lueur verte au coeur (recolorée en vert le 2026-07-08,
// demande explicite — cohérent avec le palier Yuria/vert qu'elle sert à optimiser)
const ICO_MAT_NOIRE = svgIcon(
  '<path d="M12 1l6 6-3 9-3 7-3-7-3-9z" fill="#1e3d24"/><path d="M12 1l6 6-3 9-3 7z" fill="#142b19"/>' +
  '<path d="M12 1l-3 7.2 3 1.4 3-1.4z" fill="#7aa35e"/><circle cx="12" cy="12" r="2.1" fill="#7aa35e" opacity=".65"/>');
// Pierre de Caphras : relique ambrée fissurée, lueur dorée
const ICO_MAT_CAPHRAS = svgIcon(
  '<path d="M12 2l5.6 4.6-1.6 9.4-4 6-4-6-1.6-9.4z" fill="#c9a55a"/><path d="M12 2l5.6 4.6-1.6 9.4-4 6z" fill="#a3803c"/>' +
  '<path d="M12 2l-2 8 4 1.1z" fill="#e8d29c"/><circle cx="12" cy="13.5" r="1.6" fill="#ffe9a8" opacity=".7"/>');
// Pierre concentrée (palier Grunil/bleu, distincte de la Pierre Noire de Yuria depuis le
// 2026-07-06) : cristal bleu foncé dense, cœur cyan concentré
const ICO_MAT_CONCENTREE = svgIcon(
  '<path d="M12 2l5.8 4.8-1.8 9.6-4 5.6-4-5.6-1.8-9.6z" fill="#2e3a52"/><path d="M12 2l5.8 4.8-1.8 9.6-4 5.6z" fill="#1c2438"/>' +
  '<path d="M12 2l-2 7.4 4 1.2z" fill="#4a5c7a"/><circle cx="12" cy="13" r="2.3" fill="#5ec9e8" opacity=".65"/>');
// Pierre de Cron : orbe turquoise lumineux façon perle (redessiné le 2026-07-06, demande explicite,
// références visuelles fournies) — protège un enchantement d'une rétrogradation en cas d'échec
// (au choix du joueur depuis V193, voir attemptEnhance/S.useCronStone). Dropée dans TOUTES les
// zones du jeu à un taux fixe (voir CRON_STONE.ch), sans lien avec le palier de stuff.
const ICO_CRON_STONE = svgIcon(
  '<circle cx="12" cy="12" r="9.5" fill="#1f7a72"/><circle cx="12" cy="12" r="9.5" fill="#4ecdc4" opacity=".5"/>' +
  '<path d="M7 15c1.8 1.4 3.4.6 4.6-1s3.2-2.4 5-1" stroke="#eafffa" stroke-width="1.1" fill="none" opacity=".4" stroke-linecap="round"/>' +
  '<path d="M6.5 6.5c1.8 2.6.8 5-.8 6.8s-.4 4.2 2.4 4.2 4.6-2.4 5.4-5-.6-5.4-2.6-6.4-2.6-1.8-4.4.4z" fill="#eafffa" opacity=".35"/>' +
  '<ellipse cx="9" cy="7.5" rx="3.1" ry="2.1" fill="#fff" opacity=".75"/>' +
  '<circle cx="12" cy="12" r="9.5" fill="none" stroke="#bff2ea" stroke-width=".6" opacity=".5"/>');
// ch centralisé ici (2026-07-06, corrige un bug d'affichage : la table de loot avait un 0.001
// codé en dur, resté à l'ancien taux après le passage à 1% le 2026-07-06 — une seule source de
// vérité désormais, utilisée à la fois par le tirage réel et par son affichage)
const CRON_STONE = { name:'Pierre de Cron', key:'mat_cron_stone', icon:ICO_CRON_STONE, color:'#4ecdc4', ch:0.01 };
// Coeur de Vell : cœur stylisé bleu abyssal, lueur cyan pulsante — récompense rare du boss Vell
const ICO_COEUR_VELL = svgIcon(
  '<path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0112 6.5 5.5 5.5 0 0121.5 12c-2.5 4.5-9.5 9-9.5 9z" fill="#2a5a78"/>' +
  '<path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0112 6.5z" fill="#1c4058"/>' +
  '<circle cx="12" cy="13" r="2.6" fill="#5ec9e8" opacity=".8"/>');

// ==================== INVENTAIRE (192 slots) & ÉQUIPEMENT ====================
const INV_SIZE = 192;
const INV = new Array(INV_SIZE).fill(null);   // chaque slot : null | { key, name, kind, icon, color, qty, unit, val, weight, ap, dp }
const MAX_STACK = 9999;
// Sac "Compendium" (2026-07-08, demande explicite) : même taille que le sac principal (192 cases).
// Quand "Vendre" s'apprête à vendre une pièce d'équipement/bijou dont ce TYPE n'a JAMAIS atteint
// PEN (voir S.penMastery), un exemplaire est déposé ici au lieu d'être vendu — pour ne jamais perdre
// la chance de le monter en PEN plus tard. Toujours le PLUS ENCHANTÉ des exemplaires possédés (voir
// ensureCompendiumProtection, 2026-07-09) : un exemplaire plus enchanté trouvé dans le sac principal
// prend automatiquement la place de celui déjà protégé (souvent un +0), qui retourne dans le sac
// principal — jamais perdu ni détruit.
const COMPENDIUM_BAG = new Array(INV_SIZE).fill(null);
function compendiumBagHasName(name) { return COMPENDIUM_BAG.some(s => s && s.name === name); }
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


function invWeight() {
  let w = 0;
  for (const s of INV) if (s) w += (s.weight||0.1) * s.qty;
  return w;
}
// LT de base — mesuré empiriquement à ~6.8 LT/min en farm continu zone 1 (personnage neuf),
// calibré pour ~2h de farm avant ralentissement. Augmentable plus tard via une boutique.
const MAX_WEIGHT = () => 800;
function invUsed() { return INV.filter(s => s).length; }

// ajoute un objet à l'inventaire (stack si possible). retourne false si plein.
function invAdd(obj) {
  if (obj.stackable) {
    const slot = INV.find(s => s && s.key === obj.key && s.qty < MAX_STACK);
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
function enhBonus(lvl) { let b = 0; for (let i = 1; i <= (lvl||0); i++) b += ENH_STEP[i]; return b; }
function itemMult(item) { return item && item.optimizable ? (1 + enhBonus(item.enhLv||0)) : 1; }
// PA/PD réels d'un objet une fois son bonus d'enchantement appliqué (affichage tooltip/popup —
// avant ce correctif, ces deux endroits affichaient la stat de BASE même sur un objet enchanté +15)
// PA/PD arrondis vers le BAS (2026-07-08, demande explicite : "laisse uniquement des ajout de PA
// entier, enleve toute trace de virgule de PA/PD... rajoute les plus bas que necessaire pas a la
// hausse") -- Math.floor plutôt que Math.round : ne JAMAIS afficher/accorder plus de PA/PD que ce
// qui est réellement gagné (un Math.round aurait pu arrondir 2.6 à 3, donnant l'illusion d'un
// point de plus que la vraie valeur). L'Esquive reste en % avec décimales (pas concernée, c'est
// une stat de %, pas un PA/PD).
function effectiveApDp(item) {
  const mult = itemMult(item);
  return { ap: Math.floor((item.ap||0) * mult), dp: Math.floor((item.dp||0) * mult), hp: Math.floor((item.hp||0) * mult),
    dodge: Math.round((item.dodge||0) * mult * 100) / 100 };
}
// stats projetées SI l'objet atteignait targetLvl -- sert à afficher le gain avant de lancer
// l'optimisation auto (demande explicite du 2026-07-05 : "il est écrit ce que tu gagnes si tu
// passes à ce palier")
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
function itemFailstack(item, level) { return (item && item.fsByLevel && item.fsByLevel[level]) || 0; }
function addItemFailstack(item, level) {
  if (!item) return;
  if (!item.fsByLevel) item.fsByLevel = {};
  item.fsByLevel[level] = (item.fsByLevel[level] || 0) + 1;
}
// renvoie {base, bonus, total} — base = chance fixe, bonus = apport du failstack (affichés séparément sur la barre)
function enhChanceParts(level, item) {
  if (level < SAFE_IDX) return { base:1, bonus:0, total:1 };
  const base = ENH_CHANCE_FLAT[level] ?? .01;
  const inc = ENH_FS_INC[level] ?? .01;
  const fs = itemFailstack(item, level);
  const bonus = Math.min(0.9 - base, fs * inc); // plafond global 90%
  return { base, bonus: Math.max(0, bonus), total: base + Math.max(0, bonus) };
}
function enhChance(level, item) { return enhChanceParts(level, item).total; }

// ==================== POWER SCORE & SCALING ====================
// les 3 armes (principale + éveil + secondaire) contribuent chacune leur PA, selon LEUR PROPRE enchant
function weaponAP() {
  let a = 0;
  for (const k of WEAPON_SLOTS) { const e = EQUIP[k]; if (e) a += (e.ap||0) * itemMult(e); }
  return a;
}
// armure + bijoux : chaque pièce contribue selon SON propre niveau d'enchant
function equipAP() {
  let a = 0;
  for (const k of [...ARMOR_SLOTS, ...ACC_SLOTS]) { const e = EQUIP[k]; if (e) a += (e.ap||0) * itemMult(e); }
  return a;
}
function equipDP() {
  let d = 0;
  for (const k of [...ARMOR_SLOTS, ...ACC_SLOTS]) { const e = EQUIP[k]; if (e) d += (e.dp||0) * itemMult(e); }
  return d;
}
// PV apportés par l'armure (casque/plastron/gants/bottes) — demande : "ajoute au stuff des PV pour
// que les joueurs ne se fassent pas one-shot". S.hpMax reste la valeur de BASE (progression par
// niveau) ; effHpMax() = base + bonus d'armure, utilisée partout où "les PV max actuels" comptent.
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
function equipDodge() {
  let d = 0;
  for (const k of ARMOR_SLOTS) { const e = EQUIP[k]; if (e) d += (e.dodge||0) * itemMult(e); }
  return d;
}
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
function zoneItemNames(zi) {
  const z = ZONES[zi], tier = gearTierForZone(zi);
  return [tr(z.loot.trash.name), tr(tier.material.name), tr(z.loot.jackpot.name), tr(z.loot.craft.name)];
}
function zoneFullyCollected(zi) { return zoneItemNames(zi).every(n => compendiumItemDone(n)); }
// appelé après chaque ramassage d'objet (voir dropsTick) : détecte le passage "incomplet → complet"
// pour cette zone précise, et affiche la même notif +1% qu'avant (floatTxt + Discord)
function checkZoneCompendiumUnlock(zi, wasDone) {
  if (wasDone || !zoneFullyCollected(zi)) return;
  floatTxt(P.x, P.y, 96, '📖 Compendium — '+tr(ZONES[zi].name), { gold:true });
  const zc = compendiumZoneCount();
  logToDiscord('📖 Compendium', `**${myPseudo||'Joueur'}** débloque le bonus de **${tr(ZONES[zi].name)}** (${zc}/${ZONES.length} zones${zc>=ZONES.length?' — COMPENDIUM COMPLET ✓':''})`, 0xc9a55a);
}
// World Boss (ajouté au Compendium le 2026-07-08, demande explicite) : vaincre un boss AU MOINS
// une fois débloque le même bonus qu'une zone (+1% SPD/DMG/Esquive), voir endBossFight
function markBossDefeated(bossId) {
  if (S.bossesKilled[bossId]) return;
  S.bossesKilled[bossId] = true;
  const b = BOSS_ROSTER[bossId];
  floatTxt(P.x, P.y, 96, '📖 Compendium — '+b.name[LANG], { gold:true });
  logToDiscord('📖 Compendium', `**${myPseudo||'Joueur'}** débloque le bonus de **${b.name.fr}** (World Boss)`, 0xc9a55a);
}
function compendiumZoneCount() { return ZONES.reduce((n,z,zi) => n + (zoneFullyCollected(zi)?1:0), 0); }
function compendiumBossCount() { return Object.keys(S.bossesKilled||{}).length; }
function compendiumTotalCount() { return compendiumZoneCount() + compendiumBossCount(); }
function compendiumTotalMax() { return ZONES.length + Object.keys(BOSS_ROSTER).length; }
function compendiumPct() { return compendiumTotalCount() * 1; } // points de %, 1 par zone OU par boss

// ---- Compendium spécial "Maîtrise PEN" (2026-07-08, demande explicite) : liste TOUS les objets
// optimisables du jeu (7 pièces × 4 paliers de stuff + 1 bijou par zone) et suit lesquels ont déjà
// atteint PEN (niveau max) AU MOINS UNE FOIS — purement un suivi de complétion, sans bonus de
// stats (contrairement au Compendium zones/World Boss). Persisté via S.penMastery.
function penMasteryItemList() {
  const names = [];
  for (const tier of GEAR_TIERS) for (const slot of GEAR_SLOTS) names.push(tier.sets[slot]);
  for (const z of ZONES) names.push(z.loot.jackpot.name);
  return names; // 4×7 + 11 = 39 entrées, dans l'ordre gris→blanc→vert→bleu puis zone 1→11
}
function markPenMastery(name) {
  if (S.penMastery[name]) return;
  S.penMastery[name] = true;
  const done = compendiumPenCount(), max = penMasteryItemList().length;
  floatTxt(P.x, P.y, 96, '🌟 PEN — '+tr(name), { gold:true });
  logToDiscord('🌟 Maîtrise PEN', `**${myPseudo||'Joueur'}** amène ${name} à PEN pour la première fois (${done}/${max}${done>=max?' — MAÎTRISE COMPLÈTE ✓':''})`, 0xffe9a8);
}
function compendiumPenCount() { return Object.keys(S.penMastery||{}).length; }
// meilleur niveau d'optimisation JAMAIS atteint pour un nom d'objet donné (2026-07-15, demande
// explicite : "affiche l'opti dans le compendium si on a vendu un objet optimisé") — contrairement
// à S.penMastery (qui ne retient QUE le passage à PEN), ceci retient TOUT niveau intermédiaire
// (+1 à +19 compris), pour que le Compendium garde une trace même d'un objet enchanté puis vendu
// avant PEN. Mis à jour à CHAQUE succès d'optimisation (voir attemptEnhance), jamais effacé.
function trackEnhPeak(name, lvl) {
  if (!S.enhPeakByName) S.enhPeakByName = {};
  if ((S.enhPeakByName[name]||0) < lvl) S.enhPeakByName[name] = lvl;
}

// Vitesse de déplacement (2026-07-08) : progression par NIVEAU (0% au niv.1, jusqu'à +75% au
// niveau 61, plafonné ensuite) + bonus de Compendium (points de % additifs entre eux).
function levelSpdPct() { return Math.max(0, Math.min(S.lvl,61)-1) / 60 * 75; }
function totalSpdPct() { return levelSpdPct() + compendiumPct(); }
function totalDmgPct() { return compendiumPct(); } // le DMG ne monte qu'avec le Compendium, pas le niveau

// Esquive : dépend du niveau du monstre RELATIF au joueur (via dpRatio, comme le reste du combat).
// Sous-géré pour la zone (dpRatio < 0.5) → l'esquive perd tout son intérêt (jusqu'à 0% d'effet) ;
// à niveau ou au-dessus (dpRatio >= 1) → pleinement efficace. Dans une zone basse largement
// dépassée, un bon total d'esquive peut donc éviter presque tous les dégâts.
function dodgeEffectiveness(dpR) {
  if (dpR >= 1) return 1;
  return Math.max(0, (dpR - 0.5) / 0.5);
}
function totalDodgePct(dpR) {
  const raw = equipDodge() + compendiumPct();
  return Math.min(60, raw * dodgeEffectiveness(dpR ?? dpRatio())); // plafond 60% pour ne jamais rendre invincible
}

// ==================== SUCCÈS (permanents) & QUÊTES JOURNALIÈRES ====================
// tous les objectifs ne reposent que sur des stats atteignables en solo (kills, loot, silver,
// zones, gearscore, enchantement, temps de jeu) — jamais sur le marché/classement/Discord,
// qui nécessitent un compte vérifié : ainsi tout succès/quête reste faisable par n'importe quel joueur.
function maxEnhLv() {
  let m = 0;
  for (const k of OPTIMIZABLE_SLOTS) { const e = EQUIP[k]; if (e && (e.enhLv||0) > m) m = e.enhLv||0; }
  return m;
}
const ACHIEVEMENTS = [
  { id:'first_kill',   icon:'🗡️', name:{fr:'Premier sang',        en:'First blood'},        desc:{fr:'Terrasse ton premier monstre',              en:'Defeat your first monster'},               statFn:S=>S.kills,               target:1,               reward:300 },
  { id:'kills_100',    icon:'⚔️', name:{fr:'Chasseur',            en:'Hunter'},              desc:{fr:'Terrasse 100 monstres',                     en:'Defeat 100 monsters'},                     statFn:S=>S.kills,               target:100,             reward:1500 },
  { id:'kills_1000',   icon:'⚔️', name:{fr:'Exterminateur',       en:'Exterminator'},        desc:{fr:'Terrasse 1 000 monstres',                   en:'Defeat 1,000 monsters'},                   statFn:S=>S.kills,               target:1000,            reward:8000 },
  { id:'kills_10000',  icon:'💀', name:{fr:'Faucheur',            en:'Reaper'},              desc:{fr:'Terrasse 10 000 monstres',                  en:'Defeat 10,000 monsters'},                  statFn:S=>S.kills,               target:10000,           reward:40000 },
  { id:'loot_1',       icon:'🎒', name:{fr:'Premier butin',       en:'First loot'},          desc:{fr:'Ramasse ton premier objet',                 en:'Pick up your first item'},                 statFn:S=>S.lootCount,           target:1,               reward:200 },
  { id:'loot_500',     icon:'🎒', name:{fr:'Collectionneur',      en:'Collector'},           desc:{fr:'Ramasse 500 objets',                        en:'Loot 500 items'},                          statFn:S=>S.lootCount,           target:500,             reward:4000 },
  { id:'loot_5000',    icon:'🎒', name:{fr:'Accumulateur',        en:'Hoarder'},             desc:{fr:'Ramasse 5 000 objets',                      en:'Loot 5,000 items'},                        statFn:S=>S.lootCount,           target:5000,            reward:25000 },
  { id:'silver_10k',   icon:'🪙', name:{fr:'Petite fortune',      en:'Small fortune'},       desc:{fr:'Gagne 10 000 silver au total',              en:'Earn a total of 10,000 silver'},           statFn:S=>S.silverEarned,        target:10000,           reward:1000 },
  { id:'silver_100k',  icon:'🪙', name:{fr:'Marchand',            en:'Merchant'},            desc:{fr:'Gagne 100 000 silver au total',             en:'Earn a total of 100,000 silver'},          statFn:S=>S.silverEarned,        target:100000,          reward:5000 },
  { id:'silver_1m',    icon:'💰', name:{fr:'Riche marchand',      en:'Wealthy merchant'},    desc:{fr:'Gagne 1 000 000 silver au total',           en:'Earn a total of 1,000,000 silver'},        statFn:S=>S.silverEarned,        target:1000000,         reward:20000 },
  { id:'silver_10m',   icon:'💰', name:{fr:'Magnat',              en:'Tycoon'},              desc:{fr:'Gagne 10 000 000 silver au total',          en:'Earn a total of 10,000,000 silver'},       statFn:S=>S.silverEarned,        target:10000000,        reward:100000 },
  { id:'zone_2',       icon:'🗺️', name:{fr:'Explorateur',         en:'Explorer'},            desc:{fr:'Atteins la 2e zone de farm',                en:'Reach the 2nd farming zone'},              statFn:S=>S.maxZoneIdx+1,        target:2,               reward:1500 },
  { id:'zone_6',       icon:'🗺️', name:{fr:'Aventurier',          en:'Adventurer'},          desc:{fr:'Atteins la 6e zone de farm',                en:'Reach the 6th farming zone'},              statFn:S=>S.maxZoneIdx+1,        target:6,               reward:15000 },
  { id:'zone_last',    icon:'🏔️', name:{fr:'Conquérant de Velia', en:'Conqueror of Velia'},  desc:{fr:'Atteins la dernière zone de farm',          en:'Reach the final farming zone'},            statFn:S=>S.maxZoneIdx+1,        target:ZONES.length,    reward:120000 },
  { id:'gs_50',        icon:'🛡️', name:{fr:'Bien équipé',         en:'Well equipped'},       desc:{fr:'Atteins 50 de Gearscore',                   en:'Reach 50 Gearscore'},                      statFn:()=>GS(),                 target:50,              reward:5000 },
  { id:'gs_150',       icon:'🛡️', name:{fr:'Vétéran équipé',      en:'Veteran gear'},        desc:{fr:'Atteins 150 de Gearscore',                  en:'Reach 150 Gearscore'},                     statFn:()=>GS(),                 target:150,             reward:25000 },
  { id:'gs_300',       icon:'🛡️', name:{fr:'Légende vivante',     en:'Living legend'},       desc:{fr:'Atteins 300 de Gearscore',                  en:'Reach 300 Gearscore'},                     statFn:()=>GS(),                 target:300,             reward:90000 },
  { id:'enh_pri',      icon:'✨', name:{fr:'Étincelle divine',    en:'Divine spark'},        desc:{fr:'Amène une pièce d\'équipement au niveau PRI',en:'Bring one piece of gear to PRI level'},    statFn:()=>maxEnhLv(),           target:PRI_IDX,         reward:20000 },
  { id:'enh_max',      icon:'🌟', name:{fr:'Perfection',          en:'Perfection'},          desc:{fr:'Amène une pièce d\'équipement au niveau PEN (max)', en:'Bring one piece of gear to PEN (max) level'}, statFn:()=>maxEnhLv(), target:ENH_NAMES.length-1, reward:150000 },
  { id:'jackpot_1',    icon:'💎', name:{fr:'Coup de chance',      en:'Lucky strike'},        desc:{fr:'Trouve ton premier bijou rare',             en:'Find your first rare jewelry drop'},       statFn:S=>S.jackpotCount||0,     target:1,               reward:2000 },
  { id:'gear_1',       icon:'⚙️', name:{fr:'Nouvel équipement',   en:'New gear'},            desc:{fr:'Trouve ta première pièce d\'équipement',    en:'Find your first piece of gear'},           statFn:S=>S.gearDropCount||0,    target:1,               reward:800 },
  { id:'playtime_1h',  icon:'⏱️', name:{fr:'Habitué',             en:'Regular'},             desc:{fr:'Joue pendant 1 heure au total',             en:'Play for a total of 1 hour'},              statFn:S=>S.playtimeSec,         target:3600,            reward:1500 },
  { id:'playtime_10h', icon:'⏱️', name:{fr:'Dévoué',              en:'Dedicated'},           desc:{fr:'Joue pendant 10 heures au total',           en:'Play for a total of 10 hours'},            statFn:S=>S.playtimeSec,         target:36000,           reward:12000 },
  { id:'treasure_1',   icon:'🗺️', name:{fr:'Chercheur de trésor', en:'Treasure seeker'},     desc:{fr:'Trouve ton premier morceau du Trésor de Velia', en:'Find your first Velia Treasure piece'},  statFn:S=>treasureTotal(S),      target:1,               reward:5000 },
  { id:'treasure_10',  icon:'🗺️', name:{fr:'Chasseur de trésor',  en:'Treasure hunter'},     desc:{fr:'Trouve 10 morceaux du Trésor de Velia (tous types)', en:'Find 10 Velia Treasure pieces (any type)'}, statFn:S=>treasureTotal(S), target:10,              reward:30000 },
];
// catégories de succès (demande utilisateur : silver, butin, temps de jeu, exploration,
// équipement — + combat pour les kills)
const ACH_CATS = {
  combat:      { icon:'⚔️', label:{fr:'Combat',en:'Combat'} },
  butin:       { icon:'🎒', label:{fr:'Butin',en:'Loot'} },
  silver:      { icon:'🪙', label:{fr:'Silver',en:'Silver'} },
  playtime:    { icon:'⏱️', label:{fr:'Temps de jeu',en:'Playtime'} },
  exploration: { icon:'🗺️', label:{fr:'Exploration',en:'Exploration'} },
  equipment:   { icon:'🛡️', label:{fr:'Équipement',en:'Equipment'} },
  treasure:    { icon:'🗺️', label:{fr:'Trésor de Velia',en:'Velia Treasure'} },
};
function achCat(id) {
  if (id === 'first_kill' || id.startsWith('kills')) return 'combat';
  if (id.startsWith('loot')) return 'butin';
  if (id.startsWith('silver')) return 'silver';
  if (id.startsWith('playtime')) return 'playtime';
  if (id.startsWith('treasure')) return 'treasure';
  if (id.startsWith('zone')) return 'exploration';
  return 'equipment'; // gs_*, enh_*, jackpot_1, gear_1
}
// ---------- centre de notifications : journal PERSISTANT (survit au reload/reconnexion, stocké
// dans S.notifLog comme le reste de la sauvegarde) des événements marquants (succès, niveau, butin
// rare, victoire de boss...), en plus des toasts éphémères déjà existants ----------
let notifUnread = 0;
let notifSerial = 0; // id local incrémental (unique le temps d'une session, suffisant pour les boutons "supprimer")
// cat : 'important' (nécessite l'attention du joueur, ex: reset de compte) | 'success' (réussite/
// progression positive) | 'info' (routine) — sert à trier/distinguer visuellement dans le centre
// de notifications refait le 2026-07-07 ("qu'on y comprenne quelque chose avec ce qui est
// important ou non")
const NOTIF_MAX_AGE_MS = 7 * 24 * 3600 * 1000; // auto-purge après 7 jours — demande explicite du 2026-07-08
const NOTIF_SHOW_LIMIT = 20; // "affiche les 20 dernières entrées" — demande explicite du 2026-07-08
function pruneNotifLog() {
  const cutoff = Date.now() - NOTIF_MAX_AGE_MS;
  S.notifLog = (S.notifLog||[]).filter(n => n.t >= cutoff);
}
function pushNotif(icon, title, text, cat) {
  pruneNotifLog();
  S.notifLog.unshift({ id: ++notifSerial + '_' + Date.now(), icon, title, text, t: Date.now(), cat: cat || 'info' });
  if (S.notifLog.length > 200) S.notifLog.length = 200; // garde-fou dur, bien au-delà des 20 affichées
  notifUnread++;
  updateNotifBadge();
}
function deleteNotif(id) {
  S.notifLog = (S.notifLog||[]).filter(n => n.id !== id);
  openNotifCenter(); // re-render immédiat, le joueur voit la ligne disparaître
}
// relaie un événement vers le salon Discord "log général" via l'Edge Function discord-log —
// le webhook lui-même reste côté serveur, jamais dans ce code client (voir supabase-discord-log)
async function logToDiscord(title, description, color) {
  if (!sb) return;
  try {
    const { data } = await sb.auth.getSession();
    const token = (data && data.session && data.session.access_token) || SUPABASE_ANON_KEY;
    await fetch(SUPABASE_URL + '/functions/v1/discord-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ title, description, color }),
    });
  } catch (e) {}
}
function updateNotifBadge() {
  const badge = $a('notifBadge'); if (!badge) return;
  badge.textContent = notifUnread > 9 ? '9+' : notifUnread;
  badge.classList.toggle('show', notifUnread > 0);
  // halo doré autour du bouton cloche (même animation que "notes de version non lues") — demande
  // explicite du 2026-07-08 : "montre où se trouve des notifications avec halo"
  const btn = $a('btnNotifCenter'); if (btn) btn.classList.toggle('hasNew', notifUnread > 0);
}
// affiche TOUJOURS la date (pas seulement l'heure pour aujourd'hui) — demande explicite du
// 2026-07-07, pour pouvoir resituer une notification dans le temps sans ambiguïté
function fmtNotifTime(ts) {
  const d = new Date(ts);
  const hhmm = d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0');
  return d.getDate().toString().padStart(2,'0')+'/'+(d.getMonth()+1).toString().padStart(2,'0')+' '+hhmm;
}
// bannière colorée d'annonce importante (ex: reset complet des comptes) + entrée correspondante
// dans le centre de notifications — demande explicite du 2026-07-06
function showResetNotice(icon, title, body) {
  $('resetNoticeIcon').textContent = icon || '🔔';
  $('resetNoticeTitle').textContent = title;
  $('resetNoticeBody').innerHTML = body;
  $('resetNoticeOverlay').classList.add('show');
  pushNotif(icon || '🔔', title, body.replace(/<[^>]+>/g, ''), 'important');
}
$('resetNoticeClose').onclick = () => $('resetNoticeOverlay').classList.remove('show');
// réclame une éventuelle notice en attente à la connexion (livrée une seule fois, voir
// claim_pending_notice côté serveur) — appelé après le chargement de la sauvegarde cloud
async function checkPendingNotice() {
  if (!sb || !currentUser) return;
  try {
    const { data } = await sb.rpc('claim_pending_notice');
    const n = Array.isArray(data) ? data[0] : data;
    if (n && n.notice_key) {
      showResetNotice(n.icon, LANG==='fr' ? n.title_fr : n.title_en, LANG==='fr' ? n.body_fr : n.body_en);
    }
  } catch (e) {}
}
// centre de notifications refait proprement le 2026-07-07 : sépare ce qui est IMPORTANT (nécessite
// l'attention, ex: reset de compte) du reste (succès/progression), au lieu d'une simple liste plate
const NOTIF_CAT_META = {
  important: { fr:'⚠️ Important', en:'⚠️ Important' },
  success:   { fr:'🏆 Réussites', en:'🏆 Achievements' },
  info:      { fr:'📰 Activité',  en:'📰 Activity' },
};
function notifRowHtml(n) {
  return `<div class="notifRow ${n.cat}">
    <div class="notifIcon">${n.icon}</div>
    <div class="notifBody"><div class="notifTitle">${escapeHtml(n.title)}</div><div class="notifText">${escapeHtml(n.text)}</div></div>
    <div class="notifTime">${fmtNotifTime(n.t)}</div>
    <button class="notifDelBtn" data-id="${n.id}" title="${LANG==='fr'?'Supprimer':'Delete'}">✕</button>
  </div>`;
}
let notifCatFilter = 'all'; // 'all' | 'important' | 'success' | 'info' — demande explicite du 2026-07-08 ("les catégories doivent être en haut")
function openNotifCenter() {
  notifUnread = 0;
  updateNotifBadge();
  pruneNotifLog(); // purge les entrées de plus de 7 jours avant d'afficher
  const log = S.notifLog||[];
  if (!log.length) {
    openInfo(LANG==='fr' ? '🔔 Notifications' : '🔔 Notifications',
      `<div class="admEmpty">${LANG==='fr'?'Aucune notification pour l\'instant':'No notifications yet'}</div>`);
    return;
  }
  // "affiche les 20 dernières entrées" (demande explicite du 2026-07-08) : on ne garde QUE les 20
  // plus récentes tous types confondus pour l'affichage (le stockage garde jusqu'à 200, purgées au
  // bout de 7 jours) — réparties ensuite par catégorie, avec des ONGLETS FIXES en haut du panneau
  // (au lieu de simples titres de section perdus dans le défilement) pour sauter direct à une
  // catégorie sans avoir à scroller.
  const shown = log.slice(0, NOTIF_SHOW_LIMIT);
  const important = shown.filter(n => n.cat === 'important');
  const success = shown.filter(n => n.cat === 'success');
  const info = shown.filter(n => n.cat === 'info');
  if (!['all','important','success','info'].includes(notifCatFilter)) notifCatFilter = 'all';
  const tabsHtml = `<div class="catTabs">
    <button class="catTab notifCatTab${notifCatFilter==='all'?' active':''}" data-cat="all">${LANG==='fr'?'Tout':'All'} <span class="notifSectionCount">${shown.length}</span></button>
    <button class="catTab notifCatTab${notifCatFilter==='important'?' active':''}" data-cat="important">${NOTIF_CAT_META.important[LANG]} <span class="notifSectionCount">${important.length}</span></button>
    <button class="catTab notifCatTab${notifCatFilter==='success'?' active':''}" data-cat="success">${NOTIF_CAT_META.success[LANG]} <span class="notifSectionCount">${success.length}</span></button>
    <button class="catTab notifCatTab${notifCatFilter==='info'?' active':''}" data-cat="info">${NOTIF_CAT_META.info[LANG]} <span class="notifSectionCount">${info.length}</span></button>
  </div>`;
  const section = (cat, items) => !items.length ? '' :
    `<div class="notifSectionTitle">${NOTIF_CAT_META[cat][LANG]} <span class="notifSectionCount">${items.length}</span></div>` +
    items.map(notifRowHtml).join('');
  const html = notifCatFilter === 'all'
    ? section('important', important) + section('success', success) + section('info', info)
    : (notifCatFilter === 'important' ? important : notifCatFilter === 'success' ? success : info).map(notifRowHtml).join('') ||
      `<div class="admEmpty">${LANG==='fr'?'Rien dans cette catégorie':'Nothing in this category'}</div>`;
  const summary = `<div class="notifSummary">${LANG==='fr'
    ? `${shown.length} affichée${shown.length>1?'s':''} (sur ${log.length}) · auto-supprimées après 7 jours`
    : `${shown.length} shown (of ${log.length}) · auto-deleted after 7 days`}</div>`;
  openInfo(LANG==='fr' ? '🔔 Notifications' : '🔔 Notifications', summary + tabsHtml + `<div class="notifScroll">${html}</div>`);
  $a('infoBody').querySelectorAll('.notifCatTab').forEach(btn => {
    btn.onclick = () => { notifCatFilter = btn.dataset.cat; openNotifCenter(); };
  });
  $a('infoBody').querySelectorAll('.notifDelBtn').forEach(btn => {
    btn.onclick = e => { e.stopPropagation(); deleteNotif(btn.dataset.id); };
  });
}

function checkAchievements() {
  let unlocked = false;
  for (const a of ACHIEVEMENTS) {
    if (S.achUnlocked[a.id]) continue;
    if (a.statFn(S) >= a.target) {
      S.achUnlocked[a.id] = Date.now();
      addSilver(a.reward, 'achievement', a.name.fr);
      showAchToast(a);
      pushNotif('🏅', LANG==='fr'?'Succès débloqué':'Achievement unlocked', a.name[LANG]+' (+'+fmt(a.reward)+' 🪙)', 'success');
      logToDiscord('🏅 Succès débloqué', `**${myPseudo||'Joueur'}** — ${a.name.fr} (+${fmt(a.reward)} 🪙)`, 0xc9a55a);
      unlocked = true;
    }
  }
  if (unlocked) refreshStatsOnly();
}
function showAchToast(a) {
  const stack = $('achToastStack'); if (!stack) return;
  const el = document.createElement('div');
  el.className = 'achToast';
  el.innerHTML = `<div class="achToastIcon">${a.icon}</div>` +
    `<div><div class="achToastTitle">${LANG==='fr'?'🏅 Succès débloqué':'🏅 Achievement unlocked'}</div>` +
    `<div class="achToastName">${a.name[LANG]}</div>` +
    `<div class="achToastReward">+${fmt(a.reward)} 🪙</div></div>`;
  stack.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 4500);
}
// ---------- courrier (mailbox) : stockage permanent, jamais plein, jamais perdu ----------
// contrairement au sac (192 cases, peut être plein), tout ce qui arrive ici s'empile sans
// limite — pensé pour des dons automatiques comme la fidélité journalière (voir plus bas)
function mailboxAdd(key, name, icon, qty) {
  const existing = S.mailbox.find(m => m.key === key);
  if (existing) existing.qty += qty;
  else S.mailbox.push({ key, name, icon, qty });
}
function showMailToast(icon, name, qty) {
  const stack = $('achToastStack'); if (!stack) return;
  const el = document.createElement('div');
  el.className = 'achToast';
  el.innerHTML = `<div class="achToastIcon">${icon}</div>` +
    `<div><div class="achToastTitle">${LANG==='fr'?'📬 Nouveau courrier':'📬 New mail'}</div>` +
    `<div class="achToastName">${name}</div>` +
    `<div class="achToastReward">+${fmt(qty)}</div></div>`;
  stack.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 4500);
}
// 200 points de fidélité par jour, livrés dans le courrier — appelé depuis hud() (cheap check).
// Depuis le 2026-07-11 (demande explicite) : le gain quotidien ne rejoint plus S.loyalty tout
// seul, il s'accumule dans le courrier (sans limite, tant que le joueur ne les récupère pas) —
// voir claimLoyalty() pour le passage courrier -> stock utilisable (affiché à côté du silver).
function ensureLoyaltyGrant() {
  if (!saveReady) return; // attend la vraie sauvegarde -- voir la déclaration de saveReady
  const now = new Date();
  const key = now.getFullYear()+'-'+(now.getMonth()+1)+'-'+now.getDate();
  if (S.lastLoyaltyDate === key) return;
  S.lastLoyaltyDate = key;
  const name = 'Loyalties'; // renommé le 2026-07-07 (demande explicite), même nom dans les 2 langues
  mailboxAdd('loyalty', name, '🏅', 200);
  showMailToast('🏅', name, 200);
  updateMailBadge();
}
// déplace tout le solde en attente dans le courrier vers S.loyalty (stock réellement utilisable,
// affiché à côté du silver dans l'inventaire) -- le courrier continuera d'accumuler normalement
// dès le prochain octroi journalier, rien n'est jamais plafonné ni perdu entre-temps
function claimLoyalty() {
  const m = S.mailbox.find(m => m.key === 'loyalty');
  if (!m || m.qty <= 0) return;
  S.loyalty = (S.loyalty||0) + m.qty;
  m.qty = 0;
  updateMailBadge();
  hud();
}
// après une réinitialisation complète, on veut un VRAI 0 immédiat — sans ça, le hud() appelé en
// fin d'applySaveState() redéclenche aussitôt ensureLoyaltyGrant() (lastLoyaltyDate remis à null
// par le reset) et regrante 200 Loyalties à l'instant, masquant le fait que ça a bien été remis à
// zéro. Bug confirmé le 2026-07-07 : "les Loyalties ne sont jamais remis à 0 même après un reset".
// Le prochain octroi journalier reprendra normalement dès demain.
function suppressLoyaltyGrantForToday() {
  const now = new Date();
  S.lastLoyaltyDate = now.getFullYear()+'-'+(now.getMonth()+1)+'-'+now.getDate();
  S.loyalty = 0;
}
function updateMailBadge() {
  const badge = $('mailBadge'); if (!badge) return;
  const n = S.mailbox.reduce((sum,m) => sum + m.qty, 0);
  badge.textContent = fmt(n);
  badge.classList.toggle('show', n > 0);
}
function renderMailboxHtml() {
  const stockRow = `<div class="admSummary">${LANG==='fr'?'Stock de Loyalties déjà récupéré':'Already claimed Loyalty stock'} : <b>${fmt(S.loyalty||0)}</b> 🏅</div>`;
  if (!S.mailbox.length || !S.mailbox.some(m => m.qty > 0)) {
    return stockRow + `<div class="admEmpty">${LANG==='fr'?'Ton courrier est vide':'Your mailbox is empty'}</div>`;
  }
  return stockRow + S.mailbox.filter(m => m.qty > 0).map(m => `<div class="achRow">` +
    `<div class="achIcon">${m.icon}</div>` +
    `<div class="achInfo"><div class="achName">${m.name}</div></div>` +
    `<div class="achReward">×${fmt(m.qty)}</div>` +
    (m.key === 'loyalty' ? `<button class="mailClaimBtn" data-key="${m.key}">${LANG==='fr'?'Récupérer':'Claim'}</button>` : '') +
    `</div>`).join('') +
    `<div class="admSummary">${LANG==='fr'?'Ces objets restent ici en permanence tant qu\'ils ne sont pas récupérés — ils ne se perdent jamais et s\'empilent sans limite.':'These items stay here permanently until claimed — they never get lost and stack without limit.'}</div>`;
}
function openMailbox() {
  openInfo(LANG==='fr' ? '📬 Courrier' : '📬 Mailbox', renderMailboxHtml());
  $a('infoBody').querySelectorAll('.mailClaimBtn').forEach(btn => {
    btn.onclick = () => { if (btn.dataset.key === 'loyalty') claimLoyalty(); openMailbox(); };
  });
}

// World Boss (Kzarka/Vell : lobby, combat, rendu de la salle) -> voir boss.js (charge APRES ce fichier, voir index.html)

let achPanelCat = 'all';       // catégorie affichée dans le panneau Succès
let achOnlyUnfinished = false; // filtre "pas fini"
function achRowHtml(a) {
  const val = a.statFn(S), done = !!S.achUnlocked[a.id];
  const pct = Math.max(0, Math.min(100, Math.round((val/a.target)*100)));
  return `<div class="achRow${done?' done':''}">` +
    `<div class="achIcon">${a.icon}</div>` +
    `<div class="achInfo"><div class="achName">${a.name[LANG]}</div><div class="achDesc">${a.desc[LANG]}</div>` +
    `<div class="achBarWrap"><div class="achBar" style="width:${pct}%"></div></div>` +
    `<div class="achProgress">${done ? (LANG==='fr'?'Terminé ✓':'Completed ✓') : fmt(Math.min(val,a.target))+' / '+fmt(a.target)}</div></div>` +
    `<div class="achReward">+${fmt(a.reward)} 🪙</div></div>`;
}
function renderAchievementsHtml() {
  const doneCount = ACHIEVEMENTS.filter(a => S.achUnlocked[a.id]).length;
  // onglets : Tout + une catégorie par famille (avec compteur restant en badge)
  const cats = [['all', {icon:'🏅', label:{fr:'Tout',en:'All'}}], ...Object.entries(ACH_CATS)];
  const tabsHtml = cats.map(([id, meta]) => {
    const list = id==='all' ? ACHIEVEMENTS : ACHIEVEMENTS.filter(a => achCat(a.id)===id);
    const remaining = list.filter(a => !S.achUnlocked[a.id]).length;
    const badge = remaining>0 ? `<span class="qCountBadge">${remaining}</span>` : `<span class="qCountBadge done">✓</span>`;
    return `<button class="catTab achCatTab${id===achPanelCat?' active':''}" data-cat="${id}">${meta.icon} ${meta.label[LANG]} ${badge}</button>`;
  }).join('');
  // filtre "pas fini"
  const filterBtn = `<button id="achUnfinishedBtn" class="achFilterBtn${achOnlyUnfinished?' on':''}">${achOnlyUnfinished?(LANG==='fr'?'☑ Pas fini':'☑ Unfinished'):(LANG==='fr'?'☐ Pas fini':'☐ Unfinished')}</button>`;
  let list = achPanelCat==='all' ? ACHIEVEMENTS : ACHIEVEMENTS.filter(a => achCat(a.id)===achPanelCat);
  if (achOnlyUnfinished) list = list.filter(a => !S.achUnlocked[a.id]);
  const rows = list.length ? list.map(achRowHtml).join('')
    : `<div class="admEmpty">${LANG==='fr'?'Rien à afficher ici':'Nothing to show here'}</div>`;
  return `<div class="achSummary">${doneCount} / ${ACHIEVEMENTS.length}</div>` +
    `<div class="catTabs">${tabsHtml}</div>${filterBtn}${rows}`;
}
function openAchievements() {
  const callout = contentChangeCalloutHtml('achievements');
  openInfo(LANG==='fr'?'🏅 Succès':'🏅 Achievements', callout + renderAchievementsHtml());
  markContentSeen('achievements');
  $a('infoBody').querySelectorAll('.achCatTab').forEach(btn => {
    btn.onclick = () => { achPanelCat = btn.dataset.cat; openAchievements(); };
  });
  const fb = $a('achUnfinishedBtn');
  if (fb) fb.onclick = () => { achOnlyUnfinished = !achOnlyUnfinished; openAchievements(); };
}

// ---------- Compendium (bonus de collection par zone) — demande explicite du 2026-07-08 ----------
// le bonus d'une zone n'est actif QUE si ses 4 objets (trash/matériau/bijou/craft) ont TOUS déjà
// été obtenus au moins une fois (voir zoneFullyCollected/compendiumZoneCount) — pas juste 1 seul.
function compendiumItemDone(name) { return (S.lootByItem[name]||0) > 0; }
// clic sur un objet du Compendium : montre (halo doré) TOUTES les zones qui le lootent, et propose
// d'y aller directement — demande explicite du 2026-07-08 ("je clique sur Ceinture de Naru j'ai un
// halo qui me montre toutes les zones qui loot ça et je choisis laquelle je veux")
function compendiumHighlightItem(name) {
  document.querySelectorAll('.compZoneRow').forEach(r => r.classList.remove('compHalo'));
  const matches = [];
  ZONES.forEach((z,zi) => {
    const tier = gearTierForZone(zi);
    const names = [tr(z.loot.trash.name), tr(tier.material.name), tr(z.loot.jackpot.name), tr(z.loot.craft.name)];
    if (names.includes(name)) matches.push(zi);
  });
  matches.forEach(zi => { const row = document.querySelector(`.compZoneRow[data-zi="${zi}"]`); if (row) row.classList.add('compHalo'); });
  const picker = $a('compZonePicker'); if (!picker) return;
  picker.innerHTML = matches.length
    ? `<b>${escapeHtml(name)}</b> ${LANG==='fr'?'— clique une zone pour y farmer directement :':'— click a zone to go farm there directly:'} ` +
      matches.map(zi => `<button class="compGoZoneBtn" data-zi="${zi}" title="${LANG==='fr'?'Lance le farm dans cette zone immédiatement':'Starts farming in this zone immediately'}">${tr(ZONES[zi].name)}</button>`).join('')
    : `<span class="admEmpty">${LANG==='fr'?'Aucune zone trouvée pour cet objet':'No zone found for this item'}</span>`;
  picker.querySelectorAll('.compGoZoneBtn').forEach(btn => {
    btn.onclick = () => {
      const zi = parseInt(btn.dataset.zi,10);
      if (atVelia || zi !== zoneIdx) travelTo(zi);
      $a('infoOverlay').classList.remove('open');
    };
  });
}
let compendiumTab = 'zones'; // 'zones' | 'bosses' | 'pen' — demande explicite du 2026-07-08 ("refais moi le compendium pour qu'il ressemble a quelque chose de lisible")
function renderCompendiumHtml() {
  const zc = compendiumZoneCount(), bc = compendiumBossCount();
  const total = compendiumTotalCount(), max = compendiumTotalMax(), pct = compendiumPct();
  const bossCountMax = Object.keys(BOSS_ROSTER).length;
  const penItems = penMasteryItemList(), penDone = compendiumPenCount();
  const summaryCard = `<button id="compTutoBtn" class="compTutoBtn" title="${LANG==='fr'?'Lancer le tutoriel du Compendium':'Start the Compendium tutorial'}">?</button>
    <div class="admStatTiles">
      <div class="admStatTile"><div class="astLbl">📖 ${LANG==='fr'?'Progression':'Progress'}</div><div class="astVal">${total} / ${max}</div></div>
      <div class="admStatTile"><div class="astLbl">🏃 SPD</div><div class="astVal">+${pct}%</div></div>
      <div class="admStatTile"><div class="astLbl">⚔️ ${LANG==='fr'?'Dégâts':'DMG'}</div><div class="astVal">+${pct}%</div></div>
      <div class="admStatTile"><div class="astLbl">🛡️ ${LANG==='fr'?'Esquive':'Dodge'}</div><div class="astVal">+${pct}%</div></div>
    </div>
    <div class="admSummary">${LANG==='fr'?`${zc}/${ZONES.length} zones · ${bc}/${bossCountMax} World Boss · ${penDone}/${penItems.length} PEN`:`${zc}/${ZONES.length} zones · ${bc}/${bossCountMax} World Bosses · ${penDone}/${penItems.length} PEN`}</div>
    <div class="admHint">${LANG==='fr'
      ? 'Chaque zone visitée (au moins 1 objet ramassé) ET chaque World Boss vaincu débloque +1% Vitesse, +1% Dégâts, +1% Esquive (additif, jamais un multiplicateur). Clique sur un objet ci-dessous pour voir dans quelles zones le farmer, puis clique une zone pour y lancer le farm directement (aucune confirmation, tu y es téléporté aussitôt).'
      : 'Every visited zone (at least 1 item looted) AND every defeated World Boss unlocks +1% Speed, +1% Damage, +1% Dodge (additive, never a multiplier). Click an item below to see which zones farm it, then click a zone to start farming there right away (no confirmation, you\'re sent there instantly).'}</div>
    <div id="compZonePicker" class="compZonePicker"></div>
    <div class="catTabs">
      <button class="catTab compTab${compendiumTab==='zones'?' active':''}" data-tab="zones">🗺️ ${LANG==='fr'?'Zones':'Zones'} (${zc}/${ZONES.length})</button>
      <button class="catTab compTab${compendiumTab==='bosses'?' active':''}" data-tab="bosses">🐋 World Bosses (${bc}/${bossCountMax})</button>
      <button class="catTab compTab${compendiumTab==='pen'?' active':''}" data-tab="pen">🌟 ${LANG==='fr'?'Maîtrise PEN':'PEN Mastery'} (${penDone}/${penItems.length})</button>
      <button class="catTab compTab${compendiumTab==='bag'?' active':''}" data-tab="bag">🎒 ${LANG==='fr'?'Sac protégé':'Protected bag'} (${COMPENDIUM_BAG.filter(Boolean).length}/${INV_SIZE})</button>
    </div>`;
  let bodyHtml;
  if (compendiumTab === 'bag') {
    const used = COMPENDIUM_BAG.filter(Boolean).length;
    const cellsHtml = COMPENDIUM_BAG.map((s,i) => {
      if (!s) return `<div class="cell compBagCell"></div>`;
      return `<div class="cell compBagCell has" data-i="${i}" title="${escapeHtml(tr(s.name))}">` +
        `<span style="color:${s.color}">${s.icon || (s.slot && SLOT_ICON[s.slot]) || '❔'}</span>` +
        cellEnhBadgeHtml(s) +
        `<button class="compBagReturnBtn" data-i="${i}" title="${LANG==='fr'?'Renvoyer au sac principal':'Send back to main bag'}">↩️</button></div>`;
    }).join('');
    // historique d'optimisation (2026-07-15, demande explicite : "affiche l'opti dans le compendium
    // si on a vendu un objet optimisé") -- S.enhPeakByName retient le meilleur niveau JAMAIS atteint
    // par nom, même après avoir vendu le dernier exemplaire physique (contrairement à la grille
    // ci-dessus, purement live sur COMPENDIUM_BAG). N'affiche que les noms qui ne sont PLUS dans le
    // sac protégé actuellement (sinon doublon avec la grille, déjà visible avec son enh en direct).
    const soldHistoryHtml = Object.entries(S.enhPeakByName||{})
      .filter(([name, lvl]) => lvl > 0 && !compendiumBagHasName(name))
      .sort((a,b) => b[1]-a[1])
      .map(([name, lvl]) => `<div class="compSoldRow"><span class="compSoldName">${escapeHtml(tr(name))}</span>${cellEnhBadgeHtml({optimizable:true, enhLv:lvl})}</div>`)
      .join('');
    bodyHtml = `<div class="admHint">${LANG==='fr'
        ? '"Vendre 1" garde toujours ici le PLUS ENCHANTÉ des exemplaires possédés de chaque type d\'équipement/bijou jamais monté en PEN, au lieu de le perdre — un exemplaire plus enchanté trouvé dans le sac prend automatiquement sa place. Renvoie-le au sac principal pour t\'en servir.'
        : '"Sell 1" always keeps here the MOST ENHANCED copy owned of each gear/jewelry type never brought to PEN, instead of losing it — a more enhanced copy found in your bag automatically takes its place. Send it back to your main bag to use it.'}</div>` +
      `<div class="admSummary">${used} / ${INV_SIZE}</div>` +
      `<div class="admInvGrid compBagGrid">${cellsHtml}</div>` +
      (soldHistoryHtml ? `<div class="statSep">${LANG==='fr'?'Déjà optimisés (vendus depuis)':'Previously enhanced (since sold)'}</div><div class="compSoldList">${soldHistoryHtml}</div>` : '');
  } else if (compendiumTab === 'bosses') {
    bodyHtml = Object.entries(BOSS_ROSTER).map(([id,b]) => {
      const unlocked = !!S.bossesKilled[id];
      return `<div class="achRow${unlocked?' done':''}">` +
        `<div class="achIcon">${b.icon}</div>` +
        `<div class="achInfo"><div class="achName">${b.name[LANG]}</div>` +
        `<div class="achDesc">${unlocked?(LANG==='fr'?'Vaincu au moins une fois':'Defeated at least once'):(LANG==='fr'?'Pas encore vaincu':'Not defeated yet')}</div></div>` +
        `<div class="achReward">${unlocked?'+1% ✓':'🔒'}</div></div>`;
    }).join('');
  } else if (compendiumTab === 'pen') {
    bodyHtml = `<div class="admHint">${LANG==='fr'
        ? 'Suivi de complétion pur (pas de bonus de stats) : amène chaque pièce d\'équipement et chaque bijou à PEN (niveau max) au moins une fois dans ton inventaire.'
        : 'Pure completion tracker (no stat bonus): bring every gear piece and every jewel to PEN (max level) at least once in your inventory.'}</div>` +
      `<div class="compItems compPenGrid">` + penItems.map(name => {
        const done = !!S.penMastery[name];
        return `<span class="compItem compPenItem${done?' done':''}">${done?'✓':'○'} ${escapeHtml(tr(name))}</span>`;
      }).join('') + `</div>`;
  } else {
    bodyHtml = ZONES.map((z,zi) => {
      const items = zoneItemNames(zi);
      const unlocked = zoneFullyCollected(zi);
      const itemsHtml = items.map(name => `<span class="compItem${compendiumItemDone(name)?' done':''}" data-item="${escapeHtml(name)}">${compendiumItemDone(name)?'✓':'○'} ${escapeHtml(name)}</span>`).join('');
      return `<div class="achRow compZoneRow${unlocked?' done':''}" data-zi="${zi}">` +
        `<div class="achIcon">${unlocked?'📖':'🔒'}</div>` +
        `<div class="achInfo"><div class="achName">${tr(z.name)}</div>` +
        `<div class="achDesc compItems">${itemsHtml}</div></div>` +
        `<div class="achReward">${unlocked?'+1% ✓':(LANG==='fr'?'Objet manquant':'Missing item')}</div></div>`;
    }).join('');
  }
  return summaryCard + bodyHtml;
}
// tutoriel auto-lancé à la toute première ouverture du Compendium (2026-07-08, demande explicite) —
// persisté en localStorage pour ne se déclencher qu'une seule fois, jamais aux ouvertures suivantes
let compTutoSeen = false;
try { compTutoSeen = localStorage.getItem('velia-idle-comp-tuto-seen') === '1'; } catch(e) {}
// tutoriel auto-lancé au tout premier ramassage d'une Pierre de Cron (2026-07-09, demande explicite)
// — même principe que compTutoSeen : persisté en localStorage, ne se déclenche qu'une seule fois.
// Voir CRON_TUTORIAL_STEPS/startCronTutorial (game-supabase.js) et son déclenchement dans dropsTick.
let cronTutoSeen = false;
try { cronTutoSeen = localStorage.getItem('velia-idle-cron-tuto-seen') === '1'; } catch(e) {}
function openCompendium() {
  const callout = contentChangeCalloutHtml('compendium');
  openInfo(LANG==='fr'?'📖 Compendium':'📖 Compendium', callout + renderCompendiumHtml());
  markContentSeen('compendium');
  const tutoBtn = $a('compTutoBtn');
  if (tutoBtn) tutoBtn.onclick = () => startCompendiumTutorial();
  if (!compTutoSeen) {
    compTutoSeen = true;
    try { localStorage.setItem('velia-idle-comp-tuto-seen', '1'); } catch(e) {}
    setTimeout(startCompendiumTutorial, 400);
  }
  $a('infoBody').querySelectorAll('.compTab').forEach(btn => {
    btn.onclick = () => { compendiumTab = btn.dataset.tab; openCompendium(); };
  });
  $a('infoBody').querySelectorAll('.compItem[data-item]').forEach(el => {
    el.onclick = () => compendiumHighlightItem(el.dataset.item);
  });
  $a('infoBody').querySelectorAll('.compBagReturnBtn').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      const i = parseInt(btn.dataset.i,10);
      const it = COMPENDIUM_BAG[i]; if (!it) return;
      if (invAdd({ ...it })) { COMPENDIUM_BAG[i] = null; openCompendium(); }
      else floatTxt(P.x,P.y,90,LANG==='fr'?'Sac principal plein':'Main bag full',{hurt:true});
    };
  });
  // "afficher l'optimisation des item protégé dans le sac protégé" (2026-07-12) : le petit badge
  // +X (cellEnhBadgeHtml) était déjà là, mais contrairement au sac principal, aucun survol ne
  // montrait le tooltip détaillé (PA/PD/PV/Esquive/enchantement complet, voir itemTooltipHtml) --
  // même wiring que renderInventory(), juste sans invIndex (ces objets ne vivent pas dans INV[]).
  COMPENDIUM_BAG.forEach((s, i) => {
    if (!s) return;
    const cell = $a('infoBody').querySelector(`.compBagCell[data-i="${i}"]`);
    if (!cell) return;
    cell.onmouseenter = ev => showItemTooltip(ev.clientX, ev.clientY, s);
    cell.onmousemove = ev => moveItemTooltip(ev.clientX, ev.clientY);
    cell.onmouseleave = () => hideItemTooltip();
  });
}

// pool de quêtes journalières : 3 tirées au hasard chaque jour parmi ces familles, avec une
// difficulté (variante) elle aussi randomisée — le compteur de progression réutilise les stats
// globales déjà suivies (kills/lootCount/silverEarned/enhAttempts/playtimeSec/travelCount) via
// une simple soustraction par rapport à leur valeur au début de la période (voir base ci-dessous)
const QUEST_KINDS_DAILY = {
  kills:    { icon:'⚔️', name:{fr:'Terrasser des monstres',    en:'Defeat monsters'},  unit:{fr:'monstres',en:'monsters'}, variants:[{target:100,reward:2000},{target:250,reward:5000},{target:500,reward:9000}] },
  loot:     { icon:'🎒', name:{fr:'Ramasser du butin',         en:'Loot items'},       unit:{fr:'objets',en:'items'},       variants:[{target:80,reward:1800},{target:200,reward:4500},{target:400,reward:8000}] },
  silver:   { icon:'🪙', name:{fr:'Gagner du silver',          en:'Earn silver'},      unit:{fr:'silver',en:'silver'},      variants:[{target:5000,reward:1500},{target:15000,reward:4000},{target:40000,reward:9000}] },
  enh:      { icon:'✦',  name:{fr:'Tenter des optimisations',  en:'Attempt enhancements'}, unit:{fr:'tentatives',en:'attempts'}, variants:[{target:5,reward:1500},{target:15,reward:4000},{target:30,reward:8000}] },
  playtime: { icon:'⏱️', name:{fr:'Jouer',                     en:'Play time'},        unit:{fr:'min',en:'min'},            variants:[{target:600,reward:1500},{target:1800,reward:4000},{target:3600,reward:8000}], displayDiv:60 },
  travel:   { icon:'🗺️', name:{fr:'Changer de zone',           en:'Change zone'},      unit:{fr:'fois',en:'times'},         variants:[{target:1,reward:1000}] },
};
// pool distinct pour les quêtes hebdomadaires : familles différentes (butin rare, réussites
// d'enchantement, plus grosses cibles) pour que ça ne ressemble pas juste à une version "plus
// longue" des quotidiennes — l'état (S.wq) et le tirage sont totalement indépendants de S.dq
const QUEST_KINDS_WEEKLY = {
  killsBig:    { icon:'💀', name:{fr:'Grand massacre',           en:'Great slaughter'},   unit:{fr:'monstres',en:'monsters'}, variants:[{target:1500,reward:15000},{target:3000,reward:30000},{target:6000,reward:55000}] },
  silverBig:   { icon:'💰', name:{fr:'Grosse récolte de silver', en:'Big silver haul'},   unit:{fr:'silver',en:'silver'},      variants:[{target:50000,reward:10000},{target:150000,reward:25000},{target:400000,reward:60000}] },
  jackpot:     { icon:'💎', name:{fr:'Bijoux rares',             en:'Rare jewelry'},      unit:{fr:'bijoux',en:'jewels'},      variants:[{target:1,reward:8000},{target:3,reward:20000},{target:6,reward:45000}] },
  gear:        { icon:'⚙️', name:{fr:'Équipement trouvé',        en:'Gear found'},        unit:{fr:'pièces',en:'pieces'},      variants:[{target:2,reward:6000},{target:5,reward:15000},{target:10,reward:35000}] },
  enhSuccess:  { icon:'🌟', name:{fr:'Optimisations réussies',   en:'Successful enhancements'}, unit:{fr:'réussites',en:'successes'}, variants:[{target:10,reward:8000},{target:25,reward:20000},{target:50,reward:45000}] },
  playtimeBig: { icon:'⏱️', name:{fr:'Assiduité',               en:'Dedication'},        unit:{fr:'h',en:'h'},                variants:[{target:7200,reward:8000},{target:18000,reward:20000},{target:36000,reward:45000}], displayDiv:3600 },
};
const QUEST_SCOPES = {
  daily:  { stateKey:'dq', kinds:QUEST_KINDS_DAILY,  count:3, keyFn:d => d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate() },
  weekly: { stateKey:'wq', kinds:QUEST_KINDS_WEEKLY, count:3, keyFn:d => { const m = mondayOf(d); return m.getFullYear()+'-'+(m.getMonth()+1)+'-'+m.getDate(); } },
};
function mondayOf(d) { const day = (d.getDay()+6)%7; return new Date(d.getFullYear(), d.getMonth(), d.getDate()-day); }
function questStatValue(kind) {
  switch (kind) {
    case 'kills': case 'killsBig': return S.kills;
    case 'loot': return S.lootCount;
    case 'silver': case 'silverBig': return S.silverEarned;
    case 'enh': return S.enhAttempts;
    case 'enhSuccess': return S.enhSuccess||0;
    case 'playtime': case 'playtimeBig': return S.playtimeSec;
    case 'travel': return S.travelCount;
    case 'jackpot': return S.jackpotCount||0;
    case 'gear': return S.gearDropCount||0;
  }
  return 0;
}
function ensureQuests(scope) {
  const cfg = QUEST_SCOPES[scope];
  const key = cfg.keyFn(new Date());
  if (S[cfg.stateKey] && S[cfg.stateKey].date === key) return;
  const kinds = Object.keys(cfg.kinds);
  for (let i = kinds.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [kinds[i],kinds[j]] = [kinds[j],kinds[i]]; }
  const quests = kinds.slice(0,cfg.count).map(k => {
    const variants = cfg.kinds[k].variants;
    const v = variants[Math.floor(Math.random()*variants.length)];
    return { kind:k, target:v.target, reward:v.reward, claimed:false };
  });
  const base = {};
  for (const k of Object.keys(cfg.kinds)) base[k] = questStatValue(k);
  S[cfg.stateKey] = { date:key, quests, base };
}
function questProgress(scope, q) {
  const st = S[QUEST_SCOPES[scope].stateKey];
  return Math.max(0, questStatValue(q.kind) - st.base[q.kind]);
}
function claimQuest(scope, i) {
  ensureQuests(scope);
  const st = S[QUEST_SCOPES[scope].stateKey];
  const q = st.quests[i];
  // triple garde : quête existante, PAS déjà réclamée, et objectif réellement atteint. Le flag
  // q.claimed rend la réclamation idempotente → impossible de toucher 2× la récompense même en
  // cliquant dans le suivi ET dans le panneau (exploit signalé).
  if (!q || q.claimed || questProgress(scope,q) < q.target) return;
  q.claimed = true; addSilver(q.reward, 'quest', q.kind);
  refreshStatsOnly(); updateQuestBadge();
  // rafraîchit IMMÉDIATEMENT les deux UI pour qu'aucun bouton "Réclamer" périmé ne subsiste
  renderQuestTrackerWidget();
  if (questsPanelOpen) openDailyQuests();
}
function updateQuestBadge() {
  ensureQuests('daily'); ensureQuests('weekly');
  let n = 0;
  for (const scope of ['daily','weekly']) {
    const st = S[QUEST_SCOPES[scope].stateKey];
    n += st.quests.filter(q => !q.claimed && questProgress(scope,q) >= q.target).length;
  }
  const badge = $('questBadge');
  if (badge) { badge.textContent = n; badge.classList.toggle('show', n > 0); }
}
// affiche TOUS les types de quêtes du pool (pas seulement les 3 tirées ce cycle) — celles non
// tirées ce cycle-ci restent visibles en grisé avec leur objectif possible, pour que le joueur
// voie l'étendue complète du pool plutôt que seulement le tirage du jour/de la semaine
function renderQuestSectionHtml(scope) {
  ensureQuests(scope);
  const cfg = QUEST_SCOPES[scope], st = S[cfg.stateKey];
  return Object.keys(cfg.kinds).map(kind => {
    const def = cfg.kinds[kind];
    const dv = def.displayDiv||1;
    const i = st.quests.findIndex(q => q.kind === kind);
    if (i === -1) {
      const minV = def.variants[0], maxV = def.variants[def.variants.length-1];
      const rangeTxt = def.variants.length > 1
        ? `${fmt(Math.floor(minV.target/dv))}–${fmt(Math.floor(maxV.target/dv))} ${def.unit[LANG]}`
        : `${fmt(Math.floor(minV.target/dv))} ${def.unit[LANG]}`;
      return `<div class="achRow inactive">` +
        `<div class="achIcon">${def.icon}</div>` +
        `<div class="achInfo"><div class="achName">${def.name[LANG]}</div><div class="achDesc">${rangeTxt}</div></div>` +
        `<div class="achReward">${LANG==='fr'?'Pas tirée ce cycle':'Not active this cycle'}</div>` +
      `</div>`;
    }
    const q = st.quests[i];
    const val = Math.min(questProgress(scope,q), q.target);
    const pct = Math.round(val/q.target*100);
    const doneNotClaimed = val >= q.target && !q.claimed;
    return `<div class="achRow${q.claimed?' done':''}">` +
      `<div class="achIcon">${def.icon}</div>` +
      `<div class="achInfo"><div class="achName">${def.name[LANG]}</div>` +
      `<div class="achDesc">${fmt(Math.floor(val/dv))} / ${fmt(Math.floor(q.target/dv))} ${def.unit[LANG]}</div>` +
      `<div class="achBarWrap"><div class="achBar" style="width:${pct}%"></div></div></div>` +
      (q.claimed ? `<div class="achReward">${LANG==='fr'?'Réclamé ✓':'Claimed ✓'}</div>`
        : doneNotClaimed ? `<button class="questClaimBtn" data-scope="${scope}" data-i="${i}">${LANG==='fr'?'Réclamer':'Claim'} +${fmt(q.reward)}🪙</button>`
        : `<div class="achReward">+${fmt(q.reward)} 🪙</div>`) +
      `</div>`;
  }).join('');
}
// compte, pour un scope, combien de quêtes sont prêtes à réclamer et combien restent en cours
function questScopeCounts(scope) {
  ensureQuests(scope);
  const st = S[QUEST_SCOPES[scope].stateKey];
  let claimable = 0, remaining = 0;
  st.quests.forEach(q => {
    if (q.claimed) return;
    if (questProgress(scope,q) >= q.target) claimable++; else remaining++;
  });
  return { claimable, remaining };
}
let questPanelScope = 'daily'; // scope actuellement affiché dans le panneau Quêtes
function renderDailyQuestsHtml() {
  const dailyNote = LANG==='fr' ? 'Se réinitialise chaque jour à minuit (heure locale)' : 'Resets every day at midnight (local time)';
  const weeklyNote = LANG==='fr' ? 'Se réinitialise chaque lundi à minuit (heure locale)' : 'Resets every Monday at midnight (local time)';
  const trackLabel = S.questTrackerOn
    ? (LANG==='fr'?'🔖 Ne plus suivre':'🔖 Stop tracking')
    : (LANG==='fr'?'🔖 Suivre les quêtes restantes':'🔖 Track remaining quests');
  // un badge par onglet : ✅ = prêtes à réclamer (pastille dorée), sinon le nombre restant en gris —
  // permet de voir d'un coup d'œil, sans ouvrir l'onglet, s'il reste quelque chose à faire/réclamer
  const tabBtn = (scope, icon, label) => {
    const c = questScopeCounts(scope);
    const badge = c.claimable > 0
      ? `<span class="qCountBadge ready">${c.claimable} ✅</span>`
      : (c.remaining > 0 ? `<span class="qCountBadge">${c.remaining}</span>` : `<span class="qCountBadge done">✓</span>`);
    return `<button class="catTab qScopeTab${scope===questPanelScope?' active':''}" data-scope="${scope}">${icon} ${label} ${badge}</button>`;
  };
  const note = questPanelScope==='daily' ? dailyNote : weeklyNote;
  return `<button id="btnToggleTracker" onclick="toggleQuestTracker()">${trackLabel}</button>` +
    `<div class="catTabs">` +
      tabBtn('daily', '📅', LANG==='fr'?'Journalières':'Daily') +
      tabBtn('weekly', '🗓️', LANG==='fr'?'Hebdomadaires':'Weekly') +
    `</div>` +
    `<div id="questScopeBody">${renderQuestSectionHtml(questPanelScope)}<div class="admSummary">${note}</div></div>`;
}
let questsPanelOpen = false; // le panneau Quêtes est-il ouvert ? (pour re-rendre après une réclamation)
function openDailyQuests() {
  openInfo(LANG==='fr'?'🗒️ Quêtes':'🗒️ Quests', renderDailyQuestsHtml());
  questsPanelOpen = true; // openInfo l'a remis à false ; on le repasse à true APRÈS
  $a('infoBody').querySelectorAll('.qScopeTab').forEach(btn => {
    btn.onclick = () => { questPanelScope = btn.dataset.scope; openDailyQuests(); };
  });
  $a('infoBody').querySelectorAll('.questClaimBtn').forEach(btn => {
    // claimQuest se charge lui-même de rafraîchir le panneau ET l'encart de suivi (voir claimQuest)
    btn.onclick = () => claimQuest(btn.dataset.scope, parseInt(btn.dataset.i,10));
  });
}
// active/désactive la liste de suivi des quêtes restantes (encart en haut à droite) — le bouton
// "Suivre" vit dans le panneau Quêtes, mais l'affichage lui-même est un encart permanent séparé
function toggleQuestTracker() {
  S.questTrackerOn = !S.questTrackerOn;
  renderQuestTrackerWidget();
  if ($a('infoOverlay').classList.contains('open')) openDailyQuests();
}
// prochain succès le plus proche d'être débloqué (plus haut % de progression parmi les non-débloqués)
function nextAchievement() {
  let best = null, bestPct = -1;
  for (const a of ACHIEVEMENTS) {
    if (S.achUnlocked[a.id]) continue;
    const pct = Math.max(0, Math.min(99, (a.statFn(S)/a.target)*100));
    if (pct > bestPct) { bestPct = pct; best = { a, pct }; }
  }
  return best;
}
function fmtDuration(ms) {
  let s = Math.max(0, Math.floor(ms/1000));
  const days = Math.floor(s/86400); s -= days*86400;
  const h = Math.floor(s/3600); s -= h*3600;
  const m = Math.floor(s/60); s -= m*60;
  const pad = n => String(n).padStart(2,'0');
  return (days>0 ? days+(LANG==='fr'?'j ':'d ') : '') + pad(h)+':'+pad(m)+':'+pad(s);
}
function msToNextDailyReset() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()+1, 0,0,0,0) - now;
}
function msToNextWeeklyReset() {
  const now = new Date();
  const day = (now.getDay()+6)%7; // 0=lundi..6=dimanche
  const daysUntil = 7 - day;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()+daysUntil, 0,0,0,0) - now;
}
function fmtHours(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60);
  return h > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${m}min`;
}
// les deux encarts en haut à droite (suivi temps de jeu/reset hebdo, quêtes suivies) se replient
// indépendamment ; état persisté en localStorage (2026-07-08, demande explicite) pour survivre à
// un rechargement de page, comme le menu de gauche (voir sideMenuCollapsed)
// repliés par défaut sur mobile (voir isMobileViewport, adaptation mobile du 2026-07-05) — sinon
// remplacé par la préférence explicite du joueur si elle existe déjà en localStorage
let resetWidgetFolded = isMobileViewport(), trackerWidgetFolded = isMobileViewport();
try { const v = localStorage.getItem('velia-idle-resetwidget-folded'); if (v !== null) resetWidgetFolded = v === '1'; } catch(e) {}
try { const v = localStorage.getItem('velia-idle-trackerwidget-folded'); if (v !== null) trackerWidgetFolded = v === '1'; } catch(e) {}
function toggleResetFold() { resetWidgetFolded = !resetWidgetFolded; try { localStorage.setItem('velia-idle-resetwidget-folded', resetWidgetFolded ? '1' : '0'); } catch(e) {} renderQuestWidget(); }
function toggleTrackerFold() { trackerWidgetFolded = !trackerWidgetFolded; try { localStorage.setItem('velia-idle-trackerwidget-folded', trackerWidgetFolded ? '1' : '0'); } catch(e) {} renderQuestTrackerWidget(); }
// encart permanent en haut à droite : timers de reset, prochain succès à débloquer, temps de jeu
function renderQuestWidget() {
  const el = $('questWidget'); if (!el) return;
  ensureQuests('daily'); ensureQuests('weekly');
  const header = `<div class="qwHeaderRow"><span class="qwTitle">${LANG==='fr'?'🗒️ Suivi':'🗒️ Tracker'}</span>` +
    `<button class="qwFoldBtn" onclick="toggleResetFold()">${resetWidgetFolded?'▸':'▾'}</button></div>`;
  if (resetWidgetFolded) { el.innerHTML = header; return; }
  const next = nextAchievement();
  const todayPlaytime = S.playtimeSec - (S.dq && S.dq.base ? S.dq.base.playtime : 0);
  const dailyTip = LANG==='fr' ? 'Temps restant avant la remise à zéro des quêtes journalières' : 'Time left before daily quests reset';
  const weeklyTip = LANG==='fr' ? 'Temps restant avant la remise à zéro des quêtes hebdomadaires' : 'Time left before weekly quests reset';
  el.innerHTML = header + `<div class="qwBody">` +
    `<div class="qwRow" title="${dailyTip}"><span class="qwLbl">${LANG==='fr'?'🗒️ Journ.':'🗒️ Daily'}</span><span class="qwTimer">${fmtDuration(msToNextDailyReset())}</span></div>` +
    `<div class="qwRow" title="${weeklyTip}"><span class="qwLbl">${LANG==='fr'?'🗓️ Hebdo':'🗓️ Weekly'}</span><span class="qwTimer">${fmtDuration(msToNextWeeklyReset())}</span></div>` +
    `<div class="qwSep">${LANG==='fr'?'⏱️ Temps de jeu':'⏱️ Playtime'}</div>` +
    `<div class="qwRow"><span class="qwLbl">${LANG==='fr'?'Total':'Total'}</span><span class="qwTimer">${fmtHours(S.playtimeSec)}</span></div>` +
    `<div class="qwRow"><span class="qwLbl">${LANG==='fr'?'Aujourd\'hui':'Today'}</span><span class="qwTimer">${fmtHours(todayPlaytime)}</span></div>` +
    (next
      ? `<div class="qwNext"><div class="qwNextIcon">${next.a.icon}</div><div class="qwNextInfo">` +
        `<div class="qwNextName">${next.a.name[LANG]}</div>` +
        `<div class="achBarWrap"><div class="achBar" style="width:${Math.round(next.pct)}%"></div></div></div></div>`
      : `<div class="qwNext qwAllDone">${LANG==='fr'?'🏅 Vous avez fini les succès !':'🏅 You\'ve finished all achievements!'}</div>`) +
    `</div>`;
}
// encart de suivi des quêtes restantes (activé via le bouton "Suivre" du panneau Quêtes) —
// liste toutes les quêtes actives ce cycle (journalières + hebdo) pas encore réclamées
function renderQuestTrackerWidget() {
  const el = $('questTrackerWidget'); if (!el) return;
  if (!S.questTrackerOn) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = '';
  const header = `<div class="qwHeaderRow"><span class="qwTitle">${LANG==='fr'?'🔖 Quêtes suivies':'🔖 Tracked quests'}</span>` +
    `<button class="qwFoldBtn" onclick="toggleTrackerFold()">${trackerWidgetFolded?'▸':'▾'}</button></div>`;
  if (trackerWidgetFolded) { el.innerHTML = header; return; }
  ensureQuests('daily'); ensureQuests('weekly');
  let body = '';
  for (const scope of ['daily','weekly']) {
    const cfg = QUEST_SCOPES[scope], st = S[cfg.stateKey];
    const rows = [];
    st.quests.forEach((q,i) => {
      if (q.claimed) return;
      const def = cfg.kinds[q.kind];
      const val = Math.min(questProgress(scope,q), q.target);
      const pct = Math.round(val/q.target*100);
      const dv = def.displayDiv||1;
      const done = val >= q.target;
      // bouton "Réclamer" directement dans l'encart de suivi quand la quête est terminée
      const right = done
        ? `<button class="qwClaimBtn" data-scope="${scope}" data-i="${i}">+${fmt(q.reward)}🪙</button>`
        : '';
      rows.push(`<div class="qwTrackRow"><span class="qwTrackIcon">${def.icon}</span>` +
        `<div class="qwTrackInfo"><div class="qwTrackName">${def.name[LANG]}</div>` +
        `<div class="qwTrackNum">${fmt(Math.floor(val/dv))} / ${fmt(Math.floor(q.target/dv))} ${def.unit[LANG]}</div>` +
        `<div class="achBarWrap"><div class="achBar" style="width:${pct}%"></div></div></div>${right}</div>`);
    });
    if (rows.length) {
      body += `<div class="qwScopeLbl">${scope==='daily'?(LANG==='fr'?'📅 Journalières':'📅 Daily'):(LANG==='fr'?'🗓️ Hebdo':'🗓️ Weekly')}</div>` + rows.join('');
    }
  }
  el.innerHTML = header + `<div class="qwBody">` +
    (body || `<div class="qwEmpty">${LANG==='fr'?'Tout est réclamé !':'Everything is claimed!'}</div>`) +
    `</div>`;
  el.querySelectorAll('.qwClaimBtn').forEach(btn => {
    // claimQuest rafraîchit lui-même le suivi ET le panneau — pas de double appel
    btn.onclick = () => claimQuest(btn.dataset.scope, parseInt(btn.dataset.i,10));
  });
}

// dégâts infligés : dépend UNIQUEMENT de la PA face à la PA requise de la zone
function dmgMult(apR) {
  if (apR >= 1) return Math.min(1 + (apR - 1) * 0.5, 1.6);
  return Math.max(0.25, apR * apR);
}
// dégâts reçus : dépend UNIQUEMENT de la PD face à la PD requise de la zone
// pas assez de PD → tu encaisses beaucoup plus (jusqu'à 4,5×, courbe plus raide qu'avant) ; overgear en PD → tu encaisses moins
function dmgTakenMult(dpR) {
  if (dpR < 1) return Math.min(4.5, 1 + (1 - dpR) * 3.2);
  return Math.max(0.4, 1 - (dpR - 1) * 0.35);
}
// le loot suit le "goulot d'étranglement" : être sous-PA OU sous-PD pénalise pareil (comme en vrai jeu)
// pas assez de stuff -> loot pénalisé (comme dans le vrai jeu) ; stuff adapté OU overstuff -> loot
// normal, plus jamais de bonus ni de malus au-delà de 1.0 (demande explicite du 2026-07-06 :
// "il faut looter moins bien si tu as pas le stuff nécessaire c'est tout mais si tu es overstuff
// tu auras un loot normal") -- supprime l'ancien bonus +10% (1.0-1.3x) et l'ancien malus
// anti-overfarm qui redescendait jusqu'à 0.25x au-delà de 1.8x
function lootMult(r) {
  if (r < 0.9) return Math.max(0.3, r * 0.85);
  return 1.0;
}
// ---------- recommandations "meilleur endroit pour farmer" (2026-07-09, demande explicite : carte
// Statistiques refondue en onglets Perso/Recommandations) ----------
// valeurs THÉORIQUES, indépendantes du stuff actuel du joueur (demande explicite : "silver/h, xp/h,
// kills/min théoriques par zone") -- comparent les zones entre elles à armes égales, sans se
// soucier de si le joueur peut y survivre aujourd'hui.
const REF_KPM_FOR_STATS = 15; // kills/min de référence (voir roadmap.md, même valeur que le calibrage économique des zones)
const REF_DPS_FOR_STATS = 900; // dégâts/min de référence PUREMENT relatif : seul hpPer varie d'une zone à l'autre, donc le classement (et le ratio entre zones) ne dépend pas de la valeur choisie ici
// UNIQUEMENT le trash (2026-07-09, demande explicite : "le calcul de silver/h se fait uniquement
// sur les silver looté au sol grâce au token qui doivent être la principale source de revenu") --
// matériaux et bijoux ne sont plus comptés : ce sont des objets de PROGRESSION (optimisation/gear),
// pas une source de revenu régulière, et les looter au lieu de les vendre ne doit rien retirer au
// classement "meilleur silver/h" d'une zone.
function zoneSilverPerHour(z) {
  const l = z.loot;
  return l.trash.val*l.trash.ch * REF_KPM_FOR_STATS * 60;
}
function zoneXpPerHour(z) { return z.xp * REF_KPM_FOR_STATS * 60; }
function zoneKillsPerMin(z) { return REF_DPS_FOR_STATS / z.hpPer; }
// meilleure zone selon une métrique donnée (silver/xp/kills), toutes zones confondues (demande
// explicite : classement théorique, PAS limité aux zones survivables aujourd'hui)
function bestZoneForMetric(metricFn) {
  let bestI = 0, bestV = -Infinity;
  for (let i = 0; i < ZONES.length; i++) {
    const v = metricFn(ZONES[i]);
    if (v > bestV) { bestV = v; bestI = i; }
  }
  return { i: bestI, v: bestV };
}
function badgeOf(r) {
  if (r < 0.6)  return { cls:'b-red',    txt:'ZONE DANGEREUSE' };
  if (r < 0.9)  return { cls:'b-orange', txt:'ZONE DIFFICILE' };
  if (r <= 1.3) return { cls:'b-green',  txt:'ZONE ADAPTÉE' };
  if (r <= 1.8) return { cls:'b-blue',   txt:'ZONE FACILE' };
  return { cls:'b-grey', txt:'ZONE DÉPASSÉE' };
}
// zone trop dure pour le stuff actuel ("ZONE DANGEREUSE", r<0.6) : rend le danger tangible plutôt
// qu'une pénalité invisible de dégâts/loot -- le joueur devient plus lent, et les monstres qui
// t'ont aggro deviennent plus rapides (demande explicite du 2026-07-05 : "tu es plus lent, les
// monstres sont plus rapides")
function isZoneDangerous() { return bottleneck() < 0.6; }
// valeurs durcies le 2026-07-05 (demande explicite : "un plus gros ralenti du joueur et une
// vitesse plus élevée des monstres") -- étaient 0.7/1.35 à l'introduction de cette mécanique
const DANGER_PLAYER_SPEED_MULT = 0.5;
const DANGER_MOB_SPEED_MULT = 1.7;
// mode de combat IA -- ÉTAIT auto-calculé depuis le ratio de gear (bottleneck()), REMPLACÉ le
// 2026-07-14 (demande explicite, décision confirmée malgré la conception précédente) par un choix
// manuel du joueur, voir S.aiCombatMode et AI_COMBAT_MODES/setAiCombatMode ci-dessous.
function aiMode() {
  return AI_COMBAT_MODES[S.aiCombatMode] ? S.aiCombatMode : 'équilibré';
}
const AI_COMBAT_MODES = {
  'défensif':  { icon:'🛡️', name:{fr:'Défensif',  en:'Defensive'} },
  'équilibré': { icon:'⚖️', name:{fr:'Équilibré', en:'Balanced'} },
  'overgeared':{ icon:'⚔️', name:{fr:'Offensif',  en:'Overgeared'} },
};
const AI_COMBAT_MODE_ORDER = ['défensif','équilibré','overgeared'];
function renderAiModeBtn() {
  const el = $('aiModeSlider'); if (!el) return;
  if (!AI_COMBAT_MODES[S.aiCombatMode]) S.aiCombatMode = 'équilibré';
  const titles = {
    'défensif':  LANG==='fr' ? 'IA défensive : esquive et soigne en priorité, quitte à moins attaquer' : 'Defensive AI: prioritizes dodging/healing over attacking',
    'équilibré': LANG==='fr' ? 'IA équilibrée : alterne attaque et prudence selon la situation' : 'Balanced AI: alternates attack and caution based on the fight',
    'overgeared':LANG==='fr' ? 'IA offensive : attaque sans relâche, ignore la plupart des esquives' : 'Overgeared AI: attacks relentlessly, skips most dodges',
  };
  el.querySelectorAll('.aiModeSeg').forEach(seg => {
    const key = seg.dataset.mode, m = AI_COMBAT_MODES[key];
    const active = S.aiCombatMode === key;
    seg.classList.toggle('active', active);
    seg.title = titles[key] || '';
    seg.innerHTML = active ? `<span class="farmModeSegIcon">${m.icon}</span><span class="farmModeSegLabel">${m.name[LANG]}</span>` : `<span class="farmModeSegIcon">${m.icon}</span>`;
  });
}
function setAiCombatMode(key) {
  if (!AI_COMBAT_MODES[key]) return;
  S.aiCombatMode = key;
  renderAiModeBtn();
}
// bascule Équipement/Cristal de la carte Équipement (2026-07-15, demande explicite : "un nouveau
// slider a bulle... pour changer d'equipement a cristal") -- même pilule que le mode IA/farm, mais
// dans le panneau latéral (pas sur le canvas). "Cristal" n'a qu'1 seul emplacement pour l'instant,
// verrouillé (voir #equipCrystalPane dans index.html) -- pas encore de système de cristaux en jeu.
let equipMode = 'gear';
const EQUIP_MODES = {
  gear:    { icon:'⚔️', name:{fr:'Équipement', en:'Gear'} },
  crystal: { icon:'💎', name:{fr:'Cristal',    en:'Crystal'} },
};
function renderEquipModeBtn() {
  const el = $('equipModeSlider'); if (!el) return;
  el.querySelectorAll('.equipModeSeg').forEach(seg => {
    const key = seg.dataset.mode, m = EQUIP_MODES[key];
    const active = equipMode === key;
    seg.classList.toggle('active', active);
    seg.title = m.name[LANG];
    seg.innerHTML = active ? `<span class="farmModeSegIcon">${m.icon}</span><span class="farmModeSegLabel">${m.name[LANG]}</span>` : `<span class="farmModeSegIcon">${m.icon}</span>`;
  });
  const gearPane = $('equipGearPane'), crystalPane = $('equipCrystalPane');
  if (gearPane) gearPane.style.display = equipMode === 'gear' ? '' : 'none';
  if (crystalPane) crystalPane.style.display = equipMode === 'crystal' ? '' : 'none';
  const crystalSlot = $('crystalSlotCenter');
  if (crystalSlot) crystalSlot.title = LANG==='fr' ? 'Bientôt disponible' : 'Coming soon';
}
function setEquipMode(key) {
  if (!EQUIP_MODES[key]) return;
  equipMode = key;
  renderEquipModeBtn();
}
// mode de farm choisi par le joueur : "Loot" ramasse tout avant de passer au pack suivant (voir
// killPack + case 'loot' du fsm), "XP" ignore le loot au sol et enchaîne les packs pour maximiser
// les kills/xp par minute (demande : 2 IA différentes, une full-loot, une full-XP)
// mode "Opti" (pack to pack rapide) retiré le 2026-07-14 (demande explicite) : un 3e emplacement
// reste affiché dans le sélecteur, verrouillé (cadenas grisé), en attente d'un futur 3e mode.
const FARM_MODES = {
  loot: { icon:'🎒', name:{fr:'Loot', en:'Loot'} },
  xp:   { icon:'⚡', name:{fr:'XP',   en:'XP'} },
};
const FARM_MODE_ORDER = ['loot','xp'];
// sélecteur à bulles (2026-07-14, demande explicite : "petit selecteur a bulle") -- remplace le
// slider <input type="range"> par une pilule segmentée : le mode actif s'affiche en capsule dorée
// pleine (icône + texte), les autres modes en icône seule, et un 3e rond grisé/verrouillé (aucun
// mode derrière pour l'instant) ferme la pilule.
function renderFarmModeBtn() {
  const el = $('farmModeSlider'); if (!el) return;
  // repli (2026-07-14) : une sauvegarde existante peut encore avoir S.farmMode==='opti' (mode
  // retiré) -- sans ce filet, aucune bulle ne s'affiche active tant que le joueur n'en reclique pas une
  if (!FARM_MODES[S.farmMode]) S.farmMode = 'loot';
  const titles = {
    loot: LANG==='fr' ? 'IA "Loot" : ramasse tout le butin avant de passer au pack suivant' : 'Loot AI: picks up all drops before moving to the next pack',
    xp:   LANG==='fr' ? 'IA "XP" : enchaîne les packs sans ramasser le butin au sol' : 'XP AI: chains packs without picking up ground loot',
  };
  el.querySelectorAll('.farmModeSeg').forEach(seg => {
    const key = seg.dataset.mode, m = FARM_MODES[key];
    const active = S.farmMode === key;
    seg.classList.toggle('active', active);
    seg.title = titles[key] || '';
    seg.innerHTML = active ? `<span class="farmModeSegIcon">${m.icon}</span><span class="farmModeSegLabel">${m.name[LANG]}</span>` : `<span class="farmModeSegIcon">${m.icon}</span>`;
  });
}
function setFarmMode(key) {
  if (!FARM_MODES[key]) return;
  S.farmMode = key;
  renderFarmModeBtn();
}

// ==================== COMPÉTENCES ====================
// mp (2026-07-05, demande explicite : "ajoute de la mana au sort") : coût en mana par lancer,
// grossièrement proportionnel à la puissance/au cooldown du sort -- avec mpMax:100 et une régén
// passive (voir MANA_REGEN_PER_SEC), gate occasionnellement les gros sorts sans jamais bloquer
// durablement le combat automatique (les petits sorts bon marché restent toujours castables)
const SKILLS = [
  { id:'speed',   name:'Speed Spell',        ic:'✦', cd:26, prio:0, type:'buff', dur:9,  castT:.35, mp:15 },
  { id:'meteor',  name:'Meteor Shower',      ic:'☄', cd:19, prio:1, dmg:8.5, castT:.85, vfx:'meteor', shake:8, mp:40 },
  { id:'blizzard',name:'Blizzard',           ic:'❄', cd:15, prio:2, dmg:6.8, castT:.7,  vfx:'ice', mp:32 },
  { id:'thunder', name:'Thunder Storm',      ic:'⚡', cd:12, prio:3, dmg:5.6, castT:.6,  vfx:'bolt', shake:4, mp:26 },
  { id:'bolide',  name:'Bolide of Destr.',   ic:'✹', cd:10, prio:4, dmg:4.8, castT:.55, vfx:'fire', shake:3, mp:22 },
  { id:'quake',   name:'Earthquake',         ic:'▲', cd:8,  prio:5, dmg:3.6, castT:.5,  vfx:'quake', shake:6, mp:18 },
  { id:'lstorm',  name:'Lightning Storm',    ic:'☇', cd:6,  prio:6, dmg:2.9, castT:.45, vfx:'bolt', mp:14 },
  { id:'equil',   name:'Equilibrium Break',  ic:'◉', cd:5,  prio:7, dmg:2.2, castT:.4,  vfx:'spark', mp:10 },
  { id:'fireball',name:'Fireball Explosion', ic:'●', cd:2.2,prio:8, dmg:1.5, castT:.38, vfx:'fire', mp:6 },
  { id:'voltaic', name:'Voltaic Pulse',      ic:'∿', cd:1.1,prio:9, dmg:1.0, castT:.32, vfx:'spark', mp:3 },
];
const MANA_REGEN_PER_SEC = 8; // régén passive, indépendante du combat
const MANA_POTION = { name:{fr:'Potion de mana',en:'Mana Potion'}, cost:110, restore:0.4, cd:4.5 };
const cds = {}; SKILLS.forEach(s => cds[s.id] = 0);
let buffTimer = 0, teleportCd = 0, evasionCd = 0;

// ==================== PROJECTION ISO ====================
function isoX(x, y) { return (x - y); }
function isoY(x, y) { return (x + y) * .5; }
const cam = { x: 0, y: 0 };
function toScreen(x, y, z = 0) {
  return {
    sx: W/2 + isoX(x,y) - isoX(cam.x,cam.y),
    sy: H/2 + 30 + isoY(x,y) - isoY(cam.x,cam.y) - z,
  };
}
// inverse de toScreen (z=0, au niveau du sol) : sert au clic sur le loot au sol
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

function dist(ax,ay,bx,by){ return Math.hypot(ax-bx,ay-by); }

function spawnPackNear() {
  packSerial++;
  const z = Z();
  // Mine de Fer Abandonnée (zone 6) : 1 pack sur 2 est mené par un boss (contremaître blindé, plus
  // gros, qui loot plus — les multiplicateurs alpha ×1.5/1.6 s'appliquent déjà) — demande explicite
  // du 2026-07-07. Les autres zones gardent le rythme habituel d'1 pack alpha sur 5.
  const alpha = zoneIdx === 6 ? packSerial % 2 === 0 : packSerial % 5 === 0;
  let x, y, tries = 0;
  do {
    const a = Math.random()*Math.PI*2, d = 320 + Math.random()*360;
    x = P.x + Math.cos(a)*d; y = P.y + Math.sin(a)*d; tries++;
  } while (tries < 12 && packs.some(p => !p.dead && dist(x,y,p.x,p.y) < 200));

  // densité progressive : packs de plus en plus grands en avançant dans les zones
  const baseSize = 2 + Math.floor(zoneIdx * 0.5); // Z1→2, Z6→4-5, Z12→7-8
  const n = alpha ? 2 : Math.min(9, baseSize + Math.floor(Math.random()*3));
  const hpPer = z.hpPer * (alpha ? 2.6 : 1);
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
    });
  }
  packs.push({
    x, y, wolves, alpha,
    aggro:false, gathered:0, dead:false,
    dmg: z.dmg * (alpha ? 1.8 : 1),
  });
}

// nombre de packs actifs simultanément dans le monde -- davantage à partir du palier BLANC
// (2026-07-11, demande explicite : "rajoute des groupe de monstre a partir de la zone blanche" /
// "+ de pack meme monstre") : le monstre et son loot restent ceux de la zone, seul le nombre de
// groupes vivants en même temps dans le monde augmente avec le palier de stuff.
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
  return 12; // blue : 9,10,11,15
}
function resetWorld() {
  packs = []; drops = []; corpses = []; particles = []; floats = [];
  target = null; P.lootTarget = null; P.manualTarget = null;
  P.x = 0; P.y = 0; cam.x = 0; cam.y = 0; P.lootClusterX = 0; P.lootClusterY = 0;
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
function hpTier() {
  const p = P.hp / effHpMax();
  if (p > .8) return 'agressif';
  if (p > .5) return 'normal';
  if (p > .25) return 'prudent';
  return 'urgence';
}
function setState(st){ P.state = st; P.stateT = 0; }

// pénalité de vitesse liée au poids retirée (2026-07-15, demande explicite : "enleve ralentit par
// le poids") -- ne reste que le bonus SPD niveau/Compendium et le malus de zone dangereuse
function speedMult() {
  const dangerMult = isZoneDangerous() ? DANGER_PLAYER_SPEED_MULT : 1;
  return (1 + totalSpdPct()/100) * dangerMult;
}
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
// zone 1 jusqu'à ~100 000 silver/h en zone 11, voir roadmap.md) : même utilisée en continu à
// son propre CD, la potion la plus chère (mega) ne dépasse jamais ~15% du revenu horaire d'une
// zone adaptée à son coût — un vrai sink sans jamais casser l'économie du joueur qui progresse.
// "Potion de vie" (infinite, cost:0) : verrouillée 🔒 en bas du sélecteur, réservée à un futur
// déblocage (récompense/boutique) — visible dès maintenant pour montrer où elle mènera.
const POTIONS = {
  small:    { name:{fr:'Petite potion de vie',  en:'Small HP Potion'},  icon:'🧪', cost:70,  heal:0.20, cd:2.4 },
  medium:   { name:{fr:'Potion de vie',         en:'HP Potion'},        icon:'🧴', cost:140, heal:0.35, cd:3.6 },
  large:    { name:{fr:'Grande potion de vie',  en:'Large HP Potion'},  icon:'⚗️', cost:240, heal:0.55, cd:5.0 },
  mega:     { name:{fr:'Potion de vie majeure', en:'Major HP Potion'},  icon:'🍾', cost:380, heal:0.80, cd:6.8 },
  infinite: { name:{fr:'Potion de vie infinie', en:'Infinite HP Potion'}, icon:'♾️', cost:0, heal:0.40, cd:4.2, locked:true },
};
const POTION_ORDER = ['small','medium','large','mega','infinite']; // "infinite" toujours en dernier, verrouillée (voir p.locked)
// prix des potions = un POURCENTAGE du revenu horaire théorique de trash (token vendu au sol,
// jamais du prix de vente du stuff) de la zone ACTUELLE (2026-07-11/12, demande explicite : "revois
// le prix des potion en fonction de l'argent qu'on se fait en vendant les token en instantané...
// uniquement par rapport à ça" puis "les potions doivent couter entre 5 et 30% de ce que tu gagne
// en silver"). Remplace l'ancien amortissement en racine carrée (potionZoneScale, 2026-07-09) : il
// dérivait fortement de son propre objectif déclaré ("mega ~15% du revenu horaire") -- vérifié en
// simulation, le ratio réel allait de 42% (Camp des Loups) à 3.6% (Forêt de Polly) au lieu de rester
// stable, un ratio sqrt(zone.trash/zone0.trash) dérivant nécessairement à mesure que l'écart entre
// zones grandit. Ici chaque taille de potion coûte un % du revenu horaire de trash de SA PROPRE
// zone (jamais relatif à une zone de référence, donc jamais de dérive) : interpolé linéairement
// entre 5% (small) et 30% (mega) selon le coût de base de la taille (70/140/240/380), ce qui reste
// vrai dans TOUTE zone.
const POTION_KPM_REF = 15; // même rythme que la courbe économique des zones (~3000/h zone1 → ~100000/h zone11)
// prix divisé par 10 une 2e fois le 2026-07-14 (demande explicite : "divise par 10 le prix des
// potion") -- small ≈ 0.05% du revenu horaire, mega ≈ 0.3% (au lieu de 0.5%/3%, déjà divisé par 10
// une 1ère fois le 2026-07-12)
const POTION_PCT_MIN = 0.0005; // small ≈ 0.05% du revenu horaire
const POTION_PCT_MAX = 0.003;  // mega ≈ 0.3% du revenu horaire
function potionHourlyIncome() {
  const z = (typeof atVelia !== 'undefined' && !atVelia && typeof Z === 'function') ? Z() : ZONES[0];
  return (z.loot.trash.val || 1) * POTION_KPM_REF * 60;
}
function potionCost(baseCost) {
  if (!baseCost) return 0;
  const lo = POTIONS.small.cost, hi = POTIONS.mega.cost;
  const t = hi > lo ? (baseCost - lo) / (hi - lo) : 0;
  const pct = POTION_PCT_MIN + t * (POTION_PCT_MAX - POTION_PCT_MIN);
  return Math.max(1, Math.round(potionHourlyIncome() * pct));
}
// icône unique vie+mana (2026-07-08, demande explicite : "la potion qui remplace les 2 potion")
// -- remplace les 2 cases séparées #potSlot/#manaPotSlot par une seule, fiole ronde rouge (vie) +
// fiole élancée bleue (mana) penchées l'une vers l'autre, volutes entrelacées animées
const ICO_POTION_DUO = `<svg class="gicon" viewBox="0 0 44 34" xmlns="http://www.w3.org/2000/svg">
  <path d="M15 15 C 10 10, 20 7, 16 2" fill="none" stroke="#e88a8a" stroke-width="1.6" stroke-linecap="round" opacity=".7">
    <animate attributeName="d" values="M15 15 C 10 10, 20 7, 16 2;M15 15 C 20 10, 12 7, 17 2;M15 15 C 10 10, 20 7, 16 2" dur="3.2s" repeatCount="indefinite"/>
  </path>
  <path d="M25 16 C 30 10, 20 8, 24 2" fill="none" stroke="#8ab0e8" stroke-width="1.6" stroke-linecap="round" opacity=".7">
    <animate attributeName="d" values="M25 16 C 30 10, 20 8, 24 2;M25 16 C 21 10, 29 8, 23 2;M25 16 C 30 10, 20 8, 24 2" dur="3.2s" begin="1.6s" repeatCount="indefinite"/>
  </path>
  <g transform="translate(14,25) rotate(-12)">
    <circle cx="0" cy="4" r="8.5" fill="#7a1f24"/>
    <circle cx="0" cy="4" r="8.5" fill="none" stroke="#3a171a" stroke-width="1"/>
    <path d="M-1.8 2.5 h3.6 M0 0.6 v3.8" stroke="#ffb0b0" stroke-width="1.5" stroke-linecap="round"/>
    <rect x="-2.2" y="-7" width="4.4" height="4.2" rx="1" fill="#5a3f22"/>
  </g>
  <g transform="translate(28,24) rotate(10)">
    <path d="M0 -4 C 4.2 1.5, 5.5 6.5, 3.8 11.5 Q 0 15.5 -3.8 11.5 C -5.5 6.5, -4.2 1.5, 0 -4 z" fill="#243a8a"/>
    <path d="M0 -4 C 4.2 1.5, 5.5 6.5, 3.8 11.5 Q 0 15.5 -3.8 11.5 C -5.5 6.5, -4.2 1.5, 0 -4 z" fill="none" stroke="#141f4a" stroke-width="1"/>
    <path d="M1.3 5 a2.4 2.4 0 1 1 -2 -3.6 a2 2 0 0 0 2 3.6 z" fill="#a8c4ff"/>
    <path d="M-1 -9 l1.2 -2.4 1.2 2.4 v3.2 h-2.4 z" fill="#5a7ac9"/>
  </g>
</svg>`;
// avertissement "pas assez de silver pour la potion" -- avant ce correctif (2026-07-06, remonté en
// jeu : "les potions ne fonctionnent pas") l'échec était TOTALEMENT silencieux (juste un retry
// rapide sans soin), ce qui passait pour un bug, surtout en zone dangereuse où les dégâts encaissés
// sont énormes ET le silver s'épuise vite. 1 toast/3s max pour ne pas spammer vu le retry à 1s.
let lastPotionSilverWarn = 0;
function warnPotionNoSilver() {
  const now = performance.now();
  if (now - lastPotionSilverWarn < 3000) return;
  lastPotionSilverWarn = now;
  floatTxt(P.x, P.y-15, 75, LANG==='fr' ? 'Pas assez de silver pour la potion !' : 'Not enough silver for a potion!', {hurt:true});
}
function usePotion() {
  const pot = POTIONS[S.potionType] || POTIONS.medium;
  const cost = potionCost(pot.cost);
  if (cost > 0) {
    if (S.silver < cost) { P.potCd = 1; warnPotionNoSilver(); return; } // pas assez de silver : réessaie vite, aucun soin
    addSilver(-cost, 'potion', pot.name.fr);
    floatTxt(P.x,P.y,80,'-'+fmt(cost)+'🪙',{hurt:true});
  }
  P.potCd = pot.cd;
  P.hp = Math.min(effHpMax(), P.hp + effHpMax()*pot.heal);
  floatTxt(P.x,P.y,90,'+PV',{green:true});
}
// potion de mana (2026-07-05, demande explicite : "ajoute ... une potion de mana") -- un seul
// palier pour l'instant (pas de choix de taille comme les potions de PV), même mécanique
function usePotionMana() {
  const cost = potionCost(MANA_POTION.cost);
  if (S.silver < cost) { P.manaPotCd = 1; warnPotionNoSilver(); return; } // pas assez de silver : réessaie vite
  addSilver(-cost, 'potion', MANA_POTION.name.fr);
  floatTxt(P.x,P.y,80,'-'+fmt(cost)+'🪙',{hurt:true});
  P.manaPotCd = MANA_POTION.cd;
  P.mp = Math.min(effManaMax(), P.mp + effManaMax()*MANA_POTION.restore);
  floatTxt(P.x,P.y,90,'+MP',{blue:true});
}
// sélecteur de potion : le joueur choisit laquelle des 4 tailles utiliser automatiquement en
// combat — le soin affiché (en PV) dépend de ses PV max actuels, mis à jour à chaque ouverture
function renderPotSelect() {
  const el = $('potSelect'); if (!el) return;
  const threshPct = Math.round((S.potionThreshold ?? 0.5) * 100);
  const threshRow = `<div id="potThreshRow"><span>${LANG==='fr'?'Boire sous':'Drink under'}</span>` +
    `<input type="range" id="potThreshSlider" min="5" max="95" step="5" value="${threshPct}">` +
    `<span id="potThreshVal">${threshPct}%</span></div>`;
  const rows = POTION_ORDER.map(key => {
    const p = POTIONS[key];
    const healHp = Math.round(effHpMax()*p.heal);
    if (p.locked) {
      return `<div class="psRow locked" title="${LANG==='fr'?'Bientôt disponible':'Coming soon'}">` +
        `<span class="psIcon">🔒</span>` +
        `<span class="psInfo"><span class="psName">${p.name[LANG]}</span><br><span class="psHeal">+${Math.round(p.heal*100)}% PV · CD ${p.cd}s</span></span>` +
        `<span class="psCost">${LANG==='fr'?'Gratuite':'Free'}</span></div>`;
    }
    return `<div class="psRow${S.potionType===key?' sel':''}" data-pot="${key}">` +
      `<span class="psIcon">${p.icon}</span>` +
      `<span class="psInfo"><span class="psName">${p.name[LANG]}</span><br><span class="psHeal">+${fmt(healHp)} PV (${Math.round(p.heal*100)}%) · CD ${p.cd}s</span></span>` +
      `<span class="psCost">${fmt(potionCost(p.cost))} 🪙</span></div>`;
  }).join('');
  // section mana (2026-07-08, demande explicite : "qui ouvre le pannel de potion vie et mana") --
  // un seul palier pour l'instant (pas de choix de taille comme les potions de vie), donc juste
  // informatif : boit automatiquement sous 30% de mana, pas de sélection à faire ici
  const manaSection = `<div class="psSectionLabel">${LANG==='fr'?'Potion de vie':'HP Potion'}</div>` +
    rows +
    `<div class="psSectionLabel">${LANG==='fr'?'Potion de mana (auto sous 30%)':'Mana Potion (auto under 30%)'}</div>` +
    `<div class="psRow psRowInfo">` +
      `<span class="psIcon">🔷</span>` +
      `<span class="psInfo"><span class="psName">${MANA_POTION.name[LANG]}</span><br><span class="psHeal">+${Math.round(MANA_POTION.restore*100)}% MP · CD ${MANA_POTION.cd}s</span></span>` +
      `<span class="psCost">${fmt(potionCost(MANA_POTION.cost))} 🪙</span></div>`;
  el.innerHTML = threshRow + manaSection;
  // .psRowInfo (ligne mana) exclue : purement informative, aucune taille à choisir (voir plus haut)
  el.querySelectorAll('.psRow:not(.locked):not(.psRowInfo)').forEach(row => {
    row.onclick = e => { e.stopPropagation(); S.potionType = row.dataset.pot; el.classList.remove('show'); };
  });
  const slider = $('potThreshSlider');
  slider.oninput = e => { e.stopPropagation(); S.potionThreshold = Number(slider.value)/100; $('potThreshVal').textContent = slider.value+'%'; };
  slider.onclick = e => e.stopPropagation();
}
function togglePotSelect(e) {
  e.stopPropagation();
  const el = $('potSelect');
  const willShow = !el.classList.contains('show');
  if (willShow) renderPotSelect();
  el.classList.toggle('show', willShow);
}

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
  } else if (tier !== 'agressif' || mode === 'défensif') setState('kite');
}

// le monstre du pack ACTUELLEMENT visé par le joueur : le premier encore vivant (2026-07-11,
// demande explicite : chaque monstre a désormais son propre PV, on les abat un par un plutôt que
// de vider une seule barre agrégée pour tout le pack d'un coup)
function currentWolf(p) { return p.wolves.find(w => !w.dead) || null; }

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
function wolfPos(p,w){
  return { x:p.x + w.ox*(1-p.gathered) + w.gx*p.gathered,
           y:p.y + w.oy*(1-p.gathered) + w.gy*p.gathered };
}
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
    for (const w of p.wolves) {
      if (w.dead) continue; // (2026-07-11) un monstre déjà tué individuellement n'attaque plus
      if (w.lunge > 0) {
        w.lunge -= dt;
        if (w.lunge <= 0) {
          const wp = wolfPos(p,w);
          if (dist(P.x,P.y,wp.x,wp.y) < 95) {
            if (Math.random() < dodgeChance) {
              floatTxt(P.x,P.y,80,LANG==='fr'?'Esquivé !':'Dodged!',{blue:true});
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
function killWolf(p, w) {
  w.dead = true;
  const z = Z(), lm = lootMult(bottleneck());
  const killsBefore = S.kills;
  S.kills++;
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

// équipement lootable : 4 paliers de stuff EARLY (demande du 2026-07-05), 3 zones chacun.
// Naru/Tuvala gardent la courbe de drop décroissante par zone ; Yuria/Grunil ont une chance de
// drop FIXE (2%) quelle que soit la zone parmi les leurs — chaque palier a son propre matériau
// d'optimisation (remplace l'ancien matériau générique par zone).
const GEAR_TIERS = [
  // zones étendues à 4 par palier le 2026-07-05 (voir commentaire sur les nouvelles zones dans
  // ZONES) -- les 4e zones (12,13,14,15) sont ajoutées à la fin du tableau, jamais insérées, donc
  // aucun index existant ne bouge
  // noms d'armes alignés sur la classe sorcier le 2026-07-08 (demande explicite : "l'arme c'est un
  // baton de sorcier... l'arme secondaire c'est une dague") — armure/bijoux inchangés
  { grade:'grey', color:'#b8b8b8', zones:[0,1,2,12], label:{fr:'Gris — Naru',en:'Grey — Naru'},
    sets:{ weapon:'Bâton Naru', awakening:'Éveil Naru', secondary:'Dague Naru',
           helmet:'Casque Naru', armor:'Armure Naru', gloves:'Gants Naru', boots:'Bottes Naru' },
    material:{ name:'Pierre de Novice', icon:ICO_MAT_NOVICE, color:'#b8b8b8' }, dropChance:null },
  { grade:'white', color:'#e8e8e8', zones:[3,4,5,13], label:{fr:'Blanc — Tuvala',en:'White — Tuvala'},
    sets:{ weapon:'Bâton Tuvala', awakening:'Éveil Tuvala', secondary:'Dague Tuvala',
           helmet:'Casque Tuvala', armor:'Armure Tuvala', gloves:'Gants Tuvala', boots:'Bottes Tuvala' },
    material:{ name:'Pierre du Temps', icon:ICO_MAT_TEMPS, color:'#cfd8dc' }, dropChance:null },
  { grade:'green', color:'#7aa35e', zones:[6,7,8,14], label:{fr:'Vert — Yuria',en:'Green — Yuria'},
    sets:{ weapon:'Bâton Yuria', awakening:'Éveil Yuria', secondary:'Dague Yuria',
           helmet:'Casque Yuria', armor:'Plastron Yuria', gloves:'Gants Yuria', boots:'Bottes Yuria' },
    material:{ name:'Pierre Noire', icon:ICO_MAT_NOIRE, color:'#7aa35e' }, dropChance:0.02 }, // même vert EXACT que le stuff Yuria (demande explicite du 2026-07-08)
  { grade:'blue', color:'#6ea3c9', zones:[9,10,11,15], label:{fr:'Bleu — Grunil',en:'Blue — Grunil'},
    sets:{ weapon:'Bâton Grunil', awakening:'Éveil Grunil', secondary:'Dague Grunil',
           helmet:'Casque Grunil', armor:'Plastron Grunil', gloves:'Gants Grunil', boots:'Bottes Grunil' },
    // Pierre concentrée dédiée à Grunil depuis le 2026-07-06 (avant : partageait la Pierre Noire
    // de Yuria, ce qui mélangeait les 2 paliers) — Yuria (vert) garde la Pierre Noire
    material:{ name:'Pierre concentrée', icon:ICO_MAT_CONCENTREE, color:'#6ea3c9' }, dropChance:0.02 },
];
function gearTierForZone(zi) { return GEAR_TIERS.find(t => t.zones.includes(zi)) || GEAR_TIERS[GEAR_TIERS.length-1]; }
// chance de drop d'une pièce d'équipement, décroissante zone par zone — utilisée par Naru/Tuvala
// (dropChance:null) ; Yuria/Grunil utilisent leur taux fixe défini ci-dessus à la place.
// indices 12/13 (4e zone grey/white, 2026-07-05) continuent la même décroissance locale ; 14/15
// ne sont jamais lus (green/blue ont un dropChance fixe), gardés pour la cohérence du tableau.
const GEAR_CHANCE = [.16,.12,.09,.065,.046,.032,.021,.014,.009,.0055,.0032,.0018,.065,.022,.0014,.0014];
// table de loot "V2" (2026-07-15, demande explicite, valeurs fournies par capture d'écran) : taux
// FIXE par palier (armure et arme partagent le même taux, bijou moitié moins) — remplace le système
// V1 ci-dessus (décroissance par zone via GEAR_CHANCE + tier.dropChance) le temps que S.lootTableVersion
// vaille 'v2'. L'ancien système V1 reste intégralement en place et réactivable à tout moment (demande
// explicite : "garde a memoire v1 le loot davant et ça c'est la v2 a tout moment je repasse en v1") --
// voir gearDropChance/jewelDropChance ci-dessous, et le sélecteur admin (renderLootVersionToggle).
const LOOT_RATES_V2 = {
  grey:  { gear:0.0576, jewel:0.0288 },
  white: { gear:0.0288, jewel:0.0144 },
  green: { gear:0.0144, jewel:0.0072 },
  blue:  { gear:0.0072, jewel:0.0036 },
};
// chance de drop d'armure/arme pour CE palier/CETTE zone, selon la version de table active
// (S.lootTableVersion) -- zi explicite (pas juste zoneIdx global) pour rester utilisable aussi
// bien lors d'un vrai tirage (zone actuellement farmée) que pour l'AFFICHAGE de la table de loot
// d'une zone PRÉVISUALISÉE (zoneLootRowsHtml peut montrer une zone différente de celle qu'on farme)
function gearDropChance(tier, zi) {
  if (S.lootTableVersion === 'v2') return LOOT_RATES_V2[tier.grade].gear;
  return tier.dropChance != null ? tier.dropChance : (GEAR_CHANCE[zi] ?? .002);
}
// chance de drop de bijou pour CE palier -- v1FallbackCh = la valeur V1 propre à CETTE zone (celle
// déjà stockée dans ZONES[zi].loot.jackpot.ch), utilisée telle quelle quand la V1 est active
function jewelDropChance(tier, v1FallbackCh) {
  if (S.lootTableVersion === 'v2') return LOOT_RATES_V2[tier.grade].jewel;
  return v1FallbackCh;
}
// rééquilibrage du 2026-07-05 (demande explicite) : les armes (weapon/awakening/secondary) ne
// tirent plus au hasard le même emplacement que l'armure — chaque zone garantit désormais un type
// d'arme précis (voir ZONE_WEAPON_SLOTS/rollWeaponDrop), donc GEAR_SLOTS ne couvre plus QUE les 4
// pièces d'armure, tirées au hasard entre elles comme avant.
const GEAR_SLOTS = ['helmet','armor','gloves','boots'];
// quel(s) type(s) d'arme chaque zone garantit (2026-07-05, demande explicite : "1 arme dans chaque
// zone") — cycle weapon→secondary→awakening sur les 3 zones de chaque palier. Le palier bleu a
// désormais lui aussi 3 zones (Planque des Mânes ajoutée le 2026-07-05) : la rotation complète
// remplace le compromis provisoire "2 armes sur la dernière zone" utilisé tant qu'il n'y avait que
// 2 zones bleues.
// rééquilibré le 2026-07-06 (demande explicite : "divise aussi les 3 armes dans les 3 dernieres
// zones de chaque couleurs") : avant, les 3 armes se répartissaient sur les 3 PREMIÈRES zones (la
// 4e répétait 'weapon' en double). Désormais, les 3 armes se répartissent sur les 3 DERNIÈRES zones
// du palier — la toute première zone de chaque palier ne garantit plus aucune arme (seulement sa
// pièce d'armure, voir ZONE_ARMOR_SLOTS), symétrique à l'armure qui, elle, laisse sa 4e zone sans
// répétition. Chaque type d'arme n'apparaît donc plus qu'UNE seule fois par palier (au lieu de 2).
// Bâton Naru exclusif à Camp des Loups (2026-07-08, demande explicite : "baton naru lootable
// exclusivement camp des loups") -- le palier gris est le seul où l'arme vient de la 1ère zone au
// lieu de la 2e : cohérent avec le spawn sans arme (2026-07-08), la toute première zone du jeu
// donne directement de quoi se défendre, plutôt que de forcer à survivre une zone entière à mains
// nues avant le premier drop d'arme.
const ZONE_WEAPON_SLOTS = [
  ['weapon'], [], ['secondary'],                  // grey : zones 0,1 (rien),2
  [], ['weapon'], ['secondary'],                  // white : zones 3 (rien),4,5
  [], ['weapon'], ['secondary'],                  // green : zones 6 (rien),7,8
  [], ['weapon'], ['secondary'],                  // blue : zones 9 (rien),10,11
  // 4e zone de chaque palier : complète la rotation avec l'éveil (2026-07-05 : "1 arme dans chaque
  // zone" -- corrigé le 2026-07-06 pour ne plus jamais répéter un type sur 2 zones du même palier)
  ['awakening'],                                   // grey : zone 12 (Ruines de Trent)
  ['awakening'],                                   // white : zone 13 (Île d'Iliya)
  ['awakening'],                                   // green : zone 14 (Base de Bashim)
  ['awakening'],                                   // blue : zone 15 (Forêt de Polly)
];
// quelle pièce d'armure chaque zone garantit (2026-07-06, demande explicite : "les 4 zones donnent
// 1 seule pièce d'armure casque/armure/bottes/gants") — remplace l'ancien tirage au hasard partagé
// entre les 4 zones du palier (rollGearDrop piochait au hasard dans GEAR_SLOTS). Chaque palier a
// désormais EXACTEMENT 4 zones (voir le commentaire sur les nouvelles zones dans ZONES) : mapping
// 1-pour-1 parfait avec les 4 pièces d'armure, même logique que ZONE_WEAPON_SLOTS pour les armes.
// Les 3 premières zones de chaque palier donnent casque/armure/gants, la 4e zone (ajoutée le
// 2026-07-05, voir ZONES) donne les bottes.
const ZONE_ARMOR_SLOTS = [
  ['helmet'], ['armor'], ['gloves'],              // grey : zones 0,1,2
  ['helmet'], ['armor'], ['gloves'],              // white : zones 3,4,5
  ['helmet'], ['armor'], ['gloves'],              // green : zones 6,7,8
  ['helmet'], ['armor'], ['gloves'],              // blue : zones 9,10,11
  ['boots'],                                       // grey : zone 12 (Ruines de Trent)
  ['boots'],                                       // white : zone 13 (Île d'Iliya)
  ['boots'],                                       // green : zone 14 (Base de Bashim)
  ['boots'],                                       // blue : zone 15 (Forêt de Polly)
];
// part du PA/PD requis de zone que chaque pièce peut apporter, selon son rôle
// (l'éveil est l'arme la plus forte en PA dans le vrai jeu, la secondaire un peu moins que l'arme principale)
// hpShare : part du bonus de PV que chaque pièce d'armure apporte (le plastron/casque protègent
// le plus de vitals, gants/bottes un peu moins) — somme = 1.0 sur les 4 pièces d'armure
// dodgeShare (2026-07-08) : l'Esquive ne vient QUE de l'armure (jamais des armes), répartie à
// parts égales sur les 4 pièces — voir DODGE_GEAR_SCALE pour la conversion en % réel
// RÉÉQUILIBRAGE du 2026-07-05 (demande explicite) : les armes donnaient bien trop de PA (à elles
// 3, ~750 PA au PEN en bleu, contre ~460 PD total) — apShare/dpShare recalculés pour qu'un stuff
// COMPLET du palier bleu (3 armes + 4 armures + bijoux) totalise ~301 PA / ~248 PD au PEN (×2.33,
// voir enhBonus(20)), chaque palier plus bas donnant proportionnellement moins (la formule suit le
// PA/PD requis de zone, qui grandit à chaque palier) — voir roadmap.md pour le détail du calcul.
// AP retiré des 4 pièces d'armure (2026-07-06, demande explicite : "les armures ne donnent pas
// d'AP") — comme dans le vrai jeu, l'armure est purement défensive (PD/PV/Esquive), seules les
// armes apportent de l'AP. L'ancien total d'AP armure (.0204+.0204+.0163+.0163 = .0734) est
// redistribué aux 3 armes en conservant leurs proportions relatives (×1.271), pour que le total
// d'AP d'un stuff complet reste EXACTEMENT le même qu'avant — préserve tel quel le calibrage
// PA/PD des transitions de palier de couleur fait le 2026-07-06 (voir ENH_STEP/palier PRI).
const GEAR_ROLE = {
  weapon:     { apShare:0.1139, dpShare:0,      hpShare:0,    dodgeShare:0 },
  awakening:  { apShare:0.1491, dpShare:0,      hpShare:0,    dodgeShare:0 },
  secondary:  { apShare:0.0813, dpShare:0,      hpShare:0,    dodgeShare:0 },
  helmet:     { apShare:0,      dpShare:0.1272, hpShare:0.30, dodgeShare:0.25 },
  armor:      { apShare:0,      dpShare:0.1272, hpShare:0.40, dodgeShare:0.25 },
  gloves:     { apShare:0,      dpShare:0.0954, hpShare:0.15, dodgeShare:0.25 },
  boots:      { apShare:0,      dpShare:0.0954, hpShare:0.15, dodgeShare:0.25 },
  // bijoux (jackpot ring/necklace/earring/belt) — ajouté le 2026-07-08 (demande explicite :
  // "revois ce que donne le stuff et aligne avec toute les autre stuff") : l'AP des bijoux était
  // jusqu'ici une valeur FIGÉE par zone (jackpot.ap dans ZONES), jamais recalculée quand reqAP a
  // changé (V201-V206) — complètement désynchronisée du reste du stuff, qui scale TOUJOURS
  // dynamiquement depuis reqAP. Les bijoux suivent désormais la même règle (voir rollDrops).
  jackpot:    { apShare:0.10,   dpShare:0,      hpShare:0,    dodgeShare:0 },
};
// plancher minimum (2026-07-08) : évite qu'une zone à faible reqAP/reqDP (ex: Camp des Loups,
// gearBasisAP volontairement bas pour le combat) ne produise un stuff à 0 PA/PD après arrondi
function gearFloor(v) { return Math.max(1, Math.round(v)); }
// facteur d'échelle des PV d'armure par rapport au PD requis de zone (calibré pour qu'un stuff
// d'armure complet et adapté à la zone évite un one-shot même en subissant la pénalité de PD
// insuffisante, cf dmgTakenMult qui monte jusqu'à ×4,5)
const HP_GEAR_SCALE = 9;
// facteur d'échelle de l'Esquive (en points de %) par rapport au PD requis de zone — volontairement
// beaucoup plus petit que HP_GEAR_SCALE : à endgame (zone 10, reqDP~239), un stuff complet adapté
// donne environ 19% d'esquive brute, avant le facteur d'efficacité (voir dodgeEffectiveness)
const DODGE_GEAR_SCALE = 0.08;
// prix de revente du gear looté (2026-07-09, demande explicite : "les item looté doivent se vendre
// bien moins chere" -- le trash au sol doit rester la SOURCE PRINCIPALE de revenu, pas la revente de
// pièces d'équipement/bijoux). Multiplicateur divisé par 10 (était 22) -- ex: un plastron de zone10
// valait 8228 silver (×78 le trash de la même zone, 105) contre ~823 désormais (×~8), toujours
// notable mais clairement secondaire au farm de trash.
const GEAR_SELL_MULT = 2.2;
// ratio bijou/trash (2026-07-09) — voir le commentaire complet dans rollDrops. Scope module (pas
// local à rollDrops) pour être réutilisable par migrateGearFixedStatsV226 (rétroactivité).
const JACKPOT_VAL_TRASH_RATIO = 20;
// taux de drop (chance) d'un groupe ALPHA (boss de pack) : uniformément ×2 par rapport au taux
// normal (2026-07-11, demande explicite : "les groupe alpha (boss) drop x2 par rapport au taux de
// loot") -- remplace les anciens multiplicateurs disparates (×1.5 trash/mat/jackpot/craft, ×1.6
// gear/arme). Ne touche PAS au multiplicateur de VALEUR silver (×1.6, inchangé, un concept séparé
// du taux de drop).
const ALPHA_LOOT_CHANCE_MULT = 2;
function rollGearDrop(zone, alpha) {
  const tier = gearTierForZone(zoneIdx);
  const chance = gearDropChance(tier, zoneIdx);
  if (Math.random() > chance * (alpha ? ALPHA_LOOT_CHANCE_MULT : 1)) return null;
  // 1 seule pièce d'armure garantie par zone (2026-07-06, demande explicite), voir ZONE_ARMOR_SLOTS
  // -- remplace l'ancien tirage au hasard parmi les 4 pièces, partagé entre les 4 zones du palier
  const slot = (ZONE_ARMOR_SLOTS[zoneIdx] || GEAR_SLOTS)[0];
  const role = GEAR_ROLE[slot];
  // gearBasisAP/DP (2026-07-08) : la PUISSANCE du stuff loot ici peut différer du reqAP/reqDP de
  // COMBAT de la zone (ex: Camp des Loups, volontairement facile mais dont le stuff doit préparer
  // à la zone suivante) — repli sur reqAP/reqDP si la zone n'a pas de gearBasis dédié
  const basisAP = zone.gearBasisAP ?? zone.reqAP, basisDP = zone.gearBasisDP ?? zone.reqDP;
  // stats FIXES, aucun jet aléatoire (2026-07-09, demande explicite : "Aucuns jet aléatoire sur les
  // objet équipable, ils donnent des statisque fix") -- avant, un ±15% (0.85-1.15) rendait 2
  // exemplaires du même objet différents sans raison ; désormais toujours la même valeur pour un
  // même palier/slot/zone, seul l'enchantement (enhLv) fait ensuite varier la puissance réelle.
  const ap = role.apShare ? gearFloor(basisAP * role.apShare) : 0;
  const dp = role.dpShare ? gearFloor(basisDP * role.dpShare) : 0;
  const hp = role.hpShare ? gearFloor(basisDP * role.hpShare * HP_GEAR_SCALE) : 0;
  const dodge = Math.round(basisDP * (role.dodgeShare||0) * DODGE_GEAR_SCALE * 100) / 100;
  // toute pièce d'armure prend la couleur ET l'ornementation du palier (icône générée à la volée,
  // 2026-07-07 puis étendu au casque + ornements de rareté le 2026-07-08)
  const TIER_COLORED_ICON = { helmet: helmetIconForColor, armor: armorIconForColor, gloves: glovesIconForColor, boots: bootsIconForColor };
  const icon = TIER_COLORED_ICON[slot] ? TIER_COLORED_ICON[slot](tier.color, tier.grade) : (SLOT_ICON ? SLOT_ICON[slot] : '⚔️');
  return {
    name: tier.sets[slot], kind:'gear', slot, ap, dp, hp, dodge, enhLv:0, optimizable:true, fsByLevel:{},
    key:'gear_'+tier.grade+'_'+slot+'_'+Math.random().toString(36).slice(2,7),
    icon, color:tier.color, stackable:false, weight:1.2,
    matName: tier.material.name, // matériau requis pour optimiser CETTE pièce (voir findEnhanceMaterial)
    val: Math.round((ap*2 + dp + hp*0.5) * GEAR_SELL_MULT),
  };
}
// arme(s) garantie(s) de la zone (2026-07-05, demande explicite : "1 arme dans chaque zone") —
// remplace l'ancien tirage au hasard partagé avec l'armure : chaque zone a un jet INDÉPENDANT (même
// taux que l'armure) pour son ou ses types d'arme désignés (voir ZONE_WEAPON_SLOTS). Renvoie un
// tableau (0, 1 ou 2 armes selon la zone et la chance).
function rollWeaponDrop(zone, alpha) {
  const tier = gearTierForZone(zoneIdx);
  const chance = gearDropChance(tier, zoneIdx);
  const slots = ZONE_WEAPON_SLOTS[zoneIdx] || ['weapon'];
  // arme/dague/orbes d'éveil prennent aussi la couleur ET l'ornementation du palier (2026-07-08,
  // même traitement que l'armure — voir staffIconForColor/daggerIconForColor/orbPairIconForColor)
  const TIER_COLORED_ICON = { weapon: staffIconForColor, secondary: daggerIconForColor, awakening: orbPairIconForColor };
  const out = [];
  for (const slot of slots) {
    if (Math.random() > chance * (alpha ? ALPHA_LOOT_CHANCE_MULT : 1)) continue;
    const role = GEAR_ROLE[slot];
    // stat FIXE, aucun jet aléatoire (2026-07-09, demande explicite) — voir rollGearDrop
    const basisAP = zone.gearBasisAP ?? zone.reqAP;
    const ap = gearFloor(basisAP * role.apShare);
    out.push({
      name: tier.sets[slot], kind:'gear', slot, ap, dp:0, hp:0, dodge:0, enhLv:0, optimizable:true, fsByLevel:{},
      key:'gear_'+tier.grade+'_'+slot+'_'+Math.random().toString(36).slice(2,7),
      icon: TIER_COLORED_ICON[slot] ? TIER_COLORED_ICON[slot](tier.color, tier.grade) : (SLOT_ICON ? SLOT_ICON[slot] : '⚔️'),
      color:tier.color, stackable:false, weight:1.2,
      matName: tier.material.name,
      val: Math.round(ap*2 * GEAR_SELL_MULT),
    });
  }
  return out;
}

// Trésor de Velia — objets de production à part entière (2026-07-13 : sorti du statut
// expérimental "TEST", demande explicite), identique dans TOUTES les zones du jeu (pas de scaling
// par zone/palier pour la CHANCE de drop — le PRIX, lui, suit le palier courant, voir referenceGearVal).
// Trésor de Velia 1/2/3 fusionnés en un seul "Trésor de Velia" (2026-07-13, demande explicite :
// "tout les tresors de velia 1/2/3 s'appel maintenant tresors de velia") -- avant, 3 variantes
// distinctes servaient d'ingrédients pour un objet mystère (voir historique de craftMysteryItem,
// retiré : il fallait pouvoir empiler 3 exemplaires, impossible désormais que le Trésor plafonne à
// 1 en sac, voir TREASURE_STACK_CAP).
const VELIA_TREASURE = [
  { name:'Bout du trésor de Velia', ch:.0017,   icon:'🧩', color:'#c9a55a', key:'treasure_bout_velia' }, // 0.17% (2026-07-13, demande explicite)
  { name:'Trésor de Velia',         ch:.000005, icon:'🗺️', color:'#e8c96a', key:'treasure_velia' },      // 0.0005% (2026-07-13, demande explicite)
];
// total de morceaux du Trésor de Velia ramassés À VIE (lifetime, via S.lootByItem) — utilisé par
// les succès et le classement dédié
function treasureTotal(S) {
  let total = 0;
  for (const t of new Set(VELIA_TREASURE.map(x => x.name))) total += S.lootByItem[t] || 0;
  return total;
}
// "prix d'un équipement" de référence (2026-07-13, demande explicite) pour tarifer le Trésor de
// Velia -- réutilise TELLE QUELLE la formule de valeur d'une pièce d'armure de rollGearDrop (même
// palier/zone que celle où le trésor est looté), pour rester automatiquement à jour si
// GEAR_SELL_MULT ou les stats de zone changent (voir la règle mémoire "rebalance stuff = rétroactif
// automatique" : préférer une formule dynamique à un chiffre figé).
function referenceGearVal() {
  const zone = Z(), tier = gearTierForZone(zoneIdx);
  const basisAP = zone.gearBasisAP ?? zone.reqAP, basisDP = zone.gearBasisDP ?? zone.reqDP;
  const slot = (ZONE_ARMOR_SLOTS[zoneIdx] || GEAR_SLOTS)[0];
  const role = GEAR_ROLE[slot];
  const ap = role.apShare ? gearFloor(basisAP * role.apShare) : 0;
  const dp = role.dpShare ? gearFloor(basisDP * role.dpShare) : 0;
  const hp = role.hpShare ? gearFloor(basisDP * role.hpShare * HP_GEAR_SCALE) : 0;
  return Math.round((ap*2 + dp + hp*0.5) * GEAR_SELL_MULT);
}
// plafond d'empilement en sac (2026-07-13, demande explicite) : au-delà, le surplus est vendu
// automatiquement (voir enforceTreasureStackCap, appelé depuis invAdd) plutôt que de bloquer le
// ramassage ou de remplir le sac indéfiniment.
const TREASURE_STACK_CAP = { treasure_bout_velia:100, treasure_velia:1 };
function enforceTreasureStackCap(slot) {
  if (!slot || slot.kind !== 'treasure') return;
  const cap = TREASURE_STACK_CAP[slot.key]; if (!cap) return;
  if (slot.qty > cap) {
    const excess = slot.qty - cap;
    addSilver(excess * (slot.val||0), 'sell', slot.name);
    slot.qty = cap;
  }
}

// ---------- conversion du Trésor de Velia (craft) — demande explicite du 2026-07-08 ----------
// 100 "Bout du trésor de Velia" → 1 "Trésor de Velia".
const TREASURE_PIECE_RECIPES = [
  { needKey:'treasure_bout_velia', needQty:100, giveName:'Trésor de Velia', giveKey:'treasure_velia' },
];
function invSlotByKey(key) { return INV.findIndex(s => s && s.key === key); }
function invQtyByKey(key) { const i = invSlotByKey(key); return i===-1 ? 0 : INV[i].qty; }
// une place est déjà garantie si l'objet résultant a déjà un stack existant (il fusionne dedans) —
// sinon il faut une case vide, comme n'importe quel nouvel objet
function invHasRoomFor(key) { return invSlotByKey(key) !== -1 || invUsed() < INV_SIZE; }
function craftTreasurePiece(recipe) {
  if (invQtyByKey(recipe.needKey) < recipe.needQty) return false;
  if (!invHasRoomFor(recipe.giveKey)) { floatTxt(P.x,P.y,90,LANG==='fr'?'Sac plein !':'Bag full!',{hurt:true}); return false; }
  invRemoveAt(invSlotByKey(recipe.needKey), recipe.needQty);
  invAdd({ name:recipe.giveName, kind:'treasure', icon:'🗺️', color:'#e8c96a', key:recipe.giveKey, qty:1, stackable:true, weight:0.05, val:referenceGearVal()*10000, ap:0, dp:0, hp:0, dodge:0 });
  trackLoot(recipe.giveName);
  floatTxt(P.x,P.y,90,'🗺️ '+recipe.giveName,{gold:true});
  logToDiscord('🔧 Craft', `**${myPseudo||'Joueur'}** combine ${recipe.needQty} morceaux en 1 ${recipe.giveName}`, 0xe8c96a);
  renderInventory();
  return true;
}
// recette "secrète" (2026-07-15, demande explicite : "ajoute un combiner 3 carte differente =
// secret") : combine 1 Bout du trésor de Velia + 1 matériau d'optimisation (n'importe lequel) + 1
// bijou (n'importe lequel) — 3 objets de nature DIFFÉRENTE, contrairement à la recette ci-dessus
// qui empile 100 fois le MÊME objet — contre une récompense en silver immédiate. Le montant
// (référence × 300) reste loin en dessous de la conversion complète en Trésor de Velia (référence
// × 10000 pour 100 morceaux) : un bonus notable mais qui ne concurrence pas la vraie progression du
// Trésor, seulement un moyen de valoriser un bijou/matériau isolé qu'on aurait sinon juste vendu.
// Ingrédients changés le 2026-07-15 (demande explicite : "tresor de velia / tresor de heilde /
// tresors de calpheon / donne coffret secret") -- c'était le sens original de "combiner 3 cartes
// différentes" demandé bien plus tôt dans la session : les 3 Trésors RÉGIONAUX complets (pas Bout +
// matériau + bijou comme la 1ère version). Tant que Heidel/Calpheon restent verrouillés (voir
// TIER_PREVIEW_CARD), cette recette reste non complétable EN PRATIQUE -- ce n'est pas un bug, ces 2
// ingrédients n'existent tout simplement pas encore en jeu.
const SECRET_COMBO_SILVER_MULT = 300;
function secretComboReady() {
  return invSlotByKey('treasure_velia') !== -1
    && invSlotByKey('treasure_heidel') !== -1
    && invSlotByKey('treasure_calpheon') !== -1;
}
function craftSecretCombo() {
  const vIdx = invSlotByKey('treasure_velia');
  const hIdx = invSlotByKey('treasure_heidel');
  const cIdx = invSlotByKey('treasure_calpheon');
  if (vIdx === -1 || hIdx === -1 || cIdx === -1) return false;
  invRemoveAt(vIdx, 1); invRemoveAt(hIdx, 1); invRemoveAt(cIdx, 1);
  const reward = Math.round(referenceGearVal() * SECRET_COMBO_SILVER_MULT);
  // catégorie 'loot' (pas 'craft', absente de la whitelist CHECK de silver_ledger posée par
  // l'audit de sécurité du 2026-07-14 -- voir supabase/migrations/20260714171000_...) : un
  // gain via cette recette reste un revenu en jeu, la catégorie la plus proche déjà autorisée
  addSilver(reward, 'loot', 'Coffret secret');
  floatTxt(P.x,P.y,90,'🎁 +'+fmt(reward),{gold:true});
  logToDiscord('🎁 Coffret secret', `**${myPseudo||'Joueur'}** combine les 3 Trésors régionaux pour ${fmt(reward)} silver`, 0xe8c96a);
  renderInventory();
  return true;
}
// panneau de craft affiché SEULEMENT dans l'onglet "Trésors" de l'inventaire (voir renderInventory)
function renderTreasureCraftPanel() {
  // affiché en permanence dans la carte "Optimisation & Craft" (2026-07-08) — avant ce correctif,
  // ce panneau ne s'affichait QUE quand l'onglet "Trésors" de l'inventaire était ouvert, un reste
  // de l'époque où il vivait DANS la carte Inventaire ; il restait donc invisible la plupart du temps
  const el = $('treasureCraftPanel'); if (!el) return;
  const pieceRows = TREASURE_PIECE_RECIPES.map(r => {
    const have = invQtyByKey(r.needKey);
    const ok = have >= r.needQty;
    return `<button class="craftRecipeBtn${ok?' ready':''}" data-kind="piece" data-key="${r.needKey}" ${ok?'':'disabled'}>` +
      `🧩 ${have}/${r.needQty} → 🗺️ ${escapeHtml(r.giveName)}</button>`;
  }).join('');
  const secretOk = secretComboReady();
  const secretRow = `<button class="craftRecipeBtn${secretOk?' ready':''}" data-kind="secret" ${secretOk?'':'disabled'} ` +
    `title="${LANG==='fr'?'1 Trésor de Velia + 1 Trésor de Heidel + 1 Trésor de Calpheon → silver (Heidel/Calpheon pas encore débloqués)':'1 Velia Treasure + 1 Heidel Treasure + 1 Calpheon Treasure → silver (Heidel/Calpheon not unlocked yet)'}">` +
    `🗺️+🗺️+🗺️ → 🎁 ${LANG==='fr'?'Coffret secret':'Secret box'}</button>`;
  // recettes verrouillées "100 fragment → 1 carte" pour Heidel/Calpheon (2026-07-15, demande
  // explicite : "ajoute 2 crafte /100 > carte") -- aucun fragment n'est obtenable tant que ces
  // paliers restent verrouillés (voir TIER_PREVIEW_CARD/ZONE_TIERS), donc affichées grisées comme
  // les autres emplacements verrouillés du jeu (Consommable/RNG...), prêtes pour le jour où le
  // palier ouvrira -- toujours "0/100", jamais cliquables.
  const upcomingRows = Object.entries(TIER_PREVIEW_CARD).map(([tierId, card]) => {
    const tierLabel = ZONE_TIERS.find(t => t.id === tierId).label[LANG];
    return `<button class="craftRecipeBtn" disabled title="${LANG==='fr'?'Bientôt disponible — palier '+tierLabel+' pas encore ouvert':'Coming soon — '+tierLabel+' tier not yet open'}">` +
      `🔒 🧩 0/100 → ${card.icon} ${escapeHtml(tr(card.name))}</button>`;
  }).join('');
  el.innerHTML = `<div class="craftPanelTitle">${LANG==='fr'?'🔧 Combiner':'🔧 Combine'}</div>` +
    `<div class="craftRecipes">${pieceRows}${secretRow}${upcomingRows}</div>`;
  el.querySelectorAll('.craftRecipeBtn[data-kind="piece"]').forEach(btn => {
    btn.onclick = () => { const r = TREASURE_PIECE_RECIPES.find(x => x.needKey === btn.dataset.key); if (r) craftTreasurePiece(r); renderTreasureCraftPanel(); };
  });
  const secretBtn = el.querySelector('.craftRecipeBtn[data-kind="secret"]');
  if (secretBtn) secretBtn.onclick = () => { craftSecretCombo(); renderTreasureCraftPanel(); };
}
// affiche un % avec juste assez de décimales pour rester lisible même sur des chances minuscules
// (ex: 0.00001%) — toFixed(1) fixe habituel afficherait juste "0.0%"
function fmtTinyPct(ch) {
  const pct = ch * 100;
  if (pct <= 0) return '0%';
  const decimals = Math.min(8, Math.max(1, Math.ceil(-Math.log10(pct)) + 1));
  return pct.toFixed(decimals) + '%';
}
// rythme de kills/min de référence pour évaluer le temps moyen d'obtention des trésors côté admin
// (voir panneau admin > Trésor de Velia) — comparable au "Kills/min" affiché en jeu (stKpm)
const ADMIN_TREASURE_KPM_REF = 15;
function fmtDurationMin(min) {
  if (min < 60) return Math.round(min) + ' min';
  const hours = min / 60;
  if (hours < 24) return hours.toFixed(1) + ' h';
  return (hours/24).toFixed(1) + ' j';
}
function rollDrops(wp, alpha, lm) {
  const zone = Z(), L = zone.loot;
  const zk = zoneIdx; // pour rendre les clés uniques par zone
  const mults = alpha ? ALPHA_LOOT_CHANCE_MULT : 1;
  // le matériau d'optimisation dépend désormais du PALIER de stuff (Naru/Tuvala/Yuria/Grunil),
  // pas de la zone — on garde juste la valeur/chance d'origine de la zone (économie inchangée)
  const tier = gearTierForZone(zoneIdx);
  const tierMat = tier.material;
  // bijou (jackpot) : icône générée selon le palier — anneau nu (gris/blanc) → un diamant (vert) →
  // plusieurs diamants + couleur du palier (bleu) — demande explicite du 2026-07-07
  const jSlot = accSlotFor(L.jackpot);
  const jTierIdx = JEWEL_TIER_IDX[tier.grade] ?? 0;
  const JEWEL_ICON_FOR_SLOT = { ring:ringIconForTier, necklace:necklaceIconForTier, earring:earringIconForTier, belt:beltIconForTier };
  const jackpotIcon = (JEWEL_ICON_FOR_SLOT[jSlot] || ringIconForTier)(jTierIdx, tier.color);
  // AP du bijou calculé dynamiquement depuis reqAP/gearBasisAP de la zone (2026-07-08, demande
  // explicite : "revois ce que donne le stuff et aligne avec toute les autre stuff") — remplace
  // l'ancienne valeur FIGÉE (L.jackpot.ap dans ZONES), jamais recalculée après un changement de
  // reqAP et donc désynchronisée du reste du stuff, qui a toujours scalé dynamiquement
  const jackpotAp = gearFloor((zone.gearBasisAP ?? zone.reqAP) * GEAR_ROLE.jackpot.apShare);
  // valeur de revente du bijou (2026-07-09, demande explicite : "les item looté doivent se vendre
  // bien moins chere") -- remplace l'ancienne valeur FIGÉE de ZONES (L.jackpot.val), qui valait
  // ~180 à ~290× le trash de sa propre zone (ex: 35 000 contre 120 en zone 11) : le bijou éclipsait
  // totalement le trash comme source de revenu. Recalculée dynamiquement à ~20× le trash de la
  // zone, un vrai bonus notable au dropped mais qui ne concurrence plus le farm de trash.
  // (constante en scope MODULE, pas locale — réutilisée par migrateGearFixedStatsV226 pour
  // recalculer rétroactivement le stuff déjà possédé, voir plus bas)
  const jackpotVal = gearFloor(L.trash.val * JACKPOT_VAL_TRASH_RATIO);
  const table = [
    { ...L.trash,   kind:'trash',    color:'#a08464', key:'trash_'+zk,   icon:'▬', stackable:true,  weight:0.3 },
    { name:tierMat.name, val:L.mat.val, ch:L.mat.ch, kind:'material', color:tierMat.color, key:'mat_'+tierMat.name, icon:tierMat.icon, stackable:true, weight:0.1 },
    // matName (2026-07-11, bug corrigé : "aucune pierre ne se met dans le slot pour les bijoux") --
    // manquait sur les bijoux (jackpot), contrairement au gear/armes qui l'ont toujours eu ; sans
    // lui, findEnhanceMaterial() retombait sur le matériau de la zone COURANTE au lieu de celui du
    // PALIER du bijou ciblé, cassant l'auto-sélection dès que le bijou équipé n'était pas du même
    // palier que la zone où l'on farme actuellement (voir tier.material, même valeur que pour
    // l'armure/les armes de ce palier).
    { ...L.jackpot, ch:jewelDropChance(tier, L.jackpot.ch), ap:jackpotAp, val:jackpotVal, kind:'jackpot',  color:tier.color, key:'acc_'+zk+'_'+Math.random().toString(36).slice(2,7), icon:jackpotIcon, stackable:false, weight:0.5, matName:tierMat.name },
    { ...L.craft,   kind:'craft',    color:'#b48ce8', key:'craft_'+L.craft.name, icon:'✦', stackable:true, weight:0.2, val:0 },
    // "Bout du trésor de Velia" se loot par 1 à 3 (demande explicite du 2026-07-06) -- pickupQty
    // DOIT être tiré ici (dans ce tableau reconstruit à chaque kill), jamais dans la définition
    // statique de VELIA_TREASURE (const de module, évaluée UNE SEULE fois au chargement du script :
    // un Math.random() y serait figé pour toute la session au lieu d'être retiré à chaque drop)
    // val (2026-07-13, demande explicite) : "Bout" = 10× le prix d'un équipement de CE palier,
    // "Trésor de Velia" = 10 000× -- voir referenceGearVal (ignoré par le multiplicateur alpha/lm
    // habituel juste en dessous, ce n'est pas un revenu de trash mais un prix de vente fixe)
    ...VELIA_TREASURE.map(t => ({ name:t.name, val:referenceGearVal()*(t.key==='treasure_bout_velia'?10:10000), ch:t.ch, kind:'treasure', color:t.color, key:t.key, icon:t.icon, stackable:true, weight:0.05,
      pickupQty: t.key==='treasure_bout_velia' ? 1+Math.floor(Math.random()*3) : 1 })),
    // Pierre de Cron : taux FIXE (voir CRON_STONE.ch), identique dans TOUTES les zones du jeu
    // (indépendante du palier de stuff). 1 à 3 unités par drop (pickupQty).
    { name:CRON_STONE.name, val:0, ch:CRON_STONE.ch, kind:'material', color:CRON_STONE.color, key:CRON_STONE.key,
      icon:CRON_STONE.icon, stackable:true, weight:0.1, pickupQty: 1+Math.floor(Math.random()*3) },
  ];
  for (const item of table) {
    if (Math.random() > item.ch * mults) continue;
    const a = Math.random()*Math.PI*2, r = 14+Math.random()*46;
    drops.push({
      x: wp.x + Math.cos(a)*r, y: wp.y + Math.sin(a)*r,
      item, taken:false,
      // valeur FIXE par zone × lootMult(r) — plus aucun scaling au niveau joueur ; le Trésor de
      // Velia échappe à ce multiplicateur (2026-07-13) : son prix est déjà un multiple fixe du
      // prix d'un équipement (voir referenceGearVal ci-dessus), pas un revenu de trash à booster
      silver: item.kind === 'treasure' ? item.val : Math.ceil((item.val||0) * (alpha?1.6:1) * lm),
      age:0, pop:.35,
    });
  }
  const gear = rollGearDrop(zone, alpha);
  if (gear) {
    const a = Math.random()*Math.PI*2, r = 14+Math.random()*46;
    drops.push({ x: wp.x+Math.cos(a)*r, y: wp.y+Math.sin(a)*r, item: gear, taken:false, silver: gear.val, age:0, pop:.35 });
  }
  // arme(s) garantie(s) de la zone (2026-07-05) — voir rollWeaponDrop/ZONE_WEAPON_SLOTS
  for (const weapon of rollWeaponDrop(zone, alpha)) {
    const a = Math.random()*Math.PI*2, r = 14+Math.random()*46;
    drops.push({ x: wp.x+Math.cos(a)*r, y: wp.y+Math.sin(a)*r, item: weapon, taken:false, silver: weapon.val, age:0, pop:.35 });
  }
}

const DESPAWN = 40;
let invFullWarned = 0;
let lastInvFullToast = 0;
function showInvFullWarning() {
  invFullWarned = 2;
  const el = $('invFullBanner');
  if (!el) return;
  el.classList.add('show');
  const now = performance.now();
  if (now - lastInvFullToast > 4000) { // pas plus d'1 toast/4s pour ne pas spammer
    lastInvFullToast = now;
    floatTxt(P.x, P.y-20, 70, LANG==='fr' ? 'SAC PLEIN !' : 'BAG FULL!', {hurt:true});
  }
}
function dropsTick(dt) {
  for (const l of drops) {
    if (l.taken) continue;
    l.age += dt; l.pop = Math.max(0,l.pop-dt);
    if (P.faint <= 0 && dist(P.x,P.y,l.x,l.y) < S.lootRadius) {
      const it = l.item;

      // le trash est du silver pur : toujours ramassé, ne prend jamais de place dans le sac
      if (it.kind === 'trash') {
        addSilver(l.silver, 'loot', it.name);
        l.taken = true; S.lootCount++;
        lootLine(it, l.silver, 'trashLoot');
        floatTxt(l.x,l.y,40,it.name,{silver:true});
        particles.push({ type:'pickup', x:l.x, y:l.y, life:.35, max:.35, color:it.color });
        queueFarmEvent(it.kind, it.name, 1, l.silver);
        const zoneWasDone = zoneFullyCollected(zoneIdx); // Compendium : avant ramassage
        trackLoot(it.name);
        checkZoneCompendiumUnlock(zoneIdx, zoneWasDone);
        continue;
      }

      // construit l'objet inventaire (matériau/bijou/gear/craft — ceux-là prennent une place)
      const isOptimizable = it.kind === 'gear' || it.kind === 'jackpot';
      const obj = {
        // le bijou porte déjà sa propre icône (générée selon son palier au moment du drop, voir
        // rollDrops) — ne plus l'écraser par l'ancienne icône générique JACKPOT_ICON
        key: it.key, name: it.name, kind: it.kind, icon: it.icon, color: it.color,
        qty: it.pickupQty || 1, stackable: it.stackable, weight: it.weight,
        val: l.silver, ap: it.ap||0, dp: it.dp||0, hp: it.hp||0, dodge: it.dodge||0, enhLv: it.enhLv||0,
        optimizable: isOptimizable, fsByLevel: isOptimizable ? {} : undefined,
        slot: it.kind==='jackpot' ? accSlotFor(it) : it.kind==='gear' ? it.slot : null,
        matName: it.matName, // palier de stuff (Naru/Tuvala/Yuria/Grunil) → quel matériau l'optimise
      };
      const ok = invAdd(obj);
      if (!ok) { // inventaire plein → l'objet reste au sol (le joueur continue de farmer normalement)
        showInvFullWarning();
        continue;
      }
      l.taken = true;
      S.lootCount++;
      queueFarmEvent(it.kind, it.name, 1, l.silver);
      const zoneWasDone = zoneFullyCollected(zoneIdx); // Compendium : avant ramassage
      trackLoot(it.name);
      checkZoneCompendiumUnlock(zoneIdx, zoneWasDone);
      if (it.kind === 'jackpot') {
        S.jackpotCount = (S.jackpotCount||0) + 1;
        // prix affiché uniquement pour le trash/token (2026-07-15, demande explicite : "affiche pas
        // le prix sur les item autre que token met juste la quantité") -- avant, le ticker montrait
        // "(+1234)" pour n'importe quel objet vendable au ramassage, pas seulement le trash
        lootLine(it, 0, 'jackpot');
        floatTxt(l.x,l.y,55,'★ '+it.name,{lvl:true});
        // le centre de notifications ne garde que les infos importantes (succès, boss, niveau) —
        // les trouvailles de loot restent visibles dans le loot ticker, pas besoin de les dupliquer
        // ici (demande explicite du 2026-07-06)
        logToDiscord('💍 Bijou rare trouvé', `**${myPseudo||'Joueur'}** a trouvé ${it.name}`, 0xb48ce8);
      } else if (it.kind === 'gear') {
        S.gearDropCount = (S.gearDropCount||0) + 1;
        lootLine(it, 0, 'jackpot');
        floatTxt(l.x,l.y,55,'⚔ '+it.name,{lvl:true});
        logToDiscord('⚔️ Équipement rare trouvé', `**${myPseudo||'Joueur'}** a trouvé ${it.name}`, 0xb48ce8);
      } else if (it.kind === 'craft') {
        lootLine(it, 0, 'rare');
        floatTxt(l.x,l.y,40,it.name,{blue:true});
      } else if (it.kind === 'treasure') {
        lootLine(it, 0, 'rare');
        floatTxt(l.x,l.y,50,'🗺️ '+it.name,{lvl:true});
        // les trésors sont TRÈS rares (jusqu'à 0.00001% de chance) — vaut bien un log "pour le fun"
        logToDiscord('🗺️ Trésor de Velia', `**${myPseudo||'Joueur'}** trouve ${it.name} (${fmtTinyPct(it.ch)} de chance)`, 0xe8c96a);
      } else {
        lootLine(it, 0, it.kind === 'material' ? 'matLoot' : '');
        floatTxt(l.x,l.y,40,it.name,{silver:true});
        // tout premier ramassage d'une Pierre de Cron (2026-07-09, demande explicite) : petit
        // tutoriel expliquant son rôle (protège contre une rétrogradation, activable/désactivable
        // en cliquant dessus) — voir CRON_TUTORIAL_STEPS/startCronTutorial (game-supabase.js)
        if (it.name === CRON_STONE.name && !cronTutoSeen) {
          cronTutoSeen = true;
          try { localStorage.setItem('velia-idle-cron-tuto-seen', '1'); } catch(e) {}
          setTimeout(startCronTutorial, 400);
        }
      }
      particles.push({ type:'pickup', x:l.x, y:l.y, life:.35, max:.35, color:it.color });
      if (invPanelOpen) renderInventory();
    }
  }
  drops = drops.filter(l => !l.taken && l.age < DESPAWN);
}

// attribue un slot d'accessoire probable selon le nom
function accSlotFor(it) {
  const n = it.name.toLowerCase();
  // "earring" contient la sous-chaîne "ring" → on le teste EN PREMIER pour ne pas le confondre avec une bague
  if (n.includes('earring') || n.includes('boucle') || n.includes('oreille')) return 'earring';
  if (n.includes('necklace') || n.includes('collier')) return 'necklace';
  if (n.includes('belt') || n.includes('ceinture')) return 'belt';
  if (n.includes('ring') || n.includes('bague') || n.includes('anneau')) return 'ring';
  return 'ring'; // repli si aucun mot-clé ne matche
}

// regroupe les drops IDENTIQUES consécutifs en une seule ligne "xN" au lieu de spammer une
// ligne par ramassage — demande explicite du 2026-07-05
// prix affiché UNIQUEMENT pour le trash/token (2026-07-15, demande explicite : "affiche pas le prix
// sur les item autre que token met juste la quantité et met une icone quand c'est le prix pour le
// loot") -- seul le trash passe encore un val>0 (voir les appels de lootLine dans dropsTick), les
// autres kinds n'affichent plus que leur nom + ×N. Une pièce 🪙 précède le prix quand il est affiché.
// Quantité ×N placée AVANT le prix (2026-07-15, demande explicite : "dans le loot ticker mais la
// quantité avant le prix") -- était après.
function lootLine(item, val, cls) {
  const t = $('lootTicker');
  if (lastLootEntry && lastLootEntry.name === item.name && lastLootEntry.cls === (cls||'') && lastLootEntry.el.isConnected) {
    lastLootEntry.count++;
    lastLootEntry.val += val;
    lastLootEntry.el.innerHTML = `${escapeHtml(item.name)} ×${lastLootEntry.count}` + (lastLootEntry.val > 0 ? ` (🪙+${fmt(lastLootEntry.val)})` : '');
    return;
  }
  const div = document.createElement('div');
  if (cls) div.className = cls;
  div.innerHTML = val > 0 ? `${escapeHtml(item.name)} (🪙+${fmt(val)})` : escapeHtml(item.name);
  t.appendChild(div); // + flex-direction:column en CSS → apparaît en bas, pousse les anciennes vers le haut
  while (t.children.length > 15) t.removeChild(t.firstChild);
  lastLootEntry = { name:item.name, cls: cls||'', count:1, val, el:div };
}

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
function xpNeededFor(lvl) { return LEVEL_XP_TABLE[Math.min(lvl, LEVEL_XP_TABLE.length-1)]; }
// affichage façon BDO : pourcentage à 3 décimales, toujours 2 chiffres avant la virgule (00.000%)
function fmtXpPct(pct) {
  pct = Math.max(0, Math.min(99.999, pct));
  const [intPart, decPart] = pct.toFixed(3).split('.');
  return intPart.padStart(2,'0') + '.' + decPart + '%';
}
// s'illumine brièvement autour du niveau/XP à chaque gain (2026-07-10, demande explicite : "fais
// un carré autour du niveau et % d'xp qui s'illumine quand on gagne de l'xp")
function flashXpGain() {
  const el = $('lvlXpRow'); if (!el) return;
  el.classList.remove('xpFlash');
  void el.offsetWidth; // force reflow pour rejouer la transition CSS même si déjà en cours
  el.classList.add('xpFlash');
  clearTimeout(flashXpGain._t);
  flashXpGain._t = setTimeout(() => el.classList.remove('xpFlash'), 500);
}
function gainXp(n) {
  if (n > 0) flashXpGain();
  S.xp += n;
  while (S.xp >= S.xpNext) {
    S.xp -= S.xpNext; S.lvl++;
    S.xpNext = xpNeededFor(S.lvl);
    S.hpMax += 8; P.hp = effHpMax();
    floatTxt(P.x,P.y,115,'NIVEAU '+S.lvl,{lvl:true});
    pushNotif('⭐', LANG==='fr'?'Niveau supérieur':'Level up', (LANG==='fr'?'Niveau ':'Level ')+S.lvl, 'info');
    // log "pour le fun" (demande explicite du 2026-07-08 : "spam le channel, fais toi plaisir")
    logToDiscord('⭐ Niveau supérieur', `**${myPseudo||'Joueur'}** passe niveau **${S.lvl}** (SPD +${Math.round(levelSpdPct())}%)`, 0x9cc9e8);
  }
}

function floatTxt(x,y,z,txt,o={}){ floats.push({x,y,z,txt,life:o.lvl?1.6:1,...o}); }

// ==================== VFX ====================
function spawnVfx(sk,p) {
  switch (sk.vfx) {
    case 'meteor':
      for (let i=0;i<5;i++)
        particles.push({type:'meteor',x:p.x+(Math.random()*110-55),y:p.y+(Math.random()*110-55),
          z:260+Math.random()*70,vz:-(430+Math.random()*130),life:1.4,max:1.4});
      break;
    case 'ice':
      for (let i=0;i<14;i++)
        particles.push({type:'ice',x:p.x+(Math.random()*100-50),y:p.y+(Math.random()*100-50),
          z:170+Math.random()*50,vz:-(300+Math.random()*110),life:1,max:1});
      break;
    case 'bolt':
      for (let i=0;i<3;i++)
        particles.push({type:'bolt',x:p.x+(Math.random()*70-35),y:p.y+(Math.random()*70-35),life:.28,max:.28});
      particles.push({type:'flash',life:.14,max:.14});
      break;
    case 'fire':
      particles.push({type:'fireOrb',x:P.x,y:P.y,tx:p.x,ty:p.y,t:0});
      break;
    case 'quake':
      particles.push({type:'quake',x:p.x,y:p.y,r:10,life:.55,max:.55});
      break;
    case 'spark':
      for (let i=0;i<8;i++)
        particles.push({type:'spark',x:p.x+(Math.random()*60-30),y:p.y+(Math.random()*60-30),
          z:10+Math.random()*30,vz:40+Math.random()*50,life:.45,max:.45});
      break;
  }
}
function particlesTick(dt) {
  for (const q of particles) {
    if (q.life !== undefined) q.life -= dt;
    if (q.type==='meteor'||q.type==='ice') {
      q.z += q.vz*dt;
      if (q.z <= 0 && !q.boom) { q.boom = true; q.z = 0; q.life = Math.min(q.life,.2); }
    }
    if (q.type==='spark') { q.z += q.vz*dt; q.vz -= 200*dt; if (q.z<0) q.z=0; }
    if (q.type==='quake') q.r += 210*dt;
    if (q.type==='fireOrb') {
      q.t += dt*3;
      if (q.t >= 1 && !q.done) {
        q.done = true; q.life = 0;
        for (let i=0;i<7;i++)
          particles.push({type:'spark',x:q.tx+(Math.random()*40-20),y:q.ty+(Math.random()*40-20),
            z:5+Math.random()*20,vz:50+Math.random()*70,life:.4,max:.4,fire:true});
      } else if (q.life === undefined) q.life = 1;
    }
  }
  particles = particles.filter(q => q.life===undefined || q.life>0);
}

// Rendu canvas (scene, sprites, particules) + demarrage du jeu -> voir render.js (charge APRES ce fichier, voir index.html)
// ==================== HUD ====================
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
// 5 paliers de régions (voir roadmap.md pour le détail des zones prévues par palier) —
// seul "Early / Velia" est en jeu pour l'instant, les autres sont verrouillés en attendant
// d'être construits (demande explicite du 2026-07-05)
// trésors-teaser des 2 prochains paliers (2026-07-15, demande explicite : "créer 2 nouvelles cartes
// qui se loot dans les prochaines zones heidel et calpheon" puis renommés "tresor de heilde /
// tresors de calpheon" -- même famille que "Trésor de Velia", pas des "cartes" séparées) --
// Heidel/Calpheon restent verrouillés (zones pas encore construites, confirmé "zone bloqué"), ces
// objets ne sont donc PAS obtenables pour l'instant : juste un aperçu affiché dans le tooltip du
// palier verrouillé (voir renderZoneTierTabs) et un couple de recettes verrouillées dans Assemblage
// (voir renderTreasureCraftPanel) prêtes pour le jour où le palier ouvrira. Le "Coffret secret" (voir
// craftSecretCombo) combine désormais les 3 Trésors régionaux (Velia + Heidel + Calpheon) —
// c'était le sens original de "combiner 3 cartes différentes" demandé plus tôt.
const TIER_PREVIEW_CARD = {
  mid: { name:'Trésor de Heidel', icon:'🗺️', color:'#6ea3c9', key:'treasure_heidel' },
  end: { name:'Trésor de Calpheon', icon:'🗺️', color:'#e0935a', key:'treasure_calpheon' },
};
const ZONE_TIERS = [
  { id:'early', icon:'🟢', label:{fr:'Velia',en:'Velia'},       locked:false },
  { id:'mid',   icon:'🔵', label:{fr:'Heidel',en:'Heidel'},     locked:true },
  { id:'end',   icon:'🟡', label:{fr:'Calpheon',en:'Calpheon'}, locked:true },
  { id:'end2',  icon:'🟠', label:{fr:'Valencia',en:'Valencia'}, locked:true },
  { id:'end3',  icon:'🔴', label:{fr:'Edana',en:'Edana'},       locked:true },
];
// onglets de la carte Statistiques : "Perso" (contenu existant, inchangé) / "Recommandations"
// (2026-07-09, demande explicite) -- les valeurs de recommandation sont purement THÉORIQUES (voir
// zoneSilverPerHour/zoneXpPerHour/zoneKillsPerMin), donc constantes tout le long d'une session :
// rendu une seule fois au clic sur l'onglet plutôt qu'à chaque tick de hud().
let statsTab = 'perso';
function renderStatsTabs() {
  const el = $('statsTabTabs'); if (!el) return;
  el.querySelectorAll('.catTab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === statsTab));
  const personaPane = $('statsPersoPane'), recoPane = $('statsRecoPane');
  if (personaPane) personaPane.style.display = statsTab === 'perso' ? '' : 'none';
  if (recoPane) recoPane.style.display = statsTab === 'reco' ? '' : 'none';
  if (statsTab === 'reco' && recoPane && !recoPane.dataset.rendered) { renderStatsRecoPane(); recoPane.dataset.rendered = '1'; }
}
(function wireStatsTabTabs() {
  const el = $('statsTabTabs'); if (!el) return;
  el.querySelectorAll('.catTab').forEach(btn => {
    btn.onclick = () => { statsTab = btn.dataset.tab; renderStatsTabs(); };
  });
})();
// contenu de l'onglet "Recommandations" : meilleure zone pour le silver/h, le xp/h et les
// kills/min, chacun cliquable pour s'y rendre directement (même geste que les zones de farm)
function renderStatsRecoPane() {
  const el = $('statsRecoPane'); if (!el) return;
  const rows = [
    { label: LANG==='fr'?'💰 Meilleur silver/h':'💰 Best silver/h', best: bestZoneForMetric(zoneSilverPerHour), fmtV: v => fmt(Math.round(v))+'/h' },
    { label: LANG==='fr'?'⭐ Meilleur XP/h':'⭐ Best XP/h', best: bestZoneForMetric(zoneXpPerHour), fmtV: v => fmt(Math.round(v))+'/h' },
    { label: LANG==='fr'?'⚔️ Meilleurs kills/min':'⚔️ Best kills/min', best: bestZoneForMetric(zoneKillsPerMin), fmtV: v => v.toFixed(1)+'/min' },
  ];
  el.innerHTML = `<div class="constructionBanner">${LANG==='fr'
      ? '🚧 En construction — calculs et présentation encore amenés à changer'
      : '🚧 Under construction — calculations and presentation still subject to change'}</div>` +
    `<div class="admHint">${LANG==='fr'
      ? 'Classement théorique (stuff idéal, indépendant de ta survie actuelle) — clique une zone pour t\'y rendre.'
      : 'Theoretical ranking (ideal gear, independent of your current survival) — click a zone to go there.'}</div>` +
    rows.map((r,ri) => `<div class="row statsRecoRow" data-zi="${r.best.i}" data-ri="${ri}">` +
      `<span>${r.label}</span><span class="v">${tr(ZONES[r.best.i].name)} · ${r.fmtV(r.best.v)}</span></div>`).join('');
  el.querySelectorAll('.statsRecoRow').forEach(row => {
    row.onclick = () => { const zi = parseInt(row.dataset.zi,10); if (atVelia || zi !== zoneIdx) travelTo(zi); };
  });
}
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
      ? (LANG==='fr' ? `Bientôt disponible — droppera : ${card.icon} ${tr(card.name)}` : `Coming soon — will drop: ${card.icon} ${tr(card.name)}`)
      : (LANG==='fr' ? 'Bientôt disponible' : 'Coming soon');
    return `<button class="catTab${t.id===zoneTier?' active':''}${t.locked?' locked':''}"` +
    `${t.locked?' disabled title="'+lockedTitle+'"':''} data-tier="${t.id}">` +
    `${t.locked?'<span class="zoneTierLock">🔒</span>':''}<span class="zoneTierLabel">${t.icon} ${t.label[LANG]}</span></button>`;
  }).join('');
  el.querySelectorAll('.catTab:not(.locked)').forEach(btn => {
    btn.onclick = () => { zoneTier = btn.dataset.tier; buildZoneList(); };
  });
}
function buildZoneList() {
  renderZoneTierTabs();
  const list = $('zoneList');
  list.innerHTML = '';
  // Velia, la ville paisible : épinglée en haut, aucun monstre, aucun farm — juste un accès
  // rapide pour revoir le tutoriel de bienvenue à tout moment
  const veliaRow = document.createElement('div');
  veliaRow.className = 'zRow veliaRow' + (atVelia ? ' current' : '');
  veliaRow.title = LANG==='fr' ? 'Velia — zone paisible' : 'Velia — peaceful zone';
  veliaRow.innerHTML =
    `<span class="zname">🏘️ Velia</span>` +
    `<span class="zBadge">${LANG==='fr'?'ZONE PAISIBLE':'PEACEFUL ZONE'}</span>` +
    `<span class="zreq" style="width:auto">${LANG==='fr'?'Aucun monstre':'No monsters'}</span>`;
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
      // une petite etiquette avec écris admin ici") -- purement client-side (isAdmin() + isCurrent,
      // aucune donnée serveur supplémentaire) : get_zone_player_counts ne renvoie QUE des compteurs
      // agrégés (voir l'audit de sécurité du 2026-07-14), jamais l'identité des joueurs par zone --
      // ne peut donc indiquer la présence admin QUE sur le propre client de l'admin, sur SA propre zone
      const adminHereTag = (typeof isAdmin === 'function' && isAdmin() && isCurrent)
        ? `<span class="zAdminTag" title="${LANG==='fr'?'Tu es ici (vue admin)':'You are here (admin view)'}">ADMIN</span>` : '';
      row.innerHTML =
        `<span class="zname">${tr(z.name)}</span>` +
        `<span class="zBadge ${b.cls}">${tr(b.txt.replace('ZONE ',''))}</span>` +
        `<span class="zreq"><span class="${apOk?'ok':'bad'}">${z.reqAP} PA</span> · <span class="${dpOk?'ok':'bad'}">${z.reqDP} PD</span></span>` +
        `<span class="zUpgradeIcon"${hasUpgrade?'':' style="visibility:hidden"'} title="${LANG==='fr'?'Meilleur stuff à trouver ici':'Better gear to find here'}">⬆️</span>` +
        `<span class="zPlayerCount"${pCount?'':' style="visibility:hidden"'} title="${LANG==='fr'?'Joueurs actuellement sur cette zone':'Players currently on this zone'}">👥 ${pCount}</span>` +
        adminHereTag +
        `<button class="zBtnView${previewed?' active':''}" title="${LANG==='fr'?'Voir le loot':'View loot'}">👁</button>`;
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
function updateZoneTitleText() {
  if (atVelia) {
    $('ztName').textContent = LANG==='fr' ? 'Velia' : 'Velia';
    $('ztTier').textContent = LANG==='fr' ? 'Zone paisible' : 'Peaceful zone';
  } else {
    $('ztName').textContent = tr(Z().name);
    $('ztTier').textContent = Z().tier;
  }
}
function travelTo(i) {
  atVelia = false;
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
// Velia : zone paisible, aucun monstre — ne lance plus le tutoriel automatiquement (voir
// demande du 2026-07-04), juste un endroit calme où se rendre (à la main ou après une mort)
function goToVelia() {
  atVelia = true;
  resetWorld();
  updateZoneTitleText();
  lootPreviewIdx = null;
  renderLootTable();
  hud();
  buildZoneList();
  renderEquipment(); // voir le commentaire équivalent dans travelTo()
}
// mort au combat (PV à 0) : renvoie à Velia (zone paisible) avec un message d'avertissement —
// demande explicite du 2026-07-05, remplace l'ancien "faint" qui soignait sur place. Ne renvoie
// PLUS de force vers Velia si le joueur a déjà changé de zone pendant le K.O. (2026-07-09, demande
// explicite : "à la fin du timer tu es renvoyé en ville SI tu n'as pas changé de zone entre temps")
function die() {
  const stayedPut = (zoneIdx === P.faintZoneIdx) && (atVelia === P.faintAtVelia);
  if (stayedPut) goToVelia();
  P.hp = effHpMax()*.5;
  S.lastDeathAt = Date.now(); // sert au bonus de zone des World Boss ("certifié sans mort 3 min", voir endBossFight)
  const banner = $('deathBanner');
  if (banner) {
    banner.textContent = stayedPut
      ? (LANG==='fr'
        ? '⚠ Les monstres t\'ont tué ! Choisis une zone plus adaptée à ton niveau ou améliore ton stuff.'
        : '⚠ The monsters killed you! Pick a zone better suited to your level or improve your gear.')
      : (LANG==='fr'
        ? '⚠ Tu t\'es relevé — tu as changé de zone pendant le K.O.'
        : '⚠ You got back up — you changed zone during the K.O.');
    banner.classList.add('show');
    clearTimeout(die._t);
    die._t = setTimeout(() => banner.classList.remove('show'), 6000);
  }
}

// mise à jour légère des chiffres uniquement (aucune reconstruction de DOM lourde) —
// utilisée pour les actions fréquentes comme les tentatives d'optimisation
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
  if (eqSumLvlEl) eqSumLvlEl.textContent = (LANG==='fr'?'Niv. ':'Lvl ') + S.lvl;
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
    apEl.textContent = LANG==='fr' ? '—' : '—'; apEl.className = 'v';
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
  if (mins > 2 && kpmNow > (S.bestKpm||0)) {
    // "pour le fun" (demande du 2026-07-08) : seuil de +0.5 kills/min pour ne pas spammer sur du bruit
    if (kpmNow - (S.bestKpm||0) > 0.5) logToDiscord('🏹 Record kills/min', `**${myPseudo||'Joueur'}** bat son record perso : **${kpmNow.toFixed(1)}** kills/min (${tr(Z().name)})`, 0xc9a55a);
    S.bestKpm = kpmNow;
  }
  $('shRate').textContent = mins>.1 ? fmt((S.tokenSilverEarned-(S.tokenSilverEarnedAtLoad||0))/(mins/60))+' silver/h' : '— silver/h';
  const zb = $('zoneBadge');
  if (atVelia) {
    zb.className = 'b-green'; zb.textContent = LANG==='fr'?'ZONE PAISIBLE':'PEACEFUL ZONE';
    $('ztReq').textContent = LANG==='fr' ? 'Aucun monstre' : 'No monsters';
  } else {
    const b = badgeOf(bottleneck());
    zb.className = b.cls; zb.textContent = tr(b.txt);
    // rend le danger tangible (2026-07-05, demande explicite) : rappel au survol de la pénalité de
    // vitesse (toi) / bonus de vitesse (monstres aggro) en zone dangereuse -- voir isZoneDangerous()
    zb.title = b.cls === 'b-red'
      ? (LANG==='fr' ? '⚠️ Zone trop dure pour ton stuff : tu es ralenti, les monstres qui t\'ont repéré sont plus rapides' : '⚠️ Zone too hard for your gear: you are slowed down, monsters that spotted you are faster')
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
  achievements: { v:1, desc:{fr:'Filtres par catégorie et "pas fini" disponibles',en:'Category and "unfinished" filters available'} },
};
function contentSeenKey(panel) { return 'velia-idle-seenv-'+panel; }
function contentLastSeenVersion(panel) {
  try { return parseInt(localStorage.getItem(contentSeenKey(panel))||'0', 10) || 0; } catch(e) { return 0; }
}
function contentIsUnread(panel) {
  const entry = CONTENT_UPDATE_VERSION[panel]; if (!entry) return false;
  return entry.v > contentLastSeenVersion(panel);
}
// à appeler à l'OUVERTURE de chaque panneau (après avoir déjà lu contentIsUnread pour l'affichage
// de cette ouverture précise) — le badge disparaît, mais la mise en évidence reste visible tant
// que le panneau affiché à l'écran ne s'est pas refermé/rouvert
function markContentSeen(panel) {
  const entry = CONTENT_UPDATE_VERSION[panel]; if (!entry) return;
  try { localStorage.setItem(contentSeenKey(panel), String(entry.v)); } catch(e) {}
  refreshContentNewBadges();
}
// callout affiché en haut du panneau tant qu'il n'a pas encore été ouvert depuis le changement
function contentChangeCalloutHtml(panel) {
  if (!contentIsUnread(panel)) return '';
  const entry = CONTENT_UPDATE_VERSION[panel]; if (!entry || !entry.desc) return '';
  return `<div class="contentNewCallout">🆕 ${escapeHtml(entry.desc[LANG]||entry.desc.fr)}</div>`;
}
function refreshContentNewBadges() {
  const map = { wiki:'newBadgeWiki', compendium:'newBadgeCompendium', codex:'newBadgeCodex', achievements:'newBadgeAchievements' };
  for (const key in map) {
    const el = $(map[key]); if (!el) continue;
    el.textContent = '1';
    el.classList.toggle('show', contentIsUnread(key));
  }
}

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
function syncFarmCardHeights() {
  const statsCard = $('statsCard');
  if (!statsCard) return;
  const targetH = statsCard.getBoundingClientRect().height;
  if (targetH < 50) return; // pas encore mis en page (ex: juste après le chargement)
  [['zonesCard','zoneList'], ['lootCard','lootTable']].forEach(([cardId, listId]) => {
    const card = $(cardId), list = $(listId);
    if (!card || !list) return;
    const overhead = card.getBoundingClientRect().height - list.getBoundingClientRect().height; // en-tête/onglets/marges
    const newListH = Math.max(80, Math.round(targetH - overhead));
    list.style.maxHeight = newListH + 'px';
  });
}
window.addEventListener('resize', () => { if (typeof syncFarmCardHeights === 'function') syncFarmCardHeights(); });
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
  $('potSlot').title = pot.name[LANG] + (potCostNow>0 ? ` — ${fmt(potCostNow)} silver/${LANG==='fr'?'usage':'use'} (+${Math.round(effHpMax()*pot.heal)} PV, ${Math.round(pot.heal*100)}%, CD ${pot.cd}s)` : (LANG==='fr'?` — gratuite (CD ${pot.cd}s)`:` — free (CD ${pot.cd}s)`)) +
    ' · ' + MANA_POTION.name[LANG] + ` — ${fmt(manaCostNow)} silver/${LANG==='fr'?'usage':'use'} (+${Math.round(MANA_POTION.restore*100)}% MP, CD ${MANA_POTION.cd}s, auto)`;
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
function loop(now) {
  const dt = Math.min(.05,(now-last)/1000); last = now;
  // le jeu ne se met plus en pause en arrière-plan (2026-07-14, demande explicite : "arrete de
  // mettre en pause le navigateur quand on change de fenetre") -- retire l'ancien "if
  // (document.hidden) return" (2026-07-06) qui gelait toute la simulation (farm/combat/loot) dès
  // que l'onglet perdait le focus, contraire à l'esprit "idle" du jeu. Le clamp dt (Math.min .05)
  // ci-dessus évite déjà tout saut de temps massif au retour sur l'onglet.
  // pendant un combat de boss (plein écran), on met le farm en pause : la salle de boss couvre
  // tout l'écran, inutile de continuer à simuler/dessiner la zone de farm derrière
  if (bossState.active) { requestAnimationFrame(loop); return; }
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

  render(now/1000);
  hudFast();
  requestAnimationFrame(loop);
}

// Inventaire/Equipement -- UI (paperdoll, grille, enchantement, auto-opti) -> voir inventory-ui.js (charge APRES boss.js, AVANT render.js -- voir index.html)
// ==================== SAUVEGARDE (prêt pour Supabase) ====================
// Rassemble tout l'état du joueur en un objet JSON sérialisable.
// C'est CE bloc qui doit être envoyé/lu depuis la table Supabase "game_saves".
function getSaveState() {
  return {
    version: 1,
    S: { ...S },
    EQUIP: JSON.parse(JSON.stringify(EQUIP)),
    INV: JSON.parse(JSON.stringify(INV)),
    COMPENDIUM_BAG: JSON.parse(JSON.stringify(COMPENDIUM_BAG)),
    zoneIdx,
    playerPos: { x: P.x, y: P.y },
    savedAt: new Date().toISOString(),
  };
}
function applySaveState(data) {
  if (!data || data.version !== 1) return false;
  Object.assign(S, data.S);
  // repart sur une base FRAÎCHE pour les stats de SESSION (silver/h, kills/min) — voir le
  // commentaire sur silverEarnedAtLoad/killsAtLoad plus haut ; corrige le faux positif anti-triche
  // du 2026-07-06 (silver_per_hour astronomique juste après le chargement d'une sauvegarde)
  S.startTime = performance.now();
  S.silverEarnedAtLoad = S.silverEarned || 0;
  S.tokenSilverEarnedAtLoad = S.tokenSilverEarned || 0;
  S.killsAtLoad = S.kills || 0;
  Object.keys(EQUIP).forEach(k => EQUIP[k] = data.EQUIP[k] ?? null);
  for (let i = 0; i < INV_SIZE; i++) INV[i] = data.INV[i] ?? null;
  // sac "Compendium" (2026-07-08) : absent des sauvegardes antérieures à cette version, ?? null
  // migre proprement les anciennes sauvegardes (toutes les cases restent vides, rien à perdre)
  for (let i = 0; i < INV_SIZE; i++) COMPENDIUM_BAG[i] = data.COMPENDIUM_BAG?.[i] ?? null;
  if (!S.migratedGearRebalanceV158) { migrateGearRebalanceV158(); S.migratedGearRebalanceV158 = true; }
  if (!S.migratedEarringRebalanceV175) { migrateEarringRebalanceV175(); S.migratedEarringRebalanceV175 = true; }
  if (!S.migratedArmorNoApV192) { migrateArmorNoApV192(); S.migratedArmorNoApV192 = true; }
  if (!S.migratedJewelryApV207) { migrateJewelryApV207(); S.migratedJewelryApV207 = true; }
  if (!S.migratedGearFixedStatsV226) { migrateGearFixedStatsV226(); S.migratedGearFixedStatsV226 = true; }
  if (!S.migratedGearRescaleV235) { migrateGearRescaleV235(); S.migratedGearRescaleV235 = true; }
  if (!S.migratedJewelryMatNameV239) { migrateJewelryMatNameV239(); S.migratedJewelryMatNameV239 = true; }
  if (!S.migratedGearRescaleV243) { migrateGearRescaleV243(); S.migratedGearRescaleV243 = true; }
  if (!S.migratedGearRescaleV245) { migrateGearRescaleV245(); S.migratedGearRescaleV245 = true; }
  zoneIdx = data.zoneIdx || 0;
  S.maxZoneIdx = Math.max(S.maxZoneIdx||0, zoneIdx); // rattrape les vieilles sauvegardes sans ce champ
  S.xpNext = xpNeededFor(S.lvl); // migre les anciennes sauvegardes (ancienne courbe ×1.35) vers la vraie table BDO
  if (!POTIONS[S.potionType]) S.potionType = 'medium'; // migre l'ancienne potion unique 'basic' vers les 4 tailles
  resetWorld(); // recrée les packs de la zone chargée
  updateZoneTitleText(); // voir son commentaire -- sans cet appel, le nom de zone affiché restait figé au placeholder HTML
  if (data.playerPos) { P.x = data.playerPos.x; P.y = data.playerPos.y; }
  hud();
  return true;
}
// Export manuel (bouton à brancher si besoin) : télécharge un .json local
function exportSaveToFile() {
  const blob = new Blob([JSON.stringify(getSaveState(), null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'velia-idle-save.json';
  a.click();
}
// Import manuel depuis un fichier .json choisi par le joueur
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
