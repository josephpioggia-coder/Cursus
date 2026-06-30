
/**
 * EDGE FUNCTION SUPABASE — creer-session-checkout
 * ==================================================
 * Reçoit un price_id depuis Tarification.jsx, crée une session
 * Stripe Checkout, renvoie l'URL de paiement.
 *
 * Suit le même modèle que ta fonction claude-prox déjà fonctionnelle
 * (mêmes headers CORS, même structure de réponse).
 *
 * SECRET REQUIS dans Supabase → Settings → Edge Functions → Secrets :
 *   STRIPE_SECRET_KEY = ta clé secrète Stripe (sk_test_... pour l'instant)
 */
 
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@14.0.0?target=deno";
 
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
 
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
 
// Mêmes headers CORS que claude-prox, pour rester cohérent
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
 
Deno.serve(async (req) => {
  // Préflight CORS — obligatoire avant toute logique, comme dans claude-prox
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }
 
  try {
    const { priceId, nomPalier } = await req.json();
 
    if (!priceId) {
      return new Response(JSON.stringify({ error: "priceId manquant" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }
 
    // L'URL de base de Cursus en local — à remplacer par le vrai domaine
    // une fois l'application déployée en production.
    const URL_BASE = "http://localhost:5173";
 
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${URL_BASE}/?abonnement=succes&palier=${encodeURIComponent(nomPalier || "")}`,
      cancel_url: `${URL_BASE}/?abonnement=annule`,
    });
 
    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (err) {
    console.error("Erreur création session Checkout :", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});
