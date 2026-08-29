/**
 * CURSUS — Edge Function : extraire-profil-cursus (référence 60816-01,
 * suite, 28/08/2026)
 * ============================================================================
 * Extrait un profil auteur structuré (profession, niveau d'études, matières
 * étudiées, résumé du parcours) à partir d'un texte collé par l'auteur·ice
 * — un CV ou un profil LinkedIn, peu importe, tous deux traités comme du
 * texte brut. Aucun scraping LinkedIn, aucun accès API externe : l'auteur
 * colle lui-même le texte qu'il veut voir analysé.
 *
 * Ne remplace jamais la saisie manuelle — un simple outil de préremplissage
 * que l'auteur·ice peut corriger avant d'enregistrer. Voir ProfilAuteur.jsx.
 *
 * POURQUOI CE PROFIL EXISTE (demande explicite de l'auteur du projet,
 * 28/08/2026) : savoir qu'un auteur écrivant sur son métier est
 * effectivement psychologue, par exemple, a une vraie valeur pour l'audit
 * (crédibilité professionnelle des affirmations du texte) — pas une donnée
 * décorative. Champs démographiques (genre, âge) inclus sur demande
 * explicite de l'auteur du projet : pertinents notamment pour une
 * autobiographie ou un livre professionnel où l'identité de l'auteur·ice
 * fait partie du contrat de lecture.
 *
 * FICHIER AUTONOME (leçon du 16/08/2026) — pas d'import relatif, strict:true
 * dès l'écriture initiale, schéma conforme aux limites connues (pas de
 * maxItems, minItems à 0 ou 1 seulement — leçon du 27/08/2026).
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
  return "";
}

function combler(schema: Record<string, unknown>, data: unknown): unknown {
  if (schema.type !== "object") return data;
  const base = (typeof data === "object" && data !== null && !Array.isArray(data)) ? { ...(data as Record<string, unknown>) } : {};
  const requis = (schema.required as string[]) ?? [];
  const proprietes = (schema.properties as Record<string, Record<string, unknown>>) ?? {};
  for (const clé of requis) {
    const sousSchema = proprietes[clé] ?? { type: "string" };
    if (base[clé] === undefined || base[clé] === null) base[clé] = valeurParDéfaut(sousSchema);
  }
  return base;
}

const SCHEMA_PROFIL = {
  type: "object",
  properties: {
    profession: { type: "string", default: "" },
    niveau_etudes: { type: "string", default: "" },
    matieres_etudiees: { type: "string", default: "" },
    resume_parcours: { type: "string", default: "" },
  },
  required: ["profession", "niveau_etudes", "matieres_etudiees", "resume_parcours"],
  additionalProperties: false,
};
const validerProfil = ajv.compile(SCHEMA_PROFIL);

const SYSTEM_PROMPT =
  "Tu extrais un profil auteur à partir d'un texte brut (CV et/ou profil LinkedIn collés ou importés par " +
  "l'auteur·ice). Ne réponds JAMAIS sur la base d'une supposition : si une information n'est pas présente " +
  "dans le texte, laisse le champ correspondant vide plutôt que de l'inventer.\n\n" +
  "IMPORTANT — le texte peut contenir PLUSIEURS sources concaténées (marquées par des séparateurs " +
  "\"--- nom du fichier ---\"), par exemple un CV suivi d'un export LinkedIn, avec des informations " +
  "redondantes ou complémentaires. Fusionne ces sources en un seul profil cohérent : ne duplique jamais une " +
  "information répétée dans plusieurs sources, et complète les champs en croisant les sources entre elles " +
  "quand l'une précise ce que l'autre ne fait qu'évoquer.\n\n" +
  "Produis :\n" +
  "1. profession : le métier ou la profession actuelle/principale de l'auteur·ice, en quelques mots.\n" +
  "2. niveau_etudes : le niveau d'études le plus élevé mentionné (ex. \"Master\", \"Doctorat\", \"Autodidacte\").\n" +
  "3. matieres_etudiees : les domaines/matières d'études ou de spécialisation mentionnés, séparés par des virgules.\n" +
  "4. resume_parcours : deux à trois phrases résumant le parcours professionnel/académique, factuel, sans " +
  "extrapolation ni jugement de valeur.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    if (!ANTHROPIC_KEY) return json({ error: "ANTHROPIC_KEY manquante." }, 500);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await admin.auth.getUser(token);
    if (authError || !userData?.user) return json({ error: "Authentification requise." }, 401);

    const body = await req.json();
    const texte: string | undefined = body?.texte;
    if (!texte || texte.trim().length < 30) {
      return json({ error: "Texte trop court — colle un CV ou un profil LinkedIn complet." }, 400);
    }

    const réponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODELE_CLAUDE,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: texte.slice(0, 20000) }],
        tools: [{
          name: "profil_auteur",
          description: "Profil auteur extrait d'un CV ou d'un profil LinkedIn collé en texte brut.",
          input_schema: SCHEMA_PROFIL,
          strict: true,
        }],
        tool_choice: { type: "tool", name: "profil_auteur" },
      }),
    });
    const résultatAPI = await réponse.json();
    if (!réponse.ok) return json({ error: résultatAPI?.error?.message || `Échec de l'appel Claude (${réponse.status}).` }, 502);

    const blocOutil = (résultatAPI.content ?? []).find((b: { type: string }) => b.type === "tool_use");
    if (!blocOutil) return json({ error: "Claude n'a renvoyé aucun bloc tool_use." }, 502);

    const donnéesComblées = combler(SCHEMA_PROFIL, blocOutil.input);
    if (!validerProfil(donnéesComblées)) {
      return json({ error: `Sortie non conforme au schéma : ${ajv.errorsText(validerProfil.errors)}` }, 502);
    }

    return json({ profil: donnéesComblées });
  } catch (err) {
    console.error("Erreur extraire-profil-cursus :", err.message);
    return json({ error: err.message }, 500);
  }
});
