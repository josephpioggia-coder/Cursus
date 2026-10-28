-- CURSUS — Aide contextuelle : liste commune de questions / réponses (28/10/2026)
-- ======================================================================
-- Une question posée à l'assistant d'aide peut être PROPOSÉE à la liste ; seule une réponse VALIDÉE par Joseph est montrée
-- à tout le monde. Script idempotent. À EXÉCUTER dans l'éditeur SQL de Supabase. Sans lui, l'aide fonctionne
-- (FAQ fixe + assistant) mais « Proposer pour la liste » affiche une erreur.

CREATE TABLE IF NOT EXISTS aide_faq (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question    TEXT NOT NULL,
  reponse     TEXT NOT NULL,
  element     TEXT,                 -- libellé du bouton pointé, s'il y en avait un
  statut      TEXT NOT NULL DEFAULT 'proposee',  -- proposee | validee | rejetee
  propose_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cree_le     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE aide_faq ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aide_faq_lecture" ON aide_faq;
DROP POLICY IF EXISTS "aide_faq_proposition" ON aide_faq;
DROP POLICY IF EXISTS "aide_faq_admin" ON aide_faq;
-- Tout compte connecté lit les réponses validées ; chacun lit aussi ses propres propositions ; Joseph lit tout.
CREATE POLICY "aide_faq_lecture" ON aide_faq FOR SELECT USING (
  statut = 'validee' OR propose_par = auth.uid() OR (auth.jwt() ->> 'email') = 'joseph.pioggia@gmail.com');
-- Chacun peut PROPOSER (jamais s'auto-valider).
CREATE POLICY "aide_faq_proposition" ON aide_faq FOR INSERT WITH CHECK (propose_par = auth.uid() AND statut = 'proposee');
-- Seul Joseph valide, rejette, modifie, supprime.
CREATE POLICY "aide_faq_admin" ON aide_faq FOR ALL
  USING ((auth.jwt() ->> 'email') = 'joseph.pioggia@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'joseph.pioggia@gmail.com');

NOTIFY pgrst, 'reload schema';
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'aide_faq';
