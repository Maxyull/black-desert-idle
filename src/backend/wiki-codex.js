// ============================================================
// WIKI / CODEX / CONFIANCE + modales openInfo()
// ============================================================
// Extrait de src/backend/game-supabase.js le 2026-07-22 (audit repo P5 : le fichier avait
// atteint 3 124 lignes, trois fois la limite de decoupe obligatoire de CLAUDE.md, et melangeait
// le contenu editorial avec le client Supabase).
//
// DECOUPAGE PAR TRANSPLANTATION, PAS PAR REECRITURE : les lignes sont sorties telles quelles, et
// ce fichier est charge dans index.dev.html EXACTEMENT a la place qu'occupait ce bloc dans
// l'original. Le projet n'a pas de modules ES -- tous les scripts partagent un seul scope global,
// et un `const`/`let` de haut niveau lu au chargement par un fichier suivant explose si l'ordre
// bouge (CLAUDE.md SS6). Preserver l'ordre a l'octet pres est ce qui rend ce decoupage sur.
//
// openInfo()/#infoOverlay est PARTAGE (Wiki, Compendium, Succes, Patch notes, Confiance) --
// c'est pour ca qu'il vit ici et pas dans un module de feature.


// ============================================================
// WIKI — règles maison qui diffèrent du vrai BDO
// ============================================================
// Wiki organisé en catégories (comme Admin / Classement / Quêtes) — chaque section a son onglet
const WIKI_SECTIONS = [
  { id:'combat', icon:'⚔️', label:{fr:'Combat & Zones',en:'Combat & Zones'},
    fr:`<h3>PA / PD par zone (comme dans le vrai jeu)</h3>
      <p>Chaque zone a un <b>PA requis</b> et un <b>PD requis</b> affichés directement. Les deux stats jouent des rôles séparés :</p>
      <ul>
        <li><b>Pas assez de PA</b> → tes sorts infligent moins de dégâts (jusqu'à -75% si très sous-PA)</li>
        <li><b>Pas assez de PD</b> → tu encaisses beaucoup plus de dégâts (jusqu'à 4,5×), risque de K.O. élevé</li>
        <li>Au-dessus des deux → dégâts et réduction bonus, plafonnés pour éviter le farm abusif</li>
        <li>Le loot suit le pire des deux ratios : ta pénalité de loot est calculée sur <b>le plus faible</b> de tes 2 ratios (PA effectif / PA requis, PD effectif / PD requis), jamais la moyenne ni le meilleur. Exemple : un PA parfait (ratio 1.5) mais un PD à moitié du requis (ratio 0.5) → ton loot est pénalisé <b>comme si tu étais à 0.5 partout</b>, le PA excédentaire ne compense rien. En dessous de <b>90%</b> du requis → loot réduit (jusqu'à -70%) ; dès <b>90%</b> du requis (pas besoin d'atteindre 100%) OU overstuff → loot toujours normal (100%), plus aucun bonus ni malus au-delà</li>
        <li><b>ZONE DANGEREUSE</b> (très sous-PA/PD) → tu es ralenti, et les monstres qui t'ont repéré deviennent plus rapides pour te rattraper</li>
      </ul>
      <h3>Mana</h3>
      <p>Chaque sort coûte de la mana, qui se régénère passivement même hors combat. Une potion de mana (auto-bue sous 30%) complète la potion de PV si tu es à court.</p>
      <h3>Loot progressif</h3>
      <p>Les taux de drop sont <b>volontairement décroissants</b> zone par zone : le matériau d'optimisation passe d'environ 55% en toute première zone à environ 5-7% en fin de jeu, les composants de craft endgame (Fragment de mémoire, Marbre du Dieu déchu...) descendent eux sous 1%.</p>
      <h3>Sac plein (192/192)</h3>
      <p>Le silver n'occupe jamais de place (toujours ramassé). Un matériau/bijou déjà en stack dans ton sac continue lui aussi d'être ramassé tant que ce stack n'est pas à son maximum, même sac plein. Seuls les <b>nouveaux</b> objets qui auraient besoin d'une case libre restent au sol — un bandeau rouge ⚠ t'en avertit, sans jamais t'empêcher de continuer à farmer.</p>
      <h3>Zones groupées par palier de stuff</h3>
      <p>Les 16 zones de Velia sont regroupées par palier d'équipement (Naru/gris, Tuvala/blanc, Yuria/vert, Grunil/bleu — 4 zones chacun) — la couleur de l'en-tête et de la bordure correspond à la couleur du stuff qu'on y trouve, la même que dans l'inventaire.</p>
      <p>Chaque zone garantit une seule pièce d'armure précise (casque/plastron/gants sur les 3 premières zones du palier, bottes sur la 4e) ; côté arme, 3 des 4 zones du palier garantissent chacune un type différent (arme principale/secondaire/éveil, jamais deux fois le même), seule la 2<sup>e</sup> zone du palier n'a aucune arme garantie. Clique l'icône 👁 d'une zone pour voir exactement laquelle.</p>
      <h3>Trésor de Velia</h3>
      <p>Toutes les zones de Velia peuvent aussi looter des morceaux du <b>Trésor de Velia</b> — 2 objets collectibles très rares (0,17% et 0,0005% par kill), rangés dans leur propre onglet d'inventaire 🗺️. 100 "Bout du trésor de Velia" se combinent (onglet Assemblage) en 1 "Trésor de Velia" complet, revendable à très haute valeur. Une recette secrète existe aussi (1 Trésor de Velia + 1 de Heidel + 1 de Calpheon → coffret bonus), mais reste hors de portée tant que Heidel/Calpheon ne sont pas débloqués.</p>
      <h3>Sceau du Conclave des Marchands</h3>
      <p>Un 5<sup>e</sup> trésor légendaire, distinct du Trésor de Velia : 5 "Sceaux de Guilde", un par région (Velia/Heidel/Calpheon/Valencia/Edana), à assembler (onglet Assemblage) en un unique <b>Sceau du Conclave des Marchands</b> — objet unique par compte, non revendable. Seul le Sceau du Port Ancestral (Velia) est obtenable aujourd'hui, en drop très rare dans n'importe quelle zone de Velia ; les 4 autres restent hors de portée tant que leur région n'est pas débloquée. Une fois assemblé (donc seulement quand les 5 régions seront sorties) : -5% de taxe de vente, -3% de frais de mise en vente, +8% de gain net à la vente, +1 emplacement d'enchère par région possédée (jusqu'à +5), un passif "Réseau Continental" (+2% de vente par région dont le Sceau de Guilde a contribué à l'assemblage, cumulable jusqu'à +10%) et un <b>Aperçu du prix moyen</b> (moyenne des 10 dernières ventes réelles) affiché dans le panneau Marché pour chaque objet consulté.</p>
      <h3>Boss mondiaux partagés</h3>
      <p>Le <b>Kzarka</b> du planning horaire (12h45/19h45/23h45 tous les jours, 15h45 le week-end) a des <b>PV réellement partagés entre tous les joueurs</b>, exactement comme un boss lancé par l'admin : tout le monde tape le même pool de PV et se voit dans l'arène. Le <b>Vell</b>, boss hebdomadaire bien plus rare et plus coriace (jeudi 12h00 et dimanche 16h45 — horaires in-game, soit -15 min par rapport aux horaires réels garmoth.com de 12h15/17h00), fonctionne sur le même principe.</p>
      <h3>Où farmer un socle vide ?</h3>
      <p>Clique un socle d'équipement <b>vide</b> sur la poupée : la ou les zones qui lootent cet objet s'illuminent d'un halo doré dans la liste des zones, et un bouton te téléporte directement dessus. Une zone dangereuse pour ton stuff actuel n'est jamais proposée tant qu'une alternative plus sûre existe.</p>`,
    en:`<h3>AP / DP per zone (like the real game)</h3>
      <p>Every zone has a <b>required AP</b> and <b>required DP</b>. The two stats play separate roles:</p>
      <ul>
        <li><b>Not enough AP</b> → your spells deal less damage (up to -75%)</li>
        <li><b>Not enough DP</b> → you take a lot more damage (up to 4.5×), high KO risk</li>
        <li>Above both → bonus damage and reduction, capped to prevent overfarming</li>
        <li>Loot follows the worse of the two ratios: your loot penalty is calculated on <b>whichever is lowest</b> of your 2 ratios (effective AP / required AP, effective DP / required DP), never the average or the best one. Example: perfect AP (ratio 1.5) but DP at half the requirement (ratio 0.5) → your loot is penalized <b>as if you were at 0.5 everywhere</b>, the excess AP compensates for nothing. Below <b>90%</b> of the requirement → reduced loot (up to -70%); from <b>90%</b> of the requirement onward (no need to reach 100%) OR overgeared → loot always normal (100%), no bonus or penalty beyond that</li>
        <li><b>DANGEROUS ZONE</b> (very under-AP/DP) → you are slowed down, and monsters that spotted you become faster to catch up</li>
      </ul>
      <h3>Mana</h3>
      <p>Every skill costs mana, which regenerates passively even out of combat. A mana potion (auto-drunk under 30%) joins the HP potion if you run low.</p>
      <h3>Progressive loot</h3>
      <p>Drop rates are <b>intentionally decreasing</b> zone by zone: the enhancement material goes from about 55% in the very first zone down to about 5-7% at endgame, while endgame crafting components (Memory Fragment, Fallen God's Marble...) drop under 1%.</p>
      <h3>Full bag (192/192)</h3>
      <p>Silver never takes up space (always picked up). A material/jewelry already stacked in your bag keeps getting picked up as long as that stack isn't full, even with a full bag. Only <b>new</b> items that would need a free slot stay on the ground — a red ⚠ banner warns you, without ever stopping you from farming.</p>
      <h3>Zones grouped by gear tier</h3>
      <p>The 16 Velia zones are grouped by gear tier (Naru/grey, Tuvala/white, Yuria/green, Grunil/blue — 4 zones each) — the header and border color match the gear color found there, same as in the inventory.</p>
      <p>Every zone guarantees exactly one specific armor piece (helmet/armor/gloves on the tier's first 3 zones, boots on the 4th); for weapons, 3 of the tier's 4 zones each guarantee a different type (main/secondary/awakening, never the same type twice) — only the tier's 2<sup>nd</sup> zone has no guaranteed weapon. Click a zone's 👁 icon to see exactly which one.</p>
      <h3>Velia Treasure</h3>
      <p>All Velia zones can also drop pieces of the <b>Velia Treasure</b> — 2 very rare collectibles (0.17% and 0.0005% per kill), stored in their own 🗺️ inventory tab. 100 "Velia Treasure Piece" combine (Assembly tab) into 1 complete "Velia Treasure", sellable for a very high value. A secret recipe also exists (1 Velia Treasure + 1 Heidel Treasure + 1 Calpheon Treasure → bonus chest), but stays out of reach until Heidel/Calpheon are unlocked.</p>
      <h3>Merchants' Conclave Seal</h3>
      <p>A 5th legendary treasure, separate from the Velia Treasure: 5 "Guild Seals", one per region (Velia/Heidel/Calpheon/Valencia/Edana), assembled (Assembly tab) into a single <b>Merchants' Conclave Seal</b> — an account-unique item, not resellable. Only the Ancestral Harbor Seal (Velia) is obtainable today, as a very rare drop in any Velia zone; the other 4 stay out of reach until their region is unlocked. Once assembled (so only once all 5 regions have shipped): -5% sell tax, -3% listing fee, +8% net sell gain, +1 market slot per region owned (up to +5), a "Continental Network" passive (+2% on sales per region whose Guild Seal contributed to the assembly, stacking up to +10%), and an <b>Average price preview</b> (last 10 real sales) shown in the Market panel for every item viewed.</p>
      <h3>Shared world bosses</h3>
      <p>The scheduled <b>Kzarka</b> (12:45pm/7:45pm/11:45pm daily, 3:45pm on weekends) has <b>truly shared HP across all players</b>, exactly like an admin-spawned boss: everyone hits the same HP pool and is visible in the arena. The <b>Vell</b>, a much rarer and tougher weekly boss (Thursday 12:00pm and Sunday 4:45pm in-game — 15 minutes earlier than the real garmoth.com schedule of 12:15pm/5:00pm), works the same way.</p>
      <h3>Where to farm an empty slot?</h3>
      <p>Click an <b>empty</b> equipment slot on the paperdoll: the zone(s) that drop that item light up with a gold halo in the zone list, plus a button teleports you there directly. A zone too dangerous for your current gear is never suggested while a safer alternative exists.</p>` },
  { id:'enh', icon:'✦', label:{fr:'Optimisation',en:'Enhancement'},
    fr:`<h3>Enchantement</h3>
      <p>+1 à +7 toujours réussi. <b>+8 à +15</b> sont probabilistes (45% → 5%) et peuvent rétrograder en cas d'échec, mais jamais sous +7.</p>
      <p>Puis <b>PRI/DUO/TRI/TET/PEN</b> suivent des chances fixes (12%/9%/6%/3%/1,2%). À partir de PRI, un échec fait <b>rétrograder d'un palier</b> (ex : DUO → PRI) — mais <b>jamais sous PRI</b> : tu ne retombes plus jamais à +15.</p>
      <p>Pas de failstack caché : ce que tu vois à l'écran est la chance réelle. Chaque pièce a son propre niveau, indépendant.</p>
      <p>La <b>Poussière d'esprit ancien</b> ne sert pas à optimiser directement : c'est un composant pour fabriquer des Pierres de Caphras.</p>
      <p>La <b>Pierre de Cron</b> (1% de drop, 1 à 3 unités, toutes zones) protège d'une rétrogradation en cas d'échec — à toi de décider si tu veux l'utiliser via la case à cocher à côté du matériau chargé, elle n'est plus consommée automatiquement. Son coût dépend du palier de la pièce protégée : 1 (gris), 2 (blanc), 3 (vert), 4 (bleu).</p>
      <p>Astuce : clique le petit 🔧 sur une pièce équipée pour charger directement CETTE pièce dans le panneau d'optimisation.</p>`,
    en:`<h3>Enhancement</h3>
      <p>+1 to +7 always succeed. <b>+8 to +15</b> are probabilistic (45% → 5%) and can downgrade on failure, but never below +7.</p>
      <p>Then <b>PRI/DUO/TRI/TET/PEN</b> follow fixed chances (12%/9%/6%/3%/1.2%). From PRI, a failure <b>downgrades one tier</b> (e.g. DUO → PRI) — but <b>never below PRI</b>: you never drop back to +15.</p>
      <p>No hidden failstack: what you see is the real chance. Each piece has its own independent level.</p>
      <p><b>Ancient Spirit Dust</b> isn't used to enhance directly: it's a component to craft Caphras Stones.</p>
      <p>The <b>Cron Stone</b> (1% drop rate, 1 to 3 units, every zone) protects against a downgrade on failure — you decide whether to use it via the checkbox next to the loaded material, it's no longer consumed automatically. Its cost depends on the protected piece's tier: 1 (grey), 2 (white), 3 (green), 4 (blue).</p>
      <p>Tip: click the small 🔧 on an equipped piece to load THAT piece directly into the enhancement panel.</p>` },
  { id:'market', icon:'🏛️', label:{fr:'Marché',en:'Market'},
    fr:`<h3>🚧 BETA — en construction</h3>
      <p>Le Marché est encore <b>peu fonctionnel</b> : attends-toi à des bugs, des changements et des remises à zéro pendant son développement. Ne t'y fie pas encore pour ta progression.</p>
      <h3>Marché commun</h3>
      <p>Vrai carnet d'ordres : place un ordre d'achat ou de vente à ton prix, apparié automatiquement avec un ordre en face dès que les prix se croisent (pas de prix fixe imposé).</p>
      <p><b>Taxe de vente : 35%</b> — prélevée uniquement sur le vendeur, qui touche 65% du prix de vente ; l'acheteur paie toujours le prix affiché.</p>`,
    en:`<h3>🚧 BETA — under construction</h3>
      <p>The Market is still <b>not very functional</b>: expect bugs, changes and resets while it's being developed. Don't rely on it for your progress yet.</p>
      <h3>Common market</h3>
      <p>A real order book: place a buy or sell order at your own price, automatically matched with an opposing order once prices cross (no fixed price imposed).</p>
      <p><b>Sales tax: 35%</b> — charged only to the seller, who receives 65% of the sale price; the buyer always pays the listed price.</p>` },
  { id:'account', icon:'💾', label:{fr:'Compte & Sauvegarde',en:'Account & Save'},
    fr:`<h3>Sauvegarde</h3>
      <p>Sauvegarde cloud automatique toutes les 30 s, plus une sauvegarde locale de secours. En cas de déconnexion brutale, jusqu'à 30 s de progression peuvent être perdues.</p>
      <h3>Loyalties & Courrier</h3>
      <p>Tu reçois 200 Loyalties par jour dans ton 📬 Courrier — elles s'y empilent en permanence et ne se perdent jamais.</p>`,
    en:`<h3>Save system</h3>
      <p>Automatic cloud save every 30 s, plus a local backup. On an abrupt disconnect, up to 30 s of progress may be lost.</p>
      <h3>Loyalties & Mailbox</h3>
      <p>You get 200 Loyalties per day in your 📬 Mailbox — they stack there permanently and never get lost.</p>` },
  { id:'about', icon:'ℹ️', label:{fr:'À propos',en:'About'},
    // section relue et remise à jour le 2026-07-08 (demande explicite : "wiki = a propos a relire
    // et modifier selon ce qu'on fait") -- l'ancienne version ne contenait que la mention légale/
    // crédits, sans jamais décrire ce qu'est devenu le jeu depuis (marché, loyalty, boss Vell,
    // Trésor de Velia, Compendium...). À maintenir à jour au même titre que les autres sections
    // Wiki à chaque fonctionnalité majeure (voir mémoire "Mettre à jour Wiki/Succès/Compendium").
    fr:`<h3>Le jeu en un coup d'œil</h3>
      <p>Velia Idle est un jeu idle de farm automatique : ton personnage combat, loote et progresse seul dans des zones classées par palier de stuff (Naru/gris → Tuvala/blanc → Yuria/vert → Grunil/bleu), avec enchantement (+1 à PEN), un Compendium de collection à vie, 2 World Bosses partagés (Kzarka quotidien, Vell hebdomadaire), un Marché commun entre joueurs (taxe de vente 35%), un système de Loyalty (200/jour), un Trésor de Velia à assembler, une sauvegarde cloud, un classement et un chat — le tout géré par un backend Supabase.</p>
      <h3>Noms & identité visuelle</h3>
      <p>Les noms de zones, monstres et objets sont inspirés de Black Desert Online pour l'ambiance, tout comme certains styles de jeu et mécaniques — ils restent, le cas échéant, la propriété de Pearl Abyss. Les icônes et visuels, eux, sont des créations originales de style fan : ils s'inspirent visuellement du jeu mais ne réutilisent aucun asset réel.</p>
      <p>Black Desert ainsi que toutes les images, illustrations, icônes, noms et données du jeu sont la propriété de Pearl Abyss. Projet de fan non officiel et gratuit, sans aucune affiliation ni partenariat avec Pearl Abyss.</p>`,
    en:`<h3>The game at a glance</h3>
      <p>Velia Idle is an automatic idle-farming game: your character fights, loots and progresses on its own through zones ranked by gear tier (Naru/grey → Tuvala/white → Yuria/green → Grunil/blue), with enhancement (+1 to PEN), a lifetime-collection Compendium, 2 shared World Bosses (daily Kzarka, weekly Vell), a player-to-player Common Market (35% sales tax), a Loyalty system (200/day), an assemblable Velia Treasure, cloud saves, a leaderboard and chat — all backed by Supabase.</p>
      <h3>Names & visual identity</h3>
      <p>Zone, monster and item names are inspired by Black Desert Online for atmosphere, as are some game styles and mechanics — these remain, where applicable, the property of Pearl Abyss. Icons and visuals, on the other hand, are original fan-style creations: visually inspired by the game but reusing no real assets.</p>
      <p>Black Desert, along with all in-game images, illustrations, icons, names and data, is the property of Pearl Abyss. Unofficial, free fan project, with no affiliation or partnership with Pearl Abyss.</p>` },
  { id:'tuto', icon:'🔰', label:{fr:'Tutoriel',en:'Tutorial'}, tuto:true },
];
// génère le codex des objets à partir des données du jeu (matériaux, bijoux, trash, sets)
/** @returns {string} HTML du Codex des objets, généré depuis les vraies données du jeu (bijoux par zone, matériaux, composants de craft, trash, Trésor de Velia) — jamais de contenu figé. */
function renderCodexHtml() {
  const seen = new Set();
  const section = (title, items) => {
    if (!items.length) return '';
    return `<h3>${title}</h3>` + items.map(it =>
      `<div class="codexRow"><div class="codexIcon">${it.icon}</div>` +
      `<div class="codexInfo"><div class="codexName">${it.name}</div>` +
      `<div class="codexDesc">${it.desc}</div></div></div>`).join('');
  };
  // bijoux rares (jackpot) — icône selon le palier de stuff de la zone (voir jewelGemCluster)
  const jewels = ZONES.map((z,i) => {
    const t = gearTierForZone(i), slot = accSlotFor(z.loot.jackpot), tIdx = JEWEL_TIER_IDX[t.grade] ?? 0;
    const iconFn = { ring:ringIconForTier, necklace:necklaceIconForTier, earring:earringIconForTier, belt:beltIconForTier }[slot] || ringIconForTier;
    return { icon: iconFn(tIdx, t.color), name:tr(z.loot.jackpot.name),
      desc:`+${z.loot.jackpot.ap} PA · ${i18next.t('backend:backend.codex.zone_word')} ${i+1} (${tr(z.name)})` };
  });
  // matériaux d'optimisation
  const matSet = new Map();
  ZONES.forEach(z => { const m = z.loot.mat; if (!matSet.has(m.name)) matSet.set(m.name, m); });
  const MAT_ICON_BY_NAME = { 'Pierre de Novice':ICO_MAT_NOVICE, 'Pierre du Temps':ICO_MAT_TEMPS,
    'Pierre Noire':ICO_MAT_NOIRE, 'Pierre noire':ICO_MAT_NOIRE, 'Pierre concentrée':ICO_MAT_CONCENTREE,
    'Pierre de Caphras':ICO_MAT_CAPHRAS };
  const mats = [...matSet.values()].map(m => ({ icon:MAT_ICON_BY_NAME[m.name]||ICO_MAT_NOVICE, name:tr(m.name), desc:i18next.t('backend:backend.codex.material_desc') }));
  // composants de craft
  const craftSet = new Map();
  ZONES.forEach(z => { const c = z.loot.craft; if (!craftSet.has(c.name)) craftSet.set(c.name, c); });
  const crafts = [...craftSet.values()].map(c => ({ icon:'✦', name:tr(c.name), desc:i18next.t('backend:backend.codex.craft_component_desc') }));
  // butin de base (trash → silver)
  const trash = ZONES.map((z,i) => ({ icon:'▬', name:tr(z.loot.trash.name), desc:`${fmt(z.loot.trash.val)} silver · ${tr(z.mob)}` }));
  // Trésor de Velia (2026-07-13, sorti du statut expérimental "TEST", demande explicite)
  const treasures = VELIA_TREASURE.map(t =>
    ({ icon:t.icon, name:tr(t.name), desc:`${i18next.t('backend:backend.codex.all_zones')} · ${fmtTinyPct(t.ch)}` }));
  return `<div class="admSummary">${i18next.t('backend:backend.codex.summary')}</div>` +
    section(i18next.t('backend:backend.codex.section_jewelry'), jewels) +
    section(i18next.t('backend:backend.codex.section_materials'), mats) +
    section(i18next.t('backend:backend.codex.section_crafts'), crafts) +
    section(i18next.t('backend:backend.codex.section_treasure'), treasures) +
    section(i18next.t('backend:backend.codex.section_base_loot'), trash);
}
// page Wiki "Tutoriel" : résumé + bouton pour relancer le tutoriel d'arrivée à Velia à tout moment
/** @returns {string} HTML de la page Wiki "Tutoriel" (résumé + bouton pour relancer le tutoriel d'arrivée). */
function renderTutoPageHtml() {
  return `<div class="admSummary">${i18next.t('backend:backend.tuto_page.intro')}</div>
    <button id="btnStartTutoWiki" style="width:auto;margin-top:10px;padding:8px 18px;">${i18next.t('backend:backend.tuto_page.replay_button')}</button>`;
}
// renderWikiHtml()/wikiSection (rendu à onglets plats) retirés le 2026-07-11 : le panneau Wiki
// est désormais src/backend/wiki-panel.js (openWikiPanel()) — WIKI_SECTIONS/renderCodexHtml/
// renderTutoPageHtml restent ici, réutilisés tels quels par le nouveau panneau.

