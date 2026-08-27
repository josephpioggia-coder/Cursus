/**
 * CURSAUDIT — Edge Function : synthese-audit-detaille-cursaudit (référence
 * 60816-01, suite, 27/08/2026)
 * ============================================================================
 * Équivalent de la fiche d'action éditoriale (fiche-action-preaudit-cursaudit,
 * même jour), côté AUDIT DÉTAILLÉ (les ~1400+ résultats unité par unité de
 * `orchestrer-audit-cursaudit`) plutôt que côté pré-audit. Même besoin
 * exprimé par l'auteur du projet : l'export Word de l'audit détaillé
 * (exportAuditDetailleWord.js) est un dump complet, utile comme annexe,
 * mais jamais un livrable client — il faut un document court, filtré et
 * priorisé, sur le même principe que la fiche d'action.
 *
 * NE RELIT JAMAIS LES UNITÉS DANS LEUR INTÉGRALITÉ : lit uniquement, pour
 * chaque unité déjà analysée, `diagnostic_priorite` (catégories + son
 * commentaire, le champ le plus dense en information de synthèse pour
 * cette unité) — pas les autres critères ni le texte source. Sur un livre
 * de 1400+ unités, envoyer l'intégralité de chaque analyse dépasserait le
 * temps d'exécution raisonnable d'un seul appel ; ce résumé compact reste
 * suffisant pour repérer des patrons récurrents (vérifié manuellement une
 * fois le 27/08/2026 sur un échantillon de 20 unités "à vérifier" avant de
 * construire cette fonction).
 *
 * ÉCHANTILLONNAGE si le livre est très long (> SEUIL_ECHANTILLON unités) :
 * un sous-ensemble régulièrement espacé (préserve l'ordre du livre) plutôt
 * que les 1400+ unités en entier — limite assumée, à revoir si un résumé
 * s'avère insuffisant en usage réel sur un très gros livre.
 *
 * PLAFOND DE LONGUEUR — même principe que la fiche d'action : le plus
 * petit de (a) la longueur du texte source, (b) le plafond commercial du
 * palier "audit détaillé de livre complet" (4000-8000 mots, fixé par
 * l'auteur du projet le 27/08/2026). Best-effort par consigne de prompt,
 * pas une garantie exacte.
 *
 * FICHIER AUTONOME (leçon du 16/08/2026). strict: true dès l'écriture
 * initiale, schéma conçu directement dans les limites connues (pas de
 * maxItems, minItems à 0 ou 1 seulement — leçon du 27/08/2026 sur
 * preaudit-approfondi-cursaudit). Même schéma de sortie que la fiche
 * d'action (fiche-action-preaudit-cursaudit) — cohérence d'affichage côté
 * client, un seul composant de rendu partagé.
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

// ─── Comblement défensif (même principe que les autres fonctions CursAudit) ─
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

// Même schéma de sortie que fiche-action-preaudit-cursaudit — cohérence
// d'affichage, un seul composant de rendu côté client pour les deux.
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

const PLAFOND_COMMERCIAL_MOTS = 8000; // palier "audit détaillé de livre complet", fixé le 27/08/2026
const SEUIL_ECHANTILLON = 400; // au-delà, échantillonnage régulièrement espacé

function choisirPlafondMots(nombreMots: number): number {
  return Math.min(nombreMots || PLAFOND_COMMERCIAL_MOTS, PLAFOND_COMMERCIAL_MOTS);
}

interface DiagnosticCompact { ordre: number; categories: string[]; commentaire: string }

function échantillonner(diagnostics: DiagnosticCompact[]): DiagnosticCompact[] {
  if (diagnostics.length <= SEUIL_ECHANTILLON) return diagnostics;
  const pas = diagnostics.length / SEUIL_ECHANTILLON;
  const retenus: DiagnosticCompact[] = [];
  for (let i = 0; i < SEUIL_ECHANTILLON; i++) retenus.push(diagnostics[Math.floor(i * pas)]);
  return retenus;
}

function construireSystemPrompt(nombreUnitésTotal: number, nombreUnitésEnvoyées: number, nombreMots: number, plafondMots: number): string {
  const noteÉchantillon = nombreUnitésEnvoyées < nombreUnitésTotal
    ? `Attention : tu reçois un échantillon de ${nombreUnitésEnvoyées} unités sur ${nombreUnitésTotal} au total (livre trop long pour tout envoyer en un seul appel), régulièrement réparti dans l'ordre du livre — traite-le comme représentatif, pas exhaustif.\n\n`
    : "";
  return (
    "Tu reçois les diagnostics déjà produits, unité par unité, par l'audit détaillé d'un livre entier. Pour " +
    "chaque unité : ses catégories (recevable/à nuancer/à sourcer/à reformuler/à vérifier) et le commentaire " +
    "qui justifie ce diagnostic. Tu ne relis pas le texte source du livre. Tu ne refais pas l'audit. Tu " +
    "produis une fiche d'action éditoriale complète, structurée, priorisée et directement exploitable — " +
    "l'objectif est de transformer des centaines de diagnostics isolés en un vrai document de travail pour " +
    "l'auteur·ice, à la hauteur d'un livre entier, pas un résumé expédié.\n\n" +
    noteÉchantillon +
    "RÈGLES NON NÉGOCIABLES :\n" +
    "- Ne reprends jamais un diagnostic unité par unité, ne résume pas mécaniquement la liste reçue.\n" +
    "- Regroupe les constats récurrents à travers le livre (le même problème répété dans des dizaines " +
    "d'unités devient UN SEUL point à traiter, développé et illustré, pas une liste).\n" +
    "- Écarte les alertes isolées sans enjeu réel — ne garde que ce qui change effectivement le travail de " +
    "réécriture à l'échelle du livre entier.\n" +
    "- Chaque point retenu contient un geste concret développé, jamais un simple constat en une ligne.\n" +
    "- N'invente aucun problème absent des diagnostics reçus.\n" +
    `- Ce document doit se rapprocher autant que possible de ${plafondMots} mots au total sans le dépasser ` +
    `(texte source : ${nombreMots} mots, ${nombreUnitésTotal} unités analysées). SUR UN LIVRE DE CETTE ` +
    "AMPLEUR, UN DOCUMENT DE DEUX PAGES EST UN ÉCHEC : développe chaque section sur plusieurs phrases, " +
    "appuie-toi sur des exemples concrets tirés des diagnostics reçus, ne te limite jamais à des puces " +
    "minimalistes.\n\n" +
    "Produis :\n" +
    "1. diagnostic : deux à quatre phrases développées — l'état d'ensemble du livre, ce qui domine dans les " +
    "diagnostics reçus.\n" +
    "2. forces : 5 à 12 forces concrètes qui reviennent dans les unités \"recevable\", chacune développée en " +
    "une à deux phrases, sans flatterie générale.\n" +
    "3. points_a_traiter : PAS de maximum arbitraire — un point par problème RÉCURRENT distinct identifié " +
    "dans les diagnostics (sur un livre de plusieurs centaines d'unités, attends-toi à en identifier une " +
    "quinzaine à une trentaine, pas 3 à 7). Chaque point : constat développé avec exemples tirés des " +
    "diagnostics, impact_lecteur développé, et geste_concret développé et actionnable — plusieurs phrases " +
    "par champ, jamais une ligne.\n" +
    "4. priorites : classement en rang \"1\"/\"2\"/\"3\" (1 = le plus urgent), chacun avec l'action " +
    "correspondante développée sur plusieurs phrases.\n" +
    "5. risque_principal : deux à trois phrases nettes — ce qui se passe si rien ne change à l'échelle du " +
    "livre entier.\n" +
    "6. action_immediate : une seule action, tranchée, immédiatement applicable, expliquée en plusieurs " +
    "phrases — la toute première chose à faire.\n" +
    "7. a_eviter : 3 à 6 fausses bonnes idées à éviter, chacune développée en une à deux phrases."
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
      .select("id, user_id, statut, apercu_resultat")
      .eq("id", auditId)
      .maybeSingle();
    if (!audit || audit.user_id !== userId) return json({ error: "Audit introuvable." }, 404);
    if (audit.statut !== "termine") {
      return json({ error: "audit_requis", message: "L'audit détaillé doit être terminé avant de générer sa synthèse." }, 409);
    }

    // Lecture paginée (leçon du 26/08/2026 sur le plafond de 1000 lignes de
    // Supabase/PostgREST) — uniquement les champs nécessaires à un résumé
    // compact, pas le texte source ni les critères détaillés.
    const TAILLE_PAGE = 1000;
    const diagnostics: DiagnosticCompact[] = [];
    for (let page = 0; ; page++) {
      const { data: lot } = await admin
        .from("audit_sections")
        .select("ordre, resultat_analyse")
        .eq("audit_id", auditId)
        .order("ordre", { ascending: true })
        .range(page * TAILLE_PAGE, page * TAILLE_PAGE + TAILLE_PAGE - 1);
      if (!lot || lot.length === 0) break;
      for (const s of lot) {
        const analyse = (s.resultat_analyse as { analyse?: Record<string, unknown>; erreur?: string } | null);
        if (!analyse || analyse.erreur) continue;
        const diagnosticPriorite = analyse.analyse?.diagnostic_priorite as { valeur?: string[]; commentaire?: string } | undefined;
        diagnostics.push({
          ordre: s.ordre as number,
          categories: diagnosticPriorite?.valeur ?? [],
          commentaire: diagnosticPriorite?.commentaire ?? "",
        });
      }
      if (lot.length < TAILLE_PAGE) break;
    }
    if (diagnostics.length === 0) return json({ error: "Aucune unité analysée dans cet audit." }, 400);

    const diagnosticsEnvoyés = échantillonner(diagnostics);
    const nombreMots = (audit.apercu_resultat as { nombre_mots?: number } | null)?.nombre_mots ?? 0;
    const plafondMots = choisirPlafondMots(nombreMots);

    const réponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODELE_CLAUDE,
        max_tokens: 16000,
        system: construireSystemPrompt(diagnostics.length, diagnosticsEnvoyés.length, nombreMots, plafondMots),
        messages: [{ role: "user", content: JSON.stringify(diagnosticsEnvoyés) }],
        tools: [{
          name: "fiche_action",
          description: "Fiche d'action éditoriale courte et priorisée, extraite des diagnostics d'un audit détaillé complet.",
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

    const syntheseResultat = {
      ...(donnéesComblées as Record<string, unknown>),
      plafond_mots_cible: plafondMots,
      nombre_mots_source: nombreMots,
      nombre_unites_total: diagnostics.length,
      nombre_unites_echantillonnees: diagnosticsEnvoyés.length,
      usage: { tokens_entree: résultatAPI.usage?.input_tokens ?? 0, tokens_sortie: résultatAPI.usage?.output_tokens ?? 0, modele: résultatAPI.model ?? MODELE_CLAUDE },
      analyse_le: new Date().toISOString(),
    };

    const { error: erreurMaj } = await admin
      .from("audits")
      .update({ synthese_audit_statut: "termine", synthese_audit_resultat: syntheseResultat })
      .eq("id", auditId);
    if (erreurMaj) return json({ error: erreurMaj.message }, 500);

    return json({ audit_id: auditId, synthese_audit: syntheseResultat });
  } catch (err) {
    console.error("Erreur synthese-audit-detaille-cursaudit :", err.message);
    return json({ error: err.message }, 500);
  }
});
