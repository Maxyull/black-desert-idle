// ==================== MINI BOSS (parchemin communautaire) — DONNÉES ====================
// Nouvelle activité (2026-07-13, port du plan validé via ~29 itérations de maquette, voir
// C:\Users\maxim\.claude\plans\on-va-ajouter-une-vivid-pizza.md et le mockup HTML associé) :
// un boss plus faible que Kzarka/Vell, invoqué en consommant un Parchemin crafté (5 Livres
// interdits, drop universel 0,80% comme la Pierre de Cron), combattu seul ou en groupe (≤5).
// Les PV du boss scalent avec la taille du groupe (MINIBOSS_HP_BY_SIZE) mais les dégâts de
// chaque joueur restent proportionnels à son AP effective (playerBossDps(), boss.js) — un
// participant moins équipé ralentit réellement le groupe, affiché via son "gear%" (voir
// minibossGearPct). Partage du loot : invocateur ×2.0, participant ×0.8, multiplié par un bonus
// de groupe EXACT (table fournie par l'utilisateur, pas une formule linéaire).
//
// Constantes PURES uniquement dans ce fichier (aucun accès DOM/Supabase) — DOIT charger APRÈS
// combat/boss-render.js (voir index.dev.html) : miniboss.js/miniboss-render.js en dépendent au
// chargement immédiat via leurs propres littéraux top-level (aucun ici ne lit ZONES/BOSS_ROSTER
// immédiatement, seulement à l'intérieur des fonctions — voir CLAUDE.md §7-8).

// Livre interdit : drop universel (0,80%, TOUTES zones), même mécanisme que CRON_STONE
// (src/inventory/gear-icons.js) — voir le tableau `table` de rollDrops() (combat/loot-rolls.js).
// kind:'material' (comme CRON_STONE, PAS 'craft') : condition pour être vendable au marché — voir
// MARKET_MATERIALS (src/market/market.js), qui ne liste QUE des matériaux (marketCatalog()) — et
// pour que invQtyByKey/invSlotByKey (src/market/market.js) le retrouvent dans INV comme n'importe
// quel autre matériau. Contrairement au Parchemin, jamais échangeable (voir MINIBOSS_PARCHEMIN).
const MINIBOSS_FORBIDDEN_BOOK = { name:'Livre interdit', kind:'material', icon:'📕', color:'#6a4a8a', key:'mat_livre_interdit', ch:0.008 };
// Parchemin de Mini Boss : objet craft, jamais vendable/échangeable (aucune entrée MARKET_MATERIALS
// ni MARKET catalog pour ce kind+name — voir marketCatalog(), src/market/market.js).
const MINIBOSS_PARCHEMIN = { name:'Parchemin de Mini Boss', kind:'craft', icon:'📜', color:'#9b7fd6', key:'craft_Parchemin de Mini Boss' };
// craft à Velia : 5 Livres interdits → 1 Parchemin (voir craftMiniBossParchemin, miniboss.js) —
// fonction DÉDIÉE, ne réutilise PAS craftTreasurePiece()/TREASURE_PIECE_RECIPES
// (progression/treasure-craft.js, pattern différent : kind/icône/couleur/val codés en dur pour
// le Trésor de Velia, rien de tout ça ne convient à un Parchemin).
const MINIBOSS_PARCHEMIN_RECIPE = { needKey:MINIBOSS_FORBIDDEN_BOOK.key, needQty:5, giveName:MINIBOSS_PARCHEMIN.name, giveKey:MINIBOSS_PARCHEMIN.key };

// taille de groupe maximale (invocateur + 4 participants)
const MINIBOSS_MAX_GROUP_SIZE = 5;

// multiplicateurs de rôle (retour de revue de maquette, CLAUDE.md §33bis/plan : "moins de loot
// pour participants" — resserré de ×1.2 à ×0.8 pour bien marquer l'écart avec l'invocateur ×2.0)
const MINIBOSS_SUMMONER_MULT = 2.0;
const MINIBOSS_JOINER_MULT = 0.8;
// bonus de groupe — table EXACTE fournie par l'utilisateur (remplace toute formule linéaire),
// indexée par participantCount (index 0 inutilisé, comme BOSS_DEATH_PENALTY dans boss.js) :
// 1 joueur = ×1 (aucun bonus), 2 = ×1.1, 3 = ×1.2, 4 = ×1.5, 5 = ×2 — saut volontairement plus
// fort à 4-5 pour inciter à remplir le groupe au maximum.
const MINIBOSS_GROUP_BONUS = [1, 1, 1.1, 1.2, 1.5, 2];
/** @param {number} participantCount - taille du groupe (1..5). @returns {number} multiplicateur de bonus de groupe (table MINIBOSS_GROUP_BONUS, plafonné à 5). */
function minibossGroupBonusMult(participantCount) {
  const n = Math.max(1, Math.min(MINIBOSS_MAX_GROUP_SIZE, Math.round(participantCount) || 1));
  return MINIBOSS_GROUP_BONUS[n] || 1;
}
/**
 * Multiplicateur final de récompense pour un participant du combat.
 * @param {boolean} isSummoner - vrai si ce joueur est l'invocateur (a consommé son propre Parchemin pour lancer CE combat).
 * @param {number} participantCount - taille du groupe (1..5).
 * @returns {number} (rôle × bonus de groupe) — invocateur ×2.0, participant ×0.8, multiplié par MINIBOSS_GROUP_BONUS[participantCount].
 */
function minibossFinalMult(isSummoner, participantCount) {
  return (isSummoner ? MINIBOSS_SUMMONER_MULT : MINIBOSS_JOINER_MULT) * minibossGroupBonusMult(participantCount);
}

