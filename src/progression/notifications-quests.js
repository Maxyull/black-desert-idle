// ==================== NOTIFICATIONS, SUCCES, COURRIER, COMPENDIUM & QUETES (UI + logique) ====================
// Extrait de game-core.js le 2026-07-08 (reorganisation par dossiers) -- DOIT charger APRES
// core/game-core.js (S, EQUIP, GS()...), progression/achievements-data.js (ACHIEVEMENTS, achCat)
// et progression/treasure-craft.js (treasureTotal) : tout est reference en execution (function
// bodies), aucune evaluation immediate au-dela d'un seul wiring de bouton statique deja present
// dans le DOM ($('resetNoticeClose').onclick=...).
// ==================== SUCCÈS (permanents) & QUÊTES JOURNALIÈRES ====================
// tous les objectifs ne reposent que sur des stats atteignables en solo (kills, loot, silver,
// zones, gearscore, enchantement, temps de jeu) — jamais sur le marché/classement/Discord,
// qui nécessitent un compte vérifié : ainsi tout succès/quête reste faisable par n'importe quel joueur.
function maxEnhLv() {
  let m = 0;
  for (const k of OPTIMIZABLE_SLOTS) { const e = EQUIP[k]; if (e && (e.enhLv||0) > m) m = e.enhLv||0; }
  return m;
}
// ACHIEVEMENTS/ACH_CATS/achCat() desormais dans progression/achievements-data.js (extrait le
// 2026-07-08, reorganisation par dossiers) -- charge APRES ce fichier, voir index.html.
// ---------- centre de notifications : journal PERSISTANT (survit au reload/reconnexion, stocké
// dans S.notifLog comme le reste de la sauvegarde) des événements marquants (succès, niveau, butin
// rare, victoire de boss...), en plus des toasts éphémères déjà existants ----------
let notifUnread = 0;
let notifSerial = 0; // id local incrémental (unique le temps d'une session, suffisant pour les boutons "supprimer")
// cat : 'important' (nécessite l'attention du joueur, ex: reset de compte) | 'success' (réussite/
// progression positive) | 'info' (routine) — sert à trier/distinguer visuellement dans le centre
// de notifications refait le 2026-07-07 ("qu'on y comprenne quelque chose avec ce qui est
// important ou non")
const NOTIF_MAX_AGE_MS = 7 * 24 * 3600 * 1000; // auto-purge après 7 jours — demande explicite du 2026-07-08
const NOTIF_SHOW_LIMIT = 20; // "affiche les 20 dernières entrées" — demande explicite du 2026-07-08
function pruneNotifLog() {
  const cutoff = Date.now() - NOTIF_MAX_AGE_MS;
  S.notifLog = (S.notifLog||[]).filter(n => n.t >= cutoff);
}
function pushNotif(icon, title, text, cat) {
  pruneNotifLog();
  S.notifLog.unshift({ id: ++notifSerial + '_' + Date.now(), icon, title, text, t: Date.now(), cat: cat || 'info' });
  if (S.notifLog.length > 200) S.notifLog.length = 200; // garde-fou dur, bien au-delà des 20 affichées
  notifUnread++;
  updateNotifBadge();
}
function deleteNotif(id) {
  S.notifLog = (S.notifLog||[]).filter(n => n.id !== id);
  openNotifCenter(); // re-render immédiat, le joueur voit la ligne disparaître
}
// relaie un événement vers le salon Discord "log général" via l'Edge Function discord-log —
// le webhook lui-même reste côté serveur, jamais dans ce code client (voir supabase-discord-log)
async function logToDiscord(title, description, color) {
  if (!sb) return;
  try {
    const { data } = await sb.auth.getSession();
    const token = (data && data.session && data.session.access_token) || SUPABASE_ANON_KEY;
    await fetch(SUPABASE_URL + '/functions/v1/discord-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ title, description, color }),
    });
  } catch (e) {}
}
function updateNotifBadge() {
  const badge = $a('notifBadge'); if (!badge) return;
  badge.textContent = notifUnread > 9 ? '9+' : notifUnread;
  badge.classList.toggle('show', notifUnread > 0);
  // halo doré autour du bouton cloche (même animation que "notes de version non lues") — demande
  // explicite du 2026-07-08 : "montre où se trouve des notifications avec halo"
  const btn = $a('btnNotifCenter'); if (btn) btn.classList.toggle('hasNew', notifUnread > 0);
}
// affiche TOUJOURS la date (pas seulement l'heure pour aujourd'hui) — demande explicite du
// 2026-07-07, pour pouvoir resituer une notification dans le temps sans ambiguïté
function fmtNotifTime(ts) {
  const d = new Date(ts);
  const hhmm = d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0');
  return d.getDate().toString().padStart(2,'0')+'/'+(d.getMonth()+1).toString().padStart(2,'0')+' '+hhmm;
}
// bannière colorée d'annonce importante (ex: reset complet des comptes) + entrée correspondante
// dans le centre de notifications — demande explicite du 2026-07-06
function showResetNotice(icon, title, body) {
  $('resetNoticeIcon').textContent = icon || '🔔';
  $('resetNoticeTitle').textContent = title;
  $('resetNoticeBody').innerHTML = body;
  $('resetNoticeOverlay').classList.add('show');
  pushNotif(icon || '🔔', title, body.replace(/<[^>]+>/g, ''), 'important');
}
$('resetNoticeClose').onclick = () => $('resetNoticeOverlay').classList.remove('show');
// réclame une éventuelle notice en attente à la connexion (livrée une seule fois, voir
// claim_pending_notice côté serveur) — appelé après le chargement de la sauvegarde cloud
async function checkPendingNotice() {
  if (!sb || !currentUser) return;
  try {
    const { data } = await sb.rpc('claim_pending_notice');
    const n = Array.isArray(data) ? data[0] : data;
    if (n && n.notice_key) {
      showResetNotice(n.icon, LANG==='fr' ? n.title_fr : n.title_en, LANG==='fr' ? n.body_fr : n.body_en);
    }
  } catch (e) {}
}
// centre de notifications refait proprement le 2026-07-07 : sépare ce qui est IMPORTANT (nécessite
// l'attention, ex: reset de compte) du reste (succès/progression), au lieu d'une simple liste plate
const NOTIF_CAT_META = {
  important: { fr:'⚠️ Important', en:'⚠️ Important' },
  success:   { fr:'🏆 Réussites', en:'🏆 Achievements' },
  info:      { fr:'📰 Activité',  en:'📰 Activity' },
};
function notifRowHtml(n) {
  return `<div class="notifRow ${n.cat}">
    <div class="notifIcon">${n.icon}</div>
    <div class="notifBody"><div class="notifTitle">${escapeHtml(n.title)}</div><div class="notifText">${escapeHtml(n.text)}</div></div>
    <div class="notifTime">${fmtNotifTime(n.t)}</div>
    <button class="notifDelBtn" data-id="${n.id}" title="${i18next.t('progression:progression.notifications.delete')}">✕</button>
  </div>`;
}
let notifCatFilter = 'all'; // 'all' | 'important' | 'success' | 'info' — demande explicite du 2026-07-08 ("les catégories doivent être en haut")
function openNotifCenter() {
  notifUnread = 0;
  updateNotifBadge();
  pruneNotifLog(); // purge les entrées de plus de 7 jours avant d'afficher
  const log = S.notifLog||[];
  if (!log.length) {
    openInfo(i18next.t('progression:progression.notifications.title'),
      `<div class="admEmpty">${i18next.t('progression:progression.notifications.empty')}</div>`);
    return;
  }
  // "affiche les 20 dernières entrées" (demande explicite du 2026-07-08) : on ne garde QUE les 20
  // plus récentes tous types confondus pour l'affichage (le stockage garde jusqu'à 200, purgées au
  // bout de 7 jours) — réparties ensuite par catégorie, avec des ONGLETS FIXES en haut du panneau
  // (au lieu de simples titres de section perdus dans le défilement) pour sauter direct à une
  // catégorie sans avoir à scroller.
  const shown = log.slice(0, NOTIF_SHOW_LIMIT);
  const important = shown.filter(n => n.cat === 'important');
  const success = shown.filter(n => n.cat === 'success');
  const info = shown.filter(n => n.cat === 'info');
  if (!['all','important','success','info'].includes(notifCatFilter)) notifCatFilter = 'all';
  const tabsHtml = `<div class="catTabs">
    <button class="catTab notifCatTab${notifCatFilter==='all'?' active':''}" data-cat="all">${i18next.t('progression:progression.notifications.tab_all')} <span class="notifSectionCount">${shown.length}</span></button>
    <button class="catTab notifCatTab${notifCatFilter==='important'?' active':''}" data-cat="important">${NOTIF_CAT_META.important[LANG]} <span class="notifSectionCount">${important.length}</span></button>
    <button class="catTab notifCatTab${notifCatFilter==='success'?' active':''}" data-cat="success">${NOTIF_CAT_META.success[LANG]} <span class="notifSectionCount">${success.length}</span></button>
    <button class="catTab notifCatTab${notifCatFilter==='info'?' active':''}" data-cat="info">${NOTIF_CAT_META.info[LANG]} <span class="notifSectionCount">${info.length}</span></button>
  </div>`;
  const section = (cat, items) => !items.length ? '' :
    `<div class="notifSectionTitle">${NOTIF_CAT_META[cat][LANG]} <span class="notifSectionCount">${items.length}</span></div>` +
    items.map(notifRowHtml).join('');
  const html = notifCatFilter === 'all'
    ? section('important', important) + section('success', success) + section('info', info)
    : (notifCatFilter === 'important' ? important : notifCatFilter === 'success' ? success : info).map(notifRowHtml).join('') ||
      `<div class="admEmpty">${i18next.t('progression:progression.notifications.empty_category')}</div>`;
  const summary = `<div class="notifSummary">${i18next.t('progression:progression.notifications.summary', { count: shown.length, total: log.length })}</div>`;
  openInfo(i18next.t('progression:progression.notifications.title'), summary + tabsHtml + `<div class="notifScroll">${html}</div>`);
  $a('infoBody').querySelectorAll('.notifCatTab').forEach(btn => {
    btn.onclick = () => { notifCatFilter = btn.dataset.cat; openNotifCenter(); };
  });
  $a('infoBody').querySelectorAll('.notifDelBtn').forEach(btn => {
    btn.onclick = e => { e.stopPropagation(); deleteNotif(btn.dataset.id); };
  });
}

