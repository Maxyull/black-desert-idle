# Black Desert Idle — Plan Menu Admin (adapté au projet)

> Ce document remplace un plan initial pensé pour un stack React/SaaS d'équipe (Sentry, i18n
> editor, A/B testing, CGU/RGPD légal, staging isolé, équipe multi-rôles, dons/vote communautaire,
> webhooks Make.com/Slack...). Ce projet est un jeu solo-dev en JS vanilla (pas de React, pas de
> build framework, un seul admin identifié par email en dur), backend Supabase, déployé sur
> GitHub Pages. Le plan ci-dessous ne garde que ce qui est réellement buildable et utile à cette
> échelle, sans infrastructure qui n'existe pas.

---

## 0. État des lieux — ce qui existe déjà

Le panneau admin (`src/admin/admin-panel.js`, `src/admin/enh-debug-tools.js`, ouvert via
`openTesterPanel()`) couvre déjà une bonne partie du plan initial :

| Déjà en place | Où |
|---|---|
| Liste des joueurs (silver, GS, PA/PD, niveau, record kills/min) | onglet `Joueurs` (`Stats`) |
| Screenshot lecture seule de l'équipement/sac d'un joueur par UUID | `Joueur précis` → `btnScreenshotPlayer` |
| Reset d'un joueur précis / de tous les comptes (avec message expliqué au joueur) | `Joueur précis` / `Serveur` |
| Reset des quêtes (perso / tous) | `Moi` / `Serveur` |
| Rôles Modérateur (suppression de messages chat) / Testeur (accès anticipé) par UUID | `Joueur précis` → `admRoleList` |
| Spawn/despawn de World Boss (perso ou global, durée ciblée) | `Moi` / `Serveur` |
| Fermeture d'urgence du Marché + annulation en masse (remboursement) | `Serveur` → section `🏛️ Marché` |
| Silver & temps de jeu / heure, registre de silver par catégorie, richesses (Lorenz-like) | onglets `Stats` |
| Ressources farmées, Trésor de Velia (estimation de rareté), Pierres de Cron, Loyalties | onglets `Stats` |
| Bascule table de loot V1 / V2 réversible en un clic | onglet `Stats → Table de loot` |
| Logs Discord de toutes les actions sensibles (`logToDiscord`) | partout, salon dédié |
| Anti-triche : bornage automatique des champs `player_stats` + alerte Discord | `clamp_player_stats()` (Supabase), voir CLAUDE.md §12 |
| Aperçu récompense Kzarka/Vell (rang, podium) | `bossRewardSelectorHtml` |

Ne pas re-développer ce qui précède — l'inventaire ci-dessus sert de référence pour ne pas
dupliquer un onglet déjà fait sous un autre nom.

### 0bis. Roadmap confirmée mais pas encore construite (2026-07-19)

Contrairement à la lecture initiale de ce plan : **Donations, Guildes et potentiellement PvP sont
des features de jeu réellement prévues**, pas écartées. Aucune des trois n'existe encore dans le
code (pas de table `guilds`, pas de plateforme de dons connectée, pas de système PvP) — ce ne sont
donc PAS des onglets admin à construire aujourd'hui, mais la navigation admin ne doit plus les
barrer/exclure comme le reste du §4 : les prévoir comme emplacements réservés (grisés, "🔜 prévu"),
pas comme définitivement hors périmètre. Revenir sur cette section une fois que chacune de ces
features a un premier morceau de code réel côté jeu (table Supabase, système client) — c'est à ce
moment-là que l'onglet admin correspondant devient pertinent à construire.

---

## 1. 🎨 Design System (adapté, zéro nouvelle dépendance)

Le jeu a déjà une identité visuelle (`src/styles/styles.css`) — le panel admin doit s'y fondre,
pas importer une palette SaaS froide (bleu/émeraude, Cinzel/Inter/JetBrains Mono) qui jurerait
avec le reste du jeu et ajouterait une dépendance Google Fonts inexistante aujourd'hui (aucun
`<link>` de police externe dans `index.dev.html`).

