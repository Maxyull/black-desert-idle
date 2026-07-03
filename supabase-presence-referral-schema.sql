-- ============================================================
-- Présence (compteur "joueurs en ligne", invités inclus) + Parrainage
-- Velia Idle — à coller après supabase-leaderboard-schema.sql (get_my_referrals lit
-- la table player_stats + sa colonne "lvl").
-- Supabase > SQL Editor > New query > Run
-- ============================================================

-- ---------- Présence ----------
create table if not exists public.presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_guest boolean not null default false,
  last_seen timestamptz not null default now()
);
alter table public.presence enable row level security;

-- pas de lecture directe pour les clients (évite d'exposer qui est en ligne) —
-- uniquement l'agrégat via get_online_counts() ci-dessous.
drop policy if exists "presence_upsert_own" on public.presence;
create policy "presence_upsert_own" on public.presence for insert with check (auth.uid() = user_id);
drop policy if exists "presence_update_own" on public.presence;
create policy "presence_update_own" on public.presence for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- appelé toutes les ~20s par chaque client connecté (invité ou vérifié)
create or replace function public.heartbeat_presence(p_is_guest boolean)
returns void
language plpgsql security definer
as $$
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;
  insert into public.presence (user_id, is_guest, last_seen)
  values (auth.uid(), p_is_guest, now())
  on conflict (user_id) do update set is_guest = excluded.is_guest, last_seen = now();
end;
$$;

-- fenêtre glissante : un joueur est "en ligne" s'il a pulsé dans les p_window_seconds dernières secondes
create or replace function public.get_online_counts(p_window_seconds int default 90)
returns table(total int, guests int, verified int)
language sql security definer
as $$
  select count(*)::int as total,
         count(*) filter (where is_guest)::int as guests,
         count(*) filter (where not is_guest)::int as verified
  from public.presence
  where last_seen > now() - (p_window_seconds || ' seconds')::interval;
$$;

grant execute on function public.heartbeat_presence(boolean) to authenticated;
grant execute on function public.get_online_counts(int) to authenticated, anon;

-- ---------- Parrainage (réservé aux comptes vérifiés) ----------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  referral_code text not null unique,
  referred_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- chacun ne peut voir que sa propre ligne (code + qui l'a parrainé)
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = user_id);
-- pas d'insert/update direct côté client : uniquement via les fonctions SECURITY DEFINER ci-dessous.

-- crée (si besoin) et renvoie le code de parrainage du compte courant — appelé à l'ouverture
-- du panneau "Mon compte". Réservé aux comptes vérifiés.
create or replace function public.ensure_referral_code()
returns text
language plpgsql security definer
as $$
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
$$;

-- applique un code de parrainage saisi par le joueur — PAS DE RÉCOMPENSE pour l'instant,
-- juste un lien de suivi (referred_by). Règles :
--   - un compte ne peut être parrainé qu'une seule fois (jamais réutilisé/changé ensuite) ;
--   - le parrainage doit se faire dans les 3 jours suivant la création du compte du filleul ;
--   - impossible d'utiliser son propre code ;
--   - impossible de parrainer son propre parrain (pas de boucle A→B→A).
create or replace function public.apply_referral_code(p_code text)
returns void
language plpgsql security definer
as $$
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
$$;

-- nombre de filleuls du compte courant
create or replace function public.get_referral_count()
returns int
language sql security definer
as $$
  select count(*)::int from public.profiles where referred_by = auth.uid();
$$;

-- liste des filleuls du compte courant, avec leur niveau/gearscore/silver (via player_stats)
create or replace function public.get_my_referrals()
returns table(display_name text, lvl int, gearscore int, silver bigint, joined_at timestamptz)
language sql security definer
as $$
  select coalesce(ps.display_name, '?'), coalesce(ps.lvl, 1), coalesce(ps.gearscore, 0),
         coalesce(ps.silver, 0), pr.created_at
  from public.profiles pr
  left join public.player_stats ps on ps.user_id = pr.user_id
  where pr.referred_by = auth.uid()
  order by pr.created_at desc;
$$;

grant execute on function public.ensure_referral_code() to authenticated;
grant execute on function public.apply_referral_code(text) to authenticated;
grant execute on function public.get_referral_count() to authenticated;
grant execute on function public.get_my_referrals() to authenticated;
