// CURSUS — Edge Function : gerer-abonnement (15/11/2026)
// Annulation en libre-service d'un abonnement CursEdit, et reprise tant qu'il n'est pas terminé.
// Corps JSON : { action: "etat" | "annuler" | "reactiver" | "pauser" | "reprendre", mois?: 1..3 }. Identité = jeton de l'appelant ; seul l'abonnement actif DE CE COMPTE est touché.
// Règles (CGV art. 5-6) : l'annulation prend effet à la FIN DE LA PÉRIODE DÉJÀ PAYÉE, sans remboursement ; l'accès reste complet jusque-là.
// PRÉAVIS (17/11/2026, convention de partenariat Studio) : un abonnement ANNUEL ne peut être annulé (= non renouvelé) qu'au plus tard
// PREAVIS_ANNUEL_JOURS jours avant l'échéance, mais à tout moment avant cette limite ; passé ce délai il est renouvelé. Mensuel : à tout moment.
// PAUSE (17/11/2026) : abonnement MENSUEL seulement, 1 à 3 mois, une fois par 12 mois, jamais pendant l'engagement de 3 mois de Découverte.
// Elle COMMENCE À LA FIN DE LA PÉRIODE DÉJÀ PAYÉE (on garde ce qu'on a payé) : Stripe `pause_collection` (invoices annulées) + métadonnées
// `pause_debut` / `derniere_pause_le` (AUCUNE migration). Le webhook passe `abonnements.statut` à « pause » quand la pause commence
// (accès en LECTURE SEULE, IA coupée) et le remet à « actif » à la reprise. « Reprendre » pendant la pause = nouvelle période payée tout de suite.
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
const PREAVIS_ANNUEL_JOURS = 30;
const PAUSE_MAX_MOIS = 3;
const PAUSE_DELAI_JOURS = 365;
const DECOUVERTE_MENSUEL = "price_1To0aPPCr5y81hQucKMajz8H";

