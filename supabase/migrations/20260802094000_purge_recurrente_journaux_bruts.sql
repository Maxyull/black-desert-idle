-- Retention recurrente de silver_ledger et farm_events (14 jours).
--
-- POURQUOI CETTE MIGRATION EXISTE
--
-- supabase/README.md et la migration 20260708102350_silver_ledger_archive_and_purge_retention.sql
-- decrivent une retention a 3 jours sur ces deux journaux bruts. Elle n'a JAMAIS
-- fonctionne, pour deux raisons cumulees :
--
--   1. Cette migration est un script A UN COUP. Elle archive puis supprime une fois,
--      et ne cree ni fonction reutilisable ni `cron.schedule`. Rien ne la rejoue.
--   2. Le jour ou elle a tourne (08/07/2026), les deux tables n'avaient que 2 jours
--      d'existence. « plus vieux que 3 jours » ne matchait aucune ligne : elle s'est
--      executee a vide, sans que rien ne le signale.
--
-- Constat au 02/08/2026, un mois plus tard :
--
--   farm_events    1 668 352 lignes   293 Mo   depuis le 05/07
--   silver_ledger  1 209 878 lignes   198 Mo   depuis le 06/07
--   base totale                       521 Mo
--
-- 490 Mo sur 521, soit 94 % de la base, sont des lignes qui auraient du etre purgees.
-- Le quota mentionne dans la migration d'origine est de 500 Mo : on est deja au-dela.
--
-- Ces deux tables grossissent de 250k a 480k lignes par jour.
--
-- ---------------------------------------------------------------------------
-- RETENTION : 14 JOURS (et non 3)
--
-- Choix explicite du 02/08/2026. Verifie avant de trancher, aucune fonctionnalite
-- ne lit au-dela :
--
--   * my_silver_history(p_hours int default 24) : les joueurs ne voient que 24 h
--     (panneau « graphique 24 h », src/backend/silver-history-panel.js).
--   * compute_player_hour_rates(p_hours default 26) : lit 26 h.
--
-- 14 jours laisse donc une marge tres large pour enqueter sur un cas de triche ou un
-- bug remonte tardivement, tout en ramenant la base bien sous le quota.
--
-- ---------------------------------------------------------------------------
-- LE JOB EST CREE DESACTIVE
--
-- Demande explicite : ne rien supprimer maintenant. Un job planifie par date ne sait
-- pas distinguer l'arriere-plan historique des nouvelles lignes : a son premier
-- declenchement il supprimerait les 2,8 millions de lignes d'un coup. On le pose donc
-- inactif pour laisser le temps de faire un dump de sauvegarde complet.
--
-- POUR L'ACTIVER, une fois la sauvegarde faite :
--
--   select cron.alter_job(
--     (select jobid from cron.job where jobname = 'purge-journaux-bruts'),
--     active := true);
--
-- Pour un essai a blanc avant, sans rien supprimer :
--
--   select * from public.purge_journaux_bruts(14, p_appliquer => false);
-- ===========================================================================

-- ---------------------------------------------------------------- fonction
create or replace function public.purge_journaux_bruts(
  p_jours     int     default 14,
  p_appliquer boolean default true
)
returns table(journal text, lignes_concernees bigint, lignes_supprimees bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_seuil        timestamptz;
  v_ledger_vu    bigint := 0;
  v_ledger_sup   bigint := 0;
  v_farm_vu      bigint := 0;
  v_farm_sup     bigint := 0;
begin
  -- Borne defensive : un appel a 0 jour viderait les deux tables, y compris les
  -- lignes de la minute en cours dont depend le graphique 24 h des joueurs.
  p_jours := least(greatest(coalesce(p_jours, 14), 1), 365);
  v_seuil := now() - make_interval(days => p_jours);

  select count(*) into v_ledger_vu from public.silver_ledger where created_at < v_seuil;
  select count(*) into v_farm_vu   from public.farm_events   where created_at < v_seuil;

  if p_appliquer then
    -- ARCHIVER AVANT DE SUPPRIMER, dans la meme transaction.
    --
    -- Ce n'est pas optionnel : admin_silver_ledger_by_category additionne cette
    -- archive et ce qui reste en base pour afficher les totaux « depuis toujours ».
    -- Supprimer sans archiver perdrait definitivement l'historique par categorie
    -- depuis le lancement du jeu. La table est vide aujourd'hui, precisement parce
    -- que l'archivage d'origine s'est execute a vide (voir en-tete).
    insert into public.silver_ledger_archive_totals
      (category, archived_gained, archived_spent, archived_tx_count)
    select category,
           coalesce(sum(delta) filter (where delta > 0), 0),
           coalesce(-sum(delta) filter (where delta < 0), 0),
           count(*)
    from public.silver_ledger
    where created_at < v_seuil
    group by category
    on conflict (category) do update set
      archived_gained   = silver_ledger_archive_totals.archived_gained   + excluded.archived_gained,
      archived_spent    = silver_ledger_archive_totals.archived_spent    + excluded.archived_spent,
      archived_tx_count = silver_ledger_archive_totals.archived_tx_count + excluded.archived_tx_count;

    delete from public.silver_ledger where created_at < v_seuil;
    get diagnostics v_ledger_sup = row_count;

    -- farm_events n'a pas d'archive : c'est de la matiere premiere pour
    -- compute_player_hour_rates, qui a deja produit ses agregats dans
    -- player_hour_rates. Rien a conserver au-dela.
    delete from public.farm_events where created_at < v_seuil;
    get diagnostics v_farm_sup = row_count;
  end if;

  journal := 'silver_ledger';
  lignes_concernees := v_ledger_vu;
  lignes_supprimees := v_ledger_sup;
  return next;

  journal := 'farm_events';
  lignes_concernees := v_farm_vu;
  lignes_supprimees := v_farm_sup;
  return next;
end
$$;

comment on function public.purge_journaux_bruts(int, boolean) is
  'Archive puis purge silver_ledger et farm_events au-dela de p_jours (defaut 14).
   p_appliquer => false pour un essai a blanc. Appelee par le job pg_cron
   purge-journaux-bruts.';

-- Ces journaux ne doivent etre purges que par le job, jamais par un client.
revoke all on function public.purge_journaux_bruts(int, boolean) from public, anon, authenticated;

-- ------------------------------------------------------------ planification
-- 04:20 : apres le digest de 07:00 de la veille et AVANT integrity-cleanup
-- (04:40), pour ne pas faire se chevaucher deux suppressions de masse.
select cron.schedule(
  'purge-journaux-bruts',
  '20 4 * * *',
  $$select public.purge_journaux_bruts(14)$$
);

-- Desactive immediatement : voir l'en-tete. La commande d'activation y figure.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'purge-journaux-bruts'),
  active := false
);

-- ===========================================================================
-- Controle apres application de cette migration :
--
--   -- le job doit exister et etre INACTIF
--   select jobname, schedule, active from cron.job where jobname = 'purge-journaux-bruts';
--
--   -- essai a blanc : doit annoncer ce qui serait supprime, sans rien supprimer
--   select * from public.purge_journaux_bruts(14, p_appliquer => false);
--
--   -- la base ne doit PAS avoir diminue tant que le job est inactif
--   select pg_size_pretty(pg_database_size(current_database()));
-- ===========================================================================