// PV du boss par taille de groupe (index 0 inutilisé) — croissants avec le nombre de joueurs
// ("a 5 le boss a plus de vie qu'a 1 mais vu qu'on est plus on le tombe plus vite", le DPS cumulé
// du groupe compense la hausse de PV automatiquement via la boucle rAF, voir miniBossLoop).
const MINIBOSS_HP_BY_SIZE = [0, 100000, 160000, 220000, 280000, 340000];
/** @param {number} participantCount - taille du groupe (1..5). @returns {number} PV max du boss pour ce groupe (table MINIBOSS_HP_BY_SIZE, plafonné à 5). */
function minibossMaxHp(participantCount) {
  const n = Math.max(1, Math.min(MINIBOSS_MAX_GROUP_SIZE, Math.round(participantCount) || 1));
  return MINIBOSS_HP_BY_SIZE[n] || MINIBOSS_HP_BY_SIZE[1];
}

// paliers fixes de nombre de combats à enchaîner (+ curseur libre + bouton MAX, voir miniboss.js)
const MINIBOSS_RUN_CHIPS = [10, 25, 50, 100];

// fenêtre de vie d'une session (comme BOSS_WINDOW_MS, boss.js) — évite qu'une session solo
// abandonnée reste "active" indéfiniment côté serveur.
const MINIBOSS_SESSION_WINDOW_MS = 10 * 60 * 1000;

// délai de pause après une déconnexion détectée avant annulation complète du run (§ "Règles de
// fin de run" du plan) — implémenté ici comme CONSTANTE PURE ; le minuteur réel vit côté serveur
// (paused_until, voir migration) et n'est pas simulé localement en V1 (voir compromis de scope,
// rapport final de l'agent).
const MINIBOSS_DISCONNECT_PAUSE_MS = 5 * 60 * 1000;

// "gear%" — pourcentage de l'AP effective du joueur (apEff(), core/game-core.js) par rapport à un
// PLAFOND DE RÉFÉRENCE dynamique (le reqAP le plus élevé parmi toutes les ZONES, world/zones-data.js)
// plutôt qu'un chiffre codé en dur — suit automatiquement tout futur ajout de zone endgame, même
// esprit que referenceGearVal() (progression/treasure-craft.js) : préférer une formule dynamique à
// une valeur figée (voir CLAUDE.md, retour "dérive silencieuse" du 2026-07-09).
/** @returns {number} AP de référence (plafond "gear 100%") — le reqAP le plus élevé parmi toutes les zones du jeu. */
function minibossGearRefAp() {
  if (typeof ZONES === 'undefined' || !ZONES.length) return 1;
  return Math.max(1, ...ZONES.map(z => z.reqAP));
}
/** @param {number} apValue - AP effective d'un joueur (apEff()). @returns {number} pourcentage (0-100, arrondi) par rapport au plafond de référence (minibossGearRefAp()). */
function minibossGearPct(apValue) {
  return Math.max(0, Math.min(100, Math.round((Math.max(0, apValue) / minibossGearRefAp()) * 100)));
}

// plafond du nombre de combats d'un run = stock de Parchemins du membre du groupe qui en a le
// MOINS (jamais le mieux fourni) — implémente littéralement "le run est un engagement collectif,
// un joueur pauvre en Parchemins plafonne tout le groupe" (voir bouton MAX, miniboss.js).
/** @param {number[]} parcheminStocks - stock de Parchemins de chaque membre du groupe. @returns {number} plafond de combats (le plus petit stock, 0 si tableau vide). */
function minibossMaxRunLength(parcheminStocks) {
  if (!Array.isArray(parcheminStocks) || !parcheminStocks.length) return 0;
  return Math.max(0, Math.min(...parcheminStocks));
}

// ---- score de réputation (formule "ratio simple", voir plan §"Carte de réputation joueur") ----
// score AFFICHÉ (badge ⭐note/5) = 5 × runsSansIncident / (runsSansIncident + runsAvecIncident).
// La formule PONDÉRÉE par gravité (quitte×3 + déco×1 + vote×0.2) reste une donnée de diagnostic
// interne, PAS affichée telle quelle (voir minibossReputationSeverityScore ci-dessous) — les 2
// formules sont conservées côté données, seule celle-ci sert de score public.
/** @param {number} runsClean - runs terminés sans incident. @param {number} runsIncident - runs terminés avec au moins 1 incident. @returns {number} note sur 5, arrondie à 1 décimale (5 si aucun run joué — pas encore de mauvaise note par défaut). */
function minibossReputationScore(runsClean, runsIncident) {
  const total = Math.max(0, runsClean||0) + Math.max(0, runsIncident||0);
  if (total <= 0) return 5;
  return Math.round((5 * Math.max(0, runsClean||0) / total) * 10) / 10;
}
// formule pondérée par gravité — diagnostic interne uniquement (voir commentaire ci-dessus),
// poids proposition initiale de l'utilisateur (pas encore validés comme définitifs) : quitte
// solo ×3 (le plus grave), déconnexion non résolue ×1 (accidentel), vote collectif ×0.2 (quasi
// neutre) — normalisé par le nombre total de runs auxquels le joueur a pris part.
/** @param {{soloQuits:number, disconnects:number, votes:number, groupsCreated:number, runsJoined:number}} counts. @returns {number} score 0-5 pondéré par gravité (diagnostic interne, jamais affiché tel quel au joueur). */
function minibossReputationSeverityScore(counts) {
  const c = counts || {};
  const penalty = (c.soloQuits||0)*3 + (c.disconnects||0)*1 + (c.votes||0)*0.2;
  const denom = Math.max(1, (c.groupsCreated||0) + (c.runsJoined||0));
  return Math.max(0, Math.min(5, 5 - penalty/denom));
}
