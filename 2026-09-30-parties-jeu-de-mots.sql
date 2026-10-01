-- CURSUS — Sauvegarde de la partie du jeu de mots dans le compte (30/09/2026)
-- ======================================================================
-- Demande de Joseph : la partie du jeu de mots (onglet « Jouer contre
-- l'ordinateur », JeuDeMots.jsx) n'était sauvegardée que dans le
-- localStorage du navigateur — donc propre à UN appareil. Elle est
-- maintenant aussi stockée dans le compte, pour la retrouver partout.
--
-- MODÈLE : UNE partie en cours par compte (user_id est la clé primaire) ;
-- `etat` = l'objet JSON tel que l'écrit le client (plateau, sac, chevalets,
-- scores, journal, tuiles posées non validées…, avec sa propre `version`).
-- La structure de `etat` est gérée côté client (champ `version`), pas ici :
-- aucune migration SQL à prévoir si elle évolue. Dernière écriture gagnante ;
-- le client compare `etat.enregistreLe` (ms) à sa copie locale pour prendre
-- la plus récente.
--
-- À EXÉCUTER dans l'éditeur SQL de Supabase. Tant que cette table n'existe
-- pas, le jeu fonctionne quand même (sauvegarde locale) et affiche que la
-- sauvegarde dans le compte est indisponible.
--
-- Note : l'état contient le chevalet de l'ordinateur (jeu solo, sans enjeu).

CREATE TABLE IF NOT EXISTS parties_jeu_de_mots (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  etat        JSONB NOT NULL,
  mis_a_jour  TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_parties_jeu_de_mots_mis_a_jour()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.mis_a_jour := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_parties_jeu_de_mots_mis_a_jour ON parties_jeu_de_mots;
CREATE TRIGGER trg_parties_jeu_de_mots_mis_a_jour
BEFORE UPDATE ON parties_jeu_de_mots
FOR EACH ROW
EXECUTE FUNCTION set_parties_jeu_de_mots_mis_a_jour();

-- RLS — même convention que dialogues_copilote (2026-09-15) : propriété par
-- user_id, lue et écrite directement depuis le navigateur.
ALTER TABLE parties_jeu_de_mots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parties_jeu_de_mots_proprietaire_lecture" ON parties_jeu_de_mots;
CREATE POLICY "parties_jeu_de_mots_proprietaire_lecture" ON parties_jeu_de_mots
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "parties_jeu_de_mots_proprietaire_ecriture" ON parties_jeu_de_mots;
CREATE POLICY "parties_jeu_de_mots_proprietaire_ecriture" ON parties_jeu_de_mots
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "parties_jeu_de_mots_proprietaire_maj" ON parties_jeu_de_mots;
CREATE POLICY "parties_jeu_de_mots_proprietaire_maj" ON parties_jeu_de_mots
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "parties_jeu_de_mots_proprietaire_suppression" ON parties_jeu_de_mots;
CREATE POLICY "parties_jeu_de_mots_proprietaire_suppression" ON parties_jeu_de_mots
  FOR DELETE USING (auth.uid() = user_id);

SELECT 'parties_jeu_de_mots créée ✓' AS résultat;
