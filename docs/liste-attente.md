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

**Fait le 24/09/2026** — Joseph a tranché : les trois formats envisagés
sont nécessaires, pas un choix entre eux.
- `docs/mode-emploi.md` — contenu de référence, dans le dépôt.
- `src/components/ModeEmploi.jsx` — même contenu en page applicative,
  accessible via le bouton "Mode d'emploi" (barre supérieure) et un lien
  depuis la FAQ existante (`AideFAQ.jsx`).
- Document séparé pour les testeuses (ex. Annie) — publié en artefact
  autonome, partageable par lien sans connexion à l'application :
  https://claude.ai/artifact/4KLRCZSmqCjSGbLDKT5Wvk (privé par défaut,
  à partager explicitement par Joseph avec qui doit y accéder).

Couvre CursEdit, le Co-pilote IA (y compris la vision des images) et
CursAudit (avec sa limite explicite sur les images) — pas CursDecision,
qui n'a aucune fonctionnalité réelle à documenter pour l'instant.

---

## #4 — Images dans CursEdit, lues par CursAudit

**Ajouté le** 24/09/2026.

**Demande d'origine** : "pouvoir intégrer des schémas ou des photos dans
le texte, dans CursEdit, et pouvoir les lire dans CursAudit [...] certains
livres ont cela [...] parfois les références textuelles se rapportent à
ces photos [...] dans Oracle du Sermon sur la montagne, chaque carte est
associée à une image, et là je n'en ai aucune."

**Ce qui est fait (phase 1, 24/09/2026)** : insertion et affichage
d'images dans CursEdit — `@tiptap/extension-image`, bouton 🖼️ dans la
barre d'outils (`Editeur.jsx`), upload vers le bucket Supabase Storage
`images-manuscrits` (un dossier par auteur, RLS par `user_id` — voir
`2026-09-24-bucket-images-manuscrits.sql`), 8 Mo max par image.

**Ce qui est fait (phase 2 — Co-pilote IA seulement, 24/09/2026)** : les 4
onglets principaux du Co-pilote (Suggestions, Personnages, Références,
Cohérence — pas Vérification, protocole distinct) voient désormais
réellement le CONTENU des images du passage analysé, pas seulement leur
présence. `extraireImages()` repère les `<img>` du HTML analysé (jusqu'à 3
par appel, pour plafonner le coût), et `appelClaude()` les transmet à
Claude en blocs image natifs (`source: {type:"url", url}` — Anthropic va
chercher l'image lui-même, pas de base64 à gérer côté client). Coût réel
mesuré : une image ≈ une unité de texte supplémentaire (~1300 tokens pour
une image de taille courante), pas un multiplicateur de coût comme
d'abord estimé.

**Ce qui est fait (phase 3 — CursAudit, 17/10/2026)** : point 2 de l'audit
de préparation à la commercialisation (CLAUDE.md). Le diagnostic initial
de cette phase 3 ("le serveur ne lit pas encore les images") s'est révélé
incomplet une fois le code relu : CursAudit a son PROPRE pipeline
d'upload, séparé de CursEdit/noeuds (un .docx téléversé spécifiquement
pour l'audit) — aucune image n'y était jamais extraite, ni côté client ni
côté serveur, même pour un .docx qui en contient. Corrigé de bout en
bout :
- `src/lib/segmenterCursAudit.js` : reprend EXACTEMENT la lecture OOXML
  déjà éprouvée dans `ImportDocx.jsx` (relations `word/_rels/document.xml.rels`,
  upload vers `images-manuscrits`) — déplacée ici plutôt que dupliquée ;
  `ImportDocx.jsx` l'importe désormais d'ici. `analyserStructureDocx`
  associe à chaque paragraphe ses images ; `regrouperParNiveaux` les
  reporte vers la bonne unité (même principe que les titres non retenus
  comme frontière : reportés vers le prochain contenu réel, jamais
  perdus) et n'ignore plus un paragraphe qui ne contient qu'une image
  sans texte (le cas même d'"Oracle du Sermon sur la montagne").
- `audit_sections.images` (nouvelle colonne jsonb, migration
  `2026-10-17-audit-sections-images.sql` — **à exécuter par Joseph**) :
  URLs publiques, tableau parallèle à `texte_source`.
- `orchestrer-audit-cursaudit` (le pipeline réellement exécuté par
  "Lancer/Continuer l'analyse") et `analyser-unite-cursaudit` (même
  correctif par cohérence, voir son propre statut dans CLAUDE.md) :
  l'unité analysée transmet ses images (plafonnées à 3, même limite que
  CopiloteIA) à Claude ET à GPT (`gpt-4o` est vision-capable sur Chat
  Completions) en blocs image natifs — jamais celles des unités voisines.
- NON TESTÉ EN CONDITIONS RÉELLES (migration pas encore exécutée au
  moment du correctif) : la chaîne complète (import .docx avec images →
  audit créé → analyse) sur un vrai fichier contenant des images.

**Pourquoi la phase 2 a été reportée puis reprise le jour même** :
d'abord estimée trop coûteuse en tokens, l'estimation a été corrigée
après vérification des ordres de grandeur réels — le coût d'une image est
comparable à une unité de texte déjà analysée, pas un poste à part.

---

## #5 — Éléments graphiques dans CursDecision

**Ajouté le** 24/09/2026.

**Demande d'origine** : envisager des éléments graphiques (tableaux
comparatifs, matrices de risques) pour présenter les résultats de
CursDecision autrement qu'en texte.

