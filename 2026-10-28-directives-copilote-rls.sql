-- CURSUS — Correctif : « new row violates row-level security policy for table directives_copilote » (28/10/2026)
-- ======================================================================
-- Constat (Journal des erreurs, 25/10/2026) : l'enregistrement d'une directive du Guide directif était refusé (code 42501).
-- Le code côté application est correct (user_id = compte connecté) et la migration d'origine prévoit bien une règle
-- d'insertion : si le refus s'est produit, c'est que les règles de la table en base ne sont pas (ou plus) celles attendues
-- (script d'origine exécuté en partie, ou table créée avant lui). Ce script est IDEMPOTENT : il (re)crée la table si besoin
-- et REMPLACE les 4 règles. À exécuter dans l'éditeur SQL de Supabase, quel que soit l'état actuel.

CREATE TABLE IF NOT EXISTS directives_copilote (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  projet_id   UUID NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
  texte       TEXT NOT NULL,
  cree_le     TIMESTAMPTZ DEFAULT NOW(),
  mis_a_jour  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, projet_id)
);
CREATE INDEX IF NOT EXISTS idx_directives_copilote_projet ON directives_copilote(projet_id);

ALTER TABLE directives_copilote ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "directives_copilote_proprietaire_lecture" ON directives_copilote;
DROP POLICY IF EXISTS "directives_copilote_proprietaire_ecriture" ON directives_copilote;
DROP POLICY IF EXISTS "directives_copilote_proprietaire_maj" ON directives_copilote;
DROP POLICY IF EXISTS "directives_copilote_proprietaire_suppression" ON directives_copilote;

CREATE POLICY "directives_copilote_proprietaire_lecture" ON directives_copilote
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "directives_copilote_proprietaire_ecriture" ON directives_copilote
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "directives_copilote_proprietaire_maj" ON directives_copilote
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "directives_copilote_proprietaire_suppression" ON directives_copilote
  FOR DELETE USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';

-- Vérification : doit lister 4 lignes (SELECT, INSERT, UPDATE, DELETE).
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'directives_copilote' ORDER BY cmd;
