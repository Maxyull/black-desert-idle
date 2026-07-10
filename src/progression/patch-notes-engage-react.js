// ==================== ENGAGEMENT DES NOTES DE VERSION (karma + commentaires, React) ====================
// 4e fichier du projet à utiliser React (React.createElement pur, sans JSX ni bundler -- voir
// CLAUDE.md §7, exception documentée pour ce fichier précis, même famille que boss-wheel-react.js/
// reconnect-modal-react.js/compendium-react.js). Port SCOPÉ de patch-notes-system.jsx +
// patch-notes-pipeline.md fournis par l'utilisateur : contrairement au reste du panneau Notes de
// version (renderPatchNotesPanel/renderPatchEntryHtml, backend/game-supabase.js -- HTML classique,
// volontairement INCHANGÉ : pagination par taille, tags sévérité/plateforme/nature, comparateur
// avant/après, tout ce système est déjà réel et testé), CE fichier n'ajoute qu'un petit widget
// (vote + fil de commentaires) monté par LIGNE de patch note, dans le `<div class="patchEntryEngage"
// data-eid="...">` déjà présent dans le HTML généré. Recherche/filtre/vue-controverse restent en
// JS classique (applyPatchFilters/applyPatchControversySort, game-supabase.js) -- pas de raison
// d'étendre le périmètre React à de la simple manipulation de visibilité DOM.

const PNE_V = {
  bg: '#0e1422', card: '#131a29', border: '#263049', border2: '#3a4665',
  gold: '#d4a955', gold2: '#e8a355', pink: '#e8698f', green: '#6fdc6f', blue: '#7ea6ff',
  red: '#c0503c', red2: '#e08070', textMain: '#c7d0e6', text2: '#aab4d4', muted: '#5c6785', muted2: '#4a5674',
};
const pneH = React.createElement;

let patchKarmaCache = {};   // entry_id -> score (partagé avec applyPatchControversySort, game-supabase.js)
let patchMyVoteCache = {};  // entry_id -> -1|1
let pneRoots = new Map();   // container DOM -> React root (jamais recréé pour le même container)

// filtre anti-insulte client -- UNIQUEMENT un garde-fou UX (retour immédiat sans aller-retour
// réseau) : le vrai blocage non contournable vit côté serveur (add_patch_note_comment, voir
// supabase/migrations/20260710140000_patch_notes_votes_comments.sql) -- même distinction que le
// pipeline doc §8 ("ça ne suffit jamais en prod... le vrai garde-fou doit vivre côté serveur").
const PNE_BANNED_WORDS_CLIENT = ['idiot', 'debile', 'nul', 'connard', 'stupide', 'abruti', 'merde'];
function pneContainsBannedWord(text) {
  const normalized = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return PNE_BANNED_WORDS_CLIENT.some(w => normalized.includes(w));
}

