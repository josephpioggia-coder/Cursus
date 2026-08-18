# Protocole de vérification approfondie à deux IA (60805-06)

*Conçu le 05/08/2026, en dialogue réel entre Claude et GPT, testé en conditions
réelles sur un extrait du livre "À cœur retrouvé" (Célicia Theys). Figé après
convergence — voir la session du 05/08/2026 pour le débat complet qui a mené
à chaque règle. Edge Function écrite le 15/08/2026 (voir "Ce qui reste à
faire" en bas de document) — pas encore déployée sur Supabase.*

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

**Second principe central, découvert en fin de test réel du 05/08/2026** :
Cursus s'adresse d'abord à des manuscrits **en cours d'écriture**, pas à des
livres finis et publiés. Sur un livre complet, l'outil peut nommer un motif
précisément (« telle citation exacte, étendue à tort à telle pratique non
couverte »), parce qu'il a accès à la trajectoire entière. Sur un manuscrit
encore ouvert, il ne peut pas savoir si l'autrice va, plus loin, ajouter
exactement la nuance qui semble manquer à ce stade — présenter un verdict
définitif serait alors une fausse certitude.

**Précision, ajoutée après discussion** : ce qui détermine le registre n'est
pas un statut de projet déclaré ("en cours" / "terminé" dans Cursus), mais
**la quantité de matière réellement enregistrée dans les nœuds au moment de
la demande**. Un avant-propos rédigé après coup, une fois le reste du livre
achevé (pratique d'écriture courante), donne accès à beaucoup de matière
même si le projet Cursus n'est pas formellement clôturé. À l'inverse, un
projet marqué "terminé" mais peu rempli ne donne pas plus de matière pour
autant. C'est la couverture réelle du manuscrit disponible qui compte, pas
une étiquette.

**Règle qui en découle** : le registre du message à l'auteur·e dépend de
cette couverture réelle :
- **Matière disponible large** (proche de l'intégralité du projet) : verdict
  précis et nommé, motif identifié explicitement (ex. citer les auteurs
  concernés et ce que leurs travaux couvrent réellement).
- **Matière disponible partielle** (le cas normal en cours d'écriture) :
  **mise en garde préventive**, formulée en termes généraux sur le risque
  émergent (ex. « veillez à distinguer le statut de reconnaissance de
  chaque approche que vous mentionnez ») — jamais un verdict qui présume de
  ce que l'auteur·e n'a pas encore écrit. L'objectif est de permettre une
  correction de trajectoire, pas de sanctionner un texte inachevé comme
  s'il était figé.

Le dossier de contexte (étape 0) doit donc porter une mesure de couverture
réelle (proportion du projet effectivement indexée), pas un simple statut
déclaré.

**Lien avec CursAudit** (chantier séparé, même soirée) : le même mécanisme
de dialogue à deux IA sert aux deux produits. CursAudit part du principe
qu'un document est déjà terminé ou suffisamment avancé — c'est donc le cas
"matière large" par défaut. Cursus Édition, à l'inverse, doit traiter le cas
"matière partielle" comme le cas normal, pas comme une exception — c'est la
situation la plus fréquente pour un manuscrit encore en écriture.

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

**Questionnaire d'intention (interface), ajouté après un test réel du
06/08/2026** : aujourd'hui, cliquer sur "Analyse" ne propose aucune
contextualisation — l'IA reçoit le texte seul, sans savoir ce qu'il est
censé être. C'est une faiblesse identifiée sur un cas limite réel (des
messages WhatsApp personnels soumis comme "scène" indépendante) : sans cette
information, une analyse peut optimiser pour la cohérence littéraire au prix
d'une fonction réelle du texte (par exemple rassurer un destinataire réel)
que rien ne signale à l'IA. Avant de lancer l'analyse, l'interface doit donc
poser explicitement la question du statut du texte, à choix fermé plus une
option libre :
- correspondance intime envoyée (destinataire réel, fonction relationnelle
  à préserver) ;
- matériau littéraire à intégrer dans un livre (optimisation stylistique
  pleinement légitime) ;
- fragment poétique autonome ;
- trace relationnelle à préserver dans sa spontanéité (ne pas lisser) ;
- autre — champ libre, traité comme une vraie question adressée à l'IA, pas
  comme une case parmi d'autres.

Cette réponse entre dans le dossier de contexte comme `intention_auteur`
déclarée (voir l'objet à l'étape 6) et prime sur toute déduction que l'IA
ferait seule du genre du texte. Un texte déclaré comme correspondance ou
trace à préserver ne doit jamais recevoir de suggestion de reformulation qui
sacrifie sa fonction relationnelle à la seule cohérence esthétique.

*Piste secondaire, non tranchée* : personnaliser la relation
auteur·e/IA (tutoiement ou vouvoiement, éventuellement d'autres préférences)
via ce même questionnaire — hors périmètre de la contextualisation
elle-même, à traiter séparément si retenu.

**Distinction obligatoire** : une recherche ciblée qui ne trouve rien doit
dire *"aucune occurrence trouvée dans les passages consultés"*, jamais *"le
livre ne le dit jamais"* — sauf si le manuscrit complet a réellement été
parcouru.

**Règle sur la forme des `occurrences_pertinentes`, ajoutée après un test
réel du 05/08/2026** : un résumé de Cursus n'est pas plus vérifiable par un
modèle qu'un résumé d'un autre modèle — même faille, un niveau plus haut.
Chaque occurrence doit donc être un objet structuré, pas une phrase de
synthèse :
```json
{
  "theme": "Peter Levine / Somatic Experiencing",
  "node_id": "chapitre_1",
  "extrait": "je m'ouvre à l'approche de Peter Levine en « somatic experiencing »",
  "fonction": "confirme que la notion est sourcée ailleurs dans le manuscrit"
}
```
Un extrait verbatim et son `node_id` d'origine — jamais seulement une
caractérisation ("Levine cité nommément (x2)") que le modèle destinataire
ne peut pas auditer lui-même.

**Règle non négociable, ajoutée après un test réel du 05/08/2026** : aucun
modèle ne doit construire lui-même le contexte officiel destiné à l'autre.
Le dossier de contexte est produit par Cursus, transmis identiquement aux
deux IA, et versionné avec l'analyse. Ni Claude ni GPT ne transmettent le
contexte à l'autre — chacun le reçoit séparément, depuis Cursus.

**Un modèle peut contester le dossier de contexte, jamais le remplacer
silencieusement par ses propres suppositions.** S'il estime le contexte
insuffisant pour conclure, il lève un signal explicite plutôt que
d'improviser — en précisant ce qui manque, pas seulement qu'il manque
quelque chose :
```json
{
  "alerte_contexte": true,
  "type_contexte_manquant": "occurrences_aval | contexte_amont | definition_theorique | intention_auteur | passage_pedagogique | offre_commerciale",
  "theme_a_rechercher": "trauma transgénérationnel",
  "raison": "Le dossier ne montre pas si cette idée est reprise plus loin comme hypothèse, croyance ou affirmation générale.",
  "requete_ciblee": ["transgénérationnel", "lignée", "descendants", "trauma hérité", "épigénétique"]
}
```

**Réaction de Cursus à une `alerte_contexte`, décidée le 05/08/2026 (option
choisie : relance bornée, pas arrêt immédiat ni boucle ouverte)** :
1. Reçoit `alerte_contexte: true`.
2. Lit `theme_a_rechercher` et `requete_ciblee`.
3. Relance une recherche dans les nœuds du projet, ciblée sur cette requête
   précise — jamais une relecture complète.
4. Ajoute les passages trouvés au dossier de contexte.
5. Incrémente `contexte_relance_count`.
6. Reprend le tour interrompu avec le dossier enrichi.

Plafond strict :
```json
{ "max_relances_contexte": 1, "si_contexte_toujours_insuffisant": "arret_verdict_provisoire" }
```
Si une nouvelle `alerte_contexte` apparaît après cette unique relance,
Cursus arrête et retourne :
```json
{
  "verdict": "verdict_provisoire",
  "raison": "Contexte interne insuffisant malgré une relance ciblée.",
  "analyse_locale": "possible",
  "analyse_globale": "non_conclusive",
  "contexte_manquant": "...",
  "recommandation": "Fournir ou indexer les sections concernées avant de conclure."
}
```
Une seule tentative de complément, jamais plus — sinon on recrée, pour le
contexte, la boucle ouverte qu'on a interdite pour le dialogue lui-même.

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

**Préface ou avant-propos externe** : vérifier systématiquement qui l'a
écrit, et si cette personne a une relation financière avec l'auteur·e
(formatrice ou formateur payé, coach, partenaire commercial, employeur).
S'appuyer uniquement sur des informations publiques et auto-divulguées par
les personnes concernées (leur propre site, leurs propres réseaux sociaux),
jamais sur des informations privées ou non vérifiables. Si une telle
relation existe, elle doit être signalée explicitement comme un signal de
non-neutralité potentielle — jamais présumée neutre par défaut, jamais
présentée comme une accusation ou une preuve de mauvaise foi.

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

**Hiérarchisation obligatoire des remarques en sortie finale** (ajouté après
un test réel du 05/08/2026, article de revue) : la sortie ne doit jamais
être une liste plate mélangeant tout au même niveau. Cursus range chaque
remarque dans une catégorie distincte, jamais fusionnée :
- `valeur_ajoutee_editoriale` — angle mort réel repéré dans le texte
  (question qu'un lecteur expert poserait, qu'un correcteur ordinaire ne
  verrait pas) ; c'est le niveau le plus utile, à mettre en avant, pas noyé
  parmi les corrections mineures ;
- `corrections_probables` — répétitions, transitions manquantes, densité
  lexicale, ce que le dialogue a confirmé avec un bon niveau de confiance ;
- `alertes_a_verifier_sur_source` — anomalie possible (mot, accord, coupure)
  qui peut provenir d'un artefact de numérisation ou de découpe (OCR,
  extraction d'image) plutôt que d'une erreur réelle de l'auteur·e : ne
  **jamais** présenter comme faute certaine ce qui dépend du document
  source original — formuler comme "à vérifier sur l'original", pas comme
  correction ;
- `remarques_non_bloquantes` — préférence stylistique ou flottement mineur
  (registre, pronoms), qui reste au choix de l'auteur·e.

---

## Contrats d'appel par rôle

Cursus appelle chaque moteur avec un rôle explicite, jamais un prompt
générique bricolé à la volée.

**Appel à Claude (tour 1 et révisions)** :
```json
{
  "role": "analyseur_initial",
  "texte_selectionne": "...",
  "dossier_contexte": {},
  "consigne": "Analyse les affirmations précises du passage en tenant compte du dossier de contexte. Ne produis pas de verdict définitif si contexte_suffisant est faux."
}
```
Réponse attendue :
```json
{
  "tour": "A1",
  "claims": [],
  "analyse": "...",
  "corrections_bloquantes": [],
  "corrections_non_bloquantes": [],
  "alerte_contexte": false,
  "peut_arreter": false,
  "reponse_optimale_auteur": null
}
```

**Appel à GPT (critique)** :
```json
{
  "role": "critique_adversarial",
  "texte_selectionne": "...",
  "dossier_contexte": {},
  "tour_precedent": {}
}
```
Réponse attendue :
```json
{
  "tour": "B1",
  "statut": "accord | accord_avec_nuances | desaccord_partiel | desaccord_majeur",
  "corrections_bloquantes": [],
  "corrections_non_bloquantes": [],
  "alerte_contexte": false,
  "peut_arreter": true,
  "verdict": "recevable | recevable_avec_reserves | correction_recommandee | verdict_provisoire",
  "reponse_optimale_auteur": "..."
}
```

`dossier_contexte` est **identique** dans les deux appels — copié depuis le
dossier officiel produit à l'étape 0, jamais reconstruit ou résumé par l'un
des deux modèles pour l'autre.

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

---

## Logigramme d'orchestration (qui parle à qui, et dans quel ordre)

**Principe central, ajouté après un test réel du 05/08/2026** : l'étape 0
n'est jamais exécutée par une IA, jamais dupliquée une fois par moteur — elle
est exécutée **une seule fois, par Cursus lui-même** (recherche mécanique
dans sa propre base, pas un jugement d'IA), et le dossier de contexte
résultant est envoyé **identique** aux deux moteurs. Ni Claude ni GPT ne se
transmettent le contexte l'un à l'autre — chacun le reçoit séparément mais
identique, depuis Cursus. C'est ce qui garantit que les deux partent de la
même base, sans que l'un doive faire confiance au résumé de l'autre.

```
1. DÉCLENCHEUR
   L'auteur·e sélectionne une zone et demande une vérification approfondie.
        ↓
2. CURSUS exécute l'étape 0 — une seule fois, mécaniquement
   (métadonnées, intention déclarée, recherche des thèmes dans les
   autres nœuds du projet) → produit le dossier de contexte.
        ↓
3. CURSUS envoie à CLAUDE : { passage + dossier de contexte }
   → tour 1 (analyse).
        ↓
4. CURSUS envoie à GPT : { passage + dossier de contexte + tour 1 }
   → tour 2 (critique ciblée). GPT reçoit le dossier directement de
   Cursus, pas de Claude — même source, symétrique.
        ↓
5. CURSUS lit la sortie structurée de GPT.
        │
        ├── alerte_contexte = true et contexte_relance_count < 1 →
        │   recherche ciblée Cursus sur requete_ciblee, dossier enrichi,
        │   contexte_relance_count += 1, reprise du tour.
        │
        ├── alerte_contexte = true et contexte_relance_count = 1 →
        │   arrêt : verdict_provisoire, contexte insuffisant signalé
        │   à l'auteur·e (pas de deuxième relance).
        │
        ├── peut_arreter = true → passe directement à l'étape 7.
        │
        └── peut_arreter = false → renvoie à CLAUDE : { tour 1 + tour 2 }
                   → tour 3 (révision ou défense).
                       ↓
6. CURSUS relit "peut_arreter".
        │
        ├── oui → étape 7.
        │
        └── non → un dernier tour GPT (validation courte),
                   puis arrêt obligatoire (plafond de profondeur atteint).
        ↓
7. CURSUS produit la sortie finale : verdict sur le passage +
   verdict sur la thèse du livre (si applicable) → transmis à l'auteur·e.
```

## Ce qui reste à faire (hors périmètre de ce document)

**Écrite le 15/08/2026** : `supabase/functions/verification-deux-ia/index.ts`
— implémente les étapes 0 à 7 et le logigramme d'orchestration ci-dessus,
en consommant `supabase/functions/_shared/moteur-ia-structure.ts` pour les
deux appels IA. Contrôle d'accès (auth + quota) répliqué de `claude-prox`,
cohérent avec "facturée sur le quota de tokens de l'auteur·e selon son
palier" (voir Contexte du besoin). Pas encore déployée sur Supabase — même
procédure que les Edge Functions précédentes (SQL Editor n'est pas
concerné ici, c'est un déploiement de fonction, pas une migration).

**Limites connues de cette première version**, documentées en tête du
fichier plutôt que masquées :
- Étape 0 mécanique comme l'exige le protocole, mais la détection de thèmes
  et de reprises reste un appariement par mot-clé (`ILIKE`) — la reprise
  "sémantique" au sens propre (embeddings) n'est pas implémentée.
- `changements_de_registre` n'est pas rempli par l'étape 0 (une
  classification par liste de mots produirait une fausse précision) —
  chaque `claim` de Claude porte son propre `registre`, c'est la source de
  vérité réelle pour ce signal.
- `verdict_these_livre` reste à `null` : le protocole documente le besoin
  de deux verdicts distincts (passage local / thèse du livre), mais aucun
  mécanisme n'est décrit pour évaluer la thèse d'ensemble à partir d'un
  dialogue sur un seul passage — non inventé plutôt que deviné.
- `alignement_interet` et `zones_sous_expertise_requise` restent aux
  valeurs par défaut du dossier de contexte (non calculées mécaniquement) —
  ce sont les tours IA qui les signalent via `corrections_bloquantes`.

**Toujours hors périmètre, non commencé** :
- Migration SQL de persistance (job de fond, historique des tours,
  versionnage du dossier de contexte) — la version actuelle de l'Edge
  Function est synchrone, sans stockage intermédiaire.
- Intégration UI dans l'éditeur (sélection de passage, curseur de
  profondeur/coût, notification de fin de traitement en arrière-plan).
- Lien avec `intention_projet`/`QuestionnaireIntention` pour l'intention
  déclarée de l'étape 0 — la fonction accepte `intention_declaree` en
  paramètre d'entrée, mais rien ne l'alimente automatiquement depuis
  `QuestionnaireIntention.jsx` pour l'instant.
