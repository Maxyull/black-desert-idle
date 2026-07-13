-- Snapshot des fonctions du schema public (genere le 2026-07-14, voir issue GitHub #4 finding H2)
-- Reference en lecture seule -- NE PAS reappliquer telle quelle (pas une migration horodatee, juste une photo)

CREATE OR REPLACE FUNCTION public.get_my_referrals()
 RETURNS TABLE(display_name text, lvl integer, gearscore integer, silver bigint, joined_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(ps.display_name, '?'), coalesce(ps.lvl, 1), coalesce(ps.gearscore, 0),
         coalesce(ps.silver, 0), pr.created_at
  from public.profiles pr
  left join public.player_stats ps on ps.user_id = pr.user_id
  where pr.referred_by = auth.uid()
  order by pr.created_at desc;
$function$


CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.get_online_counts(p_window_seconds integer DEFAULT 90)
 RETURNS TABLE(total integer, guests integer, verified integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*)::int as total,
         count(*) filter (where is_guest)::int as guests,
         count(*) filter (where not is_guest)::int as verified
  from public.presence
  where last_seen > now() - (p_window_seconds || ' seconds')::interval;
$function$


CREATE OR REPLACE FUNCTION public.list_item(p_inv_index integer, p_price bigint)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_save jsonb;
  v_item jsonb;
  v_listing_id uuid;
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, true) then
    raise exception 'Compte invité non autorisé — lie un compte vérifié pour utiliser le marché';
  end if;
  if p_price <= 0 then raise exception 'Prix invalide'; end if;

  select save_data into v_save from public.game_saves where user_id = v_uid for update;
  if v_save is null then raise exception 'Sauvegarde introuvable'; end if;

  v_item := v_save->'INV'->p_inv_index;
  if v_item is null or v_item = 'null'::jsonb then raise exception 'Emplacement vide'; end if;
  if (v_item->>'equipped')::boolean is true then raise exception 'Objet équipé — déséquipez-le avant de le vendre'; end if;

  v_save := jsonb_set(v_save, array['INV', p_inv_index::text], 'null'::jsonb);
  update public.game_saves set save_data = v_save where user_id = v_uid;

  insert into public.market_listings (seller_id, item, price)
  values (v_uid, v_item, p_price)
  returning id into v_listing_id;

  return v_listing_id;
end;
$function$


CREATE OR REPLACE FUNCTION public.ensure_referral_code()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_code text;
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, true) then
    raise exception 'Compte invité non autorisé — lie un compte vérifié';
  end if;

  select referral_code into v_code from public.profiles where user_id = v_uid;
  if v_code is not null then return v_code; end if;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.profiles (user_id, referral_code) values (v_uid, v_code)
  on conflict (user_id) do nothing;
  select referral_code into v_code from public.profiles where user_id = v_uid;
  return v_code;
end;
$function$


CREATE OR REPLACE FUNCTION public.reevaluate_market(p_min_interval_minutes integer DEFAULT 15)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.market_prices
  set current_price = greatest(min_price, least(max_price,
        current_price + (random()*2-1) * (max_price-min_price) * 0.15
      )),
      last_reeval = now()
  where last_reeval < now() - (p_min_interval_minutes || ' minutes')::interval;
end;
$function$


CREATE OR REPLACE FUNCTION public.buy_listing(p_listing_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_buyer uuid := auth.uid();
  v_listing record;
  v_buyer_save jsonb;
  v_seller_save jsonb;
  v_slot int;
  v_silver bigint;
begin
  if v_buyer is null then raise exception 'Non authentifié'; end if;
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, true) then
    raise exception 'Compte invité non autorisé — lie un compte vérifié pour utiliser le marché';
  end if;

  select * into v_listing from public.market_listings where id = p_listing_id for update;
  if v_listing is null or v_listing.status <> 'active' then raise exception 'Annonce indisponible (déjà vendue ou annulée)'; end if;
  if v_listing.seller_id = v_buyer then raise exception 'Impossible d''acheter sa propre annonce'; end if;

  select save_data into v_buyer_save from public.game_saves where user_id = v_buyer for update;
  v_silver := coalesce((v_buyer_save->'S'->>'silver')::bigint, 0);
  if v_silver < v_listing.price then raise exception 'Silver insuffisant'; end if;

  select (idx - 1) into v_slot
  from jsonb_array_elements(v_buyer_save->'INV') with ordinality as arr(elem, idx)
  where elem = 'null'::jsonb
  limit 1;
  if v_slot is null then raise exception 'Inventaire plein'; end if;

  v_buyer_save := jsonb_set(v_buyer_save, array['S','silver'], to_jsonb(v_silver - v_listing.price));
  v_buyer_save := jsonb_set(v_buyer_save, array['INV', v_slot::text], v_listing.item);
  update public.game_saves set save_data = v_buyer_save where user_id = v_buyer;

  select save_data into v_seller_save from public.game_saves where user_id = v_listing.seller_id for update;
  if v_seller_save is not null then
    v_seller_save := jsonb_set(v_seller_save, array['S','silver'],
      to_jsonb(coalesce((v_seller_save->'S'->>'silver')::bigint,0) + v_listing.price));
    update public.game_saves set save_data = v_seller_save where user_id = v_listing.seller_id;
  end if;

  update public.market_listings set status='sold', buyer_id=v_buyer, sold_at=now() where id = p_listing_id;
