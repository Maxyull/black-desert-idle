# ⚔️ Black Desert Idle

Un jeu idle/incrémental dans le navigateur, inspiré de **Black Desert Online** — combat automatique,
progression par zones, enchantement d'équipement, et une vraie couche multijoueur (comptes, sauvegarde
cloud, marché, chat, classement, boss mondial).

🎮 **Jouer :** https://maxyull.github.io/black-desert-idle/
💬 **Discord :** https://discord.gg/fEubtqMjtP
💛 **Soutenir le projet :** [donation.html](donation/donation.html) — 100% gratuit, les dons couvrent juste les coûts d'infra (voir [politique de don](donation/donation-policy.html))

> Projet de fan gratuit, non officiel, sans aucune affiliation ni partenariat avec Pearl Abyss. Les
> noms/styles s'inspirent de Black Desert Online pour l'ambiance ; tous les visuels (icônes, sprites)
> sont des créations 100% originales, aucun asset réel du jeu n'est réutilisé.

## Qu'est-ce que c'est ?

Tu choisis une zone adaptée à ton équipement (PA/PD requis, comme dans le vrai BDO), ton personnage
combat **automatiquement**, ramasse du loot et gagne du silver. Ce silver et ce loot servent à
enchanter ton équipement (de +1 jusqu'à PEN) pour accéder à des zones plus difficiles et plus
rentables — la boucle centrale du jeu.

## Fonctionnalités principales

- **Combat automatique** — pas de clic à répétition, deux IA réglables séparément : mode de
  combat (défensif/équilibré/overgeared) et mode de farm (loot/xp).
- **16 zones de farm** groupées par palier d'équipement (Naru/Tuvala/Yuria/Grunil), chacune avec sa
  propre table de loot (butin de base, matériau, bijou rare, composant de craft).
- **Système d'enchantement fidèle à BDO** : +1 à +15 puis PRI/DUO/TRI/TET/PEN, avec risque de
  rétrogradation, failstack et protection par Pierre de Cron.
- **Comptes joueurs + sauvegarde cloud** (Supabase) — jouable aussi en invité, sans compte.
- **Marché commun** entre joueurs (vrai carnet d'ordres achat/vente, pas d'annonces à prix fixe),
  **classement**, **chat** (mondial/trade/annonces, mentions @joueur).
- **Boss mondial partagé** à horaires fixes, avec classement de contribution.
- **Quêtes journalières/hebdomadaires**, **succès**, **Compendium** de progression, **Codex** des objets.
- **Compatible mobile et tablette** (adaptatif, sans rien perdre de la version ordinateur).
- **Notes de version en jeu**, changelog transparent à chaque mise à jour.

## Stack technique

HTML/CSS/JS vanilla + Canvas 2D, aucune dépendance runtime (le jeu lui-même ne charge rien
de Node/npm). Un script Python local regroupe le code en un seul bundle avant chaque
déploiement, puis Node/Terser le minifie (outils de build/tests uniquement, jamais servis
aux joueurs).

- `index.html` — production, servi tel quel par GitHub Pages : charge un seul bundle minifié
  (`build/source.min.js`)
- `index.dev.html` — développement : charge chaque fichier individuellement (+ les tests),
  utilisé pour coder et tester
- `scripts/build.py` — génère `build/source.js` (concaténation + retrait des commentaires),
  le minifie avec Terser (`build/source.min.js`) et réécrit `index.html` à partir de
  `index.dev.html`
- Suite de régression Playwright (`npm test`, voir `tests/README.md`) : vérifie que
  `index.dev.html` passe `window.runRegressionTests()` et que `index.html` charge bien le
  bundle minifié sans erreur — en plus de `tests/tests.js`, jamais lancée automatiquement
- `src/styles/styles.css` — toute la mise en forme
- Code JS organisé par domaine sous `src/`, chacun avec son propre `README.md` détaillant son
  rôle : `core/` (état, boucle, HUD, combat), `classes/` (personnages jouables), `world/`
  (zones, paliers, rendu de scène), `combat/` (boss, loot, potions, IA), `inventory/`
  (équipement, enchantement), `progression/` (succès, quêtes, courrier, compendium),
  `market/` (marché commun), `social/` (chat), `admin/` (outils admin), `backend/` (Supabase)
- `meta/` (patch notes) et `tests/` (régression) restent hors de `src/` — jamais inclus dans
  le bundle de production
- Backend [Supabase](https://supabase.com) (Postgres + Auth + Edge Functions) pour tout ce qui est
  multijoueur ; migrations SQL suivies dans `supabase/migrations/`.

## Roadmap & philosophie de développement

Ce projet est en développement actif, en **bêta publique** — le contenu et l'équilibrage évoluent
régulièrement, et une remise à zéro des comptes reste possible tant que le jeu n'est pas stabilisé.

Quelques convictions qui guident les choix :

- **Fidélité à l'esprit BDO** avant tout : les mécaniques (PA/PD par zone, enchantement, paliers de
  stuff) suivent d'aussi près que possible la vraie logique du jeu, plutôt que d'inventer un système
  simplifié « idle générique ».
- **La communauté a la priorité sur le plan initial.** Les retours du Discord et les rapports de bug
  passent avant la feuille de route — si un choix ne convient pas, il est ajusté, quitte à revenir sur
  une fonctionnalité déjà livrée.
- **Aucun asset réel** de Black Desert Online n'est utilisé : tout ce qui se voit à l'écran est une
  création originale, inspirée mais jamais copiée.
- **Progression transparente** : chaque changement, même mineur, est documenté dans les notes de
  version en jeu (catégorisées : nouveautés, équilibrage, corrections, sécurité...).

### Ce qui arrive

- Extension du contenu vers les régions suivantes (Heidel → Calpheon → Valencia → Edana), voir le
  détail zone par zone et l'économie visée dans [`roadmap.md`](docs/roadmap.md).
- Poursuite de l'équilibrage PA/PD/loot au fil des retours joueurs.
- Amélioration continue de l'expérience mobile/tablette.
- Poursuite du découpage du code par domaine (voir `core/`, seul dossier encore volumineux) à
  mesure que le jeu grossit, toujours sans casser la version en ligne — chaque dossier a son
  propre `README.md` détaillant son rôle.

## Contribuer / signaler un bug

Le plus efficace : passer par le [Discord](https://discord.gg/fEubtqMjtP) ou ouvrir une
[issue GitHub](https://github.com/Maxyull/black-desert-idle/issues). Tout retour est lu — bug,
suggestion d'équilibrage, idée de fonctionnalité. Voir [`CONTRIBUTING.md`](CONTRIBUTING.md) pour
lancer le projet en local et les conventions de code.

## Licence

Code sous licence [MIT](LICENSE) — libre de fork/modifier/redistribuer. "Black Desert Online" et
les noms associés restent la propriété de Pearl Abyss ; ce projet est un fan-game non officiel,
sans affiliation (voir avertissement en haut de ce fichier), et tous les visuels sont des
créations originales.
