# Liste de lancement de Cursus

Mise à jour : 9 novembre 2026.
Légende : ✅ fait · ⬜ à faire · ❓ à vérifier (je ne peux pas le voir depuis ici) · 👤 toi · 🤖 moi.

Les phases peuvent avancer en parallèle, sauf indication « bloque ».

---

## Phase 0 — Mettre le produit en ordre (👤)

À faire avant toute annonce publique.

### 0.1 Base de données Supabase (éditeur SQL)
Les scripts sont à la racine du dépôt. Tous sont répétables sans risque.

- ❓ `2026-09-30-parties-jeu-de-mots.sql` : sauvegarde des parties de jeu
- ❓ `2026-10-17-audit-sections-images.sql` : images lues par CursAudit
- ❓ `2026-10-17-usage-voix.sql` : suivi de la consommation voix
- ❓ `2026-10-22-quota-voix.sql` : quotas voix par palier
- ❓ `2026-10-24-usage-ia-projet.sql` : registre d'usage de l'IA par livre
- ❓ `2026-10-25-directives-copilote.sql` puis `2026-10-28-directives-copilote-rls.sql` : Guide directif (une erreur « row-level security » avait été vue)
- ❓ `2026-10-28-TOUT-EN-UN.sql` : styles du projet, registre des modèles d'IA, réglage de l'assistant (regroupe 3 scripts)
- ❓ `2026-10-28-aide-faq.sql` : liste d'aide validée

### 0.2 Fonctions Supabase à redéployer
- ❓ `creer-session-checkout` et `stripe-webhook` (paiement : adresse verrouillée sur le compte, codes à 100 %)
- ❓ `claude-prox` (quota pondéré par modèle, secours de modèle)
- ❓ `lire-texte` et `transcrire-audio` (quota voix, dictée)
- ❓ `admin-usage-voix` (nouvelle fonction)
- ❓ Fonctions d'audit modifiées pour les images : `orchestrer-audit-cursaudit`, `analyser-unite-cursaudit`

### 0.3 Connexion et e-mails
- ⬜ Supabase › Authentication › URL Configuration : adresse du site `https://cursus.pro` ; redirections `https://cursus.pro/**` et `https://www.cursus.pro/**`
- ⬜ Traduire le modèle d'e-mail « Confirmer l'inscription » (il est en anglais)
- ⬜ Vérifier que l'adresse de contact `infocursus.proia@gmail.com` (celle de l'offre aux auteurs) reçoit bien les messages

### 0.4 Test de bout en bout
- ⬜ Créer un compte avec une adresse neuve : inscription, e-mail de confirmation, code promo, entrée dans CursEdit
- ⬜ Vérifier sur cursus.pro (rechargement forcé) la page de connexion : présentation, cartouche « Lire pour traverser », encadré d'offre, aide Æncre sous le formulaire

---

## Phase 1 — Cadre juridique et paiement (👤, bloque l'encaissement réel)

- ⬜ Choisir la forme (SRL a priori ; une ASBL convient mal à une activité commerciale) et constituer la société
- ⬜ 🤖 Me donner la raison sociale définitive : je mets à jour `IDENTITE_EDITEUR` et les pages légales
- ⬜ Faire relire par un avocat : CGV, mentions légales, politique de confidentialité (la politique contient une promesse sur l'IA : « Cursus n'entraîne pas de modèle avec vos contenus »)
- ⬜ Vérifier dans tes comptes Anthropic et OpenAI les réglages de conservation et d'entraînement
- ⬜ Stripe : vérification du compte, nouveaux prix en mode réel, mise à jour des clés secrètes et des deux tableaux prix ↔ palier (client et serveur)
- ⬜ Conditions d'hébergement de la vitrine (droits sur les couvertures, retrait sur demande) : à valider avec l'avocat avant d'ouvrir au public

L'offre gratuite d'un mois n'a pas besoin de la phase 1 pour démarrer.

---

## Phase 2 — Offre de lancement

