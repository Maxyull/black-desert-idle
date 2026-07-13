-- ============================================================
-- Étend clamp_game_save() (20260714170000_clamp_game_save.sql) pour borner aussi
-- S.bestSilverPerHour / S.bestXpPerHour / S.bestKpm -- 3 champs JSONB 100% côté client, jamais
-- bornés jusqu'ici sur game_saves.save_data (clamp_game_save() ne couvrait que silver/silverEarned/
-- tokenSilverEarned/lvl/loyalty/enhLv). Ces 3 taux servent de base au rattrapage hors-ligne
-- (computeOfflineCatchupSilver/Xp/Loot, core/game-core.js) -- une valeur gonflée depuis la console
-- navigateur restait déjà exploitable par Phase 1 (plafonnée à 24h par reconnexion), mais devient
-- BEAUCOUP plus dangereuse avec Phase 2 (20260722120000_offline_progress_hourly_cron.sql, crédit
-- horaire ILLIMITÉ tant que le compte existe, sans jamais requérir de reconnexion) : sans ce
-- correctif, crediter 1h avec un bestSilverPerHour arbitrairement gonflé aurait immédiatement
-- percuté le plafond absolu de S.silver (déjà bornée à 10¹² par clamp_game_save) en une seule
-- exécution du cron plutôt qu'en jouant légitimement.
--
-- Bornes réutilisées telles quelles depuis le filet déjà existant sur player_stats
-- (clamp_player_stats(), schema_snapshot_functions.sql) plutôt qu'inventées ici :
--   silver_per_hour ≤ 5×10⁹, best_kpm ≤ 500. Aucun équivalent n'existait pour un "xp/h" -- borné à
--   2×10⁸/h, dérivé du pire cas légitime déjà permis par les 2 bornes ci-dessus : 500 kills/min ×
--   60 × 560 xp (mob le plus généreux du jeu, Forêt de Polly, zones-data.js) ≈ 16,8×10⁶ xp/h, marge
--   ×~12 pour absorber une future zone plus généreuse sans re-migration (voir même valeur/
--   raisonnement dans credit_offline_progress_hourly(), gardée strictement identique ici).
--
-- credit_offline_progress_hourly() applique DÉJÀ sa propre borne en LECTURE sur ces 3 champs (elle
-- ne peut pas dépendre de ce trigger pour les lignes déjà en base AVANT cette migration -- un
-- trigger ne s'applique que sur écriture, jamais rétroactivement). Ce correctif-ci est un 2e filet,
-- complémentaire : il protège en plus Phase 1 (rattrapage 100% client, computeOfflineCatchupSilver/
-- Xp lues directement depuis data.S sans repasser par ce trigger avant affichage) et empêche une
-- valeur gonflée de rester en base au-delà du tout premier UPDATE qui la contiendrait.
-- Jamais modifier une migration déjà appliquée (CLAUDE.md §12) -- CREATE OR REPLACE d'une fonction
-- existante dans une NOUVELLE migration, pas une édition du fichier 20260714170000.
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

    -- ---- NOUVEAU (2026-07-14) : taux persos utilisés par le rattrapage hors-ligne, voir
    -- commentaire en tête de fichier. Mêmes bornes que clamp_player_stats() pour silver_per_hour/
    -- best_kpm ; xp_per_hour dérivée (voir raisonnement en tête de fichier).
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
-- trigger déjà en place (clamp_game_save_trigger, 20260714170000) -- CREATE OR REPLACE de la
-- fonction suffit, aucun besoin de DROP/CREATE TRIGGER (même signature/nom de fonction).
