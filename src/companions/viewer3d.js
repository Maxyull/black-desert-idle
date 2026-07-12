// Pipeline GLB (2026-07-10, demande explicite : "on va integrer des model gbl" +
// "a terme on va utiliser l'entièreté de ces fichier" — output/loot/tiers + output/combat/tiers,
// ~1,8 Go, jamais commité dans le repo, hébergé sur Supabase Storage bucket public
// "companion-models" (voir supabase/migrations/20260710072116_companion_models_bucket.sql).
//
// Deux usages du même moteur (createThreeViewer, factorisé pour ne pas dupliquer le
// renderer/scene/caméra/loop) :
// 1. Écran de test isolé (onglet "🧊 Viewer 3D", ST(10)) — un seul modèle fixe, pour valider le
//    pipeline avant tout usage réel.
// 2. Bouton "🧊 Voir en 3D" (2026-07-10, "envoyer le premier test .glb") dans le panneau du pet
//    déployé sur le terrain (sections.js) — SEUL "Black Mask Cat" tier 5 est câblé
//    (COMPANION_MODEL_MAP), seul fichier réellement uploadé dans le bucket pour l'instant. Ajouter
//    une entrée ici dès qu'un nouveau .glb est uploadé — ne jamais deviner une URL non confirmée
//    (404 silencieux sinon, voir gestion d'erreur de loadModel()).

const COMPANION_MODELS_BASE = 'https://mkwwvzbjtyawpcyrnybk.supabase.co/storage/v1/object/public/companion-models';
const VIEWER3D_TEST_MODEL = COMPANION_MODELS_BASE + '/loot/black_mask_cat_T5.glb';

// nom de pet (catalog.js) -> { section, slug } ; l'URL finale est construite comme
// {BASE}/{section}/{slug}_T{tier}.glb, tier venant de pet.tier (1-5, tier.js) — mais
// seuls les tiers listés dans `tiers` existent réellement dans le bucket, jamais deviner au-delà.
// 2026-07-20 ("integre les menu 3D de la phase 1" = output/loot/tiers + output/combat/tiers,
// les 2 dossiers déjà générés) : passe de 1 seul modèle de test (Black Mask Cat T5) aux 11
// espèces (sections loot/combat du catalogue), T1 à T5 chacune -- 55 combos au total. Les 2
// fichiers hors convention (sky_hawk_T3_preview_only.glb, grey_moon_cat_T5_v2.glb) sont
// volontairement exclus, jamais uploadés (voir tâche d'upload Supabase Storage). N'ajouter une
// entrée ici QUE pour un fichier réellement uploadé dans le bucket (404 sinon, géré proprement par
// loadModel() mais autant ne pas promettre un modèle absent).
const COMPANION_MODEL_TIERS_ALL = [1,2,3,4,5];
const COMPANION_MODEL_MAP = {
  // sec:'loot' (catalog.js) — output/loot/tiers/
  'Black Mask Cat':          { section: 'loot', slug: 'black_mask_cat',         tiers: COMPANION_MODEL_TIERS_ALL },
  'Grey Moon Cat':           { section: 'loot', slug: 'grey_moon_cat',          tiers: COMPANION_MODEL_TIERS_ALL },
  'Black Cloaked Cat':       { section: 'loot', slug: 'black_cloaked_cat',      tiers: COMPANION_MODEL_TIERS_ALL },
  'Karlstein Cat':           { section: 'loot', slug: 'karlstein_cat',          tiers: COMPANION_MODEL_TIERS_ALL },
  'Sky Hawk':                { section: 'loot', slug: 'sky_hawk',               tiers: COMPANION_MODEL_TIERS_ALL },
  'Golden Crow Sovereign':   { section: 'loot', slug: 'golden_crow_sovereign',  tiers: COMPANION_MODEL_TIERS_ALL },
  // sec:'combat' (catalog.js) — output/combat/tiers/
  'Brown Fighting Dog':      { section: 'combat', slug: 'brown_fighting_dog',      tiers: COMPANION_MODEL_TIERS_ALL },
  'Snow Wolfdog':            { section: 'combat', slug: 'snow_wolfdog',            tiers: COMPANION_MODEL_TIERS_ALL },
  'Black Cloaked Dog':       { section: 'combat', slug: 'black_cloaked_dog',       tiers: COMPANION_MODEL_TIERS_ALL },
  'Helter-Skelter Ceros':    { section: 'combat', slug: 'helter_skelter_ceros',    tiers: COMPANION_MODEL_TIERS_ALL },
  'Young Black Dragon':      { section: 'combat', slug: 'young_black_dragon',      tiers: COMPANION_MODEL_TIERS_ALL },
  'Newborn Crimson Dragon':  { section: 'combat', slug: 'newborn_crimson_dragon',  tiers: COMPANION_MODEL_TIERS_ALL },
};
/** @param {object} pet - familier. @returns {?string} URL du modèle GLB (COMPANION_MODEL_MAP) si son espèce/tier est réellement uploadée dans le bucket, sinon null (jamais deviner une URL). */
function companionModelUrlFor(pet) {
  const m = pet && pet.cat && COMPANION_MODEL_MAP[pet.cat.name];
  if (!m || m.tiers.indexOf(pet.tier) === -1) return null;
  return `${COMPANION_MODELS_BASE}/${m.section}/${m.slug}_T${pet.tier}.glb`;
}

