// ============================================================
// Page "Joueurs" unifiée — 6e fichier React du projet (createElement pur, sans JSX ni bundler,
// même convention que admin-dashboard-react.js et les 4 autres exceptions).
//
// Refonte d'après bdi-admin-ux.md §2, qui est aussi le "player inspector" de
// bdi-admin-monitoring-plan.md §10. AVANT : cinq entrées de sidebar (Liste · Joueur précis ·
// Sanctions · Rôles · Reconnexion) pour UN SEUL objet mental, et bannir un joueur qu'on venait de
// regarder coûtait 4 clics à travers 3 sections, parce que les ACTIONS étaient séparées des
// DONNÉES. APRÈS : une recherche, une liste, une fiche — et les actions sont SUR la fiche.
//
//   - sans sélection : la liste, filtrable (tous / en ligne / bannis / staff) et triable
//   - avec sélection : la fiche du joueur, qui porte ban / débannissement / rôles / reset
//   - "Sanctions" devient un FILTRE de la liste, plus une section (doc §2)
//   - "Rôles" est absorbé par la fiche ; le filtre "staff" remplace la liste dédiée
//   - "Reconnexion" est un AGRÉGAT (pas du par-joueur) : il n'a pas sa place sur une fiche, il
//     reste donc consultable en bloc dépliable sous la liste plutôt que d'être perdu.
//
// Réutilise TEL QUEL l'existant d'admin-players.js : BAN_REASONS/BAN_DURATIONS, canBanUuid (garde
// anti-auto-ban), renderAdminScreenshotHtml, fmtAdmPlaytime, providerInfo. Aucune RPC réécrite.
// Charge APRÈS admin-panel.js et admin-players.js — voir index.dev.html.
// ============================================================

const admPH = React.createElement;

/** @param {number} n @returns {string} nombre formaté selon la langue active. */
function admPNum(n) { return Number(n || 0).toLocaleString(LANG === 'fr' ? 'fr-FR' : 'en-US'); }
/** @param {?string} iso @returns {string} date/heure locale, tiret si absente. */
function admPDate(iso) { return iso ? new Date(iso).toLocaleString(LANG === 'fr' ? 'fr-FR' : 'en-US') : '—'; }

// ---------- filtres de la liste (remplacent les anciennes sections Sanctions et Rôles) ----------
const ADM_P_FILTERS = [
  { id: 'all',    label: () => i18next.t('admin:admin.players.filter_all') },
  { id: 'online', label: () => i18next.t('admin:admin.players.filter_online') },
  { id: 'banned', label: () => i18next.t('admin:admin.players.filter_banned') },
  { id: 'staff',  label: () => i18next.t('admin:admin.players.filter_staff') },
];
const ADM_P_SORTS = [
  { id: 'last_seen', label: () => i18next.t('admin:admin.players.sort_last_seen'), cmp: (a,b) => new Date(b.last_seen||0) - new Date(a.last_seen||0) },
  { id: 'silver',    label: () => i18next.t('admin:admin.players.sort_silver'),    cmp: (a,b) => Number(b.silver||0) - Number(a.silver||0) },
  { id: 'gs',        label: () => i18next.t('admin:admin.players.sort_gs'),        cmp: (a,b) => Number(b.gearscore||0) - Number(a.gearscore||0) },
  { id: 'lvl',       label: () => i18next.t('admin:admin.players.sort_lvl'),       cmp: (a,b) => Number(b.lvl||0) - Number(a.lvl||0) },
];

// ---------- fiche joueur : bloc dépliable générique ----------
/** @returns {React.Element} section repliable de la fiche (inventaire, historique...). */
function AdmFold({ title, open, onToggle, children }) {
  return admPH('div', { className: 'admFold' },
    admPH('button', { className: 'admFoldHead', onClick: onToggle },
      admPH('span', null, title),
      admPH('span', { className: 'admFoldChevron' }, open ? '▾' : '▸')),
    open && admPH('div', { className: 'admFoldBody' }, children)
  );
}

