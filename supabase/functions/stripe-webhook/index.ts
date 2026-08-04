/**
 * CURSUS — Edge Function : stripe-webhook
 * =========================================
 * Reçoit les événements Stripe (paiement réussi, abonnement annulé, etc.)
 * et met à jour la table `abonnements` dans Supabase en conséquence.
 *
 * SECRETS REQUIS dans Supabase → Settings → Edge Functions → Secrets :
 *   STRIPE_SECRET_KEY      = sk_test_... (ou sk_live_... en production)
 *   STRIPE_WEBHOOK_SECRET  = whsec_... (obtenu depuis le dashboard Stripe)
 *   SUPABASE_URL           = URL du projet
 *   SERVICE_ROLE_KEY       = clé service_role de Supabase (pas la clé anon)
 *
 * CORRECTIF 04/08/2026 (60804-02) :
 * - Sur checkout.session.completed, si la session porte
 *   metadata.code_promo_id (attaché par creer-session-checkout), appelle
 *   la fonction Postgres consommer_code_promo() pour enregistrer
 *   l'utilisation de façon atomique — c'est ICI, sur paiement réellement
 *   confirmé, que l'utilisation est comptée, jamais à la création de la
 *   session Stripe (un panier abandonné ne doit pas consommer un usage).
 * - Un refus de consommer_code_promo() (limite atteinte) est journalisé
 *   mais ne bloque jamais l'activation de l'abonnement, déjà faite
 *   indépendamment juste avant, ni la réponse 200 à Stripe.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@14.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SERVICE_ROLE_KEY")!
);

// Correspondance price_id Stripe → nom du palier Cursus
const PALIERS: Record<string, string> = {
  "price_1To0aPPCr5y81hQucKMajz8H": "Découverte",
  "price_1To0aPPCr5y81hQu6WvNDMas": "Découverte",
  "price_1To0aQPCr5y81hQu2KAfUY6z": "Essentiel",
  "price_1To0aRPCr5y81hQu8miOci6D": "Essentiel",
  "price_1To0aSPCr5y81hQuaTOSXoeN": "Initié",
  "price_1To0aSPCr5y81hQubePqKJwS": "Initié",
  "price_1To0aTPCr5y81hQuT6bvFYQ5": "Auteur",
  "price_1To0aUPCr5y81hQuwLZvpRyv": "Auteur",
  "price_1To0aUPCr5y81hQu8UUHJP8R": "Studio",
  "price_1To0aVPCr5y81hQuZSSPcn6U": "Studio",
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, stripe-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!
    );
  } catch (err) {
    console.error("Signature webhook invalide :", err.message);
    return new Response(JSON.stringify({ error: "Signature invalide" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  // Traitement des événements Stripe importants
  switch (event.type) {

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const email = session.customer_details?.email;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      if (!email) break;

      // Récupère le price_id depuis l'abonnement Stripe
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = subscription.items.data[0]?.price.id;
      const palier = PALIERS[priceId] || "Inconnu";

      // Trouve l'utilisateur Supabase par email
      const { data: users } = await supabase.auth.admin.listUsers();
      const user = users?.users?.find((u) => u.email === email);

      if (!user) {
        console.error("Utilisateur introuvable pour l'email :", email);
        break;
      }

      // Enregistre ou met à jour l'abonnement
      await supabase.from("abonnements").upsert({
        user_id: user.id,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        palier,
        statut: "actif",
        date_debut: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "stripe_subscription_id" });

      console.log(`Abonnement ${palier} activé pour ${email}`);

      // 60804-02 : consommation atomique du code promo, si la session en
      // portait un. N'affecte jamais l'activation de l'abonnement ci-dessus,
      // déjà faite indépendamment.
      const codePromoId = (session.metadata as Record<string, string> | null)?.code_promo_id;
      if (codePromoId) {
        const { data: consomme, error: erreurConsommation } = await supabase.rpc(
          "consommer_code_promo",
          {
            p_code_promo_id: codePromoId,
            p_user_id: user.id,
            p_email: email,
            p_stripe_session_id: session.id,
          }
        );
        if (erreurConsommation) {
          console.error("Erreur consommation code promo :", erreurConsommation.message);
        } else if (consomme === false) {
          console.error(
            `Code promo ${codePromoId} refusé à la consommation (limite atteinte) pour la session ${session.id} — paiement déjà effectué, à traiter manuellement si besoin.`
          );
        }
      }

      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await supabase.from("abonnements")
        .update({ statut: "annulé", updated_at: new Date().toISOString() })
        .eq("stripe_subscription_id", subscription.id);
      console.log("Abonnement annulé :", subscription.id);
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const priceId = subscription.items.data[0]?.price.id;
      const palier = PALIERS[priceId] || "Inconnu";
      const statut = subscription.status === "active" ? "actif" : subscription.status;

      await supabase.from("abonnements")
        .update({ palier, statut, updated_at: new Date().toISOString() })
        .eq("stripe_subscription_id", subscription.id);
      console.log("Abonnement mis à jour :", subscription.id, "→", palier);
      break;
    }

    default:
      console.log("Événement non traité :", event.type);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...CORS },
  });
});
