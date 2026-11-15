# Marge des abonnements CursEdit — calcul du 15/11/2026

Source des tokens : écran « Usage IA » (table `usage_ia`), claude-sonnet-5, 407 appels, 18/09 → 08/11/2026 :
entrée moy. 10 023 (dont cache lu 495), sortie moy. 1 291. Second relevé SQL (122 appels) : 7 068 / 1 017 / cache 804.
Tarifs Sonnet 5 (platform.claude.com/docs/en/about-claude/pricing) : 2 $/M entrée, 10 $/M sortie, 0,20 $/M cache lu.
Hypothèses : 1 analyse = 1 appel ; 1 $ = 1 € (prudent) ; cache écrit compté au prix d'entrée ; frais Stripe et TVA exclus ;
voix 1,5 ct / 1 000 caractères (estimation du 22/10).

Coût moyen d'un appel : 0,032 $ (relevé 1) à 0,023 $ (relevé 2). Calcul ci-dessous avec 0,032.

| Formule | Quota analyses | Coût analyses | Voix | Prix HT/mois | Marge | % |
|---|---|---|---|---|---|---|
| Découverte | 150 | 4,81 | 0,15 | 9,99 | 5,03 | 50 % |
| Essentiel | 200 | 6,41 | 0,45 | 16,99 | 10,13 | 60 % |
| Initié | 250 | 8,02 | 0,90 | 24,99 | 16,07 | 64 % |
| Auteur (illimité, 1 000 supposées) | 1 000 | 32,06 | 2,25 | 49,00 | 14,69 | 30 % |
| Studio (illimité, 1 000 supposées) | 1 000 | 32,06 | 2,25 | 79,00 | 44,69 | 57 % |

Quota consommé à 100 % : cas défavorable. Seuil où la marge s'annule : Auteur ≈ 1 460 analyses/mois, Studio ≈ 2 390.
Risque principal : les formules « illimitées ». Écart connu : 407 appels (écran) contre 122 (SQL) sur des fenêtres différentes, non expliqué.

## Mise à jour — quotas réels (même jour)
Table `quotas_paliers` lue dans l'écran « Usage IA » : Découverte 100 000, Essentiel 500 000, Initié 1 500 000, Auteur 4 000 000,
Studio 10 000 000 tokens/mois. Une analyse moyenne = 11 666 tokens (518 appels) → analyses réellement possibles : ≈ 9, 43, 129,
343, 857, contre 150 / 200 / 250 promises sur les cartes pour les trois premières formules.
Décision de Joseph : relever les quotas (script `2026-11-15-quotas-tokens-paliers.sql`) : Découverte 1 750 000, Essentiel
2 330 000, Initié 2 920 000. Marge si consommé en entier : ≈ 4,89 / 9,94 / 15,83 €. Auteur et Studio inchangés (marges 72 % / 61 %).
Les textes de `contenuPaliers.js` ne changent pas : ils sont désormais cohérents avec les quotas.
