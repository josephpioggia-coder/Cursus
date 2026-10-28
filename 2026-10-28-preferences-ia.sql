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

SELECT policyname, cmd FROM pg_policies WHERE tablename = 'preferences_ia';
