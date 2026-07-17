# backend/

Tout ce qui parle à Supabase : authentification, sauvegarde cloud, classement, détection de
nouvelle version.

**Verrou multi-session + mode hors ligne (2026-07-10, demande explicite : "Interdire multionglet,
multi navigateur and multidevice" + "Mode hors ligne")** :
- Un seul onglet/navigateur/appareil actif par compte. `mySessionId` (UUID généré une fois par
  chargement de page, jamais persisté) est envoyé à `claim_player_session()` (RPC, appelée à la
  connexion) — insère/écrase la ligne `player_sessions.session_id` de ce compte, la dernière
  session à claim gagne. `checkPlayerSession()` (appelée à chaque `heartbeatPresence()`, 20s) lit
  `check_player_session()` : si le `session_id` en base a changé, `sessionLocked = true` et
  `#sessionLockOverlay` s'affiche (bloquant, bouton "Reprendre ici" rappelle `claimPlayerSession()`
  pour reprendre la main depuis cet onglet). `advanceSim()` (`game-core.js`) et `saveToCloud()`
  (ce fichier) sont gatés sur `sessionLocked` — la session évincée ne farm plus ET n'écrase jamais
  la sauvegarde de la session active. Migration : `supabase/migrations/20260710075021_single_session_lock.sql`.
- Mode hors ligne : `isOffline` (`navigator.onLine` + events `online`/`offline`) fait basculer
  `saveToCloud()` sur `saveToLocalOfflineCache()` (localStorage, clé par `currentUser.id` via
  `offlineSaveKey()`) plutôt que d'échouer silencieusement. `pendingOfflineSync` suit s'il reste une
  sauvegarde locale à pousser ; `flushOfflineSaveIfNeeded()` la pousse au retour réseau (event
  `online`). `loadCloudSave()` retombe aussi sur ce cache si la page charge déjà hors ligne (rejoue
  une session déjà jouée en ligne au moins une fois sur cet appareil — ne couvre pas un tout premier
  chargement jamais authentifié en ligne, hors périmètre). `#offlineBanner` (non bloquant) informe le
  joueur. `checkPlayerSession()` ignore l'appel tant qu'`isOffline` est vrai — jamais de faux verrou
  posé sur une simple coupure réseau (seul un vrai `data === false` renvoyé par le serveur verrouille).
- **Bug corrigé (2026-07-10, trouvé par `tests/companions.spec.js`)** : `signInForTest()` fabrique
  `currentUser` localement sans vraie session Supabase (voir ce fichier de test) — `auth.uid()`
  était donc NULL côté serveur, faisant échouer `claim_player_session()` silencieusement puis
  `check_player_session()` renvoyait `false` par sécurité, verrouillant à tort TOUTE l'UI de test
  (`#sessionLockOverlay` intercepte tous les clics). Corrigé par `sessionClaimOk` : `checkPlayerSession()`
  ne peut plus poser `sessionLocked=true` tant qu'un `claim_player_session()` n'a pas d'abord
  réussi sans erreur. Test : `testCheckPlayerSessionRequiresSuccessfulClaimFirst` (`tests/tests.js`).
- Politique de test : voir CLAUDE.md §11 "Politique tests en ligne + hors ligne" — tout nouveau test
  réseau doit désormais couvrir les deux scénarios, rétroactivement aussi pour le code réseau déjà
  existant. Tests : `testAdvanceSimSkipsAllEffectsWhenSessionLocked`,
  `testOfflineCacheRoundTripsPerUserAndTracksPendingSync`, `testSaveToCloudGuardsSessionLockAndOffline`,
  `testCheckPlayerSessionNeverLocksOnNetworkFailure` (`tests/tests.js`).

## Découpage du 2026-07-22 (audit repo P5)

`game-supabase.js` avait atteint **3 124 lignes** — trois fois la limite de découpe obligatoire de
CLAUDE.md — et mélangeait le client Supabase avec des tutoriels, un wiki, l'échelle d'interface et
un dictionnaire de traduction. 1 380 lignes en sont sorties vers 6 fichiers, **par transplantation :
aucune ligne réécrite, seulement déplacée** (le bundle produit est resté identique à l'octet près,
c'est ce qui a rendu l'opération sûre).

