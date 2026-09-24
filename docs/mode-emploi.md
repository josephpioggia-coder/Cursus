# Cursus — Mode d'emploi

*À l'usage de l'auteur·ice. Dernière mise à jour : 24/09/2026.*

Ce document explique ce que fait réellement Cursus aujourd'hui — pas ce qui est prévu ou en projet. S'il manque une fonctionnalité que vous attendiez, c'est qu'elle n'existe pas encore ; dites-le, ça permet de savoir ce qui compte vraiment pour la suite.

Cursus s'articule autour de trois espaces, débloqués progressivement selon votre palier d'abonnement : **CursEdit** (écrire), **CursAudit** (auditer un texte déjà écrit) et **CursDecision** (pas encore construit — page de présentation seulement pour l'instant).

---

## 1. CursEdit — l'espace d'écriture

### Structurer un projet

Un projet se compose de **parties** et de **chapitres**, organisés dans la colonne de gauche. Vous pouvez créer, renommer et réorganiser cette structure librement. Chaque chapitre contient son propre texte, sauvegardé automatiquement toutes les 30 secondes (un indicateur en haut de l'éditeur confirme "Sauvegardé").

### Mettre en forme le texte

La barre d'outils au-dessus de l'éditeur propose :
- **Titres** (H1 à H6), **gras**, *italique*, souligné
- **Couleur du texte** — bouton "A" avec une barre colorée : 5 teintes, plus un retour à la couleur par défaut
- **Surlignage** — bouton crayon 🖍️ : 5 teintes de fond, plus un retrait
- **Surligneur pour analyses** — bouton loupe 🔍, *distinct* de la palette de surlignage ci-dessus : un clic marque le passage sélectionné d'une couleur grise dédiée, réservée à un seul usage — voir plus bas, "Trier ce qui doit être analysé"
- Listes à puces et numérotées, citation, séparateur

### Insérer une image

Le bouton 🖼️ dans la barre d'outils ouvre un sélecteur de fichier (JPG, PNG, GIF, WEBP, BMP, HEIC — 8 Mo maximum). L'image s'insère directement dans le texte, à l'endroit du curseur.

### Importer un fichier Word

Dans un projet, "Importer un fichier Word" lit un fichier `.docx` et recrée automatiquement la structure de parties/chapitres à partir des styles de titre Word (Titre 1 pour les parties, Titre 2 pour les chapitres — réglable). Les images intégrées au document Word sont également importées et insérées aux bons endroits.

**Point d'attention réel** : l'import se base sur le *style* Word réellement appliqué à chaque titre, pas sur son apparence visuelle. Un titre mis en gras/italique à la main sans lui appliquer le style "Titre 1" ou "Titre 2" via le volet Styles de Word ne sera pas reconnu comme un titre, même s'il en a l'air. En cas de titre manquant après import, vérifiez dans Word le style exact du paragraphe concerné.

### Dictée vocale

Le bouton 🎙 enregistre votre voix, la transcrit, puis affiche le texte dans un champ de relecture **avant** toute insertion — la transcription n'est jamais ajoutée automatiquement, pour permettre de corriger une éventuelle erreur de reconnaissance. Si le micro ne capte aucun son (mauvais périphérique sélectionné, coupé), un message clair l'indique plutôt que d'insérer un texte incohérent.

### Mode focus (F11)

Masque tout sauf le texte en cours d'écriture, pour une écriture sans distraction.

### Historique des versions

Chaque sauvegarde est conservée, datée, consultable à tout moment — rien n'est jamais définitivement perdu.

### Objectifs de session

Un objectif de mots ou de temps peut être fixé par séance d'écriture, avec un minuteur.

---

## 2. Le Co-pilote IA

Le panneau à droite de l'éditeur. Cinq onglets :

| Onglet | Rôle |
|---|---|
| **Suggestions** | Propositions contextuelles sur le passage analysé |
| **Personnages** | Repère les personnages mentionnés, leur cohérence |
| **Références** | Recherche et vérifie des références bibliographiques (recherche web réelle, pas une invention) |
| **Cohérence** | Signale les incohérences internes, répétitions, glissements |
| **Vérification** | Vérifie une affirmation précise du texte en croisant **deux IA** (Claude et GPT), qui se corrigent mutuellement |

### Choisir ce qui est analysé

Trois sources possibles, un sélecteur apparaît selon le contexte :
- **Sélection** — le texte que vous venez de surligner à la souris
- **Chapitre entier** — tout le chapitre ouvert
- **🔍 Surligné** — uniquement les passages marqués avec le surligneur gris dédié (voir plus haut), pratique pour trier ce qui doit être analysé dans un texte long sans tout sélectionner à chaque fois

### Aide-moi à avancer

Toujours disponible, quel que soit l'onglet actif. Pose un diagnostic sur un blocage d'écriture, puis propose 5 formes d'aide au choix : *Questionne-moi*, *Donne-moi des pistes*, *Construis la scène avec moi*, *Propose-moi un exemple*, *Surprends-moi*. Aucune n'écrit le texte à votre place sans que vous l'ayez explicitement demandé.

### Conseils de recomposition (chapitre entier)

Analyse un chapitre entier même au-delà de 8000 caractères, en le découpant en tranches qui se chevauchent — sans jamais résumer le texte source. Indépendant du sélecteur Sélection/Chapitre/Surligné : toujours le chapitre entier.

### Mode Auto

Relance l'analyse de l'onglet actif toutes les 10 minutes automatiquement (sauf l'onglet Vérification, jamais automatique).

### Mémoire narrative

Depuis une carte de suggestion, "Mémoriser cette intention" garde une note courte associée au projet, réutilisée dans les analyses suivantes. Consultable et modifiable via "Voir la mémoire".

### Dialoguer avec le co-pilote

Chaque carte de résultat peut ouvrir un fil de discussion pour creuser un point précis. Les fils sont sauvegardés et retrouvés à la réouverture du chapitre.

### Les images

Le Co-pilote **voit réellement le contenu** des images insérées dans le chapitre (pas seulement leur présence) — dans les 4 onglets principaux, "Aide-moi à avancer" et les fils de dialogue. Jusqu'à 3 images par appel. Exception : "Conseils de recomposition" ne les distingue pas par tranche (les mêmes images sont jointes à chaque tranche), et l'onglet Vérification ne les voit pas du tout.

### Une précaution à garder en tête

Le Co-pilote fait des recherches et donne des références réelles, mais reste une IA : même après double vérification, une erreur reste possible. Un rappel permanent est affiché en bas du panneau — vérifiez toujours avant usage, en particulier une affirmation factuelle ou une référence citée.

### Le quota de tokens

Chaque palier d'abonnement inclut un quota mensuel de tokens IA (visible en haut du panneau, avec une jauge). Il se renouvelle le 1er de chaque mois. Au-delà, les analyses sont mises en pause jusqu'au renouvellement, ou un crédit ponctuel peut être ajouté.

---

## 3. CursAudit — l'espace d'audit critique

Différent du Co-pilote : CursAudit **audite un texte déjà écrit**, plutôt que d'accompagner l'écriture en cours. Il s'utilise depuis un espace séparé, pas depuis l'éditeur.

### Créer un audit

Deux sources : coller le texte directement, ou importer un fichier `.docx` (pas de PDF pour l'instant). Un questionnaire précède l'analyse : type de texte, statut, question d'audit, degré d'intervention souhaité.

### Les critères

Une grille de critères note le texte : cohérence interne, niveau de preuve des affirmations, généralisations abusives, glissements de registre, etc. Aujourd'hui, seul le palier **Essentiel** (8 critères) est proposé — Approfondi et Expert sont temporairement retirés le temps de recalibrer leur coût réel.

### Mode 1 IA / 2 IA

Le mode "2 IA" fait relire chaque unité par un second modèle (GPT), qui signale ses désaccords avec la première analyse (Claude) — limité aux parties conclusives de chaque chapitre pour un coût maîtrisé.

### Limite réelle à connaître

**CursAudit ne voit aucune image.** Le texte importé est segmenté en unités de texte brut avant analyse — contrairement au Co-pilote de CursEdit, aucune image n'est extraite ni transmise à l'IA ici. Un rappel apparaît directement sur l'écran de création d'un audit. Pour une analyse qui tient compte d'images, utilisez le Co-pilote dans CursEdit.

---

## 4. Abonnement et accès

### Les paliers

Cinq paliers CursEdit, cumulatifs : chaque palier supérieur inclut tout ce que propose le précédent, et débloque progressivement CursAudit (dès Essentiel) puis CursDecision (dès Initié).

### En cas d'annulation

Conformément aux CGV (article 6) : l'accès aux fonctionnalités IA s'arrête immédiatement, mais vos textes restent consultables en **lecture seule pendant 3 mois** — aucune modification, import ni création n'est possible sans réabonnement. Passé ce délai, l'accès est totalement suspendu.

---

## Besoin d'aide ?

Les pages Mentions légales, CGV et Politique de confidentialité sont accessibles depuis l'écran de connexion. Pour toute autre question, contactez le support via l'adresse indiquée sur ces pages.
