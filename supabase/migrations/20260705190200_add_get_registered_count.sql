-- ============================================================
-- Nombre total de comptes reels (non-anonymes) -- demande explicite du 2026-07-05 : afficher le
-- nombre d'inscrits sous le compteur "en ligne". Aucune donnee personnelle exposee, juste un total.
--
-- Supabase > SQL Editor > New query > Run (deja applique en prod le 2026-07-05)
-- ============================================================

create or replace function public.get_registered_count()
returns integer
language sql
security definer
set search_path to 'public'
as $$
  select count(*)::integer from auth.users where coalesce(is_anonymous, false) = false;
$$;
grant execute on function public.get_registered_count() to anon, authenticated;