// ---------- fiche joueur ----------
/** @param {object} p - ligne de admin_list_players. Fiche complète + actions (ban/rôle/reset). */
function AdmPlayerCard({ player, ban, roles, onBack, onChanged }) {
  const [save, setSave] = React.useState(null);
  const [openInv, setOpenInv] = React.useState(false);
  const [busy, setBusy] = React.useState('');
  const [msg, setMsg] = React.useState(null);
  const [reason, setReason] = React.useState(BAN_REASONS[0].id);
  const [hours, setHours] = React.useState(24);
  const uuid = player.user_id;

  // l'inventaire n'est chargé qu'au dépliage : une sauvegarde complète est lourde et n'intéresse
  // que si on l'ouvre vraiment (même logique de chargement paresseux que le reste du panneau)
  const loadSave = React.useCallback(async () => {
    if (save || !sb) return;
    const { data } = await sb.rpc('admin_get_player_save', { p_user_id: uuid });
    setSave(data || {});
  }, [uuid, save]);

  const act = async (kind) => {
    if (!sb) return;
    // garde anti-auto-ban réutilisée telle quelle : elle est PURE et déjà testée unitairement
    if (kind === 'ban' && !canBanUuid(uuid, currentUser && currentUser.id)) {
      setMsg(i18next.t('admin:admin.players.cannot_self_ban')); return;
    }
    const confirms = {
      ban: () => i18next.t('admin:admin.players.confirm_ban', { name: player.display_name }),
      unban: () => i18next.t('admin:admin.players.confirm_unban', { name: player.display_name }),
      reset: () => i18next.t('admin:admin.players.confirm_reset', { name: player.display_name }),
    };
    if (confirms[kind] && !confirm(confirms[kind]())) return;
    setBusy(kind); setMsg(null);
    let error = null;
    if (kind === 'ban') {
      const reasonLabel = (BAN_REASONS.find(r => r.id === reason) || BAN_REASONS[0]).label[LANG];
      ({ error } = await sb.rpc('admin_ban_player', { p_user_id: uuid, p_duration_hours: hours, p_reason: reasonLabel }));
      if (!error) logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a banni \`${uuid}\` (${reasonLabel}, ${hours}h)`, 0xc05545);
    } else if (kind === 'unban') {
      ({ error } = await sb.rpc('admin_unban_player', { p_user_id: uuid }));
      if (!error) logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a levé le ban de \`${uuid}\``, 0x9cc9e8);
    } else if (kind === 'reset') {
      ({ error } = await sb.rpc('admin_reset_account_by_uuid', {
        p_user_id: uuid,
        p_title_fr: '🔄 Ton compte a été réinitialisé', p_title_en: '🔄 Your account has been reset',
        p_body_fr: 'Un membre du staff a réinitialisé ton compte (silver, équipement, niveau, sac).<br><br>Si tu penses qu\'il s\'agit d\'une erreur, contacte-nous sur Discord.',
        p_body_en: 'A staff member has reset your account (silver, gear, level, bag).<br><br>If you believe this is a mistake, please reach out to us on Discord.',
      }));
      if (!error) logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a réinitialisé le compte \`${uuid}\``, 0xc05545);
    } else {
      // rôles : mod/tester, ajout ou retrait selon l'état courant
      const rpc = kind;
      ({ error } = await sb.rpc(rpc, { p_user_id: uuid }));
      if (!error) logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** — ${rpc} sur \`${uuid}\``, 0x9cc9e8);
    }
    setBusy('');
    if (error) { setMsg(error.message); return; }
    setMsg(i18next.t('admin:admin.players.action_done'));
    onChanged();
  };

  const prov = providerInfo(player.provider);
  const isMod = !!(roles && roles.mod), isTester = !!(roles && roles.tester);
  return admPH('div', { className: 'admPCard' },
    admPH('button', { className: 'admPBack', onClick: onBack }, '← ' + i18next.t('admin:admin.players.back_to_list')),
    admPH('div', { className: 'admPHead' },
      admPH('span', { className: 'admPName' }, player.display_name || '—'),
      admPH('span', { className: 'admPDot ' + (player.online ? 'on' : 'off') }, player.online ? '🟢' : '⚪'),
      admPH('span', { className: 'admPMeta' }, prov.icon + ' ' + prov.label[LANG]),
      ban && admPH('span', { className: 'admPBanTag' }, '🚫 ' + i18next.t('admin:admin.players.banned_until', { date: admPDate(ban.banned_until) })),
      isMod && admPH('span', { className: 'admPRoleTag' }, '🛡️ MOD'),
      isTester && admPH('span', { className: 'admPRoleTag' }, '🧪 ' + i18next.t('admin:admin.players.tester')),
      admPH('code', { className: 'admPUuid', title: uuid }, (uuid || '').slice(0, 8) + '…')
    ),
    admPH('div', { className: 'admPStats' },
      [['💰 Silver', admPNum(player.silver)], ['⚔️ GS', admPNum(player.gearscore)],
       ['🎖️ ' + i18next.t('admin:admin.players.level'), admPNum(player.lvl)],
       ['🗡️ PA', admPNum(Math.round(player.ap||0))], ['🛡️ PD', admPNum(Math.round(player.dp||0))],
       ['⚡ kpm', admPNum(Math.round(player.best_kpm||0))],
       ['🕒 ' + i18next.t('admin:admin.players.last_seen'), admPDate(player.last_seen)],
      ].map(([l, v], i) => admPH('div', { key: i, className: 'admPStat' },
        admPH('div', { className: 'admPStatLbl' }, l), admPH('div', { className: 'admPStatVal' }, v)))
    ),
    admPH(AdmFold, {
      title: '🎒 ' + i18next.t('admin:admin.players.fold_inventory'),
      open: openInv,
      onToggle: () => { setOpenInv(o => !o); if (!openInv) loadSave(); },
    }, save
      ? admPH('div', { dangerouslySetInnerHTML: { __html: renderAdminScreenshotHtml(save) } })
      : admPH('div', { className: 'admEmpty' }, i18next.t('admin:admin.common.loading'))),
    // ── actions : elles sont ICI, sur la fiche, et non dans une section séparée (doc UX §3) ──
    admPH('div', { className: 'admPActions' },
      admPH('div', { className: 'admPActionsTitle' }, '⚖️ ' + i18next.t('admin:admin.players.sanctions_and_role')),
      admPH('div', { className: 'admPActionRow' },
        admPH('select', { value: reason, onChange: e => setReason(e.target.value), className: 'admPSel' },
          BAN_REASONS.map(r => admPH('option', { key: r.id, value: r.id }, r.label[LANG]))),
        admPH('select', { value: hours, onChange: e => setHours(Number(e.target.value)), className: 'admPSel' },
          BAN_DURATIONS.map(d => admPH('option', { key: d.hours, value: d.hours }, d.label[LANG]))),
        admPH('button', { className: 'admPBtn danger', disabled: busy === 'ban', onClick: () => act('ban') },
          busy === 'ban' ? '…' : '🚫 ' + i18next.t('admin:admin.players.ban_btn')),
        ban && admPH('button', { className: 'admPBtn', disabled: busy === 'unban', onClick: () => act('unban') },
          '✅ ' + i18next.t('admin:admin.players.unban_btn'))
      ),
      admPH('div', { className: 'admPActionRow' },
        admPH('button', { className: 'admPBtn', onClick: () => act(isMod ? 'admin_remove_mod' : 'admin_add_mod') },
          (isMod ? '➖' : '➕') + ' 🛡️ MOD'),
        admPH('button', { className: 'admPBtn', onClick: () => act(isTester ? 'admin_remove_tester' : 'admin_add_tester') },
          (isTester ? '➖' : '➕') + ' 🧪 ' + i18next.t('admin:admin.players.tester')),
        admPH('button', { className: 'admPBtn danger', disabled: busy === 'reset', onClick: () => act('reset') },
          '🔄 ' + i18next.t('admin:admin.players.reset_btn'))
      ),
      msg && admPH('div', { className: 'admHint' }, msg)
    )
  );
}

