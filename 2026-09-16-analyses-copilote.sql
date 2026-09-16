-- CURSUS — Persistance des résultats d'analyse du co-pilote (référence 60816-01, suite, 16/09/2026)
-- ======================================================================
-- Suite directe de dialogues_copilote (2026-09-15) : ce jour-là, seuls
-- les FILS DE DISCUSSION (les questions de suivi) étaient persistés — le
-- RÉSULTAT D'ANALYSE lui-même (les cartes "Suggestions", "Références",
-- "Personnages", "Cohérence", "Vérification") restait purement en mémoire
-- du navigateur, `données` dans CopiloteIA.jsx. Signalé en usage réel :
-- après une recherche de références, sortir du chapitre puis y revenir
-- faisait disparaître les références trouvées — obligeant l'auteur·ice à
-- les coller dans le corps du texte juste pour ne pas les perdre, ce qui
-- fait ensuite analyser ce bloc de citations brutes comme s'il s'agissait
-- de prose ("un non-sens").
--
-- MODÈLE : une ligne par (nœud, onglet) — `onglet` reprend exactement les
-- valeurs déjà utilisées côté client pour indexer `données`
-- ("suggestions", "personnages", "références", "cohérence",
-- "vérification"). `resultat` est volontairement JSONB générique : la
-- forme diffère d'un onglet à l'autre (un tableau pour la plupart, un
-- objet pour "vérification") — reproduit fidèlement ce que `données[onglet]`
-- contient déjà côté client, sans nouvelle normalisation.

CREATE TABLE IF NOT EXISTS analyses_copilote (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  noeud_id   UUID NOT NULL REFERENCES noeuds(id) ON DELETE CASCADE,
  onglet     TEXT NOT NULL,
  resultat   JSONB NOT NULL,
  cree_le    TIMESTAMPTZ DEFAULT NOW(),
  mis_a_jour TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (noeud_id, onglet)
);

CREATE INDEX IF NOT EXISTS idx_analyses_copilote_noeud ON analyses_copilote(noeud_id);

CREATE OR REPLACE FUNCTION set_analyses_copilote_mis_a_jour()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.mis_a_jour := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_analyses_copilote_mis_a_jour ON analyses_copilote;
CREATE TRIGGER trg_analyses_copilote_mis_a_jour
BEFORE UPDATE ON analyses_copilote
FOR EACH ROW
EXECUTE FUNCTION set_analyses_copilote_mis_a_jour();

-- RLS — même convention que dialogues_copilote et memoire_narrative.
ALTER TABLE analyses_copilote ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analyses_copilote_proprietaire_lecture" ON analyses_copilote
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "analyses_copilote_proprietaire_ecriture" ON analyses_copilote
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "analyses_copilote_proprietaire_maj" ON analyses_copilote
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "analyses_copilote_proprietaire_suppression" ON analyses_copilote
  FOR DELETE USING (auth.uid() = user_id);

SELECT 'analyses_copilote créée ✓' AS résultat;
