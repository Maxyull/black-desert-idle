-- ============================================================
-- Ajoute 'offline_catchup' à la whitelist de silver_ledger_category_check
-- (posée par 20260714171000_silver_ledger_validation_and_window_caps.sql).
--
-- Nouveau rattrapage hors-ligne "réel" (2026-07-11, demande explicite : "le modal qui calcule le
-- farm hors ligne, je le vois pas quand on se reconnecte") -- computeOfflineCatchupSilver()/
-- applySaveState (core/game-core.js) appelle désormais addSilver(gain, 'offline_catchup', ...)
-- au chargement d'une sauvegarde après une vraie absence (navigateur fermé/OS en veille). Sans
-- cette catégorie dans la whitelist, l'insertion dans silver_ledger échouait silencieusement
-- (CHECK constraint, avalée par le try/catch de flushSilverLedger()) -- le silver était bien
-- crédité au joueur (addSilver() côté client, sans dépendre du ledger), mais l'écriture d'audit
-- anti-triche était perdue pour de bon (jamais rejouée, contrairement à un vrai échec réseau
-- transitoire). Jamais modifier une migration déjà appliquée (CLAUDE.md §12) -- nouvelle migration.
-- ============================================================

alter table public.silver_ledger drop constraint if exists silver_ledger_category_check;
alter table public.silver_ledger add constraint silver_ledger_category_check
  check (category in ('loot','potion','sell','quest','achievement','welcome','admin_test','boss','undo_sell','market_buy','market_sell','market_refund','offline_catchup'));
