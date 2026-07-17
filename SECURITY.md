# Politique de sécurité — Black Desert Idle
# Security Policy — Black Desert Idle

**FR** · Black Desert Idle est un projet amateur, gratuit et open source. La sécurité des joueurs et de leurs données est prise au sérieux. Merci de signaler toute faille de façon responsable.

**EN** · Black Desert Idle is a free, open-source fan project. Player security and data protection are taken seriously. Please report any vulnerability responsibly.

---

## Signaler une faille / Reporting a vulnerability

**FR**
- **Ne créez pas d'issue publique** pour une faille exploitable.
- Utilisez les **[GitHub Security Advisories](https://github.com/Maxyull/black-desert-idle/security/advisories/new)** (divulgation privée), ou le salon Discord dédié `#signaler-une-faille`.
- Décrivez : la faille, comment la reproduire, et l'impact estimé.
- Délai de première réponse visé : **72 h**. Correctif selon la gravité.
- Les rapporteurs de bonne foi sont **crédités** (avec leur accord) une fois le correctif publié.

**EN**
- **Do not open a public issue** for an exploitable vulnerability.
- Use **[GitHub Security Advisories](https://github.com/Maxyull/black-desert-idle/security/advisories/new)** (private disclosure), or the dedicated `#report-a-vulnerability` Discord channel.
- Include: the vulnerability, reproduction steps, and estimated impact.
- Target first response: **72 h**. Fix timeline depends on severity.
- Good-faith reporters are **credited** (with their consent) once the fix ships.

## Périmètre / Scope

Dans le périmètre / In scope :
- Le site du jeu (`maxyull.github.io/black-desert-idle`) et ce dépôt.
- Le backend Supabase (RLS, RPC, Edge Functions) du projet.

Hors périmètre / Out of scope :
- **Triche / falsification de score** : le jeu est un site statique où l'état est calculé côté client ; un score de classement peut être forgé et n'est pas considéré comme une faille de sécurité (voir la page "Confiance & Sécurité" du jeu). Le classement est informel.
- Déni de service par volume, ingénierie sociale, faiblesses de services tiers (GitHub, Supabase, Discord) hors de notre contrôle.

## Récompenses / Rewards — mini bug bounty

**FR** · Black Desert Idle est un projet gratuit et bénévole : pas de prime en argent, mais tout rapport de bonne foi et valide est récompensé.

**EN** · Black Desert Idle is a free, volunteer project: no cash bounty, but every valid good-faith report is rewarded.

| Gravité / Severity | Exemples / Examples | Récompense / Reward |
|---|---|---|
| **Critique / Critical** | Accès aux données d'un autre joueur, contournement d'auth, exécution serveur / *cross-account data access, auth bypass, server-side execution* | Crédit au Hall of Fame + rôle Discord dédié + cosmétique/compagnon exclusif in-game + mention dans les notes de version |
| **Élevée / High** | Élévation de privilège limitée, écriture de données non autorisée / *limited privilege escalation, unauthorized data write* | Crédit au Hall of Fame + rôle Discord + cosmétique in-game |
| **Moyenne / Medium** | XSS stocké, fuite d'information mineure / *stored XSS, minor info leak* | Crédit au Hall of Fame + rôle Discord |
| **Basse / Low** | Défaut de configuration sans impact direct / *config weakness, no direct impact* | Crédit au Hall of Fame |

**Règles / Rules**
- **FR** · Premier rapport valide d'une faille donnée = récompensé (les doublons ultérieurs sont crédités mais non re-récompensés). Testez uniquement sur **votre propre compte**. Pas de DoS, pas d'accès/altération de données d'autres joueurs, pas d'ingénierie sociale. Le respect de cette politique vous met à l'abri de toute poursuite (*safe harbor*) : un rapport de bonne foi ne sera jamais sanctionné.
- **EN** · First valid report of a given issue = rewarded (later duplicates are credited but not re-rewarded). Test only on **your own account**. No DoS, no accessing/altering other players' data, no social engineering. Acting in good faith under this policy grants you *safe harbor*: a good-faith report is never penalized.

La gravité est déterminée par le mainteneur (échelle indicative CVSS). / Severity is set by the maintainer (CVSS as a guide).

Hall of Fame des rapporteurs : [`SECURITY-HALL-OF-FAME.md`](SECURITY-HALL-OF-FAME.md).

## Bonnes pratiques déjà en place / Existing safeguards

- Autorisation vérifiée côté base (fonctions `SECURITY DEFINER` avec garde-fous, RLS deny-all sur les tables sensibles).
- Aucun secret dans le code client (seule la clé publiable Supabase est exposée, protégée par RLS).
- Contenu utilisateur (chat, pseudos, échanges) échappé avant affichage (protection XSS).
- CI : tests + vérification de build + parité i18n. Scans automatisés (CodeQL, gitleaks) en place.

Merci de contribuer à garder le jeu sûr. 🙏
