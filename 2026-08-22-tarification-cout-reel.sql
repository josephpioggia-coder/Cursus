-- CURSUS — audit_pricing_rules : coût de base réel + conversion USD→EUR (60816-01, suite)
-- ======================================================================
-- `cout_unite_base` (0,013 €) était une estimation a priori du calculateur
-- Excel d'origine ("calibré sur 150 pages / 8 dimensions / 1 IA / 8,5
-- unités/page"), jamais confrontée à un vrai appel IA. Le 22/08/2026, un
-- premier audit réel (1419 unités, palier Essentiel, mode 1 IA) a permis
-- de mesurer un coût réel sur une unité : 2619 tokens entrée + 1528
-- tokens sortie, au tarif officiel confirmé de claude-sonnet-5
-- (2 $/M entrée, 10 $/M sortie) = 0,020518 $/unité.
--
-- PROBLÈME CORRIGÉ ICI : `cout_unite_base` est en euros, le coût réel de
-- l'API Claude est facturé en dollars — aucune conversion n'existait nulle
-- part dans le calcul (tarifCursAudit.js multipliait directement des
-- dollars comme s'ils étaient des euros). `taux_usd_vers_eur` est ajouté
-- pour rendre cette conversion explicite plutôt qu'implicite et fausse.
--
-- Taux utilisé : 0,92 (approximatif, à vérifier/mettre à jour
-- périodiquement — pas un taux de change en temps réel, une valeur
-- statique dans une table de configuration).
--
-- LIMITE NON RÉSOLUE ICI : le facteur `mode_ia` pour "2 IA" (1,55) reste
-- une estimation du calculateur d'origine — il ajoute un appel GPT-4o en
-- plus de Claude, sur une grille tarifaire totalement différente, jamais
-- mesurée en conditions réelles. À corriger le jour où un vrai test "2 IA"
-- sera mené (comme celui-ci l'a été pour "1 IA").

insert into audit_pricing_rules (categorie, cle, label, valeur_numerique, description)
values ('parametre_global', 'taux_usd_vers_eur', 'Taux de conversion USD → EUR', 0.92,
        'Approximatif, à mettre à jour périodiquement — pas un taux temps réel.');

update audit_pricing_rules
set valeur_numerique = 0.0189,
    description = 'Coût réel mesuré le 22/08/2026 sur un vrai appel (2619 tokens entrée + 1528 sortie, claude-sonnet-5 à 2$/10$ par MTok), converti en euros via taux_usd_vers_eur. Remplace l''estimation a priori du calculateur Excel d''origine (0,013 €).'
where categorie = 'parametre_global' and cle = 'cout_unite_base';

select cle, valeur_numerique, description from audit_pricing_rules where categorie = 'parametre_global' order by cle;
