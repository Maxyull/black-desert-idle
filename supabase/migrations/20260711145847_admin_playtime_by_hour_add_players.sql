-- admin_playtime_by_hour ne retournait que (hour, total_playtime_sec) ; le dashboard admin
-- (src/admin/admin-economy.js, renderAdminHourly) lit r.players pour le graphique "joueurs actifs
-- par heure", qui affichait donc toujours 0 depuis sa création -- bug silencieux repéré lors de
-- l'audit repo-audit-todo.md point 3. `players` est ajoutée en fin de liste de colonnes (Postgres
-- interdit de renommer/réordonner une colonne existante via CREATE OR REPLACE VIEW).
create or replace view public.admin_playtime_by_hour
with (security_invoker = true) as
select date_trunc('hour', pinged_at) as hour,
       count(*) * 60 as total_playtime_sec,
       count(distinct user_id) as players
from playtime_pings
where pinged_at > (now() - '48:00:00'::interval)
  and coalesce((select auth.jwt() ->> 'email'), '') = 'maxime.lacoste@icloud.com'
group by date_trunc('hour', pinged_at)
order by date_trunc('hour', pinged_at) desc;

revoke all on public.admin_playtime_by_hour from anon, authenticated;
grant select on public.admin_playtime_by_hour to authenticated;
