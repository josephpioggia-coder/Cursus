/**
 * CURSUS ÉDITION — Edge Function : verification-deux-ia (protocole 60805-06)
 * ============================================================================
 * Implémente docs/protocole-verification-approfondie-deux-ia.md à la lettre
 * (étape 0 à 7, logigramme d'orchestration).
 *
 * FICHIER AUTONOME (16/08/2026) : le module d'appel IA structuré, à l'origine
 * dans supabase/functions/_shared/moteur-ia-structure.ts, est inliné ici
 * directement. Cause du changement : déployée via le Dashboard (collage du
 * seul index.ts), la fonction ne pouvait pas résoudre l'import relatif vers
 * _shared — l'isolate Deno échouait à démarrer pour CHAQUE requête, sans
 * jamais exécuter une ligne de mon code (confirmé par les logs Supabase :
 * event_type "Shutdown", reason "EarlyDrop", aucune trace d'exécution).
 * Le fichier _shared/moteur-ia-structure.ts reste dans le dépôt pour un futur
 * déploiement par CLI (qui embarque tout le dossier supabase/functions/),
 * mais cette fonction-ci n'en dépend plus — un seul fichier à coller suffit,
 * quelle que soit la méthode de déploiement.
 *
 * LIMITES CONNUES DE CETTE PREMIÈRE VERSION (documentées, pas cachées) :
 *  - Étape 0 est mécanique comme l'exige le protocole, mais la détection de
 *    "thèmes" et de "reprises sémantiques" reste un simple appariement par
 *    mot-clé (ILIKE) — la reprise "sémantique" au sens propre n'est pas
 *    implémentée (nécessiterait des embeddings, hors périmètre ici).
 *  - `changements_de_registre` n'est volontairement pas rempli par l'étape 0
 *    (classer un registre par liste de mots produirait une fausse précision)
 *    — chaque `claim` de Claude porte son propre `registre`, c'est la source
 *    de vérité pour ce signal.
 *  - `verdict_these_livre` (verdict sur la thèse du livre, distinct du
 *    verdict local) n'est pas calculé dans cette version : le protocole
 *    documente le besoin des deux verdicts mais ne décrit pas de mécanisme
 *    pour évaluer la thèse d'ensemble à partir d'un dialogue sur un seul
 *    passage — laissé à `null` plutôt qu'inventé.
 *  - `alignement_interet` et `zones_sous_expertise_requise` restent aux
 *    valeurs par défaut du dossier de contexte (non calculées mécaniquement,
 *    comme le squelette du protocole le suggère) — ce sont les tours IA qui
 *    les signalent via corrections_bloquantes le cas échéant.
 *  - MODELE_CLAUDE / MODELE_GPT ci-dessous sont des valeurs par défaut,
 *    à vérifier/mettre à jour — surchageables via le corps de la requête
 *    (`modele_claude`, `modele_gpt`).
 *
 * SECRETS REQUIS : ANTHROPIC_KEY, OPENAI_API_KEY, SUPABASE_URL,
 * SERVICE_ROLE_KEY (tous déjà en place, voir P0a/P0b).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Ajv from "https://esm.sh/ajv@8?target=deno";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const MODELE_CLAUDE = "claude-sonnet-5";
const MODELE_GPT = "gpt-4o";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });

// ─── Schémas de sortie structurée (partagés entre les deux moteurs) ────────

const SCHEMA_CORRECTION = {
  type: "object",
  properties: {
    texte: { type: "string" },
    categorie: {
      type: "string",
      enum: [
        "valeur_ajoutee_editoriale",
        "corrections_probables",
        "alertes_a_verifier_sur_source",
        "remarques_non_bloquantes",
      ],
    },
  },
  required: ["texte", "categorie"],
  additionalProperties: false,
};

const SCHEMA_ALERTE_CONTEXTE_CHAMPS = {
  type_contexte_manquant: {
    type: ["string", "null"],
    enum: [
      "occurrences_aval",
      "contexte_amont",
      "definition_theorique",
      "intention_auteur",
      "passage_pedagogique",
      "offre_commerciale",
      null,
    ],
  },
  theme_a_rechercher: { type: ["string", "null"] },
  raison_alerte: { type: ["string", "null"] },
  requete_ciblee: { type: "array", items: { type: "string" } },
};

const SCHEMA_TOUR_CLAUDE = {
  type: "object",
  properties: {
    tour: { type: "string" },
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          affirmation: { type: "string" },
          registre: {
            type: "string",
            enum: [
              "phenomenologique",
              "autobiographique_interpretatif",
              "symbolique_spirituel",
              "theorique_general",
              "pedagogique",
              "prescriptif",
            ],
          },
        },
        required: ["affirmation", "registre"],
        additionalProperties: false,
      },
    },
    analyse: { type: "string" },
    corrections_bloquantes: { type: "array", items: SCHEMA_CORRECTION },
    corrections_non_bloquantes: { type: "array", items: SCHEMA_CORRECTION },
    alerte_contexte: { type: "boolean" },
    ...SCHEMA_ALERTE_CONTEXTE_CHAMPS,
    peut_arreter: { type: "boolean" },
    reponse_optimale_auteur: { type: ["string", "null"] },
  },
  required: [
    "tour", "claims", "analyse", "corrections_bloquantes", "corrections_non_bloquantes",
    "alerte_contexte", "type_contexte_manquant", "theme_a_rechercher", "raison_alerte",
    "requete_ciblee", "peut_arreter", "reponse_optimale_auteur",
  ],
  additionalProperties: false,
};

const SCHEMA_TOUR_GPT = {
  type: "object",
  properties: {
    tour: { type: "string" },
    statut: {
      type: "string",
      enum: ["accord", "accord_avec_nuances", "desaccord_partiel", "desaccord_majeur"],
    },
    corrections_bloquantes: { type: "array", items: SCHEMA_CORRECTION },
    corrections_non_bloquantes: { type: "array", items: SCHEMA_CORRECTION },
    alerte_contexte: { type: "boolean" },
    ...SCHEMA_ALERTE_CONTEXTE_CHAMPS,
    peut_arreter: { type: "boolean" },
    verdict: {
      type: "string",
      enum: ["recevable", "recevable_avec_reserves", "correction_recommandee", "verdict_provisoire"],
    },
    reponse_optimale_auteur: { type: ["string", "null"] },
  },
  required: [
    "tour", "statut", "corrections_bloquantes", "corrections_non_bloquantes", "alerte_contexte",
    "type_contexte_manquant", "theme_a_rechercher", "raison_alerte", "requete_ciblee",
    "peut_arreter", "verdict", "reponse_optimale_auteur",
  ],
  additionalProperties: false,
};

// ─── Étape 0 — cartographie contextuelle mécanique (jamais une IA) ─────────

const MOTS_VIDES = new Set([
  "dans", "avec", "pour", "cette", "leur", "leurs", "elle", "elles",
  "nous", "vous", "quand", "comme", "mais", "donc", "alors", "être", "avoir",
  "fait", "faire", "sans", "plus", "moins", "très", "tout", "tous", "toute",
  "toutes", "ainsi", "aussi", "encore", "déjà", "jamais", "toujours", "entre",
]);

function extraireThemes(texte: string): string[] {
  const themes = new Map<string, number>();

  // Séquences capitalisées (candidats noms propres / concepts nommés).
  const propres = texte.match(/\b[A-ZÀ-Ý][a-zà-ÿ]+(?:\s+[A-ZÀ-Ý][a-zà-ÿ]+)*\b/g) ?? [];
  for (const p of propres) {
    themes.set(p, (themes.get(p) ?? 0) + 2); // poids plus fort qu'un mot courant
  }

  // Mots courants significatifs (longueur ≥ 5, hors mots vides).
  const mots = texte.toLowerCase().match(/\p{L}{5,}/gu) ?? [];
  for (const m of mots) {
    if (MOTS_VIDES.has(m)) continue;
    themes.set(m, (themes.get(m) ?? 0) + 1);
  }

  return [...themes.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([theme]) => theme);
}

function extraireVerbatim(texteNoeud: string, theme: string, marge = 120): string | null {
  const idx = texteNoeud.toLowerCase().indexOf(theme.toLowerCase());
  if (idx === -1) return null;
  const debut = Math.max(0, idx - marge);
  const fin = Math.min(texteNoeud.length, idx + theme.length + marge);
  return (debut > 0 ? "…" : "") + texteNoeud.slice(debut, fin).replace(/\s+/g, " ").trim() + (fin < texteNoeud.length ? "…" : "");
}

interface OccurrencePertinente {
  theme: string;
  node_id: string;
  extrait: string;
  fonction: string;
}

async function rechercherOccurrences(
  admin: ReturnType<typeof createClient>,
  projetId: string,
  exclureNoeudId: string | null,
  themes: string[],
): Promise<OccurrencePertinente[]> {
  if (themes.length === 0) return [];

  let requete = admin.from("noeuds").select("id, texte").eq("projet_id", projetId).not("texte", "is", null);
  if (exclureNoeudId) requete = requete.neq("id", exclureNoeudId);
  const { data: noeuds } = await requete;
  if (!noeuds) return [];

  const occurrences: OccurrencePertinente[] = [];
  for (const theme of themes) {
    let trouvesPourCeTheme = 0;
    for (const noeud of noeuds) {
      if (trouvesPourCeTheme >= 3) break; // recherche ciblée, pas exhaustive
      if (!noeud.texte) continue;
      const extrait = extraireVerbatim(noeud.texte, theme);
      if (!extrait) continue;
      occurrences.push({
        theme,
        node_id: noeud.id,
        extrait,
        fonction: "occurrence du thème détectée par recherche mot-clé dans ce nœud (à interpréter par l'analyse, pas une conclusion de Cursus)",
      });
      trouvesPourCeTheme++;
    }
  }
  return occurrences;
}

interface DossierContexte {
  metadata: Record<string, unknown>;
  intention_auteur: Record<string, unknown> | null;
  themes_detectes: string[];
  occurrences_pertinentes: OccurrencePertinente[];
  changements_de_registre: unknown[];
  changements_de_personne: { marqueur: string; occurrences: number }[];
  alignement_interet: null;
  zones_sous_expertise_requise: unknown[];
  couverture_manuscrit: number;
  contexte_suffisant: boolean;
  contexte_relance_count: number;
}

function detecterChangementsDePersonne(texte: string): { marqueur: string; occurrences: number }[] {
  const marqueurs: Record<string, RegExp> = {
    je: /\b(je|j'|mon|ma|mes)\b/gi,
    nous: /\b(nous|notre|nos)\b/gi,
    vous: /\b(vous|votre|vos)\b/gi,
    on: /\bon\b/gi,
  };
  const résultat: { marqueur: string; occurrences: number }[] = [];
  for (const [marqueur, regex] of Object.entries(marqueurs)) {
    const occurrences = (texte.match(regex) ?? []).length;
    if (occurrences > 0) résultat.push({ marqueur, occurrences });
  }
  return résultat;
}

async function construireDossierContexte(
  admin: ReturnType<typeof createClient>,
  projetId: string,
  noeudId: string | null,
  texteSelectionne: string,
  intentionDeclaree: Record<string, unknown> | null,
): Promise<DossierContexte> {
  const { data: projet } = await admin
    .from("projets")
    .select("titre, genre, description")
    .eq("id", projetId)
    .maybeSingle();

  const { data: tousLesNoeuds } = await admin
    .from("noeuds")
    .select("id, texte")
    .eq("projet_id", projetId);

  const total = tousLesNoeuds?.length ?? 0;
  const remplis = (tousLesNoeuds ?? []).filter((n) => (n.texte ?? "").trim().length > 0).length;
  const couvertureManuscrit = total > 0 ? remplis / total : 0;

  const themes = extraireThemes(texteSelectionne);
  const occurrences = await rechercherOccurrences(admin, projetId, noeudId, themes);
  const changementsDePersonne = detecterChangementsDePersonne(texteSelectionne);

  // Heuristique de suffisance — documentée, ajustable : un contexte est
  // jugé suffisant si des occurrences réelles ont été trouvées ailleurs
  // dans le projet, ou si le manuscrit est déjà largement rempli (le
  // passage a alors plus de chances d'être auto-suffisant).
  const contexteSuffisant = occurrences.length > 0 || couvertureManuscrit >= 0.5;

  return {
    metadata: { titre: projet?.titre ?? null, genre: projet?.genre ?? null },
    intention_auteur: intentionDeclaree,
    themes_detectes: themes,
    occurrences_pertinentes: occurrences,
    changements_de_registre: [],
    changements_de_personne: changementsDePersonne,
    alignement_interet: null,
    zones_sous_expertise_requise: [],
    couverture_manuscrit: Math.round(couvertureManuscrit * 100) / 100,
    contexte_suffisant: contexteSuffisant,
    contexte_relance_count: 0,
  };
}

async function enrichirDossier(
  admin: ReturnType<typeof createClient>,
  dossier: DossierContexte,
  projetId: string,
  noeudId: string | null,
  requeteCiblee: string[],
): Promise<DossierContexte> {
  const nouvellesOccurrences = await rechercherOccurrences(admin, projetId, noeudId, requeteCiblee);
  return {
    ...dossier,
    occurrences_pertinentes: [...dossier.occurrences_pertinentes, ...nouvellesOccurrences],
    contexte_relance_count: dossier.contexte_relance_count + 1,
    contexte_suffisant: nouvellesOccurrences.length > 0 ? true : dossier.contexte_suffisant,
  };
}

// ─── Suivi de consommation (répliqué de claude-prox) ───────────────────────

interface AppelJournalise {
  tour: string;
  modele: string;
  tokens_entree: number;
  tokens_sortie: number;
}

// ─── Module IA structuré (inliné — voir note en tête de fichier) ──────────

interface AppelMoteurIAParams {
  moteur: "claude" | "gpt";
  modele: string;
  role: string;
  schema_sortie: Record<string, unknown>;
  system: string;
  contexte: string;
  max_tokens?: number;
}

interface UsageIA {
  tokens_entree: number;
  tokens_sortie: number;
  modele: string;
}

interface AppelMoteurIAResultat {
  data: unknown;
  usage: UsageIA;
}

const ajv = new Ajv({ allErrors: true, strict: false });

function validerContreSchema(data: unknown, schema: Record<string, unknown>): void {
  const valide = ajv.compile(schema);
  if (!valide(data)) {
    throw new Error(`Sortie IA non conforme au schéma attendu : ${ajv.errorsText(valide.errors)}`);
  }
}

/**
 * Tolère "null" comme représentation de tableau vide — les modèles rendent
 * parfois `null` plutôt que `[]` pour un champ tableau sans élément (observé
 * en usage réel le 16/08/2026, "claims" de Claude). Ne touche à rien
 * d'autre : un champ manquant, ou de type incorrect autrement, reste rejeté
 * par validerContreSchema comme avant.
 */
