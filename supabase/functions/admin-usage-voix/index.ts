/**
 * CURSUS — Edge Function : admin-usage-voix (17/10/2026)
 * ======================================================================
 * Agrège `usage_voix` (lire-texte + transcrire-audio, voir
 * 2026-10-17-usage-voix.sql) pour que Joseph puisse suivre la
 * consommation réelle de la voix sans dépendre de platform.openai.com/
 * usage (qui mélange toute consommation OpenAI du compte, indifférenciée
 * par fonctionnalité). Même principe d'accès que `admin-journal-erreurs`
 * et `admin-supervision-cursaudit` : service_role, parce que `usage_voix`
 * n'autorise chacun qu'à lire ses PROPRES lignes (RLS) — seul ce chemin
 * permet une lecture agrégée inter-comptes, réservée au propriétaire.
 *
 * Renvoie les totaux du mois civil en cours (caractères lus, octets
 * dictés, nombre d'appels de chaque fonctionnalité) + le détail par
 * compte (email résolu), trié par plus gros consommateur. AUCUN coût en
 * euros calculé ici — voir le commentaire de la migration pour pourquoi
 * (tarifs OpenAI non figés dans ce dépôt).
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
    const enTeteAuth = req.headers.get("authorization") || "";
    const jeton = enTeteAuth.replace(/^Bearer\s+/i, "");
    if (!jeton) return réponse({ error: "Non authentifié." }, 401);

    const { data: { user } } = await supabase.auth.getUser(jeton);
    if (!user?.email) return réponse({ error: "Non authentifié." }, 401);
    if (user.email !== EMAIL_PROPRIETAIRE) return réponse({ error: "Accès refusé." }, 403);

    const débutMois = new Date();
    débutMois.setUTCDate(1);
    débutMois.setUTCHours(0, 0, 0, 0);

    // Pagination (comme ailleurs dans ce dépôt) — PostgREST plafonne une
    // lecture à 1000 lignes sans .range() explicite, sans erreur ; un mois
    // chargé pourrait dépasser ce seuil et fausser les totaux en silence.
    const TAILLE_PAGE = 1000;
    const lignes: { user_id: string; fonctionnalite: string; caracteres: number | null; taille_octets: number | null }[] = [];
    for (let page = 0; ; page++) {
      const { data: lot, error } = await supabase
        .from("usage_voix")
        .select("user_id, fonctionnalite, caracteres, taille_octets")
        .gte("cree_le", débutMois.toISOString())
        .range(page * TAILLE_PAGE, page * TAILLE_PAGE + TAILLE_PAGE - 1);
      if (error) return réponse({ error: error.message }, 500);
      if (!lot || lot.length === 0) break;
      lignes.push(...lot);
      if (lot.length < TAILLE_PAGE) break;
    }

    const totaux = {
      lecture_voix: { appels: 0, caracteres: 0 },
      dictee_vocale: { appels: 0, octets: 0 },
    };
    const parUtilisateur: Record<string, { lecture_appels: number; lecture_caracteres: number; dictee_appels: number; dictee_octets: number }> = {};
    const vide = () => ({ lecture_appels: 0, lecture_caracteres: 0, dictee_appels: 0, dictee_octets: 0 });

    for (const l of lignes) {
      const u = (parUtilisateur[l.user_id] ??= vide());
      if (l.fonctionnalite === "lecture_voix") {
        totaux.lecture_voix.appels++;
        totaux.lecture_voix.caracteres += l.caracteres ?? 0;
        u.lecture_appels++;
        u.lecture_caracteres += l.caracteres ?? 0;
      } else if (l.fonctionnalite === "dictee_vocale") {
        totaux.dictee_vocale.appels++;
        totaux.dictee_vocale.octets += l.taille_octets ?? 0;
        u.dictee_appels++;
        u.dictee_octets += l.taille_octets ?? 0;
      }
    }

    // Résout user_id → email, comme admin-journal-erreurs.
    const { data: users } = await supabase.auth.admin.listUsers();
    const emailParId: Record<string, string> = {};
    for (const u of users?.users || []) emailParId[u.id] = u.email || "(sans email)";

    const détailParCompte = Object.entries(parUtilisateur)
      .map(([userId, v]) => ({ user_id: userId, email: emailParId[userId] || null, ...v }))
      .sort((a, b) => (b.lecture_caracteres + b.dictee_octets) - (a.lecture_caracteres + a.dictee_octets));

    return réponse({ depuis_le: débutMois.toISOString(), totaux, par_compte: détailParCompte });
  } catch (err) {
    return réponse({ error: err.message }, 500);
  }
});
