-- ============================================================
-- Couverture admin des zones sans aucune surface (2026-07-19, demande explicite :
-- "ajouter ce qu'il manque comme stats"). Audit : plusieurs pans du jeu écrivaient en base
-- sans qu'aucune vue admin ne les lise -- erreurs client (collectées + purgées par cron, mais
-- jamais consultables), anti-abus auth, Mini Boss (5 tables), PvP Compagnon et Marché Compagnon
-- (sections marquées "Prévu" alors que les données existent), Donations (les RPC d'écriture
-- existaient déjà, pas la lecture admin).
--
-- Toutes les fonctions suivent EXACTEMENT le patron des RPC admin déjà en place
-- (cf. admin_signups_by_day) : SECURITY DEFINER + search_path figé + garde e-mail staff faite
-- À L'INTÉRIEUR de la fonction (la vraie barrière ; le masquage du bouton côté client n'est
-- qu'un confort). Grants : revoke public+anon puis grant authenticated -- Supabase accorde
-- anon par défaut, et un `revoke from public` seul laisserait anon=true (piège déjà rencontré
-- sur my_silver_by_category, voir 20260723130000).
-- LECTURE SEULE : aucune de ces fonctions n'écrit ni ne supprime quoi que ce soit.
-- ============================================================

-- ---------- Erreurs client (monitoring) ----------
create or replace function public.admin_client_errors_summary(p_days integer default 14)
returns table(day date, errors bigint, affected_users bigint)
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  return query
    select date_trunc('day', ce.created_at)::date, count(*)::bigint, count(distinct ce.user_id)::bigint
    from client_errors ce
    where ce.created_at > now() - (p_days || ' days')::interval
    group by 1 order by 1;
end; $$;

-- top des messages : c'est la vue qui sert à décider quoi corriger en premier
create or replace function public.admin_client_errors_top(p_days integer default 14, p_limit integer default 20)
returns table(message text, occurrences bigint, affected_users bigint, last_seen timestamptz, versions text)
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  return query
    select ce.message, count(*)::bigint, count(distinct ce.user_id)::bigint, max(ce.created_at),
           string_agg(distinct coalesce(ce.game_version,'?'), ', ')
    from client_errors ce
    where ce.created_at > now() - (p_days || ' days')::interval
    group by ce.message
    order by count(*) desc
    limit p_limit;
end; $$;

create or replace function public.admin_client_errors_recent(p_limit integer default 50)
returns table(created_at timestamptz, message text, url text, game_version text, user_agent text, user_id uuid)
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  return query
    select ce.created_at, ce.message, ce.url, ce.game_version, ce.user_agent, ce.user_id
    from client_errors ce
    order by ce.created_at desc
    limit p_limit;
end; $$;

-- ---------- Anti-abus (limitation de débit auth) ----------
create or replace function public.admin_auth_rate_limit(p_limit integer default 50)
returns table(bucket text, hits integer, window_start timestamptz)
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  return query
    select a.bucket, a.count, a.window_start
    from auth_rate_limit a
    order by a.window_start desc, a.count desc
    limit p_limit;
end; $$;

-- ---------- Mini Boss ----------
create or replace function public.admin_miniboss_stats()
returns table(sessions_total bigint, sessions_active bigint, participants_total bigint,
              distinct_players bigint, total_damage numeric, last_session timestamptz)
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  return query
    select (select count(*)::bigint from miniboss_sessions),
           (select count(*)::bigint from miniboss_sessions s where s.status = 'active'),
           (select count(*)::bigint from miniboss_participants),
           (select count(distinct p.user_id)::bigint from miniboss_participants p),
           (select coalesce(sum(c.damage), 0)::numeric from miniboss_contributions c),
           (select max(s.created_at) from miniboss_sessions s);
end; $$;

create or replace function public.admin_miniboss_recent(p_limit integer default 20)
returns table(id uuid, summoner_pseudo text, status text, hp numeric, max_hp numeric,
              participant_count integer, run_index integer, run_length integer, created_at timestamptz)
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  return query
    select s.id, s.summoner_pseudo, s.status, s.hp, s.max_hp,
           s.participant_count, s.run_index, s.run_length, s.created_at
    from miniboss_sessions s
    order by s.created_at desc
    limit p_limit;
end; $$;