function normaliserTableauxNuls(schema: Record<string, unknown>, data: unknown): unknown {
  if (data === null || typeof data !== "object" || Array.isArray(data)) return data;
  const props = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
  const résultat: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  for (const [cle, sousSchema] of Object.entries(props)) {
    if (sousSchema.type === "array" && (résultat[cle] === null || résultat[cle] === undefined)) {
      résultat[cle] = [];
    }
  }
  return résultat;
}

async function appellerClaudeMoteur(params: AppelMoteurIAParams): Promise<AppelMoteurIAResultat> {
  if (!ANTHROPIC_KEY) throw new Error("ANTHROPIC_KEY manquante.");

  const nomOutil = "sortie_structuree";
  const réponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: params.modele,
      max_tokens: params.max_tokens ?? 4096,
      system: params.system,
      messages: [{ role: "user", content: params.contexte }],
      tools: [{ name: nomOutil, description: `Sortie structurée pour le rôle "${params.role}".`, input_schema: params.schema_sortie }],
      tool_choice: { type: "tool", name: nomOutil },
    }),
  });

  const résultat = await réponse.json();
  if (!réponse.ok) {
    throw new Error(résultat?.error?.message || `Échec de l'appel Claude (${réponse.status}).`);
  }

  const blocOutil = (résultat.content ?? []).find((bloc: { type: string }) => bloc.type === "tool_use");
  if (!blocOutil) {
    throw new Error("Claude n'a renvoyé aucun bloc tool_use — sortie structurée absente.");
  }

  const donneesNormalisees = normaliserTableauxNuls(params.schema_sortie, blocOutil.input);
  validerContreSchema(donneesNormalisees, params.schema_sortie);

  return {
    data: donneesNormalisees,
    usage: {
      tokens_entree: résultat.usage?.input_tokens ?? 0,
      tokens_sortie: résultat.usage?.output_tokens ?? 0,
      modele: résultat.model ?? params.modele,
    },
  };
}