function checkAchievements() {
  let unlocked = false;
  for (const a of ACHIEVEMENTS) {
    if (S.achUnlocked[a.id]) continue;
    if (a.statFn(S) >= a.target) {
      S.achUnlocked[a.id] = Date.now();
      addSilver(a.reward, 'achievement', a.name.fr);
      showAchToast(a);
      pushNotif('🏅', i18next.t('progression:progression.notifications.achievement_unlocked'), a.name[LANG]+' (+'+fmt(a.reward)+' 🪙)', 'success');
      logToDiscord('🏅 Succès débloqué', `**${myPseudo||'Joueur'}** — ${a.name.fr} (+${fmt(a.reward)} 🪙)`, 0xc9a55a);
      unlocked = true;
    }
  }
  if (unlocked) refreshStatsOnly();
}
function showAchToast(a) {
  const stack = $('achToastStack'); if (!stack) return;
  const el = document.createElement('div');
  el.className = 'achToast';
  el.innerHTML = `<div class="achToastIcon">${a.icon}</div>` +
    `<div><div class="achToastTitle">${i18next.t('progression:progression.achievements.toast_title')}</div>` +
    `<div class="achToastName">${a.name[LANG]}</div>` +
    `<div class="achToastReward">+${fmt(a.reward)} 🪙</div></div>`;
  stack.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 4500);
}
// ---------- courrier (mailbox) : stockage permanent, jamais plein, jamais perdu ----------
// contrairement au sac (192 cases, peut être plein), tout ce qui arrive ici s'empile sans
// limite — pensé pour des dons automatiques comme la fidélité journalière (voir plus bas)
function mailboxAdd(key, name, icon, qty) {
  const existing = S.mailbox.find(m => m.key === key);
  if (existing) existing.qty += qty;
  else S.mailbox.push({ key, name, icon, qty });
}
function showMailToast(icon, name, qty) {
  const stack = $('achToastStack'); if (!stack) return;
  const el = document.createElement('div');
  el.className = 'achToast';
  el.innerHTML = `<div class="achToastIcon">${icon}</div>` +
    `<div><div class="achToastTitle">${i18next.t('progression:progression.mailbox.toast_title')}</div>` +
    `<div class="achToastName">${name}</div>` +
    `<div class="achToastReward">+${fmt(qty)}</div></div>`;
  stack.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 4500);
}
// 200 points de fidélité par jour, livrés dans le courrier — appelé depuis hud() (cheap check).
// Depuis le 2026-07-11 (demande explicite) : le gain quotidien ne rejoint plus S.loyalty tout
// seul, il s'accumule dans le courrier (sans limite, tant que le joueur ne les récupère pas) —
// voir claimLoyalty() pour le passage courrier -> stock utilisable (affiché à côté du silver).
function ensureLoyaltyGrant() {
  if (!saveReady) return; // attend la vraie sauvegarde -- voir la déclaration de saveReady
  const now = new Date();
  const key = now.getFullYear()+'-'+(now.getMonth()+1)+'-'+now.getDate();
  if (S.lastLoyaltyDate === key) return;
  S.lastLoyaltyDate = key;
  const name = 'Loyalties'; // renommé le 2026-07-07 (demande explicite), même nom dans les 2 langues
  mailboxAdd('loyalty', name, '🏅', 200);
  showMailToast('🏅', name, 200);
  updateMailBadge();
}
// déplace tout le solde en attente dans le courrier vers S.loyalty (stock réellement utilisable,
// affiché à côté du silver dans l'inventaire) -- le courrier continuera d'accumuler normalement
// dès le prochain octroi journalier, rien n'est jamais plafonné ni perdu entre-temps
function claimLoyalty() {
  const m = S.mailbox.find(m => m.key === 'loyalty');
  if (!m || m.qty <= 0) return;
  S.loyalty = (S.loyalty||0) + m.qty;
  m.qty = 0;
  updateMailBadge();
  hud();
}
// après une réinitialisation complète, on veut un VRAI 0 immédiat — sans ça, le hud() appelé en
// fin d'applySaveState() redéclenche aussitôt ensureLoyaltyGrant() (lastLoyaltyDate remis à null
// par le reset) et regrante 200 Loyalties à l'instant, masquant le fait que ça a bien été remis à
// zéro. Bug confirmé le 2026-07-07 : "les Loyalties ne sont jamais remis à 0 même après un reset".
// Le prochain octroi journalier reprendra normalement dès demain.
function suppressLoyaltyGrantForToday() {
  const now = new Date();
  S.lastLoyaltyDate = now.getFullYear()+'-'+(now.getMonth()+1)+'-'+now.getDate();
  S.loyalty = 0;
}
function updateMailBadge() {
  const badge = $('mailBadge'); if (!badge) return;
  const n = S.mailbox.reduce((sum,m) => sum + m.qty, 0);
  badge.textContent = fmt(n);
  badge.classList.toggle('show', n > 0);
}
function renderMailboxHtml() {
  const stockRow = `<div class="admSummary">${i18next.t('progression:progression.mailbox.claimed_stock_label')} : <b>${fmt(S.loyalty||0)}</b> 🏅</div>`;
  if (!S.mailbox.length || !S.mailbox.some(m => m.qty > 0)) {
    return stockRow + `<div class="admEmpty">${i18next.t('progression:progression.mailbox.empty')}</div>`;
  }
  return stockRow + S.mailbox.filter(m => m.qty > 0).map(m => `<div class="achRow">` +
    `<div class="achIcon">${m.icon}</div>` +
    `<div class="achInfo"><div class="achName">${m.name}</div></div>` +
    `<div class="achReward">×${fmt(m.qty)}</div>` +
    (m.key === 'loyalty' ? `<button class="mailClaimBtn" data-key="${m.key}">${i18next.t('progression:progression.mailbox.claim_button')}</button>` : '') +
    `</div>`).join('') +
    `<div class="admSummary">${i18next.t('progression:progression.mailbox.permanent_note')}</div>`;
}
function openMailbox() {
  openInfo(i18next.t('progression:progression.mailbox.panel_title'), renderMailboxHtml());
  $a('infoBody').querySelectorAll('.mailClaimBtn').forEach(btn => {
    btn.onclick = () => { if (btn.dataset.key === 'loyalty') claimLoyalty(); openMailbox(); };
  });
}

// World Boss (Kzarka/Vell : lobby, combat, rendu de la salle) -> voir boss.js (charge APRES ce fichier, voir index.html)

let achPanelCat = 'all';       // catégorie affichée dans le panneau Succès
let achOnlyUnfinished = false; // filtre "pas fini" (s'applique désormais à la CHAÎNE entière)