### Palette (réutilise les variables CSS existantes)

| Rôle | Variable existante | Valeur |
|---|---|---|
| Fond | `body` | `#0b0a0e` |
| Surface (cards) | `--panel` | `#16151a` |
| Surface secondaire | `--panel-2` | `#1e1c22` |
| Accent principal (or, positif) | `--gold` | `#c9a55a` |
| Accent atténué | `--gold-dim` | `#8a7038` |
| Danger / ban / alerte critique | `--danger` | `#c05545` |
| Texte principal | `--ink` | `#e8e0cf` |
| Texte atténué | `--ink-dim` | `#9a917e` |
| Positif secondaire (déjà utilisé : succès, "en ligne") | — | `#8fc98a` (à promouvoir en variable `--ok` si réutilisé souvent) |
| Info / neutre (déjà utilisé pour "Évasion", liens) | — | `#5a8fc8` / `#9cc9e8` |

Ne PAS introduire de nouvelle couleur froide type émeraude/bleu SaaS — réutiliser `#8fc98a` (déjà
la couleur "succès" du jeu, ex. Compendium complet) comme équivalent du "positif" du plan initial.

### Typographie (aucune police externe)

| Rôle | Police | Usage |
|---|---|---|
| Titres | `Georgia, 'Times New Roman', serif` (déjà la police globale du jeu) | Titres de section admin, cohérent avec le reste du jeu |
| Texte UI | héritée (sans-serif système via les éléments de formulaire) | Labels, boutons |
| Valeurs chiffrées | `monospace` (stack système : déjà utilisé ex. `admRoleUuid`, `font-family:monospace`) | Silver, UUID, dates, stats — même principe que "JetBrains Mono" du plan initial, sans charger de police |

Si un jour une vraie police monospace stylée est voulue (ex. JetBrains Mono), ce sera un choix
explicite à valider avec l'utilisateur (ajout d'un `<link>` Google Fonts = nouvelle dépendance
externe, latence de chargement, à peser).

### Composants réutilisables (déjà existants, à garder comme base)

| Composant existant | Rôle |
|---|---|
| `.admTable` | Table de données (joueurs, ledger) |
| `.admStatTile` / `.admStatTiles` | Carte KPI compacte |
| `.admSection` + `.admSectionTitle` / `.admSectionSub` | Bloc d'action avec avertissement |
| `.admHint` / `.admHint.warn` | Texte d'aide / avertissement |
| `.admEmpty` | État vide ("Pas encore de données") |
| `.catTabs` / `.catTab` / `.catPane` | Système d'onglets déjà utilisé PARTOUT (admin, compendium, wiki, loot) — le réutiliser systématiquement, jamais un nouveau système d'onglets |
| `.admRiskLegend` (bleu/rouge/vert) | Légende de risque déjà en place — étendre plutôt que réinventer |

### Principes directeurs (adaptés)

- **Cohérence avec le jeu, pas avec un panel SaaS générique** : même palette or/sombre, même
  police Georgia, mêmes composants `.adm*`/`.catTab*` déjà en place.
- **Chiffres en monospace**, toujours (déjà appliqué par endroits, à généraliser).
- **Une couleur = un sens constant**, déjà respecté (`--danger` = destructif, `--gold` = normal/
  positif, bleu = sans risque perso, vert = gestion) — voir `.admRiskLegend` existante.
- **Densité assumée**, déjà le cas (`.admTable` dense, onglets nombreux).
- **Zéro nouvelle dépendance externe** (pas de framework CSS, pas de police externe, pas de lib
  de graphiques — les `sparkline`/`donut`/`Sankey` du plan initial, si un jour utiles, se feraient
  en SVG/canvas fait main comme le reste du jeu, jamais via une lib npm ajoutée au bundle).

---

## 2. Menu adapté (arborescence réaliste)

