-- Rattrapage hors-ligne Phase 2 : taux lus depuis les colonnes SERVEUR de player_stats (V455,
-- 2026-07-16) -- suite directe de player_hour_rates_fair_leaderboard.sql (V454).
--
-- Avant : credit_offline_progress_hourly() lisait bestSilverPerHour/bestKpm dans save_data (des
-- records CLIENT, pics de 3 min extrapolés). Deux trous ouverts par le reset V454 :
--   1. comptes qui rechargent : record local remis à 0 -> crédit hors-ligne ~0 jusqu'à ce que le
--      joueur refarm quelques minutes ;
--   2. comptes dormants (jamais rechargés) : save_data garde l'ancien taux GONFLÉ (ex: 2M/h pour
--      un rythme réel ~900k/h) -> le cron continuait de les payer à un taux irréaliste, sans fin.
-- Après : v_rate_silver/v_rate_kpm viennent de player_stats.silver_per_hour/best_kpm -- le record
-- à vie "meilleure heure PLEINE" possédé par le serveur (compute_player_hour_rates(), trigger
-- protect_server_rate_columns : inécrivable par un client). Le record à vie (et PAS la colonne
-- _week) préserve la décision explicite du owner sur Phase 2 ("illimité tant que le compte
-- existe") : un compte dormant garde son taux honnête pour toujours, alors que la colonne _week
-- serait retombée à 0 au bout de 7 jours d'inactivité. Un compte sans aucune heure honnête
-- enregistrée (post-reset) ne touche rien jusqu'à sa prochaine vraie heure de farm -- fail-safe
-- assumé, cohérent avec "tout le monde repart sur la même base" (V454).
-- Le taux XP reste lu depuis save_data (bestXpPerHour) : l'XP n'a aucune source serveur (pas de
-- journal), inchangé.
-- Côté client (même version V455) : computeOfflineCatchupSilver/Loot (Phase 1) basculent de la
-- même façon sur ces valeurs serveur (attachées par loadCloudSave), repli record local si la
-- lecture réseau échoue.

create or replace function public.credit_offline_progress_hourly()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_level_xp numeric[] := array[
    1,1,1,1,1,161,472,1181,2626,5319,10005,17721,29865,48273,75300,113911,167777,241381,340127,
    470464,640005,857666,1133804,1480364,1911035,2441411,3089163,3874210,4818908,5948238,7290005,
    8875042,10737423,12914685,15448049,18382661,21767828,25657269,30109369,35187443,40960005,
    47501047,54890322,63213635,72563144,83037661,94742974,118571374,158997683,207619316,415238632,
    830477264,1245715896,1868573844,2802860766,8408582298,21021455745,52553639363,105107278725,
    210214557450,630643672350,1261287344700,2522574689400,5045149378800,10090298757600,
    20180597515200,40361195000000,80722390000000,161444780000000,322889560000000,645779120000000,
    1291558200000000
  ];
  v_max_silver_per_hour constant numeric := 5000000000;
  v_max_kpm constant numeric := 500;
  v_max_xp_per_hour constant numeric := 25000000;
  v_min_account_age constant interval := interval '3 days';
  v_min_playtime_sec constant numeric := 7200;
  rec record;
  v_save jsonb;
  v_s jsonb;
  v_inv jsonb;
  v_rate_silver numeric;
  v_rate_kpm numeric;
  v_rate_xp numeric;
  v_silver_gain numeric;
  v_xp_gain numeric;
  v_zone_idx int;
  v_kills numeric;
  v_loot record;
  v_qty_mat numeric;
  v_qty_craft numeric;
  v_lvl int;
  v_xp numeric;
  v_xpnext numeric;
  v_iter int;
begin
  for rec in
    select
      gs.user_id, gs.save_data, gs.last_server_credit_at,
      u.created_at as account_created_at,
      coalesce(ps.playtime_sec, 0) as playtime_sec,
      -- V455 : taux équitables possédés par le serveur (voir en-tête de cette migration)
      coalesce(ps.silver_per_hour, 0) as server_rate_silver,
      coalesce(ps.best_kpm, 0) as server_rate_kpm
    from public.game_saves gs
    left join auth.users u on u.id = gs.user_id
    left join public.player_stats ps on ps.user_id = gs.user_id
    where gs.save_data is not null and gs.save_data <> '{}'::jsonb
  loop
    if rec.last_server_credit_at is not null and rec.last_server_credit_at > now() - interval '55 minutes' then
      continue;
    end if;
    if rec.account_created_at is null or rec.account_created_at > now() - v_min_account_age then
      continue;
    end if;
    if rec.playtime_sec < v_min_playtime_sec then
      continue;
    end if;

    v_save := rec.save_data;
    v_s := v_save->'S';
    if v_s is null or jsonb_typeof(v_s) <> 'object' then
      continue;
    end if;

    -- V455 : silver/kpm depuis player_stats (serveur, heure pleine) -- plus jamais depuis
    -- save_data. XP inchangé (aucune source serveur pour l'XP).
    v_rate_silver := least(greatest(coalesce(rec.server_rate_silver, 0), 0), v_max_silver_per_hour);
    v_rate_kpm    := least(greatest(coalesce(rec.server_rate_kpm, 0), 0), v_max_kpm);
    v_rate_xp     := least(greatest(coalesce((v_s->>'bestXpPerHour')::numeric, 0), 0), v_max_xp_per_hour);

    if v_rate_silver <= 0 and v_rate_xp <= 0 and v_rate_kpm <= 0 then
      update public.game_saves set last_server_credit_at = now() where user_id = rec.user_id;
      continue;
    end if;

    v_silver_gain := round(v_rate_silver);
    if v_silver_gain > 0 then
      v_s := jsonb_set(v_s, '{silver}', to_jsonb(coalesce((v_s->>'silver')::numeric, 0) + v_silver_gain));
      v_s := jsonb_set(v_s, '{silverEarned}', to_jsonb(coalesce((v_s->>'silverEarned')::numeric, 0) + v_silver_gain));
    end if;

    v_xp_gain := round(v_rate_xp);
    if v_xp_gain > 0 then
      v_s := jsonb_set(v_s, '{xpEarned}', to_jsonb(coalesce((v_s->>'xpEarned')::numeric, 0) + v_xp_gain));
      v_lvl := coalesce((v_s->>'lvl')::int, 1);
      v_xp := coalesce((v_s->>'xp')::numeric, 0) + v_xp_gain;
      v_xpnext := v_level_xp[least(v_lvl,71)+1];
      v_iter := 0;
      while v_xp >= v_xpnext and v_lvl < 100 and v_iter < 200 loop
        v_xp := v_xp - v_xpnext;
        v_lvl := v_lvl + 1;
        v_xpnext := v_level_xp[least(v_lvl,71)+1];
        v_iter := v_iter + 1;
      end loop;
      v_s := jsonb_set(v_s, '{xp}', to_jsonb(v_xp));
      v_s := jsonb_set(v_s, '{lvl}', to_jsonb(v_lvl));
      v_s := jsonb_set(v_s, '{xpNext}', to_jsonb(v_xpnext));
      v_s := jsonb_set(v_s, '{hpMax}', to_jsonb(100 + 8*greatest(v_lvl-1,0)));
    end if;

    v_save := jsonb_set(v_save, '{S}', v_s);

    if v_rate_kpm > 0 then
      v_zone_idx := coalesce((v_save->>'zoneIdx')::int, 0);
      select * into v_loot from public.offline_credit_zone_loot where zone_idx = v_zone_idx;
      if found then
        v_kills := v_rate_kpm * 60;
        v_qty_mat := floor(v_kills * v_loot.mat_ch);
        v_qty_craft := floor(v_kills * v_loot.craft_ch);
        if v_qty_mat > 0 or v_qty_craft > 0 then
          v_inv := coalesce(v_save->'INV', '[]'::jsonb);
          if v_qty_mat > 0 then
            v_inv := public.offline_credit_add_item(v_inv, v_loot.mat_name, v_loot.mat_val, v_loot.mat_color, 'material', 'mat_'||v_loot.mat_name, v_qty_mat);
          end if;
          if v_qty_craft > 0 then
            v_inv := public.offline_credit_add_item(v_inv, v_loot.craft_name, 0, '#b48ce8', 'craft', 'craft_'||v_loot.craft_name, v_qty_craft);
          end if;
          v_save := jsonb_set(v_save, '{INV}', v_inv);
        end if;
      end if;
    end if;

    update public.game_saves
      set save_data = v_save, last_server_credit_at = now()
      where user_id = rec.user_id;

    if v_silver_gain > 0 then
      insert into public.silver_ledger(user_id, delta, category, note)
        values (rec.user_id, v_silver_gain, 'offline_catchup', 'Rattrapage hors ligne serveur (cron horaire)');
    end if;
  end loop;
end;
$function$;
