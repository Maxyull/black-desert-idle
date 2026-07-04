-- ============================================================
-- Marché commun v2 : vrai carnet d'ordres (achat ET vente) — Velia Idle
-- Remplace l'ancien système "prix flottant, achat/vente instantanés" (supabase-common-market-schema.sql,
-- table market_prices, désormais inutilisée) par un vrai marché entre joueurs. Demande explicite du
-- 2026-07-07.
--
-- - Un ordre d'ACHAT bloque immédiatement le silver du joueur (escrow) tant qu'il n'est pas
--   exécuté ou annulé.
-- - Un ordre de VENTE retire immédiatement l'objet de l'inventaire du vendeur (escrow) — pour
--   l'équipement/bijoux (non empilables), un instantané complet de l'objet est conservé pour le
--   restituer exactement tel quel à l'acheteur.
-- - Dès qu'un ordre est posé, on tente de le faire correspondre au meilleur ordre opposé
--   disponible. En cas d'égalité de prix entre plusieurs ordres opposés, une "roulette" (tirage
--   aléatoire) désigne lequel est servi en premier. L'exécution se fait au prix du VENDEUR.
-- - Objets échangeables : matériaux d'optimisation (empilables) ET équipement/bijoux (regroupés
--   par nom + niveau d'enchantement, comme le vrai marché BDO).
--
-- Supabase > SQL Editor > New query > Run (après supabase-common-market-schema.sql existant)
-- ============================================================