// ---------- agrégat Reconnexion (absorbé sous la liste, pas perdu) ----------
/** @returns {React.Element} bloc dépliable des stats de reconnexion (agrégat, pas du par-joueur). */
function AdmReconnectFold() {
  const [open, setOpen] = React.useState(false);
  const [html, setHtml] = React.useState(null);
  React.useEffect(() => {
    if (!open || html !== null || !sb) return;
    sb.rpc('admin_afk_sessions_summary').then(({ data, error }) => {
      if (error || !data || !data[0]) { setHtml(`<div class="admHint">${escapeHtml(error ? error.message : 'no data')}</div>`); return; }
      const s = data[0], nf = n => admPNum(Math.round(n || 0));
      setHtml(`<div class="admStatTiles">
        <div class="admStatTile"><div class="astLbl">${escapeHtml(i18next.t('admin:admin.reconnect.logged_sessions'))}</div><div class="astVal">${nf(s.total_sessions)}</div></div>
        <div class="admStatTile"><div class="astLbl">${escapeHtml(i18next.t('admin:admin.reconnect.players_involved'))}</div><div class="astVal">${nf(s.total_players)}</div></div>
        <div class="admStatTile"><div class="astLbl">${escapeHtml(i18next.t('admin:admin.reconnect.total_silver_recovered'))}</div><div class="astVal">${nf(s.total_silver)}</div></div>
        <div class="admStatTile"><div class="astLbl">${escapeHtml(i18next.t('admin:admin.reconnect.avg_per_session'))}</div><div class="astVal">${nf(s.avg_silver)}</div></div>
      </div>`);
    });
  }, [open, html]);
  return admPH(AdmFold, { title: '🔄 ' + i18next.t('admin:admin.reconnect.title'), open, onToggle: () => setOpen(o => !o) },
    html === null ? admPH('div', { className: 'admEmpty' }, i18next.t('admin:admin.common.loading'))
                  : admPH('div', { dangerouslySetInnerHTML: { __html: html } }));
}

