// Pont entre les modules ES de three.js (import/export, forcé par la lib elle-même) et le reste
// du module Compagnons (scripts classiques, scope global partagé — voir CLAUDE.md §7). Ce fichier
// est le SEUL de src/companions/ à utiliser import/export ; il ne fait qu'attacher THREE,
// GLTFLoader, OrbitControls sur window pour que companions.viewer3d.js (script classique) les lise
// normalement. N'importe jamais depuis un CDN — three.module.min.js/GLTFLoader.js/OrbitControls.js
// sont vendorisés en local dans ce même dossier (voir README.md pour la procédure de mise à jour).
import * as THREE from './three.module.min.js';
import { GLTFLoader } from './GLTFLoader.js';
import { OrbitControls } from './OrbitControls.js';

window.THREE = THREE;
window.GLTFLoader = GLTFLoader;
window.OrbitControls = OrbitControls;
window.dispatchEvent(new Event('three-ready'));
