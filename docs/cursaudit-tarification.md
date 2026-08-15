# CursAudit — Modèle de tarification (calculateur, 15/08/2026)

*Transcription du fichier Excel fourni par l'auteur du projet
(`docs/pricing/cursaudit-calculateur-tarification.xlsx`, mis à jour le
15/08/2026 vers une version plus aboutie — "version 1"), pour que le modèle
reste lisible et cherchable sans ouvrir Excel. Le fichier original fait foi
en cas de divergence ; cette page ne fait que le documenter.*

Ce document répond au chantier 4 ("modèle économique CursAudit") pour le
volet **audit traditionnel** (analyse complète d'un manuscrit, d'une partie,
ou désormais d'un extrait plus court via les tranches basses de la grille —
voir section 5). Reste ouvert : la question de savoir si un usage
"mini-approfondissement" séparé (voir "Reste ouvert" ci-dessous) est
distinct de ces tranches basses ou s'y confond.

---

## 1. Grille des 4 paliers de profondeur (`Grille dimensions`)

| Niveau | Dimensions | Exemples couverts | Positionnement |
|---|---|---|---|
| **Essentiel** | 8 | Type d'énoncé, statut épistémique, besoin de preuve, biais/influence, référence, alerte, motif, diagnostic bref | Lecture exhaustive, coût minimal |
| **Approfondi** | 15 | + fonctions narrative/pédagogique/argumentative, robustesse, validation, procédés, recommandation | Analyse plus éditoriale |
| **Expert** | 30 | Grille complète : indépendance de validation, audit aveugle, relation institutionnelle, résonances, diagnostic détaillé, etc. | Profondeur maximale |
| **Libre** | au choix | L'utilisateur choisit directement le nombre de dimensions dans le Calculateur | Tarification continue |

Ces 4 paliers sont un bon candidat pour les cartes/options présentées à
l'accueil CursAudit (chantier 2) — nom + description déjà rédigés, prêts à
être repris tels quels dans l'UI.

## 2. Modes IA (`Modes & hypothèses`)

| Mode | Facteur de coût | Description | Quand l'utiliser |
|---|---|---|---|
| 1 IA | ×1 | Une IA analyse toutes les lignes | Entrée de gamme / scan exhaustif |
| 2 IA | ×1,55 | Une deuxième IA relit et contrôle la première | Réduction des angles morts |
| 2 IA + confrontation ciblée | ×1,9 | La seconde IA conteste seulement les points sensibles ou désaccords | Bon compromis coût/profondeur |
| 2 IA + arbitrage dialogique | ×2,35 | Les deux IA argumentent les désaccords puis consolidation | Niveau expert maximal |

## 3. Formats de rapport

| Format | Coût IA indicatif | Description |
|---|---|---|
| Aucun | 0 € | Excel / résultats structurés uniquement |
| Synthèse courte | 2 € | Rapport synthétique d'environ 8–15 pages |
| Rapport complet | 6 € | Rapport rédigé, motifs, recommandations, traçabilité |

## 4. Formule de calcul (`Calculateur`)

```
Coût analyse   = pages × unités/page × coût/unité × (dimensions / dimensions de référence) × facteur mode IA
Prix HT        = (coût analyse + coût rapport) × marge de sécurité × multiplicateur de prix × (1 - remise)
Prix TTC       = Prix HT × (1 + TVA)
```

**Hypothèses de calibration** (modifiables dans le fichier) :
- Coût de base : 0,013 €/unité pour 8 dimensions de référence
- Densité observée : 8,5 unités analysées par page
- Marge de sécurité coût IA : 15 %
- Multiplicateur de prix (marge commerciale) : ×4 dans l'exemple courant
- TVA : 21 %

Ces hypothèses sont calibrées pour donner ~16,6 € de coût IA brut sur un cas
de référence (150 pages, 8 dimensions, 1 IA, 8,5 unités/page) — voir le
commentaire du fichier source pour le détail.

## 5. Scénarios chiffrés — version 1 (`Scénarios`, mise à jour du 15/08/2026)

