# Feuille de route des zones — Black Desert Idle

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

---

# 🗺️ Roadmap — Activités & Économie

> ⚠️ Toute information présente dans ce document est susceptible d'être changée. Ce sont des notes en vrac qui donnent une idée dans les grandes lignes de la direction du projet, pas un plan figé.

## 1. Vue d'ensemble

| Onglet actuel | Icône | Statut |
|---|---|---|
| Pêche | 🎣 | 🔒 Existant |
| Mine | ⛏️ | 🔒 Existant |
| Forêt | 🪓 | 🔒 Existant |
| Champs | 🌾 | 🔒 Existant |
| Bergerie | 🐑 | 🔒 Existant |
| Atelier royal | 🏛️ | 🔒 Existant |
| **Mer** | 🚤 | 🆕 À ajouter |
| **Trading (terre)** | 🤝 | 🆕 À ajouter |

---

## 2. Détail des mécaniques par activité

### 🌾 Champs
- **Outil :** Houe
- **Action :** Récolte
- **Ressources :** Blé, feuilles, herbe

### ⛏️ Mine
- **Outil :** Pioche
- **Action :** Extraction
- **Ressources :** Minerais

### 🐑 Bergerie
- **Outil :** Couteau
- **Action :** Récolte
- **Ressources :** Viande

### 🏛️ Atelier royal
- **Mécanique :** Timer automatique (récolte/craft)
- **Fonction :** Transforme les ressources brutes en ressources travaillées, sans action manuelle

### 🪓 Forêt
- **Outil 1 :** Hache → coupe du bois
- **Outil 2 :** Seringue → récupère la sève/résine
- **Ressources :** Bois, sève

### 🎣 Pêche
- **Lieu :** Bord de l'eau
- **Action :** Récolte de poissons
- **Bonus :** Events ponctuels (poissons rares, quêtes saisonnières)

### 🚤 Mer *(nouveau)*
- **Mécanique :** Bateau requis pour y accéder
- **Activités :** Troc maritime + activités en mer (pêche au large, exploration, events navals)
- **Différence avec Pêche :** La Pêche reste côtière/accessible à pied ; la Mer est une extension nécessitant un bateau, donc un vrai palier de progression

### 🤝 Trading *(nouveau, terrestre)*
- **Mécanique :** Troc entre joueurs ou avec PNJ, sur terre
- **Différence avec Mer :** Même logique de troc, mais sans bateau — accessible plus tôt dans la progression

---

## 3. Cohérence du système économique

```
Ressources brutes          Outils              Lieu
─────────────────────────────────────────────────────
Blé, feuilles, herbe   ←   Houe            ←   Champs
Minerais               ←   Pioche          ←   Mine
Viande                 ←   Couteau         ←   Bergerie
Bois, sève             ←   Hache/Seringue  ←   Forêt
Poissons               ←   (à pied)        ←   Pêche
Ressources marines      ←   Bateau          ←   Mer
                                                      ↓
                                          🏛️ Atelier royal (craft auto)
                                                      ↓
                                    🤝 Trading terrestre / 🚤 Troc maritime
```

Cette structure crée une **boucle de gameplay claire** : récolte brute → transformation (Atelier) → échange (Trading/Mer). C'est un bon squelette pour équilibrer une progression idle.

---

## 4. Phasage de développement suggéré

| Phase | Contenu | Priorité |
|---|---|---|
| **Phase 1** | Champs, Mine, Bergerie, Forêt, Pêche (mécaniques de base : outil + ressource) | 🔴 Critique |
| **Phase 2** | Atelier royal (timer craft auto) — dépend des ressources de Phase 1 | 🔴 Critique |
| **Phase 3** | Trading terrestre (troc simple entre joueurs/PNJ) | 🟠 Importante |
| **Phase 4** | Mer + bateau (déblocage tardif, nécessite une progression économique établie) | 🟡 Extension |
| **Phase 5** | Events (saisonniers, pêche/mer rares) | 🟢 Bonus polish |

**Logique du phasage :** le Trading terrestre est plus simple à livrer que la Mer (pas de bateau, pas de nouvelle zone à modéliser), donc il vient avant. La Mer est positionnée comme un vrai "palier" de fin de progression, cohérent avec le fait qu'elle nécessite un bateau (item de progression, pas juste un déblocage de niveau).

