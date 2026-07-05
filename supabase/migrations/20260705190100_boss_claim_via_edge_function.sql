-- ============================================================
-- 2e occurrence du webhook fuite (issue GitHub #2) : boss_claim() avait aussi le webhook
-- Discord "cheat" en clair (voir 20260705190000_notify_cheat_discord_via_edge_function.sql
-- pour le contexte complet). Remplace par l'appel a l'Edge Function discord-cheat-log.
--
-- Supabase > SQL Editor > New query > Run (deja applique en prod le 2026-07-05)
-- ============================================================

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
        url := 'https://mkwwvzbjtyawpcyrnybk.supabase.co/functions/v1/discord-cheat-log',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || 'sb_publishable_c7HLxbeBLe01rirZVg-XPA_TClYulIJ'
        ),
        body := jsonb_build_object(
          'title', '🚫 Tentative de double réclamation',
          'description', concat(
            'Joueur : **', coalesce(v_pseudo, '?'), '** (`', v_uid, '`)', chr(10),
            'Boss : **', coalesce(v_boss_id, '?'), '** (déjà payée) — bloqué'
          ),
          'color', 15548997
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
