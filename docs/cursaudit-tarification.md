# CursAudit — Modèle de tarification (calculateur, 15/08/2026)

*Transcription du fichier Excel fourni par l'auteur du projet
(`docs/pricing/cursaudit-calculateur-tarification.xlsx`), pour que le modèle
reste lisible et cherchable sans ouvrir Excel. Le fichier original fait foi
en cas de divergence ; cette page ne fait que le documenter.*

Ce document répond au chantier 4 ("modèle économique CursAudit") pour le
volet **audit traditionnel** (analyse complète d'un manuscrit ou d'une
partie). Il ne couvre pas le second usage décidé le 15/08/2026 dans la
conversation (mini-approfondissement ponctuel sur un paragraphe/chapitre,
rattaché au quota Cursus Édition plutôt qu'à ce calculateur) — voir la
section "Reste ouvert" en bas de page.

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

## 5. Scénarios chiffrés (`Scénarios`, déjà calculés dans le fichier)

| Pages | Palier | Mode IA | Rapport | Prix HT | Prix TTC |
|---|---|---|---|---|---|
| 50 | Essentiel (8) | 1 IA | Synthèse courte | 25,96 € | 31,41 € |
| 100 | Essentiel (8) | 1 IA | Synthèse courte | 45,02 € | 54,48 € |
| 150 | Essentiel (8) | 1 IA | Synthèse courte | 64,08 € | 77,54 € |
| 250 | Essentiel (8) | 1 IA | Synthèse courte | 102,21 € | 123,67 € |
| 150 | Approfondi (15) | 1 IA | Rapport complet | 170,56 € | 206,38 € |
| 150 | Expert (30) | 1 IA | Rapport complet | 313,52 € | 379,36 € |
| 150 | Expert (30) | 2 IA | Rapport complet | 470,77 € | 569,64 € |
| 150 | Expert (30) | 2 IA + confrontation ciblée | Rapport complet | 570,85 € | 690,72 € |
| 150 | Expert (30) | 2 IA + arbitrage dialogique | Rapport complet | 699,51 € | 846,41 € |
| 250 | Expert (30) | 2 IA + arbitrage dialogique | Rapport complet | 1 434,31 € | 1 735,52 € |

---

## Reste ouvert

1. **Mini-approfondissement ponctuel** (décidé dans la conversation du
   15/08/2026, en amont de ce fichier) : analyser un seul paragraphe ou
   chapitre pendant l'écriture, sans passer par ce calculateur ni ce niveau
   de prix — à rattacher au quota IA de Cursus Édition (`usage_ia` /
   `quotas_paliers`), pas à `audit_pricing_rules`. Ce fichier ne modélise
   que l'audit complet "à l'acte".
2. **`audit_pricing_rules`** (table proposée, jamais créée — section 3 de
   `cursaudit-cartographie-technique.md`) : ce calculateur en est le contenu
   réel — reste à transposer la formule et les paramètres en lignes de
   configuration lisibles par l'app plutôt qu'en feuille Excel.
3. **Présentation à l'accueil** : confirmé par l'auteur du projet que les 4
   paliers de la grille dimensions sont pensés aussi comme contenu d'accueil
   (chantier 2, cartes CursEdit/CursAudit) — reste à décider l'emplacement
   exact (page d'accueil générale, ou uniquement à l'entrée de CursAudit).
