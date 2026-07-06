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
// (voir zones-roadmap.md pour le détail des paliers futurs). Le "selon l'optimisation" vient
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
  { name:'Mine de Fer Abandonnée', tier:'Serendia — Mid', reqAP:124, reqDP:67, mob:'Mineur corrompu',
    hpPer:156, dmg:19, xp:90,
    // sol terre rouge/brune de carrière (retexturé le 2026-07-07 d'après les captures de référence :
    // canyon ocre, crevasses, chariots) — tones = capuches/tuniques poussiéreuses des mineurs,
    // alphaTone = armure de fer bleuté du boss de pack (voir drawMineurIso)
    tint:{ a:'#4a3226', b:'#443023', dry:'#583c2c' }, tones:['#8a7a68','#7a6c5a','#988676'], alphaTone:'#5a6068',
    loot:{ trash:{name:'Fer rouillé',val:39,ch:1}, mat:{name:'Pierre de Caphras',val:11,ch:.15},
      jackpot:{name:'Anneau Asula',val:8900,ch:.001,ap:2}, craft:{name:'Fragment de mémoire',ch:.009} } },
  { name:'Poste Helm', tier:'Serendia — Late', reqAP:152, reqDP:83, mob:'Soldat Helm',
    hpPer:233, dmg:29, xp:135,
    tint:{ a:'#403845', b:'#3a3340', dry:'#48404d' }, tones:['#6a5a80','#5c4e70','#786890'], alphaTone:'#3a2f52',
    loot:{ trash:{name:'Fourrure de Biraghi',val:56,ch:1}, mat:{name:'Pierre de Caphras',val:11,ch:.11},
      jackpot:{name:'Collier Asula',val:13000,ch:.0007,ap:4}, craft:{name:'Fragment de mémoire',ch:.007} } },
  { name:'Repaire Bandits Gahaz', tier:'Serendia — Late', reqAP:188, reqDP:103, mob:'Bandit Gahaz',
    hpPer:353, dmg:44, xp:200,
    tint:{ a:'#38452e', b:'#33402a', dry:'#3f4c33' }, tones:['#607a45','#546c3c','#6e8a50'], alphaTone:'#3c4e2a',
    loot:{ trash:{name:'Défense d\'orc',val:74,ch:1}, mat:{name:'Pierre de Caphras',val:9,ch:.08},
      jackpot:{name:'Ceinture Asula',val:17850,ch:.0005,ap:6}, craft:{name:'Fragment de mémoire',ch:.005} } },
  { name:'Sanctuaire Elric', tier:'Mediah — Early', reqAP:269, reqDP:148, mob:'Sectateur d\'Elric',
    hpPer:596, dmg:73, xp:300,
    tint:{ a:'#3d3545', b:'#383040', dry:'#453c4e' }, tones:['#7a6a9a','#6c5d8a','#8878aa'], alphaTone:'#4a3e62',
    // % de la "Pierre concentrée" (matériau réel dropé ici, voir tierMat dans rollDrops — le nom
    // 'Pierre de Caphras' ci-dessous n'est qu'un label hérité, jamais affiché) doublé le 2026-07-08 :
    // avec l'enchantement ralenti, ces 2 dernières zones sont désormais LA seule source de matériau
    // bleu, il en faut beaucoup plus pour pousser du stuff Grunil jusqu'à PRI+
    loot:{ trash:{name:'Éclat de relique ancienne',val:90,ch:1}, mat:{name:'Pierre de Caphras',val:7,ch:.12},
      jackpot:{name:'Anneau de Cadry',val:24200,ch:.0003,ap:6}, craft:{name:'Marbre du Dieu déchu',ch:.0035} } },
  // les 3 dernières zones du jeu (Kratuga/Mânes/Polly) étaient toutes identiques à 320/175
  // (plafond de fin de jeu) -- lissées le 2026-07-11 (demande explicite : "lisse les req des 3
  // dernière zone du jeu") en une montée linéaire depuis Sanctuaire Elric (269/148) jusqu'au même
  // plafond 320/175, désormais atteint seulement à la toute dernière zone (Forêt de Polly, inchangée)
  { name:'Ruines de Kratuga', tier:'Mediah — Early', reqAP:286, reqDP:157, mob:'Uluan',
    hpPer:894, dmg:110, xp:450,
    tint:{ a:'#4a3d30', b:'#44382c', dry:'#524436' }, tones:['#b09060','#a08252','#c0a070'], alphaTone:'#6e5636',
    loot:{ trash:{name:'Relique d\'Hystria',val:105,ch:1}, mat:{name:'Pierre de Caphras',val:6,ch:.09},
      jackpot:{name:'Serap\'s Necklace',val:29600,ch:.0002,ap:9}, craft:{name:'Marbre du Dieu déchu',ch:.0025} } },
  // 3e zone Grunil (2026-07-05, demande explicite : "ajoute Planque des Mânes dernière zone") —
  // complète la rotation d'arme (weapon/secondary/awakening, une par zone du palier — voir
  // ZONE_WEAPON_SLOTS) et apporte la ceinture manquante (Orkinrad's Belt). reqAP/reqDP lissés le
  // 2026-07-11 (voir commentaire sur Ruines de Kratuga juste au-dessus) — 1 palier intermédiaire
  // entre Kratuga (286/157) et le plafond final 320/175 (Forêt de Polly).
  { name:'Planque des Mânes', tier:'Mediah — Early', reqAP:303, reqDP:166, mob:'Esprit des Mânes',
    hpPer:1000, dmg:125, xp:500,
    tint:{ a:'#3a3f4a', b:'#343943', dry:'#40454f' }, tones:['#8a9ab0','#7c8ca2','#98a8c0'], alphaTone:'#4a5568',
    loot:{ trash:{name:'Larme de Mâne',val:120,ch:1}, mat:{name:'Pierre de Caphras',val:5,ch:.07},
      jackpot:{name:'Orkinrad\'s Belt',val:35000,ch:.00015,ap:10}, craft:{name:'Marbre du Dieu déchu',ch:.0018} } },
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
  { name:'Base de Bashim', tier:'Serendia — Late', reqAP:210, reqDP:114, mob:'Soldat de Bashim',
    hpPer:395, dmg:49, xp:224,
    tint:{ a:'#3c3c34', b:'#36362f', dry:'#44443a' }, tones:['#8a8a68', '#78785a', '#9a9a78'], alphaTone:'#565640',
    loot:{ trash:{name:'Insigne de Bashim',val:92,ch:1}, mat:{name:'Pierre de Caphras',val:8,ch:.058},
      jackpot:{name:'Boucle Asula',val:22300,ch:.00035,ap:9}, craft:{name:'Fragment de mémoire',ch:.003} } },
  { name:'Forêt de Polly', tier:'Mediah — Early', reqAP:320, reqDP:175, mob:'Troll de Polly',
    hpPer:1120, dmg:140, xp:560,
    tint:{ a:'#25382c', b:'#213228', dry:'#2c4034' }, tones:['#3f6e50', '#356045', '#4a805c'], alphaTone:'#274a34',
    loot:{ trash:{name:'Mousse de Polly',val:135,ch:1}, mat:{name:'Pierre de Caphras',val:4,ch:.055},
      jackpot:{name:'Tungrad\'s Earring',val:38500,ch:.00011,ap:11}, craft:{name:'Marbre du Dieu déchu',ch:.0013} } },
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
  bestKpm: 0, // record personnel de kills/min À VIE (voir refreshStatsOnly) — sert au classement "🏹 Record kills/min"
  maxZoneIdx: 0, playtimeSec: 0, lootByItem: {},
  enhAttempts: 0, travelCount: 0, jackpotCount: 0, gearDropCount: 0, enhSuccess: 0,
  achUnlocked: {}, dq: null, wq: null, questTrackerOn: false,
  loyalty: 0, lastLoyaltyDate: null, mailbox: [],
  notifLog: [], // centre de notifications (2026-07-08) : persisté (survit au reload/reconnexion), auto-purgé après 7 jours (voir pruneNotifLog)
  lastDeathAt: 0, // horodatage de la dernière mort — 0 = jamais mort (voir endBossFight, bonus "certifié sans mort")
  potionType: 'medium', // 'small'/'medium'/'large'/'mega' = potions payantes ; 'infinite' = gratuite (débloquée plus tard)
  farmMode: 'loot', // 'loot' = ramasse tout avant le pack suivant ; 'xp' = enchaîne les packs sans se soucier du loot
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

// ---- 2e équipement : outils de lifeskill (icônes SVG originales, même style que ICO_*) ----
// pas encore de système de récolte/pêche en jeu — ces emplacements sont préparés à l'avance,
// vides pour l'instant, en attendant du contenu (voir demande utilisateur du 2026-07-04)
const ICO_SKINNING = svgIcon('<path d="M4 18l11-11 3 3-11 11z" fill="#c9c9c9"/><path d="M15 7l3 3-2 2-3-3z" fill="#8a6a3a"/>');
const ICO_PICKAXE  = svgIcon('<path d="M4 8c4-4 12-4 16 0l-3 3C14 8 10 8 7 11z" fill="#9aa5b1"/><rect x="10.5" y="9" width="3" height="13" rx="1" fill="#8a6a3a"/>');
const ICO_AXE      = svgIcon('<path d="M6 4c4 0 7 3 7 7l-4 4C5 15 3 11 3 7z" fill="#9aa5b1"/><rect x="11" y="9" width="3" height="13" rx="1" fill="#8a6a3a"/>');
const ICO_FLUID    = svgIcon('<rect x="9" y="3" width="6" height="6" rx="1" fill="#8cc8ff"/><rect x="10.5" y="8" width="3" height="12" rx="1" fill="#c9c9c9"/><rect x="8" y="19" width="8" height="2.5" rx="1" fill="#6b7480"/>');
const ICO_HOE      = svgIcon('<rect x="10.5" y="4" width="3" height="14" rx="1" fill="#8a6a3a"/><rect x="5" y="17" width="14" height="3" rx="1" fill="#9aa5b1"/>');
const ICO_TANNING  = svgIcon('<path d="M4 18l11-11 3 3-11 11z" fill="#e0bc72"/><path d="M15 7l3 3-2 2-3-3z" fill="#6b4f28"/>');
const ICO_FLOAT    = svgIcon('<ellipse cx="12" cy="10" rx="5" ry="6" fill="#e05a4e"/><ellipse cx="12" cy="15" rx="5" ry="5" fill="#f4efe0"/>');
const ICO_ROD      = svgIcon('<path d="M4 20l14-16" stroke="#8a6a3a" stroke-width="2" fill="none"/><path d="M18 4c1.5 1.5 1.5 4 0 5" stroke="#c9c9c9" stroke-width="1.2" fill="none"/>');
const LIFESKILL_LABEL = {
  skinning:{fr:'Couteau à dépecer',en:'Skinning Knife'}, pickaxe:{fr:'Pioche',en:'Pickaxe'},
  axe:{fr:'Hache',en:'Axe'}, fluid:{fr:'Seringue (collecteur de fluide)',en:'Fluid Collector'},
  hoe:{fr:'Houe',en:'Hoe'}, tanning:{fr:'Couteau de tanneur',en:'Tanning Knife'},
  float:{fr:'Flotteur',en:'Float'}, rod:{fr:'Canne à pêche',en:'Fishing Rod'},
};
const LIFESKILL_ICON = { skinning:ICO_SKINNING, pickaxe:ICO_PICKAXE, axe:ICO_AXE, fluid:ICO_FLUID,
  hoe:ICO_HOE, tanning:ICO_TANNING, float:ICO_FLOAT, rod:ICO_ROD };
const LIFESKILL_TOOL_SLOTS = ['skinning','pickaxe','axe','fluid','hoe','tanning'];
const LIFESKILL_FISHING_SLOTS = ['float','rod'];
const LIFESKILL_EQUIP = { skinning:null, pickaxe:null, axe:null, fluid:null, hoe:null, tanning:null, float:null, rod:null };

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
    if (slot) { slot.qty += obj.qty; return true; }
  }
  const idx = INV.findIndex(s => s === null);
  if (idx === -1) return false; // inventaire plein
  // horodatage d'entrée dans le sac (2026-07-09, demande explicite) -- sert à détecter un meilleur
  // stuff laissé sans y toucher plus de 15s (voir hasNeglectedUpgradeInBag) ; ne l'écrase pas si
  // déjà présent (ex: un objet qui revient dans le sac après un déséquipement garde sa date d'origine)
  INV[idx] = { pickedAt: Date.now(), ...obj };
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

// ---------- 2e équipement : lifeskill (outils de collecte + pêche) ----------
// pas de source en jeu pour l'instant (aucune récolte/pêche implémentée) — ces emplacements
// sont préparés à l'avance ; les accessoires de combat sont juste rappelés ici en lecture
// seule (dans le vrai jeu ce sont les MÊMES bagues/boucles/collier/ceinture qui comptent
// pour le lifeskill, il n'y a pas de second jeu d'accessoires séparé)
function renderLifeskillSlot(icon, label, item) {
  return `<div class="lsSlot${item?' filled':' empty'}" title="${item ? tr(item.name) : label}">${item ? item.icon : icon}</div>`;
}
function renderLifeskillPanelHtml() {
  const toolsHtml = LIFESKILL_TOOL_SLOTS.map(k => renderLifeskillSlot(LIFESKILL_ICON[k], LIFESKILL_LABEL[k][LANG], LIFESKILL_EQUIP[k])).join('');
  const accHtml = ACC_SLOTS.map(k => renderLifeskillSlot(SLOT_ICON[k], SLOT_LABEL[k], EQUIP[k])).join('');
  const fishHtml = LIFESKILL_FISHING_SLOTS.map(k => renderLifeskillSlot(LIFESKILL_ICON[k], LIFESKILL_LABEL[k][LANG], LIFESKILL_EQUIP[k])).join('');
  return `
    <h3>${LANG==='fr'?'🛠️ Outils de collecte':'🛠️ Gathering tools'}</h3>
    <div class="lsGrid">${toolsHtml}</div>
    <h3>${LANG==='fr'?'💍 Accessoires équipés':'💍 Equipped accessories'}</h3>
    <div class="lsGrid">${accHtml}</div>
    <h3>${LANG==='fr'?'🎣 Pêche':'🎣 Fishing'}</h3>
    <div class="lsGrid">${fishHtml}</div>
    <div class="admSummary">${LANG==='fr'
      ? 'Aucun outil de lifeskill ne se trouve encore en jeu — ces emplacements sont prêts pour une future mise à jour (récolte, pêche...).'
      : 'No lifeskill tools can be found in-game yet — these slots are ready for a future update (gathering, fishing...).'}</div>
  `;
}
function openLifeskillPanel() {
  openInfo(LANG==='fr' ? '⛏️ Équipement Lifeskill' : '⛏️ Lifeskill Gear', renderLifeskillPanelHtml());
}

// ==================== WORLD BOSS ====================
// Bosses implémentés dans le jeu : Kzarka (quotidien) et Vell (hebdomadaire, ajouté le 2026-07-08).
// Les horaires suivent ceux du vrai BDO MOINS 15 minutes (demande utilisateur) ; ils sont exprimés
// en heure LOCALE du joueur pour rester simples, et le boss "in-game" se combat en 2 à 7 minutes
// selon ton stuff (voir startBossFight).
const BOSS_ROSTER = {
  kzarka: {
    name:{fr:'Grand Seigneur de guerre de la corruption',en:'Great Warlord of Corruption'},
    short:{fr:'Seigneur de guerre',en:'Warlord'}, icon:'👹', color:'#7a2d33',
    hp: 400000,          // calibré pour ~5 min à PA "adaptée" (~250), clampé à [2,7] min
    reward: 250000,      // silver de victoire
    matKey:'mat_Pierre noire', matName:'Pierre noire', matIcon:ICO_MAT_NOIRE, matQty:[8,20],
  },
  // Vell : grand poisson/serpent des mers, boss hebdomadaire (bien plus rare que Kzarka dans le
  // vrai jeu) — silhouette originale provisoire en attendant la photo de référence promise par
  // l'utilisateur (sera affinée ensuite, voir drawVell). Plus coriace et plus payant que Kzarka
  // pour refléter sa rareté hebdomadaire.
  vell: {
    name:{fr:'Vell, la Terreur des Flots',en:'Vell, Terror of the Tides'},
    short:{fr:'Vell',en:'Vell'}, icon:'🐋', color:'#2a5a78',
    hp: 550000,
    reward: 400000,
    matKey:'mat_Pierre noire', matName:'Pierre noire', matIcon:ICO_MAT_NOIRE, matQty:[12,28],
    // Coeur de Vell (2026-07-08) : 5% de chance à la victoire — visible sur la roue de récompense
    // en fin de combat (voir endBossFight/renderBossRewardWheel), qu'on l'obtienne ou non.
    rareLoot: { name:'Coeur de Vell', icon:ICO_COEUR_VELL, color:'#5ec9e8', ch:0.05 },
  },
};
// horaires hebdomadaires (heure locale, déjà "-15 min") — day: 0=dimanche..6=samedi, ou 'daily'
// (Kzarka apparaît plusieurs fois par jour dans le vrai jeu ; sélection resserrée ici).
// Vell (2026-07-08) : hebdomadaire seulement, jeudi + dimanche d'après le planning cité par
// l'utilisateur (garmoth.com) — jeudi 12h15 → 12h00, dimanche 17h00 → 16h45 une fois le "-15min" appliqué.
const BOSS_SCHEDULE = [
  { boss:'kzarka', day:'daily', h:12, m:45 },
  { boss:'kzarka', day:'daily', h:19, m:45 },
  { boss:'kzarka', day:'daily', h:23, m:45 },
  { boss:'kzarka', day:0,       h:15, m:45 },
  { boss:'kzarka', day:6,       h:15, m:45 },
  { boss:'vell',   day:4,       h:12, m:0  },
  { boss:'vell',   day:0,       h:16, m:45 },
];
const BOSS_WINDOW_MS = 9 * 60 * 1000; // fenêtre pendant laquelle le boss reste combattable après spawn (demande du 2026-07-06)

// décalage UTC actuel de Paris, en minutes (ex: +60 en hiver/CET, +120 en été/CEST) — calculé via
// Intl plutôt que codé en dur pour suivre automatiquement les changements d'heure
function parisOffsetMinutes(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone:'Europe/Paris',
    hour12:false, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit'
  }).formatToParts(date).map(p => [p.type, p.value]));
  const asUTC = Date.UTC(+parts.year, +parts.month-1, +parts.day, parts.hour==='24'?0:+parts.hour, +parts.minute, +parts.second);
  return Math.round((asUTC - date.getTime()) / 60000);
}
// prochaine occurrence (ou occurrence en cours) de chaque entrée du planning, sur 7 jours glissants
// — les horaires de BOSS_SCHEDULE sont ceux de garmoth.com, donc de l'heure FRANÇAISE (Europe/Paris),
// pas l'heure locale du navigateur du joueur (2026-07-08 : bug corrigé, un joueur hors de France
// voyait un planning décalé de son propre fuseau)
function bossOccurrences(fromDate) {
  const now = fromDate.getTime();
  const offsetMin = parisOffsetMinutes(fromDate);
  const parisParts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone:'Europe/Paris',
    year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(fromDate).map(p => [p.type, p.value]));
  const baseY = +parisParts.year, baseM = +parisParts.month-1, baseD = +parisParts.day;
  const list = [];
  for (const entry of BOSS_SCHEDULE) {
    for (let d = -1; d <= 7; d++) {
      const dow = new Date(Date.UTC(baseY, baseM, baseD+d)).getUTCDay(); // jour de la semaine à Paris
      if (entry.day !== 'daily' && dow !== entry.day) continue;
      const t = Date.UTC(baseY, baseM, baseD+d, entry.h, entry.m, 0, 0) - offsetMin*60000;
      if (t + BOSS_WINDOW_MS < now) continue; // déjà terminé
      list.push({ boss:entry.boss, time:t, live: t <= now && now < t + BOSS_WINDOW_MS });
    }
  }
  return list.sort((a,b) => a.time - b.time);
}
// boss "global" déclenché par l'admin pour TOUS les joueurs (état partagé via Supabase, table
// live_boss). Prioritaire sur le planning horaire : s'il est actif, il apparaît comme "EN COURS"
// pour tout le monde. Rafraîchi périodiquement (voir refreshLiveBoss).
let liveBoss = null; // { boss, time, expires } quand un spawn global est en cours
async function refreshLiveBoss() {
  if (!sb) return;
  const wasLive = !!(liveBoss && liveBoss.expires > Date.now());
  try {
    // ensure_scheduled_boss vérifie CÔTÉ SERVEUR si une occurrence du planning (Kzarka) doit être
    // en cours maintenant et, si oui, s'assure que live_boss la reflète (sans écraser un spawn admin
    // déjà actif) — rend le boss du planning RÉELLEMENT partagé (PV communs, tout le monde se voit
    // dans l'arène) au lieu d'une instance solo par joueur. Demande explicite du 2026-07-06.
    // Retombe sur une simple lecture si l'appel échoue, pour ne jamais bloquer l'affichage du lobby.
    let data = null;
    try {
      const r = await sb.rpc('ensure_scheduled_boss');
      data = Array.isArray(r.data) ? r.data[0] : r.data;
    } catch (e) {}
    if (!data) {
      const r = await sb.from('live_boss').select('boss_id, spawned_at, expires_at, hp, max_hp').eq('id', 1).maybeSingle();
      data = r.data;
    }
    if (data && data.boss_id && BOSS_ROSTER[data.boss_id] && new Date(data.expires_at).getTime() > Date.now()) {
      liveBoss = { boss: data.boss_id, time: new Date(data.spawned_at).getTime(), expires: new Date(data.expires_at).getTime(),
                   hp: Number(data.hp||0), maxHp: Number(data.max_hp||0) };
    } else liveBoss = null;
  } catch (e) {}
  updateNextBossMini();
  // si le statut "en cours" a changé pendant qu'un joueur regarde le lobby (sans être en plein
  // combat), on re-render le lobby pour que le bouton "Combattre" apparaisse/disparaisse tout seul
  const nowLive = !!(liveBoss && liveBoss.expires > Date.now());
  const room = $('bossRoom');
  if (nowLive !== wasLive && room && room.classList.contains('open') && room.classList.contains('lobby') && !bossState.active) {
    $('bossLobbyBody').innerHTML = renderBossLobbyHtml();
    wireBossLobby();
  }
}
function nextBossOccurrence() {
  // un spawn global admin encore valide passe avant tout
  if (liveBoss && liveBoss.expires > Date.now()) return { boss: liveBoss.boss, time: liveBoss.time, live: true, sharedHp: true };
  const occ = bossOccurrences(new Date());
  return occ.find(o => o.live) || occ[0] || null;
}
function fmtBossCountdown(ms) {
  let s = Math.max(0, Math.floor(ms/1000));
  const h = Math.floor(s/3600); s -= h*3600;
  const m = Math.floor(s/60); s -= m*60;
  const pad = n => String(n).padStart(2,'0');
  return (h>0 ? pad(h)+':' : '') + pad(m)+':'+pad(s);
}
// petit rappel dans la barre d'activités, mis à jour chaque seconde
function updateNextBossMini() {
  const el = $('nextBossMini'); if (!el) return;
  const occ = nextBossOccurrence();
  if (!occ) { el.innerHTML = ''; return; }
  const b = BOSS_ROSTER[occ.boss];
  if (occ.live) {
    el.innerHTML = `<span class="live">${b.icon} ${b.short[LANG]} ${LANG==='fr'?'EN COURS':'LIVE'}</span>`;
  } else {
    el.innerHTML = `${LANG==='fr'?'Prochain boss':'Next boss'} : <b>${b.icon} ${b.short[LANG]}</b> ${LANG==='fr'?'dans':'in'} <b>${fmtBossCountdown(occ.time - Date.now())}</b>`;
  }
}

// liste des "pages" affichée en header au-dessus du jeu (demande utilisateur) : Zone / Boss +
// activités verrouillées en teaser. Cliquer une page bascule la vue du jeu.
const ACTIVITY_TABS = [
  { id:'zone', icon:'⚔️', name:{fr:'Zone',en:'Zone'},       locked:false },
  { id:'boss', icon:'🐍', name:{fr:'Boss',en:'Boss'},       locked:false },
  { id:'fish', icon:'🎣', name:{fr:'Pêche',en:'Fishing'},   locked:true },
  { id:'mine', icon:'⛏️', name:{fr:'Mine',en:'Mining'},     locked:true },
  { id:'forest', icon:'🌲', name:{fr:'Forêt',en:'Forest'},  locked:true },
  { id:'field', icon:'🌾', name:{fr:'Champs',en:'Fields'},  locked:true },
  { id:'ranch', icon:'🐑', name:{fr:'Bergerie',en:'Ranch'}, locked:true },
  { id:'workshop', icon:'🏛️', name:{fr:'Atelier royal',en:'Royal Workshop'}, locked:true },
];
let currentActivity = 'zone';
function renderActivityTabs() {
  const el = $('activityTabs'); if (!el) return;
  el.innerHTML = ACTIVITY_TABS.map(t =>
    `<button class="actTab${t.locked?' locked':''}${t.id===currentActivity?' active':''}" data-id="${t.id}"${t.locked?' disabled':''}>${t.icon} ${t.name[LANG]}${t.locked?' 🔒':''}</button>`).join('');
  el.querySelectorAll('.actTab').forEach(btn => {
    if (btn.classList.contains('locked')) return;
    btn.onclick = () => showActivityPage(btn.dataset.id);
  });
}
// affiche/masque la vue "farm" (canvas + panneaux) — le header (barre d'activités) n'est
// JAMAIS masqué : le boss s'insère juste en dessous, dans le flux du jeu
function setFarmViewVisible(v) {
  ['gameFrame','panel','itemPop','itemTooltip'].forEach(id => {
    const el = $(id); if (el) el.style.display = v ? '' : 'none';
  });
}
function showActivityPage(id) {
  if (id === 'boss') {
    currentActivity = 'boss';
    setFarmViewVisible(false);
    if (!bossState.active) openBossLobby();
  } else { // zone = retour au farm
    currentActivity = 'zone';
    if (!bossState.active) $('bossRoom').classList.remove('open');
    setFarmViewVisible(true);
  }
  renderActivityTabs();
}

