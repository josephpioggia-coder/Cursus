# Cursus — Route vers le lancement, "Cursus Management" et l'international (19/10/2026)

Document demandé par Joseph le 19/10/2026, suite à trois questions posées
ensemble : (1) que reste-t-il pour lancer commercialement ? (2) faut-il
envisager "Cursus Management" (avec des outils comme CursDecision) avant
de démarcher CEDEC (Espagne, centaines de clients potentiels) ? (3) que
représenterait une version espagnole de Cursus ? Les trois sont liées
dans l'intention de Joseph (se présenter à CEDEC avec une offre élargie
et internationale) mais sont trois chantiers de nature différente —
traités séparément ci-dessous, avec une recommandation d'ordre à la fin.

Tout ce qui suit a été vérifié par lecture directe du code au moment de
la rédaction (19/10/2026), pas par mémoire de ce qui a été dit dans des
sessions précédentes.

---

## 1. Ce qu'il reste pour le lancement commercial (CursEdit/CursAudit)

Reprend l'audit de préparation à la commercialisation du 17/10/2026
(CLAUDE.md) — rien de nouveau trouvé ici, seulement consolidé avec les
points déjà en liste d'attente.

### Bloquant, confirmé directement avec Joseph le 17/10/2026

1. **Stripe toujours en mode TEST.** Compte pas encore vérifié pour de
   vrais paiements (KYC/coordonnées bancaires — démarche sur le
   dashboard Stripe, rien que du code ne peut faire). Avant bascule en
   live : vérifier le compte, recréer les Prix en mode live (catalogue
   séparé du mode test malgré des ID de forme identique), mettre à jour
   `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` (secrets Supabase) ET
   synchroniser les deux mappings price_id → palier :
   `prix-stripe-config.mjs` (client) et `PALIERS` dans
   `stripe-webhook/index.ts` (serveur).
