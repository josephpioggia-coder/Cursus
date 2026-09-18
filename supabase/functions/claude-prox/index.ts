import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
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

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. AUTHENTIFICATION
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await admin.auth.getUser(token);

    if (authError || !userData?.user) {
      return json({ error: "Authentification requise." }, 401);
    }
    const userId = userData.user.id;

    // 2. PALIER — abonnement actif le plus récent (tolérant aux doublons)
    const { data: abos } = await admin
      .from("abonnements")
      .select("palier, statut")
      .eq("user_id", userId)
      .eq("statut", "actif")
      .order("date_debut", { ascending: false })
      .limit(1);
    const abo = abos?.[0] ?? null;

    if (!abo) {
      return json(
        { error: "quota", message: "Aucun abonnement actif. Choisissez une formule pour utiliser le co-pilote." },
        403,
      );
    }

    const { data: quota } = await admin
      .from("quotas_paliers")
      .select("tokens_mensuels")
      .ilike("palier", abo.palier)
      .maybeSingle();

    if (!quota) {
      return json(
        { error: "config", message: `Palier "${abo.palier}" sans quota configuré. Contactez le support.` },
        500,
      );
    }

    // 3. CONSOMMATION du mois calendaire en cours
    const debutMois = new Date();
    debutMois.setUTCDate(1);
    debutMois.setUTCHours(0, 0, 0, 0);

    const { data: usages } = await admin
      .from("usage_ia")
      .select("tokens_entree, tokens_sortie")
      .eq("user_id", userId)
      .gte("created_at", debutMois.toISOString());

    const consomme = (usages ?? []).reduce(
      (sum, u) => sum + (u.tokens_entree ?? 0) + (u.tokens_sortie ?? 0),
      0,
    );

    // CORRECTIF 18/09/2026 — ce verdict ignorait totalement credits_ia
    // (recharges ponctuelles, crédits de test) : recupererConsommation()
    // côté client (api.js) les additionnait déjà au quota du palier pour
    // l'affichage, mais LE SEUL VRAI GARDE-FOU (celui-ci, côté serveur —
    // un contrôle uniquement côté client serait contournable) ne les
    // voyait pas. Concrètement : un crédit ajouté manuellement (ex. le
    // crédit de test du 18/09/2026) ne débloquait rien, l'auteur recevait
    // quand même un 429 "quota atteint" alors que la jauge affichée
    // montrait encore de la marge.
    const { data: lignesCredits } = await admin
      .from("credits_ia")
      .select("tokens_offerts")
      .eq("user_id", userId);
    const credits = (lignesCredits ?? []).reduce((sum, l) => sum + (l.tokens_offerts ?? 0), 0);
    const disponibleTotal = quota.tokens_mensuels + credits;

    // 4. VERDICT
    if (consomme >= disponibleTotal) {
      return json(
        {
          error: "quota",
          message: "Vous avez atteint votre quota mensuel d'assistance IA. Il se renouvelle le 1er du mois, ou passez à une formule supérieure.",
          consomme,
          quota: disponibleTotal,
        },
        429,
      );
    }

    // 5. APPEL ANTHROPIC
    const body = await req.json();
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();

    // 6. ENREGISTREMENT des tokens réels
    // CORRECTIF 30/08/2026 (prompt caching) : quand le prompt système
    // utilise un breakpoint cache_control (voir systemAvecLangue côté
    // CopiloteIA), Anthropic renvoie usage.input_tokens réduit aux seuls
    // tokens APRÈS le dernier breakpoint — cache_creation_input_tokens et
    // cache_read_input_tokens couvrent le reste. tokens_entree reste
    // volontairement la somme des trois (comme documenté par Anthropic :
    // total_input_tokens = cache_read + cache_creation + input_tokens) —
    // le quota mensuel du compte ne change donc pas rien qu'en activant le
    // cache. cache_creation_tokens/cache_read_tokens sont stockés à part,
    // à titre informatif, pour mesurer le taux de cache réel (voir
    // 2026-08-30-cache-usage-ia.sql) — pas encore utilisés pour facturer.
    if (data?.usage) {
      const cacheCreation = data.usage.cache_creation_input_tokens ?? 0;
      const cacheRead = data.usage.cache_read_input_tokens ?? 0;
      const { error: insertError } = await admin.from("usage_ia").insert({
        user_id: userId,
        projet_id: body?.metadata?.projet_id ?? null,
        tokens_entree: (data.usage.input_tokens ?? 0) + cacheCreation + cacheRead,
        tokens_sortie: data.usage.output_tokens ?? 0,
        cache_creation_tokens: cacheCreation,
        cache_read_tokens: cacheRead,
        modele: data.model ?? body?.model ?? null,
      });
      if (insertError) console.error("usage_ia insert:", insertError.message);
    }

    return json(data);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
