-- Notes de version : anti-abus + veille communauté (2026-07-11, demande explicite "je veux tout"
-- après audit de patch-notes-pipeline.md §8/§9/§10/§13 vs le code réellement livré) -- 3 trous
-- identifiés dans l'audit, comblés ici sans toucher la migration existante
-- (20260710140000_patch_notes_votes_comments.sql) :
--   1. Rate limiting sur commentaires (§8) et votes (§10) -- aucune des deux RPC ne limitait la
--      fréquence jusqu'ici.
--   2. Auto-masquage d'un commentaire au-delà d'un seuil de signalements (§13) -- restait visible
--      indéfiniment tant que l'admin ne le retirait pas manuellement.
--   3. Alerte Discord automatique si le karma d'une entrée descend sous un seuil (§9) -- la vue
--      Controverse restait 100% manuelle, jamais de signal proactif.

-- ============================================================
-- 1. Rate limiting (commentaires + votes)
-- ============================================================
-- table d'événements légère, purgée à chaque appel (pas de pg_cron nécessaire) -- même esprit que
-- les autres tables "verrouillées, RPC-only" de ce fichier : aucune policy client.
create table if not exists public.patch_note_rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('comment', 'vote')),
  created_at timestamptz not null default now()
);
create index if not exists patch_note_rate_limit_events_lookup_idx
  on public.patch_note_rate_limit_events(user_id, action, created_at);
alter table public.patch_note_rate_limit_events enable row level security;

drop function if exists public._patch_note_rate_limit_check(text, int);
create or replace function public._patch_note_rate_limit_check(p_action text, p_max_per_minute int)
returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_count int;
begin
  -- purge légère : on ne garde jamais plus de 24h d'historique par utilisateur (évite la
  -- croissance illimitée sans dépendre de pg_cron).
  delete from public.patch_note_rate_limit_events
    where user_id = auth.uid() and created_at < now() - interval '1 day';
  select count(*) into v_count from public.patch_note_rate_limit_events
    where user_id = auth.uid() and action = p_action and created_at > now() - interval '1 minute';
  if v_count >= p_max_per_minute then
    raise exception 'rate_limited';
  end if;
  insert into public.patch_note_rate_limit_events(user_id, action) values (auth.uid(), p_action);
end; $$;
grant execute on function public._patch_note_rate_limit_check(text, int) to authenticated;

-- max 5 commentaires/minute (pipeline doc §8 : "pour éviter le flood")
drop function if exists public.add_patch_note_comment(text, text);
create or replace function public.add_patch_note_comment(p_entry_id text, p_text text)
returns bigint
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare
  v_author text;
  v_normalized text;
  v_id bigint;
  v_banned text[] := array[
    'idiot','idiote','debile','nul','nulle','connard','connasse','stupide','abruti','abrutie',
    'merde','encule','enculee','pute','putain','salope','batard','cretin','tapette',
    'negro','pd','sale con','sale conne','fdp','ntm','tg','ta gueule'
  ];
  v_word text;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  perform public._patch_note_rate_limit_check('comment', 5);
  if p_text is null or length(trim(p_text)) = 0 then raise exception 'Commentaire vide'; end if;
  if length(p_text) > 500 then raise exception 'Commentaire trop long'; end if;

  select coalesce(p.pseudo, split_part(u.email, '@', 1), 'Joueur') into v_author
    from auth.users u left join public.profiles p on p.user_id = u.id
    where u.id = auth.uid();
  if v_author is null then v_author := 'Joueur'; end if;

  v_normalized := extensions.unaccent(lower(p_text));
  v_normalized := regexp_replace(v_normalized, '[^a-z0-9]+', ' ', 'g');

  foreach v_word in array v_banned loop
    if v_normalized like '%' || v_word || '%' then
      raise exception 'contenu_inapproprie';
    end if;
  end loop;

  insert into public.patch_note_comments(entry_id, user_id, author, text)
  values (p_entry_id, auth.uid(), v_author, trim(p_text))
  returning id into v_id;
  return v_id;
end; $$;
grant execute on function public.add_patch_note_comment(text, text) to authenticated;

-- max 30 votes/minute (pipeline doc §10 : "pour éviter un script qui spam le karma")
drop function if exists public.vote_patch_note(text, smallint);
create or replace function public.vote_patch_note(p_entry_id text, p_value smallint)
returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  perform public._patch_note_rate_limit_check('vote', 30);
  if p_value = 0 then
    delete from public.patch_note_votes where entry_id = p_entry_id and user_id = auth.uid();
  elsif p_value in (-1, 1) then
    insert into public.patch_note_votes(entry_id, user_id, value, updated_at)
    values (p_entry_id, auth.uid(), p_value, now())
    on conflict (entry_id, user_id) do update set value = excluded.value, updated_at = now();
  else
    raise exception 'Valeur de vote invalide';
  end if;
end; $$;
grant execute on function public.vote_patch_note(text, smallint) to authenticated;

