-- CURSUS — Journal et plafond de coût pour demander-gpt (référence 60816-01, suite, 30/08/2026)
-- ======================================================================
-- Complète demander-gpt (voir index.ts) avec les garde-fous demandés par
-- Joseph : traçabilité de chaque appel (motif obligatoire + coût réel),
-- servant aussi de base au calcul du plafond mensuel appliqué avant
-- chaque nouvel appel.

CREATE TABLE IF NOT EXISTS demander_gpt_logs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  motif            TEXT NOT NULL,
  prompt           TEXT NOT NULL,
  reponse          TEXT,
  modele           TEXT NOT NULL,
  tokens_entree    INTEGER NOT NULL DEFAULT 0,
  tokens_sortie    INTEGER NOT NULL DEFAULT 0,
  cout_estime_usd  NUMERIC(10, 6) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demander_gpt_logs_created_at ON demander_gpt_logs(created_at);

SELECT 'demander_gpt_logs créée ✓' AS résultat;
