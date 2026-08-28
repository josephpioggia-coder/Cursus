# Cursus / CursAudit — Paquet de reprise autonome

Document préparé le 27/08/2026. Autonome : ne suppose aucun accès à cette
session Claude Code ni à aucune conversation antérieure. Utilisable pour
reprendre le travail avec n'importe quel outil (GPT, un·e développeur·se
humain·e, une nouvelle session Claude Code).

---

## 1. Ce que c'est

**Cursus** = suite d'outils pour auteur·ice·s (CursEdit : écriture assistée,
CursAudit : audit éditorial par IA). Application React/Vite, backend Supabase
(Postgres + Edge Functions Deno), IA : Claude (Anthropic) et GPT (OpenAI).

**Dépôt GitHub** : `josephpioggia-coder/Cursus` — propriété entière de
l'auteur du projet, aucune dépendance à Anthropic pour y accéder.
**Branche de développement actuelle** : `claude/cursus-logo-display-h13rtc`
**Branche de production** : `main` (c'est elle que Vercel déploie
automatiquement — voir section 4).

À la date de ce document, `main` est à jour avec tout le travail décrit
ici (dernier commit : "Ajoute la migration SQL fiche-action-editoriale au
dépôt").

---

## 2. Architecture — ce qu'il faut savoir avant de toucher au code

- **Frontend** : `src/`, React + Vite, déployé sur **Vercel depuis la
  branche `main`**. Un changement sur une autre branche n'apparaît JAMAIS
  en production tant qu'il n'est pas fusionné dans `main`.
- **Backend** : Supabase (Postgres + Auth + Edge Functions), projet
  `ssnowhvkwqfpournmyut`.
- **Déploiement des Edge Functions : MANUEL, aucun accès CLI/API configuré
  nulle part.** Chaque fonction modifiée doit être recollée à la main dans
  Supabase Dashboard → Edge Functions → coller le code → Deploy. Aucun
  outil (ni cette session, ni une autre) n'a d'identifiants pour le faire
  automatiquement — vérifié explicitement le 27/08/2026 (pas de CLI
  Supabase installée, pas de token configuré).
- **Fonctions Edge existantes** (`supabase/functions/`) :
  - `analyser-unite-cursaudit` — analyse d'une unité isolée (test manuel)
  - `orchestrer-audit-cursaudit` — audit détaillé, boucle par lots (25s/appel)
  - `preaudit-global-cursaudit` — "aperçu" gratuit, un seul appel
  - `preaudit-approfondi-cursaudit` — pré-audit payant, pipeline en 3
    passages + lecture par chapitre
  - `fiche-action-preaudit-cursaudit` — NOUVEAU (27/08/2026), fiche courte
    et actionnable extraite du pré-audit déjà produit (voir section 5)
  - `admin-codes-promo`, `creer-session-checkout`, `stripe-webhook`,
    `transcrire-audio`, `verification-deux-ia`, `claude-prox` — autres
    modules (CursEdit, paiement, etc.), non touchés aujourd'hui
- **Chaque fichier de fonction Edge est autonome** (pas d'import
  `_shared/`) — leçon du 16/08/2026 : un import relatif casse un
  déploiement par simple collage Dashboard.
- **Migrations SQL** : fichiers `AAAA-MM-JJ-nom.sql` à la racine du dépôt,
  à exécuter manuellement dans Supabase SQL Editor, dans l'ordre
  chronologique. Aucune n'est automatiquement appliquée.

---

## 3. Pièges déjà rencontrés — à ne pas refaire

Ces trois bugs ont coûté beaucoup de temps le 26-27/08/2026. Les
connaître évite de les reproduire ailleurs dans le code :

1. **Supabase/PostgREST plafonne une lecture à 1000 lignes par défaut**,
   silencieusement (pas d'erreur, juste moins de lignes que la vraie
   table). Tout endroit qui doit lire TOUTES les lignes d'une table
   potentiellement longue (`audit_sections` notamment) doit paginer via
   `.range()` en boucle jusqu'à épuisement — voir le motif déjà appliqué
   dans `preaudit-approfondi-cursaudit`, `preaudit-global-cursaudit`,
   `orchestrer-audit-cursaudit`, `auditsAPI.récupérerAvecSections`.

2. **`strict: true` sur un appel Claude à sortie structurée** (garantit la
   conformité du schéma par l'API elle-même, évite les champs omis
   silencieusement) a deux contraintes non documentées à l'avance,
   découvertes par erreurs réelles successives :
   - `minItems` sur un tableau doit être 0 ou 1, jamais une autre valeur.
   - `maxItems` sur un tableau n'est PAS supporté du tout, quelle que soit
     sa valeur.
   Toujours concevoir un nouveau schéma avec `strict: true` dans ces
   limites dès le départ (voir `fiche-action-preaudit-cursaudit` comme
   exemple conforme).

3. **Aucune vraie tâche de fond serveur n'existe** pour l'audit détaillé
   ni le pré-audit. Le traitement d'un livre entier ne progresse QUE si un
   onglet du navigateur reste ouvert et actif — une mise en veille ou une
   fermeture d'onglet interrompt tout (sans rien perdre : chaque étape
   réussie est sauvegardée en base, donc une reprise continue plutôt que
   de repartir de zéro).

