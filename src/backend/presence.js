// ============================================================
// PRESENCE (joueurs en ligne / zones / Velia / admin) + telemetrie de session
// ============================================================
// Extrait de src/backend/game-supabase.js le 2026-07-22 (2e vague de decoupe, apres P5) : le
// fichier restait a 1751 lignes. Bloc contigu, self-contained : ses setInterval sont a la fin du bloc et ne referencent
// que des fonctions definies juste au-dessus (+ refreshLiveBoss de boss.js, charge avant).
//
// Charge APRES game-supabase.js (il y lit sb/currentUser au runtime, jamais au chargement).
// Contient aussi recordAfkSession/fetchAfkHistory (telemetrie de session AFK), intercalees
// ici dans l'original -- gardees ensemble plutot que de laisser un trou.
// Les 4 seules refs externes (heartbeatPresence/refreshPresenceSnapshot depuis onAuthedInner)
// sont au RUNTIME, verifie avant extraction.

// ---------- présence : compteur "joueurs en ligne" (invités inclus) ----------
// zone_idx = -1 pour Velia (2026-07-16, demande explicite : liste des joueurs en ville) -- avant,
// NULL (aucune zone) ; -1 sert de sentinelle dédiée pour get_velia_players() côté serveur, sans
// jamais entrer en collision avec un vrai index de zone (toujours >= 0).
/** Signale la présence du joueur (RPC heartbeat_presence, zone -1 pour Velia) et vérifie la session en même cadence (20s). */
async function heartbeatPresence() {
  if (!sb || !currentUser) return;
  try { await sb.rpc('heartbeat_presence', { p_is_guest: isGuest(), p_zone_idx: atVelia ? -1 : zoneIdx }); } catch(e) {}
  checkPlayerSession(); // même cadence (20s, voir setInterval(heartbeatPresence,20000) plus bas)
}
// joueurs actuellement en ville (2026-07-16, demande explicite : "on peut voir la liste des
// joueurs dans la ville a droite a la place du loot ticker") -- pseudos VISIBLES pour cette zone
// sociale précisément (confirmé explicitement par l'utilisateur), contrairement au reste du jeu
// (zonePlayerCounts, agrégé seulement). Affiché par updateVeliaPlayersTicker() (game-core.js).
// veliaPlayers est declare dans game-core.js (evite un piege de zone morte temporelle une fois
// le jeu regroupe en un seul fichier -- voir le commentaire juste avant buildZoneList())
/** Recharge la liste des pseudos actuellement à Velia (RPC get_velia_players) et rafraîchit le ticker. No-op si pas à Velia. */
async function refreshVeliaPlayers() {
  if (!sb || !atVelia) return;
  try {
    const { data, error } = await sb.rpc('get_velia_players', { p_window_seconds: 90 });
    if (error || !data) return;
    veliaPlayers = data;
    if (typeof updateVeliaPlayersTicker === 'function') updateVeliaPlayersTicker();
  } catch(e) {}
}
// combien de joueurs sont actuellement dans chaque zone de farm (demande explicite du 2026-07-06)
// -- affiché dans #zoneList (voir buildZoneList dans game-core.js), rafraîchi au même rythme que
// le heartbeat pour rester à jour sans spammer le serveur
// zonePlayerCounts est declare dans game-core.js (evite un piege de zone morte temporelle une
// fois le jeu regroupe en un seul fichier -- voir le commentaire juste avant buildZoneList())
/** Recharge le nombre de joueurs par zone de farm (RPC get_zone_player_counts) et rafraîchit les badges. */
async function refreshZonePlayerCounts() {
  if (!sb) return;
  try {
    const { data, error } = await sb.rpc('get_zone_player_counts', { p_window_seconds: 90 });
    if (error || !data) return;
    zonePlayerCounts = {};
    data.forEach(r => { zonePlayerCounts[r.zone_idx] = r.cnt; });
    if (typeof updateZonePlayerCountBadges === 'function') updateZonePlayerCountBadges();
  } catch(e) {}
}
// étiquette "admin ici" visible par TOUS les joueurs (2026-07-16, demande explicite : "ettiquette
// admin montré a tout le monde") -- avant, purement client-side (isAdmin() + isCurrent, voir
// buildZoneList) : ne pouvait s'afficher QUE sur le propre client de l'admin. get_admin_zone()
// (nouvelle fonction serveur, voir migration 20260716120000) renvoie l'index de zone où se trouve
// le SEUL compte admin (ou null), sans exposer l'identité d'aucun autre joueur -- même rafraîchi
// que zonePlayerCounts, ne reconstruit la liste de zones QUE si la valeur a changé.
// adminZoneIdx est declare dans game-core.js (evite un piege de zone morte temporelle une fois
// le jeu regroupe en un seul fichier -- voir le commentaire juste avant buildZoneList())
/** Recharge la zone où se trouve le compte admin (RPC get_admin_zone, visible par tous), ne reconstruit la liste de zones que si la valeur a changé. */
async function refreshAdminZone() {
  if (!sb) return;
  try {
    const { data, error } = await sb.rpc('get_admin_zone', { p_window_seconds: 90 });
    if (error) return;
    const next = (data === null || data === undefined) ? null : Number(data);
    if (next !== adminZoneIdx) {
      adminZoneIdx = next;
      if (typeof buildZoneList === 'function') buildZoneList();
    }
  } catch(e) {}
}
// ==================== REFRESH DE PRÉSENCE GROUPÉ (audit perf P1, 2026-07-22) ====================
// Les 4 fonctions ci-dessus (online / zones / admin / velia) tournaient chacune sur son propre
// setInterval de 20 s, alors qu'elles lisent TOUTES la même table `presence` avec la même fenêtre
// (90 s) : 4 allers-retours réseau distincts pour une seule et même donnée. Avec N joueurs actifs,
// ça faisait N × 4 requêtes toutes les 20 s -- le premier poste d'egress Supabase du projet.
//
// get_presence_snapshot (migration 20260722240000) fait la lecture UNE fois côté serveur et renvoie
// les 4 morceaux en un JSON. Cette fonction les redispatche vers exactement les mêmes cibles d'UI :
// la logique d'affichage n'est pas réécrite, juste déplacée. Parité vérifiée sur les données de
// prod avant bascule (snapshot == les 4 RPC, champ par champ).
//
// Ce qui reste séparé, et pourquoi :
//   * heartbeatPresence  -> c'est une ÉCRITURE, rien à grouper avec des lectures.
//   * refreshLiveBoss    -> autre table, et sa logique de reprise lui est propre (boss.js) : la
//                           fusionner fragiliserait son retry pour économiser une requête.
//   * refreshVeliaPlayers -> conservée telle quelle : elle est encore appelée à l'ENTRÉE EN VILLE
//                           (game-core.js), un rafraîchissement ciblé immédiat qui n'a rien à voir
//                           avec le tick périodique. Seul son setInterval disparaît.
// Les 4 RPC serveur restent également en place (get_online_counts sert à admin-panel.js).
/** Refresh de présence groupé (audit P1) : un seul RPC get_presence_snapshot au lieu des 4 appels séparés (online/zones/admin/velia), redispatché vers les mêmes cibles d'UI. */
async function refreshPresenceSnapshot() {
  if (!sb) return;
  try {
    const { data, error } = await sb.rpc('get_presence_snapshot', { p_window_seconds: 90 });
    if (error || !data) return;

    // --- online (ex-refreshOnlineCounter) ---
    if (data.online) {
      const { total, guests } = data.online;
      $a('onlineTotal').textContent = total;
      $a('onlineGuests').textContent = guests > 0
        ? ` (${guests} ${i18next.t('backend:backend.presence.guests_suffix')})` : '';
    }

    // --- zones (ex-refreshZonePlayerCounts) ---
    zonePlayerCounts = {};
    (data.zones || []).forEach(r => { zonePlayerCounts[r.zone_idx] = r.cnt; });
    if (typeof updateZonePlayerCountBadges === 'function') updateZonePlayerCountBadges();

    // --- admin_zone (ex-refreshAdminZone) : ne reconstruit la liste QUE si la valeur change ---
    const next = (data.admin_zone === null || data.admin_zone === undefined) ? null : Number(data.admin_zone);
    if (next !== adminZoneIdx) {
      adminZoneIdx = next;
      if (typeof buildZoneList === 'function') buildZoneList();
    }

    // --- velia (ex-refreshVeliaPlayers) : même garde `atVelia` que l'originale ---
    if (atVelia) {
      veliaPlayers = data.velia || [];
      if (typeof updateVeliaPlayersTicker === 'function') updateVeliaPlayersTicker();
    }
  } catch(e) {}
}
// Modal de reconnexion (2026-07-10) : enregistre une session AFK/hors-ligne terminée (fire-and-
// forget, l'affichage du modal ne doit jamais dépendre du succès de cet appel) + lit l'historique
// perso pour l'onglet "Historique des sessions" (voir src/core/reconnect-modal-react.js).
/** @param {object} payload - session AFK terminée (startedAt/endedAt/silver/xp/levelBefore/levelNow/zoneName/gearGrade/items/bestDrop*). Enregistre la session (RPC record_afk_session), fire-and-forget — l'affichage du modal de reconnexion ne dépend jamais de son succès. */
async function recordAfkSession(payload) {
  if (!sb || !currentUser) return;
  try {
    await sb.rpc('record_afk_session', {
      p_started_at: payload.startedAt,
      p_ended_at: payload.endedAt,
      p_silver_gained: payload.silver,
      p_xp_gained: payload.xp,
      p_level_before: payload.levelBefore,
      p_level_after: payload.levelNow,
      p_zone_name: payload.zoneName,
      p_gear_grade: payload.gearGrade,
      p_items: payload.items,
      p_best_drop_name: payload.bestDropName,
      p_best_drop_color: payload.bestDropColor,
    });
  } catch (e) {}
}
/** @returns {Promise<object[]>} historique des 12 dernières sessions AFK (RPC get_afk_history), lève en cas d'erreur. */
async function fetchAfkHistory() {
  if (!sb || !currentUser) return [];
  const { data, error } = await sb.rpc('get_afk_history', { p_limit: 12 });
  if (error) throw error;
  return data || [];
}
/** Recharge et affiche le compteur "joueurs en ligne" (RPC get_online_counts, invités inclus). */
async function refreshOnlineCounter() {
  if (!sb) return;
  try {
    const { data, error } = await sb.rpc('get_online_counts', { p_window_seconds: 90 });
    if (error || !data || !data[0]) return;
    const { total, guests } = data[0];
    $a('onlineTotal').textContent = total;
    $a('onlineGuests').textContent = guests > 0 ? ` (${guests} ${i18next.t('backend:backend.presence.guests_suffix')})` : '';
  } catch(e) {}
}
// nombre total de comptes inscrits (2026-07-05, demande explicite) : change rarement, pas besoin
// de le rafraîchir aussi souvent que le compteur "en ligne"
/** Recharge et affiche le nombre total de comptes inscrits (RPC get_registered_count) — change rarement, rafraîchi moins souvent que le compteur en ligne. */
async function refreshRegisteredCounter() {
  if (!sb) return;
  try {
    const { data, error } = await sb.rpc('get_registered_count');
    if (error || data == null) return;
    $a('registeredTotal').textContent = data;
  } catch(e) {}
}
// Ticks périodiques (audit perf P1, 2026-07-22) : on est passé de 6 à 3 intervalles. Les 4 lectures
// de présence (online/zones/admin/velia) lisaient la même table avec la même fenêtre en 4 requêtes
// distinctes -> un seul get_presence_snapshot les remplace (voir refreshPresenceSnapshot).
setInterval(heartbeatPresence, 20000);        // ÉCRITURE : rien à grouper avec des lectures
setInterval(refreshPresenceSnapshot, 20000);  // P1 : online + zones + admin + velia en 1 RPC
refreshPresenceSnapshot();                    // 1er rendu immédiat (remplace l'ancien refreshAdminZone())
setInterval(refreshLiveBoss, 20000);          // autre table + retry propre (boss.js) : reste séparé
refreshRegisteredCounter();
setInterval(refreshRegisteredCounter, 5 * 60000);
