/**
 * CURSUS — Edge Function : admin-journal-erreurs (01/10/2026)
 * ======================================================================
 * Liste les erreurs techniques journalisées par journaliserErreur()
 * (src/lib/journalErreurs.js — table `journal_erreurs`, créée le
 * 15/07/2026) pour que Joseph puisse enfin les CONSULTER. La table
 * existait et était déjà écrite depuis plusieurs endroits (CopiloteIA,
 * Editeur, ImportDocx...), mais rien ne l'affichait nulle part — gap
 * signalé le 01/10/2026 en diagnostiquant un "le co-pilote n'a pas pu
 * traiter ce passage" récurrent et resté sans piste faute de pouvoir le
 * voir. Même principe que `admin-supervision-cursaudit` : en
 * service_role, parce que `journal_erreurs` est écrite par n'importe
 * quel compte (sa RLS, si elle existe, n'autorise a priori chacun qu'à
 * lire ses PROPRES lignes) — seul ce chemin permet une lecture
 * inter-comptes, réservée au propriétaire.
 *
 * SECRETS REQUIS : SUPABASE_URL, SERVICE_ROLE_KEY — déjà utilisés par
 * les autres fonctions admin de ce dépôt, mêmes noms exacts.
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
    const enTeteAuth = req.headers.get("authorization") || "";
    const jeton = enTeteAuth.replace(/^Bearer\s+/i, "");
    if (!jeton) return réponse({ error: "Non authentifié." }, 401);

    const { data: { user } } = await supabase.auth.getUser(jeton);
    if (!user?.email) return réponse({ error: "Non authentifié." }, 401);
    if (user.email !== EMAIL_PROPRIETAIRE) return réponse({ error: "Accès refusé." }, 403);

    const { limite } = await req.json().catch(() => ({}));
    const nombreMax = Math.min(Math.max(Number(limite) || 200, 1), 500);

    const { data: lignes, error } = await supabase
      .from("journal_erreurs")
      .select("id, created_at, contexte, message, user_id, projet_id")
      .order("created_at", { ascending: false })
      .limit(nombreMax);
    if (error) return réponse({ error: error.message }, 500);

    // Résout user_id → email, comme admin-supervision-cursaudit, pour que
    // chaque ligne soit identifiable sans avoir à recopier un uuid ailleurs.
    const idsUniques = [...new Set((lignes || []).map((l) => l.user_id).filter(Boolean))];
    const { data: users } = await supabase.auth.admin.listUsers();
    const emailParId: Record<string, string> = {};
    for (const u of users?.users || []) {
      if (idsUniques.includes(u.id)) emailParId[u.id] = u.email || "(sans email)";
    }

    const lignesAvecEmail = (lignes || []).map((l) => ({ ...l, email: emailParId[l.user_id] || null }));
    return réponse({ lignes: lignesAvecEmail });
  } catch (err) {
    return réponse({ error: err.message }, 500);
  }
});
