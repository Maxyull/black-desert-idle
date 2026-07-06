# Feuille de route des zones — Velia Idle

Notation : `Nom de zone (Monstre, ...)` — si plusieurs monstres listés : un gros mob + un petit mob ;
si 3 : un boss + un petit + un gros.

## Early — Velia (déjà en jeu, 12 zones, jusqu'au niveau ~31)
Voir `ZONES` dans `index.html`. Paliers de stuff : Naru / Tuvala / Yuria / Grunil (voir V91).

## Mid — Heidel (verrouillé, à venir)
- Ruines de Tshira (Grove/Leaf/Vine Keeper)
- Colonie des Loups Sanglants (Kagtum Exécuteur)
- Repaire des Waragons (Waragon Géant)
- Prison de Pila Ku (Iron Warder)
- Ruines d'Hystria (Gardien Hystria)
- Ruines de Cadry (Commandant Cadry)
- Garde du Croissant (Gardiens du Croissant)
- Repaire des Basilics (Basilic Ancien)
- Temple d'Aakman (Golem Aakman)
- Vallée de Titium (Gardien Titium)
- Désert des Fogans (Chef Fogan)
- Mine de Soufre Roud (Lava Devourer)
- Plaine de Taphtar (Centaure Chef)

## End — Calpheon (verrouillé, à venir)
- Colline de Quint (Géants de Quint)
- Poste des Géants Primitifs (Géant Ancien)
- Sanctuaire d'Hexe (Spectre d'Hexe)
- Repaire des Cyclopes (Cyclope Ancien)
- Camp Orc (Chef Orc)
- Monastère Sanglant (Muskan)
- Marais aux Nagas (Naga Chef)
- Repaire Biraghi (Chef Biraghi)
- Château Ruçine (Seigneur Ruçine)
- Autel d'Ifrit (Ifrit Ancien)
- Nécropole de Sherekhan (Garud, Belcadas)

## End+ — Valencia (verrouillé, à venir)
- Temple de Gyfin Rhasia
- Ruines de Mirumok (Mirumok Watchers)
- Forêt des Cendres
- Forêt Arbrépine (Gardien Épine)
- Orzeka
- Vallée d'Olun
- Yzrahid
- Ruines Tungrad (Visionnaire, Dread-Stricken)
- Repaire des Disciples des Ténèbres
- Cité des Morts (Liche)

## End++ — Edana (verrouillé, à venir)
- Base Honglim (Bandits Honglim)
- Forêt de Dokkebi (Duoksini)
- Grotte du Cochon Doré (Golden Pig King)
- Domaine de Jordine
- Château Aetherion
- Château Orbita
- Château Nymphamare
- Tenebraum
- Château Zephyros (Zephyrus Shadow Knights)

## Économie progressive par région (2026-07-07)
Silver/h moyen visé (à un rythme de référence de 15 kills/min, stuff adapté à la zone, plafond
haut = zone la plus difficile de la région avec un stuff bien optimisé) :

| Région | Fourchette silver/h |
|---|---|
| Velia (en jeu) | 0 → 100 000/h |
| Heidel (Mid) | 100 000/h → 1 000 000/h |
| Calpheon (End) | 1 000 000/h → 100 000 000/h |
| Valencia (End+) | 100 000 000/h → 1 000 000 000/h |
| Edana (End++) | 1 000 000 000/h → 10 000 000 000/h |

Pour Velia (11 zones), la fourchette est répartie progressivement zone par zone (voir le
commentaire au-dessus de `const ZONES` dans index.html) : ~3 000/h en zone 1 jusqu'à 100 000/h en
zone 11 (Ruines de Kratuga). Quand Heidel/Calpheon/Valencia/Edana seront construites, reprendre la
même logique : répartir progressivement la fourchette de la région sur ses zones, avec le même
principe de saut plus marqué aux transitions de palier de stuff.

## Bijoux (jackpot) par palier de stuff — référence complète (2026-07-06)
Noms réels BDO, à utiliser pour les jackpot des zones quand chaque palier sera construit.
Actuellement en jeu (Velia) : Gris/Blanc/Vert/Bleu seulement (voir ZONES dans index.html,
1 anneau/collier/ceinture attribué par zone selon son palier de stuff).

| Palier | Anneau | Collier | Ceinture |
|---|---|---|---|
| Gris (Naru) | Anneau Naru | Collier Naru | Ceinture Naru |
| Blanc (Tuvala) | Anneau Tuvala / Anneau Capotia | Collier Tuvala / Collier Capotia | Ceinture Tuvala / Ceinture Capotia |
| Vert (Yuria) | Anneau Asula / Forest Ronaros Ring | Collier Asula / Sicil's Necklace | Ceinture Asula / Valtarra's Eclipsed Belt |
| Bleu (Grunil) | Anneau de Cadry / Anneau du Gardien du Croissant | Serap's Necklace / Laytenn's Power Stone | Orkinrad's Belt / Centaurus Belt |
| Jaune (Mid — Heidel) | Anneau Tungrad / Eye of the Ruins Ring / Anneau Ominous | Collier Tungrad / Ogre Ring | Ceinture Tungrad / Basilisk's Belt |
| Orange (End — Calpheon) | Anneau Deboreka | Collier Deboreka / Revived River Necklace / Revived Lunar Necklace | Ceinture Deboreka / Turo's Belt |
| Rouge (End+/++ — Valencia/Edana) | Anneau Kharazad | Collier Kharazad | Ceinture Kharazad |

Armes par palier (déjà utilisées pour Gris→Bleu, à réutiliser telles quelles pour la suite) :
- Gris : Naru · Blanc : Tuvala · Vert : Yuria · Bleu : Grunil
- Jaune (Heidel) : Cliff, Narchilan, Réprimé, Liverto, Kzarka (tueur de dragon), Kutum, Dandelion
- Orange : Blackstar, Godr-Ayed
- Rouge : Armes Sovereign

Armure par palier (2026-07-09, ajouté pour accompagner les nouveaux noms d'armes Jaune) :
- Gris : Naru · Blanc : Tuvala · Vert : Yuria · Bleu : Grunil
- Jaune (Heidel) : Cliff, Narchilan, Réprimé
- Orange : à définir
- Rouge : à définir
