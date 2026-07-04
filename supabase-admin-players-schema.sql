-- ============================================================
-- Liste des joueurs (admin) — Velia Idle
-- Panneau admin : liste de tous les joueurs inscrits (player_stats) avec leur statut en ligne
-- (via la table presence) et leur UUID copiable en un clic. Réservé au staff.
--
-- Supabase > SQL Editor > New query > Run
-- ============================================================

create or replace function public.admin_list_players()
returns table(user_id uuid, display_name text, silver bigint, gearscore int, lvl int, online boolean, last_seen timestamptz)
language plpgsql security definer
as $$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Réservé au staff';
  end if;
  return query
    select ps.user_id, coalesce(ps.display_name,'?'), coalesce(ps.silver,0), coalesce(ps.gearscore,0)::int, coalesce(ps.lvl,1)::int,
      (pr.last_seen is not null and pr.last_seen > now() - interval '90 seconds') as online,
      pr.last_seen
    from public.player_stats ps
    left join public.presence pr on pr.user_id = ps.user_id
    order by (pr.last_seen is not null and pr.last_seen > now() - interval '90 seconds') desc, pr.last_seen desc nulls last;
end;
$$;
grant execute on function public.admin_list_players() to authenticated;

-- inventaire complet (192 cases) d'un joueur, réservé au staff — pour investiguer un signalement
-- ou une triche suspectée sans devoir demander au joueur de faire des captures d'écran
create or replace function public.admin_get_player_inventory(p_user_id uuid)
returns jsonb
language plpgsql security definer
as $$
declare v_inv jsonb;
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Réservé au staff';
  end if;
  select save_data->'INV' into v_inv from public.game_saves where user_id = p_user_id;
  return coalesce(v_inv, '[]'::jsonb);
end;
$$;
grant execute on function public.admin_get_player_inventory(uuid) to authenticated;
