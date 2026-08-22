/**
 * CURSAUDIT — Edge Function : orchestrer-audit-cursaudit (référence 60816-01)
 * ============================================================================
 * Traite les unités non encore analysées d'un audit (`audit_sections` où
 * `resultat_analyse` est encore vide), par lots bornés dans le temps plutôt
 * que par nombre fixe — le temps par unité varie trop selon le mode IA
 * ("2 IA" fait deux appels par unité) et la longueur du texte pour qu'un
 * compte fixe soit fiable face à la limite d'exécution d'une Edge Function.
 *
 * ORCHESTRATION CLIENT, PAS DE TÂCHE DE FOND (limite assumée, pas cachée) :
 * cette fonction traite UN LOT et s'arrête — elle ne boucle pas elle-même
 * jusqu'à la fin de l'audit. C'est à l'appelant (aujourd'hui un script,
 * plus tard un bouton "Continuer" côté interface) de la rappeler tant que
 * `restantes > 0` dans la réponse. Rien ne continue tout seul si personne
 * ne rappelle — pas de cron, pas de file d'attente, pas encore construits.
 *
 * FICHIER AUTONOME, code dupliqué depuis analyser-unite-cursaudit plutôt que
 * partagé via _shared/ (leçon du 16/08/2026 sur verification-deux-ia : un
 * import relatif casse un déploiement par simple collage Dashboard). Si les
 * deux fichiers divergent un jour, c'est ce commentaire qu'il faut mettre à
 * jour en premier.
 *
 * GESTION D'ÉCHEC PAR UNITÉ : si l'appel IA échoue pour une unité (erreur
 * réseau, sortie non conforme...), la section reçoit
 * `resultat_analyse = { erreur: "..." }` plutôt que de rester vide — elle
 * ne sera donc PAS retentée automatiquement au prochain appel (pour éviter
 * une boucle qui échoue indéfiniment sur la même unité et bloque tout le
 * lot). Aucun mécanisme de nouvelle tentative manuelle n'existe encore —
 * à construire si des échecs réels apparaissent en usage.
 *
 * SECRETS REQUIS : ANTHROPIC_KEY, OPENAI_API_KEY, SUPABASE_URL,
 * SERVICE_ROLE_KEY (déjà en place).
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

// Budget de temps par appel — marge délibérée sous la limite d'exécution
// habituelle d'une Edge Function, pour laisser le temps de répondre proprement
// même si l'unité en cours au moment du dépassement doit encore se terminer.
const BUDGET_MS = 25000;

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

// ─── Construction dynamique du schéma, identique à analyser-unite-cursaudit ─

interface CritereActif { code: string; label: string; description: string | null; output_key: string; categories: string[] | null }

// 22/08/2026 — voir 2026-08-22-audit-criteria-categories.sql et le
// commentaire jumeau dans analyser-unite-cursaudit/index.ts : `categories`
// ferme le vocabulaire de `valeur` (tableau, pas une seule) pour les
// critères qui en ont, null pour les autres (texte libre inchangé).
function construireSchemaAnalyse(criteres: CritereActif[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const c of criteres) {
    const valeurSchema = c.categories && c.categories.length > 0
      ? { type: "array", items: { type: "string", enum: c.categories }, minItems: 1 }
      : { type: "string" };
    properties[c.output_key] = {
      type: "object",
      properties: { valeur: valeurSchema, commentaire: { type: "string" } },
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

// ─── Analyse d'une unité (logique identique à analyser-unite-cursaudit) ────

async function analyserUneSection(
  section: { id: string; texte_source: string },
  modeIA: string,
  criteres: CritereActif[],
  schema: Record<string, unknown>,
  consigneCriteres: string,
): Promise<Record<string, unknown>> {
  const systemClaude =
    "Tu es le moteur d'analyse de CursAudit. Pour l'unité de texte fournie, évalue-la selon " +
    "CHACUNE des dimensions suivantes, en indiquant pour chacune une valeur (catégorie observée) " +
    "et un bref commentaire justificatif ancré dans le texte fourni, jamais une supposition externe :\n" +
    consigneCriteres;

  const { data: analyse, usage: usageClaude } = await appellerMoteurIAStructure({
    moteur: "claude", modele: MODELE_CLAUDE, role: "analyseur_cursaudit",
    schema_sortie: schema, system: systemClaude, contexte: section.texte_source,
  });

  let controleGPT: unknown = null;
  let usageGPT: UsageIA | null = null;
  if (modeIA === "2 IA") {
    const systemGPT =
      "Tu es le second lecteur du moteur d'analyse CursAudit. Relis l'analyse ci-dessous, produite par un " +
      "premier moteur pour cette unité de texte, selon les mêmes dimensions :\n" + consigneCriteres +
      "\nSignale UNIQUEMENT les désaccords réels (une dimension classée de façon manifestement erronée au " +
      "regard du texte) — jamais une reformulation ou une préférence de nuance.";
    const résultatGPT = await appellerMoteurIAStructure({
      moteur: "gpt", modele: MODELE_GPT, role: "second_lecteur_cursaudit",
      schema_sortie: SCHEMA_CONTROLE_GPT, system: systemGPT,
      contexte: JSON.stringify({ texte_source: section.texte_source, analyse_premier_moteur: analyse }),
    });
    controleGPT = résultatGPT.data;
    usageGPT = résultatGPT.usage;
  }

  return { analyse, controle_gpt: controleGPT, mode_ia: modeIA, analyse_le: new Date().toISOString(), usage: { claude: usageClaude, gpt: usageGPT } };
}

// ─── Handler principal ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const départ = Date.now();

  try {
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
      .select("id, user_id, statut, nombre_dimensions, mode_ia")
      .eq("id", auditId)
      .maybeSingle();
    if (!audit || audit.user_id !== userId) return json({ error: "Audit introuvable." }, 404);
    if (audit.statut !== "paye" && audit.statut !== "en_traitement") {
      return json({ error: "statut_invalide", message: `Cet audit a le statut "${audit.statut}", ni payé ni en traitement.` }, 409);
    }
    if (MODES_NON_IMPLEMENTES.includes(audit.mode_ia)) {
      return json({ error: "mode_non_implemente", message: `Le mode "${audit.mode_ia}" n'est pas encore implémenté.` }, 501);
    }

    if (audit.statut === "paye") {
      await admin.from("audits").update({ statut: "en_traitement" }).eq("id", auditId);
    }

    const { data: criteresBruts } = await admin
      .from("audit_criteria")
      .select("code, label, description, output_key, min_grid_level, categories")
      .eq("is_active", true)
      .lte("min_grid_level", audit.nombre_dimensions)
      .order("sort_order", { ascending: true });
    const criteres = (criteresBruts ?? []) as CritereActif[];
    if (criteres.length === 0) return json({ error: "Aucun critère actif pour ce palier de dimensions." }, 500);
    const schema = construireSchemaAnalyse(criteres);
    const consigneCriteres = construireConsigneCriteres(criteres);

    const { data: sections } = await admin
      .from("audit_sections")
      .select("id, texte_source")
      .eq("audit_id", auditId)
      .is("resultat_analyse", null)
      .order("ordre", { ascending: true });
    const aTraiter = sections ?? [];

    let traiteesCetteFois = 0;
    let echoueesCetteFois = 0;

    for (const section of aTraiter) {
      if (Date.now() - départ > BUDGET_MS) break; // lot suivant au prochain appel

      try {
        const résultat = await analyserUneSection(section, audit.mode_ia, criteres, schema, consigneCriteres);
        await admin.from("audit_sections").update({ resultat_analyse: résultat }).eq("id", section.id);
        traiteesCetteFois++;
      } catch (err) {
        // Marquée en échec plutôt que laissée vide, pour ne pas être
        // retentée en boucle au prochain appel (voir note en tête de fichier).
        await admin.from("audit_sections").update({ resultat_analyse: { erreur: err.message, analyse_le: new Date().toISOString() } }).eq("id", section.id);
        echoueesCetteFois++;
      }
    }

    const { count: restantes } = await admin
      .from("audit_sections")
      .select("id", { count: "exact", head: true })
      .eq("audit_id", auditId)
      .is("resultat_analyse", null);

    // "Terminé" seulement s'il y avait réellement des unités à traiter —
    // sinon un audit sans la moindre unité (pas encore importée) serait
    // marqué terminé à tort dès le premier appel (bug réel du 16/08/2026,
    // repéré en test : restantes = 0 parce que rien n'existait, pas parce
    // que le travail était fait).
    const { count: totalUnites } = await admin
      .from("audit_sections")
      .select("id", { count: "exact", head: true })
      .eq("audit_id", auditId);

    let statutFinal = audit.statut === "paye" ? "en_traitement" : audit.statut;
    if ((restantes ?? 0) === 0 && (totalUnites ?? 0) > 0) {
      statutFinal = "termine";
      await admin.from("audits").update({ statut: "termine" }).eq("id", auditId);
    }

    return json({
      audit_id: auditId,
      traitees_cette_fois: traiteesCetteFois,
      echouees_cette_fois: echoueesCetteFois,
      restantes: restantes ?? 0,
      statut: statutFinal,
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
