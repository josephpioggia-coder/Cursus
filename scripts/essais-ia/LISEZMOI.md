# Jeu d'essai de robustesse des outils IA

Mesure si Correction rapide, Bilan de relecture et Avis sur le fond restent fiables quand le texte contient des erreurs d'entrée
(dictée, noms qui varient, homophones, ponctuation dictée) ou un fait VOULU qui paraît faux.

- `cas-robustesse.json` : les cas (texte, outil visé, vérifications, réponses de référence bonne / mauvaise).
- `../evaluer-robustesse-ia.mjs` : le lanceur. Voir son en-tête pour les options.

```
node scripts/evaluer-robustesse-ia.mjs                       # hors ligne : valide le dispositif, aucun appel d'IA
ANTHROPIC_API_KEY=... node scripts/evaluer-robustesse-ia.mjs --en-ligne --modele=claude-sonnet-5-5 --repetitions=3
```

Vérifications **graves** : ne doivent jamais échouer (changer un nom ou un fait voulu, inventer un personnage, format cassé).
Vérifications **souhaitables** : améliorations attendues (réparer un homophone, signaler une variation de nom).

Pour AJOUTER un cas : une entrée dans `cas-robustesse.json` avec une réponse « bonne » qui passe et une « mauvaise » qui échoue, puis
relancer le mode hors ligne (il refuse un cas dont les vérifications ne distinguent pas les deux).
