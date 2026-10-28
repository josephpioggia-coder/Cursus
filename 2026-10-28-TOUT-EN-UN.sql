-- CURSUS — Les 3 migrations du 28/10/2026 regroupées (styles du projet, registre des modèles d'IA, réglage de l'assistant).
-- À coller en une fois dans Supabase > SQL Editor > Run. Idempotent (peut être relancé sans risque).

-- ======================================================================
-- === styles-projet
-- ======================================================================
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


-- ======================================================================
-- === modeles-ia
-- ======================================================================
-- CURSUS — Registre des modèles d'IA (28/10/2026)
-- ======================================================================
-- Une seule table relie ce que l'auteur·ice choisit (Haiku / Sonnet / Opus / Fable) à l'identifiant réel du fournisseur,
-- à son POIDS dans le quota mensuel (Sonnet = 1) et à son modèle de SECOURS : quand un fournisseur retire ou renomme un
-- modèle, on modifie une ligne ici (UPDATE) au lieu de toucher au code. Lue par l'Edge Function claude-prox (service_role)
-- et par l'application (lecture seule pour tout compte connecté). Script idempotent. À EXÉCUTER par Joseph dans l'éditeur
-- SQL de Supabase ; tant qu'elle n'est pas créée, l'application et claude-prox utilisent leurs valeurs par défaut.

CREATE TABLE IF NOT EXISTS modeles_ia (
  id             TEXT PRIMARY KEY,              -- identifiant réel chez le fournisseur (ex. claude-sonnet-5-5)
  fournisseur    TEXT NOT NULL DEFAULT 'anthropic',
  libelle        TEXT NOT NULL,                 -- nom affiché (ex. « Sonnet 5.5 »)
  description    TEXT,                          -- une phrase pour l'auteur·ice
  poids          NUMERIC NOT NULL DEFAULT 1,    -- coût relatif dans le quota (Sonnet 5 = 1)
  ordre          INTEGER NOT NULL DEFAULT 100,
  visible        BOOLEAN NOT NULL DEFAULT TRUE, -- proposé dans le menu de choix du client
  actif          BOOLEAN NOT NULL DEFAULT TRUE, -- FALSE = ne plus l'appeler (le secours prend le relais)
  recommande     BOOLEAN NOT NULL DEFAULT FALSE,
  credits_requis BOOLEAN NOT NULL DEFAULT FALSE,-- réservé aux comptes avec crédits (affiché « Nécessite des crédits »)
  remplace_par   TEXT,                          -- modèle de SECOURS (id) si celui-ci est indisponible
  notes          TEXT,
  mis_a_jour     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE modeles_ia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "modeles_ia_lecture" ON modeles_ia;
CREATE POLICY "modeles_ia_lecture" ON modeles_ia FOR SELECT USING (auth.role() = 'authenticated');
-- Aucune policy d'écriture : seule la clé service (SQL editor, Edge Functions) peut modifier.

-- Valeurs de départ (poids = reprise de la table historique de l'application ; À CONFIRMER avec les tarifs du moment).
INSERT INTO modeles_ia (id, libelle, description, poids, ordre, visible, recommande, credits_requis, remplace_par, notes) VALUES
  ('claude-haiku-5-5',  'Haiku 5.5',  'Le plus rapide et le plus économe : questions courtes, informations simples.', 0.5, 40, TRUE,  FALSE, FALSE, 'claude-haiku-4-5', 'poids provisoire'),
  ('claude-sonnet-5-5', 'Sonnet 5.5', 'Le bon équilibre entre qualité, vitesse et consommation.',                    1,   20, TRUE,  TRUE,  FALSE, 'claude-sonnet-5',  'poids provisoire'),
  ('claude-opus-5-5',   'Opus 5.5',   'Réponses plus approfondies, consomme davantage.',                              2.5, 10, TRUE,  FALSE, FALSE, 'claude-sonnet-5-5','poids provisoire'),
  ('claude-fable-5-1',  'Fable 5.1',  'Le plus puissant ; nécessite des crédits.',                                    5,   30, TRUE,  FALSE, TRUE,  'claude-opus-5-5',  'poids provisoire'),
  -- Modèles déjà utilisés par le code (non proposés au client) : gardés pour le calcul du quota et comme secours.
  ('claude-sonnet-5',   'Sonnet 5',   'Modèle historique des outils de Cursus.',                                      1,   90, FALSE, FALSE, FALSE, 'claude-sonnet-5-5', 'utilisé par le code existant'),
  ('claude-sonnet-4-6', 'Sonnet 4.6', 'Ancien modèle (Incorporer la matière).',                                       1,   91, FALSE, FALSE, FALSE, 'claude-sonnet-5',   NULL),
  ('claude-haiku-4-5',  'Haiku 4.5',  'Ancien modèle économique.',                                                    0.5, 92, FALSE, FALSE, FALSE, 'claude-sonnet-5',   NULL)
ON CONFLICT (id) DO NOTHING;

SELECT id, libelle, poids, visible, actif, remplace_par FROM modeles_ia ORDER BY ordre;

-- ======================================================================
-- === preferences-ia
-- ======================================================================
-- CURSUS — Réglage de l'assistant IA par compte (28/10/2026)
-- ======================================================================
-- Une ligne par compte : modèle, effort, style de réponse et consigne personnelle de l'assistant (Question rapide, puis
-- les autres outils IA). À l'ouverture un réglage RECOMMANDÉ est proposé et appliqué ; l'auteur·ice le modifie quand il
-- ou elle le souhaite. Script idempotent. À EXÉCUTER par Joseph dans l'éditeur SQL de Supabase. Tant qu'il ne l'est pas,
-- le réglage est mémorisé sur l'appareil seulement (l'application fonctionne).

CREATE TABLE IF NOT EXISTS preferences_ia (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  profil      TEXT,                 -- economique | equilibre | approfondi | personnalise
  modele      TEXT,                 -- identifiant du registre modeles_ia
  effort      TEXT,                 -- faible | moyen | eleve | extra | max
  style       TEXT,                 -- concis | equilibre | detaille
  consigne    TEXT,                 -- consigne personnelle (500 caractères max côté application)
  mis_a_jour  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE preferences_ia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "preferences_ia_lecture" ON preferences_ia;
DROP POLICY IF EXISTS "preferences_ia_ecriture" ON preferences_ia;
DROP POLICY IF EXISTS "preferences_ia_maj" ON preferences_ia;
DROP POLICY IF EXISTS "preferences_ia_suppression" ON preferences_ia;
CREATE POLICY "preferences_ia_lecture" ON preferences_ia FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "preferences_ia_ecriture" ON preferences_ia FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "preferences_ia_maj" ON preferences_ia FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "preferences_ia_suppression" ON preferences_ia FOR DELETE USING (auth.uid() = user_id);


NOTIFY pgrst, 'reload schema';
SELECT tablename FROM pg_tables WHERE tablename IN ('styles_projet','modeles_ia','preferences_ia');
