-- Rappels de renouvellement des abonnements ANNUELS (15/11/2026) : un seul rappel par abonnement ET par période.
-- Écrite et lue uniquement par l'Edge Function `rappel-renouvellement` (clé service_role) : RLS activée, aucune règle pour les clients.
create table if not exists public.rappels_renouvellement (
  stripe_subscription_id text not null,
  periode_fin timestamptz not null,
  email text,
  envoye_le timestamptz not null default now(),
  primary key (stripe_subscription_id, periode_fin)
);
alter table public.rappels_renouvellement enable row level security;
