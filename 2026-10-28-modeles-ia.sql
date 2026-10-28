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
