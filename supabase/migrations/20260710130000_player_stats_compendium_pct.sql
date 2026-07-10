-- Suivi admin du Compendium (2026-07-10, demande explicite : "ajoute au panneau admin ce qui
-- manque") -- nouvelle colonne sur player_stats (déjà synchronisée via syncPlayerStats(),
-- game-supabase.js), alimentée par compendiumOverallPct() (core/game-core.js, zones+boss+PEN
-- combinés). Jamais un record monotone séparé : la valeur courante ne peut que monter (aucun
-- retrait possible sur zones/boss/PEN), donc l'écraser à chaque sync est déjà correct.
alter table public.player_stats add column if not exists compendium_pct smallint not null default 0;
