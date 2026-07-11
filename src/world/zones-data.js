// ==================== DONNEES DES ZONES (extrait de game-core.js le 2026-07-08, reorganisation
// par dossiers) -- charge AVANT core/game-core.js dans index.html : simple donnee, aucune
// dependance vers des fonctions/etat definis ailleurs.
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
// (voir docs/roadmap.md pour le détail des paliers futurs). Le "selon l'optimisation" vient
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
  // reqDP abaissé de 157 à 125 le 2026-07-15 (demande explicite, valeurs RÉELLES fournies par
  // capture d'écran : "selon mon stuff donc moyenne full pri change les pa pd de la zone kratuga
  // pour tout juste difficile" -- stuff moyen full PRI du joueur : 301 PA / 78 PD) : à ces valeurs,
  // le PD était le facteur totalement bloquant (78/157 = 0.497, ZONE DANGEREUSE) alors que le PA
  // (301/286 = 1.05, déjà ZONE ADAPTÉE) n'était pas le problème -- reqAP inchangé. reqDP=125 est le
  // PLANCHER imposé par testZoneMonotonicity (ne peut pas descendre sous le reqDP de Sanctuaire
  // Elric, 101, la zone juste avant dans l'ordre réel de farm) qui ramène le ratio PD à 0.624 (ZONE
  // DIFFICILE, "tout juste" comme demandé). Ne touche pas Planque des Mânes/Forêt de Polly.
  // reqDP remonté de 125 à 129 le 2026-07-16 (demande explicite, nouvelle capture d'écran : "kratuga
  // dois tout juste acces difficile avec stuff comme sur le screen, modifie les ap [sic] de la
  // zone... moyenne pri" -- stuff réel du joueur cette fois : Niv.29, PA 365 / PD 92). Le PA
  // (365/286 = 1.276, largement ZONE ADAPTÉE) n'est PAS et ne PEUT PAS devenir le facteur bloquant
  // ici : même au plafond monotone autorisé (reqAP ≤ 303, celui de Planque des Mânes), le ratio PA
  // resterait ≥ 1.20, toujours loin au-dessus du ratio PD -- reqAP volontairement inchangé, le
  // rendre plus strict n'aurait aucun effet sur le badge affiché. Le PD (92/125 = 0.736) restait
  // le vrai goulot, mais confortablement au milieu de la zone DIFFICILE plutôt que "tout juste" —
  // reqDP=129 est le PLAFOND imposé par testZoneMonotonicity (ne peut pas dépasser le reqDP de
  // Planque des Mânes, 129, calibré la veille pour SA propre référence de stuff — le dépasser aurait
  // fait glisser Mânes en ZONE DANGEREUSE pour cette référence-là) : ramène le ratio PD à 0.713, le
  // plus proche du seuil 0.6 atteignable sans casser le calibrage de Planque des Mânes.
  { name:'Ruines de Kratuga', tier:'Mediah — Early', reqAP:286, reqDP:129, mob:'Uluan',
    hpPer:894, dmg:110, xp:450,
    tint:{ a:'#4a3d30', b:'#44382c', dry:'#524436' }, tones:['#b09060','#a08252','#c0a070'], alphaTone:'#6e5636',
    loot:{ trash:{name:'Relique d\'Hystria',val:105,ch:1}, mat:{name:'Pierre de Caphras',val:6,ch:.09},
      jackpot:{name:'Serap\'s Necklace',val:29600,ch:.0008,ap:9}, craft:{name:'Marbre du Dieu déchu',ch:.0025} } },
  // 3e zone Grunil (2026-07-05, demande explicite : "ajoute Planque des Mânes dernière zone") —
  // complète la rotation d'arme (weapon/secondary/awakening, une par zone du palier — voir
  // ZONE_WEAPON_SLOTS) et apporte la ceinture manquante (Orkinrad's Belt). reqAP/reqDP lissés le
  // 2026-07-11 (voir commentaire sur Ruines de Kratuga juste au-dessus) — 1 palier intermédiaire
  // entre Kratuga (286/157) et le plafond final 320/175 (Forêt de Polly).
  // reqDP abaissé de 166 à 129 le 2026-07-16 (demande explicite : "ce stuff en moyenne devrait
  // arriver tout juste Planque des Mânes en difficile full pri, change ap et dp si nécessaire") --
  // même référence "stuff moyen full PRI" que le rééquilibrage de Kratuga ci-dessus (301 PA / 78 PD) :
  // à ces valeurs le PD était le facteur bloquant (78/166 = 0.470, ZONE DANGEREUSE) alors que le PA
  // (301/303 = 0.993, quasi ZONE ADAPTÉE) n'était pas le problème -- reqAP inchangé. reqDP=129 ramène
  // le ratio PD à 0.605 (tout juste au-dessus du seuil ZONE DIFFICILE à 0.6, voir bottleneck()),
  // reste dans le couloir imposé par testZoneMonotonicity (Kratuga=125 ≤ 129 ≤ Polly=175).
  { name:'Planque des Mânes', tier:'Mediah — Early', reqAP:303, reqDP:129, mob:'Esprit des Mânes',
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
  // reqDP abaissé de 175 à 170 le 2026-07-16 (demande explicite, capture d'écran : "avec ce stuff en
  // moyenne duo je dois tout juste avoir acces a polly en difficile" -- stuff réel du joueur :
  // PA 438 / PD 104). Le PA (438/320 = 1.369, largement ZONE ADAPTÉE) n'est pas le problème --
  // reqAP inchangé (Polly reste le plafond de fin de jeu à 320). Le PD (104/175 = 0.594) était le
  // facteur bloquant, tout juste sous le seuil ZONE DANGEREUSE (0.6) -- reqDP=170 ramène le ratio à
  // 0.612 (ZONE DIFFICILE, "tout juste" comme demandé). Polly est la DERNIÈRE zone de sa colonne
  // monotone (après Planque des Mânes, reqDP=129) : aucune zone suivante à respecter, pas de cascade.
  { name:'Forêt de Polly', tier:'Mediah — Early', reqAP:320, reqDP:170, mob:'Troll de Polly',
    hpPer:1120, dmg:140, xp:560,
    tint:{ a:'#25382c', b:'#213228', dry:'#2c4034' }, tones:['#3f6e50', '#356045', '#4a805c'], alphaTone:'#274a34',
    loot:{ trash:{name:'Mousse de Polly',val:135,ch:1}, mat:{name:'Pierre de Caphras',val:4,ch:.055},
      jackpot:{name:'Tungrad\'s Earring',val:38500,ch:.00044,ap:11}, craft:{name:'Marbre du Dieu déchu',ch:.0013} } },
];
