-- CURSUS — audit_criteria : catégories fermées pour l'agrégation (60816-01, suite)
-- ======================================================================
-- Constat du 22/08/2026, en testant l'écran de résultat CursAudit sur un
-- vrai livre (1475 unités attendues) : `valeur` est aujourd'hui du texte
-- libre généré par l'IA pour CHAQUE critère (ex. "à nuancer / à sourcer
-- partiellement"). Ingérable à l'échelle d'un livre entier — impossible
-- de compter "X % recevables" si chaque diagnostic est formulé
-- différemment à chaque unité.
--
-- Cette colonne permet de fermer le vocabulaire d'un critère SANS toucher
-- aux autres : `categories` reste NULL pour les 29 critères qui restent en
-- texte libre (leur richesse qualitative est voulue), et n'est peuplée
-- que pour `diagnostic_priorite`, le seul champ dont l'écran de résultat a
-- besoin pour trier/compter à grande échelle.
--
-- Les 5 valeurs reprennent exactement la description déjà écrite dans
-- 2026-08-15-cursaudit-criteria-v1.sql ligne 91 ("recevable, à nuancer, à
-- sourcer, à reformuler, à vérifier") — juste traduites en slugs machine.
-- `valeur` devient un TABLEAU de ces catégories (pas une seule) : une
-- unité réelle peut cumuler "à nuancer" ET "à sourcer" en même temps
-- (observé dans le test du 22/08/2026), un enum à choix unique aurait
-- perdu cette information.

alter table audit_criteria
  add column categories jsonb;

update audit_criteria
set categories = '["recevable", "a_nuancer", "a_sourcer", "a_reformuler", "a_verifier"]'::jsonb
where output_key = 'diagnostic_priorite';

select code, output_key, categories from audit_criteria where output_key = 'diagnostic_priorite';
