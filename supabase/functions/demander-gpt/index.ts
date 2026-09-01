/**
 * CURSUS — Edge Function : demander-gpt (référence 60816-01, suite, 30/08/2026)
 * ============================================================================
 * Relais serveur vers GPT pour les discussions de conception entre Joseph et
 * Claude Code — PAS une fonctionnalité du produit Cursus, pas d'authentification
 * utilisateur Supabase, pas de quota. Objectif unique : que la clé
 * OPENAI_API_KEY ne circule JAMAIS en dehors des secrets Supabase — jamais dans
 * le code source, le dépôt GitHub, le navigateur, les logs, ou une conversation
 * Claude/ChatGPT.
 *
 * SÉCURITÉ — deux secrets DISTINCTS, à ne jamais confondre :
 *   OPENAI_API_KEY   — la vraie clé OpenAI. Reste UNIQUEMENT dans les secrets
 *                       Supabase. Jamais transmise à Claude Code.
 *   RELAIS_GPT_TOKEN — un jeton généré par Joseph (ex. `openssl rand -hex 32`),
 *                       lui aussi stocké dans les secrets Supabase, mais dont
 *                       la valeur EST communiquée à Claude Code (dans le
 *                       terminal, jamais commitée) pour qu'il puisse appeler
 *                       cette fonction. S'il fuit, il ne permet que de
 *                       déclencher des appels GPT via cette fonction — jamais
 *                       d'accéder directement à OpenAI ni de récupérer la
 *                       vraie clé. Le régénérer (nouveau secret Supabase)
 *                       suffit à révoquer l'accès.
 *
 * Appel : POST avec header `Authorization: Bearer <RELAIS_GPT_TOKEN>` et corps
 * JSON { "prompt": "...", "modele": "gpt-4o" (optionnel) }.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const RELAIS_GPT_TOKEN = Deno.env.get("RELAIS_GPT_TOKEN");
const MODELE_PAR_DEFAUT = "gpt-4o";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  if (!RELAIS_GPT_TOKEN) {
    return json({ error: "RELAIS_GPT_TOKEN absent des secrets — fonction non configurée." }, 500);
  }
  if (!OPENAI_API_KEY) {
    return json({ error: "OPENAI_API_KEY absent des secrets — fonction non configurée." }, 500);
  }

  // Jeton dédié à ce relais — PAS un token Supabase utilisateur, PAS la clé
  // OpenAI. Comparaison directe suffisante : c'est un secret partagé à usage
  // interne, pas un système d'authentification multi-utilisateur.
  const authHeader = req.headers.get("Authorization") ?? "";
  const jetonFourni = authHeader.replace("Bearer ", "");
  if (jetonFourni !== RELAIS_GPT_TOKEN) {
    return json({ error: "Jeton invalide." }, 401);
  }

  try {
    const body = await req.json();
    const prompt: string | undefined = body?.prompt;
    if (!prompt || typeof prompt !== "string") {
      return json({ error: "Le champ 'prompt' (texte) est requis." }, 400);
    }
    const modele: string = typeof body?.modele === "string" ? body.modele : MODELE_PAR_DEFAUT;

    const réponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: modele,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await réponse.json();

    if (!réponse.ok || data.error) {
      return json({ error: data?.error?.message ?? `Erreur OpenAI (HTTP ${réponse.status}).` }, 502);
    }

    return json({
      réponse: data.choices?.[0]?.message?.content ?? "",
      usage: data.usage ?? null,
      modele: data.model ?? modele,
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
