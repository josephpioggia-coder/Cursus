-- CURSUS — Pont audits ↔ projets CursEdit (référence 60816-01, suite, 12/09/2026)
-- ======================================================================
-- `audits.projet_id` était déjà prévu dans le tout premier schéma CursAudit
-- (2026-08-15-cursaudit-schema.sql, "pont bidirectionnel sans réimport") et
-- documenté comme déjà présent en base à cette date-là — mais jamais vérifié
-- depuis, jamais câblé côté écran, et ce dépôt a déjà eu plusieurs cas
-- (consentement_supervision, chapitres_confirmes...) où une colonne
-- "documentée comme existante" ne l'était pas réellement en production.
-- ADD COLUMN IF NOT EXISTS ne fait rien si la colonne existe déjà — sans
-- danger de la réexécuter.
--
-- Demandé par l'auteur du projet le 12/09/2026 : les rapports produits par
-- CursAudit (aperçu, fiche d'action du pré-audit, rapport consolidé de
-- l'audit détaillé) doivent pouvoir être envoyés vers CursEdit comme un
-- nouveau chapitre d'un projet, modifiable normalement — voir
-- envoyerVersCursEdit() dans CursAuditDetail.jsx et auditsAPI.lierProjet()
-- dans src/lib/api.js.

alter table audits
  add column if not exists projet_id uuid references projets(id) on delete set null;

create index if not exists idx_audits_projet on audits(projet_id);

select 'audits.projet_id (+ index) vérifiée/ajoutée ✓' as résultat;
