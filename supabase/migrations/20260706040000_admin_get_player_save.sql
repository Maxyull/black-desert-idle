-- ============================================================
-- "Screenshot" admin d'un joueur (demande explicite du 2026-07-06 : "coté admin pouvoir voir un
-- screen jeu des joueurs en plus de l'uuid l'inventaire") -- lecture seule de la sauvegarde brute
-- d'un joueur par UUID, pour que le staff puisse inspecter équipement/inventaire/état sans jamais
-- rien modifier (contrairement à admin_reset_account_by_uuid qui, lui, efface).
--
-- Supabase > SQL Editor > New query > Run
-- ============================================================

create or replace function public.admin_get_player_save(p_user_id uuid)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_save jsonb;
  v_pseudo text;
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Réservé au staff';
  end if;
  select save_data into v_save from public.game_saves where user_id = p_user_id;
  if v_save is null then return null; end if;
  select coalesce(pr.pseudo, ps.display_name) into v_pseudo
  from (select p_user_id as user_id) u
  left join public.profiles pr on pr.user_id = u.user_id
  left join public.player_stats ps on ps.user_id = u.user_id;
  return v_save || jsonb_build_object('_pseudo', coalesce(v_pseudo, '?'));
end;
$$;
grant execute on function public.admin_get_player_save(uuid) to authenticated;
