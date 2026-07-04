-- ============================================================
-- Voir le stuff d'un joueur depuis le classement — Velia Idle
-- Expose UNIQUEMENT l'équipement (EQUIP) d'un joueur, en lecture seule, pour le lien "voir son
-- stuff" cliquable dans le classement. Ne renvoie jamais le silver, l'inventaire complet ou
-- toute autre donnée privée de sa sauvegarde.
--
-- Supabase > SQL Editor > New query > Run
-- ============================================================

create or replace function public.get_player_gear(p_user_id uuid)
returns jsonb
language plpgsql security definer
as $$
declare v_equip jsonb;
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;
  select save_data->'EQUIP' into v_equip from public.game_saves where user_id = p_user_id;
  return coalesce(v_equip, '{}'::jsonb);
end;
$$;
grant execute on function public.get_player_gear(uuid) to authenticated;
