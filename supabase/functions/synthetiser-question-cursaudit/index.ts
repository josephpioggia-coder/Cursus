/**
 * CURSAUDIT — Edge Function : synthetiser-question-cursaudit (référence
 * 60816-01, suite, 29/08/2026)
 * ============================================================================
 * Étape 2 du nouveau flux "Quelle est la question précise que vous voulez
 * poser à CursAudit ?" (demande explicite de l'auteur du projet, avec GPT) :
 * l'auteur·ice coche des préoccupations éditoriales ("Mon texte tient-il sa
 * promesse ?", "Le ton est-il adapté au public visé ?", etc., voir
 * PREOCCUPATIONS_QUESTION_PRECISE dans CursAuditQuestionnaire.jsx), et cette
 * fonction les combine, avec le profil auteur et le reste du contrat
 * d'intention déjà rempli (nature du projet, où en est l'auteur·ice,
 * pourquoi il/elle écrit, pour qui, ses critères de réussite, ce qu'il/elle
 * espère découvrir), en UNE SEULE question centrale, cohérente et
 * naturelle — pas une simple juxtaposition des cases cochées. L'auteur·ice
 * valide ou modifie ensuite cette proposition ; le texte final ("Question
 * centrale validée") devient la boussole transmise à CursAudit.
 *
 * RUPTURE ASSUMÉE AVEC LE PRINCIPE "QUESTIONNAIRE 100% STATIQUE" (voir
 * taxonomieContratIntentionCursAudit.js, "jamais de génération IA sur ce
 * chemin — fragilité constatée toute la journée du 28/08") : jusqu'ici,
 * aucune étape du questionnaire n'appelait l'IA, précisément pour éviter
 * cette fragilité. Cette fonction est une exception délibérée, demandée
 * explicitement par l'auteur du projet ("cette partie est dynamique et
 * suppose de lancer copilote") : contrairement au reste du questionnaire
 * (classification, cases à cocher), formuler une question cohérente à
 * partir de préoccupations disparates est un vrai travail de synthèse en
 * langage naturel, pas une simple sélection dans un arbre statique. Reste
 * un appel UNIQUE, léger (max_tokens bas, un seul passage Claude, pas de
 * second contrôle GPT) — pas le pipeline lourd du pré-audit.
 *
 * PAS DE LECTURE BASE DE DONNÉES : appelée AVANT la création de l'audit
 * (aucune ligne `audits` n'existe encore à ce stade du questionnaire) —
 * tout le contexte nécessaire (profil, contrat d'intention, préoccupations
 * cochées) est envoyé directement dans le corps de la requête par le
 * client, qui les a déjà en mémoire (état du formulaire).
 *
 * FICHIER AUTONOME (leçon du 16/08/2026) — pas d'import relatif, strict:true
 * dès l'écriture initiale, schéma conforme aux limites connues (pas de
 * maxItems, minItems à 0 ou 1 seulement).
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

const ajv = new Ajv({ allErrors: true, strict: false, useDefaults: true, removeAdditional: true });

const SCHEMA_QUESTION = {
  type: "object",
  properties: {
    question_proposee: { type: "string", default: "" },
  },
  required: ["question_proposee"],
  additionalProperties: false,
};
const validerQuestion = ajv.compile(SCHEMA_QUESTION);

interface ProfilEnvoye {
  profession?: string;
  identiteGenre?: string;
  trancheAge?: string;
  niveauEtudes?: string;
  matieresEtudiees?: string;
}

interface ContratIntentionEnvoye {
  ouEnEtesVous?: string;
  natureProjet?: { famille?: string; sousCategorie?: string; autre?: string };
  objectifs?: string[];
  destinataires?: string[];
  attentesCursus?: string[];
  criteresReussite?: string[];
  ceQueVousEspérezDécouvrir?: string[];
}

function construireContexte(
  profil: ProfilEnvoye | null,
  c: ContratIntentionEnvoye | null,
  preoccupations: string[],
  preoccupationAutre: string,
): string {
  const lignes: string[] = [];
  if (profil) {
    const p: string[] = [];
    if (profil.profession) p.push(`profession : ${profil.profession}`);
    if (profil.identiteGenre) p.push(`identité : ${profil.identiteGenre}`);
    if (profil.trancheAge) p.push(`tranche d'âge : ${profil.trancheAge}`);
    if (profil.niveauEtudes) p.push(`niveau d'études : ${profil.niveauEtudes}`);
    if (profil.matieresEtudiees) p.push(`domaines étudiés : ${profil.matieresEtudiees}`);
    if (p.length > 0) lignes.push(`Profil de l'auteur·ice : ${p.join(", ")}.`);
  }
  if (c?.natureProjet?.famille) {
    const nature = c.natureProjet.sousCategorie
      ? `${c.natureProjet.sousCategorie} (${c.natureProjet.famille})`
      : (c.natureProjet.autre || c.natureProjet.famille);
    lignes.push(`Nature du projet : ${nature}.`);
  }
  if (c?.ouEnEtesVous) lignes.push(`Où en est l'auteur·ice dans ce projet : ${c.ouEnEtesVous}.`);
  if (c?.objectifs && c.objectifs.length > 0) lignes.push(`Pourquoi l'auteur·ice écrit ce texte : ${c.objectifs.join(", ")}.`);
  if (c?.destinataires && c.destinataires.length > 0) lignes.push(`Pour qui ce texte est écrit : ${c.destinataires.join(", ")}.`);
  if (c?.attentesCursus && c.attentesCursus.length > 0) lignes.push(`Ce que l'auteur·ice attend de cet audit : ${c.attentesCursus.join(", ")}.`);
  if (c?.criteresReussite && c.criteresReussite.length > 0) lignes.push(`Ce qui ferait de ce projet une réussite : ${c.criteresReussite.join(", ")}.`);
  if (c?.ceQueVousEspérezDécouvrir && c.ceQueVousEspérezDécouvrir.length > 0) lignes.push(`Ce que l'auteur·ice espère découvrir : ${c.ceQueVousEspérezDécouvrir.join(", ")}.`);
  if (preoccupations.length > 0) lignes.push(`Préoccupations éditoriales cochées pour cette question précise : ${preoccupations.join(" / ")}.`);
  if (preoccupationAutre) lignes.push(`Préoccupation supplémentaire précisée librement par l'auteur·ice : "${preoccupationAutre}"`);
  return lignes.join("\n");
}

const SYSTEM_PROMPT =
  "Tu es le module de cadrage de CursAudit. On te donne le profil de l'auteur·ice (facultatif), son contrat " +
  "d'intention pour ce projet, et les préoccupations éditoriales qu'il/elle a cochées pour la question qu'il/elle " +
  "veut poser à CursAudit (éventuellement complétées par une précision libre). Combine ces éléments en UNE SEULE " +
  "question, claire et complète, formulée à la première personne (\"Mon texte...\", \"Est-ce que...\"), qui " +
  "deviendra la question centrale posée à CursAudit — la boussole de toute l'analyse.\n\n" +
  "RÈGLES :\n" +
  "- Ne te contente JAMAIS de juxtaposer les préoccupations cochées avec des \"et\" — synthétise-les en une " +
  "question cohérente et naturelle, comme le ferait l'auteur·ice lui-même s'il/elle prenait le temps de " +
  "formuler clairement son inquiétude principale.\n" +
  "- Si une seule préoccupation est cochée, ne l'enrichis pas artificiellement — reformule-la simplement, " +
  "sans lui ajouter des enjeux qui n'ont pas été cochés.\n" +
  "- N'invente aucun élément de contexte absent de ce qui t'est fourni.\n" +
  "- Reste concis : une à deux phrases maximum, jamais un paragraphe.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    if (!ANTHROPIC_KEY) return json({ error: "ANTHROPIC_KEY manquante." }, 500);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await admin.auth.getUser(token);
    if (authError || !userData?.user) return json({ error: "Authentification requise." }, 401);

    const body = await req.json();
    const profil: ProfilEnvoye | null = body?.profil ?? null;
    const contratIntention: ContratIntentionEnvoye | null = body?.contratIntention ?? null;
    const preoccupations: string[] = Array.isArray(body?.preoccupations) ? body.preoccupations : [];
    const preoccupationAutre: string = typeof body?.preoccupationAutre === "string" ? body.preoccupationAutre : "";

    if (preoccupations.length === 0 && !preoccupationAutre.trim()) {
      return json({ error: "Coche au moins une préoccupation, ou précise-la, avant de demander une proposition." }, 400);
    }

    const contexte = construireContexte(profil, contratIntention, preoccupations, preoccupationAutre);

    const réponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODELE_CLAUDE,
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: contexte }],
        tools: [{
          name: "question_centrale",
          description: "Question centrale proposée, synthétisée à partir du profil, du contrat d'intention et des préoccupations cochées.",
          input_schema: SCHEMA_QUESTION,
          strict: true,
        }],
        tool_choice: { type: "tool", name: "question_centrale" },
      }),
    });
    const résultatAPI = await réponse.json();
    if (!réponse.ok) return json({ error: résultatAPI?.error?.message || `Échec de l'appel Claude (${réponse.status}).` }, 502);

    const blocOutil = (résultatAPI.content ?? []).find((b: { type: string }) => b.type === "tool_use");
    if (!blocOutil) return json({ error: "Claude n'a renvoyé aucun bloc tool_use." }, 502);

    if (!validerQuestion(blocOutil.input)) {
      return json({ error: `Sortie non conforme au schéma : ${ajv.errorsText(validerQuestion.errors)}` }, 502);
    }

    return json({ question_proposee: (blocOutil.input as { question_proposee: string }).question_proposee });
  } catch (err) {
    console.error("Erreur synthetiser-question-cursaudit :", err.message);
    return json({ error: err.message }, 500);
  }
});