// crée un renderer/scène/caméra/OrbitControls dans `wrap` (élément DOM), avec sa propre boucle de
// rendu et son propre event 'resize' -- indépendant de tout autre viewer déjà monté ailleurs
// (le test tab et une modale de pet peuvent en théorie coexister, chacun son état).
/**
 * Crée un renderer/scène/caméra/OrbitControls Three.js indépendant dans `wrap`, avec sa propre
 * boucle de rendu et son propre listener 'resize'. Plusieurs viewers peuvent coexister (chacun
 * son état) — voir dispose() pour la libération du contexte WebGL (limité par navigateur).
 * @param {HTMLElement} wrap - conteneur DOM (le canvas y est monté).
 * @param {?function(string):void} onStatus - callback de statut texte (chargement/erreur), optionnel.
 * @returns {{loadModel:function(string):void, dispose:function():void}}
 */
function createThreeViewer(wrap, onStatus) {
  const THREE = window.THREE;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(wrap.clientWidth, wrap.clientHeight);
  wrap.innerHTML = '';
  wrap.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, wrap.clientWidth / wrap.clientHeight, 0.1, 100);
  camera.position.set(2, 1.6, 3);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x222233, 1.1));
  const dir = new THREE.DirectionalLight(0xffffff, 1.4);
  dir.position.set(3, 5, 2);
  scene.add(dir);

  const controls = new window.OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.8, 0);
  controls.enableDamping = true;

  const state = { renderer, scene, camera, controls, raf: null, disposed: false };

  function onResize() {
    if (state.disposed || !wrap.clientWidth || !wrap.clientHeight) return;
    camera.aspect = wrap.clientWidth / wrap.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(wrap.clientWidth, wrap.clientHeight);
  }
  window.addEventListener('resize', onResize);

  function loop() {
    if (state.disposed) return;
    state.raf = requestAnimationFrame(loop);
    controls.update();
    renderer.render(scene, camera);
  }
  loop();

  function loadModel(url) {
    if (onStatus) onStatus('Chargement du modèle…');
    const loader = new window.GLTFLoader();
    const startedAt = performance.now();
    loader.load(
      url,
      gltf => {
        if (state.disposed) return; // fermé pendant le chargement réseau
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = box.getSize(new THREE.Vector3()).length() || 1;
        const scale = 1.6 / size;
        gltf.scene.scale.setScalar(scale);
        const center = box.getCenter(new THREE.Vector3()).multiplyScalar(scale);
        gltf.scene.position.sub(center);
        scene.add(gltf.scene);
        const ms = Math.round(performance.now() - startedAt);
        if (onStatus) onStatus('Chargé en ' + ms + ' ms — ' + url.split('/').pop());
      },
      xhr => {
        if (xhr.lengthComputable && onStatus) {
          const pct = Math.round((xhr.loaded / xhr.total) * 100);
          onStatus('Téléchargement… ' + pct + '% (' + Math.round(xhr.loaded / 1e6) + ' Mo)');
        }
      },
      err => {
        if (onStatus) onStatus('Erreur de chargement — voir console (' + (err && err.message ? err.message : 'inconnue') + ')');
        console.error('[viewer3d] échec chargement GLB', url, err);
      }
    );
  }

  function dispose() {
    if (state.disposed) return;
    state.disposed = true;
    cancelAnimationFrame(state.raf);
    window.removeEventListener('resize', onResize);
    renderer.dispose();
    // bug corrigé (2026-07-20, rapporté explicitement : "je ne vois pas mes model que le
    // premier") -- renderer.dispose() libère les ressources GPU (buffers/textures) MAIS PAS le
    // contexte WebGL lui-même : celui-ci n'est repris par le navigateur qu'au ramassage mémoire
    // du <canvas>, sans garantie de timing. Les navigateurs plafonnent le nombre de contextes
    // WebGL VIVANTS simultanément (souvent ~16) -- en ouvrant/fermant la modale 3D sur plusieurs
    // familiers d'affilée, les anciens contextes s'accumulaient sans être vraiment libérés,
    // jusqu'à ce que de nouveaux contextes échouent silencieusement (canvas noir/vide) : "seul le
    // premier modèle" s'affichait vraiment. forceContextLoss() force la libération immédiate.
    renderer.forceContextLoss();
  }

  return { loadModel, dispose };
}

