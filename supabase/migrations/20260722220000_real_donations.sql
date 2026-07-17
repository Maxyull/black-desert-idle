-- Dons RÉELS (2026-07-22). La page /donation affichait des valeurs de MAQUETTE : "180 $ collectés",
-- "72% des coûts couverts" et 5 donateurs nommés (Kaelthorne, Wyrmshade, Nocturia, Aelindra,
-- Draukin) + "12 autres" -- tous inventés, sous une légende "Pseudos affichés uniquement avec
-- l'accord du donateur" et un encart "Transparence totale". Réalité vérifiée à cette date : 0 don,
-- 0 donateur. Cette table est la seule source de vérité désormais : pas de ligne = rien d'affiché,
-- jamais de chiffre fabriqué.
create table if not exists public.donations (
  id            bigserial primary key,
  amount_usd    numeric(10,2) not null check (amount_usd > 0),
  received_at   timestamptz   not null default now(),
  -- pseudo affiché publiquement UNIQUEMENT si le donateur a donné son accord explicite
  -- (donor_label non nul ET is_public vrai) -- c'est ce que promet la légende de la page.
  donor_label   text,
  is_public     boolean       not null default false,
  note          text,
  created_at    timestamptz   not null default now()
);
-- RLS sans aucune policy = deny-all pour anon/authenticated : les montants individuels ne sont
-- jamais lisibles directement. Tout passe par le RPC d'agrégat ci-dessous.
alter table public.donations enable row level security;
create index if not exists donations_received_at_idx on public.donations (received_at desc);

-- Résumé PUBLIC : uniquement des agrégats + les pseudos ayant consenti. Ne renvoie jamais le
-- montant donné par une personne identifiable.
create or replace function public.donation_public_summary()
returns jsonb language sql security definer set search_path to 'public' stable as $fn$
  select jsonb_build_object(
    'month_total_usd', coalesce((select sum(amount_usd) from public.donations
                                 where received_at >= date_trunc('month', now())), 0),
    'donor_count',     (select count(*) from public.donations
                        where received_at >= date_trunc('month', now())),
    'public_donors',   coalesce((
      select jsonb_agg(d.donor_label order by d.total desc)
      from (select donor_label, sum(amount_usd) as total from public.donations
            where is_public and donor_label is not null and btrim(donor_label) <> ''
            group by donor_label) d), '[]'::jsonb)
  );
$fn$;
grant execute on function public.donation_public_summary() to anon, authenticated;

-- Saisie réservée au staff (même garde email que les autres admin_*). En attendant un éventuel
-- webhook PayPal, c'est le point d'entrée pour enregistrer un don réel.
create or replace function public.admin_add_donation(
  p_amount_usd numeric, p_donor_label text default null,
  p_is_public boolean default false, p_received_at timestamptz default now(), p_note text default null
) returns bigint language plpgsql security definer set search_path to 'public' as $fn$
declare v_id bigint;
begin
  if coalesce(auth.jwt()->>'email','') is distinct from 'maxime.lacoste@icloud.com' then
    raise exception 'Réservé au staff';
  end if;
  if p_amount_usd is null or p_amount_usd <= 0 then raise exception 'Montant invalide'; end if;
  insert into public.donations(amount_usd, donor_label, is_public, received_at, note)
  values (p_amount_usd, nullif(btrim(p_donor_label), ''), coalesce(p_is_public, false),
          coalesce(p_received_at, now()), p_note)
  returning id into v_id;
  return v_id;
end;
$fn$;
revoke all on function public.admin_add_donation(numeric, text, boolean, timestamptz, text) from public, anon;
grant execute on function public.admin_add_donation(numeric, text, boolean, timestamptz, text) to authenticated;
