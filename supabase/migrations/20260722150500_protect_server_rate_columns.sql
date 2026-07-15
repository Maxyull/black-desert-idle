-- Suite immédiate de player_hour_rates_fair_leaderboard.sql (V454) : les colonnes
-- silver_per_hour / best_kpm / *_week de player_stats sont désormais PROPRIÉTÉ DU SERVEUR
-- (compute_player_hour_rates(), cron horaire). Constaté juste après le reset de la migration
-- précédente : les clients encore en ligne (ancienne version, syncPlayerStats() périodique)
-- re-poussaient immédiatement leurs vieux records gonflés (pics 3 min extrapolés) par-dessus le
-- reset. Un simple correctif client ne suffit pas (un onglet jamais rechargé pousserait encore
-- des semaines) -- ce trigger neutralise la source : toute écriture VENANT D'UN CLIENT
-- authentifié (auth.uid() non nul via PostgREST) sur ces 4 colonnes est ignorée (UPDATE : valeur
-- existante conservée ; INSERT : 0). Le cron/l'admin SQL (auth.uid() null) écrivent normalement.
-- Les autres colonnes du même upsert client passent comme avant -- aucun sync ne casse, même pour
-- les vieux clients.

create or replace function public.protect_server_rate_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is not null then
    if tg_op = 'UPDATE' then
      new.silver_per_hour      := old.silver_per_hour;
      new.best_kpm             := old.best_kpm;
      new.silver_per_hour_week := old.silver_per_hour_week;
      new.best_kpm_week        := old.best_kpm_week;
    else
      new.silver_per_hour      := 0;
      new.best_kpm             := 0;
      new.silver_per_hour_week := 0;
      new.best_kpm_week        := 0;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_server_rate_columns_trg on public.player_stats;
-- AVANT clamp_player_stats (ordre alphabétique des noms de triggers BEFORE, "clamp..." < "protect..."
-- donc clamp passe d'abord -- sans importance : clamp ne fait que borner, ce trigger fixe ensuite
-- la valeur finale depuis OLD/0, déjà bornée par construction).
create trigger protect_server_rate_columns_trg
  before insert or update on public.player_stats
  for each row execute function public.protect_server_rate_columns();

-- re-reset (le premier a été écrasé par les clients en ligne pendant la fenêtre entre les deux
-- migrations) puis recalcul immédiat depuis les journaux -- désormais protégé par le trigger.
update public.player_stats set silver_per_hour = 0, best_kpm = 0;
select public.compute_player_hour_rates(72);
