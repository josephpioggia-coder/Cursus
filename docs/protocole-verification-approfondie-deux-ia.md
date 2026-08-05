# Protocole de vérification approfondie à deux IA (60805-06)

*Conçu le 05/08/2026, en dialogue réel entre Claude et GPT, testé en conditions
réelles sur un extrait du livre "À cœur retrouvé" (Célicia Theys). Figé après
convergence — voir la session du 05/08/2026 pour le débat complet qui a mené
à chaque règle. Aucun code écrit pour l'instant : ceci est la conception,
pas l'implémentation (60805-06 reste `/F/A`).*

---

## Contexte du besoin

Sur certaines tâches à forts enjeux (vérification d'une affirmation
théorique/factuelle dans un passage sélectionné par l'auteur·e), Cursus doit
pouvoir faire dialoguer deux moteurs IA différents (Claude, GPT) — mais un
vrai dialogue, où l'un challenge des affirmations précises de l'autre, pas
deux avis indépendants suivis d'un vote. Fonctionnalité optionnelle, en
arrière-plan, à profondeur adaptative, facturée sur le quota de tokens de
l'auteur·e selon son palier.

**Leçon centrale, acquise par l'erreur en testant sur un cas réel** : juger un
passage isolé, sans le contexte du reste du manuscrit ni de la présentation
du livre, produit des verdicts qui semblent solides mais sont faux ou
incomplets. Exemple vécu : une "erreur d'attribution théorique" reprochée à
l'autrice s'est révélée être une vraie citation, correctement faite... trois
chapitres plus loin. Le protocole ci-dessous existe pour empêcher que ça se
reproduise.

---

## Étape 0 — Cartographie contextuelle obligatoire

**Objectif** : éviter de juger un passage comme une île. Obligatoire avant
toute analyse, mais doit rester légère — couverture large, exécution ciblée
(recherche par mots-clés/thèmes dans les nœuds du projet, jamais une
relecture complète systématique du manuscrit).

Exécution concrète :
1. Lire les métadonnées du projet (titre, sous-titre, genre annoncé).
2. Lire l'intention déclarée par l'auteur·e si elle existe (questionnaire
   d'intention).
3. Identifier les thèmes du passage sélectionné.
4. Chercher dans les autres nœuds du projet les reprises exactes et
   sémantiques de ces thèmes.
5. Ne remonter que les passages pertinents trouvés (pas tout le manuscrit).
6. Produire un dossier de contexte court :
   ```json
   {
     "metadata": {},
     "intention_auteur": {},
     "themes_detectes": [],
     "occurrences_pertinentes": [],
     "changements_de_registre": [],
     "changements_de_personne": [],
     "alignement_interet": null,
     "zones_sous_expertise_requise": [],
     "contexte_suffisant": true
   }
   ```
7. Marquer explicitement le contexte comme suffisant, partiel, ou
   insuffisant — jamais l'omettre.

**Distinction obligatoire** : une recherche ciblée qui ne trouve rien doit
dire *"aucune occurrence trouvée dans les passages consultés"*, jamais *"le
livre ne le dit jamais"* — sauf si le manuscrit complet a réellement été
parcouru.

---

## Règles de fond

**Registres à distinguer avant de juger toute affirmation** :
phénoménologique · autobiographique-interprétatif · symbolique/spirituel ·
théorique-général · pédagogique · prescriptif. Un registre autobiographique
n'a pas besoin d'être démontré ; un registre prescriptif, si.

**Attribution théorique** : ne jamais reprocher une attribution absente du
*passage* si elle est présente ailleurs dans le *manuscrit complet* — vérifier
le manuscrit entier avant de conclure à une erreur d'attribution. Une théorie
non citée par l'auteur·e peut être mentionnée comme rapprochement possible,
jamais comme erreur si l'auteur·e ne l'a jamais revendiquée. Toute théorie
introduite par l'IA elle-même (pas par l'auteur·e) doit être étiquetée comme
telle, distincte d'une théorie réellement citée dans le texte.

**Objection factuelle vs préférence stylistique** : seule une objection
factuelle, théorique, logique ou éthique réelle peut prolonger le dialogue.
Une préférence de style, de ton ou d'intensité de voix ne bloque jamais —
elle est toujours présentée comme un choix éditorial laissé à l'auteur·e,
jamais imposée. Corollaire : la correction vise l'exactitude du statut de
vérité d'une affirmation, jamais l'aplatissement de la voix littéraire.

**Alignement d'intérêt** (pas "conflit d'intérêt" — terme trop accusatoire) :
si le texte soutient une activité commerciale, thérapeutique ou de formation
de l'auteur·e, vérifier que le texte distingue clairement récit personnel,
méthode proposée, et offre professionnelle — pas juger si l'auteur·e est de
bonne foi.

**Domaines réglementés ou à fort enjeu** (juridique, médical, thérapeutique,
financier, diagnostic, promesse de guérison) : Cursus ne rend jamais de
verdict d'expertise automatisé. Il signale une **zone sous expertise
requise**, invite à une relecture par un professionnel qualifié — jamais
"ce passage est juridiquement sûr", seulement "ce passage touche à un
domaine sensible, à faire valider".

**Changements de personne grammaticale** (je → nous → vous → impératif) :
signal concret et détectable — souvent l'endroit exact où un récit personnel
glisse vers une méthode générale. À repérer systématiquement.

---

## Conduite du dialogue

**Profondeur adaptative** : courte par défaut (1-2 tours), ne s'allonge que
sur une correction bloquante réellement subsistante — jamais pour du
stylistique. Plafond dur au-delà duquel le dialogue s'arrête même en cas de
désaccord persistant (présenté alors comme désaccord non résolu, pas comme
échec).

**Sortie structurée machine-lisible à chaque tour** — jamais de texte libre
sans statut fermé, pour que le code tranche l'arrêt, pas une impression du
modèle :
```json
{
  "statut": "accord | accord_avec_nuances | desaccord_partiel | desaccord_majeur",
  "contexte_suffisant": true,
  "corrections_bloquantes": [],
  "corrections_non_bloquantes": [],
  "peut_arreter": true,
  "verdict": "recevable | recevable_avec_reserves | correction_recommandee | verdict_provisoire"
}
```

**"Rien à corriger" est un résultat final valide** — mais seulement rendu
après l'étape 0 complète. Rendu avant, il doit être marqué *verdict
provisoire*, jamais présenté comme définitif.

**Deux verdicts distincts, toujours séparés** : un verdict sur le passage
local, et un verdict sur la thèse portée par le livre dans son ensemble —
les deux peuvent diverger légitimement (exemple vécu : passage local
recevable tel quel, thèse du livre recevable après vérification globale
avec une réserve mineure de citation).

---

## Schéma d'ensemble

```json
{
  "etape_0": {
    "nom": "cartographie_contextuelle_obligatoire",
    "execution": "recherche ciblée dans les nœuds, pas relecture complète systématique"
  },
  "etape_1": {
    "nom": "analyse_du_passage",
    "condition": "seulement après étape 0",
    "verdict_possible": "provisoire si contexte insuffisant"
  },
  "etape_2": {
    "nom": "dialogue_adaptatif_deux_IA",
    "condition": "désaccord factuel, théorique, logique ou éthique réel",
    "exclusion": "pas de prolongation pour préférence stylistique"
  },
  "etape_3": {
    "nom": "reponse_optimale_auteur",
    "sortie": "verdict passage + verdict thèse du livre"
  }
}
```

## Ce qui reste à faire (hors périmètre de ce document)

- Migration SQL des tables nécessaires (job de fond, dossier de contexte,
  historique des tours).
- Edge Function d'orchestration (appels Anthropic + OpenAI directs — voir
  aussi le chantier séparé de sortie de Copy.ai, 60805-06 également).
- Intégration UI dans l'éditeur (sélection de passage, curseur de
  profondeur/coût, notification de fin de traitement en arrière-plan).
- Lien avec `intention_projet`/`QuestionnaireIntention` pour l'intention
  déclarée de l'étape 0.

Rien de ce qui précède n'a été codé — ce document fixe uniquement la
conception, validée par un dialogue réel testé sur un cas concret.
