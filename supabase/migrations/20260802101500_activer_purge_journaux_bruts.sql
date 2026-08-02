-- Active le job purge-journaux-bruts.
--
-- Migration separee et non modification de 20260802094000, conformement a la
-- regle : une migration deja appliquee ne se modifie jamais (CLAUDE.md §12).
--
-- La precedente creait volontairement le job DESACTIVE : au moment ou elle a
-- ete appliquee, l'arriere-plan historique representait 2,7 millions de lignes,
-- et on ne voulait pas qu'un declenchement automatique les supprime avant
-- qu'une sauvegarde ait pu etre faite.
--
-- Cette purge initiale a ete passee a la main le 02/08/2026 (2 676 513 lignes,
-- archive des totaux verifiee intacte). Un essai a blanc juste apres ne trouve
-- plus que 27 lignes a supprimer, soit l'increment d'une seule journee : il n'y
-- a plus rien d'accumule, le job peut prendre le relais sans risque.
--
-- Idempotent : reactiver un job deja actif ne fait rien.

select cron.alter_job(
  (select jobid from cron.job where jobname = 'purge-journaux-bruts'),
  active := true
);

-- =====================================================================
-- Controle : les 8 jobs doivent etre actifs.
--
--   select jobname, schedule, active from cron.job order by jobname;
--
-- Et le lendemain, verifier que le passage de 04:20 a bien eu lieu :
--
--   select j.jobname, d.status, d.start_time, d.return_message
--   from cron.job_run_details d join cron.job j on j.jobid = d.jobid
--   where j.jobname = 'purge-journaux-bruts'
--   order by d.start_time desc limit 3;
-- =====================================================================
