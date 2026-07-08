-- Anti wash-trading (2026-07-17, question explicite : "as-tu integre anti washing pour le
-- market") -- market_match_item() appariait le meilleur achat et la meilleure vente SANS jamais
-- verifier que buyer_id != seller_id. Un joueur pouvait donc faire matcher son propre ordre
-- d'achat contre son propre ordre de vente, deplacant son propre silver (au prix du spread) et
-- surtout inscrivant un faux "dernier prix" dans market_trades, utilise comme reference par les
-- autres joueurs -- une manipulation de prix classique (wash trading), sans aucun risque reel
-- pour celui qui la pratique.
--
-- Fix : la selection de la vente exclut desormais le vendeur si son user_id correspond a
-- l'acheteur courant. Le meilleur achat reste inchange ; s'il ne reste aucune vente ELIGIBLE (tout
-- appartient a l'acheteur lui-meme), la boucle s'arrete normalement (v_sell.id est null), aucun
-- risque de boucle infinie -- meme garde-fou de sortie qu'avant (for update skip locked +
-- exit when v_sell.id is null).
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
    -- anti wash-trading : jamais de vente du MEME compte que l'acheteur courant
    select * into v_sell from public.market_orders
      where item_key = p_item_key and side = 'sell' and status = 'open' and user_id <> v_buy.user_id
      order by price asc, random() limit 1 for update skip locked;

    exit when v_sell.id is null or v_buy.price < v_sell.price;

    v_qty := least(v_buy.qty, v_sell.qty);
    v_price := v_sell.price;

    select save_data into v_sell_save from public.game_saves where user_id = v_sell.user_id for update;
    if v_sell_save is not null then
      v_sell_save := jsonb_set(v_sell_save, array['S','silver'],
        to_jsonb(coalesce((v_sell_save->'S'->>'silver')::bigint, 0) + floor(v_price * v_qty)));
      update public.game_saves set save_data = v_sell_save where user_id = v_sell.user_id;
      insert into public.silver_ledger (user_id, delta, category, note)
        values (v_sell.user_id, floor(v_price * v_qty)::bigint, 'market_sell', v_sell.item_name);
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
$function$