// ============================================================
// Ouverture des modals Wiki / Patch Notes
// ============================================================
/** @param {string} title @param {string} bodyHtml @param {{isNotifCenter?:boolean}} [opts] - isNotifCenter:true UNIQUEMENT pour openNotifCenter() (progression/notifications-quests.js), pour que closeInfoOverlay() sache s'il doit stamper S.notifLastSeenTs à la fermeture. Ouvre le panneau info générique (partagé Wiki/Compendium/Succès/Patch notes/Notifications), masque la pastille de patch notes non lues. */
function openInfo(title, bodyHtml, opts) {
  questsPanelOpen = false; // tout ouverture de panneau réinitialise le flag ; openDailyQuests le remet
  // notifCenterOpen (progression/notifications-quests.js) : ne reste vrai que si CE openInfo() est
  // bien un (re)rendu du centre de notifications lui-même -- les re-rendus internes du panneau
  // (recherche/filtre/suppression, voir refreshNotifPanel) passent aussi par ici avec le même flag.
  if (typeof notifCenterOpen !== 'undefined') notifCenterOpen = !!(opts && opts.isNotifCenter);
  $a('infoTitle').textContent = title;
  $a('infoBody').innerHTML = bodyHtml;
  $a('infoOverlay').classList.add('open');
  // masque immédiatement la pastille "notes de version non lues" du haut de page tant qu'un
  // panneau est ouvert (2026-07-06, demande explicite, capture à l'appui : elle chevauchait le
  // panneau lui-même) -- ne pas attendre le prochain tick de hud() (jusqu'à 1s de délai visible)
  if (typeof updatePatchBadge === 'function') updatePatchBadge();
}
// fermeture RÉELLE du panneau générique (bouton ✕ ou clic sur le fond noir) -- centralisée ici
// (au lieu des 3 duplications précédentes) pour que le centre de notifications puisse stamper
// S.notifLastSeenTs = Date.now() SEULEMENT à ce moment précis, jamais à un simple re-rendu interne
// (voir leaveNotifCenterIfOpen(), progression/notifications-quests.js) -- demande explicite du
// 2026-07-2x : le badge/les points "nouveau" doivent rester visibles PENDANT la consultation.
function closeInfoOverlay() {
  questsPanelOpen = false;
  $a('infoOverlay').classList.remove('open');
  updatePatchBadge();
  if (typeof leaveNotifCenterIfOpen === 'function') leaveNotifCenterIfOpen();
}
$a('closeInfo').onclick = closeInfoOverlay;
// ferme seulement si le clic ET l'appui initial (mousedown) sont bien sur le fond noir —
// sinon, sélectionner du texte dans un champ (ex: le pseudo) et relâcher la souris un peu
// hors du champ pouvait faire remonter le clic jusqu'au fond et fermer tout le panneau
let infoMouseDownOnBackdrop = false;
$a('infoOverlay').addEventListener('mousedown', e => { infoMouseDownOnBackdrop = (e.target.id === 'infoOverlay'); });
$a('infoOverlay').addEventListener('click', e => { if (e.target.id === 'infoOverlay' && infoMouseDownOnBackdrop) closeInfoOverlay(); });