// petit anneau de progression SVG (barre circulaire), partagé par la vue d'ensemble (76px) et les
// tuiles de catégorie (36px) -- même formule que les anneaux du mockup fourni (stroke-dasharray/
// dashoffset sur un cercle tourné de -90deg pour démarrer en haut).
function achRingSvg(pct, size, strokeW) {
  const r = (size - strokeW) / 2, c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const off = c * (1 - clamped / 100);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--s3)" stroke-width="${strokeW}"/>` +
    `<circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--gold)" stroke-width="${strokeW}" ` +
    `stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" stroke-linecap="round" ` +
    `transform="rotate(-90 ${size/2} ${size/2})"/></svg>`;
}
// carte de vue d'ensemble : anneau global, débloqués/restants, silver déjà gagné en récompenses de
// succès vs silver encore à débloquer -- tout calculé en direct depuis S.achUnlocked, jamais figé.
function achOverviewHtml(S) {
  const doneCount = ACHIEVEMENTS.filter(a => S.achUnlocked[a.id]).length;
  const totalCount = ACHIEVEMENTS.length;
  const overallPct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;
  const { earned, remaining } = achievementSilverTotals(S);
  return `<div class="achOverviewCard">` +
    `<div class="achOverviewRing">${achRingSvg(overallPct, 76, 7)}<span class="achRingPct">${overallPct}%</span></div>` +
    `<div class="achOverviewBody">` +
      `<div class="achOverviewTitle">${i18next.t('progression:progression.achievements.overview_title')}</div>` +
      `<div class="achOverviewSub">${i18next.t('progression:progression.achievements.overview_summary', { done: fmt(doneCount), total: fmt(totalCount), earned: fmt(earned) })}</div>` +
    `</div>` +
    `<div class="achOverviewStats">` +
      `<div class="achOStat"><div class="v">${fmt(doneCount)}</div><div class="k">${i18next.t('progression:progression.achievements.stat_unlocked')}</div></div>` +
      `<div class="achOStat"><div class="v">${fmt(totalCount - doneCount)}</div><div class="k">${i18next.t('progression:progression.achievements.stat_remaining')}</div></div>` +
      `<div class="achOStat"><div class="v" style="color:var(--green2)">${fmt(remaining)}</div><div class="k">${i18next.t('progression:progression.achievements.stat_silver_to_unlock')}</div></div>` +
    `</div>` +
  `</div>`;
}
// bandeau "Presque là" : réutilise TEL QUEL nextAchievement() (déjà utilisée par l'encart de suivi
// permanent en haut à droite) -- juste reskinné ici, aucune nouvelle logique de calcul du succès le
// plus proche n'est réintroduite.
function achSpotlightHtml(S) {
  const next = nextAchievement();
  if (!next) return `<div class="achSpotlightBox achSpotlightDone">${i18next.t('progression:progression.quests.all_achievements_done')}</div>`;
  const { a, pct } = next;
  const pctRound = Math.round(pct);
  return `<div class="achSpotlightBox">` +
    `<div class="achSpotlightIcon">${a.icon}</div>` +
    `<div class="achSpotlightBody">` +
      `<div class="achSpotlightLbl">${i18next.t('progression:progression.achievements.spotlight_label')}</div>` +
      `<div class="achSpotlightName"><b>${a.name[LANG]}</b> — ${a.desc[LANG]}</div>` +
      `<div class="achSpotlightBar"><div class="achSpotlightBarFill" style="width:${pctRound}%"></div></div>` +
    `</div>` +
    `<div class="achSpotlightPct">${pctRound}%</div>` +
  `</div>`;
}
// tuile de filtre par catégorie ('all' inclus) : anneau + icône + libellé + compteur réel --
// remplace les anciens onglets texte .catTab/.achCatTab.
function achCatCardHtml(catId, meta, S) {
  const { done, total, pct } = achCatCompletion(catId, S);
  return `<div class="achCatCard${catId===achPanelCat?' on':''}" data-cat="${catId}">` +
    `<div class="achCatRing">${achRingSvg(pct, 36, 4)}<span class="achCatIc">${meta.icon}</span></div>` +
    `<div class="achCatNm">${meta.label[LANG]}</div>` +
    `<div class="achCatCnt">${done}/${total}</div>` +
  `</div>`;
}
// une carte par CHAÎNE (pas par palier) : icône/nom/description du palier actif, puces de
// progression (X/N paliers débloqués), barre + récompense du palier actif si pas encore terminé,
// check vert UNIQUEMENT si toute la chaîne est à 100% (jamais sur un palier intermédiaire déjà
// débloqué tant que la chaîne continue).
function achChainCardHtml(entry) {
  const { chain, progress } = entry;
  const { tier, unlockedCount, totalTiers, done, pct, val } = progress;
  const pipsHtml = totalTiers > 1
    ? `<div class="achTierPips">${chain.tiers.map((_, i) => `<span class="achPip${i < unlockedCount ? ' on' : ''}"></span>`).join('')}` +
      `<span class="achPipLbl">${unlockedCount}/${totalTiers}</span></div>`
    : '';
  const progressHtml = done ? '' :
    `<div class="achChainProgRow"><span>${fmt(Math.min(val, tier.target))} / ${fmt(tier.target)}</span><span>${Math.round(pct)}%</span></div>` +
    `<div class="achChainBar"><div class="achChainBarFill" style="width:${Math.round(pct)}%"></div></div>`;
  return `<div class="achChainCard${done?' done':''}" data-cat="${chain.cat}">` +
    `<div class="achChainIcon">${tier.icon}</div>` +
    `<div class="achChainBody">` +
      `<div class="achChainName">${tier.name[LANG]}</div>` +
      `<div class="achChainDesc">${tier.desc[LANG]}</div>` +
      pipsHtml + progressHtml +
      `<div class="achChainReward">+${fmt(tier.reward)} 🪙</div>` +
    `</div>` +
    (done ? `<div class="achChainDoneBadge">✓</div>` : '') +
  `</div>`;
}
// bande "derniers débloqués" : s'appuie sur le vrai horodatage S.achUnlocked[a.id] -- réutilise
// pneRelativeTime() (progression/patch-notes-engage-react.js, charge APRÈS ce fichier mais appelé
// seulement au clic joueur donc déjà défini à ce moment-là, voir CLAUDE.md section 7 "référence en
// exécution") plutôt que dupliquer un 2e formateur de temps relatif identique dans ce fichier.
function achRecentRowHtml(S) {
  const recent = recentlyUnlockedAchievements(S, 4);
  if (!recent.length) return '';
  const now = Date.now();
  const items = recent.map((a, i) => {
    const ts = S.achUnlocked[a.id];
    const isNew = i === 0 && (now - ts) < 24*3600*1000;
    const rel = typeof pneRelativeTime === 'function' ? pneRelativeTime(ts) : new Date(ts).toLocaleDateString();
    return `<div class="achRecentItem">` +
      (isNew ? `<div class="achRecentBadge">${i18next.t('progression:progression.achievements.recent_new_badge')}</div>` : '') +
      `<div class="achRecentIc">${a.icon}</div>` +
      `<div class="achRecentNm">${a.name[LANG]}</div>` +
      `<div class="achRecentDt">${rel}</div>` +
    `</div>`;
  }).join('');
  return `<div class="achRecentRow">${items}</div>`;
}
function renderAchievementsHtml() {
  const overview = achOverviewHtml(S);
  const spotlight = achSpotlightHtml(S);
  // pseudo-catégorie 'all' : ACH_CATS stocke des libellés {fr,en} en dur (donnée de jeu, pas migrée
  // vers i18next -- voir en-tête du fichier), donc on résout la même chaîne i18next une fois et on
  // la pose sous les deux clés pour rester compatible avec achCatCardHtml() qui lit meta.label[LANG].
  const allLabel = i18next.t('progression:progression.achievements.cat_all_label');
  const cats = [['all', {icon:'🏅', label:{fr:allLabel, en:allLabel}}], ...Object.entries(ACH_CATS)];
  const catRow = `<div class="achCatRow">${cats.map(([id, meta]) => achCatCardHtml(id, meta, S)).join('')}</div>`;
  const toggleRow = `<div class="achToggleRow"><div class="achToggle" id="achUnfinishedBtn">` +
    `<div class="achToggleSwitch${achOnlyUnfinished?' on':''}"><div class="achKnob"></div></div>` +
    `${i18next.t('progression:progression.achievements.filter_unfinished_label')}</div></div>`;
  const recentRow = achRecentRowHtml(S);
  const chains = groupAchievementsIntoChains();
  const visibleChains = achPanelCat === 'all' ? chains : chains.filter(c => c.cat === achPanelCat);
  let ordered = sortChainsForDisplay(visibleChains, S);
  if (achOnlyUnfinished) ordered = ordered.filter(entry => !entry.progress.done);
  const grid = ordered.length
    ? `<div class="achChainGrid">${ordered.map(achChainCardHtml).join('')}</div>`
    : `<div class="achEmpty">${i18next.t('progression:progression.achievements.empty')}</div>`;
  return `<div class="achPanel">${overview}${spotlight}${catRow}${toggleRow}${recentRow}${grid}</div>`;
}
function openAchievements() {
  const callout = contentChangeCalloutHtml('achievements');
  openInfo(i18next.t('progression:progression.achievements.panel_title'), callout + renderAchievementsHtml());
  markContentSeen('achievements');
  $a('infoBody').querySelectorAll('.achCatCard').forEach(card => {
    card.onclick = () => { achPanelCat = card.dataset.cat; openAchievements(); };
  });
  const fb = $a('achUnfinishedBtn');
  if (fb) fb.onclick = () => { achOnlyUnfinished = !achOnlyUnfinished; openAchievements(); };
}

