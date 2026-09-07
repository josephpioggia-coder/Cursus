-- CURSUS — Consentement à la supervision humaine (référence 60816-01, suite, 07/09/2026)
-- ======================================================================
-- Demandé explicitement par l'auteur du projet avant qu'Annie (première
-- utilisatrice réelle hors test) ne commence à encoder ses questionnaires :
-- avant de créer un audit, l'auteur·ice doit accepter explicitement que
-- les données transmises (texte, réponses au questionnaire) puissent être
-- supervisées/relues par l'équipe Cursus, dans un cadre confidentiel/
-- déontologique, avec la possibilité qu'un premier examen débouche sur un
-- devis si un travail de relecture humaine non compris dans l'offre de
-- base s'avère nécessaire. Valable pour tous les utilisateurs (pas
-- seulement Annie), consentement demandé À CHAQUE AUDIT créé (décision du
-- 07/09/2026 : pas de case "une fois pour tout le compte" — chaque projet
-- transmis a sa propre trace de consentement, plus simple à produire en
-- cas de litige qu'une case globale datée d'un jour quelconque).
--
-- Migration jamais appliquée automatiquement : à copier-coller dans le SQL
-- Editor Supabase après relecture, comme les migrations précédentes de ce
-- dépôt. `audits` existe déjà (voir 2026-08-15-cursaudit-schema.sql) — ALTER
-- seulement, jamais de CREATE TABLE ici.

alter table audits
  add column if not exists consentement_supervision    boolean not null default false,
  add column if not exists consentement_supervision_le  timestamptz;

-- Pas de contrainte NOT NULL / CHECK bloquant consentement_supervision = true
-- au niveau base : la garantie réelle vit côté UI (CursAudit.jsx, bouton
-- "Créer l'audit" désactivé tant que la case n'est pas cochée), comme pour
-- les autres champs de qualification de ce formulaire (typeDocument,
-- finaliteAudit...). Une contrainte stricte en base casserait toute
-- création faite hors UI (script, futur import) sans bénéfice réel : le
-- consentement n'a de sens que recueilli au moment précis de la
-- transmission, pas vérifiable a posteriori par une contrainte SQL.

select 'Colonnes de consentement ajoutées à audits ✓' as résultat;