4. **Le moteur d'audit détaillé traite les unités strictement séquentiellement**
   (une par une, pas en parallèle) — c'est la vraie cause des audits très
   longs (plusieurs heures sur un livre de 1000+ unités), pas le nombre de
   critères choisi. Une vraie parallélisation (plusieurs appels IA
   simultanés par lot) a été proposée mais **jamais implémentée** — voir
   section 6.

---

## 4. Deux comptes de facturation séparés — ne jamais confondre

- **console.anthropic.com** (et platform.openai.com) : l'organisation API
  dont les clés (`ANTHROPIC_KEY`, `OPENAI_API_KEY`) sont utilisées par les
  Edge Functions CursAudit elles-mêmes. Coût réel très faible (de l'ordre
  de quelques dizaines de centimes par livre analysé).
- **claude.ai / abonnement Claude personnel** : facture l'usage de Claude
  Code (les sessions de développement comme celle-ci), complètement
  séparé du premier compte. C'est ce compte qui a fait l'objet d'un litige
  de facturation le 27/08/2026 (montants réservés ne correspondant pas à
  l'usage affiché) — litige envoyé au support Anthropic, en attente de
  réponse humaine à la date de ce document.

---

## 5. Ce qui a été construit le 26-27/08/2026 (résumé)

- Sélection multi-niveaux des titres de chapitres à l'import/réimport
  d'un .docx (`segmenterCursAudit.js` : `analyserStructureDocx()` +
  `regrouperParNiveaux()`).
- Correctif de troncature à 1000 lignes (voir section 3.1).
- Garde-fou contre une analyse quasi vide silencieusement acceptée
  (`orchestrer-audit-cursaudit`), puis vraie cure via `strict: true` sur
  tous les appels Claude à sortie structurée du projet.
- Export Word de l'audit détaillé terminé (`exportAuditDetailleWord.js`)
  — **avertissement encore valable** : pour un livre de 1442 unités,
  produit un document de plusieurs dizaines de pages avec une table des
  matières à autant d'entrées ; pas encore consolidé (voir section 6).
- Sauvegarde automatique du brouillon de création d'audit dans
  localStorage (`CursAudit.jsx`), pour ne plus perdre un texte collé en
  cas de rechargement de page.
- Signalement visible (au lieu d'un échec silencieux) quand le
  chargement des règles de tarification échoue.
- **Fiche d'action éditoriale** (`fiche-action-preaudit-cursaudit`,
  nouveau) : second document court et actionnable, généré à partir du
  pré-audit déjà produit (jamais une relecture du manuscrit), plafonné au
  plus petit de (a) la longueur du texte source, (b) un plafond
  commercial par palier (300-600 / 800-1500 / 2000-4000 mots). Migration
  SQL : `2026-08-27-fiche-action-editoriale.sql` (colonnes
  `fiche_action_statut`, `fiche_action_resultat` sur `audits`) — confirmée
  exécutée par l'auteur du projet le 27/08/2026.
- Règle 8 ajoutée au prompt de `preaudit-approfondi-cursaudit` pour
  proportionner le pré-audit COMPLET lui-même à la longueur du texte
  source, puis **retirée le 27/08/2026 (décision finale)** : le pré-audit
  complet reste volontairement exhaustif (base/annexe), c'est la fiche
  d'action qui porte la contrainte de concision. Voir le docblock de
  `preaudit-approfondi-cursaudit/index.ts` pour l'historique complet.

### Ajouté le 28/08/2026 (suite)

