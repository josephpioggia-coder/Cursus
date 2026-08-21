-- CURSUS — codes_promo : cibler CursEdit ou CursAudit (référence 60816-01, suite)
-- ======================================================================
-- La table codes_promo (2026-08-04-codes-promo.sql) a une colonne
-- palier_cible pensée pour les paliers d'abonnement CursEdit, mais rien ne
-- distingue "ce code vaut pour CursEdit" de "ce code vaut pour CursAudit" —
-- ambiguïté à lever avant de construire le checkout Stripe de CursAudit
-- (qui réutilisera consommer_code_promo() comme creer-session-checkout le
-- fait déjà pour CursEdit).
--
-- null = valable pour les deux produits (comportement des codes existants,
-- inchangé — cette migration ne casse rien de ce qui tourne déjà).

alter table codes_promo
  add column produit_cible text check (produit_cible in ('cursedit', 'cursaudit'));

select 'codes_promo.produit_cible ajoutée ✓' as résultat;
