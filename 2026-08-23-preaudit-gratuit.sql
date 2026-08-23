-- CURSUS — Pré-audit global : gratuit (réf. 60816-01, suite, 23/08/2026)
-- ======================================================================
-- Décision de l'auteur du projet après avoir vu un vrai résultat (audit
-- "Là où les portes s'ouvrent -précorrections PJ", 38 864 mots, facturé
-- 72,60€ TTC) : le pré-audit n'est PAS un produit vendable en soi — c'est
-- une appréciation d'une page qui indique des voies à suivre, pas une
-- livraison que le client "commande". Coût réel mesuré pour cet appel :
-- un seul appel Claude, ~58 000 tokens entrée + sortie plafonnée à 2048
-- tokens ≈ 0,13€ — le barème par tranche de mots (24€→132€ HT) était calé
-- sur la taille du manuscrit, sans rapport avec ce coût ni avec la nature
-- du livrable.
--
-- Principe posé par l'auteur du projet : le client doit recevoir ce qu'il
-- commande. Ce qui se vend, c'est l'audit détaillé (et son rapport
-- exportable, à construire — voir le chantier Word/.docx en attente). Le
-- pré-audit reste un outil d'orientation avant de s'engager sur ce prix-là,
-- gratuit puisqu'il ne prétend pas être le livrable payant.
--
-- Ne supprime pas les lignes ni la mécanique de barème par tranche (dans
-- tarifCursAudit.js et audit_pricing_rules) : juste leur valeur, à 0. Si
-- un jour l'auteur du projet veut refacturer le pré-audit différemment
-- (ex. juste le coût réel + petite marge), la structure existe déjà.

update audit_pricing_rules
set valeur_numerique = 0
where categorie = 'preaudit_global_palier';

select cle, valeur_numerique from audit_pricing_rules where categorie = 'preaudit_global_palier' order by cle::int;
