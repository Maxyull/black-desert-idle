-- ============================================================
-- Fermeture d'urgence du Marché + annulation en masse (2026-07-16, demande explicite : "Annuler
-- toute ordre au marché les rendre au joueurs. bloquer l'acces au marché laisse lacces a admin").
--
-- 1) app_settings : petite table clé/valeur globale (pas de précédent dans ce projet -- tous les
--    autres toggles admin, ex. S.lootTableVersion, sont PAR JOUEUR ; celui-ci doit être GLOBAL,
--    lu par TOUS les clients avant d'ouvrir le marché).
-- 2) get_market_open() : lecture publique (anon+authenticated), true par défaut si la ligne n'existe
--    pas encore (marché ouvert par défaut, comportement inchangé tant que l'admin n'a rien togglé).
-- 3) admin_set_market_open(p_open) : réservé au staff.
-- 4) admin_cancel_all_market_orders() : réservé au staff -- rembourse CHAQUE ordre ouvert (silver
--    pour un 'buy', objet remis en sac pour un 'sell') exactement comme market_cancel_order() le
--    fait pour un ordre unique, mais en boucle sur TOUS les joueurs. Item perdu seulement si le sac
--    du joueur concerné est déjà plein au moment du remboursement (même risque préexistant que
--    market_cancel_order, pas une régression introduite ici).
-- 5) market_place_order() repatché : refuse un NOUVEL ordre si le marché est fermé, SAUF pour le
--    compte staff (qui garde l'accès, demande explicite "laisse l'acces a admin").
--
-- Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
drop policy if exists "Tout le monde peut lire les reglages" on public.app_settings;
create policy "Tout le monde peut lire les reglages" on public.app_settings for select using (true);
-- aucune policy insert/update/delete pour anon/authenticated : seules les fonctions SECURITY
-- DEFINER staff-only (ci-dessous) peuvent modifier cette table.
revoke all on public.app_settings from anon, authenticated;
grant select on public.app_settings to anon, authenticated;

create or replace function public.get_market_open()
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  select coalesce((select (value)::boolean from public.app_settings where key = 'market_open'), true);
$$;
grant execute on function public.get_market_open() to anon, authenticated;

create or replace function public.admin_set_market_open(p_open boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Réservé au staff';
  end if;
  insert into public.app_settings (key, value, updated_at) values ('market_open', to_jsonb(p_open), now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
end;
$$;
grant execute on function public.admin_set_market_open(boolean) to authenticated;

create or replace function public.admin_cancel_all_market_orders()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_order record;
  v_save jsonb;
  v_inv jsonb;
  v_found int;
  v_i int;
  v_slot int;
  v_count int := 0;
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Réservé au staff';
  end if;

  for v_order in select * from public.market_orders where status = 'open' order by id for update loop
    select save_data into v_save from public.game_saves where user_id = v_order.user_id for update;
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
      update public.game_saves set save_data = v_save where user_id = v_order.user_id;
    end if;
    update public.market_orders set status = 'cancelled', updated_at = now() where id = v_order.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
grant execute on function public.admin_cancel_all_market_orders() to authenticated;

-- repatch de market_place_order : ajoute le garde-fou "marché fermé" (staff toujours autorisé),
-- reste identique au reste près (voir supabase/schema_snapshot_functions.sql pour la version d'origine)
create or replace function public.market_place_order(p_side text, p_item_key text, p_item_name text, p_item_kind text, p_price numeric, p_qty integer, p_inv_index integer default null, p_item_snapshot jsonb default null)
returns bigint
language plpgsql
security definer
set search_path to 'public'
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
  if not public.get_market_open() and coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Marché fermé pour maintenance';
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
