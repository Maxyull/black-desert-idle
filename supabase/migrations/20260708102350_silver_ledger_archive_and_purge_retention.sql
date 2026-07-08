-- silver_ledger et farm_events grossissent d'environ 250k-480k lignes/jour (journal brut de
-- CHAQUE ramassage/mouvement de silver) et ont rempli 385 Mo en moins d'une semaine sur un
-- quota total de 500 Mo. Purge de retention (garde 3 jours) + archive des totaux "depuis
-- toujours" de silver_ledger AVANT purge, pour que le tableau par categorie de l'admin
-- (admin_silver_ledger_by_category, qui sommait tout l'historique) continue de refleter les
-- totaux reels apres la purge, pas juste les 3 derniers jours.

create table if not exists public.silver_ledger_archive_totals (
  category text primary key,
  archived_gained bigint not null default 0,
  archived_spent bigint not null default 0,
  archived_tx_count bigint not null default 0
);

alter table public.silver_ledger_archive_totals enable row level security;

create policy "Admin uniquement lit l'archive du registre"
  on public.silver_ledger_archive_totals for select
  using (coalesce((select auth.jwt()->>'email'), '') = 'maxime.lacoste@icloud.com');

-- archive les totaux de TOUT ce qui va etre purge (plus vieux que 3 jours)
insert into public.silver_ledger_archive_totals (category, archived_gained, archived_spent, archived_tx_count)
select category,
  coalesce(sum(delta) filter (where delta > 0), 0),
  coalesce(-sum(delta) filter (where delta < 0), 0),
  count(*)
from public.silver_ledger
where created_at < now() - interval '3 days'
group by category
on conflict (category) do update set
  archived_gained = silver_ledger_archive_totals.archived_gained + excluded.archived_gained,
  archived_spent = silver_ledger_archive_totals.archived_spent + excluded.archived_spent,
  archived_tx_count = silver_ledger_archive_totals.archived_tx_count + excluded.archived_tx_count;

delete from public.silver_ledger where created_at < now() - interval '3 days';
delete from public.farm_events where created_at < now() - interval '3 days';

-- la vue par categorie additionne desormais l'archive (avant purge) + ce qui reste en base
create or replace view public.admin_silver_ledger_by_category
  with (security_invoker = true) as
  select
    coalesce(l.category, a.category) as category,
    coalesce(l.gained, 0) + coalesce(a.archived_gained, 0) as total_gained,
    coalesce(l.spent, 0) + coalesce(a.archived_spent, 0) as total_spent,
    coalesce(l.tx, 0) + coalesce(a.archived_tx_count, 0) as tx_count
  from (
    select category,
      sum(delta) filter (where delta > 0) as gained,
      -sum(delta) filter (where delta < 0) as spent,
      count(*) as tx
    from public.silver_ledger
    group by category
  ) l
  full outer join public.silver_ledger_archive_totals a using (category)
  order by (coalesce(l.gained, 0) + coalesce(a.archived_gained, 0) + coalesce(l.spent, 0) + coalesce(a.archived_spent, 0)) desc;
