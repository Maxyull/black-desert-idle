-- admin_item_tutorial_stats() groupait TOUS les tutorial_id de item_tutorials_seen, y compris
-- désormais 'onboarding' (voir 20260719180000_onboarding_stats.sql) -- son calcul de
-- "completed_count" (count(*) filter (where not skipped)) comptait à tort les lignes "en cours"
-- (completed=false, skipped=false, un joueur qui a fermé l'onglet sans finir ni passer) comme
-- terminées, ce qui aurait faussé le taux affiché dans "Contenu → Tutoriels d'objets". Exclut
-- désormais 'onboarding' de cette vue -- il a sa propre page dédiée (admin_onboarding_stats/
-- admin_onboarding_dropoff), qui elle connaît la colonne `completed`.
create or replace function public.admin_item_tutorial_stats()
 returns table(tutorial_id text, completed_count bigint, skipped_count bigint, total_count bigint)
 language plpgsql security definer set search_path to 'public'
as $function$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  return query
    select its.tutorial_id, count(*) filter (where not its.skipped)::bigint,
      count(*) filter (where its.skipped)::bigint, count(*)::bigint
    from public.item_tutorials_seen its
    where its.tutorial_id <> 'onboarding'
    group by its.tutorial_id order by count(*) desc;
end;
$function$;
