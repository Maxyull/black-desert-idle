-- Stats admin sur l'onboarding (2026-07-19, demande explicite : "ajoute des stats sur l'onboarding")
--
-- Généralise item_tutorials_seen (migration 20260719160000_item_tutorials.sql), jusqu'ici limitée à
-- un flag seen/skipped par tutoriel d'objet (1 étape chacun), pour pouvoir AUSSI suivre le
-- tutoriel d'arrivée (TUTORIAL_STEPS, 21 étapes, tutorial_id='onboarding') : à quelle étape un
-- joueur en est resté (drop-off), et s'il l'a terminé ou passé ("Passer").
alter table public.item_tutorials_seen add column if not exists last_step int not null default 0;
alter table public.item_tutorials_seen add column if not exists completed boolean not null default false;

-- backfill : les lignes déjà existantes (tutoriels d'objets, 1 étape, "seen" = déjà fini d'une
-- façon ou d'une autre) sont considérées terminées sauf si explicitement marquées skipped.
update public.item_tutorials_seen set completed = not skipped where completed = false;

-- remplace mark_item_tutorial_seen(text, boolean) par une version à 4 paramètres (p_last_step/
-- p_completed en plus, tous deux avec une valeur par défaut compatible avec les appels existants à
-- 2 arguments) -- DROP obligatoire de l'ancienne signature avant de recréer (règle du projet :
-- sinon ambiguïté de surcharge = déconnexions silencieuses, voir CLAUDE.md).
drop function if exists public.mark_item_tutorial_seen(text, boolean);

create or replace function public.mark_item_tutorial_seen(
  p_tutorial_id text, p_skipped boolean default false, p_last_step int default 0, p_completed boolean default true
) returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  insert into public.item_tutorials_seen(user_id, tutorial_id, skipped, last_step, completed)
    values (auth.uid(), p_tutorial_id, p_skipped, p_last_step, p_completed)
    on conflict (user_id, tutorial_id) do update
      set skipped = excluded.skipped, last_step = excluded.last_step, completed = excluded.completed, seen_at = now();
end;
$function$;
grant execute on function public.mark_item_tutorial_seen(text, boolean, int, boolean) to authenticated;

-- vue d'ensemble : combien de joueurs ont démarré/terminé/passé/abandonné en cours (ni skipped ni
-- completed = a fermé l'onglet ou navigué ailleurs sans cliquer "Terminer" ni "Passer").
create or replace function public.admin_onboarding_stats()
 returns table(started bigint, completed bigint, skipped bigint, in_progress bigint)
 language plpgsql security definer set search_path to 'public'
as $function$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Réservé au staff';
  end if;
  return query
    select
      count(*)::bigint as started,
      count(*) filter (where completed)::bigint as completed,
      count(*) filter (where skipped)::bigint as skipped,
      count(*) filter (where not completed and not skipped)::bigint as in_progress
    from public.item_tutorials_seen
    where tutorial_id = 'onboarding';
end;
$function$;
grant execute on function public.admin_onboarding_stats() to authenticated;

-- funnel de drop-off : à quelle étape (0..20) les joueurs qui n'ont ni terminé ni passé sont restés
-- bloqués -- permet de repérer une étape confuse/mal placée dans TUTORIAL_STEPS.
create or replace function public.admin_onboarding_dropoff()
 returns table(last_step int, user_count bigint)
 language plpgsql security definer set search_path to 'public'
as $function$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Réservé au staff';
  end if;
  return query
    select last_step, count(*)::bigint as user_count
    from public.item_tutorials_seen
    where tutorial_id = 'onboarding' and not completed and not skipped
    group by last_step
    order by last_step;
end;
$function$;
grant execute on function public.admin_onboarding_dropoff() to authenticated;