async function appellerGPTMoteur(params: AppelMoteurIAParams): Promise<AppelMoteurIAResultat> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY manquante.");

  const réponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: params.modele,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.contexte },
      ],
      response_format: { type: "json_schema", json_schema: { name: "sortie_structuree", schema: params.schema_sortie, strict: true } },
    }),
  });

  const résultat = await réponse.json();
  if (!réponse.ok) {
    throw new Error(résultat?.error?.message || `Échec de l'appel GPT (${réponse.status}).`);
  }

  const contenuBrut = résultat.choices?.[0]?.message?.content;
  if (!contenuBrut) {
    throw new Error("GPT n'a renvoyé aucun contenu — sortie structurée absente.");
  }

  let data: unknown;
  try {
    data = JSON.parse(contenuBrut);
  } catch {
    throw new Error("Sortie GPT non parsable en JSON malgré response_format json_schema.");
  }

  const donneesNormalisees = normaliserTableauxNuls(params.schema_sortie, data);
  validerContreSchema(donneesNormalisees, params.schema_sortie);

  return {
    data: donneesNormalisees,
    usage: {
      tokens_entree: résultat.usage?.prompt_tokens ?? 0,
      tokens_sortie: résultat.usage?.completion_tokens ?? 0,
      modele: résultat.model ?? params.modele,
    },
  };
}

