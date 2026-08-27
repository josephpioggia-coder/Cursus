-- CURSAUDIT — Synthèse de l'audit détaillé (référence 60816-01, suite,
-- 27/08/2026) — équivalent de la fiche d'action, côté audit détaillé
-- (~1400+ unités) plutôt que côté pré-audit. Voir
-- synthese-audit-detaille-cursaudit/index.ts.

alter table audits
  add column if not exists synthese_audit_statut text not null default 'non_demande',
  add column if not exists synthese_audit_resultat jsonb;
