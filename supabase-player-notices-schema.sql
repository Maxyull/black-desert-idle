-- ============================================================
-- Notices persistantes joueur + reset complet de TOUS les comptes — Velia Idle
-- Sert à afficher un message important (bannière stylée + notification) au joueur la PROCHAINE
-- fois qu'il se connecte, même s'il est hors ligne au moment de l'action admin (ex: après une
-- remise à zéro complète des comptes suite à un gros changement d'économie). Demande explicite
-- du 2026-07-06.
--
-- Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists public.player_notices (
  user_id uuid not null references auth.users(id) on delete cascade,
  notice_key text not null,
  icon text not null default '🔔',
  title_fr text not null,
  title_en text not null,
  body_fr text not null,
  body_en text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, notice_key)
);
alter table public.player_notices enable row level security;
-- pas de policy SELECT directe : on ne lit/consomme QUE via claim_pending_notice() (security
-- definer), qui supprime la ligne en même temps qu'elle la renvoie (livraison "une seule fois")

-- l'admin diffuse un message à TOUS les comptes enregistrés (auth.users) : chacun le verra une
-- seule fois, à sa prochaine connexion
create or replace function public.admin_broadcast_notice(
  p_notice_key text, p_icon text, p_title_fr text, p_title_en text, p_body_fr text, p_body_en text
)
returns int
language plpgsql security definer
as $$
declare v_count int;
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Réservé au staff';
  end if;
  insert into public.player_notices (user_id, notice_key, icon, title_fr, title_en, body_fr, body_en)
  select id, p_notice_key, p_icon, p_title_fr, p_title_en, p_body_fr, p_body_en from auth.users
  on conflict (user_id, notice_key) do update set
    icon = excluded.icon, title_fr = excluded.title_fr, title_en = excluded.title_en,
    body_fr = excluded.body_fr, body_en = excluded.body_en, created_at = now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
grant execute on function public.admin_broadcast_notice(text, text, text, text, text, text) to authenticated;

-- le joueur "réclame" sa notice en attente à la connexion : la renvoie ET la supprime en même
-- temps (une seule livraison), rien si aucune notice n'attend
create or replace function public.claim_pending_notice()
returns table(notice_key text, icon text, title_fr text, title_en text, body_fr text, body_en text)
language plpgsql security definer
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  return query delete from public.player_notices pn where pn.user_id = v_uid
    returning pn.notice_key, pn.icon, pn.title_fr, pn.title_en, pn.body_fr, pn.body_en;
end;
$$;
grant execute on function public.claim_pending_notice() to authenticated;

-- remise à zéro COMPLÈTE de tous les comptes joueurs (silver, équipement, niveau, sac...) : vide
-- chaque sauvegarde cloud (le client traite un save_data vide exactement comme un nouveau
-- personnage, voir loadCloudSave), et efface les stats publiques du classement (recréées au
-- prochain login/sync de chaque joueur). Combine le wipe + la diffusion du message d'explication
-- en un seul appel pour ne jamais oublier l'un des deux.
create or replace function public.admin_reset_all_accounts(
  p_title_fr text, p_title_en text, p_body_fr text, p_body_en text
)
returns int
language plpgsql security definer
as $$
declare v_count int;
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Réservé au staff';
  end if;
  update public.game_saves set save_data = '{}'::jsonb;
  get diagnostics v_count = row_count;
  delete from public.player_stats;
  perform public.admin_broadcast_notice('account_reset', '🔄', p_title_fr, p_title_en, p_body_fr, p_body_en);
  return v_count;
end;
$$;
grant execute on function public.admin_reset_all_accounts(text, text, text, text) to authenticated;
