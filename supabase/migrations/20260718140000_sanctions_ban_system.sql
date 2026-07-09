-- Système de sanctions (ban/mute) — demande explicite du 2026-07-18, suite à l'adaptation du
-- plan de refonte du panneau admin (voir ADMIN_MENU_PLAN.md §3.1). Jusqu'ici un joueur toxique ne
-- pouvait être que réinitialisé (admin_reset_account_by_uuid), jamais bloqué : vrai trou de
-- fonctionnalité, pas un nice-to-have.
alter table public.profiles add column if not exists banned_until timestamptz;
alter table public.profiles add column if not exists ban_reason text;

-- bannit p_user_id pour p_duration_hours heures avec un motif prédéfini côté client (Triche/
-- Exploit/Harcèlement/Autre). Réservé au staff, même pattern que admin_add_mod/admin_reset_*.
create or replace function public.admin_ban_player(p_user_id uuid, p_duration_hours int, p_reason text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  if not exists (select 1 from auth.users where id = p_user_id) then raise exception 'UUID inconnu'; end if;
  if p_duration_hours is null or p_duration_hours <= 0 then raise exception 'Durée invalide'; end if;
  update public.profiles
    set banned_until = now() + (p_duration_hours || ' hours')::interval, ban_reason = p_reason
    where user_id = p_user_id;
  if not found then
    insert into public.profiles (user_id, banned_until, ban_reason) values (p_user_id, now() + (p_duration_hours || ' hours')::interval, p_reason);
  end if;
end;
$function$;
grant execute on function public.admin_ban_player(uuid, int, text) to authenticated;

create or replace function public.admin_unban_player(p_user_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  update public.profiles set banned_until = null, ban_reason = null where user_id = p_user_id;
end;
$function$;
grant execute on function public.admin_unban_player(uuid) to authenticated;

-- liste des bannissements actifs (banned_until dans le futur) — utilisée par le panneau admin.
-- RLS profiles_select_own limite un joueur à sa propre ligne, cette RPC (SECURITY DEFINER)
-- contourne volontairement pour l'admin uniquement, même logique que les autres vues admin.
create or replace function public.admin_list_bans()
 returns table(user_id uuid, pseudo text, banned_until timestamptz, ban_reason text)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  return query
    select p.user_id, p.pseudo, p.banned_until, p.ban_reason
    from public.profiles p
    where p.banned_until is not null and p.banned_until > now()
    order by p.banned_until desc;
end;
$function$;
grant execute on function public.admin_list_bans() to authenticated;

-- lecture du statut de ban du compte courant, sans dépendre de la policy profiles_select_own
-- (qui existe déjà et suffirait, mais une RPC dédiée évite de dépendre d'un select direct sur
-- une colonne sensible si la policy change un jour) — appelée juste après connexion.
create or replace function public.get_my_ban_status()
 returns table(banned_until timestamptz, ban_reason text)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  return query select p.banned_until, p.ban_reason from public.profiles p where p.user_id = auth.uid();
end;
$function$;
grant execute on function public.get_my_ban_status() to authenticated;
