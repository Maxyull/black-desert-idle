-- ============================================================
-- Corrige 3 alertes ERROR (rouge) du linter de sécurité Supabase : les vues admin
-- (admin_wealth, admin_farm_by_item, admin_playtime_by_hour) étaient en SECURITY DEFINER
-- (comportement par défaut de CREATE VIEW), ce qui leur fait ignorer le RLS des tables
-- sous-jacentes et s'appuyer UNIQUEMENT sur leur propre clause WHERE (email admin en dur) pour se
-- protéger — un contournement de RLS toujours signalé comme risque architectural par Supabase,
-- même quand la clause interne est correcte.
--
-- Fix : passage en security_invoker = true (la vue s'exécute désormais avec les droits de
-- l'utilisateur qui l'interroge, RLS de la table source appliqué normalement comme pour toute
-- requête directe). game_saves et farm_events ont déjà une policy SELECT "propriétaire OU admin" /
-- "admin uniquement" -- mais playtime_pings a RLS activé SANS AUCUNE policy (deny-by-default), donc
-- admin_playtime_by_hour serait devenue vide pour l'admin sans lui ajouter la même policy admin que
-- les 2 autres tables.
--
-- Supabase > SQL Editor > New query > Run
-- ============================================================

create policy "Admin uniquement lit les pings de temps de jeu"
  on public.playtime_pings for select
  using (coalesce((select auth.jwt()->>'email'), '') = 'maxime.lacoste@icloud.com');

alter view public.admin_wealth set (security_invoker = true);
alter view public.admin_farm_by_item set (security_invoker = true);
alter view public.admin_playtime_by_hour set (security_invoker = true);
