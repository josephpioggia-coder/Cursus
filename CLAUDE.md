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
