-- CURSAUDIT — Contrat d'intention (référence 60816-01, suite, 28/08/2026)
-- Voir docs/PAQUET-DE-REPRISE-2026-08-27.md, [CHANTIER-CONTRAT-INTENTION],
-- et CursAuditQuestionnaire.jsx. Objet libre stocké tel quel, pas de
-- colonnes séparées par champ (mêmes principes que preaudit_resultat,
-- fiche_action_resultat, synthese_audit_resultat).

alter table audits
  add column if not exists contrat_intention jsonb;
