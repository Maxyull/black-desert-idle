// ═══ TUTORIEL DU MENU COMPAGNON ═══════════════════════════════════
// Onglet "Tutoriel" (2026-07-18, demande explicite : "fais un tutoriel de comment se passe le menu
// compagnon dans un onglet tutoriel avec des photos et peu de texte"). Guide ILLUSTRÉ (les icônes
// des onglets servent d'illustrations -- même langage visuel que le reste du module, robuste et
// léger, plutôt que des captures embarquées qui se périmeraient) et CONCIS (une phrase par onglet).
// Rendu par renderTutorial() (appelé par ST(12), hatch.js). Contenu piloté par ce tableau + i18n
// (locales/{fr,en}/companions.json, clés companions.tutorial.*) -- pas de texte codé en dur ici.

/** Étapes du tutoriel : chaque entrée = un onglet du module (icône + clés i18n titre/description). */
const TUTORIAL_STEPS = [
  { icon:'🎮', key:'game' },
  { icon:'🥚', key:'hatch' },
  { icon:'🗺️', key:'sections' },
  { icon:'📦', key:'collection' },
  { icon:'🍖', key:'feed' },
  { icon:'📖', key:'index' },
  { icon:'🌿', key:'hardinage' },
  { icon:'🏆', key:'progression' },
  { icon:'⚔️', key:'ranking' },
];

/** Reconstruit l'onglet Tutoriel : intro + une carte illustrée (icône d'onglet + phrase) par section, puis un encart d'astuces. */
function renderTutorial(){
  const el = document.getElementById('tutorial-content');
  if(!el) return;
  // COMPANIONS_NS_PREFIX (='companions:', i18n.js) au lieu d'un littéral 'companions:...' : le
  // vérificateur check-missing-translations ne matche i18next.t('domaine:clé') QUE si un guillemet
  // suit immédiatement t( -- passer par la variable évite un faux positif sur la clé dynamique.
  const t = (k) => i18next.t(COMPANIONS_NS_PREFIX+'companions.tutorial.'+k);
  const cards = TUTORIAL_STEPS.map((s,i)=>`
    <div style="display:flex;gap:14px;align-items:flex-start;background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:14px 16px">
      <div style="flex-shrink:0;width:52px;height:52px;border-radius:12px;background:var(--s3);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:26px">${s.icon}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
          <span style="font-family:'Cinzel',serif;font-size:9px;color:var(--gold2);background:var(--s3);border:1px solid var(--border);border-radius:20px;padding:1px 8px">${i+1}</span>
          <span style="font-family:'Cinzel',serif;font-size:13px;color:var(--cream)">${t(s.key+'_title')}</span>
        </div>
        <div style="font-size:11px;color:var(--cream2);line-height:1.5">${t(s.key+'_desc')}</div>
      </div>
    </div>`).join('');
  el.innerHTML = `
    <div style="max-width:640px;margin:0 auto">
      <div style="font-family:'Cinzel',serif;font-size:16px;color:var(--gold);margin-bottom:4px">${t('title')}</div>
      <div style="font-size:11px;color:var(--cream3);margin-bottom:18px;line-height:1.5">${t('intro')}</div>
      <div style="display:flex;flex-direction:column;gap:10px">${cards}</div>
      <div style="margin-top:18px;background:var(--s1);border:1px solid var(--gold-dim);border-radius:12px;padding:14px 16px">
        <div style="font-family:'Cinzel',serif;font-size:12px;color:var(--gold2);margin-bottom:6px">💡 ${t('tips_title')}</div>
        <div style="font-size:11px;color:var(--cream2);line-height:1.6">${t('tips_body')}</div>
      </div>
    </div>`;
}
