-- ============================================================
-- clamp_game_save() : sortir les tableaux des boucles (2026-07-20).
--
-- LE POSTE N°1 DE LA BASE. L'upsert de game_saves représente 31 % de tout le temps d'exécution
-- (8 350 s cumulées, ~160 000 appels). Mesuré avec EXPLAIN ANALYZE sur une écriture réelle :
--
--     Update on game_saves ............................  98,3 ms
--       Index Scan using game_saves_pkey ..............   0,09 ms
--       Trigger clamp_game_save_trigger ............... >>> 97,8 ms <<<
--       Trigger set_updated_at ........................   0,23 ms
--
-- Autrement dit : la table n'y est pour rien (59 lignes, 1,1 Mo, 100 % de HOT updates), tout le
-- coût est dans ce seul trigger.
--
-- LA CAUSE. Les boucles d'inventaire écrivaient `new.save_data->'INV'->v_i` À CHAQUE ITÉRATION.
-- `new.save_data` est un jsonb de ~8 ko (37 ko au pire) : chaque itération le redéchiffre
-- intégralement pour n'en extraire qu'un élément. Sur un sac de plusieurs dizaines de cases, ×3
-- tableaux (INV, COMPENDIUM_BAG, EQUIP), ça fait des centaines de traversées complètes du document
-- par sauvegarde. C'est l'anti-patron jsonb classique en plpgsql.
--
-- LA CORRECTION. Le tableau est extrait UNE fois dans une variable, et la boucle lit la variable.
--
-- AUCUNE RÈGLE NE CHANGE : mêmes bornes, mêmes clés, mêmes appels à notify_cheat_discord() avec
-- les mêmes libellés, même valeur de retour. C'est une réécriture de forme, pas de fond -- le
-- garde-fou anti-triche fait exactement ce qu'il faisait, en une fraction du temps.
--
-- (Constat au passage, volontairement NON corrigé ici pour ne pas mélanger les sujets : VELIA_CHEST
-- n'est pas borné alors que INV et COMPENDIUM_BAG le sont. À traiter à part, c'est un changement de
-- comportement, pas de performance.)
-- ============================================================

create or replace function public.clamp_game_save()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
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
  v_arr jsonb;              -- tableau courant, extrait UNE fois (voir l'en-tête)
  v_len int;
begin
  if new.save_data is null or new.save_data = '{}'::jsonb then
    return new;
  end if;

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

    v_before := coalesce((v_s->>'bestSilverPerHour')::numeric, 0);
    if v_before < 0 or v_before > 5000000000 then
      v_s := jsonb_set(v_s, '{bestSilverPerHour}', to_jsonb(least(greatest(v_before,0),5000000000)));
      perform public.notify_cheat_discord(new.user_id, 'save_bestSilverPerHour', v_before, least(greatest(v_before,0),5000000000));
      v_changed := true;
    end if;

    v_before := coalesce((v_s->>'bestXpPerHour')::numeric, 0);
    if v_before < 0 or v_before > 200000000 then
      v_s := jsonb_set(v_s, '{bestXpPerHour}', to_jsonb(least(greatest(v_before,0),200000000)));
      perform public.notify_cheat_discord(new.user_id, 'save_bestXpPerHour', v_before, least(greatest(v_before,0),200000000));
      v_changed := true;
    end if;

    v_before := coalesce((v_s->>'bestKpm')::numeric, 0);
    if v_before < 0 or v_before > 500 then
      v_s := jsonb_set(v_s, '{bestKpm}', to_jsonb(least(greatest(v_before,0),500)));
      perform public.notify_cheat_discord(new.user_id, 'save_bestKpm', v_before, least(greatest(v_before,0),500));
      v_changed := true;
    end if;

    if v_changed then
      new.save_data := jsonb_set(new.save_data, '{S}', v_s);
    end if;
  end if;

  v_equip := new.save_data->'EQUIP';
  if v_equip is not null and jsonb_typeof(v_equip) = 'object' then
    -- lit v_equip (déjà extrait) et non new.save_data->'EQUIP' à chaque tour
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

  v_arr := new.save_data->'INV';
  if jsonb_typeof(v_arr) = 'array' then
    v_len := jsonb_array_length(v_arr);
    for v_i in 0 .. v_len - 1 loop
      v_item := v_arr->v_i;              -- v_arr, pas new.save_data->'INV' : c'est TOUT le gain
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

  v_arr := new.save_data->'COMPENDIUM_BAG';
  if jsonb_typeof(v_arr) = 'array' then
    v_len := jsonb_array_length(v_arr);
    for v_i in 0 .. v_len - 1 loop
      v_item := v_arr->v_i;
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
$$;
