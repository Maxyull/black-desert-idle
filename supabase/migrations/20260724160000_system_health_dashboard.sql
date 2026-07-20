-- ============================================================
-- Socle du dashboard v2 (2026-07-19, d'après bdi-admin-ux.md §1 et §11, croisé avec
-- bdi-admin-monitoring-plan.md §3). Deux besoins :
--   Q1 "est-ce que tout va bien ?" -> table system_health + 4 familles de checks, écrites par un
--      cron toutes les 5 min. Le statut global affiché = pire statut de la liste.
--   Q2 "qu'est-ce qui a changé ?" -> admin_dashboard_kpis renvoie la valeur courante ET celle de
--      la fenêtre PRÉCÉDENTE de même durée, pour afficher un delta plutôt qu'un total absolu
--      ("1,2M silver : bien ou mal ?" était le symptôme n°1 du doc UX).
--
-- Note sur la conservation du silver : le registre (silver_ledger) a démarré APRÈS que des comptes
-- avaient déjà du silver, et ne couvre pas tous les joueurs -- l'égalité stricte prônée par le doc
-- monitoring §8.1 serait donc toujours fausse ici et hurlerait en permanence. On surveille à la
-- place la VARIATION de l'écart entre deux passages : un dupe la fait bouger d'un coup, l'activité
-- normale la fait dériver doucement. Même intention, adaptée aux données réelles.
--
-- admin_run_health_checks() n'est PAS exposée à authenticated : seul le cron l'appelle.
-- ============================================================

create table if not exists public.system_health (
  key            text primary key,
  label          text,
  status         text not null default 'unknown',   -- ok | warn | down | unknown
  value          numeric,
  threshold_warn numeric,
  threshold_down numeric,
  message        text,
  checked_at     timestamptz not null default now()
);
alter table public.system_health enable row level security;

create or replace function public.admin_run_health_checks()
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  j record; lag_s numeric; expected_s numeric; st text; msg text;
  errs bigint; dbsz numeric; gap numeric; prev_gap numeric; drift numeric;
begin
  -- 1) retard des jobs pg_cron : un cron mort ne s'allume nulle part aujourd'hui
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

  -- 2) taux d'erreurs client sur la dernière heure
  select count(*) into errs from client_errors where created_at > now() - interval '1 hour';
  insert into system_health(key,label,status,value,threshold_warn,threshold_down,message,checked_at)
  values ('client_errors','Erreurs client (1 h)',
          case when errs > 20 then 'down' when errs > 5 then 'warn' else 'ok' end,
          errs, 5, 20,
          case when errs > 5 then errs || ' erreurs en 1 h' else null end, now())
  on conflict (key) do update set status=excluded.status, value=excluded.value,
    message=excluded.message, checked_at=excluded.checked_at;

  -- 3) taille de la base -- seuils STOCKÉS dans la table, donc ajustables au plan Supabase réel
  --    sans redéployer (ne jamais coder en dur un quota de free tier).
  dbsz := pg_database_size(current_database());
  insert into system_health(key,label,status,value,threshold_warn,threshold_down,message,checked_at)
  values ('db_size','Taille de la base',
          case when dbsz > 7600000000 then 'down' when dbsz > 6400000000 then 'warn' else 'ok' end,
          dbsz, 6400000000, 7600000000,
          pg_size_pretty(dbsz::bigint), now())
  on conflict (key) do update set status=excluded.status, value=excluded.value,
    message=excluded.message, checked_at=excluded.checked_at;

  -- 4) dérive du silver (voir l'en-tête : on surveille la VARIATION, pas l'égalité absolue)
  select (select coalesce(sum(delta),0) from silver_ledger) - (select coalesce(sum(silver),0) from player_stats)
    into gap;
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

create or replace function public.admin_health()
returns table(key text, label text, status text, value numeric,
              threshold_warn numeric, threshold_down numeric, message text, checked_at timestamptz)
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  return query
    select h.key, h.label, h.status, h.value, h.threshold_warn, h.threshold_down, h.message, h.checked_at
    from system_health h
    order by case h.status when 'down' then 0 when 'warn' then 1 when 'unknown' then 2 else 3 end, h.key;
end; $$;

create or replace function public.admin_dashboard_kpis(p_hours integer default 24)
returns table(metric text, current_value numeric, previous_value numeric)
language plpgsql security definer set search_path to 'public' as $$
declare w interval;
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  w := (p_hours || ' hours')::interval;
  return query
  select 'active_players'::text,
    (select count(distinct p.user_id) from presence p where p.last_seen > now()-w)::numeric,
    (select count(distinct p.user_id) from presence p where p.last_seen > now()-w*2 and p.last_seen <= now()-w)::numeric
  union all select 'silver_net',
    (select coalesce(sum(l.delta),0) from silver_ledger l where l.created_at > now()-w)::numeric,
    (select coalesce(sum(l.delta),0) from silver_ledger l where l.created_at > now()-w*2 and l.created_at <= now()-w)::numeric
  union all select 'signups',
    (select count(*) from auth.users u where u.created_at > now()-w)::numeric,
    (select count(*) from auth.users u where u.created_at > now()-w*2 and u.created_at <= now()-w)::numeric
  union all select 'client_errors',
    (select count(*) from client_errors c where c.created_at > now()-w)::numeric,
    (select count(*) from client_errors c where c.created_at > now()-w*2 and c.created_at <= now()-w)::numeric
  union all select 'market_sales',
    (select count(*) from market_listings m where m.sold_at is not null and m.sold_at > now()-w)::numeric,
    (select count(*) from market_listings m where m.sold_at is not null and m.sold_at > now()-w*2 and m.sold_at <= now()-w)::numeric;
end; $$;

revoke all on function public.admin_health() from public, anon;
revoke all on function public.admin_dashboard_kpis(integer) from public, anon;
revoke all on function public.admin_run_health_checks() from public, anon;
grant execute on function public.admin_health() to authenticated;
grant execute on function public.admin_dashboard_kpis(integer) to authenticated;

-- cron toutes les 5 min, planifié une seule fois (rejouable sans doublonner le job)
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'system-health-check') then
    perform cron.schedule('system-health-check','*/5 * * * *', $c$ select public.admin_run_health_checks(); $c$);
  end if;
end $$;
select public.admin_run_health_checks();
