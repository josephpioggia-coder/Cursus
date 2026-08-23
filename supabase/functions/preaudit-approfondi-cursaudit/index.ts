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
 * NIVEAU D'IA — décision du 23/08/2026 : 1 SEULE IA (Claude), jamais le
 * dialogue à deux IA (Claude + GPT) réservé à l'audit détaillé en mode
 * "2 IA". Garder le pré-audit rapide et bon marché ; le dialogisme
 * resterait à construire comme option premium plus tard si besoin, pas ici.
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
 * SECRETS REQUIS : ANTHROPIC_KEY, SUPABASE_URL, SERVICE_ROLE_KEY (déjà en place).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Ajv from "https://esm.sh/ajv@8?target=deno";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_KEY");

const MODELE_CLAUDE = "claude-sonnet-5";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS } });

const ajv = new Ajv({ allErrors: true, strict: false });

const SCHEMA_PREAUDIT_APPROFONDI = {
  type: "object",
  properties: {
    resume_executif: { type: "string" },
    nature_reelle: { type: "string" },
    promesse_affichee: { type: "string" },
    ecart_promesse_execution: { type: "string" },
    voies_editoriales: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          nom: { type: "string" },
          description: { type: "string" },
          ampleur_reecriture: { type: "string", enum: ["légère", "moyenne", "lourde"] },
          duree_estimee_travail: { type: "string" },
        },
        required: ["nom", "description", "ampleur_reecriture", "duree_estimee_travail"],
        additionalProperties: false,
      },
    },
    recommandation_principale: { type: "string" },
    plan_intervention: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          chantier: { type: "string" },
          geste_editorial: { type: "string" },
        },
        required: ["chantier", "geste_editorial"],
        additionalProperties: false,
      },
    },
    exemples_concrets: {
      type: "array",
      minItems: 3,
      items: {
        type: "object",
        properties: {
          probleme: { type: "string" },
          effet: { type: "string" },
          geste_editorial: { type: "string" },
          proposition: { type: "string" },
        },
        required: ["probleme", "effet", "geste_editorial", "proposition"],
        additionalProperties: false,
      },
    },
    a_preserver: { type: "array", items: { type: "string" } },
    a_couper_ou_alleger: { type: "array", items: { type: "string" } },
    prochaine_etape: { type: "string" },
  },
  required: [
    "resume_executif", "nature_reelle", "promesse_affichee", "ecart_promesse_execution", "voies_editoriales",
    "recommandation_principale", "plan_intervention", "exemples_concrets",
    "a_preserver", "a_couper_ou_alleger", "prochaine_etape",
  ],
  additionalProperties: false,
};

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

