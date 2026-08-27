-- CURSAUDIT — Fiche d'action éditoriale (référence 60816-01, suite, 27/08/2026)
-- Second document, court et actionnable, généré à partir du pré-audit déjà
-- produit (jamais une relecture du manuscrit) — voir
-- fiche-action-preaudit-cursaudit/index.ts.

alter table audits
  add column if not exists fiche_action_statut text not null default 'non_demande',
  add column if not exists fiche_action_resultat jsonb;
