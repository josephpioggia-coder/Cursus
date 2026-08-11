# Cursus — Questionnaire de diagnostic éditorial d'un texte tiers (spécification complète)

*Document de référence pour l'implémentation future. Conçu par Joseph le 04/08/2026.*

*Distinct du [questionnaire d'intention](./questionnaire-intention-v3-specification.md) : celui-ci part du principe que la personne qui répond n'est pas l'auteur du texte, et ne cherche pas à définir un projet d'écriture à venir, mais à calibrer une lecture critique d'un texte déjà écrit.*

---

## 1. Contexte du texte
- **Genre / catégorie** (roman, mémoire, essai, guide pratique, manuel technique...) — nécessaire pour juger le texte selon les bons codes, pas des attentes génériques.
- **Stade du texte** : brouillon / version retravaillée / déjà publié — un brouillon se lit avec plus d'indulgence sur la forme, un texte publié se lit aussi sur sa réception possible.
- **Public visé**, si connu — sinon cocher « inconnu », ce qui doit nuancer automatiquement certains jugements du rapport plutôt que de forcer une hypothèse non fondée.

## 2. Cadrage de la lecture
- **Qui répond à ce questionnaire** : l'auteur du texte / un tiers qui l'analyse. Ce champ conditionne la légitimité de certaines réponses — un tiers ne peut pas répondre à la place de l'auteur sur son intention réelle, seulement sur ce qu'il en perçoit.
- **Intention de l'auteur connue ?** oui / non / partiellement — si oui, la décrire brièvement. Sans cette info, le rapport doit rester descriptif (« le texte fait ceci ») plutôt qu'évaluatif (« l'auteur voulait ceci et n'y arrive pas »).

## 3. Ce qu'on veut évaluer (sélection multiple)
- Structure et arc narratif / argumentatif
- Cohérence des entités (personnages, lieux, chronologie)
- Style et voix
- Redites, longueurs
- Transitions entre sections
- Tensions ou contradictions non résolues
- Technique (grammaire, orthographe) — à garder distinct du fond, pas mélangé dans le même paragraphe de jugement
- Positionnement / originalité par rapport au marché du genre concerné

## 4. Référentiel de comparaison
Choisir un seul mode par analyse, pas un mélange flou :
- Comparaison aux conventions du genre déclaré
- Comparaison à la seule cohérence interne du texte (sans référentiel externe)
- Comparaison à un ouvrage de référence précis — à nommer explicitement

## 5. Granularité
- Chapitre par chapitre, avec synthèse finale
- Vue globale uniquement
- Les deux

## 6. Sensibilité du contenu
- Le texte aborde-t-il des sujets sensibles nécessitant une lecture prudente (trauma, santé mentale, sujets clivants) ? oui / non — si oui, préciser lesquels, pour calibrer le ton du rapport (descriptif et mesuré plutôt que clinique ou désinvolte sur ces passages).

## 7. Format de sortie attendu
- Rapport en prose continue
- Rapport annoté par tags (`majeur` / `mineur`, `incohérence`, `répétition`, `transition manquante`, etc. — le format qu'on a vu fonctionner sur le cas du praticien somatique)
- Les deux
- Verdict de synthèse global souhaité ? oui / non

## 8. Usage prévu du résultat
- Usage strictement privé
- Partagé avec l'auteur du texte
- Utilisé comme preuve de concept ou argument commercial pour Cursus

Ce dernier champ ne change rien à l'analyse elle-même, mais doit rester tracé : c'est le point de vigilance sur les droits qu'on a soulevé avant de construire ce questionnaire — savoir à quoi sert le résultat, avant qu'il ne serve effectivement à ça.

---

## Notes techniques pour l'implémentation future

- **Distinct du flux d'intention existant** : ce questionnaire ne doit pas réutiliser la table `intention_projet` ni le composant `QuestionnaireIntention.jsx` — il s'agit d'un flux d'analyse ponctuelle sur un texte déjà écrit, pas d'un cadrage de projet en cours d'écriture. Prévoir une table dédiée (ex. `diagnostic_editorial`) et un composant dédié.
- **Section 2 (cadrage de la lecture)** doit être stockée et exposée au prompt système du rapport, pas seulement affichée à l'utilisateur : le rapport généré doit changer de registre (descriptif vs évaluatif) selon que l'intention de l'auteur est connue ou non, et selon qui répond (auteur / tiers).
- **Section 3 (sélection multiple)** et **section 4 (référentiel, choix unique)** pilotent directement le prompt d'analyse envoyé à l'IA : n'évaluer que les axes cochés, et n'appliquer qu'un seul référentiel de comparaison à la fois — ne jamais mélanger « conventions du genre » et « cohérence interne » dans un même jugement.
- **Section 3, point technique** (grammaire/orthographe) doit être isolée du fond dans le rendu du rapport (paragraphe ou tag distinct), jamais fusionnée avec un jugement de structure ou de style.
- **Section 6 (sensibilité du contenu)**, si oui, doit reconfigurer le ton du prompt sur les passages concernés (mesuré, non clinique, non désinvolte) sans pour autant éviter le sujet.
- **Section 7 (format de sortie)** reprend le format par tags déjà validé sur un cas antérieur (praticien somatique) : `majeur` / `mineur` combinés à des tags de nature (`incohérence`, `répétition`, `transition manquante`, etc.). Prévoir que les deux formats (prose + tags) puissent être générés ensemble, et un verdict de synthèse optionnel et clairement signalé comme distinct des observations détaillées.
- **Section 8 (usage prévu)** est un champ de traçabilité, pas un paramètre d'analyse : à stocker tel quel avec le diagnostic (métadonnée), en lien avec la question de droits déjà soulevée en amont — savoir à quoi sert un résultat avant qu'il ne soit exploité comme tel (partage avec l'auteur, ou usage commercial pour Cursus).
