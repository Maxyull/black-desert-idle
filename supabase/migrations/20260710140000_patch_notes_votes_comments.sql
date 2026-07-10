-- Patch Notes : karma + commentaires + modération (2026-07-10, demande explicite, port de
-- patch-notes-system.jsx + patch-notes-pipeline.md fournis par l'utilisateur) -- entry_id est une
-- clé synthétique STABLE "{version}-{index}" dérivée de PATCH_NOTES (meta/patch-notes-data.js,
-- donnée append-only, jamais réordonnée) : v364-0, v364-1, etc. Jamais recalculée une fois qu'un
-- joueur a pu voter/commenter dessus, sous peine de perdre l'historique (voir la note du pipeline
-- doc sur la stabilité des id).

create table if not exists public.patch_note_votes (
  entry_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  updated_at timestamptz not null default now(),
  primary key (entry_id, user_id)
);
alter table public.patch_note_votes enable row level security;
-- aucune policy client (ni select ni write) : tout passe par les RPC ci-dessous (le karma agrégé
-- est public via get_patch_note_karma(), le vote individuel n'a pas besoin d'être lisible par
-- d'autres joueurs) -- même pattern "table verrouillée, RPC-only" que le reste du projet.

create table if not exists public.patch_note_comments (
  id bigint generated always as identity primary key,
  entry_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  author text not null,
  created_at timestamptz not null default now(),
  text text not null,
  status text not null default 'visible' check (status in ('visible', 'removed')),
  removed_by uuid,
  removed_at timestamptz
);
create index if not exists patch_note_comments_entry_id_idx on public.patch_note_comments(entry_id, created_at);
alter table public.patch_note_comments enable row level security;
-- lecture publique des commentaires VISIBLES uniquement -- écriture uniquement via RPC (jamais
-- d'insert/update/delete direct côté client, voir pipeline doc §11-12 : auteur/statut ne doivent
-- jamais être manipulables côté client).
create policy patch_note_comments_select_visible on public.patch_note_comments
  for select using (status = 'visible');

create table if not exists public.patch_note_comment_reports (
  comment_id bigint not null references public.patch_note_comments(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, reporter_id)
);
alter table public.patch_note_comment_reports enable row level security;
-- aucune policy client : RPC-only (report_patch_note_comment / admin_patch_note_pending_reports_count).

-- ---------- Vote (karma) ----------
-- value=-1/1 upsert ; value=0 retire le vote (re-clic sur le même bouton côté client, voir
-- pipeline doc §10 "re-clic = annule le vote").
drop function if exists public.vote_patch_note(text, smallint);
create or replace function public.vote_patch_note(p_entry_id text, p_value smallint)
returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
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

drop function if exists public.get_patch_note_karma();
create or replace function public.get_patch_note_karma()
returns table(entry_id text, score bigint)
language sql security definer set search_path to 'public' as $$
  select entry_id, sum(value)::bigint from public.patch_note_votes group by entry_id;
$$;
grant execute on function public.get_patch_note_karma() to authenticated, anon;

drop function if exists public.get_my_patch_note_votes();
create or replace function public.get_my_patch_note_votes()
returns table(entry_id text, value smallint)
language sql security definer set search_path to 'public' as $$
  select entry_id, value from public.patch_note_votes where user_id = auth.uid();
$$;
grant execute on function public.get_my_patch_note_votes() to authenticated;

-- ---------- Commentaires ----------
-- filtre anti-insulte SERVEUR (2026-07-10, pipeline doc §8 : "un client-side filter se contourne
-- en 30 secondes... le vrai garde-fou doit vivre côté serveur") -- normalise accents/casse/espaces
-- avant comparaison, liste volontairement plus large que la démo client. Pas une Edge Function
-- séparée (jugé hors de portée immédiate) mais un vrai blocage NON contournable : cette fonction
-- SECURITY DEFINER est le SEUL chemin d'insertion (aucune policy insert sur la table), donc
-- impossible à bypasser par un appel direct à l'API REST contrairement à un filtre client pur.
create extension if not exists unaccent with schema extensions;

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
  if p_text is null or length(trim(p_text)) = 0 then raise exception 'Commentaire vide'; end if;
  if length(p_text) > 500 then raise exception 'Commentaire trop long'; end if;

  select coalesce(p.pseudo, split_part(u.email, '@', 1), 'Joueur') into v_author
    from auth.users u left join public.profiles p on p.user_id = u.id
    where u.id = auth.uid();
  if v_author is null then v_author := 'Joueur'; end if;

  -- normalisation : minuscule, accents retirés via l'extension unaccent (fiable, contrairement à
  -- un translate() écrit à la main -- un round-trip via un outil MCP a un jour corrompu une table
  -- de correspondance accentuée en un mapping identité silencieux, voir historique de ce fichier),
  -- espaces/ponctuation compactés -- couvre le contournement le plus simple ("c o n n a r d",
  -- "connâärd").
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

-- suppression (auteur OU admin/modérateur) -- toujours un soft-delete (status='removed'), jamais
-- une vraie suppression SQL (pipeline doc §12 : permet la restauration + garde une trace en cas
-- d'abus répété). Même check de rôle EXACT que le chat (isAdmin() || myIsMod côté client,
-- chat_mods côté serveur, voir src/social/chat.js).
drop function if exists public.remove_patch_note_comment(bigint);
create or replace function public.remove_patch_note_comment(p_comment_id bigint)
returns void
language plpgsql security definer set search_path to 'public' as $$
declare
  v_owner uuid;
  v_is_staff boolean;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select user_id into v_owner from public.patch_note_comments where id = p_comment_id;
  if v_owner is null then raise exception 'Commentaire introuvable'; end if;
  v_is_staff := coalesce(auth.jwt()->>'email','') = 'maxime.lacoste@icloud.com'
    or exists (select 1 from public.chat_mods where user_id = auth.uid());
  if v_owner is distinct from auth.uid() and not v_is_staff then
    raise exception 'Non autorisé';
  end if;
  update public.patch_note_comments
    set status = 'removed', removed_by = auth.uid(), removed_at = now()
    where id = p_comment_id;
end; $$;
grant execute on function public.remove_patch_note_comment(bigint) to authenticated;

drop function if exists public.restore_patch_note_comment(bigint);
create or replace function public.restore_patch_note_comment(p_comment_id bigint)
returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null or not (
    coalesce(auth.jwt()->>'email','') = 'maxime.lacoste@icloud.com'
    or exists (select 1 from public.chat_mods where user_id = auth.uid())
  ) then raise exception 'Réservé au staff'; end if;
  update public.patch_note_comments
    set status = 'visible', removed_by = null, removed_at = null
    where id = p_comment_id;
end; $$;
grant execute on function public.restore_patch_note_comment(bigint) to authenticated;

drop function if exists public.report_patch_note_comment(bigint);
create or replace function public.report_patch_note_comment(p_comment_id bigint)
returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  insert into public.patch_note_comment_reports(comment_id, reporter_id)
  values (p_comment_id, auth.uid())
  on conflict (comment_id, reporter_id) do nothing;
end; $$;
grant execute on function public.report_patch_note_comment(bigint) to authenticated;

-- panneau modération (admin/modérateur uniquement) : commentaires retirés (restaurables) + total
-- de signalements en attente sur les commentaires encore visibles.
drop function if exists public.admin_list_removed_patch_note_comments();
create or replace function public.admin_list_removed_patch_note_comments()
returns setof public.patch_note_comments
language plpgsql security definer set search_path to 'public' as $$
begin
  if not (
    coalesce(auth.jwt()->>'email','') = 'maxime.lacoste@icloud.com'
    or exists (select 1 from public.chat_mods where user_id = auth.uid())
  ) then raise exception 'Réservé au staff'; end if;
  return query select * from public.patch_note_comments where status = 'removed' order by removed_at desc limit 100;
end; $$;
grant execute on function public.admin_list_removed_patch_note_comments() to authenticated;

drop function if exists public.admin_patch_note_pending_reports();
create or replace function public.admin_patch_note_pending_reports()
returns table(comment_id bigint, entry_id text, author text, text text, report_count bigint)
language plpgsql security definer set search_path to 'public' as $$
begin
  if not (
    coalesce(auth.jwt()->>'email','') = 'maxime.lacoste@icloud.com'
    or exists (select 1 from public.chat_mods where user_id = auth.uid())
  ) then raise exception 'Réservé au staff'; end if;
  return query
    select c.id, c.entry_id, c.author, c.text, count(r.*)::bigint
    from public.patch_note_comments c
    join public.patch_note_comment_reports r on r.comment_id = c.id
    where c.status = 'visible'
    group by c.id
    order by count(r.*) desc;
end; $$;
grant execute on function public.admin_patch_note_pending_reports() to authenticated;
