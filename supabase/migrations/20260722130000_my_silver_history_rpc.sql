-- Historique de silver du joueur (V451, 2026-07-15) : le clic sur la pastille "silver/min" du
-- topbar ouvre un petit panneau avec un graphique de la session ET l'historique des dernières
-- 24 h. La table silver_ledger est en lecture admin-only (policy "Admin uniquement lit le
-- registre de silver") -- cette RPC SECURITY DEFINER expose UNIQUEMENT des agrégats horaires des
-- lignes du joueur APPELANT (auth.uid()), jamais celles d'un autre joueur, jamais le détail
-- ligne à ligne (le détail par note/catégorie reste réservé au panneau admin).
-- p_hours borné à [1, 168] (7 jours max) côté SQL : un client modifié ne peut pas demander
-- l'historique complet de la table.

drop function if exists public.my_silver_history(int);

create function public.my_silver_history(p_hours int default 24)
returns table(bucket timestamptz, gained bigint, spent bigint)
language sql
security definer
set search_path = public
stable
as $$
  select date_trunc('hour', created_at) as bucket,
         coalesce(sum(delta) filter (where delta > 0), 0)::bigint as gained,
         coalesce(sum(-delta) filter (where delta < 0), 0)::bigint as spent
  from silver_ledger
  where user_id = auth.uid()
    and created_at > now() - make_interval(hours => least(greatest(coalesce(p_hours, 24), 1), 168))
  group by 1
  order by 1;
$$;

revoke all on function public.my_silver_history(int) from public;
grant execute on function public.my_silver_history(int) to authenticated;