```
Panel Admin (openTesterPanel)
├── Moi                          ← existe déjà
├── Joueur précis                ← existe déjà (screenshot, reset, rôles)
├── Serveur                      ← existe déjà (reset global, boss global, marché)
└── Stats                        ← existe déjà (9 onglets analytics + loot version)
    ├── Joueurs
    ├── Silver & temps de jeu / heure
    ├── Silver (registre)
    ├── Ressources farmées
    ├── Richesses
    ├── Trésor de Velia
    ├── Pierres de Cron
    ├── Loyalties
    ├── Table de loot (V1/V2)
    ├── Sanctions                ← NOUVEAU (ban/mute, voir §3.1)
    └── Patch notes              ← NOUVEAU (mini-éditeur, voir §3.2)
```

Rien de plus n'est ajouté au premier niveau — le plan initial proposait ~40 pages organisées en
7 catégories de sidebar ; ça suppose une équipe d'admins et un jeu à grande échelle. Ici, DEUX
ajouts concrets suffisent à combler les vrais manques identifiés en §0 (pas de mécanisme de ban,
pas d'éditeur de patch notes) — le reste de la liste originale est traité en §4 (cut list).

---

## 3. Nouveautés proposées (buildables avec le stack actuel)

### 3.1 Sanctions (ban / mute)

Aujourd'hui il n'existe **aucun mécanisme de bannissement** — seulement un reset de compte (perte
de progression, pas un blocage d'accès). Ajout minimal :

- Nouvelle colonne `profiles.banned_until` (timestamptz, NULL = pas banni) + `profiles.ban_reason`
  (text) — migration Supabase (`supabase/migrations/`).
- RPC `admin_ban_player(p_user_id, p_duration_hours, p_reason)` / `admin_unban_player(p_user_id)`,
  `SECURITY DEFINER`, vérifie l'email admin comme les RPC existantes (`admin_reset_all_quests`
  comme modèle).
- Vérification côté connexion : si `banned_until > now()`, refuser la session ou rediriger vers un
  écran "Compte suspendu jusqu'à... — Motif : ..." (texte FR/EN comme le reste du jeu).
- UI : nouvel onglet `Sanctions` dans `Stats`, réutilise `.admTable` — liste des bans actifs
  (joueur, motif, expiration, bouton "Lever la sanction"), et un formulaire à côté de `Joueur
  précis` existant (réutilise le champ UUID déjà là) pour bannir directement depuis cette section
  plutôt que dupliquer un champ UUID.
- Motifs prédéfinis simples (select) : Triche / Exploit / Harcèlement / Autre — pas de système de
  workflow d'appel complexe, un ban levé manuellement suffit à cette échelle.
- Log Discord à chaque ban/unban (même convention que le reste, `logToDiscord`).

### 3.2 Patch notes — mini-éditeur admin

`meta/patch-notes-data.js` est aujourd'hui édité à la main par l'agent/l'utilisateur à chaque
session de code — ça reste très bien pour l'instant (pas de redéploiement séparé nécessaire, le
fichier fait partie du build). Un "éditeur" complet (brouillon/planifié/publié, markdown riche,
versioning) est disproportionné pour un fichier JS committé avec le reste du code.

Ce qui est réellement utile à ajouter : un **outil admin en jeu** pour prévisualiser une entrée de
patch note AVANT de la committer (évite de reload/build pour vérifier le rendu) :

- Nouvel onglet `Patch notes` dans `Stats` : textarea JSON (un objet `{v, d, name, fr, en}`
  collé/édité à la main) + bouton "Prévisualiser" qui rend cette entrée avec la même fonction que
  le vrai panneau patch notes (`renderPatchEntryHtml` ou équivalent, voir `game-supabase.js`) —
  aucune écriture disque, juste un rendu miroir pour vérifier le HTML avant de le coller dans
  `patch-notes-data.js`.