-- ---------- PvP Compagnon (section "Prévu" alors que le cron de résolution tourne déjà) ----------
create or replace function public.admin_pvp_stats()
returns table(tournaments_total bigint, tournaments_resolved bigint, registrations_total bigint,
              distinct_players bigint, rewards_total bigint, rewards_claimed bigint, silver_awarded bigint)
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  return query
    select (select count(*)::bigint from companion_pvp_tournaments),
           (select count(*)::bigint from companion_pvp_tournaments t where t.status = 'resolved'),
           (select count(*)::bigint from companion_pvp_registrations),
           (select count(distinct r.user_id)::bigint from companion_pvp_registrations r),
           (select count(*)::bigint from companion_pvp_rewards),
           (select count(*)::bigint from companion_pvp_rewards w where w.claimed),
           (select coalesce(sum(w.silver), 0)::bigint from companion_pvp_rewards w);
end; $$;

create or replace function public.admin_pvp_recent(p_limit integer default 20)
returns table(day date, status text, registrant_count integer, winner_pseudo text,
              resolved_at timestamptz, created_at timestamptz)
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  return query
    select t.day, t.status, t.registrant_count, t.winner_pseudo, t.resolved_at, t.created_at
    from companion_pvp_tournaments t
    order by t.day desc
    limit p_limit;
end; $$;

-- ---------- Marché Compagnon (troc de familiers entre joueurs -- distinct du marché du jeu) ----------
create or replace function public.admin_pet_trade_stats()
returns table(offers_total bigint, offers_open bigint, trades_total bigint,
              deliveries_pending bigint, distinct_traders bigint)
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  return query
    select (select count(*)::bigint from pet_trade_offers),
           (select count(*)::bigint from pet_trade_offers o where o.status = 'open'),
           (select count(*)::bigint from pet_trade_history),
           (select count(*)::bigint from pet_trade_deliveries d where not d.claimed),
           (select count(distinct x.uid)::bigint from (
              select o.owner_user_id as uid from pet_trade_offers o
              union select h.seller_user_id from pet_trade_history h
              union select h2.buyer_user_id from pet_trade_history h2
            ) x where x.uid is not null);
end; $$;

create or replace function public.admin_pet_trade_recent(p_limit integer default 20)
returns table(id bigint, owner_pseudo text, status text, pet_qty integer, min_silver bigint,
              accepts_pets boolean, accepts_silver boolean, created_at timestamptz, expires_at timestamptz)
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  return query
    select o.id, o.owner_pseudo, o.status, o.pet_qty::integer, o.min_silver,
           o.accepts_pets, o.accepts_silver, o.created_at, o.expires_at
    from pet_trade_offers o
    order by o.created_at desc
    limit p_limit;
end; $$;

-- ---------- Donations (l'écriture admin_add_donation existait déjà ; il manquait la lecture) ----------
create or replace function public.admin_list_donations(p_limit integer default 100)
returns table(id bigint, amount_usd numeric, currency text, amount_original numeric,
              donor_label text, is_public boolean, source text, note text,
              received_at timestamptz, created_at timestamptz)
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  return query
    select d.id, d.amount_usd, d.currency::text, d.amount_original,
           d.donor_label, d.is_public, d.source, d.note, d.received_at, d.created_at
    from donations d
    order by coalesce(d.received_at, d.created_at) desc
    limit p_limit;
end; $$;

-- ---------- Grants : jamais anon (voir en-tête) ----------
revoke all on function public.admin_client_errors_summary(integer) from public, anon;
revoke all on function public.admin_client_errors_top(integer, integer) from public, anon;
revoke all on function public.admin_client_errors_recent(integer) from public, anon;
revoke all on function public.admin_auth_rate_limit(integer) from public, anon;
revoke all on function public.admin_miniboss_stats() from public, anon;
revoke all on function public.admin_miniboss_recent(integer) from public, anon;
revoke all on function public.admin_pvp_stats() from public, anon;
revoke all on function public.admin_pvp_recent(integer) from public, anon;
revoke all on function public.admin_pet_trade_stats() from public, anon;
revoke all on function public.admin_pet_trade_recent(integer) from public, anon;
revoke all on function public.admin_list_donations(integer) from public, anon;

grant execute on function public.admin_client_errors_summary(integer) to authenticated;
grant execute on function public.admin_client_errors_top(integer, integer) to authenticated;
grant execute on function public.admin_client_errors_recent(integer) to authenticated;
grant execute on function public.admin_auth_rate_limit(integer) to authenticated;
grant execute on function public.admin_miniboss_stats() to authenticated;
grant execute on function public.admin_miniboss_recent(integer) to authenticated;
grant execute on function public.admin_pvp_stats() to authenticated;
grant execute on function public.admin_pvp_recent(integer) to authenticated;
grant execute on function public.admin_pet_trade_stats() to authenticated;
grant execute on function public.admin_pet_trade_recent(integer) to authenticated;
grant execute on function public.admin_list_donations(integer) to authenticated;
