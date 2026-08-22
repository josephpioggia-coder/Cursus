-- CURSUS — audits : colonnes du questionnaire de qualification (réf. 60816-01, suite)
-- ======================================================================
-- Met en base les sections 1, 2, 3, 4, 5, 7, 10 de
-- questionnaire-cursaudit-v1-specification.md (figé le 15/08/2026, jamais
-- câblé jusqu'ici — écart signalé par l'auteur du projet le 22/08/2026 en
-- relisant les textes de l'écran de choix d'espace).
--
-- Sections 8 (niveau de preuve attendu) et 9 (sortie attendue) : PAS de
-- nouvelle colonne — la note technique du document d'origine les fait
-- correspondre directement à palier_dimensions/mode_ia et type_rapport,
-- déjà présents dans `audits` depuis 2026-08-15-cursaudit-schema.sql.
--
-- Section 6 (préserver ma voix, comparaison à des pages de référence) :
-- volontairement PAS incluse ici — le document d'origine la marque
-- lui-même "hors périmètre", nécessitant son propre stockage (pages de
-- référence de l'auteur·e) et sa propre logique de comparaison
-- stylistique, jamais conçus.

alter table audits
  add column type_document          text,
  add column statut_texte           text,
  add column finalite_audit         text[],
  add column question_libre         text,
  add column degre_intervention     text,
  add column contraintes_academiques jsonb,
  add column relation_ia            jsonb;

select 'audits : colonnes du questionnaire ajoutées ✓' as résultat;
