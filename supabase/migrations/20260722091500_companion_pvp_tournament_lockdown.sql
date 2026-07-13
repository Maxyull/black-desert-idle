-- get_advisors (2026-07-13) signale que register_pvp_team/pvp_registrant_count/run_pvp_tournament/
-- resolve_pvp_tournament_if_due restent exécutables par anon (Postgres accorde EXECUTE à PUBLIC par
-- défaut sur toute fonction nouvellement créée -- même piège déjà rencontré et corrigé pour
-- delete_my_account, voir 20260713220100_delete_my_account_revoke_anon.sql). Défense en profondeur :
-- register_pvp_team lève déjà une exception si auth.uid() est null, mais run_pvp_tournament/
-- resolve_pvp_tournament_if_due n'ont aucune vérification d'identité (elles n'ont besoin que de
-- pg_cron, jamais d'un appel client direct côté produit) -- les fermer à anon/public explicitement.
revoke execute on function public.register_pvp_team(jsonb, numeric) from public;
revoke execute on function public.register_pvp_team(jsonb, numeric) from anon;
grant execute on function public.register_pvp_team(jsonb, numeric) to authenticated;

revoke execute on function public.pvp_registrant_count(date) from public;
revoke execute on function public.pvp_registrant_count(date) from anon;
grant execute on function public.pvp_registrant_count(date) to authenticated;

revoke execute on function public.run_pvp_tournament(date) from public;
revoke execute on function public.run_pvp_tournament(date) from anon;
grant execute on function public.run_pvp_tournament(date) to authenticated;

revoke execute on function public.resolve_pvp_tournament_if_due() from public;
revoke execute on function public.resolve_pvp_tournament_if_due() from anon;
grant execute on function public.resolve_pvp_tournament_if_due() to authenticated;

-- pvp_simulate_match() : "role mutable search_path" (fonction interne, jamais appelée par un
-- client -- seulement par run_pvp_tournament() -- mais autant fermer l'avertissement).
create or replace function public.pvp_simulate_match(a jsonb, b jsonb)
returns jsonb
language plpgsql set search_path to 'public'
as $$
declare
  v_pa numeric; v_pb numeric; v_p_a_win numeric; v_roll numeric; v_winner jsonb;
begin
  if a is null then return jsonb_build_object('a', a, 'b', b, 'winner_user_id', (b->>'user_id'), 'bye', true); end if;
  if b is null then return jsonb_build_object('a', a, 'b', b, 'winner_user_id', (a->>'user_id'), 'bye', true); end if;
  v_pa := (a->>'power')::numeric;
  v_pb := (b->>'power')::numeric;
  v_p_a_win := least(0.95, greatest(0.05, 0.5 + 0.45 * ((v_pa - v_pb) / (v_pa + v_pb + 1))));
  v_roll := random();
  if v_roll < v_p_a_win then v_winner := a; else v_winner := b; end if;
  return jsonb_build_object(
    'a', a, 'b', b, 'winner_user_id', (v_winner->>'user_id'),
    'a_win_probability', round(v_p_a_win, 3), 'roll', round(v_roll, 3), 'bye', false
  );
end;
$$;
revoke execute on function public.pvp_simulate_match(jsonb, jsonb) from public;
revoke execute on function public.pvp_simulate_match(jsonb, jsonb) from anon;
revoke execute on function public.pvp_simulate_match(jsonb, jsonb) from authenticated;
