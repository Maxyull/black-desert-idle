-- Répartition du silver du joueur par catégorie (2026-07-19, demande explicite : "rétro-catégorise
-- les gains passés depuis le ledger"). Même modèle que my_silver_history (20260722130000) : la table
-- silver_ledger reste en lecture admin-only, cette RPC SECURITY DEFINER n'expose QUE les agrégats des
-- lignes du joueur APPELANT (auth.uid()), jamais d'un autre joueur, jamais le détail ligne à ligne.
-- Somme les GAINS (delta > 0) par catégorie -> alimente le tooltip "silver par source" (V490) au
-- chargement (backfillSilverByCategory, silver-history-panel.js).

drop function if exists public.my_silver_by_category();

create function public.my_silver_by_category()
returns table(category text, gained bigint)
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(category, 'autre') as category,
         sum(delta)::bigint as gained
  from silver_ledger
  where user_id = auth.uid()
    and delta > 0
  group by 1
  order by 2 desc;
$$;

-- revoke de public ET anon (Supabase accorde EXECUTE à anon par défaut, pas seulement via PUBLIC)
revoke all on function public.my_silver_by_category() from public, anon;
grant execute on function public.my_silver_by_category() to authenticated;
