-- CURSUS — Mémoire narrative du projet (référence 60816-01, suite, 30/08/2026)
-- ======================================================================
-- Suite à la discussion sur les limites de "Mémoriser cette intention"
-- (PR #110, table `idees` réutilisée telle quelle) : une liste plate de
-- notes texte ne suffit pas pour qu'une intention narrative revienne
-- automatiquement au bon moment, ni pour distinguer une simple idée en
-- vrac d'une DÉCISION D'AUTEUR qui doit gouverner l'écriture. Conception
-- discutée avec l'auteur du projet et une synthèse croisée avec GPT sur le
-- modèle conceptuel (catégories de mémoire, cycle de statuts, notion de
-- déclencheur pour la réactivation contextuelle).
--
-- MODÈLE RETENU — volontairement une V1 légère (5 champs), pas l'ontologie
-- complète discutée : "attention à ne pas construire immédiatement la
-- NASA... risque de passer une semaine à concevoir une ontologie parfaite
-- sans avoir testé le comportement réel du copilote." Déclencheurs, liens
-- entre mémoires, état narratif détaillé (à préparer → amorcé → actif →
-- développé → résolu) restent pour une itération suivante, une fois cette
-- V1 testée en conditions réelles — mêmes principes que tout le reste de
-- ce projet (correctifs itératifs sur retour d'usage réel, pas de design
-- figé à l'avance).
--
-- `type` — nature fondamentale de la mémoire (pas "personnage", qui est
-- une PORTÉE, pas un type — voir `portee` plus bas) :
--   fait_canonique, decision_auteur, arc, etat_personnage, relation,
--   promesse, boucle_ouverte, theme_motif, vigilance, fragment,
--   reference_recherche
-- ("décision abandonnée" n'est PAS un type séparé : c'est
-- type=decision_auteur + statut=rejetee/remplacee — voir plus bas.)
--
-- `statut` — UNIQUEMENT le statut de GOUVERNANCE/décision dans cette V1
-- (proposee/validee/rejetee/remplacee) — PAS l'état narratif d'avancement
-- (à préparer/amorcé/actif/...), volontairement différé. L'IA ne doit
-- jamais faire passer une observation à "validee" toute seule : ce champ
-- reflète une décision de l'auteur·ice, jamais une inférence automatique.
--
-- `remplace_id` — quand une décision change en cours de route, l'ancienne
-- devient `remplacee` et pointe vers la nouvelle plutôt que d'être
-- supprimée : "trois mois plus tard, si un passage ancien paraît
-- incohérent, Cursus peut comprendre à quel moment la conception a
-- changé" — l'historique reste consultable, jamais écrasé.
--
-- `portee` — JSONB volontairement flexible en V1 (personnages, noeud_id,
-- partie...) plutôt qu'un jeu de tables de liaison normalisées — une
-- mémoire peut concerner plusieurs personnages/chapitres à la fois, et la
-- forme exacte se stabilisera après un vrai usage, pas avant.
--
-- `source_type`/`source_reference` — d'où vient cette mémoire (auteur,
-- cursaudit, copiloteia, questionnaire...) : "une phrase comme 'Scalpa
-- doit devenir moins parfait' n'a pas le même statut si Pascal l'a
-- explicitement décidé, si CursAudit le suggère, ou si CopilotIA
-- l'infère — Cursus doit conserver cette distinction."

CREATE TABLE IF NOT EXISTS memoire_narrative (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  projet_id        UUID NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN (
                     'fait_canonique', 'decision_auteur', 'arc', 'etat_personnage',
                     'relation', 'promesse', 'boucle_ouverte', 'theme_motif',
                     'vigilance', 'fragment', 'reference_recherche'
                   )),
  contenu          TEXT NOT NULL,
  statut           TEXT NOT NULL DEFAULT 'proposee' CHECK (statut IN (
                     'proposee', 'validee', 'rejetee', 'remplacee'
                   )),
  portee           JSONB DEFAULT '{}'::jsonb,
  source_type      TEXT,
  source_reference TEXT,
  remplace_id      UUID REFERENCES memoire_narrative(id) ON DELETE SET NULL,
  cree_le          TIMESTAMPTZ DEFAULT NOW(),
  mis_a_jour       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memoire_narrative_projet ON memoire_narrative(projet_id);
CREATE INDEX IF NOT EXISTS idx_memoire_narrative_statut ON memoire_narrative(statut);

SELECT 'memoire_narrative créée ✓' AS résultat;
