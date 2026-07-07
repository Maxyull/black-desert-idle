// ---------- réinitialisation de la démo (réservée à l'admin, à tout moment) ----------
async function resetDemo() {
  if (!isAdmin()) return; // double protection : même si le bouton est masqué, la fonction refuse
  const msg = LANG === 'fr'
    ? "Réinitialiser la démo ? Toute ta progression (silver, équipement, niveau, sac) sera perdue et remise à zéro. Cette action est irréversible."
    : "Reset the demo? All your progress (silver, gear, level, bag) will be lost and set back to zero. This action is irreversible.";
  if (!confirm(msg)) return;
  applySaveState(JSON.parse(JSON.stringify(DEFAULT_SAVE)));
  suppressLoyaltyGrantForToday();
  if (sb && currentUser) await saveToCloud(); // écrase aussi la sauvegarde cloud avec l'état neuf
  try { localStorage.setItem('velia-idle-save', JSON.stringify(getSaveState())); } catch(e) {}
  floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Démo réinitialisée' : 'Demo reset', { gold:true });
}

// ---------- reset des quêtes (admin) : juste pour soi, ou pour tout le monde ----------
// "pour soi" ne touche que l'état local + sa propre sauvegarde cloud (aucun risque).
function resetMyQuests() {
  if (!isAdmin()) return;
  S.dq = null; S.wq = null;
  ensureQuests('daily'); ensureQuests('weekly');
  hud();
  if ($a('infoOverlay').classList.contains('open')) openDailyQuests();
  if (sb && currentUser) saveToCloud();
  try { localStorage.setItem('velia-idle-save', JSON.stringify(getSaveState())); } catch(e) {}
  floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Quêtes réinitialisées' : 'Quests reset', { gold:true });
}
// "pour tout le monde" appelle une fonction SECURITY DEFINER côté Supabase qui remet à null
// dq/wq dans TOUTES les sauvegardes cloud — celle-ci vérifie elle-même l'email admin côté
// serveur (voir supabase-quest-reset-schema.sql), le bouton masqué côté client n'étant
// qu'une protection de confort, pas la vraie barrière de sécurité.
async function resetAllQuests() {
  if (!isAdmin() || !sb) return;
  const msg = LANG === 'fr'
    ? "Réinitialiser les quêtes de TOUS les joueurs ? Chacun se verra retirer sa progression de quêtes en cours (journalières et hebdomadaires) et de nouvelles seront tirées à leur prochaine connexion. Action irréversible."
    : "Reset quests for ALL players? Everyone's in-progress quests (daily and weekly) will be cleared and new ones drawn on their next login. This action is irreversible.";
  if (!confirm(msg)) return;
  const { error } = await sb.rpc('admin_reset_all_quests');
  if (!error) logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a réinitialisé les quêtes de tous les joueurs`, 0x9cc9e8);
  if (error) {
    floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Échec — ' + error.message : 'Failed — ' + error.message, { hurt:true });
    return;
  }
  resetMyQuests(); // applique aussi l'effet immédiatement à l'admin lui-même
  floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Quêtes de tous les joueurs réinitialisées ✓' : "All players' quests reset ✓", { gold:true });
}
// remise à zéro COMPLÈTE de TOUS les comptes (silver/équipement/niveau/sac), avec diffusion d'un
// message d'explication livré à chaque joueur (bannière stylée + notification) à sa prochaine
// connexion — demande explicite du 2026-07-06, deux confirmations vu la gravité de l'action
async function resetAllAccounts() {
  if (!isAdmin() || !sb) return;
  const msg1 = LANG === 'fr'
    ? '💥 Réinitialiser TOUS les comptes de TOUS les joueurs (silver, équipement, niveau, sac) ? Un message d\'explication leur sera montré à leur prochaine connexion. Action IRRÉVERSIBLE.'
    : '💥 Reset ALL accounts of ALL players (silver, gear, level, bag)? An explanation message will be shown to them on their next login. This action is IRREVERSIBLE.';
  if (!confirm(msg1)) return;
  const msg2 = LANG === 'fr'
    ? 'Es-tu VRAIMENT sûr ? Il n\'y a aucun moyen de récupérer la progression perdue.'
    : 'Are you REALLY sure? There is no way to recover the lost progress.';
  if (!confirm(msg2)) return;
  const title_fr = '🔄 Remise à zéro de tous les comptes';
  const title_en = '🔄 All accounts have been reset';
  const body_fr = 'Merci beaucoup pour votre aide pendant la phase de test précédente ! 🙏<br><br>' +
    'Suite à un <b>gros changement d\'économie, de stuff et d\'équilibrage</b>, nous avons dû remettre TOUS les comptes à zéro pour repartir sur des tests propres et mieux calibrer le jeu.<br><br>' +
    'Pour info : le jeu est en <b>développement constant</b>, d\'autres resets peuvent survenir à tout moment tant qu\'on est en phase de test.';
  const body_en = 'Thank you so much for your help during the previous testing phase! 🙏<br><br>' +
    'Following a <b>major economy, gear and balance overhaul</b>, we had to reset ALL accounts to zero to start fresh testing and better calibrate the game.<br><br>' +
    'Note: the game is in <b>constant development</b>, more resets may happen at any time while we\'re in testing.';
  const { data, error } = await sb.rpc('admin_reset_all_accounts', { p_title_fr: title_fr, p_title_en: title_en, p_body_fr: body_fr, p_body_en: body_en });
  if (error) {
    floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Échec — ' + error.message : 'Failed — ' + error.message, { hurt:true });
    return;
  }
  logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a réinitialisé TOUS les comptes (${data} comptes)`, 0xc05545);
  floatTxt(P.x, P.y, 100, LANG==='fr' ? `${data} comptes réinitialisés ✓` : `${data} accounts reset ✓`, { gold:true });
  // applique aussi l'effet immédiatement à l'admin lui-même + montre la même bannière que les joueurs
  applySaveState(JSON.parse(JSON.stringify(DEFAULT_SAVE)));
  suppressLoyaltyGrantForToday();
  await saveToCloud();
  showResetNotice('🔄', title_fr, body_fr);
}
// "Screenshot" admin d'un joueur par UUID (demande explicite du 2026-07-06 : "coté admin pouvoir
// voir un screen jeu des joueurs en plus de l'uuid l'inventaire") -- lecture SEULE de sa
// sauvegarde brute (admin_get_player_save), affichée dans le panneau info générique. N'équipe/ne
// modifie jamais rien : c'est un snapshot en texte, pas une vraie capture d'écran de son navigateur
// (impossible côté web), mais montre exactement l'équivalent (équipement + sac + état).
async function adminScreenshotPlayer() {
  if (!isAdmin() || !sb) return;
  const uuid = ($a('admResetUuidInput').value || '').trim();
  if (!uuid) return;
  const { data, error } = await sb.rpc('admin_get_player_save', { p_user_id: uuid });
  if (error) { floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Échec — ' + error.message : 'Failed — ' + error.message, { hurt:true }); return; }
  if (!data) { floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Aucune sauvegarde pour cet UUID' : 'No save found for that UUID', { hurt:true }); return; }
  openInfo((LANG==='fr'?'📸 Screenshot — ':'📸 Screenshot — ') + escapeHtml(data._pseudo||'?'), renderAdminScreenshotHtml(data));
}
function renderAdminScreenshotHtml(save) {
  const s = save.S || {};
  const eq = save.EQUIP || {};
  const inv = (save.INV || []).filter(Boolean);
  const zone = ZONES[save.zoneIdx];
  const zoneName = zone ? tr(zone.name) : (LANG==='fr'?'Velia':'Velia');
  const eqRows = Object.entries(eq).filter(([,v]) => v).map(([slot,it]) => {
    const lvl = it.optimizable ? (ENH_NAMES[it.enhLv||0] || '+0') : '';
    return `<div class="row"><span>${it.icon||'▪'} ${SLOT_LABEL[slot]||slot}</span><span class="v">${escapeHtml(it.name)}${lvl?' ('+lvl+')':''}</span></div>`;
  }).join('') || `<div class="admEmpty">${LANG==='fr'?'Aucun équipement':'No gear'}</div>`;
  const invRows = inv.map(it =>
    `<div class="row"><span>${it.icon||'▪'} ${escapeHtml(it.name)}</span><span class="v">${it.stackable ? 'x'+it.qty : (it.optimizable ? (ENH_NAMES[it.enhLv||0]||'+0') : '')}</span></div>`
  ).join('') || `<div class="admEmpty">${LANG==='fr'?'Sac vide':'Empty bag'}</div>`;
  return `
    <div class="admStatTiles">
      <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'Niveau':'Level'}</div><div class="astVal">${s.lvl||1}</div></div>
      <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'Silver':'Silver'}</div><div class="astVal">${fmt(Math.round(s.silver||0))}</div></div>
      <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'Zone':'Zone'}</div><div class="astVal">${escapeHtml(zoneName)}</div></div>
    </div>
    <div class="admSummary">${LANG==='fr'?'Sauvegardé le':'Saved on'} ${save.savedAt ? new Date(save.savedAt).toLocaleString(LANG==='fr'?'fr-FR':'en-US') : '—'}</div>
    <h3>${LANG==='fr'?'Équipement':'Equipment'}</h3>${eqRows}
    <h3>${LANG==='fr'?'Inventaire':'Inventory'} (${inv.length}/${INV_SIZE})</h3>${invRows}
  `;
}
// remise à zéro CIBLÉE d'UN SEUL joueur par UUID (demande explicite du 2026-07-06 : "ajoute côté
// admin de pouvoir réinitialiser un joueur spécifique par uuid") — même mécanique que
// resetAllAccounts (silver/équipement/niveau/sac effacés + bannière d'explication à la prochaine
// connexion), mais admin_reset_account_by_uuid() ne touche QUE la ligne de CE user_id, et la
// notification n'est insérée que pour lui (pas un broadcast à tout le monde).
async function resetAccountByUuid() {
  if (!isAdmin() || !sb) return;
  const input = $a('admResetUuidInput');
  const uuid = (input.value || '').trim();
  if (!uuid) return;
  const msg = LANG === 'fr'
    ? `🔄 Réinitialiser le compte du joueur ${uuid} (silver, équipement, niveau, sac) ? Un message d'explication lui sera montré à sa prochaine connexion. Action IRRÉVERSIBLE.`
    : `🔄 Reset player ${uuid}'s account (silver, gear, level, bag)? An explanation message will be shown to them on their next login. This action is IRREVERSIBLE.`;
  if (!confirm(msg)) return;
  const title_fr = '🔄 Ton compte a été réinitialisé';
  const title_en = '🔄 Your account has been reset';
  const body_fr = 'Un membre du staff a réinitialisé ton compte (silver, équipement, niveau, sac).<br><br>' +
    'Si tu penses qu\'il s\'agit d\'une erreur, contacte-nous sur Discord.';
  const body_en = 'A staff member has reset your account (silver, gear, level, bag).<br><br>' +
    'If you believe this is a mistake, please reach out to us on Discord.';
  const { data, error } = await sb.rpc('admin_reset_account_by_uuid', {
    p_user_id: uuid, p_title_fr: title_fr, p_title_en: title_en, p_body_fr: body_fr, p_body_en: body_en
  });
  if (error) {
    floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Échec — ' + error.message : 'Failed — ' + error.message, { hurt:true });
    return;
  }
  if (!data) {
    floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Aucun joueur trouvé avec cet UUID' : 'No player found with that UUID', { hurt:true });
    return;
  }
  logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a réinitialisé le compte du joueur \`${uuid}\``, 0xc05545);
  floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Compte réinitialisé ✓' : 'Account reset ✓', { gold:true });
  input.value = '';
}

// ---------- zone admin : stats serveur (réservé au compte admin, via RLS côté base) ----------
// tout tient désormais dans UN SEUL panneau (déclenché par le bouton "🛠️ Admin") : les actions
// (réévaluer marché, resets) en haut, puis les statistiques par catégorie sous forme d'onglets
function fmtAdmPlaytime(sec) {
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60);
  return `${h}h${String(m).padStart(2,'0')}`;
}
// construit le HTML des 3 onglets "lourds" (agrégations sur farm_events/game_saves) une fois que
// leurs données sont arrivées — séparé de openAdminPanel() pour pouvoir les patcher en arrière-plan
// sans bloquer l'ouverture du panneau (voir plus bas, correctif de lenteur du 2026-07-06)
function buildAdminAnalyticsHtml(byHour, byItem, wealth, playtimeByUser, playtimeByHour, nameByUser, silverByCategory, silverByHour) {
  const hourMap = new Map();
  (byHour||[]).forEach(r => hourMap.set(r.hour, (hourMap.get(r.hour)||0) + Number(r.total_silver||0)));
  const hours = [...hourMap.entries()].sort((a,b) => new Date(b[0]) - new Date(a[0])).slice(0,24);
  const maxSilver = Math.max(1, ...hours.map(h => h[1]));
  const hourHtml = hours.map(([h,v]) => {
    const label = new Date(h).toLocaleString(LANG==='fr'?'fr-FR':'en-US', { hour:'2-digit', day:'2-digit', month:'2-digit' });
    const pct = Math.round(v/maxSilver*100);
    return `<div class="admBarRow"><span class="admBarLbl">${label}</span><div class="admBarTrack"><div class="admBar" style="width:${pct}%"></div></div><span class="admBarVal">${fmt(v)}</span></div>`;
  }).join('') || `<div class="admEmpty">${LANG==='fr'?'Pas encore de données':'No data yet'}</div>`;

  const ptRows = (playtimeByHour||[]).map(r => ({ hour:r.hour, players:Number(r.players||0), sec:Number(r.playtime_sec||0) }))
    .sort((a,b) => new Date(b.hour) - new Date(a.hour)).slice(0,24);
  const maxPlayers = Math.max(1, ...ptRows.map(r => r.players));
  const ptHourHtml = ptRows.map(r => {
    const label = new Date(r.hour).toLocaleString(LANG==='fr'?'fr-FR':'en-US', { hour:'2-digit', day:'2-digit', month:'2-digit' });
    const pct = Math.round(r.players/maxPlayers*100);
    return `<div class="admBarRow"><span class="admBarLbl">${label}</span><div class="admBarTrack"><div class="admBar" style="width:${pct}%"></div></div><span class="admBarVal">${r.players} · ${fmtAdmPlaytime(r.sec)}</span></div>`;
  }).join('') || `<div class="admEmpty">${LANG==='fr'?'Pas encore de données':'No data yet'}</div>`;

  const itemHtml = (byItem||[]).map((r,i) => `
    <tr class="${i===0?'admTop':''}">
      <td>${i===0?'🔥 ':''}${tr(r.item_name)}</td><td>${r.item_kind}</td>
      <td>${fmt(r.pickups)}</td><td>${fmt(r.total_qty)}</td><td>${fmt(r.total_silver)}</td>
    </tr>`).join('') || `<tr><td colspan="5" class="admEmpty">${LANG==='fr'?'Pas encore de données':'No data yet'}</td></tr>`;

  const silvers = (wealth||[]).map(r => Number(r.silver||0)).sort((a,b) => a-b);
  const totalSilver = silvers.reduce((a,b) => a+b, 0);
  const avgSilver = silvers.length ? Math.round(totalSilver/silvers.length) : 0;
  const medSilver = silvers.length ? silvers[Math.floor(silvers.length/2)] : 0;
  // "où partent les silver" (demande explicite du 2026-07-07, sur le même principe que l'onglet
  // Loyalties) : silver_earned est un compteur À VIE jamais décrémenté (sauf annulation d'une
  // vente via "Racheter", qui décrémente les deux en même temps) — la SEULE opération qui baisse
  // "silver" sans baisser "silver_earned" est le coût d'optimisation. Donc earned-stocké ≈ dépensé.
  const totalEarned = (wealth||[]).reduce((a,r) => a + Number(r.silver_earned||0), 0);
  const totalSpent = Math.max(0, totalEarned - totalSilver);
  const spentPct = totalEarned > 0 ? Math.round(totalSpent/totalEarned*100) : 0;
  // registre de silver (2026-07-10, demande explicite : "je dois pouvoir traquer le moindre
  // silver") : chaque variation passe par addSilver() (game-core.js) ou est journalisée directement
  // côté serveur pour le marché (voir la migration silver_ledger) -- ce tableau + ce graphique
  // remplacent l'ancien résumé purement textuel "où partent les silver"
  const CATEGORY_LABEL = {
    loot:{fr:'🎒 Butin au sol (trash)',en:'🎒 Ground loot (trash)'},
    sell:{fr:'🏷️ Ventes (sac)',en:'🏷️ Sales (bag)'},
    potion:{fr:'🧪 Potions',en:'🧪 Potions'},
    quest:{fr:'🗒️ Quêtes',en:'🗒️ Quests'},
    achievement:{fr:'🏅 Succès',en:'🏅 Achievements'},
    boss:{fr:'🐋 World Boss',en:'🐋 World Boss'},
    welcome:{fr:'🎁 Bonus de bienvenue',en:'🎁 Welcome bonus'},
    market_buy:{fr:'🏛️ Marché — achats',en:'🏛️ Market — buys'},
    market_sell:{fr:'🏛️ Marché — ventes',en:'🏛️ Market — sells'},
    market_refund:{fr:'🏛️ Marché — remboursements',en:'🏛️ Market — refunds'},
    undo_sell:{fr:'↩️ Annulation de vente',en:'↩️ Sale undo'},
    admin_test:{fr:'🛠️ Test admin',en:'🛠️ Admin test'},
  };
  const catRows = (silverByCategory||[]).map(r => ({
    category: r.category, gained: Number(r.total_gained||0), spent: Number(r.total_spent||0), tx: Number(r.tx_count||0),
  }));
  const maxCatVolume = Math.max(1, ...catRows.map(r => r.gained + r.spent));
  const categoryHtml = catRows.map(r => {
    const label = CATEGORY_LABEL[r.category] ? CATEGORY_LABEL[r.category][LANG] : r.category;
    const pct = Math.round((r.gained + r.spent) / maxCatVolume * 100);
    return `<tr><td>${escapeHtml(label)}</td><td class="admGain">+${fmt(r.gained)}</td><td class="admLoss">-${fmt(r.spent)}</td>` +
      `<td>${fmt(r.tx)}</td><td><div class="admBarTrack"><div class="admBar" style="width:${pct}%"></div></div></td></tr>`;
  }).join('') || `<tr><td colspan="5" class="admEmpty">${LANG==='fr'?'Pas encore de données (le registre vient d\'être mis en place)':'No data yet (the ledger was just set up)'}</td></tr>`;
  const silverHourRows = (silverByHour||[]).map(r => ({ hour:r.hour, net:Number(r.net_delta||0) }))
    .sort((a,b) => new Date(b.hour) - new Date(a.hour)).slice(0,24);
  const maxSilverHourAbs = Math.max(1, ...silverHourRows.map(r => Math.abs(r.net)));
  const silverHourHtml = silverHourRows.map(r => {
    const label = new Date(r.hour).toLocaleString(LANG==='fr'?'fr-FR':'en-US', { hour:'2-digit', day:'2-digit', month:'2-digit' });
    const pct = Math.round(Math.abs(r.net)/maxSilverHourAbs*100);
    return `<div class="admBarRow"><span class="admBarLbl">${label}</span><div class="admBarTrack"><div class="admBar${r.net<0?' admBarNeg':''}" style="width:${pct}%"></div></div><span class="admBarVal${r.net<0?' admLoss':' admGain'}">${r.net>=0?'+':''}${fmt(r.net)}</span></div>`;
  }).join('') || `<div class="admEmpty">${LANG==='fr'?'Pas encore de données':'No data yet'}</div>`;
  const WEALTH_BRACKETS = [
    { max:10000,      label:'< 10k' },
    { max:100000,     label:'10k-100k' },
    { max:1000000,    label:'100k-1M' },
    { max:10000000,   label:'1M-10M' },
    { max:Infinity,   label:'10M+' },
  ];
  const bracketCounts = WEALTH_BRACKETS.map(b => 0);
  for (const v of silvers) {
    const idx = WEALTH_BRACKETS.findIndex(b => v < b.max);
    bracketCounts[idx >= 0 ? idx : WEALTH_BRACKETS.length-1]++;
  }
  const maxBracketCount = Math.max(1, ...bracketCounts);
  const histHtml = WEALTH_BRACKETS.map((b,i) => {
    const pct = Math.max(2, Math.round(bracketCounts[i]/maxBracketCount*100));
    return `<div class="admHistBar"><span class="ahbCount">${bracketCounts[i]}</span><div class="ahbFill" style="height:${pct}%"></div><span class="ahbLbl">${b.label}</span></div>`;
  }).join('');
  const wealthHtml = (wealth||[]).slice(0,20).map((r,i) => `
    <tr><td>#${i+1}</td><td>${escapeHtml((nameByUser&&nameByUser.get(r.user_id)) || (r.user_id||'').slice(0,8)+'…')}</td><td>${fmt(r.silver||0)}</td><td>${r.lvl||1}</td><td>${fmtAdmPlaytime(playtimeByUser.get(r.user_id)||0)}</td></tr>
  `).join('') || `<tr><td colspan="5" class="admEmpty">${LANG==='fr'?'Pas encore de données':'No data yet'}</td></tr>`;
  // "qui a gagné combien en combien de temps" (demande explicite du 2026-07-07) : taux de gain
  // moyen À VIE (silver_earned / temps de jeu total), pour repérer d'un coup d'œil qui monte vite
  // et qui stagne — nécessite au moins 3 min de jeu cumulées pour éviter un taux gonflé par un
  // tout petit échantillon (même précaution que le record kills/min)
  const rateRows = (wealth||[]).map(r => {
    const sec = playtimeByUser.get(r.user_id) || 0;
    const earned = Number(r.silver_earned||0);
    const hrs = sec / 3600;
    return { user_id:r.user_id, earned, sec, rate: hrs > 0.05 ? earned/hrs : 0 };
  }).filter(r => r.sec > 180).sort((a,b) => b.rate - a.rate).slice(0,15);
  const rateHtml = rateRows.map((r,i) => `
    <tr class="${i===0?'admTop':''}"><td>#${i+1}</td><td>${escapeHtml((nameByUser&&nameByUser.get(r.user_id)) || (r.user_id||'').slice(0,8)+'…')}</td>
      <td>${fmt(r.earned)}</td><td>${fmtAdmPlaytime(r.sec)}</td><td>${fmt(Math.round(r.rate))}/h</td></tr>
  `).join('') || `<tr><td colspan="5" class="admEmpty">${LANG==='fr'?'Pas encore de données (au moins 3 min de jeu requises)':'No data yet (at least 3 min playtime required)'}</td></tr>`;

  return {
    hourly: `<h3>${LANG==='fr'?'💰 Silver farmé par heure (48h)':'💰 Silver farmed per hour (48h)'}</h3>
      <div class="admBars">${hourHtml}</div>
      <h3>${LANG==='fr'?'👥 Joueurs actifs par heure (48h)':'👥 Active players per hour (48h)'}</h3>
      <div class="admSummary">${LANG==='fr'?'Nombre de joueurs distincts · temps de jeu cumulé':'Distinct player count · total playtime'}</div>
      <div class="admBars">${ptHourHtml}</div>`,
    items: `<table class="admTable">
        <thead><tr><th>${LANG==='fr'?'Objet':'Item'}</th><th>${LANG==='fr'?'Type':'Kind'}</th><th>${LANG==='fr'?'Ramassages':'Pickups'}</th><th>Qté</th><th>Silver</th></tr></thead>
        <tbody>${itemHtml}</tbody>
      </table>`,
    wealth: `<div class="admStatTiles">
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'💰 Total en jeu':'💰 Total in game'}</div><div class="astVal">${fmt(totalSilver)}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'📊 Moyenne / joueur':'📊 Average / player'}</div><div class="astVal">${fmt(avgSilver)}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'📍 Médiane':'📍 Median'}</div><div class="astVal">${fmt(medSilver)}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'👥 Joueurs':'👥 Players'}</div><div class="astVal">${silvers.length}</div></div>
      </div>
      <h3>${LANG==='fr'?'📈 Répartition des joueurs par richesse':'📈 Players by wealth bracket'}</h3>
      <div class="admHistBars">${histHtml}</div>
      <table class="admTable">
        <thead><tr><th>#</th><th>${LANG==='fr'?'Joueur':'Player'}</th><th>Silver</th><th>Niv.</th><th>${LANG==='fr'?'Temps de jeu':'Playtime'}</th></tr></thead>
        <tbody>${wealthHtml}</tbody>
      </table>`,
    // onglet "Silver" façon Loyalties : voir d'un coup d'œil ce qui est STOCKÉ (chez les joueurs)
    // vs DÉPENSÉ (sorti du jeu) — demande explicite du 2026-07-07
    silver: `<div class="admStatTiles">
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'🏦 Stocké (chez les joueurs)':'🏦 Stored (with players)'}</div><div class="astVal">${fmt(totalSilver)}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'📈 Gagné à vie (tous joueurs)':'📈 Lifetime earned (all players)'}</div><div class="astVal">${fmt(totalEarned)}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'🔻 Dépensé (sorti du jeu)':'🔻 Spent (sunk)'}</div><div class="astVal">${fmt(totalSpent)}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'📊 Moyenne stockée / joueur':'📊 Average stored / player'}</div><div class="astVal">${fmt(avgSilver)}</div></div>
      </div>
      <div class="admHint">${LANG==='fr'
        ? 'Pour ajouter une nouvelle catégorie plus tard : passe-la en 3e argument d\'addSilver(delta, \'ma_categorie\', note) côté client, ET ajoute-la à la contrainte silver_ledger_category_check (migration Supabase, whitelist depuis le 2026-07-14 — voir issue GitHub #4) — sinon l\'insertion échoue silencieusement. Ajoute aussi son libellé dans CATEGORY_LABEL (admin-panel.js) pour un affichage propre ici.'
        : 'To add a new category later: pass it as the 3rd argument of addSilver(delta, \'my_category\', note) client-side, AND add it to the silver_ledger_category_check constraint (Supabase migration, whitelist since 2026-07-14 — see GitHub issue #4) — otherwise the insert silently fails. Also add its label to CATEGORY_LABEL (admin-panel.js) for a clean display here.'}</div>
      <h3>${LANG==='fr'?'🔍 Où partent les silver ? (registre détaillé)':'🔍 Where does the silver go? (detailed ledger)'}
        <button id="btnReloadSilverTab" class="admReloadBtn" title="${LANG==='fr'?'Rafraîchir sans rouvrir le panneau':'Refresh without reopening the panel'}">🔄 ${LANG==='fr'?'Recharger':'Reload'}</button></h3>
      <div class="admHint">${LANG==='fr'
        ? 'Chaque variation de silver (loot, potions, ventes, quêtes, succès, marché...) est journalisée individuellement dans le registre — tableau ci-dessous par catégorie, graphique par heure. Le marché reste un simple TRANSFERT entre joueurs (achat/vente/remboursement), pas un sink net.'
        : 'Every silver change (loot, potions, sales, quests, achievements, market...) is individually logged in the ledger — table below by category, hourly graph. The market remains a plain TRANSFER between players (buy/sell/refund), not a net sink.'}</div>
      <table class="admTable">
        <thead><tr><th>${LANG==='fr'?'Catégorie':'Category'}</th><th>${LANG==='fr'?'Gagné':'Gained'}</th><th>${LANG==='fr'?'Dépensé':'Spent'}</th><th>${LANG==='fr'?'Mouvements':'Transactions'}</th><th>${LANG==='fr'?'Volume':'Volume'}</th></tr></thead>
        <tbody>${categoryHtml}</tbody>
      </table>
      <h3>${LANG==='fr'?'📊 Flux net de silver par heure (48h)':'📊 Net silver flow per hour (48h)'}</h3>
      <div class="admBars">${silverHourHtml}</div>
      <h3>${LANG==='fr'?'🏆 Qui gagne le plus vite ? (taux à vie)':'🏆 Who earns fastest? (lifetime rate)'}</h3>
      <div class="admSummary">${LANG==='fr'?'Silver gagné à vie ÷ temps de jeu total — classé par taux, pas par montant. Au moins 3 min de jeu requises.':'Lifetime silver earned ÷ total playtime — ranked by rate, not by amount. At least 3 min playtime required.'}</div>
      <table class="admTable">
        <thead><tr><th>#</th><th>${LANG==='fr'?'Joueur':'Player'}</th><th>${LANG==='fr'?'Gagné à vie':'Lifetime earned'}</th><th>${LANG==='fr'?'Temps de jeu':'Playtime'}</th><th>${LANG==='fr'?'Taux':'Rate'}</th></tr></thead>
        <tbody>${rateHtml}</tbody>
      </table>`,
  };
}
// table de loot V1/V2 (2026-07-15, demande explicite : "utilise ces valeurs pour le loot des a
// present garde a memoire v1 le loot davant et ça c'est la v2 a tout moment je repasse en v1") --
// S.lootTableVersion pilote gearDropChance/jewelDropChance (game-core.js). Les 2 tables restent
// visibles ici pour comparer, jamais perdues même quand une seule est active.
function buildLootVersionTabHtml() {
  const v = S.lootTableVersion || 'v2';
  const rows = [
    { grade:'grey', label:{fr:'Gris',en:'Grey'} }, { grade:'white', label:{fr:'Blanc',en:'White'} },
    { grade:'green', label:{fr:'Vert',en:'Green'} }, { grade:'blue', label:{fr:'Bleu',en:'Blue'} },
  ];
  const v2Table = `<table class="admTable"><thead><tr><th>${LANG==='fr'?'Palier':'Tier'}</th><th>${LANG==='fr'?'Armure/Arme':'Armor/Weapon'}</th><th>${LANG==='fr'?'Bijou':'Jewel'}</th></tr></thead><tbody>` +
    rows.map(r => `<tr><td>${r.label[LANG]}</td><td>${(LOOT_RATES_V2[r.grade].gear*100).toFixed(2)}%</td><td>${(LOOT_RATES_V2[r.grade].jewel*100).toFixed(3)}%</td></tr>`).join('') +
    `</tbody></table>`;
  return `<div class="admSummary">${LANG==='fr'?'Version active :':'Active version:'} <b>${v.toUpperCase()}</b></div>
    <div class="admActions">
      <button id="btnLootVerV1" class="${v==='v1'?'ready':''}">${LANG==='fr'?'V1 — taux par zone (historique)':'V1 — per-zone rates (legacy)'}</button>
      <button id="btnLootVerV2" class="${v==='v2'?'ready':''}">${LANG==='fr'?'V2 — taux fixe par palier':'V2 — flat per-tier rate'}</button>
    </div>
    <div class="admHint">${LANG==='fr'
      ? 'V1 : chaque zone a son propre taux (décroissant zone après zone, voir GEAR_CHANCE). V2 : un seul taux par palier, appliqué à ses 4 zones. Change instantanément, réversible à tout moment, aucune donnée perdue.'
      : 'V1: each zone has its own rate (decreasing zone after zone, see GEAR_CHANCE). V2: a single rate per tier, applied to its 4 zones. Switches instantly, reversible anytime, no data lost.'}</div>
    <h3>${LANG==='fr'?'📋 Table V2':'📋 V2 table'}</h3>
    ${v2Table}`;
}
async function openAdminPanel() {
  if (!isAdmin() || !sb) return;
  // Le panneau s'ouvre désormais dès que la liste des joueurs (rapide, tables minuscules) est prête,
  // SANS attendre les 3 requêtes d'agrégation les plus lourdes (silver/heure, ressources farmées sur
  // farm_events qui grossit à chaque ramassage, richesses) — avant ce correctif, TOUT devait finir de
  // charger avant que quoi que ce soit ne s'affiche, d'où la lenteur perçue au clic sur "Zone Admin"
  // (2026-07-06). Ces 3 onglets affichent un "Chargement…" et se remplissent dès que prêts.
  const analyticsPromise = Promise.all([
    sb.from('admin_farm_by_hour').select('*'),
    sb.from('admin_farm_by_item').select('*').limit(20),
    sb.from('admin_wealth').select('*'),
    sb.from('admin_playtime_by_hour').select('*'),
    // registre de silver (2026-07-10, demande explicite) : voir la migration silver_ledger
    sb.from('admin_silver_ledger_by_category').select('*'),
    sb.from('admin_silver_ledger_by_hour').select('*'),
  ]);
  const [{data: stats}, {data: playersList}] = await Promise.all([
    sb.from('player_stats').select('user_id, playtime_sec, loyalty'),
    sb.rpc('admin_list_players'),
  ]);
  const playtimeByUser = new Map((stats||[]).map(r => [r.user_id, Number(r.playtime_sec||0)]));
  // pseudo par joueur (déjà renvoyé par admin_list_players), utilisé pour afficher un nom plutôt
  // qu'un UUID tronqué dans les tableaux Richesses/Silver — demande explicite du 2026-07-07
  const nameByUser = new Map((playersList||[]).map(p => [p.user_id, p.display_name||'?']));
  // Loyalties (ex-"points de fidélité", renommé le 2026-07-07) : total en jeu + moyenne par joueur,
  // demande explicite du 2026-07-07 — pas encore de boutique où les dépenser, donc "utilisées pour"
  // reste à 0 pour l'instant (voir onglet dédié plus bas)
  const loyaltyVals = (stats||[]).map(r => Number(r.loyalty||0));
  const loyaltyTotal = loyaltyVals.reduce((a,b) => a+b, 0);
  const loyaltyAvg = loyaltyVals.length ? Math.round(loyaltyTotal/loyaltyVals.length) : 0;

  // liste des joueurs connectés/inscrits (admin uniquement) : pseudo, GS, silver, statut en
  // ligne, et 2 boutons dédiés (UUID / Inventaire) au lieu du clic-sur-la-ligne — demande explicite
  // du 2026-07-06 (plus clair que "cliquer la ligne copie l'UUID, cliquer l'icône ouvre l'inventaire")
  const playersHtml = (playersList||[]).map(p => `
    <tr>
      <td>${p.online ? '🟢' : '⚪'}</td><td>${escapeHtml(p.display_name||'?')}</td>
      <td>${fmt(p.silver||0)}</td><td>${p.gearscore||0}</td>
      <td title="${LANG==='fr'?'PA (Puissance d\'Attaque)':'AP (Attack Power)'}">${(p.ap||0).toFixed(1)}</td>
      <td title="${LANG==='fr'?'PD (Puissance de Défense)':'DP (Defense Power)'}">${(p.dp||0).toFixed(1)}</td>
      <td>${p.lvl||1}</td>
      <td title="${LANG==='fr'?'Record personnel de kills/min (à vie)':'Personal kills/min record (lifetime)'}">🏹 ${(p.best_kpm||0).toFixed(1)}</td>
      <td><button class="admUuidBtn" data-uuid="${p.user_id}">📋 UUID</button></td>
      <td><button class="admInvBtn" data-uuid="${p.user_id}" data-name="${escapeHtml(p.display_name||'?')}" title="${LANG==='fr'?'Ouvre l\'équipement porté et le sac complet (192 cases) de ce joueur, en lecture seule, dans une nouvelle fenêtre':'Opens this player\'s equipped gear and full bag (192 slots), read-only, in a new window'}">🎒 ${LANG==='fr'?'Inventaire':'Inventory'}</button></td>
    </tr>`).join('') || `<tr><td colspan="10" class="admEmpty">${LANG==='fr'?'Pas encore de données':'No data yet'}</td></tr>`;
  const loadingHtml = `<div class="admEmpty">${LANG==='fr'?'Chargement…':'Loading…'}</div>`;
  const cats = [
    { id:'players', icon:'👥', label:{fr:'Joueurs',en:'Players'},
      body: `<div class="admSummary">${LANG==='fr'?`${(playersList||[]).filter(p=>p.online).length} en ligne · ${(playersList||[]).length} inscrits`:`${(playersList||[]).filter(p=>p.online).length} online · ${(playersList||[]).length} registered`}</div>
      <table class="admTable">
        <thead><tr><th></th><th>${LANG==='fr'?'Joueur':'Player'}</th><th>Silver</th><th>GS</th><th title="${LANG==='fr'?'PA':'AP'}">PA</th><th title="${LANG==='fr'?'PD':'DP'}">PD</th><th>Niv.</th><th title="${LANG==='fr'?'Record kills/min':'Kills/min record'}">🏹</th><th></th><th></th></tr></thead>
        <tbody>${playersHtml}</tbody>
      </table>` },
    { id:'hourly', icon:'💰', label:{fr:'Silver & temps de jeu / heure',en:'Silver & playtime / hour'}, body: loadingHtml },
    { id:'silver', icon:'🏦', label:{fr:'Silver',en:'Silver'}, body: loadingHtml },
    { id:'items', icon:'📦', label:{fr:'Ressources farmées',en:'Farmed resources'}, body: loadingHtml },
    { id:'wealth', icon:'👑', label:{fr:'Richesses',en:'Wealth'}, body: loadingHtml },
    { id:'treasure', icon:'🗺️', label:{fr:'Trésor de Velia',en:'Velia Treasure'},
      // nombre moyen de monstres à tuer pour chaque morceau (1/chance) + estimation de temps à un
      // rythme de référence — demande explicite du 2026-07-06, pour évaluer la rareté en pratique
      body: `<div class="admSummary">${LANG==='fr'
        ? `Estimation à ${ADMIN_TREASURE_KPM_REF} kills/min (compare à ton propre "Kills/min" affiché en jeu)`
        : `Estimate at ${ADMIN_TREASURE_KPM_REF} kills/min (compare to your own in-game "Kills/min")`}</div>
      <table class="admTable">
        <thead><tr><th>${LANG==='fr'?'Objet':'Item'}</th><th>${LANG==='fr'?'Chance/kill':'Chance/kill'}</th>
          <th>${LANG==='fr'?'Kills en moyenne':'Avg kills'}</th><th>${LANG==='fr'?'Temps estimé':'Est. time'}</th></tr></thead>
        <tbody>${VELIA_TREASURE.map(t => {
          const avgKills = Math.round(1/t.ch);
          const avgMin = avgKills / ADMIN_TREASURE_KPM_REF;
          return `<tr><td><span style="color:${t.color}">${t.icon}</span> ${tr(t.name)}</td><td>${fmtTinyPct(t.ch)}</td>` +
            `<td>${fmt(avgKills)}</td><td>${fmtDurationMin(avgMin)}</td></tr>`;
        }).join('')}</tbody>
      </table>` },
    { id:'loyalty', icon:'🏅', label:{fr:'Loyalties',en:'Loyalties'},
      // stats de la monnaie "Loyalties" (ex-points de fidélité, renommée le 2026-07-07) : total en
      // jeu, moyenne par joueur, et "utilisées pour" — demande explicite du 2026-07-07
      body: `<div class="admStatTiles">
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'🏅 Total en jeu':'🏅 Total in game'}</div><div class="astVal">${fmt(loyaltyTotal)}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'📊 Moyenne / joueur':'📊 Average / player'}</div><div class="astVal">${fmt(loyaltyAvg)}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'👥 Joueurs':'👥 Players'}</div><div class="astVal">${loyaltyVals.length}</div></div>
      </div>
      <h3>${LANG==='fr'?'🛍️ Utilisées pour':'🛍️ Used to buy'}</h3>
      <div class="admEmpty">${LANG==='fr'
        ? 'Aucune boutique Loyalties en jeu pour l\'instant — rien à dépenser, ces stats servent à suivre l\'accumulation avant d\'ouvrir une boutique.'
        : 'No Loyalties shop in game yet — nothing to spend it on, these stats track accumulation ahead of opening a shop.'}</div>` },
    // bascule V1/V2 de la table de loot (2026-07-15, demande explicite : "utilise ces valeurs pour
    // le loot des a present, garde a memoire v1 le loot davant et ça c'est la v2, a tout moment je
    // repasse en v1") -- S.lootTableVersion pilote gearDropChance/jewelDropChance (game-core.js),
    // réversible en un clic, sans jamais perdre les valeurs V1 (toujours codées en dur à côté)
    { id:'loot', icon:'🎲', label:{fr:'Table de loot',en:'Loot table'}, body: buildLootVersionTabHtml() },
  ];
  const tabsHtml = cats.map((c,i) => `<button class="catTab${i===0?' active':''}" data-cat="${c.id}">${c.icon} ${c.label[LANG]}</button>`).join('');
  const panesHtml = cats.map((c,i) => `<div class="catPane" data-cat="${c.id}"${i===0?'':' style="display:none"'}>${c.body}</div>`).join('');
  // dès que les 3 agrégations lourdes arrivent, on remplace juste le contenu "Chargement…" de leurs
  // onglets — sans jamais avoir bloqué l'affichage initial du panneau ci-dessus
  // mémorise les 4 agrégations qui ne changent pas au reload (voir btnReloadSilverTab) --
  // seules silverByCategory/silverByHour sont re-fetchées, pas besoin de refaire tout le reste
  let cachedAnalytics = null;
  // bouton "🔄 Recharger" de l'onglet Silver (2026-07-11, demande explicite : "met un bouton
  // reload") : avant, il fallait fermer et rouvrir tout le panneau admin pour rafraîchir ces
  // données, alors qu'elles évoluent en temps réel (registre de silver alimenté en continu)
  function wireSilverReloadBtn() {
    const btn = $a('btnReloadSilverTab'); if (!btn) return;
    btn.onclick = async () => {
      if (!cachedAnalytics) return;
      btn.disabled = true; const oldTxt = btn.textContent; btn.textContent = '🔄 …';
      const [{data: silverByCategory}, {data: silverByHour}] = await Promise.all([
        sb.from('admin_silver_ledger_by_category').select('*'),
        sb.from('admin_silver_ledger_by_hour').select('*'),
      ]);
      const html = buildAdminAnalyticsHtml(cachedAnalytics.byHour, cachedAnalytics.byItem, cachedAnalytics.wealth, playtimeByUser, cachedAnalytics.playtimeByHour, nameByUser, silverByCategory, silverByHour);
      const body = $a('infoBody'); if (!body) return; // panneau déjà refermé entre-temps
      const silverPane = body.querySelector('.catPane[data-cat="silver"]');
      if (silverPane) silverPane.innerHTML = html.silver;
      wireSilverReloadBtn(); // le bouton a été recréé dans le HTML injecté, re-brancher dessus
      btn.disabled = false; btn.textContent = oldTxt;
    };
  }
  analyticsPromise.then(([{data: byHour}, {data: byItem}, {data: wealth}, {data: playtimeByHour}, {data: silverByCategory}, {data: silverByHour}]) => {
    cachedAnalytics = { byHour, byItem, wealth, playtimeByHour };
    const html = buildAdminAnalyticsHtml(byHour, byItem, wealth, playtimeByUser, playtimeByHour, nameByUser, silverByCategory, silverByHour);
    const body = $a('infoBody'); if (!body) return; // panneau déjà refermé entre-temps
    const hourlyPane = body.querySelector('.catPane[data-cat="hourly"]');
    const itemsPane = body.querySelector('.catPane[data-cat="items"]');
    const wealthPane = body.querySelector('.catPane[data-cat="wealth"]');
    const silverPane = body.querySelector('.catPane[data-cat="silver"]');
    if (hourlyPane) hourlyPane.innerHTML = html.hourly;
    if (itemsPane) itemsPane.innerHTML = html.items;
    if (wealthPane) wealthPane.innerHTML = html.wealth;
    if (silverPane) silverPane.innerHTML = html.silver;
    wireSilverReloadBtn();
  }).catch(()=>{});
  // sélecteur de World Boss : fait apparaître immédiatement le boss choisi (combat local de test),
  // sans toucher au planning horaire normal — réservé à l'admin
  const bossOptions = Object.keys(BOSS_ROSTER).map(id => `<option value="${id}">${BOSS_ROSTER[id].icon} ${BOSS_ROSTER[id].short[LANG]}</option>`).join('');
  // panneau admin réorganisé en VRAIS onglets de premier niveau (2026-07-10, demande explicite :
  // "refais un systeme de tab pour le menu admin pour moi pour serveur pour joueurs précis stats")
  // -- avant, les 4 sections (Moi/Joueur précis/Serveur/Rôles) étaient toutes empilées et visibles
  // en même temps au-dessus des stats, rendant le panneau très long à parcourir. "Rôles" rejoint
  // l'onglet "Joueur précis" (les deux ciblent un joueur par UUID) ; "Stats" contient tel quel
  // l'ancien sous-système d'onglets (catTabs/panesHtml, inchangé).
  const adminTopTabs = [
    { id:'moi', icon:'👤', label:{fr:'Moi',en:'Me'} },
    { id:'joueur', icon:'🎯', label:{fr:'Joueur précis',en:'Specific player'} },
    { id:'serveur', icon:'🌍', label:{fr:'Serveur',en:'Server'} },
    { id:'stats', icon:'📊', label:{fr:'Stats',en:'Stats'} },
  ];
  const adminTopTabsHtml = adminTopTabs.map((t,i) => `<button class="catTab${i===0?' active':''}" data-top="${t.id}">${t.icon} ${t.label[LANG]}</button>`).join('');
  const actionsHtml = `
    <div class="admRiskLegend">
      <span><i style="background:#5a8fc8"></i>${LANG==='fr'?'Bleu = sans risque, perso':'Blue = safe, personal'}</span>
      <span><i style="background:var(--danger)"></i>${LANG==='fr'?'Rouge = touche TOUS les joueurs':'Red = affects ALL players'}</span>
      <span><i style="background:#7aa35e"></i>${LANG==='fr'?'Vert = gestion (rôles, boutons verrouillés)':'Green = management (roles, locked buttons)'}</span>
    </div>
    <div class="catTabs admTopTabs">${adminTopTabsHtml}</div>
    <div class="admTopPane" data-top="moi">
      <div class="admSection riskSafe">
        <div class="admSectionTitle">👤 ${LANG==='fr'?'Pour moi — test sur mon compte':'For me — test on my account'}</div>
        <div class="admSectionSub">${LANG==='fr'?'Sans danger : ça ne touche que TON propre personnage.':'Safe: only affects YOUR own character.'}</div>
        <div class="admActions">
          <button id="btnTestSilver">💰 +1M silver</button>
          <button id="btnTestLoyalty">📬 +200 Loyalties</button>
          <button id="btnTestAch">🏅 ${LANG==='fr'?'Débloquer tous les succès':'Unlock all achievements'}</button>
          <button id="btnResetMyQuests" data-i18n="btnResetMyQuests">🔄 Réinitialiser mes quêtes</button>
          <button id="btnResetDemo" data-i18n="btnResetDemo">🔄 Réinitialiser la démo</button>
        </div>
        <div class="admBossSpawn">
          <span>${LANG==='fr'?'⚔️ Combattre un World Boss :':'⚔️ Fight a World Boss:'}</span>
          <select id="admBossSelect">${bossOptions}</select>
          <button id="btnAdmSpawnBoss">${LANG==='fr'?'Combattre maintenant':'Fight now'}</button>
        </div>
        <div class="admHint">${LANG==='fr'?'Lance un vrai boss partagé (PV communs) rien que pour toi, pour tester sans attendre le planning ni prévenir personne.':'Spawns a real shared boss (common HP) just for you, to test without waiting for the schedule or notifying anyone.'}</div>
      </div>
    </div>
    <div class="admTopPane" data-top="joueur" style="display:none">
      <div class="admSection riskSingle">
        <div class="admSectionTitle">🎯 ${LANG==='fr'?'Un joueur précis — par UUID':'A specific player — by UUID'}</div>
        <div class="admSectionSub">⚠️ ${LANG==='fr'?'Efface silver/équipement/niveau/sac de CE joueur uniquement.':'Wipes silver/gear/level/bag for THAT player only.'}</div>
        <div class="admActions">
          <input type="text" id="admResetUuidInput" placeholder="${LANG==='fr'?'UUID du joueur':'Player UUID'}" style="width:230px">
          <button id="btnScreenshotPlayer">📸 ${LANG==='fr'?'Screenshot':'Screenshot'}</button>
          <button id="btnResetAccountByUuid" style="border-color:var(--danger);color:#e8a89f">🔄 ${LANG==='fr'?'Réinitialiser ce joueur':'Reset this player'}</button>
        </div>
        <div class="admHint">${LANG==='fr'?'Trouve l\'UUID d\'un joueur via le Classement ou ses messages en jeu (bouton "Copier UUID" dans son propre menu). "Screenshot" affiche son équipement/inventaire en lecture seule (aucune modification). Le reset envoie le même message d\'explication que le reset global, mais montré UNIQUEMENT à ce joueur.':'Find a player\'s UUID via the Leaderboard or their in-game messages (the "Copy UUID" button in their own menu). "Screenshot" shows their gear/inventory read-only (no changes made). The reset sends the same explanation message as the global reset, but shown ONLY to that player.'}</div>
      </div>
      <div class="admSection riskMgmt">
        <div class="admSectionTitle">🎭 ${LANG==='fr'?'Rôles (Modérateur / Testeur)':'Roles (Moderator / Tester)'}</div>
        <div class="admSectionSub">${LANG==='fr'?'🛡️ Modérateur : peut supprimer des messages de chat. 🧪 Testeur : accès en avant-première aux fonctionnalités pas encore publiques. Un joueur peut cumuler les deux.':'🛡️ Moderator: can delete chat messages. 🧪 Tester: early access to not-yet-public features. A player can hold both roles.'}</div>
        <div class="admBossSpawn">
          <input type="text" id="admRoleUuid" placeholder="${LANG==='fr'?'UUID du joueur':'Player UUID'}" style="flex:1;min-width:180px;background:#0d0c11;border:1px solid #333;color:var(--ink);padding:5px 7px;font-family:monospace;font-size:11px;border-radius:3px;">
          <select id="admRoleSelect" style="flex:0 0 auto;width:auto;">
            <option value="mod">🛡️ ${LANG==='fr'?'Modérateur':'Moderator'}</option>
            <option value="tester">🧪 ${LANG==='fr'?'Testeur':'Tester'}</option>
          </select>
          <button id="btnAddRole" style="flex:0 0 auto;width:auto;">${LANG==='fr'?'➕ Ajouter':'➕ Add'}</button>
        </div>
        <div id="admRoleList"><div class="admEmpty">${LANG==='fr'?'Chargement…':'Loading…'}</div></div>
      </div>
    </div>
    <div class="admTopPane" data-top="serveur" style="display:none">
      <div class="admSection riskGlobal">
        <div class="admSectionTitle">🌍 ${LANG==='fr'?'Pour les joueurs — actions serveur':'For players — server-wide'}</div>
        <div class="admSectionSub">⚠️ ${LANG==='fr'?'Danger : ces actions touchent TOUS les joueurs connectés.':'Danger: these actions affect ALL connected players.'}</div>
        <div class="admActions">
          <button id="btnResetAllQuests" data-i18n="btnResetAllQuests">⚠️ Réinitialiser les quêtes de tous</button>
          <button id="btnResetAllAccounts" style="border-color:var(--danger);color:#e8a89f">💥 ${LANG==='fr'?'Réinitialiser TOUS les comptes':'Reset ALL accounts'}</button>
        </div>
        <div class="admHint warn">${LANG==='fr'?'"Réinitialiser TOUS les comptes" efface silver/équipement/niveau/sac de TOUT LE MONDE et affiche un message d\'explication à chaque joueur à sa prochaine connexion. Irréversible.':'"Reset ALL accounts" wipes silver/gear/level/bag for EVERYONE and shows an explanation message to each player on their next login. Irreversible.'}</div>
        <div class="admBossSpawn">
          <span>${LANG==='fr'?'🌍 Lancer un boss pour TOUS :':'🌍 Launch a boss for ALL:'}</span>
          <select id="admGlobalBossSelect">${bossOptions}</select>
          <select id="admBossDurationSelect">
            ${[2,3,4,5,6,7].map(m => `<option value="${m}"${m===4?' selected':''}>${LANG==='fr'?`~${m} min à tuer`:`~${m} min to kill`}</option>`).join('')}
          </select>
          <button id="btnAdmSpawnGlobal">${LANG==='fr'?'Lancer (9 min)':'Launch (9 min)'}</button>
          <button id="btnAdmDespawnBoss">🛑 ${LANG==='fr'?'Faire disparaître':'Despawn'}</button>
        </div>
        <div class="admHint">${LANG==='fr'?'Les PV sont calculés selon le nombre de joueurs en ligne pour viser la durée choisie (la durée réelle dépendra du stuff et du nombre de participants réels). Le boss disparaît de toute façon au bout de 9 minutes.':'HP is calculated from current online players to target the chosen duration (actual time will depend on gear and real participation). The boss despawns after 9 minutes regardless.'}</div>
      </div>
    </div>
`;
  const statsTopPane = `<div class="admTopPane" data-top="stats" style="display:none"><div class="catTabs">${tabsHtml}</div>${panesHtml}</div>`;
  openInfo(LANG==='fr' ? '🛠️ Zone Admin' : '🛠️ Admin Zone', actionsHtml + statsTopPane);
  applyI18n();
  wireCatTabs();
  // bascule V1/V2 de la table de loot (2026-07-15, demande explicite) -- re-render juste cet onglet
  // après le switch, pour refléter tout de suite quelle version est "ready" (surlignée)
  function wireLootVersionButtons() {
    const v1Btn = $a('btnLootVerV1'), v2Btn = $a('btnLootVerV2');
    if (v1Btn) v1Btn.onclick = () => { if(!isAdmin())return; S.lootTableVersion = 'v1'; const pane = $a('infoBody').querySelector('.catPane[data-cat="loot"]'); if (pane) pane.innerHTML = buildLootVersionTabHtml(); wireLootVersionButtons(); floatTxt(P.x,P.y,100,'Loot V1',{blue:true}); };
    if (v2Btn) v2Btn.onclick = () => { if(!isAdmin())return; S.lootTableVersion = 'v2'; const pane = $a('infoBody').querySelector('.catPane[data-cat="loot"]'); if (pane) pane.innerHTML = buildLootVersionTabHtml(); wireLootVersionButtons(); floatTxt(P.x,P.y,100,'Loot V2',{gold:true}); };
  }
  wireLootVersionButtons();
  // onglets de PREMIER niveau (Moi/Joueur précis/Serveur/Stats) — indépendants des catTabs déjà
  // gérés par wireCatTabs() ci-dessus (ceux-là restent pour les sous-onglets DANS "Stats")
  $a('infoBody').querySelectorAll('.admTopTabs .catTab').forEach(btn => {
    btn.onclick = () => {
      const top = btn.dataset.top;
      $a('infoBody').querySelectorAll('.admTopTabs .catTab').forEach(b => b.classList.toggle('active', b === btn));
      $a('infoBody').querySelectorAll('.admTopPane').forEach(p => p.style.display = p.dataset.top === top ? '' : 'none');
    };
  });
  refreshRoleList();
  // bouton dédié "UUID" (onglet Joueurs) : copie l'UUID dans le presse-papiers
  $a('infoBody').querySelectorAll('.admUuidBtn').forEach(btn => {
    btn.onclick = async e => {
      e.stopPropagation();
      try { await navigator.clipboard.writeText(btn.dataset.uuid); } catch(e) {}
      floatTxt(P.x, P.y, 100, LANG==='fr'?'UUID copié ✓':'UUID copied ✓', { gold:true });
    };
  });
  // bouton dédié "Inventaire" : ouvre l'inventaire dans une NOUVELLE FENÊTRE (pas dans le panneau
  // admin lui-même) et revient automatiquement sur le panneau admin quand cette fenêtre se ferme —
  // demande explicite du 2026-07-06
  $a('infoBody').querySelectorAll('.admInvBtn').forEach(btn => {
    btn.onclick = e => { e.stopPropagation(); showPlayerInventoryWindow(btn.dataset.uuid, btn.dataset.name); };
  });
  // --- pour moi ---
  $a('btnTestSilver').onclick = () => { if(!isAdmin())return; addSilver(1000000, 'admin_test'); refreshStatsOnly(); floatTxt(P.x,P.y,100,'+1M 🪙',{gold:true}); };
  $a('btnTestLoyalty').onclick = () => { if(!isAdmin())return; mailboxAdd('loyalty', 'Loyalties', '🏅', 200); updateMailBadge(); floatTxt(P.x,P.y,100,'+200 🏅 (courrier)',{gold:true}); };
  // corrigé le 2026-07-10 (vérification demandée : "verifie si toute les action fonctionne") :
  // ce bouton manipulait S.silver directement au lieu de passer par addSilver() (voir V231, le
  // registre de silver) -- les récompenses de succès débloqués via ce test n'étaient donc jamais
  // journalisées, contrairement à un déblocage normal en jeu (checkAchievements)
  $a('btnTestAch').onclick = () => { if(!isAdmin())return; ACHIEVEMENTS.forEach(a => { if(!S.achUnlocked[a.id]){ S.achUnlocked[a.id]=Date.now(); addSilver(a.reward, 'admin_test', a.name.fr); } }); refreshStatsOnly(); openAdminPanel(); };
  $a('btnResetMyQuests').onclick = resetMyQuests;
  $a('btnResetDemo').onclick = resetDemo;
  // spawn un VRAI boss partagé (PV communs, top10, contribution %, joueurs en direct) — utilisé à la
  // fois par le test perso admin et par le lancement pour tous, pour que le test admin ressemble
  // exactement au vrai boss multijoueurs (demande explicite : "pas un boss solo")
  async function adminSpawnSharedBoss(id, targetMin) {
    if (!sb) return false;
    let onlineTotal = 1;
    try {
      const { data } = await sb.rpc('get_online_counts', { p_window_seconds: 90 });
      if (data && data[0]) onlineTotal = Math.max(1, data[0].total || 1);
    } catch (e) {}
    const expectedFighters = Math.max(1, Math.round(onlineTotal * 0.4));
    const sharedHp = Math.round(BOSS_REF_DPS * expectedFighters * targetMin * 60);
    const { error } = await sb.rpc('admin_spawn_boss', { p_boss_id: id, p_minutes: 9, p_hp: sharedHp });
    if (!error) await refreshLiveBoss();
    return !error;
  }
  $a('btnAdmSpawnBoss').onclick = async () => {
    if (!isAdmin() || !sb) return;
    const id = $a('admBossSelect').value;
    const ok = await adminSpawnSharedBoss(id, 4);
    if (!ok) { floatTxt(P.x, P.y, 100, LANG==='fr'?'Échec du lancement':'Failed to launch', { hurt:true }); return; }
    $a('infoOverlay').classList.remove('open');
    startBossFight(id, true); // true = rejoint le boss PARTAGÉ qu'on vient de lancer (PV communs, top10...)
  };
  // --- pour un joueur précis ---
  $a('btnResetAccountByUuid').onclick = resetAccountByUuid;
  $a('btnScreenshotPlayer').onclick = adminScreenshotPlayer;
  // --- pour les joueurs ---
  $a('btnResetAllQuests').onclick = resetAllQuests;
  $a('btnResetAllAccounts').onclick = resetAllAccounts;
  $a('btnAdmSpawnGlobal').onclick = async () => {
    if (!isAdmin() || !sb) return;
    const id = $a('admGlobalBossSelect').value;
    const targetMin = Number($a('admBossDurationSelect').value) || 4;
    const ok = await adminSpawnSharedBoss(id, targetMin);
    if (ok) logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a lancé ${BOSS_ROSTER[id].name.fr} pour tous (~${targetMin} min)`, 0x9cc9e8);
    floatTxt(P.x, P.y, 100, ok ? (LANG==='fr'?'Boss lancé pour tous ✓':'Boss launched for all ✓') : (LANG==='fr'?'Échec du lancement':'Failed to launch'), { gold:ok, hurt:!ok });
  };
  $a('btnAdmDespawnBoss').onclick = async () => {
    if (!isAdmin() || !sb) return;
    if (!confirm(LANG==='fr'?'Faire disparaître le boss mondial pour TOUS les joueurs ?':'Despawn the world boss for ALL players?')) return;
    const { error } = await sb.rpc('admin_despawn_boss');
    if (!error) { await refreshLiveBoss(); logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a fait disparaître le boss mondial`, 0x9cc9e8); }
    floatTxt(P.x, P.y, 100, !error ? (LANG==='fr'?'Boss disparu ✓':'Boss despawned ✓') : (LANG==='fr'?'Échec':'Failed'), { gold:!error, hurt:!!error });
  };
  // --- modérateurs ---
  $a('btnAddRole').onclick = async () => {
    if (!isAdmin() || !sb) return;
    const uuid = $a('admRoleUuid').value.trim(); if (!uuid) return;
    const role = $a('admRoleSelect').value;
    const rpc = role === 'mod' ? 'admin_add_mod' : 'admin_add_tester';
    const { error } = await sb.rpc(rpc, { p_user_id: uuid });
    if (error) { $a('admRoleList').insertAdjacentHTML('afterbegin', `<div class="admHint">${error.message}</div>`); return; }
    logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a ajouté le rôle ${role==='mod'?'Modérateur':'Testeur'} à \`${uuid}\``, 0x9cc9e8);
    $a('admRoleUuid').value = ''; refreshRoleList();
  };
}
// panneau unique "Rôles" : fusionne les listes Modérateur et Testeur (2 tables distinctes côté
// serveur, chat_mods et testers) pour que l'admin ajoute/retire les deux rôles au même endroit,
// sur une seule ligne par joueur — demande explicite du 2026-07-07 ("lie les 2 systèmes")
async function refreshRoleList() {
  const el = $a('admRoleList'); if (!el || !sb) return;
  const [{ data: mods, error: modErr }, { data: testers, error: testErr }] = await Promise.all([
    sb.rpc('admin_list_mods'), sb.rpc('admin_list_testers'),
  ]);
  if (modErr || testErr) { el.innerHTML = `<div class="admHint">${escapeHtml((modErr||testErr).message)}</div>`; return; }
  const byUser = new Map();
  (mods || []).forEach(m => byUser.set(m.user_id, { ...(byUser.get(m.user_id)||{}), user_id:m.user_id, pseudo:m.pseudo, mod:true }));
  (testers || []).forEach(m => byUser.set(m.user_id, { ...(byUser.get(m.user_id)||{}), user_id:m.user_id, pseudo:m.pseudo, tester:true }));
  const rows = [...byUser.values()];
  if (!rows.length) { el.innerHTML = `<div class="admEmpty">${LANG==='fr'?'Aucun rôle attribué':'No roles assigned'}</div>`; return; }
  el.innerHTML = rows.map(r => `<div class="modRow">` +
    `<span class="modPseudo">${escapeHtml(r.pseudo || (LANG==='fr'?'(sans pseudo)':'(no nickname)'))}</span>` +
    `<code class="modUuid">${r.user_id}</code>` +
    `<span class="roleBadges">${r.mod?'🛡️ MOD':''}${r.mod&&r.tester?' · ':''}${r.tester?'🧪 Testeur':''}</span>` +
    `${r.mod?`<button class="modRemBtn" data-uuid="${r.user_id}" data-role="mod">${LANG==='fr'?'Retirer MOD':'Remove MOD'}</button>`:''}` +
    `${r.tester?`<button class="modRemBtn" data-uuid="${r.user_id}" data-role="tester">${LANG==='fr'?'Retirer Testeur':'Remove Tester'}</button>`:''}` +
    `</div>`).join('');
  el.querySelectorAll('.modRemBtn').forEach(btn => {
    btn.onclick = async () => {
      const rpc = btn.dataset.role === 'mod' ? 'admin_remove_mod' : 'admin_remove_tester';
      const { error } = await sb.rpc(rpc, { p_user_id: btn.dataset.uuid });
      if (!error) refreshRoleList();
    };
  });
}
$a('btnAdmin').onclick = openAdminPanel;
// panneau Testeur : accès aux fonctionnalités en avant-première, sans aucun avantage de jeu.
// Pour l'instant, contenu limité (pêche/mine/etc. pas encore développés) — le panneau existe et
// se remplira au fur et à mesure des nouveautés à tester.
function openTesterPanel() {
  if (!myIsTester) return;
  const upcoming = [
    { icon:'🎣', name:{fr:'Pêche',en:'Fishing'} },
    { icon:'⛏️', name:{fr:'Mine',en:'Mining'} },
    { icon:'🌲', name:{fr:'Forêt',en:'Forest'} },
    { icon:'🌾', name:{fr:'Champs',en:'Fields'} },
    { icon:'🐑', name:{fr:'Bergerie',en:'Ranch'} },
  ];
  const list = upcoming.map(a => `<div class="achRow inactive"><div class="achIcon">${a.icon}</div>` +
    `<div class="achInfo"><div class="achName">${a.name[LANG]}</div><div class="achDesc">${LANG==='fr'?'En développement — bientôt en test':'In development — testable soon'}</div></div></div>`).join('');
  openInfo(LANG==='fr'?'🧪 Panneau Testeur':'🧪 Tester Panel',
    `<div class="admSummary">${LANG==='fr'
      ? 'Merci de tester Velia Idle ! Ce panneau te donnera accès aux nouveautés en avant-première (sans aucun avantage en jeu — c\'est du test pur). Rien à tester pour l\'instant, mais voici ce qui arrive :'
      : 'Thanks for testing Velia Idle! This panel gives you early access to new features (no in-game advantage — pure testing). Nothing to test yet, but here\'s what\'s coming:'}</div>` +
    list);
}
$a('btnTester').onclick = openTesterPanel;
