-- CURSUS — Demandes de mise en page (référence 60816-01, suite, 24/08/2026)
-- ======================================================================
-- Deux problèmes de qualité d'import détectés à l'écran de création
-- (voir diagnostiquerQualitéImport() dans segmenterCursAudit.js) : une
-- segmentation irrégulière (une ligne = un paragraphe, gonfle le nombre
-- d'unités et donc le prix/temps de l'audit détaillé) et des titres de
-- chapitres quasi inexistants. Décision de l'auteur du projet le
-- 24/08/2026 : ce n'est PAS un correctif silencieux côté code — le
-- client doit être informé et choisir entre corriger lui-même son
-- fichier et réimporter, ou commander une mise en page payante. Cette
-- table enregistre cette seconde option.
--
-- Statut "en_attente_paiement" pour l'instant : CursAudit n'a pas encore
-- de Stripe, même principe que le statut "brouillon" des audits eux-mêmes
-- — la demande est enregistrée, rien n'est encaissé ni exécuté tant que
-- le paiement CursAudit n'est pas câblé.

create table demandes_mise_en_page (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  nom_fichier text,
  type text not null check (type in ('structuration_seule', 'complete')),
  prix_ttc numeric not null,
  nombre_mots integer,
  nombre_unites integer,
  nombre_titres_detectes integer,
  statut text not null default 'en_attente_paiement',
  created_at timestamptz not null default now()
);

alter table demandes_mise_en_page enable row level security;

create policy "Les utilisateurs voient leurs propres demandes de mise en page"
  on demandes_mise_en_page for select
  using (auth.uid() = user_id);

create policy "Les utilisateurs créent leurs propres demandes de mise en page"
  on demandes_mise_en_page for insert
  with check (auth.uid() = user_id);

select 'demandes_mise_en_page créée ✓' as résultat;
