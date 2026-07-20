-- ============================================================
-- Le contrôle de santé ne rescanne plus tout le registre de silver (2026-07-20).
--
-- CE QUI RALENTISSAIT LA BASE. admin_run_health_checks(), ajoutée ce matin
-- (20260724160000), fait un `sum(delta)` sur silver_ledger à chaque passage. Cette table pèse
-- 1 145 369 lignes / 173 Mo. Mesuré : **8 990 ms** rien que pour cette somme, sur les 11 381 ms de
-- moyenne de la fonction -- et le cron l'appelle **toutes les 5 minutes**.
--
-- Coût réel constaté dans pg_stat_statements : 1 559 s cumulées, soit 5,8 % de tout le temps
-- d'exécution de la base pour 137 appels. Mais le vrai dégât est indirect : lire 173 Mo toutes les
-- 5 min sur une base de 466 Mo **chasse le cache** en permanence, donc l'upsert de game_saves (le
-- poste n°1, 31 % du temps, 48-74 ms par appel) retrouve un cache froid à chaque fois. Un contrôle
-- de supervision ne doit jamais coûter plus cher que ce qu'il supervise.
--
-- LA CORRECTION. On ne resomme plus l'historique : on garde le total courant et le dernier id vu,
-- et on n'additionne que les nouvelles lignes (parcours de l'index primaire, quelques lignes par
-- passage au lieu de 1,15 million).
--
-- FILET CONTRE LA DÉRIVE. Un total entretenu de façon incrémentale devient faux si des lignes sont
-- supprimées (purge/archivage : silver_ledger_archive_totals existe déjà, vide pour l'instant, et
-- aucun cron ne purge le registre aujourd'hui -- mais ça peut changer). D'où le recalcul complet
-- automatique si l'état est absent ou vieux de plus de 24 h : on paie les 9 s une fois par jour au
-- lieu de 288 fois, et toute dérive se corrige d'elle-même au prochain recalcul.
-- ============================================================

create table if not exists public.silver_ledger_running_total (
  id              smallint primary key default 1 check (id = 1),   -- ligne unique
  last_ledger_id  bigint not null default 0,
  total_delta     numeric not null default 0,
  full_recomputed_at timestamptz not null default now()
);
alter table public.silver_ledger_running_total enable row level security;
revoke all on table public.silver_ledger_running_total from anon, authenticated;

/**
 * @returns {numeric} somme de silver_ledger.delta, entretenue de façon incrémentale.
 * Recalcul complet si l'état manque ou date de plus de 24 h (voir l'en-tête : auto-guérison).
 */
create or replace function public.silver_ledger_total()
returns numeric language plpgsql security definer set search_path to 'public' as $$
declare
  v_last bigint; v_total numeric; v_at timestamptz;
  v_new_max bigint; v_new_sum numeric;
begin
  select last_ledger_id, total_delta, full_recomputed_at
    into v_last, v_total, v_at
    from silver_ledger_running_total where id = 1;

  if v_last is null or v_at < now() - interval '24 hours' then
    -- recalcul complet (coûteux, une fois par jour au plus)
    select coalesce(max(id), 0), coalesce(sum(delta), 0) into v_new_max, v_new_sum from silver_ledger;
    insert into silver_ledger_running_total(id, last_ledger_id, total_delta, full_recomputed_at)
    values (1, v_new_max, v_new_sum, now())
    on conflict (id) do update set last_ledger_id = excluded.last_ledger_id,
                                   total_delta = excluded.total_delta,
                                   full_recomputed_at = excluded.full_recomputed_at;
    return v_new_sum;
  end if;

  -- incrémental : seules les lignes ajoutées depuis le dernier passage, via l'index primaire
  select coalesce(max(id), v_last), coalesce(sum(delta), 0) into v_new_max, v_new_sum
    from silver_ledger where id > v_last;
  if v_new_max > v_last then
    v_total := v_total + v_new_sum;
    update silver_ledger_running_total
       set last_ledger_id = v_new_max, total_delta = v_total where id = 1;
  end if;
  return v_total;
end; $$;

revoke all on function public.silver_ledger_total() from public, anon, authenticated;

-- admin_run_health_checks() : seul le contrôle n°4 change, il appelle désormais silver_ledger_total()
-- au lieu de resommer la table entière. Le reste est identique à 20260724160000.
create or replace function public.admin_run_health_checks()
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  j record; lag_s numeric; expected_s numeric; st text; msg text;
  errs bigint; dbsz numeric; gap numeric; prev_gap numeric; drift numeric;
begin
  for j in select jobid, jobname, schedule from cron.job where active loop
    expected_s := case
      when j.schedule ~ '^\*/[0-9]+ \* \* \* \*$' then (regexp_replace(j.schedule,'^\*/([0-9]+).*$','\1'))::numeric * 60
      when j.schedule ~ '^[0-9]+ \* \* \* \*$'    then 3600
      else 86400 end;
    select extract(epoch from (now() - max(d.end_time))) into lag_s
      from cron.job_run_details d where d.jobid = j.jobid and d.status = 'succeeded';
    if lag_s is null then st := 'unknown'; msg := 'aucune exécution réussie enregistrée';
    elsif lag_s > expected_s * 4 then st := 'down'; msg := 'aucune exécution depuis ' || round(lag_s/60) || ' min';
    elsif lag_s > expected_s * 2 then st := 'warn'; msg := 'retard de ' || round(lag_s/60) || ' min';
    else st := 'ok'; msg := null; end if;
    insert into system_health(key,label,status,value,threshold_warn,threshold_down,message,checked_at)
    values ('cron_'||j.jobname, 'Cron ' || j.jobname, st, lag_s, expected_s*2, expected_s*4, msg, now())
    on conflict (key) do update set status=excluded.status, value=excluded.value,
      threshold_warn=excluded.threshold_warn, threshold_down=excluded.threshold_down,
      message=excluded.message, checked_at=excluded.checked_at;
  end loop;

  select count(*) into errs from client_errors where created_at > now() - interval '1 hour';
  insert into system_health(key,label,status,value,threshold_warn,threshold_down,message,checked_at)
  values ('client_errors','Erreurs client (1 h)',
          case when errs > 20 then 'down' when errs > 5 then 'warn' else 'ok' end,
          errs, 5, 20,
          case when errs > 5 then errs || ' erreurs en 1 h' else null end, now())
  on conflict (key) do update set status=excluded.status, value=excluded.value,
    message=excluded.message, checked_at=excluded.checked_at;

  dbsz := pg_database_size(current_database());
  insert into system_health(key,label,status,value,threshold_warn,threshold_down,message,checked_at)
  values ('db_size','Taille de la base',
          case when dbsz > 7600000000 then 'down' when dbsz > 6400000000 then 'warn' else 'ok' end,
          dbsz, 6400000000, 7600000000,
          pg_size_pretty(dbsz::bigint), now())
  on conflict (key) do update set status=excluded.status, value=excluded.value,
    message=excluded.message, checked_at=excluded.checked_at;

  -- 4) dérive du silver -- total du registre désormais INCRÉMENTAL (voir l'en-tête de ce fichier)
  gap := silver_ledger_total() - (select coalesce(sum(silver),0) from player_stats);
  select value into prev_gap from system_health where key = 'silver_drift';
  drift := case when prev_gap is null then 0 else abs(gap - prev_gap) end;
  insert into system_health(key,label,status,value,threshold_warn,threshold_down,message,checked_at)
  values ('silver_drift','Conservation du silver',
          case when drift > 200000000 then 'down' when drift > 50000000 then 'warn' else 'ok' end,
          gap, 50000000, 200000000,
          'écart registre/comptes : ' || gap || ' (variation ' || drift || ')', now())
  on conflict (key) do update set status=excluded.status, value=excluded.value,
    message=excluded.message, checked_at=excluded.checked_at;
end; $$;

revoke all on function public.admin_run_health_checks() from public, anon, authenticated;