create table if not exists public.market_orders (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  pseudo text,
  item_key text not null,
  item_name text not null,
  item_kind text not null,
  item_snapshot jsonb,
  side text not null check (side in ('buy','sell')),
  price numeric not null check (price > 0),
  qty int not null check (qty >= 0),
  qty_original int not null,
  status text not null default 'open' check (status in ('open','filled','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_market_orders_matching on public.market_orders(item_key, side, status, price);
create index if not exists idx_market_orders_user on public.market_orders(user_id, status);

alter table public.market_orders enable row level security;
-- ⚠️ pas de policy SELECT directe sur cette table : elle contiendrait le pseudo ET le snapshot
-- exact des autres joueurs (stats d'enchantement incluses). Tout passe par les fonctions
-- SECURITY DEFINER ci-dessous : market_order_book (profondeur publique, sans identité ni
-- snapshot) et market_my_orders (ses propres ordres, avec détail complet).

create table if not exists public.market_trades (
  id bigserial primary key,
  item_key text not null,
  item_name text not null,
  price numeric not null,
  qty int not null,
  buy_order_id bigint,
  sell_order_id bigint,
  created_at timestamptz not null default now()
);
alter table public.market_trades enable row level security;
drop policy if exists "market_trades_select_all" on public.market_trades;
create policy "market_trades_select_all" on public.market_trades for select using (auth.role() = 'authenticated');

create or replace function public.market_match_item(p_item_key text)
returns void
language plpgsql security definer
as $$
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
    select * into v_sell from public.market_orders
      where item_key = p_item_key and side = 'sell' and status = 'open'
      order by price asc, random() limit 1 for update skip locked;

    exit when v_buy.id is null or v_sell.id is null or v_buy.price < v_sell.price;

    v_qty := least(v_buy.qty, v_sell.qty);
    v_price := v_sell.price;

    select save_data into v_sell_save from public.game_saves where user_id = v_sell.user_id for update;
    if v_sell_save is not null then
      v_sell_save := jsonb_set(v_sell_save, array['S','silver'],
        to_jsonb(coalesce((v_sell_save->'S'->>'silver')::bigint, 0) + floor(v_price * v_qty)));
      update public.game_saves set save_data = v_sell_save where user_id = v_sell.user_id;
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
            v_inv := jsonb_set(v_inv, array[v_slot::text], (v_sell.item_snapshot || jsonb_build_object('qty', v_qty)));
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
$$;

-- ⚠️ FAILLE corrigée le 2026-07-07 (audit anti-triche) : pour un ordre de VENTE, item_snapshot
-- était bien re-dérivé du VRAI objet en inventaire (l'acheteur reçoit toujours le bon objet), mais
-- item_key/item_name/item_kind (utilisés pour l'AFFICHAGE de l'annonce et la correspondance)
-- venaient directement des paramètres du CLIENT, jamais vérifiés contre l'objet réel. Un vendeur
-- malveillant pouvait mettre en vente un objet sans valeur en étiquetant l'annonce comme un objet
-- de grande valeur (arnaque à l'appât), ou casser la livraison en mentant sur item_kind. Corrigé :
-- pour une vente, ces 3 champs sont désormais TOUJOURS recalculés depuis l'objet réel de
-- l'inventaire, jamais depuis les paramètres du client (qui ne servent plus que pour un achat, où
-- il n'y a pas d'objet à mal étiqueter).
create or replace function public.market_place_order(
  p_side text, p_item_key text, p_item_name text, p_item_kind text,
  p_price numeric, p_qty int, p_inv_index int default null, p_item_snapshot jsonb default null
)
returns bigint
language plpgsql security definer
as $$
declare
  v_uid uuid := auth.uid();
  v_pseudo text;
  v_save jsonb;
  v_silver bigint;
  v_cost numeric;
  v_item jsonb;
  v_have int;
  v_order_id bigint;
  v_real_name text;
  v_real_kind text;
  v_real_key text;
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, true) then
    raise exception 'Compte invité non autorisé — lie un compte vérifié pour utiliser le marché';
  end if;
  if p_side not in ('buy','sell') then raise exception 'Côté invalide'; end if;
  if p_price is null or p_price <= 0 then raise exception 'Prix invalide'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Quantité invalide'; end if;

  select pseudo into v_pseudo from public.profiles where user_id = v_uid;

  select save_data into v_save from public.game_saves where user_id = v_uid for update;
  if v_save is null then raise exception 'Sauvegarde introuvable'; end if;

  if p_side = 'buy' then
    if p_item_kind <> 'material' and p_qty <> 1 then raise exception 'Quantité doit être 1 pour l''équipement/bijoux'; end if;
    v_cost := ceil(p_price * p_qty);
    v_silver := coalesce((v_save->'S'->>'silver')::bigint, 0);
    if v_silver < v_cost then raise exception 'Silver insuffisant'; end if;
    v_save := jsonb_set(v_save, array['S','silver'], to_jsonb(v_silver - v_cost::bigint));
    update public.game_saves set save_data = v_save where user_id = v_uid;
    v_real_name := p_item_name; v_real_kind := p_item_kind; v_real_key := p_item_key;
  else
    if p_inv_index is null then raise exception 'Emplacement d''inventaire requis pour vendre'; end if;
    v_item := v_save->'INV'->p_inv_index;
    if v_item is null or v_item = 'null'::jsonb then raise exception 'Emplacement vide'; end if;
    v_real_name := v_item->>'name';
    v_real_kind := v_item->>'kind';
    if p_qty <> 1 and v_real_kind <> 'material' then raise exception 'Quantité doit être 1 pour l''équipement/bijoux'; end if;
    if v_real_kind = 'material' then
      v_have := coalesce((v_item->>'qty')::int, 0);
      if v_have < p_qty then raise exception 'Quantité insuffisante'; end if;
      p_item_snapshot := (v_item - 'qty') || jsonb_build_object('qty', 1);
      v_real_key := 'material:' || v_real_name;
      if v_have = p_qty then
        v_save := jsonb_set(v_save, array['INV', p_inv_index::text], 'null'::jsonb);
      else
        v_save := jsonb_set(v_save, array['INV', p_inv_index::text, 'qty'], to_jsonb(v_have - p_qty));
      end if;
    else
      p_item_snapshot := v_item;
      v_real_key := 'gear:' || v_real_name || '+' || coalesce((v_item->>'enhLv')::int, 0);
      v_save := jsonb_set(v_save, array['INV', p_inv_index::text], 'null'::jsonb);
    end if;
    update public.game_saves set save_data = v_save where user_id = v_uid;
  end if;

  insert into public.market_orders (user_id, pseudo, item_key, item_name, item_kind, item_snapshot, side, price, qty, qty_original)
    values (v_uid, coalesce(v_pseudo, 'Joueur'), v_real_key, v_real_name, v_real_kind, p_item_snapshot, p_side, p_price, p_qty, p_qty)
    returning id into v_order_id;

  perform public.market_match_item(v_real_key);
  return v_order_id;
end;
$$;

create or replace function public.market_cancel_order(p_order_id bigint)
returns void
language plpgsql security definer
as $$
declare
  v_uid uuid := auth.uid();
  v_order record;
  v_save jsonb;
  v_inv jsonb;
  v_found int;
  v_i int;
  v_slot int;
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;
  select * into v_order from public.market_orders where id = p_order_id and user_id = v_uid and status = 'open' for update;
  if v_order.id is null then raise exception 'Ordre introuvable ou déjà terminé'; end if;

  select save_data into v_save from public.game_saves where user_id = v_uid for update;
  if v_save is not null then
    if v_order.side = 'buy' then
      v_save := jsonb_set(v_save, array['S','silver'],
        to_jsonb(coalesce((v_save->'S'->>'silver')::bigint, 0) + floor(v_order.price * v_order.qty)));
    else
      v_inv := v_save->'INV';
      if v_order.item_kind = 'material' then
        v_found := -1;
        for v_i in 0 .. jsonb_array_length(v_inv) - 1 loop
          if (v_inv->v_i) is not null and (v_inv->v_i)->>'key' = v_order.item_key then
            v_found := v_i; exit;
          end if;
        end loop;
        if v_found >= 0 then
          v_inv := jsonb_set(v_inv, array[v_found::text, 'qty'],
            to_jsonb(coalesce((v_inv->v_found->>'qty')::int, 0) + v_order.qty));
        else
          select (idx - 1) into v_slot from jsonb_array_elements(v_inv) with ordinality as arr(elem, idx)
            where elem = 'null'::jsonb limit 1;
          if v_slot is not null then
            v_inv := jsonb_set(v_inv, array[v_slot::text], (v_order.item_snapshot || jsonb_build_object('qty', v_order.qty)));
          end if;
        end if;
      else
        select (idx - 1) into v_slot from jsonb_array_elements(v_inv) with ordinality as arr(elem, idx)
          where elem = 'null'::jsonb limit 1;
        if v_slot is not null then
          v_inv := jsonb_set(v_inv, array[v_slot::text], v_order.item_snapshot);
        end if;
      end if;
      v_save := jsonb_set(v_save, array['INV'], v_inv);
    end if;
    update public.game_saves set save_data = v_save where user_id = v_uid;
  end if;

  update public.market_orders set status = 'cancelled', updated_at = now() where id = p_order_id;
end;
$$;

create or replace function public.market_my_orders()
returns setof public.market_orders
language sql security definer
as $$
  select * from public.market_orders
  where user_id = auth.uid() and (status = 'open' or updated_at > now() - interval '24 hours')
  order by created_at desc;
$$;
grant execute on function public.market_my_orders() to authenticated;

create or replace function public.market_order_book(p_item_key text)
returns table(side text, price numeric, qty bigint)
language sql security definer
as $$
  select side, price, sum(qty) as qty
  from public.market_orders
  where item_key = p_item_key and status = 'open'
  group by side, price
  order by side, (case when side = 'buy' then -price else price end);
$$;
grant execute on function public.market_order_book(text) to authenticated;
grant execute on function public.market_place_order(text, text, text, text, numeric, int, int, jsonb) to authenticated;
grant execute on function public.market_cancel_order(bigint) to authenticated;

-- Navigation "vitrine" (inspirée d'une référence visuelle fournie par l'utilisateur le 2026-07-07) :
-- liste les ordres de VENTE ouverts avec pseudo + objet complet (snapshot) + date, pour des cartes
-- d'objets à acheter en un clic avec comparaison face à l'équipement du joueur. Les ordres d'ACHAT
-- restent privés (jamais exposés ici) — seule la vente publique est normale à montrer.
create or replace function public.market_listings(p_kind text default null)
returns table(id bigint, pseudo text, item_key text, item_name text, item_kind text,
  item_snapshot jsonb, price numeric, qty int, created_at timestamptz)
language sql security definer
as $$
  select o.id, o.pseudo, o.item_key, o.item_name, o.item_kind, o.item_snapshot, o.price, o.qty, o.created_at
  from public.market_orders o
  where o.side = 'sell' and o.status = 'open' and (p_kind is null or o.item_kind = p_kind)
  order by o.price asc, o.created_at asc
  limit 200;
$$;
grant execute on function public.market_listings(text) to authenticated;

-- TODO futur : un cron (pg_cron ou appel client périodique) pourrait, toutes les 15 min (puis
-- jusqu'à 6h avec le temps, demande explicite), publier un indicateur "prix moyen des derniers
-- échanges" par objet à partir de market_trades, pour afficher une tendance de marché — pas encore
-- implémenté, le carnet d'ordres actuel suffit pour le lancement de la fonctionnalité.
