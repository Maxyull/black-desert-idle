-- ============================================================
-- Digest Discord quotidien (2026-07-20, bdi-admin-ux.md §8 — "le plus gros gain de confort du lot").
-- But : ne plus ouvrir le panneau que quand il y a une raison. Un message chaque matin dit si tout
-- va bien, ce qui a changé depuis hier, et ce qui reste à traiter.
--
-- Architecture : REPRISE de l'existant, aucun nouveau secret.
--   admin_daily_digest() (pg_cron, 07:00 UTC) -> net.http_post -> Edge Function `discord-log`
--   (target 'general'), qui détient le webhook en secret. Même patron que notify_cheat_discord :
--   clé PUBLIABLE en Bearer (allowlistée dans .gitleaks.toml, protégée par RLS), jamais la
--   service_role.
--
-- Pourquoi côté SERVEUR et pas via logToDiscord() côté client : un digest ne peut pas dépendre de
-- la présence d'un admin devant son navigateur. C'est aussi ce qui permet de le recevoir un jour
-- où l'on n'ouvre pas le jeu -- précisément le cas où il est le plus utile.
--
-- admin_daily_digest n'est PAS exposée à authenticated : seul le cron l'appelle.
-- ============================================================

-- Abréviation compacte d'un nombre pour le digest (108,2M / 4,2k / 37). Virgule décimale : le
-- message du digest est en français, un "108.2M" y jure et se lit mal.
create or replace function public.admin_fmt_compact(n numeric)
returns text language sql immutable set search_path to 'public' as $$
  select translate(
    case when abs(n) >= 1000000 then round(n/1000000.0, 1)::text || 'M'
         when abs(n) >= 10000   then round(n/1000.0, 1)::text || 'k'
         else round(n)::text end, '.', ',');
$$;

create or replace function public.admin_daily_digest()
returns text
language plpgsql security definer set search_path to 'public' as $$
declare
  w interval := interval '24 hours';
  r record;
  v_lines text := '';
  v_status text; v_emoji text; v_head text; v_todo text := '';
  v_color int; v_desc text; v_bad int;
  v_reports bigint; v_errors bigint;
  cur numeric; prev numeric; diff numeric; delta text;
