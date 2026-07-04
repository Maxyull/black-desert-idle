-- ============================================================
-- Rôle "Testeur" — Velia Idle
-- Les testeurs ont accès à un panneau TESTER (fonctionnalités de test SANS aucun avantage) et
-- peuvent prévisualiser en avant-première les nouveautés (pêche, mine...) avant leur sortie.
-- Géré par l'admin (ajout/retrait par UUID), comme les modérateurs.
--
-- Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists public.testers (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.testers enable row level security;
drop policy if exists "testers_select_all" on public.testers;
create policy "testers_select_all" on public.testers for select using (auth.uid() is not null);

create or replace function public.admin_add_tester(p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  if not exists (select 1 from auth.users where id = p_user_id) then raise exception 'UUID inconnu'; end if;
  insert into public.testers (user_id) values (p_user_id) on conflict (user_id) do nothing;
end; $$;
grant execute on function public.admin_add_tester(uuid) to authenticated;

create or replace function public.admin_remove_tester(p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  delete from public.testers where user_id = p_user_id;
end; $$;
grant execute on function public.admin_remove_tester(uuid) to authenticated;

create or replace function public.admin_list_testers()
returns table(user_id uuid, pseudo text) language plpgsql security definer as $$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  return query select t.user_id, p.pseudo from public.testers t
    left join public.profiles p on p.user_id = t.user_id order by p.pseudo nulls last;
end; $$;
grant execute on function public.admin_list_testers() to authenticated;