function PatchEngageWidget(props) {
  const [score, setScore] = React.useState(props.initialScore || 0);
  const [myVote, setMyVote] = React.useState(props.initialMyVote || 0);
  const [open, setOpen] = React.useState(false);
  const [comments, setComments] = React.useState(null); // null = pas encore chargé
  const [draft, setDraft] = React.useState('');
  const [draftError, setDraftError] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const loggedIn = typeof currentUser !== 'undefined' && !!currentUser;
  const isStaff = (typeof isAdmin === 'function' && isAdmin()) || (typeof myIsMod !== 'undefined' && myIsMod);

  async function loadComments() {
    if (!sb) { setComments([]); return; }
    const { data } = await sb.from('patch_note_comments').select('id,user_id,author,created_at,text')
      .eq('entry_id', props.entryId).eq('status', 'visible').order('created_at', { ascending: true });
    setComments(data || []);
  }
  function toggleOpen() {
    setOpen(o => { const next = !o; if (next && comments === null) loadComments(); return next; });
  }

  async function vote(value) {
    if (!loggedIn || !sb || busy) return;
    const next = myVote === value ? 0 : value;
    const delta = next - myVote;
    setMyVote(next); setScore(s => s + delta); // optimiste
    patchMyVoteCache[props.entryId] = next; patchKarmaCache[props.entryId] = score + delta;
    setBusy(true);
    try { await sb.rpc('vote_patch_note', { p_entry_id: props.entryId, p_value: next }); }
    catch (e) { setMyVote(myVote); setScore(s => s - delta); } // repli si l'appel échoue
    finally { setBusy(false); }
  }

  async function submitComment() {
    const text = draft.trim();
    if (!text || !loggedIn || !sb) return;
    if (pneContainsBannedWord(text)) { setDraftError(true); return; }
    setBusy(true);
    try {
      await sb.rpc('add_patch_note_comment', { p_entry_id: props.entryId, p_text: text });
      setDraft(''); setDraftError(false);
      await loadComments();
    } catch (e) {
      // le serveur bloque aussi le contenu inapproprié (contournement du filtre client) --
      // message générique volontaire, ne pas exposer la liste de mots bannis dans l'erreur.
      setDraftError(true);
    } finally { setBusy(false); }
  }
  async function removeComment(id) {
    if (!sb) return;
    await sb.rpc('remove_patch_note_comment', { p_comment_id: id });
    loadComments();
  }
  async function reportComment(id) {
    if (!sb) return;
    try { await sb.rpc('report_patch_note_comment', { p_comment_id: id }); } catch (e) {}
  }

  return pneH('div', { style: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 } },
    pneH('style', null, `
      .pneBtn:focus-visible { outline: 2px solid ${PNE_V.gold}; outline-offset: 2px; }
    `),
    pneH('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
      pneH('div', { style: { display: 'flex', alignItems: 'center', gap: 2, borderRadius: 4, border: `1px solid ${PNE_V.border2}`, padding: '1px 4px' } },
        pneH('button', { className: 'pneBtn', onClick: () => vote(-1), disabled: !loggedIn, 'aria-label': 'Downvote',
          style: { width: 18, height: 18, border: 'none', background: 'none', cursor: loggedIn ? 'pointer' : 'default', color: myVote === -1 ? PNE_V.blue : PNE_V.border2, fontSize: 11 } }, '−'),
        pneH('span', { style: { fontSize: 10, fontWeight: 700, width: 20, textAlign: 'center', color: score > 0 ? PNE_V.gold2 : score < 0 ? PNE_V.blue : PNE_V.muted } }, score),
        pneH('button', { className: 'pneBtn', onClick: () => vote(1), disabled: !loggedIn, 'aria-label': 'Upvote',
          style: { width: 18, height: 18, border: 'none', background: 'none', cursor: loggedIn ? 'pointer' : 'default', color: myVote === 1 ? PNE_V.gold2 : PNE_V.border2, fontSize: 11 } }, '+')),
      pneH('button', { className: 'pneBtn', onClick: toggleOpen, style: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, border: `1px solid ${open ? PNE_V.pink + '55' : PNE_V.border}`, color: open ? PNE_V.pink : PNE_V.muted, background: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' } },
        '💬', comments && comments.length > 0 ? comments.length : '')),

    open ? pneH('div', { style: { background: PNE_V.bg, border: `1px solid ${PNE_V.border}`, borderRadius: 6, padding: 8, maxWidth: 420 } },
      comments === null ? pneH('p', { style: { fontSize: 10.5, color: PNE_V.muted, fontStyle: 'italic', margin: 0 } }, LANG === 'fr' ? 'Chargement…' : 'Loading…') :
      pneH('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
        comments.length === 0 ? pneH('p', { style: { fontSize: 10.5, color: PNE_V.muted2, fontStyle: 'italic', margin: 0 } }, LANG === 'fr' ? 'Aucun commentaire pour l\'instant.' : 'No comments yet.') :
        comments.map(c => {
          const mine = loggedIn && c.user_id === currentUser.id;
          return pneH('div', { key: c.id, style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 } },
            pneH('p', { style: { fontSize: 10.5, color: PNE_V.text2, margin: 0, wordBreak: 'break-word' } },
              pneH('span', { style: { fontWeight: 600, color: mine ? PNE_V.gold2 : PNE_V.blue } }, c.author), ' ',
              pneH('span', { style: { color: PNE_V.muted } }, new Date(c.created_at).toLocaleDateString(LANG === 'fr' ? 'fr-FR' : 'en-US')),
              pneH('br'), c.text),
            pneH('div', { style: { display: 'flex', gap: 4, flexShrink: 0 } },
              !mine ? pneH('button', { className: 'pneBtn', onClick: () => reportComment(c.id), title: LANG === 'fr' ? 'Signaler' : 'Report', style: { background: 'none', border: 'none', color: PNE_V.muted, cursor: 'pointer', fontSize: 10 } }, '🚩') : null,
              (mine || isStaff) ? pneH('button', { className: 'pneBtn', onClick: () => removeComment(c.id), title: LANG === 'fr' ? 'Supprimer' : 'Delete', style: { background: 'none', border: 'none', color: mine ? PNE_V.muted2 : PNE_V.red, cursor: 'pointer', fontSize: 10 } }, '🗑') : null));
        })),
      loggedIn ? pneH('div', { style: { marginTop: 6 } },
        pneH('div', { style: { display: 'flex', gap: 4 } },
          pneH('input', {
            value: draft, onChange: e => { setDraft(e.target.value); setDraftError(false); },
            onKeyDown: e => e.key === 'Enter' && submitComment(),
            placeholder: LANG === 'fr' ? 'Ajouter un commentaire' : 'Add a comment', disabled: busy,
            style: { flex: 1, fontSize: 10.5, padding: '4px 6px', borderRadius: 4, border: `1px solid ${draftError ? PNE_V.red : PNE_V.border}`, background: PNE_V.card, color: PNE_V.textMain, outline: 'none' },
          }),
          pneH('button', { className: 'pneBtn', onClick: submitComment, disabled: busy, style: { fontSize: 10.5, border: `1px solid ${PNE_V.border2}`, background: 'none', color: PNE_V.blue, borderRadius: 4, padding: '2px 8px', cursor: 'pointer' } }, '➤')),
        draftError ? pneH('p', { style: { fontSize: 9.5, color: PNE_V.red2, margin: '4px 0 0' } }, LANG === 'fr' ? 'Merci de rester respectueux — commentaire bloqué.' : 'Please stay respectful — comment blocked.') : null)
        : pneH('p', { style: { fontSize: 9.5, color: PNE_V.muted2, fontStyle: 'italic', margin: '6px 0 0' } }, LANG === 'fr' ? 'Connecte-toi pour commenter.' : 'Log in to comment.'))
      : null);
}

