/**
 * CURSAUDIT — Edge Function : preaudit-global-cursaudit (référence 60816-01,
 * suite — RENOMMÉ EN INTERNE "APERÇU" le 23/08/2026, nom de fonction déployée
 * inchangé pour ne pas casser l'URL déjà en place côté frontend).
 * ============================================================================
 * PHASE 1 SEULEMENT (gratuite) du travail en deux phases décrit par l'auteur
 * du projet le 15/08/2026 : "un travail plus léger qui permettrait à moindre
 * coût de comprendre que quelque chose doit être fait". Lecture globale du
 * manuscrit ENTIER, en UN SEUL appel Claude (fenêtre de contexte 1M tokens —
 * un livre y tient largement) : nature du texte, colonne vertébrale, tension
 * principale, forces/risques globaux, et une recommandation de palier —
 * juste assez pour orienter, pas un livrable en soi.
 *
 * La PHASE 2 — "le travail suivant, qui coûterait beaucoup plus cher" —
 * reprend le résultat de CETTE fonction et le développe en profondeur ; elle
 * vit dans une fonction séparée, preaudit-approfondi-cursaudit (23/08/2026),
 * seule à porter le nom "pré-audit" côté produit désormais. Erreur initiale
 * du 22/08/2026 corrigée : cette fonction-ci avait été présentée comme "le
 * pré-audit" et facturée sur le barème par tranche de mots — ce barème
 * s'applique en réalité à la phase 2, voir 2026-08-23-preaudit-vrai.sql.
 *
 * Reprend la proposition de GPT en la resserrant : sa taxonomie biologique
 * (endosquelette/mycélium/fleuve...) et ses "formats dérivés" sont écartés
 * — trop peu fiables/universels pour un champ structuré exploitable d'un
 * livre à l'autre.
 *
 * FICHIER AUTONOME (leçon du 16/08/2026) : le mécanisme d'appel IA
 * structuré est inliné ici, pas importé depuis _shared/.
 *
 * GRATUIT, PAS DE STATUT "PAYE" À VÉRIFIER : `audits.apercu_statut`
 * (non_demande → termine), `apercu_resultat`. `apercu_prix_ht` existe encore
 * dans le schéma (renommé depuis preaudit_prix_ht) mais reste toujours null
 * ici, gardé simplement pour ne pas casser la colonne.
 *
 * SECRETS REQUIS : ANTHROPIC_KEY, SUPABASE_URL, SERVICE_ROLE_KEY (déjà en place).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Ajv from "https://esm.sh/ajv@8?target=deno";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_KEY");

const MODELE_CLAUDE = "claude-sonnet-5";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS } });

const ajv = new Ajv({ allErrors: true, strict: false });

const SCHEMA_PREAUDIT = {
  type: "object",
  properties: {
    genre_apparent: { type: "string" },
    genre_reel_probable: { type: "string" },
    colonne_vertebrale: { type: "string" },
    tension_principale: { type: "string" },
    forces_globales: { type: "array", items: { type: "string" } },
    risques_globaux: { type: "array", items: { type: "string" } },
    audit_recommande: {
      type: "object",
      properties: {
        palier: { type: "string", enum: ["essentiel", "approfondi", "expert"] },
        priorites: { type: "array", items: { type: "string" } },
      },
      required: ["palier", "priorites"],
      additionalProperties: false,
    },
  },
  required: [
    "genre_apparent", "genre_reel_probable", "colonne_vertebrale", "tension_principale",
    "forces_globales", "risques_globaux", "audit_recommande",
  ],
  additionalProperties: false,
};

const SYSTEM_PREAUDIT =
  "Tu es le module de lecture globale de CursAudit. On te donne un manuscrit ENTIER, pas un extrait. " +
  "Avant tout audit détaillé unité par unité, produis une lecture d'ensemble, presque anatomique : " +
  "quel texte avons-nous devant nous, qu'est-ce qui le tient, où sont ses tensions et ses risques à l'échelle du livre entier — " +
  "pas des observations locales sur un passage précis, mais ce qui ne se voit qu'en lisant le tout.\n\n" +
  "- genre_apparent : le genre que le livre affiche (ex. \"essai spirituel\", \"témoignage thérapeutique\", \"manuel pratique\").\n" +
  "- genre_reel_probable : le genre que sa forme réelle suggère, s'il diffère de l'apparent.\n" +
  "- colonne_vertebrale : une à deux phrases — ce qui tient le livre de bout en bout.\n" +
  "- tension_principale : l'écart le plus significatif entre ce que le livre prétend être et sa forme réelle (s'il y en a un).\n" +
  "- forces_globales / risques_globaux : des observations à l'échelle du livre entier, jamais des redites d'un seul passage.\n" +
  "- audit_recommande.palier : le palier de profondeur (essentiel/approfondi/expert) le plus adapté à ce texte pour l'audit détaillé qui suivra.\n" +
  "- audit_recommande.priorites : sur quoi l'audit détaillé devrait se concentrer en priorité pour CE livre précis, pas une liste générique.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    if (!ANTHROPIC_KEY) return json({ error: "ANTHROPIC_KEY manquante." }, 500);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await admin.auth.getUser(token);
    if (authError || !userData?.user) return json({ error: "Authentification requise." }, 401);
    const userId = userData.user.id;

    const body = await req.json();
    const auditId: string | undefined = body?.audit_id;
    if (!auditId) return json({ error: "audit_id est requis." }, 400);

    const { data: audit } = await admin
      .from("audits")
      .select("id, user_id, titre, apercu_statut")
      .eq("id", auditId)
      .maybeSingle();
    if (!audit || audit.user_id !== userId) return json({ error: "Audit introuvable." }, 404);
    if (audit.apercu_statut === "termine") {
      return json({ error: "déjà_fait", message: "L'aperçu global a déjà été généré pour cet audit." }, 409);
    }

    // CORRECTIF 26/08/2026 — bug réel trouvé sur "À cœur retrouvé" (1442
    // unités) : Supabase/PostgREST plafonne une lecture à 1000 lignes par
    // défaut si on ne pagine pas explicitement — sans erreur, juste moins de
    // lignes que la vraie table. Un seul select() ici ne renvoyait donc que
    // les 1000 premières unités (dans l'ordre), amputant l'aperçu des ~30%
    // de fin de ce livre sans avertissement. Lecture par lots de 1000 via
    // .range() jusqu'à épuisement, pour lire la table entière quelle que
    // soit sa taille.
    const TAILLE_PAGE = 1000;
    const sections: { texte_source: string }[] = [];
    for (let page = 0; ; page++) {
      const { data: lot } = await admin
        .from("audit_sections")
        .select("texte_source")
        .eq("audit_id", auditId)
        .order("ordre", { ascending: true })
        .range(page * TAILLE_PAGE, page * TAILLE_PAGE + TAILLE_PAGE - 1);
      if (!lot || lot.length === 0) break;
      sections.push(...lot);
      if (lot.length < TAILLE_PAGE) break;
    }
    if (sections.length === 0) return json({ error: "Aucune unité dans cet audit." }, 400);

    const texteIntegral = sections.map((s) => s.texte_source).join("\n\n");

    const réponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODELE_CLAUDE,
        max_tokens: 8192,
        system: SYSTEM_PREAUDIT,
        messages: [{ role: "user", content: texteIntegral }],
        tools: [{ name: "lecture_globale", description: "Synthèse structurée de la lecture globale du manuscrit.", input_schema: SCHEMA_PREAUDIT }],
        tool_choice: { type: "tool", name: "lecture_globale" },
      }),
    });
    const résultatAPI = await réponse.json();
    if (!réponse.ok) return json({ error: résultatAPI?.error?.message || `Échec de l'appel Claude (${réponse.status}).` }, 502);

    // CORRECTIF 25/08/2026 — max_tokens était à 2048, bien trop bas pour un
    // livre entier (constaté en test réel : réponse tronquée juste avant
    // forces_globales/risques_globaux/audit_recommande, les 3 derniers
    // champs du schéma — Claude coupé en plein milieu de sa génération,
    // pas une "erreur de schéma" à proprement parler). Détection explicite
    // pour un message clair plutôt que l'erreur AJV cryptique qui en résultait.
    if (résultatAPI.stop_reason === "max_tokens") {
      return json({ error: "La réponse de Claude a été tronquée (limite de longueur atteinte) — réessaie, ou signale-le si ça se reproduit sur ce livre." }, 502);
    }

    const blocOutil = (résultatAPI.content ?? []).find((b: { type: string }) => b.type === "tool_use");
    if (!blocOutil) return json({ error: "Claude n'a renvoyé aucun bloc tool_use." }, 502);

    const valide = ajv.compile(SCHEMA_PREAUDIT);
    if (!valide(blocOutil.input)) {
      return json({ error: `Sortie non conforme au schéma : ${ajv.errorsText(valide.errors)}` }, 502);
    }

    const apercuResultat = {
      ...blocOutil.input,
      nombre_mots: texteIntegral.split(/\s+/).filter(Boolean).length,
      usage: { tokens_entree: résultatAPI.usage?.input_tokens ?? 0, tokens_sortie: résultatAPI.usage?.output_tokens ?? 0, modele: résultatAPI.model ?? MODELE_CLAUDE },
      analyse_le: new Date().toISOString(),
    };

    const { error: erreurMaj } = await admin
      .from("audits")
      .update({ apercu_statut: "termine", apercu_resultat: apercuResultat })
      .eq("id", auditId);
    if (erreurMaj) return json({ error: erreurMaj.message }, 500);

    return json({ audit_id: auditId, apercu: apercuResultat });
  } catch (err) {
    console.error("Erreur preaudit-global-cursaudit :", err.message);
    return json({ error: err.message }, 500);
  }
});
