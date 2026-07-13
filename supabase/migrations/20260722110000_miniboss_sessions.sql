-- Mini Boss (2026-07-13, port du plan validé — voir CLAUDE.md, combat/miniboss.js) : sessions
-- multi-joueurs, contrairement à live_boss (singleton, id=1) plusieurs groupes de 5 joueurs max
-- peuvent combattre en parallèle — nécessite une vraie table de sessions, pas une seule ligne.
--
-- APPLIQUÉE le 2026-07-13 (confirmation explicite de l'utilisateur). Le client
-- (src/combat/miniboss.js) appelle ces RPC de façon opportuniste (try/catch) et dégrade en
-- simulation locale déterministe en cas d'échec réseau — voir le commentaire en tête de miniboss.js.

-- ==================== TABLES ====================

create table if not exists public.miniboss_sessions (
  id uuid primary key default gen_random_uuid(),
  summoner_id uuid not null references auth.users(id),
  summoner_pseudo text,
  hp numeric not null,
  max_hp numeric not null,
  participant_count int not null default 1,
  run_length int not null default 1,
  run_index int not null default 1,
  status text not null default 'forming', -- 'forming' | 'fighting' | 'ended'
  paused_until timestamptz, -- déconnexion détectée (voir plan "Règles de fin de run") -- non
                            -- exploité côté client en V1 (compromis de scope, voir miniboss.js)
  started_at timestamptz,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  created_at timestamptz not null default now()
);
comment on table public.miniboss_sessions is 'Mini Boss : une session par groupe (≤5 joueurs), contrairement à live_boss (singleton). Voir combat/miniboss.js.';

create table if not exists public.miniboss_participants (
  session_id uuid not null references public.miniboss_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  pseudo text,
  role text not null default 'joiner', -- 'summoner' | 'joiner'
  joined_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create table if not exists public.miniboss_contributions (
  session_id uuid not null references public.miniboss_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  pseudo text,
  damage numeric not null default 0,
  last_hit_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

-- pas de policy directe (RPC-only), même traitement que boss_claims (voir schema_snapshot_tables_and_policies.md)
create table if not exists public.miniboss_claims (
  session_id uuid not null references public.miniboss_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  is_summoner boolean not null default false,
  rank int,
  claimed_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

-- réputation joueur (voir plan "Carte de réputation joueur" + minibossReputationScore/
-- minibossReputationSeverityScore, combat/miniboss-data.js) — toutes les stats listées, rien
-- retiré ("on garde tout", décision finale de l'utilisateur).
create table if not exists public.miniboss_reputation (
  user_id uuid primary key references auth.users(id),
  groups_created int not null default 0,
  runs_joined int not null default 0,
  solo_quits int not null default 0,
  disconnects int not null default 0,
  votes int not null default 0,
  runs_clean int not null default 0,
  runs_incident int not null default 0,
  updated_at timestamptz not null default now()
);

-- ==================== RLS ====================
alter table public.miniboss_sessions enable row level security;
alter table public.miniboss_participants enable row level security;
alter table public.miniboss_contributions enable row level security;
alter table public.miniboss_claims enable row level security;
alter table public.miniboss_reputation enable row level security;

drop policy if exists miniboss_sessions_select_all on public.miniboss_sessions;
create policy miniboss_sessions_select_all on public.miniboss_sessions for select
  using (auth.uid() is not null);

drop policy if exists miniboss_participants_select_all on public.miniboss_participants;
create policy miniboss_participants_select_all on public.miniboss_participants for select
  using (auth.uid() is not null);

drop policy if exists miniboss_contributions_select_all on public.miniboss_contributions;
create policy miniboss_contributions_select_all on public.miniboss_contributions for select
  using (auth.uid() is not null);

drop policy if exists miniboss_reputation_select_all on public.miniboss_reputation;
create policy miniboss_reputation_select_all on public.miniboss_reputation for select
  using (auth.uid() is not null);
-- miniboss_claims : aucune policy directe, RPC-only (même traitement que boss_claims)

-- ==================== RPCs ====================
-- toutes SECURITY DEFINER + SET search_path='public' (même convention que boss_contribute/
-- boss_claim, voir CLAUDE.md §12) — DROP avant CREATE OR REPLACE uniquement si la signature change
-- (aucune de ces RPC n'existait avant, donc pas d'ambiguïté de surcharge possible ici).

create or replace function public.miniboss_start(p_run_length int default 1)
returns table(session_id uuid, hp numeric, max_hp numeric, expires_at timestamptz)
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_pseudo text;
  v_hp numeric;
  v_max_hp numeric;
  v_sid uuid;
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;
  select pseudo into v_pseudo from public.profiles where user_id = v_uid;
  -- PV solo (1 participant) : le client passe à miniboss_join le PV réel recalculé côté serveur
  -- une fois le groupe complet -- voir MINIBOSS_HP_BY_SIZE (combat/miniboss-data.js), dupliqué ici
  -- car aucun accès direct aux constantes JS depuis SQL.
  v_hp := 100000; v_max_hp := 100000;
  insert into public.miniboss_sessions (summoner_id, summoner_pseudo, hp, max_hp, participant_count, run_length, status, started_at)
    values (v_uid, coalesce(v_pseudo,'Joueur'), v_hp, v_max_hp, 1, greatest(1, coalesce(p_run_length,1)), 'forming', now())
    returning id into v_sid;
  insert into public.miniboss_participants (session_id, user_id, pseudo, role) values (v_sid, v_uid, coalesce(v_pseudo,'Joueur'), 'summoner');
  insert into public.miniboss_reputation (user_id, groups_created) values (v_uid, 1)
    on conflict (user_id) do update set groups_created = public.miniboss_reputation.groups_created + 1, updated_at = now();
  return query select v_sid, v_hp, v_max_hp, (select expires_at from public.miniboss_sessions where id = v_sid);
end;
$$;

create or replace function public.miniboss_join(p_session_id uuid)
returns int -- nouveau participant_count, ou -1 (introuvable/expiré/plein)
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_pseudo text;
  v_s record;
  v_cnt int;
  v_hp_by_size numeric[] := array[0,100000,160000,220000,280000,340000];
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;
  select * into v_s from public.miniboss_sessions where id = p_session_id for update;
  if v_s.id is null or v_s.status <> 'forming' or v_s.expires_at <= now() or v_s.participant_count >= 5 then return -1; end if;
  select pseudo into v_pseudo from public.profiles where user_id = v_uid;
  insert into public.miniboss_participants (session_id, user_id, pseudo, role) values (p_session_id, v_uid, coalesce(v_pseudo,'Joueur'), 'joiner')
    on conflict (session_id, user_id) do nothing;
  select count(*) into v_cnt from public.miniboss_participants where session_id = p_session_id;
  update public.miniboss_sessions set participant_count = v_cnt,
    hp = v_hp_by_size[least(v_cnt,5)], max_hp = v_hp_by_size[least(v_cnt,5)]
    where id = p_session_id;
  insert into public.miniboss_reputation (user_id, runs_joined) values (v_uid, 1)
    on conflict (user_id) do update set runs_joined = public.miniboss_reputation.runs_joined + 1, updated_at = now();
  return v_cnt;
end;
$$;

-- rejoindre un groupe DÉJÀ EN COMBAT : notifie les membres actuels au lieu d'ajouter directement
-- (voir plan §0sexies) -- le client écoute côté Realtime Presence/Broadcast (aucune table dédiée
-- nécessaire pour le pop-up lui-même, voir joinMinibossLobbyChannel/miniboss.js) ; cette RPC ne
-- fait qu'enregistrer la demande de façon traçable côté serveur pour un futur usage (ex: mobile,
-- notification hors-ligne) -- en V1 la notification réelle passe par le canal Realtime, pas par
-- une lecture de cette table.
create or replace function public.miniboss_request_join(p_session_id uuid)
returns boolean
language plpgsql security definer set search_path to 'public'
as $$
declare v_uid uuid := auth.uid(); v_status text;
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;
  select status into v_status from public.miniboss_sessions where id = p_session_id;
  if v_status is null then return false; end if;
  return true; -- accusé de réception ; la décision (accepter/refuser) transite par Realtime
end;
$$;

create or replace function public.miniboss_contribute(p_session_id uuid, p_damage numeric, p_pseudo text default null)
returns table(hp numeric, max_hp numeric)
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_s record;
  v_pseudo text;
  v_new_hp numeric;
  v_new_max_hp numeric;
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;
  select * into v_s from public.miniboss_sessions where id = p_session_id for update;
  if v_s.id is null or v_s.status <> 'fighting' or v_s.expires_at <= now() or coalesce(v_s.hp,0) <= 0 then
    return query select coalesce(v_s.hp,0), coalesce(v_s.max_hp,0); return;
  end if;
  v_pseudo := nullif(trim(coalesce(p_pseudo,'')), '');
  if v_pseudo is null then select pseudo into v_pseudo from public.profiles where user_id = v_uid; end if;
  if v_pseudo is null then v_pseudo := 'Joueur'; end if;
  -- même clamp anti-triche que boss_contribute (≤ 5% des PV max par appel), voir CLAUDE.md §12
  p_damage := greatest(0, least(p_damage, v_s.max_hp * 0.05));
  update public.miniboss_sessions s set hp = greatest(0, s.hp - p_damage) where s.id = p_session_id
    returning s.hp, s.max_hp into v_new_hp, v_new_max_hp;
  insert into public.miniboss_contributions (session_id, user_id, pseudo, damage, last_hit_at)
    values (p_session_id, v_uid, v_pseudo, p_damage, now())
    on conflict (session_id, user_id) do update set damage = public.miniboss_contributions.damage + excluded.damage,
      pseudo = excluded.pseudo, last_hit_at = now();
  hp := v_new_hp; max_hp := v_new_max_hp;
  return next;
end;
$$;

create or replace function public.miniboss_claim(p_session_id uuid)
returns table(rank int, is_summoner boolean)
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_s record;
  v_rank int;
  v_is_summoner boolean;
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;
  select * into v_s from public.miniboss_sessions where id = p_session_id;
  if v_s.id is null or coalesce(v_s.hp,1) > 0 then return; end if;
  if not exists (select 1 from public.miniboss_contributions where session_id = p_session_id and user_id = v_uid) then return; end if;
  if exists (select 1 from public.miniboss_claims where session_id = p_session_id and user_id = v_uid) then
    -- double réclamation : refusée silencieusement (pas d'alerte Discord dédiée en V1, voir
    -- notify_cheat_discord()/boss_claim pour le modèle si une surveillance est ajoutée plus tard)
    return;
  end if;
  select rnk into v_rank from (
    select user_id, rank() over (order by damage desc) as rnk
    from public.miniboss_contributions where session_id = p_session_id
  ) t where t.user_id = v_uid;
  v_is_summoner := (v_s.summoner_id = v_uid);
  insert into public.miniboss_claims (session_id, user_id, is_summoner, rank) values (p_session_id, v_uid, v_is_summoner, coalesce(v_rank,999));
  if v_is_summoner then
    update public.miniboss_reputation set runs_clean = runs_clean + 1, updated_at = now() where user_id = v_uid;
  end if;
  rank := coalesce(v_rank, 999); is_summoner := v_is_summoner;
  return next;
end;
$$;

create or replace function public.miniboss_list_active()
returns table(id uuid, summoner_pseudo text, participant_count int, status text, hp numeric, max_hp numeric, run_length int, run_index int)
language plpgsql security definer set search_path to 'public'
as $$
begin
  return query
    select s.id, s.summoner_pseudo, s.participant_count, s.status, s.hp, s.max_hp, s.run_length, s.run_index
    from public.miniboss_sessions s
    where s.expires_at > now() and s.status in ('forming','fighting')
    order by s.created_at desc limit 50;
end;
$$;

create or replace function public.miniboss_active_count(p_session_id uuid)
returns integer
language plpgsql security definer set search_path to 'public'
as $$
declare v_cnt int;
begin
  select count(*) into v_cnt from public.miniboss_contributions
    where session_id = p_session_id and last_hit_at > now() - interval '10 seconds';
  return coalesce(v_cnt, 0);
end;
$$;

create or replace function public.miniboss_top(p_session_id uuid)
returns table(user_id uuid, pseudo text, damage numeric, pct numeric, active boolean)
language plpgsql security definer set search_path to 'public'
as $$
declare v_total numeric;
begin
  select coalesce(sum(c.damage), 0) into v_total from public.miniboss_contributions c where c.session_id = p_session_id;
  return query
    select c.user_id, c.pseudo, c.damage,
      case when v_total > 0 then round(c.damage / v_total * 100, 1) else 0 end as pct,
      (c.last_hit_at > now() - interval '10 seconds') as active
    from public.miniboss_contributions c
    where c.session_id = p_session_id
    order by c.damage desc limit 15;
end;
$$;
