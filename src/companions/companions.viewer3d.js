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
//    déployé sur le terrain (companions.sections.js) — SEUL "Black Mask Cat" tier 5 est câblé
//    (COMPANION_MODEL_MAP), seul fichier réellement uploadé dans le bucket pour l'instant. Ajouter
//    une entrée ici dès qu'un nouveau .glb est uploadé — ne jamais deviner une URL non confirmée
//    (404 silencieux sinon, voir gestion d'erreur de loadModel()).

const COMPANION_MODELS_BASE = 'https://mkwwvzbjtyawpcyrnybk.supabase.co/storage/v1/object/public/companion-models';
const VIEWER3D_TEST_MODEL = COMPANION_MODELS_BASE + '/loot/black_mask_cat_T5.glb';

// nom de pet (companions.catalog.js) -> { section, slug } ; l'URL finale est construite comme
// {BASE}/{section}/{slug}_T{tier}.glb, tier venant de pet.tier (1-5, companions.tier.js) — mais
// seuls les tiers listés dans `tiers` existent réellement dans le bucket, jamais deviner au-delà.
const COMPANION_MODEL_MAP = {
  'Black Mask Cat': { section: 'loot', slug: 'black_mask_cat', tiers: [5] },
};
function companionModelUrlFor(pet) {
  const m = pet && pet.cat && COMPANION_MODEL_MAP[pet.cat.name];
  if (!m || m.tiers.indexOf(pet.tier) === -1) return null;
  return `${COMPANION_MODELS_BASE}/${m.section}/${m.slug}_T${pet.tier}.glb`;
}

// crée un renderer/scène/caméra/OrbitControls dans `wrap` (élément DOM), avec sa propre boucle de
// rendu et son propre event 'resize' -- indépendant de tout autre viewer déjà monté ailleurs
// (le test tab et une modale de pet peuvent en théorie coexister, chacun son état).
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
  }

  return { loadModel, dispose };
}

// ---------- écran de test (onglet dédié, un seul modèle fixe) ----------
let viewer3dState = null; // { dispose } — créé au premier ST(10)

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
function setViewer3dStatus(text) {
  const el = document.getElementById('viewer3d-status');
  if (el) el.textContent = text;
}
function disposeViewer3dIfActive() {
  if (!viewer3dState) return;
  viewer3dState.dispose();
  viewer3dState = null;
}

// ---------- modale "Voir en 3D" pour un pet réel (companions.sections.js) ----------
let pet3dModalState = null; // { dispose }

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
function close3dPreviewModal() {
  CM('pet3d-modal');
  if (pet3dModalState) { pet3dModalState.dispose(); pet3dModalState = null; }
}
