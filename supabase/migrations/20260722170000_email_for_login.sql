-- Connexion / réinitialisation par PSEUDO ou EMAIL (2026-07-16, demande explicite).
-- Le client Supabase (signInWithPassword / resetPasswordForEmail) exige une adresse email.
-- Ce RPC résout un identifiant "pseudo OU email" en email :
--   - si l'identifiant contient '@', il est renvoyé tel quel (déjà un email) ;
--   - sinon on cherche profiles.pseudo (insensible à la casse) -> auth.users.email.
-- security definer : lit auth.users (hors RLS). Voir resolveLoginEmail() dans game-supabase.js.
--
-- ⚠️ COMPROMIS DE CONFIDENTIALITÉ ASSUMÉ : ce RPC permet, à partir d'un pseudo public, de récupérer
-- l'email associé (énumération possible). C'est le prix à payer pour la connexion par pseudo avec
-- l'auth client Supabase. Si ce n'est pas souhaité, NE PAS appliquer cette migration : le client
-- retombe alors proprement sur la connexion par email uniquement (resolveLoginEmail renvoie null
-- pour un pseudo, message "aucun compte trouvé"). Une alternative sans fuite nécessiterait une Edge
-- Function faisant le grant de mot de passe côté serveur (non implémentée ici).

create or replace function public.email_for_login(p_identifier text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_email text;
begin
  if p_identifier is null or length(trim(p_identifier)) = 0 then
    return null;
  end if;
  -- déjà un email
  if position('@' in p_identifier) > 0 then
    return trim(p_identifier);
  end if;
  -- pseudo -> email (via profiles.user_id -> auth.users)
  select u.email
    into v_email
    from public.profiles pr
    join auth.users u on u.id = pr.user_id
   where lower(pr.pseudo) = lower(trim(p_identifier))
   limit 1;
  return v_email; -- null si aucun pseudo ne correspond
end;
$$;

grant execute on function public.email_for_login(text) to anon, authenticated;
