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

**Bascule des données vers le VPS (2026-08-01, demande explicite : "on va tout transvaser sur
le vps")**, outillage complet dans `D:\DEV\bdi-infra`, ici seulement le côté client.

L'**authentification reste sur Supabase cloud** (153 comptes, 4 providers OAuth qu'on ne veut
pas reconfigurer), seule la **base** descend sur un VPS OVH. Ça marche parce que le PostgREST
du VPS vérifie les jetons du GoTrue cloud avec la **clé publique** du projet : `auth.uid()`
renvoie le même UUID côté SQL, les 161 fonctions et les policies RLS n'ont pas été touchées
d'une ligne.

Le projet signe en **ES256 asymétrique** (constaté le 2026-08-02 ; la première version de ce
montage supposait un secret HS256 partagé, ce qui était faux). Bénéfice au passage : le VPS ne
détient qu'une clé de VÉRIFICATION, même entièrement compromis il ne peut forger aucun jeton.

Deux clients dans ce fichier :
- `sbAuth`, toujours le projet cloud. Porte l'auth, les edge functions, et le realtime
  (presence/broadcast des lobbies boss et miniboss, qui ne lisent jamais la base ; le chat, lui,
  fait du polling, voir `social/chat.js`). Rien de tout ça n'a bougé.
- `sbData`, le VPS quand `DATA_API_URL` est renseignée, sinon `sbAuth`. Créé avec l'option
  `accessToken` de supabase-js (mode « auth chez un fournisseur tiers ») : il ne gère aucune
  session et redemande le jeton à `jetonPourDonnees()` à chaque requête. Une seule session
  existe, celle de `sbAuth`, deux clients rafraîchissant le même `refresh_token` en concurrence
  l'invalideraient à tous les coups.

`sb` n'est plus un `SupabaseClient` mais un **`Proxy`** qui aiguille : `from`/`rpc`/`schema` vers
`sbData`, tout le reste vers `sbAuth`. Choisi après comptage, **215 appels de données contre 29
d'auth/realtime**, dans une douzaine de fichiers : réécrire 244 sites d'appel aurait garanti d'en
oublier. Conséquence à connaître : toute propriété non listée dans `VERS_DONNEES` tombe sur le
client d'auth. Si une manque un jour, elle **s'ajoute là**, pas en contournant `sb`.

Deux pièges qui ont coûté cher à trouver :
- **Aucune clé anon ne part vers le VPS.** La première version y envoyait l'ancienne clé anon
  du projet (un JWT HS256), que le PostgREST en ES256 rejette. La bonne réponse est de retirer
  complètement l'en-tête `Authorization` quand il n'y a pas de session : PostgREST retombe
  alors sur `db-anon-role`, donc le rôle `anon`, et les lectures publiques passent. C'est le
  rôle de `fetchDonnees()`, branchée en `global.fetch` du client de données. Tests :
  `testAucunJwtEnDurPourLeClientDeDonnees`, `testFetchDonneesRetireLAutorisationVide`.
- L'edge function `auth-by-identifier` fait de l'auth **et** trois RPC de données
  (`email_for_login`, `rate_limit_hit`, `rate_limit_gc`). Elles ont été scindées : sans ça, un
  joueur inscrit après la bascule ne pourrait plus se connecter par son pseudo, la fonction
  lisant un `profiles` figé. **Mais elle ne peut pas appeler le VPS en PostgREST** : sa clé
  `service_role` est un JWT HS256, le VPS ne vérifie que de l'ES256, il répond 401. Elle passe
  donc par trois routes dédiées de l'API des dashboards, protégées par un secret partagé et
  sans JWT : `bdi-infra/api/app/routes_interne.py`, variables `AUTH_INTERNE_URL` et
  `AUTH_INTERNE_SECRET`. Tant qu'elles ne sont pas posées, la fonction appelle le cloud comme
  avant, ce qui rend son déploiement neutre et la bascule réversible d'un geste.

