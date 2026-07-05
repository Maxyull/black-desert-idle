-- ============================================================
-- Correctif de lenteur du panneau admin — Velia Idle
-- La vue admin_farm_by_item (onglet "Ressources farmées") scannait TOUTE la table farm_events
-- (79 000+ lignes et ça grandit à chaque objet ramassé par tous les joueurs, depuis le début),
-- sans aucune borne de temps — contrairement aux autres vues admin (admin_farm_by_hour,
-- admin_playtime_by_hour) qui se limitent déjà à 48h. C'était la principale cause de lenteur au
-- clic sur "Zone Admin", confirmé le 2026-07-06.
--
-- Bornée à 30 jours (fenêtre plus large que les 48h des vues horaires, pertinent pour une vue
-- "top ressources farmées") : Postgres peut utiliser l'index déjà existant sur created_at
-- (idx_farm_events_created_at) au lieu de scanner toute la table à chaque ouverture, et ce
-- comportement s'améliore avec le temps à mesure que l'historique dépasse 30 jours.
--
-- Supabase > SQL Editor > New query > Run
--
-- FAILLE CORRIGÉE le 2026-07-05 (audit des avertissements Supabase, voir
-- supabase/migrations/20260705080000_fix_admin_views_security.sql) : cette vue SECURITY DEFINER
-- était lisible par N'IMPORTE QUEL compte connecté ou anonyme via l'API REST. La clause WHERE
-- ci-dessous ne renvoie des lignes que pour l'email admin ; ne JAMAIS retirer ce filtre si ce
-- fichier est ré-exécuté.
-- ============================================================

create or replace view public.admin_farm_by_item
with (security_invoker = false) as
select item_name, item_kind, count(*) as pickups, sum(qty) as total_qty, sum(silver_value) as total_silver
from public.farm_events
where created_at > now() - interval '30 days'
  and coalesce((select auth.jwt()->>'email'), '') = 'maxime.lacoste@icloud.com'
group by item_name, item_kind
order by sum(qty) desc;

revoke all on public.admin_farm_by_item from anon, authenticated;
grant select on public.admin_farm_by_item to authenticated;
