/**
 * CURSAUDIT — Edge Function : fiche-action-preaudit-cursaudit (référence
 * 60816-01, suite, 27/08/2026)
 * ============================================================================
 * SECOND DOCUMENT, demandé par l'auteur du projet après un test réel où le
 * pré-audit d'un texte de 1400 mots (deux pages) avait produit un rapport de
 * plusieurs dizaines de pages : le pré-audit complet
 * (preaudit-approfondi-cursaudit) reste utile et exhaustif comme base/annexe,
 * mais ne donne pas à l'auteur·ice une fiche courte et directement
 * actionnable. Analogie de l'auteur du projet : "j'ai un bilan détaillé
 * d'entreprise, je n'ai pas besoin d'un audit détaillé ligne par ligne mais
 * d'une vision globale concrète portant sur les points sur lesquels il est
 * important d'être attentif" — un tableau SWOT en texte, pas une nouvelle
 * analyse du manuscrit.
 *
 * NE RELIT JAMAIS LE MANUSCRIT : lit uniquement `audits.preaudit_resultat`
 * déjà produit, et le nombre de mots déjà calculé par l'aperçu gratuit
 * (`apercu_resultat.nombre_mots`) pour calibrer son propre plafond de
 * longueur — un seul appel Claude, comme l'aperçu.
 *
 * PLAFOND DE LONGUEUR — le plus petit des deux, comme demandé par l'auteur
 * du projet :
 *  1. la longueur du texte source (nombre de mots réel) ;
 *  2. un plafond commercial par palier (texte très court : 300-600 mots ;
 *     extrait/chapitre : 800-1500 ; pré-audit de manuscrit : 2000-4000).
 * Seuls ces trois premiers paliers s'appliquent ici (le palier "audit
 * détaillé de livre complet", 4000-8000 mots, concerne un futur
 * consolidateur de l'audit détaillé, pas cette fonction). Un plafond de mots
 * donné par consigne à un LLM reste du meilleur effort, pas une garantie
 * stricte — pas de vérification post-génération ici, à ajouter si un
 * dépassement réel est constaté en usage.
 *
 * FICHIER AUTONOME (leçon du 16/08/2026, voir preaudit-global-cursaudit) :
 * le mécanisme d'appel IA structuré est inliné ici, pas importé depuis
 * _shared/.
 *
 * strict: true dès l'écriture initiale (leçon du 27/08/2026 sur
 * preaudit-approfondi-cursaudit : minItems limité à 0/1, maxItems pas du
 * tout supporté sur un tableau en mode strict côté API Claude) — schéma
 * conçu directement dans ces limites, pas de maxItems, minItems à 0 ou 1
 * seulement.
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

const ajv = new Ajv({ allErrors: true, strict: false, useDefaults: true, removeAdditional: true });

// ─── Comblement défensif (même principe que preaudit-approfondi-cursaudit) ──
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

// Compilé une seule fois au chargement du module (leçon du 24/08/2026 sur
// preaudit-approfondi-cursaudit, v7.6) — jamais recompilé par requête.
const SCHEMA_FICHE_ACTION = {
  type: "object",
  properties: {
    diagnostic: { type: "string", default: "" },
    forces: { type: "array", items: { type: "string" }, minItems: 1, default: [] },
    points_a_traiter: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          constat: { type: "string", default: "" },
          impact_lecteur: { type: "string", default: "" },
          geste_concret: { type: "string", default: "" },
        },
        required: ["constat", "impact_lecteur", "geste_concret"],
        additionalProperties: false,
      },
    },
    priorites: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          rang: { type: "string", enum: ["1", "2", "3"] },
          action: { type: "string", default: "" },
        },
        required: ["rang", "action"],
        additionalProperties: false,
      },
    },
    risque_principal: { type: "string", default: "" },
    action_immediate: { type: "string", default: "" },
    a_eviter: { type: "array", items: { type: "string" }, minItems: 1, default: [] },
  },
  required: ["diagnostic", "forces", "points_a_traiter", "priorites", "risque_principal", "action_immediate", "a_eviter"],
  additionalProperties: false,
};
const validerFicheAction = ajv.compile(SCHEMA_FICHE_ACTION);

// Paliers fixés par l'auteur du projet le 27/08/2026 — seuls les trois
// premiers s'appliquent ici (le palier "audit détaillé de livre complet"
// concerne un futur consolidateur de l'audit détaillé unité par unité, pas
// cette fonction qui ne traite que le pré-audit).
function choisirPlafondMots(nombreMots: number): number {
  const plafondCommercial =
    nombreMots < 3000 ? 600
    : nombreMots < 15000 ? 1500
    : 4000;
  return Math.min(nombreMots, plafondCommercial);
}

function construireSystemPrompt(nombreMots: number, plafondMots: number): string {
  return (
    "Tu reçois un pré-audit déjà produit pour un texte. Tu ne relis pas le manuscrit. Tu ne refais pas " +
    "l'audit. Tu produis une fiche d'action éditoriale courte, lisible, priorisée et directement " +
    "exploitable — l'objectif est de transformer l'audit déjà fait en décisions de travail pour " +
    "l'auteur·ice, pas de le résumer platement.\n\n" +
    "RÈGLES NON NÉGOCIABLES :\n" +
    "- Ne reprends jamais une analyse unité par unité, ne résume pas mécaniquement le document reçu.\n" +
    "- Regroupe les constats récurrents plutôt que de les lister un par un.\n" +
    "- Écarte les alertes isolées sans enjeu réel — ne garde que ce qui change effectivement le travail " +
    "de réécriture.\n" +
    "- Chaque point retenu contient un geste concret, jamais un simple constat.\n" +
    "- N'invente aucun problème absent du pré-audit reçu.\n" +
    `- Ce document ne doit JAMAIS dépasser environ ${plafondMots} mots au total (texte source : ` +
    `${nombreMots} mots) — reste concis, en points denses, jamais en paragraphes développés.\n\n` +
    "Produis :\n" +
    "1. diagnostic : une phrase — le texte fonctionne-t-il, sous quelle forme réelle, avec quelle réserve " +
    "principale.\n" +
    "2. forces : 3 à 5 forces concrètes déjà présentes, sans flatterie générale.\n" +
    "3. points_a_traiter : 3 à 7 points maximum, chacun avec constat (ce qui pose problème), " +
    "impact_lecteur (ce que ça produit chez le lecteur), et geste_concret (l'action éditoriale à faire).\n" +
    "4. priorites : classement en rang \"1\"/\"2\"/\"3\" (1 = le plus urgent), chacun avec l'action " +
    "correspondante.\n" +
    "5. risque_principal : une phrase nette — ce qui se passe si rien ne change.\n" +
    "6. action_immediate : une seule action, tranchée, immédiatement applicable — la toute première chose " +
    "à faire.\n" +
    "7. a_eviter : 1 à 3 fausses bonnes idées à éviter."
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
      .select("id, user_id, preaudit_statut, preaudit_resultat, apercu_resultat")
      .eq("id", auditId)
      .maybeSingle();
    if (!audit || audit.user_id !== userId) return json({ error: "Audit introuvable." }, 404);
    if (audit.preaudit_statut !== "termine" || !audit.preaudit_resultat) {
      return json({ error: "preaudit_requis", message: "Le pré-audit approfondi doit être terminé avant de générer la fiche d'action." }, 409);
    }

    const nombreMots = (audit.apercu_resultat as { nombre_mots?: number } | null)?.nombre_mots ?? 0;
    const plafondMots = choisirPlafondMots(nombreMots || 2000);

    const réponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODELE_CLAUDE,
        max_tokens: 4096,
        system: construireSystemPrompt(nombreMots, plafondMots),
        messages: [{ role: "user", content: JSON.stringify(audit.preaudit_resultat) }],
        tools: [{
          name: "fiche_action",
          description: "Fiche d'action éditoriale courte et priorisée, extraite d'un pré-audit déjà produit.",
          input_schema: SCHEMA_FICHE_ACTION,
          strict: true,
        }],
        tool_choice: { type: "tool", name: "fiche_action" },
      }),
    });
    const résultatAPI = await réponse.json();
    if (!réponse.ok) return json({ error: résultatAPI?.error?.message || `Échec de l'appel Claude (${réponse.status}).` }, 502);
    if (résultatAPI.stop_reason === "max_tokens") {
      return json({ error: "La réponse a été tronquée (limite de longueur atteinte) — réessaie." }, 502);
    }

    const blocOutil = (résultatAPI.content ?? []).find((b: { type: string }) => b.type === "tool_use");
    if (!blocOutil) return json({ error: "Claude n'a renvoyé aucun bloc tool_use." }, 502);

    const donnéesComblées = combler(SCHEMA_FICHE_ACTION, blocOutil.input);
    if (!validerFicheAction(donnéesComblées)) {
      return json({ error: `Sortie non conforme au schéma : ${ajv.errorsText(validerFicheAction.errors)}` }, 502);
    }

    const ficheActionResultat = {
      ...(donnéesComblées as Record<string, unknown>),
      plafond_mots_cible: plafondMots,
      nombre_mots_source: nombreMots,
      usage: { tokens_entree: résultatAPI.usage?.input_tokens ?? 0, tokens_sortie: résultatAPI.usage?.output_tokens ?? 0, modele: résultatAPI.model ?? MODELE_CLAUDE },
      analyse_le: new Date().toISOString(),
    };

    const { error: erreurMaj } = await admin
      .from("audits")
      .update({ fiche_action_statut: "termine", fiche_action_resultat: ficheActionResultat })
      .eq("id", auditId);
    if (erreurMaj) return json({ error: erreurMaj.message }, 500);

    return json({ audit_id: auditId, fiche_action: ficheActionResultat });
  } catch (err) {
    console.error("Erreur fiche-action-preaudit-cursaudit :", err.message);
    return json({ error: err.message }, 500);
  }
});
