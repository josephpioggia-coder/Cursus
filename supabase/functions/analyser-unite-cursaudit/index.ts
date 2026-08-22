/**
 * CURSAUDIT — Edge Function : analyser-unite-cursaudit
 * ============================================================================
 * Moteur d'analyse réel de CursAudit : note UNE unité de texte (une ligne de
 * `audit_sections`) selon la grille de critères active pour l'audit parent
 * (`audit_criteria`, filtrée par `min_grid_level <= audits.nombre_dimensions`
 * — Expert inclut les critères d'Approfondi et Essentiel, voir
 * docs/cursaudit-criteria-v1.md).
 *
 * FICHIER AUTONOME (leçon du 16/08/2026, voir verification-deux-ia) : le
 * mécanisme d'appel IA structuré est inliné ici, pas importé depuis
 * _shared/, pour rester déployable en un seul collage Dashboard.
 *
 * PORTÉE DE CETTE PREMIÈRE VERSION (documentée, pas cachée) :
 *  - Traite UNE unité par appel, jamais un audit entier — un document de
 *    255 unités dépasserait le temps d'exécution d'une Edge Function.
 *    L'orchestration qui boucle sur toutes les unités d'un audit (avec
 *    suivi de progression, marquage `audits.statut = 'termine'` une fois
 *    tout traité) N'EST PAS ENCORE ÉCRITE — reste à faire.
 *  - Modes IA implémentés : "1 IA" (un seul appel Claude) et "2 IA" (Claude
 *    puis un second appel GPT qui relit et signale ses désaccords, sans
 *    réécrire le résultat de Claude). "2 IA + confrontation ciblée" et
 *    "2 IA + arbitrage dialogique" (dialogue multi-tours façon protocole
 *    60805-06) NE SONT PAS IMPLÉMENTÉS — la fonction refuse ces deux modes
 *    explicitement plutôt que de les dégrader silencieusement vers "2 IA".
 *  - Facturation : cette fonction ne vérifie PAS de quota mensuel (CursAudit
 *    est facturé à l'acte, pas par abonnement) — elle exige
 *    `audits.statut = 'paye'`. Aucun flux Stripe pour CursAudit n'existe
 *    encore ; en attendant, `statut` se positionne manuellement (SQL) pour
 *    les tests, comme pour le premier test de verification-deux-ia.
 *  - Aucune consommation n'est journalisée dans `usage_ia` : cette table
 *    sert le quota mensuel de Cursus Édition, pas la facturation à l'acte
 *    de CursAudit — les compter ensemble fausserait le quota de l'auteur·e.
 *    Pas de table de suivi dédiée pour l'instant (pas encore conçue).
 *
 * SECRETS REQUIS : ANTHROPIC_KEY, OPENAI_API_KEY, SUPABASE_URL,
 * SERVICE_ROLE_KEY (tous déjà en place).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Ajv from "https://esm.sh/ajv@8?target=deno";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const MODELE_CLAUDE = "claude-sonnet-5";
const MODELE_GPT = "gpt-4o";

const MODES_NON_IMPLEMENTES = ["2 IA + confrontation ciblée", "2 IA + arbitrage dialogique"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS } });

// ─── Module IA structuré (inliné, voir note en tête de fichier) ───────────

interface AppelMoteurIAParams {
  moteur: "claude" | "gpt";
  modele: string;
  role: string;
  schema_sortie: Record<string, unknown>;
  system: string;
  contexte: string;
  max_tokens?: number;
}
interface UsageIA { tokens_entree: number; tokens_sortie: number; modele: string }
interface AppelMoteurIAResultat { data: unknown; usage: UsageIA }

const ajv = new Ajv({ allErrors: true, strict: false });

function validerContreSchema(data: unknown, schema: Record<string, unknown>): void {
  const valide = ajv.compile(schema);
  if (!valide(data)) throw new Error(`Sortie IA non conforme au schéma attendu : ${ajv.errorsText(valide.errors)}`);
}

function normaliserTableauxNuls(schema: Record<string, unknown>, data: unknown): unknown {
  if (data === null || typeof data !== "object" || Array.isArray(data)) return data;
  const props = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
  const résultat: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  for (const [cle, sousSchema] of Object.entries(props)) {
    if (sousSchema.type === "array" && (résultat[cle] === null || résultat[cle] === undefined)) résultat[cle] = [];
  }
  return résultat;
}

async function appellerClaudeMoteur(params: AppelMoteurIAParams): Promise<AppelMoteurIAResultat> {
  if (!ANTHROPIC_KEY) throw new Error("ANTHROPIC_KEY manquante.");
  const nomOutil = "sortie_structuree";
  const réponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: params.modele,
      max_tokens: params.max_tokens ?? 4096,
      system: params.system,
      messages: [{ role: "user", content: params.contexte }],
      tools: [{ name: nomOutil, description: `Sortie structurée pour le rôle "${params.role}".`, input_schema: params.schema_sortie }],
      tool_choice: { type: "tool", name: nomOutil },
    }),
  });
  const résultat = await réponse.json();
  if (!réponse.ok) throw new Error(résultat?.error?.message || `Échec de l'appel Claude (${réponse.status}).`);
  const blocOutil = (résultat.content ?? []).find((bloc: { type: string }) => bloc.type === "tool_use");
  if (!blocOutil) throw new Error("Claude n'a renvoyé aucun bloc tool_use — sortie structurée absente.");
  const donneesNormalisees = normaliserTableauxNuls(params.schema_sortie, blocOutil.input);
  validerContreSchema(donneesNormalisees, params.schema_sortie);
  return {
    data: donneesNormalisees,
    usage: { tokens_entree: résultat.usage?.input_tokens ?? 0, tokens_sortie: résultat.usage?.output_tokens ?? 0, modele: résultat.model ?? params.modele },
  };
}

async function appellerGPTMoteur(params: AppelMoteurIAParams): Promise<AppelMoteurIAResultat> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY manquante.");
  const réponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: params.modele,
      messages: [{ role: "system", content: params.system }, { role: "user", content: params.contexte }],
      response_format: { type: "json_schema", json_schema: { name: "sortie_structuree", schema: params.schema_sortie, strict: true } },
    }),
  });
  const résultat = await réponse.json();
  if (!réponse.ok) throw new Error(résultat?.error?.message || `Échec de l'appel GPT (${réponse.status}).`);
  const contenuBrut = résultat.choices?.[0]?.message?.content;
  if (!contenuBrut) throw new Error("GPT n'a renvoyé aucun contenu — sortie structurée absente.");
  let data: unknown;
  try {
    data = JSON.parse(contenuBrut);
  } catch {
    throw new Error("Sortie GPT non parsable en JSON malgré response_format json_schema.");
  }
  const donneesNormalisees = normaliserTableauxNuls(params.schema_sortie, data);
  validerContreSchema(donneesNormalisees, params.schema_sortie);
  return {
    data: donneesNormalisees,
    usage: { tokens_entree: résultat.usage?.prompt_tokens ?? 0, tokens_sortie: résultat.usage?.completion_tokens ?? 0, modele: résultat.model ?? params.modele },
  };
}

async function appellerMoteurIAStructure(params: AppelMoteurIAParams): Promise<AppelMoteurIAResultat> {
  if (params.moteur === "claude") return appellerClaudeMoteur(params);
  if (params.moteur === "gpt") return appellerGPTMoteur(params);
  throw new Error(`Moteur IA inconnu : "${params.moteur}".`);
}

// ─── Construction dynamique du schéma de sortie, à partir d'audit_criteria ─

interface CritereActif {
  code: string;
  label: string;
  description: string | null;
  output_key: string;
  categories: string[] | null;
}

// 22/08/2026 — `categories` (voir 2026-08-22-audit-criteria-categories.sql) :
// null pour la grande majorité des critères, qui restent en texte libre
// (leur richesse qualitative est voulue, un livre entier ne s'en sert pas
// pour un comptage). Un critère avec `categories` renseignées (aujourd'hui
// seul diagnostic_priorite) devient un TABLEAU de valeurs prises dans cette
// liste fermée — un tableau plutôt qu'une valeur unique parce qu'une unité
// réelle peut cumuler plusieurs diagnostics à la fois (ex. "à nuancer" ET
// "à sourcer"), observé dans le test du 22/08/2026. C'est ce qui permet à
// l'écran de résultat de compter/filtrer sur un livre de 60000 mots sans
// devoir lire chaque commentaire un par un.
function construireSchemaAnalyse(criteres: CritereActif[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const c of criteres) {
    const valeurSchema = c.categories && c.categories.length > 0
      ? { type: "array", items: { type: "string", enum: c.categories }, minItems: 1 }
      : { type: "string" };
    properties[c.output_key] = {
      type: "object",
      properties: {
        valeur: valeurSchema,
        commentaire: { type: "string" },
      },
      required: ["valeur", "commentaire"],
      additionalProperties: false,
    };
    required.push(c.output_key);
  }
  return { type: "object", properties, required, additionalProperties: false };
}

function construireConsigneCriteres(criteres: CritereActif[]): string {
  return criteres
    .map((c) => {
      const consigneCategories = c.categories && c.categories.length > 0
        ? ` — valeur = un TABLEAU d'une ou plusieurs de ces catégories exactes : ${c.categories.join(", ")} (cumule-les si plusieurs s'appliquent à la fois, n'en invente aucune autre)`
        : "";
      return `- ${c.output_key} (${c.label}) : ${c.description ?? "sans description"}${consigneCategories}`;
    })
    .join("\n");
}

// ─── Qualification de la demande (questionnaire, réf. 60816-01, suite, 22/08/2026) ─
// Injecte dans le prompt système la question libre et le degré
// d'intervention posés par l'auteur·ice avant analyse (sections 4 et 5 de
// questionnaire-cursaudit-v1-specification.md, câblées côté UI dans
// CursAuditQuestionnaire.jsx). LIMITE ASSUMÉE : le moteur ne produit
// toujours qu'un diagnostic (valeur + commentaire) par critère, jamais un
// texte réécrit séparé — les degrés "reformulation"/"réécriture" ne
// changent que ce que le commentaire peut contenir, pas la forme de sortie.
const LABELS_DEGRE_INTERVENTION: Record<string, string> = {
  observer: "Observer seulement : diagnostique, ne suggère aucune correction.",
  signaler: "Signale les problèmes, sans proposer de solution.",
  pistes: "Propose des pistes de correction dans le commentaire, sans reformuler à la place de l'auteur·ice.",
  reformulations_ponctuelles: "Tu peux glisser une suggestion de reformulation ponctuelle dans le commentaire si cela aide à comprendre le problème — jamais une réécriture complète.",
  reecrire_legerement: "Tu peux esquisser une reformulation dans le commentaire, mais la sortie reste un diagnostic, pas un texte de remplacement (aucun champ dédié à la réécriture n'existe).",
  reecrire_librement: "Même limite que ci-dessus, en te montrant plus libre dans la reformulation suggérée au sein du commentaire.",
};

// Degrés qui autorisent le champ `proposition` (voir SCHEMA_SYNTHESE_EDITORIALE
// plus bas) — "observer"/"signaler", et l'absence de choix (audits créés
// avant ce questionnaire), restent délibérément SANS proposition : défaut
// prudent, pas de suggestion non sollicitée sans consentement explicite.
const DEGRES_AUTORISANT_PROPOSITION = new Set([
  "pistes", "reformulations_ponctuelles", "reecrire_legerement", "reecrire_librement",
]);

interface AuditQualification {
  type_document: string | null;
  finalite_audit: string[] | null;
  question_libre: string | null;
  degre_intervention: string | null;
  contraintes_academiques: { autorisationIA?: string; conditions?: string[] } | null;
  relation_ia: { adresse?: string; ton?: string; posture?: string; longueur?: string; role?: string } | null;
}

function construireContexteQualification(audit: AuditQualification): string {
  const lignes: string[] = [];
  if (audit.type_document) {
    lignes.push(`Type de document audité : ${audit.type_document}.`);
  }
  if (audit.finalite_audit && audit.finalite_audit.length > 0) {
    lignes.push(`Ce que l'auteur·ice cherche à obtenir de cet audit : ${audit.finalite_audit.join(", ")}.`);
  }
  if (audit.question_libre) {
    lignes.push(`Question posée par l'auteur·ice pour cet audit, à garder à l'esprit pour chaque unité : "${audit.question_libre}"`);
  }
  if (audit.degre_intervention && LABELS_DEGRE_INTERVENTION[audit.degre_intervention]) {
    lignes.push(`Degré d'intervention autorisé : ${LABELS_DEGRE_INTERVENTION[audit.degre_intervention]}`);
  }
  if (audit.contraintes_academiques?.autorisationIA === "Non") {
    lignes.push("L'établissement de l'auteur·ice N'AUTORISE PAS l'usage de l'IA sur ce travail — reste strictement au diagnostic, aucune proposition ni reformulation, quel que soit le degré d'intervention choisi par ailleurs.");
  } else if (audit.contraintes_academiques?.conditions && audit.contraintes_academiques.conditions.length > 0) {
    lignes.push(`Conditions académiques à respecter : ${audit.contraintes_academiques.conditions.join(", ")}.`);
  }
  if (audit.relation_ia) {
    const r = audit.relation_ia;
    const parts = [
      r.adresse === "vous" ? "vouvoie l'auteur·ice" : "tutoie l'auteur·ice",
      r.ton ? `ton ${r.ton}` : null,
      r.posture ? `posture ${r.posture}` : null,
      r.longueur === "court" ? "commentaires courts" : "commentaires détaillés",
      r.role ? `plutôt en ${r.role}` : null,
    ].filter(Boolean);
    lignes.push(`Style attendu dans les commentaires : ${parts.join(", ")}.`);
  }
  return lignes.length > 0 ? lignes.join("\n") + "\n\n" : "";
}

// ─── Synthèse éditoriale globale par unité (réf. 60816-01, suite, 22/08/2026) ─
// Ajoutée à la demande de l'auteur du projet, après échange avec GPT : le
// diagnostic critère par critère ne suffit pas pour un écrivain — il
// manque un niveau "ce qu'il faudrait faire", pas seulement "ce que le
// texte est". Champs choisis en écartant ceux qui font doublon avec des
// critères déjà présents dans audit_criteria (ex. `risque_influence`
// couvre déjà ce que GPT proposait comme "risque_principal") :
//  - effet_lecteur : axe absent ailleurs, comment le texte atterrit chez
//    un lecteur (pas s'il est vrai/prouvé, mais ce qu'il produit comme effet).
//  - geste_editorial : le pont entre diagnostic et correction, une
//    direction de travail, pas encore une réécriture.
//  - action_recommandee : vocabulaire fermé, catégorisable comme
//    diagnostic_priorite — jamais gated par le degré d'intervention (c'est
//    un conseil sur ce QUE l'auteur·ice pourrait faire, pas une
//    intervention de CursAudit lui-même).
//  - proposition : seule à être réellement gated par le degré
//    d'intervention (voir DEGRES_AUTORISANT_PROPOSITION) — vide si
//    "observer"/"signaler"/non renseigné, ou si l'établissement académique
//    n'autorise pas l'IA.
const EFFETS_LECTEUR = [
  "adhesion", "resistance", "emotion", "confusion", "fatigue",
  "curiosite", "malaise", "impression_de_profondeur", "impression_de_repetition",
];
const ACTIONS_RECOMMANDEES = [
  "conserver", "alleger", "nuancer", "deplacer", "developper",
  "couper", "sourcer", "reformuler", "reecrire", "expertiser",
];

function construireSchemaSyntheseEditoriale(autoriserProposition: boolean): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      effet_lecteur: {
        type: "object",
        properties: {
          valeur: { type: "array", items: { type: "string", enum: EFFETS_LECTEUR }, minItems: 1 },
          commentaire: { type: "string" },
        },
        required: ["valeur", "commentaire"],
        additionalProperties: false,
      },
      geste_editorial: {
        type: "object",
        properties: { valeur: { type: "string" }, commentaire: { type: "string" } },
        required: ["valeur", "commentaire"],
        additionalProperties: false,
      },
      action_recommandee: {
        type: "object",
        properties: {
          valeur: { type: "string", enum: ACTIONS_RECOMMANDEES },
          commentaire: { type: "string" },
        },
        required: ["valeur", "commentaire"],
        additionalProperties: false,
      },
      proposition: autoriserProposition ? { type: "string" } : { type: "null" },
    },
    required: ["effet_lecteur", "geste_editorial", "action_recommandee", "proposition"],
    additionalProperties: false,
  };
}

function construireConsigneSyntheseEditoriale(autoriserProposition: boolean): string {
  const consigneProposition = autoriserProposition
    ? `- proposition : une suggestion concrète et actionnable (reformulation, piste de correction), en respectant strictement le degré d'intervention autorisé ci-dessus — jamais au-delà.`
    : `- proposition : DOIT être null. Le degré d'intervention choisi (ou son absence) n'autorise aucune proposition de correction — diagnostique et oriente (geste_editorial) sans jamais rédiger à la place de l'auteur·ice.`;
  return (
    "En plus de l'évaluation critère par critère, produis une synthèse éditoriale globale pour cette unité :\n" +
    `- effet_lecteur : un tableau d'une ou plusieurs de ces catégories exactes : ${EFFETS_LECTEUR.join(", ")} — l'effet que ce passage produirait chez un lecteur, pas s'il est vrai ou prouvé.\n` +
    `- geste_editorial : une direction de travail concrète mais non rédigée (ex. "ramener l'énoncé vers le vécu de l'auteur·ice plutôt que vers une généralisation").\n` +
    `- action_recommandee : une seule de ces catégories exactes : ${ACTIONS_RECOMMANDEES.join(", ")}.\n` +
    consigneProposition
  );
}

function fusionnerSchemas(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  return {
    type: "object",
    properties: { ...(a.properties as object), ...(b.properties as object) },
    required: [...(a.required as string[]), ...(b.required as string[])],
    additionalProperties: false,
  };
}

const SCHEMA_CONTROLE_GPT = {
  type: "object",
  properties: {
    accord: { type: "boolean" },
    desaccords: {
      type: "array",
      items: {
        type: "object",
        properties: { critere: { type: "string" }, raison: { type: "string" } },
        required: ["critere", "raison"],
        additionalProperties: false,
      },
    },
  },
  required: ["accord", "desaccords"],
  additionalProperties: false,
};

// ─── Handler principal ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Authentification
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await admin.auth.getUser(token);
    if (authError || !userData?.user) return json({ error: "Authentification requise." }, 401);
    const userId = userData.user.id;

    // 2. Corps de la requête
    const body = await req.json();
    const auditSectionId: string | undefined = body?.audit_section_id;
    if (!auditSectionId) return json({ error: "audit_section_id est requis." }, 400);

    // 3. Charger l'unité et son audit parent, vérifier propriété + paiement
    const { data: section } = await admin
      .from("audit_sections")
      .select("id, audit_id, texte_source")
      .eq("id", auditSectionId)
      .maybeSingle();
    if (!section) return json({ error: "Unité introuvable." }, 404);

    const { data: audit } = await admin
      .from("audits")
      .select("id, user_id, statut, nombre_dimensions, mode_ia, type_document, finalite_audit, question_libre, degre_intervention, contraintes_academiques, relation_ia")
      .eq("id", section.audit_id)
      .maybeSingle();
    if (!audit || audit.user_id !== userId) return json({ error: "Audit introuvable." }, 404);
    if (audit.statut !== "paye") {
      return json({ error: "paiement_requis", message: "Cet audit n'est pas encore payé." }, 402);
    }
    if (MODES_NON_IMPLEMENTES.includes(audit.mode_ia)) {
      return json({ error: "mode_non_implemente", message: `Le mode "${audit.mode_ia}" n'est pas encore implémenté dans le moteur d'analyse.` }, 501);
    }

    // 4. Grille de critères active — cumulative selon le palier (Expert
    //    inclut Approfondi et Essentiel, voir docs/cursaudit-criteria-v1.md).
    const { data: criteresBruts } = await admin
      .from("audit_criteria")
      .select("code, label, description, output_key, min_grid_level, categories")
      .eq("is_active", true)
      .lte("min_grid_level", audit.nombre_dimensions)
      .order("sort_order", { ascending: true });
    const criteres = (criteresBruts ?? []) as CritereActif[];
    if (criteres.length === 0) return json({ error: "Aucun critère actif pour ce palier de dimensions." }, 500);

    const autoriserProposition =
      DEGRES_AUTORISANT_PROPOSITION.has(audit.degre_intervention ?? "") &&
      audit.contraintes_academiques?.autorisationIA !== "Non";
    const schema = fusionnerSchemas(construireSchemaAnalyse(criteres), construireSchemaSyntheseEditoriale(autoriserProposition));
    const consigneCriteres = construireConsigneCriteres(criteres);

    // 5. Analyse Claude (toujours) puis, si mode_ia = "2 IA", contrôle GPT.
    const contexteQualification = construireContexteQualification(audit);
    const systemClaude =
      contexteQualification +
      "Tu es le moteur d'analyse de CursAudit. Pour l'unité de texte fournie, évalue-la selon " +
      "CHACUNE des dimensions suivantes, en indiquant pour chacune une valeur (catégorie observée) " +
      "et un bref commentaire justificatif ancré dans le texte fourni, jamais une supposition externe :\n" +
      consigneCriteres + "\n\n" +
      construireConsigneSyntheseEditoriale(autoriserProposition);

    const { data: analyse, usage: usageClaude } = await appellerMoteurIAStructure({
      moteur: "claude",
      modele: MODELE_CLAUDE,
      role: "analyseur_cursaudit",
      schema_sortie: schema,
      system: systemClaude,
      contexte: section.texte_source,
    });

    let controleGPT: unknown = null;
    let usageGPT: UsageIA | null = null;
    if (audit.mode_ia === "2 IA") {
      const systemGPT =
        "Tu es le second lecteur du moteur d'analyse CursAudit. Relis l'analyse ci-dessous, produite par un " +
        "premier moteur pour cette unité de texte, selon les mêmes dimensions :\n" + consigneCriteres +
        "\nSignale UNIQUEMENT les désaccords réels (une dimension classée de façon manifestement erronée au " +
        "regard du texte) — jamais une reformulation ou une préférence de nuance.";
      const résultatGPT = await appellerMoteurIAStructure({
        moteur: "gpt",
        modele: MODELE_GPT,
        role: "second_lecteur_cursaudit",
        schema_sortie: SCHEMA_CONTROLE_GPT,
        system: systemGPT,
        contexte: JSON.stringify({ texte_source: section.texte_source, analyse_premier_moteur: analyse }),
      });
      controleGPT = résultatGPT.data;
      usageGPT = résultatGPT.usage;
    }

    // 6. Stockage du résultat
    const resultatAnalyse = {
      analyse,
      controle_gpt: controleGPT,
      mode_ia: audit.mode_ia,
      analyse_le: new Date().toISOString(),
    };
    const { error: erreurMaj } = await admin
      .from("audit_sections")
      .update({ resultat_analyse: resultatAnalyse })
      .eq("id", auditSectionId);
    if (erreurMaj) return json({ error: erreurMaj.message }, 500);

    return json({
      audit_section_id: auditSectionId,
      resultat_analyse: resultatAnalyse,
      usage: { claude: usageClaude, gpt: usageGPT },
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
