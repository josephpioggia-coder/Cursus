-- CURSUS — Quotas Auteur et Studio alignés sur « 500 » et « 750 analyses / mois » (17/11/2026)
-- À exécuter UNE fois dans l'éditeur SQL de Supabase. Idempotent.
-- Base : une analyse moyenne = 11 666 tokens (mesuré). Coût ≈ 2,83 € / million de tokens.
--   Auteur : 500 analyses × 11 666 ≈ 5 830 000 tokens (avant : 4 000 000) -> coût max ≈ 16,50 €, marge ≈ 62 %
--   Studio : 750 analyses × 11 666 ≈ 8 750 000 tokens (avant : 10 000 000, donc BAISSE) -> coût max ≈ 24,76 €, marge ≈ 66 %
update quotas_paliers set tokens_mensuels = 5830000 where palier ilike 'auteur';
update quotas_paliers set tokens_mensuels = 8750000 where palier ilike 'studio';

select palier, tokens_mensuels, caracteres_voix_mensuels from quotas_paliers order by tokens_mensuels;
