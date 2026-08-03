# Politique de confidentialité — Black Desert Idle
# Privacy Policy — Black Desert Idle

*Dernière mise à jour / Last updated : 2026-07-16*

**FR** · Black Desert Idle est un projet amateur, gratuit et open source, hébergé dans l'Union européenne (Supabase, région `eu-west-1`). Cette page explique **quelles données on collecte, pourquoi, combien de temps, et comment les supprimer** — en langage clair.

**EN** · Black Desert Idle is a free, open-source fan project hosted in the EU (Supabase, `eu-west-1`). This page explains **what data we collect, why, for how long, and how to delete it** — in plain language.

---

## Données collectées / Data collected

| Donnée / Data | Quand / When | Pourquoi / Why |
|---|---|---|
| **Adresse email** | Création de compte email | Connexion, réinitialisation de mot de passe. Jamais affichée aux autres joueurs, jamais renvoyée au navigateur (résolution serveur). |
| **Identité OAuth** (ID Discord/Google/GitHub/Twitter) | Connexion via un provider | Authentification. Le scope Discord `guilds.join` sert uniquement à te proposer de rejoindre le serveur communautaire. |
| **Pseudo** | Tu le choisis | Affichage public (chat, classement, marché). |
| **Sauvegarde de jeu** | En jouant | Progression (or, inventaire, niveaux…) synchronisée dans le cloud. |
| **Présence / activité** | En jouant | Compteur "en ligne", classements, statistiques de jeu. |
| **Logs d'erreur** (message technique, URL, version, user-agent) | En cas de bug | Débogage. Pas d'adresse IP stockée dans ces logs applicatifs. |

| **Mesure d'audience** (page vue, date, référent, pays, type d'appareil) | En visitant le site | Savoir combien de joueurs arrivent et d'où. Mesurée par **Umami**, un logiciel libre hébergé sur **notre propre serveur en France** : rien n'est transmis à un tiers. Sans cookie, sans identifiant persistant, et **aucune adresse IP n'est enregistrée** (elle sert le temps de la requête à calculer un identifiant de visite anonyme qui change chaque jour). |

Nous **ne vendons pas** tes données, **ne faisons pas** de publicité, et **n'utilisons pas** de traqueurs tiers ni de régie publicitaire. Pas de cookie publicitaire, et aucune bannière de consentement : la mesure d'audience ci-dessus relève de l'exemption prévue par la CNIL parce qu'elle est auto-hébergée, sans cookie et sans suivi d'un site à l'autre.

*(Note technique : l'hébergeur Supabase peut conserver des logs d'infrastructure — dont des IP — à des fins de sécurité/anti-abus, selon sa propre politique. Voir supabase.com/privacy.)*

## Durée de conservation / Retention

- **Sauvegarde & compte** : conservés tant que le compte existe.
- **Messages de chat** : conservés pour l'historique du salon ; supprimables par la modération.
- **Logs d'erreur** : purgés automatiquement (rétention courte).

## Tes droits (RGPD) / Your rights (GDPR)

Tu peux, à tout moment :
- **Accéder** à tes données (sauvegarde exportable, backups Supabase côté serveur).
- **Rectifier** ton pseudo / tes infos.
- **Supprimer** ton compte et tes données (**droit à l'oubli**).

**Comment / How :** demande via le salon Discord ou une [issue GitHub](https://github.com/Maxyull/black-desert-idle/issues) (sans info sensible publique) ou l'email de contact du projet. On traite la demande de suppression dès que possible.

## Sécurité / Security

Voir [`SECURITY.md`](SECURITY.md). En résumé : autorisation vérifiée côté serveur (RLS), aucun secret dans le code client, contenu utilisateur échappé (anti-XSS), scans automatisés (CodeQL, gitleaks), HTTPS forcé.

## Contact

- 💬 Discord : https://discord.gg/fEubtqMjtP
- 🐙 GitHub : https://github.com/Maxyull/black-desert-idle

> Projet non officiel, sans affiliation avec Pearl Abyss.
