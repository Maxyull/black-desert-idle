-- ============================================================
-- Retire `anon` de toutes les RPC admin (2026-07-20).
--
-- CONSTAT. 33 fonctions `admin_*` en SECURITY DEFINER étaient encore exécutables par le rôle
-- `anon`, c'est-à-dire par n'importe qui avec la clé publiable -- y compris
-- admin_reset_all_accounts, admin_ban_player, admin_set_loot_rates, admin_spawn_boss,
-- admin_get_player_save. Supabase accorde EXECUTE à `anon` par défaut sur toute fonction de
-- `public` : sans revoke explicite, chaque nouvelle RPC arrive ouverte.
--
-- CE N'EST PAS UNE FAILLE OUVERTE, C'EST UNE LIGNE DE DÉFENSE MANQUANTE. Toutes ces fonctions
-- portent la garde e-mail staff en première ligne, et un appelant anonyme n'a pas de JWT : il se
-- prend « Réservé au staff ». La garde a été vérifiée, elle tient. Mais elle est le SEUL rempart,
-- et un oubli de garde dans une future RPC deviendrait immédiatement exploitable. La convention du
-- projet (CLAUDE.md, et toutes les migrations admin récentes) est justement `revoke ... from
-- public, anon` -- 33 fonctions ne la respectaient pas.
--
-- BALAYAGE AUTOMATIQUE plutôt que liste écrite à la main : une liste manuelle serait périmée à la
-- prochaine RPC ajoutée, et c'est exactement comme ça que ces 33 sont passées au travers.
-- `authenticated` est conservé (c'est par là que passe le panneau admin), la garde e-mail reste le
-- contrôle d'autorisation réel.
-- ============================================================

do $$
declare r record; n int := 0;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace and ns.nspname = 'public'
    where p.prosecdef
      and p.proname like 'admin\_%'
      and has_function_privilege('anon', p.oid, 'execute')
  loop
    execute format('revoke all on function %s from anon, public', r.sig);
    n := n + 1;
  end loop;
  raise notice 'anon retiré de % fonctions admin', n;
end $$;