begin
  -- ── statut global : pire état de system_health (même règle que le bandeau Q1 du dashboard) ──
  select count(*) filter (where status in ('warn','down')),
         case when count(*) filter (where status='down') > 0 then 'down'
              when count(*) filter (where status='warn') > 0 then 'warn'
              else 'ok' end
    into v_bad, v_status
  from system_health;
  v_emoji := case v_status when 'down' then '🔴' when 'warn' then '🟠' else '🟢' end;
  v_color := case v_status when 'down' then 13920863 when 'warn' then 14263361 else 6212490 end;
  v_head  := v_emoji || ' ' || case
    when v_status = 'ok' then 'Tout est normal'
    when v_bad = 1 then '1 problème'
    else v_bad || ' problèmes' end;

  -- détail des checks en défaut : savoir LEQUEL sans avoir à ouvrir le panneau
  if v_bad > 0 then
    for r in select label, key, message from system_health
             where status in ('warn','down') order by status, key loop
      v_head := v_head || chr(10) || '• ' || coalesce(r.label, r.key)
                || coalesce(' — ' || r.message, '');
    end loop;
  end if;

  -- ── les 5 KPI, chacun avec son delta vs les 24 h PRÉCÉDENTES ──
  -- règle de delta : pourcentage quand la base précédente est assez grande pour qu'un % ait du
  -- sens (>= 10), sinon écart absolu -- "+3" parle mieux que "+17%" sur 18 joueurs.
  for r in
    select * from (values
      ('Joueurs actifs',
        (select count(distinct p.user_id) from presence p where p.last_seen > now()-w)::numeric,
        (select count(distinct p.user_id) from presence p where p.last_seen > now()-w*2 and p.last_seen <= now()-w)::numeric),
      ('Silver créé net',
        (select coalesce(sum(l.delta),0) from silver_ledger l where l.created_at > now()-w)::numeric,
        (select coalesce(sum(l.delta),0) from silver_ledger l where l.created_at > now()-w*2 and l.created_at <= now()-w)::numeric),
      ('Nouveaux comptes',
        (select count(*) from auth.users u where u.created_at > now()-w)::numeric,
        (select count(*) from auth.users u where u.created_at > now()-w*2 and u.created_at <= now()-w)::numeric),
      ('Erreurs client',
        (select count(*) from client_errors c where c.created_at > now()-w)::numeric,
        (select count(*) from client_errors c where c.created_at > now()-w*2 and c.created_at <= now()-w)::numeric),
      ('Ventes marché',
        (select count(*) from market_listings m where m.sold_at is not null and m.sold_at > now()-w)::numeric,
        (select count(*) from market_listings m where m.sold_at is not null and m.sold_at > now()-w*2 and m.sold_at <= now()-w)::numeric)
    ) as t(lbl, cur, prev)
  loop
    cur := r.cur; prev := r.prev; diff := cur - prev;
    delta := case
      when diff = 0 then '='
      when abs(prev) >= 10 then (case when diff > 0 then '+' else '−' end) || round(abs(diff)/abs(prev)*100) || '%'
      else (case when diff > 0 then '+' else '−' end) || admin_fmt_compact(abs(diff))
    end;
    -- rpad/lpad dans un bloc ``` : alignement en police à chasse fixe côté Discord
    v_lines := v_lines || rpad(r.lbl, 18) || lpad(admin_fmt_compact(cur), 8)
      || '  (' || delta || ')' || chr(10);
  end loop;

  -- ── à traiter (même définition que la section de modération : commentaire VISIBLE signalé) ──
  select count(*) into v_reports
  from patch_note_comments c
  join patch_note_comment_reports rp on rp.comment_id = c.id
  where c.status = 'visible';
  select count(*) into v_errors from client_errors where created_at > now()-w;
  if v_reports > 0 then v_todo := v_todo || v_reports || ' patch note signalé'
    || case when v_reports > 1 then 's' else '' end; end if;
  if v_errors > 0 then
    v_todo := v_todo || case when v_todo <> '' then ' · ' else '' end
      || v_errors || ' erreur' || case when v_errors > 1 then 's' else '' end || ' client';
  end if;
  if v_todo = '' then v_todo := '✅ rien à traiter'; end if;

  v_desc := v_head || chr(10) || chr(10)
    || '```' || chr(10) || v_lines || '```' || chr(10)
    || '**À traiter :** ' || v_todo;

  -- Envoi best-effort : un Discord indisponible ne doit PAS faire échouer le job cron (sinon le
  -- check "retard de cron" de system_health s'allumerait pour une raison sans rapport). En
  -- revanche les erreurs de CALCUL ci-dessus ne sont PAS attrapées : elles doivent remonter dans
  -- cron.job_run_details, où le check de retard finira par les signaler.
  begin
    perform net.http_post(
      url := 'https://mkwwvzbjtyawpcyrnybk.supabase.co/functions/v1/discord-log',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || 'sb_publishable_c7HLxbeBLe01rirZVg-XPA_TClYulIJ'
      ),
      body := jsonb_build_object(
        'title', '📊 BDI — ' || to_char(now() at time zone 'Europe/Paris', 'DD/MM'),
        'description', v_desc,
        'color', v_color,
        'target', 'general'
      )
    );
  exception when others then null;
  end;

  return v_desc; -- retourné pour pouvoir tester à la main : select admin_daily_digest();
end; $$;

revoke all on function public.admin_daily_digest() from public, anon;
revoke all on function public.admin_fmt_compact(numeric) from public, anon;

-- 07:00 UTC (09:00 Paris en été) : le digest doit être là avant qu'on pense à ouvrir le panneau.
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'admin-daily-digest') then
    perform cron.schedule('admin-daily-digest','0 7 * * *', $c$ select public.admin_daily_digest(); $c$);
  end if;
end $$;
