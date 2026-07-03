-- ============================================================
-- Vérification admin côté serveur — évite d'exposer l'email admin en clair
-- dans index.html ou dans un fichier SQL commité (le dépôt GitHub est public).
--
-- Remplace TON-UUID-ADMIN ci-dessous par ton user_id Supabase réel :
-- Dashboard > Authentication > Users > clique sur ton compte > copie le "User UID".
-- Un UUID n'est pas une donnée personnelle identifiable (contrairement à un email),
-- il peut rester dans ce fichier même si le dépôt est public.
--
-- Supabase > SQL Editor > New query > Run
-- ============================================================

create or replace function public.am_i_admin()
returns boolean
language sql security definer
as $$
  select auth.uid() = 'TON-UUID-ADMIN'::uuid;
$$;

grant execute on function public.am_i_admin() to authenticated;
