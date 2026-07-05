-- FAILLE CORRIGÉE le 2026-07-05 (issue GitHub #2) : ce fichier contenait le webhook Discord
-- "cheat" en clair (v_webhook ci-dessous) -- retiré retroactivement de ce fichier (le webhook
-- a été révoqué côté Discord et remplacé). La définition à jour de boss_claim() vit désormais
-- dans 20260705190100_boss_claim_via_edge_function.sql (appelle l'Edge Function
-- discord-cheat-log, qui lit le webhook depuis un secret Supabase).
--
-- Demande explicite du 2026-07-08 : l'alerte "tentative de double réclamation" (ajoutée en V139,
-- côté CLIENT via logToDiscord) partait sur le salon Discord GÉNÉRAL — elle doit aller sur le
-- salon "cheat" (celui déjà utilisé par notify_cheat_discord pour les bornages anti-triche).
-- Déplacé côté SERVEUR (dans boss_claim lui-même) plutôt que côté client : plus fiable (ne dépend
-- pas d'un appel client qui pourrait être sauté) et ne peut pas être usurpé. Ne déclenche l'alerte
-- QUE pour le vrai cas de double réclamation (déjà présent dans boss_claims) — pas pour les 2 autres
-- cas de retour -1 (boss pas encore mort, ou joueur n'ayant pas contribué), qui ne sont pas des
-- tentatives suspectes.
create or replace function public.boss_claim()
returns integer
language plpgsql security definer
as $$
declare
  v_uid uuid := auth.uid();
  v_key timestamptz;
  v_hp numeric;
  v_boss_id text;
  v_rank int;
  v_pseudo text;
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;
  select spawned_at, hp, boss_id into v_key, v_hp, v_boss_id from public.live_boss where id = 1;
  if v_key is null or coalesce(v_hp,1) > 0 then return -1; end if;
  if not exists (select 1 from public.boss_contributions where boss_key = v_key and user_id = v_uid) then return -1; end if;
  if exists (select 1 from public.boss_claims where boss_key = v_key and user_id = v_uid) then
    begin
      select coalesce(pr.pseudo, ps.display_name) into v_pseudo
      from (select v_uid as user_id) u
      left join public.profiles pr on pr.user_id = u.user_id
      left join public.player_stats ps on ps.user_id = u.user_id;
      perform net.http_post(
        url := 'https://mkwwvzbjtyawpcyrnybk.supabase.co/functions/v1/discord-cheat-log', -- voir 20260705190100
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
          'embeds', jsonb_build_array(jsonb_build_object(
            'title', '🚫 Tentative de double réclamation',
            'description', concat(
              'Joueur : **', coalesce(v_pseudo, '?'), '** (`', v_uid, '`)', chr(10),
              'Boss : **', coalesce(v_boss_id, '?'), '** (déjà payée) — bloqué'
            ),
            'color', 15548997,
            'timestamp', now()
          ))
        )
      );
    exception when others then null;
    end;
    return -1;
  end if;
  select rnk into v_rank from (
    select user_id, rank() over (order by damage desc) as rnk
    from public.boss_contributions where boss_key = v_key
  ) t where t.user_id = v_uid;
  insert into public.boss_claims (boss_key, user_id) values (v_key, v_uid) on conflict do nothing;
  return coalesce(v_rank, 999);
end;
$$;
grant execute on function public.boss_claim() to authenticated;