La version la plus récente du fichier remplace les cas isolés par une grille
de **paliers par tranche de pages**, avec un multiplicateur de prix qui
grandit progressivement (×2 pour les petits textes, jusqu'à ×4 pour les
gros) plutôt qu'un multiplicateur fixe :

| Tranche de pages | Dimensions | Mode IA | Rapport | Prix HT | Prix TTC |
|---|---|---|---|---|---|
| < 10 | Essentiel (8) | 1 IA | Synthèse courte | 7,14 € | 8,64 € |
| 10-19 | Essentiel (8) | 1 IA | Synthèse courte | 12,62 € | 15,27 € |
| 20-29 | Essentiel (8) | 1 IA | Synthèse courte | 16,43 € | 19,88 € |
| 20-29 | Approfondi (15) | 1 IA | Synthèse courte | 24,77 € | 29,97 € |
| 30-39 | Essentiel (8) | 1 IA | Synthèse courte | 20,24 € | 24,49 € |
| 30-39 | Approfondi (15) | 1 IA | Synthèse courte | 31,92 € | 38,62 € |
| 39-49 | Essentiel (8) | 1 IA | Synthèse courte | 24,06 € | 29,11 € |
| 39-49 | Approfondi (15) | 1 IA | Synthèse courte | 39,07 € | 47,27 € |
| 50-99 | Essentiel (8) | 1 IA | Synthèse courte | 35,49 € | 42,95 € |
| 50-99 | Approfondi (15) | 1 IA | Synthèse courte | 60,51 € | 73,22 € |
| 100-149 | Essentiel (8) | 1 IA | Synthèse courte | 54,55 € | 66,01 € |
| 100-149 | Approfondi (15) | 1 IA | Synthèse courte | 96,25 € | 116,46 € |
| 100-149 | Approfondi (15) | 1 IA | Rapport complet | 146,73 € | 177,55 € |
| 150-249 | Expert (30) | 1 IA | Rapport complet | 408,82 € | 494,68 € |
| 150-249 | Expert (30) | 2 IA | Rapport complet | 618,50 € | 748,38 € |
| 150-249 | Expert (30) | 2 IA + confrontation ciblée | Rapport complet | 751,93 € | 909,83 € |
| 150-249 | Expert (30) | 2 IA + arbitrage dialogique | Rapport complet | 923,48 € | 1 117,41 € |
| > 250 | Expert (30) | 2 IA + arbitrage dialogique | Rapport complet | 1 371,42 € | 1 659,42 € |

*Les scénarios de la version précédente (pages fixes plutôt que tranches)
restent valides comme cas de test de la même formule — voir l'historique git
de ce fichier.*

---

## Reste ouvert

1. **Mini-approfondissement ponctuel** (décidé dans la conversation du
   15/08/2026, en amont de cette V1) : analyser un seul paragraphe ou
   chapitre pendant l'écriture, sans attendre un manuscrit complet.
   **Hypothèse à confirmer avec l'auteur du projet** : les tranches basses
   de la grille V1 (< 10, 10-19, 20-29 pages, palier Essentiel) donnent des
   prix de 8,64 € à ~20-30 €, nettement sous l'audit traditionnel — ça
   pourrait être directement la tarification du mini-approfondissement
   (même calculateur, appliqué à un extrait court plutôt qu'au manuscrit
   entier), plutôt qu'un mécanisme séparé rattaché au quota Cursus Édition
   comme envisagé initialement. Pas encore tranché.
2. **`audit_pricing_rules`** (table proposée, jamais créée — section 3 de
   `cursaudit-cartographie-technique.md`) : ce calculateur en est le contenu
   réel — reste à transposer la formule, la grille de paliers et les
   tranches de pages en lignes de configuration lisibles par l'app plutôt
   qu'en feuille Excel.
3. **Présentation à l'accueil** : confirmé par l'auteur du projet que les 4
   paliers de la grille dimensions sont pensés aussi comme contenu d'accueil
   (chantier 2, cartes CursEdit/CursAudit) — reste à décider l'emplacement
   exact (page d'accueil générale, ou uniquement à l'entrée de CursAudit).
