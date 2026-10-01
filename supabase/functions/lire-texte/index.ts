/**
 * CURSUS — Edge Function : lire-texte (lecture à voix haute "pro", 01/10/2026)
 * ============================================================================
 * Remplace la synthèse vocale native du navigateur (window.speechSynthesis,
 * jugée "vraiment nulle" par Joseph — retour direct) par l'API de synthèse
 * vocale d'OpenAI (gpt-4o-mini-tts) : voix nettement plus naturelles, choix
 * de voix et de vitesse côté client. Réutilise OPENAI_API_KEY, déjà
 * configurée pour transcrire-audio (dictée vocale) — aucun nouveau
 * compte/secret à créer.
 *
 * Contrairement à claude-prox/demander-gpt : PAS un relais JSON. OpenAI
 * renvoie de l'audio brut (mp3) sur succès, retransmis tel quel au client ;
 * seules les erreurs restent en JSON.
 *
 * Limite d'entrée d'OpenAI : 4096 caractères par appel — refusée ici avec un
 * message clair plutôt que tronquée en silence. Le découpage d'un texte plus
 * long en tranches successives est fait côté CLIENT (src/lib/lectureVoix.js),
 * qui enchaîne plusieurs appels — garde cette fonction simple (un texte →
 * un son) et permet d'annuler/mettre en pause au milieu d'un texte long sans
 * logique de session côté serveur.
 *
 * ACCÈS : réservé aux comptes avec un abonnement actif (même vérification
 * que claude-prox) — chaque appel a un coût réel chez OpenAI. PAS de suivi
 * de quota séparé par caractère pour l'instant (voir CLAUDE.md) : à ajouter
 * si le volume le justifie, surveillable en attendant via le dashboard
 * OpenAI (platform.openai.com/usage).
 *
 * SECRETS REQUIS (déjà présents, aucun ajout) :
 *   SUPABASE_URL, SERVICE_ROLE_KEY, OPENAI_API_KEY
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const erreurJSON = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS } });

// Voix retenues parmi celles de gpt-4o-mini-tts — sous-ensemble jugé le plus
// adapté à de la lecture longue (manuscrit/essai) plutôt que les 11
// disponibles au total. La liste complète et les libellés affichés côté
// client sont dans src/lib/lectureVoix.js (VOIX_DISPONIBLES) — garder les
// deux synchronisées si cette liste change.
const VOIX_AUTORISEES = new Set(["alloy", "echo", "fable", "nova", "onyx", "sage", "shimmer"]);
const LONGUEUR_MAX = 4096; // limite dure d'OpenAI pour /v1/audio/speech

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    if (!OPENAI_API_KEY) {
      return erreurJSON({ error: "Lecture à voix haute non configurée (OPENAI_API_KEY manquante)." }, 500);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await admin.auth.getUser(token);
    if (authError || !userData?.user) {
      return erreurJSON({ error: "Authentification requise." }, 401);
    }

    const { data: abos } = await admin
      .from("abonnements")
      .select("statut")
      .eq("user_id", userData.user.id)
      .eq("statut", "actif")
      .limit(1);
    if (!abos?.length) {
      return erreurJSON(
        { error: "quota", message: "Aucun abonnement actif. Choisissez une formule pour utiliser la lecture à voix haute." },
        403,
      );
    }

    const { texte, voix, vitesse } = await req.json();
    if (typeof texte !== "string" || !texte.trim()) {
      return erreurJSON({ error: "Aucun texte à lire." }, 400);
    }
    if (texte.length > LONGUEUR_MAX) {
      return erreurJSON(
        { error: `Texte trop long pour un seul appel (${texte.length}/${LONGUEUR_MAX} caractères) — à découper côté client.` },
        400,
      );
    }

    const voixChoisie = VOIX_AUTORISEES.has(voix) ? voix : "nova";
    const vitesseChoisie = Math.min(4, Math.max(0.25, Number(vitesse) || 1));

    const réponseOpenAI = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        input: texte,
        voice: voixChoisie,
        speed: vitesseChoisie,
        response_format: "mp3",
      }),
    });

    if (!réponseOpenAI.ok) {
      let message = `Échec de la synthèse vocale (HTTP ${réponseOpenAI.status}).`;
      try {
        const détail = await réponseOpenAI.json();
        message = détail?.error?.message || message;
      } catch { /* corps non-JSON, on garde le message par défaut */ }
      return erreurJSON({ error: message }, réponseOpenAI.status);
    }

    const audio = await réponseOpenAI.arrayBuffer();
    return new Response(audio, { headers: { "Content-Type": "audio/mpeg", ...CORS } });
  } catch (err) {
    console.error("Erreur lire-texte :", err.message);
    return erreurJSON({ error: err.message }, 500);
  }
});
