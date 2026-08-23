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
 * STRUCTURE EN 7 BLOCS validée par l'auteur du projet le 23/08/2026, après
 * un retour de GPT sur un premier prototype jugé "trop affirmatif pour un
 * pré-audit" : nature dominante, colonne vertébrale, contrat de lecture,
 * hypothèses de tension, échantillons à vérifier, audit recommandé,
 * décision éditoriale. RÈGLE DE TON EXPLICITE (le vrai problème du premier
 * prototype) : formuler les points comme des HYPOTHÈSES À VÉRIFIER dans
 * l'audit détaillé, jamais comme des verdicts déjà établis — "le pré-audit
 * ne condamne pas encore, il oriente l'enquête" (auteur du projet, 23/08).
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
    nature_dominante: { type: "string" },
    contrat_lecture: { type: "string" },
    colonne_vertebrale: { type: "string" },
    hypotheses_tension: { type: "array", items: { type: "string" } },
    echantillons_a_verifier: { type: "array", items: { type: "string" } },
    audit_recommande: {
      type: "object",
      properties: {
        axe_principal: { type: "string" },
        criteres: { type: "array", items: { type: "string" } },
      },
      required: ["axe_principal", "criteres"],
      additionalProperties: false,
    },
    decision_editoriale: {
      type: "object",
      properties: {
        voie_a: { type: "string" },
        voie_b: { type: "string" },
      },
      required: ["voie_a", "voie_b"],
      additionalProperties: false,
    },
  },
  required: [
    "nature_dominante", "contrat_lecture", "colonne_vertebrale", "hypotheses_tension",
    "echantillons_a_verifier", "audit_recommande", "decision_editoriale",
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
    "chaque unité une par une (un autre module fait déjà cela) : c'est de PROPOSER UNE LECTURE STRUCTURÉE " +
    "qui oriente l'audit détaillé qui suivra — sans jamais trancher à sa place.\n\n" +
    "RÈGLE DE TON, LA PLUS IMPORTANTE : tu n'es pas encore en train d'auditer, tu orientes l'enquête. " +
    "Ne formule JAMAIS un constat comme un verdict établi (\"Clara n'a pas d'arc dramatique\"). Formule " +
    "toujours une hypothèse à vérifier (\"Hypothèse à vérifier : Clara semble fonctionner davantage comme " +
    "élève-réceptacle que comme personnage autonome — il faudra cartographier ses moments de résistance et " +
    "de transformation réelle dans l'audit détaillé\"). Le pré-audit ne condamne pas, il oriente.\n\n" +
    `${contexteQualification}` +
    `Colonne vertébrale déjà repérée par l'aperçu : ${apercu?.colonne_vertebrale ?? "non disponible"}\n` +
    `Tension déjà repérée par l'aperçu : ${apercu?.tension_principale ?? "non disponible"}\n` +
    `Risques déjà repérés par l'aperçu : ${risques.length > 0 ? risques.join(" | ") : "aucun"}\n` +
    `Priorités déjà identifiées par l'aperçu : ${priorites.length > 0 ? priorites.join(" | ") : "aucune — identifie toi-même 3 à 5 priorités à partir du texte"}\n\n` +
    "Produis les 7 éléments suivants :\n" +
    "- nature_dominante : la nature dominante du manuscrit (ex. \"récit initiatique fonctionnant comme manuel dialogué\"), avec une phrase qui explique en quoi.\n" +
    "- contrat_lecture : ce que le livre promet au lecteur (roman ? initiation ? manuel ? méditation guidée ? fable ?) et si sa forme réelle tient cette promesse.\n" +
    "- colonne_vertebrale : condensée, 1 à 2 phrases — ce qui tient le livre de bout en bout.\n" +
    "- hypotheses_tension : 3 à 5 hypothèses (PAS des verdicts, voir règle de ton ci-dessus) sur les tensions ou fragilités les plus significatives de CE livre précis.\n" +
    "- echantillons_a_verifier : des passages ou scènes PRÉCIS du livre (pas une catégorie générique) que l'audit détaillé devrait examiner en priorité pour vérifier ces hypothèses.\n" +
    "- audit_recommande.axe_principal : sur quoi l'audit détaillé devrait porter en priorité pour ce livre (pas un palier générique, un axe de travail réel).\n" +
    "- audit_recommande.criteres : une liste concrète de critères à auditer en priorité.\n" +
    "- decision_editoriale.voie_a / voie_b : deux directions éditoriales possibles entre lesquelles l'auteur·ice devra choisir, sachant que l'audit détaillé ne sera pas le même selon la voie retenue."
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
        max_tokens: 6144,
        system: systemPrompt,
        messages: [{ role: "user", content: texteIntegral }],
        tools: [{ name: "preaudit_approfondi", description: "Lecture structurée en 7 blocs orientant l'audit détaillé.", input_schema: SCHEMA_PREAUDIT_APPROFONDI }],
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
