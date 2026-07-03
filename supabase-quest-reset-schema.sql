-- ============================================================
-- Reset admin des quêtes — Velia Idle
-- Remet à zéro les quêtes journalières ET hebdomadaires de TOUS les joueurs (met dq/wq à
-- null dans chaque sauvegarde cloud) : chacun se voit tirer un nouveau lot de quêtes à sa
-- prochaine connexion (voir ensureQuests() côté client, qui régénère dès que S.dq/S.wq est
-- absent ou périmé). Usage ponctuel après un changement d'équilibrage du pool de quêtes.
--
-- Le bouton "Réinitialiser les quêtes de tous" (index.html, zone admin) appelle cette
-- fonction. Le bouton est masqué côté client pour les non-admins, mais ce n'est qu'un
-- confort d'UI — la vraie barrière est la vérification d'email ci-dessous, faite côté
-- serveur : n'importe qui pourrait sinon appeler cette RPC directement via l'API Supabase.
--
-- Supabase > SQL Editor > New query > Run (après supabase-schema.sql / game_saves existant)
-- ============================================================

create or replace function public.admin_reset_all_quests()
returns void
language plpgsql security definer
as $$
begin
  if coalesce(auth.jwt()->>'email', '') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Non autorisé';
  end if;

  update public.game_saves
  set save_data = jsonb_set(
    jsonb_set(save_data, '{S,dq}', 'null'::jsonb, true),
    '{S,wq}', 'null'::jsonb, true
  );
end;
$$;

grant execute on function public.admin_reset_all_quests() to authenticated;
