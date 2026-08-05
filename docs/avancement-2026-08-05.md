# État des lieux — 05/08/2026

## 60804-02 — Système de codes promo (base de données)
**Statut : terminé, déployé, testé réel.**
Remplacement du système HMAC auto-vérifiant par un système piloté par base
de données (`codes_promo` / `utilisations_codes_promo`), avec fonction SQL
atomique `consommer_code_promo()` (verrouillage de ligne, double vérification,
sécurité anti-doublon). Checkout Stripe réel intégré (`creer-session-checkout`,
`stripe-webhook`). Testé de bout en bout avec un vrai code (TEST5) : fonctionnel.

## 60804-03 — Panel admin pour les codes promo
**Statut : terminé, déployé, fonctionnel.**
Interface dans Cursus (`Administration.jsx`) permettant de créer/lister/activer
des codes promo sans SQL manuel. Cause racine des blocages initiaux trouvée et
corrigée : la fonction Edge déployée faisait encore tourner le code par défaut
de Supabase, jamais réellement remplacée jusqu'au dernier redéploiement.
Accessible uniquement au compte admin (joseph.pioggia@gmail.com).

## 60805-06 — Protocole de vérification à deux IA ("regard croisé")
**Statut : conception terminée et validée sur deux textes réels ; aucun code
écrit — reste à implémenter.**
Document : `docs/protocole-verification-approfondie-deux-ia.md`.
Protocole complet définissant comment Cursus orchestre un dialogue
contradictoire entre deux moteurs IA pour vérifier les affirmations d'un
manuscrit — jamais de jugement unilatéral, contexte distribué une seule fois
et de façon identique aux deux moteurs, sorties toujours structurées (jamais
de texte libre), deux verdicts distincts (passage local / thèse du livre),
zones sous expertise requise jamais tranchées automatiquement.

Testé manuellement deux fois avec des résultats différenciés (le protocole
ne converge pas systématiquement vers la même réponse) :
- Avant-propos d'un livre réel → `correction_recommandee` (mécanisme de
  "légitimité empruntée" identifié : citations exactes d'auteurs reconnus sur
  un point précis, dont l'autorité s'étend ensuite silencieusement à des
  pratiques que ces auteurs n'ont jamais validées).
- Article d'une revue réelle → `recevable`, avec une vraie valeur ajoutée
  éditoriale identifiée (angle mort sur l'éthique de la restitution des
  récits collectés).

Deux règles ajoutées aujourd'hui suite à ces tests :
1. Vérification systématique de l'auteur·e d'une préface/avant-propos externe
   et d'une éventuelle relation financière avec l'auteur·e principal·e
   (information publique et auto-divulguée uniquement) — signal de
   non-neutralité potentielle, jamais accusatoire.
2. Hiérarchisation obligatoire de la sortie finale en quatre niveaux
   distincts (valeur ajoutée éditoriale / corrections probables / alertes à
   vérifier sur le document source original / remarques non bloquantes) —
   pour ne jamais mettre une vraie découverte éditoriale au même niveau
   qu'une possible erreur de numérisation.

**Prochaine étape (non commencée) :** décider par quel bout démarrer
l'implémentation réelle — l'étape 0 (cartographie contextuelle mécanique côté
Cursus) ou le premier appel API vers un moteur.

---

*Journal ajouté à la demande de l'auteur du projet, pour garder une trace de
l'avancement en dehors de la conversation.*
