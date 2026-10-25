-- CURSUS — Directive du « Guide directif » du Co-pilote (25/10/2026)
-- ======================================================================
-- Demande de Joseph : un bouton « Guide directif » à côté de « Aide-moi à
-- avancer » qui montre d'abord la directive envoyée au Co-pilote, que
-- l'auteur·ice peut modifier, conserver ou rétablir. Conservée EN BASE
-- (pas dans le navigateur) pour la retrouver sur tous les appareils.
--
-- MODÈLE : une ligne par (compte, projet). Même convention RLS que
-- dialogues_copilote / memoire_narrative : propriété par user_id.
-- À EXÉCUTER par Joseph dans l'éditeur SQL de Supabase. Tant qu'elle ne
-- l'est pas, le Guide directif fonctionne avec le texte par défaut, mais
-- « Enregistrer comme directive du projet » affiche l'erreur réelle.

CREATE TABLE IF NOT EXISTS directives_copilote (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  projet_id   UUID NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
  texte       TEXT NOT NULL,
  cree_le     TIMESTAMPTZ DEFAULT NOW(),
  mis_a_jour  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, projet_id)
);

CREATE INDEX IF NOT EXISTS idx_directives_copilote_projet ON directives_copilote(projet_id);

ALTER TABLE directives_copilote ENABLE ROW LEVEL SECURITY;

CREATE POLICY "directives_copilote_proprietaire_lecture" ON directives_copilote
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "directives_copilote_proprietaire_ecriture" ON directives_copilote
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "directives_copilote_proprietaire_maj" ON directives_copilote
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "directives_copilote_proprietaire_suppression" ON directives_copilote
  FOR DELETE USING (auth.uid() = user_id);

SELECT 'directives_copilote créée ✓' AS résultat;
