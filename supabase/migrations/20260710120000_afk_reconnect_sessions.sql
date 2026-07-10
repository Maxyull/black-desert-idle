-- Modal de reconnexion (2026-07-10, demande explicite : "construire l'histo record + suivit
-- admin") -- historique réel des sessions AFK/hors-ligne du joueur, remplace les données de
-- démonstration de reconnect-modal.jsx. Une ligne = une absence (visibilitychange hidden->visible
-- côté client, voir showAwayLootSummaryIfAny/core/game-core.js), enregistrée UNE SEULE FOIS au
-- retour, jamais mise à jour après coup.
create table if not exists public.player_afk_sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null default now(),
  silver_gained bigint not null default 0,
  xp_gained bigint not null default 0,
  level_before int not null default 1,
  level_after int not null default 1,
  zone_name text,
  gear_grade text, -- 'grey'|'white'|'green'|'blue' (GEAR_TIERS.grade de la zone au moment du retour)
  items jsonb not null default '[]'::jsonb, -- [{name,color,qty}]
  best_drop_name text,
  best_drop_color text
);
create index if not exists player_afk_sessions_user_id_started_at_idx
  on public.player_afk_sessions(user_id, started_at desc);
alter table public.player_afk_sessions enable row level security;

-- lecture : chaque joueur voit uniquement ses propres sessions, l'admin voit tout (même pattern
-- que les autres policies admin du projet, ex: 20260705080200_fix_rls_performance.sql)
create policy player_afk_sessions_select_own on public.player_afk_sessions
  for select
  using ((select auth.uid()) = user_id or (select auth.jwt()->>'email') = 'maxime.lacoste@icloud.com');

-- écriture : uniquement via record_afk_session (security definer) ci-dessous, jamais d'insert
-- direct côté client -- pas de policy insert/update/delete pour les rôles authenticated/anon.

-- insertion d'une session (appelée UNE FOIS par le client au retour d'absence) -- security definer
-- pour poser user_id = auth.uid() côté serveur (jamais fourni par le client), même esprit que les
-- autres RPC "j'écris ma propre ligne" du projet.
drop function if exists public.record_afk_session(timestamptz, timestamptz, bigint, bigint, int, int, text, text, jsonb, text, text);
create or replace function public.record_afk_session(
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_silver_gained bigint,
  p_xp_gained bigint,
  p_level_before int,
  p_level_after int,
  p_zone_name text,
  p_gear_grade text,
  p_items jsonb,
  p_best_drop_name text,
  p_best_drop_color text
) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.player_afk_sessions(
    user_id, started_at, ended_at, silver_gained, xp_gained, level_before, level_after,
    zone_name, gear_grade, items, best_drop_name, best_drop_color
  ) values (
    auth.uid(), p_started_at, p_ended_at, greatest(0, coalesce(p_silver_gained,0)), greatest(0, coalesce(p_xp_gained,0)),
    coalesce(p_level_before,1), coalesce(p_level_after,1), p_zone_name, p_gear_grade,
    coalesce(p_items, '[]'::jsonb), p_best_drop_name, p_best_drop_color
  );
end; $$;
grant execute on function public.record_afk_session(timestamptz, timestamptz, bigint, bigint, int, int, text, text, jsonb, text, text) to authenticated;

-- historique perso (les N dernières sessions, plus récent d'abord) -- lu par le modal de
-- reconnexion pour l'onglet "Historique des sessions"
drop function if exists public.get_afk_history(int);
create or replace function public.get_afk_history(p_limit int default 12)
returns setof public.player_afk_sessions
language sql security definer set search_path to 'public' as $$
  select * from public.player_afk_sessions
  where user_id = auth.uid()
  order by started_at desc
  limit greatest(1, least(50, coalesce(p_limit, 12)));
$$;
grant execute on function public.get_afk_history(int) to authenticated;

-- suivi admin agrégé (2026-07-10, demande explicite : "suivit admin") -- vue d'ensemble du volume
-- de silver/temps AFK récupéré par tous les joueurs, plus les sessions les plus généreuses --
-- réservé au staff, même gate email que les autres RPC admin du projet.
drop function if exists public.admin_afk_sessions_summary();
create or replace function public.admin_afk_sessions_summary()
returns table(
  total_sessions bigint,
  total_players bigint,
  total_silver bigint,
  avg_silver numeric,
  top_sessions jsonb
)
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Réservé au staff';
  end if;
  return query
  select
    count(*)::bigint,
    count(distinct s.user_id)::bigint,
    coalesce(sum(s.silver_gained),0)::bigint,
    coalesce(avg(s.silver_gained),0)::numeric,
    coalesce((
      select jsonb_agg(row_to_json(t)) from (
        select s2.silver_gained, s2.zone_name, s2.ended_at, s2.user_id
        from public.player_afk_sessions s2
        order by s2.silver_gained desc
        limit 10
      ) t
    ), '[]'::jsonb)
  from public.player_afk_sessions s;
end; $$;
grant execute on function public.admin_afk_sessions_summary() to authenticated;
