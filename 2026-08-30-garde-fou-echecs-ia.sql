-- CURSUS — Garde-fou contre les boucles de relances coûteuses
-- (référence 60816-01, suite, 30/08/2026)
-- ======================================================================
-- Incident réel : une nuit entière (~10h) d'appels répétés à
-- preaudit-approfondi-cursaudit a consommé plus de 40 $US en une seule
-- journée (26/08/2026), sans qu'aucun mécanisme ne l'arrête. La "limite de
-- dépenses" configurée côté Anthropic Console s'est révélée être une
-- simple notification, pas un plafond dur — aucune protection réelle
-- n'existait côté CursAudit lui-même.
--
-- Cause probable identifiée en relisant le code : `preaudit-approfondi-
-- cursaudit` ne garde aucune trace des échecs. Si le passage 3 (celui qui
-- renvoie le manuscrit ENTIER, ~80 000 tokens, l'appel le plus coûteux du
-- pipeline) échoue — validation de schéma (compterChampsClésVides),
-- limite de ressources CPU, timeout — la fonction répond une erreur mais
-- ne modifie rien en base. Si le client (onglet resté ouvert, boucle de
-- relance automatique côté navigateur) retente après chaque échec, RIEN
-- n'empêche de refaire cet appel à 80 000 tokens indéfiniment, toute une
-- nuit s'il le faut.
--
-- Ces deux colonnes permettent à la fonction de refuser de continuer
-- au-delà d'un nombre d'échecs consécutifs raisonnable, plutôt que de
-- compter sur une supervision humaine 24h/24 pour s'en apercevoir.
--
-- CORRECTIF le jour même, sur retour de l'auteur du projet : un blocage
-- permanent (nécessitant une remise à zéro manuelle en SQL) laisserait un
-- vrai client bloqué sans recours si 3 échecs transitoires s'enchaînent
-- par malchance. Le blocage appliqué côté fonction est donc temporaire
-- (délai de refroidissement, voir DÉLAI_REFROIDISSEMENT_MS dans le code) —
-- ces colonnes restent les mêmes, seule la lecture qu'en fait la fonction
-- a changé.

alter table audits
  add column ia_echecs_consecutifs integer not null default 0,
  add column ia_dernier_echec_le timestamptz;

comment on column audits.ia_echecs_consecutifs is
  'Nombre de tentatives IA échouées d''affilée sur cet audit (tous pipelines confondus). Remis à zéro à chaque passage réussi. Au-delà du seuil (voir SEUIL_ECHECS_MAX dans le code), la fonction refuse de relancer un appel IA et exige une remise à zéro manuelle.';
comment on column audits.ia_dernier_echec_le is
  'Horodatage du dernier échec IA enregistré sur cet audit — utile pour distinguer une vraie boucle rapprochée d''échecs anciens et sans rapport.';

select 'ia_echecs_consecutifs / ia_dernier_echec_le ajoutées ✓' as résultat;
