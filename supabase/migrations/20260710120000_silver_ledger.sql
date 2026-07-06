-- ============================================================
-- Registre de silver (2026-07-10, demande explicite) : "je dois pouvoir traquer le moindre
-- silver" -- toute variation de silver (loot, potions, ventes, quêtes, marché, admin...) est
-- désormais journalisée dans silver_ledger, avec la catégorie et un delta signé (positif = gain,
-- négatif = dépense). Alimente l'onglet Admin "Silver", remplacé par un vrai tableau/graph.
--
-- Part de ZÉRO : aucun historique avant cette migration n'est reconstituable (rien n'était
-- journalisé jusqu'ici), demande explicite de l'utilisateur, confirmé avant implémentation.
--
-- Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists public.silver_ledger (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta bigint not null,
  category text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists silver_ledger_user_id_idx on public.silver_ledger(user_id);
create index if not exists silver_ledger_created_at_idx on public.silver_ledger(created_at);
create index if not exists silver_ledger_category_idx on public.silver_ledger(category);

alter table public.silver_ledger enable row level security;

-- le client écrit ses propres mouvements (loot/potion/vente/quête côté jeu, voir addSilver dans
-- game-core.js) ; les fonctions SECURITY DEFINER (marché) écrivent pour d'autres joueurs en
-- bypassant RLS normalement (même mécanisme déjà utilisé par market_match_item sur game_saves)
create policy "Le joueur journalise ses propres mouvements de silver"
  on public.silver_ledger for insert
  to authenticated
  with check (user_id = auth.uid());

-- lecture réservée à l'admin (demande explicite : registre dans le panneau Admin, pas un onglet
-- joueur) -- même convention que playtime_pings (voir 20260706100000_fix_security_definer_views.sql)
create policy "Admin uniquement lit le registre de silver"
  on public.silver_ledger for select
  using (coalesce((select auth.jwt()->>'email'), '') = 'maxime.lacoste@icloud.com');

-- vue #1 : totaux par catégorie (gagné / dépensé / nb de transactions) -- alimente le tableau
create view public.admin_silver_ledger_by_category
  with (security_invoker = true) as
  select category,
    coalesce(sum(delta) filter (where delta > 0), 0) as total_gained,
    coalesce(-sum(delta) filter (where delta < 0), 0) as total_spent,
    count(*) as tx_count
  from public.silver_ledger
  group by category
  order by (coalesce(sum(delta) filter (where delta > 0), 0) + coalesce(-sum(delta) filter (where delta < 0), 0)) desc;

-- vue #2 : série horaire (48h) du delta net -- alimente le graphique
create view public.admin_silver_ledger_by_hour
  with (security_invoker = true) as
  select date_trunc('hour', created_at) as hour,
    sum(delta) as net_delta
  from public.silver_ledger
  where created_at > now() - interval '48 hours'
  group by 1
  order by 1;

-- ============================================================
-- Marché : les 2 seuls endroits où du silver bouge SANS passer par le client (SECURITY DEFINER,
-- direct sur game_saves) -- journalisés ici pour que "marché" apparaisse bien dans le registre,
-- comme demandé explicitement. CREATE OR REPLACE avec le corps existant + 1 insert par mouvement.
-- ============================================================

create or replace function public.market_place_order(
  p_side text, p_item_key text, p_item_name text, p_item_kind text,
  p_price numeric, p_qty integer, p_inv_index integer default null::integer,
  p_item_snapshot jsonb default null::jsonb
)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    insert into public.silver_ledger (user_id, delta, category, note)
      values (v_uid, -v_cost::bigint, 'market_buy', p_item_name);
    v_real_name := p_item_name; v_real_kind := p_item_kind; v_real_key := p_item_key;
  else
    if p_inv_index is null then raise exception 'Emplacement d''inventaire requis pour vendre'; end if;
    v_item := v_save->'INV'->p_inv_index;
    if v_item is null or v_item = 'null'::jsonb then raise exception 'Emplacement vide'; end if;
    -- ⚠️ étiquette de l'annonce TOUJOURS dérivée du vrai objet, jamais des paramètres du client
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
$function$;

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
    -- meilleur ACHAT (prix le plus haut), égalités départagées au hasard
    select * into v_buy from public.market_orders
      where item_key = p_item_key and side = 'buy' and status = 'open'
      order by price desc, random() limit 1 for update skip locked;
    -- meilleure VENTE (prix le plus bas), égalités départagées au hasard
    select * into v_sell from public.market_orders
      where item_key = p_item_key and side = 'sell' and status = 'open'
      order by price asc, random() limit 1 for update skip locked;

    exit when v_buy.id is null or v_sell.id is null or v_buy.price < v_sell.price;

    v_qty := least(v_buy.qty, v_sell.qty);
    v_price := v_sell.price; -- exécution au prix du vendeur

    -- crédite le vendeur
    select save_data into v_sell_save from public.game_saves where user_id = v_sell.user_id for update;
    if v_sell_save is not null then
      v_sell_save := jsonb_set(v_sell_save, array['S','silver'],
        to_jsonb(coalesce((v_sell_save->'S'->>'silver')::bigint, 0) + floor(v_price * v_qty)));
      update public.game_saves set save_data = v_sell_save where user_id = v_sell.user_id;
      insert into public.silver_ledger (user_id, delta, category, note)
        values (v_sell.user_id, floor(v_price * v_qty)::bigint, 'market_sell', v_sell.item_name);
    end if;

    -- livre l'objet à l'acheteur (empile si matériau, sinon insère le snapshot exact dans un slot libre)
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
          end if; -- si le sac de l'acheteur est plein, l'objet reste perdu en pratique très rare : on
                   -- accepte ce cas limite plutôt que de bloquer tout le carnet d'ordres
        end if;
      else
        -- gear/jackpot : jamais empilable, qty toujours 1 — insère le snapshot exact tel quel
        select (idx - 1) into v_slot from jsonb_array_elements(v_inv) with ordinality as arr(elem, idx)
          where elem = 'null'::jsonb limit 1;
        if v_slot is not null then
          v_inv := jsonb_set(v_inv, array[v_slot::text], v_sell.item_snapshot);
        end if;
      end if;
      v_buy_save := jsonb_set(v_buy_save, array['INV'], v_inv);
      update public.game_saves set save_data = v_buy_save where user_id = v_buy.user_id;
    end if;

    -- solde le silver bloqué de l'acheteur : il avait bloqué à SON prix, l'exécution est au prix
    -- (souvent inférieur) du vendeur → rembourse la différence
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
