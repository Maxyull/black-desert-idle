-- ============================================================
-- Rattrapage hors-ligne "Phase 2" : cron SERVEUR horaire, tourne même navigateur/onglet fermé
-- (2026-07-14, demande explicite du owner, confirmée via AskUserQuestion : "illimité tant que le
-- compte existe" -- PAS de plafond de durée, contrairement à l'alternative "24h max" proposée et
-- refusée). Complète (ne remplace pas) le rattrapage "Phase 1" 100% client de core/game-core.js
-- (OFFLINE_CATCHUP_CAP_HOURS/computeOfflineElapsedHours/computeOfflineCatchupSilver/
-- computeOfflineCatchupXp/computeOfflineCatchupLoot, voir leurs commentaires) : Phase 1 ne se
-- déclenche QUE quand le joueur rouvre l'onglet (plafonné 24h) -- un compte abandonné/inactif ne
-- reçoit donc jamais rien tant que personne ne se reconnecte. Phase 2 crédite CHAQUE HEURE, pour
-- CHAQUE compte ayant une ligne game_saves, le montant qu'aurait produit exactement 1h de Phase 1
-- (même taux perso bestSilverPerHour/bestXpPerHour/bestKpm, même table de loot réelle de la zone),
-- directement dans save_data -- sans jamais attendre une reconnexion.
--
-- ---- Couverture tests ----
-- credit_offline_progress_hourly()/offline_credit_add_item() (plpgsql, ci-dessous) ne sont PAS
-- couverts par un test automatisé de ce repo : tests/tests.js (window.runRegressionTests(),
-- navigateur) et tests/*.spec.js (Playwright, pilote le jeu réel) tournent tous les deux côté
-- client, aucun des deux pipelines ne peut exécuter du SQL contre une vraie base Postgres (voir
-- CLAUDE.md §11, même limitation déjà documentée pour scripts/announce-patch-note.js -- un script
-- Node CI qui n'est testable dans aucun des deux pipelines existants plutôt que de forcer un test
-- inadapté). Ce qui EST testable et l'est réellement (tests/tests.js) : la logique PURE
-- côté client qui dépend de ce changement --
-- testComputeOfflineElapsedHoursUsesMoreRecentOfSavedAtAndServerCredit (baseline
-- savedAt/lastServerCreditAt, core/game-core.js) et testOfflineCreditZoneLootTableMatchesClientZonesData
-- (garde-fou anti-désynchronisation de la table dupliquée ci-dessous contre ZONES/GEAR_TIERS
-- réels). La logique SQL elle-même a été relue à la main formule par formule contre
-- computeOfflineCatchupSilver/Xp/Loot et gainXp() (core/game-core.js, combat/loot-rolls.js) --
-- voir le rapport de cette tâche pour le détail de ce qui a pu/n'a pas pu être vérifié
-- localement (application de la migration + invocation manuelle de la fonction).
--
-- ---- Architecture : pg_cron -> fonction plpgsql (PAS d'Edge Function) ----
-- Même schéma que le tournoi PvP Compagnons (20260722090000_companion_pvp_tournament.sql, lu comme
-- référence explicite pour cette migration) : le calcul est un pur traitement base de données (lire
-- save_data JSONB, appliquer les mêmes formules que Phase 1, réécrire save_data), sans appel réseau
-- externe nécessaire -- pas de saut HTTP inutile, pas de 2e surface d'auth à sécuriser. Il n'existe
-- aujourd'hui AUCUNE Edge Function versionnée dans ce repo (supabase/functions/ n'existe pas --
-- notify_cheat_discord() appelle bien une Edge Function 'discord-cheat-log', mais déployée hors
-- dépôt via le dashboard, aucun précédent de code source à suivre) : introduire une toute première
-- Edge Function juste pour ce job aurait été un nouveau pattern architectural non justifié par un
-- vrai besoin (pas d'I/O externe ici), alors que le pattern pg_cron+plpgsql est déjà éprouvé en
-- production sur ce projet. Contrairement au tournoi PvP, AUCUN repli "premier client connecté"
-- n'est nécessaire ici : si pg_cron ne tourne pas pendant un moment, les comptes ne perdent rien
-- (Phase 1 côté client comble tout gap via last_server_credit_at, voir plus bas) -- inutile
-- d'exposer une RPC de secours appelable par un client, la fonction reste 100% interne (voir
-- REVOKE en fin de fichier, fermée à anon/authenticated/public dès cette migration -- contrairement
-- au tournoi PvP qui a dû être fermé après coup dans une 2e migration de lockdown, on le fait ici
-- directement dès la création).
--
-- ---- Table de loot des zones : DUPLICATION MINIMALE ASSUMÉE, PAS d'import direct ----
-- computeOfflineCatchupLoot() (game-core.js) lit la vraie table de loot par zone (src/world/
-- zones-data.js, ZONES[].loot.mat/.craft) + le palier de stuff associé (src/world/gear-tiers-data.js,
-- GEAR_TIERS[].material, via gearTierForZone()). Ce projet n'a ni bundler ni système de modules
-- (pas d'import/export, CLAUDE.md §7) : zones-data.js est un `const ZONES = [...]` de portée
-- globale, chargé par balise <script> dans une page HTML -- rien à "importer" côté Postgres, et
-- comme ci-dessus, introduire une Edge Function juste pour lire ce fichier n'aurait aucun autre
-- usage que cette seule fonction. Duplication MINIMALE assumée (table ci-dessous, 16 lignes) :
-- UNIQUEMENT les nombres de chance de drop / valeur / noms, JAMAIS les icônes (SVG générées par
-- inventory/gear-icons.js, non-triviales à dupliquer et sans enjeu économique/anti-triche -- une
-- icône manquante retombe sur le fallback '❔' déjà existant côté client, voir inventory-ui.js
-- lignes 493/566/1800, et cet écart ne peut de toute façon quasiment jamais se produire en
-- pratique : computeOfflineCatchupLoot() n'estime jamais rien tant que bestKpm==0, qui exige déjà
-- 2 minutes de session réelle -- largement de quoi avoir déjà looté au moins 1 exemplaire du
-- matériau de son propre palier par la voie normale).
-- ⚠️ RISQUE DE DÉSYNCHRONISATION CONNU ET ASSUMÉ ⚠️ : si zones-data.js (ZONES[].loot.mat/.craft) ou
-- gear-tiers-data.js (GEAR_TIERS[].material) sont un jour rééquilibrés, CETTE TABLE DOIT ÊTRE MISE
-- À JOUR MANUELLEMENT (nouvelle migration, ne jamais modifier celle-ci une fois appliquée -- voir
-- CLAUDE.md §12). Un garde-fou existe côté client : tests/tests.js contient un test de régression
-- (testOfflineCreditZoneLootTableMatchesClientZonesData) qui compare cette table à ZONES/GEAR_TIERS
-- à l'exécution et échoue si elles divergent -- si ce test casse après un rééquilibrage économique,
-- c'est le signal explicite qu'une migration corrective de cette table est due.
create table if not exists public.offline_credit_zone_loot (
  zone_idx int primary key,
  mat_name text not null,
  mat_color text not null,
  mat_val numeric not null,
  mat_ch numeric not null,
  craft_name text not null,
  craft_ch numeric not null
);
alter table public.offline_credit_zone_loot enable row level security;
-- aucune policy : donnée non sensible mais aucun client n'a besoin d'y accéder directement (lue
-- uniquement par credit_offline_progress_hourly(), SECURITY DEFINER, qui contourne RLS) -- RLS
-- activé sans policy bloque tout accès direct par défaut, même principe que market_orders/
-- bot_state/link_codes (voir schema_snapshot_tables_and_policies.md, "Tables sans policy").

-- Transcription manuelle de ZONES[].loot.mat/.craft (src/world/zones-data.js) + GEAR_TIERS[].material
-- (src/world/gear-tiers-data.js, résolu via gearTierForZone()) au 2026-07-14 :
--   grey  (zones 0,1,2,12)  -> matériau 'Pierre de Novice'  #b8b8b8
--   white (zones 3,4,5,13)  -> matériau 'Pierre du Temps'   #cfd8dc
--   green (zones 6,7,8,14)  -> matériau 'Pierre Noire'      #7aa35e
--   blue  (zones 9,10,11,15)-> matériau 'Pierre concentrée' #6ea3c9
insert into public.offline_credit_zone_loot (zone_idx, mat_name, mat_color, mat_val, mat_ch, craft_name, craft_ch) values
  (0,  'Pierre de Novice',  '#b8b8b8', 1,  0.55,   'Poussière d''esprit ancien', 0.03),
  (1,  'Pierre de Novice',  '#b8b8b8', 1,  0.48,   'Poussière d''esprit ancien', 0.026),
  (2,  'Pierre de Novice',  '#b8b8b8', 1,  0.4,    'Poussière d''esprit ancien', 0.022),
  (3,  'Pierre du Temps',   '#cfd8dc', 1,  0.32,   'Poussière d''esprit ancien', 0.018),
  (4,  'Pierre du Temps',   '#cfd8dc', 1,  0.26,   'Poussière d''esprit ancien', 0.015),
  (5,  'Pierre du Temps',   '#cfd8dc', 4,  0.2,    'Poussière d''esprit ancien', 0.012),
  (6,  'Pierre Noire',      '#7aa35e', 11, 0.15,   'Fragment de mémoire',       0.009),
  (7,  'Pierre Noire',      '#7aa35e', 11, 0.11,   'Fragment de mémoire',       0.007),
  (8,  'Pierre Noire',      '#7aa35e', 9,  0.08,   'Fragment de mémoire',       0.005),
  (9,  'Pierre concentrée', '#6ea3c9', 7,  0.12,   'Marbre du Dieu déchu',      0.0035),
  (10, 'Pierre concentrée', '#6ea3c9', 6,  0.09,   'Marbre du Dieu déchu',      0.0025),
  (11, 'Pierre concentrée', '#6ea3c9', 5,  0.07,   'Marbre du Dieu déchu',      0.0018),
  (12, 'Pierre de Novice',  '#b8b8b8', 1,  0.34,   'Poussière d''esprit ancien', 0.019),
  (13, 'Pierre du Temps',   '#cfd8dc', 5,  0.14,   'Poussière d''esprit ancien', 0.009),
  (14, 'Pierre Noire',      '#7aa35e', 8,  0.058,  'Fragment de mémoire',       0.003),
  (15, 'Pierre concentrée', '#6ea3c9', 4,  0.055,  'Marbre du Dieu déchu',      0.0013)
on conflict (zone_idx) do update set
  mat_name = excluded.mat_name, mat_color = excluded.mat_color, mat_val = excluded.mat_val,
  mat_ch = excluded.mat_ch, craft_name = excluded.craft_name, craft_ch = excluded.craft_ch;

-- ============================================================
-- game_saves.last_server_credit_at : horodatage du dernier crédit HORAIRE SERVEUR, distinct de
-- save_data.savedAt (horodatage du dernier ENREGISTREMENT CLIENT, à l'intérieur du JSONB). Colonne
-- séparée de save_data à dessein : saveToCloud() (game-supabase.js) fait un upsert qui ne fournit
-- QUE {user_id, save_data} -- une colonne non listée dans un upsert Postgres/PostgREST n'est jamais
-- écrasée, donc last_server_credit_at survit intact à chaque sauvegarde client normale, sans
-- modification du chemin de sauvegarde existant.
-- Anti double-crédit bout-en-bout (voir aussi la garde temporelle dans credit_offline_progress_hourly
-- plus bas, qui empêche le cron LUI-MÊME de créditer 2x le même compte en moins d'1h) : au
-- rechargement d'une sauvegarde, le CLIENT doit utiliser le PLUS RÉCENT de save_data.savedAt et de
-- cette colonne comme point de départ de son propre rattrapage Phase 1 -- sinon Phase 1 recompterait
-- des heures déjà créditées par Phase 2. Voir la modification de computeOfflineElapsedHours()
-- (core/game-core.js) et de loadCloudSave() (backend/game-supabase.js, sélectionne désormais cette
-- colonne en plus de save_data et l'attache à l'objet transmis à applySaveState) dans le même commit
-- que cette migration.
alter table public.game_saves add column if not exists last_server_credit_at timestamptz;

-- ============================================================
-- Ajoute qty unités de l'objet stackable (name/val/kind/key/color) dans le tableau JSONB `p_inv`
-- (save_data.INV) : miroir exact d'invAdd() (core/game-core.js) -- fusionne dans un stack existant
-- (même `name`, qty < 999999 = MAX_STACK) si trouvé, sinon prend le premier slot `null`, sinon
-- retourne le tableau INCHANGÉ (sac plein, 192 cases -- même comportement que invAdd() qui renvoie
-- `false` sans throw et sans rien créditer, voir applySaveState()/offlineLootItems.forEach). `icon`
-- est volontairement laissé vide ('') plutôt que de tenter de dupliquer les icônes SVG générées par
-- inventory/gear-icons.js (voir commentaire en tête de fichier) -- fallback client déjà existant
-- ('❔', inventory-ui.js), jamais une erreur d'affichage.
create or replace function public.offline_credit_add_item(
  p_inv jsonb, p_name text, p_val numeric, p_color text, p_kind text, p_key text, p_qty numeric
) returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_len int;
  v_i int;
  v_slot jsonb;
  v_free_idx int := null;
begin
  if p_qty is null or p_qty <= 0 or p_inv is null or jsonb_typeof(p_inv) <> 'array' then
    return coalesce(p_inv, '[]'::jsonb);
  end if;
  v_len := jsonb_array_length(p_inv);
  for v_i in 0 .. v_len - 1 loop
    v_slot := p_inv -> v_i;
    if v_slot is not null and jsonb_typeof(v_slot) = 'object'
       and coalesce((v_slot->>'stackable')::boolean, false)
       and (v_slot->>'name') = p_name
       and coalesce((v_slot->>'qty')::numeric, 0) < 999999 then
      return jsonb_set(p_inv, array[v_i::text, 'qty'], to_jsonb(coalesce((v_slot->>'qty')::numeric, 0) + p_qty));
    end if;
    if v_free_idx is null and (v_slot is null or jsonb_typeof(v_slot) = 'null') then
      v_free_idx := v_i;
    end if;
  end loop;
  if v_free_idx is null then
    return p_inv; -- sac plein -- objet silencieusement non crédité, même comportement qu'invAdd() côté client
  end if;
  return jsonb_set(p_inv, array[v_free_idx::text], jsonb_build_object(
    'name', p_name, 'val', p_val, 'kind', p_kind, 'key', p_key, 'icon', '', 'color', p_color,
    'stackable', true, 'qty', p_qty, 'weight', 0.1, 'pickedAt', (extract(epoch from now())*1000)::bigint
  ));
end;
$$;
revoke execute on function public.offline_credit_add_item(jsonb,text,numeric,text,text,text,numeric) from public;
revoke execute on function public.offline_credit_add_item(jsonb,text,numeric,text,text,text,numeric) from anon;
revoke execute on function public.offline_credit_add_item(jsonb,text,numeric,text,text,text,numeric) from authenticated;
-- jamais appelée par un client -- fonction interne à credit_offline_progress_hourly() ci-dessous.

-- ============================================================
-- Cœur de Phase 2 : crédite 1h de rattrapage hors-ligne (silver/XP/loot) à CHAQUE compte
-- game_saves, selon EXACTEMENT les mêmes formules que Phase 1 pour hours=1 (voir
-- computeOfflineCatchupSilver/Xp/Loot, core/game-core.js) :
--   silver_gain = round(bestSilverPerHour × 1)     (Math.round(rate*hours), hours=1)
--   xp_gain     = round(bestXpPerHour × 1)
--   kills       = bestKpm × 1 × 60                  (kpm × hours × 60, hours=1)
--   qty         = floor(kills × chance_de_drop_de_la_zone)   (mat + craft, jamais trash/jackpot/gear)
-- Aucun plafond de durée/nombre de crédits consécutifs (demande explicite du owner : "illimité tant
-- que le compte existe", voir tout en haut de ce fichier) -- CE cron tourne indéfiniment, une fois
-- par heure, pour tout compte avec une ligne game_saves non vide, sans jamais s'arrêter de lui-même.
--
-- ---- Filet anti-triche (instruction explicite de la tâche : "ne pas laisser ce nouveau chemin
-- contourner la protection existante") ----
-- 1) Les 3 taux personnels lus depuis save_data (bestSilverPerHour/bestXpPerHour/bestKpm) sont des
--    champs JSONB 100% côté client -- clamp_game_save() (20260714170000_clamp_game_save.sql)
--    borne déjà silver/silverEarned/tokenSilverEarned/lvl/loyalty/enhLv sur CETTE MÊME TABLE, mais
--    PAS ces 3 taux (jusqu'à cette migration -- voir 20260722120500_clamp_game_save_rate_fields.sql,
--    appliquée dans la foulée, qui étend clamp_game_save() pour les borner aussi désormais). Cette
--    fonction-ci NE FAIT PAS CONFIANCE à clamp_game_save() pour les lignes déjà en base AVANT cette
--    date (un trigger ne s'applique que sur écriture, jamais rétroactivement) : les 3 taux sont
--    RE-bornés ici, en lecture, aux mêmes valeurs que le filet déjà existant sur player_stats
--    (clamp_player_stats(), schema_snapshot_functions.sql) : silver_per_hour ≤ 5×10⁹, best_kpm ≤ 500.
--    Aucune borne équivalente n'existait nulle part pour un "xp/h" -- bornée ici à 2×10⁸/h, dérivée
--    du pire cas légitime déjà possible avec les AUTRES bornes ci-dessus : 500 kills/min (borne
--    best_kpm) × 60 × 560 xp (mob le plus généreux du jeu, Forêt de Polly, zones-data.js) ≈
--    16,8×10⁶ xp/h, marge ×~12 pour absorber une future zone plus généreuse sans re-migration.
-- 2) Le crédit final passe par un UPDATE normal sur game_saves -> le trigger clamp_game_save_trigger
--    (BEFORE UPDATE, déjà en place) s'applique automatiquement à CET UPDATE comme à n'importe quel
--    autre, sans aucune logique dupliquée ici -- double filet silver/lvl déjà garanti.
-- 3) Garde temporelle anti double-crédit : si last_server_credit_at date de moins de 55 minutes,
--    la ligne est ignorée pour cette exécution (protège contre un ré-appel manuel rapproché pendant
--    un test, ou un chevauchement improbable de 2 exécutions pg_cron).
create or replace function public.credit_offline_progress_hourly()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  -- transcription de LEVEL_XP_TABLE (src/progression/level-xp-data.js) -- 72 valeurs, INDEXÉE À 1
  -- (Postgres) alors que le JS est indexé à 0 : v_level_xp[i] (Postgres) == LEVEL_XP_TABLE[i-1] (JS).
  -- xpNeededFor(lvl) en JS = LEVEL_XP_TABLE[min(lvl, 71)] => ici v_level_xp[least(lvl,71)+1].
  -- Donnée pure, jamais retouchée depuis son introduction (courbe réelle BDO) -- risque de dérive
  -- très faible, mais même principe de vigilance que la table de loot ci-dessus si jamais modifiée.
  v_level_xp numeric[] := array[
    1,1,1,1,1,161,472,1181,2626,5319,10005,17721,29865,48273,75300,113911,167777,241381,340127,
    470464,640005,857666,1133804,1480364,1911035,2441411,3089163,3874210,4818908,5948238,7290005,
    8875042,10737423,12914685,15448049,18382661,21767828,25657269,30109369,35187443,40960005,
    47501047,54890322,63213635,72563144,83037661,94742974,118571374,158997683,207619316,415238632,
    830477264,1245715896,1868573844,2802860766,8408582298,21021455745,52553639363,105107278725,
    210214557450,630643672350,1261287344700,2522574689400,5045149378800,10090298757600,
    20180597515200,40361195000000,80722390000000,161444780000000,322889560000000,645779120000000,
    1291558200000000
  ];
  v_max_silver_per_hour constant numeric := 5000000000;  -- = clamp_player_stats().silver_per_hour
  v_max_kpm constant numeric := 500;                      -- = clamp_player_stats().best_kpm
  v_max_xp_per_hour constant numeric := 200000000;        -- dérivé, voir commentaire ci-dessus
  rec record;
  v_save jsonb;
  v_s jsonb;
  v_inv jsonb;
  v_rate_silver numeric;
  v_rate_kpm numeric;
  v_rate_xp numeric;
  v_silver_gain numeric;
  v_xp_gain numeric;
  v_zone_idx int;
  v_kills numeric;
  v_loot record;
  v_qty_mat numeric;
  v_qty_craft numeric;
  v_lvl int;
  v_xp numeric;
  v_xpnext numeric;
  v_iter int;
begin
  for rec in
    select user_id, save_data, last_server_credit_at
    from public.game_saves
    where save_data is not null and save_data <> '{}'::jsonb
  loop
    -- garde anti double-crédit (voir point 3 ci-dessus) : jamais 2 crédits < 55 min d'intervalle
    if rec.last_server_credit_at is not null and rec.last_server_credit_at > now() - interval '55 minutes' then
      continue;
    end if;

    v_save := rec.save_data;
    v_s := v_save->'S';
    if v_s is null or jsonb_typeof(v_s) <> 'object' then
      continue; -- sauvegarde malformée/vide -- rien à créditer, pas de crash
    end if;

    v_rate_silver := least(greatest(coalesce((v_s->>'bestSilverPerHour')::numeric, 0), 0), v_max_silver_per_hour);
    v_rate_kpm    := least(greatest(coalesce((v_s->>'bestKpm')::numeric, 0), 0), v_max_kpm);
    v_rate_xp     := least(greatest(coalesce((v_s->>'bestXpPerHour')::numeric, 0), 0), v_max_xp_per_hour);

    if v_rate_silver <= 0 and v_rate_xp <= 0 and v_rate_kpm <= 0 then
      -- rien à créditer (nouveau perso jamais encore éligible à un record, voir Phase 1) -- on
      -- avance quand même last_server_credit_at pour éviter de rescanner cette ligne à chaque
      -- exécution horaire tant qu'elle reste à 0 partout (coût marginal, mais autant l'éviter).
      update public.game_saves set last_server_credit_at = now() where user_id = rec.user_id;
      continue;
    end if;

    -- ---- silver (miroir de computeOfflineCatchupSilver, hours=1) ----
    v_silver_gain := round(v_rate_silver);
    if v_silver_gain > 0 then
      v_s := jsonb_set(v_s, '{silver}', to_jsonb(coalesce((v_s->>'silver')::numeric, 0) + v_silver_gain));
      v_s := jsonb_set(v_s, '{silverEarned}', to_jsonb(coalesce((v_s->>'silverEarned')::numeric, 0) + v_silver_gain));
    end if;

    -- ---- XP + cascade de niveau (miroir de computeOfflineCatchupXp + gainXp(), loot-rolls.js) ----
    v_xp_gain := round(v_rate_xp);
    if v_xp_gain > 0 then
      v_s := jsonb_set(v_s, '{xpEarned}', to_jsonb(coalesce((v_s->>'xpEarned')::numeric, 0) + v_xp_gain));
      v_lvl := coalesce((v_s->>'lvl')::int, 1);
      v_xp := coalesce((v_s->>'xp')::numeric, 0) + v_xp_gain;
      v_xpnext := v_level_xp[least(v_lvl,71)+1];
      v_iter := 0;
      -- même boucle que gainXp() : "while (S.xp >= S.xpNext)", jamais un simple if (un gros crédit
      -- peut faire monter plusieurs niveaux). v_iter borne à 200 itérations par pure sécurité
      -- défensive (lvl<100 déjà suffisant en théorie, ceinture-bretelles contre une boucle infinie
      -- si jamais une valeur de la table venait à être <= 0).
      while v_xp >= v_xpnext and v_lvl < 100 and v_iter < 200 loop
        v_xp := v_xp - v_xpnext;
        v_lvl := v_lvl + 1;
        v_xpnext := v_level_xp[least(v_lvl,71)+1];
        v_iter := v_iter + 1;
      end loop;
      v_s := jsonb_set(v_s, '{xp}', to_jsonb(v_xp));
      v_s := jsonb_set(v_s, '{lvl}', to_jsonb(v_lvl));
      v_s := jsonb_set(v_s, '{xpNext}', to_jsonb(v_xpnext));
      -- hpMaxFor(lvl) = 100 + 8*(lvl-1) (core/game-core.js) -- forme close plutôt que += 8 par
      -- itération : évite toute dérive si S.hpMax stocké était déjà incohérent avec S.lvl.
      v_s := jsonb_set(v_s, '{hpMax}', to_jsonb(100 + 8*greatest(v_lvl-1,0)));
    end if;

    v_save := jsonb_set(v_save, '{S}', v_s);

    -- ---- loot matériau + craft (miroir de computeOfflineCatchupLoot, hours=1 -> kills=kpm×60) ----
    if v_rate_kpm > 0 then
      v_zone_idx := coalesce((v_save->>'zoneIdx')::int, 0);
      select * into v_loot from public.offline_credit_zone_loot where zone_idx = v_zone_idx;
      if found then
        v_kills := v_rate_kpm * 60;
        v_qty_mat := floor(v_kills * v_loot.mat_ch);
        v_qty_craft := floor(v_kills * v_loot.craft_ch);
        if v_qty_mat > 0 or v_qty_craft > 0 then
          v_inv := coalesce(v_save->'INV', '[]'::jsonb);
          if v_qty_mat > 0 then
            v_inv := public.offline_credit_add_item(v_inv, v_loot.mat_name, v_loot.mat_val, v_loot.mat_color, 'material', 'mat_'||v_loot.mat_name, v_qty_mat);
          end if;
          if v_qty_craft > 0 then
            -- icône/couleur du craft codées EN DUR côté client aussi (computeOfflineCatchupLoot,
            -- game-core.js : icon:'✦', color:'#b48ce8'), pas une donnée de zones-data.js -- aucune
            -- duplication supplémentaire nécessaire pour ces 2 valeurs précises.
            v_inv := public.offline_credit_add_item(v_inv, v_loot.craft_name, 0, '#b48ce8', 'craft', 'craft_'||v_loot.craft_name, v_qty_craft);
          end if;
          v_save := jsonb_set(v_save, '{INV}', v_inv);
        end if;
      end if;
    end if;

    -- écriture -- déclenche clamp_game_save_trigger (filet anti-triche existant, point 2 ci-dessus)
    update public.game_saves
      set save_data = v_save, last_server_credit_at = now()
      where user_id = rec.user_id;

    if v_silver_gain > 0 then
      -- 'offline_catchup' déjà whitelisté par silver_ledger_category_check (voir
      -- 20260721220000_silver_ledger_offline_catchup_category.sql) -- même catégorie que le
      -- rattrapage Phase 1 client, distinguée seulement par la note ci-dessous dans l'audit.
      insert into public.silver_ledger(user_id, delta, category, note)
        values (rec.user_id, v_silver_gain, 'offline_catchup', 'Rattrapage hors ligne serveur (cron horaire)');
    end if;
  end loop;
end;
$$;

-- Fermeture immédiate à anon/authenticated/public (voir commentaire d'architecture en tête de
-- fichier -- Postgres accorde EXECUTE à PUBLIC par défaut sur toute fonction nouvellement créée,
-- même piège déjà rencontré pour delete_my_account et le tournoi PvP, corrigé ICI dès la création
-- plutôt que dans une 2e migration de lockdown) : cette fonction n'a besoin que de pg_cron, jamais
-- d'un appel client -- contrairement à resolve_pvp_tournament_if_due() qui garde un repli client
-- volontaire, aucun repli n'est nécessaire ici (voir raisonnement en tête de fichier).
revoke execute on function public.credit_offline_progress_hourly() from public;
revoke execute on function public.credit_offline_progress_hourly() from anon;
revoke execute on function public.credit_offline_progress_hourly() from authenticated;

-- pg_cron : toutes les heures pile (minute 0). Extension déjà activée par la migration du tournoi
-- PvP (20260722090000) -- IF NOT EXISTS conservé pour l'idempotence si cette migration était un
-- jour rejouée seule dans un nouvel environnement. cron.schedule() fait un upsert par jobname :
-- ré-exécuter cette ligne ne crée jamais de doublon de job.
create extension if not exists pg_cron;
select cron.schedule(
  'offline-progress-hourly-credit',
  '0 * * * *',
  $$select public.credit_offline_progress_hourly();$$
);
