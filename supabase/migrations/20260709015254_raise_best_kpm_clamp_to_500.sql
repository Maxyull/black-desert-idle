-- relève le plafond anti-triche de best_kpm de 300 à 500 (demande explicite du 2026-07-09,
-- suite à l'alerte Discord "Naïka" 438.3 kpm bornée à 300 — jugé trop bas pour un build très
-- optimisé, sans preuve de triche par ailleurs). CREATE OR REPLACE d'une fonction TRIGGER (pas de
-- paramètres, aucune ambiguïté de surcharge possible) : pas besoin de DROP préalable, contrairement
-- à la règle "toujours DROP l'ancienne signature" qui vise les RPC surchargées par arguments.
CREATE OR REPLACE FUNCTION public.clamp_player_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_created timestamptz;
  v_max_playtime bigint;
  v_before numeric;
begin
  v_before := coalesce(new.silver,0);
  new.silver := least(greatest(coalesce(new.silver,0), 0), 1000000000000);
  if v_before is distinct from new.silver then perform public.notify_cheat_discord(new.user_id, 'silver', v_before, new.silver); end if;

  v_before := coalesce(new.silver_per_hour,0);
  new.silver_per_hour := least(greatest(coalesce(new.silver_per_hour,0), 0), 5000000000);
  if v_before is distinct from new.silver_per_hour then perform public.notify_cheat_discord(new.user_id, 'silver_per_hour', v_before, new.silver_per_hour); end if;

  v_before := coalesce(new.gearscore,0);
  new.gearscore := least(greatest(coalesce(new.gearscore,0), 0), 2000);
  if v_before is distinct from new.gearscore then perform public.notify_cheat_discord(new.user_id, 'gearscore', v_before, new.gearscore); end if;

  -- AP/DP individuels (ajoutés le 2026-07-08) : le Gearscore = (AP+DP)/2 plafonne déjà à 2000,
  -- donc chacun ne peut pas dépasser ~4000 dans un cas extrême — borne large mais cohérente
  v_before := coalesce(new.ap,0);
  new.ap := least(greatest(coalesce(new.ap,0), 0), 4000);
  if v_before is distinct from new.ap then perform public.notify_cheat_discord(new.user_id, 'ap', v_before, new.ap); end if;

  v_before := coalesce(new.dp,0);
  new.dp := least(greatest(coalesce(new.dp,0), 0), 4000);
  if v_before is distinct from new.dp then perform public.notify_cheat_discord(new.user_id, 'dp', v_before, new.dp); end if;

  v_before := coalesce(new.lvl,1);
  new.lvl := least(greatest(coalesce(new.lvl,1), 1), 100);
  if v_before is distinct from new.lvl then perform public.notify_cheat_discord(new.user_id, 'lvl', v_before, new.lvl); end if;

  v_before := coalesce(new.best_zone_index,0);
  new.best_zone_index := least(greatest(coalesce(new.best_zone_index,0), 0), 50);
  if v_before is distinct from new.best_zone_index then perform public.notify_cheat_discord(new.user_id, 'best_zone_index', v_before, new.best_zone_index); end if;

  v_before := coalesce(new.best_item_count,0);
  new.best_item_count := least(greatest(coalesce(new.best_item_count,0), 0), 100000000);
  if v_before is distinct from new.best_item_count then perform public.notify_cheat_discord(new.user_id, 'best_item_count', v_before, new.best_item_count); end if;

  v_before := coalesce(new.treasure_count,0);
  new.treasure_count := least(greatest(coalesce(new.treasure_count,0), 0), 1000000);
  if v_before is distinct from new.treasure_count then perform public.notify_cheat_discord(new.user_id, 'treasure_count', v_before, new.treasure_count); end if;

  -- plafond relevé de 300 à 500 (2026-07-09, demande explicite "born a 500")
  v_before := coalesce(new.best_kpm,0);
  new.best_kpm := least(greatest(coalesce(new.best_kpm,0), 0), 500);
  if v_before is distinct from new.best_kpm then perform public.notify_cheat_discord(new.user_id, 'best_kpm', v_before, new.best_kpm); end if;

  begin
    select created_at into v_created from auth.users where id = new.user_id;
  exception when others then v_created := null;
  end;
  v_before := coalesce(new.playtime_sec,0);
  if v_created is not null then
    v_max_playtime := ceil(extract(epoch from (now() - v_created))) + 86400;
    new.playtime_sec := least(greatest(coalesce(new.playtime_sec,0), 0), v_max_playtime);
  else
    new.playtime_sec := least(greatest(coalesce(new.playtime_sec,0), 0), 40000000);
  end if;
  if v_before is distinct from new.playtime_sec then perform public.notify_cheat_discord(new.user_id, 'playtime_sec', v_before, new.playtime_sec); end if;

  return new;
end;
$function$