async function appellerMoteurIAStructure(params: AppelMoteurIAParams): Promise<AppelMoteurIAResultat> {
  if (params.moteur === "claude") return appellerClaudeMoteur(params);
  if (params.moteur === "gpt") return appellerGPTMoteur(params);
  throw new Error(`Moteur IA inconnu : "${params.moteur}".`);
}

// ─── Handler principal ──────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Authentification (même schéma que claude-prox)
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await admin.auth.getUser(token);
    if (authError || !userData?.user) {
      return json({ error: "Authentification requise." }, 401);
    }
    const userId = userData.user.id;

    // 2. Quota — même mécanisme que claude-prox (abonnement + tokens du mois)
    const { data: abos } = await admin
      .from("abonnements")
      .select("palier, statut")
      .eq("user_id", userId)
      .eq("statut", "actif")
      .order("date_debut", { ascending: false })
      .limit(1);
    const abo = abos?.[0] ?? null;
    if (!abo) {
      return json({ error: "quota", message: "Aucun abonnement actif." }, 403);
    }

    const { data: quota } = await admin
      .from("quotas_paliers")
      .select("tokens_mensuels")
      .ilike("palier", abo.palier)
      .maybeSingle();
    if (!quota) {
      return json({ error: "config", message: `Palier "${abo.palier}" sans quota configuré.` }, 500);
    }

    const debutMois = new Date();
    debutMois.setUTCDate(1);
    debutMois.setUTCHours(0, 0, 0, 0);
    const { data: usages } = await admin
      .from("usage_ia")
      .select("tokens_entree, tokens_sortie")
      .eq("user_id", userId)
      .gte("created_at", debutMois.toISOString());
    const consomme = (usages ?? []).reduce((s, u) => s + (u.tokens_entree ?? 0) + (u.tokens_sortie ?? 0), 0);
    if (consomme >= quota.tokens_mensuels) {
      return json({ error: "quota", message: "Quota mensuel atteint.", consomme, quota: quota.tokens_mensuels }, 429);
    }

    // 3. Corps de la requête
    const body = await req.json();
    const projetId: string | undefined = body?.projet_id;
    const noeudId: string | null = body?.noeud_id ?? null;
    const texteSelectionne: string | undefined = body?.texte_selectionne;
    const intentionDeclaree: Record<string, unknown> | null = body?.intention_declaree ?? null;
    const modeleClaude: string = body?.modele_claude || MODELE_CLAUDE;
    const modeleGPT: string = body?.modele_gpt || MODELE_GPT;

    if (!projetId || !texteSelectionne) {
      return json({ error: "projet_id et texte_selectionne sont requis." }, 400);
    }

    const journal: AppelJournalise[] = [];

    // ── Étape 0 ──
    let dossier = await construireDossierContexte(admin, projetId, noeudId, texteSelectionne, intentionDeclaree);

    const appelerClaude = async (tour: string, consigne: string, tourPrecedentGPT?: unknown) => {
      const { data, usage } = await appellerMoteurIAStructure({
        moteur: "claude",
        modele: modeleClaude,
        role: "analyseur_initial",
        schema_sortie: SCHEMA_TOUR_CLAUDE,
        system: "Tu es l'analyseur initial du protocole de vérification à deux IA de Cursus (60805-06). " +
          "Analyse les affirmations précises du passage en tenant compte STRICTEMENT du dossier de contexte fourni. " +
          "Ne produis jamais de verdict définitif si contexte_suffisant est faux dans le dossier. " +
          "Tous les champs tableau (claims, corrections_bloquantes, corrections_non_bloquantes, requete_ciblee) " +
          "doivent toujours être un tableau JSON, jamais null — utilise [] si aucun élément. " +
          consigne,
        contexte: JSON.stringify({
          texte_selectionne: texteSelectionne,
          dossier_contexte: dossier,
          tour_precedent_gpt: tourPrecedentGPT ?? null,
        }),
      });
      journal.push({ tour, modele: usage.modele, tokens_entree: usage.tokens_entree, tokens_sortie: usage.tokens_sortie });
      return data as Record<string, unknown>;
    };

    const appelerGPT = async (tour: string, tourPrecedent: unknown) => {
      const { data, usage } = await appellerMoteurIAStructure({
        moteur: "gpt",
        modele: modeleGPT,
        role: "critique_adversarial",
        schema_sortie: SCHEMA_TOUR_GPT,
        system: "Tu es le critique adversarial du protocole de vérification à deux IA de Cursus (60805-06). " +
          "Conteste les affirmations précises du tour précédent en t'appuyant STRICTEMENT sur le dossier de contexte fourni — " +
          "jamais sur tes propres suppositions non vérifiables dans le texte. " +
          "Seule une objection factuelle, théorique, logique ou éthique réelle justifie peut_arreter=false ; " +
          "une préférence stylistique ne bloque jamais. " +
          "Tous les champs tableau (corrections_bloquantes, corrections_non_bloquantes, requete_ciblee) " +
          "doivent toujours être un tableau JSON, jamais null — utilise [] si aucun élément.",
        contexte: JSON.stringify({
          texte_selectionne: texteSelectionne,
          dossier_contexte: dossier,
          tour_precedent: tourPrecedent,
        }),
      });
      journal.push({ tour, modele: usage.modele, tokens_entree: usage.tokens_entree, tokens_sortie: usage.tokens_sortie });
      return data as Record<string, unknown>;
    };

    // ── Tour A1 (Claude, analyse initiale) ──
    const a1 = await appelerClaude("A1", "Premier tour : analyse initiale du passage.");

    // ── Tour B1 (GPT, critique) ──
    let b1 = await appelerGPT("B1", a1);

    // ── Gestion d'alerte_contexte : une seule relance, jamais plus ──
    if (b1.alerte_contexte === true) {
      if (dossier.contexte_relance_count < 1) {
        const requeteCiblee = Array.isArray(b1.requete_ciblee) ? (b1.requete_ciblee as string[]) : [];
        dossier = await enrichirDossier(admin, dossier, projetId, noeudId, requeteCiblee);
        b1 = await appelerGPT("B1-relance", a1);
      }

      if (b1.alerte_contexte === true) {
        // Arrêt : verdict provisoire, contexte insuffisant malgré la relance.
        await journaliserUsage(admin, userId, projetId, journal);
        return json({
          verdict: "verdict_provisoire",
          raison: "Contexte interne insuffisant malgré une relance ciblée.",
          analyse_locale: "possible",
          analyse_globale: "non_conclusive",
          contexte_manquant: b1.raison_alerte ?? b1.type_contexte_manquant ?? null,
          recommandation: "Fournir ou indexer les sections concernées avant de conclure.",
        });
      }
    }

    const tours: Record<string, Record<string, unknown>> = { a1, b1 };

    // ── Prolongation éventuelle (plafond dur : A2 puis B2 maximum) ──
    if (b1.peut_arreter !== true) {
      const a2 = await appelerClaude("A2", "Tour de révision ou de défense face à la critique du tour précédent.", b1);
      tours.a2 = a2;

      if (a2.peut_arreter !== true) {
        const b2 = await appelerGPT("B2", { a1, b1, a2 });
        tours.b2 = b2;
        // Arrêt obligatoire ici quel que soit peut_arreter — plafond de profondeur atteint.
      }
    }

    // ── Étape 7 — sortie finale, assemblage mécanique par Cursus ──
    const sortieFinale = assemblerSortieFinale(tours, dossier);

    await journaliserUsage(admin, userId, projetId, journal);

    return json(sortieFinale);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});

