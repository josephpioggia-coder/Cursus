/**
 * CURSUS — Edge Function : changer-formule (15/11/2026)
 * =====================================================
 * Passage d'un abonnement CursEdit à une formule SUPÉRIEURE, au prorata, en UNE écriture et UN paiement
 * (décision de Joseph : pas de note de crédit + facture au prix plein + remboursement, plus lourd et plus confus).
 * Stripe déduit le temps non utilisé de l'ancienne formule et facture la différence, sur une seule facture.
 *
 * Deux actions (corps JSON) :
 *  - { action: "apercu",    price_id }                      → montants calculés par STRIPE (facture à venir), rien n'est modifié ;
 *  - { action: "confirmer", price_id, date_calcul }         → applique le changement avec la MÊME date de calcul que l'aperçu.
 *
 * Règles :
 *  - L'appelant est identifié par son jeton (jamais par une valeur du corps) ; l'abonnement modifié est celui de CE compte.
 *  - Seul un changement vers une formule PLUS CHÈRE (rang supérieur) est accepté ; redescendre = pas encore (voir CLAUDE.md).
 *  - Même périodicité (annuel → annuel) : la date anniversaire est CONSERVÉE, le client paie la différence au prorata.
 *    Périodicité différente (mensuel ↔ annuel) : nouvelle période à partir d'aujourd'hui (crédit du temps restant déduit).
 *  - `payment_behavior: error_if_incomplete` : si le paiement échoue, RIEN n'est modifié.
 *  - Le webhook `customer.subscription.updated` (déjà en place) met la table `abonnements` à jour : pas d'écriture ici.
 *
 * SECRETS : STRIPE_SECRET_KEY, SUPABASE_URL, SERVICE_ROLE_KEY (déjà utilisés par stripe-webhook).
 * TABLE price_id → rang : À GARDER SYNCHRONISÉE avec src/lib/prix-stripe-config.mjs et PALIERS de stripe-webhook.
 * NON TESTÉ contre Stripe (déploiement et clés hors de portée de l'environnement de développement).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@14.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20", httpClient: Stripe.createFetchHttpClient() });
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SERVICE_ROLE_KEY")!);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const rep = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { "Content-Type": "application/json", ...CORS } });

// price_id → { palier, rang, periode }
const PRIX: Record<string, { palier: string; rang: number; periode: "mensuel" | "annuel" }> = {
  "price_1To0aPPCr5y81hQucKMajz8H": { palier: "Découverte", rang: 0, periode: "mensuel" },
  "price_1To0aPPCr5y81hQu6WvNDMas": { palier: "Découverte", rang: 0, periode: "annuel" },
  "price_1To0aQPCr5y81hQu2KAfUY6z": { palier: "Essentiel", rang: 1, periode: "mensuel" },
  "price_1To0aRPCr5y81hQu8miOci6D": { palier: "Essentiel", rang: 1, periode: "annuel" },
  "price_1To0aSPCr5y81hQuaTOSXoeN": { palier: "Initié", rang: 2, periode: "mensuel" },
  "price_1To0aSPCr5y81hQubePqKJwS": { palier: "Initié", rang: 2, periode: "annuel" },
  "price_1To0aTPCr5y81hQuT6bvFYQ5": { palier: "Auteur", rang: 3, periode: "mensuel" },
  "price_1To0aUPCr5y81hQuwLZvpRyv": { palier: "Auteur", rang: 3, periode: "annuel" },
  "price_1To0aUPCr5y81hQu8UUHJP8R": { palier: "Studio", rang: 4, periode: "mensuel" },
  "price_1To0aVPCr5y81hQuZSSPcn6U": { palier: "Studio", rang: 4, periode: "annuel" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const jeton = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = await supabase.auth.getUser(jeton);
    if (!user) return rep({ error: "non_connecté", message: "Connectez-vous pour changer de formule." }, 401);

    const { action, price_id: nouveauPrix, date_calcul: dateDemandee } = await req.json();
    const cible = PRIX[nouveauPrix];
    if (!cible) return rep({ error: "prix_inconnu", message: "Formule inconnue." }, 400);
    if (action !== "apercu" && action !== "confirmer") return rep({ error: "action_inconnue" }, 400);

    // Abonnement actif de CE compte (le plus récent si doublons de test).
    const { data: lignes } = await supabase.from("abonnements").select("stripe_subscription_id, stripe_customer_id, palier, date_debut")
      .eq("user_id", user.id).eq("statut", "actif").order("date_debut", { ascending: false }).limit(1);
    const ligne = lignes?.[0];
    if (!ligne?.stripe_subscription_id) return rep({ error: "pas_d_abonnement", message: "Aucun abonnement actif sur ce compte." }, 404);

    const sub = await stripe.subscriptions.retrieve(ligne.stripe_subscription_id);
    if (sub.status !== "active") return rep({ error: "abonnement_non_actif", message: "Votre abonnement n'est pas dans un état qui permet de changer de formule (statut : " + sub.status + ")." }, 409);
    if (sub.cancel_at_period_end) return rep({ error: "resiliation_programmee", message: "Votre abonnement est programmé pour se terminer. Réactivez-le avant de changer de formule." }, 409);
    const item = sub.items.data[0];
    const actuel = PRIX[item?.price?.id];
    if (!item || !actuel) return rep({ error: "formule_actuelle_inconnue", message: "Votre formule actuelle n'a pas pu être identifiée ; écrivez-nous pour la changer." }, 409);
    if (cible.rang <= actuel.rang) {
      return rep({ error: "pas_une_montee", message: cible.rang === actuel.rang && cible.periode === actuel.periode
        ? "C'est déjà votre formule."
        : "Le passage à une formule inférieure (ou à un autre rythme de même niveau) n'est pas encore possible en ligne : écrivez-nous, il prendra effet à votre prochaine échéance." }, 400);
    }

    const memePeriode = cible.periode === actuel.periode;
    const maintenant = Math.floor(Date.now() / 1000);
    // La date de calcul de l'aperçu est réutilisée à la confirmation (mêmes montants), mais pas plus vieille que 15 min.
    let dateCalcul = maintenant;
    if (action === "confirmer") {
      if (!Number.isInteger(dateDemandee) || dateDemandee > maintenant || maintenant - dateDemandee > 900) {
        return rep({ error: "apercu_perime", message: "L'aperçu a expiré : recalculez-le avant de confirmer." }, 409);
      }
      dateCalcul = dateDemandee;
    }

    const paramsChangement = {
      subscription_items: [{ id: item.id, price: nouveauPrix }],
      subscription_proration_behavior: "always_invoice" as const,
      subscription_proration_date: dateCalcul,
      ...(memePeriode ? {} : { subscription_billing_cycle_anchor: "now" as const }),
    };

    if (action === "apercu") {
      const facture = await stripe.invoices.retrieveUpcoming({ customer: sub.customer as string, subscription: sub.id, ...paramsChangement });
      // Lignes dues MAINTENANT : lignes de prorata (crédit / débit) et, si la période repart, la nouvelle période ; pas le renouvellement futur.
      const dues = facture.lines.data.filter((l) => l.proration || (l.period?.start ?? 0) <= dateCalcul + 60);
      const lignesAff = dues.map((l) => ({ description: l.description || "", montant_centimes: l.amount }));
      const total = dues.reduce((s, l) => s + l.amount, 0);
      if (total <= 0) return rep({ error: "montant_nul", message: "Le montant calculé n'est pas positif ; écrivez-nous pour ce changement." }, 409);
      return rep({
        ok: true, de: actuel.palier, vers: cible.palier, date_calcul: dateCalcul,
        a_payer_centimes: total, lignes: lignesAff,
        prochaine_echeance: memePeriode ? sub.current_period_end : null,
        date_anniversaire_conservee: memePeriode,
      });
    }

    // Confirmer : un seul appel, paiement exigé sinon rien n'est modifié.
    try {
      await stripe.subscriptions.update(sub.id, {
        items: [{ id: item.id, price: nouveauPrix }],
        proration_behavior: "always_invoice",
        proration_date: dateCalcul,
        payment_behavior: "error_if_incomplete",
        ...(memePeriode ? {} : { billing_cycle_anchor: "now" }),
      });
    } catch (e) {
      console.error("changer-formule : échec de la mise à jour", e.message);
      return rep({ error: "paiement_refuse", message: "Le changement n'a pas pu être payé, rien n'a été modifié. Vérifiez votre moyen de paiement. (" + e.message + ")" }, 402);
    }
    return rep({ ok: true, vers: cible.palier });
  } catch (err) {
    console.error("changer-formule :", err.message);
    return rep({ error: "erreur", message: err.message }, 500);
  }
});
