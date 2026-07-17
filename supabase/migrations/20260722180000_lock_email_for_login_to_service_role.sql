-- Verrouille email_for_login (2026-07-16, version "zéro fuite") : la fonction n'est plus
-- exécutable par anon/authenticated (elle l'était dans 20260722170000_email_for_login.sql, ce qui
-- exposait l'email par pseudo via /rest/v1/rpc — advisors 0028/0029). Désormais seul service_role
-- l'appelle, depuis l'Edge Function auth-by-identifier (supabase/functions/auth-by-identifier),
-- qui fait la connexion/reset côté serveur sans jamais renvoyer l'email au client.
revoke execute on function public.email_for_login(text) from anon, authenticated, public;
grant execute on function public.email_for_login(text) to service_role;
