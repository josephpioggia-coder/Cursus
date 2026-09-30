# Cursus — notes pour Claude Code

## Æncre — mascotte de Cursus

"Æncre" (jeu de mots avec "encre") est la mascotte de Cursus : une plume
anthropomorphe au visage souriant, trempée dans un encrier, tirée d'une
illustration fournie par Joseph le 24/09/2026. Nommée par Joseph.

Assets conservés dans le dépôt (public/, donc servis tels quels et
disponibles pour toute réutilisation future) :

- `public/aencre-icone.png` — portrait carré (200×200) recadré sur le
  visage, utilisé en avatar rond. Usage actuel : bouton "mode d'emploi"
  de la page de connexion (`src/lib/auth.jsx`).
- `public/aencre-complet.jpg` — plan plus large (620×960), plume entière
  + encrier + livre "Cursus" en arrière-plan. Pas encore utilisé
  ailleurs — disponible pour une prochaine intégration (page d'accueil,
  mode d'emploi, écran de bienvenue, etc.) sans redemander l'image à
  Joseph.
- `public/aencre-complet-detoure.png` — même cadrage que
  `aencre-complet.jpg` (plume entière + encrier), mais détourée : livre
  et arrière-plan supprimés, fond transparent (PNG, ~620×870). Généré le
  24/09/2026 par découpe automatique (rembg/isnet). Sert de source aux
  deux découpes ci-dessous — pas utilisée telle quelle ailleurs.
- `public/aencre-plume-detouree.png` et `public/aencre-encrier-detoure.png`
  — `aencre-complet-detoure.png` séparée en deux (24/09/2026, découpe au
  niveau du "cou" le plus fin du filet d'encre qui relie plume et
  encrier) pour pouvoir les animer indépendamment. Usage actuel :
  `AencreGuide.jsx`, dans la marge droite du Mode d'emploi
  (`ModeEmploi.jsx`) — l'encrier est un élément de page NORMAL
  (`position: absolute`, pas `fixed`), posé près du titre : il défile
  AVEC le contenu et disparaît par le haut en lisant, comme le titre
  lui-même. La plume, elle, reste "fixed" à l'écran : posée près de
  l'encrier au repos, elle s'en détache dès qu'on scrolle et
  descend/remonte avec la progression de lecture (voir aussi le
  commentaire d'en-tête d'`AencreGuide.jsx` pour le piège `conteneurRef`
  — le scroll écouté doit être celui du propre conteneur de la page, pas
  celui de la fenêtre, sans quoi le positionnement de la plume comme de
  l'encrier casse selon l'endroit d'où le Mode d'emploi est ouvert).

Deux logiques d'animation distinctes selon que la page tient dans
l'écran ou non — à garder pour toute future intégration :
- Page qui tient dans l'écran (ex. connexion, `auth.jsx`) : inutile de
  faire voyager la plume, juste un léger mouvement sur place ("comme
  soulevée par un souffle d'air") — `@keyframes aencre-flotte`.
- Page plus longue que l'écran (ex. Mode d'emploi) : l'encrier défile
  normalement avec le contenu, la plume seule reste à l'écran et suit la
  progression du scroll — `AencreGuide.jsx`.

Avant de demander une nouvelle version, un nouveau recadrage ou un
nouveau détourage de cette image, vérifier si l'un des fichiers
ci-dessus convient déjà.

## Cartes flottantes — colonne gauche de la page de connexion

`public/cartes/*.webp` (LES 28 fichiers de la planche, ~370 Ko au
total) — recadrages individuels d'une planche de référence fournie par
Joseph le 24/09/2026 (illustration IA : couvertures de livres peintes,
rapports CursDecision, cartes oracle, livres ouverts, carte/photo de
paysage). Utilisés par `CartesFlottantes.jsx` (colonne gauche de la page
de connexion, `src/lib/auth.jsx` → `PlumeAnimee.jsx`).

Demandes explicites ayant façonné ce fichier, dans l'ordre :
1. Les versions précédentes redessinaient le CONTENU en SVG (icône au
   trait + texte) plutôt que de réutiliser la planche fournie — jugé
   "amateur, pas professionnel de l'édition". Ne pas revenir à des
   couvertures dessinées en SVG.
2. Premier recadrage : bug d'aplatissement RGBA→RGB sans composer sur
   fond blanc au préalable (`.convert('RGB')` direct sur une image avec
   transparence partielle) → bruit noir pixelisé visible derrière
   chaque carte une fois compressé en WebP. Toujours composer sur fond
   blanc (`Image.new('RGB', ..., (255,255,255))` + `paste(..., mask=alpha)`)
   avant tout recadrage depuis une planche source RGBA.
3. Le premier recadrage n'avait gardé que 21 des 28 éléments de la
   planche (écartés comme "hors-sujet" : le livre "Cursus", les 4
   livres ouverts, la carte géo et la photo de côte) — retour explicite
   de Joseph : garder LES 28, ne pas réduire la variété. Les livres
   ouverts et la carte/photo (format paysage, plus larges que hauts)
   ont un `poids` (largeur relative) plus élevé dans `CARTES` pour
   garder une emprise visuelle cohérente avec les cartes portrait.
4. Ces 28 étaient de simples recadrages RECTANGULAIRES (fond blanc
   visible autour de chaque livre en biais) — jugé "pas digne d'un
   professionnel". Chaque fichier est maintenant vraiment DÉTOURÉ (fond
   transparent, pas de rectangle blanc). `rembg` (déjà utilisé pour
   Æncre) donne de mauvais résultats ici — modèle de segmentation
   d'objets naturels, pas adapté à un aplat blanc de studio : plusieurs
   cartes ressortaient en brume grise translucide. Le détourage utilisé
   à la place, plus fiable pour ce type de source (recadrages nets sur
   fond blanc uni) : seuillage par distance à blanc (alpha = 0 en
   dessous de ~234/255, rampe jusqu'à 252/255) + ne garder que la plus
   grande composante connexe du masque (élimine les bouts de livre
   voisin qui traînaient dans les coins du rectangle, quand deux livres
   se touchent sur la planche) + flou léger sur le seul canal alpha
   pour adoucir le bord.
5. Ce détourage plus serré avait recoupé DANS le contenu de plusieurs
   éléments (titre tronqué : "Curs" au lieu de "Cursus", "Les chemi..."
   au lieu de "Les chemins de l'invisible", "Analyse comparative" coupé
   en haut, etc.) — demande explicite : des images COMPLÈTES, pas des
   bouts d'image, quitte à laisser un peu de bavure de voisinage plutôt
   que de couper dans le sujet. Chacun des 28 cadrages a été revérifié
   un par un (élément par élément, pas seulement en planche de contact)
   et élargi côté contenu manquant / resserré côté bavure de voisin —
   PAS de reconstruction générative (inpainting) : la planche source
   contenait déjà tout le contenu manquant juste à côté du cadrage
   précédent, il n'y avait donc rien à "recomposer", seulement à
   recadrer correctement.

La planche source elle-même n'est PAS conservée dans le dépôt (seuls les
28 recadrages qui en sont tirés le sont) — la redemander à Joseph avant
tout nouveau recadrage ou ajustement des cadrages existants.

