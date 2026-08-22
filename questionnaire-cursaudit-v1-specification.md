# CursAudit — Questionnaire de qualification v1 (spécification complète)

*Document de référence pour l'implémentation future. Reconstruit et figé le
15/08/2026, à partir d'un travail d'élaboration mené en amont entre l'auteur
du projet et GPT (conversation source non retrouvée telle quelle, mais
l'ossature retrouvée avec confiance).*

**Distinction avec `audit_criteria`** (voir `docs/cursaudit-cartographie-technique.md`
section 2bis-b) : ce questionnaire qualifie la **demande**, avant toute
analyse — quel texte, pour qui, jusqu'où l'IA peut intervenir. Il est
distinct de `audit_criteria`, le référentiel qui définit comment coder un
extrait *pendant* l'analyse elle-même (les paliers de 8/15/30 dimensions du
calculateur, `docs/cursaudit-tarification.md`). Le premier reste à bâtir en
détail ; celui-ci est figé.

**Pourquoi ce questionnaire existe** : sans lui, l'IA analyse un texte sans
savoir ce qu'il est censé être, pour qui il est écrit, ni jusqu'où elle a le
droit d'intervenir — le même problème identifié pour Cursus Édition dans le
protocole 60805-06 (étape 0, cartographie contextuelle), mais côté CursAudit
c'est une porte d'entrée obligatoire avant analyse, pas une recherche dans
les nœuds d'un projet en cours.

---

## 1. Nature du document

```text
Quel type de document veux-tu auditer ?
- Mémoire / TFE / travail académique
- Manuscrit de livre
- Article
- Essai
- Rapport professionnel
- Dossier personnel
- Scène / extrait autonome
- Correspondance / message
- Autre : …
```

## 2. Statut du texte

```text
Ce texte est-il :
- un brouillon de travail ?
- une version presque finale ?
- une version déjà envoyée / déposée ?
- une version publiée ou annoncée ?
- une version destinée à être profondément retravaillée ?
```

## 3. Finalité de l'audit

```text
Que veux-tu obtenir ?
- Vérifier la cohérence générale
- Améliorer la structure
- Repérer les répétitions
- Repérer les passages faibles
- Vérifier le niveau de preuve
- Vérifier les sources
- Préserver la voix de l'auteur
- Fluidifier sans réécrire à la place
- Identifier les risques éthiques, académiques ou éditoriaux
- Préparer une nouvelle version
- Autre question : …
```

## 4. Question libre

Le point le plus important du questionnaire.

```text
Quelle est la question précise que tu veux poser à CursAudit ?
```

Exemples :
```text
Est-ce que mon mémoire répond bien à ma problématique ?
Est-ce que ce chapitre est trop systématique ?
Est-ce que ce texte garde ma voix ?
Est-ce que l'IA a trop lissé le style ?
Est-ce que les affirmations sont suffisamment prouvées ?
Est-ce que ce passage est publiable tel quel ?
```

## 5. Degré d'intervention souhaité

```text
Que peut faire CursAudit ?
- Observer seulement
- Signaler les problèmes
- Proposer des pistes
- Proposer des reformulations ponctuelles
- Réécrire légèrement
- Réécrire librement
```

**Limite forte posée pour les mémoires/TFE** :
```text
CursAudit peut diagnostiquer, questionner, structurer, signaler.
Il ne doit pas écrire le travail à la place de l'étudiant.
```

## 6. Mode "préserver ma voix"

Lié à un cas réel évoqué en amont (crainte des détecteurs IA).

```text
Souhaites-tu que CursAudit compare ce texte avec des pages de référence écrites par toi ?
- Oui
- Non
```

Si oui :
```text
Objectif :
- repérer les passages qui ne sonnent plus comme moi ;
- éviter le lissage IA ;
- préserver mes formulations habituelles ;
- proposer des corrections minimales à retravailler moi-même.
```

**Principe non négociable** :
```text
CursAudit ne doit pas imiter l'auteur pour contourner un détecteur.
Il doit aider l'auteur à reconnaître et préserver sa propre voix.
```

## 7. Contraintes académiques ou institutionnelles

Pour un mémoire ou TFE :

