-- ============================================================
-- Réinitialisation ADMIN d'un joueur précis par UUID (demande explicite du 2026-07-06 : "ajoute
-- côté admin de pouvoir réinitialiser un joueur spécifique par uuid") -- complète
-- admin_reset_all_accounts (qui reset TOUT LE MONDE) par une version ciblée, un seul compte.
-- Même garde-fou admin (email staff vérifié côté serveur) et même mécanique de notification
-- (player_notices) que le reset global, mais insérée pour CE seul joueur au lieu d'un broadcast.
--
-- Supabase > SQL Editor > New query > Run
-- ============================================================

create or replace function public.admin_reset_account_by_uuid(
  p_user_id uuid, p_title_fr text, p_title_en text, p_body_fr text, p_body_en text
)
returns boolean
language plpgsql security definer
set search_path to 'public'
as $$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Réservé au staff';
  end if;
  if not exists (select 1 from public.game_saves where user_id = p_user_id) then
    return false;
  end if;
  update public.game_saves set save_data = '{}'::jsonb where user_id = p_user_id;
  delete from public.player_stats where user_id = p_user_id;
  insert into public.player_notices (user_id, notice_key, icon, title_fr, title_en, body_fr, body_en)
  values (p_user_id, 'account_reset', '🔄', p_title_fr, p_title_en, p_body_fr, p_body_en)
  on conflict (user_id, notice_key) do update set
    icon = excluded.icon, title_fr = excluded.title_fr, title_en = excluded.title_en,
    body_fr = excluded.body_fr, body_en = excluded.body_en, created_at = now();
  return true;
end;
$$;
grant execute on function public.admin_reset_account_by_uuid(uuid,text,text,text,text) to authenticated;
