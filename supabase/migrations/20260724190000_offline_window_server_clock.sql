-- ============================================================
-- Le SERVEUR devient seul juge de la durée hors-ligne (2026-07-20).
--
-- LE TROU. Le rattrapage hors-ligne Phase 1 (client, computeOfflineElapsedHours dans
-- src/core/game-core.js) calculait sa fenêtre avec `Date.now() - baseline`. Le TAUX était déjà
-- devenu serveur en V455 (player_stats.silver_per_hour, colonne protégée par
-- protect_server_rate_columns), mais la DURÉE restait celle de l'horloge de la machine du joueur.
-- Avancer l'horloge de l'OS créditait donc jusqu'au plafond de 24 h de farm par reconnexion, à
-- volonté : silver × taux honnête × 24, plus l'XP et le loat correspondants. C'est l'exploit n°1
-- des idle games (bdi-admin-monitoring-plan.md §8.2 : « ne jamais faire confiance au temps
-- client -- le serveur est seul juge de la durée écoulée »).
--
-- LA CORRECTION. offline_catchup_window() renvoie la fenêtre calculée UNIQUEMENT à partir
-- d'horodatages que le client ne peut pas écrire :
--   * game_saves.updated_at        -- posé par le trigger set_updated_at -> touch_updated_at(),
--                                     qui fait `new.updated_at = now()` à chaque UPDATE et ignore
--                                     donc toute valeur envoyée par le client ;
--   * game_saves.last_server_credit_at -- écrit par le seul cron credit_offline_progress_hourly().
-- On prend le PLUS RÉCENT des deux, exactement comme le faisait le client, mais avec le `now()`
-- du serveur. Aucun paramètre : rien à falsifier dans l'appel.
--
-- MÊME POLITIQUE, PAS UNE NOUVELLE. Le plafond de 24 h et le plancher de ~3 min reproduisent
-- OFFLINE_CATCHUP_CAP_HOURS / OFFLINE_CATCHUP_MIN_HOURS (game-core.js) : cette migration change
-- QUI mesure le temps, pas combien le joueur touche. Pour un joueur honnête à l'heure, la valeur
-- renvoyée est celle qu'il calculait déjà lui-même.
--
-- CE QUI N'EST PAS COUVERT ICI, ET POURQUOI CE N'EST PAS GRAVE : hors ligne (lecture réseau
-- impossible), le client n'obtient plus de fenêtre et ne crédite donc rien immédiatement. Le
-- joueur ne perd rien -- credit_offline_progress_hourly() (Phase 2, cron horaire, entièrement
-- serveur, sans plafond de durée) crédite ces heures de toute façon. On échange un retour visuel
-- immédiat dans un cas rare contre une économie qui ne se fabrique plus toute seule.
-- ============================================================

create or replace function public.offline_catchup_window()
returns table(elapsed_hours numeric, baseline_at timestamptz, server_now timestamptz)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_cap  constant numeric := 24;    -- = OFFLINE_CATCHUP_CAP_HOURS (game-core.js)
  v_min  constant numeric := 0.05;  -- = OFFLINE_CATCHUP_MIN_HOURS, ~3 min
  v_base timestamptz;
  v_h    numeric;
begin
  if auth.uid() is null then
    return;                                     -- aucune ligne : le client traite ça comme "pas de fenêtre"
  end if;
  select greatest(gs.updated_at, coalesce(gs.last_server_credit_at, gs.updated_at))
    into v_base
    from game_saves gs
   where gs.user_id = auth.uid();
  if v_base is null then
    return;                                     -- pas encore de sauvegarde : rien à rattraper
  end if;
  v_h := extract(epoch from (now() - v_base)) / 3600.0;
  if v_h < v_min then v_h := 0; end if;
  return query select least(greatest(v_h, 0), v_cap), v_base, now();
end;
$$;

-- lisible par tout compte connecté, mais seulement POUR LUI-MÊME (auth.uid() en dur dans la
-- requête, aucun paramètre) -- et jamais par anon, qui n'a pas de session à mesurer.
revoke all on function public.offline_catchup_window() from public, anon;
grant execute on function public.offline_catchup_window() to authenticated;
