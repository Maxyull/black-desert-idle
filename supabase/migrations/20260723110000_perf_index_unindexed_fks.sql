-- Perf (2026-07-19) : index couvrants sur les clés étrangères non indexées (audit des advisors
-- Supabase, lint `unindexed_foreign_keys`). Sans index sur la colonne FK, chaque suppression/MAJ de
-- la ligne PARENT force un scan séquentiel de la table enfant pour vérifier la contrainte, et les
-- jointures par cette colonne sont non optimales. Toutes les colonnes sont des `user_id`-like à forte
-- cardinalité -> index B-tree simple. IF NOT EXISTS pour rester rejouable.

create index if not exists idx_client_errors_user_id                on public.client_errors (user_id);
create index if not exists idx_miniboss_claims_user_id              on public.miniboss_claims (user_id);
create index if not exists idx_miniboss_contributions_user_id       on public.miniboss_contributions (user_id);
create index if not exists idx_miniboss_participants_user_id        on public.miniboss_participants (user_id);
create index if not exists idx_miniboss_sessions_summoner_id        on public.miniboss_sessions (summoner_id);
create index if not exists idx_patch_note_comment_reports_reporter_id on public.patch_note_comment_reports (reporter_id);
create index if not exists idx_patch_note_comments_user_id          on public.patch_note_comments (user_id);
create index if not exists idx_patch_note_votes_user_id             on public.patch_note_votes (user_id);
create index if not exists idx_pet_trade_counters_from_user_id      on public.pet_trade_counters (from_user_id);
create index if not exists idx_pet_trade_history_buyer_user_id      on public.pet_trade_history (buyer_user_id);
create index if not exists idx_pet_trade_history_seller_user_id     on public.pet_trade_history (seller_user_id);
create index if not exists idx_pet_trade_offers_owner_user_id       on public.pet_trade_offers (owner_user_id);