---

## 5. Recommandation de style graphique par phase

Sur la base de la comparaison des 5 styles vus précédemment :

| Phase | Style recommandé | Pourquoi |
|---|---|---|
| Phase 1 (Champs, Mine, Bergerie, Forêt, Pêche) | **SVG plat** ou **Vectoriel enrichi** | Rapide à produire seul, cohérence facile à maintenir sur 5 activités d'un coup |
| Phase 2 (Atelier royal) | **Vectoriel enrichi** | Un bâtiment central mérite un peu plus de profondeur (dégradés/ombres) qu'une simple case de récolte |
| Phase 3 (Trading terrestre) | **SVG plat** | Une interface d'échange n'a pas besoin d'un décor riche, priorité à la lisibilité |
| Phase 4 (Mer + bateau) | **Vectoriel enrichi** ou **Isométrique low-poly** | La mer bénéficie d'un peu de profondeur (vagues, reflets) pour bien se différencier visuellement des zones terrestres |
| Phase 5 (Events) | Reprend le style de la zone concernée | Cohérence visuelle, pas de nouveau style à gérer |

⚠️ **Conseil pratique :** évite de mixer Peint numérique ou Pixel art avec le reste tant que tu es seul sur le projet — ces styles demandent soit un vrai travail artistique (peint) soit une discipline stricte de grille (pixel art), ce qui ralentit la production si tu dois livrer 8 activités différentes.

---

## 6. Prochaines étapes concrètes

1. Définir le **tableau de ressources** complet (nom EN/FR, rareté, valeur de base) pour Champs/Mine/Bergerie/Forêt/Pêche
2. Implémenter le timer de l'**Atelier royal** (recette = ressources brutes → ressource craftée + durée)
3. Concevoir l'interface de **Trading terrestre** (offre/demande, ratio de troc)
4. Prototyper le **bateau** comme item de progression (coût, condition de déblocage) avant de construire la zone Mer

---

# 🗺️ Roadmap — Classes & Rôles de combat

> ⚠️ Toute information présente dans ce document est susceptible d'être changée. Ce sont des notes en vrac qui donnent une idée dans les grandes lignes de la direction du projet, pas un plan figé.

## 1. Vue d'ensemble des classes

| Rôle | Style | Statut / Priorité |
|---|---|---|
| ⚔️ CAC | Rogue (rapide, burst, mobilité) | 🔴 À faire |
| 🏹 DPS Distance | — | 🟢 Déjà présent dans la MAJ actuelle |
| 🛡️ Tank | Encaisse, protège le groupe | 🔴 À faire |
| ✨ Healer | Soin/support | 🟡 Basse priorité |

**Ordre de développement suggéré :** CAC (Rogue) → Tank → Healer, en gardant le DPS Distance actuel comme référence d'équilibrage pour les 3 autres.

---

## 2. Identité de chaque classe

### ⚔️ CAC — style Rogue
- Combat rapproché, rythme rapide
- Priorité aux dégâts en rafale et à la mobilité plutôt qu'à la survie brute
- Doit se sentir "risqué mais gratifiant" : gros dégâts si bien joué, fragile si mal positionné

### 🏹 DPS Distance *(existant)*
- Sert de référence d'équilibrage (déjà en jeu)
- Les autres classes seront calibrées par rapport à ses dégâts/DPS actuels

### 🛡️ Tank
- Rôle défensif : encaisser, protéger, contrôler l'espace
- Doit avoir des outils pour survivre et gérer plusieurs ennemis à la fois

### ✨ Healer *(basse priorité)*
- Support/soin du groupe
- Développé en dernier — peut attendre que la base CAC/Tank/DPS soit stable

---

## 3. Bibliothèque de mécaniques de sorts (équilibrage à terme)

