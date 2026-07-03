-- ============================================================
-- Marché commun — Velia Idle
-- Vente/achat de MATÉRIAUX (uniquement, pas le gear/bijoux — ceux-là restent sur
-- l'Hôtel des ventes existant car chaque pièce a des stats aléatoires propres) à un
-- prix commun, flottant, borné par un min/max — comme le vrai marché commun de BDO.
-- Les composants de craft endgame (kind:'craft') ne sont PAS inclus : ils sont
-- volontairement invendables (voir tooltip "à conserver").
--
-- À coller APRÈS supabase-market-schema.sql (nécessite la table game_saves).
-- Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists public.market_prices (
  item_key text primary key,       -- ex: 'material:Ancient Spirit Dust'
  display_name text not null,
  base_price numeric not null,
  min_price numeric not null,
  max_price numeric not null,
  current_price numeric not null,
  last_reeval timestamptz not null default now()
);

insert into public.market_prices (item_key, display_name, base_price, min_price, max_price, current_price) values
  ('material:Black Stone (Arme)',        'Black Stone (Arme)',        5,   3,   9,   5),
  ('material:Black Stone (Armure)',      'Black Stone (Armure)',      8,   5,   13,  8),
  ('material:Sharp Black Crystal Shard', 'Sharp Black Crystal Shard', 8,   5,   13,  8),
  ('material:Hard Black Crystal Shard',  'Hard Black Crystal Shard',  35,  20,  55,  35),
  ('material:Ancient Spirit Dust',       'Ancient Spirit Dust',       35,  20,  55,  35),
  ('material:Caphras Stone',             'Caphras Stone',             120, 70,  190, 120)
on conflict (item_key) do nothing;

alter table public.market_prices enable row level security;

-- tout le monde peut consulter les prix courants (pas besoin d'être connecté)
drop policy if exists "market_prices_select_all" on public.market_prices;
create policy "market_prices_select_all" on public.market_prices for select using (true);
-- aucune policy insert/update pour les joueurs : seules les fonctions SECURITY DEFINER
-- ci-dessous peuvent modifier les prix ou déclencher une transaction.

-- ============================================================
-- Réévalue les prix : marche aléatoire bornée [min,max], simulant l'offre/demande
-- (inflation/déflation). No-op si le dernier passage date de moins de p_min_interval_minutes
-- — n'importe quel client peut l'appeler sans risque de spam (ex: à l'ouverture du marché),
-- et l'admin peut forcer une réévaluation immédiate en passant 0.
-- ============================================================
create or replace function public.reevaluate_market(p_min_interval_minutes int default 15)
returns void
language plpgsql security definer
as $$
begin
  update public.market_prices
  set current_price = greatest(min_price, least(max_price,
        current_price + (random()*2-1) * (max_price-min_price) * 0.15
      )),
      last_reeval = now()
  where last_reeval < now() - (p_min_interval_minutes || ' minutes')::interval;
end;
$$;

-- ============================================================
-- Achat : débite l'acheteur au prix courant, empile le matériau dans son sac.
-- ============================================================
create or replace function public.market_buy_material(p_item_key text, p_qty int)
returns void
language plpgsql security definer
as $$
declare
  v_uid uuid := auth.uid();
  v_price numeric;
  v_display text;
  v_inv_key text;
  v_save jsonb;
  v_silver bigint;
  v_cost bigint;
  v_inv jsonb;
  v_i int;
  v_found int := -1;
  v_slot int;
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, true) then
    raise exception 'Compte invité non autorisé — lie un compte vérifié pour utiliser le marché';
  end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Quantité invalide'; end if;

  select current_price, display_name into v_price, v_display
  from public.market_prices where item_key = p_item_key for update;
  if v_price is null then raise exception 'Objet introuvable sur le marché commun'; end if;
  v_inv_key := 'mat_' || v_display;
  v_cost := ceil(v_price * p_qty);

  select save_data into v_save from public.game_saves where user_id = v_uid for update;
  if v_save is null then raise exception 'Sauvegarde introuvable'; end if;
  v_silver := coalesce((v_save->'S'->>'silver')::bigint, 0);
  if v_silver < v_cost then raise exception 'Silver insuffisant'; end if;

  v_inv := v_save->'INV';
  for v_i in 0 .. jsonb_array_length(v_inv) - 1 loop
    if (v_inv->v_i) is not null and (v_inv->v_i)->>'key' = v_inv_key then
      v_found := v_i; exit;
    end if;
  end loop;

  if v_found >= 0 then
    v_inv := jsonb_set(v_inv, array[v_found::text, 'qty'],
      to_jsonb(coalesce((v_inv->v_found->>'qty')::int, 0) + p_qty));
  else
    select (idx - 1) into v_slot
    from jsonb_array_elements(v_inv) with ordinality as arr(elem, idx)
    where elem = 'null'::jsonb
    limit 1;
    if v_slot is null then raise exception 'Inventaire plein'; end if;
    v_inv := jsonb_set(v_inv, array[v_slot::text], jsonb_build_object(
      'key', v_inv_key, 'name', v_display, 'kind', 'material', 'icon', '◈', 'color', '#8fb0c9',
      'qty', p_qty, 'stackable', true, 'weight', 0.1, 'val', v_price, 'ap', 0, 'dp', 0, 'enhLv', 0
    ));
  end if;

  v_save := jsonb_set(v_save, array['INV'], v_inv);
  v_save := jsonb_set(v_save, array['S','silver'], to_jsonb(v_silver - v_cost));
  update public.game_saves set save_data = v_save where user_id = v_uid;
end;
$$;

-- ============================================================
-- Vente : retire qty du slot d'inventaire indiqué (doit être un matériau coté), crédite le silver.
-- ============================================================
create or replace function public.market_sell_material(p_inv_index int, p_qty int)
returns void
language plpgsql security definer
as $$
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

  v_payout := floor(v_price * p_qty);

  if v_have = p_qty then
    v_save := jsonb_set(v_save, array['INV', p_inv_index::text], 'null'::jsonb);
  else
    v_save := jsonb_set(v_save, array['INV', p_inv_index::text, 'qty'], to_jsonb(v_have - p_qty));
  end if;

  v_save := jsonb_set(v_save, array['S','silver'],
    to_jsonb(coalesce((v_save->'S'->>'silver')::bigint, 0) + v_payout));
  update public.game_saves set save_data = v_save where user_id = v_uid;
end;
$$;

grant execute on function public.reevaluate_market(int) to authenticated;
grant execute on function public.market_buy_material(text, int) to authenticated;
grant execute on function public.market_sell_material(int, int) to authenticated;
