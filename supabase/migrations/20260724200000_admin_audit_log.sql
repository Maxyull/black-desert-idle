-- ============================================================
-- Journal d'audit des actions admin (2026-07-20, bdi-admin-monitoring-plan.md §7 :
-- « admin_audit_log alimenté, non supprimable »).
--
-- CE QUI MANQUAIT. 18 RPC du panneau modifient l'état du jeu -- bannir, réinitialiser un compte ou
-- TOUS les comptes, donner/retirer un rôle, changer les taux de loot, fermer le marché, faire
-- apparaître un boss, rembourser un joueur, diffuser une annonce. Aucune ne laissait la moindre
-- trace. Après coup, impossible de répondre à « qui a réinitialisé ce compte, quand, et pourquoi ».
-- Ce n'est pas qu'une question de confiance : sans trace, une action lancée par erreur est
-- indistinguable d'une action malveillante, et un compte staff compromis serait invisible.
--
-- APPEND-ONLY POUR DE VRAI. RLS active sans AUCUNE policy (donc rien via PostgREST), plus un
-- trigger qui refuse UPDATE et DELETE -- y compris pour service_role, qui contourne RLS. Un
-- journal qu'on peut réécrire ne prouve rien. Limite honnête : un superutilisateur peut supprimer
-- le trigger ; c'est le plancher de sécurité de Postgres, pas un oubli.
--
-- ÉCHEC = ACTION ANNULÉE. admin_audit() n'attrape pas ses erreurs : l'insertion est dans la MÊME
-- transaction que l'action auditée. Si le journal ne peut pas écrire, l'action ne se fait pas.
-- C'est la posture correcte pour un audit -- l'inverse (« on agit quand même, tant pis pour la
-- trace ») produit exactement les trous qu'on cherche à supprimer.
--
-- INSTRUMENTATION AUTOMATISÉE, PAS RECOPIÉE À LA MAIN. Le bloc DO en fin de fichier réinjecte
-- l'appel dans les 18 fonctions en insérant une ligne juste après leur garde e-mail staff, à
-- partir de pg_get_functiondef(). Recopier 18 corps de fonction à la main aurait été la vraie
-- source d'erreurs (une clause perdue dans un copier-coller ne se voit pas en relecture). Le bloc
-- refuse de continuer si la garde n'est pas trouvée exactement une fois : mieux vaut une migration
-- qui échoue qu'une fonction silencieusement non auditée.
-- ============================================================