- ✅ Décision : un mois d'accès Initié en bêta, **30 places**, nouveaux auteurs dont la fiche est validée, une offre par adresse e-mail
- ✅ Offre visible sur la page de connexion et dans le dossier
- ⬜ 👤 Pour chaque auteur validé : créer un code promo à 100 % sur un mois, limité à son e-mail, dans Administration
- ⬜ 🤖 Décompte réel des places restantes (aujourd'hui, à la main)
- ⬜ 👤 Mesurer le coût moyen d'un auteur offert (requêtes IA, voix) avant d'étendre au-delà de 30
- ⬜ 👤 Décider ce qui se passe à la fin du mois offert (abonnement à choisir, accès en lecture seule…)

---

## Phase 3 — Présence publique et recrutement (👤, textes de moi)

- ⬜ Créer la page LinkedIn « Cursus » depuis ton vrai profil (pas un profil sous pseudonyme)
- ⬜ Y mettre le texte de présentation et le premier message (déjà rédigés)
- ⬜ Repérer tes relations ayant publié un livre en 2026, y compris les auteurs qui t'ont dédicacé le leur
- ⬜ Envoyer le message personnalisé, puis la fiche à remplir
- ⬜ Tenir le tableau de suivi : nom, titre, thème, réponse, date de consentement, mode de création déclaré, lien d'achat
- ⬜ Garder la réponse écrite de chaque auteur (« J'autorise ») comme preuve
- ⬜ Envoyer à Fnac Belgique le message de demande (flux produit, autorisation de citer leurs sélections) : pas encore envoyé

---

## Phase 4 — Construction (🤖)

- ✅ Page de connexion comme accueil, avec dossier thématique et offre
- ✅ Dossier « Lire pour traverser » (15 livres) et jeu du même nom
- ✅ Vitrine des auteurs partenaires : structure prête, **vide**, une fiche n'apparaît qu'avec une date de consentement
- ⬜ Ajouter les fiches des auteurs, une par une, dès réception de leur accord (fiche remplie, couverture, date)
- ✅ Fiche à remplir en ligne ou à télécharger (Word) : elle part par e-mail, rien n'est envoyé par le site
- ⬜ Dépôt de fiche directement sur le site (table Supabase + validation dans Administration), code promo créé à la validation
- ⬜ Liste par thèmes quand il y a assez de fiches
- ⬜ Autres dossiers thématiques
- ⬜ Nouvelle présentation en néerlandais et en anglais (l'accueil est en français seulement)

---

## Phase 5 — Documentation

- ✅ 🤖 « Démarrer en 5 minutes » pour une débutante (début du mode d'emploi, 09/11/2026)
- ✅ 🤖 Nouveautés intégrées au mode d'emploi (section 6) ; ⬜ 👤 relire le mode d'emploi dans l'appli et me dire ce qui sonne faux (chaque fonction est à revérifier : voir `docs/a-integrer-au-mode-emploi.md`)

---

## Phase 6 — Ouverture

- ⬜ Seuil conseillé : une vingtaine de fiches d'auteurs validées et quelques thèmes bien remplis
- ⬜ Annonce sur LinkedIn
- ⬜ Suivre : coût réel des mois offerts, messages des auteurs, Journal des erreurs, retours sur mobile

---

## Points ouverts et risques

- **Sélection de livres du dossier** : les 13 premiers titres suivent une sélection éditoriale lue sur Fnac.be (faits seulement, textes réécrits) ; deux livres de la liste du jeu ont été ajoutés. Pour une page publique, ajouter des livres de ton choix est plus prudent.
- **Jeu « Au palmarès »** : caché, données de la semaine 39 non mises à jour, fichier Edistat retiré du site (il reste dans l'historique du dépôt). Pour le réactiver : une source autorisée et à jour.
- **Mentions « mode de création »** des auteurs : déclarées par eux, Cursus ne les vérifie pas.
- **Non testé en conditions réelles** (ce que je ne peux pas faire d'ici) : application complète avec ton vrai Supabase, téléphone réel, appels d'IA réels pour la plupart des outils récents, paiement Stripe réel.
- **Cause non confirmée** : le lien de confirmation d'Annie qui « ne s'ouvrait pas » (probablement l'adresse du site dans Supabase, voir 0.3).
