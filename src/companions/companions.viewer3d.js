// Écran de test du pipeline GLB (2026-07-10, demande explicite : "on va integrer des model gbl" +
// "a terme on va utiliser l'entièreté de ces fichier" — output/loot/tiers + output/combat/tiers,
// ~1,8 Go, jamais commité dans le repo, hébergé sur Supabase Storage bucket public
// "companion-models" (voir supabase/migrations/20260710072116_companion_models_bucket.sql).
//
// Portée volontairement limitée à UN SEUL écran de test (pas de remplacement des icônes
// existantes ailleurs dans le module) tant que le pipeline Three.js n'est pas validé bout en
// bout : chargement réseau du .glb, rendu, perf. Charge après vendor/three/three-bridge.js
// (attend l'event 'three-ready' avant toute utilisation de window.THREE — le bridge est un
// <script type="module">, différé par le navigateur, peut s'exécuter après ce script classique).

const COMPANION_MODELS_BASE = 'https://mkwwvzbjtyawpcyrnybk.supabase.co/storage/v1/object/public/companion-models';

// Un seul modèle de test pour l'instant (voir README.md pour la convention de chemin complète
// une fois les 62 fichiers uploadés : {section}/{artKey}_{tier}.glb).
const VIEWER3D_TEST_MODEL = COMPANION_MODELS_BASE + '/loot/black_mask_cat_T5.glb';

let viewer3dState = null; // { renderer, scene, camera, controls, raf } — créé au premier ST(10)

function initViewer3dIfNeeded() {
  const wrap = document.getElementById('viewer3d-canvas-wrap');
  if (!wrap || viewer3dState) return;
  if (typeof window.THREE === 'undefined') {
    // three-bridge.js (module, chargé en tâche différée) pas encore prêt — retente une fois l'event reçu
    window.addEventListener('three-ready', initViewer3dIfNeeded, { once: true });
    setViewer3dStatus('Chargement de Three.js…');
    return;
  }
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

  viewer3dState = { renderer, scene, camera, controls, raf: null };

  function onResize() {
    if (!viewer3dState || !wrap.clientWidth || !wrap.clientHeight) return;
    camera.aspect = wrap.clientWidth / wrap.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(wrap.clientWidth, wrap.clientHeight);
  }
  window.addEventListener('resize', onResize);

  function loop() {
    viewer3dState.raf = requestAnimationFrame(loop);
    controls.update();
    renderer.render(scene, camera);
  }
  loop();

  loadViewer3dModel(VIEWER3D_TEST_MODEL);
}

function loadViewer3dModel(url) {
  if (!viewer3dState) return;
  setViewer3dStatus('Chargement du modèle…');
  const loader = new window.GLTFLoader();
  const startedAt = performance.now();
  loader.load(
    url,
    gltf => {
      if (!viewer3dState) return; // écran fermé pendant le chargement réseau
      const box = new window.THREE.Box3().setFromObject(gltf.scene);
      const size = box.getSize(new window.THREE.Vector3()).length() || 1;
      const scale = 1.6 / size;
      gltf.scene.scale.setScalar(scale);
      const center = box.getCenter(new window.THREE.Vector3()).multiplyScalar(scale);
      gltf.scene.position.sub(center);
      viewer3dState.scene.add(gltf.scene);
      const ms = Math.round(performance.now() - startedAt);
      setViewer3dStatus('Chargé en ' + ms + ' ms — ' + url.split('/').pop());
    },
    xhr => {
      if (xhr.lengthComputable) {
        const pct = Math.round((xhr.loaded / xhr.total) * 100);
        setViewer3dStatus('Téléchargement… ' + pct + '% (' + Math.round(xhr.loaded / 1e6) + ' Mo)');
      }
    },
    err => {
      setViewer3dStatus('Erreur de chargement — voir console (' + (err && err.message ? err.message : 'inconnue') + ')');
      console.error('[viewer3d] échec chargement GLB', url, err);
    }
  );
}

function setViewer3dStatus(text) {
  const el = document.getElementById('viewer3d-status');
  if (el) el.textContent = text;
}

function disposeViewer3dIfActive() {
  if (!viewer3dState) return;
  cancelAnimationFrame(viewer3dState.raf);
  viewer3dState.renderer.dispose();
  viewer3dState = null;
}
