# TVA des ventes hors Belgique : guichet unique (OSS) — fiche de préparation

Rédigée le 15 novembre 2026 pour Joseph. **Ce n'est pas un avis fiscal** : elle prépare la démarche et liste ce qu'il faut décider ou fournir.
Aucune déclaration ne peut être faite depuis Cursus ni par Claude : l'inscription se fait par le représentant légal de la société sur le portail officiel
du SPF Finances. Les points marqués ⚠ sont à vérifier sur finances.belgium.be (les règles et seuils évoluent).

## 1. De quoi s'agit-il ?
Cursus vend un service numérique (abonnements, audits). Pour un client **particulier** (B2C) installé dans un autre pays de l'UE, la TVA due est
celle **du pays du client** (ex. 19 % en Allemagne, 20 % en France), pas la belge (21 %). Le guichet unique « OSS » (régime de l'Union) permet de déclarer et
payer toute cette TVA européenne **en un seul endroit, en Belgique**, au lieu de s'enregistrer dans chaque pays.
- ⚠ Seuil européen : tant que le total des ventes B2C à d'autres pays de l'UE reste sous **10 000 € par an**, on peut appliquer la TVA belge à tous
  (et ne pas utiliser l'OSS). Au-delà, la TVA du pays du client s'applique dès la vente qui dépasse le seuil.
- **Client entreprise (B2B)** avec un numéro de TVA européen valide : pas de TVA belge, c'est le client qui l'autoliquide (Stripe Tax le gère si le numéro
  est saisi à la commande). Ces ventes figurent dans la déclaration de ventes intracommunautaires (listing) gérée avec le comptable.

## 2. Prérequis
- La **société existe** et possède un **numéro de TVA belge** (inscription à la BCE). Tant que la structure n'est pas constituée, l'inscription OSS est impossible.
- Savoir quel prestataire/outil tient la comptabilité et dépose les déclarations de TVA périodiques.

## 3. Démarche (⚠ à confirmer sur le portail)
1. Se connecter au portail du SPF Finances (MyMinfin) avec la carte d'identité du représentant légal.
2. Demander l'inscription au **régime de l'Union du guichet unique (OSS)** pour les prestations de services aux particuliers de l'UE.
3. Ensuite : une **déclaration OSS par trimestre** (ventes par pays et taux de TVA) et un **paiement unique** de toute la TVA européenne due.
4. Conserver les justificatifs de localisation du client (adresse de facturation, pays de la carte, adresse IP) : Stripe Tax les enregistre, mais la responsabilité reste la vôtre.

## 4. Côté Stripe (à faire une fois l'OSS accepté)
- Stripe › Tax › Paramètres : adresse de l'entreprise, comportement fiscal par défaut « **hors taxe** » (les prix de Cursus sont hors TVA).
- Stripe › Tax › Enregistrements : ajouter **Belgique** et **Union OSS** (le numéro d'enregistrement donné par le SPF Finances).
- Catégorie de produit : service numérique / logiciel en ligne (SaaS).
- Puis, dans Supabase, le secret `STRIPE_TAX_ACTIF` = `oui` (voir CLAUDE.md, « TVA par pays »).
- **Frais** : Stripe Tax est facturé par Stripe (pourcentage par transaction ou frais fixe, ⚠ à lire dans leur grille tarifaire). Ce coût vaut aussi pour les
  ventes belges dès que Stripe calcule leur TVA.

## 5. Hors UE (Royaume-Uni, Suisse, États-Unis, etc.)
Chaque pays a ses propres seuils d'enregistrement. Tant qu'aucun seuil n'est atteint, rien n'est dû localement. À surveiller : si les ventes dans un pays hors UE
grossissent, revoir la question (ou limiter la vente à l'UE). Stripe Tax signale quand un seuil approche.

## 6. Ce qu'il faut décider
- Vendre aux particuliers de toute l'UE dès le départ (OSS) ou rester sous le seuil de 10 000 € avec la TVA belge pour tous ?
- Vendre hors UE, oui ou non ?
- Qui dépose la déclaration trimestrielle : la société ou son comptable ?