end;
$function$


CREATE OR REPLACE FUNCTION public.get_referral_count()
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*)::int from public.profiles where referred_by = auth.uid();
$function$


CREATE OR REPLACE FUNCTION public.set_pseudo(p_pseudo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_clean text := trim(p_pseudo);
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, true) then
    raise exception 'Compte invité non autorisé — lie un compte vérifié';
  end if;
  if length(v_clean) < 2 or length(v_clean) > 20 then
    raise exception 'Le pseudo doit faire entre 2 et 20 caractères';
  end if;

  insert into public.profiles (user_id, referral_code, pseudo)
  values (v_uid, upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)), v_clean)
  on conflict (user_id) do update set pseudo = v_clean;
end;
$function$


CREATE OR REPLACE FUNCTION public.ensure_link_code()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_code text;
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, true) then
    raise exception 'Compte invité non autorisé — lie un compte vérifié';
  end if;

  -- un seul code actif à la fois par joueur : on remplace l'ancien s'il existe
  delete from public.link_codes where user_id = v_uid;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  insert into public.link_codes (code, user_id, expires_at)
  values (v_code, v_uid, now() + interval '10 minutes');

  return v_code;
end;
$function$


CREATE OR REPLACE FUNCTION public.log_playtime_ping()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then return; end if;
  insert into public.playtime_pings (user_id) values (auth.uid());
end;
$function$


