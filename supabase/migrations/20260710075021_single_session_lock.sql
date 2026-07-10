-- Verrou multi-session (2026-07-10, demande explicite : "Interdire multionglet, multi navigateur
-- and multidevice"). Un seul onglet/navigateur/appareil actif à la fois par compte. Le dernier
-- claim_player_session() gagne ; toute session dont le session_id ne correspond plus (vu par
-- check_player_session(), appelé au même rythme que le heartbeat_presence existant, 20s) doit se
-- mettre en pause côté client (voir game-supabase.js).

create table if not exists public.player_sessions (
  user_id uuid primary key,
  session_id uuid not null,
  updated_at timestamptz not null default now()
);
alter table public.player_sessions enable row level security;
create policy player_sessions_own on public.player_sessions
  for select using (auth.uid() = user_id);

drop function if exists public.claim_player_session(uuid);
create or replace function public.claim_player_session(p_session_id uuid)
returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;
  insert into public.player_sessions (user_id, session_id, updated_at)
  values (auth.uid(), p_session_id, now())
  on conflict (user_id) do update set session_id = excluded.session_id, updated_at = now();
end; $$;
grant execute on function public.claim_player_session(uuid) to authenticated;

drop function if exists public.check_player_session(uuid);
create or replace function public.check_player_session(p_session_id uuid)
returns boolean
language plpgsql security definer set search_path to 'public' as $$
declare v_active uuid;
begin
  if auth.uid() is null then return false; end if;
  select session_id into v_active from public.player_sessions where user_id = auth.uid();
  return v_active is null or v_active = p_session_id;
end; $$;
grant execute on function public.check_player_session(uuid) to authenticated;
