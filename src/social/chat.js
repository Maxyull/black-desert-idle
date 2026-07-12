// ---------- chat (mondial/trade/annonce) — encart bas-droite, polling toutes les 5s ----------
// "guilde" est volontairement absent : pas encore de système de guilde en jeu, l'onglet sera
// ajouté quand cette fonctionnalité existera (le canal existe déjà côté base, prêt à l'usage)
const CHAT_CHANNELS = [
  { id:'mondial', icon:'🌍', label:{fr:'Mondial',en:'World'} },
  { id:'trade',   icon:'💱', label:{fr:'Trade',en:'Trade'} },
  // canal dédié à l'anglais (2026-07-06, demande explicite : "ajoute un chat anglais") -- même
  // mécanique que les autres canaux publics, juste séparé pour ne pas noyer "Mondial" (surtout FR)
  { id:'english', icon:'🇬🇧', label:{fr:'Anglais',en:'English'} },
  { id:'annonce', icon:'📢', label:{fr:'Annonce',en:'Announcement'} },
  { id:'modéré',  icon:'🛡️', label:{fr:'Modéré',en:'Moderated'}, staff:true }, // journal des messages supprimés (admin/mods)
];
// persistance (2026-07-08, demande explicite) : canal choisi + replié/déplié survivent à un
// rechargement de page, comme le menu de gauche (voir sideMenuCollapsed)
// replié par défaut sur mobile (voir isMobileViewport, adaptation mobile du 2026-07-05) — le chat
// en 440px de large flottant en bas à droite recouvrirait sinon une bonne partie de l'écran
let chatChannel = 'mondial', chatFolded = isMobileViewport(), chatPollTimer = null;
try { chatChannel = localStorage.getItem('velia-idle-chat-channel') || 'mondial'; } catch(e) {}
try { const v = localStorage.getItem('velia-idle-chat-folded'); if (v !== null) chatFolded = v === '1'; } catch(e) {}
let chatLastRead = {}; // channel -> ISO du dernier message vu (sert au halo "non lu")
let chatUnread = {};   // channel -> true si des messages sont arrivés depuis qu'on ne le regarde plus
let chatLastPingedAt = {}; // channel -> ISO du dernier mention @moi déjà signalée (évite de répéter l'alerte à chaque sondage)
/** @returns {object[]} canaux visibles pour le joueur (masque les canaux staff-only sauf admin/mod). */
function chatVisibleChannels() { return CHAT_CHANNELS.filter(c => !c.staff || isAdmin() || myIsMod); }
/** Reconstruit les onglets de canaux (visibilité, actif, halo non-lu), câble le changement de canal. */
function renderChatTabs() {
  const el = $a('chatTabs'); if (!el) return;
  const chans = chatVisibleChannels();
  if (!chans.some(c => c.id === chatChannel)) chatChannel = 'mondial'; // canal caché → repli
  el.innerHTML = chans.map(c => `<button class="catTab chan-${c.id==='modéré'?'annonce':c.id}${c.id===chatChannel?' active':''}${chatUnread[c.id]?' unread':''}" data-chan="${c.id}">${c.icon} ${c.label[LANG]}</button>`).join('');
  el.querySelectorAll('.catTab').forEach(btn => {
    btn.onclick = () => {
      chatChannel = btn.dataset.chan;
      try { localStorage.setItem('velia-idle-chat-channel', chatChannel); } catch(e) {}
      chatUnread[chatChannel] = false;
      el.querySelectorAll('.catTab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      btn.classList.remove('unread');
      updateChatInputVisibility();
      fetchChatMessages();
    };
  });
}
/** Bascule le chat replié/déplié, persiste le choix (localStorage), rafraîchit les messages et efface l'alerte de ping au dépli. */
function toggleChatFold() {
  chatFolded = !chatFolded;
  try { localStorage.setItem('velia-idle-chat-folded', chatFolded ? '1' : '0'); } catch(e) {}
  $a('chatBody').style.display = chatFolded ? 'none' : '';
  $a('chatFoldBtn').textContent = chatFolded ? '▸' : '▾';
  // déplier = on considère la mention "lue", l'alerte (couleur/mouvement en boucle) s'arrête
  if (!chatFolded) { fetchChatMessages(); $a('chatWidget').classList.remove('pinged'); }
}
/** Affiche/masque la zone de saisie selon le canal (modéré = lecture seule, annonce = admin uniquement) et l'état de connexion, met à jour la note explicative. */
function updateChatInputVisibility() {
  const row = $a('chatInputRow'), note = $a('chatNote');
  if (chatChannel === 'modéré') {
    row.style.display = 'none';
    note.textContent = i18next.t('social:social.chat_note_moderated_log');
  } else if (!currentUser || isGuest()) {
    row.style.display = 'none';
    note.textContent = i18next.t('social:social.chat_note_signin_required');
  } else if (chatChannel === 'annonce' && !isAdmin()) {
    row.style.display = 'none';
    note.textContent = i18next.t('social:social.chat_note_staff_only');
  } else {
    row.style.display = '';
    note.textContent = '';
  }
}
// formatte l'horodatage d'un message : HH:MM si aujourd'hui, sinon JJ/MM HH:MM
/** @param {string} iso - date ISO. @returns {string} "HH:MM" si aujourd'hui, sinon "JJ/MM HH:MM". */
function fmtChatTimestamp(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date();
  const hhmm = d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0');
  const sameDay = d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth() && d.getDate()===now.getDate();
  return sameDay ? hhmm : (d.getDate().toString().padStart(2,'0')+'/'+(d.getMonth()+1).toString().padStart(2,'0')+' '+hhmm);
}
// jours passés explicitement dépliés par le joueur pour relire — le jour le plus récent reste
// toujours déplié par défaut. Barre dorée de séparation entre chaque jour — demande explicite du
// 2026-07-07 : "chaque nouveau jour est séparé d'une jolie barre dorée puis le jour précédent est
// replié, dépliable pour relire le chat"
let chatExpandedDays = new Set();
/** @param {string} iso - date ISO. @returns {string} clé de jour "AAAA-M-J" pour regrouper les messages. */
function dayKeyOf(iso) { const d = new Date(iso); return d.getFullYear()+'-'+d.getMonth()+'-'+d.getDate(); }
/** @param {string} iso - date ISO. @returns {string} libellé de la barre de séparation ("Aujourd'hui"/"Hier"/date complète). */
function fmtDaySeparator(iso) {
  const d = new Date(iso), now = new Date(), yest = new Date(now); yest.setDate(yest.getDate()-1);
  if (dayKeyOf(iso) === dayKeyOf(now.toISOString())) return i18next.t('social:social.chat_day_today');
  if (dayKeyOf(iso) === dayKeyOf(yest.toISOString())) return i18next.t('social:social.chat_day_yesterday');
  return d.toLocaleDateString(LANG==='fr'?'fr-FR':'en-US', { weekday:'long', day:'numeric', month:'long' });
}
/**
 * Reconstruit la liste de messages du canal actif, groupés par jour (seul le dernier jour déplié
 * par défaut, les précédents repliés sous une barre dorée cliquable). Gère badges de rôle, halo
 * "non lu" (sinceTs), surlignage des mentions @moi (déclenche triggerChatPingAttention), et câble
 * la suppression (admin/mod).
 * @param {object[]} msgs - messages du canal, ordre chronologique.
 * @param {?string} sinceTs - horodatage de dernière lecture (messages plus récents = "nouveaux").
 */
function renderChatMessages(msgs, sinceTs) {
  const el = $a('chatMessages'); if (!el) return;
  const canDelete = isAdmin() || myIsMod; // admin ET modérateurs peuvent supprimer
  if (!msgs.length) { el.innerHTML = `<div class="chatEmpty">${i18next.t('social:social.chat_empty')}</div>`; return; }
  // regroupe les messages par jour, dans l'ordre chronologique — seul le DERNIER groupe (le plus
  // récent) est déplié par défaut, les précédents sont repliés sous leur barre dorée
  const dayGroups = [];
  for (const m of msgs) {
    const key = dayKeyOf(m.created_at);
    let g = dayGroups[dayGroups.length-1];
    if (!g || g.key !== key) { g = { key, msgs: [] }; dayGroups.push(g); }
    g.msgs.push(m);
  }
  const lastKey = dayGroups[dayGroups.length-1].key;
  el.innerHTML = dayGroups.map(g => {
    const isLast = g.key === lastKey;
    const expanded = isLast || chatExpandedDays.has(g.key);
    const bar = `<div class="chatDaySep${isLast?' current':''}" data-day="${g.key}">` +
      `<span class="chatDaySepLine"></span><span class="chatDaySepLabel">${fmtDaySeparator(g.msgs[0].created_at)}` +
      `${isLast?'':` (${g.msgs.length}) ${expanded?'▾':'▸'}`}</span><span class="chatDaySepLine"></span></div>`;
    const rows = !expanded ? '' : g.msgs.map(m => {
      // badge de rôle DEVANT le pseudo : ADMIN (or) / MOD (bleu). Le pseudo affiché vient du
      // serveur (profiles.pseudo, jamais l'email) — voir post_chat_message
      const badge = m.role === 'admin' ? '<span class="chatBadge admin">ADMIN</span> '
        : m.role === 'mod' ? '<span class="chatBadge mod">MOD</span> ' : '';
      const del = (canDelete && m.id != null) ? `<button class="chatDelBtn" data-id="${m.id}" title="Supprimer">✕</button>` : '';
      // canal Annonce : seulement le rôle (badge), pas de pseudo — juste le message en rouge
      const pseudoHtml = chatChannel === 'annonce' ? '' :
        `<span class="chatPseudo">${escapeHtml(m.pseudo || (m.role==='admin'?'Admin':i18next.t('social:social.chat_default_pseudo')))}</span> `;
      // halo temporaire sur les messages arrivés depuis la dernière lecture de CE canal —
      // demande explicite : "un halo sur le message que tu n'as pas encore lu"
      const isNew = sinceTs && new Date(m.created_at) > new Date(sinceTs);
      // mention @moi (2026-07-05, demande explicite) : fond distinct + alerte si le message vient
      // d'arriver pendant que je regarde déjà ce canal (le cas "chat replié" est géré ailleurs, voir
      // pollChatUnread/triggerChatPingAttention, car cette fonction ne tourne pas chat replié)
      const pingedMe = myPseudo && m.message.toLowerCase().includes('@'+myPseudo.toLowerCase());
      if (pingedMe && isNew) triggerChatPingAttention();
      return `<div class="chatMsg chan-${chatChannel}${isNew?' newMsg':''}${pingedMe?' pingedMe':''}">${del}` +
        `${badge}${pseudoHtml}<span class="chatText">${highlightMentions(escapeHtml(m.message))}</span>` +
        `<span class="chatTime">${fmtChatTimestamp(m.created_at)}</span></div>`;
    }).join('');
    return bar + rows;
  }).join('');
  el.querySelectorAll('.chatDaySep:not(.current)').forEach(bar => {
    bar.onclick = () => {
      const key = bar.dataset.day;
      if (chatExpandedDays.has(key)) chatExpandedDays.delete(key); else chatExpandedDays.add(key);
      renderChatMessages(msgs, sinceTs);
    };
  });
  el.scrollTop = el.scrollHeight;
  el.querySelectorAll('.chatDelBtn').forEach(btn => {
    btn.onclick = async () => {
      if (!sb) return;
      const { error } = await sb.rpc('delete_chat_message', { p_id: parseInt(btn.dataset.id,10) });
      // remonte l'erreur au lieu de l'avaler silencieusement (aide à diagnostiquer, ex: schéma
      // SQL pas encore exécuté → "function ... does not exist")
      if (error) { $a('chatNote').textContent = i18next.t('social:social.chat_delete_failed', { error: error.message }); return; }
      fetchChatMessages();
    };
  });
}
async function fetchChatMessages() {
  if (!sb || chatFolded) return;
  if (chatChannel === 'modéré') { fetchModeratedLog(); return; }
  const { data, error } = await sb.from('chat_messages').select('id, pseudo, message, role, created_at')
    .eq('channel', chatChannel).order('created_at', { ascending:false }).limit(50);
  if (error) return;
  const msgs = (data||[]).slice().reverse();
  const prevLastRead = chatLastRead[chatChannel]; // avant mise à jour : sert à souligner les nouveaux messages
  renderChatMessages(msgs, prevLastRead);
  if (msgs.length) chatLastRead[chatChannel] = msgs[msgs.length-1].created_at;
  if (chatUnread[chatChannel]) { chatUnread[chatChannel] = false; renderChatTabs(); }
}
// vérifie s'il y a des messages non lus dans les canaux qu'on ne regarde PAS actuellement (ou
// si le chat est replié) : halo sur l'onglet du canal — demande explicite "montrer qu'un message
// n'a pas été lu dans un channel où tu n'es pas"
async function pollChatUnread() {
  if (!sb || !currentUser || isGuest()) return;
  for (const c of chatVisibleChannels()) {
    if (c.id === 'modéré') continue; // pas de notion de "non lu" pour le journal modéré
    if (c.id === chatChannel && !chatFolded) continue; // canal actif et déplié : déjà tenu à jour par fetchChatMessages
    try {
      const { data } = await sb.from('chat_messages').select('message, created_at')
        .eq('channel', c.id).order('created_at', { ascending:false }).limit(1);
      const row = data && data[0];
      const last = row && row.created_at;
      if (!last) continue;
      if (!chatLastRead[c.id]) { chatLastRead[c.id] = last; continue; } // 1ère fois : juste une base, pas un "non lu"
      if (new Date(last) > new Date(chatLastRead[c.id])) {
        chatUnread[c.id] = true;
        // mention @moi arrivée alors que ce canal n'est pas activement suivi (chat replié, ou
        // canal différent) -- demande explicite du 2026-07-05 : alerte visuelle/vibration.
        // chatLastPingedAt évite de rejouer l'alerte à chaque sondage (5s) tant que le joueur
        // n'a pas rouvert le chat (chatLastRead ne bouge pas pendant qu'il reste replié)
        if (myPseudo && row.message && row.message.toLowerCase().includes('@'+myPseudo.toLowerCase())
            && new Date(last) > new Date(chatLastPingedAt[c.id] || 0)) {
          chatLastPingedAt[c.id] = last;
          triggerChatPingAttention();
        }
      }
    } catch (e) {}
  }
  renderChatTabs();
}
// journal "modéré" : messages supprimés (staff uniquement) — on affiche le pseudo, l'UUID de
// l'auteur, le message d'origine et le canal, pour tracer la modération
async function fetchModeratedLog() {
  const el = $a('chatMessages'); if (!el) return;
  const { data, error } = await sb.from('chat_deleted').select('id, channel, author_id, author_pseudo, message, deleted_at')
    .order('deleted_at', { ascending:false }).limit(50);
  if (error) { el.innerHTML = `<div class="chatEmpty">${i18next.t('social:social.chat_mod_access_denied')}</div>`; return; }
  if (!data || !data.length) { el.innerHTML = `<div class="chatEmpty">${i18next.t('social:social.chat_mod_empty')}</div>`; return; }
  el.innerHTML = data.map(m =>
    `<div class="chatMsg chan-annonce modMsg">` +
    `<div class="modTop"><span><span class="chatPseudo">${escapeHtml(m.author_pseudo||'?')}</span> <span class="modChan">[${escapeHtml(m.channel||'')}]</span></span>` +
    `<button class="modRestoreBtn" data-id="${m.id}" title="${i18next.t('social:social.chat_mod_restore_title')}">${i18next.t('social:social.chat_mod_restore_btn')}</button></div>` +
    `<code class="modUuidLine">${m.author_id||''}</code>` +
    `<div class="chatText">${escapeHtml(m.message||'')}</div>` +
    `<div class="modDeletedAt">${i18next.t('social:social.chat_mod_deleted_on', { time: fmtChatTimestamp(m.deleted_at) })}</div></div>`).join('');
  el.scrollTop = 0;
  el.querySelectorAll('.modRestoreBtn').forEach(btn => {
    btn.onclick = async () => {
      if (!sb) return;
      btn.disabled = true;
      const { error } = await sb.rpc('restore_chat_message', { p_deleted_id: parseInt(btn.dataset.id,10) });
      if (error) { $a('chatNote').textContent = i18next.t('social:social.chat_restore_failed', { error: error.message }); btn.disabled = false; return; }
      fetchModeratedLog();
    };
  });
}
async function sendChatMessage() {
  const input = $a('chatInput');
  const val = input.value.trim();
  if (!val || !sb) return;
  input.value = '';
  // on transmet le pseudo affiché dans l'UI (myPseudo) pour que le nom dans le chat corresponde
  // exactement — utile pour les comptes Discord sans pseudo perso défini
  const { error } = await sb.rpc('post_chat_message', { p_channel: chatChannel, p_message: val, p_pseudo: myPseudo || null });
  if (error) { $a('chatNote').textContent = error.message; return; }
  fetchChatMessages();
}
$a('chatSendBtn').onclick = sendChatMessage;

// ---------- mentions @joueur dans le chat (2026-07-05, demande explicite) ----------
// liste des joueurs en ligne, rafraîchie périodiquement — sert à suggérer des mentions et à
// repérer/colorer celles déjà tapées dans un message (voir highlightMentions)
let onlinePlayersCache = [];
async function refreshOnlinePlayersCache() {
  if (!sb || !currentUser || isGuest()) return;
  try {
    const { data } = await sb.rpc('get_online_players');
    onlinePlayersCache = (data||[]).map(r => r.pseudo).filter(Boolean);
  } catch(e) {}
}
setInterval(refreshOnlinePlayersCache, 20000);
refreshOnlinePlayersCache();

let chatMentionActive = false, chatMentionStart = -1;
/** Détecte si le curseur est en train de taper une mention "@..." dans le champ de saisie, affiche/masque la liste de suggestions filtrée sur onlinePlayersCache. */
function updateChatMentionDropdown() {
  const input = $a('chatInput'), list = $a('chatMentionList');
  const val = input.value, pos = input.selectionStart;
  const before = val.slice(0, pos);
  const at = before.lastIndexOf('@');
  // le "@" doit être le début d'un mot (début de message ou précédé d'un espace), et rien entre
  // lui et le curseur ne doit contenir d'espace (sinon on n'est plus en train de taper la mention)
  if (at === -1 || (at > 0 && !/\s/.test(before[at-1])) || /\s/.test(before.slice(at+1))) {
    list.classList.remove('show'); chatMentionActive = false; return;
  }
  const partial = before.slice(at+1).toLowerCase();
  const matches = onlinePlayersCache
    .filter(p => p.toLowerCase() !== (myPseudo||'').toLowerCase() && p.toLowerCase().includes(partial))
    .slice(0, 8);
  if (!matches.length) { list.classList.remove('show'); chatMentionActive = false; return; }
  chatMentionActive = true; chatMentionStart = at;
  list.innerHTML = matches.map((p,i) => `<div class="chatMentionItem${i===0?' active':''}" data-p="${escapeHtml(p)}">${escapeHtml(p)}</div>`).join('');
  list.classList.add('show');
  list.querySelectorAll('.chatMentionItem').forEach(el => { el.onclick = () => applyChatMention(el.dataset.p); });
}
/** @param {string} pseudo - pseudo choisi dans la liste de suggestions. Insère "@pseudo " à la place du "@partiel" en cours de saisie. */
function applyChatMention(pseudo) {
  const input = $a('chatInput');
  const val = input.value, pos = input.selectionStart;
  const before = val.slice(0, chatMentionStart), after = val.slice(pos);
  const inserted = '@' + pseudo + ' ';
  input.value = before + inserted + after;
  const newPos = (before + inserted).length;
  input.focus();
  input.setSelectionRange(newPos, newPos);
  $a('chatMentionList').classList.remove('show');
  chatMentionActive = false;
}
// déplace la surbrillance ↑/↓ dans la liste de suggestions (demande explicite du 2026-07-05)
/** @param {number} delta - +1/-1. Déplace la surbrillance dans la liste de suggestions de mention (boucle). */
function moveChatMentionActive(delta) {
  const items = Array.from($a('chatMentionList').querySelectorAll('.chatMentionItem'));
  if (!items.length) return;
  let idx = items.findIndex(el => el.classList.contains('active'));
  items[idx]?.classList.remove('active');
  idx = (idx + delta + items.length) % items.length;
  items[idx].classList.add('active');
  items[idx].scrollIntoView({ block:'nearest' });
}
$a('chatInput').addEventListener('input', updateChatMentionDropdown);
$a('chatInput').addEventListener('keydown', e => {
  if (chatMentionActive && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    e.preventDefault();
    moveChatMentionActive(e.key === 'ArrowDown' ? 1 : -1);
    return;
  }
  if (chatMentionActive && (e.key === 'Enter' || e.key === 'Tab')) {
    e.preventDefault();
    const active = $a('chatMentionList').querySelector('.chatMentionItem.active') || $a('chatMentionList').querySelector('.chatMentionItem');
    if (active) applyChatMention(active.dataset.p);
    return;
  }
  if (chatMentionActive && e.key === 'Escape') { $a('chatMentionList').classList.remove('show'); chatMentionActive = false; return; }
  if (e.key === 'Enter') sendChatMessage();
});
// colore les mentions @pseudo déjà présentes dans un message (envoyé ou reçu) -- fait correspondre
// les pseudos les plus longs d'abord pour ne pas couper un pseudo qui en contient un plus court
// (ex: "Metal" ne doit pas amputer "@Metal Gear")
/** @param {string} escapedText - texte de message déjà échappé HTML. @returns {string} texte avec les mentions @pseudo surlignées (pseudos multi-mots connus en priorité, pour ne pas couper un pseudo contenant un pseudo plus court). */
function highlightMentions(escapedText) {
  // 1) pseudos multi-mots CONNUS (ex: "Maxyull Test") en priorité -- extraits vers des jetons
  // temporaires (pas encore du HTML) pour que la passe générique ci-dessous ne les retraite pas
  // une 2e fois (ce qui produisait un <span> imbriqué en double)
  const placeholders = [];
  let result = escapedText;
  const multiWord = onlinePlayersCache.filter(n => /\s/.test(n)).sort((a,b) => b.length - a.length);
  for (const name of multiWord) {
    const esc = escapeHtml(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!esc) continue;
    result = result.replace(new RegExp('@' + esc + '(?!\\S)', 'gi'), m => {
      placeholders.push(`<span class="chatMention">${m}</span>`);
      return ` \x00${placeholders.length-1}\x00 `;
    });
  }
  // 2) toute mention @mot restante (2026-07-05, demande explicite : "affiche coloré pour tout
  // ceux qui le voient, pas uniquement l'envoyeur et le receveur") -- volontairement PAS limité
  // aux joueurs actuellement en ligne (onlinePlayersCache), pour rester visible même si la
  // personne mentionnée s'est déconnectée depuis, ou juste après le chargement de la page
  result = result.replace(/@(\S+)/g, (m, word) => `<span class="chatMention">@${word}</span>`);
  // 3) réinjecte les mentions multi-mots à leur place
  result = result.replace(/ ?\x00(\d+)\x00 ?/g, (m, i) => placeholders[+i]);
  return result;
}
// alerte visuelle quand JE suis mentionné et que le chat est replié (demande explicite du
// 2026-07-05 : "couleur/vibration/agrandissement du chat pour faire ouvrir") -- se rejoue à
// chaque nouvelle mention détectée, s'arrête toute seule (voir @keyframes chatPingAttention)
/** Rejoue l'animation d'alerte visuelle (+ vibration mobile si dispo) sur le widget de chat replié, quand le joueur est mentionné. */
function triggerChatPingAttention() {
  const w = $a('chatWidget'); if (!w) return;
  w.classList.remove('pinged'); void w.offsetWidth; // relance l'animation même si déjà en cours
  w.classList.add('pinged');
  if (navigator.vibrate) { try { navigator.vibrate([120,60,120]); } catch(e) {} }
}
renderChatTabs();
updateChatInputVisibility();
// applique l'état replié/déplié restauré depuis localStorage (voir déclaration de chatFolded)
$a('chatBody').style.display = chatFolded ? 'none' : '';
$a('chatFoldBtn').textContent = chatFolded ? '▸' : '▾';
setInterval(fetchChatMessages, 5000);
setInterval(pollChatUnread, 5000);
pollChatUnread();
