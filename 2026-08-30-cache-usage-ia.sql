-- CURSUS — Visibilité sur le prompt caching dans usage_ia (référence 60816-01, suite, 30/08/2026)
-- ======================================================================
-- CopiloteIA envoie désormais le bloc contexteADN (questionnaire +
-- mémoire narrative + Carnet d'idées) avec un breakpoint cache_control
-- Anthropic — le plus gros bloc, stable d'un appel à l'autre pendant une
-- session, est donc mis en cache au lieu d'être refacturé au tarif plein
-- à chaque analyse (Suggestions, Personnages, Cohérence, Références...).
--
-- Ces deux colonnes stockent, à titre INFORMATIF, la répartition réelle
-- renvoyée par Anthropic (cache_creation_input_tokens / cache_read_input_
-- tokens) — utile pour mesurer le taux de cache et préparer une future
-- évolution vers des crédits pondérés par coût réel. Elles ne changent
-- PAS le calcul du quota actuel : tokens_entree continue de recevoir la
-- somme des trois compteurs Anthropic (input_tokens + cache_creation +
-- cache_read), donc un·e auteur·ice ne voit aucune différence sur son
-- compteur aujourd'hui — l'économie est uniquement sur la facture réelle
-- Anthropic de Cursus, pas (encore) répercutée sur le quota client.

ALTER TABLE usage_ia
  ADD COLUMN IF NOT EXISTS cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cache_read_tokens INTEGER NOT NULL DEFAULT 0;

SELECT 'usage_ia : colonnes de cache ajoutées ✓' AS résultat;