**Pourquoi reporté** : CursDecision n'a aujourd'hui aucune fonctionnalité
réelle (page marketing seule, zéro backend) — ajouter des graphiques
suppose d'abord de construire CursDecision depuis zéro, un chantier en
soi. Discuté mais pas priorisé pour l'instant.

---

## #6 — Manuel complet de Cursus, fonction par fonction (suite du #3)

**Ajouté le** 31/10/2026.

**Demande d'origine** (Joseph) : « n'y a-t-il pas d'autres éléments pouvant être repris dans ce manuel descriptif reprenant une à une chacune des fonctions ? Nous avons fait des milliers d'opérations diverses et je doute qu'on parvienne à restituer l'utilité de Cursus sans un manuel (exemple : rien que pour Word il existe un manuel extrêmement complet avec le descriptif). »

**Pourquoi c'est une suite du #3 et non un doublon** : le #3 a produit, le 24/09/2026, un mode d'emploi de synthèse (174 lignes). Depuis, des dizaines de fonctions ont été ajoutées, et plusieurs domaines n'ont jamais été décrits : Bibliothèque, Carnet d'idées, Tableau de bord, Profil auteur, Questionnaire d'intention, Incorporer de la matière, détail de l'import Word, Tarification et codes promo, CursAudit en profondeur (pré-audit gratuit / approfondi / détaillé, 1 IA / 2 IA, question centrale, fiche d'action, images, exports Word), chaque onglet du Co-pilote, les notions de fiabilité (« confirmé » = une source existe, l'IA signale sans trancher), quotas et crédits, et les règles de chaque jeu.

**Démarche proposée** : (1) sommaire détaillé par domaine, à valider par Joseph ; (2) une fiche par fonction, toujours aux mêmes rubriques (à quoi ça sert · où le trouver · pas à pas · ce que ça ne fait pas · en cas de problème) ; (3) rédaction d'après le code et le journal du projet, avec « à confirmer » pour ce qui n'a pas été testé en conditions réelles ; (4) relecture par Joseph domaine par domaine ; (5) publication dans `ModeEmploi.jsx` (sommaire + recherche) et en version Word téléchargeable.

**Matière première** : `docs/a-integrer-au-mode-emploi.md` (file d'attente alimentée à chaque nouveauté, règle permanente du 31/10/2026) + les sections de `CLAUDE.md`. Cette entrée ne se vide qu'à la publication du manuel complet.

**Lien avec le #7** : chaque fonction du ruban codée au #7 reçoit sa fiche dans ce manuel.

---

## #7 — Compléter les fonctions des onglets du ruban de CursEdit

**Ajouté le** 31/10/2026.

**Demande d'origine** (Joseph) : « il nous faut compléter les fonctions apparaissant dans CursEdit dans les onglets que tu viens d'implémenter » (ruban Accueil · Insertion · Mise en page · Références · Révision · Affichage · Aide, créé le 28/10/2026).

**État** : sur les 29 fonctions encore annoncées « bientôt » dans `src/lib/rubanCatalogue.js`, seule Rechercher / remplacer (et son volet Titres / Pages / Résultats) est faite. Le catalogue est la liste de référence ; pour coder une fonction : passer son `statut` à « fait » ET ajouter son entrée dans `actionsRuban` (`Editeur.jsx`).

**Ordre de réalisation** (fort d'abord, tel que `aVenirParOrdre()` le donne) :
- *Fort* : 1 Saut de page · 2 En-têtes et numéros de page · 3 Citation de la Bibliothèque · 4 Bibliographie · 5 Statistiques · 6 Commentaires · 7 Suivi des modifications (le plus gros) · 8 Comparer deux versions · 9 Volet de navigation · 10 Zoom · 11 Nouveautés · 12 Envoyer un retour.
- *Moyen* : 13 Page de garde · 14 Tableau · 15 Lien · 16 Importer de Zotero · 17 Légende d'image · 18 Index · 19 Synonymes · 20 Traduire · 21 Plan · 22 Deux chapitres côte à côte · 23 Formation · 24 Application mobile.
- *Faible* : 25 Symbole · 26 Colonnes · 27 Renvoi · 28 Mode lecture · 29 Quadrillage.

**Règle de travail** : une fonction à la fois, vérifiée avant la suivante ; chaque fonction terminée ajoute une entrée dans `docs/a-integrer-au-mode-emploi.md` (règle permanente) et déplace sa ligne ici sous « Faites ».

**Faites** : Rechercher / remplacer (28/10/2026, titres et notes 30/10, volets 30/10).
