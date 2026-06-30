# Cursus — Questionnaire d'intention v2 (spécification complète)

*Document de référence pour l'implémentation future. Conçu par Joseph le 30/06/2026.*

---

## 1. L'intention profonde
- Pourquoi écrivez-vous ce livre ?
- Qu'est-ce qui vous pousse à l'écrire aujourd'hui ?
- Si vous ne pouviez transmettre qu'une seule idée, laquelle serait-elle ?
- Pourquoi êtes-vous la bonne personne pour raconter cette histoire ?

## 2. Le lecteur
- À qui s'adresse ce livre ?
- Qui ne devrait probablement pas le lire ?
- Que souhaitez-vous que le lecteur ressente ?
- Que souhaitez-vous qu'il comprenne ?
- Que souhaitez-vous qu'il fasse après la lecture ?

## 3. Le récit
- S'agit-il d'une autobiographie ? D'un témoignage ? D'un essai ? D'un récit initiatique ? D'un livre de développement personnel ? D'un manifeste ? D'un roman inspiré de faits réels ? D'un mélange de plusieurs genres ?

## 4. Le ton
Cases à cocher (sélection unique ou multiple à trancher) :
intime · pédagogique · philosophique · scientifique · poétique · humoristique · militant · analytique · spirituel · journalistique · autre

## 5. Les personnes
**Table dynamique, répétable pour chaque personne importante** :
- Nom réel ?
- Pseudonyme ?
- Fusion de plusieurs personnes ?
- Autorisation obtenue ?
- Risque juridique ?
- Souhaite-t-on préserver son anonymat ?

## 6. Les limites personnelles
Y a-t-il des sujets :
- que vous refusez d'aborder ?
- que vous n'êtes pas encore prêt à raconter ?
- que vous souhaitez raconter mais autrement ?
- que vous réserverez pour un autre livre ?

## 7. Les limites juridiques
Cases à cocher : diffamation · vie privée · secret professionnel · secret médical · copyright · citations · photographies · courriers · messages privés

## 8. Les émotions
Cases à cocher : catharsis · réparation · hommage · transmission · acte militant · enquête · réflexion · avertissement · quête de sens · autre

## 9. Les fils conducteurs
Liste libre de thèmes à suivre tout au long du livre.
Exemples : violence, reconstruction, enfance, résilience, pardon, justice, spiritualité, transmission, amour, culpabilité

## 10. Les digressions — section originale
Question 1 : Les détours font-ils partie de votre manière naturelle de raconter ?
- oui, ils sont essentiels
- oui, mais ils doivent revenir vers le sujet principal
- non, je préfère un récit linéaire

Question 2 : Lorsque vous semblez vous éloigner du sujet, que souhaitez-vous que l'IA fasse ?
- ne rien dire
- simplement me signaler qu'il s'agit d'un détour
- vérifier avec moi que ce détour sert bien le propos
- proposer un meilleur emplacement dans le livre
- proposer de créer une nouvelle fiche reliée

**Principe clé** : l'IA ne doit JAMAIS dire « Ce passage est hors sujet. »
Elle doit dire : « Ce passage ouvre un nouveau thème. Souhaitez-vous le conserver ici, le déplacer plus loin ou en faire une nouvelle fiche reliée ? »

## 11. Le pacte entre l'auteur et l'IA — section différenciante
L'auteur définit le rôle qu'il attend de l'IA, parmi des préférences modulaires (cases à cocher, plusieurs sélectionnables) :
- Corrige mes fautes, mais jamais mon style.
- Challenge mes idées si elles sont incohérentes.
- N'édulcore jamais mes émotions.
- Aide-moi à rester fidèle à mon intention initiale.
- Rappelle-moi mes objectifs lorsque je m'en éloigne.
- Autorise les digressions créatives.
- Ne coupe jamais un passage uniquement parce qu'il paraît atypique.
- Demande-moi avant toute suppression importante.
- Privilégie les questions aux affirmations.

---

