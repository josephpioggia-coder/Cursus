# CursAudit — Cartographie technique du dépôt Cursus

*Préparé le 04/08/2026, en réponse à la section 39 du brief CursAudit ("Analyse
d'abord le dépôt existant sans modifier le code"). Aucune ligne d'architecture
centrale n'a été touchée pour produire ce document — seule une correction de
branche git locale (sans effet sur le code) a eu lieu en amont.*

*Note de nommage, mise à jour le 09/08/2026 : **Cursus** n'est plus le nom
d'un produit mais celui de la marque/écosystème. **CursEdit** (sans accent —
décision actée le 09/08 : un accent empêcherait une internationalisation
sans changer le nom) est le produit d'écriture accompagnée, ce que ce
document appelait jusqu'ici "le produit" ou "Cursus" tout court. **CursAudit**
est le second produit sous la même marque. D'autres modules pourraient
suivre sous le même schéma (ex. Cursus Formation, Cursus Conseil, évoqués le
07/08 comme extensions possibles du même moteur de qualification). Dans le
code, `package.json` porte encore le nom d'affichage "Cursus" — à faire
évoluer si la distinction marque/produit doit aussi se refléter techniquement,
mais rien d'urgent ni de cassant.*

---

## 0. Statut des quatre chantiers de refonte identifiés le 09/08/2026

| # | Chantier | Statut |
|---|---|---|
| 1 | Architecture/code — composants partagés (moteur IA, questionnaire, UI) | Très avancé le 16/08/2026 — voir détail section 0bis ci-dessous |
| 2 | Navigation/UX — CursEdit et CursAudit à l'accueil | Maquette validée le 09/08 ; **écran de choix codé le 16/08/2026** (`EcranChoixEspace.jsx`) — pont bidirectionnel et badge "Audit partiel" pas encore construits, voir section 0bis |
| 3 | Nom/branding | Résolu : Cursus = marque, CursEdit et CursAudit = produits, CursEdit sans accent |
| 4 | Modèle économique — offre, tarification, positionnement relatif | Résolu et chiffré (voir `docs/cursaudit-tarification.md`) : un seul modèle "à l'acte" couvre l'audit complet et l'approfondissement ponctuel court, remise abonné CursEdit fixée à 20 % plafonnée à 50 % du prix mensuel de l'abonnement |

---

## 0bis. Détail des briques CursAudit écrites le 16/08/2026

*Le tableau ci-dessus résume ; cette section détaille chaque brique. Toutes
les dates de cette section sont le 16/08/2026 sauf mention contraire.*

**Chantier 1 — Cursus Édition (bouclé)**
- Protocole 60805-06 déployé, testé en conditions réelles, intégré dans
  l'éditeur (onglet "Vérification" de `CopiloteIA.jsx`).

**Chantier 1 — CursAudit, moteur (`analyser-unite-cursaudit`)**
- Testé avec succès : mode "1 IA" validé sur une unité réelle (8 critères
  du palier Essentiel), sortie ancrée dans le texte, correctement
  diagnostiquée comme littéraire/non-factuelle.
- Traite une unité à la fois (limite de temps d'exécution d'une Edge
  Function) ; mode "2 IA" écrit mais pas testé isolément ; "confrontation
  ciblée"/"arbitrage dialogique" pas implémentés.

**Chantier 1 — CursAudit, orchestrateur (`orchestrer-audit-cursaudit`, réf. 60816-01)**
- Traite les unités non analysées d'un audit par lot borné dans le temps
  (25s de marge, pas un compte fixe), marque les échecs par unité plutôt
  que de les retenter en boucle, bascule `audits.statut`
  brouillon→payé→en_traitement→terminé. Pas de tâche de fond automatique —
  l'appelant doit rappeler tant que `restantes > 0`.
- Testé avec succès : lot de 3 unités traitées en un appel. Contraste
  qualitatif confirmé : un passage factuel non sourcé (chiffre attribué à
  "une étude publiée en 2019" sans auteur ni revue) diagnostiqué "besoin de
  preuve fort"/"à sourcer"/"risque d'influence élevé", contre
  "recevable"/"besoin de preuve faible" pour les passages narratifs du
  même lot.