function construireSystemPrompt(contexteQualification: string, apercu: Record<string, unknown>): string {
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
    "Produis les 11 éléments suivants :\n" +
    "- resume_executif : 6 à 8 lignes MAXIMUM, en langage simple pour l'auteur·ice — ce livre fonctionne-t-il, comment, et quelle voie tu recommandes. Doit pouvoir se lire seul, avant tout le reste (ex. \"Votre livre fonctionne. Mais il fonctionne mieux comme fable méditative que comme roman. La voie recommandée est l'hybride équilibré.\").\n" +
    "- nature_reelle : ce que le manuscrit est réellement en train de faire (ex. \"fable méditative dialoguée plutôt que roman initiatique pleinement incarné\").\n" +
    "- promesse_affichee : ce que le livre promet au lecteur (préface, quatrième de couverture, ouverture...).\n" +
    "- ecart_promesse_execution : l'écart entre cette promesse et ce que la forme réelle tient effectivement (règle 7 : ancré dans des repères précis).\n" +
    "- voies_editoriales : EXACTEMENT 3 voies, du moins interventionniste au plus interventionniste (ex. assumer la forme actuelle en la clarifiant ; hybride équilibré ; transformation complète vers un genre pleinement incarné) — chacune avec son ampleur_reecriture (légère/moyenne/lourde) ET duree_estimee_travail (une estimation en temps, même approximative, ex. \"1 à 2 semaines\", \"3 à 6 semaines\", \"plusieurs mois\" — utile même imprécise).\n" +
    "- recommandation_principale : LA voie recommandée parmi les 3, franchement, avec la réserve explicite si l'auteur·ice vise délibérément autre chose.\n" +
    "- plan_intervention : 3 à 6 chantiers concrets (règles 1 et 7) — chacun un problème réel et nommé de CE livre et son geste_editorial, jamais \"à vérifier\".\n" +
    "- exemples_concrets : au moins 3, chacun avec probleme (ce qui se passe dans le texte), effet (ce que ça produit chez le lecteur), geste_editorial (l'action éditoriale concrète), et proposition (à quoi ça pourrait ressembler après ce geste) — sur des passages PRÉCIS du livre, pas des catégories génériques.\n" +
    "- a_preserver : ce qui fonctionne déjà et ne doit PAS être perdu, quelle que soit la voie choisie.\n" +
    "- a_couper_ou_alleger : ce qui alourdit le texte sans lui apporter de valeur (répétitions, longueurs...).\n" +
    "- prochaine_etape : voir règle 5."
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    if (!ANTHROPIC_KEY) return json({ error: "ANTHROPIC_KEY manquante." }, 500);
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
      .select("id, user_id, preaudit_statut, apercu_statut, apercu_resultat, type_document, finalite_audit, question_libre, degre_intervention, contraintes_academiques")
      .eq("id", auditId)
      .maybeSingle();
    if (!audit || audit.user_id !== userId) return json({ error: "Audit introuvable." }, 404);
    if (audit.apercu_statut !== "termine") {
      return json({ error: "apercu_requis", message: "L'aperçu gratuit doit être généré avant le pré-audit approfondi." }, 409);
    }
    if (audit.preaudit_statut !== "paye") {
      return json({ error: "paiement_requis", message: `Le pré-audit a le statut "${audit.preaudit_statut}", pas "paye".` }, 402);
    }

    const { data: sections } = await admin
      .from("audit_sections")
      .select("texte_source")
      .eq("audit_id", auditId)
      .order("ordre", { ascending: true });
    if (!sections || sections.length === 0) return json({ error: "Aucune unité dans cet audit." }, 400);

    const texteIntegral = sections.map((s) => s.texte_source).join("\n\n");
    const contexteQualification = construireContexteQualification(audit);
    const systemPrompt = construireSystemPrompt(contexteQualification, audit.apercu_resultat ?? {});

    const réponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODELE_CLAUDE,
        max_tokens: 16000,
        system: systemPrompt,
        messages: [{ role: "user", content: texteIntegral }],
        tools: [{ name: "preaudit_approfondi", description: "Plan de décision éditoriale : 3 voies, un plan d'intervention en chantiers, des exemples concrets actionnables, une prochaine étape honnête.", input_schema: SCHEMA_PREAUDIT_APPROFONDI }],
        tool_choice: { type: "tool", name: "preaudit_approfondi" },
      }),
    });
    const résultatAPI = await réponse.json();
    if (!réponse.ok) return json({ error: résultatAPI?.error?.message || `Échec de l'appel Claude (${réponse.status}).` }, 502);

    const blocOutil = (résultatAPI.content ?? []).find((b: { type: string }) => b.type === "tool_use");
    if (!blocOutil) return json({ error: "Claude n'a renvoyé aucun bloc tool_use." }, 502);

    const valide = ajv.compile(SCHEMA_PREAUDIT_APPROFONDI);
    if (!valide(blocOutil.input)) {
      return json({ error: `Sortie non conforme au schéma : ${ajv.errorsText(valide.errors)}` }, 502);
    }

    const preauditResultat = {
      ...blocOutil.input,
      usage: { tokens_entree: résultatAPI.usage?.input_tokens ?? 0, tokens_sortie: résultatAPI.usage?.output_tokens ?? 0, modele: résultatAPI.model ?? MODELE_CLAUDE },
      analyse_le: new Date().toISOString(),
    };

    const { error: erreurMaj } = await admin
      .from("audits")
      .update({ preaudit_statut: "termine", preaudit_resultat: preauditResultat })
      .eq("id", auditId);
    if (erreurMaj) return json({ error: erreurMaj.message }, 500);

    return json({ audit_id: auditId, preaudit: preauditResultat });
  } catch (err) {
    console.error("Erreur preaudit-approfondi-cursaudit :", err.message);
    return json({ error: err.message }, 500);
  }
});