| Mécanique | Description | Classe(s) concernée(s) |
|---|---|---|
| **Réduction de dégâts** | Bouclier, armure temporaire, absorption | 🛡️ Tank (principal), ✨ Healer (soutien) |
| **HoT / DoT** | Soin ou dégâts progressifs dans le temps | ✨ Healer (HoT), 🏹 DPS Distance (DoT) |
| **Cleave / AoE** | Dégâts touchant plusieurs cibles | ⚔️ CAC (cleave rapproché), 🏹 DPS Distance (AoE) |
| **Dash / TP** | Déplacement rapide offensif ou défensif | ⚔️ CAC (engage), 🛡️ Tank (repositionnement/intercept) |
| **Stun / Ralentissement / Dodo** | Contrôle de foule (CC) | 🛡️ Tank (initier le combat), ⚔️ CAC (finir une cible) |
| **Debuff / Buff** | Altération temporaire des stats (soi ou ennemi) | Toutes les classes, à des degrés différents |
| **Attaque distance / contact** | Type de dégâts selon la portée | Définit 🏹 vs ⚔️/🛡️ |
| **Gros spell one-shot** | Sort à fort impact, souvent avec temps de cast/cooldown long | 🏹 DPS Distance (burst), ⚔️ CAC (finisher) |
| **Résurrection** | Ramener un allié tombé | ✨ Healer (exclusif) |
| **Cleanse** | Retirer un debuff/poison | ✨ Healer (principal) |

---

## 4. Répartition suggérée par classe

### ⚔️ CAC (Rogue)
- Dash/TP pour engager
- Cleave sur les coups rapprochés
- Stun/ralentissement en finisher (contrôle court pour sécuriser un kill)
- Gros spell one-shot en exécution (bonus sur cible affaiblie)

