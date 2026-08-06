# Fonctionnalité proposée — dictée vocale dans Cursus (06/08/2026)

## Besoin exprimé

De plus en plus d'écriture se fait à l'oral plutôt qu'au clavier (l'auteur du
projet dicte lui-même une grande partie de ce document). Cursus doit pouvoir
recevoir un texte dicté, le transcrire clairement, laisser l'auteur·e le
corriger, et ne l'utiliser comme base d'analyse ou de texte retenu pour le
livre qu'après validation explicite — jamais la transcription brute sans
relecture.

## Flux proposé

```
1. Bouton micro dans l'éditeur (par nœud, à l'endroit où on écrit aujourd'hui).
2. Enregistrement audio côté navigateur (MediaRecorder).
3. Envoi de l'audio à une fonction Edge Cursus dédiée (ex. transcrire-audio).
4. La fonction appelle une API de transcription externe → texte brut.
5. Le texte revient dans un champ éditable, à côté (ou à la place) de
   l'audio — jamais injecté directement dans le manuscrit.
6. L'auteur·e relit, corrige, valide.
7. Seul le texte validé devient le contenu du nœud — base pour l'analyse
   Cursus Édition et pour le texte retenu dans le livre.
```

Le point 6 est non négociable : la transcription, même bonne, n'est jamais
promue automatiquement au rang de texte définitif.

## Options techniques

**Option A — Web Speech API (navigateur, native, gratuite)**
Reconnaissance vocale intégrée à Chrome/Edge (`SpeechRecognition`), aucun
appel serveur, coût nul. Limites réelles : qualité variable en français,
non fiable sur Safari/Firefox, pas de contrôle sur le moteur utilisé. Bon
candidat pour un premier prototype rapide, pas pour la version définitive.

**Option B — API de transcription externe (recommandée pour la qualité)**
Enregistrement audio → envoi à une API de transcription (OpenAI, la plus
simple à intégrer puisque Cursus appelle déjà GPT côté serveur). Deux
modèles disponibles chez OpenAI aujourd'hui :
- `gpt-4o-mini-transcribe` — environ **0,003 $/minute**
- `whisper-1` / `gpt-4o-transcribe` — environ **0,006 $/minute**

Facturation à la seconde, pas de palier gratuit, pas de remise volume chez
OpenAI. (Sources ci-dessous — à revérifier sur la page officielle avant tout
chiffrage contractuel, ces tarifs évoluent.)

**Option C — Auto-hébergement (whisper.cpp)**
Pas de coût par minute, mais infrastructure à maintenir (serveur GPU ou CPU
dédié). Non justifié à l'échelle actuelle de Cursus — à écarter pour le MVP.

## Chiffrage indicatif (option B, la plus réaliste)

Avec `gpt-4o-mini-transcribe` (~0,003 $/min) :
| Usage quotidien dicté | Coût / jour | Coût / mois |
|---|---|---|
| 15 min | 0,045 $ | ~1,35 $ |
| 30 min | 0,09 $ | ~2,70 $ |
| 1 h | 0,18 $ | ~5,40 $ |
| 3 h (usage intensif) | 0,54 $ | ~16,20 $ |

Avec `whisper-1` (~0,006 $/min), doubler ces montants.

Pour un usage personnel (un seul auteur, quelques dizaines de minutes par
jour), le coût reste marginal — quelques euros par mois. Le sujet devient
réel seulement si la fonctionnalité est ouverte à l'ensemble des
utilisatrices et utilisateurs de Cursus sans limite : à ce moment-là, prévoir
soit un quota inclus par palier d'abonnement, soit une facturation à l'usage
au-delà d'un seuil.

## Prochaine étape (non commencée)

Décider : prototype rapide en option A (gratuit, qualité limitée) pour
valider l'ergonomie, ou aller directement à l'option B (petit coût, qualité
nettement meilleure, cohérent avec l'infrastructure GPT déjà en place) ?
Aucun code écrit à ce stade.

---

Sources (tarifs à revérifier avant tout engagement) :
- [OpenAI Whisper API Pricing 2026 — ConvertAudioToText](https://convertaudiototext.com/blog/openai-whisper-api-pricing-2026)
- [OpenAI Whisper API Pricing 2026 — DIYAI](https://diyai.io/ai-tools/speech-to-text/openai-whisper-api-pricing-2026/)
- [OpenAI Transcribe & Whisper API Pricing (Aug 2026) — CostGoat](https://costgoat.com/pricing/openai-transcription)
- [Whisper API Pricing 2026 — TokenMix](https://tokenmix.ai/blog/whisper-api-pricing)
