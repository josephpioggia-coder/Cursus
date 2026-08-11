# Cursus — Questionnaire d'intention v3 (spécification complète)

*Document de référence pour l'implémentation future. Conçu par Joseph le 11/08/2026. Remplace [questionnaire-intention-v2-specification.md](./questionnaire-intention-v2-specification.md), conservé pour mémoire.*

*Distinct du [questionnaire de diagnostic éditorial d'un texte tiers](./questionnaire-diagnostic-editorial-tiers-specification.md), qui s'applique après coup à un texte déjà écrit. Celui-ci s'applique avant ou pendant l'écriture, pour cadrer l'accompagnement de CursEdit.*

---

## Principe directeur

L'entrée en matière ne part plus de « Quel genre de livre écrivez-vous ? » mais de « Quel rapport voulez-vous entretenir avec l'écriture ? ». Les figures littéraires évoquées dans *Le goût de l'écriture* servent de repères pour situer un rapport à l'écriture, jamais de cases dans lesquelles enfermer l'auteur — on peut être proche d'Ernaux pour la mémoire, de Perec pour la forme et de Sartre pour l'intention, à la fois.

Le questionnaire est scindé en deux, pour rester léger à l'entrée :

- **Partie A — Tronc commun (obligatoire)** : uniquement les réponses dont Cursus a *absolument* besoin pour fonctionner dès la première session — calibrer le comportement de CursEdit et protéger l'auteur. Aucune question ouverte : uniquement des choix rapides (sélection, curseur).
- **Partie B — Approfondissement (optionnel)** : la carte d'intention littéraire, plus riche, plus lente à remplir, qui peut être complétée plus tard, section par section, sans jamais bloquer l'accès à l'écriture.

Ce découpage remplace celui de la v2 (poids fort / moyen / faible mêlés dans une même liste) par une séparation nette entre ce qui est demandé et ce qui est proposé.

---

## Partie A — Tronc commun (obligatoire)

### A1. Intention d'écriture dominante
Choisissez jusqu'à trois réponses parmi : comprendre · me comprendre · me souvenir · témoigner · transmettre · convaincre · agir · créer · explorer la langue · raconter · jouer · laisser une trace · autre (à préciser).

*Remplace l'ancienne question ouverte « pourquoi écrivez-vous ce livre ? » (v2 §1) par une liste fermée — même information, réponse en quelques secondes.*

### A2. Catégorie du texte
Choix unique, court : roman · récit inspiré de faits réels · autobiographie · témoignage · essai · mémoire · récit initiatique · développement personnel · manifeste · guide pratique · manuel technique · poésie · mélange de plusieurs genres · autre.

*Tag fonctionnel minimal — nécessaire aux gabarits d'outils de CursEdit et sert plus tard de référentiel « conventions du genre déclaré » pour CursAudit (voir questionnaire de diagnostic, §4). Ne se substitue pas à A3/A4, qui affinent le registre sans redemander un genre détaillé comme le faisait la v2 §3.*

### A3. Rapport à la vérité
Choix unique : je veux restituer les faits aussi exactement que possible · je veux être fidèle à mon souvenir, même imparfait · je cherche une vérité intérieure plus qu'une exactitude factuelle · je transforme volontairement le réel pour mieux en exprimer quelque chose · je mélange réalité et fiction · mon texte est entièrement fictionnel · je construis une démonstration où chaque affirmation factuelle doit pouvoir être étayée.

*Détermine le régime de véridicité du texte — sans cette réponse, CursEdit et CursAudit ne peuvent pas savoir si une incohérence factuelle est une erreur ou un choix assumé.*

### A4. Place de l'expérience personnelle
Curseur entre « je veux disparaître complètement derrière mon texte » et « mon expérience personnelle constitue la matière même de mon écriture », avec repères intermédiaires : illustration · témoignage · point de départ · matériau d'analyse · fil narratif · objet principal.

*Combinée à A3, situe précisément le texte entre autobiographie, autofiction, essai personnel, témoignage et fiction — sans imposer une étiquette figée dès le départ.*

### A5. Ton
Cases à cocher (sélection multiple) : intime · pédagogique · philosophique · scientifique · poétique · humoristique · militant · analytique · spirituel · journalistique · autre.

*Reprise à l'identique de la v2 §4 — reste incontournable, pilote directement le style du copilote.*

### A6. Le pacte entre l'auteur et l'IA
Cases à cocher (sélection multiple) : corrige mes fautes, mais jamais mon style · challenge mes idées si elles sont incohérentes · n'édulcore jamais mes émotions · aide-moi à rester fidèle à mon intention initiale · rappelle-moi mes objectifs lorsque je m'en éloigne · autorise les digressions créatives · ne coupe jamais un passage uniquement parce qu'il paraît atypique · demande-moi avant toute suppression importante · privilégie les questions aux affirmations.

*Reprise à l'identique de la v2 §11 — section différenciante, contrat de collaboration qui guide le copilote tout au long de l'écriture.*

### A7. Limites
Deux volets rapides, cases à cocher :
- **Limites personnelles** : y a-t-il des sujets que vous refusez d'aborder / que vous n'êtes pas encore prêt à raconter / que vous souhaitez raconter mais autrement / que vous réserverez pour un autre livre ?
- **Limites juridiques** : diffamation · vie privée · secret professionnel · secret médical · copyright · citations · photographies · courriers · messages privés.

*Fusion de la v2 §6 et §7 — nécessaire dès la première session pour protéger l'auteur et éviter que le copilote ne suggère quelque chose qui franchit une de ces limites.*

---

## Partie B — Approfondissement (optionnel, à son rythme)

Aucune de ces sections n'est requise pour commencer à écrire. Chacune peut être remplie indépendamment, à tout moment, depuis les paramètres du projet.

### B1. Type d'écriture spontané
Vers quoi allez-vous naturellement, pas ce que vous savez déjà écrire — plusieurs choix possibles, avec les figures de repère associées : précise et exigeante (Flaubert) · intime et dépouillée (Duras / Juliet) · autobiographique tournée vers le collectif (Ernaux) · mémoire transformée en compréhension (Bergounioux) · engagée (Sartre / Aragon) · expérimentale, à contraintes (Perec / Apollinaire) · qui interroge le langage (Barthes / Saussure) · libre et dialogique, pensée qui se construit en écrivant (Diderot) · attentive à l'architecture et à la règle (Boileau) · qui revendique l'indépendance de l'auteure ou de l'auteur (Woolf) · centrée sur le plaisir de raconter et la relation au lecteur (Pennac) · je ne sais pas encore.

### B2. Priorités en écriture
Classement (des plus importantes aux moins importantes) : ce que j'ai à dire · la manière de le dire · ce que ressentira le lecteur · la vérité de ce que je raconte · la beauté de la langue · la solidité de mon raisonnement · l'originalité · la transmission · le plaisir d'écrire · la trace que je laisserai.

### B3. Point de départ habituel
D'une idée · d'une question · d'une image · d'une émotion · d'un souvenir · d'une scène · d'un personnage · d'une expérience vécue · d'une injustice à changer · d'un savoir à transmettre · d'une phrase qui vient · je commence sans savoir où cela va me conduire.

### B4. Degré de clarté avant écriture
Échelle 1 à 5, de « je le découvre presque entièrement en écrivant » à « je sais précisément ce que je veux démontrer ou raconter ».

*Pilote la rigidité du plan proposé par CursEdit : à 1, pas de plan imposé trop tôt ; à 5, le plan devient un outil pour tester la cohérence de l'intention.*

### B5. Relation recherchée au lecteur
Le raconter · le faire comprendre · le faire ressentir · le faire réfléchir · le convaincre · le déranger · le faire rire · qu'il se reconnaisse · lui apprendre quelque chose · lui donner envie d'agir · lui laisser sa propre interprétation · je n'écris pas d'abord pour un lecteur.

Puis, en réponse libre : *« À la fin de votre texte, qu'aimeriez-vous que le lecteur puisse dire ? »*

### B6. Place de la forme
Curseur entre « le langage doit avant tout servir le contenu » et « le travail de la langue fait lui-même partie de l'œuvre », puis dimensions à cocher : rythme · musicalité · images · sobriété · précision · oralité · poésie · expérimentation · humour.

### B7. Anti-valeurs stylistiques à éviter
Être ennuyeux · compliqué · superficiel · sentimental · froid · académique · didactique · prétentieux · banal · trop expliquer · pas assez expliquer · ressembler à quelqu'un d'autre · perdre sa propre voix.

### B8. Auteurs qui donnent envie d'écrire
Champ libre, puis : *« Qu'est-ce qui vous attire chez eux ? »*

### B9. Fils conducteurs
Liste libre de thèmes à suivre tout au long du livre (ex. violence, reconstruction, enfance, résilience, pardon, justice, spiritualité, transmission, amour, culpabilité). *Reprise de la v2 §9.*

### B10. Digressions
Les détours font-ils partie de la manière naturelle de raconter ? Et lorsque le texte semble s'éloigner du sujet, que doit faire l'IA : ne rien dire / signaler le détour / vérifier qu'il sert le propos / proposer un autre emplacement / proposer une fiche reliée ? *Reprise de la v2 §10. Tant que cette section n'est pas remplie, CursEdit applique le comportement par défaut : ne jamais dire « hors sujet », toujours proposer « ce passage ouvre un nouveau thème — le garder ici, le déplacer, ou en faire une fiche reliée ? ».*

### B11. Personnes
Table dynamique, répétable pour chaque personne importante : nom réel ? pseudonyme ? fusion de plusieurs personnes ? autorisation obtenue ? risque juridique ? anonymat souhaité ? *Reprise de la v2 §5 — à ne proposer que si A1/A3/A4 indiquent un texte impliquant des tiers réels (témoignage, mémoire, autobiographie).*

---

## Notes techniques pour l'implémentation future

- **Deux flux distincts, un même formulaire** : Partie A bloque l'accès aux paramètres de style de CursEdit tant qu'elle n'est pas remplie (elle est courte — sept choix rapides, aucun champ texte). Partie B reste accessible en tout temps depuis les paramètres du projet, remplissable section par section, jamais en bloc.
- **A2 (catégorie) vs A3/A4 (vérité, expérience)** : ne pas fusionner ces questions. A2 est un tag court utilisé pour les gabarits d'outils et le référentiel de comparaison de CursAudit ; A3/A4 servent à calibrer le registre d'interprétation du texte (fiction assumée vs récit factuel). Les deux informations sont nécessaires et non redondantes : deux romans « inspirés de faits réels » (A2 identique) peuvent avoir des réponses opposées en A3/A4.
- **A6 et B10 sont celles qui doivent réellement modifier le comportement du co-pilote IA** (`CopiloteIA.jsx`) — le prompt système envoyé à Claude doit intégrer ces préférences à chaque appel, comme déjà noté en v2.
- **B1, B8 (affinités littéraires)** : à afficher comme suggestions, jamais comme verdict (« affinité Ernaux » et non « vous écrivez comme Ernaux »). Le calcul ne doit pas être un mapping 1-1 checkbox → auteur, mais une combinaison pondérée sur A1 + A3 + A4 + B1 + B2 + B6, pour éviter l'effet test de personnalité. À spécifier en détail lors du développement (table de correspondance à construire, pas encore définie ici).
- **Le composant `QuestionnaireIntention.jsx` existant** sert de squelette technique de départ (gestion d'état, validation, appel Supabase), mais son contenu doit être remplacé par la structure A/B ci-dessus plutôt que par la liste plate de la v2.
- **Table Supabase à revoir** : comme en v2, `intention_projet` est insuffisante en l'état (7 colonnes simples). Prévoir une distinction structurelle entre les colonnes de la Partie A (remplissage obligatoire, simple) et celles de la Partie B (remplissage progressif, dont certaines répétables — B9, B11 — ou à structure libre — B5, B8).
- **Principe transversal avec le questionnaire de diagnostic éditorial** : la triade *intention voulue / réalisation effective / conventions du genre déclaré* (voir questionnaire de diagnostic, §4) doit devenir un principe commun à CursEdit et CursAudit. La carte d'intention issue de ce questionnaire (A + B) est ce que CursAudit confrontera plus tard à l'œuvre terminée — cela suppose que A1, A5 et B9 au minimum soient stables dans le temps ou versionnées si l'auteur les modifie en cours de projet.

---

## Système de score — deux notes distinctes

### Note 1 — Complétude du questionnaire d'intention
Calcul simple, côté client, sans appel IA :
- **Partie A (obligatoire)** : comptée à part, en pourcentage de complétion propre — c'est une condition d'accès, pas un score d'enrichissement.
- **Partie B (optionnelle)** : `note = Σ(poids × rempli) / Σ(poids total) × 100`, avec poids moyen pour B4 et B10 (influencent directement le comportement de CursEdit) et poids faible pour le reste (alimentent surtout la carte d'intention et les affinités).

Affichage : barre de progression simple, visible dans les paramètres du projet — pas intrusive, pas dans le co-pilote IA.

### Note 2 — Cohérence du texte avec l'intention déclarée
Calculée par l'IA, intégrée au cycle d'analyse automatique existant (mode Auto, 10 minutes). Compare le texte récemment écrit avec l'intention dominante (A1), le ton déclaré (A5) et les fils conducteurs déclarés (B9, si renseignés).

Le prompt IA doit suivre le principe de B10 : ne jamais dire « hors sujet », toujours formuler en proposition respectueuse de l'arborescence naturelle de l'auteur.

Affichage : dans l'onglet existant du co-pilote (pas de nouvel onglet), sous forme d'indicateur doux, jamais bloquant. Format validé : pourcentage chiffré toujours accompagné d'une appréciation qualitative courte —

- 85-100 % → « Globalement fidèle au cap »
- 60-84 % → « Quelques passages à reconsidérer »
- 35-59 % → « Le texte s'éloigne sensiblement de l'intention déclarée »
- 0-34 % → « Ce chapitre semble explorer un autre territoire — à valider »

Les seuils exacts et le ton des formulations sont à affiner en session de développement, mais le principe (chiffre + texte qualitatif) est acté.

### Principe général de pondération
Les deux notes ne sont jamais punitives — elles informent sans jamais interrompre le flux d'écriture. Cohérent avec la crainte exprimée par Joseph de ne pas vouloir être « sans arrêt interrompu » par une IA qui questionnerait chaque digression.

---

## Vision produit (notes de Joseph)

Le pacte auteur-IA (A6) reste une sorte de contrat de collaboration entre l'auteur et l'IA, qui guide l'assistant tout au long de l'écriture sans l'enfermer dans des règles rigides. La carte d'intention (Partie B) va plus loin : elle ne prétend jamais dire « vous écrivez comme untel », mais peut faire apparaître des affinités partielles et combinées (proche d'Ernaux pour la mémoire, de Perec pour la forme, de Sartre pour l'intention, à la fois) — c'est ce qui distingue Cursus d'un simple éditeur de texte, et ce qui permettra plus tard à CursAudit de mesurer l'écart entre l'œuvre que l'auteur voulait produire et celle qu'il a effectivement produite, avant de la confronter aux conventions de son genre.
