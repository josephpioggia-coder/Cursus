-- CURSUS — Crédit de tokens de test pour le compte de Joseph (18/09/2026)
-- ======================================================================
-- Contexte : le compteur d'usage IA (CompteurUsageIA.jsx, 60803-03) est
-- un vrai compteur, pas une limite d'essai factice — il compare la
-- consommation réelle du mois (table usage_ia, alimentée par l'Edge
-- Function claude-prox à CHAQUE appel Claude/GPT) au quota du palier
-- actif (quotas_paliers.tokens_mensuels) + crédits (credits_ia).
--
-- Le fait que l'abonnement soit en carte de test Stripe (4242) ne change
-- RIEN au coût réel : chaque appel Claude/GPT pendant les essais consomme
-- de vrais tokens payés en dollars à Anthropic/OpenAI, indépendamment de
-- Stripe. Le crédit ci-dessous n'est donc pas gratuit pour Cursus — c'est
-- un choix assumé de continuer à tester avant le lancement plutôt que
-- d'attendre le renouvellement du 01/10/2026.

-- 1) ÉTAT ACTUEL — à exécuter d'abord pour voir le palier réel et le
--    quota associé (utile aussi pour vérifier si un palier "illimité"
--    marketing — Auteur/Studio — a vraiment un plafond de 1 500 000
--    tokens/mois, ce qui serait à corriger avant un lancement commercial
--    si c'est le cas : la promesse "analyses illimitées" ne doit pas
--    heurter un mur silencieux).
select
  u.email,
  a.palier,
  a.statut,
  q.tokens_mensuels as quota_palier
from auth.users u
join abonnements a on a.user_id = u.id and a.statut = 'actif'
left join quotas_paliers q on q.palier = a.palier
where u.email = 'joseph.pioggia@gmail.com';

-- 2) CRÉDIT DE TOKENS — ajoute 3 000 000 de tokens supplémentaires pour
--    ce mois-ci (et les suivants, credits_ia n'est jamais remis à zéro
--    automatiquement contrairement au quota mensuel — voir
--    recupererConsommation() dans api.js qui les additionne en continu).
--    Ajuster le chiffre selon le besoin réel de test restant.
insert into credits_ia (user_id, tokens_offerts)
select id, 3000000
from auth.users
where email = 'joseph.pioggia@gmail.com';
