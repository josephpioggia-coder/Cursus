/**
 * CURSUS — Edge Function : admin-codes-promo (60804-03)
 * =========================================================
 * Créer, lister et activer/désactiver des codes promotionnels
 * (`codes_promo`) — réservé au propriétaire du logiciel.
 *
 * `codes_promo` a une RLS fermée à tout le monde sauf service_role (voir
 * 2026-08-04-codes-promo.sql) : cette fonction est le SEUL chemin
 * d'écriture depuis l'application. Elle vérifie d'abord que l'appelant
 * est un administrateur connu (table `admins`), sur l'email réel obtenu
 * via son jeton de session — jamais une valeur envoyée dans le corps de
 * la requête, qui pourrait être falsifiée.
 *
 * SECRETS REQUIS dans Supabase → Settings → Edge Functions → Secrets :
 *   SUPABASE_URL      = URL du projet — déjà utilisée par les autres fonctions
 *   SERVICE_ROLE_KEY  = clé service_role — même nom que dans
 *                       creer-session-checkout et stripe-webhook
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SERVICE_ROLE_KEY")!
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function réponse(corps: unknown, status = 200) {
  return new Response(JSON.stringify(corps), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    // Identité réelle de l'appelant, jamais une valeur du corps de la requête.
    const enTeteAuth = req.headers.get("authorization") || "";
    const jeton = enTeteAuth.replace(/^Bearer\s+/i, "");
    if (!jeton) return réponse({ error: "Non authentifié." }, 401);

    const { data: { user } } = await supabase.auth.getUser(jeton);
    if (!user?.email) return réponse({ error: "Non authentifié." }, 401);

    const { data: admin } = await supabase
      .from("admins")
      .select("id")
      .eq("email", user.email)
      .maybeSingle();
    if (!admin) return réponse({ error: "Accès refusé." }, 403);

    const { action, ...params } = await req.json();

    if (action === "lister") {
      const { data: codes, error: erreurCodes } = await supabase
        .from("codes_promo")
        .select("*")
        .order("cree_le", { ascending: false });
      if (erreurCodes) return réponse({ error: erreurCodes.message }, 500);

      const { data: utilisations, error: erreurUtilisations } = await supabase
        .from("utilisations_codes_promo")
        .select("code_promo_id");
      if (erreurUtilisations) return réponse({ error: erreurUtilisations.message }, 500);

      const compteParCode: Record<string, number> = {};
      for (const u of utilisations || []) {
        compteParCode[u.code_promo_id] = (compteParCode[u.code_promo_id] || 0) + 1;
      }

      const codesAvecCompte = (codes || []).map((c) => ({
        ...c,
        utilisations: compteParCode[c.id] || 0,
      }));

      return réponse({ codes: codesAvecCompte });
    }

    if (action === "creer") {
      const {
        code, clientEmail, palierCible, remisePourcent,
        dureeMois, dateDebut, dateFin, utilisationsMax,
      } = params;

      if (!code || !remisePourcent) {
        return réponse({ error: "Le code et la remise sont obligatoires." }, 400);
      }

      const { data, error } = await supabase
        .from("codes_promo")
        .insert({
          code: String(code).trim().toUpperCase(),
          client_email: clientEmail || null,
          palier_cible: palierCible || null,
          remise_pourcent: remisePourcent,
          duree_mois: dureeMois ?? 0,
          date_debut: dateDebut || null,
          date_fin: dateFin || null,
          utilisations_max: utilisationsMax || null,
          cree_par: user.id,
        })
        .select()
        .single();

      if (error) {
        const message = error.code === "23505" ? "Ce code existe déjà." : error.message;
        return réponse({ error: message }, 400);
      }
      return réponse({ code: data });
    }

    if (action === "definirActif") {
      const { id, actif } = params;
      if (!id || typeof actif !== "boolean") {
        return réponse({ error: "id et actif (booléen) requis." }, 400);
      }

      const { error } = await supabase
        .from("codes_promo")
        .update({ actif })
        .eq("id", id);
      if (error) return réponse({ error: error.message }, 500);
      return réponse({ ok: true });
    }

    return réponse({ error: "Action inconnue." }, 400);
  } catch (err) {
    console.error("Erreur admin-codes-promo :", err.message);
    return réponse({ error: err.message }, 500);
  }
});
