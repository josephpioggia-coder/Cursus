# CursAudit — Catalogue des critères d'analyse v1 (`audit_criteria`)

*Reconstruit et figé le 15/08/2026, à partir d'un travail mené en amont par
l'auteur du projet avec GPT (conversation source non retrouvée telle
quelle, ossature confirmée fiable) et recoupé avec un rapport CursAudit
produit hors code, qui utilisait déjà des catégories proches (NORM, JUDG,
FACT/OBS, SUBJ, SPIR, EFF, MIX, METAPH, avec une exigence de preuve
faible/modérée/forte).*

**Rôle exact de cette table** (précisé par l'auteur du projet) :
`audit_criteria` est le catalogue configurable des dimensions d'analyse
mobilisables selon la profondeur choisie (8, 15 ou 30 — voir
`docs/cursaudit-tarification.md` section 1). Elle ne stocke **pas** les
résultats d'un audit — ceux-ci vont dans `audit_sections.resultat_analyse`
(colonne `jsonb`, une ligne par unité de texte), qui référence ces critères
par leur `output_key`.

**Validée en conditions réelles le 16/08/2026** : `supabase/functions/analyser-unite-cursaudit/index.ts`
construit dynamiquement le schéma de sortie à partir de cette table et
appelle Claude pour noter une unité réelle sur les 8 critères du palier
Essentiel — sortie cohérente, ancrée dans le texte (citations verbatim),
correctement distinguée comme littéraire plutôt que factuelle. Voir
`docs/cursaudit-cartographie-technique.md` section 0 pour le détail.

**Exclusion volontaire** : les critères contextuels propres à un auteur, un
projet ou une relation (dits "lentilles" par l'auteur du projet — ex.
`audit_lenses`) ne doivent jamais entrer dans `audit_criteria`. Mélanger les
deux romprait la distinction entre grille générale (valable pour tous) et
grille contextuelle (propre à un cas). Pas créée pour l'instant, faute de
schéma proposé — à concevoir séparément le moment venu.

Migration : `2026-08-15-cursaudit-criteria-v1.sql` — remplace le schéma
placeholder créé dans `2026-08-15-cursaudit-schema.sql` (table vide au
moment du remplacement, aucune perte de données).

---

## Palier Essentiel (8 critères)

| Code | Critère | Fonction |
|---|---|---|
| `ENONCE_TYPE` | Type d'énoncé | fait, jugement, métaphore, croyance, prescription, témoignage, etc. |
| `STATUT_EPISTEMIQUE` | Statut épistémique | ce que l'énoncé prétend être : constat, hypothèse, vérité générale, expérience subjective |
| `BESOIN_PREUVE` | Besoin de preuve | faible, modéré, fort, expertise requise |
| `SOURCE_TRACE` | Source / traçabilité | présence ou absence d'un appui vérifiable |
| `COHERENCE_ARGUMENTATIVE` | Cohérence argumentative | lien logique entre l'énoncé et ce qui l'entoure |
| `FONCTION_TEXTE` | Fonction dans le texte | récit, pédagogie, démonstration, cadrage, transition, promesse |
| `RISQUE_INFLUENCE` | Risque d'influence ou de glissement | autorité, généralisation, promesse implicite, effet de halo |
| `DIAGNOSTIC_PRIORITE` | Diagnostic prioritaire | recevable, à nuancer, à sourcer, à reformuler, à vérifier |

## Palier Approfondi (+7, total 15)

| Code | Critère | Fonction |
|---|---|---|
| `CATEGORIE_EPISTEMIQUE` | Catégorie épistémique fine | factuel, clinique, spirituel, symbolique, poétique, commercial, normatif |
| `NIVEAU_PREUVE` | Niveau de preuve disponible | aucun, interne, témoignage, source citée, source externe, consensus |
| `REFERENCES_CITEES` | Références citées | auteur, ouvrage, école, source, note, lien |
| `PORTEE_GENERALISATION` | Portée de la généralisation | expérience personnelle, cas particulier, proposition générale, prescription |
| `PROCEDE_ARGUMENTATIF` | Procédé argumentatif | analogie, induction, déduction, autorité, récit exemplaire, opposition |
| `EFFET_STYLE` | Effet de style | emphase, dramatisation, lyrisme, apaisement, injonction, séduction |
| `COHERENCE_CONTEXTE` | Cohérence avec le contexte | compatibilité avec l'amont, l'aval, le projet et le genre du texte |

## Palier Expert (+15, total 30)

| Code | Critère | Fonction |
|---|---|---|
| `LITTERAL_METAPHORIQUE` | Littéral / métaphorique | éviter de traiter une image comme une preuve, ou une preuve comme une image |
| `SUJET_ACTEUR_CIBLE` | Sujet, acteur, cible | qui parle, de qui, à qui, avec quel effet |
| `VALIDATION_SOURCE` | Source de validation disponible | interne au texte, externe, académique, clinique, institutionnelle |
| `INDEPENDANCE_VALIDATION` | Indépendance de la validation | source indépendante, liée, intéressée, institutionnelle, commerciale |
| `ACTUALITE_SOURCE` | Actualité / obsolescence | source récente, ancienne, stable, controversée |
| `CHAINE_CAUSALE` | Chaîne causale | causalité explicite, implicite, spéculative, absente |
| `GLISSEMENT_REGISTRE` | Glissement de registre | du récit vers la méthode, du témoignage vers la prescription, du symbole vers le fait |
| `PRESUPPOSE_IMPLICITE` | Présupposé implicite | ce que le texte suppose sans le dire |
| `ETHOS_AUTORITE` | Ethos / autorité | autorité de l'auteur, de la préfacière, du thérapeute, du témoin |
| `PATHOS_INTENSITE` | Intensité émotionnelle | émotion légitime ou amplification persuasive |
| `PROMESSE_LECTEUR` | Promesse faite au lecteur | transformation, guérison, révélation, compréhension, soulagement |
| `CONTRAT_LECTURE` | Contrat de lecture | roman, témoignage, essai, manuel, guide, récit initiatique |
| `FONCTION_PEDAGOGIQUE` | Fonction pédagogique | explication, exercice, transmission, avertissement, vulgarisation |
| `RISQUE_ETHIQUE_EXPERTISE` | Risque éthique / expertise | médical, thérapeutique, juridique, académique, financier, relationnel |
| `RECOMMANDATION_ACTION` | Recommandation d'action | conserver, nuancer, sourcer, déplacer, reformuler, supprimer, expertiser |

---

## Notes techniques

- **`family_code`** (regroupement thématique : `nature_enonce`,
  `preuve_et_source`, `argumentation`, `fonction_texte`,
  `rhetorique_influence`, `risque_et_diagnostic`) est une proposition de
  Claude pour organiser la lecture de la grille — **pas dicté par l'auteur
  du projet**, à corriger si l'usage réel montre un regroupement plus utile.
- **`output_key`** : version `snake_case` du `code`, destinée à être la clé
  utilisée dans la sortie JSON structurée du moteur IA
  (`supabase/functions/_shared/moteur-ia-structure.ts`) pour chaque
  dimension évaluée sur une unité de texte.
- **`prompt_question`** : laissée vide pour les 30 critères — reste à
  rédiger (la question précise posée à l'IA pour évaluer chaque dimension),
  hors périmètre de cette reconstruction.
- **`applies_to`** : par défaut `['personal', 'academic', 'professional',
  'literary']` (tous les types de documents) — à restreindre critère par
  critère si certains ne s'appliquent qu'à un type de document précis (ex.
  `RISQUE_ETHIQUE_EXPERTISE` particulièrement pertinent pour un mémoire
  académique). Catégorisation plus grossière que les 8 types de document du
  questionnaire de qualification (`questionnaire-cursaudit-v1-specification.md`
  section 1) — pas de correspondance 1-pour-1 automatique, à réconcilier à
  l'implémentation.
- **Reste à créer séparément** : table des résultats d'audit (référençant
  ces critères par `code`), et table des lentilles contextuelles
  personnelles (`audit_lenses` ou équivalent) — aucun des deux n'a de
  schéma proposé à ce jour.
