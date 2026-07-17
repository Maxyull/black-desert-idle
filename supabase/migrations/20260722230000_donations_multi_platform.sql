-- Multi-plateformes (2026-07-22) : la table ne gérait que la saisie manuelle en USD.
-- 1) IDEMPOTENCE : les webhooks RETENTENT (PayPal rejoue le même événement). Sans identifiant
--    externe unique, un don de 50 $ serait compté plusieurs fois -> on recréerait le chiffre gonflé
--    qu'on vient de supprimer de la page, mais automatisé.
-- 2) DEVISE : amount_usd supposait des dollars, or Ko-fi/Tipeee/PayPal EU envoient des EUROS.
-- 3) SOURCE : d'où vient le don (paypal/kofi/stripe/manual).
alter table public.donations
  add column if not exists source          text        not null default 'manual',
  add column if not exists external_id     text,
  add column if not exists currency        char(3)     not null default 'USD',
  add column if not exists amount_original numeric(10,2),
  add column if not exists fx_to_usd       numeric(12,6);

update public.donations set amount_original = amount_usd where amount_original is null;

comment on column public.donations.amount_usd is
  'Montant NET converti en USD -- seule colonne utilisée pour le total public (les coûts du projet sont en USD).';
comment on column public.donations.amount_original is
  'Montant réellement reçu, dans la devise du donateur (voir currency). Conservé pour audit.';
comment on column public.donations.fx_to_usd is
  'Taux appliqué pour obtenir amount_usd depuis amount_original. 1 si déjà en USD.';
comment on column public.donations.external_id is
  'Identifiant de l''événement chez la plateforme. Sert UNIQUEMENT à l''idempotence : les webhooks retentent.';

-- La contrainte qui empêche le double-comptage. Partielle : la saisie manuelle n'a pas d'external_id.
create unique index if not exists donations_source_external_uniq
  on public.donations (source, external_id) where external_id is not null;
