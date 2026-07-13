-- Suite de 20260713220000_delete_my_account.sql : get_advisors (2026-07-13) signale que la
-- fonction reste executable par le role `anon` (PostgreSQL accorde EXECUTE a PUBLIC par defaut sur
-- toute fonction nouvellement creee, la migration precedente n'avait accorde explicitement qu'a
-- `authenticated` sans REVOKE explicite du droit par-defaut). Defense en profondeur : la fonction
-- leve deja une exception si auth.uid() est null (donc un appel anon echoue de toute facon), mais
-- fermer l'avertissement du linter de securite proprement plutot que de compter uniquement sur ce
-- garde-fou interne.
revoke execute on function public.delete_my_account() from public;
revoke execute on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;
