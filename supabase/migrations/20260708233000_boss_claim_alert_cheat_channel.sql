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
  v_webhook text := 'https://discord.com/api/webhooks/1522867574340059266/yEOAKFa9wdbwxXR78BK_bhddTYgB0nB5u-BVK6VLgR-E7OM8jG9LDiDYltnpEnYRN9g9';
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
        url := v_webhook,
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
