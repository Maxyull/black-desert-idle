-- ============================================================
-- Chat — Velia Idle
-- Canaux : mondial, trade, annonce (guilde préparé mais pas encore actif, en attendant un
-- vrai système de guilde). Lecture ouverte à tout compte connecté (invité inclus), écriture
-- réservée aux comptes vérifiés (anti-spam basique via comptes invités jetables), et le canal
-- "annonce" est réservé au compte admin (vérifié côté serveur, pas seulement côté client).
--
-- Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists public.chat_messages (
  id bigserial primary key,
  channel text not null check (channel in ('mondial','trade','annonce','guilde')),
  user_id uuid not null references auth.users(id) on delete cascade,
  pseudo text not null,
  message text not null,
  role text not null default 'user',   -- 'admin' | 'mod' | 'user' (badge affiché dans le chat)
  created_at timestamptz not null default now()
);
-- si la table existait déjà avant l'ajout de la colonne role :
alter table public.chat_messages add column if not exists role text not null default 'user';

create index if not exists chat_messages_channel_created_idx on public.chat_messages(channel, created_at desc);

-- liste des modérateurs (à remplir plus tard) — le staff pourra supprimer des messages
create table if not exists public.chat_mods (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.chat_mods enable row level security;
drop policy if exists "chat_mods_select_all" on public.chat_mods;
create policy "chat_mods_select_all" on public.chat_mods for select using (auth.uid() is not null);

alter table public.chat_messages enable row level security;

-- lecture ouverte à tout compte connecté (y compris invité) — pas d'écriture directe, tout
-- passe par post_chat_message() pour appliquer la limite anti-spam et la règle "annonce = admin"
drop policy if exists "chat_messages_select_all" on public.chat_messages;
create policy "chat_messages_select_all" on public.chat_messages for select using (auth.uid() is not null);

-- p_pseudo (optionnel) : le pseudo AFFICHÉ côté client (peut venir du pseudo perso OU du nom
-- Discord). On l'utilise en priorité pour que le nom dans le chat = le nom vu dans l'UI. Le rôle
-- (badge ADMIN/MOD) reste lui déterminé côté serveur → un pseudo usurpé n'obtient jamais le badge.
create or replace function public.post_chat_message(p_channel text, p_message text, p_pseudo text default null)
returns void
language plpgsql security definer
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
  if p_channel not in ('mondial','trade','annonce') then
    raise exception 'Canal invalide';
  end if;
  if p_channel = 'annonce' and coalesce(auth.jwt()->>'email', '') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Seul le staff peut poster une annonce';
  end if;
  if v_msg = '' or char_length(v_msg) > 300 then
    raise exception 'Message vide ou trop long (300 caractères max)';
  end if;

  -- anti-spam basique : 1 message toutes les 3 secondes par joueur, tous canaux confondus
  select max(created_at) into v_last from public.chat_messages where user_id = v_uid;
  if v_last is not null and v_last > now() - interval '3 seconds' then
    raise exception 'Trop rapide — attends un instant avant de reposter';
  end if;

  -- pseudo : priorité au pseudo envoyé par le client (borné à 24 car.), sinon celui du profil,
  -- sinon un libellé générique. Jamais l'email.
  v_pseudo := nullif(trim(coalesce(p_pseudo, '')), '');
  if v_pseudo is null then
    select pseudo into v_pseudo from public.profiles where user_id = v_uid;
  end if;
  if v_pseudo is null or trim(v_pseudo) = '' then v_pseudo := 'Joueur'; end if;
  v_pseudo := left(v_pseudo, 24);

  -- rôle pour le badge : admin (email admin), mod (table chat_mods), sinon user
  if coalesce(auth.jwt()->>'email', '') = 'maxime.lacoste@icloud.com' then
    v_role := 'admin';
  elsif exists (select 1 from public.chat_mods where user_id = v_uid) then
    v_role := 'mod';
  end if;

  insert into public.chat_messages (channel, user_id, pseudo, message, role)
  values (p_channel, v_uid, v_pseudo, v_msg, v_role);
end;
$$;

grant execute on function public.post_chat_message(text, text, text) to authenticated;

-- journal des messages supprimés (canal "modéré") : consultable uniquement par le staff
-- (admin + modérateurs). On y garde le message d'origine, son auteur (pseudo + UUID), le canal
-- et qui a supprimé, pour tracer la modération.
create table if not exists public.chat_deleted (
  id bigserial primary key,
  orig_id bigint,
  channel text,
  author_id uuid,
  author_pseudo text,
  message text,
  deleted_by uuid,
  deleted_at timestamptz not null default now()
);
create index if not exists chat_deleted_deleted_at_idx on public.chat_deleted(deleted_at desc);
alter table public.chat_deleted enable row level security;
drop policy if exists "chat_deleted_select_staff" on public.chat_deleted;
create policy "chat_deleted_select_staff" on public.chat_deleted for select using (
  coalesce(auth.jwt()->>'email','') = 'maxime.lacoste@icloud.com'
  or exists (select 1 from public.chat_mods where user_id = auth.uid())
);

-- suppression d'un message : réservée à l'admin (email) et aux modérateurs (table chat_mods),
-- vérifiée côté serveur. Avant de supprimer, le message est ARCHIVÉ dans chat_deleted.
create or replace function public.delete_chat_message(p_id bigint)
returns void
language plpgsql security definer
as $$
declare v_uid uuid := auth.uid(); v_m record;
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;
  if coalesce(auth.jwt()->>'email', '') is distinct from 'maxime.lacoste@icloud.com'
     and not exists (select 1 from public.chat_mods where user_id = v_uid) then
    raise exception 'Réservé au staff';
  end if;
  select * into v_m from public.chat_messages where id = p_id;
  if v_m.id is not null then
    insert into public.chat_deleted (orig_id, channel, author_id, author_pseudo, message, deleted_by)
      values (v_m.id, v_m.channel, v_m.user_id, v_m.pseudo, v_m.message, v_uid);
    delete from public.chat_messages where id = p_id;
  end if;
end;
$$;

grant execute on function public.delete_chat_message(bigint) to authenticated;

-- ============================================================
-- Gestion des modérateurs (admin) : ajouter/retirer un MOD par UUID, lister les MODs.
-- Toutes vérifient l'email admin côté serveur.
-- ============================================================
create or replace function public.admin_add_mod(p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  if not exists (select 1 from auth.users where id = p_user_id) then raise exception 'UUID inconnu'; end if;
  insert into public.chat_mods (user_id) values (p_user_id) on conflict (user_id) do nothing;
end; $$;
grant execute on function public.admin_add_mod(uuid) to authenticated;

create or replace function public.admin_remove_mod(p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  delete from public.chat_mods where user_id = p_user_id;
end; $$;
grant execute on function public.admin_remove_mod(uuid) to authenticated;

create or replace function public.admin_list_mods()
returns table(user_id uuid, pseudo text) language plpgsql security definer as $$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  return query select m.user_id, p.pseudo from public.chat_mods m
    left join public.profiles p on p.user_id = m.user_id order by p.pseudo nulls last;
end; $$;
grant execute on function public.admin_list_mods() to authenticated;