**État : `DATA_API_URL = 'https://bdi.maxyull.fr'`, la bascule est ARMÉE** (2026-08-02). Les
données passent par le VPS, l'authentification et le realtime restent sur Supabase.
Retour arrière = remettre `''` ici et dans `companions/viewer3d.js`, rebuild, push ; le cloud
est conservé intact et rejouable pour ça. Voir `bdi-infra/migration/RUNBOOK.md`.

⚠️ **Armée dans le bundle ne veut pas dire armée chez les joueurs.** Cette constante ne prend
effet qu'au prochain chargement de page de chaque joueur, et un joueur qui ne recharge jamais
continue d'écrire dans le cloud indéfiniment. Au 2026-08-03, personne n'y avait encore basculé :
voir « Ce que le correctif de la détection de maj ne peut pas faire » plus bas.

⚠️ Les trois constantes doivent bouger **ensemble** : `DATA_API_URL`, `COMPANION_MODELS_BASE`
et les variables `AUTH_INTERNE_*` de l'edge function. Armer le client seul enverrait les
nouveaux profils sur le VPS pendant que la connexion par pseudo les chercherait encore dans le
cloud ; poser les secrets seuls produirait la panne symétrique.

Tests : `testDataApiConfigCoherente`, `testAucunJwtEnDurPourLeClientDeDonnees`,
`testFetchDonneesRetireLAutorisationVide`, `testSbRouteLesDonneesEtLAuthSeparement`,
`testJetonPourDonneesNeJetteJamaisHorsLigne`, `testCspAutoriseLeDomaineDeDonnees`
(`tests/tests.js`), plus un garde-fou de cohérence de domaine en fin de
`tests/companions.spec.js` (le module Compagnons est une iframe isolée, jamais bundlée : il
duplique le domaine et peut donc désynchroniser en silence).

## Découpage du 2026-07-22 (audit repo P5)

`game-supabase.js` avait atteint **3 124 lignes** — trois fois la limite de découpe obligatoire de
CLAUDE.md — et mélangeait le client Supabase avec des tutoriels, un wiki, l'échelle d'interface et
un dictionnaire de traduction. 1 380 lignes en sont sorties vers 6 fichiers, **par transplantation :
aucune ligne réécrite, seulement déplacée** (le bundle produit est resté identique à l'octet près,
c'est ce qui a rendu l'opération sûre).

| Fichier | Rôle |
|---|---|
| `client-health.js` | `CURRENT_VERSION`, détection de maj (`checkForUpdate` + `applyUpdateCheckResult`/`reloadForUpdate`, **le toast ne conditionne jamais le rechargement** — voir ci-dessous), erreurs JS non gérées (`reportClientError`, **prod uniquement** — voir ci-dessous), `clearGameCache()` |
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

### `reportClientError()` n'écrit que depuis la production (2026-08-03)

`reportClientError()` (`client-health.js`) insérait dans `public.client_errors` depuis n'importe
quelle origine, `http://127.0.0.1:<port>/index.dev.html` compris — donc depuis chaque
`npx playwright test` local. Mesuré sur le VPS le 2026-08-02 : **10 des 12 erreurs des dernières
24 h venaient du poste de dev**, 2 seulement de vrais joueurs. Le KPI « erreurs client 24h » du
dashboard de supervision (bdi-infra, `/api/bdi/kpis`) alertait donc dans le vide, et l'onglet
Monitoring du panneau admin affichait des erreurs qu'aucun joueur n'a jamais vues.

Filtre : `PROD_HOSTNAME` + `isProdHostname()`, **liste blanche stricte** — seul
`blackdesertidle.maxyull.fr` (= le fichier `CNAME`) passe. Tout le reste (127.0.0.1, localhost,
`::1`, IP LAN pour tester au téléphone, `*.github.io`, `file://`) est du dev et sort avant l'insert,
sans même consommer le quota `CLIENT_ERROR_MAX_PER_SESSION`. Le comportement en production est
inchangé. Un test Node (`tests/regression.spec.js`) compare `PROD_HOSTNAME` au `CNAME` : sans lui,
un changement de domaine éteindrait le monitoring **en silence**.

