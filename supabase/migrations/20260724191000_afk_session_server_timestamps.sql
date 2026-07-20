-- ============================================================
-- record_afk_session : les deux bornes de temps viennent du SERVEUR (2026-07-20).
--
-- Suite directe de 20260724190000 (fenêtre de rattrapage). Là on fermait la porte par laquelle le
-- silver ENTRAIT ; ici on assainit ce qui est ÉCRIT sur la session.
--
-- AVANT : p_started_at et p_ended_at étaient insérés tels quels. Rien n'empêchait un client
-- modifié d'annoncer une session de 30 jours, ou une fin antérieure au début. Ces lignes
-- alimentent le modal de reconnexion, la section admin Reconnexion et les contrôles d'intégrité
-- (20260724180000) : les polluer suffisait à rendre la surveillance aveugle ou bruyante.
--
-- APRÈS : les paramètres restent dans la signature -- les clients déjà déployés continuent
-- d'appeler avec 11 arguments, il ne doit RIEN casser -- mais leur valeur est ignorée.
--   ended_at   = now()
--   started_at = greatest(game_saves.updated_at, last_server_credit_at), c'est-à-dire la dernière
--                trace SERVEUR du joueur : deux horodatages qu'il ne peut pas écrire (le premier
--                est forcé par le trigger touch_updated_at, le second par le cron). C'est aussi
--                exactement la baseline utilisée par offline_catchup_window(), donc la durée
--                affichée au joueur correspond à celle qui lui a été payée.
--   repli      = now() (durée nulle) si aucune sauvegarde, plutôt qu'une borne inventée.
--
-- CE QUI RESTE DÉCLARÉ PAR LE CLIENT : silver_gained, xp_gained, les niveaux, la zone, les objets.
-- Ce sont des données d'AFFICHAGE, elles ne créditent rien (le crédit passe par addSilver/le cron).
-- Et maintenant que la durée est vraie, le rapport silver_gained/durée devient une mesure fiable :
-- c'est précisément ce que surveille le contrôle 'silver_rate' de admin_run_integrity_checks().
-- ============================================================

create or replace function public.record_afk_session(
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_silver_gained bigint,
  p_xp_gained bigint,
  p_level_before int,
  p_level_after int,
  p_zone_name text,
  p_gear_grade text,
  p_items jsonb,
  p_best_drop_name text,
  p_best_drop_color text
) returns void
language plpgsql security definer set search_path to 'public' as $$
declare
  v_started timestamptz;
begin
  if auth.uid() is null then return; end if;
  -- p_started_at / p_ended_at sont volontairement IGNORÉS (voir l'en-tête) : conservés dans la
  -- signature pour ne pas casser les clients déjà déployés.
  select greatest(gs.updated_at, coalesce(gs.last_server_credit_at, gs.updated_at))
    into v_started
    from game_saves gs
   where gs.user_id = auth.uid();
  v_started := least(coalesce(v_started, now()), now());   -- jamais de durée négative

  insert into public.player_afk_sessions(
    user_id, started_at, ended_at, silver_gained, xp_gained, level_before, level_after,
    zone_name, gear_grade, items, best_drop_name, best_drop_color
  ) values (
    auth.uid(), v_started, now(),
    greatest(0, coalesce(p_silver_gained,0)), greatest(0, coalesce(p_xp_gained,0)),
    coalesce(p_level_before,1), coalesce(p_level_after,1), p_zone_name, p_gear_grade,
    coalesce(p_items, '[]'::jsonb), p_best_drop_name, p_best_drop_color
  );
end; $$;

revoke all on function public.record_afk_session(timestamptz, timestamptz, bigint, bigint, int, int, text, text, jsonb, text, text) from public, anon;
grant execute on function public.record_afk_session(timestamptz, timestamptz, bigint, bigint, int, int, text, text, jsonb, text, text) to authenticated;
