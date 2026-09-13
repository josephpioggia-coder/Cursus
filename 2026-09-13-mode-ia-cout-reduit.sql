-- CURSUS — audit_pricing_rules : réduit le facteur "2 IA" (60816-01, suite)
-- ======================================================================
-- Décision de l'auteur du projet le 13/09/2026 : au facteur actuel (1,55,
-- voir 2026-08-22-tarification-cout-reel.sql), le prix d'un audit "2 IA"
-- dépasse 2000 € sur un livre entier — hors marché, personne ne
-- consentirait à payer ça, et le marché de l'écriture est actuellement en
-- baisse. Plutôt qu'un second appel GPT sur CHAQUE unité, le code
-- (orchestrer-audit-cursaudit, voir estUnitéConclusive()) ne l'applique
-- désormais qu'aux "parties conclusives" (la dernière unité de chaque
-- chapitre détecté, ou une unité sur dix à défaut de chapitres) — environ
-- 10 % des unités au lieu de 100 %.
--
-- Facteur recalculé pour suivre ce changement réel de coût, pas choisi au
-- hasard : 1 (coût "1 IA", payé par toutes les unités) + 10 % du surcoût
-- GPT déjà mesuré pour "2 IA" (0,55, voir le fichier cité ci-dessus) =
-- 1 + 0,10 × 0,55 = 1,055, arrondi à 1,06.
--
-- LIMITE NON RÉSOLUE (héritée du fichier du 22/08/2026, toujours vraie) :
-- le surcoût GPT de départ (0,55) reste une estimation du calculateur
-- Excel d'origine, jamais mesurée en conditions réelles sur un vrai appel
-- GPT-4o — à corriger le jour où un vrai test "2 IA" sera mené. Comme
-- l'auteur du projet l'a dit lui-même : "on pourrait y revenir plus tard
-- lorsqu'on maîtrisera mieux les coûts réels et que les clients
-- commenceront à payer."

update audit_pricing_rules
set valeur_numerique = 1.06,
    description = 'Réduit le 13/09/2026 : le second appel GPT ne porte plus que sur les parties conclusives (~10% des unités, voir estUnitéConclusive() dans orchestrer-audit-cursaudit), plus sur toutes — 1 + 10% du surcoût GPT mesuré (0,55) = 1,06. Remplace l''ancien facteur 1,55 qui supposait un second appel sur 100% des unités.'
where categorie = 'mode_ia' and cle = '2 IA';

select cle, valeur_numerique, description from audit_pricing_rules where categorie = 'mode_ia' order by cle;
