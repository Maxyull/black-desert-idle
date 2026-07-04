-- ============================================================
-- Spawn global de World Boss (admin) — Velia Idle
-- L'admin peut faire apparaître un boss pour TOUS les joueurs à la demande (indépendamment du
-- planning horaire). L'état est partagé dans une table singleton "live_boss" que chaque client
-- lit périodiquement : tant que expires_at est dans le futur, le boss est affiché "EN COURS"
-- pour tout le monde et combattable.
--
-- Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists public.live_boss (
  id int primary key default 1,          -- singleton : une seule ligne (id = 1)
  boss_id text,
  spawned_at timestamptz,
  expires_at timestamptz
);
insert into public.live_boss (id) values (1) on conflict (id) do nothing;

alter table public.live_boss enable row level security;
-- lecture ouverte à tout compte connecté (invités inclus, pour qu'ils voient le boss)
drop policy if exists "live_boss_select_all" on public.live_boss;
create policy "live_boss_select_all" on public.live_boss for select using (auth.uid() is not null);
-- aucune écriture directe : seul l'admin via la RPC ci-dessous (vérif email côté serveur)

create or replace function public.admin_spawn_boss(p_boss_id text, p_minutes int default 15)
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
         expires_at = now() + (greatest(1, least(p_minutes, 120)) || ' minutes')::interval
   where id = 1;
end;
$$;

grant execute on function public.admin_spawn_boss(text, int) to authenticated;
