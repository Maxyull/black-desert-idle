-- ============================================================
-- Anti-triche (best-effort) — Velia Idle
-- Le jeu est "client-authoritative" : silver, gearscore, etc. sont calculés côté navigateur
-- puis envoyés au classement (player_stats) par un upsert direct. Un tricheur peut donc écrire
-- des valeurs arbitraires dans SA propre ligne via l'API. On ne peut pas l'empêcher totalement
-- sans réécrire toute la logique côté serveur, mais ce trigger REJETTE/BORNE les valeurs
-- manifestement impossibles pour garder un classement crédible.
--
-- Depuis le 2026-07-05 : chaque bornage réel envoie aussi une alerte sur un salon Discord dédié
-- (webhook appelé directement depuis Postgres via pg_net — jamais exposé au client).
--
-- Supabase > SQL Editor > New query > Run (après le schéma du classement)
-- ============================================================

create extension if not exists pg_net;

-- alerte Discord "triche" : envoyée quand le trigger doit borner une valeur manifestement
-- impossible. Le webhook est appelé directement depuis Postgres, en async (n'attend pas la
-- réponse de Discord, ne bloque jamais l'upsert du joueur même si Discord est lent/indisponible).
create or replace function public.notify_cheat_discord(p_user_id uuid, p_field text, p_submitted numeric, p_clamped numeric)
returns void
language plpgsql
as $$
declare
  -- 🔧 secret réel déjà appliqué côté Supabase — ne PAS remettre l'URL en clair ici (dépôt public) :
  -- remplace cette valeur par le vrai webhook uniquement en local avant de ré-exécuter ce script
  v_webhook text := '<WEBHOOK_DISCORD_TRICHE>'; -- voir Discord > salon > Paramètres > Intégrations > Webhooks
  v_pseudo text;
begin
  -- pseudo perso (profiles) en priorité, sinon le nom public du classement (player_stats)
  select coalesce(pr.pseudo, ps.display_name) into v_pseudo
  from (select p_user_id as user_id) u
  left join public.profiles pr on pr.user_id = u.user_id
  left join public.player_stats ps on ps.user_id = u.user_id;

  perform net.http_post(
    url := v_webhook,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'embeds', jsonb_build_array(jsonb_build_object(
        'title', '⚠️ Valeur anti-triche bornée',
        'description', concat(
          'Joueur : **', coalesce(v_pseudo, '?'), '** (`', p_user_id, '`)', chr(10),
          'Champ : **', p_field, '**', chr(10),
          'Envoyé : `', p_submitted, '` → Borné à : `', p_clamped, '`'
        ),
        'color', 15158332,
        'timestamp', now()
      ))
    )
  );
exception when others then
  -- ne jamais faire échouer la sauvegarde du joueur si Discord est indisponible
  null;
end;
$$;

-- SECURITY DEFINER : nécessaire pour lire auth.users depuis le trigger (un utilisateur normal
-- n'y a pas accès en direct)
create or replace function public.clamp_player_stats()
returns trigger
language plpgsql security definer
as $$
declare
  v_created timestamptz;
  v_max_playtime bigint;
  v_before numeric;
begin
  -- bornes dures : au-delà, c'est forcément de la triche (le jeu ne peut pas produire ça).
  -- chaque bornage RÉEL (valeur avant ≠ valeur après) déclenche une alerte Discord.
  v_before := coalesce(new.silver,0);
  new.silver := least(greatest(coalesce(new.silver,0), 0), 1000000000000);   -- 1 000 milliards max
  if v_before is distinct from new.silver then perform public.notify_cheat_discord(new.user_id, 'silver', v_before, new.silver); end if;

  v_before := coalesce(new.silver_per_hour,0);
  new.silver_per_hour := least(greatest(coalesce(new.silver_per_hour,0), 0), 5000000000); -- 5 milliards/h max
  if v_before is distinct from new.silver_per_hour then perform public.notify_cheat_discord(new.user_id, 'silver_per_hour', v_before, new.silver_per_hour); end if;

  v_before := coalesce(new.gearscore,0);
  new.gearscore := least(greatest(coalesce(new.gearscore,0), 0), 2000);          -- GS endgame ~500, marge large
  if v_before is distinct from new.gearscore then perform public.notify_cheat_discord(new.user_id, 'gearscore', v_before, new.gearscore); end if;

  v_before := coalesce(new.lvl,1);
  new.lvl := least(greatest(coalesce(new.lvl,1), 1), 100);                  -- niveau max de la table d'XP
  if v_before is distinct from new.lvl then perform public.notify_cheat_discord(new.user_id, 'lvl', v_before, new.lvl); end if;

  v_before := coalesce(new.best_zone_index,0);
  new.best_zone_index := least(greatest(coalesce(new.best_zone_index,0), 0), 50);
  if v_before is distinct from new.best_zone_index then perform public.notify_cheat_discord(new.user_id, 'best_zone_index', v_before, new.best_zone_index); end if;

  v_before := coalesce(new.best_item_count,0);
  new.best_item_count := least(greatest(coalesce(new.best_item_count,0), 0), 100000000);
  if v_before is distinct from new.best_item_count then perform public.notify_cheat_discord(new.user_id, 'best_item_count', v_before, new.best_item_count); end if;

  -- le temps de jeu ne peut pas dépasser le temps écoulé depuis la création du compte (+ marge)
  begin
    select created_at into v_created from auth.users where id = new.user_id;
  exception when others then v_created := null; -- si l'accès échoue, on retombe sur le cap absolu
  end;
  v_before := coalesce(new.playtime_sec,0);
  if v_created is not null then
    v_max_playtime := ceil(extract(epoch from (now() - v_created))) + 86400; -- +1 jour de marge
    new.playtime_sec := least(greatest(coalesce(new.playtime_sec,0), 0), v_max_playtime);
  else
    new.playtime_sec := least(greatest(coalesce(new.playtime_sec,0), 0), 40000000);
  end if;
  if v_before is distinct from new.playtime_sec then perform public.notify_cheat_discord(new.user_id, 'playtime_sec', v_before, new.playtime_sec); end if;

  return new;
end;
$$;

drop trigger if exists trg_clamp_player_stats on public.player_stats;
create trigger trg_clamp_player_stats
  before insert or update on public.player_stats
  for each row execute function public.clamp_player_stats();
