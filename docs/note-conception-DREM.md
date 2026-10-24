# Note de conception — Diagnostic de reconstruction éditoriale majeure (DREM)

*24/10/2026 — réponse au brief « Évolution de CursAudit » (cas du témoignage à forte valeur de fond et à rédaction très difficile). Aucune ligne de code n'a été écrite : c'est une proposition à valider. Faits vérifiés dans le dépôt le même jour ; ce qui est une opinion est marqué comme tel.*

**Limite de cette note** : le brief fait référence à des extraits du manuscrit étudié, mais seul le brief lui-même m'est parvenu, pas les extraits. Mon avis porte donc sur la conception demandée, pas sur le texte. Les exemples de tests (§9) devront être complétés avec de vrais passages.

---

## 0. En une page

1. **Le diagnostic du brief est juste.** CursAudit analyse aujourd'hui la *nature épistémique* de chaque énoncé (fait, jugement, besoin de preuve, source…). Il ne mesure nulle part *l'effort que le texte impose au lecteur*. Un manuscrit peut être « recevable » énoncé par énoncé et pourtant épuisant à lire : c'est exactement le cas décrit.
2. **Ce n'est pas un nouveau produit, c'est une nouvelle lentille + un parcours.** Une lentille de lecture (« profil de lisibilité ») **branchée sur l'Aperçu gratuit** (phase 1, qui lit déjà le manuscrit entier en un seul appel), et un parcours de travail dans CursEdit quand la lentille conclut que de simples corrections ne suffiront pas. *(Révisé le 24/10/2026 à la suggestion de Joseph : première version = pré-audit approfondi, payant. L'Aperçu est le bon endroit : si l'écriture est le problème, il ne sert à rien de passer au pré-audit ni à l'audit.)*
3. **Trois précautions que je recommande par rapport au brief** :
   - ne **pas** créer de score chiffré « CRL » : afficher un *profil* (six dimensions, niveau qualitatif, fréquence mesurée sur un échantillon, exemples cités) ;
   - déclencher le DREM par une **règle explicite et lisible** appliquée par le code aux observations de l'IA, pas par un jugement global de l'IA ;
   - ne **jamais** produire de réécriture avant que le sens soit établi : *questions d'abord*, réécriture ensuite, uniquement sur ce qui est confirmé.
4. **MVP proposé** : une phase 0 sans réécriture, **dans l'Aperçu existant, sans étape supplémentaire ni coût pour l'auteur** (profil de lisibilité + indicateur DREM + texte de restitution respectueux), puis une « démonstration sur extrait » (§9 du brief). Le reste (parcours complet dans CursEdit) vient après validation sur de vrais manuscrits.

---

## 1. Ce que CursAudit couvre déjà

| Besoin du brief | Déjà dans Cursus ? | Où |
|---|---|---|
| Analyse par énoncé (fait / jugement / source / cohérence) | Oui | 30 critères `audit_criteria` (paliers 8/15/30), `orchestrer-audit-cursaudit` |
| Cohérence argumentative, cohérence avec le contexte, chaîne causale, présupposé implicite, glissement de registre | Oui, **par énoncé** | `COHERENCE_ARGUMENTATIVE`, `COHERENCE_CONTEXTE`, `CHAINE_CAUSALE`, `PRESUPPOSE_IMPLICITE`, `GLISSEMENT_REGISTRE` |
| Promesse faite au lecteur / contrat de lecture / fonction pédagogique | Oui, par énoncé | `PROMESSE_LECTEUR`, `CONTRAT_LECTURE`, `FONCTION_PEDAGOGIQUE` |
| Vue d'ensemble d'un livre | Oui | pré-audit approfondi : `nature_reelle`, `promesse_affichee`, `ecart_promesse_execution`, lecture chapitre par chapitre (point fort / point faible / à vérifier) |
| **Ampleur de réécriture** et plan d'intervention | **Oui, déjà** | pré-audit approfondi : `voies_editoriales[].ampleur_reecriture` (légère / moyenne / lourde), `duree_estimee_travail`, `plan_intervention`, `exemples_concrets` (problème → effet → geste → proposition), `a_preserver` |
| Intention de l'auteur | Oui | contrat d'intention (questionnaire), `question_libre`, `degre_intervention` |
| Fautes et lourdeurs de surface | Oui, côté **CursEdit** | Correction rapide (fautes + bilan de relecture) |
| Avis éditorial sur le récit / le propos | Oui, côté CursEdit | « Vérifier le fond » (avis, extraits cités, propositions copiables/insérables) |
| Traçabilité des modifications | Partiellement | historique de versions par chapitre (`versions_noeuds`), registre d'usage de l'IA, dossier de création |
| Ne jamais écraser l'original | Partiellement | l'historique garde les versions et « Restaurer » sauvegarde l'état courant ; pas de notion d'« original gelé » |
| Estimation du coût avant lancement | Oui pour l'audit | `tarifCursAudit.js` |
| Lien audit → éditeur | **Non** | `audits.projet_id` existe, aucun pont dans l'interface (noté depuis le 16/08) |