// Codex des objets (2026-07-05, demande explicite) : sorti du Wiki pour sa propre section,
// plus visible, directement accessible depuis le menu de gauche
$a('btnCodex').onclick = () => {
  const callout = contentChangeCalloutHtml('codex');
  openInfo(i18next.t('backend:backend.codex.panel_title'), callout + renderCodexHtml());
  markContentSeen('codex');
};
// 2026-07-11 : remplace l'ancienne modale à onglets plats (openInfo()/renderWikiHtml()) par le
// panneau plein écran src/backend/wiki-panel.js (openWikiPanel(), sidebar/article/infobox, port
// à l'identique du mockup fourni — voir CLAUDE.md §30). renderWikiHtml()/WIKI_SECTIONS restent la
// source de contenu réutilisée par le nouveau panneau, jamais dupliquées.
$a('btnWiki').onclick = () => openWikiPanel();

// Page "Confiance & Sécurité" (2026-07-16, suite audit sécurité) : transparence sur les données
// collectées, la protection, et la carte HONNÊTE de ce qui est validé serveur vs client (le jeu
// est un site statique, la progression solo est calculée côté client -> falsifiable). Contenu
// bilingue via LANG (bloc entier FR ou EN), même esprit que rcT() dans reconnect-modal-react.js.
const REPO_URL = 'https://github.com/Maxyull/black-desert-idle';
function renderTrustSecurityHtml() {
  const fr = LANG !== 'en';
  const li = (a, b) => `<li>${fr ? a : b}</li>`;
  const h = (a, b) => `<h3 style="color:var(--gold);margin:14px 0 6px">${fr ? a : b}</h3>`;
  return `<div class="trustPanel" style="text-align:left;line-height:1.55;font-size:13px">` +
    `<p>${fr
      ? "Ce jeu est <b>open source</b> : tout le code est public et vérifiable. Voici, en clair, ce qu'on collecte, comment on protège tes données, et ce qui est réellement contrôlé côté serveur."
      : "This game is <b>open source</b>: all the code is public and auditable. Here's, in plain terms, what we collect, how we protect your data, and what is actually verified server-side."}</p>` +

    h("🗂️ Tes données", "🗂️ Your data") +
    `<ul style="margin:0;padding-left:18px">` +
    li("<b>Email</b> — connexion uniquement. Jamais montré aux autres, jamais renvoyé au navigateur.",
       "<b>Email</b> — for login only. Never shown to others, never sent back to the browser.") +
    li("<b>Pseudo</b> — public (chat, classement, marché).",
       "<b>Username</b> — public (chat, leaderboard, market).") +
    li("<b>Sauvegarde</b> — ta progression, synchronisée dans le cloud.",
       "<b>Save</b> — your progress, synced to the cloud.") +
    li("<b>Logs d'erreur</b> — techniques, pour corriger les bugs. Pas d'IP stockée.",
       "<b>Error logs</b> — technical, to fix bugs. No IP stored.") +
    `</ul>` +
    `<p style="font-size:12px;color:var(--ink-dim)">${fr
      ? "Pas de pub, pas de revente, pas de traqueur tiers. Détails complets : "
      : "No ads, no reselling, no third-party trackers. Full details: "}` +
      `<a href="${REPO_URL}/blob/main/PRIVACY.md" target="_blank" rel="noopener noreferrer">PRIVACY.md</a>.</p>` +

    h("🔒 Comment on protège", "🔒 How we protect it") +
    `<ul style="margin:0;padding-left:18px">` +
    li("Autorisation vérifiée <b>côté serveur</b> (RLS + fonctions gardées).",
       "Authorization verified <b>server-side</b> (RLS + guarded functions).") +
    li("Aucun secret dans le code client (seule la clé publique l'est).",
       "No secret in the client code (only the public key is exposed).") +
    li("Contenu des joueurs échappé avant affichage (anti-XSS).",
       "Player content escaped before display (anti-XSS).") +
    li("Scans automatiques (CodeQL, gitleaks) + HTTPS forcé.",
       "Automated scans (CodeQL, gitleaks) + enforced HTTPS.") +
    `</ul>` +

    h("⚖️ Validé serveur vs à l'honneur", "⚖️ Server-verified vs trust-based") +
    `<p style="font-size:12px">${fr
      ? "Par honnêteté : le jeu tourne dans ton navigateur, donc certaines valeurs sont calculées côté client et <b>ne peuvent pas être garanties anti-triche</b>."
      : "For honesty: the game runs in your browser, so some values are computed client-side and <b>cannot be guaranteed cheat-proof</b>."}</p>` +
    `<ul style="margin:0;padding-left:18px">` +
    li("✅ <b>Vérifié serveur</b> : connexion, sanctions, marché (transactions atomiques), échanges de compagnons, modération.",
       "✅ <b>Server-verified</b>: login, bans, market (atomic transactions), companion trades, moderation.") +
    li("⚠️ <b>À l'honneur (client)</b> : progression solo (or, XP, loot) et donc les classements. Un joueur déterminé peut forger des valeurs — le classement est <b>informel</b>.",
       "⚠️ <b>Trust-based (client)</b>: solo progression (silver, XP, loot) and therefore leaderboards. A determined player can forge values — the leaderboard is <b>informal</b>.") +
    `</ul>` +

    h("🔎 Auditer / Signaler", "🔎 Audit / Report") +
    `<p style="font-size:12px">` +
    `<a href="${REPO_URL}" target="_blank" rel="noopener noreferrer">${fr ? "Lis le code" : "Read the code"}</a> · ` +
    `<a href="${REPO_URL}/blob/main/SECURITY.md" target="_blank" rel="noopener noreferrer">SECURITY.md</a> · ` +
    `<a href="https://discord.gg/fEubtqMjtP" target="_blank" rel="noopener noreferrer">Discord</a>` +
    `</p>` +
  `</div>`;
}
$a('btnTrust').onclick = () => openInfo(LANG !== 'en' ? '🛡️ Confiance & Sécurité' : '🛡️ Trust & Security', renderTrustSecurityHtml());