## Vision produit (notes de Joseph)
Cette dernière page (section 11) devient une sorte de contrat de collaboration entre l'auteur et l'IA. Elle guide l'assistant tout au long de l'écriture, sans l'enfermer dans des règles rigides. C'est ce qui distingue Cursus d'un simple éditeur de texte : il ne fournit pas seulement des outils, il préserve la cohérence profonde du projet tout en respectant la manière singulière dont chaque auteur pense et raconte.

---

## Notes techniques pour l'implémentation future

- **Table Supabase à revoir** : la table `intention_projet` actuelle (créée le 30/06/2026, 7 colonnes simples) est insuffisante. Il faudra soit l'étendre avec des colonnes JSON pour les structures répétables (section 5, personnes ; sections 4/7/8, cases multiples), soit créer des tables liées séparées (ex. `intention_personnes` en 1-N avec `intention_projet`).
- **Section 5 (personnes)** demande une vraie interface de table dynamique (ajouter/retirer des lignes), pas un simple champ texte.
- **Section 10 et 11** sont celles qui doivent réellement modifier le comportement du co-pilote IA (`CopiloteIA.jsx`) — le prompt système envoyé à Claude doit intégrer ces préférences à chaque appel.
- **Le composant `QuestionnaireIntention.jsx` existant (version simple, 7 questions)** peut servir de squelette technique de départ (gestion d'état, validation, appel Supabase) mais son contenu doit être entièrement remplacé.

---

## Système de score — deux notes distinctes (ajout du 30/06/2026)

### Note 1 — Complétude du questionnaire d'intention
Calcul simple, côté client, sans appel IA. Chaque question a un poids :
- **Poids fort (incontournable)** : pourquoi écrivez-vous ce livre (§1), pacte auteur-IA (§11), type de récit (§3), ton (§4)
- **Poids moyen** : lecteur visé (§2), limites personnelles (§6), limites juridiques (§7)
- **Poids faible (optionnel, enrichissement)** : personnes détaillées (§5), fils conducteurs (§9), digressions (§10)

Formule : `note = Σ(poids × rempli) / Σ(poids total) × 100`

Affichage : barre de progression simple, visible dans les paramètres du projet — pas intrusive, pas dans le co-pilote IA.

### Note 2 — Cohérence du texte avec l'intention déclarée
Calculée par l'IA, intégrée au cycle d'analyse automatique existant (mode Auto, 10 minutes). Compare le texte récemment écrit avec :
- L'intention profonde (§1)
- Les fils conducteurs déclarés (§9)
- Le ton déclaré (§4)

Le prompt IA doit suivre le principe de la section 10 : ne jamais dire « hors sujet », toujours formuler en proposition respectueuse de l'arborescence naturelle de l'auteur (ex. « Ce passage ouvre un nouveau thème — le garder ici, le déplacer, ou créer une fiche reliée ? »).

Affichage : dans l'onglet existant du co-pilote (pas de nouvel onglet, décision déjà actée), sous forme d'indicateur doux, jamais bloquant.

**Format d'affichage validé (30/06/2026)** : pourcentage chiffré (ex. « 78 % fidèle au cap ») toujours accompagné d'une appréciation qualitative courte qui contextualise le chiffre — le pourcentage seul donnerait une fausse précision sur quelque chose d'intrinsèquement subjectif (la cohérence narrative). Exemple de formulation :
- 85-100 % → « Globalement fidèle au cap »
- 60-84 % → « Quelques passages à reconsidérer »
- 35-59 % → « Le texte s'éloigne sensiblement de l'intention déclarée »
- 0-34 % → « Ce chapitre semble explorer un autre territoire — à valider »

Les seuils exacts et le ton des formulations sont à affiner en session de développement, mais le principe (chiffre + texte qualitatif) est acté.

### Principe général de pondération
Les deux notes ne sont jamais punitives — elles informent sans jamais interrompre le flux d'écriture. Cohérent avec la crainte exprimée par Joseph de ne pas vouloir être « sans arrêt interrompu » par une IA qui questionnerait chaque digression.
