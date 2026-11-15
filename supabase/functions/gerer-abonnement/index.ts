// CURSUS — Edge Function : gerer-abonnement (15/11/2026)
// Annulation en libre-service d'un abonnement CursEdit, et reprise tant qu'il n'est pas terminé.
// Corps JSON : { action: "etat" | "annuler" | "reactiver" }. Identité = jeton de l'appelant ; seul l'abonnement actif DE CE COMPTE est touché.
// Règles (CGV art. 5-6) : l'annulation prend effet à la FIN DE LA PÉRIODE DÉJÀ PAYÉE, sans remboursement ; l'accès reste complet jusque-là.
// Exception : Découverte MENSUEL = engagement de 3 mois minimum → la fin est repoussée à la fin du 3e mois si l'abonné est dans ses 3 premiers mois.
// Le webhook `customer.subscription.deleted` (existant) passe l'abonnement à « annulé » au moment de la fin. NON testé contre Stripe.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@14.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20", httpClient: Stripe.createFetchHttpClient() });
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SERVICE_ROLE_KEY")!);
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const rep = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { "Content-Type": "application/json", ...CORS } });

const NOMS: Record<string, { palier: string; periode: "mensuel" | "annuel" }> = {
  "price_1To0aPPCr5y81hQucKMajz8H": { palier: "Découverte", periode: "mensuel" }, "price_1To0aPPCr5y81hQu6WvNDMas": { palier: "Découverte", periode: "annuel" },
  "price_1To0aQPCr5y81hQu2KAfUY6z": { palier: "Essentiel", periode: "mensuel" }, "price_1To0aRPCr5y81hQu8miOci6D": { palier: "Essentiel", periode: "annuel" },
  "price_1To0aSPCr5y81hQuaTOSXoeN": { palier: "Initié", periode: "mensuel" }, "price_1To0aSPCr5y81hQubePqKJwS": { palier: "Initié", periode: "annuel" },
  "price_1To0aTPCr5y81hQuT6bvFYQ5": { palier: "Auteur", periode: "mensuel" }, "price_1To0aUPCr5y81hQuwLZvpRyv": { palier: "Auteur", periode: "annuel" },
  "price_1To0aUPCr5y81hQu8UUHJP8R": { palier: "Studio", periode: "mensuel" }, "price_1To0aVPCr5y81hQuZSSPcn6U": { palier: "Studio", periode: "annuel" },
};
const DECOUVERTE_MENSUEL = "price_1To0aPPCr5y81hQucKMajz8H";

function plusTroisMois(t: number): number { const d = new Date(t * 1000); d.setUTCMonth(d.getUTCMonth() + 3); return Math.floor(d.getTime() / 1000); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const jeton = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = await supabase.auth.getUser(jeton);
    if (!user) return rep({ error: "non_connecté", message: "Connectez-vous." }, 401);
    const { action } = await req.json();
    if (!["etat", "annuler", "reactiver"].includes(action)) return rep({ error: "action_inconnue" }, 400);

    const { data: lignes } = await supabase.from("abonnements").select("stripe_subscription_id").eq("user_id", user.id).eq("statut", "actif").order("date_debut", { ascending: false }).limit(1);
    const id = lignes?.[0]?.stripe_subscription_id;
    if (!id) return rep({ error: "pas_d_abonnement", message: "Aucun abonnement actif sur ce compte." }, 404);
    let sub = await stripe.subscriptions.retrieve(id);
    const prixId = sub.items.data[0]?.price?.id;
    const infos = NOMS[prixId] || { palier: "Cursus", periode: "mensuel" };

    if (action === "annuler" && sub.status === "active") {
      if (sub.cancel_at_period_end || sub.cancel_at) return rep({ error: "deja_programmee", message: "L'annulation est déjà programmée." }, 409);
      const finEngagement = prixId === DECOUVERTE_MENSUEL ? plusTroisMois(sub.start_date) : 0;
      if (finEngagement && sub.current_period_end < finEngagement - 86400) {
        sub = await stripe.subscriptions.update(id, { cancel_at: finEngagement });
      } else {
        sub = await stripe.subscriptions.update(id, { cancel_at_period_end: true });
      }
    } else if (action === "reactiver" && sub.status === "active") {
      sub = await stripe.subscriptions.update(id, { cancel_at_period_end: false, cancel_at: "" as unknown as undefined });
    }

    const annulation = !!(sub.cancel_at_period_end || sub.cancel_at);
    return rep({
      ok: true, palier: infos.palier, periode: infos.periode,
      annulation_programmee: annulation,
      fin_acces: annulation ? (sub.cancel_at || sub.current_period_end) : null,
      prochain_renouvellement: annulation ? null : sub.current_period_end,
      engagement_en_cours: prixId === DECOUVERTE_MENSUEL && sub.current_period_end < plusTroisMois(sub.start_date) - 86400,
    });
  } catch (err) {
    console.error("gerer-abonnement :", err.message);
    return rep({ error: "erreur", message: err.message }, 500);
  }
});