**Chantier 1 — CursAudit, segmentation et création (`segmenterCursAudit.js`, `auditsAPI.créerDepuisTexte`, réf. 60816-01)**
- Texte collé → unités → `audits` (statut "brouillon") + `audit_sections`.
  Segmentation testée unitairement en local.
- **Import `.docx` ajouté le 16/08/2026** (`extraireParagraphesDocx()`,
  suite à un retour de l'auteur du projet : "coller le texte" seul était
  trop éloigné de ce que CursEdit propose déjà). Reprend la lecture JSZip
  déjà éprouvée dans `ImportDocx.jsx` (pas `mammoth`), simplifiée — pas de
  détection de niveaux de titre, juste les paragraphes à plat. `.pdf`
  reste à construire.

**Chantier 1 — CursAudit, page de création (`CursAudit.jsx`, réf. 60816-01)**
- Texte collé, palier (3 fixes, "Libre" non proposé), mode IA (seuls
  "1 IA"/"2 IA", les deux implémentés), format de rapport, prix calculé en
  direct (`tarifCursAudit.js`, à partir du nombre réel d'unités segmentées
  et de `audit_pricing_rules` ; multiplicateur commercial simplifié en une
  valeur fixe par palier, pas encore la grille par tranches complète).
- Crée l'audit en statut "brouillon" — pas de bouton de paiement, aucun
  flux Stripe CursAudit n'existe.

**Chantier 2 — Écran de choix d'espace (`EcranChoixEspace.jsx`)**
- S'affiche une fois après connexion (mémorisé en `sessionStorage`, pas de
  façon permanente), deux cartes CursEdit/CursAudit, bouton "⇄" dans la
  barre supérieure pour changer d'espace à tout moment.
- **Pas construits** : le pont bidirectionnel (passer d'un projet CursEdit
  à son audit sans réimporter — `audits.projet_id` existe déjà en base
  mais rien ne le relie encore dans l'UI) et le badge "Audit partiel" sur
  un projet en cours d'audit.

**Décision actée le 16/08/2026 (séquence de paiement)** : le paiement doit
venir APRÈS le texte/palier choisis, une fois le prix exact connu à partir
du nombre réel d'unités — jamais avant (le prix ne peut pas être fiable
sans le texte). Séquence : création de l'audit en "brouillon" (déjà faite)
→ bouton "Payer" ouvrant une session Stripe Checkout liée à cet audit
(réutiliser `creer-session-checkout`) → `stripe-webhook` confirme et
bascule `statut` à "payé", jamais une confirmation côté client. Vaut aussi
pour un livre entier : même séquence, prix plus élevé du fait du nombre
d'unités, seule différence pratique le temps de traitement en aval.

**Reste à construire pour CursAudit** : import `.pdf` (`.docx` fait), le
bouton "Payer" décrit ci-dessus, pont bidirectionnel + badge, affichage du
rapport. Questionnaire de qualification côté Cursus Édition (chantier 1b)
et composants UI partagés (chantier 1c) toujours pas démarrés.

---

## 1. Cartographie du dépôt

### Stack
- **Frontend** : React 18 + Vite 5, un seul module d'entrée (`src/main.jsx` →
  `src/App.jsx`, ~2700 lignes, composant racine monolithique).
- **Éditeur riche** : Tiptap (`@tiptap/react` + extensions : character-count,
  highlight, placeholder, text-align, typography, underline).
- **Backend** : Supabase (Postgres + Auth + Storage implicite + Edge Functions
  Deno). Client unique : `src/lib/supabase.js`.
- **Paiement** : Stripe, via une Edge Function Supabase
  (`supabase/functions/creer-session-checkout`), pas de SDK Stripe côté client.
- **IA** : Anthropic Claude, appelé exclusivement via une Edge Function Supabase
  nommée `claude-prox` (URL en dur dans `CopiloteIA.jsx` :
  `https://ssnowhvkwqfpournmyut.supabase.co/functions/v1/claude-prox`).
  **Cette fonction n'existe dans aucun fichier de ce dépôt** — son code n'a
  circulé que dans des sessions de chat passées, jamais commité. Risque connu
  et déjà documenté (`docs/cahier-2026-08-03.md`).
