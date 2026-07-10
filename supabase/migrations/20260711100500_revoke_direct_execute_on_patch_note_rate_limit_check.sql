-- _patch_note_rate_limit_check() est un helper INTERNE (préfixe _), appelé uniquement depuis
-- l'intérieur de add_patch_note_comment()/vote_patch_note() (toutes deux SECURITY DEFINER) --
-- il n'a jamais eu besoin d'un GRANT direct à `authenticated` pour que ça fonctionne (le contexte
-- d'exécution du définisseur suffit à l'appel interne). Le laisser exposé permettait à n'importe
-- quel client authentifié de l'appeler directement via /rest/v1/rpc/, contournant l'intention
-- (juste insérer des événements de rate-limit sans passer par un vrai commentaire/vote). Trouvé
-- via get_advisors() juste après application de
-- 20260711100000_patch_notes_rate_limit_autohide_karma_alert.sql (déjà appliquée en prod avant ce
-- correctif -- nouvelle migration plutôt que d'y toucher, comme toujours).
revoke execute on function public._patch_note_rate_limit_check(text, int) from authenticated;
revoke execute on function public._patch_note_rate_limit_check(text, int) from anon;
revoke execute on function public._patch_note_rate_limit_check(text, int) from public;