create table if not exists public.admin_audit_log (
  id           bigserial primary key,
  actor_id     uuid,
  actor_email  text,
  action       text not null,
  target_user_id uuid,
  details      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists admin_audit_log_recent on public.admin_audit_log(created_at desc);
create index if not exists admin_audit_log_target on public.admin_audit_log(target_user_id) where target_user_id is not null;
alter table public.admin_audit_log enable row level security;
-- aucune policy : la table n'est accessible que par les fonctions security definer ci-dessous.
-- Et on retire en plus les privilèges de table : Supabase accorde par défaut arwdDxtm à anon et
-- authenticated sur toute table de `public`. La RLS sans policy suffit déjà à tout bloquer, mais
-- ces GRANT laissent la porte ouverte au moindre oubli de RLS un jour -- pour un journal d'audit,
-- deux verrous valent mieux qu'un.
revoke all on table public.admin_audit_log from anon, authenticated;

/** Refuse toute réécriture du journal, même pour un rôle qui contourne la RLS (service_role). */
create or replace function public.admin_audit_log_append_only()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  raise exception 'admin_audit_log est en append-only : ni UPDATE ni DELETE';
end; $$;
drop trigger if exists admin_audit_log_no_rewrite on public.admin_audit_log;
create trigger admin_audit_log_no_rewrite
  before update or delete on public.admin_audit_log
  for each row execute function public.admin_audit_log_append_only();

/**
 * Écrit une entrée d'audit. Interne : appelée depuis les RPC admin, jamais exposée.
 * L'e-mail est figé au moment de l'action (et pas relu plus tard depuis auth.users) pour que la
 * trace reste lisible même si le compte est renommé ou supprimé ensuite.
 */
create or replace function public.admin_audit(p_action text, p_target uuid, p_details jsonb)
returns void language sql security definer set search_path to 'public' as $$
  insert into public.admin_audit_log(actor_id, actor_email, action, target_user_id, details)
  values (auth.uid(), coalesce(auth.jwt()->>'email', '(cron/service)'), p_action, p_target,
          coalesce(p_details, '{}'::jsonb));
$$;

/** Lecture du journal, la plus récente d'abord, avec le pseudo de la cible quand elle en a un. */
create or replace function public.admin_list_audit_log(p_limit integer default 200, p_action text default null)
returns table(id bigint, created_at timestamptz, actor_email text, action text,
              target_user_id uuid, target_name text, details jsonb)
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then raise exception 'Réservé au staff'; end if;
  return query
    select a.id, a.created_at, a.actor_email, a.action, a.target_user_id, s.display_name, a.details
    from admin_audit_log a
    left join player_stats s on s.user_id = a.target_user_id
    where p_action is null or a.action = p_action
    order by a.created_at desc
    limit greatest(1, least(1000, coalesce(p_limit, 200)));
end; $$;

revoke all on function public.admin_audit(text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.admin_audit_log_append_only() from public, anon, authenticated;
revoke all on function public.admin_list_audit_log(integer, text) from public, anon;
grant execute on function public.admin_list_audit_log(integer, text) to authenticated;

-- ---------- instrumentation des 18 RPC qui MODIFIENT quelque chose ----------
-- Les RPC de lecture ne sont volontairement PAS auditées : consulter une liste n'est pas une
-- action, et noyer le journal sous des lectures le rendrait inutilisable au moment où il compte.
do $do$
declare
  -- nom, expression de la cible (uuid ou null), expression des détails (jsonb ou null).
  -- Les expressions sont évaluées DANS la fonction : elles peuvent donc nommer ses paramètres.
  v_cibles text[][] := array[
    ['admin_ban_player',             'p_user_id', 'jsonb_build_object(''duration_hours'', p_duration_hours, ''reason'', p_reason)'],
    ['admin_unban_player',           'p_user_id', 'null'],
    ['admin_add_mod',                'p_user_id', 'null'],
    ['admin_remove_mod',             'p_user_id', 'null'],
    ['admin_add_tester',             'p_user_id', 'null'],
    ['admin_remove_tester',          'p_user_id', 'null'],
    ['admin_reset_account_by_uuid',  'p_user_id', 'jsonb_build_object(''title_fr'', p_title_fr, ''body_fr'', p_body_fr)'],
    ['admin_reset_all_accounts',     'null',      'jsonb_build_object(''title_fr'', p_title_fr, ''body_fr'', p_body_fr)'],
    ['admin_reset_all_quests',       'null',      'null'],
    ['admin_refund_last_sell_mats',  'null',      'jsonb_build_object(''pseudo'', p_pseudo)'],
    ['admin_set_loot_rates',         'null',      'jsonb_build_object(''rates'', p_rates)'],
    ['admin_set_market_open',        'null',      'jsonb_build_object(''open'', p_open)'],
    ['admin_cancel_all_market_orders','null',     'null'],
    ['admin_spawn_boss',             'null',      'jsonb_build_object(''boss_id'', p_boss_id, ''minutes'', p_minutes, ''hp'', p_hp)'],
    ['admin_despawn_boss',           'null',      'null'],
    ['admin_broadcast_notice',       'null',      'jsonb_build_object(''notice_key'', p_notice_key, ''title_fr'', p_title_fr)'],
    ['admin_add_donation',           'null',      'jsonb_build_object(''amount_usd'', p_amount_usd, ''donor_label'', p_donor_label)'],
    ['admin_resolve_violation',      'null',      'jsonb_build_object(''violation_id'', p_id, ''resolution'', p_resolution)']
  ];
  v_i int;
  v_nom text; v_def text; v_new text; v_appel text; v_nb int;
  -- la garde est écrite tantôt sur une ligne, tantôt sur deux selon la fonction
  v_motif constant text := '(Réservé au staff''; *\r?\n? *end if;)';
begin
  for v_i in 1 .. array_length(v_cibles, 1) loop
    v_nom := v_cibles[v_i][1];
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = v_nom;
    if v_def is null then
      raise exception 'Fonction % introuvable : instrumentation impossible', v_nom;
    end if;
    -- déjà instrumentée (migration rejouée) : on ne double pas l'appel
    if position('admin_audit(' in v_def) > 0 then
      continue;
    end if;
    select count(*) into v_nb from regexp_matches(v_def, v_motif, 'g');
    if v_nb <> 1 then
      raise exception 'Garde staff trouvée % fois dans % : insertion refusée', v_nb, v_nom;
    end if;
    v_appel := format(E'\\1\n  perform admin_audit(%L, %s, %s);',
                      v_nom, v_cibles[v_i][2], v_cibles[v_i][3]);
    v_new := regexp_replace(v_def, v_motif, v_appel);
    execute v_new;
  end loop;
end $do$;