// ---------- écran de test (onglet dédié, un seul modèle fixe) ----------
let viewer3dState = null; // { dispose } — créé au premier ST(10)

/** Initialise l'écran de test Viewer 3D (un seul modèle fixe, VIEWER3D_TEST_MODEL) au premier affichage de l'onglet, attend Three.js si pas encore chargé. No-op si déjà initialisé. */
function initViewer3dIfNeeded() {
  const wrap = document.getElementById('viewer3d-canvas-wrap');
  if (!wrap || viewer3dState) return;
  if (typeof window.THREE === 'undefined') {
    // three-bridge.js (module, chargé en tâche différée) pas encore prêt — retente une fois l'event reçu
    window.addEventListener('three-ready', initViewer3dIfNeeded, { once: true });
    setViewer3dStatus('Chargement de Three.js…');
    return;
  }
  const viewer = createThreeViewer(wrap, setViewer3dStatus);
  viewer3dState = viewer;
  viewer.loadModel(VIEWER3D_TEST_MODEL);
}
/** @param {string} text - message de statut de l'écran de test Viewer 3D. */
function setViewer3dStatus(text) {
  const el = document.getElementById('viewer3d-status');
  if (el) el.textContent = text;
}
/** Libère le viewer de l'écran de test s'il est actif. */
function disposeViewer3dIfActive() {
  if (!viewer3dState) return;
  viewer3dState.dispose();
  viewer3dState = null;
}

// ---------- modale "Voir en 3D" pour un pet réel (sections.js) ----------
let pet3dModalState = null; // { dispose }

/** @param {object} pet - familier. Ouvre la modale "Voir en 3D" et charge son modèle GLB (no-op si aucun modèle uploadé pour ce pet/tier). */
function open3dPreviewModal(pet) {
  const url = companionModelUrlFor(pet);
  if (!url) return; // pas de modèle uploadé pour ce pet/tier — le bouton ne doit de toute façon pas s'afficher
  OM('pet3d-modal');
  document.getElementById('pet3d-modal-title').textContent = '🧊 ' + pet.cat.name + ' — T' + pet.tier;
  document.getElementById('pet3d-status').textContent = 'En attente…';
  const wrap = document.getElementById('pet3d-canvas-wrap');
  const start = () => {
    if (pet3dModalState) pet3dModalState.dispose();
    pet3dModalState = createThreeViewer(wrap, t => { const el = document.getElementById('pet3d-status'); if (el) el.textContent = t; });
    pet3dModalState.loadModel(url);
  };
  if (typeof window.THREE === 'undefined') {
    document.getElementById('pet3d-status').textContent = 'Chargement de Three.js…';
    window.addEventListener('three-ready', start, { once: true });
  } else start();
}
/** Ferme la modale "Voir en 3D" et libère son viewer. */
function close3dPreviewModal() {
  CM('pet3d-modal');
  if (pet3dModalState) { pet3dModalState.dispose(); pet3dModalState = null; }
}
