// CURSUS — Edge Function : rappel-renouvellement (15/11/2026)
// Envoie, 30 jours avant l'échéance, un e-mail de rappel aux abonnés ANNUELS dont l'abonnement se renouvelle tacitement.
// À lancer UNE FOIS PAR JOUR (planification Supabase) ; chaque abonnement ne reçoit qu'un rappel par période (table rappels_renouvellement).
//
// SECRETS : STRIPE_SECRET_KEY, SUPABASE_URL, SERVICE_ROLE_KEY (déjà en place) + nouveaux :
//   CRON_SECRET     = mot de passe de votre choix ; la planification l'envoie dans l'en-tête `x-cron-secret` (sinon 401)
//   RESEND_API_KEY  = clé d'un compte Resend (service d'envoi d'e-mails) dont le domaine cursus.pro est vérifié
//   EXPEDITEUR      = facultatif, ex. « Cursus <bonjour@cursus.pro> »
//   CONTACT         = facultatif, adresse où écrire pour annuler (défaut : infocursus.proia@gmail.com)
// Le montant annoncé vient de la prochaine facture calculée par STRIPE (TVA du pays incluse si Stripe Tax est actif).
// Fenêtre : de 31 à 25 jours avant l'échéance (rattrape un jour manqué). NON TESTÉ contre Stripe ni Resend.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@14.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20", httpClient: Stripe.createFetchHttpClient() });
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SERVICE_ROLE_KEY")!);

const NOMS: Record<string, string> = {
  "price_1To0aPPCr5y81hQu6WvNDMas": "Découverte", "price_1To0aRPCr5y81hQu8miOci6D": "Essentiel", "price_1To0aSPCr5y81hQubePqKJwS": "Initié",
  "price_1To0aUPCr5y81hQuwLZvpRyv": "Auteur", "price_1To0aVPCr5y81hQuZSSPcn6U": "Studio",
};
const eur = (c: number) => (c / 100).toFixed(2).replace(".", ",") + " €";
const dateFr = (t: number) => new Date(t * 1000).toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" });
const échapper = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET") || !Deno.env.get("CRON_SECRET")) return new Response("Non autorisé", { status: 401 });
  const cleResend = Deno.env.get("RESEND_API_KEY");
  if (!cleResend) return new Response(JSON.stringify({ error: "RESEND_API_KEY manquant : aucun e-mail envoyé." }), { status: 500 });
  const expéditeur = Deno.env.get("EXPEDITEUR") || "Cursus <bonjour@cursus.pro>";
  const contact = Deno.env.get("CONTACT") || "infocursus.proia@gmail.com";

  const maintenant = Math.floor(Date.now() / 1000);
  const bilan = { examinés: 0, envoyés: 0, déjà_faits: 0, erreurs: [] as string[] };

  for await (const sub of stripe.subscriptions.list({ status: "active", limit: 100 })) {
    const prix = sub.items.data[0]?.price;
    if (prix?.recurring?.interval !== "year" || sub.cancel_at_period_end) continue;
    const jours = (sub.current_period_end - maintenant) / 86400;
    if (jours > 31 || jours < 25) continue;
    bilan.examinés++;
    const periodeFin = new Date(sub.current_period_end * 1000).toISOString();
    // Réserve le rappel AVANT l'envoi (pas de doublon si deux exécutions se chevauchent) ; libéré si l'envoi échoue.
    const { error: dejà } = await supabase.from("rappels_renouvellement").insert({ stripe_subscription_id: sub.id, periode_fin: periodeFin });
    if (dejà) { bilan.déjà_faits++; continue; }
    try {
      const client = await stripe.customers.retrieve(sub.customer as string) as Stripe.Customer;
      const email = client.email;
      if (!email) throw new Error("pas d'adresse e-mail sur le client Stripe");
      const facture = await stripe.invoices.retrieveUpcoming({ customer: sub.customer as string, subscription: sub.id });
      const formule = NOMS[prix.id] || "annuelle";
      const taxe = (facture.total_tax_amounts || []).reduce((s, t) => s + t.amount, 0);
      const montant = taxe > 0 ? `${eur(facture.total)} TVA comprise (${eur(facture.total - taxe)} hors TVA)` : `${eur(facture.total)} hors TVA (la TVA de votre pays s'ajoute si elle est due)`;
      const date = dateFr(sub.current_period_end);
      const texte = `Bonjour,\n\nVotre abonnement annuel Cursus (formule ${formule}) se renouvelle tacitement le ${date}, pour ${montant}.\n\n` +
        `Vous pouvez l'annuler à tout moment : l'annulation prend effet à la fin de la période déjà payée. Pour cela, écrivez-nous à ${contact}.\n\n` +
        `Si vous souhaitez continuer, vous n'avez rien à faire.\n\nL'équipe Cursus`;
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${cleResend}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: expéditeur, to: [email], reply_to: contact, subject: `Votre abonnement Cursus se renouvelle le ${date}`,
          text: texte, html: `<p>${échapper(texte).replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</p>` }),
      });
      if (!r.ok) throw new Error("Resend " + r.status + " " + (await r.text()).slice(0, 200));
      await supabase.from("rappels_renouvellement").update({ email }).eq("stripe_subscription_id", sub.id).eq("periode_fin", periodeFin);
      bilan.envoyés++;
    } catch (e) {
      await supabase.from("rappels_renouvellement").delete().eq("stripe_subscription_id", sub.id).eq("periode_fin", periodeFin);
      bilan.erreurs.push(`${sub.id}: ${e.message}`);
    }
  }
  return new Response(JSON.stringify(bilan), { headers: { "Content-Type": "application/json" } });
});
