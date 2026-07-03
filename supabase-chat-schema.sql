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

create or replace function public.post_chat_message(p_channel text, p_message text)
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

  -- pseudo : uniquement celui du profil (jamais l'email). À défaut, un libellé générique.
  select pseudo into v_pseudo from public.profiles where user_id = v_uid;
  if v_pseudo is null or trim(v_pseudo) = '' then v_pseudo := 'Joueur'; end if;

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

grant execute on function public.post_chat_message(text, text) to authenticated;

-- suppression d'un message : réservée à l'admin (email) et aux modérateurs (table chat_mods),
-- vérifiée côté serveur — le bouton de suppression côté client n'est qu'un confort d'UI
create or replace function public.delete_chat_message(p_id bigint)
returns void
language plpgsql security definer
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Non authentifié'; end if;
  if coalesce(auth.jwt()->>'email', '') is distinct from 'maxime.lacoste@icloud.com'
     and not exists (select 1 from public.chat_mods where user_id = v_uid) then
    raise exception 'Réservé au staff';
  end if;
  delete from public.chat_messages where id = p_id;
end;
$$;

grant execute on function public.delete_chat_message(bigint) to authenticated;
