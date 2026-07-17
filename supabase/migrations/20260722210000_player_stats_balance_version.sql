-- balance_version : équilibrage sous lequel les records À VIE (gearscore/ap/dp) ont été calculés.
-- (2026-07-22) bestAp/bestDp ne redescendent jamais côté client, et les migrations qui les
-- recalculent après un nerf (V403/V405) sont CÔTÉ CLIENT : elles ne tournent qu'à la connexion.
-- Un joueur parti avant un nerf garde donc éternellement son record d'avant-nerf dans player_stats,
-- au-dessus de tous les joueurs actifs. Cas réel : un joueur inactif depuis le 09/07 (jamais passé
-- par V405, livrée le 12/07) en tête du classement GS avec 435, quand le max atteignable est 424.
--
-- Le serveur ne peut PAS recalculer lui-même : il ne connaît pas la formule PA/PD, et la dupliquer
-- en SQL garantirait qu'elle diverge au prochain rééquilibrage — précisément le bug corrigé par
-- V403 ("changements de reqDP jamais répercutés"). On estampille donc la version à la synchro et
-- le classement GS écarte les lignes trop anciennes ; la ligne se corrige d'elle-même au retour du
-- joueur (migration client, puis réestampillage). Aucune règle de jeu dupliquée ici.
--
-- default 0 : toutes les lignes existantes sont considérées "équilibrage inconnu/ancien" et sont
-- donc écartées du classement GS jusqu'à leur prochaine synchro — ce qui est le comportement
-- voulu (les clients actifs se réestampillent en quelques secondes à la connexion).
alter table public.player_stats
  add column if not exists balance_version smallint not null default 0;

comment on column public.player_stats.balance_version is
  'Version d''équilibrage (BALANCE_VERSION, src/core/game-core.js) sous laquelle gearscore/ap/dp ont été calculés. Le classement GS ignore les lignes d''une version antérieure à la version courante du client.';

-- index partiel : le classement GS ne lit que les lignes à jour.
create index if not exists player_stats_balance_version_idx
  on public.player_stats (balance_version);
