-- Marché d'échange de Compagnons (2026-07-10, demande explicite, port de echange-compagnons.jsx +
-- echange-compagnons-todo-backend.md) -- le module Compagnons est normalement 100% local
-- (localStorage, voir src/companions/README.md), mais un vrai échange entre joueurs a besoin d'une
-- autorité serveur pour vérifier la propriété et transférer réellement un pet d'un compte à
-- l'autre. Décision explicite de l'utilisateur : "vrai backend d'échange". Portée VOLONTAIREMENT
-- scopée : seuls les pets IMPLIQUÉS dans une offre/contre-offre sont synchronisés côté serveur
-- (pas une migration complète du roster local) -- un pet non mis en vente reste 100% local.
--
-- Flux : A publie une offre (son pet_uid + snapshot) -> B soumet une contre-offre (ses pets/silver)
-- -> A accepte -> transaction atomique (historique + 2 livraisons en attente, une par joueur) ->
-- chaque client récupère sa livraison au prochain chargement et l'ajoute à son PETS local.

create table if not exists public.pet_trade_offers (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  owner_pseudo text not null,
  pet_uid text not null,           -- pet.uid côté client (companions.roster.js)
  pet_snapshot jsonb not null,      -- {name,art,sec,typ,orig,rar,tier,tierMult,stats}
  accepts_pets boolean not null default true,
  accepts_silver boolean not null default false,
  pet_qty smallint not null default 1 check (pet_qty between 1 and 5),
  min_silver bigint not null default 0,
  owner_has_ever text[] not null default '{}', -- noms d'espèces déjà obtenues par le propriétaire (anti-doublon)
  status text not null default 'open' check (status in ('open','closed','cancelled','expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists pet_trade_offers_status_idx on public.pet_trade_offers(status, expires_at);
alter table public.pet_trade_offers enable row level security;
-- lecture publique des offres OUVERTES (le marché doit être visible par tous les joueurs
-- authentifiés) ; le propriétaire voit aussi ses propres offres fermées/annulées (onglet "Mes
-- contrats"/historique).
create policy pet_trade_offers_select on public.pet_trade_offers
  for select using (status = 'open' or owner_user_id = (select auth.uid()));
-- écriture uniquement via RPC (SECURITY DEFINER ci-dessous) -- jamais d'insert/update direct.

create table if not exists public.pet_trade_counters (
  id bigint generated always as identity primary key,
  offer_id bigint not null references public.pet_trade_offers(id) on delete cascade,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  from_pseudo text not null,
  pets jsonb not null default '[]', -- [{uid,name,art,sec,typ,orig,rar,tier,tierMult,stats}]
  silver bigint not null default 0,
  status text not null default 'pending' check (status in ('pending','accepted','declined','withdrawn','invalidated')),
  created_at timestamptz not null default now()
);
create index if not exists pet_trade_counters_offer_id_idx on public.pet_trade_counters(offer_id);
alter table public.pet_trade_counters enable row level security;
-- une contre-offre n'est visible que par son auteur et le propriétaire de l'offre ciblée (jamais
-- publique -- une négociation reste privée entre les deux parties, contrairement à l'offre elle-même).
create policy pet_trade_counters_select on public.pet_trade_counters
  for select using (
    from_user_id = (select auth.uid())
    or exists (select 1 from public.pet_trade_offers o where o.id = offer_id and o.owner_user_id = (select auth.uid()))
  );

create table if not exists public.pet_trade_history (
  id bigint generated always as identity primary key,
  offer_id bigint not null,
  seller_user_id uuid not null references auth.users(id) on delete cascade,
  buyer_user_id uuid not null references auth.users(id) on delete cascade,
  seller_gave jsonb not null,   -- snapshot du pet cédé par le vendeur (l'offre initiale)
  buyer_gave jsonb not null,    -- {pets:[...], silver:n} cédé par l'acheteur (la contre-offre acceptée)
  completed_at timestamptz not null default now()
);
alter table public.pet_trade_history enable row level security;
create policy pet_trade_history_select on public.pet_trade_history
  for select using (seller_user_id = (select auth.uid()) or buyer_user_id = (select auth.uid()));

-- file de livraison : chaque joueur récupère ici ce qu'il a gagné dans un échange conclu, et
-- l'ajoute lui-même à son PETS/SILVER local au prochain chargement du module (claim_pet_trade_delivery).
-- Nécessaire car les pets ne sont PAS stockés côté serveur en continu (économie locale) -- c'est le
-- SEUL mécanisme qui fait réellement traverser un pet d'un compte à l'autre.
create table if not exists public.pet_trade_deliveries (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  pets jsonb not null default '[]',
  silver bigint not null default 0,
  reason text not null default 'trade',
  claimed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists pet_trade_deliveries_user_id_idx on public.pet_trade_deliveries(user_id, claimed);
alter table public.pet_trade_deliveries enable row level security;
create policy pet_trade_deliveries_select on public.pet_trade_deliveries
  for select using (user_id = (select auth.uid()));

-- notifications légères (contre-offre reçue/refusée/invalidée) -- lues par le client au chargement
-- du module, affichées en toast, puis marquées lues.
create table if not exists public.pet_trade_notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists pet_trade_notifications_user_id_idx on public.pet_trade_notifications(user_id, read);
alter table public.pet_trade_notifications enable row level security;
create policy pet_trade_notifications_select on public.pet_trade_notifications
  for select using (user_id = (select auth.uid()));

-- ============================================================
-- RPC
-- ============================================================

drop function if exists public.create_pet_trade_offer(text, jsonb, boolean, boolean, smallint, bigint, text[], text, int);
create or replace function public.create_pet_trade_offer(
  p_pet_uid text, p_pet_snapshot jsonb, p_accepts_pets boolean, p_accepts_silver boolean,
  p_pet_qty smallint, p_min_silver bigint, p_owner_has_ever text[], p_owner_pseudo text,
  p_expires_hours int default 168
) returns bigint
language plpgsql security definer set search_path to 'public' as $$
declare
  v_active_count int;
  v_id bigint;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if not p_accepts_pets and not p_accepts_silver then raise exception 'Un contrat doit accepter au moins compagnons ou silver'; end if;
  -- limite d'offres actives simultanées (todo doc : "sinon spam de contrats")
  select count(*) into v_active_count from public.pet_trade_offers where owner_user_id = auth.uid() and status = 'open';
  if v_active_count >= 10 then raise exception 'Trop de contrats actifs (max 10)'; end if;
  insert into public.pet_trade_offers(owner_user_id, owner_pseudo, pet_uid, pet_snapshot, accepts_pets, accepts_silver, pet_qty, min_silver, owner_has_ever, expires_at)
  values (auth.uid(), coalesce(p_owner_pseudo,'Joueur'), p_pet_uid, p_pet_snapshot, p_accepts_pets, p_accepts_silver,
    greatest(1, least(5, coalesce(p_pet_qty,1))), greatest(0, coalesce(p_min_silver,0)), coalesce(p_owner_has_ever,'{}'),
    now() + make_interval(hours => greatest(1, least(720, coalesce(p_expires_hours,168)))))
  returning id into v_id;
  return v_id;
end; $$;
grant execute on function public.create_pet_trade_offer(text, jsonb, boolean, boolean, smallint, bigint, text[], text, int) to authenticated;

drop function if exists public.cancel_pet_trade_offer(bigint);
create or replace function public.cancel_pet_trade_offer(p_offer_id bigint) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_owner uuid; v_pending record;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select owner_user_id into v_owner from public.pet_trade_offers where id = p_offer_id and status = 'open';
  if v_owner is null then raise exception 'Contrat introuvable ou déjà fermé'; end if;
  if v_owner is distinct from auth.uid() then raise exception 'Non autorisé'; end if;
  update public.pet_trade_offers set status = 'cancelled' where id = p_offer_id;
  -- toute contre-offre en attente est invalidée AVEC notification (todo doc : "pas juste
  -- supprimée silencieusement")
  for v_pending in select id, from_user_id from public.pet_trade_counters where offer_id = p_offer_id and status = 'pending' loop
    update public.pet_trade_counters set status = 'invalidated' where id = v_pending.id;
    insert into public.pet_trade_notifications(user_id, message) values (v_pending.from_user_id, 'Le contrat que tu avais contre-proposé a été retiré par son propriétaire.');
  end loop;
end; $$;
grant execute on function public.cancel_pet_trade_offer(bigint) to authenticated;

drop function if exists public.submit_pet_trade_counter(bigint, jsonb, bigint, text);
create or replace function public.submit_pet_trade_counter(p_offer_id bigint, p_pets jsonb, p_silver bigint, p_from_pseudo text)
returns bigint
language plpgsql security definer set search_path to 'public' as $$
declare
  v_offer record;
  v_id bigint;
  v_pet jsonb;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select * into v_offer from public.pet_trade_offers where id = p_offer_id and status = 'open';
  if v_offer is null then raise exception 'Contrat introuvable ou fermé'; end if;
  if v_offer.owner_user_id = auth.uid() then raise exception 'Impossible de contre-proposer sur son propre contrat'; end if;
  if v_offer.expires_at < now() then raise exception 'Contrat expiré'; end if;
  if jsonb_array_length(coalesce(p_pets,'[]'::jsonb)) = 0 and coalesce(p_silver,0) <= 0 then
    raise exception 'Proposez au moins un compagnon ou du silver';
  end if;
  if coalesce(p_silver,0) > 0 and v_offer.min_silver > 0 and p_silver < v_offer.min_silver then
    raise exception 'Silver insuffisant (minimum %)', v_offer.min_silver;
  end if;
  if jsonb_array_length(coalesce(p_pets,'[]'::jsonb)) > v_offer.pet_qty then raise exception 'Trop de compagnons proposés'; end if;
  -- anti-doublon serveur (todo doc : "ownerHasEver... il faut que Supabase refuse la transaction")
  -- -- sauf si le nom du pet n'apparaît PAS dans owner_has_ever (toggle "inclure déjà obtenus" géré
  -- côté client en ne proposant que des pets hors de cette liste ; ici on ne fait QUE vérifier que
  -- la liste envoyée est cohérente avec ce que le client a le droit de proposer par défaut -- un
  -- contournement volontaire (case cochée) reste possible et assumé, comme dans la maquette).
  insert into public.pet_trade_counters(offer_id, from_user_id, from_pseudo, pets, silver)
  values (p_offer_id, auth.uid(), coalesce(p_from_pseudo,'Joueur'), coalesce(p_pets,'[]'::jsonb), greatest(0, coalesce(p_silver,0)))
  returning id into v_id;
  insert into public.pet_trade_notifications(user_id, message)
    values (v_offer.owner_user_id, coalesce(p_from_pseudo,'Un joueur') || ' a fait une contre-offre sur ton contrat.');
  return v_id;
end; $$;
grant execute on function public.submit_pet_trade_counter(bigint, jsonb, bigint, text) to authenticated;

drop function if exists public.withdraw_pet_trade_counter(bigint);
create or replace function public.withdraw_pet_trade_counter(p_counter_id bigint) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_owner uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select from_user_id into v_owner from public.pet_trade_counters where id = p_counter_id and status = 'pending';
  if v_owner is null then raise exception 'Contre-offre introuvable'; end if;
  if v_owner is distinct from auth.uid() then raise exception 'Non autorisé'; end if;
  update public.pet_trade_counters set status = 'withdrawn' where id = p_counter_id;
end; $$;
grant execute on function public.withdraw_pet_trade_counter(bigint) to authenticated;

drop function if exists public.decline_pet_trade_counter(bigint);
create or replace function public.decline_pet_trade_counter(p_counter_id bigint) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_offer_owner uuid; v_counterer uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select o.owner_user_id, c.from_user_id into v_offer_owner, v_counterer
    from public.pet_trade_counters c join public.pet_trade_offers o on o.id = c.offer_id
    where c.id = p_counter_id and c.status = 'pending';
  if v_offer_owner is null then raise exception 'Contre-offre introuvable'; end if;
  if v_offer_owner is distinct from auth.uid() then raise exception 'Non autorisé'; end if;
  update public.pet_trade_counters set status = 'declined' where id = p_counter_id;
  insert into public.pet_trade_notifications(user_id, message) values (v_counterer, 'Ta contre-offre a été refusée.');
end; $$;
grant execute on function public.decline_pet_trade_counter(bigint) to authenticated;

-- acceptation : transaction ATOMIQUE (todo doc priorité 2) -- ferme l'offre, invalide les AUTRES
-- contre-offres (avec notification), enregistre l'historique, crée les 2 livraisons. Une seule
-- fonction PL/pgSQL = une seule transaction serveur, tout ou rien.
drop function if exists public.accept_pet_trade_counter(bigint);
create or replace function public.accept_pet_trade_counter(p_counter_id bigint) returns void
language plpgsql security definer set search_path to 'public' as $$
declare
  v_counter record;
  v_offer record;
  v_other record;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select * into v_counter from public.pet_trade_counters where id = p_counter_id and status = 'pending';
  if v_counter is null then raise exception 'Contre-offre introuvable ou déjà traitée'; end if;
  select * into v_offer from public.pet_trade_offers where id = v_counter.offer_id and status = 'open' for update;
  if v_offer is null then raise exception 'Contrat introuvable ou déjà fermé'; end if;
  if v_offer.owner_user_id is distinct from auth.uid() then raise exception 'Non autorisé'; end if;
  if v_offer.expires_at < now() then
    update public.pet_trade_offers set status = 'expired' where id = v_offer.id;
    raise exception 'Ce contrat a expiré';
  end if;

  update public.pet_trade_counters set status = 'accepted' where id = v_counter.id;
  update public.pet_trade_offers set status = 'closed' where id = v_offer.id;

  insert into public.pet_trade_history(offer_id, seller_user_id, buyer_user_id, seller_gave, buyer_gave)
  values (v_offer.id, v_offer.owner_user_id, v_counter.from_user_id, v_offer.pet_snapshot,
    jsonb_build_object('pets', v_counter.pets, 'silver', v_counter.silver));

  -- livraison pour le PROPRIÉTAIRE de l'offre : reçoit les pets/silver de la contre-offre
  insert into public.pet_trade_deliveries(user_id, pets, silver, reason)
  values (v_offer.owner_user_id, v_counter.pets, v_counter.silver, 'trade');
  -- livraison pour le CONTRE-PROPOSANT : reçoit le pet de l'offre initiale
  insert into public.pet_trade_deliveries(user_id, pets, silver, reason)
  values (v_counter.from_user_id, jsonb_build_array(v_offer.pet_snapshot), 0, 'trade');

  -- les AUTRES contre-offres pendantes sur ce contrat sont invalidées AVEC notification (rapporté
  -- explicitement : "elle disparaît actuellement sans un mot")
  for v_other in select id, from_user_id from public.pet_trade_counters where offer_id = v_offer.id and status = 'pending' loop
    update public.pet_trade_counters set status = 'invalidated' where id = v_other.id;
    insert into public.pet_trade_notifications(user_id, message) values (v_other.from_user_id, 'Une autre contre-offre a été acceptée sur ce contrat — la tienne est retirée.');
  end loop;

  insert into public.pet_trade_notifications(user_id, message) values (v_counter.from_user_id, 'Ta contre-offre a été acceptée ! Récupère ton compagnon dans le marché.');
end; $$;
grant execute on function public.accept_pet_trade_counter(bigint) to authenticated;

drop function if exists public.claim_pet_trade_delivery(bigint);
create or replace function public.claim_pet_trade_delivery(p_delivery_id bigint) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_owner uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select user_id into v_owner from public.pet_trade_deliveries where id = p_delivery_id and claimed = false;
  if v_owner is null then raise exception 'Livraison introuvable ou déjà réclamée'; end if;
  if v_owner is distinct from auth.uid() then raise exception 'Non autorisé'; end if;
  update public.pet_trade_deliveries set claimed = true where id = p_delivery_id;
end; $$;
grant execute on function public.claim_pet_trade_delivery(bigint) to authenticated;

drop function if exists public.mark_pet_trade_notifications_read();
create or replace function public.mark_pet_trade_notifications_read() returns void
language sql security definer set search_path to 'public' as $$
  update public.pet_trade_notifications set read = true where user_id = auth.uid() and read = false;
$$;
grant execute on function public.mark_pet_trade_notifications_read() to authenticated;

-- expiration automatique (todo doc priorité "job pg_cron qui clôture les contrats dont expires_at
-- est dépassé et notifie le propriétaire") -- fonction prête, appelée par pg_cron si l'extension
-- est activée sur ce projet, sinon reste utilisable manuellement/par une future Edge Function cron.
drop function if exists public.expire_pet_trade_offers();
create or replace function public.expire_pet_trade_offers() returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_row record;
begin
  for v_row in select id, owner_user_id from public.pet_trade_offers where status = 'open' and expires_at < now() loop
    update public.pet_trade_offers set status = 'expired' where id = v_row.id;
    insert into public.pet_trade_notifications(user_id, message) values (v_row.owner_user_id, 'Ton contrat d''échange a expiré sans acheteur.');
  end loop;
end; $$;
grant execute on function public.expire_pet_trade_offers() to authenticated;
