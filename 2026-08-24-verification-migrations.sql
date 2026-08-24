-- CURSUS — Vérification des migrations du chantier CursAudit (24/08/2026)
-- ======================================================================
-- Script de LECTURE SEULE (aucun alter/insert/update/delete) — vérifie,
-- migration par migration, si elle a déjà été exécutée. Certaines
-- migrations ont un effet transitoire annulé par une migration
-- ultérieure (ex. le barème par tranche de preaudit-tarif-v2, supprimé
-- ensuite par preaudit-vrai) : pour celles-là, on vérifie l'état final
-- qui compte réellement aujourd'hui, pas chaque étape intermédiaire.

select
  '1. audit-criteria-categories' as migration,
  exists (
    select 1 from information_schema.columns
    where table_name = 'audit_criteria' and column_name = 'categories'
  ) as deja_fait

union all
select
  '2. tarification-cout-reel',
  exists (
    select 1 from audit_pricing_rules
    where categorie = 'parametre_global' and cle = 'taux_usd_vers_eur'
  )
  and exists (
    select 1 from audit_pricing_rules
    where categorie = 'parametre_global' and cle = 'cout_unite_base' and valeur_numerique = 0.0189
  )

union all
select
  '3+7. preaudit-global + preaudit-vrai (colonnes audits)',
  exists (select 1 from information_schema.columns where table_name = 'audits' and column_name = 'apercu_statut')
  and exists (select 1 from information_schema.columns where table_name = 'audits' and column_name = 'preaudit_statut')

union all
select
  '4. audits-questionnaire',
  exists (
    select 1 from information_schema.columns
    where table_name = 'audits' and column_name = 'type_document'
  )

union all
select
  '5. preaudit-tarif-v2',
  null::boolean
  -- Non vérifiable : son effet (barème par tranche de mots) est
  -- entièrement supprimé par preaudit-vrai (migration 7), qui remplace
  -- le modèle de prix par un pourcentage. Sans conséquence aujourd'hui,
  -- que cette migration ait tourné ou non.

union all
select
  '6. codes-promo-cursaudit',
  exists (
    select 1 from information_schema.columns
    where table_name = 'codes_promo' and column_name = 'produit_cible'
  )

union all
select
  '7. preaudit-vrai (tarification %)',
  exists (
    select 1 from audit_pricing_rules
    where categorie = 'parametre_global' and cle = 'preaudit_pourcentage_prix_final' and valeur_numerique = 40
  )
  and exists (
    select 1 from audit_pricing_rules
    where categorie = 'parametre_global' and cle = 'preaudit_deduction_pourcentage' and valeur_numerique = 50
  )

union all
select
  '8. preaudit-3-passages',
  exists (select 1 from information_schema.columns where table_name = 'audits' and column_name = 'preaudit_brouillon')
  and exists (select 1 from information_schema.columns where table_name = 'audits' and column_name = 'preaudit_critique_gpt');