- **Import de documents** : `mammoth` (DOCX → HTML), analyse directe du
  `styles.xml` interne pour résoudre les niveaux de titre réels (indépendants
  du nom du style Word).
- **Export** : génération DOCX via la librairie `docx`, dans
  `src/lib/exportWord.js`.
- **i18n** : `i18next` + `react-i18next`, fichiers `src/i18n/locales/{fr,en}/`.
- **Déploiement** : Vercel pour le frontend (URL de prod en dur dans l'Edge
  Function checkout : `https://cursus-seven.vercel.app`), Supabase Dashboard
  pour les migrations SQL et les Edge Functions non trackées dans ce dépôt.

### Point d'attention structurel déjà identifié et corrigé ce jour
`src/App.jsx` (racine, seul fichier réellement importé par `main.jsx`) et
`src/components/App.jsx` (2700 lignes, **non importé nulle part**) ont
longtemps divergé après un rollback d'urgence du 01/08 — un audit direct de
`origin/main` a montré que l'écart réel restant est aujourd'hui minime (une
ligne de câblage manquante, déjà signalée séparément sous `60804-01`).
`src/components/App.jsx` reste un doublon mort à supprimer un jour, mais ne
bloque pas la suite.

### Arborescence fonctionnelle actuelle
```
src/
  App.jsx                    — composant racine : auth, navigation, structure
                                du manuscrit (NœudStructure récursif), édition
                                de projet, promotion/rétrogradation de nœuds
  components/
    Editeur.jsx               — éditeur Tiptap, compteurs mots/caractères, objectifs
    CopiloteIA.jsx             — panneau IA (suggestions, personnages, références,
                                 cohérence), appelle claude-prox directement
    CompteurUsageIA.jsx        — jauge de consommation IA temps réel (tokens)
    ImportDocx.jsx             — import Word, détection de niveaux, conflits
    IncorporerMatiere.jsx      — insertion de matière externe dans un projet
    QuestionnaireIntention.jsx — questionnaire d'intention de projet (ADN du projet)
    Bibliotheque.jsx           — bibliothèque de livres/citations (localStorage
                                 encore partiellement, migration Supabase en attente)
    CarnetIdees.jsx            — carnet d'idées
    TableauDeBord.jsx          — tableau de bord utilisateur
    Tarification.jsx           — grille tarifaire, checkout Stripe, codes promo
    AideFAQ.jsx                — aide statique
  lib/
    supabase.js                — client Supabase unique
    auth.jsx                   — useAuth(), PageConnexion (email/mdp)
    api.js                     — couche API centralisée (projetsAPI, nœudsAPI,
                                 livresAPI, citationsAPI, idéesAPI, sessionsAPI,
                                 usageIAAPI) — AUCUN composant n'appelle Supabase
                                 directement, tout passe par ce fichier
    exportWord.js               — génération DOCX (formats de page A4/broché)
    codePromo.mjs                — génération/vérification HMAC de codes promo
    journalErreurs.js            — journalisation d'erreurs applicatives
supabase/
  functions/creer-session-checkout/  — seule Edge Function trackée dans ce
                                        dépôt ; claude-prox et stripe-webhook
                                        existent en production mais pas ici
```

### Schéma Supabase réel (vérifié en session, pas deviné)
```
projets, noeuds, livres, citations, idees, sessions,
abonnements, quotas_paliers, usage_ia, credits_ia,
banque_questions, intention_personnes, intention_projet,
reponses_questionnaire, journal_erreurs, versions_noeuds
```
`noeuds` porte la hiérarchie du manuscrit : `projet_id`, `parent_id`, `type`
(partie/chapitre/scene), `titre`, `ordre`, `texte` (HTML), `zone` (visibilité :
corps/reserve/methodo/brouillon). C'est la table structurelle centrale — la
plus proche, conceptuellement, de ce que CursAudit appellerait `audit_sections`.

