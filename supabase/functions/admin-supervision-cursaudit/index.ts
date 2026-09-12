/**
 * CURSUS — Edge Function : admin-supervision-cursaudit (référence 60816-01, suite, 07/09/2026)
 * ======================================================================
 * Liste et détail des audits CursAudit pour lesquels l'auteur·ice a coché
 * « Supervision demandée » (consentement_supervision = true, voir
 * 2026-09-07-consentement-supervision-cursaudit.sql). Réservé au
 * propriétaire du logiciel — même adresse que le garde déjà utilisé pour
 * Administration (App.jsx), le contournement de paiement CursAudit et la
 * fermeture de la faille CursEdit (api.js) cette session. Pas de table
 * `admins` ici volontairement : cette fonctionnalité est personnelle
 * ("moi qui supervise"), pas une fonction d'équipe partagée comme les
 * codes promo.
 *
 * `audits` a une RLS fermée à `auth.uid() = user_id` (voir
 * 2026-08-15-cursaudit-schema.sql) : le propriétaire ne peut PAS lire les
 * audits d'un autre compte depuis le client, même les siens propres au
 * sens applicatif — cette fonction, en service_role, est le seul chemin
 * de lecture inter-comptes, et seulement pour les lignes consenties.
 *
 * SECRETS REQUIS : SUPABASE_URL, SERVICE_ROLE_KEY — déjà utilisés par les
 * autres fonctions admin de ce dépôt, mêmes noms exacts.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SERVICE_ROLE_KEY")!
);

const EMAIL_PROPRIETAIRE = "joseph.pioggia@gmail.com";

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
    // Identité réelle de l'appelant, jamais une valeur du corps de la requête
    // (même principe que admin-codes-promo).
    const enTeteAuth = req.headers.get("authorization") || "";
    const jeton = enTeteAuth.replace(/^Bearer\s+/i, "");
    if (!jeton) return réponse({ error: "Non authentifié." }, 401);

    const { data: { user } } = await supabase.auth.getUser(jeton);
    if (!user?.email) return réponse({ error: "Non authentifié." }, 401);
    if (user.email !== EMAIL_PROPRIETAIRE) return réponse({ error: "Accès refusé." }, 403);

    const { action, ...params } = await req.json();

    // Table d'emails : construite une seule fois par requête, réutilisée
    // pour "lister" (un email par audit) — listUsers() pagine par 50 par
    // défaut, largement suffisant pour le volume actuel de comptes Cursus ;
    // à revoir si le nombre de comptes dépasse une page un jour.
    const emailParUserId = async (idsRecherchés: string[]) => {
      const { data: users } = await supabase.auth.admin.listUsers();
      const table: Record<string, string> = {};
      for (const u of users?.users || []) {
        if (idsRecherchés.includes(u.id)) table[u.id] = u.email || "(sans email)";
      }
      return table;
    };

    if (action === "lister") {
      const { data: audits, error: erreurAudits } = await supabase
        .from("audits")
        .select("id, user_id, titre, statut, palier_dimensions, mode_ia, prix_ttc, cree_le, consentement_supervision_le, finalite_audit")
        .eq("consentement_supervision", true)
        .order("consentement_supervision_le", { ascending: false });
      if (erreurAudits) return réponse({ error: erreurAudits.message }, 500);

      const emails = await emailParUserId([...new Set((audits || []).map((a) => a.user_id))]);
      const auditsAvecEmail = (audits || []).map((a) => ({ ...a, email: emails[a.user_id] || "(compte introuvable)" }));

      return réponse({ audits: auditsAvecEmail });
    }

    if (action === "detail") {
      const { auditId } = params;
      if (!auditId) return réponse({ error: "auditId requis." }, 400);

      const { data: audit, error: erreurAudit } = await supabase
        .from("audits")
        .select("*")
        .eq("id", auditId)
        .eq("consentement_supervision", true)
        .maybeSingle();
      if (erreurAudit) return réponse({ error: erreurAudit.message }, 500);
      if (!audit) return réponse({ error: "Audit introuvable ou supervision non consentie." }, 404);

      // 12/09/2026 — signalé par l'auteur du projet : "Texte soumis (1000
      // unités)" pile rond sur un vrai audit, alors que le vrai nombre
      // d'unités dépassait clairement ce chiffre. Cause : PostgREST plafonne
      // une requête .select() à 1000 lignes par défaut, silencieusement,
      // sans erreur — un audit d'un livre complet (souvent plusieurs
      // milliers d'unités) se retrouvait tronqué sans avertissement. Pagine
      // par blocs de 1000 jusqu'à épuisement plutôt qu'une seule requête.
      const sections: { ordre: number; texte_source: string; chapitre_index: number | null }[] = [];
      const TAILLE_PAGE = 1000;
      for (let début = 0; ; début += TAILLE_PAGE) {
        const { data: page, error: erreurSections } = await supabase
          .from("audit_sections")
          .select("ordre, texte_source, chapitre_index")
          .eq("audit_id", auditId)
          .order("ordre", { ascending: true })
          .range(début, début + TAILLE_PAGE - 1);
        if (erreurSections) return réponse({ error: erreurSections.message }, 500);
        sections.push(...(page || []));
        if (!page || page.length < TAILLE_PAGE) break;
      }

      const emails = await emailParUserId([audit.user_id]);

      return réponse({ audit: { ...audit, email: emails[audit.user_id] || "(compte introuvable)" }, sections });
    }

    // "supprimer" — 12/09/2026, demandé par l'auteur du projet : la liste de
    // supervision s'accumule aussi avec des audits de test (parfois les
    // siens propres), sans aucun moyen de la nettoyer depuis cet écran.
    // Filtré sur consentement_supervision = true comme "detail" ci-dessus :
    // ne permet de supprimer que ce que cet écran montre réellement, jamais
    // un id arbitraire d'un autre audit non consenti. auditId revérifié
    // avant toute suppression — pas de suppression en masse possible ici.
    if (action === "supprimer") {
      const { auditId } = params;
      if (!auditId) return réponse({ error: "auditId requis." }, 400);

      const { data: audit, error: erreurLecture } = await supabase
        .from("audits")
        .select("id")
        .eq("id", auditId)
        .eq("consentement_supervision", true)
        .maybeSingle();
      if (erreurLecture) return réponse({ error: erreurLecture.message }, 500);
      if (!audit) return réponse({ error: "Audit introuvable ou supervision non consentie." }, 404);

      const { error: erreurSections } = await supabase.from("audit_sections").delete().eq("audit_id", auditId);
      if (erreurSections) return réponse({ error: erreurSections.message }, 500);
      const { error: erreurAudit } = await supabase.from("audits").delete().eq("id", auditId);
      if (erreurAudit) return réponse({ error: erreurAudit.message }, 500);

      return réponse({ ok: true });
    }

    return réponse({ error: "Action inconnue." }, 400);
  } catch (err) {
    console.error("Erreur admin-supervision-cursaudit :", err.message);
    return réponse({ error: err.message }, 500);
  }
});
