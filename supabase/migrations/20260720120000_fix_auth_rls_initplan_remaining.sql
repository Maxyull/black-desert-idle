-- Corrige le warning Supabase "Auth RLS Initialization Plan" (performance) sur les 3 dernières
-- policies qui réévaluaient auth.uid() PAR LIGNE au lieu d'une seule fois par requête. Le reste
-- des policies signalées par l'advisor (chat_deleted, game_saves, farm_events, playtime_pings,
-- silver_ledger_archive_totals) était déjà corrigé lors d'une session précédente -- le warning
-- affiché était un résultat d'advisor en cache, revérifié via pg_policies avant d'agir ici.
-- Comportement inchangé : mêmes accès autorisés, juste (select auth.uid()) au lieu de auth.uid()
-- (force une évaluation unique via l'InitPlan plutôt qu'un appel par ligne).
drop policy if exists companion_stats_own on public.companion_stats;
create policy companion_stats_own on public.companion_stats
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists item_tutorials_seen_own on public.item_tutorials_seen;
create policy item_tutorials_seen_own on public.item_tutorials_seen
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Le joueur journalise ses propres mouvements de silver" on public.silver_ledger;
create policy "Le joueur journalise ses propres mouvements de silver" on public.silver_ledger
  for insert with check (user_id = (select auth.uid()));
