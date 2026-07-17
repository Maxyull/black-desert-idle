-- Rate-limiting login / reset (2026-07-22, backlog audit sécurité issue #9).
-- Compteur atomique à fenêtre fixe, stocké en base (les Edge Functions sont sans état :
-- un compteur en mémoire ne survit pas entre invocations/instances). La table n'a AUCUNE
-- policy RLS -> deny-all pour anon/authenticated ; seul service_role (bypass RLS), appelé
-- depuis la fonction auth-by-identifier, la touche via le RPC ci-dessous.

create table if not exists public.auth_rate_limit (
  bucket text primary key,
  count int not null default 0,
  window_start timestamptz not null default now()
);
alter table public.auth_rate_limit enable row level security;

-- Incrémente le seau `p_key`. Si la fenêtre courante a expiré, repart à 1. Renvoie true si
-- la requête est AUTORISÉE (compteur <= p_max), false si le quota est dépassé. Atomique via
-- INSERT ... ON CONFLICT DO UPDATE ... RETURNING (pas de course entre lecture et écriture).
create or replace function public.rate_limit_hit(p_key text, p_max int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_now timestamptz := now();
  v_count int;
begin
  insert into public.auth_rate_limit as a (bucket, count, window_start)
    values (p_key, 1, v_now)
  on conflict (bucket) do update
    set count = case when a.window_start < v_now - make_interval(secs => p_window_seconds)
                     then 1 else a.count + 1 end,
        window_start = case when a.window_start < v_now - make_interval(secs => p_window_seconds)
                     then v_now else a.window_start end
  returning a.count into v_count;
  return v_count <= p_max;
end;
$$;

revoke all on function public.rate_limit_hit(text, int, int) from public;
revoke all on function public.rate_limit_hit(text, int, int) from anon;
revoke all on function public.rate_limit_hit(text, int, int) from authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;

-- Purge occasionnelle des seaux expirés (appelée best-effort depuis la fonction, sans bloquer).
create or replace function public.rate_limit_gc()
returns void
language sql
security definer
set search_path to 'public'
as $$
  delete from public.auth_rate_limit where window_start < now() - interval '1 hour';
$$;
revoke all on function public.rate_limit_gc() from public;
revoke all on function public.rate_limit_gc() from anon;
revoke all on function public.rate_limit_gc() from authenticated;
grant execute on function public.rate_limit_gc() to service_role;
