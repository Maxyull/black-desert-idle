-- Ajustement de la taxe de vente Marche : 20% -> 35% (2026-07-18, demande explicite : "35% au
-- market"). Meme repartition qu'avant (vendeur uniquement, acheteur paie toujours le prix
-- affiche) : seul le facteur change (0.8 -> 0.65) dans market_match_item() et
-- market_sell_material(), voir la migration precedente
-- (20260718110000_market_sales_tax_20pct.sql) pour le detail des deux fonctions.

drop function if exists public.market_match_item(text);

create or replace function public.market_match_item(p_item_key text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_buy record;
  v_sell record;
  v_qty int;
  v_price numeric;
  v_payout bigint;
  v_buy_save jsonb;
  v_sell_save jsonb;
  v_inv jsonb;
  v_i int;
  v_found int;
  v_slot int;
begin
  loop
    select * into v_buy from public.market_orders
      where item_key = p_item_key and side = 'buy' and status = 'open'
      order by price desc, random() limit 1 for update skip locked;
    exit when v_buy.id is null;
    select * into v_sell from public.market_orders
      where item_key = p_item_key and side = 'sell' and status = 'open' and user_id <> v_buy.user_id
      order by price asc, random() limit 1 for update skip locked;

    exit when v_sell.id is null or v_buy.price < v_sell.price;

    v_qty := least(v_buy.qty, v_sell.qty);
    v_price := v_sell.price;
    -- taxe de vente 35% (2026-07-18) : le vendeur touche 65% du prix de vente
    v_payout := floor(v_price * v_qty * 0.65);

    select save_data into v_sell_save from public.game_saves where user_id = v_sell.user_id for update;
    if v_sell_save is not null then
      v_sell_save := jsonb_set(v_sell_save, array['S','silver'],
        to_jsonb(coalesce((v_sell_save->'S'->>'silver')::bigint, 0) + v_payout));
      update public.game_saves set save_data = v_sell_save where user_id = v_sell.user_id;
      insert into public.silver_ledger (user_id, delta, category, note)
        values (v_sell.user_id, v_payout, 'market_sell', v_sell.item_name);
    end if;

    select save_data into v_buy_save from public.game_saves where user_id = v_buy.user_id for update;
    if v_buy_save is not null then
      v_inv := v_buy_save->'INV';
      if v_sell.item_kind = 'material' then
        v_found := -1;
        for v_i in 0 .. jsonb_array_length(v_inv) - 1 loop
          if (v_inv->v_i) is not null and (v_inv->v_i)->>'key' = v_sell.item_key then
            v_found := v_i; exit;
          end if;
        end loop;
        if v_found >= 0 then
          v_inv := jsonb_set(v_inv, array[v_found::text, 'qty'],
            to_jsonb(coalesce((v_inv->v_found->>'qty')::int, 0) + v_qty));
        else
          select (idx - 1) into v_slot from jsonb_array_elements(v_inv) with ordinality as arr(elem, idx)
            where elem = 'null'::jsonb limit 1;
          if v_slot is not null then
            v_inv := jsonb_set(v_inv, array[v_slot::text],
              (v_sell.item_snapshot || jsonb_build_object('qty', v_qty)));
          end if;
        end if;
      else
        select (idx - 1) into v_slot from jsonb_array_elements(v_inv) with ordinality as arr(elem, idx)
          where elem = 'null'::jsonb limit 1;
        if v_slot is not null then
          v_inv := jsonb_set(v_inv, array[v_slot::text], v_sell.item_snapshot);
        end if;
      end if;
      v_buy_save := jsonb_set(v_buy_save, array['INV'], v_inv);
      update public.game_saves set save_data = v_buy_save where user_id = v_buy.user_id;
    end if;

    if v_buy.price > v_price then
      select save_data into v_buy_save from public.game_saves where user_id = v_buy.user_id for update;
      if v_buy_save is not null then
        v_buy_save := jsonb_set(v_buy_save, array['S','silver'],
          to_jsonb(coalesce((v_buy_save->'S'->>'silver')::bigint, 0) + floor((v_buy.price - v_price) * v_qty)));
        update public.game_saves set save_data = v_buy_save where user_id = v_buy.user_id;
        insert into public.silver_ledger (user_id, delta, category, note)
          values (v_buy.user_id, floor((v_buy.price - v_price) * v_qty)::bigint, 'market_refund', v_sell.item_name);
      end if;
    end if;

    insert into public.market_trades (item_key, item_name, price, qty, buy_order_id, sell_order_id)
      values (p_item_key, v_sell.item_name, v_price, v_qty, v_buy.id, v_sell.id);

    update public.market_orders set qty = qty - v_qty, updated_at = now(),
      status = case when qty - v_qty <= 0 then 'filled' else 'open' end
      where id = v_buy.id;
    update public.market_orders set qty = qty - v_qty, updated_at = now(),
      status = case when qty - v_qty <= 0 then 'filled' else 'open' end
      where id = v_sell.id;
  end loop;
end;
$function$;

drop function if exists public.market_sell_material(integer, integer);

create or replace function public.market_sell_material(p_inv_index integer, p_qty integer)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_save jsonb;
  v_item jsonb;
  v_price_key text;
  v_price numeric;
  v_payout bigint;
  v_have int;
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, true) then
    raise exception 'Compte invité non autorisé — lie un compte vérifié pour utiliser le marché';
  end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Quantité invalide'; end if;

  select save_data into v_save from public.game_saves where user_id = v_uid for update;
  if v_save is null then raise exception 'Sauvegarde introuvable'; end if;

  v_item := v_save->'INV'->p_inv_index;
  if v_item is null or v_item = 'null'::jsonb then raise exception 'Emplacement vide'; end if;
  if v_item->>'kind' <> 'material' then raise exception 'Cet objet ne se vend pas sur le marché commun'; end if;

  v_price_key := 'material:' || (v_item->>'name');
  select current_price into v_price from public.market_prices where item_key = v_price_key for update;
  if v_price is null then raise exception 'Ce matériau n''est pas coté sur le marché commun'; end if;

  v_have := coalesce((v_item->>'qty')::int, 0);
  if v_have < p_qty then raise exception 'Quantité insuffisante'; end if;

  -- taxe de vente 35% (2026-07-18) : meme taux que le carnet d'ordres
  v_payout := floor(v_price * p_qty * 0.65);

  if v_have = p_qty then
    v_save := jsonb_set(v_save, array['INV', p_inv_index::text], 'null'::jsonb);
  else
    v_save := jsonb_set(v_save, array['INV', p_inv_index::text, 'qty'], to_jsonb(v_have - p_qty));
  end if;

  v_save := jsonb_set(v_save, array['S','silver'],
    to_jsonb(coalesce((v_save->'S'->>'silver')::bigint, 0) + v_payout));
  update public.game_saves set save_data = v_save where user_id = v_uid;
  insert into public.silver_ledger (user_id, delta, category, note)
    values (v_uid, v_payout, 'market_sell', v_item->>'name');
end;
$function$;
