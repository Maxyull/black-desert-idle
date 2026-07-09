-- nouvelles stats admin (2026-07-19, demande explicite : "ajoute et modifie ce qui te semble
-- manquant comme stats dans le panel admin") -- volume de marché (top objets échangés + tendance)
-- et courbe d'inscriptions par jour, deux signaux qui manquaient totalement au panneau admin.

-- top objets échangés sur le marché (30 derniers jours) + volume total -- market_trades a déjà
-- une policy de lecture publique (market_trades_select_all), mais on centralise l'agrégation
-- côté serveur plutôt que de renvoyer les lignes brutes au client.
create or replace function public.admin_market_top_items(p_days int default 30)
 returns table(item_name text, trade_count bigint, total_qty bigint, total_silver_value bigint)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  return query
    select mt.item_name, count(*)::bigint, sum(mt.qty)::bigint, sum(mt.price * mt.qty)::bigint
    from public.market_trades mt
    where mt.created_at > now() - (p_days || ' days')::interval
    group by mt.item_name
    order by sum(mt.price * mt.qty) desc
    limit 20;
end;
$function$;
grant execute on function public.admin_market_top_items(int) to authenticated;

-- inscriptions par jour (30 derniers jours) -- auth.users n'est pas exposé via PostgREST, cette
-- fonction SECURITY DEFINER est le seul moyen d'y accéder pour l'admin.
create or replace function public.admin_signups_by_day(p_days int default 30)
 returns table(day date, signups bigint)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  return query
    select date_trunc('day', u.created_at)::date, count(*)::bigint
    from auth.users u
    where u.created_at > now() - (p_days || ' days')::interval
    group by date_trunc('day', u.created_at)
    order by 1;
end;
$function$;
grant execute on function public.admin_signups_by_day(int) to authenticated;
