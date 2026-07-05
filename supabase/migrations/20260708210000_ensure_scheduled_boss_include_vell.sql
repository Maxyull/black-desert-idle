-- Bug corrigé le 2026-07-08 : ensure_scheduled_boss() ne gérait QUE le planning de Kzarka
-- (boss_id toujours codé en dur à 'kzarka'), donc les apparitions programmées de Vell (jeudi
-- 12h00, dimanche 16h45, heure de Paris) ne créaient jamais de ligne live_boss partagée —
-- chaque joueur combattait Vell en instance SOLO, sans jamais voir les autres joueurs
-- (présence Realtime, PV communs, top 10). Ajout des 2 occurrences de Vell au planning vérifié
-- côté serveur, avec ses propres PV (550000, doit rester égal à BOSS_ROSTER.vell.hp côté client),
-- boss_id/hp désormais dynamiques par occurrence au lieu d'être figés sur Kzarka.
--
-- Correctif complémentaire (même demande) : la condition de réécriture de live_boss comparait
-- seulement spawned_at, pas le boss — un spawn ADMIN en cours (ex: Vell lancé manuellement pendant
-- qu'un créneau planifié de Kzarka devient actif) pouvait donc être écrasé par erreur. On ne
-- réécrit désormais que si rien de valide n'est déjà en cours (boss_id null ou expiré), qu'il
-- s'agisse d'un spawn planifié ou d'un spawn admin.
create or replace function public.ensure_scheduled_boss()
returns table(boss_id text, spawned_at timestamptz, expires_at timestamptz, hp numeric, max_hp numeric)
language plpgsql security definer
as $$
declare
  v_now timestamptz := now();
  v_paris_date date := (v_now at time zone 'Europe/Paris')::date;
  v_dow int := extract(dow from (v_now at time zone 'Europe/Paris'))::int; -- 0=dimanche..6=samedi
  v_entry record;
  v_spawn timestamptz;
  v_expires timestamptz;
  v_lb record;
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;
  for v_entry in
    select * from (values
      (-1, 12, 45, 'kzarka', 400000::numeric),
      (-1, 19, 45, 'kzarka', 400000::numeric),
      (-1, 23, 45, 'kzarka', 400000::numeric),
      (0,  15, 45, 'kzarka', 400000::numeric),
      (6,  15, 45, 'kzarka', 400000::numeric),
      (4,  12, 0,  'vell',   550000::numeric),
      (0,  16, 45, 'vell',   550000::numeric)
    ) as t(day, h, m, id, hp)
  loop
    if v_entry.day <> -1 and v_entry.day <> v_dow then continue; end if;
    v_spawn := (v_paris_date::text || ' ' || lpad(v_entry.h::text,2,'0') || ':' || lpad(v_entry.m::text,2,'0') || ':00')::timestamp at time zone 'Europe/Paris';
    v_expires := v_spawn + interval '9 minutes'; -- ramené de 15 à 9 min le 2026-07-06
    if v_now >= v_spawn and v_now < v_expires then
      select * into v_lb from public.live_boss where id = 1;
      -- ne réclame le créneau planifié que si RIEN de valide n'est déjà actif (spawn admin ou
      -- planifié) — évite d'écraser un spawn admin en cours d'un autre boss
      if v_lb.boss_id is null or v_lb.expires_at <= now() then
        update public.live_boss set boss_id = v_entry.id, spawned_at = v_spawn, expires_at = v_expires,
          max_hp = v_entry.hp, hp = v_entry.hp where id = 1;
      end if;
      exit;
    end if;
  end loop;
  return query select l.boss_id, l.spawned_at, l.expires_at, l.hp, l.max_hp from public.live_boss l where l.id = 1;
end;
$$;
grant execute on function public.ensure_scheduled_boss() to authenticated;