// ─── Assemblage de la sortie finale (mécanique, pas un nouvel appel IA) ────

function assemblerSortieFinale(tours: Record<string, Record<string, unknown>>, dossier: DossierContexte) {
  const buckets: Record<string, string[]> = {
    valeur_ajoutee_editoriale: [],
    corrections_probables: [],
    alertes_a_verifier_sur_source: [],
    remarques_non_bloquantes: [],
  };

  for (const tour of Object.values(tours)) {
    for (const cle of ["corrections_bloquantes", "corrections_non_bloquantes"] as const) {
      const liste = tour[cle];
      if (!Array.isArray(liste)) continue;
      for (const item of liste) {
        if (item && typeof item === "object" && "categorie" in item && "texte" in item) {
          const categorie = String((item as Record<string, unknown>).categorie);
          if (categorie in buckets) buckets[categorie].push(String((item as Record<string, unknown>).texte));
        }
      }
    }
  }

  // Dernier tour GPT disponible = source du verdict (seuls les tours GPT
  // portent un champ `verdict`, voir docs/protocole-verification-approfondie-deux-ia.md).
  const dernierTourGPT = (tours.b2 ?? tours.b1) as Record<string, unknown>;

  return {
    verdict_passage: dernierTourGPT.verdict ?? "verdict_provisoire",
    verdict_these_livre: null, // voir limite documentée en tête de fichier
    reponse_optimale_auteur: dernierTourGPT.reponse_optimale_auteur ?? null,
    valeur_ajoutee_editoriale: buckets.valeur_ajoutee_editoriale,
    corrections_probables: buckets.corrections_probables,
    alertes_a_verifier_sur_source: buckets.alertes_a_verifier_sur_source,
    remarques_non_bloquantes: buckets.remarques_non_bloquantes,
    contexte_suffisant: dossier.contexte_suffisant,
    couverture_manuscrit: dossier.couverture_manuscrit,
    tours_effectues: Object.keys(tours),
  };
}

async function journaliserUsage(
  admin: ReturnType<typeof createClient>,
  userId: string,
  projetId: string,
  journal: AppelJournalise[],
) {
  if (journal.length === 0) return;
  const lignes = journal.map((j) => ({
    user_id: userId,
    projet_id: projetId,
    tokens_entree: j.tokens_entree,
    tokens_sortie: j.tokens_sortie,
    modele: `${j.modele} (${j.tour})`,
  }));
  const { error } = await admin.from("usage_ia").insert(lignes);
  if (error) console.error("verification-deux-ia usage_ia insert:", error.message);
}