| Fichier | Rôle |
|---|---|
| `client-health.js` | `CURRENT_VERSION`, détection de maj (`checkForUpdate`), erreurs JS non gérées, `clearGameCache()` |
| `wiki-codex.js` | `WIKI_SECTIONS`, Codex, Confiance & Sécurité, et `openInfo()`/`#infoOverlay` **partagé** avec Compendium/Succès/Patch notes |
| `patch-notes-panel.js` | la **vue** des patch notes (pagination, badge non-lu, rendu). Les données sont dans `meta/patch-notes-data.js` |
| `../core/i18n-legacy.js` | le dictionnaire `I18N` historique + `applyI18n()` (coexiste avec i18next — voir `docs/I18N_PLAN.md`) |
| `../core/ui-layout.js` | côté du menu, repli des panneaux, échelle d'UI — préférences locales, zéro réseau |
| `../progression/tutorials.js` | moteur de tutoriel + les 3 parcours (Velia, Compendium, Cron) |

> **L'ordre des `<script>` est le contrat, pas la hiérarchie des dossiers.** Ces 6 fichiers sont
> déclarés dans `index.dev.html` juste après `game-supabase.js`, dans l'ordre exact qu'ils
> occupaient dans le fichier d'origine. Pas de modules ES ici : un seul scope global, et un
> `const`/`let` de haut niveau lu au chargement explose si l'ordre bouge (CLAUDE.md §6) —
> `client-health.js` lit `PATCH_NOTES[0].v` au chargement. Ne pas réordonner « pour ranger par
> dossier ».

- `game-supabase.js` — client Supabase, auth (email + Discord), chargement/sauvegarde de la
  partie, `syncPlayerStats()` (classement), présence, verrou de session, mode hors ligne.
  Charge après `meta/patch-notes-data.js`.


**Wiki — panneau plein écran (2026-07-11, demande explicite : port à l'identique d'un mockup
externe fourni, sidebar/breadcrumb/article/infobox/sommaire/recherche — voir CLAUDE.md §30
"Maquettes externes")** :
- `wiki-panel.js` (même dossier) remplace l'ancienne modale à onglets plats (`openInfo()` +
  ex-`renderWikiHtml()`, supprimée) par `openWikiPanel()`/`#wikiOverlay` — charge APRÈS ce fichier,
  câblé sur `$a('btnWiki').onclick`. `WIKI_SECTIONS`/`renderCodexHtml()`/`renderTutoPageHtml()`
  restent définis ICI et sont réutilisés tels quels par le nouveau panneau (aucune duplication de
  contenu) ; `startTutorial(TUTORIAL_STEPS, {trackId:'onboarding'})` reste le seul point d'entrée
  du tutoriel d'arrivée, préservé dans `wiki-panel.js`.
- Le mockup fourni mélangeait des sujets qui vivent réellement dans des panneaux séparés
  (Compagnons = iframe isolée §28, Compendium Zones/Boss/PEN = `compendium-react.js`) : la sidebar
  du nouveau Wiki les référence comme des raccourcis (`openCompanionsModule()`/
  `openCompendiumReact()`/`openPatchNotesReact()`), jamais comme du contenu Wiki dupliqué/inventé.
- Palette : couleurs du mockup reprises à l'identique (demande explicite), pas la palette
  officielle §29 — scopées sous `#wikiOverlay` uniquement (CSS injectée en JS à la première
  ouverture), même logique que le `:root` propre au module Compagnons.

