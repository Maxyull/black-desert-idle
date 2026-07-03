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
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_channel_created_idx on public.chat_messages(channel, created_at desc);

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

  select pseudo into v_pseudo from public.profiles where user_id = v_uid;
  if v_pseudo is null then
    v_pseudo := coalesce(split_part(auth.jwt()->>'email', '@', 1), 'Joueur');
  end if;

  insert into public.chat_messages (channel, user_id, pseudo, message) values (p_channel, v_uid, v_pseudo, v_msg);
end;
$$;

grant execute on function public.post_chat_message(text, text) to authenticated;
