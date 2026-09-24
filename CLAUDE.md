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
  24/09/2026 par découpe automatique (rembg/isnet). Pas encore utilisé
  ailleurs — à privilégier dès qu'on veut poser la plume sur un fond
  personnalisé (page d'accueil, écran de bienvenue, etc.) sans redemander
  l'image à Joseph.

Avant de demander une nouvelle version, un nouveau recadrage ou un
nouveau détourage de cette image, vérifier si l'un des fichiers
ci-dessus convient déjà.
