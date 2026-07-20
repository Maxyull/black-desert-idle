-- ============================================================
-- Intégrité & anti-triche (2026-07-20, bdi-admin-monitoring-plan.md §8 — l'étape que le doc
-- appelle « le job le plus important du projet »).
--
-- Le reste du panneau dit CE QUE FONT les joueurs. Ici on répond à « l'état du jeu est-il encore
-- cohérent ? ». Sur un idle game où le client est manipulable, c'est le seul angle qui compte.
--
-- SEUILS : calibrés sur les données RÉELLES du 2026-07-20, pas inventés. Un contrôle qui hurle sur
-- l'historique légitime ne sert à rien -- les quatre contrôles ci-dessous rendent ZÉRO violation
-- sur les 495 sessions AFK et les 16 comptes existants. Mesures de référence :
--   * player_hour_rates : max observé 960 738 silver/h (p99 = 870 642)
--   * player_afk_sessions : taux max observé 2 603 573 silver/h (21 sessions > 2 M/h)
--   * durées de session : 65 sessions à exactement 0 s (reconnexion instantanée, bénignes),
--     AUCUNE durée négative, AUCUNE date future
--   * companion_stats : max 13 compagnons (plafond jeu : 96, +4 de tampon d'échange = 100)
-- D'où : taux d'alerte à 4 M/h (~1,5× le max légitime observé) et critique à 8 M/h.
--
-- PAS DE BAN AUTOMATIQUE (doc §8.3) : ces contrôles alimentent une file de revue manuelle. Sur un
-- jeu communautaire de cette taille, un faux positif coûte plus cher qu'un tricheur.
--
-- Pourquoi la détection d'horloge est justifiée ici : record_afk_session() reçoit p_started_at et
-- p_ended_at DU CLIENT (voir 20260710120000_afk_reconnect_sessions.sql). Rien n'empêche aujourd'hui
-- un client modifié d'annoncer une session de 30 jours. Tant que le serveur n'est pas seul juge de
-- la durée, ce contrôle est le filet -- il ne remplace pas le correctif.
-- ============================================================

create table if not exists public.integrity_violations (
  id           bigserial primary key,
  kind         text not null,        -- 'clock_drift' | 'silver_rate' | 'pet_cap' | 'silver_conservation'
  severity     text not null,        -- 'info' | 'warn' | 'critical'
  user_id      uuid,                 -- null si violation globale (économie entière)
  expected     numeric,
  actual       numeric,
  context      jsonb not null default '{}'::jsonb,
  -- empreinte du FAIT observé (ex. 'afk:1234') : une re-détection du même fait incrémente
  -- occurrences au lieu de créer une ligne de plus à chaque passage du cron.
  fingerprint  text not null,
  occurrences  integer not null default 1,
  detected_at  timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  reviewed_by  uuid,
  reviewed_at  timestamptz,
  resolution   text
);
create unique index if not exists integrity_violations_kind_fp on public.integrity_violations(kind, fingerprint);
create index if not exists integrity_violations_open on public.integrity_violations(detected_at desc) where resolution is null;
alter table public.integrity_violations enable row level security;
-- aucune policy : la table n'est lisible/écrivable que par les fonctions security definer ci-dessous

/**
 * Enregistre une violation, ou recompte celle déjà connue (même kind + fingerprint).
 * Interne au cron : jamais exposée à authenticated.
 */
create or replace function public.integrity_report(
  p_kind text, p_severity text, p_user_id uuid,
  p_expected numeric, p_actual numeric, p_context jsonb, p_fingerprint text
) returns void language sql security definer set search_path to 'public' as $$
  insert into public.integrity_violations(kind, severity, user_id, expected, actual, context, fingerprint)
  values (p_kind, p_severity, p_user_id, p_expected, p_actual, coalesce(p_context,'{}'::jsonb), p_fingerprint)
  on conflict (kind, fingerprint) do update
    set occurrences = integrity_violations.occurrences + 1,
        last_seen_at = now(),
        severity = excluded.severity,
        actual = excluded.actual,
        context = excluded.context;
$$;

create or replace function public.admin_run_integrity_checks()
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  r record;
  gap numeric; seuil numeric; statut text;
begin
  -- 1) horloge : durée négative ou fin dans le futur. Le client fournit les deux bornes, donc
  --    une session « impossible » est soit une horloge décalée, soit une valeur forgée.
  for r in
    select id, user_id, started_at, ended_at, silver_gained,
           extract(epoch from (ended_at - started_at)) as dur
    from player_afk_sessions
    where started_at > now() - interval '3 hours'          -- fenêtre glissante > période du cron (1 h)
      and (ended_at < started_at or ended_at > now() + interval '10 minutes')
  loop
    perform integrity_report(
      'clock_drift', 'critical', r.user_id,
      0, r.dur,
      jsonb_build_object('started_at', r.started_at, 'ended_at', r.ended_at,
                         'silver_gained', r.silver_gained, 'session_id', r.id),
      'afk:' || r.id);
  end loop;

  -- 2) bornes physiques : silver/h d'une session AFK. On ignore les sessions de moins d'une
  --    minute -- diviser un gain par une durée quasi nulle produit un taux absurde qui n'est
  --    qu'un artefact d'arrondi, pas une triche (65 sessions sont à 0 s exactement).
  for r in
    select id, user_id, silver_gained,
           silver_gained / (extract(epoch from (ended_at - started_at)) / 3600.0) as rate
    from player_afk_sessions
    where started_at > now() - interval '3 hours'
      and extract(epoch from (ended_at - started_at)) >= 60
      and silver_gained / (extract(epoch from (ended_at - started_at)) / 3600.0) > 4000000
  loop
    perform integrity_report(
      'silver_rate', case when r.rate > 8000000 then 'critical' else 'warn' end, r.user_id,
      4000000, round(r.rate),
      jsonb_build_object('session_id', r.id, 'silver_gained', r.silver_gained, 'source', 'afk_session'),
      'afk:' || r.id);
  end loop;

  -- même borne sur le farm en ligne, agrégé à l'heure
  for r in
    select user_id, hour, loot_silver from player_hour_rates
    where hour > now() - interval '3 hours' and loot_silver > 4000000
  loop
    perform integrity_report(
      'silver_rate', case when r.loot_silver > 8000000 then 'critical' else 'warn' end, r.user_id,
      4000000, r.loot_silver,
      jsonb_build_object('hour', r.hour, 'source', 'hour_rate'),
      -- to_char et non `|| r.hour` : la concaténation d'un timestamptz dépend du DateStyle de la
      -- session, l'empreinte doit rester identique d'un passage à l'autre.
      'hour:' || r.user_id || ':' || to_char(r.hour at time zone 'UTC', 'YYYY-MM-DD"T"HH24'));
  end loop;

  -- 3) plafond de collection compagnons (96 + 4 de tampon d'échange = 100, cf. roster.js)
  for r in
    select user_id, pet_count from companion_stats where pet_count > 100
  loop
    perform integrity_report(
      'pet_cap', 'warn', r.user_id, 100, r.pet_count,
      jsonb_build_object('pet_count', r.pet_count), 'pets:' || r.user_id);
  end loop;

  -- 4) conservation du silver. On NE RECALCULE PAS l'écart ici : admin_run_health_checks tourne
  --    toutes les 5 min et stocke déjà la variation entre deux passages dans system_health. Le
  --    recalculer depuis ce cron horaire donnerait une variation quasi nulle (on comparerait la
  --    mesure de maintenant à celle d'il y a 5 min, pas d'il y a une heure) -- autrement dit un
  --    contrôle qui ne se déclenche jamais. On promeut donc simplement son verdict en violation.
  --    Rappel (voir 20260724160000) : le registre a démarré après que des comptes avaient déjà du
  --    silver, l'égalité absolue serait toujours fausse -- c'est le saut brutal qui trahit une
  --    duplication, pas l'écart lui-même.
  select value, threshold_down, status into gap, seuil, statut
    from system_health where key = 'silver_drift';
  if statut = 'down' then
    perform integrity_report(
      'silver_conservation', 'critical', null, seuil, gap,
      jsonb_build_object('source', 'system_health.silver_drift', 'seuil', seuil),
      'drift:' || to_char(now(), 'YYYY-MM-DD"T"HH24'));
  end if;