```text
Ton établissement autorise-t-il l'usage de l'IA ?
- Oui
- Non
- Je ne sais pas

Si oui, à quelles conditions ?
- correction linguistique
- aide à la structure
- aide bibliographique
- reformulation limitée
- interdiction de rédaction
- obligation de déclaration
- autre : …
```

## 8. Niveau de preuve attendu

Fait écho au niveau de preuve déjà présent dans le calculateur de
tarification (`docs/cursaudit-tarification.md`, section 1 — paliers de
dimensions).

```text
Quel niveau de preuve attends-tu ?
- Impression de lecture
- Cohérence interne
- Appui sur le texte uniquement
- Appui sur les sources citées
- Vérification documentaire externe
- Vérification académique / scientifique
- Expertise humaine requise
```

## 9. Sortie attendue

```text
Sous quelle forme veux-tu le résultat ?
- Synthèse courte
- Tableau d'audit
- Grille Excel
- Rapport détaillé
- Liste des corrections prioritaires
- Fiche par chapitre
- Diagnostic global
- Plan de réécriture
```

Fait écho aux types de rapport déjà tarifés (Aucun / Synthèse courte /
Rapport complet) — à réconcilier avec cette liste plus fine au moment de
l'implémentation, pas nécessairement une correspondance 1-pour-1.

## 10. Relation avec l'IA

```text
Comment veux-tu que l'IA te parle ?
- tu / vous
- ton direct / diplomatique
- critique / accompagnant / contradicteur
- court / détaillé
- plutôt éditeur / plutôt auditeur / plutôt coach / plutôt lecteur expert
```

Traduction proposée en objet de configuration, à injecter dans le `system`
de l'appel au module `moteur-ia-structure.ts` :

```json
{
  "posture_ia": "lecteur_auditeur_exigeant",
  "adresse": "tu",
  "priorite": "diagnostic_clair_avant_reformulation",
  "limite": "ne_pas_ecrire_a_la_place_de_l_auteur"
}
```

---

## Logique d'ensemble

Porte d'entrée obligatoire avant toute analyse CursAudit :

```text
1. Quel texte ?
2. Dans quel statut ?
3. Pour quel usage ?
4. Avec quelle question ?
5. Jusqu'où l'IA peut-elle intervenir ?
6. Quelle voix faut-il préserver ?
7. Quelles contraintes faut-il respecter ?
8. Quel niveau de preuve faut-il appliquer ?
9. Quel format de sortie veux-tu ?
```

Sans ce cadrage, l'IA analyse trop vite, dans le mauvais régime, et produit
une réponse possiblement bien écrite mais mal cadrée — le même risque que
celui identifié pour Cursus Édition dans le protocole 60805-06, transposé
côté CursAudit.

---

## Notes techniques pour l'implémentation future

- **Table Supabase à créer** : aucune table ne porte ces réponses
  aujourd'hui. Candidat naturel : `audits` (migration
  `2026-08-15-cursaudit-schema.sql`) a déjà `palier_dimensions`, `mode_ia`,
  `type_rapport` — sections 8 et 9 de ce questionnaire y correspondent
  directement. Les sections 1 à 7 et 10 n'ont pas encore de colonnes : à
  ajouter à `audits`, ou table liée séparée si la structure devient trop
  large pour une seule ligne.
- **Section 4 (question libre)** est un champ texte simple, mais structurant
  : elle devrait entrer dans le `contexte` transmis à
  `appellerMoteurIAStructure` (module partagé), pas être traitée comme une
  métadonnée accessoire.
- **Section 6 (préserver ma voix)** suppose une fonctionnalité de comparaison
  avec des pages de référence de l'auteur·e — hors périmètre de ce document,
  nécessite son propre stockage (pages de référence) et sa propre logique de
  comparaison stylistique.
- **Section 10** alimente directement le `system` prompt des appels au
  moteur IA structuré — voir l'objet JSON proposé ci-dessus.
- **Reste distinct et toujours manquant** : `audit_criteria`, le référentiel
  des dimensions analysées *pendant* l'audit (8/15/30 critères du
  calculateur) — ce document ne le remplace pas.
