# Atelier d'Écrivain — Documentation Module 1

## Vue d'ensemble

Le Module 1 couvre la gestion des projets et la structure du manuscrit.
Il constitue le socle sur lequel tous les modules suivants s'appuient.

## Architecture

```
src/
  App.jsx       — Composant racine + état global + routage interne
  main.jsx      — Point d'entrée React
index.html      — Shell HTML
vite.config.js  — Configuration Vite
package.json    — Dépendances
```

## Modèle de données

### Projet
```js
{
  id: string,           // Identifiant unique (genId)
  titre: string,
  genre: string,        // Roman | Non-fiction | Essai | Méthode | Biographie | Autre
  statut: string,       // En cours | En pause | Terminé | Idée
  couleur: string,      // Hex — couleur d'identification visuelle
  objectifMots: number, // Cible en nombre de mots
  description: string,
  dateCreation: string, // ISO 8601
  structure: Nœud[],   // Arborescence du manuscrit
}
```

### Nœud (récursif)
```js
{
  id: string,
  type: 'partie' | 'chapitre' | 'scene',
  titre: string,
  ordre: number,
  texte: string,        // Contenu rédigé (provisoire — Module 2 prend le relais)
  enfants: Nœud[],
}
```

## Hiérarchie de structure

```
Projet
  └── Partie (niveau 0)
        └── Chapitre (niveau 1)
              └── Scène (niveau 2, feuille)
```

## Persistance

### Module 1 (actuel)
Stockage dans `localStorage` sous la clé `atelier-projets`.
Sauvegarde automatique à chaque mutation d'état via `useEffect`.

### Module 2+ (prévu)
Migration vers Supabase :
- Table `projets` — métadonnées
- Table `noeuds` — structure avec colonnes `projet_id`, `parent_id`, `type`, `ordre`, `texte`
- RLS (Row Level Security) pour isolation par utilisateur

## Composants

| Composant        | Rôle                                              |
|------------------|---------------------------------------------------|
| `App`            | État global, routage vue, sauvegarde              |
| `CarteProjet`    | Aperçu d'un projet en vue liste                   |
| `FormulaireProjet` | Création d'un nouveau projet                    |
| `VueProjet`      | Structure complète d'un projet                    |
| `NœudStructure`  | Élément récursif de l'arborescence                |
| `PanneauNœud`    | Zone de saisie pour le nœud sélectionné           |
| `BadgeStatut`    | Badge coloré selon le statut                      |
| `BarreProgression` | Barre de progression mots / objectif            |

## Fonctions utilitaires

| Fonction           | Description                                      |
|--------------------|--------------------------------------------------|
| `genId()`          | Génère un identifiant unique                     |
| `compterMots(str)` | Compte les mots d'une chaîne                     |
| `totalMotsProjet(nœuds)` | Totalise récursivement les mots d'un projet |
| `sauvegarder(projets)` | Persiste dans localStorage                   |
| `charger()`        | Recharge depuis localStorage                     |

## Modules suivants prévus

- **Module 2** — Éditeur riche (mise en forme, mode focus, historique, objectif journalier)
- **Module 3** — Tableau de bord global (avancement, sessions, statistiques)
- **Module 4** — Bibliothèque & citations (livres, notes, format APA)
- **Module 5** — Carnet d'idées (capture rapide, tags, liaison aux chapitres)
- **Module 6** — Co-pilote IA (suggestions temps réel, cohérence, références)

## Lancer le projet

```bash
npm install
npm run dev
```

Ouvre http://localhost:5173 dans ton navigateur.