function ajouterMois(t: number, n: number): number { const d = new Date(t * 1000); d.setUTCMonth(d.getUTCMonth() + n); return Math.floor(d.getTime() / 1000); }
function plusTroisMois(t: number): number { const d = new Date(t * 1000); d.setUTCMonth(d.getUTCMonth() + 3); return Math.floor(d.getTime() / 1000); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const jeton = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = await supabase.auth.getUser(jeton);
    if (!user) return rep({ error: "non_connecté", message: "Connectez-vous." }, 401);
    const { action, mois } = await req.json();
    if (!["etat", "annuler", "reactiver", "pauser", "reprendre"].includes(action)) return rep({ error: "action_inconnue" }, 400);

    const { data: lignes } = await supabase.from("abonnements").select("stripe_subscription_id").eq("user_id", user.id).in("statut", ["actif", "pause"]).order("date_debut", { ascending: false }).limit(1);
    const id = lignes?.[0]?.stripe_subscription_id;
    if (!id) return rep({ error: "pas_d_abonnement", message: "Aucun abonnement actif ni en pause sur ce compte." }, 404);
    let sub = await stripe.subscriptions.retrieve(id);
    const prixId = sub.items.data[0]?.price?.id;
    const infos = NOMS[prixId] || { palier: "Cursus", periode: "mensuel" };

    const limiteAnnulation = infos.periode === "annuel" ? sub.current_period_end - PREAVIS_ANNUEL_JOURS * 86400 : null;
    const maintenant = Math.floor(Date.now() / 1000);
    const pauseCollecte = !!sub.pause_collection;
    const pauseDebut = Number(sub.metadata?.pause_debut || 0);
    const enPause = pauseCollecte && pauseDebut > 0 && maintenant >= pauseDebut;
    const pauseProgrammee = pauseCollecte && !enPause;
    const engagementEnCours = prixId === DECOUVERTE_MENSUEL && sub.current_period_end < plusTroisMois(sub.start_date) - 86400;

    if (action === "pauser" && sub.status === "active") {
      const n = Number(mois);
      if (!Number.isInteger(n) || n < 1 || n > PAUSE_MAX_MOIS) return rep({ error: "duree_invalide", message: `Choisissez une pause de 1 à ${PAUSE_MAX_MOIS} mois.` }, 400);
      if (infos.periode !== "mensuel") return rep({ error: "pause_non_disponible", message: "La pause n'est disponible que pour les abonnements mensuels." }, 409);
      if (pauseCollecte) return rep({ error: "deja_en_pause", message: "Une pause est déjà programmée ou en cours." }, 409);
      if (sub.cancel_at_period_end || sub.cancel_at) return rep({ error: "annulation_programmee", message: "L'annulation est programmée : reprenez d'abord votre abonnement si vous souhaitez le mettre en pause." }, 409);
      if (engagementEnCours) return rep({ error: "engagement_en_cours", message: "La pause n'est pas possible pendant l'engagement de 3 mois de la formule Découverte." }, 409);
      const derniere = Date.parse(String(sub.metadata?.derniere_pause_le || "")) / 1000;
      if (derniere && maintenant - derniere < PAUSE_DELAI_JOURS * 86400) return rep({ error: "pause_deja_utilisee", message: "Une seule pause est possible par période de 12 mois." }, 409);
      const debut = sub.current_period_end;
      // Reprise la veille d'une échéance : la facture de l'échéance de reprise est alors bien encaissée.
      const fin = ajouterMois(debut, n) - 86400;
      sub = await stripe.subscriptions.update(id, {
        pause_collection: { behavior: "void", resumes_at: fin },
        metadata: { pause_debut: String(debut), derniere_pause_le: new Date().toISOString() },
      });
    } else if (action === "reprendre" && sub.status === "active" && pauseCollecte) {
      if (enPause) {
        // Reprise anticipée : une nouvelle période PAYÉE commence tout de suite (la période en cours n'était pas facturée).
        sub = await stripe.subscriptions.update(id, {
          pause_collection: "" as unknown as undefined, metadata: { pause_debut: "" },
          billing_cycle_anchor: "now", proration_behavior: "none", payment_behavior: "error_if_incomplete",
        });
      } else {
        sub = await stripe.subscriptions.update(id, { pause_collection: "" as unknown as undefined, metadata: { pause_debut: "" } });
      }
    } else if (action === "annuler" && sub.status === "active") {
      if (enPause) {
        // Rien n'est facturé pendant la pause : l'abonnement s'arrête tout de suite.
        sub = await stripe.subscriptions.cancel(id);
        return rep({ ok: true, palier: infos.palier, periode: infos.periode, annulation_programmee: true, fin_acces: maintenant, prochain_renouvellement: null, en_pause: false, pause_programmee: false });
      }
      if (pauseProgrammee) sub = await stripe.subscriptions.update(id, { pause_collection: "" as unknown as undefined, metadata: { pause_debut: "" } });
      if (sub.cancel_at_period_end || sub.cancel_at) return rep({ error: "deja_programmee", message: "L'annulation est déjà programmée." }, 409);
      if (limiteAnnulation !== null && maintenant > limiteAnnulation) return rep({ error: "preavis_depasse", message: `Le délai pour ne pas renouveler (${PREAVIS_ANNUEL_JOURS} jours avant l'échéance) est dépassé : l'abonnement sera renouvelé.`, limite_annulation: limiteAnnulation, prochain_renouvellement: sub.current_period_end }, 409);
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
    const pDebut = Number(sub.metadata?.pause_debut || 0);
    const pCollecte = !!sub.pause_collection;
    const pEnPause = pCollecte && pDebut > 0 && maintenant >= pDebut;
    const pProgrammee = pCollecte && !pEnPause;
    const derniereP = Date.parse(String(sub.metadata?.derniere_pause_le || "")) / 1000;
    let pauseRaison: string | null = null;
    if (infos.periode !== "mensuel") pauseRaison = "La pause n'est disponible que pour les abonnements mensuels.";
    else if (pCollecte) pauseRaison = "Une pause est déjà programmée ou en cours.";
    else if (annulation) pauseRaison = "L'annulation est programmée.";
    else if (engagementEnCours) pauseRaison = "Pas de pause pendant l'engagement de 3 mois de la formule Découverte.";
    else if (derniereP && maintenant - derniereP < PAUSE_DELAI_JOURS * 86400) pauseRaison = "Une seule pause est possible par période de 12 mois.";
    return rep({
      ok: true, palier: infos.palier, periode: infos.periode,
      annulation_programmee: annulation,
      fin_acces: annulation ? (sub.cancel_at || sub.current_period_end) : null,
      prochain_renouvellement: annulation ? null : sub.current_period_end,
      limite_annulation: limiteAnnulation,
      annulation_possible: limiteAnnulation === null || maintenant <= limiteAnnulation,
      preavis_jours: limiteAnnulation === null ? null : PREAVIS_ANNUEL_JOURS,
      engagement_en_cours: engagementEnCours,
      en_pause: pEnPause, pause_programmee: pProgrammee,
      pause_debut: pCollecte ? pDebut : null, pause_fin: pCollecte ? (sub.pause_collection?.resumes_at ?? null) : null,
      pause_possible: pauseRaison === null, pause_raison: pauseRaison, pause_max_mois: PAUSE_MAX_MOIS,
    });
  } catch (err) {
    console.error("gerer-abonnement :", err.message);
    return rep({ error: "erreur", message: err.message }, 500);
  }
});