## 2. Lacunes révélées par ce cas

1. **Aucune mesure de la lisibilité comme *effort du lecteur*.** Les critères épistémiques ne voient pas qu'un référent est introuvable, qu'une phrase doit être réordonnée mentalement ou qu'un lien logique manque : ils jugent ce que l'énoncé *prétend*, pas ce que le lecteur doit *reconstituer*.
2. **L'unité d'analyse est le mauvais grain.** L'orchestrateur analyse des unités de la taille d'un paragraphe (≈ 1 475 unités pour 60 000 mots). Le problème décrit est *cumulatif et interdépendant* : un paragraphe pris seul peut passer, c'est leur accumulation et leur enchaînement qui épuisent. Il faut une lecture par passage plus long et un agrégat.
3. **Pas de distinction A / B / C** (difficulté du contenu / de l'explication / de la rédaction). Le critère `FONCTION_PEDAGOGIQUE` effleure le B, rien ne couvre le C.
4. **Pas de séparation valeur du fond / qualité de la forme** dans les résultats. Pire : quand la forme est trop ambiguë, l'IA a tendance à *deviner* un fond cohérent. Il faut un statut explicite « valeur potentielle à confirmer ».
5. **Pas de parcours de questions à l'auteur.** Aujourd'hui `a_verifier` est un champ de texte dans un rapport, pas une liste de questions suivie et réponse par réponse.
6. **Pas d'« original gelé » ni de contrôle de fidélité** entre une version révisée et l'original.
7. **`degre_intervention` (reformulation / réécriture) n'influence que le commentaire**, jamais une vraie sortie réécrite (limite déjà notée dans la cartographie).

## 3. Module, parcours ou extension ?

**Recommandation : une extension de l'Aperçu gratuit (la lentille, qui joue le rôle de porte d'entrée) + un parcours (le traitement).** Pas un module séparé, pas un nouveau produit, pas une étape de plus.

- *Pourquoi l'Aperçu et pas le pré-audit approfondi* (correction proposée par Joseph) : l'Aperçu est la **première** chose que voit l'auteur, elle est **gratuite**, et elle lit déjà le manuscrit **entier** en un seul appel (`preaudit-global-cursaudit`, fenêtre de 1 M de jetons) pour produire nature du texte, colonne vertébrale, tension, risques et palier recommandé. Y ajouter la lisibilité ne crée aucun appel, aucune étape, aucun écran de plus. Surtout : si l'écriture est le problème, lancer ensuite un pré-audit payant puis un audit détaillé serait un gaspillage pour l'auteur et une promesse trompeuse de notre part. C'est exactement le rôle d'une **porte d'orientation**.
- *Pourquoi pas un 31ᵉ critère par énoncé* : mauvais grain (§2.2), coût (1 475 appels de plus) et risque de bruit.
- *Pourquoi un parcours distinct ensuite* : l'exécution (questions, structure, révision, contrôle de fidélité) est un travail d'écriture, qui relève de CursEdit. Le brief demande lui-même de ne pas confondre diagnostic et exécution.
- *Ce que devient le pré-audit approfondi* : il reprend le profil de lisibilité de l'Aperçu comme point de départ (comme il reprend déjà `colonne_vertebrale` et `risques_globaux`), et sa propre `ampleur_reecriture` doit rester cohérente avec lui.

**Porte, pas barrière.** Si le DREM est signalé, l'Aperçu *recommande fortement* de commencer par le parcours de reconstruction plutôt que par l'audit, et l'écran de lancement du pré-audit/audit affiche l'avertissement (« les difficultés d'écriture observées risquent de limiter fortement l'utilité de cette analyse »). Je déconseille un **blocage dur** : le jugement vient d'une lecture automatique, il peut se tromper (§4.6), et l'auteur reste libre de son achat une fois informé.