**Pourquoi seulement cette fonction.** `client_errors` est la seule table qu'un client sans session
Supabase valide peut écrire (`user_id is null or user_id = auth.uid()`, migration
`20260722190000_harden_client_errors_insert.sql`, et le client n'envoie pas de `user_id`). Toutes
les autres écritures (`game_saves`, `player_stats`, `farm_events`, `silver_ledger`,
`heartbeat_presence`, `log_playtime_ping`, `record_afk_session`) exigent `user_id = auth.uid()` :
les tests Playwright appellent `onAuthed()` avec un utilisateur fabriqué localement **sans jamais
ouvrir de session** (`signInForTest`, `tests/companions.spec.js`), leurs écritures sont donc
refusées côté serveur. ⚠️ Ça ne vaut PAS pour une session de dev manuelle où l'on se connecte
vraiment sur `127.0.0.1` : là, ces écritures partent pour de bon (silver farmé en local dans
`silver_ledger`, présence comptée dans « joueurs en ligne »…). Aucun filtre posé sur elles — les
couper rendrait la sauvegarde et la présence intestables en local.

### La présence porte la version du client (2026-08-03)

Suite directe de la section ci-dessous. Une fois le correctif de la détection de maj déployé, la
question « la joueuse bloquée est-elle bien repassée à jour ? » s'est révélée **sans réponse
possible** : rien n'enregistrait la version d'un client connecté. La seule colonne qui portait une
version de bundle était `client_errors.game_version`, écrite uniquement quand un client **plante**,
et dont le `user_id` est toujours `NULL` (le client ne l'envoie pas — c'est ce qui permet à un
client sans session valide d'y écrire). Ni « qui », ni « quand », ni « pendant qu'il jouait ».

`presence` est le bon porteur : le client y écrit déjà toutes les 20 s, la ligne est par joueur, et
toutes les lectures existantes filtrent déjà sur `last_seen`. Migration
`20260803120000_version_client_dans_presence.sql`.

| Pièce | Où |
|---|---|
| Colonne `presence.game_version` | `NULL` = client trop ancien pour se déclarer — c'est en soi l'information intéressante |
| `heartbeat_presence(p_zone_idx, p_version)` | nouvelle signature ; l'ancienne à un paramètre est **conservée** pour les onglets V499 déjà ouverts |
| `admin_client_versions(p_window_seconds)` | lecture staff (même patron que `admin_client_errors_*`) |
| Section admin « Versions clientes » | `admin/admin-monitoring.js`, catégorie Supervision |

⚠️ **PostgREST résout une RPC par les NOMS des clés du corps JSON.** La signature à un paramètre ne
peut donc pas disparaître tant que des clients V499 tournent, et les deux paramètres de la nouvelle
sont volontairement **sans valeur par défaut** : sinon un appel `{p_zone_idx}` deviendrait ambigu
entre les deux surcharges — le piège de `20260706030000` (heartbeat en échec en boucle, joueur qui
disparaît du compteur « en ligne »).

⚠️ **Ordre de déploiement** : la migration part sur le VPS **et** sur le cloud avant le client. Le
cloud n'est pas facultatif, c'est la cible de retour arrière (`DATA_API_URL = ''`). `heartbeatPresence()`
garde malgré tout un repli sur l'appel à un paramètre dès qu'il voit un `PGRST202`
(`estSignatureVersionInconnue()`), et le **dit** en console : une base en retard doit dégrader la
télémétrie, jamais la présence elle-même.

⚠️ `CURRENT_VERSION` est un `const` de `client-health.js`, qui charge **après** `presence.js`.
L'accès est purement au runtime, donc sûr — mais c'est la configuration exacte du piège TDZ de
CLAUDE.md §8, où `typeof` ne protège pas. D'où `versionPourPresence()`, qui `try/catch` la lecture :
si elle devenait un jour inaccessible, on perd la version, pas la présence, et jamais en silence.

### Détection de maj : le toast est un confort, jamais une condition (2026-08-03)

Le 2026-08-03, une joueuse est restée **11 h 30 sur le bundle V497** alors que la V498 était en
ligne depuis 9 heures. Sa progression est partie dans la base du cloud — que le jeu ne lit plus
depuis la bascule vers le VPS — et il a fallu recopier sa sauvegarde à la main. Le mécanisme censé
rendre les déploiements indolores est exactement celui qui a lâché, **sans un bruit**.

Son bundle contenait pourtant `checkForUpdate`, le `setInterval` de 60 s, les 4 éléments du toast
(`#updateToast`, `#updToastVer`, `#updCountdown`, `#btnReloadUpdate`) et la clé i18n
`backend.update.auto_reload_countdown` : le mécanisme était complet. **La cause exacte n'a pas été
prouvée** (un fetch en échec durable ou un onglet gelé restent possibles), mais le défaut de forme,
lui, était certain — `updateToastShown = true` était posé AVANT trois étapes faillibles (deux accès
DOM + `i18next`), le tout sous un `catch (e) {}` muet, derrière un `if (updateToastShown) return`
en tête de fonction. Une seule exception d'affichage condamnait définitivement la mise à jour.

Le correctif ne parie sur aucun de ces diagnostics :

| Garantie | Comment |
|---|---|
| Le drapeau ne ment plus | `updateToastShown` n'est plus un verrou d'entrée et n'est posé qu'**après** un `showUpdateToast()` réussi |
| Le rechargement ne dépend de rien | si la version en ligne diffère sur `UPDATE_FORCE_RELOAD_AFTER_CHECKS` (5) contrôles d'affilée, `reloadForUpdate()` part **sans toucher au DOM ni à i18next** |
| Le compte à rebours démarre toujours | le `render()` de `startUpdateCountdown()` est isolé : son échec ne peut plus empêcher l'affectation du `setInterval` qui recharge |
| Plus rien n'est avalé | `console.error` sur les deux chemins d'échec + `reportClientError()` (une seule remontée par panne, et le poste de dev est déjà filtré, voir ci-dessus) |

`applyUpdateCheckResult(latest)` est la moitié **synchrone et sans réseau** de `checkForUpdate()` :
elle existe sous cette forme parce que le harnais de `tests/tests.js` est synchrone et ne peut pas
`await`. `reloadForUpdate()` est une indirection du même ordre — `location.reload` n'est pas
redéfinissable sous Chrome, une fonction globale l'est, ce qui rend le chemin de secours testable
sans recharger la page. Gardes : `testUpdateReloadSurvivesToastException` (dynamique, le toast lève
à chaque tentative et le rechargement part quand même), `testUpdateToastFlagIsSetOnlyAfterDisplaySucceeded`,
`testUpdateFailuresAreNeverSwallowedSilently`, `testCountdownStartsEvenIfItsRenderThrows`.

⚠️ Le seuil de 5 contrôles est un **plafond, pas un délai garanti** : `visibilitychange`/`focus`
déclenchent aussi `checkForUpdate()`, donc les 5 peuvent tomber en quelques secondes si le joueur
passe d'un onglet à l'autre. C'est voulu — plus tôt vaut mieux que plus tard, et dans le chemin
nominal le compte à rebours de 15 s a déjà rechargé bien avant.

### Ce que le correctif de la détection de maj ne peut pas faire (2026-08-03)

Le correctif ci-dessus protège les clients qui chargeront le nouveau bundle. Il ne peut **rien**
pour ceux qui sont déjà bloqués : ils font tourner l'ancien code, celui qui contient le défaut.
C'est une propriété de tout correctif client, mais elle a ici une conséquence directe sur les
données, et elle a été mesurée.

Relevé le 2026-08-03 vers 11h : depuis la restauration du dump sur le VPS (2026-08-02 15:43),
**le VPS n'avait reçu aucune écriture cliente** de `presence`, `player_stats` ni `game_saves`.
Les trois joueurs actifs écrivaient tous dans le cloud, que le jeu ne lit plus. La bascule était
donc armée dans le bundle servi, et vide chez les joueurs. Il a fallu recopier la progression
compte par compte, à la main, comme le 2026-08-03 au matin.

⚠️ **Il n'existe aucun levier serveur pour forcer un rechargement, et il ne peut pas y en avoir.**
`checkForUpdate()` refetche `index.html` sur GitHub Pages, un hébergeur statique : ni le VPS ni le
cloud n'ont la moindre prise dessus. Ne pas chercher de ce côté.

Le seul levier serveur qui existe est le **verrou multi-session** : écrire un autre `session_id`
dans `player_sessions` pose `sessionLocked`, ce qui coupe `advanceSim()` et `saveToCloud()` et gèle
donc la divergence. Mais il ne recharge pas : `showSessionLockOverlay()` ne fait qu'enlever une
classe CSS, et « Reprendre ici » rappelle `claimPlayerSession()`, qui la remet. C'est un moyen
d'arrêter l'hémorragie, jamais de mettre à jour.

⚠️ **`CURRENT_VERSION` ne permet pas de savoir si un client est armé.** `DATA_API_URL` a été
remplie le 2026-08-02 à 18:59, et la patch note suivante n'est arrivée que le 2026-08-03 à 00:26 :
tout bundle construit entre les deux annonce `V497` **et** route vers le VPS. Voir aussi la section
suivante : `presence.game_version` hérite de la même limite, une version ne dit rien de la
configuration qui l'accompagne. Le seul critère fiable est **vers quelle base le joueur écrit**,
et `presence`/`player_stats` sont les bonnes tables pour le lire (le cron horaire
`credit_offline_progress_hourly` écrit dans `game_saves` des deux côtés, voir `bdi-infra/CLAUDE.md`
§ 7, et fait passer un lot serveur pour une écriture de joueur).

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
- **Accès** : `openLeaderboard2()` ne bloque avec l'`alert()` historique de `marketRequireAuth()`
  que si `!sb || !currentUser` (aucune session du tout, cas rare). Le panneau invité qui existait
  ici a disparu avec le mode invité (issue #18).

## 2e vague de découpe (2026-07-22)

`game-supabase.js` restait à 1 751 lignes après P5 (toujours au-dessus de la limite CLAUDE.md). Trois
domaines bornés en sont sortis, ramenant le fichier à **807 lignes** (auth, cloud save, verrou de
session, offline, télémétrie — le vrai noyau Supabase) :

| Fichier | Rôle | Ordre de chargement |
|---|---|---|
| `presence.js` | joueurs en ligne / zones / Velia / admin + télémétrie AFK + **version du client** (voir ci-dessous) | après game-supabase (refs runtime) |
| `account-panel.js` | panneau "Mon compte" (identité, parrainage) | après game-supabase (câblé par onclick= HTML) |
| `auth.js` | auth multi-provider + magic link + recovery **+ le point d'entrée de l'appli** | **en dernier** |

> **`auth.js` charge en dernier, et ce n'est pas négociable.** Il contient l'IIFE de démarrage
> (`sb.auth.getSession()` → `onAuthed` / `showAuthScreen`) et le câblage des boutons qui lit
> `AUTH_MODES` **au chargement**. S'il remontait avant un fichier qui appelle une fonction auth au
> chargement, ça casserait en silence côté dev (le bundle prod, lui, concatène tout — cf. le bug
> `btnClearCacheAuth` de P5). Un test (`testGameSupabaseSplitKeepsOriginalScriptOrder`) verrouille
> le fait qu'`auth.js` reste le dernier `<script src="src/...">`.