**Classement (jeu principal) — `leaderboard-panel.js` (même dossier)** : `openLeaderboard2()`
(câblé sur `$a('btnLeaderboardTopbar')`, `game-supabase.js` — le doublon sidebar `#btnLeaderboard`
a été retiré le 2026-07-13, voir CLAUDE.md) ouvre le panneau via `openInfo()`/
`#infoOverlay` — podium des 3 premiers + tableau paginé + recherche + "Ma position", sur la table
`player_stats` (déjà alimentée par `syncPlayerStats()`, ce fichier-ci). Catégories définies dans
`LB2_CATS_()` (fonction, pas un objet figé, car labels/tips passent par `i18next.t()` à chaque
appel) : `silver`/`gs`/`zone`/`sh`/`kpm`/`item`/`treasure` + **`compendium`** (2026-07-11,
`r.compendium_pct`, déjà calculé par `compendiumOverallPct()`/`core/game-core.js` et déjà envoyé à
chaque sync — jamais utilisé par un classement avant ce jour).
- **Reskin "Zone" + refonte (2026-07-11, mockup validé itérativement avec l'utilisateur, voir
  CLAUDE.md §30)** : podium/tableau réutilisent toujours `.bossPodium`/`.bossPodiumStep`/
  `.admTable`/`.catTab` (aucune nouvelle palette, uniquement les tokens déjà posés par la refonte
  Zone/Boss — `--s1`/`--s2`/`--dbBorder`/`--gold`/`--gold2`/`--green2`/`--cream2`/`--cream3`).
- **"Ta position"** (`.lb2YourRankBar`) : quand le rang réel du joueur (`lb2ComputeYourRankInfo()`,
  fonction PURE, testable indépendamment de l'état du module) dépasse `LB2_TOP_N` (20), une barre
  affiche son rang exact + sa valeur + le total de joueurs classés dans la catégorie — calculé sur
  les lignes déjà chargées (`.select('*').limit(500)`, aucune requête supplémentaire). Masquée en
  mode "Ma position" (`lb2ShowMeOnly`, montre déjà le voisinage du rang).
- **"vu il y a Xmin/Xj"** (`lb2SeenInfo()`, podium ET tableau) : calcul pur depuis
  `player_stats.updated_at`, réutilise `pneRelativeTime()` (`progression/patch-notes-engage-
  react.js`, charge avant ce fichier) plutôt que dupliquer un formatage relatif de plus. Vert
  (`--green2`) si vu il y a moins d'1h.
- **Panneau invité stylé** (`lb2GuestGateHtml()`) : remplace l'`alert()` brut de
  `marketRequireAuth()` (`market/market.js`, non modifié) pour ce point d'entrée précis — réutilise
  le texte EXACT de `market:market.auth_verified_required` et le VRAI bouton `#btnLinkAccount`
  (déjà câblé plus haut dans ce fichier) plutôt que de dupliquer le flux de liaison de compte.
  `openLeaderboard2()` ne bloque avec l'`alert()` historique que si `!sb || !currentUser` (aucune
  session du tout, cas rare) — jamais pour un simple compte invité.

## 2e vague de découpe (2026-07-22)

`game-supabase.js` restait à 1 751 lignes après P5 (toujours au-dessus de la limite CLAUDE.md). Trois
domaines bornés en sont sortis, ramenant le fichier à **807 lignes** (auth, cloud save, verrou de
session, offline, télémétrie — le vrai noyau Supabase) :

| Fichier | Rôle | Ordre de chargement |
|---|---|---|
| `presence.js` | joueurs en ligne / zones / Velia / admin + télémétrie AFK | après game-supabase (refs runtime) |
| `account-panel.js` | panneau "Mon compte" (identité, parrainage) | après game-supabase (câblé par onclick= HTML) |
| `auth.js` | auth multi-provider + magic link + recovery **+ le point d'entrée de l'appli** | **en dernier** |

> **`auth.js` charge en dernier, et ce n'est pas négociable.** Il contient l'IIFE de démarrage
> (`sb.auth.getSession()` → `onAuthed` / `startGuestOrShowAuth`) et le câblage des boutons qui lit
> `AUTH_MODES` **au chargement**. S'il remontait avant un fichier qui appelle une fonction auth au
> chargement, ça casserait en silence côté dev (le bundle prod, lui, concatène tout — cf. le bug
> `btnClearCacheAuth` de P5). Un test (`testGameSupabaseSplitKeepsOriginalScriptOrder`) verrouille
> le fait qu'`auth.js` reste le dernier `<script src="src/...">`.
