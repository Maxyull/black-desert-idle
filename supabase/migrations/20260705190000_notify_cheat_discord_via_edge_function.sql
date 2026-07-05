-- ============================================================
-- Corrige la fuite signalee dans l'issue GitHub #2 (audit de securite) : notify_cheat_discord()
-- avait le webhook Discord "cheat" en clair, commite dans une migration SQL publique
-- (20260708233000_boss_claim_alert_cheat_channel.sql). N'importe qui pouvait lire ce webhook
-- sur le repo public et spammer le salon Discord "cheat".
--
-- Correctif : l'appel direct au webhook est remplace par un appel a l'Edge Function
-- discord-cheat-log, qui lit le webhook depuis un secret Supabase (DISCORD_CHEAT_WEBHOOK,
-- defini via Dashboard > Edge Functions > Secrets) -- jamais expose dans le code public,
-- ni cote client ni dans les migrations.
--
-- Le webhook precedent (fuite) a ete revoque cote Discord et remplace par un nouveau,
-- stocke uniquement comme secret Supabase.
--
-- Supabase > SQL Editor > New query > Run (deja applique en prod le 2026-07-05)
-- ============================================================

create or replace function public.notify_cheat_discord(p_user_id uuid, p_field text, p_submitted numeric, p_clamped numeric)
returns void
language plpgsql
set search_path to 'public'
as $function$
declare
  v_pseudo text;
begin
  select coalesce(pr.pseudo, ps.display_name) into v_pseudo
  from (select p_user_id as user_id) u
  left join public.profiles pr on pr.user_id = u.user_id
  left join public.player_stats ps on ps.user_id = u.user_id;

  perform net.http_post(
    url := 'https://mkwwvzbjtyawpcyrnybk.supabase.co/functions/v1/discord-cheat-log',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      -- clé anon publique (par design, voir SUPABASE_ANON_KEY côté client) : sert uniquement
      -- à passer la vérification JWT de l'Edge Function, pas un secret
      'Authorization', 'Bearer ' || 'sb_publishable_c7HLxbeBLe01rirZVg-XPA_TClYulIJ'
    ),
    body := jsonb_build_object(
      'title', '⚠️ Valeur anti-triche bornée',
      'description', concat(
        'Joueur : **', coalesce(v_pseudo, '?'), '** (`', p_user_id, '`)', chr(10),
        'Champ : **', p_field, '**', chr(10),
        'Envoyé : `', p_submitted, '` → Borné à : `', p_clamped, '`'
      ),
      'color', 15158332
    )
  );
exception when others then
  null;
end;
$function$;
