-- ============================================================
-- ATELIER D'ÉCRIVAIN — Schéma de base de données Supabase
-- ============================================================
-- Instructions :
--   1. Ouvrez votre projet sur supabase.com
--   2. Cliquez sur "SQL Editor" dans le menu de gauche
--   3. Copiez-collez CE FICHIER ENTIER
--   4. Cliquez sur "Run"
-- ============================================================

-- Extension UUID (active par défaut sur Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── TABLE : projets ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS projets (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titre          TEXT NOT NULL,
  genre          TEXT NOT NULL DEFAULT 'Roman',
  statut         TEXT NOT NULL DEFAULT 'En cours',
  couleur        TEXT NOT NULL DEFAULT '#7F77DD',
  objectif_mots  INTEGER NOT NULL DEFAULT 80000,
  description    TEXT,
  date_creation  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TABLE : noeuds (structure du manuscrit) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS noeuds (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  projet_id  UUID NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
  parent_id  UUID REFERENCES noeuds(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('partie', 'chapitre', 'scene')),
  titre      TEXT NOT NULL DEFAULT 'Sans titre',
  ordre      INTEGER NOT NULL DEFAULT 0,
  texte      TEXT DEFAULT '',
  mis_a_jour TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour accélérer les requêtes par projet
CREATE INDEX IF NOT EXISTS idx_noeuds_projet ON noeuds(projet_id);
CREATE INDEX IF NOT EXISTS idx_noeuds_parent ON noeuds(parent_id);

-- ─── TABLE : livres ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS livres (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titre      TEXT NOT NULL,
  auteur     TEXT,
  année      TEXT,
  editeur    TEXT,
  ville      TEXT,
  genre      TEXT DEFAULT 'Essai',
  statut     TEXT DEFAULT 'À lire',
  note       TEXT,
  tags       TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TABLE : citations ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS citations (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  livre_id   UUID NOT NULL REFERENCES livres(id) ON DELETE CASCADE,
  projet_id  UUID REFERENCES projets(id) ON DELETE SET NULL,
  texte      TEXT NOT NULL,
  page       TEXT,
  paragraphe TEXT,
  tags       TEXT[] DEFAULT '{}',
  date_ajout DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_citations_livre  ON citations(livre_id);
CREATE INDEX IF NOT EXISTS idx_citations_projet ON citations(projet_id);

-- ─── TABLE : idees ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS idees (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  texte      TEXT NOT NULL,
  tags       TEXT[] DEFAULT '{}',
  statut     TEXT DEFAULT 'nouvelle',
  projet_id  UUID REFERENCES projets(id) ON DELETE SET NULL,
  priorite   INTEGER DEFAULT 2,
  date_ajout TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TABLE : sessions ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sessions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  projet_id      UUID REFERENCES projets(id) ON DELETE SET NULL,
  projet_titre   TEXT,
  projet_couleur TEXT,
  mots           INTEGER NOT NULL DEFAULT 0,
  duree          INTEGER DEFAULT 0,
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);

-- ─── ROW LEVEL SECURITY (RLS) ─────────────────────────────────────────────────
-- Chaque utilisateur ne voit que ses propres données.

ALTER TABLE projets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE noeuds    ENABLE ROW LEVEL SECURITY;
ALTER TABLE livres    ENABLE ROW LEVEL SECURITY;
ALTER TABLE citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE idees     ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions  ENABLE ROW LEVEL SECURITY;

-- Projets
CREATE POLICY "projets_propres" ON projets
  FOR ALL USING (auth.uid() = user_id);

-- Nœuds (accessibles si le projet appartient à l'utilisateur)
CREATE POLICY "noeuds_propres" ON noeuds
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projets
      WHERE projets.id = noeuds.projet_id
        AND projets.user_id = auth.uid()
    )
  );

-- Livres
CREATE POLICY "livres_propres" ON livres
  FOR ALL USING (auth.uid() = user_id);

-- Citations (accessibles si le livre appartient à l'utilisateur)
CREATE POLICY "citations_propres" ON citations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM livres
      WHERE livres.id = citations.livre_id
        AND livres.user_id = auth.uid()
    )
  );

-- Idées
CREATE POLICY "idees_propres" ON idees
  FOR ALL USING (auth.uid() = user_id);

-- Sessions
CREATE POLICY "sessions_propres" ON sessions
  FOR ALL USING (auth.uid() = user_id);

-- ─── TRIGGER : mise à jour automatique de updated_at ──────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projets_updated_at
  BEFORE UPDATE ON projets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── MESSAGE DE CONFIRMATION ──────────────────────────────────────────────────

SELECT 'Schéma Atelier d''Écrivain créé avec succès ✓' AS résultat;
