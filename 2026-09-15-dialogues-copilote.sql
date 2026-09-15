-- CURSUS — Persistance des fils de dialogue du co-pilote (référence 60816-01, suite, 15/09/2026)
-- ======================================================================
-- Demandé explicitement après un vrai test : les fils de discussion avec
-- le co-pilote (une carte de suggestion/blocage + les questions de suivi)
-- n'existaient QU'EN MÉMOIRE du navigateur (état React `dialogues` dans
-- CopiloteIA.jsx) — fermer l'onglet ou recharger la page effaçait tout,
-- systématiquement, même sans bug. L'auteur·ice l'a fait remarquer : on
-- ne travaille qu'à un seul endroit à la fois, donc garder en mémoire ce
-- qui vient d'être dit à CET endroit précis (comme on revient à une
-- discussion qu'on avait laissée de côté) est un vrai besoin, pas un
-- confort superflu.
--
-- MODÈLE : une ligne par (nœud, carte) — `cle_carte` reprend exactement
-- la clé déjà utilisée côté client pour indexer l'état `dialogues`
-- (ex. "suggestions:0", "blocage:0", "personnages:2") : aucune nouvelle
-- convention à inventer, juste la même clé persistée telle quelle.
-- `contexte_carte` = l'instantané figé de l'analyse d'origine (ne change
-- jamais après coup, voir le commentaire sur `contexteCarte` dans
-- CopiloteIA.jsx) ; `messages` = tout l'échange, tel qu'affiché.
--
-- Une ligne par carte, pas une table de messages séparée : un
-- UPSERT en `messages jsonb` à chaque échange suffit, pas besoin d'un
-- flux d'écriture plus complexe pour ce volume (quelques messages par
-- carte, quelques cartes par nœud).

CREATE TABLE IF NOT EXISTS dialogues_copilote (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  noeud_id       UUID NOT NULL REFERENCES noeuds(id) ON DELETE CASCADE,
  cle_carte      TEXT NOT NULL,
  contexte_carte TEXT,
  messages       JSONB NOT NULL DEFAULT '[]'::jsonb,
  cree_le        TIMESTAMPTZ DEFAULT NOW(),
  mis_a_jour     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (noeud_id, cle_carte)
);

CREATE INDEX IF NOT EXISTS idx_dialogues_copilote_noeud ON dialogues_copilote(noeud_id);

CREATE OR REPLACE FUNCTION set_dialogues_copilote_mis_a_jour()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.mis_a_jour := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dialogues_copilote_mis_a_jour ON dialogues_copilote;
CREATE TRIGGER trg_dialogues_copilote_mis_a_jour
BEFORE UPDATE ON dialogues_copilote
FOR EACH ROW
EXECUTE FUNCTION set_dialogues_copilote_mis_a_jour();

-- RLS — même convention que memoire_narrative
-- (2026-08-30-memoire-narrative-rls.sql) : propriété par user_id, lue et
-- écrite directement depuis le navigateur (dialoguesCopiloteAPI,
-- src/lib/api.js), sans RLS n'importe quel compte connecté pourrait lire
-- ou écraser les fils de discussion d'un autre compte via le SDK client.
ALTER TABLE dialogues_copilote ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dialogues_copilote_proprietaire_lecture" ON dialogues_copilote
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "dialogues_copilote_proprietaire_ecriture" ON dialogues_copilote
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dialogues_copilote_proprietaire_maj" ON dialogues_copilote
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "dialogues_copilote_proprietaire_suppression" ON dialogues_copilote
  FOR DELETE USING (auth.uid() = user_id);

SELECT 'dialogues_copilote créée ✓' AS résultat;
