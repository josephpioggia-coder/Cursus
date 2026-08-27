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
  source — **décision en suspens à la date de ce document** : l'auteur du
  projet a indiqué préférer garder le pré-audit complet exhaustif (comme
  base/annexe) maintenant que la fiche d'action sert de document court ;
  le retrait de cette règle 8 restait à confirmer/effectuer au moment de
  l'interruption de la session.

---

## 6. Chantiers ouverts, non commencés ou explicitement laissés de côté

- **Décision sur la règle 8** (voir section 5, dernier point) — trancher
  et appliquer si confirmé.
- **Parallélisation de `orchestrer-audit-cursaudit`** — traiter plusieurs
  unités à la fois (5-10) au lieu d'une seule par appel, pour réduire
  drastiquement le temps total sur un livre entier. Conçu et discuté,
  jamais implémenté.
- **Consolidation de l'audit détaillé complet** (pas seulement le
  pré-audit) — un "rapport client" synthétique et priorisé à partir des
  ~1400+ résultats bruts par unité, sur le même principe que la fiche
  d'action du pré-audit mais avec un plafond de 4000-8000 mots. Jamais
  implémenté — l'export Word actuel de l'audit détaillé reste un dump
  brut de toutes les unités (annexe utile, pas un livrable client).
- **Nettoyage des doublons d'audits** — confirmé réel en base (4 lignes
  `audits` distinctes pour "À cœur retrouvé" un jour donné), jamais
  nettoyé.
- **Unités déjà traitées avec des critères silencieusement vides** —
  identifiées et remises à zéro pour un audit précis via SQL ponctuel
  (`reprendre-unites-defectueuses.sql`, envoyé mais pas committé au
  dépôt) ; pas de mécanisme général pour détecter ce cas sur d'autres
  audits déjà traités avant le correctif `strict: true`.
- **Pagination "aller à la page X"** pour la liste des unités d'un audit
  (38+ pages) — demandée puis explicitement mise de côté par l'auteur du
  projet, jamais implémentée.
- Chantiers plus anciens, non repris le 26-27/08 (voir l'artefact
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
