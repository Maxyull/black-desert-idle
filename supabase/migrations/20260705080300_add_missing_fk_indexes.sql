-- Corrige l'avertissement de performance "Unindexed foreign keys" : ajoute un index couvrant
-- chaque clé étrangère qui n'en avait pas, pour accélérer les jointures/suppressions en cascade.
create index if not exists idx_boss_claims_user_id on public.boss_claims(user_id);
create index if not exists idx_boss_contributions_user_id on public.boss_contributions(user_id);
create index if not exists idx_chat_messages_user_id on public.chat_messages(user_id);
create index if not exists idx_discord_links_user_id on public.discord_links(user_id);
create index if not exists idx_farm_events_user_id on public.farm_events(user_id);
create index if not exists idx_link_codes_user_id on public.link_codes(user_id);
create index if not exists idx_market_listings_buyer_id on public.market_listings(buyer_id);
create index if not exists idx_market_listings_seller_id on public.market_listings(seller_id);
create index if not exists idx_playtime_pings_user_id on public.playtime_pings(user_id);
create index if not exists idx_profiles_referred_by on public.profiles(referred_by);
