// ═══ ONBOARDING (2026-07-11, demande explicite : "Onboarding pour le menu Compagnon") ═══════════
// Ce module est isolé (iframe, scope global propre -- voir CLAUDE.md §28) : il ne peut PAS
// réutiliser le système de tutoriel du jeu principal (TUTORIAL_STEPS/startTutorial(),
// backend/game-supabase.js, qui vit dans un scope JS totalement différent). Onboarding autonome,
// même esprit (modal séquentiel, "Passer" à tout moment) mais entièrement propre à ce module.
// Affiché UNE SEULE FOIS par navigateur, indépendamment de la sauvegarde de progression (clé
// localStorage dédiée, distincte de 'velia_idle_pets_save') -- un "Reset" de la sauvegarde ne doit
// pas re-déclencher l'onboarding à chaque fois, ni l'inverse (voir maybeShowOnboarding()).
const ONBOARDING_STORAGE_KEY = 'velia_idle_pets_onboarding_seen_v1';

const ONBOARDING_STEPS = [
  { ico:'🐾', title:'Bienvenue dans le module Compagnons', body:'Élève des familiers qui travaillent pour toi en tâche de fond — même quand tu n\'es pas sur cet onglet. Ce guide rapide te montre la boucle de base.' },
  { ico:'🥚', title:'Éclosion', body:'Un œuf gratuit se prépare automatiquement (voir le compte à rebours en haut). Ouvre-le dans l\'onglet Éclosion pour obtenir un familier de rareté aléatoire, de Commun à Ancestral.' },
  { ico:'🗺️', title:'Sections', body:'Chaque section (Minage, Bûcheron, Combat...) accepte UN SEUL familier déployé à la fois. Une fois déployé, il loot en continu — même quand tu es sur un autre onglet.' },
  { ico:'📦', title:'Collection & Fusion', body:'Retrouve tous tes familiers dans Collection. Fusionnes-en deux pour obtenir un résultat plus fort (meilleures stats, palier +1 garanti) — la vraie façon de progresser sur le long terme.' },
  { ico:'🍖', title:'Nourrir', body:'Un familier déployé perd faim avec le temps et arrête de looter s\'il est affamé. Nourris-le manuellement ou active l\'auto-nourrissage dans l\'onglet Nourrir.' },
  { ico:'🔄', title:'Marché', body:'Échange tes familiers avec d\'autres joueurs contre d\'autres familiers ou du Silver — un vrai échange serveur, distinct de ta sauvegarde locale.' },
];

let onbIdx = 0;

/** Reconstruit le modal d'onboarding à l'étape onbIdx (ONBOARDING_STEPS), pagination + boutons Passer/Précédent/Suivant. */
function renderOnboarding(){
  const step = ONBOARDING_STEPS[onbIdx];
  const isLast = onbIdx === ONBOARDING_STEPS.length - 1;
  document.getElementById('onboarding-body').innerHTML = `
    <div style="text-align:center;font-size:40px;margin-bottom:10px">${step.ico}</div>
    <div style="font-family:'Cinzel',serif;font-size:15px;color:var(--gold);text-align:center;margin-bottom:10px">${step.title}</div>
    <p style="font-size:12px;color:var(--cream2);line-height:1.5;text-align:center;margin-bottom:16px">${step.body}</p>
    <!-- pagination discrète (2026-07-21, rapporté explicitement : "le slider en bas du nom du
         menu doit être un peu moins présent, plus discret") -- points réduits (6px->4px) et
         couleur du point actif adoucie (--gold-dim au lieu de --gold plein), plutôt qu'un
         indicateur aussi voyant que le titre lui-même juste au-dessus. -->
    <div style="display:flex;align-items:center;justify-content:center;gap:4px;margin-bottom:14px">
      ${ONBOARDING_STEPS.map((_,i)=>`<span style="width:4px;height:4px;border-radius:999px;background:${i===onbIdx?'var(--gold-dim)':'var(--border)'}"></span>`).join('')}
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-ghost" style="flex:1" onclick="onbSkip()">Passer</button>
      ${onbIdx>0?`<button class="btn btn-ghost" style="flex:1" onclick="onbPrev()">◀ Précédent</button>`:''}
      <button class="btn btn-gold" style="flex:1" onclick="${isLast?'onbFinish()':'onbNext()'}">${isLast?'C\'est parti !':'Suivant ▶'}</button>
    </div>`;
}
/** Avance d'une étape d'onboarding (clampé au dernier pas). */
function onbNext(){ onbIdx=Math.min(ONBOARDING_STEPS.length-1, onbIdx+1); renderOnboarding(); }
/** Recule d'une étape d'onboarding (clampé au premier pas). */
function onbPrev(){ onbIdx=Math.max(0, onbIdx-1); renderOnboarding(); }
/** Ferme l'onboarding sans terminer la dernière étape (bouton "Passer"). */
function onbSkip(){ closeOnboarding(); }
/** Ferme l'onboarding après la dernière étape (bouton "C'est parti !"). */
function onbFinish(){ closeOnboarding(); }
/** Marque l'onboarding comme vu (localStorage, clé dédiée indépendante de la sauvegarde de progression) et ferme le modal. */
function closeOnboarding(){
  try{ localStorage.setItem(ONBOARDING_STORAGE_KEY, '1'); }catch(e){}
  CM('onboarding-modal');
}
/** Affiche l'onboarding une seule fois par navigateur (clé localStorage dédiée, indépendante de la sauvegarde de progression), no-op si déjà vu. */
function maybeShowOnboarding(){
  let seen = false;
  try{ seen = localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1'; }catch(e){}
  if(seen) return;
  onbIdx = 0;
  renderOnboarding();
  OM('onboarding-modal');
}