- **Synthèse de l'audit détaillé, corrigée et renommée en "Rapport
  consolidé de l'audit détaillé"** (`synthese-audit-detaille-cursaudit`) —
  restait à ~2 pages malgré un plafond de 8000 mots déjà fixé :
  `max_tokens` était à 4096 (relevé à 16000) et le prompt imposait des
  "points denses, jamais développés" avec un maximum de 3 à 7 points,
  contradictoire avec l'objectif de longueur. Prompt réécrit pour viser
  ~8000 mots développés (15-20 pages), sans maximum arbitraire de points.
  Décision de l'auteur du projet : pour un audit détaillé vendu cher, ce
  document est le vrai rapport d'orientation du client, pas une synthèse
  courte — d'où le renommage côté affichage (noms internes `synthese_audit_*`
  inchangés, aucune migration nécessaire).
- **Fiche exécutive** (nouveau composant `FicheExecutive` dans
  `CursAuditDetail.jsx`) — page de pilotage d'1-2 pages affichée
  au-dessus du rapport consolidé : diagnostic, 3 priorités, action
  immédiate, risque principal, 3 choses à éviter. Vue condensée du même
  résultat déjà généré, aucun appel API supplémentaire.
- Boutons "Générer la fiche d'action" / "Générer le rapport consolidé"
  rendus **permanents** (avant : disparaissaient une fois le statut
  "termine", obligeant une remise à zéro SQL manuelle pour régénérer — vécu
  en incident réel le 28/08/2026 sur "À cœur retrouvé", doublon
  `429f8b8f-5ef0-4f25-82cd-8bc366322fa2`). Libellé "Régénérer..." une fois
  un résultat obtenu. Chrono en secondes affiché pendant la génération
  (appel bloquant sans progression réelle, pouvait donner une impression
  de plantage sur les générations de plusieurs minutes).
- **Export Word manquant, ajouté** (`exportFicheActionWord.js`, nouveau,
  partagé) : "Exporter la fiche d'action (Word)" et "Exporter le rapport
  consolidé (Word)" — les deux documents étaient consultables à l'écran
  mais pas exportables jusqu'ici.
- PR #78 ouverte (branche `claude/cursus-logo-display-h13rtc` → `main`)
  regroupant tout ce qui précède depuis le 28/08/2026 — à vérifier fusionnée
  avant de considérer ces points comme en production.

---

## 6. Chantiers ouverts, non commencés ou explicitement laissés de côté

- **Audit "Oracle du Sermon sur la montagne" (id `854c6190-17c5-467e-ad19-7faf3049f2fd`)
  — 479 unités en échec sur 752**, cause confirmée par SQL : sortie IA
  massivement non conforme au schéma (quasi tous les champs requis
  absents), erreur antérieure au correctif `strict: true` (audit créé le
  25/08, correctif déployé le 26-27/08). Marche à suivre : (1) confirmer
  que la version déployée de `orchestrer-audit-cursaudit` contient bien
  `strict: true`, (2) remettre à zéro les sections en échec
  (`update audit_sections set resultat_analyse = null where audit_id =
  '854c6190-...' and resultat_analyse->>'erreur' is not null`), (3)
  relancer "Continuer l'analyse" — **`resultat_analyse` non NULL sur une
  section en échec la rend invisible aux requêtes "restantes", donc
  aucune reprise automatique n'existe pour les échecs, seulement pour les
  unités jamais tentées.**
