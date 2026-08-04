-- CURSUS — Cadre administrateur : table des administrateurs (60804-03)
-- ======================================================================
-- Utilisée par l'Edge Function admin-codes-promo pour vérifier que
-- l'appelant est bien le propriétaire du logiciel avant d'autoriser la
-- création/désactivation d'un code promotionnel. RLS fermée : aucun
-- accès direct depuis le navigateur, seul service_role (Edge Functions)
-- peut lire cette table.

create table admins (
  id      uuid primary key default gen_random_uuid(),
  email   text not null unique,
  cree_le timestamptz not null default now()
);

alter table admins enable row level security;
-- Aucune policy créée volontairement : deny total pour anon/authenticated.

insert into admins (email) values ('joseph.pioggia@gmail.com');
