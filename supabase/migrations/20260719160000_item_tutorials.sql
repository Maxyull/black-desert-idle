-- tutoriels d'objets au premier obtain (2026-07-19, adaptation du prompt "item-tutorial-system")
-- -- chaque ligne = un tutoriel vu ou explicitement skip par un joueur. RLS "own rows only" pour
-- le client (lecture/écriture de son propre état), agrégation admin via RPC SECURITY DEFINER
-- (comme demandé : "voir qui a vu/pas vu quels tutoriels" dans le nouvel onglet admin).
create table if not exists public.item_tutorials_seen (
  user_id uuid not null references auth.users(id) on delete cascade,
  tutorial_id text not null,
  seen_at timestamptz not null default now(),
  skipped boolean not null default false,
  primary key (user_id, tutorial_id)
);
alter table public.item_tutorials_seen enable row level security;
create policy item_tutorials_seen_own on public.item_tutorials_seen
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- upsert appelé côté client à l'ouverture (skipped=false) ou à la fermeture anticipée (skipped=true)
-- d'un tutoriel d'objet -- SECURITY DEFINER pas nécessaire ici (RLS "own" suffit), mais explicite
-- pour rester cohérent avec le reste du projet et garantir user_id = auth.uid() côté serveur.
create or replace function public.mark_item_tutorial_seen(p_tutorial_id text, p_skipped boolean default false)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  insert into public.item_tutorials_seen(user_id, tutorial_id, skipped)
    values (auth.uid(), p_tutorial_id, p_skipped)
    on conflict (user_id, tutorial_id) do update set skipped = excluded.skipped, seen_at = now();
end;
$function$;
grant execute on function public.mark_item_tutorial_seen(text, boolean) to authenticated;

-- stats admin : combien de joueurs ont vu/skip chaque tutoriel -- réservé au staff, agrège TOUS
-- les joueurs (RLS "own" bloquerait un simple select direct, d'où le SECURITY DEFINER).
create or replace function public.admin_item_tutorial_stats()
 returns table(tutorial_id text, completed_count bigint, skipped_count bigint, total_count bigint)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  return query
    select its.tutorial_id,
      count(*) filter (where not its.skipped)::bigint,
      count(*) filter (where its.skipped)::bigint,
      count(*)::bigint
    from public.item_tutorials_seen its
    group by its.tutorial_id
    order by count(*) desc;
end;
$function$;
grant execute on function public.admin_item_tutorial_stats() to authenticated;
