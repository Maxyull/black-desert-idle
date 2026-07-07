-- ============================================================
-- FAILLE CORRIGÉE (issue GitHub #4, 2026-07-14) : game_saves.save_data (silver, équipement,
-- enchantement -- toute l'économie du joueur) est écrit par un simple upsert client-side
-- (saveToCloud(), game-supabase.js), avec RLS qui ne vérifie que la propriété de la ligne
-- (auth.uid() = user_id), jamais le contenu. Un joueur pouvait se donner un silver illimité (ou
-- un enchantement au-delà de PEN) depuis la console du navigateur et le dépenser réellement
-- contre d'autres joueurs via le marché (market_place_order lit save_data directement).
--
-- Le trigger clamp_player_stats existant protège déjà player_stats (colonnes typées, alimente
-- le classement PUBLIC) -- mais PAS game_saves.save_data (JSONB libre, le vrai fichier de
-- sauvegarde rechargé par le joueur). Ce correctif étend la même philosophie (borner les valeurs
-- manifestement impossibles + alerter Discord via notify_cheat_discord, déjà utilisé par
-- clamp_player_stats) à game_saves : silver/silverEarned/tokenSilverEarned/loyalty/lvl à la
-- racine de S, et l'enchantement (enhLv) de chaque pièce d'équipement/sac/sac protégé, plafonné à
-- 20 (PEN, voir ENH_NAMES côté client -- game-core.js).
--
-- Ne borne volontairement PAS les stats individuelles (ap/dp/hp/dodge) de chaque pièce
-- d'équipement : elles dépendent de formules complexes (palier de stuff, gearBasisAP/DP,
-- enh_step...) qu'il serait fragile de répliquer ici, avec un vrai risque de faux positif sur un
-- personnage haut niveau légitime. silver/lvl/loyalty/enhLv sont les cibles à plus forte valeur
-- et les moins ambiguës à borner sans faux positif.
-- ============================================================

create or replace function public.clamp_game_save()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_before numeric;
  v_s jsonb;
  v_equip jsonb;
  v_slot text;
  v_item jsonb;
  v_enh numeric;
  v_new_enh numeric;
  v_i int;
  v_changed boolean := false;
