-- CURSUS — Pré-audit global du manuscrit (réf. 60816-01, suite, 22/08/2026)
-- ======================================================================
-- Idée de l'auteur du projet, affinée avec GPT : avant de payer/lancer
-- l'audit détaillé (1419 appels IA sur "là où les portes s'ouvrent" ≈
-- 29 $, plusieurs heures), une lecture globale bon marché du manuscrit
-- ENTIER en UN SEUL appel IA (claude-sonnet-5 a une fenêtre de contexte
-- de 1M tokens — un livre de cette taille y tient largement) donne :
-- nature du texte, colonne vertébrale, tension principale, forces/risques
-- globaux, et une recommandation de palier pour l'audit détaillé. Coût
-- réel estimé de l'ordre de quelques dizaines de centimes à 1 $, sans
-- commune mesure avec l'audit complet.
--
-- Reprend GPT en le resserrant : sa taxonomie biologique
-- (endosquelette/mycélium/fleuve...) et ses "formats dérivés" sont écartés
-- — utile comme inspiration, pas assez fiable/universel pour être un
-- champ structuré exploitable d'un livre à l'autre.
--
-- Tarif fourni par l'auteur du projet : barème dégressif par tranche de
-- mots, plancher ≈26€ HT (celui déjà en vigueur ailleurs dans l'offre pour
-- un acte jusqu'à 50 pages), pallier à +10€/tranche de 10000 mots au-delà
-- de 80000 mots.

-- ── Colonnes sur `audits` : cycle de vie du pré-audit, séparé de l'audit
--    détaillé (statut, prix, résultat propres) ────────────────────────
alter table audits
  add column preaudit_statut  text not null default 'non_demande'
    check (preaudit_statut in ('non_demande', 'paye', 'termine')),
  add column preaudit_prix_ht numeric,
  add column preaudit_resultat jsonb;

-- ── Barème de prix par tranche de mots, dans audit_pricing_rules
--    (même table que le reste de la tarification CursAudit) ───────────
alter table audit_pricing_rules drop constraint audit_pricing_rules_categorie_check;
alter table audit_pricing_rules add constraint audit_pricing_rules_categorie_check
  check (categorie in ('palier_dimensions', 'mode_ia', 'type_rapport', 'parametre_global', 'preaudit_global_palier'));

insert into audit_pricing_rules (categorie, cle, libelle, valeur_numerique, description) values
  ('preaudit_global_palier', '10000', 'Jusqu''à 10 000 mots', 25,  'Prix HT. Sert aussi de plancher pour tout texte ≤ 10 000 mots.'),
  ('preaudit_global_palier', '20000', 'Jusqu''à 20 000 mots', 45,  'Prix HT.'),
  ('preaudit_global_palier', '30000', 'Jusqu''à 30 000 mots', 65,  'Prix HT.'),
  ('preaudit_global_palier', '40000', 'Jusqu''à 40 000 mots', 85,  'Prix HT.'),
  ('preaudit_global_palier', '50000', 'Jusqu''à 50 000 mots', 100, 'Prix HT.'),
  ('preaudit_global_palier', '60000', 'Jusqu''à 60 000 mots', 115, 'Prix HT.'),
  ('preaudit_global_palier', '70000', 'Jusqu''à 70 000 mots', 130, 'Prix HT.'),
  ('preaudit_global_palier', '80000', 'Jusqu''à 80 000 mots', 140, 'Prix HT. Au-delà : +10€ HT par tranche de 10 000 mots supplémentaire.');

select 'preaudit global : colonnes audits + barème de prix ajoutés ✓' as résultat;