// ---------- Compendium (bonus de collection par zone) — demande explicite du 2026-07-08 ----------
// le bonus d'une zone n'est actif QUE si ses 4 objets (trash/matériau/bijou/craft) ont TOUS déjà
// été obtenus au moins une fois (voir zoneFullyCollected/compendiumZoneCount) — pas juste 1 seul.
function compendiumItemDone(name) { return (S.lootByItem[name]||0) > 0; }
// clic sur un objet du Compendium : montre (halo doré) TOUTES les zones qui le lootent, et propose
// d'y aller directement — demande explicite du 2026-07-08 ("je clique sur Ceinture de Naru j'ai un
// halo qui me montre toutes les zones qui loot ça et je choisis laquelle je veux")
function compendiumHighlightItem(name) {
  document.querySelectorAll('.compZoneRow').forEach(r => r.classList.remove('compHalo'));
  const matches = [];
  ZONES.forEach((z,zi) => {
    const tier = gearTierForZone(zi);
    const names = [tr(z.loot.trash.name), tr(tier.material.name), tr(z.loot.jackpot.name), tr(z.loot.craft.name)];
    if (names.includes(name)) matches.push(zi);
  });
  matches.forEach(zi => { const row = document.querySelector(`.compZoneRow[data-zi="${zi}"]`); if (row) row.classList.add('compHalo'); });
  const picker = $a('compZonePicker'); if (!picker) return;
  picker.innerHTML = matches.length
    ? `<b>${escapeHtml(name)}</b> ${i18next.t('progression:progression.compendium.pick_zone_hint')} ` +
      matches.map(zi => `<button class="compGoZoneBtn" data-zi="${zi}" title="${i18next.t('progression:progression.compendium.go_zone_title')}">${tr(ZONES[zi].name)}</button>`).join('')
    : `<span class="admEmpty">${i18next.t('progression:progression.compendium.no_zone_found')}</span>`;
  picker.querySelectorAll('.compGoZoneBtn').forEach(btn => {
    btn.onclick = () => {
      const zi = parseInt(btn.dataset.zi,10);
      if (atVelia || zi !== zoneIdx) travelTo(zi);
      $a('infoOverlay').classList.remove('open');
    };
  });
}
// 'bag' retiré le 2026-07-16 (demande explicite : "enleve le sac protege du compendium il est
// maintenant dans l'inventaire") -- doublon exact du même COMPENDIUM_BAG déjà affiché dans la carte
// Inventaire (onglet "Compendium", voir #invModeCompendiumPane/renderCompendiumPane, promu là-bas
// le 2026-07-14)
let compendiumTab = 'zones'; // 'zones' | 'bosses' | 'pen' — demande explicite du 2026-07-08 ("refais moi le compendium pour qu'il ressemble a quelque chose de lisible")
function renderCompendiumHtml() {
  const zc = compendiumZoneCount(), bc = compendiumBossCount();
  const total = compendiumTotalCount(), max = compendiumTotalMax(), pct = compendiumPct();
  const bossCountMax = Object.keys(BOSS_ROSTER).length;
  const penItems = penMasteryItemList(), penDone = compendiumPenCount();
  const summaryCard = `<button id="compTutoBtn" class="compTutoBtn" title="${i18next.t('progression:progression.compendium.tutorial_button_title')}">?</button>
    <div class="admStatTiles">
      <div class="admStatTile"><div class="astLbl">📖 ${i18next.t('progression:progression.compendium.progress_label')}</div><div class="astVal">${total} / ${max}</div></div>
      <div class="admStatTile"><div class="astLbl">🏃 SPD</div><div class="astVal">+${pct}%</div></div>
      <div class="admStatTile"><div class="astLbl">⚔️ ${i18next.t('progression:progression.compendium.dmg_label')}</div><div class="astVal">+${pct}%</div></div>
      <div class="admStatTile"><div class="astLbl">🛡️ ${i18next.t('progression:progression.compendium.dodge_label')}</div><div class="astVal">+${pct}%</div></div>
    </div>
    <div class="admSummary">${i18next.t('progression:progression.compendium.summary_line', { zc, zonesTotal: ZONES.length, bc, bossMax: bossCountMax, penDone, penTotal: penItems.length })}</div>
    <div class="admHint">${i18next.t('progression:progression.compendium.hint')}</div>
    <div id="compZonePicker" class="compZonePicker"></div>
    <div class="catTabs">
      <button class="catTab compTab${compendiumTab==='zones'?' active':''}" data-tab="zones">🗺️ ${i18next.t('progression:progression.compendium.tab_zones')} (${zc}/${ZONES.length})</button>
      <button class="catTab compTab${compendiumTab==='bosses'?' active':''}" data-tab="bosses">🐋 World Bosses (${bc}/${bossCountMax})</button>
      <button class="catTab compTab${compendiumTab==='pen'?' active':''}" data-tab="pen">🌟 ${i18next.t('progression:progression.compendium.tab_pen')} (${penDone}/${penItems.length})</button>
    </div>`;
  let bodyHtml;
  if (compendiumTab === 'bosses') {
    bodyHtml = Object.entries(BOSS_ROSTER).map(([id,b]) => {
      const unlocked = !!S.bossesKilled[id];
      return `<div class="achRow${unlocked?' done':''}">` +
        `<div class="achIcon">${b.icon}</div>` +
        `<div class="achInfo"><div class="achName">${b.name[LANG]}</div>` +
        `<div class="achDesc">${unlocked?i18next.t('progression:progression.compendium.boss_defeated'):i18next.t('progression:progression.compendium.boss_not_defeated')}</div></div>` +
        `<div class="achReward">${unlocked?'+1% ✓':'🔒'}</div></div>`;
    }).join('');
  } else if (compendiumTab === 'pen') {
    // reorganisé par palier de couleur le 2026-07-08 (demande explicite : "reorgniser par zone de
    // couleurs et toujours dans le meme ordre arme armure, bijou avec leurs icone, grisé si on a
    // pas et montrant le max qu'on a eu jusqu'a present") -- même convention d'en-tête que l'onglet
    // Zones (.zTierHead/.zTierDot), icône réelle de l'objet (penMasteryIcon, core/game-core.js,
    // grisée en CSS si jamais atteint PEN), pic d'enchantement jamais atteint (S.enhPeakByName,
    // voir trackEnhPeak) affiché même pour un objet qui n'a pas (encore) touché PEN.
    bodyHtml = `<div class="admHint">${i18next.t('progression:progression.compendium.pen_hint')}</div>` +
      GEAR_TIERS.map(tier => {
        const tierItems = penItems.filter(e => e.grade === tier.grade);
        const tierDone = tierItems.filter(e => S.penMastery[e.name]).length;
        // "Maitrise pen ajoute a cote de chaque categorie ?/11 et montre que c'est fais si c'est
        // 11/11" (2026-07-09) -- compteur par palier (7 pieces + 4 bijoux = 11), classe "done" sur
        // l'en-tête entière une fois complet, même convention visuelle que .compZoneRow.done
        // (halo vert, voir styles.css) pour rester cohérent avec l'onglet Zones juste au-dessus.
        const rowsHtml = tierItems.map(entry => {
          const done = !!S.penMastery[entry.name];
          const peak = (S.enhPeakByName && S.enhPeakByName[entry.name]) || 0;
          return `<span class="compItem compPenItem${done?' done':''}" title="${escapeHtml(tr(entry.name))}">` +
            `<span class="compPenIcon${done?'':' notDone'}">${penMasteryIcon(entry)}</span>` +
            `<span class="compPenName">${escapeHtml(tr(entry.name))}</span>` +
            `<span class="compPenPeak">${peak>0?ENH_NAMES[peak]:'—'}</span></span>`;
        }).join('');
        return `<div class="zTierHead${tierDone===tierItems.length?' done':''}"><span class="zTierDot" style="background:${tier.color}"></span>${tier.label[LANG]}` +
          `<span class="zTierHeadCount">${tierDone}/${tierItems.length}</span></div>` +
          `<div class="compItems compPenGrid">${rowsHtml}</div>`;
      }).join('');
  } else {
    // regroupé par palier de stuff, en-tête colorée (2026-07-16, demande explicite : "ajoute au
    // compendium des categorie dans zone par zone de couleurs") -- même convention que #zoneList
    // (voir buildZoneList/.zTierHead/.zTierDot), zones dans le VRAI ordre de farm (GEAR_TIERS.zones)
    // plutôt que l'ordre brut de ZONES[]. Chaque ligne porte aussi un effet de complétion "implicite"
    // (demande explicite : "un effet qui montre implicitement si c'est fini ou pas comme ça pas
    // besoin d'y aller") -- halo vert (voir .compZoneRow.done dans styles.css) visible sans avoir à
    // dérouler la liste d'objets de la zone pour vérifier.
    bodyHtml = GEAR_TIERS.map(tier => {
      const rowsHtml = tier.zones.map(zi => {
        const z = ZONES[zi];
        const items = zoneItemNames(zi);
        const unlocked = zoneFullyCollected(zi);
        const itemsHtml = items.map(name => `<span class="compItem${compendiumItemDone(name)?' done':''}" data-item="${escapeHtml(name)}">${compendiumItemDone(name)?'✓':'○'} ${escapeHtml(name)}</span>`).join('');
        return `<div class="achRow compZoneRow${unlocked?' done':''}" data-zi="${zi}" style="--tier-color:${tier.color}">` +
          `<div class="achIcon">${unlocked?'📖':'🔒'}</div>` +
          `<div class="achInfo"><div class="achName">${tr(z.name)}</div>` +
          `<div class="achDesc compItems">${itemsHtml}</div></div>` +
          `<div class="achReward">${unlocked?'+1% ✓':i18next.t('progression:progression.compendium.missing_item')}</div></div>`;
      }).join('');
      return `<div class="zTierHead"><span class="zTierDot" style="background:${tier.color}"></span>${tier.label[LANG]}</div>${rowsHtml}`;
    }).join('');
  }
  return summaryCard + bodyHtml;
}
// tutoriel auto-lancé à la toute première ouverture du Compendium (2026-07-08, demande explicite) —
// persisté en localStorage pour ne se déclencher qu'une seule fois, jamais aux ouvertures suivantes
let compTutoSeen = false;
try { compTutoSeen = localStorage.getItem('velia-idle-comp-tuto-seen') === '1'; } catch(e) {}
// tutoriel auto-lancé au tout premier ramassage d'une Pierre de Cron (2026-07-09, demande explicite)
// — même principe que compTutoSeen : persisté en localStorage, ne se déclenche qu'une seule fois.
// Voir CRON_TUTORIAL_STEPS/startCronTutorial (game-supabase.js) et son déclenchement dans dropsTick.
let cronTutoSeen = false;
try { cronTutoSeen = localStorage.getItem('velia-idle-cron-tuto-seen') === '1'; } catch(e) {}
function openCompendium() {
  const callout = contentChangeCalloutHtml('compendium');
  openInfo(i18next.t('progression:progression.compendium.panel_title'), callout + renderCompendiumHtml());
  markContentSeen('compendium');
  const tutoBtn = $a('compTutoBtn');
  if (tutoBtn) tutoBtn.onclick = () => startCompendiumTutorial();
  if (!compTutoSeen) {
    compTutoSeen = true;
    try { localStorage.setItem('velia-idle-comp-tuto-seen', '1'); } catch(e) {}
    setTimeout(startCompendiumTutorial, 400);
  }
  $a('infoBody').querySelectorAll('.compTab').forEach(btn => {
    btn.onclick = () => { compendiumTab = btn.dataset.tab; openCompendium(); };
  });
  $a('infoBody').querySelectorAll('.compItem[data-item]').forEach(el => {
    el.onclick = () => compendiumHighlightItem(el.dataset.item);
  });
}

