-- ============================================================
-- donation_public_summary() : ajout du total DEPUIS LE LANCEMENT (2026-07-20).
--
-- POURQUOI. Le 2026-07-22, la barre de progression de /donation a été branchée sur les vrais dons
-- (20260722220000_real_donations.sql) précisément parce qu'elle affichait des chiffres de maquette
-- sur une page qui sollicite de l'argent et revendique « Transparence totale ». Mais le bloc
-- principal, juste au-dessus, est resté en dur : « 1 240 $ collectés depuis le lancement ».
-- Or la table donations contient ZÉRO ligne. La page affichait donc un chiffre entièrement
-- inventé, en gros, tout en haut -- pendant que la barre honnête restait masquée faute de données.
--
-- Le résumé public ne savait pas répondre : il ne calcule que le mois en cours. On ajoute
-- total_usd, agrégat À VIE. Toujours aucun montant individuel exposé, la table donations reste en
-- deny-all RLS -- c'est une somme, pas une liste.
-- ============================================================

create or replace function public.donation_public_summary()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select jsonb_build_object(
    -- total à vie : ce qu'affiche le bloc « collectés depuis le lancement »
    'total_usd', coalesce((select sum(amount_usd) from public.donations), 0),
    'month_total_usd', coalesce((
      select sum(amount_usd) from public.donations
      where received_at >= date_trunc('month', now())
    ), 0),
    'donor_count', (
      select count(*) from public.donations
      where received_at >= date_trunc('month', now())
    ),
    'public_donors', coalesce((
      select jsonb_agg(d.donor_label order by d.total desc)
      from (
        select donor_label, sum(amount_usd) as total
        from public.donations
        where is_public and donor_label is not null and btrim(donor_label) <> ''
        group by donor_label
      ) d
    ), '[]'::jsonb)
  );
$function$;