// monte un mini-root React par `.patchEntryEngage[data-eid]` de la page COURANTE -- appelé depuis
// renderPatchNotesPanel() (game-supabase.js) après insertion du HTML. Un seul aller-retour réseau
// pour le karma + mes votes de TOUTE la page (pas un appel par ligne).
async function mountPatchEngageWidgets() {
  // openInfo() remplace le contenu de #infoBody en entier à chaque navigation de page (pagination
  // Plus récent/Plus ancien) -- les anciens conteneurs `.patchEntryEngage` deviennent orphelins
  // (détachés du document) mais leurs racines React restent référencées dans pneRoots ; les
  // démonter explicitement évite de les laisser vivre indéfiniment pour rien.
  pneRoots.forEach((root, container) => {
    if (!container.isConnected) { root.unmount(); pneRoots.delete(container); }
  });
  const containers = document.querySelectorAll('#infoBody .patchEntryEngage[data-eid]');
  if (containers.length === 0) return;
  if (sb) {
    try {
      const { data: karmaRows } = await sb.rpc('get_patch_note_karma');
      (karmaRows || []).forEach(r => { patchKarmaCache[r.entry_id] = Number(r.score) || 0; });
    } catch (e) {}
    if (typeof currentUser !== 'undefined' && currentUser) {
      try {
        const { data: voteRows } = await sb.rpc('get_my_patch_note_votes');
        (voteRows || []).forEach(r => { patchMyVoteCache[r.entry_id] = r.value; });
      } catch (e) {}
    }
  }
  containers.forEach(container => {
    const eid = container.dataset.eid;
    let root = pneRoots.get(container);
    if (!root) { root = ReactDOM.createRoot(container); pneRoots.set(container, root); }
    root.render(pneH(PatchEngageWidget, { entryId: eid, initialScore: patchKarmaCache[eid] || 0, initialMyVote: patchMyVoteCache[eid] || 0 }));
  });
}