2. **Structure juridique en suspens.** `PagesLegales.jsx` utilise
   "HMS-i SA", explicitement marqué provisoire le 14/09/2026 ("une
   nouvelle entité à créer sous un mois") — délai dépassé de plus d'un
   mois au 19/10/2026. `IDENTITE_EDITEUR` est le seul endroit à modifier
   une fois tranché. Relecture par un avocat recommandée par les pages
   elles-mêmes, pas faite.

### Migrations SQL en attente d'exécution par Joseph (vérifié aujourd'hui, toujours non exécutées à ma connaissance)

- `2026-10-17-audit-sections-images.sql` — sans elle, les images d'un
  .docx importé dans CursAudit ne sont pas stockées (le code qui les lit
  est en place, la colonne qui les reçoit non).
- `2026-10-17-usage-voix.sql` — sans elle, le suivi de consommation
  voix (lecture à voix haute, dictée) ne s'enregistre pas (échoue
  silencieusement, n'empêche pas la fonctionnalité).
- `2026-09-30-parties-jeu-de-mots.sql` — plus ancienne, statut non
  revérifié dans cette passe ; à confirmer avec Joseph plutôt que
  supposer qu'elle est passée.

### Gaps connus, non corrigés, à décider

- `transcrire-audio` ne vérifie **aucun** abonnement actif,
  contrairement à `lire-texte` — tout compte authentifié peut
  l'utiliser gratuitement. Gap d'accès, pas de suivi — à traiter
  séparément si Joseph le confirme.
- Réserve juridique sur les données Edistat (`palmares.json`, 200
  lignes servies publiquement) — service commercial, conditions
  d'usage à vérifier avant un usage commercial large de Cursus.
- "Layer 2" de vérification (lire soi-même la page confirmée pour
  valider la citation exacte, pas seulement l'existence de l'URL) —
  ni pour les Références de CopiloteIA, ni pour `verification-deux-ia`.
- Les synthèses CursAudit (pré-audit global, synthèse détaillée, fiche
  d'action) ne relisent jamais le texte source — limite d'architecture
  documentée, pas corrigée.
- CursAuditDetail.jsx et CursAuditListe.jsx non revérifiés sur mobile
  (seulement une lecture statique du code, pas de test réel).

### Déjà fait, pas un chantier

- Bug de redirection post-paiement (`cursus-seven.vercel.app` au lieu
  de `cursus.pro`) — corrigé le 17/10/2026.
- Le pipeline Stripe lui-même (checkout, webhook, anti-fraude,
  anti-doublon, codes promo) est mature, pas à reconstruire.
- Les 3 pages légales existent déjà en détail (droit belge).

**Conclusion de cette section** : le lancement commercial de CursEdit/
CursAudit dépend de DEUX décisions qui ne sont pas du code (compte
Stripe vérifié, structure juridique tranchée) plus quelques migrations
à exécuter — pas d'un nouveau développement.

---

## 2. "Cursus Management" — piste à définir, pas encore un chantier

Joseph envisage d'y inclure "des outils comme CursDecision". Point
important à ne pas perdre de vue : **CursDecision n'a aujourd'hui
AUCUNE fonctionnalité réelle.** Vérifié à l'instant :
`CursDecisionPage.jsx` (174 lignes) ne contient ni `useState`, ni appel
IA, ni appel Supabase — c'est une page marketing seule, zéro backend
(déjà noté dans `docs/liste-attente.md` #5 le 24/09/2026, toujours vrai
aujourd'hui). "Mettre en place CursDecision avant CEDEC" veut donc dire
le construire depuis zéro, pas l'étoffer.

**Risque à nommer explicitement avant d'aller plus loin** : cette même
session, un GPT externe a mélangé CursAudit (l'outil Cursus réel,
textuel, pour manuscrits) avec le travail de conseil de Joseph (361°+i,
SYNERGY CIRCLES, diagnostic de PME) — voir CLAUDE.md, échange du
11/10/2026 sur la carte Machine Learning. "Cursus Management" porte le
même risque de confusion : s'agit-il (a) d'outils de décision
ÉDITORIALE pour un·e auteur·ice (dans la continuité de CursEdit/
CursAudit), ou (b) d'un outil de diagnostic ORGANISATIONNEL pour des
entreprises/consultants (plus proche de 361°+i) ? Les deux sont
légitimes mais ce sont deux produits différents, avec des utilisateurs,
des données et une vente différents. CEDEC (centaines de clients,
contexte B2B/consulting à ce que j'en comprends) pousse plutôt vers (b)
— mais ce n'est pas tranché ici, c'est une vraie question pour Joseph
avant tout code.

**TRANCHÉ le 19/10/2026, même jour** : Joseph opte pour (b) —
"Cursus Management" comme ligne de produit PARALLÈLE à CursEdit/
CursAudit (pas un sous-ensemble), avec CursDecision comme son premier
outil, destiné aux **dirigeants d'entreprise**, pas aux auteur·ices.
Déclencheur immédiat : la pertinence perçue du cadre MIT CISR "AI
Decision Matrix" (Sebastian/Weill/Haskamp/vom Brocke, juin 2026 —
citation vérifiée réelle) pour CursDecision, qui est lui-même un cadre
de gouvernance IA EN ENTREPRISE (décisions organisationnelles,
plusieurs agents IA, risque à l'échelle d'une structure) — cohérent
avec le choix (b), pas avec (a).

**Implications concrètes de ce choix, pas encore traitées** :
- CEDEC devient le canal naturel pour Cursus Management/CursDecision
  spécifiquement, pas pour CursEdit/CursAudit — si l'espagnol (section
  3) est priorisé pour cette approche, il devrait porter d'abord sur
  Cursus Management, pas sur l'ensemble du produit.
- CursDecision repart de zéro (toujours aucun backend) mais maintenant
  avec un public et un cas d'usage CLAIRS (aide à la décision pour
  dirigeant·es, à la MIT CISR) — ce qui change concrètement ce qu'il y
  a à construire par rapport à un outil de décision éditoriale.
- Reste à définir avant tout code : quelles données un·e dirigeant·e
  fournirait (pas un manuscrit — des données d'entreprise, au moins en
  partie confidentielles/sensibles, implications RGPD/sécurité
  différentes de CursEdit/CursAudit), et si Cursus Management partage
  l'infrastructure actuelle (comptes, Stripe, Supabase) ou en a besoin
  d'une séparée.
- "Cursus Management" en parallèle de CursEdit/CursAudit soulève une
  question de marque/présentation : la page d'accueil, le ton, l'identité
  visuelle actuels de Cursus sont pensés pour des auteur·ices — à
  valider si ça convient aussi pour viser des dirigeant·es, ou si Cursus
  Management a besoin de sa propre vitrine au sein du même compte.

**Lien avec la liste d'attente #6** (vitrine publique auteur·ices,
ajoutée aujourd'hui suite à l'exemple Notion) : cette idée-là est plus
clairement dans la continuité de CursEdit — une étape "publication"
après l'écriture — pas un outil de management. À garder distincte de
"Cursus Management" plutôt que de les fondre, pour ne pas recréer la
confusion qu'on vient de nommer.

**Rien à construire dans cette section avant que Joseph n'ait tranché**
la question (a) vs (b) ci-dessus — un backend CursDecision construit
dans la mauvaise direction serait à refaire.

