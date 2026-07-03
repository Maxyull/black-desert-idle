-- ============================================================
-- Migration : renomme les matériaux en français + fusionne Black Stone (Arme)/(Armure)
-- Velia Idle — à exécuter UNE FOIS si tu as déjà exécuté supabase-common-market-schema.sql
-- avant cette mise à jour (sinon les anciennes lignes en anglais restent orphelines dans
-- market_prices, et toute annonce déjà en vente sous l'ancien nom reste affichée telle quelle).
--
-- Ne touche PAS aux sauvegardes des joueurs (game_saves) : les objets déjà en inventaire sous
-- l'ancien nom anglais restent tels quels (ils se vendront/consommeront normalement, juste sous
-- l'ancien libellé) — le jeu est encore en phase de démo/test, ça ne justifie pas une migration
-- plus lourde des sauvegardes existantes.
--
-- Supabase > SQL Editor > New query > Run
-- ============================================================

-- fusionne les deux Black Stone en une seule ligne "Pierre noire" (garde le prix le plus bas
-- des deux comme base, supprime l'autre)
update public.market_prices set item_key = 'material:Pierre noire', display_name = 'Pierre noire'
where item_key = 'material:Black Stone (Arme)';
delete from public.market_prices where item_key = 'material:Black Stone (Armure)';

update public.market_prices set item_key = 'material:Éclat de cristal noir tranchant', display_name = 'Éclat de cristal noir tranchant'
where item_key = 'material:Sharp Black Crystal Shard';
update public.market_prices set item_key = 'material:Éclat de cristal noir dur', display_name = 'Éclat de cristal noir dur'
where item_key = 'material:Hard Black Crystal Shard';
update public.market_prices set item_key = 'material:Pierre de Caphras', display_name = 'Pierre de Caphras'
where item_key = 'material:Caphras Stone';

-- Ancient Spirit Dust redevient exclusivement un composant de craft (comme dans le vrai jeu,
-- il sert à fabriquer des Pierres de Caphras plutôt qu'à optimiser directement) — plus tradable
-- sur le marché commun
delete from public.market_prices where item_key = 'material:Ancient Spirit Dust';
