-- CURSUS — Pré-audit global : barème révisé (réf. 60816-01, suite, 22/08/2026)
-- ======================================================================
-- L'auteur du projet a jugé le premier barème (dégressif, 25€→140€ HT pour
-- 10000-80000 mots) trop cher, et propose un barème parfaitement linéaire :
-- +12€ HT par tranche de 10000 mots (24€ à 10000 mots, 132€ à 100000 mots).
--
-- Hypothèse assumée, non confirmée explicitement : au-delà de 100000 mots,
-- la règle continue logiquement à +12€ HT/tranche de 10000 mots (plutôt que
-- de revenir au +10€ de l'ancien barème, qui n'a plus de sens une fois la
-- table elle-même devenue linéaire à +12€). À corriger si ce n'est pas
-- l'intention.

delete from audit_pricing_rules where categorie = 'preaudit_global_palier';

insert into audit_pricing_rules (categorie, cle, libelle, valeur_numerique, description) values
  ('preaudit_global_palier', '10000',  'Jusqu''à 10 000 mots',  24,  'Prix HT. Sert aussi de plancher pour tout texte ≤ 10 000 mots.'),
  ('preaudit_global_palier', '20000',  'Jusqu''à 20 000 mots',  36,  'Prix HT.'),
  ('preaudit_global_palier', '30000',  'Jusqu''à 30 000 mots',  48,  'Prix HT.'),
  ('preaudit_global_palier', '40000',  'Jusqu''à 40 000 mots',  60,  'Prix HT.'),
  ('preaudit_global_palier', '50000',  'Jusqu''à 50 000 mots',  72,  'Prix HT.'),
  ('preaudit_global_palier', '60000',  'Jusqu''à 60 000 mots',  84,  'Prix HT.'),
  ('preaudit_global_palier', '70000',  'Jusqu''à 70 000 mots',  96,  'Prix HT.'),
  ('preaudit_global_palier', '80000',  'Jusqu''à 80 000 mots',  108, 'Prix HT.'),
  ('preaudit_global_palier', '90000',  'Jusqu''à 90 000 mots',  120, 'Prix HT.'),
  ('preaudit_global_palier', '100000', 'Jusqu''à 100 000 mots', 132, 'Prix HT. Au-delà : +12€ HT par tranche de 10 000 mots supplémentaire (continuité du barème linéaire, à confirmer).');

select cle, valeur_numerique from audit_pricing_rules where categorie = 'preaudit_global_palier' order by cle::int;
