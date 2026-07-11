# market/

Le Marché commun : vrai carnet d'ordres entre joueurs (achat/vente), catalogue **unifié**
équipement + matériaux, popup "Acheter" façon Marché Central BDO, panneau "Mes ordres" ancré.

Refonte v3 (2026-07-22, port fidèle d'un mockup fourni — voir CLAUDE.md §1/§30) : remplace la v2
du 2026-07-16 (onglet "Matériaux" séparé avec carnet d'ordres/chandelier dédié). Les matériaux
vivent désormais dans le **même** catalogue/popup que l'équipement — `market_listings` les renvoie
déjà avec les autres `item_kind` quand `p_kind` est `null`.

- `market.js` — toute la logique et l'UI du marché. Communique avec Supabase via les RPC
  `market_place_order`/`market_cancel_order`/`market_order_book`/`market_my_orders`/`market_listings`/
  `get_market_open` (voir `supabase/migrations/`).

## Catalogue unifié (`marketCatalog()`)

Les objets qui n'ont **aucune vente en cours** restent visibles dans le catalogue (grisés, sans
prix) — navigation "catalogue complet", pas juste "ce qui est en vente". `marketCatalog()`
construit cette liste depuis les VRAIES tables de données du jeu, jamais depuis des noms
inventés :

- Armure/armes : `GEAR_TIERS[].sets` (4 paliers × 7 slots = 28 entrées, icônes via
  `helmetIconForColor`/`staffIconForColor`/etc., `gear-icons.js`).
- Bijoux : un nom par zone via `ZONES[].loot.jackpot.name` (dédupliqué), slot déterminé par
  `accSlotFor()` (`combat/loot-rolls.js`).
- Matériaux : `MARKET_MATERIALS` (inchangé).
- Catégorie "Artéfact / Pierre" (slots `artifact1`/`artifact2`/`eqStone`) : **aucune** entrée
  générée — ces 3 slots n'ont aucune source de drop dans le jeu actuel (`NO_SOURCE_SLOTS`,
  `inventory/inventory-ui.js`). Pas une régression : cette catégorie était déjà vide avant.

Le mockup fourni utilisait des noms de boss BDO réels mais absents de CE jeu comme noms de gear
(Kzarka/Kutum/Nouver/Ogre — Kzarka n'existe ici que comme World Boss, voir `BOSS_ROSTER`) : ces
noms ne sont PAS repris (CLAUDE.md §30 point 5). Le catalogue utilise exclusivement les vrais
noms du jeu (Naru/Tuvala/Yuria/Grunil, puis Asula/Cadry/Serap's/Orkinrad's/Tungrad's pour les
bijoux plus avancés).

## Popup "Acheter" — échelle de prix RÉELLE, pas simulée

Le mockup fourni fabriquait côté client un pas de prix fixe + des fonctions
`applyDemandInflation()`/`applySupplyDeflation()` (pas de backend dans un mockup autonome). Le
VRAI marché a déjà un carnet d'ordres multi-prix authentique : la popup affiche l'échelle de prix
réelle via `market_order_book` (regroupée par prix, sell = "en stock", buy = "commandes"), et le
matching serveur (`market_match_item`, `supabase/migrations/*market_sales_tax*`) sert déjà le
meilleur acheteur en premier + rembourse la différence de prix — exactement la dynamique visée
par le mockup, mais réelle et sans aucun état économique simulé côté client (donc aucun risque de
désync entre joueurs).

- `openBuyModal(g)` / `refreshBuyModalLadderAndStats()` / `renderBmTierList()` — construisent la
  popup depuis `market_order_book` + `market_trades` (chart, `drawItemPriceChart`, générique par
  `item_key`, réutilisable pour n'importe quel objet — plus seulement les matériaux).
- `cycleBmTier()` — cycle entre les variantes de niveau d'enchantement RÉELLEMENT en vente
  (jamais une variante hypothétique).

## Offres d'achat/de vente à prix libre

`renderCmDetailPanel()`/`wireCmOfferForms()` permettent de poser une offre à un prix différent du
meilleur prix affiché (achat) ou de vendre un objet possédé (vente), avec quantité pour les
matériaux — les deux passent par `market_place_order` (RPC existante, gère déjà le matching/la
taxe/le remboursement côté serveur).

`findInvIndexForSell(name, kind, enhLv)` / `ownedQtyFor(name, kind, enhLv)` résolvent l'emplacement
d'inventaire à vendre par nom **+ kind + niveau d'enchantement exact** — corrige un flou de
l'ancien `placeMarketOrder` (mort depuis le retrait de l'onglet "Vendre" le 2026-07-08, jamais
appelé) qui ne filtrait que par nom+kind et pouvait vendre le mauvais exemplaire si plusieurs
copies du même objet existaient à des paliers différents.

## "Mes ordres"

Panneau ancré à droite (`#marketOverlay .cmSidebar`), toujours visible quel que soit l'objet
consulté — remplace l'ancien 3e sous-onglet. Onglets Achat/Vente séparés
(`wireCmMyOrdersTabs`/`renderCmMyOrdersList`), annulation via `market_cancel_order` (inchangé,
rend le silver/objet bloqué).

## Palette

Tokens `--s1`/`--s2`/`--s3`/`--dbBorder`/`--dbBorder2`/`--gold`/`--gold2`/`--green2`/`--red2`/
`--cream2`/`--cream3` déjà posés par la refonte Zone (2026-07-11, voir `src/styles/styles.css`
~ligne 2499 et CLAUDE.md §29) — réutilisés tels quels. Le mockup fourni utilise exactement ces
mêmes teintes (thème "or sombre" déjà en place depuis Zone/Boss/Achievements/Classement), aucun
écart de palette à corriger.

## i18n

Tout le texte nouveau passe par `i18next.t('market:market.xxx')` (`locales/{fr,en}/market.json`),
jamais le vieux dictionnaire `I18N`/`data-i18n` (`game-supabase.js`, système bilingue ad hoc
antérieur à i18next — voir CLAUDE.md §31). `applyMarketStaticI18n()` applique les libellés
statiques de la popup/du panneau latéral à chaque ouverture du marché (`refreshCommonMarket()`).