## Solveur Scrabble (29/09/2026)

Demande de Joseph (il joue au Scrabble sur mobile avec Claude) : un
solveur "en situation", à partir d'une capture d'écran de la partie.
Entrée de menu "Jeu de mots (Scrabble)" → `src/components/ScrabbleSolveur.jsx`.

- `src/lib/scrabbleSolveur.js` : moteur PUR (trie en tableaux typés,
  Appel & Jacobson, score avec primes + bonus 50). Vérifié le 29/09/2026
  contre une génération brute-force indépendante (mêmes coups, mêmes
  scores, sur 3 positions dont une avec joker) : ne pas le "simplifier"
  sans refaire ce test. Aucun appel IA, gratuit.
- Lecture de la capture : seul poste qui consomme des tokens, via
  `claude-prox` avec un bloc image base64 (le proxy transmet le corps tel
  quel, aucun changement serveur). Une capture zoomée n'affiche qu'une
  PARTIE du 15×15 : l'IA renvoie la zone visible (lettres + codes de
  prime des cases vides) et `aligner()` la recale sur le plateau standard
  en comparant les primes. Grille toujours modifiable à la main.
- Dictionnaire : `public/scrabble/mots-fr.txt` (~411 000 mots) +
  `accents.txt` (formes accentuées, pour retrouver la page Wiktionnaire).
  Source depuis le 29/09/2026 : Dicollecte / Grammalecte v7.5
  (npm `dictionary-fr`, licence MPL 2.0 — texte dans
  `public/scrabble/LICENCE-DICOLLECTE.txt`, à conserver). Régénération :
  `scripts/generer-dico-scrabble.sh` (unmunch développe les affixes mais
  sur-génère → chaque forme est revalidée par `hunspell -l`, puis les
  racines-abréviations `||` sont écartées, puis
  `preparer-dico-scrabble.mjs` normalise et applique une petite liste
  d'abréviations interdites de 2 à 4 lettres, revue à la main). PAS
  l'ODS officiel : des abréviations plus longues peuvent subsister et
  des mots récents du Scrabble peuvent manquer. Morphalou et Lexique 3
  (préférés au départ) sont inaccessibles depuis l'environnement de
  dev (hôtes bloqués) : à retenter si un accès s'ouvre. L'ancienne
  source (lorenbrichter/Words, licence non précisée) est abandonnée.
  Chargé à la première demande de calcul seulement.
- Non testé en conditions réelles : l'appel IA de lecture d'image
  (nécessite abonnement + session). Le moteur et l'interface l'ont été.

### Onglet "Outils de mots" (29/09/2026)

Suite de la demande : "le modèle serait celui de scrabble solveur qui est
très complet" (Joseph a fourni une capture puis le texte de la page du
solveur dCode). Seules les FONCTIONS de dCode sont reprises, aucun de
ses codes/données. `src/components/OutilsMots.jsx` + `src/lib/scrabbleMots.js` :
- 4 modes de recherche + modèle complet : mot le plus long / anagrammes,
  raccrocher une lettre du plateau (avec position début/milieu/fin),
  prolonger/intégrer un motif (espace ou "-" = lettre libre), lettres
  pouvant s'accrocher, modèle `C_R_US`. Joker du tirage : `?`, `-` ou `*`.
- Score d'un mot = points des seules lettres du CHEVALET, sans primes ni
  lettres du plateau (comme dCode). Mots butoirs marqués `|`, lettres non
  utilisées, tri par clic sur l'en-tête, copie / CSV, filtres
  commence/finit/contient/longueur.
- Vérificateur de mot, définitions (API REST fr.wiktionary.org appelée
  depuis le navigateur — NON TESTÉ, hôte bloqué depuis l'environnement de
  dev ; `public/scrabble/accents.txt` sert à retrouver la forme accentuée),
  tirage aléatoire (vrai sac de 102 tuiles), compteur de points,
  compteur de lettres restantes (peut reprendre grille + chevalet).
- Liens « Comparer / Vérifier sur dCode (ODS9) » (30/09/2026, demande de
  Joseph : outil COMPLÉMENTAIRE, toujours en nouvel onglet
  `target="_blank"` pour ne pas quitter Cursus) : simples liens, aucune
  intégration (iframe non testable depuis l'environnement de dev, dCode
  réserve son code et ses données).
- Écart connu avec dCode : liste libre (Dicollecte), pas l'ODS9 →
  validité et butoirs approximatifs. Pas d'ODS9 tant que Joseph n'en
  fournit pas une.
