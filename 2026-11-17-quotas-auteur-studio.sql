-- CURSUS — Quotas Auteur et Studio alignés sur « 500 » et « 750 analyses / mois » (17/11/2026)
-- À exécuter UNE fois dans l'éditeur SQL de Supabase. Idempotent.
-- Utilisateur supplémentaire (texte de carte, rien d'automatique) : +250 analyses pour +12 €/mois ou +500 pour +24 €/mois.
-- Base : une analyse moyenne = 11 666 tokens (mesuré). Coût ≈ 2,83 € / million de tokens.
--   Auteur : 500 analyses × 11 666 ≈ 5 830 000 tokens (avant : 4 000 000) -> coût max ≈ 16,50 €, marge ≈ 62 %
--   Studio : 1 000 analyses (partagées entre les utilisateurs) × 11 666 ≈ 8 750 000 tokens (avant : 10 000 000, donc BAISSE) -> coût max ≈ 33,0 €, marge ≈ 55 %
update quotas_paliers set tokens_mensuels = 5830000 where palier ilike 'auteur';
update quotas_paliers set tokens_mensuels = 11670000 where palier ilike 'studio';

select palier, tokens_mensuels, caracteres_voix_mensuels from quotas_paliers order by tokens_mensuels;
