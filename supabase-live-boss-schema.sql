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
  primary key (boss_key, user_id)
);
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
create or replace function public.admin_spawn_boss(p_boss_id text, p_minutes int default 15, p_hp numeric default 1000000)
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

-- un joueur inflige des dégâts au boss partagé + enregistre sa contribution. Renvoie hp/max_hp.
create or replace function public.boss_contribute(p_damage numeric, p_pseudo text default null)
returns table(hp numeric, max_hp numeric)
language plpgsql security definer
as $$
declare v_uid uuid := auth.uid(); v_lb record; v_key timestamptz; v_pseudo text;
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
  update public.live_boss set hp = greatest(0, hp - p_damage) where id = 1 returning hp, max_hp into hp, max_hp;
  insert into public.boss_contributions (boss_key, user_id, pseudo, damage)
    values (v_key, v_uid, v_pseudo, p_damage)
    on conflict (boss_key, user_id) do update set damage = public.boss_contributions.damage + excluded.damage, pseudo = excluded.pseudo;
  return next;
end;
$$;
grant execute on function public.boss_contribute(numeric, text) to authenticated;

-- top 15 des contributeurs de l'instance courante (pseudo + dégâts) + le tien
create or replace function public.boss_top()
returns table(user_id uuid, pseudo text, damage numeric)
language plpgsql security definer
as $$
declare v_key timestamptz;
begin
  select spawned_at into v_key from public.live_boss where id = 1;
  if v_key is null then return; end if;
  return query select c.user_id, c.pseudo, c.damage from public.boss_contributions c
    where c.boss_key = v_key order by c.damage desc limit 15;
end;
$$;
grant execute on function public.boss_top() to authenticated;

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