// ---------- racine ----------
/** Page Joueurs : recherche + filtres + liste triable, ou fiche du joueur sélectionné. */
function AdmPlayersPage() {
  const [rows, setRows] = React.useState(null);
  const [bans, setBans] = React.useState({});
  const [roles, setRoles] = React.useState({});
  const [q, setQ] = React.useState('');
  const [filter, setFilter] = React.useState('all');
  const [sort, setSort] = React.useState('last_seen');
  const [sel, setSel] = React.useState(null);

  const load = React.useCallback(async () => {
    if (!sb) return;
    const [players, banList, mods, testers] = await Promise.all([
      sb.rpc('admin_list_players'), sb.rpc('admin_list_bans'),
      sb.rpc('admin_list_mods'), sb.rpc('admin_list_testers'),
    ]);
    const b = {}; (banList.data || []).forEach(r => { b[r.user_id] = r; });
    const rl = {};
    (mods.data || []).forEach(r => { rl[r.user_id] = Object.assign({}, rl[r.user_id], { mod: true }); });
    (testers.data || []).forEach(r => { rl[r.user_id] = Object.assign({}, rl[r.user_id], { tester: true }); });
    setBans(b); setRoles(rl); setRows(players.data || []);
  }, []);
  React.useEffect(() => { load(); }, [load]);

  if (rows === null) return admPH('div', { className: 'admEmpty' }, i18next.t('admin:admin.common.loading'));

  if (sel) {
    const p = rows.find(r => r.user_id === sel);
    if (p) return admPH(AdmPlayerCard, {
      player: p, ban: bans[sel], roles: roles[sel],
      onBack: () => setSel(null), onChanged: load,
    });
  }

  const needle = q.trim().toLowerCase();
  const list = rows
    .filter(r => {
      if (filter === 'online' && !r.online) return false;
      if (filter === 'banned' && !bans[r.user_id]) return false;
      if (filter === 'staff' && !roles[r.user_id]) return false;
      if (!needle) return true;
      // recherche sur pseudo OU UUID (l'e-mail n'est pas exposé par admin_list_players)
      return (r.display_name || '').toLowerCase().includes(needle) || (r.user_id || '').toLowerCase().includes(needle);
    })
    .sort((ADM_P_SORTS.find(s => s.id === sort) || ADM_P_SORTS[0]).cmp);

  return admPH('div', { className: 'admPPage' },
    admPH('input', {
      className: 'admPSearch', value: q, autoFocus: true,
      placeholder: i18next.t('admin:admin.players.search_placeholder'),
      onChange: e => setQ(e.target.value),
    }),
    admPH('div', { className: 'admPBar' },
      admPH('div', { className: 'admPChips' }, ADM_P_FILTERS.map(f =>
        admPH('button', { key: f.id, className: 'admPChip' + (filter === f.id ? ' on' : ''), onClick: () => setFilter(f.id) },
          f.label() + (f.id === 'banned' && Object.keys(bans).length ? ' (' + Object.keys(bans).length + ')' : '')))),
      admPH('select', { className: 'admPSel', value: sort, onChange: e => setSort(e.target.value) },
        ADM_P_SORTS.map(s => admPH('option', { key: s.id, value: s.id }, s.label())))
    ),
    admPH('div', { className: 'admPCount' }, i18next.t('admin:admin.players.count', { count: list.length })),
    list.length === 0
      ? admPH('div', { className: 'admEmpty' }, i18next.t('admin:admin.players.none'))
      : admPH('table', { className: 'admTable admPTable' },
          admPH('thead', null, admPH('tr', null,
            [i18next.t('admin:admin.players.col_player'), 'Silver', 'GS',
             i18next.t('admin:admin.players.col_level'), i18next.t('admin:admin.players.col_last_seen')]
              .map((h, i) => admPH('th', { key: i }, h)))),
          admPH('tbody', null, list.map(r => admPH('tr', {
            key: r.user_id, className: 'admPlayerRow', onClick: () => setSel(r.user_id),
          },
            admPH('td', null,
              (r.online ? '🟢 ' : '') + (r.display_name || '—'),
              bans[r.user_id] && admPH('span', { className: 'admPBanTag mini' }, '🚫'),
              roles[r.user_id] && roles[r.user_id].mod && admPH('span', { className: 'admPRoleTag mini' }, '🛡️'),
              roles[r.user_id] && roles[r.user_id].tester && admPH('span', { className: 'admPRoleTag mini' }, '🧪')),
            admPH('td', null, admPNum(r.silver)),
            admPH('td', null, admPNum(r.gearscore)),
            admPH('td', null, admPNum(r.lvl)),
            admPH('td', { style: { fontSize: '10px' } }, admPDate(r.last_seen))
          )))
        ),
    admPH(AdmReconnectFold)
  );
}

let admPlayersRoot = null;
/** @param {HTMLElement} el. Monte la page Joueurs unifiée (recherche + liste + fiche). */
function renderAdminPlayersUnified(el) {
  if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
    // repli : sans React on garde l'ancienne liste vanilla plutôt qu'un écran blanc
    if (typeof renderAdminPlayerList === 'function') return renderAdminPlayerList(el);
    el.innerHTML = `<div class="admHint">React indisponible</div>`;
    return;
  }
  el.innerHTML = '<div id="admPlayersReact"></div>';
  admPlayersRoot = ReactDOM.createRoot(el.querySelector('#admPlayersReact'));
  admPlayersRoot.render(admPH(AdmPlayersPage));
}
