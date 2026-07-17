-- Durcissement client_errors (2026-07-16, audit sécurité) : la policy INSERT était
-- `with check (true)` (advisor rls_policy_always_true) -> n'importe qui pouvait insérer des lignes
-- avec un user_id usurpé et/ou des payloads énormes (spam / abus de stockage).
-- Nouvelle policy : on ne peut insérer QUE des lignes attribuées à soi-même (user_id null pour un
-- invité, ou = auth.uid()), avec des tailles de champs plafonnées. Le client (reportClientError,
-- game-supabase.js) n'envoie pas de user_id et tronque déjà message/stack -> aucun impact légitime.
-- La lecture reste réservée au staff (policy client_errors_select inchangée).
drop policy if exists client_errors_insert on public.client_errors;
create policy client_errors_insert on public.client_errors
  for insert
  with check (
    (user_id is null or user_id = auth.uid())
    and char_length(coalesce(message, '')) <= 4000
    and char_length(coalesce(stack, '')) <= 12000
    and char_length(coalesce(url, '')) <= 2000
    and char_length(coalesce(user_agent, '')) <= 1000
  );
