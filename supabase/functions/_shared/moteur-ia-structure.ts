/**
 * Module partagé — appel IA à sortie structurée (décision du 15/08/2026,
 * voir docs/cursaudit-cartographie-technique.md section 2bis-a).
 *
 * Ne contient AUCUNE logique d'auth ni de facturation : uniquement le
 * mécanisme {moteur, role, schema_sortie, system, contexte} → sortie
 * validée contre le schéma. Chaque Edge Function consommatrice (protocole
 * 60805-06, moteur CursAudit) reste responsable de son propre contrôle
 * d'accès avant d'appeler ce module — voir claude-prox pour l'exemple du
 * contrôle d'accès à répliquer côté appelant.
 *
 * Dossier préfixé `_` : convention Supabase CLI, jamais déployé comme
 * fonction, seulement importé par les Edge Functions qui en ont besoin.
 */

import Ajv from "https://esm.sh/ajv@8?target=deno";

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

export interface AppelMoteurIAParams {
  /** Moteur IA à appeler. */
  moteur: "claude" | "gpt";
  /** Modèle exact (ex. "claude-sonnet-4-5-20250929", "gpt-4o") — jamais de valeur par défaut implicite. */
  modele: string;
  /** Rôle joué par l'appel (ex. "analyseur", "critique") — passé tel quel dans le system prompt par l'appelant. */
  role: string;
  /** JSON Schema que la sortie doit respecter. */
  schema_sortie: Record<string, unknown>;
  /** Prompt système. */
  system: string;
  /** Contexte/contenu à analyser. */
  contexte: string;
  /** Tokens de sortie maximum (Claude uniquement — obligatoire côté API Anthropic). */
  max_tokens?: number;
}

export interface UsageIA {
  tokens_entree: number;
  tokens_sortie: number;
  modele: string;
}

export interface AppelMoteurIAResultat {
  data: unknown;
  usage: UsageIA;
}

const ajv = new Ajv({ allErrors: true, strict: false });

function validerContreSchema(data: unknown, schema: Record<string, unknown>): void {
  const valide = ajv.compile(schema);
  if (!valide(data)) {
    throw new Error(
      `Sortie IA non conforme au schéma attendu : ${ajv.errorsText(valide.errors)}`,
    );
  }
}

async function appellerClaude(params: AppelMoteurIAParams): Promise<AppelMoteurIAResultat> {
  if (!ANTHROPIC_KEY) throw new Error("ANTHROPIC_KEY manquante.");

  const nomOutil = "sortie_structuree";
  const réponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: params.modele,
      max_tokens: params.max_tokens ?? 4096,
      system: params.system,
      messages: [{ role: "user", content: params.contexte }],
      tools: [
        {
          name: nomOutil,
          description: `Sortie structurée pour le rôle "${params.role}".`,
          input_schema: params.schema_sortie,
        },
      ],
      tool_choice: { type: "tool", name: nomOutil },
    }),
  });

  const résultat = await réponse.json();
  if (!réponse.ok) {
    throw new Error(résultat?.error?.message || `Échec de l'appel Claude (${réponse.status}).`);
  }

  const blocOutil = (résultat.content ?? []).find(
    (bloc: { type: string }) => bloc.type === "tool_use",
  );
  if (!blocOutil) {
    throw new Error("Claude n'a renvoyé aucun bloc tool_use — sortie structurée absente.");
  }

  validerContreSchema(blocOutil.input, params.schema_sortie);

  return {
    data: blocOutil.input,
    usage: {
      tokens_entree: résultat.usage?.input_tokens ?? 0,
      tokens_sortie: résultat.usage?.output_tokens ?? 0,
      modele: résultat.model ?? params.modele,
    },
  };
}

async function appellerGPT(params: AppelMoteurIAParams): Promise<AppelMoteurIAResultat> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY manquante.");

  const réponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: params.modele,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.contexte },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "sortie_structuree",
          schema: params.schema_sortie,
          strict: true,
        },
      },
    }),
  });

  const résultat = await réponse.json();
  if (!réponse.ok) {
    throw new Error(résultat?.error?.message || `Échec de l'appel GPT (${réponse.status}).`);
  }

  const contenuBrut = résultat.choices?.[0]?.message?.content;
  if (!contenuBrut) {
    throw new Error("GPT n'a renvoyé aucun contenu — sortie structurée absente.");
  }

  let data: unknown;
  try {
    data = JSON.parse(contenuBrut);
  } catch {
    throw new Error("Sortie GPT non parsable en JSON malgré response_format json_schema.");
  }

  validerContreSchema(data, params.schema_sortie);

  return {
    data,
    usage: {
      tokens_entree: résultat.usage?.prompt_tokens ?? 0,
      tokens_sortie: résultat.usage?.completion_tokens ?? 0,
      modele: résultat.model ?? params.modele,
    },
  };
}

/**
 * Point d'entrée unique : {moteur, role, schema_sortie, system, contexte}
 * → sortie validée contre schema_sortie. Lève une erreur si l'appel échoue
 * ou si la sortie ne respecte pas le schéma — jamais de sortie non validée
 * renvoyée à l'appelant.
 */
export async function appellerMoteurIAStructure(
  params: AppelMoteurIAParams,
): Promise<AppelMoteurIAResultat> {
  if (params.moteur === "claude") return appellerClaude(params);
  if (params.moteur === "gpt") return appellerGPT(params);
  throw new Error(`Moteur IA inconnu : "${params.moteur}".`);
}
