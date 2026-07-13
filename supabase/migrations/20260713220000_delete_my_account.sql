-- RPC delete_my_account() : suppression du compte joueur, à la demande explicite de l'utilisateur
-- (panneau "Mon compte" -> carte Maintenance -> bouton "Supprimer mon compte", 2026-07-13, voir
-- CLAUDE.md pour le contexte complet de la refonte).
--
-- PORTEE EXACTE (a documenter clairement, jamais laisser une suppression partielle silencieuse) :
-- Cette RPC supprime TOUTES les DONNEES DE JEU liees a auth.uid() (sauvegarde, stats, sessions,
-- historique AFK, presence, parrainage, votes/commentaires patch notes, contributions boss,
-- silver_ledger, etc. -- voir la boucle dynamique ci-dessous). Elle NE supprime PAS la ligne
-- auth.users elle-meme : la suppression complete d'un compte Auth Supabase necessite
-- auth.admin.deleteUser(), qui exige la cle service_role et ne peut PAS s'executer depuis une RPC
-- SQL security definer classique -- cela demanderait une Edge Function separee avec la cle
-- service_role, hors perimetre raisonnable de cette passe. Equivalent fonctionnel cote joueur :
-- plus aucune donnee de jeu, plus de pseudo, plus de stats/classement -- le compte Auth "vide"
-- pourrait techniquement se reconnecter mais retomberait sur un etat de tout nouveau joueur (voir
-- loadCloudSave() -> "Nouveau personnage" si game_saves est vide). Le client (game-supabase.js,
-- openAccountPanel()) appelle sb.auth.signOut() immediatement apres le succes de cette RPC.
--
-- Portee dynamique (et pourquoi) : boucle DYNAMIQUEMENT sur toutes les tables du schema `public`
-- possedant une colonne nommee exactement `user_id` (information_schema.columns) et y supprime
-- UNIQUEMENT les lignes ou `user_id = auth.uid()`. Sur par construction : le filtre est TOUJOURS
-- `= auth.uid()`, jamais un parametre externe, donc structurellement impossible de cibler un autre
-- compte. Verifie via list_tables (2026-07-13) : couvre game_saves, player_stats, profiles,
-- presence, discord_links, sell_log, testers, player_sessions, player_afk_sessions, chat_mods,
-- boss_contributions, boss_claims, silver_ledger, patch_note_votes, patch_note_comments (cascade
-- vers patch_note_comment_reports.comment_id), patch_note_rate_limit_events, companion_stats,
-- market_orders, farm_events, item_tutorials_seen, client_errors, chat_messages, player_notices,
-- playtime_pings, link_codes, pet_trade_deliveries, pet_trade_notifications -- et toute future
-- table qui suivrait la meme convention `user_id`.
-- Explicitement HORS de cette boucle (colonne differente de `user_id`, donnee partagee avec
-- d'autres joueurs qu'on ne veut pas casser en supprimant une seule ligne) : market_trades
-- (buy_order_id/sell_order_id, historique partage), market_listings (seller_id/buyer_id),
-- pet_trade_offers (owner_user_id, referencee par pet_trade_counters.offer_id) et
-- pet_trade_counters (from_user_id) -- laissees intactes pour ne pas casser une contrepartie.
-- patch_note_comment_reports (reporter_id, pas user_id) est couverte explicitement ci-dessous.
--
-- Verifier apres application (get_advisors) qu'aucune faille RLS n'est introduite : cette fonction
-- est SECURITY DEFINER (necessaire pour traverser les policies RLS de chaque table le temps de la
-- suppression) -- le filtre `user_id = auth.uid()` (jamais un parametre) est la seule barriere et
-- DOIT rester ainsi. Suite : voir 20260713220100_delete_my_account_revoke_anon.sql (get_advisors a
-- signale que PostgreSQL accorde EXECUTE a PUBLIC par defaut sur toute nouvelle fonction -- corrige
-- juste apres, jamais modifie ici puisque cette migration est deja appliquee).

drop function if exists public.delete_my_account();

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid;
  v_table text;
  v_deleted bigint;
  v_total bigint := 0;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Non authentifié';
  end if;

  -- boucle dynamique sur toutes les tables du schema public ayant une colonne `user_id` (voir
  -- commentaire ci-dessus) -- delete strictement scope a auth.uid(), jamais un parametre externe.
  for v_table in
    select c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'user_id'
    order by c.table_name
  loop
    execute format('delete from public.%I where user_id = $1', v_table) using v_uid;
    get diagnostics v_deleted = row_count;
    v_total := v_total + v_deleted;
  end loop;

  -- table reelle verifiee via list_tables (2026-07-13) : `patch_note_comment_reports` utilise
  -- `reporter_id`, pas `user_id` -- hors de la boucle dynamique ci-dessus par construction.
  if to_regclass('public.patch_note_comment_reports') is not null then
    delete from public.patch_note_comment_reports where reporter_id = v_uid;
  end if;

  -- log minimal pour le suivi admin (best-effort, ne doit jamais faire echouer la suppression
  -- elle-meme -- reutilise la colonne `message` existante de client_errors, pas de colonne dediee)
  begin
    if to_regclass('public.client_errors') is not null then
      insert into public.client_errors (user_id, message, url)
      values (null, format('account_deleted: uid=%s rows_deleted=%s', v_uid, v_total), 'rpc:delete_my_account');
    end if;
  exception when others then
    null; -- best-effort, jamais bloquant
  end;
end;
$$;

grant execute on function public.delete_my_account() to authenticated;
