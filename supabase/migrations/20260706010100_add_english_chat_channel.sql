-- ============================================================
-- Ajoute le canal de chat "english" (demande explicite du 2026-07-06 : "ajoute un chat anglais")
-- -- même mécanique que mondial/trade/annonce, juste un 4e canal autorisé. post_chat_message a 2
-- surcharges (avec/sans p_pseudo) qui dupliquent la même whitelist de canaux : les deux doivent
-- être mises à jour, sinon la 2e (utilisée par le client, voir chatSendBtn) rejetterait 'english'.
--
-- Supabase > SQL Editor > New query > Run
-- ============================================================

create or replace function public.post_chat_message(p_channel text, p_message text)
returns void
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_pseudo text;
  v_last timestamptz;
  v_msg text := trim(p_message);
  v_role text := 'user';
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, true) then
    raise exception 'Compte invité non autorisé — lie un compte vérifié pour discuter';
  end if;
  if p_channel not in ('mondial','trade','annonce','english') then
    raise exception 'Canal invalide';
  end if;
  if p_channel = 'annonce' and coalesce(auth.jwt()->>'email', '') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Seul le staff peut poster une annonce';
  end if;
  if v_msg = '' or char_length(v_msg) > 300 then
    raise exception 'Message vide ou trop long (300 caractères max)';
  end if;

  select max(created_at) into v_last from public.chat_messages where user_id = v_uid;
  if v_last is not null and v_last > now() - interval '3 seconds' then
    raise exception 'Trop rapide — attends un instant avant de reposter';
  end if;

  select pseudo into v_pseudo from public.profiles where user_id = v_uid;
  if v_pseudo is null or trim(v_pseudo) = '' then v_pseudo := 'Joueur'; end if;

  if coalesce(auth.jwt()->>'email', '') = 'maxime.lacoste@icloud.com' then
    v_role := 'admin';
  elsif exists (select 1 from public.chat_mods where user_id = v_uid) then
    v_role := 'mod';
  end if;

  insert into public.chat_messages (channel, user_id, pseudo, message, role)
  values (p_channel, v_uid, v_pseudo, v_msg, v_role);
end;
$$;

create or replace function public.post_chat_message(p_channel text, p_message text, p_pseudo text default null::text)
returns void
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_pseudo text;
  v_last timestamptz;
  v_msg text := trim(p_message);
  v_role text := 'user';
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, true) then
    raise exception 'Compte invité non autorisé — lie un compte vérifié pour discuter';
  end if;
  if p_channel not in ('mondial','trade','annonce','english') then
    raise exception 'Canal invalide';
  end if;
  if p_channel = 'annonce' and coalesce(auth.jwt()->>'email', '') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Seul le staff peut poster une annonce';
  end if;
  if v_msg = '' or char_length(v_msg) > 300 then
    raise exception 'Message vide ou trop long (300 caractères max)';
  end if;

  select max(created_at) into v_last from public.chat_messages where user_id = v_uid;
  if v_last is not null and v_last > now() - interval '3 seconds' then
    raise exception 'Trop rapide — attends un instant avant de reposter';
  end if;

  v_pseudo := nullif(trim(coalesce(p_pseudo, '')), '');
  if v_pseudo is null then
    select pseudo into v_pseudo from public.profiles where user_id = v_uid;
  end if;
  if v_pseudo is null or trim(v_pseudo) = '' then v_pseudo := 'Joueur'; end if;
  v_pseudo := left(v_pseudo, 24);

  if coalesce(auth.jwt()->>'email', '') = 'maxime.lacoste@icloud.com' then
    v_role := 'admin';
  elsif exists (select 1 from public.chat_mods where user_id = v_uid) then
    v_role := 'mod';
  end if;

  insert into public.chat_messages (channel, user_id, pseudo, message, role)
  values (p_channel, v_uid, v_pseudo, v_msg, v_role);
end;
$$;
