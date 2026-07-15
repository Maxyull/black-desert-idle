// ==================== NOTES DE VERSION (React) ====================
// 4e fichier du projet à utiliser React (React.createElement pur, sans JSX ni bundler -- voir
// CLAUDE.md §7, exception documentée pour ce fichier précis, même famille que
// boss-wheel-react.js/reconnect-modal-react.js/compendium-react.js). Port de la maquette fournie
// par l'utilisateur (patch-notes-system.jsx + patch-notes-pipeline.md, "comme la maquette") --
// remplace ENTIÈREMENT l'affichage de renderPatchNotesPanel()/renderPatchEntryHtml()
// (backend/game-supabase.js, gardées comme repli si React est indisponible, même pattern que
// Compendium/modal de reconnexion).
//
// Données réelles réutilisées telles quelles (aucune donnée de démo) : PATCH_NOTES (append-only,
// meta/patch-notes-data.js), PATCH_CATS/PATCH_SUBCATS(_EN)/PATCH_PLATFORMS/PATCH_NATURE/
// PATCH_SEVERITY (game-supabase.js) pour les tags, readPatches/seenThisSession/commitPatchRead/
// unreadPatchCount()/computePatchPages()/patchPageStart pour le suivi de lecture + la pagination
// déjà réels et testés -- ce fichier ne fait QUE le rendu visuel + karma/commentaires/recherche/
// filtre/vue-controverse, jamais une 2e source de vérité pour "lu"/pagination.
//
// entry_id STABLE pour le vote/commentaire : "{version}-{index dans p[LANG]}" -- voir
// meta/README.md pour la contrainte (ne jamais réordonner/insérer une ligne au milieu d'un
// tableau déjà publié).
//
// Non repris de la maquette (périmètre volontaire) : toggle de langue dédié (LANG est déjà global
// au jeu entier, un 2e sélecteur local serait incohérent), sidebar de commentaires flottante
// (remplacée par un expand inline sous la ligne, plus simple, même information).
//
// Mini-panneau de modération (2026-07-11, demande explicite : "lié badge admin a petit panel admin
// pour supprimer message") -- le badge "Admin" est un vrai bouton qui ouvre PneAdminReportsPanel
// (signalements en attente + suppression directe), en plus de la section admin dédiée déjà
// existante (src/admin/admin-panel.js:renderAdminPatchNotesModeration, gardée pour la vue complète/
// les commentaires déjà retirés/auto-masqués) -- ce mini-panneau ne fait QUE les signalements en
// attente, pas de duplication de la liste "retirés" ni de restauration.

const PNE_V = {
  bg: '#0e1422', card: '#131a29', border: '#263049', border2: '#3a4665',
  gold: '#d4a955', gold2: '#e8a355', pink: '#e8698f', green: '#6fdc6f', blue: '#7ea6ff',
  red: '#c0503c', red2: '#e08070', cream: '#f0e8d0', textMain: '#c7d0e6', text2: '#aab4d4',
  text3: '#8a95b3', muted: '#5c6785', muted2: '#4a5674', italic: '#7c8aa8',
};
const PNE_BASE_FONT = { fontFamily: "'Inter', system-ui, sans-serif" };
const pneH = React.createElement;

let patchKarmaCache = {};   // entry_id -> score (aussi lu par le tri "controverse")
let patchMyVoteCache = {};  // entry_id -> -1|1

// filtre anti-insulte client -- UNIQUEMENT un garde-fou UX (retour immédiat sans aller-retour
// réseau) : le vrai blocage non contournable vit côté serveur (add_patch_note_comment, voir
// supabase/migrations/20260710140000_patch_notes_votes_comments.sql) -- même distinction que le
// pipeline doc §8 ("ça ne suffit jamais en prod... le vrai garde-fou doit vivre côté serveur").
const PNE_BANNED_WORDS_CLIENT = ['idiot', 'debile', 'nul', 'connard', 'stupide', 'abruti', 'merde'];
/** @param {string} text. @returns {boolean} vrai si le texte contient un mot de la liste anti-insulte client (garde-fou UX uniquement, le vrai blocage vit côté serveur). */
function pneContainsBannedWord(text) {
  const normalized = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return PNE_BANNED_WORDS_CLIENT.some(w => normalized.includes(w));
}

// entrées à plat de la page courante -- une entrée par LIGNE (pas groupée par catégorie comme
// l'ancien panneau HTML, chaque ligne porte sa propre carte comme dans la maquette), avec son
// entry_id stable et toutes les métadonnées optionnelles déjà réelles du jeu.
/** @param {object[]} entries - versions de PATCH_NOTES pour la page courante. @param {number} pageStart - index absolu de la première version de la page. @returns {object[]} entrées à plat, une par ligne (entryId stable = version + index dans p[LANG]). */
function pneFlattenPage(entries, pageStart) {
  const out = [];
  entries.forEach((p, k) => {
    (p[LANG] || []).forEach((line, idx) => {
      out.push({ version: p, absIdx: pageStart + k, entryId: p.v + '-' + idx, line });
    });
  });
  return out;
}

