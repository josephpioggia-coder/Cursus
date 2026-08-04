/**
 * EDGE FUNCTION SUPABASE — creer-session-checkout
 * ==================================================
 * Reçoit un price_id depuis Tarification.jsx (ou CompteurUsageIA pour une
 * recharge ponctuelle de tokens), crée une session Stripe Checkout,
 * renvoie l'URL de paiement.
 *
 * Suit le même modèle que ta fonction claude-prox déjà fonctionnelle
 * (mêmes headers CORS, même structure de réponse).
 *
 * SECRETS REQUIS dans Supabase → Settings → Edge Functions → Secrets :
 *   STRIPE_SECRET_KEY  = ta clé secrète Stripe (sk_test_... pour l'instant)
 *   SUPABASE_URL       = URL du projet — déjà utilisée par stripe-webhook
 *   SERVICE_ROLE_KEY   = clé service_role Supabase — déjà utilisée par
 *                        stripe-webhook, même nom exact (PAS
 *                        SUPABASE_SERVICE_KEY, qui n'existe pas)
 *
 * CORRECTIF 03/08/2026 :
 * - `mode` (subscription|payment) accepté depuis le client — était figé à
 *   "subscription", ce qui aurait cassé la recharge ponctuelle de tokens
 *   (60803-03, un paiement unique, pas un abonnement récurrent).
 *
 * CORRECTIF 04/08/2026 (60804-02) :
 * - L'ancien système de code promo auto-vérifiant par signature HMAC est
 *   retiré. La vraie règle vit désormais dans la table `codes_promo` —
 *   lue ici en lecture seule (contrôle "souple", à l'affichage). La
 *   garantie finale (limite d'utilisations) est appliquée par
 *   consommer_code_promo() côté stripe-webhook, sur paiement confirmé.
 * - L'appelant est identifié via le jeton reçu en Authorization
 *   (supabase.auth.getUser) pour vérifier codes_promo.client_email sur un
 *   email qui ne peut pas être falsifié depuis le client — jamais sur une
 *   valeur envoyée librement dans le corps de la requête.
 * - Un `metadata.code_promo_id` est attaché à la session Stripe créée :
 *   c'est ce qui permet à stripe-webhook de savoir, sur
 *   checkout.session.completed, quel code consommer.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@14.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SERVICE_ROLE_KEY")!
);

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
    const { priceId, nomPalier, mode, codePromo } = await req.json();

    if (!priceId) {
      return new Response(JSON.stringify({ error: "priceId manquant" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const modeCheckout = mode === "payment" ? "payment" : "subscription";

    // Identité réelle de l'appelant (60804-02), via le jeton Authorization
    // — jamais via une valeur du corps de la requête. Si le jeton n'est
    // pas celui d'un utilisateur réel (ex. clé anonyme reçue en secours),
    // emailAppelant reste null : seuls les codes SANS restriction d'email
    // pourront alors s'appliquer, jamais un code ciblé accepté à l'aveugle.
    let emailAppelant = null;
    const enTeteAuth = req.headers.get("authorization") || "";
    const jeton = enTeteAuth.replace(/^Bearer\s+/i, "");
    if (jeton) {
      const { data: { user } } = await supabase.auth.getUser(jeton);
      emailAppelant = user?.email || null;
    }

    // Application du code promo (60804-02) — la table codes_promo fait
    // foi, jamais le texte du code. Contrôle souple ici (à l'affichage) ;
    // la garantie finale reste consommer_code_promo() côté webhook.
    let discounts;
    let codePromoId;
    if (codePromo) {
      const { data: ligne, error: erreurLecture } = await supabase
        .from("codes_promo")
        .select("*")
        .eq("code", codePromo.trim().toUpperCase())
        .maybeSingle();

      if (erreurLecture || !ligne) {
        return new Response(JSON.stringify({ error: "Code promo introuvable." }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...CORS },
        });
      }
      if (!ligne.actif) {
        return new Response(JSON.stringify({ error: "Ce code promo n'est plus actif." }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...CORS },
        });
      }
      const maintenant = new Date();
      if (ligne.date_debut && maintenant < new Date(ligne.date_debut)) {
        return new Response(JSON.stringify({ error: "Ce code promo n'est pas encore valide." }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...CORS },
        });
      }
      if (ligne.date_fin && maintenant > new Date(ligne.date_fin)) {
        return new Response(JSON.stringify({ error: "Ce code promo a expiré." }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...CORS },
        });
      }
      if (ligne.palier_cible && ligne.palier_cible !== nomPalier) {
        return new Response(JSON.stringify({ error: `Ce code n'est valable que sur le palier "${ligne.palier_cible}".` }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...CORS },
        });
      }
      if (ligne.client_email && ligne.client_email.toLowerCase() !== (emailAppelant || "").toLowerCase()) {
        return new Response(JSON.stringify({ error: "Ce code promo n'est pas valable pour ce compte." }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...CORS },
        });
      }
      if (ligne.utilisations_max != null) {
        const { count } = await supabase
          .from("utilisations_codes_promo")
          .select("id", { count: "exact", head: true })
          .eq("code_promo_id", ligne.id);
        if ((count || 0) >= ligne.utilisations_max) {
          return new Response(JSON.stringify({ error: "Ce code promo a atteint sa limite d'utilisations." }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }
      }

      const coupon = await stripe.coupons.create({
        percent_off: ligne.remise_pourcent,
        duration: ligne.duree_mois === 0 ? "once" : ligne.duree_mois === 99 ? "forever" : "repeating",
        ...(ligne.duree_mois > 0 && ligne.duree_mois < 99 ? { duration_in_months: ligne.duree_mois } : {}),
      });
      discounts = [{ coupon: coupon.id }];
      codePromoId = ligne.id;
    }

    // CORRECTIF 03/08/2026 : l'ancien commentaire disait "à remplacer une
    // fois déployé" avec une adresse locale (localhost:5173) — la vraie
    // version en ligne utilisait déjà la bonne adresse de production,
    // jamais mise à jour dans ce fichier du dépôt. Reprise ici depuis la
    // version réellement déployée sur Supabase, vérifiée directement.
    const URL_BASE = "https://cursus-seven.vercel.app";

    const session = await stripe.checkout.sessions.create({
      mode: modeCheckout,
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      ...(discounts ? { discounts } : {}),
      ...(codePromoId ? { metadata: { code_promo_id: codePromoId } } : {}),
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