---

## 3. Localisation espagnole — évaluation technique honnête

Vérifié dans le code aujourd'hui, pas supposé :

### Ce qui existe déjà (réutilisable)

- `i18next` est en place, langue **par projet** (pas par compte,
  `src/i18n/index.js`), avec 5 fichiers de traduction par langue
  (`common`, `editeur`, `copilote`, `adn`, `paliers` —
  `src/i18n/locales/{fr,en}/*.json`). Ajouter `es/*.json` suit le même
  moule, pas une nouvelle architecture.
- Volume raisonnable : ~630 lignes cumulées entre `fr` et `en`
  aujourd'hui — traduction mécanique faisable, mais le fichier
  `copilote` a 12 groupes de clés en français contre 24 en anglais : à
  auditer AVANT de s'en servir de base pour l'espagnol, l'anglais n'est
  peut-être pas lui-même complet.
- `CopiloteIA.jsx` a déjà un patron réutilisable pour piloter la LANGUE
  DE SORTIE de l'IA (`INSTRUCTION_LANGUE[langueProjet]`, et le biais
  linguistique des références qui bascule déjà sur `langueProjet`) — un
  modèle direct pour brancher l'espagnol côté client.

### Ce qui n'existe PAS du tout (pas une traduction, un vrai chantier)

- **Les pages légales (`PagesLegales.jsx`, 299 lignes) ne passent par
  AUCUN mécanisme de traduction** — zéro appel à `t()`, texte français
  codé en dur. Les traduire n'est pas qu'un exercice linguistique : CGV/
  mentions légales/politique de confidentialité touchent potentiellement
  à un droit différent selon le pays visé — relecture juridique
  nécessaire, pas seulement une traduction, comme pour la version
  française elle-même (jamais relue par un avocat non plus, voir
  section 1).
- **Aucune des fonctions serveur de CursAudit ne gère la langue.**
  Vérifié : sur l'ensemble des fonctions Edge du dépôt, seule
  `transcrire-audio` connaît un paramètre de langue.
  `orchestrer-audit-cursaudit`, `analyser-unite-cursaudit`,
  `preaudit-approfondi-cursaudit`, `preaudit-global-cursaudit`,
  `synthese-audit-detaille-cursaudit`,
  `synthetiser-question-cursaudit`, `fiche-action-preaudit-cursaudit`,
  `verification-deux-ia`, `extraire-profil-cursus` — les 9 fonctions
  déjà touchées une fois ensemble pour le correctif `thinking` du
  01/10/2026 — n'ont AUCUN moyen de produire une sortie en espagnol
  aujourd'hui. Ce n'est pas un fichier de traduction à ajouter : c'est
  un paramètre à faire voyager dans tout le pipeline CursAudit et dans
  chaque prompt, un chantier du même ordre de grandeur que le correctif
  `thinking`.
- Les jeux de mots (Scrabble, mots croisés...) reposent sur un
  dictionnaire français — hors sujet pour une offre CEDEC centrée sur
  CursEdit/CursAudit/CursDecision, sauf si Joseph veut spécifiquement
  les inclure.

### Conclusion de cette section

"Pas tout retravail" est vrai pour l'interface (le moule i18next existe)
et pour le patron de prompt côté client — mais c'est trois chantiers
réels et distincts, pas un seul :
1. Traduction mécanique de l'interface (volume modéré, mais vérifier
   d'abord que l'anglais est lui-même complet).
2. Pages légales : traduction + relecture juridique par pays, pas
   juste linguistique.
3. Langue de sortie de l'IA dans les 9 fonctions serveur de CursAudit :
   absente aujourd'hui, à construire, pas à traduire.

---

## Recommandation d'ordre

Les trois chantiers ne dépendent pas les uns des autres techniquement,
mais la logique commerciale pousse à cet ordre :

1. **Lancement commercial (section 1)** — deux décisions non-techniques
   de Joseph (Stripe live, structure juridique) bloquent toute vente
   réelle, espagnole ou non. Rien ne sert de démarcher CEDEC sans
   pouvoir facturer légalement.
2. **Trancher "Cursus Management" (section 2)** — une question de
   positionnement pour Joseph, pas de code, avant d'écrire la moindre
   ligne de CursDecision : à qui ce produit s'adresse-t-il réellement ?
3. **Espagnol (section 3)** — le dernier des trois, et le plus
   mécanique une fois les deux premiers tranchés ; peut être scopé plus
   précisément (juste l'UI ? juste CursEdit sans CursAudit au début ?)
   une fois qu'on sait concrètement ce qu'on propose à CEDEC.
