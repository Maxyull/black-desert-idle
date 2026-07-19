-- Perf (2026-07-19) : enveloppe les appels `auth.uid()` BRUTS des policies RLS dans un
-- sous-SELECT `(select auth.uid())` (audit des advisors Supabase, lint `auth_rls_initplan`).
-- Sans le sous-SELECT, Postgres ré-évalue auth.uid() POUR CHAQUE LIGNE au lieu d'une seule fois par
-- requête (l'optimiseur traite alors la valeur comme un scalaire stable "initplan"). Impact à
-- l'échelle sur les tables lues en volume.
--
-- Périmètre : seules les 6 policies encore en `auth.uid()` non enveloppé (vérifié en base). Les
-- autres tables listées par l'advisor (game_saves, chat_deleted, silver_ledger, farm_events,
-- playtime_pings, player_afk_sessions, player_hour_rates...) étaient DÉJÀ enveloppées -- l'advisor
-- affichait un état en cache. Sémantique d'autorisation strictement identique, on ne change QUE la
-- forme d'évaluation.

alter policy "miniboss_contributions_select_all" on public.miniboss_contributions
  using ((select auth.uid()) is not null);

alter policy "miniboss_participants_select_all" on public.miniboss_participants
  using ((select auth.uid()) is not null);

alter policy "miniboss_reputation_select_all" on public.miniboss_reputation
  using ((select auth.uid()) is not null);

alter policy "miniboss_sessions_select_all" on public.miniboss_sessions
  using ((select auth.uid()) is not null);

alter policy "player_sessions_own" on public.player_sessions
  using ((select auth.uid()) = user_id);

alter policy "client_errors_insert" on public.client_errors
  with check (
    ((user_id is null) or (user_id = (select auth.uid())))
    and (char_length(coalesce(message, ''::text)) <= 4000)
    and (char_length(coalesce(stack, ''::text)) <= 12000)
    and (char_length(coalesce(url, ''::text)) <= 2000)
    and (char_length(coalesce(user_agent, ''::text)) <= 1000)
  );
