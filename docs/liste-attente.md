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
  18/09/2026** : `Highlight.configure({ multicolor: true })` +
  sélecteur de couleur (5 teintes + retrait) dans la barre d'outils de
  `Editeur.jsx`, appliqué sur la sélection via `setHighlight({ color })` /
  `unsetHighlight()`. Reste en attente : couleur de police (distincte du
  surlignage) si l'auteur la souhaite aussi — non demandée explicitement à
  ce stade.
- ~~Mise en forme paragraphée des réponses du co-pilote...~~ **Fait le
  18/09/2026** : rendu du fil de dialogue (`FilDialogue` dans
  `CopiloteIA.jsx`) passé en `whiteSpace: "pre-wrap"` pour respecter les
  sauts de ligne, et le prompt (`promptDialogue`) instruit désormais Claude
  de structurer une réponse à plusieurs points en paragraphes distincts
  séparés par une ligne vide.

**Pourquoi reporté** : demande explicite de l'auteur du projet de le
mettre en liste d'attente plutôt que de l'implémenter dans la foulée —
repris et terminé le 18/09/2026 à sa demande.
