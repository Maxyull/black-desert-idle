-- ============================================================
-- Blocage des comptes invités (session anonyme Supabase) sur les fonctions
-- sensibles à la triche multi-comptes : marché, marché commun.
--
-- Prérequis côté Dashboard (à faire une seule fois, à la main) :
--   Authentication > Sign In / Up > active "Allow anonymous sign-ins"
--
-- Ce fichier REDÉFINIT (create or replace) les 3 fonctions déjà en prod de
-- supabase-market-schema.sql pour y ajouter la garde anti-invité. Sans danger à
-- rejouer : signature et logique métier identiques, seule la garde est ajoutée.
-- À coller APRÈS supabase-market-schema.sql (et avant/après supabase-common-market-schema.sql,
-- l'ordre n'a pas d'importance).
-- ============================================================

create or replace function public.list_item(p_inv_index int, p_price bigint)
returns uuid
language plpgsql security definer
as $$
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
$$;

create or replace function public.buy_listing(p_listing_id uuid)
returns void
language plpgsql security definer
as $$
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
$$;

create or replace function public.cancel_listing(p_listing_id uuid)
returns void
language plpgsql security definer
as $$
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
$$;