// horodatage relatif (2026-07-11, demande explicite "fiare un horodatage reel maintenant et
// rétroactif") -- "réel" au sens du pipeline doc : à l'instant/il y a Xmin/Xh/Xj, calculé à partir
// de `created_at` déjà stocké -- fonctionne aussi bien pour un commentaire tout juste posté
// ("maintenant") que pour un commentaire ancien déjà en base ("rétroactif", aucune donnée à migrer,
// c'est une fonction pure du temps écoulé). Au-delà d'une semaine, repli sur fmtNotifTime() (date
// exacte), même limite que le reste du jeu (notifications-quests.js).
/** @param {number} ts - timestamp ms. @returns {string} horodatage relatif ("à l'instant"/"il y a Xmin/Xh/Xj"), repli sur fmtNotifTime() (date exacte) au-delà d'une semaine. */
function pneRelativeTime(ts) {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return i18next.t('progression:progression.patch_notes.time_just_now');
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return i18next.t('progression:progression.patch_notes.time_minutes_ago', { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return i18next.t('progression:progression.patch_notes.time_hours_ago', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return i18next.t('progression:progression.patch_notes.time_days_ago', { count: days });
  return typeof fmtNotifTime === 'function' ? fmtNotifTime(ts) : new Date(ts).toLocaleDateString();
}

// mini-panneau de modération (2026-07-11, demande explicite : "lié badge admin a petit panel admin
// pour supprimer message") -- ouvert en cliquant le badge "Admin", liste les signalements en
// attente (admin_patch_note_pending_reports(), déjà utilisée par la section admin dédiée) et
// permet de supprimer directement (remove_patch_note_comment(), même RPC que le fil de
// commentaires) sans quitter le panneau des notes de version.
/** Composant React — mini-panneau de modération ouvert depuis le badge "Admin" : liste les signalements en attente et permet de supprimer un commentaire directement. */
function PneAdminReportsPanel(props) {
  const [rows, setRows] = React.useState(null);
  const load = React.useCallback(async () => {
    if (!sb) { setRows([]); return; }
    const { data } = await sb.rpc('admin_patch_note_pending_reports');
    setRows(data || []);
  }, []);
  React.useEffect(() => { load(); }, [load]);
  async function del(id) { if (!sb) return; await sb.rpc('remove_patch_note_comment', { p_comment_id: id }); load(); }
  return pneH('div', { style: { margin: '0 16px 10px', background: PNE_V.bg, border: `1px solid ${PNE_V.gold}55`, borderRadius: 6, padding: 8 } },
    pneH('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 } },
      pneH('span', { style: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em', color: PNE_V.gold } }, i18next.t('progression:progression.patch_notes.admin_reports_title')),
      pneH('button', { className: 'pneBtn', onClick: props.onClose, 'aria-label': i18next.t('progression:progression.patch_notes.close_aria'), style: { background: 'none', border: 'none', color: PNE_V.muted, cursor: 'pointer', fontSize: 12 } }, '✕')),
    rows === null ? pneH('p', { style: { fontSize: 10.5, color: PNE_V.muted, fontStyle: 'italic', margin: 0 } }, i18next.t('progression:progression.patch_notes.loading')) :
      rows.length === 0 ? pneH('p', { style: { fontSize: 10.5, color: PNE_V.muted2, fontStyle: 'italic', margin: 0 } }, i18next.t('progression:progression.patch_notes.admin_reports_empty')) :
        pneH('div', { style: { display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' } },
          rows.map(r => pneH('div', { key: r.comment_id, style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 } },
            pneH('p', { style: { fontSize: 10, color: PNE_V.text2, margin: 0, wordBreak: 'break-word', flex: 1 } },
              pneH('span', { style: { fontWeight: 600, color: PNE_V.blue } }, r.author), ' · ', r.entry_id,
              pneH('span', { style: { color: PNE_V.red2, marginLeft: 6 } }, '🚩 ' + r.report_count),
              pneH('br'), r.text),
            pneH('button', { className: 'pneBtn', onClick: () => del(r.comment_id), title: i18next.t('progression:progression.patch_notes.delete_title'), style: { background: 'none', border: 'none', color: PNE_V.red, cursor: 'pointer', fontSize: 11, flexShrink: 0 } }, '🗑')))));
}

/** Composant React — badge de vote karma (−/score/+), boutons désactivés si non connecté. */
function PneVoteBadge(props) {
  const loggedIn = typeof currentUser !== 'undefined' && !!currentUser;
  return pneH('div', { style: { display: 'flex', alignItems: 'center', gap: 2, borderRadius: 4, border: `1px solid ${PNE_V.border2}`, padding: '1px 4px', flexShrink: 0 } },
    pneH('button', { className: 'pneBtn', onClick: () => props.onVote(-1), disabled: !loggedIn, 'aria-label': 'Downvote',
      style: { width: 18, height: 18, border: 'none', background: 'none', cursor: loggedIn ? 'pointer' : 'default', color: props.myVote === -1 ? PNE_V.blue : PNE_V.border2, fontSize: 12 } }, '−'),
    pneH('span', { style: { fontSize: 10, fontWeight: 700, width: 22, textAlign: 'center', color: props.score > 0 ? PNE_V.gold2 : props.score < 0 ? PNE_V.blue : PNE_V.muted } }, props.score),
    pneH('button', { className: 'pneBtn', onClick: () => props.onVote(1), disabled: !loggedIn, 'aria-label': 'Upvote',
      style: { width: 18, height: 18, border: 'none', background: 'none', cursor: loggedIn ? 'pointer' : 'default', color: props.myVote === 1 ? PNE_V.gold2 : PNE_V.border2, fontSize: 12 } }, '+'));
}

/** Composant React — fil de commentaires d'une entrée de patch note (chargement, envoi avec filtre anti-insulte + rate limit serveur, suppression, signalement). */
function PneCommentThread(props) {
  const [comments, setComments] = React.useState(null);
  const [draft, setDraft] = React.useState('');
  const [draftError, setDraftError] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const loggedIn = typeof currentUser !== 'undefined' && !!currentUser;
  const isStaff = (typeof isAdmin === 'function' && isAdmin()) || (typeof myIsMod !== 'undefined' && myIsMod);

  const load = React.useCallback(async () => {
    if (!sb) { setComments([]); return; }
    const { data } = await sb.from('patch_note_comments').select('id,user_id,author,created_at,text')
      .eq('entry_id', props.entryId).eq('status', 'visible').order('created_at', { ascending: true });
    setComments(data || []);
  }, [props.entryId]);
  React.useEffect(() => { load(); }, [load]);

  async function submit() {
    const text = draft.trim();
    if (!text || !loggedIn || !sb || busy) return;
    if (pneContainsBannedWord(text)) { setDraftError('content'); return; }
    setBusy(true);
    try {
      // bug corrigé (2026-07-11) : supabase-js RESOUT {data,error} sur une exception SQL levée par
      // la RPC (rate_limited/contenu_inapproprie), il ne REJETTE PAS la promesse -- le try/catch
      // seul ne voyait donc jamais ces erreurs (le blocage anti-insulte serveur était déjà muet
      // silencieusement avant l'ajout du rate limiting). Il faut lire `error` explicitement.
      const { error } = await sb.rpc('add_patch_note_comment', { p_entry_id: props.entryId, p_text: text });
      if (error) { setDraftError(error.message && error.message.indexOf('rate_limited') !== -1 ? 'rate' : 'content'); }
      else { setDraft(''); setDraftError(false); await load(); }
    }
    catch (e) { setDraftError('content'); }
    finally { setBusy(false); }
  }
  async function remove(id) { if (!sb) return; await sb.rpc('remove_patch_note_comment', { p_comment_id: id }); load(); }
  async function report(id) { if (!sb) return; try { await sb.rpc('report_patch_note_comment', { p_comment_id: id }); } catch (e) {} }

  return pneH('div', { style: { background: PNE_V.bg, border: `1px solid ${PNE_V.border}`, borderRadius: 6, padding: 8, marginTop: 6 } },
    comments === null ? pneH('p', { style: { fontSize: 10.5, color: PNE_V.muted, fontStyle: 'italic', margin: 0 } }, i18next.t('progression:progression.patch_notes.loading')) :
      pneH('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
        comments.length === 0 ? pneH('p', { style: { fontSize: 10.5, color: PNE_V.muted2, fontStyle: 'italic', margin: 0 } }, i18next.t('progression:progression.patch_notes.no_comments')) :
          comments.map(c => {
            const mine = loggedIn && c.user_id === currentUser.id;
            return pneH('div', { key: c.id, style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 } },
              pneH('p', { style: { fontSize: 10.5, color: PNE_V.text2, margin: 0, wordBreak: 'break-word' } },
                pneH('span', { style: { fontWeight: 600, color: mine ? PNE_V.gold2 : PNE_V.blue } }, c.author), ' ',
                // horodatage relatif réel (2026-07-11, demande explicite "fiare un horodatage reel
                // maintenant et rétroactif") -- voir pneRelativeTime() en tête de fichier.
                pneH('span', { style: { color: PNE_V.muted } }, pneRelativeTime(new Date(c.created_at).getTime())),
                pneH('br'), c.text),
              pneH('div', { style: { display: 'flex', gap: 4, flexShrink: 0 } },
                !mine ? pneH('button', { className: 'pneBtn', onClick: () => report(c.id), title: i18next.t('progression:progression.patch_notes.report_title'), style: { background: 'none', border: 'none', color: PNE_V.muted, cursor: 'pointer', fontSize: 10 } }, '🚩') : null,
                (mine || isStaff) ? pneH('button', { className: 'pneBtn', onClick: () => remove(c.id), title: i18next.t('progression:progression.patch_notes.delete_title'), style: { background: 'none', border: 'none', color: mine ? PNE_V.muted2 : PNE_V.red, cursor: 'pointer', fontSize: 10 } }, '🗑') : null));
          })),
    loggedIn ? pneH('div', { style: { marginTop: 6 } },
      pneH('div', { style: { display: 'flex', gap: 4 } },
        pneH('input', {
          value: draft, onChange: e => { setDraft(e.target.value); setDraftError(false); }, onKeyDown: e => e.key === 'Enter' && submit(),
          placeholder: i18next.t('progression:progression.patch_notes.comment_placeholder'), disabled: busy,
          style: { flex: 1, fontSize: 10.5, padding: '4px 6px', borderRadius: 4, border: `1px solid ${draftError ? PNE_V.red : PNE_V.border}`, background: PNE_V.card, color: PNE_V.textMain, outline: 'none' },
        }),
        pneH('button', { className: 'pneBtn', onClick: submit, disabled: busy, style: { fontSize: 10.5, border: `1px solid ${PNE_V.border2}`, background: 'none', color: PNE_V.blue, borderRadius: 4, padding: '2px 8px', cursor: 'pointer' } }, '➤')),
      draftError ? pneH('p', { style: { fontSize: 9.5, color: PNE_V.red2, margin: '4px 0 0' } },
        draftError === 'rate'
          ? i18next.t('progression:progression.patch_notes.rate_limited_error')
          : i18next.t('progression:progression.patch_notes.content_blocked_error')) : null)
      : pneH('p', { style: { fontSize: 9.5, color: PNE_V.muted2, fontStyle: 'italic', margin: '6px 0 0' } }, i18next.t('progression:progression.patch_notes.login_to_comment')));
}

/** Composant React — carte d'une ligne de patch note (badges/tags, vote karma, fil de commentaires repliable). */
function PneEntryCard(props) {
  const { row } = props;
  const line = row.line, p = row.version;
  const cat = PATCH_CATS[line.t] || PATCH_CATS.change;
  const subMap = LANG === 'fr' ? PATCH_SUBCATS : PATCH_SUBCATS_EN;
  const sev = line.severity ? PATCH_SEVERITY[line.severity] : null;
  const plat = line.plat ? PATCH_PLATFORMS[line.plat] : null;
  const nature = line.nature ? PATCH_NATURE[line.nature] : null;
  const sub = line.sub ? subMap[line.sub] : null;

  const [score, setScore] = React.useState(patchKarmaCache[row.entryId] || 0);
  const [myVote, setMyVote] = React.useState(patchMyVoteCache[row.entryId] || 0);
  const [commentsOpen, setCommentsOpen] = React.useState(false);
  const [commentCount, setCommentCount] = React.useState(null);

  async function vote(value) {
    if (!sb || typeof currentUser === 'undefined' || !currentUser) return;
    const next = myVote === value ? 0 : value;
    const delta = next - myVote;
    const prevVote = myVote, prevScore = score;
    setMyVote(next); setScore(s => s + delta);
    patchMyVoteCache[row.entryId] = next; patchKarmaCache[row.entryId] = score + delta;
    try {
      // même correction que PneCommentThread.submit() : lire `error` explicitement, un try/catch
      // seul ne voit jamais une exception SQL levée côté serveur (ex: rate_limited).
      const { error } = await sb.rpc('vote_patch_note', { p_entry_id: row.entryId, p_value: next });
      if (error) { setMyVote(prevVote); setScore(prevScore); patchMyVoteCache[row.entryId] = prevVote; patchKarmaCache[row.entryId] = prevScore; }
    } catch (e) { setMyVote(prevVote); setScore(prevScore); patchMyVoteCache[row.entryId] = prevVote; patchKarmaCache[row.entryId] = prevScore; }
  }
  async function toggleComments() {
    const next = !commentsOpen;
    setCommentsOpen(next);
    if (next && commentCount === null && sb) {
      const { count } = await sb.from('patch_note_comments').select('id', { count: 'exact', head: true }).eq('entry_id', row.entryId).eq('status', 'visible');
      setCommentCount(count || 0);
    }
  }

  const tags = [
    sub ? { label: sub, color: cat.color } : null,
    sev ? { label: sev[LANG], color: sev.color, title: sev.desc[LANG] } : null,
    plat ? { label: plat.icon + ' ' + plat[LANG], color: plat.color, title: plat.desc[LANG] } : null,
    nature ? { label: nature.icon + ' ' + nature[LANG], color: nature.color, title: nature.desc[LANG] } : null,
  ].filter(Boolean);

  return pneH('div', {
    className: 'rounded-md', style: { borderRadius: 6, border: `1px solid ${props.controversial ? PNE_V.red : PNE_V.border}`, padding: 10, display: 'flex', flexDirection: 'column', gap: 6, background: props.controversial ? 'rgba(192,80,60,.08)' : 'transparent' },
  },
    pneH('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
      pneH('span', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 4, flexShrink: 0, fontSize: 11, background: cat.color + '22', border: `1px solid ${cat.color}55` } }, cat.icon),
      pneH('span', { style: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em', color: cat.color, flex: 1 } }, cat[LANG], line.removed ? pneH('span', { style: { marginLeft: 6, fontSize: 9, color: PNE_V.red2, textTransform: 'none', fontWeight: 600 } }, i18next.t('progression:progression.patch_notes.removed_badge')) : null),
      // point "Nouveau"/tampon "Lu" PAR ENTRÉE (2026-07-11, fidélité maquette : la maquette calcule
      // ce badge par ligne, pas seulement une fois par version comme le point déjà affiché dans
      // PneVersionBlock) -- réutilise readPatches (déjà la source de vérité "lu", jamais dupliquée).
      !readPatches.has(p.v)
        ? pneH('span', { className: 'pnePulseDot', style: { width: 6, height: 6, borderRadius: 999, background: PNE_V.gold2, flexShrink: 0 }, title: i18next.t('progression:progression.patch_notes.new_badge_title') })
        : pneH('span', { style: { fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3, flexShrink: 0, color: PNE_V.red, border: `1.5px solid ${PNE_V.red}`, transform: 'rotate(-8deg)', fontFamily: 'monospace', opacity: 0.6 }, title: i18next.t('progression:progression.patch_notes.already_read_title') }, i18next.t('progression:progression.patch_notes.read_badge')),
      line.img ? pneH('button', { className: 'pneBtn', onClick: () => openPatchImgCompare(line.img.before, line.img.after), title: i18next.t('progression:progression.patch_notes.before_after_title'), style: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 } }, '🖼️') : null),
    // corps de la ligne (2026-07-11, rapporté explicitement avec capture d'écran : "Titre de la
    // note puis le texte en dessous") -- notre modèle de données n'a qu'UN SEUL champ `tx` par
    // ligne (pas de title/body séparés comme la maquette), donc le fourrer en gras/12px dans la
    // même rangée que le badge de catégorie produisait un faux "titre" démesuré sur plusieurs
    // lignes. Rendu maintenant comme un vrai paragraphe de corps sous l'en-tête (icône+catégorie),
    // même style que le body de la maquette -- l'en-tête (icône+catégorie) fait office de titre.
    pneH('p', { style: { fontSize: 12, lineHeight: 1.5, color: PNE_V.cream, margin: 0 } }, line.tx),
    tags.length > 0 ? pneH('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 4 } },
      tags.map((t, i) => pneH('span', { key: i, title: t.title, style: { fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 999, border: `1px solid ${t.color}`, color: t.color } }, t.label))) : null,
    pneH('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 } },
      pneH(PneVoteBadge, { score, myVote, onVote: vote }),
      pneH('button', { className: 'pneBtn', onClick: toggleComments, style: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, border: `1px solid ${commentsOpen ? PNE_V.pink + '55' : PNE_V.border}`, color: commentsOpen ? PNE_V.pink : PNE_V.muted, background: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' } },
        '💬', commentCount != null && commentCount > 0 ? commentCount : '')),
    commentsOpen ? pneH(PneCommentThread, { entryId: row.entryId }) : null);
}

/** Composant React — bloc d'une version (timeline verticale, titre/date/badge "dernière"/"nouveau", liste des PneEntryCard). */
function PneVersionBlock(props) {
  const { p, absIdx, rows } = props;
  const isNew = !readPatches.has(p.v);
  return pneH('div', { id: 'pne-version-' + p.v, style: { position: 'relative', paddingLeft: 20, paddingBottom: 20 } },
    props.notLast ? pneH('div', { style: { position: 'absolute', left: 6, top: 20, bottom: 0, width: 1, background: PNE_V.border } }) : null,
    pneH('div', { style: { position: 'absolute', left: 0, top: 4, width: 14, height: 14, borderRadius: 999, border: `2px solid ${absIdx === 0 ? PNE_V.gold : PNE_V.border}`, background: PNE_V.bg } }),
    pneH('div', { style: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4, flexWrap: 'wrap' } },
      // bug corrigé (2026-07-11, rapporté explicitement "noter version vXXX pas vVXXX") --
      // p.v vaut déjà "V369" (meta/patch-notes-data.js), lui préfixer un 'v' minuscule produisait
      // "vV369". Affiché tel quel, en gras -- le titre de chaque bloc de version.
      pneH('span', { style: { fontSize: 13, fontWeight: 700, color: PNE_V.cream } }, p.v),
      pneH('span', { style: { fontSize: 10, color: PNE_V.muted } }, p.d),
      absIdx === 0 ? pneH('span', { style: { fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase', background: '#4a3a20', color: '#e8c876' } }, i18next.t('progression:progression.patch_notes.latest_badge'))
        : isNew ? pneH('span', { className: 'pnePulseDot', style: { width: 6, height: 6, borderRadius: 999, background: PNE_V.gold2 }, title: i18next.t('progression:progression.patch_notes.new_badge_title') }) : null,
      pneH('span', { style: { fontSize: 10, color: PNE_V.muted2, marginLeft: 'auto' } }, rows.length + i18next.t('progression:progression.patch_notes.changes_count_suffix'))),
    // titre global de la version, sous l'en-tête (V+date), au-dessus des cartes (demande explicite
    // 2026-07-15 : "garde le titre global en dessous de la version" en gras) -- passé de petit
    // italique muet à un vrai titre gras proéminent (crème), le corps des lignes reste inchangé.
    p.name ? pneH('p', { style: { fontSize: 14, fontWeight: 700, color: PNE_V.cream, margin: '0 0 8px' } }, p.name[LANG]) : null,
    pneH('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
      rows.map(row => pneH(PneEntryCard, { key: row.entryId, row, controversial: props.controversyView && (patchKarmaCache[row.entryId] || 0) < 0 }))));
}

// deep link "#patch-{version}" (2026-07-11, pipeline doc §5 : "utile pour un lien Discord 'regarde
// le patch de cette semaine'") -- lu UNE SEULE FOIS au montage (pas un effet permanent, un hash
// changé après coup pendant que le panneau est déjà ouvert ne doit pas le re-sauter). Retourne le
// pageStart de la page contenant cette version, ou le pageStart courant si le hash ne matche rien.
/** @returns {number} pageStart initial — résout le deep link "#patch-{version}" (lu une seule fois au montage) vers la page qui contient cette version, sinon patchPageStart courant. */
function pneResolveInitialPageStart() {
  try {
    const hash = (typeof location !== 'undefined' && location.hash) || '';
    const m = hash.match(/^#patch-(.+)$/);
    if (!m) return patchPageStart;
    const version = decodeURIComponent(m[1]);
    const idx = PATCH_NOTES.findIndex(p => p.v === version);
    if (idx === -1) return patchPageStart;
    const pg = computePatchPages().find(pg => idx >= pg.start && idx < pg.start + pg.count);
    return pg ? pg.start : patchPageStart;
  } catch (e) { return patchPageStart; }
}

/** Composant React racine du panneau Notes de version (recherche, filtre, vue-controverse, pagination, timeline de versions). */
function PatchNotesApp(props) {
  const [, forceTick] = React.useState(0);
  const [query, setQuery] = React.useState('');
  const [catFilter, setCatFilter] = React.useState(null);
  const [controversyView, setControversyView] = React.useState(false);
  const [showAdminPanel, setShowAdminPanel] = React.useState(false);
  const [pageStart, setPageStart] = React.useState(pneResolveInitialPageStart);
  const dialogRef = React.useRef(null);

  const isStaff = (typeof isAdmin === 'function' && isAdmin()) || (typeof myIsMod !== 'undefined' && myIsMod);

  // Échap pour fermer + focus trap (pipeline doc §7 : "le focus clavier ne doit pas sortir du
  // dialog tant qu'il est ouvert") -- recalcule les éléments focusables à chaque Tab (la liste
  // change avec les filtres/la pagination), pas de cache qui pourrait devenir obsolète.
  React.useEffect(() => {
    const el = dialogRef.current;
    const focusables = () => el ? Array.from(el.querySelectorAll('button:not(:disabled), input, [tabindex]:not([tabindex="-1"])')) : [];
    const first = focusables()[0];
    if (first) first.focus();
    function onKey(e) {
      if (e.key === 'Escape') { props.onClose(); return; }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) return;
      const firstEl = items[0], lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.onClose]);

  // scroll jusqu'à la version ciblée par le deep link, une fois montée (pipeline doc §5) --
  // uniquement au tout premier rendu, jamais réappliqué ensuite (même esprit que le "jamais
  // d'auto-scroll" pour la lecture normale, voir CLAUDE.md/mémoire : ça ne doit forcer un scroll
  // QUE quand un lien externe l'a explicitement demandé).
  React.useEffect(() => {
    try {
      const hash = (typeof location !== 'undefined' && location.hash) || '';
      const m = hash.match(/^#patch-(.+)$/);
      if (!m) return;
      const version = decodeURIComponent(m[1]);
      const target = document.getElementById('pne-version-' + version);
      if (target) setTimeout(() => target.scrollIntoView({ block: 'start' }), 0);
    } catch (e) {}
    // eslint-disable-next-line
  }, []);

  const pages = computePatchPages();
  let pageIdx = pages.findIndex(pg => pg.start === pageStart);
  if (pageIdx === -1) pageIdx = 0;
  const page = pages[pageIdx];
  const entries = PATCH_NOTES.slice(page.start, page.start + page.count);

  // marque la page affichée comme vue (même règle que l'ancien panneau HTML : dès l'affichage,
  // pas besoin de scroller dessus) -- une seule fois par changement de page.
  React.useEffect(() => {
    let changed = false;
    entries.forEach(p => { if (!seenThisSession.has(p.v)) { seenThisSession.add(p.v); changed = true; } });
    if (changed && typeof updatePatchBadge === 'function') updatePatchBadge();
    try { localStorage.setItem('velia-patch-page', String(pageStart)); } catch (e) {}
  }, [pageStart]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!sb) return;
      try {
        const { data } = await sb.rpc('get_patch_note_karma');
        (data || []).forEach(r => { patchKarmaCache[r.entry_id] = Number(r.score) || 0; });
      } catch (e) {}
      if (typeof currentUser !== 'undefined' && currentUser) {
        try {
          const { data } = await sb.rpc('get_my_patch_note_votes');
          (data || []).forEach(r => { patchMyVoteCache[r.entry_id] = r.value; });
        } catch (e) {}
      }
      if (!cancelled) forceTick(t => t + 1); // relance un rendu une fois le karma/mes votes connus
    })();
    return () => { cancelled = true; };
  }, [pageStart]);

  function goto(newStart) { patchPageStart = newStart; setPageStart(newStart); }
  function markAllRead() {
    PATCH_NOTES.forEach(p => { readPatches.add(p.v); seenThisSession.add(p.v); });
    if (typeof commitPatchRead === 'function') commitPatchRead();
    if (typeof updatePatchBadge === 'function') updatePatchBadge();
    forceTick(t => t + 1);
  }

  const q = query.toLowerCase().trim();
  const blocks = entries.map((p, k) => {
    let rows = pneFlattenPage([p], page.start + k);
    if (catFilter) rows = rows.filter(r => r.line.t === catFilter);
    if (q) rows = rows.filter(r => r.line.tx.toLowerCase().includes(q));
    if (controversyView) rows = [...rows].sort((a, b) => (patchKarmaCache[a.entryId] || 0) - (patchKarmaCache[b.entryId] || 0));
    return { p, absIdx: page.start + k, rows };
  }).filter(b => b.rows.length > 0);

  const unreadNow = typeof unreadPatchCount === 'function' ? unreadPatchCount() : 0;

  return pneH('div', {
    role: 'dialog', 'aria-modal': 'true',
    onClick: e => { if (e.target === e.currentTarget) props.onClose(); },
    style: { position: 'fixed', inset: 0, zIndex: 975, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '30px 16px', overflowY: 'auto', background: 'rgba(6,9,16,.72)', ...PNE_BASE_FONT, color: PNE_V.textMain },
  },
    pneH('style', null, `
      @keyframes pnePulse { 0%,100% { opacity:1; } 50% { opacity:.35; } }
      .pnePulseDot { animation: pnePulse 1.4s ease-in-out infinite; }
      .pneBtn:focus-visible { outline: 2px solid ${PNE_V.gold}; outline-offset: 2px; }
      .pneChip:focus-visible { outline: 2px solid ${PNE_V.gold}; outline-offset: 2px; }
      /* le jeu principal a une règle globale "button { width:100%; margin-top:4px; ... }"
         (src/styles/styles.css) qui s'applique à TOUT <button> du document, y compris ceux de ce
         portail React -- aucun bouton ci-dessous ne fixait explicitement width/margin (rapporté le
         2026-07-11 : les chips de catégorie s'empilaient en pleine largeur au lieu de wrapper comme
         la maquette). Neutralisé ici plutôt que sur chaque bouton un par un. */
      #patchNotesModalRoot button { width: auto; margin: 0; }
      /* scrollbar thème (2026-07-11, demande explicite "scroll bleu foncé comme le theme") --
         .pneScroll était déjà posée sur la timeline mais sans règle correspondante, donc le
         navigateur affichait sa scrollbar par défaut au lieu de suivre la palette du panneau. */
      .pneScroll::-webkit-scrollbar { width: 8px; }
      .pneScroll::-webkit-scrollbar-track { background: ${PNE_V.bg}; border-radius: 8px; }
      .pneScroll::-webkit-scrollbar-thumb { background: ${PNE_V.border}; border-radius: 8px; }
      .pneScroll::-webkit-scrollbar-thumb:hover { background: ${PNE_V.border2}; }
      .pneScroll { scrollbar-width: thin; scrollbar-color: ${PNE_V.border} ${PNE_V.bg}; }
    `),
    pneH('div', { ref: dialogRef, style: { width: '100%', maxWidth: 640, borderRadius: 10, border: `1px solid ${PNE_V.border}`, background: PNE_V.card, overflow: 'hidden', display: 'flex', flexDirection: 'column' } },
      // ---- en-tête ----
      pneH('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${PNE_V.border}` } },
        pneH('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          pneH('span', { style: { display: 'inline-block', width: 4, height: 16, borderRadius: 2, background: PNE_V.pink } }),
          pneH('h2', { style: { fontSize: 13, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: PNE_V.pink, margin: 0 } }, i18next.t('progression:progression.patch_notes.panel_title')),
          // badge "Admin" (2026-07-11, demande explicite -- devenu un vrai bouton le même jour :
          // "lié badge admin a petit panel admin pour supprimer message") -- basé sur le VRAI rôle
          // serveur (isStaff, déjà utilisé pour Controverse), jamais un toggle de démo comme dans
          // la maquette. Ouvre/ferme PneAdminReportsPanel (signalements en attente + suppression).
          isStaff ? pneH('button', { className: 'pneBtn', onClick: () => setShowAdminPanel(v => !v),
            style: { fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '.03em', cursor: 'pointer', color: PNE_V.gold, border: `1px solid ${PNE_V.gold}55`, background: showAdminPanel ? PNE_V.gold + '33' : PNE_V.gold + '1a' } }, i18next.t('progression:progression.patch_notes.admin_badge')) : null),
        pneH('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          isStaff ? pneH('button', { className: 'pneBtn', onClick: () => setControversyView(v => !v), title: i18next.t('progression:progression.patch_notes.controversy_sort_title'),
            style: { fontSize: 10, fontWeight: 600, padding: '4px 8px', borderRadius: 4, cursor: 'pointer', border: `1px solid ${controversyView ? PNE_V.red : PNE_V.border}`, background: controversyView ? 'rgba(192,80,60,.13)' : 'transparent', color: controversyView ? PNE_V.red2 : PNE_V.muted } }, '📉 ' + i18next.t('progression:progression.patch_notes.controversy_label')) : null,
          // toujours affiché (2026-07-11, demande explicite "ajoute Marquer comme lu") -- reste
          // désactivé s'il n'y a rien à marquer, mais garde la couleur verte de la maquette (au
          // lieu de virer gris) : "eMarquer comme lu de la couleur du mockup".
          pneH('button', { className: 'pneBtn', onClick: markAllRead, disabled: unreadNow === 0,
            style: { fontSize: 10, fontWeight: 600, background: 'none', border: 'none', cursor: unreadNow > 0 ? 'pointer' : 'default', color: PNE_V.green, opacity: unreadNow > 0 ? 1 : 0.45 } }, i18next.t('progression:progression.patch_notes.mark_all_read')),
          pneH('button', { className: 'pneBtn', onClick: props.onClose, 'aria-label': i18next.t('progression:progression.patch_notes.close_aria'), style: { width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: PNE_V.muted, cursor: 'pointer', fontSize: 14 } }, '✕'))),

      showAdminPanel ? pneH(PneAdminReportsPanel, { onClose: () => setShowAdminPanel(false) }) : null,

      // ---- recherche ----
      pneH('div', { style: { padding: '12px 16px 0' } },
        pneH('div', { style: { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 6, border: `1px solid ${PNE_V.border}`, background: 'transparent' } },
          // loupe simple en ligne (SVG monochrome, 2026-07-11 : "icone simple noir et blanc...
          // transparent") -- remplace l'emoji couleur 🔎 par un trait fin gris qui suit le thème.
          pneH('svg', { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: PNE_V.muted, strokeWidth: 2, strokeLinecap: 'round', style: { flexShrink: 0 } },
            pneH('circle', { cx: 11, cy: 11, r: 7 }), pneH('line', { x1: 21, y1: 21, x2: 16.65, y2: 16.65 })),
          pneH('input', { value: query, onChange: e => setQuery(e.target.value), placeholder: i18next.t('progression:progression.patch_notes.search_placeholder'),
            style: { flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 12, color: PNE_V.textMain } }))),

      // ---- filtres catégorie ----
      pneH('div', { style: { padding: '10px 16px 8px', display: 'flex', flexWrap: 'wrap', gap: 6 } },
        Object.entries(PATCH_CATS).map(([key, cat]) => {
          const active = catFilter === key;
          return pneH('button', { key, className: 'pneChip', onClick: () => setCatFilter(active ? null : key),
            style: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${active ? cat.color : PNE_V.border}`, background: active ? cat.color + '22' : 'transparent', color: active ? cat.color : PNE_V.muted } },
            // icône monochrome (2026-07-11, demande explicite "emoji monochrome en dessous de
            // recherche") -- même traitement que la loupe : grayscale plutôt que l'emoji couleur
            // natif, la couleur de catégorie reste portée par le texte du label, pas l'icône.
            pneH('span', { style: { filter: 'grayscale(1)' } }, cat.icon), ' ' + cat[LANG], active ? ' ✕' : '');
        }),
        catFilter ? pneH('button', { className: 'pneChip', onClick: () => setCatFilter(null), style: { fontSize: 10, background: 'none', border: 'none', color: PNE_V.muted, cursor: 'pointer' } }, '✕ ' + i18next.t('progression:progression.patch_notes.clear_all_filters')) : null),

      // ---- timeline ----
      pneH('div', { className: 'pneScroll', style: { padding: '0 16px 12px', maxHeight: '55vh', overflowY: 'auto' } },
        blocks.length === 0
          ? pneH('div', { style: { textAlign: 'center', padding: '24px 0', color: PNE_V.muted } }, pneH('p', { style: { fontSize: 11 } }, i18next.t('progression:progression.patch_notes.no_entries_match')))
          : blocks.map((b, i) => pneH(PneVersionBlock, { key: b.p.v, p: b.p, absIdx: b.absIdx, rows: b.rows, notLast: i !== blocks.length - 1, controversyView }))),

      // ---- pagination ----
      pneH('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '10px 16px', borderTop: `1px solid ${PNE_V.border}` } },
        pneH('button', { className: 'pneBtn', disabled: pageIdx === 0, onClick: () => goto(pages[pageIdx - 1].start), title: i18next.t('progression:progression.patch_notes.newer_notes_title'),
          style: { background: 'none', border: 'none', cursor: pageIdx === 0 ? 'default' : 'pointer', color: pageIdx === 0 ? PNE_V.border2 : PNE_V.blue, fontSize: 15 } }, '‹'),
        pneH('span', { style: { fontSize: 10, color: PNE_V.muted } }, (page.start + 1) + '–' + (page.start + entries.length) + ' / ' + PATCH_NOTES.length),
        pneH('button', { className: 'pneBtn', disabled: pageIdx === pages.length - 1, onClick: () => goto(pages[pageIdx + 1].start), title: i18next.t('progression:progression.patch_notes.older_notes_title'),
          style: { background: 'none', border: 'none', cursor: pageIdx === pages.length - 1 ? 'default' : 'pointer', color: pageIdx === pages.length - 1 ? PNE_V.border2 : PNE_V.blue, fontSize: 15 } }, '›'))));
}

let patchNotesRoot = null;
let patchNotesSession = 0;
/** Monte (ou remonte, via une clé de session incrémentée) le panneau React Notes de version dans #patchNotesModalRoot — repli sur renderPatchNotesPanel() (HTML) si React est indisponible. */
function openPatchNotesReact() {
  const container = document.getElementById('patchNotesModalRoot');
  if (!container || typeof React === 'undefined' || typeof ReactDOM === 'undefined') { if (typeof renderPatchNotesPanel === 'function') renderPatchNotesPanel(); return; }
  patchNotesSession++;
  if (!patchNotesRoot) patchNotesRoot = ReactDOM.createRoot(container);
  // flushSync : force un commit DOM synchrone -- sans ça React 18 (createRoot) peut batcher le
  // rendu au tick suivant, et un code appelant qui lit le DOM juste après (tests, ou tout autre
  // wiring synchrone) verrait encore l'ancien contenu (même piège déjà rencontré et corrigé sur
  // le modal de reconnexion, voir src/core/reconnect-modal-react.js).
  ReactDOM.flushSync(() => {
    patchNotesRoot.render(pneH(PatchNotesApp, { key: patchNotesSession, onClose: closePatchNotesReact }));
  });
}
/** Démonte le panneau React Notes de version (rendu synchrone à null). */
function closePatchNotesReact() {
  if (patchNotesRoot) ReactDOM.flushSync(() => patchNotesRoot.render(null));
}