- **[CHANTIER-CONTRAT-INTENTION] CursAudit — questionnaire "contrat
  d'intention" et sa taxonomie de démarrage** (conception menée avec
  l'auteur du projet et ChatGPT en parallèle sur toute la session du
  28/08/2026, architecture considérée comme FIXÉE à l'issue de cette
  session — **rien codé à ce stade**, prochaine étape = transcrire en
  fichier de config + écran(s) React). Avant même le pré-audit, un
  questionnaire en deux blocs :
  - **Bloc A — Nature du projet** (remplace l'appellation "intention
    principale", trompeuse : répond à "qu'écrivez-vous", pas "pourquoi").
    Arbre statique, règles de conception : max 10-12 choix par écran, un
    seul axe de classement par nœud (le genre/registre — les autres axes
    comme le public visé, le format de diffusion ou le mécanisme
    narratif sortent de l'arbre et deviennent des **modules
    transversaux**, déclenchés par étiquette sur le nœud plutôt que
    dupliqués dans chaque branche, ex. `nécessite_support_oral` sur
    Formation/Conférence/Discours, ou "Public visé" sur Roman/Théâtre/
    Conte/BD), profondeur uniquement si un nœud dépasse réellement 12
    sous-cas (constaté seulement pour Roman → 47 sous-genres, et Religion
    → Christianisme → 8 sous-domaines doctrinaux), "Autre (précisez)"
    systématique à chaque niveau. 9 familles de niveau 1 : Se raconter,
    Imaginer une histoire, Défendre une idée, Transmettre un savoir,
    Transformer le lecteur, Créer une œuvre artistique, Communiquer,
    Produire un document professionnel, Concevoir un support pédagogique
    ou ludique. Contenu complet des niveaux 2+ pour les 9 familles
    (dont le détail à 47 entrées de Roman) rédigé dans la conversation du
    28/08/2026 — à retranscrire dans un fichier de config au moment de
    l'implémentation, pas encore committé au dépôt.
  - **Bloc B — Contrat d'intention proprement dit**, niveaux 0 et 2-6 :
    0 (où en est l'auteur dans son projet + le projet est-il autonome ou
    fait partie d'un ensemble, signal réutilisé par le chantier audit
    incrémental ci-dessous) ; 2 (objectif, multi-choix) ; 3 (pour qui) ;
    4 (attentes envers Cursus) ; 5 (critères de réussite) ; 6 (ce que
    l'auteur espère découvrir sur lui-même/son sujet qu'il ignore
    encore). Chaque réponse importante porte en plus : une échelle
    d'importance, un niveau de certitude, et "voulez-vous que Cursus
    challenge cette réponse si le texte la contredit ?". L'ensemble
    validé forme un "contrat déclaré" qui devient le brief envoyé à l'IA
    d'audit (remplace/complète le `contrat_annonce` actuellement déduit
    du texte seul par le pré-audit) — l'audit compare alors le contrat
    déclaré au contrat réellement produit par le texte.

  **Décisions d'architecture arrêtées :**
  1. Arbre 100 % STATIQUE, écrit une fois — pas de génération IA live sur
     ce chemin (fragilité constatée toute la journée du 28/08 :
     NetworkError, sorties mal formées, latence). Un bouton d'aide
     optionnel ("Aide-moi à formuler") appelle l'IA à la demande
     uniquement pour les cas non couverts par l'arbre — prompt déjà
     rédigé dans la conversation du 28/08/2026 (system prompt court,
     sortie `{propositions: string[]}`, 1 à 4 éléments, jamais de
     nouvelle question posée à l'auteur, strict:true).
  2. **Statut de couverture par nœud** (l'idée la plus importante de ce
     chantier) : la taxonomie peut être exhaustive sans que l'audit
     spécialisé le soit — chaque nœud porte un statut (🟢 pris en charge
     / 🟡 partiel / 🟠 en préparation / 🔵 non référencé) et des champs
     (disponible, niveau de maturité, audit spécifique oui/non,
     questionnaire spécifique oui/non, CursEdit spécialisé oui/non, date
     de création, version) — config statique, aucune migration DB.
     Découple le chantier "compléter la taxonomie" (fait, cheap) du
     chantier "construire des critères d'audit spécialisés par genre"
     (à faire progressivement, jamais bloquant pour le lancement).
     Un nœud non couvert propose le(s) plus proche(s) déjà couvert(s)
     **sous forme de liste ordonnée, sans pourcentage inventé** (un vrai
     calcul de similarité n'existe pas — un faux "92 %" serait
     malhonnête).
  3. Appartient à CursAudit, pas CursEdit — distinction posée par
     l'auteur du projet : CursAudit accompagne l'auteur ("le livre
     est-il celui que son auteur voulait réellement écrire ?"), CursEdit
     accompagne le manuscrit ("comment l'améliorer ?").
  4. Connexion avec le chantier **audit incrémental** (voir entrée
     dédiée juste après) : le champ "autonome ou fait partie d'un
     ensemble" du niveau 0 est le point d'entrée commun aux deux
     chantiers, pensé ensemble pour ne pas être reconstruit deux fois.
- **[CHANTIER-AUDIT-INCREMENTAL] CursAudit — audit incrémental /
  cohérence dans la durée** (conception avec l'auteur du projet et
  ChatGPT le 28/08/2026, **rien codé**). Deux cas d'usage distincts qui
  pointent vers le même mécanisme :
  1. Contenu récurrent dans le temps (ex. posts LinkedIn) — chaque
     nouvelle publication traitée comme une nouvelle unité ajoutée à un
     audit qui reste ouvert, plutôt que comme un nouvel audit isolé à
     chaque fois.
  2. Ajout d'un chapitre manquant identifié par un audit détaillé déjà
     terminé (ex. signalé par le rapport consolidé : "il manque une
     scène où tel personnage déclare sa flamme") — vérifier que le
     nouveau contenu s'intègre sans tout ré-auditer.
  Deux sous-capacités à construire, aucune des deux présente
  aujourd'hui :
  - **Cohérence** — comparer la nouvelle unité à un "profil éditorial
    cumulatif" (ton, thèmes, style) construit à partir des unités
    précédentes. Réutilise directement le mécanisme d'agrégation déjà
    construit pour le rapport consolidé (`synthese-audit-detaille-cursaudit`)
    — pas un nouveau modèle de données.
  - **Placement chronologique** (cas 2 uniquement) — vérifier que le
    nouveau contenu correspond bien à l'état des personnages/de
    l'intrigue à CET endroit précis du récit (ex. la relation entre deux
    personnages doit être cohérente avant/après l'ajout). Nécessite de
    reconstituer une timeline par personnage à partir des diagnostics
    déjà produits chapitre par chapitre (par `ordre`) — capacité
    nouvelle, rien d'existant aujourd'hui ne suit un personnage dans le
    temps (la cartographie du contexte du pré-audit décrit les
    personnages, mais pas leur évolution chapitre par chapitre).
  Prérequis technique commun aux deux cas : un audit doit pouvoir
  **rester ouvert** et recevoir de nouvelles unités après sa création —
  aujourd'hui la segmentation en chapitres se fait une seule fois, à la
  création (`analyserStructureDocx`/`regrouperParNiveaux`), rien ne
  permet d'ajouter une unité à un audit existant.
- **Mascotte "Æncre"** (concept validé en discussion le 28/08/2026, rien
  produit) : personnage-mascotte de Cursus, une goutte d'encre vivante
  qui prend différentes formes selon le contexte (ex. un technicien pour
  le dépannage), avec un jeu de mots Æ = Auteur + Écriture + ligature.
  Deux chantiers distincts, à ne pas confondre :
  1. Une vidéo de présentation générée par IA (Runway/Kling/Sora ou
     équivalent) pour l'écran d'accueil — clip fixe, adapté à un usage
     promotionnel unique.
  2. Une animation interactive légère et pilotable (type Lottie) pour les
     réactions en direct dans l'appli (idle/parle/pointe/s'efface,
     déclenchées par le code selon le contexte — dépannage, encouragement
     pendant le questionnaire, passage sensible d'un audit où un registre
     plus sobre est nécessaire). Travail d'illustration/motion design,
     pas quelque chose qu'un outil de code peut produire seul — nécessite
     des fichiers d'animation fournis par un illustrateur/animateur.
- **Parallélisation de `orchestrer-audit-cursaudit`** — traiter plusieurs
  unités à la fois (5-10) au lieu d'une seule par appel, pour réduire
  drastiquement le temps total sur un livre entier. Conçu et discuté,
  jamais implémenté.
- **Nettoyage des doublons d'audits** — confirmé réel en base à plusieurs
  reprises (4 lignes `audits` distinctes pour "À cœur retrouvé", 2 lignes
  au moins pour "Oracle du Sermon sur la montagne"), jamais nettoyé de
  façon générale.
- **Unités déjà traitées avec des critères silencieusement vides ou en
  échec** — identifiées et remises à zéro au cas par cas via SQL ponctuel
  à chaque incident signalé ; pas de mécanisme général (ex. un tableau de
  bord ou une requête réutilisable) pour détecter ce cas sur d'autres
  audits déjà traités avant le correctif `strict: true`.
- **Pagination "aller à la page X"** pour la liste des unités d'un audit
  (38+ pages) — demandée puis explicitement mise de côté par l'auteur du
  projet, jamais implémentée.
- Chantiers plus anciens, non repris depuis le 26/08 (voir l'artefact
  "Tableau opérationnel — Cursus" publié précédemment si accessible) :
  Stripe pour CursAudit, import PDF, pont CursEdit↔CursAudit, workflow de
  curation des propositions, bouton "Pause"/"Relancer les échecs" pour
  l'audit détaillé, moteur mise-en-page, audit poésie, déploiement
  Supabase automatisé.

---

## 7. Pour reprendre avec un autre outil (GPT, autre IA, humain)

1. Cloner/ouvrir le dépôt `josephpioggia-coder/Cursus`, branche `main`.
2. Lire ce document en entier avant de toucher au code.
3. Vérifier l'état réel avant d'agir — ne jamais supposer qu'un correctif
   déjà écrit dans le dépôt est déjà déployé sur Supabase : le
   déploiement est toujours une étape manuelle séparée (section 2).
4. Section 3 = les pièges déjà payés cher — les relire avant d'écrire un
   nouveau schéma IA ou une nouvelle lecture de table potentiellement
   longue.
5. Section 6 = ce qui reste à faire, par ordre approximatif d'impact
   perçu par l'auteur du projet (la parallélisation et la consolidation
   de l'audit détaillé sont probablement les plus attendues).
