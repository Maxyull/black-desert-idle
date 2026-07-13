-- Tournoi PvP Compagnons quotidien, asynchrone (2026-07-13, demande explicite confirmée via
-- AskUserQuestion : "je crée et applique maintenant une vraie migration Supabase en PRODUCTION
-- pour le tournoi PvP"). Remplace la promesse "bientôt disponible" de src/companions/pvp.js par
-- un vrai tournoi à élimination directe, résolu automatiquement à 21h Europe/Paris.
--
-- Pas de combat temps réel joueur-contre-joueur (toujours pas de serveur autoritaire pour ça,
-- voir pvp.js) : l'équipe engagée est un SNAPSHOT figé au moment de l'inscription (les pets
-- restent 100% locaux, voir README.md "économie fermée") — le serveur ne peut PAS recalculer
-- l'équipe lui-même, il valide seulement la forme des données envoyées par le client et les
-- enregistre pour auth.uid() (jamais un user_id arbitraire).
--
-- Résolution automatique : pg_cron est disponible sur ce projet (voir list_extensions, jamais
-- installé avant cette migration) — choisi plutôt qu'une Edge Function + cron HTTP, pour 2
-- raisons : (1) la logique de résolution est un calcul pur base de données (lire les inscriptions,
-- construire un bracket, tirer des combats pondérés, écrire le résultat) qui n'a besoin d'aucun
-- appel réseau externe, donc pas de saut HTTP inutile ni de 2e surface d'auth à sécuriser ; (2)
-- Postgres connaît nativement le fuseau 'Europe/Paris' (base de données tz à jour, DST géré tout
-- seul) — un cron Edge Function aurait dû soit tourner en UTC fixe (recalage manuel 2x/an à
-- l'heure d'été/hiver, piège documenté dans le prompt de cette tâche) soit réimplémenter le calcul
-- de décalage Paris en JS. resolve_pvp_tournament_if_due() compare le NOW() Paris courant à
-- l'heure de fermeture (jour + 21h), donc s'adapte automatiquement au changement d'heure.
-- Défense en profondeur : la RPC de résolution reste aussi appelable manuellement par un client
-- (garde anti-double-résolution par UPDATE...WHERE status='open' atomique) — si jamais pg_cron
-- ne tournait pas pour une raison quelconque, le tout premier client qui se connecte après 21h
-- déclenche quand même la résolution.

-- ============================================================
-- TABLES
-- ============================================================

-- Une ligne par joueur inscrit pour un jour donné. `day` = le jour Paris dont la fermeture des
-- inscriptions (21h) déclenche CE tournoi -- si l'inscription arrive après 21h Paris, elle vise
-- automatiquement le jour SUIVANT (voir register_pvp_team ci-dessous).
create table if not exists public.companion_pvp_registrations (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  team jsonb not null,            -- snapshot figé : [{id,name,rarity,tier,section,atk,def,spd,eva}]
  team_power numeric not null,    -- calculé côté client (computeTeamPower(), pvp-tournament.js)
  registered_at timestamptz not null default now(),
  primary key (user_id, day)
);
create index if not exists companion_pvp_registrations_day_idx on public.companion_pvp_registrations(day);
alter table public.companion_pvp_registrations enable row level security;
-- équipe privée -- un adversaire ne doit pas pouvoir consulter la composition de l'autre AVANT la
-- résolution (spoiler de stratégie) ; après résolution, le détail round-par-round vient du bracket
-- stocké sur companion_pvp_tournaments (public une fois résolu), pas de cette table.
create policy companion_pvp_registrations_own on public.companion_pvp_registrations
  for select using (user_id = (select auth.uid()));
-- écriture uniquement via RPC security definer (register_pvp_team) -- jamais d'insert/update direct.

-- Un tournoi par jour Paris. status: 'open' (inscriptions en cours) -> 'resolving' (verrou anti
-- double-résolution, transitoire) -> 'resolved'.
create table if not exists public.companion_pvp_tournaments (
  day date primary key,
  status text not null default 'open' check (status in ('open','resolving','resolved')),
  bracket jsonb,               -- {size, entrants:[...], rounds:[[{a,b,winner_user_id,a_score,b_score}...]...]}
  winner_user_id uuid,
  winner_pseudo text,
  registrant_count int not null default 0,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.companion_pvp_tournaments enable row level security;
-- lecture publique -- un bracket résolu doit être consultable par TOUS les participants (spec :
-- "chaque participant peut voir le bracket complet de son tournoi, pas seulement son propre
-- parcours"), le plus simple et le plus proche d'un vrai tableau de tournoi public est une lecture
-- ouverte à tout compte authentifié (le contenu tant que status='open' ne contient de toute façon
-- aucune donnée sensible : juste day/status/registrant_count, bracket reste null).
create policy companion_pvp_tournaments_select on public.companion_pvp_tournaments
  for select using (true);
-- écriture uniquement via les fonctions SECURITY DEFINER ci-dessous.

-- ============================================================
-- RPC — inscription
-- ============================================================

drop function if exists public.register_pvp_team(jsonb, numeric);
create or replace function public.register_pvp_team(p_team jsonb, p_team_power numeric)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_paris_ts timestamp;
  v_day date;
  v_elem jsonb;
  v_status text;
  v_power numeric;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_team is null or jsonb_typeof(p_team) is distinct from 'array' then
    raise exception 'Équipe invalide';
  end if;
  if jsonb_array_length(p_team) < 1 then
    raise exception 'Aucun familier déployé -- inscription impossible';
  end if;
  -- 8 sections au maximum aujourd'hui (voir SECTIONS, src/companions/catalog.js) -- 1 pet déployé
  -- par section max, donc 8 pets engagés au maximum. Marge à 16 pour ne pas casser l'inscription
  -- si une future section est ajoutée sans repasser par cette migration.
  if jsonb_array_length(p_team) > 16 then
    raise exception 'Équipe trop grande';
  end if;
  -- validation de forme minimale de chaque membre (pas de recalcul possible côté serveur -- les
  -- pets restent 100% locaux, voir README.md "économie fermée") : id/nom présents, stats numériques.
  for v_elem in select * from jsonb_array_elements(p_team) loop
    if not (v_elem ? 'name') or not (v_elem ? 'atk') or not (v_elem ? 'def')
       or not (v_elem ? 'spd') or not (v_elem ? 'eva') or not (v_elem ? 'section') then
      raise exception 'Membre d''équipe mal formé';
    end if;
    if jsonb_typeof(v_elem->'atk') is distinct from 'number'
       or jsonb_typeof(v_elem->'def') is distinct from 'number'
       or jsonb_typeof(v_elem->'spd') is distinct from 'number'
       or jsonb_typeof(v_elem->'eva') is distinct from 'number' then
      raise exception 'Statistiques d''équipe invalides';
    end if;
  end loop;

  -- bornée [0, 10000] -- 8 pets à normGS max théorique (1000) pondéré ne peut jamais dépasser ça
  -- en pratique (voir computeTeamPower()), simple garde-fou anti-valeur aberrante (pas une
  -- économie réelle en jeu ici, juste un classement -- même esprit que clamp_player_stats mais
  -- sans notification Discord, l'enjeu est cosmétique).
  v_power := least(greatest(coalesce(p_team_power, 0), 0), 10000);

  v_paris_ts := (now() at time zone 'Europe/Paris');
  -- inscriptions ouvertes en continu, ferment chaque jour à 21h Paris -- après cette heure,
  -- l'inscription vise automatiquement le jour SUIVANT (voir CLAUDE.md/prompt : "un compte à
  -- rebours affiche le temps restant avant fermeture").
  if v_paris_ts::time >= time '21:00' then
    v_day := v_paris_ts::date + 1;
  else
    v_day := v_paris_ts::date;
  end if;

  insert into public.companion_pvp_tournaments(day, status)
    values (v_day, 'open')
    on conflict (day) do nothing;

  select status into v_status from public.companion_pvp_tournaments where day = v_day;
  if v_status is distinct from 'open' then
    raise exception 'Inscriptions fermées pour ce tournoi';
  end if;

  insert into public.companion_pvp_registrations(user_id, day, team, team_power)
    values (auth.uid(), v_day, p_team, v_power)
  on conflict (user_id, day) do update set
    team = excluded.team, team_power = excluded.team_power, registered_at = now();

  update public.companion_pvp_tournaments
    set registrant_count = (select count(*) from public.companion_pvp_registrations where day = v_day)
    where day = v_day;

  return jsonb_build_object('day', v_day, 'status', 'open');
end;
$$;
grant execute on function public.register_pvp_team(jsonb, numeric) to authenticated;

-- Compte public d'inscrits pour un jour (jamais le détail des équipes -- voir RLS ci-dessus) :
-- utilisé par la carte "Tournoi du jour" (nombre de dresseurs déjà inscrits).
drop function if exists public.pvp_registrant_count(date);
create or replace function public.pvp_registrant_count(p_day date)
returns int
language sql security definer set search_path to 'public'
as $$
  select count(*)::int from public.companion_pvp_registrations where day = p_day;
$$;
grant execute on function public.pvp_registrant_count(date) to authenticated;

-- ============================================================
-- Résolution du bracket (pg_cron + repli "premier client connecté")
-- ============================================================

-- Simule UN combat (a contre b, b peut être NULL = bye -> a avance automatiquement). Probabilité
-- de victoire pondérée par l'écart relatif de puissance (pas un pur coin-flip, mais jamais 100%
-- déterministe non plus -- "un facteur aléatoire seedé raisonnable... toujours pondéré fortement
-- par la puissance réelle", voir prompt de cette tâche). Bornée [0.05, 0.95] : même l'équipe la
-- plus forte peut perdre un combat, même la plus faible garde une chance réelle.
drop function if exists public.pvp_simulate_match(jsonb, jsonb);
create or replace function public.pvp_simulate_match(a jsonb, b jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_pa numeric; v_pb numeric; v_p_a_win numeric; v_roll numeric; v_winner jsonb;
begin
  if a is null then return jsonb_build_object('a', a, 'b', b, 'winner_user_id', (b->>'user_id'), 'bye', true); end if;
  if b is null then return jsonb_build_object('a', a, 'b', b, 'winner_user_id', (a->>'user_id'), 'bye', true); end if;
  v_pa := (a->>'power')::numeric;
  v_pb := (b->>'power')::numeric;
  v_p_a_win := least(0.95, greatest(0.05, 0.5 + 0.45 * ((v_pa - v_pb) / (v_pa + v_pb + 1))));
  v_roll := random();
  if v_roll < v_p_a_win then v_winner := a; else v_winner := b; end if;
  return jsonb_build_object(
    'a', a, 'b', b, 'winner_user_id', (v_winner->>'user_id'),
    'a_win_probability', round(v_p_a_win, 3), 'roll', round(v_roll, 3), 'bye', false
  );
end;
$$;

-- Résout le tournoi du jour p_day s'il est encore 'open'/'resolving' : bracket à élimination
-- directe, taille = puissance de 2 la plus proche du nombre d'inscrits, byes pour les entrants
-- manquants (padding en fin de liste, ordre pseudo-mélangé par md5(day||user_id) -- déterministe
-- et rejouable en lecture, pas besoin d'un vrai RNG externe pour l'ordre du bracket, seul le
-- résultat de chaque combat est aléatoire via pvp_simulate_match()).
drop function if exists public.run_pvp_tournament(date);
create or replace function public.run_pvp_tournament(p_day date)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_claimed date;
  v_entrants jsonb;
  v_size int;
  v_n int;
  v_round jsonb;
  v_rounds jsonb := '[]'::jsonb;
  v_current jsonb;
  v_next jsonb;
  v_i int;
  v_match jsonb;
  v_winner_id uuid;
  v_winner_pseudo text;
begin
  -- verrou anti-double-résolution : un seul appelant peut faire basculer 'open'/'resolving' -> le
  -- SELECT...FOR UPDATE + UPDATE ci-dessous s'exécute dans une transaction atomique (fonction
  -- plpgsql = une transaction), donc deux appels concurrents (pg_cron ET un client "premier
  -- connecté après 21h") ne peuvent jamais résoudre le même jour deux fois.
  update public.companion_pvp_tournaments
    set status = 'resolving'
    where day = p_day and status = 'open'
    returning day into v_claimed;
  if v_claimed is null then
    return; -- déjà en cours de résolution par un autre appelant, ou déjà résolu, ou inexistant
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', r.user_id::text,
      'pseudo', coalesce(pr.pseudo, ps.display_name, '?'),
      'power', r.team_power,
      'team', r.team
    ) order by md5(p_day::text || r.user_id::text)), '[]'::jsonb)
    into v_entrants
    from public.companion_pvp_registrations r
    left join public.profiles pr on pr.user_id = r.user_id
    left join public.player_stats ps on ps.user_id = r.user_id
    where r.day = p_day;

  v_n := jsonb_array_length(v_entrants);

  if v_n = 0 then
    update public.companion_pvp_tournaments
      set status = 'resolved', bracket = jsonb_build_object('size', 0, 'entrants', '[]'::jsonb, 'rounds', '[]'::jsonb),
          winner_user_id = null, winner_pseudo = null, resolved_at = now()
      where day = p_day;
    return;
  end if;

  if v_n = 1 then
    v_winner_id := (v_entrants->0->>'user_id')::uuid;
    v_winner_pseudo := v_entrants->0->>'pseudo';
    update public.companion_pvp_tournaments
      set status = 'resolved',
          bracket = jsonb_build_object('size', 1, 'entrants', v_entrants, 'rounds', '[]'::jsonb),
          winner_user_id = v_winner_id, winner_pseudo = v_winner_pseudo, resolved_at = now()
      where day = p_day;
    return;
  end if;

  -- taille de bracket = puissance de 2 >= n, padding par des byes (null) en fin de liste
  v_size := 2 ^ ceil(log(2, v_n));
  v_current := v_entrants;
  for v_i in v_n + 1 .. v_size loop
    v_current := v_current || jsonb_build_array(null::jsonb);
  end loop;

  while jsonb_array_length(v_current) > 1 loop
    v_round := '[]'::jsonb;
    v_next := '[]'::jsonb;
    for v_i in 0 .. (jsonb_array_length(v_current) / 2) - 1 loop
      v_match := public.pvp_simulate_match(v_current -> (v_i*2), v_current -> (v_i*2+1));
      v_round := v_round || jsonb_build_array(v_match);
      -- fait avancer le GAGNANT (objet complet {user_id,pseudo,power}) au tour suivant, pas juste
      -- son id, pour que le prochain combat ait de nouveau accès à 'power'.
      if (v_match->>'winner_user_id') = coalesce(v_current -> (v_i*2) ->> 'user_id', '') then
        v_next := v_next || jsonb_build_array(v_current -> (v_i*2));
      else
        v_next := v_next || jsonb_build_array(v_current -> (v_i*2+1));
      end if;
    end loop;
    v_rounds := v_rounds || jsonb_build_array(v_round);
    v_current := v_next;
  end loop;

  v_winner_id := (v_current->0->>'user_id')::uuid;
  v_winner_pseudo := v_current->0->>'pseudo';

  update public.companion_pvp_tournaments
    set status = 'resolved',
        bracket = jsonb_build_object('size', v_size, 'entrants', v_entrants, 'rounds', v_rounds),
        winner_user_id = v_winner_id, winner_pseudo = v_winner_pseudo, resolved_at = now()
    where day = p_day;
end;
$$;
grant execute on function public.run_pvp_tournament(date) to authenticated;

-- Point d'entrée appelé par pg_cron (toutes les 5 min) ET par tout client authentifié en repli
-- (le premier qui se connecte après 21h Paris, si jamais pg_cron était indisponible) : résout
-- TOUS les tournois 'open' dont l'heure de fermeture (day + 21h Paris) est déjà passée. La boucle
-- couvre le cas d'un rattrapage après une coupure de plusieurs jours (peu probable mais gratuit à
-- couvrir vu la boucle déjà nécessaire).
drop function if exists public.resolve_pvp_tournament_if_due();
create or replace function public.resolve_pvp_tournament_if_due()
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_paris_ts timestamp;
  v_row record;
begin
  v_paris_ts := (now() at time zone 'Europe/Paris');
  for v_row in
    select day from public.companion_pvp_tournaments
    where status = 'open' and (day::timestamp + interval '21 hours') <= v_paris_ts
    order by day
  loop
    perform public.run_pvp_tournament(v_row.day);
  end loop;
end;
$$;
grant execute on function public.resolve_pvp_tournament_if_due() to authenticated;

-- pg_cron : toutes les 5 minutes, tente une résolution (no-op si rien n'est dû -- la boucle
-- ci-dessus ne fait rien si aucun tournoi 'open' n'a dépassé son 21h Paris). Activé ici (jamais
-- installé avant cette migration, voir list_extensions en tête de fichier).
-- cron.schedule() fait un upsert par jobname (documenté pg_cron) -- ré-exécuter cette ligne
-- (ex: si cette migration était un jour recréée à l'identique dans un nouvel environnement)
-- ne crée jamais de doublon de job.
create extension if not exists pg_cron;
select cron.schedule(
  'companion-pvp-tournament-resolve',
  '*/5 * * * *',
  $$select public.resolve_pvp_tournament_if_due();$$
);
