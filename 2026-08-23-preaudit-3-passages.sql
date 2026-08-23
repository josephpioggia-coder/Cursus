-- CURSUS — Pré-audit en 3 appels séparés (réf. 60816-01, suite, 23/08/2026)
-- ======================================================================
-- Bug réel rencontré en test : "Request idle timeout limit (150s) reached" —
-- contrainte de la plateforme Supabase Edge Functions, pas configurable
-- (150s max pour répondre à une requête HTTP, sur tous les plans). Le
-- pipeline à 3 passages (Claude brouillon → GPT critique → Claude version
-- finale) fait tout en UN SEUL appel HTTP ; la somme des 3 passages
-- dépasse 150s.
--
-- Contrairement à l'audit détaillé (orchestrer-audit-cursaudit, déjà
-- construit avec un budget de 25s par lot et une boucle côté client), le
-- pré-audit ne peut pas doser par petits lots — chaque passage porte sur
-- le livre entier en un seul appel. Solution : découper en 3 appels HTTP
-- séparés, un par passage, le client rappelant la fonction jusqu'à ce que
-- ce soit fini (même principe que "Lancer/Continuer l'analyse").
--
-- Deux nouvelles colonnes pour garder l'état intermédiaire entre les
-- appels : preaudit_brouillon (résultat du passage 1), preaudit_critique_gpt
-- (résultat du passage 2). preaudit_resultat reste le résultat FINAL
-- uniquement, écrit au passage 3.

alter table audits
  add column preaudit_brouillon jsonb,
  add column preaudit_critique_gpt jsonb;

select 'colonnes preaudit_brouillon + preaudit_critique_gpt ajoutées ✓' as résultat;
