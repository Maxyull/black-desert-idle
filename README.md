# ⚔️ Velia Idle

Un jeu idle/incrémental dans le navigateur, inspiré de **Black Desert Online** — combat automatique,
progression par zones, enchantement d'équipement, et une vraie couche multijoueur (comptes, sauvegarde
cloud, marché, chat, classement, boss mondial).

🎮 **Jouer :** https://maxyull.github.io/black-desert-idle/
💬 **Discord :** https://discord.gg/fEubtqMjtP

> Projet de fan gratuit, non officiel, sans aucune affiliation ni partenariat avec Pearl Abyss. Les
> noms/styles s'inspirent de Black Desert Online pour l'ambiance ; tous les visuels (icônes, sprites)
> sont des créations 100% originales, aucun asset réel du jeu n'est réutilisé.

## Qu'est-ce que c'est ?

Tu choisis une zone adaptée à ton équipement (PA/PD requis, comme dans le vrai BDO), ton personnage
combat **automatiquement**, ramasse du loot et gagne du silver. Ce silver et ce loot servent à
enchanter ton équipement (de +1 jusqu'à PEN) pour accéder à des zones plus difficiles et plus
rentables — la boucle centrale du jeu.

## Fonctionnalités principales

- **Combat automatique** — pas de clic à répétition, l'IA de combat gère les sorts et le déplacement.
- **12+ zones de farm** groupées par palier d'équipement (Naru/Tuvala/Yuria/Grunil), chacune avec sa
  propre table de loot (butin de base, matériau, bijou rare, composant de craft).
- **Système d'enchantement fidèle à BDO** : +1 à +15 puis PRI/DUO/TRI/TET/PEN, avec risque de
  rétrogradation, failstack et protection par Pierre de Cron.
- **Comptes joueurs + sauvegarde cloud** (Supabase) — jouable aussi en invité, sans compte.
- **Hôtel des ventes** entre joueurs, **classement**, **chat** (mondial/trade/annonces, mentions @joueur).
- **Boss mondial partagé** à horaires fixes, avec classement de contribution.
- **Quêtes journalières/hebdomadaires**, **succès**, **Compendium** de progression, **Codex** des objets.
- **Compatible mobile et tablette** (adaptatif, sans rien perdre de la version ordinateur).
- **Notes de version en jeu**, changelog transparent à chaque mise à jour.

## Stack technique

Aucune dépendance, aucun build : HTML/CSS/JS vanilla + Canvas 2D, déployé tel quel sur GitHub Pages.

- `index.html` — structure de la page
- `styles.css` — toute la mise en forme
- `game-core.js` — zones, combat, inventaire, boucle de jeu, rendu
- `game-supabase.js` — comptes, sauvegarde cloud, marché, chat, notes de version
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
  détail zone par zone et l'économie visée dans [`roadmap.md`](roadmap.md).
- Poursuite de l'équilibrage PA/PD/loot au fil des retours joueurs.
- Amélioration continue de l'expérience mobile/tablette.
- Refonte progressive de la structure du code pour rester lisible et maintenable à mesure que le jeu
  grossit (sans jamais casser la version en ligne).

## Contribuer / signaler un bug

Le plus efficace : passer par le [Discord](https://discord.gg/fEubtqMjtP) ou ouvrir une
[issue GitHub](https://github.com/Maxyull/black-desert-idle/issues). Tout retour est lu — bug,
suggestion d'équilibrage, idée de fonctionnalité.
