-- CURSUS — Quota mensuel de lecture à voix haute par palier (22/10/2026)
-- ======================================================================
-- La voix fait partie du "pack" de chaque palier (liste de fonctionnalités
-- de contenuPaliers.js) avec un plafond mensuel de caractères lus, et
-- pourra se vendre en recharge (credits_voix — Stripe PAS encore branché).
-- Ordre de grandeur (estimation, non garantie) : 1 000 caractères ≈ 1 minute
-- d'audio ≈ 1,5 centime chez OpenAI.
-- Valeurs ci-dessous = PROPOSITION, modifiables à tout moment par UPDATE.
-- Tant que ce fichier n'est pas exécuté, lire-texte applique 30 000
-- caractères/mois à tout le monde.

alter table quotas_paliers add column if not exists caracteres_voix_mensuels integer;

update quotas_paliers set caracteres_voix_mensuels = 10000  where palier ilike 'd_couverte';
update quotas_paliers set caracteres_voix_mensuels = 30000  where palier ilike 'essentiel';
update quotas_paliers set caracteres_voix_mensuels = 60000  where palier ilike 'initi_';
update quotas_paliers set caracteres_voix_mensuels = 150000 where palier ilike 'auteur';
update quotas_paliers set caracteres_voix_mensuels = 150000 where palier ilike 'studio';

create table if not exists credits_voix (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  caracteres integer not null check (caracteres > 0),
  motif      text,
  cree_le    timestamptz not null default now()
);

create index if not exists idx_credits_voix_user on credits_voix(user_id);

alter table credits_voix enable row level security;

-- Lecture : chacun voit ses propres crédits. Aucune policy d'écriture :
-- seules les Edge Functions / l'éditeur SQL (service_role) en ajoutent.
drop policy if exists "credits_voix_propre" on credits_voix;
create policy "credits_voix_propre" on credits_voix
  for select using (auth.uid() = user_id);

-- Exemple pour offrir 50 000 caractères à un compte (à adapter) :
-- insert into credits_voix (user_id, caracteres, motif)
-- select id, 50000, 'cadeau' from auth.users where email = 'adresse@exemple.com';
