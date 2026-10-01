#!/usr/bin/env bash
# Régénère public/scrabble/{mots-fr.txt,accents.txt} depuis Dicollecte (MPL 2.0).
# Prérequis : `apt-get install hunspell hunspell-tools` (unmunch + hunspell), node, npm.
# Pourquoi 2 étapes : `unmunch` développe les affixes MAIS sur-génère (ex. "virulentte") ;
# `hunspell -l` (le vrai moteur, qui applique toutes les conditions des règles)
# écarte ensuite les formes fausses. Résultat du 29/09/2026 : 411 319 mots.
set -euo pipefail
T=$(mktemp -d); cd "$T"
npm init -y >/dev/null && npm i dictionary-fr --no-audit --no-fund >/dev/null
D=node_modules/dictionary-fr
# Les racines marquées "||" (KEEPCASE) sont des abréviations / symboles d'unités
# (kn, hl, kg… et leurs dérivés à préfixe SI) : écartées avant développement.
grep -v '||' $D/index.dic > sans-abrev.dic
unmunch sans-abrev.dic $D/index.aff 2>/dev/null | grep -v '^#\|^$' | sed -E "s#/.*##; s/0+\$//" \
  | grep -E "^[a-zàâäçéèêëîïôöùûüÿœæ]+$" | sort -u > cand.txt
cp $D/index.aff fr.aff; cp sans-abrev.dic fr.dic
hunspell -d ./fr -l < cand.txt | sort -u > mauvais.txt
comm -23 cand.txt mauvais.txt > valides.txt
cd - >/dev/null
node scripts/preparer-dico-scrabble.mjs "$T/valides.txt"
cp "$T/$D/license" public/scrabble/LICENCE-DICOLLECTE.txt