---

## 2. Composants réutilisables pour CursAudit

| Besoin CursAudit (brief) | Équivalent Cursus réutilisable tel quel |
|---|---|
| Authentification, gestion utilisateur | `src/lib/auth.jsx` (`useAuth`, `PageConnexion`) — générique, sans dépendance au domaine "écriture" |
| Stockage des projets | `projetsAPI` (`src/lib/api.js`) — le concept "projet" est déjà neutre (titre, statut, couleur, description) ; un `audit` peut être un type de "projet" ou une table sœur avec la même logique CRUD |
| Import DOCX + détection de structure par niveaux de titre réels | `ImportDocx.jsx` + `mammoth` — c'est exactement le prétraitement demandé en section 7 du brief (extraction, comptage). Directement adaptable : DOCX → HTML → nœuds, sauf que CursAudit veut des *sections d'analyse*, pas des chapitres éditables |
| Comptage caractères/mots | `compterMots`/`compterCaractères` (`Editeur.jsx`) — logique déjà alignée sur l'unité demandée par le brief (caractères espaces compris) |
| Export DOCX | `src/lib/exportWord.js` — réutilisable pour l'export de rapport, moyennant un nouveau template de mise en page (le rapport CursAudit n'a pas la structure d'un manuscrit) |
| Appels IA structurés | Le pattern `fetch(EDGE_FUNCTION_URL, {...})` de `CopiloteIA.jsx` est réutilisable comme squelette, mais **claude-prox actuel répond en texte libre pour un panneau d'aide à l'écriture** — CursAudit a besoin de sorties JSON strictement validées (schéma `AuditFinding`). Il faudra une Edge Function distincte (ou un mode distinct de claude-prox), pas une réutilisation directe. |
| Facturation Stripe | `Tarification.jsx` + `creer-session-checkout` — le mode `payment` (paiement unique, déjà ajouté pour la recharge de tokens `60803-03`) est directement le bon mode pour un audit facturé à l'acte. Le mécanisme de code promo HMAC (`codePromo.mjs`) est réutilisable tel quel. |
| Tableau de bord | `TableauDeBord.jsx` — structure de liste/statut réutilisable comme gabarit pour "mes audits" |
| Composants UI (boutons, modales, badges de statut) | Style inline cohérent dans tout le dépôt (pas de librairie de composants séparée) — pas de composants UI génériques extraits à ce jour ; à extraire si on veut éviter de dupliquer le style bouton/modale pour CursAudit |

**Constat important** : il n'existe **aucune séparation `/src/features/`** dans
le dépôt actuel — tout est plat dans `src/components/`. L'architecture
`/src/features/cursaudit/` proposée par le brief (section 30) serait donc la
**première** feature isolée du projet, pas un renforcement d'un pattern
existant. C'est une bonne discipline à introduire, mais ce sera un choix
architectural nouveau, pas une continuité.

---

## 2bis. Décision d'architecture partagée Cursus Édition ↔ CursAudit (formalisé le 09/08/2026)

Décision de principe : **partager trois briques précises entre les deux
produits plutôt que les construire en parallèle**, chacune pour une raison
différente. Cette section formalise ce qui n'était jusqu'ici que discuté.
P0a (rapatriement de `claude-prox`) et P0b (`OPENAI_API_KEY`) sont faits
(15/08/2026) — voir la carte d'avancement du 07/08 pour l'origine de ces deux
préalables. Ce qui suit reste une décision d'architecture, pas un chantier
lancé : aucune des trois briques ci-dessous n'a de code écrit à ce jour.

### a) Moteur IA à sortie structurée (partagé)

