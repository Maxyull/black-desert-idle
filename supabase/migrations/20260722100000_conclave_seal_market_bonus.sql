-- Sceau du Conclave des Marchands : bonus vendeur (2026-07-13, NON APPLIQUEE cette session --
-- ecrite sans acces Supabase authentifie, a appliquer par une session/CLI qui en dispose).
--
-- SUPERSEDEE (2026-07-13, meme jour, session suivante avec acces Supabase authentifie) : la
-- definition de market_match_item supposee ici etait perimee (colonnes market_trades differentes,
-- logique de remboursement acheteur absente) et market_sell_material (vente directe, meme facteur
-- 0.65 en dur) n'etait pas couverte du tout. Voir 20260722100001_conclave_seal_market_bonus_v2.sql
-- pour la version reellement appliquee en base -- ce fichier reste tel quel pour l'historique,
-- jamais modifie une fois ecrit (CLAUDE.md section 12), mais ne PAS l'appliquer tel quel.
--
-- Remplace le facteur de payout FIXE 0.65 (market_match_item, voir
-- 20260718130000_market_sales_tax_35pct.sql) par un facteur PAR VENDEUR : si le vendeur a assemble
-- le Sceau (game_saves.save_data->'S'->>'hasConclaveMarchandsSeal' = 'true'), applique la taxe/frais
-- reduits (-5% taxe + -3% "frais de mise en vente", pas de flux de frais separe dans ce jeu -- voir
-- CLAUDE.md/market.js pour le detail) PUIS le bonus de gain net (+8%) :
--   base   = 1 - 0.35 = 0.65
--   reduit = 0.65 + 0.05 + 0.03 = 0.73
--   final  = 0.73 * 1.08 = 0.7884
-- (0.65 -> 0.7884, cohere avec conclaveSealEffectiveSellKeepFraction() cote client, market.js).
--
-- Pas de nouvelle colonne/table : lit le flag directement dans save_data (deja jsonb), meme
-- approche que le reste du jeu (aucune donnee joueur dupliquee hors game_saves pour un simple
-- flag booleen). DROP avant CREATE OR REPLACE (regle RPC CLAUDE.md section 12 -- signature
-- inchangee ici mais applique la meme prudence).

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
  v_payout_factor numeric;
  v_seller_has_seal boolean;
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

    -- Sceau du Conclave des Marchands (2026-07-13) : payout 0.65 -> 0.7884 si le vendeur l'a
    -- assemble (flag permanent S.hasConclaveMarchandsSeal, voir craftConclaveSeal côté client).
    select coalesce((save_data->'S'->>'hasConclaveMarchandsSeal')::boolean, false)
      into v_seller_has_seal from public.game_saves where user_id = v_sell.user_id;
    v_payout_factor := case when v_seller_has_seal then 0.7884 else 0.65 end;
    v_payout := floor(v_price * v_qty * v_payout_factor);

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
      insert into public.market_trades (item_key, item_name, item_kind, price, qty, buyer_user_id, seller_user_id)
        values (p_item_key, v_sell.item_name, v_sell.item_kind, v_price, v_qty, v_buy.user_id, v_sell.user_id);
    end if;

    update public.market_orders set qty = qty - v_qty, status = case when qty - v_qty <= 0 then 'filled' else status end
      where id = v_buy.id;
    update public.market_orders set qty = qty - v_qty, status = case when qty - v_qty <= 0 then 'filled' else status end
      where id = v_sell.id;
  end loop;
end;
$function$;

grant execute on function public.market_match_item(text) to anon, authenticated;

-- NOTE POUR LA SESSION QUI APPLIQUERA CETTE MIGRATION :
-- 1. Verifier d'abord la VRAIE definition actuelle de market_match_item (elle a pu evoluer depuis
--    20260718130000, ex: colonnes market_trades) via execute_sql/schema_snapshot avant d'ecraser --
--    ce fichier a ete ecrit a partir de la derniere version connue au moment du portage
--    (2026-07-13/22), potentiellement perimee si une autre session a retouche ce RPC entre-temps.
-- 2. market_sell_material (vente directe au prix du marche, si elle existe en tant que fonction
--    separee) n'est PAS couverte ici -- verifier si un flux equivalent existe et needs le meme
--    traitement (grep "market_sell_material" dans supabase/migrations).
-- 3. Mettre a jour supabase/schema_snapshot_functions.sql apres application (meme regle que
--    clamp_player_stats, CLAUDE.md section 12).
