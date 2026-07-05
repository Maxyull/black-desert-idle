-- Corrige l'avertissement Supabase "function_search_path_mutable" (48 fonctions) : sans
-- search_path explicite, une fonction SECURITY DEFINER peut être piégée si quelqu'un crée un objet
-- de même nom dans un schéma placé avant "public" dans le search_path de l'appelant. Fixe le
-- search_path de TOUTES les fonctions du schéma public qui n'en ont pas déjà un, sans avoir à lister
-- chaque signature à la main (certaines fonctions sont surchargées).
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%'
      )
  loop
    execute format('alter function %s set search_path = public', r.sig);
  end loop;
end $$;