Trois besoins distincts convergent aujourd'hui vers la même brique :
1. **CopiloteIA** (existant) — texte libre, suggestions d'écriture, faible enjeu.
2. **Protocole 60805-06** (Cursus Édition) — sortie JSON stricte, dialogue à deux rôles (Claude analyseur / GPT critique).
3. **CursAudit** (moteur d'analyse) — sortie JSON stricte, par unité codée (confirmé aujourd'hui par l'exemplar Excel/Word produit hors code : 255 unités, 29 dimensions par unité, dialogue Claude↔GPT déjà utilisé en pratique pour ce travail manuel).

Les besoins 2 et 3 sont structurellement le même problème : un appel IA à
rôle explicite, sortie validée contre un schéma, jamais du texte libre. Le
mode texte libre de CopiloteIA reste tel quel — pas besoin de sortie
structurée pour de simples suggestions, `claude-prox` n'est pas touché.

**Décision révisée le 15/08/2026** (remplace la version "une seule Edge
Function générique" ci-dessus, jugée trop simple une fois la question posée
explicitement) : **union sur le mécanisme, différenciation sur le contrôle
d'accès.**
- Un **module interne partagé** (pas déployé séparément, importé par les
  fonctions qui en ont besoin) implémente uniquement le mécanisme d'appel
  `{moteur: claude|gpt, role, schema_sortie, system, contexte}` → sortie
  validée. Aucune logique d'auth ni de facturation dedans.
- **Deux Edge Functions séparées**, chacune avec son propre contrôle
  d'accès, consomment ce module :
  - celle du protocole 60805-06 (Cursus Édition) — garde la logique de
    quota mensuel déjà en place dans `claude-prox` (abonnement récurrent) ;
  - une nouvelle fonction pour le moteur CursAudit — logique de paiement à
    l'acte + remise abonné CursEdit plafonnée (voir
    `docs/cursaudit-tarification.md`), structurellement incompatible avec
    un quota mensuel.

**Écrit le 15/08/2026** : `supabase/functions/_shared/moteur-ia-structure.ts`
— implémente le mécanisme (appel Claude via tool use forcé, appel GPT via
`response_format: json_schema`, validation Ajv de la sortie contre
`schema_sortie` dans les deux cas). Zéro appelant pour l'instant — ni la
fonction 60805-06 ni la fonction CursAudit n'existent encore.

**Migration écrite et appliquée le 15/08/2026** : `2026-08-15-cursaudit-schema.sql`.
`audits` existait déjà en base (créée dans une session passée non commitée,
même pattern que `claude-prox` — colonnes/RLS/policy vérifiées identiques
avant de retirer sa création du script). `audit_sections`, `audit_criteria`,
`audit_pricing_rules` créées avec succès (voir section 3 ci-dessous pour le
détail), avec RLS + policies dès la création. `audit_pricing_rules` est
pré-remplie avec les valeurs actuelles du calculateur
(`docs/cursaudit-tarification.md`) : paliers de dimensions, modes IA, types
de rapport, paramètres globaux (dont la remise abonné CursEdit 20 % / 50 %).
Le multiplicateur de prix par combinaison palier/mode/rapport n'est pas
encore transposé en configuration — seule sa logique est documentée.

Prochaine étape logique : écrire la première des deux Edge Functions
consommatrices du module IA structuré.

Raisons de ne **pas** tout mettre dans une seule fonction (au-delà de la
différence de facturation) : rythme de déploiement très différent —
`claude-prox` est stable et en prod, le moteur CursAudit va être réécrit
plusieurs fois pendant sa construction ; les coupler ferait porter à
CopiloteIA (qui marche déjà) le risque de chaque itération de CursAudit.

### b) Questionnaire (partagé, avec le moteur de qualification proposé le 07/08)

L'existant (`banque_questions` / `reponses_questionnaire`) est **plat** : un
seul niveau utilisé aujourd'hui (l'ADN du projet, niveau 1), aucun
branchement par profil. L'idée du "moteur de qualification" (carte
d'avancement, branche P2b — qui êtes-vous → que cherchez-vous → sur quel
ouvrage → questionnaire spécialisé) reste non commencée, mais la décision
d'architecture est prise : **étendre `banque_questions` avec des colonnes de
branchement (profil cible, question suivante) plutôt que construire un
système séparé.** La table a déjà une colonne `niveau` — c'est une
généralisation d'un mécanisme existant, pas une reconstruction.