-- ============================================================
-- 2. Auto-masquage après N signalements (pipeline doc §13)
-- ============================================================
-- élargit le statut existant ('visible'/'removed') plutôt que de dupliquer la colonne -- retrouve
-- dynamiquement le nom de la contrainte générée par Postgres pour ne pas dépendre d'un nom en dur
-- (peut varier selon comment la table a été créée).
do $$
declare v_conname text;
begin
  select conname into v_conname from pg_constraint
    where conrelid = 'public.patch_note_comments'::regclass
      and contype = 'c' and pg_get_constraintdef(oid) ilike '%status%';
  if v_conname is not null then
    execute format('alter table public.patch_note_comments drop constraint %I', v_conname);
  end if;
end $$;
alter table public.patch_note_comments
  add constraint patch_note_comments_status_check check (status in ('visible', 'removed', 'pending_review'));

-- seuil volontairement bas (5, comme suggéré par le pipeline doc) -- un commentaire auto-masqué
-- n'est PAS supprimé, juste retiré de la vue publique (policy select déjà filtrée sur
-- status='visible') jusqu'à revue admin/modérateur -- restore_patch_note_comment (déjà existant)
-- le repasse en 'visible' sans changement de code nécessaire.
drop function if exists public.report_patch_note_comment(bigint);
create or replace function public.report_patch_note_comment(p_comment_id bigint)
returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_report_count int;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  insert into public.patch_note_comment_reports(comment_id, reporter_id)
  values (p_comment_id, auth.uid())
  on conflict (comment_id, reporter_id) do nothing;

  select count(*) into v_report_count from public.patch_note_comment_reports where comment_id = p_comment_id;
  if v_report_count >= 5 then
    update public.patch_note_comments set status = 'pending_review'
      where id = p_comment_id and status = 'visible';
  end if;
end; $$;
grant execute on function public.report_patch_note_comment(bigint) to authenticated;

-- la liste admin des "commentaires retirés" couvre désormais aussi les auto-masqués en attente de
-- revue (même file d'attente, distinguée côté client par `status`) -- évite de dupliquer une 2e
-- RPC + une 2e section admin quasi identique.
drop function if exists public.admin_list_removed_patch_note_comments();
create or replace function public.admin_list_removed_patch_note_comments()
returns setof public.patch_note_comments
language plpgsql security definer set search_path to 'public' as $$
begin
  if not (
    coalesce(auth.jwt()->>'email','') = 'maxime.lacoste@icloud.com'
    or exists (select 1 from public.chat_mods where user_id = auth.uid())
  ) then raise exception 'Réservé au staff'; end if;
  return query select * from public.patch_note_comments
    where status in ('removed', 'pending_review')
    order by coalesce(removed_at, created_at) desc limit 100;
end; $$;
grant execute on function public.admin_list_removed_patch_note_comments() to authenticated;

-- ============================================================
-- 3. Alerte Discord automatique sur karma négatif (pipeline doc §9)
-- ============================================================
-- réutilise le salon "log général" déjà en place (discord-log, voir supabase-discord-log.md) --
-- un score de karma négatif est un signal de game design, pas une alerte anti-triche (canal
-- distinct de notify_cheat_discord/discord-cheat-log). Un flag "déjà alerté" par entrée évite de
-- spammer Discord à chaque nouveau vote une fois le seuil déjà franchi.
create table if not exists public.patch_note_karma_alerts (
  entry_id text primary key,
  alerted_at timestamptz not null default now()
);
alter table public.patch_note_karma_alerts enable row level security;

drop function if exists public.patch_note_karma_alert_trigger() cascade;
create or replace function public.patch_note_karma_alert_trigger()
returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare
  v_entry_id text := coalesce(new.entry_id, old.entry_id);
  v_score bigint;
  v_alerted_count int;
begin
  select coalesce(sum(value), 0) into v_score from public.patch_note_votes where entry_id = v_entry_id;
  if v_score <= -20 then
    insert into public.patch_note_karma_alerts(entry_id) values (v_entry_id)
      on conflict (entry_id) do nothing;
    get diagnostics v_alerted_count = row_count;
    if v_alerted_count > 0 then
      perform net.http_post(
        url := 'https://mkwwvzbjtyawpcyrnybk.supabase.co/functions/v1/discord-log',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || 'sb_publishable_c7HLxbeBLe01rirZVg-XPA_TClYulIJ'
        ),
        body := jsonb_build_object(
          'title', '📉 Note de version très mal reçue',
          'description', concat(
            'Entrée **', v_entry_id, '** — score karma : **', v_score, '** (seuil d''alerte : -20).', chr(10),
            'À vérifier dans la vue Controverse du panneau Notes de version.'
          ),
          'color', 15105642
        )
      );
    end if;
  end if;
  return null;
exception when others then
  return null;
end; $$;

drop trigger if exists trg_patch_note_karma_alert on public.patch_note_votes;
create trigger trg_patch_note_karma_alert
  after insert or update or delete on public.patch_note_votes
  for each row execute function public.patch_note_karma_alert_trigger();