// affiche la page Boss (lobby) : prochain boss + calendrier, dans la colonne du jeu, pleine hauteur
async function openBossLobby() {
  $('bossRoom').classList.remove('fight'); $('bossRoom').classList.add('lobby', 'open');
  // rafraîchit d'abord l'état du boss global (spawn admin) pour que la page reflète tout de suite
  // ce que voit le serveur, sans attendre le prochain tick de polling (20 s)
  await refreshLiveBoss();
  $('bossLobbyBody').innerHTML = renderBossLobbyHtml();
  wireBossLobby();
}
function renderBossLobbyHtml() {
  const occ = nextBossOccurrence();
  const now = Date.now();
  let nextHtml = `<div class="admEmpty">${LANG==='fr'?'Aucun boss programmé':'No boss scheduled'}</div>`;
  if (occ) {
    const b = BOSS_ROSTER[occ.boss];
    const cd = occ.live
      ? `<div class="bossNextCountdown live">${LANG==='fr'?'EN COURS':'LIVE'}</div>`
      : `<div class="bossNextCountdown" id="bossPanelCountdown">${fmtBossCountdown(occ.time - now)}</div>`;
    const when = new Date(occ.time).toLocaleString(LANG==='fr'?'fr-FR':'en-US', { weekday:'long', hour:'2-digit', minute:'2-digit' });
    nextHtml = `<div class="bossNext">
      <div class="bossNextIcon">${b.icon}</div>
      <div class="bossNextInfo">
        <div class="bossNextName">${b.name[LANG]}</div>
        <div class="bossNextTime">${occ.live ? (LANG==='fr'?'Disponible maintenant !':'Available now!') : when}</div>
      </div>
      ${cd}
    </div>
    <button class="bossFightBtn" id="bossFightBtn" ${occ.live?'':'disabled'}>${occ.live?(LANG==='fr'?'⚔️ Combattre':'⚔️ Fight'):(LANG==='fr'?'⏳ Pas encore apparu':'⏳ Not spawned yet')}</button>`;
  }
  // VRAI calendrier hebdomadaire : grille jours (colonnes) × heures de spawn (lignes), le nom du
  // boss dans chaque case. Seuls les boss implémentés (BOSS_ROSTER) apparaissent.
  const weekOcc = bossOccurrences(new Date()).filter(o => o.time < now + 7*24*3600*1000);
  const dayKey = d => d.getFullYear()+'-'+d.getMonth()+'-'+d.getDate();
  const todayKey = dayKey(new Date());
  // colonnes : aujourd'hui + 6 jours
  const days = [];
  for (let i=0;i<7;i++){ const d=new Date(); d.setDate(d.getDate()+i); d.setHours(0,0,0,0); days.push(d); }
  // lignes : heures de spawn distinctes de la semaine, triées
  const timeSet = new Set();
  weekOcc.forEach(o => { const d=new Date(o.time); timeSet.add(String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')); });
  const times = [...timeSet].sort();
  const cellMap = new Map();
  weekOcc.forEach(o => { const d=new Date(o.time); cellMap.set(dayKey(d)+'@'+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'), o); });
  let calHtml;
  if (!times.length) {
    calHtml = `<div class="admEmpty">${LANG==='fr'?'Rien de programmé':'Nothing scheduled'}</div>`;
  } else {
    calHtml = `<div class="bossCal" style="grid-template-columns:44px repeat(7,1fr)">`;
    calHtml += `<div class="bcCorner"></div>`;
    days.forEach(d => { const today = dayKey(d)===todayKey;
      calHtml += `<div class="bcHead${today?' bcToday':''}">${d.toLocaleDateString(LANG==='fr'?'fr-FR':'en-US',{weekday:'short'})}<span class="bcDate">${d.getDate()}/${d.getMonth()+1}</span></div>`; });
    times.forEach(tm => {
      calHtml += `<div class="bcTime">${tm}</div>`;
      days.forEach(d => {
        const o = cellMap.get(dayKey(d)+'@'+tm);
        if (o) { const b=BOSS_ROSTER[o.boss];
          calHtml += `<div class="bcCell${o.live?' bcLive':''}" title="${b.name[LANG]}">${b.icon}<span class="bcName">${o.live?(LANG==='fr'?'EN COURS':'LIVE'):b.short[LANG]}</span></div>`; }
        else calHtml += `<div class="bcCell bcEmpty"></div>`;
      });
    });
    calHtml += `</div>`;
  }
  // légende des boss (nom complet)
  const legend = Object.values(BOSS_ROSTER).map(b => `<span class="bcLegend">${b.icon} ${b.name[LANG]}</span>`).join('');
  return `${nextHtml}
    <h3>${LANG==='fr'?'📅 Calendrier de la semaine':'📅 Weekly calendar'}</h3>
    ${calHtml}
    <div class="bcLegendRow">${legend}</div>
    <div class="admSummary">${LANG==='fr'?'Horaires calqués sur le vrai BDO −15 min. Heure locale.':'Times mirror real BDO −15 min. Local time.'}</div>`;
}
function wireBossLobby() {
  const btn = $a('bossFightBtn');
  const occ = nextBossOccurrence();
  if (btn && !btn.disabled && occ) btn.onclick = () => startBossFight(occ.boss, !!occ.sharedHp);
}

// ---- combat de boss : plein écran, canvas dédié, boucle rAF indépendante du farm ----
const bossState = { active:false, boss:null, hp:0, maxHp:0, duration:0, elapsed:0, playerHp:0, playerHpMax:0, hits:[], last:0, raf:0, potCd:0, ended:false,
  px:0.5, py:0.85, pillars:[], aoePhase:'idle', aoeT:0, aoeInterval:9, blocked:false, blockFlash:0, hurtFlash:0, floatMsgs:[],
  // ---- world boss PARTAGÉ (spawn admin) : PV communs à tous, contribution reportée au serveur ----
  shared:false, expiresAt:0, contribAccum:0, contribCd:0, topCd:0, topList:[], myDmg:0, activeFighters:0, presenceCd:0,
  // ---- effet de profondeur/immersion ("4D") : tremblement d'écran + braises de corruption en parallaxe ----
  shakeT:0, embers:[] };
// ---- présence en direct des autres joueurs dans la salle de boss PARTAGÉ (Supabase Realtime,
// pas de table nécessaire) : chaque joueur diffuse sa position normalisée dans l'arène, on
// affiche les autres comme de petites silhouettes + pseudo — demande explicite : "tous les
// joueurs doivent se voir dans la zone du boss", pas juste un classement textuel
let bossChannel = null;
let otherFighters = {}; // uid -> { pseudo, px, py } — dernière position BRUTE reçue via Presence
let otherFightersPos = {}; // uid -> { x, y } — position lissée affichée à l'écran (voir bossLoop)
// traces de diagnostic (2026-07-08, demande explicite : "les joueurs ne se voient pas en world
// boss") : le partage des PV/top10 fonctionne (confirmé), donc le souci se situe précisément dans
// ce canal de présence Realtime — ces logs préfixés [BossPresence] permettent de vérifier, la
// prochaine fois que ça se reproduit, si les 2 joueurs rejoignent bien le MÊME topic, si le
// statut passe à SUBSCRIBED, et si l'event 'sync' renvoie bien l'autre joueur
function joinBossChannel(bossKey) {
  leaveBossChannel();
  if (!sb || !currentUser) { console.debug('[BossPresence] abandon (pas de sb ou pas connecté)'); return; }
  const myUid = currentUser.id;
  const topic = 'boss_'+bossKey;
  console.debug('[BossPresence] join', { topic, myUid });
  const ch = sb.channel(topic, { config: { presence: { key: myUid } } });
  bossChannel = ch;
  ch.on('presence', { event: 'sync' }, () => {
    const state = ch.presenceState();
    console.debug('[BossPresence] sync', { topic, keys: Object.keys(state) });
    const next = {};
    for (const uid in state) {
      if (uid === myUid) continue;
      const entry = state[uid] && state[uid][0];
      if (entry) next[uid] = entry;
    }
    otherFighters = next;
  });
  ch.subscribe(status => {
    console.debug('[BossPresence] status', { topic, status });
    if (status === 'SUBSCRIBED') { ch.track({ pseudo: myPseudo || 'Joueur', px: bossState.px, py: bossState.py }); return; }
    // reconnexion automatique (2026-07-08, bug confirmé en prod : le canal passe parfois à CLOSED
    // tout seul — coupure réseau/Realtime — sans qu'aucun code du jeu ne l'ait fermé, et rien ne le
    // rétablissait ensuite, laissant les joueurs invisibles les uns aux autres pour le reste du
    // combat) : si CE canal est toujours celui en cours d'utilisation et que le combat partagé est
    // toujours actif, on retente un rejoin après un court délai
    if ((status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && bossChannel === ch) {
      console.debug('[BossPresence] reconnexion programmée', { topic, status });
      setTimeout(() => { if (bossChannel === ch && bossState.active && bossState.shared) joinBossChannel(bossKey); }, 1500);
    }
  });
}
function leaveBossChannel() {
  if (bossChannel) console.debug('[BossPresence] leave', { topic: bossChannel.topic });
  if (bossChannel && sb) { try { sb.removeChannel(bossChannel); } catch(e) {} }
  bossChannel = null;
  otherFighters = {};
  otherFightersPos = {};
}
// 4 piliers de la salle (coords normalisées 0..1) — on se cache DERRIÈRE (en dessous) pour éviter l'AoE
const BOSS_PILLARS = [{x:.28,y:.44},{x:.72,y:.44},{x:.28,y:.72},{x:.72,y:.72}];
// 10 spots fixes où chaque joueur "attaque" (2026-07-08, demande explicite : "prévoir une dizaine
// de spot fixe pour les joueurs... les joueurs vont arriver aléatoirement dans une des zones
// prévues et se voir") — remplace l'ancien BOSS_ATTACK_POS unique où tout le monde se superposait
// exactement au même endroit ; chaque joueur pioche un spot au hasard au début du combat (voir
// startBossFight) et y revient entre deux AoE, ce qui les répartit visiblement dans l'arène tout en
// restant à portée pour la stratégie commune (esquive vers le pilier/l'ancre le plus proche)
const BOSS_SPOTS_KZARKA = [
  {x:.18,y:.58},{x:.50,y:.52},{x:.82,y:.58},
  {x:.28,y:.66},{x:.72,y:.66},
  {x:.14,y:.76},{x:.38,y:.80},{x:.50,y:.84},{x:.62,y:.80},{x:.86,y:.76},
];
// Vell : les joueurs sont sur les pontons des 2 bateaux (demande explicite du 2026-07-08), 5 spots
// par bateau échelonnés le long du pont, pas dans l'eau
const BOSS_SPOTS_VELL = [
  {x:.06,y:.86},{x:.11,y:.89},{x:.16,y:.92},{x:.09,y:.95},{x:.14,y:.97},
  {x:.94,y:.86},{x:.89,y:.89},{x:.84,y:.92},{x:.91,y:.95},{x:.86,y:.97},
];
function bossAttackSpots(bossId) { return bossId === 'vell' ? BOSS_SPOTS_VELL : BOSS_SPOTS_KZARKA; }
const bossCtx = document.getElementById('bossCv').getContext('2d');
// DPS nominal ≈ PA effective × somme(dmg/cd des sorts) ; sert à calculer une durée dans [2,9] min.
// SKILLS étant déclaré plus bas dans le fichier, la somme est calculée paresseusement (au 1er appel)
// pour éviter une erreur TDZ au chargement.
let _skillDpsSum = 0;
// DPS de référence pour un joueur à PA "adaptée" (~250) : sert à calibrer les PV du boss partagé
// (400000 PV / 300s = ~5 min pour ce stuff, cf commentaire du roster) sans dépendre du stuff de l'admin
const BOSS_REF_DPS = 1333;
function playerBossDps() {
  if (!_skillDpsSum) _skillDpsSum = SKILLS.filter(s => s.dmg).reduce((a,s) => a + s.dmg/s.cd, 0);
  return Math.max(1, apEff() * _skillDpsSum);
}
function startBossFight(bossId, isShared) {
  const b = BOSS_ROSTER[bossId];
  // boss PARTAGÉ (spawn admin, PV communs) : les PV/durée viennent du serveur (liveBoss), pas du stuff perso
  const shared = !!isShared && liveBoss && liveBoss.expires > Date.now();
  const hp = shared ? liveBoss.hp : b.hp;
  const maxHp = shared ? liveBoss.maxHp : b.hp;
  const rawDur = b.hp / playerBossDps();           // durée "naturelle" selon ton stuff (boss solo uniquement)
  const duration = Math.max(120, Math.min(420, rawDur)); // clampée à [2 min, 7 min]
  // Vell (2026-07-08, demande explicite) : les joueurs sont SUR les bateaux — les abris ne sont
  // plus des piliers de pierre mais les ancres des 2 bateaux, on plonge dessous pour se protéger
  const spots = bossId === 'vell' ? VELL_ANCHORS : BOSS_PILLARS;
  // spot d'attaque personnel, tiré au hasard parmi les 10 spots fixes (voir BOSS_SPOTS_KZARKA /
  // BOSS_SPOTS_VELL) — le joueur y apparaît directement et y revient entre deux AoE, ce qui
  // répartit visiblement tout le monde dans l'arène au lieu de s'empiler au même endroit
  const atkSpots = bossAttackSpots(bossId);
  const atkPos = { ...atkSpots[Math.floor(Math.random()*atkSpots.length)] };
  Object.assign(bossState, {
    active:true, ended:false, boss:b, bossId, hp, maxHp, duration, elapsed:0,
    playerHp: effHpMax(), playerHpMax: effHpMax(), hits:[], last:performance.now(), potCd:0,
    px:atkPos.x, py:atkPos.y, atkPos, pillars:spots.map(p=>({...p})), aoePhase:'idle', aoeT:0, aoeInterval:8,
    blocked:false, blockFlash:0, hurtFlash:0, floatMsgs:[],
    shared, expiresAt: shared ? liveBoss.expires : 0, contribAccum:0, contribCd:0, topCd:0, topList:[], myDmg:0, activeFighters:0,
    shakeT:0, embers:[],
  });
  currentActivity = 'boss'; renderActivityTabs();
  setFarmViewVisible(false);
  $('bossRoom').classList.remove('lobby'); $('bossRoom').classList.add('open', 'fight');
  $('bossResult').classList.remove('show');
  $('bossName').textContent = b.name[LANG] + (shared ? ' 🌐' : '');
  $('bossTopPanel').classList.toggle('show', shared);
  if (shared) { refreshBossTop(); joinBossChannel(liveBoss.time); } else { leaveBossChannel(); }
  resizeBossCanvas();
  bossState.raf = requestAnimationFrame(bossLoop);
}
// classement de contribution en direct (top 10 affiché en %, avec un point vert pour les joueurs
// actuellement en train de taper) + compteur "X joueurs combattent en direct" — demande explicite :
// "les joueurs doivent se voir et voir le top 10 de degats en % en direct"
async function refreshBossTop() {
  if (!sb || !bossState.shared) return;
  try {
    const [{ data }, { data: activeCount }] = await Promise.all([
      sb.rpc('boss_top'), sb.rpc('boss_active_count'),
    ]);
    bossState.topList = data || [];
    bossState.activeFighters = typeof activeCount === 'number' ? activeCount : 0;
    renderBossTop();
  } catch (e) {}
}
function renderBossTop() {
  const el = $('bossTopList'); if (!el) return;
  const liveEl = $('btpLiveCount');
  if (liveEl) {
    const n = bossState.activeFighters || 0;
    liveEl.textContent = n > 0
      ? (LANG==='fr' ? `${n} joueur${n>1?'s':''} combattent` : `${n} player${n>1?'s':''} fighting`)
      : (LANG==='fr' ? 'En attente de combattants' : 'Waiting for fighters');
  }
  const list = bossState.topList.slice(0, 10);
  if (!list.length) { el.innerHTML = `<div class="btpRow">${LANG==='fr'?'Sois le premier !':'Be the first!'}</div>`; return; }
  el.innerHTML = list.map((r,i) =>
    `<div class="btpRow${currentUser && r.user_id===currentUser.id?' me':''}"><span class="btpRank">#${i+1}</span>` +
    `<span class="btpPseudo">${r.active?'<span class="btpActiveDot"></span>':''}${escapeHtml(r.pseudo||'?')}</span>` +
    `<span class="btpPct">${(r.pct!=null?r.pct:0)}%</span><span class="btpDmg">${fmt(Math.round(r.damage))}</span></div>`).join('');
}
function resizeBossCanvas() {
  const cv = $('bossCv');
  cv.width = cv.clientWidth || 1280;
  cv.height = cv.clientHeight || 600;
}
// multiplicateur de récompense selon le RANG de contribution (boss partagé) : plus haut dans le
// top, plus la récompense est intéressante — cf demande "plus t'es haut plus la recompense est interessante"
function bossRankMultiplier(rank) {
  if (rank === 1) return 3;
  if (rank <= 3) return 2;
  if (rank <= 10) return 1.4;
  return 1; // hors du top 10 : récompense de base pour avoir participé
}
// roue de récompense rare (2026-07-08, demande explicite) : affichée en fin de combat quand le
// boss a une table "rareLoot" définie (Vell → Coeur de Vell, 5%) — tourne toute seule et s'arrête
// sur le lot RÉELLEMENT obtenu (déjà tiré au sort avant l'animation, la roue ne fait que le révéler).
function renderBossRewardWheel(rareLoot, won) {
  const N = 12; // segments (1 rare + 11 "rien") — purement visuel, ne reflète pas le vrai % (5%)
  const segDeg = 360/N;
  const commonIcon = '🌊';
  let iconsHtml = '';
  for (let i = 0; i < N; i++) {
    const centerDeg = i*segDeg + segDeg/2;
    const isRare = i === 0;
    iconsHtml += `<span class="bwIcon" style="transform:rotate(${centerDeg}deg) translate(0,-70px) rotate(${-centerDeg}deg)">${isRare?rareLoot.icon:commonIcon}</span>`;
  }
  const wheelHtml = `<div class="bossWheelWrap"><div class="bossWheelPointer">▼</div>` +
    `<div class="bossWheel" id="bossWheelEl" style="background:conic-gradient(${rareLoot.color} 0deg ${segDeg}deg, #232128 ${segDeg}deg 360deg)">${iconsHtml}</div></div>` +
    `<div class="bossWheelResult" id="bossWheelResultEl">${LANG==='fr'?'🎡 Récompense rare...':'🎡 Rare reward...'}</div>`;
  // lance l'animation juste après l'insertion dans le DOM (voir appel dans endBossFight)
  setTimeout(() => {
    const wheel = $a('bossWheelEl'); if (!wheel) return;
    const spins = 5;
    // atterrit au CENTRE du segment rare (15°) si gagné, sinon un point sûr dans la zone "rien"
    // (60°-330°, loin des bords pour ne jamais sembler tomber sur le rare par erreur visuelle)
    const targetDeg = won ? segDeg/2 : (60 + Math.random()*270);
    const finalRotation = spins*360 - targetDeg;
    wheel.style.transform = `rotate(${finalRotation}deg)`;
    setTimeout(() => {
      const res = $a('bossWheelResultEl'); if (!res) return;
      res.innerHTML = won
        ? `<span style="color:${rareLoot.color}">${rareLoot.icon} ${LANG==='fr'?'Obtenu' : 'Obtained'} : ${rareLoot.name} !</span>`
        : (LANG==='fr' ? `Pas cette fois — ${rareLoot.icon} ${rareLoot.name} attend toujours` : `Not this time — ${rareLoot.icon} ${rareLoot.name} still awaits`);
    }, 3600);
  }, 50);
  return wheelHtml;
}
async function endBossFight(win) {
  if (bossState.ended) return;
  bossState.ended = true;
  bossState.active = false;
  cancelAnimationFrame(bossState.raf);
  leaveBossChannel();
  const b = bossState.boss;
  let rewardsHtml = '';
  let wheelHtml = '';
  // BUG D'EXPLOIT corrigé le 2026-07-08 ("quand un world boss meurt, plus moyen d'y retourner et
  // de récupérer 2x la récompense") : sur un boss PARTAGÉ, boss_claim() était déjà correctement
  // bloqué côté serveur pour une 2e réclamation (table boss_claims, contrainte par user+boss_key),
  // MAIS le code ci-dessous accordait quand même silver/matériau/loot rare INCONDITIONNELLEMENT,
  // sans jamais vérifier si l'appel avait réussi — rentrer dans l'arène d'un boss partagé déjà à
  // 0 PV redéclenchait endBossFight(true) instantanément (voir bossLoop) et regagnait la
  // récompense complète à chaque fois. Sur un boss SOLO (test perso, pas de table de réclamation),
  // rien ne change : chaque combat est une instance fraîche et légitime.
  let alreadyClaimed = false;
  if (win) {
    let mult = 1, rank = null;
    if (bossState.shared && sb) {
      try {
        const { data } = await sb.rpc('boss_claim');
        if (typeof data === 'number' && data > 0) { rank = data; mult = bossRankMultiplier(rank); }
        // -1 : déjà réclamé, aucune contribution, ou boss pas encore à 0 PV. L'alerte Discord pour
        // le vrai cas de double réclamation part désormais depuis boss_claim() lui-même, côté
        // serveur, directement sur le salon "cheat" (déplacé le 2026-07-08 : elle partait avant sur
        // le salon général, côté client) — plus fiable, ne peut pas être usurpé
        else alreadyClaimed = true;
      } catch (e) { alreadyClaimed = true; } // en cas de doute (erreur réseau), ne JAMAIS accorder par défaut
    }
    if (alreadyClaimed) {
      rewardsHtml = `<div class="brRewards admHint">${LANG==='fr'
        ? 'Récompense déjà réclamée pour ce boss — chaque victoire ne peut être payée qu\'une seule fois.'
        : 'Reward already claimed for this boss — each victory can only be paid out once.'}</div>`;
    } else {
      // Le loot des World Boss dépend de la MEILLEURE zone découverte, mais seulement si le joueur
      // n'est pas mort depuis au moins 3 minutes ("certifié sans mort") — demande explicite du
      // 2026-07-08. Sans ce certificat, la récompense reste la valeur de base (aucun bonus de zone).
      const deathFreeMs = Date.now() - (S.lastDeathAt || 0);
      const deathFreeOk = deathFreeMs >= 3*60*1000;
      const zoneMult = deathFreeOk ? 1 + (S.maxZoneIdx/(ZONES.length-1))*1.5 : 1;
      const reward = Math.round(b.reward * mult * zoneMult);
      addSilver(reward, 'boss', b.name.fr);
      const qty = Math.max(1, Math.round((b.matQty[0] + Math.floor(Math.random()*(b.matQty[1]-b.matQty[0]+1))) * mult * zoneMult));
      invAdd({ key:b.matKey, name:b.matName, kind:'material', icon:b.matIcon, color:'#c9c9c9', qty, stackable:true, weight:0.1, val:5 });
      const rankHtml = rank ? `<div class="brRewards">${LANG==='fr'?'Rang de contribution':'Contribution rank'} : <b>#${rank}</b></div>` : '';
      const zoneHtml = `<div class="brRewards admHint">${deathFreeOk
        ? (LANG==='fr'?`Bonus de zone (${tr(ZONES[S.maxZoneIdx].name)}) : certifié sans mort ✓ ×${zoneMult.toFixed(2)}`:`Zone bonus (${tr(ZONES[S.maxZoneIdx].name)}): death-free certified ✓ ×${zoneMult.toFixed(2)}`)
        : (LANG==='fr'?'Pas de bonus de zone : mort il y a moins de 3 min':'No zone bonus: died less than 3 min ago')}</div>`;
      rewardsHtml = rankHtml + `<div class="brRewards">+${fmt(reward)} 🪙<br>+${qty} × ${b.matName}</div>` + zoneHtml;
      pushNotif('🏆', LANG==='fr'?'Boss vaincu':'Boss defeated', b.name[LANG]+' — +'+fmt(reward)+' 🪙', 'success');
      logToDiscord('🏆 Boss vaincu', `**${myPseudo||'Joueur'}** a vaincu ${b.name.fr}${rank?' (rang #'+rank+')':''} — +${fmt(reward)} 🪙`, 0xe8b84a);
      if (bossState.bossId) markBossDefeated(bossState.bossId); // Compendium (2026-07-08)
      // roue de récompense rare (Coeur de Vell, etc.) : le tirage a lieu MAINTENANT, la roue ne fait
      // que révéler ce qui a déjà été décidé
      if (b.rareLoot) {
        const won = Math.random() < b.rareLoot.ch;
        if (won) {
          invAdd({ name:b.rareLoot.name, kind:'craft', icon:b.rareLoot.icon, color:b.rareLoot.color, key:'craft_'+b.rareLoot.name, qty:1, stackable:true, weight:0.3, val:0 });
          trackLoot(b.rareLoot.name);
          logToDiscord('❤️‍🔥 Loot rarissime', `**${myPseudo||'Joueur'}** obtient ${b.rareLoot.name} sur ${b.name.fr} ! (${Math.round(b.rareLoot.ch*100)}% de chance)`, 0x5ec9e8);
        }
        wheelHtml = renderBossRewardWheel(b.rareLoot, won);
      }
      refreshStatsOnly(); hud();
    }
  }
  $('bossResult').innerHTML =
    `<div class="brTitle ${win?'win':''}">${win?(LANG==='fr'?'🏆 VICTOIRE':'🏆 VICTORY'):(LANG==='fr'?'Combat quitté':'Fight left')}</div>` +
    rewardsHtml + wheelHtml +
    `<button id="bossCloseBtn">${LANG==='fr'?'Retour':'Back'}</button>`;
  $('bossResult').classList.add('show');
  // au retour, on revient au lobby Boss (pas au farm) pour rester cohérent avec la nav par pages
  $a('bossCloseBtn').onclick = () => { $('bossResult').classList.remove('show'); openBossLobby(); };
}
function bossLoop(now) {
  if (!bossState.active) return;
  const dt = Math.min(.05, (now - bossState.last)/1000); bossState.last = now;
  bossState.elapsed += dt;
  // dégâts au boss : boss solo → linéaires sur la durée choisie ; boss PARTAGÉ → DPS réel du joueur,
  // reporté périodiquement au serveur qui tient les PV communs à tous les joueurs
  const dps = bossState.shared ? playerBossDps() : (bossState.maxHp / bossState.duration);
  bossState.hp = Math.max(0, bossState.hp - dps*dt);
  if (bossState.shared) {
    bossState.contribAccum += dps*dt; bossState.myDmg += dps*dt;
    bossState.contribCd -= dt; bossState.topCd -= dt;
    if (bossState.contribCd <= 0 && bossState.contribAccum > 0) {
      bossState.contribCd = 1.2;
      const dmg = bossState.contribAccum; bossState.contribAccum = 0;
      sb.rpc('boss_contribute', { p_damage: dmg, p_pseudo: myPseudo || null }).then(({ data, error }) => {
        if (error || !data || !data.length) return;
        // état AUTORITAIRE renvoyé par le serveur (inclut les dégâts de tous les autres joueurs)
        bossState.hp = Number(data[0].hp); bossState.maxHp = Number(data[0].max_hp) || bossState.maxHp;
      }).catch(()=>{});
    }
    if (bossState.topCd <= 0) { bossState.topCd = 4; refreshBossTop(); }
    bossState.presenceCd -= dt;
    if (bossState.presenceCd <= 0 && bossChannel) {
      bossState.presenceCd = 0.35;
      bossChannel.track({ pseudo: myPseudo || 'Joueur', px: bossState.px, py: bossState.py });
    }
    // interpolation des AUTRES joueurs (2026-07-08, demande explicite : "les animations des joueurs
    // en World Boss doivent être en temps réel") : leur position ne nous parvient que toutes les
    // ~0.35s via Presence (bossChannel.track ci-dessus), donc les afficher directement à la position
    // brute reçue les faisait "sauter" au lieu de bouger fluidement — on lisse chaque frame vers la
    // dernière position connue, à la même vitesse que le déplacement du héros local
    for (const uid in otherFighters) {
      const f = otherFighters[uid];
      if (!f || typeof f.px !== 'number' || typeof f.py !== 'number') continue;
      let p = otherFightersPos[uid];
      if (!p) { p = otherFightersPos[uid] = { x:f.px, y:f.py }; } // 1ère fois : apparaît directement à sa position
      const mdx = f.px-p.x, mdy = f.py-p.y, md = Math.hypot(mdx,mdy);
      if (md > 0.0015) { const spd = 1.1*dt; p.x += mdx/md*Math.min(spd,md); p.y += mdy/md*Math.min(spd,md); }
    }
    for (const uid in otherFightersPos) { if (!otherFighters[uid]) delete otherFightersPos[uid]; } // joueur parti
  }
  if (Math.random() < dt*4) { // ~4 impacts/s
    const crit = Math.random() < .2;
    bossState.hits.push({ x:.5+(Math.random()-.5)*.3, y:.4+(Math.random()-.5)*.15, life:1, dmg:dps*(crit?1.6:.7), crit });
    if (crit) bossState.shakeT = Math.max(bossState.shakeT, 6); // petit tremblement d'écran sur un coup critique
  }
  // ---- braises de corruption en parallaxe (profondeur/immersion) : plusieurs couches de
  // particules qui montent à des vitesses différentes selon leur "profondeur" simulée ----
  bossState.shakeT = Math.max(0, bossState.shakeT - dt*26);
  if (Math.random() < dt*3) {
    bossState.embers.push({ x:Math.random(), y:0.55+Math.random()*0.4, depth:0.25+Math.random()*0.85, life:1, sway:Math.random()*6.28 });
  }
  bossState.embers.forEach(e => { e.y -= dt*0.10*(0.4+e.depth); e.sway += dt*2; e.life -= dt*0.16; });
  bossState.embers = bossState.embers.filter(e => e.life > 0 && e.y > -0.05);
  // dégâts continus légers du boss (attaques de base) ; potion auto
  bossState.potCd = Math.max(0, bossState.potCd - dt);
  const incoming = (bossState.playerHpMax * 0.04) * dmgTakenMult(dpRatio()) * dt;
  bossState.playerHp -= incoming;

  // ---- mécanique d'AoE : le boss charge une attaque de zone, il faut se cacher DERRIÈRE un pilier ----
  bossState.aoeT += dt;
  const bs = bossState, dodging = (bs.aoePhase==='telegraph'||bs.aoePhase==='blast');
  // cible de déplacement du héros : abri (pilier le plus proche, on se place en dessous) ou position d'attaque
  let tx, ty;
  if (dodging) {
    let best=bs.pillars[0], bd=1e9;
    for (const p of bs.pillars) { const d=Math.hypot(p.x-bs.px, p.y-bs.py); if(d<bd){bd=d;best=p;} }
    tx = best.x; ty = best.y + 0.07; // juste derrière (sous) le pilier, loin du boss placé en haut
  } else { tx = bs.atkPos.x; ty = bs.atkPos.y; }
  const spd = 0.9*dt, mdx = tx-bs.px, mdy = ty-bs.py, md = Math.hypot(mdx,mdy);
  if (md>0.002) { bs.px += mdx/md*Math.min(spd,md); bs.py += mdy/md*Math.min(spd,md); }
  // machine à états de l'AoE
  if (bs.aoePhase==='idle' && bs.aoeT >= bs.aoeInterval) { bs.aoePhase='telegraph'; bs.aoeT=0; }
  else if (bs.aoePhase==='telegraph' && bs.aoeT >= 2.2) {
    bs.aoePhase='blast'; bs.aoeT=0;
    // à l'explosion : es-tu à couvert ? (proche d'un pilier/bouée ET en dessous)
    const safe = bs.pillars.some(p => Math.hypot(p.x-bs.px, p.y-bs.py) < 0.10 && bs.py > p.y);
    bs.blocked = safe;
    // Vell (2026-07-08) : reskin "plonge sous l'eau" au lieu de "cache-toi derrière un pilier" —
    // même mécanique sûr/pas-sûr, juste le texte/la couleur qui changent
    const isVell = bs.boss === BOSS_ROSTER.vell;
    if (safe) {
      bs.blockFlash = 0.6; bs.shakeT = 6;
      bs.floatMsgs.push({txt: isVell ? (LANG==='fr'?'PLONGÉ !':'DIVED!') : (LANG==='fr'?'PARÉ !':'BLOCKED!'), life:1, color:'#8cc8ff'});
    } else {
      bs.playerHp -= bs.playerHpMax*0.30; bs.hurtFlash = 0.6; bs.shakeT = 20;
      bs.floatMsgs.push({txt: isVell ? (LANG==='fr'?'VAGUE !':'WAVE!') : 'AoE !', life:1, color:'#e05050'});
    }
  }
  else if (bs.aoePhase==='blast' && bs.aoeT >= 0.45) { bs.aoePhase='idle'; bs.aoeT=0; bs.aoeInterval = 7 + Math.random()*4; }
  bs.blockFlash = Math.max(0, bs.blockFlash - dt);
  bs.hurtFlash = Math.max(0, bs.hurtFlash - dt);
  bs.floatMsgs.forEach(m => m.life -= dt*0.8);
  bs.floatMsgs = bs.floatMsgs.filter(m => m.life > 0);

  if (bossState.playerHp < bossState.playerHpMax*0.35 && bossState.potCd <= 0) {
    bossState.playerHp = Math.min(bossState.playerHpMax, bossState.playerHp + bossState.playerHpMax*0.5);
    bossState.potCd = 4.2;
  }
  if (bossState.playerHp < 1) bossState.playerHp = 1; // pas de wipe sur ce boss d'intro
  bossState.hits.forEach(h => h.life -= dt*1.4);
  bossState.hits = bossState.hits.filter(h => h.life > 0);
  drawBossRoom(now/1000);
  // HUD
  // maxHp peut être 0 (ex: boss despawn par l'admin pendant qu'on est encore dans l'arène) —
  // sans ce garde-fou, hp/0*100 = NaN et affiche "NaN%" — bug trouvé le 2026-07-07
  const hpPct = bossState.maxHp > 0 ? bossState.hp/bossState.maxHp*100 : 0;
  $('bossHpBar').style.width = hpPct+'%';
  $('bossHpBar').classList.toggle('low', hpPct <= 20);
  $('bossHpTxt').innerHTML = `<span class="bhpPct">${hpPct.toFixed(1)}%</span><span class="bhpNum">(${fmt(Math.ceil(bossState.hp))} / ${fmt(bossState.maxHp)})</span>`;
  $('bossTimer').textContent = bossState.shared ? fmtBossCountdown(bossState.expiresAt - Date.now()) : fmtBossCountdown((bossState.duration - bossState.elapsed)*1000);
  $('bossPlayerHp').style.width = (bossState.playerHp/bossState.playerHpMax*100)+'%';
  $('bossPlayerHpTxt').textContent = Math.ceil(bossState.playerHp)+' / '+bossState.playerHpMax+' PV';
  if (bossState.hp <= 0) { endBossFight(true); return; }
  if (bossState.shared && Date.now() > bossState.expiresAt) { endBossFight(false); return; }
  bossState.raf = requestAnimationFrame(bossLoop);
}
// ===== salle de boss ORIGINALE (art dessiné, aucun asset réel) : salle de pierre à 4 piliers,
// grand seigneur de guerre de la corruption au fond, mécanique d'AoE dont on se protège en se
// plaçant derrière un pilier. Vue de dessus légèrement inclinée. =====
function bossProj(nx, ny) { const cv = $('bossCv'); return { x: cv.width*0.5 + (nx-0.5)*cv.width*0.86, y: cv.height*0.10 + ny*cv.height*0.78 }; }
function drawStonePillar(cx, sx, sy, scale) {
  const w = 34*scale, h = 120*scale;
  cx.fillStyle = 'rgba(0,0,0,.4)'; cx.beginPath(); cx.ellipse(sx, sy, w*0.75, w*0.28, 0, 0, 7); cx.fill(); // ombre
  // fût (dégradé pierre)
  const g = cx.createLinearGradient(sx-w/2, 0, sx+w/2, 0);
  g.addColorStop(0,'#2c3238'); g.addColorStop(.45,'#5a636c'); g.addColorStop(.6,'#6d7681'); g.addColorStop(1,'#333940');
  cx.fillStyle = g; cx.fillRect(sx-w/2, sy-h, w, h);
  // chapiteau + base
  cx.fillStyle = '#4b535c'; cx.fillRect(sx-w*0.62, sy-h-8*scale, w*1.24, 10*scale);
  cx.fillRect(sx-w*0.62, sy-6*scale, w*1.24, 8*scale);
  // rainures
  cx.strokeStyle = 'rgba(0,0,0,.25)'; cx.lineWidth = 1;
  for (let i=1;i<4;i++){ const lx=sx-w/2+w*i/4; cx.beginPath(); cx.moveTo(lx,sy-h+6*scale); cx.lineTo(lx,sy-4*scale); cx.stroke(); }
}
function drawWarlord(cx, sx, sy, r, t) {
  cx.save();
  // ombre au sol
  cx.fillStyle='rgba(0,0,0,.45)'; cx.beginPath(); cx.ellipse(sx, sy+r*0.15, r*1.15, r*0.34, 0, 0, 7); cx.fill();
  const glow = 0.5+0.5*Math.sin(t*2);
  // corps massif (carapace corrompue)
  const body = cx.createLinearGradient(sx, sy-r*1.6, sx, sy+r*0.2);
  body.addColorStop(0,'#7a2d33'); body.addColorStop(.5,'#5a2028'); body.addColorStop(1,'#33121a');
  cx.fillStyle = body;
  cx.beginPath();
  cx.moveTo(sx-r*1.1, sy+r*0.1);
  cx.quadraticCurveTo(sx-r*1.35, sy-r*0.9, sx-r*0.5, sy-r*1.15);
  cx.quadraticCurveTo(sx, sy-r*1.5, sx+r*0.5, sy-r*1.15);
  cx.quadraticCurveTo(sx+r*1.35, sy-r*0.9, sx+r*1.1, sy+r*0.1);
  cx.closePath(); cx.fill();
  // pointes de carapace sur le dos
  cx.fillStyle = '#3a161c';
  for (let i=-3;i<=3;i++){ const bx=sx+i*r*0.28, by=sy-r*1.1-Math.abs(i)*r*0.02;
    cx.beginPath(); cx.moveTo(bx-r*0.09,by); cx.lineTo(bx+r*0.09,by); cx.lineTo(bx, by-r*0.4); cx.closePath(); cx.fill(); }
  // fissures de corruption lumineuses
  cx.strokeStyle = `rgba(255,90,70,${0.55+0.35*glow})`; cx.lineWidth = 2; cx.shadowColor='#ff5a46'; cx.shadowBlur=12;
  cx.beginPath();
  cx.moveTo(sx-r*0.5,sy-r*0.9); cx.lineTo(sx-r*0.2,sy-r*0.4); cx.lineTo(sx-r*0.35,sy-r*0.1);
  cx.moveTo(sx+r*0.5,sy-r*0.8); cx.lineTo(sx+r*0.25,sy-r*0.35); cx.lineTo(sx+r*0.4,sy);
  cx.stroke(); cx.shadowBlur=0;
  // bras/griffes
  cx.fillStyle = '#4a1a20';
  cx.beginPath(); cx.moveTo(sx-r*1.0,sy-r*0.5); cx.lineTo(sx-r*1.5,sy-r*0.1); cx.lineTo(sx-r*1.25,sy-r*0.05); cx.lineTo(sx-r*0.9,sy-r*0.3); cx.closePath(); cx.fill();
  cx.beginPath(); cx.moveTo(sx+r*1.0,sy-r*0.5); cx.lineTo(sx+r*1.5,sy-r*0.1); cx.lineTo(sx+r*1.25,sy-r*0.05); cx.lineTo(sx+r*0.9,sy-r*0.3); cx.closePath(); cx.fill();
  // tête casquée
  const hy = sy-r*1.05;
  cx.fillStyle = '#43191f'; cx.beginPath(); cx.arc(sx, hy, r*0.42, 0, 7); cx.fill();
  // cornes
  cx.strokeStyle = '#c9b48a'; cx.lineWidth = r*0.16; cx.lineCap='round';
  cx.beginPath(); cx.moveTo(sx-r*0.3, hy-r*0.2); cx.quadraticCurveTo(sx-r*0.75, hy-r*0.7, sx-r*0.55, hy-r*1.0); cx.stroke();
  cx.beginPath(); cx.moveTo(sx+r*0.3, hy-r*0.2); cx.quadraticCurveTo(sx+r*0.75, hy-r*0.7, sx+r*0.55, hy-r*1.0); cx.stroke();
  cx.lineCap='butt';
  // yeux ardents
  cx.fillStyle = `rgba(255,${120+100*glow|0},60,1)`; cx.shadowColor='#ffae3a'; cx.shadowBlur=14;
  cx.beginPath(); cx.arc(sx-r*0.16, hy, r*0.09, 0, 7); cx.fill();
  cx.beginPath(); cx.arc(sx+r*0.16, hy, r*0.09, 0, 7); cx.fill();
  cx.shadowBlur=0;
  cx.restore();
}
// Vell — grand dragon des mers ORIGINAL. Silhouette redessinée le 2026-07-08 (4e version) d'après
// 5 angles d'une sculpture 3D de référence fournie par l'utilisateur, qui clarifient la composition :
// ce ne sont PAS deux cornes séparées d'un socle, mais les DEUX AILES du dragon lui-même, si
// gigantesques qu'elles s'enroulent vers l'intérieur et se rejoignent en bas pour former une grande
// vasque/coupe — le corps du dragon (petit, tête à crête de pointes, museau fin, queue longue et
// fine terminée par une pointe recourbée en lame) est perché tout en haut au centre de cette coupe,
// pattes griffues agrippées au rebord. Franchement différent de Kzarka (humanoïde compact, 2 cornes
// droites, gueule fermée). Pas de reprise d'asset réel, juste l'ambiance/la composition.
function drawVell(cx, sx, sy, r, t) {
  cx.save();
  const glow = 0.5+0.5*Math.sin(t*2);
  const sway = Math.sin(t*0.9)*r*0.02;
  cx.fillStyle='rgba(0,0,0,.4)'; cx.beginPath(); cx.ellipse(sx, sy+r*0.5, r*1.15, r*0.26, 0, 0, 7); cx.fill();
  // les 2 immenses ailes enroulées en vasque/coupe — élément signature : elles partent des épaules
  // (haut, près de la tête), s'ouvrent largement vers l'extérieur puis se recourbent vers l'intérieur
  // et vers le bas pour se rejoindre au centre, formant une grande coupe qui sert de socle
  const wingBowl = (side) => {
    cx.save(); cx.translate(sx,sy-r*0.75); cx.scale(side,1);
    const wg = cx.createLinearGradient(0,-r*0.2,r*1.15,r*1.1);
    wg.addColorStop(0,'#1c3a4a'); wg.addColorStop(1,'#0a1c26');
    cx.fillStyle = wg;
    cx.beginPath();
    cx.moveTo(r*0.08,-r*0.05);
    cx.quadraticCurveTo(r*0.5,-r*0.2, r*0.85,-r*0.05);
    cx.quadraticCurveTo(r*1.2,r*0.12, r*1.15,r*0.55);
    cx.quadraticCurveTo(r*1.1,r*0.95, r*0.7,r*1.15+sway);
    cx.quadraticCurveTo(r*0.35,r*1.3, r*0.02,r*1.18);
    cx.quadraticCurveTo(r*0.28,r*0.95, r*0.32,r*0.6);
    cx.quadraticCurveTo(r*0.34,r*0.25, r*0.16,r*0.08);
    cx.closePath(); cx.fill();
    // nervures de l'aile
    cx.strokeStyle='rgba(160,220,230,.18)'; cx.lineWidth=r*0.02;
    cx.beginPath(); cx.moveTo(r*0.15,-r*0.02); cx.quadraticCurveTo(r*0.75,r*0.05, r*0.85,r*0.9+sway); cx.stroke();
    cx.beginPath(); cx.moveTo(r*0.15,-r*0.02); cx.quadraticCurveTo(r*0.55,r*0.15, r*0.5,r*0.85); cx.stroke();
    cx.restore();
  };
  wingBowl(-1); wingBowl(1);
  // queue longue et fine, part du corps et longe l'extérieur d'une aile jusqu'à une pointe recourbée
  // en lame — visible qui dépasse sur le côté de la coupe
  cx.strokeStyle='#0e1c24'; cx.lineCap='round';
  cx.beginPath(); cx.lineWidth=r*0.09;
  cx.moveTo(sx-r*0.2,sy-r*0.55);
  cx.quadraticCurveTo(sx-r*0.95,sy-r*0.15+sway, sx-r*1.25,sy+r*0.35);
  cx.stroke();
  cx.lineWidth=r*0.035;
  cx.beginPath(); cx.moveTo(sx-r*1.15,sy+r*0.15); cx.quadraticCurveTo(sx-r*1.4,sy+r*0.3+sway, sx-r*1.42,sy+r*0.55); cx.stroke();
  cx.lineCap='butt';
  // torse : petit corps sombre écaillé perché en haut au centre de la coupe
  const body = cx.createLinearGradient(sx, sy-r*1.35, sx, sy-r*0.4);
  body.addColorStop(0,'#1c3a4a'); body.addColorStop(.6,'#12222c'); body.addColorStop(1,'#0a1620');
  cx.fillStyle = body;
  cx.beginPath();
  cx.moveTo(sx-r*0.24,sy-r*0.45); cx.quadraticCurveTo(sx-r*0.3,sy-r*0.95, sx-r*0.14,sy-r*1.15);
  cx.quadraticCurveTo(sx,sy-r*1.22, sx+r*0.14,sy-r*1.15);
  cx.quadraticCurveTo(sx+r*0.3,sy-r*0.95, sx+r*0.24,sy-r*0.45);
  cx.quadraticCurveTo(sx,sy-r*0.32, sx-r*0.24,sy-r*0.45);
  cx.closePath(); cx.fill();
  // pattes griffues courtes agrippées au rebord de la coupe
  cx.fillStyle = '#12222c';
  for (const side of [-1,1]) {
    cx.beginPath(); cx.ellipse(sx+side*r*0.2,sy-r*0.38,r*0.1,r*0.16,side*0.3,0,7); cx.fill();
    cx.strokeStyle='#e8e2d0'; cx.lineWidth=r*0.02; cx.lineCap='round';
    for (let c=-1;c<=1;c++) { cx.beginPath(); cx.moveTo(sx+side*r*0.19+c*r*0.04,sy-r*0.3); cx.lineTo(sx+side*r*0.16+c*r*0.05,sy-r*0.2); cx.stroke(); }
    cx.lineCap='butt';
  }
  // tête : museau fin, surmontée d'une crête de pointes asymétrique
  const hy = sy-r*1.18;
  cx.fillStyle = '#12222c';
  cx.beginPath(); cx.ellipse(sx,hy,r*0.22,r*0.19,0,0,7); cx.fill();
  cx.beginPath(); cx.ellipse(sx,hy+r*0.15,r*0.13,r*0.11,0,0,7); cx.fill();
  // crête de pointes le long de la nuque/tête — la couronne caractéristique
  cx.fillStyle = '#0e1c24';
  const ridge = [[-0.3,-0.95,0.55],[-0.12,-1.1,0.75],[0.06,-1.15,0.8],[0.24,-1.05,0.65],[0.4,-0.85,0.45]];
  for (const [dx,dy,len] of ridge) {
    const bx=sx+dx*r*0.4, by=hy+dy*r*0.4;
    cx.beginPath();
    cx.moveTo(bx-r*0.035,by); cx.lineTo(bx+dx*r*0.25*len, by+dy*r*0.35*len); cx.lineTo(bx+r*0.035,by);
    cx.closePath(); cx.fill();
  }
  // gueule, crocs, gorge sombre
  cx.fillStyle='#4a0e0e'; cx.beginPath(); cx.ellipse(sx,hy+r*0.18,r*0.13,r*0.1,0,0,Math.PI); cx.fill();
  cx.fillStyle='#e8e2d0';
  for (let i=-2;i<=2;i++) { const tx=sx+i*r*0.05;
    cx.beginPath(); cx.moveTo(tx-r*0.02,hy+r*0.1); cx.lineTo(tx,hy+r*0.21); cx.lineTo(tx+r*0.02,hy+r*0.1); cx.closePath(); cx.fill(); }
  // yeux luminescents, petits et enfoncés
  cx.fillStyle = `rgba(255,${60+40*glow|0},60,1)`; cx.shadowColor='#ff3a3a'; cx.shadowBlur=12;
  cx.beginPath(); cx.arc(sx-r*0.08,hy-r*0.02,r*0.04,0,7); cx.fill();
  cx.beginPath(); cx.arc(sx+r*0.08,hy-r*0.02,r*0.04,0,7); cx.fill();
  cx.shadowBlur=0;
  cx.restore();
}
// dispatcher : chaque boss du roster a sa propre silhouette dans l'arène — pour l'instant Kzarka
// (Grand Seigneur de guerre) et Vell (grand poisson des mers) ont la leur
function drawBossCreature(bossId, cx, sx, sy, r, t) {
  if (bossId === 'vell') return drawVell(cx, sx, sy, r, t);
  return drawWarlord(cx, sx, sy, r, t);
}
// bateaux + tirs de canon (2026-07-08, demande explicite : "les joueurs sont autour en bateau et
// lancent des boulets dessus") — dessinés SEULEMENT pour Vell. Réutilise le tableau bs.hits déjà
// généré ~4×/s par bossLoop (chaque hit = un boulet, h.life 1→0 sert de progression de vol).
// bateaux 10× plus gros (demande explicite du 2026-07-08) : repoussés vers les coins bas de l'écran
// pour rester au premier plan sans recouvrir tout le combat malgré leur taille
const VELL_BOATS = [ {x:0.04, y:0.92}, {x:0.96, y:0.92} ];
const VELL_BOAT_SCALE = 13; // 1.3 × 10
// ancres des 2 bateaux (2026-07-08, demande explicite : "les joueurs plongent sous l'ancre des
// bateaux à la place des piliers de Kzarka") — un peu vers le centre par rapport au bateau lui-même,
// pour rester une position atteignable à la nage plutôt que collée au bord de l'écran
const VELL_ANCHORS = [ {x:0.16, y:0.74}, {x:0.84, y:0.74} ];
function drawVellBoat(cx, sx, sy, scale, facingRight) {
  cx.save(); cx.translate(sx,sy); if (!facingRight) cx.scale(-1,1); cx.scale(scale,scale);
  cx.fillStyle='rgba(0,0,0,.35)'; cx.beginPath(); cx.ellipse(0,4,26,7,0,0,7); cx.fill();
  cx.fillStyle='#3a2c1e'; // coque
  cx.beginPath(); cx.moveTo(-22,0); cx.quadraticCurveTo(-24,8,-14,9); cx.lineTo(20,9); cx.quadraticCurveTo(26,4,20,0); cx.closePath(); cx.fill();
  cx.strokeStyle='#241a10'; cx.lineWidth=1; cx.beginPath(); cx.moveTo(-20,3); cx.lineTo(18,3); cx.stroke();
  cx.strokeStyle='#5a4630'; cx.lineWidth=1.6; cx.beginPath(); cx.moveTo(-4,0); cx.lineTo(-4,-26); cx.stroke(); // mât
  cx.fillStyle='#c9c2a8'; cx.beginPath(); cx.moveTo(-4,-25); cx.lineTo(12,-16); cx.lineTo(-4,-9); cx.closePath(); cx.fill(); // voile
  cx.restore();
}
function drawBossRoom(t) {
  const cx = bossCtx, cv = $('bossCv'), W = cv.width, H = cv.height, bs = bossState;
  const isVell = bs.boss === BOSS_ROSTER.vell;
  cx.save();
  // tremblement d'écran (crit / AoE non paré) : léger décalage aléatoire de toute la scène,
  // renforce la sensation d'impact et de profondeur ("4D")
  if (bs.shakeT > 0) cx.translate((Math.random()-0.5)*bs.shakeT, (Math.random()-0.5)*bs.shakeT);
  if (isVell) {
    // Vell : en pleine mer, ciel pâle au loin qui s'assombrit vers l'eau (demande explicite,
    // d'après les captures de référence) — pas de dalles de pierre, juste des rides d'eau
    const sky = cx.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,'#8fb8c9'); sky.addColorStop(.42,'#4a7a8f'); sky.addColorStop(.55,'#1c4a5e'); sky.addColorStop(1,'#0a2430');
    cx.fillStyle = sky; cx.fillRect(0,0,W,H);
    // Vell est cerné de montagnes de tous côtés, UNE SEULE entrée étroite au centre pour aller le
    // voir depuis les bateaux (demande explicite du 2026-07-08, d'après la capture "Barrier Rock" —
    // "il doit y avoir qu'une entrée") : 2 versants rocheux séparés par un unique passage
    const gapL = W*0.40, gapR = W*0.60;
    cx.fillStyle = 'rgba(10,20,26,.6)';
    cx.beginPath(); cx.moveTo(0,H*.5);
    for (let i=0;i<=8;i++) { const x=i/8*gapL; cx.lineTo(x, H*.42 - Math.abs(Math.sin(i*2.3+3))*H*.16); }
    cx.lineTo(gapL,H*.5); cx.closePath(); cx.fill();
    cx.beginPath(); cx.moveTo(gapR,H*.5);
    for (let i=0;i<=8;i++) { const x=gapR+i/8*(W-gapR); cx.lineTo(x, H*.42 - Math.abs(Math.sin(i*2.1+11))*H*.16); }
    cx.lineTo(W,H*.5); cx.closePath(); cx.fill();
    // "Barrier Rock" : 2 pointes plus sombres/proches encadrant directement l'entrée
    cx.fillStyle = 'rgba(6,14,18,.75)';
    const rockSpike = (sx, h) => { cx.beginPath(); cx.moveTo(sx-18,H*.58); cx.lineTo(sx,H*.58-h); cx.lineTo(sx+18,H*.58); cx.closePath(); cx.fill(); };
    rockSpike(gapL-10, H*.22);
    rockSpike(gapR+10, H*.24);
    // rides d'eau horizontales, ondulantes
    cx.strokeStyle='rgba(255,255,255,.10)'; cx.lineWidth=1;
    for (let i=0;i<9;i++) { const y = H*.5 + i*(H*.5/9);
      cx.beginPath();
      for (let x=0;x<=W;x+=24) cx.lineTo(x, y+Math.sin(x*0.03+t*1.2+i)*3);
      cx.stroke();
    }
  } else {
    // fond : grande salle brumeuse bleu-gris
    const bg = cx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#1a2830'); bg.addColorStop(.55,'#223038'); bg.addColorStop(1,'#10171c');
    cx.fillStyle = bg; cx.fillRect(0,0,W,H);
    // dalles de pierre au sol (bandes qui s'élargissent vers le bas = légère perspective)
    cx.strokeStyle = 'rgba(0,0,0,.28)'; cx.lineWidth = 1;
    for (let i=0;i<=10;i++){ const p=bossProj(0,i/10); cx.beginPath(); cx.moveTo(0,p.y); cx.lineTo(W,p.y); cx.stroke(); }
    for (let i=0;i<=8;i++){ const top=bossProj(i/8,0), bot=bossProj(i/8,1); cx.beginPath(); cx.moveTo(top.x,top.y); cx.lineTo(bot.x,bot.y); cx.stroke(); }
  }
  // brume de fond en parallaxe : dérive LENTE et indépendante du tremblement d'écran — donne au
  // donjon une vraie impression de profondeur/volume ("4D") au-delà du simple décor plat
  const fogDrift = Math.sin(t*0.15)*16;
  const fog = cx.createRadialGradient(W/2+fogDrift, H*0.32, W*0.08, W/2+fogDrift, H*0.32, W*0.8);
  fog.addColorStop(0,'rgba(255,255,255,0)'); fog.addColorStop(1,`rgba(0,0,0,${isVell?.22:.4})`);
  cx.fillStyle = fog; cx.fillRect(0,0,W,H);
  if (isVell) { // bateaux des joueurs, de part et d'autre — demande explicite du 2026-07-08
    drawVellBoat(cx, W*VELL_BOATS[0].x, H*VELL_BOATS[0].y, VELL_BOAT_SCALE, true);
    drawVellBoat(cx, W*VELL_BOATS[1].x, H*VELL_BOATS[1].y, VELL_BOAT_SCALE, false);
  }
  // braises de corruption en arrière-plan (profondeur : plus loin = plus petit/lent/transparent)
  for (const e of bs.embers) {
    if (e.depth > 0.6) continue; // couche lointaine, DERRIÈRE le boss
    const ex = (e.x + Math.sin(e.sway)*0.01)*W, ey = e.y*H;
    cx.globalAlpha = e.life*0.35*e.depth; cx.fillStyle = '#ff8a4a'; cx.shadowColor='#ff5a2a'; cx.shadowBlur = 6;
    cx.beginPath(); cx.arc(ex, ey, 1+1.5*e.depth, 0, 7); cx.fill();
  }
  cx.globalAlpha = 1; cx.shadowBlur = 0;
  // boss au fond : légère oscillation de volume (skew) pour donner une impression de masse en 3D
  const bpos = bossProj(0.5, 0.12); const r = Math.min(W,H)*0.14;
  cx.save();
  cx.translate(bpos.x, bpos.y);
  cx.transform(1, 0, 0.05*Math.sin(t*0.6), 1+0.015*Math.sin(t*1.3), 0, 0);
  drawBossCreature(bs.bossId, cx, 0, 0, r, t);
  cx.restore();
  // braises au premier plan (devant le boss, plus grosses/rapides/opaques)
  for (const e of bs.embers) {
    if (e.depth <= 0.6) continue;
    const ex = (e.x + Math.sin(e.sway)*0.015)*W, ey = e.y*H;
    cx.globalAlpha = e.life*0.55*e.depth; cx.fillStyle = '#ffb066'; cx.shadowColor='#ff5a2a'; cx.shadowBlur = 8;
    cx.beginPath(); cx.arc(ex, ey, 1.5+2*e.depth, 0, 7); cx.fill();
  }
  cx.globalAlpha = 1; cx.shadowBlur = 0;
  // boulets de canon tirés des bateaux (Vell uniquement) : chaque hit = 1 boulet, h.life 1→0 sert de
  // progression de vol (le bateau tire du côté le plus proche de x du hit) — demande explicite :
  // "affiche ça, l'animation de boulet ... avec un tic à chaque boulet"
  if (isVell) {
    for (const h of bs.hits) {
      const boat = VELL_BOATS[h.x < 0.5 ? 0 : 1];
      const bx = W*boat.x, by = H*boat.y - VELL_BOAT_SCALE*12; // départ du boulet à hauteur du pont, proportionnel à la taille du bateau
      const prog = 1-h.life; // 0 au départ du bateau, 1 à l'impact
      const px = bx + (bpos.x-bx)*prog;
      const py = by + (bpos.y-by)*prog - Math.sin(prog*Math.PI)*70; // arc parabolique
      cx.fillStyle = '#1a1a1a';
      cx.beginPath(); cx.arc(px, py, 4.5, 0, 7); cx.fill();
      cx.strokeStyle = 'rgba(200,200,200,.4)'; cx.lineWidth = 1.5;
      cx.beginPath(); cx.moveTo(px,py); cx.lineTo(px-(bpos.x-bx)*0.05, py-(bpos.y-by)*0.05+8); cx.stroke();
    }
  }
  // impacts de dégâts sur le boss
  for (const h of bs.hits) {
    const hy = bpos.y - (1-h.life)*40;
    cx.globalAlpha = Math.max(0,h.life);
    cx.font = h.crit?'bold 24px Georgia':'18px Georgia'; cx.textAlign='center';
    cx.fillStyle = h.crit?'#ffbe78':'#fff';
    cx.fillText('-'+fmt(Math.ceil(h.dmg))+(h.crit?'!':''), bpos.x+(h.x-.5)*r*2.4, hy);
    cx.globalAlpha = 1;
  }
  cx.textAlign='left';
  // ---- AoE au sol : cercle qui grandit (telegraph) puis explosion, sauf derrière les piliers —
  // pour Vell (2026-07-08), reskin "vague" bleu/écume : le joueur doit PLONGER au lieu de se cacher
  // derrière un pilier, mais le mécanisme sûr/pas-sûr sous-jacent reste identique
  const aoeCol = isVell ? [90,180,220] : [224,70,60];
  if (bs.aoePhase==='telegraph' || bs.aoePhase==='blast') {
    const c = bossProj(0.5, 0.6);
    const rad = Math.min(W,H)*0.55;
    if (bs.aoePhase==='telegraph') {
      const prog = Math.min(1, bs.aoeT/2.2);
      cx.fillStyle = `rgba(${aoeCol[0]},${aoeCol[1]},${aoeCol[2]},${0.10+0.14*prog})`;
      cx.beginPath(); cx.ellipse(c.x, c.y, rad, rad*0.55, 0, 0, 7); cx.fill();
      cx.strokeStyle = `rgba(${isVell?'160,220,255':'255,80,60'},${0.5+0.4*Math.sin(t*10)})`; cx.lineWidth = 3;
      cx.beginPath(); cx.ellipse(c.x, c.y, rad*prog, rad*0.55*prog, 0, 0, 7); cx.stroke();
    } else {
      const a = 1-Math.min(1,bs.aoeT/0.45);
      cx.fillStyle = `rgba(${isVell?'160,220,255':'255,90,60'},${0.55*a})`;
      cx.beginPath(); cx.ellipse(c.x, c.y, rad, rad*0.55, 0, 0, 7); cx.fill();
    }
    // zones sûres (pilier en pierre, ou bouée de plongée pour Vell) — petite ombre bleutée = "à couvert"
    for (const p of bs.pillars) { const s = bossProj(p.x, p.y+0.05);
      cx.fillStyle = 'rgba(120,180,255,.16)'; cx.beginPath(); cx.ellipse(s.x, s.y, 40, 16, 0, 0, 7); cx.fill(); }
  }
  // ---- éléments au sol triés par profondeur (piliers/ancres + héros) pour un rendu cohérent
  const drawables = bs.pillars.map((p,pi) => ({ ny:p.y, fn:()=>{
    const s = bossProj(p.x,p.y);
    if (isVell) {
      // ancre du bateau le plus proche : chaîne qui descend du pont jusqu'à la surface, où l'on
      // plonge pour se mettre à l'abri — demande explicite du 2026-07-08 ("plonge sous l'ancre des
      // bateaux à la place des anciens piliers de Kzarka")
      const boat = VELL_BOATS[pi] || VELL_BOATS[0];
      const bx = W*boat.x, by = H*boat.y - VELL_BOAT_SCALE*12;
      cx.strokeStyle='rgba(90,90,90,.55)'; cx.lineWidth=2;
      cx.beginPath(); cx.moveTo(bx,by); cx.lineTo(s.x,s.y-14); cx.stroke();
      cx.fillStyle='rgba(0,0,0,.3)'; cx.beginPath(); cx.ellipse(s.x,s.y+2,12,4.5,0,0,7); cx.fill();
      cx.strokeStyle='#7a7a78'; cx.lineWidth=2.4; cx.lineCap='round';
      cx.beginPath(); cx.moveTo(s.x,s.y-14); cx.lineTo(s.x,s.y-2); cx.stroke(); // tige de l'ancre
      cx.beginPath(); cx.arc(s.x,s.y-14,3,0,7); cx.stroke(); // anneau du haut
      cx.beginPath(); cx.arc(s.x,s.y-3,6,Math.PI*0.15,Math.PI*0.85); cx.stroke(); // courbe des pattes
      cx.beginPath(); cx.moveTo(s.x-6,s.y-3); cx.lineTo(s.x-9,s.y-8); cx.moveTo(s.x+6,s.y-3); cx.lineTo(s.x+9,s.y-8); cx.stroke(); // pattes
      cx.beginPath(); cx.moveTo(s.x-9,s.y-13); cx.lineTo(s.x+9,s.y-13); cx.stroke(); // barre transversale
    } else drawStonePillar(cx, s.x, s.y, Math.min(W,H)/500*1.6);
  } }));
  // Vell (2026-07-08, demande explicite "fais plonger le personnage") : quand on s'abrite près
  // d'une bouée pendant la charge, le héros disparaît sous l'eau (ridules + bulles) au lieu de
  // rester debout comme si de rien n'était — bien plus lisible que le simple bouclier bleu.
  const dodgingNow = bs.aoePhase==='telegraph' || bs.aoePhase==='blast';
  const nearBuoy = isVell && bs.pillars.some(p => Math.hypot(p.x-bs.px, p.y-bs.py) < 0.10 && bs.py > p.y);
  const diving = isVell && dodgingNow && nearBuoy;
  drawables.push({ ny:bs.py, fn:()=>{
    const s = bossProj(bs.px, bs.py);
    if (diving) {
      // ridules concentriques qui s'élargissent + bulles qui remontent, à la surface où il a plongé
      cx.strokeStyle='rgba(200,230,255,.5)'; cx.lineWidth=1.4;
      for (let i=0;i<3;i++) { const rr = 6+((t*30+i*9)%22);
        cx.globalAlpha = Math.max(0,1-rr/22); cx.beginPath(); cx.ellipse(s.x,s.y,rr,rr*0.4,0,0,7); cx.stroke(); }
      cx.globalAlpha = 1;
      cx.fillStyle='rgba(220,240,255,.6)';
      for (let i=0;i<4;i++) { const bx=s.x+Math.sin(t*3+i*2)*8, by=s.y-((t*18+i*7)%20);
        cx.beginPath(); cx.arc(bx,by,1.4+i*0.3,0,7); cx.fill(); }
      return;
    }
    cx.fillStyle='rgba(0,0,0,.35)'; cx.beginPath(); cx.ellipse(s.x, s.y, 12, 5, 0, 0, 7); cx.fill();
    // bouclier si paré
    if (bs.blockFlash>0) { cx.strokeStyle=`rgba(140,200,255,${bs.blockFlash})`; cx.lineWidth=3; cx.beginPath(); cx.arc(s.x, s.y-18, 20, 0, 7); cx.stroke(); }
    const hurt = bs.hurtFlash>0;
    cx.fillStyle = hurt ? '#c0554533' : '#3b6ea8';
    cx.beginPath(); cx.moveTo(s.x, s.y-36); cx.lineTo(s.x-10, s.y); cx.lineTo(s.x+10, s.y); cx.closePath(); cx.fill();
    cx.fillStyle = hurt ? '#e0a0a0' : '#e8d0a0'; cx.beginPath(); cx.arc(s.x, s.y-38, 5.5, 0, 7); cx.fill();
    cx.fillStyle = '#2a4a7a'; cx.beginPath(); cx.moveTo(s.x-7,s.y-38); cx.lineTo(s.x+7,s.y-38); cx.lineTo(s.x,s.y-50); cx.closePath(); cx.fill();
  }});
  // ---- les AUTRES joueurs du boss partagé, en direct via Supabase Realtime presence (voir
  // joinBossChannel) : silhouette simplifiée + pseudo, à leur position réelle dans l'arène —
  // demande explicite : "tous les joueurs doivent se voir dans la zone du boss"
  if (bs.shared) {
    for (const uid in otherFighters) {
      const f = otherFighters[uid];
      if (!f || typeof f.px !== 'number' || typeof f.py !== 'number') continue;
      const p = otherFightersPos[uid] || { x:f.px, y:f.py }; // position lissée (voir bossLoop), repli sur la brute si pas encore initialisée
      drawables.push({ ny:p.y, fn:()=>{
        const s = bossProj(p.x, p.y);
        cx.fillStyle='rgba(0,0,0,.3)'; cx.beginPath(); cx.ellipse(s.x, s.y, 10, 4, 0, 0, 7); cx.fill();
        cx.fillStyle = '#5a8a4a';
        cx.beginPath(); cx.moveTo(s.x, s.y-30); cx.lineTo(s.x-8, s.y); cx.lineTo(s.x+8, s.y); cx.closePath(); cx.fill();
        cx.fillStyle = '#d8c89a'; cx.beginPath(); cx.arc(s.x, s.y-32, 4.5, 0, 7); cx.fill();
        cx.font = '10px Georgia'; cx.textAlign = 'center'; cx.fillStyle = '#cde8c0';
        cx.shadowColor = '#000'; cx.shadowBlur = 3;
        cx.fillText((f.pseudo||'?').slice(0,14), s.x, s.y-40);
        cx.shadowBlur = 0;
      }});
    }
  }
  drawables.sort((a,b)=>a.ny-b.ny).forEach(d => d.fn());
  // messages flottants (PARÉ / AoE) au-dessus du héros
  for (const m of bs.floatMsgs) {
    const s = bossProj(bs.px, bs.py);
    cx.globalAlpha = Math.max(0, Math.min(1, m.life));
    cx.font = 'bold 18px Georgia'; cx.textAlign='center'; cx.fillStyle = m.color;
    cx.fillText(m.txt, s.x, s.y-56-(1-m.life)*24);
    cx.globalAlpha = 1;
  }
  cx.textAlign='left'; cx.textBaseline='alphabetic';
  // vignette réactive aux PV du boss : le donjon "respire" la corruption à mesure qu'il faiblit —
  // renforce encore l'immersion "4D" en réagissant à l'état réel du combat, pas juste au décor
  const hpFrac = bs.maxHp > 0 ? Math.max(0, bs.hp/bs.maxHp) : 1;
  const breathe = 1 + Math.sin(t*2.2)*(hpFrac<0.3?0.18:0.05);
  const vigStrength = (0.14 + (1-hpFrac)*0.36) * breathe;
  const vig = cx.createRadialGradient(W/2,H/2,H*0.25,W/2,H/2,H*0.78);
  vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(1,`rgba(140,20,20,${Math.min(0.6,vigStrength)})`);
  cx.fillStyle = vig; cx.fillRect(0,0,W,H);
  cx.restore(); // referme le cx.save() du tremblement d'écran en tout début de fonction
}

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
      return `<div class="cell compBagCell has" title="${escapeHtml(tr(s.name))}">` +
        `<span style="color:${s.color}">${s.icon || (s.slot && SLOT_ICON[s.slot]) || '❔'}</span>` +
        cellEnhBadgeHtml(s) +
        `<button class="compBagReturnBtn" data-i="${i}" title="${LANG==='fr'?'Renvoyer au sac principal':'Send back to main bag'}">↩️</button></div>`;
    }).join('');
    bodyHtml = `<div class="admHint">${LANG==='fr'
        ? '"Vendre 1" garde toujours ici le PLUS ENCHANTÉ des exemplaires possédés de chaque type d\'équipement/bijou jamais monté en PEN, au lieu de le perdre — un exemplaire plus enchanté trouvé dans le sac prend automatiquement sa place. Renvoie-le au sac principal pour t\'en servir.'
        : '"Sell 1" always keeps here the MOST ENHANCED copy owned of each gear/jewelry type never brought to PEN, instead of losing it — a more enhanced copy found in your bag automatically takes its place. Send it back to your main bag to use it.'}</div>` +
      `<div class="admSummary">${used} / ${INV_SIZE}</div>` +
      `<div class="admInvGrid compBagGrid">${cellsHtml}</div>`;
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
const REF_KPM_FOR_STATS = 15; // kills/min de référence (voir zones-roadmap.md, même valeur que le calibrage économique des zones)
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
function aiMode() {
  const r = bottleneck();
  if (r >= 1.5) return 'overgeared';
  if (r >= 0.85) return 'équilibré';
  return 'défensif';
}
// mode de farm choisi par le joueur : "Loot" ramasse tout avant de passer au pack suivant (voir
// killPack + case 'loot' du fsm), "XP" ignore le loot au sol et enchaîne les packs pour maximiser
// les kills/xp par minute (demande : 2 IA différentes, une full-loot, une full-XP)
const FARM_MODES = {
  loot: { icon:'🎒', name:{fr:'Loot', en:'Loot'} },
  xp:   { icon:'⚡', name:{fr:'XP',   en:'XP'} },
};
function renderFarmModeBtn() {
  const el = $('farmModeBtn'); if (!el) return;
  const m = FARM_MODES[S.farmMode] || FARM_MODES.loot;
  el.textContent = m.icon + ' ' + m.name[LANG];
  el.title = LANG==='fr'
    ? (S.farmMode==='loot' ? 'IA "Loot" : ramasse tout le butin avant de passer au pack suivant (clique pour passer en XP)'
                            : 'IA "XP" : enchaîne les packs sans ramasser le butin au sol (clique pour passer en Loot)')
    : (S.farmMode==='loot' ? 'Loot AI: picks up all drops before moving to the next pack (click to switch to XP)'
                            : 'XP AI: chains packs without picking up ground loot (click to switch to Loot)');
}
function toggleFarmMode() {
  S.farmMode = S.farmMode === 'loot' ? 'xp' : 'loot';
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
  if (zoneIdx===6 || zoneIdx===7 || zoneIdx===8 || zoneIdx===14) return 10; // green
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

// vitesse réduite si le poids dépasse la limite LT — 1.0 en dessous, jusqu'à 0.35× très surchargé
// (2026-07-08 : + bonus SPD niveau/Compendium, voir totalSpdPct — s'applique APRÈS la pénalité de
// poids, un perso surchargé mais bien nivelé/complété reste quand même plus rapide qu'à niveau 1)
function speedMult() {
  const w = invWeight(), mw = MAX_WEIGHT();
  const weightMult = w <= mw ? 1 : Math.max(0.35, 1 - (w - mw) / mw * 0.7);
  const dangerMult = isZoneDangerous() ? DANGER_PLAYER_SPEED_MULT : 1;
  return weightMult * (1 + totalSpdPct()/100) * dangerMult;
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
// zone 1 jusqu'à ~100 000 silver/h en zone 11, voir zones-roadmap.md) : même utilisée en continu à
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
// prix des potions = un POURCENTAGE FIXE du revenu horaire théorique de trash (token vendu au sol,
// jamais du prix de vente du stuff) de la zone ACTUELLE (2026-07-11, demande explicite : "revois le
// prix des potion en fonction de l'argent qu'on se fait en vendant les token en instantané... et
// uniquement par rapport à ça, pas a la vente de stuff"). Remplace l'ancien amortissement en racine
// carrée (potionZoneScale, 2026-07-09) : celui-ci dérivait fortement de son propre objectif déclaré
// ("mega ne dépasse jamais ~15% du revenu horaire d'une zone adaptée") -- vérifié en simulation, le
// ratio réel allait de 42% (Camp des Loups) à seulement 3.6% (Forêt de Polly) au lieu de rester
// proche de 15% partout, car un ratio sqrt(zone.trash/zone0.trash) dérive nécessairement de sa
// cible à mesure que l'écart entre zones grandit. Ici chaque taille de potion coûte un % FIXE du
// revenu horaire de trash de SA PROPRE zone (jamais relatif à une zone de référence) : le ratio
// small/medium/large/mega entre eux reprend celui des anciens coûts de base (70/140/240/380),
// ancré sur mega = 15% (l'objectif initial), ce qui reste vrai dans TOUTE zone, sans dériver.
const POTION_KPM_REF = 15; // même rythme que la courbe économique des zones (~3000/h zone1 → ~100000/h zone11)
const POTION_MEGA_PCT_OF_HOURLY = 0.15;
function potionHourlyIncome() {
  const z = (typeof atVelia !== 'undefined' && !atVelia && typeof Z === 'function') ? Z() : ZONES[0];
  return (z.loot.trash.val || 1) * POTION_KPM_REF * 60;
}
function potionCost(baseCost) {
  if (!baseCost) return 0;
  const pct = (baseCost / POTIONS.mega.cost) * POTION_MEGA_PCT_OF_HOURLY;
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
  const w = currentWolf(target);
  if (!w) return; // sécurité : pack déjà vidé (ne devrait pas arriver, target.dead le couvre déjà)
  const crit = Math.random() < .15;
  // >>> scaling par la PA face à la PA requise de la zone <<<
  const dmg = apEff() * sk.dmg * dmgMult(apRatio()) * (1+totalDmgPct()/100)
            * (0.9+Math.random()*.25) * (crit?2:1) * (buffTimer>0?1.12:1);
  w.hp -= dmg;
  spawnVfx(sk,target);
  if (sk.shake) { shakeT=.3; shakeAmp=sk.shake; }
  const wp = wolfPos(target,w);
  floatTxt(wp.x+(Math.random()*36-18), wp.y+(Math.random()*36-18), 62,
    '-'+fmt(Math.ceil(dmg))+(crit?'!':''), {crit});
  if (w.hp <= 0 && !w.dead) killWolf(target, w);
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
  // en zone dangereuse, TOUS les packs proches se réveillent d'un coup, pas seulement celui visé
  // par l'IA (2026-07-08, demande explicite : "les monstres aggros de plus loins... dans 100% des
  // cas") -- rend le risque immédiat et évident dès qu'on s'approche, pas juste sur le pack engagé
  if (dangerous) {
    for (const p of packs) {
      if (!p.dead && !p.aggro && dist(P.x,P.y,p.x,p.y) <= 400) p.aggro = true;
    }
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
// PA/PD requis de zone, qui grandit à chaque palier) — voir zones-roadmap.md pour le détail du calcul.
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
  const chance = tier.dropChance != null ? tier.dropChance : (GEAR_CHANCE[zoneIdx] ?? .002);
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
  const chance = tier.dropChance != null ? tier.dropChance : (GEAR_CHANCE[zoneIdx] ?? .002);
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

// Trésor de Velia — catégorie EXPÉRIMENTALE ("TEST"), identique dans TOUTES les zones de Velia
// (pas de scaling par zone/palier), demande explicite du 2026-07-06. Pas encore de recette/usage :
// juste des collectibles pour l'instant, d'où le badge "TEST" dans la table de loot.
// chances RE-précisées en % explicite le 2026-07-06 (0.01% = 0.0001, pas 0.01 = 1% comme
// interprété la première fois) : 100× plus rares qu'à l'origine
const VELIA_TREASURE = [
  // fusionné en un seul objet le 2026-07-06 (demande explicite : "passage du bout de velia a 0.5%
  // fixe une seule item pas 2 et elle se loot de 1 a 3") -- avant, 2 "Bout" séparés (0.01%/0.001%)
  // menaient chacun à un Trésor différent ; un seul Bout désormais, taux fixe 0.5%, 1 à 3 par drop
  { name:'Bout du trésor de Velia',    ch:.0022,   icon:'🧩', color:'#c9a55a', key:'treasure_bout_velia' }, // 0.22% (2026-07-10, demande explicite)
  { name:'Trésor de Velia 1',         ch:.00001,  icon:'🗺️', color:'#e8c96a', key:'treasure_velia1' },
  { name:'Trésor de Velia 2',         ch:.000001, icon:'🗺️', color:'#e8c96a', key:'treasure_velia2' },
  { name:'Trésor de Velia 3',         ch:.0000001,icon:'🗺️', color:'#e8c96a', key:'treasure_velia3' },
];
// total de morceaux du Trésor de Velia ramassés À VIE (lifetime, via S.lootByItem) — utilisé par
// les succès et le classement dédié
function treasureTotal(S) {
  let total = 0;
  for (const t of new Set(VELIA_TREASURE.map(x => x.name))) total += S.lootByItem[t] || 0;
  return total;
}

// ---------- conversions du Trésor de Velia (craft) — demande explicite du 2026-07-08 ----------
// 100 "Bout du trésor de Velia N" → 1 "Trésor de Velia N" (même numéro) ; 3 Trésors de Velia AU
// TOTAL (n'importe lesquels/mélangés) → 1 "Objet inconnu" (récompense mystère, contenu réel encore
// à définir — catégorie toujours "TEST", comme le reste du Trésor de Velia).
// un seul "Bout" désormais (voir VELIA_TREASURE, fusion du 2026-07-06) : une seule recette, vers
// le 1er Trésor -- le 2e/3e restent obtenables via leur propre drop direct (très rare) dans VELIA_TREASURE
const TREASURE_PIECE_RECIPES = [
  { needKey:'treasure_bout_velia', needQty:100, giveName:'Trésor de Velia 1', giveKey:'treasure_velia1' },
];
const MYSTERY_ITEM = { name:'Objet inconnu', icon:'❓', color:'#8878aa', key:'treasure_objet_inconnu' };
const MYSTERY_NEED_QTY = 3;
const MYSTERY_SOURCE_KEYS = ['treasure_velia1','treasure_velia2','treasure_velia3'];
function invSlotByKey(key) { return INV.findIndex(s => s && s.key === key); }
function invQtyByKey(key) { const i = invSlotByKey(key); return i===-1 ? 0 : INV[i].qty; }
// une place est déjà garantie si l'objet résultant a déjà un stack existant (il fusionne dedans) —
// sinon il faut une case vide, comme n'importe quel nouvel objet
function invHasRoomFor(key) { return invSlotByKey(key) !== -1 || invUsed() < INV_SIZE; }
function craftTreasurePiece(recipe) {
  if (invQtyByKey(recipe.needKey) < recipe.needQty) return false;
  if (!invHasRoomFor(recipe.giveKey)) { floatTxt(P.x,P.y,90,LANG==='fr'?'Sac plein !':'Bag full!',{hurt:true}); return false; }
  invRemoveAt(invSlotByKey(recipe.needKey), recipe.needQty);
  invAdd({ name:recipe.giveName, kind:'treasure', icon:'🗺️', color:'#e8c96a', key:recipe.giveKey, qty:1, stackable:true, weight:0.05, val:0, ap:0, dp:0, hp:0, dodge:0 });
  trackLoot(recipe.giveName);
  floatTxt(P.x,P.y,90,'🗺️ '+recipe.giveName,{gold:true});
  logToDiscord('🔧 Craft', `**${myPseudo||'Joueur'}** combine ${recipe.needQty} morceaux en 1 ${recipe.giveName}`, 0xe8c96a);
  renderInventory();
  return true;
}
function craftMysteryItem() {
  const total = MYSTERY_SOURCE_KEYS.reduce((s,k) => s + invQtyByKey(k), 0);
  if (total < MYSTERY_NEED_QTY) return false;
  if (!invHasRoomFor(MYSTERY_ITEM.key)) { floatTxt(P.x,P.y,90,LANG==='fr'?'Sac plein !':'Bag full!',{hurt:true}); return false; }
  let remaining = MYSTERY_NEED_QTY;
  for (const k of MYSTERY_SOURCE_KEYS) {
    if (remaining <= 0) break;
    const idx = invSlotByKey(k); if (idx === -1) continue;
    const take = Math.min(INV[idx].qty, remaining);
    invRemoveAt(idx, take); remaining -= take;
  }
  invAdd({ name:MYSTERY_ITEM.name, kind:'treasure', icon:MYSTERY_ITEM.icon, color:MYSTERY_ITEM.color, key:MYSTERY_ITEM.key, qty:1, stackable:true, weight:0.05, val:0, ap:0, dp:0, hp:0, dodge:0 });
  trackLoot(MYSTERY_ITEM.name);
  floatTxt(P.x,P.y,95,'❓ '+MYSTERY_ITEM.name,{lvl:true});
  logToDiscord('❓ Objet mystère', `**${myPseudo||'Joueur'}** combine 3 Trésors de Velia en 1 Objet inconnu... quel mystère !`, 0x8878aa);
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
  const mysteryHave = MYSTERY_SOURCE_KEYS.reduce((s,k) => s + invQtyByKey(k), 0);
  const mysteryOk = mysteryHave >= MYSTERY_NEED_QTY;
  const mysteryRow = `<button class="craftRecipeBtn${mysteryOk?' ready':''}" data-kind="mystery" ${mysteryOk?'':'disabled'}>` +
    `🗺️ ${mysteryHave}/${MYSTERY_NEED_QTY} → ❓ ${LANG==='fr'?'Objet inconnu':'Unknown Item'}</button>`;
  el.innerHTML = `<div class="craftPanelTitle">${LANG==='fr'?'🔧 Combiner':'🔧 Combine'}</div>` +
    `<div class="craftRecipes">${pieceRows}${mysteryRow}</div>`;
  el.querySelectorAll('.craftRecipeBtn[data-kind="piece"]').forEach(btn => {
    btn.onclick = () => { const r = TREASURE_PIECE_RECIPES.find(x => x.needKey === btn.dataset.key); if (r) craftTreasurePiece(r); renderTreasureCraftPanel(); };
  });
  const mb = el.querySelector('.craftRecipeBtn[data-kind="mystery"]');
  if (mb) mb.onclick = () => { craftMysteryItem(); renderTreasureCraftPanel(); };
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
    { ...L.jackpot, ap:jackpotAp, val:jackpotVal, kind:'jackpot',  color:tier.color, key:'acc_'+zk+'_'+Math.random().toString(36).slice(2,7), icon:jackpotIcon, stackable:false, weight:0.5, matName:tierMat.name },
    { ...L.craft,   kind:'craft',    color:'#b48ce8', key:'craft_'+L.craft.name, icon:'✦', stackable:true, weight:0.2, val:0 },
    // "Bout du trésor de Velia" se loot par 1 à 3 (demande explicite du 2026-07-06) -- pickupQty
    // DOIT être tiré ici (dans ce tableau reconstruit à chaque kill), jamais dans la définition
    // statique de VELIA_TREASURE (const de module, évaluée UNE SEULE fois au chargement du script :
    // un Math.random() y serait figé pour toute la session au lieu d'être retiré à chaque drop)
    ...VELIA_TREASURE.map(t => ({ name:t.name, val:0, ch:t.ch, kind:'treasure', color:t.color, key:t.key, icon:t.icon, stackable:true, weight:0.05,
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
      // valeur FIXE par zone × lootMult(r) — plus aucun scaling au niveau joueur
      silver: Math.ceil((item.val||0) * (alpha?1.6:1) * lm),
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
        lootLine(it, l.silver, 'jackpot');
        floatTxt(l.x,l.y,55,'★ '+it.name,{lvl:true});
        // le centre de notifications ne garde que les infos importantes (succès, boss, niveau) —
        // les trouvailles de loot restent visibles dans le loot ticker, pas besoin de les dupliquer
        // ici (demande explicite du 2026-07-06)
        logToDiscord('💍 Bijou rare trouvé', `**${myPseudo||'Joueur'}** a trouvé ${it.name}`, 0xb48ce8);
      } else if (it.kind === 'gear') {
        S.gearDropCount = (S.gearDropCount||0) + 1;
        lootLine(it, l.silver, 'jackpot');
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
        lootLine(it, l.silver, it.kind === 'material' ? 'matLoot' : '');
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
function lootLine(item, val, cls) {
  const t = $('lootTicker');
  if (lastLootEntry && lastLootEntry.name === item.name && lastLootEntry.cls === (cls||'') && lastLootEntry.el.isConnected) {
    lastLootEntry.count++;
    lastLootEntry.val += val;
    lastLootEntry.el.textContent = (lastLootEntry.val > 0 ? `${item.name} (+${fmt(lastLootEntry.val)})` : item.name) + ` ×${lastLootEntry.count}`;
    return;
  }
  const div = document.createElement('div');
  if (cls) div.className = cls;
  div.textContent = val > 0 ? `${item.name} (+${fmt(val)})` : item.name;
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

// ==================== RENDU ====================
// BUG trouvé le 2026-07-07 : le mélange final utilisait un décalage ARITHMÉTIQUE (h>>16), dont le
// bit de signe recopié annulait systématiquement le bit 31 dans le XOR (signe ^ signe = 0) — la
// fonction ne pouvait donc JAMAIS dépasser 0.5. Conséquence silencieuse depuis toujours : aucun
// seuil de décor (rochers .965, buissons .90, touffes .78, cases "dry" .93) n'était jamais atteint,
// les zones de combat n'avaient AUCUN décor. Corrigé avec un décalage non signé (h>>>16).
function hash2(ix,iy){ let h=ix*374761393+iy*668265263; h=(h^(h>>13))*1274126177; return ((h^(h>>>16))>>>0)/4294967295; }

// Velia (zone paisible) a son propre décor chaleureux de village — pas de réutilisation du
// thème de la dernière zone de combat farmée, demande explicite du 2026-07-05
const VELIA_TINT = { a:'#6a5842', b:'#5f4d38', dry:'#7a6650' };
function drawGround() {
  const tint = atVelia ? VELIA_TINT : Z().tint;
  ctx.fillStyle = tint.b;
  ctx.fillRect(0,0,W,H);
  const TILE = 46;
  const cx0 = Math.floor((cam.x-700)/TILE), cx1 = Math.ceil((cam.x+700)/TILE);
  const cy0 = Math.floor((cam.y-700)/TILE), cy1 = Math.ceil((cam.y+700)/TILE);
  for (let ix=cx0; ix<=cx1; ix++)
    for (let iy=cy0; iy<=cy1; iy++) {
      const x=ix*TILE, y=iy*TILE;
      const a=toScreen(x,y);
      if (a.sx<-TILE*2||a.sx>W+TILE*2||a.sy<-TILE*2||a.sy>H+TILE*2) continue;
      const h = hash2(ix,iy);
      ctx.fillStyle = (ix+iy)%2===0 ? tint.a : tint.b;
      if (h > .93) ctx.fillStyle = tint.dry;
      const b=toScreen(x+TILE,y), c2=toScreen(x+TILE,y+TILE), d=toScreen(x,y+TILE);
      ctx.beginPath();
      ctx.moveTo(a.sx,a.sy); ctx.lineTo(b.sx,b.sy); ctx.lineTo(c2.sx,c2.sy); ctx.lineTo(d.sx,d.sy);
      ctx.closePath(); ctx.fill();
    }
}

function sceneryAt(ix,iy) {
  const h = hash2(ix*7+3, iy*7+11);
  if (h > .965) return { kind:'rock', x:ix*46+23, y:iy*46+23 };
  if (h > .90)  return { kind:'bush', x:ix*46+23, y:iy*46+23 };
  if (h > .78)  return { kind:'tuft', x:ix*46+23, y:iy*46+23 };
  return null;
}

// décor propre à la Mine de Fer Abandonnée (zone 6) : carrière ocre inspirée des captures de
// référence du 2026-07-07 — tours de guet en bois, pitons rocheux (petites montagnes), chariots de
// minerai cassés, crevasses dans la terre. Pas de buissons verts : terrain aride, éboulis partout.
function mineSceneryAt(ix,iy) {
  const h = hash2(ix*7+3, iy*7+11);
  if (h > .988) return { kind:'tower',    x:ix*46+23, y:iy*46+23 };
  if (h > .975) return { kind:'spire',    x:ix*46+23, y:iy*46+23 };
  if (h > .962) return { kind:'cart',     x:ix*46+23, y:iy*46+23 };
  if (h > .935) return { kind:'crevasse', x:ix*46+23, y:iy*46+23 };
  if (h > .86)  return { kind:'rock',     x:ix*46+23, y:iy*46+23 };
  if (h > .76)  return { kind:'pebbles',  x:ix*46+23, y:iy*46+23 };
  return null;
}

// décor du village de Velia (zone paisible) : maisons/puits/lampadaires disposés sur une grille
// régulière plutôt que le placement aléatoire des zones de combat, pour un vrai ressenti de village
function veliaSceneryAt(ix,iy) {
  const gx = ((ix%6)+6)%6, gy = ((iy%6)+6)%6;
  if (gx===0 && gy===0) return { kind:'house', x:ix*46+23, y:iy*46+23 };
  if (gx===3 && gy===3) return { kind:'well',  x:ix*46+23, y:iy*46+23 };
  if (gx===0 && gy===3) return { kind:'lamp',  x:ix*46+23, y:iy*46+23 };
  if (gx===3 && gy===0) return { kind:'lamp',  x:ix*46+23, y:iy*46+23 };
  const h = hash2(ix*7+3, iy*7+11);
  if (h > .9) return { kind:'bush', x:ix*46+23, y:iy*46+23 };
  return null;
}

function drawEntities(t) {
  const items = [];
  const TILE = 46;
  const cx0 = Math.floor((cam.x-700)/TILE), cx1 = Math.ceil((cam.x+700)/TILE);
  const cy0 = Math.floor((cam.y-700)/TILE), cy1 = Math.ceil((cam.y+700)/TILE);
  for (let ix=cx0; ix<=cx1; ix++)
    for (let iy=cy0; iy<=cy1; iy++) {
      const sc = atVelia ? veliaSceneryAt(ix,iy) : (zoneIdx === 6 ? mineSceneryAt(ix,iy) : sceneryAt(ix,iy));
      // les crevasses sont des marques PLATES dans le sol : dessinées tout de suite après le
      // terrain (profondeur minimale), jamais par-dessus un monstre ou le personnage
      if (sc) items.push({ depth: sc.kind==='crevasse' ? -1e9 : sc.x+sc.y, fn:()=>drawScenery(sc) });
    }
  corpses.forEach(c => items.push({ depth:c.x+c.y-1, fn:()=>drawCorpse(c) }));
  drops.forEach(l => { if (!l.taken) items.push({ depth:l.x+l.y-1, fn:()=>drawDrop(l,t) }); });
  packs.forEach(p => {
    if (p.dead) return;
    p.wolves.forEach(w => {
      if (w.dead) return; // déjà tué individuellement (2026-07-11) -- retiré de l'affichage
      const wp = wolfPos(p,w);
      items.push({ depth:wp.x+wp.y, fn:()=>drawMonsterIso(wp.x,wp.y,w,t) });
      items.push({ depth:wp.x+wp.y+1, fn:()=>drawWolfHpBar(p,w) });
    });
  });
  items.push({ depth:P.x+P.y, fn:()=>drawWitchIso(t) });
  particles.forEach(q => items.push({ depth:(q.x??P.x)+(q.y??P.y)+30, fn:()=>drawParticle(q) }));
  items.sort((a,b)=>a.depth-b.depth);
  items.forEach(i=>i.fn());
}

function drawScenery(sc) {
  const c = toScreen(sc.x,sc.y);
  if (c.sx<-40||c.sx>W+40||c.sy<-40||c.sy>H+40) return;
  if (sc.kind==='rock') {
    ctx.fillStyle='rgba(0,0,0,.2)';
    ctx.beginPath(); ctx.ellipse(c.sx,c.sy+2,10,4,0,0,7); ctx.fill();
    ctx.fillStyle='#6a6a66';
    ctx.beginPath(); ctx.moveTo(c.sx-9,c.sy); ctx.lineTo(c.sx-3,c.sy-9); ctx.lineTo(c.sx+6,c.sy-7); ctx.lineTo(c.sx+9,c.sy); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#7d7d78';
    ctx.beginPath(); ctx.moveTo(c.sx-3,c.sy-9); ctx.lineTo(c.sx+6,c.sy-7); ctx.lineTo(c.sx+2,c.sy-2); ctx.closePath(); ctx.fill();
  } else if (sc.kind==='bush') {
    ctx.fillStyle='rgba(0,0,0,.18)';
    ctx.beginPath(); ctx.ellipse(c.sx,c.sy+2,11,4,0,0,7); ctx.fill();
    ctx.fillStyle='#2c4426';
    ctx.beginPath(); ctx.arc(c.sx-5,c.sy-5,6,0,7); ctx.arc(c.sx+4,c.sy-6,7,0,7); ctx.arc(c.sx,c.sy-2,6,0,7); ctx.fill();
  } else if (sc.kind==='house') {
    // petite maison de village : socle ombré + mur clair + mur d'ombre + toit à 2 pans + porte
    ctx.fillStyle='rgba(0,0,0,.28)';
    ctx.beginPath(); ctx.ellipse(c.sx,c.sy+3,20,7,0,0,7); ctx.fill();
    ctx.fillStyle='#c9b48a';
    ctx.fillRect(c.sx-14,c.sy-17,28,17);
    ctx.fillStyle='#a8926a';
    ctx.fillRect(c.sx-14,c.sy-17,9,17);
    ctx.fillStyle='#a8402e';
    ctx.beginPath(); ctx.moveTo(c.sx-17,c.sy-17); ctx.lineTo(c.sx,c.sy-32); ctx.lineTo(c.sx+17,c.sy-17); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#8a3324';
    ctx.beginPath(); ctx.moveTo(c.sx,c.sy-32); ctx.lineTo(c.sx+17,c.sy-17); ctx.lineTo(c.sx+9,c.sy-17); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#4a3320';
    ctx.fillRect(c.sx-3,c.sy-9,6,9);
    ctx.fillStyle='#6a4a2e';
    ctx.fillRect(c.sx+5,c.sy-14,4,4);
  } else if (sc.kind==='well') {
    ctx.fillStyle='rgba(0,0,0,.22)';
    ctx.beginPath(); ctx.ellipse(c.sx,c.sy+2,10,4,0,0,7); ctx.fill();
    ctx.fillStyle='#8a8276';
    ctx.beginPath(); ctx.ellipse(c.sx,c.sy-2,9,4.4,0,0,7); ctx.fill();
    ctx.strokeStyle='#5f574c'; ctx.lineWidth=1.3;
    ctx.beginPath(); ctx.ellipse(c.sx,c.sy-2,9,4.4,0,0,7); ctx.stroke();
    ctx.strokeStyle='#4a4238'; ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.moveTo(c.sx-8,c.sy-2); ctx.lineTo(c.sx-8,c.sy-15); ctx.moveTo(c.sx+8,c.sy-2); ctx.lineTo(c.sx+8,c.sy-15); ctx.stroke();
    ctx.fillStyle='#6a4a2e'; ctx.fillRect(c.sx-9,c.sy-17,18,3);
  } else if (sc.kind==='lamp') {
    ctx.fillStyle='rgba(0,0,0,.2)';
    ctx.beginPath(); ctx.ellipse(c.sx,c.sy+1,4,2,0,0,7); ctx.fill();
    ctx.strokeStyle='#3a3a38'; ctx.lineWidth=1.6;
    ctx.beginPath(); ctx.moveTo(c.sx,c.sy); ctx.lineTo(c.sx,c.sy-20); ctx.stroke();
    ctx.fillStyle='#e6c96a';
    ctx.beginPath(); ctx.arc(c.sx,c.sy-22,3.4,0,7); ctx.fill();
    ctx.fillStyle='rgba(230,201,106,.25)';
    ctx.beginPath(); ctx.arc(c.sx,c.sy-22,7,0,7); ctx.fill();
  } else if (sc.kind==='tower') {
    // tour de guet en bois (Mine de Fer) : 4 pieds croisés + plateforme + toit pointu à débord
    ctx.fillStyle='rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(c.sx,c.sy+3,16,6,0,0,7); ctx.fill();
    ctx.strokeStyle='#4a3a28'; ctx.lineWidth=2.2;
    ctx.beginPath();
    ctx.moveTo(c.sx-11,c.sy); ctx.lineTo(c.sx-6,c.sy-34);
    ctx.moveTo(c.sx+11,c.sy); ctx.lineTo(c.sx+6,c.sy-34);
    ctx.moveTo(c.sx-10,c.sy-8); ctx.lineTo(c.sx+10,c.sy-16); // croisillons
    ctx.moveTo(c.sx+10,c.sy-8); ctx.lineTo(c.sx-10,c.sy-16);
    ctx.stroke();
    ctx.fillStyle='#6a4a2e'; // plateforme
    ctx.fillRect(c.sx-10,c.sy-37,20,4);
    ctx.fillStyle='#5a3e26'; // garde-corps
    ctx.fillRect(c.sx-10,c.sy-43,2,6); ctx.fillRect(c.sx+8,c.sy-43,2,6);
    ctx.fillStyle='#3e4a38'; // toit pointu à débord (feuillage/chaume sombre)
    ctx.beginPath(); ctx.moveTo(c.sx-14,c.sy-43); ctx.lineTo(c.sx,c.sy-54); ctx.lineTo(c.sx+14,c.sy-43); ctx.closePath(); ctx.fill();
  } else if (sc.kind==='spire') {
    // piton rocheux / petite montagne ocre à strates
    ctx.fillStyle='rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(c.sx,c.sy+3,20,7,0,0,7); ctx.fill();
    ctx.fillStyle='#6e4a34';
    ctx.beginPath();
    ctx.moveTo(c.sx-18,c.sy); ctx.lineTo(c.sx-10,c.sy-22); ctx.lineTo(c.sx-4,c.sy-40);
    ctx.lineTo(c.sx+3,c.sy-31); ctx.lineTo(c.sx+12,c.sy-18); ctx.lineTo(c.sx+18,c.sy); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#845a40'; // face éclairée
    ctx.beginPath();
    ctx.moveTo(c.sx-4,c.sy-40); ctx.lineTo(c.sx+3,c.sy-31); ctx.lineTo(c.sx+12,c.sy-18); ctx.lineTo(c.sx+6,c.sy); ctx.lineTo(c.sx-1,c.sy); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(40,24,16,.4)'; ctx.lineWidth=1; // strates
    ctx.beginPath();
    ctx.moveTo(c.sx-13,c.sy-12); ctx.lineTo(c.sx+14,c.sy-10);
    ctx.moveTo(c.sx-9,c.sy-22); ctx.lineTo(c.sx+10,c.sy-20);
    ctx.stroke();
  } else if (sc.kind==='cart') {
    // chariot de minerai cassé : caisse penchée, roue à rayons détachée, planches au sol
    ctx.fillStyle='rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(c.sx,c.sy+2,15,5,0,0,7); ctx.fill();
    ctx.save(); ctx.translate(c.sx,c.sy); ctx.rotate(-0.12); // caisse penchée (essieu cassé)
    ctx.fillStyle='#5a4430'; ctx.fillRect(-11,-13,20,9);
    ctx.fillStyle='#6e563c'; ctx.fillRect(-11,-13,20,3);
    ctx.strokeStyle='#3e2f20'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(-5,-13); ctx.lineTo(-5,-4); ctx.moveTo(2,-13); ctx.lineTo(2,-4); ctx.stroke();
    ctx.fillStyle='#4e5258'; // tas de minerai qui déborde
    ctx.beginPath(); ctx.arc(-4,-14,3,0,7); ctx.arc(1,-15,2.6,0,7); ctx.arc(5,-13.6,2.4,0,7); ctx.fill();
    ctx.restore();
    // roue à rayons détachée, posée contre la caisse
    ctx.strokeStyle='#4a3a28'; ctx.lineWidth=1.8;
    ctx.beginPath(); ctx.ellipse(c.sx+13,c.sy-5,4.8,6,0.25,0,7); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(c.sx+9.5,c.sy-8.5); ctx.lineTo(c.sx+16.5,c.sy-1.5);
    ctx.moveTo(c.sx+16,c.sy-9); ctx.lineTo(c.sx+10,c.sy-1);
    ctx.stroke();
    ctx.strokeStyle='#5a4430'; ctx.lineWidth=1.6; // planche cassée au sol
    ctx.beginPath(); ctx.moveTo(c.sx-16,c.sy+1); ctx.lineTo(c.sx-7,c.sy+4); ctx.stroke();
  } else if (sc.kind==='crevasse') {
    // crevasse : fissure sombre PLATE dans la terre (dessinée juste après le sol, voir drawEntities)
    ctx.save(); ctx.translate(c.sx,c.sy); ctx.rotate(hash2(sc.x,sc.y)*Math.PI);
    ctx.scale(1,.5); // écrasée pour suivre la perspective iso du sol
    ctx.fillStyle='rgba(18,10,7,.75)';
    ctx.beginPath();
    ctx.moveTo(-24,0); ctx.quadraticCurveTo(-10,-5, 2,-2); ctx.quadraticCurveTo(14,1, 24,-1);
    ctx.quadraticCurveTo(12,5, -2,3); ctx.quadraticCurveTo(-14,1, -24,0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(90,54,36,.5)'; ctx.lineWidth=1.2; // lèvre éclairée de la fissure
    ctx.beginPath(); ctx.moveTo(-22,-1); ctx.quadraticCurveTo(-8,-6, 4,-3); ctx.stroke();
    ctx.restore();
  } else if (sc.kind==='pebbles') {
    // éboulis : quelques cailloux ocre
    ctx.fillStyle='#6e5540';
    ctx.beginPath(); ctx.arc(c.sx-4,c.sy,2.2,0,7); ctx.fill();
    ctx.fillStyle='#7e6450';
    ctx.beginPath(); ctx.arc(c.sx+3,c.sy-1,1.7,0,7); ctx.fill();
    ctx.fillStyle='#5e4836';
    ctx.beginPath(); ctx.arc(c.sx,c.sy+3,1.4,0,7); ctx.fill();
  } else {
    ctx.strokeStyle='#57683c'; ctx.lineWidth=1.4;
    ctx.beginPath();
    ctx.moveTo(c.sx,c.sy); ctx.lineTo(c.sx-3,c.sy-7);
    ctx.moveTo(c.sx,c.sy); ctx.lineTo(c.sx+1,c.sy-8);
    ctx.moveTo(c.sx,c.sy); ctx.lineTo(c.sx+4,c.sy-6);
    ctx.stroke();
  }
}

function drawDrop(l,t) {
  const c = toScreen(l.x,l.y);
  if (c.sx<-30||c.sx>W+30||c.sy<-30||c.sy>H+30) return;
  if (l.age > DESPAWN-8 && Math.sin(t*10) > 0) return;
  const pop = 1 + l.pop*2.4;
  const bob = Math.sin(t*3+l.x)*1.5;
  ctx.fillStyle='rgba(0,0,0,.22)';
  ctx.beginPath(); ctx.ellipse(c.sx,c.sy+2,6,2.4,0,0,7); ctx.fill();
  const k = l.item.kind;
  if (k==='jackpot') {
    ctx.fillStyle='rgba(232,184,74,.3)';
    ctx.beginPath(); ctx.arc(c.sx,c.sy-6+bob,10+Math.sin(t*5)*2,0,7); ctx.fill();
    ctx.fillStyle=l.item.color;
    ctx.beginPath(); ctx.arc(c.sx,c.sy-6+bob,4.2*pop,0,7); ctx.fill();
    ctx.strokeStyle='#fff8'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(c.sx,c.sy-6+bob,4.2*pop,0,7); ctx.stroke();
  } else if (k==='craft') {
    ctx.fillStyle='rgba(180,140,232,.28)';
    ctx.beginPath(); ctx.arc(c.sx,c.sy-6+bob,9+Math.sin(t*5)*2,0,7); ctx.fill();
    ctx.fillStyle=l.item.color;
    ctx.save(); ctx.translate(c.sx,c.sy-6+bob); ctx.rotate(t*1.5);
    ctx.fillRect(-3.4*pop,-3.4*pop,6.8*pop,6.8*pop); ctx.restore();
  } else if (k==='material') {
    ctx.fillStyle=l.item.color;
    ctx.save(); ctx.translate(c.sx,c.sy-4+bob);
    ctx.beginPath(); ctx.moveTo(0,-4*pop); ctx.lineTo(3.5*pop,0); ctx.lineTo(0,4*pop); ctx.lineTo(-3.5*pop,0); ctx.closePath(); ctx.fill();
    ctx.restore();
  } else {
    ctx.fillStyle=l.item.color;
    ctx.save(); ctx.translate(c.sx,c.sy-4+bob); ctx.rotate(.6);
    ctx.fillRect(-4*pop,-2.4*pop,8*pop,4.8*pop); ctx.restore();
  }
}

function drawCorpse(cp) {
  const c = toScreen(cp.x,cp.y);
  ctx.save(); ctx.globalAlpha = Math.min(1,cp.life/1.2)*.8;
  ctx.fillStyle = cp.tone;
  ctx.beginPath(); ctx.ellipse(c.sx,c.sy,15*cp.scale,6*cp.scale,.3,0,7); ctx.fill();
  ctx.restore();
}

function drawWolfIso(wx,wy,w,t) {
  const c = toScreen(wx,wy);
  if (c.sx<-60||c.sx>W+60||c.sy<-60||c.sy>H+60) return;
  const facingRight = isoX(P.x-wx,P.y-wy) >= 0;
  const lungeAmt = w.lunge > 0 ? Math.sin((0.55-w.lunge)/0.55*Math.PI)*10 : 0;
  ctx.fillStyle='rgba(0,0,0,.28)';
  ctx.beginPath(); ctx.ellipse(c.sx,c.sy+3,15*w.scale,5,0,0,7); ctx.fill();
  ctx.save();
  ctx.translate(c.sx+(facingRight?lungeAmt:-lungeAmt), c.sy-lungeAmt*.3);
  if (!facingRight) ctx.scale(-1,1);
  ctx.scale(w.scale,w.scale);
  const trot = Math.sin(t*7+w.phase)*2;
  if (w.lunge > .3) { ctx.strokeStyle='rgba(220,80,60,.55)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(0,-12,18,11,0,0,7); ctx.stroke(); }
  ctx.fillStyle=w.tone; ctx.strokeStyle=w.tone; ctx.lineWidth=3.2; ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(-10,-6); ctx.lineTo(-11,2+trot*.4);
  ctx.moveTo(-4,-6); ctx.lineTo(-4,2-trot*.4);
  ctx.moveTo(6,-6); ctx.lineTo(6,2+trot*.3);
  ctx.moveTo(11,-6); ctx.lineTo(12,2-trot*.3);
  ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0,-11,15,7.5,-.06,0,7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(9,-10,7,6.4,.2,0,7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(17,-17+trot*.2,6.4,5,.15,0,7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(21,-18); ctx.lineTo(27,-15.6); ctx.lineTo(21,-14); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(13,-22); ctx.lineTo(15,-27); ctx.lineTo(17.5,-21.5); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(17,-22); ctx.lineTo(19.6,-26.4); ctx.lineTo(21,-21); ctx.closePath(); ctx.fill();
  ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(-14,-12); ctx.quadraticCurveTo(-21,-16+trot,-24,-11+trot); ctx.stroke();
  ctx.fillStyle = w.lunge>.3 ? '#e05540' : '#e8c25a';
  ctx.beginPath(); ctx.arc(17.5,-18+trot*.2,1.2,0,7); ctx.fill();
  ctx.restore();
}
// Esprit de Protty (zone "Ruines de Protty") — créature ORIGINALE inspirée d'un mollusque/poisson
// fantomatique flottant (dôme façon coquille, frange de nageoires, silhouette évasive), demande
// explicite du 2026-07-07 ("modélise les Protty") — aucun asset réel repris, juste l'ambiance.
function drawProttyIso(wx,wy,w,t) {
  const c = toScreen(wx,wy);
  if (c.sx<-60||c.sx>W+60||c.sy<-60||c.sy>H+60) return;
  const facingRight = isoX(P.x-wx,P.y-wy) >= 0;
  const lungeAmt = w.lunge > 0 ? Math.sin((0.55-w.lunge)/0.55*Math.PI)*10 : 0;
  const bob = Math.sin(t*2+w.phase)*2.2; // flotte doucement (créature évasive, pas de trot au sol)
  ctx.fillStyle='rgba(0,0,0,.22)';
  ctx.beginPath(); ctx.ellipse(c.sx,c.sy+3,13*w.scale,5,0,0,7); ctx.fill();
  ctx.save();
  ctx.translate(c.sx+(facingRight?lungeAmt:-lungeAmt), c.sy-lungeAmt*.3+bob);
  if (!facingRight) ctx.scale(-1,1);
  ctx.scale(w.scale,w.scale);
  if (w.lunge > .3) { ctx.strokeStyle='rgba(120,210,180,.55)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(0,-13,17,11,0,0,7); ctx.stroke(); }
  const tone = w.tone;
  // dôme/coquille (moitié supérieure d'une ellipse)
  ctx.fillStyle = tone;
  ctx.beginPath(); ctx.ellipse(0,-14,14,13,0,Math.PI,0,true); ctx.fill();
  // sous-ventre pâle, translucide
  ctx.fillStyle='rgba(216,205,184,.92)';
  ctx.beginPath(); ctx.ellipse(0,-6,10.5,7,0,0,Math.PI); ctx.fill();
  // frange de nageoires ondulantes sur le sommet du dôme
  ctx.fillStyle='#c9d86a';
  [[-9,0],[-3,1],[3,1],[9,0]].forEach(([dx,ph],i) => {
    const sway = Math.sin(t*3+w.phase+ph)*1.6;
    ctx.beginPath(); ctx.moveTo(dx,-22); ctx.lineTo(dx+sway,-28-Math.abs(sway)*.3); ctx.lineTo(dx+3.2,-21.5); ctx.closePath(); ctx.fill();
  });
  // nageoires latérales (façon poisson)
  ctx.fillStyle = tone;
  ctx.beginPath(); ctx.moveTo(-13,-13); ctx.lineTo(-21,-9+Math.sin(t*4+w.phase)*2); ctx.lineTo(-12,-6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(13,-13); ctx.lineTo(21,-9-Math.sin(t*4+w.phase)*2); ctx.lineTo(12,-6); ctx.closePath(); ctx.fill();
  // petit oeil sombre
  ctx.fillStyle = w.lunge>.3 ? '#e05540' : '#2a2420';
  ctx.beginPath(); ctx.arc(4.5,-11,1.5,0,7); ctx.fill();
  ctx.restore();
}
// Pirate (zone "Repaire des Pirates", juste après Ruines de Protty) — créature ORIGINALE
// humanoïde : bandana, barbe, gilet ouvert sur le torse, lame en main. Demande explicite du
// 2026-07-07 ("les pirates juste après Protty") — aucun asset réel repris, juste l'ambiance.
function drawPirateIso(wx,wy,w,t) {
  const c = toScreen(wx,wy);
  if (c.sx<-60||c.sx>W+60||c.sy<-60||c.sy>H+60) return;
  const facingRight = isoX(P.x-wx,P.y-wy) >= 0;
  const lungeAmt = w.lunge > 0 ? Math.sin((0.55-w.lunge)/0.55*Math.PI)*10 : 0;
  ctx.fillStyle='rgba(0,0,0,.28)';
  ctx.beginPath(); ctx.ellipse(c.sx,c.sy+3,11*w.scale,4.5,0,0,7); ctx.fill();
  ctx.save();
  ctx.translate(c.sx+(facingRight?lungeAmt:-lungeAmt), c.sy-lungeAmt*.3);
  if (!facingRight) ctx.scale(-1,1);
  ctx.scale(w.scale,w.scale);
  const trot = Math.sin(t*6+w.phase)*1.4; // léger balancement de marche
  if (w.lunge > .3) { ctx.strokeStyle='rgba(220,80,60,.55)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(0,-16,14,10,0,0,7); ctx.stroke(); }
  const tone = w.tone; // teinte du gilet, variété par zone (comme les autres monstres)
  // jambes
  ctx.strokeStyle='#3a3228'; ctx.lineWidth=3.4; ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(-3,-8); ctx.lineTo(-4,3+trot*.5);
  ctx.moveTo(3,-8); ctx.lineTo(4,3-trot*.5);
  ctx.stroke();
  // torse / gilet
  ctx.fillStyle = tone;
  ctx.beginPath(); ctx.moveTo(-7,-9); ctx.lineTo(-6,-24); ctx.lineTo(6,-24); ctx.lineTo(7,-9); ctx.closePath(); ctx.fill();
  // torse nu au centre (gilet ouvert)
  ctx.fillStyle='#c9a074';
  ctx.beginPath(); ctx.moveTo(-2.4,-23); ctx.lineTo(-2,-10); ctx.lineTo(2,-10); ctx.lineTo(2.4,-23); ctx.closePath(); ctx.fill();
  // bras armé + lame (avance en cas d'attaque)
  ctx.strokeStyle = tone; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(6,-22); ctx.lineTo(11+lungeAmt*.4,-14); ctx.stroke();
  ctx.strokeStyle='#c9ccd2'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(11+lungeAmt*.4,-14); ctx.lineTo(17+lungeAmt*.6,-20); ctx.stroke();
  // tête (peau)
  ctx.fillStyle='#c9a074';
  ctx.beginPath(); ctx.arc(0,-28,4.4,0,7); ctx.fill();
  // barbe
  ctx.fillStyle='#241d16';
  ctx.beginPath(); ctx.arc(0,-25.5,3.6,0.15,Math.PI-0.15); ctx.fill();
  // bandana + pan noué derrière
  ctx.fillStyle = w.lunge>.3 ? '#c05545' : '#a03a2e';
  ctx.beginPath(); ctx.arc(0,-30,4.6,Math.PI,0); ctx.fill();
  ctx.beginPath(); ctx.moveTo(3.6,-29); ctx.lineTo(7,-27); ctx.lineTo(3.2,-26.4); ctx.closePath(); ctx.fill();
  ctx.restore();
}
// Guerrier Rhutum (zone "Camp Rhutum", juste après le Repaire des Pirates) — créature ORIGINALE :
// humanoïde massif à peau verte, crâne rasé à crête de plumes/piquants, bouc tressé, torse épais et
// bras noueux. Demande explicite du 2026-07-07 ("camp de ruthum... avec ce que je t'envoie comme
// screen") — inspiré de l'ambiance des images de référence (guerrier/archer orc), aucun asset réel repris.
function drawRhutumIso(wx,wy,w,t) {
  const c = toScreen(wx,wy);
  if (c.sx<-60||c.sx>W+60||c.sy<-60||c.sy>H+60) return;
  const facingRight = isoX(P.x-wx,P.y-wy) >= 0;
  const lungeAmt = w.lunge > 0 ? Math.sin((0.55-w.lunge)/0.55*Math.PI)*10 : 0;
  ctx.fillStyle='rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(c.sx,c.sy+3,12.5*w.scale,5,0,0,7); ctx.fill();
  ctx.save();
  ctx.translate(c.sx+(facingRight?lungeAmt:-lungeAmt), c.sy-lungeAmt*.3);
  if (!facingRight) ctx.scale(-1,1);
  ctx.scale(w.scale,w.scale);
  const trot = Math.sin(t*5.5+w.phase)*1.6; // démarche lourde
  if (w.lunge > .3) { ctx.strokeStyle='rgba(120,200,110,.5)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(0,-17,15,11,0,0,7); ctx.stroke(); }
  const strap = w.tone; // teinte des sangles/pagne en cuir, variété par zone (comme les autres monstres)
  const skin = '#7a9a52';
  // jambes épaisses
  ctx.strokeStyle='#3e3226'; ctx.lineWidth=4.4; ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(-4,-9); ctx.lineTo(-5,3+trot*.5);
  ctx.moveTo(4,-9); ctx.lineTo(5,3-trot*.5);
  ctx.stroke();
  // torse massif (peau)
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.moveTo(-9,-9); ctx.lineTo(-8,-26); ctx.lineTo(8,-26); ctx.lineTo(9,-9); ctx.closePath(); ctx.fill();
  // sangle/pagne en cuir sur le torse (teinte de zone)
  ctx.strokeStyle = strap; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(-7,-24); ctx.lineTo(6,-11); ctx.stroke();
  // bras noueux + arme (avance en cas d'attaque)
  ctx.strokeStyle = skin; ctx.lineWidth=4.2; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(8,-23); ctx.lineTo(13+lungeAmt*.45,-13); ctx.stroke();
  ctx.strokeStyle='#8a8378'; ctx.lineWidth=2.4;
  ctx.beginPath(); ctx.moveTo(13+lungeAmt*.45,-13); ctx.lineTo(20+lungeAmt*.7,-19); ctx.stroke();
  // tête (peau verte)
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(0,-30,5,0,7); ctx.fill();
  // mâchoire proéminente + bouc tressé
  ctx.fillStyle='#241d16';
  ctx.beginPath(); ctx.arc(0,-27,3.4,0.1,Math.PI-0.1); ctx.fill();
  // défenses
  ctx.fillStyle='#e8e2d0';
  ctx.beginPath(); ctx.moveTo(-2.6,-26.5); ctx.lineTo(-3.2,-24); ctx.lineTo(-1.6,-25); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(2.6,-26.5); ctx.lineTo(3.2,-24); ctx.lineTo(1.6,-25); ctx.closePath(); ctx.fill();
  // crête de plumes/piquants sur le crâne (rouge, comme les images de référence)
  ctx.fillStyle = w.lunge>.3 ? '#c8503a' : '#a8402c';
  for (let i=-1; i<=1; i++) {
    ctx.beginPath();
    ctx.moveTo(i*2.4,-34); ctx.lineTo(i*2.4-0.9,-40-Math.abs(i)*2); ctx.lineTo(i*2.4+0.9,-34); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
// Garde Shultz (zone "Ferme Shultz", juste après le Camp Rhutum) — créature ORIGINALE : garde
// humain lourdement blindé, casque à cimier empanaché, épaulières massives, bouc/moustache blanche,
// arme lourde brandie au-dessus de la tête. Demande explicite du 2026-07-07 ("Shultz aide toi des
// screen") — inspiré de l'ambiance des captures (garde de camp BDO en armure complète), aucun
// asset réel repris.
function drawShultzIso(wx,wy,w,t) {
  const c = toScreen(wx,wy);
  if (c.sx<-60||c.sx>W+60||c.sy<-60||c.sy>H+60) return;
  const facingRight = isoX(P.x-wx,P.y-wy) >= 0;
  const lungeAmt = w.lunge > 0 ? Math.sin((0.55-w.lunge)/0.55*Math.PI)*10 : 0;
  ctx.fillStyle='rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(c.sx,c.sy+3,12*w.scale,5,0,0,7); ctx.fill();
  ctx.save();
  ctx.translate(c.sx+(facingRight?lungeAmt:-lungeAmt), c.sy-lungeAmt*.3);
  if (!facingRight) ctx.scale(-1,1);
  ctx.scale(w.scale,w.scale);
  const trot = Math.sin(t*5+w.phase)*1.2; // démarche lourde, blindée
  if (w.lunge > .3) { ctx.strokeStyle='rgba(200,190,140,.5)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(0,-17,15,11,0,0,7); ctx.stroke(); }
  const plate = w.tone; // teinte des plaques d'armure, variété par zone (comme les autres monstres)
  // jambières
  ctx.strokeStyle='#2c2a26'; ctx.lineWidth=4.6; ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(-4,-9); ctx.lineTo(-5,3+trot*.4);
  ctx.moveTo(4,-9); ctx.lineTo(5,3-trot*.4);
  ctx.stroke();
  // torse blindé (plastron)
  ctx.fillStyle = plate;
  ctx.beginPath(); ctx.moveTo(-9,-9); ctx.lineTo(-8,-25); ctx.lineTo(8,-25); ctx.lineTo(9,-9); ctx.closePath(); ctx.fill();
  // liseré doré sur le plastron
  ctx.strokeStyle='#c9a55a'; ctx.lineWidth=1.4;
  ctx.beginPath(); ctx.moveTo(-7,-12); ctx.lineTo(7,-12); ctx.stroke();
  // épaulières massives
  ctx.fillStyle = plate;
  ctx.beginPath(); ctx.ellipse(-9,-23,4,3.4,0,0,7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(9,-23,4,3.4,0,0,7); ctx.fill();
  // bras + arme lourde brandie au-dessus de la tête (descend un peu lors de l'attaque)
  ctx.strokeStyle='#8a7a5a'; ctx.lineWidth=3.6; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(7,-22); ctx.lineTo(10,-30+lungeAmt*.3); ctx.stroke();
  ctx.strokeStyle='#9ba0a8'; ctx.lineWidth=2.6;
  ctx.beginPath(); ctx.moveTo(10,-30+lungeAmt*.3); ctx.lineTo(9,-41+lungeAmt*.5); ctx.stroke();
  ctx.fillStyle='#c9ccd2';
  ctx.beginPath(); ctx.moveTo(6,-40); ctx.lineTo(9,-46); ctx.lineTo(12,-40); ctx.closePath(); ctx.fill();
  // tête (peau) + moustache/bouc blanc
  ctx.fillStyle='#c9a074';
  ctx.beginPath(); ctx.arc(0,-29,4.6,0,7); ctx.fill();
  ctx.fillStyle='#d8d2c4';
  ctx.beginPath(); ctx.arc(0,-26,3.6,0.1,Math.PI-0.1); ctx.fill();
  // casque à cimier (plaque + empanachement)
  ctx.fillStyle = plate;
  ctx.beginPath(); ctx.arc(0,-31,4.9,Math.PI,0); ctx.fill();
  ctx.fillStyle = w.lunge>.3 ? '#c8503a' : '#a8402c';
  ctx.beginPath(); ctx.moveTo(-1.4,-35); ctx.lineTo(0,-43); ctx.lineTo(1.4,-35); ctx.closePath(); ctx.fill();
  ctx.restore();
}
// Combattant Sausan (zone "Colonie Sausan", juste après la Ferme Shultz) — créature ORIGINALE :
// guerrier des sables en cotte de mailles, capuche pointue rabattue et voile de tissu masquant le
// bas du visage, longue tunique/pan qui flotte. Demande explicite du 2026-07-07 ("Fais moi les
// sausans") — inspiré de l'ambiance des captures (soldats encapuchonnés en mailles, désert), aucun
// asset réel repris. Volontairement distinct du Garde Shultz (plaques + casque à cimier) : ici,
// mailles souples + capuche + voile.
function drawSausanIso(wx,wy,w,t) {
  const c = toScreen(wx,wy);
  if (c.sx<-60||c.sx>W+60||c.sy<-60||c.sy>H+60) return;
  const facingRight = isoX(P.x-wx,P.y-wy) >= 0;
  const lungeAmt = w.lunge > 0 ? Math.sin((0.55-w.lunge)/0.55*Math.PI)*10 : 0;
  ctx.fillStyle='rgba(0,0,0,.28)';
  ctx.beginPath(); ctx.ellipse(c.sx,c.sy+3,11*w.scale,4.5,0,0,7); ctx.fill();
  ctx.save();
  ctx.translate(c.sx+(facingRight?lungeAmt:-lungeAmt), c.sy-lungeAmt*.3);
  if (!facingRight) ctx.scale(-1,1);
  ctx.scale(w.scale,w.scale);
  const trot = Math.sin(t*5.5+w.phase)*1.3;
  const sway = Math.sin(t*3+w.phase)*1.1; // le pan de tunique flotte
  if (w.lunge > .3) { ctx.strokeStyle='rgba(210,190,140,.5)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(0,-16,14,10,0,0,7); ctx.stroke(); }
  const cloth = w.tone; // teinte de la tunique/mailles, variété par zone (comme les autres monstres)
  // jambes
  ctx.strokeStyle='#3a352c'; ctx.lineWidth=3.4; ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(-3,-8); ctx.lineTo(-4,3+trot*.5);
  ctx.moveTo(3,-8); ctx.lineTo(4,3-trot*.5);
  ctx.stroke();
  // longue tunique en cotte de mailles (s'évase vers le bas, avec un pan qui flotte)
  ctx.fillStyle = cloth;
  ctx.beginPath();
  ctx.moveTo(-7,-9); ctx.lineTo(-6,-24); ctx.lineTo(6,-24); ctx.lineTo(7,-9);
  ctx.lineTo(5+sway,-2); ctx.lineTo(-5+sway,-2); ctx.closePath(); ctx.fill();
  // texture de mailles (petits reflets)
  ctx.strokeStyle='rgba(230,230,240,.18)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(-5,-20); ctx.lineTo(5,-20); ctx.moveTo(-5,-15); ctx.lineTo(5,-15); ctx.moveTo(-5,-10); ctx.lineTo(5,-10); ctx.stroke();
  // ceinture
  ctx.strokeStyle='#5a4632'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(-6,-12); ctx.lineTo(6,-12); ctx.stroke();
  // bras armé + lame courbe (cimeterre) qui avance en attaque
  ctx.strokeStyle = cloth; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(6,-21); ctx.lineTo(11+lungeAmt*.4,-15); ctx.stroke();
  ctx.strokeStyle='#c9ccd2'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(11+lungeAmt*.4,-15); ctx.quadraticCurveTo(17+lungeAmt*.6,-18, 16+lungeAmt*.6,-24); ctx.stroke();
  // tête voilée (bas du visage en tissu)
  ctx.fillStyle='#b8a382';
  ctx.beginPath(); ctx.arc(0,-28,4.2,0,7); ctx.fill();
  ctx.fillStyle = cloth; // voile de tissu sur le bas du visage
  ctx.beginPath(); ctx.arc(0,-26.5,3.9,0.1,Math.PI-0.1); ctx.fill();
  // fente des yeux (ombre)
  ctx.strokeStyle='rgba(20,16,10,.8)'; ctx.lineWidth=1.2;
  ctx.beginPath(); ctx.moveTo(-2.4,-29); ctx.lineTo(2.4,-29); ctx.stroke();
  // capuche pointue rabattue par-dessus la tête
  ctx.fillStyle = cloth;
  ctx.beginPath();
  ctx.moveTo(-5,-28); ctx.quadraticCurveTo(-5.5,-35, 0,-37.5);
  ctx.quadraticCurveTo(5.5,-35, 5,-28);
  ctx.quadraticCurveTo(0,-31, -5,-28); ctx.closePath(); ctx.fill();
  // pointe de la capuche
  ctx.beginPath(); ctx.moveTo(0,-37.5); ctx.lineTo(-1.6,-34); ctx.lineTo(1.6,-34); ctx.closePath(); ctx.fill();
  ctx.restore();
}
// Mineur corrompu (zone "Mine de Fer Abandonnée", juste après la Colonie Sausan) — créatures
// ORIGINALES, demande explicite du 2026-07-07 avec captures de référence (carrière ocre, mineurs
// encapuchonnés, brutes blindées à pointes près des chariots) — aucun asset réel repris :
//  - mob normal : mineur voûté encapuchonné, tunique poussiéreuse, pioche à l'épaule
//  - boss de pack (w.alpha, 1 pack sur 2 dans cette zone) : contremaître massif en armure de fer
//    bardée de pointes, épaulières rondes cloutées, masse énorme — silhouette bien plus large
function drawMineurIso(wx,wy,w,t) {
  const c = toScreen(wx,wy);
  if (c.sx<-60||c.sx>W+60||c.sy<-60||c.sy>H+60) return;
  const facingRight = isoX(P.x-wx,P.y-wy) >= 0;
  const lungeAmt = w.lunge > 0 ? Math.sin((0.55-w.lunge)/0.55*Math.PI)*10 : 0;
  ctx.fillStyle='rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(c.sx,c.sy+3,(w.alpha?14:10.5)*w.scale,(w.alpha?5.5:4.5),0,0,7); ctx.fill();
  ctx.save();
  ctx.translate(c.sx+(facingRight?lungeAmt:-lungeAmt), c.sy-lungeAmt*.3);
  if (!facingRight) ctx.scale(-1,1);
  ctx.scale(w.scale,w.scale);
  const trot = Math.sin(t*(w.alpha?4.5:6)+w.phase)*(w.alpha?1.1:1.4);
  if (w.lunge > .3) { ctx.strokeStyle='rgba(200,120,80,.55)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(0,-16,w.alpha?17:14,w.alpha?12:10,0,0,7); ctx.stroke(); }
  const tone = w.tone;
  if (w.alpha) {
    // ---- contremaître blindé (boss de pack) ----
    // jambes blindées écartées
    ctx.strokeStyle='#2e3238'; ctx.lineWidth=5; ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(-5,-8); ctx.lineTo(-6.5,3+trot*.4);
    ctx.moveTo(5,-8); ctx.lineTo(6.5,3-trot*.4);
    ctx.stroke();
    // corps rond massif en fer (dos voûté vers l'avant)
    ctx.fillStyle = tone;
    ctx.beginPath(); ctx.ellipse(0,-17,10.5,9.5,0,0,7); ctx.fill();
    // reflets de plaques
    ctx.strokeStyle='rgba(220,228,240,.22)'; ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.ellipse(0,-17,7.5,6.5,0,Math.PI*1.15,Math.PI*1.85); ctx.stroke();
    // pointes sur le dos et les épaules (comme la brute des captures)
    ctx.fillStyle='#3a3e44';
    for (const [px,py,ang] of [[-8,-23,-2.3],[-3,-26,-1.85],[3,-26,-1.3],[8,-23,-0.85]]) {
      ctx.save(); ctx.translate(px,py); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(-1.6,0); ctx.lineTo(0,-5.5); ctx.lineTo(1.6,0); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // épaulière ronde cloutée côté arme
    ctx.fillStyle='#4a5058';
    ctx.beginPath(); ctx.arc(9,-22,4.6,0,7); ctx.fill();
    ctx.fillStyle='#22262c';
    ctx.beginPath(); ctx.arc(9,-22,1.6,0,7); ctx.fill();
    // bras + masse énorme (s'abat lors de l'attaque)
    ctx.strokeStyle='#2e3238'; ctx.lineWidth=4.4; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(10,-20); ctx.lineTo(15+lungeAmt*.5,-12); ctx.stroke();
    ctx.strokeStyle='#5a4a38'; ctx.lineWidth=2.6;
    ctx.beginPath(); ctx.moveTo(15+lungeAmt*.5,-12); ctx.lineTo(21+lungeAmt*.7,-22); ctx.stroke();
    ctx.fillStyle='#6a7078';
    ctx.beginPath(); ctx.ellipse(21+lungeAmt*.7,-24,3.6,4.6,0.3,0,7); ctx.fill();
    ctx.fillStyle='#3a3e44';
    for (const ang of [-1.2,0,1.2]) {
      ctx.save(); ctx.translate(21+lungeAmt*.7,-24); ctx.rotate(ang+0.3);
      ctx.beginPath(); ctx.moveTo(-1.2,-4); ctx.lineTo(0,-7.5); ctx.lineTo(1.2,-4); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // petite tête casquée enfoncée dans les épaules
    ctx.fillStyle='#4a5058';
    ctx.beginPath(); ctx.arc(2,-27,3.6,0,7); ctx.fill();
    ctx.fillStyle='rgba(10,8,6,.85)';
    ctx.beginPath(); ctx.arc(2.8,-26.4,1.7,0,7); ctx.fill(); // fente d'ombre du casque
  } else {
    // ---- mineur corrompu (mob normal, voûté) ----
    // jambes
    ctx.strokeStyle='#3a332a'; ctx.lineWidth=3.2; ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(-3,-7); ctx.lineTo(-4,3+trot*.5);
    ctx.moveTo(3,-7); ctx.lineTo(4,3-trot*.5);
    ctx.stroke();
    // tunique poussiéreuse, dos voûté (penché vers l'avant)
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(-6,-7); ctx.quadraticCurveTo(-8,-18, -2,-23);
    ctx.lineTo(4,-22); ctx.quadraticCurveTo(7,-14, 6,-7); ctx.closePath(); ctx.fill();
    // bras qui tient la pioche à l'épaule (la pioche pique en avant à l'attaque)
    ctx.strokeStyle = tone; ctx.lineWidth=2.8;
    ctx.beginPath(); ctx.moveTo(4,-19); ctx.lineTo(9+lungeAmt*.4,-13); ctx.stroke();
    ctx.strokeStyle='#5a4a38'; ctx.lineWidth=1.8; // manche
    ctx.beginPath(); ctx.moveTo(9+lungeAmt*.4,-13); ctx.lineTo(13+lungeAmt*.6,-24); ctx.stroke();
    ctx.strokeStyle='#8a8f96'; ctx.lineWidth=2.2; // fer de pioche
    ctx.beginPath(); ctx.moveTo(10+lungeAmt*.6,-26); ctx.quadraticCurveTo(13+lungeAmt*.6,-27.5, 16+lungeAmt*.6,-25); ctx.stroke();
    // tête encapuchonnée penchée (capuche tombante, visage dans l'ombre)
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(-4,-21); ctx.quadraticCurveTo(-3,-28.5, 2,-28);
    ctx.quadraticCurveTo(6,-27, 5,-21.5); ctx.quadraticCurveTo(0,-24, -4,-21); ctx.closePath(); ctx.fill();
    // ombre du visage sous la capuche + yeux corrompus rougeoyants
    ctx.fillStyle='rgba(12,8,6,.9)';
    ctx.beginPath(); ctx.ellipse(1.5,-22.5,2.8,2.2,-0.3,0,7); ctx.fill();
    ctx.fillStyle = w.lunge>.3 ? '#ff6a4a' : '#c8503a';
    ctx.beginPath(); ctx.arc(0.8,-22.8,0.7,0,7); ctx.fill();
    ctx.beginPath(); ctx.arc(2.8,-22.4,0.7,0,7); ctx.fill();
  }
  ctx.restore();
}
// petite icône (buste simplifié, statique) du monstre de la zone en cours, affichée en haut à
// gauche de l'écran de jeu — demande explicite du 2026-07-07. Volontairement un dessin à PART des
// silhouettes iso animées ci-dessus (même logique que les icônes d'équipement, déjà des SVG à part
// du rendu en jeu) : plus simple et robuste qu'essayer de réutiliser le rendu iso dépendant de la
// caméra dans un petit canvas indépendant.
function drawZoneMobIcon() {
  const cv2 = $('zoneMobIcon'); if (!cv2) return;
  const ctx2 = cv2.getContext('2d');
  ctx2.clearRect(0,0,34,34);
  ctx2.save();
  ctx2.translate(17,19);
  if (atVelia) {
    // zone paisible : pas de monstre, un petit feuillage doré à la place
    ctx2.fillStyle='#c9a55a';
    ctx2.beginPath(); ctx2.ellipse(-3,0,5,3,0.5,0,7); ctx2.fill();
    ctx2.beginPath(); ctx2.ellipse(3,-2,5,3,-0.5,0,7); ctx2.fill();
    ctx2.strokeStyle='#8a7038'; ctx2.lineWidth=1;
    ctx2.beginPath(); ctx2.moveTo(0,6); ctx2.lineTo(0,-4); ctx2.stroke();
    ctx2.restore();
    return;
  }
  const zi = zoneIdx;
  const tone = (Z().tones && Z().tones[0]) || '#8a8a8a';
  if (zi === 1) { // Esprit de Protty
    ctx2.fillStyle='#cfc6e0';
    ctx2.beginPath(); ctx2.ellipse(0,0,8,7,0,Math.PI,0); ctx2.fill();
    ctx2.beginPath(); ctx2.ellipse(0,3,6,4,0,0,Math.PI); ctx2.fill();
    ctx2.fillStyle='#8878aa';
    ctx2.beginPath(); ctx2.arc(-2.5,-1,1.3,0,7); ctx2.fill();
    ctx2.beginPath(); ctx2.arc(2.5,-1,1.3,0,7); ctx2.fill();
  } else if (zi === 2) { // Pirate
    ctx2.fillStyle='#c9a074';
    ctx2.beginPath(); ctx2.arc(0,0,7,0,7); ctx2.fill();
    ctx2.fillStyle='#241d16';
    ctx2.beginPath(); ctx2.arc(0,4,5.5,0.15,Math.PI-0.15); ctx2.fill();
    ctx2.fillStyle='#a03a2e';
    ctx2.beginPath(); ctx2.arc(0,-3,7.4,Math.PI,0); ctx2.fill();
  } else if (zi === 3) { // Guerrier Rhutum
    ctx2.fillStyle='#7a9a52';
    ctx2.beginPath(); ctx2.arc(0,0,7.5,0,7); ctx2.fill();
    ctx2.fillStyle='#241d16';
    ctx2.beginPath(); ctx2.arc(0,4,5,0.1,Math.PI-0.1); ctx2.fill();
    ctx2.fillStyle='#a8402c';
    for (let i=-1;i<=1;i++) {
      ctx2.beginPath();
      ctx2.moveTo(i*3.4,-6); ctx2.lineTo(i*3.4-1.2,-13-Math.abs(i)*2); ctx2.lineTo(i*3.4+1.2,-6); ctx2.closePath(); ctx2.fill();
    }
  } else if (zi === 4) { // Garde Shultz
    ctx2.fillStyle='#c9a074';
    ctx2.beginPath(); ctx2.arc(0,1,7,0,7); ctx2.fill();
    ctx2.fillStyle='#d8d2c4';
    ctx2.beginPath(); ctx2.arc(0,4,5,0.1,Math.PI-0.1); ctx2.fill();
    ctx2.fillStyle=tone;
    ctx2.beginPath(); ctx2.arc(0,-2,7.6,Math.PI,0); ctx2.fill();
    ctx2.fillStyle='#a8402c';
    ctx2.beginPath(); ctx2.moveTo(-1.6,-8); ctx2.lineTo(0,-14); ctx2.lineTo(1.6,-8); ctx2.closePath(); ctx2.fill();
  } else if (zi === 5) { // Combattant Sausan (capuche pointue + voile)
    ctx2.fillStyle='#b8a382';
    ctx2.beginPath(); ctx2.arc(0,1,6.4,0,7); ctx2.fill();
    ctx2.fillStyle=tone; // voile de tissu sur le bas du visage
    ctx2.beginPath(); ctx2.arc(0,4,5,0.1,Math.PI-0.1); ctx2.fill();
    ctx2.strokeStyle='rgba(20,16,10,.8)'; ctx2.lineWidth=1.4; // fente des yeux
    ctx2.beginPath(); ctx2.moveTo(-3,-1); ctx2.lineTo(3,-1); ctx2.stroke();
    ctx2.fillStyle=tone; // capuche pointue rabattue
    ctx2.beginPath();
    ctx2.moveTo(-7,-1); ctx2.quadraticCurveTo(-8,-11, 0,-15);
    ctx2.quadraticCurveTo(8,-11, 7,-1);
    ctx2.quadraticCurveTo(0,-5, -7,-1); ctx2.closePath(); ctx2.fill();
    ctx2.beginPath(); ctx2.moveTo(0,-15); ctx2.lineTo(-2.4,-10); ctx2.lineTo(2.4,-10); ctx2.closePath(); ctx2.fill();
  } else if (zi === 6) { // Mineur corrompu (capuche tombante + yeux rougeoyants)
    ctx2.fillStyle=tone;
    ctx2.beginPath();
    ctx2.moveTo(-7,3); ctx2.quadraticCurveTo(-7.5,-9, 0,-11);
    ctx2.quadraticCurveTo(7.5,-9, 7,3); ctx2.closePath(); ctx2.fill();
    ctx2.fillStyle='rgba(12,8,6,.92)';
    ctx2.beginPath(); ctx2.ellipse(0,-2,4.4,3.6,0,0,7); ctx2.fill();
    ctx2.fillStyle='#c8503a';
    ctx2.beginPath(); ctx2.arc(-1.8,-2.4,1,0,7); ctx2.fill();
    ctx2.beginPath(); ctx2.arc(1.8,-2.4,1,0,7); ctx2.fill();
  } else { // silhouette générique (loup) — zones sans modèle dédié pour l'instant
    ctx2.fillStyle='#8a8f96';
    ctx2.beginPath(); ctx2.moveTo(-6,4); ctx2.lineTo(-8,-6); ctx2.lineTo(-3,-2); ctx2.lineTo(0,-8); ctx2.lineTo(3,-2); ctx2.lineTo(8,-6); ctx2.lineTo(6,4); ctx2.closePath(); ctx2.fill();
    ctx2.fillStyle='#c9ccd2';
    ctx2.beginPath(); ctx2.moveTo(-2,4); ctx2.lineTo(0,7); ctx2.lineTo(2,4); ctx2.closePath(); ctx2.fill();
  }
  ctx2.restore();
}
// dispatcher : chaque zone peut avoir sa propre silhouette de monstre — pour l'instant "Ruines de
// Protty" (zone index 1), "Repaire des Pirates" (zone index 2), "Camp Rhutum" (zone index 3),
// "Ferme Shultz" (zone index 4), "Colonie Sausan" (zone index 5) et "Mine de Fer Abandonnée"
// (zone index 6, avec sa variante boss blindée) ont la leur, les autres zones gardent la
// silhouette générique
function drawMonsterIso(wx,wy,w,t) {
  if (zoneIdx === 1) return drawProttyIso(wx,wy,w,t);
  if (zoneIdx === 2) return drawPirateIso(wx,wy,w,t);
  if (zoneIdx === 3) return drawRhutumIso(wx,wy,w,t);
  if (zoneIdx === 4) return drawShultzIso(wx,wy,w,t);
  if (zoneIdx === 5) return drawSausanIso(wx,wy,w,t);
  if (zoneIdx === 6) return drawMineurIso(wx,wy,w,t);
  return drawWolfIso(wx,wy,w,t);
}

// une barre de vie PAR MONSTRE (2026-07-11, demande explicite : "chaque monstre a sa propre barre
// de vie") -- remplace l'ancienne drawPackBar, unique et partagée par tout le pack
function drawWolfHpBar(p, w) {
  const wp = wolfPos(p,w);
  const c = toScreen(wp.x,wp.y);
  const bw = w.alpha?46:28, pct = Math.max(0,w.hp/w.maxHp);
  const y = c.sy-(w.alpha?50:36);
  ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(c.sx-bw/2,y,bw,4.5);
  ctx.fillStyle = pct>.35 ? '#a33d34' : '#7a2d26';
  ctx.fillRect(c.sx-bw/2,y,bw*pct,4.5);
  ctx.strokeStyle='#00000088'; ctx.strokeRect(c.sx-bw/2+.5,y+.5,bw,4.5);
  if (w.alpha) {
    ctx.fillStyle='#c9a55a'; ctx.font='bold 8px Georgia'; ctx.textAlign='center';
    ctx.fillText('◆',c.sx,y-4); ctx.textAlign='left';
  }
}

function drawWitchIso(t) {
  const c = toScreen(P.x,P.y);
  if (P.faint > 0) {
    ctx.save(); ctx.translate(c.sx,c.sy-6); ctx.rotate(-Math.PI/2); ctx.globalAlpha=.7;
    witchBody(t,false); ctx.restore();
    ctx.fillStyle='#e06050'; ctx.font='bold 11px Georgia'; ctx.textAlign='center';
    ctx.fillText('K.O. '+Math.ceil(P.faint)+'s',c.sx,c.sy-46); ctx.textAlign='left';
    return;
  }
  const walking = ['move','loot','kite','gather'].includes(P.state);
  const bobY = Math.sin(P.bob)*(walking?3:1.2);
  ctx.fillStyle='rgba(0,0,0,.32)';
  ctx.beginPath(); ctx.ellipse(c.sx,c.sy+3,12,4.4,0,0,7); ctx.fill();
  if (P.state==='loot') {
    ctx.strokeStyle='rgba(201,165,90,.22)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.ellipse(c.sx,c.sy+2,S.lootRadius,S.lootRadius*.5,0,0,7); ctx.stroke();
  }
  if (P.tpFlash > 0) {
    ctx.fillStyle=`rgba(140,200,255,${P.tpFlash*.35})`;
    ctx.beginPath(); ctx.arc(c.sx,c.sy-26,30,0,7); ctx.fill();
  }
  if (buffTimer > 0) {
    ctx.strokeStyle='rgba(201,165,90,.4)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.ellipse(c.sx,c.sy+1,20,7,0,0,7); ctx.stroke();
  }
  ctx.save();
  ctx.translate(c.sx,c.sy-24+bobY);
  if (P.faceX < 0) ctx.scale(-1,1);
  witchBody(t, P.castingSkill != null);
  ctx.restore();
  // barre d'incantation et de PV retirées d'au-dessus du personnage (2026-07-05, demande
  // explicite) : la barre d'incantation vit désormais près de la barre de sorts (#castBar) et
  // la barre de PV reste uniquement en bas à gauche (#hpBar) -- voir renderCastBar()/hud()
}

// tient compte de la couleur des pièces équipées pour changer l'apparence du personnage
// (2026-07-08, demande explicite : "ajoute le nouveau personnage et ses couleurs selon stuff") —
// réutilise les mêmes couleurs que les icônes de stuff (armorIconForColor & co), gris/blanc en
// tons clairs, vert/bleu en version sombre desaturée pour rester lisible en robe
const CHAR_TIER_PALETTE = {
  grey:  { robe:'#6f7d8a', hat:'#586773', hatDark:'#465360', horn:false, cape:false, trim:'#c9a55a' },
  white: { robe:'#c3c9cc', hat:'#9aa0a3', hatDark:'#7a8083', horn:false, cape:false, trim:'#e8e8e8' },
  green: { robe:'#3d4a3a', hat:'#26301f', hatDark:'#182015', horn:true,  cape:false, trim:'#7aa35e' },
  blue:  { robe:'#20303c', hat:'#16232b', hatDark:'#0a1216', horn:true,  cape:true,  trim:'#6ea3c9' },
};
// palier visuel = le plus HAUT palier de couleur présent parmi les pièces équipées (arme/armure) —
// null si rien d'équipé, retombe alors sur le gris par défaut (voir witchBody/drawWitchOn)
function gearVisualTier() {
  const rank = { blue:0, green:1, white:2, grey:3 };
  const gradeByColor = {}; GEAR_TIERS.forEach(t => gradeByColor[t.color] = t.grade);
  let best = null, bestRank = 4;
  for (const slot of ['weapon','awakening','secondary','helmet','armor','gloves','boots']) {
    const e = EQUIP[slot];
    const g = e && e.color && gradeByColor[e.color];
    if (g && rank[g] < bestRank) { bestRank = rank[g]; best = g; }
  }
  return best;
}
function hexToRgba(hex, alpha) {
  const h = hex.replace('#','');
  const num = parseInt(h.length===3 ? h.split('').map(c=>c+c).join('') : h, 16);
  return `rgba(${(num>>16)&0xff},${(num>>8)&0xff},${num&0xff},${alpha})`;
}
// dessine le corps de la sorcière sur un contexte 2D donné (ctx global en jeu, ou un contexte de
// prévisualisation dédié — voir drawWitchOn) : factorisé le 2026-07-08 pour que le personnage en
// combat ET la prévisualisation de l'équipement partagent EXACTEMENT le même rendu par palier
function witchBodyOn(g, t, casting) {
  const sway = Math.sin(P.bob*.9)*2;
  const grade = gearVisualTier() || 'grey';
  const pal = CHAR_TIER_PALETTE[grade];
  if (pal.cape) {
    g.fillStyle = hexToRgba(pal.hat,.9);
    g.beginPath();
    g.moveTo(-9+sway*.6,-14); g.quadraticCurveTo(-22,10,-15,27);
    g.lineTo(-5,25); g.quadraticCurveTo(-11,4,-3,-16);
    g.closePath(); g.fill();
  }
  g.fillStyle=pal.robe;
  g.beginPath();
  g.moveTo(-3,-18);
  g.quadraticCurveTo(-14+sway,8,-11+sway,24);
  g.lineTo(11-sway,24);
  g.quadraticCurveTo(13-sway,6,3,-18);
  g.closePath(); g.fill();
  g.strokeStyle=pal.trim; g.lineWidth=1.4;
  g.beginPath(); g.moveTo(-10.4+sway,21.6); g.lineTo(10.4-sway,21.6); g.stroke();
  g.fillStyle=pal.robe; g.fillRect(-5,-20,10,12);
  g.fillStyle='#e8e0cf'; g.fillRect(-2.4,-19,4.8,9);
  g.fillStyle='#e9c9a8'; g.beginPath(); g.arc(0,-26,5.6,0,7); g.fill();
  g.fillStyle=pal.hatDark; g.beginPath(); g.arc(-1,-28,5.4,Math.PI*.85,Math.PI*1.95); g.fill();
  g.fillStyle=pal.hat;
  g.beginPath(); g.ellipse(0,-30.5,12.5,3.4,-.07,0,7); g.fill();
  g.beginPath(); g.moveTo(-6.4,-31); g.quadraticCurveTo(-2,-46,5.5,-42);
  g.quadraticCurveTo(3.5,-37,6.4,-31); g.closePath(); g.fill();
  g.strokeStyle=pal.trim; g.lineWidth=1.1;
  g.beginPath(); g.ellipse(0,-30.5,12.5,3.4,-.07,0,7); g.stroke();
  // cornes : palier vert et bleu uniquement (2026-07-08, même logique que les icônes de casque)
  if (pal.horn) {
    g.fillStyle = pal.trim;
    g.beginPath(); g.moveTo(-9,-32); g.quadraticCurveTo(-14,-40,-11,-48); g.quadraticCurveTo(-9,-40,-6,-33); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(9,-32); g.quadraticCurveTo(14,-40,11,-48); g.quadraticCurveTo(9,-40,6,-33); g.closePath(); g.fill();
  }
  const staffAng = casting ? -0.5+Math.sin(t*10)*.08 : 0.18;
  g.save(); g.translate(9,-14); g.rotate(staffAng);
  g.strokeStyle='#6b5a42'; g.lineWidth=2.6; g.lineCap='round';
  g.beginPath(); g.moveTo(0,22); g.lineTo(0,-22); g.stroke();
  const glow = casting ? .85+Math.sin(t*12)*.15 : .4;
  g.fillStyle=hexToRgba(pal.trim, glow);
  g.beginPath(); g.moveTo(0,-30); g.lineTo(4,-23); g.lineTo(0,-19); g.lineTo(-4,-23); g.closePath(); g.fill();
  if (casting) { g.fillStyle=hexToRgba(pal.trim,.25);
    g.beginPath(); g.arc(0,-24,9+Math.sin(t*12)*2,0,7); g.fill(); }
  g.restore();
  // orbes d'éveil en orbite : uniquement si une pièce d'éveil est équipée (2026-07-08, demande
  // explicite, même esprit que orbPairIconForColor)
  if (EQUIP.awakening) {
    const ang = t*1.4;
    [[Math.cos(ang)*16, Math.sin(ang)*7-10, 3.2], [Math.cos(ang+Math.PI)*11, Math.sin(ang+Math.PI)*5-6, 2.4]].forEach(([ox,oy,r]) => {
      g.fillStyle = hexToRgba(pal.trim,.9);
      g.beginPath(); g.arc(ox, oy-20, r, 0, 7); g.fill();
    });
  }
}
function witchBody(t,casting) { witchBodyOn(ctx, t, casting); }

function drawParticle(q) {
  const a = q.max ? Math.max(0,q.life/q.max) : 1;
  switch (q.type) {
    case 'flash':
      ctx.fillStyle=`rgba(220,235,255,${a*.16})`;
      ctx.fillRect(0,0,W,H);
      break;
    case 'meteor': {
      const c=toScreen(q.x,q.y,q.z), g=toScreen(q.x,q.y);
      if (q.boom) { ctx.fillStyle=`rgba(255,150,70,${a})`;
        ctx.beginPath(); ctx.arc(g.sx,g.sy-4,16*(1-a)+6,0,7); ctx.fill(); }
      else {
        ctx.fillStyle='rgba(0,0,0,.25)';
        ctx.beginPath(); ctx.ellipse(g.sx,g.sy,7*(1-q.z/330)+2,3,0,0,7); ctx.fill();
        ctx.strokeStyle='rgba(255,170,90,.7)'; ctx.lineWidth=3;
        ctx.beginPath(); ctx.moveTo(c.sx+8,c.sy-22); ctx.lineTo(c.sx,c.sy); ctx.stroke();
        ctx.fillStyle='#c96a3a'; ctx.beginPath(); ctx.arc(c.sx,c.sy,5.5,0,7); ctx.fill();
      }
      break;
    }
    case 'ice': {
      const c=toScreen(q.x,q.y,q.z), g=toScreen(q.x,q.y);
      if (q.boom) { ctx.fillStyle=`rgba(170,220,255,${a})`;
        ctx.beginPath(); ctx.arc(g.sx,g.sy-3,9*(1-a)+3,0,7); ctx.fill(); }
      else { ctx.fillStyle='rgba(180,225,255,.85)';
        ctx.save(); ctx.translate(c.sx,c.sy); ctx.rotate(.5); ctx.fillRect(-1.5,-6,3,12); ctx.restore(); }
      break;
    }
    case 'bolt': {
      const g=toScreen(q.x,q.y);
      ctx.strokeStyle=`rgba(200,230,255,${a})`; ctx.lineWidth=2.5;
      ctx.beginPath(); let y=g.sy-240, x=g.sx;
      ctx.moveTo(x,y);
      while (y < g.sy-6) { y += 30+Math.random()*20; x += Math.random()*24-12; ctx.lineTo(x,y); }
      ctx.stroke();
      ctx.fillStyle=`rgba(200,230,255,${a*.5})`;
      ctx.beginPath(); ctx.ellipse(g.sx,g.sy,14,6,0,0,7); ctx.fill();
      break;
    }
    case 'spark': {
      const c=toScreen(q.x,q.y,q.z);
      ctx.fillStyle = q.fire ? `rgba(255,160,80,${a})` : `rgba(190,150,255,${a})`;
      ctx.beginPath(); ctx.arc(c.sx,c.sy,2.2,0,7); ctx.fill();
      break;
    }
    case 'quake': {
      const g=toScreen(q.x,q.y);
      ctx.strokeStyle=`rgba(180,150,90,${a*.8})`; ctx.lineWidth=3;
      ctx.beginPath(); ctx.ellipse(g.sx,g.sy,q.r,q.r*.5,0,0,7); ctx.stroke();
      break;
    }
    case 'fireOrb': {
      if (q.done) break;
      const tt=Math.min(1,q.t);
      const x=q.x+(q.tx-q.x)*tt, y=q.y+(q.ty-q.y)*tt;
      const c=toScreen(x,y,26+Math.sin(tt*Math.PI)*30);
      ctx.fillStyle='rgba(255,150,70,.95)';
      ctx.beginPath(); ctx.arc(c.sx,c.sy,4.5,0,7); ctx.fill();
      ctx.fillStyle='rgba(255,150,70,.25)';
      ctx.beginPath(); ctx.arc(c.sx,c.sy,9,0,7); ctx.fill();
      break;
    }
    case 'tpTrail': {
      const a1=toScreen(q.x1,q.y1), a2=toScreen(q.x2,q.y2);
      ctx.strokeStyle=`rgba(140,200,255,${a*.7})`; ctx.lineWidth=8*a;
      ctx.beginPath(); ctx.moveTo(a1.sx,a1.sy-24); ctx.lineTo(a2.sx,a2.sy-24); ctx.stroke();
      break;
    }
    case 'pickup': {
      const g=toScreen(q.x,q.y);
      ctx.strokeStyle=q.color; ctx.globalAlpha=a; ctx.lineWidth=2;
      ctx.beginPath(); ctx.ellipse(g.sx,g.sy-4,12*(1-a)+4,6*(1-a)+2,0,0,7); ctx.stroke();
      ctx.globalAlpha=1;
      break;
    }
  }
}

function drawFloats() {
  const s = uiTextScale();
  for (const f of floats) {
    const c = toScreen(f.x,f.y,f.z+(1-f.life)*36);
    ctx.globalAlpha = Math.max(0,Math.min(1,f.life));
    const base = f.lvl?15:f.crit?14:12;
    ctx.font = (f.lvl?'bold ':f.crit?'bold ':'')+(base*s)+'px Georgia';
    ctx.fillStyle = f.silver||f.gold?'#c9a55a':f.lvl||f.blue?'#9cc9e8':f.green?'#8fc98a':f.hurt?'#e06050':f.crit?'#ffbe78':'#e88';
    ctx.textAlign='center'; ctx.fillText(f.txt,c.sx,c.sy); ctx.textAlign='left';
    ctx.globalAlpha=1;
  }
}

function render(t) {
  ctx.save();
  if (shakeT > 0) { shakeT -= 1/60; ctx.translate((Math.random()-.5)*shakeAmp,(Math.random()-.5)*shakeAmp); }
  drawGround();
  drawEntities(t);
  drawFloats();
  const v = ctx.createRadialGradient(W/2,H/2,H*.4,W/2,H/2,H*.85);
  v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(0,0,0,.4)');
  ctx.fillStyle=v; ctx.fillRect(0,0,W,H);
  ctx.restore();
}

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
// 5 paliers de régions (voir zones-roadmap.md pour le détail des zones prévues par palier) —
// seul "Early / Velia" est en jeu pour l'instant, les autres sont verrouillés en attendant
// d'être construits (demande explicite du 2026-07-05)
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
  el.innerHTML = ZONE_TIERS.map(t => `<button class="catTab${t.id===zoneTier?' active':''}${t.locked?' locked':''}"` +
    `${t.locked?' disabled title="'+(LANG==='fr'?'Bientôt disponible':'Coming soon')+'"':''} data-tier="${t.id}">${t.locked?'🔒 ':''}${t.icon} ${t.label[LANG]}</button>`).join('');
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
      row.innerHTML =
        `<span class="zname">${tr(z.name)}</span>` +
        `<span class="zBadge ${b.cls}">${tr(b.txt.replace('ZONE ',''))}</span>` +
        `<span class="zreq"><span class="${apOk?'ok':'bad'}">${z.reqAP} PA</span> · <span class="${dpOk?'ok':'bad'}">${z.reqDP} PD</span></span>` +
        `<span class="zUpgradeIcon"${hasUpgrade?'':' style="visibility:hidden"'} title="${LANG==='fr'?'Meilleur stuff à trouver ici':'Better gear to find here'}">⬆️</span>` +
        `<span class="zPlayerCount"${pCount?'':' style="visibility:hidden"'} title="${LANG==='fr'?'Joueurs actuellement sur cette zone':'Players currently on this zone'}">👥 ${pCount}</span>` +
        `<button class="zBtnView${previewed?' active':''}" title="${LANG==='fr'?'Voir le loot':'View loot'}">👁</button>`;
      row.querySelector('.zBtnView').onclick = e => { e.stopPropagation(); renderLootTable(i); };
      row.onclick = () => { if (atVelia || i !== zoneIdx) travelTo(i); };
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
  $('shRate').textContent = mins>.1 ? fmt((S.silverEarned-(S.silverEarnedAtLoad||0))/(mins/60))+' silver/h' : '— silver/h';
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
  // onglet en arrière-plan : Chrome ralentit déjà requestAnimationFrame tout seul, mais on saute
  // en plus tout le travail (simulation + rendu canvas) tant qu'on ne voit pas la page — demande
  // explicite du 2026-07-06 ("ma souris se met à buguer si je garde les onglets ouverts") : réduit
  // la charge CPU/GPU soutenue sur les sessions de plusieurs heures, quelle que soit la cause exacte
  if (document.hidden) { requestAnimationFrame(loop); return; }
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

// ==================== INVENTAIRE / ÉQUIPEMENT — UI ====================
const invPanelOpen = true; // panneau toujours affiché

// ---------- équipement (paperdoll permanent) ----------
const PD_LEFT  = ['helmet','armor','gloves','boots'];
const PD_RIGHT = ['necklace','earring1','earring2','ring1','ring2','belt','artifact1','artifact2','eqStone'];
const PD_BOTTOM = ['weapon','awakening','secondary'];
const SLOT_LABEL = { weapon:'Arme princ.', awakening:'Éveil', secondary:'Arme secondaire', book:'Livre (vie)',
  helmet:'Casque', armor:'Armure', gloves:'Gants', boots:'Bottes',
  necklace:'Collier', earring1:'B. oreille', earring2:'B. oreille', ring1:'Bague', ring2:'Bague', belt:'Ceinture',
  artifact1:'Artéfact', artifact2:'Artéfact', eqStone:'Pierre' };
// icônes par défaut (palier neutre gris) — utilisées en repli quand une pièce sauvegardée n'a pas
// sa propre icône (vieux objets, stuff de départ), voir helmetIconForColor & co. plus haut
const SLOT_ICON = { weapon:staffIconForColor('#8f9aa6','grey'), awakening:orbPairIconForColor('#8f9aa6','grey'),
  secondary:daggerIconForColor('#8f9aa6','grey'), book:ICO_BOOK,
  helmet:helmetIconForColor('#8f9aa6','grey'), armor:armorIconForColor('#8f9aa6','grey'),
  gloves:glovesIconForColor('#8f9aa6','grey'), boots:bootsIconForColor('#8f9aa6','grey'),
  necklace:necklaceIconForTier(0,'#8f9aa6'), earring1:earringIconForTier(0,'#8f9aa6'), earring2:earringIconForTier(0,'#8f9aa6'),
  ring1:ringIconForTier(0,'#8f9aa6'), ring2:ringIconForTier(0,'#8f9aa6'), belt:ICO_BELT,
  artifact1:ICO_ARTIFACT, artifact2:ICO_ARTIFACT, eqStone:ICO_EQSTONE };

function renderEquipment() {
  drawPreviewChar();
  fillPdCol('pdLeft', PD_LEFT);
  fillPdCol('pdRight', PD_RIGHT);
  fillPdCol('pdWeapons', PD_BOTTOM);
  fillPdCol('pdBook', ['book']);
  // les stats vont dans la carte Statistiques (pas de doublon)
  $('stWeaponBonus').textContent = '+' + Math.round(enhBonus(EQUIP.weapon ? EQUIP.weapon.enhLv : 0) * 100) + '%';
  $('stArmorBonus').textContent = '+' + Math.round(armorBonusAvg() * 100) + '%';
  // résumé PA/PD/GS directement sur la carte Équipement — demande explicite (entier, arrondi vers
  // le bas — 2026-07-08, voir le commentaire sur $('stPA') plus haut)
  $('eqSumAp').textContent = 'PA ' + Math.floor(apEff());
  $('eqSumDp').textContent = 'PD ' + Math.floor(totalDP());
  $('eqSumGs').textContent = 'GS ' + Math.round(GS());
}
// libellé court du niveau d'optimisation : "+N" jusqu'à +15, puis chiffres romains I..V pour PRI..PEN
function enhShortLabel(lvl) {
  if (lvl < PRI_IDX) return '+' + lvl;
  return ['I','II','III','IV','V'][lvl - PRI_IDX] || '+' + lvl;
}
function pdSlotInnerHtmlFor(id, e) {
  const icon = (e ? (e.icon || SLOT_ICON[id]) : SLOT_ICON[id]);
  let badge = '';
  if (e && e.optimizable) {
    const lvl = e.enhLv || 0;
    badge = `<span class="enh${lvl>=PRI_IDX?' pri':''}">${enhShortLabel(lvl)}</span>`;
  } else if (e && e.ap) {
    badge = `<span class="enh">+${e.ap}</span>`;
  }
  // PA/PD directement sur la pièce équipée, toujours en bas-gauche (2026-07-09, demande explicite :
  // "sur l'armure met la dp en bas a gauche") -- AP et PD ne sont jamais tous les deux non-nuls sur
  // le même objet (voir GEAR_ROLE : apShare/dpShare s'excluent selon le type de pièce), donc les
  // deux badges peuvent partager la même position sans jamais se chevaucher ; ça libère le
  // bas-droite pour la croix de déséquipement ci-dessous
  let apDpBadge = '';
  if (e) {
    const { ap, dp } = effectiveApDp(e);
    if (ap) apDpBadge += `<span class="pdAp">${ap}</span>`;
    if (dp) apDpBadge += `<span class="pdDp">${dp}</span>`;
  }
  // petit bouton "optimiser" directement sur la pièce équipée (2026-07-05, demande explicite :
  // "petit mais visible") -- raccourci vers le panneau d'optimisation, en plus du menu au clic
  const optBadge = (e && e.optimizable) ? `<span class="pdOptBtn" title="${LANG==='fr'?'Optimiser':'Enhance'}">🔧</span>` : '';
  // icône "aller à la zone" en coin, EMPILÉE sous 🔧 (2026-07-09, demande explicite : "opti en
  // haut à droite, upgrade sous l'icone d'opti") : ⬆️ sur une case remplie, UNIQUEMENT s'il existe
  // un vrai stuff meilleur à trouver (voir upgradeZonesForEquippedSlot : palier de la pièce
  // équipée strictement inférieur au palier de la zone actuelle), dans une zone NON dangereuse,
  // différente de la zone actuelle (demandes explicites successives) ; MÊME icône ⬆️ sur une case
  // vide (2026-07-09, demande explicite : "ajoute l'icone d'upgrade sur les case vide" -- un socle
  // vide EST par définition à améliorer, langage visuel cohérent), dangereux accepté en dernier
  // recours faute d'alternative ; 🔒 sur les 3 slots sans aucune source en jeu (artéfacts/pierre)
  let goBadge = '';
  if (e) {
    if (upgradeZonesForEquippedSlot(id, e).length) goBadge = `<span class="pdUpgradeBtn" title="${LANG==='fr'?'Zone pour améliorer':'Zone to upgrade'}">⬆️</span>`;
  } else if (NO_SOURCE_SLOTS.includes(id)) {
    goBadge = `<span class="pdLockBtn" title="${LANG==='fr'?'Pas encore disponible':'Not available yet'}">🔒</span>`;
  } else if (zonesForSlot(id).length) {
    // même icône ⬆️ que pour un socle rempli (2026-07-09, demande explicite : "ajoute l'icone
    // d'upgrade sur les case vide") -- un socle vide EST par définition à améliorer, même symbole
    // pour un langage visuel cohérent dans toute l'interface
    goBadge = `<span class="pdFarmBtn" title="${LANG==='fr'?'Zone pour trouver ce stuff':'Zone to find this gear'}">⬆️</span>`;
  }
  const cornerHtml = (optBadge || goBadge) ? `<span class="pdCorner">${optBadge}${goBadge}</span>` : '';
  // croix de déséquipement en bas-droite (2026-07-09, demande explicite) — raccourci direct en
  // plus du double-clic déjà existant sur la case
  const unequipBadge = e ? `<span class="pdUnequipBtn" title="${LANG==='fr'?'Déséquiper':'Unequip'}">✕</span>` : '';
  return icon + badge + apDpBadge + cornerHtml + unequipBadge;
}
function pdSlotInnerHtml(id) { return pdSlotInnerHtmlFor(id, EQUIP[id]); }
// texte "+X PA +Y PD +Z PV" affiché dans le tooltip d'une pièce de la poupée d'équipement —
// demande explicite : voir ce que le stuff donne comme PA/PD directement sur l'équipement
function pdStatSuffix(e) {
  const { ap, dp, hp, dodge } = effectiveApDp(e);
  const parts = [];
  if (ap) parts.push('+'+ap+' PA');
  if (dp) parts.push('+'+dp+' PD');
  if (hp) parts.push('+'+hp+' PV');
  if (dodge) parts.push('+'+dodge+'% Esq.');
  return parts.length ? ' (' + parts.join(' ') + ')' : '';
}
// base de comparaison ("ring"/"earring"/"necklace"/"belt") pour un slot précis de la poupée —
// les paires (ring1/ring2, earring1/earring2) partagent le même bassin de candidats
function accBaseSlot(slotId) {
  if (slotId==='ring1'||slotId==='ring2') return 'ring';
  if (slotId==='earring1'||slotId==='earring2') return 'earring';
  return slotId;
}
// slots sans aucune source en jeu pour l'instant (voir renderLifeskillPanelHtml) — affichés
// avec un cadenas 🔒 plutôt qu'une case vide muette (demande explicite du 2026-07-09)
const NO_SOURCE_SLOTS = ['artifact1','artifact2','eqStone'];
// bijoux (bagues/collier/boucles/ceinture) — utilisé pour colorer le cadre de la case selon le
// palier du bijou équipé (2026-07-09, demande explicite : "ajoute la couleur du cadre des bijoux")
const JEWELRY_SLOTS = ['ring1','ring2','necklace','earring1','earring2','belt'];
// zones candidates pour farmer/upgrader un socle donné, AVANT tout filtre de sécurité — se base
// sur le palier de la zone actuellement farmée (zoneIdx) : armes → zones qui garantissent ce type
// d'arme (ZONE_WEAPON_SLOTS) ; armures → les 4 zones du palier (n'importe laquelle peut looter
// n'importe quelle pièce d'armure, voir GEAR_SLOTS) ; bijoux → la zone UNIQUE du palier dont le
// jackpot correspond à ce type (ring/necklace/belt/earring, voir accSlotFor). artifact1/artifact2/
// eqStone → jamais de résultat (voir NO_SOURCE_SLOTS).
function slotCandidateZones(slotId) {
  const tier = gearTierForZone(zoneIdx);
  if (WEAPON_SLOTS.includes(slotId)) {
    return tier.zones.filter(zi => (ZONE_WEAPON_SLOTS[zi]||[]).includes(slotId));
  } else if (ARMOR_SLOTS.includes(slotId)) {
    return tier.zones.slice();
  } else if (JEWELRY_SLOTS.includes(slotId)) {
    const base = accBaseSlot(slotId);
    return tier.zones.filter(zi => accSlotFor(ZONES[zi].loot.jackpot) === base);
  }
  return [];
}
// zones à proposer pour un socle VIDE (popup "où farmer") — demande explicite : "un socle
// d'équipement vide, lorsque tu cliques dessus, te montre où farm l'item... halo bien visible,
// tout sauf zone dangereuse". Ne recommande une zone DANGEREUSE que s'il n'existe vraiment aucune
// alternative plus sûre (sinon le joueur n'a aucune option affichée du tout).
function zonesForSlot(slotId) {
  const zones = slotCandidateZones(slotId);
  const safe = zones.filter(zi => bottleneck(ZONES[zi]) >= 0.6);
  return safe.length ? safe : zones;
}
// zones à proposer pour l'icône ⬆️ d'un socle REMPLI — demande explicite du 2026-07-09 : cette
// icône ne doit s'afficher que s'il existe un endroit pour mieux se stuffer qui N'EST PAS une zone
// dangereuse (pas de fallback sur le dangereux ici, contrairement à zonesForSlot).
// Filtre aussi sur les zones DÉCOUVERTES (2026-07-11, demande explicite : "indique quel stuff
// t'améliore en base selon les zones découvertes qui ne sont pas une zone dangereuse") — même
// convention que showFarmGuide (zi <= S.maxZoneIdx) : ne propose jamais une zone jamais visitée.
function safeZonesForSlot(slotId) {
  return slotCandidateZones(slotId).filter(zi => zi <= S.maxZoneIdx && bottleneck(ZONES[zi]) >= 0.6);
}
// index de palier d'un objet équipé (grey=0 < white=1 < green=2 < blue=3), déduit de sa couleur —
// voir GEAR_TIERS (gear ET jackpot sont toujours tagués color:tier.color au drop). -1 si la
// couleur ne correspond à aucun palier connu.
function itemTierIdx(item) { return GEAR_TIERS.findIndex(t => t.color === item.color); }
// zones à proposer pour l'icône ⬆️ d'un socle REMPLI — demande explicite du 2026-07-09 : "l'icone
// s'affiche uniquement [si] tu peux trouver un stuff meilleur que celui que tu as déjà, SAUF
// dangereuse". Un palier supérieur au sien n'existe que si la pièce équipée est d'un palier
// INFÉRIEUR au palier de la zone actuellement farmée (le palier borne la qualité maximale du
// stuff trouvable ici) ; sinon (même palier ou palier supérieur, ex: stuff gardé d'avant) la zone
// ne peut rien offrir de mieux pour ce socle, quelle que soit la zone proposée.
function upgradeZonesForEquippedSlot(id, e) {
  if (!e) return [];
  const curTierIdx = GEAR_TIERS.indexOf(gearTierForZone(zoneIdx));
  if (itemTierIdx(e) >= curTierIdx) return [];
  return safeZonesForSlot(id).filter(zi => atVelia || zi !== zoneIdx);
}
// un objet qui améliorerait ce socle est-il déjà possédé, non équipé, dans le sac ? (2026-07-11,
// demande explicite : "la flèche qui affiche le stuff à farm sur la zone ne doit pas s'afficher si
// le stuff est dans l'inventaire") -- si oui, inutile de suggérer d'aller le farmer, il suffit de
// l'équiper. Réutilise refScoreForSlot (même référence -- le pire des 2 anneaux/boucles pour une
// paire, -1 pour un socle vide -- que hasNeglectedUpgradeInBag) plutôt que de la recalculer.
function ownedBetterInBagForSlot(slotId) {
  const accSlot = JEWELRY_SLOTS.includes(slotId) ? accBaseSlot(slotId) : null;
  const ref = refScoreForSlot(slotId, accSlot);
  const wantSlot = accSlot || slotId;
  return INV.some(it => it && (it.kind==='gear' || it.kind==='jackpot') && it.slot === wantSlot && itemScore(it) > ref);
}
// ensemble des zones (sûres uniquement) qui offrent vraiment mieux pour AU MOINS un socle du
// joueur (vide, ou équipé d'un palier inférieur) — sert au badge ⬆️ affiché directement sur les
// lignes de la liste de zones (2026-07-09, demande explicite : "ajoute l'icone d'upgrade sur les
// case vide, et sur les zone en question"), en plus de l'icône déjà présente sur la poupée
// d'équipement elle-même.
function zonesOfferingUpgrade() {
  const zones = new Set();
  for (const slotId of [...WEAPON_SLOTS, ...ARMOR_SLOTS, ...JEWELRY_SLOTS]) {
    if (ownedBetterInBagForSlot(slotId)) continue; // déjà en stock -> équiper, pas farmer
    const e = EQUIP[slotId];
    const list = e ? upgradeZonesForEquippedSlot(slotId, e) : zonesForSlot(slotId).filter(zi => bottleneck(ZONES[zi]) >= 0.6);
    list.forEach(zi => zones.add(zi));
  }
  return zones;
}
// applique/retire le halo dans #zoneList pour les zones qui lootent l'objet manquant d'un socle vide
function highlightFarmZones(zones) {
  document.querySelectorAll('#zoneList .zRow').forEach(r => r.classList.remove('eqFarmHalo'));
  zones.forEach(zi => { const row = document.querySelector(`#zoneList .zRow[data-zi="${zi}"]`); if (row) row.classList.add('eqFarmHalo'); });
}
// clic simple sur une case de la poupée d'équipement — demande explicite du 2026-07-09 : une case
// équipée n'affiche plus QUE le nom + les stats (déséquiper/optimiser restent accessibles via le
// double-clic et le bouton 🔧 dédiés) ; une case vide n'affiche plus QUE le nom + où farmer
function showEquipSlotMenu(cell, slotId) {
  const e = EQUIP[slotId];
  const pop = $('itemPop');
  let html = `<div class="ipName gear">${SLOT_LABEL[slotId] || slotId}</div>`;
  const emptyTxt = NO_SOURCE_SLOTS.includes(slotId)
    ? (LANG==='fr'?'🔒 Pas encore disponible':'🔒 Not available yet')
    : (LANG==='fr'?'Rien d\'équipé':'Nothing equipped');
  html += `<div class="ipDesc">${e ? (escapeHtml(e.name)+pdStatSuffix(e)) : emptyTxt}</div>`;
  pop.innerHTML = html;
  let farmZones = [];
  if (!e && !NO_SOURCE_SLOTS.includes(slotId)) {
    farmZones = zonesForSlot(slotId);
    if (farmZones.length) {
      const box = document.createElement('div');
      box.className = 'ipDesc';
      box.style.marginTop = '6px';
      box.innerHTML = (LANG==='fr' ? '📍 Où farmer : ' : '📍 Where to farm: ') +
        farmZones.map(zi => `<button class="eqFarmZoneBtn" data-zi="${zi}">${tr(ZONES[zi].name)}</button>`).join(' ');
      pop.appendChild(box);
      box.querySelectorAll('.eqFarmZoneBtn').forEach(btn => {
        btn.onclick = ev => {
          ev.stopPropagation();
          const zi = parseInt(btn.dataset.zi, 10);
          if (atVelia || zi !== zoneIdx) travelTo(zi);
          hideItemPop();
        };
      });
    }
  }
  highlightFarmZones(farmZones);
  pop.style.display = 'block';
  const r = cell.getBoundingClientRect();
  const pr = pop.getBoundingClientRect();
  pop.style.left = Math.min(r.right + 8, window.innerWidth - pr.width - 10) + 'px';
  pop.style.top = Math.min(r.top, window.innerHeight - pr.height - 10) + 'px';
}
function fillPdCol(colId, ids) {
  const col = $(colId);
  col.innerHTML = '';
  for (const id of ids) {
    const e = EQUIP[id];
    const div = document.createElement('div');
    div.className = 'pdSlot ' + (e ? 'filled' : 'empty');
    div.dataset.slot = id;
    div.title = SLOT_LABEL[id] + (e ? ' — ' + e.name + pdStatSuffix(e) : ' (vide)');
    div.innerHTML = pdSlotInnerHtml(id);
    // halo de couleur sur le stuff équipé (2026-07-06, demande explicite : "met un halo de
    // couleurs sur le stuff... aussi comme les pierre de crons") -- couleur du palier (grise/
    // blanche/verte/bleue) ou couleur propre à l'objet (bijoux), même esprit que le glow de
    // l'orbe de Pierre de Cron
    if (e && e.color) div.style.boxShadow = `0 0 8px 2px ${e.color}66`;
    else div.style.boxShadow = '';
    // cadre coloré sur les bijoux équipés (2026-07-09, demande explicite) — le halo ci-dessus
    // reste discret, le CADRE lui-même reprend désormais la couleur du palier du bijou
    div.style.borderColor = (e && e.color && JEWELRY_SLOTS.includes(id)) ? e.color : '';
    div.onclick = ev => { ev.stopPropagation(); hideItemTooltip(); showEquipSlotMenu(div, id); };
    div.ondblclick = ev => { ev.stopPropagation(); hideItemPop(); if (e) unequip(id); };
    const optBtn = div.querySelector('.pdOptBtn');
    if (optBtn) optBtn.onclick = ev => {
      ev.stopPropagation(); hideItemTooltip(); hideItemPop();
      optTargetSlot = id; renderOptimization();
      $('optCard').scrollIntoView({ behavior:'smooth', block:'center' });
    };
    // ✕ en bas-droite : déséquiper directement, en plus du double-clic déjà existant —
    // demande explicite du 2026-07-09
    const unequipBtn = div.querySelector('.pdUnequipBtn');
    if (unequipBtn) unequipBtn.onclick = ev => {
      ev.stopPropagation(); hideItemTooltip(); hideItemPop();
      unequip(id);
    };
    // ⬆️/📍 en coin : raccourci direct vers la zone (pas de popup intermédiaire) — demande
    // explicite du 2026-07-09. ⬆️ ne propose que des zones où un vrai palier supérieur existe
    // (upgradeZonesForEquippedSlot : sûres, différentes de la zone actuelle, jamais si la pièce
    // équipée est déjà du palier de la zone ou mieux) ; 📍 garde le fallback dangereux de
    // zonesForSlot en dernier recours.
    const goBtn = div.querySelector('.pdUpgradeBtn, .pdFarmBtn');
    if (goBtn) goBtn.onclick = ev => {
      ev.stopPropagation(); hideItemTooltip(); hideItemPop();
      const zones = e ? upgradeZonesForEquippedSlot(id, e) : zonesForSlot(id);
      if (zones.length) { const zi = zones[0]; if (atVelia || zi !== zoneIdx) travelTo(zi); }
    };
    col.appendChild(div);
  }
}
// mise à jour ciblée d'UNE seule case de la poupée d'équipement (icône/badge d'enchant),
// sans reconstruire les ~13 cases + leurs gestionnaires d'événements ni redessiner le
// canvas — utilisée après une tentative d'optimisation pour rester fluide même en
// enchaînant les clics rapidement (avant ce correctif, chaque clic reconstruisait tout)
function refreshEquipSlot(slotId) {
  const div = document.querySelector('.pdSlot[data-slot="'+slotId+'"]');
  if (!div) return;
  const e = EQUIP[slotId];
  div.className = 'pdSlot ' + (e ? 'filled' : 'empty');
  div.title = SLOT_LABEL[slotId] + (e ? ' — ' + e.name + pdStatSuffix(e) : ' (vide)');
  div.innerHTML = pdSlotInnerHtml(slotId);
  div.style.boxShadow = (e && e.color) ? `0 0 8px 2px ${e.color}66` : '';
  div.style.borderColor = (e && e.color && JEWELRY_SLOTS.includes(slotId)) ? e.color : '';
}

function drawPreviewChar() {
  const c = $('charPrev'), x = c.getContext('2d');
  x.clearRect(0,0,c.width,c.height);
  x.fillStyle = 'rgba(201,165,90,.12)';
  x.beginPath(); x.ellipse(60,184,38,9,0,0,7); x.fill();
  // on dessine la sorcière en gros en réutilisant witchBody mais sur ce contexte
  drawWitchOn(x, 60, 150, 2.5);
}

// version paramétrable de witchBody pour un contexte/échelle donnés — délègue maintenant à
// witchBodyOn (2026-07-08) pour partager EXACTEMENT le même rendu par palier que le personnage en
// combat (couleurs/cornes/cape/orbes selon le stuff équipé)
function drawWitchOn(x, cx, cy, sc) {
  x.save(); x.translate(cx,cy); x.scale(sc,sc);
  witchBodyOn(x, performance.now()/1000, false);
  x.restore();
}

// ---------- grille d'inventaire : scindée en catégories filtrables (même tableau 192 cases
// en interne — seul l'affichage est filtré, pour ne pas casser tous les index déjà utilisés
// par l'équipement/la vente/les tooltips) ----------
// 4 inventaires distincts : chaque objet va dans le sien selon son type (plus de "Tout").
//  - Normal : équipement + bijoux
//  - Optimisation : matériaux d'enchantement + composants de craft endgame
//  - Consommable : consommables (potions, etc.)
//  - RNG : coffres/box aléatoires (vide pour l'instant — du contenu viendra)
const INV_CATEGORIES = [
  { id:'normal',      icon:'⚔️', label:{fr:'Normal',en:'Normal'},    kinds:['gear','jackpot'] },
  { id:'opt',         icon:'✦',  label:{fr:'Optimisation',en:'Enhancement'}, kinds:['material','craft'] },
  { id:'consumable',  icon:'🧪', label:{fr:'Consommable',en:'Consumable'},   kinds:['consumable'], locked:true },
  { id:'rng',         icon:'🎲', label:{fr:'RNG',en:'RNG'},          kinds:['rngbox'], locked:true },
  // inventaire dédié au "Trésor de Velia" (catégorie TEST) — demande explicite du 2026-07-06
  { id:'treasure',    icon:'🗺️', label:{fr:'Trésors',en:'Treasures'}, kinds:['treasure'] },
];
let invCategory = 'normal';
function renderInvCatTabs() {
  const el = $('invCatTabs'); if (!el) return;
  el.innerHTML = INV_CATEGORIES.map(c => `<button class="catTab${c.id===invCategory?' active':''}${c.locked?' locked':''}"` +
    `${c.locked?' disabled title="'+(LANG==='fr'?'Bientôt disponible':'Coming soon')+'"':''} data-cat="${c.id}">${c.locked?'🔒 ':''}${c.icon} ${c.label[LANG]}</button>`).join('');
  el.querySelectorAll('.catTab:not(.locked)').forEach(btn => {
    btn.onclick = () => {
      invCategory = btn.dataset.cat;
      el.querySelectorAll('.catTab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderInventory();
    };
  });
}

// badge de niveau d'enchantement pour une case de sac — même logique que pdSlotInnerHtmlFor (poupée
// d'équipement), réutilisée ici pour le sac principal ET le sac protégé du Compendium (2026-07-09,
// demande explicite : "on peut voir l'optimisation dans l'inventaire ET le compendium")
function cellEnhBadgeHtml(s) {
  if (!s.optimizable) return '';
  const lvl = s.enhLv || 0;
  return `<span class="cellEnh${lvl>=PRI_IDX?' pri':''}">${enhShortLabel(lvl)}</span>`;
}

let hoverInvIndex = -1;
let lastMouseX = 0, lastMouseY = 0;
function renderInventory() {
  const grid = $('invGrid');
  grid.innerHTML = '';
  renderTreasureCraftPanel();
  const cat = INV_CATEGORIES.find(c => c.id === invCategory) || INV_CATEGORIES[0];
  for (let i = 0; i < INV_SIZE; i++) {
    const s = INV[i];
    const cell = document.createElement('div');
    // en vue filtrée (pas "Tout"), les cases vides ET les objets d'une autre catégorie sont
    // masqués — sinon un onglet avec 3 objets ressemblerait à 189 cases vides pour rien
    const visible = cat.kinds === null || (s && cat.kinds.includes(s.kind));
    cell.className = 'cell' + (s ? ' has k-'+s.kind : '') + (visible ? '' : ' catHidden');
    if (s) {
      const cellApDp = (s.kind === 'gear' || s.kind === 'jackpot') ? effectiveApDp(s) : null;
      // les icônes SVG (équipement, matériaux) ont leurs couleurs FIGÉES dans le tracé — le style
      // "color" posé sur le <span> n'a donc aucun effet sur elles (une SVG ignore le color CSS du
      // parent sauf si elle utilise currentColor). Résultat : tout le stuff gris/blanc/vert/bleu se
      // ressemblait dans le sac. Corrigé en teintant la BORDURE de la case avec la vraie couleur du
      // palier/matériau — demande explicite du 2026-07-07. Étendu aux bijoux (jackpot) le 2026-07-09
      // (demande explicite) — même halo que sur la poupée d'équipement (voir JEWELRY_SLOTS), les
      // bijoux du sac restaient les seuls objets équipables sans indice visuel de palier.
      if (s.color && (s.kind === 'gear' || s.kind === 'material' || s.kind === 'jackpot')) {
        cell.style.borderColor = s.color;
        cell.style.boxShadow = `inset 0 0 6px ${s.color}55`;
      }
      // filet de sécurité (2026-07-08, demande explicite : "verifier que toutes les items
      // équipable ont un svg associé") : repli sur l'icône générique du slot si jamais un objet
      // (sauvegarde ancienne/corrompue) n'a pas de champ icon — évite une case vide/"undefined"
      const cellIcon = s.icon || (s.slot && SLOT_ICON[s.slot]) || '❔';
      cell.innerHTML = `<span style="color:${s.color}">${cellIcon}</span>` +
        cellEnhBadgeHtml(s) +
        (s.qty > 1 ? `<span class="qty">${fmt(s.qty)}</span>` : '') +
        (s.equipped ? `<span class="eqd">E</span>` : '') +
        (cellApDp && cellApDp.ap ? `<span class="cellAp">${cellApDp.ap}</span>` : '') +
        (cellApDp && cellApDp.dp ? `<span class="cellDp">${cellApDp.dp}</span>` : '');
      cell.onmouseenter = ev => { hoverInvIndex = i; lastMouseX = ev.clientX; lastMouseY = ev.clientY; showItemTooltip(ev.clientX, ev.clientY, { invIndex:i, ...s }); };
      cell.onmousemove  = ev => { lastMouseX = ev.clientX; lastMouseY = ev.clientY; moveItemTooltip(ev.clientX, ev.clientY); };
      cell.onmouseleave = () => { if (hoverInvIndex === i) hoverInvIndex = -1; hideItemTooltip(); };
      cell.onclick = ev => { ev.stopPropagation(); hideItemTooltip(); showItemMenuAtCell(cell, { invIndex:i, ...s }); };
      cell.ondblclick = ev => { ev.stopPropagation(); hideItemTooltip(); quickAction(i); };
      cell.oncontextmenu = ev => { ev.preventDefault(); ev.stopPropagation(); hideItemTooltip(); showItemMenu(ev.clientX, ev.clientY, { invIndex:i, ...s }); };
    } else {
      // case vide : clic = guide de farm (2026-07-05, demande explicite) -- où aller farmer,
      // hors zones trop dangereuses pour le stuff actuel
      cell.onclick = ev => { ev.stopPropagation(); showFarmGuide(); };
    }
    grid.appendChild(cell);
  }
  // message quand la catégorie active ne contient encore aucun objet (ex: RNG, Consommable)
  const anyVisible = INV.some(s => s && cat.kinds.includes(s.kind));
  if (!anyVisible) {
    const empty = document.createElement('div');
    empty.className = 'invCatEmpty';
    empty.textContent = cat.id === 'rng'
      ? (LANG==='fr'?'Aucun coffre RNG pour l\'instant':'No RNG box yet')
      : (LANG==='fr'?'Vide':'Empty');
    grid.appendChild(empty);
  }
  // la grille vient d'être reconstruite : le DOM survolé a été détruit sans mouseleave —
  // on rafraîchit le tooltip avec l'état actuel (ou on le ferme si la case est vide/hors zone)
  if (hoverInvIndex !== -1) {
    const s = INV[hoverInvIndex];
    if (s) showItemTooltip(lastMouseX, lastMouseY, { invIndex:hoverInvIndex, ...s });
    else { hoverInvIndex = -1; hideItemTooltip(); }
  }
  // pied
  const used = invUsed();
  $('slotTxtH').textContent = used+'/'+INV_SIZE;
  const w = invWeight(), mw = MAX_WEIGHT(), overW = w > mw;
  $('wBar').style.width = Math.min(100, w/mw*100)+'%';
  $('wBar').classList.toggle('over', overW);
  $('wTxt').textContent = w.toFixed(1)+' / '+mw+' LT' + (overW ? (LANG==='fr'?' — ralenti !':' — slowed!') : '');
  $('wTxt').classList.toggle('bad', overW);
  $('invSilver').textContent = fmt(S.silver);
  $('invLoyalty').textContent = '🏅 '+fmt(S.loyalty||0);
}

// double-clic = action rapide selon le type d'objet
function quickAction(i) {
  const s = INV[i]; if (!s) return;
  if (s.kind === 'jackpot' || s.kind === 'gear') equipItem(i);
  else if (s.kind === 'material') { forcedMatKey = s.key; refreshInvUI(); }
  else if (s.kind === 'trash') sellOne(i);
  refreshInvUI();
}

// stat de référence déjà équipée pour comparer un objet du sac (pour les paires anneaux/boucles,
// on compare à la pièce la plus faible des deux — celle qui serait remplacée en premier)
function equippedRefForItem(item) {
  if (item.kind === 'gear') return EQUIP[item.slot];
  if (item.kind === 'jackpot') {
    const accSlot = accSlotFor(item);
    if (accSlot === 'ring') return itemScore(EQUIP.ring1) <= itemScore(EQUIP.ring2) ? EQUIP.ring1 : EQUIP.ring2;
    if (accSlot === 'earring') return itemScore(EQUIP.earring1) <= itemScore(EQUIP.earring2) ? EQUIP.earring1 : EQUIP.earring2;
    return EQUIP[accSlot];
  }
  return null;
}
// texte de gain/perte de stats (PA/PD/PV) par rapport à ce qui est déjà équipé dans le slot —
// affiché dans le menu au clic gauche pour décider d'équiper sans avoir à comparer soi-même
function statDeltaHtml(item) {
  const ref = equippedRefForItem(item);
  const cur = effectiveApDp(item);
  const refStats = ref ? effectiveApDp(ref) : { ap:0, dp:0, hp:0, dodge:0 };
  const parts = [];
  const d = (label, a, b, dec) => {
    const delta = dec ? Math.round((a - b)*10)/10 : Math.round(a - b);
    if (!delta) return;
    parts.push(`<span class="${delta>0?'statGain':'statLoss'}">${delta>0?'+':''}${delta} ${label}</span>`);
  };
  d('PA', cur.ap, refStats.ap); d('PD', cur.dp, refStats.dp); d('PV', cur.hp, refStats.hp);
  d('% Esq.', cur.dodge, refStats.dodge, true);
  if (!parts.length) return '';
  return `<div class="ipDelta">${ref ? (LANG==='fr'?'vs équipé : ':'vs equipped: ') : (LANG==='fr'?'rien d\'équipé — ':'nothing equipped — ')}${parts.join(' ')}</div>`;
}
// version texte brut (sans HTML) du delta — utilisée dans les libellés de bouton (textContent)
function statDeltaShortText(item) {
  const ref = equippedRefForItem(item);
  const cur = effectiveApDp(item);
  const refStats = ref ? effectiveApDp(ref) : { ap:0, dp:0, hp:0, dodge:0 };
  const parts = [];
  const d = (label, a, b, dec) => { const v = dec ? Math.round((a-b)*10)/10 : Math.round(a-b); if (v) parts.push((v>0?'+':'')+v+' '+label); };
  d('PA', cur.ap, refStats.ap); d('PD', cur.dp, refStats.dp); d('PV', cur.hp, refStats.hp);
  d('% Esq.', cur.dodge, refStats.dodge, true);
  return parts.length ? ' (' + parts.join(' ') + ')' : '';
}

// ---------- popup d'objet + actions ----------
function showItemMenu(px, py, data) {
  const pop = $('itemPop');
  let html = `<div class="ipName ${data.kind||''}">${tr(data.name)}</div>`;
  const desc = [];
  if (data.kind === 'trash') desc.push('Butin de vente. Valeur unitaire ~'+fmt(data.val)+' silver.');
  if (data.kind === 'material') desc.push('Matériau d\'optimisation. Utilisé automatiquement par le cadre Optimisation.');
  if (data.kind === 'jackpot') { const {ap,dp} = effectiveApDp(data); desc.push('Accessoire — '+(ap?('+'+ap+' PA'):'')+(dp?(' +'+dp+' PD'):'')); }
  if (data.kind === 'gear') { const {ap,dp,hp,dodge} = effectiveApDp(data); desc.push((data.slot==='weapon'?'Arme':'Armure')+' — '+(ap?('+'+ap+' PA '):'')+(dp?('+'+dp+' PD '):'')+(hp?('+'+hp+' PV '):'')+(dodge?('+'+dodge+'% Esq.'):'')+(data.optimizable?' · optimisable':'')); }
  if (data.kind === 'craft') desc.push('Composant de craft endgame. À conserver.');
  if (data.equipped) desc.push('Actuellement équipé' + (data.optimizable ? ' — niveau ' + ENH_NAMES[data.enhLv||0] : '') + '.');
  if (data.qty > 1) desc.push('Quantité : '+data.qty);
  const delta = (!data.equipped && (data.kind === 'gear' || data.kind === 'jackpot')) ? statDeltaHtml(data) : '';
  pop.innerHTML = html + `<div class="ipDesc">${desc.join('<br>')}</div>` + delta;

  // actions (libellés bilingues)
  const L = LANG === 'fr'
    ? { unequip:'Déséquiper', equip:'Équiper', toOpt:'Mettre en optimisation', sell1:n=>'Vendre 1 ('+n+')', sellAll:n=>'Vendre tout ('+n+')', drop:'Jeter',
        confirmSell1:n=>'Vendre 1 objet pour '+n+' silver ?', confirmSellAll:n=>'Vendre tout le tas pour '+n+' silver ?' }
    : { unequip:'Unequip', equip:'Equip', toOpt:'Load into enhancement', sell1:n=>'Sell 1 ('+n+')', sellAll:n=>'Sell all ('+n+')', drop:'Drop',
        confirmSell1:n=>'Sell 1 item for '+n+' silver?', confirmSellAll:n=>'Sell the whole stack for '+n+' silver?' };
  if (data.equipped) {
    addPopBtn(pop, L.unequip, () => { unequip(data.slotId); });
    if (data.kind === 'gear' || data.kind === 'jackpot') addPopBtn(pop, L.toOpt, () => { optTargetSlot = data.slotId; });
  } else if (data.invIndex != null) {
    const s = INV[data.invIndex];
    if (s.kind === 'jackpot' || s.kind === 'gear') {
      addPopBtn(pop, L.equip, () => { equipItem(data.invIndex); });
      addPopBtn(pop, L.toOpt, () => { const slotId = resolveEquipSlot(s); equipItem(data.invIndex); optTargetSlot = slotId; });
    }
    if (s.kind === 'material') addPopBtn(pop, L.toOpt, () => { forcedMatKey = s.key; });
    if (s.kind === 'trash' || s.kind === 'material' || s.kind === 'gear')
      addPopBtn(pop, L.sell1(fmt(s.val)), () => { if (confirm(L.confirmSell1(fmt(s.val)))) sellOne(data.invIndex); });
    if ((s.kind === 'trash' || s.kind === 'material') && s.qty > 1)
      addPopBtn(pop, L.sellAll(fmt(s.val*s.qty)), () => { if (confirm(L.confirmSellAll(fmt(s.val*s.qty)))) sellStack(data.invIndex); });
    addPopBtn(pop, L.drop, () => { dropItem(data.invIndex); });
  }
  pop.style.display = 'block';
  const r = pop.getBoundingClientRect();
  pop.style.left = Math.min(px, window.innerWidth - r.width - 10) + 'px';
  pop.style.top = Math.min(py, window.innerHeight - r.height - 10) + 'px';
}
// clic gauche sur une case du sac : ouvre le même menu, mais ANCRÉ à la case (juste en dessous)
// plutôt qu'au curseur — demande explicite "collé à la case"
function showItemMenuAtCell(cell, data) {
  const r = cell.getBoundingClientRect();
  showItemMenu(r.left, r.bottom + 4, data);
}
function addPopBtn(pop, label, fn) {
  const b = document.createElement('button');
  b.textContent = label;
  b.onclick = e => { e.stopPropagation(); fn(); hideItemPop(); refreshInvUI(); };
  pop.appendChild(b);
}
// variante avec du HTML (icône + texte) au lieu d'un simple texte — utilisée pour les candidats
// d'équipement (icône de l'objet + gain/perte de stats), demande explicite
function addPopBtnHtml(pop, html, fn) {
  const b = document.createElement('button');
  b.innerHTML = html;
  b.onclick = e => { e.stopPropagation(); fn(); hideItemPop(); refreshInvUI(); };
  pop.appendChild(b);
}
function hideItemPop() { $('itemPop').style.display = 'none'; document.querySelectorAll('#zoneList .zRow').forEach(r => r.classList.remove('eqFarmHalo')); }
document.addEventListener('click', () => { hideItemPop(); const ps = $('potSelect'); if (ps) ps.classList.remove('show'); });
document.addEventListener('contextmenu', ev => { if (!ev.target.closest('.cell')) hideItemPop(); });

// ---------- infobulle au survol (lecture seule) ----------
function itemTooltipHtml(data) {
  const desc = [];
  if (data.kind === 'trash') desc.push('Vente ~'+fmt(data.val)+' silver');
  if (data.kind === 'material') desc.push('Matériau d\'optimisation');
  if (data.kind === 'jackpot') { const {ap,dp} = effectiveApDp(data); desc.push('Accessoire'+(ap?(' · +'+ap+' PA'):'')+(dp?(' · +'+dp+' PD'):'')); }
  if (data.kind === 'gear') { const {ap,dp,hp,dodge} = effectiveApDp(data); desc.push((data.slot==='weapon'?'Arme':'Armure')+(ap?(' · +'+ap+' PA'):'')+(dp?(' · +'+dp+' PD'):'')+(hp?(' · +'+hp+' PV'):'')+(dodge?(' · +'+dodge+'% Esq.'):'')); }
  if ((data.kind === 'gear' || data.kind === 'jackpot') && data.optimizable && data.enhLv) desc.push('enchant '+ENH_NAMES[data.enhLv]);
  if (data.kind === 'craft') desc.push('Composant de craft endgame');
  if (data.qty > 1) desc.push('Quantité : '+data.qty);
  return `<div class="ipName ${data.kind||''}">${tr(data.name)}</div><div class="ipDesc">${desc.join(' · ')}</div>`;
}
function showItemTooltip(px, py, data) {
  const tip = $('itemTooltip');
  tip.innerHTML = itemTooltipHtml(data);
  tip.style.display = 'block';
  moveItemTooltip(px, py);
}
function moveItemTooltip(px, py) {
  const tip = $('itemTooltip');
  if (tip.style.display !== 'block') return;
  const r = tip.getBoundingClientRect();
  tip.style.left = Math.min(px+14, window.innerWidth - r.width - 10) + 'px';
  tip.style.top = Math.min(py+14, window.innerHeight - r.height - 10) + 'px';
}
function hideItemTooltip() { $('itemTooltip').style.display = 'none'; }

// ---------- actions ----------
// détermine dans quel slot précis une pièce (arme/armure/accessoire) doit s'équiper
function resolveEquipSlot(item) {
  if (item.kind === 'gear') return item.slot; // 'weapon' | 'helmet' | 'armor' | 'gloves' | 'boots' — correspondance directe
  if (item.kind === 'jackpot') {
    return item.slot === 'ring' ? (EQUIP.ring1 ? (EQUIP.ring2 ? 'ring1' : 'ring2') : 'ring1')
         : item.slot === 'earring' ? (EQUIP.earring1 ? (EQUIP.earring2 ? 'earring1' : 'earring2') : 'earring1')
         : item.slot === 'necklace' ? 'necklace' : item.slot === 'belt' ? 'belt' : 'ring1';
  }
  return null;
}
// équipe automatiquement l'objet à l'index i S'IL EST MEILLEUR que ce qui est déjà équipé sur son
// slot (2026-07-10, demande explicite : "lorsque je vends un item ... s'il est meilleur je
// l'équipe" -- utilisé par sellOne AVANT toute vente, quelle que soit la provenance de l'objet).
// Pour un anneau/boucle (paire), compare au PIRE des deux déjà équipés (celui qui serait remplacé
// en premier, même logique que refScoreForSlot) et l'équipe SPÉCIFIQUEMENT à cette place — jamais
// via resolveEquipSlot seul, qui ne regarde pas lequel des deux est le plus faible.
// compare 2 pièces avec la MÊME règle partout (2026-07-11, demande explicite : "si 2 stuff
// identique doivent etre changé toujours prendre celui le plus optimisé... sans oublier les 2
// anneaux verification slot 1 puis slot 2 et oreille slot 1 puis slot 2") : meilleur SOCLE
// (itemScore) d'abord ; à socle STRICTEMENT égal, le plus enchanté (enhLv) l'emporte ; à égalité
// totale, "a" (slot 1) reste la référence -- même critère que equipBestSingle/equipBestPair, pour
// que sellOne (via tryAutoEquipIfBetter) ne rate plus jamais un doublon plus enchanté juste parce
// que son socle de base est identique.
function isStrictlyBetterGear(a, b) {
  const sa = itemScore(a), sb = itemScore(b);
  if (sa !== sb) return sa > sb;
  return (a ? (a.enhLv||0) : -1) > (b ? (b.enhLv||0) : -1);
}
function tryAutoEquipIfBetter(i, s) {
  if (s.kind !== 'gear' && s.kind !== 'jackpot') return false;
  // gear : s.slot EST le slot direct ('helmet','weapon'...) ; jackpot : s.slot est déjà la BASE
  // ('ring'/'earring'/'necklace'/'belt'), voir accSlotFor -- pas besoin de resolveEquipSlot ici
  const base = s.slot;
  if (base === 'ring' || base === 'earring') {
    const slotA = base+'1', slotB = base+'2';
    // "slot 1 puis slot 2" : à égalité totale entre les 2 anneaux/boucles déjà équipés, slotA
    // (slot 1) reste la référence "pire" par défaut -- slotB n'est le pire QUE si slotA est
    // strictement meilleur que lui, sinon (slotB meilleur OU égalité) slotA est vérifié en premier
    const worseSlot = isStrictlyBetterGear(EQUIP[slotA], EQUIP[slotB]) ? slotB : slotA;
    if (!isStrictlyBetterGear(s, EQUIP[worseSlot])) return false;
    const old = EQUIP[worseSlot];
    if (old && !invAdd({ ...old, equipped:false, qty:1, stackable:false })) return false; // sac plein
    EQUIP[worseSlot] = { ...s };
    INV[i] = null;
    return true;
  }
  if (!isStrictlyBetterGear(s, EQUIP[base])) return false;
  equipItem(i);
  return true;
}
// équipe n'importe quelle pièce (arme/armure/accessoire) dans le bon slot
function equipItem(i) {
  const item = INV[i]; if (!item) return;
  const slotId = resolveEquipSlot(item);
  if (!slotId) return;
  // renvoie l'ancienne pièce dans le sac
  if (EQUIP[slotId]) {
    const old = EQUIP[slotId];
    if (!invAdd({ ...old, equipped:false, qty:1, stackable:false })) return; // sac plein, on annule
  }
  EQUIP[slotId] = { ...item };
  INV[i] = null;
  hud();
}
function unequip(slotId) {
  const e = EQUIP[slotId]; if (!e) return;
  if (invAdd({ ...e, equipped:false, qty:1, stackable:false })) { EQUIP[slotId] = null; hud(); }
}

// ---------- "Équiper le meilleur" : comparaison sur les stats DE BASE uniquement ----------
// (volontairement SANS le bonus d'enchantement : un objet +0 avec un meilleur socle vaut mieux
//  à terme qu'un objet déjà monté mais avec un socle plus faible — c'est lui qu'il faut remonter)
// dodge (2026-07-08) : poids ×3 pour compter comme un vrai critère secondaire sans dominer PA/PD
function itemScore(it) { return it ? (it.ap||0) + (it.dp||0)*0.5 + (it.dodge||0)*3 : -1; }

function equipBestSingle(slotId, kind) {
  const current = EQUIP[slotId];
  let best = null, bestIdx = -1;
  let bestScore = itemScore(current), bestEnh = current ? (current.enhLv||0) : -1;
  for (let i = 0; i < INV_SIZE; i++) {
    const it = INV[i];
    if (!it || it.kind !== kind) continue;
    const itSlot = kind === 'gear' ? it.slot : accSlotFor(it);
    if (itSlot !== slotId) continue;
    const sc = itemScore(it);
    const enh = it.enhLv || 0;
    // meilleur SOCLE d'abord ; à socle ÉGAL, le plus haut déjà enchanté l'emporte (2026-07-09,
    // demande explicite : "si les 2 base sont identique alors ce sera le plus haut deja monté") --
    // ne remplace jamais un objet déjà enchanté par un jumeau au même socle mais moins monté
    if (sc > bestScore || (sc === bestScore && enh > bestEnh)) { bestScore = sc; bestEnh = enh; best = it; bestIdx = i; }
  }
  if (!best) return false;
  if (current && !invAdd({ ...current, equipped:false, qty:1, stackable:false })) return false; // sac plein
  EQUIP[slotId] = { ...best };
  INV[bestIdx] = null;
  return true;
}
function equipBestPair(slotA, slotB, accSlot) {
  const candidates = [];
  if (EQUIP[slotA]) candidates.push(EQUIP[slotA]);
  if (EQUIP[slotB]) candidates.push(EQUIP[slotB]);
  const invIdxOf = new Map();
  for (let i = 0; i < INV_SIZE; i++) {
    const it = INV[i];
    if (it && it.kind === 'jackpot' && accSlotFor(it) === accSlot) { candidates.push(it); invIdxOf.set(it, i); }
  }
  // même règle que equipBestSingle (2026-07-09, demande explicite) : meilleur socle d'abord, et à
  // socle égal le plus haut déjà enchanté l'emporte
  candidates.sort((a,b) => (itemScore(b) - itemScore(a)) || ((b.enhLv||0) - (a.enhLv||0)));
  const chosen = candidates.slice(0, 2);
  const before = [EQUIP[slotA], EQUIP[slotB]].filter(Boolean);
  const changed = before.length !== chosen.length || before.some(it => !chosen.includes(it));
  if (!changed) return false;
  const toReturn = before.filter(it => !chosen.includes(it));
  for (const it of chosen) { const idx = invIdxOf.get(it); if (idx !== undefined) INV[idx] = null; }
  for (const it of toReturn) invAdd({ ...it, equipped:false, qty:1, stackable:false });
  EQUIP[slotA] = chosen[0] ? { ...chosen[0] } : null;
  EQUIP[slotB] = chosen[1] ? { ...chosen[1] } : null;
  return true;
}
function equipBestGear() {
  let changed = 0;
  for (const slotId of ['weapon','awakening','secondary','helmet','armor','gloves','boots'])
    if (equipBestSingle(slotId, 'gear')) changed++;
  for (const slotId of ['necklace','belt'])
    if (equipBestSingle(slotId, 'jackpot')) changed++;
  if (equipBestPair('ring1','ring2','ring')) changed++;
  if (equipBestPair('earring1','earring2','earring')) changed++;
  hud();
  return changed;
}
$('btnEquipBest').onclick = () => {
  const n = equipBestGear();
  const msg = $('equipBestMsg');
  if (msg) {
    msg.textContent = n > 0
      ? (LANG==='fr' ? `${n} pièce${n>1?'s':''} remplacée${n>1?'s':''} (meilleur socle)` : `${n} piece${n>1?'s':''} swapped (better base stats)`)
      : (LANG==='fr' ? 'Déjà optimal — rien à changer' : 'Already optimal — nothing to change');
    msg.className = n > 0 ? 'ok' : '';
    setTimeout(() => { if ($('equipBestMsg')) $('equipBestMsg').textContent = ''; }, 3000);
  }
};

// ---------- vente automatique : tout objet strictement moins bon (socle) que ce qui est déjà équipé ----------
function refScoreForSlot(slotId, accSlot) {
  if (accSlot === 'ring') return Math.min(itemScore(EQUIP.ring1), itemScore(EQUIP.ring2));
  if (accSlot === 'earring') return Math.min(itemScore(EQUIP.earring1), itemScore(EQUIP.earring2));
  return itemScore(EQUIP[slotId]);
}
// met en évidence "⚡ Équiper meilleur" (2026-07-09, demande explicite) : au moins un objet du sac
// est resté SANS être équipé plus de 15s (voir pickedAt dans invAdd) tout en étant réellement
// meilleur (itemScore) que ce qui est actuellement équipé sur son socle -- signale un oubli plutôt
// qu'un objet tout juste looté qu'on n'a pas encore eu le temps de comparer
const NEGLECTED_UPGRADE_DELAY_MS = 15000;
function hasNeglectedUpgradeInBag() {
  const now = Date.now();
  for (let i = 0; i < INV_SIZE; i++) {
    const it = INV[i]; if (!it) continue;
    if (it.kind !== 'gear' && it.kind !== 'jackpot') continue;
    if (now - (it.pickedAt || 0) < NEGLECTED_UPGRADE_DELAY_MS) continue;
    const slotId = it.kind === 'gear' ? it.slot : accSlotFor(it);
    const accSlot = it.kind === 'jackpot' ? accSlotFor(it) : null;
    const ref = refScoreForSlot(slotId, accSlot);
    if (itemScore(it) > ref) return true;
  }
  return false;
}
// dernière vente "Vendre l'inférieur" (snapshot des objets vendus) — sert au bouton "↩️ Racheter"
// pour annuler un clic accidentel, demande explicite du 2026-07-06 ; annulable une seule fois,
// non persisté (perdu au rechargement, ce n'est qu'un filet de sécurité immédiat)
let lastWorseSaleSold = null;
function sellWorseThanEquipped() {
  let count = 0, total = 0, divertedCount = 0;
  const sold = [];
  for (let i = 0; i < INV_SIZE; i++) {
    const it = INV[i]; if (!it) continue;
    if (it.kind !== 'gear' && it.kind !== 'jackpot') continue;
    const slotId = it.kind === 'gear' ? it.slot : accSlotFor(it);
    const accSlot = it.kind === 'jackpot' ? accSlotFor(it) : null;
    const ref = refScoreForSlot(slotId, accSlot);
    if (ref < 0) continue; // rien d'équipé pour comparer → on ne touche pas (pourrait être la 1ère pièce du slot)
    if (itemScore(it) <= ref) {
      // sac "Compendium" (2026-07-08, demande explicite) : le PREMIER exemplaire d'un type jamais
      // monté en PEN est protégé dans ce sac dédié au lieu d'être vendu — les suivants du même type
      // (déjà un exemplaire en sécurité) continuent d'être vendus normalement
      if (!S.penMastery[it.name] && !compendiumBagHasName(it.name) && compendiumBagAdd(it)) {
        divertedCount++; INV[i] = null; count++;
      } else {
        total += it.val * it.qty; sold.push({ ...it }); INV[i] = null; count++;
      }
    }
  }
  if (count > 0) { addSilver(total, 'sell', 'Vendre l\'inférieur'); lastWorseSaleSold = sold; hud(); }
  return { count, total, divertedCount };
}
// annule la dernière "Vendre l'inférieur" : reverse le silver gagné et restaure les objets vendus
// (tout ou rien — n'annule rien si le sac n'a pas assez de place ou si le silver a depuis baissé
// sous le montant à rendre)
function buyBackLastWorseSale() {
  if (!lastWorseSaleSold || !lastWorseSaleSold.length) return false;
  const total = lastWorseSaleSold.reduce((a,it) => a + it.val*it.qty, 0);
  const freeSlots = INV.filter(s => s === null).length;
  if (freeSlots < lastWorseSaleSold.length || S.silver < total) return false;
  // annule une vente : contrairement à une dépense normale (voir addSilver), ceci retire du
  // silverEarned aussi (le gain précédent est complètement défait, pas juste dépensé)
  S.silver -= total; S.silverEarned -= total;
  if (typeof queueSilverLedger === 'function') queueSilverLedger(-total, 'undo_sell', 'Racheter');
  lastWorseSaleSold.forEach(it => invAdd({ ...it }));
  lastWorseSaleSold = null;
  hud();
  return true;
}
$('btnSellWorse').onclick = () => {
  const { count, total, divertedCount } = sellWorseThanEquipped();
  // "Racheter" ne peut annuler que les objets réellement VENDUS (silver) — pas ceux protégés dans
  // le sac Compendium, qui n'ont jamais quitté ta possession et sont récupérables depuis là-bas
  $('btnBuyBackWorse').disabled = !lastWorseSaleSold || !lastWorseSaleSold.length;
  const msg = $('equipBestMsg');
  if (msg) {
    const soldCount = count - divertedCount;
    const divertedTxt = divertedCount > 0
      ? (LANG==='fr' ? ` · +${divertedCount} protégé${divertedCount>1?'s':''} dans le sac 📖 Compendium` : ` · +${divertedCount} protected in the 📖 Compendium bag`)
      : '';
    msg.textContent = count > 0
      ? (LANG==='fr' ? `${soldCount} objet${soldCount>1?'s':''} vendu${soldCount>1?'s':''} (+${fmt(total)} silver)${divertedTxt}` : `${soldCount} item${soldCount>1?'s':''} sold (+${fmt(total)} silver)${divertedTxt}`)
      : (LANG==='fr' ? 'Rien à vendre — tout est déjà au-dessus de l\'équipé' : 'Nothing to sell — everything already beats what\'s equipped');
    msg.className = count > 0 ? 'ok' : '';
    setTimeout(() => { if ($('equipBestMsg')) $('equipBestMsg').textContent = ''; }, 3000);
  }
};
$('btnBuyBackWorse').onclick = () => {
  const ok = buyBackLastWorseSale();
  $('btnBuyBackWorse').disabled = true;
  const msg = $('equipBestMsg');
  if (msg) {
    msg.textContent = ok
      ? (LANG==='fr' ? 'Objets rachetés ✓' : 'Items bought back ✓')
      : (LANG==='fr' ? 'Rien à racheter (ou sac plein / silver insuffisant)' : 'Nothing to buy back (or bag full / not enough silver)');
    msg.className = ok ? 'ok' : '';
    setTimeout(() => { if ($('equipBestMsg')) $('equipBestMsg').textContent = ''; }, 3000);
  }
};

function enhanceWithMaterial(i) {
  // conservé pour compat (non utilisé par le popup désormais, cf. cadre Optimisation)
  const mat = INV[i]; if (!mat || !EQUIP.weapon || EQUIP.weapon.enhLv >= ENH_NAMES.length-1) return;
  invRemoveAt(i, 1);
  const lvl = EQUIP.weapon.enhLv, target = EQUIP.weapon;
  const chance = enhChance(lvl+1, target);
  const success = Math.random() < chance;
  if (success) {
    target.enhLv++;
    floatTxt(P.x,P.y,100,'✦ '+ENH_NAMES[target.enhLv],{gold:true});
  } else {
    addItemFailstack(target, lvl+1);
    if (lvl >= SAFE_IDX && lvl < PRI_IDX) { // +8 à +15 : peut rétrograder, jamais sous +7
      target.enhLv = Math.max(SAFE_IDX-1, lvl-1);
      floatTxt(P.x,P.y,100,'✖ rétrogradé — '+ENH_NAMES[target.enhLv],{hurt:true});
    } else if (lvl >= PRI_IDX) { // PRI et plus : rétrograde d'un palier à chaque échec, mais jamais sous PRI (pas de retour à +15)
      target.enhLv = Math.max(PRI_IDX, lvl-1);
      floatTxt(P.x,P.y,100,'✖ rétrogradé — '+ENH_NAMES[target.enhLv],{hurt:true});
    } else floatTxt(P.x,P.y,100,'✖ échec',{hurt:true});
  }
  renderEquipment(); refreshStatsOnly(); renderOptimization();
}

// ---------- cadre d'optimisation (armes + armure + bijoux, cible sélectionnable, façon BDO) ----------
let optTargetSlot = 'weapon';
let forcedMatKey = null; // matériau épinglé via le menu clic droit ("Mettre en optimisation")

function optimizableList() { return OPTIMIZABLE_SLOTS.filter(k => EQUIP[k]); }
// chaque palier de stuff (Naru/Tuvala/Yuria/Grunil) a SA PROPRE pierre d'optimisation, jamais
// interchangeable avec celle d'un autre palier (2026-07-11, demande explicite : "on doit pas
// avoir un stuff tuvala qui s'opti avec une pierre de naru") -- avant, si le bon matériau
// n'était pas en stock, un repli silencieux consommait N'IMPORTE QUEL AUTRE matériau (y compris
// celui d'un palier différent) ; supprimé, sans le bon matériau l'optimisation reste bloquée.
function findEnhanceMaterial() {
  const target = EQUIP[optTargetSlot];
  const wantedName = (target && target.matName) || Z().loot.mat.name;
  if (forcedMatKey) {
    const idx = INV.findIndex(s => s && s.key === forcedMatKey);
    // le matériau épinglé (clic droit "Mettre en optimisation") doit AUSSI correspondre au
    // palier de la pièce actuellement ciblée -- sinon il est ignoré, jamais utilisé de force
    if (idx !== -1 && INV[idx].name === wantedName) return idx;
    forcedMatKey = null; // épuisé ou ne correspond plus à la pièce ciblée -> repli automatique
  }
  return INV.findIndex(s => s && s.kind === 'material' && s.name === wantedName);
}
function findCronStone() { return INV.findIndex(s => s && s.name === CRON_STONE.name); }
function renderOptimization() {
  // (re)construit la liste déroulante des pièces optimisables équipées (armes + armure + bijoux)
  const avail = optimizableList();
  if (!avail.includes(optTargetSlot)) optTargetSlot = avail[0] || 'weapon';
  const sel = $('optTarget');
  sel.innerHTML = avail.map(k => `<option value="${k}" ${k===optTargetSlot?'selected':''}>${SLOT_LABEL[k]} — ${tr(EQUIP[k].name)} (${ENH_NAMES[EQUIP[k].enhLv||0]})</option>`).join('');

  const target = EQUIP[optTargetSlot];
  const lvl = target ? (target.enhLv||0) : 0, maxed = lvl >= ENH_NAMES.length-1;
  const parts = target && !maxed ? enhChanceParts(lvl+1, target) : { base:0, bonus:0, total:0 };
  const fsCount = target ? itemFailstack(target, lvl+1) : 0;
  $('optItem').innerHTML = target ? (target.icon || SLOT_ICON[optTargetSlot]) : '—';
  $('optItem').style.boxShadow = (target && target.color) ? `0 0 8px 2px ${target.color}66` : '';
  $('optLevelLbl').innerHTML = (target ? tr(target.name) : (LANG==='fr'?'Aucune pièce équipée':'No piece equipped')) + ' <b id="optLevelVal">' + (target ? ENH_NAMES[lvl] : '—') + '</b>';

  const matIdx = findEnhanceMaterial(), matSlotEl = $('optMat');
  const maxedTxt = LANG==='fr' ? 'PEN atteint — niveau maximum' : 'PEN reached — max level';
  if (!target) { matSlotEl.className='empty'; matSlotEl.innerHTML='＋'; matSlotEl.style.boxShadow=''; $('optChanceTxt').textContent = LANG==='fr'?'Équipez une pièce à optimiser':'Equip a piece to enhance'; $('btnOpt').disabled=true; }
  else if (matIdx === -1) {
    matSlotEl.className = 'empty'; matSlotEl.innerHTML = '＋'; matSlotEl.title = ''; matSlotEl.style.boxShadow = '';
    $('optChanceTxt').textContent = maxed ? maxedTxt : (LANG==='fr'?'Aucun matériau en sac — farmez du loot':'No material in bag — go loot some');
    $('btnOpt').disabled = true;
  } else {
    const it = INV[matIdx];
    matSlotEl.className = ''; matSlotEl.title = it.name;
    matSlotEl.innerHTML = `<span style="color:${it.color}">${it.icon}</span>` + (it.qty>1?`<span class="matQty">${fmt(it.qty)}</span>`:'');
    matSlotEl.style.boxShadow = it.color ? `0 0 8px 2px ${it.color}66` : '';
    $('btnOpt').disabled = maxed;
    const fsTxt = fsCount > 0 ? ` <span style="color:#8fc9e8">(+${fsCount} ${LANG==='fr'?'échecs sur ce palier':'fails on this tier'})</span>` : '';
    $('optChanceTxt').innerHTML = maxed ? maxedTxt
      : `${LANG==='fr'?'Matériau':'Material'} : ${tr(it.name)} · ${LANG==='fr'?'Chance':'Chance'} : ${(parts.total*100).toFixed(1)}% → ${ENH_NAMES[lvl+1]}${fsTxt}`;
  }
  // barre à deux tons : chance de base (or) + bonus du failstack accumulé sur CE palier (bleu)
  $('optChanceFill').style.width = (parts.base*100)+'%';
  $('optChanceFillFS').style.width = (parts.bonus*100)+'%';
  // Pierre de Cron : case à part, à droite du matériau — au choix du joueur, la case elle-même
  // sert de bouton on/off (2026-07-08, demande explicite : remplace l'ancienne case à cocher
  // séparée). L'icône réelle (orbe turquoise, voir ICO_CRON_STONE) remplace le placeholder ⏳
  // statique qui ne changeait jamais -- affichée en permanence, grisée si désactivée ou vide.
  const cronIdx = findCronStone(), cronSlotEl = $('optCronSlot');
  $('optCronIcon').innerHTML = CRON_STONE.icon;
  const cronOffCls = S.useCronStone ? '' : ' off';
  if (cronIdx === -1) {
    cronSlotEl.className = 'empty' + cronOffCls; cronSlotEl.title = LANG==='fr'?'Aucune Pierre de Cron en sac':'No Cron Stone in bag';
    $('optCronQty').textContent = ''; cronSlotEl.style.boxShadow = '';
  } else {
    cronSlotEl.className = cronOffCls.trim(); cronSlotEl.title = CRON_STONE.name + ' — ' +
      (S.useCronStone ? (LANG==='fr'?'utilisée (clique pour désactiver)':'in use (click to disable)')
                      : (LANG==='fr'?'non utilisée (clique pour activer)':'not used (click to enable)'));
    $('optCronQty').textContent = fmt(INV[cronIdx].qty);
    cronSlotEl.style.boxShadow = S.useCronStone ? `0 0 8px 2px ${CRON_STONE.color}66` : '';
  }
  renderOptSuggestions();
  if (!autoOptTimer) renderOptAutoTargetSelect(); // pas touché pendant une auto en cours (garde le palier choisi)
  renderCapConvertRow();
}
$('optTarget').onchange = e => { optTargetSlot = e.target.value; stopAutoOpt(); renderOptimization(); };
// la case Pierre de Cron sert elle-même de bouton on/off (2026-07-08, demande explicite),
// remplace l'ancienne case à cocher #optCronToggle
$('optCronSlot').onclick = () => { S.useCronStone = !S.useCronStone; renderOptimization(); };

// une tentative d'optimisation (succès/échec/rétrogradation) — factorisée pour être appelée
// aussi bien par le bouton manuel que par la boucle "Auto jusqu'à" (voir plus bas)
function attemptEnhance() {
  const target = EQUIP[optTargetSlot];
  const idx = findEnhanceMaterial();
  if (!target || idx === -1 || (target.enhLv||0) >= ENH_NAMES.length-1) return false;
  invRemoveAt(idx, 1);
  S.enhAttempts = (S.enhAttempts||0) + 1;
  const lvl = target.enhLv||0;
  const chance = enhChance(lvl+1, target);
  const r = $('optResult');
  if (Math.random() < chance) {
    target.enhLv = lvl+1;
    S.enhSuccess = (S.enhSuccess||0) + 1;
    // le failstack déjà acquis sur les AUTRES paliers reste acquis (rien n'est effacé) — seul le
    // palier qu'on vient de passer n'a plus besoin d'être suivi, il reste stocké mais inutilisé
    r.textContent = (LANG==='fr'?'✦ SUCCÈS — ':'✦ SUCCESS — ') + ENH_NAMES[target.enhLv]; r.className = 'ok';
    floatTxt(P.x,P.y,100,'✦ '+ENH_NAMES[target.enhLv],{gold:true});
    // Compendium PEN (2026-07-08) : marque CE type d'objet comme "atteint PEN au moins 1 fois"
    if (target.enhLv >= ENH_NAMES.length-1) markPenMastery(target.name);
  } else {
    addItemFailstack(target, lvl+1); // le failstack de CE palier, pour CET objet, progresse et reste acquis
    // Pierre de Cron : au choix du joueur (case à cocher #optCronToggle, S.useCronStone — demande
    // explicite du 2026-07-06, remplace l'ancienne consommation 100% automatique et silencieuse),
    // UNIQUEMENT quand cet échec aurait fait rétrograder l'objet — protège le palier actuel, le
    // matériau d'optimisation reste perdu comme sur n'importe quel échec
    const wouldDowngrade = lvl >= SAFE_IDX;
    const cronIdx = (wouldDowngrade && S.useCronStone) ? findCronStone() : -1;
    if (cronIdx !== -1) {
      invRemoveAt(cronIdx, 1);
      r.textContent = (LANG==='fr'?'✖ ÉCHEC — protégé par une Pierre de Cron (':'✖ FAIL — protected by a Cron Stone (')+ENH_NAMES[target.enhLv]+')';
      floatTxt(P.x,P.y,100,LANG==='fr'?'⏳ Protégé !':'⏳ Protected!',{blue:true});
    } else if (lvl >= SAFE_IDX && lvl < PRI_IDX) { // +8 à +15 : peut rétrograder, jamais sous +7
      target.enhLv = Math.max(SAFE_IDX-1, lvl-1);
      r.textContent = (LANG==='fr'?'✖ ÉCHEC — rétrogradé à ':'✖ FAIL — downgraded to ') + ENH_NAMES[target.enhLv];
    } else if (lvl >= PRI_IDX) { // PRI et plus : rétrograde d'un palier, mais jamais sous PRI (pas de retour à +15)
      target.enhLv = Math.max(PRI_IDX, lvl-1);
      r.textContent = (LANG==='fr'?'✖ ÉCHEC — rétrogradé à ':'✖ FAIL — downgraded to ') + ENH_NAMES[target.enhLv];
    } else {
      r.textContent = LANG==='fr' ? '✖ ÉCHEC — matériau perdu' : '✖ FAIL — material lost';
    }
    r.className = 'fail';
    // redémarre l'animation sans lecture forcée de layout (offsetWidth) — un simple retrait/ajout
    // de classe suffit puisque le navigateur applique déjà les deux changements sur des frames
    // séparées ; l'ancienne version forçait un reflow synchrone à CHAQUE tentative, ce qui devenait
    // sensible en enchaînant les clics rapidement
    const card = $('optCard'); card.classList.remove('optShake');
    requestAnimationFrame(() => card.classList.add('optShake'));
  }
  // mise à jour ciblée (voir refreshEquipSlot) au lieu de tout reconstruire (poupée + canvas) à
  // chaque tentative — gardait le jeu fluide même en spammant le bouton d'optimisation
  refreshEquipSlot(optTargetSlot);
  if (optTargetSlot === 'weapon') drawPreviewChar(); // seule la lueur du bâton en dépend visuellement
  $('stWeaponBonus').textContent = '+' + Math.round(enhBonus(EQUIP.weapon ? EQUIP.weapon.enhLv : 0) * 100) + '%';
  $('stArmorBonus').textContent = '+' + Math.round(armorBonusAvg() * 100) + '%';
  refreshStatsOnly(); renderOptimization();
  return true;
}
$('btnOpt').onclick = attemptEnhance;

// ---------- optimisation automatique jusqu'à un palier choisi ----------
// tente automatiquement (toutes les ~200 ms, pour rester visible) jusqu'à atteindre le palier
// choisi OU tomber à court de matériau — s'arrête aussi si l'objet redescend sous le palier visé
// à cause d'une rétrogradation (pour ne pas vider tout le sac dans un mur de malchance)
// calcule le gain de stats (PA/PD/PV/Esquive) entre l'état actuel de la pièce et un palier visé —
// réutilisé à la fois pour chaque option du menu déroulant et le résumé sous celui-ci
function optAutoGainParts(target, targetLvl) {
  if (!target || !Number.isInteger(targetLvl)) return [];
  const cur = effectiveApDp(target), proj = projectedApDp(target, targetLvl);
  const parts = [];
  if (proj.ap > cur.ap) parts.push('+' + (proj.ap-cur.ap) + ' PA');
  if (proj.dp > cur.dp) parts.push('+' + (proj.dp-cur.dp) + ' PD');
  if (proj.hp > cur.hp) parts.push('+' + (proj.hp-cur.hp) + ' PV');
  if (proj.dodge > cur.dodge) parts.push('+' + (proj.dodge-cur.dodge).toFixed(2) + '% ' + (LANG==='fr'?'Esq.':'Dodge'));
  return parts;
}
// version compacte du gain, un SEUL stat (le principal de la pièce : PA pour arme/éveil/dague, PD
// pour casque/armure/gants/bottes) — demande explicite du 2026-07-09 : "revois les info que tu
// donne lorsqu'il y a plusieurs stats" -- le menu déroulant cumulait PD+PV+Esquive sur une seule
// ligne par palier (voir capture jointe), illisible. Le détail complet (tous les stats) reste
// disponible juste en dessous du menu, voir renderOptAutoGain/optAutoGainParts.
function optAutoGainPrimaryPart(target, targetLvl, slotId) {
  if (!target || !Number.isInteger(targetLvl)) return '';
  const cur = effectiveApDp(target), proj = projectedApDp(target, targetLvl);
  const primary = WEAPON_SLOTS.includes(slotId) ? 'ap' : 'dp';
  const delta = proj[primary] - cur[primary];
  return delta > 0 ? '+' + delta + ' ' + (primary === 'ap' ? 'PA' : 'PD') : '';
}
function renderOptAutoTargetSelect() {
  const sel = $('optAutoTarget'); if (!sel) return;
  const target = EQUIP[optTargetSlot];
  const curLvl = target ? (target.enhLv||0) : 0;
  const options = ENH_NAMES.map((name,i) => i).filter(i => i > curLvl);
  // affiche le gain directement dans chaque option du menu déroulant (demande explicite du
  // 2026-07-05), pas seulement pour le palier actuellement sélectionné -- n'affiche le gain QUE
  // sur le palier où il change RÉELLEMENT (2026-07-08, demande explicite : "n'affiche +1 que
  // lorsque tu gagne 1AP, le suivant sera +2") : avec l'arrondi vers le bas (voir effectiveApDp),
  // plusieurs paliers consécutifs peuvent cumuler le même gain entier tant que la fraction
  // accumulée n'a pas franchi le point suivant -- répéter "(+1 PA)" sur 7 paliers d'affilée
  // donnait l'impression d'un gain figé/buggé ; on ne le réaffiche donc qu'au moment où il change.
  let lastGainTxt = null;
  sel.innerHTML = options.map(i => {
    const gainTxt = optAutoGainPrimaryPart(target, i, optTargetSlot);
    const showGain = gainTxt !== lastGainTxt;
    if (gainTxt) lastGainTxt = gainTxt;
    return `<option value="${i}">${ENH_NAMES[i]}${(showGain && gainTxt) ? ' (' + gainTxt + ')' : ''}</option>`;
  }).join('') || `<option value="">${LANG==='fr'?'Niveau max atteint':'Max level reached'}</option>`;
  sel.disabled = !options.length;
  renderOptAutoGain();
}
// affiche le gain de stats si on atteint le palier choisi dans #optAutoTarget (ex: "+18 PA")
function renderOptAutoGain() {
  const el = $('optAutoGainTxt'); if (!el) return;
  const target = EQUIP[optTargetSlot];
  const sel = $('optAutoTarget');
  const targetLvl = sel ? parseInt(sel.value, 10) : NaN;
  const parts = optAutoGainParts(target, targetLvl);
  el.textContent = parts.length
    ? (LANG==='fr' ? `À ${ENH_NAMES[targetLvl]} : ` : `At ${ENH_NAMES[targetLvl]}: `) + parts.join(' · ')
    : '';
}
$('optAutoTarget').onchange = renderOptAutoGain;
// mode de l'auto-optimisation en cours ('target'/'loop'/'fail'/'cron') — voir startAutoOpt
let autoOptMode = 'target';
function stopAutoOpt() {
  if (autoOptTimer) { clearInterval(autoOptTimer); autoOptTimer = null; }
  autoOptTargetLvl = null;
  const btn = $('btnOptAuto'); if (!btn) return;
  btn.classList.remove('running');
  btn.textContent = LANG==='fr' ? "▶ Auto jusqu'à" : '▶ Auto to';
  $('optAutoTarget').disabled = false;
  $('optAutoMode').disabled = false;
}
// bascule l'affichage du sélecteur de palier : uniquement utile en mode 'target' (2026-07-08)
$('optAutoMode').onchange = () => {
  $('optAutoTarget').style.display = $('optAutoMode').value === 'target' ? '' : 'none';
};
function startAutoOpt() {
  if (autoOptTimer) { clearInterval(autoOptTimer); autoOptTimer = null; } // garde-fou : jamais 2 intervalles en parallèle
  const mode = $('optAutoMode').value;
  autoOptMode = mode;
  autoOptTargetLvl = null;
  if (mode === 'target') {
    const sel = $('optAutoTarget');
    const lvl = parseInt(sel.value, 10);
    if (!Number.isInteger(lvl)) return;
    autoOptTargetLvl = lvl;
    sel.disabled = true;
  }
  // "jusqu'au prochain gain de PA/PD" (2026-07-08, demande explicite) : capture le PA/PD ACTUEL
  // (entier, arrondi vers le bas — voir effectiveApDp) avant de démarrer, puis s'arrête dès que ce
  // chiffre affiché augmente réellement — utile après le fix du menu déroulant (2026-07-08) qui a
  // montré que plusieurs paliers d'affilée ne changent parfois rien tant que la fraction accumulée
  // n'a pas franchi le point suivant
  let startAp = 0, startDp = 0;
  if (mode === 'nextgain') {
    const target0 = EQUIP[optTargetSlot];
    if (!target0) return;
    const cur = effectiveApDp(target0);
    startAp = cur.ap; startDp = cur.dp;
  }
  $('optAutoMode').disabled = true;
  const btn = $('btnOptAuto');
  btn.classList.add('running');
  btn.textContent = LANG==='fr' ? '⏸ Arrêter' : '⏸ Stop';
  autoOptTimer = setInterval(() => {
    const target = EQUIP[optTargetSlot];
    if (!target) { stopAutoOpt(); return; }
    if (mode === 'target' && (target.enhLv||0) >= autoOptTargetLvl) { stopAutoOpt(); return; }
    if ((target.enhLv||0) >= ENH_NAMES.length-1) { stopAutoOpt(); return; } // niveau max déjà atteint
    if (findEnhanceMaterial() === -1) {
      $('optResult').textContent = LANG==='fr' ? 'Auto arrêté — plus de matériau' : 'Auto stopped — out of material';
      stopAutoOpt();
      return;
    }
    // "jusqu'à plus de Pierre de Cron" (2026-07-08, demande explicite) : s'arrête dès que le sac
    // n'a plus de quoi protéger la prochaine rétrogradation — utile pour pousser un palier risqué
    // (+8 et au-delà) sans jamais tenter "à découvert" une fois le stock de protection épuisé
    if (mode === 'cron' && findCronStone() === -1) {
      $('optResult').textContent = LANG==='fr' ? 'Auto arrêté — plus de Pierre de Cron' : 'Auto stopped — out of Cron Stones';
      stopAutoOpt();
      return;
    }
    const prevLvl = target.enhLv||0;
    attemptEnhance();
    // "jusqu'au premier échec" (2026-07-08, demande explicite) : un échec est détecté quand le
    // niveau n'a PAS progressé d'exactement +1 (protection Cron incluse : le niveau ne bouge pas
    // non plus dans ce cas, donc compte comme un échec qui arrête la boucle)
    if (mode === 'fail') {
      const target2 = EQUIP[optTargetSlot];
      if (!target2 || (target2.enhLv||0) !== prevLvl + 1) { stopAutoOpt(); return; }
    }
    // "jusqu'au prochain gain de PA/PD" : s'arrête dès que le PA OU le PD affiché a réellement
    // augmenté par rapport au début de l'auto (voir startAp/startDp ci-dessus)
    if (mode === 'nextgain') {
      const target3 = EQUIP[optTargetSlot];
      if (!target3) { stopAutoOpt(); return; }
      const cur = effectiveApDp(target3);
      if (cur.ap > startAp || cur.dp > startDp) {
        $('optResult').textContent = LANG==='fr' ? `Auto arrêté — gain obtenu (${ENH_NAMES[target3.enhLv||0]})` : `Auto stopped — gain reached (${ENH_NAMES[target3.enhLv||0]})`;
        stopAutoOpt();
        return;
      }
    }
    // "en boucle" (2026-07-08, demande explicite) : aucune condition d'arrêt sur le niveau, continue
    // jusqu'à rupture de matériau (déjà géré ci-dessus) ou arrêt manuel
  }, 220);
}
$('btnOptAuto').onclick = () => { if (autoOptTimer) stopAutoOpt(); else startAutoOpt(); };

// ---------- conversion "Poussière d'esprit ancien" → "Pierre de Caphras" (5:1) ----------
// demande explicite du 2026-07-05 : la Pierre de Caphras n'est plus dropée directement en zone
// (remplacée par le matériau de palier Naru/Tuvala/Yuria/Grunil), elle s'obtient désormais via
// cette conversion de la poussière ramassée en zones 1 à 6.
const POUSSIERE_NAME = 'Poussière d\'esprit ancien';
const CAPHRAS_NAME = 'Pierre de Caphras';
function poussiereCount() {
  const s = INV.find(x => x && x.kind === 'craft' && x.name === POUSSIERE_NAME);
  return s ? s.qty : 0;
}
function renderCapConvertRow() {
  const lbl = $('capConvertLbl'), btn = $('btnConvertCaphras'); if (!lbl || !btn) return;
  const n = poussiereCount();
  lbl.textContent = (LANG==='fr' ? `${fmt(n)} poussière → ${Math.floor(n/5)} pierre de Caphras` : `${fmt(n)} dust → ${Math.floor(n/5)} Caphras stone`);
  btn.disabled = n < 5;
}
function convertPoussiereToCaphras() {
  const idx = INV.findIndex(s => s && s.kind === 'craft' && s.name === POUSSIERE_NAME);
  if (idx === -1 || INV[idx].qty < 5) return;
  INV[idx].qty -= 5;
  if (INV[idx].qty <= 0) INV[idx] = null;
  const ok = invAdd({ key:'mat_'+CAPHRAS_NAME, name:CAPHRAS_NAME, kind:'material', icon:ICO_MAT_CAPHRAS, color:'#c9a55a', qty:1, stackable:true, weight:0.1, val:120 });
  if (!ok) {
    // sac plein : annule le prélèvement de poussière
    const s = INV[idx];
    if (s) s.qty += 5; else INV[idx] = { key:'craft_'+POUSSIERE_NAME, name:POUSSIERE_NAME, kind:'craft', icon:'✦', color:'#b48ce8', qty:5, stackable:true, weight:0.2, val:0 };
    floatTxt(P.x, P.y, 100, LANG==='fr'?'Sac plein':'Bag full', { hurt:true });
    return;
  }
  floatTxt(P.x, P.y, 100, '+1 '+CAPHRAS_NAME, { gold:true });
  hud();
}
$('btnConvertCaphras').onclick = convertPoussiereToCaphras;

// suggestion : quelle pièce optimiser en priorité pour atteindre la zone suivante
function renderOptSuggestions() {
  const nextZone = ZONES[zoneIdx+1];
  const box = $('optSuggest');
  if (!nextZone) { box.textContent = LANG==='fr' ? 'Zone finale déjà atteinte — continuez à optimiser librement.' : 'Final zone already reached — keep enhancing freely.'; return; }
  const avail = optimizableList();
  if (!avail.length) { box.textContent = ''; return; }

  const apDeficit = Math.max(0, nextZone.reqAP - apEff());
  const dpDeficit = Math.max(0, nextZone.reqDP - totalDP());
  // le goulot le plus criant détermine ce qu'on recommande d'améliorer (PA ou PD)
  const focusAP = (apDeficit / nextZone.reqAP) >= (dpDeficit / nextZone.reqDP);

  let best = null, bestGain = -1;
  for (const k of avail) {
    const e = EQUIP[k];
    const lvl = e.enhLv||0;
    if (lvl >= ENH_NAMES.length-1) continue;
    const step = enhBonus(lvl+1) - enhBonus(lvl);
    // on note chaque pièce selon sa capacité à combler le manque prioritaire (PA ou PD)
    const gain = focusAP ? e.ap*step : (e.dp||0)*step;
    if (gain > bestGain) { bestGain = gain; best = { k, e, lvl }; }
  }
  if (!best || bestGain <= 0) { box.textContent = LANG==='fr' ? 'Toutes vos pièces pertinentes sont au niveau maximum.' : 'All relevant pieces are already at max level.'; return; }

  const arrow = ENH_NAMES[best.lvl] + '→' + ENH_NAMES[best.lvl+1];
  const statLbl = focusAP ? 'PA' : 'PD';
  const need = focusAP ? Math.round(apDeficit) : Math.round(dpDeficit);
  if (LANG === 'fr') {
    box.innerHTML = `🔥 Pour <b style="color:var(--gold)">${tr(nextZone.name)}</b>, il te manque ~${need} ${statLbl} :<br>${tr(best.e.name)} (${arrow}) — gain estimé <b style="color:var(--gold)">+${bestGain.toFixed(1)} ${statLbl}</b>`;
  } else {
    box.innerHTML = `🔥 For <b style="color:var(--gold)">${tr(nextZone.name)}</b>, you're short ~${need} ${statLbl}:<br>${tr(best.e.name)} (${arrow}) — estimated gain <b style="color:var(--gold)">+${bestGain.toFixed(1)} ${statLbl}</b>`;
  }
}

// ---------- table de loot de la zone active (ou en aperçu via le bouton "Voir"), avec % réels ----------
const LOOT_ICONS = { trash:'▬', material:'◈', jackpot:'💍', craft:'✦', gear:'⚔️' };
// aperçu agrandi au survol d'une icône de la table de loot (2026-07-08, demande explicite : "qu'on
// puisse agrandir l'icone pour mieux la voir en tooltip en auto en passant dessus") -- écoute
// déléguée sur tout le document (les icônes sont recréées à chaque rendu de table de loot, sur
// plusieurs panneaux : zone active, récapitulatif Velia, guide de farm) plutôt qu'un binding par
// élément qu'il faudrait refaire à chaque re-render
(function initLootIconZoom() {
  const zoomEl = document.getElementById('lootIconZoom');
  if (!zoomEl) return;
  document.addEventListener('mouseover', e => {
    const icon = e.target.closest('.lootIcon');
    if (!icon) return;
    zoomEl.innerHTML = icon.innerHTML;
    const col = icon.style.color; if (col) zoomEl.style.color = col;
    const r = icon.getBoundingClientRect();
    let left = r.right + 10, top = r.top + r.height/2 - 48;
    if (left + 96 > window.innerWidth) left = r.left - 106;
    top = Math.max(6, Math.min(top, window.innerHeight - 102));
    zoomEl.style.left = left + 'px'; zoomEl.style.top = top + 'px';
    zoomEl.classList.add('show');
  });
  document.addEventListener('mouseout', e => {
    const icon = e.target.closest('.lootIcon');
    if (!icon) return;
    if (icon.contains(e.relatedTarget)) return;
    zoomEl.classList.remove('show');
  });
})();
// construit les lignes de loot d'UNE zone (utilisé pour l'aperçu normal ET pour le récapitulatif
// "toutes zones confondues" affiché à Velia, voir renderLootTable ci-dessous)
function zoneLootRowsHtml(idx) {
  const z = ZONES[idx], L = z.loot;
  const tier = gearTierForZone(idx);
  const gearCh = tier.dropChance != null ? tier.dropChance : (GEAR_CHANCE[idx] ?? .002);
  const equippedWord = LANG === 'fr' ? 'PA équipé' : 'AP equipped';
  const armorPieceNote = LANG==='fr' ? 'armure — cette zone uniquement' : 'armor — this zone only';
  const weaponPieceNote = LANG==='fr' ? 'arme — cette zone uniquement' : 'weapon — this zone only';
  const rows = [
    { kind:'trash',    it:L.trash,   note:'revenu de base' },
    { kind:'material', it:{name:tier.material.name, icon:tier.material.icon}, ch:L.mat.ch, note:'optimisation' },
  ];
  // détaille EXACTEMENT quelle pièce d'armure (et quelle arme, s'il y en a une) cette zone précise
  // garantit (2026-07-06, demande explicite : "explique quel stuff exactement tu vas pouvoir
  // loot") — remplace l'ancienne ligne générique "Gris — Naru / arme+armure (7 pièces)", qui ne
  // disait pas laquelle des 7 pièces on obtenait réellement ici (voir ZONE_ARMOR_SLOTS/ZONE_WEAPON_SLOTS)
  // -- chaque ligne utilise désormais la VRAIE icône de la pièce (2026-07-08, demande explicite :
  // "as-tu mis les svg sur la loottable" — remplace le glyphe générique ⚔️/💍 partagé par tout un
  // "kind", qui ne montrait pas à quoi la pièce allait réellement ressembler)
  const GEAR_ICON_FOR_SLOT = { helmet:helmetIconForColor, armor:armorIconForColor, gloves:glovesIconForColor, boots:bootsIconForColor,
    weapon:staffIconForColor, secondary:daggerIconForColor, awakening:orbPairIconForColor };
  const armorSlot = (ZONE_ARMOR_SLOTS[idx]||[])[0];
  if (armorSlot) rows.push({ kind:'gear', it:{name:tier.sets[armorSlot], icon:GEAR_ICON_FOR_SLOT[armorSlot](tier.color,tier.grade)}, ch:gearCh, note:armorPieceNote });
  const weaponSlot = (ZONE_WEAPON_SLOTS[idx]||[])[0];
  if (weaponSlot) rows.push({ kind:'gear', it:{name:tier.sets[weaponSlot], icon:GEAR_ICON_FOR_SLOT[weaponSlot](tier.color,tier.grade)}, ch:gearCh, note:weaponPieceNote });
  const jSlot = accSlotFor(L.jackpot);
  const jTierIdx = JEWEL_TIER_IDX[tier.grade] ?? 0;
  const JEWEL_ICON_FOR_SLOT = { ring:ringIconForTier, necklace:necklaceIconForTier, earring:earringIconForTier, belt:beltIconForTier };
  const jackpotIcon = (JEWEL_ICON_FOR_SLOT[jSlot] || ringIconForTier)(jTierIdx, tier.color);
  // AP affiché = celui RÉELLEMENT dropé (voir rollDrops), pas l'ancienne valeur figée de ZONES —
  // sinon la table de loot promettrait un chiffre différent de ce qu'on obtient vraiment en jeu
  const jackpotApShown = gearFloor((z.gearBasisAP ?? z.reqAP) * GEAR_ROLE.jackpot.apShare);
  rows.push(
    { kind:'jackpot',  it:{...L.jackpot, icon:jackpotIcon}, note:'+'+jackpotApShown+' '+equippedWord },
    { kind:'craft',    it:L.craft,   note:'craft endgame' },
    // Pierre de Cron : taux fixe (voir CRON_STONE.ch), identique dans TOUTES les zones — demande explicite du 2026-07-08
    { kind:'material', it:{name:CRON_STONE.name, icon:CRON_STONE.icon}, ch:CRON_STONE.ch, note:'1 à 3 unités — protège un enchantement d\'une rétrogradation' },
  );
  // les couleurs des rangées "armure" et "matériau" reprennent celles du stuff dans l'inventaire
  // (gris/blanc/vert/bleu selon le palier) au lieu d'un violet/or générique — demande du 2026-07-06.
  // "jackpot" (bijou) manquait à cette table (2026-07-10, bug trouvé en vérification) : la ligne
  // dépliée du bijou restait sans couleur alors que la ligne condensée (zoneLootCompactRowHtml),
  // l'inventaire (2026-07-09) et la poupée d'équipement (2026-07-05) l'ont toutes.
  const rowColor = { gear: tier.color, material: tier.material.color, jackpot: tier.color };
  return rows.map(r => {
    const ch = r.ch ?? r.it.ch;
    // la Pierre de Cron garde SA couleur propre (dorée) plutôt que celle du matériau de palier —
    // sinon les 2 rangées "material" se confondraient visuellement
    const col = r.it.name === CRON_STONE.name ? CRON_STONE.color : rowColor[r.kind];
    const iconHtml = r.it.icon || LOOT_ICONS[r.kind];
    return `
    <div class="lootRow">
      <div class="lootIcon k-${r.kind}"${col?` style="color:${col};border-color:${col}"`:''}>${iconHtml}</div>
      <div class="lootInfo"><div class="ln"${col?` style="color:${col}"`:''}>${tr(r.it.name)}</div><div class="lv">${tr(r.note)}</div></div>
      <div class="lootPct">${(ch*100).toFixed(ch < .01 ? 3 : 1)}%</div>
    </div>`;
  }).join('');
}
// ligne CONDENSÉE (1 par zone, repliée par défaut) pour le récapitulatif "toutes zones" de Velia —
// demande explicite du 2026-07-08 ("faut scroll à la mort") : affiche juste le bijou (l'objet le
// plus recherché de la zone), un clic déplie le détail complet via zoneLootRowsHtml
function zoneLootCompactRowHtml(idx) {
  const z = ZONES[idx], tier = gearTierForZone(idx);
  // vraie icône du bijou de cette zone (2026-07-08, même correctif que zoneLootRowsHtml) au lieu
  // du glyphe générique 💍 partagé par tous les paliers
  const jSlot = accSlotFor(z.loot.jackpot);
  const jTierIdx = JEWEL_TIER_IDX[tier.grade] ?? 0;
  const JEWEL_ICON_FOR_SLOT = { ring:ringIconForTier, necklace:necklaceIconForTier, earring:earringIconForTier, belt:beltIconForTier };
  const jackpotIcon = (JEWEL_ICON_FOR_SLOT[jSlot] || ringIconForTier)(jTierIdx, tier.color);
  return `<div class="lootRow lootZoneCompact" data-zi="${idx}">
    <div class="lootIcon k-jackpot" style="color:${tier.color};border-color:${tier.color}">${jackpotIcon}</div>
    <div class="lootInfo"><div class="ln" style="color:${tier.color}">${tr(z.name)}</div><div class="lv">${tr(z.mob)} · ${tr(z.loot.jackpot.name)}</div></div>
    <div class="lootPct">${fmtTinyPct(z.loot.jackpot.ch)} <span class="lootExpandHint">▾</span></div>
  </div>`;
}
// guide de farm (2026-07-05, demande explicite) : clic sur un emplacement de sac VIDE -- affiche
// où farmer, dans toutes les zones disponibles (débloquées), EN EXCLUANT les zones actuellement
// trop dangereuses pour le joueur (badge "ZONE DANGEREUSE", voir badgeOf/bottleneck). Réutilise le
// même récapitulatif condensé/dépliable que la vue Velia (zoneLootCompactRowHtml/zoneLootRowsHtml).
function showFarmGuide() {
  const rows = ZONES.map((z,zi) => ({ zi, dangerous: badgeOf(bottleneck(z)).txt === 'ZONE DANGEREUSE' }))
    .filter(r => r.zi <= S.maxZoneIdx && !r.dangerous);
  const html = rows.length ? rows.map(r =>
    `${zoneLootCompactRowHtml(r.zi)}<div class="lootZoneDetail" id="farmGuideDetail${r.zi}" style="display:none">${zoneLootRowsHtml(r.zi)}</div>`
  ).join('') : `<div class="admHint">${LANG==='fr'
    ? 'Aucune zone débloquée n\'est actuellement sûre pour toi — améliore ton stuff ou explore prudemment.'
    : 'No unlocked zone is currently safe for you — improve your gear or explore carefully.'}</div>`;
  const banner = `<div class="admHint">${LANG==='fr'
    ? '🗺️ Où farmer ? Zones débloquées, hors zones trop dangereuses pour ton stuff actuel — clique une zone pour voir le détail complet :'
    : '🗺️ Where to farm? Unlocked zones, excluding ones currently too dangerous for your gear — click a zone to see the full detail:'}</div>`;
  openInfo(LANG==='fr' ? '🗺️ Où farmer ?' : '🗺️ Where to farm?', banner + html);
  $a('infoBody').querySelectorAll('.lootZoneCompact').forEach(row => {
    row.onclick = () => {
      const detail = $a('farmGuideDetail'+row.dataset.zi);
      const willOpen = detail.style.display === 'none';
      detail.style.display = willOpen ? '' : 'none';
      row.classList.toggle('expanded', willOpen);
    };
  });
}
function renderLootTable(previewIdx) {
  // Velia (zone paisible) : aucun monstre, donc aucun loot possible ICI — message explicite au lieu
  // d'afficher par erreur les stats de la dernière zone farmée. On affiche à la place, à titre
  // informatif, le récapitulatif CONDENSÉ (1 ligne/zone, dépliable) du loot de TOUTES les zones de
  // Velia — demande explicite du 2026-07-08 (la version dépliée à 100% pour les 11 zones obligeait
  // à un scroll interminable).
  if (atVelia && previewIdx == null) {
    lootPreviewIdx = null;
    updateZoneViewHalo();
    $('lootZoneName').textContent = LANG==='fr' ? 'Velia — zone paisible' : 'Velia — peaceful zone';
    const banner = `<div class="admHint">${LANG==='fr'
      ? '🕊️ Zone paisible : aucun monstre, aucun loot possible ici. Aperçu condensé de ce que chaque zone de Velia peut looter — clique une zone pour voir le détail complet :'
      : '🕊️ Peaceful zone: no monsters, no loot possible here. Condensed preview of what each Velia zone can loot — click a zone to see the full detail:'}</div>`;
    const allZonesHtml = ZONES.map((z,zi) =>
      `${zoneLootCompactRowHtml(zi)}<div class="lootZoneDetail" id="lootDetail${zi}" style="display:none">${zoneLootRowsHtml(zi)}</div>`
    ).join('');
    $('lootTable').innerHTML = banner + allZonesHtml;
    $('lootTable').querySelectorAll('.lootZoneCompact').forEach(row => {
      row.onclick = () => {
        const detail = $a('lootDetail'+row.dataset.zi);
        const willOpen = detail.style.display === 'none';
        detail.style.display = willOpen ? '' : 'none';
        row.classList.toggle('expanded', willOpen);
      };
    });
    return;
  }
  const idx = previewIdx != null ? previewIdx : zoneIdx;
  lootPreviewIdx = previewIdx != null ? previewIdx : null;
  updateZoneViewHalo();
  const z = ZONES[idx];
  const previewTag = previewIdx != null && previewIdx !== zoneIdx
    ? (LANG==='fr' ? '👁 Aperçu — ' : '👁 Preview — ') : '';
  $('lootZoneName').textContent = previewTag + tr(z.mob);
  const mainRowsHtml = zoneLootRowsHtml(idx);
  // catégorie EXPÉRIMENTALE "Trésor de Velia" : identique dans toutes les zones de Velia, marquée
  // TEST en attendant une vraie recette/usage — demande explicite du 2026-07-06
  const testRowsHtml = VELIA_TREASURE.map(t => `
    <div class="lootRow">
      <div class="lootIcon k-treasure" style="color:${t.color};border-color:${t.color}">${t.icon}</div>
      <div class="lootInfo"><div class="ln" style="color:${t.color}">${tr(t.name)}</div></div>
      <div class="lootPct">${fmtTinyPct(t.ch)}</div>
    </div>`).join('');
  $('lootTable').innerHTML = mainRowsHtml +
    `<div class="lootCatHead">🧪 TEST</div>` + testRowsHtml;
}
function dropItem(i) {
  const s = INV[i]; if (!s) return;
  if (forcedMatKey && s.key === forcedMatKey) forcedMatKey = null;
  INV[i] = null;
  hud();
}
// vente individuelle (bouton "Vendre 1", voir showItemMenu) — ordre de priorité STRICT avant de
// vraiment vendre quoi que ce soit, quelle que soit la provenance de l'objet (2026-07-10, demande
// explicite : "quelque soit sa provenance s'il est meilleur je l'equipe, puis je regarde si il
// doit remplacer un moins bon item dans le compendium... EQUIPE>COMPENDIUM>VENDRE") :
//   1. ÉQUIPER : si l'objet est meilleur (socle) que ce qui est déjà porté sur son slot, il prend
//      sa place au lieu d'être vendu (l'ancien retourne dans le sac, jamais perdu).
//   2. COMPENDIUM : sinon, s'il doit remplacer un exemplaire moins enchanté déjà protégé (ou s'il
//      n'y en a aucun), il rejoint le sac protégé au lieu d'être vendu (voir ensureCompendiumProtection).
//   3. VENDRE : seulement si aucun des 2 cas au-dessus ne s'applique.
function sellOne(i) {
  const s = INV[i]; if (!s) return;
  if (s.kind === 'gear' || s.kind === 'jackpot') {
    if (tryAutoEquipIfBetter(i, s)) { hud(); return; }
    if (!S.penMastery[s.name]) {
      ensureCompendiumProtection(s.name);
      if (INV[i] !== s) { hud(); return; } // ensureCompendiumProtection a pris CET exemplaire précis
    }
  }
  addSilver(s.val, 'sell', s.name);
  if (s.kind === 'gear' || s.kind === 'jackpot') INV[i] = null; else invRemoveAt(i, 1);
  hud();
}
function sellStack(i) {
  const s = INV[i]; if (!s) return;
  const total = s.val * s.qty;
  addSilver(total, 'sell', s.name);
  INV[i] = null;
  if (s.kind === 'gear' || s.kind === 'jackpot') ensureCompendiumProtection(s.name);
  hud();
}
function sellAllOfKind(kind) {
  let total = 0;
  const soldItems = [];
  for (let i = 0; i < INV_SIZE; i++) {
    const s = INV[i];
    if (s && s.kind === kind) { total += s.val * s.qty; soldItems.push({ ...s }); INV[i] = null; }
  }
  addSilver(total, 'sell', kind);
  if (kind === 'material' && soldItems.length) logSellMats(soldItems, total);
  hud();
}
// journal des ventes groupées de matériaux : permet à l'admin de rembourser un clic accidentel
// sur "Vendre mat" (voir panneau admin) — best-effort, ne bloque jamais la vente si ça échoue
async function logSellMats(items, total) {
  if (!sb || !currentUser) return;
  try { await sb.rpc('log_sell_mats', { p_items: items, p_total: total, p_pseudo: myPseudo || null }); } catch (e) {}
}
$('sellTrash').onclick = () => {
  if (!confirm(LANG==='fr' ? 'Vendre tout le rebut ?' : 'Sell all trash?')) return;
  sellAllOfKind('trash'); refreshInvUI();
};
$('sellMats').onclick = () => {
  if (!confirm(LANG==='fr' ? 'Vendre tous les matériaux ?' : 'Sell all materials?')) return;
  sellAllOfKind('material'); refreshInvUI();
};
$('sortInv').onclick = () => {
  const items = INV.filter(s => s).sort((a,b) => {
    const order = { jackpot:0, craft:1, material:2, trash:3 };
    return (order[a.kind]-order[b.kind]) || a.name.localeCompare(b.name);
  });
  for (let i = 0; i < INV_SIZE; i++) INV[i] = items[i] || null;
  refreshInvUI();
};

// passe lootPreviewIdx explicitement : un simple renderLootTable() remettrait le loot affiché
// sur la zone qu'on farm à CHAQUE rafraîchissement auto (dès qu'un objet est ramassé), écrasant
// l'aperçu manuel choisi via le 👁 quasi instantanément
function refreshInvUI() { renderEquipment(); renderInventory(); renderOptimization(); renderLootTable(lootPreviewIdx); }

// migration RÉTROACTIVE du rééquilibrage PA/PD des armes/armures/bijoux (V158, 2026-07-05, demande
// explicite : "le stuff est rétroactif, modifie celui déjà existant") — sans elle, tout objet
// DÉJÀ tombé chez un joueur garderait ses anciennes stats (bien plus hautes pour les armes),
// coexistant avec les nouveaux drops rééquilibrés, ce qui n'était pas voulu.
//
// Pour l'armure/les armes : l'ancien PA/PD de base = reqAP/reqDP de la zone × ANCIENNE part × un
// facteur aléatoire tiré au drop (jamais stocké sur l'objet). Comme ce facteur est le MÊME des deux
// côtés de l'équation, le nouveau PA/PD = ancien × (nouvelle part / ancienne part) — pas besoin de
// connaître la zone d'origine exacte de l'objet, le ratio suffit.
//
// Pour les bijoux (jackpot) : les valeurs n'ont jamais été une formule, juste des nombres choisis à
// la main par objet — remplacés directement par la nouvelle valeur, identifiée par leur NOM.
const GEAR_RESCALE_RATIO_AP = {
  weapon: 0.0896/0.42, awakening: 0.1173/0.55, secondary: 0.0640/0.30,
  helmet: 0.0204/0.05, armor: 0.0204/0.05, gloves: 0.0163/0.04, boots: 0.0163/0.04,
};
const GEAR_RESCALE_RATIO_DP = {
  helmet: 0.1272/0.24, armor: 0.1272/0.24, gloves: 0.0954/0.18, boots: 0.0954/0.18,
};
const JEWELRY_NEW_AP = {
  'Anneau Naru':1, 'Collier Naru':1, 'Ceinture Naru':1,
  'Anneau Tuvala':2, 'Collier Tuvala':3, 'Ceinture Tuvala':4,
  'Anneau Asula':4, 'Collier Asula':7, 'Ceinture Asula':10,
  'Anneau de Cadry':8, "Serap's Necklace":13,
};
function migrateGearRebalanceV158() {
  const rescaleOne = it => {
    if (!it) return;
    if (it.kind === 'gear' && it.slot) {
      const rAp = GEAR_RESCALE_RATIO_AP[it.slot];
      if (rAp != null) it.ap = Math.round((it.ap||0) * rAp);
      const rDp = GEAR_RESCALE_RATIO_DP[it.slot];
      if (rDp != null) it.dp = Math.round((it.dp||0) * rDp);
      // hp/dodge inchangés : leurs parts (hpShare/dodgeShare) n'ont pas été modifiées par V158
    } else if (it.kind === 'jackpot' && JEWELRY_NEW_AP[it.name] != null) {
      it.ap = JEWELRY_NEW_AP[it.name];
    }
  };
  Object.values(EQUIP).forEach(rescaleOne);
  INV.forEach(rescaleOne);
  COMPENDIUM_BAG.forEach(rescaleOne);
}
// ajout des boucles d'oreille (2026-07-05, demande explicite) : le PA des bijoux déjà existants
// (anneau/collier/ceinture, sauf le palier gris resté à 1) est redistribué pour laisser de la
// place à la boucle d'oreille sans changer le total PA du palier -- voir le commentaire sur les
// nouvelles zones dans ZONES pour le détail du calcul
const JEWELRY_NEW_AP_V175 = {
  'Anneau Tuvala':1, 'Collier Tuvala':2, 'Ceinture Tuvala':3,
  'Anneau Asula':2, 'Collier Asula':4, 'Ceinture Asula':6,
  'Anneau de Cadry':6, "Serap's Necklace":9, "Orkinrad's Belt":10,
};
function migrateEarringRebalanceV175() {
  const rescaleOne = it => { if (it && it.kind === 'jackpot' && JEWELRY_NEW_AP_V175[it.name] != null) it.ap = JEWELRY_NEW_AP_V175[it.name]; };
  Object.values(EQUIP).forEach(rescaleOne);
  INV.forEach(rescaleOne);
  COMPENDIUM_BAG.forEach(rescaleOne);
}
// AP retiré des armures, redistribué aux armes (2026-07-06, demande explicite : "les armures ne
// donnent pas d'AP") — voir GEAR_ROLE. Rétroactif sur le stuff déjà possédé : armure → AP à 0,
// armes → ×1.271 (même ratio que le nouveau/l'ancien apShare total, préserve le total AP du stuff).
const GEAR_RESCALE_RATIO_AP_V192 = {
  weapon: 1.271, awakening: 1.271, secondary: 1.271,
  helmet: 0, armor: 0, gloves: 0, boots: 0,
};
function migrateArmorNoApV192() {
  const rescaleOne = it => {
    if (!it || it.kind !== 'gear' || !it.slot) return;
    const r = GEAR_RESCALE_RATIO_AP_V192[it.slot];
    if (r != null) it.ap = Math.round((it.ap||0) * r);
  };
  Object.values(EQUIP).forEach(rescaleOne);
  INV.forEach(rescaleOne);
  COMPENDIUM_BAG.forEach(rescaleOne);
}
// nom du bijou (jackpot) → index de zone qui le drope — chaque zone a un nom UNIQUE de bijou,
// donc cette table est sans ambiguïté (voir ZONES[i].loot.jackpot.name)
const JACKPOT_NAME_TO_ZONE = {
  'Anneau Naru':0, 'Collier Naru':1, 'Ceinture Naru':2,
  'Anneau Tuvala':3, 'Collier Tuvala':4, 'Ceinture Tuvala':5,
  'Anneau Asula':6, 'Collier Asula':7, 'Ceinture Asula':8,
  'Anneau de Cadry':9, "Serap's Necklace":10, "Orkinrad's Belt":11,
  'Boucle Naru':12, 'Boucle Tuvala':13, 'Boucle Asula':14, "Tungrad's Earring":15,
};
// migration 2026-07-08 (demande explicite : "revois ce que donne le stuff et aligne avec toute
// les autre stuff") : l'AP des bijoux (jackpot) était une valeur FIGÉE par zone dans ZONES, jamais
// recalculée après les changements de reqAP (V201-V206) — un bijou déjà en sac/équipé gardait
// l'ancien chiffre pour toujours, désynchronisé du stuff nouvellement dropé (qui, lui, utilise
// désormais gearFloor(gearBasisAP*apShare), voir rollDrops). Recalcule l'AP de BASE (avant
// enchantement, qui reste géré par enhBonus/itemMult comme d'habitude) de tout bijou déjà possédé.
function migrateJewelryApV207() {
  const rescaleOne = it => {
    if (!it || it.kind !== 'jackpot') return;
    const zi = JACKPOT_NAME_TO_ZONE[it.name];
    if (zi == null) return;
    const zone = ZONES[zi];
    it.ap = gearFloor((zone.gearBasisAP ?? zone.reqAP) * GEAR_ROLE.jackpot.apShare);
  };
  Object.values(EQUIP).forEach(rescaleOne);
  INV.forEach(rescaleOne);
  COMPENDIUM_BAG.forEach(rescaleOne);
}
// retrouve la zone d'origine d'une pièce de GEAR déjà possédée (armure/arme) à partir de son
// palier (couleur) + son slot -- contrairement aux bijoux (1 nom unique par zone, voir
// JACKPOT_NAME_TO_ZONE), un nom de gear est partagé par tout un palier ; mais chaque (palier,slot)
// ne correspond qu'à UNE SEULE zone (voir ZONE_ARMOR_SLOTS/ZONE_WEAPON_SLOTS, 1 pièce garantie par
// zone), donc la paire reste sans ambiguïté.
function zoneForGearPiece(item) {
  const tierIdx = GEAR_TIERS.findIndex(t => t.color === item.color);
  if (tierIdx === -1) return null;
  const tier = GEAR_TIERS[tierIdx];
  for (const zi of tier.zones) {
    if ((ZONE_ARMOR_SLOTS[zi]||[]).includes(item.slot) || (ZONE_WEAPON_SLOTS[zi]||[]).includes(item.slot)) return zi;
  }
  return null;
}
// migration 2026-07-10 (demande explicite : "vérifie la rétroactivité lors de modification de
// stuff pour tout objet déjà existant") : les stats de BASE du gear (ap/dp/hp/dodge) et le prix de
// revente (val, gear ET bijoux) sont figés sur l'objet dès son drop, jamais recalculés tout seuls —
// la V226 (stats FIXES, plus de ±15% aléatoire) et la V225 (revente du gear/bijou fortement
// réduite, voir GEAR_SELL_MULT/JACKPOT_VAL_TRASH_RATIO) ne s'appliquaient donc QU'aux nouveaux
// drops, laissant tout le stuff déjà possédé sur l'ancien tirage aléatoire et l'ancien prix. Cette
// migration recalcule les 2 pour tout gear/bijou déjà en sac/équipé/protégé, avec EXACTEMENT la
// même formule que rollGearDrop/rollWeaponDrop/rollDrops (jamais dupliquée à la main) — seul
// l'enchantement (enhLv, géré séparément par enhBonus/itemMult) reste inchangé.
function migrateGearFixedStatsV226() {
  const rescaleOne = it => {
    if (!it) return;
    if (it.kind === 'gear' && it.slot) {
      const zi = zoneForGearPiece(it);
      if (zi == null) return;
      const zone = ZONES[zi];
      const role = GEAR_ROLE[it.slot];
      const basisAP = zone.gearBasisAP ?? zone.reqAP, basisDP = zone.gearBasisDP ?? zone.reqDP;
      it.ap = role.apShare ? gearFloor(basisAP * role.apShare) : 0;
      it.dp = role.dpShare ? gearFloor(basisDP * role.dpShare) : 0;
      it.hp = role.hpShare ? gearFloor(basisDP * role.hpShare * HP_GEAR_SCALE) : 0;
      it.dodge = Math.round(basisDP * (role.dodgeShare||0) * DODGE_GEAR_SCALE * 100) / 100;
      it.val = Math.round((it.ap*2 + it.dp + it.hp*0.5) * GEAR_SELL_MULT);
    } else if (it.kind === 'jackpot') {
      const zi = JACKPOT_NAME_TO_ZONE[it.name];
      if (zi == null) return;
      it.val = gearFloor(ZONES[zi].loot.trash.val * JACKPOT_VAL_TRASH_RATIO);
    }
  };
  Object.values(EQUIP).forEach(rescaleOne);
  INV.forEach(rescaleOne);
  COMPENDIUM_BAG.forEach(rescaleOne);
}
// migration 2026-07-11 (demande explicite : "Tout les stuff sont strictement sans range,
// rétroactif") : migrateGearFixedStatsV226/migrateJewelryApV207 recalculent bien ap/dp/hp/dodge/val
// à partir des reqAP/reqDP ACTUELS des zones, mais ne se relancent JAMAIS une fois passées (gate à
// usage unique par compte) -- les changements de reqAP/reqDP de zones de cette session (V234 :
// Trent/Iliya/Bashim échelonnées ; V235 : Kratuga/Planque des Mânes lissées) ne se répercutaient
// donc PAS sur le stuff déjà possédé avant ces changements. Relance simplement les 2 migrations
// existantes (mêmes formules, jamais dupliquées) pour rattraper tout le monde une fois de plus.
// À REFAIRE (nouveau flag S.migratedGearRescaleVxxx) à chaque future modification de reqAP/reqDP/
// gearBasisAP/DP d'une zone, sans quoi le stuff déjà dropé reste sur l'ancien calcul pour toujours.
function migrateGearRescaleV235() {
  migrateGearFixedStatsV226();
  migrateJewelryApV207();
}
// migration 2026-07-12 (demande explicite : "fais en sorte que la mine de fer abandonné pass en
// zone difficile...") : Colonie Sausan a reçu un gearBasisDP dédié (45, au lieu du reqDP:37 utilisé
// par défaut) -- comme à chaque changement de reqAP/reqDP/gearBasisAP/DP de zone (voir
// migrateGearRescaleV235 ci-dessus), le stuff déjà dropé de cette zone AVANT ce changement doit être
// rattrapé. Nouveau flag dédié plutôt que réutiliser migratedGearRescaleV235 (déjà consommé par les
// comptes qui ont chargé une sauvegarde depuis le 2026-07-11).
function migrateGearRescaleV243() {
  migrateGearFixedStatsV226();
  migrateJewelryApV207();
}
// migration 2026-07-11 (bug corrigé : "aucune pierre ne se met dans le slot pour les bijoux") --
// les bijoux (jackpot) n'ont jamais eu de matName depuis leur introduction (voir rollDrops,
// corrigé juste au-dessus) : findEnhanceMaterial() retombait donc sur le matériau de la zone
// COURANTE au lieu de celui du PALIER du bijou lui-même. Backfill pour tout bijou déjà possédé
// (équipé/sac/protégé), à partir de SA PROPRE zone d'origine (JACKPOT_NAME_TO_ZONE, jamais celle
// où l'on farme actuellement).
function migrateJewelryMatNameV239() {
  const fix = it => {
    if (!it || it.kind !== 'jackpot' || it.matName) return;
    const zi = JACKPOT_NAME_TO_ZONE[it.name];
    if (zi == null) return;
    it.matName = gearTierForZone(zi).material.name;
  };
  Object.values(EQUIP).forEach(fix);
  INV.forEach(fix);
  COMPENDIUM_BAG.forEach(fix);
}
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

renderInvCatTabs();
hud();
setInterval(hud, 1000);
setInterval(() => { if (!document.hidden) S.playtimeSec++; }, 1000); // temps de jeu cumulé (onglet actif uniquement)
setTimeout(()=>{ addSilver(80, 'welcome'); hud(); }, 1200);
// sauvegarde automatique locale (fallback hors-ligne, coexiste avec Supabase)
setInterval(() => { try { localStorage.setItem('velia-idle-save', JSON.stringify(getSaveState())); } catch(e) {} }, 15000);
requestAnimationFrame(loop);