## 4. Méthode de détection et ses limites

### 4.1 Profil de lisibilité (les six dimensions du brief)

Pour chaque passage échantillonné, l'IA relève, **avec citation exacte**, les occurrences de :

1. reconstruction syntaxique, 2. référentielle, 3. logique, 4. contextuelle, 5. structurelle, 6. incertitude interprétative.

Pour chaque dimension : *absente / ponctuelle / fréquente / dominante*, **calculée par le code** à partir de la proportion de passages concernés (pas jugée par l'IA), et accompagnée de 2–3 exemples cités.

**Pas de score chiffré global.** Le brief le dit lui-même (« aucun seuil chiffré validé ») ; je vais plus loin : même un « CRL = 7/10 » serait une fausse précision. On affiche des fréquences observées (« 9 passages sur 12 ») qui ne prétendent rien de plus que ce qu'elles sont.

### 4.2 Lecture par l'Aperçu : tout le texte, observations par chapitre, citations vérifiées par le code

L'Aperçu lit déjà le livre entier : **pas besoin d'échantillonner** tant que le texte tient dans la fenêtre de l'IA (au-delà, échantillon stratifié début / milieu / fin de chaque partie, avec la taille annoncée). Mais une IA qui lit 60 000 mots d'un coup est **peu fiable pour compter des fréquences** ; on lui demande donc des observations *structurées et vérifiables*, pas un pourcentage :

- **par chapitre ou partie** : niveau pour chacune des six dimensions (absente / ponctuelle / fréquente / dominante) ;
- **pour chaque dimension relevée** : 2 à 3 citations *exactes* avec leur localisation et une phrase d'explication ;
- **par passage difficile** : une attribution A / B / C et, dans les cas ambigus, la raison de l'hésitation.

Puis le **code** : (1) **vérifie mécaniquement que chaque citation figure telle quelle dans le manuscrit** (même principe que la rétrogradation des « sources » dans Références / Vérifier les faits : une citation introuvable est écartée et signalée, jamais crue sur parole) ; (2) calcule la part des chapitres touchés par dimension ; (3) applique la règle du §4.5. Le résultat est un **indice sur le manuscrit**, avec ce qui le fonde — pas un recensement.

### 4.3 Signaux objectifs peu coûteux (sans IA)

À calculer côté client sur tout le texte, gratuitement, et à afficher comme *signaux*, jamais comme verdict : longueur moyenne et maximale des phrases, part de phrases > 50 mots, densité de ponctuation anormale, part de mots absents du dictionnaire (Cursus embarque déjà une liste de ~411 000 formes ; noms propres et néologismes à écarter), répétition de débuts de phrase. Ils servent à *confirmer ou nuancer* l'observation de l'IA et à détecter un échantillon peu représentatif.

### 4.4 Classification A / B / C

Pour chaque passage difficile, l'IA propose **une** attribution principale (A contenu / B explication / C rédaction) *et dit sur quoi elle se fonde*, avec une réserve explicite quand deux sont plausibles. Le rapport donne la répartition observée (« principalement C, avec du B dans les chapitres 4 et 7 »), pas un pourcentage.

### 4.5 Règle de déclenchement du DREM (appliquée par le code)

Le DREM est signalé quand **toutes** les conditions suivantes sont remplies (seuils *provisoires, à calibrer sur des manuscrits réels, jamais présentés comme validés*) :

- au moins **trois dimensions** sur six sont « fréquentes » ou « dominantes » ;
- la dimension « syntaxique » **ou** « référentielle » en fait partie (ce sont celles qu'aucune réécriture locale ne règle) ;
- les passages affectés sont **répartis** (au moins la moitié des parties/chapitres échantillonnés), pas concentrés ;
- pour au moins un tiers des passages affectés, l'IA indique qu'**une correction purement grammaticale laisserait subsister l'obstacle**, avec la raison citée.

Sortie : *indicateur d'orientation* à trois niveaux — « corrections ponctuelles suffisantes », « révision de fond à envisager », « reconstruction éditoriale approfondie recommandée (DREM) » — toujours accompagné des observations qui le justifient et de l'**incertitude** (taille de l'échantillon, accord entre les deux IA en mode 2 IA).

### 4.6 Limites à assumer

- Le jugement de l'IA sur la « difficulté » reste un jugement de lecteur-machine : **il peut se tromper dans les deux sens** (voir §9 pour les tests). Le mode 2 IA (Claude + GPT, déjà en place) sert ici de contrôle de stabilité ; un désaccord est affiché, pas lissé.
- Les textes **dictés** ou volontairement oraux produisent des signaux proches (phrases longues, reprises) sans être inintelligibles : d'où la distinction du §7 du brief, que le profil doit appliquer (une écriture orale *intelligible* ne doit pas déclencher le DREM).
- L'échantillon peut manquer des zones très dégradées ou très saines : le dire.
- Aucune étude ne valide ces seuils : tout affichage de seuil doit porter la mention « repère de travail, non validé ».

## 5. Articulation CursAudit ↔ CursEdit

```
CursAudit (diagnostic)                     CursEdit (exécution)
─────────────────────                      ─────────────────────
Profil de lisibilité + DREM  ──pont──►     Projet « parcours de reconstruction »
  + intentions de l'auteur                   1. Intentions confirmées (contrat d'intention)
                                             2. Cartographie par chapitre (idées, ruptures, redites)
                                             3. Questions à l'auteur  ◄── réponses de l'auteur
                                             4. Plan de réorganisation (proposé, validé)
                                             5. Version de travail (copie ; l'original est gelé)
                                             6. Contrôle de fidélité (original ↔ version ↔ réponses)
```

Briques existantes réutilisables : le **pont `audits.projet_id`** (prévu, jamais câblé) ; le **registre d'usage de l'IA** et l'**historique de versions** (traçabilité) ; le mécanisme **propositions copiables/insérables** (`⟹ « … »`, remplacement unique + Ctrl+Z) ; le **Dossier de création** (y inscrire le parcours) ; **Correction rapide** et **Vérifier le fond** pour les étapes 5 et 6 ; le calcul de **tarif** pour l'estimation.

À créer : un état « original gelé » (copie en lecture seule, marquée, non modifiable par les outils IA), une table de **questions à l'auteur** (question, extrait cité, réponse, date, statut), une **version de travail** distincte de l'original (nœuds copiés), et le contrôle de fidélité.

## 6. Parcours utilisateur proposé

1. **Aperçu gratuit** (déjà le premier geste de l'auteur) → il inclut maintenant le profil de lisibilité.
2. **Restitution** : si DREM, l'Aperçu affiche, *à la place* de la proposition habituelle de pré-audit/audit, le texte respectueux du brief (§10), les observations citées, l'incertitude, et propose *deux* suites : « démonstration sur un extrait » ou « parcours complet » (avec estimation du volume de travail et du coût, **avant** tout engagement). Le pré-audit et l'audit restent accessibles, avec avertissement, pour un auteur qui souhaite quand même les lancer.
3. **Démonstration** (extrait représentatif choisi avec l'auteur) : texte original → difficultés et effet sur la compréhension → **questions à l'auteur** → proposition de révision *uniquement là où le sens est établi* (le reste marqué « à confirmer ») → comparaison commentée → estimation prudente du travail restant.
4. **Parcours complet** dans CursEdit, étape par étape, avec validation de l'auteur à chaque étape structurante ; l'auteur peut s'arrêter ou revenir en arrière.
5. **Livrable** : version de travail + journal des décisions (Dossier de création enrichi) ; l'original reste intact.
6. **Vérification de la réception** : hors outil au départ (lecteurs représentatifs, grille de questions fournie par Cursus), en pistes ultérieures.

## 7. Risques de réécriture infidèle et garde-fous

| Risque | Garde-fou |
|---|---|
| L'IA comble un lien logique manquant par une hypothèse plausible mais fausse | **Questions d'abord.** Tout lien non explicite dans l'original est signalé « à confirmer » et ne figure jamais dans une proposition de révision tant que l'auteur n'a pas répondu |
| Ajout de faits, noms, dates, chiffres | **Contrôle mécanique** : toute entité (nombre, nom propre, date) présente dans la révision et absente de l'original *et* des réponses de l'auteur est signalée avant toute application |
| Dérive progressive de l'interprétation (déjà observée, cf. note du 03/10) | Relecture systématique **de l'original** à chaque étape, jamais de la version précédente seule ; citation exacte obligatoire |
| Lissage de la voix | Consigne explicite de conserver lexique et tournures de l'auteur ; option « degré d'intervention » déjà dans le questionnaire ; comparaison commentée |
| Remplacement silencieux de l'original | Original gelé ; version de travail séparée ; **aucune application automatique** ; Ctrl+Z et historique conservés |
| L'IA flatte ou, à l'inverse, accable | Formulation encadrée par le §10 du brief ; faits observés + exemples ; jamais de jugement sur l'auteur |
| Les deux IA « se valident » | Le désaccord est affiché ; le contrôle de fidélité compare au texte, pas à l'autre IA |

## 8. Proposition de MVP puis d'évolutions

**MVP — phase 0 (lecture seule, aucune réécriture, dans l'Aperçu existant)** — *à valider d'abord sur 2–3 manuscrits réels, dont celui qui a motivé le brief*
- Nouveaux champs dans le schéma de sortie de `preaudit-global-cursaudit` (profil de lisibilité par chapitre, citations, A/B/C, valeur du fond à confirmer) + vérification mécanique des citations + règle DREM appliquée par le code ; signaux objectifs calculés côté client.
- Profil de lisibilité (6 dimensions, fréquences, exemples cités), classification A/B/C, statut « valeur du fond à confirmer ».
- Indicateur d'orientation à 3 niveaux avec règle de déclenchement explicite (§4.5).
- Section dans le rapport (écran + export Word) avec le texte de restitution respectueux.
- Coût : **aucun appel supplémentaire** (mêmes jetons d'entrée qu'aujourd'hui, un peu plus de sortie : à mesurer sur un livre réel). L'Aperçu reste gratuit. Risque à surveiller : le dépassement du délai d'une Edge Function si la sortie s'allonge trop (l'Aperçu actuel tient déjà dans un seul appel).

**Phase 1 — démonstration sur extrait**
- Génération du dossier de démonstration (§9 du brief) dans CursEdit : original, difficultés, questions, révision partielle, comparaison, estimation. Réutilise Correction rapide / Vérifier le fond / propositions insérables.

**Phase 2 — parcours dans CursEdit**
- Pont audit → projet, original gelé, table de questions, version de travail, contrôle de fidélité, journal de décisions.

**Phase 3 — évolutions**
- Reconstruction structurelle assistée (propositions de plan), kit de test de réception avec lecteurs, calibration des seuils sur un corpus de manuscrits annotés, éventuellement parcours « manuscrit dicté » dédié.

## 9. Tests pour distinguer A, B et C

Principe : fabriquer des **triplets à contenu constant** et vérifier que la lentille distingue ce qui varie. À compléter avec de vrais passages anonymisés.

| Test | Construction | Résultat attendu |
|---|---|---|
| **T1 — A seul** | Passage scientifique/philosophique dense, bien rédigé (phrases claires, référents explicites, transitions) | CRL : syntaxe/référents/logique *absents ou ponctuels* ; classé **A** ; **pas de DREM** |
| **T2 — B seul** | Même contenu mais définitions, exemples et transitions retirés ; phrases restées correctes | Dimensions « contextuelle » et « structurelle » en hausse ; syntaxe/référents *absents* ; classé **B** ; pas de DREM |
| **T3 — C seul** | Contenu simple (récit de vie quotidien) rédigé avec phrases mal construites, référents flottants, enchaînements implicites | Syntaxe, référents, logique *fréquents* ; classé **C** ; DREM si répartition et interdépendance |
| **T4 — C masqué par la dictée** | Texte oral mais intelligible (reprises, phrases longues, mais référents et liens clairs) | **Pas de DREM** (distinction §7 du brief) |
| **T5 — Ambiguïté artistique** | Passage poétique volontairement elliptique | Incertitude interprétative signalée **comme productive possible**, pas comme obstacle |
| **T6 — Test de « réparabilité »** | Passage T3 corrigé *uniquement* en orthographe/grammaire | Le profil reste largement inchangé → confirme qu'une correction locale ne suffit pas |
| **T7 — Test inverse** | Passage T3 réécrit par un humain avec l'auteur | Les dimensions chutent ; sert de **témoin de validité** de l'outil |
| **T8 — Stabilité** | Même passage soumis 3 fois, puis à Claude et GPT | Classement stable ; désaccord affiché plutôt que lissé |
| **T9 — Fidélité** | Révision proposée d'un passage T3 + réponses simulées de l'auteur | Aucune entité nouvelle ; liens non confirmés laissés « à confirmer » |

Critère de succès de la phase 0 : T1–T4 correctement séparés, T8 stable, T9 sans entité inventée. Sinon : ajuster la consigne avant toute exposition aux clients.

---

## Points à trancher par Joseph avant développement

1. **Nom affiché à l'auteur** : « DREM » reste un terme interne ; propose-t-on « reconstruction éditoriale approfondie recommandée » ? (je le recommande)
2. **Tarification** : la phase 0 reste incluse dans l'Aperçu gratuit (recommandé). Reste à décider si la *démonstration sur extrait* (phase 1) est gratuite ou payante.
3. **Manuscrit témoin — DÉCIDÉ (Joseph, 24/10/2026)** : pas de numérisation du livre papier (temps, et on ne sait pas ce que le client en ferait). Si le client accepte, il fournit lui-même le fichier numérique ; la **première analyse (Aperçu avec profil de lisibilité) lui est offerte**, en lui annonçant qu'il y verra les éléments sur lesquels travailler ; le travail se fait ensuite **dans CursEdit, pas dans CursAudit** (à ce niveau de difficulté, l'auteur n'a pas à passer par l'audit). Conséquences : (a) la phase 0 se valide d'abord sur des **textes d'essai écrits pour l'occasion** (triplets T1–T9 du §9), pas sur le manuscrit réel ; (b) le premier cas réel sera celui du client, avec son accord explicite sur le traitement de son texte par les IA (consentement déjà présent à la création d'un audit) ; (c) en attendant le pont audit → projet, le fichier numérique est importé deux fois (Aperçu dans CursAudit, projet dans CursEdit).
4. **Blocage ou avertissement** : confirmer qu'un DREM *recommande fortement* d'éviter le pré-audit/audit, sans l'interdire (mon avis, §3).
5. **Seuils du DREM** : accord pour les présenter comme « repères de travail non validés » dans l'interface et les rapports ?

---

## Annexe — Premier examen sur une page réelle (24/10/2026)

Joseph a fourni la photo d'**une** page imprimée du manuscrit qui a motivé le brief (aucune citation n'est reproduite ici : texte du client). Une page n'autorise aucune conclusion sur le livre ; elle sert à repérer des *familles* de problèmes et à décider dans quel ordre les traiter.

| Famille | Constat sur la page | Traitement générique |
|---|---|---|
| **Typographie** | points de suspension écrits « ... » avec espace avant ; « .. ; » (deux points puis point-virgule) ; « ! » suivi d'une minuscule ; nom propre sans majuscule ; point final manquant à une phrase | **Règles déterministes (code, sans IA)**, option distincte et *activable* : la Correction rapide ignore volontairement la typographie (retour de Joseph du 22/10) |
| **Accords / syntaxe locale** | accord singulier/pluriel sur une énumération ; construction « elle amène en moi à laisser… » bancale | Correction rapide (IA) — déjà couvert |
| **Référents flottants** | « il » dont l'antécédent est une phrase plus haut ou implicite ; « ce que » sans antécédent net ; « certaines » (des passions) alors que le sujet annoncé est « la passion » au singulier | **Questions à l'auteur** (jamais devinées) — fonction nouvelle |
| **Liens logiques implicites** | paragraphes d'une phrase juxtaposés sans articulation ; retour au thème annoncé après une digression sans signal | Cartographie + proposition de plan, validée par l'auteur |
| **Tics et atténuateurs** | « en tout cas » deux fois, « une certaine… » répété, « important » trois fois dans un paragraphe, absolu aussitôt atténué (« tout est… mais pas… ; en tout cas rarement ») | **Compteur de répétitions** (code, sans IA) par chapitre, puis revue d'auteur |
| **Mise en page imprimée** | retrait gauche qui varie de paragraphe en paragraphe, interlignes inégaux, espacement de justification irrégulier | Hors audit : problème de composition, réglé à l'export |

Observation sur le fond : malgré cela, la **valeur potentielle est lisible** (pensée dichotomique, intensité émotionnelle, passions qui passent ou se figent). Les phrases sont courtes et en grande partie grammaticales : la difficulté dominante est **référentielle, logique et structurelle**, pas syntaxique — ce qui confirme le choix de la règle du §4.5 (référentiel ou syntaxique obligatoire) et rappelle le §7 : un style télégraphique peut être une voix ; ce qu'on corrige, ce sont les ambiguïtés précises, pas le style.

**Ordre recommandé** : Aperçu sur le texte **brut** (il doit voir la difficulté réelle, sans nettoyage préalable) → import dans CursEdit, original gelé → **étape 0 mécanique** (typographie, répétitions, fautes) → questions à l'auteur → structure → révision.
