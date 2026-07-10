-- Bug trouvé en révision du log d'onboarding (demande explicite : "onboarding log a revoir") :
-- le tutoriel d'arrivée (TUTORIAL_STEPS) n'a qu'un seul point d'entrée, le bouton du Wiki, mais
-- ce bouton reste cliquable À VOLONTÉ, y compris par un joueur qui a DÉJÀ terminé le tutoriel.
-- startTutorial() (game-supabase.js) appelle reportTutorialProgress(false, false) à CHAQUE
-- démarrage -> mark_item_tutorial_seen(p_completed:false, p_last_step:0) -> l'upsert écrasait
-- purement et simplement completed=true par completed=false dès qu'un joueur relançait le
-- tutoriel par simple curiosité, faisant disparaître sa complétion des stats admin
-- (admin_onboarding_stats/admin_onboarding_dropoff) et le faisant réapparaître à tort dans le
-- funnel d'abandon "en cours / abandonné" (last_step remis à 0).
-- Correctif : une fois completed=true, une ligne ne peut plus jamais régresser -- un replay met
-- seulement seen_at à jour, jamais last_step/skipped/completed. Ne change rien pour les
-- tutoriels d'objets (1 seule étape chacun, jamais rejouables de la même façon).
create or replace function public.mark_item_tutorial_seen(
  p_tutorial_id text, p_skipped boolean default false, p_last_step int default 0, p_completed boolean default true
) returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  insert into public.item_tutorials_seen(user_id, tutorial_id, skipped, last_step, completed)
    values (auth.uid(), p_tutorial_id, p_skipped, p_last_step, p_completed)
    on conflict (user_id, tutorial_id) do update
      set skipped = case when public.item_tutorials_seen.completed then public.item_tutorials_seen.skipped else excluded.skipped end,
          last_step = case when public.item_tutorials_seen.completed then public.item_tutorials_seen.last_step else excluded.last_step end,
          completed = public.item_tutorials_seen.completed or excluded.completed,
          seen_at = now();
end;
$function$;
grant execute on function public.mark_item_tutorial_seen(text, boolean, int, boolean) to authenticated;