- Pas de "publication planifiée" ni de statut Brouillon/Publié : le fichier est déjà versionné par
  git, un commit = une publication, cohérent avec le workflow existant (CLAUDE.md §9).

---

## 4. Ce qu'on ne fait PAS (et pourquoi)

Repris du plan initial, volontairement écarté à cette échelle — à ne PAS développer par
anticipation (même principe que la Phase 6 du plan initial, mais formalisé ici comme un choix
définitif tant que le contexte ne change pas) :

| Écarté | Raison |
|---|---|
| Refonte React des composants | Le jeu est vanilla JS à scope global partagé (CLAUDE.md §7) — un refactor React serait une réécriture complète, pas une feature admin |
| Sentry / Web Vitals dashboard | Pas de compte Sentry, pas de trafic justifiant un monitoring dédié ; les erreurs JS sont déjà visibles via `preview_console_logs` en dev |
| Feature flags génériques + A/B testing | Le jeu a déjà des vrais toggles ciblés (`S.lootTableVersion`, ouverture Marché) — un système générique de flags par segment de joueurs n'a pas d'usage concret aujourd'hui |
| Éditeur i18n avec clés manquantes | Le jeu utilise des objets `{fr,en}` en dur dans le code, pas un système de clés externalisées — un éditeur supposerait une réécriture du système de traduction entier |
| Webhooks Make.com / Slack / custom | Discord (`logToDiscord`) couvre déjà 100% des besoins de notification actuels ; ajouter un système générique sans second besoin concret est prématuré |
| Sandbox / Staging isolé | Un seul projet Supabase, pas de budget pour un second ; les tests se font sur `index.dev.html` + compte démo (déjà le workflow établi) |
| CAPTCHA / anti-bot dédié | Pas de signal de bot détecté à ce jour ; Supabase Auth gère déjà les bases (rate limiting) |
| RGPD complet (registre des traitements, délais légaux formels) | Projet non commercial, sans CGU formelles à ce jour — un export/suppression de compte simple (déjà couvert par `resetAllAccounts`/reset par UUID, qui efface la progression) suffit tant qu'il n'y a pas de structure légale derrière le projet |
| CGU versionnées + tracking d'acceptation | Idem — pas de CGU publiées aujourd'hui, prématuré sans texte légal réel à faire accepter |
| Équipe admin multi-niveaux (5 rôles, invitations par email) | Un seul admin identifié par email en dur (`maxime.lacoste@icloud.com`) — les rôles Modérateur/Testeur existants suffisent, pas besoin d'un système d'invitation/révocation tant qu'il n'y a qu'une seule personne au-dessus |
| Recherche globale `Cmd+K` | Utile seulement si le panel devient beaucoup plus dense qu'aujourd'hui (~15 onglets réels vs ~40 dans le plan initial) |
| Dashboard "Santé économique" complet (Sankey, vélocité par segment, silver decay) | Le registre de silver par catégorie + richesses (Lorenz) existants couvrent déjà l'essentiel du signal utile ; un simulateur "what-if" complet est un projet à part entière, à reconsidérer si une vraie dérive inflationniste est constatée dans les données déjà collectées |
| Open-source / GitHub dashboard intégré | `gh` CLI (déjà utilisé dans les sessions de code) couvre le besoin ponctuel de consulter issues/PRs — un dashboard dédié dans le jeu n'apporte rien de plus |

**Déclencheur de réévaluation** : si le jeu dépasse ~500 joueurs actifs simultanés, si une
deuxième personne rejoint l'administration, ou si une vraie dérive économique (inflation
runaway) est constatée dans les données déjà collectées (registre silver, richesses) — revisiter
cette liste à ce moment-là, pas avant.

---

## 5. Tests

Convention du projet (CLAUDE.md §11) : **test unitaire + test de régression pour toute nouvelle
fonctionnalité**, ajoutés à `tests/tests.js` et appelés dans `window.runRegressionTests()`.

### Pour les Sanctions (§3.1)