### 🏹 DPS Distance *(déjà en jeu — à conserver comme base d'équilibrage)*
- DoT
- AoE à distance
- Gros spell one-shot (burst avec cast)
- Debuff (réduction d'armure/vitesse ennemie)

### 🛡️ Tank
- Réduction de dégâts (bouclier/armure)
- Stun/ralentissement pour initier et contrôler
- Dash/TP défensif (intercepter, tirer un ennemi vers soi)
- Buff personnel de survie

### ✨ Healer *(basse priorité)*
- HoT
- Cleanse
- Résurrection
- Buff défensif de zone (réduction de dégâts pour le groupe)

---

## 5. Phasage de développement

| Phase | Contenu | Priorité |
|---|---|---|
| **Phase 1** | Classe CAC (Rogue) — sorts de base : dash, cleave, stun finisher | 🔴 Critique |
| **Phase 2** | Classe Tank — réduction de dégâts, stun d'initiation, repositionnement | 🔴 Critique |
| **Phase 3** | Équilibrage global CAC / Tank / DPS Distance (comparaison DPS, survie, utilité) | 🟠 Importante |
| **Phase 4** | Classe Healer — HoT, cleanse, résurrection | 🟡 Basse priorité |
| **Phase 5** | Polish : buffs/debuffs croisés entre classes, synergies de groupe | 🟢 Bonus |

---

## 6. Points d'attention pour l'équilibrage

- **CAC (Rogue) vs Tank** : le CAC doit faire plus de dégâts mais être plus fragile ; le Tank doit faire moins de dégâts mais survivre nettement plus longtemps. Évite que l'un des deux soit strictement meilleur que l'autre.
- **DPS Distance comme référence** : toute nouvelle classe doit être comparée à son DPS actuel pour éviter un déséquilibre (ex: le CAC ne doit pas juste être "un DPS Distance mais mieux").
- **Le Healer en dernier** : comme c'est basse priorité, tu peux avancer sans lui pour l'instant — mais garde en tête que le Tank aura besoin d'un minimum d'auto-sustain (soin de soi) tant que le Healer n'existe pas encore en jeu.

---

# 🗺️ Roadmap — Système de Doublons & Essence

> ⚠️ Toute information présente dans ce document est susceptible d'être changée. Ce sont des notes en vrac qui donnent une idée dans les grandes lignes de la direction du projet, pas un plan figé.

## 1. Principe du système

Les doublons d'objets (au-delà du 1er exemplaire enregistré au Compendium) se convertissent en **Essence**, une ressource cumulable qui débloque des bonus par paliers. Objectif : donner de la valeur au loot redondant sans casser l'équilibrage ni encombrer l'inventaire.

---

## 2. Composants du système

| Composant | Rôle |
|---|---|
| **Compendium** | Enregistre la 1ère obtention d'un item (déblocage cosmétique/entrée) |
| **Détection de doublon** | Tout exemplaire au-delà du 1er déclenche la conversion |
| **Essence par tier** | Ressource commune (Grise, Verte, Bleue, Orange, Rouge) |
| **Table de conversion** | Définit combien d'essence un doublon génère selon son tier |
| **Paliers de bonus** | Seuils d'essence cumulée qui débloquent des bonus |
| **Courbe logarithmique** | Anti-inflation — évite le "no-life stacking" d'un seul item |
| **Arbre de dépense** | Interface où le joueur choisit où investir son essence |

---

## 3. Phasage de développement

### 🔴 Phase 1 — Fondations (critique)
- Détecter un doublon à la réception d'un item (comparaison avec le Compendium)
- Convertir automatiquement le doublon en Essence selon le tier
- Stocker l'Essence par tier en base (Supabase)
- **Table de conversion de base :**
```
1 doublon Gris    → 1 Essence Grise
1 doublon Vert    → 3 Essences Grises
1 doublon Bleu    → 8 Essences Grises
1 doublon Orange  → 20 Essences Grises
1 doublon Rouge   → 50 Essences Grises
```

### 🔴 Phase 2 — Paliers de bonus (critique)
- Définir les seuils par tier (ex: 10 / 30 / 100 pour Gris, 1 / 3 / 6 pour Rouge)
- Implémenter la formule logarithmique anti-inflation :
```javascript
function bonusStat(doublons, baseBonus = 0.5) {
  return baseBonus * Math.log(doublons + 1);
}
```
- Appliquer les bonus automatiquement (stats passives liées au tier/item)

### 🟠 Phase 3 — UI/UX (importante)
- Affichage dans le Compendium : "x/y doublons vers le prochain palier"
- Notification visuelle quand un palier est débloqué
- Affichage des essences disponibles par tier (inventaire dédié ou onglet Compendium)

### 🟠 Phase 4 — Arbre de dépense (importante)
- Interface d'arbre de talents par tier d'essence
- 3-4 branches au choix (dégâts, résistance, vitesse de récolte, cosmétique)
- Système de reset/respec de l'arbre (optionnel, à définir si payant ou gratuit)

### 🟡 Phase 5 — Bonus de tier complet (extension)
- Détection "toutes les entrées d'un tier ont ≥ x doublons"
- Bonus global de "Maîtrise Tier" en plus des bonus individuels
- Encourage la diversification plutôt que le stack d'un seul item

### 🟢 Phase 6 — Polish (bonus)
- Cosmétiques/skins débloqués aux paliers élevés (x50+)
- Animations/effets visuels à l'obtention d'un palier
- Statistiques globales (ex: "Essence totale collectée" affichée en profil)

---

## 4. Points de vigilance à chaque phase

| Risque | Mitigation |
|---|---|
| Power creep (bonus trop forts) | Garder les bonus individuels comme du confort, pas de la stat qui définit la méta |
| Frustration sur items rares | Moins de doublons requis pour les hauts tiers (Rouge/Orange) |
| Système invisible pour le joueur | UI claire dès la Phase 3, ne pas la repousser trop tard |
| Stack passif sans choix stratégique | L'arbre de dépense (Phase 4) est ce qui rend le système engageant, ne pas le sauter |

---

## 5. Dépendances techniques

- Nécessite que le **Compendium** soit déjà fonctionnel (détection 1ère obtention)
- Nécessite une table Supabase dédiée : `essence_wallet` (user_id, tier, montant) et `bonus_paliers` (item_id ou tier, seuil, effet)
- Le calcul de bonus doit être fait côté serveur (ou vérifié côté serveur) pour éviter la triche sur les stats

---

# Roadmap — Système d'enchantement par zones

> ⚠️ Toute information présente dans ce document est susceptible d'être changée. Ce sont des notes en vrac qui donnent une idée dans les grandes lignes de la direction du projet, pas un plan figé.

## Vue d'ensemble

| Zone | Contenu | Enchantement | Mécanique |
|---|---|---|---|
| 1 | Tout item (armes/armures) | Jusqu'à PEN | Safe, pas de casse |
| 2 | Bijoux uniquement | PRI → PEN | Safe, pas de casse |
| 3 | Bijoux | Roulette | Cassable, perte totale à l'échec |
| 4 | Stuff complet | PEN + jusqu'à X | Post-PEN, cap à définir |
| 5 | — | — | À définir (TBD) |

---

## Zone 1 — Stuff général

- Tous les items (armes/armures/accessoires hors bijoux) enchantables jusqu'à PEN.
- Pas de casse : échec = pas de progression, mais pas de perte.
- Zone d'onboarding : doit rester safe pour ne pas décourager les nouveaux joueurs.

## Zone 2 — Bijoux "sûrs"

- Bijoux uniquement, PRI → PEN.
- Aucune casse : sert de transition avant d'introduire le risque en Zone 3.
- Bon endroit pour introduire les matériaux nécessaires à la Zone 3 (le joueur apprend le système avant de risquer gros).

## Zone 3 — Roulette cassable

- Mécanique : à chaque tentative d'enchantement, une table de probabilités façon roulette BDO.
  - **Succès** → passe au palier supérieur.
  - **Échec** → le bijou est **détruit entièrement** (perte totale).
- Points à équilibrer :
  - Taux de succès par palier (doit baisser progressivement, ex : PRI 90% → PEN 5-10%).
  - Coût de fabrication d'un bijou, pour calibrer la douleur de la perte (matériaux rares = perte plus marquante).
  - Éventuel "filet de sécurité" optionnel (item consommable protégeant une tentative), à la manière des items de protection dans BDO.
- UX critique : bien communiquer **avant** le clic que c'est une perte totale, pour éviter la frustration/rage-quit.

## Zone 4 — Post-PEN

- Stuff PEN + jusqu'à un cap X (à définir, ex : PEN+1 à PEN+5).
- Courbe de gain de stats à définir en fonction du cap choisi.
- À trancher : re-cassable comme la Zone 3, ou juste très cher/rare sans casse.

## Zone 5 — À définir (TBD)

Placeholder pour l'instant. Pistes classiques pour la fin de progression verticale dans un idle game :

- Système de prestige/rebirth (reset avec bonus permanent).
- Palier cosmétique/collection (sans stats, juste flex).
- Contenu type "boss endgame" qui consomme le stuff de la Zone 4.

Pas besoin de trancher maintenant — à laisser en TBD et itérer une fois les zones 1-4 stables.

---

## Roadmap de développement

### Phase 1 — Design des systèmes
- [ ] Définir la courbe de difficulté d'enchantement par zone (taux de succès, coûts)
- [ ] Définir le cap exact de la Zone 4 (PEN+X) et son impact sur les stats
- [ ] Spécifier précisément la table de probabilités de la roulette Zone 3
- [ ] Décider du concept de la Zone 5

### Phase 2 — Modèle de données (Supabase)
- [ ] Table `zones` (id, nom, tier_min, tier_max, mecanique_speciale)
- [ ] Table `enhancement_rules` (zone_id, item_type, base_rate, fail_penalty)
- [ ] Étendre le système de rareté existant (Grey→Red) avec un champ `enhancement_level` (PRI, DUO, TRI, TET, PEN, PEN+X)

### Phase 3 — Logique du moteur d'enchantement
- [ ] Fonction générique `attemptEnhancement(item, zoneRules)` gérant les 3 comportements (safe / cassable / cap)
- [ ] Tests unitaires sur les taux de réussite pour équilibrer l'économie du jeu

### Phase 4 — UI/UX
- [ ] Écran par zone avec règles claires (icône "sûr" vs icône "risque de casse")
- [ ] Feedback visuel fort sur la Zone 3 (animation de roulette, suspense)
- [ ] Avertissement explicite avant toute tentative à risque de casse

### Phase 5 — Équilibrage & tests
- [ ] Simulateur de temps moyen jusqu'à PEN par zone
- [ ] Ajustement des probabilités pour éviter un mur de progression trop dur ou trop facile
