-- ============================================================
-- Anti-triche (best-effort) — Velia Idle
-- Le jeu est "client-authoritative" : silver, gearscore, etc. sont calculés côté navigateur
-- puis envoyés au classement (player_stats) par un upsert direct. Un tricheur peut donc écrire
-- des valeurs arbitraires dans SA propre ligne via l'API. On ne peut pas l'empêcher totalement
-- sans réécrire toute la logique côté serveur, mais ce trigger REJETTE/BORNE les valeurs
-- manifestement impossibles pour garder un classement crédible.
--
-- Supabase > SQL Editor > New query > Run (après le schéma du classement)
-- ============================================================

-- SECURITY DEFINER : nécessaire pour lire auth.users depuis le trigger (un utilisateur normal
-- n'y a pas accès en direct)
create or replace function public.clamp_player_stats()
returns trigger
language plpgsql security definer
as $$
declare
  v_created timestamptz;
  v_max_playtime bigint;
begin
  -- bornes dures : au-delà, c'est forcément de la triche (le jeu ne peut pas produire ça)
  new.silver          := least(greatest(coalesce(new.silver,0), 0), 1000000000000);   -- 1 000 milliards max
  new.silver_per_hour := least(greatest(coalesce(new.silver_per_hour,0), 0), 5000000000); -- 5 milliards/h max
  new.gearscore       := least(greatest(coalesce(new.gearscore,0), 0), 2000);          -- GS endgame ~500, marge large
  new.lvl             := least(greatest(coalesce(new.lvl,1), 1), 100);                  -- niveau max de la table d'XP
  new.best_zone_index := least(greatest(coalesce(new.best_zone_index,0), 0), 50);
  new.best_item_count := least(greatest(coalesce(new.best_item_count,0), 0), 100000000);

  -- le temps de jeu ne peut pas dépasser le temps écoulé depuis la création du compte (+ marge)
  begin
    select created_at into v_created from auth.users where id = new.user_id;
  exception when others then v_created := null; -- si l'accès échoue, on retombe sur le cap absolu
  end;
  if v_created is not null then
    v_max_playtime := ceil(extract(epoch from (now() - v_created))) + 86400; -- +1 jour de marge
    new.playtime_sec := least(greatest(coalesce(new.playtime_sec,0), 0), v_max_playtime);
  else
    new.playtime_sec := least(greatest(coalesce(new.playtime_sec,0), 0), 40000000);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_clamp_player_stats on public.player_stats;
create trigger trg_clamp_player_stats
  before insert or update on public.player_stats
  for each row execute function public.clamp_player_stats();
