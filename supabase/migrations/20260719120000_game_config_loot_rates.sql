-- table de config générique clé/valeur (2026-07-19, refonte du panneau admin) — premier usage :
-- override en direct des taux de la table de loot V2 (LOOT_RATES_LIVE, src/world/gear-tiers-data.js).
-- lecture publique (tous les clients doivent voir le même override), écriture réservée au staff.
create table if not exists public.game_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.game_config enable row level security;
create policy game_config_select_all on public.game_config for select using (true);

create or replace function public.admin_set_loot_rates(p_rates jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  insert into public.game_config(key, value, updated_at) values ('loot_rates_v2', p_rates, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
end;
$function$;
grant execute on function public.admin_set_loot_rates(jsonb) to authenticated;
