#!/usr/bin/env node
// ============================================================
// Prépare une git worktree fraîche pour travailler dessus (2026-07-20).
//
// POURQUOI. Plusieurs sessions Claude travaillaient dans le MÊME arbre de travail
// (D:\DEV\black-desert-idle). Résultat, en une seule journée : un `checkout` d'une session a fait
// atterrir le commit d'une autre sur `main` ; un `git add -A` a embarqué le travail non commité
// d'une voisine dans la mauvaise PR ; un `reset --hard` a détruit des éditions non commitées.
// La règle "une branche par session" (CLAUDE.md §24) ne protège pas de ça : le problème n'est pas
// la branche, c'est l'ARBRE DE TRAVAIL partagé. Une worktree par session le règle — voir CLAUDE.md
// §24 "une worktree par session".
//
// CE QUE FAIT CE SCRIPT. Une worktree fraîche est inutilisable telle quelle : pas de
// node_modules, et surtout un port de test qui entre en collision avec les autres worktrees.
//
//   1. node_modules -> jonction Windows (ou lien symbolique ailleurs) vers celui du checkout
//      principal. Instantané, zéro octet sur le disque, pas de `npm ci` de 24 Mo à refaire. Les
//      navigateurs Playwright, eux, sont déjà dans un cache global (~/AppData/Local/ms-playwright).
//
//   2. PLAYWRIGHT_PORT -> un port DÉTERMINISTE dérivé du chemin de la worktree. C'est le point le
//      plus important, et le moins évident : playwright.config.js utilise un port fixe (49213) et
//      `reuseExistingServer: !process.env.CI`. Deux worktrees qui lancent les tests en même temps
//      ne plantent PAS — la seconde s'attache silencieusement au serveur de la première et valide
//      donc les fichiers de l'AUTRE worktree. Tests verts, sur le mauvais code, sans aucun signe.
//      Un port par worktree supprime la possibilité même.
//
// Usage : `npm run worktree-setup` (ou `node scripts/worktree-setup.js`) depuis la worktree.
// Idempotent : relançable sans risque, ne touche à rien de déjà correct.
// ============================================================

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/** @param {string[]} args @returns {string} stdout de git, trimé. */
function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

/** @returns {string} chemin du checkout PRINCIPAL (1re entrée de `git worktree list`, jamais une worktree). */
function mainCheckout() {
  const first = git(['worktree', 'list', '--porcelain']).split('\n')[0];
  return first.replace(/^worktree /, '');
}

// port dérivé du chemin : deux worktrees différentes ne peuvent pas tomber sur le même, et la
// MÊME worktree retrouve toujours son port (utile pour `reuseExistingServer` entre deux runs).
// Plage 49300-49899, au-dessus du 49213 par défaut pour ne jamais lui marcher dessus.
/** @param {string} p - chemin absolu de la worktree. @returns {number} port stable dans 49300-49899. */
function portForPath(p) {
  let h = 0;
  const norm = p.replace(/\\/g, '/').toLowerCase();
  for (let i = 0; i < norm.length; i++) h = (h * 31 + norm.charCodeAt(i)) >>> 0;
  return 49300 + (h % 600);
}

function main() {
  const here = process.cwd();
  const root = git(['rev-parse', '--show-toplevel']).replace(/\//g, path.sep);
  if (path.resolve(here) !== path.resolve(root)) {
    console.error(`À lancer depuis la racine de la worktree (${root}), pas depuis ${here}.`);
    process.exit(1);
  }

  const main_ = mainCheckout();
  const isMain = path.resolve(main_) === path.resolve(root);

  // --- 1. node_modules ---
  const target = path.join(main_, 'node_modules');
  const link = path.join(root, 'node_modules');
  if (isMain) {
    console.log('node_modules : checkout principal, rien à faire.');
  } else if (fs.existsSync(link)) {
    console.log('node_modules : déjà présent, laissé tel quel.');
  } else if (!fs.existsSync(target)) {
    console.error(`node_modules introuvable dans le checkout principal (${target}).`);
    console.error('Lance `npm ci` là-bas d\'abord, puis relance ce script.');
    process.exit(1);
  } else {
    // 'junction' sous Windows : ne demande PAS les droits admin, contrairement à un lien
    // symbolique de répertoire. Ailleurs, Node ignore le type et fait un lien de répertoire.
    fs.symlinkSync(target, link, 'junction');
    console.log(`node_modules : jonction créée -> ${target}`);
  }

  // --- 2. port Playwright ---
  const port = isMain ? 49213 : portForPath(root);
  console.log(`\nPLAYWRIGHT_PORT pour cette worktree : ${port}`);
  console.log('\nÀ exporter AVANT de lancer les tests (sinon collision silencieuse avec les');
  console.log('autres worktrees — voir l\'en-tête de ce fichier) :\n');
  console.log(`  bash        : export PLAYWRIGHT_PORT=${port}`);
  console.log(`  PowerShell  : $env:PLAYWRIGHT_PORT = '${port}'`);
  console.log('\nEt pour un run fidèle à la CI (serveur dédié, jamais réutilisé) :');
  console.log(`  CI=1 PLAYWRIGHT_PORT=${port} npx playwright test`);
}

main();
