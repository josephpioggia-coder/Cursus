# Cursus — Liste d'attente (chantiers reportés)

Registre simple, numéroté, des demandes explicitement mises de côté pour plus
tard plutôt que traitées immédiatement — pour ne pas les perdre sans pour
autant les construire à la va-vite. Chaque entrée garde la date où elle a
été ajoutée et, si possible, la citation de la demande d'origine.

---

## #1 — Pipeline d'anonymisation/agrégation pour l'analyse statistique

**Ajouté le** 16/09/2026.

**Demande d'origine** : garder les échanges co-pilote/auteur et des
statistiques sur les utilisateurs (âge, genre, localité, type de produit —
roman, essai, poème...) pour améliorer la gestion des services Cursus.

**Ce qui est déjà fait** : la politique de confidentialité mentionne cet
usage (voir `src/components/PagesLegales.jsx`, section "Pourquoi nous les
traitons").

**Ce qui reste à construire** :
- Un vrai mécanisme d'agrégation (comptages/statistiques globales — âge,
  genre, localité, type de produit — jamais ligne par ligne par
  utilisateur).
- Une vraie anonymisation du contenu brut des échanges/manuscrits pour un
  usage d'amélioration produit — pas juste retirer `user_id`, il faut
  traiter le contenu lui-même (noms propres, lieux précis, détails
  biographiques) qui peut à lui seul ré-identifier quelqu'un.

**Pourquoi reporté** : nécessite de choisir une vraie méthode
d'anonymisation avant de construire quoi que ce soit — pas improvisable en
une session, contrairement au reste des correctifs de ce jour-là.

---

## #2 — Couleur dans l'éditeur + mise en forme des réponses du co-pilote

**Ajouté le** 16/09/2026.

**Demande d'origine** ("une demande que j'ai introduite il y a longtemps") :
- Pouvoir introduire de la couleur dans le texte, côté éditeur
  (`Editeur.jsx`) — pas seulement dans les cartes d'analyse.
- Séparer visuellement, dans les colonnes du co-pilote, les réponses IA des
  questions de l'auteur·ice par la couleur.
- Structurer le texte des réponses du co-pilote — éviter un seul bloc sans
  paragraphes (lecture lourde) ; revenir à la ligne pour chaque point
  distinct plutôt qu'un pavé continu.

**Ce qui est déjà fait** (13-14/09/2026) : les messages "Co-pilote" dans le
fil de dialogue ont déjà un fond bleu distinct des messages "Vous" (voir
`FilDialogue` dans `CopiloteIA.jsx`) — couvre la partie "séparer par la
couleur les réponses IA des questions écrivain".

**Ce qui reste à construire** :
- ~~Un vrai outil de couleur dans l'éditeur de texte principal...~~ **Fait le
  18/09/2026** : `Highlight.configure({ multicolor: true })` (surlignage) +
  `Color`/`TextStyle` (couleur de police) dans `Editeur.jsx`, deux
  sélecteurs distincts dans la barre d'outils (icône "A" soulignée d'une
  barre colorée pour le texte, crayon 🖍️ pour le surlignage), chacun avec
  5 teintes + un retrait, popovers qui se ferment au clic extérieur.
  Couleur de police ajoutée après coup le même jour, sur demande explicite
  ("j'aurais voulu avoir une palette de couleur pour le texte").
- **Bonus non prévu, ajouté le 18/09/2026** : un surlignage gris dédié
  ("Surligneur pour analyses", bouton loupe 🔍 séparé de la palette des 5
  couleurs dans `Editeur.jsx`) sert de convention pour trier un texte long
  avant analyse — "🔍 Surligné" apparaît dans le co-pilote dès qu'au moins
  un fragment est marqué (voir `extraireTexteMarquéAnalyse` dans
  `CopiloteIA.jsx`), plutôt que de devoir sélectionner à la souris à
  chaque fois. D'abord fait avec le vert de la palette générale ; changé
  pour un bouton gris à part le jour même, sur demande explicite de
  Joseph ("pour éviter une erreur") — le vert restait aussi choisissable
  pour une raison purement décorative, avec le risque réel de faire
  analyser par erreur un passage juste mis en valeur.
- ~~Mise en forme paragraphée des réponses du co-pilote...~~ **Fait le
  18/09/2026** : rendu du fil de dialogue (`FilDialogue` dans
  `CopiloteIA.jsx`) passé en `whiteSpace: "pre-wrap"` pour respecter les
  sauts de ligne, et le prompt (`promptDialogue`) instruit désormais Claude
  de structurer une réponse à plusieurs points en paragraphes distincts
  séparés par une ligne vide.

**Pourquoi reporté** : demande explicite de l'auteur du projet de le
mettre en liste d'attente plutôt que de l'implémenter dans la foulée —
repris et terminé le 18/09/2026 à sa demande.

---

## #3 — Mode d'emploi complet, à l'usage de l'écrivain·e

**Ajouté le** 18/09/2026.

**Demande d'origine** : "il faudra un mode d'emploi pour toutes les
fonctionnalités et codes internes à l'usage de l'écrivain" — dit en même
temps que la demande #2 (couleur de texte), à propos d'une couleur ayant
un sens fonctionnel caché (à l'origine le vert, devenu un bouton gris
dédié le jour même — voir plus haut) : ce genre de convention n'est
utilisable sans confusion que si elle est documentée quelque part pour
l'auteur·ice qui écrit, pas seulement dans le code.

**Ce qui existe déjà, à réunir/reformuler pour un public non technique** :
- Éditeur (`Editeur.jsx`) : mise en forme, surlignage/couleur de texte, le
  "Surligneur pour analyses" dédié, mode focus, dictée vocale,
  historique de versions, objectifs de session.
- Co-pilote IA (`CopiloteIA.jsx`) : les 5 onglets (Suggestions,
  Personnages, Références, Cohérence, Vérification), le mode Auto,
  "Aide-moi à avancer", "Conseils de recomposition", la mémoire narrative,
  le choix de la source à analyser (sélection / chapitre entier / surligné pour analyse).
- Abonnement : quotas de tokens par palier, ce qui se passe en cas
  d'annulation (lecture seule 3 mois, voir CGV art. 6).

**Pourquoi reporté** : périmètre large ("toutes les fonctionnalités"), et
une question de forme reste à trancher avant de l'écrire — document
Markdown dans le dépôt, page d'aide dans l'application, ou document à part
pour les premières testeuses (ex. Annie) — plutôt que de deviner et
produire quelque chose qu'il faudra refaire.
