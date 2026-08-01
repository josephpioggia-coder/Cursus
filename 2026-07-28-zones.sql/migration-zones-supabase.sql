-- ============================================================
-- Cursus — Chantier « Zones de visibilité par nœud »
-- Migration Supabase : colonne `zone` sur la table des nœuds
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query
-- Date : 28/07/2026
-- ============================================================

-- ⚠️ ADAPTER LE NOM DE TABLE si nécessaire :
-- ce script suppose que la table des nœuds s'appelle `noeuds`.
-- Vérifier dans Supabase → Table Editor (autres candidats possibles :
-- `nodes`, `chapitres`...). Remplacer partout le cas échéant.

-- 1. Ajout de la colonne, avec valeur par défaut 'corps'
ALTER TABLE noeuds
  ADD COLUMN IF NOT EXISTS zone text NOT NULL DEFAULT 'corps';

-- 2. Contrainte : seules les quatre zones prévues sont admises
ALTER TABLE noeuds
  DROP CONSTRAINT IF EXISTS noeuds_zone_check;

ALTER TABLE noeuds
  ADD CONSTRAINT noeuds_zone_check
  CHECK (zone IN ('corps', 'reserve', 'methodo', 'brouillon'));

-- 3. Rattrapage explicite des lignes existantes
--    (normalement inutile grâce au DEFAULT + NOT NULL,
--     mais garanti sans effet de bord)
UPDATE noeuds SET zone = 'corps' WHERE zone IS NULL;

-- 4. Vérification — à exécuter après la migration :
-- SELECT zone, count(*) FROM noeuds GROUP BY zone;
-- Résultat attendu : une seule ligne, zone = 'corps',
-- count = nombre total de nœuds.

-- ============================================================
-- Rollback (si besoin d'annuler proprement) :
-- ALTER TABLE noeuds DROP CONSTRAINT IF EXISTS noeuds_zone_check;
-- ALTER TABLE noeuds DROP COLUMN IF EXISTS zone;
-- ============================================================
