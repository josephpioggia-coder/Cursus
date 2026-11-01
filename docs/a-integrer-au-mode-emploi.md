# À intégrer au mode d'emploi

File d'attente des nouveautés à expliquer à l'utilisateur·ice. **Règle** (décision de Joseph, 31/10/2026) : à chaque nouvelle modalité, fonctionnalité ou chose à savoir pour utiliser Cursus, ajouter une entrée ICI dans la même modification, rédigée du point de vue de l'utilisateur·ice. Quand une entrée est reprise dans le vrai mode d'emploi (`docs/mode-emploi.md` et l'écran `src/components/ModeEmploi.jsx`), la déplacer en bas sous « Déjà intégré ».

Chantier du manuel COMPLET : voir `docs/liste-attente.md` #6 (suite du #3). Fonctions du ruban à coder : #7.

Le mode d'emploi publié date du 24/09/2026 : tout ce qui suit lui est postérieur. Les entrées du 24/09 au 30/10 ont été reconstituées d'après le journal du projet (CLAUDE.md) ; chaque fonction est à revérifier dans l'appli avant publication.

Format : **Titre** — *où le trouver* — ce que ça fait, en une à trois phrases. Mentionner ce qui ne marche PAS ou reste limité.

## À intégrer

### Entrer dans Cursus
- **Installer Cursus sur l'écran d'accueil** (31/10/2026) — *écran de choix d'espace, tiroir ☰ en bas* — bouton « 📲 Installer Cursus ». Chrome / Edge / Samsung : installation en un clic. Firefox Android : menu ⋮ → « Installer » ou « Ajouter à l'écran d'accueil » (peut créer un simple raccourci si Android bloque l'installation). iPhone : Partager → Sur l'écran d'accueil. Firefox sur ordinateur ne sait pas installer une appli web : marque-page ou onglet épinglé.
- **Écran de choix à chaque nouvelle visite** (04/10/2026) — un nouvel onglet ou un clic sur cursus.pro ramène à l'écran de choix CursEdit / CursAudit ; un rechargement (F5) garde l'espace et le chapitre ouverts.
- **Liens directs vers un jeu** — `cursus.pro/?jeu=croises`, `fleches`, `codes`, `motus`, `boggle`, `long`, `pendu`, `echelle`, `meles`, `grille`, `livre`, `lecteur`, `cercle` ; `salle` = liste. Connexion nécessaire.

