-- ============================================================
-- World Boss partagé (admin) — Velia Idle
-- L'admin lance un boss pour TOUS les joueurs. Le boss a des PV PARTAGÉS : chaque joueur
-- inflige des dégâts au même pool de PV, sa contribution est enregistrée, et à la mort du boss
-- les récompenses sont distribuées selon le classement de contribution (top 10 = meilleures
-- récompenses). L'état vit dans la table singleton "live_boss".
--
-- Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists public.live_boss (
  id int primary key default 1,          -- singleton : une seule ligne (id = 1)
  boss_id text,
  spawned_at timestamptz,
  expires_at timestamptz,
  max_hp numeric default 0,
  hp numeric default 0
);
insert into public.live_boss (id) values (1) on conflict (id) do nothing;
-- migration si la table existait déjà sans les PV
alter table public.live_boss add column if not exists max_hp numeric default 0;
alter table public.live_boss add column if not exists hp numeric default 0;

alter table public.live_boss enable row level security;
drop policy if exists "live_boss_select_all" on public.live_boss;
create policy "live_boss_select_all" on public.live_boss for select using (auth.uid() is not null);

-- contributions par joueur pour l'instance de boss courante (clé = spawned_at)
create table if not exists public.boss_contributions (
  boss_key timestamptz not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  pseudo text,
  damage numeric not null default 0,
  last_hit_at timestamptz not null default now(),  -- dernier coup porté : sert à savoir qui combat "en direct"
  primary key (boss_key, user_id)
);
-- migration si la table existait déjà sans last_hit_at
alter table public.boss_contributions add column if not exists last_hit_at timestamptz not null default now();
create index if not exists boss_contrib_key_dmg_idx on public.boss_contributions(boss_key, damage desc);
alter table public.boss_contributions enable row level security;
drop policy if exists "boss_contrib_select_all" on public.boss_contributions;
create policy "boss_contrib_select_all" on public.boss_contributions for select using (auth.uid() is not null);

-- récompenses déjà réclamées (une par joueur par instance) pour éviter le double-claim
create table if not exists public.boss_claims (
  boss_key timestamptz not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (boss_key, user_id)
);
alter table public.boss_claims enable row level security;