CREATE OR REPLACE FUNCTION public.delete_chat_message(p_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid uuid := auth.uid(); v_m record;
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;
  if coalesce(auth.jwt()->>'email', '') is distinct from 'maxime.lacoste@icloud.com'
     and not exists (select 1 from public.chat_mods where user_id = v_uid) then
    raise exception 'Réservé au staff';
  end if;
  select * into v_m from public.chat_messages where id = p_id;
  if v_m.id is not null then
    insert into public.chat_deleted (orig_id, channel, author_id, author_pseudo, message, role, deleted_by)
      values (v_m.id, v_m.channel, v_m.user_id, v_m.pseudo, v_m.message, v_m.role, v_uid);
    delete from public.chat_messages where id = p_id;
  end if;
end;
$function$


CREATE OR REPLACE FUNCTION public.restore_chat_message(p_deleted_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid uuid := auth.uid(); v_d record;
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;
  if coalesce(auth.jwt()->>'email', '') is distinct from 'maxime.lacoste@icloud.com'
     and not exists (select 1 from public.chat_mods where user_id = v_uid) then
    raise exception 'Réservé au staff';
  end if;
  select * into v_d from public.chat_deleted where id = p_deleted_id;
  if v_d.id is null then raise exception 'Entrée introuvable'; end if;
  insert into public.chat_messages (channel, user_id, pseudo, message, role)
    values (v_d.channel, v_d.author_id, coalesce(v_d.author_pseudo,'Joueur'), v_d.message, coalesce(v_d.role,'user'));
  delete from public.chat_deleted where id = p_deleted_id;
end;
$function$


CREATE OR REPLACE FUNCTION public.admin_add_mod(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  if not exists (select 1 from auth.users where id = p_user_id) then raise exception 'UUID inconnu'; end if;
  insert into public.chat_mods (user_id) values (p_user_id) on conflict (user_id) do nothing;
end; $function$


CREATE OR REPLACE FUNCTION public.admin_remove_mod(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  delete from public.chat_mods where user_id = p_user_id;
end; $function$


CREATE OR REPLACE FUNCTION public.admin_list_mods()
 RETURNS TABLE(user_id uuid, pseudo text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  return query select m.user_id, p.pseudo from public.chat_mods m
    left join public.profiles p on p.user_id = m.user_id order by p.pseudo nulls last;
end; $function$


CREATE OR REPLACE FUNCTION public.admin_add_tester(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  if not exists (select 1 from auth.users where id = p_user_id) then raise exception 'UUID inconnu'; end if;
  insert into public.testers (user_id) values (p_user_id) on conflict (user_id) do nothing;
end; $function$


CREATE OR REPLACE FUNCTION public.admin_remove_tester(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  delete from public.testers where user_id = p_user_id;
end; $function$


CREATE OR REPLACE FUNCTION public.admin_list_testers()
 RETURNS TABLE(user_id uuid, pseudo text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  return query select t.user_id, p.pseudo from public.testers t
    left join public.profiles p on p.user_id = t.user_id order by p.pseudo nulls last;
end; $function$


CREATE OR REPLACE FUNCTION public.admin_spawn_boss(p_boss_id text, p_minutes integer DEFAULT 15, p_hp numeric DEFAULT 1000000)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Réservé au staff';
  end if;
  if p_boss_id is null or trim(p_boss_id) = '' then raise exception 'Boss invalide'; end if;
  update public.live_boss
     set boss_id = p_boss_id, spawned_at = now(),
         expires_at = now() + (greatest(1, least(p_minutes, 120)) || ' minutes')::interval,
         max_hp = greatest(1, p_hp), hp = greatest(1, p_hp)
   where id = 1;
end;
$function$


CREATE OR REPLACE FUNCTION public.boss_active_count()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_key timestamptz; v_cnt int;
begin
  select spawned_at into v_key from public.live_boss where id = 1;
  if v_key is null then return 0; end if;
  select count(*) into v_cnt from public.boss_contributions
    where boss_key = v_key and last_hit_at > now() - interval '10 seconds';
  return coalesce(v_cnt, 0);
end;
$function$


CREATE OR REPLACE FUNCTION public.boss_top()
 RETURNS TABLE(user_id uuid, pseudo text, damage numeric, pct numeric, active boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_key timestamptz; v_total numeric;
begin
  select spawned_at into v_key from public.live_boss where id = 1;
  if v_key is null then return; end if;
  select coalesce(sum(c.damage), 0) into v_total from public.boss_contributions c where c.boss_key = v_key;
  return query
    select c.user_id, c.pseudo, c.damage,
      case when v_total > 0 then round(c.damage / v_total * 100, 1) else 0 end as pct,
      (c.last_hit_at > now() - interval '10 seconds') as active
    from public.boss_contributions c
    where c.boss_key = v_key
    order by c.damage desc limit 15;
end;
$function$


CREATE OR REPLACE FUNCTION public.log_sell_mats(p_items jsonb, p_total numeric, p_pseudo text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;
  insert into public.sell_log (user_id, pseudo, kind, items, total_silver)
    values (v_uid, nullif(trim(coalesce(p_pseudo,'')),''), 'material', coalesce(p_items,'[]'::jsonb), greatest(0, coalesce(p_total,0)));
end;
$function$


CREATE OR REPLACE FUNCTION public.get_player_gear(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_equip jsonb;
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;
  select save_data->'EQUIP' into v_equip from public.game_saves where user_id = p_user_id;
  return coalesce(v_equip, '{}'::jsonb);
end;
$function$


CREATE OR REPLACE FUNCTION public.notify_cheat_discord(p_user_id uuid, p_field text, p_submitted numeric, p_clamped numeric)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_pseudo text;
begin
  select coalesce(pr.pseudo, ps.display_name) into v_pseudo
  from (select p_user_id as user_id) u
  left join public.profiles pr on pr.user_id = u.user_id
  left join public.player_stats ps on ps.user_id = u.user_id;

  perform net.http_post(
    url := 'https://mkwwvzbjtyawpcyrnybk.supabase.co/functions/v1/discord-cheat-log',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || 'sb_publishable_c7HLxbeBLe01rirZVg-XPA_TClYulIJ'
    ),
    body := jsonb_build_object(
      'title', '⚠️ Valeur anti-triche bornée',
      'description', concat(
        'Joueur : **', coalesce(v_pseudo, '?'), '** (`', p_user_id, '`)', chr(10),
        'Champ : **', p_field, '**', chr(10),
        'Envoyé : `', p_submitted, '` → Borné à : `', p_clamped, '`'
      ),
      'color', 15158332
    )
  );
exception when others then
  null;
end;
$function$


CREATE OR REPLACE FUNCTION public.post_chat_message(p_channel text, p_message text, p_pseudo text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_pseudo text;
  v_last timestamptz;
  v_msg text := trim(p_message);
  v_role text := 'user';
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, true) then
    raise exception 'Compte invité non autorisé — lie un compte vérifié pour discuter';
  end if;
  if p_channel not in ('mondial','trade','annonce','english') then
    raise exception 'Canal invalide';
  end if;
  if p_channel = 'annonce' and coalesce(auth.jwt()->>'email', '') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Seul le staff peut poster une annonce';
  end if;
  if v_msg = '' or char_length(v_msg) > 300 then
    raise exception 'Message vide ou trop long (300 caractères max)';
  end if;

  select max(created_at) into v_last from public.chat_messages where user_id = v_uid;
  if v_last is not null and v_last > now() - interval '3 seconds' then
    raise exception 'Trop rapide — attends un instant avant de reposter';
  end if;

  v_pseudo := nullif(trim(coalesce(p_pseudo, '')), '');
  if v_pseudo is null then
    select pseudo into v_pseudo from public.profiles where user_id = v_uid;
  end if;
  if v_pseudo is null or trim(v_pseudo) = '' then v_pseudo := 'Joueur'; end if;
  v_pseudo := left(v_pseudo, 24);

  if coalesce(auth.jwt()->>'email', '') = 'maxime.lacoste@icloud.com' then
    v_role := 'admin';
  elsif exists (select 1 from public.chat_mods where user_id = v_uid) then
    v_role := 'mod';
  end if;

  insert into public.chat_messages (channel, user_id, pseudo, message, role)
  values (p_channel, v_uid, v_pseudo, v_msg, v_role);
end;
$function$


CREATE OR REPLACE FUNCTION public.admin_refund_last_sell_mats(p_pseudo text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid; v_log record; v_save jsonb; v_s jsonb; v_inv jsonb;
  v_item jsonb; v_idx int; v_slot int; v_placed int := 0; v_count int;
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Réservé au staff';
  end if;
  select p.user_id into v_uid from public.profiles p where lower(p.pseudo) = lower(trim(p_pseudo)) limit 1;
  if v_uid is null then return 'user_not_found'; end if;

  select * into v_log from public.sell_log
    where user_id = v_uid and kind = 'material' and refunded = false
    order by created_at desc limit 1;
  if v_log.id is null then return 'no_entry'; end if;

  select save_data into v_save from public.game_saves where user_id = v_uid;
  if v_save is null then return 'no_save'; end if;

  v_s := v_save->'S';
  v_s := jsonb_set(v_s, '{silver}', to_jsonb(greatest(0, (coalesce(v_s->>'silver','0'))::numeric - v_log.total_silver)));
  v_s := jsonb_set(v_s, '{silverEarned}', to_jsonb(greatest(0, (coalesce(v_s->>'silverEarned','0'))::numeric - v_log.total_silver)));
  v_save := jsonb_set(v_save, '{S}', v_s);

  v_inv := coalesce(v_save->'INV', '[]'::jsonb);
  v_count := jsonb_array_length(v_log.items);
  for v_idx in 0 .. v_count-1 loop
    v_item := v_log.items->v_idx;
    v_slot := null;
    for v_idx2 in 0 .. jsonb_array_length(v_inv)-1 loop
      if v_inv->v_idx2 = 'null'::jsonb then v_slot := v_idx2; exit; end if;
    end loop;
    if v_slot is not null then
      v_inv := jsonb_set(v_inv, array[v_slot::text], v_item);
      v_placed := v_placed + 1;
    end if;
  end loop;
  v_save := jsonb_set(v_save, '{INV}', v_inv);

  update public.game_saves set save_data = v_save where user_id = v_uid;
  update public.sell_log set refunded = true, refunded_at = now() where id = v_log.id;
  return 'refunded:' || v_placed || '/' || v_count;
end;
$function$


CREATE OR REPLACE FUNCTION public.admin_get_player_inventory(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_inv jsonb;
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Réservé au staff';
  end if;
  select save_data->'INV' into v_inv from public.game_saves where user_id = p_user_id;
  return coalesce(v_inv, '[]'::jsonb);
end;
$function$


CREATE OR REPLACE FUNCTION public.market_cancel_order(p_order_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$


CREATE OR REPLACE FUNCTION public.market_my_orders()
 RETURNS SETOF market_orders
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select * from public.market_orders
  where user_id = auth.uid() and (status = 'open' or updated_at > now() - interval '24 hours')
  order by created_at desc;
$function$


CREATE OR REPLACE FUNCTION public.market_order_book(p_item_key text)
 RETURNS TABLE(side text, price numeric, qty bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select side, price, sum(qty) as qty
  from public.market_orders
  where item_key = p_item_key and status = 'open'
  group by side, price
  order by side, (case when side = 'buy' then -price else price end);
$function$


CREATE OR REPLACE FUNCTION public.market_listings(p_kind text DEFAULT NULL::text)
 RETURNS TABLE(id bigint, pseudo text, item_key text, item_name text, item_kind text, item_snapshot jsonb, price numeric, qty integer, created_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select o.id, o.pseudo, o.item_key, o.item_name, o.item_kind, o.item_snapshot, o.price, o.qty, o.created_at
  from public.market_orders o
  where o.side = 'sell' and o.status = 'open' and (p_kind is null or o.item_kind = p_kind)
  order by o.price asc, o.created_at asc
  limit 200;
$function$


CREATE OR REPLACE FUNCTION public.apply_referral_code(p_code text, p_bonus bigint DEFAULT 5000)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_referrer uuid;
  v_row public.profiles;
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, true) then
    raise exception 'Compte invité non autorisé — lie un compte vérifié';
  end if;

  select * into v_row from public.profiles where user_id = v_uid;
  if v_row is null then raise exception 'Profil introuvable — réouvre le panneau Mon compte'; end if;
  if v_row.referred_by is not null then raise exception 'Tu as déjà utilisé un code de parrainage'; end if;

  select user_id into v_referrer from public.profiles where referral_code = upper(trim(p_code));
  if v_referrer is null then raise exception 'Code de parrainage invalide'; end if;
  if v_referrer = v_uid then raise exception 'Tu ne peux pas utiliser ton propre code'; end if;

  update public.profiles set referred_by = v_referrer where user_id = v_uid and referred_by is null;
  if not found then raise exception 'Tu as déjà utilisé un code de parrainage'; end if;

  update public.game_saves set save_data = jsonb_set(save_data, array['S','silver'],
    to_jsonb(coalesce((save_data->'S'->>'silver')::bigint, 0) + p_bonus))
  where user_id in (v_uid, v_referrer);
end;
$function$


CREATE OR REPLACE FUNCTION public.market_buy_material(p_item_key text, p_qty integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$


CREATE OR REPLACE FUNCTION public.market_sell_material(p_inv_index integer, p_qty integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_save jsonb;
  v_item jsonb;
  v_price_key text;
  v_price numeric;
  v_payout bigint;
  v_payout_factor numeric;
  v_has_seal boolean;
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

  v_has_seal := coalesce((v_save->'S'->>'hasConclaveMarchandsSeal')::boolean, false);
  v_payout_factor := case when v_has_seal then 0.7884 else 0.65 end;
  v_payout := floor(v_price * p_qty * v_payout_factor);

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
$function$


CREATE OR REPLACE FUNCTION public.cancel_listing(p_listing_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_listing record;
  v_save jsonb;
  v_slot int;
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, true) then
    raise exception 'Compte invité non autorisé — lie un compte vérifié pour utiliser le marché';
  end if;

  select * into v_listing from public.market_listings where id = p_listing_id for update;
  if v_listing is null or v_listing.status <> 'active' then raise exception 'Annonce indisponible'; end if;
  if v_listing.seller_id <> v_uid then raise exception 'Ce n''est pas votre annonce'; end if;

  select save_data into v_save from public.game_saves where user_id = v_uid for update;
  select (idx - 1) into v_slot
  from jsonb_array_elements(v_save->'INV') with ordinality as arr(elem, idx)
  where elem = 'null'::jsonb
  limit 1;
  if v_slot is null then raise exception 'Inventaire plein, impossible de récupérer l''objet pour l''instant'; end if;

  v_save := jsonb_set(v_save, array['INV', v_slot::text], v_listing.item);
  update public.game_saves set save_data = v_save where user_id = v_uid;

  update public.market_listings set status='cancelled' where id = p_listing_id;
end;
$function$


CREATE OR REPLACE FUNCTION public.apply_referral_code(p_code text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_referrer uuid;
  v_row public.profiles;
  v_referrer_row public.profiles;
  v_created_at timestamptz;
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, true) then
    raise exception 'Compte invité non autorisé — lie un compte vérifié';
  end if;

  select * into v_row from public.profiles where user_id = v_uid;
  if v_row is null then raise exception 'Profil introuvable — réouvre le panneau Mon compte'; end if;
  if v_row.referred_by is not null then raise exception 'Tu as déjà utilisé un code de parrainage — un seul est autorisé par compte'; end if;

  select created_at into v_created_at from auth.users where id = v_uid;
  if v_created_at is null or v_created_at < now() - interval '3 days' then
    raise exception 'Le parrainage n''est possible que dans les 3 jours suivant la création de ton compte';
  end if;

  select user_id into v_referrer from public.profiles where referral_code = upper(trim(p_code));
  if v_referrer is null then raise exception 'Code de parrainage invalide'; end if;
  if v_referrer = v_uid then raise exception 'Tu ne peux pas utiliser ton propre code'; end if;

  select * into v_referrer_row from public.profiles where user_id = v_referrer;
  if v_referrer_row.referred_by = v_uid then
    raise exception 'Impossible : ce joueur est déjà ton filleul, tu ne peux pas parrainer ton propre parrain';
  end if;

  update public.profiles set referred_by = v_referrer where user_id = v_uid and referred_by is null;
  if not found then raise exception 'Tu as déjà utilisé un code de parrainage — un seul est autorisé par compte'; end if;
end;
$function$


CREATE OR REPLACE FUNCTION public.boss_contribute(p_damage numeric, p_pseudo text DEFAULT NULL::text)
 RETURNS TABLE(hp numeric, max_hp numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_lb record;
  v_key timestamptz;
  v_pseudo text;
  v_new_hp numeric;
  v_new_max_hp numeric;
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;
  select * into v_lb from public.live_boss where id = 1;
  if v_lb.boss_id is null or v_lb.expires_at <= now() or coalesce(v_lb.hp,0) <= 0 then
    return query select coalesce(v_lb.hp,0), coalesce(v_lb.max_hp,0); return;
  end if;
  v_key := v_lb.spawned_at;
  v_pseudo := nullif(trim(coalesce(p_pseudo,'')), '');
  if v_pseudo is null then select pseudo into v_pseudo from public.profiles where user_id = v_uid; end if;
  if v_pseudo is null then v_pseudo := 'Joueur'; end if;
  p_damage := greatest(0, least(p_damage, v_lb.max_hp * 0.05));
  update public.live_boss lb set hp = greatest(0, lb.hp - p_damage) where lb.id = 1
    returning lb.hp, lb.max_hp into v_new_hp, v_new_max_hp;
  insert into public.boss_contributions (boss_key, user_id, pseudo, damage, last_hit_at)
    values (v_key, v_uid, v_pseudo, p_damage, now())
    on conflict (boss_key, user_id) do update set damage = public.boss_contributions.damage + excluded.damage,
      pseudo = excluded.pseudo, last_hit_at = now();
  hp := v_new_hp; max_hp := v_new_max_hp;
  return next;
end;
$function$


CREATE OR REPLACE FUNCTION public.admin_despawn_boss()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Réservé au staff';
  end if;
  update public.live_boss set boss_id = null, spawned_at = null, expires_at = null, hp = 0, max_hp = 0 where id = 1;
end;
$function$


CREATE OR REPLACE FUNCTION public.admin_broadcast_notice(p_notice_key text, p_icon text, p_title_fr text, p_title_en text, p_body_fr text, p_body_en text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_count int;
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Réservé au staff';
  end if;
  insert into public.player_notices (user_id, notice_key, icon, title_fr, title_en, body_fr, body_en)
  select id, p_notice_key, p_icon, p_title_fr, p_title_en, p_body_fr, p_body_en from auth.users
  on conflict (user_id, notice_key) do update set
    icon = excluded.icon, title_fr = excluded.title_fr, title_en = excluded.title_en,
    body_fr = excluded.body_fr, body_en = excluded.body_en, created_at = now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$


CREATE OR REPLACE FUNCTION public.claim_pending_notice()
 RETURNS TABLE(notice_key text, icon text, title_fr text, title_en text, body_fr text, body_en text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  return query delete from public.player_notices pn where pn.user_id = v_uid
    returning pn.notice_key, pn.icon, pn.title_fr, pn.title_en, pn.body_fr, pn.body_en;
end;
$function$


CREATE OR REPLACE FUNCTION public.admin_reset_all_accounts(p_title_fr text, p_title_en text, p_body_fr text, p_body_en text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_count int;
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Réservé au staff';
  end if;
  update public.game_saves set save_data = '{}'::jsonb where true;
  get diagnostics v_count = row_count;
  delete from public.player_stats where true;
  perform public.admin_broadcast_notice('account_reset', '🔄', p_title_fr, p_title_en, p_body_fr, p_body_en);
  return v_count;
end;
$function$


CREATE OR REPLACE FUNCTION public.market_match_item(p_item_key text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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


CREATE OR REPLACE FUNCTION public.admin_reset_all_quests()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(auth.jwt()->>'email', '') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Réservé au staff';
  end if;

  update public.game_saves
  set save_data = jsonb_set(
    jsonb_set(save_data, '{S,dq}', 'null'::jsonb, true),
    '{S,wq}', 'null'::jsonb, true
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.clamp_player_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_created timestamptz;
  v_max_playtime bigint;
  v_before numeric;
begin
  v_before := coalesce(new.silver,0);
  new.silver := least(greatest(coalesce(new.silver,0), 0), 1000000000000);
  if v_before is distinct from new.silver then perform public.notify_cheat_discord(new.user_id, 'silver', v_before, new.silver); end if;

  v_before := coalesce(new.silver_per_hour,0);
  new.silver_per_hour := least(greatest(coalesce(new.silver_per_hour,0), 0), 5000000000);
  if v_before is distinct from new.silver_per_hour then perform public.notify_cheat_discord(new.user_id, 'silver_per_hour', v_before, new.silver_per_hour); end if;

  v_before := coalesce(new.gearscore,0);
  new.gearscore := least(greatest(coalesce(new.gearscore,0), 0), 2000);
  if v_before is distinct from new.gearscore then perform public.notify_cheat_discord(new.user_id, 'gearscore', v_before, new.gearscore); end if;

  -- AP/DP individuels (ajoutés le 2026-07-08) : le Gearscore = (AP+DP)/2 plafonne déjà à 2000,
  -- donc chacun ne peut pas dépasser ~4000 dans un cas extrême — borne large mais cohérente
  v_before := coalesce(new.ap,0);
  new.ap := least(greatest(coalesce(new.ap,0), 0), 4000);
  if v_before is distinct from new.ap then perform public.notify_cheat_discord(new.user_id, 'ap', v_before, new.ap); end if;

  v_before := coalesce(new.dp,0);
  new.dp := least(greatest(coalesce(new.dp,0), 0), 4000);
  if v_before is distinct from new.dp then perform public.notify_cheat_discord(new.user_id, 'dp', v_before, new.dp); end if;

  v_before := coalesce(new.lvl,1);
  new.lvl := least(greatest(coalesce(new.lvl,1), 1), 100);
  if v_before is distinct from new.lvl then perform public.notify_cheat_discord(new.user_id, 'lvl', v_before, new.lvl); end if;

  v_before := coalesce(new.best_zone_index,0);
  new.best_zone_index := least(greatest(coalesce(new.best_zone_index,0), 0), 50);
  if v_before is distinct from new.best_zone_index then perform public.notify_cheat_discord(new.user_id, 'best_zone_index', v_before, new.best_zone_index); end if;

  v_before := coalesce(new.best_item_count,0);
  new.best_item_count := least(greatest(coalesce(new.best_item_count,0), 0), 100000000);
  if v_before is distinct from new.best_item_count then perform public.notify_cheat_discord(new.user_id, 'best_item_count', v_before, new.best_item_count); end if;

  v_before := coalesce(new.treasure_count,0);
  new.treasure_count := least(greatest(coalesce(new.treasure_count,0), 0), 1000000);
  if v_before is distinct from new.treasure_count then perform public.notify_cheat_discord(new.user_id, 'treasure_count', v_before, new.treasure_count); end if;

  v_before := coalesce(new.best_kpm,0);
  new.best_kpm := least(greatest(coalesce(new.best_kpm,0), 0), 500);
  if v_before is distinct from new.best_kpm then perform public.notify_cheat_discord(new.user_id, 'best_kpm', v_before, new.best_kpm); end if;

  begin
    select created_at into v_created from auth.users where id = new.user_id;
  exception when others then v_created := null;
  end;
  v_before := coalesce(new.playtime_sec,0);
  if v_created is not null then
    v_max_playtime := ceil(extract(epoch from (now() - v_created))) + 86400;
    new.playtime_sec := least(greatest(coalesce(new.playtime_sec,0), 0), v_max_playtime);
  else
    new.playtime_sec := least(greatest(coalesce(new.playtime_sec,0), 0), 40000000);
  end if;
  if v_before is distinct from new.playtime_sec then perform public.notify_cheat_discord(new.user_id, 'playtime_sec', v_before, new.playtime_sec); end if;

  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.ensure_scheduled_boss()
 RETURNS TABLE(boss_id text, spawned_at timestamp with time zone, expires_at timestamp with time zone, hp numeric, max_hp numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_now timestamptz := now();
  v_paris_date date := (v_now at time zone 'Europe/Paris')::date;
  v_dow int := extract(dow from (v_now at time zone 'Europe/Paris'))::int; -- 0=dimanche..6=samedi
  v_entry record;
  v_spawn timestamptz;
  v_expires timestamptz;
  v_lb record;
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;
  for v_entry in
    select * from (values
      (-1, 12, 45, 'kzarka', 400000::numeric),
      (-1, 19, 45, 'kzarka', 400000::numeric),
      (-1, 23, 45, 'kzarka', 400000::numeric),
      (0,  15, 45, 'kzarka', 400000::numeric),
      (6,  15, 45, 'kzarka', 400000::numeric),
      (4,  12, 0,  'vell',   550000::numeric),
      (0,  16, 45, 'vell',   550000::numeric)
    ) as t(day, h, m, id, hp)
  loop
    if v_entry.day <> -1 and v_entry.day <> v_dow then continue; end if;
    v_spawn := (v_paris_date::text || ' ' || lpad(v_entry.h::text,2,'0') || ':' || lpad(v_entry.m::text,2,'0') || ':00')::timestamp at time zone 'Europe/Paris';
    v_expires := v_spawn + interval '9 minutes'; -- ramené de 15 à 9 min le 2026-07-06
    if v_now >= v_spawn and v_now < v_expires then
      select * into v_lb from public.live_boss where id = 1;
      -- ne réclame le créneau planifié que si RIEN de valide n'est déjà actif (spawn admin ou
      -- planifié) — évite d'écraser un spawn admin en cours d'un autre boss
      if v_lb.boss_id is null or v_lb.expires_at <= now() then
        update public.live_boss set boss_id = v_entry.id, spawned_at = v_spawn, expires_at = v_expires,
          max_hp = v_entry.hp, hp = v_entry.hp where id = 1;
      end if;
      exit;
    end if;
  end loop;
  return query select l.boss_id, l.spawned_at, l.expires_at, l.hp, l.max_hp from public.live_boss l where l.id = 1;
end;
$function$


CREATE OR REPLACE FUNCTION public.admin_list_players()
 RETURNS TABLE(user_id uuid, display_name text, silver bigint, gearscore integer, lvl integer, online boolean, last_seen timestamp with time zone, best_kpm numeric, ap numeric, dp numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(auth.jwt()->>'email', '') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Réservé au staff';
  end if;
  return query
    with verified as (
      select ps.user_id, coalesce(ps.display_name,'?') as display_name, coalesce(ps.silver,0)::bigint as silver,
        coalesce(ps.gearscore,0)::int as gearscore, coalesce(ps.lvl,1)::int as lvl,
        pr.last_seen, coalesce(ps.best_kpm,0) as best_kpm, coalesce(ps.ap,0) as ap, coalesce(ps.dp,0) as dp
      from public.player_stats ps
      left join public.presence pr on pr.user_id = ps.user_id
    ),
    guests as (
      select gs.user_id,
        '🎭 ' || coalesce(prof.pseudo, 'Invité-' || left(gs.user_id::text, 6)) as display_name,
        coalesce((gs.save_data->'S'->>'silver')::numeric, 0)::bigint as silver,
        0 as gearscore,
        coalesce((gs.save_data->'S'->>'lvl')::int, 1) as lvl,
        pr.last_seen, 0::numeric as best_kpm, 0::numeric as ap, 0::numeric as dp
      from public.game_saves gs
      left join public.presence pr on pr.user_id = gs.user_id
      left join public.profiles prof on prof.user_id = gs.user_id
      where not exists (select 1 from public.player_stats ps where ps.user_id = gs.user_id)
    )
    select v.user_id, v.display_name, v.silver, v.gearscore, v.lvl,
      (v.last_seen is not null and v.last_seen > now() - interval '90 seconds') as online,
      v.last_seen, v.best_kpm, v.ap, v.dp
    from verified v
    union all
    select g.user_id, g.display_name, g.silver, g.gearscore, g.lvl,
      (g.last_seen is not null and g.last_seen > now() - interval '90 seconds') as online,
      g.last_seen, g.best_kpm, g.ap, g.dp
    from guests g
    order by online desc, last_seen desc nulls last;
end;
$function$


CREATE OR REPLACE FUNCTION public.get_registered_count()
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*)::integer from auth.users where coalesce(is_anonymous, false) = false;
$function$


CREATE OR REPLACE FUNCTION public.get_online_players(p_window_seconds integer DEFAULT 90)
 RETURNS TABLE(pseudo text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select distinct coalesce(pr.pseudo, ps.display_name) as pseudo
  from public.presence p
  left join public.profiles pr on pr.user_id = p.user_id
  left join public.player_stats ps on ps.user_id = p.user_id
  where p.last_seen > now() - (least(coalesce(p_window_seconds, 90), 300) || ' seconds')::interval
    and not p.is_guest
    and coalesce(pr.pseudo, ps.display_name) is not null;
$function$


CREATE OR REPLACE FUNCTION public.boss_claim()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_key timestamptz;
  v_hp numeric;
  v_boss_id text;
  v_rank int;
  v_pseudo text;
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;
  select spawned_at, hp, boss_id into v_key, v_hp, v_boss_id from public.live_boss where id = 1;
  if v_key is null or coalesce(v_hp,1) > 0 then return -1; end if;
  if not exists (select 1 from public.boss_contributions where boss_key = v_key and user_id = v_uid) then return -1; end if;
  if exists (select 1 from public.boss_claims where boss_key = v_key and user_id = v_uid) then
    begin
      select coalesce(pr.pseudo, ps.display_name) into v_pseudo
      from (select v_uid as user_id) u
      left join public.profiles pr on pr.user_id = u.user_id
      left join public.player_stats ps on ps.user_id = u.user_id;
      perform net.http_post(
        url := 'https://mkwwvzbjtyawpcyrnybk.supabase.co/functions/v1/discord-cheat-log',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || 'sb_publishable_c7HLxbeBLe01rirZVg-XPA_TClYulIJ'
        ),
        body := jsonb_build_object(
          'title', '🚫 Tentative de double réclamation',
          'description', concat(
            'Joueur : **', coalesce(v_pseudo, '?'), '** (`', v_uid, '`)', chr(10),
            'Boss : **', coalesce(v_boss_id, '?'), '** (déjà payée) — bloqué'
          ),
          'color', 15548997
        )
      );
    exception when others then null;
    end;
    return -1;
  end if;
  select rnk into v_rank from (
    select user_id, rank() over (order by damage desc) as rnk
    from public.boss_contributions where boss_key = v_key
  ) t where t.user_id = v_uid;
  insert into public.boss_claims (boss_key, user_id) values (v_key, v_uid) on conflict do nothing;
  return coalesce(v_rank, 999);
end;
$function$


CREATE OR REPLACE FUNCTION public.admin_reset_account_by_uuid(p_user_id uuid, p_title_fr text, p_title_en text, p_body_fr text, p_body_en text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Réservé au staff';
  end if;
  if not exists (select 1 from public.game_saves where user_id = p_user_id) then
    return false;
  end if;
  update public.game_saves set save_data = '{}'::jsonb where user_id = p_user_id;
  delete from public.player_stats where user_id = p_user_id;
  insert into public.player_notices (user_id, notice_key, icon, title_fr, title_en, body_fr, body_en)
  values (p_user_id, 'account_reset', '🔄', p_title_fr, p_title_en, p_body_fr, p_body_en)
  on conflict (user_id, notice_key) do update set
    icon = excluded.icon, title_fr = excluded.title_fr, title_en = excluded.title_en,
    body_fr = excluded.body_fr, body_en = excluded.body_en, created_at = now();
  return true;
end;
$function$


CREATE OR REPLACE FUNCTION public.heartbeat_presence(p_is_guest boolean, p_zone_idx integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;
  insert into public.presence (user_id, is_guest, last_seen, zone_idx)
  values (auth.uid(), p_is_guest, now(), p_zone_idx)
  on conflict (user_id) do update set is_guest = excluded.is_guest, last_seen = now(), zone_idx = excluded.zone_idx;
end;
$function$


CREATE OR REPLACE FUNCTION public.admin_get_player_save(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_save jsonb;
  v_pseudo text;
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Réservé au staff';
  end if;
  select save_data into v_save from public.game_saves where user_id = p_user_id;
  if v_save is null then return null; end if;
  select coalesce(pr.pseudo, ps.display_name) into v_pseudo
  from (select p_user_id as user_id) u
  left join public.profiles pr on pr.user_id = u.user_id
  left join public.player_stats ps on ps.user_id = u.user_id;
  return v_save || jsonb_build_object('_pseudo', coalesce(v_pseudo, '?'));
end;
$function$


CREATE OR REPLACE FUNCTION public.market_place_order(p_side text, p_item_key text, p_item_name text, p_item_kind text, p_price numeric, p_qty integer, p_inv_index integer DEFAULT NULL::integer, p_item_snapshot jsonb DEFAULT NULL::jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$


CREATE OR REPLACE FUNCTION public.clamp_game_save()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    if v_changed then
      new.save_data := jsonb_set(new.save_data, '{S}', v_s);
    end if;
  end if;

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
$function$


CREATE OR REPLACE FUNCTION public.get_zone_player_counts(p_window_seconds integer DEFAULT 90)
 RETURNS TABLE(zone_idx integer, cnt integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.zone_idx, count(*)::int as cnt
  from public.presence p
  where p.last_seen > now() - (least(coalesce(p_window_seconds, 90), 300) || ' seconds')::interval
    and p.zone_idx is not null
  group by p.zone_idx;
$function$

