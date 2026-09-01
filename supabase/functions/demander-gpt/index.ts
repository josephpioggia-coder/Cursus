/**
 * CURSUS — Edge Function : demander-gpt (référence 60816-01, suite, 30/08/2026)
 * ============================================================================
 * Relais serveur vers GPT pour les discussions de conception entre Joseph et
 * Claude Code — PAS une fonctionnalité du produit Cursus, pas d'authentification
 * utilisateur Supabase. Objectif unique : que la clé OPENAI_API_KEY ne circule
 * JAMAIS en dehors des secrets Supabase — jamais dans le code source, le dépôt
 * GitHub, le navigateur, les logs, ou une conversation Claude/ChatGPT.
 *
 * SÉCURITÉ — trois secrets DISTINCTS, à ne jamais confondre :
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
 *   SERVICE_ROLE_KEY — déjà utilisée par claude-prox/verification-deux-ia
 *                       pour écrire dans Supabase (journal des appels ici).
 *
 * GARDE-FOUS demandés par Joseph (30/08/2026), au-delà de la simple séparation
 * des secrets :
 *   - Interrupteur : RELAIS_GPT_ACTIF doit valoir exactement "true" dans les
 *     secrets Supabase, sinon la fonction refuse tout appel — désactivable
 *     depuis le Dashboard Supabase sans redéployer de code. Fermé par défaut
 *     si le secret est absent (sécurisé par défaut).
 *   - Demande explicite tracée : `motif` (texte non vide) est obligatoire dans
 *     le corps de la requête — le serveur ne peut pas vérifier qu'une demande
 *     est réellement "explicite", mais exiger et journaliser un motif rend
 *     chaque appel auditable après coup dans demander_gpt_logs.
 *   - Plafond de coût mensuel : avant tout appel, calcule le coût déjà
 *     consommé ce mois-ci (somme de cout_estime_usd dans demander_gpt_logs) et
 *     refuse si le plafond (RELAIS_GPT_PLAFOND_MENSUEL_USD, défaut 5$) serait
 *     dépassé.
 *   - Journal : chaque appel réussi est inséré dans demander_gpt_logs (motif,
 *     prompt, réponse, tokens, coût réel calculé depuis la réponse OpenAI) —
 *     voir 2026-08-30-demander-gpt-logs.sql.
 *
 * Appel : POST avec header `Authorization: Bearer <RELAIS_GPT_TOKEN>` et corps
 * JSON { "prompt": "...", "motif": "...", "modele": "gpt-4o" (optionnel) }.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const RELAIS_GPT_TOKEN = Deno.env.get("RELAIS_GPT_TOKEN");
const RELAIS_GPT_ACTIF = Deno.env.get("RELAIS_GPT_ACTIF");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY");
const MODELE_PAR_DEFAUT = "gpt-4o";

// Tarifs GPT-4o vérifiés le 30/08/2026 (2,50 $/M entrée, 10 $/M sortie) — à
// ajuster si le modèle par défaut change un jour. Sert uniquement à estimer
// le coût réel pour le plafond mensuel, pas à facturer qui que ce soit.
const PRIX_ENTREE_PAR_TOKEN = 2.5 / 1_000_000;
const PRIX_SORTIE_PAR_TOKEN = 10 / 1_000_000;
const PLAFOND_MENSUEL_PAR_DÉFAUT_USD = 5;

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

  if (!RELAIS_GPT_TOKEN || !OPENAI_API_KEY || !SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: "Secrets manquants — fonction non configurée." }, 500);
  }

  // Interrupteur — fermé par défaut si le secret est absent ou différent
  // de "true", pour qu'un oubli de configuration ne laisse jamais le relais
  // ouvert silencieusement.
  if (RELAIS_GPT_ACTIF !== "true") {
    return json({ error: "Relais GPT désactivé (RELAIS_GPT_ACTIF ≠ \"true\" dans les secrets)." }, 403);
  }

  // Jeton dédié à ce relais — PAS un token Supabase utilisateur, PAS la clé
  // OpenAI. Comparaison directe suffisante : c'est un secret partagé à usage
  // interne, pas un système d'authentification multi-utilisateur.
  const authHeader = req.headers.get("Authorization") ?? "";
  const jetonFourni = authHeader.replace("Bearer ", "");
  if (jetonFourni !== RELAIS_GPT_TOKEN) {
    return json({ error: "Jeton invalide." }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body = await req.json();
    const prompt: string | undefined = body?.prompt;
    const motif: string | undefined = body?.motif;
    if (!prompt || typeof prompt !== "string") {
      return json({ error: "Le champ 'prompt' (texte) est requis." }, 400);
    }
    if (!motif || typeof motif !== "string" || !motif.trim()) {
      return json({ error: "Le champ 'motif' (texte) est requis — chaque appel doit être justifié." }, 400);
    }
    const modele: string = typeof body?.modele === "string" ? body.modele : MODELE_PAR_DEFAUT;

    // Plafond mensuel — calculé sur le calendrier, comme usage_ia côté produit.
    const plafond = Number(Deno.env.get("RELAIS_GPT_PLAFOND_MENSUEL_USD")) || PLAFOND_MENSUEL_PAR_DÉFAUT_USD;
    const débutMois = new Date();
    débutMois.setUTCDate(1);
    débutMois.setUTCHours(0, 0, 0, 0);
    const { data: dépensesMois } = await admin
      .from("demander_gpt_logs")
      .select("cout_estime_usd")
      .gte("created_at", débutMois.toISOString());
    const déjàDépensé = (dépensesMois ?? []).reduce((s, l) => s + (l.cout_estime_usd ?? 0), 0);
    if (déjàDépensé >= plafond) {
      return json({
        error: `Plafond mensuel du relais GPT atteint (${déjàDépensé.toFixed(2)}$ / ${plafond}$). ` +
          "Augmentez RELAIS_GPT_PLAFOND_MENSUEL_USD dans les secrets pour continuer ce mois-ci.",
      }, 429);
    }

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

    const tokensEntrée = data.usage?.prompt_tokens ?? 0;
    const tokensSortie = data.usage?.completion_tokens ?? 0;
    const coûtEstimé = tokensEntrée * PRIX_ENTREE_PAR_TOKEN + tokensSortie * PRIX_SORTIE_PAR_TOKEN;
    const texteRéponse = data.choices?.[0]?.message?.content ?? "";

    const { error: erreurJournal } = await admin.from("demander_gpt_logs").insert({
      motif,
      prompt,
      reponse: texteRéponse,
      modele: data.model ?? modele,
      tokens_entree: tokensEntrée,
      tokens_sortie: tokensSortie,
      cout_estime_usd: coûtEstimé,
    });
    if (erreurJournal) console.error("demander_gpt_logs insert:", erreurJournal.message);

    return json({
      réponse: texteRéponse,
      usage: data.usage ?? null,
      modele: data.model ?? modele,
      coût_estimé_usd: Number(coûtEstimé.toFixed(6)),
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