begin
  if new.save_data is null or new.save_data = '{}'::jsonb then
    return new;
  end if;

  -- ---- agrégats économiques dans S ----
  v_s := new.save_data->'S';
  if v_s is not null and jsonb_typeof(v_s) = 'object' then
    v_before := coalesce((v_s->>'silver')::numeric, 0);
    if v_before < 0 or v_before > 1000000000000 then
      v_s := jsonb_set(v_s, '{silver}', to_jsonb(least(greatest(v_before,0),1000000000000)));
      perform public.notify_cheat_discord(new.user_id, 'save_silver', v_before, least(greatest(v_before,0),1000000000000));
      v_changed := true;
    end if;

    v_before := coalesce((v_s->>'silverEarned')::numeric, 0);
    if v_before < 0 or v_before > 1000000000000 then
      v_s := jsonb_set(v_s, '{silverEarned}', to_jsonb(least(greatest(v_before,0),1000000000000)));
      perform public.notify_cheat_discord(new.user_id, 'save_silverEarned', v_before, least(greatest(v_before,0),1000000000000));
      v_changed := true;
    end if;

    v_before := coalesce((v_s->>'tokenSilverEarned')::numeric, 0);
    if v_before < 0 or v_before > 1000000000000 then
      v_s := jsonb_set(v_s, '{tokenSilverEarned}', to_jsonb(least(greatest(v_before,0),1000000000000)));
      perform public.notify_cheat_discord(new.user_id, 'save_tokenSilverEarned', v_before, least(greatest(v_before,0),1000000000000));
      v_changed := true;
    end if;

    v_before := coalesce((v_s->>'lvl')::numeric, 1);
    if v_before < 1 or v_before > 100 then
      v_s := jsonb_set(v_s, '{lvl}', to_jsonb(least(greatest(v_before,1),100)));
      perform public.notify_cheat_discord(new.user_id, 'save_lvl', v_before, least(greatest(v_before,1),100));
      v_changed := true;
    end if;

    v_before := coalesce((v_s->>'loyalty')::numeric, 0);
    if v_before < 0 or v_before > 1000000 then
      v_s := jsonb_set(v_s, '{loyalty}', to_jsonb(least(greatest(v_before,0),1000000)));
      perform public.notify_cheat_discord(new.user_id, 'save_loyalty', v_before, least(greatest(v_before,0),1000000));
      v_changed := true;
    end if;

    if v_changed then
      new.save_data := jsonb_set(new.save_data, '{S}', v_s);
    end if;
  end if;

  -- ---- enchantement (enhLv) de l'équipement porté, plafonné à 20 (PEN) ----
  v_equip := new.save_data->'EQUIP';
  if v_equip is not null and jsonb_typeof(v_equip) = 'object' then
    for v_slot in select jsonb_object_keys(v_equip) loop
      v_item := v_equip->v_slot;
      if v_item is not null and jsonb_typeof(v_item) = 'object' and (v_item->>'enhLv') is not null then
        v_enh := (v_item->>'enhLv')::numeric;
        if v_enh < 0 or v_enh > 20 then
          v_new_enh := least(greatest(v_enh,0),20);
          new.save_data := jsonb_set(new.save_data, array['EQUIP', v_slot, 'enhLv'], to_jsonb(v_new_enh));
          perform public.notify_cheat_discord(new.user_id, 'save_equip_enhLv_' || v_slot, v_enh, v_new_enh);
        end if;
      end if;
    end loop;
  end if;

  -- ---- enchantement (enhLv) du sac principal ----
  if jsonb_typeof(new.save_data->'INV') = 'array' then
    for v_i in 0 .. jsonb_array_length(new.save_data->'INV') - 1 loop
      v_item := new.save_data->'INV'->v_i;
      if v_item is not null and jsonb_typeof(v_item) = 'object' and (v_item->>'enhLv') is not null then
        v_enh := (v_item->>'enhLv')::numeric;
        if v_enh < 0 or v_enh > 20 then
          v_new_enh := least(greatest(v_enh,0),20);
          new.save_data := jsonb_set(new.save_data, array['INV', v_i::text, 'enhLv'], to_jsonb(v_new_enh));
          perform public.notify_cheat_discord(new.user_id, 'save_inv_enhLv_' || v_i, v_enh, v_new_enh);
        end if;
      end if;
    end loop;
  end if;

  -- ---- enchantement (enhLv) du sac protégé (Compendium) ----
  if jsonb_typeof(new.save_data->'COMPENDIUM_BAG') = 'array' then
    for v_i in 0 .. jsonb_array_length(new.save_data->'COMPENDIUM_BAG') - 1 loop
      v_item := new.save_data->'COMPENDIUM_BAG'->v_i;
      if v_item is not null and jsonb_typeof(v_item) = 'object' and (v_item->>'enhLv') is not null then
        v_enh := (v_item->>'enhLv')::numeric;
        if v_enh < 0 or v_enh > 20 then
          v_new_enh := least(greatest(v_enh,0),20);
          new.save_data := jsonb_set(new.save_data, array['COMPENDIUM_BAG', v_i::text, 'enhLv'], to_jsonb(v_new_enh));
          perform public.notify_cheat_discord(new.user_id, 'save_compendium_enhLv_' || v_i, v_enh, v_new_enh);
        end if;
      end if;
    end loop;
  end if;

  return new;
end;
$function$;

drop trigger if exists clamp_game_save_trigger on public.game_saves;
create trigger clamp_game_save_trigger
  before insert or update on public.game_saves
  for each row execute function public.clamp_game_save();
