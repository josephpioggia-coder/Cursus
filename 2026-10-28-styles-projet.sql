-- CURSUS — Styles modifiables du projet (28/10/2026)
-- ======================================================================
-- Galerie de styles « à la Word » : l'auteur·ice change une fois la police / taille / interligne de
-- « Normal », « Titre 1 », « Citation »… pour tout le livre. Une ligne par (compte, projet) ; `styles`
-- ne contient que les propriétés MODIFIÉES (jsonb creux) — voir src/lib/stylesProjet.js.
-- Script idempotent (peut être relancé sans erreur). À EXÉCUTER par Joseph dans l'éditeur SQL de Supabase.
-- Tant qu'elle ne l'est pas, l'éditeur fonctionne comme avant et « Enregistrer » affiche l'erreur réelle.

CREATE TABLE IF NOT EXISTS styles_projet (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  projet_id   UUID NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
  styles      JSONB NOT NULL DEFAULT '{}'::jsonb,
  cree_le     TIMESTAMPTZ DEFAULT NOW(),
  mis_a_jour  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, projet_id)
);

CREATE INDEX IF NOT EXISTS idx_styles_projet_projet ON styles_projet(projet_id);

ALTER TABLE styles_projet ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "styles_projet_proprietaire_lecture" ON styles_projet;
DROP POLICY IF EXISTS "styles_projet_proprietaire_ecriture" ON styles_projet;
DROP POLICY IF EXISTS "styles_projet_proprietaire_maj" ON styles_projet;
DROP POLICY IF EXISTS "styles_projet_proprietaire_suppression" ON styles_projet;

CREATE POLICY "styles_projet_proprietaire_lecture" ON styles_projet
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "styles_projet_proprietaire_ecriture" ON styles_projet
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "styles_projet_proprietaire_maj" ON styles_projet
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "styles_projet_proprietaire_suppression" ON styles_projet
  FOR DELETE USING (auth.uid() = user_id);

SELECT policyname, cmd FROM pg_policies WHERE tablename = 'styles_projet';
