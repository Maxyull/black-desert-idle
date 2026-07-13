# combat/

Tout ce qui concerne le déroulement d'un combat et ses à-côtés : boss, loot, potions, VFX,
comportement de l'IA.

- `boss.js` — World Boss (Kzarka/Vell) : horaires, lobby, combat, récompenses. Depuis le
  2026-07-19 : pity du loot rarissime (`BOSS_PITY_THRESHOLD`, `S.bossPity`), pénalité de
  récompense sur mort (`bossDeathPenaltyMult`), bonus "1ère victoire de la semaine PAR boss"
  (`bossFirstKillOfWeek`, `S.bossLastKillWeek`), near-miss sur la roue de loot rare.
  **2 bugs corrigés le 2026-07-12** (voir commentaires en tête des fonctions concernées) :
  (1) `refreshLiveBoss()` trace désormais ses échecs (`console.warn`, `liveBossFailCount`) et
  relance rapidement au lieu de les avaler silencieusement ; `bossSharedConfirmState()`/
  `computeBossSharedConfirmState()` (état pur `confirmed`/`pending`/`solo-fallback`,
  `BOSS_SHARED_CONFIRM_TIMEOUT_MS`) empêchent le lobby de démarrer un combat solo silencieux quand
  une occurrence est "live" localement sans confirmation serveur — le bouton `bossFightButtonHtml()`
  bloque puis propose un repli solo EXPLICITE plutôt qu'un simple "Combattre" ambigu.
  (2) La victoire d'un combat PARTAGÉ est désormais décidée uniquement par le PV **serveur confirmé**
  (`bossState.serverConfirmedDead`, mis à jour par `applyBossContributeResponse()`), jamais par la
  prédiction locale (`bossState.hp`, décrémentée sans le plafond de 5%/appel que `boss_contribute`
  applique côté SQL) — `bossShouldDeclareVictory()` centralise cette décision dans `bossLoop()`.
- `boss-render.js` — rendu canvas de la salle de boss (piliers, créature). Charge après
  `boss.js` (`bossLoop()` l'appelle).
- `boss-wheel-react.js` (2026-07-19, demande explicite : "je veux une roue react et que tout soit
  aligné") — roue de récompense rare (`BossWheelReact`, `mountBossWheelReact`, `wheelLandingDeg`,
  `wheelSegmentPath`), rendue en SVG via **React** (`React.createElement` pur, aucun JSX/bundler —
  SEULE exception React du projet, voir CLAUDE.md §7). Remplace l'ancienne roue CSS
  conic-gradient/`.bwIcon` (icônes en `translate(0,-70px)` débordant du cercle, cause du rendu
  "tordu" signalé) par une géométrie calculée (`wheelPolarToCartesian`). React/ReactDOM chargés en
  UMD depuis un CDN figé par SRI (`index.dev.html`), même convention que le CDN Supabase. Charge
  après `boss.js` (lit `BOSS_NEAR_MISS_CHANCE`/`BOSS_NEAR_MISS_MARGIN_DEG` au moment de l'appel,
  jamais au chargement — l'ordre n'est donc pas strictement requis, juste plus lisible ainsi).
- `loot-rolls.js` — tirage du loot à la mort d'un monstre (`rollGearDrop`, `rollWeaponDrop`,
  `rollDrops`) et gain d'XP (`gainXp`). Charge après `core/game-core.js` ET
  `progression/notifications-quests.js` (`gainXp` appelle `pushNotif`).
- `potions-data.js` / `potions-logic.js` — potions de vie : définitions puis usage
  (coût dynamique basé sur le revenu de la zone, déclenchement automatique en combat).
- `ai-mode.js` — les 2 sélecteurs de comportement IA : mode de combat
  (défensif/équilibré/overgeared) et mode de farm (loot/xp). Charge après `core/game-core.js`.