- **Unitaire** : `admin_ban_player`/`admin_unban_player` posent/lèvent bien `banned_until` — testé
  côté Supabase (via `execute_sql` en session de dev) plutôt que dans `tests.js` (RPC serveur, pas
  de logique client à tester directement).
- **Client** : test que la vérification de connexion bloque bien un compte dont `banned_until`
  est dans le futur, et laisse passer un compte dont `banned_until` est `null` ou dans le passé —
  fonction pure testable (`isBanned(profile)` ou équivalent), à isoler du RPC réseau pour rester
  testable en synchrone dans `tests.js` :
  ```js
  function testIsBannedRespectsExpiry() {
    if (typeof isBanned !== 'function') return;
    assert('Pas banni si banned_until est null', !isBanned({ banned_until: null }));
    assert('Banni si banned_until est dans le futur', isBanned({ banned_until: new Date(Date.now()+3600000).toISOString() }));
    assert('Plus banni si banned_until est dans le passé', !isBanned({ banned_until: new Date(Date.now()-3600000).toISOString() }));
  }
  ```
- **Régression** : garde-fou contre un ban qui bloquerait aussi l'accès admin lui-même (le compte
  admin ne doit jamais pouvoir se bannir par erreur via l'UI — bouton désactivé si UUID cible ===
  UUID admin courant).

### Pour l'éditeur de Patch notes (§3.2)

- **Unitaire** : la fonction de prévisualisation produit le même HTML que le vrai rendu en jeu
  pour une entrée identique (comparer `renderPatchEntryHtml(entree)` appelé depuis l'aperçu admin
  vs depuis le vrai panneau patch notes — doit être LA MÊME fonction, jamais une copie, sinon les
  deux dérivent avec le temps).
  ```js
  function testPatchPreviewUsesSameRendererAsRealPanel() {
    if (typeof renderPatchEntryHtml !== 'function' || typeof buildPatchNotesPreviewHtml !== 'function') return;
    const entry = PATCH_NOTES[0];
    assert('L\'aperçu admin utilise EXACTEMENT le même rendu que le vrai panneau',
      buildPatchNotesPreviewHtml(entry) === renderPatchEntryHtml(entry));
  }
  ```
- **Régression** : un JSON malformé collé dans le textarea affiche un message d'erreur clair
  plutôt qu'une exception qui casse le panneau admin entier (`try/catch` autour du `JSON.parse`).

### Général

- Chaque nouvel onglet Stats (`Sanctions`, `Patch notes`) suit le pattern déjà établi
  (`cats.push({ id, icon, label, body })`) — un test de régression simple garantit que l'onglet
  apparaît bien dans `tabsHtml`/`panesHtml` une fois ajouté, empêchant un oubli de câblage futur
  (même famille que `testActivityTabLockIsSeparateFromLabel` déjà dans `tests.js`).
- Après implémentation : build + `window.runRegressionTests()` sur `index.dev.html`, vérification
  comportementale via `preview_eval` (ban un compte de test, vérifier le blocage ; coller un JSON
  de patch note, vérifier l'aperçu), puis check rapide sur `index.html` (bundle) — workflow
  standard du projet (CLAUDE.md §9), rien de spécifique à inventer pour l'admin.

---

## 6. Priorités

Contrairement au plan initial (6 phases, ~40 pages), il ne restait que deux ajouts concrets non
couverts par l'existant :

1. ~~**Sanctions (ban/mute)**~~ — **FAIT (2026-07-18, V335)**. Vrai manque de sécurité (un joueur
   toxique ne pouvait être que reset, jamais bloqué). Voir `src/admin/README.md` pour les
   fichiers/RPC exacts.
2. **Mini-éditeur de patch notes (prévisualisation)** — confort de travail, pas un manque
   critique. Priorité basse, à faire quand une session de patch notes devient pénible sans.

Tout le reste de la liste originale est soit déjà fait (§0), soit explicitement écarté (§4).