-- l'admin lance le boss avec des PV partagés (p_hp)
-- ⚠️ une ancienne version à 2 arguments (sans p_hp) avait été laissée en base par une exécution
-- précédente de ce fichier (avant l'ajout de p_hp) : "create or replace" ne remplace QUE la
-- signature identique, donc les deux versions coexistaient et PostgREST pouvait choisir la
-- mauvaise (le boss admin ne repartait alors jamais avec des PV frais) — bug confirmé et corrigé
-- le 2026-07-06. Ce drop empêche que ça se reproduise si ce fichier est ré-exécuté tel quel.
drop function if exists public.admin_spawn_boss(text, int);
-- durée par défaut ramenée à 9 minutes (au lieu de 15) — un world boss disparaît au bout de
-- 9 minutes, demande explicite du 2026-07-06
create or replace function public.admin_spawn_boss(p_boss_id text, p_minutes int default 9, p_hp numeric default 1000000)
returns void
language plpgsql security definer
as $$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Réservé au staff';
  end if;
  if p_boss_id is null or trim(p_boss_id) = '' then raise exception 'Boss invalide'; end if;
  update public.live_boss
     set boss_id = p_boss_id, spawned_at = now(),
         expires_at = now() + (greatest(1, least(p_minutes, 120)) || ' minutes')::interval,
         max_hp = greatest(1, p_hp), hp = greatest(1, p_hp)
   where id = 1;
end;
$$;
grant execute on function public.admin_spawn_boss(text, int, numeric) to authenticated;

-- fait disparaître le boss mondial pour tout le monde (admin) — demande explicite du 2026-07-06
create or replace function public.admin_despawn_boss()
returns void
language plpgsql security definer
as $$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Réservé au staff';
  end if;
  update public.live_boss set boss_id = null, spawned_at = null, expires_at = null, hp = 0, max_hp = 0 where id = 1;
end;
$$;
grant execute on function public.admin_despawn_boss() to authenticated;

-- Rend le boss mondial du PLANNING (Kzarka aux horaires fixes) réellement partagé entre tous les
-- joueurs : PV communs (live_boss) et présence visible dans l'arène, exactement comme un spawn
-- admin. Avant ce correctif, seul un spawn admin utilisait live_boss ; le Kzarka du planning
-- hebdomadaire restait une instance SOLO calculée par joueur. Demande explicite du 2026-07-06.
-- Le planning (BOSS_SCHEDULE côté client) est dupliqué ici en heure Europe/Paris, vérifié
-- CÔTÉ SERVEUR : n'importe quel joueur connecté peut appeler cette fonction (idempotente, ne fait
-- rien si aucune fenêtre n'est active) ; le premier appel pendant la fenêtre "réclame" le boss pour
-- tout le monde, sans jamais écraser un spawn admin déjà en cours.
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
  v_hp numeric := 400000; -- doit rester égal à BOSS_ROSTER.kzarka.hp côté client
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;
  for v_entry in
    select * from (values
      (-1, 12, 45), (-1, 19, 45), (-1, 23, 45), (0, 15, 45), (6, 15, 45)
    ) as t(day, h, m)
  loop
    if v_entry.day <> -1 and v_entry.day <> v_dow then continue; end if;
    v_spawn := (v_paris_date::text || ' ' || lpad(v_entry.h::text,2,'0') || ':' || lpad(v_entry.m::text,2,'0') || ':00')::timestamp at time zone 'Europe/Paris';
    v_expires := v_spawn + interval '9 minutes'; -- ramené de 15 à 9 min le 2026-07-06
    if v_now >= v_spawn and v_now < v_expires then
      select * into v_lb from public.live_boss where id = 1;
      if v_lb.boss_id is null or v_lb.expires_at <= now() or v_lb.spawned_at is distinct from v_spawn then
        update public.live_boss set boss_id = 'kzarka', spawned_at = v_spawn, expires_at = v_expires,
          max_hp = v_hp, hp = v_hp where id = 1;
      end if;
      exit;
    end if;
  end loop;
  return query select l.boss_id, l.spawned_at, l.expires_at, l.hp, l.max_hp from public.live_boss l where l.id = 1;
end;
$$;
grant execute on function public.ensure_scheduled_boss() to authenticated;

-- un joueur inflige des dégâts au boss partagé + enregistre sa contribution. Renvoie hp/max_hp.
-- ⚠️ BUG CRITIQUE corrigé le 2026-07-06 (confirmé par test réel + reproduction isolée) : cette
-- fonction a TOUJOURS échoué silencieusement à chaque appel depuis sa création. Cause : les
-- paramètres de sortie de "returns table(hp numeric, max_hp numeric)" portent EXACTEMENT les
-- mêmes noms que les colonnes de live_boss qu'on met à jour → "update ... set hp = ... returning
-- hp, max_hp into hp, max_hp" lève "column reference \"hp\" is ambiguous" à chaque exécution,
-- attrapé silencieusement côté client (.catch(()=>{})). Résultat : PV jamais partagés, table
-- boss_contributions toujours vide, classement de contribution toujours vide. Corrigé en
-- qualifiant la table dans l'UPDATE et en utilisant des variables locales distinctes.
create or replace function public.boss_contribute(p_damage numeric, p_pseudo text default null)
returns table(hp numeric, max_hp numeric)
language plpgsql security definer
as $$
declare
  v_uid uuid := auth.uid(); v_lb record; v_key timestamptz; v_pseudo text;
  v_new_hp numeric; v_new_max_hp numeric;
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;
  select * into v_lb from public.live_boss where id = 1;
  -- boss non actif → renvoie l'état courant sans rien changer
  if v_lb.boss_id is null or v_lb.expires_at <= now() or coalesce(v_lb.hp,0) <= 0 then
    return query select coalesce(v_lb.hp,0), coalesce(v_lb.max_hp,0); return;
  end if;
  v_key := v_lb.spawned_at;
  v_pseudo := nullif(trim(coalesce(p_pseudo,'')), '');
  if v_pseudo is null then select pseudo into v_pseudo from public.profiles where user_id = v_uid; end if;
  if v_pseudo is null then v_pseudo := 'Joueur'; end if;
  -- dégâts bornés (anti-triche grossière : pas plus de 5% des PV max par appel)
  p_damage := greatest(0, least(p_damage, v_lb.max_hp * 0.05));
  update public.live_boss lb set hp = greatest(0, lb.hp - p_damage) where lb.id = 1
    returning lb.hp, lb.max_hp into v_new_hp, v_new_max_hp;
  insert into public.boss_contributions (boss_key, user_id, pseudo, damage, last_hit_at)
    values (v_key, v_uid, v_pseudo, p_damage, now())
    on conflict (boss_key, user_id) do update set damage = public.boss_contributions.damage + excluded.damage,
      pseudo = excluded.pseudo, last_hit_at = now();
  hp := v_new_hp; max_hp := v_new_max_hp;
  return next;
end;
$$;
grant execute on function public.boss_contribute(numeric, text) to authenticated;

-- top 15 des contributeurs de l'instance courante (pseudo + dégâts + % du total + actif "en direct"
-- si le joueur a tapé dans les 10 dernières secondes) — sert au classement live ET à montrer qui
-- combat en ce moment (demande : "les joueurs doivent se voir")
drop function if exists public.boss_top();
create function public.boss_top()
returns table(user_id uuid, pseudo text, damage numeric, pct numeric, active boolean)
language plpgsql security definer
as $$
declare v_key timestamptz; v_total numeric;
begin
  select spawned_at into v_key from public.live_boss where id = 1;
  if v_key is null then return; end if;
  select coalesce(sum(c.damage), 0) into v_total from public.boss_contributions c where c.boss_key = v_key;
  return query
    select c.user_id, c.pseudo, c.damage,
      case when v_total > 0 then round(c.damage / v_total * 100, 1) else 0 end as pct,
      (c.last_hit_at > now() - interval '10 seconds') as active
    from public.boss_contributions c
    where c.boss_key = v_key
    order by c.damage desc limit 15;
