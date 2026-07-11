-- admin_farm_by_hour existait déjà en prod (créée hors migration, via SQL Editor/MCP Supabase,
-- jamais capturée en version control -- voir supabase/README.md). Cette migration la fait entrer
-- dans le contrôle de version ET corrige un trou de sécurité découvert au passage : contrairement
-- à sa vue soeur admin_farm_by_item (20260706011035_fix_security_definer_views), elle n'avait ni
-- le filtre email admin dans le WHERE, ni des grants restreints -- SELECT (et même
-- INSERT/UPDATE/DELETE/TRUNCATE, sans effet réel sur une vue non-updatable mais un signal quand
-- même) étaient ouverts à `anon`, exposant les données économiques de farm (item, quantités,
-- valeur argent par heure) sans authentification.
create or replace view public.admin_farm_by_hour
with (security_invoker = true) as
select date_trunc('hour', created_at) as hour,
       item_kind,
       sum(qty) as total_qty,
       sum(silver_value) as total_silver
from farm_events
where created_at > (now() - '48:00:00'::interval)
  and coalesce((select auth.jwt() ->> 'email'), '') = 'maxime.lacoste@icloud.com'
group by date_trunc('hour', created_at), item_kind
order by date_trunc('hour', created_at) desc, item_kind;

revoke all on public.admin_farm_by_hour from anon, authenticated;
grant select on public.admin_farm_by_hour to authenticated;
