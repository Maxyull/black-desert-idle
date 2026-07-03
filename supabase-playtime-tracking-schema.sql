-- ============================================================
-- Suivi du temps de jeu total (tous joueurs) par tranche d'heure — Velia Idle
-- Le jeu envoie un "ping" toutes les 60s pendant qu'un joueur est actif (onglet visible) ;
-- chaque ping représente ~60s de temps de jeu. La vue additionne ces pings par tranche
-- d'heure pour donner le temps de jeu cumulé de TOUS les joueurs sur chaque heure — affiché
-- dans la Zone Admin, à côté du silver farmé par heure (déjà existant).
--
-- Auto-suffisant : ne dépend d'aucune table déjà créée dans une session précédente.
-- Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists public.playtime_pings (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  pinged_at timestamptz not null default now()
);

create index if not exists playtime_pings_pinged_at_idx on public.playtime_pings(pinged_at);

alter table public.playtime_pings enable row level security;
-- aucune policy select/insert directe pour les joueurs : uniquement via la fonction ci-dessous
-- (SECURITY DEFINER), pour éviter qu'un client falsifie pinged_at ou spamme des pings

create or replace function public.log_playtime_ping()
returns void
language plpgsql security definer
as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.playtime_pings (user_id) values (auth.uid());
end;
$$;

grant execute on function public.log_playtime_ping() to authenticated;

-- vue admin : par tranche d'heure, sur les 48 dernières heures —
--  * players     = nombre de joueurs DISTINCTS actifs pendant cette heure (ex: 3 = trois joueurs)
--  * playtime_sec = temps de jeu cumulé de tous ces joueurs (chaque ping vaut ~60s)
create or replace view public.admin_playtime_by_hour as
select date_trunc('hour', pinged_at) as hour,
       count(distinct user_id) as players,
       count(*) * 60 as playtime_sec
from public.playtime_pings
where pinged_at > now() - interval '48 hours'
group by 1
order by 1 desc;

grant select on public.admin_playtime_by_hour to authenticated;