end; $$;

/** Violations ouvertes (et, si demandé, résolues) des N derniers jours, les plus graves d'abord. */
create or replace function public.admin_integrity_violations(p_days integer default 30, p_include_resolved boolean default false)
returns table(id bigint, kind text, severity text, user_id uuid, display_name text,
              expected numeric, actual numeric, context jsonb, occurrences integer,
              detected_at timestamptz, last_seen_at timestamptz, resolution text)
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  return query
    select v.id, v.kind, v.severity, v.user_id, s.display_name,
           v.expected, v.actual, v.context, v.occurrences,
           v.detected_at, v.last_seen_at, v.resolution
    from integrity_violations v
    left join player_stats s on s.user_id = v.user_id
    where v.detected_at > now() - (greatest(1, least(365, coalesce(p_days,30))) || ' days')::interval
      and (coalesce(p_include_resolved,false) or v.resolution is null)
    order by case v.severity when 'critical' then 0 when 'warn' then 1 else 2 end,
             v.last_seen_at desc;
end; $$;

/** Compte des violations ouvertes par gravité — alimente la pastille du dashboard. */
create or replace function public.admin_integrity_summary()
returns table(severity text, n bigint)
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  return query
    select v.severity, count(*) from integrity_violations v where v.resolution is null group by v.severity;
end; $$;

/** Clôt une violation avec un motif obligatoire (revue manuelle, cf. §8.3 : jamais de ban auto). */
create or replace function public.admin_resolve_violation(p_id bigint, p_resolution text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  if coalesce(trim(p_resolution),'') = '' then raise exception 'Motif obligatoire'; end if;
  update integrity_violations
     set resolution = trim(p_resolution), reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id;
end; $$;

revoke all on function public.integrity_report(text, text, uuid, numeric, numeric, jsonb, text) from public, anon, authenticated;
revoke all on function public.admin_run_integrity_checks() from public, anon, authenticated;
revoke all on function public.admin_integrity_violations(integer, boolean) from public, anon;
revoke all on function public.admin_integrity_summary() from public, anon;
revoke all on function public.admin_resolve_violation(bigint, text) from public, anon;
grant execute on function public.admin_integrity_violations(integer, boolean) to authenticated;
grant execute on function public.admin_integrity_summary() to authenticated;
grant execute on function public.admin_resolve_violation(bigint, text) to authenticated;

-- cron horaire (doc §8.1 : « un cron horaire qui vérifie des égalités toujours vraies »)
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'integrity-checks') then
    perform cron.schedule('integrity-checks', '17 * * * *', $c$ select public.admin_run_integrity_checks(); $c$);
  end if;
  -- rétention : les violations closes depuis plus de 90 jours ne servent plus qu'à grossir la base
  if not exists (select 1 from cron.job where jobname = 'integrity-cleanup') then
    perform cron.schedule('integrity-cleanup', '40 4 * * *',
      $c$ delete from public.integrity_violations where resolution is not null and reviewed_at < now() - interval '90 days'; $c$);
  end if;
end $$;

select public.admin_run_integrity_checks();
