-- ============================================================
-- Bug trouvé le 2026-07-10 (demande explicite : "vérifie si toute les action fonctionne") : le
-- bouton "⚠️ Réinitialiser les quêtes de tous" (panneau Admin) appelle admin_reset_all_quests(),
-- qui n'a JAMAIS existé côté serveur — un fichier de schéma (supabase-quest-reset-schema.sql)
-- avait été écrit dans une session précédente mais laissé dans un worktree jamais fusionné,
-- donc jamais réellement appliqué. Le bouton échouait silencieusement (erreur "function does not
-- exist") depuis sa création.
--
-- Remet à zéro les quêtes journalières ET hebdomadaires de TOUS les joueurs (met dq/wq à null
-- dans chaque sauvegarde cloud) : chacun se voit tirer un nouveau lot de quêtes à sa prochaine
-- connexion (voir ensureQuests() côté client, qui régénère dès que S.dq/S.wq est absent ou périmé).
-- ============================================================

create or replace function public.admin_reset_all_quests()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if coalesce(auth.jwt()->>'email', '') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Réservé au staff';
  end if;

  update public.game_saves
  set save_data = jsonb_set(
    jsonb_set(save_data, '{S,dq}', 'null'::jsonb, true),
    '{S,wq}', 'null'::jsonb, true
  );
end;
$function$;

grant execute on function public.admin_reset_all_quests() to authenticated;
