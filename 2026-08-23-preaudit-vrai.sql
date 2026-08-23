-- CURSUS — Séparer l'aperçu gratuit du vrai pré-audit payant, en % du prix
-- de l'audit final (réf. 60816-01, suite, 23/08/2026)
-- ======================================================================
-- Erreur de conception corrigée : ce qui existait sous le nom "pré-audit"
-- (une seule lecture globale, une page de synthèse — genre, colonne
-- vertébrale, tensions, forces/risques, recommandation de palier) n'est
-- QUE la phase 1 décrite par l'auteur du projet le 15/08/2026 : "un
-- travail plus léger qui permettrait à moindre coût de comprendre que
-- quelque chose doit être fait" — un aperçu/orientation, pas un livrable.
-- Rendu gratuit le 23/08/2026 (2026-08-23-preaudit-gratuit.sql), c'était
-- la bonne décision, mais pour la phase 1 seulement.
--
-- La phase 2 — "le travail suivant, qui coûterait beaucoup plus cher" —
-- n'avait jamais été construite. C'est elle, le VRAI pré-audit : elle
-- reprend les hypothèses/priorités identifiées par l'aperçu et le
-- questionnaire, et les développe (hypothèses à vérifier, échantillons
-- précis, décision éditoriale) — voir preaudit-approfondi-cursaudit.
--
-- Renomme les colonnes existantes (phase 1, gratuite) de preaudit_* vers
-- apercu_*, et réintroduit preaudit_* pour la phase 2 (payante).
--
-- TARIFICATION DE LA PHASE 2, décidée par l'auteur du projet le 23/08/2026 :
-- un pourcentage du prix de l'audit détaillé (déjà connu à la création),
-- PAS un barème par tranche de mots — le barème "preaudit_global_palier"
-- (mis à 0 par erreur hier, il visait déjà la phase 2 dans l'esprit de
-- l'auteur du projet, jamais la phase 1) est donc supprimé, remplacé par
-- deux pourcentages :
--  - pré-audit = 40 % du prix TTC de l'audit détaillé ;
--  - si l'audit détaillé est commandé ensuite, 50 % du prix du pré-audit
--    (= 20 % du prix de l'audit détaillé) en est déduit, informationnel
--    pour l'instant (pas de paiement Stripe pour l'appliquer automatiquement).

alter table audits rename column preaudit_statut to apercu_statut;
alter table audits rename column preaudit_prix_ht to apercu_prix_ht;
alter table audits rename column preaudit_resultat to apercu_resultat;

alter table audits
  add column preaudit_statut  text not null default 'non_demande'
    check (preaudit_statut in ('non_demande', 'paye', 'termine')),
  add column preaudit_prix_ht numeric,
  add column preaudit_resultat jsonb;

delete from audit_pricing_rules where categorie = 'preaudit_global_palier';

insert into audit_pricing_rules (categorie, cle, libelle, valeur_numerique, description) values
  ('parametre_global', 'preaudit_pourcentage_prix_final', 'Pré-audit : % du prix de l''audit final', 40,
   'Prix TTC du pré-audit = ce pourcentage du prix TTC de l''audit détaillé, déjà calculé à la création.'),
  ('parametre_global', 'preaudit_deduction_pourcentage', 'Pré-audit : % déductible de l''audit final', 50,
   'Si l''audit détaillé est commandé après le pré-audit, ce pourcentage du prix du pré-audit est déduit du prix de l''audit détaillé (informationnel : aucun paiement Stripe ne l''applique automatiquement pour l''instant).');

select 'apercu_* (gratuit) + preaudit_* (payant, % du prix final) séparés ✓' as résultat;
