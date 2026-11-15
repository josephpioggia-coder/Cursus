-- CURSUS — Quotas de tokens alignés sur les « analyses » promises par les cartes (15/11/2026)
-- À exécuter UNE fois dans l'éditeur SQL de Supabase. Idempotent (on peut le relancer).
--
-- Base du calcul (mesurée dans usage_ia, 518 appels claude-sonnet-5) : une analyse moyenne
-- = 11 666 tokens (entrée + sortie) ; coût ≈ 2,83 $ par million de tokens.
--   Découverte : 150 analyses/mois (5 par jour) × 11 666 ≈ 1 750 000 tokens
--   Essentiel  : 200 analyses/mois              × 11 666 ≈ 2 330 000 tokens
--   Initié     : 250 analyses/mois              × 11 666 ≈ 2 920 000 tokens
-- Auteur (4 000 000) et Studio (10 000 000) ne changent pas.
-- Coût maximal si le quota est consommé en entier (≈ 2,83 € par million) : 4,95 / 6,60 / 8,26 €.

update quotas_paliers set tokens_mensuels = 1750000 where palier ilike 'd_couverte';
update quotas_paliers set tokens_mensuels = 2330000 where palier ilike 'essentiel';
update quotas_paliers set tokens_mensuels = 2920000 where palier ilike 'initi_';

-- Contrôle : doit afficher 5 lignes, dans cet ordre de valeurs croissantes.
select palier, tokens_mensuels, caracteres_voix_mensuels
from quotas_paliers
order by tokens_mensuels;