### Écrire (CursEdit)
- **Ruban à onglets** — *bureau* — onglets Accueil, Insertion, Mise en page, Références, Révision, Affichage, Aide. 📌 au survol d'un bouton = l'épingler sur l'Accueil. Les fonctions grisées arrivent plus tard.
- **Mise en forme à la Word** — sélecteur de Style (Normal, Titres 1 à 6, Citation), police, taille, interligne, retraits, casse (Aa), barré, indice/exposant, « Effacer la mise en forme ». Exportées vers Word.
- **🎨 Styles** — régler une fois police, taille, interligne, espacements des styles pour tout le livre (repris à l'export Word).
- **📄 Vue page et règle** — feuille avec marges ; glisser les bords de la règle pour les marges, les repères pour retraits, première ligne et taquets de tabulation (touche Tab).
- **Saut de page** (31/10/2026) — *ruban Insertion › Pages, ou Ctrl+Entrée* — insère un trait pointillé « Saut de page » : le texte qui suit commence sur une nouvelle page à l'export Word. Pour l'enlever : cliquer sur la croix ✕ du trait, OU placer le curseur au début du texte qui suit (ou à la fin du texte qui précède) et faire Retour arrière (ou Suppr). Chaque partie, chapitre et scène commence déjà sur une nouvelle page à l'export, inutile d'en ajouter. Le saut n'est visible que comme trait dans l'éditeur (pas de vraie pagination avant l'export) ; absent du menu ⋯ du téléphone (Ctrl+Entrée seulement avec un clavier).
- **En-têtes et numéros de page** (01/11/2026) — *ruban Mise en page › En-tête et pied de page* — fenêtre de réglage PAR LIVRE : position du numéro (bas ou haut, gauche / centre / droite), présentation (1, – 1 –, Page 1, 1 sur N) et texte libre dans les trois zones de l'en-tête et du pied de page. Dans un texte on peut écrire `{titre}`, `{page}` et `{pages}`. Les réglages s'appliquent à l'**export Word** (pas de pagination à l'écran) : la page de titre et le sommaire n'ont ni en-tête ni numéro, le livre commence à la page 1. Tant que rien n'est réglé, l'export reste identique. « Tout retirer » supprime tous les réglages. Pas encore : en-tête différent pour les pages paires / impaires, titre du chapitre courant dans l'en-tête, numéros en chiffres romains.
- **🧭 Questionnaire de démarrage** (01/11/2026) — *s'ouvre à la création d'un livre, et par le bouton « 🧭 Questionnaire de démarrage » de la page du livre* — 10 ou 11 questions, une par écran, sur l'intention du livre (pourquoi, idée centrale, lecteur, genre, ton, thèmes, ce que le livre ne doit jamais devenir, rôle du co-pilote, principes que l'IA ne doit pas violer). Toutes les réponses sont facultatives et modifiables ; chaque réponse est enregistrée en passant à la suivante ; « Plus tard » ferme sans rien perdre et le rappel ne revient plus pendant la session. La question « pure fiction, faits réels ou biographie ? » n'est posée que pour un roman. Le Co-pilote lit ces réponses comme ligne de conduite du livre. **Une fois la base terminée**, un écran propose des suites facultatives : « Pour affiner le projet » (6 questions : ce qui doit primer, lecteur non visé, niveau de langage, audace, énergie émotionnelle, malentendus à éviter) et, si le livre évoque des personnes réelles (témoignage, récit de vie, « faits réels », (auto)biographie), « Personnes réelles et précautions » (3 questions : personne identifiable, noms réels ou pseudonymes, risques juridiques — ce n'est pas un avis juridique). Le bouton « 🧭 Questionnaire de démarrage » rouvre cet écran.
- **Rechercher / remplacer** (Ctrl+F / Ctrl+H, ruban Accueil › Édition) — dans le chapitre ou « Tout le livre » ; casse, mot entier, accents. Cherche aussi les titres et les notes de bas de page. Volets Titres / Pages / Résultats avec total ; **les pages sont estimées** (pas de vraie pagination avant l'export). Chaque chapitre modifié est d'abord sauvegardé dans l'historique ; les titres n'ont pas d'historique (la confirmation montre avant → après).
- **🧹 Nettoyage mécanique** — typographie (points de suspension, espaces…) et repères de répétitions, sans IA ; Ctrl+Z annule ; instantané dans l'historique avant application.
- **↺ Historique** — instantanés aussi toutes les 5 min ; « Restaurer » sauvegarde d'abord le texte actuel.
- **📷 Lire une photo** — photographier une page papier → transcription fidèle (rien n'est corrigé) à relire avant insertion ; la photo n'est pas conservée.
- **Dictée vocale** — convertie avant envoi ; si une dictée échoue, réessayer.
- **Lecture à voix haute** — voix, vitesse, quota mensuel de caractères selon le palier (solde affiché dans l'en-tête).
- **Sur téléphone** — en-tête sur une ligne, menu « ⋯ » pour les actions, barre d'outils réduite + « Plus ▾ », Co-pilote en plein écran via le bouton flottant.
- **📊 Dossier de création** (vue projet) — document Word : dates, mots par jour, usage des outils d'IA. Indice de processus, pas une preuve juridique.

### Les IA
- **💬 Question rapide** (Ctrl+K, bouton Aide) — poser une question sans quitter le texte ; choix du modèle, de l'effort et du style ; « De mémoire » (à vérifier) ou « Avec sources ». Le chapitre n'est pas envoyé, seulement la sélection si vous le cochez. Un réglage recommandé est proposé et appliqué d'office.
- **✨ Correction rapide** — fautes seulement ou fautes + fluidité, revue carte par carte, un seul Ctrl+Z pour tout annuler ; bilan de relecture (signale, ne tranche pas).
- **🔎 Vérifier le fond** — avis de lecture (« est-ce que ça tient la route ? ») ; ne modifie jamais le texte ; propose parfois un remplacement copiable ou insérable.
- **« Vérifier les faits »** — recherche web, sources, calculs refaits ; « confirmé » = une source réelle existe, à lire soi-même.
- **📊 Profil de lisibilité** — lecture seule ; trop court (< 5 paragraphes) = pas d'orientation.
- **Co-pilote** — 🧭 *Guide directif* (directive visible et modifiable avant envoi), *Aide-moi à avancer*, chapitre précédent et plan du livre joints, « 💾 Mémoriser cette intention » en deux temps (relecture avant enregistrement). Il analyse le texte, pas la personne.
- **Scènes intimes** — l'IA conseille sans moraliser ; si elle décline d'écrire une scène explicite, un bandeau le dit : demander un avis plutôt qu'une réécriture.
- **❓ Aide** — « Pointer un bouton » pour savoir à quoi il sert ; proposer une réponse utile à la liste commune.

### Détente
- **Jeux de mots** (menu) — Scrabble (solveur, outils, partie contre l'ordinateur au doigt), Motus, Pendu, Boggle, Mots croisés/fléchés/codés, Mots en cercle, Échelle, Mots mêlés, Devine le livre, Quel lecteur es-tu ?, Au palmarès.
- **🧘 Pauses bien-être** — rappel discret après un long moment d'écriture (réglable, désactivable) ; mouvements doux, pas un avis médical.

## Déjà intégré

*(rien pour l'instant)*

## Exporter le questionnaire de démarrage (01/11/2026)
Où : 🧭 Questionnaire de démarrage → écran « Le questionnaire de base est enregistré » → carte « 📄 Exporter mes réponses ». Trois sorties : Word (.docx, questions + réponses par série, personnes en puces), copie du texte, sauvegarde .json. Les séries non commencées sont omises. Le document peut servir de pièce jointe pour CursAudit (pas d'import automatique).

## Questionnaire de démarrage : plusieurs réponses + « Autre » (01/11/2026)
Énergie émotionnelle (Q020), risques juridiques (Q019) et ton (Q010) acceptent plusieurs réponses. Sur les autres questions à choix, le champ « Autre (précisez) » s'ajoute au choix coché au lieu de l'effacer. L'export les présente en puces.

## Co-pilote : « la partie que j'ai marquée » (01/11/2026)
Dans la discussion avec le Co-pilote, le passage marqué avec le surlignage gris (bouton loupe de l'éditeur) est maintenant transmis : on peut écrire « reconstruis le dialogue de la partie marquée ». Sans marquage gris dans le chapitre, le Co-pilote le dit au lieu de deviner.