end;
$$;
grant execute on function public.boss_top() to authenticated;

-- nombre de joueurs actuellement en train de combattre le boss partagé (coup dans les 10s) : sert
-- à afficher un compteur "X joueurs combattent en direct" dans la salle du boss
create or replace function public.boss_active_count()
returns int
language plpgsql security definer
as $$
declare v_key timestamptz; v_cnt int;
begin
  select spawned_at into v_key from public.live_boss where id = 1;
  if v_key is null then return 0; end if;
  select count(*) into v_cnt from public.boss_contributions
    where boss_key = v_key and last_hit_at > now() - interval '10 seconds';
  return coalesce(v_cnt, 0);
end;
$$;
grant execute on function public.boss_active_count() to authenticated;

-- réclamation de récompense à la mort du boss : renvoie le rang du joueur (1 = meilleur), ou
-- -1 si non éligible (pas de contribution, boss pas mort, ou déjà réclamé). Marque comme réclamé.
create or replace function public.boss_claim()
returns int
language plpgsql security definer
as $$
declare v_uid uuid := auth.uid(); v_key timestamptz; v_hp numeric; v_rank int;
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;
  select spawned_at, hp into v_key, v_hp from public.live_boss where id = 1;
  if v_key is null or coalesce(v_hp,1) > 0 then return -1; end if; -- boss pas encore mort
  if not exists (select 1 from public.boss_contributions where boss_key = v_key and user_id = v_uid) then return -1; end if;
  if exists (select 1 from public.boss_claims where boss_key = v_key and user_id = v_uid) then return -1; end if; -- déjà réclamé
  select rnk into v_rank from (
    select user_id, rank() over (order by damage desc) as rnk
    from public.boss_contributions where boss_key = v_key
  ) t where t.user_id = v_uid;
  insert into public.boss_claims (boss_key, user_id) values (v_key, v_uid) on conflict do nothing;
  return coalesce(v_rank, 999);
end;
$$;
grant execute on function public.boss_claim() to authenticated;
