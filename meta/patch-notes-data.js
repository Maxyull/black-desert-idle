// ============================================================
// PATCH NOTES — condensé de toutes les versions
// ============================================================
// chaque ligne est désormais { t:'new'|'change'|'fix'|'exploit', tx:'texte', plat:'mobile'? }
// plat:'mobile' (2026-07-05) : marque une ligne qui ne concerne QUE tablette/téléphone, affichée
// avec un 2e badge à côté du type — absent = concerne toutes les plateformes.
const PATCH_NOTES = [
  { v:'V316', d:'08/07/2026 10:00', name:{fr:'Le jeu s\'appelle désormais "Black Desert Idle"', en:'The game is now called "Black Desert Idle"'}, fr:[
      {t:'change', sub:'systeme', tx:'Renommage du jeu : "Velia Idle" devient "Black Desert Idle" (titre de la page, écran de connexion, pied de page en jeu, notes de version). Aucun impact sur ta progression, ta sauvegarde ou tes préférences.'},
    ], en:[
      {t:'change', sub:'systeme', tx:'Game renamed: "Velia Idle" becomes "Black Desert Idle" (page title, login screen, in-game footer, patch notes). No impact on your progress, save, or preferences.'},
    ] },
  { v:'V300', d:'08/07/2026 07:24', name:{fr:'Marché commun : croix à droite, hauteur fixe, Vendre retiré', en:'Common Market: close button on the right, fixed height, Sell removed'}, fr:[
      {t:'change', sub:'objets', tx:'La croix de fermeture du Marché commun est maintenant bien alignée à droite du panneau'},
      {t:'change', sub:'objets', tx:'La fenêtre du Marché commun garde désormais une hauteur fixe : changer de sous-onglet ou sélectionner un objet ne fait plus jamais bouger la taille de la page'},
      {t:'change', sub:'objets', tx:'Le sous-onglet "Vendre" (vente d\'1 pièce d\'équipement/bijou à prix fixe) a été retiré — les matériaux restent vendables via le sous-onglet Matériaux'},
    ], en:[
      {t:'change', sub:'objets', tx:'The Common Market\'s close button is now properly aligned to the right of the panel'},
      {t:'change', sub:'objets', tx:'The Common Market window now keeps a fixed height: switching sub-tabs or selecting an item no longer changes the page size'},
      {t:'change', sub:'objets', tx:'The "Sell" sub-tab (selling 1 gear/jewelry piece at a fixed price) was removed — materials remain sellable via the Materials sub-tab'},
    ] },
  { v:'V299', d:'08/07/2026 07:04', name:{fr:'Marché renommé "Marché commun", réouvert', en:'Market renamed "Common Market", reopened'}, fr:[
      {t:'change', sub:'objets', severity:'major', tx:'Le Marché est renommé "Marché commun" et les anciens onglets Acheter/Vendre/Mes annonces (annonces à prix fixe) ont été retirés — on atterrit directement dans le carnet d\'ordres à l\'ouverture, plus léger et plus clair'},
      {t:'change', sub:'objets', tx:'Dans le sous-onglet Matériaux, la pastille de l\'objet choisi se colore désormais avec sa propre couleur pour bien voir lequel est sélectionné'},
      {t:'new', sub:'objets', severity:'major', tx:'Le Marché commun est réouvert à tous les joueurs !'},
    ], en:[
      {t:'change', sub:'objets', severity:'major', tx:'The Market is renamed "Common Market" and the old Buy/Sell/My listings tabs (fixed-price listings) were removed — you now land directly in the order book, lighter and clearer'},
      {t:'change', sub:'objets', tx:'In the Materials sub-tab, the selected item\'s pill now fills with its own color so it\'s obvious which one is chosen'},
      {t:'new', sub:'objets', severity:'major', tx:'The Common Market is reopened to all players!'},
    ] },
  { v:'V298', d:'08/07/2026 06:48', name:{fr:'Marché : nouveau carnet d\'ordres et chandelier (matériaux)', en:'Market: new order book and candlestick chart (materials)'}, fr:[
      {t:'new', sub:'objets', tx:'Le sous-onglet "Matériaux" du Marché commun a été refait : carnet d\'ordres vente/achat avec barres de volume, meilleur prix mis en avant, spread, pression du marché et mini graphique chandelier sur les 20 dernières transactions. Le Marché reste fermé pour l\'instant (voir la note précédente) — prêt pour sa réouverture.'},
    ], en:[
      {t:'new', sub:'objets', tx:'The "Materials" sub-tab of the Common Market was rebuilt: buy/sell order book with volume bars, best price highlighted, spread, market pressure indicator and a mini candlestick chart over the last 20 trades. The Market stays closed for now (see previous note) — ready for reopening.'},
    ] },
  { v:'V297', d:'08/07/2026 06:29', name:{fr:'Joueurs en ville, Coffre, récompenses Kzarka repensées', en:'Players in town, Chest, reworked Kzarka rewards'}, fr:[
      {t:'new', sub:'interface', tx:'À Velia, la liste des joueurs présents en ville s\'affiche désormais en bas à droite, à la place du loot ticker (toujours vide là-bas)'},
      {t:'new', sub:'objets', tx:'Nouvel onglet "Coffre" en haut de la carte Loot : 20 emplacements de rangement personnel (le reste arrive plus tard), accessible sur n\'importe quelle pièce du sac via "Ranger au coffre"'},
      {t:'change', sub:'combat', severity:'major', tx:'Kzarka a désormais des récompenses fixes selon le rang de contribution : silver + Pierre de Caphras + Fragment de mémoire en quantités variables (Vell inchangé)'},
      {t:'new', sub:'combat', tx:'Nouveau loot rarissime sur Kzarka : Pierre de sang de Kzarka (1% de chance), révélée par la même roue que le Coeur de Vell'},
    ], en:[
      {t:'new', sub:'interface', tx:'In Velia, the list of players currently in town now shows bottom-right, in place of the loot ticker (always empty there anyway)'},
      {t:'new', sub:'objets', tx:'New "Chest" tab at the top of the Loot card: 20 personal storage slots (more coming later), accessible from any bag item via "Store in chest"'},
      {t:'change', sub:'combat', severity:'major', tx:'Kzarka now has fixed rewards based on contribution rank: silver + Caphras Stone + Memory Fragment in variable amounts (Vell unchanged)'},
      {t:'new', sub:'combat', tx:'New ultra-rare drop on Kzarka: Kzarka\'s Blood Stone (1% chance), revealed by the same wheel as Coeur de Vell'},
    ] },
  { v:'V296', d:'08/07/2026 05:44', name:{fr:'Fix : timer figé dans la page Boss', en:'Fixed: frozen timer on the Boss page'}, fr:[
      {t:'fix', sub:'combat', severity:'major', tx:'Le compte à rebours du prochain boss, à l\'intérieur de la page Boss, restait figé tant qu\'on ne rechargeait pas la page — il se met désormais à jour chaque seconde comme partout ailleurs, et le bouton "Combattre" apparaît automatiquement au bon moment'},
    ], en:[
      {t:'fix', sub:'combat', severity:'major', tx:'The next-boss countdown inside the Boss page used to stay frozen until you reloaded — it now updates every second like everywhere else, and the "Fight" button appears automatically at the right time'},
    ] },
  { v:'V295', d:'08/07/2026 05:35', name:{fr:'Marché fermé pour maintenance', en:'Market closed for maintenance'}, fr:[
      {t:'change', sub:'objets', severity:'major', tx:'Le Marché est temporairement fermé pour maintenance — tous les ordres ouverts ont été annulés et intégralement remboursés (silver ou objet) à leurs propriétaires. Réouverture à venir.'},
    ], en:[
      {t:'change', sub:'objets', severity:'major', tx:'The Market is temporarily closed for maintenance — all open orders were cancelled and fully refunded (silver or item) to their owners. Reopening to come.'},
    ] },
  { v:'V294', d:'07/07/2026 22:23', name:{fr:'Avertissement admin pour le reset d\'un joueur en ligne', en:'Admin warning for resetting an online player'}, fr:[
      {t:'new', sub:'interface', tx:'Le panel admin avertit désormais explicitement si le joueur ciblé par un reset de compte est actuellement en ligne (risque que sa propre sauvegarde automatique annule le reset)'},
    ], en:[
      {t:'new', sub:'interface', tx:'The admin panel now explicitly warns if the player targeted by an account reset is currently online (risk that their own autosave undoes the reset)'},
    ] },
  { v:'V293', d:'07/07/2026 22:16', name:{fr:'La flèche d\'upgrade pointe l\'objet précis à ramasser', en:'The upgrade arrow now points at the exact item to grab'}, fr:[
      {t:'change', sub:'interface', tx:'La flèche ⬆️ qui indique un stuff meilleur ne reste plus figée sur la zone à atteindre une fois qu\'on y est : elle apparaît directement sur la ligne de loot concernée (arme/armure/bijou précis), pour montrer quel objet ramasser'},
    ], en:[
      {t:'change', sub:'interface', tx:'The ⬆️ arrow that points to better gear no longer stays stuck on the target zone once you\'re there: it now shows up directly on the relevant loot row (the exact weapon/armor/jewel), pointing to which item to grab'},
    ] },
  { v:'V292', d:'07/07/2026 22:11', name:{fr:'Étiquette admin visible par tous', en:'Admin tag visible to everyone'}, fr:[
      {t:'change', sub:'interface', tx:'L\'étiquette "ADMIN" sur la liste des zones est désormais visible par TOUS les joueurs (avant, uniquement par l\'admin lui-même) — sans exposer l\'identité d\'aucun autre joueur, seule la zone où se trouve l\'admin est partagée'},
    ], en:[
      {t:'change', sub:'interface', tx:'The "ADMIN" tag on the zone list is now visible to ALL players (previously only to the admin themselves) — without exposing any other player\'s identity, only the zone the admin is in is shared'},
    ] },
  { v:'V291', d:'07/07/2026 21:35', name:{fr:'Tooltip admin précisé, podium boss déplacé', en:'Clearer admin tooltip, boss podium moved'}, fr:[
      {t:'change', sub:'interface', tx:'L\'étiquette ADMIN (visible uniquement par l\'admin, sur sa propre zone) affiche désormais "Un admin est ici" au survol, moins ambigu'},
      {t:'change', sub:'combat', tx:'Le podium de récompenses World Boss s\'affiche désormais après le calendrier hebdomadaire complet, au lieu d\'être coincé juste sous le décompte du prochain spawn'},
    ], en:[
      {t:'change', sub:'interface', tx:'The ADMIN tag (visible only to the admin, on their own zone) now shows "An admin is here" on hover, less ambiguous'},
      {t:'change', sub:'combat', tx:'The World Boss reward podium now displays after the full weekly calendar, instead of being squeezed right under the next-spawn countdown'},
    ] },
  { v:'V290', d:'07/07/2026 21:31', name:{fr:'Forêt de Polly ajustée', en:'Polly Forest adjusted'}, fr:[
      {t:'change', sub:'zones', tx:'Forêt de Polly : Défense requise resserrée pour qu\'un stuff moyen arrive tout juste en zone difficile au lieu de dangereuse'},
    ], en:[
      {t:'change', sub:'zones', tx:'Polly Forest: required Defense tightened so an average gear set lands just barely in hard-zone territory instead of dangerous'},
    ] },
  { v:'V289', d:'07/07/2026 21:15', name:{fr:'Suivi des Pierres de Cron (panel admin)', en:'Cron Stone tracking (admin panel)'}, fr:[
      {t:'new', sub:'interface', tx:'Nouvel onglet "Pierres de Cron" dans le panneau admin (section Stats) : total farmé, ramassages, moyenne par joueur, chance de drop et rappel du coût par palier'},
    ], en:[
      {t:'new', sub:'interface', tx:'New "Cron Stones" tab in the admin panel (Stats section): total farmed, pickups, average per player, drop chance and cost-per-tier reminder'},
    ] },
  { v:'V288', d:'07/07/2026 21:08', name:{fr:'Bouton Donation, Compendium par palier, Kratuga ajustée', en:'Donation button, tiered Compendium, Kratuga adjusted'}, fr:[
      {t:'new', sub:'interface', tx:'Nouveau bouton "Donation" (verrouillé) dans le menu latéral'},
      {t:'change', sub:'interface', tx:'Le "Sac protégé" a été retiré du Compendium : il vit maintenant uniquement dans la carte Inventaire (onglet Compendium), où il était déjà accessible en double'},
      {t:'new', sub:'interface', tx:'La vue "Zones" du Compendium est désormais catégorisée par palier de stuff (en-tête colorée), avec un halo vert sur les zones déjà entièrement complétées — plus besoin de dérouler la liste d\'objets pour vérifier'},
      {t:'change', sub:'zones', tx:'Ruines de Kratuga : Défense requise resserrée pour se rapprocher au maximum de "tout juste difficile" avec un stuff moyen'},
    ], en:[
      {t:'new', sub:'interface', tx:'New "Donation" (locked) button in the side menu'},
      {t:'change', sub:'interface', tx:'The "Protected bag" was removed from the Compendium: it now lives only in the Inventory card (Compendium tab), where it was already duplicated'},
      {t:'new', sub:'interface', tx:'The Compendium\'s "Zones" view is now categorized by gear tier (colored header), with a green glow on fully completed zones — no need to expand the item list to check'},
      {t:'change', sub:'zones', tx:'Kratuga Ruins: required Defense tightened to get as close as possible to "just barely hard" with average gear'},
    ] },
  { v:'V287', d:'07/07/2026 20:59', name:{fr:'Onglets Pet/Mer, Cristal en inventaire, vente auto par item', en:'Pet/Sea tabs, Crystal in inventory, per-item auto-sell'}, fr:[
      {t:'new', sub:'interface', tx:'2 nouveaux onglets verrouillés dans le menu latéral : Compagnon et Vie en mer, en attente de futur contenu'},
      {t:'new', sub:'objets', tx:'Nouvelle catégorie "Cristal" (verrouillée) dans l\'inventaire, aux côtés d\'Équip./Opti./Trésors/Conso./RNG (libellés raccourcis)'},
      {t:'new', sub:'interface', tx:'Bouton "vente auto" verrouillé ajouté sur chaque objet de la table de loot'},
      {t:'change', sub:'interface', tx:'Tous les boutons verrouillés (vente auto, équiper→vendre→compendium, catégories, nouveaux onglets) affichent désormais leur cadenas en badge au-dessus, toujours centré — plus jamais dans le texte du bouton'},
    ], en:[
      {t:'new', sub:'interface', tx:'2 new locked tabs in the side menu: Companion and Sea Life, awaiting future content'},
      {t:'new', sub:'objets', tx:'New "Crystal" category (locked) in the inventory, alongside Gear/Enh./Treasures/Cons./RNG (shortened labels)'},
      {t:'new', sub:'interface', tx:'Locked "auto-sell" button added on every item in the loot table'},
      {t:'change', sub:'interface', tx:'Every locked button (auto-sell, equip→sell→compendium, categories, new tabs) now shows its padlock as a badge above, always centered — never inside the button text anymore'},
    ] },
  { v:'V286', d:'07/07/2026 20:48', name:{fr:'Fix sélection auto-opti, étiquette admin ancrée, Planque des Mânes rééquilibrée', en:'Fixed auto-enhance selection, anchored admin tag, Manes rebalanced'}, fr:[
      {t:'fix', sub:'interface', severity:'major', tx:'Choisir un palier dans la liste déroulante d\'auto-optimisation pouvait être silencieusement écrasé par le prochain rafraîchissement (loot ramassé, équipement changé...) qui reconstruisait la liste sans garder le choix fait — le palier choisi est désormais préservé'},
      {t:'fix', sub:'interface', tx:'L\'étiquette ADMIN (visible uniquement par l\'admin, sur sa propre zone) est maintenant ancrée précisément au-dessus du nombre de joueurs, plus au-dessus du bouton 👁'},
      {t:'change', sub:'zones', tx:'Planque des Mânes : Défense requise abaissée pour qu\'un stuff moyen full PRI passe de zone dangereuse à tout juste difficile'},
    ], en:[
      {t:'fix', sub:'interface', severity:'major', tx:'Choosing a tier in the auto-enhance dropdown could be silently overwritten by the next refresh (loot picked up, gear changed...) which rebuilt the list without keeping the pick — the chosen tier is now preserved'},
      {t:'fix', sub:'interface', tx:'The ADMIN tag (visible only to the admin, on their own zone) is now anchored precisely above the player count, no longer above the 👁 button'},
      {t:'change', sub:'zones', tx:'Manes\' Hideout: required Defense lowered so an average full-PRI gear set moves from dangerous zone to just barely hard'},
    ] },
  { v:'V285', d:'07/07/2026 20:43', name:{fr:'Récompenses World Boss en podium', en:'World Boss rewards as a podium'}, fr:[
      {t:'new', sub:'combat', tx:'Les règles de récompense du World Boss (sous les horaires du lobby) prennent la forme d\'un vrai podium visuel (2e/1er/3e), avec un sélecteur Kzarka/Vell au-dessus pour prévisualiser la récompense propre à chaque boss'},
      {t:'new', sub:'combat', tx:'La chance de Coeur de Vell (5%) est désormais affichée dans ce même aperçu quand Vell est sélectionné'},
    ], en:[
      {t:'new', sub:'combat', tx:'World Boss reward rules (below the lobby schedule) now show as a real visual podium (2nd/1st/3rd), with a Kzarka/Vell selector above it to preview each boss\'s own reward'},
      {t:'new', sub:'combat', tx:'The Coeur de Vell chance (5%) is now shown in this same preview when Vell is selected'},
    ] },
  { v:'V284', d:'07/07/2026 20:33', name:{fr:'Conseil de stuff minimal', en:'Minimal gear suggestion'}, fr:[
      {t:'change', sub:'interface', tx:'Le conseil de stuff (entre l\'action d\'optimisation et les Pierres de Cron) affiche désormais juste "Recommandé :" suivi du nom de la pièce et de son palier cible, sans phrase ni chiffres'},
    ], en:[
      {t:'change', sub:'interface', tx:'The gear suggestion (between the enhance action and the Cron Stones) now just shows "Recommended :" followed by the piece name and its target tier, no sentence or numbers'},
    ] },
  { v:'V283', d:'07/07/2026 20:31', name:{fr:'Farm en arrière-plan, spawn au reload, étiquette admin fixe', en:'Background farming, reload spawn, fixed admin tag'}, fr:[
      {t:'fix', sub:'combat', severity:'major', tx:'Au chargement d\'une sauvegarde, les groupes de monstres pouvaient réapparaître loin du joueur (autour de l\'ancienne position par défaut) au lieu d\'être générés autour de sa position réelle — la zone semblait vide juste après un reload'},
      {t:'new', sub:'combat', tx:'Le jeu continue de farmer même sur un onglet en arrière-plan (navigateur minimisé ou un autre onglet ouvert) — un filet de secours prend le relais pour compenser le ralentissement que les navigateurs imposent aux onglets cachés'},
      {t:'fix', sub:'interface', tx:'L\'étiquette "ADMIN" (visible uniquement par l\'admin, sur sa propre zone) ne décale plus jamais le texte ni les boutons de la ligne de zone'},
      {t:'change', sub:'combat', tx:'Les règles de récompense du World Boss s\'affichent désormais plus grandes, dans un encadré dédié sous les horaires'},
    ], en:[
      {t:'fix', sub:'combat', severity:'major', tx:'On loading a save, monster packs could spawn far from the player (around the old default position) instead of around their real position — the zone looked empty right after a reload'},
      {t:'new', sub:'combat', tx:'The game keeps farming even on a background tab (minimized browser or another tab open) — a fallback takes over to compensate for the throttling browsers apply to hidden tabs'},
      {t:'fix', sub:'interface', tx:'The "ADMIN" tag (visible only to the admin, on their own zone) no longer shifts any text or buttons on the zone row'},
      {t:'change', sub:'combat', tx:'World Boss reward rules now display bigger, in a dedicated box below the schedule'},
    ] },
  { v:'V282', d:'07/07/2026 20:22', name:{fr:'Onglet Niveaux, coût de Cron par palier, Kratuga rééquilibrée', en:'Levels tab, tiered Cron cost, Kratuga rebalanced'}, fr:[
      {t:'new', sub:'interface', tx:'Nouvel onglet "Niveaux" dans la carte Statistiques : PV de base, bonus de Vitesse et XP requise pour les 5 niveaux avant et après ton niveau actuel, mis à jour en direct à chaque level-up'},
      {t:'change', sub:'objets', tx:'Le coût en Pierres de Cron dépend désormais du palier de la pièce protégée (gris 1 / blanc 2 / vert 3 / bleu 4) au lieu de toujours 1 — le panneau Optimisation affiche "as-tu/il-faut" pour la pièce ciblée'},
      {t:'change', sub:'zones', tx:'Ruines de Kratuga : Défense requise abaissée pour qu\'un stuff moyen full PRI passe de zone dangereuse à tout juste difficile'},
    ], en:[
      {t:'new', sub:'interface', tx:'New "Levels" tab in the Statistics card: base HP, Speed bonus and required XP for the 5 levels before and after your current one, updated live on every level-up'},
      {t:'change', sub:'objets', tx:'Cron Stone cost now depends on the tier of the piece being protected (grey 1 / white 2 / green 3 / blue 4) instead of always 1 — the Enhancement panel shows "have/need" for the targeted piece'},
      {t:'change', sub:'zones', tx:'Kratuga Ruins: required Defense lowered so an average full-PRI gear set moves from dangerous zone to just barely hard'},
    ] },
  { v:'V281', d:'07/07/2026 20:12', name:{fr:'World Boss : fix loot solo, récompenses par zone, table de loot V2', en:'World Boss: fixed solo loot, zone-based rewards, V2 loot table'}, fr:[
      {t:'fix', sub:'combat', severity:'major', tx:'Un kill de World Boss très rapide (solo) pouvait afficher "Victoire" sans donner aucune récompense — le dernier paquet de dégâts n\'était pas encore transmis au serveur au moment de la réclamation. Corrigé : ce reliquat est désormais envoyé et attendu avant de réclamer'},
      {t:'new', sub:'combat', tx:'Nouveau message dans le lobby Boss quand un boss partagé est déjà à 0 PV mais que sa fenêtre reste ouverte : "Déjà vaincu — reviens plus tard" au lieu de pouvoir entrer dans un combat déjà gagné sans y avoir participé'},
      {t:'change', sub:'combat', severity:'major', tx:'Récompenses de World Boss repensées : pierre d\'optimisation de ta meilleure zone difficile (garantie) + bijou bonus selon ton rang de contribution (#1 : bijou de la prochaine zone dangereuse · #2 : bijou de ta zone difficile · #3 : 20%/30% de chance). Les règles sont affichées dans le lobby, visibles par tous avant de combattre'},
      {t:'new', sub:'objets', tx:'Nouvelle table de loot "V2" (taux fixe par palier au lieu d\'une décroissance par zone) activable par l\'admin à tout moment, réversible en un clic — l\'ancienne table V1 reste intacte'},
    ], en:[
      {t:'fix', sub:'combat', severity:'major', tx:'A very fast (solo) World Boss kill could show "Victory" with no reward at all — the last chunk of damage hadn\'t reached the server yet when claiming. Fixed: this remainder is now sent and awaited before claiming'},
      {t:'new', sub:'combat', tx:'New message in the Boss lobby when a shared boss is already at 0 HP but its window is still open: "Already defeated — come back later" instead of being able to enter an already-won fight without participating'},
      {t:'change', sub:'combat', severity:'major', tx:'World Boss rewards reworked: enhancement stone from your best hard zone (guaranteed) + bonus jewel based on your contribution rank (#1: jewel from the next dangerous zone · #2: jewel from your hard zone · #3: 20%/30% chance). Rules are shown in the lobby, visible to everyone before fighting'},
      {t:'new', sub:'objets', tx:'New "V2" loot table (flat rate per tier instead of a per-zone decay) can be toggled by the admin anytime, reversible in one click — the old V1 table stays intact'},
    ] },
  { v:'V280', d:'07/07/2026 19:54', name:{fr:'Sorts de zone : touchent aussi les packs voisins collés', en:'Zone spells: also hit touching neighbor packs'}, fr:[
      {t:'change', sub:'combat', severity:'major', tx:'Un sort de zone ne touchait que le pack ciblé, même si d\'autres packs étaient collés juste à côté — désormais tous les packs qui se chevauchent avec la cible sont touchés, dégâts répartis pour garder un total infligé comparable (pas de multiplicateur par nombre de packs). Un pack isolé (aucun voisin collé) garde ses pleins dégâts individuels, inchangé'},
    ], en:[
      {t:'change', sub:'combat', severity:'major', tx:'A zone spell only hit the targeted pack, even when other packs were right next to it — now every pack that overlaps with the target also gets hit, damage shared to keep the total output comparable (no per-pack multiplier). An isolated pack (no touching neighbor) keeps its full individual damage, unchanged'},
    ] },
  { v:'V279', d:'07/07/2026 19:43', name:{fr:'Nouveau sélecteur Équipement/Cristal', en:'New Gear/Crystal selector'}, fr:[
      {t:'new', sub:'interface', tx:'Nouveau sélecteur à bulles dans la carte Équipement, pour basculer entre la poupée d\'équipement normale et un nouvel onglet "Cristal" — 1 seul emplacement pour l\'instant, verrouillé (système de cristaux pas encore en jeu)'},
    ], en:[
      {t:'new', sub:'interface', tx:'New bubble selector in the Equipment card, to switch between the normal equipment doll and a new "Crystal" tab — only 1 slot for now, locked (crystal system not in-game yet)'},
    ] },
  { v:'V278', d:'07/07/2026 19:38', name:{fr:'Loot ticker : quantité avant le prix', en:'Loot ticker: quantity before price'}, fr:[
      {t:'change', sub:'interface', tx:'Dans le ticker de loot, la quantité (×N) s\'affiche désormais avant le prix au lieu d\'après'},
    ], en:[
      {t:'change', sub:'interface', tx:'In the loot ticker, the quantity (×N) now shows before the price instead of after'},
    ] },
  { v:'V277', d:'07/07/2026 19:34', name:{fr:'Bijoux doublés en zones vertes et bleues', en:'Jewelry doubled in Green and Blue tiers'}, fr:[
      {t:'change', sub:'objets', severity:'major', tx:'Chance de trouver un bijou à nouveau doublée dans les 4 zones vertes et les 4 zones bleues (×3.6 et ×4.0 au total depuis l\'origine). Zones grise et blanche inchangées'},
    ], en:[
      {t:'change', sub:'objets', severity:'major', tx:'Jewelry drop chance doubled again in the 4 Green tier zones and the 4 Blue tier zones (×3.6 and ×4.0 total from the original rate). Grey and White tiers unchanged'},
    ] },
  { v:'V276', d:'07/07/2026 19:29', name:{fr:'Loot ticker : prix uniquement pour le trash', en:'Loot ticker: price only for trash'}, fr:[
      {t:'change', sub:'interface', tx:'Le ticker de loot n\'affiche plus le prix de revente pour les matériaux/bijoux/équipements ramassés — seul le trash (token) garde son prix, désormais précédé d\'une icône 🪙'},
    ], en:[
      {t:'change', sub:'interface', tx:'The loot ticker no longer shows the resale price for picked-up materials/jewelry/gear — only trash (token) keeps its price, now prefixed with a 🪙 icon'},
    ] },
  { v:'V275', d:'07/07/2026 19:26', name:{fr:'Plus de ralentissement lié au poids', en:'No more weight-based slowdown'}, fr:[
      {t:'change', sub:'systeme', tx:'Le poids du sac ne réduit plus la vitesse de déplacement — la barre de poids reste affichée à titre indicatif, mais dépasser la limite n\'entraîne plus de malus'},
    ], en:[
      {t:'change', sub:'systeme', tx:'Bag weight no longer reduces movement speed — the weight bar is still shown for reference, but going over the limit no longer applies a penalty'},
    ] },
  { v:'V274', d:'07/07/2026 19:23', name:{fr:'Coffret secret : les 3 Trésors régionaux', en:'Secret box: the 3 regional treasures'}, fr:[
      {t:'change', sub:'objets', tx:'"Carte de Heidel/Calpheon" renommés "Trésor de Heidel/Calpheon" (même famille que Trésor de Velia). Le Coffret secret demande désormais 1 Trésor de Velia + 1 Trésor de Heidel + 1 Trésor de Calpheon au lieu de Bout+matériau+bijou — pas encore complétable tant que Heidel/Calpheon restent verrouillés'},
    ], en:[
      {t:'change', sub:'objets', tx:'"Heidel/Calpheon Card" renamed "Heidel/Calpheon Treasure" (same family as Velia Treasure). The Secret box now requires 1 Velia Treasure + 1 Heidel Treasure + 1 Calpheon Treasure instead of Piece+material+jewelry — not completable yet while Heidel/Calpheon remain locked'},
    ] },
  { v:'V273', d:'07/07/2026 18:43', name:{fr:'Aperçu des cartes Heidel et Calpheon', en:'Heidel and Calpheon card preview'}, fr:[
      {t:'new', sub:'objets', tx:'Le palier verrouillé Heidel annonce désormais sa future récompense "Carte de Heidel" (visible en survolant l\'onglet 🔒) — pareil pour Calpheon avec "Carte de Calpheon". Un couple de recettes "100 fragment → 1 carte" grisées apparaît aussi dans Assemblage, prêtes pour l\'ouverture de ces paliers'},
    ], en:[
      {t:'new', sub:'objets', tx:'The locked Heidel tier now teases its future "Heidel Card" reward (visible by hovering the 🔒 tab) — same for Calpheon with "Calpheon Card". A pair of greyed-out "100 fragment → 1 card" recipes also appears in Assembly, ready for when those tiers open'},
    ] },
  { v:'V272', d:'07/07/2026 18:18', name:{fr:'Fix icône d\'upgrade de zone, étiquette admin, historique d\'optimisation', en:'Fixed zone upgrade icon, admin tag, enhancement history'}, fr:[
      {t:'fix', sub:'interface', severity:'major', tx:'L\'icône ⬆️ signalant qu\'un meilleur stuff attend dans une autre zone ne se déclenchait jamais quand le palier de la pièce équipée était le même que celui de la zone actuellement farmée — un joueur en stuff vert farmant une zone verte ne voyait donc jamais l\'icône, même si une zone bleue sûre offrait mieux. Corrigé et vérifié sur les 3 transitions de palier (gris→blanc, blanc→vert, vert→bleu)'},
      {t:'new', sub:'admin', tx:'Étiquette "ADMIN" affichée à côté du compteur de joueurs, sur la ligne de la zone où se trouve l\'admin — visible uniquement sur son propre client'},
      {t:'new', sub:'objets', tx:'Le Compendium (onglet Sac protégé) garde désormais un historique des objets déjà optimisés puis vendus, avec leur meilleur niveau atteint — avant, cette information disparaissait complètement dès que le dernier exemplaire était vendu'},
    ], en:[
      {t:'fix', sub:'interface', severity:'major', tx:'The ⬆️ icon signaling better gear waits in another zone never triggered when the equipped piece\'s tier matched the currently farmed zone\'s tier — a player in Green gear farming a Green zone never saw the icon, even when a safe Blue zone offered an upgrade. Fixed and verified across all 3 tier transitions (Grey→White, White→Green, Green→Blue)'},
      {t:'new', sub:'admin', tx:'"ADMIN" tag shown next to the player count, on the row of the zone the admin is currently in — visible only on their own client'},
      {t:'new', sub:'objets', tx:'The Compendium (Protected bag tab) now keeps a history of items that were enhanced and later sold, with their best level reached — previously this information vanished entirely once the last copy was sold'},
    ] },
  { v:'V271', d:'07/07/2026 09:04', name:{fr:'Nouvelle recette secrète dans Assemblage', en:'New secret recipe in Assembly'}, fr:[
      {t:'new', sub:'objets', tx:'Nouvelle recette dans Assemblage : combiner 1 Bout du trésor de Velia + 1 matériau d\'optimisation + 1 bijou (3 objets différents) donne un "Coffret secret" en silver — un bon moyen de valoriser un bijou ou un matériau isolé plutôt que de le vendre au rabais'},
    ], en:[
      {t:'new', sub:'objets', tx:'New Assembly recipe: combining 1 Velia Treasure piece + 1 enhancement material + 1 jewelry piece (3 different items) grants a "Secret box" in silver — a good way to cash in a stray jewelry piece or material instead of selling it cheap'},
    ] },
  { v:'V270', d:'07/07/2026 08:44', name:{fr:'Compendium via menu, retrait Lifeskill, stats réorganisées', en:'Compendium via menu, Lifeskill removed, stats reorganized'}, fr:[
      {t:'change', sub:'inventaire', tx:'Dans le Compendium, cliquer un objet ouvre désormais le même menu que le reste du sac, avec un bouton "Mettre en optimisation" explicite (au lieu d\'équiper directement en silence)'},
      {t:'change', sub:'systeme', tx:'Retrait complet de l\'équipement "Lifeskill" (jamais utilisé en jeu, verrouillé depuis son introduction)'},
      {t:'change', sub:'interface', tx:'"Conseil de stuff" repositionné entre le bouton d\'optimisation et les contrôles d\'auto-optimisation, sans son ancien titre de catégorie'},
      {t:'change', sub:'interface', tx:'Le cadre Niveau/PA/PD/GS est restylisé en carré compact, calé sur la largeur des 3 emplacements d\'arme'},
      {t:'change', sub:'interface', tx:'Dans la carte Statistiques : Kills/min, Monstres tués (renommé depuis Loups abattus) et Objets ramassés sont déplacés dans "Stats de la zone" ; les autres stats passent en 3 colonnes (mot / abréviation / valeur)'},
    ], en:[
      {t:'change', sub:'inventaire', tx:'In the Compendium, clicking an item now opens the same menu as the rest of the bag, with an explicit "Load into enhancement" button (instead of silently equipping)'},
      {t:'change', sub:'systeme', tx:'Complete removal of the "Lifeskill" gear panel (never used in-game, locked since its introduction)'},
      {t:'change', sub:'interface', tx:'"Gear advice" repositioned between the enhancement button and the auto-enhancement controls, without its old category title'},
      {t:'change', sub:'interface', tx:'The Level/AP/DP/GS frame is restyled into a compact square, matching the width of the 3 weapon slots'},
      {t:'change', sub:'interface', tx:'In the Statistics card: Kills/min, Monsters slain and Items looted are moved into "Farming zone stats"; the remaining stats switch to 3 columns (word / abbreviation / value)'},
    ] },
  { v:'V269', d:'07/07/2026 08:24', name:{fr:'Compendium en grand onglet, catégories réorganisées', en:'Compendium as a main tab, categories reorganized'}, fr:[
      {t:'change', sub:'inventaire', severity:'major', tx:'Le Compendium (sac protégé) devient un 3e onglet principal, au même niveau qu\'Inventaire/Assemblage, avec sa propre grille en grand format — ce n\'est plus une simple catégorie dans l\'onglet Inventaire'},
      {t:'change', sub:'inventaire', tx:'La catégorie "Trésors" est remontée avant "Consommable"'},
      {t:'change', sub:'inventaire', tx:'La catégorie "Normal" est renommée "Équipements"'},
    ], en:[
      {t:'change', sub:'inventaire', severity:'major', tx:'The Compendium (protected bag) becomes a 3rd main tab, alongside Inventory/Assembly, with its own large grid — no longer just a category inside the Inventory tab'},
      {t:'change', sub:'inventaire', tx:'The "Treasures" category is moved above "Consumable"'},
      {t:'change', sub:'inventaire', tx:'The "Normal" category is renamed "Gear"'},
    ] },
  { v:'V268', d:'07/07/2026 08:16', name:{fr:'Bouton "Équiper → Vendre → Compendium" verrouillé', en:'"Equip → Sell → Compendium" button locked'}, fr:[
      {t:'change', sub:'inventaire', tx:'Le bouton "Équiper → Vendre → Compendium" est temporairement verrouillé (cadenas, grisé), en attente d\'une future activation — même convention que le bouton "Vente automatique"'},
    ], en:[
      {t:'change', sub:'inventaire', tx:'The "Equip → Sell → Compendium" button is temporarily locked (padlock, greyed out), awaiting a future activation — same convention as the "Auto-sell" button'},
    ] },
  { v:'V267', d:'07/07/2026 08:08', name:{fr:'Fix affichage PA/PD figé, Sanctuaire d\'Elric ajusté', en:'Fixed frozen AP/DP display, Elric Shrine adjusted'}, fr:[
      {t:'fix', sub:'interface', severity:'major', tx:'Le PA/PD affiché au-dessus du personnage ne se rafraîchissait qu\'à un changement de composition du sac — une réussite d\'optimisation (qui ne touche que l\'équipement) pouvait donc laisser cet affichage figé sur une ancienne valeur jusqu\'au prochain loot/vente. Il se met désormais à jour instantanément'},
      {t:'change', sub:'zones', tx:'Sanctuaire d\'Elric était devenu exactement aussi difficile que Base de Bashim (la dernière zone verte) — reqDP relevé de 91 à 101 pour que ce soit de nouveau une vraie progression, tout en restant "tout juste difficile" pour un stuff vert complet enchanté à +15 en moyenne'},
      {t:'change', sub:'interface', tx:'Le sélecteur manuel de la pièce à optimiser est retiré — la cible se choisit désormais uniquement via "Mettre en optimisation" (menu objet/poupée) ou en équipant depuis le Compendium'},
      {t:'change', sub:'interface', tx:'Le cadre Niveau/PA/PD/GS est déplacé sous le personnage animé (était au-dessus de la poupée d\'équipement)'},
      {t:'change', sub:'inventaire', tx:'Dans la table de loot, la catégorie "Stuff" est renommée "Équipements" et affichée au-dessus de "Objets d\'optimisation"'},
    ], en:[
      {t:'fix', sub:'interface', severity:'major', tx:'The AP/DP shown above the character only refreshed when the bag\'s contents changed — a successful enhancement (which only touches equipped gear) could leave this display frozen on a stale value until the next loot/sale. It now updates instantly'},
      {t:'change', sub:'zones', tx:'Elric Shrine had become exactly as hard as Bashim Base (the last Green zone) — reqDP raised from 91 to 101 so it\'s a real step up again, while staying "just barely hard" for a full Green gear set enchanted to +15 average'},
      {t:'change', sub:'interface', tx:'The manual enhancement-target selector is removed — the target is now chosen only via "Set as enhancement target" (item/doll menu) or by equipping from the Compendium'},
      {t:'change', sub:'interface', tx:'The Level/AP/DP/GS frame is moved below the animated character (was above the equipment doll)'},
      {t:'change', sub:'inventaire', tx:'In the loot table, the "Gear" category is renamed and moved above "Enhancement items"'},
    ] },
  { v:'V266', d:'07/07/2026 07:58', name:{fr:'Poupée d\'équipement réorganisée', en:'Equipment doll reorganized'}, fr:[
      {t:'change', sub:'interface', tx:'La colonne de droite de la poupée d\'équipement ne garde plus que collier, 2 bagues et 2 boucles d\'oreille (+ ceinture) — les 2 artéfacts, la Pierre d\'alchimie et le Livre de vie sont désormais regroupés sous les armes'},
    ], en:[
      {t:'change', sub:'interface', tx:'The right column of the equipment doll now only holds necklace, 2 rings and 2 earrings (+ belt) — the 2 artifacts, the Alchemy Stone and the Life Book are now grouped below the weapons'},
    ] },
  { v:'V265', d:'07/07/2026 07:45', name:{fr:'Fix : PA/PD au-dessus de l\'équipement restaient en français en anglais', en:'Fix: AP/DP above equipment stayed in French while in English'}, fr:[
      {t:'fix', sub:'interface', tx:'Le résumé PA/PD/GS affiché juste au-dessus de la poupée d\'équipement était codé en dur en français ("PA "/"PD "), même quand le jeu était en anglais — il suit désormais la langue choisie comme partout ailleurs. Les valeurs elles-mêmes étaient déjà correctes, seul le libellé était fautif'},
    ], en:[
      {t:'fix', sub:'interface', tx:'The AP/DP/GS summary shown just above the equipment doll was hardcoded in French ("PA "/"PD "), even when the game was set to English — it now follows the selected language like everywhere else. The values themselves were already correct, only the label was wrong'},
    ] },
  { v:'V264', d:'07/07/2026 07:37', name:{fr:'Outils de debug admin pour l\'enchantement', en:'Admin debug tools for enhancement'}, fr:[
      {t:'new', sub:'admin', tx:'4 boutons réservés à l\'admin dans l\'onglet inventaire principal (invisibles pour tous les autres joueurs) : passer tout l\'équipement en Optimisation max, tout rétrograder à +0, ou avancer/reculer d\'1 rang à la fois — aucun effet sur les compteurs de tentative ni les succès'},
    ], en:[
      {t:'new', sub:'admin', tx:'4 admin-only buttons in the main inventory tab (invisible to all other players): set all equipped gear to max Enhancement, reset it all to +0, or step it up/down by 1 rank at a time — no effect on attempt counters or achievements'},
    ] },
  { v:'V263', d:'07/07/2026 06:42', name:{fr:'Refonte inventaire (onglets, Compendium, vente), IA manuelle, Sanctuaire d\'Elric régulé', en:'Inventory overhaul (tabs, Compendium, selling), manual AI, Elric Shrine access regulated'}, fr:[
      {t:'change', sub:'inventaire', tx:'Le craft de la Pierre de Caphras a été déplacé dans l\'onglet "🔧 Assemblage" — tout futur craft y sera ajouté'},
      {t:'change', sub:'interface', tx:'PA (Attaque) et PD (Défense) affichés à côté des autres stats'},
      {t:'change', sub:'combat', severity:'major', tx:'Le mode de combat de l\'IA (Défensif/Équilibré/Offensif) se choisit désormais manuellement via un sélecteur à bulles, à la place de l\'ancien calcul automatique selon le stuff'},
      {t:'new', sub:'inventaire', tx:'Bouton "Vente automatique" ajouté dans la table de loot (verrouillé, cadenas — fonctionnalité à venir)'},
      {t:'change', sub:'interface', tx:'Les onglets d\'inventaire (Normal/Optimisation/Trésors/Consommable/RNG/Compendium) tiennent désormais sur une seule ligne, avec les cadenas des onglets verrouillés affichés au-dessus, centrés'},
      {t:'change', sub:'inventaire', tx:'La table de loot est désormais catégorisée par groupe (Trashloot avec son prix, Objets d\'optimisation, Stuff) au lieu d\'une liste plate'},
      {t:'change', sub:'inventaire', severity:'major', tx:'Les boutons "Vendre trash", "Vendre mat" et "Trier" (et toute leur logique associée, devenue inutile) sont retirés, remplacés par un bouton unique pleine largeur : "Équiper meilleur → Vendre → Compendium"'},
      {t:'new', sub:'inventaire', severity:'major', tx:'Le sac protégé (Compendium) est désormais un onglet à part entière de l\'inventaire (nouvelle icône 📖) : les objets protégés s\'y affichent avec leur PA/PD et un bouton pour les équiper et lancer directement leur optimisation'},
      {t:'change', sub:'zones', tx:'Accès à Sanctuaire d\'Elric régulé : un stuff vert (Yuria) complet enchanté à +15 en moyenne passe désormais en ZONE DIFFICILE au lieu de ZONE DANGEREUSE (seule la Défense requise a été abaissée, l\'Attaque était déjà correctement calibrée)'},
    ], en:[
      {t:'change', sub:'inventaire', tx:'Caphras Stone crafting moved to the "🔧 Assembly" tab — every future craft will be added there'},
      {t:'change', sub:'interface', tx:'AP (Attack) and DP (Defense) now shown next to the other stats'},
      {t:'change', sub:'combat', severity:'major', tx:'The AI combat mode (Defensive/Balanced/Overgeared) is now chosen manually via a bubble selector, replacing the old automatic calculation based on gear'},
      {t:'new', sub:'inventaire', tx:'Added an "Auto-sell" button in the loot table (locked, padlock — feature coming soon)'},
      {t:'change', sub:'interface', tx:'Inventory tabs (Normal/Enhancement/Treasures/Consumable/RNG/Compendium) now fit on a single row, with locked-tab padlocks shown above, centered'},
      {t:'change', sub:'inventaire', tx:'The loot table is now grouped by category (Trash loot with its price, Enhancement items, Gear) instead of a flat list'},
      {t:'change', sub:'inventaire', severity:'major', tx:'The "Sell trash", "Sell materials" and "Sort" buttons (and all their now-unused logic) are removed, replaced by a single full-width button: "Equip best → Sell → Compendium"'},
      {t:'new', sub:'inventaire', severity:'major', tx:'The protected bag (Compendium) is now a full inventory tab (new 📖 icon): protected items show their AP/DP and a button to equip them and jump straight into their enhancement'},
      {t:'change', sub:'zones', tx:'Elric Shrine access regulated: a full green (Yuria) gear set enchanted to +15 average now lands in HARD ZONE instead of DANGEROUS ZONE (only the required Defense was lowered, Attack was already correctly calibrated)'},
    ] },
  { v:'V262', d:'07/07/2026 05:48', name:{fr:'Audit de sécurité (issue GitHub #4)', en:'Security audit (GitHub issue #4)'}, fr:[
      {t:'exploit', sub:'securite', severity:'major', tx:'Sauvegarde cloud : borne serveur sur silver/niveau/loyauté/enchantement (au-delà de PEN), avec alerte auto en cas de tentative — avant, seul le client validait ces valeurs'},
      {t:'exploit', sub:'securite', tx:'Registre anti-triche (silver_ledger) : catégories et montants désormais bornés côté serveur'},
      {t:'exploit', sub:'securite', tx:'Bibliothèque Supabase JS chargée en version figée + intégrité vérifiée (SRI), au lieu d\'une version flottante'},
      {t:'fix', sub:'interface', tx:'Messages d\'erreur du panneau Admin échappés avant affichage (précaution XSS)'},
    ], en:[
      {t:'exploit', sub:'securite', severity:'major', tx:'Cloud save: server-side bound on silver/level/loyalty/enhancement (beyond PEN), with an auto-alert on any attempt — previously only the client validated these values'},
      {t:'exploit', sub:'securite', tx:'Anti-cheat ledger (silver_ledger): categories and amounts now bounded server-side'},
      {t:'exploit', sub:'securite', tx:'Supabase JS library loaded with a pinned version + verified integrity (SRI), instead of a floating version'},
      {t:'fix', sub:'interface', tx:'Admin panel error messages escaped before display (precautionary XSS)'},
    ] },
  { v:'V261', d:'07/07/2026 01:27', name:{fr:'Audit post-découpage : réfs de fichiers obsolètes corrigées', en:'Post-split audit: stale file references fixed'}, fr:[
      {t:'fix', sub:'admin', tx:'L\'astuce du panneau Admin "Silver" pour ajouter une nouvelle catégorie pointait encore vers game-supabase.js pour CATEGORY_LABEL, alors que ce code vit désormais dans admin-panel.js depuis le découpage'},
      {t:'change', sub:'systeme', tx:'Ajout d\'un test de régression qui vérifie que la détection de nouvelle version cible bien le fichier qui contient réellement PATCH_NOTES aujourd\'hui — pour attraper immédiatement un futur déplacement oublié, comme celui qui avait cassé la notification (voir V259)'},
    ], en:[
      {t:'fix', sub:'admin', tx:'The Admin "Silver" panel\'s hint for adding a new category still pointed to game-supabase.js for CATEGORY_LABEL, when that code now lives in admin-panel.js since the split'},
      {t:'change', sub:'systeme', tx:'Added a regression test that checks the update-detection fetch actually targets the file that currently defines PATCH_NOTES — to immediately catch a future forgotten move, like the one that broke the notification (see V259)'},
    ] },
  { v:'V260', d:'07/07/2026 01:20', name:{fr:'Fix : vente d\'un bijou en trop via le menu objet', en:'Fix: selling a spare jewelry piece via the item menu'}, fr:[
      {t:'fix', sub:'inventaire', tx:'Le menu contextuel d\'un objet (clic droit / appui long) n\'affichait le bouton "Vendre 1" que pour le rebut/matériaux/équipement — les bijoux (anneaux, boucles, colliers, ceintures) en étaient exclus, rendant impossible leur vente manuelle via ce menu (seul l\'auto-équipement au clic simple fonctionnait). Vérifié au passage : la vente garde toujours le meilleur exemplaire enchanté d\'un doublon dans le sac protégé, y compris pour les bijoux'},
    ], en:[
      {t:'fix', sub:'inventaire', tx:'An item\'s context menu (right-click / long-press) only showed the "Sell 1" button for trash/materials/gear — jewelry (rings, earrings, necklaces, belts) was excluded, making it impossible to manually sell a spare one through that menu (only auto-equip on simple click worked). Also verified: selling always keeps the best-enchanted duplicate copy in the protected bag, jewelry included'},
    ] },
  { v:'V259', d:'07/07/2026 01:12', name:{fr:'Fix notification de mise à jour, le jeu ne se met plus en pause en arrière-plan', en:'Fixed update notification, game no longer pauses in the background'}, fr:[
      {t:'fix', sub:'systeme', severity:'major', tx:'La notification "nouvelle version disponible" ne s\'affichait plus depuis le découpage de game-supabase.js (2026-07-14) : la détection allait chercher PATCH_NOTES dans le mauvais fichier (déplacé entre-temps dans patch-notes-data.js) et ne matchait donc plus jamais'},
      {t:'change', sub:'systeme', tx:'Le jeu ne se met plus en pause quand l\'onglet/la fenêtre perd le focus — le farm, le combat et le loot continuent de tourner en arrière-plan, comme attendu d\'un jeu idle'},
    ], en:[
      {t:'fix', sub:'systeme', severity:'major', tx:'The "new version available" notification stopped showing since the game-supabase.js split (2026-07-14): the detection fetched PATCH_NOTES from the wrong file (moved to patch-notes-data.js) and could never match anymore'},
      {t:'change', sub:'systeme', tx:'The game no longer pauses when the tab/window loses focus — farming, combat and loot keep running in the background, as expected from an idle game'},
    ] },
  { v:'V258', d:'07/07/2026 01:02', name:{fr:'Nouveau sélecteur de mode de farm, mode Opti retiré', en:'New farm mode selector, Opti mode removed'}, fr:[
      {t:'change', sub:'interface', severity:'major', tx:'Le mode de farm (Loot/XP) se choisit désormais via un petit sélecteur à bulles à la place du slider — la bulle active s\'affiche en capsule dorée pleine (icône + texte), les autres en icône seule'},
      {t:'change', sub:'combat', tx:'Le mode "Opti" (pack à pack rapide) est retiré, ainsi que toute sa logique associée — un 3e emplacement verrouillé (cadenas grisé) reste visible dans le sélecteur, en attente d\'un futur mode'},
    ], en:[
      {t:'change', sub:'interface', severity:'major', tx:'The farm mode (Loot/XP) is now chosen via a small bubble selector instead of the slider — the active bubble shows as a full gold capsule (icon + text), the others as icon only'},
      {t:'change', sub:'combat', tx:'The "Opti" mode (fast pack-to-pack) is removed, along with all its associated logic — a 3rd locked slot (greyed padlock) remains visible in the selector, awaiting a future mode'},
    ] },
  { v:'V257', d:'07/07/2026 00:42', name:{fr:'Nettoyage technique du code (aucun changement de jeu)', en:'Technical code cleanup (no gameplay change)'}, fr:[
      {t:'change', sub:'systeme', tx:'Réorganisation interne du code : les deux gros fichiers du jeu (game-supabase.js et game-core.js) ont été découpés en plusieurs fichiers plus petits et thématiques (admin, chat, marché, boss mondial, rendu, inventaire...) pour être plus faciles à maintenir. Aucun impact sur le gameplay, tout a été vérifié par la suite de tests avant chaque étape'},
    ], en:[
      {t:'change', sub:'systeme', tx:'Internal code reorganization: the two large game files (game-supabase.js and game-core.js) were split into several smaller, themed files (admin, chat, market, world boss, rendering, inventory...) to be easier to maintain. No gameplay impact, everything was verified by the test suite before each step'},
    ] },
  { v:'V256', d:'06/07/2026 23:07', name:{fr:'Plus de bijoux en zones vertes et bleues', en:'More jewelry in Green and Blue tiers'}, fr:[
      {t:'change', sub:'objets', severity:'major', tx:'Chance de trouver un bijou rehaussée dans les 4 zones du palier vert (×1.8 : Mine de Fer Abandonnée, Poste Helm, Repaire Bandits Gahaz, Base de Bashim) et les 4 zones du palier bleu (×2 : Sanctuaire Elric, Ruines de Kratuga, Planque des Mânes, Forêt de Polly). Paliers gris et blanc inchangés'},
    ], en:[
      {t:'change', sub:'objets', severity:'major', tx:'Jewelry drop chance raised in the 4 Green tier zones (×1.8: Abandoned Iron Mine, Helm Post, Gahaz Bandit Lair, Bashim Base) and the 4 Blue tier zones (×2: Elric Shrine, Kratuga Ruins, Manes Hideout, Polly Forest). Grey and White tiers unchanged'},
    ] },
  { v:'V255', d:'06/07/2026 23:04', name:{fr:'Les sorts de zone touchent enfin toute la zone', en:'Zone spells finally hit the whole zone'}, fr:[
      {t:'fix', sub:'combat', severity:'major', tx:'Les sorts (Météore, Blizzard, Tempête de foudre, Tremblement de terre...) ont toujours eu un effet visuel étalé sur tout le groupe de monstres, mais ne blessaient en réalité qu\'un seul monstre (le premier vivant) — ils infligent désormais leurs dégâts à TOUS les monstres vivants du groupe ciblé, comme leur effet le laissait déjà croire'},
    ], en:[
      {t:'fix', sub:'combat', severity:'major', tx:'Spells (Meteor Shower, Blizzard, Thunder Storm, Earthquake...) always had a visual effect spread across the whole monster pack, but only actually hurt one monster (the first alive) — they now deal damage to ALL living monsters in the targeted pack, matching what the effect already showed'},
    ] },
  { v:'V254', d:'06/07/2026 22:54', name:{fr:'Potions ÷10 (encore), aggro de proximité partout', en:'Potions ÷10 (again), proximity aggro everywhere'}, fr:[
      {t:'change', sub:'economie', tx:'Prix des potions divisé par 10 une 2e fois (la petite coûte désormais ≈0.05% du revenu horaire de trash de la zone, la majeure ≈0.3%, au lieu de 0.5%/3%)'},
      {t:'change', sub:'combat', severity:'major', tx:'Les groupes de monstres proches (400 unités) s\'aggro désormais tout seuls dès qu\'on s\'approche, dans TOUTE zone — avant, ce réveil automatique n\'existait qu\'en zone dangereuse ; ailleurs, seul le pack visé par l\'IA s\'activait'},
    ], en:[
      {t:'change', sub:'economie', tx:'Potion prices divided by 10 a 2nd time (small now costs ≈0.05% of the zone\'s hourly trash income, mega ≈0.3%, down from 0.5%/3%)'},
      {t:'change', sub:'combat', severity:'major', tx:'Nearby monster packs (within 400 units) now aggro on their own as soon as you get close, in ANY zone — before, this auto-wakeup only existed in dangerous zones; elsewhere only the AI\'s current target would engage'},
    ] },
  { v:'V253', d:'06/07/2026 22:41', name:{fr:'Trésor de Velia en production, plafond d\'empilement, poupée décalée', en:'Velia Treasure goes live, stack cap, doll shifted left'}, fr:[
      {t:'change', sub:'objets', severity:'major', tx:'Le Trésor de Velia sort du statut expérimental "TEST" : "Bout du trésor de Velia" (0.17% de chance) et "Trésor de Velia" (0.0005%, fusion des anciennes variantes 1/2/3) ont désormais un vrai prix de revente — 10× le prix d\'un équipement du palier courant pour un Bout, 10 000× pour un Trésor'},
      {t:'change', sub:'objets', tx:'Le sac plafonne les Bouts à 100 et le Trésor de Velia à 1 : tout surplus est revendu automatiquement au prix ci-dessus au lieu de bloquer le ramassage ou remplir le sac. L\'ancien objet mystère "Objet inconnu" (qui demandait d\'empiler 3 Trésors différents) est retiré, devenu impossible à obtenir avec ce plafond'},
      {t:'fix', sub:'interface', tx:'Certaines icônes de la poupée d\'équipement (côté droit : bijoux/artefacts) pouvaient se retrouver coupées près du bord de la carte, juste à côté de l\'Inventaire — décalées d\'une marge supplémentaire vers la gauche'},
    ], en:[
      {t:'change', sub:'objets', severity:'major', tx:'Velia Treasure leaves the experimental "TEST" status: "Velia Treasure Fragment" (0.17% chance) and "Velia Treasure" (0.0005%, merging the old 1/2/3 variants) now have a real sell price — 10x the price of a current-tier equipment piece for a fragment, 10,000x for a Treasure'},
      {t:'change', sub:'objets', tx:'The bag caps fragments at 100 and Velia Treasure at 1: any surplus is auto-sold at the price above instead of blocking pickup or filling the bag. The old "Unknown Item" mystery item (which required stacking 3 different Treasures) is removed, now impossible to obtain with this cap'},
      {t:'fix', sub:'interface', tx:'Some equipment doll icons (right side: jewelry/artifacts) could end up clipped near the card edge, right next to the Inventory panel — shifted with extra left margin'},
    ] },
  { v:'V252', d:'06/07/2026 22:26', name:{fr:'Mode Opti (IA pack à pack), slider de mode, icônes de stuff agrandies', en:'Opti mode (pack-to-pack AI), mode slider, bigger gear icons'}, fr:[
      {t:'new', sub:'combat', severity:'major', tx:'Nouveau 3e mode de farm "🌀 Opti" : dès que le pack combattu tombe à 70% de vie cumulée, le personnage repère déjà le pack vivant le plus proche et bascule dessus dès qu\'il serait normalement aggro — enchaîne les packs sans jamais attendre la fin d\'un combat'},
      {t:'change', sub:'interface', tx:'Le bouton de mode de farm est remplacé par un slider à 3 crans (🎒 Loot / 📖 XP / 🌀 Opti), plus lisible qu\'un simple clic cyclique'},
      {t:'fix', sub:'objets', tx:'La flèche ⬆️ d\'amélioration sur une pièce équipée ne se rafraîchissait pas en changeant de zone (elle ne réapparaissait qu\'après un loot ou une vente) — elle suit désormais correctement chaque voyage, y compris en quittant une zone qui devient une meilleure option'},
      {t:'change', sub:'interface', tx:'Les icônes de stuff (sac et poupée d\'équipement) remplissent désormais presque toute leur case au lieu de flotter avec une grosse marge autour'},
    ], en:[
      {t:'new', sub:'combat', severity:'major', tx:'New 3rd farm mode "🌀 Opti": as soon as the current pack drops to 70% combined HP, the character already spots the nearest living pack and switches to it as soon as it would normally aggro — chains packs without ever waiting for a fight to end'},
      {t:'change', sub:'interface', tx:'The farm mode button is replaced by a 3-position slider (🎒 Loot / 📖 XP / 🌀 Opti), clearer than a single cyclic click'},
      {t:'fix', sub:'objets', tx:'The ⬆️ upgrade arrow on an equipped piece didn\'t refresh on zone change (it only reappeared after a loot or a sale) — it now correctly follows every trip, including leaving a zone that becomes a better option'},
      {t:'change', sub:'interface', tx:'Gear icons (bag and equipment doll) now fill almost their entire cell instead of floating with a large margin around them'},
    ] },
  { v:'V251', d:'06/07/2026 22:07', name:{fr:'Fix bijoux dans l\'auto-opti, 2x plus de monstres en zone verte, filet Firefox renforcé', en:'Fixed jewelry in auto-opt, 2x more monsters in Green tier, stronger Firefox safety net'}, fr:[
      {t:'fix', sub:'objets', severity:'major', tx:'La liste déroulante de l\'optimisation automatique n\'affichait jamais le gain (+1 PA, +2 PA...) pour les bijoux (anneaux, boucles, colliers, ceintures) — le code ne regardait que le gain de PD par défaut pour tout ce qui n\'est pas une arme, alors que les bijoux donnent de la PA, jamais de PD. Corrigé : le gain s\'affiche désormais correctement pour les bijoux'},
      {t:'change', sub:'combat', tx:'Le palier vert (Mine de Fer Abandonnée, Poste Helm, Repaire Bandits Gahaz, Base de Bashim) a désormais 16 groupes de monstres actifs en même temps (2× le palier blanc), au lieu de 10'},
      {t:'fix', sub:'interface', plat:'firefox', tx:'Le filet de sécurité Firefox posé précédemment (min-width:0) ne suffisait pas d\'après un retour en jeu — ajout d\'un filet supplémentaire (overflow-x:hidden sur les cartes) qui empêche tout débordement horizontal, quelle que soit la cause exacte restante. Non vérifié visuellement sur un vrai Firefox (indisponible dans cet environnement de développement) — à reconfirmer'},
    ], en:[
      {t:'fix', sub:'objets', severity:'major', tx:'The auto-optimization dropdown list never showed the gain (+1 AP, +2 AP...) for jewelry (rings, earrings, necklaces, belts) — the code only checked DP gain by default for anything that isn\'t a weapon, even though jewelry gives AP, never DP. Fixed: the gain now displays correctly for jewelry'},
      {t:'change', sub:'combat', tx:'The Green tier (Abandoned Iron Mine, Helm Post, Gahaz Bandit Lair, Bashim Base) now has 16 monster groups active at once (2x the White tier), up from 10'},
      {t:'fix', sub:'interface', plat:'firefox', tx:'The previous Firefox safety net (min-width:0) wasn\'t enough per an in-game report — added another layer (overflow-x:hidden on cards) that prevents any horizontal overflow regardless of the exact remaining cause. Not visually verified on a real Firefox (unavailable in this dev environment) — to be reconfirmed'},
    ] },
  { v:'V250', d:'06/07/2026 21:54', name:{fr:'Onglets de région (Velia à Edana) sur une seule ligne', en:'Region tabs (Velia to Edana) on a single row'}, fr:[
      {t:'change', sub:'interface', tx:'Les 5 onglets de région (Velia/Heidel/Calpheon/Valencia/Edana) passaient parfois sur 2 rangées. Le cadenas 🔒 des régions verrouillées est désormais un petit badge au-dessus de chaque onglet, centré, au lieu d\'être dans le texte — libère assez de place pour que les 5 tiennent toujours sur une seule ligne'},
    ], en:[
      {t:'change', sub:'interface', tx:'The 5 region tabs (Velia/Heidel/Calpheon/Valencia/Edana) sometimes wrapped onto 2 rows. The 🔒 lock for locked regions is now a small badge above each tab, centered, instead of being in the text — frees up enough room for all 5 to always fit on a single row'},
    ] },
  { v:'V249', d:'06/07/2026 21:42', name:{fr:'Lien zone ↔ pièce d\'équipement précis, fix armure "où farmer"', en:'Precise zone ↔ gear slot link, fixed armor "where to farm"'}, fr:[
      {t:'fix', sub:'objets', severity:'major', tx:'Le système "où farmer" (case vide ou flèche ⬆️) proposait TOUTES les zones du palier pour n\'importe quelle pièce d\'armure, alors que chaque pièce (casque/torse/gants/bottes) ne peut en réalité dropper que dans SA zone dédiée — un reliquat de l\'ancien système d\'avant "1 pièce garantie par zone". Corrigé : casque/torse/gants/bottes ne proposent plus que leur zone exacte'},
      {t:'new', sub:'interface', tx:'Survoler une zone dans la liste surligne désormais UNIQUEMENT la ou les pièces de la poupée d\'équipement que cette zone précise permet d\'améliorer — plus une pièce a de zones qui l\'améliorent, plus elle peut s\'allumer depuis plusieurs lignes de la liste'},
    ], en:[
      {t:'fix', sub:'objets', severity:'major', tx:'The "where to farm" system (empty slot or ⬆️ arrow) suggested EVERY zone of the tier for any armor piece, even though each piece (helmet/chest/gloves/boots) can only actually drop in its own dedicated zone — a leftover from the old system predating "1 guaranteed piece per zone". Fixed: helmet/chest/gloves/boots now only suggest their exact zone'},
      {t:'new', sub:'interface', tx:'Hovering a zone in the list now highlights ONLY the equipment doll piece(s) that specific zone can actually upgrade — the more zones improve a piece, the more list rows can light it up'},
    ] },
  { v:'V248', d:'06/07/2026 21:37', name:{fr:'Tooltip détaillé pour le stuff du sac protégé', en:'Detailed tooltip for protected bag gear'}, fr:[
      {t:'new', sub:'interface', tx:'Survoler une pièce du sac protégé (Compendium) affiche désormais le tooltip complet (PA/PD/PV/Esquive/enchantement), comme dans le sac principal — avant, seul un petit badge d\'enchantement était visible, sans détail au survol'},
    ], en:[
      {t:'new', sub:'interface', tx:'Hovering a piece in the protected bag (Compendium) now shows the full tooltip (AP/DP/HP/Dodge/enhancement), like in the main bag — before, only a small enhancement badge was visible, with no hover detail'},
    ] },
  { v:'V247', d:'06/07/2026 21:32', name:{fr:'La flèche d\'upgrade propose à nouveau toutes les zones', en:'The upgrade arrow suggests all zones again'}, fr:[
      {t:'change', sub:'interface', tx:'La flèche ⬆️ (sur une pièce équipée ou sur une zone) ne proposait plus que des zones déjà découvertes (visitées au moins une fois) — revirement assumé : elle propose à nouveau n\'importe quelle zone du jeu, même jamais visitée, tant qu\'elle n\'est pas dangereuse'},
    ], en:[
      {t:'change', sub:'interface', tx:'The ⬆️ arrow (on an equipped piece or a zone) only suggested already-discovered zones (visited at least once) — deliberate reversal: it now suggests any zone in the game again, even one never visited, as long as it isn\'t dangerous'},
    ] },
  { v:'V246', d:'06/07/2026 21:22', name:{fr:'Potions ÷10, palier vert accessible avec un stuff blanc complet', en:'Potions ÷10, Green tier reachable with full White gear'}, fr:[
      {t:'change', sub:'economie', tx:'Prix des potions divisé par 10 (la petite coûte désormais ≈0.5% du revenu horaire de trash, la majeure ≈3%, au lieu de 5%/30%)'},
      {t:'change', sub:'zones', severity:'major', tx:'Les 4 zones du palier vert (Mine de Fer Abandonnée, Poste Helm, Repaire Bandits Gahaz, Base de Bashim) ont leur PA/PD requis abaissés d\'environ 20% : un stuff complet du palier blanc (armes+armure+bijoux des 4 zones blanches) enchanté à +13 atteint désormais tout juste "ZONE DIFFICILE" face à Mine de Fer Abandonnée, et ce même stuff au PEN atteint "ZONE DIFFICILE" face à Poste Helm (2e zone verte). Le palier blanc n\'est pas touché. Rétroactif sur le stuff déjà possédé de ces 4 zones'},
    ], en:[
      {t:'change', sub:'economie', tx:'Potion prices divided by 10 (the small one now costs ≈0.5% of the hourly trash income, the major one ≈3%, down from 5%/30%)'},
      {t:'change', sub:'zones', severity:'major', tx:'The 4 Green tier zones (Abandoned Iron Mine, Helm Post, Gahaz Bandit Lair, Bashim Base) have their required AP/DP lowered by about 20%: a full White tier gear set (weapons+armor+jewelry from all 4 White zones) enhanced to +13 now just barely reaches "DIFFICULT ZONE" against Abandoned Iron Mine, and the same gear at PEN reaches "DIFFICULT ZONE" against Helm Post (2nd Green zone). White tier is untouched. Retroactive for gear already owned from these 4 zones'},
    ] },
  { v:'V245', d:'06/07/2026 21:03', name:{fr:'Silver/h uniquement du token, potions rééquilibrées (5% à 30%)', en:'Silver/h from tokens only, potions rebalanced (5% to 30%)'}, fr:[
      {t:'change', sub:'economie', severity:'major', tx:'Le "silver/h" affiché en jeu (et celui utilisé pour le classement) comptait toutes les sources de gain (quêtes, succès, boss, marché...), ce qui pouvait gonfler artificiellement la lecture du rythme de farm réel après un gros coup de chance. Il ne compte désormais QUE le silver du trash (token) ramassé au sol'},
      {t:'change', sub:'economie', tx:'Prix des potions réajusté : la petite potion coûte désormais environ 5% du revenu horaire de trash de la zone actuelle, la potion majeure environ 30% (au lieu de 2.76% à 15%) — moyenne/grande potion interpolées entre les deux'},
    ], en:[
      {t:'change', sub:'economie', severity:'major', tx:'The in-game "silver/h" (and the one used for the leaderboard) counted every income source (quests, achievements, boss, market...), which could artificially inflate the reading of actual farming pace after a lucky reward. It now only counts trash (token) silver picked up off the ground'},
      {t:'change', sub:'economie', tx:'Potion pricing adjusted: the small potion now costs about 5% of the current zone\'s hourly trash income, the major potion about 30% (up from 2.76%-15%) — medium/large potions interpolated in between'},
    ] },
  { v:'V244', d:'06/07/2026 20:57', name:{fr:'Fix layout Firefox, Mine de Fer Abandonnée accessible en +13', en:'Firefox layout fix, Abandoned Iron Mine reachable at +13'}, fr:[
      {t:'fix', sub:'interface', severity:'major', plat:'firefox', tx:'Sur Firefox, certaines lignes de la carte Statistiques ("PA/PD requis (zone)") pouvaient déborder par-dessus les cartes Équipement/Inventaire au lieu de rester dans leur colonne. Corrigé (min-width:0 sur les cartes de la grille) — Chrome n\'était pas affecté, mais toute la mise en page en 3 colonnes est concernée par ce type de bug ; on va vérifier Firefox plus systématiquement à chaque changement de mise en page à l\'avenir'},
      {t:'change', sub:'zones', tx:'Un stuff complet de Colonie Sausan enchanté à +13 atteint désormais bien "ZONE DIFFICILE" face à Mine de Fer Abandonnée (au lieu de "ZONE DANGEREUSE") — la puissance de PD de son stuff est légèrement augmentée sans changer sa propre difficulté de combat. Le même stuff au PEN atteint "ZONE DIFFICILE" face à Poste Helm, 2 zones plus loin. Rétroactif sur le stuff déjà possédé'},
    ], en:[
      {t:'fix', sub:'interface', severity:'major', plat:'firefox', tx:'On Firefox, some Stats card rows ("AP/DP required (zone)") could overflow on top of the Equipment/Inventory cards instead of staying in their own column. Fixed (min-width:0 on the grid cards) — Chrome wasn\'t affected, but this class of bug applies to the whole 3-column layout; Firefox will be checked more systematically on future layout changes'},
      {t:'change', sub:'zones', tx:'A full Sausan Colony gear set enhanced to +13 now correctly reaches "DIFFICULT ZONE" against Abandoned Iron Mine (instead of "DANGEROUS ZONE") — its gear\'s DP power is slightly increased without changing the zone\'s own combat difficulty. The same gear at PEN reaches "DIFFICULT ZONE" against Helm Post, 2 zones further. Retroactive for already-owned gear'},
    ] },
  { v:'V243', d:'06/07/2026 20:43', name:{fr:'Plus de groupes de monstres à partir du palier blanc', en:'More monster groups from the White tier onward'}, fr:[
      {t:'change', sub:'combat', tx:'Le nombre de groupes de monstres actifs en même temps dans le monde augmente désormais à chaque palier de stuff : 6 (gris, inchangé), 8 (blanc), 10 (vert), 12 (bleu). Même monstre et même loot par zone, juste plus de groupes vivants simultanément'},
    ], en:[
      {t:'change', sub:'combat', tx:'The number of monster groups active at the same time in the world now increases with each gear tier: 6 (grey, unchanged), 8 (white), 10 (green), 12 (blue). Same monster and loot per zone, just more groups alive at once'},
    ] },
  { v:'V242', d:'06/07/2026 20:32', name:{fr:'Rééquilibrage du prix des potions (lié uniquement au trash/token)', en:'Potion price rebalance (tied only to trash/token)'}, fr:[
      {t:'change', sub:'economie', severity:'major', tx:'Le prix des potions ne dépendait déjà que du silver de trash (token) de la zone, jamais de la vente de stuff — mais l\'amortissement en racine carrée dérivait fortement de l\'objectif visé : la potion la plus chère (mega) coûtait jusqu\'à 42% du revenu horaire en début de jeu, mais seulement 3.6% en fin de jeu, au lieu de rester proche de 15% partout. Elle coûte désormais TOUJOURS exactement 15% du revenu horaire de trash de la zone actuelle, quelle que soit la zone — les autres tailles (petite/moyenne/grande) gardent le même ratio entre elles qu\'avant'},
    ], en:[
      {t:'change', sub:'economie', severity:'major', tx:'Potion price already depended only on the zone\'s trash (token) silver, never on gear sales — but the square-root dampening drifted far from its own target: the priciest potion (mega) cost up to 42% of hourly income early on, but only 3.6% late-game, instead of staying close to 15% everywhere. It now always costs exactly 15% of the current zone\'s hourly trash income, regardless of zone — the other sizes (small/medium/large) keep the same ratio between them as before'},
    ] },
  { v:'V241', d:'06/07/2026 20:22', name:{fr:'Notes de version : pagination au lieu du scroll', en:'Patch notes: pagination instead of scrolling'}, fr:[
      {t:'change', sub:'interface', tx:'Le panneau "Notes de version" ne se lit plus au scroll : il affiche désormais 2 à 7 notes à la fois (selon leur taille), avec un bouton "▲ Plus récent" et "Plus ancien ▼" pour naviguer dans l\'historique. La page affichée est toujours retenue d\'une ouverture à l\'autre'},
    ], en:[
      {t:'change', sub:'interface', tx:'The "Patch Notes" panel is no longer read by scrolling: it now shows 2 to 7 notes at a time (depending on size), with a "▲ Newer" and "Older ▼" button to navigate through history. The displayed page is always remembered between openings'},
    ] },
  { v:'V240', d:'06/07/2026 20:13', name:{fr:'Fix : aucune pierre ne s\'auto-sélectionnait pour les bijoux', en:'Fix: no stone was auto-selected for jewelry'}, fr:[
      {t:'fix', sub:'objets', severity:'major', tx:'Les bijoux (anneaux, boucles, colliers, ceintures) n\'ont jamais porté l\'information de leur propre palier de matériau — contrairement à l\'armure et aux armes, qui l\'ont toujours eu. L\'optimisation retombait donc sur le matériau de la zone où tu farmes ACTUELLEMENT au lieu de celui du palier du bijou équipé, affichant "Aucun matériau en sac" à tort dès que les deux ne correspondaient pas. Corrigé pour tout nouveau bijou, et rétroactivement pour tous ceux déjà possédés (équipés, en sac, ou protégés). Rappel des paliers : Pierre de Novice = Naru, Pierre du Temps = Tuvala, Pierre Noire = tout le stuff vert, Pierre concentrée = tout le stuff bleu'},
    ], en:[
      {t:'fix', sub:'objets', severity:'major', tx:'Jewelry (rings, earrings, necklaces, belts) never carried its own material tier — unlike armor and weapons, which always did. Enhancement therefore fell back to the material of the zone you\'re CURRENTLY farming instead of the equipped jewelry\'s own tier, wrongly showing "No material in bag" whenever the two didn\'t match. Fixed for every new jewelry drop, and retroactively for anything already owned (equipped, in bag, or protected). Tier reminder: Novice Stone = Naru, Time Stone = Tuvala, Black Stone = all green gear, Concentrated Stone = all blue gear'},
    ] },
  { v:'V239', d:'06/07/2026 20:07', name:{fr:'Fix : l\'auto-équipement ignorait un doublon plus enchanté à socle égal', en:'Fix: auto-equip ignored a more enhanced duplicate with the same base'}, fr:[
      {t:'fix', sub:'objets', severity:'major', tx:'Quand tu vends un objet dont un exemplaire est déjà équipé avec exactement le même socle de base, l\'auto-équipement (avant vente) ne comparait pas l\'enchantement — un doublon plus enchanté restait ignoré au lieu de remplacer l\'exemplaire équipé moins monté. Concerne aussi les anneaux et boucles d\'oreille (vérifie désormais le slot 1 puis le slot 2, remplace toujours le moins enchanté des deux)'},
    ], en:[
      {t:'fix', sub:'objets', severity:'major', tx:'When selling an item with an exact same-base copy already equipped, auto-equip (before the sale) never compared enhancement level — a more enhanced duplicate stayed ignored instead of replacing the less-enhanced equipped copy. Also affects rings and earrings (now checks slot 1 then slot 2, always replaces the less enhanced of the two)'},
    ] },
  { v:'V238', d:'06/07/2026 20:00', name:{fr:'Rétroactivité du lissage des zones, nom de zone corrigé au chargement', en:'Retroactive zone smoothing, fixed zone name on load'}, fr:[
      {t:'fix', sub:'objets', severity:'major', tx:'Les changements de PA/PD requis de zones (échelonnement de Ruines de Trent/Île d\'Iliya/Base de Bashim et lissage de Ruines de Kratuga/Planque des Mânes) ne se répercutaient pas sur le stuff déjà dropé avant ces changements — tout objet déjà possédé de ces zones est désormais recalculé automatiquement, sans toucher à l\'enchantement déjà investi'},
      {t:'fix', sub:'interface', tx:'Le nom de la zone affiché en haut du cadre de jeu pouvait rester bloqué sur "Camp des Loups" après le chargement d\'une sauvegarde sur une autre zone, tant qu\'aucun voyage manuel n\'était fait. Il reflète désormais toujours la vraie zone dès le chargement'},
    ], en:[
      {t:'fix', sub:'objets', severity:'major', tx:'Zone AP/DP requirement changes (staggering Trent Ruins/Iliya Island/Bashim Base and smoothing Kratuga Ruins/Manes\' Hideout) didn\'t carry over to gear already dropped before those changes — any already-owned item from those zones is now automatically recalculated, without touching already-invested enhancement'},
      {t:'fix', sub:'interface', tx:'The zone name shown at the top of the game frame could stay stuck on "Wolf Camp" after loading a save on a different zone, until a manual travel was made. It now always reflects the real zone right after loading'},
    ] },
  { v:'V237', d:'06/07/2026 19:41', name:{fr:'Fix : une pierre du mauvais palier ne peut plus optimiser du stuff', en:'Fix: a stone from the wrong tier can no longer enhance gear'}, fr:[
      {t:'fix', sub:'objets', severity:'major', tx:'S\'il ne restait plus de pierre du bon palier en sac (ex: Pierre du Temps pour du stuff Tuvala), l\'optimisation retombait silencieusement sur N\'IMPORTE QUELLE autre pierre en stock, même d\'un palier différent (ex: Pierre de Novice, Naru). Corrigé : sans le bon matériau, l\'optimisation reste bloquée ("Aucun matériau en sac") au lieu de consommer une pierre qui ne correspond pas. Un matériau épinglé via "Mettre en optimisation" qui ne correspond plus au palier de la pièce ciblée est désormais lui aussi ignoré'},
    ], en:[
      {t:'fix', sub:'objets', severity:'major', tx:'If no stone of the right tier was left in the bag (e.g. Time Stone for Tuvala gear), enhancement silently fell back to ANY other stone in stock, even from a different tier (e.g. Novice Stone, Naru). Fixed: without the right material, enhancement stays blocked ("No material in bag") instead of consuming a mismatched stone. A material pinned via "Set for enhancement" that no longer matches the targeted piece\'s tier is now also ignored'},
    ] },
  { v:'V236', d:'06/07/2026 19:37', name:{fr:'La flèche de zone ignore le stuff déjà dans le sac', en:'The zone arrow ignores gear already in the bag'}, fr:[
      {t:'fix', sub:'interface', tx:'L\'icône ⬆️ affichée sur une zone (suggérant d\'aller y farmer un meilleur stuff) pouvait s\'afficher alors que ce meilleur stuff se trouvait déjà, non équipé, dans le sac — il suffisait de l\'équiper, pas d\'aller le farmer. Elle ne s\'affiche plus dans ce cas'},
    ], en:[
      {t:'fix', sub:'interface', tx:'The ⬆️ icon shown on a zone (suggesting better gear could be farmed there) could appear even when that better gear was already sitting unequipped in the bag — equipping it was all that was needed, not farming. It no longer shows in that case'},
    ] },
  { v:'V235', d:'06/07/2026 19:28', name:{fr:'Combat monstre par monstre, loot Alpha ×2, flèche d\'upgrade limitée aux zones découvertes', en:'Monster-by-monster combat, ×2 Alpha loot, upgrade arrow limited to discovered zones'}, fr:[
      {t:'change', sub:'combat', severity:'major', tx:'Chaque monstre d\'un pack a désormais sa propre barre de vie et son propre loot : avant, tout le pack partageait une seule barre agrégée et tous les monstres mouraient d\'un coup une fois vidée. Ils meurent maintenant un par un au fil du combat, chacun avec sa barre au-dessus de lui'},
      {t:'change', sub:'loot', tx:'Les groupes Alpha (boss de pack) ont maintenant un taux de drop uniformément ×2 par rapport à un groupe normal, sur tous les types de loot (trash, matériau, bijou, craft, trésor, pierre de Cron, armure, arme) — remplace les anciens multiplicateurs disparates (×1.5 et ×1.6 selon le type)'},
      {t:'fix', sub:'interface', tx:'La flèche ⬆️ sur une pièce équipée (indiquant qu\'un meilleur stuff existe) pouvait pointer vers une zone jamais découverte. Elle ne propose désormais que des zones déjà atteintes au moins une fois, en plus d\'exclure toujours les zones dangereuses'},
      {t:'change', sub:'zones', tx:'Les 3 dernières zones du jeu (Ruines de Kratuga, Planque des Mânes, Forêt de Polly) demandaient toutes exactement 320 PA / 175 PD. Elles montent désormais progressivement vers ce même plafond (286/157, puis 303/166, puis 320/175 sur la toute dernière) au lieu d\'y être déjà les 3 en même temps'},
    ], en:[
      {t:'change', sub:'combat', severity:'major', tx:'Each monster in a pack now has its own health bar and its own loot: before, the whole pack shared one aggregate bar and every monster died at once when it emptied. They now die one at a time as the fight goes on, each with its own bar above it'},
      {t:'change', sub:'loot', tx:'Alpha packs (pack bosses) now have a uniform ×2 drop rate compared to a normal pack, across every loot type (trash, material, jewelry, craft, treasure, Cron stone, armor, weapon) — replaces the previous mismatched multipliers (×1.5 and ×1.6 depending on type)'},
      {t:'fix', sub:'interface', tx:'The ⬆️ arrow on an equipped piece (flagging that better gear exists) could point to a zone never discovered. It now only suggests zones already reached at least once, on top of always excluding dangerous zones'},
      {t:'change', sub:'zones', tx:'The game\'s last 3 zones (Kratuga Ruins, Manes\' Hideout, Polly Forest) all required exactly 320 AP / 175 DP. They now climb progressively toward that same cap (286/157, then 303/166, then 320/175 on the very last one) instead of all 3 being there at once'},
    ] },
  { v:'V234', d:'06/07/2026 18:58', name:{fr:'Zones jumelles échelonnées (Trent, Île d\'Iliya, Base de Bashim)', en:'Twin zones staggered (Trent, Iliya Island, Bashim Base)'}, fr:[
      {t:'change', sub:'zones', tx:'Ruines de Trent, Île d\'Iliya et Base de Bashim demandaient exactement le même PA/PD que leur zone jumelle du même palier (Repaire des Pirates, Colonie Sausan, Repaire Bandits Gahaz) — elles demandent désormais un peu plus, sans jamais dépasser la zone suivante du palier suivant. Le plafond de fin de jeu (320 PA / 175 PD, Ruines de Kratuga / Planque des Mânes / Forêt de Polly) reste inchangé'},
    ], en:[
      {t:'change', sub:'zones', tx:'Ruines de Trent, Iliya Island and Bashim Base required the exact same AP/DP as their twin zone in the same tier (Pirate Hideout, Sausan Colony, Gahaz Bandit Den) — they now require a bit more, never exceeding the next tier\'s opening zone. The endgame cap (320 AP / 175 DP, Kratuga Ruins / Manes\' Hideout / Polly Forest) stays unchanged'},
    ] },
  { v:'V233', d:'06/07/2026 18:44', name:{fr:'Loyalties récupérables, liste admin fiabilisée, reload Silver, notes de version', en:'Claimable Loyalty, fixed admin list, Silver reload, patch notes'}, fr:[
      {t:'fix', sub:'admin', severity:'major', tx:'La réinitialisation des quêtes de tous les joueurs (bouton Admin) était cassée depuis sa création — la fonction serveur associée n\'avait jamais réellement été mise en place. Corrigé'},
      {t:'fix', sub:'admin', severity:'major', tx:'La liste des joueurs du panneau Admin ne montrait que les comptes vérifiés — tout joueur en mode invité (même actif, avec une vraie progression) en était totalement absent. Elle inclut désormais tous les comptes, invités compris'},
      {t:'new', sub:'admin', tx:'L\'onglet Admin "Silver" a maintenant un bouton de rechargement pour rafraîchir le registre sans fermer/rouvrir tout le panneau'},
      {t:'change', sub:'economie', severity:'major', tx:'Les Loyalties gagnées chaque jour (200) ne sont plus ajoutées automatiquement à ton stock : elles s\'accumulent dans le courrier (sans limite, tant que non récupérées), et un bouton "Récupérer" les transfère vers ton stock réel — désormais affiché à côté du silver dans l\'inventaire'},
      {t:'change', sub:'interface', tx:'Les notes de version ne remontent plus en haut toutes seules quand une nouvelle version sort — la position de lecture reprend toujours exactement là où tu l\'avais laissée, à toi de remonter pour découvrir les nouveautés'},
    ], en:[
      {t:'fix', sub:'admin', severity:'major', tx:'Resetting everyone\'s quests (Admin button) had been broken since it was added — the associated server function had never actually been set up. Fixed'},
      {t:'fix', sub:'admin', severity:'major', tx:'The Admin panel\'s player list only showed verified accounts — any guest player (even active, with real progress) was completely absent from it. It now includes every account, guests included'},
      {t:'new', sub:'admin', tx:'The Admin "Silver" tab now has a reload button to refresh the ledger without closing/reopening the whole panel'},
      {t:'change', sub:'economie', severity:'major', tx:'The daily 200 Loyalty gain is no longer added to your stock automatically: it accumulates in the mailbox (no limit, until claimed), and a "Claim" button moves it to your real stock — now shown next to silver in the inventory'},
      {t:'change', sub:'interface', tx:'Patch notes no longer jump back to the top on their own when a new version ships — reading position always resumes exactly where you left it, you have to scroll up yourself to discover what\'s new'},
    ] },
  { v:'V232', d:'06/07/2026 18:07', name:{fr:'Vente intelligente (Équiper > Compendium > Vendre), rappel invité, flash XP, refonte panneau Admin', en:'Smart selling (Equip > Compendium > Sell), guest reminder, XP flash, Admin panel redesign'}, fr:[
      {t:'change', sub:'objets', severity:'major', tx:'Vendre un objet vérifie désormais dans l\'ordre : 1) s\'il est meilleur que ce qui est déjà équipé sur son emplacement, il est équipé au lieu d\'être vendu ; 2) sinon, s\'il doit rejoindre ou remplacer un exemplaire moins enchanté dans le sac protégé du Compendium, il y est déplacé au lieu d\'être vendu ; 3) seulement si aucun des deux cas ne s\'applique, il est réellement vendu. S\'applique quelle que soit l\'origine de la vente'},
      {t:'new', sub:'compte', tx:'Un joueur en mode invité reçoit désormais une notification lui rappelant que sa progression n\'est sauvegardée que sur cet appareil et l\'invitant à créer un compte (progression conservée) ou à se reconnecter à un compte existant'},
      {t:'new', sub:'interface', tx:'Le niveau et la barre d\'XP s\'illuminent brièvement à chaque gain d\'expérience'},
      {t:'change', sub:'admin', tx:'Le panneau Admin est réorganisé en onglets : Moi, Joueur précis (inclut désormais la gestion des rôles), Serveur, Stats'},
      {t:'fix', sub:'admin', tx:'Le bouton de test "Débloquer tous les succès" ne journalisait pas le silver gagné dans le registre (voir V231) — corrigé'},
    ], en:[
      {t:'change', sub:'objets', severity:'major', tx:'Selling an item now checks in order: 1) if it\'s better than what\'s currently equipped on its slot, it\'s equipped instead of sold; 2) otherwise, if it should join or replace a less-enhanced copy in the Compendium\'s protected bag, it\'s moved there instead of sold; 3) only if neither applies is it actually sold. Applies regardless of how the sale was triggered'},
      {t:'new', sub:'compte', tx:'A guest player now receives a notification reminding them that their progress is only saved on this device, inviting them to create an account (progress kept) or sign back into an existing one'},
      {t:'new', sub:'interface', tx:'The level and XP bar now briefly light up on every experience gain'},
      {t:'change', sub:'admin', tx:'The Admin panel is now organized into tabs: Me, Specific player (now includes role management), Server, Stats'},
      {t:'fix', sub:'admin', tx:'The "Unlock all achievements" test button wasn\'t logging the silver gained to the ledger (see V231) — fixed'},
    ] },
  { v:'V231', d:'06/07/2026 17:36', name:{fr:'Registre de silver détaillé (panneau Admin)', en:'Detailed silver ledger (Admin panel)'}, fr:[
      {t:'admin', tx:'L\'onglet Admin "Silver" affiche désormais un vrai registre : tableau par catégorie (loot, potions, ventes, quêtes, succès, marché...) avec gagné/dépensé/nombre de mouvements, et un graphique du flux net par heure sur 48h. Toute variation de silver passe désormais par un point d\'entrée unique côté client, journalisé individuellement ; les mouvements du Marché (achat/vente/remboursement, gérés côté serveur) sont journalisés directement en base'},
    ], en:[
      {t:'admin', tx:'The Admin "Silver" tab now shows a real ledger: a per-category table (loot, potions, sales, quests, achievements, market...) with gained/spent/transaction count, and an hourly net-flow graph over 48h. Every silver change now goes through a single client-side entry point, individually logged; Market movements (buy/sell/refund, server-side) are logged directly in the database'},
    ] },
  { v:'V230', d:'06/07/2026 17:16', name:{fr:'La protection Pierre de Cron est désormais désactivée par défaut', en:'Cron Stone protection is now disabled by default'}, fr:[
      {t:'change', sub:'systeme', tx:'L\'utilisation automatique des Pierres de Cron (protection contre une rétrogradation) est désormais désactivée par défaut sur un nouveau compte — active-la toi-même en cliquant sur la case Pierre de Cron du panneau Optimisation si tu la veux'},
    ], en:[
      {t:'change', sub:'systeme', tx:'Automatic use of Cron Stones (protection against downgrading) is now disabled by default on a new account — enable it yourself by clicking the Cron Stone slot in the Enhancement panel if you want it'},
    ] },
  { v:'V229', d:'06/07/2026 17:08', name:{fr:'Fix probable de l\'erreur 404 après inscription par email', en:'Likely fix for the 404 error after email signup'}, fr:[
      {t:'fix', sub:'authentification', severity:'major', tx:'La création de compte par email (et la liaison d\'un compte invité à un email) n\'indiquait jamais explicitement où revenir après confirmation — contrairement à la connexion Discord et à la réinitialisation de mot de passe, qui le faisaient déjà. Le lien de confirmation retombait donc sur l\'adresse par défaut configurée côté serveur au lieu de la page réellement visitée, ce qui pouvait mener à une page inexistante (404) après inscription. Corrigé : le lien de confirmation ramène désormais toujours vers la page d\'où l\'inscription a été lancée'},
    ], en:[
      {t:'fix', sub:'authentification', severity:'major', tx:'Email account creation (and linking a guest account to an email) never explicitly stated where to return after confirmation — unlike Discord sign-in and password reset, which already did. The confirmation link therefore fell back to the server-side default address instead of the page actually visited, which could lead to a non-existent page (404) after signing up. Fixed: the confirmation link now always leads back to the page signup was started from'},
    ] },
  { v:'V228', d:'06/07/2026 16:12', name:{fr:'Rétroactivité du stuff déjà possédé, fix couleur bijou (loot table), trésor à 0.22%', en:'Retroactivity for already-owned gear, jewelry color fix (loot table), treasure at 0.22%'}, fr:[
      {t:'fix', sub:'objets', severity:'major', tx:'Les stats de base et le prix de revente d\'une pièce d\'équipement/bijou étaient figés dès son drop, jamais mis à jour automatiquement — le passage aux stats fixes (V226) et à la revente réduite (V225) ne s\'appliquait donc qu\'aux nouveaux drops. Tout le stuff déjà possédé (équipé, dans le sac, ou dans le sac protégé) est désormais recalculé automatiquement avec les mêmes formules, sans toucher à l\'enchantement déjà investi'},
      {t:'fix', sub:'interface', tx:'Dans la table de loot d\'une zone, la ligne du bijou (dépliée) restait sans couleur de palier — corrigé, elle reprend maintenant la couleur comme le reste des lignes'},
      {t:'change', sub:'loot', tx:'Chance du "Bout du trésor de Velia" ajustée à 0.22% (était 0.33%)'},
    ], en:[
      {t:'fix', sub:'objets', severity:'major', tx:'A gear/jewelry piece\'s base stats and resale price were frozen at drop time, never updated automatically — the switch to fixed stats (V226) and reduced resale (V225) only applied to new drops. All already-owned gear (equipped, in bag, or in the protected bag) is now automatically recalculated with the same formulas, without touching already-invested enhancement'},
      {t:'fix', sub:'interface', tx:'In a zone\'s loot table, the jewelry row (expanded view) stayed without a tier color — fixed, it now matches the rest of the rows'},
      {t:'change', sub:'loot', tx:'"Bout du trésor de Velia" chance adjusted to 0.22% (was 0.33%)'},
    ] },
  { v:'V227', d:'06/07/2026 15:59', name:{fr:'Bandeau "en construction" sur l\'onglet Recommandations', en:'"Under construction" banner on the Recommendations tab'}, fr:[
      {t:'new', sub:'interface', tx:'L\'onglet "Recommandations" de la carte Statistiques affiche désormais un bandeau "en construction" — les calculs et la présentation sont encore amenés à évoluer'},
    ], en:[
      {t:'new', sub:'interface', tx:'The "Recommendations" tab of the Stats card now shows an "under construction" banner — calculations and presentation are still subject to change'},
    ] },
  { v:'V226', d:'06/07/2026 15:46', name:{fr:'Stats d\'équipement fixes (fini l\'aléatoire), tie-break "Équiper meilleur"', en:'Fixed gear stats (no more randomness), "Equip best" tie-break'}, fr:[
      {t:'change', sub:'objets', severity:'major', tx:'Les objets équipables (armure, armes) donnaient des stats avec ±15% d\'aléatoire au drop — 2 exemplaires du même palier/slot/zone pouvaient différer sans raison. Ils donnent désormais des stats FIXES, toujours identiques ; seul l\'enchantement fait ensuite varier la puissance réelle'},
      {t:'fix', sub:'objets', tx:'"Équiper le meilleur" : quand 2 pièces ont exactement le même socle (stats de base), la plus enchantée l\'emporte désormais toujours — avant, le choix pouvait tomber sur un jumeau moins monté simplement parce qu\'il était rencontré en premier dans le sac'},
    ], en:[
      {t:'change', sub:'objets', severity:'major', tx:'Equipable items (armor, weapons) rolled stats with ±15% randomness on drop — 2 copies of the same tier/slot/zone could differ for no reason. They now give FIXED stats, always identical; only enhancement makes actual power vary afterward'},
      {t:'fix', sub:'objets', tx:'"Equip best": when 2 pieces have the exact same base stats, the more enhanced one now always wins — before, the pick could land on a less-enhanced twin simply because it was encountered first in the bag'},
    ] },
  { v:'V225', d:'06/07/2026 15:38', name:{fr:'Le trash redevient la vraie source de revenu, bijoux dans le sac colorés', en:'Trash becomes the real income source again, jewelry in bag now colored'}, fr:[
      {t:'change', sub:'economie', severity:'major', tx:'Le silver/h "théorique" d\'une zone (voir onglet Recommandations) ne compte plus que le trash au sol — matériaux et bijoux sont des objets de PROGRESSION, pas une source de revenu régulière'},
      {t:'change', sub:'economie', severity:'major', tx:'Prix de revente du gear et des bijoux looté fortement réduit : un bijou valait jusqu\'à ~290× le trash de sa propre zone (35 000 silver contre 120), une pièce d\'armure jusqu\'à ~78×. Désormais ~20× pour un bijou et nettement moins pour le gear — un vrai bonus au drop, sans éclipser le farm de trash comme revenu principal'},
      {t:'change', sub:'interface', tx:'Les bijoux dans le sac principal ont désormais leur case bordée de la couleur de leur palier, comme le reste de l\'équipement'},
    ], en:[
      {t:'change', sub:'economie', severity:'major', tx:'A zone\'s "theoretical" silver/h (see Recommendations tab) now only counts ground trash — materials and jewelry are PROGRESSION items, not a regular income source'},
      {t:'change', sub:'economie', severity:'major', tx:'Resell price of looted gear and jewelry heavily reduced: a jewel used to be worth up to ~290× its own zone\'s trash (35,000 silver vs 120), an armor piece up to ~78×. Now ~20× for a jewel and notably less for gear — still a real bonus on drop, without eclipsing trash farming as the main income'},
      {t:'change', sub:'interface', tx:'Jewelry in the main bag now has its cell bordered with its tier color, like the rest of the gear'},
    ] },
  { v:'V224', d:'06/07/2026 15:29', name:{fr:'Tutoriel au premier ramassage d\'une Pierre de Cron', en:'Tutorial on first Cron Stone pickup'}, fr:[
      {t:'new', sub:'interface', tx:'Un petit tutoriel se lance automatiquement la toute première fois que tu ramasses une Pierre de Cron : explique qu\'elle protège ta pièce d\'équipement contre une rétrogradation, et qu\'elle s\'active/désactive en cliquant dessus'},
    ], en:[
      {t:'new', sub:'interface', tx:'A small tutorial now triggers automatically the very first time you pick up a Cron Stone: explains that it protects your gear piece from downgrading, and that it toggles on/off by clicking it'},
    ] },
  { v:'V223', d:'06/07/2026 15:24', name:{fr:'Carte Statistiques en onglets, menu d\'optimisation simplifié', en:'Tabbed Stats card, simplified enhancement menu'}, fr:[
      {t:'new', sub:'interface', tx:'La carte Statistiques se divise désormais en 2 onglets : "Perso" (contenu inchangé) et "Recommandations" (nouveau) — ce dernier affiche la meilleure zone théorique pour le silver/h, le XP/h et les kills/min, chacune cliquable pour s\'y rendre directement'},
      {t:'change', sub:'interface', tx:'Le menu déroulant d\'optimisation n\'affiche plus qu\'une seule statistique par palier (la principale de la pièce : PA pour arme/éveil/dague, PD pour casque/armure/gants/bottes) au lieu de cumuler PD+PV+Esquive sur la même ligne — le détail complet reste visible juste en dessous du menu'},
    ], en:[
      {t:'new', sub:'interface', tx:'The Stats card now splits into 2 tabs: "Personal" (unchanged content) and "Recommendations" (new) — the latter shows the best theoretical zone for silver/h, XP/h and kills/min, each clickable to travel there directly'},
      {t:'change', sub:'interface', tx:'The enhancement dropdown now only shows one stat per level (the piece\'s main one: AP for weapon/awakening/dagger, DP for helmet/armor/gloves/boots) instead of stacking DP+HP+Dodge on the same line — the full detail is still visible right below the menu'},
    ] },
  { v:'V222', d:'06/07/2026 15:09', name:{fr:'Prix des potions adouci (racine carrée au lieu du ratio linéaire)', en:'Potion prices softened (square root instead of linear ratio)'}, fr:[
      {t:'change', sub:'economie', severity:'major', tx:'Le prix des potions reste lié au revenu de la zone (toujours plus cher en zone difficile) mais beaucoup plus doux : la mise à l\'échelle passait de manière linéaire (jusqu\'à ×135 en zone 11), elle suit désormais une racine carrée (×~11.6 en zone 11) — le ratio linéaire supposait un revenu "idéal" qui ne tenait pas dès qu\'on est un peu sous-géré pour sa zone (plus de dégâts encaissés, donc plus de potions, sans le revenu supposé pour les payer)'},
    ], en:[
      {t:'change', sub:'economie', severity:'major', tx:'Potion prices stay tied to the zone\'s income (still pricier in harder zones) but much gentler: scaling used to be linear (up to ×135 in zone 11), it now follows a square root (×~11.6 in zone 11) — the linear ratio assumed an "ideal" income that didn\'t hold once you\'re a bit under-geared for your zone (more damage taken, so more potions, without the assumed income to pay for them)'},
    ] },
  { v:'V221', d:'06/07/2026 15:02', name:{fr:'Sac protégé : garde le PLUS enchanté (pas le +0), niveau visible partout', en:'Protected bag: keeps the MOST enhanced copy (not +0), level now visible everywhere'}, fr:[
      {t:'change', sub:'objets', tx:'Le sac protégé du Compendium garde désormais le PLUS ENCHANTÉ des exemplaires possédés d\'un type jamais monté en PEN, plutôt qu\'un simple +0 — un exemplaire plus enchanté trouvé dans le sac prend automatiquement sa place (l\'ancien, souvent un +0, revient dans le sac principal, jamais perdu)'},
      {t:'new', sub:'interface', tx:'Le niveau d\'enchantement (+1 à PEN) est désormais visible directement sur les cases du sac principal ET du sac protégé du Compendium, comme sur la poupée d\'équipement'},
    ], en:[
      {t:'change', sub:'objets', tx:'The Compendium\'s protected bag now keeps the MOST ENHANCED copy owned of a type never brought to PEN, rather than a plain +0 — a more enhanced copy found in the bag automatically takes its place (the old one, often a +0, goes back to the main bag, never lost)'},
      {t:'new', sub:'interface', tx:'The enhancement level (+1 to PEN) is now visible directly on cells in the main bag AND the Compendium\'s protected bag, just like on the equipment doll'},
    ] },
  { v:'V220', d:'06/07/2026 14:33', name:{fr:'Sac protégé Compendium : remplacement auto après une vente', en:'Compendium protected bag: auto-replacement after a sale'}, fr:[
      {t:'new', sub:'objets', tx:'Vendre individuellement ("Vendre 1") ta dernière copie d\'une pièce jamais montée en PEN ne la perd plus totalement : si une autre copie du même type traîne dans le sac, elle prend automatiquement sa place dans le sac protégé du Compendium — priorité à un exemplaire +0 (moins coûteux à immobiliser), sinon le premier exemplaire enchanté trouvé'},
    ], en:[
      {t:'new', sub:'objets', tx:'Selling your last copy of a piece never brought to PEN ("Sell 1") no longer loses it for good: if another copy of the same type is sitting in your bag, it automatically takes its place in the Compendium\'s protected bag — priority to a +0 copy (cheaper to set aside), otherwise the first enhanced copy found'},
    ] },
  { v:'V219', d:'06/07/2026 13:44', name:{fr:'Fix : plus d\'auto-potion payante à Velia (zone paisible)', en:'Fix: no more paid auto-potion in Velia (peaceful zone)'}, fr:[
      {t:'fix', sub:'economie', severity:'major', tx:'Une potion de vie ou de mana payante pouvait s\'auto-boire à Velia (zone paisible, aucun monstre) — typiquement juste après une mort, qui remet les PV à pile 50% (le seuil par défaut). Le silver était dépensé pour rien puisqu\'aucun combat ne s\'y déroule. Les auto-potions ne se déclenchent plus tant qu\'on est à Velia (la régénération passive de mana continue normalement)'},
    ], en:[
      {t:'fix', sub:'economie', severity:'major', tx:'A paid HP or mana potion could auto-trigger while in Velia (peaceful zone, no monsters) — typically right after a death, which resets HP to exactly 50% (the default threshold). Silver was spent for nothing since no combat happens there. Auto-potions no longer trigger while in Velia (passive mana regen still works normally)'},
    ] },
  { v:'V218', d:'06/07/2026 13:26', name:{fr:'Halo sur "Équiper meilleur", icône ⬆️ sur les zones et cases vides', en:'Highlight on "Equip best", ⬆️ icon on zones and empty slots'}, fr:[
      {t:'new', sub:'interface', tx:'Le bouton "⚡ Équiper meilleur" se met en évidence (pulsation dorée) dès qu\'un objet du sac est resté plus de 15 secondes sans être équipé alors qu\'il est réellement meilleur que la pièce actuelle — pour ne plus oublier un upgrade qui traîne'},
      {t:'new', sub:'interface', tx:'Icône ⬆️ ajoutée directement sur les lignes de la liste de zones (entre le PA/PD requis et le nombre de joueurs) : indique qu\'un meilleur socle t\'attend dans cette zone, tous équipements confondus'},
      {t:'change', sub:'interface', tx:'Les cases d\'équipement vides affichent désormais la même icône ⬆️ que les cases remplies (au lieu d\'un pin 📍 séparé) — un socle vide est par définition à améliorer, langage visuel unifié'},
    ], en:[
      {t:'new', sub:'interface', tx:'The "⚡ Equip best" button now highlights (gold pulse) as soon as a bag item has sat unequipped for more than 15 seconds while being genuinely better than the currently equipped piece — so a forgotten upgrade doesn\'t go unnoticed'},
      {t:'new', sub:'interface', tx:'⬆️ icon added directly on zone list rows (between required AP/DP and the player count): signals that a better piece awaits in that zone, across all gear slots'},
      {t:'change', sub:'interface', tx:'Empty equipment slots now show the same ⬆️ icon as filled ones (instead of a separate 📍 pin) — an empty slot is by definition something to upgrade, unified visual language'},
    ] },
  { v:'V217', d:'06/07/2026 13:14', name:{fr:'Fix icône ⬆️ : n\'apparaît que s\'il existe vraiment un meilleur stuff', en:'Fix ⬆️ icon: only shows when actually better gear exists'}, fr:[
      {t:'fix', sub:'interface', tx:'L\'icône ⬆️ pouvait s\'afficher même quand la pièce déjà équipée était du même palier (ou mieux) que la zone actuelle, donc sans rien de mieux à trouver. Elle ne s\'affiche désormais que si la pièce équipée est d\'un palier strictement inférieur à celui de la zone actuelle ET qu\'une zone sûre différente propose ce palier supérieur'},
    ], en:[
      {t:'fix', sub:'interface', tx:'The ⬆️ icon could show up even when the already-equipped piece was the same tier (or better) as the current zone, so there was nothing better to find. It now only shows if the equipped piece is a strictly lower tier than the current zone AND a different safe zone offers that higher tier'},
    ] },
  { v:'V216', d:'06/07/2026 13:08', name:{fr:'Fix icône ⬆️ : plus affichée si on est déjà dans l\'unique zone proposée', en:'Fix ⬆️ icon: no longer shown if already in the only proposed zone'}, fr:[
      {t:'fix', sub:'interface', tx:'L\'icône ⬆️ (zone pour améliorer) restait affichée même quand la seule zone sûre proposée était celle où le joueur se trouvait déjà — inutile de proposer d\'aller là où on est. Elle ne s\'affiche plus dans ce cas'},
    ], en:[
      {t:'fix', sub:'interface', tx:'The ⬆️ (zone to upgrade) icon stayed visible even when the only proposed safe zone was the one the player was already in — no point suggesting a trip there. It no longer shows in that case'},
    ] },
  { v:'V215', d:'06/07/2026 10:16', name:{fr:'Fix K.O. : les monstres n\'attaquent plus pendant le K.O., croix de déséquipement, cadre des bijoux', en:'K.O. fix: monsters stop attacking during K.O., unequip cross, jewelry frame color'}, fr:[
      {t:'fix', sub:'combat', severity:'major', tx:'Pendant le K.O. (à 0 PV, avant renvoi en zone paisible), les monstres continuaient de frapper : ça repoussait le décompte à chaque coup et retirait de l\'XP en boucle au lieu d\'une seule fois. Plus aucun monstre n\'attaque tant que tu es K.O.'},
      {t:'change', sub:'systeme', tx:'Si tu changes de zone pendant le K.O., la fin du décompte ne te renvoie plus de force à Velia — tu restes là où tu as choisi d\'aller'},
      {t:'new', sub:'interface', tx:'Croix ✕ en bas à droite de chaque pièce équipée pour la déséquiper en un clic (le double-clic existant fonctionne toujours)'},
      {t:'change', sub:'interface', tx:'Le cadre des bijoux équipés (bagues, collier, boucles, ceinture) reprend maintenant la couleur de leur palier'},
      {t:'change', sub:'interface', tx:'Sur les pièces d\'armure, le PD passe en bas à gauche (même position que le PA des autres pièces) ; les chiffres de PA/PD affichés sur l\'équipement sont agrandis'},
    ], en:[
      {t:'fix', sub:'combat', severity:'major', tx:'While K.O.\'d (0 HP, before being sent to the peaceful zone), monsters kept hitting: this reset the countdown on every hit and drained XP repeatedly instead of once. No monster can hit you anymore while K.O.\'d'},
      {t:'change', sub:'systeme', tx:'If you change zone while K.O.\'d, the end of the countdown no longer forces you back to Velia — you stay wherever you chose to go'},
      {t:'new', sub:'interface', tx:'✕ cross at the bottom-right of each equipped piece to unequip it in one click (the existing double-click still works)'},
      {t:'change', sub:'interface', tx:'The frame of equipped jewelry (rings, necklace, earrings, belt) now takes on their tier color'},
      {t:'change', sub:'interface', tx:'On armor pieces, DP moves to the bottom-left (same spot as AP on other pieces); the AP/DP numbers shown on gear are bigger'},
    ] },
  { v:'V214', d:'06/07/2026 10:05', name:{fr:'Icônes de case réorganisées, cadenas sur les slots sans source, fix sac', en:'Reorganized slot icons, lock on sourceless slots, bag fix'}, fr:[
      {t:'change', sub:'interface', tx:'Coin haut-droit des cases d\'équipement réorganisé : 🔧 (optimiser) en haut, ⬆️/📍/🔒 juste en dessous, plutôt que côte à côte'},
      {t:'change', sub:'interface', tx:'L\'icône ⬆️ (upgrade) d\'une case équipée ne s\'affiche désormais que s\'il existe une zone NON dangereuse où trouver mieux pour ce socle — plus d\'icône pointant vers une zone dangereuse'},
      {t:'new', sub:'interface', tx:'Cadenas 🔒 sur les 2 artéfacts et la pierre d\'équipement : ces 3 socles n\'ont encore aucune source en jeu, le cadenas l\'indique clairement au lieu d\'une case vide muette'},
      {t:'fix', sub:'inventaire', tx:'Dans le sac, la quantité (qty) et le PD affiché d\'un objet se superposaient (les deux étaient en bas à droite) — la quantité passe en haut à droite, les coins suivent maintenant la même logique que la poupée d\'équipement (équipé en haut à gauche, PA en bas à gauche, PD en bas à droite)'},
    ], en:[
      {t:'change', sub:'interface', tx:'Top-right corner of equipment slots reorganized: 🔧 (enhance) on top, ⬆️/📍/🔒 stacked right below it instead of side by side'},
      {t:'change', sub:'interface', tx:'The ⬆️ (upgrade) icon on an equipped slot now only shows if there is a NON-dangerous zone offering something better for that slot — no more icon pointing at a dangerous zone'},
      {t:'new', sub:'interface', tx:'🔒 lock icon on the 2 artifacts and the equipment stone: these 3 slots have no in-game source yet, the lock makes that clear instead of a silent empty slot'},
      {t:'fix', sub:'inventaire', tx:'In the bag, an item\'s quantity and its displayed DP overlapped (both bottom-right) — quantity moved to top-right, corners now follow the same logic as the equipment doll (equipped top-left, AP bottom-left, DP bottom-right)'},
    ] },
  { v:'V213', d:'06/07/2026 09:53', name:{fr:'Cases d\'équipement simplifiées : icônes ⬆️/📍 dédiées, clic = infos seulement', en:'Simplified equipment slots: dedicated ⬆️/📍 icons, click = info only'}, fr:[
      {t:'change', sub:'interface', tx:'Cliquer sur une case équipée n\'affiche plus que le nom et les stats de la pièce ; cliquer sur une case vide n\'affiche plus que le nom du slot et où le farmer (déséquiper reste au double-clic, optimiser reste sur le bouton 🔧)'},
      {t:'new', sub:'interface', tx:'Nouvelle icône ⬆️ en coin sur une case équipée : raccourci direct vers la zone où trouver une meilleure pièce pour ce socle'},
      {t:'new', sub:'interface', tx:'Nouvelle icône 📍 en coin sur une case vide : raccourci direct vers la zone où farmer l\'objet manquant'},
    ], en:[
      {t:'change', sub:'interface', tx:'Clicking an equipped slot now only shows the piece\'s name and stats; clicking an empty slot now only shows the slot name and where to farm it (unequip stays on double-click, enhance stays on the 🔧 button)'},
      {t:'new', sub:'interface', tx:'New ⬆️ corner icon on an equipped slot: direct shortcut to the zone where a better piece for that slot can be found'},
      {t:'new', sub:'interface', tx:'New 📍 corner icon on an empty slot: direct shortcut to the zone where the missing item can be farmed'},
    ] },
  { v:'V212', d:'06/07/2026 09:44', name:{fr:'Mode auto "jusqu\'au prochain gain", prix des potions par zone, trésor à 0.33%', en:'"Until next gain" auto mode, per-zone potion prices, treasure at 0.33%'}, fr:[
      {t:'change', sub:'loot', tx:'Chance du "Bout du trésor de Velia" ajustée à 0.33% (au lieu de 0.5%)'},
      {t:'new', sub:'optimisation', tx:'Nouveau mode d\'auto-optimisation : "Jusqu\'au prochain gain de PA/PD" — s\'arrête automatiquement dès que le PA ou le PD affiché de la pièce augmente réellement, sans avoir à deviner à quel palier précis ça se produit (voir le fix du menu déroulant de la mise à jour précédente)'},
      {t:'change', sub:'economie', severity:'major', tx:'Le prix des potions (vie et mana) suit désormais le revenu de base de la zone actuelle au lieu d\'être fixe partout — les prix affichés/débités restent calibrés sur Camp des Loups en tout début de jeu, puis augmentent avec la zone pour rester un coût cohérent avec le loot d\'or gagné là où on farme'},
    ], en:[
      {t:'change', sub:'loot', tx:'"Bout du trésor de Velia" chance adjusted to 0.33% (from 0.5%)'},
      {t:'new', sub:'optimisation', tx:'New auto-enhance mode: "Until the next AP/DP gain" — automatically stops as soon as the piece\'s displayed AP or DP actually increases, no more guessing which exact level that happens at (see the dropdown fix from the previous update)'},
      {t:'change', sub:'economie', severity:'major', tx:'Potion prices (HP and mana) now follow the current zone\'s base income instead of being flat everywhere — displayed/charged prices stay calibrated on Camp des Loups at the very start, then rise with the zone to remain a cost consistent with the gold looted where you\'re farming'},
    ] },
  { v:'V211', d:'06/07/2026 08:50', name:{fr:'Fix menu d\'optimisation : le gain de PA ne se répète plus sur plusieurs paliers', en:'Fix enhancement menu: the AP gain no longer repeats across several levels'}, fr:[
      {t:'fix', sub:'interface', tx:'Depuis le passage à l\'arrondi vers le bas (voir mise à jour précédente), le menu déroulant d\'optimisation pouvait afficher "(+1 PA)" identique sur 7 paliers d\'affilée (la fraction accumulée n\'avait pas encore franchi le point suivant) — donnait l\'impression d\'un gain figé. Le gain ne s\'affiche désormais qu\'au palier où il change réellement : "+1 PA" apparaît une seule fois, puis rien jusqu\'à "+2 PA" au prochain vrai palier'},
    ], en:[
      {t:'fix', sub:'interface', tx:'Since switching to round-down (see previous update), the enhancement dropdown could show the identical "(+1 AP)" across 7 levels in a row (the accumulated fraction hadn\'t crossed the next point yet) — looked like a frozen/stuck gain. The gain now only shows on the level where it actually changes: "+1 AP" appears once, then nothing until "+2 AP" at the next real milestone'},
    ] },
  { v:'V210', d:'06/07/2026 08:40', name:{fr:'PA/PD sans virgule, zone dangereuse = mort garantie en 100% des cas', en:'AP/DP without decimals, dangerous zone = guaranteed death 100% of the time'}, fr:[
      {t:'change', sub:'interface', tx:'Le PA/PD effectif affiché (stats, résumé équipement, menu d\'optimisation) est désormais un nombre entier, arrondi vers le BAS — jamais de virgule, et jamais plus que ce qui est réellement acquis'},
      {t:'change', sub:'combat', severity:'major', tx:'Zone DANGEREUSE : la mort est maintenant garantie à 100% dès le premier coup qui touche (plus de dégât insuffisant possible), l\'esquive automatique et la téléportation défensive sont désactivées, et TOUS les packs à moins de 400 unités s\'activent d\'un coup (pas seulement celui visé) — le badge représente désormais un risque de mort certaine et immédiate, pas probable'},
      {t:'new', sub:'systeme', tx:'5 tests de régression ajoutés pour ces 2 points (mort garantie sur 20 essais même avec un dégât brut quasi nul, aggro à distance, absence de décimale dans l\'affichage PA/PD)'},
    ], en:[
      {t:'change', sub:'interface', tx:'The displayed effective AP/DP (stats, gear summary, enhancement menu) is now a whole number, rounded DOWN — never a decimal, and never more than what\'s actually earned'},
      {t:'change', sub:'combat', severity:'major', tx:'DANGEROUS zone: death is now guaranteed 100% of the time on the very first hit that lands (no more insufficient-damage rolls), automatic dodge and the defensive teleport are disabled, and ALL packs within 400 units activate at once (not just the targeted one) — the badge now represents a certain, immediate death risk, not just a probable one'},
      {t:'new', sub:'systeme', tx:'5 regression tests added for these 2 points (guaranteed death over 20 trials even with near-zero raw mob damage, ranged aggro, no decimals in AP/DP display)'},
    ] },
  { v:'V209', d:'06/07/2026 08:20', name:{fr:'Le personnage change d\'apparence selon le stuff, potion vie+mana fusionnée', en:'Character appearance changes with gear, merged HP+mana potion'}, fr:[
      {t:'new', sub:'graphismes', tx:'L\'apparence du personnage (robe, chapeau, bâton) change désormais selon la couleur du meilleur palier de stuff équipé (arme ou armure) : gris/blanc restent sobres, vert et bleu ajoutent des cornes au chapeau, le palier bleu ajoute une cape. Si une pièce d\'éveil est équipée, 2 orbes flottent en orbite autour du personnage'},
      {t:'change', sub:'interface', tx:'Les 2 cases séparées de potion (vie / mana) sont fusionnées en une seule icône (fioles entrelacées) — un clic ouvre désormais un panneau unique listant les tailles de potion de vie ET les infos de la potion de mana, au lieu de 2 emplacements distincts'},
    ], en:[
      {t:'new', sub:'graphismes', tx:'The character\'s appearance (robe, hat, staff) now changes based on the color of the best equipped gear tier (weapon or armor): grey/white stay plain, green and blue add horns to the hat, blue adds a cape. If an awakening piece is equipped, 2 orbs float in orbit around the character'},
      {t:'change', sub:'interface', tx:'The 2 separate potion slots (HP / mana) are merged into a single icon (intertwined vials) — one click now opens a single panel listing HP potion sizes AND mana potion info, instead of 2 separate slots'},
    ] },
  { v:'V208', d:'06/07/2026 07:48', name:{fr:'PA des bijoux recalculé, stuff de Camp des Loups vraiment utile', en:'Jewelry AP recalculated, Wolf Camp gear actually useful'}, fr:[
      {t:'fix', sub:'equipements', severity:'major', tx:'Les PA donnés par un bijou (bague/collier/boucle/ceinture) étaient une valeur figée par zone, jamais recalculée depuis les rééquilibrages précédents — complètement désynchronisée du reste du stuff. Recalculés dynamiquement comme tout le reste (rétroactif sur les bijoux déjà en sac/équipés)'},
      {t:'change', sub:'equipements', tx:'Camp des Loups (1ère zone) : le stuff qu\'on y loot (casque, Bâton Naru, bagues) est désormais calibré sur la zone SUIVANTE plutôt que sur sa propre difficulté (volontairement basse pour rester jouable sans arme) — un casque+arme+2 bagues correctement enchantés (+12) donnaient 8.5 PA effectif (ZONE DANGEREUSE face à la zone suivante) ; ils en donnent maintenant 13 (ZONE DIFFICILE, plus DANGEREUSE)'},
      {t:'new', sub:'systeme', tx:'2 tests de régression ajoutés pour ce cas précis (AP des bijoux jamais figé à 0, stuff réaliste de Camp des Loups atteint la difficulté attendue face à la zone suivante)'},
    ], en:[
      {t:'fix', sub:'equipements', severity:'major', tx:'The AP granted by jewelry (ring/necklace/earring/belt) was a value frozen per zone, never recalculated through previous rebalances — completely out of sync with the rest of the gear. Now recalculated dynamically like everything else (retroactive on jewelry already in bag/equipped)'},
      {t:'change', sub:'equipements', tx:'Camp des Loups (1st zone): the gear looted there (helmet, Naru Staff, rings) is now calibrated against the NEXT zone rather than its own difficulty (deliberately low to stay playable weaponless) — a properly enhanced (+12) helmet+weapon+2 rings gave 8.5 effective AP (DANGEROUS ZONE against the next zone); they now give 13 (HARD ZONE, no longer dangerous)'},
      {t:'new', sub:'systeme', tx:'2 regression tests added for this exact case (jewelry AP never frozen at 0, a realistic Camp des Loups loadout reaches the expected difficulty against the next zone)'},
    ] },
  { v:'V207', d:'06/07/2026 07:08', name:{fr:'Suite de tests de régression (coulisses)', en:'Regression test suite (behind the scenes)'}, fr:[
      {t:'new', sub:'systeme', tx:'Ajout d\'une suite de tests de régression pour la progression PA/PD (monotonie des zones, ratios de transition de palier, génération des icônes, plafond de dégâts) — purement un outil de développement, invisible en jeu, sert à repérer automatiquement ce genre de régression avant qu\'un joueur ne la remarque (comme le fix de Camp Rhutum plus tôt aujourd\'hui)'},
    ], en:[
      {t:'new', sub:'systeme', tx:'Added a regression test suite for AP/DP progression (zone monotonicity, tier-transition ratios, icon generation, damage cap) — a pure development tool, invisible in-game, meant to catch this kind of regression automatically before a player notices it (like the Camp Rhutum fix earlier today)'},
    ] },
  { v:'V206', d:'06/07/2026 06:53', name:{fr:'Zone dangereuse = vrai risque de one-shot, ceinture redessinée, bijoux recolorés', en:'Dangerous zone = real one-shot risk, redesigned belt, recolored jewelry'}, fr:[
      {t:'change', sub:'combat', severity:'major', tx:'Marche arrière sur le plafond de dégâts ajouté plus tôt aujourd\'hui : en ZONE DANGEREUSE spécifiquement, les monstres peuvent de nouveau te tuer d\'un seul coup si le stuff est très en dessous du seuil — c\'est le vrai risque que ce badge doit représenter. Les autres zones (DIFFICILE et mieux) gardent le plafond de 30% des PV max cumulé sur 1s, pour ne jamais surprendre avec une mort instantanée quand le stuff n\'est QUE légèrement insuffisant'},
      {t:'new', sub:'graphismes', tx:'Nouvelle icône de ceinture dans le même style que le reste du set (sangle teintée par palier, boucle au contour coloré, rivets/gemmes de rareté)'},
      {t:'change', sub:'graphismes', tx:'Le contour des bagues, colliers et boucles d\'oreille reprend maintenant la couleur du palier (vert/bleu) au lieu d\'un contour sombre neutre'},
    ], en:[
      {t:'change', sub:'combat', severity:'major', tx:'Reverted the damage cap added earlier today: in DANGEROUS ZONES specifically, monsters can once again kill you in one hit if your gear is far below the threshold — that\'s the real risk this badge is meant to represent. Other zones (HARD and above) keep the 30% max-HP cap accumulated over 1s, so a merely slightly-insufficient gear never gets an instant-death surprise'},
      {t:'new', sub:'graphismes', tx:'New belt icon matching the rest of the set\'s style (tier-tinted strap, colored buckle outline, rarity rivets/gems)'},
      {t:'change', sub:'graphismes', tx:'Rings, necklaces, and earrings now show their tier color (green/blue) on their outline instead of a neutral dark outline'},
    ] },
  { v:'V205', d:'06/07/2026 06:41', name:{fr:'Fix one-shot en zone dangereuse, Bâton Naru exclusif à Camp des Loups', en:'Fix dangerous-zone one-shots, Naru Staff exclusive to Wolf Camp'}, fr:[
      {t:'fix', sub:'combat', severity:'major', tx:'En zone dangereuse, plusieurs loups d\'un même pack (ou de plusieurs packs agressifs à la fois) pouvaient chacun toucher au même instant : chaque coup individuel restait plafonné à 30% des PV max, mais l\'ensemble s\'additionnait en une fraction de seconde et équivalait à un one-shot. Le plafond de 30% s\'applique désormais aux dégâts TOTAUX encaissés sur 1 seconde glissante, plus par coup isolé'},
      {t:'change', sub:'equipements', tx:'Le Bâton Naru (arme de départ du palier gris) se loot désormais exclusivement à Camp des Loups (1ère zone du jeu) au lieu de Ruines de Protty — cohérent avec le spawn sans arme : la toute première zone donne directement de quoi se défendre'},
    ], en:[
      {t:'fix', sub:'combat', severity:'major', tx:'In dangerous zones, several wolves from the same pack (or from multiple aggressive packs at once) could each land a hit at the same instant: each individual hit stayed capped at 30% max HP, but they added up within a fraction of a second into an effective one-shot. The 30% cap now applies to TOTAL damage taken over a rolling 1-second window, not per isolated hit'},
      {t:'change', sub:'equipements', tx:'The Naru Staff (Grey tier\'s starting weapon) now drops exclusively from Camp des Loups (the game\'s very first zone) instead of Ruines de Protty — consistent with the weaponless spawn: the very first zone directly gives you something to defend yourself with'},
    ] },
  { v:'V204', d:'06/07/2026 06:34', name:{fr:'Fix : la PD de Camp Rhutum retombait sous la zone précédente', en:'Fix: Camp Rhutum\'s DP dropped below the previous zone'}, fr:[
      {t:'fix', sub:'zones', tx:'La PD requise de Camp Rhutum (1ère zone du palier Blanc) était passée à 20, sous les 23 PD de la zone précédente — une régression introduite par le rééquilibrage de la mise à jour précédente. Corrigée (24 PD), avec les zones suivantes du palier (Ferme Shultz, Colonie Sausan, Île d\'Iliya) réajustées en proportion'},
    ], en:[
      {t:'fix', sub:'zones', tx:'Camp Rhutum\'s (first White tier zone) required DP had dropped to 20, below the previous zone\'s 23 DP — a regression introduced by the previous update\'s rebalance. Fixed (24 DP), with the tier\'s following zones (Ferme Shultz, Colonie Sausan, Île d\'Iliya) adjusted proportionally'},
    ] },
  { v:'V203', d:'06/07/2026 06:29', name:{fr:'Plafond de stuff rehaussé à 320 PA, transitions de palier plus dures', en:'Gear ceiling raised to 320 AP, harder tier transitions'}, fr:[
      {t:'change', sub:'zones', severity:'major', tx:'Le plafond de PA requis en fin de jeu (Forêt de Polly) passe de 145 à 320 (PD : 156 → 175). Les paliers Blanc/Vert/Bleu sont recalibrés pour qu\'un stuff complet du palier précédent, poussé en moyenne à PRI, retrouve son rôle de vrai jalon de progression pour passer au palier suivant'},
      {t:'change', sub:'zones', tx:'Chaque transition vers un nouveau palier de couleur (zones 3, 6 et 9) est délibérément plus dure que la progression fluide à l\'intérieur d\'un palier — le ratio PA/PD retombe nettement à l\'entrée d\'un nouveau palier avant de remonter au fil de ses zones, pour bien marquer le cap'},
      {t:'change', sub:'equipements', tx:'Le palier Gris (zones de départ) n\'est pas concerné par ce rééquilibrage, déjà calé sur le spawn sans arme'},
    ], en:[
      {t:'change', sub:'zones', severity:'major', tx:'The end-game required AP ceiling (Forêt de Polly) goes from 145 to 320 (DP: 156 → 175). The White/Green/Blue tiers are recalibrated so a full previous-tier set, enhanced to PRI on average, is once again a real progression milestone for moving up a tier'},
      {t:'change', sub:'zones', tx:'Every move into a new color tier (zones 3, 6, and 9) is deliberately harder than the smooth progression within a tier — the AP/DP ratio drops noticeably right at the start of a new tier before climbing back up across its zones, to properly mark the milestone'},
      {t:'change', sub:'equipements', tx:'The Grey tier (starting zones) isn\'t affected by this rebalance, already tuned for the weaponless spawn'},
    ] },
  { v:'V202', d:'06/07/2026 06:02', name:{fr:'Nouveaux joueurs et notes de version, 3 nouveaux modes d\'optimisation auto, loupe sur le loot', en:'New players and patch notes, 3 new auto-enhance modes, loot magnifier'}, fr:[
      {t:'fix', sub:'ux', severity:'major', tx:'Un nouveau joueur voyait un nombre absurde de notes de version "non lues" (tout l\'historique jamais publié). Désormais, seule la toute dernière version compte comme nouvelle à la création du compte — sa page de notes de version s\'ouvre directement dessus, pas besoin de fouiller un historique qu\'il n\'a pas vécu'},
      {t:'new', sub:'optimisation', tx:'3 nouveaux modes pour l\'auto-optimisation, en plus de "jusqu\'à un palier" : "en boucle" (continue jusqu\'à rupture de matériau), "jusqu\'au premier échec" (s\'arrête dès le 1er raté), "jusqu\'à épuisement des Pierres de Cron" (pousse un palier risqué tant qu\'il reste de la protection)'},
      {t:'new', sub:'interface', tx:'Les icônes de la table de loot s\'agrandissent automatiquement au survol (aperçu façon loupe) pour mieux voir le détail de chaque pièce'},
      {t:'fix', sub:'interface', tx:'Filet de sécurité ajouté sur l\'inventaire et le sac protégé du Compendium : si jamais un objet équipable n\'a pas d\'icône propre (vieille sauvegarde), il retombe sur l\'icône générique de son emplacement au lieu d\'afficher une case vide'},
    ], en:[
      {t:'fix', sub:'ux', severity:'major', tx:'A new player saw an absurd number of "unread" patch notes (the entire history ever published). Now only the very latest version counts as new at account creation — their patch notes page opens straight on it, no need to dig through history they never lived through'},
      {t:'new', sub:'optimisation', tx:'3 new modes for auto-enhance, alongside "until a target level": "on loop" (keeps going until out of material), "until the first failure" (stops at the first miss), "until out of Cron Stones" (push a risky tier as long as protection remains)'},
      {t:'new', sub:'interface', tx:'Loot table icons now automatically zoom in on hover (magnifier-style preview) to see each piece\'s detail more clearly'},
      {t:'fix', sub:'interface', tx:'Safety net added to the inventory grid and the Compendium\'s protected bag: if an equippable item somehow has no icon of its own (old save), it now falls back to its slot\'s generic icon instead of showing an empty cell'},
    ] },
  { v:'V201', d:'06/07/2026 05:47', name:{fr:'Pierre de Cron cliquable, spawn sans arme, zones rééquilibrées', en:'Clickable Cron Stone, empty spawn, rebalanced zones'}, fr:[
      {t:'change', sub:'interface', tx:'La case Pierre de Cron du panneau d\'optimisation sert désormais elle-même de bouton on/off (clique dessus pour activer/désactiver) — grisée quand désactivée. Remplace l\'ancienne case à cocher séparée'},
      {t:'change', sub:'equipements', tx:'Le personnage ne spawn plus avec un "Bâton de Grunil" par défaut — l\'emplacement d\'arme principale démarre vide, comme tous les autres emplacements'},
      {t:'fix', sub:'zones', severity:'major', tx:'Le passage vers le palier de stuff suivant était devenu bien plus dur que prévu depuis qu\'une zone ne garantit plus qu\'UNE SEULE pièce d\'équipement : un stuff complet du palier précédent poussé jusqu\'à PRI ne donnait qu\'un ratio PA/PD de 0.29-0.45 (ZONE DANGEREUSE) face à la 1ère zone du palier suivant. Toutes les zones à partir de Camp Rhutum recalibrées pour qu\'un tel stuff PRI atteigne ~0.8 (ZONE DIFFICILE, plus DANGEREUSE)'},
      {t:'fix', sub:'zones', tx:'Camp des Loups (1ère zone du jeu) rééquilibrée suite au spawn sans arme : un personnage tout juste créé y tombait à 0.27 (ZONE DANGEREUSE) au lieu de ~0.93 avec l\'ancienne arme de départ'},
    ], en:[
      {t:'change', sub:'interface', tx:'The Cron Stone slot in the optimization panel now doubles as an on/off button (click it to enable/disable) — greyed out when disabled. Replaces the old separate checkbox'},
      {t:'change', sub:'equipements', tx:'The character no longer spawns with a default "Grunil Staff" — the main weapon slot now starts empty, like every other slot'},
      {t:'fix', sub:'zones', severity:'major', tx:'Moving up to the next gear tier had become far harder than intended since a zone now guarantees only ONE piece of gear: a full previous-tier set pushed to PRI only reached a 0.29-0.45 AP/DP ratio (DANGEROUS ZONE) against the next tier\'s first zone. Every zone from Camp Rhutum onward recalibrated so such a PRI set reaches ~0.8 (HARD ZONE, no longer dangerous)'},
      {t:'fix', sub:'zones', tx:'Camp des Loups (the game\'s very first zone) rebalanced following the weaponless spawn: a freshly created character dropped to a 0.27 ratio (DANGEROUS ZONE) there instead of ~0.93 with the old starter weapon'},
    ] },
  { v:'V200', d:'06/07/2026 05:24', name:{fr:'Les nouvelles icônes de stuff arrivent aussi dans la table de loot', en:'The new gear icons now show up in the loot table too'}, fr:[
      {t:'fix', sub:'interface', tx:'La table de loot (et le récapitulatif condensé des zones de Velia) affichait encore un glyphe générique (⚔️/💍) partagé par toutes les pièces d\'un même type — elle montre désormais la VRAIE icône de chaque pièce (casque, arme, bijou...), avec sa couleur et son ornementation de palier'},
    ], en:[
      {t:'fix', sub:'interface', tx:'The loot table (and the condensed Velia zone summary) still showed a generic shared glyph (⚔️/💍) for every piece of a given type — it now shows each piece\'s REAL icon, with its tier color and rarity ornamentation'},
    ] },
  { v:'V199', d:'06/07/2026 05:18', name:{fr:'Refonte complète du stuff : sorcier, ornements par rareté', en:'Full gear rework: wizard theme, rarity ornaments'}, fr:[
      {t:'new', sub:'graphismes', tx:'Toutes les icônes d\'équipement redessinées et alignées sur la classe sorcier : bâton (arme principale), dague (arme secondaire), deux sphères Aad en lévitation (éveil), casque à fente en Y, cuirasse cintrée à épaulières, gants griffus, bottes à genouillère, collier/bague/boucles d\'oreille à pendentif'},
      {t:'new', sub:'graphismes', tx:'Ornementation cohérente par rareté sur TOUTE pièce de stuff : rien au gris/blanc, 4 rivets au palier Vert (Yuria), 4 gemmes + 1 losange central au palier Bleu (Grunil)'},
      {t:'new', sub:'graphismes', tx:'Fond de case plus abouti selon la rareté (remplace le halo autour de l\'objet) : uni au gris, bandeau clair au blanc, teinte + coins marqués au vert, teinte + coins ornés de losanges au bleu'},
      {t:'change', sub:'equipements', tx:'Arme principale renommée Bâton (au lieu d\'Épée/Lame) sur les 4 paliers, pour coller au thème sorcier — aucun impact sur les statistiques'},
    ], en:[
      {t:'new', sub:'graphismes', tx:'Every equipment icon redrawn around the wizard theme: staff (main weapon), dagger (secondary weapon), two floating Aad spheres (awakening), Y-slit helmet, waisted cuirass with pauldrons, clawed gloves, greaved boots, pendant necklace/ring/earrings'},
      {t:'new', sub:'graphismes', tx:'Consistent rarity ornamentation on EVERY gear piece: none at grey/white, 4 rivets at Green tier (Yuria), 4 gems + 1 center diamond at Blue tier (Grunil)'},
      {t:'new', sub:'graphismes', tx:'More refined slot background by rarity (replaces the glow around the item): plain at grey, light banner at white, tinted with marked corners at green, tinted with ornate diamond corners at blue'},
      {t:'change', sub:'equipements', tx:'Main weapon renamed Staff (instead of Sword/Blade) across all 4 tiers to fit the wizard theme — no stat impact'},
    ] },
  { v:'V198', d:'06/07/2026 03:46', name:{fr:'Halo de couleur sur le stuff, pastille de notes déplacée dans le panneau', en:'Color halo on gear, unread badge moved into the panel'}, fr:[
      {t:'new', sub:'graphismes', tx:'Chaque pièce équipée (arme, armure, bijou...) et chaque emplacement du panneau d\'optimisation (pièce en cours, matériau, Pierre de Cron) affiche désormais un halo lumineux dans la couleur de son palier — même esprit que le halo de l\'orbe de Pierre de Cron'},
      {t:'change', sub:'interface', tx:'La pastille "notes non lues" en haut de l\'écran a été retirée — l\'appel à remonter est maintenant un bandeau directement en haut du panneau des notes de version, qui scrolle en un clic'},
    ], en:[
      {t:'new', sub:'graphismes', tx:'Every equipped piece (weapon, armor, jewelry...) and every optimization panel slot (piece being enhanced, material, Cron Stone) now shows a glowing halo in its tier color — same spirit as the Cron Stone orb\'s glow'},
      {t:'change', sub:'interface', tx:'The "unread notes" badge at the top of the screen was removed — the scroll-up prompt is now a banner right at the top of the patch notes panel itself, one click to jump up'},
    ] },
  { v:'V197', d:'06/07/2026 03:36', name:{fr:'Nouvelle icône Pierre de Cron (orbe turquoise)', en:'New Cron Stone icon (teal orb)'}, fr:[
      {t:'improve', sub:'graphismes', tx:'Icône de la Pierre de Cron redessinée en orbe turquoise lumineux façon perle (au lieu du sablier doré), couleur mise à jour partout (sac, table de loot, panneau d\'optimisation)'},
      {t:'fix', sub:'interface', severity:'minor', tx:'La case Pierre de Cron du panneau d\'optimisation affichait un sablier ⏳ générique figé — elle montre maintenant la vraie icône de l\'objet'},
    ], en:[
      {t:'improve', sub:'graphismes', tx:'Cron Stone icon redesigned as a glowing pearl-like teal orb (instead of the golden hourglass), color updated everywhere (bag, loot table, enhancement panel)'},
      {t:'fix', sub:'interface', severity:'minor', tx:'The Cron Stone slot in the enhancement panel showed a static generic ⏳ hourglass — it now shows the item\'s real icon'},
    ] },
  { v:'V196', d:'06/07/2026 03:31', name:{fr:'Fix pastille notes de version : plus de chevauchement, plus de scroll forcé', en:'Patch notes badge fix: no more overlap, no more forced scrolling'}, fr:[
      {t:'fix', sub:'interface', severity:'minor', tx:'La pastille "notes de version non lues" en haut de page chevauchait le panneau des notes de version lui-même — elle se masque désormais tant qu\'un panneau est ouvert, et réapparaît dès qu\'il se ferme'},
      {t:'fix', sub:'interface', tx:'Notes de version : s\'il reste des entrées non lues, le panneau s\'ouvre désormais tout en haut (où elles sont) au lieu de reprendre l\'ancienne position de défilement, qui les cachait en dessous — la reprise de position ne s\'applique qu\'une fois à jour'},
    ], en:[
      {t:'fix', sub:'interface', severity:'minor', tx:'The "unread patch notes" badge at the top of the page overlapped the patch notes panel itself — it now hides while any panel is open, and reappears as soon as it closes'},
      {t:'fix', sub:'interface', tx:'Patch notes: if unread entries remain, the panel now opens scrolled to the very top (where they are) instead of resuming the old scroll position, which hid them below — position resume only kicks in once caught up'},
    ] },
  { v:'V195', d:'06/07/2026 03:03', name:{fr:'Loot détaillé par zone, armes réparties sur les dernières zones, patch notes qui se souviennent de toi', en:'Detailed per-zone loot, weapons spread on the last zones, patch notes that remember you'}, fr:[
      {t:'fix', sub:'interface', severity:'minor', tx:'Fix : la table de loot affichait encore 0.1% pour la Pierre de Cron (l\'ancien taux, avant le passage à 1% de la mise à jour précédente) — un seul chiffre de référence désormais, ne peut plus se désynchroniser'},
      {t:'improve', sub:'interface', tx:'La table de loot indique maintenant exactement QUELLE pièce d\'équipement (casque/plastron/gants/bottes/arme précise) cette zone garantit, au lieu d\'une ligne générique "arme/armure (7 pièces)"'},
      {t:'change', sub:'equipements', severity:'major', tx:'Les 3 types d\'arme se répartissent maintenant sur les 3 DERNIÈRES zones de chaque palier (au lieu des 3 premières, avec la 4e qui répétait l\'arme principale) — la toute première zone d\'un palier n\'a donc plus aucune arme garantie, mais chaque type n\'apparaît plus qu\'une seule fois par palier'},
      {t:'new', sub:'interface', tx:'Notes de version : le défilement reprend exactement là où tu l\'as laissé à chaque ouverture, et une pastille en haut de la page indique combien de notes tu n\'as pas encore lues (en plus du numéro sur le bouton du menu) — ces deux pastilles ne disparaissent que quand tu as réellement fait défiler jusqu\'à ces entrées, pas juste en ouvrant le panneau'},
      {t:'new', sub:'tresors', tx:'Nouvelle étiquette "Trésors" pour les notes de version liées au Trésor de Velia'},
    ], en:[
      {t:'fix', sub:'interface', severity:'minor', tx:'Fix: the loot table still showed 0.1% for the Cron Stone (the old rate, before the previous update\'s move to 1%) — a single reference value now, can no longer drift out of sync'},
      {t:'improve', sub:'interface', tx:'The loot table now shows exactly WHICH gear piece (helmet/armor/gloves/boots/specific weapon) this zone guarantees, instead of a generic "weapon/armor (7 pieces)" line'},
      {t:'change', sub:'equipements', severity:'major', tx:'The 3 weapon types now spread across a tier\'s LAST 3 zones (instead of the first 3, with the 4th repeating the main weapon) — a tier\'s very first zone no longer has any guaranteed weapon, but each type now appears only once per tier'},
      {t:'new', sub:'interface', tx:'Patch notes: scrolling now resumes exactly where you left it every time you open the panel, and a badge at the top of the page shows how many notes you haven\'t read yet (alongside the number on the menu button) — both badges only disappear once you\'ve actually scrolled to those entries, not just from opening the panel'},
      {t:'new', sub:'tresors', tx:'New "Treasures" tag for patch notes related to the Velia Treasure'},
    ] },
  { v:'V194', d:'06/07/2026 02:47', name:{fr:'Badge NEW repensé (numéro, par joueur, met en évidence le changement)', en:'Redesigned NEW badge (number, per-player, highlights the change)'}, fr:[
      {t:'change', sub:'interface', tx:'Le badge "NEW" clignotant (24h pour tout le monde) remplacé par un badge numéroté "1" qui disparaît dès que TOI tu ouvres le panneau — et le changement précis est mis en évidence en haut du panneau (Wiki/Compendium/Codex/Succès) tant que tu ne l\'as pas encore vu'},
      {t:'fix', sub:'interface', severity:'minor', tx:'Corrigé un bug qui empêchait le badge de jamais disparaître (comparaison à une date qui pouvait tomber dans le futur par rapport à l\'horloge réelle) — remplacé par un simple compteur, plus fiable'},
    ], en:[
      {t:'change', sub:'interface', tx:'The blinking "NEW" badge (24h for everyone) replaced by a numbered "1" badge that disappears as soon as YOU open the panel — and the specific change is highlighted at the top of the panel (Wiki/Compendium/Codex/Achievements) until you\'ve seen it'},
      {t:'fix', sub:'interface', severity:'minor', tx:'Fixed a bug that could keep the badge showing forever (comparison against a date that could fall in the future relative to the real clock) — replaced with a simple counter, more reliable'},
    ] },
  { v:'V193', d:'06/07/2026 02:27', name:{fr:'1 pièce d\'armure garantie par zone, armures sans AP, Pierre de Cron au choix, Bout de Velia simplifié', en:'1 guaranteed armor piece per zone, armor with no AP, choosable Cron Stone, simplified Velia piece'}, fr:[
      {t:'change', sub:'equipements', severity:'major', tx:'Chaque zone garantit désormais 1 seule pièce d\'armure précise (casque/armure/gants sur les 3 premières zones du palier, bottes sur la 4e) au lieu d\'un tirage au hasard partagé entre les 4 zones — même logique que les armes'},
      {t:'change', sub:'equipements', severity:'major', tx:'Les armures ne donnent plus d\'AP (comme dans le vrai jeu, purement défensif) — le total AP retiré est redistribué aux 3 armes pour que le total AP d\'un stuff complet reste identique. Rétroactif sur le stuff déjà possédé'},
      {t:'change', sub:'equipements', tx:'Pierre de Cron : taux relevé à 1% (au lieu de 0.1%), et son utilisation passe au choix du joueur — nouvelle case à droite du matériau chargé (panneau Optimisation) avec une case à cocher "Utiliser la Pierre de Cron si dispo", au lieu d\'une consommation 100% automatique et silencieuse'},
      {t:'change', sub:'pve', tx:'"Bout du trésor de Velia" : les 2 objets séparés fusionnés en 1 seul, taux fixe à 0.5%, 1 à 3 unités par ramassage'},
    ], en:[
      {t:'change', sub:'equipements', severity:'major', tx:'Every zone now guarantees exactly 1 specific armor piece (helmet/armor/gloves on the tier\'s first 3 zones, boots on the 4th) instead of a random pick shared across the tier\'s 4 zones — same logic as weapons'},
      {t:'change', sub:'equipements', severity:'major', tx:'Armor no longer grants AP (purely defensive, like the real game) — the removed AP total is redistributed to the 3 weapons so a full set\'s total AP stays the same. Retroactive on gear you already own'},
      {t:'change', sub:'equipements', tx:'Cron Stone: drop rate raised to 1% (from 0.1%), and its use is now the player\'s choice — new slot to the right of the loaded material (Enhancement panel) with a "Use Cron Stone if available" checkbox, instead of a fully automatic, silent consumption'},
      {t:'change', sub:'pve', tx:'"Velia Treasure Piece": the 2 separate items merged into 1, fixed 0.5% rate, 1 to 3 units per pickup'},
    ] },
  { v:'V192', d:'06/07/2026 02:15', name:{fr:'Fix meute en zone dangereuse, sac plein qui bloquait le farm, Craft déplacé dans l\'Inventaire', en:'Dangerous zone pack pile-up fix, full-bag freeze fix, Craft moved into Inventory'}, fr:[
      {t:'fix', sub:'pve', severity:'major', tx:'Un groupe de monstres engagé restait accroché pour toujours (jamais de désengagement), y compris en dehors de tout combat actif — en zone dangereuse (monstres plus rapides, toi plus lent), plusieurs groupes abandonnés finissaient par te rattraper en même temps qu\'un autre déjà engagé et faisaient meute. Un groupe trop éloigné (>550) abandonne maintenant la poursuite'},
      {t:'fix', sub:'interface', severity:'major', tx:'Sac plein : le personnage restait bloqué à suivre indéfiniment un objet au sol qu\'il ne pouvait plus ramasser, au lieu de continuer à combattre comme prévu — il abandonne maintenant cet objet précis après un court délai et repart chercher le prochain groupe'},
      {t:'change', sub:'interface', tx:'Le panneau de craft du Trésor de Velia déplacé de la carte Optimisation vers la carte Inventaire, accessible via un nouveau bouton "Assemblage" en haut (à côté d\'"Inventaire")'},
    ], en:[
      {t:'fix', sub:'pve', severity:'major', tx:'An engaged monster pack stayed aggroed forever (never disengaged), even outside of any active fight — in a dangerous zone (faster monsters, slower you), several abandoned packs would end up catching up to you at the same time as another already-engaged one, piling on. A pack too far away (>550) now gives up the chase'},
      {t:'fix', sub:'interface', severity:'major', tx:'Full bag: the character got stuck endlessly following a ground item it could no longer pick up, instead of continuing to fight as intended — it now abandons that specific item after a short delay and goes back to looking for the next pack'},
      {t:'change', sub:'interface', tx:'The Velia Treasure crafting panel moved from the Enhancement card to the Inventory card, accessible via a new "Craft" button up top (next to "Inventory")'},
    ] },
  { v:'V191', d:'06/07/2026 02:03', name:{fr:'Optimisations contre le ralentissement sur session longue', en:'Optimizations against long-session slowdown'}, fr:[
      {t:'fix', sub:'interface', severity:'major', tx:'Réduction de charge après un signalement de ralentissement système sur des sessions de plusieurs heures : le rendu (canvas + simulation) est désormais mis en pause quand l\'onglet est en arrière-plan, et le recalcul de hauteur des cartes (ajouté par erreur à chaque battement du HUD, potentiellement plusieurs fois par seconde) ne se déclenche plus qu\'au vrai changement de zone/inventaire'},
      {t:'fix', sub:'equipements', severity:'minor', tx:'Garde-fou : l\'optimisation automatique ne peut plus jamais empiler 2 minuteurs en parallèle'},
    ], en:[
      {t:'fix', sub:'interface', severity:'major', tx:'Reduced load after a report of system-wide slowdown on multi-hour sessions: rendering (canvas + simulation) now pauses when the tab is in the background, and the card-height recalculation (mistakenly added on every HUD tick, potentially several times per second) now only fires on an actual zone/inventory change'},
      {t:'fix', sub:'equipements', severity:'minor', tx:'Safety net: auto-enhancement can no longer ever stack 2 timers in parallel'},
    ] },
  { v:'V190', d:'06/07/2026 01:50', name:{fr:'Badge NEW sur contenu modifié, carré unique en ligne/inscrits, niveau à côté de la vie', en:'NEW badge on updated content, single online/registered box, level next to HP'}, fr:[
      {t:'new', sub:'interface', tx:'Badge "NEW" clignotant pendant 24h sur Wiki/Compendium/Codex/Succès après une modification de contenu, visible pour tout le monde (pas besoin de l\'avoir déjà vu ou pas)'},
      {t:'change', sub:'interface', severity:'minor', tx:'"En ligne" et "Inscrits" fusionnés dans un seul carré (au lieu de 2 boîtes empilées séparément)'},
      {t:'change', sub:'interface', tx:'Niveau et % d\'XP réalignés à côté de la barre de vie (au lieu d\'au-dessus)'},
    ], en:[
      {t:'new', sub:'interface', tx:'Blinking "NEW" badge for 24h on Wiki/Compendium/Codex/Achievements after a content update, visible to everyone (no need to have seen it or not)'},
      {t:'change', sub:'interface', severity:'minor', tx:'"Online" and "Registered" merged into a single box (instead of 2 separately stacked boxes)'},
      {t:'change', sub:'interface', tx:'Level and XP % realigned next to the HP bar (instead of above it)'},
    ] },
  { v:'V189', d:'06/07/2026 01:31', name:{fr:'Cartes alignées sur Statistiques, loot normal si overstuff, niveau sur la ligne PA/PD/GS', en:'Cards aligned to Stats, normal loot when overgeared, level on the AP/DP/GS line'}, fr:[
      {t:'fix', sub:'interface', tx:'"Zones de farm" et "Loot de cette zone" font désormais exactement la même hauteur que "Statistiques" (au lieu d\'un plafond fixe de 60% d\'écran sans rapport) — le surplus de contenu défile toujours en interne'},
      {t:'change', sub:'pve', severity:'major', tx:'Loot : plus de bonus (+10%) ni de malus anti-overfarm au-delà du 100% adapté à la zone — un stuff insuffisant reste pénalisé (jusqu\'à -70%), mais un stuff adapté OU largement overstuff donne désormais toujours un loot normal'},
      {t:'improve', sub:'interface', tx:'Niveau et % d\'XP ajoutés sur la même ligne que PA/PD/GS dans la carte Équipement'},
    ], en:[
      {t:'fix', sub:'interface', tx:'"Farming zones" and "Loot in this zone" now match "Statistics" height exactly (instead of a fixed 60% screen cap unrelated to it) — extra content still scrolls internally'},
      {t:'change', sub:'pve', severity:'major', tx:'Loot: no more +10% bonus nor anti-overfarm penalty beyond the 100% adapted-to-zone baseline — insufficient gear still gets penalized (up to -70%), but adapted OR heavily overgeared now always gives normal loot'},
      {t:'improve', sub:'interface', tx:'Level and XP % added to the same line as AP/DP/GS in the Equipment card'},
    ] },
  { v:'V188', d:'06/07/2026 01:20', name:{fr:'Plafond de dégâts par coup, screenshot admin, alignement joueurs par zone', en:'Per-hit damage cap, admin player screenshot, zone player count alignment'}, fr:[
      {t:'fix', sub:'pve', severity:'major', tx:'En zone très dangereuse, un coup pouvait carrément one-shot (vérifié : 544 dégâts pour 478 PV max) — les dégâts par coup sont désormais plafonnés à 30% des PV max, garantissant au moins ~3-4 coups pour mourir depuis la vie pleine, même dans le pire des cas'},
      {t:'new', sub:'comptes', tx:'Admin : bouton "📸 Screenshot" à côté du champ UUID — affiche l\'équipement et l\'inventaire d\'un joueur en lecture seule (aucune modification), en plus du reset ciblé déjà existant'},
      {t:'fix', sub:'interface', severity:'minor', tx:'Le badge 👥 (joueurs sur la zone) réserve maintenant toujours la même largeur : le bouton 👁 ne bouge plus d\'une ligne à l\'autre selon qu\'il y ait ou non des joueurs présents'},
    ], en:[
      {t:'fix', sub:'pve', severity:'major', tx:'In a very dangerous zone, a single hit could straight up one-shot (verified: 544 damage for 478 max HP) — per-hit damage is now capped at 30% of max HP, guaranteeing at least ~3-4 hits to die from full health, even in the worst case'},
      {t:'new', sub:'comptes', tx:'Admin: "📸 Screenshot" button next to the UUID field — shows a player\'s gear and inventory read-only (no changes made), alongside the existing targeted reset'},
      {t:'fix', sub:'interface', severity:'minor', tx:'The 👥 badge (players on the zone) now always reserves the same width: the 👁 button no longer shifts between rows depending on whether players are present'},
    ] },
  { v:'V187', d:'06/07/2026 01:07', name:{fr:'Nombre de joueurs déplacé à côté de l\'œil de loot', en:'Player count moved next to the loot eye'}, fr:[
      {t:'change', sub:'interface', severity:'minor', tx:'Le badge 👥 (joueurs sur la zone) est maintenant affiché juste à gauche du bouton 👁 (voir le loot), au lieu de juste après le badge de difficulté'},
    ], en:[
      {t:'change', sub:'interface', severity:'minor', tx:'The 👥 badge (players on the zone) now shows just left of the 👁 (view loot) button, instead of right after the difficulty badge'},
    ] },
  { v:'V186', d:'06/07/2026 01:05', name:{fr:'% d\'XP aussi gros que le niveau', en:'XP % as big as the level'}, fr:[
      {t:'improve', sub:'interface', severity:'minor', tx:'Le % d\'XP au-dessus de la barre de vie est maintenant aussi gros que le niveau (au lieu de petit en dessous)'},
    ], en:[
      {t:'improve', sub:'interface', severity:'minor', tx:'The XP % above the HP bar is now as big as the level (instead of small underneath)'},
    ] },
  { v:'V185', d:'06/07/2026 01:02', name:{fr:'Carte Statistiques sans espace vide', en:'Stats card without empty space'}, fr:[
      {t:'fix', sub:'interface', severity:'minor', tx:'La carte "Statistiques" s\'étirait elle aussi pour matcher la hauteur de ses voisines de rangée (Zones de farm/Loot), laissant un vide sous ses dernières lignes — suit maintenant sa propre hauteur de contenu, comme les 2 autres cartes de la rangée'},
    ], en:[
      {t:'fix', sub:'interface', severity:'minor', tx:'The "Statistics" card also stretched to match its row neighbors\' height (Farming zones/Loot), leaving empty space under its last rows — now follows its own content height, like the other 2 cards in the row'},
    ] },
  { v:'V184', d:'06/07/2026 00:51', name:{fr:'Joueurs par zone, niveau agrandi façon BDO, cartes sans espace vide, fix potion silencieuse', en:'Players per zone, BDO-style bigger level, no-empty-space cards, silent potion fix'}, fr:[
      {t:'new', sub:'interface', tx:'Nombre de joueurs actuellement présents affiché (👥 N) sur chaque zone de la liste de farm, masqué si personne n\'y est'},
      {t:'fix', sub:'interface', severity:'minor', tx:'Les cartes "Zones de farm" et "Loot de cette zone" s\'étiraient pour matcher la hauteur de leurs voisines de rangée, laissant un grand vide sous une liste courte — elles suivent maintenant leur propre contenu (toujours plafonnées avec défilement au-delà)'},
      {t:'fix', sub:'combat', severity:'major', tx:'Une potion (PV ou mana) sans assez de silver pour la payer échouait totalement en silence (aucun soin, aucun message) — un avertissement "Pas assez de silver pour la potion !" s\'affiche désormais, remarqué en zone dangereuse où ça pouvait ressembler à une potion cassée'},
      {t:'improve', sub:'interface', tx:'Niveau agrandi façon BDO au-dessus de la barre de vie (gros chiffre blanc), le % d\'XP reste petit juste en dessous'},
    ], en:[
      {t:'new', sub:'interface', tx:'Number of players currently in each zone shown (👥 N) in the farming zone list, hidden if nobody is there'},
      {t:'fix', sub:'interface', severity:'minor', tx:'The "Farming zones" and "Loot in this zone" cards stretched to match their row neighbors\' height, leaving a big empty gap under a short list — they now follow their own content instead (still capped with scrolling beyond that)'},
      {t:'fix', sub:'combat', severity:'major', tx:'A potion (HP or mana) without enough silver to pay for it used to fail completely silently (no heal, no message) — a "Not enough silver for a potion!" warning now shows, especially noticeable in dangerous zones where it could look like a broken potion'},
      {t:'improve', sub:'interface', tx:'BDO-style bigger level shown above the HP bar (large white number), XP % stays small right below'},
    ] },
  { v:'V183', d:'06/07/2026 00:39', name:{fr:'Palier PRI relevé pour sortir de zone dangereuse au changement de couleur', en:'PRI tier raised to escape dangerous zone at color-tier change'}, fr:[
      {t:'change', sub:'equipements', severity:'minor', tx:'Bonus du palier PRI relevé (+8% → +20%) : un stuff complet moyen-PRI (mix PEN/+10 possible) sort désormais de ZONE DANGEREUSE sur la 1ère zone du palier de couleur suivant, au lieu d\'y rester bloqué. Ne change rien pour +0 à +15 ni pour l\'équilibre sur sa propre zone (déjà bon) — rétroactif automatiquement sur tout le stuff déjà équipé/en sac, aucune migration nécessaire'},
    ], en:[
      {t:'change', sub:'equipements', severity:'minor', tx:'PRI tier bonus raised (+8% → +20%): a full average-PRI set (mixing PEN/+10 is fine) now escapes DANGEROUS ZONE on the next color tier\'s first zone, instead of staying stuck there. Nothing changes for +0 to +15 or for balance on its own zone (already fine) — automatically retroactive on all already-equipped/bagged gear, no migration needed'},
    ] },
  { v:'V182', d:'06/07/2026 00:25', name:{fr:'Chat anglais, reset admin par UUID, Marché marqué "en construction"', en:'English chat, admin reset by UUID, Market flagged "under construction"'}, fr:[
      {t:'new', sub:'interface', tx:'Nouveau canal de chat 🇬🇧 Anglais, séparé du canal Mondial'},
      {t:'new', sub:'comptes', tx:'Admin : nouvelle action pour réinitialiser le compte d\'UN joueur précis par UUID (silver/équipement/niveau/sac), sans toucher aux autres — même message d\'explication que le reset global, mais montré uniquement à ce joueur'},
      {t:'change', sub:'interface', tx:'Marché : bandeau "en construction, encore peu fonctionnel" ajouté dans le panneau et le Wiki, pour que ce ne soit pas pris pour une fonctionnalité stable'},
    ], en:[
      {t:'new', sub:'interface', tx:'New 🇬🇧 English chat channel, separate from the World channel'},
      {t:'new', sub:'comptes', tx:'Admin: new action to reset ONE specific player\'s account by UUID (silver/gear/level/bag), without touching anyone else — same explanation message as the global reset, but shown only to that player'},
      {t:'change', sub:'interface', tx:'Market: "under construction, still not very functional" banner added to the panel and the Wiki, so it isn\'t mistaken for a stable feature'},
    ] },
  { v:'V181', d:'06/07/2026 00:13', name:{fr:'Halo "où farmer" sur socle vide, niveau/XP déplacé au-dessus de la vie', en:'"Where to farm" halo on empty slots, level/XP moved above HP'}, fr:[
      {t:'new', sub:'equipements', tx:'Clique un socle d\'équipement vide : la ou les zones qui lootent cet objet s\'illuminent d\'un halo doré dans la liste des zones (+ bouton téléportation directe). Une zone dangereuse pour ton stuff actuel n\'est proposée que s\'il n\'existe vraiment aucune alternative plus sûre'},
      {t:'change', sub:'interface', tx:'Niveau et % d\'XP déplacés au-dessus de la barre de vie (en bas à gauche), retirés de la carte Inventaire'},
    ], en:[
      {t:'new', sub:'equipements', tx:'Click an empty equipment slot: the zone(s) that drop that item light up with a gold halo in the zone list (+ a direct teleport button). A zone too dangerous for your current gear is only suggested if there\'s truly no safer alternative'},
      {t:'change', sub:'interface', tx:'Level and XP % moved above the HP bar (bottom-left), removed from the Inventory card'},
    ] },
  { v:'V180', d:'05/07/2026 23:28', name:{fr:'Carte de loot plafonnée avec défilement', en:'Loot card capped with scrolling'}, fr:[
      {t:'fix', sub:'interface', severity:'minor', tx:'La carte "Loot dans cette zone" (notamment la vue condensée de toutes les zones à Velia) pouvait déborder largement sous les cartes voisines — plafonnée avec un défilement interne, comme la liste des zones (V178)'},
    ], en:[
      {t:'fix', sub:'interface', severity:'minor', tx:'The "Loot in this zone" card (especially the condensed all-zones view at Velia) could overflow well below the neighboring cards — capped with internal scrolling, like the zone list (V178)'},
    ] },
  { v:'V179', d:'05/07/2026 23:12', name:{fr:'Système de mana, barre d\'incantation repensée, zone dangereuse durcie', en:'Mana system, redesigned cast bar, harsher dangerous zone'}, fr:[
      {t:'new', sub:'competences', tx:'Ajout de la mana : chaque sort a désormais un coût, une régénération passive, et une potion de mana (auto-bue sous 30%) vient compléter la potion de PV'},
      {t:'improve', sub:'interface', tx:'Barre d\'incantation repensée : affichée près de la barre de sorts (plus au-dessus du personnage), la matière se retire des 2 côtés vers le centre — le sort part quand elle a entièrement disparu'},
      {t:'change', sub:'interface', tx:'Barre de PV retirée d\'au-dessus du personnage, ne reste plus qu\'en bas à gauche (où une barre de mana l\'accompagne désormais)'},
      {t:'change', sub:'pve', severity:'major', tx:'Zone dangereuse : le ralenti du joueur et l\'accélération des monstres sont durcis (×0,5 et ×1,7 au lieu de ×0,7/×1,35), et un message d\'avertissement s\'affiche tant qu\'on y reste'},
    ], en:[
      {t:'new', sub:'competences', tx:'Added mana: every skill now has a cost and passive regeneration, and a mana potion (auto-drunk under 30%) joins the HP potion'},
      {t:'improve', sub:'interface', tx:'Redesigned cast bar: now shown near the skill bar (no longer above the character), material recedes from both sides toward the center — the spell fires once it has fully disappeared'},
      {t:'change', sub:'interface', tx:'HP bar removed from above the character, only remains bottom-left (now joined by a mana bar)'},
      {t:'change', sub:'pve', severity:'major', tx:'Dangerous zone: player slowdown and monster speedup are harsher (×0.5 and ×1.7 instead of ×0.7/×1.35), and a warning message shows while you stay there'},
    ] },
  { v:'V178', d:'05/07/2026 22:57', name:{fr:'Liste des zones plafonnée avec défilement', en:'Zone list capped with scrolling'}, fr:[
      {t:'fix', sub:'interface', severity:'minor', tx:'La liste des zones de farm (16 depuis l\'ajout des boucles d\'oreille) débordait largement sous les cartes voisines au lieu de s\'arrêter et défiler — plafonnée avec un défilement interne'},
    ], en:[
      {t:'fix', sub:'interface', severity:'minor', tx:'The farming zone list (16 since the earring update) overflowed well below the neighboring cards instead of stopping and scrolling — capped with internal scrolling'},
    ] },
  { v:'V177', d:'05/07/2026 22:48', name:{fr:'Zone dangereuse : toi plus lent, les monstres plus rapides', en:'Dangerous zone: you slower, monsters faster'}, fr:[
      {t:'change', sub:'pve', severity:'major', tx:'En ZONE DANGEREUSE (PA/PD très insuffisants), tu es maintenant ralenti (×0,7) et les monstres qui t\'ont repéré deviennent plus rapides (×1,35) pour te rattraper — rend le danger concret plutôt qu\'une simple pénalité de dégâts/loot invisible'},
    ], en:[
      {t:'change', sub:'pve', severity:'major', tx:'In a DANGEROUS ZONE (very insufficient AP/DP), you are now slowed down (×0.7) and monsters that spotted you become faster (×1.35) to catch up — makes the danger tangible instead of just an invisible damage/loot penalty'},
    ] },
  { v:'V176', d:'05/07/2026 22:36', name:{fr:'Menu d\'optimisation détaillé, navigation clavier dans le chat, alerte de mention en continu', en:'Detailed enhance menu, chat keyboard navigation, continuous mention alert'}, fr:[
      {t:'improve', sub:'equipements', severity:'minor', tx:'Le menu déroulant "Auto jusqu\'à" affiche maintenant le gain de stats pour CHAQUE palier proposé, pas seulement celui sélectionné'},
      {t:'improve', sub:'interface', severity:'minor', tx:'Chat : les flèches ↑/↓ du clavier permettent de choisir un joueur dans la liste de suggestions de mention @'},
      {t:'improve', sub:'interface', tx:'L\'alerte de mention (couleur + vibration + agrandissement du chat replié) tourne maintenant en continu tant que le chat n\'est pas ouvert, au lieu de s\'arrêter après 3 répétitions'},
      {t:'fix', sub:'interface', severity:'minor', tx:'Une mention @joueur s\'affiche désormais en couleur pour TOUT le monde dans le chat, même si la personne mentionnée n\'est plus en ligne au moment où le message est affiché'},
    ], en:[
      {t:'improve', sub:'equipements', severity:'minor', tx:'The "Auto to" dropdown now shows the stat gain for EVERY tier offered, not just the selected one'},
      {t:'improve', sub:'interface', severity:'minor', tx:'Chat: keyboard ↑/↓ arrows let you pick a player from the @ mention suggestion list'},
      {t:'improve', sub:'interface', tx:'The mention alert (color + vibration + enlargement of the collapsed chat) now runs continuously until the chat is opened, instead of stopping after 3 repeats'},
      {t:'fix', sub:'interface', severity:'minor', tx:'An @player mention now shows in color for EVERYONE in chat, even if the mentioned person is no longer online when the message is displayed'},
    ] },
  { v:'V175', d:'05/07/2026 22:30', name:{fr:'4e zone par palier + boucles d\'oreille', en:'4th zone per tier + earrings'}, fr:[
      {t:'new', sub:'zones', tx:'1 zone supplémentaire par palier de stuff (Ruines de Trent, Île d\'Iliya, Base de Bashim, Forêt de Polly) — chaque palier passe de 3 à 4 zones. PA/PD requis volontairement identiques à la dernière zone déjà existante du palier : aucun changement du plafond de difficulté'},
      {t:'new', sub:'equipements', tx:'Ajout de la boucle d\'oreille, seul type de bijou qui manquait à chaque palier (les emplacements existaient déjà mais rien ne les alimentait). Le PA total des bijoux d\'un palier reste identique : redistribué sur 4 pièces au lieu de 3, avec une migration automatique du stuff déjà possédé'},
    ], en:[
      {t:'new', sub:'zones', tx:'1 extra zone per gear tier (Trent Ruins, Iliya Island, Bashim Base, Polly Forest) — each tier goes from 3 to 4 zones. Required AP/DP deliberately identical to the tier\'s existing last zone: no change to the difficulty ceiling'},
      {t:'new', sub:'equipements', tx:'Added the earring, the only jewelry type missing from every tier (the slots already existed but nothing dropped there). A tier\'s total jewelry AP stays the same: redistributed across 4 pieces instead of 3, with an automatic migration of gear you already own'},
    ] },
  { v:'V174', d:'05/07/2026 22:15', name:{fr:'Pseudo à l\'inscription, mentions @joueur dans le chat, nombre d\'inscrits', en:'Nickname at signup, @player mentions in chat, registered count'}, fr:[
      {t:'new', sub:'comptes', tx:'Champ pseudo sur l\'écran de création de compte — plus besoin de le changer après coup dans "Mon compte"'},
      {t:'new', sub:'interface', tx:'Nombre total de joueurs inscrits affiché sous le compteur "en ligne"'},
      {t:'improve', sub:'interface', severity:'minor', tx:'La pastille de gravité ne décale plus le texte des lignes de notes de version — déplacée dans la ligne d\'infos du bas, avec les autres badges'},
      {t:'improve', sub:'interface', severity:'minor', tx:'Les sous-catégories des notes de version reprennent désormais la couleur de leur catégorie principale, pour mieux montrer le lien de parenté'},
      {t:'fix', sub:'interface', severity:'minor', tx:'La pastille de notification sur "Notes de version" se vide maintenant dès l\'ouverture du panneau, plutôt qu\'à la fermeture de l\'onglet'},
      {t:'new', sub:'interface', tx:'Chat : taper "@" affiche la liste des joueurs en ligne (filtrable en tapant les premières lettres) pour les mentionner — un message qui te mentionne s\'affiche en surbrillance, et si ton chat est replié, il s\'anime (couleur + vibration + agrandissement) pour t\'inviter à l\'ouvrir'},
    ], en:[
      {t:'new', sub:'comptes', tx:'Nickname field on the account creation screen — no need to change it afterward in "My account"'},
      {t:'new', sub:'interface', tx:'Total number of registered players shown below the "online" counter'},
      {t:'improve', sub:'interface', severity:'minor', tx:'The severity dot no longer shifts patch note line text — moved to the bottom info row, with the other badges'},
      {t:'improve', sub:'interface', severity:'minor', tx:'Patch note subcategories now take on their parent category\'s color, to better show the relationship'},
      {t:'fix', sub:'interface', severity:'minor', tx:'The notification badge on "Patch Notes" now clears as soon as the panel is opened, instead of on tab close'},
      {t:'new', sub:'interface', tx:'Chat: typing "@" shows the list of online players (filterable by typing letters) to mention them — a message mentioning you is highlighted, and if your chat is collapsed, it animates (color + vibration + enlargement) to prompt you to open it'},
    ] },
  { v:'V173', d:'05/07/2026 22:01', name:{fr:'Alignement des boutons d\'inventaire + comparateur avant/après', en:'Inventory button alignment + before/after viewer'}, fr:[
      {t:'fix', sub:'interface', severity:'minor', tx:'Les boutons "⚡ Équiper meilleur" et "🗑️ Vendre" (+ "↩️ Racheter") n\'étaient pas parfaitement alignés (marge et taille de police différentes) — corrigé pour un alignement pixel-perfect'},
      {t:'improve', sub:'interface', severity:'minor', tx:'Les notes de version peuvent désormais inclure un bouton 🖼️ "Voir avant/après" sur une ligne, ouvrant un comparateur avec 2 captures d\'écran côte à côte'},
    ], en:[
      {t:'fix', sub:'interface', severity:'minor', tx:'The "⚡ Equip best" and "🗑️ Sell" (+ "↩️ Buy back") buttons weren\'t perfectly aligned (different margin and font size) — fixed for pixel-perfect alignment'},
      {t:'improve', sub:'interface', severity:'minor', tx:'Patch notes can now include a 🖼️ "See before/after" button on a line, opening a comparer with 2 side-by-side screenshots'},
    ] },
  { v:'V172', d:'05/07/2026 21:48', name:{fr:'Pastilles de gravité + infobulles sur les notes de version', en:'Severity dots + tooltips on patch notes'}, fr:[
      {t:'improve', sub:'interface', severity:'minor', tx:'Chaque ligne des notes de version peut désormais porter une pastille de couleur indiquant sa gravité (Critique/Important/Mineur/Info), indépendante de sa catégorie — une correction peut être Critique ou Mineure selon son impact réel'},
      {t:'improve', sub:'interface', severity:'minor', tx:'Toutes les pastilles/badges (catégorie, gravité, sous-catégorie, plateforme, nature) affichent désormais une explication au survol de la souris'},
    ], en:[
      {t:'improve', sub:'interface', severity:'minor', tx:'Each patch note line can now carry a colored severity dot (Critical/Major/Minor/Info), independent of its category — a fix can be Critical or Minor depending on its actual impact'},
      {t:'improve', sub:'interface', severity:'minor', tx:'All pastilles/badges (category, severity, subcategory, platform, nature) now show an explanation on mouse hover'},
    ] },
  { v:'V171', d:'05/07/2026 21:42', name:{fr:'Bouton optimiser sur l\'équipement + refonte du menu de gauche', en:'Enhance button on gear + left menu overhaul'}, fr:[
      {t:'improve', sub:'equipements', tx:'Petit bouton 🔧 directement sur chaque pièce équipée optimisable — charge instantanément CETTE pièce dans le panneau d\'optimisation, sans passer par le menu au clic. Mentionné dans le tutoriel et le Wiki (section Optimisation)'},
      {t:'improve', sub:'interface', tx:'Le Codex des objets sort du Wiki pour devenir sa propre section, directement accessible depuis le menu de gauche (📚 Codex)'},
      {t:'improve', sub:'interface', tx:'Refonte du menu de gauche : le vrai jeu (Quêtes, Courrier, Compendium, Codex, Succès, Marché, Classement) remonte en haut ; les infos moins utilisées au quotidien (Wiki, Notes de version, Discord, langue, compteur en ligne...) redescendent en bas'},
    ], en:[
      {t:'improve', sub:'equipements', tx:'Small 🔧 button directly on each optimizable equipped piece — instantly loads THAT piece into the enhancement panel, without going through the click menu. Mentioned in the tutorial and the Wiki (Enhancement section)'},
      {t:'improve', sub:'interface', tx:'The Item Codex moves out of the Wiki into its own section, directly accessible from the left menu (📚 Codex)'},
      {t:'improve', sub:'interface', tx:'Left menu overhaul: the actual game (Quests, Mailbox, Compendium, Codex, Achievements, Market, Leaderboard) moves to the top; info used less often day-to-day (Wiki, Patch notes, Discord, language, online counter...) moves to the bottom'},
    ] },
  { v:'V170', d:'05/07/2026 21:32', name:{fr:'Gain d\'optimisation auto affiché + guide de farm', en:'Auto-enhance gain preview + farm guide'}, fr:[
      {t:'improve', sub:'equipements', tx:'L\'optimisation automatique ("Auto jusqu\'à") affiche désormais le gain de stats (PA/PD/PV/Esquive) que rapporterait le palier choisi, avant même de lancer l\'auto'},
      {t:'new', sub:'objets', tx:'Clique sur un emplacement de sac VIDE pour ouvrir un guide "Où farmer ?" listant les zones débloquées et ce qu\'elles rapportent — les zones actuellement trop dangereuses pour ton stuff sont exclues'},
    ], en:[
      {t:'improve', sub:'equipements', tx:'Auto-enhance ("Auto to") now shows the stat gain (AP/DP/HP/Dodge) the chosen tier would bring, before even starting the auto run'},
      {t:'new', sub:'objets', tx:'Click an EMPTY bag slot to open a "Where to farm?" guide listing unlocked zones and what they drop — zones currently too dangerous for your gear are excluded'},
    ] },
  { v:'V169', d:'05/07/2026 21:26', name:{fr:'Refonte des notes de version + correction du cadeau de fidélité', en:'Patch notes overhaul + loyalty gift fix'}, fr:[
      {t:'improve', sub:'interface', tx:'Nouvelle taxonomie des notes de version (Nouveautés, Équilibrage, Améliorations, Corrections de bugs, Sécurité, Serveur, Événements, Informations) — les lignes d\'une même version sont désormais groupées par catégorie, chaque groupe séparé par un liseré doré, avec un alignement cohérent au lieu d\'un badge répété sur chaque ligne'},
      {t:'fix', sub:'connexion', tx:'Le cadeau de fidélité journalier (et son message flottant "Nouveau courrier") pouvait s\'afficher à tort à CHAQUE connexion, même si déjà réclamé aujourd\'hui — la vérification se faisait avant que la vraie sauvegarde cloud ait fini de charger. Corrigé : le jeu attend maintenant que la sauvegarde soit chargée avant de vérifier'},
    ], en:[
      {t:'improve', sub:'interface', tx:'New patch notes taxonomy (New, Balancing, Improvements, Bug fixes, Security, Server, Events, Information) — lines within a version are now grouped by category, each group separated by a gold divider, with consistent alignment instead of a repeated badge on every line'},
      {t:'fix', sub:'connexion', tx:'The daily loyalty gift (and its floating "New mail" toast) could wrongly show up on EVERY connection, even if already claimed today — the check ran before the real cloud save had finished loading. Fixed: the game now waits for the save to load before checking'},
    ] },
  { v:'V168', d:'05/07/2026 20:31', name:{fr:'Correction : jeu bloqué au chargement pour les invités', en:'Fix: game stuck loading for guests'}, fr:[
      {t:'fix', nature:'backend', tx:'Le correctif de la version précédente (page de connexion bloquée) déclenchait aussi un 2e chargement en parallèle de la sauvegarde pour une session invité, provoquant des effets en double (ex: bonus de bienvenue compté deux fois) et pouvait bloquer le jeu au chargement — sessions invité désormais exclues de ce relais, et un verrou empêche tout double appel'},
    ], en:[
      {t:'fix', nature:'backend', tx:'The previous version\'s fix (login screen stuck) also triggered a 2nd, parallel save load for guest sessions, causing duplicated effects (e.g. the welcome bonus counted twice) and could get the game stuck loading — guest sessions are now excluded from that relay, and a lock prevents any double call'},
    ] },
  { v:'V167', d:'05/07/2026 20:24', name:{fr:'Bouton "Vider le cache" sur l\'écran de connexion', en:'"Clear cache" button on the login screen'}, fr:[
      {t:'new', tx:'Le bouton "🧹 Vider le cache du jeu" est maintenant aussi accessible directement sur l\'écran de connexion (en plus du panneau "Mon compte"), pour les cas où un joueur reste bloqué dessus'},
    ], en:[
      {t:'new', tx:'The "🧹 Clear game cache" button is now also available directly on the login screen (in addition to the "My account" panel), for cases where a player gets stuck on it'},
    ] },
  { v:'V166', d:'05/07/2026 20:19', name:{fr:'Correction : page de connexion bloquée après une connexion réussie', en:'Fix: login screen stuck after a successful sign-in'}, fr:[
      {t:'fix', nature:'backend', tx:'Après une connexion via Discord (ou un lien de confirmation d\'email), l\'écran de connexion pouvait rester affiché malgré une connexion réussie, y compris après un rechargement de la page — la session était bien établie mais le jeu ne le détectait pas toujours à temps'},
    ], en:[
      {t:'fix', nature:'backend', tx:'After signing in via Discord (or an email confirmation link), the login screen could stay on-screen despite a successful sign-in, even after reloading the page — the session was properly established but the game didn\'t always detect it in time'},
    ] },
  { v:'V165', d:'05/07/2026 20:04', name:{fr:'Bouton "Vider le cache" et notes de version plus lisibles', en:'"Clear cache" button and more readable patch notes'}, fr:[
      {t:'new', tx:'Panneau "Mon compte" : bouton "🧹 Vider le cache et recharger" pour les cas où une mise à jour ne s\'affiche pas correctement (fichiers du jeu mis en cache par le navigateur) — ne touche jamais à la sauvegarde'},
      {t:'change', nature:'opticode', tx:'Refonte visuelle des notes de version : chaque entrée devient une carte avec un fond légèrement teinté et des séparateurs entre les lignes, badges arrondis en forme de pilule, entrée la plus récente mise en valeur'},
      {t:'fix', nature:'backend', tx:'La détection de nouvelle version déployée (bandeau "Recharger") avait cessé de fonctionner depuis la séparation du code en plusieurs fichiers — elle cherchait les notes de version dans le mauvais fichier'},
    ], en:[
      {t:'new', tx:'"My account" panel: "🧹 Clear cache and reload" button for cases where an update doesn\'t display correctly (game files cached by the browser) — never touches your save'},
      {t:'change', nature:'opticode', tx:'Visual redesign of the patch notes: each entry is now a card with a lightly tinted background and separators between lines, rounded pill-shaped badges, most recent entry highlighted'},
      {t:'fix', nature:'backend', tx:'Detection of a newly deployed version (the "Reload" banner) had stopped working since the code was split into multiple files — it was looking for the patch notes in the wrong file'},
    ] },
  { v:'V164', d:'05/07/2026 19:53', name:{fr:'Notes de version : tag "nature" (optim. code, backend...)', en:'Patch notes: "nature" tag (code opti, backend...)'}, fr:[
      {t:'new', tx:'Chaque ligne des notes de version peut désormais porter un tag "nature" en plus du type et de la plateforme — Optim. code, Optimisation, Inventaire ou Backend — pour repérer d\'un coup d\'œil les changements sous le capot qui ne touchent pas directement le contenu de jeu. Ce 2e badge (nature ou Tab/Mobile) s\'affiche maintenant sur sa propre ligne, sous le badge principal, plutôt qu\'à côté'},
      {t:'change', nature:'opticode', tx:'Le code du jeu (un seul fichier HTML de plus de 11 500 lignes) a été séparé en plusieurs fichiers — structure HTML, CSS et JavaScript (coupé en 2 fichiers) chacun à part — pour être plus simple à maintenir sur la durée. Aucun changement de gameplay, tout fonctionne à l\'identique'},
    ], en:[
      {t:'new', tx:'Each patch note line can now carry a "nature" tag in addition to its type and platform — Code opti, Optimization, Inventory or Backend — to spot at a glance under-the-hood changes that don\'t directly touch game content. This 2nd badge (nature or Tab/Mobile) now shows on its own line, below the main badge, instead of next to it'},
      {t:'change', nature:'opticode', tx:'The game\'s code (a single 11,500+ line HTML file) has been split into several files — HTML structure, CSS and JavaScript (split into 2 files) each on their own — to be easier to maintain long-term. No gameplay change, everything works identically'},
    ] },
  { v:'V163', d:'05/07/2026 19:04', name:{fr:'Tutoriel : indice de défilement quand la cible est hors champ', en:'Tutorial: scroll hint when the target is off-screen'}, fr:[
      {t:'new', tx:'Pendant le tutoriel de début, si l\'élément mis en avant par l\'étape en cours est hors du champ visible, une icône apparaît pour indiquer qu\'il faut défiler — 🖱️ souris sur ordinateur, 👆 doigt sur mobile/tablette. Disparaît dès que l\'élément redevient visible'},
    ], en:[
      {t:'new', tx:'During the opening tutorial, if the element highlighted by the current step is off-screen, an icon appears to indicate you need to scroll — 🖱️ mouse on desktop, 👆 finger on mobile/tablet. Disappears as soon as the element becomes visible again'},
    ] },
  { v:'V162', d:'05/07/2026 18:58', name:{fr:'Nouvelle zone : Planque des Mânes (3e zone bleue)', en:'New zone: Manes\' Hideout (3rd blue zone)'}, fr:[
      {t:'new', tx:'Nouvelle zone "Planque des Mânes" (Esprit des Mânes), 3e zone du palier bleu (Grunil) — complète la rotation d\'une arme garantie par zone et apporte la ceinture manquante (Orkinrad\'s Belt). Ses PA/PD requis sont volontairement identiques à Ruines de Kratuga : le plafond de stat du palier bleu au PEN ne change pas (~294 PA / ~247 PD stuff complet)'},
    ], en:[
      {t:'new', tx:'New "Manes\' Hideout" zone (Manes Spirit), 3rd zone of the blue tier (Grunil) — completes the one-guaranteed-weapon-per-zone rotation and brings the missing belt (Orkinrad\'s Belt). Its AP/DP requirements are deliberately identical to Kratuga Ruins: the blue tier\'s stat ceiling at PEN doesn\'t change (~294 AP / ~247 DP full set)'},
    ] },
  { v:'V161', d:'05/07/2026 18:43', name:{fr:'Badge "Compatible mobile/tablette" à la connexion', en:'"Mobile/tablet compatible" badge at login'}, fr:[
      {t:'new', plat:'mobile', tx:'Un badge "📱 BETA — Compatible mobile & tablette" s\'affiche désormais sur l\'écran de connexion/création de compte, pour annoncer l\'adaptation mobile dès l\'arrivée sur le jeu'},
    ], en:[
      {t:'new', plat:'mobile', tx:'A "📱 BETA — Mobile & tablet compatible" badge now shows on the login/account creation screen, announcing the mobile adaptation right from arrival on the game'},
    ] },
  { v:'V160', d:'05/07/2026 18:20', name:{fr:'Rééquilibrage PA/PD appliqué rétroactivement au stuff déjà possédé', en:'AP/DP rebalance applied retroactively to owned gear'}, fr:[
      {t:'fix', tx:'Le rééquilibrage des PA/PD (armes/armures/bijoux, voir version précédente) ne s\'appliquait qu\'aux nouveaux objets trouvés — tout le stuff déjà en possession (équipé ou dans le sac) gardait ses anciennes valeurs, bien plus hautes pour les armes. Recalculé une bonne fois pour toutes au prochain chargement, sans rien perdre (les PV/l\'Esquive, non concernés par le rééquilibrage, restent inchangés)'},
    ], en:[
      {t:'fix', tx:'The AP/DP rebalance (weapons/armor/jewelry, see previous version) only applied to newly found items — all gear already owned (equipped or in the bag) kept its old values, much higher for weapons. Recalculated once and for all on next load, without losing anything (HP/Dodge, untouched by the rebalance, stay the same)'},
    ] },
  { v:'V159', d:'05/07/2026 18:09', name:{fr:'Notes de version : badge Tablette/Mobile', en:'Patch notes: Tablet/Mobile badge'}, fr:[
      {t:'new', tx:'Chaque ligne des notes de version peut maintenant porter un 2e badge "📱 Tab/Mobile" en plus du type (Nouveauté/Modification/Correction/Faille), pour repérer d\'un coup d\'œil les changements qui ne concernent QUE la tablette/le téléphone. Appliqué rétroactivement aux notes V152 à V157 (adaptation mobile)'},
    ], en:[
      {t:'new', tx:'Each patch note line can now carry a 2nd "📱 Tab/Mobile" badge next to its type (New/Change/Fix/Security), to spot at a glance changes that only concern tablet/phone. Applied retroactively to notes V152 through V157 (mobile adaptation)'},
    ] },
  { v:'V158', d:'05/07/2026 18:05', name:{fr:'1 arme garantie par zone, PA des armes fortement réduit', en:'1 guaranteed weapon per zone, weapon AP greatly reduced'}, fr:[
      {t:'change', tx:'Chaque zone garantit désormais un type d\'arme précis (épée/dague/éveil, en rotation par palier) au lieu de tirer au hasard le même emplacement que l\'armure — la zone bleue (2 zones seulement pour l\'instant) fait exception : sa 2e zone garantit 2 types d\'arme'},
      {t:'change', tx:'Les armes donnaient bien trop de PA (à elles 3, environ 750 PA au PEN sur un stuff bleu complet, contre ~460 PD total) — rééquilibrées pour qu\'un stuff bleu complet (3 armes + 4 armures + bijoux) totalise environ 301 PA et 248 PD au PEN, chaque palier plus bas donnant proportionnellement moins'},
    ], en:[
      {t:'change', tx:'Each zone now guarantees a specific weapon type (sword/dagger/awakening, rotating by tier) instead of randomly rolling the same slot as armor — the blue tier (only 2 zones for now) is an exception: its 2nd zone guarantees 2 weapon types'},
      {t:'change', tx:'Weapons gave far too much AP (the 3 of them alone reached ~750 AP at PEN on a full blue set, vs ~460 total DP) — rebalanced so a full blue set (3 weapons + 4 armor + jewelry) totals around 301 AP and 248 DP at PEN, with each lower tier giving proportionally less'},
    ] },
  { v:'V157', d:'05/07/2026 17:48', name:{fr:'Mobile : header dégagé, gains XP/Loot lisibles, moins de chevauchement', en:'Mobile: cleared header, readable XP/Loot gains, less overlap'}, fr:[
      {t:'fix', plat:'mobile', tx:'Le bouton replié du menu de gauche (position fixe, en haut à gauche) cachait le premier onglet de la barre d\'activités sur téléphone — le contenu est repoussé sous ce bouton pour ne plus jamais le chevaucher'},
      {t:'fix', plat:'mobile', tx:'Les bannières "Sac plein" et "Tu es mort" recouvraient le nom de la zone sur téléphone (cadre de jeu très bas) — repoussées en dessous'},
      {t:'change', plat:'mobile', tx:'Les nombres flottants de gains (loot, XP, dégâts) sont dessinés sur un canvas à résolution fixe, réduit à la taille de l\'écran — sur téléphone ils devenaient minuscules, quasi illisibles. Leur taille compense maintenant la réduction de l\'écran pour rester lisible, quelle que soit la largeur'},
      {t:'change', plat:'mobile', tx:'Silver, taux/h et butin en direct légèrement resserrés sur téléphone pour laisser plus de place à cet ensemble sur un cadre de jeu réduit'},
    ], en:[
      {t:'fix', plat:'mobile', tx:'The left menu\'s folded button (fixed position, top-left) hid the first tab of the activity bar on phone — content is now pushed below this button so it\'s never covered again'},
      {t:'fix', plat:'mobile', tx:'The "Bag full" and "You died" banners covered the zone name on phone (very short game frame) — pushed further down'},
      {t:'change', plat:'mobile', tx:'Floating gain numbers (loot, XP, damage) are drawn on a fixed-resolution canvas that shrinks to fit the screen — on phone they became tiny, barely readable. Their size now compensates for the screen shrink to stay legible at any width'},
      {t:'change', plat:'mobile', tx:'Silver, rate/h and live loot slightly tightened on phone to leave more room for this group on a shrunk game frame'},
    ] },
  { v:'V156', d:'05/07/2026 17:26', name:{fr:'Mobile : barre de sorts repliable, potion mise en avant', en:'Mobile: collapsible skill bar, potion put forward'}, fr:[
      {t:'change', plat:'mobile', tx:'Sur mobile/tablette, la barre de sorts est maintenant repliée par défaut (purement indicative, aucun clic requis, le combat reste automatique) — un bouton ⚡ la déplie/replie à la demande, libérant de la place dans le cadre de jeu'},
      {t:'change', plat:'mobile', tx:'La potion (soin automatique), ce qui compte vraiment à surveiller en jeu, est mise en avant sur mobile/tablette : agrandie avec un halo doré au lieu d\'être réduite comme le reste du HUD'},
    ], en:[
      {t:'change', plat:'mobile', tx:'On mobile/tablet, the skill bar is now collapsed by default (purely informational, no click required, combat stays automatic) — a ⚡ button expands/collapses it on demand, freeing up space in the game frame'},
      {t:'change', plat:'mobile', tx:'The potion (auto-heal), the thing that actually matters to watch during play, is put forward on mobile/tablet: enlarged with a gold glow instead of being shrunk like the rest of the HUD'},
    ] },
  { v:'V155', d:'05/07/2026 09:07', name:{fr:'Correctifs mobile : barre de sorts coupée, IA superposée', en:'Mobile fixes: cropped skill bar, overlapping AI status'}, fr:[
      {t:'fix', plat:'mobile', tx:'Sur téléphone, la barre de 9 sorts (calibrée pour ~418px de large) dépassait des 2 côtés du cadre de jeu réduit (~360-380px), coupant les icônes de bord (ex: "Speed" et "Voltaic" à moitié visibles). Icônes réduites pour tenir entièrement dans le cadre'},
      {t:'fix', plat:'mobile', tx:'Le texte "IA : ..." se superposait au nom de la zone — le cadre de jeu devient très bas sur téléphone (son ratio suit la largeur), pas assez de place pour empiler proprement les deux. Masqué sur téléphone (indicatif seulement, le combat reste automatique)'},
      {t:'change', plat:'mobile', tx:'Barre de vie/potion légèrement réduite sur téléphone pour laisser plus de place à la barre de sorts juste à côté — un chevauchement résiduel entre les deux subsiste sur les téléphones les plus étroits, une refonte plus profonde (titre de zone notamment) serait nécessaire pour l\'éliminer complètement'},
    ], en:[
      {t:'fix', plat:'mobile', tx:'On phone, the 9-skill bar (sized for ~418px wide) overflowed both sides of the shrunk game frame (~360-380px), cropping the edge icons (e.g. "Speed" and "Voltaic" half-cut). Icons shrunk to fit entirely within the frame'},
      {t:'fix', plat:'mobile', tx:'The "AI: ..." status text overlapped the zone name — the game frame becomes very short on phone (its ratio follows the width), not enough room to stack both cleanly. Hidden on phone (informational only, combat stays automatic)'},
      {t:'change', plat:'mobile', tx:'HP/potion bar slightly shrunk on phone to leave more room for the skill bar right next to it — a residual overlap between the two remains on the narrowest phones; a deeper redesign (notably the zone title) would be needed to fully eliminate it'},
    ] },
  { v:'V154', d:'05/07/2026 09:01', name:{fr:'Correctif mobile : barre d\'onglets empilée sur 8 lignes', en:'Mobile fix: tab bar stacked into 8 rows'}, fr:[
      {t:'fix', plat:'mobile', tx:'Sur téléphone, les 8 onglets (Zone/Boss/Pêche/Mine/Forêt/Champs/Bergerie/Atelier royal) et le texte "Prochain boss" se partageaient une seule ligne — le texte, assez long, écrasait la largeur dispo pour les onglets, forcés à 1 seul par ligne (8 lignes de haut, confirmé sur un vrai téléphone). Empilés l\'un sous l\'autre à la place : les onglets se répartissent maintenant sur 3-4 par ligne'},
    ], en:[
      {t:'fix', plat:'mobile', tx:'On phone, the 8 tabs (Zone/Boss/Fishing/Mining/Forest/Fields/Ranch/Royal Workshop) and the "Next boss" text shared a single row — the fairly long text crushed the space left for the tabs, forcing them to 1 per row (8 rows tall, confirmed on a real phone). Stacked on top of each other instead: tabs now spread across 3-4 per row'},
    ] },
  { v:'V153', d:'05/07/2026 08:39', name:{fr:'Correctifs mobile : menu scrollable, version bien rangée', en:'Mobile fixes: scrollable menu, version properly placed'}, fr:[
      {t:'fix', plat:'mobile', tx:'Le numéro de version (tout en bas du menu de gauche) n\'était pas masqué quand le menu était replié — il flottait tout seul par-dessus le jeu. Il est maintenant bien rangé dans le menu, visible seulement quand celui-ci est déplié'},
      {t:'fix', plat:'mobile', tx:'Sur un petit écran, le menu de gauche déplié pouvait être plus haut que l\'écran lui-même, rendant certains boutons (Discord, Admin...) impossibles à atteindre. Le menu défile maintenant lui-même si besoin, plutôt que de déborder hors de l\'écran'},
    ], en:[
      {t:'fix', plat:'mobile', tx:'The version number (at the very bottom of the left menu) wasn\'t hidden when the menu was folded — it floated on its own over the game. It\'s now properly tucked inside the menu, only visible when expanded'},
      {t:'fix', plat:'mobile', tx:'On a small screen, the expanded left menu could be taller than the screen itself, making some buttons (Discord, Admin...) unreachable. The menu now scrolls internally when needed instead of overflowing off-screen'},
    ] },
  { v:'V152', d:'05/07/2026 08:24', name:{fr:'Adaptation tablette/téléphone', en:'Tablet/phone optimization'}, fr:[
      {t:'new', plat:'mobile', tx:'Sur tablette/téléphone (≤1024px de large, couvre les tailles standards du marché — iPhone SE à iPad en paysage), le menu de gauche, le suivi de quêtes et le chat se replient désormais automatiquement par défaut pour ne plus recouvrir le jeu ni se chevaucher entre eux ; toujours dépliables en un tap. Aucun changement sur la version ordinateur (>1024px), testée et inchangée'},
    ], en:[
      {t:'new', plat:'mobile', tx:'On tablet/phone (≤1024px wide, covers standard market sizes — iPhone SE to iPad landscape), the left menu, quest tracker and chat now auto-fold by default so they no longer cover the game or overlap each other; still one tap away to expand. No change to the desktop version (>1024px), tested and unaffected'},
    ] },
  { v:'V151', d:'05/07/2026 07:51', name:{fr:'Dates des notes de version, tutoriel Compendium, joueurs fluides', en:'Patch note dates, Compendium tutorial, smooth players'}, fr:[
      {t:'fix', tx:'Les notes de version affichaient une date/heure de publication erronée (jusqu\'à plusieurs jours dans le futur) — corrigé pour les versions V91 à V150 avec l\'horodatage réel'},
      {t:'fix', tx:'Dans le tutoriel du Compendium, les étapes 4 et 6 (une zone/le sac protégé) affichaient l\'encadré par-dessus l\'élément mis en avant au lieu d\'au-dessus — une hauteur de boîte codée en dur ne correspondait pas au texte plus long de ces étapes ; corrigé pour mesurer la vraie hauteur'},
      {t:'change', tx:'Les autres joueurs dans l\'arène d\'un World Boss partagé bougent maintenant de façon fluide (interpolés à chaque image) au lieu de sauter d\'une position à l\'autre toutes les ~0.35s'},
    ], en:[
      {t:'fix', tx:'Patch notes showed a wrong publish date/time (up to several days in the future) — fixed for versions V91 through V150 with the real timestamp'},
      {t:'fix', tx:'In the Compendium tutorial, steps 4 and 6 (a zone / the protected bag) showed the box overlapping the highlighted element instead of sitting above it — a hardcoded box height didn\'t match these steps\' longer text; fixed to measure the real height'},
      {t:'change', tx:'Other players in a shared World Boss arena now move smoothly (interpolated every frame) instead of jumping from position to position every ~0.35s'},
    ] },
  { v:'V150', d:'05/07/2026 07:41', name:{fr:'Compendium : bonus de zone = TOUS les objets obtenus', en:'Compendium: zone bonus = ALL items obtained'}, fr:[
      {t:'change', tx:'Le bonus +1% d\'une zone n\'est désormais actif que si ses 4 objets (trash, matériau, bijou jackpot, objet craft) ont TOUS déjà été obtenus au moins une fois — avant, un seul suffisait. Une zone incomplète affiche "Objet manquant" au lieu de "Non visitée". Entièrement recalculé à partir de tes objets déjà possédés : aucune perte de progression, le changement s\'applique rétroactivement dès le rechargement'},
    ], en:[
      {t:'change', tx:'A zone\'s +1% bonus is now only active if ALL 4 of its items (trash, material, jackpot jewel, craft item) have been obtained at least once — previously just one was enough. An incomplete zone now shows "Missing item" instead of "Not visited". Fully recomputed from items you already own: no progress lost, the change applies retroactively as soon as you reload'},
    ] },
  { v:'V149', d:'05/07/2026 07:35', name:{fr:'Tutoriel du Compendium', en:'Compendium tutorial'}, fr:[
      {t:'new', tx:'Nouveau bouton "?" en haut à droite du Compendium : lance un mini-tutoriel expliquant la progression globale, les 4 onglets, comment lire une zone, la Maîtrise PEN et le Sac protégé. Se lance automatiquement à la toute première ouverture du panneau, et peut être relancé à tout moment avec ce bouton'},
    ], en:[
      {t:'new', tx:'New "?" button at the top-right of the Compendium: launches a mini-tutorial explaining overall progress, the 4 tabs, how to read a zone, PEN Mastery and the Protected bag. Launches automatically the very first time the panel is opened, and can be replayed anytime with this button'},
    ] },
  { v:'V148', d:'05/07/2026 07:29', name:{fr:'Correctif Compendium : zones marquées "Non visitée" à tort', en:'Compendium fix: zones wrongly shown "Not visited"'}, fr:[
      {t:'fix', tx:'Une zone pouvait afficher "Non visitée" dans le Compendium alors que ses objets étaient déjà cochés ✓ — le suivi des zones visitées n\'existait pas encore quand ces objets avaient été ramassés. Rattrapage rétroactif au chargement : si tu possèdes déjà l\'objet unique de la zone, elle est maintenant marquée visitée (et le bonus +1% associé accordé)'},
    ], en:[
      {t:'fix', tx:'A zone could show "Not visited" in the Compendium even though its items were already checked ✓ — zone-visited tracking didn\'t exist yet when those items were first picked up. Retroactively backfilled on load: if you already own the zone\'s unique item, it\'s now marked visited (and the associated +1% bonus granted)'},
    ] },
  { v:'V147', d:'05/07/2026 07:18', name:{fr:'Alerte double réclamation déplacée sur le salon cheat', en:'Double-claim alert moved to the cheat channel'}, fr:[
      {t:'change', tx:'L\'alerte "Tentative de double réclamation" part désormais sur le salon Discord "cheat" (comme les bornages anti-triche) au lieu du salon général — déplacée côté serveur directement dans boss_claim(), plus fiable et impossible à contourner côté client'},
    ], en:[
      {t:'change', tx:'The "Double-claim attempt" alert now goes to the "cheat" Discord channel (like anti-cheat clamps) instead of the general channel — moved server-side directly into boss_claim(), more reliable and impossible to bypass client-side'},
    ] },
  { v:'V146', d:'05/07/2026 07:06', name:{fr:'Correctif serveur : logs Discord bloqués par CORS', en:'Server fix: Discord logs blocked by CORS'}, fr:[
      {t:'fix', tx:'La fonction serveur qui relaie les événements vers Discord (boss vaincu, succès, loot rare, etc.) ne répondait pas correctement aux requêtes CORS depuis le site déployé — le navigateur bloquait l\'appel avant même qu\'il n\'atteigne le webhook, donc plus aucun log Discord ne partait. Corrigé côté serveur (Edge Function) ; vérifié par un appel de test réel depuis l\'extérieur, reçu avec succès'},
    ], en:[
      {t:'fix', tx:'The server function that relays events to Discord (boss defeated, achievements, rare loot, etc.) wasn\'t responding correctly to CORS requests from the deployed site — the browser blocked the call before it ever reached the webhook, so no Discord logs were going out anymore. Fixed server-side (Edge Function); verified with a real external test call, received successfully'},
    ] },
  { v:'V145', d:'05/07/2026 07:02', name:{fr:'Correctif : présence des joueurs en World Boss', en:'Fix: player presence in World Boss'}, fr:[
      {t:'fix', tx:'Grâce aux logs [BossPresence] : le canal de présence Realtime se fermait parfois tout seul (coupure réseau) pendant un combat de World Boss partagé, sans jamais se rétablir — les joueurs devenaient invisibles les uns aux autres pour le reste du combat. Le canal se reconnecte désormais automatiquement tant que le combat partagé est en cours'},
      {t:'fix', tx:'Corrigé un plantage JS toutes les 60s (ping de temps de jeu) qui pouvait perturber la page en arrière-plan : "sb.rpc(...).catch is not a function"'},
    ], en:[
      {t:'fix', tx:'Thanks to the [BossPresence] logs: the Realtime presence channel sometimes closed on its own (network hiccup) during a shared World Boss fight and never recovered — players became invisible to each other for the rest of the fight. The channel now automatically reconnects as long as the shared fight is ongoing'},
      {t:'fix', tx:'Fixed a JS crash every 60s (playtime ping) that could disrupt the page in the background: "sb.rpc(...).catch is not a function"'},
    ] },
  { v:'V144', d:'05/07/2026 06:56', name:{fr:'Diagnostic : présence des joueurs en World Boss', en:'Diagnostics: player presence in World Boss'}, fr:[
      {t:'fix', tx:'Le partage des PV/top 10 fonctionne bien en World Boss (confirmé par test à 2 comptes), mais les silhouettes des autres joueurs restent invisibles dans l\'arène — traces de diagnostic ajoutées (console, préfixe [BossPresence]) pour identifier précisément la cause au prochain test'},
    ], en:[
      {t:'fix', tx:'HP/top 10 sharing works correctly in World Boss (confirmed via 2-account test), but other players\' silhouettes remain invisible in the arena — diagnostic logging added (console, [BossPresence] prefix) to pinpoint the exact cause on the next test'},
    ] },
  { v:'V143', d:'05/07/2026 06:42', name:{fr:'Correctif serveur : Vell planifié était toujours en solo', en:'Server fix: scheduled Vell was always solo'}, fr:[
      {t:'fix', tx:'Les apparitions programmées de Vell (jeudi 12h00, dimanche 16h45) ne créaient jamais d\'instance PARTAGÉE côté serveur — chaque joueur combattait Vell tout seul, sans jamais voir les autres joueurs ni PV communs, contrairement à Kzarka qui fonctionnait déjà correctement. Corrigé côté Supabase ; un spawn Vell déclenché par le planning est désormais bien partagé entre tous les joueurs, exactement comme un spawn admin'},
      {t:'fix', tx:'Correctif complémentaire : un spawn admin en cours (ex: Vell lancé manuellement) pouvait être écrasé par erreur si un créneau planifié de Kzarka devenait actif entre-temps — n\'importe quel spawn valide (admin ou planifié) est désormais protégé jusqu\'à son expiration'},
    ], en:[
      {t:'fix', tx:'Vell\'s scheduled appearances (Thursday 12:00, Sunday 16:45) never created a SHARED instance server-side — each player fought Vell completely alone, never seeing other players or shared HP, unlike Kzarka which already worked correctly. Fixed server-side; a scheduled Vell spawn is now properly shared among all players, exactly like an admin spawn'},
      {t:'fix', tx:'Additional fix: an ongoing admin spawn (e.g. Vell triggered manually) could be wrongly overwritten if a scheduled Kzarka slot became active in the meantime — any valid spawn (admin or scheduled) is now protected until it expires'},
    ] },
  { v:'V142', d:'05/07/2026 06:33', name:{fr:'Persistance : chat, encarts de suivi', en:'Persistence: chat, tracker widgets'}, fr:[
      {t:'change', tx:'Le canal de chat choisi et l\'état replié/déplié du chat survivent maintenant à un rechargement de la page (comme le menu de gauche, déjà persisté)'},
      {t:'change', tx:'Les encarts "🗒️ Suivi" (temps de jeu, reset quotidien/hebdo) et "🔖 Quêtes suivies" gardent leur état replié/déplié après un rechargement au lieu de toujours repartir dépliés'},
    ], en:[
      {t:'change', tx:'The chosen chat channel and the chat\'s folded/unfolded state now survive a page reload (like the left menu, already persisted)'},
      {t:'change', tx:'The "🗒️ Tracker" (playtime, daily/weekly reset) and "🔖 Tracked quests" widgets keep their folded/unfolded state after a reload instead of always starting unfolded'},
    ] },
  { v:'V141', d:'05/07/2026 06:25', name:{fr:'10 spots fixes par World Boss, Vell sur les pontons', en:'10 fixed spots per World Boss, Vell on the boat decks'}, fr:[
      {t:'change', tx:'Chaque joueur arrive désormais sur l\'un de 10 spots fixes tirés au hasard dans l\'arène du boss (au lieu de se superposer exactement au même point que tout le monde), et y revient entre deux AoE — les joueurs se voient enfin répartis dans la zone pendant la strat'},
      {t:'change', tx:'Sur Vell, ces 10 spots sont répartis sur les pontons des 2 bateaux (5 chacun) au lieu d\'un point unique en pleine mer'},
    ], en:[
      {t:'change', tx:'Each player now spawns on one of 10 fixed spots picked at random in the boss arena (instead of stacking exactly on the same point as everyone else), and returns there between AoEs — players are finally spread out visibly during the strat'},
      {t:'change', tx:'On Vell, these 10 spots are spread across the 2 boats\' decks (5 each) instead of a single point out in open water'},
    ] },
  { v:'V140', d:'05/07/2026 05:23', name:{fr:'Planning des World Boss ancré sur l\'heure française', en:'World Boss schedule anchored to French time'}, fr:[
      {t:'fix', tx:'Les horaires de Vell/Kzarka (repris de garmoth.com) sont ceux de l\'heure française (Europe/Paris) — mais le planning était calculé avec l\'heure LOCALE du navigateur, donc un joueur situé hors de France voyait un planning décalé de son propre fuseau. Le calcul est maintenant toujours ancré sur l\'heure de Paris (été/hiver géré automatiquement), quel que soit le fuseau du joueur'},
    ], en:[
      {t:'fix', tx:'Vell/Kzarka\'s schedule (sourced from garmoth.com) is in French time (Europe/Paris) — but it was computed using the browser\'s LOCAL time, so a player outside France saw a schedule shifted by their own timezone. The schedule is now always anchored to Paris time (summer/winter handled automatically), regardless of the player\'s timezone'},
    ] },
  { v:'V139', d:'05/07/2026 04:53', name:{fr:'Alerte Discord sur tentative de double réclamation', en:'Discord alert on double-claim attempt'}, fr:[
      {t:'new', tx:'Le blocage anti-double-réclamation d\'un World Boss (voir V135) était totalement silencieux — chaque tentative de re-réclamer une récompense déjà payée envoie désormais une alerte sur Discord (pseudo du joueur, boss concerné), pour repérer les abus'},
    ], en:[
      {t:'new', tx:'The World Boss anti-double-claim block (see V135) was completely silent — every attempt to re-claim an already-paid reward now sends a Discord alert (player name, boss involved), to spot abuse'},
    ] },
  { v:'V138', d:'05/07/2026 04:52', name:{fr:'Correctif : Vell affichait en fait Kzarka', en:'Fix: Vell was actually showing Kzarka'}, fr:[
      {t:'fix', tx:'Bug de longue date : le combat de Vell affichait en réalité toujours la silhouette de Kzarka (rouge/brun) — la fonction qui choisit le dessin comparait le mauvais identifiant et ne reconnaissait jamais Vell. Toutes les silhouettes de Vell dessinées depuis plusieurs versions (bateaux, ailes-vasque...) n\'étaient donc jamais visibles en jeu ; elles s\'affichent enfin correctement maintenant'},
    ], en:[
      {t:'fix', tx:'Long-standing bug: Vell\'s fight actually always displayed Kzarka\'s silhouette (red/brown) — the function choosing which creature to draw was comparing the wrong identifier and never recognized Vell. Every Vell silhouette drawn over the last several versions (boats, wing-bowl...) was therefore never actually visible in-game; it now renders correctly'},
    ] },
  { v:'V137', d:'05/07/2026 04:47', name:{fr:'Vell : ailes-vasque (angles supplémentaires de la sculpture)', en:'Vell: wing-bowl shape (extra sculpture angles)'}, fr:[
      {t:'change', tx:'Silhouette de Vell affinée d\'après 5 angles de la sculpture 3D de référence : ce que l\'on prenait pour des cornes/socle séparé sont en fait les 2 AILES du dragon, si immenses qu\'elles s\'enroulent vers l\'intérieur et se rejoignent en bas pour former une grande vasque — le corps du dragon (petit, crête de pointes, museau fin, longue queue en lame recourbée) est perché tout en haut, pattes agrippées au rebord'},
    ], en:[
      {t:'change', tx:'Vell\'s silhouette refined from 5 angles of the reference 3D sculpture: what looked like separate horns/a base are actually the dragon\'s 2 WINGS, so huge they curl inward and meet at the bottom to form a large bowl — the dragon\'s body (small, spiked crest, slender snout, long curved blade-tipped tail) perches at the top, claws gripping the rim'},
    ] },
  { v:'V136', d:'05/07/2026 04:44', name:{fr:'Vell : nouvelle silhouette (cornes enroulées, socle drapé)', en:'Vell: new silhouette (curled horns, draped base)'}, fr:[
      {t:'change', tx:'Silhouette de Vell redessinée une 3e fois d\'après une sculpture 3D de référence : deux immenses cornes/ailes enroulées en "C" qui encadrent la tête, une crête de pointes sur la nuque, un museau fin aux crocs visibles, des bras griffus repliés devant, une longue queue fine et courbe, le tout émergeant d\'un socle drapé façon vague/tissu enroulé'},
    ], en:[
      {t:'change', tx:'Vell\'s silhouette redesigned a 3rd time from a reference 3D sculpture: two huge horns/wings curled into a "C" shape framing the head, a spiked ridge along the neck, a slender snout with visible fangs, clawed arms folded in front, a long thin curved tail, all emerging from a draped wave/cloth-like base'},
    ] },
  { v:'V135', d:'05/07/2026 04:29', name:{fr:'Correctif exploit World Boss, Vell dragon, notifications par onglets', en:'World Boss exploit fix, Vell dragon redesign, tabbed notifications'}, fr:[
      {t:'exploit', tx:'Corrigé un exploit sérieux : sur un boss partagé déjà mort, rentrer dans l\'arène redéclenchait la victoire et payait silver/matériau/loot rare une DEUXIÈME fois, alors que le serveur refusait déjà la réclamation en silence — le client accordait la récompense sans jamais vérifier si la réclamation avait réussi. Chaque victoire ne peut désormais être payée qu\'une seule fois'},
      {t:'change', tx:'Vell entièrement redessiné d\'après la vraie photo de référence : couronne de cornes/pointes asymétriques, grande gueule ouverte pleine de crocs, ailes membraneuses déployées, plastron clair/orangé, pattes griffues — une silhouette de dragon des mers, plus rien à voir avec le poisson/serpent précédent ni avec Kzarka'},
      {t:'change', tx:'Centre de notifications : les catégories (Important/Réussites/Activité) sont maintenant des onglets FIXES en haut du panneau au lieu de simples titres perdus dans le défilement'},
      {t:'fix', tx:'Le panneau "Top contributeurs" d\'un boss partagé est repoussé plus bas pour ne plus jamais chevaucher la croix "✕" de sortie du combat'},
    ], en:[
      {t:'exploit', tx:'Fixed a serious exploit: re-entering an already-dead shared boss\'s arena re-triggered victory and paid out silver/material/rare loot a SECOND time, even though the server was already silently rejecting the claim — the client granted the reward without ever checking whether the claim actually succeeded. Each victory can now only be paid out once'},
      {t:'change', tx:'Vell fully redesigned from the real reference photo: a crown of asymmetric horns/spikes, a huge fang-filled open maw, spread membranous wings, a pale/orange chest plate, clawed legs — a sea dragon silhouette, nothing like the previous fish/serpent design or Kzarka'},
      {t:'change', tx:'Notification center: categories (Important/Achievements/Activity) are now FIXED tabs at the top of the panel instead of plain headers lost in the scroll'},
      {t:'fix', tx:'A shared boss\'s "Top contributors" panel is pushed further down so it never overlaps the "✕" exit cross again'},
    ] },
  { v:'V134', d:'05/07/2026 04:09', name:{fr:'Silhouette de Vell redessinée (forme distincte de Kzarka)', en:'Vell\'s silhouette redesigned (shape distinct from Kzarka)'}, fr:[
      {t:'change', tx:'Silhouette de Vell entièrement redessinée pour ne plus ressembler à Kzarka en composition : corps massif HORIZONTAL façon baleine qui déferle en diagonale (au lieu d\'un buste vertical), tête émoussée penchée en avant avec la mâchoire sur le dessous, et une grappe de 6 longs tentacules ondulants sous la tête — plus aucune paire de bras/griffes'},
    ], en:[
      {t:'change', tx:'Vell\'s silhouette fully redesigned to stop resembling Kzarka in composition: a massive HORIZONTAL whale-like body surging diagonally (instead of a vertical torso), a blunt head tilted forward with the jaw underneath, and a cluster of 6 long swaying tentacles under the head — no more arm/claw pair'},
    ] },
  { v:'V133', d:'05/07/2026 04:01', name:{fr:'Sac "Compendium" : protège les objets jamais montés en PEN', en:'"Compendium" bag: protects items never brought to PEN'}, fr:[
      {t:'new', tx:'Nouveau sac dédié "📖 Compendium" (192 cases, comme le sac principal) : quand "Vendre" s\'apprête à vendre une pièce d\'équipement ou un bijou dont ce TYPE n\'a jamais atteint PEN, le 1er exemplaire trouvé est protégé ici au lieu d\'être vendu — les exemplaires suivants du même type continuent d\'être vendus normalement'},
      {t:'new', tx:'Nouvel onglet "🎒 Sac protégé" dans le Compendium pour consulter ce sac et renvoyer un objet au sac principal en un clic'},
      {t:'change', tx:'Le message de "Vendre" précise maintenant combien d\'objets ont été vendus VS protégés dans le sac Compendium ; "Racheter" ne redevient actif que s\'il y a vraiment quelque chose à racheter (les objets protégés n\'ont jamais quitté ta possession)'},
    ], en:[
      {t:'new', tx:'New dedicated "📖 Compendium" bag (192 slots, like the main bag): when "Sell" is about to sell a gear piece or jewel whose TYPE has never reached PEN, the 1st copy found is protected here instead of being sold — further copies of the same type keep being sold normally'},
      {t:'new', tx:'New "🎒 Protected bag" tab in the Compendium to browse this bag and send an item back to your main bag in one click'},
      {t:'change', tx:'The "Sell" message now shows how many items were sold VS protected in the Compendium bag; "Buy back" only becomes active if there\'s actually something to buy back (protected items never left your possession)'},
    ] },
  { v:'V132', d:'05/07/2026 03:52', name:{fr:'Vell : ancres des bateaux, montagnes et entrée unique', en:'Vell: ship anchors, mountains and single entrance'}, fr:[
      {t:'change', tx:'Les abris de la charge de Vell sont désormais les ancres des 2 bateaux (chaîne qui descend du pont) au lieu des anciens piliers de pierre de Kzarka — cohérent avec le fait que les joueurs sont sur les bateaux'},
      {t:'new', tx:'Vell est maintenant cerné de montagnes de tous les côtés, avec une seule entrée étroite au centre pour l\'apercevoir depuis les bateaux, d\'après la capture de référence ("Barrier Rock")'},
    ], en:[
      {t:'change', tx:'Vell\'s charge shelters are now the 2 boats\' anchors (chain hanging from the deck) instead of Kzarka\'s old stone pillars — consistent with players being on the boats'},
      {t:'new', tx:'Vell is now surrounded by mountains on every side, with a single narrow entrance in the middle to glimpse him from the boats, based on the reference capture ("Barrier Rock")'},
    ] },
  { v:'V131', d:'05/07/2026 03:49', name:{fr:'Optimisation & Craft fusionnés, craft toujours visible', en:'Enhancement & Crafting merged, craft always visible'}, fr:[
      {t:'change', tx:'Les cartes "Conseil de stuff & Craft" et "Optimisation" sont fusionnées en une seule carte, avec l\'Optimisation en tête'},
      {t:'fix', tx:'Le panneau de craft du Trésor de Velia ne s\'affichait QUE quand l\'onglet "Trésors" de l\'inventaire était ouvert (reste de l\'époque où il vivait dans la carte Inventaire) — il reste maintenant visible en permanence dans la carte Optimisation'},
      {t:'change', tx:'Le Compendium précise maintenant clairement qu\'un clic sur une zone lance le farm directement (téléportation immédiate, sans confirmation), pas juste un aperçu'},
    ], en:[
      {t:'change', tx:'The "Gear advice & Crafting" and "Enhancement" cards are merged into one card, with Enhancement at the top'},
      {t:'fix', tx:'The Velia Treasure crafting panel only showed when the inventory\'s "Treasures" tab was open (a leftover from when it lived in the Inventory card) — it now stays visible at all times in the Enhancement card'},
      {t:'change', tx:'The Compendium now clearly states that clicking a zone starts farming there directly (instant teleport, no confirmation), not just a preview'},
    ] },
  { v:'V130', d:'05/07/2026 03:38', name:{fr:'Bateaux de Vell 10× plus gros, le héros plonge vraiment', en:'Vell\'s boats 10× bigger, hero really dives'}, fr:[
      {t:'change', tx:'Les 2 bateaux du combat de Vell sont désormais 10× plus gros, repoussés dans les coins bas de l\'écran pour rester au premier plan sans recouvrir tout le combat'},
      {t:'new', tx:'Le héros plonge VRAIMENT sous l\'eau quand il s\'abrite près d\'une bouée pendant la charge de Vell : il disparaît, remplacé par des ridules et des bulles qui remontent, au lieu de rester debout avec juste un bouclier bleu'},
    ], en:[
      {t:'change', tx:'Vell\'s 2 boats are now 10× bigger, pushed into the bottom corners of the screen to stay in the foreground without covering the whole fight'},
      {t:'new', tx:'The hero now REALLY dives underwater when taking shelter near a buoy during Vell\'s charge: they vanish, replaced by ripples and rising bubbles, instead of just standing there with a blue shield'},
    ] },
  { v:'V129', d:'05/07/2026 03:29', name:{fr:'Conseil de stuff & Craft regroupés, loot Velia condensé, Maîtrise PEN', en:'Grouped gear advice & Crafting, condensed Velia loot, PEN Mastery'}, fr:[
      {t:'change', tx:'Nouvelle carte "Conseil de stuff & Craft" en bas à droite, juste au-dessus de l\'Optimisation : regroupe le conseil de progression et TOUS les crafts (Trésor de Velia + conversion Poussière→Caphras), qui étaient auparavant éparpillés dans l\'Inventaire et l\'Optimisation'},
      {t:'fix', tx:'Le récapitulatif de loot "toutes zones" affiché à Velia est maintenant CONDENSÉ (1 ligne par zone, dépliable au clic) au lieu d\'afficher les 6 lignes de chaque zone d\'un coup — fini le scroll interminable'},
      {t:'change', tx:'La ligne "Pierre de Cron" dans la table de loot précise maintenant "1 à 3 unités" en plus du taux de drop'},
      {t:'fix', tx:'La Pierre Noire a désormais exactement la même couleur que le stuff Yuria (vert)'},
      {t:'fix', tx:'Les boutons "Équiper meilleur" et "Vendre" font maintenant exactement la même taille (le bouton "Racheter" se superpose en coin sans plus grignoter la largeur de "Vendre")'},
      {t:'new', tx:'Nouveau Compendium spécial "🌟 Maîtrise PEN" : liste les 39 objets optimisables du jeu (7 pièces × 4 paliers + 1 bijou par zone) et suit lesquels ont atteint PEN au moins une fois — un pur suivi de complétion, sans bonus de stats'},
    ], en:[
      {t:'change', tx:'New "Gear advice & Crafting" card in the bottom right, right above Enhancement: groups the progression advice and ALL crafting (Velia Treasure + Dust→Caphras conversion), previously scattered across Inventory and Enhancement'},
      {t:'fix', tx:'The "all zones" loot summary shown at Velia is now CONDENSED (1 line per zone, expandable on click) instead of showing all 6 lines per zone at once — no more endless scrolling'},
      {t:'change', tx:'The "Cron Stone" row in the loot table now shows "1 to 3 units" alongside the drop rate'},
      {t:'fix', tx:'The Black Stone now has the exact same color as Yuria (green) gear'},
      {t:'fix', tx:'"Equip best" and "Sell" buttons are now exactly the same size ("Buy back" now overlaps a corner instead of eating into "Sell"\'s width)'},
      {t:'new', tx:'New special "🌟 PEN Mastery" Compendium: lists all 39 optimizable items in the game (7 pieces × 4 tiers + 1 jewel per zone) and tracks which ones have reached PEN at least once — a pure completion tracker, no stat bonus'},
    ] },
  { v:'V128', d:'05/07/2026 03:18', name:{fr:'Vell en mer, Coeur de Vell, bonus de zone, Compendium refait', en:'Vell at sea, Heart of Vell, zone bonus, reworked Compendium'}, fr:[
      {t:'new', tx:'Combat de Vell entièrement repensé d\'après les captures fournies : arène en pleine mer (ciel, pitons rocheux au loin, rides d\'eau), 2 bateaux qui tirent des boulets de canon animés sur le monstre (avec un tic de dégâts à chaque impact), et sa charge périodique devient "PLONGE !" — il faut se réfugier près d\'une bouée au lieu de se cacher derrière un pilier'},
      {t:'new', tx:'Vell a 5% de chance de looter le Coeur de Vell à sa mort — une roue de récompense qui tourne toute seule s\'affiche en fin de combat, révélant si tu l\'as obtenu (visible même quand tu ne l\'as pas)'},
      {t:'new', tx:'La récompense de silver/matériau des World Boss dépend maintenant de ta meilleure zone découverte, mais SEULEMENT si tu es "certifié sans mort" depuis au moins 3 minutes — sinon aucun bonus de zone'},
      {t:'new', tx:'Le Compendium suit maintenant aussi les World Boss vaincus (même bonus +1% qu\'une zone) et a été entièrement refait : carte de progression claire (SPD/Dégâts/Esquive), onglets Zones/World Boss, et un clic sur un objet montre en halo doré toutes les zones qui le lootent avec un bouton pour y aller directement'},
    ], en:[
      {t:'new', tx:'Vell\'s fight fully reworked from the provided reference images: an open-sea arena (sky, distant rock spires, water ripples), 2 boats firing animated cannonballs at the creature (with a damage tick on each impact), and its periodic charge becomes "DIVE!" — you must take shelter near a buoy instead of hiding behind a pillar'},
      {t:'new', tx:'Vell has a 5% chance to drop the Heart of Vell on death — a reward wheel spins on its own at the end of the fight, revealing whether you got it (shown even when you didn\'t)'},
      {t:'new', tx:'World Boss silver/material rewards now scale with your best discovered zone, but ONLY if you\'ve been "death-free certified" for at least 3 minutes — otherwise no zone bonus'},
      {t:'new', tx:'The Compendium now also tracks defeated World Bosses (same +1% bonus as a zone) and was completely reworked: a clear progress card (SPD/Damage/Dodge), Zones/World Boss tabs, and clicking an item shows a gold halo on every zone that drops it with a button to travel there directly'},
    ] },
  { v:'V127', d:'05/07/2026 03:05', name:{fr:'Loot Velia, Pierre de Cron, Pierre Noire recolorée', en:'Velia loot, Cron Stone, Black Stone recolored'}, fr:[
      {t:'fix', tx:'Velia (zone paisible) affichait par erreur les stats de la dernière zone farmée dans le cadre "Butin" — affiche maintenant un message clair ("aucun monstre, aucun loot possible ici") suivi d\'un récapitulatif du loot de TOUTES les zones de Velia, zone par zone'},
      {t:'change', tx:'La Pierre Noire (palier Yuria/vert) est recolorée en vert (icône + couleur), au lieu du noir/violet d\'origine — cohérent avec le palier qu\'elle sert à optimiser'},
      {t:'new', tx:'Nouvelle Pierre de Cron : dropée dans TOUTES les zones du jeu à un taux fixe de 0.1% (1 à 3 unités), protège automatiquement un enchantement d\'une rétrogradation en cas d\'échec (consommée seulement quand elle sert vraiment)'},
    ], en:[
      {t:'fix', tx:'Velia (peaceful zone) wrongly showed the last farmed zone\'s stats in the "Loot" panel — now shows a clear message ("no monsters, no loot possible here") followed by a summary of ALL Velia zones\' loot, zone by zone'},
      {t:'change', tx:'The Black Stone (Yuria/green tier) is now green (icon + color), instead of the original black/purple — consistent with the tier it enhances'},
      {t:'new', tx:'New Cron Stone: drops in EVERY zone in the game at a fixed 0.1% rate (1 to 3 units), automatically protects an enhancement from downgrading on failure (only consumed when it actually matters)'},
    ] },
  { v:'V126', d:'05/07/2026 02:54', name:{fr:'Craft du Trésor, notifications repensées, potions, + de logs Discord', en:'Treasure crafting, revamped notifications, potions, more Discord logs'}, fr:[
      {t:'new', tx:'Craft du Trésor de Velia : 100 "Bout du trésor" → 1 "Trésor de Velia" (même numéro), et 3 Trésors (mélangés) → 1 "Objet inconnu" mystère. Panneau dédié dans l\'onglet Trésors de l\'inventaire'},
      {t:'fix', tx:'Corrigé un doublon de nom : la 2e ligne "Bout du trésor de Velia 1" (la plus rare) est en fait le morceau du "Velia 2" — renommée en conséquence'},
      {t:'new', tx:'État du Compendium affiché directement dans la zone de farm (📖 X/11, doré quand complet)'},
      {t:'change', tx:'Centre de notifications repensé : persistant (survit au reload), affiche les 20 dernières entrées avec défilement, bouton supprimer par ligne, auto-suppression après 7 jours, et un halo doré sur la cloche quand il y a du nouveau'},
      {t:'new', tx:'Nouvelle "Potion de vie infinie" (coût 0) ajoutée en bas du sélecteur, verrouillée 🔒 en attendant un futur déblocage'},
      {t:'change', tx:'Potions recalibrées par rapport à la courbe de gains des zones (~3 000 à 100 000 silver/h) ; le temps de recharge (CD) est maintenant affiché à côté du prix pour chacune'},
      {t:'change', tx:'"Capheon" corrigé en "Calpheon" dans les onglets de zones'},
      {t:'new', tx:'Plein de nouveaux logs Discord "pour le fun" : montée de niveau, nouvelle zone atteinte, bonus de Compendium débloqué, trésor trouvé, objets craftés, paliers de kills (tous les 1000), record de kills/min battu'},
    ], en:[
      {t:'new', tx:'Velia Treasure crafting: 100 "Treasure pieces" → 1 "Velia Treasure" (matching number), and 3 Treasures (mixed) → 1 mystery "Unknown Item". Dedicated panel in the inventory\'s Treasures tab'},
      {t:'fix', tx:'Fixed a duplicate name: the 2nd "Velia Treasure piece 1" row (the rarer one) was actually the piece for "Velia 2" — renamed accordingly'},
      {t:'new', tx:'Compendium status now shown directly in the farm zone (📖 X/11, gold when complete)'},
      {t:'change', tx:'Notification center reworked: persistent (survives reload), shows the last 20 entries with scrolling, per-row delete button, auto-deletion after 7 days, and a gold halo on the bell when there\'s something new'},
      {t:'new', tx:'New "Infinite HP Potion" (cost 0) added at the bottom of the selector, locked 🔒 pending a future unlock'},
      {t:'change', tx:'Potions recalibrated against the zone earnings curve (~3,000 to 100,000 silver/h); cooldown (CD) is now shown next to the price for each one'},
      {t:'change', tx:'"Capheon" fixed to "Calpheon" in the zone tabs'},
      {t:'new', tx:'Lots of new "for fun" Discord logs: level up, new zone reached, Compendium bonus unlocked, treasure found, items crafted, kill milestones (every 1000), kills/min record broken'},
    ] },
  { v:'V125', d:'05/07/2026 02:38', name:{fr:'Compendium, Vitesse (SPD) et Esquive', en:'Compendium, Speed (SPD) and Dodge'}, fr:[
      {t:'new', tx:'Nouveau 📖 Compendium : ramasse au moins 1 objet dans chaque zone pour débloquer son bonus permanent — +1% Vitesse, +1% Dégâts, +1% Esquive PAR zone (additif, jamais un multiplicateur : les 11 zones donnent +11% de chaque, pas +100%)'},
      {t:'new', tx:'Nouvelle stat Vitesse (SPD) : augmente avec le niveau, de +0% au niveau 1 jusqu\'à +75% au niveau 61 (plafonné), en plus du bonus de Compendium'},
      {t:'new', tx:'Nouvelle stat Esquive, qui se trouve UNIQUEMENT sur les 4 pièces d\'armure : évite complètement un coup en cas de succès. Son efficacité dépend de ton niveau de PD face à la zone — inutile face à un monstre bien trop fort pour toi, mais très puissante (jusqu\'à zéro dégât) dans une zone où tu es largement au-dessus du niveau requis'},
      {t:'change', tx:'But du jeu affiné : un bon taux de Vitesse et d\'Esquive permet de ne jamais mourir et de farmer plus vite — les tooltips d\'objets, la comparaison d\'équipement et "Équiper le meilleur" prennent maintenant l\'Esquive en compte'},
    ], en:[
      {t:'new', tx:'New 📖 Compendium: loot at least 1 item in each zone to unlock its permanent bonus — +1% Speed, +1% Damage, +1% Dodge PER zone (additive, never a multiplier: all 11 zones give +11% each, not +100%)'},
      {t:'new', tx:'New Speed (SPD) stat: increases with level, from +0% at level 1 up to +75% at level 61 (capped), on top of the Compendium bonus'},
      {t:'new', tx:'New Dodge stat, found ONLY on the 4 armor pieces: fully avoids a hit on success. Its effectiveness depends on your DP level relative to the zone — useless against a monster far too strong for you, but very powerful (up to zero damage) in a zone you\'ve far outgrown'},
      {t:'change', tx:'Refined game goal: a good Speed and Dodge rate lets you never die and farm faster — item tooltips, gear comparison and "Equip best" now account for Dodge'},
    ] },
  { v:'V124', d:'05/07/2026 02:24', name:{fr:'Enchantement ralenti, zones recalibrées, World Boss Vell', en:'Slower enhancement, recalibrated zones, Vell World Boss'}, fr:[
      {t:'change', tx:'Ralenti le gain de PA/PD des paliers +1 à +15 (divisé par ~1.6) : un stuff complet à +0 ne suffit plus à franchir la zone de couleur suivante, il faut réellement pousser jusqu\'à PRI+ pour progresser — les paliers PRI/DUO/TRI/TET/PEN représentent maintenant plus de la moitié du gain total à PEN'},
      {t:'change', tx:'PA/PD requis relevés d\'environ 30% sur les zones Camp Rhutum, Mine de Fer Abandonnée et Sanctuaire Elric (premières zones de chaque nouveau palier de couleur), et les zones suivantes de chaque palier réajustées en proportion pour garder une progression lisse'},
      {t:'change', tx:'% de drop de la Pierre concentrée doublé sur Sanctuaire Elric et Ruines de Kratuga (les 2 dernières zones, seule source de ce matériau) pour compenser l\'enchantement plus lent sur le stuff bleu'},
      {t:'new', tx:'Nouveau World Boss hebdomadaire : Vell, la Terreur des Flots (grand poisson des mers) — silhouette originale provisoire en attendant une photo de référence. Apparaît jeudi et dimanche, aux horaires du vrai Black Desert moins 15 minutes'},
    ], en:[
      {t:'change', tx:'Slowed AP/DP gains from +1 to +15 (cut by ~1.6): a full +0 gear set no longer clears the next color zone by itself — you now need to genuinely push to PRI+ to progress. The PRI/DUO/TRI/TET/PEN tiers now account for more than half the total gain at PEN'},
      {t:'change', tx:'Required AP/DP raised by roughly 30% on Rhutum Camp, Abandoned Iron Mine and Elric Sanctuary (the first zone of each new color tier), with the following zones of each tier scaled proportionally for a smooth curve'},
      {t:'change', tx:'Concentrated Stone drop rate doubled on Elric Sanctuary and Kratuga Ruins (the last 2 zones, the only source of this material) to offset the slower enhancement on blue-tier gear'},
      {t:'new', tx:'New weekly World Boss: Vell, Terror of the Tides (a giant sea creature) — a provisional original silhouette pending a reference photo. Appears Thursday and Sunday, at real Black Desert times minus 15 minutes'},
    ] },
  { v:'V123', d:'05/07/2026 02:07', name:{fr:'PA/PD affichés à côté du Gearscore (classement + admin)', en:'AP/DP shown next to Gearscore (leaderboard + admin)'}, fr:[
      {t:'new', tx:'Le classement "Gearscore" affiche maintenant le détail PA/PD de chaque joueur entre parenthèses, pas juste le score global'},
      {t:'new', tx:'Le tableau "Joueurs" du panneau admin a 2 nouvelles colonnes PA et PD, à côté du Gearscore'},
    ], en:[
      {t:'new', tx:'The "Gearscore" leaderboard now shows each player\'s AP/DP breakdown in parentheses, not just the overall score'},
      {t:'new', tx:'The admin panel\'s "Players" table has 2 new AP and DP columns, next to Gearscore'},
    ] },
  { v:'V122', d:'05/07/2026 01:54', name:{fr:'Mine de Fer Abandonnée : mineurs, boss de pack, décor de carrière', en:'Abandoned Iron Mine: miners, pack bosses, quarry scenery'}, fr:[
      {t:'new', tx:'Nouvelles silhouettes originales pour la Mine de Fer Abandonnée : le Mineur corrompu (voûté, capuche tombante, yeux rougeoyants, pioche à l\'épaule) et son contremaître blindé — 1 pack sur 2 est mené par ce boss massif bardé de pointes, plus gros et qui loot plus (bonus élite ×1.5-1.6 déjà en place)'},
      {t:'new', tx:'Décor de carrière dédié à la Mine de Fer : terre rouge/ocre, tours de guet en bois, pitons rocheux, chariots de minerai cassés, crevasses et éboulis — fini le décor générique'},
      {t:'fix', tx:'Trouvé un bug silencieux présent depuis toujours : la fonction de bruit du décor ne pouvait mathématiquement jamais dépasser 0.5 (bit de signe annulé dans le mélange final), donc AUCUN rocher/buisson/touffe n\'apparaissait dans les zones de combat. Corrigé : toutes les zones retrouvent leur végétation et leurs rochers'},
    ], en:[
      {t:'new', tx:'New original silhouettes for the Abandoned Iron Mine: the Corrupted Miner (hunched, drooping hood, glowing eyes, pickaxe on the shoulder) and its armored foreman — every other pack is led by this massive spiked boss, bigger and with better loot (the ×1.5-1.6 elite bonuses already in place)'},
      {t:'new', tx:'Dedicated quarry scenery for the Iron Mine: red/ochre earth, wooden watchtowers, rock spires, broken ore carts, crevasses and scree — no more generic scenery'},
      {t:'fix', tx:'Found a silent bug present since forever: the scenery noise function could mathematically never exceed 0.5 (sign bit self-cancelled in the final mix), so NO rocks/bushes/tufts ever appeared in combat zones. Fixed: every zone gets its vegetation and rocks back'},
    ] },
  { v:'V121', d:'05/07/2026 01:41', name:{fr:'Silhouette du Combattant Sausan', en:'Sausan Fighter silhouette'}, fr:[
      {t:'new', tx:'Nouvelle silhouette originale pour le Combattant Sausan (Colonie Sausan, juste après la Ferme Shultz) : guerrier des sables en cotte de mailles, capuche pointue rabattue, voile de tissu masquant le bas du visage et cimeterre courbe — au lieu de la silhouette générique. Son icône apparaît aussi en haut à gauche'},
    ], en:[
      {t:'new', tx:'New original silhouette for the Sausan Fighter (Sausan Colony, right after Shultz Farm): a desert warrior in chainmail with a pointed hood, a cloth veil over the lower face and a curved scimitar — instead of the generic silhouette. Its icon also appears in the top-left'},
    ] },
  { v:'V120', d:'05/07/2026 01:35', name:{fr:'Icône du monstre de zone, silhouette Garde Shultz', en:'Zone monster icon, Shultz Guard silhouette'}, fr:[
      {t:'new', tx:'Petite icône du monstre de la zone en cours affichée en haut à gauche de l\'écran de jeu (buste simplifié, une par zone déjà modélisée, feuillage doré pour Velia la zone paisible)'},
      {t:'new', tx:'Nouvelle silhouette originale pour le Garde Shultz (Ferme Shultz, juste après le Camp Rhutum) : garde humain lourdement blindé, casque à cimier empanaché, épaulières massives, moustache/bouc blanc et arme lourde brandie au-dessus de la tête'},
    ], en:[
      {t:'new', tx:'Small icon of the current zone\'s monster shown in the top-left of the game screen (simplified bust, one per already-modeled zone, golden foliage for Velia the peaceful zone)'},
      {t:'new', tx:'New original silhouette for the Shultz Guard (Shultz Farm, right after Rhutum Camp): a heavily armored human guard with a plumed helmet, massive pauldrons, white mustache/goatee, and a heavy weapon raised overhead'},
    ] },
  { v:'V119', d:'05/07/2026 01:24', name:{fr:'Silhouette du Guerrier Rhutum, taux de gain silver (admin)', en:'Rhutum Warrior silhouette, silver earn rate (admin)'}, fr:[
      {t:'new', tx:'Nouvelle silhouette originale pour le Guerrier Rhutum (Camp Rhutum, juste après le Repaire des Pirates) : humanoïde massif à peau verte, crâne à crête de plumes, bouc tressé et défenses — au lieu de la silhouette générique'},
      {t:'new', tx:'Onglet admin "Silver" : nouveau tableau "Qui gagne le plus vite ?" — classe les joueurs par taux de gain à vie (silver gagné ÷ temps de jeu), pour voir d\'un coup d\'œil qui progresse vite et en combien de temps, pas juste qui a le plus gros total'},
      {t:'change', tx:'Les tableaux "Richesses" et "Silver" du panneau admin affichent désormais le pseudo du joueur au lieu d\'un UUID tronqué illisible'},
    ], en:[
      {t:'new', tx:'New original silhouette for the Rhutum Warrior (Rhutum Camp, right after the Pirate Hideout): a massive green-skinned humanoid with a feathered crest, braided goatee and tusks — instead of the generic silhouette'},
      {t:'new', tx:'Admin "Silver" tab: new "Who earns fastest?" table — ranks players by lifetime earn rate (silver earned ÷ playtime), to see at a glance who\'s progressing fast and in how much time, not just who has the biggest total'},
      {t:'change', tx:'The admin panel\'s "Wealth" and "Silver" tables now show the player\'s pseudo instead of an unreadable truncated UUID'},
    ] },
  { v:'V118', d:'05/07/2026 01:17', name:{fr:'Record kills/min (classement + admin), tooltip inventaire', en:'Kills/min record (leaderboard + admin), inventory tooltip'}, fr:[
      {t:'new', tx:'Nouveau record personnel "🏹 Kills/min" (à vie) : visible dans un nouveau classement dédié ET dans la liste des joueurs du panneau admin. Le record ne se met à jour qu\'après 2 min de session pour éviter qu\'un petit échantillon bruité ne le fausse'},
      {t:'change', tx:'Ajout d\'une infobulle sur le bouton "🎒 Inventaire" du panneau admin, expliquant ce qu\'il ouvre (équipement + sac complet en lecture seule, dans une nouvelle fenêtre)'},
    ], en:[
      {t:'new', tx:'New personal "🏹 Kills/min" (lifetime) record: shown in a new dedicated leaderboard AND in the admin panel\'s player list. The record only updates after 2 min of session to avoid a noisy small sample skewing it'},
      {t:'change', tx:'Added a tooltip on the admin panel\'s "🎒 Inventory" button, explaining what it opens (gear + full bag, read-only, in a new window)'},
    ] },
  { v:'V117', d:'05/07/2026 01:06', name:{fr:'Refonte panneau Admin : rôles fusionnés, suivi du silver', en:'Admin panel refresh: merged roles, silver tracking'}, fr:[
      {t:'fix', tx:'Corrigé le rendu disgracieux du bouton "↩️ Racheter" superposé sur "Vendre" (bordures qui se chevauchaient) : le groupe entier porte maintenant une seule bordure/dégradé, les 2 boutons à l\'intérieur sont transparents avec un simple séparateur'},
      {t:'change', tx:'Section admin "Rembourser un clic Vendre mat" retirée : "Vendre mat." est verrouillé 🔒 (pas encore en jeu), ce bouton n\'avait donc plus lieu d\'être'},
      {t:'change', tx:'Les sections "Modérateurs" et "Testeurs" du panneau admin sont fusionnées en une seule section "Rôles" : un seul champ UUID + un menu déroulant pour choisir le rôle, une seule liste combinée (un joueur peut cumuler les deux rôles)'},
      {t:'new', tx:'Nouvel onglet "🏦 Silver" dans le panneau admin, sur le même principe que l\'onglet Loyalties : voir d\'un coup d\'œil le silver stocké chez les joueurs, le total gagné à vie, et le total dépensé (sorti du jeu via l\'optimisation), avec une barre de répartition visuelle'},
      {t:'change', tx:'Petit rafraîchissement visuel du panneau admin : cartes de section avec ombre légère et survol, + une légende de code couleur (bleu/rouge/vert) affichée en haut pour comprendre le niveau de risque de chaque section d\'un coup d\'œil'},
    ], en:[
      {t:'fix', tx:'Fixed the ugly rendering of the "↩️ Buy back" button overlapping "Sell" (overlapping borders): the whole group now carries a single border/gradient, with the 2 inner buttons transparent and a simple divider'},
      {t:'change', tx:'Removed the admin "Refund a Sell mats click" section: "Sell mats" is locked 🔒 (not in game yet), so this button no longer served a purpose'},
      {t:'change', tx:'The admin panel\'s "Moderators" and "Testers" sections are now merged into one "Roles" section: a single UUID field + a role dropdown, one combined list (a player can hold both roles)'},
      {t:'new', tx:'New "🏦 Silver" tab in the admin panel, on the same principle as the Loyalties tab: see at a glance the silver stored with players, total lifetime earned, and total spent (sunk via enhancement), with a visual breakdown bar'},
      {t:'change', tx:'Small visual refresh of the admin panel: section cards now have a light shadow and hover effect, plus a color-code legend (blue/red/green) shown at the top to understand each section\'s risk level at a glance'},
    ] },
  { v:'V116', d:'05/07/2026 00:52', name:{fr:'Inventaire admin complet, boutons 50/50', en:'Full admin inventory, 50/50 buttons'}, fr:[
      {t:'fix', tx:'La fenêtre popup "Inventaire" du panneau admin n\'affichait qu\'une grille brute — elle montre maintenant l\'équipement porté (comme le paperdoll normal) ET les 5 onglets de catégorie (Normal/Optimisation/Consommable/RNG/Trésors), comme dans l\'inventaire du joueur'},
      {t:'change', tx:'Boutons "Équiper meilleur" / "Vendre" : répartition stricte 50%/50% au lieu de 66%/34%. Le bouton "↩️ Racheter" n\'est plus un 3e bouton séparé : il se superpose désormais sur le coin droit de "Vendre" (15% de sa largeur) pour bien montrer qu\'il annule sa dernière action. Les 3 boutons ont chacun une infobulle expliquant leur fonctionnement au survol'},
    ], en:[
      {t:'fix', tx:'The admin panel\'s "Inventory" popup window only showed a raw grid — it now also shows the equipped gear (like the normal paperdoll) AND the 5 category tabs (Normal/Enhancement/Consumable/RNG/Treasures), matching the player\'s own inventory view'},
      {t:'change', tx:'"Equip best" / "Sell" buttons: strict 50%/50% split instead of 66%/34%. The "↩️ Buy back" button is no longer a separate 3rd button: it now overlaps the right edge of "Sell" (15% of its width) to make clear it undoes that specific action. All 3 buttons now have a hover tooltip explaining what they do'},
    ] },
  { v:'V115', d:'05/07/2026 00:38', name:{fr:'Silhouette originale du Pirate (Repaire des Pirates)', en:'Original Pirate silhouette (Pirate Hideout)'}, fr:[
      {t:'new', tx:'Nouvelle silhouette originale pour le Pirate (Repaire des Pirates, juste après Ruines de Protty) : humanoïde barbu au bandana rouge, torse entrouvert, lame à la main qui s\'étend lors de l\'attaque — au lieu de la silhouette générique partagée par les autres zones'},
    ], en:[
      {t:'new', tx:'New original silhouette for the Pirate (Pirate Hideout, right after Protty Ruins): a bearded humanoid with a red bandana, open vest, and a blade that extends on attack — instead of the generic silhouette shared by other zones'},
    ] },
  { v:'V114', d:'05/07/2026 00:29', name:{fr:'Vrai correctif Velia, silhouette des Esprits de Protty', en:'Real Velia fix, Protty Spirit silhouette'}, fr:[
      {t:'fix', tx:'Trouvé la vraie cause des monstres qui revenaient dans Velia (zone paisible) : la boucle de jeu re-générait des packs dès que leur nombre passait sous 6, SANS vérifier qu\'on était à Velia — ça remplissait la zone en boucle juste après le "aucun monstre" du chargement. Corrigé : à Velia, le joueur reste maintenant immobile et rien ne se passe, comme prévu'},
      {t:'new', tx:'Nouvelle silhouette originale pour l\'Esprit de Protty (Ruines de Protty) : créature flottante façon mollusque/poisson fantomatique (dôme, frange de nageoires ondulantes), au lieu de la silhouette générique partagée par toutes les zones'},
    ], en:[
      {t:'fix', tx:'Found the real cause of monsters reappearing in Velia (peaceful zone): the game loop kept respawning packs whenever their count dropped below 6, WITHOUT checking if we were in Velia — it kept refilling the zone right after the "no monsters" load. Fixed: in Velia the player now stays still and nothing happens, as intended'},
      {t:'new', tx:'New original silhouette for the Protty Spirit (Protty Ruins): a floating ghostly mollusk/fish-like creature (dome, wavy fin fringe), instead of the generic silhouette shared by all zones'},
    ] },
  { v:'V113', d:'05/07/2026 00:23', name:{fr:'Boutons inventaire raccourcis (robuste à toute largeur)', en:'Shortened inventory buttons (robust at any width)'}, fr:[
      {t:'fix', tx:'"Équiper le meilleur (socle)" et "Vendre l\'inférieur" se tronquaient encore en pleine largeur de fenêtre plus étroite ("soc e", "Ven...") — raccourcis en "Équiper meilleur" et "Vendre", le sens complet reste visible au survol'},
    ], en:[
      {t:'fix', tx:'"Equip best (base stats)" and "Sell the worse" still got cut off on narrower windows ("bas...", "Sel...") — shortened to "Equip best" and "Sell worse", full meaning still shown on hover'},
    ] },
  { v:'V112', d:'05/07/2026 00:18', name:{fr:'Correctifs : reset des Loyalties, bouton tronqué', en:'Fixes: Loyalties reset, truncated button'}, fr:[
      {t:'fix', tx:'Corrigé : les Loyalties n\'étaient jamais vraiment remises à 0 après un reset — le rafraîchissement de l\'affichage juste après regrantait aussitôt les 200 du jour, masquant la remise à zéro réelle'},
      {t:'fix', tx:'Le bouton "Vendre l\'inférieur" s\'affichait tronqué ("Ven...") — élargi pour afficher le texte en entier'},
    ], en:[
      {t:'fix', tx:'Fixed: Loyalties were never actually reset to 0 after a reset — the display refresh right after immediately re-granted the day\'s 200, masking the real reset'},
      {t:'fix', tx:'The "Sell the worse" button displayed truncated ("Sel...") — widened to show the full text'},
    ] },
  { v:'V111', d:'04/07/2026 23:47', name:{fr:'Marché Central façon BDO, chat par jour, Loyalties', en:'BDO-style Central Market, daily chat, Loyalties'}, fr:[
      {t:'new',    tx:'Marché commun repensé façon Marché Central de BDO (inspiré d\'une référence fournie) : solde bien visible, arbre de catégories (Arme principale/secondaire/éveil, Armure, Accessoires, Artéfact/Pierre, Matériaux), objets groupés par nom avec tiroir détaillé par niveau d\'enchantement (+13/+14/.../PRI/DUO...)'},
      {t:'new',    tx:'Chat : chaque jour est séparé par une barre dorée ; les jours précédents sont repliés par défaut (dépliables en un clic pour relire), seul le jour en cours reste toujours ouvert'},
      {t:'change',  tx:'Les notifications affichent maintenant toujours la date complète, pas seulement l\'heure'},
      {t:'change',  tx:'Renommé "Points de fidélité" en "Loyalties" (déjà stackables chaque jour et récupérables à tout moment, 200/jour, dans le Courrier)'},
      {t:'new',    tx:'Nouvel onglet "🏅 Loyalties" dans le panneau admin : total en jeu, moyenne par joueur (pas encore de boutique où les dépenser)'},
    ], en:[
      {t:'new',    tx:'Common market redesigned in the style of BDO\'s Central Market (inspired by a provided reference): balance clearly visible, category tree (Main/Secondary/Awakening weapon, Armor, Accessories, Artifact/Stone, Materials), items grouped by name with a detailed drawer per enhancement level (+13/+14/.../PRI/DUO...)'},
      {t:'new',    tx:'Chat: each day is separated by a golden bar; previous days are collapsed by default (expandable with one click to reread), only the current day stays always open'},
      {t:'change',  tx:'Notifications now always show the full date, not just the time'},
      {t:'change',  tx:'Renamed "Loyalty Points" to "Loyalties" (already stackable daily and claimable anytime, 200/day, in the Mailbox)'},
      {t:'new',    tx:'New "🏅 Loyalties" tab in the admin panel: total in game, average per player (no shop to spend it on yet)'},
    ] },
  { v:'V110', d:'04/07/2026 23:14', name:{fr:'Audit anti-triche & notifications refaites', en:'Anti-cheat audit & reworked notifications'}, fr:[
      {t:'fix',     tx:'Corrigé un "NaN%" possible sur la barre de vie du boss (division par zéro si les PV max valent 0, ex: juste après un despawn)'},
      {t:'exploit', tx:'Faille trouvée en audit : sur le marché, un vendeur pouvait mettre en vente un objet sans valeur en étiquetant l\'annonce comme un objet précieux (arnaque à l\'appât) — le nom/type de l\'annonce est désormais TOUJOURS recalculé depuis l\'objet réellement en vente, jamais depuis ce que le client prétend'},
      {t:'change',  tx:'Centre de notifications entièrement refait : regroupé en 3 sections claires (⚠️ Important, 🏆 Réussites, 📰 Activité) avec un code couleur par catégorie, au lieu d\'une simple liste plate'},
    ], en:[
      {t:'fix',     tx:'Fixed a possible "NaN%" on the boss HP bar (division by zero if max HP is 0, e.g. right after a despawn)'},
      {t:'exploit', tx:'Flaw found in audit: on the market, a seller could list a worthless item while labeling it as a valuable one (bait-and-switch scam) — the listing\'s name/type is now ALWAYS recalculated from the item actually being sold, never from what the client claims'},
      {t:'change',  tx:'Notification center fully reworked: grouped into 3 clear sections (⚠️ Important, 🏆 Achievements, 📰 Activity) with a color code per category, instead of a flat list'},
    ] },
  { v:'V109', d:'04/07/2026 17:00', name:{fr:'Marché en vitrine & correctif zones de farm', en:'Marketplace browse view & farm zones fix'}, fr:[
      {t:'new',    tx:'Marché commun repensé en vitrine (inspirée d\'une référence fournie) : parcours les objets en vente sous forme de cartes (icône, vendeur, temps, prix), avec filtre par catégorie, recherche, tri, et un panneau de détail complet avec comparaison face à ton équipement actuel'},
      {t:'new',    tx:'Achat en un clic depuis la vitrine : pose automatiquement un ordre d\'achat au prix exact de l\'annonce (exécution immédiate garantie)'},
      {t:'fix',    tx:'La liste des zones de farm laissait un grand vide en bas de sa carte (la grille étire toutes les cartes d\'une rangée à la même hauteur) — la liste remplit maintenant tout l\'espace disponible, de haut en bas'},
    ], en:[
      {t:'new',    tx:'Common market redesigned as a browsable storefront (inspired by a provided reference): browse listings as cards (icon, seller, time, price), with category filter, search, sort, and a full detail panel comparing against your currently equipped gear'},
      {t:'new',    tx:'One-click buy from the storefront: automatically places a buy order at the listing\'s exact price (guaranteed instant execution)'},
      {t:'fix',    tx:'The farm zone list left a large empty gap at the bottom of its card (the grid stretches every card in a row to the same height) — the list now fills all available space, top to bottom'},
    ] },
  { v:'V108', d:'04/07/2026 16:49', name:{fr:'Nouveaux emplacements, icônes teintées par palier', en:'New slots, tier-tinted icons'}, fr:[
      {t:'new',    tx:'Atelier royal ajouté dans le header (verrouillé, bientôt disponible)'},
      {t:'new',    tx:'3 nouveaux emplacements d\'équipement : 2 Artéfacts (ex: Vell, Khan) + 1 Pierre — pas encore de source de drop en jeu, prêts pour une future mise à jour'},
      {t:'change', tx:'Bouton "↩️ Racheter" réduit à une icône compacte, regroupé juste à côté de "Vendre l\'inférieur" (1/5 de la largeur) au lieu d\'un gros bouton séparé'},
      {t:'change', tx:'Nouvelles icônes pour l\'armure, les gants et les bottes : chaque pièce prend maintenant la vraie couleur de son palier (gris/blanc/vert/bleu) au lieu d\'une couleur fixe'},
      {t:'change', tx:'Nouvelles icônes de bijoux progressives selon le palier : anneau nu (gris/blanc) → un diamant (vert) → plusieurs diamants et couleur du palier (bleu)'},
    ], en:[
      {t:'new',    tx:'Royal Workshop added to the header (locked, coming soon)'},
      {t:'new',    tx:'3 new equipment slots: 2 Artifacts (e.g. Vell, Khan) + 1 Stone — no drop source yet, ready for a future update'},
      {t:'change', tx:'"↩️ Buy back" button shrunk to a compact icon, grouped right next to "Sell the worse" (1/5 of the width) instead of a big separate button'},
      {t:'change', tx:'New icons for armor, gloves and boots: each piece now takes the real color of its tier (grey/white/green/blue) instead of a fixed color'},
      {t:'change', tx:'New progressive jewelry icons by tier: bare ring (grey/white) → one diamond (green) → several diamonds and tier color (blue)'},
    ] },
  { v:'V107', d:'04/07/2026 16:38', name:{fr:'Économie retravaillée & vrai marché à ordres', en:'Reworked economy & real order-book market'}, fr:[
      {t:'change', tx:'Économie de Velia entièrement retravaillée : le silver/h moyen progresse maintenant de ~3 000/h (zone 1) à 100 000/h max (zone 11, stuff optimisé) au lieu de plusieurs millions/h — ce plafond correspond au bas de la nouvelle courbe à 5 régions (Velia 0-100k/h, Heidel 100k-1M/h, Calpheon 1M-100M/h, Valencia 100M-1B/h, Edana 1B-10B/h, voir zones-roadmap.md)'},
      {t:'new',    tx:'Marché commun entièrement refait : vrai carnet d\'ordres entre joueurs (achat ET vente), au lieu d\'un prix flottant avec achat/vente instantanés. Chacun pose le prix qu\'il veut ; ton silver (achat) ou ton objet (vente) reste bloqué tant que l\'ordre n\'est pas exécuté ou annulé'},
      {t:'new',    tx:'L\'exécution est automatique dès qu\'un ordre d\'achat et un ordre de vente compatibles existent (prix d\'achat ≥ prix de vente) ; en cas d\'égalité de prix entre plusieurs ordres, un tirage au sort désigne qui est servi'},
      {t:'new',    tx:'Le marché commun accepte maintenant aussi l\'équipement et les bijoux trouvés en jeu (pas seulement les matériaux), regroupés par nom + niveau d\'enchantement'},
      {t:'new',    tx:'Nouvel onglet "Mes ordres" dans le marché commun pour suivre et annuler ses ordres en cours'},
    ], en:[
      {t:'change', tx:'Velia\'s economy fully reworked: average silver/h now progresses from ~3,000/h (zone 1) to 100,000/h max (zone 11, optimized gear) instead of several million/h — this cap matches the bottom of the new 5-region curve (Velia 0-100k/h, Heidel 100k-1M/h, Calpheon 1M-100M/h, Valencia 100M-1B/h, Edana 1B-10B/h, see zones-roadmap.md)'},
      {t:'new',    tx:'Common market fully rebuilt: a real order book between players (buy AND sell), instead of a floating price with instant buy/sell. Everyone sets their own price; your silver (buy) or item (sell) stays locked until the order is filled or cancelled'},
      {t:'new',    tx:'Execution is automatic as soon as a compatible buy and sell order exist (buy price ≥ sell price); tied prices are settled by a random draw'},
      {t:'new',    tx:'The common market now also accepts gear and jewelry found in-game (not just materials), grouped by name + enhancement level'},
      {t:'new',    tx:'New "My orders" tab in the common market to track and cancel your open orders'},
    ] },
  { v:'V106', d:'04/07/2026 16:08', name:{fr:'Loot ticker, reset admin réparé, couleurs du stuff', en:'Loot ticker, fixed admin reset, gear colors'}, fr:[
      {t:'fix', tx:'Corrigé le sens d\'arrivée du loot ticker : les nouvelles entrées apparaissaient en haut (déjà estompées) et les anciennes en bas (bien visibles juste avant d\'être supprimées) — l\'inverse de l\'effet voulu, désormais les nouvelles entrées arrivent nettes en bas et remontent en s\'estompant'},
      {t:'fix', tx:'Trouvé pourquoi "Réinitialiser TOUS les comptes" ne fonctionnait pas : Supabase bloque les UPDATE/DELETE sans clause WHERE (confirmé dans les logs), même pour un reset global volontaire — corrigé'},
      {t:'fix', tx:'Le stuff (équipement ET matériaux d\'optimisation) se ressemblait dans le sac quel que soit son palier : les icônes SVG ont leurs couleurs figées dans le tracé, le style posé par-dessus n\'avait donc aucun effet. Corrigé en teintant la bordure de chaque case avec la vraie couleur du palier (gris/blanc/vert/bleu) ou du matériau'},
    ], en:[
      {t:'fix', tx:'Fixed the loot ticker\'s arrival direction: new entries appeared at the top (already faded) and old ones at the bottom (fully visible right before removal) — the opposite of the intended effect; new entries now arrive crisp at the bottom and fade as they move up'},
      {t:'fix', tx:'Found why "Reset ALL accounts" didn\'t work: Supabase blocks UPDATE/DELETE without a WHERE clause (confirmed in the logs), even for an intentional global reset — fixed'},
      {t:'fix', tx:'Gear and enhancement materials all looked alike in the bag regardless of tier: SVG icons have their colors baked into the artwork, so the color style layered on top had no effect. Fixed by tinting each cell\'s border with the real tier color (grey/white/green/blue) or material color'},
    ] },
  { v:'V105', d:'04/07/2026 15:55', name:{fr:'Bijoux alignés sur les vrais paliers BDO', en:'Jewelry aligned with real BDO tiers'}, fr:[
      {t:'change', tx:'Les bijoux rares (jackpot) des 11 zones de Velia utilisent maintenant les vrais noms BDO alignés sur le palier de stuff de la zone : Naru (gris), Tuvala (blanc), Asula (vert), Cadry/Serap (bleu) — un anneau, un collier et une ceinture par palier'},
    ], en:[
      {t:'change', tx:'Rare jewelry (jackpot) drops across the 11 Velia zones now use real BDO names matching the zone\'s gear tier: Naru (grey), Tuvala (white), Asula (green), Cadry/Serap (blue) — one ring, one necklace and one belt per tier'},
    ] },
  { v:'V104', d:'04/07/2026 15:19', name:{fr:'Reset complet des comptes & annonce dédiée', en:'Full account reset & dedicated announcement'}, fr:[
      {t:'new',    tx:'Nouveau bouton admin "💥 Réinitialiser TOUS les comptes" : efface silver/équipement/niveau/sac de tout le monde, et affiche une bannière colorée d\'explication (+ une entrée dans les notifications) à chaque joueur à sa prochaine connexion'},
      {t:'change', tx:'Le centre de notifications ne garde plus que les infos importantes (succès, boss vaincu, niveau supérieur) — les trouvailles de loot (bijoux/équipement rares) restent visibles dans le loot ticker mais ne polluent plus plus les notifications'},
    ], en:[
      {t:'new',    tx:'New admin button "💥 Reset ALL accounts": wipes silver/gear/level/bag for everyone, and shows a colorful explanation banner (+ a notification entry) to each player on their next login'},
      {t:'change', tx:'The notification center now only keeps important info (achievements, boss defeated, level up) — rare loot finds (jewelry/gear) stay visible in the loot ticker but no longer clutter notifications'},
    ] },
  { v:'V103', d:'04/07/2026 15:08', name:{fr:'Panneau admin bien plus rapide à l\'ouverture', en:'Admin panel opens much faster'}, fr:[
      {t:'fix', tx:'Trouvé la cause de la lenteur au clic sur "Zone Admin" : une vue serveur ("Ressources farmées") scannait TOUTE la table des ramassages (79 000+ lignes et ça grandit à chaque objet ramassé par tous les joueurs, depuis le début) sans aucune limite de temps — corrigée pour se limiter aux 30 derniers jours'},
      {t:'change', tx:'Le panneau admin s\'ouvre maintenant dès que la liste des joueurs est prête, sans attendre les 3 statistiques les plus lourdes (silver/heure, ressources farmées, richesses) qui se chargent maintenant en arrière-plan et remplissent leur onglet dès qu\'elles sont prêtes'},
    ], en:[
      {t:'fix', tx:'Found the cause of the "Admin Zone" click being slow: a server view ("Farmed resources") scanned the ENTIRE pickup log table (79,000+ rows and growing with every item picked up by every player, since the start) with no time limit at all — fixed to only look at the last 30 days'},
      {t:'change', tx:'The admin panel now opens as soon as the player list is ready, without waiting for the 3 heaviest stats (silver/hour, farmed resources, wealth) which now load in the background and fill in their tab once ready'},
    ] },
  { v:'V102', d:'04/07/2026 15:00', name:{fr:'Difficulté retravaillée, bouton "Racheter"', en:'Reworked difficulty, "Buy back" button'}, fr:[
      {t:'change', tx:'Difficulté de toute la région de Velia retravaillée : PA requis plafonné à 209 (au lieu de 400) sur la dernière zone, avec un saut plus marqué à chaque transition de palier de stuff (gris→blanc, blanc→vert, vert→bleu) — il faut être un minimum optimisé sur le palier précédent avant d\'attaquer le suivant'},
      {t:'new',    tx:'Bouton "↩️ Racheter" à côté de "Vendre l\'inférieur" : annule la dernière vente automatique (restaure les objets et le silver) en cas de clic accidentel'},
    ], en:[
      {t:'change', tx:'Reworked the difficulty of the whole Velia region: required AP capped at 209 (down from 400) on the last zone, with a sharper jump at every gear-tier transition (grey→white, white→green, green→blue) — you need to be at least somewhat enhanced on the previous tier before tackling the next one'},
      {t:'new',    tx:'"↩️ Buy back" button next to "Sell the worse": undoes the last automatic sale (restores items and silver) after an accidental click'},
    ] },
  { v:'V101', d:'04/07/2026 12:41', name:{fr:'Boss partagé enfin réparé, panneau admin retravaillé', en:'Shared boss finally fixed, reworked admin panel'}, fr:[
      {t:'fix',    tx:'Trouvé et corrigé LE bug qui empêchait le boss mondial d\'être partagé depuis le début : une erreur SQL silencieuse ("column reference ambiguous") faisait échouer chaque tentative d\'infliger des dégâts au boss partagé — les PV n\'ont donc jamais bougé, le classement de contribution est resté vide, confirmé par test réel et reproduction isolée du bug'},
      {t:'new',    tx:'Bouton admin pour faire disparaître le World Boss pour tout le monde à tout moment'},
      {t:'change', tx:'Un World Boss disparaît désormais au bout de 9 minutes (au lieu de 15)'},
      {t:'change', tx:'Onglet Joueurs (panneau admin) : 2 boutons dédiés "UUID" et "Inventaire" au lieu du clic-sur-la-ligne ; l\'inventaire s\'ouvre maintenant dans une vraie fenêtre séparée et revient sur le panneau admin à sa fermeture'},
      {t:'change', tx:'Panneau admin retravaillé : bordure colorée par niveau de risque (bleu = sans danger sur ton compte, rouge = touche tous les joueurs, vert = gestion staff) + description sous chaque section'},
      {t:'change', tx:'Le palier Grunil (bleu) a maintenant son propre matériau "Pierre concentrée" — la Pierre Noire est désormais réservée au palier Yuria (vert)'},
    ], en:[
      {t:'fix',    tx:'Found and fixed THE bug that had prevented the world boss from ever being shared: a silent SQL error ("column reference ambiguous") made every attempt to damage the shared boss fail — HP never moved, the contribution leaderboard stayed empty, confirmed via real testing and an isolated bug reproduction'},
      {t:'new',    tx:'Admin button to despawn the World Boss for everyone at any time'},
      {t:'change', tx:'A World Boss now despawns after 9 minutes (instead of 15)'},
      {t:'change', tx:'Players tab (admin panel): 2 dedicated buttons "UUID" and "Inventory" instead of click-the-row; inventory now opens in a real separate window and returns to the admin panel when closed'},
      {t:'change', tx:'Reworked admin panel: color-coded border by risk level (blue = safe on your own account, red = affects all players, green = staff management) + a short description under each section'},
      {t:'change', tx:'The Grunil (blue) tier now has its own "Concentrated Stone" material — Black Stone is now reserved for the Yuria (green) tier'},
    ] },
  { v:'V100', d:'04/07/2026 12:22', name:{fr:'Corrections, sécurité & classement Trésors', en:'Fixes, security & Treasure leaderboard'}, fr:[
      {t:'fix',     tx:'Corrigé le faux positif anti-triche "silver_per_hour astronomique" juste après le chargement d\'une sauvegarde (le calcul utilisait un compteur à vie divisé par un temps de session erroné)'},
      {t:'fix',     tx:'Les chances du Trésor de Velia étaient 100× trop généreuses (0.01 interprété comme 1% au lieu de 0.01%) — corrigées'},
      {t:'exploit', tx:'Corrigé 2 failles XSS trouvées en audit : le pseudo affiché dans le Classement et dans la liste de filleuls n\'était pas échappé (un pseudo malveillant pouvait exécuter du code chez les autres joueurs qui le consultaient)'},
      {t:'new',     tx:'Nouveau classement "🗺️ Trésors" (nombre de morceaux du Trésor de Velia ramassés à vie)'},
      {t:'new',     tx:'2 nouveaux succès "Chercheur/Chasseur de trésor"'},
      {t:'new',     tx:'Panneau admin : estimation du nombre moyen de monstres à tuer (et du temps) pour chaque morceau du Trésor de Velia'},
      {t:'change',  tx:'Wiki, codex et succès mis à jour pour refléter le Trésor de Velia, les zones groupées par palier et le boss Kzarka partagé'},
    ], en:[
      {t:'fix',     tx:'Fixed the "astronomical silver_per_hour" anti-cheat false positive right after loading a save (the calculation used a lifetime counter divided by a broken session time)'},
      {t:'fix',     tx:'Velia Treasure chances were 100× too generous (0.01 read as 1% instead of 0.01%) — corrected'},
      {t:'exploit', tx:'Fixed 2 XSS flaws found in an audit: the displayed pseudo in the Leaderboard and referral list wasn\'t escaped (a malicious pseudo could run code for other players viewing it)'},
      {t:'new',     tx:'New "🗺️ Treasures" leaderboard (lifetime Velia Treasure pieces collected)'},
      {t:'new',     tx:'2 new "Treasure seeker/hunter" achievements'},
      {t:'new',     tx:'Admin panel: average number of monsters to kill (and time) for each Velia Treasure piece'},
      {t:'change',  tx:'Wiki, codex and achievements updated to reflect the Velia Treasure, tier-grouped zones and the shared Kzarka boss'},
    ] },
  { v:'V99', d:'04/07/2026 12:04', name:{fr:'Nouvel inventaire "Trésors"', en:'New "Treasures" inventory'}, fr:[
      {t:'new', tx:'Nouvel onglet d\'inventaire dédié "🗺️ Trésors" pour ranger les objets du Trésor de Velia séparément du reste'},
    ], en:[
      {t:'new', tx:'New dedicated "🗺️ Treasures" inventory tab to store Velia Treasure items separately from the rest'},
    ] },
  { v:'V98', d:'04/07/2026 12:03', name:{fr:'Trésor de Velia (catégorie TEST)', en:'Velia Treasure (TEST category)'}, fr:[
      {t:'new', tx:'Toutes les zones de Velia peuvent désormais looter le "Trésor de Velia" : 5 objets collectibles (Bout du trésor de Velia 1 ×2 chances, Trésor de Velia 1/2/3), identiques dans toutes les zones'},
      {t:'new', tx:'Nouvelle catégorie "🧪 TEST" en bas de la table de loot de chaque zone pour ces objets expérimentaux (pas encore de recette/usage)'},
    ], en:[
      {t:'new', tx:'All Velia zones can now loot the "Velia Treasure": 5 collectible items (Velia Treasure Piece 1 ×2 chances, Velia Treasure 1/2/3), identical across every zone'},
      {t:'new', tx:'New "🧪 TEST" category at the bottom of each zone\'s loot table for these experimental items (no recipe/use yet)'},
    ] },
  { v:'V97', d:'04/07/2026 11:52', name:{fr:'Zones groupées par palier, boss Kzarka vraiment partagé', en:'Zones grouped by tier, truly shared Kzarka boss'}, fr:[
      {t:'new', tx:'La liste des zones de Velia est désormais groupée par palier de stuff (Naru/Tuvala/Yuria/Grunil), avec un en-tête coloré par groupe'},
      {t:'change', tx:'Dans la table de loot, les lignes "armure" et "matériau" reprennent la couleur du stuff correspondant dans l\'inventaire (gris/blanc/vert/bleu) au lieu d\'une couleur générique'},
      {t:'fix', tx:'Le Kzarka du planning horaire (pas seulement celui lancé par l\'admin) a maintenant des PV réellement partagés entre tous les joueurs, et tout le monde se voit dans l\'arène'},
    ], en:[
      {t:'new', tx:'The Velia zone list is now grouped by gear tier (Naru/Tuvala/Yuria/Grunil), with a colored header per group'},
      {t:'change', tx:'In the loot table, "armor" and "material" rows now use the matching gear color from the inventory (grey/white/green/blue) instead of a generic color'},
      {t:'fix', tx:'The scheduled Kzarka boss (not just the admin-spawned one) now has truly shared HP across all players, and everyone is visible in the arena'},
    ] },
  { v:'V96', d:'04/07/2026 11:44', name:{fr:'Village de Velia & pierres d\'optimisation en SVG', en:'Velia village & SVG optimization stones'}, fr:[
      {t:'new', tx:'Velia a désormais son propre décor de village paisible (maisons, puits, lampadaires, teinte chaleureuse) au lieu de réutiliser le terrain de la dernière zone de combat farmée'},
      {t:'new', tx:'Nouvelles icônes SVG originales (style pierre à facettes) pour les pierres d\'optimisation : Pierre de Novice, Pierre du Temps, Pierre Noire et Pierre de Caphras'},
    ], en:[
      {t:'new', tx:'Velia now has its own peaceful village scenery (houses, well, lamp posts, warm tint) instead of reusing the last farmed combat zone\'s terrain'},
      {t:'new', tx:'New original SVG icons (faceted stone style) for the optimization materials: Novice Stone, Time Stone, Black Stone and Caphras Stone'},
    ] },
  { v:'V95', d:'04/07/2026 10:56', name:{fr:'Menu repliable, mot de passe oublié, langue à la connexion', en:'Collapsible menu, forgot password, language at login'}, fr:[
      {t:'new', tx:'Bouton pour replier/déplier le menu latéral (état mémorisé)'},
      {t:'new', tx:'Bouton "Mot de passe oublié ?" sur l\'écran de connexion (envoie un email de réinitialisation)'},
      {t:'new', tx:'Choix de la langue (FR/EN) directement sur l\'écran de connexion/création de compte'},
    ], en:[
      {t:'new', tx:'Button to collapse/expand the side menu (state remembered)'},
      {t:'new', tx:'"Forgot password?" button on the login screen (sends a reset email)'},
      {t:'new', tx:'Language choice (FR/EN) directly on the login/signup screen'},
    ] },
  { v:'V94', d:'04/07/2026 10:45', name:{fr:'Vraies zones de Velia (11 zones remplacent les anciennes)', en:'Real Velia zones (11 zones replace the old ones)'}, fr:[
      {t:'change', tx:'Les 12 anciennes zones fictives sont remplacées par les 11 vraies zones de Velia : Camp des Loups, Ruines de Protty, Repaire des Pirates, Camp Rhutum, Ferme Shultz, Colonie Sausan, Mine de Fer Abandonnée, Poste Helm, Repaire Bandits Gahaz, Sanctuaire Elric, Ruines de Kratuga'},
      {t:'change', tx:'Progression PA/PD/loot inchangée (juste les noms de zones et de monstres qui changent) ; le palier Grunil couvre désormais 2 zones au lieu de 3 (11 zones au total)'},
    ], en:[
      {t:'change', tx:'The 12 old fictional zones are replaced by the 11 real Velia zones: Wolf Camp, Protty Ruins, Pirate Den, Rhutum Camp, Shultz Farm, Sausan Colony, Abandoned Iron Mine, Helm Post, Gahaz Bandit Lair, Elric Shrine, Kratuga Ruins'},
      {t:'change', tx:'AP/DP/loot progression unchanged (only zone and monster names change); the Grunil tier now covers 2 zones instead of 3 (11 zones total)'},
    ] },
  { v:'V93', d:'04/07/2026 10:39', name:{fr:'Onglets de région : juste le nom + pastille de couleur', en:'Region tabs: name only + color dot'}, fr:[
      {t:'change', tx:'Les onglets affichent juste le nom de la région (Velia/Heidel/Capheon/Valencia/Edana) sans préfixe Early/Mid/End, avec une pastille de couleur : vert, bleu, jaune, orange, rouge'},
    ], en:[
      {t:'change', tx:'Tabs now show just the region name (Velia/Heidel/Capheon/Valencia/Edana) without the Early/Mid/End prefix, with a color dot: green, blue, yellow, orange, red'},
    ] },
  { v:'V92', d:'04/07/2026 10:36', name:{fr:'5 régions planifiées : Velia/Heidel/Capheon/Valencia/Edana', en:'5 regions planned: Velia/Heidel/Capheon/Valencia/Edana'}, fr:[
      {t:'change', tx:'Les onglets de zones passent de 3 à 5 paliers : Early (Velia, en jeu), Mid (Heidel), End (Capheon), End+ (Valencia), End++ (Edana) — les 4 derniers restent verrouillés 🔒 en attendant leur construction'},
    ], en:[
      {t:'change', tx:'Zone tabs go from 3 to 5 tiers: Early (Velia, live), Mid (Heidel), End (Capheon), End+ (Valencia), End++ (Edana) — the last 4 remain locked 🔒 pending construction'},
    ] },
  { v:'V91', d:'04/07/2026 10:31', name:{fr:'Refonte du stuff Early : 4 paliers Naru/Tuvala/Yuria/Grunil + onglets Early/Mid/End', en:'Early gear overhaul: 4 tiers Naru/Tuvala/Yuria/Grunil + Early/Mid/End tabs'}, fr:[
      {t:'new', tx:'Onglets "Early / Mid / End" au-dessus de la liste des zones — Mid et End sont verrouillés 🔒 pour l\'instant, ils arriveront dans une future mise à jour'},
      {t:'new', tx:'Le stuff Early est réparti en 4 paliers (3 zones chacun) : ⬜ Naru (zones 1-3), ⬜ Tuvala (zones 4-6), 🟩 Yuria et 🟦 Grunil (zones 7-12)'},
      {t:'change', tx:'Chaque palier a désormais son propre matériau d\'optimisation (Pierre de Novice, Pierre du Temps, Pierre Noire) au lieu d\'un matériau générique par zone ; Yuria/Grunil ont une chance de drop fixe de 2% quelle que soit la zone'},
      {t:'new', tx:'Nouvelle conversion : 5 Poussière d\'esprit ancien → 1 Pierre de Caphras (bouton dans le cadre Optimisation) — la Pierre de Caphras ne se ramasse plus directement en zone'},
    ], en:[
      {t:'new', tx:'"Early / Mid / End" tabs above the zone list — Mid and End are locked 🔒 for now, coming in a future update'},
      {t:'new', tx:'Early gear is now split into 4 tiers (3 zones each): ⬜ Naru (zones 1-3), ⬜ Tuvala (zones 4-6), 🟩 Yuria and 🟦 Grunil (zones 7-12)'},
      {t:'change', tx:'Each tier now has its own enhancement material (Novice Stone, Time-worn Stone, Black Stone) instead of one generic material per zone; Yuria/Grunil have a fixed 2% drop chance regardless of zone'},
      {t:'new', tx:'New conversion: 5 Ancient Spirit Dust → 1 Caphras Stone (button in the Enhancement panel) — Caphras Stones no longer drop directly in zones'},
    ] },
  { v:'V90', d:'04/07/2026 09:57', name:{fr:'Optimisation auto, inventaire des joueurs (admin), loot ticker amélioré', en:'Auto-enhance, player inventory (admin), improved loot ticker'}, fr:[
      {t:'new', tx:'Optimisation : bouton "▶ Auto jusqu\'à" avec un palier au choix — tente automatiquement (et gère les rétrogradations) jusqu\'à atteindre ce palier ou tomber à court de matériau'},
      {t:'admin', tx:'Panneau Admin : bouton 🎒 dans l\'onglet Joueurs pour voir l\'inventaire complet (192 cases) de n\'importe quel joueur, en lecture seule'},
      {t:'change', tx:'Loot en direct : fondu des anciennes entrées plus prononcé, et les matériaux ont désormais leur propre couleur (bleu) au lieu du gris par défaut'},
    ], en:[
      {t:'new', tx:'Enhancement: "▶ Auto to" button with a chosen tier — automatically retries (handling downgrades) until reaching that tier or running out of material'},
      {t:'admin', tx:'Admin panel: 🎒 button in the Players tab to view any player\'s full inventory (192 slots), read-only'},
      {t:'change', tx:'Live loot: stronger fade on older entries, and materials now have their own color (blue) instead of the default gray'},
    ] },
  { v:'V89', d:'04/07/2026 09:42', name:{fr:'Log Discord (jeu + alertes triche)', en:'Discord logging (game + cheat alerts)'}, fr:[
      {t:'admin', tx:'Salon Discord "log général" : succès débloqués, boss vaincus, bijoux/équipement rares trouvés, et actions admin (mod/testeur, remboursement, boss global, reset quêtes, réévaluation marché) y sont désormais relayés automatiquement'},
      {t:'admin', tx:'Salon Discord "triche" séparé : alerte automatique quand l\'anti-triche serveur doit borner une valeur impossible (silver, gearscore, niveau, temps de jeu), avec le joueur et les valeurs concernées'},
    ], en:[
      {t:'admin', tx:'"General log" Discord channel: unlocked achievements, boss kills, rare gear/jewelry finds, and admin actions (mod/tester, refund, global boss, quest reset, market reevaluation) are now automatically relayed there'},
      {t:'admin', tx:'Separate "cheat" Discord channel: automatic alert when the server-side anti-cheat has to clamp an impossible value (silver, gearscore, level, playtime), with the player and the values involved'},
    ] },
  { v:'V88', d:'04/07/2026 09:23', name:{fr:'Admin : liste des joueurs + copie UUID', en:'Admin: player list + UUID copy'}, fr:[
      {t:'admin', tx:'Nouvel onglet "👥 Joueurs" dans le panneau Admin : liste de tous les joueurs inscrits avec statut en ligne, silver, GS, niveau — clique une ligne pour copier son UUID'},
      {t:'admin', tx:'Depuis le classement, le stuff d\'un joueur consulté par l\'admin propose désormais un bouton "📋 Copier UUID"'},
    ], en:[
      {t:'admin', tx:'New "👥 Players" tab in the Admin panel: list of all registered players with online status, silver, GS, level — click a row to copy its UUID'},
      {t:'admin', tx:'From the leaderboard, a player\'s gear viewed by the admin now offers a "📋 Copy UUID" button'},
    ] },
  { v:'V87', d:'04/07/2026 09:14', name:{fr:'Widget Suivi : explications sur les timers et le temps de jeu', en:'Tracker widget: timer and playtime clarifications'}, fr:[
      {t:'change', tx:'Le widget de suivi explique désormais (au survol) que "Journ." et "Hebdo" sont le temps avant la remise à zéro des quêtes, et sépare visuellement la section "Temps de jeu" (Total/Aujourd\'hui)'},
    ], en:[
      {t:'change', tx:'The tracker widget now explains (on hover) that "Daily" and "Weekly" are the time before quests reset, and visually separates the "Playtime" section (Total/Today)'},
    ] },
  { v:'V86', d:'04/07/2026 09:12', name:{fr:'Chat : halo messages non lus', en:'Chat: unread message halo'}, fr:[
      {t:'new', tx:'Halo sur l\'onglet d\'un canal de chat où un nouveau message est arrivé pendant que tu ne le regardais pas'},
      {t:'new', tx:'Halo temporaire sur les messages tout juste arrivés quand tu ouvres/regardes le canal'},
    ], en:[
      {t:'new', tx:'Halo on a chat channel tab when a new message arrives while you\'re not viewing it'},
      {t:'new', tx:'Temporary halo on messages that just arrived when you open/view the channel'},
    ] },
  { v:'V85', d:'04/07/2026 09:07', name:{fr:'Canal Annonce : rôle seul + message en rouge', en:'Announcement channel: role only + red message'}, fr:[
      {t:'change', tx:'Dans le canal Annonce, le pseudo n\'est plus affiché : seul le badge de rôle (ADMIN) apparaît, et le message est en rouge'},
    ], en:[
      {t:'change', tx:'In the Announcement channel, the pseudo is no longer shown: only the role badge (ADMIN) appears, and the message is in red'},
    ] },
  { v:'V84', d:'04/07/2026 09:03', name:{fr:'Centre de notifications, loot groupé', en:'Notification center, grouped loot'}, fr:[
      {t:'new', tx:'Nouveau bouton "🔔 Notifications" : journal des événements marquants (succès débloqués, niveaux gagnés, équipement/bijoux rares trouvés, boss vaincus)'},
      {t:'change', tx:'Le loot en direct regroupe désormais les objets identiques ramassés d\'affilée en une seule ligne "×N" au lieu de spammer une ligne par ramassage'},
    ], en:[
      {t:'new', tx:'New "🔔 Notifications" button: a log of key events (achievements unlocked, levels gained, rare gear/jewelry found, bosses defeated)'},
      {t:'change', tx:'Live loot now groups identical items picked up back-to-back into a single "×N" line instead of spamming one line per pickup'},
    ] },
  { v:'V83', d:'04/07/2026 08:55', name:{fr:'Statistiques réunies en une carte, retrait de l\'historique silver', en:'Stats merged into one card, silver history removed'}, fr:[
      {t:'change', tx:'Les stats perso et les stats de la zone de farm sont réunies dans une seule carte "Statistiques" (séparées par une ligne), au lieu de deux cartes côte à côte'},
      {t:'change', tx:'Retrait de l\'historique silver sous la table de loot pour l\'instant — une autre idée viendra à sa place plus tard'},
    ], en:[
      {t:'change', tx:'Personal stats and farming zone stats are now merged into a single "Stats" card (separated by a divider), instead of two side-by-side cards'},
      {t:'change', tx:'Removed the silver history under the loot table for now — something else will take its place later'},
    ] },
  { v:'V82', d:'04/07/2026 08:51', name:{fr:'PA/PD/GS sur la carte Équipement, icônes dans le menu d\'équipement', en:'AP/DP/GS on the Equipment card, icons in the equip menu'}, fr:[
      {t:'new', tx:'La carte Équipement affiche désormais PA/PD (en haut) et GS (au-dessus du personnage)'},
      {t:'new', tx:'Chaque pièce équipée affiche son PA (bas-gauche) et son PD (bas-droite) directement sur son icône'},
      {t:'new', tx:'Le menu d\'équipement (clic sur une pièce) affiche maintenant l\'icône de chaque objet candidat, pas juste son nom'},
    ], en:[
      {t:'new', tx:'The Equipment card now shows AP/DP (top) and GS (above the character)'},
      {t:'new', tx:'Each equipped piece shows its AP (bottom-left) and DP (bottom-right) directly on its icon'},
      {t:'new', tx:'The equip-slot menu (click a piece) now shows each candidate item\'s icon, not just its name'},
    ] },
  { v:'V81', d:'04/07/2026 08:47', name:{fr:'World Boss vraiment multijoueur, mort → Velia, loot stylisé', en:'World Boss truly multiplayer, death → Velia, styled loot'}, fr:[
      {t:'new', tx:'World Boss partagé : les autres joueurs sont maintenant VISIBLES en direct dans l\'arène (silhouette + pseudo), pas juste dans un classement textuel'},
      {t:'change', tx:'Mourir au combat renvoie désormais à Velia (zone paisible) avec un message d\'avertissement, au lieu de simplement récupérer 50% des PV sur place'},
      {t:'change', tx:'Cliquer sur "Velia" dans la liste des zones n\'ouvre plus automatiquement le tutoriel : ça t\'y emmène juste, en zone paisible sans monstre (le tutoriel reste accessible depuis le Wiki)'},
      {t:'change', tx:'Le loot en direct (bas à droite) : le rebut (trash) est maintenant blanc, un fondu estompe les entrées les plus anciennes vers le haut'},
      {t:'change', tx:'Le panneau Statistiques est scindé en deux : stats personnelles en haut, stats de la zone de farm juste en dessous'},
    ], en:[
      {t:'new', tx:'Shared World Boss: other players are now VISIBLE live in the arena (silhouette + pseudo), not just in a text leaderboard'},
      {t:'change', tx:'Dying in combat now sends you back to Velia (peaceful zone) with a warning message, instead of just recovering 50% HP on the spot'},
      {t:'change', tx:'Clicking "Velia" in the zone list no longer auto-launches the tutorial: it just takes you there, a peaceful zone with no monsters (tutorial still available from the Wiki)'},
      {t:'change', tx:'Live loot (bottom-right): trash is now white, older entries fade out toward the top'},
      {t:'change', tx:'The Stats panel is split in two: personal stats on top, farming zone stats right below'},
    ] },
  { v:'V80', d:'04/07/2026 08:36', name:{fr:'PA/PD sur les cases du sac, optimisation en un clic, footer raccourci', en:'AP/DP on bag slots, one-click enhancement, shortened footer'}, fr:[
      {t:'new', tx:'Les cases d\'équipement/bijoux du sac affichent maintenant le PA (bas-gauche) et le PD (bas-droite) directement sur l\'icône'},
      {t:'new', tx:'Le menu au clic sur un objet (sac ou équipement) propose désormais aussi "Mettre en optimisation" pour l\'armure/les bijoux, pas seulement les matériaux'},
      {t:'change', tx:'Footer raccourci : mention légale condensée + clause "fourni tel quel, sans garantie ni responsabilité, utilisation à tes risques"'},
    ], en:[
      {t:'new', tx:'Gear/jewelry slots in the bag now show AP (bottom-left) and DP (bottom-right) directly on the icon'},
      {t:'new', tx:'The click menu on an item (bag or equipped) now also offers "Load into enhancement" for armor/jewelry, not just materials'},
      {t:'change', tx:'Shortened footer: condensed legal notice + "provided as-is, no warranty or liability, use at your own risk" clause'},
    ] },
  { v:'V79', d:'04/07/2026 08:26', name:{fr:'Menu d\'équipement (5 objets), boss admin partagé, stuff des joueurs détaillé', en:'Equip-slot menu (5 items), shared admin boss, detailed player gear'}, fr:[
      {t:'new', tx:'Clic sur une pièce d\'équipement : affiche jusqu\'à 5 objets du sac équipables dans ce slot (avec le gain/perte de PA/PD/PV), en plus du bouton Déséquiper'},
      {t:'fix', tx:'Le test de boss "Pour moi" dans le panneau Admin lance maintenant un VRAI boss partagé (PV communs, top 10, contribution %, joueurs en direct) au lieu d\'un combat solo'},
      {t:'new', tx:'Le stuff d\'un joueur consulté depuis le classement affiche maintenant le nom de chaque objet et son PA/PD/PV en clair, pas seulement au survol'},
      {t:'change', tx:'Mention légale précisée : certains noms/styles de jeu/mécaniques s\'inspirent de Black Desert et restent la propriété de Pearl Abyss le cas échéant, mais les visuels de Black Desert Idle sont des créations originales de style fan, pas les mêmes assets'},
    ], en:[
      {t:'new', tx:'Click a gear slot: shows up to 5 bag items equippable in that slot (with AP/DP/HP gain or loss), alongside the Unequip button'},
      {t:'fix', tx:'The "For me" boss test in the Admin panel now launches a REAL shared boss (common HP, top 10, contribution %, live fighters) instead of a solo fight'},
      {t:'new', tx:'A player\'s gear viewed from the leaderboard now shows each item\'s name and AP/DP/HP as plain text, not just on hover'},
      {t:'change', tx:'Legal notice clarified: some names/game styles/mechanics are inspired by Black Desert and remain Pearl Abyss\'s property where applicable, but Black Desert Idle\'s visuals are original fan-style creations, not the same assets'},
    ] },
  { v:'V78', d:'04/07/2026 08:13', name:{fr:'Loot en bas à droite (15 entrées + effets), RNG/Consommable/Lifeskill verrouillés', en:'Bottom-right loot (15 entries + effects), locked RNG/Consumable/Lifeskill'}, fr:[
      {t:'change', tx:'Le butin en direct (loot ticker) passe en bas à droite du jeu (à la place de l\'ancien GS/Niveau, déjà visibles dans le panneau Statistiques et l\'inventaire) : il affiche maintenant 15 entrées, les nouvelles apparaissent en bas et poussent les anciennes vers le haut'},
      {t:'new', tx:'Effet visuel (flash + lueur pulsante) sur les entrées de butin rare et jackpot dans le loot ticker'},
      {t:'change', tx:'Les onglets d\'inventaire "Consommable" et "RNG" sont verrouillés 🔒 (contenu prévu pour une future mise à jour)'},
      {t:'change', tx:'Le bouton lifeskill (⛏️) est verrouillé 🔒 mais reste visible pour rappeler qu\'un futur système de lifeskill est prévu'},
    ], en:[
      {t:'change', tx:'The live loot ticker moves to the bottom-right of the game (replacing the old GS/Level display, already visible in the Stats panel and inventory): it now shows 15 entries, new ones appear at the bottom and push older ones up'},
      {t:'new', tx:'Visual effect (flash + pulsing glow) on rare and jackpot loot entries in the ticker'},
      {t:'change', tx:'The "Consumable" and "RNG" inventory tabs are locked 🔒 (content planned for a future update)'},
      {t:'change', tx:'The lifeskill button (⛏️) is locked 🔒 but stays visible as a reminder that a future lifeskill system is planned'},
    ] },
  { v:'V77', d:'04/07/2026 07:59', name:{fr:'Bannière en développement, stats sur le stuff, voir le stuff des autres', en:'In-development banner, gear stats, view others\' gear'}, fr:[
      {t:'fix', tx:'Chat : les messages d\'annonce sans pseudo affichaient "null" au lieu d\'un nom — corrigé avec un repli propre'},
      {t:'new', tx:'Bannière "🚧 Jeu en développement 🚧" ajoutée en bas de page'},
      {t:'new', tx:'La poupée d\'équipement affiche maintenant le PA/PD/PV donné par chaque pièce au survol'},
      {t:'new', tx:'Classement : clique sur le pseudo d\'un joueur pour voir son stuff équipé (lecture seule)'},
    ], en:[
      {t:'fix', tx:'Chat: announcement messages without a pseudo showed "null" instead of a name — fixed with a proper fallback'},
      {t:'new', tx:'"🚧 Game in development 🚧" banner added at the bottom of the page'},
      {t:'new', tx:'The equipment doll now shows the AP/DP/HP granted by each piece on hover'},
      {t:'new', tx:'Leaderboard: click a player\'s name to view their equipped gear (read-only)'},
    ] },
  { v:'V76', d:'04/07/2026 07:51', name:{fr:'Tutoriel amélioré, UUID privé, inventaire au clic gauche', en:'Improved tutorial, private UUID, left-click inventory'}, fr:[
      {t:'fix', tx:'L\'étape "Potions de vie" du tutoriel ne recouvre plus la case qu\'elle doit montrer (placement corrigé)'},
      {t:'new', tx:'Bouton "← Précédent" dans le tutoriel pour revenir à l\'étape d\'avant'},
      {t:'new', tx:'Nouvelle étape de tutoriel sur "Équiper le meilleur" : explique qu\'il compare toujours le SOCLE des objets, donc une pièce de plus haut niveau reste préférée même moins forte à l\'instant T (ton futur BiS)'},
      {t:'change', tx:'L\'UUID n\'est plus affiché en clair : le bouton affiche juste "📋 Copier UUID" et copie la valeur réelle au clic'},
      {t:'new', tx:'Clic gauche sur une case du sac : ouvre un menu collé à la case (Équiper/Optimiser/Vendre/Jeter) qui affiche en plus le gain ou la perte de PA/PD/PV par rapport à ce qui est déjà équipé'},
      {t:'change', tx:'Bouton "Vendre les objets inférieurs ou égaux" renommé en "Vendre l\'inférieur"'},
      {t:'change', tx:'"Vendre trash" et "Vendre mat." sont temporairement verrouillés 🔒 (reviendront avec une utilité dédiée plus tard)'},
    ], en:[
      {t:'fix', tx:'The tutorial\'s "HP Potions" step no longer covers the slot it\'s supposed to point at (placement fixed)'},
      {t:'new', tx:'"← Back" button in the tutorial to return to the previous step'},
      {t:'new', tx:'New tutorial step on "Equip best": explains it always compares items\' BASE stats, so a higher-tier piece stays preferred even if weaker right now (your future BiS)'},
      {t:'change', tx:'The UUID is no longer shown in plain text: the button just reads "📋 Copy UUID" and copies the real value on click'},
      {t:'new', tx:'Left-click on a bag slot: opens a menu attached to the slot (Equip/Enhance/Sell/Drop) that also shows the AP/DP/HP gain or loss versus what\'s currently equipped'},
      {t:'change', tx:'"Sell items worse than or equal to equipped" button renamed to "Sell the worse"'},
      {t:'change', tx:'"Sell trash" and "Sell mats" are temporarily locked 🔒 (will return with a dedicated purpose later)'},
    ] },
  { v:'V75', d:'04/07/2026 07:18', name:{fr:'Tutoriel : étape sur les potions', en:'Tutorial: potion step'}, fr:[
      {t:'new', tx:'Nouvelle étape du tutoriel sur les potions de vie : présente le choix de la taille et le curseur "Boire sous X%"'},
    ], en:[
      {t:'new', tx:'New tutorial step on HP potions: introduces the size selector and the "Drink under X%" slider'},
    ] },
  { v:'V74', d:'04/07/2026 07:06', name:{fr:'Seuil de potion réglable', en:'Adjustable potion threshold'}, fr:[
      {t:'new', tx:'Nouveau curseur dans le sélecteur de potion : règle le % de PV en dessous duquel une potion est bue automatiquement (5% à 95%)'},
    ], en:[
      {t:'new', tx:'New slider in the potion selector: sets the HP % below which a potion is drunk automatically (5% to 95%)'},
    ] },
  { v:'V73', d:'04/07/2026 07:03', name:{fr:'PV/potions en %, confirmation de vente, remboursement admin', en:'HP/potion %, sell confirmation, admin refund'}, fr:[
      {t:'new', tx:'La barre de vie du personnage affiche maintenant le % de PV, et le sélecteur de potion affiche le % de soin en plus du chiffre'},
      {t:'new', tx:'Une confirmation est désormais demandée avant toute vente (objet, tas, tout le rebut, tous les matériaux)'},
      {t:'admin', tx:'Panneau Admin : bouton pour rembourser le dernier clic "Vendre mat" d\'un joueur (par pseudo), à partir d\'un nouveau journal des ventes groupées'},
    ], en:[
      {t:'new', tx:'The character HP bar now shows the HP %, and the potion selector shows the heal % alongside the number'},
      {t:'new', tx:'A confirmation is now required before any sale (single item, stack, all trash, all materials)'},
      {t:'admin', tx:'Admin panel: button to refund a player\'s last "Sell mats" click (by pseudo), from a new bulk-sale log'},
    ] },
  { v:'V72', d:'04/07/2026 06:36', name:{fr:'Potions à 4 tailles, IA Loot/XP, clic sur le loot, PV du stuff, boss stylisé', en:'4 potion sizes, Loot/XP AI, click-to-loot, gear HP, styled boss'}, fr:[
      {t:'new', tx:'Les potions de vie proposent maintenant 4 tailles au choix (petite/moyenne/grande/majeure), chacune avec un prix fixe et un soin différents (recharge adaptée à la taille pour rester équilibrée) — clique sur l\'icône de potion en jeu pour choisir'},
      {t:'new', tx:'Nouveau bouton de mode d\'IA à côté de l\'état : "🎒 Loot" ramasse tout le butin d\'un pack avant de passer au suivant (corrigé pour ne plus rien laisser au sol), "⚡ XP" enchaîne les packs sans se soucier du loot pour maximiser les kills/xp par minute'},
      {t:'new', tx:'Clic sur un objet au sol : le perso s\'y déplace directement, prioritaire sur l\'IA jusqu\'à l\'arrivée'},
      {t:'new', tx:'L\'armure (casque/plastron/gants/bottes) apporte désormais des PV en plus de la PA/PD, pour éviter les one-shot en zone difficile — affiché dans les stats et sur les objets'},
      {t:'admin', tx:'Panneau Admin : graphique de répartition des joueurs par tranche de richesse + tuiles Total/Moyenne/Médiane en jeu'},
      {t:'change', tx:'Barre de vie du World Boss restylée : pourcentage bien visible, repères 25/50/75%, halo qui pulse en dessous de 20% PV'},
      {t:'change', tx:'Salle du World Boss encore plus "4D" : brume de fond en parallaxe (dérive indépendante du tremblement d\'écran) et vignette de corruption qui s\'intensifie à mesure que le boss perd des PV'},
    ], en:[
      {t:'new', tx:'HP potions now come in 4 selectable sizes (small/medium/large/major), each with a different fixed price and heal (cooldown scaled to size to stay balanced) — click the potion icon in-game to choose'},
      {t:'new', tx:'New AI mode button next to the state display: "🎒 Loot" clears all of a pack\'s drops before moving on (fixed to no longer leave loot behind), "⚡ XP" chains packs without caring about loot to maximize kills/xp per minute'},
      {t:'new', tx:'Click a ground item: the character walks straight to it, taking priority over the AI until it arrives'},
      {t:'new', tx:'Armor (helmet/chest/gloves/boots) now grants HP in addition to AP/DP, to avoid one-shots in harder zones — shown in stats and on items'},
      {t:'admin', tx:'Admin panel: player wealth-bracket distribution chart + Total/Average/Median in-game tiles'},
      {t:'change', tx:'World Boss HP bar restyled: clear percentage, 25/50/75% tick marks, pulsing glow under 20% HP'},
      {t:'change', tx:'World Boss room even more "4D": parallax background fog (drifts independently from screen shake) and a corruption vignette that intensifies as the boss loses HP'},
    ] },
  { v:'V71', d:'04/07/2026 06:17', name:{fr:'World Boss : combattants en direct + % de dégâts', en:'World Boss: live fighters + damage %'}, fr:[
      {t:'new', tx:'Le panneau de classement du World Boss partagé affiche maintenant un compteur "X joueurs combattent en direct" et un point vert à côté des pseudos qui tapent en ce moment'},
      {t:'change', tx:'Le classement affiche désormais le % de dégâts de chacun (calculé sur le total réel de tous les participants) en plus du nombre brut'},
      {t:'change', tx:'Les PV du World Boss lancé pour tous sont désormais calculés selon le nombre de joueurs en ligne, pour viser une mort en 2 à 7 minutes réelles selon le stuff et le nombre de participants'},
    ], en:[
      {t:'new', tx:'The shared World Boss leaderboard now shows a "X players fighting" live counter and a green dot next to pseudos currently hitting the boss'},
      {t:'change', tx:'The leaderboard now shows each player\'s damage % (computed on the real total across all participants) alongside the raw number'},
      {t:'change', tx:'HP for the globally-launched World Boss is now computed from the current online player count, targeting a real kill time of 2 to 7 minutes depending on gear and participation'},
    ] },
  { v:'V70', d:'04/07/2026 04:38', name:{fr:'Tutoriel : suivi pixel perfect + démo du suivi de quêtes', en:'Tutorial: pixel-perfect tracking + quest tracker demo'}, fr:[
      {t:'fix', tx:'Le halo/encadré du tutoriel suit maintenant la cible au pixel près en permanence (recalcul à chaque frame), y compris pendant un scroll'},
      {t:'change', tx:'L\'étape "Quêtes" ouvre maintenant le panneau Quêtes tout seul et montre directement le bouton "Suivre" à l\'intérieur, avant de le refermer et de montrer où s\'affiche le suivi'},
    ], en:[
      {t:'fix', tx:'The tutorial\'s halo/box now tracks the target pixel-perfectly at all times (recalculated every frame), including while scrolling'},
      {t:'change', tx:'The "Quests" step now opens the Quests panel on its own and points directly at the "Track" button inside it, before closing it and showing where the tracker appears'},
    ] },
  { v:'V69', d:'04/07/2026 04:30', name:{fr:'Tutoriel complet + BETA sur le marché', en:'Full tutorial tour + market BETA tag'}, fr:[
      {t:'new', tx:'Le tutoriel de bienvenue couvre maintenant tout le jeu en 19 étapes : pages, zones, sorts automatiques, statistiques, optimisation, inventaire (et ses boutons), butin en direct, quêtes (+ où trouver leur suivi), classement, succès, courrier, notes de version, marché, chat, déconnexion et UUID (utile si le staff doit t\'ajouter un rôle)'},
      {t:'change', tx:'Ajout d\'un badge "BETA" sur le bouton Marché et sur l\'Hôtel des ventes'},
    ], en:[
      {t:'new', tx:'The welcome tutorial now covers the whole game in 19 steps: pages, zones, automatic skills, stats, enhancement, inventory (and its buttons), live loot, quests (+ where to find their tracker), leaderboard, achievements, mailbox, patch notes, market, chat, logout and UUID (useful if staff needs to grant you a role)'},
      {t:'change', tx:'Added a "BETA" badge on the Market button and on the Marketplace'},
    ] },
  { v:'V68', d:'04/07/2026 04:19', name:{fr:'Correctif : halo du tutoriel figé au scroll', en:'Fix: tutorial halo stays static on scroll'}, fr:[
      {t:'fix', tx:'Le halo/encadré du tutoriel de bienvenue reste maintenant totalement statique à l\'écran, même en cas de scroll — il ne se recale plus (et ne bouge donc plus) pendant que tu défiles la page'},
    ], en:[
      {t:'fix', tx:'The welcome tutorial\'s halo/box now stays completely static on screen even when scrolling — it no longer repositions (and therefore no longer moves) while you scroll the page'},
    ] },
  { v:'V67', d:'04/07/2026 04:15', name:{fr:'Correctif : tutoriel désaligné au scroll', en:'Fix: tutorial misaligned on scroll'}, fr:[
      {t:'fix', tx:'L\'encadré et la flèche du tutoriel de bienvenue restent maintenant correctement collés à l\'élément expliqué même si on scroll la page pendant le tutoriel'},
    ], en:[
      {t:'fix', tx:'The welcome tutorial\'s box and arrow now stay correctly attached to the explained element even if the page is scrolled during the tutorial'},
    ] },
  { v:'V66', d:'04/07/2026 04:03', name:{fr:'Tutoriel de bienvenue à Velia', en:'Velia welcome tutorial'}, fr:[
      {t:'new', tx:'Nouvelle zone paisible 🏘️ Velia, épinglée en haut de la liste des zones — aucun monstre, juste un point de repère pour revoir le tutoriel'},
      {t:'new', tx:'Un petit tutoriel se lance automatiquement pour tout nouveau compte : des encadrés et des flèches expliquent les pages du jeu, les zones, les sorts automatiques, les statistiques, les quêtes et le chat'},
      {t:'new', tx:'Le tutoriel peut être relancé à tout moment depuis le 📖 Wiki (onglet 🔰 Tutoriel) ou en cliquant sur 🏘️ Velia'},
    ], en:[
      {t:'new', tx:'New peaceful zone 🏘️ Velia, pinned at the top of the zone list — no monsters, just a landmark to replay the tutorial'},
      {t:'new', tx:'A short tutorial now launches automatically for every new account: highlighted boxes and arrows explain the game pages, zones, automatic skills, stats, quests and chat'},
      {t:'new', tx:'The tutorial can be replayed anytime from the 📖 Wiki (🔰 Tutorial tab) or by clicking 🏘️ Velia'},
    ] },
  { v:'V65', d:'04/07/2026 03:17', name:{fr:'Mise à jour de la clause de non-affiliation', en:'Updated copyright disclaimer'}, fr:[
      {t:'change', tx:'Mention légale mise à jour en bas de page et dans le Wiki (À propos) : Black Desert et toutes les images/illustrations/icônes/noms/données du jeu sont la propriété de Pearl Abyss — projet de fan non officiel et gratuit, sans affiliation ni partenariat avec Pearl Abyss'},
    ], en:[
      {t:'change', tx:'Updated legal notice at the bottom of the page and in the Wiki (About): Black Desert and all in-game images/illustrations/icons/names/data are property of Pearl Abyss — unofficial, free fan project, no affiliation or partnership with Pearl Abyss'},
    ] },
  { v:'V64', d:'04/07/2026 03:05', name:{fr:'Renvoi de message, horodatage du chat & boss plus immersif', en:'Message restore, chat timestamps & more immersive boss'}, fr:[
      {t:'new', tx:'Onglet 🛡️ Modéré : bouton "↩ Renvoyer" pour republier un message supprimé à tort dans son canal d\'origine'},
      {t:'new', tx:'Chaque message des canaux Mondial/Trade/Annonce affiche désormais l\'heure (et la date s\'il ne date pas d\'aujourd\'hui)'},
      {t:'change', tx:'Le encart de chat est agrandi (plus large, plus de messages visibles) pour un meilleur confort de lecture'},
      {t:'new', tx:'Salle du World Boss Kzarka : effets de profondeur et d\'immersion — braises de corruption en parallaxe, tremblement d\'écran sur les coups critiques et les attaques de zone, légère oscillation de volume sur le boss'},
    ], en:[
      {t:'new', tx:'🛡️ Moderated tab: "↩ Restore" button to repost a wrongly-deleted message back to its original channel'},
      {t:'new', tx:'Every message in the World/Trade/Announcement channels now shows the time (and date if not from today)'},
      {t:'change', tx:'The chat box is bigger (wider, more visible messages) for a more comfortable read'},
      {t:'new', tx:'Kzarka World Boss room: depth/immersion effects — parallax corruption embers, screen shake on crits and AoE hits, subtle volumetric wobble on the boss'},
    ] },
  { v:'V63', d:'04/07/2026 02:59', name:{fr:'World Boss partagé, rôle Testeur & bouton copier', en:'Shared World Boss, Tester role & copy button'}, fr:[
      {t:'new', tx:'World Boss global : quand l\'admin lance un boss pour tous, les PV sont désormais PARTAGÉS entre tous les joueurs qui se battent — chaque coup porté par n\'importe qui fait baisser la même barre de vie'},
      {t:'new', tx:'Classement de contribution en direct (top 10) affiché pendant le combat, avec le pseudo de chaque joueur et ses dégâts infligés'},
      {t:'new', tx:'À la mort du boss, la récompense dépend de ton rang de contribution : plus tu es haut dans le classement, plus la récompense en argent et matériaux est intéressante (jusqu\'à ×3 pour le rang #1)'},
      {t:'new', tx:'Nouveau rôle "Testeur" : accès à un panneau 🧪 Testeur listant les futures fonctionnalités (pêche, mine, forêt...) — aucun avantage de jeu, uniquement de la prévisualisation. Géré par l\'admin comme les modérateurs'},
      {t:'change', tx:'La case UUID est maintenant un vrai bouton cliquable avec un indice "📋 Copier" bien visible (devient "✓ Copié !" après le clic)'},
    ], en:[
      {t:'new', tx:'Global World Boss: when the admin spawns a boss for everyone, HP is now SHARED among all fighting players — every hit from anyone drains the same health bar'},
      {t:'new', tx:'Live contribution leaderboard (top 10) shown during the fight, with each player\'s nickname and damage dealt'},
      {t:'new', tx:'When the boss dies, your reward depends on your contribution rank: the higher you rank, the better the silver and material reward (up to ×3 for rank #1)'},
      {t:'new', tx:'New "Tester" role: access to a 🧪 Tester panel listing upcoming features (fishing, mining, forest...) — no gameplay advantage, preview only. Managed by the admin like moderators'},
      {t:'change', tx:'The UUID field is now a real clickable button with a clear "📋 Copy" hint (turns into "✓ Copied!" after clicking)'},
    ] },
  { v:'V62', d:'04/07/2026 02:35', name:{fr:'Canal Modéré : journal des messages supprimés', en:'Moderated channel: deleted-message log'}, fr:[
      {t:'new', tx:'Nouveau canal de chat "🛡️ Modéré" visible seulement par l\'admin et les modérateurs : journal de tous les messages supprimés, avec le pseudo de l\'auteur, son UUID, le canal d\'origine et le message'},
      {t:'change', tx:'Le badge MOD s\'affiche devant le pseudo des modérateurs, et les modérateurs peuvent supprimer des messages dans le chat (le message supprimé est archivé dans le canal Modéré)'},
    ], en:[
      {t:'new', tx:'New "🛡️ Moderated" chat channel visible only to admin and moderators: a log of all deleted messages, with the author\'s nickname, their UUID, the original channel and the message'},
      {t:'change', tx:'The MOD badge shows in front of moderators\' nicknames, and moderators can delete chat messages (the deleted message is archived in the Moderated channel)'},
    ] },
  { v:'V61', d:'04/07/2026 02:28', name:{fr:'Correctif : rejoindre le World Boss global', en:'Fix: joining the global World Boss'}, fr:[
      {t:'fix', tx:'Quand l\'admin lance un boss pour tous, il apparaît maintenant instantanément pour chaque joueur : l\'état est rafraîchi à l\'ouverture de la page Boss et au démarrage, et le bouton "Combattre" apparaît tout seul si tu es déjà sur la page — tout le monde peut rejoindre'},
    ], en:[
      {t:'fix', tx:'When the admin launches a boss for all, it now appears instantly for every player: the state is refreshed when opening the Boss page and at startup, and the "Fight" button shows up on its own if you\'re already on the page — everyone can join'},
    ] },
  { v:'V60', d:'04/07/2026 02:20', name:{fr:'UUID copiable & gestion des modérateurs', en:'Copyable UUID & moderator management'}, fr:[
      {t:'new', tx:'Ton UUID de joueur s\'affiche sous les infos de connexion, avec un bouton 📋 pour le copier'},
      {t:'new', tx:'Zone Admin : section Modérateurs — ajouter un MOD par UUID, voir la liste des modérateurs et en retirer un à tout moment'},
    ], en:[
      {t:'new', tx:'Your player UUID is shown below the connection info, with a 📋 button to copy it'},
      {t:'new', tx:'Admin Zone: Moderators section — add a MOD by UUID, see the moderator list and remove one at any time'},
    ] },
  { v:'V59', d:'04/07/2026 02:14', name:{fr:'Boutons équiper/vendre déplacés dans l\'inventaire', en:'Equip/sell buttons moved into inventory'}, fr:[
      {t:'change', tx:'Les boutons "⚡ Équiper le meilleur (socle)" et "🗑️ Vendre les objets inférieurs ou égaux" sont déplacés dans la carte Inventaire (avec les outils) — plus besoin de faire défiler jusqu\'à l\'équipement'},
    ], en:[
      {t:'change', tx:'The "⚡ Equip best (base)" and "🗑️ Sell items worse than or equal" buttons moved into the Inventory card (with the tools) — no more scrolling down to the Equipment card'},
    ] },
  { v:'V58', d:'04/07/2026 02:11', name:{fr:'Lancer un World Boss pour tous les joueurs', en:'Launch a World Boss for all players'}, fr:[
      {t:'new', tx:'L\'admin peut lancer un World Boss pour TOUS les joueurs à la demande (15 min) : il apparaît instantanément "EN COURS" pour tout le monde et devient combattable, indépendamment du planning horaire'},
    ], en:[
      {t:'new', tx:'The admin can launch a World Boss for ALL players on demand (15 min): it instantly shows "LIVE" for everyone and becomes fightable, independently of the schedule'},
    ] },
  { v:'V57', d:'04/07/2026 02:05', name:{fr:'Panneau admin en 2 parties & vrai calendrier boss', en:'Two-part admin panel & real boss calendar'}, fr:[
      {t:'change', tx:'Zone Admin scindée en deux : "👤 Pour moi" (tests sur mon propre compte : +silver, +fidélité, débloquer les succès, réinitialiser mes quêtes/démo, combattre un boss) et "🌍 Pour les joueurs" (actions serveur qui touchent tout le monde)'},
      {t:'change', tx:'Le calendrier des World Boss est maintenant une vraie grille hebdomadaire : jours en colonnes, heures de spawn en lignes, avec le nom du boss dans chaque case et une légende'},
    ], en:[
      {t:'change', tx:'Admin Zone split in two: "👤 For me" (tests on my own account: +silver, +loyalty, unlock achievements, reset my quests/demo, fight a boss) and "🌍 For players" (server-wide actions affecting everyone)'},
      {t:'change', tx:'The World Boss calendar is now a real weekly grid: days as columns, spawn hours as rows, with the boss name in each cell and a legend'},
    ] },
  { v:'V56', d:'04/07/2026 01:59', name:{fr:'Pseudo affiché dans le chat', en:'Nickname shown in chat'}, fr:[
      {t:'fix', tx:'Le chat affiche désormais bien ton pseudo (celui vu dans l\'interface, y compris ton nom Discord si tu n\'as pas de pseudo perso), jamais l\'email ni "Joueur"'},
    ], en:[
      {t:'fix', tx:'Chat now correctly shows your nickname (the one seen in the UI, including your Discord name if you have no custom nickname), never the email nor "Player"'},
    ] },
  { v:'V55', d:'04/07/2026 01:49', name:{fr:'Salle de boss à piliers & mécanique d\'AoE', en:'Pillar boss room & AoE mechanic'}, fr:[
      {t:'new', tx:'Le World Boss se déroule maintenant dans une salle de pierre à 4 piliers, entièrement dessinée pour le jeu (art original)'},
      {t:'new', tx:'Le boss devient le "Grand Seigneur de guerre de la corruption" — grande créature originale et imposante'},
      {t:'new', tx:'Nouvelle mécanique : le boss charge une attaque de zone (AoE). Le héros court se cacher derrière un pilier pour la parer — s\'il est à découvert, il encaisse un gros coup ("PARÉ !" / "AoE !")'},
    ], en:[
      {t:'new', tx:'The World Boss now takes place in a stone room with 4 pillars, entirely drawn for the game (original art)'},
      {t:'new', tx:'The boss is now the "Great Warlord of Corruption" — a large, imposing original creature'},
      {t:'new', tx:'New mechanic: the boss charges an area attack (AoE). The hero runs to hide behind a pillar to block it — if caught in the open, they take a big hit ("BLOCKED!" / "AoE!")'},
    ] },
  { v:'V54', d:'04/07/2026 01:39', name:{fr:'Correctif double-réclamation & anti-triche', en:'Double-claim fix & anti-cheat'}, fr:[
      {t:'exploit', tx:'Faille corrigée : une quête terminée ne peut plus être réclamée deux fois (une fois dans l\'encart de suivi, une fois dans le panneau). Réclamer met désormais à jour instantanément les deux affichages, aucun bouton "Réclamer" périmé ne subsiste'},
      {t:'fix', tx:'Fermer le panneau Quêtes en cliquant à côté ne laisse plus l\'état incohérent'},
      {t:'change', tx:'Anti-triche côté serveur : le classement borne les valeurs manifestement impossibles (silver/gearscore/niveau/temps de jeu) pour rester crédible. Note : le jeu reste calculé côté navigateur, une triche subtile de sa propre ligne reste techniquement possible'},
    ], en:[
      {t:'exploit', tx:'Exploit fixed: a completed quest can no longer be claimed twice (once in the tracker widget, once in the panel). Claiming now instantly updates both displays, no stale "Claim" button remains'},
      {t:'fix', tx:'Closing the Quests panel by clicking outside no longer leaves an inconsistent state'},
      {t:'change', tx:'Server-side anti-cheat: the leaderboard clamps clearly impossible values (silver/gearscore/level/playtime) to stay credible. Note: the game is still computed in the browser, so subtle tampering of one\'s own row remains technically possible'},
    ] },
  { v:'V53', d:'04/07/2026 01:30', name:{fr:'Succès par catégorie, wiki + codex, dates patchnotes', en:'Categorized achievements, wiki + codex, patchnote dates'}, fr:[
      {t:'new', tx:'Chaque note de version affiche désormais sa date et son heure (JJ/MM/AAAA HH:MM)'},
      {t:'change', tx:'Succès réorganisés en catégories (Combat, Butin, Silver, Temps de jeu, Exploration, Équipement) avec un filtre "Pas fini" pour ne voir que ceux qui restent'},
      {t:'change', tx:'L\'encart de suivi affiche "🏅 Vous avez fini les succès !" une fois tous les succès débloqués'},
      {t:'change', tx:'Wiki réorganisé en catégories cliquables, et nouveau 📚 Codex des objets listant tous les objets du jeu (bijoux, matériaux, composants, butin)'},
    ], en:[
      {t:'new', tx:'Each patch note now shows its date and time (DD/MM/YYYY HH:MM)'},
      {t:'change', tx:'Achievements reorganized into categories (Combat, Loot, Silver, Playtime, Exploration, Equipment) with an "Unfinished" filter to show only what\'s left'},
      {t:'change', tx:'The tracker widget shows "🏅 You\'ve finished all achievements!" once every achievement is unlocked'},
      {t:'change', tx:'Wiki reorganized into clickable categories, plus a new 📚 Item Codex listing every item in the game (jewelry, materials, components, loot)'},
    ] },
  { v:'V52', name:{fr:'Icônes détaillées, optimisation PRI+, chat & historique silver', en:'Detailed icons, PRI+ enhancement, chat & silver history'}, fr:[
      {t:'change', tx:'Icônes d\'équipement redessinées, plus jolies et plus grosses, avec le niveau d\'optimisation affiché en gros sur l\'icône (+N, puis I à V pour PRI→PEN)'},
      {t:'change', tx:'Optimisation : à partir de PRI, un échec fait rétrograder d\'un palier (PRI→PEN), mais jamais en dessous de PRI — on ne retombe plus à +15'},
      {t:'change', tx:'Chat : le rôle (ADMIN/MOD) s\'affiche devant le pseudo, jamais l\'email. Les modérateurs peuvent aussi supprimer des messages ; en cas d\'échec de suppression, la raison est affichée'},
      {t:'new', tx:'Petit historique de silver (courbe) sous le loot, avec le taux estimé sur la dernière minute'},
    ], en:[
      {t:'change', tx:'Equipment icons redrawn, prettier and bigger, with the enhancement level shown large on the icon (+N, then I to V for PRI→PEN)'},
      {t:'change', tx:'Enhancement: from PRI, a failure downgrades one tier (PRI→PEN), but never below PRI — you no longer drop back to +15'},
      {t:'change', tx:'Chat: the role (ADMIN/MOD) shows in front of the nickname, never the email. Moderators can also delete messages; if a deletion fails, the reason is shown'},
      {t:'new', tx:'Small silver history (line chart) below the loot, with the estimated rate over the last minute'},
    ] },
  { v:'V51', name:{fr:'Inventaire à 4 catégories & header toujours visible', en:'4-category inventory & always-visible header'}, fr:[
      {t:'change', tx:'Inventaire réorganisé en 4 catégories distinctes (plus de "Tout") : Normal, Optimisation, Consommable, RNG. Chaque objet se range automatiquement dans la bonne'},
      {t:'change', tx:'La catégorie "Butin rare" devient "RNG" et est vidée — elle accueillera bientôt des coffres RNG (les composants de craft passent dans Optimisation)'},
      {t:'change', tx:'Le header (Zone / Boss / activités) reste maintenant toujours visible : ouvrir la page Boss ne cache plus la barre du haut, elle s\'affiche juste en dessous'},
    ], en:[
      {t:'change', tx:'Inventory reorganized into 4 distinct categories (no more "All"): Normal, Enhancement, Consumable, RNG. Each item is auto-sorted into the right one'},
      {t:'change', tx:'The "Rare loot" category becomes "RNG" and is emptied — it will soon hold RNG boxes (crafting components moved to Enhancement)'},
      {t:'change', tx:'The header (Zone / Boss / activities) now always stays visible: opening the Boss page no longer hides the top bar, it shows right below it'},
    ] },
  { v:'V50', name:{fr:'Page World Boss, chat amélioré, quêtes affinées', en:'World Boss page, improved chat, refined quests'}, fr:[
      {t:'change', tx:'Le header au-dessus du jeu est maintenant une liste de pages : ⚔️ Zone, 🐍 Boss, + activités verrouillées. La page Boss occupe toute la hauteur de l\'écran, dans le style de la zone de farm (sol iso, héros, boss au centre)'},
      {t:'change', tx:'Chat : affiche le pseudo (jamais l\'email), badge ADMIN/MOD à côté du pseudo, bouton de suppression de message pour le staff. Le chat est aussi agrandi'},
      {t:'change', tx:'Quêtes : bouton "Réclamer" plus petit ; l\'encart de suivi affiche désormais Journalières/Hebdo séparément et permet de réclamer directement les quêtes terminées'},
    ], en:[
      {t:'change', tx:'The header above the game is now a page list: ⚔️ Zone, 🐍 Boss, + locked activities. The Boss page takes the full screen height, in the farming-zone style (iso ground, hero, boss in the center)'},
      {t:'change', tx:'Chat: shows the nickname (never the email), ADMIN/MOD badge next to the nickname, message-delete button for staff. The chat is also enlarged'},
      {t:'change', tx:'Quests: smaller "Claim" button; the tracker widget now shows Daily/Weekly separately and lets you claim completed quests directly'},
    ] },
  { v:'V49', name:{fr:'Potions payantes, header Activités, calendrier boss par jour', en:'Paid potions, Activities header, per-day boss calendar'}, fr:[
      {t:'new', tx:'Les potions de vie coûtent désormais du silver à chaque utilisation (200 silver). Sans silver, pas de soin — le joueur encaisse. Une "potion infinie" gratuite sera débloquable plus tard'},
      {t:'change', tx:'La barre "🧭 Activités" est maintenant un header directement au-dessus de la zone de farm'},
      {t:'change', tx:'Le calendrier des World Boss de la semaine est désormais organisé par jour, chaque jour se replie/déplie (le jour du prochain boss est ouvert par défaut)'},
    ], en:[
      {t:'new', tx:'HP potions now cost silver each use (200 silver). Without silver, no heal — you take the hits. A free "infinite potion" will be unlockable later'},
      {t:'change', tx:'The "🧭 Activities" bar is now a header directly above the farming zone'},
      {t:'change', tx:'The weekly World Boss calendar is now organized by day, each day collapses/expands (the next boss\'s day is open by default)'},
    ] },
  { v:'V48', name:{fr:'Invocation de World Boss (admin)', en:'World Boss spawn (admin)'}, fr:[
      {t:'new', tx:'Zone Admin : sélecteur pour faire apparaître immédiatement le World Boss de ton choix (combat de test), sans toucher au planning horaire normal'},
    ], en:[
      {t:'new', tx:'Admin Zone: selector to immediately spawn the World Boss of your choice (test fight), without affecting the normal schedule'},
    ] },
  { v:'V47', name:{fr:'World Boss (Kzarka) & activités', en:'World Boss (Kzarka) & activities'}, fr:[
      {t:'new', tx:'Nouveau bouton "🧭 Activités" au-dessus du farm : accès à la zone, au World Boss, et des activités à venir en avant-goût (pêche, mine, forêt, champs, bergerie — verrouillées)'},
      {t:'new', tx:'Premier World Boss : Kzarka ! Encadré "prochain boss" avec compte à rebours, calendrier de la semaine (seuls les boss déjà en jeu s\'affichent). Horaires calqués sur le vrai BDO −15 min'},
      {t:'new', tx:'Salle de boss en plein écran : combat de 2 à 9 minutes selon ton stuff, avec récompenses (silver + Pierres noires) à la victoire'},
      {t:'change', tx:'Panneau Quêtes plus lisible : bascule Journalières/Hebdomadaires avec, d\'un coup d\'œil, le nombre de quêtes à réclamer (pastille dorée) ou restantes — sans avoir à faire défiler'},
      {t:'change', tx:'Zone Admin : le graphique par heure affiche désormais le nombre de joueurs distincts actifs (ex: "3" = trois joueurs) en plus du temps de jeu cumulé'},
      {t:'change', tx:'L\'adresse email n\'est plus affichée à côté du tag DÉMO (pseudo uniquement)'},
    ], en:[
      {t:'new', tx:'New "🧭 Activities" button above farming: access the zone, the World Boss, and upcoming activities as a teaser (fishing, mining, forest, fields, ranch — locked)'},
      {t:'new', tx:'First World Boss: Kzarka! "Next boss" panel with countdown, weekly schedule (only bosses already in the game are shown). Times mirror real BDO −15 min'},
      {t:'new', tx:'Fullscreen boss room: 2 to 9 minute fight depending on your gear, with rewards (silver + Black Stones) on victory'},
      {t:'change', tx:'More readable Quests panel: Daily/Weekly toggle showing at a glance how many quests are claimable (gold badge) or remaining — no scrolling needed'},
      {t:'change', tx:'Admin Zone: the per-hour chart now shows the number of distinct active players (e.g. "3" = three players) in addition to total playtime'},
      {t:'change', tx:'The email address is no longer shown next to the DEMO tag (nickname only)'},
    ] },
  { v:'V46', name:{fr:'Courrier & fidélité, inventaire par catégories, équipement lifeskill', en:'Mailbox & loyalty, inventory categories, lifeskill gear'}, fr:[
      {t:'new', tx:'Nouveau "📬 Courrier" : 200 points de fidélité offerts chaque jour, stockés en permanence (jamais perdus, s\'empilent sans limite) — base posée pour de futures récompenses'},
      {t:'new', tx:'L\'inventaire se divise maintenant en catégories cliquables : Tout, Normal (équipement), Optimisation (matériaux), Consommable, et Butin rare (composants de craft endgame)'},
      {t:'new', tx:'Nouvelle icône ⛏️ à côté de l\'inventaire : ouvre un 2e équipement dédié au lifeskill (couteau à dépecer, pioche, hache, seringue, houe, couteau de tanneur, flotteur, canne à pêche) — les accessoires de combat y sont rappelés en lecture seule. Ces emplacements sont prêts mais vides : aucune récolte/pêche n\'existe encore en jeu'},
    ], en:[
      {t:'new', tx:'New "📬 Mailbox": 200 Loyalty Points granted every day, stored permanently (never lost, stacks without limit) — groundwork for future rewards'},
      {t:'new', tx:'The inventory now splits into clickable categories: All, Normal (gear), Enhancement (materials), Consumable, and Rare loot (endgame crafting components)'},
      {t:'new', tx:'New ⛏️ icon next to the inventory: opens a 2nd equipment panel dedicated to lifeskill (skinning knife, pickaxe, axe, fluid collector, hoe, tanning knife, float, fishing rod) — combat accessories are mirrored there read-only. These slots are ready but empty: no gathering/fishing exists in-game yet'},
    ] },
  { v:'V45', name:{fr:'Chat en jeu', en:'In-game chat'}, fr:[
      {t:'new', tx:'Nouveau chat en bas à droite avec 3 canaux : 🌍 Mondial, 💱 Trade, 📢 Annonce (réservé au staff en écriture) — repliable, couleurs distinctes par canal, réservé aux comptes vérifiés pour écrire (lecture libre)'},
      {t:'new', tx:'Le canal "Guilde" est préparé côté serveur mais reste caché en attendant un vrai système de guildes'},
    ], en:[
      {t:'new', tx:'New chat at the bottom-right with 3 channels: 🌍 World, 💱 Trade, 📢 Announcement (staff-only posting) — collapsible, distinct colors per channel, posting restricted to verified accounts (reading is open)'},
      {t:'new', tx:'The "Guild" channel is prepared server-side but stays hidden until a real guild system exists'},
    ] },
  { v:'V44', name:{fr:'Panneau Admin consolidé & pseudo affiché', en:'Consolidated Admin panel & displayed nickname'}, fr:[
      {t:'change', tx:'Le bouton "🛠️ Admin" ouvre maintenant un seul panneau contenant les actions (réévaluer le marché, réinitialiser les quêtes ou la démo) et les statistiques par onglets, au lieu de boutons séparés dans la barre latérale'},
      {t:'new', tx:'Nouvel onglet "Silver & temps de jeu / heure" : temps de jeu cumulé de tous les joueurs par tranche d\'heure, à côté du silver farmé'},
      {t:'new', tx:'Le pseudo du joueur s\'affiche maintenant à côté du tag DÉMO'},
    ], en:[
      {t:'change', tx:'The "🛠️ Admin" button now opens a single panel containing the actions (reevaluate market, reset quests or demo) and the tabbed stats, instead of separate sidebar buttons'},
      {t:'new', tx:'New "Silver & playtime / hour" tab: total playtime across all players per hour bracket, next to silver farmed'},
      {t:'new', tx:'The player\'s nickname is now shown next to the DEMO tag'},
    ] },
  { v:'V43', name:{fr:'Traductions FR, correctifs objets & suivi amélioré', en:'French translations, item fixes & better tracking'}, fr:[
      {t:'change', tx:'Tous les matériaux et bijoux qui restaient affichés en anglais (Pierre noire, Éclats de cristal noir, Pierre de Caphras, Poussière d\'esprit ancien, Fragment de mémoire, Marbre du Dieu déchu, et les 12 bijoux rares) sont désormais traduits en français'},
      {t:'change', tx:'Black Stone (Arme) et Black Stone (Armure) fusionnés en un seul objet "Pierre noire", comme dans le vrai jeu'},
      {t:'fix', tx:'La Poussière d\'esprit ancien ne peut plus être utilisée directement pour optimiser l\'équipement (elle sert à fabriquer des Pierres de Caphras) — trois zones l\'utilisaient par erreur comme matériau d\'optimisation direct'},
      {t:'change', tx:'"Vendre les objets inférieurs" vend maintenant aussi les objets de force ÉGALE à celle déjà équipée, pas seulement les objets strictement plus faibles'},
      {t:'change', tx:'L\'encart "Quêtes suivies" est plus grand et affiche désormais le chiffre exact de progression (ex: "42 / 250 monstres") pour chaque quête, plus seulement son nom'},
    ], en:[
      {t:'change', tx:'All materials and jewelry that were still showing in English (Black Stone, Black Crystal Shards, Caphras Stone, Ancient Spirit Dust, Memory Fragment, Fallen God\'s Marble, and all 12 rare jewelry pieces) are now translated to French'},
      {t:'change', tx:'Black Stone (Weapon) and Black Stone (Armor) merged into a single "Black Stone" item, matching the original game'},
      {t:'fix', tx:'Ancient Spirit Dust can no longer be used directly to enhance gear (it\'s meant for crafting Caphras Stones) — three zones incorrectly used it as a direct enhancement material'},
      {t:'change', tx:'"Sell items worse than equipped" now also sells items of EQUAL strength to what\'s equipped, not just strictly weaker ones'},
      {t:'change', tx:'The "Tracked quests" widget is bigger and now shows the exact progress number (e.g. "42 / 250 monsters") for each quest, not just its name'},
    ] },
  { v:'V42', name:{fr:'Onglets par catégorie sur Classement & Admin', en:'Category tabs on Leaderboard & Admin'}, fr:[
      {t:'change', tx:'Classement et Zone Admin : chaque catégorie (Silver, Gearscore, meilleure zone, etc.) est maintenant un onglet cliquable, une seule catégorie affichée à la fois au lieu de tout empiler'},
      {t:'new', tx:'Ta propre ligne dans le Classement est mise en valeur par un petit halo doré'},
    ], en:[
      {t:'change', tx:'Leaderboard and Admin Zone: each category (Silver, Gearscore, best zone, etc.) is now a clickable tab, showing one category at a time instead of stacking everything'},
      {t:'new', tx:'Your own row in the Leaderboard is highlighted with a small gold halo'},
    ] },
  { v:'V41', name:{fr:'Courbe d\'XP et niveaux façon vrai jeu', en:'Real-game XP and level curve'}, fr:[
      {t:'new', tx:'En haut de l\'inventaire : niveau + pourcentage d\'XP à 3 décimales (00.000%), comme dans le vrai jeu'},
      {t:'change', tx:'La courbe de montée de niveau utilise désormais les vrais paliers d\'XP du jeu original : quasi instantané niveaux 0-4, puis ça explose fortement — au-delà d\'un certain niveau, un monstre ne fera plus gagner que quelques 0,001% de la barre. D\'autres bonus viendront plus tard pour augmenter fortement les gains d\'XP'},
    ], en:[
      {t:'new', tx:'At the top of the inventory: level + XP percentage with 3 decimals (00.000%), like the original game'},
      {t:'change', tx:'The leveling curve now uses the real XP thresholds from the original game: near-instant for levels 0-4, then it ramps up massively — past a certain level, a single monster only grants a few 0.001% of the bar. More bonuses will come later to greatly boost XP gains'},
    ] },
  { v:'V40', name:{fr:'Reset admin des quêtes', en:'Admin quest reset'}, fr:[
      {t:'new', tx:'Zone admin : bouton "Réinitialiser mes quêtes" (local, instantané) et bouton "Réinitialiser les quêtes de tous" (remet à zéro les quêtes journalières/hebdo de tous les joueurs, action serveur irréversible)'},
    ], en:[
      {t:'new', tx:'Admin zone: "Reset my quests" button (local, instant) and "Reset everyone\'s quests" button (clears daily/weekly quests for all players, irreversible server action)'},
    ] },
  { v:'V39', name:{fr:'Encarts repliables & suivi des quêtes', en:'Collapsible widgets & quest tracking'}, fr:[
      {t:'new', tx:'Nouveau bouton "🔖 Suivre les quêtes restantes" dans le panneau Quêtes : affiche un encart en haut à droite listant toutes les quêtes journalières et hebdomadaires pas encore réclamées, avec leur progression'},
      {t:'change', tx:'L\'encart de suivi (timers de reset journalier/hebdo + prochain succès) est déplacé en haut à droite, et peut être replié via son propre bouton ▾/▸'},
      {t:'new', tx:'Ajout du temps de jeu total et du temps de jeu du jour dans l\'encart de suivi'},
    ], en:[
      {t:'new', tx:'New "🔖 Track remaining quests" button in the Quests panel: shows a widget at the top-right listing every daily and weekly quest not yet claimed, with its progress'},
      {t:'change', tx:'The tracker widget (daily/weekly reset timers + next achievement) moved to the top-right, and can be collapsed via its own ▾/▸ button'},
      {t:'new', tx:'Added total playtime and today\'s playtime to the tracker widget'},
    ] },
  { v:'V38', name:{fr:'Refonte de la liste des zones de farm', en:'Farming zone list redesign'}, fr:[
      {t:'change', tx:'Chaque zone tient maintenant sur une seule ligne (nom, difficulté, PA/PD requis, 👁) — on voit plus de zones sans défiler'},
      {t:'change', tx:'Retiré le bouton "Farmer" : cliquer directement sur une zone permet désormais de partir la farmer ; le bouton 👁 ne fait plus que prévisualiser son loot sans y aller'},
      {t:'new', tx:'Le 👁 de la zone actuellement prévisualisée reste entouré d\'un halo doré en permanence, pour ne pas la confondre avec la zone qu\'on farm réellement'},
    ], en:[
      {t:'change', tx:'Each zone now fits on a single line (name, difficulty, required AP/DP, 👁) — see more zones without scrolling'},
      {t:'change', tx:'Removed the "Farm" button: clicking a zone directly now travels there to farm it; the 👁 button now only previews its loot without traveling'},
      {t:'new', tx:'The 👁 of the currently previewed zone keeps a permanent gold halo, so it\'s never confused with the zone you\'re actually farming'},
    ] },
  { v:'V37', name:{fr:'Aperçu complet des quêtes & panneau repliable', en:'Full quest overview & collapsible panel'}, fr:[
      {t:'change', tx:'Le panneau "🗒️ Quêtes" affiche désormais tous les objectifs possibles de chaque pool (journalier et hebdomadaire), pas seulement les 3 tirées ce cycle — celles non actives restent visibles en grisé avec leur objectif'},
      {t:'new', tx:'Les sections Journalières et Hebdomadaires peuvent être repliées/dépliées en cliquant sur leur titre'},
    ], en:[
      {t:'change', tx:'The "🗒️ Quests" panel now shows every possible objective in each pool (daily and weekly), not just the 3 picked this cycle — inactive ones stay visible dimmed out with their objective'},
      {t:'new', tx:'The Daily and Weekly sections can be collapsed/expanded by clicking their title'},
    ] },
  { v:'V36', name:{fr:'Quêtes hebdomadaires & encart de suivi', en:'Weekly quests & tracker widget'}, fr:[
      {t:'new', tx:'Quêtes hebdomadaires : 3 quêtes tirées au hasard chaque semaine (butin rare, équipement trouvé, optimisations réussies, grosses cibles de kills/silver/temps de jeu), avec des récompenses plus élevées — se réinitialisent chaque lundi, indépendamment des quêtes journalières'},
      {t:'new', tx:'Nouvel encart permanent en bas à droite de l\'écran : compte à rebours avant la prochaine réinitialisation (journalière et hebdomadaire) et le prochain succès le plus proche d\'être débloqué'},
    ], en:[
      {t:'new', tx:'Weekly quests: 3 randomly picked each week (rare jewelry, gear found, successful enhancements, big kill/silver/playtime targets), with higher rewards — reset every Monday, independently from daily quests'},
      {t:'new', tx:'New persistent widget at the bottom-right of the screen: countdown to the next reset (daily and weekly) and the achievement closest to being unlocked'},
    ] },
  { v:'V35', name:{fr:'Succès & quêtes journalières', en:'Achievements & daily quests'}, fr:[
      {t:'new', tx:'Nouveau bouton "🏅 Succès" : 22 succès permanents (kills, butin, silver, zones, gearscore, enchantement, temps de jeu...) qui rapportent du silver dès qu\'ils sont débloqués — d\'autres seront ajoutés à chaque future mise à jour selon le nouveau contenu'},
      {t:'new', tx:'Nouveau bouton "🗒️ Quêtes" : 3 quêtes journalières tirées au hasard chaque jour, à réclamer pour du silver une fois complétées — se réinitialisent chaque jour à minuit'},
    ], en:[
      {t:'new', tx:'New "🏅 Achievements" button: 22 permanent achievements (kills, loot, silver, zones, gearscore, enhancement, playtime...) that grant silver as soon as they\'re unlocked — more will be added with each future update based on new content'},
      {t:'new', tx:'New "🗒️ Quests" button: 3 daily quests randomly picked each day, claimable for silver once completed — reset every day at midnight'},
    ] },
  { v:'V34', name:{fr:'Icônes équipement originales', en:'Original equipment icons'}, fr:[
      {t:'change', tx:'Les icônes d\'équipement et de bijoux (arme, armure, anneaux, boucles d\'oreilles, collier, ceinture...) sont désormais des icônes SVG dessinées spécialement pour ce projet, à la place des emojis génériques'},
    ], en:[
      {t:'change', tx:'Equipment and jewelry icons (weapon, armor, rings, earrings, necklace, belt...) are now original SVG icons drawn specifically for this project, replacing the generic emojis'},
    ] },
  { v:'V33', name:{fr:'Fix charge CPU continue', en:'Continuous CPU load fix'}, fr:[
      {t:'fix', tx:'Correctif de performance important : la mise à jour automatique (chaque seconde) reconstruisait tout le sac (192 cases), la poupée d\'équipement et la liste des zones même quand rien n\'avait changé — ne le fait désormais que si l\'inventaire ou la zone a réellement changé'},
    ], en:[
      {t:'fix', tx:'Major performance fix: the automatic per-second refresh rebuilt the entire bag (192 slots), equipment paperdoll and zone list even when nothing had changed — now only does so when the inventory or zone actually changed'},
    ] },
  { v:'V32', name:{fr:'Nettoyage & fix latence optimisation', en:'Cleanup & enhancement lag fix'}, fr:[
      {t:'change', tx:'Retiré le système de code à générer pour lier Discord dans "Mon compte" (remplacé par le bouton "Connecter Discord" en un clic)'},
      {t:'fix',    tx:'Correctif de performance important : chaque tentative d\'optimisation reconstruisait toute la poupée d\'équipement et redessinait le portrait, causant une latence perceptible en spammant le bouton — ne met désormais à jour que la pièce concernée'},
    ], en:[
      {t:'change', tx:'Removed the code-generation system for linking Discord in "My account" (replaced by the one-click "Connect Discord" button)'},
      {t:'fix',    tx:'Major performance fix: every enhancement attempt rebuilt the entire equipment paperdoll and redrew the character portrait, causing noticeable lag when spamming the button — now only updates the affected piece'},
    ] },
  { v:'V31', name:{fr:'Correctif fermeture accidentelle', en:'Accidental close fix'}, fr:[
      {t:'fix', tx:'Sélectionner du texte dans un champ (ex: le pseudo) puis relâcher la souris juste en dehors ne ferme plus tout le panneau par erreur (Mon compte, Marché, connexion)'},
    ], en:[
      {t:'fix', tx:'Selecting text in a field (e.g. nickname) and releasing the mouse just outside no longer closes the whole panel by mistake (My account, Market, login)'},
    ] },
  { v:'V30', name:{fr:'Connexion Discord & pseudo', en:'Discord login & nickname'}, fr:[
      {t:'new',    tx:'Bouton "🎮 Se connecter avec Discord" — connexion directe, et ajout automatique au serveur Discord communautaire'},
      {t:'new',    tx:'Panneau "Mon compte" : les comptes email peuvent aussi connecter Discord (sans perdre leur compte existant)'},
      {t:'new',    tx:'Pseudo personnalisable dans "Mon compte" — par défaut ton pseudo Discord si tu t\'es connecté ainsi, sinon la partie avant @ de ton email'},
      {t:'change', tx:'Changer de pseudo met à jour la même entrée partout dans le classement (silver, gearscore, filleuls...), impossible d\'en recréer une nouvelle'},
    ], en:[
      {t:'new',    tx:'"🎮 Sign in with Discord" button — direct login, and automatic join to the community Discord server'},
      {t:'new',    tx:'"My account" panel: email accounts can now also connect Discord (without losing their existing account)'},
      {t:'new',    tx:'Customizable nickname in "My account" — defaults to your Discord name if you signed in that way, otherwise the part of your email before @'},
      {t:'change', tx:'Changing your nickname updates the same entry everywhere in the leaderboard (silver, gearscore, referrals...), it can never create a new one'},
    ] },
  { v:'V29', name:{fr:'Menu & clarté connexion', en:'Menu & login clarity'}, fr:[
      {t:'change', tx:'Le compteur "joueurs en ligne" est déplacé dans le menu latéral au lieu de flotter en haut de l\'écran'},
      {t:'fix',    tx:'Clarifie qu\'après une déconnexion (mode invité automatique), le bouton "🔗 Lier un compte" permet aussi de se reconnecter à un compte EXISTANT via "Se connecter" (et pas seulement d\'en créer un nouveau)'},
    ], en:[
      {t:'change', tx:'The "players online" counter now lives in the side menu instead of floating at the top of the screen'},
      {t:'fix',    tx:'Clarifies that after logging out (automatic guest mode), the "🔗 Link account" button can also sign back into an EXISTING account via "Sign in" (not just create a new one)'},
    ] },
  { v:'V28', name:{fr:'Liaison Discord', en:'Discord linking'}, fr:[
      {t:'new', tx:'Panneau "Mon compte" : bouton pour générer un code et lier ton compte Discord au jeu (commande /lier sur le serveur Discord)'},
    ], en:[
      {t:'new', tx:'"My account" panel: button to generate a code and link your Discord account to the game (/lier command on the Discord server)'},
    ] },
  { v:'V26', name:{fr:'Correctif de ralentissement', en:'Slowdown fix'}, fr:[
      {t:'fix', tx:'Correctif de performance important : les packs de monstres vaincus restaient en mémoire tant que le joueur ne s\'éloignait pas de 900 unités, ce qui ralentissait progressivement le jeu (et parfois le PC) sur une session de farm prolongée dans la même zone'},
    ], en:[
      {t:'fix', tx:'Major performance fix: defeated monster packs stayed in memory as long as the player didn\'t move 900 units away, progressively slowing down the game (and sometimes the PC) during long farming sessions in the same zone'},
    ] },
  { v:'V25', name:{fr:'Joueurs en ligne & parrainage', en:'Online players & referrals'}, fr:[
      {t:'new', tx:'Compteur "joueurs en ligne" en haut de l\'écran (invités inclus, mis à jour toutes les 20s)'},
      {t:'new', tx:'Nouveau panneau "👤 Mon compte" (comptes vérifiés) : code de parrainage à partager, champ pour entrer celui d\'un autre joueur, compteur et liste détaillée de tes filleuls (niveau, gearscore, silver) — pas de récompense pour l\'instant, uniquement du suivi'},
      {t:'change', tx:'Règles de parrainage : un compte ne peut être parrainé qu\'une fois, uniquement dans les 3 jours suivant sa création, jamais avec son propre code ni celui de son propre parrain'},
    ], en:[
      {t:'new', tx:'"Players online" counter at the top of the screen (guests included, refreshed every 20s)'},
      {t:'new', tx:'New "👤 My account" panel (verified accounts): referral code to share, a field to enter someone else\'s, a counter and detailed list of your referrals (level, gearscore, silver) — no reward for now, tracking only'},
      {t:'change', tx:'Referral rules: an account can only be referred once, only within 3 days of its creation, never with your own code or your own referrer\'s'},
    ] },
  { v:'V24', name:{fr:'Fini le mur de connexion', en:'No more login wall'}, fr:[
      {t:'change',  tx:'Le jeu se lance directement en mode invité (session anonyme sauvegardée sur le serveur, sans email ni pseudo) — plus besoin de créer un compte pour jouer et être sauvegardé dans le cloud'},
      {t:'new',     tx:'Bouton "🔗 Lier un compte" pour transformer une session invité en compte vérifié à tout moment — la progression est conservée intégralement'},
      {t:'exploit', tx:'Marché, Marché commun et Classement réservés aux comptes vérifiés (invités exclus) pour limiter la triche par comptes jetables — vérifié à la fois côté client et côté serveur'},
    ], en:[
      {t:'change',  tx:'The game now launches directly in guest mode (anonymous session saved server-side, no email or username needed) — no more account required to play and get cloud saves'},
      {t:'new',     tx:'"🔗 Link account" button to upgrade a guest session into a verified account at any time — progress is fully kept'},
      {t:'exploit', tx:'Market, Common Market and Leaderboard restricted to verified accounts (guests excluded) to limit throwaway-account abuse — enforced both client-side and server-side'},
    ] },
  { v:'V23', name:{fr:'Marché commun', en:'Common Market'}, fr:[
      {t:'new', tx:'Nouvel onglet "Marché commun" dans l\'Hôtel des ventes : achète/vends tes matériaux d\'optimisation à un prix commun flottant (borné par un min/max, façon vrai marché de BDO) — pas besoin de créer une annonce, transaction instantanée'},
      {t:'new', tx:'Le prix de chaque matériau varie dans le temps selon l\'offre et la demande (inflation/déflation), avec un code couleur (vert = proche du minimum, rouge = proche du maximum)'},
      {t:'new', tx:'Admin : bouton pour forcer une réévaluation immédiate du marché commun'},
      {t:'change', tx:'Le gear et les bijoux restent sur l\'Hôtel des ventes classique (annonces à prix libre) — chaque pièce a ses propres stats aléatoires, incompatible avec un prix commun'},
    ], en:[
      {t:'new', tx:'New "Common Market" tab in the Marketplace: buy/sell your enhancement materials at a floating common price (bounded by a min/max, like BDO\'s real central market) — no listing needed, instant transaction'},
      {t:'new', tx:'Each material\'s price drifts over time based on supply and demand (inflation/deflation), color-coded (green = near minimum, red = near maximum)'},
      {t:'new', tx:'Admin: button to force an immediate common market reevaluation'},
      {t:'change', tx:'Gear and jewelry stay on the classic Marketplace (free-price listings) — each piece has its own randomized stats, incompatible with a shared price'},
    ] },
  { v:'V22', name:{fr:'Encadré admin, zones & classement enrichi', en:'Admin box, zones & richer leaderboard'}, fr:[
      {t:'new',    tx:'Encadré Admin séparé dans le menu (Admin + Réinitialiser), prêt à accueillir de futures options réservées à l\'admin'},
      {t:'new',    tx:'Icônes réalistes pour les bijoux (bague, oreille, collier, ceinture) — avant, tous les bijoux affichaient la même icône bague'},
      {t:'fix',    tx:'Liste des zones : la colonne PA/PD est maintenant toujours alignée, et le badge de danger n\'est plus coupé'},
      {t:'new',    tx:'Chaque zone a maintenant un bouton Voir (aperçu du loot sans voyager) et un bouton Farmer (voyage direct)'},
      {t:'new',    tx:'Classement : ajout d\'un tableau "Objet le plus farmé" par joueur, et d\'un repère ⚠️ si les stats d\'un joueur n\'ont pas été synchronisées depuis plus de 10 minutes'},
    ], en:[
      {t:'new',    tx:'Separate Admin box in the menu (Admin + Reset), ready for future admin-only options'},
      {t:'new',    tx:'Realistic jewelry icons (ring, earring, necklace, belt) — previously every jewelry piece showed the same ring icon'},
      {t:'fix',    tx:'Zone list: the AP/DP column is now always aligned, and the danger badge no longer gets cut off'},
      {t:'new',    tx:'Each zone now has a View button (loot preview without traveling) and a Farm button (direct travel)'},
      {t:'new',    tx:'Leaderboard: added a "Most farmed item" table per player, and a ⚠️ marker if a player\'s stats haven\'t synced in over 10 minutes'},
    ] },
  { v:'V21', name:{fr:'Discord, menu réglable & correctifs', en:'Discord, adjustable menu & fixes'}, fr:[
      {t:'new',    tx:'Lien Discord ajouté dans le menu latéral'},
      {t:'new',    tx:'Slider Gauche/Droite pour choisir le côté d\'affichage du menu latéral'},
      {t:'new',    tx:'La version du client est affichée en bas du menu, et la fenêtre de mise à jour indique désormais le numéro de la nouvelle version — fenêtre déplacée en haut de l\'écran'},
      {t:'fix',    tx:'Correctif important : le tooltip et le menu clic-droit des objets affichaient les PA/PD DE BASE d\'une pièce d\'équipement au lieu de sa vraie valeur une fois enchantée (ex : une arme +10 affichait la stat d\'une arme +0)'},
      {t:'change', tx:'Poids de base (LT) recalibré pour tenir ~2h de farm continu avant ralentissement (contre ~30min avant) — augmentable plus tard via une boutique'},
      {t:'new',    tx:'Emoji ajoutés sur Wiki, Notes de version, Déconnexion et le sélecteur de langue'},
    ], en:[
      {t:'new',    tx:'Discord link added to the side menu'},
      {t:'new',    tx:'Left/Right slider to choose which side the side menu is displayed on'},
      {t:'new',    tx:'Client version shown at the bottom of the menu, and the update window now shows the new version number — window moved to the top of the screen'},
      {t:'fix',    tx:'Important fix: the tooltip and right-click menu for items showed a gear piece\'s BASE AP/DP instead of its real value once enhanced (e.g. a +10 weapon showed the same stat as a +0 one)'},
      {t:'change', tx:'Base weight limit (LT) recalibrated for ~2h of continuous farming before slowdown (was ~30min) — increasable later via a shop'},
      {t:'new',    tx:'Added emoji to Wiki, Patch Notes, Logout and the language selector'},
    ] },
  { v:'V20', name:{fr:'Refonte du menu', en:'Menu redesign'}, fr:[
      {t:'new',    tx:'Les notes de version ont maintenant un nom par version, et les lignes qui décrivent une mécanique retirée du jeu affichent un tag "🗑 Supprimé"'},
      {t:'change', tx:'Sélecteur de langue transformé en slider FR/EN qui indique clairement la langue active'},
      {t:'change', tx:'Menu latéral : les boutons (Wiki, Classement, Marché, Admin...) sont regroupés dans un menu vertical sur le côté gauche avec des icônes agrandies'},
      {t:'fix',    tx:'Le message "✓ sauvegardé" ne fait plus bouger les autres boutons du menu quand il apparaît/disparaît'},
    ], en:[
      {t:'new',    tx:'Patch notes now have a name per version, and lines describing a mechanic that no longer exists show a "🗑 Removed" tag'},
      {t:'change', tx:'Language selector turned into a FR/EN slider that clearly shows the active language'},
      {t:'change', tx:'Side menu: buttons (Wiki, Leaderboard, Marketplace, Admin...) are now grouped into a vertical menu on the left with bigger icons'},
      {t:'fix',    tx:'The "✓ saved" message no longer shifts the other menu buttons when it appears/disappears'},
    ] },
  { v:'V19', name:{fr:'Classement & Gearscore', en:'Leaderboard & Gearscore'}, fr:[
      {t:'change',  tx:'"Power Score" renommé en Gearscore, calculé simplement : (PA + PD) / 2'},
      {t:'new',     tx:'Nouvel onglet 🏆 Classement : silver, gearscore, meilleure zone atteinte et silver/heure (avec zone), top 20 pour chaque catégorie'},
      {t:'new',     tx:'Zone Admin : ajout du temps de jeu cumulé par joueur'},
    ], en:[
      {t:'change',  tx:'"Power Score" renamed to Gearscore, now simply computed as (AP + DP) / 2'},
      {t:'new',     tx:'New 🏆 Leaderboard tab: silver, gearscore, best zone reached and silver/hour (with zone), top 20 per category'},
      {t:'new',     tx:'Admin Zone: added cumulative playtime per player'},
    ] },
  { v:'V18', name:{fr:'Notification de mise à jour', en:'Update notification'}, fr:[
      {t:'new', tx:'Notification de mise à jour : un bandeau apparaît avec un bouton "Recharger" dès qu\'une nouvelle version du jeu est déployée, sans avoir à vider le cache manuellement'},
    ], en:[
      {t:'new', tx:'Update notification: a banner with a "Reload" button appears as soon as a new game version is deployed, no manual cache clearing needed'},
    ] },
  { v:'V17', name:{fr:'Zone Admin', en:'Admin Zone'}, fr:[
      {t:'new',     tx:'Zone Admin (🛠️ Admin) réservée au compte maxime.lacoste@icloud.com : silver farmé par heure, ressources les plus farmées, répartition des richesses entre joueurs'},
      {t:'new',     tx:'Journal de farm côté serveur : chaque objet ramassé par chaque joueur est enregistré (envoi par lots toutes les 25s) pour alimenter les stats admin'},
      {t:'exploit', tx:'Accès admin protégé par une règle de sécurité côté base de données (RLS) — même en trafiquant le code du navigateur, personne d\'autre que ce compte ne peut lire ces données'},
      {t:'change',  tx:'Le bouton Réinitialiser n\'est plus visible que pour l\'admin (avant : accessible à tous les testeurs)'},
    ], en:[
      {t:'new',     tx:'Admin Zone (🛠️ Admin) restricted to maxime.lacoste@icloud.com: silver farmed per hour, most-farmed resources, wealth distribution across players'},
      {t:'new',     tx:'Server-side farm log: every item picked up by every player is recorded (batched every 25s) to feed the admin stats'},
      {t:'exploit', tx:'Admin access protected by a database-level security rule (RLS) — even by tampering with browser code, no one else can read this data'},
      {t:'change',  tx:'The Reset button is now only visible to the admin (previously accessible to all testers)'},
    ] },
  { v:'V16', name:{fr:'Failstack par objet', en:'Per-item failstack'}, fr:[
      {t:'new',    tx:'Failstack PAR objet et PAR palier : chaque échec augmente ta chance sur CE niveau précis pour CET objet précis, et c\'est acquis pour toujours — barre à deux tons (or = base, bleu = bonus du failstack)'},
      {t:'fix',    tx:'L\'Arme d\'Éveil et l\'Arme secondaire ne comptaient jamais dans tes vraies stats de combat — seule l\'arme principale était lue. Corrigé.'},
      {t:'new',    tx:'Les bijoux (bagues/boucles/collier/ceinture) sont désormais optimisables comme le reste de l\'équipement'},
      {t:'new',    tx:'Double-clic sur n\'importe quelle pièce équipée (y compris armes et bijoux) pour la déséquiper directement'},
      {t:'new',    tx:'Bouton "Vendre les objets inférieurs" — nettoie le sac en vendant tout ce qui est strictement moins bon que ce qui est déjà équipé'},
      {t:'change', tx:'Le trash/silver est maintenant ramassé automatiquement même sac plein — seuls matériaux/bijoux/gear/craft restent au sol si le sac déborde'},
      {t:'change', tx:'Le poids a maintenant un vrai effet : au-dessus de la limite LT, le joueur est ralenti (jusqu\'à -65% de vitesse)'},
    ], en:[
      {t:'new',    tx:'PER-ITEM, PER-TIER failstack: every failure boosts your chance on THAT exact level for THAT exact item, permanently — two-tone bar (gold = base, blue = failstack bonus)'},
      {t:'fix',    tx:'Awakening and Secondary weapons never counted toward real combat stats — only the main weapon was read. Fixed.'},
      {t:'new',    tx:'Jewelry (rings/earrings/necklace/belt) can now be enhanced like any other gear'},
      {t:'new',    tx:'Double-click any equipped piece (including weapons and jewelry) to unequip it directly'},
      {t:'new',    tx:'"Sell items worse than equipped" button — cleans up your bag by selling anything strictly worse than what\'s already equipped'},
      {t:'change', tx:'Trash/silver is now always picked up even with a full bag — only materials/jewelry/gear/craft stay on the ground when it overflows'},
      {t:'change', tx:'Weight now actually matters: going over your LT limit slows you down (up to -65% speed)'},
    ] },
  { v:'V15', name:{fr:'Optimisation simplifiée', en:'Simplified enhancement'}, fr:[
      {t:'new',   tx:'Notes de version repensées : badge "NEW" par patch non lu, halo sur le bouton, compteur, catégories'},
      {t:'fix',   tx:'Le sac plein bloquait silencieusement le loot sans aucun message — bandeau d\'alerte ajouté'},
      {t:'change',tx:'Zones dangereuses beaucoup plus punitives (jusqu\'à 4,5× les dégâts reçus au lieu de 3×)'},
      {t:'change',tx:'Système d\'optimisation simplifié : retrait du failstack et du bandeau de Naderr, remplacés par des chances FIXES et lisibles'},
      {t:'fix',   tx:'Le classement des accessoires (bague/boucle/collier/ceinture) était cassé par une reconnaissance de mots-clés en français'},
    ], en:[
      {t:'new',   tx:'Redesigned patch notes: "NEW" badge per unread patch, button halo, counter, categories'},
      {t:'fix',   tx:'A full bag was silently blocking loot pickup with zero feedback — added a warning banner'},
      {t:'change',tx:'Dangerous zones now much more punishing (up to 4.5× incoming damage instead of 3×)'},
      {t:'change',tx:'Simplified enhancement system: removed failstack and Naderr\'s Band, replaced with clean FIXED odds'},
      {t:'fix',   tx:'Accessory categorization (ring/earring/necklace/belt) was broken due to French keyword matching'},
    ] },
  { v:'V14b', name:{fr:'Équiper le meilleur', en:'Equip best'}, fr:[
      {t:'new', tx:'Nouveau bouton "Équiper le meilleur" — compare les STATS DE BASE (enchantement ignoré) et équipe automatiquement le meilleur socle, même s\'il faut redescendre à +0 un objet à fort potentiel'},
      {t:'fix', tx:'Les accessoires étaient tous mal classés comme "bague" à cause d\'une reconnaissance de mots-clés en français sur des noms d\'objets anglais'},
    ], en:[
      {t:'new', tx:'New "Equip Best" button — compares BASE stats (enhancement ignored) and auto-equips the best foundation, even if it means dropping a high-potential piece back to +0'},
      {t:'fix', tx:'Accessories were all miscategorized as "ring" due to French keyword matching on English item names'},
    ] },
  { v:'V14', name:{fr:'Correctif de performance', en:'Performance fix'}, fr:[
      {t:'fix', tx:'Correctif de performance important : les tentatives d\'optimisation ne reconstruisent plus tout l\'inventaire (192 cases) et la liste des zones à chaque clic'},
      {t:'fix', tx:'Fini les ralentissements/plantages en enchaînant les tentatives d\'optimisation rapidement'},
    ], en:[
      {t:'fix', tx:'Major performance fix: enhancement attempts no longer rebuild the entire inventory (192 slots) and zone list on every click'},
      {t:'fix', tx:'No more slowdowns/freezes when spamming enhancement attempts quickly'},
    ] },
  { v:'V13', name:{fr:'Enchantement étendu (+15)', en:'Extended enhancement (+15)'}, fr:[
      {t:'change', tx:'Échelle d\'optimisation étendue à +15 avant les paliers PRI/DUO/TRI/TET/PEN'},
      {t:'change', tx:'À partir de PRI, un échec ne fait plus jamais rétrograder — seul le matériau est perdu'},
      {t:'change', tx:'+8 à +15 restent probabilistes et peuvent rétrograder, mais jamais sous +7'},
    ], en:[
      {t:'change', tx:'Enhancement scale extended to +15 before the PRI/DUO/TRI/TET/PEN tiers'},
      {t:'change', tx:'From PRI onward, a failure never downgrades your level anymore — only the material is lost'},
      {t:'change', tx:'+8 to +15 remain probabilistic and can downgrade, but never below +7'},
    ] },
  { v:'V12', name:{fr:'Éveil, failstack & Naderr', en:'Awakening, failstack & Naderr'}, fr:[
      {t:'change', tx:'Packs de monstres de plus en plus grands en avançant dans les zones (2-4 loups en early, jusqu\'à 9 en endgame)'},
      {t:'new',    tx:'Ajout de l\'Arme d\'Éveil et l\'Arme secondaire au loot (Dandelion, Nouver — vrais noms BDO)'},
      {t:'new',    tx:'Système de failstack façon Garmoth.com : chance de base + failstack, soft cap à 70%, plafond 90%', removed:true},
      {t:'new',    tx:'Bandeau de Naderr : 5 crans de failstack gratuits en montant de niveau, 5 autres réservés à une future boutique', removed:true},
      {t:'change', tx:'Rééquilibrage complet des stats d\'équipement lootable selon le rôle de chaque pièce'},
    ], en:[
      {t:'change', tx:'Monster packs grow larger deeper into the zones (2-4 wolves early, up to 9 at endgame)'},
      {t:'new',    tx:'Added Awakening Weapon and Secondary Weapon to loot (Dandelion, Nouver — real BDO names)'},
      {t:'new',    tx:'Garmoth.com-style failstack system: base chance + failstack, soft cap at 70%, 90% ceiling', removed:true},
      {t:'new',    tx:'Naderr\'s Band: 5 free failstack slots unlocked by leveling up, 5 more reserved for a future shop', removed:true},
      {t:'change', tx:'Full rebalance of lootable gear stats based on each piece\'s role'},
    ] },
  { v:'V11', name:{fr:'Système PA/PD', en:'AP/DP system'}, fr:[
      {t:'change', tx:'Remplacement du "Power Score" abstrait par un vrai système PA/PD affiché par zone (comme le vrai jeu)'},
      {t:'change', tx:'Pas assez de PD = tu encaisses plus de dégâts · pas assez de PA = tu en infliges moins'},
      {t:'fix',    tx:'Le PD de l\'équipement ne comptait pas dans la réduction de dégâts — oubli corrigé'},
      {t:'new',    tx:'La liste des zones affiche directement le PA/PD requis avec code couleur ✓/✗'},
    ], en:[
      {t:'change', tx:'Replaced the abstract "Power Score" with a real per-zone AP/DP system (like the real game)'},
      {t:'change', tx:'Not enough DP = you take more damage · not enough AP = you deal less'},
      {t:'fix',    tx:'Equipped DP wasn\'t counting toward damage reduction — fixed an oversight'},
      {t:'new',    tx:'The zone list now shows required AP/DP directly with ✓/✗ color coding'},
    ] },
  { v:'V10', name:{fr:'Wiki & traduction', en:'Wiki & translation'}, fr:[
      {t:'new', tx:'Ajout du wiki et des notes de version'},
      {t:'new', tx:'Bouton EN/FR pour traduire l\'interface'},
    ], en:[
      {t:'new', tx:'Added wiki and patch notes'},
      {t:'new', tx:'EN/FR toggle to translate the UI'},
    ] },
  { v:'V9', name:{fr:'Hôtel des ventes', en:'Marketplace'}, fr:[
      {t:'new',     tx:'Hôtel des ventes : acheter/vendre/annuler des annonces entre joueurs'},
      {t:'exploit', tx:'Transactions traitées par fonctions serveur sécurisées — impossible de tricher côté client'},
    ], en:[
      {t:'new',     tx:'Marketplace: buy/sell/cancel listings between players'},
      {t:'exploit', tx:'Transactions handled by secure server-side functions — no client-side cheating possible'},
    ] },
  { v:'V8', name:{fr:'Comptes joueurs & cloud save', en:'Player accounts & cloud save'}, fr:[
      {t:'new', tx:'Comptes joueurs avec connexion par email/mot de passe'},
      {t:'new', tx:'Sauvegarde automatique dans le cloud (Supabase) toutes les 30s'},
    ], en:[
      {t:'new', tx:'Player accounts with email/password login'},
      {t:'new', tx:'Automatic cloud save (Supabase) every 30s'},
    ] },
  { v:'V7', name:{fr:'Objets réels BDO', en:'Real BDO items'}, fr:[
      {t:'change', tx:'Vrais noms d\'objets et de zones tirés de Black Desert Online'},
      {t:'change', tx:'Taux de loot progressifs : généreux en zone 1, rares en fin de jeu'},
      {t:'new',    tx:'Cadre d\'optimisation avec sélection de la pièce à améliorer + suggestions'},
      {t:'new',    tx:'Armes et armures ajoutées au loot'},
      {t:'new',    tx:'Survol = infobulle, double-clic = équiper, clic droit = menu (jeter, vendre, optimiser)'},
    ], en:[
      {t:'change', tx:'Real item and zone names from Black Desert Online'},
      {t:'change', tx:'Progressive loot rates: generous in zone 1, rare at endgame'},
      {t:'new',    tx:'Enhancement panel with selectable target piece + suggestions'},
      {t:'new',    tx:'Weapons and armor added to loot tables'},
      {t:'new',    tx:'Hover = tooltip, double-click = equip, right-click = menu (drop, sell, enhance)'},
    ] },
  { v:'V6', name:{fr:'Panneau permanent', en:'Permanent panel'}, fr:[
      {t:'change', tx:'Panneau permanent (équipement + inventaire toujours visibles)'},
      {t:'change', tx:'Optimisation possible uniquement via le loot (plus d\'achat au silver)'},
    ], en:[
      {t:'change', tx:'Permanent panel (equipment + inventory always visible)'},
      {t:'change', tx:'Enhancement now loot-driven only (no more silver-bought upgrades)'},
    ] },
  { v:'V5', name:{fr:'Inventaire & équipement', en:'Inventory & equipment'}, fr:[
      {t:'new', tx:'Inventaire 192 emplacements façon BDO'},
      {t:'new', tx:'Équipement circulaire (arme, armure, accessoires)'},
      {t:'new', tx:'Équiper/déséquiper/vendre depuis le sac'},
    ], en:[
      {t:'new', tx:'192-slot BDO-style inventory'},
      {t:'new', tx:'Circular equipment paperdoll (weapon, armor, accessories)'},
      {t:'new', tx:'Equip/unequip/sell directly from the bag'},
    ] },
  { v:'V4', name:{fr:'Power Score & zones', en:'Power Score & zones'}, fr:[
      {t:'new', tx:'Power Score et ratio de puissance par zone', removed:true},
      {t:'new', tx:'Scaling des dégâts, du loot et du risque de mort selon le gear'},
      {t:'new', tx:'12 zones avec tables de loot à 4 couches'},
    ], en:[
      {t:'new', tx:'Power Score and per-zone power ratio', removed:true},
      {t:'new', tx:'Damage, loot and death-risk scaling based on gear'},
      {t:'new', tx:'12 zones with 4-layer loot tables'},
    ] },
  { v:'V3', name:{fr:'Vue isométrique', en:'Isometric view'}, fr:[
      {t:'change', tx:'Passage en vue isométrique'},
      {t:'change', tx:'Monde 2D libre (fini le couloir)'},
      {t:'change', tx:'Loot dispersé au sol, ramassé au contact, disparaît après 40s'},
    ], en:[
      {t:'change', tx:'Switched to isometric view'},
      {t:'change', tx:'Free 2D world (no more corridor)'},
      {t:'change', tx:'Loot scattered on the ground, picked up on contact, despawns after 40s'},
    ] },
  { v:'V2', name:{fr:'IA de combat complète', en:'Full combat AI'}, fr:[
      {t:'new', tx:'IA complète façon joueur BDO (recherche, déplacement, regroupement, combat, kite, soin, loot)'},
      {t:'new', tx:'Rotation de 10 sorts de Witch avec priorités'},
      {t:'new', tx:'Les monstres ripostent avec attaques télégraphiées'},
    ], en:[
      {t:'new', tx:'Full BDO-player-style AI (search, move, gather, combat, kite, heal, loot)'},
      {t:'new', tx:'10-skill Witch rotation with priorities'},
      {t:'new', tx:'Monsters now fight back with telegraphed attacks'},
    ] },
  { v:'V1', name:{fr:'Premier prototype', en:'First prototype'}, fr:[
      {t:'new', tx:'Premier prototype jouable : déplacement automatique, combat, loot basique'},
    ], en:[
      {t:'new', tx:'First playable prototype: automatic movement, combat, basic loot'},
    ] },
];
