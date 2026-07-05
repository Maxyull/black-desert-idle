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
--  * playtime_sec = temps de jeu cumulé de tous les joueurs sur cette heure (chaque ping vaut ~60s)
--
-- FAILLE CORRIGÉE le 2026-07-05 (audit des avertissements Supabase, voir
-- supabase/migrations/20260705080000_fix_admin_views_security.sql) : cette vue SECURITY DEFINER
-- était lisible par N'IMPORTE QUEL compte connecté ou anonyme via l'API REST. La clause WHERE
-- ci-dessous ne renvoie des lignes que pour l'email admin ; ne JAMAIS retirer ce filtre si ce
-- fichier est ré-exécuté.
create or replace view public.admin_playtime_by_hour
with (security_invoker = false) as
select date_trunc('hour', pinged_at) as hour,
       count(*) * 60 as total_playtime_sec
from public.playtime_pings
where pinged_at > now() - interval '48 hours'
  and coalesce((select auth.jwt()->>'email'), '') = 'maxime.lacoste@icloud.com'
group by 1
order by 1 desc;

revoke all on public.admin_playtime_by_hour from anon, authenticated;
grant select on public.admin_playtime_by_hour to authenticated;
