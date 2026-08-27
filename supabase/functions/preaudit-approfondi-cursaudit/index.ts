/**
 * CURSAUDIT — Edge Function : preaudit-approfondi-cursaudit (référence
 * 60816-01, suite, 23/08/2026)
 * ============================================================================
 * LE VRAI PRÉ-AUDIT — phase 2 du travail en deux phases décrit par l'auteur
 * du projet le 15/08/2026 : "le travail suivant, qui coûterait beaucoup plus
 * cher, serait compris par l'auteur". La phase 1 (gratuite, un seul appel,
 * voir preaudit-global-cursaudit, renommé "aperçu" en interne le même jour)
 * ne fait qu'orienter — nature du texte, colonne vertébrale, priorités.
 * Cette fonction-ci développe ces éléments en profondeur, MAIS reste à
 * l'échelle du livre entier — PAS un audit unité par unité (ça, c'est déjà
 * analyser-unite-cursaudit / orchestrer-audit-cursaudit).
 *
 * STRUCTURE RÉVISÉE UNE 3e FOIS le 23/08/2026. v1 (7 blocs) était "mesquine" :
 * trop occupée à dire "il faudra vérifier ça dans l'audit détaillé" plutôt
 * que de livrer un vrai travail. v2 (10 points, diagnostic + hypothèses)
 * corrigeait le ton, mais restait un DIAGNOSTIC ("votre livre est plutôt
 * une fable qu'un roman") plutôt qu'un PLAN D'INTERVENTION ("voici quoi
 * faire, dans quel ordre, avec quel niveau de réécriture, et pourquoi") —
 * constat de l'auteur du projet après le 2e test réel : bien vu, mais rien
 * qu'un·e auteur·ice puisse appliquer directement à son manuscrit.
 *
 * v3 — nouvelle structure en 10 points, orientée DÉCISION + ACTION :
 * nature réelle, promesse affichée, écart promesse/exécution, trois voies
 * éditoriales, recommandation principale, PLAN D'INTERVENTION en chantiers
 * concrets (pas "à vérifier" — un geste éditorial par chantier), exemples
 * concrets structurés (problème/effet/geste éditorial/proposition, même
 * esprit que la synthèse éditoriale par unité de analyser-unite-cursaudit),
 * ce qu'il faut préserver, ce qu'il faut couper/alléger, prochaine étape
 * recommandée (qui peut être "pas besoin d'audit détaillé" — pas un
 * réflexe de vente automatique).
 *
 * RÈGLES EXPLICITES DANS LE PROMPT :
 *  - Aucune orientation ne doit se limiter à "à vérifier plus tard" — chaque
 *    chantier et chaque exemple porte un geste éditorial actionnable
 *    MAINTENANT, avec ou sans audit détaillé ensuite (le vrai problème de v1
 *    ET, dans une moindre mesure, de v2).
 *  - Rester au niveau de préconisation, pas de certitude absolue sur le
 *    texte lui-même ("tout indique que...", pas "Clara n'a pas d'arc") —
 *    mais les RECOMMANDATIONS, elles, doivent être franches et directives.
 *  - GÉNÉROSITÉ OBLIGATOIRE : dire aussi ce qui tient déjà (à préserver),
 *    pas seulement ce qui ne va pas.
 *  - Les exemples concrets illustrent un patron plus large, jamais une
 *    seule idée de correction qui deviendrait le centre de toute l'analyse.
 *  - La prochaine étape recommandée doit être honnête, y compris si la
 *    réponse est "pas besoin d'audit détaillé, réécrire directement".
 *
 * v3 → v4, MÊME JOUR, sur retour de GPT après un premier test v3 jugé "enfin
 * utile" : ne PAS approfondir davantage en volume ("sinon on recrée un audit
 * complet déguisé"), mais stabiliser la FORME du livrable — ajout de
 * `resume_executif` (6-8 lignes, lisible seul, avant tout le reste) et de
 * `duree_estimee_travail` par voie éditoriale (en plus de `ampleur_reecriture`,
 * une estimation concrète même approximative : "1-2 semaines"/"3-6
 * semaines"/"plusieurs mois"), plus deux règles supplémentaires dans le
 * prompt : ton professionnel jamais accusatoire ("décalage" plutôt que
 * "le texte ment"), et ancrage systématique des affirmations importantes
 * dans un repère concret et nommé du texte (déjà spontanément présent dans
 * `exemples_concrets.probleme`, maintenant exigé aussi dans
 * `ecart_promesse_execution` et chaque chantier de `plan_intervention`).
 *
 * v4 → v5, MÊME JOUR, sur retour de GPT après un test v4 jugé complet sur le
 * fond : ajout de `fiche_synthese`, une fiche COURTE (quelques mots par
 * champ, pas des phrases) en complément des champs narratifs déjà riches —
 * contrat_annonce, contrat_reel, ecart_principal, risque_lecteur,
 * recommandation, priorite. Lisible en un coup d'œil pour l'auteur·ice, et
 * potentiellement exploitable plus tard pour comparer/agréger plusieurs
 * pré-audits entre eux (même logique que la catégorisation de
 * `diagnostic_priorite` pour l'audit détaillé, voir
 * 2026-08-22-audit-criteria-categories.sql). Point plus large soulevé par
 * GPT, PAS traité ici : CursAudit devrait aussi auditer le "contrat de
 * lecture" comme un critère à part entière dans la grille de l'audit
 * détaillé (`audit_criteria`) — hors périmètre de cette fonction, touche un
 * système différent et déjà éprouvé (`analyser-unite-cursaudit`).
 *
 * v5 → v6, MÊME JOUR. GPT était ensuite revenu avec 19 "fiches" supplémentaires
 * (personnages, lieux, sensoriel, objets, motifs, scènes, domaines,
 * références, genre, conflits, silences, sur-explication, chronologie,
 * densité, voix, modèles à préserver, points à approfondir...) — la plupart
 * faisaient doublon avec ce qui existe déjà (contrat de genre = nature_reelle/
 * promesse_affichee ; conflits = ecart_promesse_execution ; silences/modèles
 * = a_preserver ; sur-explication = le chantier télégraphage ; "points à
 * approfondir" aurait réintroduit EXACTEMENT le problème "à vérifier plus
 * tard" corrigé en v3). L'auteur du projet a tranché : garder les axes non
 * redondants (personnages, lieux, sensoriel, objets/motifs, domaines à
 * vérifier, voix, densité) dans une section À PART, `cartographie_contexte`,
 * distincte du plan de décision — raison assumée : montrer la richesse et
 * les manques du texte pour que le client comprenne concrètement ce que
 * l'audit détaillé (qui couvre les ~1400+ unités du livre) lui apporterait
 * en plus de ce pré-audit. Choix ASSUMÉ de rester COMPACT (2-5 personnages
 * principaux, pas tous ; 1-4 lieux, pas toutes les scènes) : une version
 * exhaustive referait l'audit détaillé dans un seul appel, ce qui casserait
 * le prix et le délai du pré-audit. `valeur_ajoutee_audit_complet` explicite
 * le pont entre cette cartographie et l'audit détaillé, honnêtement (règle
 * 5), pas comme un argumentaire de vente forcé.
 *
 * v6 → v7, MÊME JOUR — REVIREMENT SUR LE NIVEAU D'IA. La décision "1 seule
 * IA" ci-dessous est ABANDONNÉE. Constat de l'auteur du projet après 4
 * tours de révision manuelle (v1→v6) : à chaque fois, un second regard
 * (GPT, relayé par l'auteur du projet) a signalé des manques ou des excès
 * que le premier passage seul n'avait pas vus — et l'auteur du projet a dit
 * clairement qu'une fois le produit vraiment automatisé (sans lui pour
 * arbitrer à chaque fois), ce filet de sécurité doit être intégré dans le
 * pipeline, pas laissé à un humain qui ne sera plus là.
 *
 * PIPELINE EN 3 PASSAGES (même schéma OpenAI json_schema que le mode "2 IA"
 * déjà éprouvé dans analyser-unite-cursaudit, réutilisé ici) :
 *  1. Claude produit un brouillon (le prompt v6 ci-dessus, inchangé).
 *  2. GPT relit CE BROUILLON (PAS le manuscrit — voir correctif ci-dessous),
 *     et signale UNIQUEMENT des manques réels ou des redites superflues —
 *     il ne réécrit rien lui-même (même limite que le "second lecteur" du
 *     mode 2 IA de l'audit détaillé).
 *  3. Claude reprend SON PROPRE brouillon à la lumière de cette critique et
 *     produit la version finale — il reste seul juge de ce qu'il retient
 *     ou écarte (l'auteur du projet, littéralement : "tu l'amendes en ne
 *     retenant que les éléments clés... en laissant de côté ce que tu
 *     estimes inutile") — ce n'est PAS une nouvelle génération indépendante,
 *     c'est une révision de son propre travail.
 * La critique GPT est conservée dans le résultat (`revision.critique_gpt`)
 * pour la traçabilité, même si elle n'est pas toutes retenue.
 *
 * CONSÉQUENCE ASSUMÉE : le temps de traitement passe de ~1-3 min à
 * plusieurs minutes (3 appels au lieu d'1), et le coût réel est mécaniquement
 * plus élevé (toujours de l'ordre de quelques dizaines de centimes, pas
 * disproportionné face au prix de 40 %) — ce n'est pas un ralentissement
 * artificiel, c'est du vrai travail de contrôle en plus, dans l'esprit de ce
 * que l'auteur du projet a fait manuellement à chaque itération de ce fichier.
 *
 * HORS PÉRIMÈTRE DE CE CHANGEMENT (décision explicite de l'auteur du projet,
 * "pour le moment on doit juste peaufiner ce pré-audit") : l'idée de rendre
 * le mode "2 IA" systématique pour l'audit détaillé aussi, et de refondre la
 * tarification autour de la profondeur plutôt que du nombre d'IA — discuté,
 * pas implémenté, à ouvrir séparément si l'auteur du projet le confirme.
 *
 * CORRECTIF v7.1, MÊME JOUR — bug réel rencontré au premier test du pipeline
 * à 3 passages : "Request too large for gpt-4o... Limit 30000, Requested
 * 46373" — le passage 2 envoyait le MANUSCRIT ENTIER (~58 000 tokens) à
 * gpt-4o, dont le palier de l'organisation de l'auteur du projet est de
 * 30 000 tokens/minute. Deux corrections :
 *  1. Le passage 2 n'envoie plus que le brouillon JSON à GPT (quelques Ko),
 *     pas le manuscrit — sa tâche réelle (cohérence interne, complétude) ne
 *     nécessite pas de revérifier chaque affirmation contre le texte source
 *     ligne à ligne, contrairement au passage 1 et au passage 3 (Claude), qui
 *     eux gardent le manuscrit complet.
 *  2. Modèle changé de `gpt-4o` à `gpt-5` (choix explicite de l'auteur du
 *     projet, vérifié sur platform.openai.com/settings/organization/limits :
 *     `gpt-5` a un palier de 500 000 TPM sur son organisation, largement
 *     suffisant même si le manuscrit y était encore envoyé). Attention à ne
 *     pas confondre l'abonnement ChatGPT Plus personnel de l'auteur du
 *     projet (chatgpt.com) avec l'organisation API (platform.openai.com,
 *     `OPENAI_API_KEY`) — deux systèmes de facturation et de paliers
 *     séparés, malgré le même compte.
 *
 * CORRECTIF v7.2, MÊME JOUR — deuxième bug réel, après le correctif ci-dessus :
 * "data must have required property 'fiche_synthese', data/cartographie_contexte
 * must be object" — cette fois un objet de PREMIER NIVEAU entier manquant ou
 * mal typé (pas juste un champ isolé dans un item de tableau, comme le
 * a_developper manquant corrigé plus tôt). Signe que le schéma (13 champs,
 * plusieurs tableaux imbriqués contraints) a grandi au point que useDefaults
 * seul ne suffit plus quand l'objet parent lui-même est absent. Ajout de
 * `combler()` : reconstruit récursivement, à partir du schéma, toute valeur
 * manquante ou du mauvais type, à tous les niveaux — un objet incomplet
 * reste imparfait mais n'invalide plus tout le pipeline à 3 passages. Même
 * esprit que `normaliserTableauxNuls()` dans `analyser-unite-cursaudit`,
 * généralisé. SIGNAL À SURVEILLER : deux bugs de conformité au schéma en
 * deux tests consécutifs suggère que le schéma approche une limite de
 * fiabilité en un seul passage — à garder à l'esprit avant d'ajouter encore
 * des champs sans retour d'usage réel entre-temps.
 *
 * CORRECTIF v7.3, MÊME JOUR — troisième bug réel : "Request idle timeout
 * limit (150s) reached". Contrainte de la plateforme Supabase Edge Functions
 * (150s max pour répondre à une requête HTTP, non configurable, tous plans),
 * dépassée par les 3 passages (Claude brouillon → GPT critique → Claude
 * version finale) enchaînés dans UN SEUL appel. Pipeline redécoupé en 3
 * appels HTTP séparés — un par passage, état intermédiaire dans les
 * nouvelles colonnes `preaudit_brouillon`/`preaudit_critique_gpt`, le client
 * rappelant la fonction jusqu'à `{ restant: false }`. Même principe que
 * "Lancer/Continuer l'analyse" pour l'audit détaillé (BUDGET_MS = 25000 dans
 * orchestrer-audit-cursaudit) — sauf qu'ici, pas de dosage par petites
 * unités possible : chaque passage porte sur le livre entier, donc un
 * passage complet par appel, pas un lot. NOTE : ceci rend le paragraphe
 * "PAS DE VRAIE TÂCHE DE FOND SERVEUR" ci-dessous partiellement caduc (il
 * décrivait encore "un seul appel synchrone") — conservé tel quel car le
 * raisonnement de fond (pas de vraie tâche serveur asynchrone/notifiée)
 * reste valable, seul le découpage en 3 appels a changé.
 *
 * CORRECTIF v7.4, MÊME JOUR — quatrième bug réel, le plus grave : un vrai
 * test a produit un résultat enregistré comme "terminé" alors que 11 des 13
 * champs de premier niveau étaient vides (seuls `a_preserver` et
 * `a_couper_ou_alleger` étaient remplis) — et la propre critique de GPT
 * (passage 2, conservée dans `revision.critique_gpt`) avait pourtant
 * correctement et intégralement signalé chacun de ces manques. Cause
 * racine : `combler()` (v7.2), construit pour rattraper un champ isolé
 * manquant, était trop permissif — il a silencieusement transformé un échec
 * de génération très majoritaire en un faux "succès" affiché comme un
 * vrai rapport, sans jamais faire réagir le pipeline aux manques que GPT
 * avait lui-même détectés. Ajout de `CHAMPS_CLÉS_NON_VIDES` (6 champs texte
 * de premier niveau jugés indispensables à un rapport minimalement utile)
 * et de `compterChampsClésVides()`, appelés dans `appelClaude()` juste après
 * la validation ajv : si 3 champs clés ou plus sont vides après comblement,
 * on lève une erreur réelle (à relancer) au lieu d'enregistrer et d'afficher
 * un résultat quasi vide. `combler()` reste utile pour les manques isolés ;
 * il ne doit plus jamais masquer un échec massif.
 *
 * CORRECTIF v7.5, 24/08/2026 — signalé via un retour de GPT relayé par
 * l'auteur du projet, vérifié dans le prompt avant d'être accepté : les
 * `duree_estimee_travail` des 3 voies éditoriales revenaient quasiment
 * identiques d'un livre à l'autre ("1-2 semaines", "3-6 semaines",
 * "plusieurs mois"). Cause trouvée : ces trois exemples étaient donnés
 * EN DUR dans le prompt — biais d'ancrage classique, Claude recopiait
 * l'exemple au lieu de calculer. Proposition de GPT d'ajouter toute une
 * section "Calibration du périmètre" séparée jugée disproportionnée et en
 * partie redondante (le pré-audit lit TOUJOURS le livre entier, jamais un
 * sous-ensemble de chapitres — un champ "périmètre évalué" dirait toujours
 * "manuscrit complet" ; le volume et les vérifications nécessaires
 * existent déjà via nombre de mots et `domaines_a_verifier`). Correctif
 * plus ciblé : les exemples de durée chiffrés sont retirés du prompt,
 * remplacés par une instruction explicite de calibrer sur des facteurs
 * réels déjà disponibles (nombre de mots du livre, injecté dans le
 * prompt ; nombre de chantiers de plan_intervention ; présence de
 * domaines_a_verifier) avec interdiction explicite de recycler un
 * gabarit à trois vitesses. Reformulation des 3 voies elles-mêmes
 * (assumer/clarifier → rééquilibrer → recomposer autour d'une autre
 * promesse), reprise de la proposition de GPT — plus nette que la
 * formulation précédente, sans impact sur le schéma.
 *
 * CORRECTIF v7.6, MÊME JOUR — bug réel observé en test après le correctif
 * ci-dessus : "Function failed due to not having enough compute resources"
 * (erreur 546 de Supabase — limite de TEMPS CPU réel de 2000ms par requête
 * dépassée, distincte du budget de 150s pour répondre à la requête HTTP).
 * Cause trouvée : `ajv.compile(SCHEMA_PREAUDIT_APPROFONDI)` était appelé À
 * L'INTÉRIEUR de `appelClaude()`, donc recompilé du DÉBUT à chaque appel —
 * et `appelClaude()` est invoqué DEUX FOIS par requête (passages 1 et 3).
 * Compiler un schéma est un vrai travail CPU (construction de fonctions de
 * validation), pas de l'attente réseau — ce coût, payé deux fois à chaque
 * requête pour rien (le schéma ne change jamais), épuisait le budget CPU
 * de l'isolat Deno. Le validateur (`validerPreauditApprofondi`) est
 * désormais compilé UNE SEULE FOIS au chargement du module, juste après la
 * définition du schéma, et réutilisé pour toutes les requêtes de tout le
 * cycle de vie de l'isolat.
 *
 * v7 → v8, 24/08/2026 — PRÉ-AUDIT ENRICHI CHAPITRE PAR CHAPITRE. Décision de
 * l'auteur du projet après le débat sur les délais des voies éditoriales
 * (v7.5) : plutôt que de simplement stabiliser le pipeline global existant,
 * l'enrichir d'une lecture chapitre par chapitre — livrable plus complet
 * (10-20 pages au lieu de ~12), même prix (le coût API réel est négligeable,
 * moins d'1€ pour tout le mois d'août sur les deux comptes API — vérifié
 * avant de trancher).
 *
 * Prérequis découvert en creusant le chantier : CursAudit ne détectait
 * jusqu'ici AUCUNE structure de chapitres (segmenterCursAudit.js le disait
 * explicitement — "pas de détection de niveaux de titre ici"). Ajout de
 * `extraireParagraphesDocxAvecChapitres()` (même logique éprouvée que
 * `extraireChapitres()` dans ImportDocx.jsx), qui choisit AUTOMATIQUEMENT
 * le niveau de titre le plus répété comme "niveau chapitre" — décision
 * explicite de l'auteur du projet : pas de distinction Partie/Chapitre ni
 * de tri par nature (une préface, des remerciements ou un chapitre au même
 * niveau reçoivent le même traitement, "le client déterminera de toutes
 * façons si oui ou non une partie doit être auditée").
 *
 * SÉCURITÉ CLIENT : le client doit CONFIRMER explicitement ce découpage
 * (`audits.chapitres_confirmes`, écran dans l'aperçu gratuit — voir
 * ConfirmationChapitres dans CursAuditDetail.jsx) avant que le pré-audit ne
 * soit lançable — évite qu'il paie un pré-audit dont le résultat sera
 * compromis par des titres mal placés ou manquants sans avoir eu
 * l'occasion de le corriger avant.
 *
 * PIPELINE ÉTENDU : après les passages globaux (1 : brouillon Claude, 2 :
 * critique GPT), une boucle traite chaque chapitre confirmé — une lecture
 * Claude (schéma allégé SCHEMA_LECTURE_CHAPITRE : fonction, point fort,
 * point faible, à vérifier, à approfondir dans l'audit final — PAS une
 * analyse complète, l'audit détaillé fait ce travail) suivie d'une
 * relecture GPT, chacune dans son propre appel HTTP (même principe de
 * boucle client que les passages globaux). Le passage 3 (synthèse finale)
 * reçoit ces lectures comme CONTEXTE pour affiner sa propre synthèse, mais
 * ne les reproduit pas lui-même : elles sont ajoutées telles quelles au
 * résultat final (`lecture_chapitres`), pour éviter tout risque de dérive
 * entre ce qui a été réellement observé et ce que Claude en redirait.
 *
 * GPT NON BLOQUANT : signalé en test réel, un seul appel GPT peut à lui
 * seul dépasser les 150s de Supabase (modèle à raisonnement, temps
 * variable). Corrigé pour le passage 2 global ET pour chaque relecture de
 * chapitre : `appellerGPTCritique()` abandonne l'appel après un délai
 * interne (110s, sous les 150s), et le pipeline retente UNE FOIS (dans un
 * nouvel appel HTTP séparé — deux tentatives dans le MÊME appel
 * dépasseraient les 150s à elles seules) avant d'abandonner définitivement
 * et de continuer sans cette critique (`GPT_STATUT_INDISPONIBLE`) — GPT
 * reste un contrôle non essentiel, jamais un point de blocage : Claude
 * reste seul juge de toute façon.
 *
 * `reasoning_effort: "low"` ajouté à tous les appels GPT (global et par
 * chapitre) — réduit la latence pour une tâche de contrôle simple
 * (signaler manques/redites, pas une analyse profonde). Pas `"minimal"` :
 * un rapport de test signale un risque de non-respect du schéma JSON
 * strict avec `minimal` sur une variante de GPT-5 (gpt-5-nano) — `"low"`
 * reste prudent sans perdre l'essentiel du gain de vitesse.
 *
 * PAS DE VRAIE TÂCHE DE FOND SERVEUR : un seul appel synchrone, comme pour
 * l'aperçu (phase 1). Discuté avec l'auteur du projet le 23/08/2026, qui
 * voulait un traitement "en arrière-plan avec barre de progression" — un
 * appel unique n'a pas de signal d'avancement réel à afficher, et prend de
 * l'ordre de 1 à 3 minutes, largement sous la limite d'une heure qu'il a
 * fixée. Une vraie tâche de fond (qui survit à la fermeture de l'onglet,
 * avec notification) nécessiterait une infrastructure séparée (table de
 * jobs + poller + notification) qui n'existe pas encore — pas construite
 * ici, jugée disproportionnée pour un traitement de quelques minutes.
 *
 * PRÉ-REQUIS : l'aperçu (phase 1) doit être terminé — on réutilise son
 * résultat (colonne_vertebrale, tension_principale, risques_globaux,
 * audit_recommande.priorites) comme point de départ plutôt que de tout
 * redemander à Claude depuis zéro. Reprend aussi le contexte de
 * qualification du questionnaire (finalité, degré d'intervention,
 * contraintes académiques...), dupliqué depuis analyser-unite-cursaudit —
 * même limite assumée que partout ailleurs dans CursAudit (fichier
 * autonome, pas d'import _shared/, leçon du 16/08/2026).
 *
 * TARIF : 40 % du prix TTC de l'audit détaillé (audit_pricing_rules,
 * categorie "parametre_global", clé "preaudit_pourcentage_prix_final") —
 * voir calculerPrixPreauditPourcentage() dans tarifCursAudit.js pour la
 * même logique côté client. CYCLE DE VIE : `audits.preaudit_statut`
 * (non_demande → paye → termine), `preaudit_prix_ht`, `preaudit_resultat`.
 * Comme pour l'audit détaillé, aucun flux Stripe n'existe encore — le
 * statut se positionne manuellement (SQL) en attendant.
 *
 * SECRETS REQUIS : ANTHROPIC_KEY, OPENAI_API_KEY, SUPABASE_URL, SERVICE_ROLE_KEY (déjà en place).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Ajv from "https://esm.sh/ajv@8?target=deno";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const MODELE_CLAUDE = "claude-sonnet-5";
const MODELE_GPT = "gpt-5";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS } });

// ─── Comblement défensif avant validation (réf. 60816-01, suite, 23/08/2026) ─
// Deuxième bug réel rencontré en test, après celui du a_developper manquant :
// "data must have required property 'fiche_synthese', data/cartographie_contexte
// must be object" — cette fois un objet de premier niveau ENTIER manquant ou
// mal typé (pas juste un champ isolé dans un item de tableau). Le schéma a
// grandi (13 champs, plusieurs tableaux imbriqués contraints) au fil des
// révisions v1→v7 ; useDefaults seul ne suffit plus quand l'objet parent
// lui-même est absent. `combler()` reconstruit récursivement, à partir du
// schéma, toute valeur manquante ou du mauvais type — un objet incomplet
// reste imparfait mais n'invalide plus tout le pipeline à 3 passages après
// coup (coûteux à refaire). Même esprit que normaliserTableauxNuls() dans
// analyser-unite-cursaudit, généralisé pour un schéma plus riche.
function valeurParDéfaut(schema: Record<string, unknown>): unknown {
  if (schema.type === "array") {
    const n = (schema.minItems as number) ?? 0;
    const itemSchema = (schema.items as Record<string, unknown>) ?? { type: "string" };
    return Array.from({ length: n }, () => valeurParDéfaut(itemSchema));
  }
  if (schema.type === "object") {
    const obj: Record<string, unknown> = {};
    const requis = (schema.required as string[]) ?? [];
    const proprietes = (schema.properties as Record<string, Record<string, unknown>>) ?? {};
    for (const clé of requis) obj[clé] = valeurParDéfaut(proprietes[clé] ?? { type: "string" });
    return obj;
  }
  if (schema.default !== undefined) return schema.default;
  if (schema.enum) return (schema.enum as unknown[])[0];
  return "";
}

function combler(schema: Record<string, unknown>, data: unknown): unknown {
  if (schema.type !== "object") return data;
  const base = (typeof data === "object" && data !== null && !Array.isArray(data)) ? { ...(data as Record<string, unknown>) } : {};
  const requis = (schema.required as string[]) ?? [];
  const proprietes = (schema.properties as Record<string, Record<string, unknown>>) ?? {};
  for (const clé of requis) {
    const sousSchema = proprietes[clé] ?? { type: "string" };
    const valeur = base[clé];
    if (valeur === undefined || valeur === null) {
      base[clé] = valeurParDéfaut(sousSchema);
    } else if (sousSchema.type === "object" && typeof valeur === "object" && !Array.isArray(valeur)) {
      base[clé] = combler(sousSchema, valeur);
    } else if (sousSchema.type === "array" && Array.isArray(valeur)) {
      const itemSchema = (sousSchema.items as Record<string, unknown>) ?? { type: "string" };
      const complétée = valeur.map((item) => (itemSchema.type === "object" ? combler(itemSchema, item) : item));
      const min = (sousSchema.minItems as number) ?? 0;
      while (complétée.length < min) complétée.push(valeurParDéfaut(itemSchema));
      base[clé] = complétée;
    } else if (
      (sousSchema.type === "object" && (typeof valeur !== "object" || Array.isArray(valeur))) ||
      (sousSchema.type === "array" && !Array.isArray(valeur))
    ) {
      base[clé] = valeurParDéfaut(sousSchema);
    }
  }
  return base;
}

// ─── Garde-fou contre un résultat quasi vide (réf. 60816-01, suite, 23/08/2026) ─
// Bug réel constaté en test : combler() a rempli PRESQUE TOUT le document
// avec des valeurs vides (11 des 13 champs) sur une vraie génération ratée,
// et ce résultat a quand même été enregistré comme "terminé" — GPT avait
// pourtant tout signalé dans sa critique (revision.critique_gpt), mais rien
// n'empêchait de sauvegarder et de montrer ce résultat comme un vrai
// rapport. combler() protège contre UN champ isolé manquant dans un item ;
// il ne doit JAMAIS servir à faire passer une génération très majoritairement
// vide pour un succès. Si plusieurs champs clés sont vides après comblement,
// on rejette avec une erreur (à relancer) plutôt que d'enregistrer.
const CHAMPS_CLÉS_NON_VIDES = [
  "resume_executif", "nature_reelle", "promesse_affichee",
  "ecart_promesse_execution", "recommandation_principale", "prochaine_etape",
];

function compterChampsClésVides(data: Record<string, unknown>): number {
  return CHAMPS_CLÉS_NON_VIDES.filter((clé) => {
    const valeur = data[clé];
    return typeof valeur !== "string" || valeur.trim() === "";
  }).length;
}

// useDefaults + removeAdditional (réf. 60816-01, suite, 23/08/2026) — corrige
// un vrai échec observé en test : sur un item ajouté par le passage
// d'amendement (ex. un 3e personnage suggéré par la critique GPT), Claude a
// produit une clé légèrement différente du schéma au lieu du champ requis
// (ex. pas de a_developper) — faisant échouer toute la validation, et donc
// tout le pipeline à 3 passages (coûteux à refaire). removeAdditional
// supprime les clés en trop plutôt que de rejeter ; useDefaults + `default`
// sur les champs texte/liste comble un champ requis manquant par une valeur
// vide plutôt que de tout faire échouer — un item incomplet reste imparfait,
// mais n'invalide plus tout le rapport après 3 appels IA.
const ajv = new Ajv({ allErrors: true, strict: false, useDefaults: true, removeAdditional: true });

const SCHEMA_PREAUDIT_APPROFONDI = {
  type: "object",
  properties: {
    resume_executif: { type: "string", default: "" },
    nature_reelle: { type: "string", default: "" },
    promesse_affichee: { type: "string", default: "" },
    ecart_promesse_execution: { type: "string", default: "" },
    voies_editoriales: {
      type: "array",
      // CORRECTIF 27/08/2026 (deux erreurs réelles successives avec
      // strict:true, découvertes une par une côté API Claude, pas
      // documentées à l'avance) — sur un tableau : minItems doit être 0 ou 1
      // ("values other than 0 or 1 are not supported"), et maxItems n'est
      // PAS supporté du tout ("property 'maxItems' is not supported"),
      // quelle que soit sa valeur. Les deux retirés/ramenés à 1 partout dans
      // ce schéma ; le nombre exact ou la fourchette reste imposé par la
      // consigne en langage naturel ("EXACTEMENT 3 voies", voir
      // construireSystemPrompt) et par combler() en filet de sécurité.
      minItems: 1,
      items: {
        type: "object",
        properties: {
          nom: { type: "string", default: "" },
          description: { type: "string", default: "" },
          ampleur_reecriture: { type: "string", enum: ["légère", "moyenne", "lourde"], default: "moyenne" },
          duree_estimee_travail: { type: "string", default: "" },
        },
        required: ["nom", "description", "ampleur_reecriture", "duree_estimee_travail"],
        additionalProperties: false,
      },
    },
    recommandation_principale: { type: "string", default: "" },
    plan_intervention: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          chantier: { type: "string", default: "" },
          geste_editorial: { type: "string", default: "" },
        },
        required: ["chantier", "geste_editorial"],
        additionalProperties: false,
      },
    },
    exemples_concrets: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          probleme: { type: "string", default: "" },
          effet: { type: "string", default: "" },
          geste_editorial: { type: "string", default: "" },
          proposition: { type: "string", default: "" },
        },
        required: ["probleme", "effet", "geste_editorial", "proposition"],
        additionalProperties: false,
      },
    },
    a_preserver: { type: "array", items: { type: "string" }, default: [] },
    a_couper_ou_alleger: { type: "array", items: { type: "string" }, default: [] },
    prochaine_etape: { type: "string", default: "" },
    cartographie_contexte: {
      type: "object",
      properties: {
        personnages_principaux: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              nom: { type: "string", default: "" },
              role: { type: "string", default: "" },
              explicite: { type: "string", default: "" },
              a_developper: { type: "string", default: "" },
            },
            required: ["nom", "role", "explicite", "a_developper"],
            additionalProperties: false,
          },
        },
        lieux_principaux: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              nom: { type: "string", default: "" },
              fonction: { type: "string", default: "" },
              a_enrichir: { type: "string", default: "" },
            },
            required: ["nom", "fonction", "a_enrichir"],
            additionalProperties: false,
          },
        },
        carte_sensorielle: {
          type: "object",
          properties: {
            sens_developpes: { type: "array", items: { type: "string" }, default: [] },
            sens_sous_exploites: { type: "array", items: { type: "string" }, default: [] },
            diagnostic: { type: "string", default: "" },
          },
          required: ["sens_developpes", "sens_sous_exploites", "diagnostic"],
          additionalProperties: false,
        },
        objets_motifs: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              element: { type: "string", default: "" },
              fonction_symbolique: { type: "string", default: "" },
              potentiel_inexploite: { type: "string", default: "" },
            },
            required: ["element", "fonction_symbolique", "potentiel_inexploite"],
            additionalProperties: false,
          },
        },
        domaines_a_verifier: { type: "array", items: { type: "string" }, default: [] },
        voix: { type: "string", default: "" },
        densite: { type: "string", default: "" },
        valeur_ajoutee_audit_complet: { type: "string", default: "" },
      },
      required: [
        "personnages_principaux", "lieux_principaux", "carte_sensorielle", "objets_motifs",
        "domaines_a_verifier", "voix", "densite", "valeur_ajoutee_audit_complet",
      ],
      additionalProperties: false,
    },
    fiche_synthese: {
      type: "object",
      properties: {
        contrat_annonce: { type: "string", default: "" },
        contrat_reel: { type: "string", default: "" },
        ecart_principal: { type: "string", default: "" },
        risque_lecteur: { type: "string", default: "" },
        recommandation: { type: "string", default: "" },
        priorite: { type: "string", default: "" },
      },
      required: ["contrat_annonce", "contrat_reel", "ecart_principal", "risque_lecteur", "recommandation", "priorite"],
      additionalProperties: false,
    },
  },
  required: [
    "resume_executif", "nature_reelle", "promesse_affichee", "ecart_promesse_execution", "voies_editoriales",
    "recommandation_principale", "plan_intervention", "exemples_concrets",
    "a_preserver", "a_couper_ou_alleger", "prochaine_etape", "cartographie_contexte", "fiche_synthese",
  ],
  additionalProperties: false,
};

// Compilé UNE SEULE FOIS au chargement du module (réf. 60816-01, suite,
// 24/08/2026) — appelClaude() est invoqué deux fois par requête (passages 1
// et 3), et ajv.compile() recompilait le même schéma à chaque appel.
// Recompiler un schéma est un travail CPU réel (pas de l'attente réseau) —
// cause probable du "Function failed due to not having enough compute
// resources" (erreur 546 de Supabase : limite de temps CPU de 2000ms par
// requête dépassée, distincte du budget de 150s pour répondre). Compiler
// une seule fois au démarrage de l'isolat Deno, puis réutiliser le même
// validateur, retire ce coût du chemin critique de chaque requête.
const validerPreauditApprofondi = ajv.compile(SCHEMA_PREAUDIT_APPROFONDI);

// ─── Second passage GPT (réf. 60816-01, suite, 23/08/2026) — même principe
// que le "second lecteur" du mode 2 IA de analyser-unite-cursaudit : GPT ne
// réécrit rien, il signale seulement des manques ou des redites réelles.
const SCHEMA_CRITIQUE_GPT = {
  type: "object",
  properties: {
    elements_manquants: { type: "array", items: { type: "string" } },
    elements_superflus: { type: "array", items: { type: "string" } },
    verdict_global: { type: "string" },
  },
  required: ["elements_manquants", "elements_superflus", "verdict_global"],
  additionalProperties: false,
};

// ─── Pré-audit enrichi chapitre par chapitre (réf. 60816-01, suite,
// 24/08/2026) — schéma volontairement TRÈS allégé par rapport à
// SCHEMA_PREAUDIT_APPROFONDI : ce n'est pas l'audit détaillé en miniature,
// juste de quoi repérer les points d'attention, pas les corriger. Réutilise
// SCHEMA_CRITIQUE_GPT pour la relecture GPT de chaque chapitre — même
// principe (manques/redites), s'applique aussi bien à une lecture de
// chapitre qu'au brouillon global.
const SCHEMA_LECTURE_CHAPITRE = {
  type: "object",
  properties: {
    fonction: { type: "string", default: "" },
    point_fort: { type: "string", default: "" },
    point_faible: { type: "string", default: "" },
    a_verifier: { type: "string", default: "" },
    a_approfondir_audit_final: { type: "string", default: "" },
  },
  required: ["fonction", "point_fort", "point_faible", "a_verifier", "a_approfondir_audit_final"],
  additionalProperties: false,
};
const validerLectureChapitre = ajv.compile(SCHEMA_LECTURE_CHAPITRE);

// GPT peut manquer les 150s de Supabase même sur un seul appel (observé en
// test réel) — traité comme NON BLOQUANT plutôt que comme une erreur qui
// arrête tout le pipeline. Une relecture manquée n'est pas grave (Claude
// reste seul juge de toute façon) ; un pipeline bloqué l'est. Deux
// tentatives (chacune dans son propre appel HTTP, pas dans une boucle
// interne — deux tentatives de ~110s dans UN SEUL appel dépasseraient les
// 150s), puis abandon.
const DÉLAI_MAX_GPT_MS = 110_000;
const GPT_STATUT_TENTATIVE_ÉCHOUÉE = "tentative_echouee";
const GPT_STATUT_INDISPONIBLE = "indisponible";

function critiqueEnAttente(valeur: unknown): boolean {
  return !valeur || (valeur as { _statut?: string })._statut === GPT_STATUT_TENTATIVE_ÉCHOUÉE;
}

// Renvoie `null` si le délai est dépassé (cas non bloquant, à traiter par
// l'appelant) — relève une vraie erreur (clé API invalide, réponse
// malformée...) normalement, celle-là ne doit pas être avalée silencieusement.
async function appellerGPTCritique(systemGPT: string, payload: unknown) {
  const contrôleur = new AbortController();
  const minuteur = setTimeout(() => contrôleur.abort(), DÉLAI_MAX_GPT_MS);
  try {
    const réponseGPT = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: contrôleur.signal,
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: MODELE_GPT,
        reasoning_effort: "low",
        messages: [
          { role: "system", content: systemGPT },
          { role: "user", content: JSON.stringify(payload) },
        ],
        response_format: { type: "json_schema", json_schema: { name: "critique_preaudit", schema: SCHEMA_CRITIQUE_GPT, strict: true } },
      }),
    });
    const résultatGPT = await réponseGPT.json();
    if (!réponseGPT.ok) throw new Error(résultatGPT?.error?.message || `Échec de l'appel GPT (${réponseGPT.status}).`);
    const contenuGPT = résultatGPT.choices?.[0]?.message?.content;
    if (!contenuGPT) throw new Error("GPT n'a renvoyé aucun contenu.");
    return {
      data: JSON.parse(contenuGPT),
      usage: { tokens_entree: résultatGPT.usage?.prompt_tokens ?? 0, tokens_sortie: résultatGPT.usage?.completion_tokens ?? 0, modele: résultatGPT.model ?? MODELE_GPT },
    };
  } catch (err) {
    if (contrôleur.signal.aborted) return null;
    throw err;
  } finally {
    clearTimeout(minuteur);
  }
}

// ─── Qualification de la demande (questionnaire) — dupliqué depuis
// analyser-unite-cursaudit/index.ts, voir ce fichier pour le détail complet
// des champs. Reprise minimale : un paragraphe de contexte, pas de logique
// de schéma dynamique par critère.
const LABELS_DEGRE_INTERVENTION: Record<string, string> = {
  observer: "Observer seulement : diagnostique, ne suggère aucune correction.",
  signaler: "Signale les problèmes, sans proposer de solution.",
  pistes: "Propose des pistes de correction, sans reformuler à la place de l'auteur·ice.",
  reformulations_ponctuelles: "Peut glisser une suggestion de reformulation ponctuelle, jamais une réécriture complète.",
  reecrire_legerement: "Peut esquisser une reformulation, sans texte de remplacement complet.",
  reecrire_librement: "Même limite, en se montrant plus libre dans la reformulation suggérée.",
};

interface AuditQualification {
  type_document: string | null;
  finalite_audit: string[] | null;
  question_libre: string | null;
  degre_intervention: string | null;
  contraintes_academiques: { autorisationIA?: string; conditions?: string[] } | null;
}

function construireContexteQualification(audit: AuditQualification): string {
  const lignes: string[] = [];
  if (audit.type_document) lignes.push(`Type de document : ${audit.type_document}.`);
  if (audit.finalite_audit && audit.finalite_audit.length > 0) {
    lignes.push(`Ce que l'auteur·ice cherche à obtenir : ${audit.finalite_audit.join(", ")}.`);
  }
  if (audit.question_libre) lignes.push(`Question posée par l'auteur·ice : "${audit.question_libre}"`);
  if (audit.degre_intervention && LABELS_DEGRE_INTERVENTION[audit.degre_intervention]) {
    lignes.push(`Degré d'intervention autorisé : ${LABELS_DEGRE_INTERVENTION[audit.degre_intervention]}`);
  }
  if (audit.contraintes_academiques?.autorisationIA === "Non") {
    lignes.push("L'établissement de l'auteur·ice N'AUTORISE PAS l'usage de l'IA sur ce travail — reste strictement au diagnostic, aucune proposition ni reformulation.");
  } else if (audit.contraintes_academiques?.conditions && audit.contraintes_academiques.conditions.length > 0) {
    lignes.push(`Conditions académiques à respecter : ${audit.contraintes_academiques.conditions.join(", ")}.`);
  }
  return lignes.length > 0 ? lignes.join("\n") + "\n\n" : "";
}

function construireSystemPrompt(contexteQualification: string, apercu: Record<string, unknown>, nombreMots: number): string {
  const priorites = (apercu?.audit_recommande as { priorites?: string[] })?.priorites ?? [];
  const risques = (apercu?.risques_globaux as string[]) ?? [];
  return (
    "Tu es le module de pré-audit approfondi de CursAudit. On te donne un manuscrit ENTIER, ainsi qu'un " +
    "aperçu rapide déjà réalisé sur ce même livre. Ton rôle n'est PAS de refaire cet aperçu, ni d'auditer " +
    "chaque unité une par une (un autre module fait déjà cela) : c'est de produire un PLAN DE DÉCISION " +
    "ÉDITORIALE — pas un diagnostic qui constate, un outil qui aide l'auteur·ice à transformer son livre. " +
    "Le test à te poser en permanence : après avoir lu ta réponse, l'auteur·ice peut-il/elle faire cinq " +
    "modifications concrètes dans son manuscrit ? Si la réponse est non, ce n'est pas encore assez utile.\n\n" +
    "SEPT RÈGLES NON NÉGOCIABLES, établies après trois essais successifs :\n" +
    "1. Aucun \"il faudra vérifier ça dans l'audit détaillé\". Chaque chantier du plan d'intervention et " +
    "chaque exemple concret porte un geste éditorial que l'auteur·ice peut appliquer MAINTENANT, avec ou " +
    "sans commander l'audit détaillé ensuite.\n" +
    "2. Reste au niveau de la préconisation sur le texte lui-même (\"tout indique que...\", pas \"Clara n'a " +
    "pas d'arc dramatique\" comme un fait acquis) — mais tes RECOMMANDATIONS, elles, doivent être franches " +
    "et directives, pas des hypothèses timides.\n" +
    "3. Sois généreux autant que sévère : dis aussi ce qui tient déjà et doit être préservé (a_preserver " +
    "n'est pas une formalité).\n" +
    "4. Reste à l'échelle du livre entier — l'ORGANISME. Une idée de correction concrète (ex. ajouter un " +
    "personnage, une scène) illustre un patron plus large dans un exemple, elle ne devient jamais à elle " +
    "seule le sujet central de ta réponse.\n" +
    "5. prochaine_etape doit être honnête, y compris si la vraie réponse est \"pas besoin d'audit détaillé, " +
    "l'auteur·ice peut réécrire directement à partir de ce plan\" — ce n'est pas un réflexe de vente.\n" +
    "6. TON PROFESSIONNEL, JAMAIS ACCUSATOIRE. Ne dis pas \"le texte ment sur sa forme\" — dis \"le texte " +
    "crée un décalage entre le contrat annoncé et l'expérience réelle de lecture\". Le constat peut être " +
    "sévère, la formulation reste toujours respectueuse du travail de l'auteur·ice.\n" +
    "7. ANCRE CHAQUE AFFIRMATION IMPORTANTE dans un repère concret et nommé du texte (une scène précise, " +
    "une porte/un chapitre, un dialogue identifiable) — jamais une généralité flottante. C'est déjà ce que " +
    "probleme doit faire dans exemples_concrets ; applique la même exigence dans ecart_promesse_execution " +
    "et dans chaque chantier de plan_intervention.\n\n" +
    `${contexteQualification}` +
    `Colonne vertébrale déjà repérée par l'aperçu : ${apercu?.colonne_vertebrale ?? "non disponible"}\n` +
    `Tension déjà repérée par l'aperçu : ${apercu?.tension_principale ?? "non disponible"}\n` +
    `Risques déjà repérés par l'aperçu : ${risques.length > 0 ? risques.join(" | ") : "aucun"}\n` +
    `Priorités déjà identifiées par l'aperçu : ${priorites.length > 0 ? priorites.join(" | ") : "aucune — identifie toi-même les priorités à partir du texte"}\n\n` +
    "Produis les 13 éléments suivants :\n" +
    "- resume_executif : 6 à 8 lignes MAXIMUM, en langage simple pour l'auteur·ice — ce livre fonctionne-t-il, comment, et quelle voie tu recommandes. Doit pouvoir se lire seul, avant tout le reste (ex. \"Votre livre fonctionne. Mais il fonctionne mieux comme fable méditative que comme roman. La voie recommandée est l'hybride équilibré.\").\n" +
    "- nature_reelle : ce que le manuscrit est réellement en train de faire (ex. \"fable méditative dialoguée plutôt que roman initiatique pleinement incarné\").\n" +
    "- promesse_affichee : ce que le livre promet au lecteur (préface, quatrième de couverture, ouverture...).\n" +
    "- ecart_promesse_execution : l'écart entre cette promesse et ce que la forme réelle tient effectivement (règle 7 : ancré dans des repères précis).\n" +
    `Ce livre fait environ ${nombreMots} mots — sers-toi de ce chiffre réel pour calibrer, plutôt que d'un gabarit.\n\n` +
    "- voies_editoriales : EXACTEMENT 3 voies, du moins interventionniste au plus interventionniste — assumer et clarifier le livre tel qu'il est ; le rééquilibrer pour mieux tenir sa promesse ; le recomposer autour d'une autre promesse. Chacune avec son ampleur_reecriture (légère/moyenne/lourde) ET duree_estimee_travail (une estimation en temps, même approximative). INTERDIT : ne recopie jamais un gabarit de durées toutes faites — calcule chaque duree_estimee_travail à partir de facteurs réels et propres à CE livre : le nombre de mots ci-dessus, le nombre de chantiers que tu identifieras dans plan_intervention, et si tu prévois des domaines_a_verifier qui allongent le travail (vérification documentaire, médicale, juridique, historique...). Deux livres de longueur ou de nature différentes doivent donner des durées visiblement différentes, pas les mêmes trois paliers recyclés.\n" +
    "- recommandation_principale : LA voie recommandée parmi les 3, franchement, avec la réserve explicite si l'auteur·ice vise délibérément autre chose.\n" +
    "- plan_intervention : 3 à 6 chantiers concrets (règles 1 et 7) — chacun un problème réel et nommé de CE livre et son geste_editorial, jamais \"à vérifier\".\n" +
    "- exemples_concrets : au moins 3, chacun avec probleme (ce qui se passe dans le texte), effet (ce que ça produit chez le lecteur), geste_editorial (l'action éditoriale concrète), et proposition (à quoi ça pourrait ressembler après ce geste) — sur des passages PRÉCIS du livre, pas des catégories génériques.\n" +
    "- a_preserver : ce qui fonctionne déjà et ne doit PAS être perdu, quelle que soit la voie choisie.\n" +
    "- a_couper_ou_alleger : ce qui alourdit le texte sans lui apporter de valeur (répétitions, longueurs...).\n" +
    "- prochaine_etape : voir règle 5.\n" +
    "- cartographie_contexte : une cartographie COMPACTE du livre, distincte du plan de décision ci-dessus — pas un audit unité par unité, juste les grandes lignes utiles :\n" +
    "  - personnages_principaux : 2 à 5 personnages PRINCIPAUX seulement (pas tous les personnages) — role, ce qui est explicite dans le texte, ce qui reste à développer.\n" +
    "  - lieux_principaux : 1 à 4 lieux principaux — fonction narrative, ce qui pourrait être enrichi.\n" +
    "  - carte_sensorielle : quels sens sont développés, lesquels sont sous-exploités sur l'ensemble du livre, et un diagnostic en une phrase.\n" +
    "  - objets_motifs : 2 à 5 objets ou motifs récurrents (pas tous) — leur fonction symbolique et leur potentiel encore inexploité (distinct de a_couper_ou_alleger : ici c'est le potentiel, pas la lassitude par répétition).\n" +
    "  - domaines_a_verifier : les domaines réels (géographie, technique, médical, historique...) que l'auteur·ice devrait documenter ou faire vérifier — vide si aucun.\n" +
    "  - voix : en une ou deux phrases, les personnages parlent-ils vraiment différemment ou l'auteur·ice parle-t-il/elle à travers eux tous.\n" +
    "  - densite : en une ou deux phrases, l'équilibre entre dialogue/description/explication/sensoriel sur l'ensemble du livre.\n" +
    "  - valeur_ajoutee_audit_complet : ce que l'audit détaillé permettrait concrètement de vérifier et développer à partir de CETTE cartographie, à l'échelle des scènes et sur l'ensemble du livre — honnête (règle 5), pas un argumentaire commercial forcé, mais une description réelle de ce que l'ampleur du livre entier permet de creuser que cette cartographie compacte ne peut pas faire.\n" +
    "  Adapte ces catégories à la nature du texte : pour un roman, personnages/lieux prennent tout leur sens ; pour un texte non narratif (essai, manuel), remplace-les par ce qui est pertinent (ex. concepts-clés à la place de personnages).\n" +
    "- fiche_synthese : une fiche COURTE en complément de tout ce qui précède, chaque champ en quelques mots seulement (PAS des phrases complètes, PAS de répétition mot pour mot du texte déjà écrit ailleurs) — contrat_annonce (ex. \"roman initiatique\"), contrat_reel (ex. \"conte philosophique dialogué\"), ecart_principal (ex. \"insuffisance de conflit narratif\"), risque_lecteur (ce que le lecteur risque de ressentir, ex. \"attente romanesque déçue\"), recommandation (ex. \"réécriture hybride moyenne\"), priorite (l'action la plus urgente, ex. \"renforcer Clara et opacifier Scalpa\")."
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    if (!ANTHROPIC_KEY) return json({ error: "ANTHROPIC_KEY manquante." }, 500);
    if (!OPENAI_API_KEY) return json({ error: "OPENAI_API_KEY manquante." }, 500);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await admin.auth.getUser(token);
    if (authError || !userData?.user) return json({ error: "Authentification requise." }, 401);
    const userId = userData.user.id;

    const body = await req.json();
    const auditId: string | undefined = body?.audit_id;
    if (!auditId) return json({ error: "audit_id est requis." }, 400);

    const { data: audit } = await admin
      .from("audits")
      .select("id, user_id, preaudit_statut, preaudit_brouillon, preaudit_critique_gpt, apercu_statut, apercu_resultat, type_document, finalite_audit, question_libre, degre_intervention, contraintes_academiques, chapitres_detectes, chapitres_confirmes, preaudit_chapitres_resultats")
      .eq("id", auditId)
      .maybeSingle();
    if (!audit || audit.user_id !== userId) return json({ error: "Audit introuvable." }, 404);
    if (audit.apercu_statut !== "termine") {
      return json({ error: "apercu_requis", message: "L'aperçu gratuit doit être généré avant le pré-audit approfondi." }, 409);
    }
    if (audit.preaudit_statut !== "paye") {
      return json({ error: "paiement_requis", message: `Le pré-audit a le statut "${audit.preaudit_statut}", pas "paye".` }, 402);
    }

    // CORRECTIF 26/08/2026 — bug réel trouvé sur "À cœur retrouvé" (1442
    // unités) : le chapitre "Remerciements" (le dernier du livre) revenait
    // "vide" au pré-audit alors qu'il contient 1154 mots bien réels et
    // correctement rattachés en base (chapitre_index vérifié). Cause :
    // Supabase/PostgREST plafonne une lecture à 1000 lignes par défaut sans
    // pagination explicite — sans erreur, juste moins de lignes que la
    // vraie table. Ce livre a 1442 audit_sections ; ce seul select() n'en
    // renvoyait que les 1000 premières (par `ordre`), amputant silencieusement
    // la fin du livre — exactement là où vit le dernier chapitre. Lecture
    // par lots de 1000 via .range() jusqu'à épuisement.
    const TAILLE_PAGE = 1000;
    const sections: { texte_source: string; chapitre_index: number | null }[] = [];
    for (let page = 0; ; page++) {
      const { data: lot } = await admin
        .from("audit_sections")
        .select("texte_source, chapitre_index")
        .eq("audit_id", auditId)
        .order("ordre", { ascending: true })
        .range(page * TAILLE_PAGE, page * TAILLE_PAGE + TAILLE_PAGE - 1);
      if (!lot || lot.length === 0) break;
      sections.push(...lot);
      if (lot.length < TAILLE_PAGE) break;
    }
    if (sections.length === 0) return json({ error: "Aucune unité dans cet audit." }, 400);

    // CORRECTIF 25/08/2026 — "Function failed due to not having enough
    // compute resources" (546) constaté en test réel sur ce pipeline malgré
    // le correctif v7.6 (ajv.compile déplacé au chargement du module, voir
    // plus haut). Cause probable trouvée : texteIntegral/nombreMots/
    // systemPromptInitial étaient recalculés à CHAQUE appel HTTP, avant même
    // de savoir quel passage allait s'exécuter — y compris pour les ~15 des
    // ~19 appels du pipeline complet (critique GPT du brouillon, chaque
    // lecture/relecture de chapitre) qui n'en ont pas besoin du tout. Le
    // passage la plus coûteuse de ce calcul (join() + split(/\s+/) sur tout
    // le texte, ~30 000 mots ici) tournait donc inutilement sur la quasi-
    // totalité des requêtes. Déplacé dans une fonction, appelée seulement
    // par les deux passages qui en ont réellement besoin (1 et 3).
    const construireTexteEtPrompt = () => {
      const texteIntegral = sections.map((s) => s.texte_source).join("\n\n");
      const nombreMots = texteIntegral.split(/\s+/).filter(Boolean).length;
      const contexteQualification = construireContexteQualification(audit);
      const systemPromptInitial = construireSystemPrompt(contexteQualification, audit.apercu_resultat ?? {}, nombreMots);
      return { texteIntegral, systemPromptInitial };
    };

    const appelClaude = async (system: string, contexte: string) => {
      if (!ANTHROPIC_KEY) throw new Error("ANTHROPIC_KEY manquante.");
      const réponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: MODELE_CLAUDE,
          max_tokens: 24000,
          system,
          messages: [{ role: "user", content: contexte }],
          // CORRECTIF 26/08/2026 — vraie cure plutôt qu'un simple garde-fou
          // après coup (CHAMPS_CLÉS_NON_VIDES ne fait que détecter le
          // problème une fois produit) : strict: true fait garantir par
          // l'API Claude elle-même la conformité complète au schéma avant
          // de répondre. Même correctif que orchestrer-audit-cursaudit et
          // analyser-unite-cursaudit, où l'appel GPT jumeau avait déjà
          // strict: true depuis le début.
          tools: [{ name: "preaudit_approfondi", description: "Plan de décision éditoriale (3 voies, plan d'intervention, exemples actionnables, prochaine étape honnête) et une cartographie compacte du contexte du livre (personnages, lieux, sensoriel, objets/motifs, domaines à vérifier, voix, densité).", input_schema: SCHEMA_PREAUDIT_APPROFONDI, strict: true }],
          tool_choice: { type: "tool", name: "preaudit_approfondi" },
        }),
      });
      const résultatAPI = await réponse.json();
      if (!réponse.ok) throw new Error(résultatAPI?.error?.message || `Échec de l'appel Claude (${réponse.status}).`);
      const blocOutil = (résultatAPI.content ?? []).find((b: { type: string }) => b.type === "tool_use");
      if (!blocOutil) throw new Error("Claude n'a renvoyé aucun bloc tool_use.");
      const donnéesComblées = combler(SCHEMA_PREAUDIT_APPROFONDI, blocOutil.input);
      if (!validerPreauditApprofondi(donnéesComblées)) throw new Error(`Sortie non conforme au schéma : ${ajv.errorsText(validerPreauditApprofondi.errors)}`);
      const nbChampsVides = compterChampsClésVides(donnéesComblées as Record<string, unknown>);
      if (nbChampsVides >= 3) {
        throw new Error(`Génération quasi vide (${nbChampsVides}/${CHAMPS_CLÉS_NON_VIDES.length} champs clés manquants) — échec réel, à relancer plutôt qu'à afficher.`);
      }
      return {
        data: donnéesComblées,
        usage: { tokens_entree: résultatAPI.usage?.input_tokens ?? 0, tokens_sortie: résultatAPI.usage?.output_tokens ?? 0, modele: résultatAPI.model ?? MODELE_CLAUDE },
      };
    };

    // Lecture d'UN chapitre (réf. 60816-01, suite, 24/08/2026) — même
    // principe qu'appelClaude() mais avec le schéma allégé
    // SCHEMA_LECTURE_CHAPITRE, pas le schéma complet du pré-audit.
    const appelClaudeChapitre = async (titreChapitre: string, texteChapitre: string) => {
      if (!ANTHROPIC_KEY) throw new Error("ANTHROPIC_KEY manquante.");
      const system =
        "Tu relis UN chapitre (ou équivalent : préface, partie, remerciements...) d'un livre déjà lu dans son " +
        "ensemble par ailleurs. Reste BREF — 5 champs courts, ce n'est PAS une analyse complète (l'audit " +
        "détaillé fera ce travail ligne par ligne si le client le commande). N'INVENTE aucune correction, " +
        "n'écris aucune proposition de réécriture ici — observe seulement ce qui est déjà là. " +
        "a_approfondir_audit_final doit être honnête : \"rien de particulier\" est une réponse acceptable si " +
        "c'est vraiment le cas, pas un réflexe systématique.";
      const réponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: MODELE_CLAUDE,
          max_tokens: 2000,
          system,
          messages: [{ role: "user", content: `Titre de ce chapitre : "${titreChapitre}"\n\nTexte du chapitre :\n\n${texteChapitre}` }],
          // CORRECTIF 26/08/2026 — voir la note jumelle sur appelClaude() ci-dessus.
          tools: [{ name: "lecture_chapitre", description: "Lecture brève d'un chapitre : fonction, point fort, point faible, à vérifier, à approfondir dans l'audit final.", input_schema: SCHEMA_LECTURE_CHAPITRE, strict: true }],
          tool_choice: { type: "tool", name: "lecture_chapitre" },
        }),
      });
      const résultatAPI = await réponse.json();
      if (!réponse.ok) throw new Error(résultatAPI?.error?.message || `Échec de l'appel Claude (${réponse.status}).`);
      const blocOutil = (résultatAPI.content ?? []).find((b: { type: string }) => b.type === "tool_use");
      if (!blocOutil) throw new Error("Claude n'a renvoyé aucun bloc tool_use.");
      const donnéesComblées = combler(SCHEMA_LECTURE_CHAPITRE, blocOutil.input);
      if (!validerLectureChapitre(donnéesComblées)) throw new Error(`Lecture de chapitre non conforme au schéma : ${ajv.errorsText(validerLectureChapitre.errors)}`);
      return {
        data: donnéesComblées,
        usage: { tokens_entree: résultatAPI.usage?.input_tokens ?? 0, tokens_sortie: résultatAPI.usage?.output_tokens ?? 0, modele: résultatAPI.model ?? MODELE_CLAUDE },
      };
    };

    // 3 PASSAGES EN 3 APPELS HTTP SÉPARÉS (réf. 60816-01, suite, 23/08/2026) —
    // corrige "Request idle timeout limit (150s) reached" : Supabase impose
    // 150s max pour répondre à une requête, sur tous les plans, non
    // configurable. Les 3 passages mis bout à bout dans UN appel dépassaient
    // ce plafond. Chaque appel ici ne fait qu'UN SEUL passage, sauvegarde son
    // résultat intermédiaire, et répond — le client rappelle la fonction
    // jusqu'à { restant: false }, même principe que "Lancer/Continuer
    // l'analyse" pour l'audit détaillé (orchestrer-audit-cursaudit,
    // BUDGET_MS = 25000 par lot). Contrairement à l'audit détaillé, qui dose
    // par petites unités, le pré-audit porte sur le livre entier à chaque
    // passage — pas de dosage possible, juste un passage complet par appel.

    if (!audit.preaudit_brouillon) {
      // Passage 1 — Claude produit le brouillon.
      const { texteIntegral, systemPromptInitial } = construireTexteEtPrompt();
      const brouillon = await appelClaude(systemPromptInitial, texteIntegral);
      const { error: erreurMaj } = await admin
        .from("audits")
        .update({ preaudit_brouillon: brouillon })
        .eq("id", auditId);
      if (erreurMaj) return json({ error: erreurMaj.message }, 500);
      return json({ audit_id: auditId, etape: "brouillon", restant: true });
    }

    const systemGPTGlobal =
      "Tu es le second lecteur du pré-audit CursAudit. On te donne un pré-audit déjà rédigé par un premier " +
      "moteur à partir d'un manuscrit (13 éléments : résumé exécutif, nature réelle, promesse affichée, " +
      "écart, voies éditoriales, recommandation, plan d'intervention, exemples concrets, à préserver, à " +
      "couper, prochaine étape, cartographie du contexte, fiche de synthèse). Le manuscrit lui-même ne " +
      "t'est PAS fourni — ta relecture porte sur la COHÉRENCE INTERNE et la COMPLÉTUDE du document, pas sur " +
      "une vérification ligne à ligne contre le texte source. Signale UNIQUEMENT : des manques réels (un " +
      "champ trop vague ou générique par rapport aux autres, une voie éditoriale sans lien avec le plan " +
      "d'intervention, une recommandation qui ne découle pas de ce qui précède) et des redites superflues " +
      "(la même idée répétée presque mot pour mot entre plusieurs champs). Ne réécris rien toi-même, ne " +
      "propose pas de nouvelle version — indique seulement ce qui devrait changer, pour que le premier " +
      "moteur amende son propre travail.";

    if (critiqueEnAttente(audit.preaudit_critique_gpt)) {
      // Passage 2 — GPT relit le brouillon (PAS le manuscrit, voir note plus
      // haut sur le plafond TPM). Non bloquant (voir appellerGPTCritique) :
      // une critique manquée fait avancer le pipeline quand même.
      const déjàTenté = (audit.preaudit_critique_gpt as { _statut?: string } | null)?._statut === GPT_STATUT_TENTATIVE_ÉCHOUÉE;
      const résultatGPT = await appellerGPTCritique(systemGPTGlobal, { preaudit_brouillon: (audit.preaudit_brouillon as { data: unknown }).data });
      const nouvelleValeur = résultatGPT ?? { _statut: déjàTenté ? GPT_STATUT_INDISPONIBLE : GPT_STATUT_TENTATIVE_ÉCHOUÉE };
      const { error: erreurMaj } = await admin
        .from("audits")
        .update({ preaudit_critique_gpt: nouvelleValeur })
        .eq("id", auditId);
      if (erreurMaj) return json({ error: erreurMaj.message }, 500);
      return json({ audit_id: auditId, etape: "critique", restant: true });
    }

    // Boucle chapitre par chapitre (réf. 60816-01, suite, 24/08/2026) — un
    // chapitre = une lecture Claude + une relecture GPT (non bloquante,
    // même principe que le passage 2), chacune dans son propre appel HTTP.
    // Seulement si le client a confirmé le découpage détecté à l'import
    // (voir ConfirmationChapitres dans CursAuditDetail.jsx) — sinon le
    // pré-audit reste une lecture globale seule, comme avant ce chantier.
    const chapitresConfirmés = audit.chapitres_confirmes && Array.isArray(audit.chapitres_detectes)
      ? (audit.chapitres_detectes as Array<{ titre: string; indexPremièreUnité: number; nombreUnités: number; mots: number }>)
      : [];

    if (chapitresConfirmés.length > 0) {
      const résultatsChapitres = (
        Array.isArray(audit.preaudit_chapitres_resultats) && audit.preaudit_chapitres_resultats.length === chapitresConfirmés.length
          ? audit.preaudit_chapitres_resultats
          : chapitresConfirmés.map(() => ({ lecture: null, relecture: null }))
      ) as Array<{ lecture: { data: Record<string, unknown>; usage: unknown } | null; relecture: unknown }>;

      for (let i = 0; i < chapitresConfirmés.length; i++) {
        const chapitre = chapitresConfirmés[i];
        const entrée = résultatsChapitres[i];

        if (!entrée.lecture) {
          const texteChapitre = sections
            .filter((s) => (s as { chapitre_index?: number }).chapitre_index === i)
            .map((s) => s.texte_source)
            .join("\n\n");
          entrée.lecture = await appelClaudeChapitre(chapitre.titre, texteChapitre || chapitre.titre);
          const { error: erreurMaj } = await admin
            .from("audits")
            .update({ preaudit_chapitres_resultats: résultatsChapitres })
            .eq("id", auditId);
          if (erreurMaj) return json({ error: erreurMaj.message }, 500);
          return json({ audit_id: auditId, etape: "chapitre_lecture", chapitre_numero: i + 1, chapitre_total: chapitresConfirmés.length, chapitre_titre: chapitre.titre, restant: true });
        }

        if (critiqueEnAttente(entrée.relecture)) {
          const déjàTenté = (entrée.relecture as { _statut?: string } | null)?._statut === GPT_STATUT_TENTATIVE_ÉCHOUÉE;
          const systemGPTChapitre =
            "Tu relis une lecture brève d'un chapitre de livre (fonction, point fort, point faible, à " +
            "vérifier, à approfondir dans l'audit final), pas le pré-audit complet. Signale uniquement des " +
            "manques réels ou des redites superflues dans CETTE lecture de chapitre — ne réécris rien.";
          const résultatGPT = await appellerGPTCritique(systemGPTChapitre, { lecture_chapitre: entrée.lecture.data });
          entrée.relecture = résultatGPT ?? { _statut: déjàTenté ? GPT_STATUT_INDISPONIBLE : GPT_STATUT_TENTATIVE_ÉCHOUÉE };
          const { error: erreurMaj } = await admin
            .from("audits")
            .update({ preaudit_chapitres_resultats: résultatsChapitres })
            .eq("id", auditId);
          if (erreurMaj) return json({ error: erreurMaj.message }, 500);
          return json({ audit_id: auditId, etape: "chapitre_relecture", chapitre_numero: i + 1, chapitre_total: chapitresConfirmés.length, chapitre_titre: chapitre.titre, restant: true });
        }
      }
    }

    // Passage 3 — Claude reprend SON PROPRE brouillon à la lumière de la
    // critique GPT (si elle a pu être obtenue) et des lectures chapitre par
    // chapitre (si confirmées), et produit la version finale.
    const { texteIntegral, systemPromptInitial } = construireTexteEtPrompt();
    const brouillonStocké = audit.preaudit_brouillon as { data: unknown; usage: unknown };
    const critiqueDisponible = audit.preaudit_critique_gpt && !(audit.preaudit_critique_gpt as { _statut?: string })._statut
      ? (audit.preaudit_critique_gpt as { data: unknown; usage: unknown })
      : null;
    const lecturesChapitresPourClaude = chapitresConfirmés.length > 0
      ? (audit.preaudit_chapitres_resultats as Array<{ lecture: { data: unknown } | null }>).map((r, i) => ({
          titre: chapitresConfirmés[i].titre,
          ...r.lecture?.data,
        }))
      : [];
    const systemAmendement =
      systemPromptInitial +
      "\n\nTU AS DÉJÀ PRODUIT UN BROUILLON (fourni dans le message utilisateur, avec le manuscrit)." +
      (critiqueDisponible
        ? " Un second lecteur (GPT) l'a relu et propose des amendements (elements_manquants, elements_superflus), également fournis."
        : " Le second lecteur (GPT) n'a pas pu répondre à temps cette fois — poursuis sans son avis, tu restes de toute façon seul juge en dernier ressort.") +
      (lecturesChapitresPourClaude.length > 0
        ? " Tu disposes aussi de lectures rapides, chapitre par chapitre, déjà produites séparément (contexte fourni) — tu peux t'en inspirer pour affiner recommandation_principale et plan_intervention, mais NE LES REPRODUIS PAS toi-même : elles seront ajoutées telles quelles au rapport final, à part."
        : "") +
      " Reprends TON PROPRE brouillon et produis la VERSION FINALE : intègre les remarques qui te semblent " +
      "justifiées et utiles, ignore celles qui ne le sont pas. Ce n'est PAS une nouvelle génération " +
      "indépendante : c'est une révision de ton propre travail, qui doit rester reconnaissable.";
    const versionFinale = await appelClaude(
      systemAmendement,
      JSON.stringify({
        manuscrit: texteIntegral,
        preaudit_brouillon: brouillonStocké.data,
        critique_gpt: critiqueDisponible?.data ?? null,
        lectures_chapitres: lecturesChapitresPourClaude.length > 0 ? lecturesChapitresPourClaude : undefined,
      })
    );

    const preauditResultat = {
      ...versionFinale.data,
      revision: { critique_gpt: critiqueDisponible?.data ?? null },
      lecture_chapitres: chapitresConfirmés.length > 0
        ? (audit.preaudit_chapitres_resultats as Array<{ lecture: { data: unknown } | null; relecture: unknown }>).map((r, i) => ({
            titre: chapitresConfirmés[i].titre,
            lecture: r.lecture?.data ?? null,
          }))
        : undefined,
      usage: {
        claude_brouillon: brouillonStocké.usage,
        gpt_critique: critiqueDisponible?.usage ?? null,
        claude_final: versionFinale.usage,
      },
      analyse_le: new Date().toISOString(),
    };

    const { error: erreurMaj } = await admin
      .from("audits")
      .update({ preaudit_statut: "termine", preaudit_resultat: preauditResultat })
      .eq("id", auditId);
    if (erreurMaj) return json({ error: erreurMaj.message }, 500);

    return json({ audit_id: auditId, etape: "termine", restant: false, preaudit: preauditResultat });
  } catch (err) {
    console.error("Erreur preaudit-approfondi-cursaudit :", err.message);
    return json({ error: err.message }, 500);
  }
});
