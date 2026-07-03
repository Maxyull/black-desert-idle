-- ============================================================
-- Pseudo personnalisé — Velia Idle
-- À coller après supabase-presence-referral-schema.sql (nécessite la table profiles).
-- Supabase > SQL Editor > New query > Run
-- ============================================================

alter table public.profiles add column if not exists pseudo text;

-- Change le pseudo du compte courant (2 à 20 caractères). Réservé aux comptes vérifiés.
-- Une seule ligne par joueur (clé = user_id) : un changement de pseudo met à jour la
-- même ligne partout (classement compris), il ne peut jamais en créer une nouvelle.
create or replace function public.set_pseudo(p_pseudo text)
returns void
language plpgsql security definer
as $$
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
$$;

grant execute on function public.set_pseudo(text) to authenticated;
