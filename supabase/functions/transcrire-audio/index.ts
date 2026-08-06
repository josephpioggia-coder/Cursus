/**
 * CURSUS — Edge Function : transcrire-audio (dictée vocale, 06/08/2026)
 * =========================================================
 * Reçoit un enregistrement audio (dicté depuis l'éditeur), le transmet à
 * l'API de transcription d'OpenAI, et renvoie le texte brut. Ce texte n'est
 * jamais écrit directement dans un projet par cette fonction — l'insertion
 * dans le manuscrit reste un geste explicite de l'auteur·e côté client,
 * après relecture (voir docs/fonctionnalite-dictee-vocale.md).
 *
 * SECRETS REQUIS dans Supabase → Settings → Edge Functions → Secrets :
 *   SUPABASE_URL      = déjà utilisée par les autres fonctions
 *   SERVICE_ROLE_KEY  = déjà utilisée par les autres fonctions
 *   OPENAI_API_KEY    = nouvelle — clé de compte OpenAI (platform.openai.com)
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SERVICE_ROLE_KEY")!
);

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function réponse(corps: unknown, status = 200) {
  return new Response(JSON.stringify(corps), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    if (!OPENAI_API_KEY) {
      return réponse({ error: "Transcription non configurée (OPENAI_API_KEY manquante)." }, 500);
    }

    // Identité réelle de l'appelant, jamais une valeur du corps de la requête.
    const enTeteAuth = req.headers.get("authorization") || "";
    const jeton = enTeteAuth.replace(/^Bearer\s+/i, "");
    if (!jeton) return réponse({ error: "Non authentifié." }, 401);

    const { data: { user } } = await supabase.auth.getUser(jeton);
    if (!user?.email) return réponse({ error: "Non authentifié." }, 401);

    const formulaireEntrant = await req.formData();
    const fichierAudio = formulaireEntrant.get("audio");
    if (!(fichierAudio instanceof File) && !(fichierAudio instanceof Blob)) {
      return réponse({ error: "Aucun fichier audio reçu." }, 400);
    }

    const langue = String(formulaireEntrant.get("langue") || "fr");

    const formulaireOpenAI = new FormData();
    formulaireOpenAI.append("file", fichierAudio, "dictee.webm");
    formulaireOpenAI.append("model", "gpt-4o-mini-transcribe");
    formulaireOpenAI.append("language", langue);

    const réponseOpenAI = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}` },
      body: formulaireOpenAI,
    });

    const résultat = await réponseOpenAI.json();
    if (!réponseOpenAI.ok) {
      return réponse({ error: résultat.error?.message || "Échec de la transcription." }, réponseOpenAI.status);
    }

    return réponse({ texte: résultat.text || "" });
  } catch (err) {
    console.error("Erreur transcrire-audio :", err.message);
    return réponse({ error: err.message }, 500);
  }
});
