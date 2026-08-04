# CursAudit — Cartographie technique du dépôt Cursus

*Préparé le 04/08/2026, en réponse à la section 39 du brief CursAudit ("Analyse
d'abord le dépôt existant sans modifier le code"). Aucune ligne d'architecture
centrale n'a été touchée pour produire ce document — seule une correction de
branche git locale (sans effet sur le code) a eu lieu en amont.*

*Note de nommage : le brief désigne le produit existant sous le nom "CursEdit".
Dans le dépôt réel, le produit s'appelle **Cursus** (`package.json` :
`atelier-ecrivain`, nom d'affichage "Cursus") — ce document utilise le nom réel.*

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

## 3. Migrations nécessaires

Aucune migration n'a été écrite (conformément à la consigne du brief). Liste
des tables proposées section 28, confrontée au schéma réel :

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
1. **`claude-prox` hors dépôt** — avant de construire quoi que ce soit dessus
   pour CursAudit, il faut rapatrier son code réel dans
   `supabase/functions/claude-prox/` (recommandation déjà faite le 03/08,
   jamais actionnée). Sans ça, je ne peux pas garantir qu'un nouveau mode
   d'appel IA structuré JSON n'entre pas en collision avec son comportement
   actuel.
2. **Pas de couche de composants UI partagée** — construire CursAudit "à côté"
   sans extraire de composants communs (boutons, badges de statut, modales)
   dupliquera du style, au lieu de le réutiliser comme le demande le brief.
3. **RLS silencieuse** — risque déjà vécu une fois cette semaine
   (`quotas_paliers`), à traiter comme un item de check-list obligatoire pour
   chaque nouvelle table `audit_*`.

**Questions bloquantes, à trancher avant l'étape 2 (schéma de données) :**
1. `audits` doit-il être une variante de `projets` (même table, colonne
   `type_produit` en plus) ou une table totalement séparée ? Le brief semble
   supposer une séparation nette (section 28 liste `audits` indépendamment de
   `projets`) — à confirmer, car ça change toute la couche API.
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
