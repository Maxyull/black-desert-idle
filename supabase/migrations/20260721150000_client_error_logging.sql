-- Monitoring d'erreurs client minimal (2026-07-21, repo-audit-todo.md point 18)
-- ============================================================
-- Constat : aucun window.onerror / unhandledrejection cote client, aucun service tiers (Sentry).
-- Une erreur JS en prod (bug d'enchantement, crash du viewer 3D, exception dans le calcul de
-- loot...) est invisible cote developpeur sauf signalement manuel par un joueur sur Discord.
--
-- Option retenue : minimale, sans dependance externe (pas de Sentry) -- window.addEventListener
-- ('error'/'unhandledrejection') logue dans cette table, throttle cote client (voir
-- game-supabase.js) pour ne jamais spammer en cas de boucle d'erreur repetee.
--
-- Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null, -- nullable : peut arriver avant login (invite)
  message text not null,
  stack text,
  url text not null,
  game_version text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists client_errors_created_at_idx on public.client_errors(created_at desc);
alter table public.client_errors enable row level security;

-- ecriture ouverte a tous (authentifie ou invite) -- c'est un outil de diagnostic, pas une donnee
-- sensible ; refuser l'insert a un joueur juste apres un crash serait contre-productif.
create policy client_errors_insert on public.client_errors
  for insert with check (true);

-- lecture reservee a l'admin (meme pattern que admin_wealth/admin_farm_by_item, voir
-- fix_admin_views_security.sql) -- jamais expose aux joueurs.
create policy client_errors_select on public.client_errors
  for select using (coalesce((select auth.jwt()->>'email'), '') = 'maxime.lacoste@icloud.com');

-- purge automatique au-dela de 30 jours (evite une croissance illimitee sur une table
-- potentiellement bruyante) -- meme esprit que silver_ledger_archive_and_purge_retention.sql.
create or replace function public.purge_old_client_errors()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.client_errors where created_at < now() - interval '30 days';
$$;