// pool de quêtes journalières : 3 tirées au hasard chaque jour parmi ces familles, avec une
// difficulté (variante) elle aussi randomisée — le compteur de progression réutilise les stats
// globales déjà suivies (kills/lootCount/silverEarned/enhAttempts/playtimeSec/travelCount) via
// une simple soustraction par rapport à leur valeur au début de la période (voir base ci-dessous)
const QUEST_KINDS_DAILY = {
  kills:    { icon:'⚔️', name:{fr:'Terrasser des monstres',    en:'Defeat monsters'},  unit:{fr:'monstres',en:'monsters'}, variants:[{target:100,reward:2000},{target:250,reward:5000},{target:500,reward:9000}] },
  loot:     { icon:'🎒', name:{fr:'Ramasser du butin',         en:'Loot items'},       unit:{fr:'objets',en:'items'},       variants:[{target:80,reward:1800},{target:200,reward:4500},{target:400,reward:8000}] },
  silver:   { icon:'🪙', name:{fr:'Gagner du silver',          en:'Earn silver'},      unit:{fr:'silver',en:'silver'},      variants:[{target:5000,reward:1500},{target:15000,reward:4000},{target:40000,reward:9000}] },
  enh:      { icon:'✦',  name:{fr:'Tenter des optimisations',  en:'Attempt enhancements'}, unit:{fr:'tentatives',en:'attempts'}, variants:[{target:5,reward:1500},{target:15,reward:4000},{target:30,reward:8000}] },
  playtime: { icon:'⏱️', name:{fr:'Jouer',                     en:'Play time'},        unit:{fr:'min',en:'min'},            variants:[{target:600,reward:1500},{target:1800,reward:4000},{target:3600,reward:8000}], displayDiv:60 },
  travel:   { icon:'🗺️', name:{fr:'Changer de zone',           en:'Change zone'},      unit:{fr:'fois',en:'times'},         variants:[{target:1,reward:1000}] },
};
// pool distinct pour les quêtes hebdomadaires : familles différentes (butin rare, réussites
// d'enchantement, plus grosses cibles) pour que ça ne ressemble pas juste à une version "plus
// longue" des quotidiennes — l'état (S.wq) et le tirage sont totalement indépendants de S.dq
const QUEST_KINDS_WEEKLY = {
  killsBig:    { icon:'💀', name:{fr:'Grand massacre',           en:'Great slaughter'},   unit:{fr:'monstres',en:'monsters'}, variants:[{target:1500,reward:15000},{target:3000,reward:30000},{target:6000,reward:55000}] },
  silverBig:   { icon:'💰', name:{fr:'Grosse récolte de silver', en:'Big silver haul'},   unit:{fr:'silver',en:'silver'},      variants:[{target:50000,reward:10000},{target:150000,reward:25000},{target:400000,reward:60000}] },
  jackpot:     { icon:'💎', name:{fr:'Bijoux rares',             en:'Rare jewelry'},      unit:{fr:'bijoux',en:'jewels'},      variants:[{target:1,reward:8000},{target:3,reward:20000},{target:6,reward:45000}] },
  gear:        { icon:'⚙️', name:{fr:'Équipement trouvé',        en:'Gear found'},        unit:{fr:'pièces',en:'pieces'},      variants:[{target:2,reward:6000},{target:5,reward:15000},{target:10,reward:35000}] },
  enhSuccess:  { icon:'🌟', name:{fr:'Optimisations réussies',   en:'Successful enhancements'}, unit:{fr:'réussites',en:'successes'}, variants:[{target:10,reward:8000},{target:25,reward:20000},{target:50,reward:45000}] },
  playtimeBig: { icon:'⏱️', name:{fr:'Assiduité',               en:'Dedication'},        unit:{fr:'h',en:'h'},                variants:[{target:7200,reward:8000},{target:18000,reward:20000},{target:36000,reward:45000}], displayDiv:3600 },
};
const QUEST_SCOPES = {
  daily:  { stateKey:'dq', kinds:QUEST_KINDS_DAILY,  count:3, keyFn:d => d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate() },
  weekly: { stateKey:'wq', kinds:QUEST_KINDS_WEEKLY, count:3, keyFn:d => { const m = mondayOf(d); return m.getFullYear()+'-'+(m.getMonth()+1)+'-'+m.getDate(); } },
};
function mondayOf(d) { const day = (d.getDay()+6)%7; return new Date(d.getFullYear(), d.getMonth(), d.getDate()-day); }
function questStatValue(kind) {
  switch (kind) {
    case 'kills': case 'killsBig': return S.kills;
    case 'loot': return S.lootCount;
    case 'silver': case 'silverBig': return S.silverEarned;
    case 'enh': return S.enhAttempts;
    case 'enhSuccess': return S.enhSuccess||0;
    case 'playtime': case 'playtimeBig': return S.playtimeSec;
    case 'travel': return S.travelCount;
    case 'jackpot': return S.jackpotCount||0;
    case 'gear': return S.gearDropCount||0;
  }
  return 0;
}
function ensureQuests(scope) {
  const cfg = QUEST_SCOPES[scope];
  const key = cfg.keyFn(new Date());
  if (S[cfg.stateKey] && S[cfg.stateKey].date === key) return;
  const kinds = Object.keys(cfg.kinds);
  for (let i = kinds.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [kinds[i],kinds[j]] = [kinds[j],kinds[i]]; }
  const quests = kinds.slice(0,cfg.count).map(k => {
    const variants = cfg.kinds[k].variants;
    const v = variants[Math.floor(Math.random()*variants.length)];
    return { kind:k, target:v.target, reward:v.reward, claimed:false };
  });
  const base = {};
  for (const k of Object.keys(cfg.kinds)) base[k] = questStatValue(k);
  S[cfg.stateKey] = { date:key, quests, base };
}
function questProgress(scope, q) {
  const st = S[QUEST_SCOPES[scope].stateKey];
  return Math.max(0, questStatValue(q.kind) - st.base[q.kind]);
}
function claimQuest(scope, i) {
  ensureQuests(scope);
  const st = S[QUEST_SCOPES[scope].stateKey];
  const q = st.quests[i];
  // triple garde : quête existante, PAS déjà réclamée, et objectif réellement atteint. Le flag
  // q.claimed rend la réclamation idempotente → impossible de toucher 2× la récompense même en
  // cliquant dans le suivi ET dans le panneau (exploit signalé).
  if (!q || q.claimed || questProgress(scope,q) < q.target) return;
  q.claimed = true; addSilver(q.reward, 'quest', q.kind);
  refreshStatsOnly(); updateQuestBadge();
  // rafraîchit IMMÉDIATEMENT les deux UI pour qu'aucun bouton "Réclamer" périmé ne subsiste
  renderQuestTrackerWidget();
  if (questsPanelOpen) openDailyQuests();
}
function updateQuestBadge() {
  ensureQuests('daily'); ensureQuests('weekly');
  let n = 0;
  for (const scope of ['daily','weekly']) {
    const st = S[QUEST_SCOPES[scope].stateKey];
    n += st.quests.filter(q => !q.claimed && questProgress(scope,q) >= q.target).length;
  }
  const badge = $('questBadge');
  if (badge) { badge.textContent = n; badge.classList.toggle('show', n > 0); }
}
// affiche TOUS les types de quêtes du pool (pas seulement les 3 tirées ce cycle) — celles non
// tirées ce cycle-ci restent visibles en grisé avec leur objectif possible, pour que le joueur
// voie l'étendue complète du pool plutôt que seulement le tirage du jour/de la semaine
function renderQuestSectionHtml(scope) {
  ensureQuests(scope);
  const cfg = QUEST_SCOPES[scope], st = S[cfg.stateKey];
  return Object.keys(cfg.kinds).map(kind => {
    const def = cfg.kinds[kind];
    const dv = def.displayDiv||1;
    const i = st.quests.findIndex(q => q.kind === kind);
    if (i === -1) {
      const minV = def.variants[0], maxV = def.variants[def.variants.length-1];
      const rangeTxt = def.variants.length > 1
        ? `${fmt(Math.floor(minV.target/dv))}–${fmt(Math.floor(maxV.target/dv))} ${def.unit[LANG]}`
        : `${fmt(Math.floor(minV.target/dv))} ${def.unit[LANG]}`;
      return `<div class="achRow inactive">` +
        `<div class="achIcon">${def.icon}</div>` +
        `<div class="achInfo"><div class="achName">${def.name[LANG]}</div><div class="achDesc">${rangeTxt}</div></div>` +
        `<div class="achReward">${i18next.t('progression:progression.quests.not_active')}</div>` +
      `</div>`;
    }
    const q = st.quests[i];
    const val = Math.min(questProgress(scope,q), q.target);
    const pct = Math.round(val/q.target*100);
    const doneNotClaimed = val >= q.target && !q.claimed;
    return `<div class="achRow${q.claimed?' done':''}">` +
      `<div class="achIcon">${def.icon}</div>` +
      `<div class="achInfo"><div class="achName">${def.name[LANG]}</div>` +
      `<div class="achDesc">${fmt(Math.floor(val/dv))} / ${fmt(Math.floor(q.target/dv))} ${def.unit[LANG]}</div>` +
      `<div class="achBarWrap"><div class="achBar" style="width:${pct}%"></div></div></div>` +
      (q.claimed ? `<div class="achReward">${i18next.t('progression:progression.quests.claimed')}</div>`
        : doneNotClaimed ? `<button class="questClaimBtn" data-scope="${scope}" data-i="${i}">${i18next.t('progression:progression.quests.claim_button')} +${fmt(q.reward)}🪙</button>`
        : `<div class="achReward">+${fmt(q.reward)} 🪙</div>`) +
      `</div>`;
  }).join('');
}
// compte, pour un scope, combien de quêtes sont prêtes à réclamer et combien restent en cours
function questScopeCounts(scope) {
  ensureQuests(scope);
  const st = S[QUEST_SCOPES[scope].stateKey];
  let claimable = 0, remaining = 0;
  st.quests.forEach(q => {
    if (q.claimed) return;
    if (questProgress(scope,q) >= q.target) claimable++; else remaining++;
  });
  return { claimable, remaining };
}
let questPanelScope = 'daily'; // scope actuellement affiché dans le panneau Quêtes
function renderDailyQuestsHtml() {
  const dailyNote = i18next.t('progression:progression.quests.daily_reset_note');
  const weeklyNote = i18next.t('progression:progression.quests.weekly_reset_note');
  const trackLabel = S.questTrackerOn
    ? i18next.t('progression:progression.quests.tracker_stop')
    : i18next.t('progression:progression.quests.tracker_start');
  // un badge par onglet : ✅ = prêtes à réclamer (pastille dorée), sinon le nombre restant en gris —
  // permet de voir d'un coup d'œil, sans ouvrir l'onglet, s'il reste quelque chose à faire/réclamer
  const tabBtn = (scope, icon, label) => {
    const c = questScopeCounts(scope);
    const badge = c.claimable > 0
      ? `<span class="qCountBadge ready">${c.claimable} ✅</span>`
      : (c.remaining > 0 ? `<span class="qCountBadge">${c.remaining}</span>` : `<span class="qCountBadge done">✓</span>`);
    return `<button class="catTab qScopeTab${scope===questPanelScope?' active':''}" data-scope="${scope}">${icon} ${label} ${badge}</button>`;
  };
  const note = questPanelScope==='daily' ? dailyNote : weeklyNote;
  return `<button id="btnToggleTracker" onclick="toggleQuestTracker()">${trackLabel}</button>` +
    `<div class="catTabs">` +
      tabBtn('daily', '📅', i18next.t('progression:progression.quests.tab_daily')) +
      tabBtn('weekly', '🗓️', i18next.t('progression:progression.quests.tab_weekly')) +
    `</div>` +
    `<div id="questScopeBody">${renderQuestSectionHtml(questPanelScope)}<div class="admSummary">${note}</div></div>`;
}
let questsPanelOpen = false; // le panneau Quêtes est-il ouvert ? (pour re-rendre après une réclamation)
function openDailyQuests() {
  openInfo(i18next.t('progression:progression.quests.panel_title'), renderDailyQuestsHtml());
  questsPanelOpen = true; // openInfo l'a remis à false ; on le repasse à true APRÈS
  $a('infoBody').querySelectorAll('.qScopeTab').forEach(btn => {
    btn.onclick = () => { questPanelScope = btn.dataset.scope; openDailyQuests(); };
  });
  $a('infoBody').querySelectorAll('.questClaimBtn').forEach(btn => {
    // claimQuest se charge lui-même de rafraîchir le panneau ET l'encart de suivi (voir claimQuest)
    btn.onclick = () => claimQuest(btn.dataset.scope, parseInt(btn.dataset.i,10));
  });
}
// active/désactive la liste de suivi des quêtes restantes (encart en haut à droite) — le bouton
// "Suivre" vit dans le panneau Quêtes, mais l'affichage lui-même est un encart permanent séparé
function toggleQuestTracker() {
  S.questTrackerOn = !S.questTrackerOn;
  renderQuestTrackerWidget();
  if ($a('infoOverlay').classList.contains('open')) openDailyQuests();
}
// prochain succès le plus proche d'être débloqué (plus haut % de progression parmi les non-débloqués)
function nextAchievement() {
  let best = null, bestPct = -1;
  for (const a of ACHIEVEMENTS) {
    if (S.achUnlocked[a.id]) continue;
    const pct = Math.max(0, Math.min(99, (a.statFn(S)/a.target)*100));
    if (pct > bestPct) { bestPct = pct; best = { a, pct }; }
  }
  return best;
}
function fmtDuration(ms) {
  let s = Math.max(0, Math.floor(ms/1000));
  const days = Math.floor(s/86400); s -= days*86400;
  const h = Math.floor(s/3600); s -= h*3600;
  const m = Math.floor(s/60); s -= m*60;
  const pad = n => String(n).padStart(2,'0');
  return (days>0 ? days+i18next.t('progression:progression.quests.duration_day_suffix') : '') + pad(h)+':'+pad(m)+':'+pad(s);
}
function msToNextDailyReset() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()+1, 0,0,0,0) - now;
}
function msToNextWeeklyReset() {
  const now = new Date();
  const day = (now.getDay()+6)%7; // 0=lundi..6=dimanche
  const daysUntil = 7 - day;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()+daysUntil, 0,0,0,0) - now;
}
function fmtHours(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60);
  return h > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${m}min`;
}
// les deux encarts en haut à droite (suivi temps de jeu/reset hebdo, quêtes suivies) se replient
// indépendamment ; état persisté en localStorage (2026-07-08, demande explicite) pour survivre à
// un rechargement de page, comme le menu de gauche (voir sideMenuCollapsed)
// repliés par défaut sur mobile (voir isMobileViewport, adaptation mobile du 2026-07-05) — sinon
// remplacé par la préférence explicite du joueur si elle existe déjà en localStorage
let resetWidgetFolded = isMobileViewport(), trackerWidgetFolded = isMobileViewport();
try { const v = localStorage.getItem('velia-idle-resetwidget-folded'); if (v !== null) resetWidgetFolded = v === '1'; } catch(e) {}
try { const v = localStorage.getItem('velia-idle-trackerwidget-folded'); if (v !== null) trackerWidgetFolded = v === '1'; } catch(e) {}
function toggleResetFold() { resetWidgetFolded = !resetWidgetFolded; try { localStorage.setItem('velia-idle-resetwidget-folded', resetWidgetFolded ? '1' : '0'); } catch(e) {} renderQuestWidget(); }
function toggleTrackerFold() { trackerWidgetFolded = !trackerWidgetFolded; try { localStorage.setItem('velia-idle-trackerwidget-folded', trackerWidgetFolded ? '1' : '0'); } catch(e) {} renderQuestTrackerWidget(); }
// encart permanent en haut à droite : timers de reset, prochain succès à débloquer, temps de jeu
function renderQuestWidget() {
  const el = $('questWidget'); if (!el) return;
  ensureQuests('daily'); ensureQuests('weekly');
  const header = `<div class="qwHeaderRow"><span class="qwTitle">${i18next.t('progression:progression.quests.widget_title')}</span>` +
    `<button class="qwFoldBtn" onclick="toggleResetFold()">${resetWidgetFolded?'▸':'▾'}</button></div>`;
  if (resetWidgetFolded) { el.innerHTML = header; return; }
  const next = nextAchievement();
  const todayPlaytime = S.playtimeSec - (S.dq && S.dq.base ? S.dq.base.playtime : 0);
  const dailyTip = i18next.t('progression:progression.quests.daily_tip');
  const weeklyTip = i18next.t('progression:progression.quests.weekly_tip');
  el.innerHTML = header + `<div class="qwBody">` +
    `<div class="qwRow" title="${dailyTip}"><span class="qwLbl">${i18next.t('progression:progression.quests.widget_daily_label')}</span><span class="qwTimer">${fmtDuration(msToNextDailyReset())}</span></div>` +
    `<div class="qwRow" title="${weeklyTip}"><span class="qwLbl">${i18next.t('progression:progression.quests.widget_weekly_label')}</span><span class="qwTimer">${fmtDuration(msToNextWeeklyReset())}</span></div>` +
    `<div class="qwSep">${i18next.t('progression:progression.quests.playtime_label')}</div>` +
    `<div class="qwRow"><span class="qwLbl">${i18next.t('progression:progression.quests.total_label')}</span><span class="qwTimer">${fmtHours(S.playtimeSec)}</span></div>` +
    `<div class="qwRow"><span class="qwLbl">${i18next.t('progression:progression.quests.today_label')}</span><span class="qwTimer">${fmtHours(todayPlaytime)}</span></div>` +
    (next
      ? `<div class="qwNext"><div class="qwNextIcon">${next.a.icon}</div><div class="qwNextInfo">` +
        `<div class="qwNextName">${next.a.name[LANG]}</div>` +
        `<div class="achBarWrap"><div class="achBar" style="width:${Math.round(next.pct)}%"></div></div></div></div>`
      : `<div class="qwNext qwAllDone">${i18next.t('progression:progression.quests.all_achievements_done')}</div>`) +
    `</div>`;
}
// encart de suivi des quêtes restantes (activé via le bouton "Suivre" du panneau Quêtes) —
// liste toutes les quêtes actives ce cycle (journalières + hebdo) pas encore réclamées
function renderQuestTrackerWidget() {
  const el = $('questTrackerWidget'); if (!el) return;
  if (!S.questTrackerOn) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = '';
  const header = `<div class="qwHeaderRow"><span class="qwTitle">${i18next.t('progression:progression.quests.tracked_widget_title')}</span>` +
    `<button class="qwFoldBtn" onclick="toggleTrackerFold()">${trackerWidgetFolded?'▸':'▾'}</button></div>`;
  if (trackerWidgetFolded) { el.innerHTML = header; return; }
  ensureQuests('daily'); ensureQuests('weekly');
  let body = '';
  for (const scope of ['daily','weekly']) {
    const cfg = QUEST_SCOPES[scope], st = S[cfg.stateKey];
    const rows = [];
    st.quests.forEach((q,i) => {
      if (q.claimed) return;
      const def = cfg.kinds[q.kind];
      const val = Math.min(questProgress(scope,q), q.target);
      const pct = Math.round(val/q.target*100);
      const dv = def.displayDiv||1;
      const done = val >= q.target;
      // bouton "Réclamer" directement dans l'encart de suivi quand la quête est terminée
      const right = done
        ? `<button class="qwClaimBtn" data-scope="${scope}" data-i="${i}">+${fmt(q.reward)}🪙</button>`
        : '';
      rows.push(`<div class="qwTrackRow"><span class="qwTrackIcon">${def.icon}</span>` +
        `<div class="qwTrackInfo"><div class="qwTrackName">${def.name[LANG]}</div>` +
        `<div class="qwTrackNum">${fmt(Math.floor(val/dv))} / ${fmt(Math.floor(q.target/dv))} ${def.unit[LANG]}</div>` +
        `<div class="achBarWrap"><div class="achBar" style="width:${pct}%"></div></div></div>${right}</div>`);
    });
    if (rows.length) {
      body += `<div class="qwScopeLbl">${scope==='daily'?i18next.t('progression:progression.quests.tracked_daily_label'):i18next.t('progression:progression.quests.tracked_weekly_label')}</div>` + rows.join('');
    }
  }
  el.innerHTML = header + `<div class="qwBody">` +
    (body || `<div class="qwEmpty">${i18next.t('progression:progression.quests.all_claimed')}</div>`) +
    `</div>`;
  el.querySelectorAll('.qwClaimBtn').forEach(btn => {
    // claimQuest rafraîchit lui-même le suivi ET le panneau — pas de double appel
    btn.onclick = () => claimQuest(btn.dataset.scope, parseInt(btn.dataset.i,10));
  });
}

// dégâts infligés : dépend UNIQUEMENT de la PA face à la PA requise de la zone
function dmgMult(apR) {
  if (apR >= 1) return Math.min(1 + (apR - 1) * 0.5, 1.6);
  return Math.max(0.25, apR * apR);
}
// dégâts reçus : dépend UNIQUEMENT de la PD face à la PD requise de la zone
// pas assez de PD → tu encaisses beaucoup plus (jusqu'à 4,5×, courbe plus raide qu'avant) ; overgear en PD → tu encaisses moins
function dmgTakenMult(dpR) {
  if (dpR < 1) return Math.min(4.5, 1 + (1 - dpR) * 3.2);
  return Math.max(0.4, 1 - (dpR - 1) * 0.35);
}
// le loot suit le "goulot d'étranglement" : être sous-PA OU sous-PD pénalise pareil (comme en vrai jeu)
// pas assez de stuff -> loot pénalisé (comme dans le vrai jeu) ; stuff adapté OU overstuff -> loot
// normal, plus jamais de bonus ni de malus au-delà de 1.0 (demande explicite du 2026-07-06 :
// "il faut looter moins bien si tu as pas le stuff nécessaire c'est tout mais si tu es overstuff
// tu auras un loot normal") -- supprime l'ancien bonus +10% (1.0-1.3x) et l'ancien malus
// anti-overfarm qui redescendait jusqu'à 0.25x au-delà de 1.8x
function lootMult(r) {
  if (r < 0.9) return Math.max(0.3, r * 0.85);
  return 1.0;
}
// ---------- recommandations "meilleur endroit pour farmer" (2026-07-09, demande explicite : carte
// Statistiques refondue en onglets Perso/Recommandations) ----------
// valeurs THÉORIQUES, indépendantes du stuff actuel du joueur (demande explicite : "silver/h, xp/h,
// kills/min théoriques par zone") -- comparent les zones entre elles à armes égales, sans se
// soucier de si le joueur peut y survivre aujourd'hui.
const REF_KPM_FOR_STATS = 15; // kills/min de référence (voir docs/roadmap.md, même valeur que le calibrage économique des zones)
const REF_DPS_FOR_STATS = 900; // dégâts/min de référence PUREMENT relatif : seul hpPer varie d'une zone à l'autre, donc le classement (et le ratio entre zones) ne dépend pas de la valeur choisie ici
// UNIQUEMENT le trash (2026-07-09, demande explicite : "le calcul de silver/h se fait uniquement
// sur les silver looté au sol grâce au token qui doivent être la principale source de revenu") --
// matériaux et bijoux ne sont plus comptés : ce sont des objets de PROGRESSION (optimisation/gear),
// pas une source de revenu régulière, et les looter au lieu de les vendre ne doit rien retirer au
// classement "meilleur silver/h" d'une zone.
function zoneSilverPerHour(z) {
  const l = z.loot;
  return l.trash.val*l.trash.ch * REF_KPM_FOR_STATS * 60;
}
function zoneXpPerHour(z) { return z.xp * REF_KPM_FOR_STATS * 60; }
function zoneKillsPerMin(z) { return REF_DPS_FOR_STATS / z.hpPer; }
// meilleure zone selon une métrique donnée (silver/xp/kills), toutes zones confondues (demande
// explicite : classement théorique, PAS limité aux zones survivables aujourd'hui)
function bestZoneForMetric(metricFn) {
  let bestI = 0, bestV = -Infinity;
  for (let i = 0; i < ZONES.length; i++) {
    const v = metricFn(ZONES[i]);
    if (v > bestV) { bestV = v; bestI = i; }
  }
  return { i: bestI, v: bestV };
}
function badgeOf(r) {
  if (r < 0.6)  return { cls:'b-red',    txt:'ZONE DANGEREUSE' };
  if (r < 0.9)  return { cls:'b-orange', txt:'ZONE DIFFICILE' };
  if (r <= 1.3) return { cls:'b-green',  txt:'ZONE ADAPTÉE' };
  if (r <= 1.8) return { cls:'b-blue',   txt:'ZONE FACILE' };
  return { cls:'b-grey', txt:'ZONE DÉPASSÉE' };
}
// zone trop dure pour le stuff actuel ("ZONE DANGEREUSE", r<0.6) : rend le danger tangible plutôt
// qu'une pénalité invisible de dégâts/loot -- le joueur devient plus lent, et les monstres qui
// t'ont aggro deviennent plus rapides (demande explicite du 2026-07-05 : "tu es plus lent, les
// monstres sont plus rapides")
function isZoneDangerous() { return bottleneck() < 0.6; }
// valeurs durcies le 2026-07-05 (demande explicite : "un plus gros ralenti du joueur et une
// vitesse plus élevée des monstres") -- étaient 0.7/1.35 à l'introduction de cette mécanique
const DANGER_PLAYER_SPEED_MULT = 0.5;
const DANGER_MOB_SPEED_MULT = 1.7;
// aiMode/AI_COMBAT_MODES/renderAiModeBtn/setAiCombatMode desormais dans combat/ai-mode.js
// (extrait le 2026-07-08, reorganisation par dossiers) -- charge APRES ce fichier, voir index.html.
// bascule Équipement/Cristal de la carte Équipement (2026-07-15, demande explicite : "un nouveau
// slider a bulle... pour changer d'equipement a cristal") -- même pilule que le mode IA/farm, mais
// dans le panneau latéral (pas sur le canvas). "Cristal" n'a qu'1 seul emplacement pour l'instant,
// verrouillé (voir #equipCrystalPane dans index.html) -- pas encore de système de cristaux en jeu.
let equipMode = 'gear';
const EQUIP_MODES = {
  gear:    { icon:'⚔️', name:{fr:'Équipement', en:'Gear'} },
  crystal: { icon:'💎', name:{fr:'Cristal',    en:'Crystal'} },
};
function renderEquipModeBtn() {
  const el = $('equipModeSlider'); if (!el) return;
  el.querySelectorAll('.equipModeSeg').forEach(seg => {
    const key = seg.dataset.mode, m = EQUIP_MODES[key];
    const active = equipMode === key;
    seg.classList.toggle('active', active);
    seg.title = m.name[LANG];
    seg.innerHTML = active ? `<span class="farmModeSegIcon">${m.icon}</span><span class="farmModeSegLabel">${m.name[LANG]}</span>` : `<span class="farmModeSegIcon">${m.icon}</span>`;
  });
  const gearPane = $('equipGearPane'), crystalPane = $('equipCrystalPane');
  if (gearPane) gearPane.style.display = equipMode === 'gear' ? '' : 'none';
  if (crystalPane) crystalPane.style.display = equipMode === 'crystal' ? '' : 'none';
  const crystalSlot = $('crystalSlotCenter');
  if (crystalSlot) crystalSlot.title = i18next.t('progression:progression.equip.crystal_coming_soon');
}
function setEquipMode(key) {
  if (!EQUIP_MODES[key]) return;
  equipMode = key;
  renderEquipModeBtn();
}

// ============================================================
// Tutoriels d'objets au premier obtain (2026-07-19, adaptation du prompt "item-tutorial-system")
// -- même moteur/overlay que TUTORIAL_STEPS/COMPENDIUM_TUTORIAL_STEPS/CRON_TUTORIAL_STEPS
// (startTutorial, game-supabase.js), même convention 1 flag localStorage par tutoriel que
// compTutoSeen/cronTutoSeen ci-dessus (une seule fois "vu OU skip", pas de distinction côté client).
// La Pierre de Cron, le Compendium, la Maîtrise PEN et le Trésor de Velia ont déjà leur propre
// tutoriel/wiki dédié -- volontairement PAS dupliqués ici (voir audit dans le rapport de session).
//
// Objets choisis (audit du 2026-07-19, cf. src/inventory/gear-icons.js, src/world/zones-data.js,
// src/combat/loot-rolls.js) :
// - "mats" : Pierre de Novice/du Temps/Noire/concentrée -- les 4 matériaux d'optimisation PAR
//   PALIER (gris/blanc/vert/bleu). Servent à charger le panneau d'optimisation (#optCard), mais
//   rien n'explique explicitement QUEL matériau va avec QUELLE pièce avant ce tutoriel -- seul
//   optCard affiche un aperçu une fois un objet sélectionné. Un seul flag pour les 4 nom
//   (mécanique strictement identique quel que soit le palier), déclenché sur le tout premier
//   matériau d'optimisation ramassé, quel qu'il soit.
// - "craftMats" : Poussière d'esprit ancien / Fragment de mémoire / Marbre du Dieu déchu -- les 3
//   composants de craft "endgame" (kind:'craft'). Le Wiki (section Optimisation) explique UNIQUEMENT
//   la Poussière (convertible en Pierre de Caphras, 5:1, voir convertPoussiereToCaphras) ; Fragment
//   de mémoire et Marbre du Dieu déchu n'ont AUCUNE explication nulle part dans le jeu (aucune
//   recette de craft ne les consomme encore, contrairement à la Poussière) -- un joueur qui les
//   loote n'a aucun moyen de savoir qu'ils n'ont pas encore d'utilité (mécanique à venir), d'où ce
//   tutoriel pour éviter la confusion/l'inquiétude ("j'ai looté un truc et rien ne se passe").
// Bijoux rares (jackpot) et pièces d'équipement (gear) restent volontairement HORS scope : déjà
// couverts par TUTORIAL_STEPS (steps #invCard/#btnEquipBest) et par le tooltip d'objet au survol.
const ITEM_TUTORIALS = {
  mats: {
    // les 4 noms déclenchent le MÊME tutoriel (voir justification ci-dessus) — Set pour un test O(1)
    itemNames: new Set(['Pierre de Novice', 'Pierre du Temps', 'Pierre Noire', 'Pierre concentrée']),
    steps: [
      { target:'#optCard', placement:'left', final:true,
        title:{fr:'Matériaux d\'optimisation', en:'Enhancement materials'},
        text:{fr:'Cette pierre sert à optimiser une pièce d\'équipement du même palier (couleur de bordure identique). Charge-la dans ce panneau puis choisis la pièce à améliorer : plus le niveau visé est haut, plus le risque d\'échec est grand.', en:'This stone enhances a gear piece of the same tier (matching border color). Load it into this panel, then pick the piece to improve: the higher the target level, the higher the risk of failure.'} },
    ],
  },
  craftMats: {
    itemNames: new Set(['Poussière d\'esprit ancien', 'Fragment de mémoire', 'Marbre du Dieu déchu']),
    steps: [
      { title:{fr:'Composants de craft', en:'Crafting components'},
        text:{fr:'Ces objets rares (Poussière d\'esprit ancien, Fragment de mémoire, Marbre du Dieu déchu) sont des composants endgame. Seule la Poussière a une utilité pour l\'instant : elle se convertit en Pierre de Caphras (5 pour 1, onglet 🎒 Inventaire). Les autres n\'ont pas encore de recette — garde-les, elles serviront avec de futures fonctionnalités de craft.', en:'These rare items (Ancient Spirit Dust, Memory Fragment, Fallen God\'s Marble) are endgame components. Only the Dust has a use for now: it converts into a Caphras Stone (5 for 1, 🎒 Inventory tab). The others have no recipe yet — keep them, they\'ll be used by future crafting features.'},
        final:true },
    ],
  },
  // trash de zone (2026-07-19, demande explicite : "info a chaque ptit objet qu'on loot") : 16 noms
  // DIFFÉRENTS (1 par zone, kind:'trash', voir ZONES[].loot.trash.name), jamais expliqués nulle
  // part avant ce tutoriel — un SEUL déclenchement pour toute la partie (peu importe la zone), pas
  // un par zone (décision explicite : éviter le spam de 16 popups au fil de la progression).
  // itemNames calculé dynamiquement depuis ZONES (jamais codé en dur) : reste correct si une zone
  // est ajoutée/renommée sans avoir à toucher ce fichier. ZONES charge AVANT ce fichier (voir
  // index.dev.html, world/zones-data.js avant core/game-core.js avant progression/*), donc déjà
  // disponible ici au chargement immédiat.
  trash: {
    itemNames: new Set(ZONES.map(z => z.loot.trash.name)),
    steps: [
      { title:{fr:'Objets de loot courant', en:'Common loot items'},
        text:{fr:'Ces petits objets (looté à 100% sur chaque monstre, un nom différent par zone) n\'ont qu\'une seule utilité : ils se revendent automatiquement en silver au ramassage. Rien à en faire, rien à garder.', en:'These small items (100% drop from every monster, a different name per zone) have a single use: they\'re automatically sold for silver on pickup. Nothing to do with them, nothing to keep.'},
        final:true },
    ],
  },
};
// tutoriels d'ACTION (2026-07-19, demande explicite : "info... quand on va faire des nouveau truc
// dans le jeu") : contrairement à ITEM_TUTORIALS ci-dessus (déclenchés au ramassage d'un objet),
// ceux-ci sont déclenchés manuellement au premier usage RÉEL d'une fonctionnalité à risque/enjeu
// pour un nouveau joueur (enchantement : risque de perte de rangs ; marché : argent bloqué tant que
// l'ordre n'est pas exécuté ; boss : combat partagé, mourir réduit la récompense). Rejoignent
// ITEM_TUTORIALS (même objet, mêmes clés `steps`) pour réutiliser TOUT le moteur existant (file
// d'attente, flag "vu", stats admin) via maybeQueueTutorialById — voir combat/boss.js (openBossLobby),
// market/market.js (btnMarket.onclick), inventory/inventory-ui.js (renderOptimization, 1er matériau
// chargé). itemNames vide : jamais déclenchés par un ramassage, uniquement par ces appels directs.
ITEM_TUTORIALS.enchant = {
  itemNames: new Set(),
  steps: [
    { target:'#optCard', placement:'left', final:true,
      title:{fr:'Optimisation (enchantement)', en:'Optimization (enhancement)'},
      text:{fr:'Tenter d\'optimiser une pièce peut échouer et la faire RÉTROGRADER — plus le palier visé est haut, plus le risque est grand. Utilise des Pierres de Cron pour te protéger d\'un échec (ni gain ni perte de rang cette fois-là).', en:'Attempting to enhance a piece can fail and make it LOSE a rank — the higher the target tier, the bigger the risk. Use Cron Stones to protect yourself from a failure (no rank gained or lost that time).'} },
  ],
};
ITEM_TUTORIALS.market = {
  itemNames: new Set(),
  steps: [
    // target #marketHead (petit bandeau de titre), PAS #marketBox (2026-07-10, bug corrigé) :
    // #marketBox est le panneau entier (height:80vh, voir styles.css), donc son bord bas est déjà
    // près du bas de l'écran -- la bulle placement:'bottom' se retrouvait poussée hors du viewport
    // et coupée. #marketHead reste petit et fixe en haut du panneau, laissant toujours assez de
    // place sous lui pour la bulle.
    { target:'#marketHead', placement:'bottom', final:true,
      title:{fr:'Marché commun', en:'Common Market'},
      text:{fr:'Un vrai carnet d\'ordres entre joueurs : ton argent (achat) ou ton objet (vente) reste bloqué tant que l\'ordre n\'est pas exécuté ou annulé — tu peux annuler à tout moment depuis "Mes ordres".', en:'A real order book between players: your money (buy) or your item (sell) stays locked until the order is filled or cancelled — you can cancel anytime from "My orders".'} },
  ],
};
ITEM_TUTORIALS.boss = {
  itemNames: new Set(),
  steps: [
    { target:'#bossLobbyBody', placement:'bottom', final:true,
      title:{fr:'World Boss', en:'World Boss'},
      text:{fr:'Combat partagé par tous les joueurs en ligne : ta récompense dépend de ton rang de contribution aux dégâts. Reste vivant si possible — mourir pendant le combat réduit le loot chiffré gagné à la victoire.', en:'A fight shared by every online player: your reward depends on your damage contribution rank. Try to stay alive — dying during the fight reduces the numeric loot you earn on victory.'} },
  ],
};
// index inverse nom d'objet -> id de tutoriel, construit une seule fois (évite de reparcourir
// ITEM_TUTORIALS à chaque ramassage) -- fonction pure, testable isolément
function buildItemTutorialIndex() {
  const idx = {};
  for (const id in ITEM_TUTORIALS) {
    for (const name of ITEM_TUTORIALS[id].itemNames) idx[name] = id;
  }
  return idx;
}
const ITEM_TUTORIAL_BY_NAME = buildItemTutorialIndex();
// branche endItemTutorial() sur le DERNIER step de chaque tutoriel d'objet (celui marqué final:true)
// -- leaveTutorialStep() (game-supabase.js) appelle "after" du step courant à la fois quand on
// quitte via "Terminer" (dernier step) ET via "Passer" (n'importe quel step, y compris avant le
// dernier pour un tutoriel à plusieurs étapes) : on distingue les deux via tutSkipBtn/tutNextBtn,
// voir isLeavingViaSkipBtn ci-dessous. Fait après la définition d'ITEM_TUTORIALS pour rester DRY
// (pas de duplication de la logique "quel id pour ce step ?" dans chaque entrée du registre).
for (const id in ITEM_TUTORIALS) {
  const steps = ITEM_TUTORIALS[id].steps;
  const lastStep = steps[steps.length - 1];
  const prevAfter = lastStep.after; // pas de after existant sur nos steps actuels, mais robustesse si un futur step en gagne un
  lastStep.after = () => { if (prevAfter) prevAfter(); endItemTutorial(isLeavingViaSkipBtn); };
}
// posée à true juste avant d'appeler endTutorial() depuis le bouton "Passer" (voir wiring plus bas),
// remise à false immédiatement après -- seul moyen de distinguer "Passer" de "Terminer" sans toucher
// à endTutorial()/leaveTutorialStep() (game-supabase.js, hors périmètre de cet agent)
let isLeavingViaSkipBtn = false;
// 1 flag localStorage par tutoriel (même convention que compTutoSeen/cronTutoSeen) -- fonction pure
// séparée de l'écriture pour rester testable (voir consigne de la session : logique exposée,
// pas enfouie dans une closure)
function itemTutoStorageKey(id) { return 'velia-idle-item-tuto-seen-'+id; }
function isItemTutorialSeen(id) {
  try { return localStorage.getItem(itemTutoStorageKey(id)) === '1'; } catch(e) { return false; }
}
function markItemTutorialSeen(id, skipped) {
  try { localStorage.setItem(itemTutoStorageKey(id), '1'); } catch(e) {}
  // best-effort, ne bloque jamais le jeu (voir consigne : fire-and-forget, jamais await/bloquant) --
  // même garde que queueFarmEvent (sb && currentUser && !isGuest()) : pas de compte vérifié → pas
  // de journalisation, mais le flag localStorage ci-dessus suffit pour le "ne plus jamais montrer"
  // côté client, indépendamment du compte
  if (typeof sb !== 'undefined' && sb && typeof currentUser !== 'undefined' && currentUser && typeof isGuest === 'function' && !isGuest()) {
    // bug déjà rencontré ailleurs (voir game-supabase.js:1004, log_playtime_ping) : le builder
    // Postgrest renvoyé par sb.rpc(...) n'implémente QUE .then() (thenable), pas .catch() — appeler
    // .catch() dessus levait silencieusement "TypeError: ...catch is not a function", AVANT même que
    // la requête ne parte (le thenable ne s'exécute qu'au premier .then()). .then(null, cb) reste
    // fire-and-forget (pas d'await ici, ne bloque jamais l'appelant) tout en restant valide.
    try { sb.rpc('mark_item_tutorial_seen', { p_tutorial_id: id, p_skipped: !!skipped }).then(null, ()=>{}); } catch(e) {}
  }
}
// file d'attente (2026-07-19, demande explicite) : ne jamais interrompre un tutoriel déjà ouvert si
// plusieurs objets déclenchants tombent coup sur coup (farm hors-ligne rattrapé d'un coup, packs de
// mobs...) -- plafonnée à 5 (même raisonnement que le prompt de référence : le joueur peut être en
// train de farmer loin de l'écran, inutile d'empiler des dizaines de tutoriels en attente).
const ITEM_TUTORIAL_QUEUE_CAP = 5;
let itemTutorialQueue = [];
let itemTutorialActive = false;
// point d'entrée appelé au ramassage d'un objet (voir dropsTick, combat/loot-rolls.js) — reste une
// fonction pure de décision (que faire ?) séparée de la partie DOM (playNextItemTutorial), pour
// rester testable sans dépendre du moteur de tutoriel/overlay. Simple lookup nom->id puis délègue
// à maybeQueueTutorialById (2026-07-19, refactor) : le reste (file d'attente/plafond/flag vu) est
// IDENTIQUE qu'un tutoriel soit déclenché par un ramassage d'objet ou manuellement (voir
// ACTION_TUTORIALS ci-dessous — marché/enchantement/boss, déclenchés au premier usage réel).
function maybeQueueItemTutorial(itemName) {
  const id = ITEM_TUTORIAL_BY_NAME[itemName];
  return id ? maybeQueueTutorialById(id) : false;
}
// coeur de la décision (2026-07-19, extrait de maybeQueueItemTutorial) : id direct dans
// ITEM_TUTORIALS (via un nom d'objet OU appelé directement pour un déclenchement manuel, voir
// ACTION_TUTORIALS). File d'attente/plafond/flag "déjà vu" partagés, aucune distinction de source.
function maybeQueueTutorialById(id) {
  if (!ITEM_TUTORIALS[id] || isItemTutorialSeen(id)) return false;
  // bug corrigé (2026-07-20, rapporté explicitement : "l'onboarding ne dois pas s'enclencher si on
  // ne s'est pas inscrit/connecté = jeu non lance arriere plan") -- requestAnimationFrame(loop)
  // (world/render.js) démarre sans condition dès le chargement du script, AVANT même que le joueur
  // ait pu s'authentifier (#authOverlay encore ouvert) : le jeu simule déjà combat/loot en
  // arrière-plan sur DEFAULT_SAVE pendant cette fenêtre. Sans cette garde, un ramassage simulé
  // marquait le tutoriel "vu" (markItemTutorialSeen ci-dessous, appelé DÈS la mise en file, pas
  // après affichage réel) avant même que le vrai joueur ne l'ait jamais vu -- le privant
  // définitivement de ce tutoriel une fois réellement connecté. Retourne juste false (aucun effet
  // de bord) plutôt que de mettre en file : le même événement redéclenchera normalement l'appel
  // une fois authentifié (ex: le prochain ramassage du même objet).
  if (!currentUser) return false;
  if (itemTutorialQueue.includes(id) || (itemTutorialActive && itemTutorialActiveId === id)) return false; // déjà en file/en cours
  if (itemTutorialQueue.length >= ITEM_TUTORIAL_QUEUE_CAP) return false; // plafond silencieux, voir commentaire ci-dessus
  itemTutorialQueue.push(id);
  markItemTutorialSeen(id, false); // marqué "vu" dès la mise en file : ne redéclenche jamais même si le joueur ferme l'onglet avant l'affichage
  if (typeof refreshItemTutorialBadge === 'function') refreshItemTutorialBadge();
  if (!itemTutorialActive) playNextItemTutorial();
  return true;
}
let itemTutorialActiveId = null;
function playNextItemTutorial() {
  if (itemTutorialActive) return; // un tutoriel est déjà affiché, endItemTutorial() rappellera cette fonction
  const id = itemTutorialQueue.shift();
  if (!id) { itemTutorialActiveId = null; return; }
  itemTutorialActiveId = id;
  itemTutorialActive = true;
  // même délai (400ms) que startCronTutorial (loot-rolls.js) : laisse le temps au ramassage
  // (particule, floatTxt, lootLine) de s'afficher avant que le spotlight ne prenne l'écran
  setTimeout(() => startTutorial(ITEM_TUTORIALS[id].steps, { resetView:false }), 400);
}
// appelé via le "after" du dernier step de chaque ITEM_TUTORIALS[id] (voir boucle juste après la
// définition du registre plus haut) -- skipped reflète isLeavingViaSkipBtn au moment de l'appel :
// true seulement si fermé via "Passer", pour les stats admin (voir mark_item_tutorial_seen)
function endItemTutorial(skipped) {
  if (!itemTutorialActive) return;
  markItemTutorialSeen(itemTutorialActiveId, !!skipped); // réenvoie avec le bon skipped final (l'appel de mise en file avait skipped=false par défaut)
  itemTutorialActive = false;
  itemTutorialActiveId = null;
  if (typeof refreshItemTutorialBadge === 'function') refreshItemTutorialBadge();
  playNextItemTutorial(); // enchaîne sur le suivant en file, s'il y en a un
}
// isLeavingViaSkipBtn : distingue "Passer" (skip) de "Terminer" (fin normale) SANS toucher à
// endTutorial()/leaveTutorialStep() (game-supabase.js, hors périmètre de cet agent) -- écouteur en
// phase de CAPTURE (3e argument true) sur #tutSkipBtn : se déclenche AVANT le .onclick posé par
// game-supabase.js (la capture descend vers la cible avant la bulle où vit .onclick), donc le flag
// est déjà à true quand endTutorial()/leaveTutorialStep()/le "after" de notre step s'exécutent.
// Remis à false juste après (setTimeout 0) pour ne pas fausser un futur "Terminer" normal.
(function wireItemTutorialSkipDetection() {
  const btn = document.getElementById('tutSkipBtn');
  if (!btn) return; // filet de sécurité si jamais le DOM n'est pas encore prêt (ne devrait pas arriver, script chargé après le HTML)
  btn.addEventListener('click', () => {
    isLeavingViaSkipBtn = true;
    setTimeout(() => { isLeavingViaSkipBtn = false; }, 0);
  }, true);
})();
// pastille "NEW" sur l'onglet 🎒 Inventaire tant qu'un tutoriel d'objet est en attente/affiché
// (2026-07-19) -- réutilise TEL QUEL le style .contentNewBadge (styles.css, déjà utilisé pour
// Wiki/Compendium/Codex/Succès), mais piloté indépendamment de refreshContentNewBadges/
// CONTENT_UPDATE_VERSION (game-core.js, hors périmètre de cet agent) : le badge est injecté en JS
// au premier appel plutôt qu'ajouté en dur dans index.dev.html (constrainte de cette session), donc
// idempotent (ne recrée pas le <span> s'il existe déjà) pour être appelable à chaque renderInventory().
function refreshItemTutorialBadge() {
  const tabBtn = document.querySelector('.invModeTab[data-mode="inv"]');
  if (!tabBtn) return;
  let badge = tabBtn.querySelector('.contentNewBadge.itemTutoBadge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'contentNewBadge itemTutoBadge';
    badge.textContent = '1';
    tabBtn.appendChild(badge);
  }
  const pending = itemTutorialActive || itemTutorialQueue.length > 0;
  badge.classList.toggle('show', pending);
}
// FARM_MODES/renderFarmModeBtn/setFarmMode desormais dans combat/ai-mode.js (extrait le
// 2026-07-08, reorganisation par dossiers) -- charge APRES ce fichier, voir index.html.
