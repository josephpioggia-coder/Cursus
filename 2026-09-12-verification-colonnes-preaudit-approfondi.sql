-- CURSUS — Vérification des colonnes lues par preaudit-approfondi-cursaudit
-- (référence 60816-01, suite, 12/09/2026)
-- ======================================================================
-- Déclenché par un "Audit introuvable." trompeur sur un audit qui existe
-- bel et bien (tous les autres écrans le chargent sans problème) : la
-- fonction preaudit-approfondi-cursaudit lisait l'`error` de sa requête
-- SELECT sans jamais la vérifier (corrigé le même jour, voir son
-- index.ts) — toute colonne manquante en production y tombait donc
-- silencieusement dans le même message "introuvable" qu'un vrai id
-- inexistant, invérifiable sans lire le code.
--
-- Ce SELECT lit cinq colonnes ajoutées par trois migrations différentes
-- (2026-08-23-preaudit-3-passages.sql, 2026-08-24-preaudit-chapitres-
-- resultats.sql, 2026-08-30-garde-fou-echecs-ia.sql), aucune en
-- IF NOT EXISTS — ce projet a déjà eu plusieurs cas de colonnes
-- documentées comme appliquées mais absentes en production réelle
-- (consentement_supervision_le, audits.projet_id...). Ce fichier
-- consolide les cinq en IF NOT EXISTS : sans danger à exécuter, que
-- certaines existent déjà ou non.

alter table audits
  add column if not exists preaudit_brouillon         jsonb,
  add column if not exists preaudit_critique_gpt       jsonb,
  add column if not exists preaudit_chapitres_resultats jsonb,
  add column if not exists ia_echecs_consecutifs       integer not null default 0,
  add column if not exists ia_dernier_echec_le         timestamptz;

select 'Colonnes preaudit-approfondi-cursaudit vérifiées/ajoutées ✓' as résultat;
