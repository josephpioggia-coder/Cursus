-- CURSUS — usage_ia_projet : registre de l'usage des outils d'IA par livre (24/10/2026)
-- ======================================================================
-- Demande de Joseph : le « Dossier de création » d'un livre doit pouvoir dire
-- honnêtement quels outils d'IA de CURSUS ont été utilisés sur ce livre, et
-- quand. Une ligne par événement :
--   action 'lance'    : un outil a été lancé (Correction rapide, Vérifier le fond,
--                       analyse du Co-pilote) ;
--   action 'applique' : des modifications proposées par l'outil ont été APPLIQUÉES
--                       au texte (`nb` = nombre de passages modifiés).
-- Ne contient JAMAIS de texte du livre. Ne couvre pas ce qui se fait hors de Cursus.
-- À EXÉCUTER par Joseph dans l'éditeur SQL de Supabase.

create table if not exists usage_ia_projet (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  projet_id  uuid not null,
  noeud_id   uuid,
  outil      text not null check (outil in ('correction_rapide', 'verifier_le_fond', 'copilote')),
  action     text not null check (action in ('lance', 'applique')),
  nb         integer,
  cree_le    timestamptz not null default now()
);

create index if not exists idx_usage_ia_projet_projet on usage_ia_projet(projet_id);

alter table usage_ia_projet enable row level security;

create policy "usage_ia_projet : lecture par le propriétaire"
  on usage_ia_projet for select using (auth.uid() = user_id);
create policy "usage_ia_projet : écriture par le propriétaire"
  on usage_ia_projet for insert with check (auth.uid() = user_id);
