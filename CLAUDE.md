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
Entrée de menu "Jeux de mots" → `src/components/SalleDesJeux.jsx` (voir la section
« Salle des jeux » plus bas), dont la 1re carte ouvre `src/components/ScrabbleSolveur.jsx`.

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

### Onglet "Jouer contre l'ordinateur" — le "jeu de mots" (30/09/2026)

Demande de Joseph : "le jeu de mots" = créer un vrai jeu (toi contre
l'ordinateur), pas seulement un solveur. Nom volontairement neutre :
« Scrabble » est une marque (les règles, elles, ne sont pas protégées).
`src/lib/jeuMots.js` (moteur pur) + `src/components/JeuDeMots.jsx` :
- Sac de 102 tuiles, pioche, premier mot par ★, bonus 50, primes
  seulement pour les tuiles nouvelles, joker = 0 point (primes MOT
  conservées), fin de partie (sac vide + chevalet vide, ou 6 passes de
  suite) avec décompte des tuiles restantes.
- `evaluerCoup()` valide un coup posé à la main (alignement, pas de trou,
  connexion, tous les mots formés, dictionnaire). Vérifié le 30/09/2026
  par simulation de 6 parties entières (214 coups) : le score de
  `evaluerCoup` est identique à celui du solveur, 0 coup légal refusé.
  À refaire si l'un des deux est modifié.
- Ordinateur = le solveur (`genererCoups`) : facile (moitié basse de la
  liste), moyen (parmi les 8 meilleurs), fort (le meilleur). Échange s'il
  n'a aucun coup et que le sac a ≥ 7 tuiles, sinon passe.
- Interaction : GLISSER-DÉPOSER (30/09/2026, demande de Joseph : « poser le doigt sur une lettre et la
  faire glisser vers la case ») au doigt et à la souris — événements `pointer` sur `window`, tuile
  fantôme décalée AU-DESSUS du doigt, case visée cerclée d'or, lâcher = pose si case libre sinon la tuile
  revient ; on peut aussi déplacer une tuile posée (verte) ou la lâcher hors plateau pour la reprendre ;
  `touch-action: none` sur les tuiles du chevalet (et sur le plateau seulement quand des tuiles sont
  posées, hors zoom) sinon le navigateur prend le glissement pour un défilement. Un appui < 8 px reste un
  toucher : tuile du chevalet puis case ; tuile posée
  (verte) touchée = reprise ; joker → sélecteur de lettre ; rappel,
  mélanger, échanger, passer, indice (meilleur coup de l'aide).
- L'onglet reste MONTÉ (masqué) quand on change d'onglet.
- Sauvegarde (30/09/2026, demande de Joseph) en DEUX copies :
  1. `localStorage` (clé `cursus-jeu-de-mots-v1`, `version: 1`), écrite à
     chaque changement — marche hors ligne, propre à l'appareil ;
  2. table Supabase `parties_jeu_de_mots` (UNE partie par compte,
     `user_id` clé primaire, `etat` jsonb, RLS propriétaire) via
     `partiesJeuMotsAPI` (`src/lib/api.js`), envoyée 1,2 s après le
     dernier changement (+ envoi immédiat quand l'onglet est masqué).
     Migration : `2026-09-30-parties-jeu-de-mots.sql` — **à exécuter par
     Joseph dans l'éditeur SQL de Supabase** (non exécutable depuis
     l'environnement de dev). Tant qu'elle ne l'est pas, le jeu marche et
     affiche « sauvegardée sur cet appareil seulement (table pas encore
     créée) ».
  Au chargement : la copie la plus récente (`enregistreLe`) gagne ; la
  reprise recharge d'abord le dictionnaire (`moteur.current` posé AVANT
  `setP`, sinon le tour de l'ordinateur plante). Garde-fous : si le compte
  est injoignable au chargement, on n'y écrit plus de la session (évite
  d'écraser une copie plus récente avec une copie locale périmée) ; on
  n'efface le compte que si une partie a réellement existé (jamais sur un
  simple échec de chargement) ; sauvegarde corrompue ignorée (validation de
  forme). « Abandonner » / « Rejouer » effacent les deux copies. Si la
  structure de l'état change, incrémenter `version`. Dernière écriture
  gagnante (pas de fusion entre deux appareils jouant en même temps).
  L'état contient le chevalet de l'ordinateur (jeu solo, sans enjeu).
- Pas de contestation de mot ni de chronomètre.  Même dictionnaire libre
  (pas l'ODS) pour les deux joueurs.

## Salle des jeux de mots (30/09/2026)

Décision de Joseph (30/09/2026) : AVANT d'ouvrir le jeu à plusieurs (invitation d'un ami par
lien, mode invité, abonnement), étoffer le catalogue pour que les gens aient envie de rester.
Plan arrêté avec lui pour la suite (rien de tout cela n'est construit) : parties à deux par
lien d'invitation, jeu PAR CORRESPONDANCE (à confirmer), un invité peut REJOINDRE mais pas
CRÉER une partie (créer = abonnement, le moins cher suffit), arbitre côté serveur (Edge
Function : sac, chevalets privés, validation), tables génériques par jeu, comptes anonymes
Supabase (à activer par Joseph), et AUDIT préalable des fonctions serveur pour qu'aucun
compte invité ne puisse consommer de l'IA (pré-audit gratuit notamment). Lancement derrière
un interrupteur, jusqu'à ce que le catalogue soit jugé suffisant.

`SalleDesJeux.jsx` regroupe les jeux (menu « Jeux de mots ») ; chaque jeu est un composant
`{ donnees }` dans `src/components/jeux/` (Motus, Boggle, MotLePlusLong, Pendu, EchelleDeMots,
MotsMeles), son moteur PUR dans `src/lib/jeuxDeMots.js`, éléments communs (styles, clavier
AZERTY, chrono, statistiques `localStorage`) dans `jeux/commun.jsx`. Pour AJOUTER un jeu :
composant + moteur + une ligne dans `JEUX` de SalleDesJeux.jsx.
- Deux listes : `public/scrabble/mots-fr.txt` (dictionnaire, ACCEPTE une réponse) et
  `public/jeux/mots-courants.txt` (25 000 mots courants par fréquence, CHOISIT les mots à faire
  deviner). Sources et licences : `mots-courants.txt` dérive de hermitdave/FrequencyWords
  (**CC BY-SA 4.0**, attribution dans `public/jeux/LICENCE-MOTS-COURANTS.txt`, à conserver ;
  la liste reste CC BY-SA). Régénération : `scripts/preparer-mots-courants.mjs` (mots grossiers
  retirés via npm `french-badwords-list` + ajouts manuels ; filtre au mieux, pas infaillible).
- Jeux imaginés pour le catalogue (demande « invente un ou plusieurs nouveaux jeux ») :
  Échelle de mots (BFS sur tout le dictionnaire, « par » = plus court chemin) et Mots mêlés.
- Mots croisés (demandés) NON faits : ils exigent des définitions (indices), or la seule source
  prévue (Wiktionnaire) est inaccessible depuis l'environnement de dev et non testée. Les mots
  mêlés les remplacent pour l'instant.
- Vérifié le 30/09/2026 dans un navigateur (parties jouées de bout en bout, solution calculée
  par le moteur puis jouée dans l'interface) : Motus, Pendu, Boggle (dont fin du temps), Mot le
  plus long, Échelle (chemin optimal), Mots mêlés. Les statistiques sont locales à l'appareil.

### Plateaux et tuiles sur <canvas> + règles de mise en page mobile (30/09/2026)

Retour de Joseph (capture sur son mobile) : « la table est loin de ressembler au modèle » et
« la mise en page de Cursus est mal fichue sur mon mobile ». Le jeu se jouera SURTOUT sur mobile.
Deux causes, deux règles à garder :

1. **Mode sombre forcé du navigateur mobile.** Cursus n'a aucun thème sombre (aucune variable
   `--color-*` définie, aucun `prefers-color-scheme`) : le navigateur de Joseph l'assombrit de
   force. Ce mode ASSOMBRIT les fonds clairs (cases blanches → noires) et INVERSE les textes
   (lettres noires sur tuiles jaunes → blanches ; le texte dans un SVG aussi). Seul le contenu d'un
   `<canvas>` échappe à ça. Donc plateaux, tuiles, grilles de lettres sont dessinés sur canvas :
   `src/components/jeux/dessin.jsx` (`PlateauCanvas`, `TuileCanvas`, `GrilleCanvas`). Couleurs
   d'après le vrai jeu montré par Joseph : cases claires arrondies sur fond noir, LD bleu clair,
   LT bleu foncé, MD mauve, MT rouge, tuiles ambrées à lettre noire + points en indice, dernier
   coup adverse en orange foncé, tuiles posées/aperçu en vert, case active cerclée d'or.
   Contrepartie : pas de texte sélectionnable → chaque canvas a un `aria-label` (lettres).
   Reproduire : `chromium --enable-features=WebContentsForceDark` (Playwright : `args`).
   Ne PAS remettre de `<div>` colorés pour ces éléments, ni du SVG.
2. **Aucun contenu ne doit être plus large que sa colonne.** Le shell de l'app (grille `1fr` sur
   mobile) s'élargit à la largeur MINIMALE de son contenu (la barre du haut fait déjà ~712 px,
   avant comme après ces changements), et le navigateur mobile dézoome alors toute la page :
   le plateau (max 640 px fixe + `minWidth: 300`) l'avait fait déborder. Règles : jamais de
   `minWidth`/largeur fixe > ~280 px dans un jeu ; `minWidth: 0` sur les enfants de flex/grid ;
   un canvas dimensionné d'après la largeur de son CONTENEUR (ResizeObserver, pas `vw`), posé en
   `position: absolute` dans un cadre `aspect-ratio: 1` (sinon sa taille en pixels compte dans la
   largeur minimale → boucle d'élargissement). Vérifié à 320/360/390 px : `scrollWidth <= innerWidth`
   pour tous les écrans de jeu. Mode « 🔍 Agrandir les cases » (cases de 44 px, cadre défilant)
   pour jouer confortablement au doigt.
**Cause racine du « dézoom » sur mobile, corrigée le 30/09/2026 (2e retour de Joseph : « toujours
un problème de mise en page », capture avec le fond gris limité à la moitié gauche et le contenu
sur fond noir) :** le shell d'`App.jsx` est une grille `1fr` (= `minmax(auto, 1fr)`). La barre du
haut (`grid-column: 1 / -1`, 7 éléments : ☰, logo, compteurs, e-mail, Aide, Mode d'emploi,
changement d'espace, Légal, Déconnexion) fait ~712 px de large minimum : la colonne s'élargissait
à 712 px alors que le conteneur (donc son fond) restait à la largeur de l'écran (~360 px).
Corrections : `minmax(0, 1fr)` (colonne figée à la largeur disponible, sur mobile ET bureau) ;
sur mobile la barre du haut ne garde que ☰ · logo · changement d'espace, le reste (e-mail,
compteurs, Aide, Mode d'emploi, Légal, Déconnexion) est dans le tiroir, section « Compte et aide »
(le bureau n'a pas changé). Vérifié dans l'app complète (Supabase simulé) à 320/360/390 px et
1280 px : `scrollWidth == innerWidth` et colonne principale == largeur de l'écran partout.
**Règle** : ne plus ajouter d'éléments à la barre du haut sans regarder ce que ça donne à 360 px ;
sur mobile, les mettre dans le tiroir. Piège de test : l'émulation mobile de Playwright
(`isMobile: true`) ÉLARGIT la fenêtre au contenu et masque le problème ; tester avec une fenêtre
fixe de 360 px (`isMobile: false`) et mesurer `scrollWidth` / la largeur de la colonne principale.

### Partie : plateau agrandi manipulable, tuile plus basse, points en direct (30/09/2026)

3 retours de Joseph après le glisser-déposer : « descends un peu plus la tuile » ; « quand le format des
cases est agrandi on ne peut rien bouger, tout est figé » ; « quand on a un mot correct les points devraient
s'afficher ».
- **Tuile fantôme** : case visée = 28 px au-dessus du doigt (`DECALAGE`), tuile dessinée encore 30 px plus haut
  (anneau doré visible sous elle). Toute mesure de test doit utiliser le MÊME décalage.
- **Plateau agrandi** : pour la partie, `PlateauCanvas panNatif={false}` → `touch-action: none` sur le cadre
  défilant LUI-MÊME. PIÈGE : le navigateur ne regarde `touch-action` que jusqu'au premier conteneur
  défilant ; celui d'un parent est ignoré, et il annulait le glissement (`pointercancel`) pour défiler à la
  place — d'où « tout est figé ». Le défilement est alors géré à la main (`commencerGlisse`, source `pan`) :
  appui sur une tuile posée = on la déplace, ailleurs = on fait défiler ; défilement automatique près des bords
  pendant un glissement. Le solveur de grille garde le défilement natif (`panNatif` par défaut).
  Le plateau ne se recentre plus que sur le coup de l'ordinateur, jamais sur les tuiles posées par le joueur.
- **Points en direct** : `evaluerCoup()` est appelé à chaque changement des tuiles posées ; mots valides →
  ligne « ✔ MOT — N points » + pastille « +N » sur le plateau (`bulle` de `PlateauCanvas`) + bouton
  « Jouer ce coup (+N) » ; sinon la raison en gris (rien tant que « pas encore un mot »).
- Vérifié avec de vrais événements tactiles (CDP `Input.dispatchTouchEvent`), pas seulement à la souris.

### Partie : plein écran, dépôt sous la tuile, double-tap, zoom auto (30/09/2026, comparaison avec un autre Scrabble en ligne)

Retour de Joseph avec captures de l'autre jeu (« aucun problème pour glisser la lettre dans la bonne case ;
elle se dépose là où elle se trouve quand je lève le doigt ; double-tap = zoom ; une fois la lettre posée la
grille est aussitôt agrandie sur la zone ; chez nous elle va toujours dans la cellule au-dessus ; il y a une
couche d'infos en dessous qui n'existe pas chez l'autre »). Corrections :
- **Ce qu'on voit = où ça se pose** : la case visée est celle SOUS la tuile fantôme (centre de la tuile = 30 px
  au-dessus du doigt, `DECALAGE`), et la tuile fantôme y est dessinée CENTRÉE (halo doré `viseur` autour). Le bug
  venait de mon dernier réglage (« descends la tuile ») : la tuile était dessinée 30 px plus haut que la case visée.
  Ne JAMAIS décaler l'affichage de la tuile par rapport à la case de dépôt.
- **Plein écran par défaut** dès qu'une partie est en cours (`plein`) : `position: fixed; inset: 0; 100dvh`, pas de
  page qui défile : barre du haut (⤡ réduire · scores · 🎒 sac · 📜 journal), plateau (`cadre` = place mesurée
  par ResizeObserver : carré du plus grand côté qui tient, ou cadre défilant w×h en zoom), ligne d'information
  (points du mot, erreur, indice), chevalet, barre de 6 boutons orange (Rappel, Mélanger, Échanger, Passer,
  Indice, Jouer +N). Le journal / abandon / état de sauvegarde sont dans un panneau (📜). Disposition normale
  (page Cursus) toujours disponible via ⤡, avec une bande « glisse ici pour faire défiler la page »
  (`touch-action: pan-y`) : le plateau et le chevalet captent le doigt, cette bande laisse la page défiler.
- **Double-tap** sur le plateau = agrandir (centré sur la case tapée) / revenir à la vue d'ensemble ; seulement si
  un tap sur cette case n'aurait aucun effet (sinon confusion avec poser/reprendre une tuile).
- **Zoom automatique** sur la zone dès que la PREMIÈRE tuile est posée (`zoomerSurPremiere`, `focus`).
- Tests : mêmes constantes que le code (`DECALAGE = 30`), chevalet plein écran = wrappers `max-width: 66px`
  (normal : 54 px), boutons du bas = icône + libellé (`getByRole('button', { name: /Indice/ })`, pas `getByText`).
  Vérifié à 320/360/390/412 px, événements tactiles réels (CDP), sombre forcé.

## Lecture à voix haute (01/10/2026, réécrite le jour même)

V1 au-dessus de `window.speechSynthesis` (navigateur) — retour direct de
Joseph : "la voix choisie est vraiment nulle il faut quelque chose
d'humain avec choix de voix de rapidité, ... un outil pro". Remplacée
par une vraie synthèse vocale serveur :

- `supabase/functions/lire-texte/index.ts` — appelle `gpt-4o-mini-tts`
  d'OpenAI (voix nettement plus naturelles). Réutilise `OPENAI_API_KEY`,
  déjà configurée pour `transcrire-audio` (dictée vocale) — AUCUN
  nouveau compte/secret. Réservé aux comptes avec un abonnement actif
  (même vérification que `claude-prox`) : chaque appel a un coût réel.
  Limite dure d'OpenAI : 4096 caractères par appel — refusée avec un
  message clair, pas tronquée en silence.
- `src/lib/lectureVoix.js` — découpe le texte en tranches, les récupère
  et les enchaîne via un seul `<audio>` HTML réutilisé (pause/reprise
  natives). `VOIX_DISPONIBLES` (7 voix) et `VITESSES_DISPONIBLES` (0.75×
  à 2×) exportées pour l'UI — à garder synchronisées avec
  `VOIX_AUTORISEES` côté serveur si la liste change. PAS de repli
  automatique vers la voix du navigateur en cas d'échec (quota,
  réseau...) : Joseph voulait explicitement s'en éloigner, un retour
  silencieux à cette voix-là aurait été trompeur — `onErreur` remonte un
  message clair à la place.
- CORRECTIF 01/10/2026 (même jour, signalé en usage réel après premier
  déploiement) — "presqu'une minute avant que la lecture ne se lance" et
  "parfois elle ne se lance pas". Deux causes :
  1. Tranches à 3800 caractères (quasi la limite dure d'OpenAI de 4096) :
     `gpt-4o-mini-tts` ne renvoie l'audio qu'une fois la synthèse
     ENTIÈREMENT générée — plusieurs minutes de parole à produire avant
     le moindre son, pas un bug réseau. `TAILLE_MAX_TRANCHE` ramenée à
     700 (≈ 20-30s de parole, premier son rapide) + préchargement de la
     tranche suivante dès que la courante commence à jouer (pas quand
     elle se termine), pour qu'aucune tranche après la première
     n'introduise de silence audible.
  2. Aucun retour visuel entre le clic et `onDébut` : un clic répété par
     impatience pendant cette attente relançait `lire()` depuis zéro
     (elle annule la tentative précédente) — d'où "parfois elle ne se
     lance pas". État "chargement" affiché immédiatement (avant le
     moindre appel réseau), bouton désactivé pendant cet état
     (`Editeur.jsx`) : un second clic ne peut plus tout annuler.
- Intégré pour l'instant dans CursEdit (`Editeur.jsx` : bouton + choix
  de voix/vitesse mémorisés par appareil dans l'en-tête de l'éditeur).
  Joseph a dit vouloir ce bouton "peut-être ailleurs" aussi — réutiliser
  `lectureVoix.js` plutôt qu'en réécrire avant de l'ajouter à CursAudit
  ou CursDecision.
- PAS de suivi de quota séparé par caractère consommé (seulement la
  vérification "abonnement actif") — à ajouter si le volume le
  justifie ; surveillable en attendant via platform.openai.com/usage.

## Journal des erreurs — enfin consultable (01/10/2026)

`journal_erreurs` (table créée le 15/07/2026, écrite depuis plusieurs
endroits via `journaliserErreur()` — CopiloteIA, Editeur, ImportDocx...)
n'avait jamais eu d'écran pour la LIRE : gap trouvé en diagnostiquant un
"le co-pilote n'a pas pu traiter ce passage" récurrent ("toujours cette
faiblesse") resté sans piste faute de pouvoir voir ce qui avait
réellement été journalisé. Corrigé :
- `supabase/functions/admin-journal-erreurs/index.ts` — liste les 300
  lignes les plus récentes, en service_role (même principe que
  `admin-supervision-cursaudit` : la RLS de `journal_erreurs` n'autorise
  a priori chacun qu'à lire ses propres lignes, pas Joseph à lire celles
  des autres comptes). Réservé à `joseph.pioggia@gmail.com`.
- `src/components/JournalErreurs.jsx` — nouvelle entrée de menu
  "Journal des erreurs" (visible seulement pour Joseph, à côté
  d'Administration/Supervision dans `App.jsx`), liste filtrable par
  contexte/message/e-mail.
- Au passage : le chemin d'erreur spécifique à l'onglet Références de
  CopiloteIA (réparation du JSON après un `web_search` — voir plus haut
  "Le co-pilote n'a pas pu traiter ce passage") jetait son propre
  `__ERREUR_GENERIQUE__` sans jamais rien journaliser, contrairement au
  cas générique (déjà corrigé) dans `appelClaude`. Journalisé aussi
  maintenant, avec le texte brut reçu — c'est cette tranche-là qui
  manquait pour comprendre pourquoi l'onglet Références échoue plus
  souvent que les autres (combine recherche web + JSON final dans le
  même budget de tokens, plus susceptible d'être tronqué).

## Cause RÉELLE trouvée (01/10/2026, via le Journal des erreurs) : "thinking" mangeait tout le budget

Première ligne jamais lue dans `journal_erreurs`, et elle a immédiatement
payé : `CopiloteIA:appelClaude — Réponse sans bloc texte exploitable —
stop_reason=max_tokens, blocs=[thinking]`. Autrement dit : le modèle
avait dépensé la TOTALITÉ de `max_tokens` en raisonnement interne
(bloc "thinking") sans jamais produire de bloc "text" ni "tool_use" —
alors qu'AUCUN appel Claude de Cursus ne demande explicitement la
réflexion étendue (pas de paramètre `thinking` envoyé nulle part avant
ce correctif). Tout porte à croire que `claude-sonnet-5` l'engage par
défaut dans certains cas, à la différence des générations précédentes.

Corrigé partout où Cursus appelle Claude directement — `thinking: {
type: "disabled" }` ajouté au corps de la requête dans LES DIX points
d'appel du dépôt (aucun n'a besoin du contenu d'un bloc "thinking",
seuls "text"/"tool_use" sont jamais lus) :
- Client : `CopiloteIA.jsx` → `appelClaude()` (suggestions,
  personnages, références, cohérence, recomposition — tous les onglets
  du Co-pilote passent par cette seule fonction).
- Serveur (CursAudit + vérification) : `analyser-unite-cursaudit`,
  `orchestrer-audit-cursaudit`, `preaudit-approfondi-cursaudit` (2
  points d'appel), `preaudit-global-cursaudit`,
  `synthese-audit-detaille-cursaudit`, `synthetiser-question-cursaudit`,
  `fiche-action-preaudit-cursaudit`, `extraire-profil-cursus`,
  `verification-deux-ia`.

PAS confirmé que cette cause s'est RÉELLEMENT déjà produite sur ces 9
fonctions serveur (seul le cas CopiloteIA est confirmé par un vrai
journal) — corrigé par précaution partout où le même gap existait
(aucune n'envoyait `thinking` non plus), vu la gravité potentielle :
ce sont les fonctions du cœur payant de CursAudit. Si un échec du même
genre s'y reproduit malgré ça, ces 9 fonctions n'ont PAS encore leur
propre `journaliserErreur()` (elles journalisent dans leurs propres
tables d'audit, pas dans `journal_erreurs`) — à vérifier au cas par cas
dans les tables d'audit concernées plutôt que dans le Journal des
erreurs si un problème de ce type y est un jour suspecté.

`claude-prox` (le relais utilisé par CopiloteIA) n'a pas été touché :
il transmet le corps de la requête tel quel, le `thinking: disabled`
envoyé par le client suffit, pas besoin de le dupliquer côté relais.

## Question centrale CursAudit : enfin un vrai canal de sortie (01/10/2026)

Cas réel qui a révélé le bug : Joseph a lui-même produit, hors Cursus, un
relevé serré des marqueurs narcissiques d'"À cœur retrouvé" (427
paragraphes criblés sur 1549) en quelques minutes. Son contrat d'intention
pour cet audit posait pourtant déjà cette question exacte comme "question
centrale validée" : *"quel particularité de la personnalité de l'auteure
ressort à la lecture du livre"*. Aucun des trois documents produits
(pré-audit, audit détaillé, synthèse) n'en disait un mot.

**Cause confirmée par lecture directe du code, pas une hypothèse** :
`question_libre` était bien enregistrée et transmise en contexte ("à
garder à l'esprit") à chaque étape, mais AUCUN schéma de sortie, nulle
part dans le pipeline, n'avait de champ pour y répondre — et la synthèse
finale (détaillée comme pré-audit) ne relit jamais le texte source, donc
ne pouvait de toute façon rien retrouver après coup. La question était
structurellement condamnée à disparaître, quelle que soit sa formulation.

**Corrigé de bout en bout** — un champ `reponse_question_centrale` ajouté
à CHAQUE étage du pipeline, propagé jusqu'au document final, dans les 5
fonctions Edge + le rendu client + les 3 exports Word :
- Par unité (`orchestrer-audit-cursaudit`, `analyser-unite-cursaudit`) :
  réponse à partir de CE que CETTE unité montre, chaîne vide si rien de
  pertinent.
- Par chapitre (`preaudit-approfondi-cursaudit`, `SCHEMA_LECTURE_CHAPITRE`) :
  même principe — la question n'était même pas transmise à cette étape
  avant ce correctif (ni le texte de la question, ni de champ pour y
  répondre).
- Synthèse globale du pré-audit (même fichier, `SCHEMA_PREAUDIT_APPROFONDI`,
  champ 14/14) : synthétise le manuscrit entier + les réponses par
  chapitre quand elles sont fournies (passage de révision).
- Synthèse de l'audit détaillé (`synthese-audit-detaille-cursaudit`) :
  collecte les réponses non vides de chaque unité, les synthétise en UNE
  réponse développée.
- Fiche d'action du pré-audit (`fiche-action-preaudit-cursaudit`) : reprend
  la réponse déjà produite par le pré-audit, la reformule pour
  l'auteur·ice.
- Client (`CursAuditDetail.jsx`, `FicheExecutive` + `FicheActionAffichage`,
  schéma partagé) : encadré "🧭 Réponse à votre question centrale", affiché
  EN PREMIER (avant même le diagnostic) — c'est littéralement ce qui a été
  demandé en priorité. Même règle `masquerResumeCourt` que les autres
  champs pour éviter la redite entre les deux composants.
- Les 3 exports Word (`exportFicheActionWord.js`, `exportPreauditWord.js`,
  `exportAuditDetailleWord.js`) — Joseph travaille surtout depuis les
  .docx exportés, pas seulement à l'écran : sans ce correctif-là, le
  champ aurait existé en base sans jamais lui être visible. Dans
  `exportAuditDetailleWord.js` (dump brut par unité), gardé AUSSI au
  niveau unité (pas seulement la synthèse) : permet de retrouver quelle
  unité précise a contribué à la réponse, comme le relevé manuel de
  Joseph (§§ un par un) l'avait fait.

**Limite assumée** : seuls les NOUVEAUX audits (ou pré-audits/synthèses
relancés après déploiement) auront ce champ rempli — un audit déjà
terminé avant ce correctif n'a pas rétroactivement de
`reponse_question_centrale` dans ses résultats déjà enregistrés.

**Idée produit distincte, à construire plus tard** (décision de Joseph,
01/10/2026) : un "mini-audit par axe" — poser une question précise APRÈS
coup, sans relancer tout l'audit, pour quelques euros et quelques
minutes. Positionné au moment où on revient de CursAudit vers CursEdit
(pas encore décidé plus précisément que ça). Complémentaire du correctif
ci-dessus, pas un remplacement : celui-ci répare ce qui est déjà vendu
comme fonctionnant ; le mini-audit par axe serait une nouvelle
fonctionnalité, à concevoir séparément.

## GO/NO-GO fiabilité des IA (03/10/2026) — note de décision de Joseph

Incident déclencheur : ChatGPT a affirmé "preuves à l'appui" (nom,
adresse, date, prix) une information entièrement inventée, à dix
demandes de vérification distinctes, avant d'admettre s'être montré
"complaisant" et avoir menti. Joseph a soumis une note de décision
formelle (GO/NO-GO) demandant d'évaluer honnêtement si Cursus peut
encore reposer sur des IA génératives, sans complaisance.

**Diagnostic rendu, fondé sur une lecture réelle du code (pas une
réponse de principe)** : Cursus n'est pas uniforme face à ce risque.
- Famille A (grounded) : l'essentiel de CursAudit/CopiloteIA (cohérence,
  structure, diagnostic) lit LE TEXTE FOURNI PAR L'AUTEUR·ICE, présent
  intégralement dans le prompt — pas une invention ex nihilo, le risque
  structurel est différent.
- Famille B (exposée), deux points identifiés précisément :
  1. L'onglet "Références" de CopiloteIA — recherche web réelle, mais
     les résultats bruts (`web_search_tool_result`) étaient JETÉS après
     coup, seul le texte final du modèle gardé. Un statut "vérifié"
     autodéclaré n'avait donc aucune preuve récupérable pour le
     contredire.
  2. `verification-deux-ia` — conçu et testé EN DIRECT sur "À cœur
     retrouvé" (voir `docs/protocole-verification-approfondie-deux-ia.md`) :
     un vrai dialogue contradictoire Claude/GPT, mais sans accès à une
     source externe pendant ce dialogue pour toute "affirmation
     théorique/factuelle" (ex. attribution correcte d'une idée à Jung) —
     deux IA qui se valident l'une l'autre, pas une preuve indépendante,
     pour ce sous-cas précis (le protocole reste solide pour juger la
     cohérence d'un passage avec le reste du manuscrit, lui bien
     accessible).

**Verdict rendu : GO conditionnel, pas NO-GO** — à condition de traiter
ces deux points, pas de les ignorer. Voir section suivante pour le
premier corrigé (Références).

## Références CopiloteIA : vérification mécanique, pas auto-déclarée (03/10/2026)

Premier chantier du GO conditionnel ci-dessus, demandé explicitement par
Joseph ("commence par le point Références"). Principe : un statut
"vérifié" écrit par le modèle n'est que sa propre parole tant que rien
d'EXTÉRIEUR à lui ne le recoupe — et une seconde IA d'accord ne compte
toujours pas comme preuve indépendante (c'est le risque même de
`verification-deux-ia` ci-dessus). Le recoupement ajouté ici est
entièrement mécanique : aucun appel IA.

- `appelClaude()` (`CopiloteIA.jsx`) expose désormais `résultatsRecherche`
  quand `avecDétails=true` : les blocs `web_search_tool_result` RÉELLEMENT
  renvoyés par l'outil de recherche pendant cet appel (`url`/`title`,
  en clair dans la réponse Anthropic), au lieu d'être jetés comme avant.
  Limite assumée et documentée dans le code : `encrypted_content` (le
  texte de la page utilisé en interne par le modèle) reste chiffré,
  illisible côté client — on peut donc confirmer mécaniquement "cette
  URL a-t-elle réellement été renvoyée par la recherche", pas encore
  "le passage cité y figure-t-il mot pour mot" (demanderait de rouvrir
  nous-mêmes chaque URL — PAS fait dans cette première étape, prochaine
  si besoin).
- `PROMPTS.références` exige maintenant un champ `url_verification` par
  référence (l'URL exacte du résultat de recherche qui confirme la
  référence), avec consigne explicite que ce champ sera recoupé
  mécaniquement après coup — ne pas inventer d'URL plausible.
- `recouperRéférencesAvecRecherche()` (nouvelle fonction, pure, sans
  appel réseau) : compare chaque `url_verification` revendiquée aux URLs
  réellement obtenues. Si absente ou non trouvée → le statut est
  RÉTROGRADÉ mécaniquement vers `à_vérifier`, quoi que le modèle ait
  écrit. Ne peut JAMAIS remonter un statut — seulement le dégrader.
- UI (`CarteRéférence`) : nouveau badge rouge "⚠ IA affirme « vérifié »
  — non confirmé par Cursus" distinct du badge vert habituel, avec la
  mention explicite de ce que le modèle avait prétendu. Pour les
  références réellement confirmées, l'URL devient un lien cliquable
  ("🔗 Source trouvée par la recherche") — ferme la boucle "montrer
  l'extrait brut pour que l'humain tranche le dernier maillon" de la
  note de décision. Le warning voyage aussi dans le texte copié
  (presse-papiers), pas seulement affiché à l'écran.

**Pas fait dans cette étape, assumé** : pas de stockage persistant de
la liste complète des résultats de recherche bruts (au-delà de l'URL
par référence déjà sauvegardée) — un vrai journal d'audit complet
(URL + contenu + horodatage pour CHAQUE recherche, pas seulement les
références retenues) resterait à construire si le besoin se confirme.
Pas de Layer 2 (récupérer nous-mêmes la page et vérifier que la citation
exacte y figure) — seule l'existence réelle de l'URL est confirmée pour
l'instant, pas le contenu exact de la page. `verification-deux-ia`
n'a pas été touché dans cette passe — reste le chantier suivant si
Joseph le confirme.

## Dérive interprétative : cas vécu, deux garde-fous de prompt (03/10/2026)

Suite directe du GO/NO-GO : Joseph a testé l'impartialité de Claude Code
(hors Cursus, en conversation directe) sur une lecture serrée d'un
remerciement dans un livre réel ("À cœur retrouvé"), en poussant
plusieurs tours de correction successifs. Deux dérives réelles, observées
en direct, pas hypothétiques :

1. **L'interprétation psychologique s'accumule au-delà du texte sans
   qu'aucune étape individuelle ne semble franchir de ligne claire** —
   le dérapage ne se voit qu'en comparant le point d'arrivée au texte
   exact, repris mot pour mot. Contrairement au risque déjà couvert par
   la règle sur les personnes nommées (inventer un fait ABSENT du
   texte), ici le texte source était bien fourni et bien lu — la dérive
   vient de la nature interprétative de la tâche elle-même (cerner une
   psychologie, une intention) plutôt que d'une invention pure.
2. **Une comparaison factuelle non vérifiée profite de la rigueur
   appliquée à l'affirmation principale** — en répondant (via le fil de
   dialogue du Co-pilote, hors de ce test) sur la valeur scientifique de
   l'anthroposophie citée dans un livre, une réponse par ailleurs
   rigoureuse a qualifié en passant la théorie polyvagale de "solide"
   par contraste, alors qu'elle fait elle-même l'objet de critiques
   publiées sérieuses — une affirmation secondaire qui n'avait pas reçu
   le même niveau de vérification que l'affirmation principale.

Corrigé par deux nouvelles règles de prompt partagées, dans
`CopiloteIA.jsx` :
- `RÈGLE_INTERPRÉTATION_VS_FAIT` — exige que toute affirmation sur la
  psychologie/motivation/intention non explicitement écrite dans le
  texte soit formulée comme interprétation ("le texte suggère...") et
  non comme un fait, et impose de revérifier le texte exact à chaque
  étape plutôt que de laisser une interprétation s'empiler sur une
  autre. Injectée dans `suggestions`, `personnages`, `cohérence` et
  `promptDialogue` (le fil de suivi par carte, tous onglets confondus).
- `RÈGLE_COMPARAISON_FACTUELLE` — exige la même rigueur de vérification
  pour une affirmation de comparaison que pour l'affirmation principale
  qu'elle accompagne. Injectée dans `PROMPTS.références` et
  `promptDialogue`.

**Limite assumée, pas corrigée ici** : les étapes de synthèse de
CursAudit (pré-audit global, synthèse de l'audit détaillé, fiche
d'action) ne relisent jamais le texte source du manuscrit — connu
depuis le correctif de la "question centrale" (01/10/2026), mais
jusqu'ici documenté comme une limite d'architecture, pas comme un
facteur de risque d'interprétation en soi. Ce cas en est la
démonstration concrète : la même dérive progressive (plausible à
chaque étape, visible seulement en revenant à la source exacte) s'est
produite alors que le texte était bien fourni — elle ne peut donc
qu'être pire pour une étape qui travaille déjà sur du JSON condensé
plutôt que sur le texte intégral. Si un signalement laisse penser
qu'une synthèse CursAudit a sur-interprété, ne pas se contenter de
relire le JSON intermédiaire : remonter jusqu'au texte source de
l'unité concernée.

**CORRECTIF le jour même** : la première version de
`RÈGLE_INTERPRÉTATION_VS_FAIT` était unique, sans distinction
fiction/non-fiction — Joseph a fait remarquer qu'en fiction, inférer la
psychologie d'un PERSONNAGE à partir de ses actes est le cœur même du
travail d'analyse littéraire, pas une dérive à corriger ; imposer le
même hedging qu'au cas réel ("À cœur retrouvé") aurait rendu l'onglet
Personnages inutilement timide pour son usage normal en fiction. Autre
chose repérée au passage : l'onglet "Personnages" tourne aussi bien sur
des romans que sur des essais/mémoires (`onglets`, aucun filtre par
type de projet) — son prompt affirmait pourtant "spécialisé en fiction"
même quand il tournait sur un essai, exactement le cas exposé au risque
qui a motivé cette règle (des personnes réelles nommées dans le texte).
`RÈGLE_INTERPRÉTATION_VS_FAIT` est maintenant une fonction de `type` :
en fiction, la prudence ne porte que sur l'auteur·ice elle-même
(personne réelle) — les personnages inventés peuvent être interprétés
librement, tant que ça reste ancré dans le texte ; en non-fiction, elle
porte sur toute personne nommée, personnages compris, puisque ce sont
des personnes réelles. `PROMPTS.personnages` devient lui aussi une
fonction de `type`, avec un texte d'intro qui ne prétend plus "fiction"
sur un essai. `type`/`typeProjet` propagé jusqu'à `promptDialogue`
(ajout d'un second paramètre) pour que le fil de suivi par carte
applique la bonne variante lui aussi.

### Mots croisés, mots fléchés, mots codés (04/10/2026)

Demande de Joseph : « autres jeux de mots comme mots croisés ou mots fléchés… ». Trois jeux ajoutés à la Salle
(`MotsCroises.jsx`, `MotsFleches.jsx` → interface commune `GrilleIndicee.jsx` ; `MotsCodes.jsx`), moteur pur
`src/lib/grillesMots.js`, dessin `GrilleMotsCanvas` (dessin.jsx, canvas : règle du mode sombre forcé).
- **Indices** : `public/jeux/mots-croises.txt`, 1591 lignes (704 le 04/10 matin, +887 le soir : animaux, cuisine, corps, maison, métiers, géographie avec noms propres autorisés dans le vérificateur, littérature/arts, météo, sentiments, verbes, adjectifs, sciences, sport) `MOT|indice`, ÉCRITES par Claude (originales, sans
  copie : Wiktionnaire & co. inaccessibles depuis l'environnement de dev). Réponses sans accents (`COEUR`, `OEUF`).
  Contrôle : `node scripts/verifier-mots-croises.mjs` (format, doublons, présence au dictionnaire, indice ne contenant
  pas la réponse, longueur ≤ 46). À relancer après tout ajout. Vocabulaire limité : agrandir la liste = plus de variété.
- **Grilles LIBRES, pas denses** (générateur par placement glouton avec croisements, mots parallèles jamais collés) :
  une vraie grille de presse (pleine, symétrique) demanderait un solveur de remplissage et un dictionnaire d'indices bien
  plus grand. Fléchés : case d'indice avant le mot (à gauche = →, au-dessus = ↓), une case peut porter 2 indices.
- Codés : mots COURANTS (rang ≤ 6000, 3–8 lettres), 3 lettres données, une lettre = un numéro ; saisir une lettre
  l'applique à toutes les cases du numéro et la retire d'un autre numéro.
- Vérifié le 04/10/2026 à 360 px (sombre forcé, `scrollWidth <= innerWidth`) : rendu des 3 jeux, grilles terminées
  via « le mot » / « une lettre » (détection de fin + statistiques). Pas testé : saisie au clavier physique, double-sens.
- **Niveau difficile (04/10/2026, demande « difficile mais pas impossible »)** : `public/jeux/mots-croises-difficiles.txt`
  (313 entrées : vocabulaire savant — figures de style, histoire, mythologie, architecture, musique — avec des
  définitions plus allusives). Chargé avec l'autre liste (`chargerMotsCroises`, entrées marquées `dur`) ; facile et
  moyen n'utilisent QUE les mots courants ; difficile (`entreesDuNiveau`) = mots durs ×3 + 40 % des mots courants, pour
  qu'il reste des croisements possibles (≈ 43 % de mots durs par grille de croisés, ≈ 40 % en fléchés ; les mots
  courants servent de points d'appui). Le vérificateur contrôle les deux fichiers (doublons entre eux inclus).
- **Liens directs vers un jeu (04/10/2026, demande « donne-moi un accès direct au jeu »)** : `https://cursus.pro/?jeu=<id>`
  avec `id` ∈ `croises`, `fleches`, `codes`, `motus`, `boggle`, `long`, `pendu`, `echelle`, `meles`, `grille` ; `salle`
  (ou id inconnu) = liste des jeux. Lu une fois au chargement (`JEU_PAR_LIEN`, App.jsx) → vue « scrabble » +
  `SalleDesJeux jeuInitial`. Sans espace déjà choisi, ouvre CursEdit (pas d'écran de choix). Il faut toujours être connecté
  (le lien passe par la connexion) ; l'ajouter en favori / écran d'accueil du mobile. Testé sur SalleDesJeux seule
  (croises, codes, salle, id inconnu) ; PAS testé dans l'app complète connectée (Supabase indisponible en dev).
  Piège d'outillage : ne jamais tuer un serveur par `pgrep -f`/`grep` sur sa ligne de commande depuis Bash (le shell se tue lui-même).

## Éditeur de texte sur mobile (04/10/2026)

Retour de Joseph (GSM, après avoir mis une icône Cursus sur son écran d'accueil) : « la mise en page a été complètement
chamboulée, la partie centrale est escamotée, les icônes de mise en page sont à la verticale et le co-pilote prend les
2/3 de la page ». **Cause : mon correctif de mise en page mobile du 30/09/2026 (`minmax(0, 1fr)`)** — l'éditeur n'avait
JAMAIS été conçu pour mobile (grille `minmax(0,1fr) 280px` : texte | Co-pilote). Avant, la colonne s'élargissait et le
navigateur dézoomait toute la page, ce qui masquait le problème ; une fois la colonne figée à 360 px, le texte ne
gardait que ~80 px. Corrigé : sur mobile (`estMobile`) l'éditeur prend toute la largeur ; le Co-pilote devient un panneau
plein écran (`position: fixed`, sous la barre de 48 px) ouvert par un bouton flottant « 🤖 Co-pilote » (bas droite,
`bottom: 64` pour laisser la barre de statut), avec « ← Retour au texte ». Le panneau reste MONTÉ (`display: none`)
fermé : l'état du Co-pilote est conservé. En-tête de l'éditeur : `flexWrap: wrap`. Bureau inchangé (vérifié à 1280 px).
**Règle** : toute vue à plusieurs colonnes fixes doit avoir sa variante `estMobile` — la colonne principale ne s'élargit
plus (cf. section mise en page mobile). Vérifié à 360 px dans l'app complète (Supabase simulé : session `sb-x-auth-token`
en localStorage + routes `**/rest/v1/**`, abonnement actif sinon « accès retiré ») ; autres vues multi-colonnes
(Bibliothèque, CursAudit, CursDecision…) NON revérifiées sur mobile.

## Page de garde à chaque nouvelle visite (04/10/2026)

Retour de l'auteur (mobile) : « quand je clique sur cursus.pro j'arrive dans CursAudit ; je veux revenir à la page de
garde ». Cause : le choix d'espace (CursEdit/CursAudit) était mémorisé en `localStorage` (permanent) — décision du
07/09/2026, prise parce que l'auteur se plaignait alors de l'inverse (« se reconnecter renvoie toujours à l'écran de
choix »). **Les deux demandes sont contradictoires** : compromis retenu — mémoire en `sessionStorage` (`lireEspace` /
`ecrireEspace` / `effacerEspace`, App.jsx) : l'espace est retenu tant que l'ONGLET reste ouvert (F5, retour de paiement
Stripe), mais une nouvelle visite (nouvel onglet, navigateur rouvert, clic sur cursus.pro) affiche l'écran de choix.
L'ancienne clé `localStorage` est supprimée au chargement. Si l'auteur redemande « rouvrir directement le dernier
espace » : remplacer `sessionStorage` par `localStorage` dans ces trois fonctions (et retirer la purge).
Au passage, `EcranChoixEspace.jsx` (écran désormais vu à CHAQUE visite) débordait à 360 px (bandeau `width: 620`, cartes
`width: 300` fixes → texte coupé des deux côtés) : `width: 100%` + `maxWidth`, marge haute sur mobile pour ne pas passer sous
« Mode d'emploi / Se déconnecter ». Vérifié à 360 et 1280 px (`scrollWidth == innerWidth`). Les liens `?jeu=` ne sont pas
touchés. Deux adresses coexistent (www.cursus.pro et cursus-seven.vercel.app) : mémoire propre à chacune.

## Jeux « livres » : Devine le livre, Quel lecteur es-tu ? (05/10/2026)

Idée de Joseph : un jeu autour de l'écriture, des romans et des best-sellers de France et de Belgique. **Données** :
`public/jeux/livres.json` (33 fiches : 28 romans, 5 BD — titre, auteur, pays, année, genre, époque, lieu, `palmares`,
résumé de 2 phrases, 5 indices du vague au parlant, 6 dimensions 0-4 pour le questionnaire). Fiches ÉCRITES par Claude
de mémoire (pas de recopie de quatrième de couverture), sans accès aux classements : le web n'était joignable que par
recherche (extraits), pas par lecture des pages (Livres Hebdo, Edistat, Fnac Belgique, Filigranes, ActuaLitté bloqués).
Seuls les chiffres 2025 vus dans ces extraits figurent dans `palmares` (Astérix en Lusitanie ≈ 1,54 M d'exemplaires ;
La Maison vide, Goncourt 2025, ≈ 500 000 en grand format ; McFadden autrice la plus vendue) ; le reste = prix connus
(Goncourt 2018/2021/2022/2023/2024, Renaudot 2021/2024…) ou « grand succès de librairie ». **Ce n'est PAS un palmarès
« de l'année » à jour** : les nouveautés de la rentrée 2026 ne sont pas dedans (inconnues de Claude, non vérifiables).
Fiches les moins sûres (peu de détails de l'intrigue connus) : La Maison vide, Jacaranda. Pour ajouter les nouveautés :
Joseph envoie une capture du Top 20 Livres Hebdo/Edistat → fiches à écrire dans `livres.json` (ne jamais inventer
l'intrigue d'un livre qu'on ne connaît pas) puis `node scripts/verifier-livres.mjs` (champs, 5 indices, dimensions,
indices qui ne contiennent pas les mots du titre). Afficher la date du palmarès quand il y en aura un.
- `src/lib/jeuLivres.js` (moteur pur) ; `DevineLeLivre.jsx` : 10 manches, 4 propositions (3 distracteurs du MÊME format),
  bonne réponse = 6 − indices affichés, une erreur dévoile l'indice suivant, fiche après chaque livre, stats `livres` ;
  `QuelLecteur.jsx` : 8 questions (6 axes suspense/émotion/noirceur/réalisme/exigence/humour + époque + roman/BD),
  score = Σ(4 − écart) (+2 époque), le format filtre ; 3 livres + « ce qui vous rapproche ». Gratuit, sans IA.
- Entrées `leger: true` dans `JEUX` (SalleDesJeux.jsx) : ne chargent PAS le dictionnaire de 411 000 mots, seulement
  `livres.json`. Liens directs : `/?jeu=livre`, `/?jeu=lecteur`.
- Vérifié à 360 px : partie complète de 10 livres (somme des points == score final), questionnaire jusqu'aux résultats,
  `scrollWidth == innerWidth`. Idée non faite : « Dans quel rayon va mon manuscrit ? » (avec IA, payant).
