-- CURSUS — État intermédiaire du pré-audit chapitre par chapitre
-- (référence 60816-01, suite, 24/08/2026)
-- ======================================================================
-- Complète 2026-08-24-chapitres-preaudit-enrichi.sql (chapitres_detectes,
-- chapitres_confirmes). Cette colonne stocke la progression du pipeline
-- pré-audit sur la boucle chapitre par chapitre, un tableau à une entrée
-- par chapitre confirmé : [{ lecture, relecture }, ...] — même principe
-- que preaudit_brouillon / preaudit_critique_gpt pour les passages
-- globaux, mais un état par chapitre plutôt qu'une seule valeur, pour
-- reprendre exactement où le pipeline s'est arrêté entre deux appels HTTP.

alter table audits
  add column preaudit_chapitres_resultats jsonb;

select 'preaudit_chapitres_resultats ajoutée ✓' as résultat;
