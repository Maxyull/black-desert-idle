-- Corrige les avertissements de performance Supabase :
-- 1) "Auth RLS Initialization Plan" : auth.uid()/auth.jwt()/auth.role() dans une policy RLS sont
--    ré-évalués pour CHAQUE ligne scannée si appelés nus ; les envelopper dans (select ...) permet
--    à Postgres de les évaluer UNE SEULE FOIS par requête (mis en cache), meilleur à l'échelle.
-- 2) "Multiple Permissive Policies" : game_saves avait 2 policies SELECT permissives distinctes
--    ("Admin lit toutes les sauvegardes" + "Lecture de sa propre sauvegarde"), toutes deux évaluées
--    à chaque requête (OR implicite) — fusionnées en une seule policy équivalente.

-- game_saves : fusion des 2 policies SELECT en une seule
drop policy if exists "Admin lit toutes les sauvegardes" on public.game_saves;
drop policy if exists "Lecture de sa propre sauvegarde" on public.game_saves;
create policy "Lecture de sa propre sauvegarde ou admin" on public.game_saves for select
  using ((select auth.uid()) = user_id or (select auth.jwt()->>'email') = 'maxime.lacoste@icloud.com');

alter policy "Création de sa propre sauvegarde" on public.game_saves
  with check ((select auth.uid()) = user_id);
alter policy "Mise à jour de sa propre sauvegarde" on public.game_saves
  using ((select auth.uid()) = user_id);

alter policy boss_contrib_select_all on public.boss_contributions
  using ((select auth.uid()) is not null);

alter policy chat_deleted_select_staff on public.chat_deleted
  using (coalesce((select auth.jwt()->>'email'), '') = 'maxime.lacoste@icloud.com'
    or exists (select 1 from public.chat_mods where chat_mods.user_id = (select auth.uid())));

alter policy chat_messages_select_all on public.chat_messages
  using ((select auth.uid()) is not null);

alter policy chat_mods_select_all on public.chat_mods
  using ((select auth.uid()) is not null);

alter policy discord_links_select_own on public.discord_links
  using ((select auth.uid()) = user_id);

alter policy "Admin uniquement lit le journal de farm" on public.farm_events
  using ((select auth.jwt()->>'email') = 'maxime.lacoste@icloud.com');
alter policy "Le joueur journalise ses propres événements" on public.farm_events
  with check (user_id = (select auth.uid()));

alter policy live_boss_select_all on public.live_boss
  using ((select auth.uid()) is not null);

alter policy "Voir les annonces actives ou les siennes" on public.market_listings
  using (status = 'active' or seller_id = (select auth.uid()) or buyer_id = (select auth.uid()));

alter policy market_trades_select_all on public.market_trades
  using ((select auth.role()) = 'authenticated');

alter policy player_stats_insert_own on public.player_stats
  with check ((select auth.uid()) = user_id and coalesce((((select auth.jwt())->>'is_anonymous'))::boolean, true) = false);
alter policy player_stats_select_all on public.player_stats
  using ((select auth.role()) = 'authenticated');
alter policy player_stats_update_own on public.player_stats
  using ((select auth.uid()) = user_id and coalesce((((select auth.jwt())->>'is_anonymous'))::boolean, true) = false)
  with check ((select auth.uid()) = user_id and coalesce((((select auth.jwt())->>'is_anonymous'))::boolean, true) = false);

alter policy presence_update_own on public.presence
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy presence_upsert_own on public.presence
  with check ((select auth.uid()) = user_id);

alter policy profiles_select_own on public.profiles
  using ((select auth.uid()) = user_id);

alter policy sell_log_select_own on public.sell_log
  using ((select auth.uid()) = user_id);

alter policy testers_select_all on public.testers
  using ((select auth.uid()) is not null);