**Distinction importante à ne pas mélanger** : ce questionnaire de
qualification (qui demande quoi, en amont d'une session) est un objet
différent du référentiel `audit_criteria` de CursAudit (catégories
épistémiques, règles de lecture par catégorie — premier brouillon réel
trouvé le 09/08 dans la grille Excel produite hors code). Le premier
qualifie la demande ; le second définit comment coder un extrait pendant
l'analyse elle-même. Les deux sont réels, mais pas au même stade :

- **Questionnaire de qualification côté CursAudit : figé le 15/08/2026**,
  voir `questionnaire-cursaudit-v1-specification.md` (10 sections : nature
  du document, statut, finalité, question libre, degré d'intervention,
  préservation de la voix, contraintes académiques, niveau de preuve,
  format de sortie, relation à l'IA). Reconstruit de mémoire (conversation
  source avec GPT non retrouvée telle quelle), ossature confirmée fiable
  par l'auteur du projet.
- **`audit_criteria`** (ce qui définit comment coder un extrait pendant
  l'analyse) : **reconstruit et figé le 15/08/2026**, voir
  `docs/cursaudit-criteria-v1.md` — grille complète des 30 critères (8
  Essentiel + 7 Approfondi + 15 Expert), avec codes stables, regroupement
  thématique et clés de sortie JSON. Migration `2026-08-15-cursaudit-criteria-v1.sql`
  **appliquée avec succès sur Supabase** (30 critères créés et peuplés),
  remplace le schéma placeholder vide de `2026-08-15-cursaudit-schema.sql`.
  Reste exclu volontairement : les critères contextuels personnels ("lentilles",
  ex. `audit_lenses`) — pas encore conçus, table séparée à venir.

Le questionnaire de qualification côté Cursus Édition (`banque_questions`/
`reponses_questionnaire`, point b ci-dessus) est un troisième objet
distinct, propre à chaque produit malgré la ressemblance de principe.

### c) Composants UI partagés

Aucune bibliothèque de composants n'existe aujourd'hui — style inline
dupliqué dans chaque fichier. Décision : extraire un petit socle commun
(bouton, pastille de statut colorée, modale) avant de démarrer l'UI de
CursAudit, pour ne pas dupliquer un second système de style en parallèle du
premier. Périmètre volontairement réduit — pas une refonte de design, juste
les trois briques qui seraient sinon copiées-collées.

---

## 3. Migrations nécessaires

**Écrite et appliquée le 15/08/2026** : `2026-08-15-cursaudit-schema.sql`.
`audits` existait déjà (voir section 2bis-a) ; les trois autres tables sont
créées. Reprend les points ci-dessous, tous résolus au moment de l'écrire —
laissés en l'état pour la trace historique :

- Toutes les tables `audit_*` proposées sont **nouvelles**, sans collision de
  nom avec l'existant.
- `audits.userId` doit référencer `auth.users` comme le fait déjà
  `projets.user_id` — même pattern RLS à répliquer (et **vérifier
  explicitement** que RLS est bien activé avec des policies dès la création :
  le piège vécu cette semaine avec `quotas_paliers` — RLS activé mais zéro
  policy, donc illisible en silence — doit être un test systématique sur
  chaque nouvelle table `audit_*`).
- `audit_pricing_rules` peut suivre le même schéma que `quotas_paliers`
  (table de configuration lue publiquement, écrite seulement en admin).
- `audit_criteria` (catalogue configurable) n'a pas d'équivalent actuel dans
  Cursus — c'est une brique réellement nouvelle.
- Aucune table `noeuds`-like n'existe pour du contenu non-manuscrit : créer
  `audit_sections` comme table indépendante plutôt que de réutiliser `noeuds`
  (mélanger les deux domaines dans une seule table casserait le typage
  `type: partie|chapitre|scene` déjà fermé par une contrainte CHECK côté
  `noeuds`, selon toute vraisemblance — à vérifier avant d'exclure
  définitivement la réutilisation, mais la séparation est plus sûre).

---

## 4. Plan de développement du MVP — évaluation de faisabilité

Le MVP défini section 36 du brief est cohérent avec l'existant sur les points
suivants : import DOCX/PDF/TXT (mammoth couvre DOCX ; PDF et TXT sont des
ajouts, pas des réécritures), comptage de caractères, rapport DOCX exportable.

Ordre proposé section 37 est réaliste **à une réserve près** : l'étape 6
("moteur d'analyse personnel/académique/professionnel") est de loin la plus
lourde et la moins réutilisable de l'existant — Cursus n'a aujourd'hui qu'un
seul type d'appel IA (suggestions d'écriture en texte libre pour un panneau
d'aide), jamais un appel IA à sortie JSON strictement typée et versionnée
comme le demande la section 31. C'est un chantier d'infrastructure IA en soi
(prompts versionnés + validation de schéma), à ne pas sous-estimer dans la
séquence — je recommande de le traiter comme sa propre étape 6bis avant
d'attaquer les trois moteurs métier, plutôt que de les débuter directement.

---

## 5. Risques et questions bloquantes

**Risques techniques :**
1. ~~**`claude-prox` hors dépôt**~~ **Résolu le 15/08/2026 (P0a) :** le code
   réel de la fonction est maintenant commité dans
   `supabase/functions/claude-prox/`. Comportement actuel documenté ici pour
   référence : authentifie l'utilisateur, lit son abonnement actif
   (`abonnements`) et le quota du palier (`quotas_paliers`), calcule la
   consommation du mois en cours (`usage_ia`), refuse au-delà du quota
   (429), sinon relaie l'appel tel quel à `POST
   https://api.anthropic.com/v1/messages` avec la clé `ANTHROPIC_KEY`, et
   journalise les tokens réellement consommés. Tout nouveau mode structuré
   JSON (section 2bis-a) devra donc soit étendre cette fonction (nouveau
   paramètre de rôle/schéma), soit en créer une distincte qui rejoue la même
   logique d'auth/quota — à trancher à ce moment-là, pas maintenant.
2. **Pas de couche de composants UI partagée** — construire CursAudit "à côté"
   sans extraire de composants communs (boutons, badges de statut, modales)
   dupliquera du style, au lieu de le réutiliser comme le demande le brief.
3. **RLS silencieuse** — risque déjà vécu une fois cette semaine
   (`quotas_paliers`), à traiter comme un item de check-list obligatoire pour
   chaque nouvelle table `audit_*`.

**Questions bloquantes, à trancher avant l'étape 2 (schéma de données) :**
1. ~~`audits` doit-il être une variante de `projets` (même table, colonne
   `type_produit` en plus) ou une table totalement séparée ?~~ **Tranché le
   15/08/2026 : table totalement séparée.** Le brief suppose une séparation
   nette (section 28 liste `audits` indépendamment de `projets`) et c'est ce
   qui est retenu. La séparation de table n'empêche pas de passer de l'un à
   l'autre produit sur un même travail — c'est une question distincte
   (chantier 2, déjà résolue par conception le 09/08) : `audits.projet_id`
   référencera le projet source en clé étrangère (pont bidirectionnel sans
   réimport, badge "Audit partiel" sur le projet en cours d'audit dans
   CursEdit). Le détail fin du pont (comportement du badge, effet d'une
   suppression du projet source, etc.) reste à préciser mais ne bloque plus
   le démarrage du schéma.
2. Le moteur IA à sortie JSON validée (section 31) est un composant
   d'infrastructure nouveau, pas une extension de `claude-prox` existant :
   confirmez-vous que c'est un chantier à part entière avant les moteurs
   d'analyse eux-mêmes ?
3. Le brief mentionne PDF et TXT comme formats prioritaires du MVP (section
   7) : aucune librairie de lecture PDF n'est présente dans `package.json`
   actuellement — à ajouter (ex. `pdf-parse` ou équivalent), et à valider
   comme dépendance avant de commencer l'étape 3.

---

*Ce document répond exactement aux 5 livrables demandés section 39 du brief.
Aucune modification de l'architecture centrale n'a été effectuée. En attente
de validation avant de commencer l'étape 2 (schéma de données Supabase).*