- `vfx.js` — particules visuelles des sorts (météore, glace, éclair...).
- `miniboss-data.js` (2026-07-13) — constantes pures de la feature Mini Boss : recette du craft
  (`MINIBOSS_PARCHEMIN_RECIPE`, 5 Livres interdits → 1 Parchemin), multiplicateurs de rôle
  (`MINIBOSS_SUMMONER_MULT`=2.0/`MINIBOSS_JOINER_MULT`=0.8), table EXACTE du bonus de groupe
  (`MINIBOSS_GROUP_BONUS`=[1,1,1.1,1.2,1.5,2]), PV du boss par taille de groupe
  (`MINIBOSS_HP_BY_SIZE`), gear% (`minibossGearPct`/`minibossGearRefAp`, plafond DYNAMIQUE = le
  `reqAP` le plus élevé parmi `ZONES`, pas un chiffre codé en dur), plafond MAX de run
  (`minibossMaxRunLength`), score de réputation (`minibossReputationScore` = ratio simple affiché,
  `minibossReputationSeverityScore` = formule pondérée, diagnostic interne uniquement). Charge
  après `boss-render.js` (constantes pures, aucune dépendance au chargement immédiat).
- `miniboss.js` (2026-07-13) — logique + wiring de l'onglet Mini Boss : craft
  (`craftMiniBossParchemin`, fonction DÉDIÉE, ne touche pas `progression/treasure-craft.js`),
  lobby (`openMiniBossLobby`/`renderMiniBossLobbyHtml`/`wireMiniBossLobby` — carte Parchemin,
  craft, "État du groupe" avec chips/slider/MAX, chat à 3 onglets Recrutement/Groupes/Mon groupe),
  formation de groupe et chat via **Supabase Realtime Presence/Broadcast** sur un canal unique
  `miniboss_lobby` (aucune table requise pour cette partie), combat (`startMiniBossFight`/
  `miniBossLoop`/`endMiniBossFight`, boucle **rAF uniquement, aucun filet `setInterval`** — même
  garantie "pas de mode hors ligne" que `bossLoop()`), règles de sortie (`minibossSoloLeave`/
  `minibossToggleVoteStop`), demande de rejoindre un groupe en combat (`minibossJoinGroup`/
  `minibossShowJoinRequestPopup`/`minibossCancelFightForNewMember`). **Compromis de scope assumé**
  (voir commentaire en tête de fichier) : tant que la migration Supabase (`supabase/migrations/
  20260722110000_miniboss_sessions.sql`) n'est pas appliquée, les RPC serveur sont appelées de
  façon opportuniste (try/catch) mais le jeu tourne entièrement en simulation locale déterministe
  (PV/DPS/loot calculés côté client depuis le gear% de chaque participant, `minibossEstimatedDps`) —
  jamais bloquant, jamais d'exception non gérée. Charge après `boss.js` (lit `playerBossDps`/
  `_skillDpsSum`/`setFarmViewVisible`/`renderActivityTabs`/`ACTIVITY_TABS`/`currentActivity` au
  moment de l'appel, pas au chargement immédiat) et après `miniboss-data.js`.
- `miniboss-render.js` (2026-07-13) — rendu canvas de la salle Mini Boss (`drawMinibossRoom`),
  miroir simplifié de `boss-render.js` (groupe plafonné à 5, pas de piliers/spots dédiés). Charge
  après `miniboss.js` (`miniBossLoop()` l'appelle).

**Header du jeu (`ACTIVITY_TABS`/`renderActivityTabs()`, dans `boss.js`)** : liste des onglets
d'activité (Zone/Boss/Compagnon/PvP/Pêche/Mine...). Chaque onglet a soit `locked:true` (affiche
`.actTabLock` 🔒, désactivé) soit `isNew:true` (affiche `.actTabNew` "NEW", débloqué) — jamais les
deux, même emplacement bulle à cheval sur le cadre du bas du bouton. `isNew:true` sur `pet`
(Compagnon) depuis le 2026-07-20 (demande explicite : "met NEW sur compagnon a la place du
cadenas") — à retirer manuellement (`isNew:false`) une fois le module hors phase de test, aucune
péremption automatique. **Bug corrigé (2026-07-20, rapporté explicitement : "les cadenas sont
coupé")** : ces badges débordent volontairement sous le bouton (`bottom` négatif) — `#activityTabs`
a `overflow-y:hidden` (nécessaire contre tout retour à la ligne vertical dans la barre à défilement
horizontal) qui les rognait faute de place réservée. `padding-bottom:10px` ajouté sur
`#activityTabs` (`styles.css`) pour laisser la place au débordement sans le couper.
